#!/usr/bin/env bash
# OAuth Контур: /oauth/kontur/start + /oauth/kontur/callback → boxId в PocketBase.
# Usage: FVDS_SSH_PASSWORD=… ./scripts/patch-armada-api-kontur-oauth.sh
set -euo pipefail
HOST="${FVDS_HOST:-176.12.67.35}"
USER="${FVDS_USER:-root}"
PASS="${FVDS_SSH_PASSWORD:-${root:-}}"

if [ -z "$PASS" ]; then
  echo "Нужен пароль VPS: FVDS_SSH_PASSWORD или переменная root"
  exit 1
fi

python3 - "$USER" "$HOST" "$PASS" <<'PY'
import sys, paramiko, textwrap
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

oauth_js = r'''/**
 * Kontur OAuth (Authorization Code) → boxId через GetMyOrganizations.
 */
const IDENTITY = 'https://identity.kontur.ru';
const DIADOC_PRIMARY = (process.env.EPD_API_URL || 'https://diadoc-api.kontur.ru').replace(/\/$/, '');
const DIADOC_FALLBACK = DIADOC_PRIMARY.includes('testkontur')
  ? 'https://diadoc-api.kontur.ru'
  : 'https://diadoc-api.testkontur.ru';
const CLIENT_ID = process.env.KONTUR_API_CLIENT_ID || 'ci_7802655283_ooo_armada';
const CLIENT_SECRET = process.env.KONTUR_API_CLIENT_SECRET || process.env.EPD_API_KEY || '';
const REDIRECT_URI = process.env.KONTUR_REDIRECT_URI || 'https://app.armada.sx/armada-api/oauth/kontur/callback';
// Diadoc.PublicAPI.Staging в scope ломает authorize (unauthorized_client) — только Diadoc.PublicAPI.
const SCOPE = process.env.KONTUR_OAUTH_SCOPE || 'openid profile email offline_access Diadoc.PublicAPI';
const TARGET_INN = String(process.env.KONTUR_ORG_INN || '7802655283').replace(/\D/g, '');

export function konturOAuthConfigured(){
  return !!(CLIENT_ID && CLIENT_SECRET);
}

export function buildAuthorizeUrl(state){
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPE,
    redirect_uri: REDIRECT_URI,
    nonce: String(Date.now()),
    state: state || 'armada'
  });
  return `${IDENTITY}/connect/authorize?${q.toString()}`;
}

export async function exchangeCode(code){
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: String(code || ''),
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI
  });
  const res = await fetch(`${IDENTITY}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok){
    const msg = data.error_description || data.error || `token HTTP ${res.status}`;
    const err = new Error(msg);
    err.data = data;
    throw err;
  }
  return data;
}

export async function fetchBoxIdForInn(accessToken, inn){
  const res = await fetch(`${DIADOC}/GetMyOrganizations`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json; charset=utf-8'
    }
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok){
    throw new Error(data.message || data.error || `GetMyOrganizations HTTP ${res.status}`);
  }
  const orgs = Array.isArray(data.Organizations) ? data.Organizations : [];
  const want = String(inn || TARGET_INN).replace(/\D/g, '');
  const org = orgs.find(o => String(o.Inn || '').replace(/\D/g, '') === want) || orgs[0];
  if(!org) throw new Error(`Организация с ИНН ${want || TARGET_INN} не найдена в GetMyOrganizations`);
  const box = (org.Boxes || [])[0];
  if(!box?.BoxIdGuid) throw new Error('BoxIdGuid не найден у организации');
  return {
    boxId: String(box.BoxIdGuid).trim(),
    orgInn: String(org.Inn || '').replace(/\D/g, ''),
    orgName: org.ShortName || org.FullName || ''
  };
}
'''

run("mkdir -p /opt/armada-api/src/epd")
sftp = c.open_sftp()
with sftp.open('/opt/armada-api/src/epd/konturOAuth.js', 'w') as f:
    f.write(oauth_js)
sftp.close()

path = '/opt/armada-api/src/server.js'
text = run(f"cat {path}")
if "/oauth/kontur/callback" in text:
    print('PATCH kontur oauth already applied')
