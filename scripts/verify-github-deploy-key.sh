#!/usr/bin/env bash
# Проверка: GITHUB_DEPLOY_KEY аутентифицируется на github.com
set -euo pipefail
DEPLOY_KEY="${GITHUB_DEPLOY_KEY:-}"
if [ -z "$DEPLOY_KEY" ]; then
  echo "GITHUB_DEPLOY_KEY не задан"
  exit 1
fi
KEY_FILE="$(mktemp)"
printf '%s\n' "$DEPLOY_KEY" >"$KEY_FILE"
chmod 600 "$KEY_FILE"
PUB="$(ssh-keygen -y -f "$KEY_FILE" 2>/dev/null || true)"
rm -f "$KEY_FILE"
if [ -z "$PUB" ]; then
  echo "FAIL приватный ключ повреждён или неверный формат"
  exit 1
fi
echo "OK  ключ валиден: $PUB"
OUT="$(ssh -i <(printf '%s\n' "$DEPLOY_KEY") -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes -T git@github.com 2>&1 || true)"
if echo "$OUT" | grep -qi 'successfully authenticated'; then
  echo "OK  GitHub принимает deploy key"
  exit 0
fi
echo "FAIL GitHub не знает этот ключ — добавьте публичный ключ в Deploy keys (Allow write):"
echo "$PUB"
exit 1
