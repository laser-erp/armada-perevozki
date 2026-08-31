/* АРМАДА — оформление ЭП через оператора ЭПД (ссылка из приложения) */
(function(){
  if(typeof globalThis.esc!=='function'){
    globalThis.esc=function esc(s){
      return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
    };
  }

  const EPD_SIGN_ROLES={
    customer:{ kind:'kep', title:'Грузоотправитель · КЭП', hint:'Для подписи T1 в ЭТрН и счетов/договоров. Оформление — у оператора ЭПД (облако или токен).', tituls:'T1' },
    carrier:{ kind:'kep', title:'Перевозчик · КЭП', hint:'Для подписи T2 в ЭТрН от имени организации или ИП. Можно облачную КЭП — с телефона на погрузке.', tituls:'T2' },
    driver:{ kind:'pep', title:'Водитель · ПЭП', hint:'Для отметок T3/T4 в ЭТrН на погрузке и выгрузке. Без токена — регистрация по телефону у оператора.', tituls:'T3, T4' }
  };

  const EPD_OPERATOR_LINKS={
    kontur:{
      name:'Контур.Логистика',
      signup:'https://kontur.ru/logistika/',
      help:'https://kontur.ru/logistika/spravka/22576-elektronnye_transportnye_nakladnye'
    },
    diadoc:{
      name:'Контур.Диадoc',
      signup:'https://www.diadoc.ru/',
      help:'https://diadoc.com/blog/perehod-na-epd-s-1-sentyabrya-2026-goda-kto-obyazan-i-kak-podgotovitsya-k-elektronnomu-obmenu'
    },
    sbis:{
      name:'СБИС',
      signup:'https://sbis.ru/epd',
      help:'https://sbis.ru/epd'
    },
    astral:{
      name:'Астрал-ЭПД',
      signup:'https://astral.ru/products/epd/',
      help:'https://astral.ru/aj/elem/kep-unep-i-mchd-dlya-epd-kakaya-podpis-nuzhna/'
    }
  };

  function ensureEpdSignState(){
    if(!state) return;
    if(!state.epdSignProfiles||typeof state.epdSignProfiles!=='object') state.epdSignProfiles={};
  }

  function epdOperatorId(){
    const op=state&&state.settings&&state.settings.epdOperator;
    return String(op||'kontur').trim().toLowerCase()||'kontur';
  }

  function epdOperatorInfo(){
    return EPD_OPERATOR_LINKS[epdOperatorId()]||EPD_OPERATOR_LINKS.kontur;
  }

  function epdSignProfileKey(role, entityId){
    return `${String(role||'').trim()}:${String(entityId||'').trim()}`;
  }

  function getEpdSignProfile(role, entityId){
    ensureEpdSignState();
    const key=epdSignProfileKey(role, entityId);
    return state.epdSignProfiles[key]||null;
  }

  function upsertEpdSignProfile(role, entityId, patch){
    ensureEpdSignState();
    const key=epdSignProfileKey(role, entityId);
    const prev=state.epdSignProfiles[key]||{};
    const meta=EPD_SIGN_ROLES[role]||{};
    state.epdSignProfiles[key]=Object.assign({
      role,
      entityId:String(entityId||''),
      signKind:meta.kind||'kep',
      status:'none',
      operatorId:epdOperatorId(),
      externalUserId:'',
      issuedAt:'',
      expiresAt:'',
      lastCheckedAt:'',
      pendingUrl:''
    }, prev, patch||{});
    if(typeof persist==='function') persist();
    return state.epdSignProfiles[key];
  }

  function epdSignStatusLabel(st){
    const m={ none:'не оформлена', pending:'ожидает подтверждения', active:'активна', expired:'истекла' };
    return m[st]||st||'—';
  }

  function epdSignStatusCls(st){
    if(st==='active') return 'signed';
    if(st==='pending') return 'sent';
    if(st==='expired') return 'closed';
    return 'draft';
  }

  function epdReturnUrl(role){
    const base=(typeof location!=='undefined'&&location.origin)?location.origin:'https://app.armada.sx';
    const path=(typeof location!=='undefined'&&location.pathname)?location.pathname:'/';
    return `${base}${path}?epd-sign=1&role=${encodeURIComponent(role||'')}`;
  }

  function epdSignContextForRole(role){
    if(role==='customer'&&typeof currentCustomer!=='undefined'&&currentCustomer){
      const co=typeof findCompanyById==='function'?findCompanyById(currentCustomer.companyId):null;
      return {
        entityId:currentCustomer.companyId,
        name:co&&co.name||currentCustomer.name||'',
        inn:co&&co.inn||'',
        phone:currentCustomer.phone||co&&co.portalPhone||''
      };
    }
    if(role==='carrier'&&typeof currentAdmin!=='undefined'&&currentAdmin){
      const ownId=typeof currentAdminOwnCompanyId==='function'?currentAdminOwnCompanyId():'';
      const co=ownId&&typeof findCompanyById==='function'?findCompanyById(ownId):null;
      return {
        entityId:ownId||currentAdmin.id,
        name:co&&co.name||currentAdmin.name||'',
        inn:co&&co.inn||'',
        phone:currentAdmin.phone||''
      };
    }
    if(role==='driver'&&typeof DRIVER!=='undefined'&&DRIVER){
      const rec=(state&&state.drivers||[]).find(d=>d.id===DRIVER)||{};
      return {
        entityId:DRIVER,
        name:rec.name||'',
        inn:'',
        phone:rec.phone||''
      };
    }
    return { entityId:'', name:'', inn:'', phone:'' };
  }

  function epdSignFallbackUrl(role, ctx){
    const op=epdOperatorInfo();
    const q=new URLSearchParams();
    if(ctx&&ctx.inn) q.set('inn', ctx.inn);
    if(ctx&&ctx.phone) q.set('phone', String(ctx.phone).replace(/\D/g,''));
    q.set('utm_source','armada');
    q.set('utm_medium','app');
    q.set('utm_campaign','epd-sign');
    q.set('role', role||'');
    const base=op.signup;
    return base+(base.includes('?')?'&':'?')+q.toString();
  }

  async function fetchEpdSignUpUrl(role, ctx){
    if(typeof API_BASE==='undefined'||!API_BASE) return null;
    const headers=typeof armadaApiJsonHeaders==='function'?armadaApiJsonHeaders():{ Accept:'application/json', 'Content-Type':'application/json' };
    try{
      const r=await fetch(`${API_BASE}/epd/sign-up-url`, {
        method:'POST',
        headers,
        body:JSON.stringify({
          role,
          entityId:ctx.entityId,
          inn:ctx.inn,
          phone:ctx.phone,
          name:ctx.name,
          returnUrl:epdReturnUrl(role)
        })
      });
      if(!r.ok) return null;
      const data=await r.json();
      return data&&data.url?String(data.url):null;
    }catch(_){ return null; }
  }

  async function openEpdSignUp(role, entityId, opts){
    opts=opts||{};
    const ctx=opts.ctx||epdSignContextForRole(role);
    if(entityId) ctx.entityId=entityId;
    if(!ctx.entityId){ alert('Не удалось определить профиль'); return false; }
    upsertEpdSignProfile(role, ctx.entityId, { status:'pending', lastCheckedAt:new Date().toISOString() });
    let url=await fetchEpdSignUpUrl(role, ctx);
    if(!url) url=epdSignFallbackUrl(role, ctx);
    upsertEpdSignProfile(role, ctx.entityId, { pendingUrl:url });
    try{
      window.open(url, '_blank', 'noopener');
    }catch(_){
      location.href=url;
    }
    return true;
  }

  function applyEpdSignReturnFromUrl(){
    try{
      const q=new URLSearchParams(location.search||'');
      if(q.get('epd-sign')!=='1') return;
      const role=String(q.get('role')||'').trim();
      if(!role||!EPD_SIGN_ROLES[role]) return;
      const ctx=epdSignContextForRole(role);
      if(!ctx.entityId) return;
      upsertEpdSignProfile(role, ctx.entityId, {
        status:'active',
        lastCheckedAt:new Date().toISOString(),
        issuedAt:new Date().toISOString()
      });
    }catch(_){}
  }

  function epdSignCardHtml(role, opts){
    opts=opts||{};
    const meta=EPD_SIGN_ROLES[role];
    if(!meta) return '';
    const ctx=opts.ctx||epdSignContextForRole(role);
    const prof=ctx.entityId?getEpdSignProfile(role, ctx.entityId):null;
    const st=prof&&prof.status||'none';
    const op=epdOperatorInfo();
    const kindLabel=meta.kind==='pep'?'ПЭП':'КЭП';
    const btnLabel=st==='active'?'Проверить / продлить':(st==='pending'?'Продолжить оформление':'Оформить '+kindLabel);
    const compact=!!opts.compact;
    return `<section class="epd-sign-card${compact?' epd-sign-card--compact':''}" data-epd-sign-role="${esc(role)}">
      <div class="epd-sign-card-head">
        <h3 class="epd-sign-card-title">${esc(meta.title)}</h3>
        <span class="doc-status ${esc(epdSignStatusCls(st))}">${esc(epdSignStatusLabel(st))}</span>
      </div>
      <p class="hint epd-sign-card-hint">${esc(meta.hint)}</p>
      <p class="meta epd-sign-card-meta">Оператор: <strong>${esc(op.name)}</strong> · титулы ЭТrН: ${esc(meta.tituls)} · ${esc(kindLabel)}</p>
      ${st==='pending'?'<p class="hint">Если окно оператора закрылось — нажмите «Продолжить оформление».</p>':''}
      <div class="epd-sign-card-actions">
        <button type="button" class="primary epd-sign-open" data-epd-sign-role="${esc(role)}" data-epd-entity-id="${esc(ctx.entityId||'')}">${esc(btnLabel)}</button>
        <a class="secondary epd-sign-help" href="${esc(op.help)}" target="_blank" rel="noopener">Справка</a>
      </div>
      ${opts.extra||''}
    </section>`;
  }

  function wireEpdSignCard(root){
    (root||document).querySelectorAll('.epd-sign-open').forEach(btn=>{
      if(btn.dataset.epdWired) return;
      btn.dataset.epdWired='1';
      btn.onclick=async e=>{
        e.preventDefault();
        const role=btn.getAttribute('data-epd-sign-role');
        const entityId=btn.getAttribute('data-epd-entity-id')||'';
        btn.disabled=true;
        try{ await openEpdSignUp(role, entityId); }
        finally{ btn.disabled=false; }
      };
    });
  }

  function renderCustomerEpdSignCard(){
    const host=$('cust-epd-sign-slot');
    if(!host||!currentCustomer) return;
    host.innerHTML=epdSignCardHtml('customer');
    wireEpdSignCard(host);
  }

  function renderAdminEpdSignCard(){
    const host=$('admin-epd-sign-slot');
    if(!host||!currentAdmin) return;
    const driverNote=typeof samePersonName==='function'&&typeof DRIVER!=='undefined'&&DRIVER
      ?''
      :'<p class="hint">Подпись водителя (ПЭП для T3/T4) — в приложении водителя → Профиль.</p>';
    host.innerHTML=epdSignCardHtml('carrier', { extra:driverNote });
    wireEpdSignCard(host);
  }

  function renderDriverEpdSignCard(){
    /* карточка встраивается в showCabinet() */
  }

  function epdSignNeedsAttention(role, entityId){
    const prof=getEpdSignProfile(role, entityId);
    return !prof||prof.status==='none'||prof.status==='expired';
  }

  globalThis.ensureEpdSignState=ensureEpdSignState;
  globalThis.getEpdSignProfile=getEpdSignProfile;
  globalThis.upsertEpdSignProfile=upsertEpdSignProfile;
  globalThis.epdSignCardHtml=epdSignCardHtml;
  globalThis.wireEpdSignCard=wireEpdSignCard;
  globalThis.openEpdSignUp=openEpdSignUp;
  globalThis.renderCustomerEpdSignCard=renderCustomerEpdSignCard;
  globalThis.renderAdminEpdSignCard=renderAdminEpdSignCard;
  globalThis.renderDriverEpdSignCard=renderDriverEpdSignCard;
  globalThis.epdSignNeedsAttention=epdSignNeedsAttention;
  globalThis.applyEpdSignReturnFromUrl=applyEpdSignReturnFromUrl;

  if(typeof document!=='undefined'){
    document.addEventListener('DOMContentLoaded', ()=>applyEpdSignReturnFromUrl());
    if(document.readyState!=='loading') applyEpdSignReturnFromUrl();
  }
})();
