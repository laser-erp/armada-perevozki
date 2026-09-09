#!/usr/bin/env bash
# Краткий статус §4 из JSON-трекера.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TRACKER="$ROOT/.cursor/stores/self/strategic-plan-tracker.json"
if [ ! -f "$TRACKER" ]; then
  echo "Нет $TRACKER"
  exit 1
fi
python3 - "$TRACKER" <<'PY'
import json, sys
t = json.load(open(sys.argv[1]))
print(f"Plan: {t.get('plan')} | branch: {t.get('branch')}")
print(f"Updated: {t.get('updatedAt')}")
prod = t.get('production', {})
print(f"Prod: {prod.get('url')} build={prod.get('build')}")
for k in ['lastSmoke', 'lastProdSync', 'lastServerVerify']:
    v = t.get(k, {})
    if v:
        print(f"{k}: {v.get('result', v.get('at', ''))} @ {v.get('at', '')}")
gh = t.get('deploy', {}).get('githubRemote', {})
print(f"GitHub: {gh.get('status')} head={gh.get('headCommit')} api={gh.get('githubApi')}")
print("Stages:")
for sid, s in t.get('stages', {}).items():
    print(f"  {sid}: {s.get('status')} — {s.get('title', sid)}")
o02 = t.get('ops', {}).get('O-02', {})
if o02:
    print(f"O-02: {o02.get('status')} — {o02.get('notes', '')}")
PY
