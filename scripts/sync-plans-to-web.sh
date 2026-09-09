#!/usr/bin/env bash
# Синхронизация docs/plans → web-preview/plans (статика на проде).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/docs/plans"
DST="$ROOT/web-preview/plans"
mkdir -p "$DST"
cp -a "$SRC/." "$DST/"
echo "Synced $(find "$DST" -name '*.md' | wc -l) plan files → web-preview/plans"
