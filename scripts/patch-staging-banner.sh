#!/usr/bin/env bash
# Оранжевая полоса «STAGING» в index.html (только копия для выкладки на staging).
set -euo pipefail
DIR="${1:-}"
INDEX="$DIR/index.html"
if [ ! -f "$INDEX" ]; then
  echo "Нет $INDEX"
  exit 1
fi
if grep -q 'id="armada-staging-banner"' "$INDEX"; then
  exit 0
fi
python3 - "$INDEX" <<'PY'
import re, sys
path = sys.argv[1]
banner = (
  '<div id="armada-staging-banner" role="status" style="position:fixed;top:0;left:0;right:0;z-index:99999;'
  'background:#b45309;color:#fff;text-align:center;padding:7px 10px;font-size:13px;font-weight:700;'
  'box-shadow:0 2px 8px rgba(0,0,0,.2)">'
  'STAGING — проверка интерфейса. Данные и API те же, что на проде. Прод: '
  '<a href="https://app.armada.sx/" style="color:#fff;text-decoration:underline">app.armada.sx</a>'
  '</div>'
)
text = open(path, encoding='utf-8').read()
new, n = re.subn(r'(<body[^>]*>)', r'\1\n' + banner, text, count=1)
if n != 1:
  raise SystemExit('не найден <body> в index.html')
open(path, 'w', encoding='utf-8', newline='\n').write(new)
PY
echo "staging banner → $INDEX"
