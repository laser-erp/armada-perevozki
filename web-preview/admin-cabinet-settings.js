/* АРМАДА — «Настройки кабинета»: сотрудники, парк, партнёры */
let cabinetSettingsView='hub';
let cabinetSettingsFromHub=false;

function cabinetSettingsStats(){
  const sid=typeof currentSpaceId==='function'?currentSpaceId():null;
  const inSpace=(c)=>typeof companyInMySpace==='function'?companyInMySpace(c):true;
  const ownCo=typeof currentOwnCompany==='function'?currentOwnCompany():null;
  const staff=(state.admins||[]).filter(a=>a&&a.spaceId===sid&&!a.isSuper);
  const superHere=isSuperAdmin()&&sid?1:0;
  const drv=ownCo&&typeof fleetDriversForCompany==='function'?fleetDriversForCompany(ownCo.id).length:0;
  const veh=ownCo&&typeof fleetVehiclesForCompany==='function'?fleetVehiclesForCompany(ownCo.id).length:0;
  const customers=(state.companies||[]).filter(c=>inSpace(c)&&typeof companyHasRole==='function'&&companyHasRole(c,'customer')&&!companyHasRole(c,'own'));
  const carriers=(state.companies||[]).filter(c=>inSpace(c)&&typeof companyHasRole==='function'&&companyHasRole(c,'carrier')&&!companyHasRole(c,'own'));
  return {staff:staff.length+superHere, drv, veh, customers:customers.length, carriers:carriers.length, ownCo};
}

function markCabinetSettingsNavOn(){
  document.querySelectorAll('.admin-nav-item[data-nav]').forEach(b=>{
    b.classList.toggle('on', b.dataset.nav==='settings');
  });
}

function openCabinetSettings(view){
  if(!currentAdmin){
    if(typeof fillAdminLoginSelect==='function') fillAdminLoginSelect();
    show('admin-pin');
    return;
  }
  cabinetSettingsView=view||'hub';
  markCabinetSettingsNavOn();
  if(typeof paintCatalogOwnerFilters==='function') paintCatalogOwnerFilters();
  const form=$('cabinet-settings-form');
  const title=$('cabinet-settings-title');
  if(!form) return;
  if(title){
    const titles={
      hub:'Настройки кабинета',
      staff:'Сотрудники',
      fleet:'Свой автопарк',
      'partners-customers':'Партнёры · Заказчики',
      'partners-carriers':'Партнёры · Перевозчики'
    };
    title.textContent=titles[cabinetSettingsView]||titles.hub;
  }
  if(cabinetSettingsView==='hub') renderCabinetSettingsHub(form);
  else if(cabinetSettingsView==='staff') renderCabinetSettingsStaff(form);
  else if(cabinetSettingsView==='fleet') renderCabinetSettingsFleet(form);
  else if(cabinetSettingsView==='partners-customers') renderCabinetSettingsPartners(form,'customer');
  else if(cabinetSettingsView==='partners-carriers') renderCabinetSettingsPartners(form,'carrier');
  const back=$('cabinet-settings-back');
  if(back){
    back.onclick=()=>{
      if(cabinetSettingsView==='hub'){ show('admin'); renderAdmin(); }
      else openCabinetSettings('hub');
    };
  }
  show('admin-cabinet-settings-screen');
}

function cabinetBlockHtml(title, meta, hint, btnLabel, dataGo){
  return `<section class="cabinet-block">
    <button type="button" class="cabinet-block-open" data-cab-go="${esc(dataGo)}">
      <h3 class="cabinet-block-title">${esc(title)}</h3>
      <p class="cabinet-block-meta">${esc(meta)}</p>
      ${hint?`<p class="cabinet-block-hint">${hint}</p>`:''}
      <span class="cabinet-block-cta">${esc(btnLabel)} →</span>
    </button>
  </section>`;
}

function renderCabinetSettingsHub(form){
  const st=cabinetSettingsStats();
  const checklist=typeof pilotSetupChecklistHtml==='function'?pilotSetupChecklistHtml():'';
  form.innerHTML=`
    ${checklist}
    <p class="cat-panel-hint">Всё для настройки кабинета до работы с заказами. Парк, ЕТО и биржа — в меню слева.</p>
    ${cabinetBlockHtml(
      '1. Сотрудники',
      `${st.staff} в кабинете`,
      'Администратор, логисты, ваш профиль',
      'Открыть',
      'staff'
    )}
    ${cabinetBlockHtml(
      '2. Свой автопарк',
      st.ownCo?`${st.drv} вод. · ${st.veh} ТС · ${esc(st.ownCo.name)}`:'Фирма не задана',
      'Компания, водители, авто, тариф',
      'Открыть',
      'fleet'
    )}
    ${cabinetBlockHtml(
      '3. Партнёры',
      `${st.customers} заказч. · ${st.carriers} перев.`,
      'Контрагенты; договор PDF перед обменом данными',
      'Открыть',
      'partners-customers'
    )}
  `;
  form.querySelectorAll('[data-cab-go]').forEach(b=>b.onclick=()=>{
    const go=b.dataset.cabGo;
    if(go==='partners-customers') openCabinetSettings('partners-customers');
    else openCabinetSettings(go);
  });
}

