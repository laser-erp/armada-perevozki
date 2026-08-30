/* АРМАДА — документооборот: рамочный договор, заявка, договор‑заявка, ЭТрН (MVP) */
const DOC_STATUSES=[
  {id:'draft', label:'Черновик'},
  {id:'ready', label:'Готов'},
  {id:'sent', label:'Отправлен'},
  {id:'signed', label:'Подписан'}
];
const DOC_KINDS=[
  {id:'application', title:'Заявка на перевозку', hint:'Основные данные заявки для заказчика'},
  {id:'transportApp', title:'Договор‑заявка', hint:'Между заказчиком и перевозчиком'},
  {id:'act', title:'Акт выполненных работ', hint:'После выполнения / закрытия заказа'}
];

function docStatusLabel(st){
  return (DOC_STATUSES.find(x=>x.id===st)||{}).label||'Черновик';
}
function ensureOrderDocs(o){
  if(!o) return {};
  if(!o.docs || typeof o.docs!=='object') o.docs={};
  DOC_KINDS.forEach(k=>{
    const cur=o.docs[k.id];
    if(!cur || typeof cur!=='object'){
      o.docs[k.id]={status:'draft', updatedAt:null};
    } else {
      if(!DOC_STATUSES.some(s=>s.id===cur.status)) cur.status='draft';
      if(cur.updatedAt==null) cur.updatedAt=null;
    }
  });
  return o.docs;
}
function paymentFormLabel(o){
  if(!o) return 'наличные';
  if(o.paymentForm==='withVat') return 'с НДС';
  if(o.paymentForm==='withoutVat') return 'без НДС';
  return 'наличные';
}
function resolveParty(companyId, companyName, spaceId){
  let co=findCompanyById(companyId)||findCompanyByName(companyName)||null;
  let sp=spaceId?findSpaceById(spaceId):null;
  if(!sp && co && co.spaceId) sp=findSpaceById(co.spaceId);
  const name=(co&&co.name)||(sp&&sp.name)||companyName||'—';
  return {
    name,
    inn:(co&&co.inn)||(sp&&sp.inn)||'',
    kpp:(co&&co.kpp)||(sp&&sp.kpp)||'',
    ogrn:(co&&co.ogrn)||(sp&&sp.ogrn)||'',
    address:(co&&co.address)||(sp&&sp.address)||''
  };
}
function partyLinesHtml(p){
  const bits=[];
  if(p.inn) bits.push(`ИНН ${esc(p.inn)}`);
  if(p.kpp) bits.push(`КПП ${esc(p.kpp)}`);
  if(p.ogrn) bits.push(`ОГРН ${esc(p.ogrn)}`);
  const req=bits.length?`<div class="muted">${bits.join(' · ')}</div>`:'';
  const addr=p.address?`<div class="muted">${esc(p.address)}</div>`:'';
  return `<div class="party"><strong>${esc(p.name||'—')}</strong>${req}${addr}</div>`;
}
function orderDocMoneyLine(o){
  const rate=clientRate(o);
  const form=paymentFormLabel(o);
  if(rate==null) return `Форма оплаты: ${form}. Сумма не заполнена.`;
  return `Форма оплаты: ${form}. Сумма к оплате: ${fmt(rate)} ₽`;
}
function orderDocRouteRows(o){
  const pts=ensureRoutePoints(o)||[];
  if(!pts.length) return `<tr><td colspan="2">${esc(routeText(o)||'—')}</td></tr>`;
  return pts.map((p,i)=>`<tr><td>${i+1}. ${esc(kindTitle(p.kind))}</td><td>${esc(p.address||'—')}</td></tr>`).join('');
}
function driverLicenseNo(name, companyId){
  const rec=typeof findDriverRecord==='function'?findDriverRecord(name, companyId):null;
  return rec&&rec.licenseNo?String(rec.licenseNo).trim():'';
}
function orderPassportText(o){
  const pass=formatPassportText(o);
  if(pass) return pass;
  const firmId=o.executorType==='partner'?(o.carrierCompanyId||o.ownCompanyId):o.ownCompanyId;
  return formatPassportText(findDriverRecord(o.driverName, firmId));
}
function orderLicenseNo(o){
  const v=String(o.driverLicenseNo||'').trim();
  if(v) return v;
  const firmId=o.executorType==='partner'?(o.carrierCompanyId||o.ownCompanyId):o.ownCompanyId;
  return driverLicenseNo(o.driverName, firmId);
}
function orderStsText(o){
  const s=String(o.vehicleStsSeries||'').trim();
  const n=String(o.vehicleStsNumber||'').trim();
  if(s||n) return [s,n].filter(Boolean).join(' ');
  const veh=typeof fleetVehicleForOrder==='function'?fleetVehicleForOrder(o):null;
  if(!veh) return '';
  return [String(veh.stsSeries||'').trim(), String(veh.stsNumber||'').trim()].filter(Boolean).join(' ');
}
function orderGmsNumber(o){
  const g=String(o.vehicleGmsNumber||'').trim();
  if(g) return g;
  const veh=typeof fleetVehicleForOrder==='function'?fleetVehicleForOrder(o):null;
  return veh&&veh.gmsNumber?String(veh.gmsNumber).trim():'';
}
function syncOrderDriverVehicleDocs(o){
  if(!o||!orderHasDriverVehicleAssigned(o)) return false;
  const firmId=o.executorType==='partner'?(o.carrierCompanyId||o.ownCompanyId):o.ownCompanyId;
  const drv=typeof findDriverRecord==='function'?findDriverRecord(o.driverName, firmId):null;
  const veh=typeof fleetVehicleForOrder==='function'?fleetVehicleForOrder(o):null;
  let changed=false;
  const set=(k,v)=>{
    const val=String(v||'').trim();
    if(val && o[k]!==val){ o[k]=val; changed=true; }
    else if(!val && o[k]){ o[k]=''; changed=true; }
  };
  if(drv){
    set('driverPassportSeries', drv.passportSeries);
    set('driverPassportNumber', drv.passportNumber);
    set('driverPassportIssuedBy', drv.passportIssuedBy);
    set('driverPassportIssuedAt', drv.passportIssuedAt);
    set('driverLicenseNo', drv.licenseNo);
    set('driverLicenseIssuedAt', drv.licenseIssuedAt);
  }
  if(veh){
    set('vehicleStsSeries', veh.stsSeries);
    set('vehicleStsNumber', veh.stsNumber);
    set('vehicleGmsNumber', veh.gmsNumber);
    if(veh.stsPhoto && o.vehicleStsPhoto!==veh.stsPhoto){ o.vehicleStsPhoto=veh.stsPhoto; changed=true; }
    else if(!veh.stsPhoto && o.vehicleStsPhoto){ o.vehicleStsPhoto=null; changed=true; }
  }
  if(o.transportApp){
    o.transportApp.driverPassportSeries=o.driverPassportSeries||'';
    o.transportApp.driverPassportNumber=o.driverPassportNumber||'';
    o.transportApp.driverLicenseNo=o.driverLicenseNo||'';
    o.transportApp.vehicleStsSeries=o.vehicleStsSeries||'';
    o.transportApp.vehicleStsNumber=o.vehicleStsNumber||'';
    o.transportApp.vehicleGmsNumber=o.vehicleGmsNumber||'';
  }
  return changed;
}
function orderVehicleSpecLine(o){
  const plate=(o.transportApp&&o.transportApp.vehiclePlate)||o.vehiclePlate||'';
  const firmId=o.executorType==='partner'?(o.carrierCompanyId||o.ownCompanyId):o.ownCompanyId;
  const veh=(state.vehicles||[]).find(v=>v.plate===plate && (!firmId||v.companyId===firmId))
    ||(state.vehicles||[]).find(v=>v.plate===plate);
  if(!veh) return '';
  const bits=[];
  if(veh.makeModel) bits.push(veh.makeModel);
  if(typeof vehicleSpecText==='function'){
    const spec=vehicleSpecText(veh);
    if(spec) bits.push(spec);
  }
  return bits.join(' · ');
}
function orderDriverDetailLines(o){
  const app=o.transportApp||null;
  const driver=app&&app.driverName?app.driverName:(o.driverName||'—');
  const plate=app&&app.vehiclePlate?app.vehiclePlate:(o.vehiclePlate||'—');
  const phone=orderDriverPhone(o)||(app&&app.driverPhone)||'';
  const firmId=o.executorType==='partner'?(o.carrierCompanyId||o.ownCompanyId):o.ownCompanyId;
  const license=orderLicenseNo(o);
  const licenseIssued=String(o.driverLicenseIssuedAt||'').trim()
    ||((findDriverRecord(o.driverName, firmId)||{}).licenseIssuedAt||'');
  const passport=orderPassportText(o);
  const passportIssued=formatPassportIssuedText(o)
    ||formatPassportIssuedText(findDriverRecord(o.driverName, firmId));
  const sts=orderStsText(o);
  const gms=orderGmsNumber(o);
  const spec=orderVehicleSpecLine(o);
  let html=`Водитель: <strong>${esc(driver)}</strong>`;
  if(phone) html+=` · ☎ ${esc(phone)}`;
  if(passport) html+=`<br>Паспорт: <strong>${esc(passport)}</strong>${passportIssued?` · ${esc(passportIssued)}`:''}`;
  if(license) html+=`<br>Водительское удостоверение: <strong>${esc(license)}</strong>${licenseIssued?` · выдано ${esc(licenseIssued)}`:''}`;
  html+=`<br>ТС: <strong>${esc(plate)}</strong>`;
  if(spec) html+=` · ${esc(spec)}`;
  if(sts) html+=`<br>СТС: <strong>${esc(sts)}</strong>`;
  if(gms) html+=`<br>ГМС: <strong>${esc(gms)}</strong>`;
  if(orderReqText(o)) html+=`<br>Требования к ТС: ${esc(orderReqText(o))}`;
  return html;
}
function buildOrderDocBody(kind, o){
  const sid=o.partnerSpaceId||o.spaceId;
  if(typeof buildOrderDocFromTemplate==='function'){
    const tpl=buildOrderDocFromTemplate(kind,o,sid);
    if(tpl) return tpl;
  }
  const own=resolveParty(o.ownCompanyId, o.ownCompanyName, o.spaceId);
  const customer=resolveParty(o.customerId, o.customer, o.spaceId);
  const carrierName=o.carrierCompanyName||(o.executorType==='partner'?'':own.name);
  const carrier=resolveParty(o.carrierCompanyId, carrierName||own.name, o.executorType==='partner'?o.partnerSpaceId:o.spaceId);
  const app=o.transportApp||null;
  const title=(DOC_KINDS.find(k=>k.id===kind)||{}).title||'Документ';
  const num=o.sequentialNumber!=null?o.sequentialNumber:'—';
  const when=dayOnly(o.vehicleAt||o.createdAt)||dayOnly(o.createdAt)||'—';
  const contact=[o.contactName, formatPhone(o.contactPhone||'')].filter(Boolean).join(', ')||'—';
  const kmBits=[
    o.emptyKmBefore!=null?`нулевой ${fmt(o.emptyKmBefore)} км`:'',
    o.loadedKm!=null?`с грузом ${fmt(o.loadedKm)} км`:'',
    o.emptyKmAfter!=null?`до стоянки ${fmt(o.emptyKmAfter)} км`:''
  ].filter(Boolean).join(' · ')||'—';
  const commonHead=`
    <div class="doc-head">
      <div class="brand">АРМАДА</div>
      <h1>${esc(title)}</h1>
      <div class="muted">к заявке № ${esc(num)} · ${esc(when)}</div>
    </div>`;
  if(kind==='application'){
    return `${commonHead}
      <h2>1. Заказчик</h2>
      ${partyLinesHtml(customer)}
      <p>Контакт: ${esc(contact)}</p>
      <h2>2. Исполнитель (перевозчик)</h2>
      ${partyLinesHtml(o.executorType==='partner'?carrier:own)}
      <h2>3. Подача и маршрут</h2>
      <p>Подача ТС: <strong>${esc(o.vehicleAt?dateTime(o.vehicleAt):'—')}</strong></p>
      <table><thead><tr><th>Точка</th><th>Адрес</th></tr></thead><tbody>${orderDocRouteRows(o)}</tbody></table>
      <h2>4. Транспорт и водитель</h2>
      <p>${orderDriverDetailLines(o)}</p>
      <h2>5. Стоимость</h2>
      <p>${esc(orderDocMoneyLine(o))}</p>
      <div class="sign">
        <div>Заказчик _______________ / _______________</div>
        <div>Исполнитель _______________ / _______________</div>
      </div>`;
  }
  if(kind==='transportApp'){
    const left=app?resolveParty(app.customerCompanyId, app.customerCompanyName, null):customer;
    const right=app?resolveParty(app.carrierCompanyId, app.carrierCompanyName, null):carrier;
    return `${commonHead}
      <p class="muted">${app&&app.signedAt?`Подписан в системе: ${esc(dateTime(app.signedAt))}`:'Черновик договора‑заявки по данным заказа'}</p>
      <h2>1. Заказчик перевозки</h2>
      ${partyLinesHtml(left)}
      <h2>2. Перевозчик</h2>
      ${partyLinesHtml(right)}
      <h2>3. Условия перевозки</h2>
      <p>Маршрут: <strong>${esc((app&&app.route)||routeText(o)||'—')}</strong></p>
      <table><thead><tr><th>Точка</th><th>Адрес</th></tr></thead><tbody>${orderDocRouteRows(o)}</tbody></table>
      <p>Подача: <strong>${esc(o.vehicleAt?dateTime(o.vehicleAt):'—')}</strong><br>
      ${orderDriverDetailLines(o)}</p>
      <h2>4. Оплата</h2>
      <p>${esc(orderDocMoneyLine(o))}</p>
      <div class="sign">
        <div>Заказчик _______________ / _______________</div>
        <div>Перевозчик _______________ / _______________</div>
      </div>`;
  }
  const driver=(app&&app.driverName)||o.driverName||'—';
  const plate=(app&&app.vehiclePlate)||o.vehiclePlate||'—';
  return `${commonHead}
    <p class="muted">${looksClosedOrder(o)?`Заказ закрыт ${esc(dateTime(o.closedAt))}`:'Заказ ещё не закрыт — акт по текущим данным'}</p>
    <h2>1. Заказчик</h2>
    ${partyLinesHtml(customer)}
    <h2>2. Исполнитель</h2>
    ${partyLinesHtml(o.executorType==='partner'?carrier:own)}
    <h2>3. Выполненные работы</h2>
    <p>Перевозка груза по заявке № <strong>${esc(num)}</strong>.<br>
    Маршрут: <strong>${esc(routeText(o)||'—')}</strong><br>
    Водитель / ТС: <strong>${esc(driver)}</strong> · <strong>${esc(plate)}</strong><br>
    Пробег: ${esc(kmBits)}</p>
    <h2>4. Стоимость</h2>
    <p>${esc(orderDocMoneyLine(o))}</p>
    <p>Работы выполнены полностью, стороны претензий не имеют.</p>
    <div class="sign">
      <div>Заказчик _______________ / _______________</div>
      <div>Исполнитель _______________ / _______________</div>
    </div>`;
}
function orderDocPrintHtml(title, bodyHtml){
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8" />
<title>${esc(title)}</title>
<style>
  @page{size:A4;margin:16mm}
  body{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111;font-size:12.5px;line-height:1.45;margin:0;padding:0}
  .sheet{max-width:180mm;margin:0 auto;padding:8mm 4mm}
  .doc-head{margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid #EF4444}
  .brand{font-weight:700;letter-spacing:.14em;font-size:13px;color:#EF4444;margin-bottom:4px}
  h1{margin:0 0 4px;font-size:18px;line-height:1.2}
  h2{margin:16px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#444}
  p{margin:0 0 8px}
  .muted{color:#666;font-size:11.5px}
  .party{margin:0 0 8px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:6px}
  table{width:100%;border-collapse:collapse;margin:6px 0 10px}
  th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f3f4f6;font-size:11px}
  .sign{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:28px}
  .sign div{padding-top:18px;border-top:1px solid #111}
  .toolbar{display:flex;gap:8px;margin:0 0 12px;position:sticky;top:0;background:#fff;padding:8px 0}
  .toolbar button{border:0;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer;background:#EF4444;color:#fff}
  .toolbar button.secondary{background:#f3f4f6;color:#111}
  @media print{.toolbar{display:none!important}.sheet{padding:0}}
</style></head><body>
<div class="sheet">
  <div class="toolbar">
    <button type="button" onclick="window.print()">Печать / PDF</button>
    <button type="button" class="secondary" onclick="window.close()">Закрыть</button>
  </div>
  ${bodyHtml}
</div>
</body></html>`;
}
function openPrintHtml(title, bodyHtml){
  const w=window.open('', '_blank');
  if(!w){ alert('Разрешите всплывающие окна, чтобы печатать документ'); return; }
  w.document.open();
  w.document.write(orderDocPrintHtml(title, bodyHtml));
  w.document.close();
}
function refreshOrderDocRow(orderId, kind){
  const o=state.orders.find(x=>x.id===orderId); if(!o) return;
  ensureOrderDocs(o);
  const st=o.docs[kind].status||'draft';
  const row=document.querySelector(`#detail-form .doc-row[data-doc-kind="${kind}"]`);
  if(!row) return;
  const chip=row.querySelector('.doc-status');
  if(chip){ chip.className=`doc-status ${st}`; chip.textContent=docStatusLabel(st); }
  const sel=row.querySelector('[data-doc-status]');
  if(sel && sel.value!==st) sel.value=st;
  const kindMeta=DOC_KINDS.find(k=>k.id===kind);
  const meta=row.querySelector('.doc-meta');
  if(meta && kindMeta){
    const updated=o.docs[kind].updatedAt?` · ${dateTime(o.docs[kind].updatedAt)}`:'';
    meta.textContent=`${kindMeta.hint}${updated}`;
  }
}
function printOrderDoc(orderId, kind){
  const o=state.orders.find(x=>x.id===orderId); if(!o) return;
  ensureOrderDocs(o);
  if(!o.docs[kind]) return;
  if(o.docs[kind].status==='draft'){
    o.docs[kind].status='ready';
    o.docs[kind].updatedAt=new Date().toISOString();
    bumpDataEpoch('doc-ready');
    upsertOrder(o);
    refreshOrderDocRow(orderId, kind);
  }
  const title=`${(DOC_KINDS.find(k=>k.id===kind)||{}).title||'Документ'} · заявка №${o.sequentialNumber}`;
  openPrintHtml(title, buildOrderDocBody(kind, o));
}
function setOrderDocStatus(orderId, kind, status){
  const o=state.orders.find(x=>x.id===orderId); if(!o) return;
  ensureOrderDocs(o);
  if(!DOC_STATUSES.some(s=>s.id===status)) return;
  o.docs[kind].status=status;
  o.docs[kind].updatedAt=new Date().toISOString();
  bumpDataEpoch('doc-status');
  upsertOrder(o);
  refreshOrderDocRow(orderId, kind);
}
function orderDocsSectionHtml(o){
  ensureOrderDocs(o);
  const rows=DOC_KINDS.map(k=>{
    const st=o.docs[k.id].status||'draft';
    const updated=o.docs[k.id].updatedAt?` · ${dateTime(o.docs[k.id].updatedAt)}`:'';
    const opts=DOC_STATUSES.map(s=>`<option value="${s.id}" ${s.id===st?'selected':''}>${esc(s.label)}</option>`).join('');
    return `<div class="doc-row" data-doc-kind="${esc(k.id)}">
      <div>
        <div class="doc-name">${esc(k.title)}</div>
        <div class="doc-meta">${esc(k.hint)}${esc(updated)}</div>
        <div class="doc-status ${esc(st)}">${esc(docStatusLabel(st))}</div>
      </div>
      <div class="doc-actions">
        <select data-doc-status="${esc(k.id)}" aria-label="Статус: ${esc(k.title)}">${opts}</select>
        <button type="button" class="secondary" data-doc-print="${esc(k.id)}">Печать</button>
      </div>
    </div>`;
  }).join('');
  return `<section class="form-section" id="order-docs-section">
    <h2 class="form-section-title">Документы</h2>
    <p class="form-section-hint">Печать или PDF через диалог браузера. Статус сохраняется в заявке.</p>
    <div class="docs-list">${rows}</div>
  </section>`;
}
function wireOrderDocs(orderId){
  document.querySelectorAll('#detail-form [data-doc-print]').forEach(btn=>{
    btn.onclick=e=>{
      e.preventDefault();
      printOrderDoc(orderId, btn.getAttribute('data-doc-print'));
    };
  });
  document.querySelectorAll('#detail-form [data-doc-status]').forEach(sel=>{
    sel.onchange=()=>{
      setOrderDocStatus(orderId, sel.getAttribute('data-doc-status'), sel.value);
    };
  });
}

/** Рамочный договор на перевозку с заказчиком */
function normalizeFrameworkContract(raw){
  const fc=raw&&typeof raw==='object'?raw:{};
  let status=fc.status||'none';
  if(raw===true || fc.signed===true) status='signed';
  if(status!=='none'&&status!=='pending'&&status!=='signed') status='none';
  return {
    status,
    carrierId:fc.carrierId||null,
    carrierName:String(fc.carrierName||'').trim(),
    sentAt:fc.sentAt||null,
    signedAt:fc.signedAt||null,
    signedBy:String(fc.signedBy||'').trim()
  };
}
function customerFrameworkContractSigned(co){
  if(!co) return false;
  if(co.contractSigned) return true;
  const fc=normalizeFrameworkContract(co.frameworkContract);
  return fc.status==='signed';
}
function customerFrameworkContractStatus(co){
  if(customerFrameworkContractSigned(co)) return 'signed';
  const fc=normalizeFrameworkContract(co&&co.frameworkContract);
  if(fc.status==='pending') return 'pending';
  return 'none';
}
function customerFrameworkContractLabel(st){
  if(st==='signed') return 'Подписан';
  if(st==='pending') return 'Ожидает подписания';
  return 'Не оформлен';
}
function ensureCustomerFrameworkContract(customerCo, carrierCo){
  if(!customerCo) return null;
  const signed=customerFrameworkContractSigned(customerCo);
  if(signed) return customerCo;
  let fc=normalizeFrameworkContract(customerCo.frameworkContract);
  if(fc.status==='none'){
    fc={
      status:'pending',
      carrierId:carrierCo&&carrierCo.id||fc.carrierId||null,
      carrierName:carrierCo&&carrierCo.name||fc.carrierName||'',
      sentAt:new Date().toISOString(),
      signedAt:null,
      signedBy:''
    };
    customerCo.frameworkContract=fc;
    customerCo.contractSigned=false;
    upsertCompany(customerCo);
    bumpDataEpoch('framework-contract-pending');
  }
  return customerCo;
}
function signCustomerFrameworkContract(customerId, signedByName){
  const co=findCompanyById(customerId);
  if(!co) return false;
  const fc=normalizeFrameworkContract(co.frameworkContract);
  co.contractSigned=true;
  co.frameworkContract={
    ...fc,
    status:'signed',
    signedAt:new Date().toISOString(),
    signedBy:String(signedByName||'').trim()
  };
  upsertCompany(co);
  bumpDataEpoch('framework-contract-signed');
  if(typeof persist==='function') persist();
  return true;
}
function buildFrameworkContractBody(customerCo, carrierCo){
  const sid=(carrierCo&&carrierCo.spaceId)||(customerCo&&customerCo.spaceId)||(typeof currentSpaceId==='function'?currentSpaceId():null);
  if(typeof buildOrderDocFromTemplate==='function'&&sid&&hasCustomDocTemplate(sid,'framework')){
    const demoOrder={customerId:customerCo&&customerCo.id,customer:customerCo&&customerCo.name,ownCompanyId:carrierCo&&carrierCo.id,ownCompanyName:carrierCo&&carrierCo.name,spaceId:sid,sequentialNumber:'—',createdAt:new Date().toISOString()};
    return buildOrderDocFromTemplate('framework', demoOrder, sid);
  }
  const customer=customerCo?resolveParty(customerCo.id, customerCo.name, customerCo.spaceId):{name:'—',inn:'',address:''};
  const carrier=resolveParty(carrierCo&&carrierCo.id, carrierCo&&carrierCo.name, carrierCo&&carrierCo.spaceId);
  const fc=normalizeFrameworkContract(customerCo&&customerCo.frameworkContract);
  const signedLine=fc.signedAt?`<p class="muted">Подписан в системе: ${esc(dateTime(fc.signedAt))}${fc.signedBy?` · ${esc(fc.signedBy)}`:''}</p>`:'';
  return `
    <div class="doc-head">
      <div class="brand">АРМАДА</div>
      <h1>Договор на оказание транспортно‑экспедиционных услуг</h1>
      <div class="muted">рамочный · между заказчиком и перевозчиком</div>
    </div>
    ${signedLine}
    <h2>1. Стороны</h2>
    <p><strong>Заказчик:</strong></p>${partyLinesHtml(customer)}
    <p><strong>Перевозчик:</strong></p>${partyLinesHtml(carrier)}
    <h2>2. Предмет</h2>
    <p>Перевозчик обязуется по заявкам Заказчика оказывать услуги автомобильной перевозки грузов, а Заказчик — принимать и оплачивать услуги на условиях настоящего договора и отдельных заявок (договоров‑заявок) в системе АРМАДА.</p>
    <h2>3. Порядок работы</h2>
    <p>3.1. Заказчик направляет заявку через портал или иным согласованным способом.<br>
    3.2. Стоимость, маршрут, сроки подачи ТС и иные условия конкретной перевозки фиксируются в заявке на перевозку / договоре‑заявке.<br>
    3.3. Электронные документы (счёт, заявка, ЭТрН) формируются в личном кабинете.</p>
    <h2>4. Оплата</h2>
    <p>Оплата производится по счёту Перевозчика в сроки, указанные в заявке. Форма расчётов — безналичный перевод или иная, согласованная сторонами.</p>
    <h2>5. Электронное взаимодействие (MVP)</h2>
    <p>Настоящий договор может быть принят Заказчиком путём проставления отметки «Согласен с условиями» в портале с фиксацией даты и времени. Полноценная квалифицированная подпись — через оператора ЭДО (Контур, СБИС, Диадoc) после подключения интеграции.</p>
    <h2>6. Срок</h2>
    <p>Договор действует с даты подписания до расторжения любой из сторон с уведомлением за 30 календарных дней.</p>
    <div class="sign">
      <div>Заказчик _______________ / _______________</div>
      <div>Перевозчик _______________ / _______________</div>
    </div>`;
}
function openFrameworkContractPrint(customerCo, carrierCo){
  const title=`Договор · ${customerCo&&customerCo.name||'заказчик'}`;
  openPrintHtml(title, buildFrameworkContractBody(customerCo, carrierCo));
}

function orderDriverVehicleDocsSectionHtml(o){
  if(!o||typeof orderHasDriverVehicleAssigned!=='function'||!orderHasDriverVehicleAssigned(o)) return '';
  const passport=orderPassportText(o);
  const passportIssued=formatPassportIssuedText(o);
  const license=orderLicenseNo(o);
  const licenseIssued=String(o.driverLicenseIssuedAt||'').trim();
  const sts=orderStsText(o);
  const gms=orderGmsNumber(o);
  const stsPhoto=o.vehicleStsPhoto||((fleetVehicleForOrder&&fleetVehicleForOrder(o)||{}).stsPhoto)||null;
  return `<section class="form-section" id="order-drv-docs">
    <h2 class="form-section-title">Водитель и ТС · документы</h2>
    <p class="form-section-hint">Данные из справочника на момент назначения. Кнопка ниже — обновить из актуальных карточек водителя и авто.</p>
    <div class="metric-strip" style="grid-template-columns:1fr">
      ${passport?`<div class="m"><span>Паспорт</span><b>${esc(passport)}${passportIssued?`<br><small style="font-weight:500;color:var(--muted)">${esc(passportIssued)}</small>`:''}</b></div>`:''}
      ${license?`<div class="m"><span>ВУ</span><b>${esc(license)}${licenseIssued?` · ${esc(licenseIssued)}`:''}</b></div>`:''}
      ${sts?`<div class="m"><span>СТС</span><b>${esc(sts)}${stsPhoto?' · скан загружен':''}</b></div>`:''}
      ${gms?`<div class="m"><span>ГМС</span><b>${esc(gms)}</b></div>`:''}
      ${!passport&&!license&&!sts&&!gms?`<div class="hint">Заполните паспорт и ВУ в «Справочники → Водители», СТС и ГМС — в карточке авто.</div>`:''}
    </div>
    <button type="button" class="secondary" id="d-sync-drv-docs" style="width:auto;margin-top:8px">Обновить из справочника</button>
  </section>`;
}
function orderHasDriverVehicleAssigned(o){
  if(!o) return false;
  const drv=String(o.driverName||'').trim();
  const plate=String(o.vehiclePlate||'').trim();
  if(!drv||!plate||drv==='Биржа'||drv==='Диспетчер'||drv==='—'||plate==='—') return false;
  if(typeof waitingLogistDriver==='function'&&waitingLogistDriver(drv)) return false;
  return true;
}
function ensureOwnFleetTransportApp(o){
  if(!o||o.transportApp||o.executorType==='partner') return;
  if(!orderHasDriverVehicleAssigned(o)) return;
  const customerCo=findCompanyById(o.customerId)||findCompanyByName(o.customer);
  o.transportApp={
    id:uuid(),
    signedAt:null,
    customerCompanyId:o.customerId||(customerCo&&customerCo.id)||null,
    customerCompanyName:o.customer||(customerCo&&customerCo.name)||'',
    carrierCompanyId:o.ownCompanyId||null,
    carrierCompanyName:o.ownCompanyName||'',
    driverName:o.driverName,
    vehiclePlate:o.vehiclePlate,
    driverPhone:orderDriverPhone(o)||'',
    driverPassportSeries:o.driverPassportSeries||'',
    driverPassportNumber:o.driverPassportNumber||'',
    driverLicenseNo:o.driverLicenseNo||'',
    vehicleStsSeries:o.vehicleStsSeries||'',
    vehicleStsNumber:o.vehicleStsNumber||'',
    vehicleGmsNumber:o.vehicleGmsNumber||'',
    route:routeText(o),
    orderSequentialNumber:o.sequentialNumber
  };
}
function syncOrderDocsOnAssign(o){
  if(!o||!orderHasDriverVehicleAssigned(o)) return false;
  if(typeof syncOrderDriverVehicleDocs==='function') syncOrderDriverVehicleDocs(o);
  ensureOwnFleetTransportApp(o);
  ensureOrderDocs(o);
  const now=new Date().toISOString();
  let changed=false;
  ['application','transportApp'].forEach(kind=>{
    const cur=o.docs[kind];
    if(cur && (cur.status==='draft'||!cur.updatedAt)){
      cur.status='ready';
      cur.updatedAt=now;
      changed=true;
    }
  });
  if(changed) bumpDataEpoch('doc-assign-sync');
  return changed;
}

function customerOrderDocStatus(kind, o){
  ensureOrderDocs(o);
  if(kind==='invoice'){
    const inv=typeof findInvoiceByOrderId==='function'?findInvoiceByOrderId(o.id):null;
    return inv?{label:'Готов', cls:'ready', available:true}:{label:'После заявки', cls:'draft', available:false};
  }
  if(kind==='framework'){
    const co=findCompanyById(o.customerId);
    const st=customerFrameworkContractStatus(co);
    return {label:customerFrameworkContractLabel(st), cls:st==='signed'?'signed':st==='pending'?'sent':'draft', available:true};
  }
  if(kind==='act'){
    if(!looksClosedOrder(o)) return {label:'После закрытия заказа', cls:'draft', available:false};
    return {label:'Готов', cls:'ready', available:true};
  }
  if(kind==='etrn'){
    const et=o.etrn;
    if(!orderHasDriverVehicleAssigned(o)) return {label:'После назначения ТС', cls:'draft', available:false};
    if(!et) return {label:'Перед выездом', cls:'draft', available:false};
    if(typeof customerEtrnT1Pending==='function'&&customerEtrnT1Pending(o)){
      const lbl=typeof customerCanSignEtrnT1==='function'&&customerCanSignEtrnT1(o)?'Ждёт подпись T1':'Ждёт грузоотправителя';
      return {label:lbl, cls:'sent', available:true};
    }
    if(orderEtrnTransportActive&&orderEtrnTransportActive(o)) return {label:'У водителя (QR)', cls:'ready', available:true};
    const st=et.status||'draft';
    const lbl=st==='signed'||st==='completed'?'Готов':st==='draft'?'Черновик':'В работе';
    return {label:lbl, cls:st==='draft'?'draft':'ready', available:true};
  }
  if(kind==='application'||kind==='transportApp'){
    if(!orderHasDriverVehicleAssigned(o) && kind==='application'){
      const st=o.docs.application.status;
      if(st==='ready'||st==='sent'||st==='signed') return {label:docStatusLabel(st), cls:st, available:true};
      return {label:'После назначения ТС', cls:'draft', available:false};
    }
    if(!orderHasDriverVehicleAssigned(o)){
      return {label:'После назначения ТС и водителя', cls:'draft', available:false};
    }
    const st=o.docs[kind].status||'draft';
    return {label:docStatusLabel(st), cls:st, available:st!=='draft'};
  }
  const st=o.docs[kind]&&o.docs[kind].status||'draft';
  return {label:docStatusLabel(st), cls:st, available:st!=='draft'};
}
function customerOrderDocumentsHtml(o){
  const items=[
    {id:'invoice', title:'Счёт на оплату'},
    {id:'framework', title:'Рамочный договор'},
    {id:'application', title:'Заявка на перевозку'},
    {id:'transportApp', title:'Договор‑заявка'},
    {id:'etrn', title:'ЭТрН'},
    {id:'act', title:'Акт выполненных работ'}
  ];
  const email=customerContactEmail(o);
  const rows=items.map(it=>{
    const st=customerOrderDocStatus(it.id, o);
    const openBtn=st.available
      ?`<button type="button" class="secondary cust-doc-open" data-order-id="${esc(o.id)}" data-doc-kind="${esc(it.id)}">Открыть</button>`
      :`<span class="hint">—</span>`;
    const mailBtn=email&&documentEmailCanSend(it.id, o)
      ?`<button type="button" class="secondary cust-doc-email" data-order-id="${esc(o.id)}" data-doc-kind="${esc(it.id)}">На email</button>`
      :'';
    return `<div class="cust-doc-row">
      <div><span class="cust-doc-name">${esc(it.title)}</span>
      <span class="doc-status ${esc(st.cls)}">${esc(st.label)}</span></div>
      <div class="cust-doc-actions">${openBtn}${mailBtn}</div>
    </div>`;
  }).join('');
  const emailHint=email?`<p class="hint cust-doc-email-hint">Документы можно отправить на ${esc(email)}</p>`:'';
  return `<div class="cust-order-docs">${emailHint}${rows}</div>`;
}
function customerContactEmail(o){
  const co=o&&findCompanyById(o.customerId);
  if(!co) return '';
  const contacts=Array.isArray(co.contacts)?co.contacts:[];
  const portalPhone=currentCustomer&&currentCustomer.phone;
  let c=contacts.find(x=>portalPhone&&x.phone&&samePhone(x.phone, portalPhone));
  if(!c) c=contacts.find(x=>x.isPrimary)||contacts[0];
  const fromContact=c&&(c.email||c.mail);
  if(fromContact&&String(fromContact).includes('@')) return String(fromContact).trim();
  if(co.email&&String(co.email).includes('@')) return String(co.email).trim();
  return '';
}
function samePhone(a,b){
  const da=String(a||'').replace(/\D/g,'').slice(-10);
  const db=String(b||'').replace(/\D/g,'').slice(-10);
  return da&&db&&da===db;
}
function documentEmailCanSend(kind, o){
  if(!customerContactEmail(o)) return false;
  if(kind==='invoice') return !!(typeof findInvoiceByOrderId==='function'&&findInvoiceByOrderId(o.id));
  if(kind==='framework') return true;
  if(kind==='etrn') return !!o.etrn;
  if(kind==='act') return looksClosedOrder(o);
  if(kind==='application'||kind==='transportApp') return orderHasDriverVehicleAssigned(o);
  return false;
}
function documentEmailSubject(kind, o){
  const titles={invoice:'Счёт',framework:'Договор',application:'Заявка',transportApp:'Договор-заявка',etrn:'ЭТрН',act:'Акт'};
  return `АРМАДА: ${titles[kind]||'Документ'} по заявке №${o.sequentialNumber||'—'}`;
}
function documentEmailBody(kind, o){
  const base=(typeof location!=='undefined'&&location.origin)?location.origin:'https://app.armada.sx';
  const portal=`${base}/z/`;
  const lines=[
    `Здравствуйте!`,
    ``,
    `По заявке №${o.sequentialNumber||'—'} (${routeText(o)||'маршрут'}) подготовлен документ: ${documentEmailSubject(kind,o).replace(/^АРМАДА: /,'')}.`,
    ``,
    `Скачать в личном кабинете: ${portal}`,
    `Раздел «Мои заявки» → документы по заявке.`,
    ``,
    `С уважением, АРМАДА`
  ];
  if(kind==='invoice'){
    const inv=typeof findInvoiceByOrderId==='function'?findInvoiceByOrderId(o.id):null;
    if(inv) lines.splice(4,0,`Счёт №${inv.number} на сумму ${fmt(inv.amountRub||0)} ₽.`);
  }
  return lines.join('\n');
}
function logDocumentEmailSent(orderId, kind, email){
  if(!Array.isArray(state.documentEmailLog)) state.documentEmailLog=[];
  state.documentEmailLog.push({ id:uuid(), orderId, kind, email, at:new Date().toISOString() });
  if(state.documentEmailLog.length>200) state.documentEmailLog=state.documentEmailLog.slice(-200);
  if(typeof persist==='function') persist();
}
function sendCustomerDocumentEmail(orderId, kind){
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o) return;
  const email=customerContactEmail(o);
  if(!email){ alert('Укажите email контакта в карточке заказчика'); return; }
  if(!documentEmailCanSend(kind,o)){ alert('Документ ещё не готов для отправки'); return; }
  const subject=encodeURIComponent(documentEmailSubject(kind,o));
  const body=encodeURIComponent(documentEmailBody(kind,o));
  logDocumentEmailSent(orderId, kind, email);
  window.location.href=`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
}
function sendCustomerAllReadyDocumentsEmail(orderId){
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o) return;
  const email=customerContactEmail(o);
  if(!email){ alert('Укажите email контакта в карточке заказчика'); return; }
  const kinds=['invoice','framework','application','transportApp','etrn','act'].filter(k=>documentEmailCanSend(k,o));
  if(!kinds.length){ alert('Пока нет готовых документов для отправки'); return; }
  const subject=encodeURIComponent(`АРМАДА: документы по заявке №${o.sequentialNumber||'—'}`);
  const body=encodeURIComponent([
    'Здравствуйте!',
    '',
    `По заявке №${o.sequentialNumber||'—'} доступны документы: ${kinds.join(', ')}.`,
    '',
    'Скачайте в личном кабинете: https://app.armada.sx/z/',
    '',
    'С уважением, АРМАДА'
  ].join('\n'));
  kinds.forEach(k=>logDocumentEmailSent(orderId, k, email));
  window.location.href=`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
}
function openCustomerOrderDocument(orderId, kind){
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o) return;
  if(kind==='invoice'){
    const inv=typeof findInvoiceByOrderId==='function'?findInvoiceByOrderId(orderId):null;
    if(inv&&typeof openCustomerInvoice==='function') openCustomerInvoice(inv.id);
    else alert('Счёт ещё не сформирован');
    return;
  }
  if(kind==='framework'){
    const co=findCompanyById(o.customerId);
    const carrier=findCompanyById(o.ownCompanyId)||carrierOwnCompanyForSpace(o.spaceId);
    if(co) openFrameworkContractPrint(co, carrier);
    return;
  }
  if(kind==='etrn'){
    if(!o.etrn){ alert('ЭТрН будет создан перед выездом или перевозчиком после назначения ТС и водителя.'); return; }
    if(typeof openEtrnPrint==='function') openEtrnPrint(orderId);
    return;
  }
  if(kind==='act'){
    if(!looksClosedOrder(o)){ alert('Акт будет доступен после закрытия заказа перевозчиком.'); return; }
    ensureOrderDocs(o);
    o.docs.act.status='ready';
    o.docs.act.updatedAt=new Date().toISOString();
    upsertOrder(o);
    persist();
    const title=`Акт · заявка №${o.sequentialNumber}`;
    openPrintHtml(title, buildOrderDocBody('act', o));
    return;
  }
  ensureOrderDocs(o);
  if(!orderHasDriverVehicleAssigned(o) && (kind==='application'||kind==='transportApp')){
    alert('Документ будет доступен после назначения водителя и ТС перевозчиком.');
    return;
  }
  const title=`${(DOC_KINDS.find(k=>k.id===kind)||{}).title||'Документ'} · заявка №${o.sequentialNumber}`;
  openPrintHtml(title, buildOrderDocBody(kind, o));
}
function wireCustomerOrderDocuments(root){
  (root||document).querySelectorAll('.cust-doc-open').forEach(btn=>{
    btn.onclick=e=>{
      e.preventDefault();
      openCustomerOrderDocument(btn.getAttribute('data-order-id'), btn.getAttribute('data-doc-kind'));
    };
  });
  (root||document).querySelectorAll('.cust-doc-email').forEach(btn=>{
    btn.onclick=e=>{
      e.preventDefault();
      sendCustomerDocumentEmail(btn.getAttribute('data-order-id'), btn.getAttribute('data-doc-kind'));
    };
  });
  (root||document).querySelectorAll('.cust-doc-email-all').forEach(btn=>{
    btn.onclick=e=>{
      e.preventDefault();
      sendCustomerAllReadyDocumentsEmail(btn.getAttribute('data-order-id'));
    };
  });
}
function customerFrameworkContractBannerHtml(customerCo, carrierCo){
  if(!customerCo) return '';
  const st=customerFrameworkContractStatus(customerCo);
  if(st==='signed') return '';
  const carrierName=carrierCo&&carrierCo.name||'перевозчиком';
  return `<section class="form-section cust-contract-banner" id="cust-contract-banner">
    <h2 class="form-section-title">Рамочный договор</h2>
    <p class="hint">Для работы с ${esc(carrierName)} нужен договор на перевозку. Прочитайте условия и подтвердите согласие — или подключите Контур/Диадoc позже.</p>
    <div class="cust-contract-actions">
      <button type="button" class="secondary" id="cust-contract-preview">Просмотреть договор</button>
      <label class="cust-check-item"><input type="checkbox" id="cust-contract-agree"/> Согласен с условиями договора</label>
      <button type="button" class="primary" id="cust-contract-sign" disabled>Подписать</button>
    </div>
    <p class="hint" id="cust-contract-status">${st==='pending'?'Ожидает вашей подписи':'Договор будет подготовлен при первой заявке'}</p>
  </section>`;
}
/** Роль фирмы space в документообороте по заявке */
function orderDocRoleForSpace(o, spaceId){
  if(!o||!spaceId) return null;
  if(o.partnerSpaceId===spaceId) return 'carrier';
  if(o.spaceId===spaceId){
    if(o.partnerSpaceId && o.partnerSpaceId!==spaceId) return 'customer';
    if(o.onExchange || (o.wasOnExchange && !o.partnerSpaceId)) return 'customer';
    return 'carrier';
  }
  return null;
}
function orderDocRoleLabel(role){
  if(role==='carrier') return 'Мы перевозчик';
  if(role==='customer') return 'Мы заказчик';
  return '—';
}
function adminOrderDocItems(){
  return [
    {id:'invoice', title:'Счёт на оплату'},
    {id:'framework', title:'Рамочный договор'},
    {id:'application', title:'Заявка на перевозку'},
    {id:'transportApp', title:'Договор‑заявка'},
    {id:'etrn', title:'ЭТрН'},
    {id:'act', title:'Акт выполненных работ'}
  ];
}
function adminDocsDefaultFirmFilter(){
  const sid=typeof currentSpaceId==='function'?currentSpaceId():null;
  if(sid) return sid;
  const owner=state.adminOwnerFilter||'all';
  if(owner&&owner!=='all') return owner;
  return 'all';
}

function adminOrderVisibleForDocs(o, opts){
  if(!o||!currentAdmin) return false;
  if(typeof deletedOrderIdSet==='function'&&deletedOrderIdSet().has(o.id)) return false;
  const superAdm=!!(opts&&opts.superAll);
  const firmFilter=(opts&&opts.firmFilter)||'all';
  const sid=typeof currentSpaceId==='function'?currentSpaceId():null;

  if(!superAdm){
    const mine=typeof isMyFirmOrder==='function'&&isMyFirmOrder(o);
    const partner=typeof isPartnerOnOrder==='function'&&isPartnerOnOrder(o);
    if(mine||partner) return true;
    if(typeof orderBelongsToAdmin==='function'&&orderBelongsToAdmin(o, currentAdmin.id)) return true;
    return false;
  }

  if(firmFilter==='all') return true;
  const osid=typeof orderSpaceId==='function'?orderSpaceId(o):o.spaceId;
  if(firmFilter==='_none') return !osid;
  return osid===firmFilter||o.partnerSpaceId===firmFilter;
}

function adminOrdersForDocs(opts){
  opts=opts||{};
  const sid=opts.spaceId||null;
  const superAll=!!opts.superAll;
  const roleFilter=opts.roleFilter||'all';
  const firmFilter=opts.firmFilter||'all';
  const search=String(opts.search||'').trim().toLowerCase();
  const roleSpace=superAll&&(firmFilter&&firmFilter!=='all')?firmFilter:sid;
  return (state.orders||[]).filter(o=>{
    if(!adminOrderVisibleForDocs(o, {superAll, firmFilter})) return false;
    const role=orderDocRoleForSpace(o, roleSpace||(o.partnerSpaceId||o.spaceId));
    if(roleFilter==='carrier' && role!=='carrier') return false;
    if(roleFilter==='customer' && role!=='customer') return false;
    if(search){
      const hay=[o.customer,o.ownCompanyName,o.carrierCompanyName,String(o.sequentialNumber),routeText(o)].join(' ').toLowerCase();
      if(!hay.includes(search)) return false;
    }
    return true;
  }).sort((a,b)=>{
    const ta=new Date(b.createdAt||0).getTime();
    const tb=new Date(a.createdAt||0).getTime();
    return ta-tb;
  });
}
function buildAdminOrderDocBundleBody(o){
  if(!o) return '';
  const parts=[];
  adminOrderDocItems().forEach(kind=>{
    const st=customerOrderDocStatus(kind.id, o);
    if(!st.available) return;
    let body='';
    if(kind.id==='invoice'){
      let inv=typeof findInvoiceByOrderId==='function'?findInvoiceByOrderId(o.id):null;
      if(!inv && typeof createCustomerInvoiceForOrder==='function'){
        const co=findCompanyById(o.customerId);
        const carrier=findCompanyById(o.ownCompanyId)||(typeof carrierOwnCompanyForSpace==='function'?carrierOwnCompanyForSpace(o.spaceId):null);
        inv=createCustomerInvoiceForOrder(o, co, carrier);
      }
      if(inv && typeof customerInvoiceDocBody==='function') body=customerInvoiceDocBody(inv);
    } else if(kind.id==='framework'){
      const co=findCompanyById(o.customerId);
      const carrier=findCompanyById(o.ownCompanyId)||(typeof carrierOwnCompanyForSpace==='function'?carrierOwnCompanyForSpace(o.spaceId):null);
      if(co) body=buildFrameworkContractBody(co, carrier);
    } else if(kind.id==='etrn'){
      if(typeof buildEtrnPrintBody==='function') body=buildEtrnPrintBody(o);
    } else {
      body=buildOrderDocBody(kind.id, o);
    }
    if(body){
      parts.push(`<section class="bundle-section"><h2 style="page-break-before:${parts.length?'always':'auto'};margin:0 0 12px;font-size:16px">${esc(kind.title)}</h2>${body}</section>`);
    }
  });
  return parts.join('\n');
}
function downloadAllAdminOrderDocs(orderId){
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o) return;
  const body=buildAdminOrderDocBundleBody(o);
  if(!body){ alert('Пока нет готовых документов по этой заявке'); return; }
  if(typeof openPrintHtml==='function'){
    openPrintHtml(`Пакет документов · заявка №${o.sequentialNumber||'—'}`, body);
  }
}
function openAdminOrderDocument(orderId, kind){
  if(typeof openCustomerOrderDocument==='function') openCustomerOrderDocument(orderId, kind);
}
function wireCustomerFrameworkContractBanner(customerCo, carrierCo){
  const preview=$('cust-contract-preview');
  const agree=$('cust-contract-agree');
  const signBtn=$('cust-contract-sign');
  if(preview) preview.onclick=()=>openFrameworkContractPrint(customerCo, carrierCo);
  if(agree&&signBtn){
    agree.onchange=()=>{ signBtn.disabled=!agree.checked; };
    signBtn.onclick=()=>{
      if(!agree.checked) return;
      const name=(currentCustomer&&currentCustomer.name)||customerCo.name||'';
      if(signCustomerFrameworkContract(customerCo.id, name)){
        const banner=$('cust-contract-banner');
        if(banner) banner.remove();
        renderCustomerPortal();
      }
    };
  }
}
