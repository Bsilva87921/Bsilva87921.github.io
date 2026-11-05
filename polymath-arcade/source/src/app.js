/* =====================================================================
   App layer: install prompt, offline support, updates, splash screen,
   deep links (#games, #daily, #profile, #tour), swipe between tabs,
   theme-colored system bars. Shared by both builds: install and offline
   switch on only in the app build, which ships a manifest and a worker.
   ===================================================================== */
const App = (() => {
  let deferred = null, iosHint = false, waiting = null, hadController = false;
  const ORDER = ['home', 'daily', 'profile'];
  const ROUTES = { games: 'home', daily: 'daily', profile: 'profile' };
  const isApp = () => !!window.PA_APP;
  const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true; } catch (e) { return false; } };
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = () => /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Android/.test(navigator.userAgent);

  function actionToast(msg, label, fn, ms = 15000) {
    const t = h('div', { class: 'toast act' }, h('span', null, msg), h('button', { class: 'btn small primary', type: 'button', onclick: () => { t.remove(); fn(); } }, label));
    $('#toast').append(t); setTimeout(() => t.remove(), ms);
  }
  function paintInstall() {
    const b = $('#installBtn'); if (!b) return;
    b.hidden = !(isApp() && !standalone() && (deferred || iosHint));
  }
  async function install() {
    if (deferred) {
      const d = deferred; deferred = null;
      try { d.prompt(); const r = await d.userChoice; if (r && r.outcome === 'accepted') toast('Installing Polymath Arcade'); } catch (e) { /* prompt refused */ }
      paintInstall(); if (VIEW === 'profile' && !CUR) render();
      return;
    }
    if (iosHint) iosSheet();
  }
  function iosSheet() {
    const share = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8"/></svg>';
    const add = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
    openModal(h('div', { class: 'ios-sheet' },
      h('div', { class: 'ios-stage', 'aria-hidden': 'true' }, h('div', { class: 'ios-phone' }, h('div', { class: 'ios-screen' },
        h('span', { class: 'ios-icon' }, h('span', { class: 'cube' }, ...['Pm', 'Ar', 'Ec', 'Rc', 'Ms', 'Lx'].map(t => h('i', null, t)))), h('small', null, 'Polymath')))),
      h('h2', null, 'Add Polymath Arcade to your Home Screen'),
      h('ol', { class: 'ios-steps' },
        h('li', null, h('span', { class: 'ii', html: share }), h('span', null, 'Tap ', h('b', null, 'Share'), ' in Safari’s toolbar.')),
        h('li', null, h('span', { class: 'ii', html: add }), h('span', null, 'Choose ', h('b', null, 'Add to Home Screen'), '.')),
        h('li', null, h('span', { class: 'ii' }, '✓'), h('span', null, 'Tap ', h('b', null, 'Add'), '. It opens full screen and works offline.'))),
      h('div', { class: 'sheet-actions' }, h('button', { class: 'btn primary', type: 'button', onclick: closeModal, 'data-autofocus': true }, 'Got it'))),
      { label: 'Install on iPhone or iPad' });
  }
  function settingRow() {
    if (!isApp()) return null;
    if (standalone()) return h('div', { class: 'setting' }, h('div', null, h('b', null, 'App'), h('p', null, 'Installed on this device. Opens full screen and works offline.')), h('span', { class: 'pill installed' }, '✓ Installed'));
    if (!deferred && !iosHint) return null;
    return h('div', { class: 'setting' }, h('div', null, h('b', null, 'Install the app'), h('p', null, 'Add it to your home screen or desktop. It opens full screen and works offline.')), h('button', { class: 'btn small primary', type: 'button', onclick: install }, 'Install'));
  }

  /* Service worker: offline play and quiet updates */
  function registerSW() {
    if (!isApp() || !('serviceWorker' in navigator)) return;
    const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
    if (!secure) return;
    hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('./sw.js').then(reg => {
      const offer = w => { waiting = w; actionToast('A new version of Polymath Arcade is ready.', 'Update', () => { try { waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (e) { location.reload(); } }); };
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing; if (!w) return;
        w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
      });
      setInterval(() => reg.update().catch(() => {}), 3600 * 1000);
    }).catch(() => { /* not available here */ });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadController || reloading) { hadController = true; return; } reloading = true; location.reload(); });
  }

  /* Deep links on the hash: #games, #daily, #profile, #tour */
  function hashView() { const v = ROUTES[(location.hash || '').slice(1)]; return v || null; }
  function route(view) {
    const k = view === 'home' ? 'games' : view;
    if ((location.hash || '').slice(1) === k) return;
    if (!location.hash && view === 'home') return;          // keep a clean URL on the start view
    try { location.replace('#' + k); } catch (e) { /* sandboxed */ }
  }
  function onHash() {
    const k = (location.hash || '').slice(1);
    if (k === 'tour') { if (!CUR) setTimeout(() => Tour.start(), 250); return; }
    const v = ROUTES[k];
    if (v && v !== VIEW && !CUR) navTo(v);
  }

  /* Tabs slide like an app: forward to the right, back to the left */
  function navTo(view) {
    if (view === VIEW) { go(view); return; }
    const dir = ORDER.indexOf(view) > ORDER.indexOf(VIEW) ? 'next' : 'prev';
    document.documentElement.dataset.swipe = dir;
    go(view);
    setTimeout(() => { delete document.documentElement.dataset.swipe; }, 650);
  }
  function swipeNav() {
    const v = $('#view'); if (!v) return;
    let sx = 0, sy = 0, st = 0, ok = false;
    v.addEventListener('touchstart', e => {
      ok = e.touches.length === 1 && !CUR && !Tour.active && $('#modal').hidden && !e.target.closest('.legend,input,textarea,select,.no-swipe');
      if (!ok) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
    }, { passive: true });
    v.addEventListener('touchend', e => {
      if (!ok) return; ok = false;
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st > 700 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
      const k = ORDER.indexOf(VIEW) + (dx < 0 ? 1 : -1);
      if (k >= 0 && k < ORDER.length) { buzz(8); navTo(ORDER[k]); }
    }, { passive: true });
  }

  /* System bar color follows the theme */
  function syncThemeColor() {
    const metas = $$('meta[name="theme-color"]'); if (!metas.length) return;
    const dark = effectiveTheme() === 'dark', c = dark ? '#05060f' : '#edf0f8';
    metas.forEach(m => { if (!m.dataset.orig) m.dataset.orig = m.getAttribute('content'); m.setAttribute('content', S.theme ? c : m.dataset.orig); });
  }

  /* Animated splash (app build only) */
  function splash() {
    const el = $('#splash'); if (!el) return 0;
    const ms = reduceMotion() ? 250 : 1750;
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 700); }, ms);
    return ms;
  }

  function init() {
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; paintInstall(); if (VIEW === 'profile' && !CUR) render(); });
    addEventListener('appinstalled', () => { deferred = null; iosHint = false; paintInstall(); toast('Installed. Find Polymath Arcade with your apps.'); });
    if (isApp() && isIOS() && isSafari() && !standalone()) iosHint = true;
    paintInstall();
    registerSW();
    if (isApp()) {
      addEventListener('offline', () => toast('You’re offline. Every game still works, and progress saves on this device.', 4200));
      addEventListener('online', () => toast('Back online'));
    }
    addEventListener('hashchange', onHash);
    swipeNav();
    syncThemeColor();
    try { new MutationObserver(syncThemeColor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) { /* ignore */ }
    if (standalone()) document.documentElement.classList.add('standalone');
    return splash();
  }
  return { init, install, settingRow, standalone, route, hashView, navTo, get isApp() { return isApp(); } };
})();
