/* АРМАДА — письма операторам ЭТрН (платформа, редактирует супер-админ) */
const OPERATOR_LETTER_CATALOG = [
  {
    id: 'etrnKontur',
    title: 'Контур.Логистика',
    hint: 'СКБ Контур · sandbox API ЭТрН',
    pdf: 'ARMADA_Pismo_Kontur_ETRN.pdf',
    docFile: 'kontur.html'
  },
  {
    id: 'etrnKonturKeys',
    title: 'Контур.Логистика — ключи',
    hint: 'Follow-up · client_id, boxId, webhook',
    pdf: 'ARMADA_Pismo_Kontur_ETRN_Keys.pdf',
    docFile: 'kontur-keys.html'
  },
  {
    id: 'etrnKaluga',
    title: 'Калуга Астрал',
    hint: '1С-ЭПД · sandbox API ЭТрН',
    pdf: 'ARMADA_Pismo_Kaluga_Astral_ETRN.pdf',
    docFile: 'kaluga-astral.html'
  }
];

const OPERATOR_LETTER_VARS = [
  { key: '{{letter.outNo}}', label: 'Исходящий номер', hint: 'Присваивается автоматически при первой печати' },
  { key: '{{letter.outDate}}', label: 'Дата исходящего', hint: 'Например: «31» августа 2026 г.' },
  { key: '{{today}}', label: 'Сегодня', hint: 'Текущая дата (как дата исходящего)' }
];

const ARMADA_PLATFORM_PARTY = {
  brand: 'АРМАДА',
  full: 'Общество с ограниченной ответственностью «АРМАДА»',
  address: '196006, г. Санкт-Петербург, вн. тер. г. муниципальный округ Московская Застава, ул. Цветочная, д. 6, литера Ж, этаж 3, помещ. 1Н (170,4)',
  inn: '7802655283',
  kpp: '781001001',
  ogrn: '1187847037608',
  phone: '+7 (965) 073-00-02',
  email: typeof armadaMail === 'function' ? armadaMail('hello') : 'hello@armada.sx',
  site: 'https://app.armada.sx',
  director: 'генеральный директор Наволоцкий Евгений Николаевич',
  directorShort: 'Наволоцкий Е. Н.'
};

function isOperatorLetterId(templateId) {
  return OPERATOR_LETTER_CATALOG.some(t => t.id === templateId);
}

function operatorLetterMeta(templateId) {
  return OPERATOR_LETTER_CATALOG.find(t => t.id === templateId) || null;
}

function operatorLetterPlatformRoot() {
  if (typeof docTemplatesRoot === 'function') docTemplatesRoot();
  if (!state.docTemplates.platform || typeof state.docTemplates.platform !== 'object') {
    state.docTemplates.platform = {};
  }
  return state.docTemplates.platform;
}

function operatorOutgoingRegistry() {
  operatorLetterPlatformRoot();
  const root = state.docTemplates.platform;
  if (!root._outgoing || typeof root._outgoing !== 'object') {
    root._outgoing = { nextSeq: 1, byId: {} };
  }
  if (!root._outgoing.byId || typeof root._outgoing.byId !== 'object') root._outgoing.byId = {};
  if (!Number.isFinite(Number(root._outgoing.nextSeq)) || Number(root._outgoing.nextSeq) < 1) {
    root._outgoing.nextSeq = 1;
  }
  return root._outgoing;
}

function operatorLetterOutDateRu(iso) {
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '—';
  let day;
  let monthIdx;
  let year;
  try {
    const parts = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    }).formatToParts(d);
    day = parts.find(p => p.type === 'day').value;
    monthIdx = Number(parts.find(p => p.type === 'month').value) - 1;
    year = parts.find(p => p.type === 'year').value;
  } catch (_e) {
    day = String(d.getDate());
    monthIdx = d.getMonth();
    year = String(d.getFullYear());
  }
  return `«${day}» ${months[monthIdx]} ${year} г.`;
}

