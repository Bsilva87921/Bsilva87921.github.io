/* Probable kit: installable-app support shared by the Probable sites. Registers the site's service worker (offline use and
   fast starts), shows an "Install app" button where the browser offers installation (with instructions for iPhone, iPad
   and Mac Safari), marks the page when it runs as an installed app, and opens Ask AI from an ?ask= link. */
const PAPP = (() => {
  const mm = q => !!(window.matchMedia && matchMedia(q).matches);
  const standalone = () => mm('(display-mode: standalone)') || mm('(display-mode: window-controls-overlay)') || mm('(display-mode: fullscreen)') || navigator.standalone === true;
  const embedded = () => !!(window.Capacitor || window.PROBABLE_NATIVE || window.ATLAS_FIN_DATA || window.ATLAS_DATA || window.SPORTS_ARTIFACT);
  // in the native apps, folder links (…/finance/) open the folder's index.html, and other sites open in the browser
  if (window.PROBABLE_NATIVE) document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]'); if (!a || e.defaultPrevented) return;
    const u = new URL(a.getAttribute('href'), location.href);
    if (u.origin !== location.origin) { if (!a.target) a.target = '_blank'; return; }
    if (u.pathname.endsWith('/')) { e.preventDefault(); location.href = u.pathname + 'index.html' + u.search + u.hash; }
  }, true);
  let deferred = null, btn = null, help = null, O = {};
  const ua = navigator.userAgent || '';
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const macSafari = /macintosh/i.test(ua) && /safari/i.test(ua) && !/chrome|crios|chromium|edg|firefox|fxios/i.test(ua) && !ios;
  function init(o) {
    O = o || {};
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) && !embedded() && O.sw) navigator.serviceWorker.register(O.sw, { scope: O.scope }).catch(() => { });
    if (standalone()) document.documentElement.classList.add('is-app');
    const host = typeof O.host === 'string' ? document.querySelector(O.host) : O.host;
    if (host && !standalone() && !embedded()) {
      btn = document.createElement('button'); btn.type = 'button'; btn.className = 'appbtn'; btn.hidden = true;
      btn.innerHTML = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 1.5v8.2M4.6 6.6 8 10l3.4-3.4M2.5 11.5v2h11v-2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>Install app';
      btn.setAttribute('aria-label', 'Install ' + (O.name || 'this site') + ' as an app');
      if (O.before && host.contains(O.before)) host.insertBefore(btn, O.before); else host.appendChild(btn);
      btn.addEventListener('click', onClick);
      if (ios || macSafari) btn.hidden = false;
    }
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; if (btn) btn.hidden = false; });
    window.addEventListener('appinstalled', () => { if (btn) btn.hidden = true; closeHelp(); });
  }
  async function onClick() {
    if (deferred) { deferred.prompt(); try { const r = await deferred.userChoice; if (r && r.outcome === 'accepted' && btn) btn.hidden = true; } catch (e) { /* ignore */ } deferred = null; return; }
    showHelp();
  }
  function closeHelp() { if (help) { help.remove(); help = null; } }
  function showHelp() {
    closeHelp();
    help = document.createElement('div'); help.className = 'apphelp'; help.setAttribute('role', 'dialog'); help.setAttribute('aria-label', 'How to install');
    const steps = ios ? '<li>Tap the <b>Share</b> button (the square with an arrow).</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>'
      : macSafari ? '<li>In the menu bar, choose <b>File → Add to Dock…</b></li><li>Click <b>Add</b>. It opens in its own window.</li>'
        : '<li>In Chrome or Edge, use the <b>install</b> icon at the right of the address bar, or the menu → <b>Install</b>.</li><li>On Android, open the menu and choose <b>Install app</b>.</li>';
    help.innerHTML = `<div class="apphelp-in"><b>Install ${O.name ? O.name.replace(/[<>&]/g, '') : 'this app'}</b><ol>${steps}</ol><p>It opens in its own window, starts faster and keeps the last data for when you're offline.</p><button type="button" class="apphelp-x" aria-label="Close">×</button></div>`;
    document.body.appendChild(help);
    help.addEventListener('click', e => { if (e.target.closest('.apphelp-x') || e.target === help) closeHelp(); });
  }
  // ?ask=… opens Ask AI with that question once the page is ready
  function ask(openFn) { try { const q = new URLSearchParams(location.search).get('ask'); if (q && openFn) setTimeout(() => openFn(q.slice(0, 300)), 500); } catch (e) { /* ignore */ } }
  return { init, standalone, ask };
})();
