#!/usr/bin/env bash
# armada-api (Fastify): разрешить POST /orders/:id/etrn для открытых заказов (водитель+ТС, в пути).
# Было: order_not_closed / "ETRN only after order close" — устарело (ЭТрН при выезде).
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
import sys, paramiko
user, host, pw = sys.argv[1:4]
path = "/opt/armada-api/src/server.js"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=pw, timeout=30)

def run(cmd):
    _, out, err = c.exec_command(cmd)
    return out.read().decode() + err.read().decode()

patch = r'''
import pathlib
path = pathlib.Path("/opt/armada-api/src/server.js")
text = path.read_text()
orig = text

fn_old = """function looksClosed(order){
  return !!(order?.closedAt || (order?.endOdometer != null && order?.startOdometer != null));
}"""
fn_new = fn_old + """

function orderEligibleForEtrn(order){
  if(!order || order.cancelledAt) return false;
  const drv=String(order.driverName||'').trim();
  const plate=String(order.vehiclePlate||'').trim();
  if(!drv || !plate || drv==='—' || plate==='—') return false;
  if(drv==='Диспетчер' || drv==='Биржа' || drv.startsWith('[Перевозчик]')) return false;
  return true;
}"""

check_old = """  if(!looksClosed(order)){
    return reply.code(400).send({ error: 'order_not_closed', hint: 'ETRN only after order close' });
  }"""
check_new = """  if(!orderEligibleForEtrn(order)){
    return reply.code(400).send({ error: 'order_not_eligible', hint: 'Assign driver and vehicle before ETRN' });
  }"""

if 'orderEligibleForEtrn' in text and 'order_not_closed' not in text:
    print('PATCH etrn already applied')
elif fn_old not in text or check_old not in text:
    raise SystemExit('ETRN patch patterns not found — inspect server.js manually')
else:
    text = text.replace(fn_old, fn_new, 1).replace(check_old, check_new, 1)
    path.write_text(text)
    print('PATCH etrn open-order OK')
'''
run("python3 <<'IN'\n" + patch + "\nIN")
print(run("systemctl restart armada-api && sleep 2 && curl -fsS -X POST http://127.0.0.1:8091/orders/patch-smoke/etrn -H 'Content-Type: application/json' -d '{\"order\":{\"id\":\"patch-smoke\",\"driverName\":\"Test\",\"vehiclePlate\":\"A 111 AA 47\"},\"spaceId\":\"x\"}' | head -c 120"))
c.close()
PY

echo "Готово. Открытый заказ с водителем и ТС должен вернуть etrn, не order_not_closed."
