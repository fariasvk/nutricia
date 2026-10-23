/* NutricIA v14 — evita conservar CSS/ícones antigos após um novo deploy. */
const CACHE_NAME = 'nutricia-cache-v14-inline-styles';
const ASSETS = [
  './', './index.html', './visual.css?v=14', './app.js?v=14',
  './manifest.json?v=14', './catalogo_299.json', './nutricia-hero-glass.webp',
  './nutricia-brand-v14.png', './nutricia-brand-v14-small.png',
  './nutricia-icon-v14-192.png','./nutricia-icon-v14-512.png',
  './nutricia-icon-v14-maskable-512.png', './apple-touch-icon-v14.png', './favicon-v14.png'
];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(ASSETS.map(async path => {
      try {
        const response = await fetch(path, {cache:'reload'});
        if(response.ok) await cache.put(path, response);
      } catch (_) { /* rede offline: instalar mesmo assim */ }
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('nutricia-cache-') && k !== CACHE_NAME)
      .map(k => caches.delete(k)));
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
    // Always prefer fresh HTML, styles, scripts, icons, and manifest so that
    // uploading a new version cannot leave the interface half-updated.
    const versioned = url.searchParams.has('v') || /-v14\./.test(url.pathname) || /-v14-/.test(url.pathname);
    const networkFirst = event.request.mode === 'navigate' ||
      (!versioned && /\.(?:html|css|js)$/.test(url.pathname));
    if (!networkFirst && cached) return cached;
    try {
      const response = await fetch(event.request, {cache:networkFirst ? 'no-cache' : 'default'});
      if(response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch (_) {
      return cached || (event.request.mode === 'navigate'
        ? await cache.match('./index.html') || Response.error() : Response.error());
    }
  })());
});
