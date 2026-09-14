#!/usr/bin/env bash
# Local Caddy front door: serves web-preview/ and proxies /api + /_ to PocketBase.
# Open the app at http://aptown1.fvds.ru:8080/ (the hosts override points that
# name at localhost, so the app treats this local stack as its origin).
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
HERE="$(cd "$(dirname "$0")" && pwd)"
export ARMADA_WEB_ROOT="${ARMADA_WEB_ROOT:-$(cd "$HERE/../.." && pwd)/web-preview}"
exec caddy run --config "$HERE/Caddyfile" --adapter caddyfile
