import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ok, requireUser, toErrorResponse, getPagination } from '@/lib/api';

const TX_SELECT = '*, material:materials(code, name, spec, unit), supplier:suppliers(name)';

export async function GET(req: NextRequest) {
  try {
    await requireUser(req);
    const sp = req.nextUrl.searchParams;
    const { page, pageSize, offset } = getPagination(sp, 10);
    const type = sp.get('type'); // '1' 入库 '2' 出库
    const materialId = sp.get('materialId') || '';
    const start = sp.get('start') || '';
    const end = sp.get('end') || '';
    const keyword = sp.get('keyword')?.trim() || '';

    const client = getSupabaseClient();
    let query = client.from('inventory_transactions').select(TX_SELECT, { count: 'exact' });

    if (type === '1' || type === '2') query = query.eq('transaction_type', Number(type));
    if (materialId) query = query.eq('material_id', materialId);
    if (start) query = query.gte('operation_time', `${start}T00:00:00`);
    if (end) query = query.lte('operation_time', `${end}T23:59:59`);
    if (keyword) query = query.or(`material.name.ilike.%${keyword}%,operator_name.ilike.%${keyword}%`);

    const { data, error, count } = await query
      .order('operation_time', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);

    return ok({ rows: data, total: count ?? 0, page, pageSize });
  } catch (e) {
    return toErrorResponse(e);
  }
}