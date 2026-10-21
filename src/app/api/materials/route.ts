import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ok, fail, parseBody, requireUser, toErrorResponse, getPagination } from '@/lib/api';
import { requireAdmin, AuthError } from '@/lib/auth';
import { writeOperationLog } from '@/lib/store';

const MATERIAL_SELECT =
  '*, categories:spare_part_categories(id, name, level), default_supplier:suppliers(id, name), inventory(quantity, total_value)';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const sp = req.nextUrl.searchParams;
    const { page, pageSize, offset } = getPagination(sp, 10);
    const keyword = sp.get('keyword')?.trim() || '';
    const categoryId = sp.get('categoryId') || '';
    const lowStock = sp.get('lowStock') === '1';
    const showAll = sp.get('all') === '1' && user.role === 'admin';

    const client = getSupabaseClient();
    let query = client
      .from('materials')
      .select(MATERIAL_SELECT, { count: 'exact' });

    if (keyword) {
      query = query.or(`name.ilike.%${keyword}%,code.ilike.%${keyword}%,spec.ilike.%${keyword}%`);
    }
    if (categoryId) query = query.eq('category_id', categoryId);
    if (!showAll) query = query.eq('is_active', true);
    if (lowStock) query = query.gt('safety_stock', 0);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);

    // lowStock 需要按库存过滤，回到应用层二次过滤
    let rows = data as Record<string, unknown>[];
    if (lowStock) {
      rows = rows.filter((m) => {
        const inv = m.inventory as { quantity?: number } | null;
        const qty = inv?.quantity ?? 0;
        return qty < Number(m.safety_stock ?? 0);
      });
    }

    return ok({ rows, total: lowStock ? rows.length : (count ?? 0), page, pageSize });
  } catch (e) {
    return toErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    requireAdmin(user);
    const body = await parseBody<{
      code: string;
      name: string;
      spec?: string;
      category_id?: string;
      unit?: string;
      unit_price?: string | number;
      safety_stock?: number;
      default_supplier_id?: string;
      storage_location?: string;
      remark?: string;
      initial_quantity?: number;
    }>(req);

    if (!body.code || !String(body.code).trim()) return fail('物料编码不能为空');
    if (!body.name || !String(body.name).trim()) return fail('物料名称不能为空');

    const client = getSupabaseClient();

    // 校验编码唯一
    const { data: dup, error: dupErr } = await client
      .from('materials')
      .select('id')
      .eq('code', String(body.code).trim())
      .limit(1);
    if (dupErr) throw new Error(dupErr.message);
    if (dup && dup.length > 0) return fail('物料编码已存在', 409);

    const unitPrice = Number(body.unit_price ?? 0) || 0;
    const initialQty = Number(body.initial_quantity ?? 0) || 0;

    const { data, error } = await client
      .from('materials')
      .insert({
        code: String(body.code).trim(),
        name: String(body.name).trim(),
        spec: body.spec || null,
        category_id: body.category_id || null,
        unit: body.unit || '个',
        unit_price: String(unitPrice),
        safety_stock: Number(body.safety_stock ?? 0) || 0,
        default_supplier_id: body.default_supplier_id || null,
        storage_location: body.storage_location || null,
        remark: body.remark || null,
        is_active: true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // 初始化库存记录
    if (initialQty > 0) {
      const { error: invErr } = await client.from('inventory').insert({
        material_id: data.id,
        quantity: initialQty,
        total_value: String(initialQty * unitPrice),
        last_in_time: new Date().toISOString(),
      });
      if (invErr) throw new Error(`初始化库存失败: ${invErr.message}`);
      const { error: tErr } = await client.from('inventory_transactions').insert({
        transaction_type: 1,
        material_id: data.id,
        quantity: initialQty,
        unit_price: String(unitPrice),
        total_amount: String(initialQty * unitPrice),
        operator_id: user.id,
        operator_name: user.name,
        remark: '初始化库存',
      });
      if (tErr) throw new Error(`记录初始化交易失败: ${tErr.message}`);
    }

    await writeOperationLog({
      user,
      operationType: '新增',
      content: `新增物料「${data.name}」（${data.code}）`,
      req,
    });
    return ok(data, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message, e.status, e.code);
    return toErrorResponse(e);
  }
}