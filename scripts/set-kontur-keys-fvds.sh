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
