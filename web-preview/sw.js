/* АРМАДА PWA — всегда свежий index с сети */
const CACHE = 'armada-shell-v2';
const SHELL = ['./manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;
  // HTML приложения и sw — только сеть, без кэша страницы
  const isDoc = req.mode === 'navigate' || path.endsWith('/') || /index\.html$/i.test(path) || /\/sw\.js$/i.test(path);
  if (isDoc) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => caches.match('./manifest.webmanifest').then(() => fetch(req)))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
    )
  );
});
