/**
 * 清理冒烟测试创建的用户（profiles + Supabase Auth）
 * 运行: pnpm tsx scripts/cleanup-smoke-users.ts
 */
import { getSupabaseClient } from '../src/storage/database/supabase-client';

async function main() {
  const client = getSupabaseClient();
  const { data: rows, error } = await client
    .from('profiles')
    .select('user_id, email')
    .like('email', 'smoke%@test.com');
  if (error) throw new Error(error.message);

  for (const r of rows ?? []) {
    const { error: authErr } = await client.auth.admin.deleteUser(r.user_id);
    if (authErr) console.warn(`[cleanup] auth 删除失败 ${r.email}: ${authErr.message}`);
    await client.from('profiles').delete().eq('user_id', r.user_id);
    console.log(`[cleanup] 已删除用户 ${r.email}`);
  }

  // 清理冒烟测试残留的物料（含关联）、分类、供应商
  const { data: smkMats } = await client.from('materials').select('id').like('code', 'SMK-%');
  const matIds = (smkMats ?? []).map((m) => m.id);
  if (matIds.length > 0) {
    await client.from('inventory_alerts').delete().in('material_id', matIds);
    await client.from('inventory_transactions').delete().in('material_id', matIds);
    await client.from('inventory').delete().in('material_id', matIds);
    await client.from('materials').delete().in('id', matIds);
    console.log(`[cleanup] 已删除冒烟物料 ${matIds.length} 个`);
  }
  await client.from('spare_part_categories').delete().like('name', '冒烟测试%');
  await client.from('spare_part_levels').delete().like('name', '冒烟测试%');
  await client.from('suppliers').delete().like('name', '冒烟测试%');

  console.log(`[cleanup] 完成，共清理用户 ${rows?.length ?? 0} 个`);
}

main().catch((e) => {
  console.error('[cleanup] 失败:', e);
  process.exit(1);
});