function operatorLetterOutRecord(templateId) {
  const reg = operatorOutgoingRegistry();
  const rec = reg.byId[templateId];
  if (!rec || rec.seq == null) return null;
  return rec;
}

function peekOperatorLetterOutNo(templateId) {
  const reg = operatorOutgoingRegistry();
  const rec = reg.byId[templateId];
  if (rec && rec.seq != null) {
    return { seq: rec.seq, date: rec.date || rec.issuedAt, assigned: true };
  }
  let seq = reg.nextSeq;
  for (const t of OPERATOR_LETTER_CATALOG) {
    if (t.id === templateId) break;
    const prev = reg.byId[t.id];
    if (!prev || prev.seq == null) seq += 1;
  }
  return { seq, date: new Date().toISOString(), assigned: false };
}

function ensureOperatorLetterOutNo(templateId) {
  if (!templateId) return null;
  const reg = operatorOutgoingRegistry();
  const existing = reg.byId[templateId];
  if (existing && existing.seq != null) return existing;
  const seq = reg.nextSeq;
  const issued = {
    seq,
    date: new Date().toISOString(),
    issuedAt: new Date().toISOString()
  };
  reg.byId[templateId] = issued;
  reg.nextSeq = seq + 1;
  if (typeof bumpDataEpoch === 'function') bumpDataEpoch('operator-letter-outno');
  if (typeof persist === 'function') persist();
  return issued;
}

function operatorLetterOutNoText(templateId) {
  const peek = peekOperatorLetterOutNo(templateId);
  return peek.seq != null ? String(peek.seq) : '—';
}

function operatorLetterOutMetaLine(templateId) {
  const peek = peekOperatorLetterOutNo(templateId);
  if (peek.seq == null) return '';
  const dateRu = operatorLetterOutDateRu(peek.date);
  if (peek.assigned) return `Исх. № ${peek.seq} от ${dateRu}`;
  return `Исх. № ${peek.seq} от ${dateRu} (присвоится при печати)`;
}

