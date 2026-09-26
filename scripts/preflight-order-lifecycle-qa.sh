#!/usr/bin/env bash
# Preflight для ORDER_LIFECYCLE_QA_PLAN.md — только read-only проверки с вашей машины.
# Usage: BASE_URL=https://app.armada.sx ./scripts/preflight-order-lifecycle-qa.sh
#        BASE_URL=https://staging.app.armada.sx ./scripts/preflight-order-lifecycle-qa.sh
set -euo pipefail

BASE="${BASE_URL:-https://app.armada.sx}"
API="${BASE}/armada-api"
FAIL=0
STORE_TMP="$(mktemp)"
APP_TMP="$(mktemp)"
BILL_TMP="$(mktemp)"
trap 'rm -f "$STORE_TMP" "$APP_TMP" "$BILL_TMP"' EXIT

pass() { echo "  OK   $1"; }
warn() { echo "  WARN $1"; }
fail() { echo "  FAIL $1"; FAIL=1; }
need() { echo "  NEED $1"; }

echo "=== ORDER lifecycle QA preflight — $BASE ==="
echo "План: web-preview/plans/ORDER_LIFECYCLE_QA_PLAN.md"
echo ""

echo "-- S0: сайт и API --"
for path in / order.html z a v store.js admin.js driver.js customer.js etrn.js order-public.js; do
  code="$(curl -sS -o /dev/null -w "%{http_code}" "$BASE/$path" 2>/dev/null || echo "000")"
  if [ "$code" = "200" ] || [ "$code" = "301" ] || [ "$code" = "308" ]; then
    pass "GET /$path ($code)"
  else
    fail "GET /$path ($code)"
  fi
done

HEALTH="$(curl -fsS "$API/health" 2>/dev/null || echo '{}')"
if echo "$HEALTH" | grep -q '"ok":true'; then pass "API health ok"; else fail "API health"; fi
if echo "$HEALTH" | grep -q '"configured":true'; then pass "EPD configured (health)"; else warn "EPD not configured — этап 4 ЭТrН может быть N/A"; fi
if echo "$HEALTH" | grep -q '"sandbox":true'; then warn "EPD sandbox=true — боевой обмен отдельно (KONTUR_EPD_PLAN)"; fi
echo "     health: $(echo "$HEALTH" | tr -d '\n' | head -c 240)"

echo ""
echo "-- UI bundle (канбан / роли) --"
curl -fsS "$BASE/store.js" >"$STORE_TMP"
BUILD="$(grep -m1 'APP_BUILD=' "$STORE_TMP" | sed 's/.*"\(.*\)".*/\1/')"
if [ -n "$BUILD" ]; then pass "APP_BUILD=$BUILD"; else fail "APP_BUILD missing"; fi
curl -fsS "$BASE/app.js" >"$APP_TMP" 2>/dev/null || true
curl -fsS "$BASE/billing.js" >"$BILL_TMP" 2>/dev/null || true
for sym in adminKanbanColumnKey isLogistInboxOrder looksClosedOrder armadaPublicOrderUrl; do
  if grep -q "$sym" "$STORE_TMP" || grep -q "$sym" "$APP_TMP"; then
    pass "symbol $sym (store/app)"
  else
    fail "symbol $sym missing"
  fi
done
if grep -q billingCanUseEtrn "$BILL_TMP"; then pass "symbol billingCanUseEtrn (billing.js)"; else fail "symbol billingCanUseEtrn missing"; fi

echo ""
echo "-- ETRN API smoke (без авторизации) --"
ETRN_POST="$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$API/orders/preflight-qa/etrn" -H "Content-Type: application/json" -d '{}')"
if [ "$ETRN_POST" != "404" ]; then pass "POST /orders/:id/etrn responds ($ETRN_POST)"; else fail "POST /orders/:id/etrn 404"; fi

echo ""
echo "-- Что скрипт НЕ проверяет (нужно вручную) --"
need "PIN заказчика (/z), логиста (/a), водителя (/v) — не хранятся в репо"
need "Кабинет space: для order.html → ООО «Армада» (см. ARMADA_SX_ORDER_LINKS.md)"
need "etrnEnabled в тарифе space: для сценария 1 шаг 4 — Business+ или кабинет МБН, иначе N/A"
need "Свободный водитель/ТС без «залипших» открытых рейсов"
need "Два браузера/устройства для параллельных ролей"
need "Протокол в конце ORDER_LIFECYCLE_QA_PLAN.md — заполнить дату, № заявки, PASS/FAIL"

if echo "$BASE" | grep -q staging; then
  warn "Staging UI может отличаться от prod (APP_BUILD); данные API/PB общие с prod"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "PREFLIGHT PASS (инфраструктура). Ручной E2E — по плану."
  exit 0
fi
echo "PREFLIGHT FAIL — исправьте FAIL строки перед прогоном."
exit 1
