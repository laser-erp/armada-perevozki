#!/usr/bin/env bash
# Git bundle ветки cursor/compliance-p0-4317 для ручного push (O-02).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="cursor/compliance-p0-4317"
OUT="${1:-$ROOT/armada-compliance-4317.bundle}"

if ! git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  echo "Ветка $BRANCH не найдена"
  exit 1
fi

git bundle create "$OUT" "$BRANCH"
echo "Bundle: $OUT ($(du -h "$OUT" | awk '{print $1}'))"
echo "HEAD: $(git rev-parse --short "$BRANCH")"
