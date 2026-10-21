import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ok, fail, parseBody, requireUser, toErrorResponse } from '@/lib/api';
import { requireAdmin, AuthError } from '@/lib/auth';
import { writeOperationLog } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const showInactive = !!req.nextUrl.searchParams.get('all') && user.role === 'admin';
    const client = getSupabaseClient();
    let query = client.from('suppliers').select('*');
    if (!showInactive) query = query.eq('is_active', true);
    const { data, error } = await query.order('created_at', { ascending: true });
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
      contact_person?: string;
      contact_phone?: string;
      address?: string;
      remark?: string;
      is_active?: boolean;
    }>(req);
    if (!body.name || !String(body.name).trim()) {
      return fail('供应商名称不能为空');
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('suppliers')
      .insert({
        name: String(body.name).trim(),
        contact_person: body.contact_person || null,
        contact_phone: body.contact_phone || null,
        address: body.address || null,
        remark: body.remark || null,
        is_active: body.is_active ?? true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await writeOperationLog({
      user,
      operationType: '新增',
      content: `新增供应商「${data.name}」`,
      req,
    });
    return ok(data, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message, e.status, e.code);
    return toErrorResponse(e);
  }
}