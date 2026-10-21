import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ok, requireUser, toErrorResponse, parseBody } from '@/lib/api';
import { requireAdmin, AuthError } from '@/lib/auth';
import { writeOperationLog } from '@/lib/store';

type Ctx = { params: Promise<{ id: string }> };

/** 更新用户角色/信息（仅管理员） */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    requireAdmin(user);
    const { id } = await ctx.params;
    const body = await parseBody<{
      name?: string; role?: string; phone?: string; password?: string; receive_alert_sms?: boolean;
    }>(req);

    if (body.role && body.role !== 'admin' && body.role !== 'operator') throw new Error('角色无效');

    const client = getSupabaseClient();
    if (body.password) {
      const { error: pwdErr } = await client.auth.admin.updateUserById(id, { password: body.password });
      if (pwdErr) throw new Error('重置密码失败：' + pwdErr.message);
    }

    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name.trim();
    if (body.role !== undefined) patch.role = body.role;
    if (body.phone !== undefined) patch.phone = body.phone?.trim() || null;
    if (body.receive_alert_sms !== undefined) patch.receive_alert_sms = body.receive_alert_sms;

    if (Object.keys(patch).length) {
      const { error } = await client.from('profiles').update(patch).eq('user_id', id);
      if (error) throw new Error(error.message);
      const { data: p } = await client.from('profiles').select('name').eq('user_id', id).single();
      await writeOperationLog({ user, operationType: '编辑', content: `编辑用户「${p?.name || id}」的档案信息`, req });
    }

    return ok({ success: true });
  } catch (e) {
    if (e instanceof AuthError) return new Response(JSON.stringify({ error: e.message, code: e.code }), { status: e.status });
    return toErrorResponse(e);
  }
}