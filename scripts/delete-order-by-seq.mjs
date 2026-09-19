#!/usr/bin/env node
/**
 * Удалить заказ(ы) по sequentialNumber на сервере + tombstone + перенумерация 1…N.
 * Usage: ADMIN_PIN=7830 node scripts/delete-order-by-seq.mjs 9
 */
const API = process.env.ARMADA_API || 'https://app.armada.sx/armada-api';
const PIN = process.env.ADMIN_PIN || '7830';
const seqArg = +process.argv[2];
if (!Number.isFinite(seqArg) || seqArg < 1) {
  console.error('Usage: node scripts/delete-order-by-seq.mjs <sequentialNumber>');
  process.exit(1);
}

function scrubMessages(msgs, nums) {
  if (!Array.isArray(msgs)) return msgs;
  const hit = (t) => {
    const s = String(t || '');
    for (const n of nums) {
      if (
        s.includes(`Заказ №${n}`) ||
        s.includes(`№${n} ·`) ||
        s.includes(`№${n}\n`) ||
        s.includes(`заказ №${n}`)
      ) return true;
    }
    return false;
  };
  const next = msgs.filter((m) => !hit(m.text));
  return next.length === msgs.length ? msgs : next;
}

function removeBillingEntries(p, delSet) {
  let changed = false;
  const root = p.billing;
  if (!root || !root.spaces) return false;
  for (const spaceId of Object.keys(root.spaces)) {
    const b = root.spaces[spaceId];
    if (!b || !Array.isArray(b.ledger)) continue;
    const remove = b.ledger.filter((e) => e && e.orderId && delSet.has(e.orderId));
    if (!remove.length) continue;
    let balanceDelta = 0;
    remove.forEach((e) => {
      if (e.type === 'exchange_commission') balanceDelta += Math.abs(Number(e.amount) || 0);
    });
    b.ledger = b.ledger.filter((e) => !e || !e.orderId || !delSet.has(e.orderId));
    if (balanceDelta > 0) b.balance = (Number(b.balance) || 0) + balanceDelta;
    changed = true;
  }
  return changed;
}

function compactSequentialNumbers(p) {
  const dead = new Set(Array.isArray(p.deletedOrderIds) ? p.deletedOrderIds : []);
  p.orders = (p.orders || []).filter((o) => o && o.id && !dead.has(o.id) && !o.cancelledAt);
  const list = p.orders.slice().sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    if (ta !== tb) return ta - tb;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
  list.forEach((o, i) => {
    o.sequentialNumber = i + 1;
  });
  p.seq = list.length;
  const byId = new Map(list.map((o) => [o.id, o]));
  (p.shifts || []).forEach((s) => {
    if (!Array.isArray(s.orders)) return;
    s.orders = s.orders.filter((o) => o && o.id && !dead.has(o.id));
    s.orders.forEach((o, idx) => {
      const live = byId.get(o.id);
      if (live) s.orders[idx] = live;
    });
  });
  p.orders = list.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function main() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ pin: PIN, role: 'admin' }),
  });
  const login = await loginRes.json();
  if (!login.token) throw new Error('login failed: ' + JSON.stringify(login));
  const headers = {
    Authorization: 'Bearer ' + login.token,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  const stateRes = await fetch(`${API}/state`, { headers });
  const state = await stateRes.json();
  if (!state.payload) throw new Error('no payload');
  const p = state.payload;

  const targets = (p.orders || []).filter((o) => o && +o.sequentialNumber === seqArg);
  if (!targets.length) {
    console.log(JSON.stringify({ ok: true, message: `Заказ №${seqArg} не найден`, orders: (p.orders || []).length }, null, 2));
    return;
  }
  const delSet = new Set(targets.map((o) => o.id));
  const nums = new Set(targets.map((o) => o.sequentialNumber));

  p.deletedOrderIds = Array.isArray(p.deletedOrderIds) ? p.deletedOrderIds : [];
  delSet.forEach((id) => {
    if (!p.deletedOrderIds.includes(id)) p.deletedOrderIds.push(id);
  });

  p.orders = (p.orders || []).filter((o) => o && o.id && !delSet.has(o.id));
  p.invoices = (p.invoices || []).filter((inv) => inv && inv.orderId && !delSet.has(inv.orderId));

  (p.shifts || []).forEach((s) => {
    if (Array.isArray(s.orders)) s.orders = s.orders.filter((o) => o && o.id && !delSet.has(o.id));
    if (s.pendingEmptyAfterOrderId && delSet.has(s.pendingEmptyAfterOrderId)) s.pendingEmptyAfterOrderId = null;
    if (s.draft && s.draft.closingOrderId && delSet.has(s.draft.closingOrderId)) {
      s.draft.closingOrderId = null;
      s.orderStep = 'idle';
    }
    if (s.draft && s.draft.assignedId && delSet.has(s.draft.assignedId)) {
      s.draft = {};
      s.orderStep = 'idle';
    }
    if (Array.isArray(s.messages)) s.messages = scrubMessages(s.messages, nums);
  });

  if (p.messages) p.messages = scrubMessages(p.messages, nums);
  if (p.draft && p.draft.closingOrderId && delSet.has(p.draft.closingOrderId)) delete p.draft.closingOrderId;
  if (p.detailId && delSet.has(p.detailId)) p.detailId = null;

  removeBillingEntries(p, delSet);
  compactSequentialNumbers(p);

  p.dataEpoch = (Number(p.dataEpoch) || 0) + 1;
  p.savedAt = new Date().toISOString();

  const patchRes = await fetch(`${API}/state`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ recordId: state.recordId, payload: p }),
  });
  const patch = await patchRes.json().catch(() => ({}));
  if (!patchRes.ok) throw new Error('patch failed: ' + patchRes.status + ' ' + JSON.stringify(patch));

  console.log(
    JSON.stringify(
      {
        ok: true,
        deletedSeq: seqArg,
        deletedIds: [...delSet],
        ordersAfter: (p.orders || []).length,
        seqAfter: (p.orders || []).map((o) => o.sequentialNumber).sort((a, b) => a - b),
        dataEpoch: p.dataEpoch,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
