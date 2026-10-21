import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ok, fail, parseBody, requireUser, toErrorResponse } from '@/lib/api';
import { requireAdmin, AuthError } from '@/lib/auth';
import { writeOperationLog } from '@/lib/store';

async function handleUpdate(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    requireAdmin(user);
    const { id } = await ctx.params;
    const body = await parseBody<{
      name?: string;
      contact_person?: string;
      contact_phone?: string;
      address?: string;
      remark?: string;
      is_active?: boolean;
    }>(req);

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('suppliers')
      .update({
        name: body.name !== undefined ? String(body.name).trim() : undefined,
        contact_person: body.contact_person,
        contact_phone: body.contact_phone,
        address: body.address,
        remark: body.remark,
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return fail('供应商不存在', 404);

    await writeOperationLog({
      user,
      operationType: '编辑',
      content: `编辑供应商「${data.name}」`,
      req,
    });
    return ok(data);
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message, e.status, e.code);
    return toErrorResponse(e);
  }
}

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

    const { data: supplier, error: findErr } = await client
      .from('suppliers')
      .select('id, name')
      .eq('id', id)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!supplier) return fail('供应商不存在', 404);

    const { data: used, error: usedErr } = await client
      .from('materials')
      .select('id')
      .eq('default_supplier_id', id)
      .limit(1);
    if (usedErr) throw new Error(usedErr.message);
    if (used && used.length > 0) {
      return fail('该供应商已被物料引用，无法删除，可改为停用', 409);
    }

    const { data: linked, error: linkErr } = await client
      .from('material_suppliers')
      .select('id')
      .eq('supplier_id', id)
      .limit(1);
    if (linkErr) throw new Error(linkErr.message);
    if (linked && linked.length > 0) {
      return fail('该供应商已关联到物料，无法删除，可改为停用', 409);
    }

    const { error } = await client.from('suppliers').delete().eq('id', id);
    if (error) throw new Error(error.message);

    await writeOperationLog({
      user,
      operationType: '删除',
      content: `删除供应商「${supplier.name}」`,
      req,
    });
    return ok({ success: true });
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message, e.status, e.code);
    return toErrorResponse(e);
  }
}