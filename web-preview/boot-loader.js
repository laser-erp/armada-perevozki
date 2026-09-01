/* АРМАДА — внешний загрузчик (CSP script-src 'self' без unsafe-inline) */
(function () {
  var APP_BUILD = '2026-09-01-fleet4317b';

  window.__armadaBootDone = false;

  function dedicatedScreenId() {
    var p = (location.pathname || '').toLowerCase();
    if (/\/(a)(\/|$)/.test(p)) return 'admin-pin';
    if (/\/(v)(\/|$)/.test(p)) return 'driver-login';
    if (/\/(z)(\/|$)/.test(p)) return 'customer-login';
    return null;
  }

  function showScreenEarly(id) {
    if (!id) return;
    if (typeof window.__armadaApplyEntryRoute === 'function') {
      window.__armadaApplyEntryRoute();
      return;
    }
    var target = document.getElementById(id);
    if (!target) return;
    var root = document.getElementById('shell') || document.querySelector('.phone');
    var screens = root ? root.querySelectorAll('.screen') : document.querySelectorAll('.phone > .screen');
    screens.forEach(function (s) {
      s.classList.remove('show');
    });
    target.classList.add('show');
  }

  showScreenEarly(dedicatedScreenId());

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error('load ' + src));
      };
      (document.head || document.documentElement).appendChild(s);
    });
  }

  function shellScripts() {
    var p = (location.pathname || '').toLowerCase();
    var isV = /\/(v)(\/|$)/.test(p);
    var isA = /\/(a)(\/|$)/.test(p);
    var isZ = /\/(z)(\/|$)/.test(p);
    var files = ['store.js', 'billing.js'];
    if (isV) files.push('qrcode.min.js', 'entry-share.js', 'epd-sign.js', 'etrn.js', 'driver.js');
    else if (isA) files.push('qrcode.min.js', 'entry-share.js', 'print-window.js', 'order-documents.js', 'doc-templates.js', 'operator-letters.js', 'admin-profile.js', 'epd-sign.js', 'etrn.js', 'admin.js', 'admin-docs.js', 'admin-plans.js', 'onboarding.js');
    else if (isZ) files.push('qrcode.min.js', 'customer-invoice.js', 'order-documents.js', 'doc-templates.js', 'epd-sign.js', 'etrn.js', 'customer.js', 'onboarding.js');
    else {
      files.push(
        'qrcode.min.js',
        'customer-invoice.js',
        'entry-share.js',
        'print-window.js',
        'order-documents.js',
        'doc-templates.js',
        'operator-letters.js',
        'admin-profile.js',
        'epd-sign.js',
        'driver.js',
        'etrn.js',
        'admin.js',
        'admin-docs.js',
        'admin-plans.js',
        'customer.js',
        'onboarding.js'
      );
    }
    files.push('app.js');
    return files;
  }

  function inviteScripts() {
    return ['store.js', 'billing.js', 'app.js', 'driver.js', 'invite.js'];
  }

  function scriptBundle() {
    var tag = document.currentScript;
    var mode = tag && tag.getAttribute('data-mode');
    if (mode === 'invite') return inviteScripts();
    return shellScripts();
  }

  function finishBoot() {
    window.__armadaBootDone = true;
    var early = dedicatedScreenId();
    if (early) {
      showScreenEarly(early);
      if (early === 'admin-pin' && typeof wireAdminLoginHandlers === 'function') wireAdminLoginHandlers();
      if (early === 'admin-pin') {
        var loginBtn = document.getElementById('pin-ok');
        if (loginBtn) loginBtn.disabled = false;
      }
      if (typeof openDedicatedEntryScreen === 'function') openDedicatedEntryScreen();
      return;
    }
    setTimeout(function () {
      var sp = document.getElementById('splash');
      if (!sp || !sp.classList.contains('show') || window.__armadaSplashDone) return;
      if (typeof finishSplashOnce === 'function' && typeof showRoleHub === 'function') {
        finishSplashOnce(showRoleHub);
      } else if (typeof show === 'function') {
        show('roles');
      }
    }, 6000);
  }

  var chain = Promise.resolve();
  scriptBundle().forEach(function (f) {
    chain = chain.then(function () {
      return loadScript('/' + f + '?v=' + encodeURIComponent(APP_BUILD));
    });
  });
  chain.then(finishBoot).catch(function (err) {
    console.error('АРМАДА boot-loader', err);
    finishBoot();
  });
})();
