/* АРМАДА app: shared domain helpers + boot (phase2 chunk E) */
state.orders.forEach(o=>{
  if(o.customer==null) o.customer="";
  if(o.driverPercent==null) o.driverPercent=driverPercent(o.driverName||DRIVER);
  ensureRoutePoints(o);
});
/** Есть открытая смена водителя — нельзя «тихо» уйти из приложения. */
function upsertShift(){
  if(!state.shift) return;
  stampShiftOwner(state.shift, state.shift.driverName||DRIVER, state.shift.vehiclePlate);
  state.shift.messages=state.messages.slice();
  // Сохраняем шаг создания/закрытия заказа — иначе после входа сбрасывается на idle
  state.shift.orderStep=state.orderStep||'idle';
  state.shift.draft=state.draft?structuredClone(state.draft):{};
  state.shift.uiStep=state.step||'idle';
  const i=state.shifts.findIndex(s=>s.id===state.shift.id);
  if(i>=0) state.shifts[i]=structuredClone(state.shift);
  else state.shifts.unshift(structuredClone(state.shift));
  persist();
}
function uniqAddrs(list){
  const seen=new Set(); const out=[];
  (list||[]).forEach(a=>{ const v=String(a||'').trim(); if(!v) return; const k=v.toLowerCase(); if(seen.has(k)) return; seen.add(k); out.push(v); });
  return out;
}

/** Единый формат: +7XXXXXXXXXX (10 цифр после +7, без пробелов и тире). */
function formatPhone(raw){
  let d=String(raw??'').replace(/\D/g,'');
  if(!d) return '';
  if(d.length===11 && d[0]==='8') d='7'+d.slice(1);
  if(d.length===10) d='7'+d;
  if(d.length===11 && d[0]==='7') return '+'+d;
  // уже международный иной длины — оставляем + и цифры
  if(d.length>11 && d[0]==='7') return '+'+d.slice(0,11);
  if(d.length>=10) return '+7'+d.slice(-10);
  return '';
}
function normalizePhone(p){
  if(typeof p==='string'){
    const n=formatPhone(p); return n?{id:uuid(),number:n,label:''}:null;
  }
  if(!p||typeof p!=='object') return null;
  const number=formatPhone(p.number||p.phone||''); if(!number) return null;
  return {id:p.id||uuid(), number, label:String(p.label||'').trim()};
}
function normalizeContact(c){
  if(!c||typeof c!=='object') return null;
  const name=String(c.name||'').trim(); if(!name) return null;
  const phones=(Array.isArray(c.phones)?c.phones:[]).map(normalizePhone).filter(Boolean);
  if(c.phone && !phones.length){ const one=normalizePhone(c.phone); if(one) phones.push(one); }
  return {id:c.id||uuid(), name, title:String(c.title||'').trim(), phones, isPrimary:!!c.isPrimary};
}
function normalizeCarrierVehicle(v){
  if(!v||typeof v!=='object') return null;
  const plate=String(v.plate||'').trim(); if(!plate) return null;
  const num=x=>{ const n=+(String(x??'').replace(',','.')); return (n>0)?n:null; };
  return {
    id:v.id||uuid(), plate,
    makeModel:String(v.makeModel||v.model||'').trim(),
    payloadTons:num(v.payloadTons),
    bodyLengthM:num(v.bodyLengthM), bodyWidthM:num(v.bodyWidthM), bodyHeightM:num(v.bodyHeightM)
  };
}
function normalizeCarrierDriver(d){
  if(!d||typeof d!=='object') return null;
  const name=String(d.name||'').trim(); if(!name) return null;
  return {
    id:d.id||uuid(), name, phone:formatPhone(d.phone||''), licenseNo:String(d.licenseNo||'').trim(),
    passportSeries:String(d.passportSeries||'').trim(), passportNumber:String(d.passportNumber||'').trim(),
    passportIssuedBy:String(d.passportIssuedBy||'').trim(), passportIssuedAt:String(d.passportIssuedAt||'').trim(),
    licenseIssuedAt:String(d.licenseIssuedAt||'').trim(),
    vehicleId:d.vehicleId||null
  };
}
function normalizeDriverRecord(d){
  if(!d||typeof d!=='object') return d;
  return Object.assign(d, {
    phone:formatPhone(d.phone||''),
    licenseNo:String(d.licenseNo||'').trim(),
    passportSeries:String(d.passportSeries||'').trim(),
    passportNumber:String(d.passportNumber||'').trim(),
    passportIssuedBy:String(d.passportIssuedBy||'').trim(),
    passportIssuedAt:String(d.passportIssuedAt||'').trim(),
    licenseIssuedAt:String(d.licenseIssuedAt||'').trim(),
    passportPhoto:docPhotoOrNull(d.passportPhoto),
    passportRegPhoto:docPhotoOrNull(d.passportRegPhoto),
    licensePhotoFront:docPhotoOrNull(d.licensePhotoFront),
    licensePhotoBack:docPhotoOrNull(d.licensePhotoBack),
    id:d.id||uuid(),
    vehicleId:d.vehicleId||null
  });
}
function formatPassportText(src){
  if(!src) return '';
  const s=String(src.passportSeries||src.driverPassportSeries||'').trim();
  const n=String(src.passportNumber||src.driverPassportNumber||'').trim();
  if(!s&&!n) return '';
  return [s,n].filter(Boolean).join(' ');
}
function formatPassportIssuedText(src){
  if(!src) return '';
  const by=String(src.passportIssuedBy||src.driverPassportIssuedBy||'').trim();
  const at=String(src.passportIssuedAt||src.driverPassportIssuedAt||'').trim();
  return [by, at?('выдан '+at):''].filter(Boolean).join(', ');
}
function fleetVehicleForOrder(o){
  if(!o) return null;
  const plate=String(o.vehiclePlate||'').trim();
  if(!plate||plate==='—') return null;
  const firmId=o.executorType==='partner'?(o.carrierCompanyId||o.ownCompanyId):o.ownCompanyId;
  return (state.vehicles||[]).find(v=>v.plate===plate && (!firmId||v.companyId===firmId))
    ||(state.vehicles||[]).find(v=>v.plate===plate)||null;
}
const DOC_PHOTO_MAX_KB=200;
function docPhotoOrNull(v){
  const s=v!=null?String(v):'';
  return s.startsWith('data:image/')?s:null;
}
function docPhotoThumbHtml(src, label){
  if(!docPhotoOrNull(src)) return '';
  const cap=label?esc(label):'Документ';
  return `<a href="${esc(src)}" target="_blank" rel="noopener" class="doc-photo-thumb" title="${cap}"><img src="${esc(src)}" alt="${cap}" loading="lazy" /></a>`;
}
function docPhotoUploadRow(label, existing, inputAttrs, clearAttrs){
  return `<label class="doc-photo-row"><span>${esc(label)}</span>
    <div class="doc-photo-row__box">
      ${docPhotoThumbHtml(existing, label)}
      <input type="file" accept="image/png,image/jpeg,image/webp" ${inputAttrs||''} />
      ${existing?`<button type="button" class="secondary doc-photo-clear" ${clearAttrs||''} title="Удалить">×</button>`:''}
    </div>
  </label>`;
}
function bindDocPhotoInput(input, onLoad){
  if(!input||typeof onLoad!=='function') return;
  input.onchange=()=>{
    const file=input.files&&input.files[0];
    if(!file) return;
    if(file.size>DOC_PHOTO_MAX_KB*1024){ alert(`Снимок до ${DOC_PHOTO_MAX_KB} КБ`); input.value=''; return; }
    const reader=new FileReader();
    reader.onload=()=>onLoad(String(reader.result||''));
    reader.readAsDataURL(file);
  };
}
function driverDocPhotoGalleryHtml(d, opts){
  if(!d) return '';
  opts=opts||{};
  const items=[
    ['passportPhoto','Паспорт'],
    ['passportRegPhoto','Прописка'],
    ['licensePhotoFront','ВУ лицо'],
    ['licensePhotoBack','ВУ оборот']
  ].map(([k,lbl])=>docPhotoThumbHtml(d[k], lbl)).filter(Boolean);
  if(!items.length) return opts.emptyHint?`<div class="hint">${esc(opts.emptyHint)}</div>`:'';
  return `<div class="doc-photo-gallery">${items.join('')}</div>`;
}
function shouldCheckDriverDocs(driverName){
  const drv=String(driverName||'').trim();
  if(!drv||drv==='—'||drv==='Биржа'||drv==='Диспетчер') return false;
  if(typeof waitingLogistDriver==='function'&&waitingLogistDriver(drv)) return false;
  return true;
}
function driverDocsMissingItems(rec){
  if(!rec) return ['нет карточки водителя в справочнике'];
  const miss=[];
  if(!String(rec.passportSeries||'').trim()||!String(rec.passportNumber||'').trim()) miss.push('паспорт: серия и номер');
  if(!String(rec.passportIssuedBy||'').trim()) miss.push('паспорт: кем выдан');
  if(!String(rec.passportIssuedAt||'').trim()) miss.push('паспорт: дата выдачи');
  if(!String(rec.licenseNo||'').trim()) miss.push('номер водительского удостоверения');
  if(!String(rec.licenseIssuedAt||'').trim()) miss.push('ВУ: дата выдачи');
  if(!formatPhone(rec.phone||'')) miss.push('телефон');
  if(!docPhotoOrNull(rec.passportPhoto)) miss.push('снимок паспорта (разворот)');
  if(!docPhotoOrNull(rec.passportRegPhoto)) miss.push('снимок прописки');
  if(!docPhotoOrNull(rec.licensePhotoFront)) miss.push('снимок ВУ (лицевая)');
  if(!docPhotoOrNull(rec.licensePhotoBack)) miss.push('снимок ВУ (оборот)');
  return miss;
}
function driverDocsComplete(rec){
  return driverDocsMissingItems(rec).length===0;
}
function driverDocsWarnBoxHtml(rec, driverName){
  const miss=driverDocsMissingItems(rec);
  if(!miss.length) return '';
  const who=String(driverName||(rec&&rec.name)||'водитель').trim();
  return `<div class="drv-docs-warn claim-box">
    <p class="drv-docs-warn__title">Документы водителя неполные</p>
    <p class="hint" style="margin:0 0 6px">${esc(who)} — заполните в <strong>Справочники → водители → Паспорт и ВУ</strong>:</p>
    <ul class="drv-docs-warn__list">${miss.map(m=>`<li>${esc(m)}</li>`).join('')}</ul>
    <p class="hint" style="margin:8px 0 0">Без этого в заявку, документы и заказчику уйдут неполные данные.</p>
  </div>`;
}
function confirmIfDriverDocsIncomplete(rec, driverName){
  if(driverDocsComplete(rec)) return true;
  const who=String(driverName||(rec&&rec.name)||'водитель').trim();
  const miss=driverDocsMissingItems(rec);
  const lines=miss.map(m=>'• '+m).join('\n');
  return confirm(`У «${who}» не заполнены документы:\n${lines}\n\nЗаполните в Справочниках → водители.\n\nВсё равно назначить?`);
}
function refreshDriverDocsWarnBox(el, driverName, firmId){
  if(!el) return;
  if(!shouldCheckDriverDocs(driverName)){
    el.innerHTML='';
    el.hidden=true;
    return;
  }
  const rec=typeof findDriverRecord==='function'?findDriverRecord(driverName, firmId):null;
  const html=driverDocsWarnBoxHtml(rec, driverName);
  el.innerHTML=html;
  el.hidden=!html;
}
function canEditDriverRecord(d){
  if(!d||!currentAdmin) return false;
  if(typeof isSuperAdmin==='function'&&isSuperAdmin()) return true;
  const myCo=typeof currentOwnCompany==='function'?currentOwnCompany():null;
  return d.ownerAdminId===currentAdmin.id || (myCo&&d.companyId===myCo.id);
}
/** Привести все телефоны в базе к +7XXXXXXXXXX. */
function normalizeAllPhones(){
  let changed=false;
  const fix=v=>{
    const f=formatPhone(v);
    if(!v && !f) return v||'';
    if(f && f!==v){ changed=true; return f; }
    return v||'';
  };
  (state.drivers||[]).forEach(d=>{
    const next=fix(d.phone);
    if(next!==(d.phone||'')) d.phone=next;
  });
  (state.companies||[]).forEach(c=>{
    (c.phones||[]).forEach(p=>{ if(p && p.number!=null){ const n=fix(p.number); if(n!==p.number) p.number=n; } });
    (c.contacts||[]).forEach(ct=>{
      (ct.phones||[]).forEach(p=>{ if(p && p.number!=null){ const n=fix(p.number); if(n!==p.number) p.number=n; } });
      if(ct.phone){ const n=fix(ct.phone); if(n!==ct.phone){ ct.phone=n; changed=true; } }
    });
    (c.drivers||[]).forEach(d=>{
      const n=fix(d.phone); if(n!==(d.phone||'')) d.phone=n;
    });
  });
  (state.orders||[]).forEach(o=>{
  if(o.contactPhone!=null){ const n=fix(o.contactPhone); if(n!==o.contactPhone){ o.contactPhone=n; changed=true; } }
    if(o.loadingContactPhone!=null){ const n=fix(o.loadingContactPhone); if(n!==o.loadingContactPhone){ o.loadingContactPhone=n; changed=true; } }
    if(o.unloadingContactPhone!=null){ const n=fix(o.unloadingContactPhone); if(n!==o.unloadingContactPhone){ o.unloadingContactPhone=n; changed=true; } }
    if(o.driverPhone!=null){ const n=fix(o.driverPhone); if(n!==o.driverPhone){ o.driverPhone=n; changed=true; } }
    if(o.transportApp && o.transportApp.driverPhone!=null){
      const n=fix(o.transportApp.driverPhone);
      if(n!==o.transportApp.driverPhone){ o.transportApp.driverPhone=n; changed=true; }
    }
  });
  return changed;
}
function normalizeCompanyBank(b){
  const raw=b||{};
  return {
    bankName:String(raw.bankName||'').trim(),
    bankBik:String(raw.bankBik||'').replace(/\D/g,'').trim(),
    bankAccount:String(raw.bankAccount||'').replace(/\D/g,'').trim(),
    bankCorrAccount:String(raw.bankCorrAccount||'').replace(/\D/g,'').trim()
  };
}
function normalizeCompany(c){
  if(!c||typeof c!=='object') return null;
  const name=String(c.name||'').trim(); if(!name) return null;
  let roles=Array.isArray(c.roles)?c.roles.slice():[];
  if(!roles.length){
    if(c.role==='carrier') roles=['carrier'];
    else if(c.isCarrier) roles=['carrier'];
    else roles=['customer'];
  }
  roles=roles.filter(r=>r==='customer'||r==='carrier'||r==='own');
  if(!roles.length) roles=['customer'];
  const phones=(Array.isArray(c.phones)?c.phones:[]).map(normalizePhone).filter(Boolean);
  const contacts=(Array.isArray(c.contacts)?c.contacts:[]).map(normalizeContact).filter(Boolean);
  const vehicles=(Array.isArray(c.vehicles)?c.vehicles:[]).map(normalizeCarrierVehicle).filter(Boolean);
  const drivers=(Array.isArray(c.drivers)?c.drivers:[]).map(normalizeCarrierDriver).filter(Boolean);
  const out={
    id:c.id||uuid(), name, roles, note:String(c.note||'').trim(),
    phones, contacts,
    loadingAddresses:uniqAddrs(c.loadingAddresses||[]),
    unloadingAddresses:uniqAddrs(c.unloadingAddresses||[]),
    vehicles, drivers,
    spaceId:c.spaceId||null,
    inn:String(c.inn||'').trim(),
    ogrn:String(c.ogrn||'').trim(),
    kpp:String(c.kpp||'').trim(),
    address:String(c.address||'').trim()
  };
  if(c.finance) out.finance=normalizeFinance(c.finance);
  out.logistKind=(c.logistKind==='staff'||c.logistKind==='broker')?c.logistKind:null;
  out.portalEnabled=!!c.portalEnabled;
  out.portalPhone=formatPhone(String(c.portalPhone||'').trim());
  out.portalPin=String(c.portalPin||'').trim();
  out.contractSigned=!!c.contractSigned;
  if(c.frameworkContract && typeof normalizeFrameworkContract==='function'){
    out.frameworkContract=normalizeFrameworkContract(c.frameworkContract);
  } else if(out.contractSigned){
    out.frameworkContract={status:'signed', signedAt:null, signedBy:''};
  }
  out.vatPayer=(c.vatPayer==='vat')?'vat':'none';
  const bank=normalizeCompanyBank(c);
  if(bank.bankName||bank.bankBik||bank.bankAccount||bank.bankCorrAccount) out.bank=bank;
  return out;
}
/** Перевозчик на ОСН с НДС или без (УСН и т.п.) */
function companyVatPayer(co){
  return co&&co.vatPayer==='vat'?'vat':'none';
}
function companyVatPayerLabel(co){
  return companyVatPayer(co)==='vat'?'с НДС':'без НДС';
}
/** Форма оплаты перевозчику для заявки заказчика */
function customerCarrierPaymentForm(carrier){
  return companyVatPayer(carrier)==='vat'?'withVat':'withoutVat';
}
/** База перевозчика без ставки логиста (из расчёта заказчика). */
function customerCarrierBaseCash(quote){
  if(!quote||!(quote.minimumCash>0)) return null;
  const feePct=+(quote.logistFeePercent||0);
  if(feePct>0) return round2(quote.minimumCash/(1+feePct/100));
  return quote.minimumCash;
}
/** Ориентир / минимум для заказчика (со ставкой логиста, если «логисту»). */
function customerOrderClientPriceAmount(quote){
  if(!quote) return null;
  return quote.minimumCash;
}
function customerCarrierPriceAmount(quote, carrier){
  const base=customerCarrierBaseCash(quote);
  if(base==null) return null;
  const form=customerCarrierPaymentForm(carrier);
  const t=fillRatesFrom('cash', base);
  if(form==='withVat') return t.withVat;
  if(form==='withoutVat') return t.withoutVat;
  return t.cash;
}
function customerCarrierPriceLabel(carrier){
  return companyVatPayer(carrier)==='vat'?'с НДС':'без НДС';
}
function customerCarrierPriceHint(carrier){
  return companyVatPayer(carrier)==='vat'
    ?'Перевозчик работает с НДС — сумма по счёту перевозчика с НДС.'
    :'Перевозчик работает без НДС — НДС перевозчику не передаётся.';
}
/** «Наша фирма» кабинета перевозчика для тарифа заказчика */
function companyLogistKind(co){
  if(!co) return 'broker';
  if(co.logistKind==='staff'||co.logistKind==='broker') return co.logistKind;
  const n=typeof fleetVehiclesForCompany==='function'?fleetVehiclesForCompany(co.id).length:0;
  return n>0?'staff':'broker';
}
/** Диспетчер = тот же логист; включает кнопку «Биржа» (тариф Бизнес). */
function isDispatcherCompany(co){ return companyLogistKind(co)==='broker'; }
function isStaffLogistCompany(co){ return !isDispatcherCompany(co); }
function isBrokerDispatcherCompany(co){ return isDispatcherCompany(co); }
function currentLogistKind(){ return companyLogistKind(typeof currentOwnCompany==='function'?currentOwnCompany():null); }
function companyHasOwnPark(co){
  const firm=co || (typeof currentOwnCompany==='function'?currentOwnCompany():null);
  if(!firm||!firm.id) return false;
  const n=typeof fleetVehiclesForCompany==='function'?fleetVehiclesForCompany(firm.id).length:((firm.vehicles||[]).length||0);
  return n>0;
}
function carrierOwnCompanyForSpace(spaceId){
  if(spaceId){
    const hit=(state.companies||[]).find(c=>c.spaceId===spaceId && companyHasRole(c,'own'));
    if(hit) return hit;
  }
  return ownCompaniesList()[0]||null;
}
/** Минимальная и рекомендуемая цена заявки заказчика (по тарифу перевозчика) */
function quoteBodyCargoMultiplier(draft, fin){
  const s=normalizeFinance(fin||{});
  let m=1;
  const body=String(draft&&draft.reqBodyType||'');
  const cargo=String(draft&&draft.cargoKind||'');
  if(body==='reefer' || cargo==='food') m*=s.bodyMultReefer||1.25;
  else if(body==='dump' || cargo==='bulk') m*=s.bodyMultDump||1.15;
  if((+draft.reqPayloadTons||0) >= (s.heavyTonsFrom||20)) m*=s.heavyMult||1.15;
  return Math.round(m*1000)/1000;
}
function inferTripMode(km, fin){
  const s=normalizeFinance(fin||{});
  if(!(km>0)) return 'city';
  const suburb=+(s.suburbKmThreshold||30);
  const city=+(s.cityKmThreshold||100);
  if(km>city) return 'intercity';
  if(km>suburb) return 'suburb';
  return 'city';
}
function suggestCustomerOrderPrice(draft){
  if(!draft||!draft.ownCompanyId) return null;
  const fin=financeForCompanyId(draft.ownCompanyId);
  const km=+(draft.routeKm||draft.estimateKm||0);
  const trip=draft.tripMode||inferTripMode(km, fin);
  const mult=quoteBodyCargoMultiplier(draft, fin);
  const perKm=(+fin.defaultRatePerKmCash)||80;
  const perHour=(+fin.defaultRatePerHourWork)||0;
  let base=null;
  let summary='';
  if(trip==='intercity'){
    if(!(km>0) || !(perKm>0)) return null;
    const kmCash=round2(km*perKm);
    const hourFloor=perHour>0?round2(((+fin.minWorkHours||0)+(+fin.podachaHours||0))*perHour):0;
    const raw=Math.max(kmCash, hourFloor);
    base={totalCash:raw, summary:`межгород ${km} км × ${fmt(perKm)} ₽/км`+(hourFloor>kmCash?` (не ниже пакета часов)`:``)};
  } else {
    const cityDraft=Object.assign({}, draft, {
      estimateKm:km>0?km:null,
      emptyKmBefore:0,
      estimateWorkHours:draft.estimateWorkHours||fin.minWorkHours||4
    });
    base=calculateClientTariff(cityDraft, fin);
  }
  if(!base||!(base.totalCash>0)) return null;
  let total=round2(base.totalCash*mult);
  const extras=[];
  if(mult>1.001) extras.push(`надбавка кузов/груз/тоннаж ×${mult}`);
  const feePct=draft.fulfillment==='direct'?0:(+fin.logistFeePercent||0);
  if(feePct>0){
    total=round2(total*(1+feePct/100));
    extras.push(`ставка логиста ${feePct}%`);
  }
  const t=fillRatesFrom('cash', total);
  return {
    minimumCash:total,
    cash:t.cash,
    withoutVat:t.withoutVat,
    withVat:t.withVat,
    summary:[base.summary, extras.join(', ')].filter(Boolean).join(' · '),
    recommendedCash:total,
    tripMode:trip,
    routeKm:km||null,
    multiplier:mult,
    logistFeePercent:feePct
  };
}
function companyHasRole(c, role){ return !!(c&&Array.isArray(c.roles)&&c.roles.includes(role)); }
function companyInMySpace(c){
  if(!c) return false;
  if(isSuperAdmin()) return true;
  const sid=currentSpaceId();
  if(!sid) return !c.spaceId;
  return !c.spaceId || c.spaceId===sid;
}
function companiesByRole(role){ return (state.companies||[]).filter(c=>companyHasRole(c, role) && companyInMySpace(c)); }
function findCompanyById(id){ return (state.companies||[]).find(c=>c.id===id)||null; }
function findCompanyByName(name){
  const key=String(name||'').trim().toLowerCase(); if(!key) return null;
  return (state.companies||[]).find(c=>String(c.name||'').trim().toLowerCase()===key)||null;
}
function findCompanyByInn(inn){
  const key=String(inn||'').replace(/\D/g,'');
  if(!key) return null;
  return (state.companies||[]).find(c=>String(c.inn||'').replace(/\D/g,'')===key)||null;
}
function findCustomer(name){
  // совместимость: заказчик = компания с ролью customer (или любая по имени)
  const c=findCompanyByName(name);
  if(c) return c;
  const key=String(name||'').trim().toLowerCase(); if(!key) return null;
  return state.customers.find(x=>String(x.name||'').trim().toLowerCase()===key)||null;
}
function upsertCompany(raw){
  const c=normalizeCompany(raw); if(!c) return null;
  const innKey=String(c.inn||'').replace(/\D/g,'');
  const i=(state.companies||[]).findIndex(x=>{
    if(x.id===c.id) return true;
    if(innKey && String(x.inn||'').replace(/\D/g,'')===innKey) return true;
    return String(x.name).toLowerCase()===c.name.toLowerCase();
  });
  if(i>=0){
    // merge addresses/contacts lightly
    const prev=state.companies[i];
    c.loadingAddresses=uniqAddrs([...(c.loadingAddresses||[]),...(prev.loadingAddresses||[])]);
    c.unloadingAddresses=uniqAddrs([...(c.unloadingAddresses||[]),...(prev.unloadingAddresses||[])]);
    if(!c.contacts.length && prev.contacts) c.contacts=prev.contacts;
    if(!c.phones.length && prev.phones) c.phones=prev.phones;
    if(!c.vehicles.length && prev.vehicles) c.vehicles=prev.vehicles;
    if(!c.drivers.length && prev.drivers) c.drivers=prev.drivers;
    if(!c.roles.includes('customer') && companyHasRole(prev,'customer')) c.roles.push('customer');
    if(!c.roles.includes('carrier') && companyHasRole(prev,'carrier')) c.roles.push('carrier');
    if(!c.roles.includes('own') && companyHasRole(prev,'own')) c.roles.push('own');
    c.id=prev.id;
    c.spaceId=c.spaceId||prev.spaceId||null;
    c.inn=c.inn||prev.inn||'';
    c.ogrn=c.ogrn||prev.ogrn||'';
    c.kpp=c.kpp||prev.kpp||'';
    c.address=c.address||prev.address||'';
    if(!c.finance && prev.finance) c.finance=normalizeFinance(prev.finance);
    if(!c.bank && prev.bank) c.bank=normalizeCompanyBank(prev.bank);
    if(!('logistKind' in (raw||{})) && prev.logistKind) c.logistKind=prev.logistKind;
    if(!('portalEnabled' in raw)){
      c.portalEnabled=!!prev.portalEnabled;
      c.portalPhone=prev.portalPhone||'';
      c.portalPin=prev.portalPin||'';
    }
    if(!('contractSigned' in (raw||{})) && prev.contractSigned) c.contractSigned=!!prev.contractSigned;
    if(!('frameworkContract' in (raw||{})) && prev.frameworkContract) c.frameworkContract=prev.frameworkContract;
    state.companies[i]=c;
  } else {
    if(companyHasRole(c,'own') && !c.finance) c.finance=normalizeFinance(state.finance);
    state.companies.push(c);
  }
  state.companies.sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru'));
  syncCustomersFromCompanies();
  return c;
}
function syncCustomersFromCompanies(){
  // legacy mirror for old UI bits
  state.customers=companiesByRole('customer').map(c=>({
    name:c.name,
    loadingAddresses:c.loadingAddresses||[],
    unloadingAddresses:c.unloadingAddresses||[]
  }));
}
function rememberCustomer(order){
  const name=String(order.customer||'').trim(); if(!name) return;
  const innKey=String(order.customerInn||'').replace(/\D/g,'');
  let c=innKey?findCompanyByInn(innKey):null;
  if(!c) c=findCompanyByName(name);
  if(!c){
    c=upsertCompany({name, inn:innKey, roles:['customer'], loadingAddresses:[], unloadingAddresses:[], contacts:[], phones:[]});
  } else if(!companyHasRole(c,'customer')){
    c.roles.push('customer'); upsertCompany(c);
  }
  if(innKey && !c.inn) c.inn=innKey;
  ensureRoutePoints(order);
  (order.routePoints||[]).forEach(p=>{
    const addr=String(p.address||'').trim(); if(!addr) return;
    if(p.kind==='unloading') c.unloadingAddresses.unshift(addr);
    else c.loadingAddresses.unshift(addr);
  });
  if(order.loadingAddress) c.loadingAddresses.unshift(order.loadingAddress);
  if(order.unloadingAddress) c.unloadingAddresses.unshift(order.unloadingAddress);
  c.loadingAddresses=uniqAddrs(c.loadingAddresses);
  c.unloadingAddresses=uniqAddrs(c.unloadingAddresses);
  // contact from order
  if(order.contactName || order.contactPhone){
    const cname=String(order.contactName||'Контакт').trim();
    let person=(c.contacts||[]).find(x=>x.name.toLowerCase()===cname.toLowerCase());
    if(!person){
      person={id:uuid(), name:cname, title:'', phones:[], isPrimary:!(c.contacts||[]).length};
      c.contacts.push(person);
    }
    if(order.contactPhone){
      const ph=formatPhone(order.contactPhone);
      if(ph && !(person.phones||[]).some(x=>formatPhone(x.number)===ph)) person.phones.push({id:uuid(), number:ph, label:''});
    }
    order.contactPersonId=person.id;
    order.customerId=c.id;
  }
  upsertCompany(c);
}