function renderCabinetSettingsStaff(form){
  const sid=currentSpaceId();
  const list=(state.admins||[]).filter(a=>a&&(a.spaceId===sid||a.isSuper&&isSuperAdmin()));
  const owner=typeof findSpaceById==='function'&&sid?(findSpaceById(sid)||{}).adminId:null;
  const rows=list.map(a=>{
    const isOwner=owner&&a.id===owner;
    const roleLbl=a.isSuper?'супер-админ':isOwner?'администратор кабинета':'логист';
    const self=currentAdmin&&a.id===currentAdmin.id;
    return `<div class="dense-row">
      <div class="grow">
        <div class="name">${esc(a.name)}${self?' <span class="chip hot">вы</span>':''}</div>
        <div class="meta">${esc(roleLbl)}${a.phone?` · ☎ ${esc(formatPhone(a.phone))}`:''}${a.skipDriverMirror?' · без профиля водителя':''}</div>
      </div>
    </div>`;
  }).join('')||`<div class="hint">Нет записей — обратитесь к администратору платформы для подключения кабинета.</div>`;
  form.innerHTML=`
    <p class="cat-panel-hint">Офисные сотрудники кабинета. Профиль водителя для логиста не создаётся автоматически.</p>
    <div class="cabinet-subnav">
      <button type="button" class="secondary" id="cab-my-profile">Мой профиль логиста</button>
    </div>
    <h4 class="form-section-title" style="margin-top:12px">В кабинете</h4>
    <div class="cat-list">${rows}</div>
    <p class="hint">Приглашение новых логистов — в следующем обновлении. Сейчас кабинет подключает супер-админ в «Активность».</p>
  `;
  const prof=$('cab-my-profile');
  if(prof) prof.onclick=()=>{
    cabinetSettingsOpenProfile=true;
    if(typeof openAdminProfile==='function') openAdminProfile();
  };
}

function renderCabinetSettingsFleet(form){
  const st=cabinetSettingsStats();
  const co=st.ownCo;
  const sid=currentSpaceId();
  const portal=sid&&typeof customerPortalPageUrl==='function'?customerPortalPageUrl({spaceId:sid}):'';
  const drvUrl=typeof driverEntryPageUrl==='function'?driverEntryPageUrl():'/v';
  form.innerHTML=`
    <p class="cat-panel-hint">${co?`Парк «${esc(co.name)}».`:''} Тоннаж, документы и ТО — в карточках водителя и авто.</p>
    <div class="cabinet-tiles">
      <button type="button" class="cabinet-tile" data-cat-from-cab="companies"><span class="cabinet-tile-n">🏢</span><b>Профиль компании</b><span class="meta">ИНН, банк, НДС</span></button>
      <button type="button" class="cabinet-tile" data-cat-from-cab="drivers"><span class="cabinet-tile-n">${st.drv}</span><b>Водители</b><span class="meta">PIN, документы</span></button>
      <button type="button" class="cabinet-tile" data-cat-from-cab="vehicles"><span class="cabinet-tile-n">${st.veh}</span><b>Авто</b><span class="meta">ТС, ТО, СТС</span></button>
      <button type="button" class="cabinet-tile" data-cat-from-cab="finance"><span class="cabinet-tile-n">₽</span><b>Тариф</b><span class="meta">₽/км, ₽/ч, пакет</span></button>
    </div>
    <h4 class="form-section-title">Ссылки</h4>
    <p class="hint">Водитель: <a href="${esc(drvUrl)}" target="_blank" rel="noopener">${esc(drvUrl)}</a></p>
    ${portal?`<p class="hint">Портал заказчика: <a href="${esc(portal)}" target="_blank" rel="noopener">${esc(portal)}</a></p>`:''}
  `;
  form.querySelectorAll('[data-cat-from-cab]').forEach(b=>b.onclick=()=>openCatalogsFromCabinet(b.dataset.catFromCab));
}

