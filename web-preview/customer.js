/* АРМАДА: портал заказчика — вход, заявка, минимальная цена */
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
  if(types.some(id=>CUST_REFR_VTYPE_IDS.includes(id))) return 'reefer';
  if(types.includes('isotherm') && !types.some(id=>CUST_CLOSED_VTYPE_IDS.includes(id))) return 'reefer';
  if(types.includes('dump')) return 'dump';
  if(types.some(id=>CUST_OPEN_VTYPE_IDS.includes(id))) return 'board';
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
  customerVehicleRecommendation=null;
  const recBox=$('cust-vtype-recommend');
  if(recBox) recBox.hidden=true;
  syncCustomerVehicleTypeUi();
}
function wireCustomerVehicleTypes(){
  const applyBtn=$('cust-vtype-recommend-apply');
  if(applyBtn&&!applyBtn.dataset.wired){
    applyBtn.dataset.wired='1';
    applyBtn.onclick=()=>applyCustomerVehicleRecommendation();
  }
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
    el.onchange=()=>{
      if(!el.checked) clearCustomerLoadUnloadMethods();
      else if(CUST_REAR_AUTO_VTYPE_IDS.has(el.dataset.vtype)) applyRearOnlyVehicleTypeRules();
      if(CUST_MASTER_VTYPE_IDS.includes(el.dataset.vtype)||el.dataset.vtype===CUST_ISOTHERM_VTYPE_ID) syncCustomerClosedAllCheckbox();
      if(CUST_REFR_VTYPE_IDS.includes(el.dataset.vtype)||el.dataset.vtype===CUST_ISOTHERM_VTYPE_ID) syncCustomerRefrAllCheckbox();
      if(CUST_OPEN_VTYPE_IDS.includes(el.dataset.vtype)) syncCustomerOpenAllCheckbox();
      syncCustomerVehicleTypeUi();
      updateCustomerPricePreview();
      paintCustomerFleetOptions();
    };
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
  if(/другое|проч/.test(q)) return 'other';
  return 'general';
}
let customerVehicleRecommendation=null;
function buildCustomerCargoDraftForRecommend(){
  syncCustomerCargoKind(false);
  syncCustomerPayloadTons();
  const co=findCompanyById(currentCustomer&&currentCustomer.companyId);
  const carrier=carrierOwnCompanyForSpace(co&&co.spaceId||currentCustomer&&currentCustomer.spaceId);
  return {
    ownCompanyId:carrier&&carrier.id||null,
    reqPayloadTons:customerWeightTons(),
    reqLengthM:typeof numOrNull==='function'?numOrNull((($('cust-req-l')||{}).value)):null,
    reqWidthM:typeof numOrNull==='function'?numOrNull((($('cust-req-w')||{}).value)):null,
    reqHeightM:typeof numOrNull==='function'?numOrNull((($('cust-req-h')||{}).value)):null,
    cargoKind:(($('cust-cargo-kind')||{}).value||'general'),
    cargoPackaging:customerCargoPackaging(),
    cargoFragile:customerCargoFragile(),
    cargoTempFromC:customerCargoTempFromC(),
    cargoTempToC:customerCargoTempToC(),
    cargoTempMode:!!($('cust-cargo-temp')&&$('cust-cargo-temp').checked),
    cargoText:(($('cust-cargo-text')||{}).value||'').trim()
  };
}
function updateCustomerVehicleRecommendation(){
  const box=$('cust-vtype-recommend');
  const txt=$('cust-vtype-recommend-text');
  if(!box) return;
  const draft=buildCustomerCargoDraftForRecommend();
  if(typeof inferCustomerVehicleRecommendation!=='function'){
    customerVehicleRecommendation=null;
    box.hidden=true;
    return;
  }
  const rec=inferCustomerVehicleRecommendation(draft);
  customerVehicleRecommendation=rec;
  if(!rec||!rec.vehicleTypeIds||!rec.vehicleTypeIds.length){
    box.hidden=true;
    return;
  }
  box.hidden=false;
  if(txt) txt.textContent=rec.label||'';
}
function applyCustomerVehicleRecommendation(){
  const rec=customerVehicleRecommendation;
  if(!rec||!rec.vehicleTypeIds||!rec.vehicleTypeIds.length) return;
  document.querySelectorAll('#cust-vehicle-types [data-vtype]').forEach(el=>{ el.checked=false; });
  rec.vehicleTypeIds.forEach(id=>{
    const el=document.querySelector(`#cust-vehicle-types [data-vtype="${id}"]`);
    if(el) el.checked=true;
  });
  syncCustomerClosedAllCheckbox();
  syncCustomerRefrAllCheckbox();
  syncCustomerOpenAllCheckbox();
  if(rec.rearLoad) applyRearOnlyVehicleTypeRules();
  syncCustomerVehicleTypeUi();
  updateCustomerPricePreview();
  paintCustomerFleetOptions();
}
function syncCustomerCargoKind(updateRecommend=true){
  const text=(($('cust-cargo-text')||{}).value||'').trim();
  const hid=$('cust-cargo-kind');
  let kind=inferCargoKindFromText(text);
  const pack=customerCargoPackaging();
  if(pack==='bulk') kind='bulk';
  if(hid) hid.value=kind;
  if(updateRecommend) updateCustomerVehicleRecommendation();
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
  const amount=typeof customerCarrierPriceAmount==='function'?customerCarrierPriceAmount(s, carrier):Math.round(s.minimumCash);
  const payLabel=typeof customerCarrierPriceLabel==='function'&&carrier?customerCarrierPriceLabel(carrier):'';
  const payHint=typeof customerCarrierPriceHint==='function'&&carrier?customerCarrierPriceHint(carrier):'';
  box.innerHTML=`
    <div class="calc-row"><span>К оплате перевозчику</span><span><b>${fmt(Math.round(amount))} ₽</b>${payLabel?` (${payLabel})`:''}</span></div>
    <div class="hint">${esc(bits.concat([s.summary||'']).filter(Boolean).join(' · '))}</div>
    <div class="hint">${esc(payHint||'Это ориентир. Через логиста в сумму входит его ставка за срочный подбор.')}</div>`;
  const priceEl=$('cust-price');
  if(priceEl && !priceEl.value) priceEl.value=String(Math.round(amount));
  paintCustomerFormChecklist();
}