/** —— Админы: логины, журнал, онлайн (просмотр — только супер админ) —— */
function normalizeAdmin(a){
  if(!a||typeof a!=='object') return null;
  const name=String(a.name||'').trim(); if(!name) return null;
  const pin=String(a.pin||'').trim();
  if(!pin) return null;
  const out={id:a.id||uuid(), name, pin, isSuper:!!a.isSuper, spaceId:a.spaceId||null};
  if(a.mustChangePin) out.mustChangePin=true;
  return out;
}
function migrateAdmins(){
  state.admins=(state.admins||[]).map(normalizeAdmin).filter(Boolean);
  // Вычистить удалённые тестовые учётки (Диспетчер и т.п.)
  state.admins=state.admins.filter(a=>{
    const nm=(a.name||'').trim().toLowerCase();
    return !RETIRED_ADMIN_IDS.has(a.id) && !RETIRED_ADMIN_NAMES.has(nm);
  });
  // Сид только если админов ещё нет — фиксированный recovery PIN (не случайный: иначе пользователь не узнает код).
  if(!state.admins.length){
    if(!state.settings||typeof state.settings!=='object') state.settings={};
    delete state.settings.superPinChangedByUser;
    state.admins=[{
      id:'admin-super', name:'Наволоцкий Е.Н.', pin:SUPER_ADMIN_RECOVERY_PIN, isSuper:true, mustChangePin:true
    }];
    state.settings.superPinRecoveryNotice=superPinRecoveryNoticeText();
  }
  state.admins.forEach(a=>{
    if(a.id==='admin-super' || (a.isSuper && (a.name||'').toLowerCase()==='супер админ')){
      a.name='Наволоцкий Е.Н.';
      if(a.id==='admin-super' || !a.id) a.id='admin-super';
      a.isSuper=true;
    }
    const pin=String(a.pin||'').trim();
    if(WEAK_ADMIN_PINS.has(pin)) a.mustChangePin=true;
  });
  if(!state.admins.some(a=>a.isSuper)){
    const first=state.admins[0];
    if(first) first.isSuper=true;
    else state.admins.push({id:'admin-super', name:'Наволоцкий Е.Н.', pin:SUPER_ADMIN_RECOVERY_PIN, isSuper:true, mustChangePin:true});
  }
  state.adminLogins=Array.isArray(state.adminLogins)?state.adminLogins:[];
  state.adminPresence=Array.isArray(state.adminPresence)?state.adminPresence:[];
  if(typeof consumeRecoverSuperFromUrl==='function' && consumeRecoverSuperFromUrl()){
    forceSuperAdminPinRecovery('recover-url');
    if(typeof markRecoverSuperConsumed==='function') markRecoverSuperConsumed();
  } else {
    if(typeof stripRecoverParamFromUrl==='function') stripRecoverParamFromUrl();
    ensureSuperAdminPinRecovery();
  }
}
const RECOVER_SUPER_SESSION_KEY='armada_recover_super_v1';
function readRecoverSuperFromUrl(){
  try{
    const q=new URLSearchParams(location.search||'');
    const v=String(q.get('recover')||q.get('reset')||'').trim().toLowerCase();
    return v==='super' || v==='admin';
  }catch(_){ return false; }
}
function stripRecoverParamFromUrl(){
  try{
    const u=new URL(location.href);
    if(!u.searchParams.has('recover') && !u.searchParams.has('reset')) return;
    u.searchParams.delete('recover');
    u.searchParams.delete('reset');
    const next=u.pathname+(u.search||'')+u.hash;
    history.replaceState(history.state,'',next);
  }catch(_){}
}
function consumeRecoverSuperFromUrl(){
  if(!readRecoverSuperFromUrl()) return false;
  try{
    if(sessionStorage.getItem(RECOVER_SUPER_SESSION_KEY)==='1') return false;
  }catch(_){}
  return true;
}
function markRecoverSuperConsumed(){
  try{ sessionStorage.setItem(RECOVER_SUPER_SESSION_KEY,'1'); }catch(_){}
  stripRecoverParamFromUrl();
}
function superPinRecoveryNoticeText(){
  return 'Временный PIN супер-админа: '+SUPER_ADMIN_RECOVERY_PIN+' — смените в «Активность» после входа.';
}
function forceSuperAdminPinRecovery(reason){
  if(!state.settings||typeof state.settings!=='object') state.settings={};
  delete state.settings.superPinChangedByUser;
  let superA=(state.admins||[]).find(a=>a.id==='admin-super'||(a.isSuper&&(a.name||'').includes('Наволоцкий')));
  if(!superA){
    superA={id:'admin-super', name:'Наволоцкий Е.Н.', pin:SUPER_ADMIN_RECOVERY_PIN, isSuper:true, mustChangePin:true};
    state.admins=(state.admins||[]).concat([superA]);
  }else{
    superA.id='admin-super';
    superA.name='Наволоцкий Е.Н.';
    superA.isSuper=true;
    superA.pin=SUPER_ADMIN_RECOVERY_PIN;
    superA.mustChangePin=true;
  }
  state.settings.superPinRecoveryNotice=superPinRecoveryNoticeText();
  if(typeof bumpDataEpoch==='function') bumpDataEpoch(reason||'super-recover');
  if(typeof persistLocalOnly==='function') persistLocalOnly();
}
function isRecoveryOrWeakAdminPin(pin){
  const p=String(pin||'').trim();
  if(!p) return true;
  if(typeof SUPER_ADMIN_RECOVERY_PIN!=='undefined' && p===SUPER_ADMIN_RECOVERY_PIN) return true;
  if(typeof WEAK_ADMIN_PINS!=='undefined' && WEAK_ADMIN_PINS.has(p)) return true;
  return false;
}
function markSuperPinChangedByUser(){
  if(!state.settings||typeof state.settings!=='object') state.settings={};
  state.settings.superPinChangedByUser=true;
  delete state.settings.superPinRecoveryNotice;
}
/** Восстановление PIN супер-админа до явной смены в Активность (после compliance-миграции). */
function ensureSuperAdminPinRecovery(){
  if(!state.settings||typeof state.settings!=='object') state.settings={};
  let superA=(state.admins||[]).find(a=>a.id==='admin-super'||(a.isSuper&&(a.name||'').includes('Наволоцкий')));
  if(!superA){
    if(state.settings.superPinChangedByUser) return;
    superA={id:'admin-super', name:'Наволоцкий Е.Н.', pin:SUPER_ADMIN_RECOVERY_PIN, isSuper:true, mustChangePin:true};
    state.admins=(state.admins||[]).concat([superA]);
    state.settings.superPinRecoveryNotice=superPinRecoveryNoticeText();
    return;
  }
  superA.id='admin-super';
  superA.name='Наволоцкий Е.Н.';
  superA.isSuper=true;
  const pin=String(superA.pin||'').trim();
  if(pin && !isRecoveryOrWeakAdminPin(pin)){
    markSuperPinChangedByUser();
    delete superA.mustChangePin;
    return;
  }
  if(state.settings.superPinChangedByUser) return;
  if(!pin){
    superA.pin=SUPER_ADMIN_RECOVERY_PIN;
    superA.mustChangePin=true;
    state.settings.superPinRecoveryNotice=superPinRecoveryNoticeText();
    return;
  }
  if(isRecoveryOrWeakAdminPin(pin)){
    superA.mustChangePin=true;
    state.settings.superPinRecoveryNotice=superPinRecoveryNoticeText();
  }
}
function mergeAdminAuthFromRemote(p, opts){
  const remoteWinsAuth=!!(opts&&opts.remoteWinsAuth);
  const remoteAdmins=(Array.isArray(p.admins)?p.admins:[]).map(normalizeAdmin).filter(Boolean)
    .filter(a=>!RETIRED_ADMIN_IDS.has(a.id) && !RETIRED_ADMIN_NAMES.has((a.name||'').trim().toLowerCase()));
  if(remoteAdmins.length){
    const localById=new Map((state.admins||[]).filter(a=>a&&a.id).map(a=>[a.id,a]));
    const merged=remoteAdmins.map(r=>{
      const loc=localById.get(r.id);
      if(!loc) return r;
      const locPin=String(loc.pin||'').trim();
      const remPin=String(r.pin||'').trim();
      // На другом устройстве в localStorage мог остаться старый PIN — при загрузке с сервера берём серверный.
      if(!remoteWinsAuth && locPin && locPin!==remPin && !isRecoveryOrWeakAdminPin(locPin)){
        const out={...r, pin:locPin};
        if(loc.mustChangePin) out.mustChangePin=true;
        else delete out.mustChangePin;
        return out;
      }
      return r;
    });
    localById.forEach((loc,id)=>{
      if(!merged.some(a=>a.id===id)) merged.push(loc);
    });
    state.admins=merged;
  }
  const byId=new Map();
  (state.adminLogins||[]).forEach(e=>{ if(e&&e.id) byId.set(e.id,e); });
  (Array.isArray(p.adminLogins)?p.adminLogins:[]).forEach(e=>{
    if(!e||!e.id) return;
    const prev=byId.get(e.id);
    if(!prev || Date.parse(e.at||0)>=Date.parse(prev.at||0)) byId.set(e.id,e);
  });
  state.adminLogins=[...byId.values()].sort((a,b)=>Date.parse(b.at||0)-Date.parse(a.at||0)).slice(0,120);
  const byDev=new Map();
  (state.adminPresence||[]).forEach(e=>{ if(e&&e.deviceId) byDev.set(e.deviceId,e); });
  (Array.isArray(p.adminPresence)?p.adminPresence:[]).forEach(e=>{
    if(!e||!e.deviceId) return;
    const prev=byDev.get(e.deviceId);
    if(!prev || Date.parse(e.lastSeen||0)>=Date.parse(prev.lastSeen||0)) byDev.set(e.deviceId,e);
  });
  // не затираем своё свежее присутствие
  const my=byDev.get(adminDeviceId());
  if(currentAdmin && my && Date.parse(my.lastSeen||0)<Date.now()-5000){
    byDev.set(adminDeviceId(), {
      deviceId:adminDeviceId(), adminId:currentAdmin.id, adminName:currentAdmin.name,
      isSuper:!!currentAdmin.isSuper, lastSeen:new Date().toISOString(), screen:my.screen||'admin'
    });
  }
  state.adminPresence=[...byDev.values()];
  ensureSuperAdminPinRecovery();
}
function isSuperAdmin(){ return !!(currentAdmin&&currentAdmin.isSuper); }
function driversOwnedByAdminId(adminId){
  if(!adminId) return [];
  return (state.drivers||[]).filter(d=>d.ownerAdminId===adminId);
}
function driverNamesOwnedByAdminId(adminId){
  return new Set(driversOwnedByAdminId(adminId).map(d=>(d.name||'').trim()).filter(Boolean));
}
/** Заказ в зоне админа: владелец / фирма / пространство. Имя водителя — только для старых заявок без штампа. */
function orderBelongsToAdmin(o, adminId){
  if(!o || !adminId) return false;
  if(o.ownerAdminId===adminId) return true;
  const adm=(state.admins||[]).find(a=>a.id===adminId);
  const co=ownCompanyForAdminId(adminId);
  // Водитель из парка этой фирмы + заказ на фирму — виден админу фирмы
  // (даже если ownerAdminId ошибочно чужой из‑за старого бага входа)
  if(co && o.ownCompanyId===co.id && o.driverName){
    const mine=fleetDriversForCompany(co.id).some(d=>samePersonName(d.name, o.driverName));
    if(mine) return true;
  }
  // Своё пространство, если водитель наш или owner не чужой
  if(adm && adm.spaceId && o.spaceId===adm.spaceId){
    if(!o.ownerAdminId || o.ownerAdminId===adminId) return true;
    if(co && o.driverName && fleetDriversForCompany(co.id).some(d=>samePersonName(d.name, o.driverName))) return true;
  }
  // Чужой явный владелец и не наш водитель — не показываем
  if(o.ownerAdminId && o.ownerAdminId!==adminId) return false;
  if(co && o.ownCompanyId && o.ownCompanyId===co.id){
    if(!o.spaceId || (adm && o.spaceId===adm.spaceId)) return true;
    return false;
  }
  if(o.spaceId || o.ownCompanyId) return false;
  const nm=(o.driverName||'').trim();
  if(!nm || nm==='—' || nm==='-' || nm==='Биржа' || nm.startsWith('[Перевозчик]')) return false;
  if(co) return fleetDriversForCompany(co.id).some(d=>samePersonName(d.name, nm));
  return driverNamesOwnedByAdminId(adminId).has(nm);
}
function isMyFirmOrder(o){
  if(!o || !currentAdmin) return false;
  return orderBelongsToAdmin(o, currentAdmin.id);
}
/**
 * Привязка заказа, созданного водителем: фирма авто смены → домашний профиль водителя
 * (админ с тем же ФИО) → первая запись с ownerAdminId.
 * Видят: супер-админ + админ этой фирмы.
 */
