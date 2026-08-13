#!/usr/bin/env bash
# Деплой web-preview + armada-api → live VPS (aptown1.fvds.ru).
# Пароль: FVDS_SSH_PASSWORD или FVDS_SSH_PASSWORD_FILE (не коммитить).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${FVDS_HOST:-176.12.67.35}"
USER="${FVDS_USER:-root}"
DEST="${FVDS_PATH:-/var/www/armada}"
SRC="$ROOT/web-preview"
API_SRC="$ROOT/armada-api"

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

echo "→ $USER@$HOST:$DEST (web)"
tar czf - -C "$SRC" . | run_ssh "find $DEST -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} + 2>/dev/null; tar xzf - -C $DEST"

if [ -d "$API_SRC" ]; then
  echo "→ $USER@$HOST:/opt/armada-api"
  tar czf - -C "$API_SRC" . | run_ssh "mkdir -p /opt/armada-api && tar xzf - -C /opt/armada-api"
  tar czf - -C "$ROOT/scripts" armada-api.service api.env.example | run_ssh "mkdir -p /etc/armada && tar xzf - -C /tmp && mv /tmp/armada-api.service /etc/systemd/system/armada-api.service"
  run_ssh "FVDS_PB_PASSWORD='${FVDS_PB_PASSWORD:-}' bash -s" <<'REMOTE'
set -euo pipefail
if ! command -v node >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq nodejs
fi
ENV_FILE=/etc/armada/api.env
PB_PASS="${FVDS_PB_PASSWORD:-}"
if [ ! -f "$ENV_FILE" ]; then
  JWT=$(openssl rand -hex 32)
  PB_PASS="${PB_PASS:-CHANGE_ME_PB_PASSWORD}"
  cat > "$ENV_FILE" <<EOF
ARMADA_API_PORT=8091
PB_URL=http://127.0.0.1:8090
PB_ADMIN_EMAIL=aptown1@gmail.com
PB_ADMIN_PASSWORD=$PB_PASS
JWT_SECRET=$JWT
EOF
  chmod 600 "$ENV_FILE"
  echo "Создан $ENV_FILE"
elif [ -n "$PB_PASS" ]; then
  sed -i "s/^PB_ADMIN_PASSWORD=.*/PB_ADMIN_PASSWORD=$PB_PASS/" "$ENV_FILE" || true
fi
systemctl daemon-reload
systemctl enable armada-api
systemctl restart armada-api
REMOTE
fi

# Скрипт бэкапа на сервер (cron — install-backup-cron.sh)
if [ -f "$ROOT/scripts/backup-armada.sh" ]; then
  echo "→ backup script /opt/armada/scripts/"
  tar czf - -C "$ROOT/scripts" backup-armada.sh | run_ssh "mkdir -p /opt/armada/scripts /var/backups/armada && tar xzf - -C /opt/armada/scripts && chmod +x /opt/armada/scripts/backup-armada.sh"
fi

CADDY_SRC="$ROOT/scripts/caddyfile.armada"
if [ -f "$CADDY_SRC" ]; then
  echo "→ Caddy: /etc/caddy/Caddyfile"
  tar czf - -C "$(dirname "$CADDY_SRC")" "$(basename "$CADDY_SRC")" | run_ssh "tar xzf - -C /tmp && mv /tmp/caddyfile.armada /etc/caddy/Caddyfile && systemctl reload caddy"
fi

BUILD="$(grep -m1 'APP_BUILD=' "$SRC/store.js" | sed 's/.*"\(.*\)".*/\1/')"
echo "Готово. Проверка APP_BUILD на сервере:"
run_ssh "grep -m1 APP_BUILD $DEST/store.js || true"
run_ssh "curl -sS -o /dev/null -w 'API health: %{http_code}\n' http://127.0.0.1:8091/armada-api/health || true"
echo "Live: http://aptown1.fvds.ru/ (ожидаемая сборка: $BUILD)"
