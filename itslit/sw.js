/* ItsLit service worker: lets the app install, open instantly and keep the Library readable offline.
   Pages and settings come from the network first (so updates show at once); libraries and icons from the cache. */
const VERSION = 'itslit-48e82e4477';
const CORE = ['./', 'index.html', 'config.js', 'api-config.js', 'backend.js', 'manifest.webmanifest', 'privacy.html',
  'lib/three.min.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon.svg', 'icons/apple-touch-icon.png'];
const FRESH = /\/(index\.html|config\.js|api-config\.js|backend\.js|privacy\.html|manifest\.webmanifest)?$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('itslit-') && k !== VERSION && k !== 'itslit-fonts').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const keep = (cache, req, res) => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(cache).then(c => c.put(req, copy)); } return res; };

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return; // other pages on this host
    if (req.mode === 'navigate' || FRESH.test(url.pathname)) {
      e.respondWith(fetch(req).then(r => keep(VERSION, req, r))
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
      return;
    }
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => keep(VERSION, req, r))));
    return;
  }
  // the typefaces: serve from the cache, refresh in the background
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open('itslit-fonts').then(c => c.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
  }
});
