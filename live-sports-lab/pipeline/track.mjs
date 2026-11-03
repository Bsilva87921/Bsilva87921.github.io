#!/usr/bin/env node
/* Probable Sports Lab — track record (runs in GitHub Actions; Node 20+).

   1. Replay: every completed game of each league's current season, in start-time order, predicted with
      the lab's own rating model using only games that had finished before it started (no look-ahead),
      plus in-game checkpoints rebuilt from period scores (end of Q1/half/Q3, periods, innings, 45'/75').
   2. Prospective log: each run records what the live board shows for games about to start (ratings
      blended with the betting line, and the line itself), then grades them once they are final.
   Output: track.json for the site, plus the archive and log it keeps between runs.
   Usage: OUT_DIR=out PREV_DIR=prev node track.mjs [--offline DIR] */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SRC = process.env.LAB_SRC || path.resolve(HERE, '../source/src');
const OUT = process.env.OUT_DIR || 'out', PREV = process.env.PREV_DIR || 'prev';
const OFFLINE = process.argv.includes('--offline') ? process.argv[process.argv.indexOf('--offline') + 1] : null;
const ESPN = 'https://site.web.api.espn.com/apis/site/v2/sports/';
const REPLAY = ['nfl', 'mlb', 'nba', 'wnba', 'nhl', 'epl', 'laliga', 'seriea', 'bund', 'ligue1', 'mls'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '');
fs.mkdirSync(path.join(OUT, 'archive'), { recursive: true });

/* ---------- the lab's own code, loaded as the browser runs it ---------- */
function loadLab() {
  const store = new Map();
  const nfetch = (u, o) => { const x = Object.assign({}, o || {}); delete x.cache; x.headers = Object.assign({ 'User-Agent': 'ProbableSportsLab/1.0 (portfolio project)' }, x.headers || {}); return globalThis.fetch(u, x); };
  const ctx = { console, setTimeout, clearTimeout, Promise, URL, AbortController, fetch: nfetch,
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['01-models.js', '02-snapshot.js', '03-core.js']) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
  ctx.APP.loadStatic();
  return ctx;
}
const LAB = loadLab(), APP = LAB.APP, PM = LAB.PM, S = APP.S, LG = APP.LG;

/* ---------- fetching (with a small polite delay and retries) ---------- */
let calls = 0;
async function get(url) {
  if (OFFLINE) { const f = path.join(OFFLINE, Buffer.from(url).toString('base64url').slice(0, 180) + '.json'); return readJSON(f, null); }
  for (let a = 0; a < 3; a++) {
    try {
      calls++; const r = await fetch(url, { headers: { 'User-Agent': 'ProbableSportsLab/1.0 (portfolio project)' } });
      if (r.ok) return await r.json();
      if (r.status === 404 || r.status === 400) return null;
    } catch (e) { /* retry */ }
    await sleep(800 * (a + 1));
  }
  return null;
}
const sbURL = (lg, q) => ESPN + lg.path + '/scoreboard?' + (lg.q ? lg.q + '&' : '') + q + (/limit=/.test(q) ? '' : '&limit=300');

