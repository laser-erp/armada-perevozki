#!/usr/bin/env bash
# Сброс PIN супер-админа в PocketBase (main app_state) на recovery-код 45680.
# Usage: ./scripts/reset-super-admin-pin-fvds.sh
set -euo pipefail
HOST="${FVDS_HOST:-176.12.67.35}"
USER="${FVDS_USER:-root}"
PASS="${FVDS_SSH_PASSWORD:-${root:-}}"
PIN="${SUPER_ADMIN_RECOVERY_PIN:-45680}"

if [ -z "$PASS" ]; then
  echo "Нужен пароль VPS: FVDS_SSH_PASSWORD или переменная root"
  exit 1
fi

python3 - "$USER" "$HOST" "$PASS" "$PIN" <<'PY'
import sys, json, paramiko
user, host, pw, pin = sys.argv[1:5]
db = '/opt/pocketbase/pb_data/data.db'
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=pw, timeout=30)
inner = f"""
import sqlite3, json
pin = {json.dumps(pin)}
conn = sqlite3.connect({json.dumps(db)})
cur = conn.cursor()
cur.execute("SELECT id, payload FROM app_state WHERE key='main'")
row = cur.fetchone()
if not row:
    print('NO_MAIN_RECORD')
    raise SystemExit(1)
rid, raw = row
p = json.loads(raw) if isinstance(raw, str) else raw
settings = p.get('settings') if isinstance(p.get('settings'), dict) else {{}}
settings.pop('superPinChangedByUser', None)
settings['superPinRecoveryNotice'] = 'Временный PIN супер-админа: ' + pin + ' — смените в «Активность» после входа.'
p['settings'] = settings
admins = list(p.get('admins') or [])
found = False
for a in admins:
    if a.get('id') == 'admin-super' or a.get('isSuper'):
        a['id'] = 'admin-super'
        a['name'] = 'Наволоцкий Е.Н.'
        a['isSuper'] = True
        a['pin'] = pin
        a['mustChangePin'] = True
        found = True
        break
if not found:
    admins.append({{'id':'admin-super','name':'Наволоцкий Е.Н.','pin':pin,'isSuper':True,'mustChangePin':True}})
p['admins'] = admins
p['dataEpoch'] = int(p.get('dataEpoch') or 0) + 1
cur.execute('UPDATE app_state SET payload=? WHERE id=?', (json.dumps(p, ensure_ascii=False), rid))
conn.commit()
conn.close()
print('OK', pin, 'dataEpoch', p['dataEpoch'])
"""
cmd = "python3 <<'IN'\n" + inner + "\nIN"
_, out, err = c.exec_command(cmd)
text = out.read().decode() + err.read().decode()
print(text.strip())
if 'OK' not in text:
    raise SystemExit(1)
_, out2, _ = c.exec_command('systemctl restart armada-api && sleep 2 && curl -fsS http://127.0.0.1:8091/health >/dev/null && echo API_RESTART_OK')
print(out2.read().decode().strip())
c.close()
PY

echo "PIN супер-админа на сервере: $PIN"
echo "Вход: https://app.armada.sx/a/?recover=super"
