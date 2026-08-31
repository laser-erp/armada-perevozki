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

function defaultOperatorLetterBody(templateId) {
  const contact = `Контактное лицо с нашей стороны: ${ARMADA_PLATFORM_PARTY.director}, тел. ${ARMADA_PLATFORM_PARTY.phone}, e-mail: ${ARMADA_PLATFORM_PARTY.email}.`;
  const bodies = {
    etrnKontur: `Исх. № _____ от {{today}}

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
    etrnKaluga: `Исх. № _____ от {{today}}

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

function operatorLetterContext() {
  const today = typeof dayOnly === 'function'
    ? dayOnly(new Date().toISOString())
    : new Date().toLocaleDateString('ru-RU');
  return { '{{today}}': today };
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

function renderOperatorLetterPreviewHtml(templateId, body) {
  const meta = operatorLetterMeta(templateId);
  const filled = typeof substituteDocTemplate === 'function'
    ? substituteDocTemplate(body, operatorLetterContext())
    : String(body || '');
  const inner = typeof renderDocTemplateTextToHtml === 'function'
    ? renderDocTemplateTextToHtml(filled)
    : `<p>${esc(filled)}</p>`;
  return `<article class="adm-letter-page adm-tpl-preview adm-operator-letter">
    ${platformArmadaLetterheadHtml()}
    ${meta ? `<p class="adm-tpl-cat">Письмо оператору · ${esc(meta.title)}</p>` : ''}
    <div class="adm-tpl-body adm-operator-letter-body">${inner}</div>
    <footer class="adm-tpl-foot">ООО «АРМАДА» · ИНН ${esc(ARMADA_PLATFORM_PARTY.inn)} · ${esc(ARMADA_PLATFORM_PARTY.site)}</footer>
  </article>`;
}

function openOperatorLetterPrint(templateId) {
  const body = getOperatorLetterBody(templateId);
  const html = renderOperatorLetterPreviewHtml(templateId, body);
  const title = (operatorLetterMeta(templateId) || {}).title || 'Письмо оператору';
  if (typeof openPrintHtml === 'function') openPrintHtml(title, html);
}

function applyOperatorLettersPlatform(platform) {
  if (!platform || typeof platform !== 'object') return;
  operatorLetterPlatformRoot();
  Object.keys(platform).forEach(id => {
    const rec = platform[id];
    if (!rec || typeof rec !== 'object' || !rec.body) return;
    state.docTemplates.platform[id] = { body: String(rec.body), updatedAt: rec.updatedAt || null };
  });
}
