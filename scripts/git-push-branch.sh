#!/usr/bin/env bash
# Push branch using GITHUB_TOKEN or GITHUB_DEPLOY_KEY.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec "$ROOT/scripts/github-push-branch.sh" "${1:-$(git branch --show-current)}"
