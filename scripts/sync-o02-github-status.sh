#!/usr/bin/env bash
# O-02: проверить ветку на GitHub, push если есть токен, обновить трекер.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="${1:-cursor/compliance-p0-4317}"
TRACKER="$ROOT/.cursor/stores/self/strategic-plan-tracker.json"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"

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

if [ -n "$TOKEN" ]; then
  echo "→ remote missing, GITHUB_TOKEN set — push"
  "$ROOT/scripts/github-auth-and-push.sh" "$BRANCH"
  check_remote
  update_tracker_done
  exit 0
fi

echo "O-02 blocked: нет ветки на GitHub и GITHUB_TOKEN не задан"
exit 1
