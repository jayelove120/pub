import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ok, requireUser, toErrorResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireUser(req);
    const client = getSupabaseClient();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // 1. 核心指标
    const { data: inv, error: invErr } = await client.from('inventory').select('*, material:materials(safety_stock)');
    if (invErr) throw new Error(invErr.message);

    const inventoryList = (inv ?? []) as {
      quantity: number;
      total_value: string;
      material: { safety_stock: number } | null;
    }[];
    const totalValue = inventoryList.reduce((sum, i) => sum + Number(i.total_value || 0), 0);
    const totalQuantity = inventoryList.reduce((sum, i) => sum + (i.quantity || 0), 0);
    const alertItems = inventoryList.filter((i) => Number(i.quantity ?? 0) < Number(i.material?.safety_stock ?? 0));
    const pendingAlertCount = alertItems.length;

    const { data: txMonth, error: txErr } = await client
      .from('inventory_transactions')
      .select('quantity')
      .gte('operation_time', monthStart);
    if (txErr) throw new Error(txErr.message);
    const monthInOut = (txMonth ?? []).reduce((sum, t) => sum + Number(t.quantity || 0), 0);

    // 2. 近6个月出入库趋势
    const months: { label: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        start: d,
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
      });
    }
    const { data: tx6m, error: tx6Err } = await client
      .from('inventory_transactions')
      .select('transaction_type, quantity, operation_time');
    if (tx6Err) throw new Error(tx6Err.message);
    const trend = months.map((m) => {
      const inRows = (tx6m ?? []).filter(
        (t) => t.transaction_type === 1 && new Date(t.operation_time) >= m.start && new Date(t.operation_time) <= m.end,
      );
      const outRows = (tx6m ?? []).filter(
        (t) => t.transaction_type === 2 && new Date(t.operation_time) >= m.start && new Date(t.operation_time) <= m.end,
      );
      return {
        month: m.label,
        in: inRows.reduce((s, t) => s + Number(t.quantity || 0), 0),
        out: outRows.reduce((s, t) => s + Number(t.quantity || 0), 0),
      };
    });

    // 3. 库存结构占比（按分类 / 按分级）
    const { data: materials, error: matErr } = await client.from('materials').select(
      'id, category_id, categories:spare_part_categories(name), levels:spare_part_levels(name)',
    );
    if (matErr) throw new Error(matErr.message);
    const matMap = new Map<string, { name?: string }>();
    for (const m of materials ?? []) {
      matMap.set(m.id, m.categories as { name?: string });
    }
    // 简化处理：查看分类使用情况（以物料数作为占比）
    const catCount: Record<string, number> = {};
    const levelCount: Record<string, number> = {};
    for (const m of materials ?? []) {
      const name = (m.categories as { name?: string } | null)?.name || '未分类';
      catCount[name] = (catCount[name] || 0) + 1;
      const lv = (m.levels as { name?: string } | null)?.name || '未分级';
      levelCount[lv] = (levelCount[lv] || 0) + 1;
    }
    const categoryShare = Object.entries(catCount).map(([name, value]) => ({ name, value }));
    const levelShare = Object.entries(levelCount).map(([name, value]) => ({ name, value }));

    // 4. 预警数量柱状图（按分类）
    const alertShare: Record<string, number> = {};
    for (const item of alertItems) {
      const materialId = (item as unknown as { material_id: string }).material_id;
      const cat = matMap.get(materialId);
      const name = cat?.name || '未分类';
      alertShare[name] = (alertShare[name] || 0) + 1;
    }
    const alertByCategory = Object.entries(alertShare).map(([name, value]) => ({ name, value }));

    // 5. 最近出入库记录 & 最近预警
    const { data: recentTx, error: rtxErr } = await client
      .from('inventory_transactions')
      .select('*, material:materials(name, code)')
      .order('operation_time', { ascending: false })
      .limit(10);
    if (rtxErr) throw new Error(rtxErr.message);

    const { data: recentAlerts, error: raErr } = await client
      .from('inventory_alerts')
      .select('*, material:materials(name, code)')
      .order('alert_time', { ascending: false })
      .limit(5);
    if (raErr) throw new Error(raErr.message);

    return ok({
      metrics: {
        totalValue,
        totalQuantity,
        pendingAlertCount,
        monthInOut,
      },
      trend,
      categoryShare,
      levelShare,
      alertByCategory,
      recentTransactions: recentTx,
      recentAlerts: recentAlerts,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}