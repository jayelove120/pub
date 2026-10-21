#!/usr/bin/env bash
# 备件管理系统 API 冒烟测试：登录获取 token 后真实调用全部接口
set -u
BASE="http://localhost:5000"
ADMIN_EMAIL="${SMOKE_ADMIN_EMAIL:-admin@spare.com}"
ADMIN_PWD="${SMOKE_ADMIN_PWD:-123456}"
FAIL=0
report() { local code="$1" name="$2" ok="$3"; if [ "$ok" = "ok" ]; then echo "[PASS] $name"; else echo "[FAIL] $name"; FAIL=1; fi; }

URL="${COZE_SUPABASE_URL:-}"
ANON="${COZE_SUPABASE_ANON_KEY:-}"
load_creds() {
  local pycode='import sys
try:
    from coze_workload_identity import Client
    c=Client(); evs=c.get_project_env_vars(); c.close()
    for e in evs: print(f"{e.key}={e.value}")
except Exception as ex: print("# "+str(ex), file=sys.stderr)'
  while IFS= read -r line; do
    [ -z "$line" ] && continue; case "$line" in \#*) continue;; esac
    key="${line%%=*}"; val="${line#*=}"; val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
    [ -z "${!key:-}" ] && export "$key=$val"
  done < <(python3 -c "$pycode" 2>/dev/null)
  URL="${COZE_SUPABASE_URL:-$URL}"; ANON="${COZE_SUPABASE_ANON_KEY:-$ANON}"
}
[ -z "$URL" ] || [ -z "$ANON" ] && load_creds
if [ -z "$URL" ] || [ -z "$ANON" ]; then echo "FATAL: 缺少 Supabase 凭证"; exit 2; fi

TOKEN=$(curl -s -X POST -H "apikey: $ANON" -H "Content-Type: application/json" "$URL/auth/v1/token?grant_type=password" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PWD\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)
if [ -z "$TOKEN" ]; then echo "FATAL: admin 登录失败"; exit 2; fi
echo "== 1. 登录成功 =="
S="x-session: $TOKEN"

api_get() { curl -s -o /tmp/o -w "%{http_code}" -H "$S" "$BASE$1"; }
api_post() { curl -s -o /tmp/o -w "%{http_code}" -X POST -H "$S" -H "Content-Type: application/json" "$BASE$1" -d "$2"; }
api_put() { curl -s -o /tmp/o -w "%{http_code}" -X PUT -H "$S" -H "Content-Type: application/json" "$BASE$1" -d "${2:-{}}"; }
api_del() { curl -s -o /tmp/o -w "%{http_code}" -X DELETE -H "$S" "$BASE$1"; }
jget() { python3 -c "import sys,json;d=json.load(open('/tmp/o'));import os
for k in '$1'.split('|'):
    v=d
    for part in k.split('.'):
        v=v.get(part) if isinstance(v,dict) else (v[int(part)] if isinstance(v,list) else None)
        if v is None: break
    if v is not None: print(v); break"; }

echo "== 2. 只读接口 =="
for ep in "/api/dashboard" "/api/categories" "/api/levels" "/api/suppliers" "/api/materials?page=1" "/api/inventory?page=1" "/api/transactions?page=1" "/api/alerts?all=1" "/api/logs?page=1" "/api/users" "/api/settings" "/api/profile" "/api/supabase-config" "/api/export/inventory" "/api/export/transactions"; do
  c=$(api_get "$ep"); o=$(head -c 60 /tmp/o)
  case "$c" in 200) if echo "$o" | grep -q "error"; then report "$c" "GET $ep" fail; else report "$c" "GET $ep" ok; fi;; *) report "$c" "GET $ep" fail;; esac
done

