import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { AppUser } from '@/lib/auth';

interface LogEntry {
  user: AppUser;
  operationType: string;
  content?: string;
  req?: NextRequest;
}

/**
 * 写入操作日志（operation_logs 表，不可删除、不可修改）。
 */
export async function writeOperationLog(entry: LogEntry): Promise<void> {
  try {
    const client = getSupabaseClient();
    const ip = entry.req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? entry.req?.headers.get('x-real-ip')
      ?? '';
    const ua =
      (entry.req?.headers.get('user-agent') ?? '').slice(0, 500) || undefined;

    const { error } = await client.from('operation_logs').insert({
      user_id: entry.user.id,
      user_name: entry.user.name,
      operation_type: entry.operationType,
      operation_content: entry.content,
      ip_address: ip,
      user_agent: ua,
    });
    if (error) {
      // 日志写入失败不阻断主流程，仅兜底抛出已知问题
      console.error('[operation_log] 写入失败:', error.message);
    }
  } catch (e) {
    console.error('[operation_log] 写入异常:', e);
  }
}

/** 读取系统设置（缺失时返回 null） */
export async function getSetting(key: string): Promise<Record<string, unknown> | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(`读取系统设置失败: ${error.message}`);
  return data?.value as Record<string, unknown> | null;
}

/** 写入/更新系统设置 */
export async function upsertSetting(
  key: string,
  value: Record<string, unknown>,
  description?: string,
): Promise<void> {
  const client = getSupabaseClient();
  const now = new Date().toISOString();
  const existingRes = await client.from('system_settings').select('id, key').eq('key', key).maybeSingle();
  if (existingRes.error) throw new Error(`查询系统设置失败: ${existingRes.error.message}`);

  if (existingRes.data) {
    const { error } = await client
      .from('system_settings')
      .update({ value, updated_at: now })
      .eq('id', existingRes.data.id);
    if (error) throw new Error(`更新系统设置失败: ${error.message}`);
  } else {
    const { error } = await client.from('system_settings').insert({
      key,
      value,
      description,
    });
    if (error) throw new Error(`写入系统设置失败: ${error.message}`);
  }
}