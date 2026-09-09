/* pilot.html — заявка на пилот 30 дней (без mailto) */
(function () {
  var BUILD = '2026-08-31-pilot4317';
  var form = null;
  var statusEl = null;

  function qs(id) {
    return document.getElementById(id);
  }

  function readQuery() {
    var q = new URLSearchParams(location.search || '');
    var role = (q.get('role') || 'logist').trim().toLowerCase();
    if (role !== 'carrier' && role !== 'logist') role = 'logist';
    return { role: role };
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function ensureStore() {
    if (typeof appendCustomerPortalLead === 'function') return Promise.resolve();
    return loadScript('/store.js?v=' + encodeURIComponent(BUILD));
  }

  function showStatus(text, ok) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = 'landing-lead-status' + (ok ? ' is-ok' : ok === false ? ' is-err' : '');
    statusEl.hidden = !text;
  }

  function applyPageMeta(params) {
    var title = qs('pilot-title');
    var badge = qs('pilot-badge');
    var lead = qs('pilot-lead');
    var login = qs('pilot-login-link');
    if (params.role === 'carrier') {
      if (title) title.textContent = 'Пилот для перевозчика';
      if (badge) badge.textContent = 'Пилот 30 дней · перевозчик';
      if (lead) lead.textContent = 'Подключим кабинет под ваш парк — водители по ссылке, заявки от логиста. Пилот 30 дней на реальных рейсах.';
      if (login) login.href = '/v/';
      document.title = 'Пилот перевозчика — АРМАДА';
    } else {
      if (title) title.textContent = 'Пилот для логиста';
      if (badge) badge.textContent = 'Пилот 30 дней · логист';
      if (login) login.href = '/a/';
      document.title = 'Пилот логиста — АРМАДА';
    }
  }

  function readForm(params) {
    return {
      kind: 'pilot',
      pilotRole: params.role,
      company: (qs('pilot-company') && qs('pilot-company').value || '').trim(),
      phone: (qs('pilot-phone') && qs('pilot-phone').value || '').trim(),
      contactName: (qs('pilot-name') && qs('pilot-name').value || '').trim(),
      city: (qs('pilot-city') && qs('pilot-city').value || '').trim(),
      fleetSize: (qs('pilot-fleet') && qs('pilot-fleet').value || '').trim(),
      comment: (qs('pilot-comment') && qs('pilot-comment').value || '').trim(),
      source: 'pilot.html'
    };
  }

  function validate(data) {
    if (!data.company) return 'Укажите компанию или ФИО';
    if (!data.phone || data.phone.replace(/\D/g, '').length < 10) return 'Укажите телефон для связи';
    return '';
  }

  function resetForm() {
    if (form) {
      form.hidden = false;
      form.reset();
    }
    var okBox = qs('pilot-success');
    if (okBox) okBox.hidden = true;
    showStatus('', null);
  }

  async function submitPilot(ev) {
    if (ev) ev.preventDefault();
    var params = readQuery();
    var data = readForm(params);
    var err = validate(data);
    if (err) {
      showStatus(err, false);
      return;
    }
    var btn = qs('pilot-submit');
    if (btn) btn.disabled = true;
    showStatus('Отправляем заявку…', null);
    try {
      await ensureStore();
      if (typeof appendCustomerPortalLead !== 'function') throw new Error('sync');
      var res = await appendCustomerPortalLead(data);
      if (!res || !res.ok) throw new Error((res && res.error) || 'Не удалось сохранить');
      if (form) form.hidden = true;
      var okBox = qs('pilot-success');
      if (okBox) okBox.hidden = false;
      showStatus('', null);
    } catch (e) {
      console.warn('pilot lead', e);
      showStatus('Не удалось отправить автоматически. Позвоните +7 (965) 073-00-02 или напишите hello@armada.sx', false);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function wire() {
    form = qs('pilot-form');
    statusEl = qs('pilot-status');
    applyPageMeta(readQuery());
    if (form) form.addEventListener('submit', submitPilot);
    var again = qs('pilot-again');
    if (again) again.addEventListener('click', resetForm);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
