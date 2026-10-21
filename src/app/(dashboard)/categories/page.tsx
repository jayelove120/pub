'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { Loader2, Plus, Pencil, Tag } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
}

export default function CategoriesPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<Category[]>('/api/categories');
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

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', sort_order: '0' });
    setOpen(true);
  };
  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description ?? '', sort_order: String(c.sort_order) });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return toast.error('请填写分类名称');
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), description: form.description, sort_order: Number(form.sort_order) || 0 };
      if (editing) {
        await api(`/api/categories/${editing.id}`, { method: 'POST', body: payload });
        toast.success('分类已更新');
      } else {
        await api('/api/categories', { method: 'POST', body: payload });
        toast.success('分类已新增');
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: Category, active: boolean) => {
    try {
      await api(`/api/categories/${c.id}`, { method: 'POST', body: { is_active: active } });
      toast.success(active ? '分类已启用' : '分类已停用');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">分类管理</h1>
          <p className="text-sm text-neutral-500">维护备件类别标签（如：机械类、电气类），供物料建档时选择</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-1.5 h-4 w-4" /> 新增分类
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-neutral-200">
          <CardContent className="p-6">
            <EmptyState title="暂无分类" description="点击右上角新增备件分类" />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <Card key={c.id} className={`border-neutral-200 ${c.is_active ? '' : 'opacity-60'}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Tag className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-900">{c.name}</p>
                      <p className="text-xs text-neutral-400">排序 {c.sort_order}</p>
                    </div>
                  </div>
                  <Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? '启用' : '停用'}</Badge>
                </div>
                {c.description && <p className="mt-3 text-[13px] text-neutral-500">{c.description}</p>}
                {isAdmin && (
                  <div className="mt-3 flex items-center justify-end gap-2">
                    {c.is_active ? (
                      <Button variant="ghost" size="sm" className="h-8 text-neutral-500" onClick={() => toggle(c, false)}>
                        停用
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-8 text-blue-600" onClick={() => toggle(c, true)}>
                        启用
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-8" onClick={() => openEdit(c)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> 编辑
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '编辑分类' : '新增分类'}</DialogTitle>
            <DialogDescription>设置分类名称与排序。</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label>分类名称</Label>
              <Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 机械类" />
            </div>
            <div className="space-y-1.5">
              <Label>排序</Label>
              <Input type="number" value={form.sort_order ?? ''} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>描述</Label>
              <Input value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
