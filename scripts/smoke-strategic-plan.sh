#!/usr/bin/env bash
# Smoke S0 (HTTPS + armada-api), S1 (driverInvites), S3 (ETRN MVP UI/API).
# Usage: BASE_URL=https://aptown1.fvds.ru ./scripts/smoke-strategic-plan.sh
set -euo pipefail

BASE="${BASE_URL:-https://aptown1.fvds.ru}"
API="${BASE}/armada-api"
FAIL=0

pass() { echo "  OK  $1"; }
fail() { echo "  FAIL $1"; FAIL=1; }

echo "ARMADA strategic plan smoke — $BASE"
echo "S0 HTTPS + armada-api"
if curl -fsS -o /dev/null "$BASE/"; then pass "HTTPS $BASE"; else fail "HTTPS $BASE"; fi

HEALTH="$(curl -fsS "$API/health" 2>/dev/null || echo '{}')"
if echo "$HEALTH" | grep -q '"ok":true'; then pass "API health ok"; else fail "API health"; fi
if echo "$HEALTH" | grep -q 'armada-api'; then pass "API service name"; else fail "API service name"; fi

echo "S1 driverInvites"
if curl -fsS -o /dev/null "$BASE/invite.html"; then pass "invite.html"; else fail "invite.html"; fi
STORE="$(curl -fsS "$BASE/store.js" 2>/dev/null || true)"
if [ -n "$STORE" ]; then pass "store.js"; else fail "store.js"; fi
if echo "$STORE" | grep -q 'const KEY="armada_app_v5"'; then pass "store.js KEY"; else fail "store.js KEY missing"; fi
if echo "$STORE" | grep -q 'driverInvitePageUrl'; then pass "driverInvites in store.js"; else fail "driverInvites"; fi

echo "S3 ETRN MVP"
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

BUILD="$(echo "$STORE" | grep -m1 'APP_BUILD=' | sed 's/.*"\(.*\)".*/\1/')"
if [ -n "$BUILD" ]; then pass "APP_BUILD=$BUILD"; else fail "APP_BUILD"; fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "SMOKE PASS"
  exit 0
fi
echo "SMOKE FAIL"
exit 1
