/* АРМАДА — профиль администратора: печать и подпись для документов */
const DEFAULT_PLATFORM_STAMP = '/assets/armada-stamp.png';
const DEFAULT_PLATFORM_SIGNATURE = '/assets/armada-signature.png';

function findAdminRecord(adminId) {
  return (state.admins || []).find(a => a.id === adminId) || null;
}

function defaultPlatformAssetUrl(path) {
  const origin = typeof location !== 'undefined' && location.origin ? location.origin : '';
  return origin ? `${origin}${path}` : path;
}

function defaultPlatformStampUrl() {
  return defaultPlatformAssetUrl(DEFAULT_PLATFORM_STAMP);
}

function defaultPlatformSignatureUrl() {
  return defaultPlatformAssetUrl(DEFAULT_PLATFORM_SIGNATURE);
}

function adminDocAssets(adminId, opts) {
  opts = opts || {};
  const adm = adminId ? findAdminRecord(adminId) : null;
  const adminStamp = adminDocImageOrNull(adm && adm.stampDataUrl);
  let signature = adminDocImageOrNull(adm && adm.signatureDataUrl);
  let stamp = adminStamp;
  if (!stamp && opts.platformStamp) stamp = defaultPlatformStampUrl();
  if (!signature && (opts.platformSignature || (adm && adm.id === 'admin-super'))) {
    signature = defaultPlatformSignatureUrl();
  }
  return { stamp, signature, admin: adm };
}

function currentAdminDocAssets(opts) {
  const id = currentAdmin && currentAdmin.id;
  return adminDocAssets(id, opts);
}

function adminDocSignMarksHtml(assets, opts) {
  if (!assets) return '';
  opts = opts || {};
  if (opts.blank) {
    return opts.lineFallback !== false ? '<div class="doc-sign-line"></div>' : '';
  }
  const stamp = assets.stamp;
  const signature = assets.signature;
  if (!stamp && !signature) {
    return opts.lineFallback !== false ? '<div class="doc-sign-line"></div>' : '';
  }
  const scan = opts.scan ? ' doc-sign-marks--scan' : '';
  let html = `<div class="doc-sign-marks${scan}">`;
  if (signature) {
    html += `<img class="doc-sign-signature" src="${esc(signature)}" alt="Подпись" />`;
  }
  if (stamp) {
    html += `<img class="doc-sign-stamp" src="${esc(stamp)}" alt="Печать" />`;
  }
  html += '</div>';
  return html;
}

function adminDocSignBlockHtml(leftTitle, rightTitle, leftName, rightName, assets) {
  assets = assets || (typeof currentAdminDocAssets === 'function' ? currentAdminDocAssets() : { stamp: null, signature: null });
  const marks = adminDocSignMarksHtml(assets);
  return `<div class="sign sign--with-marks">
    <div class="sign-col">
      <p class="sign-caption">${esc(leftTitle)}: _______________ / ${esc(leftName || '_______________')}</p>
    </div>
    <div class="sign-col sign-col--executor">
      <p class="sign-caption">${esc(rightTitle)}: _______________ / ${esc(rightName || '_______________')}</p>
      ${marks}
    </div>
  </div>`;
}

function saveAdminDocImage(adminId, key, dataUrl) {
  const adm = findAdminRecord(adminId);
  if (!adm) return false;
  const val = adminDocImageOrNull(dataUrl);
  if (val) adm[key] = val;
  else delete adm[key];
  if (typeof persist === 'function') persist();
  return true;
}

function adminProfilePhone(adm) {
  if (!adm) return '';
  const own = typeof formatPhone === 'function' ? formatPhone(adm.phone || '') : String(adm.phone || '').trim();
  if (own) return own;
  if (typeof adminLoginPhone === 'function') return adminLoginPhone(adm);
  return '';
}

function adminSelfProfileIncomplete(adm) {
  adm = adm || (currentAdmin && findAdminRecord(currentAdmin.id));
  if (!adm) return false;
  const name = String(adm.name || '').trim();
  const phone = adminProfilePhone(adm);
  return name.length < 2 || !phone;
}

