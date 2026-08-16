/**
 * АРМАДА API — прокси к PocketBase с JWT-авторизацией.
 * PocketBase не доступен снаружи; клиент работает только через /armada-api/*.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { filterPayloadForUser, mergePayloadForUser, isSuperUser, stripTenantMeta } from './tenant.mjs';

const PORT = Number(process.env.ARMADA_API_PORT || 8091);
const PB_URL = (process.env.PB_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
const JWT_SECRET = process.env.JWT_SECRET || '';
const PB_EMAIL = process.env.PB_ADMIN_EMAIL || '';
const PB_PASSWORD = process.env.PB_ADMIN_PASSWORD || '';
const JWT_TTL_SEC = Number(process.env.JWT_TTL_SEC || 43200); // 12h
const AUTH_FAIL_LIMIT = 8;
const AUTH_FAIL_WINDOW_MS = 15 * 60 * 1000;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('ARMADA API: задайте JWT_SECRET (≥32 символов) в /etc/armada/api.env');
  process.exit(1);
}
if (!PB_EMAIL || !PB_PASSWORD) {
  console.error('ARMADA API: задайте PB_ADMIN_EMAIL и PB_ADMIN_PASSWORD');
  process.exit(1);
}

/** @type {{token:string, exp:number}|null} */
let pbAuth = null;
const authFails = new Map();

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}
function b64urlJson(obj) {
  return b64url(JSON.stringify(obj));
}
function signJwt(payload, ttlSec = JWT_TTL_SEC) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSec };
  const h = b64urlJson(header);
  const p = b64urlJson(body);
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}
function verifyJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function samePerson(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}
function normPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '8') return '+7' + d.slice(1);
  if (d.length === 10) return '+7' + d;
  if (d.length === 11 && d[0] === '7') return '+' + d;
  return d ? '+' + d : '';
}
function resolveDriverPin(d, admins) {
  const pin = String(d?.pin || '').trim();
  if (pin.length >= 4) return pin;
  const adm = (admins || []).find(a => samePerson(a.name, d.name));
  if (adm && String(adm.pin || '').trim().length >= 4) return String(adm.pin).trim();
  const ph = normPhone(d.phone || '');
  if (ph.length >= 4) return ph.slice(-4);
  return '';
}

async function pbLogin() {
  if (pbAuth && Date.now() < pbAuth.exp - 60000) return pbAuth.token;
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASSWORD }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PocketBase auth failed ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  pbAuth = { token: data.token, exp: Date.now() + 3500 * 1000 };
  return pbAuth.token;
}

async function pbGetMainRecord() {
  const token = await pbLogin();
  const filter = encodeURIComponent("key='main'");
  const res = await fetch(`${PB_URL}/api/collections/app_state/records?filter=${filter}&perPage=1`, {
    headers: { Authorization: token },
  });
  if (!res.ok) throw new Error(`PB read ${res.status}`);
  const data = await res.json();
  const rec = data.items?.[0] || null;
  return rec;
}

