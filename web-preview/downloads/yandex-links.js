/* Внешние ссылки — через Яндекс Браузер (Android intent + fallback). */
(function () {
  const YANDEX_PKG = 'com.yandex.browser';

  function isAndroid() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function yandexIntentUrl(httpsUrl) {
    const u = new URL(httpsUrl);
    const fallback = encodeURIComponent(httpsUrl);
    return (
      'intent://' +
      u.host +
      u.pathname +
      u.search +
      (u.hash || '') +
      '#Intent;scheme=https;package=' +
      YANDEX_PKG +
      ';S.browser_fallback_url=' +
      fallback +
      ';end'
    );
  }

  function openExternal(url) {
    if (!url) return;
    if (isAndroid()) {
      window.location.href = yandexIntentUrl(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  window.armadaOpenExternal = openExternal;

  function bind(el) {
    const url = el.getAttribute('href') || el.dataset.href;
    if (!url || !/^https?:/i.test(url)) return;
    el.addEventListener('click', function (e) {
      e.preventDefault();
      openExternal(url);
    });
  }

  function init() {
    document.querySelectorAll('[data-yandex-external]').forEach(bind);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
