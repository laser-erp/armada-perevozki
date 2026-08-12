/* АРМАДА PWA — HTML с сети; офлайн — оболочка из кэша; уведомления */
const CACHE = 'armada-shell-v9';
const SHELL = ['./', './index.html', './styles.css', './store.js', './driver.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim()).then(() =>
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((c) => c.postMessage({ type: 'ARMADA_SW_UPDATED', cache: CACHE }));
      })
    )
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  const isDoc = req.mode === 'navigate' || path.endsWith('/') || /index\.html$/i.test(path) || /\/sw\.js$/i.test(path);
  if (isDoc) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() =>
        caches.match('./index.html').then((r) => r || caches.match('./'))
      )
    );
    return;
  }
  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
