#!/usr/bin/env bash
# Сброс кэша PB-токена при 403 — иначе /state отдаёт state_fetch_failed и вход ломается.
# Usage: FVDS_SSH_PASSWORD=… ./scripts/fix-armada-api-pb-auth-retry.sh
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
path = pathlib.Path("/opt/armada-api/src/pb.js")
text = path.read_text()
needle = "  if(!res.ok){\n    const err = new Error(data?.message || `PocketBase ${res.status}`);"
insert = """  if(!res.ok){
    if(!options._pbRetried && res.status === 403 && cachedToken){
      cachedToken = '';
      return pbRequest(path, { ...options, _pbRetried: true });
    }
    const err = new Error(data?.message || `PocketBase ${res.status}`);"""
if needle in text and insert not in text:
    path.write_text(text.replace(needle, insert, 1))
    print("PATCH pb retry OK")
elif "_pbRetried" in text:
    print("PATCH pb retry already applied")
else:
    raise SystemExit("pb.js pattern not found — проверьте /opt/armada-api/src/pb.js")
'''
run("python3 <<'IN'\n" + patch + "\nIN")
print(run("systemctl restart armada-api && sleep 2"))
print(run("""TOKEN=$(curl -fsS -X POST http://127.0.0.1:8091/auth/login -H 'Content-Type: application/json' -d '{"pin":"sync","role":"admin"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
curl -fsS http://127.0.0.1:8091/state -H "Authorization: Bearer $TOKEN" | python3 -c 'import sys,json; d=json.load(sys.stdin); p=d.get("payload") or {}; print("spaces", len(p.get("spaces") or []), "admins", len(p.get("admins") or []))'
"""))
c.close()
PY

echo "Готово."
