import { filterPayloadForUser, mergePayloadForUser } from './tenant.mjs';

const spaceA = 'space-a';
const spaceB = 'space-b';

const full = {
  dataEpoch: 10,
  seq: 4,
  settings: { dadataToken: 'secret', fnsApiKey: 'fns' },
  finance: { markupPercent: 15 },
  spaces: [{ id: spaceA, name: 'Армада' }, { id: spaceB, name: 'Нечаев' }],
  admins: [
    { id: 'admin-super', name: 'Наволоцкий', pin: '1111', isSuper: true, spaceId: spaceA },
    { id: 'admin-b', name: 'Нечаев', pin: '2222', isSuper: false, spaceId: spaceB },
  ],
  companies: [
    { id: 'co-a', name: 'ООО Армада', roles: ['own'], spaceId: spaceA, finance: { markupPercent: 10 }, contacts: [{ name: 'X' }] },
    { id: 'co-b', name: 'ИП Нечаев', roles: ['own'], spaceId: spaceB, finance: { markupPercent: 20 }, contacts: [{ name: 'Y' }] },
  ],
  drivers: [
    { name: 'Водитель А', spaceId: spaceA, companyId: 'co-a', pin: 'aaaa' },
    { name: 'Водитель Б', spaceId: spaceB, companyId: 'co-b', pin: 'bbbb' },
  ],
  vehicles: [
    { id: 'v-a', plate: 'A001', spaceId: spaceA, companyId: 'co-a' },
    { id: 'v-b', plate: 'B001', spaceId: spaceB, companyId: 'co-b' },
  ],
  orders: [
    { id: 'o-a', spaceId: spaceA, ownCompanyId: 'co-a', sequentialNumber: 1, driverName: 'Водитель А' },
    { id: 'o-b', spaceId: spaceB, ownCompanyId: 'co-b', sequentialNumber: 2, driverName: 'Водитель Б' },
    { id: 'o-ex', spaceId: spaceA, ownCompanyId: 'co-a', sequentialNumber: 3, onExchange: true, driverName: '' },
  ],
  shifts: [
    { id: 's-a', spaceId: spaceA, driverName: 'Водитель А', orders: [] },
    { id: 's-b', spaceId: spaceB, driverName: 'Водитель Б', orders: [] },
  ],
  deletedOrderIds: ['dead'],
};

const adminB = { role: 'admin', adminId: 'admin-b', isSuper: false, spaceId: spaceB };
const superA = { role: 'admin', adminId: 'admin-super', isSuper: true, spaceId: spaceA };
const driverB = { role: 'driver', driverName: 'Водитель Б', spaceId: spaceB, companyId: 'co-b' };

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('ok', msg);
  }
}

const scoped = filterPayloadForUser(full, adminB);
assert(scoped.tenantScope.spaceId === spaceB, 'tenantScope');
assert(scoped.orders.some(o => o.id === 'o-b'), 'sees own order');
assert(scoped.orders.some(o => o.id === 'o-ex'), 'sees exchange');
assert(!scoped.orders.some(o => o.id === 'o-a'), 'hides other private order');
assert(!scoped.admins.some(a => a.id === 'admin-super'), 'hides other admin');
assert(scoped.admins.some(a => a.id === 'admin-b' && a.pin === '2222'), 'keeps own pin');
assert(!scoped.drivers.some(d => d.spaceId === spaceA), 'hides other drivers');
assert(scoped.settings.dadataToken === 'secret', 'admin keeps dadata token');

const superView = filterPayloadForUser(full, superA);
assert(!superView.tenantScope, 'super has no tenantScope');
assert(superView.orders.length === 3, 'super sees all orders');

const wipe = {
  ...scoped,
  orders: [{ id: 'o-b', spaceId: spaceB, ownCompanyId: 'co-b', sequentialNumber: 2, customer: 'новый' }],
  admins: [{ id: 'admin-b', name: 'Нечаев', pin: '2222', isSuper: true, spaceId: spaceB }],
  dataEpoch: 11,
};
const merged = mergePayloadForUser(full, wipe, adminB);
assert(merged.orders.some(o => o.id === 'o-a'), 'merge keeps other order');
assert(merged.orders.find(o => o.id === 'o-b').customer === 'новый', 'merge updates own order');
assert(merged.admins.find(a => a.id === 'admin-super').pin === '1111', 'merge keeps super pin');
assert(merged.admins.find(a => a.id === 'admin-b').isSuper === false, 'cannot self-promote');
assert(merged.settings.dadataToken === 'secret', 'settings stay on server');
assert(!merged.tenantScope, 'stored payload has no tenantScope');

const claimIn = {
  ...scoped,
  orders: [
    ...scoped.orders.filter(o => o.id !== 'o-ex'),
    { id: 'o-ex', spaceId: spaceA, ownCompanyId: 'co-a', sequentialNumber: 3, onExchange: false, partnerSpaceId: spaceB, driverName: 'Водитель Б' },
  ],
  dataEpoch: 11,
};
const claimed = mergePayloadForUser(full, claimIn, adminB);
const ex = claimed.orders.find(o => o.id === 'o-ex');
assert(ex.onExchange === false && ex.partnerSpaceId === spaceB, 'can claim exchange');
assert(ex.spaceId === spaceA, 'claim keeps owner spaceId');

const forge = {
  ...scoped,
  orders: [
    { id: 'o-a', spaceId: spaceA, ownCompanyId: 'co-a', sequentialNumber: 1, customer: 'взлом' },
  ],
  dataEpoch: 11,
};
const forged = mergePayloadForUser(full, forge, adminB);
assert(forged.orders.find(o => o.id === 'o-a').customer !== 'взлом', 'cannot edit other private order');
assert(!forged.orders.some(o => o.id === 'o-b'), 'omitted own order is deleted');
assert(forged.orders.some(o => o.id === 'o-ex'), 'omitting exchange does not delete it');

const driverView = filterPayloadForUser(full, driverB);
assert(!driverView.settings.dadataToken, 'driver does not get dadata token');
assert(driverView.orders.some(o => o.id === 'o-b'), 'driver sees own order');
assert(!driverView.orders.some(o => o.id === 'o-a'), 'driver hides other order');

const drvPut = {
  ...driverView,
  orders: driverView.orders.map(o => o.id === 'o-b' ? { ...o, startOdometer: 100 } : o),
  dataEpoch: 11,
};
const drvMerged = mergePayloadForUser(full, drvPut, driverB);
assert(drvMerged.orders.find(o => o.id === 'o-b').startOdometer === 100, 'driver can update own order');
assert(drvMerged.orders.find(o => o.id === 'o-a').driverName === 'Водитель А', 'driver cannot drop other order');

if (process.exitCode) {
  console.error('tenant tests failed');
  process.exit(1);
}
console.log('tenant tests passed');
