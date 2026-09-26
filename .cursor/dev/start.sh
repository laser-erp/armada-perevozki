#!/usr/bin/env bash
# Per-boot reconciliation for the ARMADA dev stack.
# Points the app's production hostname at localhost so ALL API/sync traffic goes
# to the local PocketBase instead of the client's live server. This must run
# every boot because /etc/hosts is not part of the persisted disk state.
set -euo pipefail

mkdir -p "$HOME/devstack/pb_data"

if ! grep -q "aptown1.fvds.ru" /etc/hosts; then
	echo "127.0.0.1 aptown1.fvds.ru 176.12.67.35" | sudo tee -a /etc/hosts >/dev/null
fi

echo "hosts override:"
getent hosts aptown1.fvds.ru

# Общая dev-ветка (локальный + облачный агент). См. scripts/GIT_ONE_BRANCH.md
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
	git fetch origin cursor/dev-f6d2 2>/dev/null || true
	cur="$(git branch --show-current 2>/dev/null || true)"
	if [ "$cur" != "cursor/dev-f6d2" ] && git show-ref --verify --quiet refs/remotes/origin/cursor/dev-f6d2; then
		if git checkout cursor/dev-f6d2 2>/dev/null; then
			git pull --ff-only origin cursor/dev-f6d2 2>/dev/null || true
			echo "git: on cursor/dev-f6d2"
		fi
	fi
fi
