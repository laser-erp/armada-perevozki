#!/usr/bin/env bash
# armada-api: разрешить POST /orders/:id/etrn для открытых заказов (водитель+ТС, в пути).
# Сейчас API отвечает order_not_closed / "ETRN only after order close" — устарело (ЭТрН при выезде).
# Usage: FVDS_SSH_PASSWORD=… ./scripts/fix-armada-api-etrn-open-order.sh
set -euo pipefail
HOST="${FVDS_HOST:-176.12.67.35}"
USER="${FVDS_USER:-root}"
PASS="${FVDS_SSH_PASSWORD:-${root:-}}"

if [ -z "$PASS" ]; then
  echo "Нужен пароль VPS: FVDS_SSH_PASSWORD или переменная root"
  exit 1
fi

python3 - "$USER" "$HOST" "$PASS" <<'PY'
import sys, paramiko, re
user, host, pw = sys.argv[1:4]
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=pw, timeout=30)

def run(cmd):
    _, out, err = c.exec_command(cmd)
    text = out.read().decode() + err.read().decode()
    return text

patch = r'''
import pathlib, re
path = pathlib.Path("/opt/armada-api/src/server.js")
text = path.read_text()
orig = text

# Убрать жёсткое требование closedAt для создания ЭТрН
text = text.replace(
    'hint: "ETRN only after order close"',
    'hint: "ETRN requires driver and vehicle on open order"'
)
text = re.sub(
    r"if\s*\(\s*!orderClosedForEtrn\s*\(\s*order\s*\)\s*\)\s*\{\s*return\s+res\.status\(400\)\.json\(\{\s*error:\s*['\"]order_not_closed['\"][^}]*\}\);\s*\}",
    "if (!orderEligibleForEtrn(order)) { return res.status(400).json({ error: 'order_not_eligible', hint: 'Assign driver and vehicle before ETRN' }); }",
    text,
    count=1,
)
text = re.sub(
    r"function\s+orderClosedForEtrn\s*\(\s*order\s*\)\s*\{[^}]+\}",
    """function orderEligibleForEtrn(order) {
  if (!order || order.cancelledAt) return false;
  const drv = String(order.driverName || '').trim();
  const plate = String(order.vehiclePlate || '').trim();
  if (!drv || !plate || drv === '—' || plate === '—') return false;
  if (drv === 'Диспетчер' || drv === 'Биржа') return false;
  return true;
}""",
    text,
    count=1,
)

if text == orig:
    if 'orderEligibleForEtrn' in text and 'order_not_closed' not in text:
        print('PATCH etrn already applied')
    else:
        raise SystemExit('ETRN patch patterns not found — inspect /opt/armada-api/src/server.js manually')
else:
    path.write_text(text)
    print('PATCH etrn open-order OK')
'''
run("python3 <<'IN'\n" + patch + "\nIN")
print(run("systemctl restart armada-api && sleep 2 && curl -fsS -X POST http://127.0.0.1:8091/orders/patch-smoke/etrn -H 'Content-Type: application/json' -d '{\"order\":{\"id\":\"patch-smoke\",\"driverName\":\"Test\",\"vehiclePlate\":\"A 111 AA 47\"},\"spaceId\":\"x\"}' | head -c 200"))
c.close()
PY

echo "Готово. Открытый заказ без closedAt должен вернуть etrn, не order_not_closed."
