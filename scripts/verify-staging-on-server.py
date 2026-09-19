#!/usr/bin/env python3
"""Проверка staging на VPS (без вывода пароля)."""
import os
import sys

import paramiko

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pw_file = os.path.join(ROOT, ".fvds-ssh-password")
host = os.environ.get("FVDS_HOST", "176.12.67.35")
user = os.environ.get("FVDS_USER", "root")

if not os.path.isfile(pw_file):
    print("NO_PASSWORD_FILE")
    sys.exit(2)

password = open(pw_file, encoding="utf-8").read().strip()
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    c.connect(
        host,
        username=user,
        password=password,
        timeout=60,
        banner_timeout=60,
        auth_timeout=60,
    )
except Exception as e:
    print("SSH_FAIL:", type(e).__name__, str(e)[:120])
    sys.exit(1)

cmds = [
    "test -d /var/www/armada-staging && echo STAGING_DIR=yes || echo STAGING_DIR=no",
    "grep -m1 APP_BUILD /var/www/armada-staging/store.js 2>/dev/null || echo STAGING_BUILD=missing",
    "grep -m1 APP_BUILD /var/www/armada/store.js 2>/dev/null || echo PROD_BUILD=missing",
    "grep -c armada_staging /etc/caddy/Caddyfile 2>/dev/null || echo 0",
]
for cmd in cmds:
    _, out, _ = c.exec_command(cmd)
    line = out.read().decode().strip()
    print(line)
c.close()
print("SSH_OK")
