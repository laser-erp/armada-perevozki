/* АРМАДА — шаблоны документов на бланке (по spaceId) */
const DOC_TEMPLATE_CATALOG = [
  { id: 'letter', title: 'Письмо (бланк)', group: 'letters', hint: 'Исходящее на фирменном бланке' },
  { id: 'framework', title: 'Рамочный договор', group: 'buh', hint: 'Между заказчиком и перевозчиком' },
  { id: 'application', title: 'Заявка на перевозку', group: 'buh', hint: 'По конкретной заявке' },
  { id: 'transportApp', title: 'Договор‑заявка', group: 'buh', hint: 'Между заказчиком и перевозчиком по рейсу' },
  { id: 'act', title: 'Акт выполненных работ', group: 'buh', hint: 'После закрытия заявки' }
];

const DOC_TEMPLATE_VARS = [
  { key: '{{carrier.name}}', label: 'Перевозчик' },
  { key: '{{carrier.inn}}', label: 'ИНН перевозчика' },
  { key: '{{carrier.address}}', label: 'Адрес перевозчика' },
  { key: '{{customer.name}}', label: 'Заказчик' },
  { key: '{{customer.inn}}', label: 'ИНН заказчика' },
  { key: '{{order.number}}', label: '№ заявки' },
  { key: '{{order.date}}', label: 'Дата заявки' },
  { key: '{{order.route}}', label: 'Маршрут' },
  { key: '{{order.amount}}', label: 'Сумма' },
  { key: '{{order.driver}}', label: 'Водитель' },
  { key: '{{order.plate}}', label: 'Госномер' },
  { key: '{{order.driverPassport}}', label: 'Паспорт водителя' },
  { key: '{{order.driverLicense}}', label: 'ВУ водителя' },
  { key: '{{order.vehicleSts}}', label: 'СТС' },
  { key: '{{order.vehicleAt}}', label: 'Подача ТС' },
  { key: '{{order.shipper}}', label: 'Грузоотправитель' },
  { key: '{{order.consignee}}', label: 'Грузополучатель' },
  { key: '{{order.cargo}}', label: 'Сведения о грузе' },
  { key: '{{order.vehicleReq}}', label: 'Требования к ТС' },
  { key: '{{order.payment}}', label: 'Оплата и порядок расчётов' },
  { key: '{{today}}', label: 'Сегодня' }
];

function docTemplatesRoot() {
  if (!state.docTemplates || typeof state.docTemplates !== 'object') state.docTemplates = { spaces: {} };
  if (!state.docTemplates.spaces || typeof state.docTemplates.spaces !== 'object') state.docTemplates.spaces = {};
  return state.docTemplates;
}

function defaultDocTemplateBody(templateId) {
  const bodies = {
    letter: `Исх. № _____ от {{today}}

Кому: {{customer.name}}

Уважаемые коллеги!

Текст письма…

С уважением,
{{carrier.name}}`,
    framework: `ДОГОВОР НА ОКАЗАНИЕ ТРАНСПОРТНО‑ЭКСПЕДИЦИОННЫХ УСЛУГ

Заказчик: {{customer.name}}, ИНН {{customer.inn}}
Перевозчик: {{carrier.name}}, ИНН {{carrier.inn}}

1. Предмет. Перевозчик оказывает услуги автомобильной перевозки по заявкам Заказчика.
2. Заявки оформляются в системе АРМАДА; условия конкретного рейса — в заявке / договоре‑заявке.
3. Оплата — по счёту Перевозчика в сроки, указанные в заявке.`,
    application: `ЗАЯВКА НА ПЕРЕВОЗКУ № {{order.number}}
от {{order.date}}

Грузоотправитель: {{order.shipper}}
Заказчик: {{customer.name}}, ИНН {{customer.inn}}
Перевозчик: {{carrier.name}}, ИНН {{carrier.inn}}
Грузополучатель: {{order.consignee}}

{{order.cargo}}

Маршрут: {{order.route}}
Подача ТС: {{order.vehicleAt}}
{{order.vehicleReq}}

Водитель / ТС: {{order.driver}} · {{order.plate}}
Паспорт: {{order.driverPassport}} · ВУ: {{order.driverLicense}} · СТС: {{order.vehicleSts}}

{{order.payment}}`,
    transportApp: `ДОГОВОР‑ЗАЯВКА № {{order.number}}
от {{order.date}}

Грузоотправитель: {{order.shipper}}
Заказчик перевозки: {{customer.name}}, ИНН {{customer.inn}}
Перевозчик: {{carrier.name}}, ИНН {{carrier.inn}}
Грузополучатель: {{order.consignee}}

{{order.cargo}}

Маршрут: {{order.route}}
Подача: {{order.vehicleAt}}
{{order.vehicleReq}}

Водитель / ТС: {{order.driver}} · {{order.plate}}
Паспорт: {{order.driverPassport}} · ВУ: {{order.driverLicense}} · СТС: {{order.vehicleSts}}

{{order.payment}}

Стороны согласовали условия перевозки по данной заявке.`,
    act: `АКТ ВЫПОЛНЕННЫХ РАБОТ № {{order.number}}
от {{order.date}}

Заказчик: {{customer.name}}
Исполнитель: {{carrier.name}}

Выполнена перевозка по маршруту: {{order.route}}
Водитель / ТС: {{order.driver}} · {{order.plate}}
Стоимость работ: {{order.amount}}

Работы выполнены полностью, претензий стороны не имеют.`
  };
  return bodies[templateId] || '';
}

