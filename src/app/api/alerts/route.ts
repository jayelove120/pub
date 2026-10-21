import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ok, requireUser, toErrorResponse, getPagination } from '@/lib/api';

const ALERT_SELECT = '*, material:materials(code, name, spec, unit, safety_stock)';

export async function GET(req: NextRequest) {
  try {
    await requireUser(req);
    const sp = req.nextUrl.searchParams;
    const { page, pageSize, offset } = getPagination(sp, 10);
    const processed = sp.get('status'); // 'unprocessed' | 'processed'
    const keyword = sp.get('keyword')?.trim() || '';
    const showAll = sp.get('all') === '1';

    const client = getSupabaseClient();
    let query = client.from('inventory_alerts').select(ALERT_SELECT, { count: 'exact' });

    if (processed === 'unprocessed') query = query.eq('is_processed', false);
    else if (processed === 'processed') query = query.eq('is_processed', true);
    if (keyword) query = query.or(`material.name.ilike.%${keyword}%,material.code.ilike.%${keyword}%`);

    const { data, error, count } = await query
      .order('alert_time', { ascending: false })
      .range(0, 9999) // 预警数量一般较小，拉取全部以便前端统计
    if (error) throw new Error(error.message);

    const total = showAll ? (count ?? 0) : data?.length ?? 0;
    const sliced = (data ?? []).slice(offset, offset + pageSize);

    return ok({ rows: sliced, total, page, pageSize, all: data ?? [] });
  } catch (e) {
    return toErrorResponse(e);
  }
}