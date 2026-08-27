#!/usr/bin/env bash
# Деплой web-preview → live VPS (aptown1.fvds.ru).
# Пароль: FVDS_SSH_PASSWORD или файл FVDS_SSH_PASSWORD_FILE (не коммитить).
# Без пароля — обычный SSH-ключ в ~/.ssh.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${FVDS_HOST:-176.12.67.35}"
USER="${FVDS_USER:-root}"
DEST="${FVDS_PATH:-/var/www/armada}"
SRC="$ROOT/web-preview"

if [ ! -d "$SRC" ]; then
  echo "Нет $SRC — запустите из репозитория armada-perevozki"
  exit 1
fi

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)
PASS="${FVDS_SSH_PASSWORD:-${root:-}}"
if [ -z "$PASS" ] && [ -n "${FVDS_SSH_PASSWORD_FILE:-}" ] && [ -f "$FVDS_SSH_PASSWORD_FILE" ]; then
  PASS="$(cat "$FVDS_SSH_PASSWORD_FILE")"
fi

run_ssh() {
  if [ -n "$PASS" ] && command -v sshpass >/dev/null 2>&1; then
    sshpass -p "$PASS" ssh "${SSH_OPTS[@]}" "$USER@$HOST" "$@"
  elif [ -n "$PASS" ]; then
    python3 - "$USER" "$HOST" "$PASS" "$@" <<'PY'
import sys, paramiko
user, host, pw, cmd = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=pw, timeout=30)
_, out, err = c.exec_command(cmd)
sys.stdout.write(out.read().decode())
sys.stderr.write(err.read().decode())
c.close()
PY
  else
    ssh "${SSH_OPTS[@]}" "$USER@$HOST" "$@"
  fi
}

deploy_tar() {
  if [ -n "$PASS" ] && command -v sshpass >/dev/null 2>&1; then
    tar czf - -C "$SRC" . | sshpass -p "$PASS" ssh "${SSH_OPTS[@]}" "$USER@$HOST" \
      "find $DEST -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} + 2>/dev/null; tar xzf - -C $DEST"
  elif [ -n "$PASS" ]; then
    TMP_TAR="$(mktemp)"
    tar czf "$TMP_TAR" -C "$SRC" .
    python3 - "$USER" "$HOST" "$PASS" "$TMP_TAR" "$DEST" <<'PY'
import sys, paramiko
user, host, pw, tar_path, dest = sys.argv[1:6]
remote_tar = "/tmp/armada-deploy.tar.gz"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=pw, timeout=60)
sftp = c.open_sftp()
sftp.put(tar_path, remote_tar)
sftp.close()
cmds = [
    f"find {dest} -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {{}} + 2>/dev/null",
    f"tar xzf {remote_tar} -C {dest}",
    f"rm -f {remote_tar}",
]
for cmd in cmds:
    _, out, err = c.exec_command(cmd)
    out.channel.recv_exit_status()
c.close()
PY
    rm -f "$TMP_TAR"
  else
    tar czf - -C "$SRC" . | ssh "${SSH_OPTS[@]}" "$USER@$HOST" \
      "find $DEST -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} + 2>/dev/null; tar xzf - -C $DEST"
  fi
}

echo "→ $USER@$HOST:$DEST"
deploy_tar
BUILD="$(grep -m1 'APP_BUILD=' "$SRC/store.js" | sed 's/.*"\(.*\)".*/\1/')"
echo "Готово. Проверка APP_BUILD на сервере:"
run_ssh "grep -m1 APP_BUILD $DEST/store.js || true"
echo "Live: https://aptown1.fvds.ru/ (ожидаемая сборка: $BUILD)"
SMOKE="$ROOT/scripts/smoke-strategic-plan.sh"
if [ -x "$SMOKE" ]; then
  echo "Smoke S0–S3…"
  BASE_URL="https://aptown1.fvds.ru" "$SMOKE" || echo "Smoke: есть ошибки (см. выше)"
fi
