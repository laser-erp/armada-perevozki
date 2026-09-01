#!/usr/bin/env bash
# Smoke S0 (HTTPS + armada-api), S1 (driverInvites), S3 (ETRN MVP UI/API).
# Usage: BASE_URL=https://aptown1.fvds.ru ./scripts/smoke-strategic-plan.sh
set -euo pipefail

BASE="${BASE_URL:-https://aptown1.fvds.ru}"
API="${BASE}/armada-api"
FAIL=0
STORE_TMP="$(mktemp)"
trap 'rm -f "$STORE_TMP"' EXIT

pass() { echo "  OK  $1"; }
fail() { echo "  FAIL $1"; FAIL=1; }

fetch_store() {
  local i=0
  while [ "$i" -lt 3 ]; do
    if curl -fsS "$BASE/store.js" >"$STORE_TMP" && [ -s "$STORE_TMP" ]; then
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  return 1
}

echo "ARMADA strategic plan smoke — $BASE"
echo "S0 HTTPS + armada-api"
if curl -fsS -o /dev/null "$BASE/"; then pass "HTTPS $BASE"; else fail "HTTPS $BASE"; fi

HEALTH="$(curl -fsS "$API/health" 2>/dev/null || echo '{}')"
if echo "$HEALTH" | grep -q '"ok":true'; then pass "API health ok"; else fail "API health"; fi
if echo "$HEALTH" | grep -q 'armada-api'; then pass "API service name"; else fail "API service name"; fi
if echo "$HEALTH" | grep -q '"operator":"kontur"'; then pass "EPD operator kontur"; else fail "EPD operator"; fi
if echo "$HEALTH" | grep -q '"epd"'; then pass "EPD block in health"; else fail "EPD block"; fi

echo "S1 driverInvites"
if curl -fsS -o /dev/null "$BASE/invite.html"; then pass "invite.html"; else fail "invite.html"; fi
if fetch_store; then pass "store.js"; else fail "store.js"; fi
if grep -q 'armada_app_v5' "$STORE_TMP"; then pass "store.js KEY"; else fail "store.js KEY missing"; fi
if grep -q 'driverInvitePageUrl' "$STORE_TMP"; then pass "driverInvites in store.js"; else fail "driverInvites"; fi
if grep -q 'ENTRY_SESSION_KEY' "$STORE_TMP"; then pass "separate entry modes in store.js"; else fail "entry modes"; fi

echo "S3 ETRN MVP"
if grep -q 'fetchArmadaApiHealth' "$STORE_TMP"; then pass "fetchArmadaApiHealth in store.js"; else fail "fetchArmadaApiHealth"; fi
for f in etrn.js billing.js; do
  if curl -fsS -o /dev/null "$BASE/$f"; then pass "$f"; else fail "$f"; fi
done
ETRN_POST="$(curl -sS -o /tmp/smoke_etrn.txt -w "%{http_code}" -X POST "$API/orders/smoke-order/etrn" -H "Content-Type: application/json" -d '{}')"
if [ "$ETRN_POST" != "404" ]; then pass "POST /orders/:id/etrn (HTTP $ETRN_POST)"; else fail "POST /orders/:id/etrn"; fi
WH="$(curl -sS -o /tmp/smoke_wh.txt -w "%{http_code}" -X POST "$API/epd/webhook" -H "Content-Type: application/json" -d '{"externalId":"smoke"}')"
if [ "$WH" != "404" ] || grep -q 'etrn_not_found' /tmp/smoke_wh.txt 2>/dev/null; then
  pass "POST /epd/webhook (HTTP $WH)"
else
  fail "POST /epd/webhook"
fi

BUILD="$(grep -m1 'APP_BUILD=' "$STORE_TMP" | sed 's/.*"\(.*\)".*/\1/')"
if [ -n "$BUILD" ]; then pass "APP_BUILD=$BUILD"; else fail "APP_BUILD"; fi

echo "Onboarding"
for f in onboarding.js help.html; do
  if curl -fsS -o /dev/null "$BASE/$f"; then pass "$f"; else fail "$f"; fi
done
if curl -fsS "$BASE/index.html" | grep -q 'onboarding.js'; then pass "index.html loads onboarding.js"; else fail "index.html onboarding"; fi

echo "Entry paths"
if curl -fsS -o /dev/null "$BASE/v" && curl -fsS -o /dev/null "$BASE/a" && curl -fsS -o /dev/null "$BASE/z"; then
  pass "entry paths /v /a /z"
else
  fail "entry paths /v /a /z"
fi
if curl -fsS -o /dev/null "$BASE/entry.css"; then pass "entry.css"; else fail "entry.css"; fi

if grep -q 'isRoleHubUrl' "$STORE_TMP"; then pass "isRoleHubUrl in store.js"; else fail "isRoleHubUrl"; fi
if curl -fsS "$BASE/index.html" | grep -q 'id="roles"'; then pass "index.html roles hub"; else fail "index.html roles hub"; fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "SMOKE PASS"
  exit 0
fi
echo "SMOKE FAIL"
exit 1
