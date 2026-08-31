#!/usr/bin/env node
/** Снять счета/хвосты по deletedOrderIds на сервере и сохранить payload. */
const API = process.env.ARMADA_API || 'https://app.armada.sx/armada-api';
const PIN = process.env.ADMIN_PIN || '7830';

async function main() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ pin: PIN, role: 'admin' }),
  });
  const login = await loginRes.json();
  if (!login.token) throw new Error('login failed: ' + JSON.stringify(login));
  const headers = { Authorization: 'Bearer ' + login.token, Accept: 'application/json', 'Content-Type': 'application/json' };

  const stateRes = await fetch(`${API}/state`, { headers });
  const state = await stateRes.json();
  if (!state.payload) throw new Error('no payload');

  const p = state.payload;
  const deleted = new Set(Array.isArray(p.deletedOrderIds) ? p.deletedOrderIds : []);
  const ordersBefore = (p.orders || []).length;
  const invBefore = (p.invoices || []).length;

  p.orders = (p.orders || []).filter((o) => o && o.id && !deleted.has(o.id));
  p.invoices = (p.invoices || []).filter((inv) => inv && inv.orderId && !deleted.has(inv.orderId));
  (p.shifts || []).forEach((s) => {
    if (Array.isArray(s.orders)) s.orders = s.orders.filter((o) => o && o.id && !deleted.has(o.id));
  });
  p.dataEpoch = (Number(p.dataEpoch) || 0) + 1;
  p.savedAt = new Date().toISOString();

  const patchRes = await fetch(`${API}/state`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ recordId: state.recordId, payload: p }),
  });
  const patch = await patchRes.json().catch(() => ({}));
  if (!patchRes.ok) throw new Error('patch failed: ' + patchRes.status + ' ' + JSON.stringify(patch));

  const inv9 = (p.invoices || []).filter((i) => String(i.orderSeq) === '9' || String(i.number) === '9');
  console.log(JSON.stringify({
    ok: true,
    epoch: p.dataEpoch,
    orders: ordersBefore,
    ordersAfter: (p.orders || []).length,
    invoices: invBefore,
    invoicesAfter: (p.invoices || []).length,
    invoice9Left: inv9,
    deletedCount: deleted.size,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