function renderCabinetSettingsPartners(form, role){
  const inSpace=(c)=>typeof companyInMySpace==='function'?companyInMySpace(c):true;
  const list=(state.companies||[]).filter(c=>{
    if(!inSpace(c)||companyHasRole(c,'own')) return false;
    return companyHasRole(c, role);
  });
  const roleLbl=role==='customer'?'заказчик':'перевозчик';
  const tabs=`
    <div class="cabinet-partner-tabs">
      <button type="button" class="${role==='customer'?'on':''}" data-partner-tab="customer">Заказчики</button>
      <button type="button" class="${role==='carrier'?'on':''}" data-partner-tab="carrier">Перевозчики</button>
    </div>`;
  const cards=list.map(c=>{
    const fcSt=role==='customer'&&typeof customerFrameworkContractStatus==='function'?customerFrameworkContractStatus(c):null;
    const fcBadge=fcSt==='signed'?'<span class="chip ok">договор</span>':fcSt==='pending'?'<span class="chip">договор…</span>':'';
    const nDrv=role==='carrier'&&typeof fleetDriversForCompany==='function'?fleetDriversForCompany(c.id).length:0;
    const nVeh=role==='carrier'&&typeof fleetVehiclesForCompany==='function'?fleetVehiclesForCompany(c.id).length:(c.vehicles||[]).length;
    const meta=role==='customer'
      ? [c.inn?`ИНН ${c.inn}`:null, c.portalEnabled?'портал':null].filter(Boolean).join(' · ')
      : [`вод. ${nDrv}`, `ТС ${nVeh}`].join(' · ');
    return `<div class="dense-row" data-co-row="${esc(c.id)}">
      <button type="button" class="grow" data-edit-co-partner="${esc(c.id)}">
        <div class="name">${esc(c.name)} ${fcBadge}</div>
        <div class="meta">${esc(meta||roleLbl)}</div>
      </button>
      <button type="button" class="icon-btn danger" data-del-co-partner="${esc(c.id)}" title="Удалить">×</button>
    </div>`;
  }).join('')||`<div class="hint">Пока нет ${role==='customer'?'заказчиков':'перевозчиков'} — добавьте ниже</div>`;
  form.innerHTML=`
    ${tabs}
    <p class="cat-panel-hint">${role==='customer'
      ? 'Заказчик: портал /z, рамочный договор PDF перед работой.'
      : 'Перевозчик-партнёр: ТС и водители вручную или из сети АРМАДА после договора (скоро).'}</p>
    <div class="row" style="gap:6px;margin-bottom:8px">
      <button type="button" class="primary cat-add-btn" id="cab-partner-new" style="width:auto;flex:0 0 auto;padding:8px 14px!important">+ ${role==='customer'?'Заказчик':'Перевозчик'}</button>
      ${role==='customer'&&sid()?`<button type="button" class="secondary" id="cab-portal-link" style="width:auto;flex:1">Портал / QR</button>`:''}
    </div>
    <div class="cat-list" id="cab-partner-list">${cards}</div>
  `;
  form.querySelectorAll('[data-partner-tab]').forEach(b=>b.onclick=()=>{
    openCabinetSettings(b.dataset.partnerTab==='customer'?'partners-customers':'partners-carriers');
  });
  $('cab-partner-new')&&($('cab-partner-new').onclick=()=>openPartnerEditorFromCabinet(null, role));
  document.querySelectorAll('[data-edit-co-partner]').forEach(b=>b.onclick=()=>{
    openPartnerEditorFromCabinet(findCompanyById(b.dataset.editCoPartner), role);
  });
  document.querySelectorAll('[data-del-co-partner]').forEach(b=>b.onclick=()=>{
    if(!confirm('Удалить компанию из справочника?')) return;
    state.companies=(state.companies||[]).filter(c=>c.id!==b.dataset.delCoPartner);
    bumpDataEpoch('del-company');
    persist();
    openCabinetSettings(role==='customer'?'partners-customers':'partners-carriers');
  });
  const pl=$('cab-portal-link');
  if(pl) pl.onclick=()=>{
    if(typeof openAdminLinks==='function') openAdminLinks();
  };
}

function sid(){
  return typeof currentSpaceId==='function'?currentSpaceId():null;
}

function openPartnerEditorFromCabinet(company, role){
  cabinetSettingsFromHub=true;
  cabinetSettingsPartnerRole=role;
  if(typeof openCatalogs==='function'){
    catalogTab='companies';
    openCatalogs();
    if(company) setTimeout(()=>{
      const btn=document.querySelector(`[data-edit-co="${company.id}"]`);
      if(btn) btn.click();
    }, 50);
    else setTimeout(()=>{ $('co-new')&&$('co-new').click(); }, 50);
  }
}

let cabinetSettingsPartnerRole=null;
let cabinetSettingsOpenProfile=false;

function openCatalogsFromCabinet(tab){
  cabinetSettingsFromHub=true;
  catalogTab=tab||'companies';
  if(typeof openCatalogs==='function') openCatalogs();
}

function cabinetSettingsBackFromCatalogs(){
  cabinetSettingsFromHub=false;
  if(catalogTab==='companies'||catalogTab==='finance') openCabinetSettings('fleet');
  else if(catalogTab==='drivers'||catalogTab==='vehicles') openCabinetSettings('fleet');
  else openCabinetSettings('hub');
}

function cabinetSettingsBackTargetForCatalog(){
  if(!cabinetSettingsFromHub) return null;
  if(catalogTab==='drivers'||catalogTab==='vehicles'||catalogTab==='finance'||catalogTab==='companies') return 'fleet';
  return 'hub';
}
