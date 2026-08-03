#!/usr/bin/env bash
# Синхронизация web-preview → публичный сайт GitHub Pages.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN="${ARMADA_WEB_TOKEN:-$(gh auth token 2>/dev/null || true)}"
if [ -z "${TOKEN}" ]; then
  echo "Нужен gh auth login или ARMADA_WEB_TOKEN"
  exit 1
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git clone --depth 1 "https://x-access-token:${TOKEN}@github.com/laser-erp/armada-web.git" "$TMP/site"
rsync -a --delete --exclude '.git' --exclude 'README.md' "$ROOT/web-preview/" "$TMP/site/"
touch "$TMP/site/.nojekyll"
cd "$TMP/site"
git config user.name "${GIT_AUTHOR_NAME:-armada-publish}"
git config user.email "${GIT_AUTHOR_EMAIL:-aptown1@gmail.com}"
git add -A
if git diff --cached --quiet; then
  echo "Нет изменений для публикации"
  exit 0
fi
git commit -m "Sync web-preview $(date -u +%Y-%m-%dT%H:%MZ)"
git push origin HEAD:main
echo "Опубликовано: https://laser-erp.github.io/armada-web/"
