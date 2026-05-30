/* DeliveryBuddy MK2 service worker — offline cache + screenshot Share Target */
const CACHE = 'db-mk2-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'share-img').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Receive a shared screenshot (Android Share -> DeliveryBuddy)
  if (e.request.method === 'POST' && url.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const file = form.get('image');
        if (file) {
          const cache = await caches.open('share-img');
          await cache.put('shared-image', new Response(file, { headers: { 'Content-Type': file.type || 'image/png' } }));
        }
      } catch (err) { /* ignore */ }
      return Response.redirect('./?share=1', 303);
    })());
    return;
  }

  // Cache-first for our own GET assets; network for everything else
  if (e.request.method === 'GET' && url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => { try { c.put(e.request, copy); } catch (_) {} });
        return resp;
      }).catch(() => caches.match('./index.html')))
    );
  }
});
