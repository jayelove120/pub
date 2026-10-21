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
      level?: number;
      description?: string;
      sort_order?: number;
      is_active?: boolean;
    }>(req);

    const now = new Date().toISOString();
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('spare_part_categories')
      .update({
        name: body.name !== undefined ? String(body.name).trim() : undefined,
        level: body.level !== undefined ? Number(body.level) : undefined,
        description: body.description,
        sort_order: body.sort_order !== undefined ? Number(body.sort_order) || 0 : undefined,
        is_active: body.is_active,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return fail('分类不存在', 404);

    await writeOperationLog({
      user,
      operationType: '编辑',
      content: `编辑备件分类「${data.name}」`,
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

    const { data: category, error: findErr } = await client
      .from('spare_part_categories')
      .select('id, name')
      .eq('id', id)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!category) return fail('分类不存在', 404);

    const { data: used, error: usedErr } = await client
      .from('materials')
      .select('id')
      .eq('category_id', id)
      .limit(1);
    if (usedErr) throw new Error(usedErr.message);
    if (used && used.length > 0) {
      return fail('该分类下已有物料，无法删除，可改为停用', 409);
    }

    const { error } = await client.from('spare_part_categories').delete().eq('id', id);
    if (error) throw new Error(error.message);

    await writeOperationLog({
      user,
      operationType: '删除',
      content: `删除备件分类「${category.name}」`,
      req,
    });
    return ok({ success: true });
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message, e.status, e.code);
    return toErrorResponse(e);
  }
}