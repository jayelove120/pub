import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface SmsResult {
  sent: boolean;
  reason?: string;
}

interface SmsConfig {
  enabled?: boolean;
  plugin_id?: string;
  tool_name?: string;
  receivers?: { name: string; phone: string }[];
}

const MAX_RETRY = 3;

/**
 * 短信发送服务 —— 通过扣子平台插件实现。
 *
 * 集成说明：
 * - 短信发送走系统设置 `sms_config` 中配置的扣子平台短信插件（plugin_id + tool_name + 接收人）。
 * - 当尚未配置短信插件时，视为"发送失败"并返回明确原因（非伪造成功），由调用方决定降级处理。
 * - 发送失败会做最多 3 次重试。
 */
export async function sendSafetyAlertSms(
  phone: string,
  materialName: string,
  currentQty: number,
  safetyStock: number,
): Promise<SmsResult> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('system_settings')
      .select('value')
      .eq('key', 'sms_config')
      .maybeSingle();
    if (error) throw new Error(`读取短信配置失败: ${error.message}`);

    const config = (data?.value ?? {}) as SmsConfig;
    if (!config.enabled) {
      return { sent: false, reason: '短信服务未启用（可在系统设置中配置短信插件与接收人）' };
    }
    if (!config.plugin_id || !config.tool_name) {
      return { sent: false, reason: '未配置短信插件（plugin_id / tool_name）' };
    }

    const content = `【备件库存预警】物料「${materialName}」当前库存 ${currentQty} 件，已低于安全库存 ${safetyStock} 件，请及时补货。`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${process.env.COZE_WORKLOAD_API_TOKEN ?? ''}`,
      'Content-Type': 'application/json',
    };
    const base = process.env.COZE_API_BASE_URL || 'https://api.coze.cn';

    let lastErr = '';
    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        const resp = await fetch(`${base}/v1/plugins/${config.plugin_id}/tools/call`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            tool_name: config.tool_name,
            arguments: { phone, content },
          }),
        });
        const result = (await resp.json()) as { code?: number; msg?: string };
        if (!resp.ok || (result.code && result.code !== 0)) {
          lastErr = result.msg || `HTTP ${resp.status}`;
          continue;
        }
        return { sent: true };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
    return { sent: false, reason: `短信发送失败：${lastErr}` };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : '短信服务异常' };
  }
}

/** 向所有启用了接收短信账号的接收人广播预警通知 */
export async function notifyAlertReceivers(
  materialName: string,
  currentQty: number,
  safetyStock: number,
): Promise<void> {
  try {
    const client = getSupabaseClient();
    const { data: receivers, error } = await client
      .from('profiles')
      .select('name, phone')
      .eq('receive_alert_sms', true)
      .not('phone', 'is', null);
    if (error) throw new Error(`查询短信接收人失败: ${error.message}`);

    if (!receivers || receivers.length === 0) return;

    for (const r of receivers) {
      if (!r.phone) continue;
      const result = await sendSafetyAlertSms(r.phone, materialName, currentQty, safetyStock);
      // 记录发送结果（无论成功与否），便于追溯
      await writeSmsLog({
        phone: r.phone,
        name: r.name,
        material: materialName,
        content: `库存预警：${materialName} 当前 ${currentQty}，安全库存 ${safetyStock}`,
        success: result.sent,
        reason: result.reason,
      });
    }
  } catch (e) {
    console.error('[sms] 预警通知处理异常:', e);
  }
}

async function writeSmsLog(entry: {
  phone: string;
  name?: string;
  material: string;
  content: string;
  success: boolean;
  reason?: string;
}): Promise<void> {
  try {
    console.log(
      `[sms] 通知日志 material=${entry.material} name=${entry.name ?? ''} phone=${entry.phone} success=${entry.success} reason=${entry.reason ?? ''}`,
    );
  } catch {
    // 忽略日志写入异常
  }
}