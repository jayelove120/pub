'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/lib/toast';
import { EmptyState } from '@/components/empty-state';
import { AlertTriangle, Search, CheckCircle2 } from 'lucide-react';

export default function AlertsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [all, setAll] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize), all: '1' });
      if (status) p.set('status', status);
      if (keyword) p.set('keyword', keyword);
      const d = await api.get('/api/alerts?' + p.toString());
      setRows(d.rows || []);
      setAll(d.all || []);
      setTotal(d.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status, keyword]);

  useEffect(() => { load(); }, [load]);

  const unprocessedCount = all.filter((a: any) => !a.is_processed).length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const openProcess = (a: any) => { setEditing(a); setRemark(''); };

  const handleProcess = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/api/alerts/${editing.id}/process`, { remark });
      toast({ title: '已处理该预警' });
      setEditing(null);
      load();
    } catch (e: any) {
      toast({ title: '处理失败', description: e.message || '请重试', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">库存预警</h1>
          <p className="text-sm text-muted-foreground">共 {unprocessedCount} 条未处理预警</p>
        </div>
        <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
          <AlertTriangle className="mr-1 h-3.5 w-3.5" />未处理 {unprocessedCount}
        </Badge>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="搜索物料编码或名称" value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} className="pl-8" />
            </div>
            <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="全部状态" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="unprocessed">未处理</SelectItem>
                <SelectItem value="processed">已处理</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setKeyword(''); setStatus(''); setPage(1); }}>重置</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base">预警列表</CardTitle>
          <CardDescription>库存低于安全阈值时自动生成预警并发送短信通知</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">物料</th>
                  <th className="px-4 py-2.5 font-medium">当前库存</th>
                  <th className="px-4 py-2.5 font-medium">安全库存</th>
                  <th className="px-4 py-2.5 font-medium">预警时间</th>
                  <th className="px-4 py-2.5 font-medium">状态</th>
                  <th className="px-4 py-2.5 font-medium">短信</th>
                  <th className="px-4 py-2.5 font-medium">处理备注</th>
                  <th className="px-4 py-2.5 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b"><td colSpan={8}><Skeleton className="mx-4 my-2 h-8" /></td></tr>
                )) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="py-8"><EmptyState description="暂无预警信息" /></td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{r.material?.name}</div>
                      <div className="text-xs text-muted-foreground">{r.material?.code}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-red-600">{r.current_quantity}</span>
                      <span className="text-xs text-muted-foreground"> / {r.material?.unit}</span>
                    </td>
                    <td className="px-4 py-2.5">{r.safety_stock}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{new Date(r.alert_time).toLocaleString('zh-CN')}</td>
                    <td className="px-4 py-2.5">
                      {r.is_processed ? (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><CheckCircle2 className="mr-1 h-3 w-3" />已处理</Badge>
                      ) : (
                        <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700"><AlertTriangle className="mr-1 h-3 w-3" />未处理</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.sms_sent ? '已发送' : '未发送'}</td>
                    <td className="px-4 py-2.5 max-w-[200px] truncate text-muted-foreground">{r.processed_remark || '-'}</td>
                    <td className="px-4 py-2.5 text-right">
                      {!r.is_processed && (
                        <Button size="sm" variant="outline" onClick={() => openProcess(r)}>处理</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-3 px-4 py-3">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
                </PaginationItem>
                <PaginationItem><span className="text-sm px-3 text-muted-foreground">{page} / {totalPages}</span></PaginationItem>
                <PaginationItem>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>处理预警</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <div className="font-medium">{editing?.material?.name}</div>
              <div className="mt-1 text-muted-foreground">
                当前库存 <span className="font-semibold text-red-600">{editing?.current_quantity}</span>，安全库存 {editing?.safety_stock}
              </div>
            </div>
            <Textarea placeholder="处理备注（如：已补货、已调整库存等）" value={remark} onChange={(e) => setRemark(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
            <Button onClick={handleProcess} disabled={saving || !remark.trim()}>{saving ? '提交中...' : '确认处理'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}