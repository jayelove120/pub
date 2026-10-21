import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ok, fail, parseBody, requireUser, toErrorResponse } from '@/lib/api';
import { requireAdmin, AuthError } from '@/lib/auth';
import { writeOperationLog } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    await requireUser(req);
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('spare_part_categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return ok(data);
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    requireAdmin(user);
    const body = await parseBody<{
      name: string;
      description?: string;
      sort_order?: number;
      is_active?: boolean;
    }>(req);
    if (!body.name || !String(body.name).trim()) {
      return fail('分类名称不能为空');
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('spare_part_categories')
      .insert({
        name: String(body.name).trim(),
        description: body.description || null,
        sort_order: Number(body.sort_order ?? 0) || 0,
        is_active: body.is_active ?? true,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await writeOperationLog({
      user,
      operationType: '新增',
      content: `新增备件分类「${data.name}」`,
      req,
    });
    return ok(data, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message, e.status, e.code);
    return toErrorResponse(e);
  }
}