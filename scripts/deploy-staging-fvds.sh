#!/usr/bin/env bash
# Деплой web-preview → staging (https://staging.app.armada.sx), прод не трогаем.
#
# Usage:
#   ./scripts/deploy-staging-fvds.sh              # текущая папка web-preview
#   ./scripts/deploy-staging-fvds.sh main         # ветка с GitHub
#   STAGING_GIT_REF=cursor/foo ./scripts/deploy-staging-fvds.sh
#
# Перед первым запуском: DNS A staging.app.armada.sx → VPS, затем deploy-caddy-fvds.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REF="${1:-${STAGING_GIT_REF:-}}"
DEPLOY_SRC="$(mktemp -d)"
trap 'rm -rf "$DEPLOY_SRC"' EXIT

if [ -n "$REF" ]; then
  echo "→ web-preview из origin/$REF"
  git -C "$ROOT" fetch origin "$REF"
  git -C "$ROOT" archive "origin/$REF" web-preview | tar -x -C "$DEPLOY_SRC" --strip-components=1
else
  echo "→ web-preview из рабочей копии"
  rsync -a --delete "$ROOT/web-preview/" "$DEPLOY_SRC/"
fi

bash "$ROOT/scripts/patch-staging-banner.sh" "$DEPLOY_SRC"

export ARMADA_DEPLOY_SRC="$DEPLOY_SRC"
export FVDS_PATH="${FVDS_STAGING_PATH:-/var/www/armada-staging}"
export ARMADA_DEPLOY_URL="${ARMADA_STAGING_URL:-https://staging.app.armada.sx}"

echo "→ staging $ARMADA_DEPLOY_URL (каталог $FVDS_PATH)"
exec bash "$ROOT/scripts/deploy-fvds.sh"
