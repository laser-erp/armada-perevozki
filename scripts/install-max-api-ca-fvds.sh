#!/usr/bin/env bash
# Сертификаты Минцифры для platform-api2.max.ru (Node.js fetch на VPS).
# Без NODE_EXTRA_CA_CERTS armada-api отвечает marketing/max/* error «fetch failed».
#
# Usage: FVDS_SSH_PASSWORD=… ./scripts/install-max-api-ca-fvds.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${FVDS_HOST:-176.12.67.35}"
USER="${FVDS_USER:-root}"
PASS="${FVDS_SSH_PASSWORD:-${root:-}}"
BUNDLE="${ROOT}/armada-api/certs/russian_trusted_ca_bundle.pem"

if [ -z "$PASS" ]; then
  echo "Нужен пароль VPS: FVDS_SSH_PASSWORD или переменная root"
  exit 1
fi

python3 - "$USER" "$HOST" "$PASS" "$BUNDLE" <<'PY'
import pathlib, sys, paramiko
user, host, pw, bundle_path = sys.argv[1:5]
bundle = pathlib.Path(bundle_path)
if not bundle.is_file():
    raise SystemExit(f"Нет bundle: {bundle}")

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=pw, timeout=60)
sftp = c.open_sftp()
sftp.mkdir("/opt/armada-api/certs")
remote = "/opt/armada-api/certs/russian_trusted_ca_bundle.pem"
sftp.put(str(bundle), remote)
sftp.close()

def run(cmd):
    _, out, err = c.exec_command(cmd)
    return (out.read() + err.read()).decode()

patch = r'''
import pathlib
env = pathlib.Path("/etc/armada/api.env")
lines = env.read_text().splitlines() if env.is_file() else []
lines = [l for l in lines if not l.startswith("NODE_EXTRA_CA_CERTS=")]
lines.append("NODE_EXTRA_CA_CERTS=/opt/armada-api/certs/russian_trusted_ca_bundle.pem")
env.parent.mkdir(parents=True, exist_ok=True)
env.write_text("\n".join(lines) + "\n")
print("NODE_EXTRA_CA_CERTS set in", env)
'''
run("python3 <<'IN'\n" + patch + "\nIN")
print(run("systemctl restart armada-api && sleep 2 && systemctl is-active armada-api"))
print(run(
    "NODE_EXTRA_CA_CERTS=/opt/armada-api/certs/russian_trusted_ca_bundle.pem "
    "node -e \"fetch('https://platform-api2.max.ru/').then(r=>console.log('node',r.status)).catch(e=>console.error('ERR',e.cause&&e.cause.code||e.message))\""
))
c.close()
PY

echo "Готово. Проверка UI: Соцсети → MAX → «Тестовый пост» (ожидается не fetch failed)."
