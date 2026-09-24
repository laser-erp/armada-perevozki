/* АРМАДА PWA — JS/CSS network-first (не держать сломанный кэш) */
const CACHE = 'armada-shell-v85';
function swResponseOrError(promise, fallbackUrl){
  return Promise.resolve(promise).then(r=>{
    if(r) return r;
    if(fallbackUrl) return caches.match(fallbackUrl);
    return Response.error();
  }).then(r=>r||Response.error());
}
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
  const isDoc = req.mode === 'navigate' || path.endsWith('/') || /index\.html$/i.test(path) || /\/sw\.js$/i.test(path);
  const isScriptOrStyle = /\.(js|css)$/i.test(path);
  if (isDoc) {
    event.respondWith(swResponseOrError(
      fetch(req, { cache: 'no-store' }).catch(()=>caches.match('./index.html')),
      './'
    ));
    return;
  }
  if (isScriptOrStyle) {
    const versioned = url.searchParams.has('v');
    if (versioned) {
      event.respondWith(swResponseOrError(
        fetch(req, { cache: 'no-store' }).catch(()=>caches.match(req))
      ));
      return;
    }
    event.respondWith(swResponseOrError(
      fetch(req).catch(()=>caches.match(req))
    ));
    return;
  }
  event.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
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
