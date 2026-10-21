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
      description?: string;
      sort_order?: number;
      is_active?: boolean;
    }>(req);

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('spare_part_levels')
      .update({
        name: body.name !== undefined ? String(body.name).trim() : undefined,
        description: body.description,
        sort_order: body.sort_order !== undefined ? Number(body.sort_order) || 0 : undefined,
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return fail('分级不存在', 404);

    await writeOperationLog({
      user,
      operationType: '编辑',
      content: `编辑备件分级「${data.name}」`,
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

    // 检查是否被物料引用
    const { data: used, error: usedErr } = await client
      .from('materials')
      .select('id')
      .eq('level_id', id)
      .limit(1);
    if (usedErr) throw new Error(usedErr.message);
    if (used && used.length > 0) {
      return fail('该分级已被物料引用，无法删除（可改为停用）', 400);
    }

    const { data, error } = await client
      .from('spare_part_levels')
      .delete()
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return fail('分级不存在', 404);

    await writeOperationLog({
      user,
      operationType: '删除',
      content: `删除备件分级「${data.name}」`,
      req,
    });
    return ok({ success: true });
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message, e.status, e.code);
    return toErrorResponse(e);
  }
}
