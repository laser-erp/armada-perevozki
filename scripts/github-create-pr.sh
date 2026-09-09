#!/usr/bin/env bash
# Create GitHub PR via API (needs GITHUB_TOKEN or GH_TOKEN with repo scope).
# Usage: ./scripts/github-create-pr.sh [branch] [base] [title] [body-file]
set -euo pipefail

REPO="${GITHUB_REPO:-laser-erp/armada-perevozki}"
BRANCH="${1:-$(git branch --show-current)}"
BASE="${2:-main}"
TITLE="${3:-Merge ${BRANCH} into ${BASE}}"
BODY_FILE="${4:-}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"

if [ -z "$TOKEN" ]; then
  echo "❌ Нет GITHUB_TOKEN / GH_TOKEN."
  echo "   Один раз: Cursor → Environment → Secrets → GITHUB_TOKEN"
  echo "   Инструкция: docs/GITHUB_TOKEN_SETUP.md"
  exit 1
fi

BODY=""
if [ -n "$BODY_FILE" ] && [ -f "$BODY_FILE" ]; then
  BODY="$(cat "$BODY_FILE")"
fi

api() {
  curl -fsS -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "$@"
}

EXISTING="$(api "https://api.github.com/repos/${REPO}/pulls?head=laser-erp:${BRANCH}&base=${BASE}&state=open" 2>/dev/null || echo '[]')"
PR_URL="$(echo "$EXISTING" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['html_url'] if d else '')" 2>/dev/null || true)"
if [ -n "$PR_URL" ]; then
  echo "PR уже открыт: $PR_URL"
  exit 0
fi

PAYLOAD="$(python3 - <<PY
import json, os
print(json.dumps({
  "title": os.environ["TITLE"],
  "head": os.environ["BRANCH"],
  "base": os.environ["BASE"],
  "body": os.environ.get("BODY", ""),
}))
PY
)"
export TITLE BRANCH BASE BODY

RESP="$(api -X POST "https://api.github.com/repos/${REPO}/pulls" -d "$PAYLOAD")"
echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ PR:', d.get('html_url','')); print(d.get('message',''))" 2>/dev/null || echo "$RESP"
