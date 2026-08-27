/* АРМАДА — ЭТрН (S3 MVP UI + API client) */
function etrnTitulLabel(key){
  const m={ t1:'Т1 · грузоотправитель', t2:'Т2 · перевозчик', t3:'Т3 · водитель (приём)', t4:'Т4 · водитель (выдача)' };
  return m[key]||key;
}
function etrnTitulStatusLabel(st){
  if(st==='signed') return 'подписан';
  if(st==='error') return 'ошибка';
  return 'ожидает';
}
function orderEtrnSectionHtml(o){
  if(!o || !looksClosedOrder(o)) return '';
  const et=o.etrn;
  const tituls=et&&et.tituls?Object.entries(et.tituls).map(([k,v])=>
    `<div class="calc-row"><span>${esc(etrnTitulLabel(k))}</span><span>${esc(etrnTitulStatusLabel(v))}</span></div>`
  ).join(''):'';
  const head=et
    ? `<p class="hint">Оператор: <strong>${esc(et.operatorId||'—')}</strong> · ID: ${esc(et.externalId||'—')}${et.sandbox?' · sandbox':''}</p>
       ${et.createdAt?`<p class="hint">Создан: ${esc(dateTime(et.createdAt))}</p>`:''}
       ${tituls?`<div class="calc" style="margin-top:8px">${tituls}</div>`:''}
       ${et.lastError?`<p class="error">${esc(et.lastError)}</p>`:''}`
    : `<p class="hint">Электронная транспортная накладная (ЭТрН) — после закрытия заказа. Sandbox до подключения оператора.</p>`;
  return `
    <section class="form-section" id="etrn-section">
      <h2 class="form-section-title">ЭТрН</h2>
      ${head}
      <div class="row" style="margin-top:8px;gap:8px">
        <button type="button" class="secondary" id="etrn-create" ${et?'disabled':''}>${et?'ЭТрН создан':'Создать ЭТрН'}</button>
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
    signUrl:etrn.signUrl||etrn.driverSignUrl||null
  };
}
function sandboxCreateEtrnLocal(o){
  const extId=`local-${o.id}-${Date.now()}`;
  applyEtrnToOrder(o, {
    operatorId:'local-stub',
    externalId:extId,
    createdAt:new Date().toISOString(),
    status:'draft',
    tituls:{ t1:'pending', t2:'pending', t3:'pending', t4:'pending' },
    sandbox:true,
    driverSignUrl:`sandbox://etrn/sign/${extId}`
  });
  return o.etrn;
}
async function fetchEtrnFromApi(orderId){
  if(!API_BASE) return null;
  const headers=typeof armadaApiJsonHeaders==='function'?armadaApiJsonHeaders():{ Accept:'application/json' };
  const res=await fetch(`${API_BASE}/orders/${encodeURIComponent(orderId)}/etrn`, { headers });
  if(!res.ok) return null;
  const data=await res.json().catch(()=>({}));
  return data.etrn||null;
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
    if(!res.ok) throw new Error(data.error||data.message||`HTTP ${res.status}`);
    return data.etrn;
  }
  return sandboxCreateEtrnLocal(order);
}
async function createEtrnForOrder(orderId){
  const statusEl=$('etrn-status');
  const btn=$('etrn-create');
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o){ if(statusEl) statusEl.textContent='Заказ не найден'; return; }
  if(!looksClosedOrder(o)){ if(statusEl) statusEl.textContent='Заказ не закрыт'; return; }
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
  const url=driverEtrnSignUrl(o);
  if(url){
    try{ window.open(url, '_blank', 'noopener'); return; }catch(_){}
  }
  const et=o.etrn||{};
  const tit=driverEtrnTitulsPending(o);
  alert(`ЭТрН (sandbox): заказ №${o.sequentialNumber||'—'}\nОператор: ${et.operatorId||'stub'}\nID: ${et.externalId||'—'}\nПодпись: ${tit}\n\nПосле подключения оператора откроется ссылка или QR для подписи T3/T4.`);
}
function driverEtrnBannerHtml(){
  const list=driverEtrnPendingOrders();
  if(!list.length) return '';
  const items=list.map(o=>{
    const tit=driverEtrnTitulsPending(o);
    return `<p>Заказ № ${esc(o.sequentialNumber||'—')} — ${esc(tit)}
      <button type="button" class="secondary banner-etrn-sign" data-etrn-sign="${esc(o.id)}">Подписать ЭТрН</button></p>`;
  }).join('');
  return `<strong>ЭТрН: подпись водителя</strong>${items}`;
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
