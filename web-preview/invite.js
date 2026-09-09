/* Вход водителя по ссылке-приглашению (invite.html?token=…) */
(function () {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const token = (params.get('token') || '').trim();

  function showErr(msg) {
    const st = $('invite-status');
    const form = $('invite-form');
    const err = $('invite-error');
    if (st) {
      st.textContent = msg;
      st.className = 'err';
    }
    if (form) form.style.display = 'none';
    if (err) {
      err.textContent = msg;
      err.style.display = 'block';
    }
  }

  async function boot() {
    if (!token) {
      showErr('В ссылке нет кода приглашения. Запросите новую ссылку у диспетчера.');
      return;
    }
    try {
      if (typeof initCloudSync === 'function') await initCloudSync();
    } catch (e) {
      console.warn('invite sync', e);
    }
    const inv = typeof findValidDriverInvite === 'function' ? findValidDriverInvite(token) : null;
    if (!inv) {
      showErr('Ссылка недействительна, истекла или уже использована.');
      return;
    }
    const co = inv.companyId && typeof findCompanyById === 'function' ? findCompanyById(inv.companyId) : null;
    const st = $('invite-status');
    const form = $('invite-form');
    if (st) st.style.display = 'none';
    if (form) form.style.display = 'block';
    if ($('invite-driver')) $('invite-driver').textContent = inv.driverName || 'Водитель';
    if ($('invite-firm')) $('invite-firm').textContent = co && co.name ? co.name : '';
    const btn = $('invite-submit');
    const pinEl = $('invite-pin');
    if (btn) {
      btn.onclick = async () => {
        const pin = pinEl ? pinEl.value : '';
        const res = consumeDriverInvite(token, pin);
        if (!res.ok) {
          const err = $('invite-error');
          if (err) {
            err.textContent = res.message || 'Ошибка';
            err.style.display = 'block';
          }
          return;
        }
        if (typeof enterAsDriver === 'function') {
          await enterAsDriver(res.driver);
          return;
        }
        const done = $('invite-done');
        if (form) form.style.display = 'none';
        if (done) {
          done.style.display = 'block';
          done.textContent = 'PIN сохранён. Откройте вход водителя.';
        }
        setTimeout(() => {
          location.href = '/v/';
        }, 800);
      };
    }
    if (pinEl) {
      pinEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          btn && btn.click();
        }
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
