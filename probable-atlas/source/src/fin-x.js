/* Probable Atlas · Finance extras: the News tab, followed markets with alerts, search everything, the daily
   briefing stories, share cards, pull to refresh, keyboard shortcuts and numbers that count up.
   Built on the shared Probable kit (kit-favs, kit-search, kit-story, kit-share, kit-news, kit-ux). */
const FINX = (() => {
  const { esc } = K;
  const ok = v => v != null && isFinite(v);
  const sg = (v, d, u) => (v > 0 ? '+' : v < 0 ? '−' : '') + K.num(Math.abs(v), d) + (u || '');
  const SNAP = !!window.ATLAS_FIN_DATA;
  const ask = q => { if (typeof CH !== 'undefined') CH.open(q); };
  const mk = id => 'mkt:' + id;

  /* ---------- kit setup ---------- */
  ALERT.init({ app: 'Probable Atlas · Finance', key: 'atlas-fin', icon: '../icons/atlas-192.png' });
  FAV.init({ key: 'atlas-favs', followNote: 'It shows under Your markets on Live now, and you get an alert when it makes a big move or a 52-week high or low.' });
  SHARE.brand({ name: 'Probable Atlas · Finance', url: 'https://bsilva87921.github.io/probable-atlas/finance/', accent: '#F2B33D', bg: ['#0a1215', '#123038'], ink: '#eef4f4', muted: '#9fb3b6', up: '#43d17a', down: '#ff7b72', fd: '"IBM Plex Serif",Georgia,serif', fb: '"IBM Plex Sans",system-ui,sans-serif', fm: '"IBM Plex Mono",ui-monospace,monospace' });

  /* ---------- helpers ---------- */
  function move(id) {   // today's move: % for prices, basis points for rates
    const s = F.ser(id), q = F.quote(id); if (!s || !q) return null;
    if (s.log) return ok(q.pct) ? { v: q.pct, txt: sg(q.pct, 2, '%'), big: Math.abs(q.pct) >= (s.cls === 'cx' ? 5 : s.cls === 'vol' ? 12 : 2), tone: q.pct > 0 ? 'up' : q.pct < 0 ? 'down' : 'flat' } : null;
    if (!ok(q.chg)) return null;
    const bp = q.chg * 100; return { v: bp, txt: sg(bp, 0, ' bp'), big: Math.abs(bp) >= 12, tone: bp > 0 ? 'up' : bp < 0 ? 'down' : 'flat' };
  }
  const level = id => { const s = F.ser(id), q = F.quote(id); return s && q ? (s.log ? F.money(id, q.last) : K.num(q.last, 2) + '%') : '–'; };
  function sparkData(id, n) { const s = F.ser(id); if (!s) return null; const d = []; for (let i = Math.max(s.s, s.e - (n || 130)); i <= s.e; i++) if (ok(s.v[i])) d.push(s.v[i]); return d.length > 2 ? d : null; }
  function allIds() { return F.GROUPS.flatMap(([g]) => F.assets(g)).filter(id => F.ser(id)); }
  const GLAB = Object.fromEntries(F.GROUPS);
  function goCard(tab, title) {
    return () => {
      APP.go({ tab });
      setTimeout(() => {
        const h = [...document.querySelectorAll('#main h2, #main h3')].find(x => x.textContent.trim().toLowerCase().startsWith(title.toLowerCase())); if (!h) return;
        const off = (document.querySelector('.bar') || { offsetHeight: 0 }).offsetHeight + (document.getElementById('insBar') || { offsetHeight: 0 }).offsetHeight + 12;
        scrollTo({ top: h.getBoundingClientRect().top + scrollY - off, behavior: 'smooth' });
      }, 90);
    };
  }
  const tabLabel = k => (TABS.find(t => t[0] === k) || [k, k])[1];
  function marketCard(id) {
    const s = F.ser(id), q = F.quote(id), m = move(id), ytd = s.log ? F.ytd(id) : F.chg(id, 252);
    return { kicker: `${F.CLS[s.cls] || 'Market'}${F.tick(id) ? ' · ' + F.tick(id) : ''} · ${K.isoLab(q.date)}`, title: F.short(id), value: m ? m.txt : level(id), tone: m ? (m.tone === 'flat' ? 'info' : m.tone) : 'info', sub: `${level(id)} · ${s.log ? (ok(ytd) ? sg(ytd, 1, '%') + ' this year' : '') : (ok(ytd) ? sg(ytd * 100, 0, ' bp') + ' in a year' : '')}`, chart: sparkData(id, 252) ? { type: 'spark', data: sparkData(id, 252), color: m && m.tone === 'down' ? '#ff7b72' : '#43d17a' } : null, url: 'https://bsilva87921.github.io/probable-atlas/finance/' };
  }

  /* ---------- news ---------- */
  const NEWS_URL = (window.ATLAS_DATA_BASE || '../data/') + 'news.json';
  const has = (it, ...t) => (it.tp || []).some(x => t.includes(x));
  // words that tie a headline to a market, for related stories and "My markets"
  const KW = { '^GSPC': /s&p|wall street|stocks?\b/i, '^IXIC': /nasdaq|tech stocks?/i, '^DJI': /\bdow\b/i, '^RUT': /russell|small[- ]caps?/i, '^VIX': /\bvix\b|volatil/i, 'DX-Y.NYB': /dollar/i, 'GC=F': /\bgold\b/i, 'SLV': /silver/i, 'CL=F': /\boil\b|crude|opec|brent/i, 'HG=F': /copper/i, 'BTC-USD': /bitcoin|crypto/i, 'ETH-USD': /ether(eum)?\b|crypto/i, '^N225': /japan|nikkei|yen\b/i, '^FTSE': /ftse|britain|\buk\b|london stocks/i, '^GDAXI': /\bdax\b|germany|german/i, '^STOXX50E': /europe|euro ?zone|stoxx/i, '^HSI': /hang seng|hong kong/i, '000001.SS': /china|chinese|shanghai/i, '^NSEI': /india|nifty|sensex/i, 'EEM': /emerging markets?/i, 'DGS10': /treasur|10-year|yields?/i, 'DGS2': /treasur|2-year|yields?/i, 'DGS3MO': /t-bills?|treasur/i, 'DFF': /fed funds|federal reserve|\bfed\b|rate (cut|hike)/i, 'TLT': /treasur|long bonds?/i, 'HYG': /junk bonds?|high[- ]yield/i, 'LQD': /corporate bonds?/i, 'VNQ': /real estate|reits?\b/i };
  const kwFor = id => KW[id] || (F.short(id).length > 3 ? new RegExp('\\b' + F.short(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i') : null);
  const about = (it, id) => { const re = kwFor(id); return !!re && re.test(it.t + ' ' + (it.x || '')); };
  const myIds = () => FAV.list('mkt:').map(f => f.key.slice(4)).filter(id => F.has(id));
  NEWS.init({
    url: [NEWS_URL], embed: 'ATLAS_NEWS', title: 'Market news',
    lede: 'Stocks, bonds and rates, the Fed, earnings, commodities, currencies and crypto, newest first.',
    empty: 'Headlines are on their way: the news job refreshes about every half hour.',
    topics: () => {
      const T = [];
      const mine = myIds(); if (mine.length) T.push({ id: 'mine', label: '★ My markets', always: true, test: it => mine.some(id => about(it, id)) });
      return T.concat([
        { id: 'markets', label: 'Markets', test: it => has(it, 'markets', 'stocks') },
        { id: 'fed', label: 'Fed & rates', test: it => has(it, 'fed', 'bonds', 'policy') },
        { id: 'earnings', label: 'Earnings', test: it => has(it, 'earnings') },
        { id: 'commodities', label: 'Commodities', test: it => has(it, 'commodities') },
        { id: 'crypto', label: 'Crypto', test: it => has(it, 'crypto') },
        { id: 'currency', label: 'Currencies', test: it => has(it, 'currency') },
        { id: 'economy', label: 'Economy', test: it => has(it, 'growth', 'inflation', 'jobs', 'trade') },
        { id: 'official', label: 'Official releases', test: it => it.k === 'official' }
      ]);
    },
    tagOf: it => { const L = { fed: 'Fed', stocks: 'Stocks', bonds: 'Bonds', earnings: 'Earnings', commodities: 'Commodities', crypto: 'Crypto', currency: 'Currencies', inflation: 'Inflation', jobs: 'Jobs', growth: 'Economy', trade: 'Trade', global: 'World' }; const t = (it.tp || []).map(x => L[x]).filter(Boolean); return (it.k === 'official' ? ['Official'] : []).concat(t.filter((v, k, a) => a.indexOf(v) === k)).slice(0, 2); },
    ask: q => ask(q), askText: it => `What does this mean for markets and investors: "${it.t}" (${it.s})?`
  });

  /* ---------- market drawer: follow, share, related headlines ---------- */
  function onAsset(id) {
    const d = document.getElementById('drawer'), dh = d && d.querySelector('.dh'); if (!dh) return;
    const box = document.createElement('div'); box.className = 'dh-x';
    box.innerHTML = FAV.btn(mk(id), F.short(id), 'sm') + `<button type="button" class="dh-b" data-xshare aria-label="Share ${esc(F.short(id))}" title="Share">${SHARE.ICON}</button>`;
    dh.insertBefore(box, dh.querySelector('.x'));
    box.addEventListener('click', ev => { if (ev.target.closest('[data-xshare]')) SHARE.share(marketCard(id), { file: 'probable-' + (F.tick(id) || 'market').toLowerCase() }); });
    NEWS.load().then(() => {
      const html = NEWS.listHTML(it => about(it, id), 4); if (!html || d.hidden) return;
      const db = d.querySelector('.db'); if (!db || db.querySelector('.dr-news')) return;
      const sec = document.createElement('section'); sec.className = 'card dr-news'; sec.innerHTML = `<div class="head"><div><h3>In the news</h3><div class="note">Recent headlines that mention ${esc(F.short(id))}.</div></div></div>${html}`;
      const tiles = db.querySelector('.tiles'); if (tiles && tiles.nextSibling) db.insertBefore(sec, tiles.nextSibling); else db.appendChild(sec);
    });
  }

  /* ---------- Live now additions: your markets, latest headlines ---------- */
  function yourMarkets() {
    const ids = myIds();
    if (!ids.length) return `<p class="fx-hint"><span aria-hidden="true">★</span> Tip: open any market and tap the star to follow it. Followed markets show here, lead the search and trigger alerts on big moves.</p>`;
    return `${U.sec('Your markets', 'Markets you follow · tap one for its chart, or its star to unfollow.')}<div class="tiles fx-mine">${ids.slice(0, 12).map(id => { const m = move(id); return U.tile({ asset: id, lab: F.short(id), val: esc(level(id)), sub: m ? U.upDown(m.v, m.txt.includes('bp') ? 0 : 2, m.txt.includes('bp') ? ' bp' : '%') + ' today' : '', spark: FV.sparkFor ? FV.sparkFor(id) : '' }); }).join('')}</div>`;
  }
  function headlines(host) {
    NEWS.load().then(() => {
      if (!host.isConnected) return;
      const list = NEWS.listHTML(() => true, 5, { empty: 'Headlines are on their way.' });
      host.innerHTML = U.card('Latest headlines', `From the News tab${NEWS.asOf ? ' · updated ' + esc(NEWS.ago(NEWS.asOf)) : ''}.`, list + `<div class="pill-row" style="margin-top:8px"><button type="button" class="btn" data-goto="news">All market news →</button></div>`);
    });
  }
  let lastTab = null;
  function after(main, st, keepScroll) {
    if (st.tab === 'news') { const h = main.querySelector('#newsHost'); if (h) { h.classList.add('kx-news'); NEWS.render(h); } }
    if (st.tab === 'live') {
      const read = main.querySelector('.read');
      const mine = document.createElement('div'); mine.className = 'fx-mine-wrap'; mine.innerHTML = yourMarkets();
      const news = document.createElement('div'); news.className = 'fx-news-mini';
      if (read) { read.after(mine); mine.after(news); } else { main.prepend(news); main.prepend(mine); }
      C.mount(mine); headlines(news);
    }
    // numbers count up when a tab first opens (not on every small re-render)
    if (st.tab !== lastTab) { lastTab = st.tab; main.querySelectorAll('.tile .val').forEach(el => { if (!el.children.length) el.setAttribute('data-count', ''); }); UX.countUp(main); }
    FAV.paint();
  }

  /* ---------- search everything ---------- */
  const CARDS = [['markets', 'Market explorer'], ['markets', 'Yield curve time machine'], ['markets', 'Is the curve inverted?'], ['markets', 'Credit spreads'], ['markets', 'Real yields and expected inflation'], ['markets', 'Correlations'], ['markets', 'Seasonality'], ['markets', 'Every market, side by side'],
    ['models', 'Market regimes'], ['models', 'Correction and bear-market risk'], ['models', 'Volatility and value-at-risk'], ['models', 'Risk appetite gauge'], ['models', 'Long-run expected returns'], ['models', 'Sector rotation map'], ['models', 'Trend following'],
    ['whatif', 'Project your plan'], ['whatif', 'Shock scenarios'], ['whatif', 'Stress test: past sell-offs'], ['whatif', 'Risk and return map'], ['whatif', 'Where the risk comes from'], ['recs', 'A starting mix for this profile'],
    ['history', 'S&P 500 since 1928'], ['history', 'Asset-class returns by year, best to worst'], ['history', 'Every month since 1926'], ['history', 'The biggest days'], ['history', 'Time in the market narrows the range'], ['history', 'Factor premiums since 1963'], ['history', 'Declines inside the year are normal'],
    ['live', 'Signals'], ['live', 'Cross-asset scoreboard'], ['live', 'US sectors'], ['live', 'World markets'], ['live', 'Treasury yield curve'], ['live', 'Biggest movers today'], ['how', 'Methods'], ['how', 'Validation at a glance'], ['how', 'Limits and glossary']];
  function marketRow(id, extra) {
    const s = F.ser(id), m = move(id), fav = FAV.has(mk(id));
    return Object.assign({ id: 'mkt:' + id, kind: 'Market', title: F.label(id), sub: `${GLAB[s.grp] || F.CLS[s.cls] || 'Market'} · ${level(id)}${fav ? ' · ★ following' : ''}`, kw: `${F.tick(id)} ${s.name} ${F.CLS[s.cls] || ''}`, icon: fav ? '★' : s.log ? '◆' : '%', badge: m ? m.txt : '', badgeTone: m ? m.tone : '', boost: fav ? 12 : 0, go: () => FV.openAsset(id) }, extra || {});
  }
  function index() {
    const out = allIds().map(id => marketRow(id));
    for (const [k, l] of TABS) out.push({ id: 'tab:' + k, kind: 'Section', title: l, sub: 'Open the ' + l.toLowerCase() + ' tab', icon: '▤', go: () => APP.go({ tab: k }) });
    for (const [k, t] of CARDS) out.push({ id: 'card:' + t, kind: 'Chart', title: t, sub: 'In ' + tabLabel(k), icon: '▥', go: goCard(k, t) });
    NEWS.items.slice(0, 40).forEach(it => out.push({ id: 'news:' + it.u, kind: 'News', title: it.t, sub: `${it.s} · ${NEWS.ago(it.d)}`, icon: '✉', go: () => window.open(it.u, '_blank', 'noopener') }));
    out.push({ id: 'act:brief', kind: 'Action', title: "Open today's market briefing", sub: 'The day in markets in under a minute', kw: 'story stories', icon: '◉', go: () => STORY.open() });
    out.push({ id: 'act:alerts', kind: 'Action', title: ALERT.status() === 'on' ? 'Alerts are on' : 'Turn on alerts', sub: 'Big moves and 52-week highs or lows in the markets you follow', kw: 'notifications notify', icon: '🔔', go: () => ALERT.enable() });
    out.push({ id: 'act:theme', kind: 'Action', title: 'Switch light or dark theme', kw: 'dark mode light mode', icon: '◐', go: () => { const b = document.getElementById('themeBtn'); if (b) b.click(); } });
    out.push({ id: 'act:keys', kind: 'Action', title: 'Keyboard shortcuts', kw: 'keys help', icon: '⌨', go: () => UX.help() });
    out.push({ id: 'act:econ', kind: 'Action', title: 'Open Atlas Economics', sub: 'The world economy: growth, inflation, jobs and forecasts', kw: 'gdp countries', icon: '↗', go: () => { location.href = SNAP ? 'https://bsilva87921.github.io/probable-atlas/' : '../'; } });
    return out;
  }
  function suggest() {
    const mine = myIds().slice(0, 4).map(id => marketRow(id, { group: 'Your markets' }));
    const movers = allIds().filter(id => F.ser(id).log && F.ser(id).cls !== 'vol').map(id => ({ id, m: move(id) })).filter(x => x.m).sort((a, b) => Math.abs(b.m.v) - Math.abs(a.m.v)).slice(0, 3).map(x => marketRow(x.id, { group: 'Moving most today' }));
    return mine.concat(movers).concat([{ id: 'act:brief', kind: 'Action', group: 'Try', title: "Open today's market briefing", icon: '◉', go: () => STORY.open() }, { id: 'tab:news', kind: 'Section', group: 'Try', title: 'Market news', icon: '✉', go: () => APP.go({ tab: 'news' }) }]);
  }

  /* ---------- the daily briefing ---------- */
  const TONE = t => t === 'up' ? 'up' : t === 'down' ? 'down' : t === 'warn' ? 'warn' : 'info';
  const BG = { up: ['#0d2b22', '#0a1215'], down: ['#33141a', '#0a1215'], warn: ['#33270a', '#0a1215'], info: ['#102a33', '#0a1215'] };
  function slides() {
    const out = [];
    myIds().slice(0, 2).forEach(id => { const c = marketCard(id); out.push(Object.assign(c, { kicker: '★ Your market · ' + K.isoLab(F.quote(id).date), cta: { label: 'Open the chart', go: () => FV.openAsset(id) }, ask: `How is ${F.short(id)} doing, and what are the risks?`, bg: ['#2a2108', '#0a1215'] })); });
    for (const it of INS.items || []) {
      if (out.length >= 7) break;
      const st = it.story || {}, tone = TONE(it.tone), data = st.spark ? sparkData(st.spark, 130) : null;
      out.push({ kicker: st.kicker || it.tag, title: st.title || it.text, value: st.value != null ? st.value : it.val, tone, sub: st.sub || '', chart: data ? { type: 'spark', data, color: tone === 'down' ? '#ff7b72' : tone === 'warn' ? '#F2B33D' : '#43d17a', label: F.short(st.spark) + ', last six months' } : null, cta: it.go ? { label: 'See it', go: it.go } : null, ask: it.ask, bg: BG[tone] });
    }
    const top = NEWS.items[0];
    if (top) out.push({ kicker: 'In the news · ' + top.s, title: top.t, sub: NEWS.ago(top.d), cta: { label: 'Read the story', go: () => window.open(top.u, '_blank', 'noopener') }, ask: `What does this mean for markets: "${top.t}"?`, bg: ['#1b1036', '#0a1215'] });
    return out.slice(0, 8);
  }
  function shareInsight(it) {
    const st = it.story || {}, data = st.spark ? sparkData(st.spark, 130) : null, tone = TONE(it.tone);
    SHARE.share({ kicker: st.kicker || it.tag, title: st.title || it.text, value: st.value != null ? st.value : it.val, tone, sub: st.sub || '', chart: data ? { type: 'spark', data, color: tone === 'down' ? '#ff7b72' : '#43d17a' } : null }, { file: 'probable-atlas-' + (it.id || 'insight') });
  }

  /* ---------- alerts for followed markets ---------- */
  function watch() {
    if (SNAP) return;
    let n = 0;
    for (const id of myIds()) {
      const m = move(id), q = F.quote(id), s = F.ser(id); if (!m || !q) continue;
      if (m.big) { n++; ALERT.notify({ id: `fin:${id}:${q.date}:move`, title: `${F.short(id)} ${m.txt} on ${K.isoLab(q.date)}`, body: `Last ${level(id)} · a big move for this market`, tone: m.tone === 'down' ? 'down' : 'up', go: () => FV.openAsset(id) }); }
      if (s.log && F.hi52) {
        const h = F.hi52(id), last = s.v[s.e];
        if (h && ok(h.hi) && last >= h.hi) ALERT.notify({ id: `fin:${id}:${q.date}:hi`, title: `${F.short(id)} at a 52-week high`, body: `Last ${level(id)} · ${m.txt} on the day`, tone: 'up', go: () => FV.openAsset(id) });
        else if (h && ok(h.lo) && last <= h.lo) ALERT.notify({ id: `fin:${id}:${q.date}:lo`, title: `${F.short(id)} at a 52-week low`, body: `Last ${level(id)} · ${m.txt} on the day`, tone: 'down', go: () => FV.openAsset(id) });
      }
    }
    BADGE.set(n);
  }

  /* ---------- start ---------- */
  function init(st) {
    // search sits next to the market picker; the briefing ring leads the Insights bar
    const scope = document.querySelector('.bar .scope');
    SRCH.mount({ key: 'atlas-fin', placeholder: 'Search markets, rates, charts, news…', source: index, suggest, groups: ['Market', 'Section', 'Chart', 'News', 'Action'], ask, host: scope, before: scope && scope.querySelector('.askbtn') });
    const insIn = document.querySelector('#insBar .ins-in');
    STORY.mount({ key: 'atlas-fin', title: "Today's market briefing", mark: 'A', label: 'Today', slides, ask, host: insIn, prepend: true, bg: ['#102a33', '#0a1215'], sub: SNAP ? 'saved snapshot' : '' });
    UX.key('b', "Open today's market briefing", () => STORY.open());
    UX.key('n', 'Open the news', () => APP.go({ tab: 'news' }));
    UX.key('a', 'Ask AI', () => ask(''));
    UX.key('t', 'Switch light or dark theme', () => { const b = document.getElementById('themeBtn'); if (b) b.click(); });
    TABS.forEach(([k, l], i) => { if (i < 9) UX.key(String(i + 1), 'Open ' + l, () => APP.go({ tab: k })); });
    UX.ptr({ onRefresh: () => new Promise(r => { location.reload(); setTimeout(r, 4000); }) });
    FAV.on(k => { if (!k.startsWith('mkt:')) return; if (STATE.tab === 'live') APP.render(true); NEWS.repaint(); watch(); });
    NEWS.load().then(() => { if (st.tab === 'news') NEWS.repaint(); });
    watch();
    // deep link from the app home or a shared card: ?asset=GC%3DF opens that market
    try { const a = new URLSearchParams(location.search).get('asset'); if (a && F.has(a)) setTimeout(() => FV.openAsset(a), 350); } catch (e) { /* ignore */ }
  }
  return { init, after, onAsset, shareInsight, slides, index, watch };
})();
