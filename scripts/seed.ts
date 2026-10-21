/**
 * 初始化演示数据：
 *  - 创建 admin / operator 两个登录账号（Supabase Auth + profiles）
 *  - 创建分类、供应商、物料、库存、出入库记录、预警
 *  运行：pnpm tsx scripts/seed.ts
 */
import { getSupabaseClient } from '../src/storage/database/supabase-client';

const client = getSupabaseClient();

async function upsertProfile(userId: string, email: string, name: string, role: string, phone?: string) {
  const existing = await client.from('profiles').select('id').eq('user_id', userId).maybeSingle();
  if (existing.error) throw new Error(`查询档案失败: ${existing.error.message}`);
  const data: Record<string, unknown> = {
    user_id: userId,
    email,
    name,
    role,
    phone: phone ?? null,
    receive_alert_sms: true,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
  if (existing.data) {
    const r = await client.from('profiles').update(data).eq('id', existing.data.id);
    if (r.error) throw new Error(`更新档案失败: ${r.error.message}`);
    return;
  }
  const r = await client.from('profiles').insert(data);
  if (r.error) throw new Error(`创建档案失败: ${r.error.message}`);
}

async function ensureUser(email: string, password: string, name: string, role: string, phone?: string) {
  const { data: list, error: listErr } = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw new Error(`查询用户失败: ${listErr.message}`);
  const found = (list?.users ?? []).find((u) => u.email === email);
  if (found) {
    await upsertProfile(found.id, email, name, role, phone);
    console.log(`[seed] 用户已存在，已同步角色: ${email}`);
    return found.id;
  }
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) throw new Error(`创建用户失败: ${error.message}`);
  await upsertProfile(data.user.id, email, name, role, phone);
  console.log(`[seed] 已创建用户: ${email}`);
  return data.user.id;
}