function propagateAdminNameChange(adm, name) {
  if (!adm || !name) return;
  const sp = typeof findSpaceById === 'function' ? findSpaceById(adm.spaceId) : null;
  if (sp && sp.adminId === adm.id) sp.adminName = name;
  (state.orders || []).forEach(o => {
    if (o.ownerAdminId === adm.id) o.ownerAdminName = name;
    if (o.createdByAdminId === adm.id) o.createdByAdminName = name;
    if (o.executorAdminId === adm.id) o.executorAdminName = name;
  });
  (state.shifts || []).forEach(s => {
    if (s.ownerAdminId === adm.id) s.ownerAdminName = name;
  });
  (state.adminPresence || []).forEach(p => {
    if (p.adminId === adm.id) p.adminName = name;
  });
}

function saveAdminSelfProfile(adminId, fields) {
  if (!currentAdmin || currentAdmin.id !== adminId) return { ok: false, error: 'Нет доступа' };
  const adm = findAdminRecord(adminId);
  if (!adm) return { ok: false, error: 'Профиль не найден' };
  const name = String(fields && fields.name || '').trim();
  const phoneRaw = String(fields && fields.phone || '').trim();
  if (name.length < 2) return { ok: false, error: 'Укажите ФИО (минимум 2 символа)' };
  if (name.length > 120) return { ok: false, error: 'Слишком длинное имя' };
  if (!phoneRaw) return { ok: false, error: 'Укажите номер телефона' };
  const phone = typeof formatPhone === 'function' ? formatPhone(phoneRaw) : phoneRaw;
  if (!phone) return { ok: false, error: 'Некорректный номер телефона' };
  if (phone && (state.admins || []).some(a => {
    if (a.id === adminId || a.loginBy !== 'phone') return false;
    const other = typeof adminLoginPhone === 'function' ? adminLoginPhone(a) : formatPhone(a.phone || '');
    return other && other === phone;
  })) {
    return { ok: false, error: 'Этот телефон уже привязан к другому администратору' };
  }
  const oldName = String(adm.name || '').trim();
  adm.name = name;
  if (phone) adm.phone = phone;
  else delete adm.phone;
  currentAdmin.name = name;
  if (typeof saveAdminSession === 'function') saveAdminSession();
  if (typeof updateAdminChrome === 'function') updateAdminChrome();
  if (oldName !== name) propagateAdminNameChange(adm, name);
  if (typeof syncAdminAuthToDrivers === 'function') syncAdminAuthToDrivers(adm);
  if (typeof bumpDataEpoch === 'function') bumpDataEpoch('admin-profile');
  if (typeof persist === 'function') persist();
  return { ok: true };
}

function maybeOpenAdminProfileOnLogin(adm) {
  if (!adm || adm.isSuper || !adminSelfProfileIncomplete(adm)) return;
  const key = 'armada-admin-profile-nudge:' + adm.id;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch (_) {}
  setTimeout(() => {
    if (typeof openAdminProfile === 'function') openAdminProfile();
  }, 450);
}

