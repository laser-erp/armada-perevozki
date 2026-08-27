#!/usr/bin/env bash
# Push compliance branch + verify on GitHub + refresh bundle on prod (O-02).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="${1:-cursor/compliance-p0-4317}"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"

if [ -z "$TOKEN" ]; then
  echo "GITHUB_TOKEN не задан."
  echo "Добавьте секрет GITHUB_TOKEN в Cloud Environment или:"
  echo "  export GITHUB_TOKEN='…'"
  echo "  ./scripts/github-auth-and-push.sh"
  exit 1
fi

echo "→ push $BRANCH"
ORIGIN="https://x-access-token:${TOKEN}@github.com/laser-erp/armada-perevozki.git"
attempt=1
max=4
delay=4
while [ "$attempt" -le "$max" ]; do
  if git push -u "$ORIGIN" "$BRANCH"; then
    break
  fi
  if [ "$attempt" -eq "$max" ]; then
    echo "Push failed after $max attempts"
    exit 1
  fi
  echo "Retry $attempt/$max in ${delay}s…"
  sleep "$delay"
  delay=$((delay * 2))
  attempt=$((attempt + 1))
done

echo "→ verify remote branch"
export GITHUB_TOKEN="$TOKEN"
"$ROOT/scripts/check-github-remote-branch.sh" "$BRANCH"

HEAD="$(git rev-parse --short HEAD)"
echo "→ publish bundle (HEAD $HEAD)"
if [ -n "${FVDS_SSH_PASSWORD:-${root:-}}" ]; then
  FVDS_SSH_PASSWORD="${FVDS_SSH_PASSWORD:-${root:-}}" "$ROOT/scripts/publish-compliance-bundle.sh"
fi

"$ROOT/scripts/sync-o02-github-status.sh" "$BRANCH"

echo "O-02 done. HEAD=$HEAD"
