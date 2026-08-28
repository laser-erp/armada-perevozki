/* АРМАДА: портал заказчика — вход, заявка, минимальная цена */
if(typeof globalThis.esc!=='function'){
  globalThis.esc=function esc(s){
    return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  };
}
const CUSTOMER_SESSION_KEY='armada_customer_session_v1';
let currentCustomer=null; // { companyId, name, phone, spaceId }

function findCustomerPortalCompany(phone, pin, scope){
  const ph=formatPhone(phone);
  const p=String(pin||'').trim();
  if(!ph||p.length<4) return null;
  const sc=resolvePortalScope(scope||getPortalScope());
  return (state.companies||[]).find(c=>{
    if(sc&&sc.companyId && c.id!==sc.companyId) return false;
    if(sc&&sc.spaceId && c.spaceId!==sc.spaceId) return false;
    return companyHasRole(c,'customer') && c.portalEnabled
      && formatPhone(c.portalPhone)===ph && String(c.portalPin)===p;
  })||null;
}

function saveCustomerSession(){
  if(!currentCustomer){ try{ localStorage.removeItem(CUSTOMER_SESSION_KEY); }catch(_){} return; }
  try{
    localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify({
      companyId:currentCustomer.companyId,
      phone:currentCustomer.phone,
      at:new Date().toISOString()
    }));
  }catch(_){}
}
function clearCustomerSession(){
  try{ localStorage.removeItem(CUSTOMER_SESSION_KEY); }catch(_){}
}
function restoreCustomerSession(){
  let raw=null;
  try{ raw=JSON.parse(localStorage.getItem(CUSTOMER_SESSION_KEY)||'null'); }catch(_){ raw=null; }
  if(!raw||!raw.companyId) return false;
  const co=findCompanyById(raw.companyId);
  if(!co||!co.portalEnabled) return false;
  if(raw.phone && formatPhone(co.portalPhone)!==formatPhone(raw.phone)) return false;
  currentCustomer={
    companyId:co.id, name:co.name, phone:formatPhone(co.portalPhone),
    spaceId:co.spaceId||null
  };
  return true;
}

function openCustomerLogin(){
  initPortalScopeFromPage();
  currentCustomer=null;
  clearCustomerSession();
  const err=$('cust-login-error'); if(err) err.textContent='';
  const phoneEl=$('cust-login-phone'); const pinEl=$('cust-login-pin');
  if(phoneEl) phoneEl.value='';
  if(pinEl) pinEl.value='';
  const scopeHint=$('cust-login-scope');
  if(scopeHint){
    const label=portalScopeCarrierLabel();
    scopeHint.textContent=label?`Портал перевозчика: ${label}`:'';
    scopeHint.style.display=label?'block':'none';
  }
  $('cust-login-back').onclick=()=>backFromEntryLogin();
  show('customer-login');
  applyEntrySkin('customer-login');
  setTimeout(()=>{ try{ (phoneEl||pinEl)?.focus(); }catch(_){} }, 120);
}

async function loginCustomer(){
  const err=$('cust-login-error');
  const phone=formatPhone((($('cust-login-phone')||{}).value||'').trim());
  const pin=(($('cust-login-pin')||{}).value||'').trim();
  if(!phone){ if(err) err.textContent='Укажите телефон'; return; }
  if(pin.length<4){ if(err) err.textContent='PIN от 4 цифр'; return; }
  if(!(state.companies||[]).length && typeof initCloudSync==='function'){
    if(err) err.textContent='Загрузка данных…';
    try{ await initCloudSync(); }catch(_){}
    if(typeof initPortalScopeFromPage==='function') initPortalScopeFromPage();
    const scopeHint=$('cust-login-scope');
    if(scopeHint){
      const label=portalScopeCarrierLabel();
      scopeHint.textContent=label?`Портал перевозчика: ${label}`:'';
      scopeHint.style.display=label?'block':'none';
    }
  }
  const co=findCustomerPortalCompany(phone, pin);
  if(!co){
    if(err) err.textContent='Нет доступа. Попросите перевозчика включить портал в карточке заказчика.';
    return;
  }
  currentCustomer={
    companyId:co.id, name:co.name, phone:formatPhone(co.portalPhone),
    spaceId:co.spaceId||null
  };
  saveCustomerSession();
  const seen=loadCustomerOrderSeen();
  customerOrders().forEach(o=>{ if(o&&o.id) seen[o.id]=customerOrderStatusTag(o); });
  saveCustomerOrderSeen(seen);
  showCustomerPortal();
}

function logoutCustomer(){
  currentCustomer=null;
  clearCustomerSession();
  if(getEntryMode()==='customer') openCustomerLogin();
  else show('roles');
}

const CUSTOMER_NOTIFY_KEY='armada_customer_notify_v1';
const CUSTOMER_ORDER_SEEN_KEY='armada_customer_order_seen_v1';

function customerOrderStatusLabel(o){
  if(!o) return '—';
  if(o.cancelledAt) return 'Отменён';
  if(looksClosedOrder(o)) return 'Закрыт';
  if(o.bookStatus==='rejected' && (typeof waitingLogistDriver==='function'?waitingLogistDriver(o.driverName):true) && !o.onExchange)
    return 'Бронь отклонена';
  if(o.onExchange) return 'Диспетчер ищет машину';
  if(o.startOdometer!=null || o.departOdometer!=null) return 'В работе';
  if(o.executorType==='partner') return 'Назначен';
  if(o.driverName && o.driverName!=='Биржа' && o.driverName!=='—' && o.driverName!=='Диспетчер') return 'Назначен';
  if(o.bookStatus==='requested') return 'Ждёт подтверждения брони';
  if(o.bookStatus==='confirmed') return 'Бронь подтверждена';
  if(o.fulfillment==='direct') return 'У перевозчика (свой парк)';
  return 'У диспетчера';
}
function customerOrderStatusTag(o){
  if(!o||!o.id) return '';
  return `${customerOrderStatusLabel(o)}|${o.driverName||''}|${o.onExchange?'1':'0'}|${o.bookStatus||''}|${o.closedAt||''}|${o.cancelledAt||''}`;
}
function loadCustomerOrderSeen(){
  try{ return JSON.parse(localStorage.getItem(CUSTOMER_ORDER_SEEN_KEY)||'{}'); }catch(_){ return {}; }
}
function saveCustomerOrderSeen(map){
  try{ localStorage.setItem(CUSTOMER_ORDER_SEEN_KEY, JSON.stringify(map||{})); }catch(_){}
}
function customerNotifyWanted(){
  try{ return localStorage.getItem(CUSTOMER_NOTIFY_KEY)==='1'; }catch(_){ return false; }
}
function setCustomerNotifyWanted(on){
  try{ localStorage.setItem(CUSTOMER_NOTIFY_KEY, on?'1':'0'); }catch(_){}
}
function customerNotifyActive(){
  return typeof armadaNotifyActive==='function' && armadaNotifyActive('customer');
}
async function enableCustomerNotifications(){
  if(typeof armadaRequestNotifyPermission!=='function'){
    alert('Уведомления недоступны'); return false;
  }
  const ok=await armadaRequestNotifyPermission('customer');
  if(!ok) alert('Разрешите уведомления в настройках браузера');
  const btn=$('cust-notify-toggle');
  if(btn) btn.textContent=customerNotifyActive()?'Уведомления: вкл':'Уведомления: выкл';
  return ok;
}
function maybeNotifyCustomerOrderUpdates(){
  if(!currentCustomer) return;
  const orders=customerOrders().slice(0,30);
  const seen=loadCustomerOrderSeen();
  const msgs=[];
  orders.forEach(o=>{
    if(!o||!o.id) return;
    const tag=customerOrderStatusTag(o);
    const prev=seen[o.id];
    if(prev && prev!==tag){
      msgs.push(`№${o.sequentialNumber||'—'}: ${customerOrderStatusLabel(o)}`);
    }
    seen[o.id]=tag;
  });
  saveCustomerOrderSeen(seen);
  if(!msgs.length) return;
  const body=msgs.slice(0,3).join(' · ');
  if(typeof armadaShowNotification==='function'){
    armadaShowNotification('АРМАДА · статус заявки', body, 'cust-status', 'customer');
  }
}
function customerOrders(){
  if(!currentCustomer) return [];
  return (state.orders||[]).filter(o=>o && o.customerId===currentCustomer.companyId)
    .sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
}

let customerRouteKm=null;
let customerRouteGeometry=null;
let customerRouteBusy=false;
let customerCal={year:new Date().getFullYear(), month:new Date().getMonth(), from:null};
let customerVehicleDateCal={year:new Date().getFullYear(), month:new Date().getMonth(), from:null};