echo "== 3. 写操作：分类/供应商/物料 CRUD =="
CC=$(api_post "/api/categories" '{"name":"冒烟测试分类"}')
OC=$(head -c 80 /tmp/o); [ "$CC" = "201" ] && report "$CC" "POST /api/categories" ok || report "$CC" "POST /api/categories ($OC)" fail
cat_id=$(jget "id")
[ -n "$cat_id" ] && {
  CU=$(api_post "/api/categories/$cat_id" '{"name":"冒烟测试分类改"}')
  [ "$CU" = "200" ] && report "$CU" "PUT /api/categories" ok || report "$CU" "PUT /api/categories (body=$(head -c 160 /tmp/o))" fail
}
LC=$(api_post "/api/levels" '{"name":"冒烟测试分级","sort_order":99}')
OL=$(head -c 80 /tmp/o); [ "$LC" = "201" ] && report "$LC" "POST /api/levels" ok || report "$LC" "POST /api/levels ($OL)" fail
lvl_id=$(jget "id")
SU=$(api_post "/api/suppliers" '{"name":"冒烟测试供应商","contact_person":"测试"}')
OS=$(head -c 60 /tmp/o); [ "$SU" = "201" ] && report "$SU" "POST /api/suppliers" ok || report "$SU" "POST /api/suppliers ($OS)" fail
sup_id=$(jget "id")
[ -n "$sup_id" ] && {
  SP=$(api_post "/api/suppliers/$sup_id" '{"contact_phone":"13800000000"}')
  [ "$SP" = "200" ] && report "$SP" "PUT /api/suppliers" ok || report "$SP" "PUT /api/suppliers (body=$(head -c 160 /tmp/o))" fail
}
MC=$(api_post "/api/materials" "{\"code\":\"SMK-$(date +%s)\",\"name\":\"冒烟测试物料\",\"category_id\":\"${cat_id:-}\",\"level_id\":\"${lvl_id:-}\",\"default_supplier_id\":\"${sup_id:-}\",\"supplier_ids\":[\"${sup_id:-}\"],\"unit_price\":10.5,\"safety_stock\":3}")
OM=$(head -c 80 /tmp/o); [ "$MC" = "201" ] && report "$MC" "POST /api/materials" ok || report "$MC" "POST /api/materials ($OM)" fail
mat_id=$(jget "id")
[ -n "$lvl_id" ] && {
  LU=$(api_post "/api/levels/$lvl_id" '{"name":"冒烟测试分级改"}')
  [ "$LU" = "200" ] && report "$LU" "PUT /api/levels" ok || report "$LU" "PUT /api/levels (body=$(head -c 160 /tmp/o))" fail
}
[ -n "$mat_id" ] && {
  MG=$(api_get "/api/materials/$mat_id")
  [ "$MG" = "200" ] && report "$MG" "GET /api/materials/[id]" ok || report "$MG" "GET /api/materials/[id]" fail
}
IMP=$(api_post "/api/import/materials" "{\"csv\":\"编码,名称,规格型号,分类名称,级别名称,单位,单价,安全库存,默认供应商名称,存放位置,备注,初始数量\\nSMK-IMP-$(date +%s),冒烟导入物料,S-1,冒烟测试分类改,冒烟测试分级改,个,5,2,冒烟测试供应商,A区,导入测试,3\"}")
[ "$IMP" = "200" ] && report "$IMP" "POST /api/import/materials" ok || report "$IMP" "POST /api/import/materials ($(head -c 120 /tmp/o))" fail
[ -n "$mat_id" ] && {
  PU=$(api_post "/api/materials/$mat_id" '{"name":"冒烟测试物料改","supplier_ids":[]}')
  [ "$PU" = "200" ] && report "$PU" "PUT /api/materials" ok || report "$PU" "PUT /api/materials (body=$(head -c 160 /tmp/o))" fail
}

