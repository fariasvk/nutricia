const CACHE_NAME = 'nutricia-cache-v11-settings-editor-gemini';
const APP_ASSETS = [
  './', './index.html', './visual.css', './app.js', './manifest.json',
  './catalogo_299.json', './nutricia-hero-glass.webp', './nutricia-icon-192.png',
  './nutricia-icon-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_ASSETS.map(async asset => {
      try {
        const response = await fetch(asset, { cache: 'reload' });
        if (response.ok) await cache.put(asset, response);
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key =>
      key.startsWith('nutricia-cache-') && key !== CACHE_NAME
        ? caches.delete(key) : Promise.resolve()
    ));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    // Assets carregam imediatamente do cache; um novo SW instala nova versão integral.
    if (cached && event.request.mode !== 'navigate') return cached;
    if (cached && event.request.mode === 'navigate') {
      // A navegação tenta a versão publicada; preserva cache se offline.
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      } catch (_) { return cached; }
    }
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch (_) {
      if (event.request.mode === 'navigate') return await cache.match('./index.html') || Response.error();
      return Response.error();
    }
  })());
});
