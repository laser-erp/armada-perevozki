/* Редирект со старых .html — внешний скрипт для CSP script-src 'self' */
(function () {
  var tag = document.currentScript;
  var href = tag && tag.getAttribute('data-href');
  if (!href) return;
  var q = location.search || '';
  if (q && href.indexOf('?') === -1) href += q;
  location.replace(href);
})();