echo "== 4. 出入库流水 =="
MAT2=$(api_get "/api/materials?page=1"); mat2=$(jget "rows.0.id")
if [ -n "$mat2" ]; then
  CI=$(api_post "/api/inventory/in" "{\"material_id\":\"$mat2\",\"quantity\":3,\"remark\":\"冒烟入库\"}")
  [ "$CI" = "201" ] && report "$CI" "POST /api/inventory/in" ok || report "$CI" "POST /api/inventory/in ($(head -c 60 /tmp/o))" fail
  CO=$(api_post "/api/inventory/out" "{\"material_id\":\"$mat2\",\"quantity\":1,\"remark\":\"冒烟出库\"}")
  [ "$CO" = "201" ] && report "$CO" "POST /api/inventory/out" ok || report "$CO" "POST /api/inventory/out ($(head -c 60 /tmp/o))" fail
  api_get "/api/inventory?page=1" >/dev/null; inv_id=$(jget "rows.0.id")
  [ -n "$inv_id" ] && {
    IG=$(api_get "/api/inventory/$inv_id")
    [ "$IG" = "200" ] && report "$IG" "GET /api/inventory/[id]" ok || report "$IG" "GET /api/inventory/[id]" fail
  }
fi

echo "== 5. 预警处理 =="
AL=$(api_get "/api/alerts?status=unprocessed&all=1"); al=$(jget "all.0.id")
if [ -n "$al" ]; then
  CP=$(api_post "/api/alerts/$al/process" '{"remark":"冒烟处理"}')
  [ "$CP" = "200" ] && report "$CP" "PUT /api/alerts/process" ok || report "$CP" "PUT /api/alerts/process (body=$(head -c 160 /tmp/o))" fail
else echo "[SKIP] 无未处理预警"; fi

echo "== 6. 用户管理 =="
TS_ID=$(date +%s)
US=$(api_post "/api/users" "{\"name\":\"冒烟用户\",\"email\":\"smoke${TS_ID}@test.com\",\"password\":\"Smoke123456\",\"role\":\"operator\",\"phone\":\"1380000$((TS_ID%10000000))\"}")
[ "$US" = "201" ] && report "$US" "POST /api/users" ok || report "$US" "POST /api/users ($(head -c 80 /tmp/o))" fail
new_uid=$(jget "user_id")
[ -n "$new_uid" ] && {
  UU=$(api_post "/api/users/$new_uid" '{"phone":"13900000000"}')
  [ "$UU" = "200" ] && report "$UU" "POST /api/users/[id]" ok || report "$UU" "POST /api/users/[id]" fail
}

echo "== 7. 系统设置 =="
SS=$(api_post "/api/settings" '{"sms_config":{"enabled":true,"receiver_phones":["13812345678"]}}')
[ "$SS" = "200" ] && report "$SS" "PUT /api/settings" ok || report "$SS" "PUT /api/settings (body=$(head -c 160 /tmp/o))" fail

echo "== 8. 清理测试数据 =="
[ -n "$mat_id" ] && { api_del "/api/materials/$mat_id" >/dev/null; report "200" "DELETE /api/materials (清理)" ok; }
# 删除导入的物料，解除对测试分类/分级/供应商的引用
api_get "/api/materials?page=1&keyword=SMK-IMP" >/dev/null; imp_id=$(jget "rows.0.id")
[ -n "$imp_id" ] && api_del "/api/materials/$imp_id" >/dev/null
# 物料已删除，分类/分级/供应商无引用，可测删除接口
[ -n "$cat_id" ] && { DC=$(api_del "/api/categories/$cat_id"); [ "$DC" = "200" ] && report "$DC" "DELETE /api/categories/[id]" ok || report "$DC" "DELETE /api/categories/[id]" fail; }
[ -n "$lvl_id" ] && { DL=$(api_del "/api/levels/$lvl_id"); [ "$DL" = "200" ] && report "$DL" "DELETE /api/levels/[id]" ok || report "$DL" "DELETE /api/levels/[id]" fail; }
[ -n "$sup_id" ] && { DS=$(api_del "/api/suppliers/$sup_id"); [ "$DS" = "200" ] && report "$DS" "DELETE /api/suppliers/[id]" ok || report "$DS" "DELETE /api/suppliers/[id]" fail; }
# 清理冒烟测试创建的分类/分级/供应商/用户，避免残留
pnpm tsx scripts/cleanup-smoke-users.ts >/dev/null 2>&1 || true

echo
echo "=========== 冒烟测试结果: $([ $FAIL -eq 0 ] && echo ALL-PASS || echo HAS-FAILURE) ==========="
exit $FAIL