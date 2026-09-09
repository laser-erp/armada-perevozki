#!/usr/bin/env bash
# Исправление armada-api на VPS: signJwt(JWT_SECRET) + PB_SERVICE_TOKEN bootstrap.
# Usage: FVDS_SSH_PASSWORD=… ./scripts/fix-armada-api-auth-fvds.sh
set -euo pipefail
HOST="${FVDS_HOST:-176.12.67.35}"
USER="${FVDS_USER:-root}"
PASS="${FVDS_SSH_PASSWORD:-${root:-}}"

if [ -z "$PASS" ]; then
  echo "Нужен пароль VPS: FVDS_SSH_PASSWORD или переменная root"
  exit 1
fi

python3 - "$USER" "$HOST" "$PASS" <<'PY'
import sys, paramiko
user, host, pw = sys.argv[1:4]
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=pw, timeout=30)

def run(cmd):
    _, out, err = c.exec_command(cmd)
    text = out.read().decode() + err.read().decode()
    return text

patch = r'''
import pathlib
path = pathlib.Path("/opt/armada-api/src/server.js")
text = path.read_text()
old = "const token = signJwt({ role, spaceId, adminId, sub: adminId || role });"
new = "const token = signJwt({ role, spaceId, adminId, sub: adminId || role }, JWT_SECRET);"
if old in text:
    path.write_text(text.replace(old, new, 1))
    print("PATCH signJwt OK")
elif new in text:
    print("PATCH signJwt already applied")
else:
    raise SystemExit("signJwt pattern not found")

env = pathlib.Path("/opt/armada-api/.env")
lines = env.read_text().splitlines()
out = []
for line in lines:
    if line.startswith("PB_SERVICE_TOKEN=") and not line.split("=", 1)[1].strip():
        out.append("# PB_SERVICE_TOKEN=  # empty — use PB admin auth")
    else:
        out.append(line)
env.write_text("\n".join(out) + "\n")
print("PATCH env OK")
'''
run("python3 <<'IN'\n" + patch + "\nIN")
print(run("systemctl restart armada-api && sleep 2 && curl -fsS -X POST http://127.0.0.1:8091/auth/login -H 'Content-Type: application/json' -d '{\"pin\":\"test\",\"role\":\"admin\"}' | head -c 80"))
c.close()
PY

echo "Готово. Проверка: curl -sS https://app.armada.sx/armada-api/auth/login -d '{\"pin\":\"x\",\"role\":\"admin\"}'"
