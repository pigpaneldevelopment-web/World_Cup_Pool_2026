// Cache version — bump this string any time index.html changes so old
// caches are purged and clients pick up the new app shell.
const CACHE_NAME = 'wc-pool-2026-v8';

// Only truly-static, rarely-changing assets are pre-cached.
// NOTE: index.html is deliberately NOT pre-cached cache-first — see fetch handler.
const STATIC_ASSETS = [
  './manifest.json',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(STATIC_ASSETS).catch(err => console.log('precache (non-fatal):', err))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // 1) ESPN API + CORS proxies: ALWAYS network, never cache. Live data must be fresh.
  if (url.includes('espn.com') || url.includes('corsproxy.io') || url.includes('allorigins.win')) {
    event.respondWith(fetch(event.request).catch(() =>
      new Response(JSON.stringify({ events: [] }), { headers: { 'Content-Type': 'application/json' } })
    ));
    return;
  }

  // 2) The app shell (index.html / navigations): NETWORK-FIRST so updates always
  //    reach the user. Fall back to cache only when offline.
  if (event.request.mode === 'navigate' || url.endsWith('/') || url.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // 3) Other static assets (fonts, icons, manifest): cache-first, fine to be stable.
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
    )
  );
});