function defaultOperatorLetterBody(templateId) {
  const contact = `Контактное лицо с нашей стороны: ${ARMADA_PLATFORM_PARTY.director}, тел. ${ARMADA_PLATFORM_PARTY.phone}, e-mail: ${ARMADA_PLATFORM_PARTY.email}.`;
  const header = 'Исх. № {{letter.outNo}} от {{letter.outDate}}';
  const bodies = {
    etrnKontur: `${header}

Кому: Акционерному обществу «Производственная фирма «СКБ Контур»
сервис «Контур.Логистика» (оператор ИС ЭПД)
От: ${ARMADA_PLATFORM_PARTY.full}

О заявке на тестовый доступ к API оператора ИС ЭПД

Уважаемые коллеги!

${ARMADA_PLATFORM_PARTY.full} (далее — Общество) разрабатывает и эксплуатирует облачный сервис учёта грузовых перевозок для малых автопарков и региональных перевозчиков. В связи с подготовкой к обязательному применению электронных транспортных накладных (ЭТрН) Общество обращается с просьбой рассмотреть заявку на предоставление тестового (sandbox) доступа к программному интерфейсу вашего оператора информационной системы электронных перевозочных документов.

Целью подключения является интеграция формирования ЭТрН, получения статусов титулов и организации подписания документов в программном продукте «АРМАДА» с последующим пилотным внедрением у перевозчиков с парком от 1 до 15 транспортных средств. На этапе пилота планируется использование исключительно тестового контура до перехода к промышленной эксплуатации.

Просим сообщить порядок оформления тестового доступа, предоставить актуальную документацию по API и указать контактное лицо для согласования технических условий интеграции. Банковские реквизиты для заключения договора направим по запросу или в ответном письме.

${contact}

С уважением,
${ARMADA_PLATFORM_PARTY.directorShort}
Генеральный директор
ООО «АРМАДА»`,
    etrnKonturKeys: `${header}

Кому: Акционерному обществу «Производственная фирма «СКБ Контур»
сервис «Контур.Логистика» (оператор ИС ЭПД)
Вниманию: Михаилу
От: ${ARMADA_PLATFORM_PARTY.full}

О предоставлении ключей для тестовой интеграции ЭТрН

Уважаемый Михаил!

Благодарим за направленную ранее документацию по Logistics API и инструкции по работе с ЭТрН. С нашей стороны интеграция в сервис «АРМАДА» подготовлена: реализованы пользовательский интерфейс и серверный API, настроен webhook-endpoint. Для перехода от локального тестового режима к sandbox Контура осталось получить учётные данные.

Просим предоставить:
1. Ключ разработчика — client_id и client_secret для тестового контура.
2. boxId организации ООО «АРМАДА» (ИНН ${ARMADA_PLATFORM_PARTY.inn}, КПП ${ARMADA_PLATFORM_PARTY.kpp}).
3. Подтверждение базового URL API для sandbox (diadoc-api.kontur.ru или diadoc-api.testkontur.ru).
4. Порядок настройки webhook для получения статусов подписей титулов на endpoint: ${ARMADA_PLATFORM_PARTY.site}/armada-api/epd/webhook

С нашей стороны уже развёрнут сервер armada-api (${ARMADA_PLATFORM_PARTY.site}/armada-api/): POST /orders/:id/etrn — создание ЭТрН (T1 через GenerateTitleXml); POST /epd/webhook — приём статусов от оператора. Проверка готовности: GET /health → блок epd (сейчас configured: false — ожидаем ключи).

Планируемый сценарий первого теста: создание ЭТрН (T1 — грузоотправитель) из заказа в «АРМАДА»; подписание T1 грузоотправителем; получение T2 (перевозчик) и обновление статусов через webhook; проверка QR-кода и печатной формы.

Если для выдачи ключей нужны дополнительные документы или регистрация в личном кабинете integrator.kontur.ru — просим подсказать порядок действий. Банковские реквизиты и договор направим по запросу.

${contact}

С уважением,
${ARMADA_PLATFORM_PARTY.directorShort}
Генеральный директор
ООО «АРМАДА»`,
    etrnKaluga: `${header}

Кому: Обществу с ограниченной ответственностью «Калуга Астрал»
сервис 1С-ЭПД (оператор ИС ЭПД)
От: ${ARMADA_PLATFORM_PARTY.full}

О заявке на тестовый доступ к API оператора ИС ЭПД

Уважаемые коллеги!

${ARMADA_PLATFORM_PARTY.full} (далее — Общество) ведёт разработку облачного сервиса «АРМАДА» для учёта грузовых перевозок малого и среднего автопарка. В целях подготовки к переходу на электронные транспортные накладные (ЭТрН) просим рассмотреть возможность предоставления тестового (sandbox) доступа к API оператора информационной системы электронных перевозочных документов.

Планируемая интеграция предусматривает создание ЭТрН из учётной системы перевозчика, обмен статусами титулов и организацию подписания документов участниками перевозки. Пилотное внедрение будет проводиться на ограниченном числе реальных перевозок в тестовом режиме до выхода в промышленную эксплуатацию.

Просим направить порядок подключения к тестовому API, условия предоставления ключа доступа, актуальную техническую документацию, а также информацию о тарифах для пилотного объёма документов. Банковские реквизиты для заключения договора предоставим по запросу.

${contact}

С уважением,
${ARMADA_PLATFORM_PARTY.directorShort}
Генеральный директор
ООО «АРМАДА»`
  };
  return bodies[templateId] || '';
}

function getOperatorLetterBody(templateId) {
  const platform = operatorLetterPlatformRoot();
  const rec = platform[templateId];
  if (rec && rec.body) return String(rec.body);
  return defaultOperatorLetterBody(templateId);
}

function setOperatorLetterBody(templateId, body) {
  if (!templateId) return false;
  operatorLetterPlatformRoot();
  state.docTemplates.platform[templateId] = {
    body: String(body || ''),
    updatedAt: new Date().toISOString()
  };
  if (typeof bumpDataEpoch === 'function') bumpDataEpoch('operator-letter');
  return true;
}