function getDocTemplateRecord(spaceId, templateId) {
  if (!spaceId || !templateId) return null;
  const sp = docTemplatesRoot().spaces[spaceId];
  if (!sp || typeof sp !== 'object') return null;
  const rec = sp[templateId];
  if (!rec || typeof rec !== 'object') return null;
  return rec;
}

function getDocTemplateBody(spaceId, templateId) {
  if (typeof isOperatorLetterId === 'function' && isOperatorLetterId(templateId)) {
    return typeof getOperatorLetterBody === 'function'
      ? getOperatorLetterBody(templateId)
      : defaultOperatorLetterBody(templateId);
  }
  const rec = getDocTemplateRecord(spaceId, templateId);
  if (rec && rec.body) return String(rec.body);
  return defaultDocTemplateBody(templateId);
}

function setDocTemplateBody(spaceId, templateId, body) {
  if (typeof isOperatorLetterId === 'function' && isOperatorLetterId(templateId)) {
    return typeof setOperatorLetterBody === 'function'
      ? setOperatorLetterBody(templateId, body)
      : false;
  }
  if (!spaceId || !templateId) return false;
  docTemplatesRoot();
  if (!state.docTemplates.spaces[spaceId]) state.docTemplates.spaces[spaceId] = {};
  state.docTemplates.spaces[spaceId][templateId] = {
    body: String(body || ''),
    updatedAt: new Date().toISOString()
  };
  if (typeof bumpDataEpoch === 'function') bumpDataEpoch('doc-template');
  return true;
}

function canEditDocTemplatesForSpace(spaceId) {
  if (!currentAdmin || !spaceId) return false;
  const sid = typeof currentSpaceId === 'function' ? currentSpaceId() : null;
  if (typeof isSuperAdmin === 'function' && isSuperAdmin()) return sid === spaceId;
  return sid === spaceId;
}

function docTemplateSampleOrder(spaceId) {
  const deleted = typeof deletedOrderIdSet === 'function' ? deletedOrderIdSet() : new Set();
  const list = (state.orders || []).filter(o => o && !deleted.has(o.id) && (o.spaceId === spaceId || o.partnerSpaceId === spaceId));
  list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return list[0] || null;
}

