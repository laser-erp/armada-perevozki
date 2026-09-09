/* АРМАДА — подписи в приложении через оператора ЭПД (окно оператора внутри UI) */
(function(){
  if(typeof globalThis.esc!=='function'){
    globalThis.esc=function esc(s){
      return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
    };
  }

  const EPD_SIGN_ROLES={
    customer:{ kind:'kep', title:'Грузоотправитель · КЭП', hint:'Подпись живёт в АРМАДА: окно оператора откроется здесь. Нужна для T1 в ЭТrН и бухдоков.', tituls:'T1' },
    carrier:{ kind:'kep', title:'Перевозчик · КЭП', hint:'Оформление и подпись T2 — в этом приложении через оператора (облако или токен с телефона).', tituls:'T2' },
    driver:{ kind:'pep', title:'Водитель · ПЭП', hint:'ПЭП для T3/T4 оформляется здесь через оператора — без отдельного приложения.', tituls:'T3, T4' }
  };

  const EPD_OPERATOR_LINKS={
    kontur:{ name:'Контур.Логистика', signup:'https://kontur.ru/logistika/', help:'https://kontur.ru/logistika/spravka/22576-elektronnye_transportnye_nakladnye' },
    diadoc:{ name:'Контур.Диадoc', signup:'https://www.diadoc.ru/', help:'https://diadoc.com/blog/perehod-na-epd-s-1-sentyabrya-2026-goda-kto-obyazan-i-kak-podgotovitsya-k-elektronnomu-obmenu' },
    sbis:{ name:'СБИС', signup:'https://sbis.ru/epd', help:'https://sbis.ru/epd' },
    astral:{ name:'Астрал-ЭПД', signup:'https://astral.ru/products/epd/', help:'https://astral.ru/aj/elem/kep-unep-i-mchd-dlya-epd-kakaya-podpis-nuzhna/' }
  };

  let epdShellOpts=null;
  let epdShellPollTimer=null;

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
    return state.epdSignProfiles[epdSignProfileKey(role, entityId)]||null;
  }

  function upsertEpdSignProfile(role, entityId, patch){
    ensureEpdSignState();
    const key=epdSignProfileKey(role, entityId);
    const prev=state.epdSignProfiles[key]||{};
    const meta=EPD_SIGN_ROLES[role]||{};
    state.epdSignProfiles[key]=Object.assign({
      role, entityId:String(entityId||''), signKind:meta.kind||'kep',
      status:'none', operatorId:epdOperatorId(), externalUserId:'',
      issuedAt:'', expiresAt:'', lastCheckedAt:'', pendingUrl:''
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

  function epdRoleForTitul(titul){
    const t=String(titul||'').toLowerCase();
    if(t==='t1') return 'customer';
    if(t==='t2') return 'carrier';
    return 'driver';
  }

  function epdReturnUrl(extra){
    const base=(typeof location!=='undefined'&&location.origin)?location.origin:'https://app.armada.sx';
    const path=(typeof location!=='undefined'&&location.pathname)?location.pathname:'/';
    const q=new URLSearchParams(Object.assign({ 'epd-sign':'ok' }, extra||{}));
    return `${base}${path}?${q.toString()}`;
  }

  function epdSignContextForRole(role){
    if(role==='customer'&&typeof currentCustomer!=='undefined'&&currentCustomer){
      const co=typeof findCompanyById==='function'?findCompanyById(currentCustomer.companyId):null;
      return { entityId:currentCustomer.companyId, name:co&&co.name||currentCustomer.name||'', inn:co&&co.inn||'', phone:currentCustomer.phone||co&&co.portalPhone||'' };
    }
    if(role==='carrier'){
      if(typeof currentAdmin!=='undefined'&&currentAdmin){
        const ownId=typeof currentAdminOwnCompanyId==='function'?currentAdminOwnCompanyId():'';
        const co=ownId&&typeof findCompanyById==='function'?findCompanyById(ownId):null;
        return { entityId:ownId||currentAdmin.id, name:co&&co.name||currentAdmin.name||'', inn:co&&co.inn||'', phone:currentAdmin.phone||'' };
      }
      if(typeof DRIVER!=='undefined'&&DRIVER&&typeof DRIVER_COMPANY_ID!=='undefined'){
        const co=DRIVER_COMPANY_ID&&typeof findCompanyById==='function'?findCompanyById(DRIVER_COMPANY_ID):null;
        const rec=(state&&state.drivers||[]).find(d=>d.id===DRIVER)||{};
        if(co) return { entityId:co.id, name:co.name||'', inn:co.inn||'', phone:rec.phone||'' };
      }
    }
    if(role==='driver'&&typeof DRIVER!=='undefined'&&DRIVER){
      const rec=(state&&state.drivers||[]).find(d=>d.id===DRIVER)||{};
      return { entityId:DRIVER, name:rec.name||'', inn:'', phone:rec.phone||'' };
    }
    return { entityId:'', name:'', inn:'', phone:'' };
  }

  function epdSignFallbackUrl(role, ctx){
    const op=epdOperatorInfo();
    const q=new URLSearchParams();
    if(ctx&&ctx.inn) q.set('inn', ctx.inn);
    if(ctx&&ctx.phone) q.set('phone', String(ctx.phone).replace(/\D/g,''));
    q.set('utm_source','armada'); q.set('utm_medium','app'); q.set('utm_campaign','epd-inapp'); q.set('role', role||'');
    const base=op.signup;
    return base+(base.includes('?')?'&':'?')+q.toString();
  }

  function epdApiHeaders(){
    return typeof armadaApiJsonHeaders==='function'?armadaApiJsonHeaders():{ Accept:'application/json', 'Content-Type':'application/json' };
  }

  async function fetchEpdSignUpUrl(role, ctx){
    if(typeof API_BASE==='undefined'||!API_BASE) return null;
    try{
      const r=await fetch(`${API_BASE}/epd/sign-up-url`, {
        method:'POST', headers:epdApiHeaders(),
        body:JSON.stringify({ role, entityId:ctx.entityId, inn:ctx.inn, phone:ctx.phone, name:ctx.name, returnUrl:epdReturnUrl({ role }) })
      });
      if(!r.ok) return null;
      const data=await r.json();
      return data&&data.url?String(data.url):null;
    }catch(_){ return null; }
  }

  async function fetchEpdTitulSignUrl(orderId, titul, role){
    if(typeof API_BASE==='undefined'||!API_BASE) return null;
    try{
      const r=await fetch(`${API_BASE}/epd/titul-sign-url`, {
        method:'POST', headers:epdApiHeaders(),
        body:JSON.stringify({ orderId, titul, role, returnUrl:epdReturnUrl({ orderId, titul, role }) })
      });
      if(!r.ok) return null;
      const data=await r.json();
      return data&&data.url?String(data.url):null;
    }catch(_){ return null; }
  }

  async function fetchEpdSignStatus(role, entityId){
    if(typeof API_BASE==='undefined'||!API_BASE||!entityId) return null;
    try{
      const r=await fetch(`${API_BASE}/epd/sign-status?role=${encodeURIComponent(role)}&entityId=${encodeURIComponent(entityId)}`, { headers:epdApiHeaders() });
      if(!r.ok) return null;
      return await r.json();
    }catch(_){ return null; }
  }

  async function syncEpdSignProfileFromApi(role, entityId){
    const data=await fetchEpdSignStatus(role, entityId);
    if(!data) return null;
    return upsertEpdSignProfile(role, entityId, {
      status:data.status||'pending',
      externalUserId:data.externalUserId||'',
      issuedAt:data.issuedAt||'',
      expiresAt:data.expiresAt||'',
      lastCheckedAt:new Date().toISOString()
    });
  }

  function ensureEpdOperatorShell(){
    let shell=$('epd-operator-shell');
    if(shell) return shell;
    shell=document.createElement('div');
    shell.id='epd-operator-shell';
    shell.className='epd-operator-shell';
    shell.hidden=true;
    shell.innerHTML=`<div class="epd-operator-panel" role="dialog" aria-modal="true" aria-labelledby="epd-operator-title">
      <header class="epd-operator-head">
        <button type="button" class="form-back" id="epd-operator-close">← Назад</button>
        <h2 id="epd-operator-title">Подпись · оператор ЭПД</h2>
        <button type="button" class="hint epd-operator-ext" id="epd-operator-ext" type="button">В браузере</button>
      </header>
      <p class="hint epd-operator-lead" id="epd-operator-lead">Ключ и юридическая сила — у аккредитованного оператора. АРМАДА показывает его окно здесь; статус подписи сохраняется в вашем профиле.</p>
      <div class="epd-operator-body">
        <iframe id="epd-operator-frame" class="epd-operator-frame" title="Оператор ЭПД" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"></iframe>
        <div class="epd-operator-sandbox" id="epd-operator-sandbox" hidden></div>
      </div>
      <div class="epd-operator-fallback" id="epd-operator-fallback" hidden>
        <p class="hint">Сайт оператора не открывается во фрейме — это их политика безопасности.</p>
        <button type="button" class="primary" id="epd-operator-fallback-open">Открыть оператора</button>
        <button type="button" class="secondary" id="epd-operator-fallback-done">Подпись выпущена</button>
      </div>
      <footer class="epd-operator-foot" id="epd-operator-foot" hidden>
        <button type="button" class="primary" id="epd-operator-confirm">Подпись выпущена</button>
        <p class="hint">Нажимайте только после завершения у оператора. «Назад» — выход без смены статуса.</p>
      </footer>
    </div>`;
    document.body.appendChild(shell);
    $('epd-operator-close').onclick=()=>{
      if(epdShellOpts&&epdShellOpts.kind==='signup') closeEpdOperatorShell({ abort:true });
      else closeEpdOperatorShell({ refresh:true });
    };
    $('epd-operator-fallback-open').onclick=()=>{
      if(epdShellOpts&&epdShellOpts.url) window.open(epdShellOpts.url, '_blank', 'noopener');
    };
    $('epd-operator-fallback-done').onclick=()=>closeEpdOperatorShell({ confirmed:true });
    $('epd-operator-confirm').onclick=()=>closeEpdOperatorShell({ confirmed:true });
    $('epd-operator-ext').onclick=()=>{
      if(epdShellOpts&&epdShellOpts.url) window.open(epdShellOpts.url, '_blank', 'noopener');
    };
    return shell;
  }

  function epdShowOperatorFallback(show){
    const fb=$('epd-operator-fallback');
    const frame=$('epd-operator-frame');
    if(fb) fb.hidden=!show;
    if(frame) frame.hidden=!!show;
  }

  function openEpdOperatorShell(url, opts){
    opts=opts||{};
    epdShellOpts=Object.assign({
      url,
      title:opts.title||'Подпись · оператор ЭПД',
      onClose:opts.onClose,
      mode:opts.mode||'iframe',
      kind:opts.kind||'titul',
      prevStatus:opts.prevStatus||'none',
      pollRole:opts.pollRole||'',
      pollEntityId:opts.pollEntityId||''
    }, opts);
    const shell=ensureEpdOperatorShell();
    const title=$('epd-operator-title');
    const lead=$('epd-operator-lead');
    const frame=$('epd-operator-frame');
    const sandbox=$('epd-operator-sandbox');
    const foot=$('epd-operator-foot');
    if(title) title.textContent=epdShellOpts.title;
    if(lead) lead.textContent=opts.lead||'Ключ и юридическая сила — у оператора ЭПД. Окно открыто внутри АРМАДА.';
    if(foot) foot.hidden=(epdShellOpts.kind!=='signup');
    epdShowOperatorFallback(false);
    if(sandbox) sandbox.hidden=true;
    if(frame){
      frame.hidden=false;
      frame.removeAttribute('srcdoc');
      frame.onload=()=>{ epdShowOperatorFallback(false); };
      frame.onerror=()=>{ epdShowOperatorFallback(true); };
      clearTimeout(openEpdOperatorShell._frameTimer);
      openEpdOperatorShell._frameTimer=setTimeout(()=>{
        try{
          const doc=frame.contentDocument;
          if(doc&&doc.body&&doc.body.childElementCount===0) epdShowOperatorFallback(true);
        }catch(_){
          /* cross-origin — iframe likely loaded */
        }
      }, 4500);
      frame.src=url;
    }
    shell.hidden=false;
    document.body.classList.add('epd-operator-open');
    clearInterval(epdShellPollTimer);
    epdShellPollTimer=setInterval(()=>{
      if(shell.hidden) return;
      if(opts.pollRole&&opts.pollEntityId) syncEpdSignProfileFromApi(opts.pollRole, opts.pollEntityId);
    }, 12000);
    return true;
  }

  function openEpdSandboxPanel(html, opts){
    opts=opts||{};
    epdShellOpts={ mode:'sandbox', kind:'sandbox', onClose:opts.onClose, title:opts.title||'Подпись (тест)' };
    const shell=ensureEpdOperatorShell();
    const title=$('epd-operator-title');
    const frame=$('epd-operator-frame');
    const sandbox=$('epd-operator-sandbox');
    if(title) title.textContent=epdShellOpts.title;
    epdShowOperatorFallback(false);
    if(frame){ frame.hidden=true; frame.removeAttribute('src'); }
    if(sandbox){ sandbox.hidden=false; sandbox.innerHTML=html; }
    shell.hidden=false;
    document.body.classList.add('epd-operator-open');
    return true;
  }

  async function epdMarkSignUpComplete(role, entityId){
    if(!role||!entityId) return;
    const synced=await syncEpdSignProfileFromApi(role, entityId);
    if(synced&&synced.status==='active') return;
    if(!confirm('Вы завершили выпуск подписи у оператора?\n\nНажмите «ОК» только если регистрация действительно пройдена.')) return;
    upsertEpdSignProfile(role, entityId, { status:'active', issuedAt:new Date().toISOString(), lastCheckedAt:new Date().toISOString() });
  }

  function epdSignUpAbort(role, entityId, prevStatus){
    if(!role||!entityId) return;
    if(prevStatus==='active'){
      upsertEpdSignProfile(role, entityId, { lastCheckedAt:new Date().toISOString() });
      return;
    }
    upsertEpdSignProfile(role, entityId, { status:'none', pendingUrl:'', lastCheckedAt:new Date().toISOString() });
  }

  async function closeEpdOperatorShell(opts){
    if(typeof opts==='boolean') opts={ refresh:opts };
    opts=opts||{};
    const shell=$('epd-operator-shell');
    const saved=epdShellOpts;
    if(shell) shell.hidden=true;
    document.body.classList.remove('epd-operator-open');
    clearInterval(epdShellPollTimer);
    epdShellPollTimer=null;
    const frame=$('epd-operator-frame');
    if(frame){ frame.removeAttribute('src'); frame.hidden=false; }
    const sandbox=$('epd-operator-sandbox');
    if(sandbox){ sandbox.hidden=true; sandbox.innerHTML=''; }
    const foot=$('epd-operator-foot');
    if(foot) foot.hidden=true;
    epdShellOpts=null;
    if(saved){
      if(opts.confirmed&&saved.kind==='signup'){
        await epdMarkSignUpComplete(saved.pollRole, saved.pollEntityId);
      }else if(opts.abort&&saved.kind==='signup'){
        epdSignUpAbort(saved.pollRole, saved.pollEntityId, saved.prevStatus);
      }else if(opts.refresh){
        if(saved.pollRole&&saved.pollEntityId) await syncEpdSignProfileFromApi(saved.pollRole, saved.pollEntityId);
        if(typeof saved.onClose==='function') await saved.onClose();
      }
      epdRefreshUi(saved);
    }
  }

  function epdRefreshUi(opts){
    opts=opts||{};
    if(typeof renderCustomerPortal==='function'&&(typeof currentCustomer!=='undefined'&&currentCustomer)) renderCustomerPortal();
    if(typeof renderAdminEpdSignCard==='function') renderAdminEpdSignCard();
    if(typeof renderAdminProfile==='function'&&typeof currentAdmin!=='undefined'&&currentAdmin) renderAdminProfile();
    if(typeof renderDriverBanner==='function') renderDriverBanner();
    if(typeof showCabinet==='function'&&opts.refreshDriverCabinet) showCabinet();
    if(typeof renderAdminDetail==='function'&&state&&state.detailId) renderAdminDetail();
    if(typeof bumpDataEpoch==='function') bumpDataEpoch('epd-sign');
  }

  async function openEpdSignUp(role, entityId, opts){
    opts=opts||{};
    const ctx=opts.ctx||epdSignContextForRole(role);
    if(entityId) ctx.entityId=entityId;
    if(!ctx.entityId){ alert('Не удалось определить профиль'); return false; }
    const prof=getEpdSignProfile(role, ctx.entityId);
    const prevStatus=(prof&&prof.status)||'none';
    let url=await fetchEpdSignUpUrl(role, ctx);
    if(!url) url=epdSignFallbackUrl(role, ctx);
    upsertEpdSignProfile(role, ctx.entityId, { pendingUrl:url, lastCheckedAt:new Date().toISOString() });
    const op=epdOperatorInfo();
    return openEpdOperatorShell(url, {
      kind:'signup',
      prevStatus,
      title:`Выпустить подпись · ${op.name}`,
      lead:`Оформление ${EPD_SIGN_ROLES[role].kind==='pep'?'ПЭП':'КЭП'} через ${op.name}. После выпуска нажмите «Подпись выпущена». «Назад» — без смены статуса.`,
      pollRole:role, pollEntityId:ctx.entityId
    });
  }

  async function openEpdTitulSign(orderId, titul, role){
    titul=String(titul||'').toLowerCase();
    role=role||epdRoleForTitul(titul);
    const o=(state&&state.orders||[]).find(x=>x.id===orderId);
    if(!o){ alert('Заказ не найден'); return false; }
    if(!o.etrn&&typeof ensureEtrnForOrder==='function') ensureEtrnForOrder(o, { silent:true });
    const titLabel=typeof etrnTitulLabel==='function'?etrnTitulLabel(titul):titul.toUpperCase();
    const ctx=epdSignContextForRole(role);
    let url=await fetchEpdTitulSignUrl(orderId, titul, role);
    if(url&&!String(url).startsWith('sandbox://')){
      return openEpdOperatorShell(url, {
        title:`ЭТrН · ${titLabel}`,
        lead:`Подпись титула через оператора. Документ остаётся в АРМАДА, подпись — у оператора ЭПД.`,
        pollRole:role, pollEntityId:ctx.entityId,
        onClose:async()=>{
          if(typeof fetchEtrnFromApi==='function'){
            const remote=await fetchEtrnFromApi(orderId);
            if(remote){ applyEtrnToOrder(o, remote); upsertOrder(o); persist(); }
          }
        }
      });
    }
    const op=epdOperatorInfo();
    const prof=getEpdSignProfile(role, ctx.entityId);
    const needIssue=!prof||prof.status!=='active';
    const sandboxHtml=`<div class="epd-sandbox-card">
      <p><strong>${esc(titLabel)}</strong> · заказ № ${esc(o.sequentialNumber||'—')}</p>
      <p class="hint">${needIssue?`Сначала оформите ${EPD_SIGN_ROLES[role].kind==='pep'?'ПЭП':'КЭП'} — кнопка ниже.`:''} Сейчас тестовый контур: подпись имитируется до подключения ${esc(op.name)} на сервере.</p>
      ${needIssue?`<button type="button" class="secondary" id="epd-sandbox-issue">Оформить подпись через оператора</button>`:''}
      <button type="button" class="primary" id="epd-sandbox-confirm">Подписать ${esc(titul.toUpperCase())} (sandbox)</button>
    </div>`;
    openEpdSandboxPanel(sandboxHtml, {
      title:`ЭТrН · ${titLabel}`,
      onClose:()=>epdRefreshUi({ refreshDriverCabinet:role==='driver' })
    });
    const issueBtn=$('epd-sandbox-issue');
    if(issueBtn) issueBtn.onclick=async()=>{ await closeEpdOperatorShell({ refresh:false }); await openEpdSignUp(role, ctx.entityId); };
    const confirmBtn=$('epd-sandbox-confirm');
    if(confirmBtn) confirmBtn.onclick=()=>{
      if(typeof signEtrnTitul==='function'){
        const by=role==='customer'?(typeof orderShipperInfo==='function'?(orderShipperInfo(o).name||'грузоотправитель'):'грузоотправитель')
          :role==='carrier'?'перевозчик':(typeof DRIVER!=='undefined'&&DRIVER?DRIVER:'водитель');
        signEtrnTitul(orderId, titul, by);
      }
      closeEpdOperatorShell({ refresh:true });
    };
    return true;
  }

  function applyEpdSignReturnFromUrl(){
    try{
      const q=new URLSearchParams(location.search||'');
      const signFlag=String(q.get('epd-sign')||'').trim();
      if(signFlag!=='ok'&&signFlag!=='1') return;
      const role=String(q.get('role')||'').trim();
      const orderId=String(q.get('orderId')||'').trim();
      const titul=String(q.get('titul')||'').trim();
      if(role&&EPD_SIGN_ROLES[role]){
        const ctx=epdSignContextForRole(role);
        if(ctx.entityId) upsertEpdSignProfile(role, ctx.entityId, { status:'active', issuedAt:new Date().toISOString(), lastCheckedAt:new Date().toISOString() });
      }
      if(orderId&&titul&&typeof fetchEtrnFromApi==='function'){
        fetchEtrnFromApi(orderId).then(remote=>{
          if(!remote) return;
          const o=(state.orders||[]).find(x=>x.id===orderId);
          if(o){ applyEtrnToOrder(o, remote); upsertOrder(o); persist(); epdRefreshUi({}); }
        });
      }
      epdRefreshUi({});
    }catch(_){}
  }

  function epdSignPlaqueHtml(st, kindLabel){
    if(st==='active'){
      return `<div class="epd-sign-plaque epd-sign-plaque--active" role="status">
        <span class="epd-sign-plaque-icon" aria-hidden="true">✓</span>
        <div class="epd-sign-plaque-body">
          <strong>Подпись активна</strong>
          <span class="hint">${esc(kindLabel)} готова к использованию в документах и ЭТrН</span>
        </div>
      </div>`;
    }
    if(st==='pending'){
      return `<div class="epd-sign-plaque epd-sign-plaque--pending" role="status">
        <span class="epd-sign-plaque-icon" aria-hidden="true">…</span>
        <div class="epd-sign-plaque-body">
          <strong>Оформление не завершено</strong>
          <span class="hint">Завершите выпуск у оператора ЭПД</span>
        </div>
      </div>`;
    }
    if(st==='expired'){
      return `<div class="epd-sign-plaque epd-sign-plaque--expired" role="status">
        <span class="epd-sign-plaque-icon" aria-hidden="true">!</span>
        <div class="epd-sign-plaque-body">
          <strong>Подпись истекла</strong>
          <span class="hint">Выпустите ${esc(kindLabel)} заново</span>
        </div>
      </div>`;
    }
    return `<div class="epd-sign-plaque epd-sign-plaque--none" role="status">
      <span class="epd-sign-plaque-icon" aria-hidden="true">○</span>
      <div class="epd-sign-plaque-body">
        <strong>Подпись не оформлена</strong>
        <span class="hint">Нужна для подписания документов через оператора</span>
      </div>
    </div>`;
  }

  function epdSignButtonsHtml(st, role, ctx, kindLabel, opts){
    opts=opts||{};
    const short=!!opts.compact;
    const issueLbl=short?'Выпустить':`Выпустить ${kindLabel}`;
    const issueBtn=`<button type="button" class="primary epd-sign-open" data-epd-sign-role="${esc(role)}" data-epd-entity-id="${esc(ctx.entityId||'')}">${esc(issueLbl)}</button>`;
    const continueBtn=`<button type="button" class="primary epd-sign-open" data-epd-sign-role="${esc(role)}" data-epd-entity-id="${esc(ctx.entityId||'')}">Продолжить</button>`;
    const renewBtn=`<button type="button" class="primary epd-sign-open" data-epd-sign-role="${esc(role)}" data-epd-entity-id="${esc(ctx.entityId||'')}">Заново</button>`;
    const checkBtn=`<button type="button" class="secondary epd-sign-check" data-epd-sign-role="${esc(role)}" data-epd-entity-id="${esc(ctx.entityId||'')}">${short?'Статус':'Проверить'}</button>`;
    const resetBtn=`<button type="button" class="hint epd-sign-reset" data-epd-sign-role="${esc(role)}" data-epd-entity-id="${esc(ctx.entityId||'')}">Сброс</button>`;
    if(st==='active') return short?'':`${checkBtn}${resetBtn}`;
    if(st==='pending') return `${continueBtn}${checkBtn}`;
    if(st==='expired') return `${renewBtn}`;
    return `${issueBtn}`;
  }

  function epdSignActionsHtml(st, role, ctx, kindLabel){
    return `<div class="epd-sign-card-actions">${epdSignButtonsHtml(st, role, ctx, kindLabel)}</div>`;
  }

  function epdSignCustomerStripHtml(){
    if(typeof currentCustomer==='undefined'||!currentCustomer) return '';
    const role='customer';
    const meta=EPD_SIGN_ROLES[role];
    const ctx=epdSignContextForRole(role);
    if(!ctx.entityId) return '';
    const prof=getEpdSignProfile(role, ctx.entityId);
    const st=prof&&prof.status||'none';
    const kindLabel=meta.kind==='pep'?'ПЭП':'КЭП';
    if(st==='active'){
      return `<div class="cust-alert-row cust-alert-row--ok" data-epd-sign-role="${esc(role)}">
        <span class="cust-alert-row-dot" aria-hidden="true"></span>
        <div class="cust-alert-row-main">
          <span class="cust-alert-row-label">${esc(kindLabel)}</span>
          <span class="cust-alert-row-sub">Подпись активна</span>
        </div>
      </div>`;
    }
    const subs={ none:`Выпустите ${kindLabel} для подписания документов`, pending:'Завершите выпуск у оператора', expired:`${kindLabel} истекла — выпустите заново` };
    const sub=subs[st]||subs.none;
    const actions=epdSignButtonsHtml(st, role, ctx, kindLabel, { compact:true });
    if(!actions) return '';
    return `<div class="cust-alert-row cust-alert-row--sign" data-epd-sign-role="${esc(role)}">
      <span class="cust-alert-row-dot" aria-hidden="true"></span>
      <div class="cust-alert-row-main">
        <span class="cust-alert-row-label">${esc(kindLabel)}</span>
        <span class="cust-alert-row-sub">${esc(sub)}</span>
      </div>
      <div class="cust-alert-row-actions">${actions}</div>
    </div>`;
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
    const issuedLine=prof&&prof.issuedAt&&st==='active'
      ?`<p class="meta epd-sign-issued">Выпущена: ${esc(typeof dateTime==='function'?dateTime(prof.issuedAt):prof.issuedAt)}</p>`:'';
    return `<section class="epd-sign-card epd-sign-card--${esc(st)}${opts.compact?' epd-sign-card--compact':''}" data-epd-sign-role="${esc(role)}">
      <h3 class="epd-sign-section-title">Электронная подпись</h3>
      <p class="meta epd-sign-card-sub">${esc(meta.title)}</p>
      ${epdSignPlaqueHtml(st, kindLabel)}
      ${issuedLine}
      <p class="hint epd-sign-card-hint">${esc(meta.hint)}</p>
      <p class="meta epd-sign-card-meta">Оператор <strong>${esc(op.name)}</strong> · ${esc(kindLabel)} · ЭТrН ${esc(meta.tituls)}</p>
      ${epdSignActionsHtml(st, role, ctx, kindLabel)}
      ${opts.extra||''}
    </section>`;
  }

  function wireEpdSignCard(root){
    (root||document).querySelectorAll('.epd-sign-open').forEach(btn=>{
      if(btn.dataset.epdWired) return;
      btn.dataset.epdWired='1';
      btn.onclick=async e=>{
        e.preventDefault();
        btn.disabled=true;
        try{ await openEpdSignUp(btn.getAttribute('data-epd-sign-role'), btn.getAttribute('data-epd-entity-id')||''); }
        finally{ btn.disabled=false; }
      };
    });
    (root||document).querySelectorAll('.epd-sign-check').forEach(btn=>{
      if(btn.dataset.epdCheckWired) return;
      btn.dataset.epdCheckWired='1';
      btn.onclick=async e=>{
        e.preventDefault();
        const role=btn.getAttribute('data-epd-sign-role');
        const entityId=btn.getAttribute('data-epd-entity-id')||'';
        btn.disabled=true;
        try{
          const synced=await syncEpdSignProfileFromApi(role, entityId);
          if(!synced) alert('Статус на сервере пока недоступен — подключите оператора ЭПД.');
          epdRefreshUi({ refreshDriverCabinet:role==='driver' });
        }finally{ btn.disabled=false; }
      };
    });
    (root||document).querySelectorAll('.epd-sign-reset').forEach(btn=>{
      if(btn.dataset.epdResetWired) return;
      btn.dataset.epdResetWired='1';
      btn.onclick=e=>{
        e.preventDefault();
        const role=btn.getAttribute('data-epd-sign-role');
        const entityId=btn.getAttribute('data-epd-entity-id')||'';
        if(!confirm('Сбросить статус подписи? Используйте, если «активна» появилась ошибочно.')) return;
        upsertEpdSignProfile(role, entityId, { status:'none', pendingUrl:'', issuedAt:'', expiresAt:'' });
        epdRefreshUi({ refreshDriverCabinet:role==='driver' });
      };
    });
  }

  function renderCustomerEpdSignCard(){
    if(typeof renderCustomerDocsAlerts==='function'){ renderCustomerDocsAlerts(); return; }
    const host=$('cust-docs-alerts')||$('cust-epd-sign-slot');
    if(!host||!currentCustomer) return;
    host.innerHTML=epdSignCustomerStripHtml()||epdSignCardHtml('customer');
    host.hidden=!host.innerHTML.trim();
    wireEpdSignCard(host);
  }

  function renderAdminEpdSignCard(){
    /* карточка встроена в renderAdminProfile() */
  }

  function epdSignNeedsAttention(role, entityId){
    const prof=getEpdSignProfile(role, entityId);
    return !prof||prof.status==='none'||prof.status==='expired';
  }

  globalThis.ensureEpdSignState=ensureEpdSignState;
  globalThis.getEpdSignProfile=getEpdSignProfile;
  globalThis.upsertEpdSignProfile=upsertEpdSignProfile;
  globalThis.epdSignCardHtml=epdSignCardHtml;
  globalThis.epdSignCustomerStripHtml=epdSignCustomerStripHtml;
  globalThis.wireEpdSignCard=wireEpdSignCard;
  globalThis.openEpdSignUp=openEpdSignUp;
  globalThis.openEpdTitulSign=openEpdTitulSign;
  globalThis.openEpdOperatorShell=openEpdOperatorShell;
  globalThis.closeEpdOperatorShell=closeEpdOperatorShell;
  globalThis.epdRoleForTitul=epdRoleForTitul;
  globalThis.renderCustomerEpdSignCard=renderCustomerEpdSignCard;
  globalThis.renderAdminEpdSignCard=renderAdminEpdSignCard;
  globalThis.epdSignNeedsAttention=epdSignNeedsAttention;
  globalThis.applyEpdSignReturnFromUrl=applyEpdSignReturnFromUrl;
  globalThis.syncEpdSignProfileFromApi=syncEpdSignProfileFromApi;

  if(typeof document!=='undefined'){
    document.addEventListener('DOMContentLoaded', ()=>applyEpdSignReturnFromUrl());
    if(document.readyState!=='loading') applyEpdSignReturnFromUrl();
    window.addEventListener('message', ev=>{
      try{
        const d=ev.data;
        if(!d||d.type!=='armada-epd-sign-done') return;
        closeEpdOperatorShell({ confirmed:true });
      }catch(_){}
    });
  }
})();
