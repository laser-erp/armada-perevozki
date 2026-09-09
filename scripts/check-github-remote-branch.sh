#!/usr/bin/env bash
# Проверка: ветка существует на github.com/laser-erp/armada-perevozki
# Usage: ./scripts/check-github-remote-branch.sh [branch]
set -euo pipefail
BRANCH="${1:-cursor/compliance-p0-4317}"
REPO="laser-erp/armada-perevozki"
URL="https://api.github.com/repos/${REPO}/branches/${BRANCH//\//%2F}"

TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [ -n "$TOKEN" ]; then
  HDR=(-H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json")
else
  HDR=(-H "Accept: application/vnd.github+json")
fi

HTTP="$(curl -sS -o /tmp/gh_branch.json -w "%{http_code}" "${HDR[@]}" "$URL")"
echo "GitHub branch $BRANCH → HTTP $HTTP"

if [ "$HTTP" = "200" ]; then
  SHA="$(python3 -c "import json; print(json.load(open('/tmp/gh_branch.json'))['commit']['sha'][:7])" 2>/dev/null || echo '?')"
  echo "OK  branch exists (commit $SHA)"
  exit 0
fi

if [ "$HTTP" = "404" ]; then
  echo "MISS branch not on origin"
  exit 1
fi

echo "WARN unexpected HTTP $HTTP"
cat /tmp/gh_branch.json 2>/dev/null | head -c 500
echo ""
exit 1
