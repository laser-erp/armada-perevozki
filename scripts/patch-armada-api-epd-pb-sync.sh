#!/usr/bin/env bash
# armada-api: epdBySpace GET/PUT через PocketBase app_state (не только in-memory Map).
# Usage: FVDS_SSH_PASSWORD=… ./scripts/patch-armada-api-epd-pb-sync.sh
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

sync_patch = r'''
import pathlib
path = pathlib.Path("/opt/armada-api/src/epd/syncToState.js")
text = path.read_text()
if "fetchEpdSpaceFromState" in text:
    print("syncToState epd already patched")
else:
    block = """

function normalizeEpdSpaceRecord(rec, spaceId){
  const boxId = String(rec?.boxId || '').trim();
  let status = rec?.status;
  if (!['pending', 'connected', 'error'].includes(status)) status = boxId ? 'connected' : 'pending';
  return {
    operator: String(rec?.operator || process.env.EPD_OPERATOR || 'kontur').trim() || 'kontur',
    sandbox: rec?.sandbox != null ? !!rec.sandbox : (process.env.EPD_SANDBOX === 'true' || !process.env.EPD_API_KEY),
    orgInn: String(rec?.orgInn || '').replace(/\\D/g, ''),
    boxId,
    status,
    connectedAt: rec?.connectedAt || null,
    lastError: rec?.lastError ? String(rec.lastError) : ''
  };
}

/** Read epdBySpace[spaceId] from PocketBase app_state. */
export async function fetchEpdSpaceFromState(spaceId){
  if(!pbConfigured() || !spaceId) return null;
  const rec = await fetchMainStateRecord();
  const epdBySpace = rec?.payload?.epdBySpace;
  if(!epdBySpace || typeof epdBySpace !== 'object') return normalizeEpdSpaceRecord(null, spaceId);
  return normalizeEpdSpaceRecord(epdBySpace[spaceId], spaceId);
}

/** Merge epdBySpace[spaceId] into PocketBase app_state. */
export async function saveEpdSpaceToState(spaceId, patch = {}){
  if(!pbConfigured() || !spaceId) return { ok: false, error: 'pb_not_configured' };
  const rec = await fetchMainStateRecord();
  if(!rec?.payload) return { ok: false, error: 'no_state' };
  const payload = structuredClone(rec.payload);
  if(!payload.epdBySpace || typeof payload.epdBySpace !== 'object') payload.epdBySpace = {};
  const prev = payload.epdBySpace[spaceId] || {};
  const next = normalizeEpdSpaceRecord(Object.assign({}, prev, patch), spaceId);
  if(patch.boxId !== undefined && next.boxId && !next.connectedAt) next.connectedAt = new Date().toISOString();
  payload.epdBySpace[spaceId] = next;
  payload.dataEpoch = (Number(payload.dataEpoch) || 0) + 1;
  await patchStateRecord(rec.id, { key: 'main', payload });
  return { ok: true, epd: next, dataEpoch: payload.dataEpoch };
}
"""
    text = text.rstrip() + block
    path.write_text(text)
    print("PATCH syncToState epd OK")
'''

server_patch = r'''
import pathlib, re
path = pathlib.Path("/opt/armada-api/src/server.js")
text = path.read_text()
if "fetchEpdSpaceFromState" in text:
    print("server.js epd pb already patched")
else:
    if "from './epd/syncToState.js'" not in text:
        text = text.replace(
            "import { logOpsToAppState } from './epd/syncToState.js';",
            "import { logOpsToAppState, fetchEpdSpaceFromState, saveEpdSpaceToState } from './epd/syncToState.js';"
        )
    else:
        text = re.sub(
            r"import \{([^}]*)\} from '\./epd/syncToState\.js';",
            lambda m: "import {" + (m.group(1) + ", fetchEpdSpaceFromState, saveEpdSpaceToState").strip(", ") + "} from './epd/syncToState.js';"
            if "fetchEpdSpaceFromState" not in m.group(1) else m.group(0),
            text,
            count=1
        )
    old_get = """app.get('/epd/space/:spaceId', { preHandler: authHook }, async (req) => {
  const spaceId = req.params.spaceId;
  const epd = normalizeEpdSpaceRecord(epdBySpaceStore.get(spaceId), spaceId);
  return { spaceId, epd };
});"""
    new_get = """app.get('/epd/space/:spaceId', { preHandler: authHook }, async (req) => {
  const spaceId = req.params.spaceId;
  let epd = null;
  try { epd = await fetchEpdSpaceFromState(spaceId); } catch (err) { app.log.warn(err, 'epd space fetch'); }
  if(!epd) epd = normalizeEpdSpaceRecord(epdBySpaceStore.get(spaceId), spaceId);
  else epdBySpaceStore.set(spaceId, epd);
  return { spaceId, epd };
});"""
    old_put = """app.put('/epd/space/:spaceId', { preHandler: authHook }, async (req) => {
  const spaceId = req.params.spaceId;
  const body = req.body || {};
  const prev = epdBySpaceStore.get(spaceId) || {};
  const epd = normalizeEpdSpaceRecord(Object.assign({}, prev, body), spaceId);
  epdBySpaceStore.set(spaceId, epd);
  try { await logOpsToAppState('epd-space', `boxId ${spaceId}`, { spaceId, boxId: epd.boxId || '' }); } catch(_){}
  return { ok: true, spaceId, epd };
});"""
    new_put = """app.put('/epd/space/:spaceId', { preHandler: authHook }, async (req) => {
  const spaceId = req.params.spaceId;
  const body = req.body || {};
  let epd = null;
  try {
    const saved = await saveEpdSpaceToState(spaceId, body);
    if(saved?.ok && saved.epd) epd = saved.epd;
  } catch (err) { app.log.warn(err, 'epd space save pb'); }
  if(!epd){
    const prev = epdBySpaceStore.get(spaceId) || {};
    epd = normalizeEpdSpaceRecord(Object.assign({}, prev, body), spaceId);
    epdBySpaceStore.set(spaceId, epd);
  } else {
    epdBySpaceStore.set(spaceId, epd);
  }
  try { await logOpsToAppState('epd-space', `boxId ${spaceId}`, { spaceId, boxId: epd.boxId || '' }); } catch(_){}
  return { ok: true, spaceId, epd };
});"""
    if old_get not in text or old_put not in text:
        raise SystemExit('epd route patterns not found')
    text = text.replace(old_get, new_get, 1).replace(old_put, new_put, 1)
    text = text.replace("const VERSION = '0.4.4-epd-space-stub';", "const VERSION = '0.4.5-epd-pb-sync';")
    path.write_text(text)
    print("PATCH server.js epd pb OK")
'''

run("python3 <<'IN'\n" + sync_patch + "\nIN")
run("python3 <<'IN'\n" + server_patch + "\nIN")
print(run("systemctl restart armada-api && sleep 2 && curl -fsS http://127.0.0.1:8787/health 2>/dev/null || curl -fsS http://127.0.0.1:8091/health | head -c 200"))
c.close()
PY

echo "Готово. epdBySpace сохраняется в PocketBase через PUT /epd/space/:id"
