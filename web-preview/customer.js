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
  if(o.onExchange) return 'На бирже';
  if(o.startOdometer!=null || o.departOdometer!=null) return 'В работе';
  if(o.driverName && o.driverName!=='Биржа' && o.driverName!=='—') return 'Назначен';
  return 'Новая';
}
function customerOrderStatusTag(o){
  if(!o||!o.id) return '';
  return `${customerOrderStatusLabel(o)}|${o.driverName||''}|${o.onExchange?'1':'0'}|${o.closedAt||''}|${o.cancelledAt||''}`;
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

function buildCustomerDraftFromForm(){
  const co=findCompanyById(currentCustomer&&currentCustomer.companyId);
  const carrier=carrierOwnCompanyForSpace(co&&co.spaceId||currentCustomer&&currentCustomer.spaceId);
  const estKmRaw=(($('cust-est-km')||{}).value||'').replace(/\D/g,'');
  const estHrRaw=(($('cust-est-hours')||{}).value||'').replace(',','.');
  const emptyRaw=(($('cust-empty-before')||{}).value||'').replace(/\D/g,'');
  const payRaw=(($('cust-price')||{}).value||'').replace(/\s/g,'').replace(',','.');
  const fin=carrier?financeForCompanyId(carrier.id):normalizeFinance(state.finance);
  return {
    ownCompanyId:carrier&&carrier.id||null,
    estimateKm:estKmRaw?+estKmRaw:null,
    estimateWorkHours:estHrRaw?+estHrRaw:null,
    emptyKmBefore:emptyRaw?+emptyRaw:0,
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

function updateCustomerPricePreview(){
  const box=$('cust-price-preview');
  if(!box) return;
  const draft=buildCustomerDraftFromForm();
  if(!draft.ownCompanyId){
    box.innerHTML='<div class="hint">Тариф перевозчика не настроен — свяжитесь с диспетчером.</div>';
    return;
  }
  const s=suggestCustomerOrderPrice(draft);
  if(!s){
    box.innerHTML='<div class="hint">Укажите ориентир км и/или часов работы — появится минимальная цена. Тариф перевозчика: ₽/ч и ₽/км в «Справочники → Тариф».</div>';
    return;
  }
  const min=Math.round(s.minimumCash);
  box.innerHTML=`
    <div class="calc-row"><span>Минимальная цена</span><span><b>${fmt(min)} ₽</b> (нал)</span></div>
    <div class="calc-row"><span>Без НДС</span><span>${fmt(s.withoutVat)} ₽</span></div>
    <div class="calc-row"><span>С НДС</span><span>${fmt(s.withVat)} ₽</span></div>
    <div class="hint">${esc(s.summary||'')}</div>
    <div class="hint">Ниже минимума заявку не принимаем. Рекомендуемая цена на старте = минимум.</div>`;
  const priceEl=$('cust-price');
  if(priceEl && !priceEl.value) priceEl.value=String(min);
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
  if(sub) sub.textContent=carrier?`Перевозчик: ${carrier.name}`:'';
  const loadEl=$('cust-load');
  const unloadEl=$('cust-unload');
  if(loadEl && co&&co.loadingAddresses&&co.loadingAddresses[0] && !loadEl.value) loadEl.value=co.loadingAddresses[0];
  if(unloadEl && co&&co.unloadingAddresses&&co.unloadingAddresses[0] && !unloadEl.value) unloadEl.value=co.unloadingAddresses[0];
  const list=$('cust-orders-list');
  if(list){
    const orders=customerOrders().slice(0,20);
    list.innerHTML=orders.length?orders.map(o=>{
      const st=customerOrderStatusLabel(o);
      const stCls=o.cancelledAt?'closed':looksClosedOrder(o)?'closed':o.onExchange?'exchange':(o.startOdometer!=null?'progress':'');
      return `<div class="card" style="margin-bottom:8px">
        <h3>№ ${esc(o.sequentialNumber||'—')} · <span class="order-status ${stCls}">${esc(st)}</span></h3>
        <p class="meta">${esc(routeText(o))}</p>
        <p class="meta">${o.driverName&&o.driverName!=='Биржа'?`Водитель: ${esc(o.driverName)} · `:''}${o.priceForClient?`Цена: ${fmt(o.priceForClient)} ₽ · `:''}${esc(dateTime(o.createdAt))}</p>
      </div>`;
    }).join(''):'<div class="empty">Заявок ещё нет</div>';
  }
  updateCustomerPricePreview();
  const notifyBtn=$('cust-notify-toggle');
  if(notifyBtn) notifyBtn.textContent=customerNotifyActive()?'Уведомления: вкл':'Уведомления: выкл';
  maybeNotifyCustomerOrderUpdates();
}

function readCustomerVehicleAt(){
  const d=(($('cust-vehicle-date')||{}).value||'').trim();
  const t=(($('cust-vehicle-time')||{}).value||'').trim();
  if(!d) return null;
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
  const contactName=(($('cust-contact-name')||{}).value||'').trim();
  const contactPhone=formatPhone((($('cust-contact-phone')||{}).value||'').trim());
  const payloadTons=+(($('cust-req-pay')||{}).value||'').replace(',','.');
  const vehicleAt=readCustomerVehicleAt();
  if(!load||!unload){ if(err) err.textContent='Укажите адреса загрузки и выгрузки'; return; }
  if(!vehicleAt){ if(err) err.textContent='Укажите дату и время подачи ТС'; return; }
  if(!(payloadTons>0)){ if(err) err.textContent='Укажите грузоподъёмность (т)'; return; }
  const draft=buildCustomerDraftFromForm();
  const quote=suggestCustomerOrderPrice(draft);
  if(!quote){ if(err) err.textContent='Не удалось рассчитать минимальную цену — укажите км/часы'; return; }
  const min=Math.round(quote.minimumCash);
  const offered=draft.priceOffer!=null?Math.round(draft.priceOffer):min;
  if(offered<min){
    if(err) err.textContent=`Цена не может быть ниже минимума (${fmt(min)} ₽)`;
    updateCustomerPricePreview();
    return;
  }
  const spaceId=co.spaceId||carrier.spaceId||null;
  const guardFn=typeof billingGuardWithServer==='function'?billingGuardWithServer:billingGuard;
  Promise.resolve(guardFn(spaceId,'publish_exchange')).then(g=>{
    if(!g.ok){ if(err) err.textContent=g.message; return; }
    submitCustomerOrderAfterGuard(co, carrier, spaceId, load, unload, contactName, contactPhone, payloadTons, vehicleAt, draft, offered, min, err);
  });
}
function submitCustomerOrderAfterGuard(co, carrier, spaceId, load, unload, contactName, contactPhone, payloadTons, vehicleAt, draft, offered, min, err){
  const spaceAdm=(state.admins||[]).find(a=>a.spaceId===spaceId);
  const seqNo=nextSequentialNumber();
  const now=new Date().toISOString();
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
    loadingAddress:load, unloadingAddress:unload,
    routePoints:defaultRoutePoints(load, unload),
    vehicleAt,
    vehiclePlate:'—', driverName:'Биржа', driverPercent:0,
    executorType:'exchange', onExchange:true,
    exchangeListedAt:now, wasOnExchange:true,
    partnerSpaceId:null,
    reqPayloadTons:payloadTons,
    reqLengthM:numOrNull((($('cust-req-l')||{}).value)),
    reqWidthM:numOrNull((($('cust-req-w')||{}).value)),
    reqHeightM:numOrNull((($('cust-req-h')||{}).value)),
    estimateKm:draft.estimateKm,
    estimateWorkHours:draft.estimateWorkHours,
    emptyKmBefore:draft.emptyKmBefore||0,
    priceForClient:offered,
    rateCash:offered,
    paymentForm:'cash',
    transportApp:null
  };
  const t=fillRatesFrom('cash', offered);
  order.rateWithoutVat=t.withoutVat;
  order.rateWithVat=t.withVat;
  order.freight=offered;
  ensureRoutePoints(order);
  applyOrderSchedule(order);
  bumpDataEpoch('customer-portal-order');
  upsertOrder(order);
  persist();
  if(err) err.textContent='';
  alert(`Заявка №${seqNo} отправлена на биржу перевозчика. Минимальная цена: ${fmt(min)} ₽.`);
  ['cust-load','cust-unload','cust-contact-name','cust-contact-phone','cust-est-km','cust-est-hours','cust-empty-before','cust-price','cust-req-pay','cust-req-l','cust-req-w','cust-req-h'].forEach(id=>{
    const el=$(id); if(el) el.value='';
  });
  if($('cust-vehicle-date')) $('cust-vehicle-date').value='';
  if($('cust-vehicle-time')) $('cust-vehicle-time').value='';
  renderCustomerPortal();
}

function wireCustomerPortal(){
  $('role-customer')&&($('role-customer').onclick=()=>{ setEntryMode('customer'); openCustomerLogin(); });
  $('cust-login-ok')&&($('cust-login-ok').onclick=loginCustomer);
  $('cust-login-pin')&&($('cust-login-pin').onkeydown=e=>{ if(e.key==='Enter') loginCustomer(); });
  $('cust-portal-back')&&($('cust-portal-back').onclick=logoutCustomer);
  $('cust-notify-toggle')&&($('cust-notify-toggle').onclick=()=>enableCustomerNotifications());
  $('cust-submit')&&($('cust-submit').onclick=submitCustomerOrder);
  ['cust-est-km','cust-est-hours','cust-empty-before','cust-req-pay'].forEach(id=>{
    const el=$(id); if(el) el.oninput=()=>updateCustomerPricePreview();
  });
}

wireCustomerPortal();