function adminPersonalProfileLabel(){
  return (typeof isSuperAdmin==='function'&&isSuperAdmin())?'Профиль администратора':'Профиль логиста';
}
function syncAdminProfileNavLabels(){
  const lbl=adminPersonalProfileLabel();
  const nav=$('admin-profile');
  const h1=$('admin-profile-title')||document.querySelector('#admin-profile-screen h1');
  if(nav) nav.textContent=lbl;
  if(h1) h1.textContent=lbl;
}
function renderAdminProfile() {
  const host = $('admin-profile-form');
  if (!host || !currentAdmin) return;
  const adm = findAdminRecord(currentAdmin.id) || currentAdmin;
  const stamp = adminDocImageOrNull(adm.stampDataUrl);
  const signature = adminDocImageOrNull(adm.signatureDataUrl);
  const phone = adminProfilePhone(adm);
  const loginHint = adm.loginBy === 'phone'
    ? 'Вход: телефон + PIN.'
    : 'Вход: ИНН организации + PIN.';
  const incomplete = adminSelfProfileIncomplete(adm);
  host.innerHTML = `<section class="admin-profile-card">
    ${incomplete ? '<div class="admin-profile-alert" id="adm-profile-alert">Заполните ФИО и телефон — для связи, документов и входа по телефону (если включит администратор).</div>' : ''}
    <h2 class="form-section-title">Мои данные</h2>
    <p class="cat-panel-hint">Личные данные ${typeof isSuperAdmin==='function'&&isSuperAdmin()?'администратора':'логиста'} — не путать с «Профилем компании» в Справочниках (ИНН, банк, парк).</p>
    <div class="admin-profile-fields">
      <label>ФИО</label>
      <input id="adm-profile-name" type="text" autocomplete="name" placeholder="Иванов Иван Иванович" value="${esc(adm.name || '')}" />
      <label>Телефон</label>
      <input id="adm-profile-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 965 073-00-02" value="${esc(phone)}" />
      <p class="hint">${esc(loginHint)} Способ входа меняет супер-админ в «Активность».</p>
      <button type="button" class="primary" id="adm-profile-save">Сохранить</button>
      <div class="toast-ok" id="adm-profile-ok" style="display:none"></div>
      <div class="hint err" id="adm-profile-err" style="display:none"></div>
    </div>
    <h2 class="form-section-title" style="margin-top:20px">Печать и подпись</h2>
    <p class="cat-panel-hint">Подставляются при печати писем и документов от вашего имени. PNG или JPG, до ${ADMIN_DOC_IMAGE_MAX_KB} КБ каждый файл.</p>
    ${typeof epdSignCardHtml==='function'?epdSignCardHtml('carrier', { extra:'<p class="hint">ПЭП водителя (T3/T4) — в приложении «Водитель» → Профиль.</p>' }):''}
    <div class="admin-profile-grid">
      ${docPhotoUploadRow('Печать организации', stamp, 'id="adm-profile-stamp"', 'id="adm-profile-stamp-clear"')}
      ${docPhotoUploadRow('Подпись', signature, 'id="adm-profile-signature"', 'id="adm-profile-signature-clear"')}
    </div>
    <p class="hint"><strong>Печать</strong> — бланк с пустым местом для подписи в оригинале. <strong>PDF</strong> — готовый документ с печатью и подписью (как на скане). Файлы ниже используются для PDF.</p>
    <div class="admin-profile-preview">
      <p class="meta">Как будет выглядеть в PDF</p>
      <div class="admin-profile-sample">${adminDocSignMarksHtml(adminDocAssets(currentAdmin.id, { platformStamp: true, platformSignature: true }), { scan: true })}</div>
    </div>
  </section>`;

  const saveBtn = $('adm-profile-save');
  if (saveBtn) {
    saveBtn.onclick = () => {
      const err = $('adm-profile-err');
      const ok = $('adm-profile-ok');
      if (err) { err.style.display = 'none'; err.textContent = ''; }
      if (ok) ok.style.display = 'none';
      const result = saveAdminSelfProfile(currentAdmin.id, {
        name: ($('adm-profile-name') || {}).value,
        phone: ($('adm-profile-phone') || {}).value
      });
      if (!result.ok) {
        if (err) { err.textContent = result.error || 'Не удалось сохранить'; err.style.display = 'block'; }
        return;
      }
      if (ok) { ok.textContent = 'Данные сохранены'; ok.style.display = 'block'; }
      renderAdminProfile();
    };
  }

  bindDocPhotoInput($('adm-profile-stamp'), src => {
    saveAdminDocImage(currentAdmin.id, 'stampDataUrl', src);
    renderAdminProfile();
  }, ADMIN_DOC_IMAGE_MAX_KB);
  bindDocPhotoInput($('adm-profile-signature'), src => {
    saveAdminDocImage(currentAdmin.id, 'signatureDataUrl', src);
    renderAdminProfile();
  }, ADMIN_DOC_IMAGE_MAX_KB);
  const stampClear = $('adm-profile-stamp-clear');
  if (stampClear) {
    stampClear.onclick = () => {
      saveAdminDocImage(currentAdmin.id, 'stampDataUrl', null);
      renderAdminProfile();
    };
  }
  const sigClear = $('adm-profile-signature-clear');
  if (sigClear) {
    sigClear.onclick = () => {
      saveAdminDocImage(currentAdmin.id, 'signatureDataUrl', null);
      renderAdminProfile();
    };
  }
  if (typeof wireEpdSignCard === 'function') wireEpdSignCard(host);
}

function openAdminProfile() {
  if (!currentAdmin) {
    if (typeof fillAdminLoginSelect === 'function') fillAdminLoginSelect();
    show('admin-pin');
    return;
  }
  syncAdminProfileNavLabels();
  document.querySelectorAll('.admin-nav-item[data-nav]').forEach(b => {
    b.classList.toggle('on', b.dataset.nav === 'profile');
  });
  renderAdminProfile();
  const back = $('profile-back');
  if (back) back.onclick = () => { show('admin'); renderAdmin(); };
  show('admin-profile-screen');
}
