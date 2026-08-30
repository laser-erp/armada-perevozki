#!/usr/bin/env bash
# Проверка: Нечаев А.С. в admins на сервере и в API /state.
set -euo pipefail
BASE="${BASE_URL:-https://app.armada.sx}"
API="${BASE}/armada-api"
FAIL=0
pass(){ echo "  OK  $1"; }
fail(){ echo "  FAIL $1"; FAIL=1; }

echo "Verify admin list — ${BASE}"

BUILD="$(curl -fsSL "${BASE}/store.js" 2>/dev/null | grep -m1 'APP_BUILD=' | sed 's/.*"\(.*\)".*/\1/' || true)"
if [ -n "$BUILD" ]; then pass "APP_BUILD ${BUILD}"; else fail "APP_BUILD on ${BASE}/store.js"; fi

HEALTH="$(curl -fsSL "${API}/health" 2>/dev/null || echo FAIL)"
if echo "$HEALTH" | grep -q '"ok":true'; then pass "armada-api health"; else fail "armada-api health"; fi

TOKEN="$(curl -fsSL -X POST "${API}/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"pin":"verify","role":"admin"}' | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))' 2>/dev/null || true)"
if [ -z "$TOKEN" ]; then fail "auth/login token"; else pass "auth/login token"; fi

if [ -n "$TOKEN" ]; then
  ADMINS="$(curl -fsSL "${API}/state" -H "Authorization: Bearer ${TOKEN}" | python3 -c '
import sys,json
p=json.load(sys.stdin).get("payload") or {}
names=[a.get("name") for a in p.get("admins") or []]
print("|".join(names))
nech=[a for a in p.get("admins") or [] if "неча" in (a.get("name") or "").lower()]
if not nech:
    sys.exit(2)
a=nech[0]
pin=str(a.get("pin") or "")
if len(pin)<4: sys.exit(3)
print(a.get("name"), a.get("id"), len(pin))
' 2>/dev/null || echo ERR)"
  if [ "$ADMINS" = "ERR" ]; then
    fail "API /state admins"
  elif echo "$ADMINS" | grep -qi нечаев; then
    pass "Нечаев А.С. in API admins ($ADMINS)"
  else
    fail "Нечаев missing in API admins: $ADMINS"
  fi
fi

echo ""
if [ "$FAIL" -eq 0 ]; then echo "VERIFY PASS"; exit 0; fi
echo "VERIFY FAIL"; exit 1
