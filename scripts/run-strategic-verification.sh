#!/usr/bin/env bash
# Smoke + prod sync + GitHub branch check (O-02 не блокирует exit).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${BASE_URL:-https://aptown1.fvds.ru}"
"$ROOT/scripts/smoke-strategic-plan.sh"
"$ROOT/scripts/verify-prod-web-sync.sh"
if [ -x "$ROOT/scripts/check-github-remote-branch.sh" ]; then
  echo ""
  "$ROOT/scripts/check-github-remote-branch.sh" cursor/compliance-p0-4317 || echo "GitHub: ветка ещё не на origin (O-02)"
fi
