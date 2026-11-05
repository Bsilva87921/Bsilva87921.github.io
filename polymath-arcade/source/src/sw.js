/* Polymath Arcade service worker: opens instantly, plays offline, updates quietly.
   The build stamps VERSION with a hash of the page, so every release gets a fresh cache. */
const VERSION = '__VERSION__';
const CORE = 'pa-core-' + VERSION;
const RUNTIME = 'pa-runtime-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './icons/maskable-192.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CORE).then(cache => cache.addAll(SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('pa-core-') && k !== CORE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Page loads: serve the cached app shell first, so it opens offline and instantly.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CORE);
      const hit = await cache.match('./index.html') || await cache.match('./');
      if (hit) return hit;
      try { return await fetch(req); }
      catch (err) { return new Response('<h1>Offline</h1><p>Open Polymath Arcade once while online to install it.</p>', { status: 503, headers: { 'Content-Type': 'text/html' } }); }
    })());
    return;
  }

  // Same-origin files (icons, manifest): cache first, then network.
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(RUNTIME).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // The code font from Google Fonts: serve the saved copy, refresh it in the background.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const hit = await cache.match(req);
      const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })());
  }
});
