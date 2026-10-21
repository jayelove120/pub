import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ok, requireUser, toErrorResponse, getPagination } from '@/lib/api';

const INVENTORY_SELECT =
  '*, material:materials(*, categories:spare_part_categories(name), levels:spare_part_levels(name), default_supplier:suppliers(name))';

export async function GET(req: NextRequest) {
  try {
    await requireUser(req);
    const sp = req.nextUrl.searchParams;
    const { page, pageSize, offset } = getPagination(sp, 10);
    const keyword = sp.get('keyword')?.trim() || '';
    const categoryId = sp.get('categoryId') || '';
    const lowStockOnly = sp.get('lowStock') === '1';

    const client = getSupabaseClient();
    let query = client
      .from('inventory')
      .select(INVENTORY_SELECT, { count: 'exact' });

    if (keyword) {
      query = query.or(`material.name.ilike.%${keyword}%,material.code.ilike.%${keyword}%`);
    }
    if (categoryId) query = query.eq('material.category_id', categoryId);

    const { data, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);

    let rows = (data ?? []) as Record<string, unknown>[];
    if (lowStockOnly) {
      rows = rows.filter((inv) => {
        const m = inv.material as { safety_stock?: number };
        return Number(inv.quantity ?? 0) < Number(m?.safety_stock ?? 0);
      });
    }

    return ok({
      rows,
      total: lowStockOnly ? rows.length : (count ?? 0),
      page,
      pageSize,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}