#!/usr/bin/env bash
# PNG 1080×1080 из web-preview/marketing-cards/*.html
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/web-preview/marketing-cards"
OUT="$DIR/png"
CHROME="${CHROME:-google-chrome}"

mkdir -p "$OUT"
shopt -s nullglob
for html in "$DIR"/[0-9]*.html; do
  base=$(basename "$html" .html)
  echo "→ $base.png"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --user-data-dir="/tmp/chrome-marketing-cards-$$" \
    --window-size=1080,1080 --screenshot="$OUT/$base.png" \
    "file://$html" 2>/dev/null || \
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --user-data-dir="/tmp/chrome-marketing-cards-$$" \
    --window-size=1080,1080 --screenshot="$OUT/$base.png" \
    "file://$html"
  rm -rf "/tmp/chrome-marketing-cards-$$" 2>/dev/null || true
done
echo "Готово: $OUT"
