/* АРМАДА — ЭТрН (S3 MVP UI + API client)
 * Титулы по закону / формату ЭПД:
 * T1 — грузоотправитель; T2 — перевозчик (приём на погрузке);
 * T3 — грузополучатель (приём на выгрузке); T4 — перевозчик (выдача на выгрузке).
 * Водитель подтверждает T2/T4 (ПЭП); перевозчик заверяет УКЭП.
 */
function etrnTitulLabel(key){
  const m={
    t1:'Т1 · грузоотправитель',
    t2:'Т2 · перевозчик (приём)',
    t3:'Т3 · грузополучатель',
    t4:'Т4 · перевозчик (выдача)'
  };
  return m[key]||key;
}
function etrnTitulWhenHint(key){
  const m={
    t1:'до выезда с грузом · грузоотправитель',
    t2:'на погрузке · перевозчик / водитель (приём груза)',
    t3:'на выгрузке · грузополучатель',
    t4:'на выгрузке · перевозчик / водитель (выдача)'
  };
  return m[key]||'';
}
/** Не юр.консультация: T1 в ЭТрН ≠ бумажная ТН и ≠ НЭП по ссылке. */
function etrnT1KepHintHtml(compact){
  const t=compact
    ? 'T1 в ЭТрН — только КЭП грузоотправителя. Без КЭП — бумажная накладная на погрузке; ссылка T1 это не заменяет.'
    : 'Подпись T1 в электронной ЭТрН — усиленной подписью (КЭП) грузоотправителя через оператора. Если у грузоотправителя нет КЭП, на погрузке оформляют бумажную транспортную накладную; ссылка в приложении не заменяет бумагу и не считается «электронным бланком с НЭП».';
  return `<p class="hint etrn-t1-kep-hint">${t}</p>`;
}
function etrnTitulStatusLabel(st){
  if(st==='signed') return 'подписан';
  if(st==='error') return 'ошибка';
  return 'ожидает';
}
function orderEtrnEligible(o){
  if(!o || o.cancelledAt || looksClosedOrder(o)) return false;
  if(typeof orderTransportDocUsesEtrn==='function'&&!orderTransportDocUsesEtrn(o)) return false;
  if(typeof orderHasDriverVehicleAssigned==='function') return orderHasDriverVehicleAssigned(o);
  const drv=String(o.driverName||'').trim();
  const plate=String(o.vehiclePlate||'').trim();
  return !!(drv && plate && drv!=='—' && plate!=='—' && drv!=='Диспетчер' && drv!=='Биржа');
}
function orderEtrnTransportActive(o){
  if(!o || looksClosedOrder(o) || o.cancelledAt) return false;
  return o.departOdometer!=null || o.startOdometer!=null;
}
function orderEtrnVisible(o){
  if(!o || o.cancelledAt) return false;
  const sid=typeof orderSpaceId==='function'?orderSpaceId(o):(o.spaceId||null);
  if(sid && typeof billingCanUseEtrn==='function'){
    const g=billingCanUseEtrn(sid);
    if(!g.ok) return false;
  }
  if(o.etrn) return true;
  return orderEtrnEligible(o) && !looksClosedOrder(o);
}
function orderEtrnWeAreCarrier(o){
  if(!o || !currentAdmin) return false;
  const myCo=typeof currentOwnCompany==='function'?currentOwnCompany():null;
  if(!myCo) return false;
  if(o.carrierCompanyId && o.carrierCompanyId===myCo.id) return true;
  if(typeof isMyFirmOrder==='function' && isMyFirmOrder(o) && (!o.carrierCompanyId || o.carrierCompanyId===myCo.id)) return true;
  return false;
}
function orderEtrnTitulPending(o, key){
  const t=o&&o.etrn&&o.etrn.tituls;
  return !!(t && t[key]==='pending');
}
function orderEtrnTitulSigned(o, key){
  return !!(o&&o.etrn&&o.etrn.tituls&&o.etrn.tituls[key]==='signed');
}
/** ЭТрН: выезд со стоянки не ждёт T1. T1+T2 — до выезда с грузом от грузоотправителя. */
function orderEtrnReadyForDepart(o){
  if(!o) return {ok:false, message:'Нет заказа'};
  if(typeof orderTransportDocUsesEtrn==='function'&&!orderTransportDocUsesEtrn(o)) return {ok:true};
  return {ok:true};
}
/** Выезд с погрузки с грузом — после T1 (ГО) и T2 (приём перевозчиком). */
function orderEtrnReadyForLeaveLoading(o){
  if(!o) return {ok:false, message:'Нет заказа'};
  if(typeof orderTransportDocUsesEtrn==='function'&&!orderTransportDocUsesEtrn(o)) return {ok:true};
  if(!orderEtrnEligible(o)) return {ok:true};
  if(!o.etrn) return {ok:false, message:'Сначала оформите ЭТрН: T1 грузоотправителя и T2 перевозчика'};
  if(!orderEtrnTitulSigned(o,'t1')) return {ok:false, message:'Сначала подпись T1 грузоотправителя — без неё нельзя выехать с грузом'};
  if(!orderEtrnTitulSigned(o,'t2')) return {ok:false, message:'Сначала подпись T2 (приём перевозчиком на погрузке)'};
  return {ok:true};
}
/** QR инспектору — после T1. */
function orderEtrnQrAllowed(o){
  return orderEtrnTitulSigned(o,'t1');
}
/** Выехал с погрузки (с грузом на выгрузку) — статус «В работе». */
function orderLeftLoading(o){
  if(!o||o.startOdometer==null) return false;
  if(o.loadedDepartAt) return true;
  if(o.endOdometer!=null) return true;
  if(o.staysLoadedOvernight) return true;
  return false;
}
/**
 * Шаг рейса (погрузка ≠ выезд с грузом ≠ выгрузка):
 * inbox | assigned | en_route_to_load | at_load | en_route_to_unload | at_unload | closed | cancelled
 */
