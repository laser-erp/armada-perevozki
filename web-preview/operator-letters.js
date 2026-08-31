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
    id: 'etrnKaluga',
    title: 'Калуга Астрал',
    hint: '1С-ЭПД · sandbox API ЭТрН',
    pdf: 'ARMADA_Pismo_Kaluga_Astral_ETRN.pdf',
    docFile: 'kaluga-astral.html'
  }
];

const OPERATOR_LETTER_VARS = [
  { key: '{{letter.outNo}}', label: 'Исходящий номер (авто при печати)' },
  { key: '{{letter.outDate}}', label: 'Дата исходящего («31» августа 2026 г.)' },
  { key: '{{today}}', label: 'Сегодня (как дата исходящего)' }
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

function openOperatorLetterPrint(templateId) {
  ensureOperatorLetterOutNo(templateId);
  const body = getOperatorLetterBody(templateId);
  const html = renderOperatorLetterPreviewHtml(templateId, body, { assign: true });
  const title = (operatorLetterMeta(templateId) || {}).title || 'Письмо оператору';
  if (typeof openPrintHtml === 'function') openPrintHtml(title, html);
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
