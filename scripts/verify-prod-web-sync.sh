#!/usr/bin/env bash
# Сравнение web-preview в репо с live (aptown1.fvds.ru).
# Usage: BASE_URL=https://aptown1.fvds.ru ./scripts/verify-prod-web-sync.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/web-preview"
BASE="${BASE_URL:-https://aptown1.fvds.ru}"
FILES=(store.js billing.js etrn.js customer.js admin.js app.js driver.js index.html kp.html invite.html sw.js onboarding.js help.html)
FAIL=0

echo "Verify web-preview ↔ $BASE"
for f in "${FILES[@]}"; do
  if [ ! -f "$SRC/$f" ]; then
    echo "  SKIP $f (нет локально)"
    continue
  fi
  L=$(md5sum "$SRC/$f" | awk '{print $1}')
  R=$(curl -fsS "$BASE/$f" | md5sum | awk '{print $1}')
  if [ "$L" = "$R" ]; then
    echo "  MATCH $f"
  else
    echo "  DIFF  $f"
    FAIL=1
  fi
done

if [ "$FAIL" -eq 0 ]; then
  echo "SYNC OK"
  exit 0
fi
echo "SYNC FAIL — нужен deploy: scripts/deploy-fvds.sh"
exit 1
