#!/usr/bin/env bash
# Генерация PDF писем операторам из HTML-бланка.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/docs/operator-letters/pisma-operatoram-etrn.html"
OUT_DOCS="$ROOT/docs/operator-letters/ARMADA_Pismo_Operatoram_ETRN.pdf"
OUT_WEB="$ROOT/web-preview/downloads/ARMADA_Pismo_Operatoram_ETRN.pdf"

CHROME="${CHROME:-/usr/local/bin/google-chrome}"
if [[ ! -x "$CHROME" ]]; then
  CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
fi
if [[ -z "${CHROME:-}" || ! -x "$CHROME" ]]; then
  echo "Chrome/Chromium не найден для печати в PDF"
  exit 1
fi

if [[ ! -f "$SRC" ]]; then
  echo "Нет исходника: $SRC"
  exit 1
fi

FILE_URL="file://${SRC}"
TMP_PROFILE="$(mktemp -d)"
trap 'rm -rf "$TMP_PROFILE"' EXIT
timeout 45 "$CHROME" \
  --headless=new \
  --disable-gpu \
  --no-sandbox \
  --disable-dev-shm-usage \
  --user-data-dir="$TMP_PROFILE" \
  --run-all-compositor-stages-before-draw \
  --virtual-time-budget=8000 \
  --print-to-pdf="$OUT_DOCS" \
  "$FILE_URL" || {
    if [[ -f "$OUT_DOCS" ]]; then
      echo "Chrome завершился с ошибкой, но PDF создан — продолжаем"
    else
      exit 1
    fi
  }

cp "$OUT_DOCS" "$OUT_WEB"
echo "PDF: $OUT_DOCS"
echo "PDF: $OUT_WEB ($(du -h "$OUT_DOCS" | awk '{print $1}'))"
