/** QR + шаблоны SMS для входов и портала (вариант B + элементы C). */
function carrierInitials(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return 'А';
  if(parts.length===1) return parts[0].slice(0,2).toUpperCase();
  return (parts[0][0]+parts[1][0]).toUpperCase();
}
function portalScopeCarrierSpace(scope){
  const sc=typeof resolvePortalScope==='function'?resolvePortalScope(scope):null;
  if(!sc) return null;
  if(sc.spaceId) return findSpaceById(sc.spaceId);
  if(sc.portalSlug) return findSpaceByPortalSlug(sc.portalSlug);
  if(sc.companyId){
    const co=typeof findCompanyById==='function'?findCompanyById(sc.companyId):null;
    if(co&&co.spaceId) return findSpaceById(co.spaceId);
  }
  return null;
}
function driverEntryPageUrl(){
  return typeof entryLandingPage==='function'?entryLandingPage('driver'):`${location.origin}/v`;
}
function adminEntryPageUrl(){
  return typeof entryLandingPage==='function'?entryLandingPage('admin'):`${location.origin}/a`;
}
function smsTemplate(kind, opts){
  const o=opts&&typeof opts==='object'?opts:{};
  const carrier=String(o.carrier||'АРМАДА').trim()||'АРМАДА';
  const url=String(o.url||'').trim();
  const exp=String(o.expires||'7 дней').trim();
  if(kind==='customerPortal'){
    return `${carrier}: портал заказчика — подать заявку и смотреть статус.\n${url}`;
  }
  if(kind==='driverInvite'){
    return `${carrier}: вход в АРМАДА для водителя (ссылка до ${exp}).\n${url}\n\nОткройте, задайте PIN.`;
  }
  if(kind==='driverEntry'){
    return `${carrier}: вход водителя в АРМАДА — смена, ЕТО, заказы.\n${url}`;
  }
  if(kind==='adminEntry'){
    return `АРМАДА: кабинет диспетчера.\n${url}`;
  }
  return url;
}
function drawQrCanvas(text, size){
  const qr=typeof qrcode==='function'?qrcode(0,'M'):null;
  if(!qr) return null;
  qr.addData(String(text||''));
  qr.make();
  const n=qr.getModuleCount();
  const cell=Math.max(2, Math.floor(size/n));
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=n*cell;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#0f172a';
  for(let r=0;r<n;r++){
    for(let c=0;c<n;c++){
      if(qr.isDark(r,c)) ctx.fillRect(c*cell,r*cell,cell,cell);
    }
  }
  return canvas;
}
function renderQrInto(el, text, size){
  if(!el) return;
  el.innerHTML='';
  const canvas=drawQrCanvas(text, size||200);
  if(!canvas){ el.textContent='QR недоступен'; return; }
  canvas.className='share-qr-canvas';
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','QR-код');
  el.appendChild(canvas);
}
function openShareSheet(opts){
  const o=opts&&typeof opts==='object'?opts:{};
  const sheet=$('share-sheet');
  if(!sheet) return;
  const title=$('share-sheet-title');
  const qr=$('share-sheet-qr');
  const sms=$('share-sheet-sms');
  const url=String(o.url||'').trim();
  const body=smsTemplate(o.kind, o);
  if(title) title.textContent=String(o.title||'Ссылка и SMS');
  if(sms) sms.value=body;
  renderQrInto(qr, url, 220);
  const smsLink=$('share-sms-link');
  if(smsLink){
    const phone=formatPhone(o.phone||'');
    smsLink.href=phone?`sms:${encodeURIComponent(phone)}?body=${encodeURIComponent(body)}`:`sms:?body=${encodeURIComponent(body)}`;
    smsLink.style.display=url?'inline-flex':'none';
  }
  sheet.dataset.shareUrl=url;
  sheet.dataset.shareSms=body;
  sheet.hidden=false;
  sheet.classList.add('show');
}
function closeShareSheet(){
  const sheet=$('share-sheet');
  if(!sheet) return;
  sheet.hidden=true;
  sheet.classList.remove('show');
}
function copyShareText(text, okMsg){
  const t=String(text||'');
  if(!t) return;
  const done=()=>{ if(okMsg) alert(okMsg); };
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(done).catch(()=>prompt('Скопируйте:', t));
  } else prompt('Скопируйте:', t);
}
function shareSheetHtml(){
  return `<div id="share-sheet" class="share-sheet" hidden>
    <div class="share-sheet-backdrop" id="share-sheet-backdrop"></div>
    <div class="share-sheet-panel" role="dialog" aria-labelledby="share-sheet-title">
      <h3 id="share-sheet-title">Ссылка и SMS</h3>
      <div id="share-sheet-qr" class="share-qr-wrap"></div>
      <label class="share-sms-label" for="share-sheet-sms">Текст для SMS / мессенджера</label>
      <textarea id="share-sheet-sms" class="share-sms-text" rows="5" readonly></textarea>
      <div class="share-sheet-actions">
        <button type="button" class="primary" id="share-copy-sms">Скопировать SMS</button>
        <button type="button" class="secondary" id="share-copy-link">Скопировать ссылку</button>
        <a class="secondary share-sms-link" id="share-sms-link" href="#">Отправить SMS</a>
      </div>
      <button type="button" class="ghost share-sheet-close" id="share-sheet-close">Закрыть</button>
    </div>
  </div>`;
}
function initShareSheet(){
  if($('share-sheet')) return;
  document.body.insertAdjacentHTML('beforeend', shareSheetHtml());
  $('share-sheet-close').onclick=closeShareSheet;
  $('share-sheet-backdrop').onclick=closeShareSheet;
  $('share-copy-sms').onclick=()=>{
    const sheet=$('share-sheet');
    copyShareText(sheet&&sheet.dataset.shareSms, 'SMS скопирован — вставьте в сообщение');
  };
  $('share-copy-link').onclick=()=>{
    const sheet=$('share-sheet');
    copyShareText(sheet&&sheet.dataset.shareUrl, 'Ссылка скопирована');
  };
}
function carrierBrandHtml(label, space){
  const name=String(label||'').trim();
  if(!name) return '';
  const sp=space||null;
  const logo=sp&&sp.portalLogo&&String(sp.portalLogo).startsWith('data:image')?sp.portalLogo:'';
  const avatar=logo
    ? `<img class="entry-carrier-logo" src="${esc(logo)}" alt="" />`
    : `<div class="entry-carrier-avatar" aria-hidden="true">${esc(carrierInitials(name))}</div>`;
  const inn=sp&&sp.inn?`<p class="entry-carrier-inn">ИНН ${esc(sp.inn)}</p>`:'';
  return `<div class="entry-aside-carrier-wrap">
    <div class="entry-carrier-brand">${avatar}
      <div>
        <p class="entry-aside-carrier">${esc(name)}</p>
        <p class="entry-aside-lead" style="margin:0">Ваш перевозчик</p>
        ${inn}
      </div>
    </div>
  </div>`;
}
function entryShareBlockHtml(opts){
  const o=opts&&typeof opts==='object'?opts:{};
  const url=String(o.url||'');
  const kind=String(o.kind||'customerPortal');
  const title=String(o.title||'QR и SMS');
  const carrier=String(o.carrier||'');
  const phone=String(o.phone||'');
  const expires=String(o.expires||'');
  const dataAttrs=[
    `data-share-kind="${esc(kind)}"`,
    `data-share-url="${esc(url)}"`,
    `data-share-title="${esc(title)}"`,
    carrier?`data-share-carrier="${esc(carrier)}"`:'',
    phone?`data-share-phone="${esc(phone)}"`:'',
    expires?`data-share-expires="${esc(expires)}"`:''
  ].filter(Boolean).join(' ');
  return `<button type="button" class="secondary entry-share-btn" ${dataAttrs}>${esc(title)}</button>`;
}
function wireEntryShareButtons(root){
  const box=root||document;
  box.querySelectorAll('.entry-share-btn').forEach(btn=>{
    btn.onclick=()=>{
      openShareSheet({
        kind:btn.dataset.shareKind,
        url:btn.dataset.shareUrl,
        title:btn.dataset.shareTitle||'Ссылка и SMS',
        carrier:btn.dataset.shareCarrier,
        phone:btn.dataset.sharePhone,
        expires:btn.dataset.shareExpires
      });
    };
  });
}
