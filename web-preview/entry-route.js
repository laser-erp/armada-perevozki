/* Синхронный роут /a/ /v/ /z/ — до boot-loader, без зависимостей */
(function () {
  var path = (location.pathname || '').toLowerCase();
  var screenId = null;
  if (/\/(a)(\/|$)/.test(path)) screenId = 'admin-pin';
  else if (/\/(v)(\/|$)/.test(path)) screenId = 'driver-login';
  else if (/\/(z)(\/|$)/.test(path)) screenId = 'customer-login';
  if (!screenId) return;

  document.documentElement.setAttribute('data-armada-entry', screenId);

  function applyEntryRoute() {
    var target = document.getElementById(screenId);
    if (!target) return false;
    var root = document.getElementById('shell') || document.querySelector('.phone');
    var screens = root ? root.querySelectorAll('.screen') : document.querySelectorAll('.phone > .screen');
    screens.forEach(function (el) {
      el.classList.remove('show');
    });
    target.classList.add('show');
    return true;
  }

  window.__armadaApplyEntryRoute = applyEntryRoute;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyEntryRoute);
  } else {
    applyEntryRoute();
  }
})();
