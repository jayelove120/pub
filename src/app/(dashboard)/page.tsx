'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { Boxes, AlertTriangle, ArrowLeftRight, Wallet } from 'lucide-react';

const PIE_COLORS = ['#2563eb', '#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e'];

interface DashboardData {
  metrics: { totalValue: number; totalQuantity: number; pendingAlertCount: number; monthInOut: number };
  trend: { month: string; in: number; out: number }[];
  categoryShare: { name: string; value: number }[];
  alertByCategory: { name: string; value: number }[];
  recentTransactions: {
    id: string;
    transaction_type: number;
    quantity: number;
    operation_time: string;
    operator_name: string;
    material: { name?: string; code?: string } | null;
  }[];
  recentAlerts: {
    id: string;
    current_quantity: number;
    safety_stock: number;
    alert_time: string;
    is_processed: boolean;
    material: { name?: string; code?: string } | null;
  }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<DashboardData>('/api/dashboard');
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>;
  }

  const m = data?.metrics;
  const kpis = [
    { label: '库存总价值', value: `¥${m?.totalValue.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) ?? 0}`, icon: Wallet, color: 'text-blue-600' },
    { label: '备件总数量', value: `${m?.totalQuantity ?? 0}`, icon: Boxes, color: 'text-emerald-600' },
    { label: '预警备件数', value: `${m?.pendingAlertCount ?? 0}`, icon: AlertTriangle, color: m?.pendingAlertCount ? 'text-rose-600' : 'text-neutral-400' },
    { label: '当月出入库量', value: `${m?.monthInOut ?? 0}`, icon: ArrowLeftRight, color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">数据仪表盘</h1>
        <Link href="/alerts" className="text-sm text-blue-600 hover:underline">
          查看全部预警
        </Link>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="border-neutral-200 shadow-sm">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-[13px] text-neutral-500">{k.label}</p>
                  <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${k.color}`}>{k.value}</p>
                </div>
                <div className="rounded-lg bg-neutral-100 p-2.5">
                  <Icon className={`h-5 w-5 ${k.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 图表行 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-neutral-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-700">库存分类占比</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {(data?.categoryShare?.length ?? 0) === 0 ? (
              <EmptyState description="暂无分类数据" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data!.categoryShare} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {data!.categoryShare.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-neutral-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-700">近6个月出入库趋势</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.trend ?? []} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="in" name="入库" stroke="#2563eb" strokeWidth={2} />
                <Line type="monotone" dataKey="out" name="出库" stroke="#e11d48" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 预警统计柱状图 */}
      <Card className="border-neutral-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral-700">分类预警数量统计</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.alertByCategory ?? []} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" name="预警数量" fill="#e11d48" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 最近记录 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-neutral-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-700">最近出入库记录</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(data?.recentTransactions?.length ?? 0) === 0 ? (
              <EmptyState description="暂无出入库记录" />
            ) : (
              <div className="divide-y divide-neutral-100">
                {data!.recentTransactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Badge variant={t.transaction_type === 1 ? 'default' : 'destructive'} className="w-11 justify-center">
                        {t.transaction_type === 1 ? '入' : '出'}
                      </Badge>
                      <div>
                        <p className="text-[13px] font-medium text-neutral-800">
                          {t.material?.name ?? '未知物料'}
                          <span className="ml-1 text-xs text-neutral-400">{t.material?.code}</span>
                        </p>
                        <p className="text-xs text-neutral-400">
                          {t.operator_name ?? ''} · {t.operation_time?.slice(5, 16).replace('T', ' ')}
                        </p>
                      </div>
                    </div>
                    <span className="text-[13px] tabular-nums text-neutral-700">{t.quantity} 件</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-neutral-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-700">最近预警</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(data?.recentAlerts?.length ?? 0) === 0 ? (
              <EmptyState description="暂无预警信息" />
            ) : (
              <div className="divide-y divide-neutral-100">
                {data!.recentAlerts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-5 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium text-neutral-800">
                        {a.material?.name ?? '未知物料'}
                        <span className="ml-1 text-xs text-neutral-400">{a.material?.code}</span>
                      </p>
                      <p className="text-xs text-neutral-400">{a.alert_time?.slice(5, 16).replace('T', ' ')}</p>
                    </div>
                    <Badge variant={a.is_processed ? 'secondary' : 'destructive'}>
                      {a.is_processed ? '已处理' : `库存 ${a.current_quantity}/${a.safety_stock}`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}