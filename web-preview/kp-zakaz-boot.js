/* kp-zakaz.html — параметры ссылки на портал (CSP) */
(function () {
  var q = new URLSearchParams(location.search || '');
  var slug = (q.get('z') || q.get('slug') || '').trim();
  var carrier = (q.get('carrier') || '').trim();
  var login = '/z/';
  if (slug) login = '/z/' + encodeURIComponent(slug) + '/';
  var cta = document.getElementById('cta-login');
  if (cta) cta.href = login;
  if (carrier) {
    var card = document.getElementById('carrier-card');
    var name = document.getElementById('carrier-name');
    if (name) name.textContent = carrier;
    if (card) card.hidden = false;
  }
})();
