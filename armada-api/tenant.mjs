/**
 * Фаза 1.3: фильтрация payload по spaceId и безопасный merge при записи.
 * Супер-админ видит и пишет всё; остальные — своё пространство + биржа.
 */

export function isSuperUser(user) {
  return !!(user && user.role === 'admin' && user.isSuper);
}

export function userSpaceId(user) {
  return (user && user.spaceId) || null;
}

function samePerson(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function itemSpace(item) {
  return (item && item.spaceId) || null;
}

function isOpenExchange(o) {
  return !!(o && o.onExchange && !o.closedAt && o.startOdometer == null);
}

export function orderVisibleToUser(o, user) {
  if (!o) return false;
  if (isSuperUser(user)) return true;
  const sid = userSpaceId(user);
  if (sid && itemSpace(o) === sid) return true;
  if (sid && o.partnerSpaceId === sid) return true;
  if (isOpenExchange(o)) return true;
  if (user.role === 'driver' && samePerson(o.driverName, user.driverName)) return true;
  return false;
}

export function shiftVisibleToUser(s, user) {
  if (!s) return false;
  if (isSuperUser(user)) return true;
  const sid = userSpaceId(user);
  if (sid && itemSpace(s) === sid) return true;
  if (user.role === 'driver' && samePerson(s.driverName, user.driverName)) return true;
  if (asArray(s.orders).some(o => orderVisibleToUser(o, user))) return true;
  return false;
}

function orderOwned(item, user) {
  if (!item) return false;
  if (isSuperUser(user)) return true;
  if (user.role === 'driver') return samePerson(item.driverName, user.driverName);
  if (user.role !== 'admin') return false;
  const sid = userSpaceId(user);
  if (!sid) return false;
  if (itemSpace(item) === sid) return true;
  if (item.partnerSpaceId === sid) return true;
  return false;
}

function orderWritable(incoming, remote, user) {
  if (isSuperUser(user)) return true;
  if (user.role === 'driver') {
    const name = user.driverName;
    if (samePerson(incoming && incoming.driverName, name)) return true;
    if (remote && samePerson(remote.driverName, name)) return true;
    if (remote && isOpenExchange(remote) && samePerson(incoming && incoming.driverName, name)) return true;
    return false;
  }
  if (user.role !== 'admin') return false;
  const sid = userSpaceId(user);
  if (!sid) return false;
  if (itemSpace(incoming) === sid) return true;
  if (incoming && incoming.partnerSpaceId === sid) return true;
  if (remote && itemSpace(remote) === sid) return true;
  if (remote && remote.partnerSpaceId === sid) return true;
  if (remote && isOpenExchange(remote)) return true;
  return false;
}

function shiftWritable(incoming, remote, user) {
  if (isSuperUser(user)) return true;
  if (user.role === 'driver') {
    const name = user.driverName;
    if (samePerson(incoming && incoming.driverName, name)) return true;
    if (remote && samePerson(remote.driverName, name)) return true;
    return false;
  }
  if (user.role !== 'admin') return false;
  const sid = userSpaceId(user);
  if (!sid) return false;
  if (itemSpace(incoming) === sid || itemSpace(remote) === sid) return true;
  const orders = asArray(incoming && incoming.orders).concat(asArray(remote && remote.orders));
  return orders.some(o => orderWritable(o, o, user));
}

function spaceWritable(incoming, remote, user) {
  if (isSuperUser(user)) return true;
  if (user.role !== 'admin') return false;
  const sid = userSpaceId(user);
  if (!sid) return false;
  const id = (incoming && incoming.id) || (remote && remote.id);
  return id === sid;
}

function ownedBySpace(item, user) {
  if (isSuperUser(user)) return true;
  const sid = userSpaceId(user);
  if (!sid) return false;
  return itemSpace(item) === sid;
}

function companyWritable(incoming, remote, user) {
  if (isSuperUser(user)) return true;
  if (user.role !== 'admin') return false;
  return ownedBySpace(incoming, user) || ownedBySpace(remote, user);
}

function driverKey(d) {
  if (!d) return '';
  if (d.id) return 'id:' + d.id;
  return 'n:' + String(d.name || '').trim().toLowerCase() + '|c:' + (d.companyId || '');
}

function vehicleKey(v) {
  if (!v) return '';
  if (v.id) return 'id:' + v.id;
  return 'p:' + String(v.plate || '').trim().toLowerCase() + '|c:' + (v.companyId || '');
}

function contractVisible(c, user, myCompanyIds) {
  if (!c) return false;
  if (isSuperUser(user)) return true;
  if (myCompanyIds.has(c.customerCompanyId) || myCompanyIds.has(c.carrierCompanyId)) return true;
  const sid = userSpaceId(user);
  return !!(sid && itemSpace(c) === sid);
}

function contractWritable(incoming, remote, user, myCompanyIds) {
  if (isSuperUser(user)) return true;
  if (user.role !== 'admin') return false;
  return contractVisible(incoming, user, myCompanyIds) || contractVisible(remote, user, myCompanyIds);
}

function collectCompanyIds(payload, extraOrders) {
  const ids = new Set();
  asArray(payload.companies).forEach(c => { if (c && c.id) ids.add(c.id); });
  asArray(payload.orders).concat(asArray(extraOrders)).forEach(o => {
    if (!o) return;
    if (o.ownCompanyId) ids.add(o.ownCompanyId);
    if (o.carrierCompanyId) ids.add(o.carrierCompanyId);
  });
  asArray(payload.transportContracts).forEach(c => {
    if (!c) return;
    if (c.customerCompanyId) ids.add(c.customerCompanyId);
    if (c.carrierCompanyId) ids.add(c.carrierCompanyId);
  });
  return ids;
}

const COMPANY_PUBLIC = [
  'id', 'name', 'roles', 'note', 'spaceId',
  'inn', 'ogrn', 'kpp', 'address', 'director',
  'bankName', 'bankBik', 'bankAccount', 'bankCorrAccount',
];

function publicCompany(c) {
  if (!c) return c;
  const out = {};
  for (const k of COMPANY_PUBLIC) {
    if (c[k] !== undefined) out[k] = c[k];
  }
  return out;
}

function stampSpace(item, user) {
  if (!item || typeof item !== 'object') return item;
  const sid = userSpaceId(user);
  if (!sid) return { ...item };
  if (item.spaceId && item.spaceId !== sid) return { ...item, spaceId: sid };
  if (!item.spaceId) return { ...item, spaceId: sid };
  return { ...item };
}

function mergeByKey(remoteArr, incomingArr, keyFn, canWrite, { allowCreate = true, transform = null, canDelete = null } = {}) {
  const remote = asArray(remoteArr);
  const incoming = asArray(incomingArr);
  const map = new Map();
  const noKeyRemote = [];
  remote.forEach(item => {
    const k = keyFn(item);
    if (k) map.set(k, item);
    else noKeyRemote.push(item);
  });
  const incomingKeys = new Set();
  incoming.forEach(item => {
    if (!item) return;
    const k = keyFn(item);
    const prev = k ? map.get(k) : null;
    if (!canWrite(item, prev)) {
      if (k) incomingKeys.add(k);
      return;
    }
    const next = transform ? transform(item, prev) : item;
    if (!k) {
      if (allowCreate) noKeyRemote.push(next);
      return;
    }
    incomingKeys.add(k);
    if (!prev && !allowCreate) return;
    map.set(k, next);
  });
  for (const [k, prev] of [...map.entries()]) {
    if (incomingKeys.has(k)) continue;
    const drop = canDelete ? canDelete(prev) : canWrite(prev, prev);
    if (drop) map.delete(k);
  }
  return [...map.values(), ...noKeyRemote.filter(item => !(canDelete ? canDelete(item) : canWrite(item, item)))];
}

function myCompanyIdSet(payload, user) {
  const sid = userSpaceId(user);
  const ids = new Set();
  asArray(payload.companies).forEach(c => {
    if (c && c.id && (!sid || itemSpace(c) === sid)) ids.add(c.id);
  });
  return ids;
}

function filterSettings(settings, user) {
  const src = settings && typeof settings === 'object' ? settings : {};
  if (user.role === 'driver') {
    return { fnsApiKey: '', dadataToken: '' };
  }
  return { ...src };
}

/**
 * Полный payload → вид пользователя. Супер получает копию как есть.
 */
export function filterPayloadForUser(payload, user) {
  const src = payload && typeof payload === 'object' ? payload : {};
  if (isSuperUser(user)) {
    return stripTenantMeta({ ...src });
  }

  const sid = userSpaceId(user);
  const orders = asArray(src.orders).filter(o => orderVisibleToUser(o, user));
  const shifts = asArray(src.shifts)
    .filter(s => shiftVisibleToUser(s, user))
    .map(s => {
      const copy = { ...s };
      if (Array.isArray(copy.orders)) copy.orders = copy.orders.filter(o => orderVisibleToUser(o, user));
      return copy;
    });

  const ownCompanies = asArray(src.companies).filter(c => sid && itemSpace(c) === sid);
  const myIds = new Set(ownCompanies.map(c => c.id).filter(Boolean));
  const needIds = collectCompanyIds({ ...src, orders, transportContracts: src.transportContracts }, []);
  const companies = [];
  const seenCo = new Set();
  asArray(src.companies).forEach(c => {
    if (!c || !c.id || seenCo.has(c.id)) return;
    if (myIds.has(c.id) || (sid && itemSpace(c) === sid)) {
      seenCo.add(c.id);
      companies.push(c);
      return;
    }
    if (needIds.has(c.id) && (orderTouchesCompany(orders, c.id) || contractTouchesCompany(src.transportContracts, c.id, myIds))) {
      seenCo.add(c.id);
      companies.push(publicCompany(c));
    }
  });

  const needSpaceIds = new Set();
  if (sid) needSpaceIds.add(sid);
  orders.forEach(o => {
    if (o.spaceId) needSpaceIds.add(o.spaceId);
    if (o.partnerSpaceId) needSpaceIds.add(o.partnerSpaceId);
  });
  companies.forEach(c => { if (c.spaceId) needSpaceIds.add(c.spaceId); });

  const spaces = asArray(src.spaces).filter(s => s && needSpaceIds.has(s.id));
  const drivers = asArray(src.drivers).filter(d => {
    if (sid && itemSpace(d) === sid) return true;
    if (user.role === 'driver' && samePerson(d.name, user.driverName)) return true;
    return false;
  });
  const vehicles = asArray(src.vehicles).filter(v => {
    if (sid && itemSpace(v) === sid) return true;
    if (user.role === 'driver' && user.companyId && v.companyId === user.companyId) return true;
    return false;
  });
  const admins = user.role === 'admin'
    ? asArray(src.admins).filter(a => sid && itemSpace(a) === sid)
    : [];
  const customers = asArray(src.customers).filter(c => !sid || !itemSpace(c) || itemSpace(c) === sid);
  const transportContracts = asArray(src.transportContracts).filter(c => contractVisible(c, user, myIds));

  const adminIds = new Set(admins.map(a => a.id).filter(Boolean));
  const adminLogins = asArray(src.adminLogins).filter(e => e && adminIds.has(e.adminId));
  const adminPresence = asArray(src.adminPresence).filter(e => e && adminIds.has(e.adminId));

  const out = {
    ...src,
    orders,
    shifts,
    companies,
    customers,
    drivers,
    vehicles,
    admins,
    spaces,
    transportContracts,
    adminLogins,
    adminPresence,
    settings: filterSettings(src.settings, user),
    tenantScope: { spaceId: sid, role: user.role || null },
  };
  return out;
}

function orderTouchesCompany(orders, companyId) {
  return asArray(orders).some(o => o && (o.ownCompanyId === companyId || o.carrierCompanyId === companyId));
}

function contractTouchesCompany(contracts, companyId, myIds) {
  return asArray(contracts).some(c => {
    if (!c) return false;
    const mine = myIds.has(c.customerCompanyId) || myIds.has(c.carrierCompanyId);
    if (!mine) return false;
    return c.customerCompanyId === companyId || c.carrierCompanyId === companyId;
  });
}

export function stripTenantMeta(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const out = { ...payload };
  delete out.tenantScope;
  return out;
}

/**
 * Слить запись арендатора в полный payload. Супер — полная замена (как раньше).
 */
export function mergePayloadForUser(remotePayload, incomingPayload, user) {
  const remote = remotePayload && typeof remotePayload === 'object' ? remotePayload : {};
  const incoming = incomingPayload && typeof incomingPayload === 'object' ? incomingPayload : {};
  if (isSuperUser(user)) {
    return stripTenantMeta({ ...incoming });
  }

  const sid = userSpaceId(user);
  const myIds = myCompanyIdSet(remote, user);

  const orders = mergeByKey(
    remote.orders,
    incoming.orders,
    o => o && o.id,
    (inc, prev) => orderWritable(inc, prev, user),
    {
      transform: (inc, prev) => {
        const next = { ...inc };
        if (user.role === 'admin' && sid) {
          if (prev && isOpenExchange(prev)) {
            // забрали с биржи — spaceId заказчика не меняем
            next.spaceId = prev.spaceId || next.spaceId;
          } else if (!prev || itemSpace(prev) === sid) {
            next.spaceId = next.spaceId || sid;
            if (next.spaceId !== sid && next.partnerSpaceId !== sid) next.spaceId = sid;
          }
        }
        if (user.role === 'driver' && prev && prev.sequentialNumber != null) {
          next.sequentialNumber = prev.sequentialNumber;
        }
        return next;
      },
      canDelete: (prev) => orderOwned(prev, user),
    }
  );

  const shifts = mergeByKey(
    remote.shifts,
    incoming.shifts,
    s => s && s.id,
    (inc, prev) => shiftWritable(inc, prev, user),
    {
      transform: (inc, prev) => {
        const next = { ...inc };
        if (Array.isArray(next.orders)) {
          next.orders = next.orders.filter(o => orderWritable(o, asArray(prev && prev.orders).find(x => x && o && x.id === o.id), user));
        }
        if (user.role === 'admin' && sid && !next.spaceId) next.spaceId = sid;
        if (user.role === 'driver' && !next.spaceId && (prev && prev.spaceId)) next.spaceId = prev.spaceId;
        return next;
      },
      canDelete: (prev) => {
        if (isSuperUser(user)) return true;
        if (user.role === 'driver') return samePerson(prev && prev.driverName, user.driverName);
        const sid = userSpaceId(user);
        return !!(sid && itemSpace(prev) === sid);
      },
    }
  );

  let companies = remote.companies;
  let customers = remote.customers;
  let drivers = remote.drivers;
  let vehicles = remote.vehicles;
  let admins = remote.admins;
  let spaces = remote.spaces;
  let transportContracts = remote.transportContracts;
  let adminLogins = remote.adminLogins;
  let adminPresence = remote.adminPresence;
  let settings = remote.settings;
  let finance = remote.finance;

  if (user.role === 'admin' && sid) {
    companies = mergeByKey(
      remote.companies,
      incoming.companies,
      c => c && c.id,
      (inc, prev) => companyWritable(inc, prev, user),
      { transform: (inc) => stampSpace(inc, user) }
    );
    customers = mergeByKey(
      remote.customers,
      incoming.customers,
      c => (c && (c.id || ('n:' + String(c.name || '').trim().toLowerCase()))),
      (inc, prev) => companyWritable(inc, prev, user),
      { transform: (inc) => stampSpace(inc, user) }
    );
    drivers = mergeByKey(
      remote.drivers,
      incoming.drivers,
      driverKey,
      (inc, prev) => ownedBySpace(inc, user) || ownedBySpace(prev, user),
      { transform: (inc) => stampSpace(inc, user) }
    );
    vehicles = mergeByKey(
      remote.vehicles,
      incoming.vehicles,
      vehicleKey,
      (inc, prev) => ownedBySpace(inc, user) || ownedBySpace(prev, user),
      { transform: (inc) => stampSpace(inc, user) }
    );
    admins = mergeByKey(
      remote.admins,
      incoming.admins,
      a => a && a.id,
      (inc, prev) => {
        if (prev && prev.isSuper) return false;
        if (inc && inc.isSuper && !(prev && prev.isSuper)) return false;
        return ownedBySpace(inc, user) || ownedBySpace(prev, user);
      },
      {
        transform: (inc, prev) => {
          const next = stampSpace(inc, user);
          next.isSuper = !!(prev && prev.isSuper);
          if (prev && prev.pin && !String(next.pin || '').trim()) next.pin = prev.pin;
          return next;
        },
      }
    );
    spaces = mergeByKey(
      remote.spaces,
      incoming.spaces,
      s => s && s.id,
      (inc, prev) => spaceWritable(inc, prev, user),
      { allowCreate: false, canDelete: () => false }
    );
    const writeIds = myCompanyIdSet({ companies }, user);
    transportContracts = mergeByKey(
      remote.transportContracts,
      incoming.transportContracts,
      c => c && c.id,
      (inc, prev) => contractWritable(inc, prev, user, writeIds),
      {
        transform: (inc) => {
          const next = { ...inc };
          if (!next.spaceId) next.spaceId = sid;
          return next;
        },
      }
    );

    const loginMap = new Map();
    asArray(remote.adminLogins).forEach(e => { if (e && e.id) loginMap.set(e.id, e); });
    asArray(incoming.adminLogins).forEach(e => {
      if (!e || !e.id) return;
      if ((e.adminId && asArray(admins).some(a => a.id === e.adminId)) || e.adminId === user.adminId) {
        loginMap.set(e.id, e);
      }
    });
    adminLogins = [...loginMap.values()].sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0)).slice(0, 120);

    const presMap = new Map();
    asArray(remote.adminPresence).forEach(e => { if (e && e.deviceId) presMap.set(e.deviceId, e); });
    asArray(incoming.adminPresence).forEach(e => {
      if (!e || !e.deviceId) return;
      if (e.adminId === user.adminId || asArray(admins).some(a => a.id === e.adminId)) {
        presMap.set(e.deviceId, e);
      }
    });
    adminPresence = [...presMap.values()];
  } else if (user.role === 'driver' && sid) {
    vehicles = mergeByKey(
      remote.vehicles,
      incoming.vehicles,
      vehicleKey,
      (inc, prev) => ownedBySpace(inc, user) || ownedBySpace(prev, user)
        || !!(user.companyId && ((inc && inc.companyId === user.companyId) || (prev && prev.companyId === user.companyId))),
      { allowCreate: false }
    );
  }

  const deletedOrderIds = [...new Set([
    ...asArray(remote.deletedOrderIds),
    ...asArray(incoming.deletedOrderIds),
  ])];

  const remoteEpoch = Number(remote.dataEpoch) || 0;
  const incomingEpoch = Number(incoming.dataEpoch) || 0;

  return stripTenantMeta({
    ...remote,
    orders,
    shifts,
    companies,
    customers,
    drivers,
    vehicles,
    admins,
    spaces,
    transportContracts,
    adminLogins,
    adminPresence,
    settings,
    finance,
    deletedOrderIds,
    seq: Math.max(Number(remote.seq) || 0, Number(incoming.seq) || 0),
    dataEpoch: Math.max(remoteEpoch, incomingEpoch),
    savedAt: incoming.savedAt || remote.savedAt,
    appBuild: incoming.appBuild || remote.appBuild,
  });
}
