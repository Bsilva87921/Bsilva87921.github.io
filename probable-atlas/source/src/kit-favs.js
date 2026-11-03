/* Probable kit: favorites (star teams, markets or countries), alerts for them (an in-page toast, plus a system
   notification when the visitor turns alerts on), haptic taps in the apps, and the installed app's icon badge.
   Favorites live in this browser only. */
// a Capacitor plugin in the installed apps: from Capacitor.Plugins, or registered by name through the native bridge
const KXP = n => {
  const C = window.Capacitor; if (!C || !(C.isNativePlatform && C.isNativePlatform())) return null;
  if (C.Plugins && C.Plugins[n]) return C.Plugins[n];
  try { if (C.registerPlugin && (!C.isPluginAvailable || C.isPluginAvailable(n))) return (C.Plugins = C.Plugins || {})[n] = C.registerPlugin(n); } catch (e) { /* not installed */ }
  return null;
};
const HAPTIC = (() => {
  const P = () => KXP('Haptics');
  const vib = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } };
  return {
    tap() { const h = P(); if (h) { try { h.impact({ style: 'LIGHT' }); } catch (e) { /* ignore */ } } else vib(8); },
    tick() { const h = P(); if (h) { try { h.selectionChanged ? h.selectionChanged() : h.impact({ style: 'LIGHT' }); } catch (e) { /* ignore */ } } else vib(4); },
    success() { const h = P(); if (h) { try { h.notification({ type: 'SUCCESS' }); } catch (e) { /* ignore */ } } else vib([10, 40, 18]); }
  };
})();

const ALERT = (() => {
  let O = { app: 'Probable', key: 'probable' }, box = null;
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const native = () => KXP('LocalNotifications');
  function init(o) { O = Object.assign(O, o || {}); }
  function seen(id) {
    let m = {}; try { m = JSON.parse(ls(O.key + '-alerts-seen') || '{}'); } catch (e) { m = {}; }
    const now = Date.now(); for (const k in m) if (now - m[k] > 3 * 864e5) delete m[k];
    const was = !!m[id]; m[id] = now; ls(O.key + '-alerts-seen', JSON.stringify(m)); return was;
  }
  function status() {
    if (native()) return ls(O.key + '-alerts') === 'on' ? 'on' : 'off';
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'denied') return 'blocked';
    return Notification.permission === 'granted' && ls(O.key + '-alerts') === 'on' ? 'on' : 'off';
  }
  async function enable() {
    try {
      const n = native();
      if (n) { const r = await n.requestPermissions(); if (r && r.display === 'granted') { ls(O.key + '-alerts', 'on'); toast({ title: 'Alerts are on', body: 'You will hear about the teams and markets you follow.', tone: 'up' }); return 'on'; } return 'off'; }
      if (!('Notification' in window)) { toast({ title: 'Alerts stay in the page', body: 'This browser does not offer notifications, so alerts show here while the page is open.' }); return 'unsupported'; }
      const p = await Notification.requestPermission();
      if (p === 'granted') { ls(O.key + '-alerts', 'on'); toast({ title: 'Alerts are on', body: 'You will be notified about what you follow while this page or app is open.', tone: 'up' }); }
      return status();
    } catch (e) { return status(); }
  }
  function disable() { ls(O.key + '-alerts', 'off'); }
  async function system(a) {
    try {
      const n = native();
      if (n) { await n.schedule({ notifications: [{ id: Math.floor(Math.random() * 2e9), title: a.title, body: a.body || '', schedule: { at: new Date(Date.now() + 250) } }] }); return; }
      if (status() !== 'on') return;
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) await reg.showNotification(a.title, { body: a.body || '', tag: a.id, icon: O.icon, badge: O.icon });
      else new Notification(a.title, { body: a.body || '', tag: a.id, icon: O.icon });
    } catch (e) { /* notifications are best effort */ }
  }
  function toast(a) {
    if (!box) { box = document.createElement('div'); box.className = 'kx-toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'kx-toast kx-' + (a.tone || 'info');
    t.innerHTML = `<span class="kx-toast-dot" aria-hidden="true"></span><div class="kx-toast-txt"><b>${esc(a.title)}</b>${a.body ? `<span>${esc(a.body)}</span>` : ''}</div>${a.action ? `<button type="button" class="kx-toast-act">${esc(a.action)}</button>` : ''}<button type="button" class="kx-toast-x" aria-label="Dismiss">×</button>`;
    box.appendChild(t); requestAnimationFrame(() => t.classList.add('in'));
    const close = () => { t.classList.remove('in'); setTimeout(() => t.remove(), 260); };
    t.addEventListener('click', ev => {
      if (ev.target.closest('.kx-toast-x')) return close();
      if (ev.target.closest('.kx-toast-act') && a.onAction) { a.onAction(); return close(); }
      if (a.go) { a.go(); close(); }
    });
    setTimeout(close, a.ms || 7000);
    while (box.children.length > 3) box.firstChild.remove();
    return t;
  }
  // an alert = a toast now, plus a system notification when alerts are on and the page is in the background
  function notify(a) {
    if (!a || !a.id || seen(a.id)) return false;
    toast(a); HAPTIC.tap();
    if (document.hidden || native() || (window.PAPP && PAPP.standalone && PAPP.standalone())) system(a);
    return true;
  }
  return { init, notify, toast, enable, disable, status };
})();

