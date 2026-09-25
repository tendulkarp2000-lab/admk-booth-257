const CACHE = 'admk-booth-257-v2';
const ASSETS = [
  './app.html',
  './app.js?v=2.0',
  './voters_data.js?v=2.0',
  './manifest.json'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Always fetch network first for app.js and API calls so Chrome never caches stale code
  if (e.request.url.includes('app.js') || e.request.url.includes('api.restful-api.dev')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
  }
});
