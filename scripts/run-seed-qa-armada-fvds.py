#!/usr/bin/env python3
"""Windows: seed QA test accounts on VPS (same logic as seed-qa-armada-test-accounts-fvds.sh)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REMOTE = r'''
import json, pathlib, urllib.parse, urllib.request, uuid

QA = {
    "driverName": "Водитель ТЕСТ QA",
    "driverPhone": "+79009009001",
    "driverPin": "9001",
    "vehiclePlate": "А000ТЕ99",
    "vehicleLabel": "Машина ТЕСТ QA",
    "customerName": "Заказчик ТЕСТ QA",
    "portalPhone": "+79009009002",
    "portalPin": "9002",
    "contactName": "Контакт ТЕСТ QA",
}

PB = "http://127.0.0.1:8090"
env = {}
for path in ("/etc/armada/api.env", "/opt/armada-api/.env"):
    p = pathlib.Path(path)
    if not p.exists():
        continue
    for line in p.read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
email = env.get("PB_ADMIN_EMAIL", "")
password = env.get("PB_ADMIN_PASSWORD", "")
if not email or not password:
    raise SystemExit("PB admin creds missing on server")

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
companies = payload.get("companies") or []
spaces = payload.get("spaces") or []
admins = payload.get("admins") or []
drivers = payload.get("drivers") or []
vehicles = payload.get("vehicles") or []

def company_own(c):
    return "own" in (c.get("roles") or [])

arm = None
for co in companies:
    if company_own(co) and "армада" in (co.get("name") or "").lower():
        arm = co
        break
if not arm:
    sp = next((s for s in spaces if "армада" in (s.get("name") or "").lower()), None)
    if sp:
        arm = next((co for co in companies if company_own(co) and co.get("spaceId") == sp.get("id")), None)
if not arm:
    raise SystemExit("ООО Армада not found")

company_id = arm["id"]
space_id = arm.get("spaceId")
company_name = arm.get("name") or "ООО «Армада»"
owner = next((a for a in admins if a.get("spaceId") == space_id and not a.get("isSuper")), None)
if not owner:
    owner = next((a for a in admins if a.get("isSuper")), None)
if not owner:
    raise SystemExit("no admin for armada")

def norm_phone(p):
    d = "".join(ch for ch in str(p) if ch.isdigit())
    if len(d) == 11 and d.startswith("8"):
        d = "7" + d[1:]
    if len(d) == 10:
        d = "7" + d
    return "+" + d if d else str(p).strip()

driver_phone = norm_phone(QA["driverPhone"])
portal_phone = norm_phone(QA["portalPhone"])
changed = False

driver = next((d for d in drivers if d.get("companyId") == company_id and QA["driverName"] in (d.get("name") or "")), None)
if not driver:
    driver = {
        "id": str(uuid.uuid4()),
        "name": QA["driverName"],
        "salaryPercent": 30,
        "phone": driver_phone,
        "pin": QA["driverPin"],
        "exchangeEnabled": False,
        "ownerAdminId": owner.get("id"),
        "ownerAdminName": owner.get("name") or "",
        "spaceId": space_id,
        "companyId": company_id,
        "companyName": company_name,
    }
    drivers.append(driver)
    changed = True
elif driver.get("pin") != QA["driverPin"]:
    driver["pin"] = QA["driverPin"]
    changed = True

plate_up = QA["vehiclePlate"].upper()
vehicle = next((v for v in vehicles if v.get("companyId") == company_id and (v.get("plate") or "").upper() == plate_up), None)
if not vehicle:
    vehicles.append({
        "id": str(uuid.uuid4()),
        "plate": QA["vehiclePlate"],
        "makeModel": QA["vehicleLabel"],
        "consumptionPer100Km": 22,
        "payloadTons": 20,
        "bodyTypeId": "tent",
        "hasTrailer": False,
        "trailerPlate": "",
        "spaceId": space_id,
        "companyId": company_id,
        "companyName": company_name,
        "serviceIntervals": [],
        "maintenanceLogs": [],
        "assignedDriverIds": [],
    })
    changed = True

customer = next(
    (co for co in companies if "customer" in (co.get("roles") or []) and co.get("spaceId") == space_id and "ТЕСТ QA" in (co.get("name") or "")),
    None,
)
if not customer:
    companies.append({
        "id": str(uuid.uuid4()),
        "name": QA["customerName"],
        "roles": ["customer"],
        "spaceId": space_id,
        "inn": "",
        "note": "QA lifecycle · только тесты",
        "portalEnabled": True,
        "portalPhone": portal_phone,
        "portalPin": QA["portalPin"],
        "loadingAddresses": ["Москва, ул. Тестовая, 1"],
        "unloadingAddresses": ["Москва, ул. Выгрузки, 2"],
        "contacts": [{"name": QA["contactName"], "phone": portal_phone, "role": ""}],
        "phones": [portal_phone],
        "vehicles": [],
        "drivers": [],
    })
    changed = True
else:
    customer["portalEnabled"] = True
    customer["portalPhone"] = portal_phone
    customer["portalPin"] = QA["portalPin"]
    changed = True

if changed:
    payload["drivers"] = drivers
    payload["vehicles"] = vehicles
    payload["companies"] = companies
    payload["dataEpoch"] = int(payload.get("dataEpoch") or 0) + 1
    pb("/api/collections/app_state/records/" + rec["id"], "PATCH", {"key": "main", "payload": payload})
    print(json.dumps({"ok": True, "changed": True, "dataEpoch": payload["dataEpoch"], "credentials": QA}, ensure_ascii=False))
else:
    print(json.dumps({"ok": True, "changed": False, "credentials": QA}, ensure_ascii=False))
'''


def load_password() -> str:
    pw = __import__("os").environ.get("FVDS_SSH_PASSWORD") or __import__("os").environ.get("root", "")
    if not pw:
        f = ROOT / ".fvds-ssh-password"
        if f.is_file():
            pw = f.read_text(encoding="utf-8").strip()
    if not pw:
        print("Нет пароля: .fvds-ssh-password", file=sys.stderr)
        sys.exit(1)
    return pw


def main() -> None:
    import paramiko

    host = __import__("os").environ.get("FVDS_HOST", "176.12.67.35")
    user = __import__("os").environ.get("FVDS_USER", "root")
    pw = load_password()
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username=user, password=pw, timeout=120, banner_timeout=120, auth_timeout=120)
    _, out, err = c.exec_command("python3 <<'IN'\n" + REMOTE + "\nIN", timeout=120)
    text = out.read().decode("utf-8", "replace").strip()
    err_text = err.read().decode("utf-8", "replace").strip()
    c.close()
    if err_text:
        print(err_text, file=sys.stderr)
    print(text)
    if not text or '"ok": true' not in text.replace(" ", "").lower() and '"ok":true' not in text.replace(" ", ""):
        sys.exit(1)


if __name__ == "__main__":
    main()
