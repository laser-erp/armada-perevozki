#!/usr/bin/env bash
# Метка STAGING в HTML (только копия для выкладки на staging): index, order.html, лендинги.
set -euo pipefail
DIR="${1:-}"
if [ ! -d "$DIR" ]; then
  echo "Нет каталога $DIR"
  exit 1
fi
shopt -s nullglob
files=("$DIR"/*.html)
if [ ${#files[@]} -eq 0 ]; then
  echo "Нет *.html в $DIR"
  exit 1
fi
python3 - "${files[@]}" <<'PY'
import re, sys

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

def patch(path: str) -> bool:
    text = open(path, encoding='utf-8').read()
    if '<body' not in text:
        return False
    text = re.sub(
        r'<div id="armada-staging-banner"[^>]*>.*?</div>\s*',
        '',
        text,
        count=1,
        flags=re.DOTALL,
    )
    text = re.sub(r'<a id="armada-staging-chip"[^>]*>STAGING</a>\s*', '', text)
    if 'id="armada-staging-chip"' in text:
        raise SystemExit(f'не удалось снять старый staging-chip: {path}')
    text, n = re.subn(r'(<body[^>]*>)', r'\1\n' + banner, text, count=1)
    if n != 1:
        raise SystemExit(f'не найден <body> в {path}')
    open(path, 'w', encoding='utf-8', newline='\n').write(text)
    return True

patched = []
for path in sys.argv[1:]:
    if patch(path):
        patched.append(path)
if not patched:
    raise SystemExit('ни один HTML не пропатчен')
for p in patched:
    print('staging mark →', p)
PY
