/* ==========================================================================
   Probable — app core: config, data (ESPN live / snapshot), model glue
   ========================================================================== */
(function () {
  'use strict';
  const PM = window.PM, { Phi, clamp, hash } = PM.math;
  const APP = window.APP = {};

  /* ---------- config ---------- */
  const LEAGUES = [
    { id: 'nfl', kLine: 8, name: 'NFL', path: 'football/nfl', sp: 'fb_nfl', games: 17, playoffN: 7, grp: 'conf', rateMax: 10 },
    { id: 'ncaaf', kLine: 8, name: 'NCAAF', long: 'College Football', path: 'football/college-football', sp: 'fb_ncaaf', q: 'groups=80&limit=300', noStandings: true, rateMax: 14 },
    { id: 'mlb', kLine: 40, name: 'MLB', path: 'baseball/mlb', sp: 'bb_mlb', games: 162, playoffN: 6, grp: 'league', range: [-1, 1], rateMax: 1.5 },
    { id: 'nba', kLine: 20, name: 'NBA', path: 'basketball/nba', sp: 'bk_nba', games: 82, playoffN: 6, grp: 'conf', range: [-1, 2], rateMax: 10 },
    { id: 'wnba', kLine: 16, name: 'WNBA', path: 'basketball/wnba', sp: 'bk_wnba', games: 44, playoffN: 8, grp: 'all', range: [-2, 3], rateMax: 10 },
    { id: 'nhl', kLine: 25, name: 'NHL', path: 'hockey/nhl', sp: 'hk_nhl', games: 82, playoffN: 8, grp: 'conf', range: [-1, 3], rateMax: 1 },
    { id: 'epl', name: 'Premier League', short: 'EPL', path: 'soccer/eng.1', sp: 'sc', kLine: 12, games: 38, lg: 1.42, top: 4, rel: 3, range: [-4, 10], rateMax: 1 },
    { id: 'laliga', kLine: 12, name: 'LaLiga', path: 'soccer/esp.1', sp: 'sc', games: 38, lg: 1.30, top: 4, rel: 3, range: [-4, 10], rateMax: 1 },
    { id: 'seriea', kLine: 12, name: 'Serie A', path: 'soccer/ita.1', sp: 'sc', games: 38, lg: 1.32, top: 4, rel: 3, range: [-4, 10], rateMax: 1 },
    { id: 'bund', kLine: 12, name: 'Bundesliga', path: 'soccer/ger.1', sp: 'sc', games: 34, lg: 1.55, top: 4, rel: 3, range: [-4, 10], rateMax: 1 },
    { id: 'ligue1', kLine: 12, name: 'Ligue 1', path: 'soccer/fra.1', sp: 'sc', games: 34, lg: 1.40, top: 3, rel: 3, range: [-4, 10], rateMax: 1 },
    { id: 'mls', kLine: 12, name: 'MLS', path: 'soccer/usa.1', sp: 'sc', games: 34, lg: 1.50, playoffN: 9, grp: 'conf', range: [-3, 7], rateMax: 1 },
    { id: 'ucl', kLine: 12, name: 'Champions League', short: 'UCL', path: 'soccer/uefa.champions', sp: 'sc', games: 8, lg: 1.45, noStandings: true, range: [-4, 14], rateMax: 1 }
  ];
  const LG = Object.fromEntries(LEAGUES.map(l => [l.id, l]));
  const EXTRAS = [{ id: 'tennis', name: 'Tennis' }, { id: 'ufc', name: 'UFC' }, { id: 'golf', name: 'Golf' }];
  const SITE_URL = 'https://bsilva87921.github.io/live-sports-lab/';
  const ESPN = 'https://site.web.api.espn.com/apis/site/v2/sports/';
  const ESPN2 = 'https://site.web.api.espn.com/apis/v2/sports/';
  const kindOf = id => PM.SP[LG[id].sp].kind;
  Object.assign(APP, { LEAGUES, LG, EXTRAS, SITE_URL, kindOf });

  /* ---------- state ---------- */
  const S = APP.S = {
    mode: 'loading', capturedAt: null, lastUpdate: null, nextAt: 0, auto: true, timer: null,
    league: 'all', tab: 'board', lastSpecific: null,
    data: {}, extras: {}, colors: {}, hist: new Map(), cache: new Map(),
    sample: null, standingsAt: 0, errors: {}
  };
  for (const l of LEAGUES) S.data[l.id] = { games: [], standings: [], priors: null, stVer: 0 };

  /* ---------- utils ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { if (v == null) return NaN; if (typeof v === 'number') return v; const s = String(v).trim(); if (/^even$/i.test(s)) return 100; const n = parseFloat(s.replace(/[^0-9.+-]/g, '')); return n; };
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function pct(p) { if (!isFinite(p)) return '—'; const v = p * 100; if (v > 0 && v < 1) return '<1%'; if (v < 100 && v > 99) return '>99%'; return Math.round(v) + '%'; }
  function pct1(p) { return isFinite(p) ? (p * 100).toFixed(1) + '%' : '—'; }
  function dpts(d) { if (!isFinite(d) || Math.abs(d) < 0.0005) return '<span class="muted">±0.0</span>'; const v = (d * 100).toFixed(1); return d > 0 ? `<span class="delta-up">▲ ${v}</span>` : `<span class="delta-dn">▼ ${Math.abs(v).toFixed(1)}</span>`; }
  function mmss(sec) { sec = Math.max(0, Math.round(sec || 0)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function ord(n) { n = +n; const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function dayKey(d) { return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
  function when(iso) {
    const d = new Date(iso); if (isNaN(d)) return '';
    const now = new Date(), tm = new Date(now.getTime() + 864e5), ym = new Date(now.getTime() - 864e5);
    const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (dayKey(d) === dayKey(now)) return 'Today ' + t;
    if (dayKey(d) === dayKey(tm)) return 'Tomorrow ' + t;
    if (dayKey(d) === dayKey(ym)) return 'Yesterday ' + t;
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + t;
  }
  function dateShort(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }); }
  function hexToRgb(h) { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return isNaN(n) ? [120, 120, 120] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lum(rgb) { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); }
  function textOn(hex) { return lum(hexToRgb(hex)) > 0.36 ? '#0B1220' : '#FFFFFF'; }
  function hashColor(key) { const h = hash(key); const hue = h % 360, s = 48 + (h >> 9) % 20, l = 30 + (h >> 14) % 16; return hsl2hex(hue, s, l); }
  function hsl2hex(h, s, l) { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l); const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); }
  function teamColor(lg, t) { return (t && t.color) || S.colors[lg + '|' + (t && t.abbr)] || hashColor(lg + '|' + (t && t.abbr)); }
  function badge(lg, t, cls) { const c = teamColor(lg, t); return `<span class="badge ${cls || ''}" style="background:${c};color:${textOn(c)};box-shadow:inset 0 0 0 1px rgba(127,127,127,.25)">${esc(t.abbr)}</span>`; }
  const MULTI = ['Red Sox', 'White Sox', 'Blue Jays', 'Maple Leafs', 'Golden Knights', 'Blue Jackets', 'Red Wings', 'Trail Blazers', 'Red Bulls'];
  function shortName(t, lgId) {
    if (t.short && t.short !== t.name && t.short.length <= 18) return t.short;
    const n = t.name || t.abbr, k = lgId ? PM.SP[LG[lgId].sp].kind : '';
    if (!lgId || lgId === 'ncaaf' || k === 'sc') return n;
    for (const m of MULTI) if (n.endsWith(' ' + m)) return m;
    const parts = n.split(' '); return parts.length > 1 ? parts[parts.length - 1] : n;
  }
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } };
  Object.assign(APP, { esc, pct, pct1, dpts, mmss, ord, when, dateShort, textOn, teamColor, badge, shortName, norm, lsGet, lsSet, hexToRgb, lum });

  /* ---------- snapshot ---------- */
  const TEAMS = {};
  function parseTeams() {
    for (const [lg, str] of Object.entries(SNAPSHOT.teams)) {
      TEAMS[lg] = {};
      for (const e of str.split(';')) { const [abbr, name, hex] = e.split('|'); TEAMS[lg][abbr] = { name, color: hex ? '#' + hex : null }; }
    }
  }
  function priorNets(lgId, rows) {
    const sp = PM.SP[LG[lgId].sp], out = {}, byName = {};
    for (const r of rows) {
      const gp = r.w + r.l + (r.t || 0), p = clamp((r.w + 0.5 * (r.t || 0) + 4) / ((lgId === 'nhl' ? 82 : gp) + 8), 0.05, 0.95);
      const net = sp.sigma * PM.math.PhiInv(p);
      out[r.abbr] = net; byName[norm(TEAMS[lgId]?.[r.abbr]?.name || r.abbr)] = net;
    }
    return { byKey: out, byName };
  }
  // team names/colors and last-season priors are useful in both modes
  function loadStatic() {
    if (Object.keys(TEAMS).length) return;
    parseTeams();
    for (const [lg, T] of Object.entries(TEAMS)) for (const [ab, t] of Object.entries(T)) if (t.color) S.colors[lg + '|' + ab] = t.color;
    for (const [lg, str] of Object.entries(SNAPSHOT.priors)) {
      const rows = str.split(';').map(e => { const [abbr, w, l] = e.split('|'); return { abbr, w: +w, l: +l }; });
      S.data[lg].priorsByName = priorNets(lg, rows).byName;
    }
  }
  function loadSnapshot() {
    loadStatic();
    for (const l of LEAGUES) Object.assign(S.data[l.id], { games: [], standings: [], priors: null, stVer: (S.data[l.id].stVer || 0) + 1, ratings: null });
    for (const row of SNAPSHOT.games) {
      const [lg, id, start, a, h, state, as, hs, detail, x0] = row, x = x0 || {};
      const mk = (abbr, sc) => ({ abbr, id: abbr, name: TEAMS[lg]?.[abbr]?.name || abbr, color: TEAMS[lg]?.[abbr]?.color || null, score: sc });
      const g = { id, lg, start, state, detail, home: mk(h, hs), away: mk(a, as), note: x.note || '', capture: state === 'in', sit: {}, playoff: !!x.playoff };
      if (x.line) g.line = { src: 'Sportradar pregame', pH: x.line.h / 100, pA: x.line.a / 100, pD: x.line.d != null ? x.line.d / 100 : undefined };
      if (kindOf(lg) === 'bb' && state === 'in') { g.sit = { inning: x.inning, half: x.half, outs: x.outs || 0, b1: 0, b2: 0, b3: 0 }; g.period = x.inning; }
      if (kindOf(lg) === 'fb' && state === 'in') { g.period = x.period; g.clock = x.clock; }
      if (state === 'post') { g.home.winner = hs > as; g.away.winner = as > hs; }
      S.data[lg].games.push(g);
    }
    for (const [lg, str] of Object.entries(SNAPSHOT.standings)) {
      S.data[lg].standings = str.split(';').map(e => {
        const [group, abbr, w, l, t, pts, flag] = e.split('|');
        const W = +w, L = +l, T = +t || 0;
        return { key: abbr, abbr, name: TEAMS[lg]?.[abbr]?.name || abbr, color: TEAMS[lg]?.[abbr]?.color || null, group, w: W, l: L, t: T, pts: pts ? +pts : undefined, gp: W + L + T, flag: flag || '' };
      });
    }
    for (const [lg, str] of Object.entries(SNAPSHOT.priors)) {
      const rows = str.split(';').map(e => { const [abbr, w, l] = e.split('|'); return { abbr, w: +w, l: +l }; });
      const groups = {}; for (const part of SNAPSHOT.groups[lg].split(';')) { const [gname, list] = part.split(':'); for (const ab of list.split(',')) groups[ab] = gname; }
      const pr = priorNets(lg, rows);
      S.data[lg].priors = pr.byKey; S.data[lg].priorsByName = pr.byName;
      S.data[lg].standings = rows.map(r => ({ key: r.abbr, abbr: r.abbr, name: TEAMS[lg]?.[r.abbr]?.name || r.abbr, color: TEAMS[lg]?.[r.abbr]?.color || null, group: groups[r.abbr] || '', w: 0, l: 0, t: 0, gp: 0, last: r.w + '-' + r.l }));
    }
    // tennis / ufc
    S.extras.tennis = SNAPSHOT.tennis.map(([tour, A, B, state, sa, sb, note]) => ({ tour, a: A, b: B, state, sa, sb, note }));
    S.extras.ufc = SNAPSHOT.ufc;
    S.extras.golf = null;
    S.capturedAt = SNAPSHOT.capturedAt;
    S.mode = 'snapshot';
    // pregame → capture history for games in progress at capture time
    for (const d of Object.values(S.data)) for (const g of d.games) if (g.state === 'in') {
      const P = APP.predict(g); S.hist.set(g.id, [[+new Date(g.start), P.pre.pH], [+new Date(S.capturedAt), P.now.pH]]);
    }
  }

  /* ---------- ESPN live ---------- */
  async function fetchJSON(url, ms) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms || 9000);
    try { const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
    finally { clearTimeout(t); }
  }
  function ymd(d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
  function sbURL(lg) {
    const q = [];
    if (lg.q) q.push(lg.q);
    if (lg.range) { const n = Date.now(); q.push('dates=' + ymd(new Date(n + lg.range[0] * 864e5)) + '-' + ymd(new Date(n + lg.range[1] * 864e5))); q.push('limit=300'); }
    return ESPN + lg.path + '/scoreboard' + (q.length ? '?' + q.join('&') : '');
  }
  function parseClock(s) { if (s == null) return NaN; const m = String(s).match(/(\d+):(\d+)/); return m ? +m[1] * 60 + +m[2] : parseFloat(s); }
  function parseOdds(od, g, kind) {
    if (!od) return null;
    const L = { src: (od.provider && od.provider.name) || 'Market' };
    const pick = (...vals) => { for (const v of vals) { const n = num(v); if (isFinite(n) && n !== 0) return n; } return NaN; };
    const mlH = pick(od.moneyline?.home?.close?.odds, od.moneyline?.home?.open?.odds, od.homeTeamOdds?.moneyLine);
    const mlA = pick(od.moneyline?.away?.close?.odds, od.moneyline?.away?.open?.odds, od.awayTeamOdds?.moneyLine);
    const mlD = pick(od.moneyline?.draw?.close?.odds, od.drawOdds?.moneyLine);
    const imp = ml => ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100);
    if (isFinite(mlH) && isFinite(mlA)) { const iH = imp(mlH), iA = imp(mlA), iD = isFinite(mlD) ? imp(mlD) : 0, s = iH + iA + iD; L.pH = iH / s; L.pA = iA / s; if (iD) L.pD = iD / s; }
    const det = String(od.details || '').trim();
    const m = det.match(/^(\S+)\s+([+-]?\d+(?:\.\d+)?)$/);
    if (m && (kind === 'fb' || kind === 'bk')) { const line = Math.abs(+m[2]); if (m[1] === g.home.abbr) L.spread = line; else if (m[1] === g.away.abbr) L.spread = -line; }
    else if (/^(even|pk|pick)/i.test(det) && (kind === 'fb' || kind === 'bk')) L.spread = 0;
    const ou = num(od.overUnder); if (isFinite(ou) && ou > 0) L.total = ou;
    L.text = det;
    return (isFinite(L.pH) || isFinite(L.spread)) ? L : null;
  }
  function soccerMinute(st) {
    const ty = st.type || {};
    if (/HALFTIME/i.test(ty.name || '') || /^HT$/i.test(ty.shortDetail || '')) return 45;
    const m = String(st.displayClock || ty.shortDetail || '').match(/(\d+)'(?:\s*\+\s*(\d+))?/);
    if (m) return +m[1] + (m[2] ? +m[2] : 0);
    if (isFinite(st.clock) && st.clock > 0) return Math.round(st.clock / 60);
    return 0;
  }
  function parseEvent(lg, ev) {
    const comp = ev.competitions && ev.competitions[0]; if (!comp) return null;
    const cs = comp.competitors || [];
    const H = cs.find(c => c.homeAway === 'home') || cs[0], A = cs.find(c => c.homeAway === 'away') || cs[1];
    if (!H || !A) return null;
    const st = comp.status || ev.status || {}, ty = st.type || {};
    const kind = kindOf(lg.id);
    const team = c => ({
      id: String(c.team?.id || c.id || ''), abbr: c.team?.abbreviation || (c.team?.name || '?').slice(0, 3).toUpperCase(),
      name: c.team?.displayName || c.team?.name || '?', short: c.team?.shortDisplayName || c.team?.name || '',
      color: c.team?.color ? '#' + c.team.color : null, score: c.score != null && c.score !== '' ? +c.score : null,
      record: (c.records && c.records[0] && c.records[0].summary) || '', rank: c.curatedRank && c.curatedRank.current < 99 ? c.curatedRank.current : null, winner: !!c.winner
    });
    const g = {
      id: String(ev.id), lg: lg.id, start: ev.date, state: ty.completed ? 'post' : (ty.state || 'pre'),
      detail: ty.shortDetail || ty.detail || '', period: st.period || 0, clock: isFinite(st.clock) ? +st.clock : parseClock(st.displayClock),
      home: team(H), away: team(A), neutral: !!comp.neutralSite, note: (comp.notes && comp.notes[0] && comp.notes[0].headline) || '',
      venue: comp.venue?.fullName || '', sit: {}, playoff: ev.season?.type === 3
    };
    if (/postponed|canceled|cancelled|suspended|delayed/i.test(ty.name || '') && g.state !== 'in') { g.state = 'post'; g.void = true; }
    const sit = comp.situation;
    if (kind === 'fb' && sit && g.state === 'in') {
      const possId = String(sit.possession || '');
      const poss = possId && possId === g.home.id ? 'home' : possId && possId === g.away.id ? 'away' : null;
      let yl = NaN;
      const txt = sit.possessionText || (sit.downDistanceText || '').replace(/^.*\bat\s+/i, '');
      const mm = String(txt).match(/([A-Z&]{2,5})\s+(\d{1,2})$/), mid = /\b50\b/.test(txt) && !mm;
      const possAbbr = poss ? g[poss].abbr : null;
      if (mm && possAbbr) yl = mm[1] === possAbbr ? +mm[2] : 100 - +mm[2];
      else if (mid) yl = 50;
      g.sit = { poss, down: +sit.down || null, dist: +sit.distance || null, yl, text: sit.downDistanceText || sit.shortDownDistanceText || '', redzone: !!sit.isRedZone };
    }
    if (kind === 'bk' && sit && g.state === 'in') { const possId = String(sit.possession || ''); g.sit = { poss: possId && possId === g.home.id ? 'home' : possId && possId === g.away.id ? 'away' : null }; }
    if (kind === 'bb' && g.state === 'in') {
      const d = String(ty.shortDetail || ty.detail || '');
      let half = /^top/i.test(d) ? 'top' : /^(bot|bottom)/i.test(d) ? 'bot' : /^mid/i.test(d) ? 'bot' : /^end/i.test(d) ? 'endhalf' : 'top';
      let inning = st.period || parseInt((d.match(/(\d+)/) || [])[1], 10) || 1, outs = sit ? +sit.outs || 0 : 0;
      if (half === 'endhalf') { half = 'top'; inning += 1; outs = 0; }
      if (/^mid/i.test(d)) outs = 0;
      g.sit = { inning, half, outs: clamp(outs, 0, 2), b1: sit && sit.onFirst ? 1 : 0, b2: sit && sit.onSecond ? 1 : 0, b3: sit && sit.onThird ? 1 : 0, balls: sit?.balls, strikes: sit?.strikes };
    }
    if (kind === 'sc') {
      let rh = 0, ra = 0;
      for (const d of comp.details || []) if (d.redCard) { const tid = String(d.team?.id || ''); if (tid === g.home.id) rh++; else if (tid === g.away.id) ra++; }
      g.sit = { minute: g.state === 'in' ? soccerMinute(st) : 0, redH: rh, redA: ra };
    }
    const pr = sit && sit.lastPlay && sit.lastPlay.probability;
    if (pr && isFinite(pr.homeWinPercentage) && g.state === 'in') g.espnWP = { pH: +pr.homeWinPercentage, pA: +pr.awayWinPercentage, pT: +pr.tiePercentage || 0 };
    if (comp.odds && comp.odds.length) g.line = parseOdds(comp.odds[0], g, kind);
    if (g.state === 'post' && !g.void) { if (!g.home.winner && !g.away.winner && g.home.score != null) { g.home.winner = g.home.score > g.away.score; g.away.winner = g.away.score > g.home.score; } }
    return g;
  }
  function recOf(txt) { const m = String(txt || '').match(/^(\d+)-(\d+)(?:-(\d+))?$/); return m ? [+m[1], +m[2], m[3] ? +m[3] : 0] : null; }
  function statMap(e) {
    const s = {};
    for (const x of e.stats || []) {
      const rec = recOf(x.summary || x.displayValue), ty = String(x.type || '').toLowerCase();
      if (rec && (ty === 'home' || ty === 'road' || ty === 'away' || ty === 'lasttengames' || ty === 'vsdiv' || ty === 'vsconf')) { s['rec_' + (ty === 'away' ? 'road' : ty)] = rec; continue; }
      if (rec && ty === 'total') { if (!s.rec_total) s.rec_total = rec; continue; }
      // college standings repeat every stat per split (home, away, vs conference, vs ranked…): keep the overall value
      const split = /^(homerecord|awayrecord|vsdivision|vsconf|vsaprankedteams|vsusarankedteams)_/.test(ty);
      const v = isFinite(x.value) ? +x.value : num(x.displayValue); if (x.name && !(split && x.name in s)) s[x.name] = v; if (x.type && !(x.type in s)) s[x.type] = v;
      if (x.name === 'streak' || x.type === 'streak') s.streakText = x.displayValue;
      if (x.name === 'clincher' || x.type === 'clincher') s.clinchText = x.displayValue;
    }
    return s;
  }
  function parseStandings(lg, js) {
    const rows = [];
    const walk = (node, group) => {
      if (node.standings && node.standings.entries) for (const e of node.standings.entries) {
        const s = statMap(e), t = e.team || {};
        let w = s.wins || 0, l = s.losses || 0, ties = s.ties || 0; const otl = s.otLosses || s.overtimeLosses || 0;
        if (s.losses == null && s.rec_total) { w = s.rec_total[0]; l = s.rec_total[1]; ties = s.rec_total[2] || 0; }
        const gp = s.gamesPlayed || (w + l + ties + otl);
        let pf = s.pointsFor, pa = s.pointsAgainst;
        if (!isFinite(pf) && isFinite(s.avgPointsFor)) pf = s.avgPointsFor * gp;
        if (!isFinite(pa) && isFinite(s.avgPointsAgainst)) pa = s.avgPointsAgainst * gp;
        const clinch = /^[a-z*]{1,2}$/i.test(String(s.clinchText || '').trim()) ? String(s.clinchText).trim() : '';
        rows.push({ key: t.abbreviation, abbr: t.abbreviation, id: String(t.id || ''), name: t.displayName || t.name, color: S.colors[lg.id + '|' + t.abbreviation] || (t.color ? '#' + t.color : null), group: shortGroup(group), w, l, t: kindOf(lg.id) === 'hk' ? otl : ties, otl, gp, pf: gp ? pf : NaN, pa: gp ? pa : NaN, pts: s.points, streak: s.streakText || '', seed: s.playoffSeed || s.rank, clinch, home: s.rec_home || null, road: s.rec_road || null, l10: s.rec_lasttengames || null });
      }
      for (const ch of node.children || []) walk(ch, lg.id === 'ncaaf' ? (depth(node) === 0 ? confName(ch.name || ch.abbreviation) : group) : (ch.abbreviation || ch.name || group));
    };
    // college: conferences sit under the FBS root, divisions under a conference (label every team with its conference)
    const depth = n => n === js ? 0 : 1;
    walk(js, lg.id === 'ncaaf' && js.parent == null && /fbs|subdivision/i.test(js.name || '') ? '' : lg.id === 'ncaaf' ? confName(js.name) : (js.abbreviation || js.name || ''));
    return rows.filter(r => r.key);
  }
  const CONF = { 'Atlantic Coast Conference': 'ACC', 'Southeastern Conference': 'SEC', 'Big Ten Conference': 'Big Ten', 'Big 12 Conference': 'Big 12', 'American Conference': 'American', 'American Athletic Conference': 'American', 'Conference USA': 'C-USA', 'Mid-American Conference': 'MAC', 'Mountain West Conference': 'Mountain West', 'Pac-12 Conference': 'Pac-12', 'Sun Belt Conference': 'Sun Belt', 'FBS Independents': 'FBS Indep.' };
  const confName = n => CONF[n] || String(n || '').replace(/ Conference$/i, '');
  function shortGroup(g) {
    const s = String(g || '');
    if (/american football/i.test(s)) return 'AFC'; if (/national football/i.test(s)) return 'NFC';
    if (/^american league$/i.test(s)) return 'AL'; if (/^national league$/i.test(s)) return 'NL';
    return s.replace(/ Conference$/i, '');
  }
  // ESPN now rejects date-range scoreboard requests (HTTP 400): fetch day by day and merge.
  // Today is fetched every refresh; other days are cached for 10 minutes. One league probes the
  // range request first (the rest wait for its answer), and a rejection is remembered for a week.
  const DAYC = new Map(), RKEY = 'probable-espn-range';
  let rangeState = (() => { try { const t = +localStorage.getItem(RKEY); return t && Date.now() - t < 7 * 864e5 ? 'no' : 'unknown'; } catch (e) { return 'unknown'; } })(), rangeProbe = null;
  async function scoreboardJSON(lg) {
    if (!lg.range) return fetchJSON(sbURL(lg));
    if (rangeState === 'unknown' && rangeProbe) await rangeProbe.catch(() => { });
    if (rangeState !== 'no') {
      const p = fetchJSON(sbURL(lg)); if (rangeState === 'unknown' && !rangeProbe) rangeProbe = p;
      try { const js = await p; rangeState = 'yes'; return js; }
      catch (e) { if (!/HTTP 4/.test(String(e && e.message))) throw e; rangeState = 'no'; try { localStorage.setItem(RKEY, String(Date.now())); } catch (er) { /* storage unavailable */ } }
    }
    const n = Date.now(), today = ymd(new Date(n)), days = [];
    for (let d = lg.range[0]; d <= lg.range[1]; d++) days.push(ymd(new Date(n + d * 864e5)));
    const base = ESPN + lg.path + '/scoreboard?' + (lg.q ? lg.q + '&' : '') + 'dates=';
    const res = await Promise.allSettled(days.map(async day => {
      const k = lg.id + '|' + day, c = DAYC.get(k);
      if (day !== today && c && n - c.t < 10 * 60e3) return c.js;
      const js = await fetchJSON(base + day); DAYC.set(k, { t: n, js }); return js;
    }));
    const ok = res.filter(r => r.status === 'fulfilled').map(r => r.value);
    if (!ok.length) throw res[0].reason;
    const seen = new Map(); for (const js of ok) for (const ev of js.events || []) seen.set(String(ev.id), ev);
    const first = ok.find(js => js.season || js.leagues) || ok[0];
    return { events: [...seen.values()], season: first.season, leagues: first.leagues };
  }
  async function loadLeagueLive(lg) {
    const js = await scoreboardJSON(lg);
    const games = (js.events || []).map(ev => { try { return parseEvent(lg, ev); } catch (e) { return null; } }).filter(Boolean);
    S.data[lg.id].games = games; S.data[lg.id].fetchedAt = Date.now(); delete S.errors[lg.id];
    const se = js.season || (js.leagues && js.leagues[0] && js.leagues[0].season) || null;
    if (se && se.year) S.data[lg.id].season = { year: +se.year, type: +(se.type && typeof se.type === 'object' ? se.type.type : se.type) || 0 };
    for (const g of games) for (const t of [g.home, g.away]) if (t.color) S.colors[lg.id + '|' + t.abbr] = t.color;
    return games.length;
  }
  async function loadStandingsLive(lg) {
    if (lg.noStandings) return;
    const js = await fetchJSON(ESPN2 + lg.path + '/standings?region=us&lang=en&contentorigin=espn');
    const rows = parseStandings(lg, js);
    if (rows.length) {
      const d = S.data[lg.id]; d.standings = rows; d.stVer++; d.ratings = null;
      if (d.priorsByName) { d.priors = {}; for (const r of rows) { const v = d.priorsByName[norm(r.name)]; if (isFinite(v)) d.priors[r.key] = v; } }
    }
  }
  function parseTennis(js) {
    const out = [];
    for (const ev of js.events || []) for (const gr of ev.groupings || [{ competitions: ev.competitions || [] }]) for (const c of gr.competitions || []) {
      const cs = c.competitors || []; if (cs.length < 2) continue;
      const nm = x => x.athlete?.displayName || x.team?.displayName || x.roster?.shortDisplayName || '—';
      const sets = x => (x.linescores || []).map(l => +l.value);
      const state = c.status?.type?.state || 'pre';
      if (!/singles/i.test(gr.grouping?.displayName || gr.grouping?.slug || 'singles') && out.length > 20) continue;
      out.push({ tour: ev.shortName || ev.name, a: nm(cs[0]), b: nm(cs[1]), state, sa: sets(cs[0]), sb: sets(cs[1]), winA: !!cs[0].winner, winB: !!cs[1].winner, note: c.round?.displayName || gr.grouping?.displayName || '', detail: c.status?.type?.detail || '' });
    }
    return out;
  }
  async function loadExtrasLive() {
    const tasks = [];
    tasks.push(Promise.allSettled(['tennis/atp', 'tennis/wta'].map(p => fetchJSON(ESPN + p + '/scoreboard'))).then(rs => {
      const m = []; for (const r of rs) if (r.status === 'fulfilled') m.push(...parseTennis(r.value));
      const rank = x => x.state === 'in' ? 0 : x.state === 'post' ? 1 : 2;
      S.extras.tennis = m.sort((x, y) => rank(x) - rank(y)).slice(0, 10);
    }));
    tasks.push(fetchJSON(ESPN + 'mma/ufc/scoreboard').then(js => {
      const ev = (js.events || [])[0]; if (!ev) { S.extras.ufc = null; return; }
      const fights = (ev.competitions || []).map(c => {
        const cs = c.competitors || []; const nm = x => x?.athlete?.displayName || '—';
        const w = cs.find(x => x.winner);
        return [nm(cs[0]), nm(cs[1]), c.type?.abbreviation || c.type?.text || '', w ? nm(w) + (c.status?.type?.detail ? ' · ' + c.status.type.detail : '') : (c.status?.type?.state === 'in' ? 'In progress' : ''), cs[0]?.records?.[0]?.summary || '', cs[1]?.records?.[0]?.summary || ''];
      }).reverse();
      const done = (ev.status?.type?.state || '') === 'post';
      S.extras.ufc = done ? { last: { name: ev.name, date: ev.date, fights: fights.slice(0, 6) } } : { next: { name: ev.name, date: ev.date, fights: fights.slice(0, 6), state: ev.status?.type?.state } };
    }).catch(() => { }));
    tasks.push(fetchJSON(ESPN + 'golf/pga/scoreboard').then(js => {
      const ev = (js.events || [])[0]; if (!ev) { S.extras.golf = null; return; }
      const comp = ev.competitions?.[0]; const cs = (comp?.competitors || []).slice().sort((a, b) => (a.order || 999) - (b.order || 999));
      const toPar = s => { const t = String(s?.displayValue ?? s ?? '').trim(); if (/^e$/i.test(t)) return 0; const n = parseFloat(t); return isFinite(n) ? n : NaN; };
      const rounds = Math.max(4, ...(cs.map(c => (c.linescores || []).length)));
      const players = cs.slice(0, 30).map(c => {
        let holes = 0; for (const r of c.linescores || []) holes += (r.linescores || []).length || (isFinite(r.value) && r.value > 50 ? 18 : 0);
        return { name: c.athlete?.displayName || '—', toPar: toPar(c.score), holesLeft: Math.max(0, rounds * 18 - holes), holes };
      }).filter(p => isFinite(p.toPar));
      const state = ev.status?.type?.state || comp?.status?.type?.state || 'pre';
      let win = null;
      if (state === 'in' && players.length > 3 && players.some(p => p.holes > 0)) win = PM.golfSim(players, 4000, 17);
      S.extras.golf = { name: ev.name, state, detail: ev.status?.type?.detail || '', players: players.slice(0, 8), win: win ? win.slice(0, 8) : null };
    }).catch(() => { S.extras.golf = null; }));
    await Promise.allSettled(tasks);
  }
  async function probe() {
    try { await loadLeagueLive(LG.nfl); return true; }
    catch (e) { try { await loadLeagueLive(LG.mlb); return true; } catch (e2) { return false; } }
  }
  async function refreshLive(first) {
    const tasks = LEAGUES.filter(l => !(first && l.id === 'nfl')).map(l => loadLeagueLive(l).catch(err => { S.errors[l.id] = String(err && err.message || err); }));
    if (first || Date.now() - S.standingsAt > 15 * 60e3) {
      tasks.push(...LEAGUES.map(l => loadStandingsLive(l).catch(() => { })));
      S.standingsAt = Date.now();
    }
    tasks.push(loadExtrasLive());
    await Promise.allSettled(tasks);
    S.lastUpdate = Date.now();
    recordHistory();
  }
  function recordHistory() {
    const now = Date.now();
    for (const d of Object.values(S.data)) for (const g of d.games) {
      if (g.state !== 'in') continue;
      const P = APP.predict(g); const h = S.hist.get(g.id) || [];
      if (!h.length) h.push([Math.min(+new Date(g.start) || now, now - 60e3), P.pre.pH]);
      const last = h[h.length - 1];
      if (!last || Math.abs(last[1] - P.now.pH) > 0.0005 || now - last[0] > 5 * 60e3) h.push([now, P.now.pH]);
      if (h.length > 400) h.splice(1, h.length - 400);
      S.hist.set(g.id, h);
    }
  }
  async function loadSummary(g) {
    const lg = LG[g.lg];
    return fetchJSON(ESPN + lg.path + '/summary?event=' + encodeURIComponent(g.id), 10000);
  }
  Object.assign(APP, { loadSnapshot, loadStatic, probe, refreshLive, loadSummary, fetchJSON, TEAMS, parseStandings, parseEvent, priorNets, recOf, ESPN, ESPN2, num });

  /* ---------- model glue ---------- */
  function ratingsFor(lgId) {
    const d = S.data[lgId], lg = LG[lgId]; if (!d || lg.noStandings) return null;
    if (d.ratings && d.ratings.ver === d.stVer) return d.ratings;
    const sp = PM.SP[lg.sp];
    const rows = (d.standings || []).map(r => ({ key: r.key, gp: r.gp, w: r.w, l: r.l, t: kindOf(lgId) === 'hk' ? 0 : r.t, pf: r.pf, pa: r.pa, pts: r.pts }));
    if (!rows.length) return null;
    const R = PM.rateLeague(sp, rows, d.priors || null, lg.lg);
    R.ver = d.stVer; d.ratings = R; return R;
  }
  const usable = x => x && (x.gp > 0 || x.source === 'prior');
  function expFor(lgId, homeKey, awayKey, line, o) {
    const lg = LG[lgId], sp = PM.SP[lg.sp], R = ratingsFor(lgId);
    const lgv = R ? R.lg : (lg.lg || sp.lg);
    const h = R && R.teams[homeKey], a = R && R.teams[awayKey];
    let ex = null, src = 'none', w = null;
    const exM = usable(h) && usable(a) ? PM.expect(sp, lgv, h, a, o) : null;
    const exL = line ? PM.fromLine(sp, lgv, line, o) : null;
    if (exM && exL) {
      // early in a season a record says little: lean on the line, trust ratings more as games accumulate
      const K = lg.kLine || 12, g = x => x.gp > 0 ? x.gp : (x.source === 'prior' ? K * 0.5 : 0), gm = Math.min(g(h), g(a));
      w = gm / (gm + K);
      ex = { eH: w * exM.eH + (1 - w) * exL.eH, eA: w * exM.eA + (1 - w) * exL.eA }; ex.mu = ex.eH - ex.eA; ex.total = ex.eH + ex.eA; src = 'blend';
    } else if (exM) { ex = exM; src = 'model'; }
    else if (exL) { ex = exL; src = 'line'; }
    if (!ex) ex = PM.expect(sp, lgv, null, null, o);
    ex.lg = lgv; ex.src = src; ex.w = w;
    return ex;
  }
  function baseState(kind) {
    switch (kind) {
      case 'fb': case 'bk': return { hs: 0, as: 0, period: 1, clock: kind === 'fb' ? 900 : 0, poss: null, down: 1, dist: 10, yl: 25 };
      case 'bb': return { hs: 0, as: 0, inning: 1, half: 'top', outs: 0, b1: 0, b2: 0, b3: 0 };
      case 'hk': return { hs: 0, as: 0, period: 1, clock: 1200, pp: null, ppSec: 0, en: null };
      case 'sc': return { hs: 0, as: 0, minute: 0, redH: 0, redA: 0 };
    }
  }
  function fixBase(lgId, st) { const sp = PM.SP[LG[lgId].sp]; if (sp.kind === 'bk' && st.period === 1 && !st.clock) st.clock = sp.perLen; return st; }
  function stateFrom(g) {
    const kind = kindOf(g.lg), sp = PM.SP[LG[g.lg].sp];
    if (g.state === 'pre') return fixBase(g.lg, baseState(kind));
    const hs = +g.home.score || 0, as = +g.away.score || 0, x = g.sit || {};
    switch (kind) {
      case 'fb': case 'bk': return { hs, as, period: g.period || 1, clock: isFinite(g.clock) ? clamp(g.clock, 0, sp.perLen) : sp.perLen, poss: x.poss || null, down: x.down || 1, dist: x.dist || 10, yl: isFinite(x.yl) ? x.yl : 25 };
      case 'bb': return { hs, as, inning: x.inning || g.period || 1, half: x.half || 'top', outs: x.outs || 0, b1: x.b1 || 0, b2: x.b2 || 0, b3: x.b3 || 0 };
      case 'hk': return { hs, as, period: g.period || 1, clock: isFinite(g.clock) ? g.clock : 1200, pp: null, ppSec: 0, en: null };
      case 'sc': return { hs, as, minute: x.minute || 0, redH: x.redH || 0, redA: x.redA || 0 };
    }
  }
  function evaluate(lgId, st, ex, o) {
    o = o || {};
    const sp = PM.SP[LG[lgId].sp];
    switch (sp.kind) {
      case 'fb': case 'bk': return PM.brownian(sp, st, ex);
      case 'bb': return PM.bbSim(st, ex, o.n || 2500, o.seed || 1234);
      case 'hk': return PM.hkLive(st, ex, { playoff: !!o.playoff });
      case 'sc': return PM.scLive(st, ex);
    }
  }
  function finalRes(g) { const hs = +g.home.score || 0, as = +g.away.score || 0; const kind = kindOf(g.lg); return { pH: hs > as ? 1 : 0, pA: as > hs ? 1 : 0, pD: kind === 'sc' && hs === as ? 1 : 0, fH: hs, fA: as, final: true }; }
  function predict(g) {
    const R = ratingsFor(g.lg); const st = stateFrom(g);
    const key = g.id + '|' + g.state + '|' + JSON.stringify(st) + '|' + (R ? R.ver : '') + '|' + (g.line ? g.line.pH + '/' + g.line.spread : '');
    const c = S.cache.get(g.id); if (c && c.key === key) return c.val;
    const ex = expFor(g.lg, g.home.abbr, g.away.abbr, g.line, { neutral: g.neutral });
    const pre = evaluate(g.lg, fixBase(g.lg, baseState(kindOf(g.lg))), ex, { n: 1200, seed: 99, playoff: g.playoff });
    let now = pre;
    if (g.state === 'in') now = evaluate(g.lg, st, ex, { n: 6000, seed: 7, playoff: g.playoff });
    else if (g.state === 'post') now = finalRes(g);
    const val = { ex, src: ex.src, pre, now, st };
    S.cache.set(g.id, { key, val });
    return val;
  }
  function lineProbs(g) {
    const L = g.line; if (!L) return null;
    if (isFinite(L.pH)) return { pH: L.pH, pA: L.pA, pD: L.pD || 0 };
    if (isFinite(L.spread)) { const sp = PM.SP[LG[g.lg].sp]; const p = Phi(L.spread / Math.sqrt(sp.sigma * sp.sigma + (sp.vEnd || 0))); return { pH: p, pA: 1 - p, pD: 0 }; }
    return null;
  }
  function allGames() { const out = []; for (const l of LEAGUES) out.push(...(S.data[l.id].games || [])); return out; }
  function findGame(id) { for (const l of LEAGUES) { const g = (S.data[l.id].games || []).find(x => x.id === id); if (g) return g; } return null; }
  Object.assign(APP, { ratingsFor, expFor, baseState, fixBase, stateFrom, evaluate, predict, lineProbs, allGames, findGame, usable });
})();
