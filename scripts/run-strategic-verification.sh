#!/usr/bin/env bash
# Smoke + prod sync — одна команда для §4 verification.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${BASE_URL:-https://aptown1.fvds.ru}"
"$ROOT/scripts/smoke-strategic-plan.sh"
"$ROOT/scripts/verify-prod-web-sync.sh"
