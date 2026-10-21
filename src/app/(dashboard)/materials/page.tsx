'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { Loader2, Plus, Upload, Pencil, Trash2, Search } from 'lucide-react';

interface Material {
  id: string;
  code: string;
  name: string;
  spec?: string;
  category_id?: string;
  level_id?: string;
  unit: string;
  unit_price: string;
  safety_stock: number;
  default_supplier_id?: string;
  storage_location?: string;
  remark?: string;
  is_active: boolean;
  categories?: { name?: string } | null;
  levels?: { name?: string } | null;
  default_supplier?: { name?: string } | null;
}

export default function MaterialsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [rows, setRows] = useState<Material[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [lvls, setLvls] = useState<{ id: string; name: string }[]>([]);
  const [sups, setSups] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [deleting, setDeleting] = useState<Material | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [form, setForm] = useState<Record<string, string>>({});

  const pageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (keyword) params.set('keyword', keyword);
      const d = await api<{ rows: Material[]; total: number }>(`/api/materials?${params.toString()}`);
      setRows(d.rows);
      setTotal(d.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  const loadOptions = useCallback(async () => {
    try {
      const [c, l, s] = await Promise.all([api<unknown[]>('/api/categories'), api<unknown[]>('/api/levels'), api<unknown[]>('/api/suppliers')]);
      setCats((c as { id: string; name: string }[]).filter((x) => (x as { is_active?: boolean }).is_active !== false));
      setLvls((l as { id: string; name: string }[]).filter((x) => (x as { is_active?: boolean }).is_active !== false));
      setSups((s as { id: string; name: string }[]).filter((x) => (x as { is_active?: boolean }).is_active !== false));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', spec: '', category_id: '', level_id: '', unit: '个', unit_price: '0', safety_stock: '0', default_supplier_id: '', storage_location: '', remark: '' });
    setOpen(true);
  };

  const openEdit = (m: Material) => {
    setEditing(m);
    setForm({
      code: m.code,
      name: m.name,
      spec: m.spec ?? '',
      category_id: m.category_id ?? '',
      level_id: m.level_id ?? '',
      unit: m.unit,
      unit_price: m.unit_price,
      safety_stock: String(m.safety_stock),
      default_supplier_id: m.default_supplier_id ?? '',
      storage_location: m.storage_location ?? '',
      remark: m.remark ?? '',
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code?.trim() || !form.name?.trim()) return toast.error('请填写编码和名称');
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        spec: form.spec || null,
        category_id: form.category_id || null,
        level_id: form.level_id || null,
        unit: form.unit || '个',
        unit_price: form.unit_price || '0',
        safety_stock: Number(form.safety_stock) || 0,
        default_supplier_id: form.default_supplier_id || null,
        storage_location: form.storage_location || null,
        remark: form.remark || null,
      };
      if (editing) {
        await api(`/api/materials/${editing.id}`, { method: 'POST', body: payload });
        toast.success('物料已更新');
      } else {
        await api('/api/materials', { method: 'POST', body: payload });
        toast.success('物料已新增');
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await api(`/api/materials/${deleting.id}`, { method: 'DELETE' });
      toast.success('物料已删除');
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const onImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const d = await api<{ successCount: number; errorCount: number }>('/api/import/materials', {
        method: 'POST',
        body: { csv: text },
      });
      toast.success(`导入成功 ${d.successCount} 条${d.errorCount ? `，失败 ${d.errorCount} 条` : ''}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">物料管理</h1>
          <p className="text-sm text-neutral-500">配置备件物料信息、安全库存阈值与默认供应商</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center">
              <Upload className="mr-1.5 h-4 w-4" />
              <span className="text-sm">批量导入</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={importing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                  e.target.value = '';
                }}
              />
            </label>
            <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-1.5 h-4 w-4" /> 新增物料
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="搜索编码 / 名称 / 规格"
            className="h-9 pl-8"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="暂无物料" description="点击右上角新增物料或批量导入初始数据" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>编码</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>规格型号</TableHead>
                <TableHead>类别</TableHead>
                <TableHead>级别</TableHead>
                <TableHead>单位</TableHead>
                <TableHead className="text-right">单价</TableHead>
                <TableHead className="text-right">安全库存</TableHead>
                <TableHead>供应商</TableHead>
                <TableHead>存放位置</TableHead>
                <TableHead>状态</TableHead>
                {isAdmin && <TableHead className="text-right">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-[13px]">{m.code}</TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-neutral-500">{m.spec || '-'}</TableCell>
                  <TableCell>{m.categories?.name || '-'}</TableCell>
                  <TableCell>
                    {m.levels?.name ? <Badge variant="outline">{m.levels.name}</Badge> : '-'}
                  </TableCell>
                  <TableCell>{m.unit}</TableCell>
                  <TableCell className="text-right tabular-nums">¥{Number(m.unit_price).toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.safety_stock}</TableCell>
                  <TableCell>{m.default_supplier?.name || '-'}</TableCell>
                  <TableCell>{m.storage_location || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={m.is_active ? 'default' : 'secondary'}>{m.is_active ? '启用' : '停用'}</Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => setDeleting(m)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 text-sm text-neutral-500">
        <span>
          共 {total} 条，第 {page}/{totalPages} 页
        </span>
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          上一页
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          下一页
        </Button>
      </div>

      {/* 新增 / 编辑弹窗 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑物料' : '新增物料'}</DialogTitle>
            <DialogDescription>选择类别、级别与供应商，完善物料档案信息。</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>物料编码</Label>
                <Input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="如 JX-001" />
              </div>
              <div className="space-y-1.5">
                <Label>物料名称</Label>
                <Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 深沟球轴承" />
              </div>
              <div className="space-y-1.5">
                <Label>规格型号</Label>
                <Input value={form.spec ?? ''} onChange={(e) => setForm({ ...form, spec: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>单位</Label>
                <Input value={form.unit ?? ''} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>类别</Label>
                <Select value={form.category_id || 'none'} onValueChange={(v) => setForm({ ...form, category_id: v === 'none' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择类别" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">无</SelectItem>
                    {cats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>级别</Label>
                <Select value={form.level_id || 'none'} onValueChange={(v) => setForm({ ...form, level_id: v === 'none' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择级别" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">无</SelectItem>
                    {lvls.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>默认供应商</Label>
                <Select value={form.default_supplier_id || 'none'} onValueChange={(v) => setForm({ ...form, default_supplier_id: v === 'none' ? '' : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择供应商" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">无</SelectItem>
                    {sups.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>单价（元）</Label>
                <Input type="number" min={0} step="0.01" value={form.unit_price ?? ''} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>安全库存阈值</Label>
                <Input type="number" min={0} value={form.safety_stock ?? ''} onChange={(e) => setForm({ ...form, safety_stock: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>存放位置</Label>
                <Input value={form.storage_location ?? ''} onChange={(e) => setForm({ ...form, storage_location: e.target.value })} />
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

      {/* 删除确认 */}
      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除物料？</AlertDialogTitle>
            <AlertDialogDescription>
              物料「{deleting?.name}」（{deleting?.code}）将被删除。请确认其库存已清零，此操作会记录操作日志。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}