async function main() {
  const adminId = await ensureUser('admin@spare.com', 'Admin@123456', '系统管理员', 'admin', '13800000001');
  const opId = await ensureUser('operator@spare.com', 'Operator@123456', '设备管理员', 'operator', '13800000002');
  console.log('[seed] 账号就绪 admin@spare.com / operator@spare.com');

  const now = new Date();
  const iso = (d: Date) => d.toISOString();

  // 分类（类别标签）
  const cats: { name: string; description: string }[] = [
    { name: '机械类', description: '传动、轴承、密封等机械备件' },
    { name: '电气类', description: '电机、接触器、传感器等电气备件' },
    { name: '液压类', description: '油泵、阀件、管路等液压备件' },
    { name: '仪器仪表', description: '测量与检测仪器仪表' },
  ];
  const catIds: Record<string, string> = {};
  for (const c of cats) {
    const { data } = await client.from('spare_part_categories').select('id').eq('name', c.name).maybeSingle();
    if (data) {
      catIds[c.name] = data.id;
    } else {
      const r = await client.from('spare_part_categories').insert({ ...c, created_by: adminId }).select().single();
      catIds[c.name] = r.data.id;
    }
  }

  // 分级（级别标签）
  const lvls: { name: string; description: string; sort_order: number }[] = [
    { name: '关键件', description: '停机影响大的核心备件', sort_order: 1 },
    { name: '重要件', description: '影响生产效率的重要备件', sort_order: 2 },
    { name: '一般件', description: '通用易损备件', sort_order: 3 },
  ];
  const lvlIds: Record<string, string> = {};
  for (const l of lvls) {
    const { data } = await client.from('spare_part_levels').select('id').eq('name', l.name).maybeSingle();
    if (data) {
      lvlIds[l.name] = data.id;
    } else {
      const r = await client.from('spare_part_levels').insert({ ...l, created_by: adminId }).select().single();
      lvlIds[l.name] = r.data.id;
    }
  }

  // 供应商
  const sups = [
    { name: '华东传动设备有限公司', contact_person: '李强', contact_phone: '13700000001', address: '上海市嘉定区' },
    { name: '宏泰电气配件厂', contact_person: '王芳', contact_phone: '13700000002', address: '江苏省苏州市' },
    { name: '力士液压科技', contact_person: '陈刚', contact_phone: '13700000003', address: '浙江省杭州市' },
  ];
  const supIds: Record<string, string> = {};
  for (const s of sups) {
    const { data } = await client.from('suppliers').select('id').eq('name', s.name).maybeSingle();
    if (data) {
      supIds[s.name] = data.id;
    } else {
      const r = await client.from('suppliers').insert(s).select().single();
      supIds[s.name] = r.data.id;
    }
  }

  // 物料 + 库存 + 部分出入库记录 + 预警
  const materials = [
    { code: 'JX-001', name: '深沟球轴承 6205', spec: '6205-2RS', cat: '机械类', lvl: '关键件', unit: '个', price: 25, safety: 30, sup: '华东传动设备有限公司', loc: 'A区-03架', qty: 18 },
    { code: 'JX-002', name: 'V型密封圈', spec: 'Φ40×Φ55×8', cat: '机械类', lvl: '一般件', unit: '个', price: 6.5, safety: 100, sup: '华东传动设备有限公司', loc: 'A区-05架', qty: 320 },
    { code: 'DQ-001', name: '交流接触器', spec: 'CJX2-1210 36V', cat: '电气类', lvl: '重要件', unit: '个', price: 58, safety: 20, sup: '宏泰电气配件厂', loc: 'B区-01架', qty: 12 },
    { code: 'DQ-002', name: '光电传感器', spec: 'E3F-DS30C4', cat: '电气类', lvl: '一般件', unit: '个', price: 45, safety: 15, sup: '宏泰电气配件厂', loc: 'B区-02架', qty: 80 },
    { code: 'YY-001', name: '齿轮油泵', spec: 'CB-B10', cat: '液压类', lvl: '关键件', unit: '台', price: 320, safety: 5, sup: '力士液压科技', loc: 'C区-01架', qty: 3 },
    { code: 'YY-002', name: '高压油管', spec: 'DN25×1.5m', cat: '液压类', lvl: '一般件', unit: '根', price: 96, safety: 10, sup: '力士液压科技', loc: 'C区-03架', qty: 40 },
    { code: 'YQ-001', name: '数显游标卡尺', spec: '0-150mm 0.01', cat: '仪器仪表', lvl: '重要件', unit: '把', price: 120, safety: 6, sup: '宏泰电气配件厂', loc: 'D区-01架', qty: 8 },
  ];

  for (const m of materials) {
    const { data: existing } = await client.from('materials').select('id, level_id, category_id').eq('code', m.code).maybeSingle();
    let materialId: string;
    if (existing) {
      materialId = existing.id;
      // 迁移：为已有物料补充分类/分级
      const patch: Record<string, string> = {};
      if (!existing.level_id && lvlIds[m.lvl]) patch.level_id = lvlIds[m.lvl];
      if (!existing.category_id && catIds[m.cat]) patch.category_id = catIds[m.cat];
      if (Object.keys(patch).length > 0) {
        await client.from('materials').update(patch).eq('id', materialId);
      }
    } else {
      const r = await client
        .from('materials')
        .insert({
          code: m.code,
          name: m.name,
          spec: m.spec,
          category_id: catIds[m.cat],
          level_id: lvlIds[m.lvl],
          unit: m.unit,
          unit_price: String(m.price),
          safety_stock: m.safety,
          default_supplier_id: supIds[m.sup],
          storage_location: m.loc,
          is_active: true,
        })
        .select()
        .single();
      materialId = r.data.id;
    }

    // 库存（含一些已出库导致低于安全库存的物料）
    const inv = await client.from('inventory').select('id').eq('material_id', materialId).maybeSingle();
    const lowStock = m.qty < m.safety;
    const rec = {
      material_id: materialId,
      quantity: m.qty,
      total_value: String(Math.round(m.qty * m.price * 100) / 100),
      last_in_time: iso(new Date(now.getTime() - 20 * 86400000)),
      last_out_time: lowStock ? iso(new Date(now.getTime() - 2 * 86400000)) : undefined,
      updated_at: iso(now),
    };
    if (inv.data) {
      await client.from('inventory').update(rec).eq('id', inv.data.id);
    } else {
      await client.from('inventory').insert(rec);
    }

    // 出入库记录
    const hasTx = await client.from('inventory_transactions').select('id').eq('material_id', materialId).limit(1).maybeSingle();
    if (!hasTx.data) {
      await client.from('inventory_transactions').insert({
        transaction_type: 1,
        material_id: materialId,
        quantity: m.qty,
        unit_price: String(m.price),
        total_amount: String(Math.round(m.qty * m.price * 100) / 100),
        supplier_id: supIds[m.sup],
        operator_id: adminId,
        operator_name: '系统管理员',
        operation_time: iso(new Date(now.getTime() - 20 * 86400000)),
        remark: '期初入库',
      });
    }

    // 预警（低于安全库存的物料）
    if (lowStock) {
      const pending = await client.from('inventory_alerts').select('id').eq('material_id', materialId).eq('is_processed', false).limit(1).maybeSingle();
      if (!pending.data) {
        await client.from('inventory_alerts').insert({
          material_id: materialId,
          current_quantity: m.qty,
          safety_stock: m.safety,
          alert_time: iso(new Date(now.getTime() - 2 * 86400000)),
          is_processed: false,
          sms_sent: false,
        });
      }
    }
  }

  console.log('[seed] 演示数据初始化完成');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[seed] 失败:', e);
    process.exit(1);
  });