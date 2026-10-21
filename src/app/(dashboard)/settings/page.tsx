'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/lib/toast';
import { MessageSquareWarning } from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>({
    enabled: false,
    provider: 'coze-plugin',
    plugin_id: '',
    tool_name: 'send_sms',
    receiver_phones: [''],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/settings');
      const c = d.sms_config || {};
      setConfig({
        enabled: !!c.enabled,
        provider: c.provider || 'coze-plugin',
        plugin_id: c.plugin_id || '',
        tool_name: c.tool_name || 'send_sms',
        receiver_phones: (c.receiver_phones && (c.receiver_phones as string[]).length ? c.receiver_phones : ['']) as string[],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updatePhone = (i: number, v: string) => {
    const arr = [...config.receiver_phones];
    arr[i] = v;
    setConfig({ ...config, receiver_phones: arr });
  };
  const addPhone = () => setConfig({ ...config, receiver_phones: [...config.receiver_phones, ''] });
  const removePhone = (i: number) => setConfig({ ...config, receiver_phones: config.receiver_phones.filter((_: string, idx: number) => idx !== i) });

  const handleSave = async () => {
    setSaving(true);
    try {
      const phones = config.receiver_phones.map((p: string) => p.trim()).filter(Boolean);
      await api.put('/api/settings', { sms_config: { ...config, receiver_phones: phones } });
      toast({ title: '配置已保存' });
    } catch (e: any) {
      toast({ title: '保存失败', description: e.message || '请重试', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight"><MessageSquareWarning className="mr-1 inline h-5 w-5" />系统配置</h1>
        <p className="text-sm text-muted-foreground">配置库存预警短信通知（仅系统管理员）</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">库存预警短信通知</CardTitle>
          <CardDescription>库存低于安全库存时，自动向下方接收人发送短信。接入扣子平台短信插件（coze-asset-runner）。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="font-medium">启用短信通知</div>
              <div className="text-xs text-muted-foreground">关闭后仅生成预警记录，不发送短信</div>
            </div>
            <Switch checked={config.enabled} onCheckedChange={(v) => setConfig({ ...config, enabled: v })} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>短信接入方式</Label>
              <Input value={config.provider} onChange={(e) => setConfig({ ...config, provider: e.target.value })} disabled />
              <p className="text-xs text-muted-foreground">固定为扣子平台插件调用</p>
            </div>
            <div className="space-y-1.5">
              <Label>插件 ID（可空）</Label>
              <Input value={config.plugin_id} onChange={(e) => setConfig({ ...config, plugin_id: e.target.value })} placeholder="plugin id" />
            </div>
            <div className="space-y-1.5">
              <Label>工具名</Label>
              <Input value={config.tool_name} onChange={(e) => setConfig({ ...config, tool_name: e.target.value })} placeholder="send_sms" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>短信接收人手机号</Label>
            {config.receiver_phones.map((p: string, i: number) => (
              <div key={i} className="flex gap-2">
                <Input value={p} onChange={(e) => updatePhone(i, e.target.value)} placeholder="如 13800000000" />
                {config.receiver_phones.length > 1 && (
                  <Button type="button" variant="outline" size="icon" onClick={() => removePhone(i)}>×</Button>
                )}
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={addPhone}>+ 添加接收人</Button>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存配置'}</Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        说明：短信服务依赖扣子平台短信插件集成。当前环境中未发现可用的短信插件，系统会在未配置插件时如实记录"短信未发送"并支持后续接入；接入插件后只需在此填写插件 ID 与工具名即可生效。
      </p>
    </div>
  );
}