#!/usr/bin/env bash
# GitHub Pages: репо laser-erp/armada-web → https://laser-erp.github.io/armada-web/
# Абсолютные пути вида /styles.css ведут на корень github.io, не в подпапку.
# Патчим только копию для publish, armada-perevozki / app.armada.sx не трогаем.
set -euo pipefail
ROOT="${1:-.}"
BASE="${ARMADA_WEB_BASE:-/armada-web}"
cd "$ROOT"

echo "patch-armada-web-pages: BASE=${BASE} in $(pwd)"

while IFS= read -r -d '' f; do
  sed -i \
    -e "s|base href=\"/\"|base href=\"${BASE}/\"|g" \
    -e "s|href=\"/|href=\"${BASE}/|g" \
    -e "s|src=\"/|src=\"${BASE}/|g" \
    "$f"
done < <(find . -name '*.html' -type f -print0)

for f in boot-loader.js pilot-request.js order-public.js kp-zakaz-lead.js store.js; do
  [ -f "$f" ] || continue
  sed -i \
    -e "s|loadScript('/|loadScript('${BASE}/|g" \
    -e "s|loadScript(\"/|loadScript(\"${BASE}/|g" \
    -e "s|loadScript('/' + f|loadScript('${BASE}/' + f|g" \
    -e "s|location.assign('/')|location.assign('${BASE}/')|g" \
    -e "s|location.replace('/')|location.replace('${BASE}/')|g" \
    "$f"
done

echo "patch-armada-web-pages: OK"
