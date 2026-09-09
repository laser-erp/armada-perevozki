/* Письма оператору подписи (КЭП/ПЭП) — на бланке кабинета клиента */
const SIGN_OPERATOR_LETTER_CATALOG = [
  {
    id: 'signCustomer',
    title: 'Заказчик — выпуск подписи (T1)',
    hint: 'КЭП грузоотправителя для ЭТрН на погрузке',
    role: 'customer'
  },
  {
    id: 'signCarrier',
    title: 'Перевозчик — выпуск подписи (T2)',
    hint: 'КЭП перевозчика для ЭТrН',
    role: 'carrier'
  },
  {
    id: 'signDriver',
    title: 'Водитель — выпуск подписи (T3/T4)',
    hint: 'ПЭП водителя для ЭТrН',
    role: 'driver'
  }
];

const SIGN_OPERATOR_LETTER_VARS = [
  { key: '{{today}}', label: 'Сегодня', hint: 'Дата письма при печати' },
  { key: '{{carrier.name}}', label: 'Название компании', hint: 'Ваша организация из «Наша фирма»' },
  { key: '{{carrier.inn}}', label: 'ИНН компании', hint: 'ИНН организации-отправителя письма' },
  { key: '{{carrier.address}}', label: 'Юр. адрес', hint: 'Адрес из карточки фирмы' }
];

function isSignOperatorLetterId(templateId) {
  return SIGN_OPERATOR_LETTER_CATALOG.some(t => t.id === templateId);
}

function signOperatorLetterMeta(templateId) {
  return SIGN_OPERATOR_LETTER_CATALOG.find(t => t.id === templateId) || null;
}

function defaultSignOperatorLetterBody(templateId) {
  const bodies = {
    signCustomer: `Исх. № _____ от {{today}}

Оператору электронного документооборота
(Контур.Логистика / иной оператор ЭПД)

Уважаемые коллеги!

Просим подключить организацию {{carrier.name}} (ИНН {{carrier.inn}}) к обмену электронными транспортными накладными (ЭТrН) и выпустить квалифицированную электронную подпись для роли **грузоотправителя** (подпись титула T1 на погрузке).

Контактное лицо: _______________________
Телефон: _______________________
E-mail: _______________________

Приложение: карточка организации, доверенность (при необходимости).

С уважением,
{{carrier.name}}`,
    signCarrier: `Исх. № _____ от {{today}}

Оператору электронного документооборота
(Контур.Логистика / иной оператор ЭПД)

Уважаемые коллеги!

Просим подключить организацию {{carrier.name}} (ИНН {{carrier.inn}}) к обмену ЭТrН и выпустить **квалифицированную электронную подпись** для роли **перевозчика** (подпись титула T2 на погрузке).

Контактное лицо: _______________________
Телефон: _______________________
E-mail: _______________________

С уважением,
{{carrier.name}}`,
    signDriver: `Исх. № _____ от {{today}}

Оператору электронного документооборота
(Контур.Логистика / иной оператор ЭПД)

Уважаемые коллеги!

Просим выпустить **простую электронную подпись (ПЭП)** для водителя {{carrier.name}} (ИНН {{carrier.inn}}) — подпись титулов T3/T4 в ЭТrН.

ФИО водителя: _______________________
Телефон: _______________________
Паспорт / ВУ: _______________________

С уважением,
{{carrier.name}}`
  };
  return bodies[templateId] || '';
}

function getSignOperatorLetterBody(spaceId, templateId) {
  const rec = typeof getDocTemplateRecord === 'function' ? getDocTemplateRecord(spaceId, templateId) : null;
  if (rec && rec.body) return String(rec.body);
  return defaultSignOperatorLetterBody(templateId);
}

function setSignOperatorLetterBody(spaceId, templateId, body) {
  return typeof setDocTemplateBody === 'function' ? setDocTemplateBody(spaceId, templateId, body) : false;
}

function hasCustomSignOperatorLetter(spaceId, templateId) {
  const rec = typeof getDocTemplateRecord === 'function' ? getDocTemplateRecord(spaceId, templateId) : null;
  return !!(rec && rec.body);
}

function signOperatorLetterContext(spaceId) {
  const co = typeof ownCompanyForSpaceId === 'function' ? ownCompanyForSpaceId(spaceId) : null;
  const sp = spaceId ? findSpaceById(spaceId) : null;
  const p = typeof resolveParty === 'function'
    ? resolveParty(co && co.id, co && co.name, spaceId)
    : { name: (co && co.name) || (sp && sp.name) || '—', inn: '', address: '' };
  const today = typeof dayOnly === 'function' ? dayOnly(new Date().toISOString()) : '';
  return {
    '{{today}}': today,
    '{{carrier.name}}': p.name || '—',
    '{{carrier.inn}}': p.inn || '—',
    '{{carrier.address}}': p.address || '—'
  };
}

function fillSignOperatorLetterBody(body, spaceId) {
  const ctx = signOperatorLetterContext(spaceId);
  let out = String(body || '');
  Object.keys(ctx).forEach(k => { out = out.split(k).join(String(ctx[k] != null ? ctx[k] : '')); });
  return out;
}

function renderSignOperatorLetterPreviewHtml(spaceId, templateId, body) {
  const filled = fillSignOperatorLetterBody(body != null ? body : getSignOperatorLetterBody(spaceId, templateId), spaceId);
  const inner = typeof renderDocTemplateTextToHtml === 'function' ? renderDocTemplateTextToHtml(filled) : esc(filled);
  const meta = signOperatorLetterMeta(templateId);
  return `<article class="adm-letter-page adm-tpl-preview">
    ${typeof docTemplateLetterheadHtml === 'function' ? docTemplateLetterheadHtml(spaceId) : ''}
    ${meta ? `<p class="adm-tpl-cat">${esc(meta.title)}</p>` : ''}
    <div class="adm-tpl-body">${inner}</div>
    ${typeof armadaServiceFooterHtml === 'function' ? armadaServiceFooterHtml() : ''}
  </article>`;
}

function openSignOperatorLetterPrint(spaceId, templateId, bodyOverride) {
  const body = bodyOverride != null ? bodyOverride : getSignOperatorLetterBody(spaceId, templateId);
  const html = renderSignOperatorLetterPreviewHtml(spaceId, templateId, body);
  const title = (signOperatorLetterMeta(templateId) || {}).title || 'Письмо оператору подписи';
  if (typeof openPrintHtml === 'function') openPrintHtml(title, html);
}

function canShowKonturIntegrationLetters() {
  return typeof isSuperAdmin === 'function' && isSuperAdmin();
}