async function pbWriteMainRecord(recordId, payload, create = false) {
  const token = await pbLogin();
  const body = { key: 'main', payload };
  if (create) {
    const res = await fetch(`${PB_URL}/api/collections/app_state/records`, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PB create ${res.status}`);
    return await res.json();
  }
  const res = await fetch(`${PB_URL}/api/collections/app_state/records/${recordId}`, {
    method: 'PATCH',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PB patch ${res.status}`);
  return await res.json();
}

function authRateKey(ip, kind, id) {
  return `${ip}|${kind}|${id || ''}`;
}
function checkAuthRate(ip, kind, id) {
  const key = authRateKey(ip, kind, id);
  const now = Date.now();
  let entry = authFails.get(key);
  if (!entry || now - entry.start > AUTH_FAIL_WINDOW_MS) {
    entry = { start: now, count: 0 };
    authFails.set(key, entry);
  }
  if (entry.count >= AUTH_FAIL_LIMIT) return false;
  return true;
}
function recordAuthFail(ip, kind, id) {
  const key = authRateKey(ip, kind, id);
  const entry = authFails.get(key) || { start: Date.now(), count: 0 };
  entry.count += 1;
  authFails.set(key, entry);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function getBearer(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : '';
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const ip = clientIp(req);

  if (req.method === 'GET' && path === '/armada-api/health') {
    return json(res, 200, { ok: true, service: 'armada-api' });
  }

  if (req.method === 'GET' && path === '/armada-api/bootstrap') {
    try {
      const rec = await pbGetMainRecord();
      const payload = rec?.payload || {};
      const admins = (payload.admins || []).map(a => ({
        id: a.id,
        name: a.name,
        isSuper: !!a.isSuper,
      }));
      return json(res, 200, {
        admins,
        appBuild: payload.appBuild || null,
      });
    } catch (err) {
      console.error('bootstrap', err);
      return json(res, 500, { error: 'bootstrap_failed' });
    }
  }

  if (req.method === 'POST' && path === '/armada-api/auth/admin') {
    try {
      const body = await readBody(req);
      const adminId = String(body.adminId || '').trim();
      const pin = String(body.pin || '').trim();
      if (!adminId || pin.length < 4) return json(res, 400, { error: 'invalid_credentials' });
      if (!checkAuthRate(ip, 'admin', adminId)) return json(res, 429, { error: 'rate_limited' });

      const rec = await pbGetMainRecord();
      const payload = rec?.payload || {};
      const adm = (payload.admins || []).find(a => a.id === adminId);
      if (!adm || String(adm.pin || '') !== pin) {
        recordAuthFail(ip, 'admin', adminId);
        return json(res, 401, { error: 'invalid_credentials' });
      }
      const token = signJwt({
        role: 'admin',
        adminId: adm.id,
        name: adm.name,
        isSuper: !!adm.isSuper,
        spaceId: adm.spaceId || null,
      });
      return json(res, 200, {
        token,
        admin: { id: adm.id, name: adm.name, isSuper: !!adm.isSuper, spaceId: adm.spaceId || null },
      });
    } catch (err) {
      console.error('auth/admin', err);
      return json(res, 500, { error: 'auth_failed' });
    }
  }

  if (req.method === 'POST' && path === '/armada-api/auth/driver') {
    try {
      const body = await readBody(req);
      const phone = normPhone(body.phone);
      const pin = String(body.pin || '').trim();
      if (!phone || pin.length < 4) return json(res, 400, { error: 'invalid_credentials' });
      if (!checkAuthRate(ip, 'driver', phone)) return json(res, 429, { error: 'rate_limited' });

      const rec = await pbGetMainRecord();
      const payload = rec?.payload || {};
      const admins = payload.admins || [];
      const drivers = (payload.drivers || []).filter(d => normPhone(d.phone) === phone);
      if (!drivers.length) {
        recordAuthFail(ip, 'driver', phone);
        return json(res, 401, { error: 'invalid_credentials' });
      }
      const matched = drivers.filter(d => resolveDriverPin(d, admins) === pin);
      if (!matched.length) {
        recordAuthFail(ip, 'driver', phone);
        return json(res, 401, { error: 'invalid_credentials' });
      }
      const pickHome = matched.find(d => {
        const adm = admins.find(a => a.id === d.ownerAdminId);
        return adm && samePerson(adm.name, d.name);
      });
      const drv = pickHome || matched[0];
      const token = signJwt({
        role: 'driver',
        driverName: drv.name,
        companyId: drv.companyId || null,
        spaceId: drv.spaceId || null,
        ownerAdminId: drv.ownerAdminId || null,
      });
      return json(res, 200, {
        token,
        driver: {
          name: drv.name,
          companyId: drv.companyId || null,
          spaceId: drv.spaceId || null,
        },
      });
    } catch (err) {
      console.error('auth/driver', err);
      return json(res, 500, { error: 'auth_failed' });
    }
  }

  if (req.method === 'GET' && path === '/armada-api/auth/me') {
    const payload = verifyJwt(getBearer(req));
    if (!payload) return json(res, 401, { error: 'unauthorized' });
    return json(res, 200, { user: payload });
  }

  if (path === '/armada-api/state') {
    const user = verifyJwt(getBearer(req));
    if (!user) return json(res, 401, { error: 'unauthorized' });
    if (user.role === 'admin' && !isSuperUser(user) && !user.spaceId) {
      return json(res, 403, { error: 'no_space' });
    }

    if (req.method === 'GET') {
      try {
        const rec = await pbGetMainRecord();
        if (!rec) return json(res, 200, { record: null });
        const full = rec.payload || {};
        const payload = filterPayloadForUser(full, user);
        return json(res, 200, { record: { id: rec.id, payload } });
      } catch (err) {
        console.error('state GET', err);
        return json(res, 500, { error: 'read_failed' });
      }
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      if (user.role !== 'admin' && user.role !== 'driver') return json(res, 403, { error: 'forbidden' });
      try {
        const body = await readBody(req);
        const newPayload = body.payload;
        if (!newPayload || typeof newPayload !== 'object') return json(res, 400, { error: 'bad_payload' });

        const rec = await pbGetMainRecord();
        if (rec?.id) {
          const remote = rec.payload || {};
          const remoteEpoch = Number(remote.dataEpoch) || 0;
          const localEpoch = Number(newPayload.dataEpoch) || 0;
          if (remoteEpoch > localEpoch) {
            return json(res, 409, {
              error: 'remote_ahead',
              record: { id: rec.id, payload: filterPayloadForUser(remote, user) },
            });
          }
          const stored = isSuperUser(user)
            ? stripTenantMeta(newPayload)
            : mergePayloadForUser(remote, newPayload, user);
          await pbWriteMainRecord(rec.id, stored, false);
          return json(res, 200, { ok: true, id: rec.id });
        }
        if (!isSuperUser(user)) return json(res, 403, { error: 'forbidden' });
        const created = await pbWriteMainRecord(null, stripTenantMeta(newPayload), true);
        return json(res, 200, { ok: true, id: created.id });
      } catch (err) {
        console.error('state PUT', err);
        return json(res, 500, { error: 'write_failed' });
      }
    }
  }

  json(res, 404, { error: 'not_found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.info(`ARMADA API listening on 127.0.0.1:${PORT}`);
});
