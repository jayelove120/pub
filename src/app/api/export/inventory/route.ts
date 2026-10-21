import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { requireUser, toErrorResponse, fail } from '@/lib/api';
import { AuthError } from '@/lib/auth';
import { csvResponse } from '@/lib/excel';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    void user;
    const client = getSupabaseClient();
    const { data, error } = await client.from('inventory').select(
      'quantity, total_value, material:materials(code, name, spec, unit, unit_price, safety_stock, storage_location, categories:spare_part_categories(name), default_supplier:suppliers(name))',
    );
    if (error) throw new Error(error.message);

    const header = ['物料编码', '物料名称', '规格型号', '分类', '单位', '单价', '库存数量', '安全库存', '库存总价值', '存放位置', '默认供应商'];
    const rows = (data ?? []).map((inv) => {
      const m = inv.material as {
        code?: string;
        name?: string;
        spec?: string;
        unit?: string;
        unit_price?: string;
        safety_stock?: number;
        storage_location?: string;
        categories?: { name?: string } | null;
        default_supplier?: { name?: string } | null;
      } | null;
      return [
        m?.code ?? '',
        m?.name ?? '',
        m?.spec ?? '',
        m?.categories?.name ?? '',
        m?.unit ?? '',
        m?.unit_price ?? '',
        inv.quantity,
        m?.safety_stock ?? 0,
        inv.total_value,
        m?.storage_location ?? '',
        m?.default_supplier?.name ?? '',
      ];
    });

    return csvResponse('库存数据.csv', [header, ...rows]);
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message, e.status, e.code);
    return toErrorResponse(e);
  }
}