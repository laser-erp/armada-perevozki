#!/usr/bin/env bash
# Снять ложное «закрытие» с заявок портала без назначенного водителя/ТС.
# Usage: FVDS_SSH_PASSWORD=… ./scripts/heal-false-closed-orders-fvds.sh
set -euo pipefail
HOST="${FVDS_HOST:-176.12.67.35}"
USER="${FVDS_USER:-root}"
PASS="${FVDS_SSH_PASSWORD:-${root:-}}"

if [ -z "$PASS" ]; then
  echo "Нужен пароль VPS: FVDS_SSH_PASSWORD или переменная root"
  exit 1
fi

python3 - "$USER" "$HOST" "$PASS" <<'PY'
import sys, json, paramiko, urllib.request
user, host, pw = sys.argv[1:4]
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=pw, timeout=30)

def run(cmd):
    _, out, err = c.exec_command(cmd)
    return out.read().decode() + err.read().decode()

patch = r'''
import json, urllib.request, urllib.parse, pathlib

PB = "http://127.0.0.1:8090"
env = {}
for path in ("/etc/armada/api.env", "/opt/armada-api/.env"):
    if not pathlib.Path(path).exists():
        continue
    for line in pathlib.Path(path).read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()

email = env.get("PB_ADMIN_EMAIL", "")
password = env.get("PB_ADMIN_PASSWORD", "")
if not email or not password:
    raise SystemExit("PB admin creds missing")

req = urllib.request.Request(
    PB + "/api/collections/_superusers/auth-with-password",
    data=json.dumps({"identity": email, "password": password}).encode(),
    headers={"Content-Type": "application/json", "Accept": "application/json"},
    method="POST",
)
token = json.load(urllib.request.urlopen(req))["token"]

def pb(path, method="GET", body=None):
    headers = {"Authorization": token, "Accept": "application/json"}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    req = urllib.request.Request(PB + path, data=data, headers=headers, method=method)
    return json.load(urllib.request.urlopen(req))

recs = pb("/api/collections/app_state/records?filter=" + urllib.parse.quote("key='main'") + "&perPage=1")
rec = recs["items"][0]
payload = rec.get("payload") or {}
orders = payload.get("orders") or []

def waiting(name):
    n = (name or "").strip()
    return not n or n in ("—", "-", "Биржа", "Диспетчер")

def keeps(o):
    return bool(o.get("customerSubmitted") or o.get("executorType") == "logist" or o.get("fulfillment") in ("logist", "direct"))

def unassigned(o):
    if not o or o.get("cancelledAt"):
        return False
    if not keeps(o):
        return False
    if not waiting(o.get("driverName")):
        return False
    return o.get("startOdometer") is None and o.get("departOdometer") is None

fixed = []
for o in orders:
    if not unassigned(o):
        continue
    bad = o.get("closedAt") or o.get("endOdometer") is not None or o.get("loadedKm") is not None or o.get("emptyKmAfter") is not None
    if not bad:
        continue
    for k in ("closedAt", "endAt", "parkingAt", "endOdometer", "loadedKm", "emptyKmAfter", "departOdometer", "startOdometer"):
        if o.get(k) is not None:
            o[k] = None
    fixed.append(o.get("sequentialNumber"))

if not fixed:
    print("heal: nothing to fix")
else:
    payload["dataEpoch"] = int(payload.get("dataEpoch") or 0) + 1
    pb("/api/collections/app_state/records/" + rec["id"], "PATCH", {"key": "main", "payload": payload})
    print("heal: fixed orders", fixed, "dataEpoch", payload["dataEpoch"])
'''
run("python3 <<'IN'\n" + patch + "\nIN")
c.close()
PY

echo "Готово."
