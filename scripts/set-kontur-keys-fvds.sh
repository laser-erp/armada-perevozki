#!/usr/bin/env bash
# Прописать ключи Контура / ЭПД в /opt/armada-api/.env на VPS и перезапустить armada-api.
#
# Переменные (локально или в Cloud Agent secrets):
#   EPD_API_KEY              — обязательно (ключ разработчика / API key)
#   KONTUR_API_CLIENT_ID     — опционально
#   KONTUR_API_CLIENT_SECRET — опционально
#   KONTUR_BOX_ID            — опционально (глобальный boxId; per-space — в админке → Активность)
#   EPD_SANDBOX              — по умолчанию true
#
# Usage: ./scripts/set-kontur-keys-fvds.sh
set -euo pipefail
HOST="${FVDS_HOST:-176.12.67.35}"
USER="${FVDS_USER:-root}"
PASS="${FVDS_SSH_PASSWORD:-${root:-}}"

if [ -z "$PASS" ]; then
  echo "Нужен пароль VPS: FVDS_SSH_PASSWORD или переменная root"
  exit 1
fi

if [ -z "${EPD_API_KEY:-}" ] && [ -z "${KONTUR_API_CLIENT_ID:-}" ]; then
  echo "Нужен EPD_API_KEY или KONTUR_API_CLIENT_ID в окружении"
  exit 1
fi

export EPD_SANDBOX="${EPD_SANDBOX:-true}"

python3 - "$USER" "$HOST" "$PASS" <<'PY'
import os, sys, paramiko, json

user, host, pw = sys.argv[1:4]
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=pw, timeout=30)

def run(cmd):
    _, out, err = c.exec_command(cmd)
    code = out.channel.recv_exit_status()
    text = out.read().decode() + err.read().decode()
    if code != 0:
        raise SystemExit(f"cmd failed ({code}): {cmd}\n{text}")
    return text

updates = {
    "EPD_OPERATOR": "kontur",
    "EPD_SANDBOX": os.environ.get("EPD_SANDBOX", "true"),
}
if os.environ.get("EPD_API_KEY"):
    updates["EPD_API_KEY"] = os.environ["EPD_API_KEY"]
if os.environ.get("KONTUR_API_CLIENT_ID"):
    updates["KONTUR_API_CLIENT_ID"] = os.environ["KONTUR_API_CLIENT_ID"]
if os.environ.get("KONTUR_API_CLIENT_SECRET"):
    updates["KONTUR_API_CLIENT_SECRET"] = os.environ["KONTUR_API_CLIENT_SECRET"]
if os.environ.get("KONTUR_BOX_ID"):
    updates["KONTUR_BOX_ID"] = os.environ["KONTUR_BOX_ID"]
if os.environ.get("DIADOC_API_URL"):
    updates["DIADOC_API_URL"] = os.environ["DIADOC_API_URL"]

payload = json.dumps(updates)
patch = f"""
import pathlib, json
updates = json.loads({json.dumps(payload)})
path = pathlib.Path("/opt/armada-api/.env")
lines = path.read_text().splitlines() if path.exists() else []
out = []
seen = set()
for line in lines:
    if not line or line.lstrip().startswith("#"):
        out.append(line)
        continue
    if "=" not in line:
        out.append(line)
        continue
    key = line.split("=", 1)[0].strip()
    if key in updates:
        out.append(f"{{key}}={{updates[key]}}")
        seen.add(key)
    else:
        out.append(line)
for key, val in updates.items():
    if key not in seen:
        out.append(f"{{key}}={{val}}")
path.write_text("\\n".join(out).rstrip() + "\\n")
print("PATCH .env OK:", ", ".join(sorted(updates.keys())))
"""
run("python3 <<'IN'\n" + patch + "\nIN")
health = run("systemctl restart armada-api && sleep 2 && curl -fsS http://127.0.0.1:8091/health")
print(health)
c.close()
PY

echo ""
echo "Проверка снаружи:"
curl -fsS "https://app.armada.sx/armada-api/health" | python3 -m json.tool 2>/dev/null || curl -fsS "https://app.armada.sx/armada-api/health"

if [ -n "${KONTUR_BOX_ID:-}" ]; then
  echo ""
  echo "KONTUR_BOX_ID задан — введите boxId в Админка → Активность (per space), если ещё не внесён."
fi
=======
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
>>>>>>> origin/cursor/kontur-oauth-boxid-f6d2