function buildDocTemplateContext(order, spaceId) {
  const o = order || {};
  const sid = spaceId || o.spaceId || o.partnerSpaceId || (typeof currentSpaceId === 'function' ? currentSpaceId() : null);
  const co = typeof currentOwnCompany === 'function' && sid === (typeof currentSpaceId === 'function' ? currentSpaceId() : null)
    ? currentOwnCompany()
    : null;
  const carrierCo = co
    || (o.ownCompanyId ? findCompanyById(o.ownCompanyId) : null)
    || (typeof carrierOwnCompanyForSpace === 'function' ? carrierOwnCompanyForSpace(sid) : null);
  const customerCo = findCompanyById(o.customerId) || findCompanyByName(o.customer);
  const carrier = typeof resolveParty === 'function'
    ? resolveParty(carrierCo && carrierCo.id, carrierCo && carrierCo.name || o.ownCompanyName, sid)
    : { name: o.ownCompanyName || '—', inn: '', address: '' };
  const customer = typeof resolveParty === 'function'
    ? resolveParty(customerCo && customerCo.id, customerCo && customerCo.name || o.customer, sid)
    : { name: o.customer || '—', inn: '', address: '' };
  const rate = typeof clientRate === 'function' ? clientRate(o) : null;
  const amount = rate != null ? `${typeof fmt === 'function' ? fmt(rate) : rate} ₽` : '—';
  const app = o.transportApp || {};
  const driver = app.driverName || o.driverName || '—';
  const plate = app.vehiclePlate || o.vehiclePlate || '—';
  const passport = orderPassportText(o);
  const license = orderLicenseNo(o);
  const sts = orderStsText(o);
  const today = typeof dayOnly === 'function' ? dayOnly(new Date().toISOString()) : new Date().toLocaleDateString('ru-RU');
  const shipper = typeof orderShipperParty === 'function' ? orderShipperParty(o) : null;
  const consignee = typeof orderConsigneeParty === 'function' ? orderConsigneeParty(o) : null;
  const payment = typeof orderPaymentDocLines === 'function' ? orderPaymentDocLines(o) : amount;
  return {
    '{{carrier.name}}': carrier.name || '—',
    '{{carrier.inn}}': carrier.inn || '—',
    '{{carrier.address}}': carrier.address || '—',
    '{{customer.name}}': customer.name || '—',
    '{{customer.inn}}': customer.inn || '—',
    '{{order.number}}': o.sequentialNumber != null ? String(o.sequentialNumber) : '—',
    '{{order.date}}': typeof dayOnly === 'function' ? dayOnly(o.createdAt) || today : today,
    '{{order.route}}': typeof routeText === 'function' ? routeText(o) || '—' : '—',
    '{{order.amount}}': amount,
    '{{order.driver}}': driver,
    '{{order.plate}}': plate,
    '{{order.driverPassport}}': passport || '—',
    '{{order.driverLicense}}': license || '—',
    '{{order.vehicleSts}}': sts || '—',
    '{{order.vehicleAt}}': o.vehicleAt && typeof dateTime === 'function' ? dateTime(o.vehicleAt) : '—',
    '{{order.shipper}}': typeof orderPartyPlain === 'function' ? orderPartyPlain(shipper) : '—',
    '{{order.consignee}}': typeof orderPartyPlain === 'function' ? orderPartyPlain(consignee) : '—',
    '{{order.cargo}}': typeof orderCargoPlain === 'function' ? orderCargoPlain(o) : '—',
    '{{order.vehicleReq}}': typeof orderVehicleReqPlain === 'function' ? orderVehicleReqPlain(o) : '—',
    '{{order.payment}}': payment || amount,
    '{{today}}': today
  };
}

function substituteDocTemplate(body, ctx) {
  let out = String(body || '');
  const map = ctx && typeof ctx === 'object' ? ctx : {};
  Object.keys(map).forEach(k => {
    out = out.split(k).join(String(map[k] != null ? map[k] : ''));
  });
  return out;
}

function renderDocTemplateTextToHtml(text) {
  const paras = String(text || '').split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  if (!paras.length) return '<p class="no-indent">—</p>';
  return paras.map(p => {
    const lines = p.split('\n').map(l => esc(l)).join('<br/>');
    const isTitle = /^[A-ZА-ЯЁ0-9][^a-zа-яё]{8,}$/.test(p.replace(/\s/g, '')) || /^ДОГОВОР|^АКТ|^ЗАЯВКА|^Исх\./i.test(p);
    if (isTitle) return `<p class="doc-subject">${lines}</p>`;
    return `<p>${lines}</p>`;
  }).join('\n');
}

