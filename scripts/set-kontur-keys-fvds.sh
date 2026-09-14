#!/usr/bin/env bash
# Прописать ключ API Контура на VPS (armada-api/.env).
# Usage:
#   EPD_API_KEY='ваш-ключ' ./scripts/set-kontur-keys-fvds.sh
#   EPD_API_KEY='…' KONTUR_BOX_ID='…' ./scripts/set-kontur-keys-fvds.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${FVDS_HOST:-176.12.67.35}"
USER="${FVDS_USER:-root}"
PASS="${FVDS_SSH_PASSWORD:-${root:-}}"
ENV_FILE="/opt/armada-api/.env"
API_URL="${EPD_API_URL:-https://diadoc-api.testkontur.ru}"
WEBHOOK="${EPD_WEBHOOK_SECRET:-$(openssl rand -hex 24 2>/dev/null || head -c 24 /dev/urandom | base64 | tr -dc A-Za-z0-9 | head -c 32)}"

if [ -z "$PASS" ]; then
  echo "Нет доступа к VPS (пароль root / FVDS_SSH_PASSWORD)"
  exit 1
fi
if [ -z "${EPD_API_KEY:-}" ]; then
  echo "Задайте EPD_API_KEY — ключ API из личного кабинета Контура"
  exit 1
fi

run_ssh() {
  sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=20 "$USER@$HOST" "$@"
}

echo "→ Обновление $ENV_FILE на $HOST"
run_ssh "python3 - '$ENV_FILE' '$API_URL' '$WEBHOOK' <<'PY'
import sys, pathlib, secrets
path, api_url, webhook = sys.argv[1:4]
key = '''${EPD_API_KEY}'''.strip()
if not key:
    raise SystemExit('EPD_API_KEY empty')
p = pathlib.Path(path)
lines = p.read_text(encoding='utf-8').splitlines() if p.exists() else []
vals = {
    'EPD_OPERATOR': 'kontur',
    'EPD_SANDBOX': 'true',
    'EPD_API_URL': api_url,
    'EPD_API_KEY': key,
    'EPD_WEBHOOK_SECRET': webhook,
}
out, seen = [], set()
for line in lines:
    if '=' not in line or line.strip().startswith('#'):
        out.append(line)
        continue
    k = line.split('=', 1)[0].strip()
    if k in vals:
        out.append(f'{k}={vals[k]}')
        seen.add(k)
    else:
        out.append(line)
for k, v in vals.items():
    if k not in seen:
        out.append(f'{k}={v}')
p.write_text('\\n'.join(out).rstrip() + '\\n', encoding='utf-8')
print('OK env updated')
PY"

echo "→ restart armada-api"
run_ssh "systemctl restart armada-api && sleep 2 && curl -s http://127.0.0.1:8091/health"

BOX_ID="${KONTUR_BOX_ID:-}"
if [ -n "$BOX_ID" ]; then
  echo "→ boxId будет введён в приложении: Активность → boxId кабинетов"
  echo "  (или сообщите агенту — пропишем в state)"
fi

echo ""
echo "Готово. Проверка: curl -s https://app.armada.sx/armada-api/health"
echo "Webhook URL для Контура: https://app.armada.sx/armada-api/epd/webhook"
echo "EPD_WEBHOOK_SECRET на сервере (для Активность → webhook token): $WEBHOOK"
