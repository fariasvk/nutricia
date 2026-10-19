const CACHE_NAME = 'nutricia-cache-v4';

const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys.map((key) => {
        if (
          key.startsWith('nutricia-cache-') &&
          key !== CACHE_NAME
        ) {
          return caches.delete(key);
        }

        return Promise.resolve(false);
      })
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // Deixa as bibliotecas e APIs externas seguirem normalmente.
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);

    if (cached) return cached;

    try {
      const response = await fetch(event.request);

      if (response && response.ok) {
        await cache.put(event.request, response.clone());
      }

      return response;
    } catch (error) {
      return await cache.match('./index.html') || Response.error();
    }
  })());
});
