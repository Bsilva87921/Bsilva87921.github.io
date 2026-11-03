/* ==========================================================================
   Probable — Ask AI for the Sports Lab. A built-in analyst answers from the
   live board, team ratings, the win-probability models, the 260-scenario
   what-if library, standings simulations and the track record. With Claude
   (site service, a visitor's API key, or the Claude-hosted copy) the same
   functions are tools. Analysis, not betting advice.
   ========================================================================== */
(function () {
  'use strict';
  const APP = window.APP, S = APP.S, LG = APP.LG, LEAGUES = APP.LEAGUES, PM = window.PM, esc = APP.esc;
  const pc = p => isFinite(p) ? Math.round(p * 100) + '%' : '—';
  const kindOf = APP.kindOf, lgN = id => LG[id].short || LG[id].name;
  const clone = o => JSON.parse(JSON.stringify(o));
  const norm = s => ' ' + String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'").replace(/[^a-z0-9%&+.\- ']/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  const has = (q, ws) => ws.some(w => w instanceof RegExp ? w.test(q) : q.includes(w));
  const nowRef = () => S.mode === 'snapshot' && S.capturedAt ? +new Date(S.capturedAt) : Date.now();

  /* ---------------- leagues and teams ---------------- */
  const LGW = { nfl: ['nfl', 'pro football', 'super bowl'], ncaaf: ['college football', 'ncaaf', 'cfb', 'ncaa football'], mlb: ['mlb', 'baseball', 'world series'], nba: ['nba', 'pro basketball'], wnba: ['wnba'], nhl: ['nhl', 'hockey', 'stanley cup'], epl: ['premier league', 'epl', 'english football'], laliga: ['laliga', 'la liga', 'spanish'], seriea: ['serie a', 'italian'], bund: ['bundesliga', 'german'], ligue1: ['ligue 1', 'french'], mls: ['mls'], ucl: ['champions league', 'ucl'] };
  function leagueIn(q) { for (const [id, ws] of Object.entries(LGW)) if (ws.some(w => q.includes(' ' + w + ' '))) return id; if (/ soccer | football club /.test(q)) return 'epl'; return null; }
  const STOP = new Set(['the', 'and', 'for', 'who', 'win', 'are', 'can', 'all', 'new', 'how', 'why', 'odd', 'top', 'out', 'man', 'was', 'its', 'not', 'any', 'one', 'two', 'now', 'see', 'get', 'set', 'lab', 'oct', 'nov', 'dec', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'pro', 'per', 'off', 'def', 'net', 'run', 'bet', 'fan', 'tie', 'ot']);
  let TIX = null, TIXv = '';
  function teamIndex() {
    const v = S.lastUpdate + '|' + S.mode; if (TIX && TIXv === v) return TIX;
    const m = new Map();
    const add = (lg, t) => { if (!t || !t.abbr) return; const k = lg + '|' + t.abbr; const o = m.get(k) || { lg, abbr: t.abbr, name: t.name || t.abbr, short: t.short || '' }; if (t.name && t.name.length > o.name.length) o.name = t.name; if (t.short && !o.short) o.short = t.short; m.set(k, o); };
    for (const l of LEAGUES) { for (const r of S.data[l.id].standings || []) add(l.id, { abbr: r.abbr || r.key, name: r.name }); for (const g of S.data[l.id].games || []) { add(l.id, g.home); add(l.id, g.away); } }
    TIX = [...m.values()].map(t => {
      const n = norm(t.name).trim(), parts = n.split(' ');
      const keys = new Set([n]);
      if (t.short) keys.add(norm(t.short).trim());
      if (parts.length > 1) { keys.add(parts[parts.length - 1]); if (parts.length > 2) keys.add(parts.slice(-2).join(' ')); keys.add(parts.slice(0, -1).join(' ')); }
      return Object.assign(t, { keys: [...keys].filter(k => k.length >= 3 && !STOP.has(k)) });
    });
    TIXv = v; return TIX;
  }
  function gameOf(lg, abbr) {
    const gs = (S.data[lg].games || []).filter(g => !g.void && (g.home.abbr === abbr || g.away.abbr === abbr));
    const t = g => +new Date(g.start), ref = nowRef();
    return gs.find(g => g.state === 'in') || gs.filter(g => g.state === 'pre').sort((a, b) => t(a) - t(b))[0] || gs.filter(g => g.state === 'post').sort((a, b) => t(b) - t(a))[0] || null;
  }
  // teams named in a question, best match first; league words and current games break ties
  function teamsIn(raw, lgHint) {
    const q = norm(raw), up = String(raw || '');
    const hits = [];
    for (const t of teamIndex()) {
      let best = 0;
      for (const k of t.keys) if (q.includes(' ' + k + ' ')) best = Math.max(best, k.length + (k.includes(' ') ? 4 : 0));
      if (new RegExp('\\b' + t.abbr.replace(/[^A-Z0-9&]/gi, '') + '\\b').test(up) && t.abbr.length >= 2 && t.abbr === t.abbr.toUpperCase()) best = Math.max(best, 6);
      if (!best) continue;
      const g = gameOf(t.lg, t.abbr);
      best += (lgHint && t.lg === lgHint ? 30 : 0) + (g && g.state === 'in' ? 3 : g && g.state === 'pre' ? 2 : g ? 1 : 0) + ({ nfl: 1.5, nba: 1.4, mlb: 1.3, nhl: 1.2, epl: 1.1 }[t.lg] || 0);
      hits.push({ t, s: best, pos: Math.min(...t.keys.map(k => { const i = q.indexOf(' ' + k + ' '); return i < 0 ? 1e9 : i; })) });
    }
    hits.sort((a, b) => b.s - a.s);
    const out = []; const seenName = new Set();
    for (const h of hits) { const nk = norm(h.t.name); if (seenName.has(nk + h.t.lg)) continue; if (out.some(o => o.t.keys.some(k => h.t.keys.includes(k)) && o.t.lg !== h.t.lg && o.s >= h.s)) continue; seenName.add(nk + h.t.lg); out.push(h); if (out.length >= 2) break; }
    return out.sort((a, b) => a.pos - b.pos).map(h => h.t);
  }
  function findGame(raw, lgHint) {
    const ts = teamsIn(raw, lgHint);
    if (ts.length >= 2) {
      const [a, b] = ts; const gs = (S.data[a.lg].games || []).filter(g => [g.home.abbr, g.away.abbr].includes(a.abbr) && [g.home.abbr, g.away.abbr].includes(b.abbr));
      if (gs.length) return { g: gs.find(g => g.state === 'in') || gs.find(g => g.state === 'pre') || gs[0], teams: ts };
      return { g: null, teams: ts };
    }
    if (ts.length === 1) return { g: gameOf(ts[0].lg, ts[0].abbr), teams: ts };
    return { g: null, teams: [] };
  }

  /* ---------------- facts ---------------- */
  const sideName = (g, s) => g[s].name;
  function gameFacts(g) {
    const P = APP.predict(g), L = APP.lineProbs(g), k = kindOf(g.lg), ex = P.ex;
    const pr = r => ({ home: +r.pH.toFixed(3), away: +(r.pA != null ? r.pA : 1 - r.pH - (r.pD || 0)).toFixed(3), draw: r.pD ? +r.pD.toFixed(3) : undefined });
    const o = { id: g.id, league: lgN(g.lg), home: g.home.name, away: g.away.name, homeAbbr: g.home.abbr, awayAbbr: g.away.abbr, state: { pre: 'scheduled', in: 'live', post: 'final' }[g.state], start: g.start, status: g.detail || '', neutralSite: !!g.neutral, venue: g.venue || undefined };
    if (g.state !== 'pre') o.score = { home: g.home.score, away: g.away.score };
    o.pregame = pr(P.pre);
    if (g.state === 'in') o.now = pr(P.now);
    if (g.state === 'post') o.winner = g.home.winner ? g.home.name : g.away.winner ? g.away.name : 'draw';
    o.expectedScore = { home: +ex.eH.toFixed(1), away: +ex.eA.toFixed(1), unit: PM.SP[LG[g.lg].sp].unit || (k === 'bb' ? 'runs' : k === 'hk' || k === 'sc' ? 'goals' : 'points') };
    o.source = { model: 'team ratings', line: 'betting line', blend: 'ratings blended with the betting line (ratings weight ' + Math.round((ex.w || 0) * 100) + '%)', none: 'no rating yet' }[P.src] || P.src;
    if (L) o.line = { provider: g.line.src, home: +L.pH.toFixed(3), away: +L.pA.toFixed(3), spread: g.line.spread, total: g.line.total, text: g.line.text };
    if (g.espnWP) o.espnWinProbability = { home: g.espnWP.pH / 100, away: g.espnWP.pA / 100 };
    const h = S.hist.get(g.id); if (h && h.length > 2) o.winProbHistory = h.slice(-12).map(([t, p]) => ({ t: new Date(t).toISOString().slice(11, 16) + 'Z', home: +p.toFixed(3) }));
    if (g.state === 'in') o.situation = g.sit;
    return o;
  }
  function gameMD(g, short) {
    const f = gameFacts(g), sc = kindOf(g.lg) === 'sc', P = APP.predict(g);
    const m = sc ? `**${g.home.name}** vs **${g.away.name}**` : `**${g.away.name}** at **${g.home.name}**`;
    const when = g.state === 'pre' ? APP.when(g.start) : g.state === 'in' ? 'live · ' + (g.detail || '') : 'final · ' + (g.detail || '');
    const R = g.state === 'in' ? f.now : f.pregame, fav = R.home >= R.away ? 'home' : 'away';
    let t = `${m} (${f.league}, ${when})`;
    if (g.state !== 'pre') t += ` — ${g.away.abbr} ${g.away.score ?? 0}, ${g.home.abbr} ${g.home.score ?? 0}`;
    if (g.state === 'post') { t += `. Before the game the lab had ${g[fav].name} at ${pc(R[fav])}${(fav === 'home' ? g.home.winner : g.away.winner) ? ', and they won' : ', so this was an upset'}.`; return t; }
    t += `.\n\n- **${g.state === 'in' ? 'Now' : 'Win chances'}:** ${g.away.abbr} ${pc(R.away)}${R.draw ? ` · draw ${pc(R.draw)}` : ''} · ${g.home.abbr} ${pc(R.home)}`;
    if (g.state === 'in') t += ` (pregame ${g[fav].abbr} ${pc(f.pregame[fav])})`;
    if (short) return t;
    t += `\n- **Expected score:** ${g.away.abbr} ${f.expectedScore.away} – ${f.expectedScore.home} ${g.home.abbr} (${f.expectedScore.unit})`;
    t += `\n- **Built from:** ${f.source}`;
    if (f.line) t += `\n- **Betting line (${esc(f.line.provider)}):** ${g.home.abbr} ${pc(f.line.home)}${f.line.text ? ' · ' + f.line.text : ''}${Math.abs(f.line.home - f.pregame.home) >= 0.05 ? ` — the model differs by ${Math.round(Math.abs(f.line.home - f.pregame.home) * 100)} points` : ''}`;
    if (f.espnWinProbability) t += `\n- **ESPN's live model:** ${g.home.abbr} ${pc(f.espnWinProbability.home)}`;
    return t;
  }
  function teamFacts(lg, abbr) {
    const R = APP.ratingsFor(lg), r = R && R.teams[abbr], row = (S.data[lg].standings || []).find(x => x.key === abbr || x.abbr === abbr);
    const rk = APP.teamRank ? (() => { const g = { lg, home: { abbr }, away: { abbr: '' } }; try { return APP.teamRank(g, 'home'); } catch (e) { return null; } })() : null;
    const o = { team: (row && row.name) || abbr, league: lgN(lg), abbr };
    if (row) o.record = row.w + '-' + row.l + (row.t ? '-' + row.t : '') + (isFinite(row.pts) ? ` (${row.pts} pts)` : ''), o.group = row.group, o.streak = row.streak || undefined;
    if (r) o.rating = { net: +r.net.toFixed(2), unit: PM.SP[LG[lg].sp].unit || '', source: r.source === 'prior' ? 'last season (regressed)' : 'this season' };
    if (rk) o.powerRank = rk.rank + ' of ' + rk.n;
    const g = gameOf(lg, abbr); if (g) o.game = gameFacts(g);
    try {
      if (!LG[lg].noStandings && (S.data[lg].standings || []).length && APP.simTable) {
        const sim = APP.simTable(lg, null, 0, {})[abbr];
        if (sim && sim.rank) { const n = LG[lg].playoffN; o.projection = n ? { playoffs: +sim.rank.slice(1, n + 1).reduce((a, b) => a + b, 0).toFixed(3), topSeed: +sim.rank[1].toFixed(3) } : { title: +sim.rank[1].toFixed(3), top4: +sim.rank.slice(1, (LG[lg].top || 4) + 1).reduce((a, b) => a + b, 0).toFixed(3) }; }
      }
    } catch (e) { /* standings sim unavailable */ }
    return o;
  }

  /* ---------------- what-if ---------------- */
  const sideOf = (g, abbrOrSide) => abbrOrSide === 'home' || abbrOrSide === 'away' ? abbrOrSide : g.home.abbr === abbrOrSide ? 'home' : g.away.abbr === abbrOrSide ? 'away' : null;
  function whatIf(g, picks) {
    const SC = APP.scen, lg = LG[g.lg], sp = PM.SP[lg.sp], kind = sp.kind;
    const T = { home: g.home, away: g.away }, cx = { lgId: g.lg, sp, ab: s => T[s].abbr };
    let st = clone(APP.stateFrom(g)); const conds = [], applied = [], skipped = [];
    let chance = null;
    for (const p of picks) {
      const it = SC.find(kind, p.id); if (!it) { skipped.push(p.id + ' (unknown)'); continue; }
      const side = it.per ? (sideOf(g, p.side) || (it.per === 'bat' ? SC.batting(st) : st.poss || 'home')) : null;
      const lab = SC.label ? SC.label(it, side ? T[side].abbr : '', side ? T[side === 'home' ? 'away' : 'home'].abbr : '', st, cx) : it.lab;
      const av = SC.avail(it, st, side || 'home', cx); if (av !== true) { skipped.push(lab + ' — ' + String(av).replace(/\{T\}/g, side ? T[side].abbr : '')); continue; }
      if (it.type === 'cond') { conds.push({ id: it.id, side }); applied.push(lab); }
      else if (it.type === 'event') { it.ev(st, side, cx); applied.push(lab); }
      else if (it.type === 'chance') { chance = { it, side, lab }; applied.push(lab); }
    }
    const m = SC.mods(kind, sp, conds), neutral = m.neutral ? true : !!g.neutral;
    const lineH = g.neutral ? 0 : sp.hfa, newH = neutral ? 0 : sp.hfa * m.hfa;
    const ex0 = APP.expFor(g.lg, g.home.abbr, g.away.abbr, g.line, { neutral, hfaMul: m.hfa, hfaDelta: newH - lineH, adjH: m.adjH, adjA: m.adjA, pace: m.pace });
    const ex = Object.assign({}, ex0); ex.eH *= m.mulH; ex.eA *= m.mulA; ex.mu = ex.eH - ex.eA; ex.total = ex.eH + ex.eA; ex.vol = m.vol;
    const run = s => APP.evaluate(g.lg, s, ex, { n: kind === 'bb' ? 4000 : 6000, seed: 7, playoff: g.playoff });
    let res;
    if (chance) {
      const brs = chance.it.br(st, chance.side, cx), tot = brs.reduce((a, b) => a + b.p, 0) || 1;
      const outs = brs.map(b => { const s2 = clone(st); b.ev(s2); return { p: b.p / tot, lab: String(b.lab || '').replace(/\{T\}/g, T[chance.side].abbr), r: run(s2) }; });
      const mix = k => outs.reduce((a, o) => a + o.p * (o.r[k] || 0), 0);
      res = { pH: mix('pH'), pA: mix('pA'), pD: mix('pD'), branches: outs.map(o => ({ outcome: o.lab, chance: +o.p.toFixed(3), homeWin: +o.r.pH.toFixed(3) })) };
    } else res = run(st);
    const P = APP.predict(g), base = g.state === 'in' ? P.now : P.pre;
    return { applied, skipped, before: { home: +base.pH.toFixed(3), away: +(base.pA ?? 1 - base.pH).toFixed(3) }, after: { home: +res.pH.toFixed(3), away: +(res.pA ?? 1 - res.pH - (res.pD || 0)).toFixed(3), draw: res.pD ? +res.pD.toFixed(3) : undefined }, branches: res.branches };
  }
  // match plain words to the scenario library ("what if Seattle loses its QB?")
  function matchScenarios(raw, g) {
    const SC = APP.scen, kind = kindOf(g.lg), q = norm(raw);
    const tn = [g.home, g.away].flatMap(t => [t.name, t.short, t.abbr].filter(Boolean).map(x => norm(x).trim()));
    let qq = q; for (const x of tn) qq = qq.split(' ' + x + ' ').join(' {t} ');
    const words = qq.split(' ').filter(w => w.length >= 2 && !['if', 'what', 'happens', 'the', 'and', 'their', 'its', 'his', 'with', 'does', 'did', 'will', 'would', 'game', 'they', 'gets', 'get', 'has', 'have', 'to', 'of', 'in', 'on', 'at', 'is', 'an', 'a'].includes(w));
    const syn = { qb: ['quarterback'], td: ['touchdown'], fg: ['field goal', 'kick'], hr: ['homer', 'home run', 'homerun'], pk: ['penalty kick', 'penalty'], rc: ['red card', 'sent off'], g: ['goal', 'scores'], sup: ['superstar', 'star'], pen: ['penalty'] };
    const scored = SC.list(kind).map(it => {
      const lab = norm(it.lab.replace(/\{T\}|\{O\}/g, ' ')), tip = norm(it.tip || '');
      let s = words.includes(it.id) ? 3 : 0; for (const w of words) { if (lab.includes(' ' + w + ' ') || lab.includes(' ' + w)) s += 2; else if (tip.includes(' ' + w)) s += 0.5; }
      for (const [k, arr] of Object.entries(syn)) if (it.id === k || it.id.startsWith(k)) for (const a of arr) if (q.includes(' ' + a)) s += 2.5;
      if (/ td | touchdown /.test(q) && it.id === 'td') s += 3; if (/ three /.test(q) && it.id === 'p3') s += 3; if (/ home run | homer /.test(q) && it.id === 'hr') s += 3;
      if (/ (loses|lose|without|injur|out) /.test(q) && it.type === 'cond' && it.cat === 'pers') s += 1.5;
      if (/ (score|scores) /.test(q) && it.type === 'event' && it.cat === 'score') s += 1;
      return { it, s };
    }).filter(x => x.s >= 2.5).sort((a, b) => b.s - a.s);
    if (!scored.length) return [];
    const ts = teamsIn(raw, g.lg).filter(t => t.lg === g.lg);
    const side = ts.length ? sideOf(g, ts[0].abbr) : null;
    return [{ id: scored[0].it.id, side, lab: scored[0].it.lab, alt: scored.slice(1, 4).map(x => x.it.lab) }];
  }

  /* ---------------- built-in analyst ---------------- */
  const GLOSS = {
    'win probability': 'Live win probability re-runs a model of the rest of the game from the current state. Football and basketball use a Brownian-motion model of the score margin (Stern, 1994), with football adding the expected points of the current possession; baseball simulates the rest of the game plate appearance by plate appearance; hockey and soccer treat goals as Poisson processes (with power plays, pulled goalies, red cards and a Dixon–Coles draw correction); tennis chains serve points to games, sets and the match.',
    'ratings': 'Each team gets a rating in its sport\'s own unit — points, runs or goals per game above an average opponent on a neutral field — from scoring margin (or record through the sport\'s scoring spread), regressed toward average with phantom games. Early in a season NBA and NHL ratings lean on last season. When a betting line exists, the pregame prior blends ratings and line, trusting ratings more as games accumulate (weight = games ÷ (games + K)).',
    'elo': 'Elo replays a season game by game: the winner takes rating points from the loser, more for an upset and (here) more for a bigger margin, with a home edge. It ends up close to SRS but reacts to recent form.',
    'pythagorean': 'Pythagorean expectation turns points scored and allowed into an expected win rate: PF^x ÷ (PF^x + PA^x), with x = 2.37 in the NFL, 14 in basketball, 1.83 in baseball and 2.05 in hockey. Teams that win more than it predicts have usually been lucky in close games.',
    'srs': 'SRS (Simple Rating System) is a team\'s average margin with the home edge removed plus the average rating of its opponents, solved for all teams at once; the opponents\' part is its strength of schedule.',
    'what-if': 'The what-if simulator re-runs the same models after a change: an event (a touchdown, a red card), a condition that stays on (a star out, snow, a back-to-back) or a chance play whose outcomes are blended by their odds (a field-goal try, a penalty kick). The library holds about 260 situations.',
    'projections': 'Season projections simulate the rest of the season 1,600 times from each team\'s rating, treating remaining games as matchups against an average opponent (tiebreakers aren\'t modeled), and count how often each team finishes in each place.',
    'line': 'A betting line (spread or moneyline) is the market\'s estimate. The lab converts it to a probability with the vig removed and shows it next to the model so disagreements are visible; early in a season the pregame number leans on it.'
  };
  function explain(q) {
    const k = /elo/.test(q) ? 'elo' : /pythag/.test(q) ? 'pythagorean' : /\bsrs\b|strength of schedule/.test(q) ? 'srs' : /what.?if|scenario|simulat/.test(q) ? 'what-if' : /projection|playoff odds|season sim/.test(q) ? 'projections' : /line|spread|moneyline|betting|market/.test(q) ? 'line' : /rating|power rank|pregame/.test(q) ? 'ratings' : 'win probability';
    return { md: `**${k[0].toUpperCase() + k.slice(1)}.** ${GLOSS[k]}\n\nThe full method, parameters and limits are in *How it works*.`, btn: [['Open How it works', 'method']] };
  }
  const listMD = gs => gs.map(g => '- ' + gameMD(g, true).replace(/\n\n- /, ' — ').replace(/\*\*Win chances:\*\* |\*\*Now:\*\* /, '')).join('\n');
  let lastGameId = null;               // a follow-up like "should they go for it?" refers to the last game discussed
  function intents(raw) {
    const q = norm(raw), lg = leagueIn(q); let F = findGame(raw, lg);
    if (!F.g && !F.teams.length && lastGameId && / (they|them|it|this game|that game|the game|he|she|their|still|now) /.test(q)) { const g = APP.findGame(lastGameId); if (g) F = { g, teams: [] }; }
    const r = intents2(raw, q, lg, F);
    if (r && r.game) lastGameId = r.game.id;
    return r;
  }
  function intents2(raw, q, lg, F) {
    const ref = nowRef(), all = APP.allGames().filter(g => !g.void && (!lg || g.lg === lg));
    if (has(q, [/ how (does|do|is) .*(model|probabilit|odds|rating|work)/, ' explain ', ' what is elo ', ' elo ', ' pythag', ' srs ', ' methodology ', ' how it works ', ' what does the line '])) return explain(q);
    if (has(q, [' accura', ' track record', ' how good are', ' calibrat', ' brier', ' trust ', ' reliable', ' been right'])) return APP.track ? APP.track.answer(q, lg) : { md: 'The track record is still loading.' };
    if (F.g && has(q, [' should ', ' go for it ', ' punt ', ' kick a field goal ', ' bunt ', ' steal ', ' walk him ', ' intentional ', ' take a three ', ' foul '])) {
      const d = APP.scen.decide(kindOf(F.g.lg), APP.stateFrom(F.g), { lgId: F.g.lg, sp: PM.SP[LG[F.g.lg].sp], ab: s => F.g[s].abbr }, s => APP.evaluate(F.g.lg, s, APP.expFor(F.g.lg, F.g.home.abbr, F.g.away.abbr, F.g.line, { neutral: F.g.neutral }), { n: 5000, seed: 7 }));
      if (!d) return { md: `There's no coaching decision to compare in ${F.g.away.abbr} at ${F.g.home.abbr} right now. Decisions appear for 4th downs, late last possessions, and baseball base-runner spots.`, game: F.g };
      return { md: `**${d.title}** (${F.g[d.team].name}):\n\n${d.opts.sort((a, b) => b.p - a.p).map((o, i) => `- ${i ? '' : '**'}${o.lab}: win chance ${pc(o.p)}${i ? '' : '**'}`).join('\n')}${d.note ? '\n\n' + d.note : ''}`, game: F.g };
    }
    if (F.g && has(q, [' what if ', ' what happens if ', ' what happens when ', ' if they ', ' suppose ', ' imagine ', /^ if /])) {
      const m = matchScenarios(raw, F.g);
      if (!m.length) return { md: `I couldn't match that to the ${kindOf(F.g.lg) === 'sc' ? 'soccer' : lgN(F.g.lg)} scenario library. Open the game and pick from the list — or try wording like "what if ${F.g.home.abbr} scores a touchdown" or "what if ${F.g.away.abbr} loses its best player".`, game: F.g };
      const r = whatIf(F.g, m);
      if (!r.applied.length) return { md: `That scenario isn't possible in the current game state: ${r.skipped.join('; ')}.`, game: F.g };
      const g = F.g, d = r.after.home - r.before.home;
      return { md: `**What if: ${r.applied.join(' + ').replace(/\{T\}|\{O\}/g, '')}** in ${g.away.abbr} at ${g.home.abbr}\n\n- ${g.home.abbr}: ${pc(r.before.home)} → **${pc(r.after.home)}** (${d >= 0 ? '+' : ''}${Math.round(d * 100)} points)\n- ${g.away.abbr}: ${pc(r.before.away)} → **${pc(r.after.away)}**${r.after.draw ? `\n- Draw: ${pc(r.after.draw)}` : ''}${r.branches ? '\n\nOutcomes blended by their odds:\n' + r.branches.map(b => `- ${b.outcome} (${pc(b.chance)}): ${g.home.abbr} ${pc(b.homeWin)}`).join('\n') : ''}${m[0].alt.length ? `\n\nRelated scenarios: ${m[0].alt.map(x => x.replace(/\{T\}|\{O\}/g, '…')).join(' · ')}.` : ''}`, game: g, scen: m[0] };
    }
    if (has(q, [' playoff', ' standings', ' make the ', ' title odds', ' win the league', ' relegat', ' top seed', ' table ', ' division ', ' champion'])) {
      const t = F.teams[0], L = (t && t.lg) || lg || S.lastSpecific || 'nfl';
      if (LG[L].noStandings) return { md: `${lgN(L)} has no standings table in the lab (college football uses the AP / CFP poll; the Champions League is a knockout). Try the Stats center for its history.` };
      if (t) { const f = teamFacts(t.lg, t.abbr); return { md: `**${f.team}** (${f.league}) — ${f.record || 'no record yet'}${f.powerRank ? ` · power rank ${f.powerRank}` : ''}.${f.projection ? (f.projection.playoffs != null ? `\n\n- **Make the playoffs:** ${pc(f.projection.playoffs)}\n- **Top seed:** ${pc(f.projection.topSeed)}` : `\n\n- **Win the league:** ${pc(f.projection.title)}\n- **Finish top ${LG[t.lg].top || 4}:** ${pc(f.projection.top4)}`) : ''}\n\nFrom 1,600 simulated seasons using current ratings. Change ratings or lock results in *Standings & projections*.`, btn: [['Open Standings & projections', 'standings']] }; }
      const sim = APP.simTable(L, null, 0, {}), n = LG[L].playoffN, top = LG[L].top || 4;
      const rows = (S.data[L].standings || []).map(r => ({ r, s: sim[r.key] })).filter(x => x.s).map(x => ({ ...x, v: n ? x.s.rank.slice(1, n + 1).reduce((a, b) => a + b, 0) : x.s.rank[1] })).sort((a, b) => b.v - a.v).slice(0, 8);
      return { md: `**${lgN(L)} — ${n ? 'chance to make the playoffs' : 'chance to win the league'}** (1,600 simulated seasons):\n\n| Team | Record | ${n ? 'Playoffs' : 'Title'} |\n|---|---|---|\n${rows.map(x => `| ${x.r.name} | ${x.r.w}-${x.r.l}${x.r.t ? '-' + x.r.t : ''} | ${pc(x.v)} |`).join('\n')}`, btn: [['Open Standings & projections', 'standings']] };
    }
    if (F.g && !F.teams.length && has(q, [' win ', ' odds', ' chance', ' favored', ' score', ' who '])) return { md: gameMD(F.g), game: F.g };
    if (F.g && F.teams.length) {
      if (F.teams.length === 1 && !has(q, [' win ', ' odds', ' chance', ' favored', ' favorite', ' beat ', ' predict', ' game', ' play', ' score', ' tonight', ' today', ' tomorrow', ' next '])) {
        const t = F.teams[0], f = teamFacts(t.lg, t.abbr);
        return { md: `**${f.team}** (${f.league})${f.record ? ' — ' + f.record : ''}${f.powerRank ? ` · power rank ${f.powerRank}` : ''}${f.rating ? ` · rating ${f.rating.net > 0 ? '+' : ''}${f.rating.net} ${f.rating.unit} vs an average team (${f.rating.source})` : ''}.\n\n${gameMD(F.g)}`, game: F.g };
      }
      return { md: gameMD(F.g), game: F.g };
    }
    if (F.teams.length === 2 && !F.g) {
      const [a, b] = F.teams;
      if (a.lg !== b.lg) return { md: `${a.name} and ${b.name} play in different leagues, so there's no head-to-head model. Ask about either team.` };
      const ex = APP.expFor(a.lg, a.abbr, b.abbr, null, { neutral: true }), r = APP.evaluate(a.lg, APP.fixBase(a.lg, APP.baseState(kindOf(a.lg))), ex, { n: 3000, seed: 9 });
      return { md: `They aren't scheduled in the current window, so here is a **neutral-site** projection from current ratings:\n\n- ${a.name}: **${pc(r.pH)}**\n- ${b.name}: **${pc(r.pA ?? 1 - r.pH - (r.pD || 0))}**${r.pD ? `\n- Draw: ${pc(r.pD)}` : ''}\n- Expected score: ${a.abbr} ${ex.eH.toFixed(1)} – ${ex.eA.toFixed(1)} ${b.abbr}\n\nTry any matchup in the *Hypothesis lab*.`, btn: [['Open the Hypothesis lab', 'lab']] };
    }
    if (F.teams.length === 1 && !F.g) { const t = F.teams[0], f = teamFacts(t.lg, t.abbr); return { md: `**${f.team}** (${f.league})${f.record ? ' — ' + f.record : ''}${f.powerRank ? ` · power rank ${f.powerRank}` : ''}. No game in the current window.` }; }
    if (has(q, [' upset', ' underdog', ' long shot', ' longshot', ' surprise'])) {
      const live = all.filter(g => g.state === 'in').map(g => ({ g, P: APP.predict(g) })).filter(x => x.P.pre.pH < 0.4 && x.P.now.pH > 0.5 || (x.P.pre.pA ?? 1) < 0.4 && (x.P.now.pA ?? 0) > 0.5);
      const dogs = all.filter(g => g.state === 'pre' && +new Date(g.start) - ref < 36 * 3600e3).map(g => ({ g, P: APP.predict(g) })).filter(x => x.P.src !== 'none').map(x => ({ ...x, d: Math.min(x.P.pre.pH, x.P.pre.pA ?? 1 - x.P.pre.pH) })).sort((a, b) => a.d - b.d).slice(0, 4);
      const fin = all.filter(g => g.state === 'post' && ref - +new Date(g.start) < 48 * 3600e3).map(g => { const P = APP.predict(g), w = g.home.winner ? 'home' : g.away.winner ? 'away' : null; return w && P.src !== 'none' ? { g, w, p: w === 'home' ? P.pre.pH : (P.pre.pA ?? 1 - P.pre.pH) } : null; }).filter(Boolean).sort((a, b) => a.p - b.p).slice(0, 3);
      return { md: (live.length ? `**Upsets in progress:**\n${listMD(live.map(x => x.g))}\n\n` : '') + (fin.length ? `**Biggest recent upsets:**\n${fin.map(x => `- ${x.g[x.w].name} won with a ${pc(x.p)} pregame chance (${x.g.away.abbr} ${x.g.away.score}–${x.g.home.score} ${x.g.home.abbr})`).join('\n')}\n\n` : '') + (dogs.length ? `**Biggest underdogs coming up:**\n${dogs.map(x => { const s = x.P.pre.pH < (x.P.pre.pA ?? 1 - x.P.pre.pH) ? 'home' : 'away'; return `- ${x.g[s].name} ${pc(x.d)} vs ${x.g[s === 'home' ? 'away' : 'home'].name} (${APP.when(x.g.start)})`; }).join('\n')}` : 'No big underdogs in the next 36 hours.') };
    }
    if (has(q, [' live', ' right now', ' in progress', ' scores', ' score ', ' on now', ' happening'])) {
      const live = all.filter(g => g.state === 'in');
      if (!live.length) { const nx = all.filter(g => g.state === 'pre').sort((a, b) => new Date(a.start) - new Date(b.start))[0]; return { md: `No ${lg ? lgN(lg) + ' ' : ''}games are live right now.${nx ? ` Next up: ${gameMD(nx, true)}` : ''}`, game: nx || null }; }
      const ord = live.map(g => ({ g, P: APP.predict(g) })).sort((a, b) => Math.abs(a.P.now.pH - 0.5) - Math.abs(b.P.now.pH - 0.5)).map(x => x.g).slice(0, 10);
      return { md: `**${live.length} game${live.length === 1 ? '' : 's'} live**${lg ? ' in ' + lgN(lg) : ''}, closest first:\n\n${listMD(ord)}` };
    }
    if (has(q, [' tonight', ' today', ' tomorrow', ' this weekend', ' upcoming', ' schedule', ' next ', ' slate', ' who plays', ' games '])) {
      const h = / tomorrow /.test(q) ? [12, 48] : / weekend /.test(q) ? [0, 120] : [-1, 30];
      const up = all.filter(g => g.state === 'pre' && +new Date(g.start) - ref >= h[0] * 3600e3 && +new Date(g.start) - ref <= h[1] * 3600e3);
      const best = (APP.featuredList ? APP.featuredList(up) : up).slice(0, 8);
      if (!best.length) return { md: `No ${lg ? lgN(lg) + ' ' : ''}games on that slate in the lab's window.` };
      return { md: `**${up.length} ${lg ? lgN(lg) + ' ' : ''}game${up.length === 1 ? '' : 's'} coming up** — the top-ranked matchups:\n\n${listMD(best)}` };
    }
    if (has(q, [' tennis', ' golf', ' ufc', ' pga', ' atp', ' wta', ' fight'])) {
      const t = S.extras || {};
      const parts = [];
      if (/tennis|atp|wta/.test(q) && t.tennis) parts.push('**Tennis:** ' + t.tennis.slice(0, 5).map(m => `${m.a} vs ${m.b}${m.sa && m.sa.length ? ' (' + m.sa.map((x, i) => x + '-' + (m.sb[i] ?? '')).join(' ') + ')' : ''}`).join('; '));
      if (/golf|pga/.test(q) && t.golf) parts.push(`**Golf — ${t.golf.name}:** ` + (t.golf.players || []).slice(0, 5).map((p, i) => `${i + 1}. ${p.name} ${p.toPar > 0 ? '+' : ''}${p.toPar}${t.golf.win ? ' (' + pc(t.golf.win[i] && t.golf.win[i].p) + ' to win)' : ''}`).join('; '));
      if (/ufc|fight/.test(q) && t.ufc) { const c = t.ufc.next || t.ufc.last; parts.push(`**UFC — ${c.name}:** ` + c.fights.slice(0, 4).map(f => `${f[0]} vs ${f[1]}${f[3] ? ' — ' + f[3] : ''}`).join('; ')); }
      return { md: parts.length ? parts.join('\n\n') : 'Nothing loaded for that sport right now.' };
    }
    return null;
  }
  function suggestions() {
    const out = [], live = APP.allGames().filter(g => g.state === 'in'), pre = APP.allGames().filter(g => g.state === 'pre');
    const f = (APP.featuredList ? APP.featuredList(live.concat(pre)) : live.concat(pre))[0];
    if (live.length) out.push('Which live games are closest right now?');
    if (f) out.push(`Who will win ${f.away.abbr} at ${f.home.abbr}?`);
    if (f) { const k = kindOf(f.lg); out.push(k === 'fb' ? `What if ${f.home.abbr} loses its QB?` : k === 'bk' ? `What if ${f.away.abbr}'s superstar sits?` : k === 'sc' ? `What if ${f.home.abbr} gets a red card?` : `What if ${f.home.abbr} scores next?`); }
    out.push('Any upsets brewing?', 'Who makes the NFL playoffs?', 'How accurate is the model?', 'How does live win probability work?');
    return out.slice(0, 6);
  }
  const btns = r => {
    const b = [];
    if (r.game) b.push(`<button type="button" class="btn sm pri" data-game="${esc(r.game.id)}"${r.scen ? ` data-q="${esc(r.scen.id + (r.scen.side ? ':' + r.scen.side : ''))}"` : ''}>${r.scen ? 'Try it in the game center' : 'Open the game center'}</button>`);
    for (const [lab, tab] of r.btn || []) b.push(`<button type="button" class="btn sm" data-tabgo="${esc(tab)}">${esc(lab)}</button>`);
    return b.length ? `<div class="pill-row chat-acts">${b.join('')}</div>` : '';
  };
  function answer(raw) {
    const r = intents(raw);
    if (!r) return { html: `<p>I can answer from this page's live data: <b>who's favored</b> in any game, <b>what-ifs</b> ("what if Seattle loses its QB?"), <b>coaching decisions</b> ("should they go for it?"), <b>playoff odds</b>, <b>upsets</b>, <b>live scores</b> and <b>how the models work</b>. Name a team or a league to get started.</p>`, follow: suggestions() };
    return { html: window.CH.md(r.md) + btns(r), follow: suggestions().filter(s => s !== raw).slice(0, 3) };
  }

  /* ---------------- tools for Claude ---------------- */
  const gameById = id => APP.findGame(String(id || '')) || null;
  const needGame = i => { const g = gameById(i.game_id) || (i.teams ? findGame(i.teams).g : null); if (!g) throw new Error('No game found. Use get_board or find_game first.'); return g; };
  function tools() {
    return [
      { name: 'get_board', description: 'List games on the board (live, upcoming, final) with win probabilities. Filter by league id (nfl, ncaaf, mlb, nba, wnba, nhl, epl, laliga, seriea, bund, ligue1, mls, ucl) and state.', inputSchema: { type: 'object', properties: { league: { type: 'string' }, state: { type: 'string', enum: ['live', 'upcoming', 'final', 'all'] }, limit: { type: 'number' } } },
        execute: i => { const st = { live: 'in', upcoming: 'pre', final: 'post' }[i.state]; let gs = APP.allGames().filter(g => !g.void && (!i.league || g.lg === i.league) && (!st || g.state === st)); gs = (APP.featuredList ? APP.featuredList(gs).concat(gs.filter(g => !APP.featuredList(gs).includes(g))) : gs).slice(0, Math.min(40, i.limit || 25)); return { mode: S.mode, capturedAt: S.mode === 'snapshot' ? S.capturedAt : undefined, count: gs.length, games: gs.map(g => { const f = gameFacts(g); return { id: f.id, league: f.league, away: f.away, home: f.home, state: f.state, start: f.start, status: f.status, score: f.score, pregameHome: f.pregame.home, nowHome: f.now ? f.now.home : undefined, draw: (f.now || f.pregame).draw }; }) }; } },
      { name: 'find_game', description: 'Find the current, next or last game for one or two teams named in plain words ("Seahawks", "Chiefs vs Broncos", "Real Madrid").', inputSchema: { type: 'object', properties: { teams: { type: 'string' }, league: { type: 'string' } }, required: ['teams'] }, execute: i => { const r = findGame(i.teams, i.league); return r.g ? gameFacts(r.g) : { found: false, teams: r.teams.map(t => t.name + ' (' + lgN(t.lg) + ')') }; } },
      { name: 'get_game', description: 'Full detail for one game: status, score, pregame and live win probabilities, expected score, betting line, model source, recent win-probability history and the live situation.', inputSchema: { type: 'object', properties: { game_id: { type: 'string' } }, required: ['game_id'] }, execute: i => gameFacts(needGame(i)) },
      { name: 'list_scenarios', description: 'The what-if scenarios available for a game\'s sport (id, label, type). {T} is the team the scenario is about.', inputSchema: { type: 'object', properties: { game_id: { type: 'string' }, category: { type: 'string' } }, required: ['game_id'] }, execute: i => { const g = needGame(i); return APP.scen.list(kindOf(g.lg)).filter(x => !i.category || x.cat === i.category).map(x => ({ id: x.id, label: x.lab, type: x.type, category: x.cat, perTeam: !!x.per })); } },
      { name: 'run_what_if', description: 'Re-run the win-probability model for a game after scenarios (events, conditions, chance plays). Each scenario: {id from list_scenarios, team: "home" | "away" | team abbreviation}.', inputSchema: { type: 'object', properties: { game_id: { type: 'string' }, scenarios: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, team: { type: 'string' } }, required: ['id'] } } }, required: ['game_id', 'scenarios'] }, execute: i => { const g = needGame(i); return Object.assign({ game: g.away.abbr + ' at ' + g.home.abbr }, whatIf(g, (i.scenarios || []).map(s => ({ id: s.id, side: s.team })))); } },
      { name: 'coach_decision', description: 'Compare a coach\'s options in the current live state (4th down, last possession, steal/bunt/walk) by win probability.', inputSchema: { type: 'object', properties: { game_id: { type: 'string' } }, required: ['game_id'] }, execute: i => { const g = needGame(i); const d = APP.scen.decide(kindOf(g.lg), APP.stateFrom(g), { lgId: g.lg, sp: PM.SP[LG[g.lg].sp], ab: s => g[s].abbr }, s => APP.evaluate(g.lg, s, APP.expFor(g.lg, g.home.abbr, g.away.abbr, g.line, { neutral: g.neutral }), { n: 5000, seed: 7 })); return d ? { title: d.title, team: g[d.team].name, options: d.opts.map(o => ({ option: o.lab, winChance: +o.p.toFixed(3) })), note: d.note } : { none: 'No decision point in the current state.' }; } },
      { name: 'get_team', description: 'A team\'s record, rating, power rank, season projection and current/next game.', inputSchema: { type: 'object', properties: { team: { type: 'string' }, league: { type: 'string' } }, required: ['team'] }, execute: i => { const t = teamsIn(i.team, i.league)[0]; if (!t) throw new Error('Team not found in the loaded leagues.'); return teamFacts(t.lg, t.abbr); } },
      { name: 'get_standings', description: 'A league table with records and simulated season odds (playoffs and top seed, or title and top four in soccer).', inputSchema: { type: 'object', properties: { league: { type: 'string' }, top: { type: 'number' } }, required: ['league'] }, execute: i => { const L = i.league; if (!LG[L] || LG[L].noStandings) throw new Error('No standings for that league.'); const sim = APP.simTable(L, null, 0, {}), n = LG[L].playoffN; return (S.data[L].standings || []).map(r => { const s = sim[r.key]; return { team: r.name, group: r.group, record: r.w + '-' + r.l + (r.t ? '-' + r.t : ''), points: r.pts, playoffs: s && n ? +s.rank.slice(1, n + 1).reduce((a, b) => a + b, 0).toFixed(3) : undefined, title: s && !n ? +s.rank[1].toFixed(3) : undefined }; }).sort((a, b) => (b.playoffs ?? b.title ?? 0) - (a.playoffs ?? a.title ?? 0)).slice(0, Math.min(40, i.top || 20)); } },
      { name: 'get_track_record', description: 'How well the lab\'s pregame and in-game probabilities have matched results (accuracy, Brier score, calibration), overall or for one league.', inputSchema: { type: 'object', properties: { league: { type: 'string' } } }, execute: i => APP.track ? APP.track.facts(i.league) : { unavailable: true } },
      { name: 'explain_method', description: 'Plain-language explanation of a method: win probability, ratings, elo, pythagorean, srs, what-if, projections, line.', inputSchema: { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'] }, execute: i => GLOSS[String(i.topic || '').toLowerCase()] || GLOSS['win probability'] },
      { name: 'open_view', description: 'Navigate the page for the user: open a game\'s game center (game_id) or a tab (board, stats, lab, standings, method).', inputSchema: { type: 'object', properties: { game_id: { type: 'string' }, tab: { type: 'string' } } }, execute: i => { if (i.game_id) { APP.openGame(i.game_id); return 'Opened the game center.'; } if (i.tab) { APP.setTab(i.tab); return 'Opened ' + i.tab + '.'; } return 'Nothing to open.'; } }
    ];
  }
  function system() {
    const live = APP.allGames().filter(g => g.state === 'in').length;
    return `You are Ask AI, the analyst built into "Probable Sports Lab", a live multi-sport analytics site by Bruno Silva covering 13 team leagues plus tennis, golf and UFC. Today is ${new Date(nowRef()).toDateString()}; data mode: ${S.mode}${S.mode === 'snapshot' ? ' (a real-data snapshot captured ' + S.capturedAt + ', not live)' : ' (ESPN live feed)'}; ${live} games live.
Answer questions about games, teams, win probabilities, what-if scenarios, coaching decisions, standings odds and the models. Always use the tools for numbers; never invent scores, odds or records. Say whether a number is pregame or live, and when the model and the betting line differ, say so and why it might (ratings vs market). Mention uncertainty plainly — a 70% favorite loses about 3 times in 10. Keep answers short (under 180 words), lead with the answer, use bullets for lists. Offer to open the game center or a tab when useful (open_view). This is analysis, not betting advice; don't recommend wagers.`;
  }
  function welcome() {
    const live = APP.allGames().filter(g => g.state === 'in').length;
    return `<p><b>Ask AI about any game, team or what-if.</b> I read the same live board, ratings and models as this page${live ? ` — ${live} game${live === 1 ? ' is' : 's are'} live right now` : ''}.</p>`;
  }
  const adapter = { title: 'Ask AI', placeholder: 'Ask about a game, a team, a what-if, playoff odds…', footer: 'Answers come from this page\'s live data and models. Analysis, not betting advice.', snapshot: !!window.SPORTS_ARTIFACT, welcome, suggestions, answer, tools, system };
  let started = false;
  APP.onRender.push(() => {
    if (!window.CH) return;
    if (!started) { started = true; window.CH.init(adapter, S); }
    else window.CH.context(S);
  });
  document.addEventListener('click', e => { const b = e.target.closest('[data-tabgo]'); if (b) { APP.setTab(b.dataset.tabgo); if (window.matchMedia('(max-width:900px)').matches && window.CH) window.CH.close(); } });
  APP.ask = { findGame, teamsIn, gameFacts, teamFacts, whatIf, matchScenarios, intents, tools };
})();