function resolveDriverOrderBinding(driverName, vehiclePlate){
  const plate=String(vehiclePlate||'').trim();
  const nm=String(driverName||'').trim();
  let companyId=null, companyName=null, spaceId=null, ownerAdminId=null, ownerAdminName=null;
  // Активная фирма сессии водителя — главный источник (не путать с копией ФИО в другой фирме)
  if(typeof DRIVER_COMPANY_ID!=='undefined' && DRIVER_COMPANY_ID && typeof DRIVER!=='undefined' && samePersonName(DRIVER, nm)){
    companyId=DRIVER_COMPANY_ID;
    const co=findCompanyById(companyId);
    if(co){ companyName=co.name; spaceId=co.spaceId||null; }
    const rec=findDriverRecord(nm, companyId);
    if(rec){
      spaceId=rec.spaceId||spaceId;
      ownerAdminId=rec.ownerAdminId||null;
      ownerAdminName=rec.ownerAdminName||null;
      companyName=rec.companyName||companyName;
    }
  }
  const veh=plate?(state.vehicles||[]).find(v=>v.plate===plate && (!companyId || v.companyId===companyId))
    || (state.vehicles||[]).find(v=>v.plate===plate):null;
  if(veh){
    if(!companyId){
      companyId=veh.companyId||null;
      companyName=veh.companyName||companyName;
      spaceId=veh.spaceId||spaceId;
    } else if(veh.companyId===companyId){
      spaceId=spaceId||veh.spaceId||null;
    }
  }
  const homeProfiles=(state.drivers||[]).filter(d=>samePersonName(d.name, nm));
  // Домашняя запись: водитель = админ с тем же ФИО (в выбранной фирме)
  let drv=null;
  if(companyId) drv=homeProfiles.find(d=>d.companyId===companyId)||null;
  if(!drv){
    drv=homeProfiles.find(d=>{
      const adm=(state.admins||[]).find(a=>a.id===d.ownerAdminId);
      return adm && samePersonName(adm.name, nm);
    }) || null;
  }
  if(!drv) drv=homeProfiles.find(d=>d.ownerAdminId && d.spaceId) || homeProfiles[0] || null;
  if(drv){
    if(!companyId && drv.companyId){ companyId=drv.companyId; companyName=drv.companyName||companyName; }
    if(!spaceId && drv.spaceId) spaceId=drv.spaceId;
    if(!ownerAdminId){ ownerAdminId=drv.ownerAdminId||null; ownerAdminName=drv.ownerAdminName||null; }
  }
  if(companyId && !companyName){
    const co=findCompanyById(companyId);
    if(co) companyName=co.name;
  }
  if(companyId && !spaceId){
    const co=findCompanyById(companyId);
    if(co && co.spaceId) spaceId=co.spaceId;
  }
  if(spaceId && !ownerAdminId){
    const adm=(state.admins||[]).find(a=>a.spaceId===spaceId);
    if(adm){ ownerAdminId=adm.id; ownerAdminName=adm.name; }
  }
  if(!ownerAdminId && nm){
    const adm=(state.admins||[]).find(a=>samePersonName(a.name, nm));
    if(adm){
      ownerAdminId=adm.id; ownerAdminName=adm.name;
      if(!spaceId) spaceId=adm.spaceId||null;
      if(!companyId){
        const co=ownCompanyForAdminId(adm.id);
        if(co){ companyId=co.id; companyName=co.name; if(!spaceId) spaceId=co.spaceId||adm.spaceId||null; }
      }
    }
  }
  return {
    ownerAdminId, ownerAdminName, spaceId,
    ownCompanyId:companyId||null, ownCompanyName:companyName||null
  };
}
/** Проставить/починить владельца у заказов, созданных водителем. */
function migrateDriverOrderOwners(){
  let changed=false;
  (state.orders||[]).forEach(o=>{
    if(!o || o.source!=='driver') return;
    if(o.ownerAdminId && o.spaceId && o.ownCompanyId) return;
    const bind=resolveDriverOrderBinding(o.driverName||DRIVER, o.vehiclePlate);
    if(!o.ownerAdminId && bind.ownerAdminId){ o.ownerAdminId=bind.ownerAdminId; o.ownerAdminName=bind.ownerAdminName; changed=true; }
    if(!o.spaceId && bind.spaceId){ o.spaceId=bind.spaceId; changed=true; }
    if(!o.ownCompanyId && bind.ownCompanyId){ o.ownCompanyId=bind.ownCompanyId; o.ownCompanyName=bind.ownCompanyName; changed=true; }
    if(!o.executorType){ o.executorType='own'; changed=true; }
  });
  return changed;
}
function isPartnerOnOrder(o){
  if(!o || !currentAdmin) return false;
  const myCo=currentOwnCompany();
  const app=o.transportApp;
  if(app && myCo && (app.carrierCompanyId===myCo.id || app.customerCompanyId===myCo.id)) return true;
  if(o.partnerSpaceId && o.partnerSpaceId===currentSpaceId()) return true;
  if(o.executorAdminId && o.executorAdminId===currentAdmin.id) return true;
  return false;
}
/** Доступ: супер — любой; биржа — всем админам; иначе только свои (owner/space фирмы) / партнёр. */
function canAdminSeeOrder(o){
  if(!o || !currentAdmin) return false;
  if(isSuperAdmin()) return true;
  if(o.onExchange && !o.closedAt && o.startOdometer==null) return true;
  if(isPartnerOnOrder(o)) return true;
  // Обычный админ — только заказы своей зоны, не «чужой owner с чужим space»
  return orderBelongsToAdmin(o, currentAdmin.id);
}
function numOrNull(raw){
  const n=+String(raw??'').replace(',','.');
  return (n>0 && !Number.isNaN(n))?n:null;
}
function vehicleSpecText(v){
  if(!v) return '';
  const bits=[];
  if(v.payloadTons>0) bits.push(v.payloadTons+'т');
  if([v.bodyLengthM,v.bodyWidthM,v.bodyHeightM].every(x=>x>0))
    bits.push(`${v.bodyLengthM}×${v.bodyWidthM}×${v.bodyHeightM}м`);
  return bits.join(' · ');
}
function orderTempRangeText(o){
  if(!o) return null;
  const fmt=v=>{
    const n=+v;
    if(!Number.isFinite(n)) return '';
    return (n>0?'+':'')+n;
  };
  const from=o.cargoTempFromC;
  const to=o.cargoTempToC;
  if(from!=null || to!=null){
    const f=from!=null?fmt(from):'';
    const t=to!=null?fmt(to):'';
    if(f&&t) return f+'…'+t+'°C';
    if(f) return f+'°C';
    if(t) return 'до '+t+'°C';
  }
  if(o.cargoTempC!=null && o.cargoTempC!=='') return o.cargoTempC+'°C';
  return null;
}
function orderReqText(o){
  if(!o) return '';
  const bits=[];
  if(o.tripMode) bits.push(tripModeLabel(o.tripMode));
  if(o.reqBodyType) bits.push(bodyTypeLabel(o.reqBodyType)||o.reqBodyType);
  if(Array.isArray(o.vehicleTypeIds)&&o.vehicleTypeIds.length){
    bits.push(o.vehicleTypeIds.map(id=>typeof custVehicleTypeLabel==='function'?custVehicleTypeLabel(id):id).join(', '));
  }
  if(Array.isArray(o.loadingMethods)&&o.loadingMethods.length){
    bits.push('загр.: '+o.loadingMethods.map(id=>typeof custLoadMethodLabel==='function'?custLoadMethodLabel(id):id).join(', '));
  }
  if(Array.isArray(o.unloadingMethods)&&o.unloadingMethods.length){
    bits.push('выгр.: '+o.unloadingMethods.map(id=>typeof custUnloadMethodLabel==='function'?custUnloadMethodLabel(id):id).join(', '));
  }
  if(o.cargoKind) bits.push(cargoKindLabel(o.cargoKind)||o.cargoKind);
  if(o.cargoDescription) bits.push(o.cargoDescription);
  if(o.cargoPlaces>0) bits.push(o.cargoPlaces+' мест');
  if(o.cargoVolumeM3>0) bits.push(o.cargoVolumeM3+' м³');
  if(o.cargoPackaging && typeof custPackagingLabel==='function') bits.push(custPackagingLabel(o.cargoPackaging));
  if(o.cargoFragile) bits.push('хрупкий');
  const tempBit=orderTempRangeText(o);
  if(tempBit) bits.push(tempBit);
  if(o.reqPayloadTons>0) bits.push('от '+o.reqPayloadTons+'т');
  if(o.routeKm>0) bits.push('~'+o.routeKm+' км');
  if([o.reqLengthM,o.reqWidthM,o.reqHeightM].every(x=>x>0))
    bits.push(`кузов ≥ ${o.reqLengthM}×${o.reqWidthM}×${o.reqHeightM}м`);
  else {
    if(o.reqLengthM>0) bits.push('Д≥'+o.reqLengthM+'м');
    if(o.reqWidthM>0) bits.push('Ш≥'+o.reqWidthM+'м');
    if(o.reqHeightM>0) bits.push('В≥'+o.reqHeightM+'м');
  }
  return bits.join(' · ');
}
/** ТС подходит, если каждое указанное требование закрыто его характеристикой. */
function vehicleFitsOrder(v, o){
  if(!v || !o) return false;
  const pairs=[['reqPayloadTons','payloadTons'],['reqLengthM','bodyLengthM'],['reqWidthM','bodyWidthM'],['reqHeightM','bodyHeightM']];
  let anyReq=false;
  for(const [req,field] of pairs){
    const need=+o[req];
    if(!(need>0)) continue;
    anyReq=true;
    const have=+v[field];
    if(!(have>0) || have+1e-9<need) return false;
  }
  if(!anyReq) return true;
  return true;
}
function readOrderRequirementsFromCreate(){
  return {
    reqPayloadTons:numOrNull(($('create-req-pay')||{}).value),
    reqLengthM:numOrNull(($('create-req-l')||{}).value),
    reqWidthM:numOrNull(($('create-req-w')||{}).value),
    reqHeightM:numOrNull(($('create-req-h')||{}).value)
  };
}
/** Пространство фирмы заказа: spaceId, иначе через компанию или админа. */
function orderSpaceId(o){
  if(!o) return null;
  if(o.spaceId) return o.spaceId;
  if(o.ownCompanyId){
    const co=findCompanyById(o.ownCompanyId);
    if(co && co.spaceId) return co.spaceId;
  }
  if(o.ownerAdminId){
    const adm=(state.admins||[]).find(a=>a.id===o.ownerAdminId);
    if(adm && adm.spaceId) return adm.spaceId;
  }
  return null;
}
/** Фильтр супер-админа по пространству фирмы. */
function matchesOwnerFilter(o){
  if(!isSuperAdmin()) return true;
  const f=state.adminOwnerFilter||'all';
  if(f==='all') return true;
  const sid=orderSpaceId(o);
  if(f==='_none') return !sid;
  return sid===f;
}
/** Парк конкретной «нашей фирмы» — то, что уходит в заявку. */
function fleetDriversForCompany(companyId){
  if(!companyId) return [];
  return (state.drivers||[]).filter(d=>d.companyId===companyId);
}
function fleetVehiclesForCompany(companyId){
  if(!companyId) return [];
  return (state.vehicles||[]).filter(v=>v.companyId===companyId);
}
function fleetDriversAssignedToVehicle(v){
  if(!v) return [];
  const ids=new Set((v.assignedDriverIds||[]).map(String));
  if(!ids.size) return [];
  return fleetDriversForCompany(v.companyId).filter(d=>d.id&&ids.has(String(d.id)));
}
function vehicleForDriver(d){
  if(!d) return null;
  if(d.vehicleId){
    const hit=fleetVehicleById(d.vehicleId);
    if(hit) return hit;
  }
  const did=d.id?String(d.id):'';
  if(!did||!d.companyId) return null;
  return (state.vehicles||[]).find(v=>v.companyId===d.companyId
    && (v.assignedDriverIds||[]).map(String).includes(did))||null;
}
function vehicleCrewSummary(v){
  if(!v) return '';
  const drv=fleetDriversAssignedToVehicle(v);
  if(!drv.length) return '';
  const names=drv.map(d=>d.name).join(', ');
  if(v.crewName) return `${v.crewName}: ${names}`;
  if(drv.length===1) return names;
  return `Экипаж: ${names}`;
}
function setVehicleCrew(v, driverIds, crewName){
  if(!v||!v.id) return;
  const ids=(driverIds||[]).map(String).filter(Boolean);
  v.assignedDriverIds=ids;
  v.crewName=String(crewName||'').trim();
  fleetDriversForCompany(v.companyId).forEach(d=>{
    if(!d.id) d.id=uuid();
    if(ids.includes(String(d.id))) d.vehicleId=v.id;
    else if(d.vehicleId===v.id) d.vehicleId=null;
  });
}
function primaryDriverForVehicle(v){
  return fleetDriversAssignedToVehicle(v)[0]||null;
}
function migrateFleetCrewLinks(){
  (state.vehicles||[]).forEach(v=>{
    if(!v||!v.id) return;
    const ids=new Set((v.assignedDriverIds||[]).map(String));
    (state.drivers||[]).forEach(d=>{
      if(!d||d.companyId!==v.companyId||d.vehicleId!==v.id) return;
      if(!d.id) d.id=uuid();
      ids.add(String(d.id));
    });
    if(ids.size) v.assignedDriverIds=[...ids];
  });
}
function vehicleBusyAt(plate, atIso, exceptOrderId){
  const want=String(plate||'').trim();
  if(!want) return false;
  const at=atIso?Date.parse(atIso):Date.now();
  const placeholder=n=>!n || n==='—' || n==='-' || n==='Биржа' || n==='Диспетчер';
  return (state.orders||[]).some(o=>{
    if(!o || o.cancelledAt || looksClosedOrder(o)) return false;
    if(exceptOrderId && o.id===exceptOrderId) return false;
    const used=String(o.vehiclePlate||'').trim();
    const booked=String(o.bookedPlate||'').trim();
    const usedHit=!placeholder(used) && used===want;
    const bookedHit=booked===want && o.bookStatus!=='rejected';
    if(!usedHit && !bookedHit) return false;
    if(o.startOdometer!=null) return true;
    const start=Date.parse(o.vehicleAt||o.createdAt||0);
    const free=Date.parse(o.freeAt||0);
    if(Number.isFinite(free) && Number.isFinite(at) && at<free) return true;
    if(Number.isFinite(start) && Number.isFinite(at) && Math.abs(at-start)<3*3600*1000) return true;
    return false;
  });
}
function availableFleetForCustomer(companyId, reqs, atIso){
  return fleetVehiclesForCompany(companyId).filter(v=>{
    if(reqs && (reqs.reqPayloadTons>0 || reqs.reqLengthM>0) && !vehicleFitsOrder(v, reqs)) return false;
    return !vehicleBusyAt(v.plate, atIso);
  });
}
function freeOwnFleetForOrder(o, exceptOrderId){
  if(!o) return [];
  const firmId=o.ownCompanyId || ((typeof currentOwnCompany==='function' && currentOwnCompany())||{}).id;
  if(!firmId) return [];
  return fleetVehiclesForCompany(firmId).filter(v=>{
    if(!vehicleFitsOrder(v, o)) return false;
    return !vehicleBusyAt(v.plate, o.vehicleAt, exceptOrderId||o.id);
  });
}
function myCatalogDrivers(){
  if(isSuperAdmin()) return state.drivers||[];
  if(!currentAdmin) return [];
  const co=currentOwnCompany();
  if(co) return fleetDriversForCompany(co.id);
  const sid=currentSpaceId();
  if(sid) return (state.drivers||[]).filter(d=>d.spaceId===sid || d.ownerAdminId===currentAdmin.id);
  return driversOwnedByAdminId(currentAdmin.id);
}
function myCatalogVehicles(){
  if(isSuperAdmin()) return state.vehicles||[];
  const co=currentOwnCompany();
  if(co) return fleetVehiclesForCompany(co.id);
  const sid=currentSpaceId();
  if(!sid) return state.vehicles||[];
  return (state.vehicles||[]).filter(v=>!v.spaceId || v.spaceId===sid);
}
function adminOwnerOptionsHtml(selectedId){
  const list=(state.admins||[]).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru'));
  const sel=selectedId|| (currentAdmin&&currentAdmin.id) || (list[0]&&list[0].id) || '';
  return list.map(a=>`<option value="${esc(a.id)}" ${a.id===sel?'selected':''}>${esc(a.name)}</option>`).join('');
}
function resolveAdminOwner(adminId){
  const adm=(state.admins||[]).find(a=>a.id===adminId);
  if(adm){
    const co=ownCompanyForAdminId(adm.id);
    return {
      ownerAdminId:adm.id, ownerAdminName:adm.name, spaceId:adm.spaceId||null,
      companyId:co?co.id:null, companyName:co?co.name:null
    };
  }
  if(currentAdmin){
    const co=currentOwnCompany();
    return {
      ownerAdminId:currentAdmin.id, ownerAdminName:currentAdmin.name, spaceId:currentAdmin.spaceId||null,
      companyId:co?co.id:null, companyName:co?co.name:null
    };
  }
  return {ownerAdminId:null, ownerAdminName:null, spaceId:null, companyId:null, companyName:null};
}
function migrateCompanies(){
  // customers → companies
  (state.customers||[]).forEach(c=>{
    if(!findCompanyByName(c.name)){
      upsertCompany({
        name:c.name, roles:['customer'],
        loadingAddresses:c.loadingAddresses||[], unloadingAddresses:c.unloadingAddresses||[],
        contacts:c.contacts||[], phones:c.phones||[]
      });
    }
  });
  state.companies=(state.companies||[]).map(normalizeCompany).filter(Boolean);
  // drivers / vehicles: seed missing defaults (Нечаев А.С., В 603 СА 47, …)
  state.drivers=(state.drivers||[]).map(d=>normalizeDriverRecord({
    id:d.id||uuid(),
    name:d.name,
    salaryPercent:d.salaryPercent??30,
    exchangeEnabled:!!d.exchangeEnabled,
    phone:String(d.phone||'').trim(),
    licenseNo:String(d.licenseNo||'').trim(),
    passportSeries:String(d.passportSeries||'').trim(),
    passportNumber:String(d.passportNumber||'').trim(),
    passportIssuedBy:String(d.passportIssuedBy||'').trim(),
    passportIssuedAt:String(d.passportIssuedAt||'').trim(),
    licenseIssuedAt:String(d.licenseIssuedAt||'').trim(),
    passportPhoto:docPhotoOrNull(d.passportPhoto),
    passportRegPhoto:docPhotoOrNull(d.passportRegPhoto),
    licensePhotoFront:docPhotoOrNull(d.licensePhotoFront),
    licensePhotoBack:docPhotoOrNull(d.licensePhotoBack),
    id:d.id||uuid(),
    vehicleId:d.vehicleId||null,
    ownerAdminId:d.ownerAdminId||null,
    ownerAdminName:d.ownerAdminName||null,
    spaceId:d.spaceId||null,
    companyId:d.companyId||null,
    companyName:d.companyName||null
  }));
  // Глобальный список по ФИО больше не сидим — у каждой фирмы свой парк (ensureFleetPerSpaces).
  if(!state.drivers.length && !(state.spaces||[]).length){
    state.drivers=DEFAULT_DRIVERS.map(d=>({...d}));
  }
  state.vehicles=(state.vehicles||[]).map(v=>normalizeFleetVehicle(v)).filter(v=>v&&v.plate);
  migrateFleetCrewLinks();
  if(!state.vehicles.length && !(state.spaces||[]).length){
    state.vehicles=DEFAULT_VEHICLES.map(v=>({...v}));
  }
  // подтянуть габариты/тоннаж для известных номеров, если пусто
  const normPlate=p=>String(p||'').toLowerCase().replace(/\s+/g,'');
  DEFAULT_VEHICLES.forEach(def=>{
    const hit=(state.vehicles||[]).find(v=>normPlate(v.plate)===normPlate(def.plate));
    if(!hit) return;
    if(!(hit.payloadTons>0) && def.payloadTons) hit.payloadTons=def.payloadTons;
    if(!(hit.bodyLengthM>0) && def.bodyLengthM) hit.bodyLengthM=def.bodyLengthM;
    if(!(hit.bodyWidthM>0) && def.bodyWidthM) hit.bodyWidthM=def.bodyWidthM;
    if(!(hit.bodyHeightM>0) && def.bodyHeightM) hit.bodyHeightM=def.bodyHeightM;
  });
  // наши фирмы (ООО «Армада», ИП Нечаев А.С.)
  DEFAULT_OWN_COMPANIES.forEach(def=>{
    const existing=findCompanyByName(def.name);
    if(!existing){
      upsertCompany({...def, contacts:[], phones:[], loadingAddresses:[], unloadingAddresses:[], vehicles:[], drivers:[]});
    } else if(!companyHasRole(existing,'own')){
      existing.roles.push('own');
      upsertCompany(existing);
    }
  });
  syncCustomersFromCompanies();
  // if still empty companies, mine from orders
  if(!state.companies.length){
    state.orders.forEach(rememberCustomer);
  }
}
function customerNames(){ return companiesByRole('customer').map(c=>c.name); }
function carrierNames(){ return companiesByRole('carrier').map(c=>c.name); }
function primaryContact(company){
  if(!company||!(company.contacts||[]).length) return null;
  return company.contacts.find(c=>c.isPrimary) || company.contacts[0];
}
function contactPhone(contact){
  if(!contact) return '';
  const p=(contact.phones||[])[0];
  return formatPhone(p?p.number:(contact.phone||''));
}
function driverExchangeEnabled(name){
  const d=state.drivers.find(x=>x.name===name);
  return !!(d&&d.exchangeEnabled);
}
function exchangeOrders(){
  return (state.orders||[]).filter(o=>!o.closedAt && o.onExchange && o.startOdometer==null);
}
function exchangeEnabledDrivers(){
  return (state.drivers||[]).filter(d=>d.exchangeEnabled);
}
function orderContactLine(o){
  // Админ: компания + контакт
  const parts=[];
  if(o.customer) parts.push(o.customer);
  if(o.contactName) parts.push(o.contactName);
  const ph=formatPhone(o.contactPhone||'');
  if(ph) parts.push(ph);
  return parts.join(' · ')||'—';
}
/** Водителю название заказчика не показываем никогда */
function driverContactLine(o){
  if(!driverMaySeeContact(o)) return '';
  const parts=[];
  if(o.contactName) parts.push(o.contactName);
  const ph=formatPhone(o.contactPhone||'');
  if(ph) parts.push(ph);
  return parts.join(' · ');
}
/** Контакт — только после выезда/взятия в работу; на бирже и до «Выехал» — скрыт. Компанию не показываем. */
function driverMaySeeContact(o){
  if(!o || o.onExchange) return false;
  if(o.driverName!==DRIVER) return false;
  return o.departOdometer!=null || o.startOdometer!=null || !!o.closedAt;
}
function formatRuDateTimeAt(iso){
  if(!iso) return '';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime())) return '';
  const dd=String(d.getDate()).padStart(2,'0');
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const yyyy=d.getFullYear();
  const hh=String(d.getHours()).padStart(2,'0');
  const mi=String(d.getMinutes()).padStart(2,'0');
  return `${dd}.${mm}.${yyyy} к ${hh}:${mi}`;
}
function toDatetimeLocalValue(iso){
  if(!iso) return '';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime())) return '';
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromDatetimeLocalValue(v){
  const s=String(v||'').trim();
  if(!s) return null;
  const d=new Date(s);
  if(Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
/** Дата ДД.ММ.ГГГГ (слэши тоже) + время ЧЧ:ММ → ISO. */
function parseRuDate(s){
  const t=String(s||'').trim();
  const m=t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if(!m) return null;
  const day=+m[1], month=+m[2], year=+m[3];
  if(month<1||month>12||day<1||day>31) return null;
  const d=new Date(year, month-1, day);
  if(d.getFullYear()!==year||d.getMonth()!==month-1||d.getDate()!==day) return null;
  return d;
}
function formatRuDateInput(v){
  const d=parseRuDate(v);
  if(!d) return String(v||'').trim().replace(/\//g,'.');
  const pad=n=>String(n).padStart(2,'0');
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
}
function maskRuDateInput(raw){
  const v=String(raw||'').replace(/\D/g,'').slice(0,8);
  if(v.length<=2) return v;
  if(v.length<=4) return `${v.slice(0,2)}.${v.slice(2)}`;
  return `${v.slice(0,2)}.${v.slice(2,4)}.${v.slice(4)}`;
}
function toRuDateValue(iso){
  if(!iso) return '';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime())) return '';
  const pad=n=>String(n).padStart(2,'0');
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()}`;
}
function toTimeHmValue(iso){
  if(!iso) return '';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime())) return '';
  const pad=n=>String(n).padStart(2,'0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatTimeHmInput(v){
  const t=String(v||'').trim();
  const m=t.match(/^(\d{1,2}):?(\d{2})$/);
  if(!m) return t;
  const h=+m[1], mi=+m[2];
  if(h<0||h>23||mi<0||mi>59) return t;
  return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}`;
}
function maskTimeHmInput(raw){
  const v=String(raw||'').replace(/\D/g,'').slice(0,4);
  if(v.length<=2) return v;
  return `${v.slice(0,2)}:${v.slice(2)}`;
}
function fromRuDateTimeParts(dateStr, timeStr){
  const d=parseRuDate(dateStr);
  if(!d) return null;
  const tm=String(timeStr||'').trim().match(/^(\d{1,2}):(\d{2})$/);
  if(!tm) return null;
  const h=+tm[1], mi=+tm[2];
  if(h<0||h>23||mi<0||mi>59) return null;
  d.setHours(h, mi, 0, 0);
  return d.toISOString();
}
function readVehicleAtFromDom(prefix){
  const dateEl=$(`${prefix}-vehicle-date`);
  const timeEl=$(`${prefix}-vehicle-time`);
  if(dateEl||timeEl){
    return fromRuDateTimeParts((dateEl||{}).value, (timeEl||{}).value);
  }
  const legacy=$(`${prefix}-vehicle-at`);
  if(legacy) return fromDatetimeLocalValue(legacy.value);
  return null;
}
function wireVehicleAtHint(prefix, onChange){
  const upd=()=>{ if(onChange) onChange(); else if(prefix==='create') updateCreateFreeHint(); };
  const dateEl=$(`${prefix}-vehicle-date`);
  const timeEl=$(`${prefix}-vehicle-time`);
  if(dateEl){
    dateEl.setAttribute('lang','ru');
    dateEl.oninput=()=>{ dateEl.value=maskRuDateInput(dateEl.value); upd(); };
    dateEl.onblur=()=>{ const f=formatRuDateInput(dateEl.value); if(f) dateEl.value=f; upd(); };
  }
  if(timeEl){
    timeEl.setAttribute('lang','ru');
    if(timeEl.type==='time') timeEl.type='text';
    timeEl.oninput=()=>{ timeEl.value=maskTimeHmInput(timeEl.value); upd(); };
    timeEl.onblur=()=>{ const f=formatTimeHmInput(timeEl.value); if(f) timeEl.value=f; upd(); };
  }
}
/** Освобождение = подача + max(мин. часы работы, ориентир/факт часов). Час подачи в сумму не входит. */
function computeFreeAt(vehicleAt, order, fin){
  if(!vehicleAt) return null;
  const d=new Date(vehicleAt);
  if(Number.isNaN(d.getTime())) return null;
  const s=Object.assign({}, DEFAULT_FINANCE, fin||state.finance||{});
  const minW=Math.max(0, +(s.minWorkHours||4));
  const entered=order&&(order.workHours??order.estimateWorkHours);
  const hours=(entered!=null && +entered>0)?Math.max(minW, +entered):minW;
  return new Date(d.getTime()+hours*3600*1000).toISOString();
}
function applyOrderSchedule(order){
  if(!order) return order;
  if(order.vehicleAt){
    order.freeAt=computeFreeAt(order.vehicleAt, order, financeForOrder(order));
  } else {
    order.freeAt=null;
  }
  return order;
}
function orderScheduleLines(o, forDriver){
  if(!o||!o.vehicleAt) return '';
  const free=o.freeAt||computeFreeAt(o.vehicleAt, o, financeForOrder(o));
  let html=`<p style="margin-top:6px"><strong>Подача ТС:</strong> ${esc(formatRuDateTimeAt(o.vehicleAt))}</p>`;
  if(free) html+=`<p><strong>Ориентир освобождения:</strong> ${esc(formatRuDateTimeAt(free))}</p>`;
  return html;
}
function updateCreateFreeHint(){
  const el=$('create-free-hint'); if(!el) return;
  const at=readVehicleAtFromDom('create');
  if(!at){ el.textContent='Ориентир освобождения: укажите подачу ТС'; return; }
  const ownId=(($('create-own-company')||{}).value)|| (currentOwnCompany()||{}).id;
  const fin=financeForCompanyId(ownId);
  const draft={estimateWorkHours:null, ownCompanyId:ownId||null};
  const free=computeFreeAt(at, draft, fin);
  const minW=fin.minWorkHours??4;
  el.textContent=`Ориентир освобождения: ${formatRuDateTimeAt(free)} (подача + ${minW} ч работы)`;
}
migrateCompanies();
migrateAdmins();
migrateDriverOwners();
function fillCustomerPickers(){
  $('create-customer')&&($('create-customer').oninput=()=>{
    const name=($('create-customer').value||'').trim();
    const co=findCompanyByName(name);
    if(co && co.inn && $('create-customer-inn')) $('create-customer-inn').value=co.inn;
    fillAddressPickers(name); fillContactPickers(name);
  });
}
async function applyCustomerFromInn(inn, statusEl, prefix='create'){
  const st=statusEl||$(`${prefix}-customer-inn-status`);
  const clean=String(inn||'').replace(/\D/g,'');
  if(!clean){ if(st) st.textContent='Введите ИНН'; return null; }
  if(st) st.textContent='Загрузка…';
  const nameEl=$(`${prefix}-customer`);
  const innEl=$(`${prefix}-customer-inn`);
  try{
    const existing=findCompanyByInn(clean);
    if(existing){
      if(nameEl) nameEl.value=existing.name;
      if(innEl) innEl.value=existing.inn||clean;
      if(prefix==='create'){
        fillAddressPickers(existing.name);
        fillContactPickers(existing.name);
      }
      if(st) st.textContent='Из справочника: '+existing.name;
      return existing;
    }
    const party=await lookupPartyByInn(clean);
    if(nameEl) nameEl.value=party.name||'';
    if(innEl) innEl.value=party.inn||clean;
    const co=upsertCompany({
      name:party.name, inn:party.inn, ogrn:party.ogrn, kpp:party.kpp, address:party.address,
      roles:['customer'], spaceId:currentSpaceId(),
      contacts:party.director?[{id:uuid(), name:party.director, title:'', phones:[], isPrimary:true}]:[]
    });
    if(co){
      if(prefix==='create'){
        fillAddressPickers(co.name);
        fillContactPickers(co.name);
      }
      bumpDataEpoch('customer-inn-lookup');
      persist();
    }
    if(st) st.textContent=(party.name||'Компания')+' — данные загружены';
    return co;
  }catch(err){
    if(st) st.textContent=err.message||String(err);
    return null;
  }
}
function wireCreateCustomerInn(){
  const btn=$('create-customer-inn-lookup');
  if(btn) btn.onclick=()=>applyCustomerFromInn((($('create-customer-inn')||{}).value||'').trim());
}
function fillContactPickers(name){
  const c=findCompanyByName(name);
  const nameEl=$('create-contact-name');
  const phoneEl=$('create-contact-phone');
  if(!nameEl && !phoneEl) return;
  const prim=primaryContact(c);
  if(prim){
    if(nameEl && !nameEl.value) nameEl.value=prim.name||'';
    if(phoneEl && !phoneEl.value) phoneEl.value=contactPhone(prim);
  }
}
function fillAddressPickers(name){
  const c=findCustomer(name)||{loadingAddresses:[],unloadingAddresses:[]};
  const loadEl=$('create-load');
  const unloadEl=$('create-unload');
  if(loadEl && !loadEl.value.trim() && (c.loadingAddresses||[])[0]) loadEl.value=c.loadingAddresses[0];
  if(unloadEl && !unloadEl.value.trim() && (c.unloadingAddresses||[])[0]) unloadEl.value=c.unloadingAddresses[0];
}
function fillExecutorUI(){
  const co=typeof currentOwnCompany==='function'?currentOwnCompany():null;
  const dispatcher=typeof isDispatcherCompany==='function' && isDispatcherCompany(co);
  const hasPark=typeof companyHasOwnPark==='function' && companyHasOwnPark(co);
  const sel=$('create-exec-mode');
  if(sel){
    const ownOpt=sel.querySelector('option[value="own"]');
    if(ownOpt) ownOpt.disabled=!hasPark;
    if(!hasPark && (sel.value==='own'||!sel.value)) sel.value=dispatcher?'exchange':'carrier';
    if(!dispatcher && sel.value==='exchange') sel.value=hasPark?'own':'carrier';
  }
  const mode=(($('create-exec-mode')||{}).value)|| (hasPark?'own':(dispatcher?'exchange':'carrier'));
  const ownBox=$('create-own-box');
  const carrierPeople=$('create-carrier-people');
  const exchangeHint=$('create-exchange-hint');
  const execHint=$('create-exec-hint');
  const sw=$('create-exec-switch');
  if(sw){
    sw.querySelectorAll('[data-exec]').forEach(b=>{
      const hide=(b.dataset.exec==='own' && !hasPark) || (b.dataset.exec==='exchange' && !dispatcher);
      b.hidden=hide;
      b.disabled=hide;
      b.classList.toggle('on', !hide && b.dataset.exec===mode);
      if(!b._wired){
        b._wired=true;
        b.onclick=()=>{
          const s=$('create-exec-mode');
          if(s) s.value=b.dataset.exec;
          fillExecutorUI();
        };
      }
    });
    const visible=sw.querySelectorAll('[data-exec]:not([hidden])').length;
    sw.style.display=visible>1?'flex':'none';
  }
  const carBtn=$('create-exec-carrier');
  const carWrap=$('create-exec-carrier-wrap');
  if(carBtn && !carBtn._wired){
    carBtn._wired=true;
    carBtn.onclick=()=>{
      const s=$('create-exec-mode');
      if(s) s.value='carrier';
      fillExecutorUI();
    };
  }
  if(carBtn) carBtn.classList.toggle('on-link', mode==='carrier');
  if(carWrap) carWrap.style.display='block';
  if(ownBox) ownBox.style.display=(hasPark && mode==='own')?'block':'none';
  if(carrierPeople) carrierPeople.style.display=(mode==='carrier' || !!(($('create-carrier-company')||{}).value))?'block':'none';
  if(exchangeHint){
    exchangeHint.style.display=mode==='exchange'?'block':'none';
    if(mode==='exchange'){
      exchangeHint.textContent=hasPark
        ?'Сначала свой парк. Остаток — на биржу: там вы заказчик перевозки, партнёр везёт. Для грузоотправителя исполнителем остаётесь вы. Маржа — цена заказчику минус цена перевозчику. Биржа — в тарифе «Бизнес».'
        :'Своего парка нет — заявка на биржу. Вы заказчик перевозки, партнёр везёт. Для грузоотправителя исполнителем остаётесь вы. Биржа — в тарифе «Бизнес».';
    }
  }
  if(execHint){
    execHint.textContent=dispatcher
      ?(hasPark?'Парк или биржа: сначала свои машины, остаток партнёрам':'Биржа: партнёр везёт, вы заказчик перевозки')
      :(hasPark?'Свой водитель из парка':'Нет своего парка — включите диспетчера, появится Биржа');
  }
  const saveBtn=$('create-save');
  if(saveBtn){
    saveBtn.textContent=mode==='exchange'?'Выставить на биржу':(mode==='carrier'?'Назначить перевозчику':'Назначить водителю');
  }
  fillCarrierPickers();
}
function fillCarrierPickers(){
  const carriers=companiesByRole('carrier');
  const companySel=$('create-carrier-company');
  if(!companySel) return;
  const cur=companySel.value;
  companySel.innerHTML=`<option value="">— без перевозчика —</option>`+carriers.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  if(cur && carriers.some(c=>c.id===cur)) companySel.value=cur;
  companySel.onchange=()=>{
    const mode=(($('create-exec-mode')||{}).value)||'own';
    const people=$('create-carrier-people');
    if(people) people.style.display=(mode==='carrier' || !!companySel.value)?'block':'none';
    fillCarrierDriverVehicle();
  };
  fillCarrierDriverVehicle();
}
function fillCarrierDriverVehicle(){
  const company=findCompanyById(($('create-carrier-company')||{}).value);
  const drv=$('create-carrier-driver');
  const veh=$('create-carrier-vehicle');
  if(drv){
    const list=(company&&company.drivers)||[];
    drv.innerHTML=`<option value="">— водитель перевозчика —</option>`+list.map(d=>`<option value="${esc(d.id)}">${esc(d.name)}${d.phone?' · '+esc(d.phone):''}</option>`).join('');
  }
  if(veh){
    const list=(company&&company.vehicles)||[];
    veh.innerHTML=`<option value="">— ТС перевозчика —</option>`+list.map(v=>{
      const dims=[v.bodyLengthM,v.bodyWidthM,v.bodyHeightM].every(x=>x>0)?` ${v.bodyLengthM}×${v.bodyWidthM}×${v.bodyHeightM}м`:'';
      const pay=v.payloadTons?` · ${v.payloadTons}т`:'';
      return `<option value="${esc(v.id)}">${esc(v.plate)}${v.makeModel?' · '+esc(v.makeModel):''}${pay}${dims}</option>`;
    }).join('');
  }
}

