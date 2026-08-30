/* АРМАДА — раздел «Документы» в админке */
let adminDocsTab = 'buh';
let adminDocsRoleFilter = 'all';
let adminDocsFirmFilter = '';
let adminDocsSearch = '';
let adminDocsConstructorTpl = 'application';
let adminDocsConstructorOrderId = '';

const ADMIN_LEGAL_DOCS = [
  { id: 'full', n: '📦', title: 'Полный юридический пакет', meta: 'Все 7 документов одним PDF', href: 'legal-pdf/ARMADA_Legal_Package_Full.pdf' },
  { id: '01', n: '01', title: 'Публичная оферта SaaS', meta: 'Главный договор с клиентом сервиса', href: 'legal-pdf/01-public-offer.pdf' },
  { id: '02', n: '02', title: 'Политика конфиденциальности (152-ФЗ)', meta: 'Для сайта и портала заказчика', href: 'legal-pdf/02-privacy-policy.pdf' },
  { id: '03', n: '03', title: 'Согласие на обработку ПДн', meta: 'Форма при регистрации заказчика', href: 'legal-pdf/03-pd-consent.pdf' },
  { id: '04', n: '04', title: 'Cookies / localStorage', meta: 'Техническое уведомление', href: 'legal-pdf/04-cookie-notice.pdf' },
  { id: '05', n: '05', title: 'Комиссия биржи', meta: 'Дополнение к оферте', href: 'legal-pdf/05-exchange-agency.pdf' },
  { id: '06', n: '06', title: 'Соглашение о пилоте', meta: 'Шаблон для партнёра-перевозчика', href: 'legal-pdf/06-pilot-agreement.pdf' },
  { id: '07', n: '07', title: 'Поручение на обработку ПДн', meta: 'SaaS / 152-ФЗ', href: 'legal-pdf/07-pd-processing-order.pdf' },
  { id: 'kp', n: 'КП', title: 'Коммерческое предложение', meta: 'Не юридический договор · для рассылки', href: 'legal-pdf/ARMADA_Commercial_Proposal.pdf' }
];

function adminDocsSpaceId() {
  return typeof currentSpaceId === 'function' ? currentSpaceId() : null;
}

function adminDocsLetterheadHtml(co, sp) {
  const p = typeof resolveParty === 'function'
    ? resolveParty(co && co.id, co && co.name, sp && sp.id || (co && co.spaceId))
    : { name: (co && co.name) || (sp && sp.name) || 'АРМАДА', inn: '', kpp: '', ogrn: '', address: '' };
  const req = [
    p.address ? esc(p.address) : '',
    p.inn ? `ИНН ${esc(p.inn)}` : '',
    p.kpp ? `КПП ${esc(p.kpp)}` : '',
    p.ogrn ? `ОГРН ${esc(p.ogrn)}` : ''
  ].filter(Boolean).join(' · ');
  return `<header class="adm-letterhead">
    <img class="adm-letterhead__logo" src="/icons/icon-192.png" alt="" width="68" height="68" />
    <div class="adm-letterhead__brand">
      <p class="adm-letterhead__name">${esc(p.name)}</p>
      ${req ? `<p class="adm-letterhead__req">${req}</p>` : ''}
      <p class="adm-letterhead__contacts">app.armada.sx · документы АРМАДА</p>
    </div>
  </header>`;
}

function openAdminLetterBlank() {
  const sid = adminDocsSpaceId();
  if (typeof openDocTemplatePrint === 'function' && sid) {
    openDocTemplatePrint('letter', sid, null);
    return;
  }
  const co = typeof currentOwnCompany === 'function' ? currentOwnCompany() : null;
  const sp = adminDocsSpaceId() ? findSpaceById(adminDocsSpaceId()) : null;
  const body = `${adminDocsLetterheadHtml(co, sp)}
    <p style="text-align:right">Исх. № _____ от «___» __________ 20__ г.</p>
    <p>Кому: _______________________</p>
    <p>Уважаемые коллеги!</p>
    <p>Текст письма…</p>
    <p style="margin-top:32px">________________ / ________________</p>`;
  if (typeof openPrintHtml === 'function') {
    openPrintHtml('Письмо на фирменном бланке', `<div class="adm-letter-page">${body}</div>`);
  }
}

