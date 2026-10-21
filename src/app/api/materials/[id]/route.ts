import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ok, fail, parseBody, requireUser, toErrorResponse } from '@/lib/api';
import { requireAdmin, AuthError } from '@/lib/auth';
import { writeOperationLog } from '@/lib/store';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    void user;
    const { id } = await ctx.params;
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('materials')
      .select(
        '*, categories:spare_part_categories(id, name), levels:spare_part_levels(id, name), default_supplier:suppliers(id, name), inventory(quantity, total_value)',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return fail('物料不存在', 404);
    return ok(data);
  } catch (e) {
    return toErrorResponse(e);
  }
}

async function handleUpdate(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    requireAdmin(user);
    const { id } = await ctx.params;
    const body = await parseBody<{
      code?: string;
      name?: string;
      spec?: string;
      category_id?: string | null;
      level_id?: string | null;
      unit?: string;
      unit_price?: string | number;
      safety_stock?: number;
      default_supplier_id?: string | null;
      storage_location?: string;
      remark?: string;
      is_active?: boolean;
    }>(req);

    if (body.code !== undefined && !String(body.code).trim()) return fail('物料编码不能为空');
    if (body.name !== undefined && !String(body.name).trim()) return fail('物料名称不能为空');

    const client = getSupabaseClient();
    const now = new Date().toISOString();

    if (body.code !== undefined) {
      const { data: dup, error: dupErr } = await client
        .from('materials')
        .select('id')
        .eq('code', String(body.code).trim())
        .neq('id', id)
        .limit(1);
      if (dupErr) throw new Error(dupErr.message);
      if (dup && dup.length > 0) return fail('物料编码已存在', 409);
    }

    const { data, error } = await client
      .from('materials')
      .update({
        code: body.code !== undefined ? String(body.code).trim() : undefined,
        name: body.name !== undefined ? String(body.name).trim() : undefined,
        spec: body.spec,
        category_id: body.category_id === undefined ? undefined : body.category_id,
        level_id: body.level_id === undefined ? undefined : body.level_id,
        unit: body.unit,
        unit_price: body.unit_price !== undefined ? String(Number(body.unit_price) || 0) : undefined,
        safety_stock: body.safety_stock !== undefined ? Number(body.safety_stock) || 0 : undefined,
        default_supplier_id: body.default_supplier_id === undefined ? undefined : body.default_supplier_id,
        storage_location: body.storage_location,
        remark: body.remark,
        is_active: body.is_active,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return fail('物料不存在', 404);

    // 同步更新库存总价值（单价变动时）
    if (body.unit_price !== undefined) {
      const { data: inv, error: invErr } = await client
        .from('inventory')
        .select('id, quantity')
        .eq('material_id', id)
        .maybeSingle();
      if (invErr) throw new Error(invErr.message);
      if (inv) {
        const price = Number(body.unit_price) || 0;
        const { error: upErr } = await client
          .from('inventory')
          .update({ total_value: String(inv.quantity * price), updated_at: now })
          .eq('id', inv.id);
        if (upErr) throw new Error(upErr.message);
      }
    }

    await writeOperationLog({
      user,
      operationType: '编辑',
      content: `编辑物料「${data.name}」（${data.code}）`,
      req,
    });
    return ok(data);
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message, e.status, e.code);
    return toErrorResponse(e);
  }
}

// 更新物料：同时支持 PUT（规范）与 POST（部分代理对 PUT body 处理异常时）
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleUpdate(req, ctx);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleUpdate(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    requireAdmin(user);
    const { id } = await ctx.params;
    const client = getSupabaseClient();

    const { data: material, error: findErr } = await client
      .from('materials')
      .select('id, name, code')
      .eq('id', id)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!material) return fail('物料不存在', 404);

    // 删除关联库存（存在出入库记录时改为停用）
    const { data: hasTx, error: txErr } = await client
      .from('inventory_transactions')
      .select('id')
      .eq('material_id', id)
      .limit(1);
    if (txErr) throw new Error(txErr.message);

    if (hasTx && hasTx.length > 0) {
      await client.from('materials').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
      await writeOperationLog({
        user,
        operationType: '删除',
        content: `物料「${material.name}」存在业务记录，已停用`,
        req,
      });
      return ok({ success: true, disabled: true, message: '该物料已有业务记录，已改为停用' });
    }

    await client.from('inventory').delete().eq('material_id', id);
    const { error: delErr } = await client.from('materials').delete().eq('id', id);
    if (delErr) throw new Error(delErr.message);

    await writeOperationLog({
      user,
      operationType: '删除',
      content: `删除物料「${material.name}」（${material.code}）`,
      req,
    });
    return ok({ success: true });
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message, e.status, e.code);
    return toErrorResponse(e);
  }
}