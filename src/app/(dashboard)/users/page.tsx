'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/toast';
import { EmptyState } from '@/components/empty-state';
import { UserCog } from 'lucide-react';

export default function UsersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'operator', phone: '', password: '', receive_alert_sms: true });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/users');
      setRows(d.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', email: '', role: 'operator', phone: '', password: '', receive_alert_sms: true });
    setOpen(true);
  };
  const openEdit = (u: any) => {
    setEditing(u);
    setForm({ name: u.name || '', email: u.email || '', role: u.role || 'operator', phone: u.phone || '', password: '', receive_alert_sms: !!u.receive_alert_sms });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: '请填写姓名和邮箱', variant: 'destructive' });
      return;
    }
    if (!editing && !form.password) {
      toast({ title: '新用户需要设置初始密码', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.post(`/api/users/${editing.user_id}`, { ...form, id: editing.user_id });
        toast({ title: '用户已更新' });
      } else {
        await api.post('/api/users', form);
        toast({ title: '用户已创建' });
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast({ title: '保存失败', description: e.message || '请重试', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filtered = rows.filter((u) => !search || (u.name || '').includes(search) || (u.email || '').includes(search));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight"><UserCog className="mr-1 inline h-5 w-5" />用户管理</h1>
          <p className="text-sm text-muted-foreground">管理系统账号与角色权限（仅系统管理员）</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="搜索用户" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[180px]" />
          <Button onClick={openAdd}>新增用户</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">账号列表</CardTitle>
          <CardDescription>共 {filtered.length} 个账号</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">姓名</th>
                  <th className="px-4 py-2.5 font-medium">邮箱</th>
                  <th className="px-4 py-2.5 font-medium">角色</th>
                  <th className="px-4 py-2.5 font-medium">手机</th>
                  <th className="px-4 py-2.5 font-medium">接收预警短信</th>
                  <th className="px-4 py-2.5 font-medium">状态</th>
                  <th className="px-4 py-2.5 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b"><td colSpan={7}><Skeleton className="mx-4 my-2 h-8" /></td></tr>
                )) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="py-8"><EmptyState description="暂无用户" /></td></tr>
                ) : filtered.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-muted/40">
                    <td className="px-4 py-2.5 font-medium">{u.name}</td>
                    <td className="px-4 py-2.5">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={u.role === 'admin' ? 'default' : 'outline'} className={u.role === 'admin' ? '' : ''}>
                        {u.role === 'admin' ? '系统管理员' : '设备管理员'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">{u.phone || '-'}</td>
                    <td className="px-4 py-2.5">{u.receive_alert_sms ? '是' : '否'}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={u.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-muted text-muted-foreground'}>
                        {u.is_active ? '启用' : '停用'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(u)}>编辑</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? '编辑用户' : '新增用户'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>姓名 *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="请输入姓名" />
            </div>
            <div className="space-y-1.5">
              <Label>邮箱 *</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" disabled={!!editing} />
            </div>
            <div className="space-y-1.5">
              <Label>角色</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">系统管理员</SelectItem>
                  <SelectItem value="operator">设备管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>手机号</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="接收短信的手机号" />
            </div>
            {!editing && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>初始密码 *</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="至少6位" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}