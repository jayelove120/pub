import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ok, requireUser, toErrorResponse, parseBody } from '@/lib/api';
import { requireAdmin, AuthError } from '@/lib/auth';
import { writeOperationLog } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    requireAdmin(user);
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('profiles')
      .select('id, user_id, email, name, role, phone, receive_alert_sms, is_active, created_at')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return ok({ data: data ?? [] });
  } catch (e) {
    if (e instanceof AuthError) return new Response(JSON.stringify({ error: e.message, code: e.code }), { status: e.status });
    return toErrorResponse(e);
  }
}

/** 新增用户：创建 auth 账号 + 角色档案（仅管理员） */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    requireAdmin(user);
    const body = await parseBody<{
      name: string; email: string; role?: string; phone?: string; password: string; receive_alert_sms?: boolean;
    }>(req);

    if (!body.name?.trim() || !body.email?.trim()) throw new Error('姓名和邮箱不能为空');
    if (!body.password || body.password.length < 6) throw new Error('密码至少 6 位');
    if ((body.role !== 'admin' && body.role !== 'operator')) throw new Error('角色无效');

    const client = getSupabaseClient();
    const { data: created, error: authErr } = await client.auth.admin.createUser({
      email: body.email.trim(),
      password: body.password,
      email_confirm: true,
    });
    if (authErr) throw new Error('创建账号失败：' + authErr.message);

    const userId = created?.user?.id;
    if (!userId) throw new Error('创建账号失败');

    const profile = {
      user_id: userId,
      email: body.email.trim(),
      name: body.name.trim(),
      role: body.role,
      phone: body.phone?.trim() || null,
      receive_alert_sms: body.receive_alert_sms ?? true,
      is_active: true,
    };
    const { error } = await client.from('profiles').upsert(profile);
    if (error) throw new Error(error.message);

    await writeOperationLog({ user, operationType: '新增', content: `新增用户「${body.name}」（${body.role === 'admin' ? '系统管理员' : '设备管理员'}）`, req });
    return ok({ success: true, user_id: userId }, 201);
  } catch (e) {
    if (e instanceof AuthError) return new Response(JSON.stringify({ error: e.message, code: e.code }), { status: e.status });
    return toErrorResponse(e);
  }
}