import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { requireUser, toErrorResponse, fail } from '@/lib/api';
import { AuthError } from '@/lib/auth';
import { csvResponse } from '@/lib/excel';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    void user;
    const sp = req.nextUrl.searchParams;
    const type = sp.get('type');
    const start = sp.get('start') || '';
    const end = sp.get('end') || '';

    const client = getSupabaseClient();
    let query = client.from('inventory_transactions').select(
      'transaction_type, quantity, unit_price, total_amount, operation_time, remark, operator_name, material:materials(code, name, unit), supplier:suppliers(name)',
    );
    if (type === '1' || type === '2') query = query.eq('transaction_type', Number(type));
    if (start) query = query.gte('operation_time', `${start}T00:00:00`);
    if (end) query = query.lte('operation_time', `${end}T23:59:59`);

    const { data, error } = await query.order('operation_time', { ascending: false });
    if (error) throw new Error(error.message);

    const header = ['操作时间', '类型', '物料编码', '物料名称', '数量', '单位', '单价', '总金额', '供应商', '操作人', '备注'];
    const rows = (data ?? []).map((t) => {
      const m = t.material as { code?: string; name?: string; unit?: string } | null;
      return [
        t.operation_time,
        t.transaction_type === 1 ? '入库' : '出库',
        m?.code ?? '',
        m?.name ?? '',
        t.quantity,
        m?.unit ?? '',
        t.unit_price,
        t.total_amount,
        (t.supplier as { name?: string } | null)?.name ?? '',
        t.operator_name ?? '',
        t.remark ?? '',
      ];
    });

    return csvResponse('出入库记录.csv', [header, ...rows]);
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message, e.status, e.code);
    return toErrorResponse(e);
  }
}