#!/usr/bin/env bash
# Обновить Caddyfile на aptown1 и перезагрузить caddy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${FVDS_HOST:-176.12.67.35}"
USER="${FVDS_USER:-root}"
PASS="${FVDS_SSH_PASSWORD:-${root:-}}"
SRC="$ROOT/scripts/caddyfile.fvds.prod"
REMOTE="/etc/caddy/Caddyfile"

if [ ! -f "$SRC" ]; then
  echo "Нет $SRC"
  exit 1
fi

python3 - "$USER" "$HOST" "$PASS" "$SRC" "$REMOTE" <<'PY'
import sys, paramiko, datetime
user, host, pw, local, remote = sys.argv[1:6]
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=pw, timeout=30)
sftp = c.open_sftp()
bak = remote + ".bak." + datetime.datetime.utcnow().strftime("%Y%m%d%H%M")
try:
    sftp.rename(remote, bak)
except OSError:
    pass
sftp.put(local, remote)
sftp.close()
for cmd in ("caddy validate --config /etc/caddy/Caddyfile", "systemctl reload caddy"):
    _, out, err = c.exec_command(cmd)
    code = out.channel.recv_exit_status()
    o, e = out.read().decode(), err.read().decode()
    if o: print(o, end='')
    if e: print(e, end='')
    if code != 0:
        print(f"FAIL: {cmd} exit {code}")
        sys.exit(code)
c.close()
print("Caddy reloaded OK")
PY
