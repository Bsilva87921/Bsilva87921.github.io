/* ==========================================================================
   Probable — scenario library for the what-if simulator.
   Three kinds of scenario:
     event  — changes the game state once (a touchdown, a double play, a red card)
     cond   — a condition that stays on until removed (snow, a QB injury, a
              back-to-back, a parked bus); conditions stack
     chance — an uncertain event (a field-goal try, a penalty kick, a steal
              attempt): every outcome is simulated and blended by its odds
   plus decision helpers that compare the options a coach actually has.
   ========================================================================== */
(function () {
  'use strict';
  const PM = window.PM, APP = window.APP, clamp = PM.math.clamp;
  const SC = APP.scen = {};
  const other = s => s === 'home' ? 'away' : 'home';
  const add = (st, T, n) => { if (T === 'home') st.hs += n; else st.as += n; };
  const score = (st, T) => T === 'home' ? st.hs : st.as;
  const interp = (tab, x) => { if (x <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1][1]; };

  SC.CATS = [['pop', 'Popular'], ['score', 'Scoring'], ['sit', 'Situation'], ['chance', 'Chance & decisions'], ['pers', 'Personnel'], ['env', 'Weather & venue'], ['rest', 'Rest & travel'], ['strat', 'Strategy']];

  /* ---------------- football helpers ---------------- */
  const CONV = [[1, 0.7], [2, 0.6], [3, 0.54], [4, 0.49], [5, 0.45], [6, 0.41], [7, 0.38], [8, 0.34], [10, 0.3], [12, 0.25], [15, 0.2], [20, 0.13], [30, 0.07]];
  SC.fgP = (yl, lgId) => PM.fgMake(yl, lgId === 'ncaaf');
  SC.convP = (st) => clamp(interp(CONV, st.dist || 10) * (st.yl + (st.dist || 10) >= 100 ? 0.93 : 1), 0.03, 0.8);
  const kickYl = c => c.lgId === 'nfl' ? 30 : 25;
  const fb = {
    kick(st, recv, c) { st.poss = recv; st.yl = kickYl(c); st.down = 1; st.dist = 10; },
    first(st, yl) { st.yl = clamp(Math.round(yl), 1, 99); st.down = 1; st.dist = Math.min(10, 100 - st.yl); },
    turn(st, newPoss, ylForNew) { st.poss = newPoss; fb.first(st, ylForNew); },
    run(st, sec, sp) { let s = sec; while (s > 0) { if (st.clock >= s) { st.clock -= s; s = 0; } else { s -= st.clock; if (st.period < sp.periods) { st.period++; st.clock = sp.perLen; } else { st.clock = 0; s = 0; } } } },
    punt(st, T) { const land = st.yl + 41; fb.turn(st, other(T), land >= 100 ? 20 : Math.max(10, 100 - land)); }
  };
  const ylTxt = yl => yl < 50 ? 'own ' + yl : yl === 50 ? 'midfield' : 'opp ' + (100 - yl);
  SC.ylTxt = ylTxt;
  const needBall = (st, T) => st.poss === T || 'needs {T} to have the ball';

  /* ---------------- basketball helpers ---------------- */
  const bkShot = (st, sec) => { st.clock = st.clock > 30 ? st.clock - sec : Math.min(st.clock, 2); };
  const ftBranches = (n, p, T, after) => { const out = []; const C = (k) => { let c = 1; for (let i = 1; i <= k; i++) c = c * (n - k + i) / i; return c; }; for (let k = n; k >= 0; k--) out.push({ p: C(k) * Math.pow(p, k) * Math.pow(1 - p, n - k), lab: `${k} of ${n}`, ev: st => { add(st, T, k); after(st); } }); return out; };

  /* ---------------- baseball helpers ---------------- */
  const batting = st => st.half === 'top' ? 'away' : 'home';
  const endHalf = st => { if (st.outs >= 3) { st.outs = 0; st.b1 = st.b2 = st.b3 = 0; if (st.half === 'top') st.half = 'bot'; else { st.half = 'top'; st.inning = Math.min(15, st.inning + 1); if (st.inning >= 10) st.b2 = 1; } } };
  const outs = (st, n) => { st.outs += n; endHalf(st); };
  const walk = st => { const T = batting(st); if (st.b1 && st.b2 && st.b3) add(st, T, 1); else if (st.b1 && st.b2) st.b3 = 1; else if (st.b1) st.b2 = 1; st.b1 = 1; };
  const adv1 = st => { const T = batting(st); add(st, T, st.b3); st.b3 = st.b2; st.b2 = st.b1; st.b1 = 0; };

  /* ---------------- the library ---------------- */
  // fields: id, cat, lab ({T} acting team, {O} opponent), tip, type (event|cond|chance), per (team|bat|null),
  // ev(st, T, c) for events; eff {adj, pace, hfa, vol, mulT, mulO, neutral} for conditions; br(st, T, c) for chance;
  // avail(st, T, c) → true or a reason string
  const E = (id, cat, lab, tip, ev, x) => Object.assign({ id, cat, lab, tip, type: 'event', per: 'team', ev }, x || {});
  const G = (id, cat, lab, tip, ev, x) => Object.assign({ id, cat, lab, tip, type: 'event', per: null, ev }, x || {});
  const K = (id, cat, lab, tip, eff, x) => Object.assign({ id, cat, lab, tip, type: 'cond', per: 'team', eff }, x || {});
  const KG = (id, cat, lab, tip, eff, x) => Object.assign({ id, cat, lab, tip, type: 'cond', per: null, eff }, x || {});
  const R = (id, cat, lab, tip, br, x) => Object.assign({ id, cat, lab, tip, type: 'chance', per: 'team', br }, x || {});

  const LIB = {};
  LIB.fb = [
    E('td', 'score', '{T} touchdown', 'Touchdown and extra point (+7); {O} receives the kickoff', (st, T, c) => { add(st, T, 7); fb.kick(st, other(T), c); }),
    E('td6', 'score', '{T} TD, missed PAT', 'Touchdown, extra point missed (+6)', (st, T, c) => { add(st, T, 6); fb.kick(st, other(T), c); }),
    E('td8', 'score', '{T} TD + two-point try good', 'Touchdown and a successful two-point conversion (+8)', (st, T, c) => { add(st, T, 8); fb.kick(st, other(T), c); }),
    E('fg3', 'score', '{T} field goal', 'Field goal (+3); {O} receives the kickoff', (st, T, c) => { add(st, T, 3); fb.kick(st, other(T), c); }),
    E('saf', 'score', '{T} defense: safety', 'Safety (+2); {T} then receives the free kick around its own 40', (st, T) => { add(st, T, 2); fb.turn(st, T, 40); }),
    E('p6', 'score', '{T} pick-six', 'Interception returned for a touchdown (+7)', (st, T, c) => { add(st, T, 7); fb.kick(st, other(T), c); }),
    E('rtd', 'score', '{T} return touchdown', 'Kickoff or punt returned for a touchdown (+7)', (st, T, c) => { add(st, T, 7); fb.kick(st, other(T), c); }),
    E('drive', 'score', '{T} 8-minute TD drive', 'Touchdown (+7) on a drive that burns 8:00', (st, T, c) => { add(st, T, 7); fb.run(st, 480, c.sp); fb.kick(st, other(T), c); }),
    E('take', 'sit', '{T} takeaway', 'Interception or fumble recovery: {T} takes over where {O} had the ball', (st, T) => { if (st.poss === other(T)) fb.turn(st, T, 100 - st.yl); else fb.turn(st, T, 50); }, { avail: (st, T) => st.poss !== T || '{T} already has the ball' }),
    E('rz', 'sit', '{T} in the red zone', '1st & 10 at the opponent 15', (st, T) => { st.poss = T; fb.first(st, 85); }),
    E('gl', 'sit', '{T} 1st & goal at the 3', 'Goal to go from the 3-yard line', (st, T) => { st.poss = T; st.yl = 97; st.down = 1; st.dist = 3; }),
    E('mid', 'sit', '{T} ball at midfield', '1st & 10 at the 50', (st, T) => { st.poss = T; fb.first(st, 50); }),
    E('own5', 'sit', '{T} backed up at its own 5', '1st & 10 at its own 5', (st, T) => { st.poss = T; fb.first(st, 5); }),
    E('bomb', 'sit', '{T} 45-yard completion', 'A 45-yard gain (touchdown if it reaches the end zone)', (st, T, c) => { const y = st.yl + 45; if (y >= 100) { add(st, T, 7); fb.kick(st, other(T), c); } else fb.first(st, y); }, { avail: needBall }),
    E('sack', 'sit', '{T} QB sacked', 'Loss of 8 yards and a down', st => { st.yl = Math.max(1, st.yl - 8); st.dist = Math.min(40, (st.dist || 10) + 8); st.down = Math.min(4, (st.down || 1) + 1); }, { avail: needBall }),
    E('pen', 'sit', '15-yard penalty on {O}', 'Personal foul: +15 yards and a first down for {T}', st => fb.first(st, st.yl + 15), { avail: needBall }),
    E('hold', 'sit', 'Holding on {T}', '10-yard penalty, replay the down', st => { st.yl = Math.max(1, st.yl - 10); st.dist = Math.min(40, (st.dist || 10) + 10); }, { avail: needBall }),
    E('3out', 'sit', '{T} three-and-out, punts', 'Punt nets 41 yards', (st, T) => fb.punt(st, T), { avail: needBall }),
    E('4th1', 'sit', '{T} 4th & 1 at midfield', 'Sets up the 4th-down decision', (st, T) => { st.poss = T; st.yl = 50; st.down = 4; st.dist = 1; }),
    E('4th6', 'sit', '{T} 4th & 6 at the opp 32', 'Field-goal range or go for it?', (st, T) => { st.poss = T; st.yl = 68; st.down = 4; st.dist = 6; }),
    G('2min', 'sit', 'Two-minute warning (Q4)', 'Jump to 2:00 left in the 4th quarter', st => { st.period = 4; st.clock = 120; }),
    G('half', 'sit', 'Halftime', 'Jump to the start of the 3rd quarter', (st, _, c) => { st.period = 3; st.clock = c.sp.perLen; st.poss = null; }),
    G('q4', 'sit', 'Start of the 4th quarter', '15:00 left', (st, _, c) => { st.period = 4; st.clock = c.sp.perLen; }),
    G('last', 'sit', 'Final play (0:05 left)', '5 seconds left in regulation', st => { st.period = 4; st.clock = 5; }),
    G('ot', 'sit', 'Overtime', 'Start of overtime', (st, _, c) => { st.period = 5; st.clock = c.sp.otLen || 600; st.poss = null; }),
    R('fga', 'chance', '{T} field-goal try', 'Kick from here: make odds by distance; a miss gives {O} the ball at the spot', (st, T, c) => { const p = SC.fgP(st.yl, c.lgId); return [{ p, lab: `Good (${Math.round(p * 100)}%)`, ev: s => { add(s, T, 3); fb.kick(s, other(T), c); } }, { p: 1 - p, lab: 'Missed', ev: s => fb.turn(s, other(T), Math.max(20, 107 - s.yl)) }]; }, { avail: (st, T) => st.poss !== T ? needBall(st, T) : st.yl < 42 ? 'out of field-goal range' : true, dyn: (st, c) => `${(100 - st.yl) + 17} yds` }),
    R('go4', 'chance', '{T} goes for it on 4th down', 'Conversion odds by yards to go; a failure hands {O} the ball at the spot', (st, T, c) => { const p = SC.convP(st); return [{ p, lab: `Converted (${Math.round(p * 100)}%)`, ev: s => { const y = s.yl + (s.dist || 10) + 2; if (y >= 100) { add(s, T, 7); fb.kick(s, other(T), c); } else fb.first(s, y); } }, { p: 1 - p, lab: 'Stopped', ev: s => fb.turn(s, other(T), Math.max(1, 100 - (s.yl + 1))) }]; }, { avail: needBall }),
    E('punt', 'chance', '{T} punts', 'Net 41 yards; a touchback puts {O} at its 20', (st, T) => fb.punt(st, T), { avail: needBall }),
    R('two', 'chance', '{T} TD, then goes for two', 'Touchdown, then a two-point try (48%)', (st, T, c) => [{ p: 0.48, lab: 'Two-pointer good (48%)', ev: s => { add(s, T, 8); fb.kick(s, other(T), c); } }, { p: 0.52, lab: 'No good', ev: s => { add(s, T, 6); fb.kick(s, other(T), c); } }]),
    R('xp', 'chance', '{T} TD, then kicks the PAT', 'Touchdown, then an extra point (94%)', (st, T, c) => [{ p: 0.94, lab: 'PAT good (94%)', ev: s => { add(s, T, 7); fb.kick(s, other(T), c); } }, { p: 0.06, lab: 'PAT missed', ev: s => { add(s, T, 6); fb.kick(s, other(T), c); } }]),
    R('onside', 'chance', '{T} onside kick', 'Recovered about 12% of the time; otherwise {O} takes over near midfield', (st, T) => [{ p: 0.12, lab: 'Recovered (12%)', ev: s => fb.turn(s, T, 45) }, { p: 0.88, lab: 'Not recovered', ev: s => fb.turn(s, other(T), 55) }]),
    R('hail', 'chance', '{T} Hail Mary', 'A desperation heave into the end zone (about 5%)', (st, T, c) => [{ p: 0.05, lab: 'Caught for a TD (5%)', ev: s => { add(s, T, 7); fb.kick(s, other(T), c); } }, { p: 0.95, lab: 'Incomplete / picked', ev: s => { s.clock = Math.max(0, s.clock - 8); fb.turn(s, other(T), 20); } }], { avail: (st, T) => st.poss !== T ? needBall(st, T) : st.yl < 40 ? 'too far from the end zone' : true }),
    K('qb', 'pers', '{T} QB1 out, backup starts', 'Starting quarterback unavailable (about −6.5 pts)', { adj: -6.5 }),
    K('qbret', 'pers', '{T} star QB returns', 'Franchise quarterback back from injury (+3 pts)', { adj: 3 }),
    K('wr1', 'pers', '{T} WR1 out', 'Top receiver unavailable (−1.3 pts)', { adj: -1.3 }),
    K('rb1', 'pers', '{T} RB1 out', 'Lead running back unavailable (−0.7 pts)', { adj: -0.7 }),
    K('ol', 'pers', '{T} two O-line starters out', 'Offensive line depleted (−1.5 pts)', { adj: -1.5 }),
    K('edge', 'pers', '{T} top pass rusher out', 'Best edge rusher unavailable (−1.1 pts)', { adj: -1.1 }),
    K('cb1', 'pers', '{T} top cornerback out', 'Best cover corner unavailable (−1.2 pts)', { adj: -1.2 }),
    K('kick', 'pers', '{T} kicker injured', 'Punter handling kicks (−1.0 pts)', { adj: -1 }),
    KG('rain', 'env', 'Heavy rain', 'Slick ball, fewer points (scoring ×0.92)', { pace: 0.92 }),
    KG('snow', 'env', 'Snow game', 'Scoring ×0.85', { pace: 0.85 }),
    KG('wind', 'env', 'Wind 20+ mph', 'Passing and kicking suffer: scoring ×0.90, more randomness', { pace: 0.9, vol: 1.05 }),
    KG('cold', 'env', 'Frigid cold (below 10°F)', 'Scoring ×0.93, home edge ×1.2', { pace: 0.93, hfa: 1.2 }),
    KG('dome', 'env', 'Dome / fast track', 'Scoring ×1.05', { pace: 1.05 }),
    KG('alt', 'env', 'Altitude (Mile High)', 'Home edge ×1.5', { hfa: 1.5 }),
    KG('loud', 'env', 'Hostile primetime crowd', 'Home edge ×1.4', { hfa: 1.4 }),
    KG('empty', 'env', 'Empty stadium', 'Home edge ×0.25', { hfa: 0.25 }),
    KG('neut', 'env', 'Neutral site (international game)', 'No home edge', { neutral: true }),
    K('bye', 'rest', '{T} off a bye week', 'Extra week of rest and prep (+1.2 pts)', { adj: 1.2 }),
    K('short', 'rest', '{T} on a short week', 'Thursday game after a Sunday game (−0.9 pts)', { adj: -0.9 }),
    K('west', 'rest', '{T} west-coast team, 1 pm ET kick', 'Body-clock disadvantage (−0.9 pts)', { adj: -0.9 }),
    K('tz', 'rest', '{T} cross-country travel', 'Long trip (−0.6 pts)', { adj: -0.6 }),
    K('flu', 'rest', '{T} illness in the locker room', 'Several players under the weather (−1.5 pts)', { adj: -1.5 }),
    K('agg', 'strat', '{T} aggressive on 4th downs', 'Goes for it more often: small edge, more variance', { adj: 0.4, vol: 1.05 }),
    K('cons', 'strat', '{T} conservative, runs the clock', 'Shorter game, slightly worse expected margin', { adj: -0.3, pace: 0.95 }),
    K('trick', 'strat', '{T} trick-play game plan', 'Small edge, more variance', { adj: 0.2, vol: 1.05 }),
    KG('hurry', 'strat', 'Both teams in hurry-up', 'More plays: scoring ×1.10', { pace: 1.1 }),
    KG('ground', 'strat', 'Ground-and-pound on both sides', 'Fewer possessions: scoring ×0.90', { pace: 0.9 }),
    KG('chaos', 'strat', 'Underdog goes high-variance', 'Onside kicks, 4th downs, deep shots: spread ×1.15', { vol: 1.15 })
  ];
  LIB.bk = [
    E('p3', 'score', '{T} hits a three', '+3; {O} ball', (st, T) => { add(st, T, 3); st.poss = other(T); }),
    E('p2', 'score', '{T} scores inside', '+2; {O} ball', (st, T) => { add(st, T, 2); st.poss = other(T); }),
    E('and1', 'score', '{T} and-one', '+3; {O} ball', (st, T) => { add(st, T, 3); st.poss = other(T); }),
    E('p4', 'score', '{T} four-point play', '+4; {O} ball', (st, T) => { add(st, T, 4); st.poss = other(T); }),
    E('r8', 'score', '{T} 8–0 run', '+8 unanswered', (st, T) => add(st, T, 8)),
    E('r12', 'score', '{T} 12–0 run', '+12 unanswered', (st, T) => add(st, T, 12)),
    E('r20', 'score', '{T} 20–5 run', '{T} +20, {O} +5', (st, T) => { add(st, T, 20); add(st, other(T), 5); }),
    E('tft', 'score', '{T} technical free throw', '+1, possession unchanged', (st, T) => add(st, T, 1)),
    E('stl', 'sit', '{T} steal and dunk', '+2 on the break; {O} ball', (st, T) => { add(st, T, 2); st.poss = other(T); }),
    E('tov', 'sit', '{T} turnover', '{O} takes possession', (st, T) => { st.poss = other(T); }),
    E('orb', 'sit', '{T} offensive rebound', '{T} keeps the ball', (st, T) => { st.poss = T; }),
    E('last', 'sit', '{T} ball, 24 seconds left', 'Final possession in the 4th quarter', (st, T) => { st.period = 4; st.clock = 24; st.poss = T; }),
    G('q3end', 'sit', 'End of the 3rd quarter', 'Start of the 4th', (st, _, c) => { st.period = 4; st.clock = c.sp.perLen; }),
    G('half', 'sit', 'Halftime', 'Start of the 3rd quarter', (st, _, c) => { st.period = 3; st.clock = c.sp.perLen; }),
    G('clutch', 'sit', 'Clutch time (5:00 left)', '5:00 left in the 4th', st => { st.period = 4; st.clock = 300; }),
    G('two', 'sit', '2:00 left', '2:00 left in the 4th', st => { st.period = 4; st.clock = 120; }),
    G('m30', 'sit', '30 seconds left', '0:30 left in the 4th', st => { st.period = 4; st.clock = 30; }),
    G('ot', 'sit', 'Overtime', 'Start of overtime', (st, _, c) => { st.period = 5; st.clock = c.sp.otLen || 300; st.poss = null; }),
    R('ft2', 'chance', '{T} two free throws', 'Each at 78%; {O} ball afterwards', (st, T) => ftBranches(2, 0.78, T, s => { s.poss = other(T); })),
    R('ft3', 'chance', '{T} three free throws', 'Fouled on a three: each at 78%', (st, T) => ftBranches(3, 0.78, T, s => { s.poss = other(T); })),
    R('s3', 'chance', '{T} takes a three', 'Made 36%; a miss is rebounded by {T} 27% of the time', (st, T) => [{ p: 0.36, lab: 'Made (36%)', ev: s => { add(s, T, 3); bkShot(s, 14); s.poss = other(T); } }, { p: 0.64 * 0.27, lab: 'Missed, {T} rebound', ev: s => { bkShot(s, 14); s.poss = T; } }, { p: 0.64 * 0.73, lab: 'Missed, {O} rebound', ev: s => { bkShot(s, 14); s.poss = other(T); } }]),
    R('s2', 'chance', '{T} attacks the rim', 'Made 52%; misses rebounded by {T} 27% of the time', (st, T) => [{ p: 0.52, lab: 'Made (52%)', ev: s => { add(s, T, 2); bkShot(s, 12); s.poss = other(T); } }, { p: 0.48 * 0.27, lab: 'Missed, {T} rebound', ev: s => { bkShot(s, 12); s.poss = T; } }, { p: 0.48 * 0.73, lab: 'Missed, {O} rebound', ev: s => { bkShot(s, 12); s.poss = other(T); } }]),
    R('heave', 'chance', '{T} half-court heave', 'At the buzzer, about 4%', (st, T) => [{ p: 0.04, lab: 'Banked in (4%)', ev: s => { add(s, T, 3); s.clock = 0; } }, { p: 0.96, lab: 'No good', ev: s => { s.clock = 0; } }]),
    R('flag', 'chance', 'Flagrant foul on {O}', '{T} shoots two (78%) and keeps the ball', (st, T) => ftBranches(2, 0.78, T, s => { s.poss = T; })),
    R('jump', 'chance', 'Jump ball', 'A 50/50 tip', (st, T) => [{ p: 0.5, lab: '{T} wins the tip', ev: s => { s.poss = T; } }, { p: 0.5, lab: '{O} wins the tip', ev: s => { s.poss = other(T); } }]),
    K('sup', 'pers', '{T} superstar out', 'Best player unavailable (−5.5 pts)', { adj: -5.5 }),
    K('star2', 'pers', '{T} second star out', 'No. 2 option unavailable (−3 pts)', { adj: -3 }),
    K('ctr', 'pers', '{T} starting center out', 'Rim protection and rebounding hit (−1.5 pts)', { adj: -1.5 }),
    K('rest', 'pers', '{T} rests all starters', 'Load management night (−9 pts)', { adj: -9 }),
    K('foul', 'pers', '{T} star in foul trouble', 'Star limited to spot minutes (−2.5 pts)', { adj: -2.5 }),
    K('ret', 'pers', '{T} star returns', 'Back from injury (+3 pts)', { adj: 3 }),
    K('bench', 'pers', '{T} bench depleted', 'Short rotation (−1.2 pts)', { adj: -1.2 }),
    KG('alt', 'env', 'Altitude (Denver or Utah)', 'Home edge ×1.5', { hfa: 1.5 }),
    KG('loud', 'env', 'Hostile playoff crowd', 'Home edge ×1.4', { hfa: 1.4 }),
    KG('empty', 'env', 'Empty arena', 'Home edge ×0.3', { hfa: 0.3 }),
    KG('neut', 'env', 'Neutral court (Cup final)', 'No home edge', { neutral: true }),
    KG('po', 'env', 'Playoff intensity', 'Slower and tighter: scoring ×0.96, home edge ×1.15', { pace: 0.96, hfa: 1.15 }),
    K('b2b', 'rest', '{T} 2nd night of a back-to-back', 'Tired legs (−1.8 pts)', { adj: -1.8 }),
    K('4in6', 'rest', '{T} 4th game in 6 nights', 'Schedule loss (−1.2 pts)', { adj: -1.2 }),
    K('rested', 'rest', '{T} extra rest (3+ days)', '+0.8 pts', { adj: 0.8 }),
    K('trip', 'rest', '{T} end of a long road trip', '−0.8 pts', { adj: -0.8 }),
    K('small', 'strat', '{T} goes small / five-out', 'Faster and more volatile', { pace: 1.04, vol: 1.06 }),
    K('hot', 'strat', '{T} hot shooting night', '{T} scoring ×1.06', { mulT: 1.06 }),
    K('cold', 'strat', '{T} cold shooting night', '{T} scoring ×0.94', { mulT: 0.94 }),
    K('zone', 'strat', '{T} zone defense', '{O} scoring ×0.985, more variance', { mulO: 0.985, vol: 1.04 }),
    K('hack', 'strat', '{T} hack-a-player', 'Slows the game; {O} scoring ×0.98', { pace: 0.96, mulO: 0.98 }),
    KG('grind', 'strat', 'Slow half-court grind', 'Scoring ×0.92', { pace: 0.92 }),
    KG('bomb', 'strat', 'Underdog three-point barrage', 'High-variance shooting: spread ×1.15', { vol: 1.15 })
  ];
  const bat = (id, cat, lab, tip, ev, x) => Object.assign({ id, cat, lab, tip, type: 'event', per: 'bat', ev }, x || {});
  const batR = (id, cat, lab, tip, br, x) => Object.assign({ id, cat, lab, tip, type: 'chance', per: 'bat', br }, x || {});
  LIB.bb = [
    bat('hr', 'score', '{T} home run', 'Everyone scores', (st, T) => { add(st, T, 1 + st.b1 + st.b2 + st.b3); st.b1 = st.b2 = st.b3 = 0; }),
    bat('gs', 'score', '{T} grand slam', 'Bases loaded, then a homer (+4)', (st, T) => { add(st, T, 4); st.b1 = st.b2 = st.b3 = 0; }),
    bat('s1', 'score', '{T} single', 'Runner on 3rd scores, others move up one', (st, T) => { add(st, T, st.b3); st.b3 = st.b2; st.b2 = st.b1; st.b1 = 1; }),
    bat('s2r', 'score', '{T} two-run single', 'Runners on 2nd and 3rd score', (st, T) => { add(st, T, st.b3 + st.b2); st.b3 = st.b1; st.b2 = 0; st.b1 = 1; }),
    bat('d2', 'score', '{T} double', 'Runners on 2nd and 3rd score; runner on 1st to 3rd', (st, T) => { add(st, T, st.b3 + st.b2); st.b3 = st.b1; st.b2 = 1; st.b1 = 0; }),
    bat('t3', 'score', '{T} triple', 'Everyone scores; batter on 3rd', (st, T) => { add(st, T, st.b1 + st.b2 + st.b3); st.b1 = st.b2 = 0; st.b3 = 1; }),
    bat('sf', 'score', '{T} sacrifice fly', 'Runner on 3rd scores, one out', (st, T) => { add(st, T, 1); st.b3 = 0; outs(st, 1); }, { avail: st => (st.b3 && st.outs < 2) || 'needs a runner on 3rd and fewer than 2 outs' }),
    bat('bb', 'sit', '{T} walk / hit by pitch', 'Batter to first; forced runners advance', st => walk(st)),
    bat('err', 'sit', 'Error by the defense', 'Batter safe at first; runners advance one', st => { adv1(st); st.b1 = 1; }),
    bat('k', 'sit', 'Strikeout', 'One out', st => outs(st, 1)),
    bat('dp', 'sit', 'Double play', 'Two outs; runner on 1st erased', st => { st.b1 = 0; outs(st, 2); }, { avail: st => (st.b1 && st.outs < 2) || 'needs a runner on 1st and fewer than 2 outs' }),
    bat('go', 'sit', 'Groundout, runners advance', 'One out; runners move up (run scores from 3rd with < 2 outs)', st => { if (st.outs < 2) adv1(st); outs(st, 1); }),
    bat('sb', 'sit', 'Stolen base', 'Runner on 1st takes 2nd', st => { st.b1 = 0; st.b2 = 1; }, { avail: st => (st.b1 && !st.b2) || 'needs a runner on 1st with 2nd open' }),
    bat('wp', 'sit', 'Wild pitch', 'Every runner advances one', st => adv1(st), { avail: st => (st.b1 || st.b2 || st.b3) || 'needs a runner on base' }),
    bat('pk', 'sit', 'Pickoff at first', 'Runner on 1st out', st => { st.b1 = 0; outs(st, 1); }, { avail: st => st.b1 || 'needs a runner on 1st' }),
    G('load', 'sit', 'Bases loaded', 'Runners on every base', st => { st.b1 = st.b2 = st.b3 = 1; }),
    G('clear', 'sit', 'Bases empty', 'Clear the bases', st => { st.b1 = st.b2 = st.b3 = 0; }),
    G('r3', 'sit', 'Runner on 3rd, 1 out', 'The sac-fly situation', st => { st.b1 = st.b2 = 0; st.b3 = 1; st.outs = 1; }),
    G('rsp', 'sit', 'Runners on 2nd & 3rd, nobody out', 'Two in scoring position', st => { st.b1 = 0; st.b2 = st.b3 = 1; st.outs = 0; }),
    G('next', 'sit', 'Next half-inning', 'Three outs', st => { st.outs = 3; endHalf(st); }),
    G('i7', 'sit', 'Top of the 7th', 'Late innings begin', st => { st.inning = 7; st.half = 'top'; st.outs = 0; st.b1 = st.b2 = st.b3 = 0; }),
    G('i9', 'sit', 'Bottom of the 9th', 'Walk-off territory', st => { st.inning = 9; st.half = 'bot'; st.outs = 0; st.b1 = st.b2 = st.b3 = 0; }),
    G('x10', 'sit', 'Extra innings', 'Top of the 10th with the automatic runner on 2nd', st => { st.inning = 10; st.half = 'top'; st.outs = 0; st.b1 = st.b3 = 0; st.b2 = 1; }),
    batR('sb2', 'chance', '{T} steals second', 'Success 78%; caught = runner out', () => [{ p: 0.78, lab: 'Safe (78%)', ev: s => { s.b1 = 0; s.b2 = 1; } }, { p: 0.22, lab: 'Caught stealing', ev: s => { s.b1 = 0; outs(s, 1); } }], { avail: st => (st.b1 && !st.b2) || 'needs a runner on 1st with 2nd open' }),
    batR('sb3', 'chance', '{T} steals third', 'Success 72%', () => [{ p: 0.72, lab: 'Safe (72%)', ev: s => { s.b2 = 0; s.b3 = 1; } }, { p: 0.28, lab: 'Caught stealing', ev: s => { s.b2 = 0; outs(s, 1); } }], { avail: st => (st.b2 && !st.b3) || 'needs a runner on 2nd with 3rd open' }),
    batR('bunt', 'chance', '{T} sacrifice bunt', 'Success 82%: runners move up, batter out', () => [{ p: 0.82, lab: 'Runners advance (82%)', ev: s => { s.b3 = s.b2; s.b2 = s.b1; s.b1 = 0; outs(s, 1); } }, { p: 0.18, lab: 'Lead runner out', ev: s => { if (s.b2) s.b2 = 0; else s.b1 = 0; s.b1 = 1; outs(s, 1); } }], { avail: st => ((st.b1 || st.b2) && st.outs < 2 && !st.b3) || 'needs a runner on 1st or 2nd, 3rd open, fewer than 2 outs' }),
    batR('sqz', 'chance', '{T} squeeze play', 'Run scores 60% of the time', (st, T) => [{ p: 0.6, lab: 'Run scores (60%)', ev: s => { add(s, T, 1); s.b3 = s.b2; s.b2 = s.b1; s.b1 = 0; outs(s, 1); } }, { p: 0.4, lab: 'Runner out at home', ev: s => { s.b3 = 0; s.b1 = 1; outs(s, 1); } }], { avail: st => (st.b3 && st.outs < 2) || 'needs a runner on 3rd and fewer than 2 outs' }),
    batR('tag', 'chance', '{T} tags up from third', 'Scores 85% of the time on a medium fly', (st, T) => [{ p: 0.85, lab: 'Scores (85%)', ev: s => { add(s, T, 1); s.b3 = 0; outs(s, 1); } }, { p: 0.15, lab: 'Thrown out (double play)', ev: s => { s.b3 = 0; outs(s, 2); } }], { avail: st => (st.b3 && st.outs < 2) || 'needs a runner on 3rd and fewer than 2 outs' }),
    bat('ibb', 'chance', 'Intentional walk to the batter', 'Defense puts the batter on', st => walk(st)),
    K('ace', 'pers', '{T} ace on the mound', '{O} scoring ×0.84', { mulO: 0.84 }),
    K('bpg', 'pers', '{T} bullpen game / opener', '{O} scoring ×1.08', { mulO: 1.08 }),
    K('rook', 'pers', '{T} rookie spot starter', '{O} scoring ×1.10', { mulO: 1.1 }),
    K('cl', 'pers', '{T} closer unavailable', '{O} scoring ×1.04', { mulO: 1.04 }),
    K('slug', 'pers', '{T} star slugger out', '{T} scoring ×0.95', { mulT: 0.95 }),
    K('rest', 'pers', '{T} rests its regulars', '{T} scoring ×0.92', { mulT: 0.92 }),
    K('stack', 'pers', '{T} full-strength lineup', '{T} scoring ×1.04', { mulT: 1.04 }),
    K('ppp', 'pers', '{T} position player pitching', 'Blowout mop-up: {O} scoring ×1.9', { mulO: 1.9 }),
    KG('coors', 'env', 'Coors Field', 'Thin air: scoring ×1.30', { pace: 1.3 }),
    KG('wout', 'env', 'Wind blowing out', 'Scoring ×1.15', { pace: 1.15 }),
    KG('win', 'env', 'Wind blowing in', 'Scoring ×0.88', { pace: 0.88 }),
    KG('pitch', 'env', "Pitcher's park", 'Scoring ×0.92', { pace: 0.92 }),
    KG('hot', 'env', 'Hot day (90°F+)', 'Ball carries: scoring ×1.05', { pace: 1.05 }),
    KG('cold', 'env', 'Cold night (under 50°F)', 'Scoring ×0.93', { pace: 0.93 }),
    KG('loud', 'env', 'Playoff crowd', 'Home edge ×1.3', { hfa: 1.3 }),
    KG('neut', 'env', 'Neutral site', 'No home edge', { neutral: true }),
    K('tired', 'rest', '{T} bullpen taxed', 'Extra innings last night: {O} scoring ×1.07', { mulO: 1.07 }),
    K('fresh', 'rest', '{T} fully rested bullpen', '{O} scoring ×0.96', { mulO: 0.96 }),
    K('dng', 'rest', '{T} day game after a night game', '{T} scoring ×0.97', { mulT: 0.97 }),
    K('red', 'rest', '{T} cross-country red-eye', '{T} scoring ×0.97, {O} ×1.02', { mulT: 0.97, mulO: 1.02 }),
    K('small', 'strat', '{T} small ball & aggressive running', '{T} scoring ×1.02', { mulT: 1.02 }),
    K('plat', 'strat', '{T} platoon advantage all game', '{T} scoring ×1.04', { mulT: 1.04 }),
    K('hook', 'strat', '{T} quick hook for the starter', '{O} scoring ×0.97', { mulO: 0.97 }),
    K('ride', 'strat', '{T} lets the starter ride', '{O} scoring ×1.03', { mulO: 1.03 })
  ];
  LIB.hk = [
    E('g', 'score', '{T} goal', '+1 (ends a {T} power play)', (st, T) => { add(st, T, 1); if (st.pp === T) { st.pp = null; st.ppSec = 0; st.ppMen = 1; } }),
    E('ppg', 'score', '{T} power-play goal', '+1; power play ends', (st, T) => { add(st, T, 1); st.pp = null; st.ppSec = 0; st.ppMen = 1; }, { avail: (st, T) => st.pp === T || 'needs a {T} power play' }),
    E('shg', 'score', '{T} shorthanded goal', '+1 while killing a penalty (the power play continues)', (st, T) => add(st, T, 1), { avail: (st, T) => st.pp === other(T) || 'needs a {O} power play' }),
    E('eng', 'score', '{T} empty-net goal', '+1 into the open net', (st, T) => add(st, T, 1), { avail: (st, T) => st.en === other(T) || 'needs {O} to have pulled its goalie' }),
    E('g2', 'score', '{T} scores twice', '+2', (st, T) => add(st, T, 2)),
    E('pen', 'sit', '{O} penalty: {T} power play', '2:00 five-on-four', (st, T) => { st.pp = T; st.ppSec = 120; st.ppMen = 1; }),
    E('dmin', 'sit', '{O} double minor', '4:00 power play for {T}', (st, T) => { st.pp = T; st.ppSec = 240; st.ppMen = 1; }),
    E('maj', 'sit', '{O} major penalty', '5:00 power play for {T}', (st, T) => { st.pp = T; st.ppSec = 300; st.ppMen = 1; }),
    E('v53', 'sit', '{T} 5-on-3', 'Two-man advantage for 2:00', (st, T) => { st.pp = T; st.ppSec = 120; st.ppMen = 2; }),
    E('pull', 'sit', '{T} pulls the goalie', 'Extra attacker', (st, T) => { st.en = T; }),
    E('back', 'sit', '{T} goalie back in net', 'Goalie returns', st => { st.en = null; }, { avail: (st, T) => st.en === T || '{T} goalie is already in' }),
    G('p2', 'sit', 'Start of the 2nd', '20:00 left in the 2nd', st => { st.period = 2; st.clock = 1200; }),
    G('p3', 'sit', 'Start of the 3rd', '20:00 left in the 3rd', st => { st.period = 3; st.clock = 1200; }),
    G('late', 'sit', '5:00 left in the 3rd', 'Late game', st => { st.period = 3; st.clock = 300; }),
    G('m1', 'sit', '1:00 left', 'Final minute of regulation', st => { st.period = 3; st.clock = 60; }),
    G('ot', 'sit', 'Overtime (3-on-3)', 'Sudden death', st => { st.period = 4; st.clock = 300; st.pp = null; st.en = null; }),
    R('ps', 'chance', '{T} penalty shot', 'Scores about 32% of the time', (st, T) => [{ p: 0.32, lab: 'Scores (32%)', ev: s => add(s, T, 1) }, { p: 0.68, lab: 'Saved', ev: () => { } }]),
    R('chal', 'chance', "{O} challenges {T}'s last goal", 'Overturned about 35% of the time', (st, T) => [{ p: 0.35, lab: 'Goal overturned (35%)', ev: s => add(s, T, -1) }, { p: 0.65, lab: 'Goal stands', ev: () => { } }], { avail: (st, T) => score(st, T) > 0 || '{T} has not scored' }),
    K('g1', 'pers', '{T} starter out, backup in net', '−0.30 goals', { adj: -0.3 }),
    K('hotg', 'pers', '{T} goalie on a hot streak', '+0.22 goals', { adj: 0.22 }),
    K('c1', 'pers', '{T} top-line center out', '−0.20 goals', { adj: -0.2 }),
    K('d1', 'pers', '{T} top defenseman out', '−0.16 goals', { adj: -0.16 }),
    K('cap', 'pers', '{T} captain returns', '+0.12 goals', { adj: 0.12 }),
    K('rook', 'pers', '{T} rookie goalie debut', '−0.35 goals', { adj: -0.35 }),
    KG('loud', 'env', 'Hostile playoff barn', 'Home edge ×1.4', { hfa: 1.4 }),
    KG('out', 'env', 'Outdoor game (soft ice)', 'Scoring ×0.94', { pace: 0.94 }),
    KG('empty', 'env', 'Empty arena', 'Home edge ×0.3', { hfa: 0.3 }),
    KG('neut', 'env', 'Neutral site', 'No home edge', { neutral: true }),
    KG('po', 'env', 'Playoff hockey', 'Tighter checking: scoring ×0.90, home edge ×1.1', { pace: 0.9, hfa: 1.1 }),
    K('b2b', 'rest', '{T} 2nd of a back-to-back', '−0.18 goals', { adj: -0.18 }),
    K('b2bg', 'rest', '{T} back-to-back, backup goalie', '−0.38 goals', { adj: -0.38 }),
    K('rested', 'rest', '{T} rested vs a tired opponent', '+0.10 goals', { adj: 0.1 }),
    K('trip', 'rest', '{T} end of a long road trip', '−0.08 goals', { adj: -0.08 }),
    K('shell', 'strat', '{T} defensive shell', '{T} scoring ×0.85, {O} ×0.90', { mulT: 0.85, mulO: 0.9 }),
    K('fore', 'strat', '{T} aggressive forecheck', '{T} scoring ×1.05, {O} ×1.03', { mulT: 1.05, mulO: 1.03 }),
    K('trap', 'strat', '{T} neutral-zone trap', '{T} ×0.93, {O} ×0.90', { mulT: 0.93, mulO: 0.9 }),
    KG('rush', 'strat', 'Run-and-gun, both teams', 'Scoring ×1.12', { pace: 1.12 })
  ];
  LIB.sc = [
    E('g', 'score', '{T} goal', '+1', (st, T) => add(st, T, 1)),
    E('og', 'score', '{O} own goal', '+1 for {T}', (st, T) => add(st, T, 1)),
    E('brace', 'score', '{T} scores twice', '+2', (st, T) => add(st, T, 2)),
    E('early', 'score', "{T} early goal (10')", 'Goal in the 10th minute', (st, T) => { st.minute = Math.max(st.minute || 0, 10); add(st, T, 1); }),
    E('rc', 'sit', '{T} red card', '{T} down to ten (scores ~⅓ less, concedes ~¼ more)', (st, T) => { if (T === 'home') st.redH = Math.min(3, (st.redH || 0) + 1); else st.redA = Math.min(3, (st.redA || 0) + 1); }),
    E('y2', 'sit', '{T} second yellow', 'Sent off: same effect as a red', (st, T) => { if (T === 'home') st.redH = Math.min(3, (st.redH || 0) + 1); else st.redA = Math.min(3, (st.redA || 0) + 1); }),
    E('varrc', 'sit', "VAR rescinds {T}'s red card", 'Back to eleven', (st, T) => { if (T === 'home') st.redH = Math.max(0, (st.redH || 0) - 1); else st.redA = Math.max(0, (st.redA || 0) - 1); }, { avail: (st, T) => (T === 'home' ? st.redH : st.redA) > 0 || '{T} has no red card' }),
    E('var', 'sit', "VAR rules out {T}'s goal", '{T} −1', (st, T) => add(st, T, -1), { avail: (st, T) => score(st, T) > 0 || '{T} has not scored' }),
    G('ht', 'sit', 'Halftime', "45'", st => { st.minute = 45; }),
    G('m60', 'sit', "60th minute", "60'", st => { st.minute = 60; }),
    G('m75', 'sit', "75th minute", "75'", st => { st.minute = 75; }),
    G('m85', 'sit', "85th minute", "85'", st => { st.minute = 85; }),
    G('m90', 'sit', 'Stoppage time', "90'+3", st => { st.minute = st.ko ? 90 : 93; }),
    G('et', 'sit', 'Extra time (knockout)', "Knockout rules, 91'", st => { st.ko = 1; st.minute = 91; }),
    G('et2', 'sit', 'Second half of extra time', "106'", st => { st.ko = 1; st.minute = 106; }),
    R('pk', 'chance', '{T} penalty kick', 'Converted about 78% of the time', (st, T) => [{ p: 0.78, lab: 'Scored (78%)', ev: s => add(s, T, 1) }, { p: 0.22, lab: 'Saved or missed', ev: () => { } }]),
    R('varc', 'chance', 'VAR check on a {T} goal', 'The goal stands about 70% of the time', (st, T) => [{ p: 0.7, lab: 'Goal stands (70%)', ev: s => add(s, T, 1) }, { p: 0.3, lab: 'Ruled out', ev: () => { } }]),
    R('fk', 'chance', '{T} free kick at the edge of the box', 'Direct free kick, about 8%', (st, T) => [{ p: 0.08, lab: 'Curled in (8%)', ev: s => add(s, T, 1) }, { p: 0.92, lab: 'No goal', ev: () => { } }]),
    K('st', 'pers', '{T} star striker out', '−0.22 goals', { adj: -0.22 }),
    K('gk', 'pers', '{T} first-choice keeper out', '−0.15 goals', { adj: -0.15 }),
    K('cb', 'pers', '{T} captain / center-back out', '−0.12 goals', { adj: -0.12 }),
    K('rot', 'pers', '{T} heavily rotated XI', '−0.30 goals', { adj: -0.3 }),
    K('sign', 'pers', '{T} star signing debuts', '+0.10 goals', { adj: 0.1 }),
    K('ret', 'pers', '{T} talisman returns', '+0.18 goals', { adj: 0.18 }),
    KG('rain', 'env', 'Waterlogged pitch', 'Scoring ×0.88', { pace: 0.88 }),
    KG('heat', 'env', 'Heat above 30°C', 'Scoring ×0.90', { pace: 0.9 }),
    KG('derby', 'env', 'Derby intensity', 'Home edge ×1.25, scoring ×1.04', { hfa: 1.25, pace: 1.04 }),
    KG('turf', 'env', 'Artificial turf', 'Home edge ×1.15', { hfa: 1.15 }),
    KG('alt', 'env', 'High altitude (La Paz, Quito)', 'Home edge ×2', { hfa: 2 }),
    KG('closed', 'env', 'Behind closed doors', 'Home edge ×0.3', { hfa: 0.3 }),
    KG('neut', 'env', 'Neutral venue (cup final)', 'No home edge', { neutral: true }),
    K('mid', 'rest', '{T} played midweek in Europe', '−0.10 goals', { adj: -0.1 }),
    K('jet', 'rest', '{T} long-haul travel', '−0.10 goals', { adj: -0.1 }),
    K('congest', 'rest', '{T} 3 games in 7 days', '−0.15 goals', { adj: -0.15 }),
    K('rested', 'rest', '{T} extra rest', '+0.05 goals', { adj: 0.05 }),
    K('bus', 'strat', '{T} parks the bus', '{T} scoring ×0.60, {O} ×0.75', { mulT: 0.6, mulO: 0.75 }),
    K('attack', 'strat', '{T} all-out attack', '{T} scoring ×1.30, {O} ×1.40 on the counter', { mulT: 1.3, mulO: 1.4 }),
    K('press', 'strat', '{T} high press', '{T} ×1.10, {O} ×1.05', { mulT: 1.1, mulO: 1.05 }),
    K('counter', 'strat', '{T} sits deep & counters', '{T} ×0.90, {O} ×0.82', { mulT: 0.9, mulO: 0.82 }),
    K('sub', 'strat', '{T} adds an extra striker', '{T} ×1.15, {O} ×1.10', { mulT: 1.15, mulO: 1.1 })
  ];
  const POP = { fb: ['td', 'fg3', 'take', 'rz', '2min', 'fga', 'go4', 'qb', 'snow', 'bye'], bk: ['p3', 'r8', 'two', 'last', 's3', 'ft2', 'sup', 'b2b', 'hot', 'loud'], bb: ['hr', 's1', 'dp', 'i9', 'x10', 'sb2', 'sqz', 'ace', 'coors', 'wout'], hk: ['g', 'pen', 'v53', 'pull', 'late', 'ps', 'g1', 'b2b', 'shell', 'po'], sc: ['g', 'rc', 'pk', 'm75', 'm90', 'et', 'st', 'bus', 'attack', 'rain'] };

  // conditions are sized for the NFL, NBA, MLB, NHL and soccer; other leagues scale by their scoring spread
  const REF = { fb: 13.5, bk: 12, bb: 4.3, hk: 2.4, sc: 1.75 };
  SC.list = function (kind) { return LIB[kind] || []; };
  SC.popular = kind => POP[kind] || [];
  SC.find = (kind, id) => (LIB[kind] || []).find(x => x.id === id) || null;
  SC.actor = function (item, st, T) { return item.per === 'bat' ? batting(st) : T; };
  SC.label = function (item, T, O, st, c) {
    const lab = item.lab.replace(/\{T\}/g, T).replace(/\{O\}/g, O);
    return item.dyn && st && c ? lab + ' · ' + item.dyn(st, c) : lab;
  };
  SC.avail = function (item, st, T, c) { if (!item.avail) return true; const r = item.avail(st, T, c); return r === true || r === 1 ? true : r || false; };
  // fold active conditions into model modifiers
  SC.mods = function (kind, sp, conds) {
    const k = (sp.sigma || REF[kind]) / REF[kind];
    const m = { adjH: 0, adjA: 0, pace: 1, hfa: 1, vol: 1, mulH: 1, mulA: 1, neutral: null };
    for (const c of conds) {
      const it = SC.find(kind, c.id); if (!it || it.type !== 'cond') continue;
      const e = it.eff, T = c.side, O = T && other(T);
      if (e.adj && T) { if (T === 'home') m.adjH += e.adj * k; else m.adjA += e.adj * k; }
      if (e.pace) m.pace *= e.pace; if (e.hfa) m.hfa *= e.hfa; if (e.vol) m.vol *= e.vol;
      if (e.mulT && T) { if (T === 'home') m.mulH *= e.mulT; else m.mulA *= e.mulT; }
      if (e.mulO && O) { if (O === 'home') m.mulH *= e.mulO; else m.mulA *= e.mulO; }
      if (e.neutral) m.neutral = true;
    }
    return m;
  };
  SC.other = other; SC.batting = batting;

  /* ---------------- decisions: compare the options a coach has ---------------- */
  // run(state) → model result for that state; runX(state, exPatch) → with modified scoring rates
  SC.decide = function (kind, st, c, run, runX) {
    const pw = (r, T) => T === 'home' ? r.pH : r.pA;
    const clone = s => JSON.parse(JSON.stringify(s));
    const mix = (brs, T) => brs.reduce((a, b) => { const s2 = clone(st); b.ev(s2); return a + b.p * pw(run(s2), T); }, 0);
    if (kind === 'fb' && st.poss && st.down === 4 && st.clock + (st.period < 4 ? 1 : 0) > 0) {
      const T = st.poss, opts = [];
      opts.push({ lab: `Go for it (${Math.round(SC.convP(st) * 100)}% to convert)`, p: mix(SC.find('fb', 'go4').br(st, T, c), T) });
      if (st.yl >= 42) opts.push({ lab: `Field goal, ${(100 - st.yl) + 17} yds (${Math.round(SC.fgP(st.yl, c.lgId) * 100)}%)`, p: mix(SC.find('fb', 'fga').br(st, T, c), T) });
      if (st.yl <= 90) { const s2 = clone(st); fb.punt(s2, T); opts.push({ lab: 'Punt (net 41 yds)', p: pw(run(s2), T) }); }
      return { title: `4th-down decision · 4th & ${st.dist} at ${ylTxt(st.yl)}`, team: T, opts };
    }
    if (kind === 'bk' && st.poss && st.period >= 4 && st.clock <= 35 && Math.abs(st.hs - st.as) <= 4) {
      const T = st.poss;
      return { title: 'Last-possession shot choice', team: T, opts: [{ lab: 'Take a three (36%)', p: mix(SC.find('bk', 's3').br(st, T, c), T) }, { lab: 'Attack the rim for two (52%)', p: mix(SC.find('bk', 's2').br(st, T, c), T) }], note: 'Each shot uses the clock and a miss can be rebounded by either side.' };
    }
    if (kind === 'bb') {
      const T = batting(st), opts = [];
      if (st.b1 && !st.b2 && st.outs < 2) {
        opts.push({ lab: 'Swing away', p: pw(run(st), T) });
        opts.push({ lab: 'Steal second (78%)', p: mix(SC.find('bb', 'sb2').br(st, T, c), T) });
        if (!st.b3) opts.push({ lab: 'Sacrifice bunt (82%)', p: mix(SC.find('bb', 'bunt').br(st, T, c), T) });
        return { title: 'Runner on first: steal, bunt or swing?', team: T, opts };
      }
      if (st.b3 && st.outs < 2) {
        return { title: 'Runner on third: squeeze or swing?', team: T, opts: [{ lab: 'Swing away', p: pw(run(st), T) }, { lab: 'Squeeze play (60%)', p: mix(SC.find('bb', 'sqz').br(st, T, c), T) }] };
      }
      if (!st.b1 && (st.b2 || st.b3)) {
        const D = other(T), s2 = clone(st); walk(s2);
        return { title: 'First base open: pitch to him or walk him?', team: D, opts: [{ lab: 'Pitch to the batter', p: pw(run(st), D) }, { lab: 'Intentional walk', p: pw(run(s2), D) }], note: 'Win chance for the team in the field.' };
      }
      return null;
    }
    if (kind === 'hk' && st.period === 3 && st.clock <= 420 && !st.en) {
      const lead = st.hs - st.as; if (Math.abs(lead) < 1 || Math.abs(lead) > 2) return null;
      const T = lead < 0 ? 'home' : 'away', rem = st.clock / 60, opts = [];
      const at = min => { const s2 = clone(st); if (min == null) s2.noPull = true; else { s2.en = T; s2.enMin = Math.min(rem, min); } return pw(run(s2), T); };
      opts.push({ lab: `Pull the goalie now (${Math.floor(rem)}:${String(Math.round((rem % 1) * 60)).padStart(2, '0')} left)`, p: at(rem) });
      if (rem > 3) opts.push({ lab: 'Pull at 3:00', p: at(3) });
      if (rem > 2) opts.push({ lab: 'Pull at 2:00', p: at(2) });
      if (rem > 1) opts.push({ lab: 'Pull at 1:00', p: at(1) });
      opts.push({ lab: 'Keep the goalie in', p: at(null) });
      return { title: `Pull the goalie? ${c.ab(T)} trails by ${Math.abs(lead)}`, team: T, opts, note: `An extra attacker roughly triples ${c.ab(T)}'s scoring rate, but the empty net lets ${c.ab(other(T))} score far more easily.` };
    }
    if (kind === 'sc' && (st.minute || 0) >= 55 && (st.minute || 0) < (st.ko ? 118 : 90) && st.hs !== st.as) {
      const T = st.hs < st.as ? 'home' : 'away', O = other(T);
      const tactic = (mT, mO) => pw(runX(st, T === 'home' ? { mulH: mT, mulA: mO } : { mulH: mO, mulA: mT }), T);
      return { title: `${c.ab(T)} chasing the game: how hard to push?`, team: T, opts: [{ lab: 'Stay the course', p: pw(run(st), T) }, { lab: 'Add an extra striker', p: tactic(1.15, 1.1) }, { lab: 'All-out attack', p: tactic(1.3, 1.4) }], note: `Pushing forward raises ${c.ab(T)}'s scoring rate but opens space for ${c.ab(O)} to counter. Win chance shown is ${c.ab(T)}'s.` };
    }
    return null;
  };
})();
