import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ok, fail, parseBody, requireUser, toErrorResponse } from '@/lib/api';
import { AuthError } from '@/lib/auth';
import { stockIn } from '@/lib/inventory';
import { writeOperationLog } from '@/lib/store';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await parseBody<{
      material_id: string;
      quantity: number;
      unit_price?: string | number;
      supplier_id?: string | null;
      remark?: string;
      operation_time?: string;
    }>(req);

    if (!body.material_id) return fail('物料不能为空');
    if (!Number.isInteger(Number(body.quantity)) || Number(body.quantity) <= 0) {
      return fail('入库数量必须为正整数');
    }

    const result = await stockIn({
      materialId: body.material_id,
      quantity: Number(body.quantity),
      unitPrice: body.unit_price !== undefined ? body.unit_price : 0,
      supplierId: body.supplier_id || null,
      user,
      remark: body.remark || '入库',
      operationTime: body.operation_time,
    });

    const client = getSupabaseClient();
    const { data: material } = await client.from('materials').select('name').eq('id', body.material_id).single();

    await writeOperationLog({
      user,
      operationType: '入库',
      content: `物料「${material?.name}」入库 ${body.quantity} 件`,
      req,
    });

    return ok({ success: true, transaction_id: result.transactionId, new_quantity: result.newQuantity }, 201);
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message, e.status, e.code);
    return toErrorResponse(e);
  }
}