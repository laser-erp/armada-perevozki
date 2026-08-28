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

function paintCustomerBodyTypeList(){
  const list=$('cust-body-type-list');
  if(!list || typeof atiBodyTypeOptions!=='function') return;
  list.innerHTML=atiBodyTypeOptions().map(x=>`<option value="${esc(x.ati)}">${esc(x.label)}</option>`).join('');
  const inp=$('cust-body-type-input');
  const hid=$('cust-body-type');
  if(inp && hid && !inp.value){
    inp.value=bodyTypeInputLabel(hid.value||'tent')||'Тентованный';
  }
}
function syncCustomerBodyType(){
  const inp=$('cust-body-type-input');
  const hid=$('cust-body-type');
  if(!hid) return;
  const raw=inp?inp.value:'';
  hid.value=typeof resolveBodyTypeFromInput==='function'?resolveBodyTypeFromInput(raw):'tent';
}
function inferCargoKindFromText(text){
  const q=String(text||'').toLowerCase();
  if(/продукт|молок|мяс|рыб|овощ|фрукт|холод|замороз/.test(q)) return 'food';
  if(/сып|навал|песок|щеб|зер|уголь|руда/.test(q)) return 'bulk';
  if(/другое|проч/.test(q)) return 'other';
  return 'general';
}
function syncCustomerCargoKind(){
  const text=(($('cust-cargo-text')||{}).value||'').trim();
  const hid=$('cust-cargo-kind');
  if(hid) hid.value=inferCargoKindFromText(text);
  const body=customerSelectedBodyType();
  if(text && inferCargoKindFromText(text)==='food' && body!=='reefer'){
    const inp=$('cust-body-type-input');
    const h=$('cust-body-type');
    if(inp && h){ h.value='reefer'; inp.value=bodyTypeInputLabel('reefer')||'Рефрижератор'; }
  }
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
    return;
  }
  const mode=inferTripMode(km, fin||normalizeFinance(state.finance));
  badge.textContent=tripModeLabel(mode);
  badge.dataset.mode=mode;
  if(hid) hid.value=mode;
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
    cargoKind:customerSelectedCargoKind(),
    reqPayloadTons:payloadTons>0?payloadTons:null,
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
    return;
  }
  const bits=[];
  if(draft.tripMode) bits.push(tripModeLabel(draft.tripMode));
  if(draft.reqBodyType) bits.push(bodyTypeLabel(draft.reqBodyType));
  if(draft.cargoKind) bits.push(cargoKindLabel(draft.cargoKind));
  if(draft.reqPayloadTons) bits.push(draft.reqPayloadTons+' т');
  const s=suggestCustomerOrderPrice(draft);
  if(!s){
    box.innerHTML=`
      <div class="hint">${esc(bits.join(' · '))}</div>
      <div class="hint">Ориентир цены появится, когда по адресам посчитается км (или если в тарифе заданы ₽/час). Заявку можно отправить — цену уточнит перевозчик.</div>`;
    return;
  }
  const min=Math.round(s.minimumCash);
  box.innerHTML=`
    <div class="calc-row"><span>Ориентир / минимум</span><span><b>${fmt(min)} ₽</b> (нал)</span></div>
    <div class="calc-row"><span>Без НДС</span><span>${fmt(s.withoutVat)} ₽</span></div>
    <div class="calc-row"><span>С НДС</span><span>${fmt(s.withVat)} ₽</span></div>
    <div class="hint">${esc(bits.concat([s.summary||'']).filter(Boolean).join(' · '))}</div>
    <div class="hint">Это ориентир. Через логиста в сумму входит его ставка за срочный подбор. Ниже минимума — только если диспетчер согласится.</div>`;
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
  paintCustomerBodyTypeList();
  if(typeof wireVehicleAtHint==='function') wireVehicleAtHint('cust');
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
  const cargo=customerSelectedCargoKind();
  const body=customerSelectedBodyType();
  if(cargo==='food' && body!=='reefer'){
    if(!confirm('Для продуктов обычно нужен рефрижератор. Отправить как есть?')) return;
  }
  const draft=buildCustomerDraftFromForm();
  const quote=suggestCustomerOrderPrice(draft);
  const min=quote?Math.round(quote.minimumCash):null;
  let offered=draft.priceOffer!=null?Math.round(draft.priceOffer):min;
  if(min!=null && offered!=null && offered<min){
    if(err) err.textContent=`Цена не может быть ниже ориентира (${fmt(min)} ₽)`;
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
    paymentForm:'cash',
    transportApp:null
  };
  if(offered){
    const t=fillRatesFrom('cash', offered);
    order.rateWithoutVat=t.withoutVat;
    order.rateWithVat=t.withVat;
    order.freight=offered;
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
    :`Ориентир ${fmt(min||offered)} ₽${order.fulfillment==='direct'?'':' (ставка логиста в цене)'}.`;
  const bookBit=order.bookedPlate
    ?` Запрос брони ${order.bookedPlate}: перевозчик подтвердит — тогда дата подачи появится в календаре.`
    :' Диспетчер подберёт машину.';
  const rushBit=order.fulfillment==='direct'
    ?' Заявка в свой парк, без срочного подбора.'
    :' Диспетчеру: закрыть как можно скорее.';
  alert(`Заявка №${seqNo} отправлена.${rushBit}${bookBit} ${priceBit}`);
  ['cust-load','cust-unload','cust-loading-contact-name','cust-loading-contact-phone','cust-unloading-contact-name','cust-unloading-contact-phone','cust-cargo-text','cust-weight-value','cust-price','cust-req-l','cust-req-w','cust-req-h','cust-body-type-input'].forEach(id=>{
    const el=$(id); if(el) el.value='';
  });
  customerRouteKm=null;
  customerRouteGeometry=null;
  renderCustomerRouteMap(null);
  if($('cust-vehicle-date')) $('cust-vehicle-date').value='';
  if($('cust-vehicle-time')) $('cust-vehicle-time').value='';
  if($('cust-body-type')) $('cust-body-type').value='tent';
  paintCustomerBodyTypeList();
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
  ['cust-weight-value','cust-price','cust-req-l','cust-req-w','cust-req-h'].forEach(id=>{
    const el=$(id);
    if(!el) return;
    el.oninput=()=>{
      syncCustomerPayloadTons();
      updateCustomerPricePreview();
      if(id==='cust-weight-value') paintCustomerFleetOptions();
    };
  });
  const weightUnit=$('cust-weight-unit');
  if(weightUnit) weightUnit.onchange=()=>{ syncCustomerPayloadTons(); updateCustomerPricePreview(); paintCustomerFleetOptions(); };
  const bodyInp=$('cust-body-type-input');
  if(bodyInp){
    bodyInp.oninput=bodyInp.onchange=()=>{
      syncCustomerBodyType();
      updateCustomerPricePreview();
      paintCustomerFleetOptions();
    };
  }
  const cargoInp=$('cust-cargo-text');
  if(cargoInp) cargoInp.oninput=()=>{ syncCustomerCargoKind(); updateCustomerPricePreview(); paintCustomerFleetOptions(); };
  const fulfillEl=$('cust-fulfillment');
  if(fulfillEl) fulfillEl.onchange=()=>{ updateCustomerPricePreview(); paintCustomerFleetOptions(); };
  if(typeof wireVehicleAtHint==='function') wireVehicleAtHint('cust', ()=>paintCustomerFleetOptions());
  paintCustomerBodyTypeList();
}

wireCustomerPortal();
