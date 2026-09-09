#!/usr/bin/env bash
# Проверка: входы открываются как HTML, статика не подменяется index.html.
set -euo pipefail
BASE="${BASE_URL:-https://aptown1.fvds.ru}"
FAIL=0

check_html() {
  local url="$1" label="$2"
  local ct len
  ct=$(curl -fsSI -L --max-redirs 3 "$url" | grep -i '^content-type:' | tail -1 | tr -d '\r')
  len=$(curl -fsSI -L --max-redirs 3 "$url" | grep -i '^content-length:' | tail -1 | awk '{print $2}' | tr -d '\r')
  if echo "$ct" | grep -qi 'text/html'; then
    if [ "${len:-0}" -lt 1000 ]; then
      echo "  FAIL $label — html слишком короткий ($len байт): $url"
      FAIL=1
    else
      echo "  OK  $label — html ($len байт)"
    fi
  else
    echo "  FAIL $label — не html ($ct): $url"
    FAIL=1
  fi
}

check_static() {
  local url="$1" expect="$2" label="$3"
  local ct
  ct=$(curl -fsSI "$url" | grep -i '^content-type:' | tail -1 | tr -d '\r')
  if echo "$ct" | grep -qi "$expect"; then
    echo "  OK  $label — $ct"
  else
    echo "  FAIL $label — ожидали $expect, получили $ct ($url)"
    FAIL=1
  fi
}

echo "Link verify — $BASE"
check_html "$BASE/v/" "водитель /v/"
check_html "$BASE/a/" "админ /a/"
check_html "$BASE/z/" "заказчик /z/"
check_html "$BASE/downloads/github-push.html" "инструкция GitHub"
check_static "$BASE/styles.css" "text/css" "styles.css"
check_static "$BASE/store.js" "javascript" "store.js"
# bundle — файл для git, не страница; без content-type намеренно «скачать»
bundle_len=$(curl -fsSI "$BASE/downloads/armada-compliance-4317.bundle" | grep -i '^content-length:' | tail -1 | awk '{print $2}' | tr -d '\r')
if [ "${bundle_len:-0}" -gt 100000 ]; then
  echo "  OK  bundle — файл ${bundle_len} байт (скачивание нормально)"
else
  echo "  FAIL bundle — нет файла или слишком мал (${bundle_len:-0} байт)"
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "LINK VERIFY PASS"
  exit 0
fi
echo "LINK VERIFY FAIL"
exit 1
