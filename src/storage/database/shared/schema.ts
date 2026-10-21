import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// 系统表（禁止删除）
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

// 用户角色表（关联 auth.users，存储角色与姓名）
export const profiles = pgTable(
  "profiles",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    role: varchar("role", { length: 20 }).notNull().default("operator"), // admin-系统管理员 operator-设备管理员
    phone: varchar("phone", { length: 20 }),
    receive_alert_sms: boolean("receive_alert_sms").default(false).notNull(), // 是否接收预警短信
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("profiles_user_id_idx").on(table.user_id),
    index("profiles_role_idx").on(table.role),
  ]
);

// 备件分类表（类别标签，如：机械类、电气类）
export const sparePartCategories = pgTable("spare_part_categories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  sort_order: integer("sort_order").notNull().default(0),
  is_active: boolean("is_active").default(true).notNull(),
  created_by: varchar("created_by", { length: 36 }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }),
});

// 备件分级表（级别标签，如：关键件、重要件、一般件）
export const sparePartLevels = pgTable("spare_part_levels", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  sort_order: integer("sort_order").notNull().default(0),
  is_active: boolean("is_active").default(true).notNull(),
  created_by: varchar("created_by", { length: 36 }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }),
});

// 供应商表
export const suppliers = pgTable(
  "suppliers",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    contact_person: varchar("contact_person", { length: 128 }),
    contact_phone: varchar("contact_phone", { length: 32 }),
    address: varchar("address", { length: 512 }),
    remark: text("remark"),
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [index("suppliers_is_active_idx").on(table.is_active)]
);

// 物料信息表
export const materials = pgTable(
  "materials",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    spec: varchar("spec", { length: 255 }),
    category_id: varchar("category_id", { length: 36 }).references(() => sparePartCategories.id),
    level_id: varchar("level_id", { length: 36 }).references(() => sparePartLevels.id),
    unit: varchar("unit", { length: 16 }).notNull().default("个"),
    unit_price: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
    safety_stock: integer("safety_stock").notNull().default(0),
    default_supplier_id: varchar("default_supplier_id", { length: 36 }).references(() => suppliers.id),
    storage_location: varchar("storage_location", { length: 255 }),
    remark: text("remark"),
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("materials_code_idx").on(table.code),
    index("materials_category_id_idx").on(table.category_id),
    index("materials_level_id_idx").on(table.level_id),
    index("materials_default_supplier_id_idx").on(table.default_supplier_id),
    index("materials_is_active_idx").on(table.is_active),
  ]
);

// 库存表（与物料一一对应）
export const inventory = pgTable(
  "inventory",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    material_id: varchar("material_id", { length: 36 }).notNull().references(() => materials.id),
    quantity: integer("quantity").notNull().default(0),
    total_value: numeric("total_value", { precision: 14, scale: 2 }).notNull().default("0"),
    last_in_time: timestamp("last_in_time", { withTimezone: true }),
    last_out_time: timestamp("last_out_time", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("inventory_material_id_idx").on(table.material_id),
    index("inventory_quantity_idx").on(table.quantity),
  ]
);

// 出入库记录表
export const inventoryTransactions = pgTable(
  "inventory_transactions",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    transaction_type: integer("transaction_type").notNull(), // 1-入库 2-出库
    material_id: varchar("material_id", { length: 36 }).notNull().references(() => materials.id),
    quantity: integer("quantity").notNull(),
    unit_price: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
    total_amount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    supplier_id: varchar("supplier_id", { length: 36 }).references(() => suppliers.id),
    operator_id: varchar("operator_id", { length: 36 }).notNull(),
    operator_name: varchar("operator_name", { length: 128 }),
    operation_time: timestamp("operation_time", { withTimezone: true }).defaultNow().notNull(),
    remark: text("remark"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("inventory_transactions_material_id_idx").on(table.material_id),
    index("inventory_transactions_supplier_id_idx").on(table.supplier_id),
    index("inventory_transactions_operator_id_idx").on(table.operator_id),
    index("inventory_transactions_operation_time_idx").on(table.operation_time),
    index("inventory_transactions_type_time_idx").on(table.transaction_type, table.operation_time),
  ]
);

// 库存预警表
export const inventoryAlerts = pgTable(
  "inventory_alerts",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    material_id: varchar("material_id", { length: 36 }).notNull().references(() => materials.id),
    current_quantity: integer("current_quantity").notNull(),
    safety_stock: integer("safety_stock").notNull(),
    alert_time: timestamp("alert_time", { withTimezone: true }).defaultNow().notNull(),
    sms_sent: boolean("sms_sent").default(false).notNull(),
    is_processed: boolean("is_processed").default(false).notNull(),
    processed_by: varchar("processed_by", { length: 36 }),
    processed_time: timestamp("processed_time", { withTimezone: true }),
    processed_remark: text("processed_remark"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("inventory_alerts_material_id_idx").on(table.material_id),
    index("inventory_alerts_is_processed_idx").on(table.is_processed),
    index("inventory_alerts_alert_time_idx").on(table.alert_time),
  ]
);

// 操作日志表
export const operationLogs = pgTable(
  "operation_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    user_name: varchar("user_name", { length: 128 }),
    operation_type: varchar("operation_type", { length: 32 }).notNull(), // 新增/编辑/删除/入库/出库/预警处理/导入/登录
    operation_content: text("operation_content"),
    ip_address: varchar("ip_address", { length: 64 }),
    user_agent: varchar("user_agent", { length: 512 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("operation_logs_user_id_idx").on(table.user_id),
    index("operation_logs_operation_type_idx").on(table.operation_type),
    index("operation_logs_created_at_idx").on(table.created_at),
  ]
);

// 系统设置表（预警规则、短信接收人等配置）
export const systemSettings = pgTable(
  "system_settings",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    key: varchar("key", { length: 64 }).notNull(),
    value: jsonb("value"),
    description: varchar("description", { length: 255 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("system_settings_key_idx").on(table.key)]
);

// 类型导出
export type Profile = typeof profiles.$inferSelect;
export type SparePartCategory = typeof sparePartCategories.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Material = typeof materials.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type InventoryAlert = typeof inventoryAlerts.$inferSelect;
export type OperationLog = typeof operationLogs.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
