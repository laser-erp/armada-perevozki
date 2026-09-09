/* kp-zakaz.html — заявка «Хочу отправлять грузы» (CSP: без inline onclick) */
(function () {
  var BUILD = '2026-08-31-customer-lead4317';
  var modal = null;
  var form = null;
  var statusEl = null;

  function qs(id) {
    return document.getElementById(id);
  }

  function openModal() {
    if (!modal) return;
    modal.hidden = false;
    modal.classList.add('show');
    document.body.classList.add('landing-modal-open');
    var company = qs('lead-company');
    if (company) company.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('show');
    modal.hidden = true;
    document.body.classList.remove('landing-modal-open');
  }

  function showStatus(text, ok) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = 'landing-lead-status' + (ok ? ' is-ok' : ok === false ? ' is-err' : '');
    statusEl.hidden = !text;
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

  function readForm() {
    return {
      company: (qs('lead-company') && qs('lead-company').value || '').trim(),
      inn: (qs('lead-inn') && qs('lead-inn').value || '').trim(),
      phone: (qs('lead-phone') && qs('lead-phone').value || '').trim(),
      contactName: (qs('lead-name') && qs('lead-name').value || '').trim(),
      comment: (qs('lead-comment') && qs('lead-comment').value || '').trim(),
      carrierHint: (function () {
        var q = new URLSearchParams(location.search || '');
        return (q.get('carrier') || '').trim();
      })()
    };
  }

  function validateLead(data) {
    if (!data.company) return 'Укажите название компании';
    if (!data.phone || data.phone.replace(/\D/g, '').length < 10) return 'Укажите телефон для связи';
    return '';
  }

  async function submitLead(ev) {
    if (ev) ev.preventDefault();
    var data = readForm();
    var err = validateLead(data);
    if (err) {
      showStatus(err, false);
      return;
    }
    var btn = qs('lead-submit');
    if (btn) btn.disabled = true;
    showStatus('Отправляем заявку…', null);
    try {
      await ensureStore();
      if (typeof appendCustomerPortalLead !== 'function') {
        throw new Error('sync');
      }
      var res = await appendCustomerPortalLead(data);
      if (!res || !res.ok) {
        throw new Error((res && res.error) || 'Не удалось сохранить');
      }
      if (form) form.reset();
      showStatus('', null);
      var okBox = qs('lead-success');
      if (okBox) okBox.hidden = false;
      if (form) form.hidden = true;
    } catch (e) {
      console.warn('customer lead', e);
      showStatus('Не удалось отправить автоматически. Напишите на hello@armada.sx или позвоните +7 (965) 073-00-02', false);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function resetModal() {
    if (form) {
      form.hidden = false;
      form.reset();
    }
    var okBox = qs('lead-success');
    if (okBox) okBox.hidden = true;
    showStatus('', null);
  }

  function wire() {
    modal = qs('lead-modal');
    form = qs('lead-form');
    statusEl = qs('lead-status');
    ['cta-contact', 'cta-mail'].forEach(function (id) {
      var btn = qs(id);
      if (btn) {
        btn.addEventListener('click', function (ev) {
          ev.preventDefault();
          resetModal();
          openModal();
        });
      }
    });
    var closeBtn = qs('lead-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', function (ev) {
        if (ev.target === modal) closeModal();
      });
    }
    if (form) form.addEventListener('submit', submitLead);
    var again = qs('lead-again');
    if (again) {
      again.addEventListener('click', function () {
        resetModal();
      });
    }
    var done = qs('lead-done');
    if (done) done.addEventListener('click', closeModal);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