/* ---------- archive: completed games of the current season ---------- */
function compact(lg, ev) {
  const g = APP.parseEvent(lg, ev); if (!g || g.state !== 'post' || g.void) return null;
  const comp = ev.competitions[0], cs = comp.competitors || [];
  const H = cs.find(c => c.homeAway === 'home'), A = cs.find(c => c.homeAway === 'away');
  const ls = [H, A].map(c => (c && c.linescores || []).map(x => +x.value || 0));
  const o = { d: g.start, h: g.home.abbr, a: g.away.abbr, hn: g.home.name, an: g.away.name, hs: g.home.score, as: g.away.score, t: (ev.season && ev.season.type) || 0, n: g.neutral ? 1 : 0, p: g.playoff ? 1 : 0 };
  if (ls[0].length && ls[1].length) o.ls = ls;
  if (APP.kindOf(lg.id) === 'sc') {
    const side = id => String(id) === String(H.team.id) ? 'h' : String(id) === String(A.team.id) ? 'a' : null;
    o.gl = (comp.details || []).filter(d => d.scoringPlay && !d.shootout).map(d => [Math.round((d.clock && d.clock.value || 0) / 60), side(d.team && d.team.id)]).filter(x => x[1]);
    o.rc = (comp.details || []).filter(d => d.redCard).map(d => [Math.round((d.clock && d.clock.value || 0) / 60), side(d.team && d.team.id)]).filter(x => x[1]);
  }
  return o;
}
async function updateArchive(lgId) {
  const lg = LG[lgId];
  const head = await get(sbURL(lg, 'dates=' + ymd(new Date())));
  const L = head && head.leagues && head.leagues[0]; if (!L || !L.season) return null;
  const season = String(L.season.year), file = `${lgId}-${season}.json`;
  const ar = readJSON(path.join(PREV, 'archive', file), null) || { lg: lgId, season, label: L.season.displayName || season, games: {}, done: {} };
  const today = ymd(new Date()), recent = ymd(new Date(Date.now() - 3 * 864e5));
  const want = [];
  if (L.calendarType === 'day' || (Array.isArray(L.calendar) && typeof L.calendar[0] === 'string')) {
    for (const d of L.calendar || []) { const k = ymd(new Date(d)); if (k < today && (!ar.done[k] || k >= recent)) want.push(['dates=' + k, k]); }
  } else {
    for (const st of L.calendar || []) { if (!['2', '3'].includes(String(st.value))) continue; for (const w of st.entries || []) { const k = 'w' + st.value + '-' + w.value; if (new Date(w.startDate) > new Date()) continue; const fresh = new Date(w.endDate) > new Date(Date.now() - 4 * 864e5); if (!ar.done[k] || fresh) want.push([`dates=${season}&seasontype=${st.value}&week=${w.value}`, k]); } }
  }
  for (const [q, k] of want) {
    const js = await get(sbURL(lg, q)); if (!js) continue;
    for (const ev of js.events || []) { const t = (ev.season && ev.season.type) || 0; if (t === 1) continue; const c = compact(lg, ev); if (c) ar.games[ev.id] = c; }
    ar.done[k] = new Date().toISOString(); await sleep(120);
  }
  fs.writeFileSync(path.join(OUT, 'archive', file), JSON.stringify(ar));
  return ar;
}

