#!/usr/bin/env bash
# Метка STAGING в index.html (только копия для выкладки на staging).
set -euo pipefail
DIR="${1:-}"
INDEX="$DIR/index.html"
if [ ! -f "$INDEX" ]; then
  echo "Нет $INDEX"
  exit 1
fi
python3 - "$INDEX" <<'PY'
import re, sys
path = sys.argv[1]
banner = (
  '<div id="armada-staging-banner" role="status" aria-label="Среда staging" '
  'style="position:fixed;left:0;right:0;top:0;z-index:99999;height:3px;'
  'background:linear-gradient(90deg,#b45309,#f59e0b);pointer-events:none"></div>'
  '<a id="armada-staging-chip" href="https://app.armada.sx/" '
  'style="position:fixed;top:max(6px,env(safe-area-inset-top,0px));right:max(6px,env(safe-area-inset-right,0px));'
  'z-index:99999;display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;'
  'font-weight:700;line-height:1.25;letter-spacing:.02em;text-decoration:none;'
  'color:#fff;background:rgba(180,83,9,.88);box-shadow:0 1px 4px rgba(0,0,0,.18)">STAGING</a>'
)
text = open(path, encoding='utf-8').read()
text = re.sub(
    r'<div id="armada-staging-banner"[^>]*>.*?</div>\s*',
    '',
    text,
    count=1,
    flags=re.DOTALL,
)
text = re.sub(r'<a id="armada-staging-chip"[^>]*>STAGING</a>\s*', '', text)
if 'id="armada-staging-chip"' in text:
    raise SystemExit('не удалось снять старый staging-chip')
text, n = re.subn(r'(<body[^>]*>)', r'\1\n' + banner, text, count=1)
if n != 1:
    raise SystemExit('не найден <body> в index.html')
open(path, 'w', encoding='utf-8', newline='\n').write(text)
PY
echo "staging mark → $INDEX"
