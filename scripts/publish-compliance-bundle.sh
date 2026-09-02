#!/usr/bin/env bash
# Создать bundle и опубликовать на aptown1.fvds.ru/downloads/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${FVDS_HOST:-176.12.67.35}"
USER="${FVDS_USER:-root}"
DEST="${FVDS_PATH:-/var/www/armada}"
PASS="${FVDS_SSH_PASSWORD:-${root:-}}"
BUNDLE="$ROOT/armada-compliance-4317.bundle"

"$ROOT/scripts/create-compliance-bundle.sh" "$BUNDLE"

if [ -z "$PASS" ]; then
  echo "Нет пароля SSH — bundle только локально: $BUNDLE"
  exit 0
fi

REMOTE="$DEST/downloads/armada-compliance-4317.bundle"
echo "→ upload $BUNDLE → $USER@$HOST:$REMOTE"

if command -v sshpass >/dev/null 2>&1; then
  sshpass -p "$PASS" ssh -o StrictHostKeyChecking=accept-new "$USER@$HOST" "mkdir -p $DEST/downloads"
  sshpass -p "$PASS" scp -o StrictHostKeyChecking=accept-new "$BUNDLE" "$USER@$HOST:$REMOTE"
else
  python3 - "$USER" "$HOST" "$PASS" "$BUNDLE" "$REMOTE" <<'PY'
import sys, paramiko
user, host, pw, local, remote = sys.argv[1:6]
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=pw, timeout=30)
sftp = c.open_sftp()
try:
    sftp.mkdir('/var/www/armada/downloads')
except OSError:
    pass
sftp.put(local, remote)
sftp.close()
c.close()
print('upload ok')
PY
fi

echo "Live: https://aptown1.fvds.ru/downloads/armada-compliance-4317.bundle"
