#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PASS="${FVDS_SSH_PASSWORD:-${root:-}}"
if [ -z "$PASS" ]; then
  echo "Нет FVDS_SSH_PASSWORD или root в окружении"
  exit 1
fi
printf '%s' "$PASS" > "$ROOT/.fvds-ssh-password"
chmod 600 "$ROOT/.fvds-ssh-password"
echo "password file ok"
./scripts/deploy-caddy-fvds.sh
./scripts/deploy-staging-fvds.sh main
