#!/usr/bin/env bash
# Сравнение web-preview с staging (не с продом).
set -euo pipefail
BASE_URL="${BASE_URL:-https://staging.app.armada.sx}" \
  exec "$(cd "$(dirname "$0")" && pwd)/verify-prod-web-sync.sh"
