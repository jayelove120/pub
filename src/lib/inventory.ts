import { getSupabaseClient } from '@/storage/database/supabase-client';
import type { AppUser } from '@/lib/auth';
import { notifyAlertReceivers } from '@/lib/sms';

export interface StockOpResult {
  transactionId: string;
  newQuantity: number;
  alertCreated: boolean;
  alertId?: string;
}

/**
 * 入库操作：写入出入库记录 + 更新/创建库存。
 * 出库保证库存不为负。
 */
export async function stockIn(params: {
  materialId: string;
  quantity: number;
  unitPrice: string | number;
  supplierId?: string | null;
  user: AppUser;
  remark?: string;
  operationTime?: string;
}): Promise<StockOpResult> {
  const client = getSupabaseClient();
  const { materialId, quantity, unitPrice, supplierId, user, remark } = params;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('入库数量必须为正整数');
  }

  const { data: material, error: mErr } = await client
    .from('materials')
    .select('id, name, unit_price, safety_stock')
    .eq('id', materialId)
    .single();
  if (mErr) throw new Error(`物料不存在: ${mErr.message}`);

  const price = Number(unitPrice) >= 0 ? Number(unitPrice) : Number(material.unit_price);
  const total = price * quantity;
  const opTime = params.operationTime ?? new Date().toISOString();

  // 1. 写入出入库记录
  const { data: tx, error: txErr } = await client
    .from('inventory_transactions')
    .insert({
      transaction_type: 1,
      material_id: materialId,
      quantity,
      unit_price: String(price),
      total_amount: String(total),
      supplier_id: supplierId || null,
      operator_id: user.id,
      operator_name: user.name,
      operation_time: opTime,
      remark: remark || '入库',
    })
    .select()
    .single();
  if (txErr) throw new Error(`写入出入库记录失败: ${txErr.message}`);

  // 2. 更新库存（原子 upsert 式更新：先取当前值）
  const { data: existingInv, error: invFindErr } = await client
    .from('inventory')
    .select('id, quantity')
    .eq('material_id', materialId)
    .maybeSingle();
  if (invFindErr) throw new Error(`查询库存失败: ${invFindErr.message}`);

  let newQuantity: number;
  if (existingInv) {
    newQuantity = (existingInv.quantity || 0) + quantity;
    const { error } = await client
      .from('inventory')
      .update({
        quantity: newQuantity,
        total_value: String(newQuantity * price),
        last_in_time: opTime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingInv.id);
    if (error) throw new Error(`更新库存失败: ${error.message}`);
  } else {
    newQuantity = quantity;
    const { error } = await client.from('inventory').insert({
      material_id: materialId,
      quantity,
      total_value: String(total),
      last_in_time: opTime,
    });
    if (error) throw new Error(`创建库存失败: ${error.message}`);
  }

  return { transactionId: tx.id, newQuantity, alertCreated: false };
}

/**
 * 出库操作：写入出入库记录 + 扣减库存，扣减后自动检查是否低于安全库存。
 */
export async function stockOut(params: {
  materialId: string;
  quantity: number;
  unitPrice?: string | number;
  supplierId?: string | null;
  user: AppUser;
  remark?: string;
  operationTime?: string;
}): Promise<StockOpResult> {
  const client = getSupabaseClient();
  const { materialId, quantity, supplierId, user, remark } = params;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('出库数量必须为正整数');
  }

  const { data: material, error: mErr } = await client
    .from('materials')
    .select('id, name, unit_price, safety_stock')
    .eq('id', materialId)
    .single();
  if (mErr) throw new Error(`物料不存在: ${mErr.message}`);

  const { data: inv, error: invErr } = await client
    .from('inventory')
    .select('id, quantity, total_value')
    .eq('material_id', materialId)
    .maybeSingle();
  if (invErr) throw new Error(`查询库存失败: ${invErr.message}`);

  const currentQuantity = inv?.quantity ?? 0;
  if (quantity > currentQuantity) {
    throw new Error(`库存不足，当前库存仅 ${currentQuantity} 件`);
  }

  const price = params.unitPrice !== undefined && Number(params.unitPrice) >= 0
    ? Number(params.unitPrice)
    : Number(material.unit_price);
  const total = price * quantity;
  const opTime = params.operationTime ?? new Date().toISOString();

  // 1. 写入出入库记录
  const { data: tx, error: txErr } = await client
    .from('inventory_transactions')
    .insert({
      transaction_type: 2,
      material_id: materialId,
      quantity,
      unit_price: String(price),
      total_amount: String(total),
      supplier_id: supplierId || null,
      operator_id: user.id,
      operator_name: user.name,
      operation_time: opTime,
      remark: remark || '出库',
    })
    .select()
    .single();
  if (txErr) throw new Error(`写入出入库记录失败: ${txErr.message}`);

  // 2. 扣减库存
  const newQuantity = currentQuantity - quantity;
  if (inv) {
    const { error } = await client
      .from('inventory')
      .update({
        quantity: newQuantity,
        total_value: String(newQuantity * price),
        last_out_time: opTime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inv.id);
    if (error) throw new Error(`更新库存失败: ${error.message}`);
  } else {
    // 理论上出库前库存必存在，兜底处理
    const { error } = await client.from('inventory').insert({
      material_id: materialId,
      quantity: newQuantity,
      total_value: String(newQuantity * price),
    });
    if (error) throw new Error(`创建库存失败: ${error.message}`);
  }

  // 3. 检查是否低于安全库存 → 创建预警 + 短信通知
  const lowStock = newQuantity < material.safety_stock;
  const alertResult = lowStock
    ? await createLowStockAlert({ materialId, materialName: material.name, currentQuantity: newQuantity, safetyStock: material.safety_stock, user })
    : { created: false };

  return {
    transactionId: tx.id,
    newQuantity,
    alertCreated: alertResult.created,
    alertId: alertResult.created ? alertResult.alertId : undefined,
  };
}

/**
 * 创建库存预警记录（防止同一物料重复产生未处理预警），并触发短信通知。
 */
export async function createLowStockAlert(params: {
  materialId: string;
  materialName: string;
  currentQuantity: number;
  safetyStock: number;
  user: AppUser;
}): Promise<{ created: boolean; alertId?: string }> {
  const client = getSupabaseClient();

  // 若已有同物料未处理的预警，则跳过（避免重复）
  const { data: pending, error: pErr } = await client
    .from('inventory_alerts')
    .select('id')
    .eq('material_id', params.materialId)
    .eq('is_processed', false)
    .limit(1);
  if (pErr) throw new Error(`查询预警失败: ${pErr.message}`);
  if (pending && pending.length > 0) {
    return { created: false, alertId: pending[0].id };
  }

  const { data: alert, error: aErr } = await client
    .from('inventory_alerts')
    .insert({
      material_id: params.materialId,
      current_quantity: params.currentQuantity,
      safety_stock: params.safetyStock,
      alert_time: new Date().toISOString(),
      sms_sent: false,
      is_processed: false,
    })
    .select()
    .single();
  if (aErr) throw new Error(`创建预警失败: ${aErr.message}`);

  // 触发短信通知（异步处理，不阻塞主流程）
  void notifyAlertReceivers(params.materialName, params.currentQuantity, params.safetyStock);

  return { created: true, alertId: alert.id };
}