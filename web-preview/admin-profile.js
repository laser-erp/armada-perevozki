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

function renderAdminProfile() {
  const host = $('admin-profile-form');
  if (!host || !currentAdmin) return;
  const adm = findAdminRecord(currentAdmin.id) || currentAdmin;
  const stamp = adminDocImageOrNull(adm.stampDataUrl);
  const signature = adminDocImageOrNull(adm.signatureDataUrl);
  host.innerHTML = `<section class="admin-profile-card">
    <h2>${esc(adm.name)}</h2>
    <p class="cat-panel-hint">Печать и подпись подставляются при печати писем и документов от вашего имени. PNG или JPG, до ${ADMIN_DOC_IMAGE_MAX_KB} КБ каждый файл.</p>
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
  if (typeof renderAdminEpdSignCard === 'function') renderAdminEpdSignCard();
}

function openAdminProfile() {
  if (!currentAdmin) {
    if (typeof fillAdminLoginSelect === 'function') fillAdminLoginSelect();
    show('admin-pin');
    return;
  }
  document.querySelectorAll('.admin-nav-item[data-nav]').forEach(b => {
    b.classList.toggle('on', b.dataset.nav === 'profile');
  });
  renderAdminProfile();
  const back = $('profile-back');
  if (back) back.onclick = () => { show('admin'); renderAdmin(); };
  show('admin-profile-screen');
}
