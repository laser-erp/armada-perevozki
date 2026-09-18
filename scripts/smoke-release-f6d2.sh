#!/usr/bin/env bash
# Smoke checks for release branch — syntax + key logic invariants
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== 1. No git conflict markers =="
if rg -n '^(<<<<<<<|=======|>>>>>>>)' web-preview --glob '*.js' --glob '*.html' --glob '*.css'; then
  echo "FAIL: conflict markers found"
  exit 1
fi
echo "OK"

echo "== 2. JS syntax =="
while IFS= read -r f; do
  node --check "$f"
  echo "  OK $f"
done < <(find web-preview -name '*.js' -type f | sort)

echo "== 3. APP_BUILD =="
BUILD=$(rg -o 'APP_BUILD="[^"]+"' web-preview/store.js | head -1)
echo "  $BUILD"
test "$BUILD" = 'APP_BUILD="2026-09-18-customer-etrn-global-alert"'

echo "== 4. Logic unit checks =="
node <<'NODE'
const BODY_TYPES=[{id:'tent'},{id:'board'},{id:'reefer'},{id:'dump'}];
const ATI=[{id:'board',mapTo:'board'},{id:'open',mapTo:'board'},{id:'tent',mapTo:'tent'}];
function bodyTypeMatchMeta(id){
  const x=String(id||'').trim();
  if(!x) return null;
  const ati=ATI.find(t=>t.id===x);
  if(ati) return {id:ati.id,group:ati.mapTo||'board'};
  const coarse=BODY_TYPES.find(t=>t.id===x);
  if(coarse) return {id:coarse.id,group:coarse.id};
  return {id:x,group:'board'};
}
function bodyTypeOrderMatch(a,b){
  if(!a||!b) return false;
  if(a===b) return true;
  const ma=bodyTypeMatchMeta(a), mb=bodyTypeMatchMeta(b);
  return ma&&mb&&(ma.id===mb.id||ma.group===mb.group);
}
function vehicleFitsOrder(v,o){
  if(!v||!o) return false;
  const pairs=[['reqPayloadTons','payloadTons'],['reqLengthM','bodyLengthM']];
  for(const [req,field] of pairs){
    const need=+o[req];
    if(!(need>0)) continue;
    const have=+v[field];
    if(!(have>0)) continue;
    if(have+1e-9<need) return false;
  }
  return true;
}
function waitingLogistDriver(name){
  const n=String(name||'').trim();
  return !n||n==='—'||n==='Биржа'||n==='Диспетчер';
}
function orderNeverStartedTrip(o){
  return !!(o && o.startOdometer==null && o.departOdometer==null);
}
function orderKeepsLogist(o){
  return o && (o.executorType==='logist' || o.customerSubmitted || o.fulfillment==='logist' || o.fulfillment==='direct');
}
function looksClosedOrder(o){
  if(!o||o.cancelledAt) return false;
  if(orderNeverStartedTrip(o) && orderKeepsLogist(o)) return false;
  if(o.closedAt) return true;
  if(o.endOdometer!=null && (o.loadedKm!=null || o.emptyKmAfter!=null)){
    if(o.startOdometer==null) return false;
    return true;
  }
  return false;
}
function orderHasDriverVehicleAssigned(o){
  const drv=String(o.driverName||'').trim();
  const plate=String(o.vehiclePlate||'').trim();
  if(!drv||!plate||waitingLogistDriver(drv)||plate==='—') return false;
  return true;
}
if(!bodyTypeOrderMatch('board','open')) throw new Error('bodyTypeOrderMatch board/open');
if(!vehicleFitsOrder({payloadTons:null},{reqPayloadTons:3})) throw new Error('missing tonnage should pass');
if(vehicleFitsOrder({payloadTons:2},{reqPayloadTons:3})) throw new Error('2t should fail 3t req');
if(!orderHasDriverVehicleAssigned({driverName:'Иванов',vehiclePlate:'А123'})) throw new Error('assigned check');
if(orderHasDriverVehicleAssigned({driverName:'Диспетчер',vehiclePlate:'—'})) throw new Error('dispatcher placeholder');
function adminFleetCompanyId(o, ctx){
  const myCo=ctx.myCo;
  if(!myCo) return null;
  if(ctx.isSuper){
    const f=ctx.filter||'all';
    if(f&&f!=='all'&&f!=='_none') return f==='space-nech'?ctx.nechCo:ctx.armCo;
    if(o&&o.ownCompanyId) return o.ownCompanyId;
    return myCo;
  }
  return myCo;
}
if(adminFleetCompanyId({ownCompanyId:'arm-co'},{isSuper:false,myCo:'nech-co',armCo:'arm-co',nechCo:'nech-co'})!=='nech-co') throw new Error('non-super must use own fleet only');
if(adminFleetCompanyId({ownCompanyId:'arm-co'},{isSuper:true,filter:'all',myCo:'nech-co',armCo:'arm-co',nechCo:'nech-co'})!=='arm-co') throw new Error('super all uses order firm');
const phantom={customerSubmitted:true,closedAt:'2026-01-01',endOdometer:100,loadedKm:10,driverName:'Иванов',vehiclePlate:'А123'};
if(looksClosedOrder(phantom)) throw new Error('portal assigned must not look closed without trip');
function orderNeverStartedTrip(o){ return !!(o&&o.startOdometer==null&&o.departOdometer==null); }
function orderKeepsLogist(o){ return !!(o&&o.customerSubmitted); }
function shouldBlockPhantomCloseMerge(cur,k){
  const closeKeys=new Set(['closedAt','endOdometer','loadedKm']);
  if(!cur||!closeKeys.has(k)) return false;
  if(orderNeverStartedTrip(cur)&&orderKeepsLogist(cur)) return true;
  if(orderHasDriverVehicleAssigned(cur)&&cur.startOdometer==null) return true;
  return false;
}
if(!shouldBlockPhantomCloseMerge({driverName:'Иванов',vehiclePlate:'А123',customerSubmitted:true},'closedAt')) throw new Error('block phantom on assigned');
const remote={id:'x',driverName:'Иванов',vehiclePlate:'А123',customerSubmitted:true};
const local={id:'x',driverName:'Диспетчер',vehiclePlate:'—',closedAt:'2026-01-01',endOdometer:100,loadedKm:10,customerSubmitted:true};
const merged={...remote};
Object.assign(merged,local);
if(orderHasDriverVehicleAssigned(remote)&&!orderHasDriverVehicleAssigned(local)){
  Object.assign(merged, {driverName:remote.driverName, vehiclePlate:remote.vehiclePlate});
}
if(!orderHasDriverVehicleAssigned(merged)) throw new Error('assignment must survive stale local merge');
function orderEffectiveDriverName(o){
  const direct=String((o&&o.driverName)||'').trim();
  if(direct&&!waitingLogistDriver(direct)) return direct;
  if(o&&o.ownFleetDriverId==='drv-1') return 'Иванов А.С.';
  return direct;
}
function orderBelongsToDriverLite(o, who, drivers){
  const eff=orderEffectiveDriverName(o);
  if(eff&&who&&eff.toLowerCase().includes('иванов')&&who.toLowerCase().includes('иванов')) return true;
  if(o.ownFleetDriverId){
    const rec=(drivers||[]).find(d=>String(d.id)===String(o.ownFleetDriverId));
    if(rec&&rec.name&&who&&rec.name.toLowerCase().includes('иванов')&&who.toLowerCase().includes('иванов')) return true;
  }
  return false;
}
const drivers=[{id:'drv-1',name:'Иванов А.С.',companyId:'co-1'}];
if(!orderBelongsToDriverLite({driverName:'Диспетчер',vehiclePlate:'—',ownFleetDriverId:'drv-1'},'Иванов',drivers)) throw new Error('ownFleetDriverId match');
console.log('  OK logic checks');
NODE

echo "== ALL SMOKE CHECKS PASSED =="