/* ---------- replay: predict each game from what was known when it started ---------- */
const kindOf = id => APP.kindOf(id);
function stateAt(lgId, g, stage) {         // in-game state at the end of a period, from line scores
  const sp = PM.SP[LG[lgId].sp], k = sp.kind, sum = (a, n) => a.slice(0, n).reduce((x, y) => x + y, 0);
  if (k === 'sc') { const m = stage; const sc = s => g.gl.filter(x => x[0] <= m && x[1] === s).length, rc = s => (g.rc || []).filter(x => x[0] <= m && x[1] === s).length; return { hs: sc('h'), as: sc('a'), minute: m, redH: rc('h'), redA: rc('a') }; }
  const [hl, al] = g.ls; if (!hl || hl.length < stage) return null;
  const hs = sum(hl, stage), as = sum(al, stage);
  if (k === 'fb') return { hs, as, period: stage + 1, clock: sp.perLen, poss: null, down: 1, dist: 10, yl: 25 };
  if (k === 'bk') return { hs, as, period: stage + 1, clock: sp.perLen, poss: null };
  if (k === 'hk') return { hs, as, period: stage + 1, clock: sp.perLen || 1200, pp: null, ppSec: 0, en: null };
  if (k === 'bb') return { hs, as, inning: stage + 1, half: 'top', outs: 0, b1: 0, b2: 0, b3: 0 };
}
const STAGES = { fb: [[1, 'After Q1'], [2, 'Halftime'], [3, 'After Q3']], bk: [[1, 'After Q1'], [2, 'Halftime'], [3, 'After Q3']], hk: [[1, 'After P1'], [2, 'After P2']], bb: [[3, 'After 3 innings'], [6, 'After 6 innings']], sc: [[45, 'Halftime'], [75, "75'"]] };
function outcome(g, k) { if (g.hs > g.as) return 'H'; if (g.as > g.hs) return 'A'; return k === 'sc' ? 'D' : 'T'; }
function score(p, o, k) {
  const pD = p.pD || 0, pA = p.pA != null ? p.pA : 1 - p.pH - pD;
  const oH = o === 'H' ? 1 : o === 'T' ? 0.5 : 0, oA = o === 'A' ? 1 : o === 'T' ? 0.5 : 0, oD = o === 'D' ? 1 : 0;
  const brier = k === 'sc' ? ((p.pH - oH) ** 2 + (pA - oA) ** 2 + (pD - oD) ** 2) / 2 : (p.pH - oH) ** 2;
  const fav = k === 'sc' ? (p.pH >= pA && p.pH >= pD ? 'H' : pA >= pD ? 'A' : 'D') : (p.pH >= 0.5 ? 'H' : 'A');
  const pf = fav === 'H' ? p.pH : fav === 'A' ? pA : pD;
  const po = o === 'H' ? p.pH : o === 'A' ? pA : o === 'D' ? pD : 0.5;
  return { brier, hit: o === 'T' ? 0.5 : fav === o ? 1 : 0, pf, ll: -Math.log(Math.max(1e-4, po)) };
}
function summarize(rows) {
  const n = rows.length; if (!n) return null;
  const m = f => rows.reduce((a, r) => a + f(r), 0) / n;
  const edges = [0.33, 0.45, 0.55, 0.65, 0.75, 0.85, 1.0001];
  const bins = [];
  for (let i = 0; i < edges.length - 1; i++) { const b = rows.filter(r => r.s.pf >= edges[i] && r.s.pf < edges[i + 1]); if (b.length >= 5) bins.push([edges[i], Math.min(1, edges[i + 1]), b.length, +(b.reduce((a, r) => a + r.s.pf, 0) / b.length).toFixed(3), +(b.reduce((a, r) => a + r.s.hit, 0) / b.length).toFixed(3)]); }
  const brier = m(r => r.s.brier), base = m(r => r.b.brier);
  return { n, acc: +m(r => r.s.hit).toFixed(3), brier: +brier.toFixed(4), base: +base.toFixed(4), skill: +(1 - brier / base).toFixed(3), logloss: +m(r => r.s.ll).toFixed(3), baseAcc: +m(r => r.b.hit).toFixed(3), bins };
}
function replay(ar) {
  const lgId = ar.lg, lg = LG[lgId], sp = PM.SP[lg.sp], k = sp.kind, d = S.data[lgId];
  const games = Object.entries(ar.games).map(([id, g]) => Object.assign({ id }, g)).sort((a, b) => new Date(a.d) - new Date(b.d));
  const tab = new Map(); // abbr -> standings row
  const row = (abbr, name) => { let r = tab.get(abbr); if (!r) { r = { key: abbr, abbr, name, w: 0, l: 0, t: 0, pf: 0, pa: 0, gp: 0, pts: 0 }; tab.set(abbr, r); } return r; };
  const pending = []; const rows = [], stages = {}, recent = [];
  const apply = g => {
    const h = row(g.h, g.hn), a = row(g.a, g.an); h.gp++; a.gp++; h.pf += g.hs; h.pa += g.as; a.pf += g.as; a.pa += g.hs;
    if (g.hs > g.as) { h.w++; a.l++; h.pts += 3; } else if (g.as > g.hs) { a.w++; h.l++; a.pts += 3; } else { h.t++; a.t++; h.pts++; a.pts++; }
  };
  for (const g of games) {
    const t0 = new Date(g.d).getTime();
    while (pending.length && new Date(pending[0].d).getTime() + 4 * 3600e3 <= t0) apply(pending.shift());
    // standings as of this game's start → ratings (same code path as the live page)
    d.standings = [...tab.values()].map(r => Object.assign({}, r, { pf: r.gp ? r.pf : NaN, pa: r.gp ? r.pa : NaN, pts: k === 'sc' ? r.pts : undefined, t: k === 'hk' ? 0 : r.t }));
    row(g.h, g.hn); row(g.a, g.an);
    for (const ab of [g.h, g.a]) if (!d.standings.find(r => r.key === ab)) d.standings.push({ key: ab, abbr: ab, name: ab === g.h ? g.hn : g.an, w: 0, l: 0, t: 0, gp: 0, pf: NaN, pa: NaN });
    if (d.priorsByName) { d.priors = {}; for (const r of d.standings) { const v = d.priorsByName[APP.norm(r.name)]; if (isFinite(v)) d.priors[r.key] = v; } }
    d.stVer = (d.stVer || 0) + 1; d.ratings = null; S.cache.clear();
    const ev = { id: g.id, lg: lgId, start: g.d, state: 'pre', home: { abbr: g.h, name: g.hn }, away: { abbr: g.a, name: g.an }, neutral: !!g.n, playoff: !!g.p, sit: {} };
    const P = APP.predict(ev);
    const o = outcome(g, k);
    if (P.src !== 'none') {
      const base = APP.evaluate(lgId, APP.fixBase(lgId, APP.baseState(k)), PM.expect(sp, P.ex.lg, null, null, { neutral: !!g.n }), { n: 800, seed: 3 });
      rows.push({ s: score(P.pre, o, k), b: score(base, o, k) });
      recent.push([g.d.slice(0, 10), g.a + '@' + g.h, +P.pre.pH.toFixed(3), +(P.pre.pD || 0).toFixed(3), o, g.as + '-' + g.hs]);
      for (const [st, lab] of STAGES[k] || []) {
        if (k === 'sc' ? !g.gl : !g.ls) continue;
        const s = stateAt(lgId, g, st); if (!s) continue;
        const r = APP.evaluate(lgId, s, P.ex, { n: k === 'bb' ? 700 : 1200, seed: 5 });
        (stages[lab] || (stages[lab] = [])).push({ s: score(r, o, k), b: score({ pH: s.hs > s.as ? 1 : s.as > s.hs ? 0 : 0.5, pA: s.hs > s.as ? 0 : s.as > s.hs ? 1 : 0.5, pD: 0 }, o, k) });
      }
    }
    pending.push(g);
  }
  const sum = summarize(rows);
  if (!sum) return null;
  sum.season = ar.label; sum.games = games.length;
  sum.ingame = Object.entries(stages).map(([stage, rs]) => { const x = summarize(rs); return { stage, n: x.n, acc: x.acc, brier: x.brier, leaderBrier: x.base }; });
  sum.recent = recent.slice(-12).reverse();
  return { sum, rows };
}