const BADGE = {
  set(n) { try { if (navigator.setAppBadge) { if (n > 0) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (e) { /* not installed or not supported */ } }
};

const FAV = (() => {
  let KEY = 'probable-favs', data = {}, subs = [], O = {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const load = () => { try { data = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { data = {}; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ } };
  const STAR = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="currentColor"/></svg>';
  function init(o) {
    O = o || {}; KEY = O.key || KEY; load();
    document.addEventListener('click', ev => {
      const b = ev.target.closest && ev.target.closest('[data-fav]'); if (!b) return;
      ev.preventDefault(); ev.stopPropagation();
      toggle(b.dataset.fav, b.dataset.favLabel || b.getAttribute('aria-label') || '', b.dataset.favMeta ? JSON.parse(b.dataset.favMeta) : null);
    }, true);
  }
  const has = k => !!data[k];
  function toggle(k, label, meta) {
    const on = !data[k];
    if (on) data[k] = { label, meta: meta || null, t: Date.now() }; else delete data[k];
    save(); paint(k); HAPTIC.tick();
    if (on) {
      const st = ALERT.status();
      ALERT.toast({ title: `Following ${label}`, body: O.followNote || 'It moves to the top, and you get alerts about it.', tone: 'up', action: st === 'off' ? 'Turn on alerts' : null, onAction: () => ALERT.enable() });
    }
    subs.forEach(f => { try { f(k, on); } catch (e) { console.warn(e); } });
  }
  function paint(k) {
    document.querySelectorAll('[data-fav]').forEach(b => { if (k && b.dataset.fav !== k) return; const on = has(b.dataset.fav); b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); const l = b.dataset.favLabel || ''; b.setAttribute('aria-label', (on ? 'Unfollow ' : 'Follow ') + l); b.title = on ? 'Following · tap to unfollow' : 'Follow'; });
  }
  function btn(k, label, cls, meta) {
    const on = has(k);
    return `<button type="button" class="fav-btn ${cls || ''}${on ? ' on' : ''}" data-fav="${esc(k)}" data-fav-label="${esc(label)}"${meta ? ` data-fav-meta='${esc(JSON.stringify(meta))}'` : ''} aria-pressed="${on}" aria-label="${on ? 'Unfollow' : 'Follow'} ${esc(label)}" title="${on ? 'Following · tap to unfollow' : 'Follow'}">${STAR}</button>`;
  }
  function list(prefix) { return Object.entries(data).filter(([k]) => !prefix || k.startsWith(prefix)).map(([k, v]) => Object.assign({ key: k }, v)).sort((a, b) => a.t - b.t); }
  return { init, has, toggle, btn, list, paint, on: f => subs.push(f), count: p => list(p).length };
})();

Object.assign(window, { KXP, HAPTIC, ALERT, BADGE, FAV });