function adminDocsLegalPanelHtml() {
  const cards = ADMIN_LEGAL_DOCS.map(d => `
    <div class="adm-doc-card">
      <div>
        <span class="adm-doc-badge">${esc(d.n)}</span>
        <h3>${esc(d.title)}</h3>
        <p class="meta">${esc(d.meta)}</p>
      </div>
      <div class="adm-doc-actions">
        <a class="secondary" href="${esc(d.href)}" target="_blank" rel="noopener">PDF</a>
      </div>
    </div>`).join('');
  return `<p class="cat-panel-hint">Юридические документы SaaS (оферта, ПДн). Бухгалтерские документы по заявкам — вкладка «Бух.доки».</p>
    <p class="hint"><a href="legal.html" target="_blank" rel="noopener">legal.html</a> — страница для сайта и заказчиков.</p>
    ${cards}`;
}

function adminDocsBuhToolbarHtml() {
  const superAll = typeof isSuperAdmin === 'function' && isSuperAdmin();
  const firmFilter = adminDocsFirmFilter || adminDocsDefaultFirmFilter();
  let firmOpts = '';
  if (superAll) {
    const spaces = (state.spaces || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
    firmOpts = `<select id="adm-docs-firm" aria-label="Фирма">
      <option value="all"${firmFilter === 'all' ? ' selected' : ''}>Все фирмы (супер-админ)</option>
      ${spaces.map(s => `<option value="${esc(s.id)}"${firmFilter === s.id ? ' selected' : ''}>${esc(s.name || s.id)}</option>`).join('')}
    </select>`;
  }
  return `<div class="adm-docs-toolbar">
    ${firmOpts}
    <select id="adm-docs-role" aria-label="Роль в сделке">
      <option value="all"${adminDocsRoleFilter === 'all' ? ' selected' : ''}>Все роли</option>
      <option value="carrier"${adminDocsRoleFilter === 'carrier' ? ' selected' : ''}>Мы перевозчик</option>
      <option value="customer"${adminDocsRoleFilter === 'customer' ? ' selected' : ''}>Мы заказчик</option>
    </select>
    <input type="search" id="adm-docs-search" placeholder="Заказчик, № заявки…" value="${esc(adminDocsSearch)}" />
  </div>`;
}

function adminDocsOrderGroupHtml(o, viewSpaceId) {
  const role = typeof orderDocRoleForSpace === 'function' ? orderDocRoleForSpace(o, viewSpaceId) : null;
  const roleLbl = typeof orderDocRoleLabel === 'function' ? orderDocRoleLabel(role) : '';
  const when = o.vehicleAt ? dayOnly(o.vehicleAt) : dayOnly(o.createdAt);
  const items = typeof adminOrderDocItems === 'function' ? adminOrderDocItems() : [];
  const lines = items.map(it => {
    const st = typeof customerOrderDocStatus === 'function' ? customerOrderDocStatus(it.id, o) : { label: '—', cls: 'draft', available: false };
    const openBtn = st.available
      ? `<button type="button" class="secondary adm-doc-open" data-order-id="${esc(o.id)}" data-doc-kind="${esc(it.id)}">Открыть</button>`
      : `<span class="hint">${esc(st.label)}</span>`;
    return `<div class="adm-order-doc-line">
      <span>${esc(it.title)} · <span class="doc-status ${esc(st.cls)}">${esc(st.label)}</span></span>
      <span>${openBtn}</span>
    </div>`;
  }).join('');
  const readyCount = items.filter(it => {
    const st = customerOrderDocStatus(it.id, o);
    return st.available;
  }).length;
  const packBtn = readyCount
    ? `<button type="button" class="primary adm-doc-pack" data-order-id="${esc(o.id)}">Скачать всё (${readyCount})</button>`
    : '';
  return `<div class="adm-order-group">
    <div class="adm-order-group-head">
      <h4>№${esc(o.sequentialNumber)} · ${esc(o.customer || '—')} · ${esc(when || '—')}</h4>
      ${roleLbl ? `<span class="adm-doc-role-tag">${esc(roleLbl)}</span>` : ''}
    </div>
    <p class="meta">${esc(routeText(o) || '—')}${o.ownCompanyName ? ` · ${esc(o.ownCompanyName)}` : ''}</p>
    ${lines}
    <div class="adm-order-pack-row">${packBtn}</div>
  </div>`;
}

function adminDocsBuhPanelHtml() {
  const sid = adminDocsSpaceId();
  const superAll = typeof isSuperAdmin === 'function' && isSuperAdmin();
  const firmFilter = adminDocsFirmFilter || adminDocsDefaultFirmFilter();
  const viewSpaceId = superAll && firmFilter !== 'all' ? firmFilter : sid;
  const orders = typeof adminOrdersForDocs === 'function'
    ? adminOrdersForDocs({
      spaceId: sid,
      superAll,
      roleFilter: adminDocsRoleFilter,
      firmFilter,
      search: adminDocsSearch
    })
    : [];
  const scopeHint = superAll && firmFilter === 'all'
    ? '<p class="hint">Супер-админ: сейчас все фирмы. Чтобы видеть только свою — выберите её в списке.</p>'
    : superAll
      ? `<p class="hint">Фирма: ${esc((findSpaceById(firmFilter) || {}).name || firmFilter)}</p>`
      : `<p class="hint">Только документы вашей фирмы${sid ? '' : ' (нет space у учётки)'}</p>`;
  const list = orders.length
    ? orders.slice(0, 40).map(o => adminDocsOrderGroupHtml(o, viewSpaceId)).join('')
    : '<div class="empty">Нет заявок по выбранным фильтрам</div>';
  const more = orders.length > 40 ? `<p class="hint">Показаны последние 40 из ${orders.length}. Уточните поиск.</p>` : '';
  return `${adminDocsBuhToolbarHtml()}
    ${scopeHint}
    <p class="cat-panel-hint">Реальные счета, договоры и акты по заявкам. «Мы заказчик» — биржа и субподряд. «Мы перевозчик» — ваш парк или забор с биржи.</p>
    ${list}${more}`;
}

function adminDocsLettersPanelHtml() {
  return `<p class="cat-panel-hint">Исходящие на фирменном бланке вашей фирмы. Текст письма редактируется в <button type="button" class="linkish" data-adm-goto-constructor="letter">Конструкторе</button>.</p>
    <div class="adm-doc-card">
      <div><h3>Пустой фирменный бланк</h3><p class="meta">Новое письмо · реквизиты из «Наша фирма»</p></div>
      <div class="adm-doc-actions"><button type="button" class="primary" id="adm-letter-blank">Открыть</button></div>
    </div>
    <div class="adm-doc-card">
      <div><h3>Письма операторам ЭТрН</h3><p class="meta">Контур · Калуга Астрал · шаблон PDF</p></div>
      <div class="adm-doc-actions"><a class="secondary" href="downloads/ARMADA_Pismo_Operatoram_ETRN.pdf" target="_blank" rel="noopener">PDF</a></div>
    </div>`;
}

function adminDocsConstructorPanelHtml() {
  const sid = adminDocsSpaceId();
  if (!sid) {
    return '<div class="empty">Нет space у администратора — шаблоны привязаны к фирме.</div>';
  }
  const canEdit = typeof canEditDocTemplatesForSpace === 'function' && canEditDocTemplatesForSpace(sid);
  const sp = findSpaceById(sid);
  const tplId = adminDocsConstructorTpl || 'application';
  const body = typeof getDocTemplateBody === 'function' ? getDocTemplateBody(sid, tplId) : '';
  const sample = typeof docTemplateSampleOrder === 'function' ? docTemplateSampleOrder(sid) : null;
  let order = sample;
  if (adminDocsConstructorOrderId) {
    order = (state.orders || []).find(o => o.id === adminDocsConstructorOrderId) || sample;
  }
  const preview = typeof renderDocTemplatePreviewHtml === 'function'
    ? renderDocTemplatePreviewHtml(tplId, body, order, sid)
    : '';
  const orderOpts = (state.orders || [])
    .filter(o => o && (o.spaceId === sid || o.partnerSpaceId === sid))
    .slice(0, 30)
    .map(o => `<option value="${esc(o.id)}"${order && order.id === o.id ? ' selected' : ''}>№${esc(o.sequentialNumber)} · ${esc(o.customer || '—')}</option>`)
    .join('');
  const tplList = (typeof DOC_TEMPLATE_CATALOG !== 'undefined' ? DOC_TEMPLATE_CATALOG : []).map(t => `
    <button type="button" class="adm-tpl-item${t.id === tplId ? ' on' : ''}" data-adm-tpl-id="${esc(t.id)}">
      <span class="adm-tpl-item-title">${esc(t.title)}</span>
      <span class="adm-tpl-item-hint">${esc(t.hint)}</span>
    </button>`).join('');
  const vars = (typeof DOC_TEMPLATE_VARS !== 'undefined' ? DOC_TEMPLATE_VARS : []).map(v =>
    `<button type="button" class="adm-tpl-var" data-adm-tpl-var="${esc(v.key)}" title="${esc(v.label)}">${esc(v.key)}</button>`
  ).join('');
  const readOnlyHint = canEdit
    ? `<p class="cat-panel-hint">Шаблоны фирмы «${esc(sp && sp.name || sid)}». После сохранения подстановка полей используется при печати документов.</p>`
    : `<p class="hint">Просмотр шаблонов другой фирмы. Редактировать можно только шаблоны своего space${typeof isSuperAdmin === 'function' && isSuperAdmin() ? ' (ваш space как супер-админа)' : ''}.</p>`;
  return `${readOnlyHint}
    <div class="adm-tpl-layout">
      <aside class="adm-tpl-side">
        <h3 class="adm-tpl-side-title">Шаблоны</h3>
        <div class="adm-tpl-list">${tplList}</div>
        <h3 class="adm-tpl-side-title">Поля</h3>
        <div class="adm-tpl-vars">${vars}</div>
      </aside>
      <div class="adm-tpl-main">
        <div class="adm-tpl-toolbar">
          <label class="adm-tpl-order-lbl">Пример заявки
            <select id="adm-tpl-order"${canEdit ? '' : ' disabled'}>
              <option value="">— демо-данные —</option>
              ${orderOpts}
            </select>
          </label>
          <div class="adm-tpl-actions">
            ${canEdit ? `<button type="button" class="secondary" id="adm-tpl-reset">Сброс</button>
              <button type="button" class="primary" id="adm-tpl-save">Сохранить</button>` : ''}
            <button type="button" class="secondary" id="adm-tpl-print">Печать</button>
          </div>
        </div>
        <textarea id="adm-tpl-editor" class="adm-tpl-editor" rows="14"${canEdit ? '' : ' readonly'}>${esc(body)}</textarea>
        <h3 class="adm-tpl-preview-title">Превью на бланке</h3>
        <div class="adm-tpl-preview-wrap" id="adm-tpl-preview">${preview}</div>
      </div>
    </div>`;
}

function refreshAdminDocsConstructorPreview() {
  const sid = adminDocsSpaceId();
  const editor = $('adm-tpl-editor');
  const box = $('adm-tpl-preview');
  if (!sid || !editor || !box) return;
  const tplId = adminDocsConstructorTpl || 'application';
  let order = null;
  const sel = $('adm-tpl-order');
  if (sel && sel.value) order = (state.orders || []).find(o => o.id === sel.value) || null;
  else if (typeof docTemplateSampleOrder === 'function') order = docTemplateSampleOrder(sid);
  if (typeof renderDocTemplatePreviewHtml === 'function') {
    box.innerHTML = renderDocTemplatePreviewHtml(tplId, editor.value, order, sid);
  }
}

function wireAdminDocsConstructor() {
  document.querySelectorAll('[data-adm-tpl-id]').forEach(b => {
    b.onclick = () => {
      adminDocsConstructorTpl = b.dataset.admTplId;
      renderAdminDocsBody();
    };
  });
  document.querySelectorAll('[data-adm-goto-constructor]').forEach(b => {
    b.onclick = () => {
      adminDocsTab = 'constructor';
      if (b.dataset.admGotoConstructor) adminDocsConstructorTpl = b.dataset.admGotoConstructor;
      paintAdminDocsTabs();
      renderAdminDocsBody();
    };
  });
  document.querySelectorAll('[data-adm-tpl-var]').forEach(b => {
    b.onclick = () => {
      const ta = $('adm-tpl-editor');
      if (!ta || ta.readOnly) return;
      const key = b.dataset.admTplVar || '';
      const start = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
      const end = ta.selectionEnd != null ? ta.selectionEnd : start;
      ta.value = ta.value.slice(0, start) + key + ta.value.slice(end);
      ta.focus();
      refreshAdminDocsConstructorPreview();
    };
  });
  const editor = $('adm-tpl-editor');
  if (editor && !editor.readOnly) {
    editor.oninput = () => {
      clearTimeout(wireAdminDocsConstructor._pv);
      wireAdminDocsConstructor._pv = setTimeout(refreshAdminDocsConstructorPreview, 120);
    };
  }
  const orderSel = $('adm-tpl-order');
  if (orderSel) {
    orderSel.onchange = () => {
      adminDocsConstructorOrderId = orderSel.value || '';
      refreshAdminDocsConstructorPreview();
    };
  }
  const save = $('adm-tpl-save');
  if (save) {
    save.onclick = () => {
      const sid = adminDocsSpaceId();
      if (!sid || !canEditDocTemplatesForSpace(sid)) return;
      const ta = $('adm-tpl-editor');
      if (typeof setDocTemplateBody === 'function') setDocTemplateBody(sid, adminDocsConstructorTpl, ta ? ta.value : '');
      if (typeof persist === 'function') persist();
      save.textContent = 'Сохранено';
      setTimeout(() => { save.textContent = 'Сохранить'; }, 1500);
    };
  }
  const reset = $('adm-tpl-reset');
  if (reset) {
    reset.onclick = () => {
      const sid = adminDocsSpaceId();
      if (!sid || !canEditDocTemplatesForSpace(sid)) return;
      if (!confirm('Вернуть текст шаблона по умолчанию?')) return;
      if (state.docTemplates && state.docTemplates.spaces && state.docTemplates.spaces[sid]) {
        delete state.docTemplates.spaces[sid][adminDocsConstructorTpl];
      }
      if (typeof bumpDataEpoch === 'function') bumpDataEpoch('doc-template-reset');
      if (typeof persist === 'function') persist();
      renderAdminDocsBody();
    };
  }
  const printBtn = $('adm-tpl-print');
  if (printBtn) {
    printBtn.onclick = () => {
      const sid = adminDocsSpaceId();
      const ta = $('adm-tpl-editor');
      const body = ta ? ta.value : '';
      let order = null;
      const sel = $('adm-tpl-order');
      if (sel && sel.value) order = (state.orders || []).find(o => o.id === sel.value) || null;
      if (typeof openPrintHtml === 'function' && typeof renderDocTemplatePreviewHtml === 'function') {
        openPrintHtml(
          (DOC_TEMPLATE_CATALOG.find(t => t.id === adminDocsConstructorTpl) || {}).title || 'Документ',
          renderDocTemplatePreviewHtml(adminDocsConstructorTpl, body, order, sid)
        );
      }
    };
  }
}

function paintAdminDocsTabs() {
  const tabs = $('adm-docs-tabs');
  if (!tabs) return;
  tabs.querySelectorAll('[data-adm-docs-tab]').forEach(b => {
    b.classList.toggle('on', b.dataset.admDocsTab === adminDocsTab);
  });
  ['legal', 'buh', 'letters', 'constructor'].forEach(id => {
    const panel = $('adm-docs-panel-' + id);
    if (panel) panel.classList.toggle('on', id === adminDocsTab);
  });
}

function wireAdminDocsPanel() {
  document.querySelectorAll('#adm-docs-tabs [data-adm-docs-tab]').forEach(b => {
    b.onclick = () => {
      adminDocsTab = b.dataset.admDocsTab;
      paintAdminDocsTabs();
      renderAdminDocsBody();
    };
  });
  const role = $('adm-docs-role');
  if (role) role.onchange = () => { adminDocsRoleFilter = role.value; renderAdminDocsBody(); };
  const firm = $('adm-docs-firm');
  if (firm) firm.onchange = () => { adminDocsFirmFilter = firm.value; renderAdminDocsBody(); };
  const search = $('adm-docs-search');
  if (search) {
    search.oninput = () => {
      adminDocsSearch = search.value.trim();
      clearTimeout(wireAdminDocsPanel._searchT);
      wireAdminDocsPanel._searchT = setTimeout(renderAdminDocsBody, 220);
    };
  }
  const blank = $('adm-letter-blank');
  if (blank) blank.onclick = () => openAdminLetterBlank();
  document.querySelectorAll('.adm-doc-open').forEach(btn => {
    btn.onclick = () => {
      if (typeof openAdminOrderDocument === 'function') {
        openAdminOrderDocument(btn.dataset.orderId, btn.dataset.docKind);
      }
    };
  });
  document.querySelectorAll('.adm-doc-pack').forEach(btn => {
    btn.onclick = () => {
      if (typeof downloadAllAdminOrderDocs === 'function') downloadAllAdminOrderDocs(btn.dataset.orderId);
    };
  });
}

function renderAdminDocsBody() {
  const legal = $('adm-docs-panel-legal');
  const buh = $('adm-docs-panel-buh');
  const letters = $('adm-docs-panel-letters');
  const ctor = $('adm-docs-panel-constructor');
  if (legal) legal.innerHTML = adminDocsLegalPanelHtml();
  if (buh) buh.innerHTML = adminDocsBuhPanelHtml();
  if (letters) letters.innerHTML = adminDocsLettersPanelHtml();
  if (ctor) ctor.innerHTML = adminDocsConstructorPanelHtml();
  wireAdminDocsPanel();
  if (adminDocsTab === 'constructor') wireAdminDocsConstructor();
}

function renderAdminDocuments() {
  paintAdminDocsTabs();
  renderAdminDocsBody();
  const back = $('docs-back');
  if (back) back.onclick = () => { show('admin'); renderAdmin(); };
}

function openAdminDocuments() {
  if (!currentAdmin) {
    alert('Войдите в админку');
    return;
  }
  adminDocsFirmFilter = adminDocsDefaultFirmFilter();
  document.querySelectorAll('.admin-nav-item[data-nav]').forEach(b => {
    b.classList.toggle('on', b.dataset.nav === 'documents');
  });
  renderAdminDocuments();
  show('admin-docs-screen');
}