function orderLifecycleStepKey(o){
  if(!o||o.cancelledAt) return 'cancelled';
  if(typeof looksClosedOrder==='function'&&looksClosedOrder(o)) return 'closed';
  if(o.endOdometer!=null) return 'at_unload';
  if(o.startOdometer!=null||o.arrivedAt){
    return orderLeftLoading(o)?'en_route_to_unload':'at_load';
  }
  if(o.departOdometer!=null||o.departAt) return 'en_route_to_load';
  if(typeof orderHasDriverVehicleAssigned==='function'&&orderHasDriverVehicleAssigned(o)) return 'assigned';
  return 'inbox';
}
function orderLifecycleStepLabel(step){
  const m={
    inbox:'Входящие',
    assigned:'Назначен',
    en_route_to_load:'В пути на погрузку',
    at_load:'На погрузке',
    en_route_to_unload:'В работе',
    at_unload:'На выгрузке',
    closed:'Закрыт',
    cancelled:'Отменён'
  };
  return m[step]||step;
}
/**
 * Чеклист ЭТрН на карточке: T1 · T2 · QR · T3 · T4 (галочки только показ).
 * compact — для канбана.
 */
function orderEtrnChecklistHtml(o, opts){
  opts=opts||{};
  if(!o) return '';
  const usesEtrn=typeof orderTransportDocUsesEtrn==='function'?orderTransportDocUsesEtrn(o):!!(o.etrn);
  if(!usesEtrn&&!o.etrn) return '';
  const t=o.etrn&&o.etrn.tituls||{};
  const qrOk=typeof orderEtrnQrAllowed==='function'?orderEtrnQrAllowed(o):(t.t1==='signed');
  const items=[
    {k:'T1', ok:t.t1==='signed', tip:'Грузоотправитель · до выезда с грузом'},
    {k:'T2', ok:t.t2==='signed', tip:'Перевозчик · приём на погрузке'},
    {k:'QR', ok:!!qrOk, tip:'QR инспектору · после T1'},
    {k:'T3', ok:t.t3==='signed', tip:'Грузополучатель · на выгрузке'},
    {k:'T4', ok:t.t4==='signed', tip:'Перевозчик · выдача на выгрузке'}
  ];
  const step=typeof orderLifecycleStepKey==='function'?orderLifecycleStepKey(o):'';
  const stepLbl=typeof orderLifecycleStepLabel==='function'?orderLifecycleStepLabel(step):'';
  const row=items.map(it=>
    `<span class="etrn-check${it.ok?' etrn-check--on':''}" title="${esc(it.tip)}"><span class="etrn-check-mark" aria-hidden="true">${it.ok?'✓':'○'}</span>${esc(it.k)}</span>`
  ).join('');
  const head=opts.compact?'':`<div class="etrn-check-step">${esc(stepLbl||'ЭТрН')}</div>`;
  return `<div class="etrn-checklist${opts.compact?' etrn-checklist--compact':''}" role="group" aria-label="ЭТрН">${head}<div class="etrn-check-row">${row}</div></div>`;
}
/**
 * Согласованность статусов заказа и титулов ЭТрН с текущим шагом рейса.
 * Погрузка (at_load) и выгрузка (at_unload) проверяются отдельно.
 */
