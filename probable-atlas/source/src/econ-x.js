/* Probable Atlas · Economics extras: the News tab, followed countries with alerts, search everything, the daily
   briefing stories, share cards, pull to refresh, keyboard shortcuts and numbers that count up.
   Built on the shared Probable kit (kit-favs, kit-search, kit-story, kit-share, kit-news, kit-ux). */
const EX = (() => {
  const { esc } = K;
  const ok = v => v != null && isFinite(v);
  const sg = (v, d, u) => (v > 0 ? '+' : v < 0 ? '−' : '') + K.num(Math.abs(v), d) + (u || '');
  const pc = (v, d) => ok(v) ? K.num(v, d == null ? 1 : d) + '%' : '–';
  const SNAP = !!window.ATLAS_DATA;
  const ask = q => { if (typeof CH !== 'undefined') CH.open(q); };
  const ck = iso => 'cty:' + iso;
  const vshort = () => String(E.VINT || '').replace(/World Economic Outlook\s*\(([A-Za-z]+)\s+(\d{4})\)/, (m, mo, y) => 'IMF outlook, ' + mo.slice(0, 3) + ' ' + y);

  /* ---------- kit setup ---------- */
  ALERT.init({ app: 'Probable Atlas · Economics', key: 'atlas-econ', icon: 'icons/atlas-192.png' });
  FAV.init({ key: 'atlas-favs', followNote: 'It shows under Your countries on Live now, its headlines get a filter of their own, and you get alerts when it is in the news or its forecast changes.' });
  SHARE.brand({ name: 'Probable Atlas · Economics', url: 'https://bsilva87921.github.io/probable-atlas/', accent: '#5FD3C8', bg: ['#0a1215', '#0f2e33'], ink: '#eef4f4', muted: '#9fb3b6', up: '#5ea0f0', down: '#ff8a65', fd: '"IBM Plex Serif",Georgia,serif', fb: '"IBM Plex Sans",system-ui,sans-serif', fm: '"IBM Plex Mono",ui-monospace,monospace' });

  /* ---------- helpers ---------- */
  const g = iso => E.imf('NGDP_RPCH', iso, E.CY), inf = iso => E.imf('PCPIPCH', iso, E.CY);
  const unemp = iso => { const i = E.indById('unemp'); return i ? i.get(iso) : null; };
  function growthBars(iso) {   // the last eight years of growth, this year and next marked as forecasts
    const out = []; for (let y = E.CY - 6; y <= E.CY + 1; y++) { const v = E.imf('NGDP_RPCH', iso, y); if (ok(v)) out.push({ v, label: "'" + String(y).slice(2) + (y >= E.VYEAR ? '*' : '') }); }
    return out.length > 2 ? { type: 'bars', data: out, label: 'Real GDP growth by year (* IMF forecast)' } : null;
  }
  function countryCard(iso) {
    const c = E.BYISO[iso] || { name: E.name(iso), region: '' }, gv = g(iso);
    return { kicker: `${c.region ? c.region + ' · ' : ''}${vshort()}`, title: c.name, value: ok(gv) ? sg(gv, 1, '%') : '–', tone: ok(gv) && gv < 0 ? 'down' : 'up', sub: `Real GDP growth in ${E.CY} · inflation ${pc(inf(iso))} · unemployment ${pc(unemp(iso))}`, chart: growthBars(iso), url: 'https://bsilva87921.github.io/probable-atlas/#' + iso };
  }
  const tabLabel = k => (TABS.find(t => t[0] === k) || [k, k])[1];
  function goCard(patch, title) {
    return () => {
      APP.go(patch);
      setTimeout(() => {
        const h = [...document.querySelectorAll('#main h2, #main h3')].find(x => x.textContent.trim().toLowerCase().startsWith(title.toLowerCase())); if (!h) return;
        const off = (document.querySelector('.bar') || { offsetHeight: 0 }).offsetHeight + (document.getElementById('insBar') || { offsetHeight: 0 }).offsetHeight + 12;
        scrollTo({ top: h.getBoundingClientRect().top + scrollY - off, behavior: 'smooth' });
      }, 90);
    };
  }

  /* ---------- news ---------- */
  const NEWS_URL = (window.ATLAS_DATA_BASE || 'data/') + 'news.json';
  const has = (it, ...t) => (it.tp || []).some(x => t.includes(x));
  // names and demonyms, so "Japanese exports" counts as news about Japan
  const ALIAS = { USA: 'united states|u\\.s\\.|\\bus\\b|america(n)?|federal reserve|\\bfed\\b|wall street', CHN: 'china|chinese|beijing', JPN: 'japan(ese)?|tokyo|\\bboj\\b', DEU: 'german(y)?|berlin|bundesbank', GBR: 'britain|british|united kingdom|\\buk\\b|bank of england|london', FRA: 'france|french|paris', IND: 'india(n)?|\\brbi\\b', ITA: 'ital(y|ian)', BRA: 'brazil(ian)?', CAN: 'canad(a|ian)|bank of canada', RUS: 'russia(n)?|moscow|kremlin', KOR: 'south korea(n)?|\\bseoul\\b', AUS: 'australia(n)?|\\brba\\b', ESP: 'spain|spanish', MEX: 'mexic(o|an)', IDN: 'indonesia(n)?', TUR: 'turkey|turkish|türkiye', SAU: 'saudi', ARG: 'argentin(a|e|ian)', NLD: 'netherlands|dutch', CHE: 'switzerland|swiss|\\bsnb\\b', ZAF: 'south africa(n)?', NGA: 'nigeria(n)?', EGY: 'egypt(ian)?', ISR: 'israel(i)?', UKR: 'ukrain(e|ian)', POL: 'poland|polish', SWE: 'swed(en|ish)|riksbank', NOR: 'norw(ay|egian)', VNM: 'vietnam(ese)?', THA: 'thai(land)?', PHL: 'philippine(s)?|filipino', SGP: 'singapore', HKG: 'hong kong', TWN: 'taiwan(ese)?', IRN: 'iran(ian)?', PAK: 'pakistan(i)?', CHL: 'chile(an)?', COL: 'colombia(n)?', PER: 'peru(vian)?', VEN: 'venezuela(n)?', ARE: 'emirates|\\buae\\b|dubai|abu dhabi', IRL: 'ireland|irish', GRC: 'greece|greek', PRT: 'portug(al|uese)', BEL: 'belgi(um|an)', AUT: 'austria(n)?', DNK: 'denmark|danish', FIN: 'finland|finnish', NZL: 'new zealand' };
  const reFor = iso => { const a = ALIAS[iso], n = E.name(iso); const src = (a ? a + '|' : '') + (n ? n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : ''); return src ? new RegExp('(?:^|[^a-z])(?:' + src + ')', 'i') : null; };
  const RE = {}; const about = (it, iso) => { const re = RE[iso] || (RE[iso] = reFor(iso)); return !!re && re.test(it.t + ' ' + (it.x || '')); };
  const myIsos = () => FAV.list('cty:').map(f => f.key.slice(4)).filter(iso => E.BYISO[iso]);
  NEWS.init({
    url: [NEWS_URL], embed: 'ATLAS_NEWS', title: 'Economy news',
    lede: 'Growth, inflation, jobs, central banks and trade around the world, with official releases from the Federal Reserve, the ECB and BEA, newest first.',
    empty: 'Headlines are on their way: the news job refreshes about every half hour.',
    topics: () => {
      const T = [], sc = STATE.scope;
      if (sc && sc !== 'WLD' && E.BYISO[sc]) T.push({ id: 'scope', label: E.name(sc), always: true, test: it => about(it, sc) });
      const mine = myIsos(); if (mine.length) T.push({ id: 'mine', label: '★ My countries', always: true, test: it => mine.some(iso => about(it, iso)) });
      return T.concat([
        { id: 'growth', label: 'Growth & GDP', test: it => has(it, 'growth') },
        { id: 'inflation', label: 'Inflation', test: it => has(it, 'inflation') },
        { id: 'jobs', label: 'Jobs', test: it => has(it, 'jobs') },
        { id: 'policy', label: 'Central banks', test: it => has(it, 'fed', 'policy') },
        { id: 'trade', label: 'Trade', test: it => has(it, 'trade') },
        { id: 'global', label: 'World', test: it => has(it, 'global') },
        { id: 'markets', label: 'Markets', test: it => has(it, 'markets', 'stocks', 'bonds') },
        { id: 'official', label: 'Official releases', test: it => it.k === 'official' }
      ]);
    },
    tagOf: it => { const L = { fed: 'Central banks', inflation: 'Inflation', jobs: 'Jobs', growth: 'Growth', trade: 'Trade', global: 'World', stocks: 'Markets', bonds: 'Bonds', commodities: 'Commodities', currency: 'Currencies' }; const t = (it.tp || []).map(x => L[x]).filter(Boolean); return (it.k === 'official' ? ['Official'] : []).concat(t.filter((v, k, a) => a.indexOf(v) === k)).slice(0, 2); },
    ask: q => ask(q), askText: it => `What does this mean for the economy: "${it.t}" (${it.s})?`
  });

  /* ---------- country drawer: follow, share, related headlines ---------- */
  function onCountry(iso) {
    const d = document.getElementById('drawer'), dh = d && d.querySelector('.dh'); if (!dh) return;
    const name = E.name(iso), box = document.createElement('div'); box.className = 'dh-x';
    box.innerHTML = FAV.btn(ck(iso), name, 'sm') + `<button type="button" class="dh-b" data-xshare aria-label="Share ${esc(name)}" title="Share">${SHARE.ICON}</button>`;
    dh.insertBefore(box, dh.querySelector('.x') || null);
    box.addEventListener('click', ev => { if (ev.target.closest('[data-xshare]')) SHARE.share(countryCard(iso), { file: 'probable-atlas-' + iso.toLowerCase() }); });
    NEWS.load().then(() => {
      const html = NEWS.listHTML(it => about(it, iso), 4); if (!html || d.hidden) return;
      const db = d.querySelector('.db'); if (!db || db.querySelector('.dr-news')) return;
      const sec = document.createElement('section'); sec.className = 'card dr-news'; sec.innerHTML = `<div class="head"><div><h3>In the news</h3><div class="note">Recent headlines about ${esc(name)}.</div></div></div>${html}`;
      const tiles = db.querySelector('.tiles'); if (tiles && tiles.nextSibling) db.insertBefore(sec, tiles.nextSibling); else db.appendChild(sec);
    });
  }

  /* ---------- Live now additions: your countries, latest headlines ---------- */
  function yourCountries() {
    const L = myIsos();
    if (!L.length) return `<p class="fx-hint"><span aria-hidden="true">★</span> Tip: open any country (click it on the map, the globe or a table) and tap the star to follow it. Followed countries show here, lead the search and get their own news filter and alerts.</p>`;
    return `${U.sec('Your countries', `Countries you follow · IMF forecasts for ${E.CY} · tap one for its profile.`)}<div class="tiles fx-mine">${L.slice(0, 12).map(iso => `<div class="tile" data-country="${esc(iso)}" role="button" tabindex="0"><span class="lab">${esc(E.name(iso))}</span><span class="val">${esc(ok(g(iso)) ? sg(g(iso), 1, '%') : '–')}</span><span class="sub">growth · inflation ${esc(pc(inf(iso)))} · jobless ${esc(pc(unemp(iso)))}</span></div>`).join('')}</div>`;
  }
  function headlines(host, st) {
    NEWS.load().then(() => {
      if (!host.isConnected) return;
      const sc = st.scope !== 'WLD' && E.BYISO[st.scope] ? st.scope : null;
      let list = sc ? NEWS.listHTML(it => about(it, sc), 5) : '';
      const note = list ? `Headlines about ${esc(E.name(sc))}` : 'From the News tab';
      if (!list) list = NEWS.listHTML(() => true, 5, { empty: 'Headlines are on their way.' });
      host.innerHTML = U.card('Latest headlines', `${note}${NEWS.asOf ? ' · updated ' + esc(NEWS.ago(NEWS.asOf)) : ''}.`, list + `<div class="pill-row" style="margin-top:8px"><button type="button" class="btn" data-goto="news">All economy news →</button></div>`);
    });
  }
  let lastKey = null;
  function after(main, st) {
    if (st.tab === 'news') { const h = main.querySelector('#newsHost'); if (h) { h.classList.add('kx-news'); NEWS.render(h); } }
    if (st.tab === 'live') {
      const first = main.querySelector('.tiles');
      const mine = document.createElement('div'); mine.className = 'fx-mine-wrap'; mine.innerHTML = yourCountries();
      const news = document.createElement('div'); news.className = 'fx-news-mini';
      if (first) { first.after(mine); mine.after(news); } else { main.prepend(news); main.prepend(mine); }
      headlines(news, st);
    }
    const key = st.tab + '|' + st.scope;
    if (key !== lastKey) { lastKey = key; main.querySelectorAll('.tile .val').forEach(el => { if (!el.children.length) el.setAttribute('data-count', ''); }); UX.countUp(main); }
    FAV.paint();
  }

  /* ---------- search everything ---------- */
  const CARDS = [[{ tab: 'models', scope: 'WLD' }, 'The global outlook'], [{ tab: 'models', scope: 'WLD' }, 'Highest odds of contraction'], [{ tab: 'models', scope: 'WLD' }, 'Economic archetypes'], [{ tab: 'models', scope: 'WLD' }, 'Biggest breaks from trend'], [{ tab: 'models', scope: 'WLD' }, 'How accurate is the growth model?'],
    [{ tab: 'models', scope: 'USA' }, 'Will the US be in recession a year from now?'], [{ tab: 'models', scope: 'USA' }, 'What is moving the nowcast'], [{ tab: 'models', scope: 'USA' }, 'Where is inflation heading?'], [{ tab: 'models', scope: 'USA' }, 'Is monetary policy tight or loose?'],
    [{ tab: 'history', scope: 'WLD' }, 'Half a century of the world economy'], [{ tab: 'history', scope: 'WLD' }, 'Global recessions'], [{ tab: 'history', scope: 'WLD' }, 'Inflation around the world'], [{ tab: 'history', scope: 'WLD' }, 'The ten largest economies'],
    [{ tab: 'history', scope: 'USA' }, 'Rates, inflation and jobs since 1955'], [{ tab: 'history', scope: 'USA' }, 'Every recession since 1948'], [{ tab: 'history', scope: 'USA' }, 'Decade by decade'],
    [{ tab: 'indicators', scope: 'WLD' }, 'Every economy, every indicator'], [{ tab: 'indicators', scope: 'USA' }, 'United States indicators'], [{ tab: 'whatif', scope: 'USA' }, 'US macro scenario'], [{ tab: 'whatif', scope: 'WLD' }, 'Growth levers'], [{ tab: 'recs', scope: 'WLD' }, 'Where improvement pays most']];
  function countryRow(c, extra) {
    const gv = g(c.iso), fav = FAV.has(ck(c.iso));
    return Object.assign({ id: 'cty:' + c.iso, kind: 'Country', title: c.name, sub: `${c.region}${ok(inf(c.iso)) ? ' · inflation ' + pc(inf(c.iso)) : ''}${fav ? ' · ★ following' : ''}`, kw: c.iso + ' ' + (ALIAS[c.iso] || '').replace(/\\b|[\\()?|]+/g, ' ') + ' ' + (c.cap || ''), icon: fav ? '★' : '◍', badge: ok(gv) ? sg(gv, 1, '%') : '', badgeTone: ok(gv) ? (gv < 0 ? 'down' : 'up') : '', boost: (fav ? 12 : 0) + (c.top40 ? 3 : 0), go: () => APP.openCountry(c.iso) }, extra || {});
  }
  function index() {
    const out = E.COUNTRIES.map(c => countryRow(c));
    out.push({ id: 'scope:WLD', kind: 'Section', title: 'The world economy', sub: 'Switch every tab to the world view', kw: 'global world', icon: '◎', go: () => APP.go({ scope: 'WLD' }) });
    out.push({ id: 'scope:USA', kind: 'Section', title: 'The US economy', sub: 'Switch every tab to the United States', kw: 'usa united states america', icon: '◎', go: () => APP.go({ scope: 'USA' }) });
    for (const [k, l] of TABS) out.push({ id: 'tab:' + k, kind: 'Section', title: l, sub: 'Open the ' + l.toLowerCase() + ' tab', icon: '▤', go: () => APP.go({ tab: k }) });
    for (const ind of E.IND || []) out.push({ id: 'ind:' + ind.id, kind: 'Indicator', title: ind.lab, sub: `${ind.grp} · ${ind.src || ''} · every economy`, icon: '▥', go: () => APP.go({ tab: 'indicators', scope: 'WLD', indGrp: ind.grp }) });
    if (typeof VI !== 'undefined' && VI.SPEC) for (const sp of Object.values(VI.SPEC)) out.push({ id: 'us:' + sp.id, kind: 'US data', title: sp.lab, sub: `${sp.grp} · United States · FRED`, kw: sp.id, icon: '◷', go: () => APP.go({ scope: 'USA', tab: 'indicators', usSeries: sp.id }) });
    for (const [p, t] of CARDS) out.push({ id: 'card:' + t, kind: 'Chart', title: t, sub: `In ${tabLabel(p.tab)} · ${p.scope === 'USA' ? 'United States' : 'World'}`, icon: '▥', go: goCard(p, t) });
    NEWS.items.slice(0, 40).forEach(it => out.push({ id: 'news:' + it.u, kind: 'News', title: it.t, sub: `${it.s} · ${NEWS.ago(it.d)}`, icon: '✉', go: () => NEWS.open(it) }));
    out.push({ id: 'act:brief', kind: 'Action', title: "Open today's economy briefing", sub: 'The world economy in under a minute', kw: 'story stories', icon: '◉', go: () => STORY.open() });
    out.push({ id: 'act:alerts', kind: 'Action', title: ALERT.status() === 'on' ? 'Alerts are on' : 'Turn on alerts', sub: 'News and forecast changes for the countries you follow', kw: 'notifications notify', icon: '🔔', go: () => ALERT.enable() });
    out.push({ id: 'act:theme', kind: 'Action', title: 'Switch light or dark theme', kw: 'dark mode light mode', icon: '◐', go: () => { const b = document.getElementById('themeBtn'); if (b) b.click(); } });
    out.push({ id: 'act:keys', kind: 'Action', title: 'Keyboard shortcuts', kw: 'keys help', icon: '⌨', go: () => UX.help() });
    out.push({ id: 'act:fin', kind: 'Action', title: 'Open Atlas Finance', sub: 'Stocks, bonds, rates, commodities and crypto', kw: 'markets stocks', icon: '↗', go: () => { location.href = SNAP ? 'https://bsilva87921.github.io/probable-atlas/finance/' : 'finance/'; } });
    return out;
  }
  function suggest() {
    const mine = myIsos().slice(0, 4).map(iso => countryRow(E.BYISO[iso], { group: 'Your countries' }));
    const big = ['USA', 'CHN', 'DEU', 'JPN', 'IND'].filter(iso => E.BYISO[iso] && !myIsos().includes(iso)).slice(0, 3).map(iso => countryRow(E.BYISO[iso], { group: 'Largest economies' }));
    return mine.concat(big).concat([{ id: 'act:brief', kind: 'Action', group: 'Try', title: "Open today's economy briefing", icon: '◉', go: () => STORY.open() }, { id: 'tab:news', kind: 'Section', group: 'Try', title: 'Economy news', icon: '✉', go: () => APP.go({ tab: 'news' }) }]);
  }

  /* ---------- the daily briefing ---------- */
  const TONE = t => t === 'up' ? 'up' : t === 'down' ? 'down' : t === 'warn' ? 'warn' : 'info';
  const BG = { up: ['#0c2a33', '#0a1215'], down: ['#33191a', '#0a1215'], warn: ['#33270a', '#0a1215'], info: ['#0f2a2f', '#0a1215'] };
  function slides() {
    const out = [];
    myIsos().slice(0, 2).forEach(iso => { const c = countryCard(iso); out.push(Object.assign(c, { kicker: '★ Your country · ' + vshort(), cta: { label: 'Open the profile', go: () => APP.openCountry(iso) }, ask: `How is the ${E.name(iso)} economy doing?`, bg: ['#2a2108', '#0a1215'] })); });
    for (const it of INS.items || []) {
      if (out.length >= 7) break;
      const st = it.story || {}, tone = TONE(it.tone);
      out.push({ kicker: st.kicker || it.tag, title: st.title || it.text, value: st.value != null ? st.value : it.val, tone, sub: st.sub || '', chart: st.bars ? growthBars(st.bars) : null, cta: it.go ? { label: 'See it', go: it.go } : null, ask: it.ask, bg: BG[tone] });
    }
    const top = NEWS.items[0];
    if (top) out.push({ kicker: 'In the news · ' + top.s, title: top.t, sub: NEWS.ago(top.d), cta: { label: 'Read the story', go: () => NEWS.open(top) }, ask: `What does this mean for the economy: "${top.t}"?`, bg: ['#1b1036', '#0a1215'] });
    return out.slice(0, 8);
  }
  function shareInsight(it) {
    const st = it.story || {}, tone = TONE(it.tone);
    SHARE.share({ kicker: st.kicker || it.tag, title: st.title || it.text, value: st.value != null ? st.value : it.val, tone, sub: st.sub || '', chart: st.bars ? growthBars(st.bars) : null }, { file: 'probable-atlas-' + (it.id || 'insight') });
  }

  /* ---------- alerts for followed countries: forecast changes and fresh headlines ---------- */
  const FK = 'atlas-econ-fc';
  function watch() {
    if (SNAP) return;
    const L = myIsos(); if (!L.length) { BADGE.set(0); return; }
    let seen = {}; try { seen = JSON.parse(localStorage.getItem(FK) || '{}'); } catch (e) { seen = {}; }
    for (const iso of L) {
      const v = g(iso), was = seen[iso];
      if (was && ok(v) && ok(was.v) && was.vint !== E.VINT && Math.abs(v - was.v) >= 0.1) ALERT.notify({ id: `econ:${iso}:${E.VINT}`, title: `New IMF forecast for ${E.name(iso)}`, body: `Growth in ${E.CY}: ${pc(was.v)} → ${pc(v)} (${E.VINT})`, tone: v >= was.v ? 'up' : 'down', go: () => APP.openCountry(iso) });
      if (ok(v)) seen[iso] = { v, vint: E.VINT };
    }
    try { localStorage.setItem(FK, JSON.stringify(seen)); } catch (e) { /* storage unavailable */ }
    NEWS.load().then(() => {
      let n = 0;
      const fresh = NEWS.items.filter(it => Date.now() - +new Date(it.d) < 12 * 3600e3);
      for (const iso of L) {
        const it = fresh.find(x => about(x, iso)); if (!it) continue; n++;
        if (n <= 2) ALERT.notify({ id: `econ-news:${it.id || it.u}`, title: `${E.name(iso)} in the news`, body: it.t, tone: 'info', go: () => NEWS.open(it) });
      }
      BADGE.set(n);
    });
  }

  /* ---------- start ---------- */
  function init(st) {
    const scope = document.querySelector('.bar .scope');
    SRCH.mount({ key: 'atlas-econ', placeholder: 'Search countries, indicators, charts, news…', source: index, suggest, groups: ['Country', 'Section', 'Indicator', 'US data', 'Chart', 'News', 'Action'], ask, host: scope, before: scope && scope.querySelector('.askbtn') });
    const insIn = document.querySelector('#insBar .ins-in');
    STORY.mount({ key: 'atlas-econ', title: "Today's economy briefing", mark: 'A', label: 'Today', slides, ask, host: insIn, prepend: true, bg: ['#0f2a2f', '#0a1215'], sub: SNAP ? 'saved snapshot' : '' });
    UX.key('b', "Open today's economy briefing", () => STORY.open());
    UX.key('n', 'Open the news', () => APP.go({ tab: 'news' }));
    UX.key('a', 'Ask AI', () => ask(''));
    UX.key('t', 'Switch light or dark theme', () => { const b = document.getElementById('themeBtn'); if (b) b.click(); });
    UX.key('w', 'World view', () => APP.go({ scope: 'WLD' }));
    UX.key('u', 'United States view', () => APP.go({ scope: 'USA' }));
    TABS.forEach(([k, l], i) => { if (i < 9) UX.key(String(i + 1), 'Open ' + l, () => APP.go({ tab: k })); });
    UX.ptr({ onRefresh: () => new Promise(r => { location.reload(); setTimeout(r, 4000); }) });
    FAV.on(k => { if (!k.startsWith('cty:')) return; if (STATE.tab === 'live') APP.render(true); NEWS.repaint(); watch(); });
    NEWS.load().then(() => { if (st.tab === 'news') NEWS.repaint(); });
    watch();
  }
  return { init, after, onCountry, shareInsight, slides, index, watch };
})();
