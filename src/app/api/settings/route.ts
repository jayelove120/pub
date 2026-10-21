import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ok, requireUser, toErrorResponse } from '@/lib/api';
import { requireAdmin, AuthError } from '@/lib/auth';
import { getSetting, upsertSetting } from '@/lib/store';
import { parseBody } from '@/lib/api';

/** 获取系统配置（短信、预警规则） */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    void user;
    const smsConfig = await getSetting('sms_config');
    return ok({ sms_config: smsConfig ?? {} });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** 更新系统配置（仅管理员） */
export async function PUT(req: NextRequest) {
  try {
    return await handleUpdate(req);
  } catch (e) {
    return toErrorResponse(e);
  }
}
export async function POST(req: NextRequest) {
  return handleUpdate(req);
}

async function handleUpdate(req: NextRequest) {
  try {
    const user = await requireUser(req);
    requireAdmin(user);
    const body = await parseBody<{
      sms_config?: Record<string, unknown>;
    }>(req);

    if (body.sms_config !== undefined) {
      await upsertSetting('sms_config', body.sms_config, '库存预警短信通知配置（扣子平台短信插件）');
    }

    return ok({ success: true });
  } catch (e) {
    if (e instanceof AuthError) return toErrorResponse(e);
    return toErrorResponse(e);
  }
}