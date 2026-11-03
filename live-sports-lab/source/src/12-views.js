/* ==========================================================================
   Probable — views: board, game center, scenario studio, lab, standings
   ========================================================================== */
(function () {
  'use strict';
  const PM = window.PM, APP = window.APP, C = APP.charts;
  const { S, LEAGUES, LG, EXTRAS, esc, pct, pct1, dpts, mmss, ord, when, dateShort, badge, shortName, kindOf } = APP;
  const $ = (s, r) => (r || document).querySelector(s);
  const clamp = PM.math.clamp;
  let uidN = 0; const uid = () => 's' + (++uidN);

  /* ================= status + rail ================= */
  function renderStatus() {
    const el = $('#status'); if (!el) return;
    const onSite = location.hostname === 'bsilva87921.github.io';
    const rb = $('#btn-refresh'), ab = $('#btn-auto');
    if (rb) { rb.hidden = S.mode === 'snapshot' && !onSite; const l = rb.querySelector('.lbl'); if (l) l.textContent = S.mode === 'snapshot' ? 'Retry live feed' : 'Refresh'; }
    if (ab) ab.hidden = S.mode !== 'live';
    if (S.mode === 'loading') { el.className = 'status'; el.innerHTML = '<span class="dot"></span><span class="st-long">Connecting to live feeds…</span><span class="st-short">Connecting…</span>'; return; }
    if (S.mode === 'live') {
      const ago = S.lastUpdate ? Math.max(0, Math.round((Date.now() - S.lastUpdate) / 1000)) : 0;
      const nxt = S.auto && S.nextAt ? Math.max(0, Math.round((S.nextAt - Date.now()) / 1000)) : null;
      const agoTxt = ago < 5 ? 'just now' : ago < 90 ? ago + 's ago' : Math.round(ago / 60) + ' min ago';
      el.className = 'status live';
      el.innerHTML = `<span class="dot"></span><span class="st-long"><b>Live</b> · ESPN feed · updated ${agoTxt}${nxt != null ? ` · next in ${nxt}s` : ' · auto-refresh off'}</span><span class="st-short"><b>Live</b><span class="st-ago"> · ${agoTxt}</span></span>`;
      return;
    }
    const cap = new Date(S.capturedAt);
    const capTxt = cap.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    el.className = 'status';
    el.innerHTML = `<span class="dot"></span><span class="st-long"><b>Snapshot</b> · captured ${esc(capTxt)}${onSite ? '' : ` · <a href="${APP.SITE_URL}" target="_blank" rel="noopener">Live version ↗</a>`}</span><span class="st-short"><b>Snapshot</b></span>`;
  }
  function liveCount(id) { return (S.data[id]?.games || []).filter(g => g.state === 'in').length; }
  function renderRail() {
    const el = $('#rail'); if (!el) return;
    const chip = (id, name, n) => `<button type="button" class="chip" data-lg="${id}" aria-pressed="${S.league === id}">${esc(name)}${n ? `<span class="n" title="${n} live">${n}</span>` : ''}</button>`;
    const total = LEAGUES.reduce((a, l) => a + liveCount(l.id), 0);
    let h = chip('all', 'All sports', total);
    for (const l of LEAGUES) h += chip(l.id, l.short || l.name, liveCount(l.id));
    h += '<span class="chip sep" aria-hidden="true" style="padding:0;border:0;background:none"><span class="sep"></span></span>';
    for (const x of EXTRAS) h += chip(x.id, x.name, x.id === 'tennis' ? (S.extras.tennis || []).filter(m => m.state === 'in').length : 0);
    el.innerHTML = h;
  }

  /* ================= board ================= */
  function orderOf(kind) { return kind === 'sc' ? ['home', 'away'] : ['away', 'home']; }
  function statusHTML(g) {
    if (g.state === 'in') {
      if (S.mode === 'snapshot') return `<span class="st cap" title="In progress when the snapshot was captured">At capture · ${esc(g.detail || 'Live')}</span>`;
      return `<span class="st live">${esc(g.detail || 'Live')}</span>`;
    }
    if (g.state === 'post') return `<span class="st">${esc(g.void ? (g.detail || 'Postponed') : 'Final')}${g.detail && /OT|SO|\/\d+/.test(g.detail) ? ' · ' + esc(g.detail.replace(/^Final\/?/, '')) : ''} · ${esc(dateShort(g.start))}</span>`;
    return `<span class="st">${esc(when(g.start))}</span>`;
  }
  function diamond(s) {
    return `<svg class="diamond" width="26" height="18" viewBox="0 0 26 18" aria-hidden="true"><rect x="9" y="1" width="7" height="7" transform="rotate(45 12.5 4.5)" class="${s.b2 ? 'on' : ''}"/><rect x="16" y="8" width="7" height="7" transform="rotate(45 19.5 11.5)" class="${s.b1 ? 'on' : ''}"/><rect x="2" y="8" width="7" height="7" transform="rotate(45 5.5 11.5)" class="${s.b3 ? 'on' : ''}"/></svg>`;
  }
  function sitText(g) {
    const k = kindOf(g.lg), x = g.sit || {};
    if (g.state !== 'in') return '';
    if (k === 'fb') {
      if (x.text) return esc(x.text) + (x.poss ? ' · ' + esc(g[x.poss].abbr) + ' ball' : '');
      if (g.detail) return esc(g.detail);
      return '';
    }
    if (k === 'bb') return `${diamond(x)} ${x.half === 'top' ? '▲' : '▼'}${x.inning} · ${x.outs} out${x.outs === 1 ? '' : 's'}`;
    if (k === 'sc') return `${x.minute}'` + (x.redH || x.redA ? ` · red cards ${g.home.abbr} ${x.redH} / ${g.away.abbr} ${x.redA}` : '');
    return esc(g.detail || '');
  }
  function lineShort(g) {
    const L = g.line; if (!L) return '';
    if (isFinite(L.spread) && L.spread !== 0) { const fav = L.spread > 0 ? g.home.abbr : g.away.abbr; return `Line ${fav} −${Math.abs(L.spread)}`; }
    const lp = APP.lineProbs(g); if (!lp) return '';
    const fav = lp.pH >= lp.pA ? g.home.abbr : g.away.abbr;
    return `Line ${fav} ${pct(Math.max(lp.pH, lp.pA))}`;
  }
  /* ---------- team rank: power-rating order within each league (AP poll for college football) ---------- */
  const RKC = {};
  function rankMap(lgId) {
    const R = APP.ratingsFor(lgId); if (!R) return null;
    const key = R.ver + '|' + Object.keys(R.teams).length;
    if (RKC[lgId] && RKC[lgId].key === key) return RKC[lgId].map;
    const arr = Object.entries(R.teams).filter(([, t]) => t.source !== 'none').sort((a, b) => b[1].net - a[1].net);
    const map = {}; arr.forEach(([k, t], i) => { map[k] = { rank: i + 1, n: arr.length, pct: arr.length > 1 ? 1 - i / (arr.length - 1) : 0.5, src: t.source }; });
    RKC[lgId] = { key, map }; return map;
  }
  function domesticRank(name) {
    const n = APP.norm(name);
    for (const id of ['epl', 'laliga', 'seriea', 'bund', 'ligue1']) { const r = (S.data[id].standings || []).find(x => APP.norm(x.name) === n); if (r) { const m = rankMap(id); if (m && m[r.key]) return Object.assign({}, m[r.key], { dom: id }); } }
    return null;
  }
  function teamRank(g, side) {
    const t = g[side];
    if (g.lg === 'ncaaf') return t.rank ? { rank: t.rank, n: 25, pct: 1 - (t.rank - 1) / 60, poll: true } : null;
    const m = rankMap(g.lg); if (m && m[t.abbr]) return m[t.abbr];
    if (g.lg === 'ucl') return domesticRank(t.name);
    return null;
  }
  APP.teamRank = teamRank;
  function rankChip(r, g) {
    if (!r) return '';
    const lgN = LG[g.lg].short || LG[g.lg].name;
    const title = r.poll ? `AP / CFP Top 25: No. ${r.rank}` : r.dom ? `No. ${r.rank} of ${r.n} in ${LG[r.dom].name} power ratings` : `No. ${r.rank} of ${r.n} in ${lgN} power ratings${r.src === 'prior' ? ' (last season, until games are played)' : ''}`;
    return `<span class="rk" title="${esc(title)}">#${r.rank}${r.dom ? ' ' + esc(LG[r.dom].short || LG[r.dom].name) : ''}</span>`;
  }
  // strict rank priority: the best-ranked team in the game decides first (#1 before #2 before #3…),
  // its opponent's rank breaks ties, then live games, then the bigger league; unranked games sort last
  function featScore(g) {
    const a = teamRank(g, 'home'), b = teamRank(g, 'away');
    const ra = a ? a.rank : 999, rb = b ? b.rank : 999;
    return (APP.favs && APP.favs.game(g) ? 2e6 : 0) + (1000 - Math.min(ra, rb)) * 1000 + (1000 - Math.max(ra, rb)) + (g.state === 'in' ? 0.5 : 0) + (PRIO[g.lg] || 3) * 0.01;   // followed teams first
  }
  function featuredList(games) {
    const ref = S.mode === 'snapshot' && S.capturedAt ? +new Date(S.capturedAt) : Date.now(), t = g => +new Date(g.start);
    let cand = games.filter(g => g.state === 'in' || (g.state === 'pre' && t(g) <= ref + 60 * 36e5 && t(g) >= ref - 6 * 36e5));
    if (!cand.length) { const up = games.filter(g => g.state === 'pre').sort((a, b) => t(a) - t(b)); if (up.length) { const h = t(up[0]) + 48 * 36e5; cand = up.filter(g => t(g) <= h); } }
    if (!cand.length) cand = games.filter(g => g.state === 'post' && t(g) >= ref - 48 * 36e5);
    if (!cand.length) cand = games.filter(g => g.state === 'post').sort((a, b) => t(b) - t(a)).slice(0, 12);
    return cand.map(g => ({ g, s: featScore(g) })).sort((a, b) => b.s - a.s || t(a.g) - t(b.g)).map(x => x.g);
  }
  function matchupLine(g) {
    const a = teamRank(g, 'away'), h = teamRank(g, 'home'); if (!a && !h) return '';
    const lgN = LG[g.lg].short || LG[g.lg].name;
    const f = (r, t) => r ? `${r.poll ? 'No. ' : '#'}${r.rank} ${esc(t.abbr)}` : esc(t.abbr);
    const src = g.lg === 'ncaaf' ? 'AP / CFP poll' : g.lg === 'ucl' ? 'domestic-league power ratings' : `${lgN} power ratings`;
    return `${f(a, g.away)} at ${f(h, g.home)} · ${src}`;
  }
  function featCard(g, n) {
    const kind = kindOf(g.lg), P = APP.predict(g), now = P.now, order = orderOf(kind);
    const showP = g.state !== 'post' && (P.src !== 'none' || g.state === 'in');
    const row = s => { const t = g[s], r = teamRank(g, s); return `<div class="fr-t">${badge(g.lg, t)}<span class="nm">${rankChip(r, g)}${esc(shortName(t, g.lg))}</span><span class="pc">${g.state === 'pre' ? (showP ? pct(s === 'home' ? now.pH : now.pA) : '') : esc(t.score ?? '')}</span></div>`; };
    return `<button type="button" class="fcard" data-game="${esc(g.id)}" aria-label="Featured No. ${n}: ${esc(g.away.name)} at ${esc(g.home.name)}"><span class="fn" aria-hidden="true">${n}</span><div class="fc-top"><span class="lg-tag">${esc(LG[g.lg].short || LG[g.lg].name)}</span>${statusHTML(g)}</div>${order.map(row).join('')}${showP && g.state !== 'pre' ? `<div class="wpbar" aria-hidden="true">${(kind === 'sc' ? [order[0], 'draw', order[1]] : order).map(x => `<span class="${x === 'home' ? 'h' : x === 'away' ? 'a' : 'd'}" style="width:${(({ home: now.pH, away: now.pA, draw: now.pD || 0 })[x] * 100).toFixed(1)}%"></span>`).join('')}</div>` : ''}</button>`;
  }
  function featRailHTML(list) {
    const items = list.slice(1, 9); if (!items.length) return '';
    return `<div class="feat"><div class="sec-h"><h2>Top-ranked matchups</h2><span class="aside">Highest-ranked team first, then its opponent's rank · ${S.mode === 'snapshot' ? 'as of the snapshot' : 'live and the next 60 hours'}</span></div><div class="feat-rail">${items.map((g, i) => featCard(g, i + 2)).join('')}</div></div>`;
  }
  function cardHTML(g) {
    const kind = kindOf(g.lg), P = APP.predict(g), now = P.now;
    const order = orderOf(kind);
    const probs = { home: now.pH, away: now.pA, draw: now.pD || 0 };
    const showP = g.state !== 'post' && (P.src !== 'none' || g.state === 'in');
    const rows = order.map(side => {
      const t = g[side], lose = g.state === 'post' && !t.winner && (g[side === 'home' ? 'away' : 'home'].winner);
      return `<div class="trow ${lose ? 'lose' : ''}">${badge(g.lg, t)}<span class="tname" title="${esc(t.name)}">${rankChip(teamRank(g, side), g)}${esc(shortName(t, g.lg))}${t.record ? `<span class="rec">${esc(t.record)}</span>` : ''}</span><span class="pct ${showP ? '' : 'src-dim'}">${showP ? pct(probs[side]) : ''}</span><span class="score">${g.state === 'pre' ? '' : (t.score ?? '')}</span></div>`;
    }).join('');
    let bar = '';
    if (showP) {
      const segs = kind === 'sc' ? [order[0], 'draw', order[1]] : order;
      bar = `<div class="wpbar" role="img" aria-label="Win probability">${segs.map(s => `<span class="${s === 'home' ? 'h' : s === 'away' ? 'a' : 'd'}" style="width:${(probs[s] * 100).toFixed(2)}%"></span>`).join('')}</div>`;
    }
    let foot = '';
    if (g.state === 'in') {
      const h = S.hist.get(g.id);
      foot = `<span class="sit">${sitText(g)}</span>${h && h.length > 1 ? `<span class="spark" title="Home win probability since pregame">${C.spark(h)}</span>` : '<span class="what">What-if →</span>'}`;
    } else if (g.state === 'pre') {
      const lp = APP.lineProbs(g);
      let txt = '';
      const favSide = now.pH >= now.pA ? 'home' : 'away';
      if (P.src === 'model' || P.src === 'blend') txt = lp ? `${esc(g[favSide].abbr)}: model ${pct(favSide === 'home' ? now.pH : now.pA)} · line ${pct(favSide === 'home' ? lp.pH : lp.pA)}` : 'Model: team ratings + home edge';
      else if (P.src === 'line') txt = 'Prior taken from the pregame line';
      else txt = 'No pregame rating yet';
      if (kind === 'sc' && P.src !== 'none') txt = `Draw ${pct(now.pD)} · ` + txt;
      foot = `<span class="sit muted">${txt}${g.note ? ' · ' + esc(g.note) : ''}</span><span class="what">What-if →</span>`;
    } else {
      const pre = P.pre; const fav = pre.pH >= pre.pA ? 'home' : 'away';
      const upset = g[fav] && g[fav === 'home' ? 'away' : 'home'].winner && Math.max(pre.pH, pre.pA) > 0.62 && P.src !== 'none';
      foot = `<span class="sit muted">${P.src !== 'none' ? `Pregame: ${esc(g.home.abbr)} ${pct(pre.pH)}${kind === 'sc' ? ` · draw ${pct(pre.pD)}` : ''}` : ''}${upset ? ' · <b style="color:var(--accent-ink)">Upset</b>' : ''}${g.note ? ' · ' + esc(g.note) : ''}</span>`;
    }
    const lg = LG[g.lg];
    const c1 = APP.teamColor(g.lg, g[order[0]]), c2 = APP.teamColor(g.lg, g[order[1]]);
    return `<button type="button" class="card ${g.state === 'in' ? 'is-live' : ''}" style="--c1:${c1};--c2:${c2}" data-game="${esc(g.id)}" aria-label="${esc(g.away.name)} at ${esc(g.home.name)}: open game center">
      <div class="card-top"><span class="lg-tag">${esc(lg.short || lg.name)}</span>${APP.favs && APP.favs.game(g) ? '<span class="fav-mark" title="A team you follow">★</span>' : ''}${statusHTML(g)}<span class="line">${esc(lineShort(g))}</span></div>
      <div class="teams">${rows}</div>${bar}
      <div class="card-foot">${foot}</div></button>`;
  }
  function tilesHTML(games) {
    const live = games.filter(g => g.state === 'in'), up = games.filter(g => g.state === 'pre');
    const cap = S.mode === 'snapshot';
    const leagues = [...new Set(live.map(g => LG[g.lg].short || LG[g.lg].name))];
    const tiles = [];
    tiles.push(`<div class="panel tile"><span class="eyebrow">${cap ? 'Live at capture' : 'Live now'}</span><span class="val">${live.length}<small>game${live.length === 1 ? '' : 's'}</small></span><span class="sub">${live.length ? esc(leagues.join(' · ')) : `${up.length} on the upcoming slate`}</span></div>`);
    let sw = null;
    if (live.length) sw = live.map(g => { const P = APP.predict(g); return { g, d: P.now.pH - P.pre.pH, P }; }).filter(x => x.P.src !== 'none' && Math.abs(x.d) > 0.05).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
    if (sw) { const side = sw.d >= 0 ? 'home' : 'away'; const from = side === 'home' ? sw.P.pre.pH : sw.P.pre.pA, to = side === 'home' ? sw.P.now.pH : sw.P.now.pA; tiles.push(`<div class="panel tile"><span class="eyebrow">Biggest swing since the start</span><span class="val">${pct(from)} → ${pct(to)}</span><button type="button" class="link" data-game="${esc(sw.g.id)}">${esc(shortName(sw.g[side], sw.g.lg))} · ${esc(sw.g.away.abbr)} at ${esc(sw.g.home.abbr)} →</button></div>`); }
    else {
      const fins = games.filter(g => g.state === 'post' && APP.predict(g).src !== 'none');
      const ups = fins.map(g => { const P = APP.predict(g); const w = g.home.winner ? 'home' : g.away.winner ? 'away' : null; return w ? { g, p: w === 'home' ? P.pre.pH : P.pre.pA, w } : null; }).filter(Boolean).sort((a, b) => a.p - b.p);
      if (ups.length) { const u = ups[0]; tiles.push(`<div class="panel tile"><span class="eyebrow">Biggest recent upset</span><span class="val">${pct(u.p)}<small>pregame</small></span><button type="button" class="link" data-game="${esc(u.g.id)}">${esc(shortName(u.g[u.w], u.g.lg))} won · ${esc(u.g.away.abbr)} ${u.g.away.score}–${u.g.home.score} ${esc(u.g.home.abbr)} →</button></div>`); }
    }
    const gaps = up.map(g => { const P = APP.predict(g), lp = APP.lineProbs(g); return (P.src === 'model' || P.src === 'blend') && lp ? { g, d: P.now.pH - lp.pH, P, lp } : null; }).filter(Boolean).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    if (gaps.length) { const x = gaps[0]; const side = x.d > 0 ? 'home' : 'away'; tiles.push(`<div class="panel tile"><span class="eyebrow">Biggest model–line gap</span><span class="val">${(Math.abs(x.d) * 100).toFixed(0)}<small>pts toward ${esc(x.g[side].abbr)}</small></span><button type="button" class="link" data-game="${esc(x.g.id)}">Model ${pct(side === 'home' ? x.P.now.pH : x.P.now.pA)} vs line ${pct(side === 'home' ? x.lp.pH : x.lp.pA)} · ${esc(x.g.away.abbr)} at ${esc(x.g.home.abbr)} →</button></div>`); }
    return `<div class="tiles">${tiles.join('')}</div>`;
  }
  const PRIO = { nfl: 5, nba: 5, mlb: 4, wnba: 4, nhl: 4, epl: 4, ucl: 4, ncaaf: 3, laliga: 3, seriea: 3, bund: 3, ligue1: 3, mls: 3 };
  const HERO_Q = { fb: [['td:away', 'What if {A} scores a TD?'], ['qb:home', 'What if {H} loses its QB?'], ['2min', 'Jump to 2:00 left']], bk: [['r8:away', 'What if {A} goes on an 8–0 run?'], ['sup:home', "What if {H}'s superstar sits?"], ['two', 'Jump to 2:00 left']], bb: [['hr', 'What if the batter homers?'], ['load', 'Load the bases'], ['i9', 'Jump to the bottom of the 9th']], hk: [['g:away', 'What if {A} scores next?'], ['g1:home', 'What if {H} starts its backup goalie?'], ['late', 'Jump to 5:00 left']], sc: [['g:away', 'What if {A} scores next?'], ['rc:home', 'What if {H} gets a red card?'], ['pk:home', 'What if {H} gets a penalty?']] };
  function heroHTML(g) {
    const kind = kindOf(g.lg), P = APP.predict(g), now = P.now, order = orderOf(kind), lg = LG[g.lg];
    const kick = 'Featured · top-ranked matchup';
    const probs = { home: now.pH, away: now.pA, draw: now.pD || 0 };
    const row = s => { const t = g[s]; const rec = t.record || ''; return `<div class="hteam">${badge(g.lg, t)}<div class="nm"><b>${rankChip(teamRank(g, s), g)}${esc(t.name)}</b><span>${s === 'home' ? 'Home' : 'Away'}${rec ? ' · ' + esc(rec) : ''}</span></div><span class="sc">${g.state === 'pre' ? '' : esc(t.score ?? 0)}</span></div>`; };
    const segs = kind === 'sc' ? [order[0], 'draw', order[1]] : order;
    const bar = `<div class="wpbar" role="img" aria-label="Win probability">${segs.map(x => `<span class="${x === 'home' ? 'h' : x === 'away' ? 'a' : 'd'}" style="width:${(probs[x] * 100).toFixed(2)}%"></span>`).join('')}</div>`;
    const big = `<div class="wpbig">${order.map((x, i) => `<div style="text-align:${i ? 'right' : 'left'}"><div class="lab">${esc(g[x].abbr)} win${kind === 'sc' && i === 1 ? ` <span class="muted" style="font-weight:600">· draw ${pct(probs.draw)}</span>` : ''}</div><div class="v">${pct(probs[x])}</div></div>`).join('')}</div>`;
    const qs = (HERO_Q[kind] || []).map(([q, lab]) => `<button type="button" class="qbtn" data-game="${esc(g.id)}" data-q="${q}">${esc(lab.replace('{A}', g.away.abbr).replace('{H}', g.home.abbr))}</button>`).join('');
    let right = '';
    const h = S.hist.get(g.id);
    if (g.state === 'in' && h && h.length > 5) right = `<span class="eyebrow">${esc(g.home.abbr)} win probability this session</span>` + C.wpLine(h, { home: g.home.abbr, away: g.away.abbr, xFmt: 'time', aria: 'Win probability over time', big: true });
    else if (g.state === 'in' && kind === 'bb') right = `<span class="eyebrow">How it ends: ${Number(P.now.n || 0).toLocaleString()} simulated finishes</span>` + C.hist(P.now.dist, { home: g.home.abbr, away: g.away.abbr, unit: 'runs', big: true }) + `<div class="legend"><span><i style="background:var(--away)"></i>${esc(g.away.abbr)} wins</span><span><i style="background:var(--home)"></i>${esc(g.home.abbr)} wins</span></div>`;
    else if (g.state === 'in') {
      const sf = buildSurface(g.lg, P.ex, null); sf.mark = markFor(kind, sf, P.st);
      right = `<span class="eyebrow">${esc(g.home.abbr)} win chance for every lead and time left · outlined = now</span>` + C.surface(sf, { home: g.home.abbr, away: g.away.abbr, compact: true }) + `<div class="legend">${esc(g.away.abbr)} favored <span class="ramp" style="background:linear-gradient(90deg,var(--away),${C.divColor(0.5)},var(--home))"></span> ${esc(g.home.abbr)} favored · hover a cell for the number</div>`;
    }
    else {
      const lp = APP.lineProbs(g);
      const mk = (lab, p) => `<div class="r"><span>${esc(lab)}</span><div class="wpbar">${segs.map(x => `<span class="${x === 'home' ? 'h' : x === 'away' ? 'a' : 'd'}" style="width:${((x === 'home' ? p.pH : x === 'away' ? p.pA : (p.pD || 0)) * 100).toFixed(2)}%"></span>`).join('')}</div><span class="num">${esc(g.home.abbr)} ${pct(p.pH)}</span></div>`;
      right = `<span class="eyebrow">${g.state === 'post' ? 'How the models saw it before the game' : 'Model versus the pregame line'}</span><div class="cmpbars">${mk('Model', P.pre)}${lp ? mk('Line', lp) : ''}</div><div class="note">${P.src === 'blend' ? `Model blends team ratings (${Math.round((P.ex.w || 0) * 100)}% weight this early) with the line.` : P.src === 'line' ? 'No ratings for these teams yet, so the line is the prior.' : 'Team ratings plus home edge.'} Expected score ${esc(g.away.abbr)} ${P.ex.eA.toFixed(kind === 'fb' || kind === 'bk' ? 0 : 1)} – ${P.ex.eH.toFixed(kind === 'fb' || kind === 'bk' ? 0 : 1)} ${esc(g.home.abbr)}.</div>`;
    }
    return `<section class="hero" style="--c1:${APP.teamColor(g.lg, g[order[0]])};--c2:${APP.teamColor(g.lg, g[order[1]])}" aria-label="Featured game">
      <div class="side"><div class="kick"><span>${esc(lg.short || lg.name)} · ${esc(kick)}</span>${statusHTML(g)}</div>${matchupLine(g) ? `<div class="mline">${matchupLine(g)}</div>` : ''}${order.map(row).join('')}${big}${bar}
        <div class="cta"><button type="button" class="btn primary" data-game="${esc(g.id)}">Open game center</button>${qs}</div></div>
      <div class="chart-side">${right}</div></section>`;
  }
  function tennisWP(m) {
    if (m.state !== 'in' || !m.sa || !m.sa.length) return null;
    const n = m.sa.length; let setsA = 0, setsB = 0;
    for (let i = 0; i < n - 1; i++) { if (m.sa[i] > m.sb[i]) setsA++; else setsB++; }
    const gA = clamp(m.sa[n - 1] || 0, 0, 7), gB = clamp(m.sb[n - 1] || 0, 0, 7);
    if ((gA >= 6 || gB >= 6) && Math.abs(gA - gB) >= 2 || gA === 7 || gB === 7) { if (gA > gB) setsA++; else setsB++; }
    const bestOf = /atp.*(slam|open)|wimbledon|roland/i.test(m.tour) && !/wta/i.test(m.tour) ? 5 : 3;
    const cur = (gA === 7 || gB === 7 || ((gA >= 6 || gB >= 6) && Math.abs(gA - gB) >= 2)) ? { gA: 0, gB: 0 } : { gA, gB };
    const s1 = PM.tn.live(0.64, 0.64, { bestOf, setsA, setsB, gA: cur.gA, gB: cur.gB, aServing: true }).pA;
    const s2 = PM.tn.live(0.64, 0.64, { bestOf, setsA, setsB, gA: cur.gA, gB: cur.gB, aServing: false }).pA;
    return (s1 + s2) / 2;
  }
  function extrasHTML(which) {
    const parts = [];
    if (!which || which === 'tennis') {
      const ms = S.extras.tennis || [];
      const rows = ms.slice(0, 8).map(m => {
        const wp = tennisWP(m);
        const sets = (m.sa || []).map((v, i) => `${v}-${(m.sb || [])[i] ?? ''}`).join(' ');
        const st = m.state === 'in' ? (S.mode === 'snapshot' ? '<span class="st cap">At capture</span>' : '<span class="st live">Live</span>') : m.state === 'post' ? 'Final' : 'Upcoming';
        return `<div class="xrow"><div class="who"><div class="${m.winA ? 'w' : ''}">${esc(m.a)}</div><div class="${m.winB ? 'w' : ''}">${esc(m.b)}</div></div><div class="sets">${esc(sets)}${wp != null ? `<br><span class="muted">${esc(m.a.split(/[ ,]/)[0])} ${pct(wp)}</span>` : ''}</div><div class="meta">${st} · ${esc(m.tour)}${m.note ? ' · ' + esc(m.note) : ''}</div></div>`;
      }).join('');
      parts.push(`<div class="panel xcard"><h3>Tennis</h3>${rows || '<div class="empty">No matches on the feed right now.</div>'}<div class="note">Live match odds use a point → game → set Markov chain with a 64% serve-point baseline for both players. Tune it in the Lab.</div><button type="button" class="btn" data-goto-lab="tennis">Open tennis model →</button></div>`);
    }
    if (!which || which === 'ufc') {
      const u = S.extras.ufc; let body = '<div class="empty">No UFC card on the feed.</div>';
      if (u) {
        const ev = u.next || u.last, isNext = !!u.next;
        body = `<div class="note">${isNext ? 'Next card' : 'Latest results'} · ${esc(ev.name)} · ${esc(dateShort(ev.date))}</div>` + ev.fights.slice(0, 6).map(f => `<div class="xrow"><div class="who"><div>${esc(f[0])}${f[4] ? ` <span class="muted">(${esc(f[4])})</span>` : ''}</div><div>${esc(f[1])}${f[5] ? ` <span class="muted">(${esc(f[5])})</span>` : ''}</div></div><div class="sets">${esc(f[2] || '')}</div>${f[3] && f[3] !== 'main' ? `<div class="meta">${esc(f[3])}</div>` : f[3] === 'main' ? '<div class="meta">Main event</div>' : ''}</div>`).join('');
        if (u.next && u.last) body += `<div class="note">Last event: ${esc(u.last.name)} — ${esc(u.last.fights[0][3])}</div>`;
      }
      parts.push(`<div class="panel xcard"><h3>UFC</h3>${body}</div>`);
    }
    if (!which || which === 'golf') {
      const gf = S.extras.golf; let body = '<div class="empty">' + (S.mode === 'snapshot' ? 'Golf leaderboards load in the live version.' : 'No stroke-play event on the PGA feed right now.') + '</div>';
      if (gf && gf.players && gf.players.length) {
        body = `<div class="note">${esc(gf.name)} · ${esc(gf.detail || gf.state)}</div>` + gf.players.map((p, i) => `<div class="xrow"><div class="who"><div class="${i === 0 ? 'w' : ''}">${i + 1}. ${esc(p.name)}</div></div><div class="sets">${p.toPar === 0 ? 'E' : (p.toPar > 0 ? '+' : '') + p.toPar}${gf.win ? `<br><span class="muted">win ${pct(gf.win[i])}</span>` : ''}</div></div>`).join('');
        if (gf.win) body += '<div class="note">Win odds: Monte Carlo of the holes each player has left, equal skill assumed (0.72 strokes SD per hole).</div>';
      }
      parts.push(`<div class="panel xcard"><h3>Golf</h3>${body}</div>`);
    }
    return `<div class="extras">${parts.join('')}</div>`;
  }
  function matchesQ(g) {
    const q = (S.q || '').trim().toLowerCase(); if (!q) return true;
    return [g.home.name, g.home.abbr, g.away.name, g.away.abbr, g.home.short, g.away.short].some(x => x && String(x).toLowerCase().includes(q));
  }
  function howtoHTML() {
    if (APP.lsGet('probable-howto') === 'hide' || S.hideHowto) return '';
    return `<div class="howto" role="note" aria-label="How to use"><div class="step"><span class="n">1</span><div><b>Pick a game</b><span>${S.mode === 'live' ? 'Live games refresh every 30 seconds.' : 'Every card is a real game from the snapshot.'}</span></div></div><div class="step"><span class="n">2</span><div><b>Read the odds</b><span>Bars show each team's win probability right now.</span></div></div><div class="step"><span class="n">3</span><div><b>Ask “what if?”</b><span>Change the score, clock or a team's strength and the model re-runs.</span></div></div><button type="button" class="x" data-act="howto" aria-label="Hide these tips">×</button></div>`;
  }
  function renderBoard() {
    const el = $('#view-board');
    if (S.mode === 'loading') { el.innerHTML = '<div class="grid"><div class="skel"></div><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>'; return; }
    const extra = EXTRAS.find(x => x.id === S.league);
    const q = (S.q || '').trim();
    const title = q ? `Games matching “${esc(q)}”` : extra ? esc(extra.name) : S.league === 'all' ? 'Today across the sports world' : esc(LG[S.league].long || LG[S.league].name);
    if (!S.order) S.order = APP.lsGet('probable-order') === 'time' ? 'time' : 'rank';
    const orderSeg = `<span class="seg sm" role="group" aria-label="Order games by"><button type="button" data-order="rank" aria-pressed="${S.order === 'rank'}">Top-ranked first</button><button type="button" data-order="time" aria-pressed="${S.order === 'time'}">By start time</button></span>`;
    const intro = `<div class="sec-h"><h2>${title}</h2><span class="aside">${q ? '<button type="button" class="btn ghost" data-act="clearq">Clear search</button>' : extra ? 'Scores and results from the ' + (S.mode === 'live' ? 'live feed' : 'snapshot') + '.' : `<span class="aside-row"><span>Tap any game to open its game center.</span>${orderSeg}</span>`}</span></div>`;
    const snap = S.mode === 'snapshot' ? `<div class="notice"><span aria-hidden="true">◌</span><div><b>Real-data snapshot.</b> Live feeds can't be reached from here, so this shows scores, schedules and standings captured ${esc(new Date(S.capturedAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}. All models and simulators still run. ${location.hostname === 'bsilva87921.github.io' ? '<button type="button" class="btn" data-act="retry">Retry live feed</button>' : `For the live, auto-refreshing version open <a href="${APP.SITE_URL}" target="_blank" rel="noopener">bsilva87921.github.io/live-sports-lab</a>.`}</div></div>` : '';
    if (extra && !q) { el.innerHTML = intro + snap + extrasHTML(extra.id); return; }
    const lgs = S.league === 'all' || q || extra ? LEAGUES : [LG[S.league]];
    const games = lgs.flatMap(l => S.data[l.id].games || []).filter(matchesQ);
    const byStart = (a, b) => new Date(a.start) - new Date(b.start);
    const rankOrd = S.order === 'rank', fs = new Map(games.map(g => [g, featScore(g)]));
    const byRank = fb => (a, b) => (fs.get(b) - fs.get(a)) || fb(a, b);
    const live = games.filter(g => g.state === 'in').sort(rankOrd ? byRank(byStart) : byStart);
    const up = games.filter(g => g.state === 'pre').sort(rankOrd ? byRank(byStart) : byStart);
    const fin = games.filter(g => g.state === 'post').sort(rankOrd ? byRank((a, b) => byStart(b, a)) : (a, b) => byStart(b, a));
    const lim = S.league === 'all' && !q ? { up: 24, fin: 12 } : { up: 60, fin: 40 };
    const sec = (title, list, key, note) => {
      if (!list.length) return '';
      const show = key === 'live' || S[key] ? list : list.slice(0, key === 'moreUp' ? lim.up : lim.fin);
      return `<div class="sec-h"><h2>${title}</h2><span class="aside">${list.length} game${list.length === 1 ? '' : 's'}${note ? ' · ' + note : ''}</span></div><div class="grid">${show.map(cardHTML).join('')}</div>${show.length < list.length ? `<div class="more-row"><button type="button" class="btn" data-more="${key}">Show all ${list.length}</button></div>` : ''}`;
    };
    const errs = Object.keys(S.errors).filter(id => lgs.some(l => l.id === id));
    const fl = !q ? featuredList(games) : [], feat = fl[0] || null;
    const ordNote = rankOrd ? 'top-ranked teams first' : 'by start time';
    el.innerHTML = intro + (q ? '' : howtoHTML()) + snap +
      (feat ? `<div class="top">${heroHTML(feat)}${tilesHTML(games)}</div>${featRailHTML(fl)}` : '') +
      (errs.length && S.mode === 'live' ? `<div class="note">Feed unavailable right now for ${errs.map(id => esc(LG[id].short || LG[id].name)).join(', ')}.</div>` : '') +
      sec(S.mode === 'snapshot' ? 'In progress at capture' : 'Live now', live, 'live', (S.mode === 'snapshot' ? 'as of the snapshot' : 'model updates every refresh') + ' · ' + ordNote) +
      sec(S.mode === 'snapshot' ? 'Upcoming at capture' : 'Upcoming', up, 'moreUp', ordNote) +
      sec('Final', fin, 'moreFin', ordNote) +
      (!games.length ? `<div class="panel empty">${q ? 'No games match that team. Try a city, nickname or abbreviation.' : 'No games for this league in the current window. The Lab and Standings still work.'}</div>` : '') +
      (S.league === 'all' && !q ? `<div class="sec-h"><h2>Tennis, UFC &amp; golf</h2><span class="aside">Individual sports</span></div>` + extrasHTML() : '');
  }

  /* ================= scenario studio ================= */
  const FIELD_DOC = {
    fb: 'hs/as = home/away score; period 1-4 (5 = overtime); clock = seconds left in the period (0-900); poss = "home"|"away"|null (team with the ball); yl = yards from the possessing team\'s own goal line (1-99, 75 = opponent 25); down 1-4; dist = yards to go',
    bk: 'hs/as = home/away score; period 1-4 (5 = overtime); clock = seconds left in the period; poss = "home"|"away"|null',
    bb: 'hs/as = home/away runs; inning 1-15; half = "top" (away bats) | "bot" (home bats); outs 0-2; b1/b2/b3 = 1 if a runner is on first/second/third else 0',
    hk: 'hs/as = home/away goals; period 1-3 (4 = overtime); clock = seconds left in the period (0-1200); pp = "home"|"away"|null team on the power play; ppSec = power-play seconds left (0-300); ppMen = 1 (5-on-4) or 2 (5-on-3); en = "home"|"away"|null team that pulled its goalie',
    sc: 'hs/as = home/away goals; minute 0-95 (0-120 when ko = 1); ko = 1 for knockout rules (extra time and penalties), 0 for a league match; redH/redA = red cards shown to home/away'
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  function Studio(root, ctx) {
    const SC = APP.scen;
    const lg = LG[ctx.lgId], sp = PM.SP[lg.sp], kind = sp.kind, id = uid();
    const order = orderOf(kind);
    const T = { home: ctx.home, away: ctx.away };
    let st = clone(ctx.baseState);
    const adj = { adjH: 0, adjA: 0, pace: 1, neutral: !!ctx.neutral };
    let conds = [], pins = [], baseRes = null, lastRes = null, timer = null, touched = false, pending = null, lastUsed = null;
    const lib = { cat: 'pop', q: '', side: st.poss || 'home' };
    const self = { get state() { return st; }, get adj() { return adj; }, touched: () => touched };
    const R = lg.rateMax || 5, unit = sp.unit;
    const cx = { lgId: ctx.lgId, sp, ab: s => T[s].abbr };
    function exFor(a, cs) {
      const m = SC.mods(kind, sp, cs), neutral = m.neutral ? true : !!a.neutral;
      const lineH = ctx.neutral ? 0 : sp.hfa, newH = neutral ? 0 : sp.hfa * m.hfa;
      const ex = APP.expFor(ctx.lgId, ctx.home.abbr, ctx.away.abbr, ctx.line, { neutral, hfaMul: m.hfa, hfaDelta: newH - lineH, adjH: a.adjH + m.adjH, adjA: a.adjA + m.adjA, pace: a.pace * m.pace });
      const e = Object.assign({}, ex); e.eH = ex.eH * m.mulH; e.eA = ex.eA * m.mulA; e.mu = e.eH - e.eA; e.total = e.eH + e.eA; e.vol = m.vol;
      return e;
    }
    const exNow = () => exFor(adj, conds);
    const exBase = () => exFor({ adjH: 0, adjA: 0, pace: 1, neutral: !!ctx.neutral }, []);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const run = (s, ex, n) => APP.evaluate(ctx.lgId, s, ex, { n: n || 6000, seed: 7, playoff: ctx.playoff });
    const isBase = () => !adj.adjH && !adj.adjA && adj.pace === 1 && adj.neutral === !!ctx.neutral && !conds.length && same(st, ctx.baseState);
    self.exNow = exNow;

    root.innerHTML = `<div class="panel ctrls" id="${id}-c"></div><div class="panel out" id="${id}-o"><div class="res-wrap" id="${id}-r"></div><div id="${id}-a"></div></div>`;
    const cEl = root.querySelector('#' + id + '-c'), oEl = root.querySelector('#' + id + '-r'), aEl = root.querySelector('#' + id + '-a');

    const stepper = (k, v, label) => `<div class="frow"><label for="${id}-${k}" style="min-width:74px">${label}</label><span class="stepper"><button type="button" data-step="${k}" data-d="-1" aria-label="Decrease ${esc(label)}">−</button><input id="${id}-${k}" type="number" inputmode="numeric" data-k="${k}" value="${v}"><button type="button" data-step="${k}" data-d="1" aria-label="Increase ${esc(label)}">+</button></span></div>`;
    const seg = (k, v, opts, label) => `<div class="frow">${label ? `<label style="min-width:74px">${label}</label>` : ''}<span class="seg" role="group" aria-label="${esc(label || k)}">${opts.map(([val, lab]) => `<button type="button" data-seg="${k}" data-v="${val}" aria-pressed="${String(v) === String(val)}">${lab}</button>`).join('')}</span></div>`;
    const range = (k, v, min, max, step, label, fmt) => `<div class="range"><label class="rl" for="${id}-${k}">${label}</label><output id="${id}-${k}-o">${fmt(v)}</output><input type="range" id="${id}-${k}" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${v}"></div>`;
    const ylFmt = v => v < 50 ? 'Own ' + v : v === 50 ? 'Midfield' : 'Opp ' + (100 - v);
    const clockMax = () => (st.period > (sp.periods || 3)) ? (sp.otLen || (kind === 'hk' ? 300 : 600)) : (sp.perLen || 1200);
    const adjFmt = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(R >= 5 ? 1 : 2) + ' ' + unit + '/g';
    const fillT = (s, side) => String(s || '').replace(/\{T\}/g, T[side].abbr).replace(/\{O\}/g, T[SC.other(side)].abbr);

    function controls() {
      const a = document.activeElement, sel = a && cEl.contains(a) ? ['data-step', 'data-seg', 'data-tog', 'data-sc', 'data-sccat', 'data-scside', 'data-k'].map(k => a.hasAttribute(k) ? `[${k}="${a.getAttribute(k)}"]` + (a.hasAttribute('data-d') ? `[data-d="${a.getAttribute('data-d')}"]` : '') + (a.hasAttribute('data-v') ? `[data-v="${a.getAttribute('data-v')}"]` : '') : '').find(Boolean) : null;
      controlsInner();
      if (sel) { const b = cEl.querySelector(sel); if (b) b.focus(); }
    }
    function controlsInner() {
      let h = `<div class="fset"><span class="lbl">Score</span>${order.map(s => stepper(s === 'home' ? 'hs' : 'as', st[s === 'home' ? 'hs' : 'as'], T[s].abbr)).join('')}</div>`;
      if (kind === 'fb' || kind === 'bk') {
        const pers = [[1, 'Q1'], [2, 'Q2'], [3, 'Q3'], [4, 'Q4'], [5, 'OT']];
        h += `<div class="fset"><span class="lbl">Game clock</span>${seg('period', st.period, pers)}${range('clock', st.clock, 0, clockMax(), 1, 'Time left in period', mmss)}</div>`;
        h += `<div class="fset"><span class="lbl">Possession</span>${seg('poss', st.poss || '', [['away', T.away.abbr], ['', 'None'], ['home', T.home.abbr]])}`;
        if (kind === 'fb' && st.poss) h += `${range('yl', st.yl || 25, 1, 99, 1, 'Field position', ylFmt)}${seg('down', st.down || 1, [[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th']], 'Down')}${stepper('dist', st.dist || 10, 'To go')}`;
        h += '</div>';
      } else if (kind === 'bb') {
        h += `<div class="fset"><span class="lbl">Inning</span>${stepper('inning', st.inning, 'Inning')}${seg('half', st.half, [['top', '▲ Top · ' + T.away.abbr + ' bats'], ['bot', '▼ Bottom · ' + T.home.abbr + ' bats']])}${seg('outs', st.outs, [[0, '0 out'], [1, '1 out'], [2, '2 out']], 'Outs')}
          <div class="frow"><label style="min-width:74px">Runners</label><span class="bases">${[['b3', '3B'], ['b2', '2B'], ['b1', '1B']].map(([k, l]) => `<button type="button" data-tog="${k}" aria-pressed="${!!st[k]}" aria-label="Runner on ${l}"><span>${l}</span></button>`).join('')}</span></div></div>`;
      } else if (kind === 'hk') {
        h += `<div class="fset"><span class="lbl">Game clock</span>${seg('period', st.period, [[1, 'P1'], [2, 'P2'], [3, 'P3'], [4, 'OT']])}${range('clock', st.clock, 0, st.period > 3 ? 300 : 1200, 1, 'Time left in period', mmss)}</div>
          <div class="fset"><span class="lbl">Special teams</span>${seg('pp', st.pp || '', [['away', T.away.abbr + ' PP'], ['', 'Even'], ['home', T.home.abbr + ' PP']])}${st.pp ? seg('ppMen', st.ppMen === 2 ? 2 : 1, [[1, '5-on-4'], [2, '5-on-3']], 'Advantage') + range('ppSec', st.ppSec || 120, 5, 300, 5, 'Power play left', mmss) : ''}${seg('en', st.en || '', [['away', T.away.abbr + ' pulled'], ['', 'Goalies in'], ['home', T.home.abbr + ' pulled']])}</div>`;
      } else if (kind === 'sc') {
        h += `<div class="fset"><span class="lbl">Match clock</span>${seg('ko', st.ko ? 1 : 0, [[0, 'League match'], [1, 'Knockout · ET + pens']])}${range('minute', st.minute, 0, st.ko ? 120 : 95, 1, 'Minute', v => v > 90 && st.ko ? v + "' (extra time)" : v + "'")}</div>
          <div class="fset"><span class="lbl">Red cards</span>${order.map(s => stepper(s === 'home' ? 'redH' : 'redA', st[s === 'home' ? 'redH' : 'redA'], T[s].abbr)).join('')}</div>`;
      }
      h += `<div class="fset"><span class="lbl">Team strength (conditional hypotheses)</span>
        ${order.map(s => range(s === 'home' ? 'adjH' : 'adjA', adj[s === 'home' ? 'adjH' : 'adjA'], -R * 1.5, R * 1.5, R >= 5 ? 0.5 : 0.05, T[s].abbr + ' rating shift', adjFmt)).join('')}
        ${range('pace', adj.pace, 0.75, 1.25, 0.01, 'Scoring pace', v => '×' + (+v).toFixed(2))}
        ${seg('neutral', adj.neutral ? 1 : 0, [[0, 'Home field'], [1, 'Neutral site']])}</div>`;
      h += libraryHTML();
      cEl.innerHTML = h;
    }
    function libraryHTML() {
      const all = SC.list(kind);
      const cats = SC.CATS.filter(([k]) => k === 'pop' || all.some(x => x.cat === k));
      const active = conds.length ? `<div class="scen-active"><span class="eyebrow">Active conditions</span>${conds.map((c, i) => { const it = SC.find(kind, c.id); return it ? `<span class="cchip">${esc(fillT(it.lab, c.side || 'home'))}<button type="button" data-scx="${i}" aria-label="Remove condition">×</button></span>` : ''; }).join('')}<button type="button" class="btn ghost sm" data-scx="all">Clear all</button></div>` : '';
      return `<div class="fset scen"><span class="lbl">Scenario library <span class="muted">· ${all.length} situations · events, conditions and chance plays</span></span>
        <div class="scen-top"><span class="seg sm" role="group" aria-label="Team the scenario applies to">${order.map(s => `<button type="button" data-scside="${s}" aria-pressed="${lib.side === s}">${esc(T[s].abbr)}</button>`).join('')}</span>
          <label class="search sm scen-q"><span class="sr">Search scenarios</span><input type="search" id="${id}-sq" placeholder="Search: snow, penalty, back-to-back…" value="${esc(lib.q)}" autocomplete="off"></label></div>
        <div class="scen-cats" role="group" aria-label="Scenario categories">${cats.map(([k, l]) => `<button type="button" data-sccat="${k}" aria-pressed="${!lib.q && lib.cat === k}">${esc(l)}</button>`).join('')}</div>
        <div class="quick scen-list" id="${id}-sl">${libButtons()}</div>
        <div class="scen-key"><span><i class="k-ev"></i>event</span><span><i class="k-cond"></i>condition (stays on)</span><span><i class="k-ch"></i>chance: every outcome simulated</span></div>
        ${lastUsed ? `<p class="note scen-last" role="status"><span class="muted">${esc(lastUsed.how)}:</span> <b>${esc(lastUsed.lab)}</b> — ${esc(lastUsed.tip)}</p>` : ''}
        ${active}</div>`;
    }
    function libButtons() {
      const all = SC.list(kind), q = APP.norm(lib.q);
      let items = q ? all.filter(x => APP.norm(x.lab + ' ' + x.tip).includes(q) || APP.norm(fillT(x.lab, lib.side)).includes(q)) : lib.cat === 'pop' ? SC.popular(kind).map(i => SC.find(kind, i)).filter(Boolean) : all.filter(x => x.cat === lib.cat);
      if (!items.length) return '<span class="note">No scenario matches that search.</span>';
      return items.map(x => {
        const side = x.per === 'bat' ? SC.batting(st) : x.per === 'team' ? lib.side : null;
        const lab = side ? fillT(x.lab, side) : x.lab, av = SC.avail(x, st, side || lib.side, cx);
        const on = x.type === 'cond' && conds.some(c => c.id === x.id && (c.side || null) === side);
        const tip = fillT(x.tip, side || lib.side) + (av === true ? '' : ' — unavailable: ' + fillT(av, side || lib.side));
        const dyn = x.dyn && av === true ? ' · ' + x.dyn(st, cx) : '';
        return `<button type="button" class="qbtn t-${x.type} ${side === 'home' ? 'h' : side === 'away' ? 'a' : ''}" data-sc="${x.id}" title="${esc(tip)}"${x.type === 'cond' ? ` aria-pressed="${on}"` : ''}${av === true ? '' : ' disabled'}>${esc(lab + dyn)}</button>`;
      }).join('');
    }
    function drawLib() { const box = cEl.querySelector('#' + id + '-sl'); if (box) box.innerHTML = libButtons(); cEl.querySelectorAll('[data-sccat]').forEach(b => b.setAttribute('aria-pressed', String(!lib.q && b.getAttribute('data-sccat') === lib.cat))); }
    function useItem(itemId, sideArg) {
      const x = SC.find(kind, itemId); if (!x) return;
      const side = x.per === 'bat' ? SC.batting(st) : x.per === 'team' ? (sideArg || lib.side) : null;
      if (SC.avail(x, st, side || lib.side, cx) !== true) return;
      touched = true;
      const who = side || lib.side;
      if (x.type === 'cond') {
        const i = conds.findIndex(c => c.id === x.id && (c.side || null) === side);
        if (i >= 0) conds.splice(i, 1); else conds.push({ id: x.id, side });
        lastUsed = { lab: fillT(x.lab, who), tip: fillT(x.tip, who), how: i >= 0 ? 'Removed' : 'Condition on' };
        pending = null; controls(); compute(true); return;
      }
      if (x.type === 'chance') {
        const ex = exNow(), brs = x.br(st, side, cx);
        const now = run(st, ex, kind === 'bb' ? 4000 : 6000);
        const branches = brs.map(b => { const s2 = clone(st); b.ev(s2); sanitizeState(s2); return { p: b.p, lab: fillT(b.lab, side), st: s2, res: run(s2, ex, kind === 'bb' ? 4000 : 6000) }; });
        const tot = branches.reduce((a, b) => a + b.p, 0) || 1;
        const mixv = k => branches.reduce((a, b) => a + b.p / tot * (b.res[k] || 0), 0);
        pending = { lab: fillT(x.lab, side) + (x.dyn ? ' · ' + x.dyn(st, cx) : ''), tip: fillT(x.tip, side), side, branches, mix: { pH: mixv('pH'), pA: mixv('pA'), pD: mixv('pD') }, now };
        results(lastRes); const t = oEl.querySelector('.chance'); if (t) t.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      lastUsed = { lab: side ? fillT(x.lab, side) : x.lab, tip: fillT(x.tip, who), how: 'Applied' };
      x.ev(st, side, cx); pending = null; sanitize(); controls(); compute(true);
    }
    function sanitizeState(s) {
      const maxScore = kind === 'fb' || kind === 'bk' ? 250 : kind === 'bb' ? 40 : 20;
      s.hs = clamp(Math.round(+s.hs || 0), 0, maxScore); s.as = clamp(Math.round(+s.as || 0), 0, maxScore);
      if (kind === 'fb' || kind === 'bk') { s.period = clamp(+s.period || 1, 1, 5); const cm = s.period > (sp.periods || 4) ? (sp.otLen || 600) : sp.perLen; s.clock = clamp(+s.clock || 0, 0, cm); if (kind === 'fb') { s.yl = clamp(Math.round(+s.yl || 25), 1, 99); s.down = clamp(+s.down || 1, 1, 4); s.dist = clamp(Math.round(+s.dist || 10), 1, 40); } if (s.poss !== 'home' && s.poss !== 'away') s.poss = null; }
      if (kind === 'bb') { s.inning = clamp(Math.round(+s.inning || 1), 1, 15); s.outs = clamp(+s.outs || 0, 0, 2); s.half = s.half === 'bot' ? 'bot' : 'top'; for (const k of ['b1', 'b2', 'b3']) s[k] = s[k] ? 1 : 0; }
      if (kind === 'hk') { s.period = clamp(+s.period || 1, 1, 4); s.clock = clamp(+s.clock || 0, 0, s.period > 3 ? 300 : 1200); if (s.pp !== 'home' && s.pp !== 'away') { s.pp = null; s.ppSec = 0; s.ppMen = 1; } else { s.ppSec = clamp(+s.ppSec || 120, 5, 300); s.ppMen = s.ppMen === 2 ? 2 : 1; } if (s.en !== 'home' && s.en !== 'away') s.en = null; }
      if (kind === 'sc') { s.ko = s.ko ? 1 : 0; s.minute = clamp(Math.round(+s.minute || 0), 0, s.ko ? 120 : 95); s.redH = clamp(+s.redH || 0, 0, 3); s.redA = clamp(+s.redA || 0, 0, 3); }
    }
    function sanitize() {
      sanitizeState(st);
      const R15 = R * 1.5; adj.adjH = clamp(+adj.adjH || 0, -R15, R15); adj.adjA = clamp(+adj.adjA || 0, -R15, R15); adj.pace = clamp(+adj.pace || 1, 0.75, 1.25);
    }
    function describe(s, a) {
      const H = T.home.abbr, A = T.away.abbr, sc = kind === 'sc' ? `${H} ${s.hs}–${s.as} ${A}` : `${A} ${s.as}–${s.hs} ${H}`;
      let t = '';
      if (kind === 'fb' || kind === 'bk') t = `${s.period > 4 ? 'OT' : 'Q' + s.period} ${mmss(s.clock)}` + (s.poss ? ` · ${T[s.poss].abbr} ball${kind === 'fb' ? ' ' + ylFmt(s.yl) + (s.down ? `, ${ord(s.down)} & ${s.dist}` : '') : ''}` : '');
      if (kind === 'bb') t = `${s.half === 'top' ? '▲' : '▼'}${s.inning}, ${s.outs} out` + ((s.b1 || s.b2 || s.b3) ? ', on ' + ['b1', 'b2', 'b3'].filter(k => s[k]).map(k => k[1]).join('-') : '');
      if (kind === 'hk') t = `${s.period > 3 ? 'OT' : 'P' + s.period} ${mmss(s.clock)}` + (s.pp ? ` · ${T[s.pp].abbr} ${s.ppMen === 2 ? '5-on-3' : 'PP'}` : '') + (s.en ? ` · ${T[s.en].abbr} goalie pulled` : '');
      if (kind === 'sc') t = `${s.minute}'` + (s.ko ? ' · knockout' : '') + (s.redH ? ` · ${H} ${s.redH} red` : '') + (s.redA ? ` · ${A} ${s.redA} red` : '');
      const x = [];
      if (a.adjH) x.push(`${H} ${adjFmt(a.adjH)}`); if (a.adjA) x.push(`${A} ${adjFmt(a.adjA)}`); if (a.pace !== 1) x.push('pace ×' + (+a.pace).toFixed(2)); if (a.neutral !== !!ctx.neutral) x.push(a.neutral ? 'neutral site' : 'home field');
      for (const c of conds) { const it = SC.find(kind, c.id); if (it) x.push(fillT(it.lab, c.side || 'home')); }
      return sc + ' · ' + t + (x.length ? ' · ' + x.join(', ') : '');
    }
    function chanceHTML(res) {
      if (!pending) return '';
      const P = pending, side = P.side || 'home', pw = r => side === 'home' ? r.pH : r.pA, cur = pw(res || P.now);
      const rows = P.branches.map((b, i) => `<div class="ch-row"><span class="ch-p">${pct(b.p)}</span><span class="ch-lab">${esc(String(b.lab).replace(/\s*\(\d+(\.\d+)?%\)$/, ''))}</span><span class="ch-bar" aria-hidden="true"><i style="width:${(pw(b.res) * 100).toFixed(1)}%"></i></span><span class="ch-v">${esc(T[side].abbr)} ${pct(pw(b.res))}</span><button type="button" class="btn sm" data-chapply="${i}">Apply</button></div>`).join('');
      return `<div class="chance" role="region" aria-label="Chance event"><div class="sec-h"><h3>${esc(P.lab)}</h3><span class="aside">Chance play · each outcome simulated</span></div>${P.tip ? `<p class="note ch-tip">${esc(P.tip)}</p>` : ''}${rows}
        <div class="ch-exp">If attempted: <b>${esc(T[side].abbr)} ${pct(pw(P.mix))}</b> ${dpts(pw(P.mix) - cur)} <span class="muted">vs ${pct(cur)} right now</span><button type="button" class="btn ghost sm" data-chx>Dismiss</button></div></div>`;
    }
    function decideHTML(ex) {
      let d = null;
      try {
        const n = kind === 'bb' ? 2500 : 6000;
        d = SC.decide(kind, st, cx, s => run(s, ex, n), (s, m) => { const e2 = Object.assign({}, ex); e2.eH = ex.eH * (m.mulH || 1); e2.eA = ex.eA * (m.mulA || 1); e2.mu = e2.eH - e2.eA; e2.total = e2.eH + e2.eA; return run(s, e2, n); });
      } catch (e) { d = null; }
      if (!d || !d.opts || d.opts.length < 2) return '';
      const best = Math.max(...d.opts.map(o => o.p)), second = d.opts.map(o => o.p).sort((a, b) => b - a)[1];
      const rows = d.opts.map(o => `<div class="dc-row${o.p === best ? ' best' : ''}"><span class="dc-lab">${esc(o.lab)}${o.p === best ? ' <span class="tagb">best</span>' : ''}</span><span class="ch-bar" aria-hidden="true"><i style="width:${(o.p * 100).toFixed(1)}%"></i></span><span class="ch-v">${pct1(o.p)}</span></div>`).join('');
      return `<div class="decide" role="region" aria-label="Decision"><div class="sec-h"><h3>${esc(d.title)}</h3><span class="aside">${esc(T[d.team].abbr)} win chance for each option</span></div>${rows}<p class="note">${best - second < 0.01 ? 'Too close to call: the options are within a point of each other.' : `Best option by ${((best - second) * 100).toFixed(1)} points of win probability.`}${d.note ? ' ' + esc(d.note) : ''}</p></div>`;
    }
    function results(res) {
      if (!res) return;
      const base = baseRes;
      const tile = (key, lab, cls, v, bv) => `<div class="res"><span class="k"><i style="background:var(--${cls})"></i>${esc(lab)}</span><span class="v">${pct(v)}</span><span class="d">${base ? dpts(v - bv) + ` <span class="muted">vs ${esc(ctx.baseLabel || 'baseline')}</span>` : ''}</span></div>`;
      const tiles = [];
      for (const s of order) { if (kind === 'sc' && !res.ko && s === order[1]) tiles.push(tile('d', 'Draw', 'draw', res.pD, base && base.pD)); tiles.push(tile(s, T[s].abbr + (res.ko ? ' advance' : ' win'), s, s === 'home' ? res.pH : res.pA, base && (s === 'home' ? base.pH : base.pA))); }
      let proj = '';
      const f = x => (Math.round(x * 10) / 10).toFixed(kind === 'fb' || kind === 'bk' ? 0 : 1);
      if (kind === 'sc') {
        const lk = res.likely; proj = `Most likely ${res.ko ? 'score before any shootout' : 'final'}: <b>${esc(T.home.abbr)} ${lk[0]}–${lk[1]} ${esc(T.away.abbr)}</b> (${pct1(lk[2])}) · expected goals still to come: ${esc(T.home.abbr)} ${res.lamH.toFixed(2)}, ${esc(T.away.abbr)} ${res.lamA.toFixed(2)}`;
        if (res.ko) proj += ` · extra time ${pct(res.pET)} · penalties ${pct(res.pPens)}`;
      } else {
        proj = `Projected final: <b>${esc(T.away.abbr)} ${f(res.fA)} – ${f(res.fH)} ${esc(T.home.abbr)}</b>`;
        if (kind === 'hk' && res.pOT != null) proj += ` · reaches overtime ${pct(res.pOT)}`;
        if (kind === 'fb' && res.adj) proj += ` · possession worth ${Math.abs(res.adj).toFixed(1)} pts`;
        if (kind === 'bb' && res.n) proj += ` · ${res.n.toLocaleString()} simulated games`;
      }
      const chart = kind === 'sc' ? C.matrix(res.matrix, { home: T.home.abbr, away: T.away.abbr }) : C.hist(res.dist, { home: T.home.abbr, away: T.away.abbr, unit, tieLabel: kind === 'bk' || kind === 'fb' || kind === 'hk' ? 'Tied (goes to OT)' : 'Tied' });
      const legend = kind === 'sc' ? `<div class="legend">${res.ko ? 'Score after 90 minutes (or at the end of extra time)' : 'Final score probability'} · darker = more likely · outlined = most likely</div>` : `<div class="legend"><span><i style="background:var(--away)"></i>${esc(T.away.abbr)} wins</span><span><i style="background:var(--draw)"></i>Tie</span><span><i style="background:var(--home)"></i>${esc(T.home.abbr)} wins</span></div>`;
      const pinsHTML = pins.length ? `<div class="pins">${pins.map((p, i) => `<div class="pin"><span class="tagp">${String.fromCharCode(65 + i)}</span><span class="desc" title="${esc(p.desc)}">${esc(p.desc)}</span><span class="pv">${esc(T.home.abbr)} ${pct(p.pH)}${kind === 'sc' && !p.ko ? ' · D ' + pct(p.pD) : ''}</span><button type="button" data-unpin="${i}" aria-label="Remove scenario ${String.fromCharCode(65 + i)}">×</button></div>`).join('')}</div>` : '';
      oEl.innerHTML = `${chanceHTML(res)}<div class="sec-h"><h2 style="font-size:18px">Scenario result</h2><span class="aside">${esc(describe(st, adj))}</span></div>
        <div class="res-top">${tiles.join('')}</div><div class="proj">${proj}</div>${chart}${legend}
        ${decideHTML(lastEx || exNow())}
        <div class="frow"><button type="button" class="btn" data-act="pin">Pin scenario ${pins.length < 5 ? String.fromCharCode(65 + pins.length) : ''}</button><button type="button" class="btn ghost" data-act="reset">Reset to ${esc(ctx.baseLabel || 'baseline')}</button></div>${pinsHTML}`;
    }
    let lastEx = null;
    function renderAsk() {
      aEl.innerHTML = S.sample ? `<div class="ask"><span class="eyebrow">Ask in plain English</span><div class="frow"><input id="${id}-ask" type="text" placeholder="e.g. ${esc(askExample())}" aria-label="Describe a scenario"><button type="button" class="btn primary" data-act="ask">Ask</button></div><div class="ans" id="${id}-ans">Claude turns your sentence into a game state and conditions; the model does the math.</div></div>` : '';
    }
    self.refreshAsk = renderAsk;
    function askExample() {
      const H = T.home.abbr, A = T.away.abbr;
      return { fb: `snow game, ${H}'s QB is out, ${A} scores a TD with 3 minutes left`, bk: `${H} down 6 with 90 seconds left on the 2nd night of a back-to-back`, bb: `bottom of the 9th at Coors, ${H} down one, runners on 1st and 2nd, 1 out`, hk: `${A} pulls the goalie down one with 2 minutes left, backup goalie in for ${H}`, sc: `${A} goes down to 10 men in the 60th minute at 1-1 and parks the bus` }[kind];
    }
    function compute(now) {
      clearTimeout(timer);
      const go = () => {
        sanitize();
        if (!baseRes) baseRes = ctx.baseRes || run(ctx.baseState, exBase());
        lastEx = exNow();
        lastRes = isBase() ? baseRes : run(st, lastEx);
        results(lastRes);
        if (ctx.onChange) ctx.onChange(self);
      };
      if (now || kind !== 'bb') go(); else timer = setTimeout(go, 90);
    }
    self.compute = compute;
    self.result = () => lastRes;
    const LEGACY = { tdA: 'td:away', tdH: 'td:home', two: kind === 'fb' ? '2min' : 'two', runA: 'r8:away', runH: 'r8:home', hrA: 'hr', hrH: 'hr', load: 'load', gA: 'g:away', gH: 'g:home', late: 'late', rcH: 'rc:home' };
    self.quick = function (q) { q = LEGACY[q] || q; const [iid, side] = String(q).split(':'); useItem(iid, side === 'home' || side === 'away' ? side : null); };
    self.setBase = function (bs, label, res) {
      ctx.baseState = clone(bs); if (label) ctx.baseLabel = label; baseRes = null; ctx.baseRes = res || null;
      if (!touched) { st = clone(bs); controls(); }
      compute(true);
    };
    self.apply = function (patch, cs) {
      touched = true;
      for (const [k, v] of Object.entries(patch || {})) { if (k in adj) adj[k] = v; else st[k] = v; }
      for (const c of cs || []) { const it = SC.find(kind, c.id); if (!it || it.type !== 'cond') continue; const side = it.per === 'team' ? (c.team === 'home' || c.team === 'away' ? c.team : lib.side) : null; if (!conds.some(x => x.id === c.id && (x.side || null) === side)) conds.push({ id: c.id, side }); }
      pending = null; sanitize(); controls(); compute(true);
    };
    function syncOutputs(k, v) { const o = root.querySelector('#' + id + '-' + k + '-o'); if (!o) return; const fmt = { clock: mmss, yl: ylFmt, minute: x => x > 90 && st.ko ? x + "' (extra time)" : x + "'", ppSec: mmss, adjH: adjFmt, adjA: adjFmt, pace: x => '×' + (+x).toFixed(2) }[k]; if (fmt) o.textContent = fmt(+v); }
    root.addEventListener('input', e => {
      if (e.target.id === id + '-sq') { lib.q = e.target.value; drawLib(); return; }
      const k = e.target.getAttribute('data-k'); if (!k) return;
      touched = true; pending = null;
      const v = e.target.type === 'range' || e.target.type === 'number' ? +e.target.value : e.target.value;
      if (k in adj) adj[k] = v; else st[k] = v;
      syncOutputs(k, v); compute();
    });
    root.addEventListener('change', e => { if (e.target.getAttribute('data-k') && e.target.type === 'number') { sanitize(); controls(); compute(true); } });
    root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === id + '-ask') { e.preventDefault(); ask(); } });
    root.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !root.contains(b)) return;
      if (b.hasAttribute('data-step')) { const k = b.getAttribute('data-step'), d = +b.getAttribute('data-d'); touched = true; pending = null; st[k] = (+st[k] || 0) + d; sanitize(); controls(); compute(); return; }
      if (b.hasAttribute('data-seg')) {
        const k = b.getAttribute('data-seg'); let v = b.getAttribute('data-v'); touched = true; pending = null;
        if (k === 'neutral') adj.neutral = v === '1';
        else if (['period', 'down', 'outs', 'ppMen', 'ko'].includes(k)) { st[k] = +v; if (k === 'period') st.clock = Math.min(st.clock, clockMax()); }
        else { st[k] = v || null; if (k === 'poss' && v && !st.yl) st.yl = 25; if (k === 'pp' && v) { st.ppSec = st.ppSec || 120; st.ppMen = st.ppMen || 1; } if (k === 'poss' && v) lib.side = v; }
        sanitize(); controls(); compute(); return;
      }
      if (b.hasAttribute('data-tog')) { const k = b.getAttribute('data-tog'); touched = true; pending = null; st[k] = st[k] ? 0 : 1; controls(); compute(); return; }
      if (b.hasAttribute('data-sc')) { useItem(b.getAttribute('data-sc')); return; }
      if (b.hasAttribute('data-scside')) { lib.side = b.getAttribute('data-scside'); cEl.querySelectorAll('[data-scside]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawLib(); return; }
      if (b.hasAttribute('data-sccat')) { lib.cat = b.getAttribute('data-sccat'); lib.q = ''; const qi = cEl.querySelector('#' + id + '-sq'); if (qi) qi.value = ''; drawLib(); return; }
      if (b.hasAttribute('data-scx')) { const i = b.getAttribute('data-scx'); if (i === 'all') conds = []; else conds.splice(+i, 1); lastUsed = null; touched = true; pending = null; controls(); compute(true); return; }
      if (b.hasAttribute('data-chapply') && pending) { const br = pending.branches[+b.getAttribute('data-chapply')]; if (br) { st = clone(br.st); touched = true; } pending = null; sanitize(); controls(); compute(true); return; }
      if (b.hasAttribute('data-chx')) { pending = null; results(lastRes); return; }
      if (b.hasAttribute('data-unpin')) { pins.splice(+b.getAttribute('data-unpin'), 1); results(lastRes); return; }
      const act = b.getAttribute('data-act');
      if (act === 'pin' && lastRes) { if (pins.length >= 5) pins.shift(); pins.push({ desc: describe(st, adj), pH: lastRes.pH, pD: lastRes.pD || 0, ko: !!lastRes.ko }); results(lastRes); }
      if (act === 'reset') { touched = false; pending = null; lastUsed = null; conds = []; st = clone(ctx.baseState); adj.adjH = 0; adj.adjA = 0; adj.pace = 1; adj.neutral = !!ctx.neutral; controls(); compute(true); }
      if (act === 'ask') ask();
    });
    async function ask() {
      const inp = root.querySelector('#' + id + '-ask'), out = root.querySelector('#' + id + '-ans'); if (!inp || !S.sample) return;
      const q = inp.value.trim(); if (!q) { inp.focus(); return; }
      out.textContent = 'Thinking…';
      const condList = SC.list(kind).filter(x => x.type === 'cond').map(x => `${x.id}${x.per === 'team' ? ' (team)' : ''}: ${x.lab.replace(/\{T\}\s*/g, '').replace(/\{O\}/g, 'opponent')}`).join('; ');
      const prompt = `You convert a sports "what if" into edits for a win-probability simulator.\nLeague: ${lg.name}. Home team: ${T.home.name} (${T.home.abbr}). Away team: ${T.away.name} (${T.away.abbr}).\nCurrent scenario as JSON: ${JSON.stringify(Object.assign({}, st, { adjH: adj.adjH, adjA: adj.adjA, pace: adj.pace, neutral: adj.neutral }))}\nFields: ${FIELD_DOC[kind]}; adjH/adjA shift a team's strength in ${unit} per game (range ±${(R * 1.5).toFixed(2)}; injuries or absences are negative); pace scales scoring (0.75-1.25); neutral true/false.\nAvailable conditions (id: meaning; "(team)" ones need team "home" or "away"): ${condList}\nThe user's hypothesis: """${q.slice(0, 500)}"""\nReply with only JSON: {"patch": {only the fields that change, with absolute values}, "conditions": [{"id": "condition id", "team": "home"|"away"|null}], "summary": "one short sentence restating the scenario"}. Prefer a listed condition over a rating shift when one fits. If it cannot be expressed, reply {"patch": {}, "conditions": [], "summary": "why not"}.`;
      try {
        const res = await S.sample.json(prompt, { modelTier: 'quick' });
        const patch = res && typeof res.patch === 'object' && res.patch ? res.patch : {};
        const allowed = new Set([...Object.keys(st), 'hs', 'as', 'adjH', 'adjA', 'pace', 'neutral', 'ko', 'ppMen']);
        const clean = {}; for (const [k, v] of Object.entries(patch)) if (allowed.has(k)) clean[k] = (k === 'neutral') ? !!v : (typeof v === 'number' || v === null ? v : (/^-?\d+(\.\d+)?$/.test(String(v)) ? +v : v));
        const cs = Array.isArray(res && res.conditions) ? res.conditions.filter(c => c && typeof c.id === 'string').slice(0, 8) : [];
        if (Object.keys(clean).length || cs.length) self.apply(clean, cs);
        const o2 = root.querySelector('#' + id + '-ans'); if (o2) o2.textContent = (res && res.summary ? String(res.summary) : 'Applied.') + (Object.keys(clean).length || cs.length ? '' : ' (nothing to change)');
      } catch (e) {
        const code = e && e.code;
        if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) { S.sample = null; renderAsk(); return; }
        out.textContent = code === 'rate_limited' ? 'Too many requests for now — try again in a minute.' : code === 'cancelled' ? '' : "Couldn't turn that into a scenario. Try naming the score, time and team.";
      }
    }
    controls(); renderAsk(); compute(true);
    return self;
  }
  APP.Studio = Studio;

  /* ================= game center (drawer) ================= */
  let DR = null;
  function openGame(id, q) {
    const g = APP.findGame(id); if (!g) return;
    const kind = kindOf(g.lg), lg = LG[g.lg];
    const el = $('#drawer'); el.hidden = false; document.body.style.overflow = 'hidden';
    el.innerHTML = `<div class="drawer-scrim" data-close></div><aside class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="dr-ttl">
      <div class="dr-head"><span class="lg-tag">${esc(lg.short || lg.name)}</span><span class="ttl" id="dr-ttl">${esc(g.away.name)} at ${esc(g.home.name)}</span><button type="button" class="icon-btn" data-close aria-label="Close game center">✕ Close</button></div>
      <div class="dr-body"><div class="panel board" id="dr-board"></div><div id="dr-probs"></div>${g.state === 'post' ? '<div id="dr-extra"></div><div class="panel panel-pad" id="dr-hist"></div>' : '<div class="panel panel-pad" id="dr-hist"></div><div id="dr-extra"></div>'}
      <div class="sec-h"><h2>What-if simulator</h2><span class="aside">Change the state or the teams — the model re-runs instantly</span></div><div class="studio" id="dr-studio"></div></div></aside>`;
    DR = { id, studio: null, summary: null, boxTab: 'sum' };
    const P = APP.predict(g);
    const base = g.state === 'in' ? P.st : APP.fixBase(g.lg, APP.baseState(kind));
    DR.studio = Studio($('#dr-studio'), { lgId: g.lg, home: g.home, away: g.away, line: g.line, neutral: g.neutral, playoff: g.playoff, baseState: base, baseRes: g.state === 'in' ? P.now : P.pre, baseLabel: g.state === 'in' ? (S.mode === 'snapshot' ? 'capture' : 'now') : 'pregame' });
    updateDrawer();
    if (q) { DR.studio.quick(q); setTimeout(() => { const t = $('#dr-studio'); if (t) t.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60); }
    el.querySelector('.drawer-panel').focus?.();
    setTimeout(() => { const b = el.querySelector('[data-close].icon-btn'); b && b.focus(); }, 30);
    if (S.mode === 'live') loadSummaryInto(g);
    for (const f of APP.onDrawer || []) { try { f(g, el); } catch (e) { console.error(e); } }
  }
  function closeDrawer() { const el = $('#drawer'); el.hidden = true; el.innerHTML = ''; DR = null; if (APP.SX) APP.SX.card = null; document.body.style.overflow = ''; }
  function updateDrawer() {
    if (!DR) return; const g = APP.findGame(DR.id); if (!g) return;
    const kind = kindOf(g.lg), P = APP.predict(g), now = P.now, order = orderOf(kind);
    const side = s => { const t = g[s]; return `<div class="bteam">${badge(g.lg, t)}<div class="nm">${esc(t.name)}${t.record ? `<br><span class="muted">${esc(t.record)}</span>` : ''}</div><div class="big">${g.state === 'pre' ? '–' : esc(t.score ?? 0)}</div></div>`; };
    const clock = g.state === 'in' ? (S.mode === 'snapshot' ? 'At capture · ' : '') + (g.detail || 'Live') : g.state === 'post' ? 'Final' : when(g.start);
    $('#dr-board').innerHTML = `${side(order[0])}<div class="bmid"><span class="clock">${esc(clock)}</span><span class="sub">${sitText(g) || esc(g.note || g.venue || '')}</span></div>${side(order[1])}`;
    const lp = APP.lineProbs(g);
    const card = (lab, cls, v, d) => `<div class="panel prob"><span class="k"><i style="background:var(--${cls})"></i>${esc(lab)}</span><span class="v">${pct(v)}</span><span class="d">${d || ''}</span></div>`;
    let probs = '';
    if (g.state !== 'post') {
      const cards = [];
      for (const s of order) { if (kind === 'sc' && s === order[1]) cards.push(card('Draw', 'draw', now.pD, g.state === 'in' ? dpts(now.pD - P.pre.pD) + ' <span class="muted">since start</span>' : '')); cards.push(card(g[s].abbr + ' win', s, s === 'home' ? now.pH : now.pA, g.state === 'in' ? dpts((s === 'home' ? now.pH - P.pre.pH : now.pA - P.pre.pA)) + ' <span class="muted">since start</span>' : '')); }
      const cmp = [];
      cmp.push(`<span>Prior: <b>${P.src === 'model' ? 'team ratings' : P.src === 'blend' ? `ratings ${Math.round((P.ex.w || 0) * 100)}% + line ${100 - Math.round((P.ex.w || 0) * 100)}%` : P.src === 'line' ? 'pregame line' : 'home edge only'}</b></span>`);
      if (g.state === 'in') cmp.push(`<span>Pregame: <b>${esc(g.home.abbr)} ${pct(P.pre.pH)}</b></span>`);
      if (lp) cmp.push(`<span>${esc(g.line.src)}: <b>${esc(g.home.abbr)} ${pct(lp.pH)}</b>${g.line.text ? ` (${esc(g.line.text)})` : ''}</span>`);
      if (g.espnWP) cmp.push(`<span>ESPN live: <b>${esc(g.home.abbr)} ${pct(g.espnWP.pH)}</b></span>`);
      cmp.push(`<span>Expected score: <b>${esc(g.away.abbr)} ${P.ex.eA.toFixed(kind === 'fb' || kind === 'bk' ? 0 : 1)} – ${P.ex.eH.toFixed(kind === 'fb' || kind === 'bk' ? 0 : 1)} ${esc(g.home.abbr)}</b> (full game)</span>`);
      probs = `<div class="probs">${cards.join('')}</div><div class="cmp" style="margin-top:10px">${cmp.join('')}</div>`;
    } else {
      probs = `<div class="panel panel-pad cmp">${P.src !== 'none' ? `<span>Pregame model: <b>${esc(g.home.abbr)} ${pct(P.pre.pH)}</b>${kind === 'sc' ? ` · draw <b>${pct(P.pre.pD)}</b>` : ''} · <b>${esc(g.away.abbr)} ${pct(P.pre.pA)}</b></span>` : '<span>No pregame rating for this game.</span>'}${lp ? `<span>${esc(g.line.src)}: <b>${esc(g.home.abbr)} ${pct(lp.pH)}</b></span>` : ''}<span>The simulator below starts from the pregame state so you can replay the matchup.</span></div>`;
    }
    $('#dr-probs').innerHTML = probs;
    const h = S.hist.get(g.id);
    let hist = '';
    if (DR.summary && DR.summary.wp && DR.summary.wp.length > 3) {
      hist = `<div class="sec-h"><h2 style="font-size:17px">Win probability, play by play</h2><span class="aside">ESPN's model · hover to inspect</span></div>` + C.wpLine(DR.summary.wp.map((p, i) => [i, p]), { home: g.home.abbr, away: g.away.abbr, xFmt: 'play', aria: 'ESPN win probability by play' });
    } else if (h && h.length > 1) {
      hist = `<div class="sec-h"><h2 style="font-size:17px">Win probability, ${S.mode === 'snapshot' ? 'pregame to capture' : 'this session'}</h2><span class="aside">${esc(g.home.abbr)} win probability</span></div>` + C.wpLine(h, { home: g.home.abbr, away: g.away.abbr, xFmt: 'time', aria: 'Model win probability over time' });
    } else {
      const surf = quickSurface(g, P);
      hist = surf;
    }
    $('#dr-hist').innerHTML = hist;
    if (DR.studio && g.state === 'in' && !DR.studio.touched()) DR.studio.setBase(P.st, S.mode === 'snapshot' ? 'capture' : 'now', P.now);
    renderSummaryExtra(g);
  }
  function quickSurface(g, P) {
    const kind = kindOf(g.lg); if (kind === 'bb') return `<div class="note">${g.state === 'pre' ? 'Pregame' : 'Final'} matchup — use the simulator below to play out any inning, base and out state.</div>`;
    const sf = buildSurface(g.lg, P.ex, null);
    return `<div class="sec-h"><h2 style="font-size:17px">Every scoreline, every minute</h2><span class="aside">${esc(g.home.abbr)} win chance by lead and time left</span></div>${C.surface(sf, { home: g.home.abbr, away: g.away.abbr })}<div class="legend">${esc(g.away.abbr)} favored <span class="ramp" style="background:linear-gradient(90deg,var(--away),${C.divColor(0.5)},var(--home))"></span> ${esc(g.home.abbr)} favored</div>`;
  }
  async function loadSummaryInto(g) {
    try {
      const js = await APP.loadSummary(g); if (!DR || DR.id !== g.id) return;
      const box = APP.box.parse(js, g);
      DR.summary = { wp: box.wp || [], box };
      updateDrawer();
    } catch (e) { if (DR && DR.id === g.id && !DR.summary) { DR.summaryErr = true; renderSummaryExtra(g); } }
  }
  function renderSummaryExtra(g) {
    const el = $('#dr-extra'); if (!el || !DR || !g) return;
    if (S.mode !== 'live') { const b = APP.box.fromSnap(g.id, g); el.innerHTML = b ? APP.box.render(b, g, DR) : (g.state === 'pre' ? '' : `<div class="note">${g.state === 'in' ? 'This game was in progress when the snapshot was taken; its box score isn\'t in this copy.' : 'No box score saved for this game in the snapshot.'} Full live box scores are in the <a href="${APP.SITE_URL}" target="_blank" rel="noopener">live version</a>.</div>`); return; }
    if (!DR.summary) { el.innerHTML = DR.summaryErr ? '<div class="note">The box score feed is unavailable for this game right now.</div>' : '<div class="panel panel-pad"><div class="skel-line"></div><div class="skel-line"></div><div class="skel-line"></div></div>'; return; }
    const keep = el.querySelector('.bx-body'), sc = keep ? keep.scrollTop : 0;
    el.innerHTML = APP.box.render(DR.summary.box, g, DR);
    const nb = el.querySelector('.bx-body'); if (nb && sc) nb.scrollTop = sc;
  }
  APP.openGame = openGame; APP.closeDrawer = closeDrawer; APP.updateDrawer = updateDrawer;

  /* ================= conditional surface ================= */
  function buildSurface(lgId, ex, mark) {
    const sp = PM.SP[LG[lgId].sp], kind = sp.kind;
    const sf = { xs: [], xl: [], xt: [], ys: [], v: [], xTitle: '' };
    if (kind === 'fb' || kind === 'bk') {
      const full = sp.periods * sp.perLen / 60, mins = kind === 'fb' ? [60, 52, 45, 38, 30, 24, 18, 14, 10, 8, 6, 4, 3, 2, 1, 0.5] : [48, 42, 36, 30, 24, 18, 14, 10, 8, 6, 4, 3, 2, 1, 0.5].map(m => m * full / 48);
      const leads = kind === 'fb' ? [21, 17, 14, 10, 7, 4, 3, 1, 0, -1, -3, -4, -7, -10, -14, -17, -21] : [20, 15, 12, 10, 8, 6, 4, 2, 0, -2, -4, -6, -8, -10, -12, -15, -20];
      sf.xs = mins; sf.ys = leads; sf.xTitle = 'Minutes left in regulation';
      for (const m of mins) { sf.xl.push((m >= 1 ? Math.round(m) : m * 60 + 's') + (m >= 1 ? ' min left' : ' left')); sf.xt.push(m >= 1 ? String(Math.round(m)) : ':' + Math.round(m * 60)); }
      for (const L of leads) {
        const row = [];
        for (const m of mins) { const secLeft = m * 60, per = Math.min(sp.periods, Math.floor((sp.periods * sp.perLen - secLeft) / sp.perLen) + 1); const clock = secLeft - (sp.periods - per) * sp.perLen; row.push(PM.brownian(sp, { hs: L > 0 ? L : 0, as: L < 0 ? -L : 0, period: per, clock, poss: null }, ex).pH); }
        sf.v.push(row);
      }
    } else if (kind === 'hk') {
      const mins = [60, 50, 40, 30, 25, 20, 15, 10, 7, 5, 3, 2, 1]; const leads = [3, 2, 1, 0, -1, -2, -3];
      sf.xs = mins; sf.ys = leads; sf.xTitle = 'Minutes left in regulation';
      for (const m of mins) { sf.xl.push(m + ' min left'); sf.xt.push(String(m)); }
      for (const L of leads) sf.v.push(mins.map(m => { const per = Math.min(3, Math.floor((60 - m) / 20) + 1); const clock = (m - (3 - per) * 20) * 60; return PM.hkLive({ hs: L > 0 ? L : 0, as: L < 0 ? -L : 0, period: per, clock }, ex).pH; }));
    } else if (kind === 'sc') {
      const mins = [0, 10, 20, 30, 40, 45, 55, 60, 65, 70, 75, 80, 85, 88, 90]; const leads = [3, 2, 1, 0, -1, -2, -3];
      sf.xs = mins; sf.ys = leads; sf.xTitle = 'Match minute';
      for (const m of mins) { sf.xl.push(m + "'"); sf.xt.push(m + "'"); }
      for (const L of leads) sf.v.push(mins.map(m => PM.scLive({ hs: L > 0 ? L : 0, as: L < 0 ? -L : 0, minute: m }, ex).pH));
    }
    if (mark) sf.mark = mark;
    return sf;
  }
  function markFor(kind, sf, st) {
    if (!st) return null;
    const lead = st.hs - st.as; let yi = 0, best = 1e9; sf.ys.forEach((y, i) => { if (Math.abs(y - lead) < best) { best = Math.abs(y - lead); yi = i; } });
    let rem;
    if (kind === 'fb' || kind === 'bk') { const sp = kind === 'fb' ? PM.SP.fb_nfl : PM.SP.bk_nba; rem = st.period > 4 ? 0.5 : ((4 - st.period) * (sf.xs[0] * 60 / 4) + st.clock) / 60; }
    else if (kind === 'hk') rem = st.period > 3 ? 1 : (3 - st.period) * 20 + st.clock / 60;
    else rem = st.minute;
    let xi = 0; best = 1e9; sf.xs.forEach((x, i) => { if (Math.abs(x - rem) < best) { best = Math.abs(x - rem); xi = i; } });
    return [xi, yi];
  }
  async function buildBBSurface(lgId, ex, token) {
    const innings = []; for (let i = 1; i <= 9; i++) { innings.push([i, 'top']); innings.push([i, 'bot']); }
    const leads = [5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5];
    const sf = { xs: innings.map((x, i) => i), xl: innings.map(([i, h]) => (h === 'top' ? 'Top ' : 'Bottom ') + ord(i) + ', 0 out'), xt: innings.map(([i, h]) => (h === 'top' ? '▲' : '▼') + i), ys: leads, v: leads.map(() => []), xTitle: 'Start of half-inning' };
    for (let yi = 0; yi < leads.length; yi++) {
      for (let xi = 0; xi < innings.length; xi++) {
        const L = leads[yi], [inn, half] = innings[xi];
        sf.v[yi][xi] = (half === 'bot' && inn === 9 && L > 0) ? 1 : PM.bbSim({ inning: inn, half, outs: 0, hs: L > 0 ? L : 0, as: L < 0 ? -L : 0 }, ex, 500, 31 + xi * 17 + yi).pH;
      }
      await new Promise(r => setTimeout(r, 0));
      if (token.dead) return null;
    }
    return sf;
  }

  /* ================= lab ================= */
  const LAB = { lg: null, home: null, away: null, studio: null, token: null };
  function labLeagues() { return LEAGUES.filter(l => !l.noStandings && (S.data[l.id].standings || []).length); }
  function pickLabLeague() {
    if (S.league === 'tennis') return 'tennis';
    const ok = labLeagues().map(l => l.id);
    if (ok.includes(S.league)) return S.league;
    if (LAB.lg && ok.includes(LAB.lg)) return LAB.lg;
    for (const id of ['nfl', 'mlb', 'wnba', 'epl']) if (ok.includes(id)) return id;
    return ok[0] || 'tennis';
  }
  function defaultTeams(lgId) {
    const g = (S.data[lgId].games || []).filter(x => x.state === 'pre').sort((a, b) => new Date(a.start) - new Date(b.start))[0];
    const rows = S.data[lgId].standings || [];
    if (g && rows.some(r => r.key === g.home.abbr) && rows.some(r => r.key === g.away.abbr)) return [g.home.abbr, g.away.abbr];
    const R = APP.ratingsFor(lgId); const sorted = rows.slice().sort((a, b) => ((R?.teams[b.key]?.net) || 0) - ((R?.teams[a.key]?.net) || 0));
    return [sorted[0]?.key, sorted[1]?.key];
  }
  function teamObj(lgId, key) { const r = (S.data[lgId].standings || []).find(x => x.key === key); return r ? { abbr: r.key, name: r.name, color: r.color || null, id: r.id } : { abbr: key, name: key }; }
  function recordStr(r, kind) { if (!r) return ''; if (!r.gp) return r.last ? 'last season ' + r.last : '0-0'; return kind === 'sc' ? `${r.w}-${r.t}-${r.l}` : `${r.w}-${r.l}${r.t ? '-' + r.t : ''}`; }
  function renderLab() {
    const el = $('#view-lab');
    if (S.mode === 'loading') { el.innerHTML = '<div class="panel empty">Loading…</div>'; return; }
    const lgId = pickLabLeague();
    if (LAB.lg !== lgId) { LAB.lg = lgId; LAB.home = LAB.away = null; }
    el.oninput = el.onchange = el.onclick = null;
    if (lgId === 'tennis') return renderTennisLab(el);
    const lg = LG[lgId], kind = kindOf(lgId), R = APP.ratingsFor(lgId), rows = (S.data[lgId].standings || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!LAB.home || !LAB.away) { const [h, a] = defaultTeams(lgId); LAB.home = h; LAB.away = a; }
    const opt = sel => rows.map(r => `<option value="${esc(r.key)}" ${r.key === sel ? 'selected' : ''}>${esc(r.name)} (${esc(recordStr(r, kind))})</option>`).join('');
    const rt = key => { const t = R && R.teams[key]; if (!t) return '—'; const u = PM.SP[lg.sp].unit; return `${t.net >= 0 ? '+' : '−'}${Math.abs(t.net).toFixed(kind === 'bb' || kind === 'hk' || kind === 'sc' ? 2 : 1)} ${u}/g · ${t.source === 'prior' ? 'preseason prior' : t.source === 'scoring' ? 'scoring margin' : 'record-based'}`; };
    const leagueOpts = labLeagues().map(l => `<option value="${l.id}" ${l.id === lgId ? 'selected' : ''}>${esc(l.name)}</option>`).join('') + `<option value="tennis">Tennis (match model)</option>`;
    el.innerHTML = `<div class="sec-h"><h2>Hypothesis lab</h2><span class="aside">Build any matchup, set any game state, shift team strength — and see the whole conditional landscape.</span></div>
      <div class="panel matchbar">
        <div class="fset"><label class="eyebrow" for="lab-lg">League</label><select id="lab-lg" class="sel">${leagueOpts}</select></div>
        <div class="fset team-a"><label class="eyebrow" for="lab-away">${kind === 'sc' ? 'Away' : 'Away · visitor'}</label><select id="lab-away" class="sel">${opt(LAB.away)}</select><span class="rating-note">Rating ${esc(rt(LAB.away))}</span></div>
        <button type="button" class="btn swap" id="lab-swap" aria-label="Swap home and away" title="Swap home and away">⇄</button>
        <div class="fset team-h"><label class="eyebrow" for="lab-home">Home</label><select id="lab-home" class="sel">${opt(LAB.home)}</select><span class="rating-note">Rating ${esc(rt(LAB.home))}</span></div>
      </div>
      <div class="studio" id="lab-studio"></div>
      <div class="panel surface-wrap" id="lab-surface"></div>
      <p class="lab-foot">Ratings are margins versus an average team on a neutral field, regressed toward zero by games played${S.data[lgId].priors ? ' and blended with last season' : ''}. The Lab uses pure ratings (no betting lines), so shift them to test injuries, rest or form.</p>`;
    const home = teamObj(lgId, LAB.home), away = teamObj(lgId, LAB.away);
    if (LAB.token) LAB.token.dead = true;
    const token = LAB.token = { dead: false };
    let sTimer = null;
    const onChange = st => {
      clearTimeout(sTimer);
      sTimer = setTimeout(async () => {
        const box = $('#lab-surface'); if (!box || token.dead) return;
        const ex = st.exNow();
        let sf;
        if (kind === 'bb') { box.innerHTML = box.innerHTML || '<div class="note">Simulating 99,000 games for the surface…</div>'; sf = await buildBBSurface(lgId, ex, token); if (!sf) return; const s = st.state; const xi = (s.inning - 1) * 2 + (s.half === 'bot' ? 1 : 0); const lead = s.hs - s.as; if (s.inning <= 9) sf.mark = [xi, clamp(5 - lead, 0, 10)]; }
        else { sf = buildSurface(lgId, ex, null); sf.mark = markFor(kind, sf, st.state); }
        if (token.dead) return;
        box.innerHTML = `<div class="sec-h"><h2 style="font-size:18px">Conditional landscape</h2><span class="aside">${esc(home.abbr)} win probability for every ${kind === 'bb' ? 'run margin and half-inning' : 'lead and time left'}, with your strength settings · outlined = your scenario</span></div>${C.surface(sf, { home: home.abbr, away: away.abbr })}<div class="legend">${esc(away.abbr)} favored <span class="ramp" style="background:linear-gradient(90deg,var(--away),${C.divColor(0.5)},var(--home))"></span> ${esc(home.abbr)} favored · hover any cell for the exact number</div>`;
      }, kind === 'bb' ? 450 : 120);
    };
    const base = APP.fixBase(lgId, APP.baseState(kind));
    LAB.studio = Studio($('#lab-studio'), { lgId, home, away, line: null, neutral: false, playoff: false, baseState: base, baseLabel: 'pregame', onChange });
  }
  const TN_EV = [['hold', 'Server holds', 'The player serving wins this game'], ['brk', 'Break of serve', 'The returner wins this game'], ['bp', 'Break point (30-40)', 'The server faces break point'], ['deuce', 'Deuce', '40-40 in this game'], ['l40', 'Love-40 on serve', 'Triple break point'], ['tb', 'Tiebreak at 6-6', 'Straight to the tiebreak'], ['setA', '{A} wins the set', '{A} takes the current set'], ['setB', '{B} wins the set', '{B} takes the current set'], ['sfsA', '{A} serves for the set', '{A} serving at 5-4'], ['sfmA', '{A} serves for the match', '{A} one set from victory, serving at 5-4'], ['mpA', 'Match point {A}', '{A} serving at 5-4, 40-30, one set from victory'], ['sfmB', '{B} serves for the match', '{B} one set from victory, serving at 5-4'], ['dec', 'Deciding set', 'Sets level, fresh deciding set']];
  const TN_CD = [['injA', '{A} injured (serve −6 pts)', 'sa', -0.06, 'Injury: serve points won drop 6'], ['injB', '{B} injured (serve −6 pts)', 'sb', -0.06, 'Injury: serve points won drop 6'], ['bigA', '{A} serving big (+3 pts)', 'sa', 0.03, 'Hot serving day'], ['bigB', '{B} serving big (+3 pts)', 'sb', 0.03, 'Hot serving day'], ['grass', 'Grass court (both +3)', 'both', 0.03, 'Fast, low bounce: servers dominate'], ['clay', 'Clay court (both −3)', 'both', -0.03, 'Slow, high bounce: more breaks'], ['indoor', 'Indoor hard (both +2)', 'both', 0.02, 'No wind, quick conditions'], ['wind', 'Windy day (both −2)', 'both', -0.02, 'Tosses drift, more breaks'], ['night', 'Night session, heavy balls (both −1)', 'both', -0.01, 'Cooler, slower conditions']];
  function tennisEvent(T, k) {
    const need = Math.ceil(T.bestOf / 2), settle = () => {
      if ((T.gA >= 6 && T.gA - T.gB >= 2) || T.gA >= 7) { T.setsA++; T.gA = T.gB = 0; }
      else if ((T.gB >= 6 && T.gB - T.gA >= 2) || T.gB >= 7) { T.setsB++; T.gA = T.gB = 0; }
    };
    const game = aWins => { if (aWins) T.gA++; else T.gB++; T.ptA = T.ptB = 0; T.aServing = !T.aServing; settle(); };
    switch (k) {
      case 'hold': game(T.aServing); break;
      case 'brk': game(!T.aServing); break;
      case 'bp': if (T.aServing) { T.ptA = 2; T.ptB = 3; } else { T.ptB = 2; T.ptA = 3; } break;
      case 'deuce': T.ptA = T.ptB = 3; break;
      case 'l40': if (T.aServing) { T.ptA = 0; T.ptB = 3; } else { T.ptB = 0; T.ptA = 3; } break;
      case 'tb': T.gA = T.gB = 6; T.ptA = T.ptB = 0; break;
      case 'setA': T.setsA++; T.gA = T.gB = 0; T.ptA = T.ptB = 0; break;
      case 'setB': T.setsB++; T.gA = T.gB = 0; T.ptA = T.ptB = 0; break;
      case 'sfsA': T.gA = 5; T.gB = 4; T.aServing = true; T.ptA = T.ptB = 0; break;
      case 'sfmA': case 'mpA': T.setsA = need - 1; T.setsB = Math.min(T.setsB, need - 1); T.gA = 5; T.gB = 4; T.aServing = true; T.ptA = k === 'mpA' ? 3 : 0; T.ptB = k === 'mpA' ? 2 : 0; break;
      case 'sfmB': T.setsB = need - 1; T.setsA = Math.min(T.setsA, need - 1); T.gB = 5; T.gA = 4; T.aServing = false; T.ptA = T.ptB = 0; break;
      case 'dec': T.setsA = T.setsB = need - 1; T.gA = T.gB = 0; T.ptA = T.ptB = 0; break;
    }
  }
  function renderTennisLab(el) {
    const T = LAB.tn = LAB.tn || { a: 'Player A', b: 'Player B', sa: 0.66, sb: 0.63, bestOf: 3, setsA: 0, setsB: 0, gA: 0, gB: 0, ptA: 0, ptB: 0, aServing: true };
    const leagueOpts = labLeagues().map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('') + `<option value="tennis" selected>Tennis (match model)</option>`;
    const pts = ['0', '15', '30', '40', 'AD'];
    const ptSel = (k, v) => `<select class="sel" data-tk="${k}" aria-label="${k === 'ptA' ? 'Points A' : 'Points B'}">${pts.map((p, i) => `<option value="${i}" ${i === v ? 'selected' : ''}>${p}</option>`).join('')}</select>`;
    const numIn = (k, v, max) => `<span class="stepper"><button type="button" data-tstep="${k}" data-d="-1" aria-label="Decrease">−</button><input type="number" data-tk="${k}" value="${v}" min="0" max="${max}" aria-label="${k}"><button type="button" data-tstep="${k}" data-d="1" aria-label="Increase">+</button></span>`;
    el.innerHTML = `<div class="sec-h"><h2>Tennis match lab</h2><span class="aside">Point → game → set → match Markov chain. Set serve strength and any live score.</span></div>
      <div class="lab-grid"><div class="panel matchup">
        <div class="fset"><label class="eyebrow" for="lab-lg">League</label><select id="lab-lg" class="sel">${leagueOpts}</select></div>
        <div class="fset"><label class="eyebrow" for="tn-a">Player A</label><input id="tn-a" class="sel" data-tk="a" value="${esc(T.a)}"></div>
        <div class="range"><label class="rl" for="tn-sa">A wins serve points</label><output>${(T.sa * 100).toFixed(0)}%</output><input type="range" id="tn-sa" data-tk="sa" min="0.5" max="0.8" step="0.005" value="${T.sa}"></div>
        <div class="fset"><label class="eyebrow" for="tn-b">Player B</label><input id="tn-b" class="sel" data-tk="b" value="${esc(T.b)}"></div>
        <div class="range"><label class="rl" for="tn-sb">B wins serve points</label><output>${(T.sb * 100).toFixed(0)}%</output><input type="range" id="tn-sb" data-tk="sb" min="0.5" max="0.8" step="0.005" value="${T.sb}"></div>
        <div class="frow"><span class="seg">${[3, 5].map(n => `<button type="button" data-tseg="bestOf" data-v="${n}" aria-pressed="${T.bestOf === n}">Best of ${n}</button>`).join('')}</span></div>
        <div class="note">Tour averages: men win about 64% of service points, women about 56%. Top servers reach 70%+.</div>
        <div class="fset scen"><span class="lbl">Match scenarios</span><div class="quick">${TN_EV.map(([k, l, tip]) => `<button type="button" class="qbtn t-event" data-tq="${k}" title="${esc(tip.replace(/\{A\}/g, T.a).replace(/\{B\}/g, T.b))}">${esc(l.replace(/\{A\}/g, T.a.split(' ').slice(-1)[0]).replace(/\{B\}/g, T.b.split(' ').slice(-1)[0]))}</button>`).join('')}</div>
          <span class="lbl" style="margin-top:6px">Conditions <span class="muted">· shift serve strength</span></span><div class="quick">${TN_CD.map(([k, l, , , tip]) => `<button type="button" class="qbtn t-cond" data-tc="${k}" title="${esc(tip)}">${esc(l.replace(/\{A\}/g, T.a.split(' ').slice(-1)[0]).replace(/\{B\}/g, T.b.split(' ').slice(-1)[0]))}</button>`).join('')}</div></div>
      </div><div class="panel out" style="padding:16px;display:flex;flex-direction:column;gap:14px" id="tn-out"></div></div>`;
    const out = $('#tn-out');
    const draw = () => {
      const r = PM.tn.live(T.sa, T.sb, T);
      const sens = []; for (let x = 50; x <= 80; x += 1) sens.push([x, PM.tn.live(x / 100, T.sb, T).pA]);
      const pre = PM.tn.live(T.sa, T.sb, { bestOf: T.bestOf, aServing: true }), need = Math.ceil(T.bestOf / 2);
      const over = T.setsA >= need ? T.a : T.setsB >= need ? T.b : null;
      out.innerHTML = `${over ? `<div class="notice"><div><b>Match over: ${esc(over)} wins.</b> Change the score or pick another scenario to keep exploring.</div></div>` : ''}<div class="fset"><span class="lbl eyebrow">Live score</span>
          <div class="frow"><label style="min-width:84px">Sets</label>${numIn('setsA', T.setsA, 2)} <span class="muted">–</span> ${numIn('setsB', T.setsB, 2)}</div>
          <div class="frow"><label style="min-width:84px">Games</label>${numIn('gA', T.gA, 7)} <span class="muted">–</span> ${numIn('gB', T.gB, 7)}</div>
          <div class="frow"><label style="min-width:84px">Points</label>${ptSel('ptA', T.ptA)} <span class="muted">–</span> ${ptSel('ptB', T.ptB)} <span class="seg">${[[1, esc(T.a.split(' ')[0]) + ' serving'], [0, esc(T.b.split(' ')[0]) + ' serving']].map(([v, l]) => `<button type="button" data-tseg="aServing" data-v="${v}" aria-pressed="${(T.aServing ? 1 : 0) === v}">${l}</button>`).join('')}</span></div></div>
        <div class="res-top"><div class="res"><span class="k"><i style="background:var(--away)"></i>${esc(T.a)}</span><span class="v">${pct(r.pA)}</span><span class="d">${dpts(r.pA - pre.pA)} <span class="muted">vs first ball</span></span></div><div class="res"><span class="k"><i style="background:var(--home)"></i>${esc(T.b)}</span><span class="v">${pct(r.pB)}</span><span class="d">${dpts(r.pB - pre.pB)} <span class="muted">vs first ball</span></span></div></div>
        <div class="proj">Current set: <b>${esc(T.a.split(' ')[0])} ${pct(r.pSet)}</b> · a fresh set: ${pct(r.pNewSet)} · holds serve: ${esc(T.a.split(' ')[0])} ${pct(PM.tn.gameP(T.sa, 0, 0))}, ${esc(T.b.split(' ')[0])} ${pct(PM.tn.gameP(T.sb, 0, 0))}</div>
        <div class="sec-h"><h2 style="font-size:17px">How much does A's serve matter?</h2><span class="aside">Match win chance from this score as A's serve-point rate changes</span></div>
        ${C.line(sens, { xTitle: esc(T.a) + ' serve points won', xName: 'Serve', mark: [Math.round(T.sa * 100), r.pA], aria: 'Match win probability by serve strength' })}`;
    };
    const syncT = () => { T.setsA = clamp(Math.round(+T.setsA || 0), 0, Math.ceil(T.bestOf / 2)); T.setsB = clamp(Math.round(+T.setsB || 0), 0, T.setsA >= Math.ceil(T.bestOf / 2) ? Math.ceil(T.bestOf / 2) - 1 : Math.ceil(T.bestOf / 2)); T.gA = clamp(Math.round(+T.gA || 0), 0, 6); T.gB = clamp(Math.round(+T.gB || 0), 0, 6); if (!(T.gA === 6 && T.gB === 6)) { T.ptA = clamp(+T.ptA || 0, 0, 4); T.ptB = clamp(+T.ptB || 0, 0, 4); if (T.ptA === 4 && T.ptB < 3) T.ptB = 3; if (T.ptB === 4 && T.ptA < 3) T.ptA = 3; if (T.ptA === 4 && T.ptB === 4) { T.ptA = 3; T.ptB = 3; } } };
    el.oninput = e => { const k = e.target.getAttribute('data-tk'); if (!k) return; T[k] = (k === 'a' || k === 'b') ? (e.target.value || (k === 'a' ? 'Player A' : 'Player B')) : +e.target.value; if (k === 'sa' || k === 'sb') e.target.previousElementSibling.textContent = (T[k] * 100).toFixed(0) + '%'; syncT(); if (k !== 'a' && k !== 'b') draw(); };
    el.onchange = e => { const k = e.target.getAttribute('data-tk'); if (k === 'a' || k === 'b') draw(); };
    el.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-tq')) { tennisEvent(T, b.getAttribute('data-tq')); syncT(); draw(); return; } if (b.hasAttribute('data-tc')) { const c = TN_CD.find(x => x[0] === b.getAttribute('data-tc')); if (c) { const f = k => { T[k] = clamp(+(T[k] + c[3]).toFixed(3), 0.5, 0.8); const r = el.querySelector('[data-tk="' + k + '"]'); if (r) { r.value = T[k]; r.previousElementSibling.textContent = (T[k] * 100).toFixed(0) + '%'; } }; if (c[2] === 'both') { f('sa'); f('sb'); } else f(c[2]); draw(); } return; } if (b.hasAttribute('data-tstep')) { const k = b.getAttribute('data-tstep'); T[k] = (+T[k] || 0) + +b.getAttribute('data-d'); syncT(); draw(); } if (b.hasAttribute('data-tseg')) { const k = b.getAttribute('data-tseg'); T[k] = k === 'aServing' ? b.getAttribute('data-v') === '1' : +b.getAttribute('data-v'); syncT(); if (k === 'bestOf') renderTennisLab(el); else draw(); } };
    draw();
  }

  /* ================= standings ================= */
  const ST = { lg: null, sel: null, adj: 0, locks: {}, sort: null, base: null, baseKey: '' };
  function standLeagues() { return LEAGUES.filter(l => !l.noStandings && (S.data[l.id].standings || []).length); }
  function pickStandLeague() { const ok = standLeagues().map(l => l.id); if (ok.includes(S.league)) return S.league; if (ST.lg && ok.includes(ST.lg)) return ST.lg; for (const id of ['nfl', 'epl', 'mlb']) if (ok.includes(id)) return id; return ok[0]; }
  function groupKey(lg, group) {
    if (!lg.grp || lg.grp === 'all') return kindOf(lg.id) === 'sc' ? 'Table' : 'League';
    const g = String(group || '');
    if (lg.grp === 'league') return /^american|^al\b/i.test(g) ? 'AL' : /^national|^nl\b/i.test(g) ? 'NL' : g.split(' ')[0];
    if (lg.id === 'nfl') return /^(afc|american)/i.test(g) ? 'AFC' : /^(nfc|national)/i.test(g) ? 'NFC' : g.split(' ')[0];
    return g.replace(/ Conference$/i, '').replace(/^East$/, 'Eastern').replace(/^West$/, 'Western');
  }
  function simTable(lgId, adjKey, adjV, locks) {
    const lg = LG[lgId], sp = PM.SP[lg.sp], R = APP.ratingsFor(lgId), kind = sp.kind;
    const rows = S.data[lgId].standings || [];
    const teams = rows.map(r => ({ key: r.key, net: ((R && R.teams[r.key]) ? R.teams[r.key].net : 0) + (r.key === adjKey ? adjV : 0), w: r.w, l: r.l, t: kind === 'hk' ? 0 : (r.t || 0), pts: r.pts, gp: r.gp, remaining: Math.max(0, (lg.games || 0) - r.gp), group: groupKey(lg, r.group) }));
    for (const [gid, res] of Object.entries(locks || {})) {
      const g = (S.data[lgId].games || []).find(x => x.id === gid); if (!g || !res) continue;
      const h = teams.find(t => t.key === g.home.abbr), a = teams.find(t => t.key === g.away.abbr); if (!h || !a) continue;
      if (res === 'home') { h.w++; a.l++; if (kind === 'sc' && isFinite(h.pts)) h.pts += 3; }
      else if (res === 'away') { a.w++; h.l++; if (kind === 'sc' && isFinite(a.pts)) a.pts += 3; }
      else if (res === 'draw') { h.t++; a.t++; if (kind === 'sc') { if (isFinite(h.pts)) h.pts += 1; if (isFinite(a.pts)) a.pts += 1; } }
      h.remaining = Math.max(0, h.remaining - 1); a.remaining = Math.max(0, a.remaining - 1); h.gp++; a.gp++;
    }
    const out = PM.seasonSim(sp, teams, { n: 1600, seed: 21, lg: R ? R.lg : sp.lg });
    const byKey = {}; teams.forEach((t, i) => { byKey[t.key] = Object.assign({}, out[i], { group: t.group, size: teams.filter(x => x.group === t.group).length }); });
    return byKey;
  }
  function oddsCols(lg) {
    const kind = kindOf(lg.id);
    if (kind === 'sc' && !lg.playoffN) return [['Title', x => x.rank[1]], [`Top ${lg.top}`, x => x.rank.slice(1, lg.top + 1).reduce((a, b) => a + b, 0)], ['Relegation', x => x.rank.slice(Math.max(1, x.size - lg.rel + 1)).reduce((a, b) => a + b, 0)]];
    const n = lg.playoffN || 6;
    return [['Top seed', x => x.rank[1]], [`Playoffs (top ${n})`, x => x.rank.slice(1, n + 1).reduce((a, b) => a + b, 0)]];
  }
  const flagTxt = { x: 'Clinched division + bye', y: 'Clinched division', w: 'Clinched wild card', p: 'Clinched playoffs', e: 'Eliminated' };
  // season-long hypotheses expressed as rating shifts (scaled to each sport's scoring unit)
  function seasonPresets(lg) {
    const r = (lg.rateMax || 5) / 10, f = v => +(v * r * 10).toFixed(lg.rateMax >= 5 ? 1 : 2);
    return [[f(-0.45), 'Superstar out for the season', 'Best player lost for the year'], [f(-0.2), 'Star out 6 weeks', 'A key starter misses a stretch (season-average effect)'], [f(0.25), 'Blockbuster trade', 'Adds an All-Star-level player'], [f(0.1), 'Coaching upgrade', 'Better scheme and in-game decisions'], [f(-0.6), 'Tank mode', 'Sells veterans, plays prospects'], [0, 'No change', 'Back to the model rating']];
  }
  function renderStandings() {
    const el = $('#view-standings');
    if (S.mode === 'loading') { el.innerHTML = '<div class="panel empty">Loading…</div>'; return; }
    const lgId = pickStandLeague(); if (!lgId) { el.innerHTML = '<div class="panel empty">Standings are not available right now.</div>'; return; }
    if (ST.lg !== lgId) { ST.lg = lgId; ST.sel = null; ST.adj = 0; ST.locks = {}; ST.sort = null; }
    const lg = LG[lgId], kind = kindOf(lgId), sp = PM.SP[lg.sp];
    const rows = (S.data[lgId].standings || []).slice();
    if (!ST.sel || !rows.some(r => r.key === ST.sel)) ST.sel = rows[0] && rows[0].key;
    const remainingAll = rows.every(r => (lg.games || 0) - r.gp <= 0), preseason = rows.every(r => !r.gp);
    const selRow = rows.find(r => r.key === ST.sel);
    const R15 = (lg.rateMax || 5) * 1.5, unit = sp.unit;
    const upcoming = (S.data[lgId].games || []).filter(g => g.state === 'pre' && rows.some(r => r.key === g.home.abbr) && rows.some(r => r.key === g.away.abbr)).sort((a, b) => new Date(a.start) - new Date(b.start)).slice(0, 12);
    const lockHTML = upcoming.map(g => { const v = ST.locks[g.id] || ''; const opts = [['away', g.away.abbr + ' win'], ...(kind === 'sc' ? [['draw', 'Draw']] : []), ['home', g.home.abbr + ' win'], ['', 'Model']]; return `<div class="lock"><span class="m">${esc(g.away.abbr)} at ${esc(g.home.abbr)} <span class="muted" style="font-weight:500">· ${esc(when(g.start))}</span></span><span class="seg">${opts.map(([k, l]) => `<button type="button" data-lock="${esc(g.id)}" data-v="${k}" aria-pressed="${v === k}">${esc(l)}</button>`).join('')}</span></div>`; }).join('');
    const leagueOpts = standLeagues().map(l => `<option value="${l.id}" ${l.id === lgId ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
    el.innerHTML = `<div class="sec-h"><h2>Standings, ratings &amp; projections</h2><span class="aside"><label for="st-lg" class="sr">League</label><select id="st-lg" class="sel">${leagueOpts}</select></span></div>
      ${preseason ? `<div class="notice"><div><b>Preseason view.</b> No ${esc(lg.name)} games played yet, so ratings come from last season's record (regressed 40% toward average) and projections cover the full ${lg.games}-game season.</div></div>` : remainingAll ? `<div class="notice"><div><b>Regular season complete.</b> Final records shown; the ratings drive the playoff games on the board.</div></div>` : ''}
      <div class="st-grid"><div class="panel" id="st-table"></div>
      <div class="panel whatif"><span class="eyebrow">Season what-if</span>
        <div class="fset"><label class="eyebrow" for="st-team">Team</label><select id="st-team" class="sel">${rows.slice().sort((a, b) => a.name.localeCompare(b.name)).map(r => `<option value="${esc(r.key)}" ${r.key === ST.sel ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
        <div class="range"><label class="rl" for="st-adj">Rating shift for ${esc(selRow ? selRow.name : '')}</label><output id="st-adj-o">${(ST.adj >= 0 ? '+' : '−') + Math.abs(ST.adj).toFixed(lg.rateMax >= 5 ? 1 : 2)} ${unit}/g</output><input type="range" id="st-adj" min="${-R15}" max="${R15}" step="${lg.rateMax >= 5 ? 0.5 : 0.05}" value="${ST.adj}"></div>
        <div class="quick" role="group" aria-label="Season scenarios">${seasonPresets(lg).map(([v, lab, tip]) => `<button type="button" class="qbtn" data-stp="${v}" title="${esc(tip)}">${esc(lab)}</button>`).join('')}</div>
        ${upcoming.length ? `<div class="fset"><span class="eyebrow">Lock upcoming results</span><div class="locks">${lockHTML}</div></div>` : ''}
        <div class="note">Changes flow through 1,600 simulated seasons; the small numbers in the table show the change from the unmodified projection. Unlocked games are simulated against a league-average opponent; tiebreakers and divisions aren't modeled.</div>
        <button type="button" class="btn" data-act="st-reset">Reset what-ifs</button>
      </div></div>
      <div class="panel panel-pad" id="st-chart"></div>`;
    renderStandingsDyn();
  }
  function renderStandingsDyn() {
    const lgId = ST.lg; if (!lgId) return;
    const lg = LG[lgId], kind = kindOf(lgId), sp = PM.SP[lg.sp], R = APP.ratingsFor(lgId), unit = sp.unit;
    const rows = (S.data[lgId].standings || []).slice();
    if (ST.baseKey !== lgId + '|' + S.data[lgId].stVer) { ST.base = simTable(lgId, null, 0, {}); ST.baseKey = lgId + '|' + S.data[lgId].stVer; }
    const scen = (ST.adj || Object.values(ST.locks).some(Boolean)) ? simTable(lgId, ST.sel, ST.adj, ST.locks) : ST.base;
    const cols = oddsCols(lg), hasPF = R && R.hasPF, preseason = rows.every(r => !r.gp);
    const sortKey = ST.sort || (preseason ? 'rating' : 'proj');
    const val = r => ({ rating: R?.teams[r.key]?.net || 0, proj: scen[r.key]?.mean || 0, gp: r.gp, pts: kind === 'sc' ? (r.pts ?? 0) : r.w + 0.5 * r.t, c0: cols[0][1](scen[r.key]), c1: cols[1][1](scen[r.key]), c2: cols[2] ? cols[2][1](scen[r.key]) : 0 }[sortKey]);
    rows.sort((a, b) => sortKey === 'name' ? a.name.localeCompare(b.name) : (val(b) - val(a)));
    const groups = [...new Set(rows.map(r => groupKey(lg, r.group)))], grouped = groups.length > 1 && !ST.sort;
    const th = (k, lab, cls) => `<th class="${cls || ''}" aria-sort="${sortKey === k ? 'descending' : 'none'}"><button type="button" data-sort="${k}">${esc(lab)}${sortKey === k ? ' ▾' : ''}</button></th>`;
    const head = `<tr>${th('name', 'Team', 'l')}${th('gp', 'GP')}<th>${kind === 'sc' ? 'W-D-L' : 'Record'}</th>${kind === 'sc' ? th('pts', 'Pts') : ''}${hasPF ? `<th>${kind === 'sc' || kind === 'hk' ? 'GF-GA' : kind === 'bb' ? 'RS-RA' : 'PF-PA'}</th>` : ''}${th('rating', 'Rating')}${th('proj', kind === 'sc' ? 'Proj pts' : 'Proj W')}<th>80% range</th>${cols.map((c, i) => th('c' + i, c[0])).join('')}</tr>`;
    const rowHTML = r => {
      const t = R?.teams[r.key], sc = scen[r.key], b = ST.base[r.key];
      const odds = cols.map(c => { const v = c[1](sc), bv = c[1](b), d = v - bv; return `<td data-v="${(v * 100).toFixed(1)}" data-d="${pct(v)}"><span class="meter">${pct(v)}<span class="m"><span style="width:${(v * 100).toFixed(1)}%"></span></span>${Math.abs(d) >= 0.005 ? `<span class="dchg ${d > 0 ? 'delta-up' : 'delta-dn'}">${d > 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(0)}</span>` : ''}</span></td>`; }).join('');
      const rec = kind === 'sc' ? `${r.w}-${r.t}-${r.l}` : `${r.w}-${r.l}${r.t ? '-' + r.t : ''}`;
      const net = t ? t.net : 0;
      return `<tr class="${r.key === ST.sel ? 'sel' : ''}" data-team="${esc(r.key)}" data-lab="${esc(r.key)}" data-name="${esc(r.name)}"><td class="l"><span class="team">${badge(lgId, { abbr: r.key, color: r.color })}<span>${esc(r.name)}</span>${r.flag ? `<span class="clinch" title="${esc(flagTxt[r.flag] || '')}">${esc(r.flag)}</span>` : ''}</span></td><td>${r.gp}</td><td>${rec}${!r.gp && r.last ? ` <span class="muted">(${esc(r.last)} last yr)</span>` : ''}</td>${kind === 'sc' ? `<td>${r.pts ?? ''}</td>` : ''}${hasPF ? `<td>${isFinite(r.pf) ? Math.round(r.pf) + '-' + Math.round(r.pa) : ''}</td>` : ''}<td>${net >= 0 ? '+' : '−'}${Math.abs(net).toFixed(kind === 'fb' || kind === 'bk' ? 1 : 2)}</td><td>${sc ? sc.mean.toFixed(1) : ''}</td><td class="muted">${sc ? sc.p10.toFixed(0) + '–' + sc.p90.toFixed(0) : ''}</td>${odds}</tr>`;
    };
    let body = '';
    if (grouped) for (const gname of groups) { body += `<tr class="grp"><td colspan="${7 + (kind === 'sc' ? 1 : 0) + (hasPF ? 1 : 0) + cols.length}">${esc(gname)}</td></tr>` + rows.filter(r => groupKey(lg, r.group) === gname).map(rowHTML).join(''); }
    else body = rows.map(rowHTML).join('');
    const tEl = $('#st-table'); if (tEl) tEl.innerHTML = `<div class="vz" data-vz="standings" data-vz-attr="data-team" data-vz-n="15" data-vz-pref="Proj W,Proj pts"><div class="tbl-wrap"><table class="tbl"><caption class="sr">${esc(lg.name)} standings with ratings and projections</caption><thead>${head}</thead><tbody>${body}</tbody></table></div></div>`;
    const selRow = rows.find(r => r.key === ST.sel);
    const ratingRows = rows.slice().sort((a, b) => (R?.teams[b.key]?.net || 0) - (R?.teams[a.key]?.net || 0)).map(r => ({ abbr: r.key, name: r.name, v: (R?.teams[r.key]?.net || 0) + (r.key === ST.sel ? ST.adj : 0), sel: r.key === ST.sel }));
    const cEl = $('#st-chart'); if (cEl) cEl.innerHTML = `<div class="sec-h"><h2 style="font-size:18px">Power ratings</h2><span class="aside">${esc(unit)} per game vs an average team on a neutral field${hasPF ? ', from scoring margin' : ', from record'} · highlighted: ${esc(selRow ? selRow.name : '')}</span></div>${C.ratingBars(ratingRows, { unit, dp: lg.rateMax >= 5 ? 1 : 2 })}`;
  }

  /* ================= methodology ================= */
  function renderMethod() {
    const el = $('#view-method');
    el.innerHTML = `<div class="sec-h"><h2>How it works</h2><span class="aside">Models, data and limits — in plain language</span></div>
    <div class="method-grid"><div class="prose">
      <p>Probable is a live, multi-sport analytics lab: it reads real scoreboards, turns every game state into a win probability, and lets you change any part of that state to test a hypothesis. Nothing is scripted — every number on the page is computed in your browser from the data it just loaded.</p>
      <h3>Data</h3>
      <p>The live version polls ESPN's public scoreboard, standings and game-summary feeds every 30 seconds while games are in progress (every 2 minutes otherwise), and loads season stats, leaderboards, schedules and archives on demand. When those feeds can't be reached, the page falls back to a real-data snapshot: scores, schedules, pregame probabilities and box scores from Sportradar, plus ESPN standings (four seasons per league) and season leaderboards, labeled with their capture time.</p>
      <h3>Featured games</h3>
      <p>The featured game and the rail under it are ordered by team rank, strictly: the game with the best-ranked team leads (every #1 team's game before any #2 team's), the opponent's rank breaks ties, then live games, then the bigger league. Rank is a team's place in its league's power ratings (below), the AP / CFP Top 25 in college football, and each club's domestic-league rank in the Champions League. Before a season's first games, NBA and NHL ranks come from last season's ratings, and the rank chip says so. The same order drives the board when “Top-ranked first” is on; “By start time” switches it back to the clock.</p>
      <h3>Team ratings</h3>
      <p>Each team gets a rating in the sport's own unit — points, runs or goals per game above an average opponent on a neutral field. With points for and against, the rating is the scoring margin; with only a record, it's the win rate converted through the sport's scoring spread (<code>σ·Φ⁻¹(win%)</code>; soccer uses points per game). Every rating is regressed toward average by adding <code>k</code> phantom average games, so a 2-0 start doesn't read like a juggernaut. NBA and NHL ratings fall back on last season, regressed 40%, until games are played.</p>
      <p>When a game has a pregame line, its prior blends the rating estimate with the line, trusting the ratings more as games accumulate: weight = games played ÷ (games played + K), with K = 8 for football, 12 for soccer and 40 for baseball. Two weeks into the NFL season the line carries about 80% of the weight; in late-September baseball the ratings carry 80%. The Lab and the season projections use the ratings alone.</p>
      <h3>Live win probability</h3>
      <p><b>Football and basketball</b> use a Brownian-motion model of the score margin (Stern, 1994): the final margin is normal around the current lead plus the pregame edge scaled by time left, with a spread that shrinks with the square root of time remaining. Football adds the expected points of the current possession from field position, down and distance. In the last 12–24 seconds of football and 24–48 seconds of basketball the model hands over to a discrete last-possession model — field-goal range and one-play touchdown odds in football, possession-by-possession scoring odds (a miss, free throws, a two or a three) in basketball — so “down 2 with the ball and 5 seconds left” gets a realistic answer instead of a bell curve.</p>
      <p><b>Baseball</b> simulates the rest of the game plate appearance by plate appearance — walks, singles, doubles, triples, homers and outs with realistic baserunning, double plays, sacrifice flies, walk-offs and the extra-inning runner — thousands of times from the exact inning, outs and runners on base. Event rates scale with each team's expected run output and are calibrated so an average team scores about 4.45 runs.</p>
      <p><b>Hockey and soccer</b> treat goals as Poisson processes over the time left. Hockey adds power plays (including 5-on-3s), pulled goalies (automatically for a trailing team late, unless you forbid it) and 3-on-3 overtime; soccer adds red cards (a sent-off side scores about a third less, the opponent about a quarter more), a Dixon–Coles correction for low-scoring draws and, for knockout ties, 30 minutes of extra time and a penalty shootout.</p>
      <p><b>Tennis</b> chains exact probabilities from serve points to games, tiebreaks, sets and the match, so any live score and any serve strength has an answer.</p>
      <h3>Conditional hypotheses</h3>
      <p>The simulator re-runs the same model on any state you set: score, clock, possession, bases, power plays, red cards, and team-strength shifts that stand in for injuries, rest or form. Pin scenarios to compare them side by side. The conditional landscape maps every lead and time combination at once, and the season what-if carries rating shifts and locked results through simulated seasons.</p>
      <p>Its scenario library holds ${['fb', 'bk', 'bb', 'hk', 'sc'].reduce((a, k) => a + APP.scen.list(k).length, 0) + TN_EV.length + TN_CD.length} situations across the sports, searchable and filed by type — scoring, game situation, personnel, weather and venue, rest and travel, strategy — in three kinds. <b>Events</b> change the state once (a pick-six, a grand slam, an 8–0 run, a red card). <b>Conditions</b> stay on and stack: snow or wind, a starting QB or superstar out, a back-to-back, altitude, a backup goalie, a parked bus; each moves scoring rates, pace, home edge or randomness by a rule-of-thumb amount shown on its button. <b>Chance plays</b> — a 49-yard field goal, a steal attempt, a penalty kick, a last-second three — simulate every outcome, blend them by their odds and let you apply any one. Decision helpers compare the options a coach actually has: go for it, kick or punt on fourth down; a three or a drive for two on the last possession; steal, bunt, squeeze or intentional walk; when to pull the goalie; how hard to chase a match.</p>
      <h3>Stats center</h3>
      <p>The Stats center pulls ESPN's season archives in the live version: standings back to the early 2000s, every team's season stats, player leaderboards, player game logs and careers, and every result of a season from the team schedules. The team, player and history views all run on the same data, so switching season or league re-runs every table and chart for that choice.</p>
      <p><b>Advanced metrics are computed in your browser.</b> <i>Pythagorean expectation</i> turns points scored and allowed into an expected win % (exponent 2.37 in football, 14 in basketball, 1.83 in baseball, 2.05 in hockey); soccer uses the same idea through a Poisson model of goals scored and conceded (<i>xPts</i>). <i>SRS</i> is a team's average margin with the home edge removed plus the average rating of its opponents, solved for every team at once; the difference is its <i>strength of schedule</i>. <i>Elo</i> replays the season game by game with a home edge and a margin-of-victory multiplier. History measures parity with the <i>Noll–Scully ratio</i> (spread of team win % divided by what pure chance would produce) and checks whether "luck" carries into the next season.</p>
      <p>Player metrics include true shooting %, effective FG%, Game Score, NBA efficiency, estimated usage, turnover % and per-36 rates in basketball; ISO, BB%, K%, BABIP, wOBA, OPS+, an estimated wRC+ and runs created for hitters, and FIP, ERA+, FIP−, K%, BB%, K−BB%, BABIP allowed and quality-start rate for pitchers (FIP is scaled so the qualified pool's FIP equals its ERA; the “+” and “−” stats use league baselines without park factors); passer rating, ANY/A, AY/A, NY/A, TD:INT and sack rate for quarterbacks, big-play and fumble rates for runners, catch rate, yards and first downs per target for receivers, and havoc plays on defense; points, goals, assists and shots per 60 minutes, plus goals saved above average (GSAA and GSAA/60) in hockey. Team pages add possessions, offensive and defensive rating, pace and the four factors in basketball; BaseRuns (and runs minus BaseRuns as sequencing luck), LOB%, defensive efficiency and team K−BB% in baseball; ANY/A, pass rate, sack rate and points per play in football; shot share, PDO and special-teams index in hockey; and attack and defense strength against the league in soccer. The <i>power index</i> blends each team's efficiency measures into one z-score composite (50 = league average, 15 points per standard deviation). A glossary on the Analytics page explains every metric, how it's computed and where it came from. Game centers add a line score, leaders, player box scores and in-game versions of the same efficiency metrics, plus an excitement index from the win-probability swings.</p>
      <p><b>Every league, every tab.</b> All thirteen team leagues — college football and the Champions League included — have team stats, player stats, advanced analytics and history. College football adds the AP Top 25, ESPN's FPI and SRS/Elo from every FBS-vs-FBS game (FCS opponents are left out so one game can't define a rating); the Champions League uses the league phase (group stage before 2024–25) plus the knockout games in its team schedules.</p>
      <h3>Championships and postseason</h3>
      <p>Every team league carries its full title history: Super Bowls (and the NFL championships from 1920 to 1965), NBA and WNBA titles, World Series, Stanley Cups (NHL era, plus the Canadiens' 1916 Cup), college football national titles (AP poll since 1936 plus the coaches' poll, BCS and CFP — a split season counts for both schools, vacated titles don't), European Cups, MLS Cups and every domestic league title in England, Spain, Italy, Germany and France. The History tab ranks franchises by titles, finals record and titles since 2000, adds playoff berths from the loaded standings, and charts a title timeline and every champion by season; team profiles list each title and lost final. Franchises are followed through relocations and renames by their current abbreviation; clubs and schools are matched by name. The histories come from Wikipedia's champions lists, cross-checked club-by-club against their title tables, with the 2025–26 champions confirmed against news reports.</p>
      <h3>Tennis, golf and UFC</h3>
      <p>The individual sports get the same four sections, with <b>Rankings</b> in place of team stats. <b>Tennis</b>: the official ATP and WTA top 100 (refreshed from ESPN on the live site), Tennis Abstract Elo ratings overall and by surface, 2026 titles by level and win–loss, every Open Era Grand Slam final, an Elo head-to-head win-probability matrix (1 ÷ (1 + 10^(−gap ÷ 400))) and ranking-points concentration. <b>Golf</b>: the Official World Golf Ranking top 100, 2026 PGA Tour statistics (live from ESPN on the site), strokes gained by category, what correlates with scoring average, every major since 1934 and all-time major totals. <b>UFC</b>: the current rankings in every division, records, UFC.com career striking and grappling rates, win methods, and every title reign since 1997 with defenses, days held and title-fight wins.</p>
      <p><b>Charts on top of every table.</b> Each data table — team and player stats, standings, the power index, history and box scores — carries a Chart switch that draws its numbers above it (bars, dots, a diverging chart around the average or a scatter of two metrics; columns and lines for season-by-season tables), a Heat switch that shades each cell from low to high, and pickers for the metric and how many rows to plot. Lower-is-better stats (ERA, turnovers, goals against) flip automatically, and your choices are remembered on this device.</p>
      <h3>Limits</h3>
      <p>These are transparent teaching-grade models, not a betting product. The baseline models ignore lineups, weather and in-game fatigue unless you add them as conditions, and those condition sizes are rules of thumb rather than fitted to each team. Season projections treat remaining games as matchups against an average opponent and don't model tiebreakers. Where a pregame line exists it is shown next to the model so disagreements are visible, not hidden.</p>
    </div>
    <div class="panel panel-pad"><span class="eyebrow">Model parameters</span>
      <table class="ptable" style="margin-top:8px"><thead><tr><th>League</th><th>Margin SD</th><th>Home edge</th><th>k</th><th>K line</th></tr></thead><tbody>
        ${[['NFL', PM.SP.fb_nfl, 'pts', 'nfl'], ['NCAAF', PM.SP.fb_ncaaf, 'pts', 'ncaaf'], ['NBA', PM.SP.bk_nba, 'pts', 'nba'], ['WNBA', PM.SP.bk_wnba, 'pts', 'wnba'], ['MLB', PM.SP.bb_mlb, 'runs', 'mlb'], ['NHL', PM.SP.hk_nhl, 'goals', 'nhl'], ['Soccer', PM.SP.sc, 'goals', 'epl']].map(([n, p, u, id]) => `<tr><td>${n}</td><td>${p.sigma} ${u}</td><td>${p.hfa} ${u}</td><td>${p.k}</td><td>${LG[id].kLine}</td></tr>`).join('')}
      </tbody></table>
      <p class="note" style="margin-top:10px">Calibration checks (average teams): NFL, home up 7 with 2:00 left and the opponent on its own 25 → ${pct(PM.brownian(PM.SP.fb_nfl, { hs: 21, as: 14, period: 4, clock: 120, poss: 'away', yl: 25, down: 1, dist: 10 }, PM.expect(PM.SP.fb_nfl, 22.5, null, null, {})).pH)}. MLB, bottom 9th tied with a runner on third and one out → ${pct(PM.bbSim({ inning: 9, half: 'bot', outs: 1, b3: 1, hs: 3, as: 3 }, { eH: 4.45, eA: 4.45, lg: 4.45 }, 8000, 5).pH)}. Soccer, 1–0 at 70' → leader wins ${pct(PM.scLive({ minute: 70, hs: 1, as: 0 }, PM.expect(PM.SP.sc, 1.38, null, null, { neutral: true })).pH)}.</p>
      <p class="note">Built by Bruno Silva in plain HTML, CSS and JavaScript — no frameworks, every chart hand-drawn in SVG.</p>
    </div></div>`;
  }

  /* ================= app shell ================= */
  function renderAll() {
    renderStatus(); renderRail();
    const t = S.tab; document.documentElement.dataset.view = t;
    for (const v of ['board', 'stats', 'lab', 'standings', 'method', 'news']) { const el = $('#view-' + v); if (el) el.hidden = v !== t; }
    document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === t)));
    if (t === 'board') renderBoard(); else if (t === 'stats') APP.renderStats(); else if (t === 'lab') renderLab(); else if (t === 'standings') renderStandings(); else if (t === 'news') { if (APP.renderNews) APP.renderNews($('#view-news')); } else renderMethod();
    if (DR) updateDrawer();
    hooks('all');
  }
  APP.renderAll = renderAll;
  // extensions (3D arena, insights, Ask AI, track record) listen here after every render
  APP.onRender = APP.onRender || [];
  function hooks(kind) { for (const f of APP.onRender) { try { f(kind, S.tab); } catch (e) { console.error(e); } } }
  function parseTab(h) { const m = String(h || '').match(/^stats-(teams|players|analytics|history)$/); if (m) { if (APP.SX) APP.SX.view = m[1]; return 'stats'; } return ['board', 'stats', 'lab', 'standings', 'method', 'news'].includes(h) ? h : null; }
  function setTab(t) {
    const p = parseTab(t) || 'board';
    const go = () => { S.tab = p; try { history.replaceState(null, '', '#' + (p === 'stats' && APP.SX && APP.SX.view !== 'teams' ? 'stats-' + APP.SX.view : p)); } catch (e) { /* ignore */ } renderAll(); window.scrollTo({ top: 0 }); };
    // a cross-fade between tabs where the browser supports view transitions (skipped for reduced motion)
    if (p !== S.tab && document.startViewTransition && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) document.startViewTransition(go); else go();
  }
  function schedule() {
    clearTimeout(S.timer);
    if (S.mode !== 'live' || !S.auto) { S.nextAt = 0; return; }
    const anyLive = APP.allGames().some(g => g.state === 'in');
    const ms = anyLive ? 30000 : 120000; S.nextAt = Date.now() + ms;
    S.timer = setTimeout(async () => { await APP.refreshLive(false); softRender(); schedule(); }, ms);
  }
  function softRender() {
    renderStatus(); renderRail();
    if (S.tab === 'board') renderBoard();
    else if (S.tab === 'standings' && !document.activeElement?.closest('#view-standings')) renderStandings();
    if (DR) { updateDrawer(); const g = APP.findGame(DR.id); if (g && g.state === 'in' && S.mode === 'live') loadSummaryInto(g); }
    hooks('soft');
  }
  function applyTheme(t) { if (t) document.documentElement.setAttribute('data-theme', t); }
  function currentDark() { const a = document.documentElement.getAttribute('data-theme'); if (a) return a === 'dark'; return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches; }

  function bind() {
    document.addEventListener('click', e => {
      const t = e.target;
      const bx = t.closest('[data-bx]'); if (bx && DR) { DR.boxTab = bx.getAttribute('data-bx'); renderSummaryExtra(APP.findGame(DR.id)); return; }
      const tab = t.closest('.tab'); if (tab) { setTab(tab.getAttribute('data-tab')); return; }
      const chip = t.closest('.chip[data-lg]'); if (chip) { S.league = chip.getAttribute('data-lg'); if (S.league !== 'all') S.lastSpecific = S.league; if (S.tab === 'method') S.tab = 'board'; renderAll(); return; }
      if (t.closest('[data-close]')) { closeDrawer(); return; }
      const gm = t.closest('[data-game]'); if (gm && !t.closest('.drawer-panel')) { openGame(gm.getAttribute('data-game'), gm.getAttribute('data-q')); return; }
      const more = t.closest('[data-more]'); if (more) { S[more.getAttribute('data-more')] = true; renderBoard(); return; }
      const ob = t.closest('[data-order]'); if (ob) { S.order = ob.getAttribute('data-order'); APP.lsSet('probable-order', S.order); renderBoard(); const b2 = document.querySelector(`[data-order="${S.order}"]`); if (b2) b2.focus(); return; }
      const gl = t.closest('[data-goto-lab]'); if (gl) { S.league = gl.getAttribute('data-goto-lab'); setTab('lab'); return; }
      const srt = t.closest('[data-sort]'); if (srt) { const k = srt.getAttribute('data-sort'); ST.sort = ST.sort === k ? null : k; renderStandingsDyn(); const b2 = document.querySelector(`[data-sort="${k}"]`); if (b2) b2.focus(); return; }
      const tr = t.closest('tr[data-team], #view-standings .chart [data-team]'); if (tr && !t.closest('button')) { ST.sel = tr.getAttribute('data-team'); ST.adj = 0; renderStandings(); return; }
      const stp = t.closest('[data-stp]'); if (stp) { ST.adj = +stp.getAttribute('data-stp'); renderStandings(); const b3 = document.querySelector(`[data-stp="${stp.getAttribute('data-stp')}"]`); if (b3) b3.focus(); return; }
      const lk = t.closest('[data-lock]'); if (lk) { ST.locks[lk.getAttribute('data-lock')] = lk.getAttribute('data-v') || undefined; lk.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === lk))); renderStandingsDyn(); return; }
      const act = t.closest('[data-act]'); if (act) {
        const a = act.getAttribute('data-act');
        if (a === 'st-reset') { ST.adj = 0; ST.locks = {}; renderStandings(); }
        if (a === 'retry') { init(true); }
        if (a === 'howto') { S.hideHowto = true; APP.lsSet('probable-howto', 'hide'); renderBoard(); }
        if (a === 'clearq') { S.q = ''; const qi = $('#q'); if (qi) qi.value = ''; renderBoard(); }
      }
    });
    document.addEventListener('change', e => {
      const id = e.target.id;
      if (id === 'lab-lg') { LAB.lg = e.target.value; LAB.home = LAB.away = null; S.league = LAB.lg; renderAll(); }
      if (id === 'lab-home' || id === 'lab-away') { LAB[id === 'lab-home' ? 'home' : 'away'] = e.target.value; renderLab(); }
      if (id === 'st-lg') { ST.lg = e.target.value; S.league = e.target.value; renderAll(); }
      if (id === 'st-team') { ST.sel = e.target.value; ST.adj = 0; renderStandings(); }
    });
    document.addEventListener('input', e => { if (e.target.id === 'st-adj') { ST.adj = +e.target.value; const o = $('#st-adj-o'); if (o) o.textContent = (ST.adj >= 0 ? '+' : '−') + Math.abs(ST.adj).toFixed(LG[ST.lg].rateMax >= 5 ? 1 : 2) + ' ' + PM.SP[LG[ST.lg].sp].unit + '/g'; clearTimeout(ST.t); ST.t = setTimeout(renderStandingsDyn, 140); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer(); });
    const qi = $('#q');
    if (qi) qi.addEventListener('input', () => { clearTimeout(S.qt); S.qt = setTimeout(() => { S.q = qi.value; if (S.tab !== 'board') setTab('board'); else renderBoard(); }, 120); });
    document.addEventListener('click', e => { if (e.target.closest('#lab-swap')) { const h = LAB.home; LAB.home = LAB.away; LAB.away = h; renderLab(); } });
    $('#btn-theme').addEventListener('click', () => { const next = currentDark() ? 'light' : 'dark'; applyTheme(next); APP.lsSet('probable-theme', next); renderAll(); });
    $('#btn-refresh').addEventListener('click', async () => {
      if (S.mode !== 'live') { init(true); return; }
      const b = $('#btn-refresh'); b.disabled = true; await APP.refreshLive(false); b.disabled = false; softRender(); schedule();
    });
    $('#btn-auto').addEventListener('click', () => { S.auto = !S.auto; $('#btn-auto').setAttribute('aria-pressed', String(S.auto)); $('#btn-auto').textContent = S.auto ? 'Auto-refresh on' : 'Auto-refresh off'; schedule(); renderStatus(); });
    if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (!document.documentElement.getAttribute('data-theme')) renderAll(); });
    window.addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); const p = parseTab(h); if (p && (p !== S.tab || p === 'stats')) setTab(h); });
  }

  async function init(retry) {
    if (!retry) {
      const saved = APP.lsGet('probable-theme'); if (saved === 'dark' || saved === 'light') applyTheme(saved);
      bind();
      const h = location.hash.replace('#', ''); if (h) S.tab = parseTab(h) || 'board';
      if (window.claude && typeof window.claude.use === 'function') window.claude.use('sample').then(s => { if (s) { S.sample = s; LAB.studio && LAB.studio.refreshAsk(); DR && DR.studio && DR.studio.refreshAsk(); } }).catch(() => { });
      setInterval(renderStatus, 1000);
    }
    S.mode = 'loading'; renderAll();
    APP.loadStatic();
    const ok = await APP.probe();
    if (ok) { S.mode = 'live'; S.cache.clear(); await APP.refreshLive(true); }
    else if (!S.capturedAt) APP.loadSnapshot();
    else S.mode = 'snapshot';
    const lives = LEAGUES.map(l => [l.id, liveCount(l.id)]).sort((a, b) => b[1] - a[1]);
    S.lastSpecific = S.lastSpecific || (lives[0][1] ? lives[0][0] : 'nfl');
    renderAll(); schedule();
  }
  APP.init = init;
  Object.assign(APP, { setTab, featScore, featuredList, simTable, standLeagues, groupKey, renderBoard });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init()); else init();
})();

