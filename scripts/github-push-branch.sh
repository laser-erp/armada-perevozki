#!/usr/bin/env bash
# Push branch to laser-erp/armada-perevozki via GITHUB_TOKEN or GITHUB_DEPLOY_KEY.
set -euo pipefail
BRANCH="${1:-cursor/compliance-p0-4317}"
REPO="laser-erp/armada-perevozki"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
DEPLOY_KEY="${GITHUB_DEPLOY_KEY:-}"
KEY_FILE="${TMPDIR:-/tmp}/armada_github_deploy_$$"

cleanup() { rm -f "$KEY_FILE" 2>/dev/null; }
trap cleanup EXIT

push_https() {
  local origin="https://x-access-token:${TOKEN}@github.com/${REPO}.git"
  local attempt=1 delay=4
  while [ "$attempt" -le 4 ]; do
    if git push -u "$origin" "$BRANCH"; then return 0; fi
    if [ "$attempt" -eq 4 ]; then return 1; fi
    echo "Retry $attempt/4 in ${delay}s…"
    sleep "$delay"
    delay=$((delay * 2))
    attempt=$((attempt + 1))
  done
}

push_ssh() {
  printf '%s\n' "$DEPLOY_KEY" >"$KEY_FILE"
  chmod 600 "$KEY_FILE"
  export GIT_SSH_COMMAND="ssh -i $KEY_FILE -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes"
  local attempt=1 delay=4
  while [ "$attempt" -le 4 ]; do
    if git push -u "git@github.com:${REPO}.git" "$BRANCH"; then return 0; fi
    if [ "$attempt" -eq 4 ]; then return 1; fi
    echo "Retry $attempt/4 in ${delay}s…"
    sleep "$delay"
    delay=$((delay * 2))
    attempt=$((attempt + 1))
  done
}

if [ -n "$TOKEN" ]; then
  echo "→ push via GITHUB_TOKEN"
  push_https
  exit 0
fi

if [ -n "$DEPLOY_KEY" ]; then
  echo "→ push via GITHUB_DEPLOY_KEY (SSH)"
  push_ssh
  exit 0
fi

echo "Нет GITHUB_TOKEN и GITHUB_DEPLOY_KEY"
exit 1