function timeNow(){ return new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}); }
function dateTime(d){ return new Date(d).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function dayOnly(d){
  if(!d) return '';
  return new Date(d).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'});
}
/** Подпись номера за смену: «за день-3», не «день 3». */
function orderDayLabel(n){ return `за день-${n}`; }
function esc(s){ return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
function add(a,t){ state.messages.push({author:a,text:t,at:new Date().toISOString()}); renderChat(); }
function plates(){
  // Авто фирмы активного водителя
  const coId=DRIVER_COMPANY_ID || resolveDriverOrderBinding(DRIVER,'').ownCompanyId;
  if(coId){
    const list=fleetVehiclesForCompany(coId);
    if(list.length) return list.map(v=>v.plate);
  }
  const mine=myCatalogVehicles();
  if(mine.length) return mine.map(v=>v.plate);
  return (state.vehicles||[]).map(v=>v.plate);
}
function vehicle(plate, companyId){
  const list=state.vehicles||[];
  if(companyId){
    const hit=list.find(v=>v.plate===plate && v.companyId===companyId);
    if(hit) return hit;
  }
  return list.find(v=>v.plate===plate)||{plate,consumptionPer100Km:20};
}
function normalizeWorkItem(w){
  if(w==null) return null;
  if(typeof w==='string'){
    const text=w.trim();
    return text?{text, how:''}:null;
  }
  const text=String(w.text||w.name||'').trim();
  if(!text) return null;
  return {text, how:String(w.how||w.detail||w.desc||'').trim()};
}
function workText(w){ return (normalizeWorkItem(w)||{}).text||''; }
function workHow(w){ return (normalizeWorkItem(w)||{}).how||''; }
function worksEqual(a,b){
  const aa=Array.isArray(a)?a:[], bb=Array.isArray(b)?b:[];
  if(aa.length!==bb.length) return false;
  return aa.every((w,i)=>workText(w)===workText(bb[i]) && workHow(w)===workHow(bb[i]));
}
function workItemHtml(w){
  const text=workText(w);
  if(!text) return '';
  const how=workHow(w);
  return `<li class="svc-work-li"><div>${esc(text)}</div>${how?`<div class="svc-how">${esc(how)}</div>`:''}</li>`;
}
function checklistItemHtml(it, opts){
  const o=opts||{};
  const text=String((it&&it.text)||workText(it)||'').trim();
  if(!text) return '';
  const how=String((it&&it.how)||workHow(it)||'').trim();
  const idAttr=o.checkId!=null?` data-check-item="${esc(o.checkId)}"`:'';
  const idxAttr=o.newIndex!=null?` data-new-check="${o.newIndex}"`:'';
  const done=!!(it&&it.done);
  return `<label class="${done?'done':''}">
    <input type="checkbox"${idAttr}${idxAttr} ${done||o.checked?'checked':''}/>
    <span><span class="svc-check-text">${esc(text)}</span>${how?`<span class="svc-how">${esc(how)}</span>`:''}</span>
  </label>`;
}
function normalizeServiceInterval(iv){
  if(!iv) return null;
  const name=String(iv.name||'').trim();
  if(!name) return null;
  const everyKm=numOrNull(iv.everyKm);
  const everyMonths=numOrNull(iv.everyMonths);
  const works=Array.isArray(iv.works)
    ? iv.works.map(normalizeWorkItem).filter(Boolean)
    : [];
  return {
    id:iv.id||uuid(),
    name,
    everyKm:everyKm>0?everyKm:null,
    everyMonths:everyMonths>0?everyMonths:null,
    lastDate:iv.lastDate||null,
    lastOdometer:numOrNull(iv.lastOdometer),
    note:String(iv.note||'').trim(),
    works
  };
}
function normalizeMaterialLine(m){
  if(!m) return null;
  const name=String(m.name||'').trim();
  if(!name) return null;
  const qty=+(m.qty>0?m.qty:1);
  const unitCost=+(m.unitCost>0?m.unitCost:0);
  const sum=round2(m.sum!=null&&+m.sum>=0?+m.sum:qty*unitCost);
  return {name, qty, unitCost, sum};
}
function normalizeChecklistItem(it){
  if(it==null) return null;
  if(typeof it==='string'){
    const text=it.trim();
    return text?{id:uuid(), text, how:'', done:false}:null;
  }
  const text=String(it.text||it.name||'').trim();
  if(!text) return null;
  return {id:it.id||uuid(), text, how:String(it.how||it.detail||it.desc||'').trim(), done:!!it.done};
}
function checklistFromWorks(works, checkedSet){
  return (Array.isArray(works)?works:[])
    .map((w,i)=>{
      const item=normalizeWorkItem(w);
      if(!item) return null;
      const done=checkedSet?checkedSet.has(i)||checkedSet.has(item.text):false;
      return {id:uuid(), text:item.text, how:item.how, done};
    })
    .filter(Boolean);
}
/** Подтянуть описание «как делать» в уже созданные чек-листы из интервала. */
function enrichChecklistHowFromIntervals(v){
  if(!v) return false;
  let changed=false;
  const byIv=new Map((v.serviceIntervals||[]).map(iv=>{
    const map=new Map();
    (iv.works||[]).forEach(w=>{ const t=workText(w), h=workHow(w); if(t&&h) map.set(t,h); });
    return [iv.id, map];
  }));
  (v.maintenanceLogs||[]).forEach(log=>{
    if(!log||!log.checklist||!log.checklist.length) return;
    const map=log.intervalId?byIv.get(log.intervalId):null;
    const allMaps=[...(byIv.values())];
    log.checklist.forEach(it=>{
      if(!it||!it.text||it.how) return;
      let how=map?map.get(it.text):'';
      if(!how){
        for(const m of allMaps){ if(m.has(it.text)){ how=m.get(it.text); break; } }
      }
      if(how){ it.how=how; changed=true; }
    });
  });
  return changed;
}
function checklistProgress(list){
  const items=Array.isArray(list)?list:[];
  const total=items.length;
  const done=items.filter(x=>x&&x.done).length;
  return {total, done, all:total>0 && done===total, pct:total?Math.round(done*100/total):0};
}
function normalizeMaintenanceLog(log){
  if(!log) return null;
  const title=String(log.title||'').trim();
  if(!title) return null;
  const materials=(Array.isArray(log.materials)?log.materials:[]).map(normalizeMaterialLine).filter(Boolean);
  const materialsCost=round2(materials.reduce((s,m)=>s+(m.sum||0),0) || (+log.materialsCost||0));
  const workCost=round2(+log.workCost||0);
  const checklist=(Array.isArray(log.checklist)?log.checklist:[])
    .map(normalizeChecklistItem).filter(Boolean);
  const prog=checklistProgress(checklist);
  return {
    id:log.id||uuid(),
    date:log.date||new Date().toISOString().slice(0,10),
    odometer:numOrNull(log.odometer),
    kind:['service','repair','parts'].includes(log.kind)?log.kind:'repair',
    title,
    materials,
    materialsCost,
    workCost,
    total:round2(materialsCost+workCost),
    intervalId:log.intervalId||null,
    note:String(log.note||'').trim(),
    checklist,
    checklistDone:prog.all,
    createdAt:log.createdAt||new Date().toISOString()
  };
}
function applyIntervalProgressFromLog(v, log){
  if(!v||!log||!log.intervalId) return;
  const prog=checklistProgress(log.checklist);
  // интервал обновляем, когда чек-лист закрыт или пунктов нет (старое поведение)
  if(log.checklist && log.checklist.length && !prog.all) return;
  const iv=(v.serviceIntervals||[]).find(x=>x.id===log.intervalId);
  if(!iv) return;
  iv.lastDate=log.date;
  if(log.odometer!=null) iv.lastOdometer=log.odometer;
}
function normalizeFleetVehicle(v){
  if(!v) return null;
  const plate=String(v.plate||'').trim();
  if(!plate) return null;
  return {
    id:v.id||uuid(),
    plate,
    consumptionPer100Km:(+v.consumptionPer100Km>0)?+v.consumptionPer100Km:20,
    makeModel:String(v.makeModel||'').trim(),
    payloadTons:numOrNull(v.payloadTons),
    bodyLengthM:numOrNull(v.bodyLengthM),
    bodyWidthM:numOrNull(v.bodyWidthM),
    bodyHeightM:numOrNull(v.bodyHeightM),
    spaceId:v.spaceId||null,
    companyId:v.companyId||null,
    companyName:v.companyName||null,
    currentOdometer:numOrNull(v.currentOdometer),
    stsSeries:String(v.stsSeries||'').trim(),
    stsNumber:String(v.stsNumber||'').trim(),
    stsPhoto:docPhotoOrNull(v.stsPhoto),
    assignedDriverIds:(Array.isArray(v.assignedDriverIds)?v.assignedDriverIds:[]).map(String).filter(Boolean),
    crewName:String(v.crewName||'').trim(),
    serviceIntervals:(Array.isArray(v.serviceIntervals)?v.serviceIntervals:[]).map(normalizeServiceInterval).filter(Boolean),
    maintenanceLogs:(Array.isArray(v.maintenanceLogs)?v.maintenanceLogs:[]).map(normalizeMaintenanceLog).filter(Boolean)
  };
}
function fleetVehicleById(id){
  return (state.vehicles||[]).find(v=>v.id===id)||null;
}
function lastKnownOdometerForPlate(plate, companyId){
  const scored=(state.orders||[])
    .filter(o=>o.vehiclePlate===plate && (!companyId || o.ownCompanyId===companyId) && (o.endOdometer!=null || o.parkingAfterOdo!=null || o.startOdometer!=null))
    .map(o=>({
      odo:o.parkingAfterOdo??o.endOdometer??o.startOdometer,
      t:new Date(o.closedAt||o.endAt||o.createdAt||0).getTime()
    }))
    .filter(x=>x.odo!=null && +x.odo>=0)
    .sort((a,b)=>b.t-a.t);
  return scored.length?+scored[0].odo:null;
}
/** Один и тот же госномер (пробелы/регистр не важны). */
function sameVehiclePlate(a,b){
  const ka=normPlateKey(a), kb=normPlateKey(b);
  return !!(ka && kb && ka===kb);
}
/** Одометр для утреннего ЕТО: стоянка прошлой смены этого водителя на этой машине. */
function previousShiftOdometerForPlate(plate, companyId, driverName){
  if(!plate) return null;
  const shifts=(state.shifts||[])
    .filter(s=>s && s.endedAt && !s.abandoned && sameVehiclePlate(s.vehiclePlate, plate)
      && (!companyId || !s.ownCompanyId || s.ownCompanyId===companyId)
      && (!driverName || (s.driverName && samePersonName(s.driverName, driverName)))
      && (s.parkingOdometer!=null || s.lastOdometerPoint!=null || s.odometer!=null))
    .sort((a,b)=>new Date(b.endedAt)-new Date(a.endedAt));
  if(shifts.length){
    const s=shifts[0];
    const odo=s.parkingOdometer??s.lastOdometerPoint??s.odometer;
    if(odo!=null && +odo>=0) return +odo;
  }
  // Без смены этого водителя на машине — только карточка/заказы (нижняя граница), без «Как вчера»
  return null;
}
/** Подсказка одометра, если нет смены водителя: карточка авто / заказы. */
function fallbackOdometerForPlate(plate, companyId){
  if(!plate) return null;
  const list=state.vehicles||[];
  let v=companyId?list.find(x=>x.plate===plate && x.companyId===companyId):null;
  if(!v) v=list.find(x=>x.plate===plate);
  if(v && v.currentOdometer!=null && +v.currentOdometer>=0) return +v.currentOdometer;
  return lastKnownOdometerForPlate(plate, companyId);
}
/** Записать одометр в карточку авто (не уменьшаем уже большее значение). */
function applyVehicleOdometer(plate, companyId, odo){
  if(!plate || !(+odo>=0)) return false;
  const list=state.vehicles||[];
  let v=companyId?list.find(x=>x.plate===plate && x.companyId===companyId):null;
  if(!v) v=list.find(x=>x.plate===plate);
  if(!v) return false;
  const n=+odo;
  if(v.currentOdometer!=null && +v.currentOdometer>n) return false;
  if(v.currentOdometer!=null && +v.currentOdometer===n) return false;
  v.currentOdometer=n;
  return true;
}
/** После окончания смены — одометр стоянки в карточку этой машины. */
function syncVehicleOdometerFromShift(shift){
  if(!shift || !shift.endedAt || shift.abandoned) return false;
  const plate=shift.vehiclePlate;
  const odo=shift.parkingOdometer??shift.lastOdometerPoint;
  if(odo==null || !plate) return false;
  return applyVehicleOdometer(plate, shift.ownCompanyId||null, +odo);
}
/** Подтянуть одометр из последних закрытых смен в базе (для каждой машины). */
function healVehicleOdometersFromShifts(){
  let changed=false;
  (state.vehicles||[]).forEach(v=>{
    if(!v||!v.plate) return;
    const shifts=(state.shifts||[])
      .filter(s=>s && s.endedAt && !s.abandoned && s.vehiclePlate===v.plate
        && (!v.companyId || !s.ownCompanyId || s.ownCompanyId===v.companyId)
        && (s.parkingOdometer!=null || s.lastOdometerPoint!=null))
      .sort((a,b)=>new Date(b.endedAt)-new Date(a.endedAt));
    if(!shifts.length) return;
    const odo=shifts[0].parkingOdometer??shifts[0].lastOdometerPoint;
    if(applyVehicleOdometer(v.plate, v.companyId, +odo)) changed=true;
  });
  return changed;
}
function normPlateKey(p){ return String(p||'').toLowerCase().replace(/\s+/g,''); }
/** Подставить регламент ТО ГАЗ-33104 для известных Валдаев, если интервалов ещё нет. */
function ensureManufacturerServiceIntervals(){
  let changed=false;
  (state.vehicles||[]).forEach(v=>{
    if(!v||!v.plate) return;
    if(!isGaz33104Valdai(v)) return;
    if(!v.makeModel){ v.makeModel='ГАЗ 33104 Валдай'; changed=true; }
    v.serviceIntervals=v.serviceIntervals||[];
    const byName=new Map(v.serviceIntervals.map(x=>[(x.name||'').toLowerCase(), x]));
    GAZ_33104_SERVICE_INTERVALS.forEach(def=>{
      const key=(def.name||'').toLowerCase();
      const existing=byName.get(key);
      if(!existing){
        const iv=normalizeServiceInterval(Object.assign({id:uuid()}, def));
        if(iv){ v.serviceIntervals.push(iv); changed=true; }
        return;
      }
      if(def.note && existing.note!==def.note && !(existing.works&&existing.works.length>3 && existing.note && existing.note.includes('руководству'))){
        if(!existing.note || /ГАЗ 33104|руководству/.test(existing.note||'')){
          existing.note=def.note;
          changed=true;
        }
      }
      // обновить перечень работ регламента (масла, инструкции «как делать»)
      if(def.works && def.works.length){
        const cur=existing.works||[];
        const same=worksEqual(cur, def.works);
        const missingHow=cur.some(w=>!workHow(w));
        const manufacturerList=!cur.length
          || cur.some(w=>/по таблице смазки/i.test(workText(w)))
          || missingHow
          || /ГАЗ 33104|руководству/.test(existing.note||'')
          || /ГАЗ 33104/.test(existing.name||'');
        if(!same && manufacturerList){
          existing.works=def.works.map(normalizeWorkItem).filter(Boolean);
          changed=true;
        }
      }
    });
  });
  return changed;
}
function addMonthsIso(dateStr, months){
  if(!dateStr || !(months>0)) return null;
  const d=new Date(dateStr+'T12:00:00');
  if(Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth()+months);
  return d.toISOString().slice(0,10);
}
/** Статус интервала: ok | soon | overdue */
function serviceIntervalStatus(v, iv){
  const odo=v.currentOdometer;
  let kmLeft=null, daysLeft=null;
  if(iv.everyKm>0 && iv.lastOdometer!=null && odo!=null){
    kmLeft=(iv.lastOdometer+iv.everyKm)-odo;
  }
  if(iv.everyMonths>0 && iv.lastDate){
    const due=addMonthsIso(iv.lastDate, iv.everyMonths);
    if(due){
      daysLeft=Math.round((new Date(due+'T12:00:00')-new Date())/(24*3600*1000));
    }
  }
  const over=(kmLeft!=null && kmLeft<0) || (daysLeft!=null && daysLeft<0);
  const soon=!over && ((kmLeft!=null && kmLeft<=1000) || (daysLeft!=null && daysLeft<=30));
  let label='нет базы';
  if(iv.lastOdometer==null && !iv.lastDate) label='не обслуживалось';
  else if(over) label='просрочено';
  else if(soon) label='скоро';
  else if(kmLeft!=null || daysLeft!=null) label='норма';
  const bits=[];
  if(kmLeft!=null) bits.push(kmLeft>=0?`ещё ${fmt(kmLeft)} км`:`просрочка ${fmt(-kmLeft)} км`);
  if(daysLeft!=null) bits.push(daysLeft>=0?`ещё ${daysLeft} дн.`:`просрочка ${-daysLeft} дн.`);
  return {level:over?'over':soon?'soon':(label==='норма'?'ok':'soon'), label, detail:bits.join(' · ')};
}
function kindLabel(k){
  if(k==='service') return 'ТО';
  if(k==='parts') return 'Материалы';
  return 'Ремонт';
}
function driverPercent(name, companyId){
  const list=state.drivers||[];
  if(companyId){
    const hit=list.find(d=>samePersonName(d.name,name) && d.companyId===companyId);
    if(hit) return hit.salaryPercent??30;
  }
  return (list.find(d=>samePersonName(d.name,name))||{salaryPercent:30}).salaryPercent;
}
function findDriverRecord(name, companyId){
  const list=state.drivers||[];
  const nm=(name||'').trim();
  if(!nm || nm==='Биржа' || nm==='—' || nm.startsWith('[Перевозчик]')) return null;
  if(companyId){
    const hit=list.find(d=>samePersonName(d.name,nm) && d.companyId===companyId);
    if(hit) return hit;
  }
  return list.find(d=>samePersonName(d.name,nm))||null;
}
function driverPhone(name, companyId){
  const d=findDriverRecord(name, companyId);
  if(d && d.phone) return formatPhone(d.phone);
  // запасной: телефон из контакта «нашей фирмы» с тем же ФИО
  const cos=(state.companies||[]).filter(c=>companyHasRole(c,'own'));
  for(const c of cos){
    if(companyId && c.id!==companyId) continue;
    for(const p of (c.contacts||[])){
      if(samePersonName(p.name, name)){
        const ph=contactPhone(p);
        if(ph) return ph;
      }
    }
  }
  return '';
}
function orderDriverPhone(o){
  if(!o) return '';
  if(o.driverPhone) return formatPhone(o.driverPhone);
  const firmId=o.executorType==='partner'?(o.carrierCompanyId||o.ownCompanyId):o.ownCompanyId;
  return driverPhone(o.driverName, firmId);
}
function stampOrderDriverPhone(o){
  if(!o) return;
  const ph=orderDriverPhone(o);
  if(ph) o.driverPhone=ph;
}
function round2(v){ return Math.round(v*100)/100; }
function fmt(v){ if(v==null||v==='') return '—'; const n=+v; if(Number.isNaN(n)) return String(v); return n===Math.round(n)?String(Math.round(n)):n.toFixed(2); }
function orderBelongsToDriver(o, name){
  const who=name||DRIVER;
  if(!o || !who) return false;
  return samePersonName(o.driverName||'', who);
}
/** Есть признаки закрытия, даже если closedAt снёс sync. */
function looksClosedOrder(o){
  if(!o||o.cancelledAt) return false;
  if(o.closedAt) return true;
  // loadedKm/emptyKmAfter после выгрузки — заказ уже закрывали
  if(o.endOdometer!=null && (o.loadedKm!=null || o.emptyKmAfter!=null)) return true;
  if(o.loadedKm!=null && o.emptyKmAfter!=null && o.startOdometer!=null) return true;
  return false;
}
/** Заказ текущего водителя уже на загрузке / в работе (не чужие!). */
function inProgressOrder(){
  return (state.orders||[]).find(o=>!looksClosedOrder(o) && !o.cancelledAt && o.startOdometer!=null && orderBelongsToDriver(o)) || null;
}
/** Выехал, но ещё не отметил прибытие на загрузку */
function enRouteOrder(){
  return (state.orders||[]).find(o=>!looksClosedOrder(o) && !o.cancelledAt && o.departOdometer!=null && o.startOdometer==null && !o.onExchange && orderBelongsToDriver(o)) || null;
}
/** Есть заказ, который блокирует новый старт (в пути или в работе) */
function hasOpenOrder(){ return !!(inProgressOrder()||enRouteOrder()); }
/** Назначен, ещё не выехал */
function assignedPending(){
  return (state.orders||[]).filter(o=>!looksClosedOrder(o) && !o.cancelledAt && o.startOdometer==null && o.departOdometer==null && !o.onExchange && orderBelongsToDriver(o));
}
function awaitingArrive(){
  return (state.orders||[]).filter(o=>!looksClosedOrder(o) && !o.cancelledAt && o.departOdometer!=null && o.startOdometer==null && !o.onExchange && orderBelongsToDriver(o));
}
function upsertOrder(order){
  if(!order||!order.id) return;
  const i=state.orders.findIndex(o=>o.id===order.id);
  if(i>=0) state.orders[i]=order; else state.orders.unshift(order);
  let linked=false;
  state.shifts.forEach(s=>{
    const j=(s.orders||[]).findIndex(o=>o.id===order.id);
    if(j>=0){ s.orders[j]=order; linked=true; }
  });
  // Не оставляем заказ только в общем списке — привязываем к смене
  if(!linked){
    const host=findShiftForOrder(order);
    if(host){
      host.orders=host.orders||[];
      host.orders.push(order);
    } else if(state.shift && !state.shift.endedAt && state.shift.id){
      if(!state.shift.orders) state.shift.orders=[];
      if(!state.shift.orders.some(o=>o.id===order.id)) state.shift.orders.push(order);
      const si=state.shifts.findIndex(s=>s.id===state.shift.id);
      if(si>=0) state.shifts[si]=state.shift;
    }
  }
  rememberCustomer(order);
  persist();
}
function orderById(id){ return id?(state.orders||[]).find(o=>o.id===id)||null:null; }
/** Заказ, который сейчас закрываем (по id из draft, иначе открытый в работе). */
function orderBeingClosed(){
  const pinned=orderById(state.draft&&state.draft.closingOrderId);
  if(pinned && !pinned.cancelledAt && pinned.startOdometer!=null && !looksClosedOrder(pinned)) return pinned;
  // fallback: самый «свежий» открытый у водителя
  const open=(state.orders||[])
    .filter(o=>!looksClosedOrder(o) && !o.cancelledAt && o.startOdometer!=null && orderBelongsToDriver(o))
    .sort((a,b)=>new Date(b.arrivedAt||b.createdAt||0)-new Date(a.arrivedAt||a.createdAt||0));
  return open[0]||null;
}
/** Текущий заказ на закрытии (не путать с «зомби» незакрытым №1). */
function openOrder(){ return orderBeingClosed(); }
function allOrders(){ return (state.orders||[]).slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)); }
function isBookingRequested(o){
  return !!(o && String(o.bookedPlate||'').trim() && o.bookStatus==='requested');
}
function isBookingConfirmed(o){
  return !!(o && String(o.bookedPlate||'').trim() && o.bookStatus==='confirmed');
}
function confirmedBookingDayKey(o){
  if(!isBookingConfirmed(o) || o.cancelledAt) return '';
  return typeof dayKeyFromIso==='function'?dayKeyFromIso(o.vehicleAt):'';
}
function monthCalHtml(cal, marked, opt){
  opt=opt||{};
  const dayAttr=opt.dayAttr||'data-cal-day';
  const wrapId=opt.id||'';
  const y=cal.year, m=cal.month;
  const title=new Date(y,m,1).toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
  const first=new Date(y,m,1);
  const startPad=(first.getDay()+6)%7;
  const dim=new Date(y,m+1,0).getDate();
  const todayKey=typeof dayKeyFromIso==='function'?dayKeyFromIso(new Date().toISOString()):'';
  const a=cal.from?(cal.to && cal.to<cal.from?cal.to:cal.from):null;
  const b=cal.from?(cal.to && cal.to>cal.from?cal.to:(cal.to||cal.from)):null;
  let cells='';
  for(let i=0;i<startPad;i++) cells+=`<button type="button" class="mute" disabled>·</button>`;
  for(let day=1;day<=dim;day++){
    const key=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const cls=[
      marked.has(key)?'has':'',
      key===todayKey?'today':'',
      a && key===a?'edge':'',
      b && key===b?'edge':'',
      a && b && key>a && key<b?'in':''
    ].filter(Boolean).join(' ');
    cells+=`<button type="button" class="${cls}" ${dayAttr}="${esc(key)}">${day}</button>`;
  }
  const showReset=!!(cal.from || opt.showReset);
  return `<div class="drv-cal"${wrapId?` id="${esc(wrapId)}"`:''}>
    <div class="drv-cal-head">
      <button type="button" data-cal-prev aria-label="Предыдущий месяц">‹</button>
      <h3>${esc(title.charAt(0).toUpperCase()+title.slice(1))}</h3>
      <button type="button" data-cal-next aria-label="Следующий месяц">›</button>
    </div>
    <div class="drv-cal-week">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(w=>`<span>${w}</span>`).join('')}</div>
    <div class="drv-cal-grid">${cells}</div>
    <div class="drv-cal-meta">
      <span class="period">${esc(opt.period||'Точка — подтверждённая бронь на дату подачи')}</span>
      <button type="button" data-cal-reset${showReset?'':' hidden'}>Сбросить</button>
    </div>
  </div>`;
}
function stampConfirmedBooking(o, plate){
  if(!o) return;
  const p=String(plate||o.bookedPlate||'').trim();
  if(!p) return;
  o.bookedPlate=p;
  o.bookStatus='confirmed';
  o.bookConfirmedAt=new Date().toISOString();
  o.bookRejectedAt=null;
}
function clearOrderBooking(o){
  if(!o) return;
  o.bookedPlate=null;
  o.bookStatus=null;
  o.bookConfirmedAt=null;
  o.bookRejectedAt=null;
}
function waitingLogistDriver(name){
  const n=String(name||'').trim();
  return !n || n==='—' || n==='-' || n==='Биржа' || n==='Диспетчер';
}
function orderKeepsLogist(o){
  if(!o) return false;
  return o.executorType==='logist' || o.customerSubmitted || o.fulfillment==='logist' || o.fulfillment==='direct';
}
function isLogistInboxOrder(o){
  if(!o || looksClosedOrder(o) || o.cancelledAt || o.onExchange || o.startOdometer!=null) return false;
  if(!waitingLogistDriver(o.driverName)) return false;
  return orderKeepsLogist(o);
}
function logistMargin(o){
  const client=+o.priceForClient||0;
  const carr=+o.priceForCarrier||0;
  if(!(client>0) && !(carr>0)) return null;
  return {
    client:client||null,
    carrier:carr||null,
    margin:(client>0 && carr>0)?Math.round((client-carr)*100)/100:null
  };
}
function logistMarginLine(o){
  const m=logistMargin(o);
  if(!m) return '';
  if(m.margin!=null) return `Заказчику ${fmt(m.client)} ₽ · перевозчику ${fmt(m.carrier)} ₽ · вам ${fmt(m.margin)} ₽`;
  if(m.client) return `Заказчику ${fmt(m.client)} ₽ · ставку перевозчику ещё не задали`;
  return `Перевозчику ${fmt(m.carrier)} ₽`;
}
function statusText(o){
  if(o.cancelledAt || (o.closedAt && o.cancelReason)) return 'Отменён';
  if(looksClosedOrder(o)) return 'Закрыт';
  if(isLogistInboxOrder(o)){
    if(typeof isBookingRequested==='function' && isBookingRequested(o)) return 'Бронь · жду подтверждения';
    if(typeof isBookingConfirmed==='function' && isBookingConfirmed(o)) return o.fulfillment==='direct'?'Прямой · бронь в календаре':'Входящая · бронь в календаре';
    return o.fulfillment==='direct'?'Прямой · жду парк':'Входящая';
  }
  if(o.onExchange && o.startOdometer==null) return 'На бирже (ищем партнёра)';
  if(o.startOdometer!=null && o.staysLoadedOvernight) return 'В работе · до выгрузки';
  if(o.startOdometer!=null) return 'В работе';
  if(o.departOdometer!=null) return 'В пути';
  if(o.executorType==='partner' && o.transportApp) return 'Партнёр везёт';
  if(!o.onExchange && o.startOdometer==null && o.departOdometer==null && waitingLogistDriver(o.driverName)){
    return 'Черновик';
  }
  return 'Назначен';
}
/** Снять все связи заказа перед удалением из state.orders. */
function detachOrderReferences(deletedOrders){
  const list=(deletedOrders||[]).filter(o=>o&&o.id);
  if(!list.length) return false;
  const delSet=new Set(list.map(o=>o.id));
  let changed=false;

  if(typeof removeBillingEntriesForOrders==='function'){
    if(removeBillingEntriesForOrders(Array.from(delSet))) changed=true;
  }

  const nums=new Set(list.map(o=>o.sequentialNumber).filter(n=>n!=null));
  const msgRefsDeleted=text=>{
    const t=String(text||'');
    for(const n of nums){
      if(t.includes(`Заказ №${n}`) || t.includes(`№${n} ·`) || t.includes(`№${n}\n`)
        || t.includes(`порядковый номер - ${n}`) || t.includes(`заказ №${n}`)) return true;
    }
    return false;
  };
  const scrubMessages=msgs=>{
    if(!Array.isArray(msgs)) return msgs;
    const next=msgs.filter(m=>!msgRefsDeleted(m.text));
    return next.length===msgs.length?msgs:next;
  };

  list.forEach(d=>{
    const prevWaiting=findOrderAwaitingEmptyAfterLink(d);
    if(prevWaiting && !delSet.has(prevWaiting.id)){
      prevWaiting.linkEmptyAfterToNext=false;
      changed=true;
    }
    (state.orders||[]).forEach(o=>{
      if(!o||delSet.has(o.id)) return;
      if(o.emptyAfterLinkedFromNext && d.emptyKmBefore!=null && o.emptyKmAfter!=null
        && +o.emptyKmAfter===+d.emptyKmBefore
        && (!d.vehiclePlate || o.vehiclePlate===d.vehiclePlate)
        && (!d.driverName || samePersonName(o.driverName||'', d.driverName||''))){
        o.emptyKmAfter=null;
        o.emptyAfterLinkedFromNext=false;
        o.linkEmptyAfterToNext=false;
        changed=true;
      }
    });
  });

  const cleanShift=s=>{
    if(!s) return;
    if(s.pendingEmptyAfterOrderId && delSet.has(s.pendingEmptyAfterOrderId)){
      s.pendingEmptyAfterOrderId=null;
      changed=true;
    }
    if(Array.isArray(s.orders) && s.orders.some(o=>o&&delSet.has(o.id))){
      s.orders=s.orders.filter(o=>!o||!delSet.has(o.id));
      changed=true;
    }
    if(Array.isArray(s.messages)){
      const next=scrubMessages(s.messages);
      if(next!==s.messages){ s.messages=next; changed=true; }
    }
  };
  (state.shifts||[]).forEach(cleanShift);
  if(state.shift) cleanShift(state.shift);

  if(state.messages){
    const next=scrubMessages(state.messages);
    if(next!==state.messages){ state.messages=next; changed=true; }
  }

  if(state.draft && state.draft.closingOrderId && delSet.has(state.draft.closingOrderId)){
    delete state.draft.closingOrderId;
    changed=true;
  }
  if(state.orderStep && state.orderStep!=='idle'){
    const pinned=state.draft&&state.draft.closingOrderId;
    const live=inProgressOrder();
    const stepOrder=pinned?orderById(pinned):live;
    if(!stepOrder || delSet.has(stepOrder.id)){
      if(['closingOdometer','fuelPrice','fuelAmount','askRefuel','closeShiftStaysLoaded','closeShiftParking'].includes(state.orderStep)){
        state.orderStep='idle';
        changed=true;
      }
    }
  }

  if(typeof clearAdminUiForDeletedOrders==='function'){
    clearAdminUiForDeletedOrders(Array.from(delSet));
  }

  return changed;
}
function removeOrdersByIds(ids){
  const delSet=new Set((ids||[]).filter(Boolean));
  if(!delSet.size) return 0;
  const deletedOrders=(state.orders||[]).filter(o=>o&&delSet.has(o.id));
  detachOrderReferences(deletedOrders);
  delSet.forEach(id=>rememberDeletedOrderId(id));
  state.orders=(state.orders||[]).filter(x=>!delSet.has(x.id));
  (state.shifts||[]).forEach(s=>{
    if(Array.isArray(s.orders)) s.orders=s.orders.filter(x=>!delSet.has(x.id));
  });
  if(state.shift && Array.isArray(state.shift.orders)){
    state.shift.orders=state.shift.orders.filter(x=>!delSet.has(x.id));
  }
  compactSequentialNumbers();
  return deletedOrders.length;
}
/** Удалить заказы (включая закрытые). Номера после compactSequentialNumbers снова 1…N — следующий новый = seq+1. */
function deleteOrders(ids){
  const list=Array.isArray(ids)?ids.filter(Boolean):[];
  if(!list.length) return {ok:false, deleted:0, message:'Ничего не выбрано'};
  const toDelete=[];
  const denied=[];
  list.forEach(id=>{
    const o=(state.orders||[]).find(x=>x.id===id);
    if(!o) return;
    if(currentAdmin && !canAdminSeeOrder(o)){
      denied.push(o.sequentialNumber);
      return;
    }
    toDelete.push(o);
  });
  if(denied.length) alert('Нет доступа к заказам № '+denied.join(', №'));
  if(!toDelete.length) return {ok:false, deleted:0, message:'Нет заказов для удаления'};
  const deleted=removeOrdersByIds(toDelete.map(o=>o.id));
  bumpDataEpoch('deleteOrders');
  persist();
  return {ok:true, deleted, nextNumber:(Number(state.seq)||0)+1};
}
function cancelOrder(id, reason){
  const o=state.orders.find(x=>x.id===id); if(!o) return false;
  if(currentAdmin && !canAdminSeeOrder(o)){ alert('Чужой заказ — нет доступа'); return false; }
  if(o.closedAt && !o.cancelledAt){ alert('Заказ уже закрыт — используйте «Удалить выбранные»'); return false; }
  if(o.startOdometer!=null && !o.cancelledAt){
    if(!confirm('Заказ уже в работе. Точно отменить?')) return false;
  }
  removeOrdersByIds([id]);
  bumpDataEpoch('cancelOrder');
  persist();
  return true;
}
function purgeCancelledOrders(){
  const before=(state.orders||[]).length;
  state.orders=stripCancelledFromOrders(state.orders);
  state.shifts.forEach(s=>{
    if(Array.isArray(s.orders)) s.orders=stripCancelledFromOrders(s.orders);
  });
  return before!==(state.orders||[]).length;
}
function canStartAssignedMessage(){
  const shift=syncOpenShiftRuntime();
  if(!shift && !state.shift) return 'Сначала откройте смену';
  if(!isEtoDone(shift) && !isEtoDone(state.shift)){
    if(state.step==='done') state.step=(state.shift&&state.shift.vehiclePlate)?'odometer':'chooseVehicle';
    return 'Сначала завершите ЕТО';
  }
  state.step='done';
  if(state.shift && state.shift.completedAt && !isSameLocalDay(state.shift.completedAt) && !state.shift.lockEto){
    state.shift.completedAt=new Date().toISOString();
  }
  upsertShift();
  if(inProgressOrder()) return 'Сначала закройте текущий заказ';
  return null;
}
/** Для выезда: нельзя, если уже в пути или в работе */
function canDepartMessage(){
  const gate=canStartAssignedMessage();
  if(gate) return gate;
  if(enRouteOrder()) return 'Сначала отметьте прибытие на загрузку по текущему заказу';
  return null;
}
/** Для прибытия: смена+ЕТО; чужие «в работе» не блокируют. */
function canArriveMessage(orderId){
  const shift=syncOpenShiftRuntime();
  if(!shift && !state.shift) return 'Сначала откройте смену';
  if(!isEtoDone(shift) && !isEtoDone(state.shift)){
    return 'Сначала завершите ЕТО';
  }
  state.step='done';
  const target=orderId?(state.orders||[]).find(o=>o.id===orderId):null;
  // Свой заказ «в пути» — как раз то, на что жмём «Прибыл»
  if(target && orderBelongsToDriver(target) && target.departOdometer!=null && target.startOdometer==null && !target.closedAt){
    return null;
  }
  const mineBusy=inProgressOrder();
  if(mineBusy && (!target || mineBusy.id!==target.id)) return 'Сначала закройте текущий заказ';
  return null;
}
const DRIVER_NOTIFY_KEY='armada_driver_notify_v1';
const CUSTOMER_NOTIFY_KEY_SHARED='armada_customer_notify_v1';
const driverNotifyLastAt={};
const armadaNotifyLastAt={};
function notifyRoleWanted(role){
  if(role==='customer'){
    try{ return localStorage.getItem(CUSTOMER_NOTIFY_KEY_SHARED)==='1'; }catch(_){ return false; }
  }
  return driverNotifyWanted();
}
function setNotifyRoleWanted(role, on){
  if(role==='customer') setCustomerNotifyWanted(on);
  else setDriverNotifyWanted(on);
}
function armadaNotifySupported(){
  return typeof Notification!=='undefined' && !!window.isSecureContext;
}
function armadaNotifyActive(role){
  if(!armadaNotifySupported()) return false;
  if(Notification.permission!=='granted') return false;
  return notifyRoleWanted(role||'driver');
}
async function armadaRequestNotifyPermission(role){
  if(!armadaNotifySupported()) return false;
  let perm=Notification.permission;
  if(perm!=='granted'){
    try{ perm=await Notification.requestPermission(); }catch(_){ perm='denied'; }
  }
  const ok=perm==='granted';
  setNotifyRoleWanted(role||'driver', ok);
  return ok;
}
function armadaShowNotification(title, body, tag, role){
  const r=role||'driver';
  if(r==='driver' && !DRIVER) return;
  if(r==='customer' && typeof currentCustomer!=='undefined' && !currentCustomer) return;
  if(!armadaNotifyActive(r)) return;
  const now=Date.now();
  const key=tag||'armada';
  const prev=armadaNotifyLastAt[key]||0;
  if(now-prev<12*60*1000) return;
  armadaNotifyLastAt[key]=now;
  const opts={body:body||'', tag:key, renotify:true, icon:'./icons/icon-192.png', badge:'./icons/icon-192.png'};
  if(navigator.serviceWorker){
    navigator.serviceWorker.ready.then(reg=>reg.showNotification(title, opts)).catch(()=>{
      try{ new Notification(title, opts); }catch(_){}
    });
  } else {
    try{ new Notification(title, opts); }catch(_){}
  }
}
function driverNotifyWanted(){
  try{ return localStorage.getItem(DRIVER_NOTIFY_KEY)==='1'; }catch(_){ return false; }
}
function setDriverNotifyWanted(on){
  try{ localStorage.setItem(DRIVER_NOTIFY_KEY, on?'1':'0'); }catch(_){}
}
function driverNotifySupported(){
  // На HTTP / в обычном Safari iOS Notification часто отсутствует
  return typeof Notification!=='undefined' && !!window.isSecureContext;
}
function driverNotifyActive(){
  return driverNotifySupported() && Notification.permission==='granted' && driverNotifyWanted();
}
async function enableDriverNotifications(){
  if(!driverNotifySupported()){ alert('Уведомления в этом браузере недоступны'); return false; }
  let perm=Notification.permission;
  if(perm!=='granted'){
    try{ perm=await Notification.requestPermission(); }catch(_){ perm='denied'; }
  }
  const ok=perm==='granted';
  setDriverNotifyWanted(ok);
  if(!ok) alert(perm==='denied'?'Разрешите уведомления в настройках телефона / Safari.':'Не удалось включить уведомления');
  return ok;
}
function driverNotify(title, body, tag){
  armadaShowNotification(title, body, tag, 'driver');
}
/** Системные напоминания, когда экран свёрнут / вкладка в фоне. */
function maybeDriverActionNotify(force){
  if(!DRIVER || !document.querySelector('#driver.show')) return;
  if(!force && !document.hidden) return;
  const enRoute=typeof awaitingArrive==='function'?awaitingArrive():[];
  const pending=typeof assignedPending==='function'?assignedPending():[];
  const needClose=typeof shiftAwaitingClose==='function'?shiftAwaitingClose():false;
  if(enRoute && enRoute.length){
    const o=enRoute[0];
    driverNotify('АРМАДА · прибытие', `Заказ №${o.sequentialNumber}: отметьте «Прибыл на загрузку»`, 'arrive-'+o.id);
  } else if(pending && pending.length){
    const o=pending[0];
    driverNotify('АРМАДА · выезд', `Заказ №${o.sequentialNumber}: нажмите «Выехал»`, 'depart-'+o.id);
  } else if(needClose){
    driverNotify('АРМАДА · смена', 'Не забудьте закрыть смену и указать одометр на стоянке', 'close-shift');
  }
}
function updateDriverNetHint(){
  const el=$('driver-net'); if(!el) return;
  if(!DRIVER || !document.querySelector('#driver.show')){
    el.hidden=true; el.className='driver-net'; el.textContent=''; return;
  }
  if(navigator.onLine===false){
    el.hidden=false; el.className='driver-net show bad';
    el.textContent='Нет сети — смена и черновик сохранены на телефоне';
    return;
  }
  if(syncStatus==='error'){
    el.hidden=false; el.className='driver-net show bad';
    el.textContent='Нет связи с сервером — отправим при появлении сети';
    return;
  }
  if(syncStatus==='syncing'){
    el.hidden=false; el.className='driver-net show';
    el.textContent='Синхронизация…';
    return;
  }
  el.hidden=true; el.className='driver-net'; el.textContent='';
}
function flushDriverSyncWhenOnline(){
  if(navigator.onLine===false) return;
  updateDriverNetHint();
  syncStatus='syncing';
  updateDriverNetHint();
  pushServerStateQueued()
    .then(()=>{ syncStatus='ok'; updateDriverNetHint(); })
    .catch(err=>{ syncStatus='error'; console.warn('PB online flush', err); updateDriverNetHint(); });
  try{ pullRemoteUpdates('online'); }catch(_){}
}
/** Включить напоминание закрыть смену (после закрытия заказа / «на стоянку»). */
function markCloseShiftReminder(){
  state.pendingCloseShiftReminder=true;
  if(state.shift) state.shift.pendingCloseShiftReminder=true;
}
function clearCloseShiftReminder(){
  state.pendingCloseShiftReminder=false;
  if(state.shift) state.shift.pendingCloseShiftReminder=false;
}
/** Напоминание закрыть смену — только после закрытия заказа или выбора стоянки. */
function shiftAwaitingClose(shift){
  const s=shift||state.shift||findOpenShift();
  if(!s || s.endedAt || s.abandoned) return false;
  // Не шумим постоянно: только если явно отметили «пора закрывать смену»
  const flagged=!!(state.pendingCloseShiftReminder || s.pendingCloseShiftReminder);
  if(!flagged) return false;
  if(state.orderStep==='closeShiftParking'||state.orderStep==='closeShiftStaysLoaded') return false;
  if(!isEtoDone(s) && !etoFieldsComplete(s)) return false;
  if(inProgressOrder()||enRouteOrder()) return false;
  return true;
}
/** Мягкое напоминание в чат (не чаще раза в 30 мин). */
function maybeNudgeCloseShift(force){
  if(!DRIVER || !shiftAwaitingClose()) return false;
  if(state.orderStep && state.orderStep!=='idle') return false;
  const last=state.closeShiftNudgeAt || (state.shift && state.shift.closeShiftNudgeAt);
  if(!force && last && (Date.now()-new Date(last).getTime())<30*60*1000) return false;
  const recent=(state.messages||[]).slice(-6).some(m=>/не забудьте.*закрыть смену|закройте смену|«Закрыть смену»/i.test(String(m.text||'')));
  if(!force && recent) return false;
  add('bot','Не забудьте закрыть смену: нажмите «Закрыть смену» и введите одометр на стоянке. Иначе день останется открытым.');
  state.closeShiftNudgeAt=new Date().toISOString();
  if(state.shift) state.shift.closeShiftNudgeAt=state.closeShiftNudgeAt;
  upsertShift();
  renderChat();
  return true;
}
function renderDriverBanner(){
  const box=$('driver-banner'); if(!box) return;
  const enRoute=awaitingArrive();
  const pending=assignedPending();
  const needClose=shiftAwaitingClose();
  const etrnHtml=typeof driverEtrnBannerHtml==='function'?driverEtrnBannerHtml():'';
  if(!enRoute.length && !pending.length && !needClose && !etrnHtml){
    box.classList.remove('show','remind-close'); box.innerHTML='';
    updateDriverNetHint();
    return;
  }
  let html='';
  enRoute.forEach(o=>{
    html+=`<strong>Заказ №${o.sequentialNumber} — вы в пути</strong>
      <p>${esc(routeText(o))}<br>Не забудьте отметить прибытие на загрузку (одометр).</p>
      <div class="banner-actions"><button type="button" class="primary banner-arrive" data-id="${o.id}">Прибыл на загрузку</button></div>`;
  });
  pending.forEach(o=>{
    html+=`<strong>Заказ №${o.sequentialNumber} назначен</strong>
      <p>${esc(routeText(o))}<br>Перед выездом со стоянки нажмите «Выехал» и введите одометр.</p>
      <div class="banner-actions"><button type="button" class="primary banner-depart" data-id="${o.id}">Выехал</button></div>`;
  });
  if(needClose){
    const s=state.shift||findOpenShift();
    const n=(s && s.orders||[]).filter(o=>o && !o.cancelled && (o.closedAt||looksClosedOrder(o))).length;
    const prev=s && localDayKey(s.startedAt) && localDayKey(s.startedAt)<localDayKey(new Date());
    html+=`<strong>Не забудьте закрыть смену</strong>
      <p>${prev?'Смена со вчера ещё открыта. ':''}${n?`Закрыто заказов: ${n}. `:''}Нажмите «Закрыть смену» и укажите одометр на стоянке.</p>
      <div class="banner-actions"><button type="button" class="primary banner-close-shift">Закрыть смену</button></div>`;
    box.classList.add('remind-close');
  } else {
    box.classList.remove('remind-close');
  }
  if(etrnHtml) html+=etrnHtml;
  box.innerHTML=html;
  box.classList.add('show');
  document.querySelectorAll('.banner-depart').forEach(b=>b.onclick=()=>beginDepart(b.dataset.id));
  document.querySelectorAll('.banner-arrive').forEach(b=>b.onclick=()=>beginArrive(b.dataset.id));
  document.querySelectorAll('.banner-close-shift').forEach(b=>b.onclick=()=>startCloseShift());
  document.querySelectorAll('.banner-etrn-sign').forEach(b=>b.onclick=()=>{
    if(typeof openDriverEtrnSign==='function') openDriverEtrnSign(b.dataset.etrnSign);
  });
  document.querySelectorAll('.banner-etrn-qr').forEach(b=>b.onclick=()=>{
    if(typeof driverEtrnShowQr==='function') driverEtrnShowQr(b.dataset.etrnQr);
  });
  if(typeof refreshDriverEtrnFromApi==='function') refreshDriverEtrnFromApi().then(changed=>{
    if(changed && typeof renderDriverBanner==='function') renderDriverBanner();
  });
  maybeDriverActionNotify(false);
  updateDriverNetHint();
}
function isSameLocalDay(iso, now){
  if(!iso) return false;
  const d=new Date(iso), n=now||new Date();
  if(Number.isNaN(d.getTime())) return false;
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
}
/** Все пункты осмотра заполнены (без проверки дня). */
function etoFieldsComplete(shift){
  if(!shift) return false;
  const L=shift.light||{};
  return !!(shift.vehiclePlate && shift.odometer!=null && shift.fuelLiters!=null
    && (shift.gur||shift.powerSteeringLevel)
    && (shift.coolant||shift.coolantLevel)
    && (L.lowBeam&&L.brake&&L.turn)
    && (shift.oil||shift.engineOilLevel));
}
/** ЕТО засчитывается только в календарный день прохождения */
function isEtoDone(shift){
  if(!shift) return false;
  if(shift.lockEto && etoFieldsComplete(shift)) return true;
  if(shift.completedAt && isSameLocalDay(shift.completedAt)) return true;
  // Незавершённый осмотр только в день открытия смены
  if(!isSameLocalDay(shift.startedAt)) return false;
  // completedAt с другой «локальной» датой не должен ломать уже заполненный осмотр сегодня
  return etoFieldsComplete(shift) || !!(shift.vehiclePlate && shift.odometer!=null && shift.fuelLiters!=null
    && (shift.gur||shift.powerSteeringLevel)
    && (shift.coolant||shift.coolantLevel)
    && (shift.oil||shift.engineOilLevel));
}
/** Сбросить вчерашний ЕТО — утром осмотр заново (авто и lastOdometerPoint оставляем) */
function invalidateStaleEto(shift){
  if(!shift || shift.endedAt) return false;
  if(shift.lockEto) return false; // ручной перенос / водитель уже в пути — не трогаем
  if(shift.orderStep && shift.orderStep!=='idle') return false;
  if(isEtoDone(shift)) return false;
  const hadOldEto=!!(shift.completedAt || shift.odometer!=null || shift.fuelLiters!=null
    || shift.oil || shift.engineOilLevel || shift.gur || shift.coolant);
  if(!hadOldEto) return false;
  if(shift.completedAt && isSameLocalDay(shift.completedAt)) return false;
  if(!shift.completedAt && isSameLocalDay(shift.startedAt)) return false; // сегодня ещё идём по ЕТО
  if(etoFieldsComplete(shift) && isSameLocalDay(shift.startedAt)) return false;
  shift.completedAt=null;
  shift.odometer=null;
  shift.fuelLiters=null;
  shift.fuelRemainingLiters=null;
  shift.gur=null; shift.powerSteeringLevel=null;
  shift.coolant=null; shift.coolantLevel=null;
  shift.oil=null; shift.engineOilLevel=null;
  shift.light={};
  return true;
}
/** Привязать смену к водителю и фирме (как заказ с source=driver). */
function stampShiftOwner(shift, driverName, vehiclePlate){
  if(!shift) return shift;
  const name=String(driverName||shift.driverName||'').trim();
  const plate=String(vehiclePlate||shift.vehiclePlate||'').trim();
  if(!name && !plate) return shift;
  // Фирма: авто смены → компания выбранного водителя → домашний профиль
  let companyId=null;
  if(plate){
    const veh=(state.vehicles||[]).find(v=>v.plate===plate);
    if(veh && veh.companyId) companyId=veh.companyId;
  }
  if(!companyId && name && DRIVER && DRIVER_COMPANY_ID && samePersonName(name, DRIVER)) companyId=DRIVER_COMPANY_ID;
  const rec=name?findDriverRecord(name, companyId):null;
  const bind=name?resolveDriverOrderBinding(name, plate):{ownerAdminId:null,ownerAdminName:null,spaceId:null,ownCompanyId:null,ownCompanyName:null};
  if(name) shift.driverName=name;
  if(rec||bind.ownerAdminId){
    shift.ownerAdminId=(rec&&rec.ownerAdminId)||bind.ownerAdminId||shift.ownerAdminId||null;
    shift.ownerAdminName=(rec&&rec.ownerAdminName)||bind.ownerAdminName||shift.ownerAdminName||null;
  }
  shift.spaceId=(rec&&rec.spaceId)||bind.spaceId||shift.spaceId||null;
  shift.ownCompanyId=companyId||(rec&&rec.companyId)||bind.ownCompanyId||shift.ownCompanyId||null;
  shift.ownCompanyName=(rec&&rec.companyName)||bind.ownCompanyName||shift.ownCompanyName||null;
  if(shift.ownCompanyId && !shift.ownCompanyName){
    const co=findCompanyById(shift.ownCompanyId);
    if(co) shift.ownCompanyName=co.name;
  }
  if(shift.ownCompanyId && !shift.spaceId){
    const co=findCompanyById(shift.ownCompanyId);
    if(co && co.spaceId) shift.spaceId=co.spaceId;
  }
  if(shift.spaceId && !shift.ownerAdminId){
    const adm=(state.admins||[]).find(a=>a.spaceId===shift.spaceId);
    if(adm){ shift.ownerAdminId=adm.id; shift.ownerAdminName=adm.name; }
  }
  return shift;
}
function migrateShiftOwners(){
  let changed=false;
  (state.shifts||[]).forEach(s=>{
    if(!s) return;
    // Не подставляем активного DRIVER сессии — только данные самой смены
    if(!s.driverName && !s.vehiclePlate) return;
    const before=JSON.stringify({d:s.driverName,o:s.ownerAdminId,sp:s.spaceId,c:s.ownCompanyId});
    stampShiftOwner(s, s.driverName||null, s.vehiclePlate);
    const after=JSON.stringify({d:s.driverName,o:s.ownerAdminId,sp:s.spaceId,c:s.ownCompanyId});
    if(before!==after) changed=true;
  });
  return changed;
}
/** Пространство фирмы смены: spaceId, иначе через компанию или админа. */
function shiftSpaceId(s){
  if(!s) return null;
  if(s.spaceId) return s.spaceId;
  if(s.ownCompanyId){
    const co=findCompanyById(s.ownCompanyId);
    if(co && co.spaceId) return co.spaceId;
  }
  if(s.ownerAdminId){
    const adm=(state.admins||[]).find(a=>a.id===s.ownerAdminId);
    if(adm && adm.spaceId) return adm.spaceId;
  }
  return null;
}
function matchesShiftOwnerFilter(s){
  if(!isSuperAdmin()) return true;
  const f=state.adminOwnerFilter||'all';
  if(f==='all') return true;
  const sid=shiftSpaceId(s);
  if(f==='_none') return !sid;
  return sid===f;
}
/** Открытые смены водителей фирмы админа (для вкладки ЕТО). */
function adminOpenShifts(){
  return (state.shifts||[])
    .filter(s=>s && !s.endedAt && !s.abandoned && canAdminSeeShift(s) && matchesShiftOwnerFilter(s))
    .sort((a,b)=>new Date(b.startedAt)-new Date(a.startedAt));
}
function etoStepLabel(shift){
  if(!shift) return '—';
  if(shift.endedAt) return 'Смена закрыта';
  if(isEtoDone(shift)) return 'ЕТО пройден';
  if(!shift.vehiclePlate) return 'Выбор авто';
  if(shift.odometer==null) return 'Одометр';
  if(shift.fuelLiters==null) return 'Топливо';
  if(!(shift.gur||shift.powerSteeringLevel)) return 'Уровень ГУР';
  if(!(shift.coolant||shift.coolantLevel)) return 'Уровень ОЖ';
  const L=shift.light||{};
  if(!L.lowBeam || !L.brake || !L.turn) return 'Освещение';
  if(!(shift.oil||shift.engineOilLevel)) return 'Масло ДВС';
  return 'ЕТО не завершён';
}
function etoMark(ok){ return ok?'<b class="eto-ok">ок</b>':'<b class="eto-wait">нет</b>'; }
function openShifts(){
  return (state.shifts||[]).filter(s=>!s.endedAt)
    .sort((a,b)=>new Date(b.startedAt)-new Date(a.startedAt));
}
/** Открытые смены только текущего водителя (и его фирмы), не чужие. */
function openShiftsForDriver(){
  return openShifts().filter(s=>{
    if(s.abandoned) return false;
    if(s.driverName && !samePersonName(s.driverName, DRIVER)) return false;
    if(!s.driverName){
      // старые смены без ФИО — только если авто из фирмы текущего водителя
      if(!DRIVER_COMPANY_ID || !s.vehiclePlate) return false;
      return fleetVehiclesForCompany(DRIVER_COMPANY_ID).some(v=>v.plate===s.vehiclePlate);
    }
    if(DRIVER_COMPANY_ID && s.ownCompanyId && s.ownCompanyId!==DRIVER_COMPANY_ID) return false;
    return true;
  });
}
function findOpenShift(){
  const open=openShiftsForDriver();
  if(!open.length) return null;
  // Текущая живая смена важнее «новой пустой», если у неё не хуже прогресс ЕТО
  if(state.shift && !state.shift.endedAt && open.some(s=>s.id===state.shift.id)){
    const live=open.find(s=>s.id===state.shift.id)||state.shift;
    const best=[...open].sort((a,b)=>etoProgressScore(b)-etoProgressScore(a) || new Date(b.startedAt)-new Date(a.startedAt))[0];
    if(best && etoProgressScore(best)>etoProgressScore(live)) return best;
    return live;
  }
  // Сначала полностью пройденный ЕТО, иначе — максимальный прогресс (не «самая новая пустая»)
  const done=open.find(s=>isEtoDone(s));
  if(done) return done;
  return [...open].sort((a,b)=>etoProgressScore(b)-etoProgressScore(a) || new Date(b.startedAt)-new Date(a.startedAt))[0];
}
/** Локальный календарный день YYYY-MM-DD (как isSameLocalDay). */
function localDayKey(iso){
  if(!iso) return '';
  const d=iso instanceof Date ? iso : new Date(iso);
  if(Number.isNaN(d.getTime())) return '';
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
/** Есть незакрытый заказ, из‑за которого смену нельзя «забыть» автоматически. */
function shiftHasBlockingOpenOrder(s){
  return (s.orders||[]).some(o=>o && !o.cancelled && !o.closedAt && !looksClosedOrder(o));
}
/**
 * Закрыть забытую открытую смену (водитель закрыл заказы, но не нажал «Закрыть смену»).
 * parkOverride — одометр с утреннего ЕТО / ввода стоянки.
 */
function sealForgottenOpenShift(s, parkOverride){
  if(!s || s.endedAt) return false;
  const park=parkOverride!=null && parkOverride!=='' ? +parkOverride
    : (s.parkingOdometer!=null ? +s.parkingOdometer
      : (s.lastOdometerPoint!=null ? +s.lastOdometerPoint : (s.odometer!=null ? +s.odometer : null)));
  if(park!=null && !Number.isNaN(park)){
    s.parkingOdometer=park;
    s.lastOdometerPoint=park;
    const closed=(s.orders||[]).filter(o=>o && o.closedAt && o.endOdometer!=null)
      .sort((a,b)=>new Date(a.closedAt)-new Date(b.closedAt));
    const last=closed[closed.length-1];
    if(last && !last.linkEmptyAfterToNext && !last.emptyAfterLinkedFromNext){
      last.emptyKmAfter=Math.max(0, park - (+last.endOdometer||0));
      upsertOrder(last);
    }
  }
  s.endedAt=new Date().toISOString();
  const hasOrders=(s.orders||[]).some(o=>o && !o.cancelled);
  // Пустую незавершённую — abandoned; с заказами/ЕТО — обычное закрытие
  s.abandoned=(!hasOrders && !etoFieldsComplete(s) && !s.completedAt) ? true : false;
  return true;
}
/** Открытая смена прошлого дня без активного заказа (кандидат на закрытие утренним одометром). */
function findPreviousDayOpenShift(driverName){
  if(!driverName) return null;
  const today=localDayKey(new Date());
  return (state.shifts||[])
    .filter(s=>s && !s.endedAt && !s.abandoned
      && s.driverName && samePersonName(s.driverName, driverName)
      && localDayKey(s.startedAt) && localDayKey(s.startedAt)<today
      && !shiftHasBlockingOpenOrder(s))
    .sort((a,b)=>new Date(b.startedAt)-new Date(a.startedAt))[0]||null;
}
/** Закрыть вчерашние смены одометром ЕТО — только тот же водитель и та же машина. */
function closePreviousDayShiftsWithOdo(driverName, parkOdo, plate){
  if(!driverName || !plate || parkOdo==null || Number.isNaN(+parkOdo)) return false;
  const today=localDayKey(new Date());
  const park=+parkOdo;
  let changed=false;
  (state.shifts||[]).forEach(s=>{
    if(!s || s.endedAt) return;
    if(!s.driverName || !samePersonName(s.driverName, driverName)) return;
    if(!s.vehiclePlate || !sameVehiclePlate(s.vehiclePlate, plate)) return;
    const day=localDayKey(s.startedAt);
    if(!day || day>=today) return;
    if(shiftHasBlockingOpenOrder(s)) return;
    const min=s.lastOdometerPoint??s.odometer;
    if(min!=null && park<+min) return;
    if(sealForgottenOpenShift(s, park)){
      syncVehicleOdometerFromShift(s);
      changed=true;
    }
  });
  return changed;
}
/**
 * Вчерашние открытые смены без активных заказов.
 * Без одометра стоянки по умолчанию не закрываем — ждём ввод с утреннего ЕТО.
 * allowGuessOdo: угадать стоянку по lastOdometerPoint (только если явно нужно).
 */
function sealPreviousDayOpenShiftsForDriver(driverName, opts){
  if(!driverName) return false;
  const today=localDayKey(new Date());
  const allowGuessOdo=!!(opts&&opts.allowGuessOdo);
  let changed=false;
  (state.shifts||[]).forEach(s=>{
    if(!s || s.endedAt) return;
    if(!s.driverName || !samePersonName(s.driverName, driverName)) return;
    const day=localDayKey(s.startedAt);
    if(!day || day>=today) return;
    if(shiftHasBlockingOpenOrder(s)) return;
    if(s.parkingOdometer==null && !allowGuessOdo) return;
    if(sealForgottenOpenShift(s)) changed=true;
  });
  return changed;
}
/** Закрыть вчера → открыть сегодня: спросить одометр (станет и стоянкой, и ЕТО). */
function beginClosePrevAndOpenNew(prevShift){
  if(!prevShift || prevShift.endedAt) return false;
  if(state.orderStep==='closePrevShiftParking' && state.draft&&state.draft.closePrevShiftId===prevShift.id){
    renderInput(); return true;
  }
  state.pendingClosePrevShiftId=prevShift.id;
  state.step='closePrevThenOpen';
  state.orderStep='closePrevShiftParking';
  state.draft={
    closePrevShiftId:prevShift.id,
    plate:prevShift.vehiclePlate||null,
    prevMinOdo:prevShift.lastOdometerPoint??prevShift.odometer??null
  };
  // Не держим state.shift на вчерашней — иначе upsertShift затрёт закрытие
  if(state.shift && state.shift.id===prevShift.id) state.shift=null;
  const last=state.draft.prevMinOdo;
  const dayLabel=dayOnly(prevShift.startedAt);
  const plateHint=prevShift.vehiclePlate?` Авто: ${prevShift.vehiclePlate}.`:'';
  const lastHint=last!=null?` Последний одометр вчера: ${last}.`:'';
  if(!(state.messages||[]).length) state.messages=[];
  const already=(state.messages||[]).some(m=>/ещё открыта — одометр стоянки/i.test(String(m.text||'')));
  if(!already){
    add('driver','Открыть смену');
    add('bot',`Смена за ${dayLabel} ещё открыта — одометр стоянки не указан.${plateHint}${lastHint}\nВведите одометр сейчас: им закроем вчерашнюю смену и начнём сегодняшнюю ЕТО на той же машине.`);
  }
  state.error='';
  renderChat(); renderInput();
  return true;
}
function acceptClosePrevThenOpen(value){
  const id=state.draft&&state.draft.closePrevShiftId;
  const prev=(state.shifts||[]).find(s=>s && s.id===id);
  if(!prev || prev.endedAt){
    state.error='Вчерашняя смена уже закрыта. Откройте смену ещё раз.';
    state.orderStep='idle'; state.step='idle'; state.draft={};
    renderInput(); return;
  }
  const min=prev.lastOdometerPoint??prev.odometer??(state.draft&&state.draft.prevMinOdo);
  if(min!=null && value<+min){
    state.error=`Одометр не может быть меньше вчерашнего (${min})`;
    renderInput(); return;
  }
  add('driver',String(value));
  sealForgottenOpenShift(prev, value);
  syncVehicleOdometerFromShift(prev);
  const plate=prev.vehiclePlate||(state.draft&&state.draft.plate)||null;
  // Новая смена: тот же одометр = ЕТО до выезда
  state.shift={
    id:uuid(), startedAt:new Date().toISOString(), vehiclePlate:plate,
    odometer:value, lastOdometerPoint:value, etoOdometerSuggest:value,
    orders:[], messages:[], endedAt:null, parkingOdometer:null, completedAt:null,
    driverName:DRIVER
  };
  stampShiftOwner(state.shift, DRIVER, plate);
  state.messages=(state.messages||[]).slice();
  state.shift.messages=state.messages;
  state.orderStep='idle'; state.draft={}; state.error='';
  state.pendingClosePrevShiftId=null;
  const dayLabel=dayOnly(prev.startedAt);
  if(plate){
    state.step='fuel';
    add('bot',`Смена за ${dayLabel} закрыта (стоянка ${value}). Сегодняшняя открыта, авто ${plate}. Одометр ЕТО: ${value}.\nВведите остаток топлива в литрах.`);
  } else {
    state.step='chooseVehicle';
    add('bot',`Смена за ${dayLabel} закрыта (стоянка ${value}). Выберите автомобиль на сегодня — одометр ЕТО уже ${value}.`);
  }
  bumpDataEpoch('close-prev-open-new');
  upsertShift(); persist();
  clearTimeout(persistTimer);
  pushServerStateQueued().then(()=>{ syncStatus='ok'; }).catch(err=>{ syncStatus='error'; console.warn('PB close-prev', err); });
  renderChat(); renderInput();
}
function healDuplicateOpenShifts(keep){
  if(!keep) return;
  const keepScore=etoProgressScore(keep);
  const keepDay=localDayKey(keep.startedAt);
  (state.shifts||[]).forEach(s=>{
    if(s.id===keep.id || s.endedAt) return;
    if(keep.driverName && s.driverName && !samePersonName(s.driverName, keep.driverName)) return;
    if(!keep.driverName || !s.driverName) return;
    if(keep.ownCompanyId && s.ownCompanyId && s.ownCompanyId!==keep.ownCompanyId) return;
    const sDay=localDayKey(s.startedAt);
    // Смена прошлого дня при более новой — одометр ЕТО только если та же машина
    if(sDay && keepDay && sDay<keepDay){
      if(!shiftHasBlockingOpenOrder(s)){
        const sameCar=keep.vehiclePlate && s.vehiclePlate && sameVehiclePlate(keep.vehiclePlate, s.vehiclePlate);
        if(sameCar){
          const park=keep.odometer??keep.lastOdometerPoint??keep.parkingOdometer;
          sealForgottenOpenShift(s, park);
          syncVehicleOdometerFromShift(s);
        }
        // другая машина — не подставляем чужой одометр
      }
      return;
    }
    // Не трогаем смену с большим прогрессом ЕТО
    if(etoProgressScore(s)>keepScore) return;
    // Пустой незавершённый дубль — abandoned
    if(!isEtoDone(s) && !(s.orders||[]).length){
      s.endedAt=new Date().toISOString();
      s.abandoned=true;
      return;
    }
    // Два «живых» дубля одного дня — оставляем keep, второй закрываем
    if(sDay && keepDay && sDay===keepDay && !shiftHasBlockingOpenOrder(s)){
      sealForgottenOpenShift(s);
    }
  });
}
function etoProgressScore(s){
  if(!s) return 0;
  let n=0;
  if(s.vehiclePlate) n++;
  if(s.odometer!=null) n++;
  if(s.fuelLiters!=null) n++;
  if(s.gur||s.powerSteeringLevel) n++;
  if(s.coolant||s.coolantLevel) n++;
  const L=s.light||{};
  if(L.lowBeam&&L.brake&&L.turn) n++;
  if(s.oil||s.engineOilLevel) n++;
  if(s.completedAt) n+=2;
  if(isEtoDone(s)) n+=5;
  return n;
}
/** Слить заказы двух копий смены — ничего не выбрасываем. */
function mergeShiftOrders(cur, ls){
  if(!cur||!ls) return false;
  let changed=false;
  if(!Array.isArray(cur.orders)) cur.orders=[];
  const byId=new Map(cur.orders.map(o=>[o.id,o]));
  (ls.orders||[]).forEach(lo=>{
    if(!lo||!lo.id) return;
    const existing=byId.get(lo.id);
    if(!existing){
      cur.orders.push(lo);
      byId.set(lo.id, lo);
      changed=true;
      return;
    }
    if(orderProgressScore(lo)>orderProgressScore(existing)){
      Object.assign(existing, lo);
      changed=true;
    } else if(mergeOrderFields(existing, lo)){
      changed=true;
    }
  });
  return changed;
}
/** Слить чат смены: не терять пузыри при sync. */
function mergeShiftMessages(cur, ls){
  if(!cur||!ls) return false;
  const a=Array.isArray(cur.messages)?cur.messages.slice():[];
  const b=Array.isArray(ls.messages)?ls.messages.slice():[];
  if(!b.length) return false;
  if(!a.length){ cur.messages=b; return true; }
  const key=m=>`${m&&m.author}|${String(m&&m.text||'').slice(0,120)}`;
  const base=a.length>=b.length?a:b;
  const other=a.length>=b.length?b:a;
  const seen=new Set(base.map(key));
  const out=base.slice();
  let added=false;
  other.forEach(m=>{
    if(!m) return;
    const k=key(m);
    if(seen.has(k)) return;
    out.push(m);
    seen.add(k);
    added=true;
  });
  const prevLen=(cur.messages||[]).length;
  if(added || out.length!==prevLen){
    cur.messages=out;
    return true;
  }
  return false;
}
/** Подобрать смену для заказа: тот же водитель/авто/день. */
function findShiftForOrder(order){
  if(!order) return null;
  const orderDay=localDayKey(order.createdAt||order.arrivedAt||order.closedAt||order.endAt);
  const list=(state.shifts||[]).filter(s=>{
    if(!s||s.abandoned) return false;
    if(order.driverName && s.driverName && !samePersonName(order.driverName, s.driverName)) return false;
    if(order.vehiclePlate && s.vehiclePlate && !sameVehiclePlate(order.vehiclePlate, s.vehiclePlate)) return false;
    const sDay=localDayKey(s.startedAt);
    if(orderDay && sDay && orderDay===sDay) return true;
    if(!s.endedAt && sDay && orderDay && sDay<=orderDay) return true;
    return false;
  }).sort((a,b)=>{
    const aExact=(localDayKey(a.startedAt)===orderDay)?1:0;
    const bExact=(localDayKey(b.startedAt)===orderDay)?1:0;
    if(bExact!==aExact) return bExact-aExact;
    const aOpen=a.endedAt?0:1, bOpen=b.endedAt?0:1;
    if(bOpen!==aOpen) return bOpen-aOpen;
    return new Date(b.startedAt)-new Date(a.startedAt);
  });
  return list[0]||null;
}
/**
 * Заказы, которые есть в общем списке, но выпали из смены —
 * вернуть в смену и отметить в чате (чтобы карточка и чат не расходились).
 */
function healOrphanOrdersIntoShifts(){
  let changed=false;
  const linked=new Set();
  (state.shifts||[]).forEach(s=>{
    (s.orders||[]).forEach(o=>{ if(o&&o.id) linked.add(o.id); });
  });
  const dead=deletedOrderIdSet();
  (state.orders||[]).forEach(o=>{
    if(!o||!o.id||o.cancelledAt||dead.has(o.id)||linked.has(o.id)) return;
    const host=findShiftForOrder(o);
    if(!host) return;
    host.orders=host.orders||[];
    host.orders.push(o);
    linked.add(o.id);
    changed=true;
    const msgs=host.messages||[];
    const n=o.sequentialNumber;
    const noted=msgs.some(m=>{
      const t=String(m.text||'');
      return (n!=null && (t.includes(`порядковый номер - ${n}`) || t.includes(`Заказ №${n}`) || t.includes(`№${n} `)))
        || t.includes('восстановлен в смене');
    });
    if(!noted){
      const route=(typeof routeText==='function')?routeText(o):((o.loading||'')+' → '+(o.unloading||''));
      const status=o.closedAt
        ? `закрыт ${typeof dateTime==='function'?dateTime(o.closedAt):o.closedAt}`
        : `в смене с ${typeof dateTime==='function'?dateTime(o.createdAt):o.createdAt}`;
      host.messages=msgs.concat([{
        author:'bot',
        text:`Заказ №${n||'—'}: ${status} (восстановлен в смене после синка).\nМаршрут: ${route||'—'}`
      }]);
    }
  });
  // Канонические ссылки: shift.orders → объекты из state.orders
  const byId=new Map((state.orders||[]).map(o=>[o.id,o]));
  (state.shifts||[]).forEach(s=>{
    if(!Array.isArray(s.orders)||!s.orders.length) return;
    const next=s.orders.map(o=>{
      if(!o||!o.id||dead.has(o.id)) return null;
      return byId.get(o.id)||o;
    }).filter(Boolean);
    if(next.length!==s.orders.length || next.some((o,i)=>o!==s.orders[i])){
      s.orders=next;
      changed=true;
    }
  });
  return changed;
}
/** После sync remote_ahead — не потерять локальные смены, заказы и чат. */
function mergeLocalShifts(localShifts){
  if(!Array.isArray(localShifts)||!localShifts.length) return false;
  let changed=false;
  const byId=new Map((state.shifts||[]).map(s=>[s.id,s]));
  localShifts.forEach(ls=>{
    if(!ls||!ls.id) return;
    const cur=byId.get(ls.id);
    if(!cur){
      state.shifts=(state.shifts||[]);
      state.shifts.unshift(ls);
      byId.set(ls.id, ls);
      changed=true;
      return;
    }
    // Никогда не откатываем пройденный ЕТО локальной «дырявой» копией
    const localWeakerEto=isEtoDone(cur) && !isEtoDone(ls);
    const localWeakerFields=etoFieldsComplete(cur) && !etoFieldsComplete(ls);
    // Локально закрытая смена важнее «открытой» копии с сервера
    if(ls.endedAt && !cur.endedAt){
      const keepOrders=cur.orders, keepMsgs=cur.messages;
      Object.assign(cur, ls);
      cur.orders=keepOrders||[];
      cur.messages=keepMsgs||[];
      if(mergeShiftOrders(cur, ls)) {}
      if(mergeShiftMessages(cur, ls)) {}
      changed=true;
      return;
    }
    // Не открывать снова уже закрытую смену локальной открытой копией
    if(cur.endedAt && !ls.endedAt){
      if(cur.abandoned && (isEtoDone(ls) || etoProgressScore(ls)>etoProgressScore(cur))){
        const keepOrders=cur.orders, keepMsgs=cur.messages;
        Object.assign(cur, ls);
        cur.abandoned=false;
        cur.endedAt=null;
        cur.orders=keepOrders||[];
        cur.messages=keepMsgs||[];
        mergeShiftOrders(cur, ls);
        mergeShiftMessages(cur, ls);
        changed=true;
      } else {
        // даже если не открываем — забрать заказы/чат с локальной копии
        if(mergeShiftOrders(cur, ls)) changed=true;
        if(mergeShiftMessages(cur, ls)) changed=true;
      }
      return;
    }
    // Поля ЕТО с более полной стороны (без слепого Object.assign — он сносил orders/messages)
    if(!localWeakerEto && !localWeakerFields){
      if(etoProgressScore(ls)>etoProgressScore(cur) || (!!ls.completedAt && !cur.completedAt)){
        ['vehiclePlate','odometer','fuelLiters','gur','coolant','oil','light','completedAt',
          'powerSteeringLevel','coolantLevel','engineOilLevel','fuelRemainingLiters',
          'lastOdometerPoint','parkingOdometer','driverName','ownCompanyId','ownCompanyName',
          'ownerAdminId','ownerAdminName','spaceId','lockEto'].forEach(k=>{
          if(ls[k]!=null && ls[k]!=='') cur[k]=ls[k];
        });
        changed=true;
      } else {
        ['lastOdometerPoint','parkingOdometer','vehiclePlate'].forEach(k=>{
          if((cur[k]==null||cur[k]==='') && ls[k]!=null && ls[k]!==''){ cur[k]=ls[k]; changed=true; }
        });
      }
    }
    // Заказы и чат — всегда в обе стороны, ничего не отваливается
    if(mergeShiftOrders(cur, ls)) changed=true;
    if(mergeShiftMessages(cur, ls)) changed=true;
  });
  if(healOrphanOrdersIntoShifts()) changed=true;
  return changed;
}
/** Полнота заказа для merge: закрытый с одометрами всегда выше «открытой дырки». */
function orderProgressScore(o){
  if(!o) return 0;
  let n=0;
  if(o.departOdometer!=null) n+=2;
  if(o.startOdometer!=null) n+=3;
  if(o.endOdometer!=null) n+=4;
  if(o.loadedKm!=null) n+=2;
  if(o.emptyKmBefore!=null) n+=1;
  if(o.emptyKmAfter!=null) n+=1;
  if(o.departAt) n+=1;
  if(o.arrivedAt) n+=1;
  if(o.endAt) n+=1;
  if(o.parkingAt) n+=1;
  if(o.closedAt || looksClosedOrder(o)) n+=6;
  return n;
}
/** Слить поля: не затирать заполненное пустым; время/закрытие — от более полной копии. */
function mergeOrderFields(cur, lo){
  if(!cur||!lo) return false;
  let changed=false;
  const prefer=[
    'departOdometer','startOdometer','endOdometer','previousOdometer',
    'emptyKmBefore','loadedKm','emptyKmAfter',
    'departAt','arrivedAt','endAt','parkingAt','closedAt',
    'timeToOrderMin','timeLoadedMin','timeToParkingMin','timeTotalMin',
    'timeToOrderHours','timeLoadedHours','timeToParkingHours','timeTotalHours',
    'fuelPricePerLiter','fuelLiters','fuelTotalCost','fuelRemainingLiters',
    'rateCash','rateWithVat','rateWithoutVat','freight','paymentForm','workHours',
    'loading','unloading','loadingAddress','unloadingAddress','customer'
  ];
  prefer.forEach(k=>{
    const a=cur[k], b=lo[k];
    if(b==null||b==='') return;
    if(a==null||a===''){ cur[k]=b; changed=true; return; }
  });
  // Если локальная копия явно полнее — забираем недостающие метки времени/закрытия
  if(orderProgressScore(lo)>orderProgressScore(cur)){
    prefer.forEach(k=>{
      if(lo[k]!=null && lo[k]!=='' && cur[k]!==lo[k]){ cur[k]=lo[k]; changed=true; }
    });
  } else if(looksClosedOrder(lo) && !looksClosedOrder(cur)){
    ['endOdometer','loadedKm','emptyKmAfter','closedAt','endAt','parkingAt'].forEach(k=>{
      if(lo[k]!=null && lo[k]!==''){ cur[k]=lo[k]; changed=true; }
    });
  }
  return changed;
}
/** Не потерять локальные открытые/в-пути заказы при remote_ahead. */
function mergeLocalOrders(localOrders){
  if(!Array.isArray(localOrders)||!localOrders.length) return false;
  let changed=false;
  const byId=new Map((state.orders||[]).map(o=>[o.id,o]));
  const dead=deletedOrderIdSet();
  localOrders.forEach(lo=>{
    if(!lo||!lo.id||lo.cancelledAt) return;
    if(dead.has(lo.id)) return; // удалённый заказ не воскрешаем из localStorage
    const cur=byId.get(lo.id);
    if(!cur){
      // Подтягиваем только живые/недавно закрытые локальные заказы
      if(!lo.closedAt || orderProgressScore(lo)>=3){
        state.orders=(state.orders||[]);
        state.orders.unshift(lo);
        byId.set(lo.id, lo);
        changed=true;
      }
      return;
    }
    if(mergeOrderFields(cur, lo)) changed=true;
  });
  return changed;
}
/** Восстановить поля ЕТО из истории чата (если sync затёр поля, но сообщения остались). */
function hydrateEtoFromMessages(shift){
  if(!shift || !Array.isArray(shift.messages) || !shift.messages.length) return false;
  let changed=false;
  const msgs=shift.messages;
  const fluidRe=new RegExp('^(ГУР|ОЖ|Масло ДВС):\\s*(' + FLUIDS.join('|') + ')\\s*$');
  const setIf=(key, val)=>{
    if(val==null || val==='') return;
    if(shift[key]==null || shift[key]===''){ shift[key]=val; changed=true; }
  };
  // Авто из ответа бота / пузыря водителя
  if(!shift.vehiclePlate){
    for(const m of msgs){
      const t=String(m.text||'');
      const bot=t.match(/госномером\s+([A-ZА-ЯЁ0-9\s]+)/i) || t.match(/гос\.?\s*номером\s+([A-ZА-ЯЁ0-9\s]+)/i);
      if(bot){ setIf('vehiclePlate', bot[1].replace(/\s+/g,' ').trim()); break; }
    }
  }
  // Одометр / топливо / жидкости из ответов водителя по порядку шагов
  let expect='vehicle';
  for(const m of msgs){
    const t=String(m.text||'').trim();
    if(m.author==='bot'){
      if(/одометр/i.test(t) && /стоянк/i.test(t)) expect='odometer';
      else if(/остаток топлива/i.test(t)) expect='fuel';
      else if(/уровен[ья].*ГУР|жидкост[иь] ГУР/i.test(t)) expect='gur';
      else if(/уровен[ья].*ОЖ|укажите уровень ОЖ/i.test(t)) expect='coolant';
      else if(/осветительн/i.test(t)) expect='lights';
      else if(/масла в ДВС|уровень масла/i.test(t)) expect='oil';
      else if(/Спасибо за прохождение ЕТО/i.test(t)){
        if(!shift.completedAt && (shift.oil||shift.engineOilLevel)){
          shift.completedAt=shift.startedAt||new Date().toISOString();
          changed=true;
        }
      }
      continue;
    }
    if(m.author!=='driver') continue;
    const fluid=t.match(fluidRe);
    if(fluid){
      const kind=fluid[1], level=fluid[2];
      if(kind==='ГУР'){ setIf('gur', level); setIf('powerSteeringLevel', level); }
      else if(kind==='ОЖ'){ setIf('coolant', level); setIf('coolantLevel', level); }
      else if(kind==='Масло ДВС'){ setIf('oil', level); setIf('engineOilLevel', level); }
      continue;
    }
    if(/^Ближний свет:/i.test(t)){
      const low=(t.match(/Ближний свет:\s*(Да|Нет)/i)||[])[1];
      const brake=(t.match(/Стоп-сигналы:\s*(Да|Нет)/i)||[])[1];
      const turn=(t.match(/Указатели поворотов:\s*(Да|Нет)/i)||[])[1];
      if(low&&brake&&turn){
        shift.light=Object.assign({}, shift.light||{}, {lowBeam:low, brake, turn});
        changed=true;
      }
      continue;
    }
    if(expect==='odometer' && /^\d{4,7}$/.test(t) && shift.odometer==null){
      shift.odometer=+t; shift.lastOdometerPoint=+t; changed=true; expect='fuel';
    } else if(expect==='fuel'){
      const fl=t.match(/^(\d+(?:[.,]\d+)?)\s*л?$/i);
      if(fl && shift.fuelLiters==null){
        shift.fuelLiters=+String(fl[1]).replace(',','.');
        if(shift.fuelRemainingLiters==null) shift.fuelRemainingLiters=shift.fuelLiters;
        changed=true; expect='gur';
      }
    } else if(expect==='vehicle' && !shift.vehiclePlate && /[A-ZА-ЯЁ]\s*\d{3}\s*[A-ZА-ЯЁ]{2}\s*\d{2,3}/i.test(t)){
      setIf('vehiclePlate', t.replace(/\s+/g,' ').trim());
    }
  }
  // Если все пункты есть в сообщениях, но completedAt нет — выставим
  if(!shift.completedAt && shift.vehiclePlate && shift.odometer!=null && shift.fuelLiters!=null
    && (shift.gur||shift.powerSteeringLevel) && (shift.coolant||shift.coolantLevel)
    && (shift.oil||shift.engineOilLevel)){
    const L=shift.light||{};
    if(L.lowBeam&&L.brake&&L.turn){
      shift.completedAt=shift.startedAt||new Date().toISOString();
      changed=true;
    }
  }
  return changed;
}
function migrateEtoFromMessages(){
  let changed=false;
  (state.shifts||[]).forEach(s=>{
    if(!s || s.endedAt) return;
    if(hydrateEtoFromMessages(s)) changed=true;
  });
  if(state.shift && !state.shift.endedAt){
    if(hydrateEtoFromMessages(state.shift)) changed=true;
  }
  return changed;
}
function syncOpenShiftRuntime(){
  // Без стоянки вчерашнюю не закрываем сами — ждём одометр с утреннего ЕТО
  if(DRIVER && sealPreviousDayOpenShiftsForDriver(DRIVER, {allowGuessOdo:false})){
    bumpDataEpoch('seal-prev-day-shift');
    if(state.shift && state.shift.endedAt) state.shift=null;
    persist();
  }
  // Если уже идём по «закрыть вчера → открыть сегодня» — не переключаем смену
  if(state.orderStep==='closePrevShiftParking') return state.shift||null;
  let shift=findOpenShift();
  if(!shift && state.shift && !state.shift.endedAt) shift=state.shift;
  if(!shift) return null;
  // Вчерашняя на той же машине без активного заказа → закрыть утренним одометром
  if(DRIVER && shift && !shift.endedAt && shift.vehiclePlate){
    const today=localDayKey(new Date());
    const day=localDayKey(shift.startedAt);
    if(day && day<today && !shiftHasBlockingOpenOrder(shift)){
      beginClosePrevAndOpenNew(shift);
      return null;
    }
  }
  if(state.shift && state.shift.id===shift.id){
    const live=state.shift;
    ['completedAt','oil','engineOilLevel','gur','coolant','vehiclePlate','light','powerSteeringLevel','coolantLevel'].forEach(k=>{
      if(live[k]!=null && shift[k]==null) shift[k]=live[k];
    });
    if(live.odometer!=null && shift.odometer==null) shift.odometer=live.odometer;
    if(live.fuelLiters!=null && shift.fuelLiters==null) shift.fuelLiters=live.fuelLiters;
    if(live.lastOdometerPoint!=null) shift.lastOdometerPoint=live.lastOdometerPoint;
    state.shift=live;
  } else if(state.shift && !state.shift.endedAt && isEtoDone(state.shift) && !isEtoDone(shift)){
    // Не затираем живую смену с пройденным ЕТО «пустой» из списка
    shift=state.shift;
  } else {
    state.shift=shift;
  }
  invalidateStaleEto(state.shift);
  if(isEtoDone(state.shift)){
    state.step='done';
    if(!state.shift.completedAt) state.shift.completedAt=new Date().toISOString();
  } else if(state.step==='done'){
    state.step=state.shift.vehiclePlate?'odometer':'chooseVehicle';
  }
  healDuplicateOpenShifts(state.shift);
  armExitGuard();
  return state.shift;
}
function dayTotal(o){ if(o.emptyKmBefore==null && o.loadedKm==null && o.emptyKmAfter==null) return null; return (o.emptyKmBefore||0)+(o.loadedKm||0)+(o.emptyKmAfter||0); }
/** Минуты между ISO-метками; null если нет данных. */
function minutesBetween(fromIso, toIso){
  if(!fromIso || !toIso) return null;
  const a=new Date(fromIso).getTime(), b=new Date(toIso).getTime();
  if(Number.isNaN(a)||Number.isNaN(b)||b<a) return null;
  return Math.round((b-a)/60000);
}
function hoursFromMinutes(min){
  if(min==null) return null;
  return round2(min/60);
}
/** «1 ч 25 мин» / «45 мин» / «2 ч» */
function formatDurationMin(min){
  if(min==null || min<0) return '—';
  const h=Math.floor(min/60), m=min%60;
  if(h<=0) return `${m} мин`;
  if(m===0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}
/**
 * Времена по заказу:
 * — до заказа: выезд → прибытие на загрузку
 * — с грузом: загрузка → окончание перевозки
 * — до стоянки: окончание → стоянка
 * — всего: выезд (или загрузка) → стоянка (или окончание)
 */
function recomputeOrderTimes(o){
  if(!o) return o;
  o.timeToOrderMin=minutesBetween(o.departAt, o.arrivedAt);
  o.timeLoadedMin=minutesBetween(o.arrivedAt, o.endAt);
  o.timeToParkingMin=minutesBetween(o.endAt, o.parkingAt);
  const start=o.departAt||o.arrivedAt||null;
  const end=o.parkingAt||o.endAt||o.closedAt||null;
  o.timeTotalMin=minutesBetween(start, end);
  o.timeToOrderHours=hoursFromMinutes(o.timeToOrderMin);
  o.timeLoadedHours=hoursFromMinutes(o.timeLoadedMin);
  o.timeToParkingHours=hoursFromMinutes(o.timeToParkingMin);
  o.timeTotalHours=hoursFromMinutes(o.timeTotalMin);
  return o;
}
function orderTimesLines(o){
  if(!o) return '';
  recomputeOrderTimes(o);
  // Всегда показываем в карточке — иначе кажется, что времени нет
  return `<div class="schedule-box">
    <strong>Время на заказ</strong><br>
    до заказа: <b>${esc(formatDurationMin(o.timeToOrderMin))}</b>
    · с грузом: <b>${esc(formatDurationMin(o.timeLoadedMin))}</b>
    · до стоянки: <b>${esc(formatDurationMin(o.timeToParkingMin))}</b>
    · <b>всего: ${esc(formatDurationMin(o.timeTotalMin))}</b>
  </div>`;
}
function orderTimesText(o){
  if(!o) return '';
  recomputeOrderTimes(o);
  return `Время: до заказа ${formatDurationMin(o.timeToOrderMin)} · с грузом ${formatDurationMin(o.timeLoadedMin)} · до стоянки ${formatDurationMin(o.timeToParkingMin)} · всего ${formatDurationMin(o.timeTotalMin)}`;
}
/** Восстановить закрытие/одометры, если sync стёр closedAt, но км остались. */
function healOrderCloseState(o){
  if(!o||o.cancelledAt) return false;
  let changed=false;
  if(o.loadedKm!=null && o.startOdometer!=null && o.endOdometer==null){
    o.endOdometer=o.startOdometer+o.loadedKm;
    changed=true;
  }
  if(o.endOdometer!=null && o.startOdometer!=null && o.loadedKm==null){
    o.loadedKm=Math.max(0, o.endOdometer-o.startOdometer);
    changed=true;
  }
  if(looksClosedOrder(o) && !o.closedAt){
    o.closedAt=o.parkingAt||o.endAt||o.arrivedAt||o.createdAt||new Date().toISOString();
    changed=true;
  }
  return changed;
}
/** Добиваем метки на старых заказах, где одометр уже есть, а ISO-времени нет. */
function ensureOrderTimeStamps(o){
  if(!o) return o;
  healOrderCloseState(o);
  if(o.departOdometer!=null && !o.departAt) o.departAt=o.createdAt||null;
  if(o.startOdometer!=null && !o.arrivedAt) o.arrivedAt=o.departAt||o.createdAt||null;
  if(o.endOdometer!=null && !o.endAt) o.endAt=o.closedAt||null;
  if(o.emptyKmAfter!=null && o.endOdometer!=null && !o.parkingAt && o.closedAt) o.parkingAt=o.closedAt;
  recomputeOrderTimes(o);
  return o;
}
/** Подтянуть end/close из чата смены («Заказ №N закрыт», «Одометр окончания»). */
function hydrateOrdersFromMessages(){
  let changed=false;
  const bySeq=new Map();
  (state.orders||[]).forEach(o=>{ if(o&&o.sequentialNumber!=null) bySeq.set(+o.sequentialNumber, o); });
  (state.shifts||[]).forEach(s=>{
    (s.orders||[]).forEach(o=>{
      if(!o||o.sequentialNumber==null) return;
      const cur=bySeq.get(+o.sequentialNumber);
      if(!cur){ bySeq.set(+o.sequentialNumber, o); return; }
      if(mergeOrderFields(cur, o)) changed=true;
      if(mergeOrderFields(o, cur)) changed=true;
    });
    const msgs=s.messages||[];
    for(let i=0;i<msgs.length;i++){
      const t=String(msgs[i].text||'');
      const closed=t.match(/Заказ №\s*(\d+)\s*закрыт[\s\S]*?Одометр окончания:\s*(\d+)/i)
        || t.match(/Заказ №\s*(\d+)\s*закрыт/i);
      if(!closed) continue;
      const seq=+closed[1];
      const o=bySeq.get(seq);
      if(!o) continue;
      let endOdo=closed[2]?+closed[2]:null;
      if(endOdo==null){
        const m=t.match(/Одометр окончания:\s*(\d+)/i);
        if(m) endOdo=+m[1];
      }
      const at=msgs[i].at||null;
      if(endOdo!=null && o.endOdometer==null){ o.endOdometer=endOdo; changed=true; }
      if(endOdo!=null && o.startOdometer!=null && o.loadedKm==null){
        o.loadedKm=Math.max(0, endOdo-o.startOdometer); changed=true;
      }
      if(!o.closedAt){ o.closedAt=at||o.parkingAt||o.endAt||new Date().toISOString(); changed=true; }
      if(!o.endAt){ o.endAt=at||o.closedAt; changed=true; }
      // одометр стоянки — сообщение водителя перед «закрыт» или сразу после вопроса про стоянку
      if(o.emptyKmAfter==null && o.endOdometer!=null){
        for(let j=i-1;j>=Math.max(0,i-6);j--){
          if(msgs[j].author!=='driver') continue;
          const park=String(msgs[j].text||'').replace(/\D/g,'');
          if(park && +park>=o.endOdometer){
            o.emptyKmAfter=Math.max(0, +park-o.endOdometer);
            if(!o.parkingAt) o.parkingAt=msgs[j].at||o.closedAt;
            changed=true;
            break;
          }
        }
      } else if(o.emptyKmAfter!=null && !o.parkingAt){
        o.parkingAt=at||o.closedAt; changed=true;
      }
      ensureOrderTimeStamps(o);
    }
  });
  if(changed){
    (state.orders||[]).forEach(o=>ensureOrderTimeStamps(o));
    // выровнять копии в сменах
    const byId=new Map((state.orders||[]).map(o=>[o.id,o]));
    (state.shifts||[]).forEach(s=>{
      (s.orders||[]).forEach((o,idx)=>{
        const live=byId.get(o.id);
        if(live) s.orders[idx]=live;
      });
    });
  }
  return changed;
}
/** Шаги самосоздания / прибытия — не держать, если заказа уже нет. */
function isCreateFlowStep(os){
  return ['chooseVehicle','arrivalOdometer','dayNumber','loading','unloading','startAssignedOdometer'].includes(os||'');
}
function isAssignedFlowStep(os){
  return os==='arriveAssignedOdometer' || os==='departAssignedOdometer';
}
function draftHasCreateProgress(d){
  if(!d || typeof d!=='object') return false;
  return d.dayNumber!=null || !!(d.loading||d.load||d.loadingAddress)
    || !!(d.unloading||d.unload||d.unloadingAddress)
    || d.arrivalOdo!=null || d.startOdometer!=null || d.arrivalOdometer!=null;
}
/** Сброс залипшего orderStep после синка (закрытый заказ / пустой draft). */
function healStuckOrderSteps(){
  let changed=false;
  (state.shifts||[]).forEach(s=>{
    if(!s || s.endedAt) return;
    const step=s.orderStep||'idle';
    if(!step || step==='idle') return;
    if(step==='closingEmptyAfter' || step==='askRefuel' || /^postClose|^closeShift|^closePrev/.test(step)) return;
    const driver=s.driverName||'';
    const open=(state.orders||[]).find(o=>!looksClosedOrder(o) && !o.cancelledAt && o.startOdometer!=null && samePersonName(o.driverName||'', driver));
    const enRoute=(state.orders||[]).find(o=>!looksClosedOrder(o) && !o.cancelledAt && o.departOdometer!=null && o.startOdometer==null && samePersonName(o.driverName||'', driver));
    if(isAssignedFlowStep(step)){
      if(enRoute) return;
      if(step==='departAssignedOdometer'){
        const pending=(state.orders||[]).some(o=>!looksClosedOrder(o) && !o.cancelledAt && o.startOdometer==null && o.departOdometer==null && !o.onExchange && samePersonName(o.driverName||'', driver));
        if(pending) return;
      }
      s.orderStep='idle'; s.draft={}; changed=true;
      return;
    }
    if(!isCreateFlowStep(step)) return;
    if(open || enRoute) return;
    if(draftHasCreateProgress(s.draft)) return;
    // Пустой/почти пустой draft + нет открытого заказа: смотрим, не перебил ли sync закрытым заказом
    const msgs=s.messages||[];
    let sawCreate=false, sawClosedAfter=false;
    for(const m of msgs){
      const t=String(m.text||'');
      if(/Заказ на авто|одометр по прибытию на загрузку|Укажите номер заказа за день|адрес загрузки/i.test(t)) sawCreate=true;
      if(sawCreate && (/закрыт \(восстановлен|Заказ №\d+: закрыт/i.test(t) || (m.author==='bot' && /восстановлен в смене/i.test(t)))){
        sawClosedAfter=true;
      }
    }
    if(sawClosedAfter || step==='arrivalOdometer'){
      // arrivalOdometer без прогресса и без живого заказа — безопасно сбросить (можно снова «Создать заказ»)
      s.orderStep='idle';
      s.draft={};
      changed=true;
    }
  });
  return changed;
}
/** Дожать зависшее закрытие: есть closeOdo в draft смены, заказ ещё «в работе». */
function healStuckClosing(){
  let changed=false;
  (state.shifts||[]).forEach(s=>{
    if(!s||s.endedAt) return;
    const d=s.draft||{};
    const step=s.orderStep||'';
    // Только зависший шаг «после заправки / до стоянки» — не трогаем активный ввод одометра/заправки
    if(step!=='closingEmptyAfter') return;
    if(d.closeOdo==null) return;
    const id=d.closingOrderId;
    let o=id?(state.orders||[]).find(x=>x.id===id):null;
    if(!o){
      o=(state.orders||[])
        .filter(x=>!looksClosedOrder(x) && !x.cancelledAt && x.startOdometer!=null && samePersonName(x.driverName||'', s.driverName||''))
        .sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))[0];
    }
    if(!o || looksClosedOrder(o)){
      if(step==='closingEmptyAfter'||step==='askRefuel'){
        s.orderStep='idle'; s.draft={}; changed=true;
      }
      return;
    }
    const end=+d.closeOdo;
    if(!(end>=o.startOdometer)) return;
    const now=d.endAt||d.parkingAt||new Date().toISOString();
    o.endOdometer=end;
    o.loadedKm=end-o.startOdometer;
    o.closedAt=now;
    o.endAt=d.endAt||now;
    o.parkingAt=d.parkingAt||now;
    o.emptyKmAfter=(d.parkingAfterOdo!=null && d.parkingAfterOdo>=end)?Math.max(0,d.parkingAfterOdo-end):0;
    o.refueled=!!d.closeRefueled;
    if(!o.refueled){
      o.fuelLiters=null;
      o.fuelPricePerLiter=(d.fuelPrice!=null && d.fuelPrice>0)?d.fuelPrice:resolveFuelPriceWithoutRefuel(o.vehiclePlate, o.id);
    }
    ensureOrderTimeStamps(o);
    applyClientTariff(o);
    if(typeof onOrderClosedBilling==='function') onOrderClosedBilling(o);
    s.orderStep='idle';
    s.draft={};
    s.lastOdometerPoint=end;
    changed=true;
  });
  if(changed){
    const byId=new Map((state.orders||[]).map(o=>[o.id,o]));
    (state.shifts||[]).forEach(s=>{
      (s.orders||[]).forEach((o,idx)=>{ const live=byId.get(o.id); if(live) s.orders[idx]=live; });
    });
  }
  return changed;
}
function healAllOrders(){
  let changed=false;
  if(purgeDeadOrdersEverywhere()) changed=true;
  if(healStuckClosing()) changed=true;
  if(healStuckOrderSteps()) changed=true;
  if(hydrateOrdersFromMessages()) changed=true;
  (state.orders||[]).forEach(o=>{ if(healOrderCloseState(o)) changed=true; ensureOrderTimeStamps(o); });
  (state.shifts||[]).forEach(s=>{
    (s.orders||[]).forEach(o=>{ if(healOrderCloseState(o)) changed=true; ensureOrderTimeStamps(o); });
  });
  if(compactSequentialNumbers()) changed=true;
  return changed;
}
function kmParkingToEnd(o){
  if(o.endOdometer!=null && o.previousOdometer!=null) return Math.max(0, o.endOdometer-o.previousOdometer);
  if(o.emptyKmBefore!=null || o.loadedKm!=null) return (o.emptyKmBefore||0)+(o.loadedKm||0);
  return null;
}
/** Км для списания топлива: полная цепочка; зеркальный «после» (тот же путь, что «нулевой до» следующего) не дублируем. */
function tripKmForFuel(o){
  if(o && o.emptyAfterLinkedFromNext){
    const has=o.emptyKmBefore!=null||o.loadedKm!=null;
    if(has) return (o.emptyKmBefore||0)+(o.loadedKm||0);
    return kmParkingToEnd(o);
  }
  const total=dayTotal(o);
  if(total!=null) return total;
  return kmParkingToEnd(o);
}
/** Предыдущий закрытый заказ, ждущий «до стоянки» от следующего. */
function findOrderAwaitingEmptyAfterLink(nextOrder){
  if(!nextOrder) return null;
  const plate=nextOrder.vehiclePlate||'';
  const driver=nextOrder.driverName||DRIVER||'';
  const list=(state.orders||[])
    .filter(o=>o && o.closedAt && o.endOdometer!=null && o.linkEmptyAfterToNext
      && o.id!==nextOrder.id
      && (!plate || o.vehiclePlate===plate)
      && (!driver || samePersonName(o.driverName||'', driver)))
    .sort((a,b)=>new Date(b.closedAt)-new Date(a.closedAt));
  return list[0]||null;
}
/** «До стоянки» предыдущего = «нулевой до» нового (один и тот же путь между заказами). */
function linkEmptyAfterFromNextEmptyBefore(nextOrder){
  if(!nextOrder || nextOrder.emptyKmBefore==null) return null;
  const prev=findOrderAwaitingEmptyAfterLink(nextOrder);
  if(!prev) return null;
  prev.emptyKmAfter=Math.max(0, +nextOrder.emptyKmBefore||0);
  prev.emptyAfterLinkedFromNext=true;
  prev.linkEmptyAfterToNext=false;
  if(nextOrder.arrivedAt) prev.parkingAt=nextOrder.arrivedAt;
  else if(!prev.parkingAt) prev.parkingAt=new Date().toISOString();
  recomputeOrderTimes(prev);
  applyClientTariff(prev);
  bumpDataEpoch('link-empty-after');
  upsertOrder(prev);
  return prev;
}
/** Остаток до заказа: прошлый заказ по авто, иначе ЕТО смены. Не подставляем 80 л. */
function lastFuelRemainingLiters(plate, exceptId){
  const scored=allOrders()
    .filter(o=>o.id!==exceptId && o.fuelRemainingLiters!=null && +o.fuelRemainingLiters>=0 && (!plate||o.vehiclePlate===plate))
    .map(o=>({o, t:new Date(o.closedAt||o.createdAt).getTime()}))
    .sort((a,b)=>b.t-a.t);
  return scored.length?+scored[0].o.fuelRemainingLiters:null;
}
function resolveFuelRemainingBefore(plate, exceptId, shiftFuel){
  const prev=lastFuelRemainingLiters(plate, exceptId);
  if(prev!=null) return prev;
  if(shiftFuel!=null && +shiftFuel>=0) return +shiftFuel;
  return null;
}
/** Пересчитать остаток: до − расход [+ залито]. Без исходного остатка — null. */
function computeFuelRemainingAfter(before, tripKm, consPer100, refillLiters){
  if(before==null || !(before>=0)) return null;
  if(tripKm==null || !(consPer100>=0)) return null;
  const used=round2(tripKm*consPer100/100);
  const add=(refillLiters!=null && +refillLiters>0)?+refillLiters:0;
  return round2(Math.max(0, before-used+add));
}
function applyFuelRemainingOnClose(order, shift, refillLiters){
  // ЕТО fuelLiters — утренний остаток, не затираем. Текущий остаток — fuelRemainingLiters.
  const etoFuel=shift&&shift.fuelLiters!=null?shift.fuelLiters:null;
  const running=shift&&shift.fuelRemainingLiters!=null?shift.fuelRemainingLiters:etoFuel;
  const before=resolveFuelRemainingBefore(order.vehiclePlate, order.id, running);
  const km=tripKmForFuel(order);
  const cons=vehicle(order.vehiclePlate, order.ownCompanyId).consumptionPer100Km;
  const after=computeFuelRemainingAfter(before, km, cons, refillLiters);
  order.fuelRemainingLiters=(after!=null)?after:null;
  if(after!=null && shift) shift.fuelRemainingLiters=after;
  return {before, after, km, used:(before!=null && km!=null)?round2(km*cons/100):null};
}
/** Ставка для ЗП / подушки / прибыли — всегда наличные */
function selectedRate(o){
  if(o.rateCash!=null) return o.rateCash;
  return o.freight??null;
}
/** Ставка по форме клиента (документы) */
function clientRate(o){
  if(o.paymentForm==='withVat') return o.rateWithVat??selectedRate(o);
  if(o.paymentForm==='withoutVat') return o.rateWithoutVat??selectedRate(o);
  if(o.paymentForm==='cash') return o.rateCash??selectedRate(o);
  return selectedRate(o);
}
const VAT_MARKUP=0.22;   // с НДС = без НДС + 22%
const CASH_DISCOUNT=0.08; // нал = без НДС − 8%
function fillRatesFrom(form, amount){
  let without;
  if(form==='withoutVat') without=amount;
  else if(form==='withVat') without=amount/(1+VAT_MARKUP);
  else without=amount/(1-CASH_DISCOUNT);
  return {
    withVat: round2(without*(1+VAT_MARKUP)),
    withoutVat: round2(without),
    cash: round2(without*(1-CASH_DISCOUNT))
  };
}
function billableKm(o, estimateOverride){
  if(o.loadedKm!=null && +o.loadedKm>0) return +o.loadedKm;
  const est=estimateOverride!=null?estimateOverride:o.estimateKm;
  if(est!=null && +est>0) return +est;
  return null;
}
function emptyKmOf(o){ return (o.emptyKmBefore||0)+(o.emptyKmAfter||0); }
function totalOrderKm(o){
  const has=o.emptyKmBefore!=null||o.loadedKm!=null||o.emptyKmAfter!=null;
  if(has) return (o.emptyKmBefore||0)+(o.loadedKm||0)+(o.emptyKmAfter||0);
  if(o.estimateKm>0) return +o.estimateKm;
  return null;
}
/** Км в пакете: груз + нулевой после (до стоянки). Нулевой до заказа — через подачу. */
function packageKmOf(o){
  if(o.loadedKm!=null || o.emptyKmAfter!=null) return (o.loadedKm||0)+(o.emptyKmAfter||0);
  if(o.estimateKm>0) return +o.estimateKm;
  return 0;
}
function amountsFromPerKmCash(perKmCash, km){
  if(!(perKmCash>0) || !(km>0)) return null;
  return fillRatesFrom('cash', round2(perKmCash*km));
}
function overnightStorageCash(o){
  const rate=+o.overnightStorageRateCash;
  const nights=+o.overnightNights;
  if(!(rate>0) || !(nights>0)) return 0;
  return round2(rate*nights);
}
/** База ЗП/подушки: ставка нал минус ночное хранение (ответственность компании). */
function payrollRate(o){
  const rate=selectedRate(o);
  if(rate==null) return null;
  return round2(Math.max(0, rate-overnightStorageCash(o)));
}
function markStaysLoadedOvernight(o){
  o.staysLoadedOvernight=true;
  o.overnightNights=(o.overnightNights>0?+o.overnightNights:0)+1;
}
/**
 * Тариф клиенту:
 * — мин. N ч работы + 1 ч подачи (пакет = обычно 5 ч);
 * — нулевой до заказа: если > лимита км (20) ИЛИ его ₽ > стоимости 1 ч подачи → +ещё 1 ч подачи;
 * — в пакет входит M км (груз + нулевой после); свыше — ₽/км;
 * — часы/км сверх пакета плюсуем по факту; ночное хранение сверху.
 */
function calculateClientTariff(o, fin){
  const s=Object.assign({}, DEFAULT_FINANCE, fin||state.finance||{});
  const perKm=(o.ratePerKmCash>0?+o.ratePerKmCash:+s.defaultRatePerKmCash)||80;
  const perHour=(o.ratePerHourWork>0?+o.ratePerHourWork:+s.defaultRatePerHourWork)||0;
  const storageCash=overnightStorageCash(o);
  if(!(perKm>0||perHour>0||storageCash>0)) return null;
  const emptyBefore=o.emptyKmBefore||0;
  const packageKm=packageKmOf(o);
  const threshold=Math.max(1, s.cityKmThreshold||100);
  const minWork=Math.max(0, s.minWorkHours||0);
  const basePodacha=Math.max(0, s.podachaHours||1);
  const emptyKmLimit=Math.max(0, s.podachaEmptyKmLimit||20);
  const workEntered=o.workHours??o.estimateWorkHours??0;
  const workHoursCharged=perHour>0?Math.max(+workEntered||0, minWork):0;
  const workCash=round2(workHoursCharged*perHour);
  let podachaHoursCharged=0;
  let podachaCoveredByHour=true;
  let podachaExtraReason='';
  if(perHour>0 && basePodacha>0){
    const oneHourCash=round2(basePodacha*perHour);
    const emptyBeforeCost=round2(emptyBefore*perKm);
    const overKm=emptyBefore>emptyKmLimit;
    const overSum=emptyBefore>0 && emptyBeforeCost>oneHourCash;
    if(overKm || overSum){
      podachaHoursCharged=basePodacha*2;
      podachaCoveredByHour=false;
      if(overKm && overSum) podachaExtraReason=`нулевой до ${emptyBefore} км (>${emptyKmLimit} км и >1 ч подачи) → 2 ч`;
      else if(overKm) podachaExtraReason=`нулевой до ${emptyBefore} км > ${emptyKmLimit} км → 2 ч подачи`;
      else podachaExtraReason=`нулевой до ${emptyBefore} км (${fmt(emptyBeforeCost)} ₽) > 1 ч подачи → 2 ч`;
    } else {
      podachaHoursCharged=basePodacha;
      podachaCoveredByHour=true;
    }
  }
  const podachaHourCash=round2(podachaHoursCharged*perHour);
  const excessKm=packageKm>threshold?(packageKm-threshold):0;
  const excessKmCash=round2(excessKm*perKm);
  const totalCash=round2(workCash+podachaHourCash+excessKmCash+storageCash);
  if(!(totalCash>0)) return null;
  const parts=[];
  if(workCash>0) parts.push(`работа ${workHoursCharged} ч = ${fmt(workCash)} ₽`);
  if(podachaHourCash>0){
    parts.push(`подача ${podachaHoursCharged} ч = ${fmt(podachaHourCash)} ₽`);
    if(emptyBefore>0){
      parts.push(podachaCoveredByHour
        ? `нулевой до ${emptyBefore} км покрыт подачей (≤${emptyKmLimit} км)`
        : podachaExtraReason);
    }
  }
  if(packageKm>0){
    if(excessKmCash>0) parts.push(`сверх ${threshold} км: ${excessKm} км × ${fmt(perKm)} = ${fmt(excessKmCash)} ₽ (груз+после ${packageKm} км)`);
    else parts.push(`км в пакете: ${packageKm} ≤ ${threshold}`);
  }
  if(storageCash>0) parts.push(`хранение ${o.overnightNights}×${fmt(o.overnightStorageRateCash)} = ${fmt(storageCash)} ₽`);
  const modeLabel=(perHour>0||perKm>0)?'пакет':'хранение';
  return {
    totalCash, storageCash, isCity:packageKm>0 && packageKm<=threshold,
    packageKm, excessKm, podachaHoursCharged, podachaCoveredByHour,
    summary:`[${modeLabel}] ${parts.join(' + ')||'—'}`
  };
}
function applyClientTariff(o){
  const b=calculateClientTariff(o, financeForOrder(o));
  if(!b) return applyPerKmCash(o);
  const t=fillRatesFrom('cash', b.totalCash);
  o.rateCash=t.cash; o.rateWithoutVat=t.withoutVat; o.rateWithVat=t.withVat;
  if(!o.paymentForm) o.paymentForm='cash';
  o.freight=selectedRate(o);
  return true;
}
function applyPerKmCash(o){
  const per=+o.ratePerKmCash;
  const km=billableKm(o);
  const t=amountsFromPerKmCash(per, km);
  if(!t) return false;
  o.rateCash=t.cash; o.rateWithoutVat=t.withoutVat; o.rateWithVat=t.withVat;
  if(!o.paymentForm) o.paymentForm='cash';
  o.freight=selectedRate(o);
  return true;
}
/**
 * После смены тарифа фирмы — пересчитать цены заказов этой фирмы,
 * включая закрытые. Ставки ₽/ч и ₽/км — из тарифа фирмы.
 */
function recalculateOrderTariffsForCompany(companyId){
  if(!companyId) return 0;
  const fin=financeForCompanyId(companyId);
  const dead=deletedOrderIdSet();
  let updated=0;
  (state.orders||[]).forEach(o=>{
    if(!o || !o.id || o.cancelledAt || dead.has(o.id)) return;
    if(o.ownCompanyId!==companyId) return;
    if(fin.defaultRatePerHourWork>0) o.ratePerHourWork=+fin.defaultRatePerHourWork;
    if(fin.defaultRatePerKmCash>0) o.ratePerKmCash=+fin.defaultRatePerKmCash;
    try{ recomputeOrderTimes(ensureOrderTimeStamps(o)); }catch(_){}
    if(!(o.workHours>0) && o.timeLoadedHours>0) o.workHours=+o.timeLoadedHours;
    else if(!(o.workHours>0) && o.estimateWorkHours>0) o.workHours=+o.estimateWorkHours;
    const before={
      cash:o.rateCash, noVat:o.rateWithoutVat, vat:o.rateWithVat, freight:o.freight
    };
    if(!applyClientTariff(o)) return;
    const pay=metrics(o).driverPay;
    o.earnings=pay!=null?pay:null;
    const changed=before.cash!==o.rateCash || before.noVat!==o.rateWithoutVat
      || before.vat!==o.rateWithVat || before.freight!==o.freight;
    if(changed) updated++;
  });
  const byId=new Map((state.orders||[]).map(o=>[o.id,o]));
  (state.shifts||[]).forEach(s=>{
    (s.orders||[]).forEach((o,idx)=>{ const live=byId.get(o.id); if(live) s.orders[idx]=live; });
  });
  return updated;
}
function recalculateAllOrderTariffs(){
  // совместимость: пересчёт по всем нашим фирмам
  return ownCompaniesList().reduce((n,co)=>n+recalculateOrderTariffsForCompany(co.id), 0);
}
function wireRateAutoFill(order){
  const map={ 'd-vat':'withVat', 'd-novat':'withoutVat', 'd-cash':'cash' };
  Object.keys(map).forEach(id=>{
    const el=$(id); if(!el) return;
    el.oninput=()=>{
      const raw=(el.value||'').trim().replace(',','.');
      const amount=+raw; if(!(amount>0)) return;
      const form=map[id];
      const t=fillRatesFrom(form, amount);
      $('d-form').value=form;
      if(id!=='d-vat') $('d-vat').value=String(t.withVat);
      if(id!=='d-novat') $('d-novat').value=String(t.withoutVat);
      if(id!=='d-cash') $('d-cash').value=String(t.cash);
      const estRaw=(($('d-estimate-km')||{}).value||'').replace(/\D/g,'');
      const km=billableKm(order||{}, estRaw?+estRaw:null);
      if(km && $('d-perkm')) $('d-perkm').value=String(round2(t.cash/km));
      updatePerKmPreview(order);
    };
  });
}
function draftTariffFromDom(order){
  const num=el=>{ const v=($(el)?.value||'').trim().replace(',','.'); return v===''?null:Number(v); };
  const d=Object.assign({}, order);
  const per=num('d-perkm'); d.ratePerKmCash=(per!=null&&per>0)?per:null;
  const hour=num('d-perhour'); d.ratePerHourWork=(hour!=null&&hour>0)?hour:null;
  const est=(($('d-estimate-km')||{}).value||'').replace(/\D/g,''); d.estimateKm=est?+est:null;
  const eh=num('d-estimate-hours'); d.estimateWorkHours=(eh!=null&&eh>0)?eh:null;
  const wh=num('d-work-hours'); d.workHours=(wh!=null&&wh>0)?wh:null;
  const after=(($('d-empty-after')||{}).value||'').replace(/\D/g,'');
  if(after!=='') d.emptyKmAfter=+after;
  const stor=num('d-overnight-rate'); d.overnightStorageRateCash=(stor!=null&&stor>0)?stor:null;
  const nightsRaw=(($('d-overnight-nights')||{}).value||'').replace(/\D/g,'');
  d.overnightNights=nightsRaw?+nightsRaw:null;
  return d;
}
function updatePerKmPreview(order){
  const box=$('perkm-preview'); if(!box) return;
  const d=draftTariffFromDom(order||{});
  const b=calculateClientTariff(d, financeForOrder(d));
  const total=totalOrderKm(d);
  const pkg=packageKmOf(d);
  const storage=overnightStorageCash(d);
  box.innerHTML=`
    <div class="calc-row"><span>Цепочка км</span><span>${total!=null?`${total} (до ${d.emptyKmBefore||0} + груз ${d.loadedKm||0} + после ${d.emptyKmAfter||0})`:'—'}</span></div>
    <div class="calc-row"><span>Км в пакете</span><span>${pkg} (груз + после)</span></div>
    ${b?`
      <div class="hint">${esc(b.summary)}</div>
      ${storage>0?`<div class="calc-row"><span>Хранение (в сумме)</span><span>${fmt(storage)} руб</span></div>
      <div class="hint">ЗП и подушка считаются без хранения</div>`:''}
      <div class="calc-row"><span>Сумма нал (расчёт)</span><span>${fmt(b.totalCash)} руб</span></div>
      <div class="calc-row"><span>Сумма без НДС</span><span>${fmt(fillRatesFrom('cash', b.totalCash).withoutVat)} руб</span></div>
      <div class="calc-row"><span>Сумма с НДС</span><span>${fmt(fillRatesFrom('cash', b.totalCash).withVat)} руб</span></div>
    `:`<div class="hint">Задайте руб/час (пакет) и/или руб/км сверх пакета / хранение — появится сумма</div>`}
  `;
}
function wirePerKmInputs(order){
  const apply=()=>{
    const d=draftTariffFromDom(order||{});
    const b=calculateClientTariff(d, financeForOrder(d));
    updatePerKmPreview(order);
    if(!b) return;
    const t=fillRatesFrom('cash', b.totalCash);
    $('d-form').value='cash';
    $('d-cash').value=String(t.cash);
    $('d-novat').value=String(t.withoutVat);
    $('d-vat').value=String(t.withVat);
  };
  ['d-perkm','d-perhour','d-estimate-km','d-estimate-hours','d-work-hours','d-empty-after','d-overnight-rate','d-overnight-nights'].forEach(id=>{
    $(id)&&($(id).oninput=apply);
  });
  apply();
}
function variableShare(driverPercent){ return driverPercent/100 + 0.10; }
function fixedCosts(fuelCost, rent, bonus){ return (fuelCost||0)+(rent||0)+(bonus||0); }
function breakEvenRate(fixed, driverPercent){
  const den=1-variableShare(driverPercent);
  if(den<=0.01) return null;
  return round2(fixed/den);
}
function recommendedRate(fixed, driverPercent, markupPercent){
  const den=1-variableShare(driverPercent)-(markupPercent||0)/100;
  if(den<=0.01) return null;
  return round2(fixed/den);
}
function totalCostAtRate(rate, fuelCost, rent, driverPercent, bonus){
  const pay=rate*driverPercent/100+bonus;
  const cush=rate*0.1;
  return round2((fuelCost||0)+rent+pay+cush);
}
function metrics(o){
  const cons=vehicle(o.vehiclePlate, o.ownCompanyId).consumptionPer100Km;
  const km=kmParkingToEnd(o);
  const fuelLitersCalc=km==null?null:round2(km*cons/100);
  const price=o.fuelPricePerLiter;
  const fuelCostCalc=(fuelLitersCalc!=null && price!=null)?round2(fuelLitersCalc*price):(o.fuelTotalCost??null);
  const rate=selectedRate(o);
  const payBase=payrollRate(o);
  const cushion=payBase==null?null:round2(payBase*0.1);
  const bonus=o.salaryBonus||0;
  const percent=o.driverPercent??driverPercent(o.driverName||DRIVER, o.ownCompanyId);
  const driverPay=payBase==null?null:round2(payBase*percent/100+bonus);
  const rent=o.vehicleRent||0;
  const fuel=fuelCostCalc||0;
  const fixed=round2(fixedCosts(fuel, rent, bonus));
  const markup=financeForOrder(o).markupPercent??15;
  const be=breakEvenRate(fixed, percent);
  const rec=recommendedRate(fixed, percent, markup);
  const totalCost=payBase==null?null:totalCostAtRate(payBase, fuel, rent, percent, bonus);
  const netProfit=(rate!=null && driverPay!=null && cushion!=null)?round2(rate-driverPay-cushion-fuel-rent):null;
  const costPerKmNoVat=(o.rateWithoutVat!=null && o.loadedKm>0)?round2(o.rateWithoutVat/o.loadedKm):null;
  return {km,fuelLitersCalc,fuelCostCalc,rate,cushion,driverPay,costPerKmNoVat,netProfit,cons,percent,fixedCosts:fixed,totalCost,breakEvenRate:be,recommendedRate:rec,markupPercent:markup};
}

function updateSyncHint(){
  const el=$('sync-hint'); if(!el) return;
  // На экране входа не шумим: текст только если реально нет связи
  if(syncStatus==='error'){
    el.textContent='Нет связи с сервером';
    el.style.display='';
  } else {
    el.textContent='';
    el.style.display='none';
  }
  updateDriverNetHint();
}
const ENTRY_ASIDE={
  driver:{
    badge:'Водитель',
    title:'В дороге — всё в одном месте',
    lead:'Смена, ЕТО и заказы на телефоне. Не нужно устанавливать приложение — откройте ссылку и добавьте на экран.',
    items:['Открыть и закрыть смену','Пройти ЕТО перед выездом','Заявки, одометры, статусы'],
    foot:'<a href="help.html#driver">Инструкция для водителя</a> · <a href="kp.html">О сервисе</a>'
  },
  admin:{
    badge:'Администратор',
    title:'Кабинет диспетчера',
    lead:'Заявки, внутренняя биржа между перевозчиками, справочники и ЭТрН — для микро-парка.',
    items:['Создание и контроль заявок','Биржа и назначение водителей','Водители, авто, тарифы','ЭТрН и биллинг в одном окне'],
    foot:'<a href="help.html#admin">Помощь</a> · <a href="kp-logist.html">Для логиста</a> · <a href="/downloads/">Материалы</a>'
  },
  customer:{
    badge:'Заказчик',
    title:'Портал заказчика',
    lead:'Отправьте заявку и смотрите расчёт минимальной цены. Статус заказа — в личном кабинете.',
    items:['Новая заявка с телефона','Минимальная цена до отправки','Статус: биржа, назначен, в работе'],
    foot:'<a href="help.html#customer">Как это работает</a> · <a href="/kp-zakaz.html">Для заказчика</a>'
  }
};
function clearEntrySkin(){
  try{
    document.body.classList.remove('entry-page','entry-driver','entry-admin','entry-customer');
    document.querySelectorAll('.entry-aside').forEach(el=>el.remove());
  }catch(_){}
}
function applyEntrySkin(screenId){
  const mode=getEntryMode();
  if(!mode || mode==='roles'){ clearEntrySkin(); return; }
  const screen=$(screenId||entryLoginScreenId());
  if(!screen||!screen.classList.contains('show')) return;
  document.body.classList.add('entry-page','entry-'+mode);
  if(screen.querySelector('.entry-aside')) return;
  const cfg=ENTRY_ASIDE[mode];
  if(!cfg) return;
  const aside=document.createElement('div');
  aside.className='entry-aside';
  let carrierBlock='';
  if(mode==='customer'){
    const label=portalScopeCarrierLabel();
    if(label){
      const sp=typeof portalScopeCarrierSpace==='function'?portalScopeCarrierSpace():null;
      carrierBlock=carrierBrandHtml(label, sp);
    }
  }
  let foot=cfg.foot||'';
  if(mode==='customer' && typeof customerKpPageUrl==='function'){
    foot=`<a href="/help.html#customer">Как это работает</a> · <a href="${esc(customerKpPageUrl())}">Коммерческое предложение</a>`;
  }
  aside.innerHTML=`
    <div class="entry-aside-inner">
      ${carrierBlock}
      <span class="entry-aside-badge">${esc(cfg.badge)}</span>
      <h1>${esc(cfg.title)}</h1>
      <p class="entry-aside-lead">${esc(cfg.lead)}</p>
      <ul class="entry-aside-list">${(cfg.items||[]).map(t=>`<li>${esc(t)}</li>`).join('')}</ul>
      <p class="entry-aside-foot">${foot}</p>
    </div>`;
  const center=screen.querySelector('.center');
  if(center) center.insertBefore(aside, center.firstChild);
}
function openAdminLogin(){
  openAdminLoginAsync().catch(err=>console.warn('openAdminLogin', err));
}
async function openAdminLoginAsync(){
  migrateAdmins();
  if(canAutoRestoreAdmin()){
    clearEntrySkin();
    show('admin');
    renderAdmin();
    if(window.ArmadaOnboarding) ArmadaOnboarding.maybeAdmin();
    return;
  }
  if(adminEntryRequiresPin()) currentAdmin=null;
  fillAdminLoginSelect();
  const pinIn=$('pin-input');
  if(pinIn) pinIn.value='';
  const pinErr=$('pin-error');
  if(pinErr) pinErr.textContent='';
  show('admin-pin');
  wireAdminLoginHandlers();
  try{ applyEntrySkin('admin-pin'); }catch(err){ console.warn('applyEntrySkin', err); }
  const sel=$('admin-name-select');
  const btn=$('pin-ok');
  if(btn) btn.disabled=false;
  let synced=false;
  try{
    if(sel) sel.disabled=true;
    if(navigator.onLine!==false && typeof refreshAdminListForLogin==='function'){
      synced=await Promise.race([
        refreshAdminListForLogin(),
        new Promise(resolve=>setTimeout(()=>resolve(false), 4500))
      ]);
    }
    fillAdminLoginSelect();
    if(!synced && pinErr){
      pinErr.textContent='Список с сервера не обновился — можно войти с локальными данными';
    }
  }catch(err){
    console.warn('admin login list', err);
    fillAdminLoginSelect();
    if(pinErr) pinErr.textContent='Ошибка загрузки списка — попробуйте войти';
  }finally{
    if(sel) sel.disabled=false;
    if(btn) btn.disabled=false;
  }
}
function wireAdminLoginHandlers(){
  const ok=$('pin-ok');
  if(ok){
    ok.type='button';
    ok.onclick=()=>loginAdmin();
  }
  const pin=$('pin-input');
  if(pin){
    pin.onkeydown=e=>{
      if(e.key==='Enter'){ e.preventDefault(); loginAdmin(); }
    };
  }
  const back=$('pin-back');
  if(back && typeof backFromEntryLogin==='function'){
    back.type='button';
    back.onclick=()=>backFromEntryLogin();
  }
}
function showDefaultAfterSplash(){
  initEntryFromPage();
  initPortalScopeFromPage();
  const entryId=entryLoginScreenId();
  if(entryId==='roles'){
    clearEntrySkin();
    show('roles');
    if(window.ArmadaOnboarding) ArmadaOnboarding.showRolesWelcome();
    return;
  }
  if(entryId==='driver-login') openDriverLogin(false);
  else if(entryId==='admin-pin') openAdminLogin();
  else if(entryId==='customer-login') openCustomerLogin();
}
// Сразу после загрузки localStorage — без PIN, если сессия была (кроме /a без PIN в этой вкладке)
try{
  const urlEntry=typeof dedicatedEntryMode==='function'?dedicatedEntryMode():null;
  if(urlEntry==='driver' && restoreDriverSession()) show('driver');
  else if(!urlEntry){
    const last=localStorage.getItem(LAST_ROLE_KEY)||'';
    if(last==='driver' && restoreDriverSession()) show('driver');
    else if(last==='customer'){ /* customer.js ниже */ }
    else if(canAutoRestoreAdmin()) show('admin');
    else if(restoreDriverSession()) show('driver');
  }
}catch(_){}
(async function boot(){
  try{
  if(typeof initShareSheet==='function') initShareSheet();
  initEntryFromPage();
  initPortalScopeFromPage();
  migrateAdmins();
  let dirty=migrateDriverOwners();
  if(migrateSpaces()) dirty=true;
  if(migrateDriverOrderOwners()) dirty=true;
  if(migrateShiftOwners()) dirty=true;
  if(migrateDriverPins()) dirty=true;
  if(migrateCompanyFinance()) dirty=true;
  if(healVehicleOdometersFromShifts()) dirty=true;
  if(ensureManufacturerServiceIntervals()) dirty=true;
  (state.vehicles||[]).forEach(v=>{ if(enrichChecklistHowFromIntervals(v)) dirty=true; });
  if(purgeCancelledOrders()){
    bumpDataEpoch('purge-boot');
    dirty=true;
  }
  if(dirty){
    bumpDataEpoch('migrate-boot');
    persistLocalOnly();
  }
  updateSyncHint();
  // Восстановить роль без PIN — сразу из localStorage, сеть в фоне
  let lastRole='';
  try{ lastRole=localStorage.getItem(LAST_ROLE_KEY)||''; }catch(_){}
  const tryDriver=async()=>{
    if(!restoreDriverSession()) return false;
    const rec=findDriverRecord(DRIVER, DRIVER_COMPANY_ID)||findDriverRecord(DRIVER, null);
    if(!rec){ clearDriverSession(); return false; }
    await enterAsDriver(rec);
    return true;
  };
  const urlEntry=typeof dedicatedEntryMode==='function'?dedicatedEntryMode():null;
  if(urlEntry==='customer'){
    try{ await initCloudSync(); }catch(_){}
    initPortalScopeFromPage();
    if(typeof showCustomerPortal==='function') showCustomerPortal();
    else if(typeof openCustomerLogin==='function') openCustomerLogin();
  } else if(urlEntry==='driver'){
    if(lastRole==='driver' && (await tryDriver())){ /* ok */ }
    else if(restoreDriverSession() && (await tryDriver())){ /* ok */ }
    else openDriverLogin(false);
  } else if(urlEntry==='admin'){
    openAdminLogin();
  } else if(lastRole==='driver'){
    if(!(await tryDriver()) && restoreAdminSession()){ show('admin'); renderAdmin(); if(window.ArmadaOnboarding) ArmadaOnboarding.maybeAdmin(); }
  } else if(lastRole==='customer'){
    if(typeof showCustomerPortal==='function') showCustomerPortal();
    else if(restoreAdminSession()){ show('admin'); renderAdmin(); if(window.ArmadaOnboarding) ArmadaOnboarding.maybeAdmin(); }
  } else if(restoreAdminSession()){
    show('admin');
    renderAdmin();
    if(window.ArmadaOnboarding) ArmadaOnboarding.maybeAdmin();
  } else if(!(await tryDriver())){
    if(!document.querySelector('#admin.show') && !document.querySelector('#admin-pin.show') && !document.querySelector('#driver.show') && !document.querySelector('#driver-login.show') && !document.querySelector('#customer-login.show')){
      if(document.querySelector('#splash.show')) showAfterSplash(showDefaultAfterSplash);
      else showDefaultAfterSplash();
    }
  }
  startAutoSync();
  if(urlEntry!=='customer'){
    initCloudSync().then(()=>{
      updateSyncHint();
      if(typeof reconcileAdminSessionAfterSync==='function') reconcileAdminSessionAfterSync();
    }).catch(()=>updateSyncHint());
  } else {
    updateSyncHint();
  }
  setTimeout(updateSyncHint, 700);
  }catch(err){
    console.error('АРМАДА boot', err);
    if(!document.querySelector('#admin.show') && !document.querySelector('#admin-pin.show') && !document.querySelector('#driver.show') && !document.querySelector('#driver-login.show') && !document.querySelector('#customer-login.show') && !document.querySelector('#customer-portal.show')){
      if(document.querySelector('#splash.show')) showAfterSplash(showDefaultAfterSplash);
      else if(typeof showDefaultAfterSplash==='function') showDefaultAfterSplash();
    }
  }finally{
    window.__armadaBootDone=true;
    if(document.querySelector('#splash.show') && !document.querySelector('#admin.show') && !document.querySelector('#admin-pin.show') && !document.querySelector('#driver.show') && !document.querySelector('#driver-login.show') && !document.querySelector('#customer-login.show') && !document.querySelector('#customer-portal.show')){
      if(typeof showAfterSplash==='function' && typeof showDefaultAfterSplash==='function') showAfterSplash(showDefaultAfterSplash);
      else if(typeof show==='function') show('roles');
    }
  }
})();
function wireShellHandlers(){
  $('role-driver')&&($('role-driver').onclick=()=>{ setEntryMode('driver'); if(typeof openDriverLogin==='function') openDriverLogin(false); });
  $('admin-as-driver')&&($('admin-as-driver').onclick=()=>{
    if(!currentAdmin && !restoreAdminSession()){ show('admin-pin'); return; }
    if(typeof openDriverLogin==='function') openDriverLogin(true);
  });
  if(typeof loginDriver==='function'){
    $('drv-login-ok')&&($('drv-login-ok').onclick=loginDriver);
    $('drv-login-phone-ok')&&($('drv-login-phone-ok').onclick=continueDriverPhone);
    $('drv-login-phone')&&($('drv-login-phone').onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); continueDriverPhone(); } });
  }
  $('btn-home')&&typeof showDriverHome==='function'&&($('btn-home').onclick=showDriverHome);
  $('role-admin')&&($('role-admin').onclick=()=>{ setEntryMode('admin'); if(typeof openAdminLogin==='function') openAdminLogin(); });
  $('role-customer')&&($('role-customer').onclick=()=>{ setEntryMode('customer'); if(typeof openCustomerLogin==='function') openCustomerLogin(); });
  $('pin-back')&&typeof backFromEntryLogin==='function'&&($('pin-back').onclick=()=>backFromEntryLogin());
  if(typeof loginAdmin==='function'){
    $('pin-ok')&&($('pin-ok').onclick=loginAdmin);
    $('pin-input')&&($('pin-input').onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); loginAdmin(); } });
  }
  $('admin-exit')&&typeof logoutAdmin==='function'&&($('admin-exit').onclick=logoutAdmin);
  $('admin-help')&&($('admin-help').onclick=()=>{
    window.open('help.html','_blank','noopener');
  });
  $('admin-catalogs')&&typeof setAdminNav==='function'&&($('admin-catalogs').onclick=()=>setAdminNav('catalogs'));
  $('admin-activity')&&typeof setAdminNav==='function'&&($('admin-activity').onclick=()=>setAdminNav('activity'));
  $('admin-billing')&&typeof setAdminNav==='function'&&($('admin-billing').onclick=()=>setAdminNav('billing'));
  $('admin-menu-toggle')&&($('admin-menu-toggle').onclick=()=>{
    const sb=$('admin-sidebar');
    if(sb && sb.classList.contains('open')) closeAdminSidebar();
    else openAdminSidebar();
  });
  $('admin-sidebar-backdrop')&&($('admin-sidebar-backdrop').onclick=closeAdminSidebar);
  document.querySelectorAll('.admin-nav-item[data-nav]').forEach(b=>{
    b.onclick=()=>setAdminNav(b.dataset.nav);
  });
  document.querySelectorAll('#admin-park-ex [data-park-ex]').forEach(b=>{
    b.onclick=()=>setAdminNav(b.dataset.parkEx==='exchange'?'exchange':'orders');
  });
  if(typeof updateAdminChrome==='function') updateAdminChrome();
  if(typeof showCabinet==='function') $('btn-cabinet')&&($('btn-cabinet').onclick=showCabinet);
  if(typeof showOrders==='function') $('btn-orders')&&($('btn-orders').onclick=showOrders);
  if(typeof showShifts==='function') $('btn-shifts')&&($('btn-shifts').onclick=showShifts);
  if(typeof hideDriverPanels==='function'){
    document.querySelectorAll('.back-driver').forEach(b=>{
      b.onclick=(e)=>{ e.preventDefault(); e.stopPropagation(); hideDriverPanels(); };
    });
  }
  document.querySelectorAll('#admin-filters button').forEach(b=>b.onclick=()=>{
    state.adminFilter=b.dataset.filter;
    document.querySelectorAll('#admin-filters button').forEach(x=>x.classList.toggle('on', x===b));
    renderAdmin();
  });
  if(typeof bindAdminCreate==='function') bindAdminCreate();
}
wireShellHandlers();
(function bindMobileFocusScroll(){
  let t=null;
  document.addEventListener('focusin',e=>{
    const el=e.target;
    if(!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    if(window.matchMedia && !window.matchMedia('(max-width:699px)').matches) return;
    clearTimeout(t);
    t=setTimeout(()=>{
      try{ el.scrollIntoView({block:'center', behavior:'smooth'}); }catch(_){
        try{ el.scrollIntoView(true); }catch(__){}
      }
    }, 280);
  }, true);
})();
window.addEventListener('online',()=>flushDriverSyncWhenOnline());
window.addEventListener('offline',()=>{ syncStatus='error'; updateDriverNetHint(); });
document.addEventListener('visibilitychange',()=>{
  if(document.hidden) maybeDriverActionNotify(true);
  else { updateDriverNetHint(); renderDriverBanner(); }
});
if('serviceWorker' in navigator){
  let reloading=false;
  navigator.serviceWorker.addEventListener('message',e=>{
    if(e.data && e.data.type==='ARMADA_SW_UPDATED' && !reloading){
      reloading=true;
      location.reload();
    }
  });
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(reloading) return;
    if(!navigator.serviceWorker.controller) return;
    reloading=true;
    location.reload();
  });
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js?v='+encodeURIComponent(APP_BUILD))
      .then(reg=>{ try{ reg.update(); }catch(_){} })
      .catch(err=>console.warn('SW',err));
    updateDriverNetHint();
  });
}