function showCustomerPortal(){
  if(!currentCustomer && !restoreCustomerSession()){
    openCustomerLogin();
    return;
  }
  renderCustomerPortal();
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
  if(loadEl && co&&co.loadingAddresses&&co.loadingAddresses[0] && !loadEl.value) loadEl.value=co.loadingAddresses[0];
  if(unloadEl && co&&co.unloadingAddresses&&co.unloadingAddresses[0] && !unloadEl.value) unloadEl.value=co.unloadingAddresses[0];
  syncCustomerVehicleTypeUi();
  syncCustomerVehicleDateCalVisibility();
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

function submitCustomerOrder(){
  const err=$('cust-form-error');
  if(!currentCustomer){ if(err) err.textContent='Войдите снова'; return; }
  const co=findCompanyById(currentCustomer.companyId);
  const carrier=carrierOwnCompanyForSpace(co&&co.spaceId);
  if(!carrier){ if(err) err.textContent='Перевозчик не найден'; return; }
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
  if(!load||!unload){ if(err) err.textContent='Укажите адреса загрузки и выгрузки'; return; }
  if(!vehicleAt){ if(err) err.textContent='Укажите дату и время подачи ТС'; return; }
  if(!(payloadTons>0)){ if(err) err.textContent='Укажите вес груза'; return; }
  if(!cargoText){ if(err) err.textContent='Укажите, что за груз'; return; }
  const vtypes=customerSelectedVehicleTypes();
  if(!vtypes.length){ if(err) err.textContent='Выберите хотя бы один тип ТС'; return; }
  const cargo=customerSelectedCargoKind();
  if(cargo==='food' && !vtypes.some(id=>CUST_REFR_VTYPE_IDS.includes(id)||id==='isotherm')){
    if(!confirm('Для продуктов обычно нужен изотермический кузов или рефрижератор. Отправить как есть?')) return;
  }
  const draft=buildCustomerDraftFromForm();
  const quote=suggestCustomerOrderPrice(draft);
  const min=quote&&typeof customerCarrierPriceAmount==='function'
    ?Math.round(customerCarrierPriceAmount(quote, carrier))
    :(quote?Math.round(quote.minimumCash):null);
  let offered=draft.priceOffer!=null?Math.round(draft.priceOffer):min;
  if(min!=null && offered!=null && offered<min){
    const payLabel=typeof customerCarrierPriceLabel==='function'?customerCarrierPriceLabel(carrier):'';
    if(err) err.textContent=`Цена не может быть ниже ориентира (${fmt(min)} ₽${payLabel?`, ${payLabel}`:''})`;
    updateCustomerPricePreview();
    return;
  }
  const bookedPlate=(($('cust-book-plate')||{}).value||'').trim();
  if(bookedPlate && typeof vehicleBusyAt==='function' && vehicleBusyAt(bookedPlate, vehicleAt)){
    if(err) err.textContent='Эта машина уже занята на это время. Выберите другую или не бронируйте.';
    paintCustomerFleetOptions();
    return;
  }
  const spaceId=co.spaceId||carrier.spaceId||null;
  const guardFn=typeof billingGuardWithServer==='function'?billingGuardWithServer:billingGuard;
  Promise.resolve(guardFn(spaceId,'create_order')).then(g=>{
    if(!g.ok){ if(err) err.textContent=g.message; return; }
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
  if(err) err.textContent='';
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
  renderCustomerPortal();
}

function wireCustomerPortal(){
  $('role-customer')&&($('role-customer').onclick=()=>{ setEntryMode('customer'); openCustomerLogin(); });
  $('cust-login-ok')&&($('cust-login-ok').onclick=loginCustomer);
  $('cust-login-pin')&&($('cust-login-pin').onkeydown=e=>{ if(e.key==='Enter') loginCustomer(); });
  $('cust-portal-back')&&($('cust-portal-back').onclick=logoutCustomer);
  $('cust-notify-toggle')&&($('cust-notify-toggle').onclick=()=>enableCustomerNotifications());
  $('cust-submit')&&($('cust-submit').onclick=submitCustomerOrder);
  let routeTimer=null;
  const bumpRoute=()=>{
    clearTimeout(routeTimer);
    routeTimer=setTimeout(()=>refreshCustomerRouteKm(), 700);
  };
  ['cust-load','cust-unload'].forEach(id=>{
    const el=$(id);
    if(!el) return;
    el.oninput=bumpRoute;
    el.onblur=()=>refreshCustomerRouteKm();
  });
  const bumpCargoRecommend=()=>updateCustomerVehicleRecommendation();
  ['cust-weight-value','cust-price','cust-req-l','cust-req-w','cust-req-h','cust-cargo-places','cust-cargo-volume','cust-load-note','cust-unload-note'].forEach(id=>{
    const el=$(id);
    if(!el) return;
    el.oninput=()=>{
      if(id==='cust-req-l'||id==='cust-req-w'||id==='cust-req-h') syncCustomerCargoVolume(false);
      if(id==='cust-cargo-volume') el.dataset.manual='1';
      syncCustomerPayloadTons();
      updateCustomerPricePreview();
      if(id==='cust-weight-value') paintCustomerFleetOptions();
      if(['cust-weight-value','cust-req-l','cust-req-w','cust-req-h','cust-cargo-places','cust-cargo-volume'].includes(id)) bumpCargoRecommend();
    };
  });
  const volEl=$('cust-cargo-volume');
  if(volEl) volEl.onchange=()=>{ if(volEl.value) volEl.dataset.manual='1'; updateCustomerPricePreview(); bumpCargoRecommend(); };
  const tempToggle=$('cust-cargo-temp');
  if(tempToggle) tempToggle.onchange=()=>{ syncCustomerTempField(); updateCustomerPricePreview(); bumpCargoRecommend(); };
  ['cust-cargo-temp-from','cust-cargo-temp-to'].forEach(id=>{
    const el=$(id);
    if(!el) return;
    el.oninput=()=>{ updateCustomerPricePreview(); bumpCargoRecommend(); };
  });
  const fragileEl=$('cust-cargo-fragile');
  if(fragileEl) fragileEl.onchange=()=>{ updateCustomerPricePreview(); bumpCargoRecommend(); };
  const packEl=$('cust-cargo-packaging');
  if(packEl) packEl.onchange=()=>{ syncCustomerCargoKind(); updateCustomerPricePreview(); bumpCargoRecommend(); };
  const weightUnit=$('cust-weight-unit');
  if(weightUnit) weightUnit.onchange=()=>{ syncCustomerPayloadTons(); updateCustomerPricePreview(); paintCustomerFleetOptions(); bumpCargoRecommend(); };
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
  wireCustomerFormChecklist();
  syncCustomerVehicleDateCalVisibility();
  const orderForm=$('cust-order-form');
  if(orderForm&&!orderForm.dataset.checklistLive){
    orderForm.dataset.checklistLive='1';
    orderForm.addEventListener('input', ()=>paintCustomerFormChecklist());
    orderForm.addEventListener('change', ()=>paintCustomerFormChecklist());
  }
}

wireCustomerPortal();
