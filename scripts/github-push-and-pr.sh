#!/usr/bin/env bash
# Push branch + create PR (token or deploy key for push; token required for PR).
# Usage: ./scripts/github-push-and-pr.sh [branch] [title]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${1:-$(git -C "$ROOT" branch --show-current)}"
TITLE="${2:-Merge ${BRANCH}}"
cd "$ROOT"
"$ROOT/scripts/github-push-branch.sh" "$BRANCH"
if [ -n "${GITHUB_TOKEN:-${GH_TOKEN:-}}" ]; then
  "$ROOT/scripts/github-create-pr.sh" "$BRANCH" main "$TITLE"
else
  echo ""
  echo "Push OK. PR вручную (нет GITHUB_TOKEN):"
  echo "https://github.com/laser-erp/armada-perevozki/compare/main...${BRANCH}?expand=1"
fi
