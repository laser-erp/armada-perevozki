/* АРМАДА — внешний загрузчик (CSP script-src 'self' без unsafe-inline) */
(function () {
  var APP_BUILD = '2026-08-31-hub-desktop4317';

  window.__armadaBootDone = false;
  setTimeout(function () {
    var sp = document.getElementById('splash');
    if (!sp || !sp.classList.contains('show')) return;
    if (typeof showAfterSplash === 'function' && typeof showDefaultAfterSplash === 'function') {
      showAfterSplash(showDefaultAfterSplash);
      return;
    }
    if (typeof showAfterSplash === 'function') {
      showAfterSplash('roles');
      return;
    }
    if (typeof show === 'function') {
      show('roles');
      return;
    }
    document.querySelectorAll('.phone > .screen').forEach(function (s) {
      s.classList.remove('show');
    });
    var roles = document.getElementById('roles');
    if (roles) roles.classList.add('show');
  }, 5000);

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
    if (isV) files.push('qrcode.min.js', 'entry-share.js', 'etrn.js', 'driver.js');
    else if (isA) files.push('qrcode.min.js', 'entry-share.js', 'order-documents.js', 'doc-templates.js', 'etrn.js', 'admin.js', 'admin-docs.js', 'admin-plans.js', 'onboarding.js');
    else if (isZ) files.push('qrcode.min.js', 'customer-invoice.js', 'order-documents.js', 'doc-templates.js', 'etrn.js', 'customer.js', 'onboarding.js');
    else {
      files.push(
        'qrcode.min.js',
        'customer-invoice.js',
        'entry-share.js',
        'order-documents.js',
        'doc-templates.js',
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

  var chain = Promise.resolve();
  scriptBundle().forEach(function (f) {
    chain = chain.then(function () {
      return loadScript('/' + f + '?v=' + encodeURIComponent(APP_BUILD));
    });
  });
  chain.catch(function (err) {
    console.error('АРМАДА boot-loader', err);
  });
})();