function docTemplateLetterheadHtml(spaceId) {
  const co = typeof ownCompanyForAdminId === 'function' && currentAdmin
    ? ownCompanyForAdminId(currentAdmin.id)
    : (typeof currentOwnCompany === 'function' ? currentOwnCompany() : null);
  const sp = spaceId ? findSpaceById(spaceId) : null;
  if (typeof adminDocsLetterheadHtml === 'function') return adminDocsLetterheadHtml(co, sp);
  const name = (co && co.name) || (sp && sp.name) || 'АРМАДА';
  return `<header class="adm-letterhead"><p class="adm-letterhead__name">${esc(name)}</p></header>`;
}

function renderDocTemplatePreviewHtml(templateId, body, order, spaceId) {
  if (typeof isOperatorLetterId === 'function' && isOperatorLetterId(templateId)) {
    return typeof renderOperatorLetterPreviewHtml === 'function'
      ? renderOperatorLetterPreviewHtml(templateId, body)
      : '';
  }
  const ctx = buildDocTemplateContext(order, spaceId);
  const filled = substituteDocTemplate(body, ctx);
  const inner = renderDocTemplateTextToHtml(filled);
  const meta = DOC_TEMPLATE_CATALOG.find(t => t.id === templateId);
  return `<article class="adm-letter-page adm-tpl-preview">
    ${docTemplateLetterheadHtml(spaceId)}
    ${meta ? `<p class="adm-tpl-cat">${esc(meta.title)} · пример подстановки</p>` : ''}
    <div class="adm-tpl-body">${inner}</div>
    <footer class="adm-tpl-foot">${esc((findSpaceById(spaceId) || {}).name || '')} · app.armada.sx</footer>
  </article>`;
}

function hasCustomDocTemplate(spaceId, templateId) {
  if (typeof isOperatorLetterId === 'function' && isOperatorLetterId(templateId)) {
    return typeof hasCustomOperatorLetter === 'function' && hasCustomOperatorLetter(templateId);
  }
  const rec = getDocTemplateRecord(spaceId, templateId);
  return !!(rec && rec.body);
}

function buildOrderDocFromTemplate(kind, o, spaceId) {
  const sid = spaceId || o.spaceId || o.partnerSpaceId;
  if (!sid || !hasCustomDocTemplate(sid, kind)) return null;
  const body = getDocTemplateBody(sid, kind);
  const html = renderDocTemplatePreviewHtml(kind, body, o, sid);
  return html.replace(/class="adm-letter-page adm-tpl-preview"/, 'class="adm-letter-page"');
}

function docTemplatesSnapshotSlice() {
  docTemplatesRoot();
  const out = { spaces: structuredClone(state.docTemplates.spaces) };
  if (state.docTemplates.platform && typeof state.docTemplates.platform === 'object') {
    out.platform = structuredClone(state.docTemplates.platform);
  }
  return out;
}

function applyDocTemplatesPayload(slice) {
  if (!slice || typeof slice !== 'object') return;
  docTemplatesRoot();
  if (slice.spaces && typeof slice.spaces === 'object') state.docTemplates.spaces = slice.spaces;
  if (slice.platform && typeof slice.platform === 'object') {
    if (typeof applyOperatorLettersPlatform === 'function') applyOperatorLettersPlatform(slice.platform);
    else state.docTemplates.platform = slice.platform;
  }
}

function openDocTemplatePrint(templateId, spaceId, order) {
  const body = getDocTemplateBody(spaceId, templateId);
  let html = renderDocTemplatePreviewHtml(templateId, body, order, spaceId);
  if (templateId === 'letter' && typeof adminDocSignMarksHtml === 'function') {
    const assets = typeof currentAdminDocAssets === 'function' ? currentAdminDocAssets() : null;
    const marks = adminDocSignMarksHtml(assets);
    if (marks && (marks.indexOf('doc-sign-stamp') >= 0 || marks.indexOf('doc-sign-signature') >= 0)) {
      html = html.replace('</article>', `<div class="adm-letter-sign">${marks}</div></article>`);
    }
  }
  const title = (DOC_TEMPLATE_CATALOG.find(t => t.id === templateId) || {}).title || 'Документ';
  if (typeof openPrintHtml === 'function') {
    openPrintHtml(title, html);
  }
}
