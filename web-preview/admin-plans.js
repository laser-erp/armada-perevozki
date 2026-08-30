/* АРМАДА — планы разработки (только супер-админ) */
const ADMIN_PLAN_ITEMS = [
  { id: 'index', file: 'README.md', title: 'Обзор', short: 'Индекс планов' },
  { id: 'admin', file: 'ADMIN_PLAN.md', title: 'Админ', short: 'Кабинет /a' },
  { id: 'driver', file: 'DRIVER_PLAN.md', title: 'Водитель', short: 'Вход /v' },
  { id: 'customer', file: 'CUSTOMER_PLAN.md', title: 'Заказчик', short: 'Портал /z' },
  { id: 'platform', file: 'PLATFORM_PLAN.md', title: 'Платформа', short: 'Супер-админ' },
  { id: 'documents', file: 'DOCUMENTS_PLAN.md', title: 'Документы', short: 'Юр. · бух. · письма' }
];
let adminPlansActiveId = 'index';
let adminPlansCache = {};

function adminPlansUrl(file) {
  const build = typeof APP_BUILD === 'string' ? APP_BUILD : '';
  return '/plans/' + encodeURIComponent(file) + (build ? '?v=' + encodeURIComponent(build) : '');
}

function escapePlanHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPlanMarkdown(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let inCode = false;
  let codeBuf = [];
  let listTag = null;

  function closeList() {
    if (listTag) {
      out.push('</' + listTag + '>');
      listTag = null;
    }
  }

  function inline(s) {
    let t = escapePlanHtml(s);
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const h = escapePlanHtml(href);
      if (/^https?:\/\//i.test(href) || href.startsWith('/')) {
        return '<a href="' + h + '" target="_blank" rel="noopener">' + escapePlanHtml(label) + '</a>';
      }
      return escapePlanHtml(label);
    });
    return t;
  }

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (line.startsWith('```')) {
      closeList();
      if (!inCode) {
        inCode = true;
        codeBuf = [];
      } else {
        out.push('<pre class="plan-code"><code>' + escapePlanHtml(codeBuf.join('\n')) + '</code></pre>');
        inCode = false;
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuf.push(raw);
      i++;
      continue;
    }

    if (!line.trim()) {
      closeList();
      i++;
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      closeList();
      out.push('<hr class="plan-hr"/>');
      i++;
      continue;
    }

    const h = line.match(/^(#{1,4})\s+(.+)$/);
    if (h) {
      closeList();
      const lvl = h[1].length;
      out.push('<h' + lvl + ' class="plan-h' + lvl + '">' + inline(h[2]) + '</h' + lvl + '>');
      i++;
      continue;
    }

    const ul = line.match(/^[-*]\s+(.+)$/);
    if (ul) {
      if (listTag !== 'ul') {
        closeList();
        out.push('<ul class="plan-list">');
        listTag = 'ul';
      }
      out.push('<li>' + inline(ul[1]) + '</li>');
      i++;
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (listTag !== 'ol') {
        closeList();
        out.push('<ol class="plan-list">');
        listTag = 'ol';
      }
      out.push('<li>' + inline(ol[1]) + '</li>');
      i++;
      continue;
    }

    const tr = line.match(/^\|(.+)\|$/);
    if (tr && i + 1 < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i + 1].trim())) {
      closeList();
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) {
        if (!/^\|[\s\-:|]+\|$/.test(lines[i].trim())) {
          rows.push(lines[i].trim().slice(1, -1).split('|').map(c => c.trim()));
        }
        i++;
      }
      if (rows.length) {
        out.push('<table class="plan-table"><thead><tr>' +
          rows[0].map(c => '<th>' + inline(c) + '</th>').join('') +
          '</tr></thead><tbody>' +
          rows.slice(1).map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') +
          '</tbody></table>');
      }
      continue;
    }

    closeList();
    out.push('<p>' + inline(line) + '</p>');
    i++;
  }
  closeList();
  if (inCode && codeBuf.length) {
    out.push('<pre class="plan-code"><code>' + escapePlanHtml(codeBuf.join('\n')) + '</code></pre>');
  }
  return out.join('\n');
}

async function fetchAdminPlanFile(file) {
  if (adminPlansCache[file]) return adminPlansCache[file];
  const res = await fetch(adminPlansUrl(file), { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = await res.text();
  adminPlansCache[file] = text;
  return text;
}

function paintAdminPlansNav() {
  const nav = $('plans-nav');
  if (!nav) return;
  nav.innerHTML = ADMIN_PLAN_ITEMS.map(p => `
    <button type="button" class="plans-nav-item${p.id === adminPlansActiveId ? ' on' : ''}" data-plan-id="${esc(p.id)}">
      <span class="plans-nav-title">${esc(p.title)}</span>
      <span class="plans-nav-short">${esc(p.short)}</span>
    </button>`).join('');
  nav.querySelectorAll('[data-plan-id]').forEach(b => {
    b.onclick = () => {
      adminPlansActiveId = b.dataset.planId;
      paintAdminPlansNav();
      loadAdminPlanContent(adminPlansActiveId);
    };
  });
}

async function loadAdminPlanContent(planId) {
  const body = $('plans-body');
  if (!body) return;
  const item = ADMIN_PLAN_ITEMS.find(p => p.id === planId) || ADMIN_PLAN_ITEMS[0];
  adminPlansActiveId = item.id;
  body.innerHTML = '<p class="hint">Загрузка…</p>';
  try {
    const md = await fetchAdminPlanFile(item.file);
    body.innerHTML = '<article class="plan-article">' + renderPlanMarkdown(md) + '</article>';
    body.scrollTop = 0;
    const scroll = $('plans-scroll');
    if (scroll) scroll.scrollTop = 0;
  } catch (err) {
    body.innerHTML = '<p class="hint">Не удалось загрузить «' + esc(item.title) + '». ' +
      esc(String(err && err.message || err)) + '</p>';
  }
}

function renderAdminPlans() {
  paintAdminPlansNav();
  loadAdminPlanContent(adminPlansActiveId);
  const back = $('plans-back');
  if (back) back.onclick = () => { show('admin'); renderAdmin(); };
}

function openAdminPlans() {
  if (!isSuperAdmin()) {
    alert('Доступно только супер админу');
    return;
  }
  document.querySelectorAll('.admin-nav-item[data-nav]').forEach(b => {
    b.classList.toggle('on', b.dataset.nav === 'plans');
  });
  renderAdminPlans();
  show('admin-plans-screen');
}
