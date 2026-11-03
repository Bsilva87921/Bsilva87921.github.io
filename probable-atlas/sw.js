/* Probable Atlas — service worker: the app shell is cached for instant, offline starts; pages and data are fetched
   fresh when online (network first, with a time limit) and the last good copy is served when offline. */
const V = 'atlas-v3', DATA = 'atlas-data';
const SHELL = ["/probable-atlas/app/", "/probable-atlas/", "/probable-atlas/finance/", "/probable-atlas/manifest.webmanifest", "/probable-atlas/icons/atlas-192.png", "/probable-atlas/icons/atlas-512.png", "/assets/probable-3d/probable-3d.js?v=3", "/probable-atlas/ai-config.js"];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => { })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('atlas-') && k !== V && k !== DATA).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const withTimeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then(r => { clearTimeout(t); res(r); }, e => { clearTimeout(t); rej(e); }); });
async function trim(cache, max) { const ks = await cache.keys(); for (let i = 0; i < ks.length - max; i++) await cache.delete(ks[i]); }
async function networkFirst(req, name, ms, max) {
  const c = await caches.open(name);
  try {
    const r = await withTimeout(fetch(req), ms);
    if (r && r.ok) { c.put(req, r.clone()).then(() => max && trim(c, max)); }
    return r;
  } catch (e) {
    const m = await c.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (m) return m;
    if (req.mode === 'navigate') { const s = await caches.open(V); const f = await s.match('/probable-atlas/app/'); if (f) return f; }
    throw e;
  }
}
async function staleWhileRevalidate(req, name) {
  const c = await caches.open(name), m = await c.match(req);
  const p = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => m);
  return m || p;
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin && u.pathname.startsWith('/probable-atlas/') && /\/data\//.test(u.pathname)) { e.respondWith(networkFirst(req, DATA, 20000)); return; }
  if (false) { e.respondWith(networkFirst(req, DATA, 9000, 240)); return; }
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, V, 6000)); return; }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) { e.respondWith(staleWhileRevalidate(req, V)); return; }
  if (u.origin === location.origin) { e.respondWith(staleWhileRevalidate(req, V)); return; }
});