function hasCustomOperatorLetter(templateId) {
  const platform = operatorLetterPlatformRoot();
  const rec = platform[templateId];
  return !!(rec && rec.body);
}

function canEditOperatorLetters() {
  return typeof isSuperAdmin === 'function' && isSuperAdmin();
}

function operatorLetterContext(templateId, opts) {
  const options = opts && typeof opts === 'object' ? opts : {};
  const issued = options.assign ? ensureOperatorLetterOutNo(templateId) : peekOperatorLetterOutNo(templateId);
  const outNo = issued && issued.seq != null ? String(issued.seq) : '—';
  const outDate = operatorLetterOutDateRu(issued && (issued.date || issued.issuedAt));
  const todayFormal = operatorLetterOutDateRu(new Date().toISOString());
  return {
    '{{today}}': todayFormal,
    '{{letter.outNo}}': outNo,
    '{{letter.outDate}}': outDate
  };
}

function fillOperatorLetterBody(body, templateId, opts) {
  const ctx = operatorLetterContext(templateId, opts);
  let out = typeof substituteDocTemplate === 'function'
    ? substituteDocTemplate(body, ctx)
    : String(body || '');
  if (ctx['{{letter.outNo}}'] && ctx['{{letter.outNo}}'] !== '—') {
    out = out.replace(/(Исх\.\s*№\s*)_+(?=\s+от)/i, `$1${ctx['{{letter.outNo}}']}`);
    out = out.replace(/(Исх\.\s*№\s*)\{\{letter\.outNo\}\}/i, `$1${ctx['{{letter.outNo}}']}`);
  }
  if (ctx['{{letter.outDate}}'] && ctx['{{letter.outDate}}'] !== '—') {
    out = out.replace(/(от\s+)\{\{today\}\}/i, `$1${ctx['{{letter.outDate}}']}`);
    out = out.replace(/(от\s+)__+[^\n]*/i, `от ${ctx['{{letter.outDate}}']}`);
    out = out.replace(/(от\s+)\d{1,2}\.\d{1,2}\.\d{4}/i, `от ${ctx['{{letter.outDate}}']}`);
  }
  return out;
}

function platformArmadaLetterheadHtml() {
  const p = ARMADA_PLATFORM_PARTY;
  const req = [
    esc(p.address),
    `ИНН ${esc(p.inn)}`,
    p.kpp ? `КПП ${esc(p.kpp)}` : '',
    p.ogrn ? `ОГРН ${esc(p.ogrn)}` : ''
  ].filter(Boolean).join(' · ');
  return `<header class="adm-letterhead adm-letterhead--platform">
    <img class="adm-letterhead__logo" src="/logo.png" alt="" width="68" height="68" />
    <div class="adm-letterhead__brand">
      <p class="adm-letterhead__name">${esc(p.brand)}</p>
      <p class="adm-letterhead__req">${req}</p>
      <p class="adm-letterhead__contacts">тел.: ${esc(p.phone)} · ${esc(p.email)} · ${esc(p.site)}</p>
    </div>
  </header>`;
}

function renderOperatorLetterPreviewHtml(templateId, body, opts) {
  const meta = operatorLetterMeta(templateId);
  const filled = fillOperatorLetterBody(body, templateId, opts);
  const inner = typeof renderDocTemplateTextToHtml === 'function'
    ? renderDocTemplateTextToHtml(filled)
    : `<p>${esc(filled)}</p>`;
  const outHint = !operatorLetterOutRecord(templateId) && !(opts && opts.assign)
    ? '<p class="hint adm-operator-out-hint">Номер и дата исходящего присваиваются автоматически при первой печати.</p>'
    : '';
  return `<article class="adm-letter-page adm-tpl-preview adm-operator-letter">
    ${platformArmadaLetterheadHtml()}
    ${meta ? `<p class="adm-tpl-cat">Письмо оператору · ${esc(meta.title)}</p>` : ''}
    ${outHint}
    <div class="adm-tpl-body adm-operator-letter-body">${inner}</div>
    <footer class="adm-tpl-foot">ООО «АРМАДА» · ИНН ${esc(ARMADA_PLATFORM_PARTY.inn)} · ${esc(ARMADA_PLATFORM_PARTY.site)}</footer>
  </article>`;
}

