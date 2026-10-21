import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ok, fail, requireUser, toErrorResponse } from '@/lib/api';

const INVENTORY_SELECT =
  '*, material:materials(*, categories:spare_part_categories(name), levels:spare_part_levels(name), default_supplier:suppliers(name))';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(req);
    const { id } = await ctx.params;
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('inventory')
      .select(INVENTORY_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return fail('库存记录不存在', 404);
    return ok(data);
  } catch (e) {
    return toErrorResponse(e);
  }
}