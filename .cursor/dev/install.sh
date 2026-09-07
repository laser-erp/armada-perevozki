#!/usr/bin/env bash
# Idempotent dependency setup for the ARMADA local dev stack.
# Downloads pinned Caddy + PocketBase binaries into ~/.local/bin (persisted in
# the environment snapshot) and prepares the PocketBase data directory.
set -euo pipefail

BIN="$HOME/.local/bin"
PB_VER="0.40.3"
CADDY_VER="2.11.4"
mkdir -p "$BIN" "$HOME/devstack/pb_data"

if [ ! -x "$BIN/pocketbase" ]; then
	tmp="$(mktemp -d)"
	curl -sSL -o "$tmp/pb.zip" \
		"https://github.com/pocketbase/pocketbase/releases/download/v${PB_VER}/pocketbase_${PB_VER}_linux_amd64.zip"
	unzip -o "$tmp/pb.zip" pocketbase -d "$BIN" >/dev/null
	rm -rf "$tmp"
fi

if [ ! -x "$BIN/caddy" ]; then
	tmp="$(mktemp -d)"
	curl -sSL -o "$tmp/caddy.tar.gz" \
		"https://github.com/caddyserver/caddy/releases/download/v${CADDY_VER}/caddy_${CADDY_VER}_linux_amd64.tar.gz"
	tar -xzf "$tmp/caddy.tar.gz" -C "$BIN" caddy
	rm -rf "$tmp"
fi

chmod +x "$BIN/pocketbase" "$BIN/caddy"
"$BIN/pocketbase" --version
"$BIN/caddy" version