/* ---------- prospective log: what the live board showed before each game ---------- */
async function prospective() {
  const log = readJSON(path.join(PREV, 'log.json'), { games: {} });
  if (!OFFLINE) { await APP.refreshLive(false); }
  const now = Date.now();
  for (const g of APP.allGames()) {
    const e = log.games[g.id];
    if (g.state === 'pre' && new Date(g.start) - now < 3 * 3600e3 && new Date(g.start) - now > -15 * 60e3) {
      const P = APP.predict(g), L = APP.lineProbs(g);
      log.games[g.id] = { lg: g.lg, d: g.start, m: g.away.abbr + '@' + g.home.abbr, src: P.src, p: [+P.pre.pH.toFixed(4), +(P.pre.pD || 0).toFixed(4)], line: L ? [+L.pH.toFixed(4), +(L.pD || 0).toFixed(4)] : null, at: new Date(now).toISOString() };
    } else if (e && !e.o && g.state === 'post' && !g.void) { e.o = (g.home.score > g.away.score ? 'H' : g.away.score > g.home.score ? 'A' : kindOf(g.lg) === 'sc' ? 'D' : 'T'); e.f = g.away.score + '-' + g.home.score; }
  }
  // keep 400 days
  for (const [id, e] of Object.entries(log.games)) if (now - new Date(e.d) > 400 * 864e5) delete log.games[id];
  fs.writeFileSync(path.join(OUT, 'log.json'), JSON.stringify(log));
  const graded = Object.values(log.games).filter(e => e.o);
  const mk = (sel) => { const rs = graded.filter(sel); if (!rs.length) return null; const k = e => kindOf(e.lg);
    const model = rs.map(e => score({ pH: e.p[0], pD: e.p[1] }, e.o, k(e))), line = rs.filter(e => e.line).map(e => score({ pH: e.line[0], pD: e.line[1] }, e.o, k(e)));
    const mean = (a, f) => a.length ? +(a.reduce((x, r) => x + f(r), 0) / a.length).toFixed(4) : null;
    const both = rs.filter(e => e.line);
    return { n: rs.length, model: { acc: mean(model, r => r.hit), brier: mean(model, r => r.brier) }, line: line.length ? { n: line.length, acc: mean(line, r => r.hit), brier: mean(line, r => r.brier) } : null, modelOnLined: both.length ? { acc: mean(both.map(e => score({ pH: e.p[0], pD: e.p[1] }, e.o, k(e))), r => r.hit), brier: mean(both.map(e => score({ pH: e.p[0], pD: e.p[1] }, e.o, k(e))), r => r.brier) } : null };
  };
  const byLeague = {}; for (const id of Object.keys(LG)) { const x = mk(e => e.lg === id); if (x) byLeague[id] = x; }
  const since = graded.map(e => e.d).sort()[0] || null;
  return { since, all: mk(() => true), byLeague, pending: Object.values(log.games).filter(e => !e.o).length };
}