function platformLetterheadPrintHtml() {
  const p = ARMADA_PLATFORM_PARTY;
  const origin = typeof location !== 'undefined' && location.origin ? location.origin : '';
  const logo = origin ? `${origin}/logo.png` : '/logo.png';
  return `<header class="letterhead">
    <img class="letterhead__logo" src="${logo}" alt="АРМАДА" width="68" height="68" />
    <div class="letterhead__brand">
      <p class="letterhead__name">${esc(p.brand)}</p>
      <p class="letterhead__full">${esc(p.full)}</p>
      <p class="letterhead__req">${esc(p.address)}<br />
        ИНН ${esc(p.inn)} · КПП ${esc(p.kpp)} · ОГРН ${esc(p.ogrn)}</p>
      <p class="letterhead__contacts">тел.: ${esc(p.phone)} · e-mail: ${esc(p.email)} · ${esc(p.site)}</p>
    </div>
  </header>`;
}

function operatorLetterParaHtml(text, className) {
  const cls = className ? ` class="${className}"` : '';
  return `<p${cls}>${esc(text).replace(/\n/g, '<br/>')}</p>`;
}

function operatorLetterBodyToPrintHtml(filled, opts) {
  const paras = String(filled || '').split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  if (!paras.length) return '<div class="body-text"><p class="no-indent">—</p></div>';

  let i = 0;
  let parts = '';

  if (/^Исх\./i.test(paras[0])) {
    parts += `<div class="meta-row"><div class="meta-row__out">${esc(paras[0]).replace(/\n/g, '<br/>')}</div></div>`;
    i = 1;
  }

  const recipient = [];
  while (i < paras.length && !/^О .+/i.test(paras[i]) && !/^Уважаем/i.test(paras[i])) {
    recipient.push(paras[i]);
    i += 1;
  }
  if (recipient.length) {
    parts += `<div class="recipient-block">${recipient.map(p => operatorLetterParaHtml(p)).join('')}</div>`;
  }

  if (i < paras.length && /^О .+/i.test(paras[i])) {
    parts += `<p class="subject">${esc(paras[i])}</p>`;
    i += 1;
  }

  const bodyParas = [];
  const closingParas = [];
  for (; i < paras.length; i += 1) {
    if (/^С уважением/i.test(paras[i])) {
      closingParas.push(paras[i]);
      i += 1;
      while (i < paras.length) {
        closingParas.push(paras[i]);
        i += 1;
      }
      break;
    }
    bodyParas.push(paras[i]);
  }

  if (bodyParas.length) {
    parts += '<div class="body-text">';
    bodyParas.forEach(p => {
      const noIndent = /^Контактное/i.test(p) || /^Уважаем/i.test(p);
      parts += operatorLetterParaHtml(p, noIndent ? 'no-indent' : '');
    });
    parts += '</div>';
  }

  if (closingParas.length) {
    const tail = closingParas.slice(1);
    const sigName = tail.length ? tail[0] : '';
    const sigRole = tail.slice(1);
    const marksHtml = typeof operatorLetterSignMarksHtml === 'function'
      ? operatorLetterSignMarksHtml(opts && opts.signed ? 'scan' : 'blank')
      : '<div class="signature__line"></div>';
    parts += `<div class="closing">
      <p class="closing__respect">${esc(closingParas[0])}</p>
      <div class="signature">
        <p class="signature__role">${sigRole.map(l => esc(l)).join('<br/>')}</p>
        ${marksHtml}
        <p class="signature__name">${esc(sigName)}</p>
      </div>
    </div>`;
  }

  return parts;
}

