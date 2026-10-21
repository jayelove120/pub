'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { api } from '@/lib/api-client';
import { getSupabaseBrowserClientAsync } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/lib/toast';
import { LogOut, KeyRound, ScrollText, UserRound } from 'lucide-react';

export default function ProfilePage() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    api.get('/api/logs?pageSize=20')
      .then((d: any) => setLogs(d.rows || []))
      .catch(() => setLogs([]))
      .finally(() => setLoadingLogs(false));
  }, []);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast({ title: '新密码至少 6 位', variant: 'destructive' }); return; }
    if (newPassword !== confirm) { toast({ title: '两次输入的新密码不一致', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const client = await getSupabaseBrowserClientAsync();
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      toast({ title: '密码修改成功，请重新登录' });
      setOldPassword(''); setNewPassword(''); setConfirm('');
      setTimeout(() => { signOut(); router.replace('/login'); }, 1200);
    } catch (e: any) {
      toast({ title: '修改失败', description: e.message || '请重试', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" /></div>;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white">
          {profile.name?.slice(0, 1) || 'U'}
        </div>
        <div className="flex-1">
          <p className="text-base font-semibold text-neutral-900">{profile.name}</p>
          <p className="text-sm text-neutral-500">{profile.email}</p>
          <Badge variant="outline" className={profile.role === 'admin' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-neutral-200 bg-neutral-50 text-neutral-600'}>
            {profile.role === 'admin' ? '系统管理员' : '设备管理员'}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><KeyRound className="h-4 w-4" />修改密码</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>当前密码</Label>
            <Input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="请输入当前密码" />
          </div>
          <div className="space-y-1.5">
            <Label>新密码</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="至少 6 位" />
          </div>
          <div className="space-y-1.5">
            <Label>确认新密码</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="再次输入新密码" />
          </div>
          <Button className="w-full" onClick={handleChangePassword} disabled={saving || !oldPassword || !newPassword}>
            {saving ? '提交中...' : '确认修改'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3"><CardTitle className="flex items-center gap-2 text-sm"><ScrollText className="h-4 w-4" />我的操作记录</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loadingLogs ? (
            <div className="space-y-2 p-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : logs.length === 0 ? (
            <p className="p-4 text-center text-sm text-neutral-400">暂无操作记录</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {logs.map((l) => (
                <li key={l.id} className="flex items-start gap-2 p-3 text-sm">
                  <CallRecordBubble />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-neutral-800">{l.operation_content}</p>
                    <p className="text-xs text-neutral-400">{new Date(l.created_at).toLocaleString('zh-CN')}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full" onClick={() => { signOut(); router.replace('/login'); }}>
        <LogOut className="mr-1 h-4 w-4" />退出登录
      </Button>
      <p className="text-center text-xs text-neutral-400">账号：{profile.email}</p>
    </div>
  );
}

function CallRecordBubble() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-50 text-blue-500">
      <UserRound className="h-3 w-3" />
    </span>
  );
}