else:
    if "import { pbConfigured } from './pb.js';" not in text:
        raise SystemExit('import marker not found')
    text = text.replace(
        "import { pbConfigured } from './pb.js';",
        "import { pbConfigured, fetchMainStateRecord } from './pb.js';\nimport { buildAuthorizeUrl, exchangeCode, fetchBoxIdForInn, konturOAuthConfigured } from './epd/konturOAuth.js';",
        1
    )
    text = text.replace(
        "const VERSION = '0.4.5-epd-pb-sync';",
        "const VERSION = '0.4.6-kontur-oauth';",
        1
    )
    block = r'''

app.get('/oauth/kontur/start', async (req, reply) => {
  if(!konturOAuthConfigured()){
    return reply.code(503).type('text/html; charset=utf-8').send('<h1>Контур OAuth</h1><p>Нет KONTUR_API_CLIENT_ID / EPD_API_KEY на сервере.</p>');
  }
  const spaceId = String(req.query.spaceId || '').trim();
  const state = spaceId ? `space:${spaceId}` : 'armada';
  return reply.redirect(buildAuthorizeUrl(state));
});

app.get('/oauth/kontur/callback', async (req, reply) => {
  const code = String(req.query.code || '').trim();
  const err = String(req.query.error || '').trim();
  const state = String(req.query.state || '').trim();
  const spaceId = state.startsWith('space:') ? state.slice(6) : String(req.query.spaceId || '').trim();
  if(err){
    return reply.code(400).type('text/html; charset=utf-8').send(`<h1>Контур OAuth</h1><p>Ошибка: ${err}</p>`);
  }
  if(!code){
    return reply.code(400).type('text/html; charset=utf-8').send('<h1>Контур OAuth</h1><p>Нет параметра code.</p>');
  }
  try {
    const tokens = await exchangeCode(code);
    const box = await fetchBoxIdForInn(tokens.access_token);
    let saved = null;
    let targetSpaceId = spaceId;
    if(!targetSpaceId){
      try {
        const rec = await fetchMainStateRecord();
        const spaces = rec?.payload?.billing?.spaces;
        if(spaces && typeof spaces === 'object'){
          for(const [sid, sp] of Object.entries(spaces)){
            const inn = String(sp?.inn || sp?.orgInn || '').replace(/\D/g, '');
            if(inn && inn === box.orgInn){ targetSpaceId = sid; break; }
          }
          if(!targetSpaceId) targetSpaceId = Object.keys(spaces)[0] || '';
        }
      } catch(e){ app.log.warn(e, 'oauth space lookup'); }
    }
    if(targetSpaceId){
      saved = await saveEpdSpaceToState(targetSpaceId, {
        boxId: box.boxId,
        orgInn: box.orgInn,
        status: 'connected',
        operator: 'kontur'
      });
    }
    try {
      await logOpsToAppState('kontur-oauth', `boxId ${box.boxId}`, { spaceId: targetSpaceId || null, orgInn: box.orgInn, orgName: box.orgName });
    } catch(_){}
    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Контур подключён</title></head><body style="font-family:sans-serif;max-width:640px;margin:2rem auto;padding:0 1rem">
      <h1>Контур подключён</h1>
      <p><strong>${box.orgName || 'Организация'}</strong> · ИНН ${box.orgInn}</p>
      <p>boxId: <code>${box.boxId}</code></p>
      ${targetSpaceId ? `<p>Кабинет: <code>${targetSpaceId}</code> · сохранено в Армаде.</p>` : '<p>boxId получен; укажите spaceId в URL при повторном подключении.</p>'}
      <p><a href="https://app.armada.sx/a/">Вернуться в админку</a></p>
    </body></html>`;
    return reply.type('text/html; charset=utf-8').send(html);
  } catch(e){
    app.log.error(e, 'kontur oauth callback');
    const msg = e?.message || String(e);
    return reply.code(500).type('text/html; charset=utf-8').send(`<h1>Контур OAuth</h1><p>Ошибка: ${msg}</p><p>Проверьте client_secret (EPD_API_KEY) и redirect_uri в кабинете integrator.kontur.ru.</p>`);
  }
});
'''
    marker = "app.listen({ port: PORT, host: '0.0.0.0' })"
    if marker not in text:
        raise SystemExit('listen marker not found')
    text = text.replace(marker, block + "\n" + marker, 1)
    run(f"cat > {path} <<'EOFJS'\n{text}\nEOFJS")

# ensure client_id in .env
run(r"""python3 - <<'EOF'
from pathlib import Path
p = Path('/opt/armada-api/.env')
lines = p.read_text().splitlines() if p.exists() else []
kv = {}
order = []
for line in lines:
    if not line.strip() or line.strip().startswith('#') or '=' not in line:
        order.append(line); continue
    k,v = line.split('=',1); kv[k]=v; order.append(k)
if 'KONTUR_API_CLIENT_ID' not in kv:
    kv['KONTUR_API_CLIENT_ID'] = 'ci_7802655283_ooo_armada'
if 'KONTUR_REDIRECT_URI' not in kv:
    kv['KONTUR_REDIRECT_URI'] = 'https://app.armada.sx/armada-api/oauth/kontur/callback'
if 'KONTUR_ORG_INN' not in kv:
    kv['KONTUR_ORG_INN'] = '7802655283'
out = []
seen=set()
for item in order:
    if item in kv and item not in seen:
        out.append(f"{item}={kv[item]}"); seen.add(item)
    elif '=' not in item and not item.startswith('#'):
        if item in kv: out.append(f"{item}={kv[item]}"); seen.add(item)
    else:
        out.append(item)
for k,v in kv.items():
    if k not in seen: out.append(f"{k}={v}")
p.write_text('\n'.join(out)+'\n')
print('env updated')
EOF""")

run('systemctl restart armada-api')
import time; time.sleep(2)
health = run('curl -sS http://127.0.0.1:8091/health')
print(health)
start = run('curl -sS -o /dev/null -w "%{http_code} %{redirect_url}" "http://127.0.0.1:8091/oauth/kontur/start"')
print('start:', start)
c.close()
print('OK patch kontur oauth')
PY
