#!/usr/bin/env bash
# Генерация PDF писем операторам из отдельных HTML-бланков.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LETTERS_DIR="$ROOT/docs/operator-letters"
OUT_WEB="$ROOT/web-preview/downloads"

declare -a JOBS=(
  "kontur.html|ARMADA_Pismo_Kontur_ETRN.pdf"
  "kaluga-astral.html|ARMADA_Pismo_Kaluga_Astral_ETRN.pdf"
)

CHROME="${CHROME:-/usr/local/bin/google-chrome}"
if [[ ! -x "$CHROME" ]]; then
  CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
fi
if [[ -z "${CHROME:-}" || ! -x "$CHROME" ]]; then
  echo "Chrome/Chromium не найден для печати в PDF"
  exit 1
fi

TMP_PROFILE="$(mktemp -d)"
trap 'rm -rf "$TMP_PROFILE"' EXIT

for job in "${JOBS[@]}"; do
  SRC_NAME="${job%%|*}"
  PDF_NAME="${job##*|}"
  SRC="$LETTERS_DIR/$SRC_NAME"
  OUT_DOCS="$LETTERS_DIR/$PDF_NAME"
  OUT_DL="$OUT_WEB/$PDF_NAME"

  if [[ ! -f "$SRC" ]]; then
    echo "Нет исходника: $SRC"
    exit 1
  fi

  FILE_URL="file://${SRC}"
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
        echo "Chrome завершился с ошибкой, но PDF создан — продолжаем ($PDF_NAME)"
      else
        exit 1
      fi
    }

  cp "$OUT_DOCS" "$OUT_DL"
  echo "PDF: $OUT_DOCS"
  echo "PDF: $OUT_DL ($(du -h "$OUT_DOCS" | awk '{print $1}'))"
done
