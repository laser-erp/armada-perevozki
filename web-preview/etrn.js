/* АРМАДА — ЭТрН (S3 MVP UI + API client) */
function etrnTitulLabel(key){
  const m={ t1:'Т1 · грузоотправитель', t2:'Т2 · перевозчик', t3:'Т3 · водитель (приём)', t4:'Т4 · водитель (выдача)' };
  return m[key]||key;
}
function etrnTitulWhenHint(key){
  const m={
    t1:'на погрузке · грузоотправитель',
    t2:'на погрузке · перевозчик',
    t3:'на погрузке · водитель (приём)',
    t4:'на выгрузке · водитель (выдача)'
  };
  return m[key]||'';
}
function etrnTitulStatusLabel(st){
  if(st==='signed') return 'подписан';
  if(st==='error') return 'ошибка';
  return 'ожидает';
}
function orderEtrnEligible(o){
  if(!o || o.cancelledAt || looksClosedOrder(o)) return false;
  if(typeof orderHasDriverVehicleAssigned==='function') return orderHasDriverVehicleAssigned(o);
  const drv=String(o.driverName||'').trim();
  const plate=String(o.vehiclePlate||'').trim();
  return !!(drv && plate && drv!=='—' && plate!=='—' && drv!=='Диспетчер' && drv!=='Биржа');
}
function orderEtrnTransportActive(o){
  if(!o || looksClosedOrder(o) || o.cancelledAt) return false;
  return o.departOdometer!=null || o.startOdometer!=null;
}
function orderEtrnSectionHtml(o){
  if(!o || !orderEtrnEligible(o)) return '';
  const et=o.etrn;
  const tituls=et&&et.tituls?Object.entries(et.tituls).map(([k,v])=>{
    const canSign=et.sandbox&&v!=='signed';
    const btn=canSign?`<button type="button" class="secondary etrn-titul-sign" data-order-id="${esc(o.id)}" data-titul="${esc(k)}" style="margin-left:6px;font-size:.72rem;padding:2px 6px">Подписать</button>`:'';
    return `<div class="calc-row etrn-titul-row"><span>${esc(etrnTitulLabel(k))}<br><span class="hint">${esc(etrnTitulWhenHint(k))}</span></span><span>${esc(etrnTitulStatusLabel(v))}${btn}</span></div>`;
  }).join(''):'';
  const epd=state.settings&&state.settings.epdOperator?String(state.settings.epdOperator):'';
  const head=et
    ? `<p class="hint">Оператор: <strong>${esc(et.operatorId||epd||'—')}</strong> · ID: ${esc(et.externalId||'—')}${et.sandbox?' · sandbox':''} · ${esc(et.status||'draft')}</p>
       ${et.createdAt?`<p class="hint">Создан: ${esc(dateTime(et.createdAt))}</p>`:''}
       ${tituls?`<div class="calc" style="margin-top:8px">${tituls}</div>`:''}
       ${et.lastError?`<p class="error">${esc(et.lastError)}</p>`:''}`
    : `<p class="hint">ЭТрН создаётся при выезде (QR для инспектора в пути). Подписи: T1–T3 на погрузке, T4 на выгрузке.${epd?` Оператор: ${esc(epd)}.`:''}</p>`;
  const printBtn=et?`<button type="button" class="secondary" id="etrn-print" data-order-id="${esc(o.id)}">Печать / PDF</button>`:'';
  return `
    <section class="form-section" id="etrn-section">
      <h2 class="form-section-title">ЭТрН</h2>
      ${head}
      <div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap">
        <button type="button" class="secondary" id="etrn-create" ${et?'disabled':''}>${et?'ЭТрН создан':'Создать ЭТрН'}</button>
        ${printBtn}
        <span class="hint" id="etrn-status"></span>
      </div>
    </section>`;
}
function etrnFleetContext(){
  const ownCo=findCompanyById((state.orders||[]).find(o=>o.id===state.detailId)?.ownCompanyId);
  const carrierCo=findCompanyById((state.orders||[]).find(o=>o.id===state.detailId)?.carrierCompanyId);
  return {
    fleetVehicles:(state.vehicles||[]).map(v=>({ plate:v.plate, makeModel:v.makeModel, payloadTons:v.payloadTons })),
    ownInn:ownCo&&ownCo.inn||'',
    carrierInn:carrierCo&&carrierCo.inn||''
  };
}
function applyEtrnToOrder(order, etrn){
  if(!order||!etrn) return;
  order.etrn={
    operatorId:etrn.operatorId||'stub',
    externalId:etrn.externalId||'',
    createdAt:etrn.createdAt||new Date().toISOString(),
    status:etrn.status||'draft',
    tituls:etrn.tituls||{ t1:'pending', t2:'pending', t3:'pending', t4:'pending' },
    lastError:etrn.lastError||null,
    sandbox:!!etrn.sandbox,
    signUrl:etrn.signUrl||etrn.driverSignUrl||null,
    shipperSignToken:etrn.shipperSignToken||null
  };
}
function ensureEtrnForOrder(order, opts){
  if(!order||!orderEtrnEligible(order)) return null;
  if(order.etrn) return order.etrn;
  const silent=opts&&opts.silent;
  const etrn=sandboxCreateEtrnLocal(order);
  if(typeof logOpsEvent==='function') logOpsEvent('etrn','Авто ЭТрН заказ '+order.sequentialNumber,{ orderId:order.id, externalId:etrn.externalId });
  upsertOrder(order);
  persist();
  if(!silent && typeof bumpDataEpoch==='function') bumpDataEpoch('etrn-auto');
  return etrn;
}
function etrnQrPayload(order){
  const et=order&&order.etrn;
  if(!et) return '';
  const base=(typeof location!=='undefined'&&location.origin)?location.origin:'https://app.armada.sx';
  return JSON.stringify({
    type:'armada-etrn',
    orderId:order.id,
    orderNo:order.sequentialNumber,
    externalId:et.externalId||'',
    operatorId:et.operatorId||'stub',
    route:typeof routeText==='function'?routeText(order):'',
    vehicle:order.vehiclePlate||'',
    driver:order.driverName||'',
    verify:`${base}/?etrn=${encodeURIComponent(order.id)}`
  });
}
function drawEtrnQrCanvas(text, size){
  const qr=typeof qrcode==='function'?qrcode(0,'M'):null;
  if(!qr||!text) return null;
  qr.addData(String(text));
  qr.make();
  const n=qr.getModuleCount();
  const cell=Math.max(2, Math.floor((size||160)/n));
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=n*cell;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#000';
  for(let r=0;r<n;r++) for(let c=0;c<n;c++){
    if(qr.isDark(r,c)) ctx.fillRect(c*cell,r*cell,cell,cell);
  }
  return canvas;
}
function driverEtrnShowQr(orderId){
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o) return;
  if(!o.etrn && typeof ensureEtrnForOrder==='function') ensureEtrnForOrder(o, {silent:true});
  const canvas=drawEtrnQrCanvas(etrnQrPayload(o), 200);
  if(!canvas){ alert('QR недоступен — обновите приложение'); return; }
  const w=window.open('', '_blank', 'noopener,width=360,height=420');
  if(!w){ alert('Разрешите всплывающие окна для QR ЭТрН'); return; }
  w.document.write(`<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>ЭТрН №${o.sequentialNumber||''}</title>
<style>body{font-family:system-ui,sans-serif;text-align:center;padding:16px;margin:0}h1{font-size:1rem;margin:0 0 8px}p{font-size:.85rem;color:#555;margin:6px 0}</style></head><body>
<h1>ЭТрН · заказ №${o.sequentialNumber||'—'}</h1>
<p>${esc(routeText(o))}</p>
<p>${esc(o.vehiclePlate||'')} · ${esc(o.driverName||'')}</p>
<p><strong>Покажите инспектору</strong></p>
</body></html>`);
  w.document.body.appendChild(canvas);
  w.document.close();
}
function driverActiveEtrnOrders(){
  if(typeof DRIVER==='undefined' || !DRIVER) return [];
  return (state.orders||[]).filter(o=>{
    if(!o || !orderEtrnTransportActive(o)) return false;
    if(typeof orderBelongsToDriver==='function' && !orderBelongsToDriver(o)) return false;
    if(!o.etrn && typeof ensureEtrnForOrder==='function') ensureEtrnForOrder(o, {silent:true});
    return !!o.etrn;
  });
}
function sandboxCreateEtrnLocal(o){
  const extId=`local-${o.id}-${Date.now()}`;
  applyEtrnToOrder(o, {
    operatorId:(state.settings&&state.settings.epdOperator)||'local-stub',
    externalId:extId,
    createdAt:new Date().toISOString(),
    status:'draft',
    tituls:{ t1:'pending', t2:'pending', t3:'pending', t4:'pending' },
    sandbox:true,
    driverSignUrl:`sandbox://etrn/sign/${extId}`,
    shipperSignToken:typeof uuid==='function'?uuid():`t${Date.now()}`
  });
  return o.etrn;
}
function etrnAllTitulsSigned(et){
  const t=et&&et.tituls||{};
  return ['t1','t2','t3','t4'].every(k=>t[k]==='signed');
}
function refreshEtrnOrderStatus(o){
  if(!o||!o.etrn) return;
  o.etrn.status=etrnAllTitulsSigned(o.etrn)?'signed':'draft';
}
function signEtrnTitul(orderId, titulKey, signedBy){
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o||!o.etrn||!o.etrn.tituls) return false;
  if(!['t1','t2','t3','t4'].includes(titulKey)) return false;
  o.etrn.tituls[titulKey]='signed';
  o.etrn.titulsSignedAt=o.etrn.titulsSignedAt||{};
  o.etrn.titulsSignedAt[titulKey]=new Date().toISOString();
  if(signedBy) o.etrn.titulsSignedBy=o.etrn.titulsSignedBy||{}, o.etrn.titulsSignedBy[titulKey]=signedBy;
  refreshEtrnOrderStatus(o);
  upsertOrder(o);
  persist();
  if(typeof logOpsEvent==='function') logOpsEvent('etrn',`Подписан ${titulKey} заказ ${o.sequentialNumber}`,{ orderId, titulKey });
  return true;
}
function orderShipperSameAsCustomer(o){
  return !o || o.shipperSameAsCustomer!==false;
}
function orderShipperInfo(o){
  if(!o) return {name:'', phone:'', inn:'', sameAsCustomer:true};
  if(orderShipperSameAsCustomer(o)){
    const co=typeof findCompanyById==='function'?findCompanyById(o.customerId):null;
    return {
      name:co&&co.name||o.customer||'',
      inn:co&&co.inn||o.customerInn||'',
      phone:typeof formatPhone==='function'?formatPhone(o.contactPhone||co&&co.portalPhone||''):'',
      sameAsCustomer:true
    };
  }
  return {
    name:String(o.shipperName||'').trim(),
    inn:String(o.shipperInn||'').trim(),
    phone:typeof formatPhone==='function'?formatPhone(o.shipperPhone||''):String(o.shipperPhone||''),
    email:String(o.shipperEmail||'').trim(),
    sameAsCustomer:false
  };
}
function customerCanSignEtrnT1(o){
  return orderShipperSameAsCustomer(o);
}
function ensureEtrnShipperSignToken(o){
  if(!o||!o.etrn) return null;
  if(!o.etrn.shipperSignToken){
    o.etrn.shipperSignToken=typeof uuid==='function'?uuid():`t${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
    upsertOrder(o);
    persist();
  }
  return o.etrn.shipperSignToken;
}
function shipperEtrnT1SignUrl(o){
  if(!o||!o.id) return '';
  const token=ensureEtrnShipperSignToken(o);
  if(!token) return '';
  const base=(typeof location!=='undefined'&&location.origin)?location.origin:'https://app.armada.sx';
  return `${base}/z/?etrn-t1=${encodeURIComponent(o.id)}&t=${encodeURIComponent(token)}`;
}
function validateShipperEtrnT1Token(o, token){
  if(!o||!o.etrn||!token) return false;
  return String(o.etrn.shipperSignToken||'')===String(token);
}
function shipperEtrnT1SmsText(o){
  const ship=orderShipperInfo(o);
  const url=shipperEtrnT1SignUrl(o);
  return `АРМАДА: подпишите ЭТрН (T1) по заявке №${o.sequentialNumber||'—'}.\n${url}`;
}
function orderEtrnLoadingPhase(o){
  if(!o) return false;
  return o.arrivedAt!=null || o.startOdometer!=null;
}
function customerEtrnT1Pending(o){
  if(!o||!o.etrn||!o.etrn.tituls) return false;
  if(o.cancelledAt||looksClosedOrder(o)) return false;
  if(o.etrn.tituls.t1!=='pending') return false;
  return orderEtrnLoadingPhase(o);
}
function customerEtrnT1SignHtml(o){
  if(!customerEtrnT1Pending(o)) return '';
  const ship=orderShipperInfo(o);
  const st=etrnTitulStatusLabel('pending');
  if(customerCanSignEtrnT1(o)){
    return `<div class="cust-etrn-t1-block">
      <strong>ЭТрН · T1 · грузоотправитель</strong>
      <p class="hint">Водитель на погрузке — подтвердите отгрузку (${st}).</p>
      <button type="button" class="primary cust-etrn-t1-sign" data-order-id="${esc(o.id)}">Подписать T1</button>
    </div>`;
  }
  const url=shipperEtrnT1SignUrl(o);
  const shipLine=ship.name?`${esc(ship.name)}${ship.phone?` · ${esc(formatPhone(ship.phone))}`:''}`:'грузоотправитель';
  return `<div class="cust-etrn-t1-block">
    <strong>ЭТрН · T1 · грузоотправитель</strong>
    <p class="hint">Грузоотправитель: ${shipLine}. Отправьте ссылку для подписи T1 (${st}).</p>
    <div class="cust-etrn-t1-actions">
      <button type="button" class="secondary cust-etrn-shipper-copy" data-order-id="${esc(o.id)}" data-url="${esc(url)}">Скопировать ссылку</button>
      ${ship.phone?`<a class="secondary cust-etrn-shipper-sms" href="sms:${encodeURIComponent(formatPhone(ship.phone))}?body=${encodeURIComponent(shipperEtrnT1SmsText(o))}">SMS грузоотправителю</a>`:''}
    </div>
  </div>`;
}
function customerEtrnT1BannerHtml(opts){
  opts=opts||{};
  if(typeof customerOrders!=='function') return '';
  const pending=customerOrders().filter(o=>customerEtrnT1Pending(o)&&customerCanSignEtrnT1(o));
  if(!pending.length) return '';
  const btns=pending.map(o=>
    `<button type="button" class="secondary cust-alert-btn cust-etrn-t1-sign" data-order-id="${esc(o.id)}">№ ${esc(o.sequentialNumber||'—')}</button>`
  ).join('');
  if(opts.compact){
    return `<div class="cust-alert-strip cust-alert-strip--etrn">
      <div class="cust-alert-strip-text">
        <strong class="cust-alert-strip-title">ЭТrН · T1</strong>
        <span class="hint">Подпишите на погрузке</span>
      </div>
      <div class="cust-alert-strip-actions">${btns}</div>
    </div>`;
  }
  return `<div class="cust-etrn-banner"><strong>ЭТrН:</strong> подпишите T1 (вы — грузоотправитель) ${btns}</div>`;
}
function wireCustomerEtrnT1(root){
  (root||document).querySelectorAll('.cust-etrn-t1-sign').forEach(btn=>{
    btn.onclick=()=>{
      const oid=btn.dataset.orderId;
      if(typeof openEpdTitulSign==='function'){
        openEpdTitulSign(oid,'t1','customer');
        return;
      }
      const o=(state.orders||[]).find(x=>x.id===oid);
      const ship=orderShipperInfo(o);
      const by=ship.name||'грузоотправитель';
      if(signEtrnTitul(oid,'t1',by)){
        if(typeof bumpDataEpoch==='function') bumpDataEpoch('etrn-t1-customer');
        if(typeof renderCustomerPortal==='function') renderCustomerPortal();
      }
    };
  });
  (root||document).querySelectorAll('.cust-etrn-shipper-copy').forEach(btn=>{
    btn.onclick=async()=>{
      const url=btn.dataset.url||'';
      if(!url){ alert('Ссылка недоступна'); return; }
      try{
        await navigator.clipboard.writeText(url);
        btn.textContent='Скопировано';
        setTimeout(()=>{ btn.textContent='Скопировать ссылку'; }, 2000);
      }catch(_){
        prompt('Скопируйте ссылку для грузоотправителя:', url);
      }
    };
  });
}
function renderShipperEtrnT1Overlay(orderId, token){
  const overlay=$('cust-shipper-etrn-overlay');
  const body=$('cust-shipper-etrn-body');
  if(!overlay||!body) return false;
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o||!validateShipperEtrnT1Token(o, token)){
    body.innerHTML='<p class="error">Ссылка недействительна или устарела.</p>';
    overlay.hidden=false;
    return false;
  }
  if(!o.etrn && typeof ensureEtrnForOrder==='function') ensureEtrnForOrder(o, {silent:true});
  const ship=orderShipperInfo(o);
  const t1Signed=o.etrn&&o.etrn.tituls&&o.etrn.tituls.t1==='signed';
  const atLoading=orderEtrnLoadingPhase(o);
  let inner='';
  if(t1Signed){
    inner=`<p><strong>T1 подписан.</strong> Спасибо, ${esc(ship.name||'грузоотправитель')}.</p>`;
  }else if(!atLoading){
    inner=`<p class="hint">Заявка № ${esc(o.sequentialNumber||'—')} · ${esc(routeText(o)||'')}</p>
      <p>Подпись T1 будет доступна, когда водитель приедет на погрузку.</p>`;
  }else{
    inner=`<p class="hint">Заявка № ${esc(o.sequentialNumber||'—')} · ${esc(routeText(o)||'')}</p>
      <p><strong>${esc(ship.name||'Грузоотправитель')}</strong>, подтвердите отгрузку груза (T1 в ЭТрН).</p>
      <button type="button" class="primary" id="cust-shipper-etrn-sign">Подписать T1</button>`;
  }
  body.innerHTML=inner;
  overlay.hidden=false;
  const signBtn=$('cust-shipper-etrn-sign');
  if(signBtn){
    signBtn.onclick=()=>{
      if(typeof openEpdTitulSign==='function'){
        openEpdTitulSign(orderId,'t1','customer');
        return;
      }
      const by=ship.name||'грузоотправитель';
      if(signEtrnTitul(orderId,'t1',by)){
        renderShipperEtrnT1Overlay(orderId, token);
        if(typeof bumpDataEpoch==='function') bumpDataEpoch('etrn-t1-shipper');
      }
    };
  }
  return true;
}
function tryInitShipperEtrnT1FromUrl(){
  try{
    const q=new URLSearchParams(location.search||'');
    const orderId=String(q.get('etrn-t1')||'').trim();
    const token=String(q.get('t')||'').trim();
    if(!orderId||!token) return false;
    return renderShipperEtrnT1Overlay(orderId, token);
  }catch(_){ return false; }
}
function signEtrnTitulsAtLoading(orderId){
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o||!o.etrn||!o.etrn.sandbox) return false;
  signEtrnTitul(orderId,'t2','перевозчик');
  return true;
}
function signEtrnTitulSandboxAuto(orderId, titulKey, signedBy){
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o||!o.etrn||!o.etrn.sandbox) return false;
  if(o.etrn.tituls&&o.etrn.tituls[titulKey]==='signed') return true;
  return signEtrnTitul(orderId, titulKey, signedBy);
}
function applyEpdWebhook(payload){
  const p=payload||{};
  const extId=String(p.externalId||p.documentId||'').trim();
  if(!extId) return {ok:false, error:'externalId required'};
  const o=(state.orders||[]).find(x=>x.etrn&&String(x.etrn.externalId)===extId);
  if(!o) return {ok:false, error:'order not found'};
  const et=o.etrn;
  if(p.status) et.status=p.status;
  if(p.tituls&&typeof p.tituls==='object') Object.assign(et.tituls, p.tituls);
  if(p.titul&&['t1','t2','t3','t4'].includes(p.titul)) et.tituls[p.titul]=p.titulStatus||'signed';
  if(p.signUrl) et.signUrl=p.signUrl;
  if(p.driverSignUrl) et.driverSignUrl=p.driverSignUrl;
  et.lastWebhookAt=new Date().toISOString();
  refreshEtrnOrderStatus(o);
  upsertOrder(o);
  persist();
  if(typeof logOpsEvent==='function') logOpsEvent('etrn-webhook',`ЭТрН ${extId}`,{ orderId:o.id, payload:p });
  return {ok:true, orderId:o.id};
}
function buildEtrnPrintBody(o){
  const et=o.etrn||{};
  const titRows=['t1','t2','t3','t4'].map(k=>
    `<tr><td>${esc(etrnTitulLabel(k))}</td><td>${esc(etrnTitulStatusLabel((et.tituls||{})[k]))}</td></tr>`
  ).join('');
  const qrNote=typeof drawEtrnQrCanvas==='function'?'Отсканируйте QR — данные для проверки инспектором.':'';
  return `
    <div class="doc-head">
      <div class="brand">АРМАДА</div>
      <h1>Электронная транспортная накладная (ЭТрН)</h1>
      <div class="muted">заказ № ${esc(o.sequentialNumber||'—')} · ${esc(dayOnly(o.vehicleAt||o.createdAt)||'—')}</div>
    </div>
    <p>Оператор ЭПД: <strong>${esc(et.operatorId||'—')}</strong><br>
    ID документа: <strong>${esc(et.externalId||'—')}</strong><br>
    Статус: <strong>${esc(et.status||'draft')}</strong></p>
    <h2>Маршрут и перевозка</h2>
    <p>Маршрут: <strong>${esc(routeText(o)||'—')}</strong><br>
    ${typeof orderDriverDetailLines==='function'?orderDriverDetailLines(o):''}</p>
    <h2>Титулы (подписи)</h2>
    <table><thead><tr><th>Титул</th><th>Статус</th></tr></thead><tbody>${titRows}</tbody></table>
    <div id="etrn-qr-slot" style="margin:16px 0;text-align:center"></div>
    <p class="muted">${esc(qrNote)}</p>
    <p class="muted">Полная юридическая сила — после подключения оператора ЭПД (СБИС, Контур, Диадoc).</p>`;
}
function openEtrnPrint(orderId){
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o) return;
  if(!o.etrn&&typeof ensureEtrnForOrder==='function') ensureEtrnForOrder(o, {silent:true});
  if(!o.etrn){ alert('ЭТрН ещё не создан'); return; }
  const title=`ЭТрН · заявка №${o.sequentialNumber||'—'}`;
  const w=window.open('', '_blank');
  if(!w){ alert('Разрешите всплывающие окна'); return; }
  w.document.open();
  w.document.write(typeof orderDocPrintHtml==='function'?orderDocPrintHtml(title, buildEtrnPrintBody(o)):buildEtrnPrintBody(o));
  w.document.close();
  const canvas=drawEtrnQrCanvas(etrnQrPayload(o), 180);
  if(canvas){
    const slot=w.document.getElementById('etrn-qr-slot');
    if(slot) slot.appendChild(canvas);
  }
}
async function fetchEtrnFromApi(orderId){
  if(!API_BASE) return null;
  const headers=typeof armadaApiJsonHeaders==='function'?armadaApiJsonHeaders():{ Accept:'application/json' };
  const res=await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}/etrn`, { headers });
  if(!res.ok) return null;
  const data=await res.json().catch(()=>({}));
  return data.etrn||null;
}
function etrnApiOrderNotClosed(data){
  const code=String(data&&data.error||'').trim();
  const hint=String(data&&data.hint||'').trim().toLowerCase();
  return code==='order_not_closed'||hint.includes('only after order close');
}
function etrnApiErrorHint(data, status){
  const code=String(data&&data.error||'').trim();
  const hint=String(data&&data.hint||'').trim();
  if(etrnApiOrderNotClosed(data)){
    return 'ЭТрН нужен в пути (после выезда), а armada-api пока принимает только закрытые заказы — создаём локальный черновик.';
  }
  return hint||code||`HTTP ${status||'?'}`;
}
async function requestCreateEtrn(order){
  const ctx=etrnFleetContext();
  const spaceId=order.spaceId||currentSpaceId();
  const billingPayload={
    order,
    spaceId,
    ...ctx,
    billingSpace:typeof getBillingForSpace==='function'?getBillingForSpace(spaceId):null,
    usage:typeof billingUsageForSpace==='function'?billingUsageForSpace(spaceId):{}
  };
  if(API_BASE){
    const headers=typeof armadaApiJsonHeaders==='function'?armadaApiJsonHeaders():{ 'Content-Type':'application/json', Accept:'application/json' };
    const res=await fetch(`${API_BASE}/orders/${encodeURIComponent(order.id)}/etrn`, {
      method:'POST',
      headers,
      body:JSON.stringify({ order, spaceId, ...ctx, billingSpace:billingPayload.billingSpace, usage:billingPayload.usage })
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok){
      if(etrnApiOrderNotClosed(data)){
        if(typeof logOpsEvent==='function'){
          logOpsEvent('etrn-warn','API order_not_closed → локальный черновик',{ orderId:order.id, hint:data.hint||'' });
        }
        return sandboxCreateEtrnLocal(order);
      }
      throw new Error(etrnApiErrorHint(data, res.status));
    }
    return data.etrn;
  }
  return sandboxCreateEtrnLocal(order);
}
async function createEtrnForOrder(orderId){
  const statusEl=$('etrn-status');
  const btn=$('etrn-create');
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o){ if(statusEl) statusEl.textContent='Заказ не найден'; return; }
  if(!orderEtrnEligible(o)){ if(statusEl) statusEl.textContent='Нужны водитель и ТС'; return; }
  if(o.etrn){ if(statusEl) statusEl.textContent='Уже создан'; return; }
  const sid=o.spaceId||currentSpaceId();
  if(typeof billingGuardWithServer==='function'){
    const g=await billingGuardWithServer(sid,'create_etrn');
    if(!g.ok){ if(statusEl) statusEl.textContent=g.message; else alert(g.message); return; }
  }
  if(btn) btn.disabled=true;
  if(statusEl) statusEl.textContent='Создание…';
  try{
    const etrn=await requestCreateEtrn(o);
    applyEtrnToOrder(o, etrn);
    if(typeof logOpsEvent==='function') logOpsEvent('etrn','Создан ЭТрН заказ '+o.sequentialNumber,{ orderId:o.id, operatorId:etrn.operatorId, externalId:etrn.externalId });
    bumpDataEpoch('etrn-create');
    upsertOrder(o);
    persist();
    if(statusEl){
      statusEl.textContent=etrn.sandbox&&!looksClosedOrder(o)
        ? 'Черновик (sandbox) — QR и подписи работают'
        : 'Создан';
    }
    if(typeof openDetail==='function') openDetail(orderId);
  }catch(err){
    if(typeof logOpsEvent==='function') logOpsEvent('etrn-error',String(err.message||err),{ orderId });
    if(statusEl) statusEl.textContent=String(err.message||err);
    if(btn) btn.disabled=false;
  }
}
function wireOrderEtrn(orderId){
  const btn=$('etrn-create');
  if(btn && !btn.disabled) btn.onclick=()=>createEtrnForOrder(orderId);
  const print=$('etrn-print');
  if(print) print.onclick=()=>openEtrnPrint(orderId);
  document.querySelectorAll('.etrn-titul-sign').forEach(b=>{
    b.onclick=()=>{
      const titul=b.dataset.titul;
      const oid=b.dataset.orderId;
      if(typeof openEpdTitulSign==='function'){
        openEpdTitulSign(oid, titul, typeof epdRoleForTitul==='function'?epdRoleForTitul(titul):'carrier');
        return;
      }
      if(signEtrnTitul(oid, titul, 'admin')){
        if(typeof openDetail==='function') openDetail(orderId);
      }
    };
  });
}
function driverEtrnPendingOrders(){
  if(typeof DRIVER==='undefined' || !DRIVER) return [];
  return (state.orders||[]).filter(o=>{
    if(!o || !o.etrn) return false;
    if(typeof orderBelongsToDriver==='function' && !orderBelongsToDriver(o)) return false;
    const t=o.etrn.tituls||{};
    return t.t3==='pending'||t.t4==='pending';
  });
}
function driverEtrnTitulsPending(o){
  const t=o&&o.etrn&&o.etrn.tituls||{};
  const labels=[];
  if(t.t1==='pending'&&orderEtrnLoadingPhase(o)) labels.push('T1 грузоотправитель');
  if(t.t3==='pending') labels.push('T3 приём');
  if(t.t4==='pending') labels.push('T4 выдача');
  return labels.join(', ');
}
function driverEtrnSignUrl(order){
  const et=order&&order.etrn;
  if(!et) return null;
  if(et.signUrl && !String(et.signUrl).startsWith('sandbox://')) return et.signUrl;
  if(et.driverSignUrl && !String(et.driverSignUrl).startsWith('sandbox://')) return et.driverSignUrl;
  return null;
}
async function openDriverEtrnSign(orderId){
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o) return;
  if(API_BASE){
    const remote=await fetchEtrnFromApi(orderId);
    if(remote){
      applyEtrnToOrder(o, remote);
      upsertOrder(o);
      persist();
    }
  }
  const t=o.etrn&&o.etrn.tituls||{};
  if(t.t1==='pending'){
    renderDriverBanner();
    alert(`ЭТрН: ждём подпись T1 от грузоотправителя · заказ №${o.sequentialNumber}\n\n${orderShipperSameAsCustomer(o)?'Попросите заказчика подписать в личном кабинете.':'Отправьте ссылку грузоотправителю (заказчик получил её в кабинете).'}`);
    return;
  }
  const pendingTitul=t.t4==='pending'?'t4':(t.t3==='pending'?'t3':(t.t2==='pending'?'t2':null));
  if(pendingTitul&&typeof openEpdTitulSign==='function'){
    await openEpdTitulSign(orderId, pendingTitul, typeof epdRoleForTitul==='function'?epdRoleForTitul(pendingTitul):'driver');
    renderDriverBanner();
    return;
  }
  const url=driverEtrnSignUrl(o);
  if(url&&typeof openEpdOperatorShell==='function'){
    openEpdOperatorShell(url, { title:`ЭТrН · заказ №${o.sequentialNumber}`, onClose:()=>renderDriverBanner() });
    return;
  }
  if(url){
    try{ window.open(url, '_blank', 'noopener'); return; }catch(_){}
  }
  const pending=driverEtrnTitulsPending(o);
  if(o.etrn.sandbox){
    const t=o.etrn.tituls||{};
    if(t.t4==='pending'&&t.t1==='signed'&&t.t2==='signed'&&t.t3==='signed'){
      signEtrnTitulSandboxAuto(o.id,'t4',DRIVER||'driver');
      renderDriverBanner();
      alert(`ЭТрН: подписан T4 (выдача) · заказ №${o.sequentialNumber}`);
      return;
    }
    if(t.t3==='pending'||t.t2==='pending'||t.t1==='pending'){
      if(t.t1==='pending'){
        renderDriverBanner();
        alert(`ЭТрН: ждём подпись T1 от грузоотправителя · заказ №${o.sequentialNumber}\n\n${orderShipperSameAsCustomer(o)?'Попросите заказчика подписать в личном кабинете.':'Отправьте ссылку грузоотправителю (заказчик получил её в кабинете).'}`);
        return;
      }
      if(t.t2==='pending') signEtrnTitul(o.id,'t2','перевозчик');
      if(t.t3==='pending'){
        signEtrnTitul(o.id,'t3',typeof DRIVER!=='undefined'&&DRIVER?DRIVER:'водитель');
        renderDriverBanner();
        alert(`ЭТрН: подписан T3 (приём) · заказ №${o.sequentialNumber}`);
        return;
      }
    }
  }
  const et=o.etrn||{};
  alert(`ЭТрН (sandbox): заказ №${o.sequentialNumber||'—'}\nОператор: ${et.operatorId||'stub'}\nID: ${et.externalId||'—'}\nПодпись: ${pending||'все подписаны'}\n\nQR для инспектора — кнопка «Показать QR ЭТрН».`);
}
function driverEtrnBannerHtml(){
  let html='';
  const active=typeof driverActiveEtrnOrders==='function'?driverActiveEtrnOrders():[];
  active.forEach(o=>{
    const et=o.etrn||{};
    html+=`<div class="driver-etrn-qr-block">
      <strong>ЭТрН · заказ № ${esc(o.sequentialNumber||'—')}</strong>
      <p class="hint">Покажите QR инспектору в пути. T1 — грузоотправитель, T2–T3 — на погрузке, T4 — на выгрузке.</p>
      <button type="button" class="secondary banner-etrn-qr" data-etrn-qr="${esc(o.id)}">Показать QR ЭТрН</button>
      <span class="hint">ID: ${esc(et.externalId||'—')}</span>
    </div>`;
  });
  const list=driverEtrnPendingOrders();
  if(list.length){
    const items=list.map(o=>{
      const tit=driverEtrnTitulsPending(o);
      return `<p>Заказ № ${esc(o.sequentialNumber||'—')} — ${esc(tit)}
        <button type="button" class="secondary banner-etrn-sign" data-etrn-sign="${esc(o.id)}">Подписать ЭТрН</button></p>`;
    }).join('');
    html+=`<strong>ЭТрН: подпись водителя</strong>${items}`;
  }
  return html;
}
async function refreshDriverEtrnFromApi(){
  if(!API_BASE || typeof DRIVER==='undefined' || !DRIVER) return false;
  const pending=driverEtrnPendingOrders();
  if(!pending.length) return false;
  let changed=false;
  for(const o of pending){
    const remote=await fetchEtrnFromApi(o.id);
    if(!remote) continue;
    const prev=JSON.stringify(o.etrn||{});
    applyEtrnToOrder(o, remote);
    if(JSON.stringify(o.etrn||{})!==prev) changed=true;
  }
  if(changed){
    pending.forEach(o=>upsertOrder(o));
    persist();
  }
  return changed;
}
