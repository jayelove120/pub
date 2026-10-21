'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { Loader2, Plus, Pencil, Search } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  contact_phone?: string;
  address?: string;
  remark?: string;
  is_active: boolean;
}

export default function SuppliersPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<Supplier[]>('/api/suppliers');
      setRows(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((s) => !keyword || s.name.includes(keyword) || s.contact_person?.includes(keyword) || s.contact_phone?.includes(keyword));

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', contact_person: '', contact_phone: '', address: '', remark: '' });
    setOpen(true);
  };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, contact_person: s.contact_person ?? '', contact_phone: s.contact_phone ?? '', address: s.address ?? '', remark: s.remark ?? '' });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return toast.error('请填写供应商名称');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact_person: form.contact_person || null,
        contact_phone: form.contact_phone || null,
        address: form.address || null,
        remark: form.remark || null,
      };
      if (editing) {
        await api(`/api/suppliers/${editing.id}`, { method: 'POST', body: payload });
        toast.success('供应商已更新');
      } else {
        await api('/api/suppliers', { method: 'POST', body: payload });
        toast.success('供应商已新增');
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">供应商管理</h1>
          <p className="text-sm text-neutral-500">维护备件供应商基础信息</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-1.5 h-4 w-4" /> 新增供应商
          </Button>
        )}
      </div>

      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <Input placeholder="搜索名称 / 联系人 / 电话" className="h-9 pl-8" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="暂无供应商" description="点击右上角新增供应商" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>供应商名称</TableHead>
                <TableHead>联系人</TableHead>
                <TableHead>联系电话</TableHead>
                <TableHead>地址</TableHead>
                <TableHead>备注</TableHead>
                <TableHead>状态</TableHead>
                {isAdmin && <TableHead className="text-right">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.contact_person || '-'}</TableCell>
                  <TableCell className="tabular-nums">{s.contact_phone || '-'}</TableCell>
                  <TableCell className="text-neutral-500">{s.address || '-'}</TableCell>
                  <TableCell className="text-neutral-500">{s.remark || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={s.is_active ? 'default' : 'secondary'}>{s.is_active ? '启用' : '停用'}</Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑供应商' : '新增供应商'}</DialogTitle>
            <DialogDescription>填写供应商基础联系方式。</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>供应商名称</Label>
                <Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>联系人</Label>
                <Input value={form.contact_person ?? ''} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>联系电话</Label>
                <Input value={form.contact_phone ?? ''} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>地址</Label>
                <Input value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>备注</Label>
                <Input value={form.remark ?? ''} onChange={(e) => setForm({ ...form, remark: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}