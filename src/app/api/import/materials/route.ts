import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ok, fail, parseBody, requireUser, toErrorResponse } from '@/lib/api';
import { requireAdmin, AuthError } from '@/lib/auth';
import { writeOperationLog } from '@/lib/store';
import { parseCsv } from '@/lib/excel';

/**
 * 批量导入物料信息。
 * 请求体: { csv: string }，格式：
 * 编码,名称,规格型号,分类名称,级别名称,单位,单价,安全库存,默认供应商名称,存放位置,备注,初始数量
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    requireAdmin(user);
    const body = await parseBody<{ csv: string }>(req);
    if (!body.csv) return fail('缺少 CSV 数据');

    const rows = parseCsv(body.csv);
    if (rows.length < 2) return fail('CSV 中至少有标题行和一条数据');

    const client = getSupabaseClient();

    const { data: categories } = await client.from('spare_part_categories').select('id, name');
    const { data: levels } = await client.from('spare_part_levels').select('id, name');
    const { data: suppliers } = await client.from('suppliers').select('id, name');
    const catMap = new Map((categories ?? []).map((c) => [c.name, c.id]));
    const lvlMap = new Map((levels ?? []).map((l) => [l.name, l.id]));
    const supMap = new Map((suppliers ?? []).map((s) => [s.name, s.id]));

    let success = 0;
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const [code, name, spec, categoryName, levelName, unit, unitPrice, safetyStock, supplierName, location, remark, initialQty] = row;
      const lineNo = i + 1;
      if (!code || !name) {
        errors.push(`第${lineNo}行：编码/名称为空`);
        continue;
      }

      const categoryId = categoryName ? catMap.get(categoryName) || null : null;
      const levelId = levelName ? lvlMap.get(levelName) || null : null;
      const supplierId = supplierName ? supMap.get(supplierName) || null : null;

      const { data: material, error: mErr } = await client
        .from('materials')
        .insert({
          code: code.trim(),
          name: name.trim(),
          spec: spec?.trim() || null,
          category_id: categoryId,
          level_id: levelId,
          unit: unit?.trim() || '个',
          unit_price: String(Number(unitPrice) || 0),
          safety_stock: Number(safetyStock) || 0,
          default_supplier_id: supplierId,
          storage_location: location?.trim() || null,
          remark: remark?.trim() || null,
          is_active: true,
        })
        .select()
        .single();
      if (mErr) {
        errors.push(`第${lineNo}行：${mErr.message}`);
        continue;
      }

      const initQty = Number(initialQty) || 0;
      if (initQty > 0) {
        const price = Number(unitPrice) || 0;
        const { error: invErr } = await client.from('inventory').insert({
          material_id: material.id,
          quantity: initQty,
          total_value: String(initQty * price),
          last_in_time: new Date().toISOString(),
        });
        if (invErr) errors.push(`第${lineNo}行：初始化库存失败 ${invErr.message}`);
      }
      success++;
    }

    await writeOperationLog({
      user,
      operationType: '导入',
      content: `批量导入物料：成功 ${success} 条${errors.length ? `，失败 ${errors.length} 条` : ''}`,
      req,
    });

    return ok({ success, failed: errors, successCount: success, errorCount: errors.length });
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message, e.status, e.code);
    return toErrorResponse(e);
  }
}