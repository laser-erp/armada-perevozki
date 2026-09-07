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
