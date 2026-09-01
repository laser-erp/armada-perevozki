/* АРМАДА admin UI: login/chrome, vehicle card, boards/catalogs (phase2 chunk D) */
const COLS=["Дата","Госномер","Водитель","Заказчик","Маршрут","За день","Нулевой","С грузом","До стоянки","Общий день","₽/л","₽/км нал","С НДС","Без НДС","Нал","Доплата ЗП","ГСМ л","₽/км без НДС","ГСМ ₽","Аренда","Подушка","Прибыль","№ базы"];
function normalizeLoginInn(raw){
  return String(raw||'').replace(/\D/g,'');
}
function spaceIdsForLoginInn(innRaw){
  const inn=normalizeLoginInn(innRaw);
  if(!inn) return new Set();
  const ids=new Set();
  (state.spaces||[]).forEach(s=>{
    if(normalizeLoginInn(s.inn)===inn) ids.add(s.id);
  });
  (state.companies||[]).forEach(c=>{
    if(!companyHasRole(c,'own')) return;
    if(normalizeLoginInn(c.inn)===inn && c.spaceId) ids.add(c.spaceId);
  });
  return ids;
}
function findAdminByInnAndPin(innRaw, pin){
  const pinStr=String(pin||'').trim();
  if(!pinStr) return null;
  const inn=normalizeLoginInn(innRaw);
  if(!inn) return null;
  const spaceIds=spaceIdsForLoginInn(inn);
  if(!spaceIds.size) return null;
  const matches=(state.admins||[]).filter(a=>{
    if(a.loginBy==='phone') return false;
    if(String(a.pin||'').trim()!==pinStr) return false;
    return !!(a.spaceId && spaceIds.has(a.spaceId));
  });
  return matches.length===1 ? matches[0] : null;
}
function adminLoginPhone(a){
  if(!a) return '';
  const own=typeof formatPhone==='function'?formatPhone(a.phone||''):String(a.phone||'').trim();
  if(own) return own;
  const drv=(state.drivers||[]).find(d=>samePersonName(d.name,a.name));
  return typeof formatPhone==='function'?formatPhone(drv&&drv.phone||''):String(drv&&drv.phone||'').trim();
}
function looksLikeAdminPhoneInput(raw){
  const s=String(raw||'').trim();
  if(!s) return false;
  if(s.startsWith('+')) return true;
  const d=s.replace(/\D/g,'');
  if(d.length===11 && d[0]==='7') return true;
  if(d.length===10 && d[0]==='9') return true;
  return false;
}
function findAdminByPhoneAndPin(phoneRaw, pin){
  const pinStr=String(pin||'').trim();
  if(!pinStr) return null;
  const phone=typeof formatPhone==='function'?formatPhone(phoneRaw):String(phoneRaw||'').trim();
  if(!phone) return null;
  const matches=(state.admins||[]).filter(a=>{
    if(a.loginBy!=='phone') return false;
    if(String(a.pin||'').trim()!==pinStr) return false;
    return adminLoginPhone(a)===phone;
  });
  return matches.length===1 ? matches[0] : null;
}
function findAdminByLoginAndPin(loginRaw, pin){
  const raw=String(loginRaw||'').trim();
  if(!raw) return null;
  if(looksLikeAdminPhoneInput(raw)){
    const byPhone=findAdminByPhoneAndPin(raw, pin);
    if(byPhone) return byPhone;
  }
  const inn=normalizeLoginInn(raw);
  if(inn && (inn.length===10 || inn.length===12)) return findAdminByInnAndPin(inn, pin);
  return findAdminByPhoneAndPin(raw, pin);
}
function paintOwnerFiltersBox(box, onPick){
  if(!box) return;
  if(!isSuperAdmin()){
    box.classList.remove('show');
    box.innerHTML='';
    return;
  }
  box.classList.add('show');
  const spaces=(state.spaces||[]).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru'));
  const cur=state.adminOwnerFilter||'all';
  const btns=[
    `<button type="button" data-owner="all" class="${cur==='all'?'on':''}" title="Все перевозчики на платформе">Все кабинеты</button>`,
    ...spaces.map(s=>`<button type="button" data-owner="${esc(s.id)}" class="${cur===s.id?'on':''}" title="Кабинет ${esc(s.name)}">${esc(s.name)}</button>`),
    `<button type="button" data-owner="_none" class="${cur==='_none'?'on':''}">Без кабинета</button>`
  ];
  box.innerHTML=btns.join('')+`<p class="hint admin-owner-filter-hint">Кабинет справочника и парка. «ИП Нечаев», «МБН» — другие перевозчики, не контрагенты Армады.</p>`;
  box.querySelectorAll('button[data-owner]').forEach(b=>{
    b.onclick=()=>{
      state.adminOwnerFilter=b.dataset.owner||'all';
      paintAdminOwnerFilters();
      paintCatalogOwnerFilters();
      if(typeof onPick==='function') onPick();
    };
  });
}
function paintAdminOwnerFilters(){
  paintOwnerFiltersBox($('admin-owner-filters'), ()=>{ renderAdmin(); });
}
function paintCatalogOwnerFilters(){
  paintOwnerFiltersBox($('cat-owner-filters'), ()=>{
    catalogActiveCompanyId=null;
    catalogDriverCompanyId=null;
    if(document.querySelector('#admin-catalogs-screen.show')) openCatalogs();
  });
}
function fillAdminLoginSelect(){
  migrateAdmins();
  const sel=$('admin-name-select'); if(!sel) return;
  const list=state.admins.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru'));
  if(!list.length){
    sel.innerHTML='<option value="">— загрузка… —</option>';
  } else {
    sel.innerHTML=list.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
  }
  const hint=$('pin-recovery-hint');
  if(hint){
    const msg=state.settings&&state.settings.superPinRecoveryNotice;
    if(msg){
      hint.textContent=msg;
      hint.style.display='block';
    }else{
      hint.textContent='';
      hint.style.display='none';
    }
  }
}
function pushAdminLogin(action){
  if(!currentAdmin) return;
  state.adminLogins.unshift({
    id:uuid(), at:new Date().toISOString(), action,
    adminId:currentAdmin.id, adminName:currentAdmin.name, isSuper:!!currentAdmin.isSuper,
    deviceId:adminDeviceId()
  });
  state.adminLogins=state.adminLogins.slice(0,120);
}
function touchAdminPresence(screen){
  if(!currentAdmin) return;
  const deviceId=adminDeviceId();
  const row={
    deviceId, adminId:currentAdmin.id, adminName:currentAdmin.name,
    isSuper:!!currentAdmin.isSuper, lastSeen:new Date().toISOString(),
    screen:screen||'admin'
  };
  const i=(state.adminPresence||[]).findIndex(p=>p.deviceId===deviceId);
  if(i>=0) state.adminPresence[i]=row; else state.adminPresence.unshift(row);
  // чистим совсем старые
  const cut=Date.now()-24*3600*1000;
  state.adminPresence=state.adminPresence.filter(p=>Date.parse(p.lastSeen||0)>cut);
}
function startPresenceHeartbeat(){
  stopPresenceHeartbeat();
  presenceTimer=setInterval(()=>{
    if(!currentAdmin) return;
    touchAdminPresence('admin');
    persistLocalOnly();
  }, PRESENCE_TICK_MS);
}
function stopPresenceHeartbeat(){
  if(presenceTimer){ clearInterval(presenceTimer); presenceTimer=null; }
}
function clearMyPresence(){
  const deviceId=adminDeviceId();
  state.adminPresence=(state.adminPresence||[]).filter(p=>p.deviceId!==deviceId);
}
function onlineAdmins(){
  const now=Date.now();
  return (state.adminPresence||[])
    .filter(p=>now-Date.parse(p.lastSeen||0)<PRESENCE_ONLINE_MS)
    .sort((a,b)=>Date.parse(b.lastSeen||0)-Date.parse(a.lastSeen||0));
}
function closeAdminSidebar(){
  const sb=$('admin-sidebar');
  const bd=$('admin-sidebar-backdrop');
  if(sb) sb.classList.remove('open');
  if(bd){ bd.classList.remove('show'); bd.hidden=true; }
}
const ADMIN_INBOX_SEEN_KEY='armada_admin_inbox_seen_v1';
const ADMIN_NOTIFY_KEY='armada_admin_notify_v1';
let adminInboxNotifySnapshot=null;
function adminInboxOrders(){
  return (state.orders||[]).filter(o=>o&&canAdminSeeOrder(o)&&matchesOwnerFilter(o)
    && typeof isLogistInboxOrder==='function'&&isLogistInboxOrder(o));
}
function adminInboxOrderTag(o){
  if(!o) return '';
  return `${o.id}|${o.createdAt||''}|${o.bookStatus||''}|${o.bookConfirmedAt||''}|${o.priceForClient||''}|${o.customerSubmitted?'1':'0'}`;
}
function loadAdminInboxSeen(){
  const adminId=currentAdmin&&currentAdmin.id;
  if(!adminId) return {};
  try{
    const all=JSON.parse(localStorage.getItem(ADMIN_INBOX_SEEN_KEY)||'{}');
    return all[adminId]||{};
  }catch(_){ return {}; }
}
function saveAdminInboxSeen(map){
  const adminId=currentAdmin&&currentAdmin.id;
  if(!adminId) return;
  try{
    const all=JSON.parse(localStorage.getItem(ADMIN_INBOX_SEEN_KEY)||'{}');
    all[adminId]=map||{};
    localStorage.setItem(ADMIN_INBOX_SEEN_KEY, JSON.stringify(all));
  }catch(_){}
}
function adminInboxUnreadOrders(){
  const seen=loadAdminInboxSeen();
  return adminInboxOrders().filter(o=>seen[o.id]!==adminInboxOrderTag(o));
}
function adminInboxUnreadCount(){
  return adminInboxUnreadOrders().length;
}
function markAdminInboxOrdersSeen(orders){
  const seen=loadAdminInboxSeen();
  (orders||[]).forEach(o=>{ if(o&&o.id) seen[o.id]=adminInboxOrderTag(o); });
  saveAdminInboxSeen(seen);
  updateAdminInboxBadge();
  updateAdminInboxBanner();
}
function markAllAdminInboxSeen(){
  markAdminInboxOrdersSeen(adminInboxOrders());
}
function seedAdminInboxNotifySnapshot(){
  const snap={};
  adminInboxOrders().forEach(o=>{ if(o&&o.id) snap[o.id]=adminInboxOrderTag(o); });
  adminInboxNotifySnapshot=snap;
}
function adminNotifyWanted(){
  try{ return localStorage.getItem(ADMIN_NOTIFY_KEY)==='1'; }catch(_){ return false; }
}
function setAdminNotifyWanted(on){
  try{ localStorage.setItem(ADMIN_NOTIFY_KEY, on?'1':'0'); }catch(_){}
}
function adminNotifyActive(){
  return typeof armadaNotifyActive==='function' && armadaNotifyActive('admin');
}
async function enableAdminNotifications(){
  if(typeof armadaRequestNotifyPermission!=='function'){
    alert('Уведомления недоступны'); return false;
  }
  const ok=await armadaRequestNotifyPermission('admin');
  if(ok) setAdminNotifyWanted(true);
  else alert('Разрешите уведомления в настройках браузера');
  syncAdminNotifyToggle();
  return ok;
}
function syncAdminNotifyToggle(){
  const btn=$('admin-notify-toggle');
  if(!btn) return;
  const on=adminNotifyActive();
  btn.classList.toggle('on', on);
  btn.title=on?'Уведомления о входящих: вкл':'Включить уведомления о входящих заявках';
}
function updateAdminInboxBadge(){
  const badge=$('admin-inbox-badge');
  const btn=document.querySelector('#admin-filters button[data-filter="inbox"]');
  const n=currentAdmin?adminInboxUnreadCount():0;
  if(badge){
    if(n>0){
      badge.textContent=n>99?'99+':String(n);
      badge.hidden=false;
      badge.setAttribute('aria-label', `${n} непросмотренных`);
    }else{
      badge.hidden=true;
      badge.removeAttribute('aria-label');
    }
  }
  if(btn) btn.classList.toggle('has-unread', n>0);
}
function updateAdminInboxBanner(){
  const el=$('admin-inbox-banner');
  if(!el) return;
  const n=adminInboxUnreadCount();
  const onInbox=(state.adminFilter||'all')==='inbox';
  if(!n || onInbox || !document.querySelector('#admin.show')){
    el.style.display='none';
    el.textContent='';
    return;
  }
  el.style.display='block';
  el.innerHTML=`<strong>${n}</strong> ${n===1?'новая входящая заявка':'новых входящих заявок'} — нажмите, чтобы открыть «Входящие»`;
  if(!el._wired){
    el._wired=true;
    el.onclick=()=>{
      state.adminFilter='inbox';
      document.querySelectorAll('#admin-filters button').forEach(x=>{
        x.classList.toggle('on', x.dataset.filter==='inbox');
      });
      markAllAdminInboxSeen();
      show('admin');
      renderAdmin();
    };
  }
}
function adminInboxNotifyLine(o, prevTag){
  const num=o.sequentialNumber||'—';
  const cust=String(o.customer||'заказчик').trim();
  const route=typeof routeText==='function'?routeText(o):'';
  if(!prevTag) return `№${num}: ${cust}${route?` · ${route.slice(0,48)}`:''}`;
  if(typeof isBookingRequested==='function' && isBookingRequested(o)) return `№${num}: запрос брони · ${cust}`;
  return `№${num}: ${typeof statusText==='function'?statusText(o):'обновление'}`;
}
function maybeNotifyAdminInboxUpdates(force){
  if(!currentAdmin) return;
  if(!adminInboxNotifySnapshot) seedAdminInboxNotifySnapshot();
  const seen=loadAdminInboxSeen();
  const snap=adminInboxNotifySnapshot||{};
  const msgs=[];
  adminInboxOrders().forEach(o=>{
    if(!o||!o.id) return;
    const tag=adminInboxOrderTag(o);
    const prev=snap[o.id];
    const unread=seen[o.id]!==tag;
    if(unread && prev!==tag){
      msgs.push(adminInboxNotifyLine(o, prev));
    }
    snap[o.id]=tag;
  });
  adminInboxNotifySnapshot=snap;
  updateAdminInboxBadge();
  updateAdminInboxBanner();
  if(!msgs.length) return;
  const showPush=adminNotifyActive() && (force || document.hidden || (state.adminFilter||'all')!=='inbox' || !document.querySelector('#admin.show'));
  if(showPush && msgs.length && typeof armadaShowNotification==='function'){
    armadaShowNotification('АРМАДА · входящие', msgs.slice(0,2).join(' · '), 'admin-inbox', 'admin');
  }
}
function openAdminSidebar(){
  const sb=$('admin-sidebar');
  const bd=$('admin-sidebar-backdrop');
  if(sb) sb.classList.add('open');
  if(bd){ bd.hidden=false; bd.classList.add('show'); }
}
function syncAdminNav(){
  const f=state.adminFilter||'all';
  const dispatcher=typeof isDispatcherCompany==='function' && isDispatcherCompany(typeof currentOwnCompany==='function'?currentOwnCompany():null);
  const nav=(f==='eto'||f==='exchange')?f:'orders';
  document.querySelectorAll('.admin-nav-item[data-nav]').forEach(b=>{
    b.classList.toggle('on', b.dataset.nav===nav);
  });
  const filters=$('admin-filters');
  if(filters) filters.style.display=(nav==='orders')?'flex':'none';
  const cta=$('admin-new');
  if(cta) cta.style.display=(nav==='orders'||nav==='exchange')?'':'none';
  const exNav=document.querySelector('.admin-nav-item[data-nav="exchange"]');
  if(exNav) exNav.style.display=dispatcher?'':'none';
  const sw=$('admin-park-ex');
  const title=$('admin-title');
  const showSwitch=(nav==='orders'||nav==='exchange') && dispatcher;
  if(sw){
    sw.hidden=!showSwitch;
    sw.querySelectorAll('[data-park-ex]').forEach(b=>{
      const on=(b.dataset.parkEx==='exchange' && nav==='exchange') || (b.dataset.parkEx==='park' && nav==='orders');
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on?'true':'false');
    });
  }
  if(title) title.classList.toggle('with-park-ex', showSwitch);
}
function setAdminNav(nav){
  if(!currentAdmin && !canAutoRestoreAdmin()){ show('admin-pin'); return; }
  closeAdminSidebar();
  if(nav==='catalogs'){ openCatalogs(); return; }
  if(nav==='activity'){ openAdminActivity(); return; }
  if(nav==='billing'){ openAdminBilling(); return; }
  if(nav==='plans'){ openAdminPlans(); return; }
  if(nav==='links'){ openAdminLinks(); return; }
  if(nav==='documents'){ openAdminDocuments(); return; }
  if(nav==='profile'){ openAdminProfile(); return; }
  if(nav==='eto') state.adminFilter='eto';
  else if(nav==='exchange') state.adminFilter='exchange';
  else {
    if(state.adminFilter==='eto'||state.adminFilter==='exchange') state.adminFilter='all';
  }
  document.querySelectorAll('#admin-filters button').forEach(x=>{
    x.classList.toggle('on', x.dataset.filter===(state.adminFilter||'all'));
  });
  show('admin');
  renderAdmin();
}
function updateAdminChrome(){
  const act=$('admin-activity');
  const bill=$('admin-billing');
  const plans=$('admin-plans');
  if(act) act.style.display=isSuperAdmin()?'':'none';
  if(bill) bill.style.display=isSuperAdmin()?'':'none';
  if(plans) plans.style.display=isSuperAdmin()?'':'none';
  const title=$('admin-title');
  const userEl=$('admin-sidebar-user');
  if(!currentAdmin){
    if(title) title.textContent='Парк';
    if(userEl) userEl.textContent='';
  } else {
    const sp=findSpaceById(currentAdmin.spaceId);
    const firm=sp?sp.name:currentAdmin.name;
    const section=state.adminFilter==='eto'?'ЕТО'
      : state.adminFilter==='exchange'?'Биржа'
      : 'Парк';
    if(title) title.textContent=section;
    const kind=typeof currentLogistKind==='function'?currentLogistKind():'';
    const kindLabel=kind==='broker'?'диспетчер':'';
    if(userEl) userEl.textContent=`${currentAdmin.name}${firm&&firm!==currentAdmin.name?' · '+firm:''}${kindLabel?' · '+kindLabel:''}`;
    syncAdminNotifyToggle();
    updateAdminInboxBadge();
    updateAdminInboxBanner();
    const etoNav=document.querySelector('.admin-nav-item[data-nav="eto"]');
    const hasPark=typeof companyHasOwnPark==='function' && companyHasOwnPark(typeof currentOwnCompany==='function'?currentOwnCompany():null);
    if(etoNav) etoNav.style.display=hasPark?'':'none';
  }
  syncAdminNav();
  paintAdminOwnerFilters();
  syncAdminProfileNavLabels();
}
function saveAdminSession(){
  if(!currentAdmin){ try{ localStorage.removeItem(ADMIN_SESSION_KEY); }catch(_){} return; }
  try{
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
      id:currentAdmin.id, name:currentAdmin.name, isSuper:!!currentAdmin.isSuper,
      spaceId:currentAdmin.spaceId||null, at:new Date().toISOString()
    }));
  }catch(_){}
}
function clearAdminSession(){
  try{ localStorage.removeItem(ADMIN_SESSION_KEY); }catch(_){}
}
function restoreAdminSession(){
  migrateAdmins();
  let raw=null;
  try{ raw=JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY)||'null'); }catch(_){ raw=null; }
  if(!raw||(!raw.id && !raw.name)) return false;
  let adm=(state.admins||[]).find(a=>raw.id && a.id===raw.id);
  if(!adm && raw.name) adm=(state.admins||[]).find(a=>samePersonName(a.name, raw.name));
  if(!adm){ clearAdminSession(); return false; }
  currentAdmin={id:adm.id, name:adm.name, isSuper:!!adm.isSuper, spaceId:adm.spaceId||null};
  saveAdminSession();
  try{ touchAdminPresence('admin'); }catch(_){}
  try{ startPresenceHeartbeat(); }catch(_){}
  updateAdminChrome();
  seedAdminInboxNotifySnapshot();
  syncAdminNotifyToggle();
  return true;
}
async function loginAdmin(){
  migrateAdmins();
  const pinErr=$('pin-error');
  if(pinErr) pinErr.textContent='';
  const btn=$('pin-ok');
  if(btn) btn.disabled=true;
  try{
  const loginRaw=(($('admin-login-inn')||{}).value||'').trim();
  const pin=(($('pin-input')||{}).value||'').trim();
  if(!loginRaw){
    if(pinErr) pinErr.textContent='Укажите телефон или ИНН организации';
    return;
  }
  const inn=normalizeLoginInn(loginRaw);
  if(!looksLikeAdminPhoneInput(loginRaw) && inn && inn.length!==10 && inn.length!==12){
    if(pinErr) pinErr.textContent='ИНН: 10 цифр для организации или 12 для ИП';
    return;
  }
  const admPre=findAdminByLoginAndPin(loginRaw, pin);
  try{
    if(navigator.onLine!==false && typeof fetchServerState==='function'){
      const rec=await fetchServerState(3500, {
        pin,
        meta: admPre ? {id: admPre.id, spaceId: admPre.spaceId, role:'admin'} : {role:'admin'}
      });
      if(rec&&rec.payload){
        pbRecordId=rec.id;
        mergeAdminAuthFromRemote(rec.payload, {remoteWinsAuth:true});
        migrateAdmins();
        migrateSpaces();
        migrateDriverPins();
        persistLocalOnly();
      }
    }
  }catch(_){}
  const adm=findAdminByLoginAndPin(loginRaw, pin);
  if(!adm){
    if(pinErr){
      if(looksLikeAdminPhoneInput(loginRaw)){
        pinErr.textContent='Телефон не найден или неверный PIN. Вход по телефону включает супер-админ в «Активность».';
      }else{
        pinErr.textContent=spaceIdsForLoginInn(inn).size
          ? 'Неверный PIN для этой организации'
          : 'Организация с таким ИНН не найдена. Проверьте цифры или обратитесь к супер-админу';
      }
    }
    return;
  }
  if(pin!==String(adm.pin)){
    if(pinErr) pinErr.textContent='Неверный PIN. Если доступ только что восстановили — обновите страницу (Ctrl+F5)';
    return;
  }
  if(adm.mustChangePin){
    alert('Смените PIN: «Активность» → блок администраторов. Слабый или устаревший PIN из истории проекта.');
  }
  currentAdmin={id:adm.id, name:adm.name, isSuper:!!adm.isSuper, spaceId:adm.spaceId||null};
  if(adm.isSuper&&adm.spaceId) state.adminOwnerFilter=adm.spaceId;
  saveAdminSession();
  markAdminPinOk();
  pushAdminLogin('login');
  touchAdminPresence('admin');
  startPresenceHeartbeat();
  armadaApiLogin(pin, currentAdmin).finally(()=>persist());
  updateAdminChrome();
  show('admin');
  renderAdmin();
  seedAdminInboxNotifySnapshot();
  syncAdminNotifyToggle();
  if(window.ArmadaOnboarding) ArmadaOnboarding.maybeAdmin();
  if(typeof maybeOpenAdminProfileOnLogin==='function') maybeOpenAdminProfileOnLogin(adm);
  }finally{
    if(btn) btn.disabled=false;
  }
}
function logoutAdmin(){
  if(currentAdmin){
    pushAdminLogin('logout');
    clearMyPresence();
    persist();
  }
  stopPresenceHeartbeat();
  currentAdmin=null;
  clearAdminSession();
  clearAdminPinOk();
  setArmadaApiToken('');
  updateAdminChrome();
  if(getEntryMode()==='admin') goEntryLanding('admin');
  else show('roles');
}
function openAdminActivity(){
  if(!isSuperAdmin()){ alert('Доступно только супер админу'); return; }
  // подтянуть свежие presence с сервера мягко через persist уже есть; обновим UI
  renderAdminActivity();
  show('admin-activity-screen');
}
function openAdminBilling(){
  if(!isSuperAdmin()){ alert('Доступно только супер админу'); return; }
  renderAdminBilling();
  show('admin-billing-screen');
}
function openAdminLinks(){
  renderAdminLinks();
  show('admin-links-screen');
}
function adminLinkCard(title, desc, url, share){
  const s=share&&typeof share==='object'?share:{};
  return `<section class="admin-link-card">
    <h3>${esc(title)}</h3>
    <p class="meta">${esc(desc)}</p>
    <p class="admin-link-url"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a></p>
    <div class="share-row">
      <a class="secondary" href="${esc(url)}" target="_blank" rel="noopener">Открыть</a>
      ${entryShareBlockHtml({kind:s.kind||'customerPortal',url,title:'QR + SMS',carrier:s.carrier||'',phone:s.phone||'',expires:s.expires||''})}
    </div>
  </section>`;
}
function renderAdminLinks(){
  const form=$('links-form');
  if(!form) return;
  const sid=currentSpaceId();
  const sp=sid?findSpaceById(sid):null;
  const co=currentOwnCompany();
  const carrier=(co&&co.name)||(sp&&sp.name)||'АРМАДА';
  const portalUrl=sid?customerPortalPageUrl({spaceId:sid}):`${location.origin}/z`;
  const drvUrl=driverEntryPageUrl();
  const admUrl=adminEntryPageUrl();
  form.innerHTML=`<p class="cat-panel-hint">У каждой роли — своя страница входа. Сохраните в закладки или отправьте водителю/заказчику через QR и SMS.</p>
    ${adminLinkCard('Водитель', 'Смена, ЕТО и заказы в дороге — отдельный вход /v', drvUrl, {kind:'driverEntry',carrier})}
    ${adminLinkCard('Заказчик', 'Портал вашей фирмы — заявки и статус', portalUrl, {kind:'customerPortal',carrier})}
    ${adminLinkCard('Администратор', 'Кабинет диспетчера — заявки и справочники', admUrl, {kind:'adminEntry'})}
    <p class="meta" style="margin-top:12px">Короткий адрес заказчика (/z/…) настраивается в «Тарифы» (супер-админ) или у супер-админа в биллинге space.</p>`;
  $('links-back').onclick=()=>{ show('admin'); renderAdmin(); };
  wireEntryShareButtons(form);
}
function renderAdminBilling(){
  migrateBilling();
  const spaces=(state.spaces||[]).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ru'));
  const rows=spaces.map(sp=>{
    const b=getBillingForSpace(sp.id);
    const st=resolveBillingStatus(sp.id);
    const lim=billingLimitsForSpace(sp.id);
    const use=billingUsageForSpace(sp.id);
    const ledger=(b.ledger||[]).slice(-5).reverse().map(e=>{
      const sign=e.amount>=0?'+':'';
      return `<div class="meta">${formatBillingDate(e.at)} · ${esc(e.type)} · ${sign}${formatRub(e.amount)} ${esc(e.note||'')}</div>`;
    }).join('') || '<div class="meta">Нет записей</div>';
    return `<section class="card" style="margin-bottom:10px">
      <h3>${esc(sp.name)}</h3>
      <p class="meta">Space ${esc(sp.id)} · ${billingStatusLabel(st)} · баланс ${formatRub(b.balance)}</p>
      <div class="eto-grid">
        <div><span class="lbl">Пилот до</span><b>${formatBillingDate(b.trialEndsAt)}</b></div>
        <div><span class="lbl">Оплачено до</span><b>${b.subscriptionEndsAt?formatBillingDate(b.subscriptionEndsAt):'—'}</b></div>
        <div><span class="lbl">Водители</span><b>${use.drivers}/${lim.drivers}</b></div>
        <div><span class="lbl">ТС</span><b>${use.vehicles}/${lim.vehicles}</b></div>
        <div><span class="lbl">Админы</span><b>${use.admins}/${lim.admins}</b></div>
        <div><span class="lbl">Комиссия</span><b>${Math.round((b.commissionRate||0)*100)}%</b></div>
        <div><span class="lbl">ЭТрН</span><b>${b.etrnEnabled?'в тарифе':'нет'}</b></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center">
        <select id="bill-plan-${esc(sp.id)}" style="flex:1;min-width:140px">${Object.values(BILLING_PLANS).map(p=>{
          const sel=b.planId===p.id?' selected':'';
          return `<option value="${esc(p.id)}"${sel}>${esc(p.name)} — ${formatRub(p.priceMonthly)}/мес</option>`;
        }).join('')}</select>
        <button type="button" class="secondary" data-bill-save="${esc(sp.id)}">Тариф</button>
        <button type="button" class="secondary" data-bill-trial="${esc(sp.id)}">+30 дн. пилот</button>
        <input id="bill-pay-amt-${esc(sp.id)}" inputmode="numeric" placeholder="₽ оплата" style="width:100px" />
        <input id="bill-pay-note-${esc(sp.id)}" placeholder="счёт/акт" style="flex:1;min-width:100px" />
        <button type="button" class="primary" data-bill-pay="${esc(sp.id)}">Записать оплату</button>
      </div>
      <details style="margin-top:8px"><summary style="cursor:pointer;font-size:.8rem">Журнал (последние)</summary>${ledger}</details>
      <p class="meta" style="margin-top:10px">Портал заказчиков:
        <a href="${esc(customerPortalPageUrl({spaceId:sp.id}))}" target="_blank" rel="noopener">${esc(customerPortalPageUrl({spaceId:sp.id}))}</a>
      </p>
      <div class="share-row" style="margin-top:8px">
        ${entryShareBlockHtml({kind:'customerPortal',url:customerPortalPageUrl({spaceId:sp.id}),title:'QR + SMS заказчику',carrier:sp.name})}
        ${entryShareBlockHtml({kind:'driverEntry',url:driverEntryPageUrl(),title:'QR + SMS водителям',carrier:sp.name})}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;align-items:center">
        <label class="meta" for="bill-slug-${esc(sp.id)}">Короткий адрес /z/</label>
        <input id="bill-slug-${esc(sp.id)}" placeholder="severlog" value="${esc(sp.portalSlug||'')}" style="width:120px" />
        <button type="button" class="secondary" data-bill-slug="${esc(sp.id)}">Сохранить slug</button>
      </div>
      <div style="margin-top:10px">
        <label class="meta">Логотип на входе заказчика (PNG/JPG, до 80 КБ)</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:4px">
          ${sp.portalLogo?`<img src="${esc(sp.portalLogo)}" alt="" style="height:40px;border-radius:8px;border:1px solid #e2e8f0" />`:''}
          <input type="file" accept="image/png,image/jpeg,image/webp" data-bill-logo="${esc(sp.id)}" />
          ${sp.portalLogo?`<button type="button" class="secondary" data-bill-logo-clear="${esc(sp.id)}">Убрать</button>`:''}
        </div>
      </div>
    </section>`;
  }).join('');
  const form=$('billing-form');
  if(!form) return;
  form.innerHTML=`<p class="cat-panel-hint">M0: ручные счета и оплата. M3: webhook ЮKassa/Тинькофф — см. docs/PAYMENT_INTEGRATION.md. Публичный HTTPS — до активных B2B вне пилота (docs/HTTPS_PREREQUISITE.md).</p>
    ${rows || '<p class="empty">Нет space — создайте админа с фирмой</p>'}`;
  $('billing-back').onclick=()=>{ show('admin'); renderAdmin(); };
  form.querySelectorAll('[data-bill-save]').forEach(btn=>{
    btn.onclick=()=>{
      const sid=btn.dataset.billSave;
      const sel=$('bill-plan-'+sid);
      if(!sid||!sel) return;
      setSpaceBillingPlan(sid, sel.value);
      persist();
      renderAdminBilling();
    };
  });
  form.querySelectorAll('[data-bill-trial]').forEach(btn=>{
    btn.onclick=()=>{
      const sid=btn.dataset.billTrial;
      if(typeof bootstrapPilotSpace==='function') bootstrapPilotSpace(sid, {extendDays:30});
      else extendSpaceTrial(sid, 30);
      persist();
      renderAdminBilling();
    };
  });
  form.querySelectorAll('[data-bill-pay]').forEach(btn=>{
    btn.onclick=()=>{
      const sid=btn.dataset.billPay;
      const amt=+(($('bill-pay-amt-'+sid)||{}).value||'').replace(/\s/g,'');
      const note=(($('bill-pay-note-'+sid)||{}).value||'').trim();
      if(!(amt>0)){ alert('Укажите сумму оплаты'); return; }
      recordManualPayment(sid, amt, note, currentAdmin&&currentAdmin.name);
      persist();
      renderAdminBilling();
    };
  });
  form.querySelectorAll('[data-bill-slug]').forEach(btn=>{
    btn.onclick=()=>{
      const sid=btn.dataset.billSlug;
      const sp=findSpaceById(sid);
      if(!sp) return;
      let slug=String((($('bill-slug-'+sid)||{}).value||'')).trim().toLowerCase()
        .replace(/[^a-z0-9-]/g,'').replace(/^-+|-+$/g,'').slice(0,32);
      if(slug.length<3){ alert('Slug от 3 символов: латиница, цифры, дефис'); return; }
      const clash=(state.spaces||[]).find(s=>s.id!==sid && String(s.portalSlug||'').toLowerCase()===slug);
      if(clash){ alert('Этот адрес уже у space «'+clash.name+'»'); return; }
      sp.portalSlug=slug;
      bumpDataEpoch('portal-slug');
      persist();
      renderAdminBilling();
    };
  });
  form.querySelectorAll('[data-bill-logo]').forEach(inp=>{
    inp.onchange=()=>{
      const sid=inp.dataset.billLogo;
      const sp=findSpaceById(sid);
      const file=inp.files&&inp.files[0];
      if(!sp||!file) return;
      if(file.size>80*1024){ alert('Логотип до 80 КБ'); inp.value=''; return; }
      const reader=new FileReader();
      reader.onload=()=>{
        sp.portalLogo=String(reader.result||'');
        bumpDataEpoch('portal-logo');
        persist();
        renderAdminBilling();
      };
      reader.readAsDataURL(file);
    };
  });
  form.querySelectorAll('[data-bill-logo-clear]').forEach(btn=>{
    btn.onclick=()=>{
      const sp=findSpaceById(btn.dataset.billLogoClear);
      if(!sp) return;
      sp.portalLogo='';
      bumpDataEpoch('portal-logo');
      persist();
      renderAdminBilling();
    };
  });
  wireEntryShareButtons(form);
}
function activityLogWhen(at){
  try{
    return new Date(at).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  }catch(_){ return '—'; }
}
function flashAdmPinOk(msg, isWarn){
  const el=$('adm-pin-ok'); if(!el) return;
  el.textContent=msg||'Пин-код записан';
  el.classList.toggle('toast-warn', !!isWarn);
  el.classList.toggle('toast-ok', !isWarn);
  el.style.display='block';
  clearTimeout(flashAdmPinOk._t);
  const ms=(msg&&msg.length>28)?4200:2200;
  flashAdmPinOk._t=setTimeout(()=>{ if(el) el.style.display='none'; }, ms);
}
function paintEpdServerStatus(){
  const el=$('epd-server-status');
  if(!el) return;
  if(typeof fetchArmadaApiHealth!=='function'){
    el.textContent='armada-api: проверка недоступна (нет API)';
    return;
  }
  el.textContent='Проверка armada-api…';
  fetchArmadaApiHealth(8000).then(h=>{
    if(!h||!h.ok){
      el.innerHTML='<span class="hint">armada-api: не отвечает или недоступен</span>';
      return;
    }
    const epd=h.epd||{};
    const op=epd.operator||'—';
    const configured=!!epd.configured;
    const sandbox=!!epd.sandbox;
    const cfgLabel=configured?'ключи на сервере есть':'ключи не настроены — см. plans/KONTUR_EPD_PLAN.md';
    const sbLabel=sandbox?'тестовый контур':'боевой контур';
    el.innerHTML=`<span class="${configured?'ok':'hint'}">armada-api ${esc(h.version||'')}: оператор <strong>${esc(op)}</strong> · ${esc(cfgLabel)} · ${esc(sbLabel)}</span>`;
    if(op==='kontur'&&!configured){
      el.innerHTML+=`<br><span class="hint">Когда Контур пришлёт ключ разработчика — добавьте в .env на VPS и перезапустите armada-api.</span>`;
    }
  }).catch(()=>{
    el.textContent='armada-api: ошибка проверки';
  });
}
function renderAdminActivity(){
  migrateAdmins();
  migrateCustomerPortalLeads();
  const online=onlineAdmins();
  const log=(state.adminLogins||[]).slice(0,40);
  const ops=(state.opsLog||[]).slice(0,25);
  const leads=typeof pendingCustomerPortalLeads==='function'?pendingCustomerPortalLeads():[];
  const transportLeads=typeof pendingTransportOrders==='function'?pendingTransportOrders():leads.filter(l=>l.kind==='transport');
  const pilotLeads=typeof pendingPilotLeads==='function'?pendingPilotLeads():leads.filter(l=>l.kind==='pilot');
  const portalLeads=typeof pendingPortalAccessLeads==='function'?pendingPortalAccessLeads():leads.filter(l=>l.kind==='portal');
  const admins=state.admins.slice().sort((a,b)=>(b.isSuper?1:0)-(a.isSuper?1:0) || String(a.name).localeCompare(String(b.name),'ru'));
  $('activity-form').innerHTML=`
    <p class="cat-panel-hint">Видит только супер админ. Онлайн = активность за последние 1–2 мин.</p>
    ${transportLeads.length?`<section class="form-section">
      <h2 class="form-section-title">Заявки на транспорт · armada.sx</h2>
      <p class="cat-panel-hint">С armada.sx → <a href="/order.html" target="_blank" rel="noopener">order.html</a>. Логист — <strong>ООО «Армада»</strong>, заказчик автоматически закрепляется в её справочнике, заявка попадает в общий список.</p>
      <div class="cat-list">
        ${transportLeads.map(l=>{
          const vLabel=l.vehicleTypeId&&typeof custVehicleTypeLabel==='function'?custVehicleTypeLabel(l.vehicleTypeId):(l.vehicleTypeId||'—');
          const ord=l.orderId?(state.orders||[]).find(o=>o.id===l.orderId):null;
          const ordNum=ord&&ord.sequentialNumber?`№${ord.sequentialNumber}`:'';
          const logist=l.logistCompanyName||'ООО «Армада»';
          return `
          <div class="item-card" data-lead-id="${esc(l.id)}">
            <div class="item-top">
              <div class="item-name">${esc(l.company)} · ${esc(vLabel)}</div>
              <span class="hint">${esc(typeof dateTime==='function'?dateTime(l.createdAt):l.createdAt)}</span>
            </div>
            <div class="hint">${esc(l.phone)}${l.contactName?` · ${esc(l.contactName)}`:''}${l.source?` · ${esc(l.source)}`:''}</div>
            <div class="hint">Логист: ${esc(logist)}${ordNum?` · заявка ${esc(ordNum)}`:''}</div>
            ${l.loadAddress?`<div class="hint">Подача: ${esc(l.loadAddress)}</div>`:''}
            ${l.unloadAddress?`<div class="hint">Выгрузка: ${esc(l.unloadAddress)}</div>`:''}
            ${l.vehicleAt?`<div class="hint">Когда: ${esc(typeof dateTime==='function'?dateTime(l.vehicleAt):l.vehicleAt)}</div>`:''}
            ${l.comment?`<div class="hint">${esc(l.comment)}</div>`:''}
            <div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap">
              ${l.orderId?`<button type="button" class="primary lead-open-order-btn" data-order-id="${esc(l.orderId)}">Открыть заявку</button>`:''}
              <button type="button" class="secondary lead-done-btn" data-lead-id="${esc(l.id)}">Обработано</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </section>`:''}
    ${pilotLeads.length?`<section class="form-section">
      <h2 class="form-section-title">Заявки на пилот 30 дней</h2>
      <p class="cat-panel-hint">С <a href="/pilot.html" target="_blank" rel="noopener">pilot.html</a> — логист или перевозчик. Подключите кабинет и отметьте «Обработано».</p>
      <div class="cat-list">
        ${pilotLeads.map(l=>{
          const roleLbl=l.pilotRole==='carrier'?'перевозчик':l.pilotRole==='logist'?'логист':(l.pilotRole||'—');
          return `
          <div class="item-card" data-lead-id="${esc(l.id)}">
            <div class="item-top">
              <div class="item-name">${esc(l.company)} · пилот · ${esc(roleLbl)}</div>
              <span class="hint">${esc(typeof dateTime==='function'?dateTime(l.createdAt):l.createdAt)}</span>
            </div>
            <div class="hint">${esc(l.phone)}${l.contactName?` · ${esc(l.contactName)}`:''}${l.city?` · ${esc(l.city)}`:''}${l.fleetSize?` · ${esc(l.fleetSize)} маш.`:''}</div>
            ${l.comment?`<div class="hint">${esc(l.comment)}</div>`:''}
            <div class="row" style="margin-top:8px">
              <button type="button" class="secondary lead-done-btn" data-lead-id="${esc(l.id)}">Обработано</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </section>`:''}
    ${portalLeads.length?`<section class="form-section">
      <h2 class="form-section-title">Заявки заказчиков · портал</h2>
      <p class="cat-panel-hint">С kp-zakaz.html — «Хочу отправлять грузы». Включите портал в карточке компании и выдайте PIN.</p>
      <div class="cat-list">
        ${portalLeads.map(l=>`
          <div class="item-card" data-lead-id="${esc(l.id)}">
            <div class="item-top">
              <div class="item-name">${esc(l.company)}</div>
              <span class="hint">${esc(typeof dateTime==='function'?dateTime(l.createdAt):l.createdAt)}</span>
            </div>
            <div class="hint">${esc(l.phone)}${l.inn?` · ИНН ${esc(l.inn)}`:''}${l.contactName?` · ${esc(l.contactName)}`:''}</div>
            ${l.comment?`<div class="hint">${esc(l.comment)}</div>`:''}
            ${l.carrierHint?`<div class="hint">Перевозчик: ${esc(l.carrierHint)}</div>`:''}
            <div class="row" style="margin-top:8px">
              <button type="button" class="secondary lead-done-btn" data-lead-id="${esc(l.id)}">Обработано</button>
            </div>
          </div>`).join('')}
      </div>
    </section>`:''}
    ${ops.length?`<section class="form-section">
      <h2 class="form-section-title">Журнал ЭТрН / API (S3)</h2>
      <div class="cat-list">
        ${ops.map(e=>`
          <div class="item-card">
            <div class="item-top">
              <div class="item-name">${esc(e.kind||'info')}</div>
              <span class="hint">${esc(dateTime(e.at))}</span>
            </div>
            <div class="hint">${esc(e.detail||'')}</div>
          </div>`).join('')}
      </div>
    </section>`:''}
    <section class="form-section">
      <h2 class="form-section-title">Сейчас в приложении</h2>
      <div class="cat-list">
        ${online.length?online.map(p=>`
          <div class="item-card">
            <div class="item-top">
              <div class="item-name">${esc(p.adminName)}</div>
              <span class="ok" style="font-size:.75rem">онлайн</span>
            </div>
            <div class="hint">Экран: ${esc(p.screen||'admin')} · ${esc(dateTime(p.lastSeen))}</div>
          </div>`).join('')
        :`<div class="empty">Никого нет онлайн</div>`}
      </div>
    </section>
    <details class="activity-log-fold">
      <summary class="activity-log-summary">Журнал входов${log.length?` · ${log.length}`:''}</summary>
      <div class="activity-log-compact">
        ${log.length?log.slice(0,12).map(e=>`
          <div class="activity-log-line">
            <span class="activity-log-when">${esc(activityLogWhen(e.at))}</span>
            <span class="activity-log-who">${esc(e.adminName)}</span>
            <span class="activity-log-act ${e.action==='login'?'is-in':'is-out'}">${e.action==='login'?'вход':'выход'}</span>
          </div>`).join('')
        :`<div class="empty">Пока пусто</div>`}
        ${log.length>12?`<p class="hint activity-log-more">Показаны последние 12 из ${log.length}</p>`:''}
      </div>
    </details>
    <section class="form-section">
      <h2 class="form-section-title">Пространства / администраторы</h2>
      <p class="cat-panel-hint">Каждый админ — своё пространство фирмы. ИНН → «Загрузить» подтянет реквизиты из ЕГРЮЛ (ФНС).</p>
    <div class="cat-compact">
      <div class="row">
        <input id="new-adm-name" placeholder="Имя администратора" style="flex:1.3" />
        <input id="new-adm-pin" inputmode="numeric" maxlength="8" placeholder="PIN" style="flex:0 0 72px;text-align:center" />
      </div>
      <label>Телефон (если вход по телефону)</label>
      <input id="new-adm-phone" inputmode="tel" placeholder="+7…" autocomplete="tel" />
      <label>Вход в кабинет</label>
      <select id="new-adm-login-by">
        <option value="inn">ИНН организации + PIN</option>
        <option value="phone">Телефон + PIN</option>
      </select>
      <label>Название фирмы</label>
      <input id="new-firm-name" placeholder="ООО «…» / ИП …" />
      <label>ИНН</label>
      <div class="row">
        <input id="new-firm-inn" inputmode="numeric" maxlength="12" placeholder="10 или 12 цифр" style="flex:1" />
        <button type="button" class="secondary" id="new-firm-inn-lookup" style="width:auto;flex:0 0 auto;padding:8px 10px">Загрузить</button>
      </div>
      <div class="hint" id="new-firm-inn-status"></div>
      <input id="new-firm-ogrn" placeholder="ОГРН" />
      <input id="new-firm-kpp" placeholder="КПП" />
      <input id="new-firm-address" placeholder="Адрес" />
      <input id="new-firm-director" placeholder="Руководитель" />
      <label class="check"><input type="checkbox" id="new-adm-super"/> Супер админ</label>
      <label class="check"><input type="checkbox" id="new-adm-driver"/> Создать профиль водителя (если сам за рулём)</label>
      <button type="button" class="primary cat-add-btn" id="new-adm-add">+ администратор и фирма</button>
      <p class="hint">Профиль водителя нужен только для входа в приложение «Водитель». Офисный логист — галочку не ставить.</p>
    </div>
      <h2 class="form-section-title" style="margin-top:8px">Реквизиты по ИНН (ФНС)</h2>
      <p class="cat-panel-hint">По умолчанию — официальный ЕГРЮЛ (egrul.nalog.ru). Для полного адреса: ключ API-ФНС (api-fns.ru). DaData — резервный источник.</p>
      <label>Ключ API-ФНС (опционально)</label>
      <div class="row">
        <input id="fns-api-key" type="password" placeholder="Ключ api-fns.ru" value="${esc((state.settings&&state.settings.fnsApiKey)||'')}" style="flex:1" />
        <button type="button" class="primary" id="fns-api-save" style="width:auto;flex:0 0 auto;padding:8px 12px">OK</button>
      </div>
      <label style="margin-top:8px">Токен DaData (резерв)</label>
      <div class="row">
        <input id="dadata-token" type="password" placeholder="Token DaData" value="${esc((state.settings&&state.settings.dadataToken)||'')}" style="flex:1" />
        <button type="button" class="primary" id="dadata-save" style="width:auto;flex:0 0 auto;padding:8px 12px">OK</button>
      </div>
      <h2 class="form-section-title" style="margin-top:12px">Оператор ЭПД (ЭТрН)</h2>
      <p class="cat-panel-hint">S3-2.7 стратегического плана. Оператор на сервере — Контур.Логистика (<a href="https://developer.kontur.ru/doc/logistics.api" target="_blank" rel="noopener">документация API</a>). Ключи разработчика прописываются в <code>/opt/armada-api/.env</code> на VPS, не в браузере.</p>
      <p class="cat-panel-hint" id="epd-server-status">Проверка armada-api…</p>
      <label>Оператор (в данных приложения — для UI и sandbox)</label>
      <div class="row">
        <select id="epd-operator" style="flex:1">
          <option value="">— sandbox (локально) —</option>
          <option value="sbis" ${(state.settings&&state.settings.epdOperator)==='sbis'?'selected':''}>СБИС</option>
          <option value="kontur" ${(state.settings&&state.settings.epdOperator)==='kontur'?'selected':''}>Контур</option>
          <option value="diadoc" ${(state.settings&&state.settings.epdOperator)==='diadoc'?'selected':''}>Диадoc</option>
        </select>
        <button type="button" class="primary" id="epd-operator-save" style="width:auto;flex:0 0 auto;padding:8px 12px">OK</button>
      </div>
      <label>Webhook token (для POST /epd/webhook)</label>
      <div class="row">
        <input id="epd-webhook-token" type="password" placeholder="Секрет webhook" value="${esc((state.settings&&state.settings.epdWebhookToken)||'')}" style="flex:1" />
        <button type="button" class="primary" id="epd-webhook-save" style="width:auto;flex:0 0 auto;padding:8px 12px">OK</button>
      </div>
      <h2 class="form-section-title" style="margin-top:12px">Карта маршрута (Яндекс)</h2>
      <p class="cat-panel-hint">Ключ JavaScript API и Static API Яндекс.Карт — для схемы Яндекса на форме заказчика. Без ключа — OpenStreetMap.</p>
      <label>API-ключ Яндекс.Карт</label>
      <div class="row">
        <input id="yandex-maps-key" type="password" placeholder="Ключ developer.tech.yandex.ru" value="${esc((state.settings&&state.settings.yandexMapsApiKey)||'')}" style="flex:1" />
        <button type="button" class="primary" id="yandex-maps-save" style="width:auto;flex:0 0 auto;padding:8px 12px">OK</button>
      </div>
      <div class="toast-ok" id="adm-pin-ok" style="display:none"></div>
      <div class="cat-list" style="margin-top:8px">
        ${admins.map((a,i)=>{
          const sp=findSpaceById(a.spaceId);
          return `
          <div class="item-card">
            <div class="item-top">
              <div class="item-name">${esc(a.name)}</div>
            </div>
            <div class="hint">Фирма: ${esc(sp?sp.name:'—')}${sp&&sp.inn?` · ИНН ${esc(sp.inn)}`:''}</div>
            ${sp&&sp.address?`<div class="hint">${esc(sp.address)}</div>`:''}
            <div class="item-mid">
              <input id="adm-pin-${i}" inputmode="numeric" maxlength="8" value="${esc(a.pin)}" placeholder="PIN" />
              <label class="check"><input type="checkbox" id="adm-super-${i}" ${a.isSuper?'checked':''}/> Супер</label>
            </div>
            <div class="item-mid">
              <input id="adm-phone-${i}" inputmode="tel" value="${esc(a.phone||adminLoginPhone(a)||'')}" placeholder="Телефон для входа" style="flex:1.2" />
              <select id="adm-login-by-${i}" style="flex:1">
                <option value="inn" ${a.loginBy!=='phone'?'selected':''}>ИНН + PIN</option>
                <option value="phone" ${a.loginBy==='phone'?'selected':''}>Телефон + PIN</option>
              </select>
            </div>
            <div class="item-actions">
              <button type="button" class="primary" data-save-adm="${i}">Сохранить</button>
              ${a.isSuper?'<span class="hint">Супер админа нельзя удалить</span>':`<button type="button" class="secondary" data-del-adm="${a.id}">Удал.</button>`}
            </div>
          </div>`;
        }).join('')}
      </div>
    </section>
  `;
  $('act-back').onclick=()=>{ show('admin'); renderAdmin(); };
  $('fns-api-save')&&($('fns-api-save').onclick=()=>{
    state.settings=Object.assign({fnsApiKey:'',dadataToken:'',yandexMapsApiKey:''}, state.settings||{});
    state.settings.fnsApiKey=(($('fns-api-key')||{}).value||'').trim();
    persist();
    alert(state.settings.fnsApiKey?'Ключ API-ФНС сохранён':'Ключ API-ФНС очищен');
  });
  $('dadata-save')&&($('dadata-save').onclick=()=>{
    state.settings=Object.assign({fnsApiKey:'',dadataToken:'',yandexMapsApiKey:''}, state.settings||{});
    state.settings.dadataToken=(($('dadata-token')||{}).value||'').trim();
    persist();
    alert(state.settings.dadataToken?'Токен DaData сохранён':'Токен очищен');
  });
  $('yandex-maps-save')&&($('yandex-maps-save').onclick=()=>{
    state.settings=Object.assign({fnsApiKey:'',dadataToken:'',yandexMapsApiKey:'',epdOperator:'',epdWebhookToken:''}, state.settings||{});
    state.settings.yandexMapsApiKey=(($('yandex-maps-key')||{}).value||'').trim();
    persist();
    alert(state.settings.yandexMapsApiKey?'Ключ Яндекс.Карт сохранён':'Ключ Яндекс.Карт очищен — карта OSM');
  });
  $('epd-operator-save')&&($('epd-operator-save').onclick=()=>{
    state.settings=Object.assign({fnsApiKey:'',dadataToken:'',yandexMapsApiKey:'',epdOperator:'',epdWebhookToken:''}, state.settings||{});
    state.settings.epdOperator=(($('epd-operator')||{}).value||'').trim();
    persist();
    alert(state.settings.epdOperator?`Оператор ЭПД: ${state.settings.epdOperator}`:'Оператор: sandbox (локально)');
  });
  $('epd-webhook-save')&&($('epd-webhook-save').onclick=()=>{
    state.settings=Object.assign({fnsApiKey:'',dadataToken:'',yandexMapsApiKey:'',epdOperator:'',epdWebhookToken:''}, state.settings||{});
    state.settings.epdWebhookToken=(($('epd-webhook-token')||{}).value||'').trim();
    persist();
    alert(state.settings.epdWebhookToken?'Webhook token сохранён':'Webhook token очищен');
  });
  paintEpdServerStatus();
  $('new-firm-inn-lookup')&&($('new-firm-inn-lookup').onclick=async()=>{
    const st=$('new-firm-inn-status');
    const inn=(($('new-firm-inn')||{}).value||'').trim();
    if(st) st.textContent='Загрузка…';
    try{
      const party=await lookupPartyByInn(inn);
      if($('new-firm-name') && !(($('new-firm-name').value||'').trim())) $('new-firm-name').value=party.name||'';
      else if($('new-firm-name') && party.name) $('new-firm-name').value=party.name;
      if($('new-firm-inn')) $('new-firm-inn').value=party.inn||inn;
      if($('new-firm-ogrn')) $('new-firm-ogrn').value=party.ogrn||'';
      if($('new-firm-kpp')) $('new-firm-kpp').value=party.kpp||'';
      if($('new-firm-address')) $('new-firm-address').value=party.address||'';
      if($('new-firm-director')) $('new-firm-director').value=party.director||'';
      if(st) st.textContent='Реквизиты загружены';
    }catch(err){
      if(st) st.textContent=String(err.message||err);
    }
  });
  $('new-adm-add').onclick=async()=>{
    if(!isSuperAdmin()) return;
    const name=(($('new-adm-name')||{}).value||'').trim();
    const pin=(($('new-adm-pin')||{}).value||'').trim();
    const isSuper=!!(($('new-adm-super')||{}).checked);
    const firmName=(($('new-firm-name')||{}).value||'').trim();
    if(!name){ alert('Укажите имя администратора'); return; }
    if(!firmName){ alert('Укажите название фирмы'); return; }
    if(!pin||pin.length<4){ alert('PIN от 4 цифр'); return; }
    if(state.admins.some(a=>samePersonName(a.name, name))){ alert('Такое имя уже есть'); return; }
    const inn=(($('new-firm-inn')||{}).value||'').replace(/\D/g,'');
    if(inn && !isValidInn(inn)){ alert('Некорректный ИНН'); return; }
    const loginBy=(($('new-adm-login-by')||{}).value||'inn')==='phone'?'phone':'inn';
    const phoneRaw=(($('new-adm-phone')||{}).value||'').trim();
    const phone=typeof formatPhone==='function'?formatPhone(phoneRaw):phoneRaw;
    if(loginBy==='phone' && !phone){ alert('Для входа по телефону укажите номер'); return; }
    if(loginBy==='phone' && phone && state.admins.some(a=>a.loginBy==='phone' && adminLoginPhone(a)===phone)){
      alert('Этот телефон уже привязан к другому админу'); return;
    }
    const adm={id:uuid(), name, pin, isSuper, spaceId:null, loginBy};
    if(phone) adm.phone=phone;
    if(!($('new-adm-driver')||{}).checked) adm.skipDriverMirror=true;
    state.admins.push(adm);
    createSpaceForAdmin(adm, {
      name:firmName,
      inn,
      ogrn:(($('new-firm-ogrn')||{}).value||'').trim(),
      kpp:(($('new-firm-kpp')||{}).value||'').trim(),
      address:(($('new-firm-address')||{}).value||'').trim(),
      director:(($('new-firm-director')||{}).value||'').trim()
    });
    if(($('new-adm-driver')||{}).checked){
      if(typeof ensureAdminDriverMirror==='function') ensureAdminDriverMirror(adm);
      else if(typeof syncAdminAuthToDrivers==='function') syncAdminAuthToDrivers(adm);
    }
    if(typeof bumpDataEpoch==='function') bumpDataEpoch('new-admin');
    const btn=$('new-adm-add');
    if(btn){ btn.disabled=true; btn.textContent='…'; }
    let saveResult={ ok:navigator.onLine!==false, offline:navigator.onLine===false };
    if(typeof persistAdminPinImmediate==='function'){
      saveResult=await persistAdminPinImmediate();
    } else {
      persist();
    }
    if(btn){ btn.disabled=false; btn.textContent='+ администратор и фирма'; }
    renderAdminActivity();
    if(!saveResult.ok){
      alert('Администратор создан на этом устройстве, но не синхронизирован с сервером — проверьте интернет и сохраните PIN ещё раз');
    }
  };
  document.querySelectorAll('[data-save-adm]').forEach(b=>b.onclick=async()=>{
    if(!isSuperAdmin()) return;
    const i=+b.dataset.saveAdm;
    const pin=(($('adm-pin-'+i)||{}).value||'').trim();
    const isSuper=!!(($('adm-super-'+i)||{}).checked);
    const loginBy=(($('adm-login-by-'+i)||{}).value||'inn')==='phone'?'phone':'inn';
    const phoneRaw=(($('adm-phone-'+i)||{}).value||'').trim();
    const phone=typeof formatPhone==='function'?formatPhone(phoneRaw):phoneRaw;
    if(!pin||pin.length<4){ alert('PIN от 4 цифр'); return; }
    if(loginBy==='phone' && !phone){ alert('Для входа по телефону укажите номер'); return; }
    if(loginBy==='phone' && phone && state.admins.some((a,j)=>j!==i && a.loginBy==='phone' && adminLoginPhone(a)===phone)){
      alert('Этот телефон уже привязан к другому админу'); return;
    }
    state.admins[i].pin=pin;
    state.admins[i].loginBy=loginBy;
    if(phone) state.admins[i].phone=phone;
    else delete state.admins[i].phone;
    const isSuperRow=!!state.admins[i].isSuper || state.admins[i].id==='admin-super';
    const weak=typeof isRecoveryOrWeakAdminPin==='function'?isRecoveryOrWeakAdminPin(pin)
      :(typeof WEAK_ADMIN_PINS!=='undefined' && WEAK_ADMIN_PINS.has(pin));
    if(!weak) delete state.admins[i].mustChangePin;
    if(isSuperRow){
      if(!state.settings) state.settings={};
      if(!weak){
        if(typeof markSuperPinChangedByUser==='function') markSuperPinChangedByUser();
        else { state.settings.superPinChangedByUser=true; delete state.settings.superPinRecoveryNotice; }
      }
    }
    state.admins[i].isSuper=isSuper;
    if(!state.admins.some(a=>a.isSuper)){ alert('Должен остаться хотя бы один супер админ'); state.admins[i].isSuper=true; }
    // обновить текущую сессию если это я
    if(currentAdmin&&currentAdmin.id===state.admins[i].id){
      currentAdmin.isSuper=!!state.admins[i].isSuper;
      currentAdmin.name=state.admins[i].name;
      currentAdmin.spaceId=state.admins[i].spaceId||null;
      saveAdminSession();
      updateAdminChrome();
    }
    if(typeof syncAdminAuthToDrivers==='function') syncAdminAuthToDrivers(state.admins[i]);
    if(typeof bumpDataEpoch==='function') bumpDataEpoch('admin-pin');
    const btn=b;
    const prevText=btn.textContent;
    btn.disabled=true;
    btn.textContent='…';
    let saveResult={ ok:navigator.onLine!==false, offline:navigator.onLine===false };
    if(typeof persistAdminPinImmediate==='function'){
      saveResult=await persistAdminPinImmediate();
    } else {
      persist();
    }
    btn.disabled=false;
    btn.textContent=prevText;
    renderAdminActivity();
    if(saveResult.ok){
      flashAdmPinOk('Пин-код записан');
    } else {
      flashAdmPinOk('Пин-код записан на этом устройстве, но не на сервере — проверьте интернет', true);
    }
  });
  document.querySelectorAll('[data-del-adm]').forEach(b=>b.onclick=()=>{
    if(!isSuperAdmin()) return;
    const id=b.dataset.delAdm;
    const adm=state.admins.find(a=>a.id===id);
    if(!adm) return;
    if(adm.id===currentAdmin?.id){ alert('Нельзя удалить себя, пока вы в системе'); return; }
    if(adm.isSuper){ alert('Супер админа нельзя удалить'); return; }
    if(!confirm(`Удалить администратора ${adm.name}?`)) return;
    state.admins=state.admins.filter(a=>a.id!==id);
    persist(); renderAdminActivity();
  });
  document.querySelectorAll('.lead-open-order-btn').forEach(b=>b.onclick=()=>{
    const id=b.dataset.orderId;
    if(!id) return;
    if(typeof openDetail==='function') openDetail(id);
  });
  document.querySelectorAll('.lead-done-btn').forEach(b=>b.onclick=()=>{
    if(!isSuperAdmin()) return;
    const id=b.dataset.leadId;
    if(!id||typeof markCustomerPortalLeadDone!=='function') return;
    markCustomerPortalLeadDone(id);
    renderAdminActivity();
  });
}

function openVehicleCard(vehicleId){
  if(!currentAdmin){ fillAdminLoginSelect(); show('admin-pin'); return; }
  let v=fleetVehicleById(vehicleId);
  if(!v){
    const idx=(state.vehicles||[]).findIndex(x=>x.plate===vehicleId);
    v=idx>=0?state.vehicles[idx]:null;
  }
  if(!v){ alert('Авто не найдено'); openCatalogs(); return; }
  v=normalizeFleetVehicle(v);
  const vi=(state.vehicles||[]).findIndex(x=>x.id===v.id || (x.plate===v.plate && x.companyId===v.companyId));
  if(vi>=0) state.vehicles[vi]=Object.assign(state.vehicles[vi], v);
  else return;
  v=state.vehicles[vi];
  if(v.currentOdometer==null){
    // сначала из закрытых смен, иначе из заказов
    const fromShift=(state.shifts||[])
      .filter(s=>s && s.endedAt && !s.abandoned && s.vehiclePlate===v.plate
        && (!v.companyId || !s.ownCompanyId || s.ownCompanyId===v.companyId)
        && (s.parkingOdometer!=null || s.lastOdometerPoint!=null))
      .sort((a,b)=>new Date(b.endedAt)-new Date(a.endedAt))[0];
    const guess=fromShift
      ? +(fromShift.parkingOdometer??fromShift.lastOdometerPoint)
      : lastKnownOdometerForPlate(v.plate, v.companyId);
    if(guess!=null) v.currentOdometer=guess;
  }
  const firm=v.companyName||(findCompanyById(v.companyId)||{}).name||'';
  const logs=[...(v.maintenanceLogs||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt).localeCompare(String(a.createdAt)));
  const totalSpent=round2(logs.reduce((s,l)=>s+(l.total||0),0));
  const ivHtml=(v.serviceIntervals||[]).map(iv=>{
    const st=serviceIntervalStatus(v, iv);
    const every=[iv.everyKm?`каждые ${fmt(iv.everyKm)} км`:null, iv.everyMonths?`каждые ${iv.everyMonths} мес.`:null].filter(Boolean).join(' / ')||'—';
    const last=[iv.lastDate?`посл. ${iv.lastDate}`:null, iv.lastOdometer!=null?`одометр ${fmt(iv.lastOdometer)}`:null].filter(Boolean).join(' · ')||'ещё не было';
    const works=iv.works||[];
    const worksHtml=works.length
      ? `<details style="margin-top:6px">
          <summary style="cursor:pointer;color:var(--accent);font-weight:700;font-size:.78rem">Работы (${works.length}) — с описанием</summary>
          <ol style="margin:6px 0 0;padding-left:1.2em;font-size:.78rem;line-height:1.35">
            ${works.map(workItemHtml).join('')}
          </ol>
          ${iv.note?`<div class="meta" style="margin-top:4px">${esc(iv.note)}</div>`:''}
        </details>`
      : (iv.note?`<div class="meta" style="margin-top:4px">${esc(iv.note)}</div>`:'');
    return `<div class="svc-iv" data-iv="${esc(iv.id)}" style="flex-wrap:wrap">
      <div style="min-width:0;flex:1">
        <div style="font-weight:700">${esc(iv.name)} <span class="svc-badge svc-${st.level}">${esc(st.label)}</span></div>
        <div class="meta">${esc(every)} · ${esc(last)}${st.detail?' · '+esc(st.detail):''}</div>
        ${worksHtml}
      </div>
      <button type="button" class="icon-btn danger" data-del-iv="${esc(iv.id)}" title="Удалить">×</button>
    </div>`;
  }).join('') || `<div class="hint">Интервалов пока нет — добавьте ниже (масло, ТО…)</div>`;
  const logHtml=logs.map(l=>{
    const mats=(l.materials||[]).map(m=>`${m.name}${m.qty&&m.qty!==1?' ×'+m.qty:''} — ${fmt(m.sum)} ₽`).join('; ');
    const prog=checklistProgress(l.checklist);
    const checkHtml=prog.total
      ? `<details style="margin-top:6px" ${prog.all?'':'open'}>
          <summary style="cursor:pointer;color:var(--accent);font-weight:700;font-size:.78rem">
            Чек-лист ${prog.done}/${prog.total}${prog.all?' · готово':''}
          </summary>
          <div class="svc-check" data-check-log="${esc(l.id)}">
            ${(l.checklist||[]).map(it=>checklistItemHtml(it,{checkId:it.id})).join('')}
          </div>
          <div class="svc-check-actions">
            <button type="button" class="secondary" data-check-all="${esc(l.id)}" style="width:auto;padding:6px 10px;font-size:.72rem">Отметить все</button>
            <button type="button" class="secondary" data-check-none="${esc(l.id)}" style="width:auto;padding:6px 10px;font-size:.72rem">Снять все</button>
          </div>
        </details>`
      : '';
    return `<div class="svc-log" data-log="${esc(l.id)}">
      <h4>${esc(kindLabel(l.kind))}: ${esc(l.title)}
        <button type="button" class="icon-btn danger" data-del-log="${esc(l.id)}" title="Удалить" style="float:right">×</button>
      </h4>
      <div class="meta">${esc(l.date)}${l.odometer!=null?' · одометр '+fmt(l.odometer):''}${prog.total?` · чек-лист ${prog.done}/${prog.total}`:''}</div>
      <div class="meta">Стоимость работ: ${fmt(l.workCost)} ₽ · Материалы: ${fmt(l.materialsCost)} ₽ · <span class="svc-sum">итого ${fmt(l.total)} ₽</span></div>
      ${mats?`<div class="meta">${esc(mats)}</div>`:''}
      ${checkHtml}
      ${l.note?`<div class="meta">${esc(l.note)}</div>`:''}
    </div>`;
  }).join('') || `<div class="hint">Записей пока нет</div>`;
  const ivOpts=['<option value="">— не привязывать —</option>']
    .concat((v.serviceIntervals||[]).map(iv=>`<option value="${esc(iv.id)}">${esc(iv.name)}</option>`)).join('');
  const coDrivers=fleetDriversForCompany(v.companyId);
  const assignedIds=new Set((v.assignedDriverIds||[]).map(String));
  const crewHtml=coDrivers.length?`<div class="vc-crew-list">${coDrivers.map(d=>{
    const did=String(d.id||'');
    return `<label class="vc-crew-item check"><input type="checkbox" data-crew-drv="${esc(did)}" ${assignedIds.has(did)?'checked':''}/> <span>${esc(d.name)}${d.phone?` · ${esc(formatPhone(d.phone))}`:''}</span></label>`;
  }).join('')}</div>`:`<div class="hint">Нет водителей в фирме — добавьте во вкладке «Водители»</div>`;
  const titleEl=$('veh-card-title');
  if(titleEl) titleEl.textContent=v.plate||'Авто';
  const box=$('vehicle-card-form');
  box.innerHTML=`
    <p class="cat-panel-hint">${esc([firm, v.makeModel, vehicleSpecText(v), vehicleCrewSummary(v)].filter(Boolean).join(' · ')||'Карточка автомобиля')}</p>
    <section class="form-section">
      <h2 class="form-section-title">Экипаж / водители</h2>
      <p class="form-section-hint">Привяжите любого своего водителя или нескольких — экипаж на это авто.</p>
      <label>Название экипажа (необязательно)<input id="vc-crew-name" value="${esc(v.crewName||'')}" placeholder="Например: смена А" /></label>
      ${crewHtml}
      <button type="button" class="primary cat-add-btn" id="vc-save-crew" style="margin-top:8px">Сохранить экипаж</button>
    </section>
    <section class="form-section">
      <h2 class="form-section-title">Документы ТС</h2>
      <div class="fin-grid">
        <label>СТС серия<input id="vc-sts-ser" inputmode="numeric" value="${esc(v.stsSeries||'')}" placeholder="77 XX" /></label>
        <label>СТС номер<input id="vc-sts-num" inputmode="numeric" value="${esc(v.stsNumber||'')}" placeholder="123456" /></label>
        <label class="svc-full">Скан СТС (PNG/JPG, до ${DOC_PHOTO_MAX_KB} КБ)
          <div class="doc-photo-row__box" style="margin-top:4px">
            ${docPhotoThumbHtml(v.stsPhoto,'СТС')}
            <input type="file" accept="image/png,image/jpeg,image/webp" id="vc-sts-photo" />
            ${v.stsPhoto?`<button type="button" class="secondary doc-photo-clear" id="vc-sts-clear" title="Удалить">×</button>`:''}
          </div>
        </label>
        <button type="button" class="primary cat-add-btn fin-full" id="vc-save-docs">Сохранить документы</button>
      </div>
    </section>
    <section class="form-section">
      <h2 class="form-section-title">Основные</h2>
      <div class="fin-grid">
        <label>Модель<input id="vc-model" value="${esc(v.makeModel||'')}" placeholder="ГАЗ Валдай" /></label>
        <label>Одометр сейчас<input id="vc-odo" inputmode="numeric" value="${v.currentOdometer??''}" placeholder="км" /></label>
        <button type="button" class="primary cat-add-btn fin-full" id="vc-save-head">Сохранить</button>
      </div>
    </section>
    ${isGaz33104Valdai(v)?`<section class="form-section">${gaz33104LubeTableHtml()}</section>`:''}
    <section class="form-section">
      <h2 class="form-section-title">Сервисные интервалы</h2>
      <div class="card" style="padding:8px 12px">${ivHtml}</div>
      <div class="fin-grid" style="margin-top:8px">
        <label class="svc-full">Название<input id="iv-name" placeholder="Замена масла ДВС" /></label>
        <label>Каждые, км<input id="iv-km" inputmode="numeric" placeholder="10000" /></label>
        <label>Каждые, мес.<input id="iv-mo" inputmode="numeric" placeholder="12" /></label>
        <button type="button" class="secondary cat-add-btn fin-full" id="iv-add">+ Интервал</button>
      </div>
    </section>
    <section class="form-section">
      <h2 class="form-section-title">Журнал · ${fmt(totalSpent)} ₽</h2>
      <div>${logHtml}</div>
    </section>
    <section class="form-section">
      <h2 class="form-section-title">Новая запись</h2>
      <div class="fin-grid">
      <label>Тип<select id="log-kind"><option value="repair">Ремонт</option><option value="service" selected>ТО</option><option value="parts">Материалы</option></select></label>
      <label>Дата<input id="log-date" type="date" value="${new Date().toISOString().slice(0,10)}" /></label>
      <label class="svc-full">Что сделали / купили<input id="log-title" placeholder="ТО-1, замена масла…" /></label>
      <label>Одометр<input id="log-odo" inputmode="numeric" value="${v.currentOdometer??''}" /></label>
      <label>Стоимость работ, ₽<input id="log-work" inputmode="decimal" placeholder="0" /></label>
      <label class="svc-full">Материалы (строки: название; кол-во; цена)<textarea id="log-mats" rows="3" placeholder="Масло 5W40; 1; 4500&#10;Фильтр масляный; 1; 800"></textarea></label>
      <label class="svc-full">К интервалу<select id="log-iv">${ivOpts}</select></label>
      <div class="svc-full" id="log-check-preview" style="display:none"></div>
      <label class="svc-full">Заметка<input id="log-note" placeholder="необязательно" /></label>
        <button type="button" class="primary cat-add-btn fin-full" id="log-add">Добавить запись</button>
      </div>
      <p class="cat-panel-hint" style="margin-top:8px">Выберите интервал ТО — появится чек-лист. Интервал обновится, когда отметите все пункты. Фото чеков — следующим этапом.</p>
    </section>
  `;
  show('admin-vehicle-card');
  state._vehicleCardId=v.id;
  const refreshLogCheckPreview=()=>{
    const boxPrev=$('log-check-preview'); if(!boxPrev) return;
    const intervalId=(($('log-iv')||{}).value||'')||null;
    const iv=intervalId?(v.serviceIntervals||[]).find(x=>x.id===intervalId):null;
    const works=(iv&&iv.works)||[];
    if(!works.length){ boxPrev.style.display='none'; boxPrev.innerHTML=''; return; }
    boxPrev.style.display='block';
    boxPrev.innerHTML=`
      <div class="hint" style="margin:0 0 4px">Чек-лист при сохранении — под каждым пунктом как делать</div>
      <div class="svc-check" id="log-check-new">
        ${works.map((w,i)=>checklistItemHtml(w,{newIndex:i})).join('')}
      </div>
      <div class="svc-check-actions">
        <button type="button" class="secondary" id="log-check-new-all" style="width:auto;padding:6px 10px;font-size:.72rem">Отметить все</button>
        <button type="button" class="secondary" id="log-check-new-none" style="width:auto;padding:6px 10px;font-size:.72rem">Снять все</button>
      </div>`;
    $('log-check-new-all')&&($('log-check-new-all').onclick=()=>{
      boxPrev.querySelectorAll('input[type=checkbox]').forEach(c=>c.checked=true);
    });
    $('log-check-new-none')&&($('log-check-new-none').onclick=()=>{
      boxPrev.querySelectorAll('input[type=checkbox]').forEach(c=>c.checked=false);
    });
    const titleEl=$('log-title');
    if(titleEl && !(titleEl.value||'').trim() && iv) titleEl.value=iv.name;
    const kindEl=$('log-kind');
    if(kindEl) kindEl.value='service';
  };
  $('log-iv')&&($('log-iv').onchange=refreshLogCheckPreview);
  $('veh-card-back').onclick=()=>{ catalogTab='vehicles'; openCatalogs(); };
  $('vc-save-crew')&&($('vc-save-crew').onclick=()=>{
    const ids=[...document.querySelectorAll('[data-crew-drv]')].filter(x=>x.checked).map(x=>x.dataset.crewDrv).filter(Boolean);
    if(typeof setVehicleCrew==='function') setVehicleCrew(v, ids, ($('vc-crew-name')||{}).value||'');
    bumpDataEpoch('veh-crew');
    persist();
    flashCatOk('Экипаж сохранён');
    openVehicleCard(v.id);
  });
  $('vc-save-head').onclick=()=>{
    v.makeModel=(($('vc-model')||{}).value||'').trim();
    v.currentOdometer=numOrNull(($('vc-odo')||{}).value);
    bumpDataEpoch('veh-card-head');
    persist();
    openVehicleCard(v.id);
  };
  $('vc-save-docs')&&($('vc-save-docs').onclick=()=>{
    v.stsSeries=String((($('vc-sts-ser')||{}).value||'').trim());
    v.stsNumber=String((($('vc-sts-num')||{}).value||'').trim());
    bumpDataEpoch('veh-card-docs');
    persist();
    flashCatOk('Документы сохранены');
  });
  $('vc-sts-photo')&&bindDocPhotoInput($('vc-sts-photo'), data=>{
    v.stsPhoto=data;
    bumpDataEpoch('veh-sts-photo');
    persist();
    openVehicleCard(v.id);
  });
  $('vc-sts-clear')&&($('vc-sts-clear').onclick=()=>{
    v.stsPhoto=null;
    bumpDataEpoch('veh-sts-clear');
    persist();
    openVehicleCard(v.id);
  });
  $('iv-add').onclick=()=>{
    const name=(($('iv-name')||{}).value||'').trim();
    if(!name){ alert('Укажите название интервала'); return; }
    const iv=normalizeServiceInterval({
      name,
      everyKm:numOrNull(($('iv-km')||{}).value),
      everyMonths:numOrNull(($('iv-mo')||{}).value)
    });
    if(!iv.everyKm && !iv.everyMonths){ alert('Укажите км и/или месяцы'); return; }
    v.serviceIntervals=v.serviceIntervals||[];
    v.serviceIntervals.push(iv);
    bumpDataEpoch('veh-iv-add');
    persist();
    openVehicleCard(v.id);
  };
  document.querySelectorAll('[data-del-iv]').forEach(b=>b.onclick=()=>{
    if(!confirm('Удалить интервал?')) return;
    v.serviceIntervals=(v.serviceIntervals||[]).filter(x=>x.id!==b.dataset.delIv);
    bumpDataEpoch('veh-iv-del');
    persist();
    openVehicleCard(v.id);
  });
  document.querySelectorAll('[data-del-log]').forEach(b=>b.onclick=()=>{
    if(!confirm('Удалить запись?')) return;
    v.maintenanceLogs=(v.maintenanceLogs||[]).filter(x=>x.id!==b.dataset.delLog);
    bumpDataEpoch('veh-log-del');
    persist();
    openVehicleCard(v.id);
  });
  const saveChecklistState=()=>{
    bumpDataEpoch('veh-check');
    persist();
  };
  document.querySelectorAll('[data-check-item]').forEach(inp=>{
    inp.onchange=()=>{
      const wrap=inp.closest('[data-check-log]');
      const logId=wrap&&wrap.dataset.checkLog;
      const log=(v.maintenanceLogs||[]).find(x=>x.id===logId);
      if(!log) return;
      const item=(log.checklist||[]).find(x=>x.id===inp.dataset.checkItem);
      if(!item) return;
      item.done=!!inp.checked;
      log.checklistDone=checklistProgress(log.checklist).all;
      applyIntervalProgressFromLog(v, log);
      saveChecklistState();
      openVehicleCard(v.id);
    };
  });
  document.querySelectorAll('[data-check-all]').forEach(b=>b.onclick=()=>{
    const log=(v.maintenanceLogs||[]).find(x=>x.id===b.dataset.checkAll);
    if(!log||!log.checklist) return;
    log.checklist.forEach(it=>it.done=true);
    log.checklistDone=true;
    applyIntervalProgressFromLog(v, log);
    saveChecklistState();
    openVehicleCard(v.id);
  });
  document.querySelectorAll('[data-check-none]').forEach(b=>b.onclick=()=>{
    const log=(v.maintenanceLogs||[]).find(x=>x.id===b.dataset.checkNone);
    if(!log||!log.checklist) return;
    log.checklist.forEach(it=>it.done=false);
    log.checklistDone=false;
    saveChecklistState();
    openVehicleCard(v.id);
  });
  $('log-add').onclick=()=>{
    const title=(($('log-title')||{}).value||'').trim();
    if(!title){ alert('Укажите, что сделали'); return; }
    const matsRaw=(($('log-mats')||{}).value||'').split(/\n/).map(s=>s.trim()).filter(Boolean);
    const materials=matsRaw.map(line=>{
      const parts=line.split(';').map(x=>x.trim());
      const name=parts[0]||'';
      const qty=+String(parts[1]||'1').replace(',','.')||1;
      const unitCost=+String(parts[2]||'0').replace(',','.')||0;
      return normalizeMaterialLine({name, qty, unitCost});
    }).filter(Boolean);
    const workCost=+String(($('log-work')||{}).value||'0').replace(',','.')||0;
    const odometer=numOrNull(($('log-odo')||{}).value);
    const intervalId=(($('log-iv')||{}).value||'')||null;
    const iv=intervalId?(v.serviceIntervals||[]).find(x=>x.id===intervalId):null;
    const checked=new Set();
    document.querySelectorAll('#log-check-new input[type=checkbox]').forEach(c=>{
      if(c.checked) checked.add(+c.dataset.newCheck);
    });
    const checklist=iv&&iv.works&&iv.works.length
      ? checklistFromWorks(iv.works, checked)
      : [];
    const log=normalizeMaintenanceLog({
      date:(($('log-date')||{}).value||'').trim()||new Date().toISOString().slice(0,10),
      odometer, kind:(($('log-kind')||{}).value||'repair'),
      title, materials, workCost, intervalId,
      note:(($('log-note')||{}).value||'').trim(),
      checklist
    });
    v.maintenanceLogs=v.maintenanceLogs||[];
    v.maintenanceLogs.unshift(log);
    if(odometer!=null) v.currentOdometer=odometer;
    applyIntervalProgressFromLog(v, log);
    bumpDataEpoch('veh-log-add');
    persist();
    openVehicleCard(v.id);
  };
}
function flashDriverCardOk(msg){
  const el=$('drv-card-ok');
  if(!el) return;
  el.textContent=msg||'Сохранено';
  el.style.display='block';
  clearTimeout(flashDriverCardOk._t);
  flashDriverCardOk._t=setTimeout(()=>{ if(el) el.style.display='none'; }, 3200);
}
function updateDriverCardWarn(d){
  const box=$('driver-card-form');
  if(!box||!d) return;
  const miss=typeof driverDocsMissingItems==='function'?driverDocsMissingItems(d):[];
  let warn=box.querySelector('.drv-card-warn');
  if(!miss.length){
    if(warn) warn.remove();
    return;
  }
  const html=`<strong>Заполните для заявок:</strong><ul>${miss.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
  if(warn) warn.innerHTML=html;
  else{
    warn=document.createElement('div');
    warn.className='drv-card-warn';
    warn.innerHTML=html;
    const hint=box.querySelector('.cat-panel-hint');
    if(hint&&hint.nextSibling) box.insertBefore(warn, hint.nextSibling);
    else box.insertBefore(warn, box.firstChild);
  }
}
function readDriverCardFieldsInto(d){
  if(!d) return false;
  d.phone=formatPhone((($('dc-phone')||{}).value||'').trim());
  const pin=(($('dc-pin')||{}).value||'').trim();
  if(pin && pin.length<4){ alert('PIN — от 4 цифр'); return false; }
  if(pin) d.pin=pin;
  else if(!d.pin) d.pin=resolveDriverPin(d);
  const pct=+(($('dc-pct')||{}).value||'').replace(',','.');
  if(!Number.isNaN(pct) && pct>=0){
    d.salaryPercent=pct;
    (state.orders||[]).filter(o=>samePersonName(o.driverName, d.name)).forEach(o=>{ o.driverPercent=pct; });
  }
  d.exchangeEnabled=!!(($('dc-ex')||{}).checked);
  d.licenseNo=String((($('dc-lic-num')||{}).value||'').trim());
  d.licenseIssuedAt=String((($('dc-lic-at')||{}).value||'').trim());
  d.passportSeries=String((($('dc-pass-ser')||{}).value||'').trim());
  d.passportNumber=String((($('dc-pass-num')||{}).value||'').trim());
  d.passportIssuedBy=String((($('dc-pass-by')||{}).value||'').trim());
  d.passportIssuedAt=String((($('dc-pass-at')||{}).value||'').trim());
  if(!d.companyId){
    const co=typeof catalogDriverCompany==='function'?catalogDriverCompany():currentOwnCompany();
    if(co){ d.companyId=co.id; d.companyName=co.name; d.spaceId=currentSpaceId(); }
  }
  return true;
}
function resolveDriverCardIndex(key){
  const drivers=state.drivers||[];
  if(key==null||key==='') return -1;
  if(typeof key==='number' && drivers[key]) return key;
  const s=String(key);
  let i=drivers.findIndex(d=>d.id&&String(d.id)===s);
  if(i>=0) return i;
  const n=parseInt(s,10);
  return Number.isFinite(n)&&drivers[n]?n:-1;
}
function driverCardPhotoField(label, existing, inputId, clearId){
  return `<label class="svc-full">${esc(label)}
    <div class="doc-photo-row__box drv-card-photo-box">
      ${docPhotoThumbHtml(existing, label)}
      <input type="file" accept="image/png,image/jpeg,image/webp" id="${inputId}" />
      ${docPhotoOrNull(existing)?`<button type="button" class="secondary doc-photo-clear" id="${clearId}" title="Удалить">×</button>`:''}
    </div>
  </label>`;
}
function openDriverCard(driverKey){
  if(!currentAdmin){ fillAdminLoginSelect(); show('admin-pin'); return; }
  const i=resolveDriverCardIndex(driverKey);
  if(i<0){ alert('Водитель не найден'); catalogTab='drivers'; openCatalogs(); return; }
  const d=state.drivers[i];
  if(!d){ alert('Водитель не найден'); catalogTab='drivers'; openCatalogs(); return; }
  if(typeof canEditDriverRecord==='function'&&!canEditDriverRecord(d)){ alert('Нет доступа к этому водителю'); return; }
  if(!d.id) d.id=uuid();
  state._driverCardIndex=i;
  state._driverCardId=d.id;
  const firm=typeof driverCompanyLabel==='function'?driverCompanyLabel(d):(d.companyName||(findCompanyById(d.companyId)||{}).name||'');
  const veh=typeof vehicleForDriver==='function'?vehicleForDriver(d):null;
  const miss=typeof driverDocsMissingItems==='function'?driverDocsMissingItems(d):[];
  const titleEl=$('drv-card-title');
  if(titleEl) titleEl.textContent=d.name||'Водитель';
  const box=$('driver-card-form');
  if(!box) return;
  box.innerHTML=`
    <p class="cat-panel-hint">${esc([firm, veh?`🚛 ${veh.plate}`:null, formatPhone(d.phone||'')||null].filter(Boolean).join(' · ')||'Карточка водителя')}</p>
    ${miss.length?`<div class="drv-card-warn"><strong>Заполните для заявок:</strong><ul>${miss.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
    <section class="form-section">
      <h2 class="form-section-title">Основное</h2>
      <div class="fin-grid">
        <label>Телефон<input id="dc-phone" type="tel" inputmode="tel" value="${esc(formatPhone(d.phone||''))}" placeholder="+79650730002" /></label>
        <label>PIN<input id="dc-pin" inputmode="numeric" maxlength="8" value="${esc(d.pin||resolveDriverPin(d)||'')}" placeholder="PIN входа" /></label>
        <label>ЗП, %<input id="dc-pct" inputmode="decimal" value="${esc(d.salaryPercent??30)}" /></label>
        <label class="check svc-full" style="align-self:end;padding:8px 0"><input type="checkbox" id="dc-ex" ${d.exchangeEnabled?'checked':''}/> Биржа</label>
      </div>
    </section>
    <section class="form-section">
      <h2 class="form-section-title">Водительское удостоверение</h2>
      <p class="form-section-hint">Номер, дата выдачи и обе стороны документа — в одном блоке.</p>
      <div class="fin-grid">
        <label class="svc-full">Номер ВУ<input id="dc-lic-num" inputmode="numeric" value="${esc(d.licenseNo||'')}" placeholder="Серия и номер" /></label>
        <label>Дата выдачи<input id="dc-lic-at" placeholder="ДД.ММ.ГГГГ" value="${esc(d.licenseIssuedAt||'')}" /></label>
        ${driverCardPhotoField('Скан · лицевая сторона', d.licensePhotoFront, 'dc-lic-front', 'dc-lic-front-clear')}
        ${driverCardPhotoField('Скан · оборотная сторона', d.licensePhotoBack, 'dc-lic-back', 'dc-lic-back-clear')}
      </div>
    </section>
    <section class="form-section">
      <h2 class="form-section-title">Паспорт</h2>
      <p class="form-section-hint">Реквизиты и снимки разворота с фото и страницы с пропиской.</p>
      <div class="fin-grid">
        <label>Серия<input id="dc-pass-ser" inputmode="numeric" maxlength="4" value="${esc(d.passportSeries||'')}" placeholder="1234" /></label>
        <label>Номер<input id="dc-pass-num" inputmode="numeric" maxlength="6" value="${esc(d.passportNumber||'')}" placeholder="567890" /></label>
        <label class="svc-full">Кем выдан<input id="dc-pass-by" value="${esc(d.passportIssuedBy||'')}" placeholder="УФМС / МВД…" /></label>
        <label>Дата выдачи<input id="dc-pass-at" value="${esc(d.passportIssuedAt||'')}" placeholder="ДД.ММ.ГГГГ" /></label>
        ${driverCardPhotoField('Скан · разворот с фото', d.passportPhoto, 'dc-pass-photo', 'dc-pass-photo-clear')}
        ${driverCardPhotoField('Скан · страница с пропиской', d.passportRegPhoto, 'dc-pass-reg', 'dc-pass-reg-clear')}
      </div>
    </section>
    <p class="hint">Снимки с телефона сжимаются до ${DOC_PHOTO_MAX_KB} КБ. Поля — кнопкой «Сохранить» внизу экрана.</p>
  `;
  show('admin-driver-card');
  const okEl=$('drv-card-ok');
  if(okEl) okEl.style.display='none';
  const refresh=()=>openDriverCard(i);
  const bindPhoto=(inputId, clearId, key)=>{
    const inp=$(inputId);
    if(inp) bindDocPhotoInput(inp, data=>{
      d[key]=data;
      bumpDataEpoch('drv-card-photo');
      persist();
      refresh();
    });
    const clr=$(clearId);
    if(clr) clr.onclick=()=>{
      d[key]=null;
      bumpDataEpoch('drv-card-photo-clear');
      persist();
      refresh();
    };
  };
  bindPhoto('dc-lic-front','dc-lic-front-clear','licensePhotoFront');
  bindPhoto('dc-lic-back','dc-lic-back-clear','licensePhotoBack');
  bindPhoto('dc-pass-photo','dc-pass-photo-clear','passportPhoto');
  bindPhoto('dc-pass-reg','dc-pass-reg-clear','passportRegPhoto');
  $('drv-card-back').onclick=()=>{ catalogTab='drivers'; openCatalogs(); };
  const saveBtn=$('dc-save');
  if(saveBtn){
    saveBtn.disabled=false;
    saveBtn.textContent='Сохранить';
    saveBtn.onclick=()=>{
      if(!readDriverCardFieldsInto(d)) return;
      saveBtn.disabled=true;
      saveBtn.textContent='Сохранение…';
      bumpDataEpoch('drv-card-save');
      persist();
      updateDriverCardWarn(d);
      flashDriverCardOk('Водитель сохранён');
      saveBtn.disabled=false;
      saveBtn.textContent='Сохранено ✓';
      setTimeout(()=>{ if(saveBtn) saveBtn.textContent='Сохранить'; }, 2000);
    };
  }
  const inviteBtn=$('dc-invite');
  if(inviteBtn) inviteBtn.onclick=async ()=>{
    if(!readDriverCardFieldsInto(d)) return;
    persist();
    const res=await createDriverInvite(i);
    if(!res.ok){ alert(res.message||'Не удалось создать ссылку'); return; }
    const exp=res.invite&&res.invite.expiresAt?new Date(res.invite.expiresAt).toLocaleDateString('ru-RU'):'7 дней';
    const co=findCompanyById(d.companyId)||currentOwnCompany();
    openShareSheet({
      kind:'driverInvite',
      url:res.url,
      title:'Приглашение водителя',
      carrier:(co&&co.name)||'АРМАДА',
      phone:d.phone,
      expires:exp
    });
  };
  const deleteBtn=$('dc-delete');
  if(deleteBtn) deleteBtn.onclick=()=>{
    if(!isSuperAdmin() && (!currentAdmin || (d.ownerAdminId!==currentAdmin.id && d.companyId!==(currentOwnCompany()||{}).id))){ alert('Нет доступа'); return; }
    const name=d.name||'';
    const firmName=d.companyName||(findCompanyById(d.companyId)||{}).name||'фирмы';
    const adm=d.ownerAdminId?(state.admins||[]).find(a=>a.id===d.ownerAdminId):null;
    const isAdminMirror=adm&&samePersonName(adm.name, name);
    const warn=isAdminMirror
      ? `\n\nЭто зеркало администратора «${adm.name}» — после удаления не будет входа в «Водитель» под этим ФИО.`
      : '';
    if(!confirm(`Удалить водителя ${name} из «${firmName}»?${warn}`)) return;
    if(typeof markDriverDeleted==='function') markDriverDeleted(d);
    if(isAdminMirror) adm.skipDriverMirror=true;
    state.drivers.splice(i,1);
    bumpDataEpoch('del-driver');
    persist();
    catalogTab='drivers';
    openCatalogs();
  };
}
function dayKeyFromIso(iso){
  if(!iso) return '';
  const d=new Date(iso);
  if(Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function canAdminSeeShift(s){
  if(!s) return false;
  if(isSuperAdmin()) return true;
  const my=currentOwnCompany();
  if(my && s.ownCompanyId && s.ownCompanyId===my.id) return true;
  if(currentAdmin && s.ownerAdminId && s.ownerAdminId===currentAdmin.id) return true;
  // смена водителя своей фирмы
  if(my && (state.drivers||[]).some(d=>samePersonName(d.name, s.driverName||'') && d.companyId===my.id)) return true;
  return false;
}
/** Суммы по списку заказов: выручка, расходы, прибыль. */
function sumOrderMoney(list){
  const z={
    count:0, emptyKmBefore:0, loadedKm:0, emptyKmAfter:0, km:0,
    rateWithVat:0, rateWithoutVat:0, rateCash:0, bonus:0,
    fuelLiters:0, fuelCost:0, rent:0, cushion:0, profit:0, pay:0,
    ratePerKmCash:0, costPerKmNoVat:0, fuelPrice:0, fuelPriceN:0, perKmN:0, costPerKmN:0
  };
  (list||[]).forEach(o=>{
    z.count++;
    const m=metrics(o);
    z.emptyKmBefore+=(o.emptyKmBefore||0);
    z.loadedKm+=(o.loadedKm||0);
    z.emptyKmAfter+=(o.emptyKmAfter||0);
    const t=dayTotal(o); if(t!=null) z.km+=t;
    z.rateWithVat+=(o.rateWithVat||0);
    z.rateWithoutVat+=(o.rateWithoutVat||0);
    z.rateCash+=(o.rateCash!=null?o.rateCash:(m.rate||0));
    z.bonus+=(o.salaryBonus||0);
    z.fuelLiters+=(m.fuelLitersCalc||0);
    z.fuelCost+=(m.fuelCostCalc||0);
    z.rent+=(o.vehicleRent||0);
    z.cushion+=(m.cushion||0);
    z.profit+=(m.netProfit||0);
    z.pay+=(m.driverPay||0);
    if(o.fuelPricePerLiter!=null){ z.fuelPrice+=+o.fuelPricePerLiter; z.fuelPriceN++; }
    if(o.ratePerKmCash!=null){ z.ratePerKmCash+=+o.ratePerKmCash; z.perKmN++; }
    if(m.costPerKmNoVat!=null){ z.costPerKmNoVat+=+m.costPerKmNoVat; z.costPerKmN++; }
  });
  const avg=(sum,n)=>n>0?round2(sum/n):null;
  return {
    count:z.count,
    emptyKmBefore:round2(z.emptyKmBefore),
    loadedKm:round2(z.loadedKm),
    emptyKmAfter:round2(z.emptyKmAfter),
    km:round2(z.km),
    fuelPriceAvg:avg(z.fuelPrice, z.fuelPriceN),
    ratePerKmCashAvg:avg(z.ratePerKmCash, z.perKmN),
    rateWithVat:round2(z.rateWithVat),
    rateWithoutVat:round2(z.rateWithoutVat),
    revenue:round2(z.rateCash),
    bonus:round2(z.bonus),
    fuelLiters:round2(z.fuelLiters),
    costPerKmNoVatAvg:avg(z.costPerKmNoVat, z.costPerKmN),
    fuel:round2(z.fuelCost),
    rent:round2(z.rent),
    cushion:round2(z.cushion),
    profit:round2(z.profit),
    pay:round2(z.pay),
    expenses:round2(z.pay+z.fuelCost+z.rent+z.cushion)
  };
}
/**
 * Группы «итог за день»: закрытые и открытые смены + оставшиеся заказы по дню/водителю.
 * Карточки над таблицей и строки таблицы используют одни и те же группы.
 */
function buildAdminShiftDayGroups(orders){
  const byId=new Map((orders||[]).map(o=>[o.id,o]));
  const used=new Set();
  const groups=[];
  const shifts=(state.shifts||[])
    .filter(s=>s && canAdminSeeShift(s))
    .sort((a,b)=>{
      const ta=new Date(a.endedAt||a.startedAt||0).getTime();
      const tb=new Date(b.endedAt||b.startedAt||0).getTime();
      return tb-ta;
    });
  shifts.forEach(s=>{
    // День смены = день старта. Закрытие утром следующего дня не переносит смену на новую дату.
    const dayKey=dayKeyFromIso(s.startedAt)||dayKeyFromIso(s.endedAt);
    if(!dayKey) return;
    const fromShift=(s.orders||[]).map(o=>byId.get(o.id)||o).filter(o=>o && byId.has(o.id));
    let list=fromShift;
    if(!list.length){
      list=(orders||[]).filter(o=>{
        if(used.has(o.id)) return false;
        if(!samePersonName(o.driverName||'', s.driverName||'')) return false;
        const od=dayKeyFromIso(o.closedAt||o.createdAt);
        return od===dayKey;
      });
    }
    list=list.filter(o=>!used.has(o.id));
    if(!list.length) return;
    list.forEach(o=>used.add(o.id));
    list.sort((a,b)=>(a.sequentialNumber||0)-(b.sequentialNumber||0));
    const openShift=!s.endedAt;
    const id=`${s.id||(dayKey+'|'+(s.driverName||'')+(openShift?'|open':''))}`;
    groups.push({
      id, shift:s, dayKey, dayLabel:dayOnly(s.startedAt)||dayOnly(s.endedAt),
      driverName:s.driverName||list[0].driverName||'—',
      vehiclePlate:s.vehiclePlate||list[0].vehiclePlate||'—',
      openShift,
      orders:list, totals:sumOrderMoney(list)
    });
  });
  // Оставшиеся заказы без смены — всё равно свернуть по дню + водителю
  const leftover=new Map();
  (orders||[]).forEach(o=>{
    if(used.has(o.id)) return;
    const dayKey=dayKeyFromIso(o.closedAt||o.createdAt)||'без-даты';
    const driver=o.driverName||'—';
    const key=dayKey+'|'+String(driver).toLowerCase();
    if(!leftover.has(key)) leftover.set(key, {dayKey, driverName:driver, orders:[]});
    leftover.get(key).orders.push(o);
  });
  [...leftover.values()].forEach(bundle=>{
    const list=bundle.orders.slice().sort((a,b)=>(a.sequentialNumber||0)-(b.sequentialNumber||0));
    list.forEach(o=>used.add(o.id));
    const id=`day|${bundle.dayKey}|${bundle.driverName}`;
    groups.push({
      id, shift:null, dayKey:bundle.dayKey,
      dayLabel:dayOnly(list[0].closedAt||list[0].createdAt)||bundle.dayKey,
      driverName:bundle.driverName,
      vehiclePlate:list[0].vehiclePlate||'—',
      openShift:list.some(o=>!looksClosedOrder(o)),
      orders:list, totals:sumOrderMoney(list)
    });
  });
  groups.sort((a,b)=>{
    if(a.dayKey!==b.dayKey) return String(b.dayKey).localeCompare(String(a.dayKey));
    return String(a.driverName).localeCompare(String(b.driverName),'ru');
  });
  return {groups, ungrouped:[]};
}
function ensureAdminOrderSelection(){
  if(!state.adminSelectedOrderIds || typeof state.adminSelectedOrderIds!=='object'){
    state.adminSelectedOrderIds={};
  }
  return state.adminSelectedOrderIds;
}
function currentFilteredOrderIds(){
  return filteredOrders().map(o=>o.id).filter(Boolean);
}
function pruneAdminOrderSelection(visibleIds){
  const sel=ensureAdminOrderSelection();
  const vis=new Set(visibleIds||[]);
  Object.keys(sel).forEach(id=>{
    if(!vis.has(id)) delete sel[id];
  });
}
function adminOrderPickCount(){
  const sel=ensureAdminOrderSelection();
  const visible=new Set(currentFilteredOrderIds());
  return Object.keys(sel).filter(id=>sel[id] && visible.has(id)).length;
}
function adminOrderPickHtml(o){
  const sel=ensureAdminOrderSelection();
  const on=!!sel[o.id];
  return `<label class="order-pick" title="Выбрать для массовых операций" onclick="event.stopPropagation()">
    <input type="checkbox" class="admin-order-pick" data-id="${esc(o.id)}"${on?' checked':''} />
  </label>`;
}
function adminOrdersBulkBarHtml(){
  const n=adminOrderPickCount();
  const myCo=currentOwnCompany();
  const firmId=myCo?myCo.id:'';
  const drvList=firmId?fleetDriversForCompany(firmId):[];
  const vehList=firmId?fleetVehiclesForCompany(firmId):[];
  const showAssign=!!firmId && drvList.length && vehList.length;
  const drvOpts=drvList.map(d=>`<option value="${esc(d.name)}">${esc(d.name)}</option>`).join('');
  const plateOpts=vehList.map(v=>`<option value="${esc(v.plate)}">${esc(v.plate)}</option>`).join('');
  return `<div class="admin-bulk-bar" id="admin-orders-bulk">
    <label class="bulk-pick-all"><input type="checkbox" id="admin-orders-select-page" /> На экране</label>
    ${showAssign?`<div class="bulk-assign-group">
      <select id="admin-bulk-driver" title="Водитель">${drvOpts||'<option value="">— водитель —</option>'}</select>
      <select id="admin-bulk-plate" title="ТС">${plateOpts||'<option value="">— авто —</option>'}</select>
      <button type="button" class="primary" id="admin-orders-assign-selected"${n?'':' disabled'}>Назначить (${n})</button>
    </div>`:''}
    <button type="button" class="secondary" id="admin-orders-delete-selected"${n?'':' disabled'}>Удалить (${n})</button>
    <span class="hint">${showAssign?'Массовое назначение — только свои заказы до выезда. ':''}Удаление — заказ, смена, биржа, документы</span>
  </div>`;
}
function updateAdminOrderPickUi(){
  const n=adminOrderPickCount();
  const delBtn=$('admin-orders-delete-selected');
  if(delBtn){
    delBtn.disabled=!n;
    delBtn.textContent=`Удалить (${n})`;
  }
  const assignBtn=$('admin-orders-assign-selected');
  if(assignBtn){
    assignBtn.disabled=!n;
    assignBtn.textContent=`Назначить (${n})`;
  }
}
function orderCanBulkAssign(o){
  if(!o||looksClosedOrder(o)||o.cancelledAt||o.startOdometer!=null) return false;
  if(o.executorType==='partner') return false;
  if(!isMyFirmOrder(o)&&!isSuperAdmin()) return false;
  return true;
}
function applyOwnFleetAssignment(o, driver, plate, firmId, opts){
  const skipDocsConfirm=opts&&opts.skipDocsConfirm;
  if(!o||!driver||!plate) return {ok:false, message:'Нет водителя или авто'};
  if(!fleetDriversForCompany(firmId).some(d=>samePersonName(d.name,driver))){
    return {ok:false, message:`Водитель ${driver} не из парка фирмы`};
  }
  const veh=fleetVehiclesForCompany(firmId).find(v=>v.plate===plate);
  if(!veh) return {ok:false, message:`Авто ${plate} не из парка фирмы`};
  if(!vehicleFitsOrder(veh, o)) return {ok:false, message:`${plate} не подходит по т/габаритам для №${o.sequentialNumber}`};
  if(!skipDocsConfirm){
    const drvRec=findDriverRecord(driver, firmId);
    if(typeof confirmIfDriverDocsIncomplete==='function'&&!confirmIfDriverDocsIncomplete(drvRec, driver)){
      return {ok:false, message:'Назначение отменено'};
    }
  }
  o.onExchange=false;
  o.executorType='own';
  o.driverName=driver;
  o.vehiclePlate=plate;
  o.driverPercent=driverPercent(driver, firmId);
  o.driverPhone=driverPhone(driver, firmId);
  o.carrierCompanyId=null;
  o.carrierDriverId=null;
  o.carrierVehicleId=null;
  o.carrierCompanyName='';
  o.partnerSpaceId=null;
  o.executorAdminId=currentAdmin?currentAdmin.id:null;
  if(typeof clearOrderBooking==='function') clearOrderBooking(o);
  if(typeof stampConfirmedBooking==='function') stampConfirmedBooking(o, plate);
  stampOrderDriverPhone(o);
  if(typeof syncOrderDocsOnAssign==='function') syncOrderDocsOnAssign(o);
  return {ok:true};
}
function adminBulkAssignSelectedOrders(){
  const sel=ensureAdminOrderSelection();
  const visible=new Set(currentFilteredOrderIds());
  const ids=Object.keys(sel).filter(id=>sel[id] && visible.has(id));
  if(!ids.length){ alert('Отметьте заказы галочкой'); return; }
  const driver=(($('admin-bulk-driver')||{}).value||'').trim();
  const plate=(($('admin-bulk-plate')||{}).value||'').trim();
  if(!driver){ alert('Выберите водителя'); return; }
  if(!plate){ alert('Выберите авто'); return; }
  const orders=ids.map(id=>(state.orders||[]).find(o=>o.id===id)).filter(Boolean);
  const blocked=orders.filter(o=>!orderCanBulkAssign(o));
  const okOrders=orders.filter(o=>orderCanBulkAssign(o));
  if(!okOrders.length){
    alert(blocked.length
      ? 'Ни один выбранный заказ нельзя назначить (закрыт, в работе, чужой или уже у партнёра)'
      : 'Нет заказов для назначения');
    return;
  }
  const myCo=currentOwnCompany();
  const firmId=myCo?myCo.id:(okOrders[0]&&okOrders[0].ownCompanyId);
  if(firmId){
    const drvRec=findDriverRecord(driver, firmId);
    if(typeof confirmIfDriverDocsIncomplete==='function'&&!confirmIfDriverDocsIncomplete(drvRec, driver)) return;
  }
  const nums=okOrders.map(o=>o.sequentialNumber).sort((a,b)=>a-b);
  if(!confirm(`Назначить ${driver} · ${plate} на ${okOrders.length} заказ(ов)? № ${nums.join(', ')}`)) return;
  let assigned=0;
  const skipped=[];
  okOrders.forEach(o=>{
    const orderFirmId=o.ownCompanyId||(myCo&&myCo.id);
    if(!orderFirmId){ skipped.push(o.sequentialNumber); return; }
    if(!isSuperAdmin() && myCo && orderFirmId!==myCo.id){ skipped.push(o.sequentialNumber); return; }
    const res=applyOwnFleetAssignment(o, driver, plate, orderFirmId, {skipDocsConfirm:true});
    if(res.ok){
      upsertOrder(o);
      assigned++;
    } else skipped.push(o.sequentialNumber);
  });
  if(assigned){
    bumpDataEpoch('bulk-assign');
    if(typeof persist==='function') persist();
  }
  let msg=`Назначено: ${assigned} из ${orders.length}`;
  if(blocked.length) msg+=`\nПропущено (статус): ${blocked.map(o=>o.sequentialNumber).join(', ')}`;
  if(skipped.length) msg+=`\nНе назначено: ${skipped.join(', ')}`;
  alert(msg);
  Object.keys(sel).forEach(id=>delete sel[id]);
  renderAdmin();
}
function wireAdminOrderDeleteUi(visibleOrders){
  const sel=ensureAdminOrderSelection();
  const ids=(visibleOrders||[]).map(o=>o.id).filter(Boolean);
  document.querySelectorAll('#admin-list .admin-order-pick').forEach(inp=>{
    inp.onchange=()=>{
      if(inp.checked) sel[inp.dataset.id]=true;
      else delete sel[inp.dataset.id];
      updateAdminOrderPickUi();
      const allPage=$('admin-orders-select-page');
      if(allPage) allPage.checked=ids.length>0 && ids.every(id=>sel[id]);
    };
  });
  const allPage=$('admin-orders-select-page');
  if(allPage){
    allPage.checked=ids.length>0 && ids.every(id=>sel[id]);
    allPage.onchange=()=>{
      ids.forEach(id=>{
        if(allPage.checked) sel[id]=true;
        else delete sel[id];
      });
      document.querySelectorAll('#admin-list .admin-order-pick').forEach(inp=>{
        inp.checked=!!sel[inp.dataset.id];
      });
      updateAdminOrderPickUi();
    };
  }
  const delBtn=$('admin-orders-delete-selected');
  if(delBtn) delBtn.onclick=()=>adminDeleteSelectedOrders();
  const assignBtn=$('admin-orders-assign-selected');
  if(assignBtn) assignBtn.onclick=()=>adminBulkAssignSelectedOrders();
}
function adminDeleteSelectedOrders(){
  const sel=ensureAdminOrderSelection();
  const visible=new Set(currentFilteredOrderIds());
  const ids=Object.keys(sel).filter(id=>sel[id] && visible.has(id));
  if(!ids.length){ alert('Отметьте заказы галочкой'); return; }
  const orders=ids.map(id=>(state.orders||[]).find(o=>o.id===id)).filter(Boolean);
  const nums=orders.map(o=>o.sequentialNumber).sort((a,b)=>a-b);
  const inProg=orders.filter(o=>o.startOdometer!=null && !looksClosedOrder(o) && !o.cancelledAt);
  let msg=`Удалить ${orders.length} заказ(ов)? № ${nums.join(', ')}`;
  if(inProg.length) msg+=`\n\n${inProg.length} в работе — у водителя может сбиться шаг в чате.`;
  msg+='\n\nУдалятся все связи (смена, биржа, документы, комиссия). Номера снова доступны для новых заказов.';
  if(!confirm(msg)) return;
  if(inProg.length && !confirm('Заказы в работе — точно удалить?')) return;
  const res=deleteOrders(ids);
  if(!res.ok){ alert(res.message||'Не удалось удалить'); return; }
  Object.keys(sel).forEach(id=>delete sel[id]);
  alert(`Удалено: ${res.deleted}. Следующий новый заказ — № ${res.nextNumber}.`);
  renderAdmin();
}
function orderStatusClass(o){
  if(looksClosedOrder(o)) return 'closed';
  if(typeof isLogistInboxOrder==='function' && isLogistInboxOrder(o)) return 'inbox';
  if(o.onExchange && o.startOdometer==null) return 'exchange';
  if(o.startOdometer!=null || o.departOdometer!=null) return 'progress';
  return '';
}
function adminOrderCardHtml(o){
  const m=metrics(o);
  const hasRate=selectedRate(o)!=null;
  const pay=m.driverPay;
  const onEx=!!o.onExchange && !looksClosedOrder(o) && o.startOdometer==null;
  const st=statusText(o);
  const stCls=orderStatusClass(o);
  const sp=findSpaceById(orderSpaceId(o));
  const ownerLine=isSuperAdmin()
    ? `<p>Фирма: ${esc(sp?sp.name:'—')}${o.ownerAdminName?` · ${esc(o.ownerAdminName)}`:''}</p>`
    : '';
  const phone=(()=>{ const dp=orderDriverPhone(o); return dp?` · <a href="tel:${esc(dp)}" style="color:var(--accent)" onclick="event.stopPropagation()">☎ ${esc(dp)}</a>`:''; })();
  const sideBtns=[
    onEx?`<button type="button" class="secondary go-exchange">Биржа</button>`:'',
    typeof isBookingRequested==='function' && isBookingRequested(o) && isMyFirmOrder(o)
      ?`<button type="button" class="primary in-book-ok" data-id="${o.id}">Подтвердить бронь</button>`:'',
    typeof isBookingRequested==='function' && isBookingRequested(o) && isMyFirmOrder(o)
      ?`<button type="button" class="secondary in-book-no" data-id="${o.id}">Отклонить бронь</button>`:'',
    !onEx && !looksClosedOrder(o) && !o.cancelledAt && o.startOdometer==null && isMyFirmOrder(o)
      && (typeof isDispatcherCompany==='function' && isDispatcherCompany(findCompanyById(o.ownCompanyId)||currentOwnCompany()))
      ?`<button type="button" class="secondary pub-exchange" data-id="${o.id}">Биржа</button>`:'',
    canReturnOrderToExchange(o)
      && (typeof isDispatcherCompany==='function' && isDispatcherCompany(findCompanyById(o.ownCompanyId)||currentOwnCompany()))
      ?`<button type="button" class="secondary ret-exchange" data-id="${o.id}">На биржу снова</button>`:'',
    !looksClosedOrder(o)&&!o.cancelledAt
      ?`<button type="button" class="secondary cancel-order" data-id="${o.id}">Отменить</button>`:''
  ].filter(Boolean).join('');
  return `<div class="order-card${onEx?' exchange-mark':''}" data-order-card="${esc(o.id)}">
    <div class="order-card-head">
      ${adminOrderPickHtml(o)}
      <h3>Заказ №${o.sequentialNumber} · ${esc(orderDayLabel(o.dayNumber))}</h3>
    </div>
    <div class="order-status ${stCls}">${esc(st)}</div>
    <p>${esc(dateTime(o.createdAt))}</p>
    ${ownerLine}
    ${o.ownCompanyName?`<p style="color:var(--text);font-weight:600">От: ${esc(o.ownCompanyName)}</p>`:''}
    <p>Заказчик: ${esc(o.customer||'—')}${o.carrierCompanyName?` · Перевозчик: ${esc(o.carrierCompanyName)}`:''}</p>
    ${o.transportApp?`<p style="color:var(--accent)">Договор‑заявка: ${esc(o.transportApp.customerCompanyName||'')} → ${esc(o.transportApp.carrierCompanyName||'')}</p>`:''}
    <p>${esc(o.driverName)} · ${esc(o.vehiclePlate)}${o.bookedPlate&&o.bookedPlate!==o.vehiclePlate?` · бронь ${esc(o.bookedPlate)}`:''}${phone}</p>
    ${o.fulfillment==='logist'?'<p>Срочно: заказчик просит закрыть как можно скорее</p>':o.fulfillment==='direct'?'<p>Прямой парк, без срочной ставки логиста</p>':''}
    ${typeof logistMarginLine==='function'&&logistMarginLine(o)?`<p class="order-money">${esc(logistMarginLine(o))}</p>`:''}
    <p>${esc(orderContactLine(o))}</p>
    <p class="order-route">${esc(routeText(o))}</p>
    ${orderTimesLines(ensureOrderTimeStamps(o))}
    ${orderReqText(o)?`<p>ТС: ${esc(orderReqText(o))}</p>`:''}
    ${o.pricePending?`<p class="rate-missing">Цену уточнит перевозчик</p>`:''}
    ${orderScheduleLines(o, false)}
    <p class="order-km">Нулевой: ${fmt(o.emptyKmBefore)} · с грузом: ${fmt(o.loadedKm)} · до стоянки: ${fmt(o.emptyKmAfter)}</p>
    ${hasRate
      ? `<p class="order-money">Нал (ЗП): ${fmt(selectedRate(o))} ₽ · клиенту: ${fmt(clientRate(o))} ₽ · ЗП: ${fmt(pay)} ₽</p>`
      : `<p class="rate-missing">Ставка не заполнена — нажмите кнопку ниже</p>`}
    <div class="order-actions">
      <button type="button" class="primary open-rates" data-id="${o.id}">${hasRate?'Изменить ставки / финансы':'Заполнить ставки'}</button>
      <button type="button" class="secondary copy-order" data-id="${o.id}">Повторить</button>
      ${sideBtns?`<div class="row">${sideBtns}</div>`:''}
    </div>
  </div>`;
}
function adminGroupCardHtml(g){
  const open=!!state.adminExpandedGroups[g.id];
  const t=g.totals;
  const shiftNote=g.shift
    ? (g.openShift?`Смена с ${dateTime(g.shift.startedAt)}`:`Смена закрыта ${dateTime(g.shift.endedAt)}`)
    : 'Без привязки к смене';
  const title=g.openShift?'Открытая смена':'Итог за день';
  const statusCls=g.openShift?'open':'closed';
  const statusLabel=g.openShift?'Смена открыта':'День закрыт';
  return `<div class="day-card day-total-card${g.openShift?' open-shift':''}" data-group-card="${esc(g.id)}">
    <div class="day-card-top">
      <h3>${esc(title)} · ${esc(g.dayLabel)} · ${esc(g.driverName)}</h3>
      <span class="day-tog" aria-hidden="true">${open?'▼':'▶'}</span>
    </div>
    <p>${esc(g.vehiclePlate)} · заказов: ${t.count} · ${esc(shiftNote)}</p>
    <div class="day-status ${statusCls}">${esc(statusLabel)}</div>
    <div class="day-metrics">
      <div class="m"><span>Выручка</span><b class="accent">${esc(fmt(t.revenue))} ₽</b></div>
      <div class="m"><span>Расходы</span><b>${esc(fmt(t.expenses))} ₽</b></div>
      <div class="m"><span>Прибыль</span><b>${esc(fmt(t.profit))} ₽</b></div>
      <div class="m"><span>ЗП</span><b>${esc(fmt(t.pay))} ₽</b></div>
      <div class="m"><span>ГСМ</span><b>${esc(fmt(t.fuel))} ₽</b></div>
      <div class="m"><span>Км</span><b>${esc(fmt(t.km))}</b></div>
    </div>
    ${open?`<div class="day-total-details">${g.orders.map(adminOrderCardHtml).join('')}</div>`:''}
  </div>`;
}
/** Календарь фильтра дат в админке → Заявки (UX как у водителя в Истории). */
function ensureAdminOrdersCal(){
  if(!state.adminOrdersCal || typeof state.adminOrdersCal!=='object'){
    const now=new Date();
    state.adminOrdersCal={
      year:now.getFullYear(),
      month:now.getMonth(),
      from:null,
      to:null,
      showAll:false,
      driver:'',
      plate:''
    };
  }
  const cal=state.adminOrdersCal;
  if(cal.driver==null) cal.driver='';
  if(cal.plate==null) cal.plate='';
  return cal;
}
function adminOrdersPeriodLabel(cal){
  if(!cal) return 'Все дни';
  if(cal.from){
    if(!cal.to || cal.to===cal.from) return driverHistDayLabel(cal.from);
    const a=cal.from<cal.to?cal.from:cal.to;
    const b=cal.from<cal.to?cal.to:cal.from;
    return driverHistDayLabel(a)+' — '+driverHistDayLabel(b);
  }
  if(cal.showAll) return 'Все дни';
  const title=new Date(cal.year,cal.month,1).toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
  return title.charAt(0).toUpperCase()+title.slice(1);
}
function adminOrdersFilterGroups(groups, cal){
  let list=groups||[];
  if(!cal) return list;
  if(cal.from){
    const a=cal.to && cal.to<cal.from?cal.to:cal.from;
    const b=cal.to && cal.to>cal.from?cal.to:(cal.to||cal.from);
    list=list.filter(g=>g.dayKey && g.dayKey!=='без-даты' && g.dayKey>=a && g.dayKey<=b);
  } else if(!cal.showAll){
    const prefix=`${cal.year}-${String(cal.month+1).padStart(2,'0')}`;
    list=list.filter(g=>g.dayKey && String(g.dayKey).startsWith(prefix));
  }
  const driver=String(cal.driver||'').trim();
  const plate=String(cal.plate||'').trim();
  if(driver) list=list.filter(g=>String(g.driverName||'').trim()===driver);
  if(plate) list=list.filter(g=>String(g.vehiclePlate||'').trim()===plate);
  return list;
}
function adminOrdersFilterOptions(groups){
  const drivers=new Set();
  const plates=new Set();
  (groups||[]).forEach(g=>{
    const d=String(g.driverName||'').trim();
    const p=String(g.vehiclePlate||'').trim();
    if(d) drivers.add(d);
    if(p) plates.add(p);
  });
  return {
    drivers:[...drivers].sort((a,b)=>a.localeCompare(b,'ru')),
    plates:[...plates].sort((a,b)=>a.localeCompare(b,'ru'))
  };
}
function adminOrdersFiltersHtml(groups){
  const cal=ensureAdminOrdersCal();
  const {drivers,plates}=adminOrdersFilterOptions(groups);
  const driverOpts=['<option value="">Все</option>']
    .concat(drivers.map(d=>`<option value="${esc(d)}"${d===cal.driver?' selected':''}>${esc(d)}</option>`))
    .join('');
  const plateOpts=['<option value="">Все</option>']
    .concat(plates.map(p=>`<option value="${esc(p)}"${p===cal.plate?' selected':''}>${esc(p)}</option>`))
    .join('');
  const showClear=!!(cal.driver || cal.plate);
  return `<div class="admin-cal-filters" id="admin-cal-filters">
    <label>Водитель<select id="admin-cal-driver">${driverOpts}</select></label>
    <label>Госномер<select id="admin-cal-plate">${plateOpts}</select></label>
    <button type="button" id="admin-cal-filters-reset"${showClear?'':' hidden'}>Сбросить фильтры</button>
  </div>`;
}
function adminOrdersSelectDay(dayKey){
  const cal=ensureAdminOrdersCal();
  if(!dayKey || dayKey==='без-даты') return;
  cal.showAll=false;
  if(!cal.from || cal.to){
    cal.from=dayKey;
    cal.to=null;
  } else if(cal.from===dayKey){
    cal.to=null;
  } else {
    cal.to=dayKey;
  }
  const a=cal.to && cal.to<cal.from?cal.to:cal.from;
  const b=cal.to && cal.to>cal.from?cal.to:(cal.to||cal.from);
  if(!state.adminExpandedGroups || typeof state.adminExpandedGroups!=='object') state.adminExpandedGroups={};
  state._adminCalPendingExpand={a,b};
  renderAdmin();
}
function adminOrdersCalHtml(groups){
  const cal=ensureAdminOrdersCal();
  const marked=new Set((groups||[]).map(g=>g.dayKey).filter(k=>k && k!=='без-даты'));
  allOrders().forEach(o=>{
    if(!canAdminSeeOrder(o) || !matchesOwnerFilter(o)) return;
    const k=typeof confirmedBookingDayKey==='function'?confirmedBookingDayKey(o):'';
    if(k) marked.add(k);
  });
  const y=cal.year, m=cal.month;
  const title=new Date(y,m,1).toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
  const first=new Date(y,m,1);
  let startPad=(first.getDay()+6)%7;
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
    cells+=`<button type="button" class="${cls}" data-admin-cal-day="${esc(key)}">${day}</button>`;
  }
  const showReset=!!(cal.from || cal.showAll===false);
  return `<div class="drv-cal" id="admin-orders-cal">
    <div class="drv-cal-head">
      <button type="button" id="admin-cal-prev" aria-label="Предыдущий месяц">‹</button>
      <h3>${esc(title)}</h3>
      <button type="button" id="admin-cal-next" aria-label="Следующий месяц">›</button>
    </div>
    <div class="drv-cal-week">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(w=>`<span>${w}</span>`).join('')}</div>
    <div class="drv-cal-grid">${cells}</div>
    <div class="drv-cal-meta">
      <span class="period">${esc(adminOrdersPeriodLabel(cal))}</span>
      <button type="button" id="admin-cal-reset"${showReset?'':' hidden'}>Сбросить</button>
    </div>
  </div>`;
}
function filteredOrders(){
  if(state.adminFilter==='eto') return [];
  return allOrders().filter(o=>{
    // отменённые не показываем нигде
    if(o.cancelledAt || (o.closedAt && o.cancelReason)) return false;
    // обычный админ — только свои; супер — все, плюс фильтр по админу
    if(!canAdminSeeOrder(o) || !matchesOwnerFilter(o)) return false;
    if(state.adminFilter==='exchange') return !looksClosedOrder(o) && !!o.onExchange && o.startOdometer==null;
    if(state.adminFilter==='inbox') return typeof isLogistInboxOrder==='function' && isLogistInboxOrder(o);
    if(state.adminFilter==='assigned') return !looksClosedOrder(o) && o.startOdometer==null && !o.onExchange && !waitingLogistDriver(o.driverName);
    if(state.adminFilter==='progress') return !looksClosedOrder(o) && o.startOdometer!=null;
    if(state.adminFilter==='closed') return looksClosedOrder(o);
    return true;
  });
}
function renderAdminEtoBoard(){
  const shifts=adminOpenShifts();
  const pending=shifts.filter(s=>!isEtoDone(s)).length;
  const done=shifts.filter(s=>isEtoDone(s)).length;
  const head=`<div class="board-head">
    <p class="cat-panel-hint">Открытые смены водителей вашей фирмы</p>
    <div class="board-metrics">
      <div class="m"><span>Смены</span><b>${shifts.length}</b></div>
      <div class="m"><span>ЕТО ок</span><b class="ok">${done}</b></div>
      <div class="m"><span>В процессе</span><b class="${pending?'warn':''}">${pending}</b></div>
    </div>
  </div>`;
  if(!shifts.length){
    return `${head}<div class="admin-cards"><div class="empty">Нет открытых смен</div></div>`;
  }
  const cards=shifts.map(s=>{
    const ok=isEtoDone(s);
    const step=etoStepLabel(s);
    const L=s.light||{};
    const ph=formatPhone((()=>{ const d=findDriverRecord(s.driverName, s.ownCompanyId); return d&&d.phone?d.phone:''; })());
    const firm=s.ownCompanyName||(findSpaceById(s.spaceId)||{}).name||'—';
    const openOrders=(s.orders||[]).filter(o=>!o.closedAt && !o.cancelledAt).length
      || (state.orders||[]).filter(o=>!o.closedAt && !o.cancelledAt && o.driverName===s.driverName && o.vehiclePlate===s.vehiclePlate).length;
    return `<div class="eto-card ${ok?'done':'wait'}">
      <h3>${esc(s.driverName||'Водитель')} · ${esc(s.vehiclePlate||'без авто')}</h3>
      <p>Смена с ${esc(dateTime(s.startedAt))}${s.ownerAdminName && isSuperAdmin()?` · ${esc(s.ownerAdminName)}`:''}</p>
      <p>Фирма: ${esc(firm)}${ph?` · <a href="tel:${esc(ph)}" style="color:var(--accent)">${esc(ph)}</a>`:''}</p>
      <div class="eto-status ${ok?'ok':'wait'}">${ok?'ЕТО пройден':esc(step)}</div>
      <div class="eto-grid">
        <span>Авто ${etoMark(!!s.vehiclePlate)}</span>
        <span>Одометр ${etoMark(s.odometer!=null)} ${s.odometer!=null?`<b>${esc(s.odometer)}</b>`:''}</span>
        <span>Топливо ${etoMark(s.fuelLiters!=null)} ${s.fuelLiters!=null?`<b>${esc(s.fuelLiters)} л</b>`:''}${s.fuelRemainingLiters!=null && s.fuelRemainingLiters!==s.fuelLiters?` · сейчас <b>${esc(s.fuelRemainingLiters)} л</b>`:''}</span>
        <span>ГУР ${etoMark(!!(s.gur||s.powerSteeringLevel))} ${s.gur||s.powerSteeringLevel?`<b>${esc(s.gur||s.powerSteeringLevel)}</b>`:''}</span>
        <span>ОЖ ${etoMark(!!(s.coolant||s.coolantLevel))} ${s.coolant||s.coolantLevel?`<b>${esc(s.coolant||s.coolantLevel)}</b>`:''}</span>
        <span>Свет ${etoMark(!!(L.lowBeam&&L.brake&&L.turn))}</span>
        <span>Масло ${etoMark(!!(s.oil||s.engineOilLevel))} ${s.oil||s.engineOilLevel?`<b>${esc(s.oil||s.engineOilLevel)}</b>`:''}</span>
        <span>Заказов <b>${(s.orders||[]).length}</b>${openOrders?` · открытых <b>${openOrders}</b>`:''}</span>
      </div>
      ${ok && s.completedAt?`<p style="margin-top:8px">Завершён: ${esc(dateTime(s.completedAt))}</p>`:''}
    </div>`;
  }).join('');
  return `${head}<div class="admin-cards">${cards}</div>`;
}
function unpublishFromExchange(id){
  const o=state.orders.find(x=>x.id===id);
  if(!o || !o.onExchange) return;
  if(!isMyFirmOrder(o) && !isSuperAdmin()){ alert('Снять с биржи может только фирма‑заказчик'); return; }
  if(!confirm('Снять заказ с биржи?')) return;
  o.onExchange=false;
  const keep=typeof orderKeepsLogist==='function' && orderKeepsLogist(o);
  o.executorType=keep?'logist':'own';
  if(typeof waitingLogistDriver==='function' ? waitingLogistDriver(o.driverName) : (o.driverName==='Биржа'||!o.driverName)){
    o.driverName=keep?'Диспетчер':'—';
  }
  bumpDataEpoch('unpublish-exchange');
  upsertOrder(o);
  renderAdmin();
}
function confirmOrderBooking(id){
  const o=state.orders.find(x=>x.id===id);
  if(!o || !String(o.bookedPlate||'').trim()){ alert('Нет запроса брони'); return; }
  if(!isMyFirmOrder(o) && !isSuperAdmin()){ alert('Чужой заказ'); return; }
  if(typeof vehicleBusyAt==='function' && vehicleBusyAt(o.bookedPlate, o.vehicleAt, o.id)){
    alert('Эта машина уже занята на это время. Выберите другое авто или отклоните запрос.');
    return;
  }
  if(!confirm(`Подтвердить бронь ${o.bookedPlate} на ${o.vehicleAt?formatRuDateTimeAt(o.vehicleAt):'указанную подачу'}? Дата появится в календаре у вас и у заказчика.`)) return;
  stampConfirmedBooking(o, o.bookedPlate);
  bumpDataEpoch('book-confirm');
  upsertOrder(o);
  persist();
  renderAdmin();
}
function rejectOrderBooking(id){
  const o=state.orders.find(x=>x.id===id);
  if(!o || !String(o.bookedPlate||'').trim()){ alert('Нет запроса брони'); return; }
  if(!isMyFirmOrder(o) && !isSuperAdmin()){ alert('Чужой заказ'); return; }
  if(!confirm(`Отклонить бронь ${o.bookedPlate}? Заказчик увидит отказ, точка в календаре не появится.`)) return;
  o.bookStatus='rejected';
  o.bookRejectedAt=new Date().toISOString();
  bumpDataEpoch('book-reject');
  upsertOrder(o);
  persist();
  renderAdmin();
}
function canReturnOrderToExchange(o){
  if(!o || looksClosedOrder(o) || o.cancelledAt || o.startOdometer!=null || o.onExchange) return false;
  if(typeof isLogistInboxOrder==='function' && isLogistInboxOrder(o)) return false;
  if(typeof waitingLogistDriver==='function' && waitingLogistDriver(o.driverName)) return false;
  const assigned=o.driverName && o.driverName!=='Биржа' && o.driverName!=='—';
  if(!assigned) return false;
  if(isMyFirmOrder(o) || isSuperAdmin()) return true;
  return false;
}
function returnOrderToExchange(id){
  const o=state.orders.find(x=>x.id===id);
  if(!o){ alert('Заказ не найден'); return; }
  if(!canReturnOrderToExchange(o)){ alert('Вернуть на биржу можно только до выезда, если заказ уже назначен'); return; }
  if(!isMyFirmOrder(o) && !isSuperAdmin()){ alert('Чужой заказ'); return; }
  billingGuardWithServer(o.spaceId||currentSpaceId(), 'publish_exchange').then(g=>{
    if(!g.ok){ alert(g.message); return; }
    if(!(o.reqPayloadTons>0)){ alert('Укажите грузоподъёмность в карточке заказа'); openDetail(id); return; }
    if(!confirm(typeof orderKeepsLogist==='function' && orderKeepsLogist(o)
      ? 'Вернуть на биржу? Там вы снова заказчик перевозки. Назначение водителя и договор‑заявка будут сброшены.'
      : 'Вернуть заказ на биржу? Назначение водителя и договор‑заявка будут сброшены.')) return;
    o.onExchange=true;
    o.exchangeListedAt=new Date().toISOString();
    o.wasOnExchange=true;
    const keep=typeof orderKeepsLogist==='function' && (o.customerSubmitted || o.fulfillment==='logist' || o.fulfillment==='direct');
    o.executorType=keep?'logist':'exchange';
    o.driverName=keep?'Диспетчер':'Биржа';
    o.vehiclePlate='—';
    o.transportApp=null;
    o.partnerSpaceId=null;
    o.carrierCompanyId=null;
    o.carrierCompanyName=null;
    o.carrierDriverId=null;
    o.carrierVehicleId=null;
    o.executorAdminId=null;
    o.driverPhone='';
    if(typeof clearOrderBooking==='function') clearOrderBooking(o);
    bumpDataEpoch('return-exchange');
    upsertOrder(o);
    if(state.detailId===id && typeof openDetail==='function') openDetail(id);
    else renderAdmin();
  });
}
function publishToExchange(id){
  const o=state.orders.find(x=>x.id===id);
  if(!o || o.closedAt || o.startOdometer!=null){ alert('Нельзя выставить на биржу'); return; }
  if(!isMyFirmOrder(o) && !isSuperAdmin()){ alert('Чужой заказ'); return; }
  const firm=findCompanyById(o.ownCompanyId)||currentOwnCompany();
  if(typeof isDispatcherCompany==='function' && !isDispatcherCompany(firm)){
    alert('Включите «Диспетчер» в справочнике нашей фирмы — тогда появится Биржа. Биржа входит в тариф «Бизнес».');
    return;
  }
  billingGuardWithServer(o.spaceId||currentSpaceId(), 'publish_exchange').then(g=>{
    if(!g.ok){ alert(g.message); return; }
    if(!(o.reqPayloadTons>0)){ alert('Укажите грузоподъёмность в карточке заказа (требования к ТС), затем выставьте на биржу'); openDetail(id); return; }
    const free=(typeof companyHasOwnPark==='function' && !companyHasOwnPark(findCompanyById(o.ownCompanyId)||currentOwnCompany()))
      ? []
      : (typeof freeOwnFleetForOrder==='function'?freeOwnFleetForOrder(o):[]);
    if(free.length){
      const plates=free.slice(0,6).map(v=>v.plate).join(', ')+(free.length>6?'…':'');
      if(!confirm(`Свободных своих машин под заявку: ${free.length} (${plates}).\n\nСначала свой парк. Остаток можно отдать на биржу — там вы заказчик перевозки.\n\nВсё равно выставить на биржу?`)) return;
    } else if(!confirm(typeof orderKeepsLogist==='function' && orderKeepsLogist(o)
      ? 'Выставить на биржу? Там вы заказчик перевозки, партнёр везёт, для грузоотправителя исполнителем остаётесь вы. Биржа — в тарифе «Бизнес».'
      : 'Выставить заказ на биржу для других фирм? Там вы заказчик этой перевозки.')) return;
    o.onExchange=true;
    o.exchangeListedAt=new Date().toISOString();
    o.wasOnExchange=true;
    const keep=typeof orderKeepsLogist==='function' && orderKeepsLogist(o);
    o.executorType=keep?'logist':'exchange';
    o.driverName=keep?'Диспетчер':'Биржа';
    o.vehiclePlate='—';
    o.transportApp=null;
    o.partnerSpaceId=null;
    o.executorAdminId=null;
    if(typeof clearOrderBooking==='function') clearOrderBooking(o);
    bumpDataEpoch('publish-exchange');
    upsertOrder(o);
    setAdminNav('exchange');
  });
}
function assignExchangeToOwn(id){
  const o=state.orders.find(x=>x.id===id);
  if(!o || looksClosedOrder(o) || o.cancelledAt || o.startOdometer!=null){ alert('Нельзя назначить'); renderAdmin(); return; }
  if(!isMyFirmOrder(o) && !isSuperAdmin()){ alert('Свой парк — только для заказов вашей фирмы. Чужой забирайте кнопкой «Забрать»'); return; }
  const driver=(($('ex-drv-'+id)||{}).value||'').trim();
  const plate=(($('ex-plate-'+id)||{}).value||'').trim();
  if(!driver){ alert('Выберите водителя'); return; }
  if(!plate){ alert('Выберите авто'); return; }
  const firmId=o.ownCompanyId || (currentOwnCompany()||{}).id;
  const res=applyOwnFleetAssignment(o, driver, plate, firmId);
  if(!res.ok){ alert(res.message||'Не удалось назначить'); return; }
  bumpDataEpoch('assign-exchange-own');
  upsertOrder(o);
  renderAdmin();
}
let claimOrderId=null;
function clearAdminUiForDeletedOrders(ids){
  const delSet=new Set((ids||[]).filter(Boolean));
  if(claimOrderId && delSet.has(claimOrderId)) claimOrderId=null;
  if(state.detailId && delSet.has(state.detailId)){
    state.detailId=null;
    if($('admin-detail')&&$('admin-detail').classList.contains('show')) show('admin');
  }
}
function openClaimExchange(id){
  const o=state.orders.find(x=>x.id===id);
  if(!o || !o.onExchange){ alert('Заказ уже не на бирже'); renderAdmin(); return; }
  if(isMyFirmOrder(o) && !isSuperAdmin()){ alert('Это заказ вашей фирмы — назначьте своего водителя или снимите с биржи'); return; }
  const myCo=currentOwnCompany();
  if(!myCo){ alert('Сначала нужна ваша фирма'); return; }
  if(o.ownCompanyId && o.ownCompanyId===myCo.id){ alert('Нельзя забрать свой же заказ как перевозчик'); return; }
  claimOrderId=id;
  const drvList=fleetDriversForCompany(myCo.id);
  const vehAll=fleetVehiclesForCompany(myCo.id);
  const vehOk=vehAll.filter(v=>vehicleFitsOrder(v,o));
  const req=orderReqText(o)||'не указаны';
  $('claim-error').textContent='';
  const claimTitle=$('claim-title');
  if(claimTitle) claimTitle.textContent=`Забрать №${o.sequentialNumber}`;
  $('claim-form').innerHTML=`
    <section class="form-section">
      <h2 class="form-section-title">Договор‑заявка</h2>
      <p class="form-section-hint">Логист отдаёт вам заказ. Если вы владелец и сами за рулём — не нужно искать заявки: забрали, назначили своё авто и поехали.</p>
      <div class="claim-box">
        <p><strong>Заказчик перевозки:</strong> ${esc(o.ownCompanyName||'—')}</p>
        <p><strong>Перевозчик:</strong> ${esc(myCo.name)}</p>
        <p><strong>Маршрут:</strong> ${esc(routeText(o))}</p>
        <p><strong>Подача:</strong> ${o.vehicleAt?esc(formatRuDateTimeAt(o.vehicleAt)):'—'}</p>
        <p><strong>Требования к ТС:</strong> ${esc(req)}</p>
        <p class="hint" style="margin-top:6px">После подписи — ваш водитель (часто вы сами) и авто войдут в заявку. Для грузоотправителя исполнителем остаётся логист.</p>
      </div>
    </section>
    <section class="form-section">
      <h2 class="form-section-title">Назначение</h2>
      <div class="form-fields">
        <div class="form-pair">
          <div>
            <label for="claim-driver">Водитель (ваш парк)</label>
            <select id="claim-driver">${drvList.length?drvList.map(d=>`<option value="${esc(d.name)}">${esc(d.name)}</option>`).join(''):`<option value="">— добавьте водителя в Справочниках —</option>`}</select>
          </div>
          <div>
            <label for="claim-plate">Авто (по т / габаритам)</label>
            <select id="claim-plate">${vehOk.length?vehOk.map(v=>`<option value="${esc(v.plate)}">${esc(v.plate)}${vehicleSpecText(v)?' · '+esc(vehicleSpecText(v)):''}</option>`).join(''):`<option value="">— нет подходящего авто —</option>`}</select>
          </div>
        </div>
        <div class="hint">${vehAll.length?`В парке ${vehAll.length}, подходит: ${vehOk.length}. Неподходящие скрыты.`:'В вашей фирме нет авто — добавьте в Справочниках с тоннажем и габаритами.'}</div>
        <div id="claim-drv-docs-warn" hidden></div>
      </div>
    </section>
  `;
  show('admin-claim');
  const claimDrvSel=$('claim-driver');
  const claimWarn=$('claim-drv-docs-warn');
  const refreshClaimDrvWarn=()=>{
    if(typeof refreshDriverDocsWarnBox==='function') refreshDriverDocsWarnBox(claimWarn, (claimDrvSel&&claimDrvSel.value||'').trim(), myCo.id);
  };
  if(claimDrvSel) claimDrvSel.onchange=refreshClaimDrvWarn;
  refreshClaimDrvWarn();
  $('claim-back').onclick=()=>{ claimOrderId=null; show('admin'); renderAdmin(); };
  $('claim-cancel').onclick=()=>{ claimOrderId=null; show('admin'); renderAdmin(); };
  $('claim-confirm').onclick=confirmClaimExchange;
}
function confirmClaimExchange(){
  const o=state.orders.find(x=>x.id===claimOrderId);
  if(!o || !o.onExchange){ alert('Заказ уже не на бирже'); claimOrderId=null; show('admin'); renderAdmin(); return; }
  billingGuardWithServer(currentSpaceId(), 'claim_exchange').then(g=>{
    if(!g.ok){ $('claim-error').textContent=g.message; return; }
    confirmClaimExchangeAfterGuard(o);
  });
}
function confirmClaimExchangeAfterGuard(o){
  const myCo=currentOwnCompany();
  if(!myCo || !currentAdmin){ $('claim-error').textContent='Нужна ваша фирма'; return; }
  const driver=(($('claim-driver')||{}).value||'').trim();
  const plate=(($('claim-plate')||{}).value||'').trim();
  if(!driver){ $('claim-error').textContent='Выберите водителя'; return; }
  if(!plate){ $('claim-error').textContent='Выберите подходящее авто'; return; }
  if(!fleetDriversForCompany(myCo.id).some(d=>samePersonName(d.name,driver))){
    $('claim-error').textContent='Водитель не из вашего парка'; return;
  }
  const veh=fleetVehiclesForCompany(myCo.id).find(v=>v.plate===plate);
  if(!veh){ $('claim-error').textContent='Авто не из вашего парка'; return; }
  if(!vehicleFitsOrder(veh, o)){ $('claim-error').textContent='Авто не подходит по требованиям заявки'; return; }
  const drvRec=findDriverRecord(driver, myCo.id);
  if(typeof confirmIfDriverDocsIncomplete==='function'&&!confirmIfDriverDocsIncomplete(drvRec, driver)) return;
  const customerCo=findCompanyById(o.ownCompanyId);
  o.transportApp={
    id:uuid(),
    signedAt:new Date().toISOString(),
    customerCompanyId:o.ownCompanyId||null,
    customerCompanyName:o.ownCompanyName||(customerCo&&customerCo.name)||'',
    carrierCompanyId:myCo.id,
    carrierCompanyName:myCo.name,
    customerAdminId:o.ownerAdminId||null,
    carrierAdminId:currentAdmin.id,
    driverName:driver,
    vehiclePlate:plate,
    vehiclePayloadTons:veh.payloadTons||null,
    vehicleBodyLengthM:veh.bodyLengthM||null,
    vehicleBodyWidthM:veh.bodyWidthM||null,
    vehicleBodyHeightM:veh.bodyHeightM||null,
    reqPayloadTons:o.reqPayloadTons||null,
    reqLengthM:o.reqLengthM||null,
    reqWidthM:o.reqWidthM||null,
    reqHeightM:o.reqHeightM||null,
    route:routeText(o),
    orderSequentialNumber:o.sequentialNumber
  };
  o.onExchange=false;
  o.executorType='partner';
  o.carrierCompanyId=myCo.id;
  o.carrierCompanyName=myCo.name;
  o.driverName=driver;
  o.vehiclePlate=plate;
  o.driverPercent=driverPercent(driver, myCo.id);
  o.driverPhone=driverPhone(driver, myCo.id);
  o.partnerSpaceId=currentAdmin.spaceId||null;
  o.wasOnExchange=true;
  o.executorAdminId=currentAdmin.id;
  if(o.transportApp) o.transportApp.driverPhone=o.driverPhone||'';
  stampOrderDriverPhone(o);
  if(typeof stampConfirmedBooking==='function') stampConfirmedBooking(o, plate);
  if(typeof syncOrderDocsOnAssign==='function'){
    syncOrderDocsOnAssign(o);
    ensureOrderDocs(o);
    if(o.transportApp&&o.transportApp.signedAt){
      o.docs.transportApp.status='signed';
      o.docs.transportApp.updatedAt=o.transportApp.signedAt;
    }
  }
  bumpDataEpoch('claim-exchange');
  upsertOrder(o);
  claimOrderId=null;
  show('admin');
  state.adminFilter='assigned';
  document.querySelectorAll('#admin-filters [data-filter]').forEach(b=>b.classList.toggle('on', b.dataset.filter==='assigned'));
  renderAdmin();
  alert('Договор‑заявка подписана. Водитель и авто внесены в заявку.');
}
function renderAdminExchangeBoard(orders){
  const mineCount=orders.filter(o=>isMyFirmOrder(o)).length;
  const head=`<div class="board-head">
    <p class="cat-panel-hint">Свои заявки на бирже: вы заказчик перевозки (свой парк уже занят или не подходит). Чужие — «Забрать» как перевозчик.</p>
    ${adminOrdersBulkBarHtml()}
    <div class="board-metrics">
      <div class="m"><span>На бирже</span><b>${orders.length}</b></div>
      <div class="m"><span>Вы заказчик</span><b>${mineCount}</b></div>
      <div class="m"><span>Забрать</span><b>${Math.max(0, orders.length-mineCount)}</b></div>
    </div>
  </div>`;
  if(!orders.length){
    return `${head}<div class="admin-cards"><div class="empty">На бирже пусто. «+ Заказ» → «На биржу» или кнопка у заявки.</div></div>`;
  }
  const myCo=currentOwnCompany();
  const cards=orders.map(o=>{
    const mine=isMyFirmOrder(o);
    const req=orderReqText(o);
    const firmId=mine?(o.ownCompanyId||(myCo&&myCo.id)): (myCo&&myCo.id);
    const drvList=firmId?fleetDriversForCompany(firmId):[];
    const vehList=(firmId?fleetVehiclesForCompany(firmId):[]).filter(v=>vehicleFitsOrder(v,o));
    const drvOpts=drvList.map(d=>`<option value="${esc(d.name)}">${esc(d.name)}</option>`).join('');
    const plateOpts=vehList.map(v=>`<option value="${esc(v.plate)}">${esc(v.plate)}${vehicleSpecText(v)?' · '+esc(vehicleSpecText(v)):''}</option>`).join('');
    return `<div class="ex-card">
      <div class="order-card-head">
        ${adminOrderPickHtml(o)}
        <h3>№${o.sequentialNumber} · ${esc(orderDayLabel(o.dayNumber))}</h3>
      </div>
      <p>${esc(dateTime(o.createdAt))}</p>
      <p>Заказчик: <strong style="color:var(--text)">${esc(o.ownCompanyName||'—')}</strong>${mine?' (вы)':''}</p>
      <span class="ex-badge ${mine?'':'other'}">${mine?'вы заказчик':'чужой · забрать как перевозчик'}</span>
      <p class="ex-route">${esc(routeText(o))}</p>
      ${orderScheduleLines(o, false)}
      <p style="margin-top:6px">ТС нужно: <strong style="color:var(--text)">${esc(req||'не указано')}</strong></p>
      ${mine?`
        <div class="ex-assign-box">
          <label for="ex-drv-${o.id}">Водитель</label>
          <select id="ex-drv-${o.id}">${drvOpts||`<option value="">— нет водителей —</option>`}</select>
          <label for="ex-plate-${o.id}">Авто под требования</label>
          <select id="ex-plate-${o.id}">${plateOpts||`<option value="">— нет подходящего авто —</option>`}</select>
          <div class="ex-actions">
            <button type="button" class="primary ex-assign" data-id="${o.id}">Парк</button>
            <div class="row">
              <button type="button" class="secondary ex-unpub" data-id="${o.id}">Снять с биржи</button>
              <button type="button" class="secondary open-rates" data-id="${o.id}">Карточка</button>
            </div>
          </div>
        </div>
      `:`
        <div class="ex-actions">
          <button type="button" class="primary ex-claim" data-id="${o.id}">Забрать как перевозчик</button>
          <button type="button" class="secondary open-rates" data-id="${o.id}">Карточка</button>
        </div>
      `}
    </div>`;
  }).join('');
  return `${head}<div class="admin-cards">${cards}</div>`;
}
function renderAdminInboxBoard(orders){
  const rush=orders.filter(o=>o.fulfillment!=='direct').length;
  const waitBook=orders.filter(o=>typeof isBookingRequested==='function' && isBookingRequested(o)).length;
  const okBook=orders.filter(o=>typeof isBookingConfirmed==='function' && isBookingConfirmed(o)).length;
  const calMarks=[];
  (orders||[]).forEach(o=>{
    const k=dayKeyFromIso(o.vehicleAt||o.createdAt);
    if(k) calMarks.push({dayKey:k});
  });
  allOrders().forEach(o=>{
    if(!canAdminSeeOrder(o)||!matchesOwnerFilter(o)) return;
    const k=typeof confirmedBookingDayKey==='function'?confirmedBookingDayKey(o):'';
    if(k) calMarks.push({dayKey:k});
  });
  const dispatcher=typeof isDispatcherCompany==='function' && isDispatcherCompany(currentOwnCompany());
  const hasPark=typeof companyHasOwnPark==='function' && companyHasOwnPark(currentOwnCompany());
  const head=`<div class="board-head">
    <p class="cat-panel-hint">${dispatcher
      ?(hasPark
        ? 'Логист и диспетчер — одна должность. Сначала свой парк, остаток — Биржа (тариф «Бизнес»): там вы заказчик перевозки.'
        : 'Диспетчер без своего парка: заявки на биржу (тариф «Бизнес») — вы заказчик перевозки, партнёр везёт.')
      :(hasPark
        ? 'Свой парк. Чтобы появилась кнопка «Биржа», включите «Диспетчер» в справочнике нашей фирмы. Биржа — в тарифе «Бизнес».'
        : 'Своего парка нет. Включите «Диспетчер» в справочнике — появится Биржа (тариф «Бизнес»).')}</p>
    ${adminOrdersCalHtml(calMarks)}
    ${adminOrdersBulkBarHtml()}
    <div class="board-metrics">
      <div class="m"><span>Входящие</span><b>${orders.length}</b></div>
      <div class="m"><span>Ждут бронь</span><b class="${waitBook?'warn':''}">${waitBook}</b></div>
      <div class="m"><span>Бронь ок</span><b class="ok">${okBook}</b></div>
      <div class="m"><span>Срочно</span><b class="${rush?'warn':''}">${rush}</b></div>
    </div>
  </div>`;
  if(!orders.length){
    return `${head}<div class="admin-cards"><div class="empty">Входящих нет. Заявки с портала заказчика появляются здесь.</div></div>`;
  }
  const myCo=currentOwnCompany();
  const cards=orders.map(o=>{
    const firmId=o.ownCompanyId||(myCo&&myCo.id);
    const drvList=firmId?fleetDriversForCompany(firmId):[];
    const vehList=(firmId?fleetVehiclesForCompany(firmId):[]).filter(v=>vehicleFitsOrder(v,o));
    const freeList=typeof freeOwnFleetForOrder==='function'?freeOwnFleetForOrder(o):vehList;
    const bookedPlate=String(o.bookedPlate||'').trim();
    const drvOpts=drvList.map(d=>`<option value="${esc(d.name)}">${esc(d.name)}</option>`).join('');
    const plateOpts=vehList.map(v=>`<option value="${esc(v.plate)}" ${bookedPlate&&v.plate===bookedPlate?'selected':''}>${esc(v.plate)}${vehicleSpecText(v)?' · '+esc(vehicleSpecText(v)):''}${bookedPlate&&v.plate===bookedPlate?' · бронь':''}</option>`).join('');
    const margin=typeof logistMarginLine==='function'?logistMarginLine(o):'';
    const reqBook=typeof isBookingRequested==='function' && isBookingRequested(o);
    const okB=typeof isBookingConfirmed==='function' && isBookingConfirmed(o);
    const bookLine=reqBook
      ? `<p class="rate-missing">Запрос брони ${esc(bookedPlate)} — подтвердите, тогда дата подачи попадёт в календарь.</p>`
      : okB
        ? `<p class="order-money">Бронь ${esc(bookedPlate)} подтверждена · в календаре ${esc(o.vehicleAt?dayOnly(o.vehicleAt):'')}</p>`
        : o.bookStatus==='rejected'
          ? `<p class="hint">Бронь ${esc(bookedPlate)} отклонена</p>`
          : '';
    return `<div class="ex-card">
      <div class="order-card-head">
        ${adminOrderPickHtml(o)}
        <h3>№${o.sequentialNumber} · ${esc(orderDayLabel(o.dayNumber))}</h3>
      </div>
      <p>${esc(dateTime(o.createdAt))}</p>
      <p>Заказчик: <strong style="color:var(--text)">${esc(o.customer||'—')}</strong></p>
      <span class="ex-badge">${o.fulfillment==='direct'?'свой парк':'срочно · ставка логиста'}</span>
      <p class="ex-route">${esc(routeText(o))}</p>
      ${orderScheduleLines(o, false)}
      <p style="margin-top:6px">ТС нужно: <strong style="color:var(--text)">${esc(orderReqText(o)||'не указано')}</strong>${bookedPlate?` · ${esc(bookedPlate)}`:''}</p>
      ${bookLine}
      ${margin?`<p class="order-money">${esc(margin)}</p>`:''}
      ${!hasPark?`
      <p class="hint">${dispatcher?'Своего парка нет. На бирже вы заказчик перевозки.':'Своего парка нет. Включите «Диспетчер» в справочнике — появится Биржа.'}</p>
      <div class="ex-actions">
        ${dispatcher?`<button type="button" class="primary pub-exchange" data-id="${o.id}">Биржа</button>`:''}
        <button type="button" class="secondary open-rates" data-id="${o.id}">Карточка</button>
      </div>
      `:`
      <p class="hint">${freeList.length
        ?`Свободно своих под заявку: ${freeList.length}. Сначала Парк${dispatcher?' — остаток на Биржу':''}.`
        :(dispatcher?'Свободных своих нет. Остаток — Биржа.':'Свободных своих нет.')}</p>
      <div class="ex-assign-box">
        ${reqBook?`<div class="ex-actions" style="margin-bottom:8px">
          <button type="button" class="primary in-book-ok" data-id="${o.id}">Подтвердить бронь</button>
          <button type="button" class="secondary in-book-no" data-id="${o.id}">Отклонить бронь</button>
        </div>`:''}
        <label for="ex-drv-${o.id}">Водитель своего парка</label>
        <select id="ex-drv-${o.id}">${drvOpts||`<option value="">— нет водителей —</option>`}</select>
        <label for="ex-plate-${o.id}">Авто</label>
        <select id="ex-plate-${o.id}">${plateOpts||`<option value="">— нет подходящего авто —</option>`}</select>
        <div class="park-ex-cta">
          <button type="button" class="${freeList.length||!dispatcher?'primary':'secondary'} ex-assign" data-id="${o.id}">Парк</button>
          ${dispatcher?`<button type="button" class="${freeList.length?'secondary':'primary'} pub-exchange" data-id="${o.id}">Биржа</button>`:''}
        </div>
        <button type="button" class="secondary open-rates" data-id="${o.id}">Карточка</button>
      </div>`}
    </div>`;
  }).join('');
  return `${head}<div class="admin-cards">${cards}</div>`;
}
function pilotSetupChecklistHtml(){
  const co=typeof currentOwnCompany==='function'?currentOwnCompany():null;
  if(!co) return '';
  const sid=co.spaceId||currentSpaceId();
  const veh=(typeof fleetVehiclesForCompany==='function'?fleetVehiclesForCompany(co.id):[]).length;
  const drv=(typeof fleetDriversForCompany==='function'?fleetDriversForCompany(co.id):[]).length;
  const cust=(state.companies||[]).filter(c=>c.spaceId===sid && typeof companyHasRole==='function' && companyHasRole(c,'customer')).length;
  const fin=typeof financeForCompanyId==='function'?financeForCompanyId(co.id):null;
  const hasTariff=fin&&(+(fin.defaultRatePerKmCash||0)>0 || +(fin.defaultRatePerHourWork||0)>0);
  const orders=(state.orders||[]).filter(o=>o&&o.spaceId===sid).length;
  if(orders>0 && veh>0 && drv>0 && cust>0 && hasTariff) return '';
  const items=[
    {ok:veh>0, label:'Авто в парке (Справочники → Авто)'},
    {ok:drv>0, label:'Водители с PIN (Справочники → Водители)'},
    {ok:cust>0, label:'Заказчик (Справочники → Контрагенты → роль «Заказчик»)'},
    {ok:hasTariff, label:'Тариф ₽/км или ₽/ч (Справочники → Тарифы)'},
    {ok:orders>0, label:'Первый заказ (+ Заказ или портал заказчика)'}
  ];
  const rows=items.map(it=>`<li class="${it.ok?'done':''}">${it.ok?'✓':'○'} ${esc(it.label)}</li>`).join('');
  const portal=typeof customerPortalPageUrl==='function'?customerPortalPageUrl({spaceId:sid}):'';
  return `<div class="pilot-setup-card">
    <h3>Старт пилота — чеклист</h3>
    <p class="hint">Кабинет новый: тот же функционал, что у Армады, но данные нужно завести здесь. Заказы Стройтеха и прочие — в другом space, они сюда не копируются.</p>
    <ul class="pilot-setup-list">${rows}</ul>
    ${portal?`<p class="hint">Портал заказчика: <a href="${esc(portal)}" target="_blank" rel="noopener">${esc(portal)}</a> (раздел «Ссылки»)</p>`:''}
  </div>`;
}
function renderAdminDebounced(){
  clearTimeout(renderAdminDebounceTimer);
  renderAdminDebounceTimer=setTimeout(()=>renderAdmin(), 100);
}
function renderAdmin(){
  updateAdminInboxBadge();
  updateAdminInboxBanner();
  maybeNotifyAdminInboxUpdates();
  const billBanner=$('admin-billing-banner');
  if(billBanner){
    const txt=billingBannerForAdmin();
    billBanner.textContent=txt||'';
    billBanner.style.display=txt?'block':'none';
  }
  updateAdminChrome();
  if(state.adminFilter==='eto'){
    $('admin-list').innerHTML=renderAdminEtoBoard();
    return;
  }
  const orders=filteredOrders();
  pruneAdminOrderSelection(orders.map(o=>o.id).filter(Boolean));
  if(state.adminFilter==='exchange'){
    $('admin-list').innerHTML=renderAdminExchangeBoard(orders);
    document.querySelectorAll('#admin-list .ex-assign').forEach(b=>b.onclick=()=>assignExchangeToOwn(b.dataset.id));
    document.querySelectorAll('#admin-list .ex-unpub').forEach(b=>b.onclick=()=>unpublishFromExchange(b.dataset.id));
    document.querySelectorAll('#admin-list .ex-claim').forEach(b=>b.onclick=()=>openClaimExchange(b.dataset.id));
    document.querySelectorAll('#admin-list .open-rates').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); openDetail(b.dataset.id); });
    wireAdminOrderDeleteUi(orders);
    return;
  }
  if(state.adminFilter==='inbox'){
    $('admin-list').innerHTML=renderAdminInboxBoard(orders);
    document.querySelectorAll('#admin-list .ex-assign').forEach(b=>b.onclick=()=>assignExchangeToOwn(b.dataset.id));
    document.querySelectorAll('#admin-list .pub-exchange').forEach(b=>b.onclick=()=>publishToExchange(b.dataset.id));
    document.querySelectorAll('#admin-list .in-book-ok').forEach(b=>b.onclick=()=>confirmOrderBooking(b.dataset.id));
    document.querySelectorAll('#admin-list .in-book-no').forEach(b=>b.onclick=()=>rejectOrderBooking(b.dataset.id));
    document.querySelectorAll('#admin-list .open-rates').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); openDetail(b.dataset.id); });
    const prev=$('admin-cal-prev');
    const next=$('admin-cal-next');
    const reset=$('admin-cal-reset');
    if(prev) prev.onclick=()=>{ const c=ensureAdminOrdersCal(); c.month--; if(c.month<0){ c.month=11; c.year--; } if(!c.from) c.showAll=false; renderAdmin(); };
    if(next) next.onclick=()=>{ const c=ensureAdminOrdersCal(); c.month++; if(c.month>11){ c.month=0; c.year++; } if(!c.from) c.showAll=false; renderAdmin(); };
    if(reset) reset.onclick=()=>{ const c=ensureAdminOrdersCal(); c.from=null; c.to=null; c.showAll=true; renderAdmin(); };
    document.querySelectorAll('#admin-list [data-admin-cal-day]').forEach(btn=>{
      btn.onclick=e=>{ e.stopPropagation(); adminOrdersSelectDay(btn.dataset.adminCalDay); };
    });
    wireAdminOrderDeleteUi(orders);
    markAllAdminInboxSeen();
    return;
  }
  if(!orders.length){
    const checklist=(!isSuperAdmin()&&typeof pilotSetupChecklistHtml==='function')?pilotSetupChecklistHtml():'';
    const emptyHint=isSuperAdmin()
      ? 'Пока нет заявок. Нажмите + Заказ'
      : 'Пока нет заявок. Пройдите чеклист ниже и нажмите + Заказ';
    $('admin-list').innerHTML=`${checklist}<div class="empty">${emptyHint}</div>`;
    return;
  }
  const exCount=allOrders().filter(o=>canAdminSeeOrder(o) && matchesOwnerFilter(o) && !o.closedAt && o.onExchange && o.startOdometer==null).length;
  if(!state.adminExpandedGroups || typeof state.adminExpandedGroups!=='object') state.adminExpandedGroups={};
  const {groups:allGroups}=buildAdminShiftDayGroups(orders);
  const cal=ensureAdminOrdersCal();
  if(state._adminCalPendingExpand){
    const {a,b}=state._adminCalPendingExpand;
    allGroups.forEach(g=>{
      if(g.dayKey && g.dayKey>=a && g.dayKey<=b) state.adminExpandedGroups[g.id]=true;
    });
    state._adminCalPendingExpand=null;
  }
  const groups=adminOrdersFilterGroups(allGroups, cal);
  // Открытую смену раскрываем по умолчанию (один раз)
  groups.forEach(g=>{
    if(g.openShift && state.adminExpandedGroups[g.id]===undefined) state.adminExpandedGroups[g.id]=true;
  });
  const orderRowHtml=o=>{
    const m=metrics(o);
    const cells=[dateTime(o.createdAt), o.vehiclePlate, o.driverName, o.customer||'—', routeText(o), o.dayNumber, fmt(o.emptyKmBefore), fmt(o.loadedKm), fmt(o.emptyKmAfter), fmt(dayTotal(o)), fmt(o.fuelPricePerLiter), fmt(o.ratePerKmCash), fmt(o.rateWithVat), fmt(o.rateWithoutVat), fmt(o.rateCash), fmt(o.salaryBonus), fmt(m.fuelLitersCalc), fmt(m.costPerKmNoVat), fmt(m.fuelCostCalc), fmt(o.vehicleRent), fmt(m.cushion), fmt(m.netProfit), o.sequentialNumber];
    return `<tr class="group-detail" data-id="${o.id}"><td>${adminOrderPickHtml(o)}</td><td><button type="button" class="open-rates" data-id="${o.id}" style="background:var(--accent);color:#fff;border:0;border-radius:8px;padding:6px 8px;font-weight:700;cursor:pointer">Ставки</button></td>${cells.map(v=>`<td title="${esc(v)}">${esc(v)}</td>`).join('')}</tr>`;
  };
  const head=COLS.map(c=>`<th>${c}</th>`).join('');
  let tableRows='';
  groups.forEach(g=>{
    const open=!!state.adminExpandedGroups[g.id];
    const t=g.totals;
    const sumCells=[
      g.dayLabel,
      g.vehiclePlate,
      g.driverName,
      `${t.count} зак.`,
      `${g.openShift?'Смена':'Итог'} · ЗП ${fmt(t.pay)} ₽`,
      t.count,
      fmt(t.emptyKmBefore),
      fmt(t.loadedKm),
      fmt(t.emptyKmAfter),
      fmt(t.km),
      fmt(t.fuelPriceAvg),
      fmt(t.ratePerKmCashAvg),
      fmt(t.rateWithVat),
      fmt(t.rateWithoutVat),
      fmt(t.revenue),
      fmt(t.bonus),
      fmt(t.fuelLiters),
      fmt(t.costPerKmNoVatAvg),
      fmt(t.fuel),
      fmt(t.rent),
      fmt(t.cushion),
      fmt(t.profit),
      t.count
    ];
    tableRows+=`<tr class="group-total" data-group="${esc(g.id)}" title="Нажмите, чтобы ${open?'свернуть':'развернуть'} заказы">
      <td></td>
      <td><span class="tog">${open?'▼':'▶'}</span> ${g.openShift?'Смена':'Итог'}</td>
      ${sumCells.map(v=>`<td title="${esc(v)}">${esc(v)}</td>`).join('')}
    </tr>`;
    if(open) tableRows+=g.orders.map(orderRowHtml).join('');
  });
  const groupCards=groups.map(adminGroupCardHtml).join('');
  const filtOrders=groups.flatMap(g=>g.orders);
  const periodTot=sumOrderMoney(filtOrders);
  const periodLabel=adminOrdersPeriodLabel(cal);
  const headHint=`Сводка: ${esc(periodLabel)}. Группы по дню — нажмите карточку.`;
  const calHtml=adminOrdersCalHtml(allGroups);
  const filtersHtml=adminOrdersFiltersHtml(allGroups);
  const statsHtml=`<div class="orders-board-head">
    <p class="cat-panel-hint">${headHint}${exCount?` На бирже: <strong>${exCount}</strong>.`:''}</p>
    ${adminOrdersBulkBarHtml()}
    <div class="board-metrics">
      <div class="m"><span>Заказы</span><b>${periodTot.count}</b></div>
      <div class="m"><span>Выручка</span><b>${fmt(periodTot.revenue)} ₽</b></div>
      <div class="m"><span>ЗП</span><b>${fmt(periodTot.pay)} ₽</b></div>
    </div>
  </div>`;
  const emptyMsg=(cal.driver||cal.plate)?'Нет заявок по фильтру':'Нет заявок за выбранные дни';
  const listBody=groups.length
    ? `<div class="admin-cards">${groupCards}</div>
    <div class="hint admin-desktop-only" style="padding:0 16px">Таблица — те же группы.</div>
    <div class="table-wrap admin-desktop-only" style="padding:8px 0 24px"><table class="admin"><thead><tr><th></th><th></th>${head}</tr></thead><tbody>${tableRows||'<tr><td colspan="25">Нет строк</td></tr>'}</tbody></table></div>`
    : `<div class="empty">${emptyMsg}</div>`;
  $('admin-list').innerHTML=`
    ${calHtml}
    ${filtersHtml}
    ${statsHtml}
    ${listBody}`;
  const prev=$('admin-cal-prev');
  const next=$('admin-cal-next');
  const reset=$('admin-cal-reset');
  if(prev) prev.onclick=()=>{ const c=ensureAdminOrdersCal(); c.month--; if(c.month<0){ c.month=11; c.year--; } if(!c.from) c.showAll=false; renderAdmin(); };
  if(next) next.onclick=()=>{ const c=ensureAdminOrdersCal(); c.month++; if(c.month>11){ c.month=0; c.year++; } if(!c.from) c.showAll=false; renderAdmin(); };
  if(reset) reset.onclick=()=>{ const c=ensureAdminOrdersCal(); c.from=null; c.to=null; c.showAll=true; renderAdmin(); };
  const drvSel=$('admin-cal-driver');
  const plateSel=$('admin-cal-plate');
  const filtReset=$('admin-cal-filters-reset');
  if(drvSel) drvSel.onchange=()=>{ const c=ensureAdminOrdersCal(); c.driver=drvSel.value||''; renderAdmin(); };
  if(plateSel) plateSel.onchange=()=>{ const c=ensureAdminOrdersCal(); c.plate=plateSel.value||''; renderAdmin(); };
  if(filtReset) filtReset.onclick=()=>{ const c=ensureAdminOrdersCal(); c.driver=''; c.plate=''; renderAdmin(); };
  document.querySelectorAll('#admin-list [data-admin-cal-day]').forEach(btn=>{
    btn.onclick=e=>{ e.stopPropagation(); adminOrdersSelectDay(btn.dataset.adminCalDay); };
  });
  const toggleGroup=id=>{
    state.adminExpandedGroups[id]=!state.adminExpandedGroups[id];
    renderAdmin();
  };
  document.querySelectorAll('#admin-list tr.group-total[data-group]').forEach(tr=>{
    tr.onclick=e=>{ e.stopPropagation(); toggleGroup(tr.dataset.group); };
  });
  document.querySelectorAll('#admin-list [data-group-card]').forEach(card=>{
    card.onclick=e=>{
      if(e.target.closest('button,a,input,select,textarea')) return;
      toggleGroup(card.dataset.groupCard);
    };
  });
  document.querySelectorAll('#admin-list .open-rates').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); openDetail(b.dataset.id); });
  document.querySelectorAll('#admin-list .copy-order').forEach(b=>b.onclick=(e)=>{
    e.stopPropagation();
    openAdminCreateScreen({ fromOrderId:b.dataset.id });
  });
  document.querySelectorAll('#admin-list tr[data-id]').forEach(tr=>tr.onclick=e=>{
    if(e.target.closest('.order-pick,input')) return;
    openDetail(tr.dataset.id);
  });
  document.querySelectorAll('#admin-list .go-exchange').forEach(b=>b.onclick=(e)=>{
    e.stopPropagation();
    setAdminNav('exchange');
  });
  document.querySelectorAll('#admin-list .pub-exchange').forEach(b=>b.onclick=(e)=>{
    e.stopPropagation();
    publishToExchange(b.dataset.id);
  });
  document.querySelectorAll('#admin-list .in-book-ok').forEach(b=>b.onclick=(e)=>{
    e.stopPropagation();
    confirmOrderBooking(b.dataset.id);
  });
  document.querySelectorAll('#admin-list .in-book-no').forEach(b=>b.onclick=(e)=>{
    e.stopPropagation();
    rejectOrderBooking(b.dataset.id);
  });
  document.querySelectorAll('#admin-list .ret-exchange').forEach(b=>b.onclick=(e)=>{
    e.stopPropagation();
    returnOrderToExchange(b.dataset.id);
  });
  document.querySelectorAll('#admin-list .cancel-order').forEach(b=>b.onclick=(e)=>{
    e.stopPropagation();
    if(!confirm('Отменить этот заказ? Он пропадёт из «Назначен» / «В работе».')) return;
    if(cancelOrder(b.dataset.id, 'Отменён из списка')) renderAdmin();
  });
  wireAdminOrderDeleteUi(filtOrders);
}
function fillCreateFleetSelects(){
  const coId=(($('create-own-company')||{}).value)||'';
  const co=findCompanyById(coId);
  const firm=co?co.name:'фирмы';
  const vehList=fleetVehiclesForCompany(coId);
  const drvList=fleetDriversForCompany(coId);
  const plateEl=$('create-plate');
  const drvEl=$('create-driver');
  if(plateEl){
    plateEl.innerHTML=vehList.length
      ? vehList.map(v=>`<option value="${esc(v.plate)}">${esc(v.plate)}</option>`).join('')
      : `<option value="">— нет авто у «${esc(firm)}» —</option>`;
  }
  if(drvEl){
    drvEl.innerHTML=drvList.length
      ? drvList.map(d=>`<option value="${esc(d.name)}">${esc(d.name)}${d.phone?' · '+esc(d.phone):''}</option>`).join('')
      : `<option value="">— нет водителя у «${esc(firm)}» —</option>`;
  }
  const hint=$('create-fleet-hint');
  if(hint){
    hint.textContent=co
      ? `Парк «${firm}»: авто ${vehList.length}, водителей ${drvList.length}`
      : 'Сначала выберите нашу фирму — затем авто и водителя из её парка';
  }
}
function fillCreateSelects(){
  const preferred=(currentOwnCompany()||{}).id;
  fillOwnCompanySelect('create-own-company', preferred);
  const ownEl=$('create-own-company');
  if(ownEl){
    ownEl.onchange=()=>{
      fillCreateFleetSelects();
      fillCreateRouteTemplateSelect('');
      if(typeof fillExecutorUI==='function') fillExecutorUI();
      if(typeof updateCreatePricePreview==='function') updateCreatePricePreview();
    };
  }
  fillCreateFleetSelects();
}
function ownCompanies(){ return companiesByRole('own'); }
function fillOwnCompanySelect(elId, selectedId){
  const el=$(elId); if(!el) return;
  const list=ownCompanies();
  if(!list.length){
    el.innerHTML=`<option value="">— добавьте нашу фирму в Справочниках —</option>`;
    return;
  }
  const sel=selectedId||list[0].id;
  el.innerHTML=list.map(c=>`<option value="${esc(c.id)}" ${c.id===sel?'selected':''}>${esc(c.name)}</option>`).join('');
}
function roleLabels(c){
  return [
    companyHasRole(c,'own')?'Наша фирма':'',
    companyHasRole(c,'customer')?'Заказчик':'',
    companyHasRole(c,'carrier')?'Перевозчик':''
  ].filter(Boolean).join(' · ');
}
let createDay=1;
function orderAddressByKind(o, kind){
  if(!o) return '';
  if(kind==='loading' && o.loadingAddress) return String(o.loadingAddress).trim();
  if(kind==='unloading' && o.unloadingAddress) return String(o.unloadingAddress).trim();
  const pts=Array.isArray(o.routePoints)?o.routePoints:[];
  const hit=pts.find(p=>p&&p.address&&p.kind===kind);
  return hit?String(hit.address).trim():'';
}
function ordersForCopyTemplate(){
  return allOrders().filter(o=>o&&o.id&&canAdminSeeOrder(o)&&matchesOwnerFilter(o)&&!o.cancelledAt);
}
function fillCreateCopySelect(selectedId){
  const sel=$('create-copy-from');
  if(!sel) return;
  const cur=selectedId!=null?selectedId:sel.value;
  const list=ordersForCopyTemplate().slice(0,100);
  sel.innerHTML=`<option value="">— новый заказ —</option>`+
    list.map(o=>{
      const route=typeof routeText==='function'?routeText(o):'';
      const cust=String(o.customer||'—').trim();
      const tail=route?` · ${route}`:'';
      const label=`№${o.sequentialNumber||'—'} · ${cust}${tail}`.slice(0,120);
      return `<option value="${esc(o.id)}">${esc(label)}</option>`;
    }).join('');
  if(cur && list.some(o=>o.id===cur)) sel.value=cur;
  else if(!cur) sel.value='';
}
function createFormSpaceId(){
  const ownCo=findCompanyById((($('create-own-company')||{}).value)||'');
  return (ownCo&&ownCo.spaceId)||currentSpaceId();
}
function fillCreateRouteTemplateSelect(selectedId){
  const sel=$('create-route-template');
  if(!sel) return;
  const spaceId=createFormSpaceId();
  const list=typeof routeTemplatesForSpace==='function'?routeTemplatesForSpace(spaceId):[];
  const cur=selectedId!=null?selectedId:sel.value;
  sel.innerHTML=`<option value="">— выберите шаблон —</option>`+
    list.map(t=>{
      const route=`${t.loadingAddress} → ${t.unloadingAddress}`.slice(0,90);
      return `<option value="${esc(t.id)}">${esc(t.name)} · ${esc(route)}</option>`;
    }).join('');
  if(cur && list.some(t=>t.id===cur)) sel.value=cur;
  else sel.value='';
}
function applyRouteTemplateToCreateForm(templateId){
  const spaceId=createFormSpaceId();
  const tpl=(typeof routeTemplatesForSpace==='function'?routeTemplatesForSpace(spaceId):[])
    .find(t=>t.id===templateId);
  if(!tpl){ alert('Шаблон не найден'); return; }
  const set=(id,v)=>{ const el=$(id); if(el) el.value=v!=null&&v!==''?String(v):''; };
  set('create-load', tpl.loadingAddress);
  set('create-unload', tpl.unloadingAddress);
  ['create-load','create-unload'].forEach(id=>{ const el=$(id); if(el){ delete el.dataset.lat; delete el.dataset.lon; } });
  set('create-loading-contact-name', tpl.loadingContactName);
  set('create-loading-contact-phone', tpl.loadingContactPhone);
  set('create-unloading-contact-name', tpl.unloadingContactName);
  set('create-unloading-contact-phone', tpl.unloadingContactPhone);
  const hint=$('create-route-template-hint');
  if(hint) hint.textContent=`Шаблон «${tpl.name}» — проверьте адреса и контакты.`;
  if(typeof scheduleCreateRouteEstimate==='function') scheduleCreateRouteEstimate();
  if(typeof updateCreatePricePreview==='function') updateCreatePricePreview();
}
function saveRouteTemplateFromCreateForm(){
  const spaceId=createFormSpaceId();
  if(!spaceId){ alert('Сначала выберите нашу фирму'); return; }
  const load=(($('create-load')||{}).value||'').trim();
  const unload=(($('create-unload')||{}).value||'').trim();
  if(!load||!unload){ alert('Заполните адреса загрузки и выгрузки'); return; }
  const autoName=`${load.split(/[,\n]/)[0].trim()} → ${unload.split(/[,\n]/)[0].trim()}`.slice(0,80);
  const name=String(prompt('Название шаблона маршрута', autoName)||'').trim();
  if(!name) return;
  const existing=(typeof routeTemplatesForSpace==='function'?routeTemplatesForSpace(spaceId):[])
    .find(t=>String(t.name).toLowerCase()===name.toLowerCase());
  const res=typeof upsertRouteTemplate==='function'?upsertRouteTemplate(spaceId, {
    id:existing?existing.id:undefined,
    name,
    loadingAddress:load,
    unloadingAddress:unload,
    loadingContactName:(($('create-loading-contact-name')||{}).value||'').trim(),
    loadingContactPhone:(($('create-loading-contact-phone')||{}).value||'').trim(),
    unloadingContactName:(($('create-unloading-contact-name')||{}).value||'').trim(),
    unloadingContactPhone:(($('create-unloading-contact-phone')||{}).value||'').trim()
  }):{ok:false, message:'Функция недоступна'};
  if(!res.ok){ alert(res.message||'Не удалось сохранить'); return; }
  fillCreateRouteTemplateSelect(res.template.id);
  const hint=$('create-route-template-hint');
  if(hint) hint.textContent=`Сохранён шаблон «${name}». Доступен при создании заказов этой фирмы.`;
}
function deleteSelectedRouteTemplate(){
  const sel=$('create-route-template');
  const id=sel&&sel.value;
  if(!id){ alert('Выберите шаблон для удаления'); return; }
  const spaceId=createFormSpaceId();
  const tpl=(typeof routeTemplatesForSpace==='function'?routeTemplatesForSpace(spaceId):[]).find(t=>t.id===id);
  if(!tpl){ alert('Шаблон не найден'); return; }
  if(!confirm(`Удалить шаблон «${tpl.name}»?`)) return;
  const res=typeof deleteRouteTemplate==='function'?deleteRouteTemplate(spaceId, id):{ok:false};
  if(!res.ok){ alert(res.message||'Не удалось удалить'); return; }
  fillCreateRouteTemplateSelect('');
  const hint=$('create-route-template-hint');
  if(hint) hint.textContent='Типовые маршруты фирмы — быстрее, чем копировать из прошлого заказа.';
}
function resetCreateFormFields(){
  if($('create-exec-mode')){
    const co=currentOwnCompany();
    const hasPark=typeof companyHasOwnPark==='function' && companyHasOwnPark(co);
    const dispatcher=typeof isDispatcherCompany==='function' && isDispatcherCompany(co);
    $('create-exec-mode').value=hasPark?'own':(dispatcher?'exchange':'carrier');
  }
  ['create-customer','create-contact-name','create-contact-phone','create-load','create-unload',
    'create-loading-contact-name','create-loading-contact-phone','create-unloading-contact-name','create-unloading-contact-phone',
    'create-req-pay','create-req-l','create-req-w','create-req-h','create-customer-inn','create-cargo-desc',
    'create-price-client','create-price-carrier','create-vehicle-date','create-vehicle-time'].forEach(id=>{
    const el=$(id);
    if(el) el.value='';
  });
  ['create-load','create-unload'].forEach(id=>{
    const el=$(id);
    if(el){ delete el.dataset.lat; delete el.dataset.lon; }
  });
  const cargoKindEl=$('create-cargo-kind'); if(cargoKindEl) cargoKindEl.value='';
  if($('create-customer-inn-status')) $('create-customer-inn-status').textContent='';
  if($('create-copy-hint')) $('create-copy-hint').textContent='Выберите заказ — подставим заказчика, маршрут, груз и цены. Дату подачи и водителя укажите заново.';
  if($('create-route-template-hint')) $('create-route-template-hint').textContent='Типовые маршруты фирмы — быстрее, чем копировать из прошлого заказа.';
  const routeTpl=$('create-route-template'); if(routeTpl) routeTpl.value='';
  if($('create-error')) $('create-error').textContent='';
  if(typeof resetCreatePriceState==='function') resetCreatePriceState();
  if(typeof fillCreateCargoKindSelect==='function') fillCreateCargoKindSelect();
  createDay=1;
  highlightDay();
}
function fillCreateFormFromOrder(o){
  if(!o) return;
  if(o.dayNumber>=1&&o.dayNumber<=5) createDay=+o.dayNumber;
  highlightDay();
  const ownEl=$('create-own-company');
  if(ownEl && o.ownCompanyId) ownEl.value=o.ownCompanyId;
  fillCreateFleetSelects();
  const set=(id,v)=>{ const el=$(id); if(el) el.value=v!=null&&v!==''?String(v):''; };
  set('create-customer', o.customer||'');
  set('create-customer-inn', o.customerInn||'');
  set('create-contact-name', o.contactName||'');
  set('create-contact-phone', o.contactPhone||'');
  set('create-load', orderAddressByKind(o,'loading'));
  set('create-unload', orderAddressByKind(o,'unloading'));
  ['create-load','create-unload'].forEach(id=>{ const el=$(id); if(el){ delete el.dataset.lat; delete el.dataset.lon; } });
  set('create-loading-contact-name', o.loadingContactName||'');
  set('create-loading-contact-phone', o.loadingContactPhone||'');
  set('create-unloading-contact-name', o.unloadingContactName||'');
  set('create-unloading-contact-phone', o.unloadingContactPhone||'');
  set('create-cargo-desc', o.cargoDescription||'');
  if($('create-cargo-kind')) $('create-cargo-kind').value=o.cargoKind||'';
  set('create-req-pay', o.reqPayloadTons??'');
  set('create-req-l', o.reqLengthM??'');
  set('create-req-w', o.reqWidthM??'');
  set('create-req-h', o.reqHeightM??'');
  const clientEl=$('create-price-client');
  const carrierEl=$('create-price-carrier');
  const clientAmt=o.priceForClient??o.rateCash??null;
  const carrierAmt=o.priceForCarrier??null;
  if(clientEl && clientAmt!=null && clientAmt>0){ clientEl.value=String(Math.round(clientAmt)); clientEl.dataset.auto='1'; }
  if(carrierEl && carrierAmt!=null && carrierAmt>0){ carrierEl.value=String(Math.round(carrierAmt)); carrierEl.dataset.auto='1'; }
  let mode='own';
  if(o.onExchange || o.executorType==='exchange') mode='exchange';
  else if(o.executorType==='carrier' || (o.carrierCompanyId && o.executorType!=='own')) mode='carrier';
  const execEl=$('create-exec-mode');
  if(execEl) execEl.value=mode;
  const carEl=$('create-carrier-company');
  if(carEl && o.carrierCompanyId) carEl.value=o.carrierCompanyId;
  fillExecutorUI();
  fillContactPickers(o.customer||'');
  fillCreateCopySelect(o.id);
  fillCreateRouteTemplateSelect('');
  const hint=$('create-copy-hint');
  if(hint) hint.textContent=`Скопировано с заказа №${o.sequentialNumber||'—'}. Проверьте дату подачи, водителя и цены.`;
  if(typeof scheduleCreateRouteEstimate==='function') scheduleCreateRouteEstimate();
  if(typeof updateCreatePricePreview==='function') updateCreatePricePreview();
  updateCreateFreeHint();
}
async function openAdminCreateScreen(opts){
  if(!currentAdmin){ fillAdminLoginSelect(); show('admin-pin'); return; }
  const g=await billingGuardCurrentAdminWithServer('create_order');
  if(!g.ok){ alert(g.message); return; }
  const fromOrderId=opts&&opts.fromOrderId;
  resetCreateFormFields();
  fillCreateSelects();
  fillCustomerPickers();
  fillCreateRouteTemplateSelect('');
  if(fromOrderId){
    const src=(state.orders||[]).find(x=>x.id===fromOrderId);
    if(src){
      if(!canAdminSeeOrder(src)){ alert('Нет доступа к этому заказу'); return; }
      fillCreateFormFromOrder(src);
    } else fillCreateCopySelect('');
  }else{
    fillAddressPickers('');
    fillContactPickers('');
    fillCreateCopySelect('');
  }
  fillExecutorUI();
  wireVehicleAtHint('create');
  wireCreateCustomerInn();
  if(typeof wireCreateAddressFields==='function') wireCreateAddressFields();
  if(typeof wireCreatePricePreview==='function') wireCreatePricePreview();
  if(typeof updateCreatePricePreview==='function') updateCreatePricePreview();
  show('admin-create');
  highlightDay();
  const createScroll=document.querySelector('#admin-create .admin-form-scroll');
  if(createScroll) createScroll.scrollTop=0;
}
function bindAdminCreate(){
  $('admin-new').onclick=()=>openAdminCreateScreen();
  $('create-back').onclick=()=>{ show('admin'); renderAdmin(); };
  document.querySelectorAll('[data-cday]').forEach(b=>b.onclick=()=>{ createDay=+b.dataset.cday; highlightDay(); });
  $('create-save').onclick=saveDispatcherOrder;
  const copySel=$('create-copy-from');
  if(copySel && !copySel._wired){
    copySel._wired=true;
    copySel.onchange=()=>{
      const id=copySel.value;
      if(!id){
        resetCreateFormFields();
        fillCreateSelects();
        fillCustomerPickers();
        fillAddressPickers('');
        fillContactPickers('');
        fillCreateRouteTemplateSelect('');
        fillExecutorUI();
        if(typeof updateCreatePricePreview==='function') updateCreatePricePreview();
        updateCreateFreeHint();
        return;
      }
      const o=(state.orders||[]).find(x=>x.id===id);
      if(o) fillCreateFormFromOrder(o);
    };
  }
  const routeTplSel=$('create-route-template');
  if(routeTplSel && !routeTplSel._wired){
    routeTplSel._wired=true;
    routeTplSel.onchange=()=>{
      if(routeTplSel.value) applyRouteTemplateToCreateForm(routeTplSel.value);
    };
  }
  const routeTplApply=$('create-route-template-apply');
  if(routeTplApply && !routeTplApply._wired){
    routeTplApply._wired=true;
    routeTplApply.onclick=()=>{
      const id=(routeTplSel&&routeTplSel.value)||'';
      if(!id){ alert('Выберите шаблон'); return; }
      applyRouteTemplateToCreateForm(id);
    };
  }
  const routeTplSave=$('create-route-template-save');
  if(routeTplSave && !routeTplSave._wired){
    routeTplSave._wired=true;
    routeTplSave.onclick=saveRouteTemplateFromCreateForm;
  }
  const routeTplDel=$('create-route-template-del');
  if(routeTplDel && !routeTplDel._wired){
    routeTplDel._wired=true;
    routeTplDel.onclick=deleteSelectedRouteTemplate;
  }
}
function highlightDay(){
  document.querySelectorAll('[data-cday]').forEach(b=>{
    const on=+b.dataset.cday===createDay;
    b.classList.toggle('on', on);
    b.style.background=on?'var(--accent)':'var(--field)';
    b.style.color=on?'#fff':'var(--text)';
  });
}
function saveDispatcherOrder(){
  const load=($('create-load').value||'').trim(); const unload=($('create-unload').value||'').trim();
  const customer=($('create-customer').value||'').trim();
  const contactName=($('create-contact-name').value||'').trim();
  const contactPhone=formatPhone(($('create-contact-phone').value||'').trim());
  const loadingContactName=(($('create-loading-contact-name')||{}).value||'').trim();
  const loadingContactPhone=formatPhone((($('create-loading-contact-phone')||{}).value||'').trim());
  const unloadingContactName=(($('create-unloading-contact-name')||{}).value||'').trim();
  const unloadingContactPhone=formatPhone((($('create-unloading-contact-phone')||{}).value||'').trim());
  const mode=($('create-exec-mode').value||'own');
  const vehicleAt=readVehicleAtFromDom('create');
  if(!load||!unload){ $('create-error').textContent='Заполните оба адреса'; return; }
  if(!customer){ $('create-error').textContent='Укажите заказчика'; return; }
  if(!vehicleAt){ $('create-error').textContent='Укажите дату и время подачи ТС'; return; }
  const ownCo=findCompanyById((($('create-own-company')||{}).value)||'');
  if(!ownCo || !companyHasRole(ownCo,'own')){ $('create-error').textContent='Выберите нашу фирму'; return; }
  if(!isSuperAdmin()){
    const myCo=currentOwnCompany();
    if(myCo && ownCo.id!==myCo.id){ $('create-error').textContent='Можно создавать заявку только от своей фирмы'; return; }
  }
  let plate=''; let driver=''; let onExchange=false;
  let carrierCompanyId=null, carrierDriverId=null, carrierVehicleId=null, carrierCompanyName='';
  let driverPercentVal=0;
  const carrierCo=findCompanyById((($('create-carrier-company')||{}).value)||'');
  if(carrierCo && companyHasRole(carrierCo,'carrier')){
    carrierCompanyId=carrierCo.id;
    carrierCompanyName=carrierCo.name;
    const drv=(carrierCo.drivers||[]).find(d=>d.id===(($('create-carrier-driver')||{}).value));
    const veh=(carrierCo.vehicles||[]).find(v=>v.id===(($('create-carrier-vehicle')||{}).value));
    if(drv) carrierDriverId=drv.id;
    if(veh) carrierVehicleId=veh.id;
  }
  let driverPhoneVal='';
  if(mode==='own'){
    plate=(($('create-plate')||{}).value||'').trim();
    driver=(($('create-driver')||{}).value||'').trim();
    if(!plate){ $('create-error').textContent='Выберите автомобиль из парка фирмы'; return; }
    if(!driver){ $('create-error').textContent='Выберите водителя из парка фирмы'; return; }
    if(!fleetVehiclesForCompany(ownCo.id).some(v=>v.plate===plate)){
      $('create-error').textContent=`Авто ${plate} не относится к «${ownCo.name}»`; return;
    }
    if(!fleetDriversForCompany(ownCo.id).some(d=>samePersonName(d.name,driver))){
      $('create-error').textContent=`Водитель ${driver} не относится к «${ownCo.name}»`; return;
    }
    driverPercentVal=driverPercent(driver, ownCo.id);
    driverPhoneVal=driverPhone(driver, ownCo.id);
  } else if(mode==='carrier'){
    if(!carrierCo){ $('create-error').textContent='Выберите перевозчика'; return; }
    const drv=(carrierCo.drivers||[]).find(d=>d.id===carrierDriverId);
    const veh=(carrierCo.vehicles||[]).find(v=>v.id===carrierVehicleId);
    if(!drv){ $('create-error').textContent='Выберите водителя перевозчика'; return; }
    if(!veh){ $('create-error').textContent='Выберите ТС перевозчика'; return; }
    driver=`[Перевозчик] ${drv.name}`;
    plate=veh.plate;
    driverPercentVal=0;
    driverPhoneVal=formatPhone(drv.phone||'');
  } else if(mode==='exchange'){
    onExchange=true;
    driver='Биржа';
    plate='—';
    driverPercentVal=0;
  }
  const reqs=readOrderRequirementsFromCreate();
  const cargo=typeof readCreateCargoFromForm==='function'?readCreateCargoFromForm():{};
  if(mode==='exchange' && !(reqs.reqPayloadTons>0)){
    $('create-error').textContent='Для биржи укажите грузоподъёмность (т) в требованиях к ТС'; return;
  }
  if(mode==='own'){
    const veh=fleetVehiclesForCompany(ownCo.id).find(v=>v.plate===plate);
    if(veh && !vehicleFitsOrder(veh, reqs)){
      $('create-error').textContent='Выбранное авто меньше требований к ТС'; return;
    }
  }
  const seqNo=nextSequentialNumber();
  if(!currentAdmin){ $('create-error').textContent='Войдите как администратор'; return; }
  const orderSpaceId=ownCo.spaceId || currentAdmin.spaceId || null;
  const createAction=mode==='exchange'?'publish_exchange':'create_order';
  billingGuardWithServer(orderSpaceId, createAction).then(g=>{
    if(!g.ok){ $('create-error').textContent=g.message; return; }
    saveDispatcherOrderAfterBillingGuard(seqNo, ownCo, orderSpaceId, mode, load, unload, customer, contactName, contactPhone, loadingContactName, loadingContactPhone, unloadingContactName, unloadingContactPhone, plate, driver, driverPhoneVal, driverPercentVal, carrierCompanyId, carrierDriverId, carrierVehicleId, carrierCompanyName, vehicleAt, reqs, onExchange);
  });
}
function saveDispatcherOrderAfterBillingGuard(seqNo, ownCo, orderSpaceId, mode, load, unload, customer, contactName, contactPhone, loadingContactName, loadingContactPhone, unloadingContactName, unloadingContactPhone, plate, driver, driverPhoneVal, driverPercentVal, carrierCompanyId, carrierDriverId, carrierVehicleId, carrierCompanyName, vehicleAt, reqs, onExchange){
  const spaceAdm=(state.admins||[]).find(a=>a.spaceId && a.spaceId===orderSpaceId) || currentAdmin;
  const customerInn=String((($('create-customer-inn')||{}).value||'')).replace(/\D/g,'');
  const priceForClient=numOrNull(($('create-price-client')||{}).value);
  const priceForCarrier=numOrNull(($('create-price-carrier')||{}).value);
  const draft=typeof buildCreateDraftFromForm==='function'?buildCreateDraftFromForm():null;
  const quote=typeof suggestDispatcherOrderPrice==='function'&&draft?suggestDispatcherOrderPrice(draft):null;
  const carrier=typeof createCarrierForPrice==='function'&&draft?createCarrierForPrice(draft):ownCo;
  const payForm=typeof customerCarrierPaymentForm==='function'?customerCarrierPaymentForm(carrier):'withoutVat';
  const offered=priceForClient!=null&&priceForClient>0?priceForClient:(quote&&quote.minimumCash>0?Math.round(quote.minimumCash):null);
  const company=upsertCompany({name:customer, inn:customerInn, roles:['customer'], spaceId:orderSpaceId});
  const order={
    id:uuid(), sequentialNumber:seqNo, dayNumber:createDay,
    createdAt:new Date().toISOString(), source:'dispatcher',
    ownerAdminId:spaceAdm.id,
    ownerAdminName:spaceAdm.name,
    spaceId:orderSpaceId,
    vehiclePlate:plate, driverName:driver, driverPhone:driverPhoneVal||'',
    customer,
    customerInn:customerInn||(company&&company.inn)||'',
    customerId:company?company.id:null,
    priceForClient:offered,
    priceForCarrier:priceForCarrier!=null&&priceForCarrier>0?priceForCarrier:null,
    ownCompanyId:ownCo.id,
    ownCompanyName:ownCo.name,
    contactName, contactPhone, contactPersonId:null,
    loadingContactName, loadingContactPhone,
    unloadingContactName, unloadingContactPhone,
    vehicleAt,
    loadingAddress:load, unloadingAddress:unload,
    routePoints:defaultRoutePoints(load,unload), startOdometer:null,
    driverPercent:driverPercentVal,
    executorType:mode, onExchange,
    exchangeListedAt:onExchange?new Date().toISOString():null,
    wasOnExchange:onExchange||false,
    carrierCompanyId, carrierDriverId, carrierVehicleId, carrierCompanyName,
    reqPayloadTons:reqs.reqPayloadTons,
    reqLengthM:reqs.reqLengthM,
    reqWidthM:reqs.reqWidthM,
    reqHeightM:reqs.reqHeightM,
    cargoDescription:cargo.cargoDescription||'',
    cargoKind:cargo.cargoKind||null,
    tripMode:draft&&draft.tripMode||(quote&&quote.tripMode)||null,
    routeKm:draft&&draft.routeKm||(quote&&quote.routeKm)||null,
    estimateKm:draft&&draft.routeKm||(quote&&quote.routeKm)||null,
    estimateWorkHours:draft&&draft.estimateWorkHours||null,
    paymentForm:payForm,
    transportApp:null,
    partnerSpaceId:null,
    executorAdminId:null
  };
  if(offered){
    const t=fillRatesFrom(payForm, offered);
    order.rateWithoutVat=t.withoutVat;
    order.rateWithVat=t.withVat;
    order.rateCash=t.cash;
    order.freight=payForm==='withVat'?t.withVat:(payForm==='withoutVat'?t.withoutVat:t.cash);
    if(!order.priceForCarrier&&quote&&quote.logistFeePercent>0&&mode==='exchange'){
      order.priceForCarrier=Math.round(offered/(1+quote.logistFeePercent/100));
    }
  }
  if(shouldCheckDriverDocs(driver)&&plate&&plate!=='—'){
    const drvRec=findDriverRecord(driver, ownCo.id);
    if(typeof confirmIfDriverDocsIncomplete==='function'&&!confirmIfDriverDocsIncomplete(drvRec, driver)) return;
  }
  stampOrderDriverPhone(order);
  if(typeof syncOrderDriverVehicleDocs==='function') syncOrderDriverVehicleDocs(order);
  if(typeof syncOrderDocsOnAssign==='function') syncOrderDocsOnAssign(order);
  ensureRoutePoints(order);
  applyOrderSchedule(order);
  upsertOrder(order);
  show('admin'); renderAdmin();
}

