#!/usr/bin/env bash
# O-02: проверить ветку на GitHub, push если есть credentials, обновить трекер.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="${1:-cursor/compliance-p0-4317}"
TRACKER="$ROOT/.cursor/stores/self/strategic-plan-tracker.json"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
DEPLOY_KEY="${GITHUB_DEPLOY_KEY:-}"

check_remote() {
  if "$ROOT/scripts/check-github-remote-branch.sh" "$BRANCH" >/tmp/o02_check.txt 2>&1; then
    cat /tmp/o02_check.txt
    return 0
  fi
  cat /tmp/o02_check.txt
  return 1
}

update_tracker_done() {
  local head="${1:-$(git rev-parse --short HEAD)}"
  python3 - "$TRACKER" "$head" <<'PY'
import json, sys, datetime
path, head = sys.argv[1], sys.argv[2]
t = json.load(open(path))
now = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
t["updatedAt"] = now
gh = t.setdefault("deploy", {}).setdefault("githubRemote", {})
gh["status"] = "done"
gh["branch"] = "cursor/compliance-p0-4317"
gh["headCommit"] = head
gh["githubApi"] = "200"
gh["notes"] = "check-github-remote-branch.sh OK"
ops = t.setdefault("ops", {}).setdefault("O-02", {})
ops["status"] = "done"
ops["notes"] = f"ветка на origin; HEAD {head}"
open(path, "w").write(json.dumps(t, indent=2, ensure_ascii=False) + "\n")
print(f"Tracker updated: O-02 done, head={head}")
PY
}

if check_remote; then
  update_tracker_done
  exit 0
fi

if [ -n "$TOKEN" ] || [ -n "$DEPLOY_KEY" ]; then
  echo "→ remote missing, push credentials set"
  "$ROOT/scripts/github-push-branch.sh" "$BRANCH"
  if ! check_remote; then
    echo "Push не подтверждён на API GitHub"
    exit 1
  fi
  HEAD="$(git rev-parse --short HEAD)"
  if [ -n "${FVDS_SSH_PASSWORD:-${root:-}}" ]; then
    FVDS_SSH_PASSWORD="${FVDS_SSH_PASSWORD:-${root:-}}" "$ROOT/scripts/publish-compliance-bundle.sh"
  fi
  update_tracker_done "$HEAD"
  exit 0
fi

echo "O-02 blocked: нет ветки на GitHub"
echo "  Вариант A: секрет GITHUB_TOKEN в Environment"
echo "  Вариант B: ./scripts/setup-github-deploy-key.sh → Deploy key + секрет GITHUB_DEPLOY_KEY"
echo "  Вариант C: push с ПК через bundle (docs/PUSH_COMPLIANCE_BRANCH.md)"
exit 1
