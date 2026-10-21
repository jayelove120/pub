import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ok, parseBody, requireUser, toErrorResponse } from '@/lib/api';
import { AuthError } from '@/lib/auth';
import { writeOperationLog } from '@/lib/store';

/** 获取当前登录用户档案（含手机号 / 是否接收预警短信） */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('profiles')
      .select('id, user_id, email, name, role, phone, receive_alert_sms, is_active, created_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return ok(data ?? { ...user });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 更新当前用户档案（姓名、手机号、是否接收预警短信；admin 可调整角色） */
export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await parseBody<{
      name?: string;
      phone?: string;
      receive_alert_sms?: boolean;
      role?: string;
    }>(req);

    const client = getSupabaseClient();
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.receive_alert_sms !== undefined) updateData.receive_alert_sms = body.receive_alert_sms;
    if (body.role !== undefined) {
      if (user.role !== 'admin') throw new AuthError('无权修改角色', 403);
      updateData.role = body.role === 'admin' ? 'admin' : 'operator';
    }
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await client.from('profiles').update(updateData).eq('user_id', user.id).select().maybeSingle();
    if (error) throw new Error(error.message);

    await writeOperationLog({
      user,
      operationType: '编辑',
      content: '更新个人信息',
      req,
    });
    return ok(data);
  } catch (e) {
    if (e instanceof AuthError) return new NextResponse(JSON.stringify({ error: e.message, code: e.code }), { status: e.status });
    return toErrorResponse(e);
  }
}