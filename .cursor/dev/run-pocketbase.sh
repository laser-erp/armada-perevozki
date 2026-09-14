#!/usr/bin/env bash
# Local PocketBase backend for the ARMADA PWA (mirrors production /api and /_).
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
HERE="$(cd "$(dirname "$0")" && pwd)"
exec pocketbase serve \
	--dir "$HOME/devstack/pb_data" \
	--migrationsDir "$HERE/pb_migrations" \
	--http 127.0.0.1:8090