/* ---------- main ---------- */
const t0 = Date.now();
const out = { asOf: new Date().toISOString(), method: 'Replayed with the lab\'s rating model using only games finished before each start; in-game checkpoints from period scores. The prospective record logs the live board\'s pregame number and the betting line before each game.', leagues: {} };
const pooled = [];
function offlineArchive(id) {          // smoke test: build an archive from saved scoreboard files named <league>_*.json
  const ar = { lg: id, season: 'test', label: 'test', games: {}, done: {} };
  for (const f of fs.readdirSync(OFFLINE).filter(f => f.startsWith(id + '_') && f.endsWith('.json'))) {
    const js = readJSON(path.join(OFFLINE, f), {}); for (const ev of js.events || []) { const c = compact(LG[id], ev); if (c) ar.games[ev.id] = c; }
  }
  return Object.keys(ar.games).length ? ar : null;
}
for (const id of REPLAY) {
  try {
    const ar = OFFLINE ? offlineArchive(id) : await updateArchive(id); if (!ar) { console.log(id, 'no season'); continue; }
    const r = replay(ar); if (!r) { console.log(id, 'no graded games'); continue; }
    out.leagues[id] = r.sum; pooled.push(...r.rows);
    console.log(id, ar.label, 'graded', r.sum.n, 'acc', r.sum.acc, 'brier', r.sum.brier, 'skill', r.sum.skill);
  } catch (e) { console.log(id, 'failed', e && e.message); }
}
out.all = summarize(pooled);
try { out.live = OFFLINE ? null : await prospective(); } catch (e) { console.log('prospective failed', e && e.message); out.live = readJSON(path.join(PREV, 'track.json'), {}).live || null; }
out.calls = calls; out.seconds = Math.round((Date.now() - t0) / 1000);
fs.writeFileSync(path.join(OUT, 'track.json'), JSON.stringify(out));
console.log('done', out.seconds + 's', calls, 'requests', 'pooled', out.all && out.all.n);
