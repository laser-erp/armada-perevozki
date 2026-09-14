#!/usr/bin/env bash
# Бэкап АРМАДА на VPS: JSON app_state + SQLite + tar pb_data.
# Запуск: на сервере /opt/armada/scripts/backup-armada.sh
# Cron: scripts/install-backup-cron.sh
set -euo pipefail

BACKUP_ROOT="${ARMADA_BACKUP_DIR:-/var/backups/armada}"
PB_ROOT="${ARMADA_PB_ROOT:-/opt/pocketbase}"
PB_DATA="$PB_ROOT/pb_data"
KEEP_DAYS="${ARMADA_BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
DEST="$BACKUP_ROOT/$STAMP"
LOG_TAG="armada-backup"

log() { echo "[$(date -Iseconds)] $LOG_TAG: $*"; }

mkdir -p "$DEST"
log "start → $DEST"

if [ -f /etc/armada/api.env ]; then
  set -a
  # shellcheck disable=SC1091
  source /etc/armada/api.env
  set +a
fi

# 1) Логический бэкап: app_state через PocketBase API (localhost)
if [ -n "${PB_ADMIN_EMAIL:-}" ] && [ -n "${PB_ADMIN_PASSWORD:-}" ]; then
  TOKEN=""
  AUTH_JSON=$(curl -sf -X POST "http://127.0.0.1:8090/api/collections/_superusers/auth-with-password" \
    -H 'Content-Type: application/json' \
    -d "{\"identity\":\"${PB_ADMIN_EMAIL}\",\"password\":\"${PB_ADMIN_PASSWORD}\"}" 2>/dev/null || true)
  if [ -n "$AUTH_JSON" ]; then
    TOKEN=$(python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('token',''))" <<<"$AUTH_JSON" 2>/dev/null || true)
  fi
  if [ -n "$TOKEN" ]; then
    FILTER=$(python3 -c "import urllib.parse; print(urllib.parse.quote(\"key='main'\"))")
    HTTP_CODE=$(curl -s -o "$DEST/app_state_api.json" -w '%{http_code}' \
      "http://127.0.0.1:8090/api/collections/app_state/records?filter=${FILTER}&perPage=1" \
      -H "Authorization: $TOKEN")
    if [ "$HTTP_CODE" = "200" ] && [ -s "$DEST/app_state_api.json" ]; then
      log "app_state JSON OK"
    else
      log "WARN: app_state JSON export failed (http $HTTP_CODE)"
      rm -f "$DEST/app_state_api.json"
    fi
  else
    log "WARN: PocketBase auth failed — JSON export skipped"
  fi
else
  log "WARN: PB_ADMIN_EMAIL/PASSWORD not set — JSON export skipped"
fi

# 2) SQLite .backup (если sqlite3 установлен)
if command -v sqlite3 >/dev/null 2>&1; then
  if [ -f "$PB_DATA/data.db" ]; then
    sqlite3 "$PB_DATA/data.db" ".backup '$DEST/data.db'"
    log "data.db backup OK"
  fi
  if [ -f "$PB_DATA/auxiliary.db" ]; then
    sqlite3 "$PB_DATA/auxiliary.db" ".backup '$DEST/auxiliary.db'"
    log "auxiliary.db backup OK"
  fi
else
  log "sqlite3 not found — only tar pb_data"
fi

# 3) Полный снимок pb_data (включая WAL)
if [ -d "$PB_DATA" ]; then
  tar czf "$DEST/pb_data.tar.gz" -C "$PB_ROOT" pb_data
  log "pb_data.tar.gz OK ($(du -h "$DEST/pb_data.tar.gz" | cut -f1))"
fi

# 4) Веб-статика (лёгкий снимок)
WEB_ROOT="${ARMADA_WEB_ROOT:-/var/www/armada}"
if [ -d "$WEB_ROOT" ]; then
  tar czf "$DEST/web-preview.tar.gz" -C "$WEB_ROOT" . 2>/dev/null || true
  log "web-preview.tar.gz OK"
fi

{
  echo "stamp=$STAMP"
  echo "hostname=$(hostname)"
  echo "pb_root=$PB_ROOT"
  echo "keep_days=$KEEP_DAYS"
} > "$DEST/manifest.txt"

# Ссылка на последний
ln -sfn "$DEST" "$BACKUP_ROOT/latest"

# Ротация: удалить каталоги старше KEEP_DAYS
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d ! -name 'latest' -mtime +"$KEEP_DAYS" -print0 2>/dev/null \
  | xargs -0 -r rm -rf

log "done. backups in $BACKUP_ROOT ($(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d | wc -l) dirs)"