function operatorLetterSignMarksHtml(mode) {
  if (mode !== 'scan') return '<div class="signature__line"></div>';
  const assets = typeof currentAdminDocAssets === 'function'
    ? currentAdminDocAssets({ platformStamp: true, platformSignature: true })
    : { stamp: null, signature: null };
  const stamp = assets && assets.stamp;
  const signature = assets && assets.signature;
  if (!stamp && !signature) return '<div class="signature__line"></div>';
  let html = '<div class="signature__marks signature__marks--scan">';
  if (signature) html += `<img class="signature__sig" src="${esc(signature)}" alt="Подпись" />`;
  if (stamp) html += `<img class="signature__stamp" src="${esc(stamp)}" alt="Печать" />`;
  html += '</div>';
  return html;
}

function operatorLetterPrintCss() {
  return `@page{size:A4;margin:18mm 20mm 22mm 25mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.45;color:#111;background:#fff}
.letter-page{position:relative;min-height:255mm}
.letterhead{display:grid;grid-template-columns:72px 1fr;gap:14px 16px;align-items:start;padding-bottom:10px;border-bottom:2.5px solid #1e5aa8;margin-bottom:18px}
.letterhead__logo{width:68px;height:auto}
.letterhead__brand{font-family:Inter,Arial,sans-serif}
.letterhead__name{font-size:15pt;font-weight:700;letter-spacing:.04em;color:#1e5aa8;margin:0 0 2px}
.letterhead__full{font-size:8.5pt;color:#334155;margin:0 0 6px}
.letterhead__req{font-size:8.5pt;color:#475569;margin:0;line-height:1.35}
.letterhead__contacts{font-size:8.5pt;color:#475569;margin:4px 0 0}
.meta-row{display:flex;justify-content:flex-end;margin:0 0 22px}
.meta-row__out{text-align:right;font-size:11pt}
.recipient-block{margin:0 0 18px;font-size:12pt}
.recipient-block p{margin:0 0 4px}
.subject{text-align:center;font-weight:700;margin:0 0 16px;font-size:12pt}
.body-text p{margin:0 0 10px;text-align:justify;text-indent:1.25cm}
.body-text p.no-indent{text-indent:0}
.closing{margin-top:22px}
.closing__respect{margin:0 0 28px;text-indent:1.25cm}
.signature{display:grid;grid-template-columns:1fr 120px 1fr;align-items:end;gap:8px;margin-top:8px;font-size:11pt}
.signature__role{margin:0}
.signature__line{border-bottom:1px solid #111;height:1px}
.signature__marks{position:relative;height:56px;grid-column:2}
.signature__marks--scan{height:24mm;width:58mm;margin:0 auto}
.signature__stamp{position:absolute;right:0;bottom:0;width:38mm;height:38mm;object-fit:contain;opacity:.9;mix-blend-mode:multiply;filter:contrast(1.06) saturate(.92);transform:rotate(-7deg);transform-origin:70% 80%}
.signature__sig{position:absolute;right:26mm;bottom:1.5mm;width:44mm;max-height:14mm;object-fit:contain;object-position:left bottom;opacity:.93;mix-blend-mode:multiply;filter:contrast(1.08);transform:rotate(-2deg);transform-origin:left bottom}
.signature__name{margin:0;text-align:right}
.letter-footer{margin-top:28px;padding-top:6px;border-top:1px solid #cbd5e1;font-family:Inter,Arial,sans-serif;font-size:7.5pt;color:#64748b;text-align:center}
.print-toolbar{display:flex;gap:8px;margin:0 0 16px;position:sticky;top:0;background:#fff;padding:10px 0;z-index:2;font-family:Inter,Arial,sans-serif}
.print-toolbar button{border:0;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer;font-size:14px;background:#1e5aa8;color:#fff}
.print-toolbar button.secondary{background:#f1f5f9;color:#111}
@media screen{
  body{background:#e8edf3;padding:24px 16px 48px}
  .letter-sheet{max-width:210mm;margin:0 auto;padding:18mm 20mm 22mm 25mm;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.12)}
}
@media print{
  .print-toolbar{display:none!important}
  body{background:#fff;padding:0}
  .letter-sheet{padding:0;box-shadow:none;max-width:none}
}`;
}

