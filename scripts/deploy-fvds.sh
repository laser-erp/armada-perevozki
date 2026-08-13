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
PASS="${FVDS_SSH_PASSWORD:-}"
if [ -z "$PASS" ] && [ -n "${FVDS_SSH_PASSWORD_FILE:-}" ] && [ -f "$FVDS_SSH_PASSWORD_FILE" ]; then
  PASS="$(cat "$FVDS_SSH_PASSWORD_FILE")"
fi

run_ssh() {
  if [ -n "$PASS" ]; then
    sshpass -p "$PASS" ssh "${SSH_OPTS[@]}" "$USER@$HOST" "$@"
  else
    ssh "${SSH_OPTS[@]}" "$USER@$HOST" "$@"
  fi
}

echo "→ $USER@$HOST:$DEST"
tar czf - -C "$SRC" . | run_ssh "find $DEST -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} + 2>/dev/null; tar xzf - -C $DEST"
BUILD="$(grep -m1 'APP_BUILD=' "$SRC/store.js" | sed 's/.*"\(.*\)".*/\1/')"
echo "Готово. Проверка APP_BUILD на сервере:"
run_ssh "grep -m1 APP_BUILD $DEST/store.js || true"
echo "Live: http://aptown1.fvds.ru/ (ожидаемая сборка: $BUILD)"
