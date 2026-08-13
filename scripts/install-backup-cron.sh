#!/usr/bin/env bash
# Установка cron бэкапа на VPS (вызывается из deploy-fvds.sh или вручную).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${FVDS_HOST:-176.12.67.35}"
USER="${FVDS_USER:-root}"
PASS="${FVDS_SSH_PASSWORD:-}"
if [ -z "$PASS" ] && [ -n "${FVDS_SSH_PASSWORD_FILE:-}" ] && [ -f "$FVDS_SSH_PASSWORD_FILE" ]; then
  PASS="$(cat "$FVDS_SSH_PASSWORD_FILE")"
fi
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)
run_ssh() {
  if [ -n "$PASS" ]; then sshpass -p "$PASS" ssh "${SSH_OPTS[@]}" "$USER@$HOST" "$@"
  else ssh "${SSH_OPTS[@]}" "$USER@$HOST" "$@"
  fi
}

echo "→ install backup script + cron on $HOST"
tar czf - -C "$ROOT/scripts" backup-armada.sh | run_ssh "mkdir -p /opt/armada/scripts /var/backups/armada && tar xzf - -C /opt/armada/scripts && chmod +x /opt/armada/scripts/backup-armada.sh"

run_ssh "bash -s" <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
if ! command -v sqlite3 >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq sqlite3
fi
CRON_LINE='15 3 * * * /opt/armada/scripts/backup-armada.sh >> /var/log/armada-backup.log 2>&1'
( crontab -l 2>/dev/null | grep -v 'backup-armada.sh' ; echo "$CRON_LINE" ) | crontab -
echo "Cron:"
crontab -l | grep backup-armada || true
if /opt/armada/scripts/backup-armada.sh; then
  ls -la /var/backups/armada/latest/ 2>/dev/null | head -10
else
  echo "WARN: first backup run had errors — check /var/log/armada-backup.log"
fi
REMOTE

echo "Готово. Бэкапы: /var/backups/armada/ · лог: /var/log/armada-backup.log"
