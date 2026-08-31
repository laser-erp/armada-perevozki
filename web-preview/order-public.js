/* order.html — публичная заявка с armada.sx (CSP: без inline) */
(function () {
  var BUILD = '2026-08-31-armada-order4317';
  var form = null;
  var statusEl = null;
  var selectedVtype = '';

  function qs(id) {
    return document.getElementById(id);
  }

  function readQuery() {
    var q = new URLSearchParams(location.search || '');
    return {
      vtype: (q.get('vtype') || q.get('type') || '').trim().toLowerCase(),
      source: (q.get('source') || 'armada.sx').trim() || 'armada.sx'
    };
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

  function vtypeLabel(id) {
    if (typeof custVehicleTypeLabel === 'function') {
      var lbl = custVehicleTypeLabel(id);
      if (lbl) return lbl;
    }
    if (typeof ARMADA_SX_ORDER_VTYPES !== 'undefined') {
      var hit = ARMADA_SX_ORDER_VTYPES.find(function (x) { return x.id === id; });
      if (hit) return hit.label;
    }
    return id;
  }

  function featuredVtypes() {
    if (typeof ARMADA_SX_ORDER_VTYPES !== 'undefined' && ARMADA_SX_ORDER_VTYPES.length) {
      return ARMADA_SX_ORDER_VTYPES.slice();
    }
    return [
      { id: 'shalanda', label: 'Шаланда' },
      { id: 'manipulator', label: 'Манипулятор' },
      { id: 'tent', label: 'Тентованный' },
      { id: 'dump', label: 'Самосвал' },
      { id: 'tral', label: 'Трал' },
      { id: 'board', label: 'Бортовой' }
    ];
  }

  function normalizeVtype(raw) {
    var id = String(raw || '').trim().toLowerCase();
    if (!id) return '';
    if (typeof normalizeArmadaSxVtype === 'function') return normalizeArmadaSxVtype(id) || id;
    return featuredVtypes().some(function (x) { return x.id === id; }) ? id : '';
  }

  function paintVtypes(preselect) {
    var grid = qs('order-vtype-grid');
    if (!grid) return;
    var items = featuredVtypes().concat([{ id: 'other', label: 'Другое' }]);
    grid.innerHTML = items.map(function (t) {
      var checked = preselect === t.id ? ' checked' : '';
      return '<label class="landing-order-vtype">' +
        '<input type="radio" name="vtype" value="' + t.id + '"' + checked + ' />' +
        '<span>' + t.label + '</span></label>';
    }).join('');
    grid.querySelectorAll('input[name="vtype"]').forEach(function (inp) {
      inp.addEventListener('change', onVtypeChange);
    });
    selectedVtype = preselect || '';
    if (!selectedVtype) {
      var first = grid.querySelector('input[name="vtype"]');
      if (first) { first.checked = true; selectedVtype = first.value; }
    }
    onVtypeChange();
  }

  function onVtypeChange() {
    var picked = document.querySelector('input[name="vtype"]:checked');
    selectedVtype = picked ? picked.value : '';
    var title = qs('order-title');
    var badge = qs('order-badge');
    var unloadWrap = qs('order-unload-wrap');
    var addrLabel = qs('order-address-label');
    if (selectedVtype && selectedVtype !== 'other') {
      var lbl = vtypeLabel(selectedVtype);
      if (title) title.textContent = 'Заказать: ' + lbl;
      if (badge) badge.textContent = lbl;
    } else if (title) {
      title.textContent = 'Заказать транспорт';
    }
    var rental = selectedVtype === 'shalanda' || selectedVtype === 'manipulator';
    if (unloadWrap) unloadWrap.hidden = rental;
    if (addrLabel) {
      addrLabel.childNodes[0].textContent = rental ? 'Адрес подачи ' : 'Адрес загрузки ';
    }
  }

  function applyPageMeta(params) {
    var portal = qs('order-portal-link');
    if (portal) {
      var q = new URLSearchParams();
      if (params.vtype) q.set('vtype', params.vtype);
      if (params.source) q.set('source', params.source);
      var qsStr = q.toString();
      portal.href = '/z/' + (qsStr ? '?' + qsStr : '');
    }
    document.title = params.vtype && params.vtype !== 'other'
      ? 'Заказать ' + vtypeLabel(params.vtype) + ' — ООО «Армада»'
      : 'Заказать транспорт — ООО «Армада» · app.armada.sx';
  }

  function readVehicleAt() {
    var d = (qs('order-date') && qs('order-date').value || '').trim();
    var t = (qs('order-time') && qs('order-time').value || '').trim();
    if (!d) return '';
    return t ? d + 'T' + t : d;
  }

  function readForm(params) {
    return {
      kind: 'transport',
      company: (qs('order-company') && qs('order-company').value || '').trim(),
      phone: (qs('order-phone') && qs('order-phone').value || '').trim(),
      contactName: (qs('order-name') && qs('order-name').value || '').trim(),
      loadAddress: (qs('order-address') && qs('order-address').value || '').trim(),
      unloadAddress: (qs('order-unload') && qs('order-unload').value || '').trim(),
      vehicleAt: readVehicleAt(),
      comment: (qs('order-comment') && qs('order-comment').value || '').trim(),
      vehicleTypeId: selectedVtype === 'other' ? '' : selectedVtype,
      vtype: selectedVtype === 'other' ? '' : selectedVtype,
      source: params.source,
      carrierHint: 'ООО «Армада»'
    };
  }

  function validate(data) {
    if (!selectedVtype) return 'Выберите тип транспорта';
    if (!data.company) return 'Укажите компанию или ФИО';
    if (!data.phone || data.phone.replace(/\D/g, '').length < 10) return 'Укажите телефон для связи';
    if (!data.loadAddress) return 'Укажите адрес подачи';
    if (!data.vehicleAt) return 'Укажите дату подачи';
    return '';
  }

  function resetForm() {
    if (form) {
      form.hidden = false;
      form.reset();
    }
    var okBox = qs('order-success');
    if (okBox) okBox.hidden = true;
    showStatus('', null);
    var params = readQuery();
    paintVtypes(normalizeVtype(params.vtype));
  }

  async function submitOrder(ev) {
    if (ev) ev.preventDefault();
    var params = readQuery();
    var data = readForm(params);
    var err = validate(data);
    if (err) {
      showStatus(err, false);
      return;
    }
    var btn = qs('order-submit');
    if (btn) btn.disabled = true;
    showStatus('Отправляем заявку…', null);
    try {
      await ensureStore();
      if (typeof appendCustomerPortalLead !== 'function') throw new Error('sync');
      var res = await appendCustomerPortalLead(data);
      if (!res || !res.ok) throw new Error((res && res.error) || 'Не удалось сохранить');
      if (form) form.hidden = true;
      var okBox = qs('order-success');
      if (okBox) okBox.hidden = false;
      showStatus('', null);
    } catch (e) {
      console.warn('public transport order', e);
      showStatus('Не удалось отправить автоматически. Позвоните +7 (965) 073-00-02 или напишите hello@armada.sx', false);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function wire() {
    form = qs('order-form');
    statusEl = qs('order-status');
    var params = readQuery();
    applyPageMeta(params);
    paintVtypes(normalizeVtype(params.vtype));
    if (form) form.addEventListener('submit', submitOrder);
    var again = qs('order-again');
    if (again) again.addEventListener('click', resetForm);
    var dateEl = qs('order-date');
    if (dateEl && !dateEl.value) {
      var now = new Date();
      dateEl.min = now.toISOString().slice(0, 10);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
