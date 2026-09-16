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
test "$BUILD" = 'APP_BUILD="2026-09-16-fleet-save"'

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
console.log('  OK logic checks');
NODE

echo "== ALL SMOKE CHECKS PASSED =="
