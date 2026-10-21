import { getSupabaseClient } from '../src/storage/database/supabase-client';

async function main() {
  const client = getSupabaseClient();

  const { data: profs, error: profErr } = await client
    .from('profiles')
    .select('user_id, email, name, role');
  if (profErr) throw new Error(profErr.message);
  console.log('当前用户档案:', profs);

  const admin = profs?.find((p) => p.role === 'admin');
  const operator = profs?.find((p) => p.role === 'operator');
  if (!admin || !operator) throw new Error('未找到 admin/operator 档案');

  // 管理员：密码改为 123456，邮箱保持 admin@spare.com
  const a = await client.auth.admin.updateUserById(admin.user_id, {
    password: '123456',
  });
  if (a.error) throw new Error('更新管理员失败: ' + a.error.message);
  console.log('管理员密码已更新 -> admin / 123456 (邮箱 admin@spare.com)');

  // 设备管理员：邮箱改为 fuping@spare.com，密码改为 123456
  const o = await client.auth.admin.updateUserById(operator.user_id, {
    email: 'fuping@spare.com',
    password: '123456',
    email_confirm: true,
  } as never);
  if (o.error) throw new Error('更新设备管理员失败: ' + o.error.message);

  const up = await client
    .from('profiles')
    .update({ email: 'fuping@spare.com' })
    .eq('user_id', operator.user_id);
  if (up.error) throw new Error('更新档案邮箱失败: ' + up.error.message);
  console.log('设备管理员已更新 -> fuping / 123456 (邮箱 fuping@spare.com)');
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
