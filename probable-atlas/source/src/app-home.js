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
  /* ---------- extras: followed markets and countries, news, search, today's briefing ---------- */
  const has = (it, ...t) => (it.tp || []).some(x => t.includes(x));
  const DATA = window.ATLAS_DATA_BASE || '../data/';
  function following() {
    const box = document.getElementById('hmFollow'); if (!box || !window.FAV) return;
    const L = FAV.list(), ct = L.filter(f => f.key.startsWith('cty:')), mk = L.filter(f => f.key.startsWith('mkt:'));
    if (!ct.length && !mk.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<h2 class="hm-h2">Following</h2><div class="hm-chips">${ct.map(f => `<a class="hm-chip" href="../#${esc(f.key.slice(4))}"><span aria-hidden="true">★</span> ${esc(f.label)}<small>Economics</small></a>`).join('')}${mk.map(f => `<a class="hm-chip" href="../finance/?asset=${encodeURIComponent(f.key.slice(4))}"><span aria-hidden="true">★</span> ${esc(f.label)}<small>Markets</small></a>`).join('')}</div>`;
  }
  function news() {
    if (!window.NEWS) return;
    NEWS.init({
      url: [DATA + 'news.json'], embed: 'ATLAS_NEWS', title: 'News', lede: 'Economy and market headlines from official sources and major outlets, newest first.',
      topics: () => [
        { id: 'markets', label: 'Markets', test: it => has(it, 'markets', 'stocks', 'bonds', 'commodities', 'crypto', 'currency', 'earnings') },
        { id: 'economy', label: 'Economy', test: it => has(it, 'growth', 'inflation', 'jobs', 'trade', 'global') },
        { id: 'policy', label: 'Central banks', test: it => has(it, 'fed', 'policy') },
        { id: 'official', label: 'Official releases', test: it => it.k === 'official' }
      ],
      tagOf: it => it.k === 'official' ? ['Official'] : [],
      ask: q => { location.href = '../?ask=' + encodeURIComponent(q); }
    });
    NEWS.render(document.getElementById('hmNews'));
  }
  function search(items) {
    if (!window.SRCH) return;
    const src = () => {
      const out = [];
      for (const m of MODS) if (m.on) { out.push({ id: 'mod:' + m.k, kind: 'Module', title: m.name, sub: m.blurb, icon: m.icon, go: () => { location.href = m.href; } }); for (const [l, h] of m.links) out.push({ id: 'lnk:' + h, kind: 'Section', title: `${m.name}: ${l}`, icon: '▤', go: () => { location.href = h; } }); }
      if (window.FAV) for (const f of FAV.list()) out.push({ id: 'fav:' + f.key, kind: 'Following', title: f.label, sub: f.key.startsWith('cty:') ? 'Country · Economics' : 'Market · Finance', icon: '★', boost: 10, go: () => { location.href = f.key.startsWith('cty:') ? '../#' + f.key.slice(4) : '../finance/?asset=' + encodeURIComponent(f.key.slice(4)); } });
      for (const it of items) out.push({ id: 'rd:' + it.mod + it.id, kind: 'Reading', title: it.text, sub: `${it.mod} · ${it.tag || ''}`, icon: '◉', badge: it.val || '', go: () => { location.href = it.href; } });
      if (window.NEWS) NEWS.items.slice(0, 40).forEach(it => out.push({ id: 'news:' + it.u, kind: 'News', title: it.t, sub: `${it.s} · ${NEWS.ago(it.d)}`, icon: '✉', go: () => window.open(it.u, '_blank', 'noopener') }));
      out.push({ id: 'act:brief', kind: 'Action', title: "Open today's briefing", icon: '◉', go: () => STORY.open() });
      out.push({ id: 'act:theme', kind: 'Action', title: 'Switch light or dark theme', kw: 'dark mode light mode', icon: '◐', go: () => document.getElementById('themeBtn').click() });
      return out;
    };
    SRCH.mount({ key: 'atlas-home', placeholder: 'Search modules, what you follow, readings, news…', source: src, suggest: () => src().filter(x => x.kind === 'Following' || x.kind === 'Module').slice(0, 8), groups: ['Following', 'Module', 'Section', 'Reading', 'News', 'Action'], ask: q => { location.href = '../?ask=' + encodeURIComponent(q); }, host: '#hmActs', prepend: true });
  }
  function briefing(items) {
    if (!window.STORY) return;
    const TONE = t => t === 'up' ? 'up' : t === 'down' ? 'down' : t === 'warn' ? 'warn' : 'info';
    const slides = () => items.slice(0, 7).map(it => { const st = it.story || {}; return { kicker: (it.mod === 'Economics' ? 'Economics · ' : 'Markets · ') + (st.kicker || it.tag || ''), title: st.title || it.text, value: st.value != null ? st.value : it.val, sub: st.sub || '', tone: TONE(it.tone), cta: { label: 'Open ' + it.mod, go: () => { location.href = it.href; } }, ask: it.ask }; }).concat(window.NEWS && NEWS.items[0] ? [{ kicker: 'In the news · ' + NEWS.items[0].s, title: NEWS.items[0].t, sub: NEWS.ago(NEWS.items[0].d), cta: { label: 'Read the story', go: () => window.open(NEWS.items[0].u, '_blank', 'noopener') } }] : []);
    STORY.mount({ key: 'atlas-home', title: "Today's Atlas briefing", mark: 'A', label: 'Today', slides, ask: q => { location.href = '../?ask=' + encodeURIComponent(q); }, host: document.querySelector('#insBar .ins-in'), prepend: true, bg: ['#102a33', '#0a1215'] });
  }
  function init() {
    grid(); theme();
    const items = readings();
    if (window.INS) { INS.mount({ ask: q => { location.href = '../' + (q ? '?ask=' + encodeURIComponent(q) : ''); } }); INS.set(items.length ? items.map(it => ({ id: it.mod + it.id, tag: it.mod === 'Economics' ? 'Econ · ' + it.tag : 'Markets · ' + it.tag, tone: it.tone, text: it.text, val: it.val, ask: it.ask, go: () => { location.href = it.href; } })) : [{ id: 'hello', tag: 'Atlas', tone: 'info', text: 'Open a module to see its live readings here', val: '', go: () => { location.href = '../'; } }]); }
    if (window.FAV) FAV.init({ key: 'atlas-favs' });
    following(); news(); search(items); briefing(items);
    if (window.UX) { UX.key('b', "Open today's briefing", () => STORY.open()); UX.key('t', 'Switch light or dark theme', () => document.getElementById('themeBtn').click()); UX.ptr({ onRefresh: () => new Promise(r => { location.reload(); setTimeout(r, 4000); }) }); }
    const note = document.getElementById('hmNote');
    note.textContent = navigator.onLine === false ? 'You are offline: modules open with the last data saved on this device.' : '';
    document.getElementById('hmMode').textContent = PAPP.standalone() ? 'Installed app' : '';
    PAPP.init({ sw: '../sw.js', scope: '/probable-atlas/', host: '#hmActs', before: document.getElementById('themeBtn'), name: 'Probable Atlas' });
    globe();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
