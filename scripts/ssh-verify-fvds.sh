#!/usr/bin/env bash
# SSH smoke на VPS: caddy, armada-api 8091, kp/invite.
# Пароль: FVDS_SSH_PASSWORD, секрет Cloud `root`, или SSH-ключ.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${FVDS_HOST:-176.12.67.35}"
USER="${FVDS_USER:-root}"
PASS="${FVDS_SSH_PASSWORD:-${root:-}}"
FAIL=0

pass() { echo "  OK  $1"; }
fail() { echo "  FAIL $1"; FAIL=1; }

if [ -z "$PASS" ] && command -v sshpass >/dev/null 2>&1; then
  echo "Нет пароля (FVDS_SSH_PASSWORD / root). Пробуем SSH-ключ…"
fi

run_remote() {
  if [ -n "$PASS" ] && command -v sshpass >/dev/null 2>&1; then
    sshpass -p "$PASS" ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 "$USER@$HOST" "$@"
  elif [ -n "$PASS" ]; then
    python3 - "$USER" "$HOST" "$PASS" "$@" <<'PY'
import sys, paramiko
user, host, pw = sys.argv[1], sys.argv[2], sys.argv[3]
cmd = sys.argv[4]
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=pw, timeout=20)
_, out, err = c.exec_command(cmd)
sys.stdout.write(out.read().decode())
sys.stderr.write(err.read().decode())
c.close()
PY
  else
    ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 "$USER@$HOST" "$@"
  fi
}

echo "SSH verify $USER@$HOST"

CADDY="$(run_remote 'systemctl is-active caddy 2>/dev/null || true')"
if [ "$CADDY" = "active" ]; then pass "caddy active"; else fail "caddy ($CADDY)"; fi

HEALTH="$(run_remote 'curl -fsS http://127.0.0.1:8091/health 2>/dev/null || echo FAIL')"
if echo "$HEALTH" | grep -q '"ok":true'; then pass "armada-api health"; else fail "armada-api health"; fi
if echo "$HEALTH" | grep -q 'armada-api'; then pass "armada-api service"; else fail "armada-api service name"; fi

for f in kp.html invite.html onboarding.js help.html; do
  if run_remote "test -f /var/www/armada/$f && echo ok" | grep -q ok; then pass "$f on server"; else fail "$f on server"; fi
done

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "SSH VERIFY PASS"
  exit 0
fi
echo "SSH VERIFY FAIL"
exit 1