function customerVehicleDateKeyFromInput(){
  const raw=(($('cust-vehicle-date')||{}).value||'').trim();
  if(typeof parseRuDate!=='function') return null;
  const d=parseRuDate(raw);
  if(!d) return null;
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function customerDateCalEnabled(){
  const cb=$('cust-vehicle-date-cal-toggle');
  return !!(cb && cb.checked);
}
function syncCustomerVehicleDateCalVisibility(){
  const box=$('cust-vehicle-date-cal');
  const wrap=$('cust-date-field-wrap');
  if(!box) return;
  const on=customerDateCalEnabled();
  box.hidden=!on;
  if(wrap) wrap.classList.toggle('cal-open', on);
  if(on) paintCustomerVehicleDateCal();
}
function setCustomerVehicleDateFromKey(key, closeCal){
  if(!key) return;
  const parts=key.split('-').map(Number);
  if(parts.length!==3) return;
  const [y,m,d]=parts;
  const dateEl=$('cust-vehicle-date');
  if(dateEl){
    const pad=n=>String(n).padStart(2,'0');
    dateEl.value=`${pad(d)}.${pad(m)}.${y}`;
    dateEl.dispatchEvent(new Event('input',{bubbles:true}));
    dateEl.dispatchEvent(new Event('change',{bubbles:true}));
  }
  customerVehicleDateCal.from=key;
  customerVehicleDateCal.year=y;
  customerVehicleDateCal.month=m-1;
  if(closeCal){
    const cb=$('cust-vehicle-date-cal-toggle');
    if(cb) cb.checked=false;
    syncCustomerVehicleDateCalVisibility();
  }else if(customerDateCalEnabled()){
    paintCustomerVehicleDateCal();
  }
  paintCustomerFleetOptions();
}
function paintCustomerVehicleDateCal(){
  const box=$('cust-vehicle-date-cal');
  if(!box || typeof monthCalHtml!=='function') return;
  if(!customerDateCalEnabled()){
    box.hidden=true;
    return;
  }
  box.hidden=false;
  const key=customerVehicleDateKeyFromInput()||customerVehicleDateCal.from;
  if(key){
    customerVehicleDateCal.from=key;
    const [y,m]=key.split('-').map(Number);
    customerVehicleDateCal.year=y;
    customerVehicleDateCal.month=m-1;
  }
  const cal=customerVehicleDateCal;
  const marked=new Set();
  const title=key
    ?(typeof driverHistDayLabel==='function'?driverHistDayLabel(key):key)
    :'Нажмите день — дата подставится в поле';
  box.innerHTML=monthCalHtml(cal, marked, {
    id:'cust-vehicle-date-cal-inner',
    dayAttr:'data-cust-vehicle-day',
    period:title,
    showReset:false
  });
  const todayKey=typeof dayKeyFromIso==='function'?dayKeyFromIso(new Date().toISOString()):'';
  box.querySelectorAll('[data-cust-vehicle-day]').forEach(btn=>{
    const dayKey=btn.getAttribute('data-cust-vehicle-day');
    if(todayKey && dayKey<todayKey){
      btn.disabled=true;
      btn.classList.add('past');
    }else if(key && dayKey===key){
      btn.classList.add('edge');
    }
    btn.onclick=()=>{
      if(todayKey && dayKey<todayKey) return;
      setCustomerVehicleDateFromKey(dayKey, true);
    };
  });
  const prev=box.querySelector('[data-cal-prev]');
  const next=box.querySelector('[data-cal-next]');
  if(prev) prev.onclick=()=>{
    cal.month--;
    if(cal.month<0){ cal.month=11; cal.year--; }
    paintCustomerVehicleDateCal();
  };
  if(next) next.onclick=()=>{
    cal.month++;
    if(cal.month>11){ cal.month=0; cal.year++; }
    paintCustomerVehicleDateCal();
  };
}

const CUST_CLOSED_VTYPE_IDS=['tent','container','van','metal'];
const CUST_ISOTHERM_VTYPE_ID='isotherm';
const CUST_MASTER_VTYPE_IDS=['tent','container','van','metal'];
const CUST_REFR_VTYPE_IDS=['reefer','reefer_partition','reefer_multimode'];
const CUST_OPEN_VTYPE_IDS=['board','open','dump','platform','shalanda'];
const CUST_CLOSED_MASTER_IDS=[...CUST_MASTER_VTYPE_IDS, CUST_ISOTHERM_VTYPE_ID];
const CUST_REFR_MASTER_IDS=[...CUST_REFR_VTYPE_IDS, CUST_ISOTHERM_VTYPE_ID];
const CUST_OPEN_MASTER_IDS=[...CUST_OPEN_VTYPE_IDS];
const CUST_REAR_AUTO_VTYPE_IDS=new Set(['container','van','metal','reefer','reefer_partition','reefer_multimode']);

function customerLoadMatchAll(){
  const el=$('cust-load-match-all');
  return !!(el&&el.checked);
}
function customerUnloadMatchAll(){
  const el=$('cust-unload-match-all');
  return !!(el&&el.checked);
}
function clearCustomerLoadUnloadMethods(){
  document.querySelectorAll('#cust-load-methods [data-load]').forEach(el=>{ el.checked=false; });
  document.querySelectorAll('#cust-unload-methods [data-unload]').forEach(el=>{ el.checked=false; });
}
function setCustomerLoadUnloadEnabled(on){
  document.querySelectorAll('#cust-load-methods [data-load], #cust-unload-methods [data-unload]').forEach(el=>{ el.disabled=!on; });
  ['cust-load-match-all','cust-unload-match-all'].forEach(id=>{
    const el=$(id);
    if(el){
      el.disabled=!on;
      if(!on) el.checked=false;
    }
  });
  ['cust-load-col','cust-unload-col'].forEach(id=>{
    const col=$(id);
    if(col) col.classList.toggle('is-disabled', !on);
  });
}

function customerSelectedVehicleTypes(){
  return [...document.querySelectorAll('#cust-vehicle-types [data-vtype]:checked')].map(el=>el.dataset.vtype).filter(Boolean);
}
function customerSelectedLoadMethods(){
  return [...document.querySelectorAll('#cust-load-methods [data-load]:checked')].map(el=>el.dataset.load).filter(Boolean);
}
function customerSelectedUnloadMethods(){
  return [...document.querySelectorAll('#cust-unload-methods [data-unload]:checked')].map(el=>el.dataset.unload).filter(Boolean);
}
function setCustomerLoadMethod(id, on){
  const el=document.querySelector(`#cust-load-methods [data-load="${id}"]`);
  if(el) el.checked=!!on;
}
function setCustomerUnloadMethod(id, on){
  const el=document.querySelector(`#cust-unload-methods [data-unload="${id}"]`);
  if(el) el.checked=!!on;
}
function setCustomerIsotherm(on){
  const el=document.querySelector(`#cust-vehicle-types [data-vtype="${CUST_ISOTHERM_VTYPE_ID}"]`);
  if(el) el.checked=!!on;
}
function syncCustomerClosedAllCheckbox(){
  const master=$('cust-vtype-closed-all');
  if(!master) return;
  master.checked=CUST_CLOSED_MASTER_IDS.every(id=>{
    const el=document.querySelector(`#cust-vehicle-types [data-vtype="${id}"]`);
    return el&&el.checked;
  });
}
function setCustomerClosedVehicleTypes(on){
  CUST_MASTER_VTYPE_IDS.forEach(id=>{
    const el=document.querySelector(`#cust-vehicle-types [data-vtype="${id}"]`);
    if(el) el.checked=!!on;
  });
  if(on) setCustomerIsotherm(true);
  else{
    const anyRefr=CUST_REFR_VTYPE_IDS.some(id=>{
      const el=document.querySelector(`#cust-vehicle-types [data-vtype="${id}"]`);
      return el&&el.checked;
    });
    if(!anyRefr) setCustomerIsotherm(false);
  }
}
function syncCustomerRefrAllCheckbox(){
  const master=$('cust-vtype-refr-all');
  if(!master) return;
  master.checked=CUST_REFR_MASTER_IDS.every(id=>{
    const el=document.querySelector(`#cust-vehicle-types [data-vtype="${id}"]`);
    return el&&el.checked;
  });
}
function setCustomerRefrVehicleTypes(on){
  CUST_REFR_VTYPE_IDS.forEach(id=>{
    const el=document.querySelector(`#cust-vehicle-types [data-vtype="${id}"]`);
    if(el) el.checked=!!on;
  });
  if(on) setCustomerIsotherm(true);
  else{
    const anyClosed=CUST_MASTER_VTYPE_IDS.some(id=>{
      const el=document.querySelector(`#cust-vehicle-types [data-vtype="${id}"]`);
      return el&&el.checked;
    });
    if(!anyClosed) setCustomerIsotherm(false);
  }
}
function syncCustomerOpenAllCheckbox(){
  const master=$('cust-vtype-open-all');
  if(!master) return;
  master.checked=CUST_OPEN_MASTER_IDS.every(id=>{
    const el=document.querySelector(`#cust-vehicle-types [data-vtype="${id}"]`);
    return el&&el.checked;
  });
}
function setCustomerOpenVehicleTypes(on){
  CUST_OPEN_VTYPE_IDS.forEach(id=>{
    const el=document.querySelector(`#cust-vehicle-types [data-vtype="${id}"]`);
    if(el) el.checked=!!on;
  });
}
function paintCustomerIsothermHighlight(){
  const el=document.querySelector(`#cust-vehicle-types [data-vtype="${CUST_ISOTHERM_VTYPE_ID}"]`);
  const wrap=el&&el.closest('.cust-vtype-isotherm');
  if(wrap) wrap.classList.toggle('is-highlight', !!(el&&el.checked));
}
function customerChecklistShortText(s, max){
  max=max||32;
  s=String(s||'').trim();
  if(!s) return '';
  return s.length<=max?s:s.slice(0,max-1)+'…';
}
const CUST_METHOD_SHORT={top:'верх.',side:'бок.',rear:'задн.',full_tent:'раст.',remove_crossbars:'перекл.',remove_posts:'стоек',no_gates:'б/ ворот',tail_lift:'гидр.',ramps:'апп.',crate:'обр.',boards:'борт.',side_both:'бок×2'};
function customerChecklistMethodShort(id){
  return CUST_METHOD_SHORT[id]||id;
}
function customerVehicleChecklistDetail(){
  const vehicleAt=readCustomerVehicleAt();
  if(vehicleAt&&typeof dateTime==='function') return dateTime(vehicleAt);
  const d=(($('cust-vehicle-date')||{}).value||'').trim();
  const t=(($('cust-vehicle-time')||{}).value||'').trim();
  if(d&&t) return `${d}, ${t}`;
  if(d||t) return 'уточните дату и время';
  return 'не заполнено';
}
function customerRouteChecklistDetail(){
  const load=(($('cust-load')||{}).value||'').trim();
  const unload=(($('cust-unload')||{}).value||'').trim();
  if(!load&&!unload) return 'не заполнено';
  if(!load||!unload) return load?`загрузка: ${customerChecklistShortText(load)}`:`выгрузка: ${customerChecklistShortText(unload)}`;
  let s=`${customerChecklistShortText(load,22)} → ${customerChecklistShortText(unload,22)}`;
  const loadNote=(($('cust-load-note')||{}).value||'').trim();
  const unloadNote=(($('cust-unload-note')||{}).value||'').trim();
  if(loadNote||unloadNote) s+=' · есть комментарии';
  if(customerRouteKm>0) s+=` · ≈${Math.round(customerRouteKm)} км`;
  const modeEl=$('cust-trip-mode-display');
  if(modeEl&&modeEl.textContent&&modeEl.textContent!=='—') s+=` · ${modeEl.textContent}`;
  return s;
}
function customerTransportChecklistSummary(){
  const types=customerSelectedVehicleTypes();
  if(!types.length) return null;
  const names=types.slice(0,3).map(id=>{
    const lbl=typeof custVehicleTypeLabel==='function'?custVehicleTypeLabel(id):id;
    return String(lbl).split(/\s+/)[0].toLowerCase();
  });
  let s=names.join(', ');
  if(types.length>3) s+=` и ещё ${types.length-3}`;
  const loads=customerSelectedLoadMethods();
  const unloads=customerSelectedUnloadMethods();
  if(loads.length) s+=`, загр.: ${loads.map(customerChecklistMethodShort).join(', ')}`;
  if(unloads.length) s+=`, выгр.: ${unloads.map(customerChecklistMethodShort).join(', ')}`;
  return s;
}
function customerCargoChecklistDetail(){
  const cargo=(($('cust-cargo-text')||{}).value||'').trim();
  const tons=customerWeightTons();
  const parts=[];
  if(tons>0){
    const t=tons>=1?(tons%1===0?tons:tons.toFixed(1)):tons.toFixed(2);
    const unit=(($('cust-weight-unit')||{}).value||'t')==='kg'?'кг':'т';
    parts.push(`${t} ${unit}`);
  }
  const places=customerCargoPlaces();
  if(places) parts.push(places+' мест');
  const vol=customerCargoVolumeM3();
  if(vol) parts.push(vol+' м³');
  const pack=customerCargoPackaging();
  if(pack&&typeof custPackagingLabel==='function') parts.push(custPackagingLabel(pack));
  if(cargo) parts.push(customerChecklistShortText(cargo,24));
  if(customerCargoFragile()) parts.push('хрупкий');
  const tempRange=formatCustomerTempRangeC(customerCargoTempFromC(), customerCargoTempToC());
  if(tempRange) parts.push(tempRange);
  return parts.length?parts.join(' · '):'не заполнено';
}
function customerTermsChecklistDetail(){
  const carrier=customerCarrierForForm();
  const parts=[];
  parts.push(customerSelectedFulfillment()==='direct'?'свой парк':'логисту');
  if(typeof customerCarrierPriceLabel==='function'&&carrier){
    parts.push(customerCarrierPriceLabel(carrier));
  }
  const priceRaw=(($('cust-price')||{}).value||'').replace(/\s/g,'').replace(',','.');
  const price=priceRaw?+priceRaw:null;
  parts.push(price>0?`${fmt(Math.round(price))} ₽`:'без цены');
  const plate=(($('cust-book-plate')||{}).value||'').trim();
  if(plate) parts.push(`бронь ${plate}`);
  return parts.join(' · ');
}
function customerFormReadyToSubmit(){
  if(!readCustomerVehicleAt()) return false;
  const load=(($('cust-load')||{}).value||'').trim();
  const unload=(($('cust-unload')||{}).value||'').trim();
  if(!load||!unload) return false;
  if(!customerSelectedVehicleTypes().length) return false;
  if(!(($('cust-cargo-text')||{}).value||'').trim()) return false;
  if(!(customerWeightTons()>0)) return false;
  return true;
}
function setCustomerChecklistItem(step, done, partial, detail){
  const item=document.querySelector(`.cust-checklist-item[data-cust-step="${step}"]`);
  const detailEl=$(`cust-check-${step}`);
  if(detailEl) detailEl.textContent=detail||'';
  if(item){
    item.classList.toggle('is-done', !!done);
    item.classList.toggle('is-partial', !!partial&&!done);
  }
}
function paintCustomerFormChecklist(){
  if(!$('cust-form-checklist')) return;
  const vehicleAt=!!readCustomerVehicleAt();
  const load=(($('cust-load')||{}).value||'').trim();
  const unload=(($('cust-unload')||{}).value||'').trim();
  const routeDone=!!(load&&unload);
  const routePartial=!!(load||unload);
  const vtypes=customerSelectedVehicleTypes();
  const cargo=(($('cust-cargo-text')||{}).value||'').trim();
  const tons=customerWeightTons();
  const cargoDone=!!(cargo&&tons>0);
  const cargoPartial=!!(cargo||tons>0);
  const datePartial=!!(($('cust-vehicle-date')||{}).value||'').trim()||!!(($('cust-vehicle-time')||{}).value||'').trim();
  setCustomerChecklistItem('vehicle', vehicleAt, !vehicleAt&&datePartial, customerVehicleChecklistDetail());
  setCustomerChecklistItem('route', routeDone, routePartial&&!routeDone, customerRouteChecklistDetail());
  setCustomerChecklistItem('transport', vtypes.length>0, false, vtypes.length?customerTransportChecklistSummary():'не заполнено');
  setCustomerChecklistItem('cargo', cargoDone, cargoPartial&&!cargoDone, customerCargoChecklistDetail());
  setCustomerChecklistItem('terms', true, false, customerTermsChecklistDetail());
  const ready=customerFormReadyToSubmit();
  const sideSubmit=$('cust-checklist-submit');
  if(sideSubmit) sideSubmit.disabled=!ready;
}
function wireCustomerFormChecklist(){
  document.querySelectorAll('.cust-checklist-item[data-cust-step]').forEach(btn=>{
    if(btn.dataset.scrollWired) return;
    btn.dataset.scrollWired='1';
    btn.onclick=()=>{
      const block=document.querySelector(`.cust-form-block[data-cust-step="${btn.dataset.custStep}"]`);
      if(block) block.scrollIntoView({behavior:'smooth', block:'start'});
    };
  });
  const sideSubmit=$('cust-checklist-submit');
  if(sideSubmit&&!sideSubmit.dataset.wired){
    sideSubmit.dataset.wired='1';
    sideSubmit.onclick=()=>{ const btn=$('cust-submit'); if(btn) btn.click(); };
  }
}
function customerPrimaryBodyType(types){
  types=types||customerSelectedVehicleTypes();
  if(types.some(id=>CUST_REFR_VTYPE_IDS.includes(id)||id==='reefer_meat')) return 'reefer';
  if(types.includes('isotherm') && !types.some(id=>CUST_CLOSED_VTYPE_IDS.includes(id))) return 'reefer';
  if(types.includes('dump')||types.includes('grain')) return 'dump';
  if(types.some(id=>CUST_OPEN_VTYPE_IDS.includes(id))) return 'board';
  for(const id of types){
    const meta=typeof custVehicleTypeMeta==='function'?custVehicleTypeMeta(id):null;
    if(meta&&meta.mapTo) return meta.mapTo;
  }
  if(types.length) return 'tent';
  return 'tent';
}
function applyRearOnlyVehicleTypeRules(){
  const types=customerSelectedVehicleTypes();
  const needRear=types.some(id=>CUST_REAR_AUTO_VTYPE_IDS.has(id));
  if(needRear){
    setCustomerLoadMethod('rear', true);
    setCustomerUnloadMethod('rear', true);
  }
}
function syncCustomerVehicleTypeUi(){
  const types=customerSelectedVehicleTypes();
  const hid=$('cust-body-type');
  if(hid) hid.value=customerPrimaryBodyType(types);
  setCustomerLoadUnloadEnabled(types.length>0);
  syncCustomerClosedAllCheckbox();
  syncCustomerRefrAllCheckbox();
  syncCustomerOpenAllCheckbox();
  paintCustomerIsothermHighlight();
  paintCustomerFormChecklist();
}
function syncCustomerBodyType(){
  syncCustomerVehicleTypeUi();
}
function resetCustomerVehicleTypes(){
  document.querySelectorAll('#cust-vehicle-types [data-vtype]').forEach(el=>{ el.checked=false; });
  document.querySelectorAll('#cust-load-methods [data-load]').forEach(el=>{ el.checked=false; });
  document.querySelectorAll('#cust-unload-methods [data-unload]').forEach(el=>{ el.checked=false; });
  const master=$('cust-vtype-closed-all');
  if(master) master.checked=false;
  const refrMaster=$('cust-vtype-refr-all');
  if(refrMaster) refrMaster.checked=false;
  const openMaster=$('cust-vtype-open-all');
  if(openMaster) openMaster.checked=false;
  ['cust-load-match-all','cust-unload-match-all'].forEach(id=>{
    const el=$(id); if(el){ el.checked=false; el.disabled=true; }
  });
  setCustomerLoadUnloadEnabled(false);
  const hid=$('cust-body-type');
  if(hid) hid.value='tent';
  syncCustomerVehicleTypeUi();
}
function wireCustomerVehicleTypeChange(el){
  if(!el.checked) clearCustomerLoadUnloadMethods();
  else if(CUST_REAR_AUTO_VTYPE_IDS.has(el.dataset.vtype)) applyRearOnlyVehicleTypeRules();
  if(CUST_MASTER_VTYPE_IDS.includes(el.dataset.vtype)||el.dataset.vtype===CUST_ISOTHERM_VTYPE_ID) syncCustomerClosedAllCheckbox();
  if(CUST_REFR_VTYPE_IDS.includes(el.dataset.vtype)||el.dataset.vtype===CUST_ISOTHERM_VTYPE_ID||el.dataset.vtype==='reefer_meat') syncCustomerRefrAllCheckbox();
  if(CUST_OPEN_VTYPE_IDS.includes(el.dataset.vtype)) syncCustomerOpenAllCheckbox();
  syncCustomerVehicleTypeUi();
  customerChatSyncFromForm();
  updateCustomerPricePreview();
  paintCustomerFleetOptions();
  filterCustomerVtypeSearch(($('cust-vtype-search')||{}).value||'');
  scheduleCustomerOrderDraftSave();
}
function initCustomerVtypeExtraList(){
  const box=$('cust-vtype-extra-list');
  if(!box||box.dataset.ready) return;
  box.dataset.ready='1';
  const extras=typeof custExtraVehicleTypes==='function'?custExtraVehicleTypes():[];
  box.innerHTML=`<div class="cust-vtype-extra-head">Другие типы кузова</div>${
    extras.map(t=>`<label class="cust-vtype-item cust-vtype-extra"><input type="checkbox" data-vtype="${esc(t.id)}" /> ${esc(t.ati)}</label>`).join('')
  }`;
  box.querySelectorAll('[data-vtype]').forEach(el=>{ el.onchange=()=>wireCustomerVehicleTypeChange(el); });
}
function filterCustomerVtypeSearch(raw){
  const q=String(raw||'').trim().toLowerCase();
  const bodyList=$('cust-vtype-body-list');
  const extraBox=$('cust-vtype-extra-list');
  if(!bodyList) return;
  const searching=!!q;
  bodyList.querySelectorAll('.cust-vtype-master, .cust-vtype-tree, .cust-vtype-isotherm').forEach(el=>{
    if(el.closest('#cust-vtype-extra-list')) return;
    el.hidden=searching;
  });
  bodyList.querySelectorAll('.cust-vtype-item').forEach(lbl=>{
    if(lbl.closest('#cust-vtype-extra-list')) return;
    const inp=lbl.querySelector('[data-vtype]');
    const meta=typeof custVehicleTypeMeta==='function'?custVehicleTypeMeta(inp&&inp.dataset.vtype):null;
    const match=!searching||(meta&&typeof custVtypeMatchesQuery==='function'?custVtypeMatchesQuery(meta,q):lbl.textContent.toLowerCase().includes(q));
    lbl.hidden=!match;
  });
  if(extraBox){
    extraBox.hidden=!searching;
    if(searching){
      extraBox.querySelectorAll('.cust-vtype-item').forEach(lbl=>{
        const inp=lbl.querySelector('[data-vtype]');
        const meta=typeof custVehicleTypeMeta==='function'?custVehicleTypeMeta(inp&&inp.dataset.vtype):null;
        lbl.hidden=!(meta&&typeof custVtypeMatchesQuery==='function'&&custVtypeMatchesQuery(meta,q));
      });
    }
  }
}
function wireCustomerVtypeSearch(){
  initCustomerVtypeExtraList();
  const inp=$('cust-vtype-search');
  if(!inp||inp.dataset.wired) return;
  inp.dataset.wired='1';
  inp.oninput=()=>filterCustomerVtypeSearch(inp.value);
  inp.onsearch=()=>filterCustomerVtypeSearch(inp.value);
}
function wireCustomerVehicleTypes(){
  const master=$('cust-vtype-closed-all');
  if(master){
    master.onchange=()=>{
      setCustomerClosedVehicleTypes(master.checked);
      if(!master.checked) clearCustomerLoadUnloadMethods();
      else applyRearOnlyVehicleTypeRules();
      syncCustomerVehicleTypeUi();
      updateCustomerPricePreview();
      paintCustomerFleetOptions();
    };
  }
  const refrMaster=$('cust-vtype-refr-all');
  if(refrMaster){
    refrMaster.onchange=()=>{
      setCustomerRefrVehicleTypes(refrMaster.checked);
      if(!refrMaster.checked) clearCustomerLoadUnloadMethods();
      else applyRearOnlyVehicleTypeRules();
      syncCustomerVehicleTypeUi();
      updateCustomerPricePreview();
      paintCustomerFleetOptions();
    };
  }
  const openMaster=$('cust-vtype-open-all');
  if(openMaster){
    openMaster.onchange=()=>{
      setCustomerOpenVehicleTypes(openMaster.checked);
      if(!openMaster.checked) clearCustomerLoadUnloadMethods();
      syncCustomerVehicleTypeUi();
      updateCustomerPricePreview();
      paintCustomerFleetOptions();
    };
  }
  document.querySelectorAll('#cust-vehicle-types [data-vtype]').forEach(el=>{
    el.onchange=()=>wireCustomerVehicleTypeChange(el);
  });
  document.querySelectorAll('#cust-load-methods [data-load], #cust-unload-methods [data-unload]').forEach(el=>{
    el.onchange=()=>{ updateCustomerPricePreview(); paintCustomerFleetOptions(); };
  });
  setCustomerLoadUnloadEnabled(false);
}
function inferCargoKindFromText(text){
  const q=String(text||'').toLowerCase();
  if(/продукт|молок|мяс|рыб|овощ|фрукт|холод|замороз/.test(q)) return 'food';
  if(/сып|навал|песок|щеб|зер|уголь|руда/.test(q)) return 'bulk';
  if(/гидроцилинд|гидро.?цилинд|труб(?:а|ы)?|балк|металлопрокат|негабарит|длинномер/.test(q)) return 'other';
  if(/другое|проч/.test(q)) return 'other';
  return 'general';
}
function syncCustomerCargoKind(){
  const text=(($('cust-cargo-text')||{}).value||'').trim();
  const hid=$('cust-cargo-kind');
  let kind=inferCargoKindFromText(text);
  const pack=customerCargoPackaging();
  if(pack==='bulk') kind='bulk';
  if(hid) hid.value=kind;
}
function customerWeightTons(){
  const raw=+(($('cust-weight-value')||{}).value||'').replace(',','.');
  if(!(raw>0)) return null;
  const unit=(($('cust-weight-unit')||{}).value||'t').trim();
  return unit==='kg'?raw/1000:raw;
}
function syncCustomerPayloadTons(){
  const tons=customerWeightTons();
  const hid=$('cust-req-pay');
  if(hid) hid.value=tons!=null?String(tons):'';
}
function syncCustomerCargoVolume(force){
  const volEl=$('cust-cargo-volume');
  if(!volEl) return;
  if(!force && volEl.dataset.manual==='1') return;
  const l=+(($('cust-req-l')||{}).value||'').replace(',','.');
  const w=+(($('cust-req-w')||{}).value||'').replace(',','.');
  const h=+(($('cust-req-h')||{}).value||'').replace(',','.');
  if(l>0&&w>0&&h>0){
    volEl.value=String(Math.round(l*w*h*10)/10);
    volEl.dataset.manual='0';
  }
}
function customerCargoPlaces(){
  const n=+($('cust-cargo-places')||{}).value;
  return n>0?Math.round(n):null;
}
function customerCargoVolumeM3(){
  const raw=+(($('cust-cargo-volume')||{}).value||'').replace(',','.');
  return raw>0?Math.round(raw*10)/10:null;
}
function customerCargoPackaging(){
  return (($('cust-cargo-packaging')||{}).value||'').trim()||null;
}
function customerCargoFragile(){
  const el=$('cust-cargo-fragile');
  return !!(el&&el.checked);
}
function customerTempInputC(id){
  const raw=+(($(id)||{}).value||'').replace(',','.');
  return Number.isFinite(raw)?raw:null;
}
function customerCargoTempFromC(){
  const on=$('cust-cargo-temp')&&$('cust-cargo-temp').checked;
  if(!on) return null;
  return customerTempInputC('cust-cargo-temp-from');
}
function customerCargoTempToC(){
  const on=$('cust-cargo-temp')&&$('cust-cargo-temp').checked;
  if(!on) return null;
  return customerTempInputC('cust-cargo-temp-to');
}
function formatCustomerTempC(v){
  const n=+v;
  if(!Number.isFinite(n)) return '';
  return (n>0?'+':'')+n;
}
function formatCustomerTempRangeC(from, to){
  const f=from!=null?formatCustomerTempC(from):'';
  const t=to!=null?formatCustomerTempC(to):'';
  if(f&&t) return f+'…'+t+'°C';
  if(f) return f+'°C';
  if(t) return 'до '+t+'°C';
  return null;
}
function syncCustomerTempField(){
  const on=$('cust-cargo-temp')&&$('cust-cargo-temp').checked;
  const wrap=$('cust-cargo-temp-range');
  if(wrap) wrap.hidden=!on;
  if(!on){
    ['cust-cargo-temp-from','cust-cargo-temp-to'].forEach(id=>{
      const inp=$(id); if(inp) inp.value='';
    });
  }
}
function customerCarrierForForm(){
  const co=findCompanyById(currentCustomer&&currentCustomer.companyId);
  return carrierOwnCompanyForSpace(co&&co.spaceId||currentCustomer&&currentCustomer.spaceId);
}
function customerSelectedBodyType(){
  syncCustomerBodyType();
  return (($('cust-body-type')||{}).value||'tent');
}
function customerSelectedCargoKind(){
  syncCustomerCargoKind();
  return (($('cust-cargo-kind')||{}).value||'general');
}
function customerSelectedTripMode(fin){
  return inferTripMode(customerRouteKm, fin);
}
function updateCustomerTripModeDisplay(fin){
  const badge=$('cust-trip-mode-display');
  const hid=$('cust-trip-mode');
  if(!badge) return;
  const km=customerRouteKm;
  if(!(km>0)){
    badge.textContent='—';
    badge.dataset.mode='';
    if(hid) hid.value='auto';
    paintCustomerFormChecklist();
    return;
  }
  const mode=inferTripMode(km, fin||normalizeFinance(state.finance));
  badge.textContent=tripModeLabel(mode);
  badge.dataset.mode=mode;
  if(hid) hid.value=mode;
  paintCustomerFormChecklist();
}
function renderCustomerRouteMap(geom){
  const box=$('cust-route-map');
  const wrap=$('cust-route-map-wrap');
  if(!box) return;
  if(!geom || !geom.from || !geom.to){
    box.innerHTML='';
    if(wrap) wrap.classList.remove('has-route');
    return;
  }
  if(wrap) wrap.classList.add('has-route');
  const coords=(geom.coordinates||[]).map(c=>({lon:+c[0], lat:+c[1]})).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
  const pts=coords.length?coords:[geom.from, geom.to].map(p=>({lon:p.lon, lat:p.lat}));
  let minLon=Infinity, maxLon=-Infinity, minLat=Infinity, maxLat=-Infinity;
  pts.forEach(p=>{
    minLon=Math.min(minLon, p.lon); maxLon=Math.max(maxLon, p.lon);
    minLat=Math.min(minLat, p.lat); maxLat=Math.max(maxLat, p.lat);
  });
  const padLon=(maxLon-minLon)*0.08||0.02;
  const padLat=(maxLat-minLat)*0.08||0.02;
  minLon-=padLon; maxLon+=padLon; minLat-=padLat; maxLat+=padLat;
  const w=320, h=160;
  const proj=p=>{
    const x=((p.lon-minLon)/(maxLon-minLon||1))*w;
    const y=h-((p.lat-minLat)/(maxLat-minLat||1))*h;
    return {x,y};
  };
  const line=pts.map(p=>{ const q=proj(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(' ');
  const a=proj(geom.from); const b=proj(geom.to);
  box.innerHTML=`<svg viewBox="0 0 ${w} ${h}" class="cust-route-svg" role="img" aria-label="Маршрут на карте">
    <defs><linearGradient id="custMapBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e8f0ea"/><stop offset="100%" stop-color="#dce8e0"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#custMapBg)" rx="12"/>
    <polyline points="${line}" fill="none" stroke="var(--accent,#2563eb)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${a.x.toFixed(1)}" cy="${a.y.toFixed(1)}" r="7" fill="#16a34a" stroke="#fff" stroke-width="2"/>
    <circle cx="${b.x.toFixed(1)}" cy="${b.y.toFixed(1)}" r="7" fill="#dc2626" stroke="#fff" stroke-width="2"/>
    <text x="12" y="18" class="cust-map-tag">A · загрузка</text>
    <text x="12" y="${h-8}" class="cust-map-tag">B · выгрузка</text>
  </svg>`;
}

function customerSelectedFulfillment(){
  return (($('cust-fulfillment')||{}).value||'logist')==='direct'?'direct':'logist';
}

function buildCustomerDraftFromForm(){
  const co=findCompanyById(currentCustomer&&currentCustomer.companyId);
  const carrier=carrierOwnCompanyForSpace(co&&co.spaceId||currentCustomer&&currentCustomer.spaceId);
  const payRaw=(($('cust-price')||{}).value||'').replace(/\s/g,'').replace(',','.');
  const payloadTons=customerWeightTons();
  const fin=carrier?financeForCompanyId(carrier.id):normalizeFinance(state.finance);
  const km=customerRouteKm>0?customerRouteKm:null;
  const trip=customerSelectedTripMode(fin);
  return {
    ownCompanyId:carrier&&carrier.id||null,
    estimateKm:km,
    routeKm:km,
    tripMode:trip,
    fulfillment:customerSelectedFulfillment(),
    reqBodyType:customerSelectedBodyType(),
    vehicleTypeIds:customerSelectedVehicleTypes(),
    loadingMethods:customerSelectedLoadMethods(),
    unloadingMethods:customerSelectedUnloadMethods(),
    loadMatchAll:customerLoadMatchAll(),
    unloadMatchAll:customerUnloadMatchAll(),
    cargoKind:customerSelectedCargoKind(),
    reqPayloadTons:payloadTons>0?payloadTons:null,
    cargoPlaces:customerCargoPlaces(),
    cargoVolumeM3:customerCargoVolumeM3(),
    cargoPackaging:customerCargoPackaging(),
    cargoFragile:customerCargoFragile(),
    cargoTempFromC:customerCargoTempFromC(),
    cargoTempToC:customerCargoTempToC(),
    estimateWorkHours:fin.minWorkHours||4,
    emptyKmBefore:0,
    loadedKm:null,
    emptyKmAfter:null,
    ratePerKmCash:fin.defaultRatePerKmCash,
    ratePerHourWork:fin.defaultRatePerHourWork,
    workHours:null,
    overnightNights:0,
    overnightStorageRateCash:null,
    priceOffer:payRaw?+payRaw:null
  };
}

function paintCustomerFleetOptions(){
  const box=$('cust-fleet-box');
  const sel=$('cust-book-plate');
  const hint=$('cust-fleet-hint');
  const fh=$('cust-fulfill-hint');
  const co=findCompanyById(currentCustomer&&currentCustomer.companyId);
  const carrier=carrierOwnCompanyForSpace(co&&co.spaceId||currentCustomer&&currentCustomer.spaceId);
  const hasPark=typeof companyHasOwnPark==='function' && companyHasOwnPark(carrier);
  const fulfillSel=$('cust-fulfillment');
  const directOpt=fulfillSel&&fulfillSel.querySelector('option[value="direct"]');
  if(directOpt) directOpt.hidden=!hasPark;
  if(!hasPark && fulfillSel) fulfillSel.value='logist';
  const mode=customerSelectedFulfillment();
  if(fh){
    fh.textContent=!hasPark
      ?'Диспетчер подберёт перевозчика. Ставка включена в цене.'
      :(mode==='direct'
      ?'Свой парк перевозчика, лучше заранее. Ставки логиста за срочный подбор нет. Можно запросить свободную машину — бронь подтвердит перевозчик.'
      :'Логисту / диспетчеру: закройте как можно скорее. Ставка включена в цене. Свободную машину можно запросить; точку в календаре поставит подтверждение.');
  }
  if(box) box.style.display=hasPark?'':'none';
  if(!hasPark || !sel) return;
  const payloadTons=customerWeightTons();
  const reqs={reqPayloadTons:payloadTons>0?payloadTons:null, reqBodyType:customerSelectedBodyType()};
  const at=typeof readCustomerVehicleAt==='function'?readCustomerVehicleAt():null;
  const list=(carrier && typeof availableFleetForCustomer==='function')
    ? availableFleetForCustomer(carrier.id, reqs, at)
    : [];
  const prev=sel.value;
  sel.innerHTML=`<option value="">Не бронировать — диспетчер подберёт</option>`+
    list.map(v=>{
      const spec=typeof vehicleSpecText==='function'?vehicleSpecText(v):'';
      return `<option value="${esc(v.plate)}">${esc(v.plate)}${spec?' · '+esc(spec):''}${v.makeModel?' · '+esc(v.makeModel):''}</option>`;
    }).join('');
  if(prev && list.some(v=>v.plate===prev)) sel.value=prev;
  if(hint){
    hint.textContent=list.length
      ?`Свободно ${list.length}. Запрос брони подтвердит перевозчик — после этого дата подачи будет в календаре.`
      :'Сейчас свободных машин нет — диспетчер подберёт как можно скорее (свой парк или партнёры).';
  }
  if(box) box.style.display='';
}

function paintCustomerBookingCal(){
  const box=$('cust-book-cal');
  if(!box || typeof monthCalHtml!=='function') return;
  const marked=new Set();
  customerOrders().forEach(o=>{
    const k=typeof confirmedBookingDayKey==='function'?confirmedBookingDayKey(o):'';
    if(k) marked.add(k);
  });
  const title=customerCal.from
    ?(typeof driverHistDayLabel==='function'?driverHistDayLabel(customerCal.from):customerCal.from)
    :'Точка — подтверждённая бронь на дату подачи';
  box.innerHTML=monthCalHtml(customerCal, marked, {
    id:'cust-book-cal-inner',
    dayAttr:'data-cust-cal-day',
    period:title,
    showReset:!!customerCal.from
  });
  const prev=box.querySelector('[data-cal-prev]');
  const next=box.querySelector('[data-cal-next]');
  const reset=box.querySelector('[data-cal-reset]');
  if(prev) prev.onclick=()=>{ customerCal.month--; if(customerCal.month<0){ customerCal.month=11; customerCal.year--; } renderCustomerPortal(); };
  if(next) next.onclick=()=>{ customerCal.month++; if(customerCal.month>11){ customerCal.month=0; customerCal.year++; } renderCustomerPortal(); };
  if(reset) reset.onclick=()=>{ customerCal.from=null; renderCustomerPortal(); };
  box.querySelectorAll('[data-cust-cal-day]').forEach(btn=>{
    btn.onclick=()=>{
      const key=btn.getAttribute('data-cust-cal-day');
      customerCal.from=customerCal.from===key?null:key;
      renderCustomerPortal();
    };
  });
}

async function refreshCustomerRouteKm(){
  const load=(($('cust-load')||{}).value||'').trim();
  const unload=(($('cust-unload')||{}).value||'').trim();
  const hint=$('cust-route-km-hint');
  const co=findCompanyById(currentCustomer&&currentCustomer.companyId);
  const carrier=carrierOwnCompanyForSpace(co&&co.spaceId||currentCustomer&&currentCustomer.spaceId);
  const fin=carrier?financeForCompanyId(carrier.id):normalizeFinance(state.finance);
  if(load.length<4 || unload.length<4){
    customerRouteKm=null;
    customerRouteGeometry=null;
    renderCustomerRouteMap(null);
    updateCustomerTripModeDisplay(fin);
    if(hint) hint.textContent='Укажите адреса — построим маршрут для грузового транспорта.';
    updateCustomerPricePreview();
    return;
  }
  if(customerRouteBusy) return;
  customerRouteBusy=true;
  if(hint) hint.textContent='Строим маршрут для грузового транспорта…';
  try{
    const geom=typeof estimateRouteGeometry==='function'?await estimateRouteGeometry(load, unload):null;
    customerRouteGeometry=geom;
    customerRouteKm=geom&&geom.km>0?geom.km:null;
    renderCustomerRouteMap(geom);
    updateCustomerTripModeDisplay(fin);
    if(hint){
      hint.textContent=customerRouteKm
        ?`≈ ${customerRouteKm} км · ${tripModeLabel(inferTripMode(customerRouteKm, fin))}. Маршрут для грузовиков (ориентир; знаки 3,5т и габариты учитываются при уточнении диспетчером).`
        :'Маршрут не определился — заявку можно отправить, детали уточнит перевозчик.';
    }
  }catch(_){
    customerRouteKm=null;
    customerRouteGeometry=null;
    renderCustomerRouteMap(null);
    updateCustomerTripModeDisplay(fin);
    if(hint) hint.textContent='Маршрут не определился — заявку можно отправить, детали уточнит перевозчик.';
  }
  customerRouteBusy=false;
  updateCustomerPricePreview();
}

function updateCustomerPricePreview(){
  const box=$('cust-price-preview');
  if(!box) return;
  const draft=buildCustomerDraftFromForm();
  if(!draft.ownCompanyId){
    box.innerHTML='<div class="hint">Тариф перевозчика не настроен — свяжитесь с диспетчером.</div>';
    paintCustomerFormChecklist();
    return;
  }
  const bits=[];
  if(draft.tripMode) bits.push(tripModeLabel(draft.tripMode));
  if(draft.reqBodyType) bits.push(bodyTypeLabel(draft.reqBodyType));
  if(draft.vehicleTypeIds&&draft.vehicleTypeIds.length){
    bits.push(draft.vehicleTypeIds.map(id=>custVehicleTypeLabel(id)).join(', '));
  }
  if(draft.cargoKind) bits.push(cargoKindLabel(draft.cargoKind));
  if(draft.reqPayloadTons) bits.push(draft.reqPayloadTons+' т');
  if(draft.cargoPlaces) bits.push(draft.cargoPlaces+' мест');
  if(draft.cargoVolumeM3) bits.push(draft.cargoVolumeM3+' м³');
  if(draft.cargoPackaging&&typeof custPackagingLabel==='function') bits.push(custPackagingLabel(draft.cargoPackaging));
  const carrier=customerCarrierForForm();
  const s=suggestCustomerOrderPrice(draft);
  if(!s){
    box.innerHTML=`
      <div class="hint">${esc(bits.join(' · '))}</div>
      <div class="hint">Ориентир цены появится, когда по адресам посчитается км (или если в тарифе заданы ₽/час). Заявку можно отправить — цену уточнит перевозчик.</div>`;
    paintCustomerFormChecklist();
    return;
  }
  const clientAmount=typeof customerOrderClientPriceAmount==='function'
    ?Math.round(customerOrderClientPriceAmount(s))
    :Math.round(s.minimumCash);
  const carrierAmount=typeof customerCarrierPriceAmount==='function'
    ?Math.round(customerCarrierPriceAmount(s, carrier))
    :clientAmount;
  const payLabel=typeof customerCarrierPriceLabel==='function'&&carrier?customerCarrierPriceLabel(carrier):'';
  const payHint=typeof customerCarrierPriceHint==='function'&&carrier?customerCarrierPriceHint(carrier):'';
  const feeNote=draft.fulfillment!=='direct'?' (ставка логиста в цене)':'';
  box.innerHTML=`
    <div class="calc-row"><span>Ориентир / минимум</span><span><b>${fmt(clientAmount)} ₽</b>${feeNote}</span></div>
    <div class="calc-row"><span>К оплате перевозчику</span><span><b>${fmt(carrierAmount)} ₽</b>${payLabel?` (${payLabel})`:''}</span></div>
    <div class="hint">${esc(bits.concat([s.summary||'']).filter(Boolean).join(' · '))}</div>
    <div class="hint">${esc(payHint||'Это ориентир. Через логиста в сумму входит его ставка за срочный подбор.')}</div>`;
  const priceEl=$('cust-price');
  if(priceEl && priceEl.dataset.auto!=='0'){
    priceEl.value=String(clientAmount);
    priceEl.dataset.auto='1';
  }
  paintCustomerFormChecklist();
}

function showCustomerPortal(){
  if(!currentCustomer && !restoreCustomerSession()){
    openCustomerLogin();
    return;
  }
  renderCustomerPortal();
  maybePromptCustomerOrderDraft();
  show('customer-portal');
  if(window.ArmadaOnboarding) ArmadaOnboarding.maybeCustomer();
}

function renderCustomerPortal(){
  const co=findCompanyById(currentCustomer.companyId);
  const carrier=carrierOwnCompanyForSpace(co&&co.spaceId);
  const head=$('cust-portal-head');
  if(head) head.textContent=co?co.name:'Заказчик';
  const sub=$('cust-portal-sub');
  if(sub) sub.textContent=carrier
    ?`Перевозчик: ${carrier.name}${typeof companyVatPayerLabel==='function'?' · '+companyVatPayerLabel(carrier):''}`
    :'';
  const loadEl=$('cust-load');
  const unloadEl=$('cust-unload');
  const pendingDraft=loadCustomerOrderDraftRaw();
  const hasPendingDraft=pendingDraft&&customerOrderDraftHasContent(pendingDraft);
  if(loadEl && !hasPendingDraft && co&&co.loadingAddresses&&co.loadingAddresses[0] && !loadEl.value) loadEl.value=co.loadingAddresses[0];
  if(unloadEl && !hasPendingDraft && co&&co.unloadingAddresses&&co.unloadingAddresses[0] && !unloadEl.value) unloadEl.value=co.unloadingAddresses[0];
  syncCustomerVehicleTypeUi();
  syncCustomerVehicleDateCalVisibility();
  syncCustomerTempField();
  if(typeof wireVehicleAtHint==='function') wireVehicleAtHint('cust', ()=>{
    if(customerDateCalEnabled()) paintCustomerVehicleDateCal();
    paintCustomerFleetOptions();
  });
  if((loadEl&&loadEl.value) && (unloadEl&&unloadEl.value)) refreshCustomerRouteKm();
  else updateCustomerTripModeDisplay(carrier?financeForCompanyId(carrier.id):normalizeFinance(state.finance));
  paintCustomerFleetOptions();
  paintCustomerBookingCal();
  const list=$('cust-orders-list');
  if(list){
    const orders=customerOrders().slice(0,20);
    const day=customerCal.from;
    const shown=day?orders.filter(o=>{
      const k=typeof dayKeyFromIso==='function'?dayKeyFromIso(o.vehicleAt||o.createdAt):'';
      return k===day;
    }):orders;
    list.innerHTML=shown.length?shown.map(o=>{
      const st=customerOrderStatusLabel(o);
      const stCls=o.cancelledAt?'closed':looksClosedOrder(o)?'closed':o.bookStatus==='confirmed'?'closed':o.bookStatus==='requested'?'inbox':o.onExchange?'exchange':(o.startOdometer!=null?'progress':(typeof waitingLogistDriver==='function'&&waitingLogistDriver(o.driverName)?'inbox':''));
      const bookLine=o.bookedPlate
        ?(o.bookStatus==='confirmed'
          ?`бронь ${o.bookedPlate} подтверждена`
          :o.bookStatus==='rejected'
            ?`бронь ${o.bookedPlate} отклонена`
            :`запрос брони ${o.bookedPlate}`)
        :'';
      return `<div class="card" style="margin-bottom:8px">
        <h3>№ ${esc(o.sequentialNumber||'—')} · <span class="order-status ${stCls}">${esc(st)}</span></h3>
        <p class="meta">${esc(routeText(o))}</p>
        <p class="meta">${esc(o.ownCompanyName||'Диспетчер')}${bookLine?` · ${esc(bookLine)}`:''}${o.fulfillment==='direct'?' · свой парк':''}</p>
        <p class="meta">${o.executorType==='partner'?'':(o.driverName&&o.driverName!=='Биржа'&&o.driverName!=='Диспетчер'?`Водитель: ${esc(o.driverName)} · `:'')}${o.pricePending?'Цена: уточнит диспетчер · ':o.priceForClient?`Цена: ${fmt(o.priceForClient)} ₽ · `:''}${esc(dateTime(o.createdAt))}</p>
        ${orderReqText(o)?`<p class="meta">${esc(orderReqText(o))}</p>`:''}
      </div>`;
    }).join(''):(day?'<div class="empty">На эту дату заявок нет</div>':'<div class="empty">Заявок ещё нет</div>');
  }
  updateCustomerPricePreview();
  const notifyBtn=$('cust-notify-toggle');
  if(notifyBtn) notifyBtn.textContent=customerNotifyActive()?'Уведомления: вкл':'Уведомления: выкл';
  maybeNotifyCustomerOrderUpdates();
  paintCustomerFormChecklist();
}

function readCustomerVehicleAt(){
  if(typeof readVehicleAtFromDom==='function') return readVehicleAtFromDom('cust');
  const d=(($('cust-vehicle-date')||{}).value||'').trim();
  const t=(($('cust-vehicle-time')||{}).value||'').trim();
  if(!d) return null;
  if(typeof fromRuDateTimeParts==='function') return fromRuDateTimeParts(d, t||'08:00');
  const iso=`${d}T${t||'08:00'}:00`;
  const dt=new Date(iso);
  return Number.isNaN(dt.getTime())?null:dt.toISOString();
}

function showCustomerSubmitError(msg){
  const text=String(msg||'').trim();
  const formErr=$('cust-form-error');
  const chatErr=$('cust-chat-error');
  if(formErr) formErr.textContent=text;
  if(chatErr&&customerOrderMode()==='chat') chatErr.textContent=text;
}
function submitCustomerOrder(){
  const err=$('cust-form-error');
  if(customerChat.data&&Object.keys(customerChat.data).length) customerChatApplyToForm();
  if(!currentCustomer){ showCustomerSubmitError('Войдите снова'); return; }
  const co=findCompanyById(currentCustomer.companyId);
  const carrier=carrierOwnCompanyForSpace(co&&co.spaceId);
  if(!carrier){ showCustomerSubmitError('Перевозчик не найден'); return; }
  const load=(($('cust-load')||{}).value||'').trim();
  const unload=(($('cust-unload')||{}).value||'').trim();
  const loadingContactName=(($('cust-loading-contact-name')||{}).value||'').trim();
  const loadingContactPhone=formatPhone((($('cust-loading-contact-phone')||{}).value||'').trim());
  const unloadingContactName=(($('cust-unloading-contact-name')||{}).value||'').trim();
  const unloadingContactPhone=formatPhone((($('cust-unloading-contact-phone')||{}).value||'').trim());
  const contactName=loadingContactName||loadingContactPhone||'';
  const contactPhone=loadingContactPhone||'';
  const cargoText=(($('cust-cargo-text')||{}).value||'').trim();
  syncCustomerPayloadTons();
  const payloadTons=customerWeightTons();
  const vehicleAt=readCustomerVehicleAt();
  if(!load||!unload){ showCustomerSubmitError('Укажите адреса загрузки и выгрузки'); return; }
  if(!vehicleAt){ showCustomerSubmitError('Укажите дату и время подачи ТС'); return; }
  if(!(payloadTons>0)){ showCustomerSubmitError('Укажите вес груза'); return; }
  if(!cargoText){ showCustomerSubmitError('Укажите, что за груз'); return; }
  const vtypes=customerSelectedVehicleTypes();
  if(!vtypes.length){ showCustomerSubmitError('Выберите хотя бы один тип ТС'); return; }
  const cargo=customerSelectedCargoKind();
  if(cargo==='food' && !vtypes.some(id=>CUST_REFR_VTYPE_IDS.includes(id)||id==='isotherm')){
    if(!confirm('Для продуктов обычно нужен изотермический кузов или рефрижератор. Отправить как есть?')) return;
  }
  const draft=buildCustomerDraftFromForm();
  const quote=suggestCustomerOrderPrice(draft);
  const min=quote&&typeof customerOrderClientPriceAmount==='function'
    ?Math.round(customerOrderClientPriceAmount(quote))
    :(quote?Math.round(quote.minimumCash):null);
  let offered=draft.priceOffer!=null?Math.round(draft.priceOffer):min;
  if(min!=null && offered!=null && offered<min){
    const payLabel=typeof customerCarrierPriceLabel==='function'?customerCarrierPriceLabel(carrier):'';
    if(err) showCustomerSubmitError(`Цена не может быть ниже ориентира (${fmt(min)} ₽${payLabel?`, ${payLabel}`:''})`);
    updateCustomerPricePreview();
    return;
  }
  const bookedPlate=(($('cust-book-plate')||{}).value||'').trim();
  if(bookedPlate && typeof vehicleBusyAt==='function' && vehicleBusyAt(bookedPlate, vehicleAt)){
    if(err) showCustomerSubmitError('Эта машина уже занята на это время. Выберите другую или не бронируйте.');
    paintCustomerFleetOptions();
    return;
  }
  const spaceId=co.spaceId||carrier.spaceId||null;
  const guardFn=typeof billingGuardWithServer==='function'?billingGuardWithServer:billingGuard;
  Promise.resolve(guardFn(spaceId,'create_order')).then(g=>{
    if(!g.ok){ showCustomerSubmitError(g.message); return; }
    submitCustomerOrderAfterGuard(co, carrier, spaceId, load, unload, contactName, contactPhone, loadingContactName, loadingContactPhone, unloadingContactName, unloadingContactPhone, cargoText, payloadTons, vehicleAt, draft, offered, min, err, !quote, bookedPlate, quote);
  });
}
function submitCustomerOrderAfterGuard(co, carrier, spaceId, load, unload, contactName, contactPhone, loadingContactName, loadingContactPhone, unloadingContactName, unloadingContactPhone, cargoText, payloadTons, vehicleAt, draft, offered, min, err, pricePending, bookedPlate, quote){
  const spaceAdm=(state.admins||[]).find(a=>a.spaceId===spaceId);
  const seqNo=nextSequentialNumber();
  const now=new Date().toISOString();
  const loadingNote=(($('cust-load-note')||{}).value||'').trim();
  const unloadingNote=(($('cust-unload-note')||{}).value||'').trim();
  const order={
    id:uuid(), sequentialNumber:seqNo, dayNumber:1,
    createdAt:now, source:'customer_portal', customerSubmitted:true,
    ownerAdminId:spaceAdm&&spaceAdm.id||null,
    ownerAdminName:spaceAdm&&spaceAdm.name||'',
    spaceId,
    customer:co.name, customerId:co.id, customerInn:co.inn||'',
    ownCompanyId:carrier.id, ownCompanyName:carrier.name,
    contactName:contactName||contactPhone||'',
    contactPhone:contactPhone||co.portalPhone||'',
    loadingContactName, loadingContactPhone,
    unloadingContactName, unloadingContactPhone,
    cargoDescription:cargoText||'',
    cargoPlaces:draft.cargoPlaces||null,
    cargoVolumeM3:draft.cargoVolumeM3||null,
    cargoPackaging:draft.cargoPackaging||null,
    cargoFragile:!!draft.cargoFragile,
    cargoTempFromC:draft.cargoTempFromC,
    cargoTempToC:draft.cargoTempToC,
    loadingAddressNote:loadingNote||'',
    unloadingAddressNote:unloadingNote||'',
    loadingAddress:load, unloadingAddress:unload,
    routePoints:defaultRoutePoints(load, unload),
    vehicleAt,
    vehiclePlate:'—', driverName:'Диспетчер', driverPercent:0,
    executorType:'logist', onExchange:false,
    fulfillment:draft.fulfillment||'logist',
    bookedPlate:bookedPlate||null,
    bookStatus:bookedPlate?'requested':null,
    bookConfirmedAt:null,
    exchangeListedAt:null, wasOnExchange:false,
    partnerSpaceId:null,
    reqPayloadTons:payloadTons,
    reqBodyType:draft.reqBodyType||null,
    vehicleTypeIds:draft.vehicleTypeIds||[],
    loadingMethods:draft.loadingMethods||[],
    unloadingMethods:draft.unloadingMethods||[],
    loadMatchAll:!!draft.loadMatchAll,
    unloadMatchAll:!!draft.unloadMatchAll,
    cargoKind:draft.cargoKind||null,
    tripMode:draft.tripMode||null,
    routeKm:draft.routeKm||null,
    reqLengthM:numOrNull((($('cust-req-l')||{}).value)),
    reqWidthM:numOrNull((($('cust-req-w')||{}).value)),
    reqHeightM:numOrNull((($('cust-req-h')||{}).value)),
    estimateKm:draft.routeKm||draft.estimateKm||null,
    estimateWorkHours:draft.estimateWorkHours,
    emptyKmBefore:0,
    pricePending:!!pricePending || offered==null,
    priceForClient:offered||null,
    rateCash:offered||null,
    paymentForm:typeof customerCarrierPaymentForm==='function'?customerCarrierPaymentForm(carrier):'withoutVat',
    transportApp:null
  };
  if(offered){
    const payForm=typeof customerCarrierPaymentForm==='function'?customerCarrierPaymentForm(carrier):'withoutVat';
    const t=fillRatesFrom(payForm, offered);
    order.paymentForm=payForm;
    order.rateWithoutVat=t.withoutVat;
    order.rateWithVat=t.withVat;
    order.rateCash=t.cash;
    order.freight=payForm==='withVat'?t.withVat:(payForm==='withoutVat'?t.withoutVat:t.cash);
    const feePct=quote&&quote.logistFeePercent>0?+quote.logistFeePercent:0;
    if(draft.fulfillment!=='direct' && feePct>0){
      order.priceForCarrier=Math.round(offered/(1+feePct/100));
    }
  }
  ensureRoutePoints(order);
  applyOrderSchedule(order);
  bumpDataEpoch('customer-portal-order');
  upsertOrder(order);
  persist();
  if(err) showCustomerSubmitError('');
  const chatErr=$('cust-chat-error'); if(chatErr) chatErr.textContent='';
  const priceBit=order.pricePending
    ?'Цену уточнит диспетчер.'
    :`Ориентир ${fmt(min||offered)} ₽${typeof customerCarrierPriceLabel==='function'&&carrier?' ('+customerCarrierPriceLabel(carrier)+')':''}${order.fulfillment==='direct'?'':' (ставка логиста в цене)'}.`;
  const bookBit=order.bookedPlate
    ?` Запрос брони ${order.bookedPlate}: перевозчик подтвердит — тогда дата подачи появится в календаре.`
    :' Диспетчер подберёт машину.';
  const rushBit=order.fulfillment==='direct'
    ?' Заявка в свой парк, без срочного подбора.'
    :' Диспетчеру: закрыть как можно скорее.';
  alert(`Заявка №${seqNo} отправлена.${rushBit}${bookBit} ${priceBit}`);
  ['cust-load','cust-unload','cust-load-note','cust-unload-note','cust-loading-contact-name','cust-loading-contact-phone','cust-unloading-contact-name','cust-unloading-contact-phone','cust-cargo-text','cust-cargo-places','cust-cargo-volume','cust-weight-value','cust-price','cust-req-l','cust-req-w','cust-req-h','cust-cargo-temp-from','cust-cargo-temp-to'].forEach(id=>{
    const el=$(id); if(el) el.value='';
  });
  const priceReset=$('cust-price'); if(priceReset) delete priceReset.dataset.auto;
  const packEl=$('cust-cargo-packaging'); if(packEl) packEl.value='';
  const fragileEl=$('cust-cargo-fragile'); if(fragileEl) fragileEl.checked=false;
  const tempEl=$('cust-cargo-temp'); if(tempEl) tempEl.checked=false;
  syncCustomerTempField();
  const volEl=$('cust-cargo-volume'); if(volEl) volEl.dataset.manual='0';
  resetCustomerVehicleTypes();
  customerRouteKm=null;
  customerRouteGeometry=null;
  renderCustomerRouteMap(null);
  if($('cust-vehicle-date')) $('cust-vehicle-date').value='';
  if($('cust-vehicle-time')) $('cust-vehicle-time').value='';
  customerVehicleDateCal.from=null;
  const calToggle=$('cust-vehicle-date-cal-toggle');
  if(calToggle) calToggle.checked=false;
  syncCustomerVehicleDateCalVisibility();
  if($('cust-body-type')) $('cust-body-type').value='tent';
  if($('cust-book-plate')) $('cust-book-plate').value='';
  if(customerOrderMode()==='chat') initCustomerChatWizard(true);
  clearCustomerOrderDraft();
  clearCustomerChatState();
  renderCustomerPortal();
}

/* --- Чат-помощник (гибрид форма + чат, MVP без ИИ) --- */
const CUST_CHAT_MODE_KEY='armada_customer_order_mode_v1';
const CUST_CHAT_STEPS=[
  {id:'cargo', title:'Груз'},
  {id:'weight', title:'Вес'},
  {id:'when', title:'Когда'},
  {id:'load', title:'Загрузка'},
  {id:'unload', title:'Выгрузка'},
  {id:'body', title:'Кузов'},
  {id:'summary', title:'Подтверждение'}
];
const CUST_CHAT_BODY_CHIPS=[
  {id:'tent', label:'Тент', vtype:'tent'},
  {id:'van', label:'Фургон', vtype:'van'},
  {id:'reefer', label:'Реф', vtype:'reefer'},
  {id:'platform', label:'Площадка', vtype:'platform'},
  {id:'other', label:'Другое → форма', vtype:null}
];
const CUST_CHAT_STATE_KEY='armada_customer_chat_state_v1';
const CUST_ORDER_DRAFT_PREFIX='armada_customer_order_draft_v1';
const CUST_ORDER_DRAFT_TTL_MS=7*24*60*60*1000;
const CUST_ORDER_DRAFT_FIELD_IDS=[
  'cust-cargo-text','cust-cargo-places','cust-cargo-volume','cust-cargo-packaging',
  'cust-cargo-temp-from','cust-cargo-temp-to','cust-weight-value','cust-weight-unit',
  'cust-vehicle-date','cust-vehicle-time','cust-load','cust-unload',
  'cust-load-note','cust-unload-note','cust-loading-contact-name','cust-loading-contact-phone',
  'cust-unloading-contact-name','cust-unloading-contact-phone','cust-price',
  'cust-req-l','cust-req-w','cust-req-h','cust-book-plate','cust-fulfillment',
  'cust-body-type','cust-cargo-kind','cust-trip-mode'
];
const CUST_ORDER_DRAFT_CHECK_IDS=['cust-cargo-fragile','cust-cargo-temp','cust-vehicle-date-cal-toggle','cust-load-match-all','cust-unload-match-all'];
let customerChat={messages:[], stepIndex:0, data:{}, summaryReady:false};
let customerDraftSaveTimer=null;
let customerDraftApplying=false;
let customerDraftPromptLoaded=null;

function customerOrderDraftKey(){
  const id=currentCustomer&&currentCustomer.companyId;
  return id?`${CUST_ORDER_DRAFT_PREFIX}_${id}`:null;
}
function customerDraftTimeLabel(iso){
  if(!iso) return '';
  if(typeof dateTime==='function') return dateTime(iso);
  try{
    const d=new Date(iso);
    if(Number.isNaN(d.getTime())) return '';
    const pad=n=>String(n).padStart(2,'0');
    return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }catch(_){ return ''; }
}
function loadCustomerOrderDraftRaw(){
  const key=customerOrderDraftKey();
  if(!key) return null;
  try{
    const raw=JSON.parse(localStorage.getItem(key)||'null');
    if(!raw||!raw.savedAt) return null;
    const age=Date.now()-new Date(raw.savedAt).getTime();
    if(!(age>=0) || age>CUST_ORDER_DRAFT_TTL_MS){
      localStorage.removeItem(key);
      return null;
    }
    return raw;
  }catch(_){ return null; }
}
function customerOrderDraftHasContent(d){
  if(!d) return false;
  const f=d.fields||{};
  const textKeys=['cust-cargo-text','cust-load','cust-unload','cust-weight-value','cust-load-note','cust-unload-note',
    'cust-loading-contact-name','cust-loading-contact-phone','cust-unloading-contact-name','cust-unloading-contact-phone',
    'cust-cargo-places','cust-cargo-volume','cust-vehicle-date','cust-vehicle-time','cust-price'];
  if(textKeys.some(id=>String(f[id]||'').trim())) return true;
  if((d.vehicleTypes||[]).length) return true;
  if((d.loadMethods||[]).length || (d.unloadMethods||[]).length) return true;
  const chat=d.chat||{};
  if((chat.messages||[]).length>1) return true;
  if(chat.data && Object.keys(chat.data).length) return true;
  return false;
}
function collectCustomerOrderDraft(){
  if(!currentCustomer) return null;
  if(customerOrderMode()==='chat') customerChatSyncFromForm();
  const fields={};
  CUST_ORDER_DRAFT_FIELD_IDS.forEach(id=>{
    const el=$(id);
    if(!el) return;
    fields[id]=el.value;
  });
  CUST_ORDER_DRAFT_CHECK_IDS.forEach(id=>{
    const el=$(id);
    if(!el) return;
    fields[id]=!!el.checked;
  });
  const priceEl=$('cust-price');
  const volEl=$('cust-cargo-volume');
  return {
    v:1,
    companyId:currentCustomer.companyId,
    savedAt:new Date().toISOString(),
    mode:customerOrderMode(),
    fields,
    vehicleTypes:customerSelectedVehicleTypes(),
    loadMethods:customerSelectedLoadMethods(),
    unloadMethods:customerSelectedUnloadMethods(),
    routeKm:customerRouteKm>0?customerRouteKm:null,
    bookCalFrom:customerCal.from||null,
    vehicleDateCal:{year:customerVehicleDateCal.year, month:customerVehicleDateCal.month, from:customerVehicleDateCal.from||null},
    priceAuto:priceEl&&priceEl.dataset.auto!=null?priceEl.dataset.auto:null,
    volumeManual:volEl&&volEl.dataset.manual!=null?volEl.dataset.manual:null,
    chat:{
      messages:customerChat.messages.slice(),
      stepIndex:customerChat.stepIndex,
      data:Object.assign({}, customerChat.data||{}),
      summaryReady:!!customerChat.summaryReady
    }
  };
}
function persistCustomerOrderDraft(){
  if(customerDraftApplying || !currentCustomer) return;
  const key=customerOrderDraftKey();
  if(!key) return;
  try{
    const draft=collectCustomerOrderDraft();
    if(!customerOrderDraftHasContent(draft)){
      localStorage.removeItem(key);
      hideCustomerDraftBanner();
      return;
    }
    localStorage.setItem(key, JSON.stringify(draft));
  }catch(_){}
}
function scheduleCustomerOrderDraftSave(){
  if(customerDraftApplying || !currentCustomer) return;
  clearTimeout(customerDraftSaveTimer);
  customerDraftSaveTimer=setTimeout(persistCustomerOrderDraft, 500);
}
function clearCustomerOrderDraft(){
  const key=customerOrderDraftKey();
  if(key){ try{ localStorage.removeItem(key); }catch(_){} }
  customerDraftPromptLoaded=null;
  hideCustomerDraftBanner();
}
function hideCustomerDraftBanner(){
  const box=$('cust-draft-banner');
  if(box) box.hidden=true;
}
function showCustomerDraftBanner(draft){
  const box=$('cust-draft-banner');
  const text=$('cust-draft-banner-text');
  if(!box||!text||!draft) return;
  text.textContent=`Есть черновик заявки от ${customerDraftTimeLabel(draft.savedAt)}. Восстановить?`;
  box.hidden=false;
}
function applyCustomerOrderDraft(draft){
  if(!draft) return;
  customerDraftApplying=true;
  try{
    const f=draft.fields||{};
    CUST_ORDER_DRAFT_FIELD_IDS.forEach(id=>{
      const el=$(id);
      if(!el || f[id]==null) return;
      el.value=String(f[id]);
    });
    CUST_ORDER_DRAFT_CHECK_IDS.forEach(id=>{
      const el=$(id);
      if(!el || f[id]==null) return;
      el.checked=!!f[id];
    });
    resetCustomerVehicleTypes();
    (draft.vehicleTypes||[]).forEach(vtype=>{
      const el=document.querySelector(`#cust-vehicle-types [data-vtype="${vtype}"]`);
      if(el) el.checked=true;
    });
    clearCustomerLoadUnloadMethods();
    (draft.loadMethods||[]).forEach(id=>setCustomerLoadMethod(id, true));
    (draft.unloadMethods||[]).forEach(id=>setCustomerUnloadMethod(id, true));
    syncCustomerClosedAllCheckbox();
    syncCustomerRefrAllCheckbox();
    syncCustomerOpenAllCheckbox();
    syncCustomerVehicleTypeUi();
    syncCustomerPayloadTons();
    syncCustomerCargoKind();
    syncCustomerTempField();
    syncCustomerVehicleDateCalVisibility();
    if(draft.vehicleDateCal){
      customerVehicleDateCal.year=+draft.vehicleDateCal.year||customerVehicleDateCal.year;
      customerVehicleDateCal.month=+draft.vehicleDateCal.month||customerVehicleDateCal.month;
      customerVehicleDateCal.from=draft.vehicleDateCal.from||null;
      if(customerDateCalEnabled()) paintCustomerVehicleDateCal();
    }
    customerCal.from=draft.bookCalFrom||null;
    customerRouteKm=draft.routeKm>0?draft.routeKm:null;
    customerRouteGeometry=null;
    const priceEl=$('cust-price');
    if(priceEl && draft.priceAuto!=null) priceEl.dataset.auto=String(draft.priceAuto);
    const volEl=$('cust-cargo-volume');
    if(volEl && draft.volumeManual!=null) volEl.dataset.manual=String(draft.volumeManual);
    const chat=draft.chat||{};
    if(chat.messages&&chat.messages.length){
      customerChat={
        messages:chat.messages.slice(),
        stepIndex:+chat.stepIndex||0,
        data:Object.assign({}, chat.data||{}),
        summaryReady:!!chat.summaryReady
      };
      saveCustomerChatState();
    }else{
      resetCustomerChat();
    }
    const mode=draft.mode==='chat'?'chat':'form';
    setCustomerOrderMode(mode);
    if(mode==='chat') initCustomerChatWizard(false);
    else if(chat.data&&Object.keys(chat.data).length) customerChatApplyToForm();
    const load=(($('cust-load')||{}).value||'').trim();
    const unload=(($('cust-unload')||{}).value||'').trim();
    if(load&&unload) refreshCustomerRouteKm();
    else updateCustomerPricePreview();
    paintCustomerFleetOptions();
    paintCustomerBookingCal();
    paintCustomerFormChecklist();
    hideCustomerDraftBanner();
    customerDraftPromptLoaded=draft.savedAt;
  }finally{
    customerDraftApplying=false;
  }
}
function maybePromptCustomerOrderDraft(){
  if(!currentCustomer) return;
  const draft=loadCustomerOrderDraftRaw();
  if(!draft || !customerOrderDraftHasContent(draft)) return;
  if(customerDraftPromptLoaded && customerDraftPromptLoaded===draft.savedAt) return;
  showCustomerDraftBanner(draft);
}

function saveCustomerChatState(){
  try{
    if(!customerChat.messages.length) return;
    sessionStorage.setItem(CUST_CHAT_STATE_KEY, JSON.stringify({
      messages:customerChat.messages, stepIndex:customerChat.stepIndex,
      data:customerChat.data, summaryReady:customerChat.summaryReady
    }));
    scheduleCustomerOrderDraftSave();
  }catch(_){}
}
function restoreCustomerChatState(){
  try{
    const raw=JSON.parse(sessionStorage.getItem(CUST_CHAT_STATE_KEY)||'null');
    if(!raw||!Array.isArray(raw.messages)||!raw.messages.length) return false;
    customerChat={messages:raw.messages, stepIndex:+raw.stepIndex||0, data:raw.data||{}, summaryReady:!!raw.summaryReady};
    return true;
  }catch(_){ return false; }
}
function clearCustomerChatState(){
  try{ sessionStorage.removeItem(CUST_CHAT_STATE_KEY); }catch(_){}
}
function customerChatSyncFromForm(){
  if(!customerChat.messages.length&&!Object.keys(customerChat.data).length) return;
  const d=customerChat.data;
  const cargo=(($('cust-cargo-text')||{}).value||'').trim();
  if(cargo) d.cargoText=cargo;
  const wRaw=(($('cust-weight-value')||{}).value||'').replace(',','.');
  const w=+wRaw;
  if(w>0){
    d.weightValue=w;
    d.weightUnit=(($('cust-weight-unit')||{}).value||'t').trim()||'t';
  }
  const date=(($('cust-vehicle-date')||{}).value||'').trim();
  const time=(($('cust-vehicle-time')||{}).value||'').trim();
  if(date) d.date=date;
  if(time) d.time=time;
  const load=(($('cust-load')||{}).value||'').trim();
  const unload=(($('cust-unload')||{}).value||'').trim();
  if(load) d.load=load;
  if(unload) d.unload=unload;
  const types=customerSelectedVehicleTypes();
  if(types.length) d.bodyVtype=types[0];
  saveCustomerChatState();
}

function customerOrderMode(){
  try{ return localStorage.getItem(CUST_CHAT_MODE_KEY)==='chat'?'chat':'form'; }catch(_){ return 'form'; }
}
function setCustomerOrderMode(mode){
  try{ localStorage.setItem(CUST_CHAT_MODE_KEY, mode==='chat'?'chat':'form'); }catch(_){}
  syncCustomerOrderModeUi();
  scheduleCustomerOrderDraftSave();
}
function syncCustomerOrderModeUi(){
  const mode=customerOrderMode();
  const formPanel=$('cust-form-panel');
  const chatPanel=$('cust-chat-panel');
  document.querySelectorAll('.cust-order-mode-tab').forEach(btn=>{
    const on=btn.dataset.custMode===mode;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-selected', on?'true':'false');
  });
  if(formPanel) formPanel.hidden=mode==='chat';
  if(chatPanel){
    if(mode==='chat') chatPanel.removeAttribute('hidden');
    else chatPanel.hidden=true;
  }
  if(mode==='form' && customerChat.data && Object.keys(customerChat.data).length) customerChatApplyToForm();
  if(mode==='chat'){
    customerChatSyncFromForm();
    initCustomerChatWizard(false);
  }
}
function customerChatOffsetDate(days){
  const d=new Date();
  d.setDate(d.getDate()+days);
  const pad=n=>String(n).padStart(2,'0');
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
}
function customerChatWhenLabel(){
  const d=customerChat.data.date||'';
  const t=customerChat.data.time||'';
  return d?(t?`${d}, ${t}`:d):'';
}
function customerChatBodyLabel(vtype){
  const hit=CUST_CHAT_BODY_CHIPS.find(c=>c.vtype===vtype);
  return hit?hit.label:(typeof custVehicleTypeLabel==='function'?custVehicleTypeLabel(vtype):vtype);
}
function resetCustomerChat(){
  customerChat={messages:[], stepIndex:0, data:{}, summaryReady:false};
  clearCustomerChatState();
}
function customerChatBotPrompt(stepId){
  if(stepId==='cargo') return 'Здравствуйте! Оформим заявку на перевозку. <strong>Что нужно перевезти?</strong>';
  if(stepId==='weight') return '<strong>Сколько весит груз?</strong> Укажите число — тонны или килограммы.';
  if(stepId==='when') return '<strong>Когда подать машину?</strong>';
  if(stepId==='load') return '<strong>Откуда забираем груз?</strong> Укажите адрес загрузки.';
  if(stepId==='unload') return '<strong>Куда везём?</strong>';
  if(stepId==='body') return '<strong>Какой кузов нужен?</strong>';
  if(stepId==='summary') return 'Проверьте заявку перед отправкой:';
  return '';
}
function customerChatAddBot(stepId){
  customerChat.messages.push({role:'bot', html:customerChatBotPrompt(stepId), stepId});
}
function customerChatAddUser(text){
  customerChat.messages.push({role:'user', text:String(text||'').trim()});
}
function customerChatStepMeta(){
  const total=CUST_CHAT_STEPS.length;
  const cur=Math.min(customerChat.stepIndex+1, total);
  const step=CUST_CHAT_STEPS[customerChat.stepIndex]||CUST_CHAT_STEPS[total-1];
  return {cur, total, title:step&&step.title||''};
}
function customerChatUpdateProgress(){
  const meta=customerChatStepMeta();
  const pct=Math.round((meta.cur/meta.total)*100);
  const fill=$('cust-chat-progress');
  const hint=$('cust-chat-step-hint');
  if(fill) fill.style.width=pct+'%';
  if(hint) hint.textContent=`Шаг ${meta.cur} из ${meta.total} · ${meta.title}`;
}
function customerChatScrollBottom(){
  const thread=$('cust-chat-thread');
  if(thread) requestAnimationFrame(()=>{ thread.scrollTop=thread.scrollHeight; });
}
function customerChatSetVehicleType(vtype){
  resetCustomerVehicleTypes();
  const el=document.querySelector(`#cust-vehicle-types [data-vtype="${vtype}"]`);
  if(el){
    el.checked=true;
    if(CUST_REAR_AUTO_VTYPE_IDS.has(vtype)) applyRearOnlyVehicleTypeRules();
    syncCustomerVehicleTypeUi();
  }
}
function customerChatApplyToForm(){
  const d=customerChat.data;
  const cargoEl=$('cust-cargo-text');
  if(cargoEl && d.cargoText!=null) cargoEl.value=d.cargoText;
  const wEl=$('cust-weight-value');
  const wUnit=$('cust-weight-unit');
  if(wEl && d.weightValue!=null) wEl.value=String(d.weightValue);
  if(wUnit && d.weightUnit) wUnit.value=d.weightUnit;
  syncCustomerPayloadTons();
  syncCustomerCargoKind();
  const dateEl=$('cust-vehicle-date');
  const timeEl=$('cust-vehicle-time');
  if(dateEl && d.date) dateEl.value=d.date;
  if(timeEl && d.time) timeEl.value=d.time;
  const loadEl=$('cust-load');
  const unloadEl=$('cust-unload');
  if(loadEl && d.load) loadEl.value=d.load;
  if(unloadEl && d.unload) unloadEl.value=d.unload;
  if(d.bodyVtype) customerChatSetVehicleType(d.bodyVtype);
  updateCustomerPricePreview();
  paintCustomerFleetOptions();
}
async function customerChatRefreshRouteHint(){
  customerChatApplyToForm();
  await refreshCustomerRouteKm();
  updateCustomerPricePreview();
}
function customerChatPriceHint(){
  const draft=buildCustomerDraftFromForm();
  const carrier=customerCarrierForForm();
  const s=typeof suggestCustomerOrderPrice==='function'?suggestCustomerOrderPrice(draft):null;
  if(!s) return null;
  const amount=typeof customerOrderClientPriceAmount==='function'
    ?customerOrderClientPriceAmount(s)
    :(typeof customerCarrierPriceAmount==='function'?customerCarrierPriceAmount(s, carrier):Math.round(s.minimumCash));
  return amount>0?Math.round(amount):null;
}
function customerChatSummaryHtml(){
  const d=customerChat.data;
  const km=customerRouteKm>0?`≈ ${customerRouteKm} км`:null;
  const weight=d.weightValue?(d.weightUnit==='kg'?`${d.weightValue} кг`:`${d.weightValue} т`):'—';
  const price=customerChatPriceHint();
  const rows=[
    {id:'cargo', label:'Груз', val:d.cargoText||'—', html:false},
    {id:'weight', label:'Вес', val:weight, html:false},
    {id:'when', label:'Когда', val:customerChatWhenLabel()||'—', html:false},
    {id:'load', label:'Загрузка', val:d.load||'—', html:false},
    {id:'unload', label:'Выгрузка', val:d.unload||'—', html:false},
    {id:'body', label:'Кузов', val:d.bodyVtype?customerChatBodyLabel(d.bodyVtype):'—', html:false},
    {id:'price', label:'Ориентир', val:price?`<strong>${fmt(price)} ₽</strong>`:'уточнит перевозчик', html:true}
  ];
  return `<div class="chat-summary"><b>Сводка</b>${
    rows.map(r=>`<div class="chat-summary-row"><span>${esc(r.label)}</span><span>${r.html?r.val:esc(r.val)}${r.id!=='price'?`<button type="button" class="chat-summary-edit" data-chat-edit="${r.id}">Изменить</button>`:''}</span></div>`).join('')
  }</div>`;
}
function customerChatRenderMessages(){
  const thread=$('cust-chat-thread');
  if(!thread) return;
  thread.innerHTML=customerChat.messages.map(m=>{
    if(m.role==='user'){
      return `<div class="chat-msg user"><span class="chat-avatar">Вы</span><div class="chat-bubble">${esc(m.text)}</div></div>`;
    }
    let html=`<div class="chat-msg bot"><span class="chat-avatar">А</span><div class="chat-bubble">${m.html}`;
    if(m.stepId==='summary' && customerChat.summaryReady) html+=customerChatSummaryHtml();
    html+='</div></div>';
    return html;
  }).join('');
  customerChatUpdateProgress();
}
function customerChatRenderWidgets(){
  const thread=$('cust-chat-thread');
  if(!thread) return;
  const step=CUST_CHAT_STEPS[customerChat.stepIndex];
  if(!step) return;
  if(step.id!=='summary' && customerChat.summaryReady) return;
  let widget='';
  if(step.id==='when'){
    widget=`<div class="chat-chips" id="cust-chat-chips">
      <button type="button" class="chat-chip muted" data-chat-when="1">Завтра</button>
      <button type="button" class="chat-chip muted" data-chat-when="2">Послезавтра</button>
      <button type="button" class="chat-chip" data-chat-when="pick">Выбрать дату…</button>
    </div>
    <div class="chat-widget" id="cust-chat-when-pick" hidden>
      <div class="chat-widget-row">
        <input id="cust-chat-date" placeholder="ДД.ММ.ГГГГ" inputmode="numeric" maxlength="10" aria-label="Дата" />
        <input id="cust-chat-time" placeholder="ЧЧ:ММ" inputmode="numeric" maxlength="5" aria-label="Время" value="09:00" style="max-width:5.5rem" />
      </div>
      <div class="chat-chips" style="padding-left:0;margin-top:8px">
        <button type="button" class="chat-chip primary" id="cust-chat-when-ok">Готово</button>
      </div>
    </div>`;
  }else if(step.id==='load' || step.id==='unload'){
    const val=step.id==='load'?(customerChat.data.load||''):(customerChat.data.unload||'');
    widget=`<div class="chat-widget"><input id="cust-chat-addr" placeholder="Город, улица, дом…" value="${esc(val)}" autocomplete="off" aria-label="Адрес" /></div>
    <div class="chat-chips"><button type="button" class="chat-chip primary" id="cust-chat-addr-ok">Далее →</button></div>`;
  }else if(step.id==='body'){
    widget=`<div class="chat-chips" id="cust-chat-chips">${
      CUST_CHAT_BODY_CHIPS.map((c,i)=>`<button type="button" class="chat-chip ${i===0?'primary':'muted'}" data-chat-body="${c.id}">${esc(c.label)}</button>`).join('')
    }</div>`;
  }else if(step.id==='summary' && customerChat.summaryReady){
    widget=`<div class="chat-chips"><button type="button" class="chat-chip primary" id="cust-chat-submit">Отправить заявку</button></div>`;
  }
  if(widget){
    const wrap=document.createElement('div');
    wrap.innerHTML=widget;
    while(wrap.firstChild) thread.appendChild(wrap.firstChild);
  }
  customerChatWireWidgets(step.id);
  customerChatScrollBottom();
}
function customerChatWireWidgets(stepId){
  if(stepId==='when'){
    document.querySelectorAll('[data-chat-when]').forEach(btn=>{
      btn.onclick=()=>{
        const mode=btn.getAttribute('data-chat-when');
        const pick=$('cust-chat-when-pick');
        if(mode==='pick'){
          if(pick) pick.hidden=false;
          const de=$('cust-chat-date');
          if(de) de.focus();
          return;
        }
        const days=+mode||1;
        customerChat.data.date=customerChatOffsetDate(days);
        customerChat.data.time='09:00';
        customerChatAdvance(customerChatWhenLabel());
      };
    });
    const ok=$('cust-chat-when-ok');
    if(ok) ok.onclick=()=>{
      const de=$('cust-chat-date');
      const te=$('cust-chat-time');
      let date=(de&&de.value||'').trim();
      let time=(te&&te.value||'').trim()||'09:00';
      if(typeof formatRuDateInput==='function') date=formatRuDateInput(date);
      if(typeof formatTimeHmInput==='function') time=formatTimeHmInput(time);
      if(!date || typeof parseRuDate==='function' && !parseRuDate(date)){
        const err=$('cust-chat-error'); if(err) err.textContent='Укажите дату в формате ДД.ММ.ГГГГ';
        return;
      }
      customerChat.data.date=date;
      customerChat.data.time=time;
      customerChatAdvance(customerChatWhenLabel());
    };
    const de=$('cust-chat-date');
    if(de && typeof maskRuDateInput==='function'){
      de.oninput=()=>{ de.value=maskRuDateInput(de.value); };
      de.onblur=()=>{ const f=formatRuDateInput(de.value); if(f) de.value=f; };
    }
    const te=$('cust-chat-time');
    if(te && typeof maskTimeHmInput==='function'){
      te.oninput=()=>{ te.value=maskTimeHmInput(te.value); };
      te.onblur=()=>{ const f=formatTimeHmInput(te.value); if(f) te.value=f; };
    }
  }
  if(stepId==='load' || stepId==='unload'){
    const ok=$('cust-chat-addr-ok');
    const inp=$('cust-chat-addr');
    const submit=()=>{
      const addr=(inp&&inp.value||'').trim();
      if(addr.length<4){
        const err=$('cust-chat-error'); if(err) err.textContent='Укажите адрес (минимум 4 символа)';
        return;
      }
      const err=$('cust-chat-error'); if(err) err.textContent='';
      if(stepId==='load') customerChat.data.load=addr;
      else customerChat.data.unload=addr;
      customerChatAdvance(addr);
    };
    if(ok) ok.onclick=submit;
    if(inp){
      inp.onkeydown=e=>{ if(e.key==='Enter' && !e.defaultPrevented){ e.preventDefault(); submit(); } };
      if(typeof wireAddressAutocomplete==='function') wireAddressAutocomplete(inp);
      setTimeout(()=>inp.focus(), 80);
    }
  }
  if(stepId==='body'){
    document.querySelectorAll('[data-chat-body]').forEach(btn=>{
      btn.onclick=()=>{
        const id=btn.getAttribute('data-chat-body');
        const chip=CUST_CHAT_BODY_CHIPS.find(c=>c.id===id);
        if(!chip) return;
        if(id==='other'){
          saveCustomerChatState();
          setCustomerOrderMode('form');
          customerChatApplyToForm();
          const block=document.querySelector('.cust-form-block[data-cust-step="transport"]');
          if(block) block.scrollIntoView({behavior:'smooth', block:'start'});
          const search=$('cust-vtype-search');
          if(search){ search.focus(); filterCustomerVtypeSearch(''); }
          return;
        }
        customerChat.data.bodyVtype=chip.vtype;
        customerChatAdvance(chip.label);
      };
    });
  }
  if(stepId==='summary'){
    const sub=$('cust-chat-submit');
    if(sub) sub.onclick=()=>{
      showCustomerSubmitError('');
      customerChatApplyToForm();
      submitCustomerOrder();
    };
    const thread=$('cust-chat-thread');
    if(thread) thread.querySelectorAll('[data-chat-edit]').forEach(btn=>{
      btn.onclick=()=>{
        const sid=btn.getAttribute('data-chat-edit');
        const idx=CUST_CHAT_STEPS.findIndex(s=>s.id===sid);
        if(idx<0) return;
        customerChat.stepIndex=idx;
        customerChat.summaryReady=false;
        customerChat.messages=customerChat.messages.filter(m=>!(m.role==='bot' && m.stepId==='summary'));
        customerChatAddBot(sid);
        saveCustomerChatState();
        customerChatRenderAll();
      };
    });
  }
}
function customerChatRenderAll(){
  customerChatRenderMessages();
  customerChatRenderWidgets();
  customerChatUpdateCompose();
}
function customerChatUpdateCompose(){
  const compose=$('cust-chat-compose');
  const step=CUST_CHAT_STEPS[customerChat.stepIndex];
  const textSteps=['cargo','weight'];
  const show=step && textSteps.includes(step.id) && !customerChat.summaryReady;
  if(compose) compose.style.display=show?'flex':'none';
}
function customerChatAdvance(userText){
  const err=$('cust-chat-error'); if(err) err.textContent='';
  if(userText) customerChatAddUser(userText);
  customerChat.stepIndex++;
  saveCustomerChatState();
  const step=CUST_CHAT_STEPS[customerChat.stepIndex];
  if(!step){
    customerChatRenderAll();
    return;
  }
  if(step.id==='summary'){
    customerChatAddBot('summary');
    customerChat.summaryReady=false;
    customerChatRenderAll();
    customerChatRefreshRouteHint().then(()=>{
      customerChat.summaryReady=true;
      saveCustomerChatState();
      if(customerChatPriceHint()){
        const p=customerChatPriceHint();
        const priceEl=$('cust-price');
        if(priceEl && priceEl.dataset.auto!=='0'){
          priceEl.value=String(p);
          priceEl.dataset.auto='1';
        }
      }
      customerChatRenderAll();
    });
    return;
  }
  customerChatAddBot(step.id);
  customerChatRenderAll();
}
function customerChatHandleTextInput(){
  const inp=$('cust-chat-input');
  const raw=(inp&&inp.value||'').trim();
  if(!raw) return;
  const step=CUST_CHAT_STEPS[customerChat.stepIndex];
  if(!step) return;
  const err=$('cust-chat-error');
  if(step.id==='cargo'){
    customerChat.data.cargoText=raw;
    if(inp) inp.value='';
    saveCustomerChatState();
    customerChatAdvance(raw);
    return;
  }
  if(step.id==='weight'){
    const m=raw.match(/^([\d.,]+)\s*(кг|kg|т|t|тонн|тонны)?/i);
    if(!m){
      if(err) err.textContent='Укажите число, например 3 или 5000 кг';
      return;
    }
    const num=+(m[1].replace(',','.'));
    if(!(num>0)){ if(err) err.textContent='Укажите положительное число'; return; }
    const unitRaw=(m[2]||'').toLowerCase();
    let unit='t';
    if(/кг|kg/.test(unitRaw)) unit='kg';
    else if(/т|t|тонн/.test(unitRaw)) unit='t';
    else if(num>=500) unit='kg';
    customerChat.data.weightValue=num;
    customerChat.data.weightUnit=unit;
    if(inp) inp.value='';
    saveCustomerChatState();
    const label=unit==='kg'?`${num} кг`:`${num} т`;
    customerChatAdvance(label);
  }
}
function initCustomerChatWizard(forceReset){
  if(forceReset){
    resetCustomerChat();
    customerChatAddBot('cargo');
  }else if(!customerChat.messages.length){
    if(!restoreCustomerChatState()){
      resetCustomerChat();
      customerChatAddBot('cargo');
    }
  }
  customerChatRenderAll();
  const send=$('cust-chat-send');
  const inp=$('cust-chat-input');
  if(send && !send.dataset.wired){
    send.dataset.wired='1';
    send.onclick=customerChatHandleTextInput;
  }
  if(inp && !inp.dataset.wired){
    inp.dataset.wired='1';
    inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); customerChatHandleTextInput(); } };
  }
}
function wireCustomerOrderMode(){
  document.querySelectorAll('.cust-order-mode-tab').forEach(btn=>{
    if(btn.dataset.wired) return;
    btn.dataset.wired='1';
    btn.onclick=()=>{
      const mode=btn.dataset.custMode||'form';
      setCustomerOrderMode(mode);
    };
  });
  syncCustomerOrderModeUi();
}

function wireCustomerAddressFields(){
  const bumpRoute=()=>{
    if(typeof customerRouteBump==='function') customerRouteBump();
  };
  const attach=(id)=>{
    const el=$(id);
    if(!el || el.dataset.addrHooked) return;
    el.dataset.addrHooked='1';
    if(typeof wireAddressAutocomplete==='function'){
      wireAddressAutocomplete(el, { onSelect:bumpRoute, onBlur:bumpRoute });
    }
  };
  attach('cust-load');
  attach('cust-unload');
}
function wireCustomerPortal(){
  $('role-customer')&&($('role-customer').onclick=()=>{ setEntryMode('customer'); openCustomerLogin(); });
  $('cust-login-ok')&&($('cust-login-ok').onclick=loginCustomer);
  $('cust-login-pin')&&($('cust-login-pin').onkeydown=e=>{ if(e.key==='Enter') loginCustomer(); });
  $('cust-portal-back')&&($('cust-portal-back').onclick=logoutCustomer);
  $('cust-notify-toggle')&&($('cust-notify-toggle').onclick=()=>enableCustomerNotifications());
  $('cust-submit')&&($('cust-submit').onclick=submitCustomerOrder);
  let routeTimer=null;
  window.customerRouteBump=()=>{
    clearTimeout(routeTimer);
    routeTimer=setTimeout(()=>refreshCustomerRouteKm(), 700);
  };
  ['cust-load','cust-unload'].forEach(id=>{
    const el=$(id);
    if(!el) return;
    el.oninput=customerRouteBump;
    el.onblur=()=>refreshCustomerRouteKm();
  });
  wireCustomerAddressFields();
  ['cust-weight-value','cust-price','cust-req-l','cust-req-w','cust-req-h','cust-cargo-places','cust-cargo-volume','cust-load-note','cust-unload-note'].forEach(id=>{
    const el=$(id);
    if(!el) return;
    el.oninput=()=>{
      if(id==='cust-price') el.dataset.auto='0';
      if(id==='cust-req-l'||id==='cust-req-w'||id==='cust-req-h') syncCustomerCargoVolume(false);
      if(id==='cust-cargo-volume') el.dataset.manual='1';
      syncCustomerPayloadTons();
      updateCustomerPricePreview();
      if(id==='cust-weight-value') paintCustomerFleetOptions();
    };
  });
  const volEl=$('cust-cargo-volume');
  if(volEl) volEl.onchange=()=>{ if(volEl.value) volEl.dataset.manual='1'; updateCustomerPricePreview(); };
  const tempToggle=$('cust-cargo-temp');
  if(tempToggle) tempToggle.onchange=()=>{ syncCustomerTempField(); updateCustomerPricePreview(); };
  ['cust-cargo-temp-from','cust-cargo-temp-to'].forEach(id=>{
    const el=$(id);
    if(!el) return;
    el.oninput=()=>{ updateCustomerPricePreview(); };
  });
  const fragileEl=$('cust-cargo-fragile');
  if(fragileEl) fragileEl.onchange=()=>{ updateCustomerPricePreview(); };
  const packEl=$('cust-cargo-packaging');
  if(packEl) packEl.onchange=()=>{ syncCustomerCargoKind(); updateCustomerPricePreview(); };
  const weightUnit=$('cust-weight-unit');
  if(weightUnit) weightUnit.onchange=()=>{ syncCustomerPayloadTons(); updateCustomerPricePreview(); paintCustomerFleetOptions(); };
  const cargoInp=$('cust-cargo-text');
  if(cargoInp) cargoInp.oninput=()=>{ syncCustomerCargoKind(); updateCustomerPricePreview(); paintCustomerFleetOptions(); };
  const fulfillEl=$('cust-fulfillment');
  if(fulfillEl) fulfillEl.onchange=()=>{ updateCustomerPricePreview(); paintCustomerFleetOptions(); };
  if(typeof wireVehicleAtHint==='function') wireVehicleAtHint('cust', ()=>{
    if(customerDateCalEnabled()) paintCustomerVehicleDateCal();
    paintCustomerFleetOptions();
  });
  const calToggle=$('cust-vehicle-date-cal-toggle');
  if(calToggle) calToggle.onchange=()=>syncCustomerVehicleDateCalVisibility();
  wireCustomerVehicleTypes();
  wireCustomerVtypeSearch();
  wireCustomerFormChecklist();
  wireCustomerOrderMode();
  syncCustomerVehicleDateCalVisibility();
  syncCustomerTempField();
  const restoreBtn=$('cust-draft-restore');
  if(restoreBtn && !restoreBtn.dataset.wired){
    restoreBtn.dataset.wired='1';
    restoreBtn.onclick=()=>{
      const draft=loadCustomerOrderDraftRaw();
      if(draft) applyCustomerOrderDraft(draft);
    };
  }
  const discardBtn=$('cust-draft-discard');
  if(discardBtn && !discardBtn.dataset.wired){
    discardBtn.dataset.wired='1';
    discardBtn.onclick=()=>{
      clearCustomerOrderDraft();
    };
  }
  const orderForm=$('cust-order-form');
  if(orderForm&&!orderForm.dataset.checklistLive){
    orderForm.dataset.checklistLive='1';
    orderForm.addEventListener('input', ()=>{
      paintCustomerFormChecklist();
      scheduleCustomerOrderDraftSave();
    });
    orderForm.addEventListener('change', ()=>{
      paintCustomerFormChecklist();
      scheduleCustomerOrderDraftSave();
    });
  }
}

wireCustomerPortal();
