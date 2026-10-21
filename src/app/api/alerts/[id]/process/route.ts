import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ok, fail, parseBody, requireUser, toErrorResponse } from '@/lib/api';
import { AuthError } from '@/lib/auth';
import { writeOperationLog } from '@/lib/store';

async function handleProcess(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const body = await parseBody<{ remark?: string }>(req);

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('inventory_alerts')
      .update({
        is_processed: true,
        processed_by: user.id,
        processed_time: new Date().toISOString(),
        processed_remark: body.remark || null,
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return fail('预警记录不存在', 404);

    await writeOperationLog({
      user,
      operationType: '预警处理',
      content: `处理库存预警（物料 ${data.material_id}）`,
      req,
    });
    return ok(data);
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message, e.status, e.code);
    return toErrorResponse(e);
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleProcess(req, ctx);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handleProcess(req, ctx);
}