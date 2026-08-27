#!/usr/bin/env bash
# Push current or named branch using GITHUB_TOKEN (no token in repo).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="${1:-$(git branch --show-current)}"
TOKEN="${GITHUB_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  echo "GITHUB_TOKEN не задан. Экспортируйте токен и запустите снова."
  exit 1
fi
ORIGIN="https://x-access-token:${TOKEN}@github.com/laser-erp/armada-perevozki.git"
git push -u "$ORIGIN" "$BRANCH"
