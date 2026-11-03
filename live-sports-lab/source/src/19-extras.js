/* ==========================================================================
   Probable — Sports Lab extras: the News tab, followed teams with alerts,
   search everything, the daily briefing stories, share cards, a pop-out
   live score window, pull to refresh, keyboard shortcuts and the app badge.
   Built on the shared Probable kit (kit-favs, kit-search, kit-story,
   kit-share, kit-news, kit-ux).
   ========================================================================== */
(function () {
  'use strict';
  const APP = window.APP, S = APP.S, LG = APP.LG, esc = APP.esc;
  const pc = p => Math.round(p * 100) + '%';
  const SNAP = () => S.mode === 'snapshot';
  const nowRef = () => SNAP() && S.capturedAt ? +new Date(S.capturedAt) : Date.now();
  const lgName = lg => (LG[lg] && (LG[lg].short || LG[lg].name)) || lg;
  const ask = q => { if (window.CH) window.CH.open(q); };

  /* ---------- kit setup ---------- */
  ALERT.init({ app: 'Probable Sports Lab', key: 'probable-sports', icon: 'icons/sports-192.png' });
  FAV.init({ key: 'probable-sports-favs', followNote: 'Their games lead the board, and you get alerts when they start, go down to the wire and finish.' });
  SHARE.brand({ name: 'Probable · Sports Lab', url: 'https://bsilva87921.github.io/live-sports-lab/', accent: '#FFB547', bg: ['#060b15', '#16284a'], fd: '"Big Shoulders Display","Arial Narrow",system-ui,sans-serif', fb: '"Barlow",system-ui,sans-serif', fm: '"JetBrains Mono",ui-monospace,monospace' });
  const tkey = (lg, t) => 'team:' + lg + ':' + (t && t.abbr);
  APP.favs = { game: g => !!g && (FAV.has(tkey(g.lg, g.home)) || FAV.has(tkey(g.lg, g.away))), team: (lg, t) => FAV.has(tkey(lg, t)), key: tkey };
  FAV.on(() => { APP.renderAll(); if (APP.arena) APP.arena.refresh(); });

  /* ---------- helpers ---------- */
  function split(g) {
    const P = APP.predict(g), R = g.state === 'in' ? P.now : P.pre;
    const pD = R.pD || 0, pH = R.pH, pA = R.pA != null ? R.pA : 1 - pH - pD;
    return { type: 'split', a: { label: g.away.abbr, p: pA, color: APP.teamColor(g.lg, g.away) }, d: pD > 0.001 ? { label: 'Draw', p: pD, color: '#7d8798' } : null, h: { label: g.home.abbr, p: pH, color: APP.teamColor(g.lg, g.home) } };
  }
  function lead(g) { const c = split(g); const top = c.h.p >= c.a.p ? c.h : c.a; return { abbr: top.label, p: top.p }; }
  const status = g => g.state === 'in' ? (SNAP() ? 'At capture · ' : '') + (g.detail || 'Live') : g.state === 'pre' ? APP.when(g.start) : 'Final';
  const score = g => g.state === 'pre' ? '' : `${g.away.abbr} ${g.away.score ?? 0}–${g.home.score ?? 0} ${g.home.abbr}`;
  function teamList() {
    const m = new Map();
    const add = (lg, t) => { if (!t || !t.abbr) return; const k = lg + '|' + t.abbr, o = m.get(k) || { lg, abbr: t.abbr, name: t.name || t.abbr, color: t.color, record: t.record || '' }; if (t.name && t.name.length > o.name.length) o.name = t.name; if (t.color && !o.color) o.color = t.color; if (t.record) o.record = t.record; m.set(k, o); };
    for (const l of APP.LEAGUES) { const D = S.data[l.id]; if (!D) continue; for (const r of D.standings || []) add(l.id, { abbr: r.abbr || r.key, name: r.name, color: r.color }); for (const g of D.games || []) { add(l.id, g.home); add(l.id, g.away); } }
    return [...m.values()];
  }
  function gameFor(lg, abbr) {
    const gs = ((S.data[lg] || {}).games || []).filter(g => !g.void && (g.home.abbr === abbr || g.away.abbr === abbr)), t = g => +new Date(g.start);
    return gs.find(g => g.state === 'in') || gs.filter(g => g.state === 'pre').sort((a, b) => t(a) - t(b))[0] || gs.filter(g => g.state === 'post').sort((a, b) => t(b) - t(a))[0] || null;
  }
  function gameCard(g) {
    const L = lead(g);
    return { kicker: `${lgName(g.lg)} · ${status(g)}`, title: `${g.away.name} at ${g.home.name}`, value: pc(L.p), tone: g.state === 'in' ? 'warn' : 'info', sub: (score(g) ? score(g) + ' · ' : '') + `${L.abbr} chance to win${g.state === 'post' ? ' before the game' : g.state === 'in' ? ' right now' : ''}`, chart: split(g) };
  }

  /* ---------- news ---------- */
  const NEWS_URL = window.SPORTS_NEWS_URL || 'data/news.json';
  const NAMES = { tennis: 'Tennis', golf: 'Golf', ufc: 'UFC' };
  const FANTASY = /\bfantasy\b/i;   // fantasy-league advice is not news about the games
  async function liveNews() {
    if (SNAP() || !navigator.onLine) return [];
    const L = APP.LEAGUES.map(l => [l.id, l.path, l.short || l.name]).concat([['tennis', 'tennis/atp', 'Tennis'], ['golf', 'golf/pga', 'Golf'], ['ufc', 'mma/ufc', 'UFC']]);
    const res = await Promise.allSettled(L.map(async ([lg, path, label]) => {
      const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/news?limit=12`); if (!r.ok) return [];
      const j = await r.json();
      return (j.articles || []).map(a => {
        const u = ((a.links || {}).web || {}).href, ims = (a.images || []).filter(i => i && i.url);
        return u && a.headline ? { id: u, t: a.headline, u, s: 'ESPN', d: a.published || a.lastModified, x: a.description || '', img: (ims.find(i => (i.width || 0) >= 400) || ims[0] || {}).url || null, lg, lgName: label, tm: (a.categories || []).filter(c => c.type === 'team' && c.description).map(c => c.description).slice(0, 4), tp: [lg] } : null;
      }).filter(it => it && !FANTASY.test(it.t + ' ' + it.x)).map(it => (it.x.trim().toLowerCase() === it.t.trim().toLowerCase() ? Object.assign(it, { x: '' }) : it));
    }));
    return res.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  }
  const followedNames = () => FAV.list('team:').map(f => (f.label || '').toLowerCase()).filter(Boolean);
  const aboutFollowed = it => { const ns = followedNames(); if (!ns.length) return false; const tx = ((it.tm || []).join(' ') + ' ' + it.t).toLowerCase(); return ns.some(n => tx.includes(n) || tx.includes(n.split(' ').pop())); };
  NEWS.init({
    url: [NEWS_URL], embed: 'SPORTS_NEWS', title: 'Sports news', lede: 'The latest from every league on the board, newest first.', live: liveNews,
    empty: SNAP() ? 'This saved copy has no news feed. The live site shows the latest headlines from every league.' : undefined,
    // one chip per league, in the board's order and with the board's names, whatever source a story came from
    topics: () => { const have = new Set(NEWS.items.map(i => i.lg)), order = APP.LEAGUES.map(l => l.id).concat(['tennis', 'golf', 'ufc']), T = []; if (FAV.count('team:')) T.push({ id: 'mine', label: '★ My teams', test: aboutFollowed, always: true }); return T.concat(order.filter(lg => have.has(lg)).map(lg => ({ id: lg, label: NAMES[lg] || lgName(lg), test: it => it.lg === lg }))); },
    tagOf: it => [NAMES[it.lg] || lgName(it.lg)].filter(Boolean),
    ask: q => ask(q), askText: it => `What does this mean for ${(it.tm && it.tm[0]) || it.lgName || 'the team'}? "${it.t}"`
  });
  APP.renderNews = el => { el.classList.add('kx-news'); NEWS.render(el); };
  NEWS.load();

  /* ---------- the game center: follow, share, pop out, related headlines ---------- */
  let pipCtl = null;
  function miniHTML(id) {
    const g = APP.findGame(id); if (!g) return '<p>Game not found.</p>';
    const c = split(g), row = (t, p) => `<div style="display:flex;align-items:center;gap:10px;margin:6px 0"><span style="min-width:46px;height:28px;border-radius:7px;display:inline-grid;place-items:center;background:${esc(APP.teamColor(g.lg, t))};color:${esc(APP.textOn(APP.teamColor(g.lg, t)))};font:800 14px/1 var(--f-display)">${esc(t.abbr)}</span><b style="flex:1;font:600 15px var(--f-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.name)}</b><b style="font:900 30px/1 var(--f-display)">${g.state === 'pre' ? '' : esc(t.score ?? 0)}</b><span style="min-width:44px;text-align:right;font:700 13px var(--f-mono);color:var(--muted)">${pc(p)}</span></div>`;
    return `<div style="font:700 11px/1 var(--f-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--accent-ink)">${esc(lgName(g.lg))} · ${esc(status(g))}</div>${row(g.away, c.a.p)}${row(g.home, c.h.p)}<div style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin-top:6px"><i style="flex:${c.a.p};background:${esc(c.a.color)}"></i>${c.d ? `<i style="flex:${c.d.p};background:#7d8798"></i>` : ''}<i style="flex:${c.h.p};background:${esc(c.h.color)}"></i></div>`;
  }
  APP.onDrawer = APP.onDrawer || [];
  APP.onDrawer.push((g, el) => {
    const head = el.querySelector('.dr-head'); if (!head) return;
    const box = document.createElement('span'); box.className = 'dr-x';
    box.innerHTML = FAV.btn(tkey(g.lg, g.away), g.away.name, 'sm', null).replace('</button>', `<span class="fav-ab">${esc(g.away.abbr)}</span></button>`) + FAV.btn(tkey(g.lg, g.home), g.home.name, 'sm', null).replace('</button>', `<span class="fav-ab">${esc(g.home.abbr)}</span></button>`) +
      `<button type="button" class="icon-btn" data-dshare aria-label="Share this game">${SHARE.ICON}<span class="lbl">Share</span></button>` + (UX.pipOK() && g.state !== 'post' && !SNAP() ? `<button type="button" class="icon-btn" data-dpip aria-label="Pop out a live score window">⧉<span class="lbl">Pop out</span></button>` : '');
    head.insertBefore(box, head.querySelector('[data-close]'));
    box.addEventListener('click', async ev => {
      if (ev.target.closest('[data-dshare]')) SHARE.share(gameCard(APP.findGame(g.id) || g), { file: 'probable-' + g.away.abbr + '-' + g.home.abbr });
      if (ev.target.closest('[data-dpip]')) { try { if (pipCtl) pipCtl.close(); pipCtl = await UX.pip({ title: `${g.away.abbr} at ${g.home.abbr}`, width: 360, height: 170, render: () => miniHTML(g.id), every: 4000 }); } catch (e) { ALERT.toast({ title: 'Pop-out is not available here' }); } }
    });
    // related headlines for the two teams, under the board
    const names = [g.home.name, g.away.name].map(n => (n || '').toLowerCase()), short = names.map(n => n.split(' ').pop());
    const rel = it => it.lg === g.lg && ((it.tm || []).some(t => names.includes(t.toLowerCase())) || short.some(s => s.length > 3 && (it.t || '').toLowerCase().includes(s)));
    NEWS.load().then(() => {
      const html = NEWS.listHTML(rel, 4); if (!html) return;
      const host = el.querySelector('.dr-body'); if (!host || host.querySelector('.dr-news')) return;
      const sec = document.createElement('div'); sec.className = 'panel panel-pad dr-news'; sec.innerHTML = `<span class="eyebrow">In the news</span>${html}`;
      const after = host.querySelector('#dr-probs'); if (after && after.nextSibling) host.insertBefore(sec, after.nextSibling); else host.appendChild(sec);
    });
  });

  /* ---------- search everything ---------- */
  const TABS = [['board', 'Live board', '▦'], ['stats', 'Stats center', '▤'], ['lab', 'Hypothesis lab', '⚗'], ['standings', 'Standings & projections', '☰'], ['news', 'News', '✉'], ['method', 'How it works and track record', '?']];
  function index() {
    const out = [], now = nowRef();
    for (const t of teamList()) {
      const g = gameFor(t.lg, t.abbr), live = g && g.state === 'in', fav = FAV.has(tkey(t.lg, t));
      out.push({ id: 'team:' + t.lg + ':' + t.abbr, kind: 'Team', title: t.name, sub: `${lgName(t.lg)}${t.record ? ' · ' + t.record : ''}${g ? ' · ' + (g.state === 'in' ? 'playing now' : g.state === 'pre' ? 'next: ' + APP.when(g.start) : 'last: ' + score(g)) : ''}${fav ? ' · ★ following' : ''}`, kw: t.abbr + ' ' + lgName(t.lg), iconHTML: APP.badge(t.lg, t), badge: live ? 'LIVE' : '', boost: (fav ? 14 : 0) + (live ? 6 : 0), go: () => { if (g) APP.openGame(g.id); else { S.league = t.lg; APP.setTab('standings'); } } });
    }
    for (const g of APP.allGames().filter(x => !x.void && Math.abs(+new Date(x.start) - now) < 36 * 3600e3)) {
      out.push({ id: 'game:' + g.id, kind: 'Game', title: `${g.away.name} at ${g.home.name}`, sub: `${lgName(g.lg)} · ${status(g)}${score(g) ? ' · ' + score(g) : ''}`, kw: g.away.abbr + ' ' + g.home.abbr + ' vs', icon: g.state === 'in' ? '●' : '◷', badge: g.state === 'in' ? 'LIVE' : '', boost: g.state === 'in' ? 4 : 0, go: () => APP.openGame(g.id) });
    }
    for (const l of APP.LEAGUES) out.push({ id: 'lg:' + l.id, kind: 'League', title: l.long || l.name, sub: 'Show only this league on the board', kw: l.short || '', icon: '◎', go: () => { S.league = l.id; APP.setTab('board'); } });
    for (const [id, title, icon] of TABS) out.push({ id: 'tab:' + id, kind: 'Section', title, sub: 'Open the ' + title.toLowerCase(), icon, go: () => APP.setTab(id) });
    NEWS.items.slice(0, 60).forEach(it => out.push({ id: 'news:' + it.u, kind: 'News', title: it.t, sub: `${it.s} · ${it.lgName || ''} · ${NEWS.ago(it.d)}`, icon: '✉', kw: (it.tm || []).join(' '), go: () => window.open(it.u, '_blank', 'noopener') }));
    out.push({ id: 'act:brief', kind: 'Action', title: "Open today's briefing", sub: 'Five stories in under a minute', icon: '◉', go: () => STORY.open() });
    out.push({ id: 'act:alerts', kind: 'Action', title: ALERT.status() === 'on' ? 'Alerts are on' : 'Turn on alerts for your teams', sub: 'Starts, nail-biters and finals', icon: '🔔', go: () => ALERT.enable() });
    out.push({ id: 'act:theme', kind: 'Action', title: 'Switch light or dark theme', icon: '◐', go: () => { const b = document.getElementById('btn-theme'); if (b) b.click(); } });
    if (!SNAP()) out.push({ id: 'act:refresh', kind: 'Action', title: 'Refresh the scores now', icon: '↻', go: () => { const b = document.getElementById('btn-refresh'); if (b) b.click(); } });
    out.push({ id: 'act:keys', kind: 'Action', title: 'Keyboard shortcuts', icon: '⌨', go: () => UX.help() });
    return out;
  }
  function suggest() {
    const live = APP.allGames().filter(g => g.state === 'in').slice(0, 4).map(g => ({ id: 'game:' + g.id, kind: 'Game', group: 'Live now', title: `${g.away.name} at ${g.home.name}`, sub: `${lgName(g.lg)} · ${status(g)} · ${score(g)}`, icon: '●', badge: 'LIVE', go: () => APP.openGame(g.id) }));
    const mine = FAV.list('team:').slice(0, 5).map(f => { const [, lg, abbr] = f.key.split(':'), g = gameFor(lg, abbr); return { id: f.key, kind: 'Team', group: 'Your teams', title: f.label, sub: g ? `${lgName(lg)} · ${g.state === 'in' ? 'playing now' : g.state === 'pre' ? 'next: ' + APP.when(g.start) : 'last: ' + score(g)}` : lgName(lg), icon: '★', go: () => { if (g) APP.openGame(g.id); } }; });
    return mine.concat(live).concat([{ id: 'act:brief', kind: 'Action', group: 'Try', title: "Open today's briefing", icon: '◉', go: () => STORY.open() }, { id: 'tab:news', kind: 'Section', group: 'Try', title: 'Sports news', icon: '✉', go: () => APP.setTab('news') }]);
  }

  /* ---------- the daily briefing ---------- */
  function slides() {
    const out = [], ins = (APP.insights && APP.insights.list()) || [];
    const gid = it => { const m = /^(close|next|fav|upset|gap|swing)-(.+)$/.exec(it.id || ''); return m ? APP.findGame(m[2]) : null; };
    const mine = FAV.list('team:').map(f => { const [, lg, abbr] = f.key.split(':'); return gameFor(lg, abbr); }).filter(Boolean);
    const seen = new Set();
    mine.slice(0, 2).forEach(g => { if (seen.has(g.id)) return; seen.add(g.id); const c = gameCard(g); out.push(Object.assign(c, { kicker: '★ Your team · ' + c.kicker, cta: { label: 'Open the game', go: () => APP.openGame(g.id) }, ask: `How is ${g.away.name} at ${g.home.name} going?`, bg: ['#2a1d06', '#0b1220'] })); });
    for (const it of ins) {
      if (out.length >= 7) break;
      const g = gid(it); if (g && seen.has(g.id)) continue; if (g) seen.add(g.id);
      const st = it.story || {};
      out.push({ kicker: st.kicker || it.tag, title: st.title || it.text.replace(/\s+—\s+/g, ' · '), value: st.value != null ? st.value : (it.val || (g ? pc(lead(g).p) : '')), tone: it.tone === 'live' ? 'warn' : it.tone === 'down' ? 'down' : it.tone === 'up' ? 'up' : 'info', sub: st.sub || (g ? [score(g), status(g)].filter(Boolean).join(' · ') : ''), chart: g ? split(g) : null, cta: it.go ? { label: g ? 'Open the game' : 'See it', go: it.go } : null, ask: it.ask, bg: it.tone === 'live' ? ['#3a0f17', '#0b1220'] : it.tone === 'warn' ? ['#3a2a06', '#0b1220'] : ['#13223d', '#0a1120'] });
    }
    const top = NEWS.items[0];
    if (top) out.push({ kicker: 'In the news · ' + (top.lgName || top.s), title: top.t, sub: `${top.s} · ${NEWS.ago(top.d)}`, cta: { label: 'Read the story', go: () => window.open(top.u, '_blank', 'noopener') }, ask: `What does this mean? "${top.t}"`, bg: ['#1b1036', '#0a1120'] });
    return out.slice(0, 8);
  }

  /* ---------- alerts for followed teams ---------- */
  const prev = new Map();
  function watch() {
    if (S.mode === 'loading') return;
    let liveMine = 0;
    for (const g of APP.allGames()) {
      if (!APP.favs.game(g) || g.void) continue;
      const mine = FAV.has(tkey(g.lg, g.home)) ? 'home' : 'away', them = mine === 'home' ? 'away' : 'home';
      const P = APP.predict(g), R = g.state === 'in' ? P.now : P.pre, pMine = mine === 'home' ? R.pH : (R.pA != null ? R.pA : 1 - R.pH - (R.pD || 0));
      const was = prev.get(g.id), t = g[mine], o = g[them];
      const go = () => APP.openGame(g.id), title0 = `${g.away.abbr} at ${g.home.abbr}`;
      if (g.state === 'in') liveMine++;
      if (SNAP()) { prev.set(g.id, { state: g.state }); continue; }
      if (g.state === 'in' && (!was || was.state === 'pre')) ALERT.notify({ id: `sp:${g.id}:start`, title: `${t.name} are on now`, body: `${title0} · ${g.detail || 'Live'} · ${pc(pMine)} to win`, go, tone: 'live' });
      if (g.state === 'in') {
        const late = (g.period || 0) >= ({ fb: 4, bk: 4, hk: 3, bb: 8, sc: 2 }[APP.kindOf(g.lg)] || 4);
        if (late && pMine > 0.3 && pMine < 0.7) ALERT.notify({ id: `sp:${g.id}:close`, title: `Down to the wire: ${score(g)}`, body: `${g.detail || ''} · ${t.abbr} ${pc(pMine)} to win`, go, tone: 'warn' });
        const leader = (t.score ?? 0) > (o.score ?? 0) ? 'us' : (t.score ?? 0) < (o.score ?? 0) ? 'them' : 'tie';
        if (was && was.leader && was.leader !== leader && leader !== 'tie' && late) ALERT.notify({ id: `sp:${g.id}:lead:${leader}:${g.period}`, title: leader === 'us' ? `${t.abbr} take the lead` : `${o.abbr} go ahead`, body: `${score(g)} · ${g.detail || ''}`, go, tone: leader === 'us' ? 'up' : 'down' });
        prev.set(g.id, { state: g.state, leader });
      } else {
        if (g.state === 'post' && (was ? was.state === 'in' : nowRef() - +new Date(g.start) < 6 * 3600e3)) {
          const won = !!t.winner, tie = !t.winner && !o.winner;
          if (ALERT.notify({ id: `sp:${g.id}:final`, title: tie ? `Final: ${score(g)}` : won ? `${t.name} win! ${score(g)}` : `Final: ${t.abbr} lose ${score(g)}`, body: `${lgName(g.lg)} · pregame chance ${pc(pMine)}`, go, tone: won ? 'up' : tie ? 'info' : 'down' }) && won && !document.hidden) UX.confetti([APP.teamColor(g.lg, t), '#FFB547', '#ffffff']);
        }
        prev.set(g.id, { state: g.state });
      }
    }
    BADGE.set(liveMine);
  }

  /* ---------- wire it up after the first render ---------- */
  let ready = false;
  function setup() {
    if (ready) return; ready = true;
    SRCH.mount({ key: 'probable-sports', placeholder: 'Search teams, games, leagues, news…', source: index, suggest, groups: ['Team', 'Game', 'League', 'Section', 'News', 'Action'], ask, host: '.mast-actions', prepend: true });
    const insIn = document.querySelector('#insBar .ins-in');
    STORY.mount({ key: 'probable-sports', title: "Today's sports briefing", mark: 'P.', label: 'Today', slides, ask, host: insIn, prepend: true, bg: ['#13223d', '#0a1120'] });
    UX.key('b', "Open today's briefing", () => STORY.open());
    UX.key('n', 'Open the news', () => APP.setTab('news'));
    UX.key('a', 'Ask AI', () => ask(''));
    UX.key('t', 'Switch light or dark theme', () => { const b = document.getElementById('btn-theme'); if (b) b.click(); });
    UX.key('r', 'Refresh the scores', () => { const b = document.getElementById('btn-refresh'); if (b) b.click(); });
    TABS.forEach(([id, title], k) => UX.key(String(k + 1), 'Open ' + title.toLowerCase(), () => APP.setTab(id)));
    if (!SNAP()) UX.ptr({ onRefresh: async () => { await APP.refreshLive(false); APP.renderAll(); } });
  }
  APP.onRender.push(kind => {
    if (S.mode === 'loading') return;
    setup(); watch();
    UX.countUp(document.getElementById('arena'));
  });
  // the Insights bar can share its current insight as a card
  const insMount = INS.mount;
  INS.mount = o => insMount(Object.assign({}, o, { share: it => { const m = /^(close|next|fav|upset|gap|swing)-(.+)$/.exec(it.id || ''), g = m ? APP.findGame(m[2]) : null; SHARE.share(g ? Object.assign(gameCard(g), { kicker: it.tag + ' · ' + lgName(g.lg) }) : { kicker: it.tag, title: it.text, value: it.val, tone: it.tone === 'down' ? 'down' : it.tone === 'up' ? 'up' : 'info' }, { file: 'probable-insight' }); } }));
})();