function orderLifecycleStatusIssues(o){
  const issues=[];
  if(!o||o.cancelledAt) return issues;
  const usesEtrn=typeof orderTransportDocUsesEtrn==='function'?orderTransportDocUsesEtrn(o):true;
  const step=orderLifecycleStepKey(o);
  const assigned=step!=='inbox'&&step!=='cancelled';
  const t=o.etrn&&o.etrn.tituls||{};

  if(!usesEtrn){
    if(o.etrn) issues.push('Режим бумажной ТН, но в заказе есть ЭТрН');
    return issues;
  }

  if((step==='assigned'||step==='en_route_to_load'||step==='at_load'||step==='en_route_to_unload'||step==='at_unload')&&!o.etrn){
    issues.push('После назначения должен быть черновик ЭТрН (для T1/T2)');
  }

  if(o.etrn){
    // T1 не обязателен до выезда со стоянки — только до выезда с грузом
    if(step==='en_route_to_unload'||step==='at_unload'||step==='closed'){
      if(t.t1!=='signed') issues.push(orderLifecycleStepLabel(step)+': нет T1 (нужен до выезда с грузом)');
    }
    if(step==='at_load'&&orderLeftLoading(o)===false&&t.t2==='signed'&&t.t1!=='signed'){
      issues.push('На погрузке: T2 есть, а T1 нет');
    }
    if(step==='assigned'){
      if(t.t1==='pending'&&t.t2==='signed') issues.push('T2 подписан раньше T1 — сначала T1');
    }
    if(step==='at_load'){
      if(t.t3==='signed'&&t.t2!=='signed') issues.push('На погрузке: T3 есть, а T2 нет');
      if(t.t4==='signed'&&t.t2!=='signed') issues.push('На погрузке: T4 есть, а T2 нет');
    }
    if(step==='en_route_to_unload'){
      if(t.t2!=='signed') issues.push('В работе без T2 (приём перевозчиком на погрузке)');
    }
    if(step==='at_unload'){
      if(t.t2!=='signed') issues.push('На выгрузке без T2 (приём на погрузке)');
      if(t.t4==='signed'&&t.t3!=='signed') issues.push('На выгрузке: T4 без T3 (грузополучатель)');
    }
    if(step==='closed'&&!['t1','t2','t3','t4'].every(k=>t[k]==='signed')){
      issues.push('Заказ закрыт, но не все титулы ЭТрН подписаны');
    }
    if(t.t4==='signed'&&t.t3!=='signed') issues.push('T4 есть, а T3 нет');
    if(t.t3==='signed'&&t.t2!=='signed') issues.push('T3 есть, а T2 нет');
  }

  if((step==='en_route_to_load'||step==='at_load'||step==='en_route_to_unload'||step==='at_unload')&&!assigned){
    issues.push('Рейс без назначения водителя/ТС');
  }
  if(step==='at_load'&&!(o.departOdometer!=null||o.departAt)){
    issues.push('Прибытие на погрузку без выезда');
  }
  if(step==='at_unload'&&!(o.startOdometer!=null||o.arrivedAt)){
    issues.push('Прибытие на выгрузку без погрузки');
  }
  if(o.endOdometer!=null&&o.startOdometer!=null&&o.endOdometer<o.startOdometer){
    issues.push('Одометр выгрузки меньше одометра погрузки');
  }
  return issues;
}
/** Какой титул ждут от перевозчика (логист УКЭП): T2 на погрузке или T4 на выгрузке. */
function orderEtrnCarrierPendingTitul(o){
  if(!orderEtrnVisible(o)||!o.etrn||!orderEtrnWeAreCarrier(o)) return null;
  if(orderEtrnTitulPending(o,'t2')&&orderEtrnTitulSigned(o,'t1')&&orderEtrnLoadingPhase(o)) return 't2';
  if(orderEtrnTitulPending(o,'t4')&&orderEtrnTitulSigned(o,'t3')&&o.endOdometer!=null) return 't4';
  return null;
}
function orderEtrnNeedsMySignature(o){
  return !!orderEtrnCarrierPendingTitul(o);
}
function orderEtrnSummary(o){
  if(!orderEtrnVisible(o)){
    if(orderEtrnEligible(o) && !looksClosedOrder(o)) return { label:'ЭТрН: T1 до выезда · T2 на погрузке', cls:'muted', urgent:false };
    return null;
  }
  if(!o.etrn) return { label:'ЭТрН: не создан', cls:'muted', urgent:false };
  const t=o.etrn.tituls||{};
  const allSigned=['t1','t2','t3','t4'].every(k=>t[k]==='signed');
  const tripClosed=typeof looksClosedOrder==='function'&&looksClosedOrder(o);
  const issues=typeof orderLifecycleStatusIssues==='function'?orderLifecycleStatusIssues(o):[];
  if(issues.length) return { label:'ЭТрН: статусы не сходятся', cls:'warn urgent', urgent:true };
  if(allSigned && tripClosed) return { label:'ЭТрН: закрыт ✓', cls:'ok', urgent:false };
  if(allSigned && !tripClosed){
    if(typeof orderAwaitingFinalize==='function'&&orderAwaitingFinalize(o)){
      return { label:'ЭТрН: подписи ✓ · закройте перевозку', cls:'warn', urgent:false };
    }
    return { label:'ЭТрН: подписи ✓ · перевозка открыта', cls:'warn', urgent:false };
  }
  const mine=orderEtrnCarrierPendingTitul(o);
  if(mine==='t2') return { label:'T2 — ваша подпись (приём)', cls:'warn urgent', urgent:true };
  if(mine==='t4') return { label:'T4 — ваша подпись (выдача)', cls:'warn urgent', urgent:true };
  if(t.t1==='pending') return { label:'T1 · ждёт ГО (до выезда)', cls:'pending', urgent:false };
  if(t.t2==='pending') return { label:'T2 · перевозчик на погрузке', cls:'pending', urgent:false };
  if(t.t3==='pending') return { label:'T3 · грузополучатель', cls:'pending', urgent:false };
  if(t.t4==='pending') return { label:'T4 · перевозчик на выгрузке', cls:'pending', urgent:false };
  return { label:'ЭТрН · в работе', cls:'pending', urgent:false };
}
function orderEtrnBadgeHtml(o){
  const s=orderEtrnSummary(o);
  if(!s) return '';
  return `<span class="order-etrn-badge ${esc(s.cls)}${s.urgent?' order-etrn-badge--urgent':''}">${esc(s.label)}</span>`;
}
/** Кнопка T2/T4 на карточке заказа (канбан / список). */
function adminOrderEtrnActionHtml(o){
  if(!orderEtrnVisible(o)||!o.etrn||!orderEtrnWeAreCarrier(o)) return '';
  const t=o.etrn.tituls||{};
  const mine=orderEtrnCarrierPendingTitul(o);
  if(mine==='t2'){
    return `<button type="button" class="secondary admin-etrn-card-sign admin-etrn-card-sign--ready" data-etrn-sign-order="${esc(o.id)}" data-etrn-titul="t2" title="Приём груза перевозчиком на погрузке">Подписать T2</button>`;
  }
  if(mine==='t4'){
    return `<button type="button" class="secondary admin-etrn-card-sign admin-etrn-card-sign--ready" data-etrn-sign-order="${esc(o.id)}" data-etrn-titul="t4" title="Выдача груза перевозчиком на выгрузке">Подписать T4</button>`;
  }
  if(t.t1==='pending'&&typeof orderHasDriverVehicleAssigned==='function'&&orderHasDriverVehicleAssigned(o)){
    return `<button type="button" class="secondary admin-etrn-card-sign admin-etrn-card-sign--wait" disabled title="Ждём подпись грузоотправителя (T1) до выезда">T1 · ждём ГО</button>`;
  }
  if(t.t3==='pending'&&t.t2==='signed'){
    return `<button type="button" class="secondary admin-etrn-card-sign admin-etrn-card-sign--wait" disabled title="Ждём подпись грузополучателя (T3)">T3 · ждём ГП</button>`;
  }
  return '';
}
function wireAdminOrderEtrnCardButtons(root){
  (root||document).querySelectorAll('.admin-etrn-card-sign--ready').forEach(b=>{
    if(b.dataset.etrnCardWired) return;
    b.dataset.etrnCardWired='1';
    b.onclick=e=>{
      e.stopPropagation();
      const oid=b.dataset.etrnSignOrder;
      const titul=b.dataset.etrnTitul||'t2';
      const done=()=>{
        if(typeof renderAdminDebounced==='function') renderAdminDebounced();
        else if(typeof renderAdmin==='function') renderAdmin();
      };
      if(typeof openEpdTitulSign==='function'){
        Promise.resolve(openEpdTitulSign(oid, titul, typeof epdRoleForTitul==='function'?epdRoleForTitul(titul):'carrier')).then(done).catch(()=>{});
        return;
      }
      if(typeof signEtrnTitul==='function'&&signEtrnTitul(oid, titul, 'admin')) done();
    };
  });
}
function adminEtrnSignPendingCount(orders){
  return (orders||[]).filter(o=>orderEtrnNeedsMySignature(o)).length;
}
function orderEtrnWaitingCustomer(o){
  if(!orderEtrnVisible(o) || !o.etrn) return false;
  if(orderEtrnTitulPending(o,'t1')){
    return typeof orderHasDriverVehicleAssigned==='function'?orderHasDriverVehicleAssigned(o):true;
  }
  // T3 — грузополучатель (часто заказчик в /z)
  if(orderEtrnTitulPending(o,'t3')&&orderEtrnTitulSigned(o,'t2')){
    return o.endOdometer!=null || (typeof orderLeftLoading==='function'&&orderLeftLoading(o));
  }
  return false;
}
function orderEtrnWaitingDriver(o){
  if(!orderEtrnVisible(o) || !o.etrn) return false;
  // Водитель: T2 на погрузке, T4 на выгрузке (не T3)
  if(orderEtrnTitulPending(o,'t2')&&orderEtrnTitulSigned(o,'t1')&&orderEtrnLoadingPhase(o)) return true;
  if(orderEtrnTitulPending(o,'t4')&&orderEtrnTitulSigned(o,'t3')&&o.endOdometer!=null) return true;
  return false;
}
/** Закрытие перевозки — после T4 (выдача перевозчиком), если ЭТрН в заказе. */
function orderEtrnNeedsT4BeforeClose(o){
  if(!orderEtrnVisible(o) || !o.etrn || !o.etrn.tituls) return false;
  return o.etrn.tituls.t4==='pending';
}
function canCloseOrderEtrnMessage(order){
  if(!order || !orderEtrnVisible(order) || !order.etrn) return null;
  if(orderEtrnTitulPending(order,'t2')){
    return `Сначала T2 (приём груза перевозчиком на погрузке) · заказ №${order.sequentialNumber||'—'}.`;
  }
  if(orderEtrnTitulPending(order,'t3')){
    return `Сначала T3 (грузополучатель на выгрузке) · заказ №${order.sequentialNumber||'—'}.`;
  }
  if(orderEtrnNeedsT4BeforeClose(order)){
    return `Подпишите T4 (выдача перевозчиком на выгрузке) — затем заказ закроется · №${order.sequentialNumber||'—'}.`;
  }
  return null;
}
function adminEtrnWaitCustomerCount(orders){
  return (orders||[]).filter(o=>orderEtrnWaitingCustomer(o)).length;
}
function adminEtrnWaitDriverCount(orders){
  return (orders||[]).filter(o=>orderEtrnWaitingDriver(o)).length;
}
function orderEtrnSectionHtml(o){
  if(!orderEtrnVisible(o)) return '';
  const et=o.etrn;
  const needsMine=orderEtrnNeedsMySignature(o);
  const banner=needsMine
    ? `<div class="etrn-sign-banner" role="status"><strong>Нужна ваша подпись перевозчика (T2)</strong><span class="hint">Подпишите на погрузке — иначе ЭТrН не закроется.</span></div>`
    : '';
  const tituls=et&&et.tituls?Object.entries(et.tituls).map(([k,v])=>{
    const isMine=k==='t2'&&orderEtrnWeAreCarrier(o);
    const rowCls=isMine&&v==='pending'?' etrn-titul-row--mine':'';
    const canSign=et.sandbox&&v!=='signed'&&(isMine||typeof isSuperAdmin==='function'&&isSuperAdmin());
    const btn=canSign?`<button type="button" class="primary etrn-titul-sign" data-order-id="${esc(o.id)}" data-titul="${esc(k)}">Подписать</button>`:'';
    const stLbl=etrnTitulStatusLabel(v);
    const stSpan=`<span class="etrn-titul-st ${v==='signed'?'ok':(isMine&&v==='pending'?'warn':'')}">${esc(stLbl)}</span>`;
    return `<div class="calc-row etrn-titul-row${rowCls}"><span>${esc(etrnTitulLabel(k))}<br><span class="hint">${esc(etrnTitulWhenHint(k))}</span></span><span class="etrn-titul-actions">${stSpan}${btn}</span></div>`;
  }).join(''):'';
  const epd=state.settings&&state.settings.epdOperator?String(state.settings.epdOperator):'';
  const head=et
    ? `<p class="hint">Оператор: <strong>${esc(et.operatorId||epd||'—')}</strong> · ID: ${esc(et.externalId||'—')}${et.sandbox?' · sandbox':''} · ${esc(et.status||'draft')}</p>
       ${et.createdAt?`<p class="hint">Создан: ${esc(dateTime(et.createdAt))}</p>`:''}
       ${tituls?`<div class="calc etrn-tituls-panel">${tituls}</div>`:''}
       ${et.lastError?`<p class="error">${esc(et.lastError)}</p>`:''}`
    : `<p class="hint">ЭТрН создаётся при назначении водителя и ТС. T1 грузоотправитель — до выезда с грузом (не со стоянки). T2 перевозчик на погрузке, T3 грузополучатель, T4 перевозчик на выгрузке. QR — после T1.${epd?` Оператор: ${esc(epd)}.`:''}</p>`;
  const printBtn=et?`<button type="button" class="secondary" id="etrn-print" data-order-id="${esc(o.id)}">Печать / PDF</button>`:'';
  return `
    <section class="form-section etrn-admin-section" id="etrn-section">
      <h2 class="form-section-title">ЭТрН</h2>
      <div class="etrn-section-body">
        ${etrnT1KepHintHtml(true)}
        ${banner}
        ${head}
        <div class="row etrn-section-actions">
          <button type="button" class="secondary" id="etrn-create" ${et?'disabled':''}>${et?'ЭТрН создан':'Создать ЭТрН'}</button>
          ${printBtn}
          <span class="hint" id="etrn-status"></span>
        </div>
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
function ensureDriverEtrnQrOverlay(){
  let el=$('driver-etrn-qr-overlay');
  if(el) return el;
  el=document.createElement('div');
  el.id='driver-etrn-qr-overlay';
  el.className='driver-etrn-qr-overlay';
  el.hidden=true;
  el.innerHTML=`<div class="driver-etrn-qr-panel" role="dialog" aria-modal="true" aria-labelledby="driver-etrn-qr-title">
    <header class="form-topbar"><button type="button" class="form-back" id="driver-etrn-qr-close">← Назад</button><h1 id="driver-etrn-qr-title">ЭТrН</h1></header>
    <div class="panel-body" id="driver-etrn-qr-body"></div>
  </div>`;
  document.body.appendChild(el);
  const close=()=>{ el.hidden=true; const b=$('driver-etrn-qr-body'); if(b) b.innerHTML=''; };
  $('driver-etrn-qr-close').onclick=close;
  el.addEventListener('click',e=>{ if(e.target===el) close(); });
  return el;
}
function driverEtrnShowQr(orderId){
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o) return;
  if(!o.etrn && typeof ensureEtrnForOrder==='function') ensureEtrnForOrder(o, {silent:true});
  if(typeof orderEtrnQrAllowed==='function'&&!orderEtrnQrAllowed(o)){
    alert('QR появится после подписи T1 грузоотправителем. Без T1 накладная для инспектора не формируется.');
    return;
  }
  const canvas=drawEtrnQrCanvas(etrnQrPayload(o), 200);
  if(!canvas){ alert('QR недоступен — обновите приложение'); return; }
  const overlay=ensureDriverEtrnQrOverlay();
  const body=$('driver-etrn-qr-body');
  const title=$('driver-etrn-qr-title');
  if(title) title.textContent=`ЭТrН · №${o.sequentialNumber||'—'}`;
  if(body){
    body.innerHTML=`<p class="hint" style="text-align:center;margin:0 0 10px">${esc(routeText(o)||'—')}<br>${esc(o.vehiclePlate||'')} · ${esc(o.driverName||'')}</p>
      <p style="text-align:center;font-weight:700;margin:0 0 12px">Покажите инспектору</p>
      <div class="driver-etrn-qr-canvas-wrap"></div>`;
    const wrap=body.querySelector('.driver-etrn-qr-canvas-wrap');
    if(wrap) wrap.appendChild(canvas);
  }
  overlay.hidden=false;
}
function wireDriverEtrnBannerButtons(root){
  (root||document).querySelectorAll('.banner-etrn-sign').forEach(b=>{
    if(b.dataset.etrnBtnWired) return;
    b.dataset.etrnBtnWired='1';
    b.onclick=()=>{ if(typeof openDriverEtrnSign==='function') openDriverEtrnSign(b.dataset.etrnSign); };
  });
  (root||document).querySelectorAll('.banner-etrn-qr').forEach(b=>{
    if(b.dataset.etrnBtnWired) return;
    b.dataset.etrnBtnWired='1';
    b.onclick=()=>{ if(typeof driverEtrnShowQr==='function') driverEtrnShowQr(b.dataset.etrnQr); };
  });
}
function driverActiveEtrnOrders(){
  if(typeof DRIVER==='undefined' || !DRIVER) return [];
  return (state.orders||[]).filter(o=>{
    if(!o || !orderEtrnTransportActive(o)) return false;
    if(typeof orderBelongsToDriver==='function' && !orderBelongsToDriver(o)) return false;
    if(!o.etrn && typeof ensureEtrnForOrder==='function') ensureEtrnForOrder(o, {silent:true});
    if(!o.etrn) return false;
    return typeof orderEtrnQrAllowed==='function'?orderEtrnQrAllowed(o):true;
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
  const all=etrnAllTitulsSigned(o.etrn);
  const tripClosed=typeof looksClosedOrder==='function'&&looksClosedOrder(o);
  o.etrn.status=(all&&tripClosed)?'signed':'draft';
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
  if(typeof bumpDataEpoch==='function') bumpDataEpoch(`etrn-${titulKey}-sign`);
  persist();
  if((typeof currentCustomer!=='undefined'&&currentCustomer)||(typeof DRIVER!=='undefined'&&DRIVER)){
    if(typeof persistAdminPinImmediate==='function') persistAdminPinImmediate().catch(()=>{});
  }
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
  return typeof orderHasDriverVehicleAssigned==='function'?orderHasDriverVehicleAssigned(o):true;
}
function customerEtrnT3Pending(o){
  if(!o||!o.etrn||!o.etrn.tituls) return false;
  if(o.cancelledAt||looksClosedOrder(o)) return false;
  if(o.etrn.tituls.t3!=='pending') return false;
  if(o.etrn.tituls.t2!=='signed') return false;
  return o.endOdometer!=null || (typeof orderLeftLoading==='function'&&orderLeftLoading(o));
}
function customerCanSignEtrnT3(o){
  // MVP: заказчик в /z подписывает T3 как грузополучатель (или от его имени)
  return !!currentCustomer;
}
function customerEtrnT3SignHtml(o){
  if(!customerEtrnT3Pending(o)) return '';
  if(!customerCanSignEtrnT3(o)) return '';
  return `<div class="cust-etrn-t1-block">
    <strong>ЭТрН · T3 · грузополучатель</strong>
    <p class="hint">Подтвердите приём груза на выгрузке (T3). После этого перевозчик подпишет T4.</p>
    <button type="button" class="primary cust-etrn-t3-sign" data-order-id="${esc(o.id)}">Подписать T3</button>
  </div>`;
}
function customerSignEtrnT3Direct(orderId){
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o){ alert('Заказ не найден'); return false; }
  if(!customerEtrnT3Pending(o)){ alert('Сейчас подпись T3 недоступна.'); return false; }
  const by=(currentCustomer&&currentCustomer.name)||'грузополучатель';
  if(!signEtrnTitul(orderId,'t3',by)) return false;
  if(typeof renderCustomerPortal==='function') renderCustomerPortal();
  return true;
}
function customerEtrnT1WaitingPhase(o){
  return false;
}
function customerEtrnT1CardHtml(o){
  if(typeof customerEtrnT1SignHtml==='function'){
    const sign=customerEtrnT1SignHtml(o);
    if(sign) return sign;
  }
  const t3=typeof customerEtrnT3SignHtml==='function'?customerEtrnT3SignHtml(o):'';
  if(t3) return t3;
  if(!o.etrn&&typeof orderEtrnEligible==='function'&&orderEtrnEligible(o)&&!looksClosedOrder(o)&&!o.cancelledAt){
    if(typeof orderHasDriverVehicleAssigned==='function'&&orderHasDriverVehicleAssigned(o)){
      return `<div class="cust-etrn-t1-block cust-etrn-t1-block--wait">
        <strong>ЭТрН</strong>
        <p class="hint">Накладная создаётся при назначении машины. Нужна подпись T1 до выезда водителя.</p>
      </div>`;
    }
  }
  if(!customerEtrnT1WaitingPhase(o)) return '';
  if(customerCanSignEtrnT1(o)){
    return `<div class="cust-etrn-t1-block cust-etrn-t1-block--wait">
      <strong>ЭТрН · T1</strong>
      <p class="hint">Транспортная накладная: подпись появится, когда водитель приедет на погрузку. Обновите страницу или включите уведомления.</p>
    </div>`;
  }
  const url=shipperEtrnT1SignUrl(o);
  const ship=orderShipperInfo(o);
  const shipLine=ship.name?`${esc(ship.name)}${ship.phone?` · ${esc(formatPhone(ship.phone))}`:''}`:'грузоотправитель';
  return `<div class="cust-etrn-t1-block cust-etrn-t1-block--wait">
    <strong>ЭТрН · T1 · ${shipLine}</strong>
    <p class="hint">Грузоотправитель не вы — отправьте ссылку. Подпись откроется у грузоотправителя на погрузке.</p>
    <div class="cust-etrn-t1-actions">
      <button type="button" class="secondary cust-etrn-shipper-copy" data-order-id="${esc(o.id)}" data-url="${esc(url)}">Скопировать ссылку</button>
    </div>
  </div>`;
}
function customerEtrnT1SignHtml(o){
  if(!customerEtrnT1Pending(o)) return '';
  const ship=orderShipperInfo(o);
  const st=etrnTitulStatusLabel('pending');
  if(customerCanSignEtrnT1(o)){
    return `<div class="cust-etrn-t1-block">
      <strong>ЭТрН · T1 · грузоотправитель</strong>
      <p class="hint">Подпишите T1 до выезда с грузом (${st}). Без T1 нельзя уехать от грузоотправителя с грузом. Нужна КЭП.</p>
      ${etrnT1KepHintHtml(true)}
      <button type="button" class="primary cust-etrn-t1-sign" data-order-id="${esc(o.id)}">Подписать T1</button>
    </div>`;
  }
  const url=shipperEtrnT1SignUrl(o);
  const shipLine=ship.name?`${esc(ship.name)}${ship.phone?` · ${esc(formatPhone(ship.phone))}`:''}`:'грузоотправитель';
  return `<div class="cust-etrn-t1-block">
    <strong>ЭТрН · T1 · грузоотправитель</strong>
    <p class="hint">Грузоотправитель: ${shipLine}. Отправьте ссылку для подписи T1 до выезда (${st}) — нужна КЭП.</p>
    ${etrnT1KepHintHtml(true)}
    <div class="cust-etrn-t1-actions">
      <button type="button" class="secondary cust-etrn-shipper-copy" data-order-id="${esc(o.id)}" data-url="${esc(url)}">Скопировать ссылку</button>
      ${ship.phone?`<a class="secondary cust-etrn-shipper-sms" href="sms:${encodeURIComponent(formatPhone(ship.phone))}?body=${encodeURIComponent(shipperEtrnT1SmsText(o))}">SMS грузоотправителю</a>`:''}
    </div>
  </div>`;
}
function customerEtrnT1BannerHtml(opts){
  opts=opts||{};
  if(typeof customerOrders!=='function') return '';
  const canSign=customerOrders().filter(o=>customerEtrnT1Pending(o)&&customerCanSignEtrnT1(o));
  const needLink=customerOrders().filter(o=>customerEtrnT1Pending(o)&&!customerCanSignEtrnT1(o));
  const waiting=customerOrders().filter(o=>customerEtrnT1WaitingPhase(o));
  const parts=[];
  if(canSign.length){
    const btns=canSign.map(o=>
      `<button type="button" class="primary cust-alert-btn cust-etrn-t1-sign" data-order-id="${esc(o.id)}">Подписать № ${esc(o.sequentialNumber||'—')}</button>`
    ).join('');
    const sub=canSign.length===1
      ? `Заявка № ${esc(canSign[0].sequentialNumber||'—')} · T1 до выезда водителя`
      : `${canSign.length} заявки · подпись T1 до выезда`;
    parts.push(`<div class="cust-alert-row cust-alert-row--etrn">
      <span class="cust-alert-row-dot" aria-hidden="true"></span>
      <div class="cust-alert-row-main">
        <span class="cust-alert-row-label">ЭТрН · T1</span>
        <span class="cust-alert-row-sub">${sub}</span>
      </div>
      <div class="cust-alert-row-actions">${btns}</div>
    </div>`);
  }
  if(needLink.length){
    const o=needLink[0];
    const url=shipperEtrnT1SignUrl(o);
    const more=needLink.length>1?` (+${needLink.length-1})`:'';
    parts.push(`<div class="cust-alert-row cust-alert-row--etrn">
      <span class="cust-alert-row-dot" aria-hidden="true"></span>
      <div class="cust-alert-row-main">
        <span class="cust-alert-row-label">ЭТрН · T1</span>
        <span class="cust-alert-row-sub">№ ${esc(o.sequentialNumber||'—')}${more} · отправьте ссылку грузоотправителю</span>
      </div>
      <div class="cust-alert-row-actions">
        <button type="button" class="secondary cust-alert-btn cust-etrn-shipper-copy" data-order-id="${esc(o.id)}" data-url="${esc(url)}">Скопировать ссылку</button>
      </div>
    </div>`);
  }else if(waiting.length&&!canSign.length){
    const o=waiting[0];
    const sub=waiting.length===1
      ? `№ ${esc(o.sequentialNumber||'—')} · T1 после прибытия на погрузку`
      : `${waiting.length} заявки · T1 после погрузки`;
    parts.push(`<div class="cust-alert-row cust-alert-row--etrn cust-alert-row--muted">
      <span class="cust-alert-row-dot" aria-hidden="true"></span>
      <div class="cust-alert-row-main">
        <span class="cust-alert-row-label">ЭТрН · T1</span>
        <span class="cust-alert-row-sub">${sub}</span>
      </div>
    </div>`);
  }
  if(!parts.length) return '';
  if(opts.compact) return parts.join('');
  return `<div class="cust-etrn-banner">${parts.join('')}</div>`;
}
function customerSignEtrnT1Direct(orderId){
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o){ alert('Заказ не найден'); return false; }
  if(!o.etrn&&typeof ensureEtrnForOrder==='function') ensureEtrnForOrder(o, {silent:true});
  if(o.etrn&&o.etrn.tituls&&o.etrn.tituls.t1==='signed'){
    alert('T1 уже подписан по этой заявке.');
    return true;
  }
  if(typeof customerEtrnT1Pending==='function'&&!customerEtrnT1Pending(o)){
    if(typeof customerEtrnT1WaitingPhase==='function'&&customerEtrnT1WaitingPhase(o)){
      alert('Подпись T1 откроется, когда водитель приедет на погрузку.');
    }else{
      alert('Сейчас подпись T1 недоступна. Нажмите «Обновить» в шапке портала.');
    }
    return false;
  }
  const ship=orderShipperInfo(o);
  const by=ship.name||'грузоотправитель';
  if(!signEtrnTitul(orderId,'t1',by)) return false;
  if(typeof renderCustomerPortal==='function') renderCustomerPortal();
  return true;
}
function showCustomerEtrnT1SignDialog(orderId){
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o){ alert('Заказ не найден'); return false; }
  const overlay=$('cust-shipper-etrn-overlay');
  const body=$('cust-shipper-etrn-body');
  if(!overlay||!body) return customerSignEtrnT1Direct(orderId);
  if(!o.etrn&&typeof ensureEtrnForOrder==='function') ensureEtrnForOrder(o, {silent:true});
  const ship=orderShipperInfo(o);
  const t1Signed=o.etrn&&o.etrn.tituls&&o.etrn.tituls.t1==='signed';
  const canSign=typeof customerEtrnT1Pending==='function'&&customerEtrnT1Pending(o);
  const waitLoad=typeof customerEtrnT1WaitingPhase==='function'&&customerEtrnT1WaitingPhase(o);
  let inner='';
  if(t1Signed){
    inner=`<p><strong>T1 подписан.</strong></p><button type="button" class="secondary" id="cust-etrn-t1-close">Закрыть</button>`;
  }else if(!canSign&&waitLoad){
    inner=`<p class="hint">Заявка № ${esc(o.sequentialNumber||'—')}</p>
      <p>Подпись T1 появится, когда водитель на погрузке. Обновите страницу или нажмите «Обновить» в шапке.</p>
      <button type="button" class="secondary" id="cust-etrn-t1-close">Понятно</button>`;
  }else if(!canSign){
    inner=`<p class="hint">Заявка № ${esc(o.sequentialNumber||'—')}</p>
      <p>Подпись T1 пока недоступна. Нажмите «Обновить» в шапке портала.</p>
      <button type="button" class="secondary" id="cust-etrn-t1-close">Закрыть</button>`;
  }else{
    inner=`<p class="hint">Заявка № ${esc(o.sequentialNumber||'—')} · ${esc(routeText(o)||'')}</p>
      <p><strong>${esc(ship.name||'Грузоотправитель')}</strong>, подтвердите отгрузку — подпись T1 в ЭТrН (тестовый контур, без Контура).</p>
      <div class="cust-etrn-t1-actions" style="margin-top:12px">
        <button type="button" class="primary" id="cust-etrn-t1-confirm">Подписать T1</button>
        <button type="button" class="secondary" id="cust-etrn-t1-close">Отмена</button>
      </div>`;
  }
  body.innerHTML=inner;
  overlay.hidden=false;
  const close=()=>{ overlay.hidden=true; };
  const closeBtn=$('cust-etrn-t1-close');
  if(closeBtn) closeBtn.onclick=close;
  overlay.onclick=e=>{ if(e.target===overlay) close(); };
  const confirmBtn=$('cust-etrn-t1-confirm');
  if(confirmBtn){
    confirmBtn.onclick=()=>{
      if(customerSignEtrnT1Direct(orderId)){
        close();
        alert('T1 подписан. Спасибо!');
      }
    };
  }
  return true;
}
function wireCustomerEtrnT1(root){
  (root||document).querySelectorAll('.cust-etrn-t1-sign').forEach(btn=>{
    if(btn.dataset.etrnWired) return;
    btn.dataset.etrnWired='1';
    btn.onclick=()=>{
      const oid=btn.dataset.orderId;
      showCustomerEtrnT1SignDialog(oid);
    };
  });
  (root||document).querySelectorAll('.cust-etrn-t3-sign').forEach(btn=>{
    if(btn.dataset.etrnT3Wired) return;
    btn.dataset.etrnT3Wired='1';
    btn.onclick=()=>{
      if(customerSignEtrnT3Direct(btn.dataset.orderId)) alert('T3 подписан. Спасибо!');
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
  const canSignT1=typeof orderHasDriverVehicleAssigned==='function'?orderHasDriverVehicleAssigned(o):true;
  let inner='';
  if(t1Signed){
    inner=`<p><strong>T1 подписан.</strong> Спасибо, ${esc(ship.name||'грузоотправитель')}.</p>`;
  }else if(!canSignT1){
    inner=`<p class="hint">Заявка № ${esc(o.sequentialNumber||'—')} · ${esc(routeText(o)||'')}</p>
      <p>Подпись T1 откроется после назначения водителя и машины.</p>`;
  }else{
    inner=`<p class="hint">Заявка № ${esc(o.sequentialNumber||'—')} · ${esc(routeText(o)||'')}</p>
      <p><strong>${esc(ship.name||'Грузоотправитель')}</strong>, подпишите T1 до выезда водителя (ЭТрН).</p>
      <button type="button" class="primary" id="cust-shipper-etrn-sign">Подписать T1</button>`;
  }
  body.innerHTML=inner;
  overlay.hidden=false;
  const signBtn=$('cust-shipper-etrn-sign');
  if(signBtn){
    signBtn.onclick=()=>{
      if(customerSignEtrnT1Direct(orderId)){
        renderShipperEtrnT1Overlay(orderId, token);
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
  // Автоподпись отключена: T2 ставит перевозчик/водитель на погрузке вручную.
  return false;
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
    if(t.t2==='pending'&&t.t1==='signed'&&orderEtrnLoadingPhase(o)) return true;
    if(t.t4==='pending'&&t.t3==='signed'&&o.endOdometer!=null) return true;
    return false;
  });
}
function driverEtrnTitulsPending(o){
  const t=o&&o.etrn&&o.etrn.tituls||{};
  const labels=[];
  if(t.t1==='pending'&&orderEtrnLoadingPhase(o)) labels.push('T1 грузоотправитель');
  if(t.t2==='pending') labels.push('T2 приём (перевозчик)');
  if(t.t3==='pending') labels.push('T3 грузополучатель');
  if(t.t4==='pending') labels.push('T4 выдача (перевозчик)');
  return labels.join(', ');
}
function driverEtrnSignUrl(order){
  const et=order&&order.etrn;
  if(!et) return null;
  if(et.signUrl && !String(et.signUrl).startsWith('sandbox://')) return et.signUrl;
  if(et.driverSignUrl && !String(et.driverSignUrl).startsWith('sandbox://')) return et.driverSignUrl;
  return null;
}
function driverEtrnOrderCardHtml(o){
  if(typeof orderTransportDocUsesEtrn==='function'&&!orderTransportDocUsesEtrn(o)) return '';
  if(!o||!o.etrn||!o.etrn.tituls||typeof orderBelongsToDriver==='function'&&!orderBelongsToDriver(o)) return '';
  const t=o.etrn.tituls;
  const lbl=(k,v)=>{
    if(v==='signed') return `${k} ✓`;
    if(k==='T1'&&v==='pending') return 'T1 — ждёт ГО';
    if(k==='T2'&&v==='pending') return 'T2 — ваш приём';
    if(k==='T3'&&v==='pending') return 'T3 — грузополучатель';
    if(k==='T4'&&v==='pending') return 'T4 — ваша выдача';
    return '';
  };
  const line=['T1','T2','T3','T4'].map((k,i)=>lbl(k,t['t'+(i+1)])).filter(Boolean).join(' · ');
  let btn='';
  if(t.t1==='signed'&&t.t2==='pending'&&orderEtrnLoadingPhase(o)){
    btn=`<button type="button" class="secondary drv-etrn-sign" data-id="${esc(o.id)}">Подписать T2</button>`;
  }else if(t.t2==='signed'&&t.t3==='pending'&&(o.endOdometer!=null||orderLeftLoading(o))){
    btn=`<span class="hint">Ждём T3 у грузополучателя</span>`;
  }else if(t.t3==='signed'&&t.t4==='pending'){
    btn=`<button type="button" class="secondary drv-etrn-sign" data-id="${esc(o.id)}">Подписать T4</button>`;
  }else if(t.t1==='pending'&&typeof orderEtrnLoadingPhase==='function'&&orderEtrnLoadingPhase(o)){
    btn=`<span class="hint">Сначала T1 у грузоотправителя</span>`;
  }
  return `<div class="drv-etrn-row" style="margin-top:6px;font-size:.82rem"><strong>ЭТrН:</strong> ${esc(line)} ${btn}</div>`;
}
async function openDriverEtrnSign(orderId){
  const o=(state.orders||[]).find(x=>x.id===orderId);
  if(!o) return;
  if(!o.etrn&&typeof ensureEtrnForOrder==='function') ensureEtrnForOrder(o, {silent:true});
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
    alert(`ЭТрН: ждём подпись T1 от грузоотправителя · заказ №${o.sequentialNumber}\n\n${orderShipperSameAsCustomer(o)?'Попросите заказчика подписать в личном кабинете (/z).':'Заказчик отправит ссылку грузоотправителю.'}`);
    return;
  }
  const sandbox=o.etrn&&(o.etrn.sandbox!==false);
  if(sandbox){
    if(t.t2==='pending'){
      if(!orderEtrnLoadingPhase(o)){
        alert(`ЭТрН · заказ №${o.sequentialNumber}\n\nT2 (приём перевозчиком) — на погрузке. Сначала «Прибыл на загрузку».`);
        return;
      }
      if(confirm(`Подписать T2 (приём груза перевозчиком на погрузке) · заказ №${o.sequentialNumber}?`)){
        signEtrnTitul(orderId,'t2',typeof DRIVER!=='undefined'&&DRIVER?DRIVER:'водитель');
        renderDriverBanner();
        if(typeof showOrders==='function'&&document.querySelector('#orders-panel.show')) showOrders();
        alert('T2 подписан.');
      }
      return;
    }
    if(t.t3==='pending'){
      alert(`ЭТрН · заказ №${o.sequentialNumber}\n\nЖдём T3 у грузополучателя (кабинет /z). Затем подпишете T4 (выдача).`);
      return;
    }
    if(t.t4==='pending'){
      if(t.t3!=='signed'){
        alert(`ЭТрН · заказ №${o.sequentialNumber}\n\nСначала T3 у грузополучателя.`);
        return;
      }
      if(confirm(`Подписать T4 (выдача груза перевозчиком на выгрузке) · заказ №${o.sequentialNumber}?`)){
        if(typeof signEtrnTitulSandboxAuto==='function') signEtrnTitulSandboxAuto(orderId,'t4',typeof DRIVER!=='undefined'&&DRIVER?DRIVER:'водитель');
        else signEtrnTitul(orderId,'t4',typeof DRIVER!=='undefined'&&DRIVER?DRIVER:'водитель');
        renderDriverBanner();
        if(typeof showOrders==='function'&&document.querySelector('#orders-panel.show')) showOrders();
        alert('T4 подписан.');
      }
      return;
    }
    alert(`ЭТрН · заказ №${o.sequentialNumber}\nВсе ваши шаги подписаны или ждут предыдущие титулы.\nQR — кнопка «Показать QR ЭТрН» на Главной.`);
    return;
  }
  const pendingTitul=t.t4==='pending'&&t.t3==='signed'?'t4':(t.t2==='pending'?'t2':null);
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
  alert(`ЭТrН · заказ №${o.sequentialNumber||'—'}\n${pending||'Подписи в порядке'}\n\nQR — «Показать QR ЭТrН» на Главной.`);
}
function driverEtrnBannerHtml(){
  let html='';
  const active=typeof driverActiveEtrnOrders==='function'?driverActiveEtrnOrders():[];
  active.forEach(o=>{
    const et=o.etrn||{};
    html+=`<div class="driver-etrn-qr-block">
      <strong>ЭТрН · заказ № ${esc(o.sequentialNumber||'—')}</strong>
      <p class="hint">Покажите QR инспектору в пути. QR после T1. Выезд со стоянки — без T1. T1+T2 — до выезда с грузом. T3 — грузополучатель, T4 — выдача.</p>
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
