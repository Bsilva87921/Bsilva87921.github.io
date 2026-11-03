/* ==========================================================================
   Probable — Stats center: season, advanced and historical stats + analytics
   Live: ESPN public APIs (standings, team stats, schedules, leaderboards,
   player logs). Snapshot: whatever SNAPSHOT.stats carries.
   ========================================================================== */
(function () {
  'use strict';
  const PM = window.PM, APP = window.APP, C = APP.charts;
  const { S, LEAGUES, LG, esc, badge, kindOf, mmss } = APP;
  const $ = (s, r) => (r || document).querySelector(s);
  const HOST = 'https://site.web.api.espn.com/apis/';
  const live = () => S.mode === 'live';
  const SNAPX = (typeof SNAPSHOT !== 'undefined' && SNAPSHOT.stats) || null;

  /* ---------------- per-league settings ---------------- */
  const SOC = { soccer: true, close: 1, blow: 3, elo: [20, 60, 1], first: 2003, startYear: true };
  const CFG = {
    nfl: { pyth: 2.37, close: 8, blow: 17, elo: [20, 48, 1], first: 2002 },
    ncaaf: { pyth: 2.37, close: 8, blow: 21, elo: [25, 55, 1], first: 2004, power: 'fpi' },
    mlb: { pyth: 1.83, close: 1, blow: 5, elo: [4, 24, 0], first: 2002 },
    nba: { pyth: 14, close: 5, blow: 15, elo: [20, 100, 1], first: 2003, endYear: true, power: 'bpi' },
    wnba: { pyth: 14, close: 5, blow: 15, elo: [20, 90, 1], first: 2003 },
    nhl: { pyth: 2.05, close: 1, blow: 3, elo: [6, 33, 1], first: 2003, endYear: true, skip: [2005] },
    epl: SOC, laliga: SOC, seriea: SOC, bund: SOC, ligue1: SOC,
    mls: Object.assign({}, SOC, { startYear: false, first: 2004 }),
    ucl: Object.assign({}, SOC)
  };
  CFG.nfl.power = 'fpi';
  const UNIT = { fb: ['Pts', 'Opp'], bk: ['Pts', 'Opp'], bb: ['RS', 'RA'], hk: ['GF', 'GA'], sc: ['GF', 'GA'] };

  /* ---------------- formatting ---------------- */
  const fin = v => typeof v === 'number' && isFinite(v);
  const F = {
    i: v => fin(v) ? Math.round(v).toLocaleString() : '—',
    d1: v => fin(v) ? v.toFixed(1) : '—',
    d2: v => fin(v) ? v.toFixed(2) : '—',
    d3: v => fin(v) ? v.toFixed(3) : '—',
    avg: v => fin(v) ? v.toFixed(3).replace(/^(-?)0\./, '$1.') : '—',
    pc1: v => fin(v) ? v.toFixed(1) + '%' : '—',
    sgn0: v => fin(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v)) : '—',
    sgn1: v => fin(v) ? (Math.abs(v) < 0.05 ? '0.0' : (v > 0 ? '+' : '−') + Math.abs(v).toFixed(1)) : '—',
    sgn2: v => fin(v) ? (Math.abs(v) < 0.005 ? '0.00' : (v > 0 ? '+' : '−') + Math.abs(v).toFixed(2)) : '—',
    mmss: v => fin(v) ? mmss(v) : '—'
  };
  const fmt = (k, v) => (F[k] || F.d1)(v);
  const mean = a => { const b = a.filter(fin); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : NaN; };
  const sdev = a => { const b = a.filter(fin); if (b.length < 2) return NaN; const m = mean(b); return Math.sqrt(b.reduce((s, x) => s + (x - m) * (x - m), 0) / (b.length - 1)); };
  const div = (a, b) => (fin(a) && fin(b) && b !== 0) ? a / b : NaN;
  const z = v => fin(v) ? v : 0;
  const tbf = v => 3 * ipOf(v['pitching.innings']) + v['pitching.hits'] + v['pitching.walks'];
  const ipOf = v => { if (!fin(v)) return NaN; const w = Math.floor(v + 1e-9), f = Math.round((v - w) * 10); return w + (f >= 1 && f <= 2 ? f / 3 : 0); };
  function seasonShort(lgId, y) { const c = CFG[lgId]; if (!c) return String(y); const p = n => String(((n % 100) + 100) % 100).padStart(2, '0'); if (c.endYear) return p(y - 1) + '–' + p(y); if (c.startYear) return p(y) + '–' + p(y + 1); return String(y); }
  function seasonLabel(lgId, y) { const c = CFG[lgId]; if (!c) return String(y); if (c.endYear) return (y - 1) + '–' + String(y).slice(-2); if (c.startYear) return y + '–' + String(y + 1).slice(-2); return String(y); }

  /* ---------------- analytics (pure) ---------------- */
  const A = APP.analytics = {};
  A.pythag = (pf, pa, x) => (pf > 0 || pa > 0) ? Math.pow(pf, x) / (Math.pow(pf, x) + Math.pow(pa, x)) : NaN;
  const pois = (k, l) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };
  A.poissonPts = function (lf, la) {
    let pw = 0, pd = 0;
    for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) { const p = pois(i, lf) * pois(j, la); if (i > j) pw += p; else if (i === j) pd += p; }
    return { pw, pd, xp: 3 * pw + pd };
  };
  A.pearson = function (xs, ys) {
    const n = Math.min(xs.length, ys.length); if (n < 3) return NaN;
    const mx = mean(xs), my = mean(ys); let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
    return sxy / Math.sqrt(sxx * syy);
  };
  // Simple Rating System: rating = margin (home edge removed) + average opponent rating; damped iteration
  A.srs = function (games, hfa) {
    const T = {};
    for (const g of games) {
      const m = g.hs - g.as - (g.neutral ? 0 : hfa);
      (T[g.h] = T[g.h] || { m: 0, n: 0, opp: [] }); (T[g.a] = T[g.a] || { m: 0, n: 0, opp: [] });
      T[g.h].m += m; T[g.h].n++; T[g.h].opp.push(g.a); T[g.a].m -= m; T[g.a].n++; T[g.a].opp.push(g.h);
    }
    const keys = Object.keys(T), mov = {}, r = {};
    for (const k of keys) { mov[k] = T[k].m / T[k].n; r[k] = mov[k]; }
    for (let it = 0; it < 600; it++) {
      let delta = 0; const nr = {};
      for (const k of keys) { let s = 0; for (const o of T[k].opp) s += r[o]; nr[k] = mov[k] + s / T[k].opp.length; }
      const mu = keys.reduce((a, k) => a + nr[k], 0) / keys.length;
      for (const k of keys) { const v = r[k] + 0.5 * (nr[k] - mu - r[k]); delta = Math.max(delta, Math.abs(v - r[k])); r[k] = v; }
      if (delta < 1e-7) break;
    }
    const out = {}; for (const k of keys) out[k] = { srs: r[k], mov: mov[k], sos: r[k] - mov[k], gp: T[k].n };
    return out;
  };
  // Elo with home edge and (optionally) a margin-of-victory multiplier (FiveThirtyEight style)
  A.elo = function (games, e) {
    const [K, HFA, MOV] = e, R = {}, H = {};
    const sorted = games.slice().sort((a, b) => a.t - b.t);
    const t0 = sorted.length ? sorted[0].t - 864e5 : 0;
    const get = k => { if (!(k in R)) { R[k] = 1500; H[k] = [[t0, 1500]]; } return R[k]; };
    for (const g of sorted) {
      const rh = get(g.h), ra = get(g.a), hfa = g.neutral ? 0 : HFA;
      const eh = 1 / (1 + Math.pow(10, -(rh + hfa - ra) / 400));
      const m = g.hs - g.as, sh = m > 0 ? 1 : m < 0 ? 0 : 0.5;
      let mult = 1;
      if (MOV && m !== 0) { const wd = m > 0 ? rh + hfa - ra : ra - rh - hfa; mult = Math.log(Math.abs(m) + 1) * (2.2 / (wd * 0.001 + 2.2)); }
      const d = K * mult * (sh - eh);
      R[g.h] = rh + d; R[g.a] = ra - d;
      H[g.h].push([g.t, R[g.h]]); H[g.a].push([g.t, R[g.a]]);
    }
    return { R, H };
  };
  A.splits = function (games, key, c) {
    const o = { home: [0, 0, 0, 0, 0], road: [0, 0, 0, 0, 0], close: [0, 0, 0], blow: [0, 0], ms: [], res: [] };
    for (const g of games) {
      if (g.h !== key && g.a !== key) continue;
      const home = g.h === key, m = home ? g.hs - g.as : g.as - g.hs, r = m > 0 ? 0 : m < 0 ? 1 : 2;
      const b = g.neutral ? null : home ? o.home : o.road;
      if (b) { b[r]++; b[3] += m; b[4]++; }
      if (Math.abs(m) <= c.close) o.close[r]++;
      if (Math.abs(m) >= c.blow) o.blow[m > 0 ? 0 : 1]++;
      o.ms.push(m); o.res.push({ t: g.t, m, opp: home ? g.a : g.h, oppAbbr: home ? g.aa : g.ha, home, id: g.id, fs: home ? g.hs : g.as, fa: home ? g.as : g.hs });
    }
    o.n = o.ms.length; o.sd = sdev(o.ms);
    const l10 = o.res.slice(-10); o.l10 = [l10.filter(x => x.m > 0).length, l10.filter(x => x.m < 0).length, l10.filter(x => x.m === 0).length]; o.l10m = mean(l10.map(x => x.m));
    let s = 0, t = null; for (let i = o.res.length - 1; i >= 0; i--) { const r = o.res[i].m > 0 ? 'W' : o.res[i].m < 0 ? 'L' : 'D'; if (t === null) t = r; if (r !== t) break; s++; }
    o.streak = t ? t + s : '';
    return o;
  };
  A.homeEdge = function (games) {
    const g = games.filter(x => !x.neutral); if (!g.length) return null;
    const w = g.filter(x => x.hs > x.as).length, d = g.filter(x => x.hs === x.as).length;
    return { n: g.length, hw: w / g.length, hd: d / g.length, hm: mean(g.map(x => x.hs - x.as)), tot: mean(g.map(x => x.hs + x.as)) };
  };

  /* ---------------- data: cached, pooled fetches ---------------- */
  const CACHE = new Map(); let ACTIVE = 0; const QUEUE = [];
  function pool(fn) { return new Promise((res, rej) => { const go = () => { ACTIVE++; fn().then(res, rej).finally(() => { ACTIVE--; const n = QUEUE.shift(); if (n) n(); }); }; if (ACTIVE < 6) go(); else QUEUE.push(go); }); }
  function get(url, ttl) {
    const c = CACHE.get(url), now = Date.now();
    if (c && now - c.t < (ttl || 15 * 60e3)) return c.p;
    const p = pool(() => APP.fetchJSON(url, 15000)); CACHE.set(url, { t: now, p }); p.catch(() => CACHE.delete(url)); return p;
  }
  const DB = new Map();
  function db(lgId, y) { const k = lgId + '|' + y; if (!DB.has(k)) DB.set(k, { lgId, y, boards: {} }); return DB.get(k); }
  function memo(o, key, fn) {
    if (o[key] !== undefined) return Promise.resolve(o[key]);
    if (o['_' + key]) return o['_' + key];
    const p = fn().then(v => { o[key] = v; delete o['_' + key]; return v; }, e => { delete o['_' + key]; throw e; });
    o['_' + key] = p; return p;
  }
  const OLD = { OAK: 'Oakland Raiders', SD: 'San Diego Chargers', STL: 'St. Louis Rams', WSH: 'Washington', LAR: 'Los Angeles Rams', JAX: 'Jacksonville Jaguars' };
  function snapStandings(lgId, y) {
    const s = SNAPX && SNAPX.st && SNAPX.st[lgId] && SNAPX.st[lgId][y]; if (!s) return [];
    const T = APP.TEAMS[lgId] || {}, k = kindOf(lgId), soc = CFG[lgId].soccer;
    return s.split(';').filter(Boolean).map(e => {
      const [abbr, w, l, t, pf, pa, clinch, grp, pts, nm] = e.split('|'), W = +w, L = +l, X = +t || 0;
      return { key: abbr, abbr, id: '', name: (T[abbr] && T[abbr].name) || nm || (lgId === 'nfl' && OLD[abbr]) || abbr, color: (T[abbr] && T[abbr].color) || null, group: grp || '', w: W, l: L, t: X, otl: k === 'hk' ? X : 0, gp: W + L + X, pf: pf === '' || pf == null ? NaN : +pf, pa: pa === '' || pa == null ? NaN : +pa, pts: pts ? +pts : soc ? 3 * W + X : k === 'hk' ? 2 * W + X : undefined, clinch: clinch || '' };
    });
  }
  function loadStandings(lgId, y) {
    return memo(db(lgId, y), 'rows', async () => {
      if (!live()) return snapStandings(lgId, y);
      const js = await get(`${HOST}v2/sports/${LG[lgId].path}/standings?season=${y}&region=us&lang=en&contentorigin=espn`, 20 * 60e3);
      return APP.parseStandings(LG[lgId], js).filter(r => r.key);
    });
  }
  function parseTeamStats(js) {
    const cats = (js && js.results && js.results.stats && js.results.stats.categories) || [];
    const m = {};
    for (const c of cats) for (const s of c.stats || []) {
      const v = fin(s.value) ? +s.value : APP.num(s.displayValue);
      const rec = { v, dv: s.displayValue, lab: s.abbreviation || s.shortDisplayName || s.displayName || s.name, name: s.displayName || s.name, cat: c.displayName || c.name, rank: s.rank || null };
      m[(c.name || '') + '.' + s.name] = rec; if (!(s.name in m)) m[s.name] = rec;
    }
    return m;
  }
  function loadTeamStats(lgId, y, onProg) {
    return memo(db(lgId, y), 'ts', async () => {
      if (!live()) return null;
      const rows = await loadStandings(lgId, y), lg = LG[lgId], ts = {}; let done = 0;
      await Promise.all(rows.map(r => !r.id ? null : get(`${HOST}site/v2/sports/${lg.path}/teams/${r.id}/statistics?season=${y}`, 30 * 60e3)
        .then(js => { const m = parseTeamStats(js); if (Object.keys(m).length) ts[r.key] = m; }).catch(() => { }).finally(() => { done++; if (onProg) onProg(done, rows.length); })));
      return Object.keys(ts).length ? ts : null;
    });
  }
  function parseSchedule(js) {
    const out = [];
    for (const ev of (js && js.events) || []) {
      const c = ev.competitions && ev.competitions[0]; if (!c) continue;
      const st = c.status || ev.status || {}, ty = st.type || {};
      if (!ty.completed || /postponed|cancel|suspend|forfeit/i.test(ty.name || '')) continue;
      const H = (c.competitors || []).find(x => x.homeAway === 'home'), Aw = (c.competitors || []).find(x => x.homeAway === 'away');
      if (!H || !Aw) continue;
      const sc = x => { const s = x.score; if (s == null) return NaN; if (typeof s === 'object') return fin(s.value) ? +s.value : APP.num(s.displayValue); return APP.num(s); };
      const hs = sc(H), as = sc(Aw); if (!fin(hs) || !fin(as)) continue;
      const stype = ev.seasonType ? +(ev.seasonType.type || ev.seasonType.id) : (ev.season && +ev.season.type);
      out.push({ id: String(ev.id), t: +new Date(ev.date), h: String((H.team && H.team.id) || H.id), a: String((Aw.team && Aw.team.id) || Aw.id), ha: (H.team && H.team.abbreviation) || '', aa: (Aw.team && Aw.team.abbreviation) || '', hs, as, neutral: !!c.neutralSite, post: stype === 3 });
    }
    return out;
  }
  function loadGames(lgId, y, onProg) {
    return memo(db(lgId, y), 'games', async () => {
      if (!live()) return null;
      const rows = await loadStandings(lgId, y), lg = LG[lgId], seen = new Map(); let done = 0;
      const qs = CFG[lgId].soccer ? '' : '&seasontype=2';
      await Promise.all(rows.map(r => !r.id ? null : get(`${HOST}site/v2/sports/${lg.path}/teams/${r.id}/schedule?season=${y}${qs}`, 20 * 60e3)
        .then(js => { for (const g of parseSchedule(js)) if (!g.post) seen.set(g.id, g); }).catch(() => { }).finally(() => { done++; if (onProg) onProg(done, rows.length); })));
      let out = [...seen.values()];
      if (lgId === 'ncaaf') { const ids = new Set(rows.map(r => r.id)); out = out.filter(g => ids.has(g.h) && ids.has(g.a)); }
      return out.sort((a, b) => a.t - b.t);
    });
  }
  function loadPower(lgId, y) {
    return memo(db(lgId, y), 'power', async () => {
      const kind = CFG[lgId].power; if (!live() || !kind) return null;
      const js = await get(`${HOST}fitt/v3/sports/${LG[lgId].path}/powerindex?region=us&lang=en&season=${y}`, 30 * 60e3);
      const out = {};
      for (const t of js.teams || []) {
        const cat = (t.categories || []).find(c => c.name === kind); if (!cat || !cat.values) continue;
        const v = cat.values.map(x => x == null ? NaN : +x), tm = t.team || {};
        const rec = { val: v[0] };
        if (kind === 'fpi' && Math.abs(v[1] + v[2] + v[3] - v[0]) < 0.05) Object.assign(rec, { off: v[1], def: v[2], st: v[3] });
        if (kind === 'bpi' && Math.abs(v[2] + v[3] - v[0]) < 0.05) Object.assign(rec, { off: v[2], def: v[3] });
        if (tm.abbreviation) out[tm.abbreviation] = rec; if (tm.id) out['#' + tm.id] = rec;
      }
      return Object.keys(out).length ? out : null;
    });
  }

  // AP Top 25 for college football: the current poll for the current season, the final poll for past ones
  function attachAP(lgId, y, rows) {
    if (lgId !== 'ncaaf') return Promise.resolve(rows);
    const d = db(lgId, y);
    return memo(d, 'ap', async () => {
      const out = {};
      if (!live()) { const a = SNAPX && SNAPX.ap && SNAPX.ap[y]; if (a) for (const r of a.rows) out['k:' + r[1]] = r[0]; return out; }
      try {
        if (y >= seasonNow(lgId)) {
          const js = await get('https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings?region=us&lang=en', 30 * 60e3);
          const ap = (js.rankings || []).find(r => r.type === 'ap') || (js.rankings || [])[0];
          for (const r of (ap && ap.ranks) || []) if (r.team) { out['i:' + r.team.id] = r.current; if (r.team.abbreviation) out['k:' + r.team.abbreviation] = r.current; }
        } else {
          const js = await get(`https://sports.core.api.espn.com/v2/sports/football/leagues/college-football/seasons/${y}/types/3/weeks/1/rankings/1`, 60 * 60e3);
          for (const r of js.ranks || []) { const m = String((r.team && r.team.$ref) || '').match(/teams\/(\d+)/); if (m) out['i:' + m[1]] = r.current; }
        }
      } catch (e) { /* no poll: the column stays empty */ }
      return out;
    }).then(ap => { for (const r of rows) { const v = ap['i:' + r.id] || ap['k:' + r.key]; if (v) r.ap = v; } return rows; }).catch(() => rows);
  }

  /* ---------------- players: leaderboards ---------------- */
  const X = {
    ts: ['TS%', 'pc1', v => 100 * div(v['offensive.avgPoints'], 2 * (v['offensive.avgFieldGoalsAttempted'] + 0.44 * v['offensive.avgFreeThrowsAttempted'])), 'True shooting: points per shooting possession, counting threes and free throws'],
    efg: ['eFG%', 'pc1', v => 100 * div(v['offensive.avgFieldGoalsMade'] + 0.5 * v['offensive.avgThreePointFieldGoalsMade'], v['offensive.avgFieldGoalsAttempted']), 'Effective field goal %: a three counts 1.5 makes'],
    p36: ['PTS/36', 'd1', v => div(v['offensive.avgPoints'], v['general.avgMinutes']) * 36, 'Points per 36 minutes'],
    ftr: ['FT rate', 'd3', v => div(v['offensive.avgFreeThrowsAttempted'], v['offensive.avgFieldGoalsAttempted']), 'Free-throw attempts per field-goal attempt'],
    pra: ['P+R+A', 'd1', v => v['offensive.avgPoints'] + v['general.avgRebounds'] + v['offensive.avgAssists'], 'Points + rebounds + assists per game'],
    astto: ['AST/TO', 'd2', v => div(v['offensive.avgAssists'], v['offensive.avgTurnovers']), 'Assists per turnover'],
    stocks: ['STL+BLK', 'd1', v => v['defensive.avgSteals'] + v['defensive.avgBlocks'], 'Steals + blocks per game'],
    pgp: ['P/GP', 'd2', v => div(v['offensive.points'], v['general.games']), 'Points per game played'],
    ppp: ['PPP', 'i', v => v['offensive.powerPlayGoals'] + v['offensive.powerPlayAssists'], 'Power-play points'],
    toi: ['TOI/GP', 'mmss', v => v['general.timeOnIcePerGame'], 'Average time on ice'],
    p60: ['P/60', 'd2', v => div(v['offensive.points'], v['general.timeOnIce'] / 3600), 'Points per 60 minutes on ice'],
    g60: ['G/60', 'd2', v => div(v['offensive.goals'], v['general.timeOnIce'] / 3600), 'Goals per 60 minutes on ice'],
    gsaa: ['GSAA', 'sgn1', (v, c) => v['defensive.saves'] - v['defensive.shotsAgainst'] * c.lgSv, 'Goals saved above average: saves beyond what a league-average save % would stop on the same shots'],
    iso: ['ISO', 'avg', v => v['batting.slugAvg'] - v['batting.avg'], 'Isolated power: slugging minus batting average'],
    bbp: ['BB%', 'pc1', v => 100 * div(v['batting.walks'], v['batting.atBats'] + v['batting.walks']), 'Walk rate (at-bats + walks as the denominator)'],
    kp: ['K%', 'pc1', v => 100 * div(v['batting.strikeouts'], v['batting.atBats'] + v['batting.walks']), 'Strikeout rate (at-bats + walks as the denominator)'],
    babip: ['BABIP', 'avg', v => div(v['batting.hits'] - v['batting.homeRuns'], v['batting.atBats'] - v['batting.strikeouts'] - v['batting.homeRuns']), 'Batting average on balls in play'],
    woba: ['wOBA', 'avg', v => { const s1 = v['batting.hits'] - v['batting.doubles'] - v['batting.triples'] - v['batting.homeRuns']; return div(0.69 * v['batting.walks'] + 0.88 * s1 + 1.25 * v['batting.doubles'] + 1.58 * v['batting.triples'] + 2.03 * v['batting.homeRuns'], v['batting.atBats'] + v['batting.walks']); }, 'Weighted on-base average (standard linear weights; HBP and sac flies not in this feed)'],
    k9: ['K/9', 'd2', v => 9 * div(v['pitching.strikeouts'], ipOf(v['pitching.innings'])), 'Strikeouts per nine innings'],
    bb9: ['BB/9', 'd2', v => 9 * div(v['pitching.walks'], ipOf(v['pitching.innings'])), 'Walks per nine innings'],
    hr9: ['HR/9', 'd2', v => 9 * div(v['pitching.homeRuns'], ipOf(v['pitching.innings'])), 'Home runs allowed per nine innings'],
    kbb: ['K/BB', 'd2', v => div(v['pitching.strikeouts'], v['pitching.walks']), 'Strikeouts per walk'],
    fip: ['FIP', 'd2', (v, c) => div(13 * v['pitching.homeRuns'] + 3 * v['pitching.walks'] - 2 * v['pitching.strikeouts'], ipOf(v['pitching.innings'])) + c.cFip, 'Fielding-independent pitching: ERA-scaled from strikeouts, walks and homers only'],
    erafip: ['ERA−FIP', 'sgn2', (v, c) => v['pitching.ERA'] - (div(13 * v['pitching.homeRuns'] + 3 * v['pitching.walks'] - 2 * v['pitching.strikeouts'], ipOf(v['pitching.innings'])) + c.cFip), 'Positive = ERA worse than the pitcher\'s peripherals suggest (defense or luck)'],
    anya: ['ANY/A', 'd2', v => div(v['passing.passingYards'] + 20 * v['passing.passingTouchdowns'] - 45 * v['passing.interceptions'] - v['passing.sackYardsLost'], v['passing.passingAttempts'] + v['passing.sacks']), 'Adjusted net yards per attempt: +20 per TD, −45 per INT, sacks count as attempts'],
    tdp: ['TD%', 'pc1', v => 100 * div(v['passing.passingTouchdowns'], v['passing.passingAttempts']), 'Touchdown passes per attempt'],
    intp: ['INT%', 'pc1', v => 100 * div(v['passing.interceptions'], v['passing.passingAttempts']), 'Interceptions per attempt'],
    sackp: ['Sack%', 'pc1', v => 100 * div(v['passing.sacks'], v['passing.passingAttempts'] + v['passing.sacks']), 'Sacks per dropback'],
    fdr: ['1st-down %', 'pc1', v => 100 * div(v['rushing.rushingFirstDowns'], v['rushing.rushingAttempts']), 'Carries that gained a first down'],
    catchp: ['Catch%', 'pc1', v => 100 * div(v['receiving.receptions'], v['receiving.receivingTargets']), 'Receptions per target'],
    ytgt: ['Y/Tgt', 'd1', v => div(v['receiving.receivingYards'], v['receiving.receivingTargets']), 'Receiving yards per target'],
    yac: ['YAC/Rec', 'd1', v => div(v['receiving.receivingYardsAfterCatch'], v['receiving.receptions']), 'Yards after catch per reception'],
    // basketball: box-score composites and rates
    gmsc: ['GmSc', 'd1', v => v['offensive.avgPoints'] + 0.4 * v['offensive.avgFieldGoalsMade'] - 0.7 * v['offensive.avgFieldGoalsAttempted'] - 0.4 * (v['offensive.avgFreeThrowsAttempted'] - v['offensive.avgFreeThrowsMade']) + 0.4 * v['general.avgRebounds'] + v['defensive.avgSteals'] + 0.7 * v['offensive.avgAssists'] + 0.7 * v['defensive.avgBlocks'] - 0.4 * z(v['general.avgFouls']) - v['offensive.avgTurnovers'], 'Game Score (Hollinger) per game: PTS + 0.4 FGM − 0.7 FGA − 0.4 missed FT + 0.4 REB + STL + 0.7 AST + 0.7 BLK − 0.4 PF − TOV (rebounds are not split in this feed)'],
    eff: ['EFF', 'd1', v => v['offensive.avgPoints'] + v['general.avgRebounds'] + v['offensive.avgAssists'] + v['defensive.avgSteals'] + v['defensive.avgBlocks'] - (v['offensive.avgFieldGoalsAttempted'] - v['offensive.avgFieldGoalsMade']) - (v['offensive.avgFreeThrowsAttempted'] - v['offensive.avgFreeThrowsMade']) - v['offensive.avgTurnovers'], 'Efficiency (NBA EFF) per game: points, rebounds, assists, steals and blocks minus missed shots and turnovers'],
    usg: ['USG% est', 'pc1', (v, c) => 100 * (v['offensive.avgFieldGoalsAttempted'] + 0.44 * v['offensive.avgFreeThrowsAttempted'] + v['offensive.avgTurnovers']) * c.usgL / (v['general.avgMinutes'] * c.lgPlays), 'Usage rate estimate: share of team plays a player finishes while on the floor, against a league-average team pace'],
    r36: ['REB/36', 'd1', v => 36 * div(v['general.avgRebounds'], v['general.avgMinutes']), 'Rebounds per 36 minutes'],
    a36: ['AST/36', 'd1', v => 36 * div(v['offensive.avgAssists'], v['general.avgMinutes']), 'Assists per 36 minutes'],
    s36: ['STK/36', 'd1', v => 36 * div(v['defensive.avgSteals'] + v['defensive.avgBlocks'], v['general.avgMinutes']), 'Steals plus blocks per 36 minutes'],
    tovp: ['TOV%', 'pc1', v => 100 * div(v['offensive.avgTurnovers'], v['offensive.avgFieldGoalsAttempted'] + 0.44 * v['offensive.avgFreeThrowsAttempted'] + v['offensive.avgTurnovers']), 'Turnovers per 100 plays the player used'],
    par3: ['3PA rate', 'pc1', v => 100 * div(v['offensive.avgThreePointFieldGoalsAttempted'], v['offensive.avgFieldGoalsAttempted']), 'Share of shot attempts taken from three'],
    // hockey
    a60: ['A/60', 'd2', v => div(v['offensive.assists'], v['general.timeOnIce'] / 3600), 'Assists per 60 minutes on ice'],
    s60: ['S/60', 'd2', v => div(v['offensive.shotsTotal'], v['general.timeOnIce'] / 3600), 'Shots on goal per 60 minutes on ice'],
    gsaa60: ['GSAA/60', 'sgn2', (v, c) => div(v['defensive.saves'] - v['defensive.shotsAgainst'] * c.lgSv, v['general.timeOnIce'] / 3600), 'Goals saved above average per 60 minutes played'],
    gwp: ['Win %', 'avg', v => div(v['general.wins'], v['general.wins'] + v['general.losses'] + z(v['defensive.overtimeLosses'])), 'Share of decisions won'],
    sop: ['SO rate', 'pc1', v => 100 * div(v['defensive.shutouts'], v['general.games']), 'Shutouts per game played'],
    // baseball hitting
    opsp: ['OPS+', 'i', (v, c) => 100 * (div(v['batting.onBasePct'], c.lgOBP) + div(v['batting.slugAvg'], c.lgSLG) - 1), 'OPS relative to the league: 100 = average, 150 = 50% better (no park adjustment)'],
    wrcp: ['wRC+ est', 'i', (v, c) => { const w = X.woba[2](v); return 100 * ((w - c.lgwOBA) / 1.2 + c.lgRPA) / c.lgRPA; }, 'Weighted runs created per plate appearance versus the league: 100 = average (estimate: no park factors, HBP or sac flies)'],
    bbk: ['BB/K', 'd2', v => div(v['batting.walks'], v['batting.strikeouts']), 'Walks per strikeout: plate discipline'],
    hrp: ['HR%', 'pc1', v => 100 * div(v['batting.homeRuns'], v['batting.atBats'] + v['batting.walks']), 'Home runs per plate appearance'],
    rc: ['RC', 'i', v => div((v['batting.hits'] + v['batting.walks']) * v['batting.totalBases'], v['batting.atBats'] + v['batting.walks']), 'Runs created (Bill James, basic): (H + BB) × TB ÷ (AB + BB)'],
    // baseball pitching
    erap: ['ERA+', 'i', (v, c) => 100 * div(c.lgERA, v['pitching.ERA']), 'League ERA ÷ pitcher ERA × 100: higher is better (no park adjustment)'],
    fipm: ['FIP−', 'i', (v, c) => 100 * div(X.fip[2](v, c), c.lgERA), 'FIP relative to the league: 100 = average, lower is better'],
    kpp: ['K%', 'pc1', v => 100 * div(v['pitching.strikeouts'], tbf(v)), 'Strikeouts per batter faced (batters faced estimated as 3 × IP + H + BB)'],
    bbpp: ['BB%', 'pc1', v => 100 * div(v['pitching.walks'], tbf(v)), 'Walks per batter faced'],
    kbbp: ['K−BB%', 'pc1', v => 100 * div(v['pitching.strikeouts'] - v['pitching.walks'], tbf(v)), 'Strikeout rate minus walk rate: the best simple predictor of future pitching'],
    babipa: ['BABIP', 'avg', v => div(v['pitching.hits'] - v['pitching.homeRuns'], tbf(v) - v['pitching.strikeouts'] - v['pitching.homeRuns'] - v['pitching.walks']), 'Batting average allowed on balls in play: far from about .290 tends to regress'],
    qsp: ['QS%', 'pc1', v => 100 * div(v['pitching.qualityStarts'], v['pitching.gamesStarted']), 'Quality starts (6+ IP, 3 or fewer ER) per start'],
    ipgs: ['IP/GS', 'd1', v => div(ipOf(v['pitching.innings']), v['pitching.gamesStarted']), 'Innings per start'],
    // football
    aya: ['AY/A', 'd2', v => div(v['passing.passingYards'] + 20 * v['passing.passingTouchdowns'] - 45 * v['passing.interceptions'], v['passing.passingAttempts']), 'Adjusted yards per attempt: +20 per TD, −45 per INT'],
    nya: ['NY/A', 'd2', v => div(v['passing.passingYards'] - v['passing.sackYardsLost'], v['passing.passingAttempts'] + v['passing.sacks']), 'Net yards per dropback (sacks included)'],
    ypcmp: ['Y/C', 'd1', v => div(v['passing.passingYards'], v['passing.completions']), 'Yards per completion'],
    tdint: ['TD:INT', 'd2', v => div(v['passing.passingTouchdowns'], v['passing.interceptions']), 'Touchdowns per interception'],
    rate: ['Rating', 'd1', v => { const a = v['passing.passingAttempts']; if (!(a > 0)) return NaN; const cl = x => Math.max(0, Math.min(2.375, x)); return 100 * (cl((v['passing.completions'] / a - 0.3) * 5) + cl((v['passing.passingYards'] / a - 3) * 0.25) + cl(v['passing.passingTouchdowns'] / a * 20) + cl(2.375 - v['passing.interceptions'] / a * 25)) / 6; }, 'NFL passer rating from completion %, yards, TD and INT per attempt'],
    bigp: ['20+ yd %', 'pc1', v => 100 * div(v['rushing.rushingBigPlays'], v['rushing.rushingAttempts']), 'Share of carries that became big plays (20+ yards)'],
    tdr: ['TD rate', 'pc1', v => 100 * div(v['rushing.rushingTouchdowns'], v['rushing.rushingAttempts']), 'Rushing touchdowns per carry'],
    fumr: ['Fum/100', 'd2', v => 100 * div(v['rushing.rushingFumbles'], v['rushing.rushingAttempts']), 'Fumbles per 100 carries'],
    fdt: ['1D/Tgt', 'pc1', v => 100 * div(v['receiving.receivingFirstDowns'], v['receiving.receivingTargets']), 'First downs per target'],
    tdt: ['TD/Tgt', 'pc1', v => 100 * div(v['receiving.receivingTouchdowns'], v['receiving.receivingTargets']), 'Touchdowns per target'],
    bigr: ['Big-play %', 'pc1', v => 100 * div(v['receiving.receivingBigPlays'], v['receiving.receptions']), 'Share of catches that became big plays'],
    havoc: ['Havoc', 'i', v => z(v['defensive.tacklesForLoss']) + z(v['defensive.passesDefended']) + z(v['general.fumblesForced']) + z(v['defensiveinterceptions.interceptions']), 'Havoc plays: tackles for loss + passes defended + forced fumbles + interceptions'],
    havg: ['Havoc/G', 'd2', v => div(z(v['defensive.tacklesForLoss']) + z(v['defensive.passesDefended']) + z(v['general.fumblesForced']) + z(v['defensiveinterceptions.interceptions']), v['general.gamesPlayed']), 'Havoc plays per game']
  };
  const LOWER = /(\.ERA$|\.WHIP$|avgGoalsAgainst$|x\.bb9$|x\.hr9$|x\.fip$|x\.fipm$|x\.bbpp$|x\.babipa$|x\.fumr$|x\.tovp$|x\.erafip$|x\.intp$|x\.sackp$|x\.kp$|avgTurnovers$|^passing\.interceptions$|goalsAgainst$|\.losses$|overtimeLosses$|rushingFumblesLost$|t:.*(turnovers|Turnovers|penalt|Penalt|interceptions|goalsAgainst|earnedRuns|ERA|WHIP|fouls|Fouls)$)/;
  const BOARDS = {
    bk: { reqs: { all: { sort: 'offensive.avgPoints:desc', limit: 150 } }, minGP: 0.45, list: [
      { id: 'scoring', name: 'Scoring & efficiency', req: 'all', sortBy: 'offensive.avgPoints', cols: ['general.gamesPlayed', 'general.avgMinutes', 'offensive.avgPoints', 'offensive.fieldGoalPct', 'offensive.threePointFieldGoalPct', 'offensive.threePointPct', 'offensive.freeThrowPct', 'x.ts', 'x.efg', 'x.p36', 'x.ftr'], xy: ['offensive.avgPoints', 'x.ts'] },
      { id: 'allround', name: 'All-around', req: 'all', sortBy: 'x.pra', cols: ['general.gamesPlayed', 'offensive.avgPoints', 'general.avgRebounds', 'offensive.avgAssists', 'defensive.avgSteals', 'defensive.avgBlocks', 'offensive.avgTurnovers', 'x.astto', 'x.stocks', 'x.pra', 'general.doubleDouble', 'general.tripleDouble'], xy: ['general.avgRebounds', 'offensive.avgAssists'] },
      { id: 'adv', name: 'Advanced', req: 'all', sortBy: 'x.gmsc', cols: ['general.gamesPlayed', 'general.avgMinutes', 'x.gmsc', 'x.eff', 'x.usg', 'x.ts', 'x.efg', 'x.par3', 'x.tovp', 'x.p36', 'x.r36', 'x.a36', 'x.s36'], xy: ['x.usg', 'x.ts'] }] },
    hk: { reqs: { sk: { limit: 200 }, gk: { cat: 'goalies', limit: 90 } }, minGP: 0.35, list: [
      { id: 'skaters', name: 'Skaters', req: 'sk', sortBy: 'offensive.points', only: r => r.pos !== 'G', cols: ['general.games', 'offensive.goals', 'offensive.assists', 'offensive.points', 'x.pgp', 'general.plusMinus', 'x.ppp', 'offensive.shotsTotal', 'offensive.shootingPct', 'x.toi', 'x.p60', 'x.g60', 'offensive.faceoffPercent'], xy: ['x.toi', 'x.p60'] },
      { id: 'rates', name: 'Skater rates', req: 'sk', sortBy: 'x.p60', only: r => r.pos !== 'G', cols: ['general.games', 'x.toi', 'x.p60', 'x.g60', 'x.a60', 'x.s60', 'offensive.shootingPct', 'x.ppp', 'offensive.gameWinningGoals', 'general.plusMinus', 'penalties.penaltyMinutes', 'offensive.faceoffPercent'], xy: ['x.s60', 'x.g60'] },
      { id: 'goalies', name: 'Goalies', req: 'gk', sortBy: 'x.gsaa', only: r => r.pos === 'G', cols: ['general.games', 'general.wins', 'general.losses', 'defensive.overtimeLosses', 'x.gwp', 'defensive.savePct', 'defensive.avgGoalsAgainst', 'defensive.shotsAgainst', 'x.gsaa', 'x.gsaa60', 'defensive.shutouts', 'x.sop'], xy: ['defensive.shotsAgainst', 'x.gsaa'] }] },
    bb: { reqs: { bat: { cat: 'batting', sort: 'batting.OPS:desc', limit: 200 }, pit: { cat: 'pitching', sort: 'pitching.ERA:asc', limit: 150 } }, list: [
      { id: 'hitting', name: 'Hitting', req: 'bat', sortBy: 'batting.OPS', cols: ['batting.gamesPlayed', 'batting.atBats', 'batting.avg', 'batting.onBasePct', 'batting.slugAvg', 'batting.OPS', 'batting.homeRuns', 'batting.RBIs', 'batting.stolenBases', 'x.iso', 'x.bbp', 'x.kp', 'x.babip', 'x.woba', 'batting.WARBR'], xy: ['x.kp', 'x.woba'] },
      { id: 'advhit', name: 'Advanced hitting', req: 'bat', sortBy: 'x.wrcp', cols: ['batting.gamesPlayed', 'batting.atBats', 'x.woba', 'x.wrcp', 'x.opsp', 'x.iso', 'x.babip', 'x.bbp', 'x.kp', 'x.bbk', 'x.hrp', 'x.rc', 'batting.WARBR'], xy: ['x.iso', 'x.wrcp'] },
      { id: 'pitching', name: 'Pitching', req: 'pit', sortBy: 'pitching.ERA', cols: ['pitching.gamesStarted', 'pitching.innings', 'pitching.wins', 'pitching.losses', 'pitching.ERA', 'pitching.WHIP', 'pitching.strikeouts', 'x.k9', 'x.bb9', 'x.hr9', 'x.kbb', 'x.fip', 'x.erafip', 'pitching.WARBR'], xy: ['x.fip', 'pitching.ERA'] },
      { id: 'advpit', name: 'Advanced pitching', req: 'pit', sortBy: 'x.kbbp', cols: ['pitching.gamesStarted', 'pitching.innings', 'pitching.ERA', 'x.erap', 'x.fip', 'x.fipm', 'x.erafip', 'x.kpp', 'x.bbpp', 'x.kbbp', 'x.babipa', 'x.qsp', 'x.ipgs', 'pitching.WARBR'], xy: ['x.kbbp', 'x.fip'] }] },
    fb: { reqs: { pass: { cat: 'offense:passing', sort: 'passing.passingYards:desc', limit: 60 }, rush: { cat: 'offense:rushing', sort: 'rushing.rushingYards:desc', limit: 80 }, rec: { cat: 'offense:receiving', sort: 'receiving.receivingYards:desc', limit: 100 }, def: { cat: 'defense', sort: 'defensive.sacks:desc', limit: 100 } }, list: [
      { id: 'passing', name: 'Passing', req: 'pass', sortBy: 'passing.passingYards', cols: ['general.gamesPlayed', 'passing.completions', 'passing.passingAttempts', 'passing.completionPct', 'passing.passingYards', 'passing.passingTouchdowns', 'passing.interceptions', 'passing.yardsPerPassAttempt', 'x.anya', 'x.tdp', 'x.intp', 'x.sackp', 'passing.QBRating', 'passing.QBR'], xy: ['passing.passingAttempts', 'x.anya'] },
      { id: 'advpass', name: 'Advanced passing', req: 'pass', sortBy: 'x.anya', cols: ['general.gamesPlayed', 'passing.passingAttempts', 'x.rate', 'passing.QBR', 'x.anya', 'x.aya', 'x.nya', 'passing.yardsPerPassAttempt', 'x.ypcmp', 'x.tdp', 'x.intp', 'x.tdint', 'x.sackp'], xy: ['x.sackp', 'x.anya'] },
      { id: 'rushing', name: 'Rushing', req: 'rush', sortBy: 'rushing.rushingYards', cols: ['general.gamesPlayed', 'rushing.rushingAttempts', 'rushing.rushingYards', 'rushing.yardsPerRushAttempt', 'rushing.rushingTouchdowns', 'rushing.rushingYardsPerGame', 'rushing.longRushing', 'x.fdr', 'x.bigp', 'x.tdr', 'x.fumr', 'rushing.rushingFumblesLost'], xy: ['rushing.rushingAttempts', 'rushing.yardsPerRushAttempt'] },
      { id: 'receiving', name: 'Receiving', req: 'rec', sortBy: 'receiving.receivingYards', cols: ['general.gamesPlayed', 'receiving.receptions', 'receiving.receivingTargets', 'x.catchp', 'receiving.receivingYards', 'receiving.yardsPerReception', 'x.ytgt', 'receiving.receivingTouchdowns', 'x.yac', 'x.fdt', 'x.tdt', 'x.bigr'], xy: ['receiving.receivingTargets', 'x.ytgt'] },
      { id: 'defense', name: 'Defense', req: 'def', sortBy: 'defensive.sacks', cols: ['general.gamesPlayed', 'defensive.totalTackles', 'defensive.soloTackles', 'defensive.sacks', 'defensive.tacklesForLoss', 'defensive.passesDefended', 'defensiveinterceptions.interceptions', 'general.fumblesForced', 'x.havoc', 'x.havg'], xy: ['defensive.totalTackles', 'x.havoc'] }] }
  };
  function parseBoard(js) {
    const cats = ((js && js.categories) || []).map(c => ({ name: c.name, names: c.names || [], labels: c.labels || [], disp: c.displayNames || [], desc: c.descriptions || [] }));
    const meta = {};
    for (const c of cats) c.names.forEach((n, i) => { const k = c.name + '.' + n; if (!meta[k]) meta[k] = { lab: c.labels[i] || n, full: c.disp[i] || c.labels[i] || n, desc: c.desc[i] || '' }; });
    const rows = ((js && js.athletes) || []).map(a => {
      const at = a.athlete || {}, v = {}, rk = {};
      for (const c of a.categories || []) {
        const def = cats.find(x => x.name === c.name); if (!def) continue;
        (c.values || []).forEach((x, i) => { const k = c.name + '.' + def.names[i]; if (!(k in v) || !fin(v[k])) v[k] = x == null || x === '' ? NaN : +x; });
        (c.ranks || []).forEach((x, i) => { if (x != null && x !== '') rk[c.name + '.' + def.names[i]] = +x; });
      }
      return { id: String(at.id || ''), name: at.displayName || at.shortName || '—', team: at.teamShortName || '', teamName: at.teamName || '', pos: (at.position && at.position.abbreviation) || '', head: (at.headshot && at.headshot.href) || '', v, rk };
    }).filter(r => r.id);
    return { meta, rows };
  }
  function snapBoard(lgId, y, reqId) {
    const p = SNAPX && SNAPX.pl && SNAPX.pl[lgId]; const q = p && +p.y === +y && p.reqs && p.reqs[reqId]; if (!q) return null;
    const cols = q.cols.split(','), labs = (q.labs || '').split(','), meta = {};
    cols.forEach((k, i) => { meta[k] = { lab: labs[i] || k.split('.').pop(), full: labs[i] || k, desc: '' }; });
    const rows = q.rows.map((line, i) => { const f = line.split('|'); const v = {}; cols.forEach((k, j) => { const x = f[4 + j]; v[k] = x === '' || x == null ? NaN : +x; }); return { id: 'snap' + reqId + i, name: f[0], team: f[1], pos: f[2], head: '', v, rk: {}, snap: true, espn: f[3] || '' }; });
    return { meta, rows, snap: true };
  }
  function loadBoard(lgId, y, reqId) {
    const d = db(lgId, y);
    return memo(d.boards, reqId, async () => {
      if (!live()) return snapBoard(lgId, y, reqId);
      const lg = LG[lgId], kind = kindOf(lgId), q = BOARDS[kind].reqs[reqId];
      const url = s => `${HOST}common/v3/sports/${lg.path}/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=true&page=1&limit=${q.limit || 100}&season=${y}&seasontype=2${q.cat ? '&category=' + q.cat : ''}${s ? '&sort=' + s : ''}`;
      let js;
      try { js = await get(url(q.sort), 20 * 60e3); } catch (e) { if (!q.sort) throw e; js = await get(url(null), 20 * 60e3); }
      return parseBoard(js);
    });
  }
  function soccerLeaders(lgId, y) {
    return memo(db(lgId, y).boards, 'soc', async () => {
      if (!live()) { const s0 = SNAPX && SNAPX.sc && SNAPX.sc[lgId]; return !s0 ? null : Array.isArray(s0) ? s0 : (s0[y] || null); }
      const js = await get(`${HOST}site/v2/sports/${LG[lgId].path}/statistics?season=${y}`, 20 * 60e3);
      const lists = [];
      for (const s of js.stats || []) {
        const rows = (s.leaders || []).map(l => ({ id: String((l.athlete && l.athlete.id) || ''), name: (l.athlete && (l.athlete.displayName || l.athlete.shortName)) || '—', team: (l.athlete && l.athlete.team && (l.athlete.team.abbreviation || l.athlete.team.shortDisplayName)) || (l.team && l.team.abbreviation) || '', v: fin(l.value) ? +l.value : APP.num(l.displayValue), dv: l.displayValue || '' }));
        if (rows.length) lists.push({ name: s.displayName || s.name, key: s.name, rows });
      }
      return lists.length ? lists : null;
    });
  }

  /* ---------------- team metrics ---------------- */
  const tv = (T, ...ks) => { if (!T) return NaN; for (const k of ks) { const r = T[k]; if (r && fin(r.v)) return r.v; } return NaN; };
  function kindMetrics(k, T, m, gp) {
    const x = {}, g = (...ks) => tv(T, ...ks);
    if (k === 'bk') {
      const fga = g('offensive.avgFieldGoalsAttempted', 'avgFieldGoalsAttempted'), fgm = g('offensive.avgFieldGoalsMade', 'avgFieldGoalsMade'), p3m = g('offensive.avgThreePointFieldGoalsMade', 'avgThreePointFieldGoalsMade'), p3a = g('offensive.avgThreePointFieldGoalsAttempted', 'avgThreePointFieldGoalsAttempted');
      const fta = g('offensive.avgFreeThrowsAttempted', 'avgFreeThrowsAttempted'), ftm = g('offensive.avgFreeThrowsMade', 'avgFreeThrowsMade'), orb = g('offensive.avgOffensiveRebounds', 'avgOffensiveRebounds'), tov = g('offensive.avgTurnovers', 'avgTurnovers');
      const ppg = fin(m.pfg) ? m.pfg : g('offensive.avgPoints', 'avgPoints');
      x.poss = fga - orb + tov + 0.44 * fta; x.ortg = 100 * div(ppg, x.poss);
      if (fin(m.pag)) { x.drtg = 100 * div(m.pag, x.poss); x.net = x.ortg - x.drtg; }
      x.efg = 100 * div(fgm + 0.5 * p3m, fga); x.tovp = 100 * div(tov, fga + 0.44 * fta + tov); x.orb = orb; x.ftr = div(ftm, fga);
      x.ts = 100 * div(ppg, 2 * (fga + 0.44 * fta)); x.par3 = 100 * div(p3a, fga);
      x.ast = g('offensive.avgAssists', 'avgAssists'); x.astto = div(x.ast, tov); x.reb = g('general.avgRebounds', 'avgRebounds');
      x.stl = g('defensive.avgSteals', 'avgSteals'); x.blk = g('defensive.avgBlocks', 'avgBlocks');
      x.pace = x.poss; x.astp = 100 * div(x.ast, fgm); const drbA = g('defensive.avgDefensiveRebounds', 'avgDefensiveRebounds'); x.drb = fin(drbA) ? drbA : x.reb - orb;
      x.fgp = g('offensive.fieldGoalPct', 'fieldGoalPct'); x.p3p = g('offensive.threePointFieldGoalPct', 'offensive.threePointPct', 'threePointFieldGoalPct'); x.ftp = g('offensive.freeThrowPct', 'freeThrowPct');
    } else if (k === 'fb') {
      const plays = g('rushing.totalOffensivePlays', 'totalOffensivePlays'), yds = g('rushing.totalYards', 'totalYards');
      x.ypp = div(yds, plays); x.ypg = div(yds, gp);
      x.third = g('miscellaneous.thirdDownConvPct', 'thirdDownConvPct'); x.rzTD = g('miscellaneous.redzoneTouchdownPct', 'redzoneTouchdownPct');
      x.toDiff = g('miscellaneous.turnOverDifferential', 'turnOverDifferential'); x.take = g('miscellaneous.totalTakeaways', 'totalTakeaways'); x.give = g('miscellaneous.totalGiveaways', 'totalGiveaways');
      x.sacks = g('defensive.sacks', 'defense.sacks'); x.sacked = g('passing.sacks');
      x.passYpg = g('passing.netPassingYardsPerGame', 'passing.passingYardsPerGame'); x.rushYpg = g('rushing.rushingYardsPerGame', 'rushingYardsPerGame');
      x.nya = div(g('passing.netPassingYards'), g('passing.passingAttempts') + (fin(x.sacked) ? x.sacked : 0));
      x.ypc = g('rushing.yardsPerRushAttempt'); x.cmp = g('passing.completionPct'); x.rate = g('passing.QBRating');
      x.penYpg = div(g('miscellaneous.totalPenaltyYards', 'totalPenaltyYards'), gp); x.top = div(g('miscellaneous.possessionTimeSeconds', 'possessionTimeSeconds'), gp);
      x.tfl = g('defensive.tacklesForLoss', 'defense.tacklesForLoss'); x.defInt = g('defensiveInterceptions.interceptions', 'defensiveinterceptions.interceptions');
      const att = g('passing.passingAttempts'), sk = fin(x.sacked) ? x.sacked : 0, rAtt = g('rushing.rushingAttempts');
      x.anya = div(g('passing.netPassingYards') + 20 * g('passing.passingTouchdowns') - 45 * g('passing.interceptions'), att + sk);
      x.passRate = 100 * div(att + sk, att + sk + rAtt); x.sackp = 100 * div(x.sacked, att + x.sacked);
      x.ptsPlay = fin(m.pfg) ? div(m.pfg * gp, plays) : NaN; x.giveG = div(x.give, gp);
    } else if (k === 'bb') {
      const pa = g('batting.plateAppearances'), ab = g('batting.atBats'), h = g('batting.hits'), d2 = g('batting.doubles'), d3 = g('batting.triples'), hr = g('batting.homeRuns'), bb = g('batting.walks'), hbp = g('batting.hitByPitch'), sf = g('batting.sacFlies'), so = g('batting.strikeouts');
      const z = v => fin(v) ? v : 0, s1 = h - d2 - d3 - hr;
      x.avg = g('batting.avg'); x.obp = g('batting.onBasePct'); x.slg = g('batting.slugAvg'); x.ops = g('batting.OPS'); x.iso = x.slg - x.avg;
      x.woba = div(0.69 * bb + 0.72 * z(hbp) + 0.88 * s1 + 1.25 * d2 + 1.58 * d3 + 2.03 * hr, ab + bb + z(sf) + z(hbp));
      x.bbp = 100 * div(bb, pa); x.kp = 100 * div(so, pa); x.babip = div(h - hr, ab - so - hr + z(sf)); x.hr = hr; x.sb = g('batting.stolenBases');
      const ip = ipOf(g('pitching.innings')), phr = g('pitching.homeRuns'), pbb = g('pitching.walks'), phbp = g('pitching.battersHit', 'pitching.hitBatsmen'), pk = g('pitching.strikeouts');
      x.era = g('pitching.ERA'); x.whip = g('pitching.WHIP'); x.k9 = 9 * div(pk, ip); x.bb9 = 9 * div(pbb, ip); x.hr9 = 9 * div(phr, ip); x.kbb = div(pk, pbb); x.oppOps = g('pitching.opponentOPS');
      x._fr = 13 * phr + 3 * (pbb + z(phbp)) - 2 * pk; x._ip = ip; x._er = g('pitching.earnedRuns');
      Object.assign(x, { _ab: ab, _h: h, _d2: d2, _d3: d3, _hr: hr, _bb: bb, _hbp: z(hbp), _sf: z(sf), _pa: pa });
      // BaseRuns (David Smyth): runs a lineup 'should' score from its components; actual minus BsR = sequencing
      const tb = h + d2 + 2 * d3 + 3 * hr, A = h + bb + z(hbp) - hr, B = (1.4 * tb - 0.6 * h - 3 * hr + 0.1 * (bb + z(hbp))) * 1.02, Cc = ab - h;
      x.bsr = div(A * B / (B + Cc) + hr, gp); x.rbsr = fin(m.pfg) ? m.pfg - x.bsr : NaN;
      let ph = g('pitching.hits'); if (!fin(ph) && fin(x.whip) && fin(ip)) ph = x.whip * ip - pbb;
      const tbfT = 3 * ip + ph + pbb + z(phbp);
      x.pkp = 100 * div(pk, tbfT); x.pbbp = 100 * div(pbb, tbfT); x.kbbp = x.pkp - x.pbbp;
      const ra = fin(m.pag) ? m.pag * gp : NaN;
      x.lob = 100 * div(ph + pbb + z(phbp) - ra, ph + pbb + z(phbp) - 1.4 * phr);
      x.der = 1 - div(ph - phr, tbfT - pk - pbb - z(phbp) - phr);
    } else if (k === 'hk') {
      const sh = g('offensive.shotsTotal', 'shotsTotal'), sa = g('defensive.shotsAgainst', 'shotsAgainst'), gl = g('offensive.goals', 'goals'), ga = g('defensive.goalsAgainst', 'goalsAgainst');
      x.sfg = div(sh, gp); x.sag = div(sa, gp); x.sshare = 100 * div(sh, sh + sa); x.shp = 100 * div(gl, sh); x.svp = 100 * (1 - div(ga, sa)); x.pdo = x.shp + x.svp;
      x.ppg = g('offensive.powerPlayGoals', 'powerPlayGoals'); x.fo = g('offensive.faceoffPercent', 'faceoffPercent'); x.pim = div(g('penalties.penaltyMinutes', 'penaltyMinutes'), gp);
      x.ppPct = g('offensive.powerPlayPct', 'powerPlayPct'); if (!fin(x.ppPct)) x.ppPct = 100 * div(x.ppg, g('offensive.powerPlayOpportunities', 'powerPlayOpportunities'));
      x.pkPct = g('defensive.penaltyKillPct', 'penaltyKillPct'); x.sti = x.ppPct + x.pkPct;
    }
    return x;
  }
  // second pass: metrics relative to the league (strength ratios, OPS+/wRC+/ERA+, rebound shares, power index)
  function leaguePass(lgId, out) {
    const k = kindOf(lgId), c = CFG[lgId], L = out.filter(t => t.m.gp > 0), M = key => mean(L.map(t => t.m[key]));
    if (!L.length) return;
    if (c.soccer) { const lf = M('pfg'), la = M('pag'); for (const t of L) { t.m.attS = div(t.m.pfg, lf); t.m.defS = div(t.m.pag, la); t.m.ppace = t.m.ppg * (LG[lgId].games || 38); } }
    if (k === 'bk') { const lo = M('orb'), ld = M('drb'); for (const t of L) { t.m.orbp = 100 * div(t.m.orb, t.m.orb + ld); t.m.drbp = 100 * div(t.m.drb, t.m.drb + lo); } }
    if (k === 'bb') {
      const B = L.filter(t => fin(t.m._ab) && fin(t.m._h)), S = key => B.reduce((a, t) => a + (fin(t.m[key]) ? t.m[key] : 0), 0);
      if (B.length >= 10) {
        const ab = S('_ab'), h = S('_h'), d2 = S('_d2'), d3 = S('_d3'), hr = S('_hr'), bb = S('_bb'), hbp = S('_hbp'), sf = S('_sf'), pa = S('_pa'), s1 = h - d2 - d3 - hr;
        const lgOBP = (h + bb + hbp) / (ab + bb + hbp + sf), lgSLG = (s1 + 2 * d2 + 3 * d3 + 4 * hr) / ab;
        const lgW = (0.69 * bb + 0.72 * hbp + 0.88 * s1 + 1.25 * d2 + 1.58 * d3 + 2.03 * hr) / (ab + bb + sf + hbp);
        const runs = B.reduce((a, t) => a + (fin(t.m.pfg) ? t.m.pfg * t.m.gp : 0), 0), lgRPA = pa > 0 && runs > 0 ? runs / pa : 0.118;
        const ip = B.reduce((a, t) => a + (fin(t.m._ip) ? t.m._ip : 0), 0), er = B.reduce((a, t) => a + (fin(t.m._er) ? t.m._er : 0), 0), lgERA = ip > 0 ? 9 * er / ip : 4.1;
        for (const t of B) { t.m.opsp = 100 * (t.m.obp / lgOBP + t.m.slg / lgSLG - 1); t.m.wrcp = 100 * ((t.m.woba - lgW) / 1.2 + lgRPA) / lgRPA; t.m.erap = 100 * div(lgERA, t.m.era); t.m.fipm = 100 * div(t.m.fip, lgERA); }
      }
    }
    // power index: z-scores of margin, Pythagorean (or xPts) and results, plus efficiency when team stats are loaded
    const comps = c.soccer ? ['mov', 'xppg', 'ppg'] : ['mov', 'pyth', 'wp'];
    const eff = { bk: 'net', fb: 'ypp', hk: 'sshare' }[k]; if (eff && L.filter(t => fin(t.m[eff])).length >= L.length * 0.6) comps.push(eff);
    const Z = {}; for (const key of comps) { const v = L.map(t => t.m[key]).filter(fin); if (v.length < 3) continue; const mu = mean(v), sd = sdev(v); if (sd > 0) Z[key] = [mu, sd]; }
    for (const t of L) { const zs = Object.entries(Z).map(([key, [mu, sd]]) => (t.m[key] - mu) / sd).filter(fin); if (zs.length) t.m.pi = Math.max(1, Math.min(99, 50 + 15 * mean(zs))); }
  }
  function teamMetrics(lgId, rows, TS) {
    const k = kindOf(lgId), c = CFG[lgId];
    const out = rows.map(r => {
      const T = (TS && TS[r.key]) || null, gp = r.gp || (r.w + r.l + (r.t || 0)), m = {};
      m.gp = gp; m.w = r.w; m.l = r.l; m.t = r.t || 0;
      m.wp = gp ? (k === 'hk' ? r.w / gp : (r.w + 0.5 * (r.t || 0)) / gp) : NaN;
      if (fin(r.pf) && fin(r.pa) && gp) { m.pfg = r.pf / gp; m.pag = r.pa / gp; m.mov = m.pfg - m.pag; m.diff = r.pf - r.pa; }
      if (c.soccer) {
        m.pts = fin(r.pts) ? r.pts : 3 * r.w + (r.t || 0); m.ppg = gp ? m.pts / gp : NaN;
        if (fin(m.pfg)) { const e = A.poissonPts(m.pfg, m.pag); m.xpts = e.xp * gp; m.luck = m.pts - m.xpts; }
      } else if (fin(m.pfg)) { m.pyth = A.pythag(r.pf, r.pa, c.pyth); m.xw = m.pyth * gp; m.luck = (k === 'hk' ? r.w : r.w + 0.5 * (r.t || 0)) - m.xw; }
      if (fin(r.pf) && fin(r.pa) && r.pf + r.pa > 0) m.share = 100 * r.pf / (r.pf + r.pa);
      if (c.soccer && gp) { m.wpct = 100 * r.w / gp; m.dpct = 100 * (r.t || 0) / gp; if (fin(m.xpts)) m.xppg = m.xpts / gp; }
      if (T) Object.assign(m, kindMetrics(k, T, m, gp));
      if (APP.titles && APP.titles.has(lgId)) m.titles = APP.titles.count(lgId, { abbr: r.abbr || r.key, key: r.key, name: r.name });
      if (fin(r.ap)) m.ap = r.ap;
      return { key: r.key, id: r.id, abbr: r.abbr || r.key, name: r.name, color: r.color, group: r.group, clinch: r.clinch || '', r, T, m };
    });
    if (k === 'bb') {
      const ok = out.filter(t => fin(t.m._ip) && fin(t.m._er) && fin(t.m._fr));
      const ip = ok.reduce((s, t) => s + t.m._ip, 0), er = ok.reduce((s, t) => s + t.m._er, 0), fr = ok.reduce((s, t) => s + t.m._fr, 0);
      const cF = ip > 0 && ok.length >= 10 ? 9 * er / ip - fr / ip : 3.15;
      for (const t of out) if (fin(t.m._fr)) t.m.fip = t.m._fr / t.m._ip + cF;
    }
    leaguePass(lgId, out);
    return out;
  }
  function teamViews(lgId) {
    const k = kindOf(lgId), soc = CFG[lgId].soccer, [PF, PA] = UNIT[k], dp = k === 'bb' || k === 'hk' || soc ? 'd2' : 'd1';
    const col = (key, lab, f, low, desc) => ({ key, lab, f, low: !!low, desc: desc || '' });
    const base = soc
      ? [col('rec', 'W-D-L'), col('pts', 'Pts', 'i'), col('ppg', 'Pts/G', 'd2'), col('pfg', 'GF/G', 'd2'), col('pag', 'GA/G', 'd2', 1), col('diff', 'GD', 'sgn0'), col('xpts', 'xPts', 'd1', 0, 'Expected points from goals scored and conceded per game (Poisson)'), col('luck', 'Pts − xPts', 'sgn1', 0, 'Points above what the goal rates predict')]
      : [col('rec', 'Record'), col('wp', 'Win %', 'avg'), col('pfg', PF + '/G', dp), col('pag', PA + '/G', dp, 1), col('mov', 'Margin/G', dp === 'd1' ? 'sgn1' : 'sgn2'), col('pyth', 'Pythag %', 'avg', 0, 'Win % expected from scoring (Pythagorean expectation)'), col('luck', 'W − Pythag', 'sgn1', 0, 'Wins above the Pythagorean expectation: positive = more wins than the scoring deserved')];
    if (lgId === 'ncaaf') base.unshift(col('ap', 'AP', 'i', 1, 'AP Top 25 rank (current poll; final poll for past seasons)'));
    if (APP.titles && APP.titles.has(lgId)) { const td2 = APP.titles.def(lgId); base.push(col('titles', td2.col, 'i', 0, 'All-time ' + td2.plural + ' (' + td2.src + ')')); }
    const v = [{ id: 'ov', name: 'Overview', cols: base }];
    if (k === 'bk') v.push({ id: 'eff', name: 'Efficiency', cols: [col('poss', 'Poss/G', 'd1', 0, 'Possessions per game ≈ FGA − OREB + TOV + 0.44 × FTA'), col('ortg', 'ORtg', 'd1', 0, 'Points scored per 100 possessions'), col('drtg', 'DRtg', 'd1', 1, 'Points allowed per 100 possessions'), col('net', 'Net Rtg', 'sgn1'), col('ts', 'TS%', 'pc1'), col('efg', 'eFG%', 'pc1'), col('tovp', 'TOV%', 'pc1', 1, 'Turnovers per 100 plays'), col('orb', 'OREB/G', 'd1'), col('ftr', 'FT/FGA', 'd3'), col('par3', '3PA rate', 'pc1', 0, 'Share of shots taken from three')] },
      { id: 'box', name: 'Box score', cols: [col('pfg', 'PTS', 'd1'), col('reb', 'REB', 'd1'), col('ast', 'AST', 'd1'), col('stl', 'STL', 'd1'), col('blk', 'BLK', 'd1'), col('fgp', 'FG%', 'pc1'), col('p3p', '3P%', 'pc1'), col('ftp', 'FT%', 'pc1'), col('astto', 'AST/TO', 'd2')] });
    if (k === 'fb') v.push({ id: 'off', name: 'Offense', cols: [col('ypg', 'Yds/G', 'd1'), col('ypp', 'Yds/play', 'd2'), col('passYpg', 'Pass yds/G', 'd1'), col('nya', 'Net Y/A', 'd2', 0, 'Net passing yards per dropback (sacks included)'), col('rushYpg', 'Rush yds/G', 'd1'), col('ypc', 'Yds/rush', 'd2'), col('cmp', 'Cmp %', 'pc1'), col('rate', 'Passer rtg', 'd1'), col('third', '3rd down', 'pc1'), col('rzTD', 'Red-zone TD', 'pc1'), col('top', 'Poss time', 'mmss')] },
      { id: 'def', name: 'Defense & turnovers', cols: [col('pag', 'Opp/G', 'd1', 1), col('sacks', 'Sacks', 'i'), col('tfl', 'TFL', 'i'), col('defInt', 'INT', 'i'), col('take', 'Takeaways', 'i'), col('give', 'Giveaways', 'i', 1), col('toDiff', 'TO diff', 'sgn0'), col('sacked', 'Sacked', 'i', 1), col('penYpg', 'Pen yds/G', 'd1', 1)] });
    if (k === 'bb') v.push({ id: 'bat', name: 'Hitting', cols: [col('avg', 'AVG', 'avg'), col('obp', 'OBP', 'avg'), col('slg', 'SLG', 'avg'), col('ops', 'OPS', 'avg'), col('iso', 'ISO', 'avg'), col('woba', 'wOBA', 'avg'), col('bbp', 'BB%', 'pc1'), col('kp', 'K%', 'pc1', 1), col('babip', 'BABIP', 'avg'), col('hr', 'HR', 'i'), col('sb', 'SB', 'i')] },
      { id: 'pit', name: 'Pitching', cols: [col('era', 'ERA', 'd2', 1), col('fip', 'FIP', 'd2', 1, 'Fielding-independent pitching, scaled so the league FIP equals the league ERA'), col('whip', 'WHIP', 'd2', 1), col('k9', 'K/9', 'd2'), col('bb9', 'BB/9', 'd2', 1), col('hr9', 'HR/9', 'd2', 1), col('kbb', 'K/BB', 'd2'), col('oppOps', 'Opp OPS', 'avg', 1)] });
    if (k === 'hk') v.push({ id: 'shots', name: 'Shots & luck', cols: [col('sfg', 'Shots/G', 'd1'), col('sag', 'Shots agst/G', 'd1', 1), col('sshare', 'Shot share', 'pc1', 0, 'Share of all shots on goal in its games: a possession proxy'), col('shp', 'SH%', 'pc1'), col('svp', 'SV%', 'pc1'), col('pdo', 'PDO', 'd1', 0, 'Shooting % + save %: far above 100 tends to regress'), col('ppg', 'PP goals', 'i'), col('fo', 'Faceoff %', 'pc1'), col('pim', 'PIM/G', 'd1', 1)] });
    // every sport: one table of the advanced metrics analysts lead with (standings-based ones work everywhere)
    const pi = col('pi', 'Power idx', 'd1', 0, 'Composite: z-scores of scoring margin, Pythagorean (or xPts) and results, plus efficiency when team stats are loaded. 50 = average, each 15 = one standard deviation');
    const share = col('share', k === 'hk' || soc ? 'GF%' : k === 'bb' ? 'Run share' : 'Pts share', 'pc1', 0, 'Share of all points (goals, runs) scored in its games');
    const pyth = col('pyth', 'Pythag %', 'avg', 0, 'Win % expected from scoring (Pythagorean expectation)'), luck = col('luck', soc ? 'Pts − xPts' : 'W − Pythag', 'sgn1', 0, 'Results above what the scoring deserved');
    const adv = {
      bk: [pi, col('net', 'Net Rtg', 'sgn1', 0, 'Points per 100 possessions, scored minus allowed'), col('ortg', 'ORtg', 'd1'), col('drtg', 'DRtg', 'd1', 1), col('pace', 'Pace', 'd1', 0, 'Possessions per game'), col('ts', 'TS%', 'pc1'), col('efg', 'eFG%', 'pc1'), col('tovp', 'TOV%', 'pc1', 1), col('orbp', 'ORB% est', 'pc1', 0, 'Offensive rebounds ÷ (offensive rebounds + league-average opponent defensive rebounds)'), col('drbp', 'DRB% est', 'pc1', 0, 'Defensive rebound share, estimated against league-average offensive rebounding'), col('ftr', 'FT/FGA', 'd3'), col('astp', 'AST%', 'pc1', 0, 'Assists per made field goal'), col('par3', '3PA rate', 'pc1'), share, pyth, luck],
      fb: [pi, col('ptsPlay', 'Pts/play', 'd3', 0, 'Points scored per offensive play'), col('ypp', 'Yds/play', 'd2'), col('anya', 'ANY/A', 'd2', 0, 'Adjusted net yards per pass attempt: sacks count, +20 per TD, −45 per INT'), col('passRate', 'Pass rate', 'pc1', 0, 'Dropbacks per offensive play'), col('sackp', 'Sack %', 'pc1', 1, 'Sacks per dropback'), col('third', '3rd down', 'pc1'), col('rzTD', 'Red-zone TD', 'pc1'), col('toDiff', 'TO diff', 'sgn0'), col('giveG', 'Giveaways/G', 'd2', 1), share, pyth, luck],
      bb: [pi, col('wrcp', 'wRC+', 'i', 0, 'Team weighted runs created per plate appearance vs league (100 = average)'), col('opsp', 'OPS+', 'i'), col('woba', 'wOBA', 'avg'), col('iso', 'ISO', 'avg'), col('bsr', 'BsR/G', 'd2', 0, 'BaseRuns: runs per game the lineup\'s hits, walks and power should produce'), col('rbsr', 'R − BsR', 'sgn2', 0, 'Runs per game above BaseRuns: clutch hitting and sequencing, which mostly does not repeat'), col('erap', 'ERA+', 'i'), col('fipm', 'FIP−', 'i', 1), col('kbbp', 'K−BB%', 'pc1', 0, 'Pitching strikeout rate minus walk rate'), col('lob', 'LOB%', 'pc1', 0, 'Strand rate: share of baserunners allowed who did not score'), col('der', 'DER', 'avg', 0, 'Defensive efficiency: share of balls in play turned into outs'), share, pyth, luck],
      hk: [pi, share, col('sshare', 'Shot share', 'pc1'), col('pdo', 'PDO', 'd1'), col('shp', 'SH%', 'pc1'), col('svp', 'SV%', 'pc1'), col('ppPct', 'PP%', 'pc1'), col('pkPct', 'PK%', 'pc1'), col('sti', 'ST index', 'd1', 0, 'Power-play % + penalty-kill %: about 100 is average'), pyth, luck],
      sc: [pi, col('ppg', 'Pts/G', 'd2'), col('xppg', 'xPts/G', 'd2', 0, 'Expected points per game from goal rates (Poisson)'), luck, share, col('attS', 'Attack str', 'd2', 0, 'Goals scored per game ÷ league average (1.00 = average)'), col('defS', 'Defense str', 'd2', 1, 'Goals conceded per game ÷ league average (below 1.00 is better)'), col('wpct', 'Win %', 'pc1'), col('dpct', 'Draw %', 'pc1'), col('ppace', 'Points pace', 'd1', 0, 'Points per game × games in the season')]
    }[soc ? 'sc' : k];
    if (adv) v.push({ id: 'adv', name: 'Advanced', cols: adv });
    return v;
  }
  const recText = (lgId, m) => CFG[lgId].soccer ? `${m.w}-${m.t}-${m.l}` : `${m.w}-${m.l}${m.t ? '-' + m.t : ''}`;

  /* ---------------- state ---------------- */
  const SX = APP.SX = { lg: null, view: 'teams', season: null, tok: 0, tview: 'ov', tsort: null, tstat: null, board: null, psort: null, pdesc: true, pq: '', pteam: '', qual: true, px: null, py: null, pmore: false, hn: 15, hteam: null, sel: null, shifted: {} };
  function statsLeagues() { return LEAGUES.filter(l => CFG[l.id] && (live() || hasSnap(l.id))); }
  function hasSnap(id) { return !!(SNAPX && ((SNAPX.st && SNAPX.st[id]) || (SNAPX.pl && SNAPX.pl[id]) || (SNAPX.sc && SNAPX.sc[id]))); }
  const indivList = () => (APP.indiv && APP.indiv.ok() ? APP.indiv.sports : []);
  function pickLeague() {
    const ok = statsLeagues().map(l => l.id).concat(indivList().map(l => l.id));
    if (ok.includes(S.league)) return S.league; if (SX.lg && ok.includes(SX.lg)) return SX.lg;
    if (S.lastSpecific && ok.includes(S.lastSpecific)) return S.lastSpecific;
    return ok.includes('nfl') ? 'nfl' : ok[0];
  }
  function seasonNow(lgId) {
    const c = CFG[lgId], d = S.data[lgId] || {}, now = new Date(), y = now.getFullYear(), m = now.getMonth() + 1;
    let cur = d.season && d.season.year; const type = d.season && d.season.type;
    if (!cur) { if (c.endYear) cur = m >= 10 ? y + 1 : y; else if (c.startYear) cur = m >= 8 ? y : y - 1; else if (lgId === 'nfl' || lgId === 'ncaaf') cur = m >= 9 ? y : y - 1; else cur = m >= 4 ? y : y - 1; }
    return type === 1 ? cur - 1 : cur;
  }
  function seasonList(lgId) {
    const c = CFG[lgId];
    if (!live()) {
      const ys = new Set(Object.keys((SNAPX && SNAPX.st && SNAPX.st[lgId]) || {}).map(Number));
      const p = SNAPX && SNAPX.pl && SNAPX.pl[lgId]; if (p && p.y) ys.add(+p.y);
      const sc = SNAPX && SNAPX.sc && SNAPX.sc[lgId]; if (sc) { if (Array.isArray(sc)) ys.add(seasonNow(lgId)); else Object.keys(sc).forEach(k => ys.add(+k)); }
      return [...ys].sort((a, b) => b - a);
    }
    const out = []; for (let y = seasonNow(lgId); y >= c.first; y--) if (!(c.skip || []).includes(y)) out.push(y);
    return out;
  }
  function views(lgId) { return CFG[lgId].playersOnly ? ['players'] : ['teams', 'players', 'analytics', 'history']; }
  const VNAME = { teams: 'Team stats', players: 'Player stats', analytics: 'Advanced analytics', history: 'History' };

  /* ---------------- shell ---------------- */
  function srcLine(lgId, y, extra) {
    if (live()) return `<div class="srcline">ESPN · ${esc(seasonLabel(lgId, y))} regular season${extra ? ' · ' + extra : ''}</div>`;
    return `<div class="srcline">Snapshot data · ${esc(seasonLabel(lgId, y))}${extra ? ' · ' + extra : ''} · <a href="${APP.SITE_URL}#stats" target="_blank" rel="noopener">Every season &amp; stat, live ↗</a></div>`;
  }
  const skel = n => `<div class="panel panel-pad">${'<div class="skel-line"></div>'.repeat(n || 6)}</div>`;
  const errBox = what => `<div class="panel empty">Couldn't load ${esc(what)} from the live feed right now. <button type="button" class="btn" data-sx-retry>Try again</button></div>`;
  const prog = (id, lab) => `<div class="prog" id="${id}"><span class="lbl">${esc(lab)}</span><span class="bar"><i style="width:0%"></i></span><span class="n">0%</span></div>`;
  function setProg(id, d, n) { const el = document.getElementById(id); if (!el) return; const p = n ? Math.round(100 * d / n) : 0; el.querySelector('i').style.width = p + '%'; el.querySelector('.n').textContent = `${d}/${n}`; }
  function snapNotice(what) { return `<div class="notice"><div><b>${esc(what)} load from the live feed.</b> This copy runs on a snapshot, so it can't reach ESPN. Open <a href="${APP.SITE_URL}#stats" target="_blank" rel="noopener">the live version</a> for every season, team and player.</div></div>`; }

  function renderStats() {
    const el = $('#view-stats'); if (!el) return;
    if (S.mode === 'loading') { el.innerHTML = skel(8); return; }
    const lgs = statsLeagues(), ind = indivList();
    if (!lgs.length && !ind.length) { el.innerHTML = `<div class="sec-h"><h2>Stats center</h2></div>${snapNotice('Season stats')}`; return; }
    const lgId = pickLeague();
    if (SX.lg !== lgId) { Object.assign(SX, { lg: lgId, season: null, tview: 'ov', tsort: null, tstat: null, board: null, psort: null, pq: '', pteam: '', px: null, py: null, pmore: false, hteam: null, sel: null }); }
    const optsHTML = `<optgroup label="Team sports">${lgs.map(l => `<option value="${l.id}" ${l.id === lgId ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</optgroup>${ind.length ? `<optgroup label="Individual sports">${ind.map(l => `<option value="${l.id}" ${l.id === lgId ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</optgroup>` : ''}`;
    if (APP.indiv && APP.indiv.is(lgId)) {
      const vs = ['teams', 'players', 'analytics', 'history']; if (!vs.includes(SX.view)) SX.view = 'teams';
      const tok = ++SX.tok;
      el.innerHTML = `<div class="sec-h"><h2>Stats center</h2><span class="aside sx-ctl"><label class="sr" for="sx-lg">League</label><select id="sx-lg" class="sel">${optsHTML}</select></span></div>
        <div class="sx-nav" role="tablist" aria-label="Stats sections">${vs.map(v => `<button type="button" role="tab" data-sxv="${v}" aria-selected="${v === SX.view}">${APP.indiv.VN[v]}</button>`).join('')}</div><div id="sx-body" class="sx-body"></div>`;
      APP.indiv.view($('#sx-body'), lgId, SX.view, tok);
      return;
    }
    const seasons = seasonList(lgId);
    if (!SX.season || !seasons.includes(SX.season)) SX.season = seasons[0];
    const vs = views(lgId); if (!vs.includes(SX.view)) SX.view = vs[0];
    const tok = ++SX.tok, y = SX.season;
    const lgOpts = optsHTML;
    const sOpts = seasons.map(s => `<option value="${s}" ${s === y ? 'selected' : ''}>${esc(seasonLabel(lgId, s))}</option>`).join('');
    el.innerHTML = `<div class="sec-h"><h2>Stats center</h2><span class="aside sx-ctl"><label class="sr" for="sx-lg">League</label><select id="sx-lg" class="sel">${lgOpts}</select>${SX.view !== 'history' && seasons.length ? `<label class="sr" for="sx-season">Season</label><select id="sx-season" class="sel">${sOpts}</select>` : ''}</span></div>
      <div class="sx-nav" role="tablist" aria-label="Stats sections">${vs.map(v => `<button type="button" role="tab" data-sxv="${v}" aria-selected="${v === SX.view}">${VNAME[v]}</button>`).join('')}</div>
      <div id="sx-body" class="sx-body"></div>`;
    // on narrow screens the section nav scrolls sideways: keep the selected section in view after a re-render
    const nav = el.querySelector('.sx-nav'), cur = nav && nav.querySelector('[aria-selected="true"]');
    if (cur) { const r = cur.getBoundingClientRect(), nr = nav.getBoundingClientRect(); if (r.right > nr.right) nav.scrollLeft += r.right - nr.right + 16; }
    const body = $('#sx-body');
    if (!seasons.length) { body.innerHTML = snapNotice('Season stats'); return; }
    ({ teams: viewTeams, players: viewPlayers, analytics: viewAnalytics, history: viewHistory })[SX.view](body, lgId, y, tok);
  }
  APP.renderStats = renderStats;
  const alive = tok => tok === SX.tok && S.tab === 'stats';
  // after the first load, fall back one season if the newest one has no games yet (NBA/NHL in October)
  function maybeShift(lgId, y, empty) {
    if (!empty || SX.shifted[lgId]) return false;
    const list = seasonList(lgId), i = list.indexOf(y);
    if (i === 0 && list[1]) { SX.shifted[lgId] = y; SX.season = list[1]; renderStats(); return true; }
    return false;
  }
  const shiftNote = (lgId, y) => SX.shifted[lgId] && SX.shifted[lgId] !== y ? `<div class="notice"><div>The ${esc(seasonLabel(lgId, SX.shifted[lgId]))} season hasn't produced stats yet, so this shows ${esc(seasonLabel(lgId, y))}.</div></div>` : '';

  /* ---------------- Teams ---------------- */
  async function viewTeams(el, lgId, y, tok) {
    el.innerHTML = skel(10);
    let rows; try { rows = await loadStandings(lgId, y); } catch (e) { if (alive(tok)) el.innerHTML = errBox('standings'); return; }
    if (!alive(tok)) return;
    if (maybeShift(lgId, y, !rows.some(r => r.gp > 0))) return;
    await attachAP(lgId, y, rows); if (!alive(tok)) return;
    const d = db(lgId, y), need = live() && d.ts === undefined && !CFG[lgId].soccer;
    drawTeams(el, lgId, y, rows, d.ts || null, need);
    if (need) {
      loadTeamStats(lgId, y, (a, n) => setProg('sx-tsprog', a, n)).then(ts => { if (alive(tok)) drawTeams(el, lgId, y, rows, ts, false); }).catch(() => { if (alive(tok)) drawTeams(el, lgId, y, rows, null, false); });
    }
  }
  function drawTeams(el, lgId, y, rows, TS, loading) {
    const k = kindOf(lgId), list = teamMetrics(lgId, rows, TS), vs = teamViews(lgId).filter(v => v.id === 'ov' || v.id === 'adv' || TS);
    if (!vs.some(v => v.id === SX.tview)) SX.tview = 'ov';
    const view = vs.find(v => v.id === SX.tview), cols = view.cols.filter(c => c.key === 'rec' || list.some(t => fin(t.m[c.key])));
    const defKey = view.id === 'adv' && list.some(t => fin(t.m.pi)) ? 'pi' : CFG[lgId].soccer ? 'pts' : 'wp';
    const sk = SX.tsort && (cols.some(c => c.key === SX.tsort.k) || SX.tsort.k === 'name') ? SX.tsort : { k: defKey, desc: true };
    const val = t => sk.k === 'name' ? t.name : sk.k === 'rec' ? t.m.wp : t.m[sk.k];
    list.sort((a, b) => { if (sk.k === 'name') return sk.desc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name); const va = val(a), vb = val(b); if (!fin(va)) return 1; if (!fin(vb)) return -1; return sk.desc ? vb - va : va - vb; });
    const th = c => `<th title="${esc(c.desc)}"${c.key === 'rec' ? ' data-vz-skip' : ''} aria-sort="${sk.k === c.key ? (sk.desc ? 'descending' : 'ascending') : 'none'}"><button type="button" data-sxt-sort="${c.key}"${c.low ? ' data-low="1"' : ''}>${esc(c.lab)}${sk.k === c.key ? (sk.desc ? ' ▾' : ' ▴') : ''}</button></th>`;
    const cell = (t, c) => c.key === 'rec' ? recText(lgId, t.m) : fmt(c.f, t.m[c.key]);
    const body = list.map((t, i) => `<tr data-sx-team="${esc(t.key)}" data-lab="${esc(t.abbr)}" data-name="${esc(t.name)}" class="${SX.sel === t.key ? 'sel' : ''}"><td class="rk">${i + 1}</td><td class="l"><span class="team">${badge(lgId, { abbr: t.abbr, color: t.color })}<span>${esc(t.name)}</span>${t.clinch ? `<span class="clinch">${esc(t.clinch)}</span>` : ''}</span></td><td>${t.m.gp || 0}</td>${cols.map(c => `<td>${cell(t, c)}</td>`).join('')}</tr>`).join('');
    const seg = vs.length > 1 ? `<span class="seg" role="group" aria-label="Stat group">${vs.map(v => `<button type="button" data-sxt-view="${v.id}" aria-pressed="${v.id === SX.tview}">${esc(v.name)}</button>`).join('')}</span>` : '';
    const note = loading ? prog('sx-tsprog', 'Loading every team\'s season stats') : (live() && !TS ? '<span class="note">Detailed team stats are unavailable for this season; showing standings-based metrics.</span>' : !live() ? '<span class="note">Snapshot: standings-based metrics. Efficiency, shooting and pitching splits load live.</span>' : '');
    el.innerHTML = shiftNote(lgId, y) + `<div class="panel">
        <div class="ptool">${seg}${note}</div>
        <div class="vz" data-vz="teams" data-vz-attr="data-sx-team" data-vz-n="15"><div class="tbl-wrap"><table class="tbl sx"><caption class="sr">${esc(LG[lgId].name)} team stats</caption><thead><tr><th>#</th><th class="l"><button type="button" data-sxt-sort="name">Team</button></th><th data-vz-skip>GP</th>${cols.map(th).join('')}</tr></thead><tbody>${body}</tbody></table></div></div></div>
      <div class="panel panel-pad" id="sx-explore"></div>` + srcLine(lgId, y, 'click a team for its profile');
    drawExplorer(lgId, y, list, TS);
  }
  function explorerOptions(lgId, list, TS) {
    const groups = [], seen = new Set();
    const comp = []; for (const v of teamViews(lgId)) for (const c of v.cols) if (c.key !== 'rec' && !seen.has(c.key) && list.some(t => fin(t.m[c.key]))) { seen.add(c.key); comp.push({ k: 'm:' + c.key, lab: c.lab, f: c.f, low: c.low, desc: c.desc }); }
    groups.push(['Key & advanced metrics', comp]);
    if (TS) {
      const first = list.find(t => t.T); const cats = {};
      if (first) for (const [key, r] of Object.entries(first.T)) { if (!key.includes('.') || !list.some(t => t.T && t.T[key] && fin(t.T[key].v))) continue; (cats[r.cat] = cats[r.cat] || []).push({ k: 't:' + key, lab: r.name, f: 'raw', low: LOWER.test(key) }); }
      for (const [cat, arr] of Object.entries(cats)) groups.push([cat, arr]);
    }
    return groups;
  }
  function drawExplorer(lgId, y, list, TS) {
    const box = $('#sx-explore'); if (!box) return;
    const groups = explorerOptions(lgId, list, TS), all = groups.flatMap(g => g[1]);
    if (!all.length) { box.innerHTML = ''; return; }
    let cur = all.find(o => o.k === SX.tstat); if (!cur) { cur = all.find(o => o.k === (CFG[lgId].soccer ? 'm:luck' : 'm:mov')) || all[0]; SX.tstat = cur.k; }
    const getv = t => cur.k.startsWith('m:') ? t.m[cur.k.slice(2)] : (t.T && t.T[cur.k.slice(2)] ? t.T[cur.k.slice(2)].v : NaN);
    const disp = t => cur.k.startsWith('m:') ? fmt(cur.f, getv(t)) : (t.T && t.T[cur.k.slice(2)] ? t.T[cur.k.slice(2)].dv : '—');
    const rows = list.filter(t => fin(getv(t))).sort((a, b) => cur.low ? getv(a) - getv(b) : getv(b) - getv(a));
    const avg = mean(rows.map(getv));
    const opts = groups.map(([g, arr]) => `<optgroup label="${esc(g)}">${arr.map(o => `<option value="${esc(o.k)}" ${o.k === cur.k ? 'selected' : ''}>${esc(o.lab)}</option>`).join('')}</optgroup>`).join('');
    box.innerHTML = `<div class="sec-h"><h2 style="font-size:18px">Stat explorer</h2><span class="aside"><label for="sx-tstat" class="sr">Stat</label><select id="sx-tstat" class="sel">${opts}</select></span></div>
      <p class="note" style="margin:4px 0 8px">${esc(cur.desc || 'Every team ranked on one stat')} · ${cur.low ? 'lower is better, best at top' : 'best at top'} · dashed line = league average.</p>
      <div class="scroll-x"><div class="minw">${C.dots(rows.map(t => ({ lab: t.abbr, name: t.name, v: getv(t), disp: disp(t), sel: t.key === SX.sel, key: t.key })), { avg, avgLab: 'avg ' + (cur.k.startsWith('m:') ? fmt(cur.f, avg) : C.fmtAuto(avg)), attr: 'data-sx-team', aria: cur.lab + ' by team' })}</div></div>`;
  }

  /* ---------------- Players ---------------- */
  async function viewPlayers(el, lgId, y, tok) {
    const k = kindOf(lgId);
    if (CFG[lgId].soccer) return viewSoccerPlayers(el, lgId, y, tok);
    const B0 = BOARDS[k]; if (!B0) { el.innerHTML = '<div class="panel empty">No player leaderboards for this league.</div>'; return; }
    // the snapshot only carries some leaderboards for some leagues: offer the ones it has
    const snapPl = SNAPX && SNAPX.pl && SNAPX.pl[lgId], B = live() || !snapPl ? B0 : Object.assign({}, B0, { list: B0.list.filter(b => snapPl.reqs && snapPl.reqs[b.req]) });
    if (!B.list.length) { el.innerHTML = snapNotice('Player leaderboards for this league'); return; }
    let bd = B.list.find(b => b.id === SX.board) || B.list[0]; SX.board = bd.id;
    el.innerHTML = `<div class="panel"><div class="ptool"><span class="seg" role="group" aria-label="Leaderboard">${B.list.map(b => `<button type="button" data-sxb="${b.id}" aria-pressed="${b.id === bd.id}">${esc(b.name)}</button>`).join('')}</span></div>${skel(8)}</div>`;
    let data; try { data = await loadBoard(lgId, y, bd.req); } catch (e) { if (alive(tok)) el.innerHTML = errBox('player stats'); return; }
    if (!alive(tok)) return;
    if (!data || !data.rows.length) {
      if (live() && maybeShift(lgId, y, true)) return;
      el.innerHTML = live() ? `<div class="panel empty">No qualified players yet for ${esc(seasonLabel(lgId, y))}.</div>` : snapNotice(`Player leaderboards for ${seasonLabel(lgId, y)}`);
      return;
    }
    drawPlayers(el, lgId, y, B, bd, data);
  }
  // league baselines for rate stats: computed from every team's season stats when they are loaded, otherwise recent MLB/NBA norms
  function lgConst(lgId, y) {
    const c = { usgL: lgId === 'wnba' ? 40 : 48, lgPlays: lgId === 'wnba' ? 90 : 112, lgOBP: 0.315, lgSLG: 0.405, lgwOBA: 0.31, lgRPA: 0.118, lgERA: 4.1 };
    const d = DB.get(lgId + '|' + y), TS = d && d.ts; if (!TS) return c;
    const tl = Object.values(TS), k = kindOf(lgId);
    if (k === 'bk') { const pl = tl.map(T => tv(T, 'offensive.avgFieldGoalsAttempted', 'avgFieldGoalsAttempted') + 0.44 * tv(T, 'offensive.avgFreeThrowsAttempted', 'avgFreeThrowsAttempted') + tv(T, 'offensive.avgTurnovers', 'avgTurnovers')).filter(fin); if (pl.length > 5) c.lgPlays = mean(pl); }
    if (k === 'bb') {
      const S = key => tl.reduce((a, T) => a + (fin(tv(T, key)) ? tv(T, key) : 0), 0);
      const ab = S('batting.atBats'), h = S('batting.hits'), d2 = S('batting.doubles'), d3 = S('batting.triples'), hr = S('batting.homeRuns'), bb = S('batting.walks'), hbp = S('batting.hitByPitch'), sf = S('batting.sacFlies'), pa = S('batting.plateAppearances'), s1 = h - d2 - d3 - hr;
      if (ab > 1000) {
        c.lgOBP = (h + bb + hbp) / (ab + bb + hbp + sf); c.lgSLG = (s1 + 2 * d2 + 3 * d3 + 4 * hr) / ab;
        c.lgwOBA = (0.69 * bb + 0.88 * s1 + 1.25 * d2 + 1.58 * d3 + 2.03 * hr) / (ab + bb);
        const runs = (d.rows || []).reduce((a, r) => a + (fin(r.pf) ? r.pf : 0), 0); if (runs > 0 && pa > 0) c.lgRPA = runs / pa;
        const ip = tl.reduce((a, T) => a + (fin(ipOf(tv(T, 'pitching.innings'))) ? ipOf(tv(T, 'pitching.innings')) : 0), 0), er = S('pitching.earnedRuns'); if (ip > 100) c.lgERA = 9 * er / ip;
      }
    }
    return c;
  }
  function boardContext(bd, rows, lgId) {
    const c = Object.assign({ lgSv: 0.905, cFip: 3.15 }, lgConst(lgId, SX.season));
    const g = rows.filter(r => fin(r.v['defensive.saves']) && fin(r.v['defensive.shotsAgainst']) && r.v['defensive.shotsAgainst'] > 100);
    if (g.length >= 5) c.lgSv = g.reduce((s, r) => s + r.v['defensive.saves'], 0) / g.reduce((s, r) => s + r.v['defensive.shotsAgainst'], 0);
    const p = rows.filter(r => fin(r.v['pitching.innings']) && fin(r.v['pitching.earnedRuns']) && ipOf(r.v['pitching.innings']) > 0);
    if (p.length >= 10) { const ip = p.reduce((s, r) => s + ipOf(r.v['pitching.innings']), 0), er = p.reduce((s, r) => s + r.v['pitching.earnedRuns'], 0), fr = p.reduce((s, r) => s + 13 * r.v['pitching.homeRuns'] + 3 * r.v['pitching.walks'] - 2 * r.v['pitching.strikeouts'], 0); c.cFip = 9 * er / ip - fr / ip; }
    return c;
  }
  function colMeta(k, meta) {
    if (k.startsWith('x.')) { const x = X[k.slice(2)]; return x ? { lab: x[0], full: x[0], desc: x[3], f: x[1] } : null; }
    const m = meta[k]; if (!m) return null;
    return { lab: m.lab, full: m.full, desc: m.desc || m.full, f: statFmt(k, m.lab) };
  }
  function statFmt(k, lab) {
    if (/\.(avg|onBasePct|slugAvg|OPS)$/.test(k) || /savePct$/.test(k)) return 'avg';
    if (/(ERA|WHIP|avgGoalsAgainst)$/.test(k)) return 'd2';
    if (/innings$/.test(k)) return 'ip';
    if (/timeOnIcePerGame$/.test(k)) return 'mmss';
    if (/Pct$|Percent$/.test(k) || /%$/.test(lab || '')) return 'pc1r';
    return 'auto';
  }
  function pfmt(f, v) {
    if (!fin(v)) return '—';
    if (f === 'ip') return v.toFixed(1);
    if (f === 'pc1r') return v.toFixed(1);
    if (f === 'auto') return Number.isInteger(v) ? v.toLocaleString() : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);
    return fmt(f, v);
  }
  function drawPlayers(el, lgId, y, B, bd, data) {
    const ctx = boardContext(bd, data.rows, lgId);
    let rows = data.rows.filter(r => !bd.only || bd.only(r));
    for (const r of rows) for (const [key, x] of Object.entries(X)) { const v = x[2](r.v, ctx); r.v['x.' + key] = fin(v) ? v : NaN; }
    const cols = bd.cols.map(k => ({ k, m: colMeta(k, data.meta) })).filter(c => c.m && rows.some(r => fin(r.v[c.k])));
    for (const c of cols) if (c.m.f === 'auto') c.m.f = rows.every(r => !fin(r.v[c.k]) || Number.isInteger(r.v[c.k])) ? 'i' : 'd1';
    const gpKey = cols.find(c => /gamesPlayed$|\.games$/.test(c.k));
    const maxGP = gpKey ? Math.max(0, ...rows.map(r => r.v[gpKey.k] || 0)) : 0;
    const qualN = B.minGP && gpKey ? Math.max(1, Math.floor(maxGP * B.minGP)) : 0;
    const pool0 = rows.length;
    if (SX.qual && qualN) rows = rows.filter(r => (r.v[gpKey.k] || 0) >= qualN);
    const teams = [...new Set(rows.map(r => r.team).filter(Boolean))].sort();
    let shown = rows.filter(r => (!SX.pteam || r.team === SX.pteam) && (!SX.pq || APP.norm(r.name).includes(APP.norm(SX.pq))));
    const sk = SX.psort && cols.some(c => c.k === SX.psort) ? SX.psort : (cols.some(c => c.k === bd.sortBy) ? bd.sortBy : cols[0] && cols[0].k);
    const desc = SX.psort === sk ? SX.pdesc : !LOWER.test(sk);
    shown.sort((a, b) => { const va = a.v[sk], vb = b.v[sk]; if (!fin(va)) return 1; if (!fin(vb)) return -1; return desc ? vb - va : va - vb; });
    const lim = SX.pmore ? shown.length : 50;
    const th = c => `<th title="${esc(c.m.desc || c.m.full)}"${LOWER.test(c.k) ? ' data-low' : ''}${/gamesPlayed$|\.games$/.test(c.k) ? ' data-vz-skip' : ''} aria-sort="${sk === c.k ? (desc ? 'descending' : 'ascending') : 'none'}"><button type="button" data-sxp-sort="${esc(c.k)}">${esc(c.m.lab)}${sk === c.k ? (desc ? ' ▾' : ' ▴') : ''}</button></th>`;
    const body = shown.slice(0, lim).map((r, i) => `<tr data-sx-player="${esc(r.id)}" data-lab="${esc(r.name.split(' ').slice(-1)[0])}" data-name="${esc(r.name)} (${esc(r.team)})" class="${SX.selP === r.id ? 'sel' : ''}"><td class="rk">${i + 1}</td><td class="l"><span class="pl"><b>${esc(r.name)}</b><span class="muted">${esc(r.team)}${r.pos ? ' · ' + esc(r.pos) : ''}</span></span></td>${cols.map(c => `<td>${pfmt(c.m.f, r.v[c.k])}</td>`).join('')}</tr>`).join('');
    const nums = cols.filter(c => c.m.f !== 'mmss' || true);
    if (!SX.px || !nums.some(c => c.k === SX.px)) SX.px = bd.xy[0]; if (!SX.py || !nums.some(c => c.k === SX.py)) SX.py = bd.xy[1];
    if (!nums.some(c => c.k === SX.px)) SX.px = nums[0] && nums[0].k; if (!nums.some(c => c.k === SX.py)) SX.py = nums[1] && nums[1].k;
    const axSel = (id, cur) => `<select id="${id}" class="sel">${nums.map(c => `<option value="${esc(c.k)}" ${c.k === cur ? 'selected' : ''}>${esc(c.m.lab)}</option>`).join('')}</select>`;
    el.innerHTML = `<div class="panel">
        <div class="ptool"><span class="seg" role="group" aria-label="Leaderboard">${B.list.map(b => `<button type="button" data-sxb="${b.id}" aria-pressed="${b.id === bd.id}">${esc(b.name)}</button>`).join('')}</span>
          <span class="tools"><label class="search sm"><span class="sr">Find a player</span><input id="sx-pq" type="search" placeholder="Find a player" value="${esc(SX.pq)}" autocomplete="off"></label>
          <label class="sr" for="sx-pteam">Team</label><select id="sx-pteam" class="sel"><option value="">All teams</option>${teams.map(t => `<option ${t === SX.pteam ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
          ${qualN ? `<label class="chk"><input type="checkbox" id="sx-qual" ${SX.qual ? 'checked' : ''}> Min ${qualN} games</label>` : ''}</span></div>
        <div class="vz" data-vz="players" data-vz-attr="data-sx-player" data-vz-n="15" data-vz-types="bars,dots,avg"><div class="tbl-wrap"><table class="tbl sx"><caption class="sr">${esc(bd.name)} leaders</caption><thead><tr><th>#</th><th class="l">Player</th>${cols.map(th).join('')}</tr></thead><tbody>${body || `<tr><td colspan="${cols.length + 2}" class="l muted">No players match.</td></tr>`}</tbody></table></div></div>
        ${shown.length > lim ? `<div class="more-row" style="padding:10px"><button type="button" class="btn" data-sx-more>Show all ${shown.length}</button></div>` : ''}</div>
      <div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Compare any two stats</h2><span class="aside xy"><label for="sx-px">X</label>${axSel('sx-px', SX.px)}<label for="sx-py">Y</label>${axSel('sx-py', SX.py)}</span></div><div id="sx-scatter"></div></div>`
      + srcLine(lgId, y, `${data.snap ? 'top of the leaderboard' : pool0 + ' players'} · computed columns: ${cols.filter(c => c.k.startsWith('x.')).map(c => c.m.lab).join(', ') || 'none'} · click a player for game logs and career`);
    const cx = nums.find(c => c.k === SX.px), cy = nums.find(c => c.k === SX.py);
    const pts = shown.map(r => ({ x: r.v[SX.px], y: r.v[SX.py], key: r.id, label: r.name.split(' ').slice(-1)[0], sel: SX.selP === r.id, tip: `${esc(r.name)} (${esc(r.team)})<br>${esc(cx.m.lab)} <b>${pfmt(cx.m.f, r.v[SX.px])}</b> · ${esc(cy.m.lab)} <b>${pfmt(cy.m.f, r.v[SX.py])}</b>` }));
    const lowY = LOWER.test(SX.py);
    pts.slice().filter(p => fin(p.y) && fin(p.x)).sort((a, b) => lowY ? a.y - b.y : b.y - a.y).slice(0, 7).forEach(p => { p.emph = true; });
    $('#sx-scatter').innerHTML = C.scatter(pts, { xLab: cx.m.full || cx.m.lab, yLab: cy.m.full || cy.m.lab, refX: mean(pts.map(p => p.x)), refY: mean(pts.map(p => p.y)), invertY: lowY, attr: 'data-sx-player', xFmt: v => pfmt(cx.m.f === 'mmss' ? 'mmss' : 'auto2', v), yFmt: v => pfmt(cy.m.f === 'mmss' ? 'mmss' : 'auto2', v), aria: `${cy.m.lab} versus ${cx.m.lab}` }) + `<div class="legend">Dashed lines mark the average of the players shown · labels: top 7 by ${esc(cy.m.lab)}${lowY ? ' (lower is better, so the axis is flipped)' : ''}</div>`;
    SX._rows = data.rows; SX._meta = data.meta;
  }
  F.auto2 = v => C.fmtAuto(v);
  async function viewSoccerPlayers(el, lgId, y, tok) {
    el.innerHTML = skel(8);
    let lists; try { lists = await soccerLeaders(lgId, y); } catch (e) { if (alive(tok)) el.innerHTML = errBox('player stats'); return; }
    if (!alive(tok)) return;
    if (!lists) { el.innerHTML = live() ? '<div class="panel empty">No leaders published for this season.</div>' : snapNotice('Player leaderboards for this league'); return; }
    // team goals for goal share
    const gf = {}; try { const rows = await loadStandings(lgId, y); for (const r of rows) if (fin(r.pf)) { gf[r.key] = r.pf; gf[APP.norm(r.name)] = r.pf; } } catch (e) { /* standings optional */ }
    if (!alive(tok)) return;
    const teamGF = r => { const t = gf[r.team]; return fin(t) ? t : gf[APP.norm(r.team || '')]; };
    const all = lists.slice(), G = lists.find(L => /goal/i.test(L.key || L.name)), As = lists.find(L => /assist/i.test(L.key || L.name));
    if (G && As) {
      const m = new Map();
      for (const r of G.rows) m.set(r.id || r.name, Object.assign({}, r, { g: r.v, a: 0 }));
      for (const r of As.rows) { const key = r.id || r.name, e = m.get(key) || Object.assign({}, r, { g: 0, a: 0 }); e.a = r.v; m.set(key, e); }
      all.push({ name: 'Goals + assists', key: 'ga', ga: true, rows: [...m.values()].map(r => Object.assign(r, { v: (fin(r.g) ? r.g : 0) + (fin(r.a) ? r.a : 0) })).sort((x, y2) => y2.v - x.v) });
    }
    const vlab = L => L.ga ? 'G+A' : /assist/i.test(L.key || L.name) ? 'A' : /goal/i.test(L.key || L.name) ? 'G' : 'Value';
    el.innerHTML = `<div class="sx-two">${all.map(L => {
      const isG = !L.ga && /goal/i.test(L.key || L.name), share = isG && L.rows.some(r => fin(teamGF(r)));
      const rows = L.rows.slice(0, 25).map((r, i) => { const t = teamGF(r); return `<tr data-lab="${esc(String(r.name).split(' ').slice(-1)[0])}" data-name="${esc(r.name)} (${esc(r.team)})"><td class="rk">${i + 1}</td><td class="l"><b>${esc(r.name)}</b></td><td data-vz-skip>${esc(r.team)}</td><td>${fin(r.v) ? r.v : esc(r.dv)}</td>${L.ga ? `<td>${fin(r.g) ? r.g : 0}</td><td>${fin(r.a) ? r.a : 0}</td>` : ''}${share ? `<td>${fin(t) && t > 0 && fin(r.v) ? F.pc1(100 * r.v / t) : '—'}</td>` : ''}</tr>`; }).join('');
      return `<div class="panel"><div class="ptool"><b>${esc(L.name)}</b>${share ? '<span class="note">Goal share = player goals ÷ team league goals</span>' : ''}</div><div class="vz" data-vz="soc-leaders" data-vz-types="bars,dots" data-vz-n="10" data-vz-on="0"><div class="tbl-wrap"><table class="tbl sx"><thead><tr><th>#</th><th class="l">Player</th><th data-vz-skip>Team</th><th>${vlab(L)}</th>${L.ga ? '<th>G</th><th>A</th>' : ''}${share ? '<th title="Share of the team\'s league goals">Goal share</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div></div></div>`;
    }).join('')}</div>` + srcLine(lgId, y);
  }

  /* ---------------- Analytics ---------------- */
  function powerHTML(lgId, list) {
    const c = CFG[lgId], k = kindOf(lgId), soc = c.soccer, [PF] = UNIT[k];
    const L = list.filter(t => fin(t.m.pi)).sort((a, b) => b.m.pi - a.m.pi);
    if (L.length < 3) return '';
    const eff = { bk: ['net', 'Net Rtg', F.sgn1], fb: ['ypp', 'Yds/play', F.d2], hk: ['sshare', 'Shot share', F.pc1] }[k];
    const hasEff = !!eff && L.some(t => fin(t.m[eff[0]]));
    const dp = k === 'bb' || k === 'hk' || soc ? F.sgn2 : F.sgn1;
    const head = `<tr><th>#</th><th class="l">Team</th><th title="Composite rating: 50 = average">Power idx</th>${soc ? '<th>Pts/G</th><th title="Expected points per game from goal rates">xPts/G</th><th>Pts − xPts</th>' : '<th>Win %</th><th>Pythag %</th><th>W − Pythag</th>'}<th>Margin/G</th><th>${soc || k === 'hk' ? 'GF%' : 'Scoring share'}</th>${hasEff ? `<th>${eff[1]}</th>` : ''}</tr>`;
    const body = L.map((t, i) => `<tr data-sx-team="${esc(t.key)}" data-lab="${esc(t.abbr)}" data-name="${esc(t.name)}" class="${t.key === SX.sel ? 'sel' : ''}"><td class="rk">${i + 1}</td><td class="l"><span class="team">${badge(lgId, { abbr: t.abbr, color: t.color })}<span>${esc(t.name)}</span></span></td><td><b>${F.d1(t.m.pi)}</b></td>${soc ? `<td>${F.d2(t.m.ppg)}</td><td>${F.d2(t.m.xppg)}</td><td>${F.sgn1(t.m.luck)}</td>` : `<td>${F.avg(t.m.wp)}</td><td>${F.avg(t.m.pyth)}</td><td>${F.sgn1(t.m.luck)}</td>`}<td>${dp(t.m.mov)}</td><td>${F.pc1(t.m.share)}</td>${hasEff ? `<td>${eff[2](t.m[eff[0]])}</td>` : ''}</tr>`).join('');
    const comps = soc ? 'goal difference, expected points and points per game' : `${esc(PF.toLowerCase())} margin, Pythagorean win % and record${hasEff ? ' plus ' + eff[1].toLowerCase() : ''}`;
    return `<div class="panel"><div class="ptool"><b>Power index</b><span class="note">A composite of ${comps}: 50 = league average, every 15 points = one standard deviation.</span></div><div class="vz" data-vz="power" data-vz-attr="data-sx-team" data-vz-def="Power idx" data-vz-n="15"><div class="tbl-wrap"><table class="tbl sx"><caption class="sr">Power index ranking</caption><thead>${head}</thead><tbody>${body}</tbody></table></div></div></div>`;
  }
  // one or two scatter plots that carry each sport's signature advanced analysis
  function sigHTML(lgId, list) {
    const k = kindOf(lgId), soc = CFG[lgId].soccer, L = list.filter(t => t.m.gp > 0);
    const sc = (xk, yk, o) => {
      const pts = L.filter(t => fin(t.m[xk]) && fin(t.m[yk])).map(t => ({ x: t.m[xk], y: t.m[yk], key: t.key, label: t.abbr, sel: t.key === SX.sel, emph: true, tip: `${esc(t.name)}<br>${esc(o.xl)} <b>${o.xf(t.m[xk])}</b> · ${esc(o.yl)} <b>${o.yf(t.m[yk])}</b>` }));
      if (pts.length < 4) return '';
      const mx = mean(pts.map(p => p.x)), my = mean(pts.map(p => p.y));
      return `<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">${esc(o.title)}</h2><span class="aside">${esc(o.aside)}</span></div>${C.scatter(pts, { xLab: o.xl + (o.xlo ? ' (lower is better)' : ''), yLab: o.yl + (o.inv ? ' (fewer is higher)' : ''), xFmt: o.xf, yFmt: o.yf, refX: o.diag ? null : (o.rx != null ? o.rx : mx), refY: o.diag ? null : (o.ry != null ? o.ry : my), diag: !!o.diag, diagLab: o.diagLab, invertY: !!o.inv, quad: o.quad, attr: 'data-sx-team', h: o.h || 360, aria: o.title })}${o.note ? `<p class="note">${o.note}</p>` : ''}</div>`;
    };
    if (soc) return sc('attS', 'defS', { title: 'Attack vs defense strength', aside: 'Goals scored and conceded per game relative to the league average (1.00)', xl: 'Attack strength', yl: 'Defense strength', xf: F.d2, yf: F.d2, rx: 1, ry: 1, inv: true, quad: { tr: 'Dominant', tl: 'Hard to beat', br: 'Entertaining', bl: 'In trouble' }, note: 'These two ratios are the inputs of the Poisson (Dixon–Coles) models that price soccer matches.' });
    if (k === 'bk') return sc('ortg', 'drtg', { title: 'Efficiency landscape', aside: 'Points scored and allowed per 100 possessions · up and right is better', xl: 'Offensive rating', yl: 'Defensive rating', xf: F.d1, yf: F.d1, inv: true, h: 400, quad: { tr: 'Two-way contenders', tl: 'Defense-led', br: 'Offense-led', bl: 'Rebuilding' }, note: 'Net rating (offense minus defense) predicts future results better than win-loss record.' });
    if (k === 'bb') return `<div class="sx-two">${sc('bsr', 'pfg', { title: 'Sequencing luck', aside: 'Runs per game vs BaseRuns (what the hits, walks and power should produce)', xl: 'BaseRuns per game', yl: 'Actual runs per game', xf: F.d2, yf: F.d2, diag: true, diagLab: 'runs = BaseRuns', h: 320, note: 'Above the line: clutch hitting or timely sequencing, which rarely repeats.' })}${sc('fip', 'era', { title: 'Pitching luck', aside: 'Team ERA vs FIP (strikeouts, walks and homers only)', xl: 'FIP', yl: 'ERA', xf: F.d2, yf: F.d2, diag: true, diagLab: 'ERA = FIP', h: 320, note: 'Above the line: ERA worse than the peripherals, usually defense or bad luck on balls in play.' })}</div>`;
    if (k === 'fb') { const byTO = L.filter(t => fin(t.m.toDiff)).sort((a, b) => b.m.toDiff - a.m.toDiff); return `<div class="sx-two">${sc('ypp', 'pfg', { title: 'Efficiency vs scoring', aside: 'Yards per play against points per game', xl: 'Yards per play', yl: 'Points per game', xf: F.d2, yf: F.d1, h: 320, note: 'Teams above the pack turn yards into points: red-zone execution, field position and turnovers.' })}${byTO.length >= 4 ? `<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Turnover margin</h2><span class="aside">Takeaways minus giveaways · large margins rarely last</span></div>${C.hbars(byTO.map(t => ({ lab: t.abbr, name: t.name, v: t.m.toDiff, disp: F.sgn0(t.m.toDiff), sel: t.key === SX.sel, key: t.key })), { fmt: v => (v > 0 ? '+' : '') + Math.round(v), attr: 'data-sx-team', aria: 'Turnover margin' })}</div>` : ''}</div>`; }
    if (k === 'hk') return sc('sshare', 'pdo', { title: 'Luck vs control', aside: 'PDO (shooting % + save %) against shot share', xl: 'Shot share (%)', yl: 'PDO', xf: F.d1, yf: F.d1, rx: 50, ry: 100, h: 400, quad: { tr: 'Good and lucky', tl: 'Riding the bounces', br: 'Due for better luck', bl: 'Struggling' }, note: 'PDO drifts back toward 100; shot share is the more repeatable skill.' });
    return '';
  }
  function glossaryHTML(lgId) {
    const G = APP.GLOSS; if (!G) return '';
    const key = CFG[lgId].soccer ? 'sc' : kindOf(lgId), rows = [...(G[key] || []), ...G.all];
    return `<details class="panel gloss" open><summary><b>Metric guide</b><span class="note">${rows.length} advanced metrics for ${esc(LG[lgId].name)}: what each tells you and how it is computed here</span></summary><div class="tbl-wrap"><table class="tbl sx gl"><thead><tr><th class="l">Metric</th><th class="l">What it tells you</th><th class="l">How it is computed</th><th class="l">Where</th></tr></thead><tbody>${rows.map(r => `<tr${r[4] ? ' class="na"' : ''}><td class="l"><b>${esc(r[0])}</b></td><td class="l">${esc(r[1])}</td><td class="l">${esc(r[2])}</td><td class="l">${r[4] ? '<span class="clinch">needs tracking data</span>' : esc(r[3])}</td></tr>`).join('')}</tbody></table></div></details>`;
  }
  async function viewAnalytics(el, lgId, y, tok) {
    el.innerHTML = skel(10);
    let rows; try { rows = await loadStandings(lgId, y); } catch (e) { if (alive(tok)) el.innerHTML = errBox('standings'); return; }
    if (!alive(tok)) return;
    if (maybeShift(lgId, y, !rows.some(r => r.gp > 0))) return;
    const c = CFG[lgId], k = kindOf(lgId), soc = c.soccer, d = db(lgId, y), list = teamMetrics(lgId, rows, d.ts || null).filter(t => t.m.gp > 0);
    const [PF, PA] = UNIT[k];
    const hasPF = list.some(t => fin(t.m.pfg));
    // 1) luck vs scoring
    let luckHTML = '';
    if (hasPF) {
      const byLuck = list.filter(t => fin(t.m.luck)).sort((a, b) => b.m.luck - a.m.luck);
      const lucky = byLuck.slice(0, 3), unlucky = byLuck.slice(-3).reverse();
      const emph = new Set([...lucky, ...unlucky].map(t => t.key));
      const rmse = Math.sqrt(mean(byLuck.map(t => t.m.luck * t.m.luck)));
      const pts = list.map(t => soc
        ? { x: t.m.xpts / t.m.gp, y: t.m.ppg, key: t.key, label: t.abbr, sel: t.key === SX.sel, emph: emph.has(t.key), tip: `${esc(t.name)}<br>Points/G <b>${F.d2(t.m.ppg)}</b> · expected <b>${F.d2(t.m.xpts / t.m.gp)}</b><br>${F.sgn1(t.m.luck)} points vs expectation` }
        : { x: t.m.pyth, y: t.m.wp, key: t.key, label: t.abbr, sel: t.key === SX.sel, emph: emph.has(t.key), tip: `${esc(t.name)} ${recText(lgId, t.m)}<br>Win % <b>${F.avg(t.m.wp)}</b> · Pythagorean <b>${F.avg(t.m.pyth)}</b><br>${F.sgn1(t.m.luck)} wins vs expectation` });
      const tbl = byLuck.map(t => `<tr data-sx-team="${esc(t.key)}" class="${t.key === SX.sel ? 'sel' : ''}"><td class="l"><span class="team">${badge(lgId, { abbr: t.abbr, color: t.color })}<span>${esc(t.name)}</span></span></td><td>${recText(lgId, t.m)}</td>${soc ? `<td>${t.m.pts}</td><td>${F.d1(t.m.xpts)}</td>` : `<td>${F.avg(t.m.wp)}</td><td>${F.avg(t.m.pyth)}</td><td>${F.d1(t.m.xw)}</td>`}<td class="${t.m.luck > 0 ? 'delta-up' : t.m.luck < 0 ? 'delta-dn' : ''}">${F.sgn1(t.m.luck)}</td></tr>`).join('');
      luckHTML = `<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">${soc ? 'Points vs goal-based expectation' : 'Record vs Pythagorean expectation'}</h2><span class="aside">${soc ? 'Expected points from each side\'s scoring and conceding rates (Poisson)' : `Win % expected from ${esc(PF)} and ${esc(PA)} with exponent ${c.pyth}`}</span></div>
        <div class="sx-split"><div>${C.scatter(pts, { diag: true, diagLab: soc ? 'points = expectation' : 'record = scoring', xLab: soc ? 'Expected points per game' : 'Pythagorean win %', yLab: soc ? 'Actual points per game' : 'Actual win %', xFmt: soc ? F.d2 : F.avg, yFmt: soc ? F.d2 : F.avg, attr: 'data-sx-team', aria: 'Actual versus expected results' })}
          <div class="legend">Above the line = more ${soc ? 'points' : 'wins'} than the scoring suggests (close-game luck, bullpen/clutch, or noise). Labeled: 3 most and least fortunate.</div></div>
          <div class="tbl-wrap mini"><table class="tbl sx"><thead><tr><th class="l">Team</th><th>${soc ? 'W-D-L' : 'Record'}</th>${soc ? '<th>Pts</th><th>xPts</th>' : '<th>Win %</th><th>Pythag</th><th>xW</th>'}<th>${soc ? 'Diff' : 'Luck'}</th></tr></thead><tbody>${tbl}</tbody></table></div></div>
        <p class="note">Typical miss this season: ${soc ? F.d1(rmse) + ' points' : F.d1(rmse) + ' wins'} (root-mean-square). ${soc ? '' : 'Teams far above the line usually drift back toward it — see History for how little this "luck" carries over.'}</p></div>`;
      // 2) offense vs defense (soccer shows the same picture as attack/defense strength above)
      if (!soc) {
      const lgPF = mean(list.map(t => t.m.pfg)), lgPA = mean(list.map(t => t.m.pag));
      const od = list.map(t => ({ x: t.m.pfg, y: t.m.pag, key: t.key, label: t.abbr, sel: t.key === SX.sel, emph: true, tip: `${esc(t.name)}<br>${esc(PF)}/G <b>${F.d2(t.m.pfg)}</b> · ${esc(PA)}/G <b>${F.d2(t.m.pag)}</b>` }));
      luckHTML += `<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Offense vs defense</h2><span class="aside">${esc(PF)} scored and ${esc(PA)} allowed per game · up and right is better</span></div>
        ${C.scatter(od, { refX: lgPF, refY: lgPA, invertY: true, xLab: PF + ' per game (offense)', yLab: PA + ' allowed per game (defense, fewer is higher)', quad: { tr: 'Strong both ways', tl: 'Defense first', br: 'Offense first', bl: 'Struggling' }, attr: 'data-sx-team', h: 400, aria: 'Offense versus defense' })}</div>`;
      }
    } else luckHTML = `<div class="panel empty">Scoring totals aren't in this ${live() ? 'standings feed' : 'snapshot'}, so Pythagorean analysis is unavailable.</div>`;
    el.innerHTML = shiftNote(lgId, y) + `<div id="sx-power">${powerHTML(lgId, list)}</div><div id="sx-sig"></div>` + luckHTML + `<div id="sx-games"></div>` + glossaryHTML(lgId) + srcLine(lgId, y, 'power index, Pythagorean, BaseRuns, SRS and Elo computed in your browser');
    const sig = $('#sx-sig');
    if (soc || d.ts) sig.innerHTML = sigHTML(lgId, list);
    else if (live() && d.ts === undefined) {
      sig.innerHTML = `<div class="panel panel-pad">${prog('sx-sigprog', 'Loading team stats for efficiency analytics')}</div>`;
      loadTeamStats(lgId, y, (a, n) => setProg('sx-sigprog', a, n)).then(ts => {
        if (!alive(tok)) return; const s2 = $('#sx-sig'); if (!s2) return;
        const l2 = teamMetrics(lgId, rows, ts || null).filter(t => t.m.gp > 0);
        const pw = $('#sx-power'); if (pw && ts) pw.innerHTML = powerHTML(lgId, l2);
        s2.innerHTML = ts ? sigHTML(lgId, l2) : '';
      }).catch(() => { const s2 = $('#sx-sig'); if (s2) s2.innerHTML = ''; });
    } else if (!live()) sig.innerHTML = `<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">${{ bk: 'Efficiency landscape', bb: 'Sequencing and pitching luck', fb: 'Efficiency vs scoring', hk: 'Luck vs control (PDO vs shot share)' }[k] || 'Efficiency analytics'}</h2></div>${snapNotice('Team efficiency analytics (built from every team\'s season stats)')}</div>`;
    const gbox = $('#sx-games');
    if (!live()) { gbox.innerHTML = `<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Schedule-adjusted ratings</h2></div>${snapNotice('Game-by-game ratings (SRS, strength of schedule, Elo, close-game and home/road splits)')}</div>`; return; }
    const auto = ['nfl', 'wnba'].includes(lgId) || soc || d.games !== undefined;
    if (!auto) { gbox.innerHTML = `<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Schedule-adjusted ratings</h2><span class="aside">SRS, strength of schedule, Elo, close games, home/road</span></div><p class="note">Builds every result of the season from ${list.length} team schedules (about ${k === 'bb' ? '15' : '8'} MB of data).</p><button type="button" class="btn primary" data-sx-load="games">Load game-by-game analytics</button></div>`; return; }
    drawGames(gbox, lgId, y, list, tok);
  }
  async function drawGames(box, lgId, y, list, tok) {
    box.innerHTML = `<div class="panel panel-pad">${prog('sx-gprog', 'Loading every result of the season')}</div>`;
    let games; try { games = await loadGames(lgId, y, (a, n) => setProg('sx-gprog', a, n)); } catch (e) { if (alive(tok)) box.innerHTML = errBox('schedules'); return; }
    if (!alive(tok)) return;
    if (!games || games.length < 4) { box.innerHTML = '<div class="panel empty">Not enough completed games yet for schedule-adjusted ratings.</div>'; return; }
    const c = CFG[lgId], k = kindOf(lgId), sp = PM.SP[LG[lgId].sp];
    const srs = A.srs(games, sp.hfa || 0), elo = A.elo(games, c.elo), he = A.homeEdge(games);
    let power = null; try { power = await loadPower(lgId, y); } catch (e) { power = null; }
    if (!alive(tok)) return;
    const byId = {}; for (const t of list) if (t.id) byId[t.id] = t;
    const rows = Object.keys(srs).filter(id => byId[id]).map(id => { const t = byId[id], sp2 = A.splits(games, id, c), pw = power && (power['#' + id] || power[t.abbr]); return { t, id, s: srs[id], elo: elo.R[id], sp: sp2, pw }; });
    rows.sort((a, b) => b.s.srs - a.s.srs);
    const dp = k === 'bb' || k === 'hk' || c.soccer ? 2 : 1, sg = dp === 2 ? F.sgn2 : F.sgn1;
    const rec3 = a => `${a[0]}-${a[1]}${a[2] ? '-' + a[2] : ''}`;
    const tbl = rows.map((r, i) => `<tr data-sx-team="${esc(r.t.key)}" data-lab="${esc(r.t.abbr)}" data-name="${esc(r.t.name)}" class="${r.t.key === SX.sel ? 'sel' : ''}"><td class="rk">${i + 1}</td><td class="l"><span class="team">${badge(lgId, { abbr: r.t.abbr, color: r.t.color })}<span>${esc(r.t.name)}</span></span></td><td><b>${sg(r.s.srs)}</b></td><td>${sg(r.s.mov)}</td><td>${sg(r.s.sos)}</td><td>${Math.round(r.elo)}</td>${power ? `<td>${r.pw ? F.sgn1(r.pw.val) : '—'}</td>` : ''}<td>${rec3(r.sp.home)} <span class="muted">${sg(r.sp.home[4] ? r.sp.home[3] / r.sp.home[4] : NaN)}</span></td><td>${rec3(r.sp.road)} <span class="muted">${sg(r.sp.road[4] ? r.sp.road[3] / r.sp.road[4] : NaN)}</span></td><td>${rec3(r.sp.close)}</td><td>${r.sp.blow[0]}-${r.sp.blow[1]}</td><td>${rec3(r.sp.l10)}</td><td>${esc(r.sp.streak)}</td><td>${F.d1(r.sp.sd)}</td></tr>`).join('');
    const top = rows.slice(0, 3).map(r => r.id);
    const series = rows.map(r => ({ key: r.t.key, label: r.t.abbr, pts: (elo.H[r.id] || []), sel: r.t.key === SX.sel, strong: top.includes(r.id) && r.t.key !== SX.sel, tip: `${esc(r.t.name)}: Elo <b>${Math.round(r.elo)}</b>` }));
    const [PF] = UNIT[k];
    box.innerHTML = `<div class="tiles sx-tiles"><div class="panel tile"><span class="eyebrow">Games analyzed</span><span class="val">${games.length}</span><span class="sub">regular season, ${esc(seasonLabel(lgId, y))}</span></div>
        <div class="panel tile"><span class="eyebrow">Home ${c.soccer ? 'win / draw' : 'win'} rate</span><span class="val">${F.pc1(he.hw * 100)}${c.soccer ? `<small>/ ${F.pc1(he.hd * 100)}</small>` : ''}</span><span class="sub">measured home edge ${sg(he.hm)} ${esc(PF.toLowerCase())}/game</span></div>
        <div class="panel tile"><span class="eyebrow">Scoring environment</span><span class="val">${F.d1(he.tot)}</span><span class="sub">combined ${esc(PF.toLowerCase())} per game</span></div></div>
      <div class="panel"><div class="ptool"><b>Schedule-adjusted ratings</b><span class="note">SRS = average margin (home edge removed) + average opponent rating · Elo starts every team at 1500${power ? ` · ESPN ${c.power.toUpperCase()} for comparison` : ''}</span></div>
        <div class="vz" data-vz="srs" data-vz-attr="data-sx-team" data-vz-def="SRS" data-vz-on="0"><div class="tbl-wrap"><table class="tbl sx"><thead><tr><th>#</th><th class="l">Team</th><th title="Simple Rating System">SRS</th><th title="Average margin, home edge removed">MOV</th><th title="Strength of schedule">SOS</th><th>Elo</th>${power ? `<th>ESPN ${c.power.toUpperCase()}</th>` : ''}<th>Home</th><th>Road</th><th title="Decided by ${c.close} or fewer">Close</th><th title="Decided by ${c.blow}+">Blowouts</th><th>Last 10</th><th>Streak</th><th title="Standard deviation of game margins">Margin SD</th></tr></thead><tbody>${tbl}</tbody></table></div></div></div>
      <div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Elo through the season</h2><span class="aside">Every team in grey · top 3 and your pick highlighted · click a line</span></div>${C.lines(series, { xTime: true, ref: 1500, refLab: 'average', endLab: true, attr: 'data-sx-team', aria: 'Elo ratings over the season' })}</div>
      <div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">SRS power ranking</h2><span class="aside">${esc(PF)} per game better than an average team on a neutral field</span></div>${C.ratingBars(rows.map(r => ({ abbr: r.t.abbr, name: r.t.name, v: r.s.srs, sel: r.t.key === SX.sel })), { unit: PF.toLowerCase(), dp })}</div>`;
  }

  /* ---------------- History ---------------- */
  async function viewHistory(el, lgId, y0, tok) {
    const all = seasonList(lgId); const n = Math.min(SX.hn, all.length), seasons = all.slice(0, n);
    el.innerHTML = `<div class="panel panel-pad">${prog('sx-hprog', `Loading ${n} seasons of standings`)}</div>`;
    let done = 0; const res = {};
    await Promise.all(seasons.map(y => loadStandings(lgId, y).then(r => { res[y] = r; }).catch(() => { }).finally(() => setProg('sx-hprog', ++done, n))));
    if (!alive(tok)) return;
    const data = seasons.filter(y => res[y] && res[y].some(r => r.gp > 0)).map(y => ({ y, list: teamMetrics(lgId, res[y], null).filter(t => t.m.gp > 0) })).sort((a, b) => a.y - b.y);
    if (data.length < 2) {
      const cur = data.length ? data[data.length - 1].list : [];
      el.innerHTML = (APP.titles && APP.titles.has(lgId) ? APP.titles.panelHTML(lgId, { teams: cur }) : '') + (live() ? errBox('historical standings') : snapNotice('More historical seasons for this league'));
      return;
    }
    drawHistory(el, lgId, data, all.length);
  }
  function drawHistory(el, lgId, data, avail) {
    const c = CFG[lgId], k = kindOf(lgId), soc = c.soccer, idOf = t => t.id || t.key;
    const TS = []; for (const s of data) for (const t of s.list) TS.push({ y: s.y, id: idOf(t), t, m: t.m });
    const latest = data[data.length - 1];
    if (!SX.hteam || !latest.list.some(t => idOf(t) === SX.hteam)) { const best = latest.list.slice().sort((a, b) => (soc ? b.m.ppg - a.m.ppg : b.m.wp - a.m.wp))[0]; SX.hteam = idOf(best); }
    const me = TS.filter(x => x.id === SX.hteam).sort((a, b) => a.y - b.y), meT = me.length ? me[me.length - 1].t : null;
    const perf = x => soc ? x.m.ppg : x.m.wp;
    const lab = y => seasonLabel(lgId, y);
    // parity: Noll–Scully
    const par = data.map(s => { const wps = s.list.map(t => t.m.wp), gp = mean(s.list.map(t => t.m.gp)); return [s.y, sdev(wps) / (0.5 / Math.sqrt(gp))]; }).filter(p => fin(p[1]));
    // turnarounds / collapses
    const byTeam = {}; for (const x of TS) (byTeam[x.id] = byTeam[x.id] || []).push(x);
    const jumps = [];
    for (const arr of Object.values(byTeam)) { arr.sort((a, b) => a.y - b.y); for (let i = 1; i < arr.length; i++) if (arr[i].y - arr[i - 1].y === 1 || (c.skip || []).includes(arr[i].y - 1)) jumps.push({ a: arr[i - 1], b: arr[i], d: perf(arr[i]) - perf(arr[i - 1]) }); }
    const ups = jumps.slice().sort((a, b) => b.d - a.d).slice(0, 6), downs = jumps.slice().sort((a, b) => a.d - b.d).slice(0, 5);
    const best = TS.slice().sort((a, b) => perf(b) - perf(a)).slice(0, 6), worst = TS.slice().sort((a, b) => perf(a) - perf(b)).slice(0, 5);
    // dynasties: best 5-season stretch
    const dyn = [], RUN = Math.min(5, data.length);
    for (const arr of Object.values(byTeam)) for (let i = 0; i + RUN - 1 < arr.length; i++) { const w = arr.slice(i, i + RUN); if (w[RUN - 1].y - w[0].y > RUN) continue; const W = w.reduce((s, x) => s + (soc ? x.m.pts : (k === 'hk' ? x.m.w : x.m.w + 0.5 * x.m.t)), 0), G = w.reduce((s, x) => s + x.m.gp, 0); dyn.push({ t: w[RUN - 1].t, y0: w[0].y, y1: w[RUN - 1].y, v: W / G }); }
    dyn.sort((a, b) => b.v - a.v); const dynTop = []; for (const x of dyn) { if (dynTop.some(d => idOf(d.t) === idOf(x.t))) continue; dynTop.push(x); if (dynTop.length >= 5) break; }
    // persistence
    const pw = jumps.map(j => [perf(j.a), perf(j.b)]), pl = jumps.filter(j => fin(j.a.m.luck) && fin(j.b.m.luck));
    const rW = A.pearson(pw.map(p => p[0]), pw.map(p => p[1])), rL = A.pearson(pl.map(j => j.a.m.luck), pl.map(j => j.b.m.luck));
    const rmse = Math.sqrt(mean(TS.filter(x => fin(x.m.luck)).map(x => x.m.luck * x.m.luck)));
    const nm = x => `${esc(lab(x.y))} ${esc(x.t.abbr)}`;
    const recS = x => recText(lgId, x.m);
    const pv = x => soc ? F.d2(x.m.ppg) + ' pts/g' : F.avg(x.m.wp);
    const li = (arr, f) => `<ol class="hl-list">${arr.map(f).join('')}</ol>`;
    const teamOpts = latest.list.slice().sort((a, b) => a.name.localeCompare(b.name)).map(t => `<option value="${esc(idOf(t))}" ${idOf(t) === SX.hteam ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
    const nOpts = [5, 10, 15, 20, 25].filter(n => n <= avail || n === 5).map(n => `<option value="${n}" ${n === SX.hn ? 'selected' : ''}>Last ${n} seasons</option>`).join('');
    const tRows = me.slice().reverse().map(x => `<tr data-lab="${esc(seasonShort(lgId, x.y))}" data-name="${esc(lab(x.y))} ${esc(x.t.name)}"><td class="l">${esc(lab(x.y))}</td><td>${recS(x)}</td><td>${soc ? x.m.pts : F.avg(x.m.wp)}</td><td>${fin(x.m.pfg) ? F.i(x.t.r.pf) + '–' + F.i(x.t.r.pa) : '—'}</td><td>${(k === 'bb' || k === 'hk' || soc ? F.sgn2 : F.sgn1)(x.m.mov)}</td><td>${soc ? F.d1(x.m.xpts) : F.avg(x.m.pyth)}</td><td class="${x.m.luck > 0 ? 'delta-up' : x.m.luck < 0 ? 'delta-dn' : ''}">${F.sgn1(x.m.luck)}</td><td>${x.t.clinch ? `<span class="clinch">${esc(x.t.clinch)}</span>` : ''}</td></tr>`).join('');
    const bestMe = me.slice().sort((a, b) => perf(b) - perf(a))[0], worstMe = me.slice().sort((a, b) => perf(a) - perf(b))[0];
    const post = c => /^(x|y|z|w|p|xp|\*|\*\*)$/i.test(String(c || '')); const po = me.filter(x => post(x.t.clinch)).length;
    // championships & postseason: titles from the verified histories, playoff berths from the loaded standings
    const berths = {}; let anyPost = false;
    for (const t of latest.list) { const arr = byTeam[idOf(t)] || []; const n = arr.filter(x => post(x.t.clinch)).length; if (n) anyPost = true; berths[t.key] = n; }
    const TT = APP.titles && APP.titles.has(lgId) ? APP.titles : null, tr = TT && meT ? TT.forTeam(lgId, { abbr: meT.abbr, key: meT.key, name: meT.name }) : null, tdef = TT ? TT.def(lgId) : null;
    const titlesHTML = TT ? TT.panelHTML(lgId, { teams: latest.list, berths: anyPost ? berths : null, span: `${lab(data[0].y)} to ${lab(latest.y)}`, sel: meT ? meT.key : null }) : '';
    el.innerHTML = `<div class="panel ptool hist-ctl"><label for="sx-hteam" class="eyebrow">Franchise</label><select id="sx-hteam" class="sel">${teamOpts}</select><label for="sx-hn" class="eyebrow">Window</label><select id="sx-hn" class="sel">${nOpts}</select><span class="note">${data.length} seasons loaded · ${esc(lab(data[0].y))} to ${esc(lab(latest.y))}</span></div>
      ${meT ? `<div class="tiles sx-tiles"><div class="panel tile"><span class="eyebrow">${esc(meT.name)}</span><span class="val">${soc ? F.d2(mean(me.map(perf))) : F.avg(mean(me.map(perf)))}<small>${soc ? 'pts/game' : 'win %'} over ${me.length} seasons</small></span><span class="sub">${po ? `${po} postseason berths flagged in the standings` : 'Average across the window'}</span></div>
        <div class="panel tile"><span class="eyebrow">Best season</span><span class="val">${esc(lab(bestMe.y))}</span><span class="sub">${recS(bestMe)} · ${pv(bestMe)}</span></div>
        <div class="panel tile"><span class="eyebrow">Toughest season</span><span class="val">${esc(lab(worstMe.y))}</span><span class="sub">${recS(worstMe)} · ${pv(worstMe)}</span></div>
        ${tr ? `<div class="panel tile"><span class="eyebrow">${esc(tdef.plural)}</span><span class="val">${lgId === 'nhl' ? tr.all : tr.n}</span><span class="sub">${tr.n ? 'last ' + esc(TT.seasonLab(lgId, tr.last)) : 'never won'}${tr.finals != null ? ` · finals ${tr.fw}-${tr.fl}` : tr.lost.length ? ` · ${tr.lost.length}× runner-up` : ''}</span></div>` : ''}</div>` : ''}
      <div class="sx-two"><div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">${soc ? 'Points per game' : 'Win %'} by season</h2><span class="aside">${soc ? '' : 'baseline .500 · '}dot = postseason clinch</span></div>${C.cols(me.map(x => ({ lab: seasonShort(lgId, x.y), v: perf(x), mark: post(x.t.clinch), tip: `${esc(lab(x.y))}: <b>${recS(x)}</b> · ${pv(x)}` })), { base: soc ? mean(TS.map(perf)) : 0.5, yFmt: soc ? F.d2 : F.avg, baseLab: soc ? 'league avg' : '.500', aria: 'Win percentage by season' })}</div>
        <div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Scoring margin by season</h2><span class="aside">${esc(UNIT[k][0])} per game, scored minus allowed</span></div>${C.cols(me.map(x => ({ lab: seasonShort(lgId, x.y), v: x.m.mov, tip: `${esc(lab(x.y))}: <b>${(k === 'bb' || k === 'hk' || soc ? F.sgn2 : F.sgn1)(x.m.mov)}</b> per game` })), { base: 0, yFmt: C.fmtAuto, aria: 'Scoring margin by season' })}</div></div>
      <div class="panel"><div class="ptool"><b>${meT ? esc(meT.name) : ''} season by season</b></div><div class="vz" data-vz="hist" data-vz-order="seqrev" data-vz-types="line,cols" data-vz-on="0" data-vz-def="${soc ? 'Pts' : 'Win %'}" data-vz-x="season"><div class="tbl-wrap"><table class="tbl sx"><thead><tr><th class="l">Season</th><th>${soc ? 'W-D-L' : 'Record'}</th><th>${soc ? 'Pts' : 'Win %'}</th><th>${esc(UNIT[k][0])}–${esc(UNIT[k][1])}</th><th>Margin/G</th><th>${soc ? 'xPts' : 'Pythag'}</th><th>${soc ? 'Pts − xPts' : 'W − Pythag'}</th><th>Clinch</th></tr></thead><tbody>${tRows}</tbody></table></div></div></div>
      ${titlesHTML}
      <div class="sec-h"><h2>League history analytics</h2><span class="aside">${esc(LG[lgId].name)}, ${esc(lab(data[0].y))} – ${esc(lab(latest.y))}</span></div>
      <div class="sx-two"><div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Parity by season</h2><span class="aside">Noll–Scully ratio · 1.0 = pure coin flips</span></div>${C.lines([{ key: 'p', label: 'Noll–Scully', pts: par, sel: true }], { ref: 1, refLab: 'coin-flip league', dots: true, pointTips: true, xInt: true, xFmt: y => seasonShort(lgId, y), xTipFmt: y => lab(y), yFmt: F.d2, aria: 'Competitive balance by season' })}<p class="note">Spread of team win % relative to what luck alone would produce. Higher = a more top-heavy league.</p></div>
        <div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Does luck carry over?</h2><span class="aside">Year-to-year correlation, ${pw.length} team pairs</span></div>
          <div class="kv"><div><span class="k">${soc ? 'Points per game' : 'Win %'}</span><span class="v">r = ${F.d2(rW)}</span></div><div><span class="k">${soc ? 'Points above expectation' : 'Wins above Pythagorean'}</span><span class="v">r = ${F.d2(rL)}</span></div><div><span class="k">Typical Pythagorean miss</span><span class="v">${F.d1(rmse)} ${soc ? 'pts' : 'wins'}</span></div></div>
          ${C.scatter(pl.map(j => ({ x: j.a.m.luck, y: j.b.m.luck, key: idOf(j.b.t), label: j.b.t.abbr, tip: `${esc(j.b.t.name)}: ${F.sgn1(j.a.m.luck)} in ${esc(lab(j.a.y))} → ${F.sgn1(j.b.m.luck)} in ${esc(lab(j.b.y))}` })), { refX: 0, refY: 0, xLab: 'Luck, season N', yLab: 'Luck, season N+1', h: 260, xFmt: F.sgn1, yFmt: F.sgn1, aria: 'Luck in consecutive seasons' })}
          <p class="note">Quality persists (r ${F.d2(rW)}); the part of a record the scoring doesn't explain mostly doesn't (r ${F.d2(rL)}).</p></div></div>
      <div class="sx-three"><div class="panel panel-pad"><span class="eyebrow">Biggest turnarounds</span>${li(ups, j => `<li><b>${esc(j.b.t.name)}</b> <span class="muted">${esc(lab(j.a.y))} → ${esc(lab(j.b.y))}</span><span class="v">${recS(j.a)} → ${recS(j.b)}</span></li>`)}</div>
        <div class="panel panel-pad"><span class="eyebrow">Best seasons</span>${li(best, x => `<li><b>${nm(x)}</b><span class="v">${recS(x)} · ${pv(x)}</span></li>`)}<span class="eyebrow" style="margin-top:10px;display:block">Steepest collapses</span>${li(downs, j => `<li><b>${esc(j.b.t.name)}</b> <span class="muted">${esc(lab(j.a.y))} → ${esc(lab(j.b.y))}</span><span class="v">${recS(j.a)} → ${recS(j.b)}</span></li>`)}</div>
        <div class="panel panel-pad"><span class="eyebrow">Best ${RUN === 5 ? 'five' : RUN}-season runs</span>${li(dynTop, x => `<li><b>${esc(x.t.name)}</b> <span class="muted">${esc(lab(x.y0))}–${esc(lab(x.y1))}</span><span class="v">${soc ? F.d2(x.v) + ' pts/g' : F.avg(x.v)}</span></li>`)}<span class="eyebrow" style="margin-top:10px;display:block">Worst seasons</span>${li(worst, x => `<li><b>${nm(x)}</b><span class="v">${recS(x)} · ${pv(x)}</span></li>`)}</div></div>`
      + (live() ? `<div class="srcline">ESPN standings archive · franchises matched by team id across relocations and renames</div>` : `<div class="srcline">Snapshot archive · <a href="${APP.SITE_URL}#stats-history" target="_blank" rel="noopener">up to 25 seasons, live ↗</a></div>`);
  }

  /* ---------------- team card ---------------- */
  async function openTeam(key) {
    const lgId = SX.lg, y = SX.season, d = db(lgId, y); if (!d.rows) return;
    const r = d.rows.find(x => x.key === key || x.id === key); if (!r) return;
    SX.sel = r.key;
    const t = teamMetrics(lgId, d.rows, d.ts || null).find(x => x.key === r.key), k = kindOf(lgId), c = CFG[lgId], [PF, PA] = UNIT[k];
    const body = cardShell(LG[lgId], `${esc(r.name)} · ${esc(seasonLabel(lgId, y))}`);
    const dp = k === 'bb' || k === 'hk' || c.soccer ? 2 : 1, sg = dp === 2 ? F.sgn2 : F.sgn1;
    const tiles = [`<div class="panel tile"><span class="eyebrow">Record</span><span class="val">${recText(lgId, t.m)}</span><span class="sub">${c.soccer ? t.m.pts + ' pts' : 'win % ' + F.avg(t.m.wp)}${t.clinch ? ' · clinch ' + esc(t.clinch) : ''}</span></div>`];
    if (fin(t.m.pfg)) tiles.push(`<div class="panel tile"><span class="eyebrow">${esc(PF)} / ${esc(PA)} per game</span><span class="val">${F.d1(t.m.pfg)}<small>/ ${F.d1(t.m.pag)}</small></span><span class="sub">margin ${sg(t.m.mov)}</span></div>`);
    if (fin(t.m.luck)) tiles.push(`<div class="panel tile"><span class="eyebrow">${c.soccer ? 'Points vs expectation' : 'Wins vs Pythagorean'}</span><span class="val">${F.sgn1(t.m.luck)}</span><span class="sub">${c.soccer ? 'xPts ' + F.d1(t.m.xpts) : 'Pythag ' + F.avg(t.m.pyth)}</span></div>`);
    body.innerHTML = `<div class="board-lite">${badge(lgId, { abbr: r.abbr, color: r.color }, 'big')}<div><b>${esc(r.name)}</b><span class="muted">${esc(r.group || LG[lgId].name)} · ${esc(seasonLabel(lgId, y))}</span></div></div><div class="tiles sx-tiles">${tiles.join('')}</div>${APP.titles && APP.titles.has(lgId) ? APP.titles.cardHTML(lgId, { abbr: r.abbr, key: r.key, name: r.name }, y) : ''}<div id="tc-games">${live() ? '<div class="note">Loading results…</div>' : ''}</div><div id="tc-hist"></div><div id="tc-stats"></div><div id="tc-players"></div>${live() ? '' : `<div class="notice"><div>Game-by-game results, league ranks for every team stat and team leaders load in the <a href="${APP.SITE_URL}#stats" target="_blank" rel="noopener">live version</a>.</div></div>`}`;
    // recent seasons for this franchise
    const hs = seasonList(lgId).filter(s2 => s2 <= y).slice(0, 5);
    Promise.all(hs.map(s2 => loadStandings(lgId, s2).then(rows2 => [s2, rows2]).catch(() => [s2, null]))).then(res => {
      const hEl = $('#tc-hist'); if (!hEl || SX.card !== key) return;
      const hist = res.map(([s2, rows2]) => { const t2 = rows2 && rows2.find(x => (r.id && x.id === r.id) || x.key === r.key); return t2 && t2.gp ? { s: s2, t: t2, m: teamMetrics(lgId, [t2], null)[0].m } : null; }).filter(Boolean).reverse();
      if (hist.length < 2) return;
      const soc = c.soccer, pv = h => soc ? h.m.ppg : h.m.wp;
      hEl.innerHTML = `<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:17px">Recent seasons</h2><span class="aside">${soc ? 'points per game' : 'win %'} · dot = postseason clinch</span></div>${C.cols(hist.map(h => ({ lab: seasonShort(lgId, h.s), v: pv(h), sel: h.s === y, mark: /^(x|y|z|w|p|xp|\*|\*\*)$/i.test(h.t.clinch || ''), tip: `${esc(seasonLabel(lgId, h.s))}: <b>${recText(lgId, h.m)}</b>` })), { base: soc ? 1.37 : 0.5, yFmt: soc ? F.d2 : F.avg, baseLab: soc ? '' : '.500', h: 170, aria: 'Recent seasons' })}
        <div class="tbl-wrap"><table class="tbl sx mini"><thead><tr><th class="l">Season</th><th>Record</th><th>${soc ? 'Pts' : 'Win %'}</th><th>Margin/G</th><th>${soc ? 'Pts − xPts' : 'W − Pythag'}</th></tr></thead><tbody>${hist.slice().reverse().map(h => `<tr${h.s === y ? ' class="sel"' : ''}><td class="l">${esc(seasonLabel(lgId, h.s))}</td><td>${recText(lgId, h.m)}${h.t.clinch ? ` <span class="clinch">${esc(h.t.clinch)}</span>` : ''}</td><td>${soc ? h.m.pts : F.avg(h.m.wp)}</td><td>${sg(h.m.mov)}</td><td>${F.sgn1(h.m.luck)}</td></tr>`).join('')}</tbody></table></div></div>`;
    });
    // results
    const gEl = $('#tc-games');
    const drawRes = games => {
      if (!gEl || !games || !games.length) { if (gEl) gEl.innerHTML = ''; return; }
      const idk = r.id || r.key, sp2 = A.splits(games, idk, c);
      if (!sp2.n) { gEl.innerHTML = ''; return; }
      const abbrOf = x => x.oppAbbr || (d.rows.find(q => q.id === x.opp || q.key === x.opp) || {}).abbr || x.opp;
      gEl.innerHTML = `<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:17px">Results and margins</h2><span class="aside">${sp2.n} games · home ${sp2.home[0]}-${sp2.home[1]}${sp2.home[2] ? '-' + sp2.home[2] : ''} · road ${sp2.road[0]}-${sp2.road[1]}${sp2.road[2] ? '-' + sp2.road[2] : ''} · close ${sp2.close[0]}-${sp2.close[1]} · streak ${esc(sp2.streak)}</span></div>
        ${C.cols(sp2.res.map(x => ({ lab: (x.home ? 'v ' : '@ ') + abbrOf(x), v: x.m, tip: `${esc(new Date(x.t).toLocaleDateString([], { month: 'short', day: 'numeric' }))} ${x.home ? 'vs' : 'at'} ${esc(abbrOf(x))}: <b>${x.m > 0 ? 'W' : x.m < 0 ? 'L' : 'D'} ${x.fs}–${x.fa}</b>` })), { base: 0, rot: sp2.n > 12, labEvery: sp2.n > 40 ? Math.ceil(sp2.n / 20) : 1, h: 190, aria: 'Margin in every game' })}
        <ul class="plays">${sp2.res.slice(-8).reverse().map(x => `<li><span class="t">${esc(new Date(x.t).toLocaleDateString([], { month: 'short', day: 'numeric' }))}</span><span>${x.home ? 'vs' : 'at'} ${esc(abbrOf(x))}</span><span class="s">${x.m > 0 ? 'W' : x.m < 0 ? 'L' : 'D'} ${x.fs}–${x.fa}</span></li>`).join('')}</ul></div>`;
    };
    if (live() && r.id) {
      get(`${HOST}site/v2/sports/${LG[lgId].path}/teams/${r.id}/schedule?season=${y}${c.soccer ? '' : '&seasontype=2'}`, 10 * 60e3).then(js => { if (SX.card === key) drawRes(parseSchedule(js).filter(g => !g.post)); }).catch(() => { if (gEl) gEl.innerHTML = ''; });
    } else {
      const sg2 = (S.data[lgId].games || []).filter(g => g.state === 'post' && !g.void && (g.home.abbr === r.key || g.away.abbr === r.key)).map(g => ({ id: g.id, t: +new Date(g.start), h: g.home.abbr, a: g.away.abbr, ha: g.home.abbr, aa: g.away.abbr, hs: +g.home.score, as: +g.away.score, neutral: g.neutral }));
      drawRes(sg2);
      if (gEl && sg2.length) gEl.insertAdjacentHTML('beforeend', '<p class="note">Snapshot: only the games captured in this copy. The live version charts the full season.</p>');
    }
    // team stats with league ranks
    const sEl = $('#tc-stats');
    const drawStats = TS => {
      if (!sEl) return;
      const list = teamMetrics(lgId, d.rows, TS || null), me = list.find(x => x.key === r.key); if (!me || !me.m.gp) return;
      const vs2 = teamViews(lgId), advKeys = new Set(((vs2.find(v => v.id === 'adv') || {}).cols || []).map(cc => cc.key));
      const rows2 = [], prof = [], seen = new Set();
      for (const v of vs2) for (const cc of v.cols) {
        if (cc.key === 'rec' || seen.has(cc.key) || !fin(me.m[cc.key])) continue; seen.add(cc.key);
        const vals = list.map(x => x.m[cc.key]).filter(fin), better = vals.filter(x => cc.low ? x < me.m[cc.key] : x > me.m[cc.key]).length;
        rows2.push(`<tr><td class="l">${esc(cc.lab)}</td><td>${fmt(cc.f, me.m[cc.key])}</td><td class="muted">${APP.ord(better + 1)} of ${vals.length}</td></tr>`);
        if (vals.length >= 3 && !['luck', 'rbsr'].includes(cc.key)) prof.push({ lab: cc.lab, p: 1 - better / (vals.length - 1), disp: fmt(cc.f, me.m[cc.key]), sub: `${APP.ord(better + 1)} of ${vals.length}${cc.low ? ' · lower is better' : ''}`, adv: advKeys.has(cc.key) });
      }
      const pick = prof.filter(x => x.adv).concat(prof.filter(x => !x.adv)).slice(0, 14);
      sEl.innerHTML = (pick.length >= 3 ? `<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:17px">Percentile profile</h2><span class="aside">League percentile on each metric · 100 = best in the league${TS ? '' : ' · standings-based metrics'}</span></div>${C.pctl(pick, { aria: r.name + ' percentile profile' })}</div>` : '') + `<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:17px">Season stats and league rank</h2></div><div class="tbl-wrap"><table class="tbl sx mini"><tbody>${rows2.join('')}</tbody></table></div></div>`;
    };
    drawStats(d.ts || null);
    if (!d.ts && live() && !c.soccer) loadTeamStats(lgId, y).then(ts => { if (SX.card === key && ts) drawStats(ts); }).catch(() => { });
    // top players from any loaded board
    const pEl = $('#tc-players'), B = BOARDS[k];
    if (pEl && B) {
      const lists = [];
      for (const bd of B.list) { const bdata = d.boards[bd.req]; if (!bdata) continue; const rows3 = bdata.rows.filter(p => (p.team === r.abbr || p.team === r.key) && (!bd.only || bd.only(p))); if (!rows3.length) continue; const cm = colMeta(bd.sortBy, bdata.meta); if (!cm) continue; rows3.sort((a, b) => (LOWER.test(bd.sortBy) ? a.v[bd.sortBy] - b.v[bd.sortBy] : b.v[bd.sortBy] - a.v[bd.sortBy])); lists.push(`<div><span class="eyebrow">${esc(bd.name)}</span><ul class="plays">${rows3.slice(0, 4).map(p => `<li><span class="t">${esc(p.pos)}</span><span><button type="button" class="linkish" data-sx-player="${esc(p.id)}">${esc(p.name)}</button></span><span class="s">${esc(cm.lab)} ${pfmt(cm.f, p.v[bd.sortBy])}</span></li>`).join('')}</ul></div>`); }
      if (lists.length) pEl.innerHTML = `<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:17px">Team leaders</h2><span class="aside">from the leaderboards you've opened</span></div><div class="sx-two">${lists.join('')}</div></div>`;
    }
  }
  function cardShell(lg, title) {
    const el = $('#drawer'); el.hidden = false; document.body.style.overflow = 'hidden';
    el.innerHTML = `<div class="drawer-scrim" data-close></div><aside class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="pc-ttl"><div class="dr-head"><span class="lg-tag">${esc(lg.short || lg.name)}</span><span class="ttl" id="pc-ttl">${title}</span><button type="button" class="icon-btn" data-close aria-label="Close">✕ Close</button></div><div class="dr-body" id="pc-body"></div></aside>`;
    setTimeout(() => { const b = el.querySelector('[data-close].icon-btn'); if (b) b.focus(); }, 30);
    return $('#pc-body');
  }

  /* ---------------- player card ---------------- */
  function parseOverview(js) {
    const st = (js && js.statistics) || {};
    return { labels: st.labels || [], names: st.names || [], disp: st.displayNames || [], splits: (st.splits || []).map(s => ({ name: s.displayName || '', stats: s.stats || [] })), news: ((js && js.news) || []).slice(0, 3).map(n => ({ h: n.headline, u: n.links && n.links.web && n.links.web.href })) };
  }
  function parseGamelog(js) {
    const labels = (js && js.labels) || [], names = (js && js.names) || [], evs = (js && js.events) || {}, games = [];
    for (const st of (js && js.seasonTypes) || []) {
      if (/pre/i.test(st.displayName || '')) continue;
      for (const c of st.categories || []) for (const e of c.events || []) { const m = evs[e.eventId] || {}; games.push({ id: e.eventId, t: +new Date(m.gameDate), opp: (m.opponent && m.opponent.abbreviation) || '', at: m.atVs || '', res: m.gameResult || '', score: m.score || '', stats: e.stats || [], post: /post/i.test(st.displayName || '') }); }
    }
    const uniq = new Map(); for (const g of games) uniq.set(g.id, g);
    return { labels, names, games: [...uniq.values()].sort((a, b) => a.t - b.t) };
  }
  function parseCareer(js) {
    return ((js && js.categories) || []).map(c => ({ name: c.name, disp: c.displayName || c.name, labels: c.labels || [], names: c.names || [], rows: (c.statistics || []).map(s => ({ y: s.season && s.season.year, lab: (s.season && s.season.displayName) || '', team: s.teamSlug || '', stats: s.stats || [] })).filter(r => r.y), totals: c.totals || [] })).filter(c => c.rows.length);
  }
  const numOf = s => { const t = String(s == null ? '' : s).trim(); const m = t.match(/^(-?\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/); if (m) return +m[1]; if (/^\d+:\d{2}$/.test(t)) { const [a, b] = t.split(':'); return +a + b / 60; } const n = parseFloat(t.replace(/,/g, '')); return n; };
  const PREF = { bk: ['PTS', 'REB', 'AST'], hk: ['PTS', 'G', 'SV%'], bb: ['OPS', 'HR', 'AVG', 'ERA', 'K'], fb: ['YDS', 'TD', 'REC', 'CAR', 'TOT'] };
  function pickLab(labels, kind) { for (const p of PREF[kind] || []) { const i = labels.indexOf(p); if (i >= 0) return i; } return labels.length - 1; }
  async function openPlayer(id) {
    const lgId = SX.lg, y = SX.season, k = kindOf(lgId), rows = SX._rows || [], meta = SX._meta || {};
    const r = rows.find(x => x.id === id); if (!r) return;
    SX.selP = id; SX.card = 'p' + id;
    const body = cardShell(LG[lgId], `${esc(r.name)} · ${esc(r.team)}${r.pos ? ' · ' + esc(r.pos) : ''}`);
    const bd = BOARDS[k].list.find(b => b.id === SX.board) || BOARDS[k].list[0];
    const keyCols = bd.cols.map(c => ({ k: c, m: colMeta(c, meta) })).filter(c => c.m && fin(r.v[c.k]));
    const rank = key => { const pool = rows.filter(x => (!bd.only || bd.only(x)) && fin(x.v[key])); const low = LOWER.test(key); return 1 + pool.filter(x => low ? x.v[key] < r.v[key] : x.v[key] > r.v[key]).length + '/' + pool.length; };
    body.innerHTML = `<div class="board-lite">${r.head && live() ? `<img class="head" src="${esc(r.head)}" alt="" width="64" height="64" loading="lazy">` : `<span class="head ph">${esc(r.name.split(' ').map(w => w[0]).slice(0, 2).join(''))}</span>`}<div><b>${esc(r.name)}</b><span class="muted">${esc(r.teamName || r.team)}${r.pos ? ' · ' + esc(r.pos) : ''} · ${esc(seasonLabel(lgId, y))}</span></div></div>
      <div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:17px">${esc(bd.name)} line</h2><span class="aside">rank among the leaderboard shown</span></div><div class="statgrid">${keyCols.map(c => `<div title="${esc(c.m.desc || '')}"><span class="k">${esc(c.m.lab)}</span><span class="v">${pfmt(c.m.f, r.v[c.k])}</span><span class="r">${rank(c.k)}</span></div>`).join('')}</div>
        ${(() => { const items = keyCols.filter(c => !/gamesPlayed$|\.games$|gamesStarted$/.test(c.k)).map(c => { const pool = rows.filter(x => (!bd.only || bd.only(x)) && fin(x.v[c.k])), low = LOWER.test(c.k), better = pool.filter(x => low ? x.v[c.k] < r.v[c.k] : x.v[c.k] > r.v[c.k]).length; return pool.length >= 3 ? { lab: c.m.lab, p: 1 - better / (pool.length - 1), disp: pfmt(c.m.f, r.v[c.k]), sub: `${APP.ord(better + 1)} of ${pool.length}${low ? ' · lower is better' : ''}` } : null; }).filter(Boolean).slice(0, 14); return items.length >= 3 ? `<div class="sec-h" style="margin-top:12px"><h2 style="font-size:15px">Percentile vs the leaderboard</h2><span class="aside">100 = best among the players shown</span></div>${C.pctl(items, { aria: r.name + ' percentiles' })}` : ''; })()}</div>
      <div id="pc-log">${live() ? '<div class="note">Loading game log…</div>' : `<div class="notice"><div>Game logs, career stats and news load in the <a href="${APP.SITE_URL}#stats-players" target="_blank" rel="noopener">live version</a>.</div></div>`}</div><div id="pc-career"></div><div id="pc-news"></div>`;
    if (!live() || r.snap) return;
    const lg = LG[lgId], token = SX.card;
    get(`${HOST}common/v3/sports/${lg.path}/athletes/${id}/gamelog?season=${y}`, 10 * 60e3).then(js => { if (SX.card === token) drawLog(parseGamelog(js), k); }).catch(() => { const e = $('#pc-log'); if (e && SX.card === token) e.innerHTML = '<p class="note">No game log available for this season.</p>'; });
    get(`${HOST}common/v3/sports/${lg.path}/athletes/${id}/stats`, 30 * 60e3).then(js => { if (SX.card === token) drawCareer(parseCareer(js), k); }).catch(() => { });
    get(`${HOST}common/v3/sports/${lg.path}/athletes/${id}/overview`, 10 * 60e3).then(js => { if (SX.card !== token) return; const o = parseOverview(js), e = $('#pc-news'); if (e && o.news.length) e.innerHTML = `<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:17px">Latest</h2></div><ul class="plays">${o.news.map(n => `<li><span class="t">News</span><span>${n.u ? `<a href="${esc(n.u)}" target="_blank" rel="noopener">${esc(n.h)}</a>` : esc(n.h)}</span><span></span></li>`).join('')}</ul></div>`; }).catch(() => { });
  }
  function drawLog(gl, k) {
    const el = $('#pc-log'); if (!el) return;
    const games = gl.games.filter(g => !g.post); if (!games.length) { el.innerHTML = '<p class="note">No regular-season games logged yet.</p>'; return; }
    const labels = gl.labels, ok = labels.map((l, i) => games.filter(g => fin(numOf(g.stats[i]))).length >= games.length * 0.6);
    let si = SX.logStat != null && ok[SX.logStat] ? SX.logStat : pickLab(labels, k); if (!ok[si]) si = ok.indexOf(true);
    SX.logStat = si;
    const vals = games.map(g => numOf(g.stats[si])), avg = mean(vals);
    const draw = () => {
      el.innerHTML = `<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:17px">Game log</h2><span class="aside"><label for="pc-gl" class="sr">Stat</label><select id="pc-gl" class="sel">${labels.map((l, i) => ok[i] ? `<option value="${i}" ${i === si ? 'selected' : ''}>${esc(l)}</option>` : '').join('')}</select></span></div>
        ${C.cols(games.map((g, i) => ({ lab: (g.at === '@' ? '@' : 'v') + g.opp, v: vals[i], sel: false, tip: `${esc(new Date(g.t).toLocaleDateString([], { month: 'short', day: 'numeric' }))} ${esc(g.at)} ${esc(g.opp)} · ${esc(g.res)} ${esc(g.score)}<br>${esc(labels[si])} <b>${esc(String(g.stats[si]))}</b>` })), { base: 0, rot: games.length > 12, labEvery: games.length > 40 ? Math.ceil(games.length / 20) : 1, h: 200, aria: labels[si] + ' by game' })}
        <p class="note">Season average ${esc(labels[si])}: <b>${C.fmtAuto(avg)}</b> · last 5: <b>${C.fmtAuto(mean(vals.slice(-5)))}</b> · best: <b>${C.fmtAuto(Math.max(...vals.filter(fin)))}</b></p>
        <div class="tbl-wrap"><table class="tbl sx mini"><thead><tr><th class="l">Date</th><th class="l">Opp</th><th>Result</th>${labels.map(l => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${games.slice(-10).reverse().map(g => `<tr><td class="l">${esc(new Date(g.t).toLocaleDateString([], { month: 'short', day: 'numeric' }))}</td><td class="l">${esc(g.at)} ${esc(g.opp)}</td><td>${esc(g.res)} ${esc(g.score)}</td>${g.stats.map(s => `<td>${esc(String(s))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
    };
    draw();
    el.onchange = e => { if (e.target.id === 'pc-gl') { SX.logStat = +e.target.value; drawLog(gl, k); } };
  }
  function drawCareer(cats, k) {
    const el = $('#pc-career'); if (!el || !cats.length) return;
    let ci = Math.min(SX.carCat || 0, cats.length - 1); const cat = cats[ci];
    const labels = cat.labels, ok = labels.map((l, i) => cat.rows.filter(r => fin(numOf(r.stats[i]))).length >= Math.max(1, cat.rows.length * 0.6));
    let si = SX.carStat != null && ok[SX.carStat] && SX.carCatSeen === cat.name ? SX.carStat : pickLab(labels, k); if (!ok[si]) si = ok.indexOf(true);
    const byY = new Map(); for (const r of cat.rows) byY.set(r.y, r); // one point per season (latest entry wins for traded seasons)
    const pts = [...byY.values()].map(r => [r.y, numOf(r.stats[si])]).filter(p => fin(p[1]));
    el.innerHTML = `<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:17px">Career</h2><span class="aside">${cats.length > 1 ? `<span class="seg">${cats.map((c, i) => `<button type="button" data-pc-cat="${i}" aria-pressed="${i === ci}">${esc(c.disp)}</button>`).join('')}</span>` : esc(cat.disp)} <label for="pc-cs" class="sr">Stat</label><select id="pc-cs" class="sel">${labels.map((l, i) => ok[i] ? `<option value="${i}" ${i === si ? 'selected' : ''}>${esc(l)}</option>` : '').join('')}</select></span></div>
      ${pts.length > 1 ? C.lines([{ key: 'c', label: labels[si], pts, sel: true }], { dots: true, pointTips: true, xInt: true, yFmt: C.fmtAuto, aria: 'Career ' + labels[si] + ' by season', h: 220 }) : ''}
      <div class="tbl-wrap"><table class="tbl sx mini"><thead><tr><th class="l">Season</th><th class="l">Team</th>${labels.map(l => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${cat.rows.slice().reverse().map(r => `<tr><td class="l">${esc(r.lab)}</td><td class="l">${esc(String(r.team).replace(/-/g, ' '))}</td>${r.stats.map(s => `<td>${esc(String(s))}</td>`).join('')}</tr>`).join('')}${cat.totals.length ? `<tr class="tot"><td class="l">Career</td><td></td>${cat.totals.map(s => `<td>${esc(String(s))}</td>`).join('')}</tr>` : ''}</tbody></table></div></div>`;
    el.onchange = e => { if (e.target.id === 'pc-cs') { SX.carStat = +e.target.value; SX.carCatSeen = cat.name; drawCareer(cats, k); } };
    el.onclick = e => { const b = e.target.closest('[data-pc-cat]'); if (b) { SX.carCat = +b.getAttribute('data-pc-cat'); SX.carStat = null; drawCareer(cats, k); } };
  }

  /* ---------------- events ---------------- */
  function rerender() { renderStats(); }
  document.addEventListener('click', e => {
    const t = e.target; if (!t.closest) return;
    const inStats = t.closest('#view-stats'), inCard = t.closest('#drawer #pc-body');
    if (!inStats && !inCard) return;
    const v = t.closest('[data-sxv]'); if (v) { SX.view = v.getAttribute('data-sxv'); try { history.replaceState(null, '', '#stats' + (SX.view === 'teams' ? '' : '-' + SX.view)); } catch (x) { /* ignore */ } rerender(); return; }
    const tv2 = t.closest('[data-sxt-view]'); if (tv2) { SX.tview = tv2.getAttribute('data-sxt-view'); SX.tsort = null; rerender(); return; }
    const ts = t.closest('[data-sxt-sort]'); if (ts) { const k = ts.getAttribute('data-sxt-sort'); SX.tsort = SX.tsort && SX.tsort.k === k ? { k, desc: !SX.tsort.desc } : { k, desc: k === 'name' ? false : !ts.hasAttribute('data-low') }; rerender(); return; }
    const b = t.closest('[data-sxb]'); if (b) { SX.board = b.getAttribute('data-sxb'); SX.psort = null; SX.px = SX.py = null; SX.pmore = false; SX.pteam = ''; rerender(); return; }
    const ps = t.closest('[data-sxp-sort]'); if (ps) { const k = ps.getAttribute('data-sxp-sort'); SX.pdesc = SX.psort === k ? !SX.pdesc : !LOWER.test(k); SX.psort = k; rerender(); return; }
    if (t.closest('[data-sx-more]')) { SX.pmore = true; rerender(); return; }
    if (t.closest('[data-sx-retry]')) { rerender(); return; }
    const ld = t.closest('[data-sx-load]'); if (ld) { const d = db(SX.lg, SX.season); d.gamesWanted = true; const box = $('#sx-games'); loadStandings(SX.lg, SX.season).then(rows => drawGames(box, SX.lg, SX.season, teamMetrics(SX.lg, rows, null).filter(x => x.m.gp > 0), SX.tok)); return; }
    const pl = t.closest('[data-sx-player]'); if (pl) { openPlayer(pl.getAttribute('data-sx-player')); return; }
    const tm = t.closest('[data-sx-team]'); if (tm && inStats) { const key = tm.getAttribute('data-sx-team'); SX.card = key; openTeam(key); return; }
  });
  document.addEventListener('change', e => {
    const id = e.target.id;
    if (id === 'sx-lg') { S.league = e.target.value; S.lastSpecific = S.league; SX.lg = null; APP.renderAll(); return; }
    if (id === 'sx-season') { SX.season = +e.target.value; SX.sel = null; rerender(); return; }
    if (id === 'sx-tstat') { SX.tstat = e.target.value; const d = db(SX.lg, SX.season); if (d.rows) drawExplorer(SX.lg, SX.season, teamMetrics(SX.lg, d.rows, d.ts || null), d.ts || null); return; }
    if (id === 'sx-pteam') { SX.pteam = e.target.value; rerender(); return; }
    if (id === 'sx-qual') { SX.qual = e.target.checked; rerender(); return; }
    if (id === 'sx-px' || id === 'sx-py') { SX[id === 'sx-px' ? 'px' : 'py'] = e.target.value; rerender(); return; }
    if (id === 'sx-hteam') { SX.hteam = e.target.value; rerender(); return; }
    if (id === 'sx-hn') { SX.hn = +e.target.value; rerender(); return; }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'sx-pq') { clearTimeout(SX.qt); const v = e.target.value; SX.qt = setTimeout(() => { SX.pq = v; rerender(); const q = $('#sx-pq'); if (q) { q.focus(); q.setSelectionRange(v.length, v.length); } }, 200); }
  });
  APP.statsCfg = CFG; APP.seasonLabel = seasonLabel;
})();
