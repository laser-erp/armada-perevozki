/* АРМАДА driver UI: session / chat / ETO / orders / history (phase2 chunk C) */
function openShiftBlocksExit(){
  if(!DRIVER) return false;
  try{
    const live=(state.shift && !state.shift.endedAt && !state.shift.abandoned)?state.shift:null;
    const open=(typeof findOpenShift==='function'?findOpenShift():null)||live;
    if(!open || open.endedAt || open.abandoned) return false;
    return true;
  }catch(_){ return false; }
}
function armExitGuard(){
  if(typeof history==='undefined'||!history.pushState) return;
  if(!openShiftBlocksExit()) return;
  try{
    if(!history.state || !history.state.armadaExitGuard){
      history.pushState({armadaExitGuard:1}, '', location.href);
    }
  }catch(_){}
}
function handleBlockedExit(){
  armExitGuard();
  if(typeof shiftAwaitingClose==='function' && shiftAwaitingClose()){
    state.error='Сначала закройте смену — укажите одометр на стоянке';
    try{ startCloseShift(); }catch(_){ renderInput(); }
    return;
  }
  state.error='Смена ещё открыта. Закройте смену перед выходом из приложения';
  try{ maybeNudgeCloseShift(true); }catch(_){}
  renderInput();
  renderDriverBanner();
}
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState==='visible'){
      pullRemoteUpdates('visible');
      maybeNudgeCloseShift(false);
      renderDriverBanner();
      armExitGuard();
    } else if(openShiftBlocksExit()){
      // Полностью запретить свернуть нельзя — при возврате снова напомним
      try{ sessionStorage.setItem('armada_exit_blocked','1'); }catch(_){}
    }
  });
  window.addEventListener('pageshow', ()=>{
    try{
      if(sessionStorage.getItem('armada_exit_blocked')==='1' && openShiftBlocksExit()){
        sessionStorage.removeItem('armada_exit_blocked');
        handleBlockedExit();
      }
    }catch(_){}
    armExitGuard();
  });
  window.addEventListener('beforeunload', (e)=>{
    if(openShiftBlocksExit()){
      e.preventDefault();
      e.returnValue='Смена не закрыта. Закройте смену перед выходом.';
      return e.returnValue;
    }
  });
  window.addEventListener('popstate', ()=>{
    if(openShiftBlocksExit()){
      handleBlockedExit();
    }
  });
  // Capacitor (Android): кнопка «Назад» — не выходим, пока смена открыта
  (function bindNativeBackGuard(){
    try{
      const Cap=window.Capacitor;
      if(!Cap || typeof Cap.isNativePlatform!=='function' || !Cap.isNativePlatform()) return;
      const App=Cap.Plugins&&Cap.Plugins.App;
      if(App && typeof App.addListener==='function'){
        App.addListener('backButton', ({canGoBack})=>{
          if(openShiftBlocksExit()){
            handleBlockedExit();
            return;
          }
          if(canGoBack) history.back();
          else if(typeof App.exitApp==='function') App.exitApp();
        });
      }
    }catch(_){}
  })();
  armExitGuard();
}
function saveDriverSession(){
  try{
    localStorage.setItem(DRIVER_SESSION_KEY, JSON.stringify({
      name:DRIVER, companyId:DRIVER_COMPANY_ID||null, at:new Date().toISOString()
    }));
  }catch(_){}
}
function clearDriverSession(){
  try{ localStorage.removeItem(DRIVER_SESSION_KEY); }catch(_){}
  DRIVER="";
  DRIVER_COMPANY_ID=null;
}
function restoreDriverSession(){
  let raw=null;
  try{ raw=JSON.parse(localStorage.getItem(DRIVER_SESSION_KEY)||'null'); }catch(_){ raw=null; }
  if(!raw||!raw.name) return false;
  const rec=findDriverRecord(raw.name, raw.companyId)||findDriverRecord(raw.name, null);
  if(!rec){ clearDriverSession(); return false; }
  DRIVER=rec.name;
  DRIVER_COMPANY_ID=rec.companyId||raw.companyId||null;
  if(!DRIVER_COMPANY_ID){
    const bind=typeof resolveDriverOrderBinding==='function'?resolveDriverOrderBinding(rec.name, ''):{};
    DRIVER_COMPANY_ID=bind.ownCompanyId||null;
  }
  if(DRIVER_COMPANY_ID && !rec.companyId){
    rec.companyId=DRIVER_COMPANY_ID;
    const co=findCompanyById(DRIVER_COMPANY_ID);
    if(co && !rec.companyName) rec.companyName=co.name;
  }
  return true;
}
function peekAdminSessionName(){
  if(currentAdmin && currentAdmin.name) return currentAdmin.name;
  try{
    const raw=JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY)||'null');
    return (raw && raw.name)||'';
  }catch(_){ return ''; }
}
function setDriverNav(which){
  const active=which||'btn-home';
  ['btn-home','btn-orders','btn-shifts','btn-cabinet'].forEach(id=>{
    const b=$(id); if(!b) return;
    const on=id===active;
    b.classList.toggle('on', on);
    if(on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
}
function showDriverHome(){
  hideDriverPanels();
  setDriverNav('btn-home');
  updateDriverChrome();
  renderDriverHome();
}
function driverTodayLabel(){
  const d=new Date();
  const dd=String(d.getDate()).padStart(2,'0');
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const yyyy=d.getFullYear();
  return `${dd}:${mm}:${yyyy}`;
}
function driverHomeActiveOrders(){
  return (state.orders||[])
    .filter(o=>o && !looksClosedOrder(o) && !o.cancelledAt && !o.onExchange && orderBelongsToDriver(o))
    .sort((a,b)=>(a.sequentialNumber||0)-(b.sequentialNumber||0));
}
function driverHomeStats(){
  const s=(state.shift&&!state.shift.endedAt)?state.shift:(findOpenShift()||null);
  const todayKey=dayKeyFromIso(new Date().toISOString());
  const mine=(state.orders||[]).filter(o=>o && !o.cancelledAt && orderBelongsToDriver(o));
  const inShiftIds=new Set(((s&&s.orders)||[]).map(o=>o&&o.id).filter(Boolean));
  const today=mine.filter(o=>{
    if(inShiftIds.has(o.id)) return true;
    return dayKeyFromIso(o.closedAt||o.createdAt)===todayKey;
  });
  const done=today.filter(o=>looksClosedOrder(o));
  const active=driverHomeActiveOrders();
  let km=0;
  today.forEach(o=>{ const t=dayTotal(o); if(t!=null) km+=t; });
  if(s && s.odometer!=null){
    const end=s.lastOdometerPoint!=null?+s.lastOdometerPoint:(s.parkingOdometer!=null?+s.parkingOdometer:null);
    if(end!=null && end>+s.odometer){
      const byOdo=end-+s.odometer;
      if(byOdo>km) km=byOdo;
    }
  }
  let pay=0;
  today.forEach(o=>{ const p=effectivePay(o); if(p!=null) pay+=p; });
  let shiftCls='';
  let shiftVal='Нет';
  if(s){
    if(shiftAwaitingClose(s)){ shiftVal='Закрыть'; shiftCls='warn'; }
    else if(!isEtoDone(s)){ shiftVal='ЕТО'; shiftCls='warn'; }
    else { shiftVal='Открыта'; shiftCls='ok'; }
  }
  return {s, km:Math.round(km), done:done.length, activeCount:active.length, pay, shiftVal, shiftCls, active};
}
function renderDriverHome(){
  const sumEl=$('driver-home-summary');
  const listEl=$('driver-home-orders');
  const homeEl=$('driver-home');
  if(!sumEl || !listEl || !homeEl) return;
  if(!DRIVER || !document.querySelector('#driver.show')){
    homeEl.style.display='none';
    return;
  }
  homeEl.style.display='flex';
  const st=driverHomeStats();
  sumEl.innerHTML=`
    <div class="m"><span>Смена</span><b class="${esc(st.shiftCls)}">${esc(st.shiftVal)}</b></div>
    <div class="m"><span>Км сегодня</span><b>${esc(fmt(st.km))}</b></div>
    <div class="m"><span>Заказы</span><b>${st.done}${st.activeCount?`+${st.activeCount}`:''}</b></div>
    <div class="m"><span>Заработок</span><b class="accent">${st.pay?esc(fmt(st.pay))+' ₽':'—'}</b></div>`;
  if(!st.active.length){
    listEl.innerHTML='';
    return;
  }
  listEl.innerHTML=st.active.map(o=>driverOrderCardHtml(o,{compact:true, home:true})).join('');
  wireDriverOrderCards(listEl);
}
function updateDriverChrome(){
  const t=$('driver-title');
  const sub=$('driver-sub');
  const chip=$('driver-shift-chip');
  const buildEl=$('driver-build');
  if(buildEl) buildEl.textContent=driverTodayLabel();
  if(!DRIVER){
    if(t){ t.textContent='Водитель'; t.title=''; }
    if(sub) sub.textContent='';
    if(chip){ chip.hidden=true; chip.textContent=''; chip.className='driver-shift-chip'; }
    renderDriverHome();
    return;
  }
  const firm=typeof driverSessionCompanyLabel==='function'?driverSessionCompanyLabel(DRIVER_COMPANY_ID, DRIVER)
    :(DRIVER_COMPANY_ID?((findCompanyById(DRIVER_COMPANY_ID)||{}).name||''):'');
  if(t){ t.textContent=DRIVER; t.title=firm?`${DRIVER} · ${firm}`:DRIVER; }
  if(sub) sub.textContent=firm||'';
  if(chip){
    const s=state.shift||findOpenShift();
    if(s && !s.endedAt){
      const needClose=shiftAwaitingClose();
      const etoOk=isEtoDone(s);
      chip.hidden=false;
      chip.textContent=needClose?'Закройте смену':(etoOk?(s.vehiclePlate?`Смена · ${s.vehiclePlate}`:'Смена открыта'):etoStepLabel(s));
      chip.className='driver-shift-chip '+(needClose?'warn':(etoOk?'ok':'wait'));
    } else {
      chip.hidden=true;
      chip.textContent='';
      chip.className='driver-shift-chip';
    }
  }
  renderDriverHome();
  updateDriverNetHint();
}
function driverPickRows(preferName){
  const rows=(state.drivers||[]).filter(d=>(d.name||'').trim());
  const prefer=String(preferName||'').trim();
  rows.sort((a,b)=>{
    const aYou=prefer && samePersonName(a.name, prefer)?0:1;
    const bYou=prefer && samePersonName(b.name, prefer)?0:1;
    if(aYou!==bYou) return aYou-bYou;
    const fa=a.companyName||'', fb=b.companyName||'';
    const c=fa.localeCompare(fb,'ru');
    if(c) return c;
    return String(a.name).localeCompare(String(b.name),'ru');
  });
  return rows;
}
let driverLoginStep='phone';
let driverLoginCandidates=[];
let driverLoginSelected=null;
function driverLoginPhoneEl(){ return $('drv-login-phone'); }
function driverLoginPinWrap(){ return $('drv-login-pin-wrap'); }
function driverLoginPickPanel(){ return $('driver-pick-panel'); }
function resetDriverLoginUi(){
  driverLoginStep='phone';
  driverLoginCandidates=[];
  driverLoginSelected=null;
  const pinWrap=driverLoginPinWrap();
  const pick=driverLoginPickPanel();
  const phoneOk=$('drv-login-phone-ok');
  const loginOk=$('drv-login-ok');
  if(pinWrap) pinWrap.style.display='none';
  if(pick) pick.style.display='none';
  if(phoneOk) phoneOk.style.display='';
  if(loginOk) loginOk.style.display='none';
}
function showDriverPinStep(){
  driverLoginStep='pin';
  const pinWrap=driverLoginPinWrap();
  const pick=driverLoginPickPanel();
  const phoneOk=$('drv-login-phone-ok');
  const loginOk=$('drv-login-ok');
  if(pick) pick.style.display='none';
  if(pinWrap) pinWrap.style.display='';
  if(phoneOk) phoneOk.style.display='none';
  if(loginOk) loginOk.style.display='';
  const pinEl=$('drv-login-pin');
  if(pinEl){ pinEl.value=''; setTimeout(()=>pinEl.focus(), 40); }
}
function showDriverPickStep(list){
  driverLoginStep='pick';
  driverLoginCandidates=list||[];
  const pick=driverLoginPickPanel();
  const listEl=$('driver-pick-list');
  const pinWrap=driverLoginPinWrap();
  const phoneOk=$('drv-login-phone-ok');
  const loginOk=$('drv-login-ok');
  if(pinWrap) pinWrap.style.display='none';
  if(phoneOk) phoneOk.style.display='none';
  if(loginOk) loginOk.style.display='none';
  if(!pick||!listEl) return;
  pick.style.display='block';
  listEl.innerHTML=driverLoginCandidates.map((d,i)=>{
    const firm=typeof driverCompanyLabel==='function'?driverCompanyLabel(d):(d.companyName||(d.companyId&&(findCompanyById(d.companyId)||{}).name)||'');
    return `<button type="button" class="secondary role-btn" data-drv-pick="${i}" style="margin-bottom:8px">
      <span class="role-btn-title">${esc(d.name||'—')}</span>
      <span class="role-btn-desc">${esc(firm||'фирма')}</span>
    </button>`;
  }).join('');
  listEl.querySelectorAll('[data-drv-pick]').forEach(btn=>{
    btn.onclick=()=>{
      const idx=+btn.dataset.drvPick;
      driverLoginSelected=driverLoginCandidates[idx];
      if(!driverLoginSelected) return;
      showDriverPinStep();
    };
  });
}
function continueDriverPhone(){
  migrateDriverPins();
  const err=$('drv-login-error');
  const showErr=msg=>{ if(err) err.textContent=msg; };
  showErr('');
  const phone=formatPhone((driverLoginPhoneEl()&&driverLoginPhoneEl().value||'').trim());
  if(!phone){ showErr('Введите телефон'); return; }
  tryDriverPhoneLogin(phone, showErr);
}
async function tryDriverPhoneLogin(phone, showErr){
  let byPhone=findDriversByPhone(phone);
  if(!byPhone.length && typeof refreshAuthFromServer==='function'){
    await refreshAuthFromServer({pin:'sync', meta:{role:'driver'}});
    byPhone=findDriversByPhone(phone);
  }
  if(!byPhone.length){
    showErr('Телефон не найден. Админ должен указать его в «Справочники → Водители».');
    return;
  }
  const uniqNames=new Set(byPhone.map(d=>String(d.name||'').trim().toLowerCase()).filter(Boolean));
  if(byPhone.length===1 || uniqNames.size===1){
    driverLoginSelected=byPhone[0];
    showDriverPinStep();
    return;
  }
  const sorted=byPhone.slice().sort((a,b)=>{
    const fa=a.companyName||'', fb=b.companyName||'';
    const c=fa.localeCompare(fb,'ru');
    if(c) return c;
    return String(a.name).localeCompare(String(b.name),'ru');
  });
  showDriverPickStep(sorted);
}
function openDriverLogin(fromAdmin){
  setDriverFromAdmin(!!fromAdmin);
  migrateSpaces();
  let dirty=ensureFleetPerSpaces();
  if(migrateDriverPins()) dirty=true;
  if(dirty){ bumpDataEpoch('driver-login-prep'); persist(); }
  DRIVER='';
  DRIVER_COMPANY_ID=null;
  resetDriverLoginUi();
  const err=$('drv-login-error'); if(err) err.textContent='';
  const phoneEl=driverLoginPhoneEl();
  const pinEl=$('drv-login-pin');
  if(pinEl) pinEl.value='';
  // Если зашли из админки — подставить телефон своего водительского профиля
  if(phoneEl){
    let prefill='';
    const you=peekAdminSessionName();
    if(you){
      const myCo=currentOwnCompany();
      const rec=(myCo&&findDriverRecord(you, myCo.id))||findDriverRecord(you, null)
        || (state.drivers||[]).find(d=>samePersonName(d.name, you) && formatPhone(d.phone||''));
      if(rec) prefill=formatPhone(rec.phone||'');
    }
    phoneEl.value=prefill;
  }
  const back=$('driver-login-back');
  if(back){
    back.onclick=()=>{
      if(fromAdmin && (currentAdmin || restoreAdminSession())){
        show('admin');
        if(typeof renderAdmin==='function') renderAdmin();
        return;
      }
      backFromEntryLogin({fromAdmin:false});
    };
  }
  show('driver-login');
  applyEntrySkin('driver-login');
  setTimeout(()=>{
    const focusEl=(phoneEl && phoneEl.value)?($('drv-login-pin')||phoneEl):($('drv-login-phone')||phoneEl);
    if(focusEl && focusEl.focus) focusEl.focus();
  }, 50);
}
/** Обратная совместимость со старыми вызовами. */
function openDriverPick(fromAdmin){ openDriverLogin(fromAdmin); }
function loginDriver(){
  migrateDriverPins();
  const err=$('drv-login-error');
  const showErr=msg=>{ if(err) err.textContent=msg; };
  if(driverLoginStep==='phone'){ continueDriverPhone(); return; }
  doLoginDriverPin(showErr);
}
async function doLoginDriverPin(showErr){
  const phone=formatPhone((driverLoginPhoneEl()&&driverLoginPhoneEl().value||'').trim());
  const pin=(($('drv-login-pin')||{}).value||'').trim();
  if(!phone){ showErr('Введите телефон'); return; }
  if(!pin||pin.length<4){ showErr('Введите PIN (от 4 цифр)'); return; }
  let rec=driverLoginSelected;
  if(rec){
    if(formatPhone(rec.phone||'')!==phone){ showErr('Телефон не совпадает с выбранным профилем'); return; }
    if(resolveDriverPin(rec)!==pin){ showErr('Неверный PIN'); return; }
  } else {
    let byPhone=findDriversByPhone(phone);
    if(!byPhone.length && typeof refreshAuthFromServer==='function'){
      await refreshAuthFromServer({pin:'sync', meta:{role:'driver'}});
      byPhone=findDriversByPhone(phone);
    }
    if(!byPhone.length){
      showErr('Телефон не найден. Админ должен указать его в «Справочники → Водители».');
      return;
    }
    const matched=byPhone.filter(d=>resolveDriverPin(d)===pin);
    if(!matched.length){ showErr('Неверный PIN'); return; }
    if(matched.length>1){
      showDriverPickStep(matched);
      showErr('Выберите профиль и введите PIN снова');
      return;
    }
    rec=matched[0];
  }
  if(!rec){ showErr('Профиль водителя не найден'); return; }
  if(String(rec.pin||'').trim()!==pin){
    rec.pin=pin;
    findDriversByPhone(phone).forEach(d=>{ if(samePersonName(d.name, rec.name)) d.pin=pin; });
    bumpDataEpoch('driver-pin-bind');
    persist();
  }
  enterAsDriver(rec);
}
async function enterAsDriver(rec){
  if(!rec||!rec.name) return;
  DRIVER=String(rec.name||'').trim();
  if(!DRIVER){ alert('Не выбрано ФИО водителя'); return; }
  DRIVER_COMPANY_ID=rec.companyId||null;
  if(!DRIVER_COMPANY_ID){
    const bind=resolveDriverOrderBinding(DRIVER, '');
    DRIVER_COMPANY_ID=bind.ownCompanyId||null;
  }
  if(DRIVER_COMPANY_ID){
    if(!rec.companyId) rec.companyId=DRIVER_COMPANY_ID;
    const lbl=typeof driverCompanyLabel==='function'?driverCompanyLabel(rec):'';
    if(lbl && rec.companyName!==lbl){ rec.companyName=lbl; bumpDataEpoch('driver-company-label'); persist(); }
  }
  // Админ-сессию в localStorage оставляем — из водителя можно вернуться.
  // В памяти currentAdmin сбрасываем, чтобы режим водителя не смешивался с правами админа.
  if(currentAdmin){
    saveAdminSession();
    stopPresenceHeartbeat();
    currentAdmin=null;
  }
  saveDriverSession();
  updateDriverChrome();
  show('driver');
  setDriverNav('btn-home');
  state.shift=null;
  resetChat();
  const firm=typeof driverSessionCompanyLabel==='function'?driverSessionCompanyLabel(DRIVER_COMPANY_ID, DRIVER)
    :(DRIVER_COMPANY_ID?((findCompanyById(DRIVER_COMPANY_ID)||{}).name||''):'');
  if(!(state.messages||[]).some(m=>String(m.text||'').includes('Вы вошли как'))){
    state.messages.unshift({author:'bot', text:`Вы вошли как ${DRIVER}${firm?' · '+firm:''}.`});
  }
  renderChat();
  renderInput();
  renderDriverBanner();
  if(window.ArmadaOnboarding) ArmadaOnboarding.maybeDriver();
  // Сервер — в фоне, не блокируем UI
  (async()=>{
    try{
      const localOrders=(state.orders||[]).map(o=>structuredClone(o));
      const recState=await fetchServerState(FETCH_PREFLIGHT_MS);
      if(recState){
        pbRecordId=recState.id;
        applyPayload(recState.payload||{}, {keepOrders:localOrders, remoteSeq:true});
        migrateEtoFromMessages();
        localStorage.setItem(KEY, JSON.stringify(snapshot()));
        state.shift=null;
        resetChat();
        if(!(state.messages||[]).some(m=>String(m.text||'').includes('Вы вошли как'))){
          state.messages.unshift({author:'bot', text:`Вы вошли как ${DRIVER}${firm?' · '+firm:''}.`});
        }
        renderChat();
        renderInput();
        renderDriverBanner();
      }
    }catch(err){ console.warn('enterAsDriver sync', err); }
  })();
}
function leaveDriverMode(){
  clearDriverSession();
  state.shift=null; state.step='idle'; state.orderStep='idle'; state.messages=[]; state.draft={}; state.error='';
  if(isDriverFromAdmin() && restoreAdminSession()){
    setDriverFromAdmin(false);
    show('admin');
    if(typeof renderAdmin==='function') renderAdmin();
  } else if(getEntryMode()==='driver'){
    openDriverLogin(false);
  } else {
    show('roles');
  }
}
/** Восстановить вход после обновления страницы (без повторного PIN). */
function renderChat(){
  const n=state.messages.length;
  $('chat').innerHTML=state.messages.map((m,i)=>`<div class="bubble ${m.author}${i===n-1?' bubble-in':''}">${esc(m.text)}</div>`).join('');
  $('chat').scrollTop=$('chat').scrollHeight; renderInput();
}
function fluidButtons(){ return FLUIDS.map(l=>`<button class="secondary fluid" data-level="${l}">${l}</button>`).join(''); }
function lightsUI(){
  const rows=[["lowBeam","Ближний свет"],["brake","Стоп-сигналы"],["turn","Указатели поворотов"]];
  return rows.map(([k,t])=>`<div><div class="hint">${t}</div><div class="yesno">
    <button data-key="${k}" data-val="Да" class="${state.light[k]==='Да'?'primary':''}">Да</button>
    <button data-key="${k}" data-val="Нет" class="${state.light[k]==='Нет'?'primary':''}">Нет</button></div></div>`).join('')+`<button class="primary" id="lights-ok">Отправить</button>`;
}
function renderInput(){
  const err=state.error?`<div class="error">${esc(state.error)}</div>`:'';
  let html=err; const os=state.orderStep;
  if(os==='chooseVehicle') html+=plates().map(p=>`<button class="secondary plate" data-plate="${esc(p)}">${esc(p)}</button>`).join('');
  else if(os==='closePrevShiftParking'){
    const min=state.draft&&state.draft.prevMinOdo;
    const ph=min!=null?String(min):'Например, 165658';
    html+=`<div class="hint warn-close">Вчерашняя смена открыта — укажите одометр стоянки (он же станет ЕТО сегодня).</div>`;
    html+=`<div class="row"><input id="num" inputmode="numeric" placeholder="${esc(ph)}" ${min!=null?`value="${esc(String(min))}"`:''} /><button id="num-ok">OK</button></div>`;
    if(min!=null) html+=`<button class="secondary" id="eto-odo-keep">Как вчерашний последний: ${esc(String(min))}</button>`;
  } else if(os==='closeShiftParking'){
    const sug=state.draft&&state.draft.closeShiftSuggestOdo!=null?state.draft.closeShiftSuggestOdo:null;
    const ph=sug!=null?String(sug):'Например, 277800';
    html+=`<div class="hint warn-close">Одометр на стоянке — смена закроется</div>`;
    html+=`<div class="row"><input id="num" inputmode="numeric" placeholder="${esc(ph)}" ${sug!=null?`value="${esc(String(sug))}"`:''} /><button id="num-ok">OK</button></div>`;
  } else if(os==='arrivalOdometer'||os==='closingOdometer'||os==='fuelPrice'||os==='fuelAmount'||os==='departAssignedOdometer'||os==='arriveAssignedOdometer'||os==='startAssignedOdometer'){
    const ph=os==='fuelPrice'?'Например, 56.5':os==='fuelAmount'?'Например, 40':os==='closingOdometer'?'Например, 277720':'Например, 277690';
    html+=`<div class="row"><input id="num" inputmode="decimal" placeholder="${ph}" /><button id="num-ok">OK</button></div>`;
  } else if(os==='postCloseWhere'){
    html+=`<div class="hint warn-close">Если едете на стоянку — после этого закройте смену</div>`;
    html+=`<div class="hint">Куда дальше после выгрузки?</div><div class="yesno">
      <button id="post-next-order" class="primary">На следующий заказ</button>
      <button id="post-to-parking" class="secondary">На стоянку</button>
    </div>
    <button class="secondary" id="post-already-parked">Уже на стоянке (0 км после)</button>`;
  } else if(os==='dayNumber') html+=`<div class="hint">Номер заказа за день</div><div class="nums">${[1,2,3,4,5].map(n=>`<button data-day="${n}">${n}</button>`).join('')}</div>`;
  else if(os==='loading'||os==='unloading') html+=`<div class="row"><textarea id="text" rows="2" placeholder="Город, улица, дом, строение"></textarea><button id="text-ok">OK</button></div>`;
  else if(os==='askRefuel'||os==='closeShiftStaysLoaded') html+=`<div class="yesno"><button id="refuel-yes">Да</button><button id="refuel-no">Нет</button></div>`;
  else if(state.step==='idle') html+=`<button class="primary" id="open-shift">Открыть смену</button>`;
  else if(state.step==='chooseVehicle') html+=plates().map(p=>`<button class="secondary plate" data-plate="${esc(p)}">${esc(p)}</button>`).join('');
  else if(state.step==='odometer'||state.step==='fuel'){
    if(state.step==='odometer'){
      const sug=state.shift&&state.shift.etoOdometerSuggest!=null?state.shift.etoOdometerSuggest:null;
      const ph=sug!=null?String(sug):'Например, 125430';
      html+=`<div class="row"><input id="num" inputmode="numeric" placeholder="${esc(ph)}" ${sug!=null?`value="${esc(String(sug))}"`:''} /><button id="num-ok">OK</button></div>`;
      if(sug!=null) html+=`<button class="secondary" id="eto-odo-keep">Как вчера: ${esc(String(sug))}</button>`;
    } else {
      html+=`<div class="row"><input id="num" inputmode="decimal" placeholder="Например, 42" /><button id="num-ok">OK</button></div>`;
    }
  }
  else if(state.step==='gur') html+=`<div class="hint">Уровень жидкости ГУР</div>`+fluidButtons()+`<button class="secondary" id="eto-restart">Начать ЕТО заново</button>`;
  else if(state.step==='coolant') html+=`<div class="hint">Уровень ОЖ</div>`+fluidButtons()+`<button class="secondary" id="eto-restart">Начать ЕТО заново</button>`;
  else if(state.step==='lights') html+=lightsUI()+`<button class="secondary" id="eto-restart">Начать ЕТО заново</button>`;
  else if(state.step==='oil') html+=`<div class="hint">Уровень масла в ДВС</div>`+fluidButtons()+`<button class="secondary" id="eto-restart">Начать ЕТО заново</button>`;
  else if(state.step==='done'){
    const open=inProgressOrder();
    const enRoute=enRouteOrder();
    if(open){
      if(open.staysLoadedOvernight) html+=`<div class="hint">Заказ №${open.sequentialNumber} перенесён (машина загружена) — закройте после выгрузки.</div>`;
      html+=`<button class="primary" id="close-order">Закрыть заказ</button>`;
      html+=`<button class="secondary" id="close-shift">Закрыть смену</button>`;
    } else if(enRoute){
      html+=`<div class="hint">Заказ №${enRoute.sequentialNumber} — выехали. Отметьте прибытие на загрузку.</div>`;
      html+=`<button class="primary arrive-assigned" data-id="${enRoute.id}">Прибыл на загрузку №${enRoute.sequentialNumber}</button>`;
      html+=`<button class="secondary" id="close-shift">Закрыть смену</button>`;
    } else {
      if(shiftAwaitingClose()){
        html+=`<div class="hint warn-close">Смена ещё открыта. Перед уходом нажмите «Закрыть смену» и введите одометр на стоянке.</div>`;
      }
      assignedPending().forEach(o=>{ html+=`<button class="primary depart-assigned" data-id="${o.id}">Выехал · заказ №${o.sequentialNumber}</button>`; });
      html+=`<button class="secondary" id="create-order">Создать заказ сам</button>`;
      html+=`<button class="primary" id="close-shift">Закрыть смену</button>`;
    }
    if(!findOpenShift()) html+=`<button class="secondary" id="new-shift">Новая смена</button>`;
  }
  $('input-bar').innerHTML=html; wireInput();
  renderDriverBanner();
  updateDriverChrome();
}
function wireInput(){
  $('open-shift')&&($('open-shift').onclick=openShift);
  document.querySelectorAll('.plate').forEach(b=>b.onclick=()=>selectVehicle(b.dataset.plate));
  $('num-ok')&&($('num-ok').onclick=submitNumber);
  $('eto-odo-keep')&&($('eto-odo-keep').onclick=()=>{
    const sug=state.orderStep==='closePrevShiftParking'
      ? (state.draft&&state.draft.prevMinOdo)
      : (state.shift&&state.shift.etoOdometerSuggest);
    if(sug==null) return;
    const inp=$('num'); if(inp) inp.value=String(sug);
    submitNumber();
  });
  document.querySelectorAll('.fluid').forEach(b=>b.onclick=()=>selectFluid(b.dataset.level));
  $('eto-restart')&&($('eto-restart').onclick=restartEtoInspection);
  document.querySelectorAll('.yesno button[data-key]').forEach(b=>b.onclick=()=>{state.light[b.dataset.key]=b.dataset.val;state.error='';renderInput();});
  $('lights-ok')&&($('lights-ok').onclick=submitLights);
  $('create-order')&&($('create-order').onclick=startCreateOrder);
  $('close-order')&&($('close-order').onclick=startCloseOrder);
  $('close-shift')&&($('close-shift').onclick=startCloseShift);
  document.querySelectorAll('.depart-assigned').forEach(b=>b.onclick=()=>beginDepart(b.dataset.id));
  document.querySelectorAll('.arrive-assigned').forEach(b=>b.onclick=()=>beginArrive(b.dataset.id));
  $('new-shift')&&($('new-shift').onclick=startNewShiftClick);
  document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>selectDayNumber(+b.dataset.day));
  $('text-ok')&&($('text-ok').onclick=submitText);
  $('refuel-yes')&&($('refuel-yes').onclick=()=>answerYesNo(true));
  $('refuel-no')&&($('refuel-no').onclick=()=>answerYesNo(false));
  $('post-next-order')&&($('post-next-order').onclick=()=>finishPostCloseWhere('next'));
  $('post-to-parking')&&($('post-to-parking').onclick=()=>finishPostCloseWhere('parking'));
  $('post-already-parked')&&($('post-already-parked').onclick=()=>finishPostCloseWhere('here'));
}

/** Сбросить незавершённый ЕТО в текущей смене и пройти заново. */
function restartEtoInspection(){
  const shift=state.shift||findOpenShift();
  if(!shift || shift.endedAt) return;
  if(isEtoDone(shift) && shift.completedAt){
    if(!confirm('ЕТО уже пройден. Пройти осмотр заново?')) return;
  } else if(!confirm('Начать ЕТО заново? Текущие ответы осмотра будут сброшены.')) return;
  shift.completedAt=null;
  shift.odometer=null;
  shift.fuelLiters=null;
  shift.fuelRemainingLiters=null;
  shift.gur=null; shift.powerSteeringLevel=null;
  shift.coolant=null; shift.coolantLevel=null;
  shift.oil=null; shift.engineOilLevel=null;
  shift.light={};
  state.light={};
  state.shift=shift;
  state.step=shift.vehiclePlate?'odometer':'chooseVehicle';
  state.orderStep='idle'; state.draft={}; state.error='';
  if(shift.vehiclePlate){
    const prevOdo=previousShiftOdometerForPlate(shift.vehiclePlate, shift.ownCompanyId, DRIVER||shift.driverName);
    const floor=prevOdo??fallbackOdometerForPlate(shift.vehiclePlate, shift.ownCompanyId);
    if(floor!=null && shift.lastOdometerPoint==null) shift.lastOdometerPoint=floor;
    if(prevOdo!=null){
      shift.etoOdometerSuggest=prevOdo;
      add('bot',`ЕТО сброшен. Авто ${shift.vehiclePlate}. Ваш одометр на этой машине: ${prevOdo} — «Как вчера» или новый.`);
    } else {
      shift.etoOdometerSuggest=null;
      add('bot',`ЕТО сброшен. Авто ${shift.vehiclePlate}. Напишите показания одометра до выезда со стоянки.`);
    }
  } else {
    add('bot','ЕТО сброшен. Выберите автомобиль.');
  }
  bumpDataEpoch('eto-restart');
  upsertShift(); persist(); renderInput();
}
/** Восстановить orderStep/draft из смены или хвоста чата (создание заказа / в пути). */
function restoreOrderWorkflow(shift){
  if(!shift) return false;
  // Сначала снимем залипшие шаги (закрытый заказ после синка и т.п.)
  try{ healStuckOrderSteps(); }catch(_){}
  // Живой заказ «в пути» важнее сохранённого create-order
  const enRoute=(state.orders||[]).find(o=>!looksClosedOrder(o) && !o.cancelledAt && o.departOdometer!=null && o.startOdometer==null
    && samePersonName(o.driverName||'', shift.driverName||DRIVER));
  if(enRoute){
    state.orderStep='arriveAssignedOdometer';
    state.draft=Object.assign({}, shift.draft||{}, {assignedId:enRoute.id, plate:shift.vehiclePlate||enRoute.vehiclePlate||''});
    return true;
  }
  const saved=shift.orderStep && shift.orderStep!=='idle' ? shift.orderStep : '';
  if(saved){
    // Старый шаг closingEmptyAfter: заказ уже должен быть закрыт сразу после заправки
    if(saved==='closingEmptyAfter' && shift.draft && shift.draft.closeOdo!=null){
      state.draft=shift.draft?structuredClone(shift.draft):{};
      if(!state.draft.closingOrderId){
        const open=inProgressOrder();
        if(open) state.draft.closingOrderId=open.id;
      }
      state.orderStep='closingEmptyAfter'; // обработаем в resume → auto finalize
      return true;
    }
    // Старый ручной «доп. пробег» → вопрос куда едут
    if(saved==='postCloseEmptyAfter'){
      state.draft=shift.draft?structuredClone(shift.draft):{};
      state.orderStep='postCloseWhere';
      return true;
    }
    if(isAssignedFlowStep(saved)){
      // без enRoute выше — шаг мёртвый
      shift.orderStep='idle'; shift.draft={};
      return false;
    }
    if(isCreateFlowStep(saved)){
      if(inProgressOrder()){
        // открытый заказ важнее полусозданного
        shift.orderStep='idle'; shift.draft={};
        return false;
      }
      // Старый шаг: одометр при создании → теперь сразу номер дня / адреса
      if(saved==='arrivalOdometer'){
        if(!draftHasCreateProgress(shift.draft)){
          const msgs=shift.messages||[];
          const healed=msgs.some(m=>/восстановлен в смене|Заказ №\d+: закрыт/i.test(String(m.text||'')));
          if(healed){
            shift.orderStep='idle'; shift.draft={};
            return false;
          }
        }
        state.orderStep='dayNumber';
        state.draft=shift.draft?structuredClone(shift.draft):{};
        if(!state.draft.plate && shift.vehiclePlate) state.draft.plate=shift.vehiclePlate;
        delete state.draft.startOdo; delete state.draft.prevOdo; delete state.draft.arrivedAt;
        return true;
      }
    }
    state.orderStep=saved;
    state.draft=shift.draft?structuredClone(shift.draft):{};
    if(!state.draft.plate && shift.vehiclePlate) state.draft.plate=shift.vehiclePlate;
    return true;
  }
  const msgs=shift.messages||[];
  // Хвост чата: не откатываемся к «прибытию», если позже заказ уже закрыли/восстановили
  const lastMeaningful=[...msgs].reverse().find(m=>{
    if(m.author!=='bot') return false;
    const t=String(m.text||'');
    return !/^Продолжаем оформление заказа/i.test(t) && !/^Продолжаем закрытие заказа/i.test(t);
  });
  const t=String(lastMeaningful&&lastMeaningful.text||'');
  if(/закрыт \(восстановлен|восстановлен в смене|Заказ №\d+: закрыт/i.test(t)){
    return false;
  }
  if(/уже в пути|прибытию на загрузку|одометр.*прибыт.*загруз/i.test(t)){
    const en=(state.orders||[]).find(o=>!looksClosedOrder(o) && !o.cancelledAt && o.departOdometer!=null && o.startOdometer==null && samePersonName(o.driverName||'', DRIVER));
    if(en){
      state.orderStep='arriveAssignedOdometer';
      state.draft={assignedId:en.id, plate:shift.vehiclePlate||''};
      return true;
    }
    // Старое самосоздание с одометром при создании — продолжаем с номера дня
    const idx=msgs.findLastIndex?msgs.findLastIndex(m=>m===lastMeaningful):msgs.lastIndexOf(lastMeaningful);
    const after=idx>=0?msgs.slice(idx+1):[];
    if(after.some(m=>/закрыт|восстановлен в смене/i.test(String(m.text||'')))) return false;
    state.orderStep='dayNumber';
    state.draft=Object.assign({}, shift.draft||{}, {plate:shift.vehiclePlate||(shift.draft&&shift.draft.plate)||''});
    delete state.draft.startOdo; delete state.draft.prevOdo; delete state.draft.arrivedAt;
    return true;
  }
  if(/номер заказа за день/i.test(t)){
    state.orderStep='dayNumber';
    state.draft=Object.assign({}, shift.draft||{}, {plate:shift.vehiclePlate||''});
    return true;
  }
  if(/адрес загрузки/i.test(t)){ state.orderStep='loading'; state.draft=Object.assign({}, shift.draft||{}); return true; }
  if(/адрес выгрузки/i.test(t)){ state.orderStep='unloading'; state.draft=Object.assign({}, shift.draft||{}); return true; }
  if(/Выберите автомобиль для заказа/i.test(t)){ state.orderStep='chooseVehicle'; state.draft={}; return true; }
  return false;
}
function resumeOpenShift(shift){
  if(!shift) return;
  const today=localDayKey(new Date());
  const day=localDayKey(shift.startedAt);
  if(day && today && day<today && shift.vehiclePlate && !shiftHasBlockingOpenOrder(shift)){
    beginClosePrevAndOpenNew(shift);
    return;
  }
  hydrateEtoFromMessages(shift);
  state.shift=shift;
  state.messages=(shift.messages&&shift.messages.length)?shift.messages.slice():[];
  state.orderStep='idle'; state.draft={}; state.error='';
  const stale=invalidateStaleEto(shift);
  state.light=shift.light||{};
  if(isEtoDone(shift)){
    state.step='done';
    const midOrder=restoreOrderWorkflow(shift);
    if(!midOrder){
      const noted=(state.messages||[]).some(m=>String(m.text||'').includes('Смена уже открыта')||String(m.text||'').includes('Продолжаем открытую смену')||String(m.text||'').includes('ЕТО пройден'));
      if(!state.messages.length){
        const closeHint=shiftAwaitingClose(shift)
          ? '\nНе забудьте закрыть смену перед уходом (кнопка «Закрыть смену» + одометр на стоянке).'
          : '';
        state.messages=[{author:'bot',text:`Продолжаем открытую смену от ${dateTime(shift.startedAt)}.${closeHint}`}];
      } else if(!noted){
        const carry=inProgressOrder();
        const carryHint=carry&&carry.staysLoadedOvernight
          ? `\nЕсть перенесённый заказ №${carry.sequentialNumber} (машина загружена) — после работы закройте его.`
          : '';
        const closeHint=(!carry && shiftAwaitingClose(shift))
          ? '\nЕсли заказов больше не будет — закройте смену: «Закрыть смену» → одометр на стоянке.'
          : '';
        state.messages.push({author:'bot',text:`Смена уже открыта (${shift.vehiclePlate||'авто'}). ЕТО на сегодня пройден — можно работать с заказами или закрыть смену.${carryHint}${closeHint}`});
      }
    } else {
      const os=state.orderStep||'';
      // Зависшее закрытие: сразу дожимаем статус «Закрыт»
      if(os==='closingEmptyAfter' && state.draft && state.draft.closeOdo!=null){
        const o=orderBeingClosed();
        if(o && !looksClosedOrder(o)){
          state.draft.parkingAfterOdo=state.draft.closeOdo;
          state.draft.parkingAt=state.draft.endAt||new Date().toISOString();
          finalizeClose(!!state.draft.closeRefueled, state.draft.fuelPrice||null, state.draft.closeLiters||null);
          return;
        }
        state.orderStep='idle'; state.draft={};
      }
      const last=state.messages[state.messages.length-1];
      const closeStep=/^closing|^askRefuel|^postClose/.test(os);
      if(closeStep){
        if(!last || !/закрыт|одометр на стоянке|Продолжаем закрытие/i.test(String(last.text||''))){
          const n=(orderBeingClosed()||inProgressOrder()||{}).sequentialNumber;
          state.messages.push({author:'bot',text:n?`Продолжаем закрытие заказа №${n}.`:`Продолжаем закрытие заказа.`});
        }
      } else if(!last || !/прибытию на загрузку|номер заказа за день|адрес загрузки|адрес выгрузки|автомобиль для заказа|Продолжаем оформление заказа/i.test(String(last.text||''))){
        state.messages.push({author:'bot',text:`Продолжаем оформление заказа (${shift.vehiclePlate||'авто'}).`});
      }
    }
    upsertShift(); persist(); renderChat(); renderInput(); return;
  }
  if(!shift.vehiclePlate) state.step='chooseVehicle';
  else if(shift.odometer==null) state.step='odometer';
  else if(shift.fuelLiters==null) state.step='fuel';
  else if(!(shift.gur||shift.powerSteeringLevel)) state.step='gur';
  else if(!(shift.coolant||shift.coolantLevel)) state.step='coolant';
  else if(!state.light.lowBeam || !state.light.brake || !state.light.turn) state.step='lights';
  else state.step='oil';
  const carry=inProgressOrder();
  const carryHint=carry&&carry.staysLoadedOvernight
    ? ` Есть перенесённый заказ №${carry.sequentialNumber} (машина загружена) — закроете после выгрузки.`
    : '';
  if(stale){
    const prevOdo=previousShiftOdometerForPlate(shift.vehiclePlate, shift.ownCompanyId, DRIVER||shift.driverName);
    const sug=prevOdo??shift.lastOdometerPoint??fallbackOdometerForPlate(shift.vehiclePlate, shift.ownCompanyId);
    if(prevOdo!=null) shift.etoOdometerSuggest=+prevOdo;
    if(sug!=null) shift.lastOdometerPoint=+sug;
    const odoHint=prevOdo!=null?` Ваш одометр на этой машине: ${prevOdo} («Как вчера»).`:'';
    state.messages.push({author:'bot',text:`Новый день — нужно пройти ЕТО заново (за ночь с машиной могло что-то измениться).${odoHint}${carryHint}`});
  } else if(!state.messages.length){
    state.messages=[{author:'bot',text:`Смена открыта, но ЕТО не завершён. Продолжим с того места, где остановились.${carryHint}`}];
  } else if(carryHint && !(state.messages||[]).some(m=>String(m.text||'').includes('перенесённый заказ'))){
    state.messages.push({author:'bot',text:carryHint.trim()});
  }
  // Синхронизируем последнюю подсказку бота с реальным шагом (чат мог отстать от полей)
  const stepHints={
    odometer:'Напишите показания одометра до выезда со стоянки.',
    fuel:'Введите остаток топлива в литрах.',
    gur:'Проверьте и укажите уровень жидкости ГУР:\n• Максимум\n• Середина\n• Минимум',
    coolant:'Проверьте и укажите уровень ОЖ:\n• Максимум\n• Середина\n• Минимум',
    lights:'Проверьте осветительные приборы. Отметьте каждый пункт.',
    oil:'Укажите уровень масла в ДВС:\n• Максимум\n• Середина\n• Минимум'
  };
  const hint=stepHints[state.step];
  if(hint){
    const last=(state.messages||[]).slice().reverse().find(m=>m.author==='bot');
    if(!last || String(last.text||'').indexOf(hint.slice(0,24))<0){
      state.messages.push({author:'bot',text:`Продолжаем ЕТО — ${hint}`});
    }
  }
  upsertShift(); persist(); renderChat(); renderInput();
}
function openShift(){
  try{
    if(!DRIVER){
      state.error='Сначала войдите по телефону и PIN';
      openDriverLogin(!!peekAdminSessionName());
      return;
    }
    if(!state.vehicles||!state.vehicles.length){
      state.vehicles=DEFAULT_VEHICLES.map(v=>({...v}));
    }
    // Вчера не закрыта на известной машине → одометр закроет вчера и откроет сегодня на той же машине
    const prevDay=findPreviousDayOpenShift(DRIVER);
    if(prevDay && prevDay.vehiclePlate){
      beginClosePrevAndOpenNew(prevDay);
      return;
    }
    // Если стоянка уже была проставлена, но смена «висела» — дожмём
    if(sealPreviousDayOpenShiftsForDriver(DRIVER, {allowGuessOdo:false})){
      bumpDataEpoch('seal-prev-day-before-open');
      if(state.shift && state.shift.endedAt) state.shift=null;
      persist();
    }
    const existing=findOpenShift();
    if(existing){ resumeOpenShift(existing); return; }
    state.shift={id:uuid(),startedAt:new Date().toISOString(),vehiclePlate:null,odometer:null,lastOdometerPoint:null,orders:[],messages:[],endedAt:null,parkingOdometer:null,completedAt:null,driverName:DRIVER};
    stampShiftOwner(state.shift, DRIVER, null);
    add('driver','Открыть смену');
    const carry=inProgressOrder();
    const carryHint=carry&&carry.staysLoadedOvernight
      ? `
Есть перенесённый заказ №${carry.sequentialNumber} (машина загружена с прошлого дня) — после ЕТО закройте его по выгрузке.`
      : '';
    const firmHint=state.shift.ownCompanyName?` Фирма: ${state.shift.ownCompanyName}.`:'';
    add('bot',`Смена открыта в ${timeNow()} (${DRIVER}).${firmHint} Выберите автомобиль, на котором вы сегодня работаете.${carryHint}`);
    state.step='chooseVehicle'; state.orderStep='idle'; state.error='';
    bumpDataEpoch('open-shift');
    upsertShift(); renderInput();
    armExitGuard();
  }catch(err){
    console.error('openShift', err);
    state.error='Не удалось открыть смену. Обновите страницу и попробуйте снова.';
    renderInput();
  }
}
function selectVehicle(plate){
  if(state.orderStep==='chooseVehicle'){
    state.draft.plate=plate; add('driver',plate);
    add('bot',`Вы выбрали автомобиль с гос.номером ${plate}.\nУкажите номер заказа за день.`);
    state.orderStep='dayNumber'; state.error=''; upsertShift(); renderInput(); return;
  }
  state.shift.vehiclePlate=plate;
  stampShiftOwner(state.shift, DRIVER, plate);
  add('driver',plate);
  // Одометр уже проставлен при «закрыть вчера → открыть сегодня»
  if(state.shift.odometer!=null){
    add('bot',`Авто ${plate}. Одометр ЕТО уже ${state.shift.odometer}.\nВведите остаток топлива в литрах.`);
    state.step='fuel'; state.error=''; upsertShift(); renderInput(); return;
  }
  const prevOdo=previousShiftOdometerForPlate(plate, state.shift.ownCompanyId, DRIVER);
  const floor=prevOdo??fallbackOdometerForPlate(plate, state.shift.ownCompanyId);
  if(floor!=null) state.shift.lastOdometerPoint=floor;
  if(prevOdo!=null){
    state.shift.etoOdometerSuggest=prevOdo;
    add('bot',`Вы выбрали автомобиль с госномером ${plate}.\nВаш одометр на этой машине (стоянка прошлой смены): ${prevOdo}.\nЕсли не ездили — «Как вчера», иначе введите новый.`);
  } else {
    state.shift.etoOdometerSuggest=null;
    add('bot',`Вы выбрали автомобиль с госномером ${plate}.\nНапишите показания одометра до выезда со стоянки.`);
  }
  // Если вчерашняя смена этого водителя на этой же машине ещё открыта — закроем её одометром ЕТО
  state.step='odometer'; state.error=''; upsertShift(); renderInput();
}
function submitNumber(){
  const raw=($('num')?.value||'').trim().replace(',','.');
  if(state.orderStep==='arrivalOdometer'){
    const digits=raw.replace(/\D/g,''); if(!digits){state.error='Введите целое число километров';renderInput();return;}
    const value=+digits; const prev=state.shift.lastOdometerPoint??state.shift.odometer;
    if(prev==null){state.error='Нет одометра смены';renderInput();return;}
    if(value<prev){state.error=`Одометр не может быть меньше предыдущего (${prev})`;renderInput();return;}
    state.draft.startOdo=value; state.draft.prevOdo=prev; state.draft.arrivedAt=new Date().toISOString();
    add('driver',String(value));
    add('bot','Укажите номер заказа за день.'); state.orderStep='dayNumber'; state.error=''; upsertShift(); renderInput(); return;
  }
  if(state.orderStep==='departAssignedOdometer'){
    const digits=raw.replace(/\D/g,''); if(!digits){state.error='Введите целое число километров';renderInput();return;}
    acceptDepart(+digits); return;
  }
  if(state.orderStep==='arriveAssignedOdometer'||state.orderStep==='startAssignedOdometer'){
    const digits=raw.replace(/\D/g,''); if(!digits){state.error='Введите целое число километров';renderInput();return;}
    acceptArrive(+digits); return;
  }
  if(state.orderStep==='closePrevShiftParking'){
    const digits=raw.replace(/\D/g,''); if(!digits){state.error='Введите целое число километров';renderInput();return;}
    acceptClosePrevThenOpen(+digits); return;
  }
  if(state.orderStep==='closeShiftParking'){
    const digits=raw.replace(/\D/g,''); if(!digits){state.error='Введите целое число километров';renderInput();return;}
    acceptCloseShiftParking(+digits); return;
  }
  if(state.orderStep==='closingOdometer'){
    const digits=raw.replace(/\D/g,''); if(!digits){state.error='Введите целое число километров';renderInput();return;}
    const value=+digits; const order=openOrder();
    if(!order){state.error='Нет открытого заказа';renderInput();return;}
    if(value<order.startOdometer){state.error=`Одометр не может быть меньше начала заказа (${order.startOdometer})`;renderInput();return;}
    if(!state.draft.closingOrderId) state.draft.closingOrderId=order.id;
    state.draft.closeOdo=value; state.draft.endAt=new Date().toISOString();
    add('driver',String(value)); add('bot','Заправляли машину?');
    state.orderStep='askRefuel'; state.error=''; upsertShift(); renderInput(); return;
  }
  if(state.orderStep==='fuelPrice'){
    const price=+raw; if(!(price>0)){state.error='Введите стоимость литра, например 56.5';renderInput();return;}
    state.draft.fuelPrice=price; add('driver',`${price} ₽/л`); add('bot','Укажите количество литров.');
    state.orderStep='fuelAmount'; state.error=''; upsertShift(); renderInput(); return;
  }
  if(state.orderStep==='fuelAmount'){
    const liters=+raw; if(!(liters>0)){state.error='Введите количество литров, например 40';renderInput();return;}
    add('driver',`${liters} л`); askClosingEmptyAfter(true, state.draft.fuelPrice, liters); return;
  }
  if(state.orderStep==='postCloseEmptyAfter'||state.orderStep==='postCloseWhere'){
    // Старый шаг с ручным одометром больше не нужен — спросим куда едут
    state.orderStep='postCloseWhere';
    state.error='';
    renderInput();
    return;
  }
  // Совместимость: старый шаг closingEmptyAfter → сразу закрыть
  if(state.orderStep==='closingEmptyAfter'){
    const digits=raw.replace(/\D/g,''); if(!digits){state.error='Введите целое число километров';renderInput();return;}
    const value=+digits; const end=state.draft.closeOdo;
    if(end!=null && value<end){state.error=`Одометр не может быть меньше окончания заказа (${end})`;renderInput();return;}
    state.draft.parkingAfterOdo=value;
    state.draft.parkingAt=new Date().toISOString();
    if(!state.draft.closingOrderId){
      const o=orderBeingClosed(); if(o) state.draft.closingOrderId=o.id;
    }
    add('driver',String(value));
    finalizeClose(!!state.draft.closeRefueled, state.draft.fuelPrice||null, state.draft.closeLiters||null); return;
  }
  if(state.step==='odometer'){
    const digits=raw.replace(/\D/g,''); if(!digits){state.error='Введите целое число километров';renderInput();return;}
    const value=+digits;
    const prev=state.shift.etoOdometerSuggest??state.shift.lastOdometerPoint;
    if(prev!=null && value<+prev){ state.error=`Одометр не может быть меньше прошлого (${prev})`; renderInput(); return; }
    state.shift.odometer=value; state.shift.lastOdometerPoint=value;
    // Наоборот: этим же одометром ЕТО закрываем вчерашнюю незакрытую смену
    if(DRIVER && state.shift.vehiclePlate && closePreviousDayShiftsWithOdo(DRIVER, value, state.shift.vehiclePlate)){
      bumpDataEpoch('eto-odo-closed-prev-shift');
      add('bot',`Вчерашняя смена на ${state.shift.vehiclePlate} закрыта одометром ЕТО ${value} (стоянка).`);
    }
    add('driver',String(value)); add('bot','Введите остаток топлива в литрах.'); state.step='fuel';
  } else if(state.step==='fuel'){
    const value=+raw; if(!(value>=0)){state.error='Введите остаток топлива в литрах';renderInput();return;}
    state.shift.fuelLiters=value;
    state.shift.fuelRemainingLiters=value; // стартовый остаток = ЕТО; дальше только fuelRemainingLiters
    add('driver',`${value} л`);
    add('bot','Проверьте и укажите уровень жидкости ГУР:\n• Максимум\n• Середина\n• Минимум'); state.step='gur';
  }
  state.error=''; upsertShift(); renderInput();
}
function selectFluid(level){
  if(state.step==='gur'){ state.shift.gur=level; add('driver',`ГУР: ${level}`); add('bot','Проверьте и укажите уровень ОЖ:\n• Максимум\n• Середина\n• Минимум'); state.step='coolant'; }
  else if(state.step==='coolant'){ state.shift.coolant=level; add('driver',`ОЖ: ${level}`); add('bot','Проверьте осветительные приборы. Отметьте каждый пункт.'); state.light={}; state.step='lights'; }
  else if(state.step==='oil'){
    state.shift.oil=level;
    state.shift.engineOilLevel=level;
    state.shift.completedAt=new Date().toISOString();
    stampShiftOwner(state.shift, DRIVER, state.shift.vehiclePlate);
    state.step='done';
    state.orderStep='idle';
    add('driver',`Масло ДВС: ${level}`);
    add('bot','Спасибо за прохождение ЕТО. Счастливого пути! Если есть назначенный заказ — нажмите «Выехал» перед выездом со стоянки.');
    bumpDataEpoch('eto-complete');
    state.error=''; upsertShift(); syncOpenShiftRuntime();
    persist();
    // Сразу на сервер — иначе remote_ahead с другой вкладки может затереть ЕТО
    clearTimeout(persistTimer);
    pushServerStateQueued().then(()=>{ syncStatus='ok'; }).catch(err=>{ syncStatus='error'; console.warn('PB eto push', err); });
    renderInput();
    return;
  }
  state.error=''; upsertShift(); syncOpenShiftRuntime(); persist(); renderInput();
}
function submitLights(){
  const {lowBeam,brake,turn}=state.light; if(!lowBeam||!brake||!turn){state.error='Отметьте все пункты';renderInput();return;}
  state.shift.light={lowBeam,brake,turn};
  add('driver',`Ближний свет: ${lowBeam}\nСтоп-сигналы: ${brake}\nУказатели поворотов: ${turn}`);
  add('bot','Укажите уровень масла в ДВС:\n• Максимум\n• Середина\n• Минимум'); state.step='oil'; state.error=''; upsertShift(); renderInput();
}
/** Шаг 1: выезд со стоянки */
function beginDepart(id, fromOrders){
  const gate=canDepartMessage();
  if(gate){
    if(fromOrders){ showOrdersError(gate); return false; }
    state.error=gate; renderInput(); return false;
  }
  const order=state.orders.find(o=>o.id===id);
  if(!order||order.closedAt||order.startOdometer!=null||order.departOdometer!=null||order.onExchange){
    const msg='Заказ недоступен для выезда';
    if(fromOrders){ showOrdersError(msg); return false; }
    state.error=msg; renderInput(); return false;
  }
  syncOpenShiftRuntime();
  hideDriverPanels();
  state.draft.assignedId=id;
  add('driver',`Выехал · заказ №${order.sequentialNumber}`);
  add('bot',`Заказ №${order.sequentialNumber} (${orderDayLabel(order.dayNumber)})\nАвто: ${order.vehiclePlate}\nМаршрут: ${routeText(order)}\nУкажите одометр при выезде со стоянки.`);
  state.orderStep='departAssignedOdometer'; state.error=''; state.step='done';
  upsertShift(); renderChat(); renderDriverBanner(); renderInput();
  return true;
}
/** Шаг 2: прибытие на загрузку */
function beginArrive(id, fromOrders){
  const gate=canArriveMessage(id);
  if(gate){
    if(fromOrders){ showOrdersError(gate); return false; }
    state.error=gate; renderInput(); return false;
  }
  const order=state.orders.find(o=>o.id===id);
  if(!order||order.closedAt||order.startOdometer!=null||order.departOdometer==null){
    const msg=order&&order.departOdometer==null?'Сначала отметьте выезд («Выехал»)':'Заказ недоступен';
    if(fromOrders){ showOrdersError(msg); return false; }
    state.error=msg; renderInput(); return false;
  }
  if(!orderBelongsToDriver(order)){
    const msg='Это заказ другого водителя';
    if(fromOrders){ showOrdersError(msg); return false; }
    state.error=msg; renderInput(); return false;
  }
  syncOpenShiftRuntime();
  hideDriverPanels();
  state.draft.assignedId=id;
  // Не дублируем чат, если уже ждём одометр прибытия по этому заказу
  const already=state.orderStep==='arriveAssignedOdometer' && state.draft && state.draft.assignedId===id;
  if(!already){
    add('driver',`Прибыл на загрузку · заказ №${order.sequentialNumber}`);
    add('bot',`Заказ №${order.sequentialNumber}\nМаршрут: ${routeText(order)}\nУкажите одометр по прибытию на загрузку.`);
  }
  state.orderStep='arriveAssignedOdometer'; state.error=''; state.step='done';
  upsertShift(); renderChat(); renderDriverBanner(); renderInput();
  return true;
}
function beginAssigned(id, fromOrders){
  const order=state.orders.find(o=>o.id===id);
  if(order&&order.departOdometer!=null&&order.startOdometer==null) return beginArrive(id, fromOrders);
  return beginDepart(id, fromOrders);
}
function showOrdersError(msg){
  const el=$('orders-error');
  if(el) el.textContent=msg;
  else state.error=msg;
}
function acceptDepart(value){
  const order=state.orders.find(o=>o.id===state.draft.assignedId); if(!order){ state.error='Заказ не найден'; renderInput(); return; }
  const prev=state.shift.lastOdometerPoint??state.shift.odometer;
  if(prev==null){ state.error='Нет одометра смены'; renderInput(); return; }
  if(value<prev){ state.error=`Одометр не может быть меньше предыдущего (${prev})`; renderInput(); return; }
  order.departOdometer=value;
  order.previousOdometer=prev;
  order.departAt=new Date().toISOString();
  recomputeOrderTimes(order);
  if(!state.shift.orders) state.shift.orders=[];
  if(!state.shift.orders.some(o=>o.id===order.id)) state.shift.orders.push(order);
  upsertOrder(order); add('driver',String(value));
  if(typeof ensureEtrnForOrder==='function') ensureEtrnForOrder(order, {silent:true});
  add('bot',`Выезд зафиксирован🔔\n№${order.sequentialNumber}\nОдометр выезда: ${value}\nВремя: ${dateTime(order.departAt)}\n\nЭТрН создан (черновик) — QR для инспектора в баннере. Подписи T1–T3 — на погрузке.\n\nПо прибытии на загрузку нажмите «Прибыл на загрузку».`);
  state.draft={}; state.orderStep='idle'; state.error=''; upsertShift(); persist(); renderInput(); renderDriverBanner();
}
function acceptArrive(value){
  const order=state.orders.find(o=>o.id===state.draft.assignedId); if(!order){ state.error='Заказ не найден'; renderInput(); return; }
  const prev=order.previousOdometer??state.shift.lastOdometerPoint??state.shift.odometer;
  const minOdo=order.departOdometer!=null?order.departOdometer:prev;
  if(prev==null){ state.error='Нет одометра смены'; renderInput(); return; }
  if(value<minOdo){ state.error=`Одометр не может быть меньше выезда (${minOdo})`; renderInput(); return; }
  order.startOdometer=value;
  order.previousOdometer=prev;
  order.emptyKmBefore=value-prev;
  order.arrivedAt=new Date().toISOString();
  recomputeOrderTimes(order);
  if(!state.shift.orders) state.shift.orders=[];
  if(!state.shift.orders.some(o=>o.id===order.id)) state.shift.orders.push(order);
  upsertOrder(order); add('driver',String(value));
  const linked=linkEmptyAfterFromNextEmptyBefore(order);
  const tTo=order.timeToOrderMin!=null?`\nВремя до заказа: ${formatDurationMin(order.timeToOrderMin)}`:'';
  const linkNote=linked?`\nУ заказа №${linked.sequentialNumber} «до стоянки» = ${order.emptyKmBefore} км (как нулевой до этого).`:'';
  if(typeof ensureEtrnForOrder==='function') ensureEtrnForOrder(order, {silent:true});
  if(typeof signEtrnTitulsAtLoading==='function') signEtrnTitulsAtLoading(order.id);
  add('bot',`Заявка в работе🔔\n\n№${order.sequentialNumber} · ${orderDayLabel(order.dayNumber)}\n${routeText(order)}\nОдометр на загрузке: ${value}\nНулевой до заказа: ${order.emptyKmBefore} км${tTo}${linkNote}\n\nЭТрН: T2 (перевозчик) подписан. T1 — грузоотправитель в личном кабинете. T3 — водитель после подписи T1.`);
  add('bot','Когда перевозка закончится — нажмите «Закрыть заказ».');
  state.draft={}; state.orderStep='idle'; state.error=''; upsertShift(); persist(); renderInput(); renderDriverBanner();
}
function startCreateOrder(){
  const gate=canDepartMessage();
  if(gate){state.error=gate;renderInput();return;}
  syncOpenShiftRuntime();
  const shift=state.shift||findOpenShift();
  if(!shift || !isEtoDone(shift)){
    state.error='Сначала завершите ЕТО'; renderInput(); return;
  }
  const plate=shift.vehiclePlate||'';
  state.draft={};
  add('driver','Создать заказ');
  // Авто уже выбрано при открытии смены / ЕТО — не спрашиваем снова.
  // Одометр — только через «Выехал» / «Прибыл», как у назначенных заявок.
  if(plate){
    state.draft.plate=plate;
    add('bot',`Заказ на авто ${plate} (из текущей смены).\nУкажите номер заказа за день.`);
    state.orderStep='dayNumber';
  } else {
    add('bot','Выберите автомобиль для заказа.');
    state.orderStep='chooseVehicle';
  }
  state.error=''; upsertShift(); renderInput();
}
function startCloseOrder(){
  syncOpenShiftRuntime();
  const order=orderBeingClosed(); if(!order){state.error='Нет открытого заказа';renderInput();return;}
  if(!findOpenShift() || (!isEtoDone(state.shift||{}) && state.step!=='done')){
    state.error='Сначала завершите ЕТО'; renderInput(); return;
  }
  // Чистый draft закрытия — без хвостов создания заказа
  state.draft={closingOrderId:order.id, plate:order.vehiclePlate||(state.shift&&state.shift.vehiclePlate)||''};
  add('driver','Закрыть заказ');
  add('bot',`Заказ №${order.sequentialNumber} (${orderDayLabel(order.dayNumber)}).\nУкажите показания одометра по окончании перевозки.`);
  state.orderStep='closingOdometer'; state.error=''; upsertShift(); persist(); renderInput();
}
function startCloseShift(){
  const shift=syncOpenShiftRuntime();
  if(!shift || (!isEtoDone(shift) && !isEtoDone(state.shift||{}))){
    state.error='Сначала завершите ЕТО';renderInput();return;
  }
  const enRoute=enRouteOrder();
  if(enRoute){
    state.error=`Сначала отметьте прибытие на загрузку по заказу №${enRoute.sequentialNumber} (или отмените выезд у админа)`;
    renderInput(); return;
  }
  state.step='done';
  add('driver','Закрыть смену');
  const open=inProgressOrder();
  if(open){
    add('bot',`Есть незакрытый заказ №${open.sequentialNumber}.\nМашина осталась загружена? Выгрузка на следующий день?`);
    state.orderStep='closeShiftStaysLoaded'; state.error=''; upsertShift(); renderInput();
    return;
  }
  add('bot','Укажите показания одометра по возвращении на стоянку.');
  state.orderStep='closeShiftParking'; state.error=''; upsertShift(); renderInput();
}
function acceptCloseShiftParking(value){
  const prev=state.shift.lastOdometerPoint??state.shift.odometer;
  if(prev!=null && value<prev){ state.error=`Одометр не может быть меньше предыдущего (${prev})`; renderInput(); return; }
  add('driver',String(value));
  const open=inProgressOrder();
  if(open){
    markStaysLoadedOvernight(open);
    if(!state.shift.orders) state.shift.orders=[];
    if(!state.shift.orders.some(o=>o.id===open.id)) state.shift.orders.push(open);
    upsertOrder(open);
    add('bot',`Смена закрыта. Заказ №${open.sequentialNumber} перенесён — машина загружена (ночей: ${open.overnightNights}).\nЗавтра после ЕТО закройте заказ после выгрузки. Админ укажет ставку хранения клиенту.`);
  } else {
    const closed=(state.shift.orders||[]).filter(o=>o.closedAt && o.endOdometer!=null)
      .sort((a,b)=>new Date(a.closedAt)-new Date(b.closedAt));
    const last=closed[closed.length-1];
    if(last){
      last.emptyKmAfter=Math.max(0, value-last.endOdometer);
      last.linkEmptyAfterToNext=false;
      last.emptyAfterLinkedFromNext=false;
      upsertOrder(last);
    }
    add('bot','Смена закрыта. Хорошего отдыха!');
  }
  state.shift.parkingOdometer=value;
  state.shift.lastOdometerPoint=value;
  state.shift.endedAt=new Date().toISOString();
  clearCloseShiftReminder();
  syncVehicleOdometerFromShift(state.shift);
  bumpDataEpoch('shift-end-odo');
  upsertShift(); persist();
  resetChat();
  armExitGuard();
}
function answerYesNo(yes){
  if(state.orderStep==='closeShiftStaysLoaded'){
    add('driver', yes?'Да':'Нет');
    if(!yes){
      add('bot','Сначала закройте заказ — либо подтвердите, что машина осталась загружена до завтра.');
      state.orderStep='idle'; state.error='Сначала закройте текущий заказ';
      upsertShift(); renderInput(); return;
    }
    add('bot','Укажите показания одометра по возвращении на стоянку. Заказ останется открытым до выгрузки.');
    state.orderStep='closeShiftParking'; state.error=''; upsertShift(); renderInput();
    return;
  }
  answerRefuel(yes);
}
const DEFAULT_FUEL_PRICE_PER_LITER=80;
function lastFuelPricePerLiter(plate, exceptId){
  const scored=allOrders()
    .filter(o=>o.id!==exceptId && o.fuelPricePerLiter!=null && +o.fuelPricePerLiter>0)
    .map(o=>({
      o,
      samePlate: plate && o.vehiclePlate===plate ? 1 : 0,
      t: new Date(o.closedAt||o.createdAt).getTime()
    }))
    .sort((a,b)=> (b.samePlate-a.samePlate) || (b.t-a.t));
  return scored.length?+scored[0].o.fuelPricePerLiter:null;
}
function resolveFuelPriceWithoutRefuel(plate, exceptId){
  return lastFuelPricePerLiter(plate, exceptId) ?? DEFAULT_FUEL_PRICE_PER_LITER;
}
function answerRefuel(yes){
  add('driver', yes?'Да':'Нет');
  if(yes){ add('bot','Укажите стоимость литра.'); state.orderStep='fuelPrice'; state.error=''; upsertShift(); renderInput(); return; }
  const order=openOrder();
  const prev=lastFuelPricePerLiter(order&&order.vehiclePlate, order&&order.id);
  const price=prev ?? DEFAULT_FUEL_PRICE_PER_LITER;
  if(prev!=null){
    add('bot',`Заправки не было — цена литра с прошлой заправки: ${fmt(price)} ₽/л.`);
  } else {
    add('bot',`Заправки не было — подставлена цена по умолчанию: ${fmt(price)} ₽/л.`);
  }
  askClosingEmptyAfter(false, price, null);
}
function askClosingEmptyAfter(refueled, price, liters){
  // Статус «Закрыт» сразу после заправки — не ждём одометр стоянки (из‑за него зависали).
  const order=orderBeingClosed();
  if(order && !state.draft.closingOrderId) state.draft.closingOrderId=order.id;
  state.draft.closeRefueled=refueled; state.draft.fuelPrice=price; state.draft.closeLiters=liters;
  const end=state.draft.closeOdo;
  state.draft.parkingAfterOdo=(end!=null)?end:state.draft.parkingAfterOdo;
  state.draft.parkingAt=state.draft.endAt||new Date().toISOString();
  finalizeClose(refueled, price, liters);
}
function finalizeClose(refueled,price,liters){
  const order=orderBeingClosed(); if(!order){state.error='Нет открытого заказа';renderInput();return;}
  const end=state.draft.closeOdo;
  if(end==null || order.startOdometer==null){state.error='Нет одометра окончания';renderInput();return;}
  if(end<order.startOdometer){state.error=`Одометр окончания меньше начала (${order.startOdometer})`;renderInput();return;}
  const loaded=end-order.startOdometer;
  const now=new Date().toISOString();
  const parkAt=state.draft.parkingAt||now;
  order.endOdometer=end; order.loadedKm=loaded; order.refueled=refueled; order.closedAt=parkAt;
  order.endAt=state.draft.endAt||now;
  order.staysLoadedOvernight=null;
  if(refueled){
    order.fuelPricePerLiter=price; order.fuelLiters=liters; order.fuelTotalCost=round2(price*liters);
  } else {
    // Без заправки: ₽/л с прошлой заправки, иначе 80 ₽/л (для расчёта ГСМ)
    order.fuelLiters=null;
    order.fuelPricePerLiter=(price!=null && price>0)?price:resolveFuelPriceWithoutRefuel(order.vehiclePlate, order.id);
    order.fuelTotalCost=null;
  }
  const park=state.draft.parkingAfterOdo;
  if(park!=null && park>=end){
    order.emptyKmAfter=Math.max(0, park-end);
    order.parkingAt=parkAt;
    if(state.shift) state.shift.lastOdometerPoint=park;
  } else {
    order.emptyKmAfter=order.emptyKmAfter!=null?order.emptyKmAfter:0;
    order.parkingAt=order.parkingAt||parkAt;
    if(state.shift) state.shift.lastOdometerPoint=end;
  }
  recomputeOrderTimes(order);
  // Факт часов с грузом — подсказка для тарифа, если админ ещё не ввёл
  if(order.timeLoadedHours!=null && !(order.workHours>0)){
    order.workHours=order.timeLoadedHours;
  }
  applyFuelRemainingOnClose(order, state.shift, refueled?liters:null);
  applyClientTariff(order);
  if(typeof onOrderClosedBilling==='function') onOrderClosedBilling(order);
  if(typeof signEtrnTitulSandboxAuto==='function') signEtrnTitulSandboxAuto(order.id,'t4',DRIVER||'driver');
  bumpDataEpoch('finalize-close');
  upsertOrder(order);
  // Водителю не показываем км до стоянки, расход топлива и ₽/л — только админу.
  const times=orderTimesText(order);
  add('bot',`Заказ №${order.sequentialNumber} закрыт.\nОдометр окончания: ${end}${times?'\n'+times:''}\nЗП по заказу появится в «Заявки» после расчёта администратором.`);
  markCloseShiftReminder();
  // Одометр окончания уже в смене — не спрашиваем его ещё раз
  const closedId=order.id;
  const closedEnd=end;
  state.draft={postCloseOrderId:closedId, closeOdo:closedEnd};
  state.orderStep='postCloseWhere';
  state.error='';
  add('bot','Куда дальше? Если на стоянку — затем закройте смену. Одометр окончания уже сохранён.');
  upsertShift();
  persist();
  clearTimeout(persistTimer);
  pushServerStateQueued().then(()=>{ syncStatus='ok'; }).catch(err=>{ syncStatus='error'; console.warn('PB close push', err); });
  renderInput();
}
/** После закрытия: следующий заказ / стоянка / уже на стоянке — без повторного одометра. */
function finishPostCloseWhere(where){
  const order=orderById(state.draft&&state.draft.postCloseOrderId);
  const end=(order&&order.endOdometer!=null)?order.endOdometer:(state.draft&&state.draft.closeOdo);
  if(state.shift && end!=null) state.shift.lastOdometerPoint=end;
  if(order){
    if(where==='here'){
      order.emptyKmAfter=0;
      order.linkEmptyAfterToNext=false;
      order.emptyAfterLinkedFromNext=false;
      order.parkingAt=new Date().toISOString();
      recomputeOrderTimes(order);
      applyClientTariff(order);
      bumpDataEpoch('post-close-here');
      upsertOrder(order);
      add('driver','Уже на стоянке');
      add('bot',`Заказ №${order.sequentialNumber}: после выгрузки 0 км. Закрываем смену.`);
    } else if(where==='parking'){
      // Пробег до стоянки посчитается при закрытии смены по одометру стоянки
      if(order.emptyKmAfter==null) order.emptyKmAfter=0;
      order.linkEmptyAfterToNext=false;
      order.emptyAfterLinkedFromNext=false;
      upsertOrder(order);
      add('driver','На стоянку');
    } else {
      // следующий заказ: «до стоянки» проставится = «нулевой до» нового
      order.emptyKmAfter=0;
      order.linkEmptyAfterToNext=true;
      order.emptyAfterLinkedFromNext=false;
      upsertOrder(order);
      if(state.shift) state.shift.pendingEmptyAfterOrderId=order.id;
      add('driver','На следующий заказ');
      add('bot',`Ок. Точка отсчёта — одометр ${end}.\nКогда укажете одометр на загрузке следующего заказа, «нулевой до» него и «до стоянки» у заказа №${order.sequentialNumber} станут одинаковыми.`);
    }
  } else {
    add('driver', where==='here'?'Уже на стоянке':where==='parking'?'На стоянку':'На следующий заказ');
  }
  // На стоянку / уже там — напоминание + сразу закрытие смены
  if(where==='here'||where==='parking'){
    markCloseShiftReminder();
    state.step='done';
    state.error='';
    if(where==='here' && end!=null && state.shift && !state.shift.endedAt && !inProgressOrder()){
      state.orderStep='idle';
      state.draft={};
      upsertShift(); persist();
      clearTimeout(persistTimer);
      pushServerStateQueued().then(()=>{ syncStatus='ok'; }).catch(err=>{ syncStatus='error'; console.warn('PB post-where push', err); });
      acceptCloseShiftParking(+end);
      return;
    }
    state.orderStep='closeShiftParking';
    state.draft={closeShiftSuggestOdo:end!=null?+end:null};
    add('bot', end!=null
      ? `Укажите одометр на стоянке — смена закроется. Пробег после выгрузки посчитается от ${end}.`
      : 'Укажите одометр на стоянке — смена закроется.');
    upsertShift(); persist();
    clearTimeout(persistTimer);
    pushServerStateQueued().then(()=>{ syncStatus='ok'; }).catch(err=>{ syncStatus='error'; console.warn('PB post-where push', err); });
    renderInput();
    return;
  }
  // Следующий заказ — напоминание про смену не нужно
  clearCloseShiftReminder();
  state.orderStep='idle'; state.draft={}; state.error='';
  upsertShift(); persist();
  clearTimeout(persistTimer);
  pushServerStateQueued().then(()=>{ syncStatus='ok'; }).catch(err=>{ syncStatus='error'; console.warn('PB post-where push', err); });
  renderInput();
}
function selectDayNumber(n){ state.draft.dayNumber=n; add('driver',`Заказ ${orderDayLabel(n)}`); add('bot','Укажите адрес загрузки в виде: Город, адрес, номер дома, строение.'); state.orderStep='loading'; state.error=''; upsertShift(); renderInput(); }
function submitText(){
  const text=($('text')?.value||'').trim(); if(!text){state.error='Введите адрес';renderInput();return;}
  if(state.orderStep==='loading'){ state.draft.loading=text; add('driver',text); add('bot','Укажите адрес выгрузки в виде: Город, адрес, номер дома, строение.'); state.orderStep='unloading'; state.error=''; upsertShift(); renderInput(); return; }
  if(state.orderStep==='unloading') finishOrder(text);
}
function finishOrder(unloading){
  const d=state.draft; const seqNo=nextSequentialNumber(); const createdAt=new Date().toISOString();
  const plate=d.plate || (state.shift&&state.shift.vehiclePlate) || '';
  // Жёстко от сессии водителя / смены — не от чужой копии ФИО
  const bind=resolveDriverOrderBinding(DRIVER, plate);
  if(DRIVER_COMPANY_ID){
    const rec=findDriverRecord(DRIVER, DRIVER_COMPANY_ID);
    bind.ownCompanyId=DRIVER_COMPANY_ID;
    if(rec){
      bind.ownCompanyName=rec.companyName||bind.ownCompanyName;
      bind.spaceId=rec.spaceId||bind.spaceId;
      bind.ownerAdminId=rec.ownerAdminId||bind.ownerAdminId;
      bind.ownerAdminName=rec.ownerAdminName||bind.ownerAdminName;
    } else {
      const co=findCompanyById(DRIVER_COMPANY_ID);
      if(co){ bind.ownCompanyName=co.name; bind.spaceId=co.spaceId||bind.spaceId; }
    }
  }
  if(state.shift && state.shift.ownCompanyId){
    bind.ownCompanyId=state.shift.ownCompanyId;
    bind.ownCompanyName=state.shift.ownCompanyName||bind.ownCompanyName;
    bind.spaceId=state.shift.spaceId||bind.spaceId;
    bind.ownerAdminId=state.shift.ownerAdminId||bind.ownerAdminId;
    bind.ownerAdminName=state.shift.ownerAdminName||bind.ownerAdminName;
  }
  // Как у заявки диспетчера: сразу «Назначен», одометр — через Выехал / Прибыл
  const order={
    id:uuid(), sequentialNumber:seqNo, dayNumber:d.dayNumber, createdAt, source:'driver',
    vehiclePlate:plate, startOdometer:null, departOdometer:null, previousOdometer:null,
    loadingAddress:d.loading, unloadingAddress:unloading,
    loading:d.loading, unloading:unloading,
    routePoints:defaultRoutePoints(d.loading,unloading),
    driverName:DRIVER, customer:'', emptyKmBefore:null,
    driverPercent:driverPercent(DRIVER, bind.ownCompanyId||DRIVER_COMPANY_ID),
    ownerAdminId:bind.ownerAdminId, ownerAdminName:bind.ownerAdminName,
    spaceId:bind.spaceId, ownCompanyId:bind.ownCompanyId||DRIVER_COMPANY_ID, ownCompanyName:bind.ownCompanyName,
    executorType:'own', onExchange:false
  };
  stampOrderDriverPhone(order);
  ensureRoutePoints(order);
  recomputeOrderTimes(order);
  add('driver',unloading); if(!state.shift.orders) state.shift.orders=[]; state.shift.orders.push(order);
  bumpDataEpoch('driver-create-order');
  upsertOrder(order);
  const route=routeText(order);
  add('bot',`Заявка оформлена🔔\n\nИнформация о заявке❗\n🔵Номер заказа ${orderDayLabel(order.dayNumber)}\n🔵Порядковый номер - ${order.sequentialNumber}\n🔵Дата - ${dateTime(createdAt)}\n🔵Водитель - ${order.driverName}\n🔵Автомобиль - ${order.vehiclePlate}\n🔵Маршрут - ${route}\n🔵Статус - Назначен`);
  add('bot','Когда выезжаете со стоянки — нажмите «Выехал». По прибытии на загрузку — «Прибыл на загрузку».');
  state.draft={}; state.orderStep='idle'; state.error=''; upsertShift();
  persist();
  clearTimeout(persistTimer);
  pushServerStateQueued().then(()=>{ syncStatus='ok'; }).catch(err=>{ syncStatus='error'; console.warn('PB order push', err); });
  renderInput();
  renderDriverHome();
}
function resetChat(){
  syncOpenShiftRuntime();
  const existing=findOpenShift();
  if(existing){ resumeOpenShift(existing); return; }
  state.step='idle'; state.orderStep='idle'; state.shift=null; state.draft={}; state.error=''; state.light={}; state.messages=[];
  add('bot','Здравствуйте! Чтобы начать работу, откройте смену. Затем пройдём ежедневный технический осмотр (ЕТО).');
  renderInput();
}
function startNewShiftClick(){
  if(findOpenShift()){ state.error='Сначала закройте текущую смену'; renderInput(); return; }
  resetChat();
}
function effectivePay(o){ return o.earnings??metrics(o).driverPay??null; }
function payDate(o){ return o.closedAt||o.createdAt; }
function dayOnly(d){ return new Date(d).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function driverPayText(o){
  const pay=effectivePay(o);
  if(pay!=null) return `ЗП: ${fmt(pay)} ₽`;
  if(o.closedAt) return 'ЗП: ожидает расчёта администратора';
  return 'ЗП: —';
}
function driverProfilePlate(){
  const rec=findDriverRecord(DRIVER, DRIVER_COMPANY_ID);
  const assigned=rec&&typeof vehicleForDriver==='function'?vehicleForDriver(rec):null;
  if(assigned&&assigned.plate) return assigned.plate;
  const open=state.shift&&!state.shift.endedAt?state.shift:(findOpenShift()||null);
  if(open && open.vehiclePlate) return open.vehiclePlate;
  const last=(state.shifts||[])
    .filter(s=>samePersonName(s.driverName, DRIVER) && s.vehiclePlate)
    .sort((a,b)=>new Date(b.endedAt||b.startedAt||0)-new Date(a.endedAt||a.startedAt||0))[0];
  return (last&&last.vehiclePlate)||'—';
}
function showCabinet(){
  hideDriverPanels();
  setDriverNav('btn-cabinet');
  $('cabinet-panel').classList.add('show');
  const mine=allOrders().filter(o=>orderBelongsToDriver(o));
  const paid=mine.filter(o=>effectivePay(o)!=null).sort((a,b)=>new Date(payDate(b))-new Date(payDate(a)));
  const pending=mine.filter(o=>looksClosedOrder(o) && effectivePay(o)==null).sort((a,b)=>new Date(payDate(b))-new Date(payDate(a)));
  const total=paid.reduce((s,o)=>s+(effectivePay(o)||0),0);
  const firm=typeof driverSessionCompanyLabel==='function'?driverSessionCompanyLabel(DRIVER_COMPANY_ID, DRIVER)
    :(DRIVER_COMPANY_ID?((findCompanyById(DRIVER_COMPANY_ID)||{}).name||''):'');
  const phone=formatPhone(driverPhone(DRIVER, DRIVER_COMPANY_ID)||'')||'—';
  const plate=driverProfilePlate();
  const rec=findDriverRecord(DRIVER, DRIVER_COMPANY_ID);
  const passport=formatPassportText(rec);
  const passportIssued=formatPassportIssuedText(rec);
  const license=rec&&rec.licenseNo?String(rec.licenseNo).trim():'';
  const licenseIssued=rec&&rec.licenseIssuedAt?String(rec.licenseIssuedAt).trim():'';
  const shiftsN=(state.shifts||[]).filter(s=>samePersonName(s.driverName, DRIVER)).length;
  const closedN=mine.filter(o=>looksClosedOrder(o)).length;
  let html='';
  if(typeof epdSignCardHtml==='function'){
    html+=epdSignCardHtml('driver');
  }
  html+=`<div class="drv-earn">
    <span class="lbl">Профиль</span>
    <span class="val" style="font-size:1.25rem">${esc(DRIVER||'—')}</span>
    <span class="sub">${esc(firm||'Водитель')}</span>
  </div>`;
  html+=`<div class="drv-profile-rows">
    <div class="drv-profile-row"><span>Телефон</span><b>${esc(phone)}</b></div>
    <div class="drv-profile-row"><span>Фирма</span><b>${esc(firm||'—')}</b></div>
    <div class="drv-profile-row"><span>Авто</span><b>${esc(plate)}</b></div>
    ${passport?`<div class="drv-profile-row"><span>Паспорт</span><b>${esc(passport)}${passportIssued?`<br><small style="font-weight:500;color:var(--muted)">${esc(passportIssued)}</small>`:''}</b></div>`:''}
    ${license?`<div class="drv-profile-row"><span>ВУ</span><b>${esc(license)}${licenseIssued?`<br><small style="font-weight:500;color:var(--muted)">выдано ${esc(licenseIssued)}</small>`:''}</b></div>`:''}
    ${!passport&&!license?`<div class="hint" style="margin:8px 0">Паспорт и ВУ заполняет диспетчер в справочнике.</div>`:''}
  </div>`;
  const docGallery=typeof driverDocPhotoGalleryHtml==='function'?driverDocPhotoGalleryHtml(rec):'';
  if(docGallery){
    html+=`<div class="drv-section-label">Снимки документов</div>${docGallery}`;
  }
  html+=`<div class="drv-profile-stats">
    <div class="m"><span>Смен</span><b>${shiftsN}</b></div>
    <div class="m"><span>Заказов</span><b>${closedN}</b></div>
    <div class="m"><span>Начислено</span><b class="accent">${esc(fmt(total))} ₽</b></div>
    <div class="m"><span>Ждут расчёта</span><b>${pending.length}</b></div>
  </div>`;
  if(!paid.length && !pending.length){
    html+=`<div class="empty">После закрытия заказа и расчёта администратором суммы появятся здесь.</div>`;
  } else {
    if(paid.length){
      html+=`<div class="drv-section-label">Начисления</div>`;
      html+=paid.slice(0,20).map(o=>`<div class="drv-pay-row">
        <div>
          <div class="name">№${o.sequentialNumber} · ${esc(orderDayLabel(o.dayNumber))}</div>
          <div class="meta">${esc(dayOnly(payDate(o)))} · ${esc(o.vehiclePlate||'—')}<br>${esc(routeText(o))}</div>
        </div>
        <div class="amt">${fmt(effectivePay(o))} ₽</div>
      </div>`).join('');
    }
    if(pending.length){
      html+=`<div class="drv-section-label">Ожидают расчёта</div>`;
      html+=pending.slice(0,12).map(o=>`<div class="drv-pay-row">
        <div>
          <div class="name">№${o.sequentialNumber} · ${esc(orderDayLabel(o.dayNumber))}</div>
          <div class="meta">${esc(dayOnly(payDate(o)))} · ЗП ещё не начислена</div>
        </div>
        <div class="amt" style="color:var(--muted);font-weight:600">—</div>
      </div>`).join('');
    }
  }
  html+=`<div class="drv-section-label">Офлайн</div>
    <div class="hint" style="margin-top:2px">Черновик смены сохраняется на телефоне. При появлении сети уходит на сервер. Напоминания Выехал / Прибыл — баннером в приложении.</div>`;
  if(driverNotifySupported()){
    if(driverNotifyActive()){
      html+=`<button type="button" class="secondary" id="profile-notify-off" style="margin-top:6px">Выключить системные уведомления</button>`;
    } else {
      html+=`<button type="button" class="secondary" id="profile-notify-on" style="margin-top:6px">Системные уведомления</button>`;
    }
  }
  html+=`<div class="drv-section-label">Аккаунт</div>
    <button type="button" class="secondary" id="profile-exit" style="margin-top:4px">Выход</button>
    <div class="drv-section-label" style="margin-top:14px">Помощь</div>
    <button type="button" class="secondary" id="profile-help-tour" style="margin-top:4px">Показать подсказки</button>
    <a href="help.html?role=driver" class="hint" style="display:block;margin-top:6px" target="_blank" rel="noopener">Полная инструкция</a>
    <div class="drv-section-label" style="margin-top:14px">О приложении</div>
    <div class="hint" style="margin-top:4px">АРМАДА · учёт перевозок<br>Сборка ${esc(APP_BUILD)}</div>`;
  $('cabinet-list').innerHTML=html;
  if(typeof wireEpdSignCard==='function') wireEpdSignCard($('cabinet-list'));
  const ex=$('profile-exit');
  if(ex) ex.onclick=()=>leaveDriverMode();
  const nOn=$('profile-notify-on');
  if(nOn) nOn.onclick=async()=>{ await enableDriverNotifications(); showCabinet(); };
  const nOff=$('profile-notify-off');
  if(nOff) nOff.onclick=()=>{ setDriverNotifyWanted(false); showCabinet(); };
  const helpTour=$('profile-help-tour');
  if(helpTour) helpTour.onclick=()=>{ if(window.ArmadaOnboarding) ArmadaOnboarding.replay('driver'); };
}
function hideDriverPanels(){
  ['cabinet-panel','orders-panel','shifts-panel'].forEach(id=>{
    const el=$(id); if(el) el.classList.remove('show');
  });
  setDriverNav('btn-home');
}

function driverOrderPointsHtml(o){
  const pts=ensureRoutePoints(o)||[];
  if(!pts.length){
    return `<div class="route">${esc(routeText(o)||'Маршрут не указан')}</div>`;
  }
  return `<div class="drv-points">${pts.map(p=>`<div class="pt"><span>${esc(kindTitle(p.kind))}</span><b>${esc(p.address||'—')}</b></div>`).join('')}</div>`;
}
function driverOrderCardHtml(o, opts){
  opts=opts||{};
  const closed=looksClosedOrder(o)||!!o.cancelledAt;
  const canDepart=!closed && o.startOdometer==null && o.departOdometer==null && !o.onExchange;
  const canArrive=!closed && o.departOdometer!=null && o.startOdometer==null;
  const inWork=!closed && o.startOdometer!=null;
  const stCls=closed?'closed':((o.startOdometer!=null||o.departOdometer!=null)?'progress':'wait');
  const phone=formatPhone(o.contactPhone||'');
  const canContact=driverMaySeeContact(o)&&!!phone;
  const contact=driverContactLine(o);
  const acts=[];
  if(canDepart) acts.push(`<button type="button" class="primary drv-act-depart" data-id="${esc(o.id)}">Выехал</button>`);
  if(canArrive) acts.push(`<button type="button" class="primary drv-act-arrive" data-id="${esc(o.id)}">Прибыл на загрузку</button>`);
  // На Главной закрытие — кнопкой чата «Закрыть заказ»; дубль «Закрыть на Главной» не нужен
  if(inWork && !opts.home) acts.push(`<button type="button" class="primary drv-act-home" data-id="${esc(o.id)}">Закрыть на Главной</button>`);
  if(canContact){
    acts.push(`<a class="drv-link" href="tel:${esc(phone)}">Позвонить</a>`);
    acts.push(`<a class="drv-link" href="sms:${esc(phone)}">SMS</a>`);
  }
  return `<div class="drv-order-card${opts.compact?' drv-active-card':''}" data-order-card="${esc(o.id)}">
    <h3>Заказ №${o.sequentialNumber}${o.dayNumber!=null?` · ${esc(orderDayLabel(o.dayNumber))}`:''}</h3>
    <div class="st ${stCls}">${esc(statusText(o))}</div>
    ${driverOrderPointsHtml(o)}
    <div class="meta">${esc(o.vehiclePlate||'—')}${o.vehicleAt?` · подача ${esc(formatRuDateTimeAt(o.vehicleAt))}`:''}</div>
    ${o.freeAt||o.vehicleAt?`<div class="meta">${o.freeAt?`Освобождение: ${esc(formatRuDateTimeAt(o.freeAt||computeFreeAt(o.vehicleAt,o,financeForOrder(o))))}`:''}</div>`:''}
    ${contact?`<div class="contact">${esc(contact)}</div>`:''}
    ${driverMaySeeContact(o)&&o.loadingContactName?`<div class="contact">Загрузка: ${esc(o.loadingContactName)}${o.loadingContactPhone?` · ${esc(formatPhone(o.loadingContactPhone))}`:''}</div>`:''}
    ${driverMaySeeContact(o)&&o.unloadingContactName?`<div class="contact">Выгрузка: ${esc(o.unloadingContactName)}${o.unloadingContactPhone?` · ${esc(formatPhone(o.unloadingContactPhone))}`:''}</div>`:''}
    ${canArrive?`<div class="meta" style="color:var(--accent);font-weight:600">Выезд отмечен — подтвердите прибытие</div>`:''}
    ${closed?`<div class="meta">${esc(driverPayText(o))}</div>`:''}
    ${acts.length?`<div class="acts">${acts.join('')}</div>`:''}
  </div>`;
}
function wireDriverOrderCards(root){
  if(!root) return;
  root.querySelectorAll('.drv-act-depart').forEach(b=>{
    b.onclick=()=>beginDepart(b.dataset.id, true);
  });
  root.querySelectorAll('.drv-act-arrive').forEach(b=>{
    b.onclick=()=>beginArrive(b.dataset.id, true);
  });
  root.querySelectorAll('.drv-act-home').forEach(b=>{
    b.onclick=()=>showDriverHome();
  });
}
/** Подсказка в Заявках — по состоянию открытых заказов. */
function driverOrdersActionHint(openOrders){
  const list=openOrders||[];
  if(!list.length) return 'Закрытые заявки ниже. Новые появятся здесь.';
  let needDepart=false, needArrive=false, inWork=false;
  list.forEach(o=>{
    if(o.onExchange) return;
    if(o.startOdometer!=null) inWork=true;
    else if(o.departOdometer!=null) needArrive=true;
    else needDepart=true;
  });
  if(needDepart && needArrive) return 'В карточке: «Выехал» или «Прибыл на загрузку».';
  if(needDepart) return 'В карточке нажмите «Выехал» и введите одометр.';
  if(needArrive) return 'В карточке нажмите «Прибыл на загрузку» и введите одометр.';
  if(inWork) return 'Заказ в работе — закройте на Главной («Закрыть заказ»).';
  return 'Действия по заказу — в карточке.';
}
function showOrders(){
  hideDriverPanels();
  setDriverNav('btn-orders');
  $('orders-panel').classList.add('show');
  const mine=allOrders().filter(o=>orderBelongsToDriver(o) && !o.onExchange);
  const board=driverExchangeEnabled(DRIVER)?exchangeOrders():[];
  let html='';
  if(board.length){
    html+=`<div class="drv-section-label">Биржа</div>`;
    html+=`<div class="orders-hint">Логист ищет машину. Если вы владелец и сами за рулём — берите заказ здесь: планированием занимается логист.</div>`;
    html+=board.map(o=>`<div class="drv-order-card" style="margin-bottom:8px">
      <h3>№${o.sequentialNumber} · ${esc(orderDayLabel(o.dayNumber))}</h3>
      <div class="st wait">На бирже</div>
      ${driverOrderPointsHtml(o)}
      <div class="meta">${o.vehicleAt?`Подача ${esc(formatRuDateTimeAt(o.vehicleAt))}`:esc(dateTime(o.createdAt))}</div>
      <div class="acts"><button type="button" class="primary take-exchange" data-id="${o.id}">Взять заказ</button></div>
    </div>`).join('');
  } else if(driverExchangeEnabled(DRIVER)){
    html+=`<div class="orders-hint">Биржа пуста</div>`;
  }
  if(!mine.length && !board.length){
    $('orders-list').innerHTML=`<div class="empty">Пока нет заявок</div>`;
    return;
  }
  if(mine.length){
    const open=mine.filter(o=>!looksClosedOrder(o) && !o.cancelledAt);
    const closed=mine.filter(o=>looksClosedOrder(o) || o.cancelledAt);
    html+=`<div class="drv-section-label">Мои заявки</div>`;
    html+=`<div class="orders-hint">${esc(driverOrdersActionHint(open))}</div><div id="orders-error" class="error"></div>`;
    html+=`<div class="driver-home-orders" style="max-height:none">`;
    html+=open.map(o=>driverOrderCardHtml(o)).join('');
    if(closed.length){
      html+=`<div class="drv-section-label">Закрытые</div>`;
      html+=closed.slice(0,12).map(o=>driverOrderCardHtml(o)).join('');
    }
    html+=`</div>`;
  }
  $('orders-list').innerHTML=html;
  document.querySelectorAll('.take-exchange').forEach(b=>b.onclick=()=>takeExchangeOrder(b.dataset.id));
  wireDriverOrderCards($('orders-list'));
  renderDriverBanner();
}
function takeExchangeOrder(id){
  const o=state.orders.find(x=>x.id===id);
  if(!o || !o.onExchange){ showOrdersError('Заказ уже недоступен'); return; }
  if(!driverExchangeEnabled(DRIVER)){ showOrdersError('Биржа для вас выключена'); return; }
  const shift=syncOpenShiftRuntime();
  if(!shift && !state.shift){ showOrdersError('Сначала откройте смену'); return; }
  if(!isEtoDone(shift) && !isEtoDone(state.shift)){ showOrdersError('Сначала завершите ЕТО'); return; }
  if(hasOpenOrder()){ showOrdersError(inProgressOrder()?'Сначала закройте текущий заказ':'Сначала отметьте прибытие по текущему заказу'); return; }
  o.onExchange=false;
  o.executorType='own';
  o.driverName=DRIVER;
  o.driverPercent=driverPercent(DRIVER);
  o.vehiclePlate=state.shift?.vehiclePlate || state.vehicles[0]?.plate || o.vehiclePlate;
  upsertOrder(o);
  showOrders();
  beginDepart(o.id, true);
}

function wireOrdersSwipe(){
  const ACTION_W=118;
  document.querySelectorAll('#orders-list .swipe-item').forEach(item=>{
    const front=item.querySelector('.swipe-front');
    if(!front || item.dataset.canStart!=='1') return;
    let startX=0, startY=0, dx=0, tracking=false, horizontal=false;
    const setX=(x)=>{ front.style.transform=`translateX(${x}px)`; };
    const closeOthers=()=>{
      document.querySelectorAll('#orders-list .swipe-item').forEach(other=>{
        if(other===item) return;
        const f=other.querySelector('.swipe-front');
        if(f){ f.style.transform='translateX(0)'; other.dataset.open='0'; }
      });
    };
    front.addEventListener('touchstart',e=>{
      const t=e.changedTouches[0]; startX=t.clientX; startY=t.clientY; dx=0; tracking=true; horizontal=false;
    },{passive:true});
    front.addEventListener('touchmove',e=>{
      if(!tracking) return;
      const t=e.changedTouches[0];
      const adx=t.clientX-startX, ady=t.clientY-startY;
      if(!horizontal){
        if(Math.abs(adx)<8 && Math.abs(ady)<8) return;
        if(Math.abs(ady)>Math.abs(adx)){ tracking=false; return; }
        horizontal=true; closeOthers();
      }
      dx=Math.min(0, Math.max(-ACTION_W, adx));
      setX(dx);
    },{passive:true});
    front.addEventListener('touchend',()=>{
      if(!tracking && !horizontal) return;
      tracking=false;
      const open=dx<-ACTION_W*0.4;
      setX(open?-ACTION_W:0);
      item.dataset.open=open?'1':'0';
      dx=open?-ACTION_W:0;
    });
    // mouse (desktop preview)
    front.addEventListener('mousedown',e=>{
      startX=e.clientX; startY=e.clientY; dx=0; tracking=true; horizontal=false;
      const move=ev=>{
        if(!tracking) return;
        const adx=ev.clientX-startX, ady=ev.clientY-startY;
        if(!horizontal){
          if(Math.abs(adx)<6 && Math.abs(ady)<6) return;
          if(Math.abs(ady)>Math.abs(adx)){ tracking=false; return; }
          horizontal=true; closeOthers();
        }
        dx=Math.min(0, Math.max(-ACTION_W, adx));
        setX(dx);
      };
      const up=()=>{
        document.removeEventListener('mousemove',move);
        document.removeEventListener('mouseup',up);
        if(!tracking && !horizontal) return;
        tracking=false;
        const open=dx<-ACTION_W*0.4;
        setX(open?-ACTION_W:0);
        item.dataset.open=open?'1':'0';
      };
      document.addEventListener('mousemove',move);
      document.addEventListener('mouseup',up);
    });
  });
  document.querySelectorAll('#orders-list .swipe-start').forEach(btn=>{
    btn.onclick=()=>beginAssigned(btn.dataset.id, true);
  });
}
function driverHistoryDayBundles(){
  if(!state.driverHistOpen || typeof state.driverHistOpen!=='object') state.driverHistOpen={};
  const shifts=(state.shifts||[])
    .filter(s=>samePersonName(s.driverName, DRIVER) || (!s.driverName && DRIVER_COMPANY_ID && s.ownCompanyId===DRIVER_COMPANY_ID))
    .slice()
    .sort((a,b)=>new Date(b.startedAt||0)-new Date(a.startedAt||0));
  const byDay=new Map();
  shifts.forEach(s=>{
    const key=dayKeyFromIso(s.startedAt)||dayKeyFromIso(s.endedAt)||'без-даты';
    if(!byDay.has(key)) byDay.set(key,{dayKey:key, shifts:[], orders:[]});
    byDay.get(key).shifts.push(s);
    (s.orders||[]).forEach(o=>{
      const full=(state.orders||[]).find(x=>x.id===o.id)||o;
      if(full && !byDay.get(key).orders.some(x=>x.id===full.id)) byDay.get(key).orders.push(full);
    });
  });
  // заказы водителя без смены — тоже в день
  (state.orders||[]).filter(o=>orderBelongsToDriver(o) && !o.cancelledAt).forEach(o=>{
    const key=dayKeyFromIso(o.closedAt||o.createdAt)||'без-даты';
    if(!byDay.has(key)) byDay.set(key,{dayKey:key, shifts:[], orders:[]});
    const b=byDay.get(key);
    if(!b.orders.some(x=>x.id===o.id)) b.orders.push(o);
  });
  return [...byDay.values()].map(b=>{
    const orders=b.orders.slice().sort((a,c)=>(a.sequentialNumber||0)-(c.sequentialNumber||0));
    let km=0, pay=0;
    orders.forEach(o=>{
      const t=dayTotal(o); if(t!=null) km+=t;
      const p=effectivePay(o); if(p!=null) pay+=p;
    });
    const openShift=b.shifts.some(s=>!s.endedAt);
    const label=b.shifts[0]?dayOnly(b.shifts[0].startedAt):(orders[0]?dayOnly(orders[0].closedAt||orders[0].createdAt):b.dayKey);
    const plate=(b.shifts.find(s=>s.vehiclePlate)||{}).vehiclePlate||(orders[0]&&orders[0].vehiclePlate)||'—';
    return {
      id:b.dayKey, dayKey:b.dayKey, label, plate, openShift,
      shifts:b.shifts, orders, km:Math.round(km), pay, count:orders.length
    };
  }).sort((a,b)=>String(b.dayKey).localeCompare(String(a.dayKey)));
}
function ensureDriverHistCal(){
  if(!state.driverHistCal || typeof state.driverHistCal!=='object'){
    const now=new Date();
    state.driverHistCal={
      year:now.getFullYear(),
      month:now.getMonth(), // 0-11
      from:null,
      to:null
    };
  }
  return state.driverHistCal;
}
function driverHistDayLabel(dayKey){
  if(!dayKey || dayKey==='без-даты') return '—';
  const p=String(dayKey).split('-');
  if(p.length!==3) return dayKey;
  const d=new Date(+p[0], +p[1]-1, +p[2]);
  if(Number.isNaN(d.getTime())) return dayKey;
  return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'});
}
function driverHistPeriodLabel(cal){
  if(!cal || !cal.from) return 'Все дни';
  if(!cal.to || cal.to===cal.from) return driverHistDayLabel(cal.from);
  const a=cal.from<cal.to?cal.from:cal.to;
  const b=cal.from<cal.to?cal.to:cal.from;
  return driverHistDayLabel(a)+' — '+driverHistDayLabel(b);
}
function driverHistFilterDays(days, cal){
  if(!cal || !cal.from) return days;
  const a=cal.to && cal.to<cal.from?cal.to:cal.from;
  const b=cal.to && cal.to>cal.from?cal.to:(cal.to||cal.from);
  return days.filter(d=>d.dayKey && d.dayKey!=='без-даты' && d.dayKey>=a && d.dayKey<=b);
}
function driverHistSelectDay(dayKey){
  const cal=ensureDriverHistCal();
  if(!dayKey || dayKey==='без-даты') return;
  if(!cal.from || cal.to){
    // новый выбор: один день
    cal.from=dayKey;
    cal.to=null;
  } else if(cal.from===dayKey){
    // повтор по тому же дню — остаётся один день
    cal.to=null;
  } else {
    // второй другой день — период
    cal.to=dayKey;
  }
  // в выбранном диапазоне сразу раскрыть дни
  const a=cal.to && cal.to<cal.from?cal.to:cal.from;
  const b=cal.to && cal.to>cal.from?cal.to:(cal.to||cal.from);
  if(!state.driverHistOpen || typeof state.driverHistOpen!=='object') state.driverHistOpen={};
  driverHistoryDayBundles().forEach(d=>{
    if(d.dayKey>=a && d.dayKey<=b) state.driverHistOpen[d.id]=true;
  });
  showShifts();
}
function driverHistCalHtml(days){
  const cal=ensureDriverHistCal();
  const marked=new Set((days||[]).map(d=>d.dayKey).filter(k=>k && k!=='без-даты'));
  const y=cal.year, m=cal.month;
  const title=new Date(y,m,1).toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
  const first=new Date(y,m,1);
  let startPad=(first.getDay()+6)%7; // пн=0
  const dim=new Date(y,m+1,0).getDate();
  const todayKey=dayKeyFromIso(new Date().toISOString());
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
    cells+=`<button type="button" class="${cls}" data-cal-day="${esc(key)}">${day}</button>`;
  }
  return `<div class="drv-cal">
    <div class="drv-cal-head">
      <button type="button" id="hist-cal-prev" aria-label="Предыдущий месяц">‹</button>
      <h3>${esc(title)}</h3>
      <button type="button" id="hist-cal-next" aria-label="Следующий месяц">›</button>
    </div>
    <div class="drv-cal-week">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(w=>`<span>${w}</span>`).join('')}</div>
    <div class="drv-cal-grid">${cells}</div>
    <div class="drv-cal-meta">
      <span class="period">${esc(driverHistPeriodLabel(cal))}</span>
      <button type="button" id="hist-cal-reset"${cal.from?'':' hidden'}>Сбросить</button>
    </div>
  </div>`;
}
function showShifts(){
  hideDriverPanels();
  setDriverNav('btn-shifts');
  $('shifts-panel').classList.add('show');
  const allDays=driverHistoryDayBundles();
  const cal=ensureDriverHistCal();
  const days=driverHistFilterDays(allDays, cal);
  if(!allDays.length){
    $('shifts-list').innerHTML=`<div class="empty">Пока нет истории смен и заказов</div>`;
    return;
  }
  const shiftsN=days.reduce((n,d)=>n+d.shifts.length,0);
  const ordersN=days.reduce((n,d)=>n+d.count,0);
  const kmN=days.reduce((n,d)=>n+d.km,0);
  let html=driverHistCalHtml(allDays);
  html+=`<div class="drv-hist-stats">
    <div class="m"><span>Смен</span><b>${shiftsN}</b></div>
    <div class="m"><span>Заказов</span><b>${ordersN}</b></div>
    <div class="m"><span>Км</span><b class="accent">${esc(fmt(kmN))}</b></div>
  </div>`;
  html+=`<div class="drv-section-label">${cal.from?'Выбранный период':'По дням'}</div>`;
  if(!days.length){
    html+=`<div class="empty">Нет смен и заказов за выбранные дни</div>`;
  } else {
    html+=days.map(d=>{
      const open=!!state.driverHistOpen[d.id];
      const shiftNote=d.openShift?'смена открыта':(d.shifts.length?`смен: ${d.shifts.length}`:'без смены');
      return `<div class="drv-hist-day" data-hist-day="${esc(d.id)}">
        <div class="drv-hist-day-top">
          <h3>${esc(d.label)}</h3>
          <span class="tog" aria-hidden="true">${open?'▼':'▶'}</span>
        </div>
        <div class="meta">${esc(d.plate)} · ${esc(shiftNote)}</div>
        <div class="tot">
          <span>Заказов: <b>${d.count}</b></span>
          <span>Км: <b>${esc(fmt(d.km))}</b></span>
          <span>ЗП: <b>${d.pay?esc(fmt(d.pay))+' ₽':'—'}</b></span>
        </div>
        ${open?`<div class="drv-hist-details">${d.orders.length?d.orders.map(o=>driverOrderCardHtml(o,{compact:true})).join(''):`<div class="empty">Нет заказов за день</div>`}</div>`:''}
      </div>`;
    }).join('');
  }
  $('shifts-list').innerHTML=html;
  const prev=$('hist-cal-prev');
  const next=$('hist-cal-next');
  const reset=$('hist-cal-reset');
  if(prev) prev.onclick=()=>{ const c=ensureDriverHistCal(); c.month--; if(c.month<0){ c.month=11; c.year--; } showShifts(); };
  if(next) next.onclick=()=>{ const c=ensureDriverHistCal(); c.month++; if(c.month>11){ c.month=0; c.year++; } showShifts(); };
  if(reset) reset.onclick=()=>{ const c=ensureDriverHistCal(); c.from=null; c.to=null; showShifts(); };
  document.querySelectorAll('#shifts-list [data-cal-day]').forEach(btn=>{
    btn.onclick=e=>{ e.stopPropagation(); driverHistSelectDay(btn.dataset.calDay); };
  });
  document.querySelectorAll('#shifts-list [data-hist-day]').forEach(card=>{
    card.onclick=e=>{
      if(e.target.closest('button,a,input,select,textarea')) return;
      const id=card.dataset.histDay;
      state.driverHistOpen[id]=!state.driverHistOpen[id];
      showShifts();
    };
  });
  wireDriverOrderCards($('shifts-list'));
}

/** Ключ календарного дня (локально). */
