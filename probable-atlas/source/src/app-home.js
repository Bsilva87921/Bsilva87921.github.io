/* Probable Atlas — the app's home screen: module launcher, the latest readings each module saved on this device, and
   a slowly turning globe. Works offline once installed. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MODS = [
    { k: 'econ', name: 'Economics', on: true, href: '../', icon: '◍', blurb: '214 economies from the IMF and World Bank, 52 FRED series for the US, recession odds, a GDP nowcast and a 3D data globe.', links: [['Live now', '../#live'], ['Models', '../#models'], ['What-if lab', '../#whatif'], ['Ask AI', '../?ask=How%20is%20the%20world%20economy%20doing%3F']] },
    { k: 'fin', name: 'Finance & markets', on: true, href: '../finance/', icon: '◭', blurb: '61 markets and 34 rates daily since 1990, the S&P 500 since 1928, tested risk models, a portfolio lab and a 3D yield-curve terrain.', links: [['Live now', '../finance/#live'], ['Models', '../finance/#models'], ['Portfolio lab', '../finance/#whatif'], ['Ask AI', '../finance/?ask=Is%20a%20correction%20likely%3F']] },
    { k: 'comm', name: 'Commodities & scarcity', icon: '◆' }, { k: 'wx', name: 'Weather & climate', icon: '◌' }, { k: 'ag', name: 'Agriculture & food', icon: '❋' },
    { k: 'hunger', name: 'Hunger & food security', icon: '◒' }, { k: 'wealth', name: 'Wealth, poverty & inequality', icon: '◫' }, { k: 'tech', name: 'Tech & innovation', icon: '⌁' },
    { k: 'conflict', name: 'Global conflict & security', icon: '◬' }, { k: 'pulse', name: 'World Pulse', icon: '✺', blurb: 'The capstone: one risk index across every module.' }
  ];
  const saved = k => { try { const x = JSON.parse(localStorage.getItem('atlas-ins-' + k) || 'null'); return x && x.items && x.items.length ? x : null; } catch (e) { return null; } };
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
  function grid() {
    document.getElementById('hmGrid').innerHTML = MODS.map(m => m.on
      ? `<article class="hm-card on"><a class="hm-card-main" href="${m.href}"><span class="hm-ico" aria-hidden="true">${m.icon}</span><span class="hm-name">${esc(m.name)}</span><span class="hm-blurb">${esc(m.blurb)}</span></a><nav class="hm-links" aria-label="${esc(m.name)} sections">${m.links.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join('')}</nav></article>`
      : `<article class="hm-card soon" aria-disabled="true"><span class="hm-ico" aria-hidden="true">${m.icon}</span><span class="hm-name">${esc(m.name)}</span><span class="hm-soon">Coming soon</span>${m.blurb ? `<span class="hm-blurb">${esc(m.blurb)}</span>` : ''}</article>`).join('');
  }
  function readings() {
    const e = saved('econ'), f = saved('fin'), items = [];
    const push = (src, mod, href) => { if (!src) return; for (const it of src.items.slice(0, 5)) items.push(Object.assign({}, it, { mod, href, t: src.t })); };
    push(e, 'Economics', '../'); push(f, 'Finance', '../finance/');
    const box = document.getElementById('hmRead');
    if (!items.length) { box.innerHTML = `<p class="hm-empty">Open <a href="../">Economics</a> or <a href="../finance/">Finance &amp; markets</a> once and their latest readings will appear here, even offline.</p>`; return []; }
    box.innerHTML = items.map(it => `<a class="hm-r hm-${esc(it.tone || 'info')}" href="${it.href}${it.ask ? '?ask=' + encodeURIComponent(it.ask) : ''}"><span class="hm-r-top"><span class="hm-r-mod">${esc(it.mod)} · ${esc(it.tag || '')}</span><span class="hm-r-t">${esc(ago(it.t))}</span></span><span class="hm-r-txt">${esc(it.text)}</span>${it.val ? `<b class="hm-r-val">${esc(it.val)}</b>` : ''}</a>`).join('');
    return items;
  }
  function globe() {
    const el = document.getElementById('hmGlobe');
    if (!window.PX3D || !PX3D.can()) { el.classList.add('hm-noglobe'); return; }
    const bin = atob(GLOBE_GEO.land), n = bin.length / 2, land = new Float32Array(n);
    for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v > 32767) v -= 65536; land[i] = v / 100; }
    PX3D.idle(() => PX3D.mount(el, 'globe', { land, countries: [], metric: {} }, { bg: getComputedStyle(document.querySelector('.hm-hero')).getPropertyValue('--hm-band').trim() || '#0c1a22', accent: '#46c2b0', quality: 'medium', bloom: { strength: 0.5, radius: 0.4, threshold: 0.5 } }).then(c => PX3D.motionToggle(el, c)).catch(() => el.classList.add('hm-noglobe')));
  }
  function theme() {
    const b = document.getElementById('themeBtn'), root = document.documentElement;
    const dark = () => root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const paint = () => { b.textContent = dark() ? '☀ Light mode' : '☾ Dark mode'; };
    b.addEventListener('click', () => { root.dataset.theme = dark() ? 'light' : 'dark'; try { localStorage.setItem('atlas-theme', root.dataset.theme); } catch (e) { /* ignore */ } paint(); });
    paint();
  }
  function init() {
    grid(); theme();
    const items = readings();
    if (window.INS) { INS.mount({ ask: q => { location.href = '../' + (q ? '?ask=' + encodeURIComponent(q) : ''); } }); INS.set(items.length ? items.map(it => ({ id: it.mod + it.id, tag: it.mod === 'Economics' ? 'Econ · ' + it.tag : 'Markets · ' + it.tag, tone: it.tone, text: it.text, val: it.val, ask: it.ask, go: () => { location.href = it.href; } })) : [{ id: 'hello', tag: 'Atlas', tone: 'info', text: 'Open a module to see its live readings here', val: '', go: () => { location.href = '../'; } }]); }
    const note = document.getElementById('hmNote');
    note.textContent = navigator.onLine === false ? 'You are offline: modules open with the last data saved on this device.' : '';
    document.getElementById('hmMode').textContent = PAPP.standalone() ? 'Installed app' : '';
    PAPP.init({ sw: '../sw.js', scope: '/probable-atlas/', host: '#hmActs', before: document.getElementById('themeBtn'), name: 'Probable Atlas' });
    globe();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
