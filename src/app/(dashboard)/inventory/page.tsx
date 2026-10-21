'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api, apiDownload } from '@/lib/api-client';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { Download, Plus, Search } from 'lucide-react';

interface InvRow {
  id: string;
  quantity: number;
  total_value: string;
  last_in_time?: string;
  last_out_time?: string;
  material: {
    id: string;
    code: string;
    name: string;
    spec?: string;
    unit: string;
    unit_price: string;
    safety_stock: number;
    storage_location?: string;
    is_active: boolean;
    categories?: { name?: string } | null;
    levels?: { name?: string } | null;
    default_supplier?: { name?: string } | null;
  } | null;
}

export default function InventoryPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [rows, setRows] = useState<InvRow[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (keyword) params.set('keyword', keyword);
      if (categoryId) params.set('categoryId', categoryId);
      if (lowStock) params.set('lowStock', '1');
      const d = await api<{ rows: InvRow[]; total: number }>(`/api/inventory?${params}`);
      setRows(d.rows);
      setTotal(d.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, keyword, categoryId, lowStock]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<{ id: string; name: string }[]>('/api/categories')
      .then(setCats)
      .catch(() => {});
  }, []);

  const onExport = async () => {
    try {
      const token = (await import('@/lib/supabase-browser')).getSupabaseBrowserClient().auth.getSession();
      const t = (await token).data.session?.access_token;
      await apiDownload('/api/export/inventory', '库存数据.csv', t);
      toast.success('库存数据已导出');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">库存列表</h1>
          <p className="text-sm text-neutral-500">查看所有备件当前库存，低于安全库存自动标红</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="mr-1.5 h-4 w-4" /> 导出
            </Button>
          )}
          <Link href="/inventory/entry">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-1.5 h-4 w-4" /> 出入库
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input placeholder="搜索物料" className="h-9 pl-8" value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} />
        </div>
        <Select value={categoryId || 'none'} onValueChange={(v) => { setCategoryId(v === 'none' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="全部分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">全部分类</SelectItem>
            {cats.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant={lowStock ? 'default' : 'outline'} size="sm" className="h-9" onClick={() => { setLowStock(!lowStock); setPage(1); }}>
          仅看低库存
        </Button>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="暂无库存数据" description="可通过出入库录入或导入初始化库存" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>编码</TableHead>
                <TableHead>名称 / 规格</TableHead>
                <TableHead>类别</TableHead>
                <TableHead>级别</TableHead>
                <TableHead className="text-right">当前库存</TableHead>
                <TableHead className="text-right">安全库存</TableHead>
                <TableHead className="text-right">单价</TableHead>
                <TableHead className="text-right">库存总价值</TableHead>
                <TableHead>存放位置</TableHead>
                <TableHead>供应商</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((inv) => {
                const m = inv.material;
                const low = m ? inv.quantity < Number(m.safety_stock ?? 0) : false;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-[13px]">{m?.code ?? '-'}</TableCell>
                    <TableCell>
                      <p className="font-medium">{m?.name ?? '-'}</p>
                      {m?.spec && <p className="text-xs text-neutral-400">{m.spec}</p>}
                    </TableCell>
                    <TableCell>{m?.categories?.name || '-'}</TableCell>
                    <TableCell>
                      {m?.levels?.name ? <Badge variant="outline">{m.levels.name}</Badge> : '-'}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${low ? 'font-semibold text-rose-600' : ''}`}>{inv.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums text-neutral-500">{m?.safety_stock ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">¥{Number(m?.unit_price ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">¥{Number(inv.total_value ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{m?.storage_location || '-'}</TableCell>
                    <TableCell>{m?.default_supplier?.name || '-'}</TableCell>
                    <TableCell>
                      {low ? <Badge variant="destructive">低库存</Badge> : <Badge variant="secondary">正常</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
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
    </div>
  );
}