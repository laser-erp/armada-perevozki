#!/usr/bin/env bash
# armada-api: GET/PUT /epd/space/:spaceId + stub sign endpoints (этапы 2–3 skeleton).
# Usage: FVDS_SSH_PASSWORD=… ./scripts/patch-armada-api-epd-routes.sh
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
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username=user, password=pw, timeout=30)

def run(cmd):
    _, out, err = c.exec_command(cmd)
    code = out.channel.recv_exit_status()
    text = out.read().decode() + err.read().decode()
    if code != 0:
        raise SystemExit(f"cmd failed ({code}): {cmd}\n{text}")
    return text

patch = r'''
import pathlib
path = pathlib.Path("/opt/armada-api/src/server.js")
text = path.read_text()
marker = "const VERSION = '0.4.3-etrn-tariff';"
if '/epd/space/:spaceId' in text:
    print('PATCH epd routes already applied')
else:
    if marker not in text:
        raise SystemExit('version marker not found')
    insert_after = marker
    block = """

const epdBySpaceStore = new Map();

function defaultEpdSpaceRecord(spaceId){
  return {
    operator: process.env.EPD_OPERATOR || 'kontur',
    sandbox: EPD_SANDBOX,
    orgInn: '',
    boxId: '',
    status: 'pending',
    connectedAt: null,
    lastError: ''
  };
}

function normalizeEpdSpaceRecord(rec, spaceId){
  const base = defaultEpdSpaceRecord(spaceId);
  const next = Object.assign(base, rec || {});
  const boxId = String(next.boxId || '').trim();
  if(boxId && next.status === 'pending') next.status = 'connected';
  if(boxId && !next.connectedAt) next.connectedAt = new Date().toISOString();
  return next;
}"""
    text = text.replace(insert_after, insert_after + block, 1)
    routes = """
app.get('/epd/space/:spaceId', { preHandler: authHook }, async (req) => {
  const spaceId = req.params.spaceId;
  const epd = normalizeEpdSpaceRecord(epdBySpaceStore.get(spaceId), spaceId);
  return { spaceId, epd };
});

app.put('/epd/space/:spaceId', { preHandler: authHook }, async (req) => {
  const spaceId = req.params.spaceId;
  const body = req.body || {};
  const prev = epdBySpaceStore.get(spaceId) || {};
  const epd = normalizeEpdSpaceRecord(Object.assign({}, prev, body), spaceId);
  epdBySpaceStore.set(spaceId, epd);
  try { await logOpsToAppState('epd-space', `boxId ${spaceId}`, { spaceId, boxId: epd.boxId || '' }); } catch(_){}
  return { ok: true, spaceId, epd };
});

app.post('/epd/sign-up-url', { preHandler: authHook }, async (req) => {
  const body = req.body || {};
  const role = body.role || 'carrier';
  const entityId = body.entityId || '';
  const base = body.returnUrl || 'https://app.armada.sx/a/';
  const url = `${base}${base.includes('?') ? '&' : '?'}epd-sign-stub=1&role=${encodeURIComponent(role)}&entityId=${encodeURIComponent(entityId)}`;
  return { url, stub: true, sandbox: EPD_SANDBOX };
});

app.post('/epd/titul-sign-url', { preHandler: authHook }, async (req) => {
  const body = req.body || {};
  const orderId = body.orderId || '';
  const titul = body.titul || 't2';
  const url = `sandbox://etrn/sign/${orderId}/${titul}`;
  return { url, stub: true, sandbox: EPD_SANDBOX, orderId, titul };
});

app.get('/epd/sign-status', { preHandler: authHook }, async (req) => {
  const role = req.query.role || 'carrier';
  const entityId = req.query.entityId || '';
  return { status: 'none', stub: true, sandbox: EPD_SANDBOX, role, entityId };
});
"""
    anchor = "app.listen({ port: PORT, host: '0.0.0.0' })"
    if anchor not in text:
        raise SystemExit('listen anchor not found')
    text = text.replace(anchor, routes + "\n" + anchor, 1)
    text = text.replace("const VERSION = '0.4.3-etrn-tariff';", "const VERSION = '0.4.4-epd-space-stub';", 1)
    path.write_text(text)
    print('PATCH epd routes OK')

'''
run("python3 <<'IN'\n" + patch + "\nIN")
print(run("systemctl restart armada-api && sleep 2 && curl -fsS http://127.0.0.1:8091/health | head -c 200"))
print(run("curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8091/epd/space/test-space"))
print(run("curl -sS -X POST http://127.0.0.1:8091/epd/sign-up-url -H 'Content-Type: application/json' -d '{\"role\":\"carrier\",\"entityId\":\"x\"}' | head -c 120"))
c.close()
PY

echo "Готово. Проверка: curl https://app.armada.sx/armada-api/epd/space/test"
