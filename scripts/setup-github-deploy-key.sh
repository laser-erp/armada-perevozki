#!/usr/bin/env bash
# Генерация deploy key для push без PAT. Публичный ключ → GitHub Deploy keys (write).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY_DIR="${ARMADA_SSH_DIR:-$HOME/.ssh}"
KEY="$KEY_DIR/armada_github_deploy"
mkdir -p "$KEY_DIR"

if [ ! -f "$KEY" ]; then
  ssh-keygen -t ed25519 -f "$KEY" -N "" -C "armada-o02-$(date +%Y%m%d)"
  echo "Создан ключ: $KEY"
else
  echo "Ключ уже есть: $KEY"
fi

echo ""
echo "=== Публичный ключ (добавьте в GitHub → laser-erp/armada-perevozki → Settings → Deploy keys → Allow write) ==="
cat "${KEY}.pub"
echo ""
echo "=== Приватный ключ (добавьте как секрет GITHUB_DEPLOY_KEY в Cursor Environment) ==="
echo "cat $KEY"
echo ""
echo "После настройки: ./scripts/sync-o02-github-status.sh"
