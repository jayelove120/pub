'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/empty-state';
import { ArrowDownLeft, ArrowUpRight, Download, Search } from 'lucide-react';

export default function TransactionsPage() {
  const { profile } = useAuth();
  const role = profile?.role;
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [type, setType] = useState('');
  const [keyword, setKeyword] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (type) p.set('type', type);
      if (keyword) p.set('keyword', keyword);
      if (start) p.set('start', start);
      if (end) p.set('end', end);
      const d = await api.get('/api/transactions?' + p.toString());
      setRows(d.rows || []);
      setTotal(d.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, type, keyword, start, end]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleExport = () => {
    const p = new URLSearchParams();
    if (type) p.set('type', type);
    if (keyword) p.set('keyword', keyword);
    if (start) p.set('start', start);
    if (end) p.set('end', end);
    window.location.href = '/api/export/transactions?' + p.toString();
  };

  const typeLabel = useMemo(() => ({
    1: { text: '入库', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: ArrowDownLeft },
    2: { text: '出库', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: ArrowUpRight },
  } as any), []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">出入库记录</h1>
          <p className="text-sm text-muted-foreground">全部出入库历史流水，支持多维筛选</p>
        </div>
        {role === 'admin' && (
          <Button variant="outline" onClick={handleExport}><Download className="mr-1 h-4 w-4" />导出</Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="搜索物料或操作人" value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} className="pl-8" />
            </div>
            <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部类型</SelectItem>
                <SelectItem value="1">入库</SelectItem>
                <SelectItem value="2">出库</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={start} onChange={(e) => { setStart(e.target.value); setPage(1); }} className="w-[150px]" />
            <span className="self-center text-muted-foreground">至</span>
            <Input type="date" value={end} onChange={(e) => { setEnd(e.target.value); setPage(1); }} className="w-[150px]" />
            <Button variant="outline" onClick={() => { setKeyword(''); setType(''); setStart(''); setEnd(''); setPage(1); }}>重置</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">流水列表</CardTitle>
          <CardDescription>共 {total} 条记录</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">类型</th>
                  <th className="px-4 py-2.5 font-medium">物料</th>
                  <th className="px-4 py-2.5 font-medium">数量</th>
                  <th className="px-4 py-2.5 font-medium">单价</th>
                  <th className="px-4 py-2.5 font-medium">金额</th>
                  <th className="px-4 py-2.5 font-medium">供应商</th>
                  <th className="px-4 py-2.5 font-medium">操作人</th>
                  <th className="px-4 py-2.5 font-medium">时间</th>
                  <th className="px-4 py-2.5 font-medium">备注</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b"><td colSpan={9}><Skeleton className="mx-4 my-2 h-8" /></td></tr>
                )) : rows.length === 0 ? (
                  <tr><td colSpan={9} className="py-8"><EmptyState description="暂无出入库记录" /></td></tr>
                ) : rows.map((r) => {
                  const t = typeLabel[r.transaction_type] || typeLabel[0];
                  const Icon = t.Icon;
                  return (
                    <tr key={r.id} className="border-b hover:bg-muted/40">
                      <td className="px-4 py-2.5"><Badge variant="outline" className={t.cls}><Icon className="mr-1 h-3 w-3" />{t.text}</Badge></td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{r.material?.name}</div>
                        <div className="text-xs text-muted-foreground">{r.material?.code}</div>
                      </td>
                      <td className="px-4 py-2.5">{r.quantity}</td>
                      <td className="px-4 py-2.5">{r.unit_price != null ? Number(r.unit_price).toFixed(2) : '-'}</td>
                      <td className="px-4 py-2.5 font-medium">{Number(r.total_amount).toFixed(2)}</td>
                      <td className="px-4 py-2.5">{r.supplier?.name || '-'}</td>
                      <td className="px-4 py-2.5">{r.operator_name}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{new Date(r.operation_time).toLocaleString('zh-CN')}</td>
                      <td className="px-4 py-2.5 max-w-[180px] truncate text-muted-foreground">{r.remark || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-3 px-4 py-3">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
                </PaginationItem>
                <PaginationItem>
                  <span className="text-sm px-3 text-muted-foreground">{page} / {totalPages}</span>
                </PaginationItem>
                <PaginationItem>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}