/* Документооборот — order-documents.js */

function openDetail(id){
  state.detailId=id;
  const o=state.orders.find(x=>x.id===id); if(!o) return;
  if(typeof isLogistInboxOrder==='function' && isLogistInboxOrder(o)) markAdminInboxOrdersSeen([o]);
  if(!canAdminSeeOrder(o)){ alert('Чужой заказ — нет доступа'); show('admin'); renderAdmin(); return; }
  recomputeOrderTimes(ensureOrderTimeStamps(o));
  const m=metrics(o);
  let editPoints=ensureRoutePoints(o).map(p=>({...p}));
  const readPointsFromDom=()=>{
    const rows=[...document.querySelectorAll('#route-editor [data-route-row]')];
    if(!rows.length) return editPoints.map(p=>({...p}));
    return rows.map(row=>{
      const i=+row.dataset.routeRow;
      const address=((row.querySelector('[data-route-addr]')||{}).value||'').trim();
      const kindSel=row.querySelector('[data-route-kind]');
      const kind=(kindSel&&kindSel.value==='unloading')?'unloading':'loading';
      const prev=editPoints[i]||{};
      return {id:prev.id||uuid(),address,kind};
    });
  };
  const suggestionsFor=(kind)=>{
    const name=(($('d-customer')||{}).value||'').trim();
    const c=findCustomer(name);
    if(!c) return [];
    return kind==='unloading'?(c.unloadingAddresses||[]):(c.loadingAddresses||[]);
  };
  const renderRouteEditor=()=>{
    const preview=editPoints.filter(p=>p.address).map(p=>`${kindTitle(p.kind)}: ${p.address}`).join(' → ');
    $('route-editor').innerHTML=`
      <div class="hint">У каждой точки тип «Загрузка» или «Выгрузка». Адреса заказчика запоминаются.</div>
      ${preview?`<div class="calc" style="margin:6px 0">${esc(preview)}</div>`:''}
      ${editPoints.map((p,i)=>{
        const sug=suggestionsFor(p.kind);
        return `
        <div data-route-row="${i}" style="margin-bottom:10px">
          <label>Точка ${i+1}</label>
          <select data-route-kind>
            <option value="loading" ${p.kind==='loading'?'selected':''}>Загрузка</option>
            <option value="unloading" ${p.kind==='unloading'?'selected':''}>Выгрузка</option>
          </select>
          <input data-route-addr value="${esc(p.address||'')}" placeholder="Город, улица, дом" />
          ${sug.length?`<select data-route-sug="${i}"><option value="">— сохранённые —</option>${sug.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('')}</select>`:''}
          <div class="row" style="margin:4px 0 0">
            <button type="button" class="secondary" data-route-up="${i}" ${i===0?'disabled':''}>↑</button>
            <button type="button" class="secondary" data-route-down="${i}" ${i>=editPoints.length-1?'disabled':''}>↓</button>
            ${editPoints.length>2?`<button type="button" class="secondary" data-route-del="${i}">Удалить</button>`:''}
          </div>
        </div>`;}).join('')}
      <div class="row">
        <button type="button" class="secondary" id="route-add-load">+ Загрузка</button>
        <button type="button" class="secondary" id="route-add-unload">+ Выгрузка</button>
      </div>
      <div class="error" id="route-error" style="display:none"></div>
    `;
    document.querySelectorAll('[data-route-sug]').forEach(sel=>{
      sel.onchange=()=>{
        const i=+sel.dataset.routeSug;
        if(!sel.value) return;
        editPoints=readPointsFromDom();
        editPoints[i].address=sel.value;
        renderRouteEditor();
      };
    });
    document.querySelectorAll('[data-route-kind]').forEach(sel=>{
      sel.onchange=()=>{ editPoints=readPointsFromDom(); renderRouteEditor(); };
    });
    const addKind=kind=>{
      editPoints=readPointsFromDom();
      const insertAt=Math.max(1, editPoints.length-1);
      editPoints.splice(insertAt, 0, {id:uuid(),address:'',kind});
      renderRouteEditor();
    };
    $('route-add-load').onclick=()=>addKind('loading');
    $('route-add-unload').onclick=()=>addKind('unloading');
    document.querySelectorAll('[data-route-up]').forEach(b=>b.onclick=()=>{
      const i=+b.dataset.routeUp;
      editPoints=readPointsFromDom();
      if(i<=0) return;
      const t=editPoints[i-1]; editPoints[i-1]=editPoints[i]; editPoints[i]=t;
      renderRouteEditor();
    });
    document.querySelectorAll('[data-route-down]').forEach(b=>b.onclick=()=>{
      const i=+b.dataset.routeDown;
      editPoints=readPointsFromDom();
      if(i>=editPoints.length-1) return;
      const t=editPoints[i+1]; editPoints[i+1]=editPoints[i]; editPoints[i]=t;
      renderRouteEditor();
    });
    document.querySelectorAll('[data-route-del]').forEach(b=>b.onclick=()=>{
      const i=+b.dataset.routeDel;
      editPoints=readPointsFromDom();
      if(editPoints.length<=2) return;
      editPoints.splice(i,1);
      renderRouteEditor();
    });
  };
  const detailTitle=$('detail-title');
  if(detailTitle) detailTitle.textContent=`Заявка №${o.sequentialNumber}`;
  const detailMeta=$('detail-meta');
  if(detailMeta){
    detailMeta.textContent=`${statusText(o)} · ${orderDayLabel(o.dayNumber)} · ${o.driverName||'—'}${m.percent!=null?` (${m.percent}%)`:''}`;
  }
  $('detail-form').innerHTML=`
    <div class="cust-form-blocks admin-order-blocks">
    <section class="form-section">
      <h2 class="form-section-title">Сводка</h2>
      <div class="metric-strip">
        <div class="m"><span>До заказа</span><b>${esc(formatDurationMin(o.timeToOrderMin))}</b></div>
        <div class="m"><span>С грузом</span><b>${esc(formatDurationMin(o.timeLoadedMin))}</b></div>
        <div class="m"><span>До стоянки</span><b>${esc(formatDurationMin(o.timeToParkingMin))}</b></div>
        <div class="m"><span>Всего</span><b>${esc(formatDurationMin(o.timeTotalMin))}</b></div>
      </div>
      <p class="form-section-hint">Тариф: пакет (часы + подача, в т.ч. N км) + сверхкм × ₽/км. Без НДС и с НДС — от нал.</p>
      ${o.transportApp?`<div class="claim-box">
        <h3>Договор‑заявка подписана</h3>
        <p>${esc(o.transportApp.customerCompanyName||'')} → ${esc(o.transportApp.carrierCompanyName||'')}</p>
        <p>Водитель: ${esc(o.transportApp.driverName||o.driverName)} · авто: ${esc(o.transportApp.vehiclePlate||o.vehiclePlate)}${orderDriverPhone(o)?` · ☎ ${esc(orderDriverPhone(o))}`:''}</p>
        <p class="hint">${o.transportApp.signedAt?esc(dateTime(o.transportApp.signedAt)):''}</p>
      </div>`:''}
    </section>
    ${orderDocsSectionHtml(o)}
    ${orderEtrnSectionHtml(o)}
    <section class="form-section">
      <h2 class="form-section-title">1. Заказчик и груз</h2>
      <div class="form-fields">
        <div class="form-pair">
          <div>
            <label for="d-driver-name">Водитель</label>
            <input id="d-driver-name" value="${esc(o.driverName||'')}" placeholder="ФИО водителя" />
          </div>
          <div>
            <label for="d-driver-phone">Телефон</label>
            <input id="d-driver-phone" inputmode="tel" value="${esc(orderDriverPhone(o))}" placeholder="+79650730002" />
          </div>
        </div>
        ${orderDriverPhone(o)?`<a class="hint" href="tel:${esc(orderDriverPhone(o))}" style="color:var(--accent)">Позвонить водителю</a>`:''}
        <div id="d-driver-docs-warn" hidden></div>
        <label for="d-own-company">От нашей фирмы</label>
        <select id="d-own-company">${ownCompanies().map(c=>`<option value="${esc(c.id)}" ${(o.ownCompanyId===c.id || (!o.ownCompanyId && o.ownCompanyName===c.name))?'selected':''}>${esc(c.name)}</option>`).join('')||`<option value="">— нет наших фирм —</option>`}</select>
        <label>Требования к ТС (т / Д×Ш×В)</label>
        <div class="row">
          <input id="d-req-pay" inputmode="decimal" placeholder="т" value="${o.reqPayloadTons??''}" style="flex:0 0 64px;text-align:center" />
          <input id="d-req-l" inputmode="decimal" placeholder="Д, м" value="${o.reqLengthM??''}" style="flex:1;text-align:center" />
          <input id="d-req-w" inputmode="decimal" placeholder="Ш, м" value="${o.reqWidthM??''}" style="flex:1;text-align:center" />
          <input id="d-req-h" inputmode="decimal" placeholder="В, м" value="${o.reqHeightM??''}" style="flex:1;text-align:center" />
        </div>
        <div class="form-pair">
          <div>
            <label for="d-body-type">Кузов</label>
            <select id="d-body-type">
              <option value="">— не указан —</option>
              ${(BODY_TYPES||[]).map(t=>`<option value="${esc(t.id)}" ${o.reqBodyType===t.id?'selected':''}>${esc(t.label)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label for="d-cargo-kind">Груз</label>
            <select id="d-cargo-kind">
              <option value="">— не указан —</option>
              ${(CARGO_KINDS||[]).map(t=>`<option value="${esc(t.id)}" ${o.cargoKind===t.id?'selected':''}>${esc(t.label)}</option>`).join('')}
            </select>
          </div>
        </div>
        <label for="d-cargo-desc">Описание груза (для документов)</label>
        <input id="d-cargo-desc" value="${esc(o.cargoDescription||'')}" placeholder="Паллеты, оборудование…" />
        <div class="form-triple">
          <div>
            <label for="d-cargo-places">Мест</label>
            <input id="d-cargo-places" inputmode="numeric" value="${o.cargoPlaces??''}" placeholder="8" />
          </div>
          <div>
            <label for="d-cargo-volume">Объём, м³</label>
            <input id="d-cargo-volume" inputmode="decimal" value="${o.cargoVolumeM3??''}" placeholder="12" />
          </div>
          <div>
            <label for="d-cargo-weight">Масса, кг</label>
            <input id="d-cargo-weight" inputmode="decimal" value="${o.cargoWeightKg??''}" placeholder="5000" />
          </div>
        </div>
        <div class="form-pair">
          <div>
            <label for="d-trip-mode">Рейс</label>
            <select id="d-trip-mode">
              <option value="city" ${o.tripMode!=='intercity'?'selected':''}>Город</option>
              <option value="intercity" ${o.tripMode==='intercity'?'selected':''}>Межгород</option>
            </select>
          </div>
          <div>
            <label for="d-route-km">Км по дороге</label>
            <input id="d-route-km" inputmode="numeric" value="${o.routeKm??''}" placeholder="авто" />
          </div>
        </div>
        <label for="d-customer-inn">ИНН заказчика</label>
        <div class="row" style="gap:8px;align-items:center">
          <input id="d-customer-inn" inputmode="numeric" maxlength="12" placeholder="10 или 12 цифр" style="flex:1" value="${esc(o.customerInn||(findCompanyById(o.customerId)||findCompanyByName(o.customer)||{}).inn||'')}" />
          <button type="button" class="secondary" id="d-customer-inn-lookup" style="width:auto;flex:0 0 auto;padding:8px 12px">Загрузить</button>
        </div>
        <div class="hint" id="d-customer-inn-status"></div>
        <label for="d-customer">Заказчик (наименование)</label>
        <input id="d-customer" value="${esc(o.customer||'')}" placeholder="Название компании" />
        <label for="d-carrier-company">Перевозчик</label>
        <select id="d-carrier-company"><option value="">— без перевозчика —</option>${companiesByRole('carrier').map(c=>`<option value="${esc(c.id)}" ${o.carrierCompanyId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
        <div class="form-pair">
          <div>
            <label for="d-contact-name">Контакт</label>
            <input id="d-contact-name" value="${esc(o.contactName||'')}" placeholder="ФИО" />
          </div>
          <div>
            <label for="d-contact-phone">Телефон контакта</label>
            <input id="d-contact-phone" inputmode="tel" value="${esc(formatPhone(o.contactPhone||''))}" placeholder="+79650730002" />
          </div>
        </div>
        <label for="d-vehicle-date">Подача ТС — дата</label>
        <input id="d-vehicle-date" lang="ru" placeholder="ДД.ММ.ГГГГ" inputmode="numeric" maxlength="10" value="${esc(toRuDateValue(o.vehicleAt))}" autocomplete="off" />
        <label for="d-vehicle-time">Подача ТС — время</label>
        <input id="d-vehicle-time" lang="ru" placeholder="ЧЧ:ММ" inputmode="numeric" maxlength="5" value="${esc(toTimeHmValue(o.vehicleAt))}" autocomplete="off" />
        <div class="hint" id="d-free-hint">Ориентир освобождения: ${o.vehicleAt?esc(formatRuDateTimeAt(o.freeAt||computeFreeAt(o.vehicleAt,o,financeForOrder(o))))+' (подача + часы работы)':'укажите подачу ТС'}</div>
        <h3 style="margin:12px 0 4px;font-size:.85rem">Цены</h3>
        <div class="form-pair">
          <div>
            <label for="d-price-client">Цена для заказчика, ₽</label>
            <input id="d-price-client" inputmode="decimal" value="${o.priceForClient??''}" placeholder="сумма" />
          </div>
          <div>
            <label for="d-price-carrier">Цена для перевозчика, ₽</label>
            <input id="d-price-carrier" inputmode="decimal" value="${o.priceForCarrier??''}" placeholder="сумма" />
          </div>
        </div>
        ${o.bookedPlate?`<p class="hint">${o.bookStatus==='confirmed'?'Бронь подтверждена':'Запрос брони'}: ${esc(o.bookedPlate)}${o.bookStatus==='confirmed'?' · в календаре на дату подачи':o.bookStatus==='requested'?' · ждут вашего подтверждения':o.bookStatus==='rejected'?' · отклонена':''}</p>`:''}
        ${o.fulfillment==='logist'?'<p class="hint">Срочно: заказчик просит закрыть как можно скорее, ставка логиста в цене.</p>':o.fulfillment==='direct'?'<p class="hint">Прямой парк, без срочной ставки логиста.</p>':''}
        ${typeof logistMarginLine==='function'&&logistMarginLine(o)?`<p class="hint">${esc(logistMarginLine(o))}</p>`:''}
      </div>
    </section>
    ${typeof orderDriverVehicleDocsSectionHtml==='function'?orderDriverVehicleDocsSectionHtml(o):''}
    <section class="form-section">
      <h2 class="form-section-title">2. Маршрут</h2>
      <div class="form-fields">
        <div id="route-editor"></div>
        <div class="form-pair">
          <div>
            <label for="d-loading-contact-name">Контакт на загрузке</label>
            <input id="d-loading-contact-name" value="${esc(o.loadingContactName||'')}" placeholder="ФИО" />
            <label for="d-loading-contact-phone">Телефон на загрузке</label>
            <input id="d-loading-contact-phone" inputmode="tel" value="${esc(formatPhone(o.loadingContactPhone||''))}" placeholder="+79650730002" />
          </div>
          <div>
            <label for="d-unloading-contact-name">Контакт на выгрузке</label>
            <input id="d-unloading-contact-name" value="${esc(o.unloadingContactName||'')}" placeholder="ФИО" />
            <label for="d-unloading-contact-phone">Телефон на выгрузке</label>
            <input id="d-unloading-contact-phone" inputmode="tel" value="${esc(formatPhone(o.unloadingContactPhone||''))}" placeholder="+79650730002" />
          </div>
        </div>
        <label class="cust-check-item">
          <input type="checkbox" id="d-shipper-same" ${o.shipperSameAsCustomer!==false?'checked':''} />
          <span>Грузоотправитель = заказчик</span>
        </label>
        <div id="d-shipper-fields" class="cust-shipper-fields" ${o.shipperSameAsCustomer!==false?'hidden':''}>
          <p class="hint">Грузоотправитель подписывает T1 в ЭТрН на погрузке.</p>
          <div class="form-pair">
            <div>
              <label for="d-shipper-name">Грузоотправитель</label>
              <input id="d-shipper-name" value="${esc(o.shipperName||'')}" placeholder="Организация или ФИО" />
            </div>
            <div>
              <label for="d-shipper-phone">Телефон</label>
              <input id="d-shipper-phone" inputmode="tel" value="${esc(formatPhone(o.shipperPhone||''))}" placeholder="+79650730002" />
            </div>
          </div>
          <label for="d-shipper-inn">ИНН грузоотправителя</label>
          <input id="d-shipper-inn" value="${esc(o.shipperInn||'')}" placeholder="необязательно" />
        </div>
        <div class="form-pair">
          <div>
            <label for="d-consignee-name">Грузополучатель</label>
            <input id="d-consignee-name" value="${esc(o.consigneeName||'')}" placeholder="Организация или ФИО" />
          </div>
          <div>
            <label for="d-consignee-phone">Телефон</label>
            <input id="d-consignee-phone" inputmode="tel" value="${esc(formatPhone(o.consigneePhone||''))}" placeholder="+79650730002" />
          </div>
        </div>
        <label for="d-consignee-inn">ИНН грузополучателя</label>
        <input id="d-consignee-inn" value="${esc(o.consigneeInn||'')}" placeholder="необязательно" />
        <label for="d-loading-owner-inn">ИНН владельца объекта погрузки</label>
        <input id="d-loading-owner-inn" inputmode="numeric" maxlength="12" value="${esc(o.loadingOwnerInn||'')}" placeholder="для договор‑заявки" />
        <label for="d-transport-deadline">Срок перевозки (текст)</label>
        <input id="d-transport-deadline" value="${esc(o.transportDeadline||'')}" placeholder="если нужен явный срок, иначе — по freeAt" />
        <label for="d-empty-after">Пробег до стоянки, км</label>
        <input id="d-empty-after" inputmode="numeric" value="${o.emptyKmAfter??''}" placeholder="например 40" />
      </div>
    </section>
    <section class="form-section">
      <h2 class="form-section-title">3. Тариф клиенту</h2>
      <p class="form-section-hint">${(()=>{ const f=financeForOrder(o); return `Пакет: мин ${f.minWorkHours} ч + ${f.podachaHours} ч подачи; в пакете ${f.cityKmThreshold} км. Нулевой до ≤${f.podachaEmptyKmLimit??20} км и дешевле 1 ч подачи — 1 ч; иначе 2 ч. Сверх — ₽/км.`; })()}</p>
      <div class="form-fields">
        <div class="form-pair">
          <div>
            <label for="d-perkm">руб/км сверх пакета (нал)</label>
            <input id="d-perkm" inputmode="decimal" value="${o.ratePerKmCash??''}" placeholder="например 80" />
          </div>
          <div>
            <label for="d-perhour">руб/час работы</label>
            <input id="d-perhour" inputmode="decimal" value="${o.ratePerHourWork??''}" placeholder="например 2000" />
          </div>
        </div>
        <div class="form-pair">
          <div>
            <label for="d-estimate-km">Ориентир км (груз + после)</label>
            <input id="d-estimate-km" inputmode="numeric" value="${o.estimateKm??''}" placeholder="например 80" />
          </div>
          <div>
            <label for="d-estimate-hours">Ориентир часов работы</label>
            <input id="d-estimate-hours" inputmode="decimal" value="${o.estimateWorkHours??''}" placeholder="например 4" />
          </div>
        </div>
        <label for="d-work-hours">Факт часов работы</label>
        <input id="d-work-hours" inputmode="decimal" value="${o.workHours??''}" placeholder="после закрытия" />
        <h3 style="margin:4px 0 0;font-size:.85rem">Ночное хранение</h3>
        <p class="form-section-hint">В сумму клиенту входит; в ЗП водителя — нет. При «осталась загружена» число ночей +1.</p>
        ${(o.staysLoadedOvernight||(o.overnightNights>0))?`<div class="hint" style="color:var(--accent)">Ночёвка с грузом${o.overnightNights?`: ${o.overnightNights} ноч.`:''}</div>`:''}
        <div class="form-pair">
          <div>
            <label for="d-overnight-rate">₽ за ночь (нал)</label>
            <input id="d-overnight-rate" inputmode="decimal" value="${o.overnightStorageRateCash??''}" placeholder="например 5000" />
          </div>
          <div>
            <label for="d-overnight-nights">Число ночей</label>
            <input id="d-overnight-nights" inputmode="numeric" value="${o.overnightNights??''}" placeholder="0" />
          </div>
        </div>
        <div class="calc" id="perkm-preview"></div>
      </div>
    </section>
    <section class="form-section">
      <h2 class="form-section-title">4. Ставки и ЗП</h2>
      <p class="form-section-hint">ЗП, подушка и прибыль — от ставки «наличные». С НДС = без НДС +22%.</p>
      <div class="form-fields">
        <label for="d-form">Форма для клиента (документы)</label>
        <select id="d-form">
          <option value="cash" ${o.paymentForm==='cash'||o.ratePerKmCash||!o.paymentForm?'selected':''}>Наличные</option>
          <option value="withVat" ${o.paymentForm==='withVat'?'selected':''}>С НДС</option>
          <option value="withoutVat" ${o.paymentForm==='withoutVat'?'selected':''}>Без НДС</option>
        </select>
        <label for="d-payment-terms">Порядок расчётов (для документов)</label>
        <input id="d-payment-terms" value="${esc(o.paymentTerms||'')}" placeholder="если пусто — стандартная формулировка по форме оплаты" />
        <div class="form-pair">
          <div>
            <label for="d-vat">Ставка с НДС, руб</label>
            <input id="d-vat" inputmode="decimal" value="${o.rateWithVat??''}" placeholder="от руб/км" />
          </div>
          <div>
            <label for="d-novat">Ставка без НДС, руб</label>
            <input id="d-novat" inputmode="decimal" value="${o.rateWithoutVat??''}" placeholder="от руб/км" />
          </div>
        </div>
        <label for="d-cash">Ставка наличные, руб</label>
        <input id="d-cash" inputmode="decimal" value="${o.rateCash??''}" placeholder="руб/км × км" />
        <div class="form-pair">
          <div>
            <label for="d-bonus">Доплата к ЗП, руб</label>
            <input id="d-bonus" inputmode="decimal" value="${o.salaryBonus??''}" placeholder="0" />
          </div>
          <div>
            <label for="d-rent">Аренда ТС, руб</label>
            <input id="d-rent" inputmode="decimal" value="${o.vehicleRent??''}" placeholder="0" />
          </div>
        </div>
      </div>
    </section>
    <section class="form-section">
      <h2 class="form-section-title">5. Итоги</h2>
      <div class="calc">
        <div class="calc-row"><span>Нулевой</span><span>${fmt(o.emptyKmBefore)} км</span></div>
        <div class="calc-row"><span>С грузом</span><span>${fmt(o.loadedKm)} км</span></div>
        <div class="calc-row"><span>От стоянки до конца</span><span>${fmt(m.km)} км</span></div>
        <div class="hint" style="margin-top:8px">Время</div>
        <div class="calc-row"><span>До заказа</span><span>${esc(formatDurationMin(o.timeToOrderMin))}${o.departAt?` · ${esc(dateTime(o.departAt))}`:''}</span></div>
        <div class="calc-row"><span>С грузом</span><span>${esc(formatDurationMin(o.timeLoadedMin))}${o.arrivedAt?` · с ${esc(dateTime(o.arrivedAt))}`:''}</span></div>
        <div class="calc-row"><span>До стоянки</span><span>${esc(formatDurationMin(o.timeToParkingMin))}${o.parkingAt?` · ${esc(dateTime(o.parkingAt))}`:''}</span></div>
        <div class="calc-row"><span>Всего на заказ</span><span>${esc(formatDurationMin(o.timeTotalMin))}</span></div>
        <div class="calc-row"><span>Норма авто</span><span>${fmt(m.cons)} л/100</span></div>
        <div class="calc-row"><span>ГСМ по заказу</span><span>${fmt(m.fuelLitersCalc)} л</span></div>
        <div class="calc-row"><span>Заправка</span><span>${o.refueled?`${fmt(o.fuelLiters)} л`:'нет'}</span></div>
        <div class="calc-row"><span>Остаток топлива</span><span>${fmt(o.fuelRemainingLiters)} л</span></div>
        <div class="calc-row"><span>руб/л (факт)</span><span>${fmt(o.fuelPricePerLiter)}</span></div>
        <div class="calc-row"><span>Стоимость ГСМ</span><span>${fmt(m.fuelCostCalc)} руб</span></div>
        <div class="calc-row"><span>руб/км без НДС</span><span>${fmt(m.costPerKmNoVat)}</span></div>
        <div class="calc-row"><span>Подушка 10%</span><span>${fmt(m.cushion)} руб</span></div>
        <div class="calc-row"><span>ЗП водителя</span><span>${fmt(m.driverPay)} руб</span></div>
        <div class="calc-row"><span>Чистая прибыль</span><span>${fmt(m.netProfit)} руб</span></div>
        <div class="hint" style="margin-top:8px">Себестоимость / ставка</div>
        <div class="calc-row"><span>Себестоимость (фикс)</span><span>${fmt(m.fixedCosts)} руб</span></div>
        <div class="calc-row"><span>Полная себестоимость</span><span>${fmt(m.totalCost)} руб</span></div>
        <div class="calc-row"><span>Безубыток</span><span>${fmt(m.breakEvenRate)} руб</span></div>
        <div class="calc-row"><span>Рекомендация +${Math.round(m.markupPercent)}%</span><span>${fmt(m.recommendedRate)} руб</span></div>
      </div>
    </section>
    </div>
  `;
  show('admin-detail');
  const detailScroll=$('detail-form'); if(detailScroll) detailScroll.scrollTop=0;
  const detailActions=$('detail-actions'); if(detailActions) detailActions.style.display='flex';
  const detailOk=$('detail-ok'); if(detailOk) detailOk.style.display='none';
  const detailCancel=$('detail-cancel-order');
  const detailCopy=$('detail-copy-order');
  if(detailCopy){
    detailCopy.onclick=()=>openAdminCreateScreen({ fromOrderId:id });
  }
  const detailReturn=$('detail-return-exchange');
  if(detailReturn){
    const showRet=canReturnOrderToExchange(o);
    detailReturn.style.display=showRet?'':'none';
    detailReturn.onclick=()=>returnOrderToExchange(id);
  }
  if(detailCancel){
    detailCancel.style.display=(!o.closedAt && !o.cancelledAt)?'':'none';
    detailCancel.onclick=()=>{
      if(!confirm('Отменить этот заказ?')) return;
      if(cancelOrder(id, 'Отменён из карточки')){
        if(detailActions) detailActions.style.display='none';
        show('admin'); renderAdmin();
      }
    };
  }
  renderRouteEditor();
  wirePerKmInputs(o);
  wireRateAutoFill(o);
  wireOrderDocs(id);
  wireOrderEtrn(id);
  const detailFirmId=()=>{
    const ord=state.orders.find(x=>x.id===id);
    if(!ord) return o.ownCompanyId;
    const ownSel=findCompanyById((($('d-own-company')||{}).value)||'');
    if(ownSel) return ownSel.id;
    return ord.executorType==='partner'?(ord.carrierCompanyId||ord.ownCompanyId):ord.ownCompanyId;
  };
  const refreshDetailDrvWarn=()=>{
    if(typeof refreshDriverDocsWarnBox!=='function') return;
    const nm=(($('d-driver-name')||{}).value||'').trim();
    refreshDriverDocsWarnBox($('d-driver-docs-warn'), nm, detailFirmId());
  };
  $('d-driver-name')&&($('d-driver-name').oninput=refreshDetailDrvWarn);
  $('d-own-company')&&($('d-own-company').onchange=refreshDetailDrvWarn);
  refreshDetailDrvWarn();
  $('d-sync-drv-docs')&&($('d-sync-drv-docs').onclick=()=>{
    const order=state.orders.find(x=>x.id===id);
    if(!order) return;
    if(typeof syncOrderDriverVehicleDocs==='function') syncOrderDriverVehicleDocs(order);
    if(typeof publishCustomerDriverDocsConfirm==='function') publishCustomerDriverDocsConfirm(order);
    if(typeof syncOrderDocsOnAssign==='function') syncOrderDocsOnAssign(order);
    bumpDataEpoch('order-drv-docs-sync');
    persist();
    openDetail(id);
    flashCatOk('Данные обновлены, заказчик получит подтверждение');
  });
  const shipSameEl=$('d-shipper-same');
  const shipBox=$('d-shipper-fields');
  if(shipSameEl&&shipBox){
    shipSameEl.onchange=()=>{ shipBox.hidden=shipSameEl.checked; };
  }
  $('d-customer-inn-lookup')&&($('d-customer-inn-lookup').onclick=()=>{
    applyCustomerFromInn((($('d-customer-inn')||{}).value||'').trim(), $('d-customer-inn-status'), 'd');
  });
  $('d-customer')&&($('d-customer').oninput=()=>{
    const name=($('d-customer').value||'').trim();
    const co=findCompanyByName(name);
    if(co && co.inn && $('d-customer-inn')) $('d-customer-inn').value=co.inn;
    renderRouteEditor();
  });
  const refreshFreeHint=()=>{
    const hint=$('d-free-hint'); if(!hint) return;
    const at=readVehicleAtFromDom('d');
    if(!at){ hint.textContent='Ориентир освобождения: укажите подачу ТС'; return; }
    const draft={
      estimateWorkHours:numTemp('d-estimate-hours'),
      workHours:numTemp('d-work-hours')
    };
    const free=computeFreeAt(at, Object.assign({ownCompanyId:o.ownCompanyId}, draft), financeForOrder(o));
    hint.textContent=`Ориентир освобождения: ${formatRuDateTimeAt(free)} (подача + часы работы)`;
  };
  function numTemp(el){
    const v=($(el)?.value||'').trim().replace(',','.');
    if(v==='') return null;
    const n=Number(v); return n>0?n:null;
  }
  wireVehicleAtHint('d', refreshFreeHint);
  $('d-estimate-hours')&&($('d-estimate-hours').oninput=refreshFreeHint);
  $('d-work-hours')&&($('d-work-hours').oninput=refreshFreeHint);
  $('detail-back').onclick=()=>{ if(detailActions) detailActions.style.display='none'; show('admin'); renderAdmin(); };
  $('detail-save').onclick=()=>{
    const order=state.orders.find(x=>x.id===id); if(!order) return;
    const cleaned=readPointsFromDom().filter(p=>p.address);
    const err=$('route-error');
    const showErr=msg=>{ if(err){ err.style.display='block'; err.textContent=msg; } };
    if(cleaned.length<2){ showErr('Нужны минимум 2 точки маршрута с адресом'); return; }
    if(!cleaned.some(p=>p.kind==='loading')){ showErr('Добавьте хотя бы одну точку «Загрузка»'); return; }
    if(!cleaned.some(p=>p.kind==='unloading')){ showErr('Добавьте хотя бы одну точку «Выгрузка»'); return; }
    const drvNameEarly=(($('d-driver-name')||{}).value||'').trim();
    const plateEarly=String(order.vehiclePlate||'').trim();
    const willAssign=drvNameEarly&&plateEarly&&plateEarly!=='—'&&shouldCheckDriverDocs(drvNameEarly);
    if(willAssign){
      const firmIdEarly=order.executorType==='partner'?(order.carrierCompanyId||order.ownCompanyId):((findCompanyById((($('d-own-company')||{}).value)||'')||{}).id||order.ownCompanyId);
      const drvRecEarly=findDriverRecord(drvNameEarly, firmIdEarly);
      if(typeof confirmIfDriverDocsIncomplete==='function'&&!confirmIfDriverDocsIncomplete(drvRecEarly, drvNameEarly)) return;
    }
    const num=el=>{ const v=($(el).value||'').trim().replace(',','.'); return v===''?null:Number(v); };
    order.customer=($('d-customer').value||'').trim();
    const custInn=String((($('d-customer-inn')||{}).value||'')).replace(/\D/g,'');
    order.customerInn=custInn;
    order.priceForClient=numOrNull(($('d-price-client')||{}).value);
    order.priceForCarrier=numOrNull(($('d-price-carrier')||{}).value);
    if(order.priceForClient!=null&&order.priceForClient<=0) order.priceForClient=null;
    if(order.priceForCarrier!=null&&order.priceForCarrier<=0) order.priceForCarrier=null;
    const drvName=(($('d-driver-name')||{}).value||'').trim();
    if(drvName) order.driverName=drvName;
    order.driverPhone=formatPhone((($('d-driver-phone')||{}).value||'').trim());
    if(order.driverPhone && order.driverName){
      const firmId=order.executorType==='partner'?(order.carrierCompanyId||order.ownCompanyId):order.ownCompanyId;
      const rec=findDriverRecord(order.driverName, firmId);
      if(rec) rec.phone=order.driverPhone;
    }
    const ownSel=findCompanyById((($('d-own-company')||{}).value)||'');
    if(ownSel){ order.ownCompanyId=ownSel.id; order.ownCompanyName=ownSel.name; }
    order.reqPayloadTons=numOrNull(($('d-req-pay')||{}).value);
    order.reqLengthM=numOrNull(($('d-req-l')||{}).value);
    order.reqWidthM=numOrNull(($('d-req-w')||{}).value);
    order.reqHeightM=numOrNull(($('d-req-h')||{}).value);
    order.reqBodyType=(($('d-body-type')||{}).value||'').trim()||null;
    order.cargoKind=(($('d-cargo-kind')||{}).value||'').trim()||null;
    order.cargoDescription=(($('d-cargo-desc')||{}).value||'').trim();
    order.cargoPlaces=numOrNull(($('d-cargo-places')||{}).value);
    order.cargoVolumeM3=numOrNull(($('d-cargo-volume')||{}).value);
    order.cargoWeightKg=numOrNull(($('d-cargo-weight')||{}).value);
    order.tripMode=(($('d-trip-mode')||{}).value||'')==='intercity'?'intercity':'city';
    order.routeKm=numOrNull(($('d-route-km')||{}).value);
    if(order.priceForClient!=null) order.pricePending=false;
    const carrSel=findCompanyById((($('d-carrier-company')||{}).value)||'');
    if(carrSel){ order.carrierCompanyId=carrSel.id; order.carrierCompanyName=carrSel.name; }
    else if(order.executorType!=='partner'){ order.carrierCompanyId=null; order.carrierCompanyName=''; }
    order.contactName=(($('d-contact-name')||{}).value||'').trim();
    order.contactPhone=formatPhone((($('d-contact-phone')||{}).value||'').trim());
    order.loadingContactName=(($('d-loading-contact-name')||{}).value||'').trim();
    order.loadingContactPhone=formatPhone((($('d-loading-contact-phone')||{}).value||'').trim());
    order.unloadingContactName=(($('d-unloading-contact-name')||{}).value||'').trim();
    order.unloadingContactPhone=formatPhone((($('d-unloading-contact-phone')||{}).value||'').trim());
    order.shipperSameAsCustomer=!($('d-shipper-same')&&!$('d-shipper-same').checked);
    order.shipperName=(($('d-shipper-name')||{}).value||'').trim();
    order.shipperInn=(($('d-shipper-inn')||{}).value||'').trim();
    order.shipperPhone=formatPhone((($('d-shipper-phone')||{}).value||'').trim());
    order.consigneeName=(($('d-consignee-name')||{}).value||'').trim();
    order.consigneeInn=(($('d-consignee-inn')||{}).value||'').trim();
    order.consigneePhone=formatPhone((($('d-consignee-phone')||{}).value||'').trim());
    order.loadingOwnerInn=String((($('d-loading-owner-inn')||{}).value||'')).replace(/\D/g,'');
    order.transportDeadline=(($('d-transport-deadline')||{}).value||'').trim();
    if(order.customer){
      const co=upsertCompany({name:order.customer, inn:custInn, roles:['customer'], spaceId:order.spaceId||currentSpaceId()});
      if(co){ order.customerId=co.id; order.customerInn=custInn||(co.inn||''); }
    }
    order.vehicleAt=readVehicleAtFromDom('d');
    order.routePoints=cleaned;
    ensureRoutePoints(order);
    const after=($('d-empty-after').value||'').replace(/\D/g,'');
    order.emptyKmAfter=after?+after:null;
    const per=num('d-perkm');
    order.ratePerKmCash=(per!=null && per>0)?per:null;
    const hour=num('d-perhour');
    order.ratePerHourWork=(hour!=null && hour>0)?hour:null;
    const estRaw=(($('d-estimate-km')||{}).value||'').replace(/\D/g,'');
    order.estimateKm=estRaw?+estRaw:null;
    const eh=num('d-estimate-hours'); order.estimateWorkHours=(eh!=null&&eh>0)?eh:null;
    const wh=num('d-work-hours'); order.workHours=(wh!=null&&wh>0)?wh:null;
    applyOrderSchedule(order);
    const stor=num('d-overnight-rate'); order.overnightStorageRateCash=(stor!=null&&stor>0)?stor:null;
    const nightsRaw=(($('d-overnight-nights')||{}).value||'').replace(/\D/g,'');
    order.overnightNights=nightsRaw?+nightsRaw:null;
    order.paymentForm=$('d-form').value;
    order.paymentTerms=(($('d-payment-terms')||{}).value||'').trim();
    if(!applyClientTariff(order)){
      const form=order.paymentForm;
      const seed = form==='withVat'?num('d-vat'):form==='cash'?num('d-cash'):num('d-novat');
      if(seed!=null && seed>0){
        const t=fillRatesFrom(form, seed);
        order.rateWithVat=t.withVat; order.rateWithoutVat=t.withoutVat; order.rateCash=t.cash;
      } else {
        order.rateWithVat=num('d-vat'); order.rateWithoutVat=num('d-novat'); order.rateCash=num('d-cash');
      }
    }
    order.salaryBonus=num('d-bonus'); order.vehicleRent=num('d-rent');
    order.freight=selectedRate(order);
    const pay=metrics(order).driverPay; order.earnings=pay!=null?pay:null;
    if(typeof syncOrderDocsOnAssign==='function') syncOrderDocsOnAssign(order);
    upsertOrder(order);
    openDetail(id);
    $('detail-ok').style.display='block';
  };
}

function showCatalogTab(tab){
  catalogTab=tab||'companies';
  document.querySelectorAll('[data-cat-tab]').forEach(b=>b.classList.toggle('on', b.dataset.catTab===catalogTab));
  document.querySelectorAll('[data-cat-panel]').forEach(p=>p.classList.toggle('on', p.dataset.catPanel===catalogTab));
}
function flashCatOk(msg){
  const el=$('cat-ok'); if(!el) return;
  el.textContent=msg||'Сохранено';
  el.style.display='block';
  clearTimeout(flashCatOk._t);
  const ms=(msg&&msg.length>20)?3200:1600;
  flashCatOk._t=setTimeout(()=>{ if(el) el.style.display='none'; }, ms);
}
function openCatalogs(){
  if(!currentAdmin){ fillAdminLoginSelect(); show('admin-pin'); return; }
  paintCatalogOwnerFilters();
  if(catalogActiveCompanyId){
    const hit=findCompanyById(catalogActiveCompanyId);
    if(!hit || !companyInMySpace(hit)) catalogActiveCompanyId=null;
  }
  if(catalogDriverCompanyId){
    const hit=findCompanyById(catalogDriverCompanyId);
    if(!hit || !companyInMySpace(hit)) catalogDriverCompanyId=null;
  }
  const companies=(state.companies||[]).filter(companyInMySpace);
  const fleetCo=typeof catalogFleetCompany==='function'?catalogFleetCompany():currentOwnCompany();
  const drivers=(state.drivers||[]).map((d,i)=>({d,i})).filter(({d})=>{
    if(!fleetCo) return false;
    return d.companyId===fleetCo.id;
  });
  const vehicles=(state.vehicles||[]).map((v,i)=>({v,i})).filter(({v})=>{
    if(!fleetCo) return false;
    return v.companyId===fleetCo.id;
  });
  const catalogHint=(isSuperAdmin()&&(state.adminOwnerFilter||'all')==='all')
    ? '<p class="cat-panel-hint">Показаны компании <strong>всех кабинетов</strong>. Справочник Армады — выберите «ООО «Армада»» в фильтре «Все кабинеты» сверху. «Наша фирма» у МБН и Нечаева — их кабинеты, не контрагенты Армады.</p>'
    : '';
  const companyCards=companies.map(c=>{
    const roles=roleLabels(c);
    const spLbl=typeof companySpaceLabel==='function'?companySpaceLabel(c):'';
    const chips=[
      spLbl&&(state.adminOwnerFilter||'all')==='all'?`<span class="chip">${esc(spLbl)}</span>`:'',
      companyHasRole(c,'own')?'<span class="chip hot">наша</span>':'',
      companyHasRole(c,'own')?(typeof isDispatcherCompany==='function' && isDispatcherCompany(c)?'<span class="chip">диспетчер</span>':''):'',
      companyHasRole(c,'customer')?'<span class="chip">заказчик</span>':'',
      companyHasRole(c,'carrier')?'<span class="chip">перевозчик</span>':''
    ].join('');
    const nContacts=(c.contacts||[]).length;
    const nAddr=((c.loadingAddresses||[]).length+(c.unloadingAddresses||[]).length);
    const prim=primaryContact(c);
    const primPhone=prim?contactPhone(prim):'';
    const fleetPhones=companyHasRole(c,'own')
      ? fleetDriversForCompany(c.id).map(d=>d.phone).filter(Boolean)
      : [];
    const phoneHint=primPhone || fleetPhones[0] || ((c.drivers||[]).find(d=>d.phone)||{}).phone || '';
    const metaBits=[
      phoneHint?`☎ ${phoneHint}`:null,
      nContacts?`${nContacts} конт.`:null,
      companyHasRole(c,'own')?`вод. ${fleetDriversForCompany(c.id).length}`:null,
      companyHasRole(c,'customer')&&nAddr?`${nAddr} адр.`:null,
      companyHasRole(c,'carrier')?`ТС ${(c.vehicles||[]).length}`:null
    ].filter(Boolean).join(' · ');
    return `<div class="dense-row" data-co-row="${esc(c.id)}">
      <button type="button" class="grow" data-edit-co="${esc(c.id)}">
        <div class="name">${esc(c.name)}</div>
        <div class="meta inn">${c.inn?`ИНН ${esc(c.inn)}`:''}</div>
        <div class="meta">${chips}${metaBits?` · ${esc(metaBits)}`:''}${!chips&&!metaBits?esc(roles||'—'):''}</div>
      </button>
      <button type="button" class="icon-btn danger" data-del-co="${esc(c.id)}" title="Удалить">×</button>
    </div>`;
  }).join('') || `<div class="hint">Пока пусто — нажмите «+ Компания»</div>`;

  const driverCards=drivers.map(({d,i})=>{
    const firm=typeof driverCompanyLabel==='function'?driverCompanyLabel(d):(d.companyName||(d.companyId&&(findCompanyById(d.companyId)||{}).name)||'');
    const veh=typeof vehicleForDriver==='function'?vehicleForDriver(d):null;
    const miss=typeof driverDocsMissingItems==='function'?driverDocsMissingItems(d):[];
    const openKey=d.id||String(i);
    const meta=[firm||null, formatPhone(d.phone||''), d.licenseNo?`ВУ ${d.licenseNo}`:null, veh?`🚛 ${veh.plate}`:null].filter(Boolean).join(' · ');
    return `<div class="item-card drv-list-card">
      <button type="button" class="drv-list-open" data-open-drv="${esc(openKey)}">
        <div class="item-top" style="pointer-events:none">
          <div class="item-name">${esc(d.name)}${firm?` <span class="drv-firm">${esc(firm)}</span>`:''}</div>
          ${miss.length?`<span class="drv-docs-badge warn">${miss.length} не заполнено</span>`:`<span class="drv-docs-badge ok">док. ок</span>`}
        </div>
        <div class="meta">${esc(meta||'Телефон и документы не заполнены')}</div>
      </button>
      <button type="button" class="primary cat-add-btn" data-open-drv="${esc(openKey)}" style="margin-top:6px">Документы и профиль</button>
    </div>`;
  }).join('') || `<div class="hint">Нет водителей — добавьте ниже</div>`;

  const vehicleCards=vehicles.map(({v,i})=>{
    const coName=v.companyName||(v.companyId&&(findCompanyById(v.companyId)||{}).name)||(isSuperAdmin()&&v.spaceId?((findSpaceById(v.spaceId)||{}).name||''):'');
    const spec=vehicleSpecText(v);
    const ivs=v.serviceIntervals||[];
    const overs=ivs.filter(iv=>serviceIntervalStatus(v,iv).level==='over').length;
    const soons=ivs.filter(iv=>serviceIntervalStatus(v,iv).level==='soon').length;
    const svcHint=overs?`<span class="svc-badge svc-over">ТО ${overs}</span>`
      :(soons?`<span class="svc-badge svc-soon">скоро ${soons}</span>`
      :(ivs.length?`<span class="svc-badge svc-ok">ТО ок</span>`:''));
    const logsN=(v.maintenanceLogs||[]).length;
    const vid=v.id||('idx-'+i);
    return `<div class="item-card">
      <div class="item-top">
        <div class="item-name" title="${esc(coName||v.plate)}">${esc(v.plate)}</div>
        <div class="item-actions" style="flex:0 0 auto;gap:4px">
          <button type="button" class="icon-btn ok" data-save-veh="${i}" title="Сохранить">✓</button>
          <button type="button" class="icon-btn danger" data-del-veh="${i}" title="Удалить">×</button>
        </div>
      </div>
      <div class="meta" style="font-size:.65rem;color:var(--muted)">${esc([coName,spec,vehicleCrewSummary(v)].filter(Boolean).join(' · ')||'укажите т и габариты')}${v.stsPhoto?' · СТС 📄':''}${svcHint?' · ':''}${svcHint}${logsN?` · записей ${logsN}`:''}</div>
      <div class="veh-specs">
        <input id="veh-pay-${i}" inputmode="decimal" placeholder="т" title="Грузоподъёмность, т" value="${v.payloadTons??''}" />
        <input id="veh-l-${i}" inputmode="decimal" placeholder="Д" title="Длина, м" value="${v.bodyLengthM??''}" />
        <input id="veh-w-${i}" inputmode="decimal" placeholder="Ш" title="Ширина, м" value="${v.bodyWidthM??''}" />
        <input id="veh-h-${i}" inputmode="decimal" placeholder="В" title="Высота, м" value="${v.bodyHeightM??''}" />
        <input id="veh-${i}" inputmode="decimal" placeholder="л" title="л/100" value="${v.consumptionPer100Km}" />
        <span class="hint" style="margin:0">л/100</span>
      </div>
      <button type="button" class="primary cat-add-btn" data-open-veh="${esc(vid)}" style="margin-top:2px">Ремонт и ТО</button>
    </div>`;
  }).join('') || `<div class="hint">Нет авто — добавьте ниже</div>`;

  const tab=catalogTab||'companies';
  const tabs=$('cat-tabs');
  if(tabs){
    tabs.innerHTML=`
      <button type="button" data-cat-tab="companies" class="${tab==='companies'?'on':''}">Компании<span class="n">${companies.length}</span></button>
      <button type="button" data-cat-tab="drivers" class="${tab==='drivers'?'on':''}">Водители<span class="n">${drivers.length}</span></button>
      <button type="button" data-cat-tab="vehicles" class="${tab==='vehicles'?'on':''}">Авто<span class="n">${vehicles.length}</span></button>
      <button type="button" data-cat-tab="finance" class="${tab==='finance'?'on':''}">Тариф<span class="n">₽</span></button>
    `;
  }
  $('catalogs-form').innerHTML=`
    <div class="cat-panel ${tab==='companies'?'on':''}" data-cat-panel="companies">
      ${catalogHint}
      <div class="row" style="gap:6px">
        <input class="cat-search" id="co-search" placeholder="Поиск: название или ИНН…" style="flex:1;margin:0" />
        <button type="button" class="primary cat-add-btn" id="co-new" style="width:auto;flex:0 0 auto;padding:8px 12px!important">+</button>
      </div>
      <div id="co-editor" class="co-editor-box"></div>
      <div class="cat-list" id="co-list">${companyCards}</div>
    </div>

    <div class="cat-panel ${tab==='drivers'?'on':''}" data-cat-panel="drivers">
      ${(()=>{
        const fleetList=typeof catalogFleetCompanies==='function'?catalogFleetCompanies():ownCompaniesList().filter(c=>companyInMySpace(c));
        const active=fleetCo;
        const firmPick=fleetList.length>1
          ? `<label class="svc-full">Компания<select id="drv-company-pick">${fleetList.map(c=>`<option value="${esc(c.id)}" ${active&&c.id===active.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`
          : '';
        const hint=active
          ? `Водители «${esc(active.name)}». Нажмите карточку — все документы в одном месте.`
          : (isSuperAdmin()?'Выберите компанию с парком':'Сначала нужна ваша фирма');
        return `${firmPick}<p class="cat-panel-hint">${hint}</p>`;
      })()}
      <div class="cat-quick drv-add">
        <div class="row">
          <input id="own-drv-name" placeholder="ФИО" style="flex:1.2" />
          <input class="pct" id="own-drv-pct" inputmode="decimal" value="30" placeholder="%" title="%" />
          <input id="own-drv-phone" inputmode="tel" placeholder="+79650730002" style="flex:1" />
          <input id="own-drv-pin" inputmode="numeric" maxlength="8" placeholder="PIN" title="PIN" style="flex:0 0 52px;text-align:center" />
          <label class="check" title="Биржа"><input type="checkbox" id="own-drv-ex"/> Б</label>
          <button type="button" class="icon-btn ok" id="own-drv-add" title="Добавить">+</button>
        </div>
      </div>
      <div class="cat-list">${driverCards}</div>
    </div>

    <div class="cat-panel ${tab==='vehicles'?'on':''}" data-cat-panel="vehicles">
      ${(()=>{
        const fleetList=typeof catalogFleetCompanies==='function'?catalogFleetCompanies():ownCompaniesList().filter(c=>companyInMySpace(c));
        const active=fleetCo;
        const firmPick=fleetList.length>1
          ? `<label class="svc-full">Компания<select id="veh-company-pick">${fleetList.map(c=>`<option value="${esc(c.id)}" ${active&&c.id===active.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`
          : '';
        const hint=active
          ? `Авто «${esc(active.name)}»: тоннаж, габариты, экипаж — в карточке «Ремонт и ТО».`
          : (isSuperAdmin()?'Выберите компанию с парком':'Сначала нужна ваша фирма');
        return `${firmPick}<p class="cat-panel-hint">${hint}</p>`;
      })()}
      <div class="cat-quick">
        <div class="row">
          <input id="own-veh-plate" placeholder="Госномер" style="flex:1.5" />
          <input id="own-veh-cons" inputmode="decimal" value="20" placeholder="л/100" title="л/100 км" style="flex:0 0 56px;text-align:center" />
          <button type="button" class="icon-btn ok" id="own-veh-add" title="Добавить">+</button>
        </div>
        <div class="row" style="margin-top:4px">
          <input id="own-veh-pay" inputmode="decimal" placeholder="т" title="Грузоподъёмность" style="flex:0 0 56px;text-align:center" />
          <input id="own-veh-l" inputmode="decimal" placeholder="Д, м" style="flex:1;text-align:center" />
          <input id="own-veh-w" inputmode="decimal" placeholder="Ш, м" style="flex:1;text-align:center" />
          <input id="own-veh-h" inputmode="decimal" placeholder="В, м" style="flex:1;text-align:center" />
        </div>
      </div>
      <div class="cat-list">${vehicleCards}</div>
    </div>

    <div class="cat-panel ${tab==='finance'?'on':''}" data-cat-panel="finance">
      ${(()=>{
        const finCo=catalogFinanceCompany();
        const fin=finCo?financeForCompanyId(finCo.id):normalizeFinance(state.finance);
        const owns=ownCompaniesList();
        const firmPick=isSuperAdmin() && owns.length
          ? `<label class="svc-full">Фирма<select id="fin-company">${owns.map(c=>`<option value="${esc(c.id)}" ${finCo&&c.id===finCo.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`
          : `<p class="cat-panel-hint">Тариф фирмы: <b>${esc((finCo&&finCo.name)||'—')}</b></p>`;
        return `
      <p class="cat-panel-hint">Свои настройки у каждой «нашей фирмы». Пакет = часы работы + подача; км в пакете = груз + после.</p>
      <div class="fin-grid" style="margin-top:4px">
        ${firmPick}
        <label>Наценка, %<input id="fin-markup" inputmode="decimal" value="${fin.markupPercent??15}" /></label>
        <label>Км в пакете<input id="fin-city" inputmode="numeric" value="${fin.cityKmThreshold??100}" /></label>
        <label>Часы работы<input id="fin-minwork" inputmode="decimal" value="${fin.minWorkHours??4}" /></label>
        <label>Подача, ч<input id="fin-podacha" inputmode="decimal" value="${fin.podachaHours??1}" /></label>
        <label>Нулевой до, км<input id="fin-podacha-km" inputmode="numeric" value="${fin.podachaEmptyKmLimit??20}" title="Свыше — +1 ч подачи" /></label>
        <label>₽/час<input id="fin-perhour" inputmode="decimal" value="${fin.defaultRatePerHourWork||''}" /></label>
        <label>₽/км сверх<input id="fin-perkm" inputmode="decimal" value="${fin.defaultRatePerKmCash||80}" /></label>
        <label>Реф ×<input id="fin-reefer" inputmode="decimal" value="${fin.bodyMultReefer??1.25}" title="Надбавка рефрижератор / продукты" /></label>
        <label>Самосвал ×<input id="fin-dump" inputmode="decimal" value="${fin.bodyMultDump??1.15}" /></label>
        <label>От т<input id="fin-heavy-t" inputmode="decimal" value="${fin.heavyTonsFrom??20}" /></label>
        <label>Тяжёлые ×<input id="fin-heavy" inputmode="decimal" value="${fin.heavyMult??1.15}" /></label>
        <label title="Наценка заказчику за срочный подбор логистом">Ставка логиста, %<input id="fin-logist-fee" inputmode="decimal" value="${fin.logistFeePercent??10}" /></label>
        <button class="primary cat-add-btn fin-full" id="fin-save">Сохранить тариф фирмы</button>
      </div>`;
      })()}
    </div>

    <div class="toast-ok" id="cat-ok" style="display:none">Сохранено</div>
  `;
  show('admin-catalogs-screen');
  showCatalogTab(tab);
  document.querySelectorAll('#cat-tabs [data-cat-tab]').forEach(b=>b.onclick=()=>{
    catalogTab=b.dataset.catTab;
    openCatalogs();
  });
  const search=$('co-search');
  if(search){
    search.oninput=()=>{
      const q=(search.value||'').trim().toLowerCase();
      document.querySelectorAll('#co-list [data-co-row]').forEach(row=>{
        const name=(row.querySelector('.name')?.textContent||'').toLowerCase();
        const inn=(row.querySelector('.inn')?.textContent||'').toLowerCase();
        row.style.display=!q || name.includes(q) || inn.includes(q)?'':'none';
      });
    };
  }
  $('cat-back').onclick=()=>{ show('admin'); renderAdmin(); };

    const openEditor=(company)=>{
    showCatalogTab('companies');
    if(company&&company.id){
      catalogActiveCompanyId=company.id;
      if(typeof catalogFleetCompany==='function'){
        const co0=findCompanyById(company.id);
        if(co0&&(companyHasRole(co0,'own')||companyHasRole(co0,'carrier'))) catalogDriverCompanyId=company.id;
      }
    } else {
      catalogActiveCompanyId=null;
    }
    const c=company?(()=>{
      const n=normalizeCompany(company);
      if(n) return n;
      return Object.assign({
        id:uuid(), name:'', roles:['customer'], note:'', phones:[], contacts:[],
        loadingAddresses:[], unloadingAddresses:[], vehicles:[], drivers:[],
        spaceId:typeof catalogViewSpaceId==='function'?catalogViewSpaceId():currentSpaceId(), inn:'', ogrn:'', kpp:'', address:''
      }, company, { name:String(company.name||'').trim() });
    })():{id:uuid(),name:'',roles:['customer'],note:'',phones:[],contacts:[],loadingAddresses:[],unloadingAddresses:[],vehicles:[],drivers:[],spaceId:typeof catalogViewSpaceId==='function'?catalogViewSpaceId():currentSpaceId(),inn:'',ogrn:'',kpp:'',address:''};
    const box=$('co-editor');
    box.classList.add('show');
    try{ box.scrollIntoView({behavior:'smooth', block:'nearest'}); }catch(_){}
    const isOwn=companyHasRole(c,'own');
    const isCust=companyHasRole(c,'customer');
    const isCarr=companyHasRole(c,'carrier');
    const canonicalOwn=typeof isCanonicalOwnCompany==='function'&&isCanonicalOwnCompany(c);
    const foreignOwn=typeof isForeignCanonicalOwnCompany==='function'&&isForeignCanonicalOwnCompany(c);
    const foreignSpace=foreignOwn&&typeof spaceForCanonicalOwnCompany==='function'?spaceForCanonicalOwnCompany(c):null;
    const lockOwnRole=canonicalOwn||foreignOwn;
    const catalogSid=typeof catalogViewSpaceId==='function'?catalogViewSpaceId():currentSpaceId();
    box.innerHTML=`
      <div class="row" style="align-items:center;margin-bottom:4px">
        <h3 style="margin:0;flex:1;font-size:.95rem">${company?'Профиль компании':'Новая компания'}</h3>
        <button type="button" class="icon-btn" id="co-cancel" title="Закрыть">×</button>
      </div>
      <label>ИНН</label>
      <div class="row" style="gap:8px;align-items:center">
        <input id="co-inn" inputmode="numeric" maxlength="12" placeholder="10 или 12 цифр" value="${esc(c.inn||'')}" style="flex:1" />
        <button type="button" class="secondary" id="co-inn-lookup" style="width:auto;flex:0 0 auto;padding:8px 12px">Загрузить</button>
      </div>
      <div class="hint" id="co-inn-status"></div>
      <label>Название</label><input id="co-name" value="${esc(c.name)}" />
      <div class="form-pair">
        <div><label>ОГРН</label><input id="co-ogrn" value="${esc(c.ogrn||'')}" /></div>
        <div><label>КПП</label><input id="co-kpp" value="${esc(c.kpp||'')}" /></div>
      </div>
      <label>Юр. адрес</label><input id="co-address" value="${esc(c.address||'')}" />
      <div class="role-toggles">
        <label class="role-tog"><input type="checkbox" id="co-role-o" ${isOwn?'checked':''}${lockOwnRole?' disabled':''}/> Наша фирма</label>
        <label class="role-tog"><input type="checkbox" id="co-role-c" ${isCust?'checked':''}/> Заказчик</label>
        <label class="role-tog"><input type="checkbox" id="co-role-r" ${isCarr?'checked':''}/> Перевозчик</label>
      </div>
      ${foreignOwn&&foreignSpace?`<p class="hint">Это «наша фирма» кабинета «${esc(foreignSpace.name)}», не контрагент текущего справочника. Чтобы добавить МБН/Нечаева как партнёра в Армаду — создайте <strong>новую</strong> карточку (+) в фильтре «ООО «Армада»».</p>`:''}
      ${canonicalOwn&&!foreignOwn?`<p class="hint">Это основная «наша фирма» кабинета — роль нельзя снять. Для пилота партнёра создайте отдельного админа в «Активность».</p>`:''}
      <label>Заметка</label><input id="co-note" value="${esc(c.note||'')}" />
      <h4>Контактные лица</h4>
      <div class="hint" style="margin:0 0 4px">Телефон контакта — в карточке компании; у водителя с тем же ФИО подтянется сам</div>
      <div id="co-contacts"></div>
      <button type="button" class="secondary" id="co-add-contact">+ Контакт</button>
      <div id="co-own-kind" style="display:${isOwn?'block':'none'}">
        <label class="role-tog"><input type="checkbox" id="co-dispatcher" ${(typeof isDispatcherCompany==='function'?isDispatcherCompany(c):c.logistKind==='broker')?'checked':''}/> Диспетчер — кнопка «Биржа»</label>
        <p class="hint">Логист и диспетчер — одна должность. Парк как обычно. Если включить диспетчера, появится Биржа (остаток партнёрам). Биржа уже в тарифе «Бизнес».</p>
        <label for="co-vat-payer">НДС перевозчика (для портала заказчика)</label>
        <select id="co-vat-payer">
          <option value="none" ${(typeof companyVatPayer==='function'?companyVatPayer(c):'none')==='none'?'selected':''}>Без НДС — заказчик платит перевозчику без НДС</option>
          <option value="vat" ${(typeof companyVatPayer==='function'?companyVatPayer(c):'none')==='vat'?'selected':''}>С НДС — счёт перевозчика с НДС</option>
        </select>
        <p class="hint">Если перевозчик на УСН, заказчик с НДС не передаёт НДС перевозчику — в портале одна сумма без НДС.</p>
        <h4>Банковские реквизиты (для счетов заказчику и QR СБП)</h4>
        <label>Банк</label><input id="co-bank-name" placeholder="Сбербанк" value="${esc((c.bank&&c.bank.bankName)||c.bankName||'')}" />
        <div class="form-pair">
          <div><label>БИК</label><input id="co-bank-bik" inputmode="numeric" maxlength="9" placeholder="044525225" value="${esc((c.bank&&c.bank.bankBik)||c.bankBik||'')}" /></div>
          <div><label>Р/с</label><input id="co-bank-account" inputmode="numeric" maxlength="20" placeholder="40802810…" value="${esc((c.bank&&c.bank.bankAccount)||c.bankAccount||'')}" /></div>
        </div>
        <label>К/с</label><input id="co-bank-corr" inputmode="numeric" maxlength="20" placeholder="30101810…" value="${esc((c.bank&&c.bank.bankCorrAccount)||c.bankCorrAccount||'')}" />
        <p class="hint">Заполните для QR по стандарту СБП в счёте заказчика после отправки заявки.</p>
      </div>
      <div id="co-own-fleet" style="display:${isOwn?'block':'none'}">
        <h4>Водители фирмы (телефоны)</h4>
        <div class="hint" style="margin:0 0 4px">Парк «нашей фирмы» — ФИО и телефон. Правки сохраняются в справочник водителей.</div>
        <div id="co-own-drivers"></div>
        <h4 style="margin-top:12px">Авто парка</h4>
        <div class="hint" style="margin:0 0 4px">Тоннаж и ТО — вкладка «Авто» или кнопка «Ремонт и ТО».</div>
        <div id="co-own-vehicles"></div>
      </div>
      <div id="co-customer-fields" style="display:${isCust?'block':'none'}">
        <h4>Портал заказчика (самостоятельные заявки)</h4>
        <label class="check"><input type="checkbox" id="co-portal-enabled" ${c.portalEnabled?'checked':''}/> Разрешить вход в портал</label>
        <label>Телефон для входа</label>
        <input id="co-portal-phone" inputmode="tel" placeholder="+7…" value="${esc(c.portalPhone||contactPhone(c.contacts&&c.contacts[0])||'')}" />
        <label>PIN (от 4 цифр)</label>
        <input id="co-portal-pin" inputmode="numeric" maxlength="8" placeholder="PIN" value="${esc(c.portalPin||'')}" />
        <p class="hint">Ссылка для этого заказчика: <a href="${esc(customerPortalPageUrl({companyId:c.id}))}" target="_blank" rel="noopener">${esc(customerPortalPageUrl({companyId:c.id}))}</a></p>
        <p class="hint">Заявки идут на биржу с проверкой минимальной цены.</p>
        <h4>Рамочный договор</h4>
        ${(()=>{
          const fcSt=typeof customerFrameworkContractStatus==='function'?customerFrameworkContractStatus(c):'none';
          const fcLbl=typeof customerFrameworkContractLabel==='function'?customerFrameworkContractLabel(fcSt):'—';
          const fc=typeof normalizeFrameworkContract==='function'?normalizeFrameworkContract(c.frameworkContract):{};
          const signedAt=fc.signedAt?` · ${dateTime(fc.signedAt)}`:'' ;
          return `<p class="hint">Статус: <strong>${esc(fcLbl)}</strong>${signedAt}${fc.signedBy?` · ${esc(fc.signedBy)}`:''}</p>
        <label class="check"><input type="checkbox" id="co-contract-signed" ${fcSt==='signed'?'checked':''}/> Договор подписан (вручную / через портал)</label>`;
        })()}
        <h4>Адреса заказчика</h4>
        <label>Загрузки (каждый с новой строки)</label>
        <textarea id="co-loads" rows="3">${esc((c.loadingAddresses||[]).join('\n'))}</textarea>
        <label>Выгрузки</label>
        <textarea id="co-unloads" rows="3">${esc((c.unloadingAddresses||[]).join('\n'))}</textarea>
      </div>
      <div id="co-carrier-fields" style="display:${isCarr?'block':'none'}">
        <h4>ТС перевозчика</h4>
        <div id="co-vehicles"></div>
        <button type="button" class="secondary" id="co-add-veh">+ ТС</button>
        <h4>Водители перевозчика</h4>
        <div id="co-drivers"></div>
        <button type="button" class="secondary" id="co-add-drv">+ Водитель перевозчика</button>
      </div>
      <button class="primary cat-add-btn" id="co-save" style="margin-top:8px">Сохранить</button>
    `;
    let contacts=(c.contacts||[]).map(x=>({...x, phones:(x.phones||[]).map(p=>({...p}))}));
    // Если у «нашей фирмы» есть водители с телефоном, а контактов нет — показать их как контакты
    if(isOwn && c.id){
      fleetDriversForCompany(c.id).forEach(d=>{
        if(!(d.name||'').trim()) return;
        const exists=contacts.some(p=>samePersonName(p.name, d.name));
        if(!exists){
          contacts.push({
            id:uuid(), name:d.name, title:'Водитель',
            phones:d.phone?[{id:uuid(), number:d.phone, label:''}]:[],
            isPrimary:!contacts.length
          });
        } else if(d.phone){
          const p=contacts.find(x=>samePersonName(x.name, d.name));
          if(p && !contactPhone(p)){ const fp=formatPhone(d.phone); if(fp) p.phones=[{id:uuid(), number:fp, label:''}]; }
        }
      });
    }
    let vehicles=(c.vehicles||[]).map(x=>({...x}));
    let drivers=(c.drivers||[]).map(x=>({...x}));
    if(isOwn&&c.id){
      vehicles=fleetVehiclesForCompany(c.id).map(v=>({
        id:v.id, plate:v.plate, makeModel:v.makeModel||'',
        payloadTons:v.payloadTons, bodyLengthM:v.bodyLengthM, bodyWidthM:v.bodyWidthM, bodyHeightM:v.bodyHeightM
      }));
    }
    if(isCarr&&c.id&&!isOwn){
      const fleet=fleetVehiclesForCompany(c.id);
      if(fleet.length) vehicles=fleet.map(v=>({
        id:v.id, plate:v.plate, makeModel:v.makeModel||'',
        payloadTons:v.payloadTons, bodyLengthM:v.bodyLengthM, bodyWidthM:v.bodyWidthM, bodyHeightM:v.bodyHeightM
      }));
      const fleetDrv=fleetDriversForCompany(c.id);
      if(fleetDrv.length) drivers=fleetDrv.map(d=>({id:d.id, name:d.name, phone:d.phone||'', vehicleId:d.vehicleId||null}));
    }
    const paintContacts=()=>{
      $('co-contacts').innerHTML=contacts.map((p,i)=>`
        <div class="card" style="margin:6px 0">
          <input data-cn="${i}" placeholder="ФИО" value="${esc(p.name)}" />
          <input data-ct="${i}" placeholder="Должность" value="${esc(p.title||'')}" />
          <input data-cp="${i}" inputmode="tel" placeholder="+79650730002" value="${esc(contactPhone(p))}" />
          <label class="check"><input type="checkbox" data-cprim="${i}" ${p.isPrimary?'checked':''}/> Основной</label>
          <button type="button" class="secondary" data-cdel="${i}">Удалить контакт</button>
        </div>`).join('')||`<div class="hint">Нет контактов</div>`;
      document.querySelectorAll('[data-cdel]').forEach(b=>b.onclick=()=>{ contacts.splice(+b.dataset.cdel,1); paintContacts(); });
    };
    const paintOwnDrivers=()=>{
      const box=$('co-own-drivers'); if(!box) return;
      const list=c.id?fleetDriversForCompany(c.id):[];
      box.innerHTML=list.length?list.map((d,i)=>{
        const idx=(state.drivers||[]).findIndex(x=>x===d || (samePersonName(x.name,d.name) && x.companyId===c.id));
        const ph=formatPhone(d.phone||'');
        return `<div class="card" style="margin:6px 0">
          <div class="row" style="align-items:center">
            <div style="flex:1;font-weight:700;font-size:.85rem">${esc(d.name)}</div>
            ${ph?`<a href="tel:${esc(ph)}" style="color:var(--accent);font-size:.8rem;white-space:nowrap">☎</a>`:''}
          </div>
          <input data-own-dp="${idx}" inputmode="tel" placeholder="+79650730002" value="${esc(ph)}" />
        </div>`;
      }).join(''):`<div class="hint">Нет водителей в парке — добавьте во вкладке «Водители»</div>`;
    };
    const paintOwnVehicles=()=>{
      const box=$('co-own-vehicles'); if(!box) return;
      const list=c.id?fleetVehiclesForCompany(c.id):[];
      box.innerHTML=list.length?list.map(v=>{
        const spec=typeof vehicleSpecText==='function'?vehicleSpecText(v):'';
        const vid=v.id||'';
        return `<div class="card" style="margin:6px 0">
          <div class="row" style="align-items:center;gap:8px">
            <div style="flex:1;font-weight:700">${esc(v.plate)}</div>
            ${spec?`<span class="meta">${esc(spec)}</span>`:''}
            ${vid?`<button type="button" class="secondary" data-open-veh-co="${esc(vid)}" style="width:auto;padding:4px 8px">ТО</button>`:''}
          </div>
        </div>`;
      }).join(''):`<div class="hint">Нет авто — добавьте во вкладке «Авто»</div>`;
      box.querySelectorAll('[data-open-veh-co]').forEach(b=>b.onclick=()=>openVehicleCard(b.dataset.openVehCo));
    };
    const paintVehicles=()=>{
      $('co-vehicles').innerHTML=vehicles.map((v,i)=>`
        <div class="card" style="margin:6px 0">
          <input data-vp="${i}" placeholder="Госномер" value="${esc(v.plate)}" />
          <input data-vm="${i}" placeholder="Марка/модель" value="${esc(v.makeModel||'')}" />
          <input data-vpay="${i}" inputmode="decimal" placeholder="Грузоподъёмность, т" value="${v.payloadTons??''}" />
          <div class="row">
            <input data-vl="${i}" inputmode="decimal" placeholder="Длина, м" value="${v.bodyLengthM??''}" />
            <input data-vw="${i}" inputmode="decimal" placeholder="Ширина, м" value="${v.bodyWidthM??''}" />
            <input data-vh="${i}" inputmode="decimal" placeholder="Высота, м" value="${v.bodyHeightM??''}" />
          </div>
          <button type="button" class="secondary" data-vdel="${i}">Удалить ТС</button>
        </div>`).join('')||`<div class="hint">Нет ТС</div>`;
      document.querySelectorAll('[data-vdel]').forEach(b=>b.onclick=()=>{ vehicles.splice(+b.dataset.vdel,1); paintVehicles(); });
    };
    const paintDrivers=()=>{
      $('co-drivers').innerHTML=drivers.map((d,i)=>`
        <div class="card" style="margin:6px 0">
          <input data-dn="${i}" placeholder="ФИО водителя" value="${esc(d.name)}" />
          <input data-dp="${i}" inputmode="tel" placeholder="+79650730002" value="${esc(formatPhone(d.phone||''))}" />
          <button type="button" class="secondary" data-ddel="${i}">Удалить</button>
        </div>`).join('')||`<div class="hint">Нет водителей</div>`;
      document.querySelectorAll('[data-ddel]').forEach(b=>b.onclick=()=>{ drivers.splice(+b.dataset.ddel,1); paintDrivers(); });
    };
    paintContacts(); paintOwnDrivers(); paintOwnVehicles(); paintVehicles(); paintDrivers();
    const syncRoleVisibility=()=>{
      $('co-customer-fields').style.display=$('co-role-c').checked?'block':'none';
      $('co-carrier-fields').style.display=$('co-role-r').checked?'block':'none';
      const ownBox=$('co-own-fleet');
      const ownKind=$('co-own-kind');
      const on=!!($('co-role-o')&&$('co-role-o').checked);
      if(ownBox) ownBox.style.display=on?'block':'none';
      if(ownKind) ownKind.style.display=on?'block':'none';
    };
    $('co-role-c').onchange=syncRoleVisibility;
    $('co-role-r').onchange=syncRoleVisibility;
    $('co-role-o')&&($('co-role-o').onchange=syncRoleVisibility);
    $('co-add-contact').onclick=()=>{ contacts.push({id:uuid(),name:'',title:'',phones:[],isPrimary:!contacts.length}); paintContacts(); };
    $('co-add-veh').onclick=()=>{ vehicles.push({id:uuid(),plate:'',makeModel:'',payloadTons:null,bodyLengthM:null,bodyWidthM:null,bodyHeightM:null}); paintVehicles(); };
    $('co-add-drv').onclick=()=>{ drivers.push({id:uuid(),name:'',phone:'',vehicleId:null}); paintDrivers(); };
    $('co-cancel').onclick=()=>{ box.classList.remove('show'); box.innerHTML=''; };
    $('co-inn-lookup')&&($('co-inn-lookup').onclick=async()=>{
      const st=$('co-inn-status');
      const inn=(($('co-inn')||{}).value||'').trim();
      if(st) st.textContent='Загрузка…';
      try{
        const existing=findCompanyByInn(inn);
        if(existing && existing.id!==c.id){
          if(st) st.textContent='ИНН уже в справочнике: '+existing.name;
          return;
        }
        const party=await lookupPartyByInn(inn);
        if($('co-name')) $('co-name').value=party.name||($('co-name').value||'');
        if($('co-inn')) $('co-inn').value=party.inn||inn;
        if($('co-ogrn')) $('co-ogrn').value=party.ogrn||'';
        if($('co-kpp')) $('co-kpp').value=party.kpp||'';
        if($('co-address')) $('co-address').value=party.address||'';
        if(st) st.textContent='Реквизиты загружены';
      }catch(err){
        if(st) st.textContent=String(err.message||err);
      }
    });
    $('co-save').onclick=async()=>{
      const name=($('co-name').value||'').trim();
      if(!name){ alert('Укажите название'); return; }
      const roles=[];
      if($('co-role-o')&&$('co-role-o').checked) roles.push('own');
      if($('co-role-c').checked) roles.push('customer');
      if($('co-role-r').checked) roles.push('carrier');
      if(typeof isForeignCanonicalOwnCompany==='function'&&isForeignCanonicalOwnCompany(c)&&!roles.includes('own')){
        const sp=typeof spaceForCanonicalOwnCompany==='function'?spaceForCanonicalOwnCompany(c):null;
        alert(`Нельзя снять «Наша фирма» — это кабинет «${sp&&sp.name||'другого перевозчика'}». Для контрагента в Армаде создайте новую карточку (+) в фильтре «ООО «Армада»».`);
        return;
      }
      if(typeof isCanonicalOwnCompany==='function'&&isCanonicalOwnCompany(c)&&!roles.includes('own')){
        alert('Нельзя снять «Наша фирма» у основной компании кабинета. Для партнёра — отдельный админ в «Активность».');
        return;
      }
      if(!roles.length){ alert('Выберите роль: наша фирма / заказчик / перевозчик'); return; }
      // read contacts from DOM
      contacts=contacts.map((p,i)=>{
        const nameEl=document.querySelector(`[data-cn="${i}"]`);
        const titleEl=document.querySelector(`[data-ct="${i}"]`);
        const phoneEl=document.querySelector(`[data-cp="${i}"]`);
        const primEl=document.querySelector(`[data-cprim="${i}"]`);
        const nm=(nameEl&&nameEl.value||'').trim();
        const ph=formatPhone((phoneEl&&phoneEl.value||'').trim());
        return {id:p.id||uuid(), name:nm, title:(titleEl&&titleEl.value||'').trim(), phones:ph?[{id:uuid(),number:ph,label:''}]:[], isPrimary:!!(primEl&&primEl.checked)};
      }).filter(p=>p.name);
      vehicles=vehicles.map((v,i)=>{
        const plate=(document.querySelector(`[data-vp="${i}"]`)?.value||'').trim();
        const makeModel=(document.querySelector(`[data-vm="${i}"]`)?.value||'').trim();
        const num=id=>{ const raw=document.querySelector(`[data-${id}="${i}"]`)?.value||''; const n=+String(raw).replace(',','.'); return n>0?n:null; };
        return {id:v.id||uuid(), plate, makeModel, payloadTons:num('vpay'), bodyLengthM:num('vl'), bodyWidthM:num('vw'), bodyHeightM:num('vh')};
      }).filter(v=>v.plate);
      drivers=drivers.map((d,i)=>{
        const name=(document.querySelector(`[data-dn="${i}"]`)?.value||'').trim();
        const phone=formatPhone((document.querySelector(`[data-dp="${i}"]`)?.value||'').trim());
        return {id:d.id||uuid(), name, phone, vehicleId:d.vehicleId||null};
      }).filter(d=>d.name);
      // телефоны водителей фирмы из блока карточки
      document.querySelectorAll('[data-own-dp]').forEach(inp=>{
        const idx=+inp.dataset.ownDp;
        if(!(idx>=0) || !state.drivers[idx]) return;
        state.drivers[idx].phone=formatPhone((inp.value||'').trim());
      });
      // контакт с тем же ФИО → телефон водителя этой фирмы
      if(roles.includes('own') && c.id){
        contacts.forEach(p=>{
          const ph=contactPhone(p);
          if(!ph || !p.name) return;
          const rec=findDriverRecord(p.name, c.id);
          if(rec) rec.phone=ph;
        });
      }
      const loads=uniqAddrs((($('co-loads')||{}).value||'').split(/\n/));
      const unloads=uniqAddrs((($('co-unloads')||{}).value||'').split(/\n/));
      const innRaw=String((($('co-inn')||{}).value||'')).replace(/\D/g,'');
      const contractSigned=roles.includes('customer')&&!!($('co-contract-signed')&&$('co-contract-signed').checked);
      const prevFc=typeof normalizeFrameworkContract==='function'?normalizeFrameworkContract(c.frameworkContract):{status:'none'};
      const frameworkContract=contractSigned?{
        ...prevFc,
        status:'signed',
        signedAt:prevFc.signedAt||new Date().toISOString(),
        signedBy:prevFc.signedBy||name
      }:prevFc;
      if(roles.includes('customer') && $('co-portal-enabled')&&$('co-portal-enabled').checked){
        const pp=(($('co-portal-pin')||{}).value||'').trim();
        if(pp.length<4){ alert('Для портала заказчика PIN от 4 цифр'); return; }
        const ph=formatPhone((($('co-portal-phone')||{}).value||'').trim());
        if(!ph){ alert('Укажите телефон для входа в портал'); return; }
      }
      const savedId=c.id;
      upsertCompany({
        id:c.id, name, roles, note:($('co-note').value||'').trim(),
        inn:innRaw, ogrn:(($('co-ogrn')||{}).value||'').trim(),
        kpp:(($('co-kpp')||{}).value||'').trim(),
        address:(($('co-address')||{}).value||'').trim(),
        contacts, vehicles, drivers,
        loadingAddresses:roles.includes('customer')?loads:[],
        unloadingAddresses:roles.includes('customer')?unloads:[],
        phones:c.phones||[],
        spaceId:c.spaceId||catalogSid||currentSpaceId(),
        logistKind:roles.includes('own')?(($('co-dispatcher')||{}).checked?'broker':'staff'):null,
        vatPayer:roles.includes('own')?(($('co-vat-payer')||{}).value==='vat'?'vat':'none'):null,
        portalEnabled:roles.includes('customer')&&!!($('co-portal-enabled')&&$('co-portal-enabled').checked),
        portalPhone:formatPhone((($('co-portal-phone')||{}).value||'').trim()),
        portalPin:(($('co-portal-pin')||{}).value||'').trim(),
        contractSigned,
        frameworkContract:roles.includes('customer')?frameworkContract:undefined,
        bank:normalizeCompanyBank({
          bankName:(($('co-bank-name')||{}).value||'').trim(),
          bankBik:(($('co-bank-bik')||{}).value||'').trim(),
          bankAccount:(($('co-bank-account')||{}).value||'').trim(),
          bankCorrAccount:(($('co-bank-corr')||{}).value||'').trim()
        })
      });
      if(typeof migrateStripSpuriousOwnRoles==='function') migrateStripSpuriousOwnRoles();
      bumpDataEpoch('save-company');
      const saveBtn=$('co-save');
      const prevLabel=saveBtn&&saveBtn.textContent;
      if(saveBtn){ saveBtn.disabled=true; saveBtn.textContent='…'; }
      let saveResult={ ok:navigator.onLine!==false, offline:navigator.onLine===false };
      if(typeof persistCompanyImmediate==='function'){
        saveResult=await persistCompanyImmediate();
      } else {
        persist();
      }
      if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent=prevLabel||'Сохранить'; }
      openCatalogs();
      if(saveResult.ok){
        flashCatOk('Сохранено');
      } else {
        flashCatOk(saveResult.offline?'Сохранено локально — нет связи с сервером':'Сохранено локально — не синхронизировано с сервером', true);
      }
      const saved=findCompanyById(savedId);
      if(saved) openEditor(saved);
    };
  };

  $('co-new').onclick=()=>openEditor(null);
  document.querySelectorAll('[data-edit-co]').forEach(b=>b.onclick=()=>openEditor(findCompanyById(b.dataset.editCo)));
  document.querySelectorAll('[data-del-co]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.delCo;
    state.companies=state.companies.filter(c=>c.id!==id);
    syncCustomersFromCompanies();
    persist(); openCatalogs();
  });
  document.querySelectorAll('[data-open-veh]').forEach(b=>b.onclick=()=>{
    const key=b.dataset.openVeh;
    let v=fleetVehicleById(key);
    if(!v && String(key).startsWith('idx-')) v=state.vehicles[+String(key).slice(4)];
    if(!v && /^\d+$/.test(String(key))) v=state.vehicles[+key];
    if(!v){ alert('Авто не найдено'); return; }
    if(!v.id) v.id=uuid();
    openVehicleCard(v.id);
  });
  document.querySelectorAll('[data-save-veh]').forEach(b=>b.onclick=()=>{
    const i=+b.dataset.saveVeh;
    const v=state.vehicles[i]; if(!v) return;
    const cons=+(($('veh-'+i).value||'').replace(',','.'));
    if(!(cons>0)){ alert('Укажите расход л/100'); return; }
    v.consumptionPer100Km=cons;
    v.payloadTons=numOrNull(($('veh-pay-'+i)||{}).value);
    v.bodyLengthM=numOrNull(($('veh-l-'+i)||{}).value);
    v.bodyWidthM=numOrNull(($('veh-w-'+i)||{}).value);
    v.bodyHeightM=numOrNull(($('veh-h-'+i)||{}).value);
    bumpDataEpoch('save-vehicle');
    persist(); flashCatOk(); openCatalogs();
  });
  document.querySelectorAll('[data-del-veh]').forEach(b=>b.onclick=()=>{
    const i=+b.dataset.delVeh;
    const v=state.vehicles[i];
    if(!v) return;
    const plate=v.plate||'';
    const firm=v.companyName||(findCompanyById(v.companyId)||{}).name||'этой фирмы';
    if(!confirm(`Удалить авто ${plate} из «${firm}»?`)) return;
    const sameFirm=(state.vehicles||[]).filter(x=>v.companyId?x.companyId===v.companyId:x.spaceId===v.spaceId);
    if(sameFirm.length<=1){ alert('В этой фирме должен остаться хотя бы один автомобиль'); return; }
    state.vehicles.splice(i,1);
    bumpDataEpoch('del-vehicle');
    persist(); openCatalogs();
  });
  $('own-veh-add')&&($('own-veh-add').onclick=async ()=>{
    if(!currentAdmin){ alert('Войдите как администратор'); return; }
    const g=await billingGuardCurrentAdminWithServer('add_vehicle');
    if(!g.ok){ alert(g.message); return; }
    const plate=(($('own-veh-plate')||{}).value||'').trim();
    let cons=+((($('own-veh-cons')||{}).value||'').replace(',','.'));
    if(!plate){ alert('Укажите госномер'); return; }
    if(!(cons>0)) cons=20;
    const owner=resolveAdminOwner(currentAdmin.id);
    if(!owner.companyId&&!fleetCo){ alert('Выберите компанию с парком'); return; }
    const companyId=(fleetCo&&fleetCo.id)||owner.companyId;
    const companyName=(fleetCo&&fleetCo.name)||owner.companyName;
    const fleetSpace=(fleetCo&&fleetCo.spaceId)||owner.spaceId;
    const exists=state.vehicles.some(v=>(v.plate||'').toLowerCase()===plate.toLowerCase() && v.companyId===companyId);
    if(exists){ alert('Такой госномер уже есть в этой фирме'); return; }
    const payloadTons=numOrNull(($('own-veh-pay')||{}).value);
    const bodyLengthM=numOrNull(($('own-veh-l')||{}).value);
    const bodyWidthM=numOrNull(($('own-veh-w')||{}).value);
    const bodyHeightM=numOrNull(($('own-veh-h')||{}).value);
    if(!(payloadTons>0)){ alert('Укажите грузоподъёмность (т) — нужна для биржи'); return; }
    state.vehicles.push(normalizeFleetVehicle({
      plate, consumptionPer100Km:cons, payloadTons, bodyLengthM, bodyWidthM, bodyHeightM, makeModel:'',
      spaceId:fleetSpace, companyId, companyName,
      serviceIntervals:[], maintenanceLogs:[]
    }));
    bumpDataEpoch('add-vehicle');
    persist(); openCatalogs();
    flashCatOk();
  });
  document.querySelectorAll('[data-open-drv]').forEach(b=>b.onclick=()=>openDriverCard(b.dataset.openDrv));
  $('own-drv-add')&&($('own-drv-add').onclick=async ()=>{
    if(!currentAdmin){ alert('Войдите как администратор'); return; }
    const g=await billingGuardCurrentAdminWithServer('add_driver');
    if(!g.ok){ alert(g.message); return; }
    const name=(($('own-drv-name')||{}).value||'').trim();
    let pct=+((($('own-drv-pct')||{}).value||'').replace(',','.'));
    const phone=formatPhone((($('own-drv-phone')||{}).value||'').trim());
    let pin=(($('own-drv-pin')||{}).value||'').trim();
    const exchangeEnabled=!!(($('own-drv-ex')||{}).checked);
    if(!name){ alert('Укажите ФИО водителя'); return; }
    if(!phone){ alert('Укажите телефон — по нему водитель входит'); return; }
    if(!pin) pin=phone.slice(-4);
    if(pin.length<4){ alert('PIN от 4 цифр'); return; }
    if(Number.isNaN(pct) || pct<0) pct=30;
    const owner=resolveAdminOwner(currentAdmin.id);
    const drvCo=typeof catalogFleetCompany==='function'?catalogFleetCompany():null;
    const companyId=(drvCo&&drvCo.id)||owner.companyId;
    const companyName=(drvCo&&drvCo.name)||owner.companyName;
    if(!companyId){ alert('Выберите фирму (парк) для водителя'); return; }
    if(driverExistsInCompany(name, companyId)){ alert('Такой водитель уже есть в этой фирме'); return; }
    const newId=uuid();
    state.drivers.push({
      name, salaryPercent:pct, phone, pin, exchangeEnabled,
      id:newId,
      ownerAdminId:owner.ownerAdminId, ownerAdminName:owner.ownerAdminName,
      spaceId:owner.spaceId||null,
      companyId, companyName
    });
    bumpDataEpoch('add-driver');
    persist();
    openDriverCard(newId);
  });
  const finCoSel=$('fin-company');
  if(finCoSel){
    finCoSel.onchange=()=>{
      catalogFinanceCompanyId=finCoSel.value||null;
      catalogTab='finance';
      openCatalogs();
    };
  }
  const drvCoSel=$('drv-company-pick');
  if(drvCoSel){
    drvCoSel.onchange=()=>{
      catalogDriverCompanyId=drvCoSel.value||null;
      catalogActiveCompanyId=catalogDriverCompanyId;
      catalogTab='drivers';
      openCatalogs();
    };
  }
  const vehCoSel=$('veh-company-pick');
  if(vehCoSel){
    vehCoSel.onchange=()=>{
      catalogDriverCompanyId=vehCoSel.value||null;
      catalogActiveCompanyId=catalogDriverCompanyId;
      catalogTab='vehicles';
      openCatalogs();
    };
  }
  $('fin-save')&&($('fin-save').onclick=()=>{
    const co=catalogFinanceCompany();
    if(!co){ alert('Нет «нашей фирмы» для тарифа'); return; }
    const next=normalizeFinance({
      markupPercent:+(($('fin-markup').value||'').replace(',','.')),
      cityKmThreshold:+(($('fin-city').value||'').replace(/\D/g,'')),
      minWorkHours:+(($('fin-minwork').value||'').replace(',','.')),
      podachaHours:+(($('fin-podacha').value||'').replace(',','.')),
      podachaEmptyKmLimit:+(($('fin-podacha-km').value||'').replace(/\D/g,'')),
      defaultRatePerHourWork:+(($('fin-perhour').value||'').replace(',','.')),
      defaultRatePerKmCash:+(($('fin-perkm').value||'').replace(',','.')),
      bodyMultReefer:+(($('fin-reefer')||{}).value||'').replace(',','.')||1.25,
      bodyMultDump:+(($('fin-dump')||{}).value||'').replace(',','.')||1.15,
      heavyTonsFrom:+(($('fin-heavy-t')||{}).value||'').replace(',','.')||20,
      heavyMult:+(($('fin-heavy')||{}).value||'').replace(',','.')||1.15,
      logistFeePercent:+(($('fin-logist-fee')||{}).value||'').replace(',','.')
    });
    co.finance=next;
    // глобальный state.finance — запасной для старых заказов без ownCompanyId
    const my=currentOwnCompany();
    if(my && my.id===co.id) state.finance=Object.assign({}, next);
    catalogFinanceCompanyId=co.id;
    recalculateOrderTariffsForCompany(co.id);
    bumpDataEpoch('tariff-recalc');
    persist();
    try{
      if(state.detailId && typeof openDetail==='function' && (state.orders||[]).some(o=>o.id===state.detailId)){
        openDetail(state.detailId);
      } else {
        catalogTab='finance';
        openCatalogs();
      }
    }catch(_){}
    flashCatOk();
  });
}

