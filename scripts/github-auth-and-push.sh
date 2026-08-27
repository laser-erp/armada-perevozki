#!/usr/bin/env bash
# Push compliance branch + verify + bundle (O-02). Uses github-push-branch.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="${1:-cursor/compliance-p0-4317}"

"$ROOT/scripts/sync-o02-github-status.sh" "$BRANCH"
echo "O-02 complete."