function operatorLetterPrintShell(title, articleHtml, printLabel) {
  const toolbar = typeof printWindowToolbarHtml === 'function'
    ? printWindowToolbarHtml(printLabel || 'Печать')
    : '';
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8" />
<title>${esc(title)}</title>
<style>${operatorLetterPrintCss()}</style></head><body>
<div class="letter-sheet">
  ${toolbar}
  ${articleHtml}
</div>
</body></html>`;
}

function renderOperatorLetterPrintHtml(templateId, body, opts) {
  const p = ARMADA_PLATFORM_PARTY;
  const filled = fillOperatorLetterBody(body, templateId, opts);
  const inner = operatorLetterBodyToPrintHtml(filled, { signed: !!(opts && opts.signed) });
  return `<article class="letter-page">
    ${platformLetterheadPrintHtml()}
    ${inner}
    <footer class="letter-footer">ООО «АРМАДА» · ИНН ${esc(p.inn)} · ${esc(p.site)}</footer>
  </article>`;
}

function openOperatorLetterPrintDocument(templateId, body, opts) {
  const title = (operatorLetterMeta(templateId) || {}).title || 'Письмо оператору';
  const html = renderOperatorLetterPrintHtml(templateId, body, opts);
  const shell = operatorLetterPrintShell(title, html, 'Печать');
  if (typeof openPrintDocumentHtml === 'function') {
    openPrintDocumentHtml(shell);
    return;
  }
  const w = window.open('', '_blank');
  if (!w) {
    alert('Разрешите всплывающие окна, чтобы печатать документ');
    return;
  }
  w.document.open();
  w.document.write(shell);
  w.document.close();
  if (typeof wirePrintWindowControls === 'function') wirePrintWindowControls(w);
}

function openOperatorLetterSignedPdfDocument(templateId, body, opts) {
  const title = ((operatorLetterMeta(templateId) || {}).title || 'Письмо оператору') + ' · PDF';
  const html = renderOperatorLetterPrintHtml(templateId, body, Object.assign({}, opts || {}, { signed: true }));
  const shell = operatorLetterPrintShell(title, html, 'Сохранить PDF');
  if (typeof openPrintDocumentHtml === 'function') {
    openPrintDocumentHtml(shell);
    return;
  }
  const w = window.open('', '_blank');
  if (!w) {
    alert('Разрешите всплывающие окна');
    return;
  }
  w.document.open();
  w.document.write(shell);
  w.document.close();
  if (typeof wirePrintWindowControls === 'function') wirePrintWindowControls(w);
}


function openOperatorLetterPrint(templateId) {
  ensureOperatorLetterOutNo(templateId);
  const body = getOperatorLetterBody(templateId);
  openOperatorLetterPrintDocument(templateId, body, { assign: true });
}

function openOperatorLetterSignedPdf(templateId) {
  ensureOperatorLetterOutNo(templateId);
  const body = getOperatorLetterBody(templateId);
  openOperatorLetterSignedPdfDocument(templateId, body, { assign: true });
}

function applyOperatorLettersPlatform(platform) {
  if (!platform || typeof platform !== 'object') return;
  operatorLetterPlatformRoot();
  if (platform._outgoing && typeof platform._outgoing === 'object') {
    operatorOutgoingRegistry();
    state.docTemplates.platform._outgoing = Object.assign(
      { nextSeq: 1, byId: {} },
      state.docTemplates.platform._outgoing,
      structuredClone(platform._outgoing)
    );
  }
  Object.keys(platform).forEach(id => {
    if (id === '_outgoing') return;
    const rec = platform[id];
    if (!rec || typeof rec !== 'object' || !rec.body) return;
    state.docTemplates.platform[id] = { body: String(rec.body), updatedAt: rec.updatedAt || null };
  });
}
