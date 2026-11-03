
/* ==========================================================================
   Probable — predictive models (pure functions, no DOM)
   Football & basketball: Brownian-motion win probability (Stern 1994) with
   an expected-points term for football field position.
   Baseball: plate-appearance Monte Carlo from the live base/out state.
   Hockey & soccer: Poisson scoring processes (power play, empty net, red
   cards), Dixon–Coles low-score correction for soccer pregame.
   Tennis: point → game → set → match Markov chain.
   ========================================================================== */
(function (root) {
  'use strict';
  const M = {};

  /* ---------- math ---------- */
  function erf(x) {
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
  function PhiInv(p) {
    if (p <= 0) return -8; if (p >= 1) return 8;
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p <= 1 - pl) { const q = p - 0.5, r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
    const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  function poisPmf(lam, kmax) {
    const out = new Float64Array(kmax + 1); let p = Math.exp(-lam); out[0] = p;
    for (let k = 1; k <= kmax; k++) { p *= lam / k; out[k] = p; }
    return out;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  M.math = { erf, Phi, PhiInv, poisPmf, rng, clamp, hash };

  /* ---------- sport parameters ---------- */
  // sigma: SD of final margin (full game); hfa: home edge in margin units;
  // lg: league scoring per team per game; k: regression pseudo-games.
  const SP = {
    fb_nfl:   { kind: 'fb', periods: 4, perLen: 900, otLen: 600, sigma: 13.5, vEnd: 8, hfa: 1.8, lg: 22.5, k: 5, unit: 'pts', tieStands: true },
    fb_ncaaf: { kind: 'fb', periods: 4, perLen: 900, otLen: 480, sigma: 16.5, vEnd: 9, hfa: 2.8, lg: 28, k: 4, unit: 'pts' },
    bk_nba:   { kind: 'bk', periods: 4, perLen: 720, otLen: 300, sigma: 12, vEnd: 16, hfa: 2.3, lg: 114.5, k: 14, unit: 'pts' },
    bk_wnba:  { kind: 'bk', periods: 4, perLen: 600, otLen: 300, sigma: 11, vEnd: 14, hfa: 2.0, lg: 83, k: 10, unit: 'pts' },
    bb_mlb:   { kind: 'bb', innings: 9, sigma: 4.3, hfa: 0.45, lg: 4.45, k: 30, unit: 'runs' },
    hk_nhl:   { kind: 'hk', periods: 3, perLen: 1200, sigma: 2.4, hfa: 0.16, lg: 3.05, k: 20, unit: 'goals' },
    sc:       { kind: 'sc', sigma: 1.75, hfa: 0.30, lg: 1.38, k: 6, unit: 'goals' }
  };
  M.SP = SP;

  /* ---------- team ratings ---------- */
  // rows: [{key, gp, w, l, t, pf, pa, pts}] ; priors: {key: net} (last season)
  // returns net rating in margin units vs an average team on neutral ground,
  // split into offense (scoring above avg) and defense (conceding below avg).
  M.rateLeague = function (sp, rows, priors, lgOverride) {
    const withPF = rows.filter(r => r.gp > 0 && isFinite(r.pf) && isFinite(r.pa));
    const hasPF = rows.length > 0 && withPF.length >= rows.length * 0.6;
    let lg = lgOverride || sp.lg;
    if (hasPF && withPF.length > 3) { let s = 0; for (const r of withPF) s += r.pf / r.gp; lg = s / withPF.length; }
    const teams = {};
    for (const r of rows) {
      const gp = r.gp || 0, k = sp.k;
      const w = gp / (gp + k);
      const pr = priors && isFinite(priors[r.key]) ? priors[r.key] * 0.6 : 0;
      let off, def, net, source;
      if (hasPF && gp > 0 && isFinite(r.pf) && isFinite(r.pa)) {
        const rawOff = r.pf / gp - lg, rawDef = lg - r.pa / gp;
        off = w * rawOff + (1 - w) * pr / 2; def = w * rawDef + (1 - w) * pr / 2; net = off + def; source = 'scoring';
      } else if (gp > 0) {
        if (sp.kind === 'sc') {
          const pts = isFinite(r.pts) ? r.pts : 3 * r.w + (r.t || 0);
          const ppgPrior = 1.37 + 0.70 * pr;
          const ppg = (pts + k * ppgPrior) / (gp + k);
          net = (ppg - 1.37) / 0.70;
        } else {
          const pPrior = Phi(pr / sp.sigma);
          const p = clamp((r.w + 0.5 * (r.t || 0) + k * pPrior) / (gp + k), 0.03, 0.97);
          net = sp.sigma * PhiInv(p);
        }
        off = net / 2; def = net / 2; source = 'record';
      } else { net = pr; off = pr / 2; def = pr / 2; source = pr ? 'prior' : 'none'; }
      teams[r.key] = { off, def, net, gp, w, source };
    }
    return { lg, teams, hasPF };
  };

  // expected scores for a matchup; adjH/adjA shift a team's net rating (margin units)
  M.expect = function (sp, lg, h, a, o) {
    o = o || {};
    // hfaMul scales the home edge (hostile crowd > 1, empty stadium < 1)
    const hfa = o.neutral ? 0 : sp.hfa * (isFinite(o.hfaMul) ? o.hfaMul : 1);
    const aH = o.adjH || 0, aA = o.adjA || 0, pace = o.pace || 1;
    let eH = lg + (h ? h.off : 0) - (a ? a.def : 0) + hfa / 2 + aH / 2 - aA / 2;
    let eA = lg + (a ? a.off : 0) - (h ? h.def : 0) - hfa / 2 + aA / 2 - aH / 2;
    const floor = sp.kind === 'sc' ? 0.15 : sp.kind === 'hk' ? 0.6 : sp.kind === 'bb' ? 1.2 : lg * 0.35;
    eH = Math.max(floor, eH * pace); eA = Math.max(floor, eA * pace);
    return { eH, eA, mu: eH - eA, total: eH + eA };
  };

  // expected scores implied by a provider line (probabilities and/or spread)
  M.fromLine = function (sp, lg, line, o) {
    o = o || {};
    if (!line) return null;
    let mu = null;
    if (isFinite(line.spread) && (sp.kind === 'fb' || sp.kind === 'bk')) mu = line.spread;
    const total = isFinite(line.total) ? line.total : 2 * lg;
    if (mu == null && isFinite(line.pH)) {
      if (sp.kind === 'sc' && isFinite(line.pD)) {
        const fit = M.scFit(line.pH, line.pD, line.pA);
        if (fit) return { eH: fit.eH * (o.pace || 1), eA: fit.eA * (o.pace || 1), mu: fit.eH - fit.eA, total: fit.eH + fit.eA, fromLine: true };
      }
      const pH2 = line.pH / (line.pH + (line.pA || (1 - line.pH)));
      mu = sp.sigma * PhiInv(clamp(pH2, 0.005, 0.995));
    }
    if (mu == null) return null;
    // hfaDelta: change in home edge versus the venue the line was set for (neutral switch, crowd effects)
    mu += (o.adjH || 0) - (o.adjA || 0) + (isFinite(o.hfaDelta) ? o.hfaDelta : 0);
    const pace = o.pace || 1;
    const eH = Math.max(0.1, (total / 2 + mu / 2) * pace), eA = Math.max(0.1, (total / 2 - mu / 2) * pace);
    return { eH, eA, mu: eH - eA, total: eH + eA, fromLine: true };
  };

  /* ---------- football / basketball: Brownian motion ---------- */
  function epFootball(yl, down, dist) {
    if (!(yl > 0)) return 0.4;
    yl = clamp(yl, 1, 99);
    let ep = yl <= 80 ? 0.8 + 0.0545 * (yl - 25) : 3.8 + (yl - 80) * 0.1;
    ep += [0, -0.25, -0.6, -1.0][clamp((down | 0) - 1, 0, 3)];
    if (dist > 10) ep -= 0.05 * (dist - 10);
    if (down === 4 && yl >= 62) ep = Math.max(ep, 1.9);
    return ep;
  }
  M.epFootball = epFootball;

  function remFraction(sp, st) {
    const T = sp.periods * sp.perLen;
    if (st.period <= sp.periods) return clamp(((sp.periods - st.period) * sp.perLen + clamp(st.clock, 0, sp.perLen)) / T, 0, 1);
    return clamp(st.clock, 0, sp.otLen || 600) / T;
  }
  M.remFraction = remFraction;

  /* ---------- end-game: the last possession is a lump, not a smooth drift ---------- */
  const FGT = [[18, 0.995], [25, 0.99], [30, 0.975], [35, 0.945], [40, 0.9], [45, 0.84], [50, 0.76], [53, 0.7], [56, 0.62], [59, 0.52], [62, 0.4], [65, 0.28], [70, 0.1], [75, 0.02]];
  const TDT = [[1, 0.005], [30, 0.02], [45, 0.04], [55, 0.06], [65, 0.09], [75, 0.14], [85, 0.22], [90, 0.3], [95, 0.42], [98, 0.52], [99, 0.55]];
  const interp = (tab, x) => { if (x <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return tab[tab.length - 1][1]; };
  M.fgMake = (yl, college) => clamp(interp(FGT, (100 - clamp(yl, 1, 99)) + 17) * (college ? 0.93 : 1), 0, 0.995);
  M.tdOnePlay = yl => interp(TDT, clamp(yl, 1, 99));
  function endResult(dist, st, pOT, eH, eA, T, secLeft) {
    let pWin = 0, pLoss = 0, pTie = 0;
    for (const [d, p] of dist) { if (d > 0) pWin += p; else if (d < 0) pLoss += p; else pTie += p; }
    const pH = pWin + pTie * pOT;
    return { pH, pA: 1 - pH, pD: 0, pTie, dist: [...dist.entries()].sort((a, b) => a[0] - b[0]), fH: st.hs + eH, fA: st.as + eA, f: secLeft / T, adj: 0, sd: 0, end: true };
  }
  // basketball, final 24 seconds with the ball: one (or two) discrete possessions
  function bkEnd(sp, st, ex, r, pOT, T) {
    const dist = new Map(), lg = ex.lg || sp.lg; let eH = 0, eA = 0;
    const rec = (lead, rr, poss, depth, w) => {
      const off = poss === 'home' ? ex.eH : ex.eA, mult = clamp(Math.sqrt(off / lg), 0.85, 1.15), damp = clamp(0.3 + rr / 10, 0.3, 1);
      const P1 = 0.03 * damp * mult, P2 = 0.33 * damp * mult, P3 = 0.13 * damp * mult, out = [[0, 1 - P1 - P2 - P3], [1, P1], [2, P2], [3, P3]];
      const r2 = Math.max(0, rr - 21);
      for (const [k, p] of out) {
        if (p <= 0) continue;
        if (poss === 'home') eH += w * p * k; else eA += w * p * k;
        const nl = lead + (poss === 'home' ? k : -k);
        if (r2 > 0 && depth < 2) rec(nl, r2, poss === 'home' ? 'away' : 'home', depth + 1, w * p);
        else dist.set(nl, (dist.get(nl) || 0) + w * p);
      }
    };
    rec(st.hs - st.as, r, st.poss, 0, 1);
    return endResult(dist, st, pOT, eH, eA, T, r);
  }
  // football, final play (12 seconds or less) with the ball: kick, heave or kneel
  function fbLast(sp, st, ex, pOT, T, r) {
    const H = st.poss === 'home', lead = (st.hs - st.as) * (H ? 1 : -1), fg = M.fgMake(st.yl, sp.sigma > 15), td = M.tdOnePlay(st.yl);
    let out;
    if (lead > 0) out = [[0, 1]];
    else if (-lead <= 3 && fg >= 0.25) out = [[3, fg], [0, 1 - fg]];
    else out = [[7, td], [0, 1 - td]];
    const dist = new Map(); let eH = 0, eA = 0;
    for (const [k, p] of out) { const d = (st.hs - st.as) + (H ? k : -k); dist.set(d, (dist.get(d) || 0) + p); if (H) eH += k * p; else eA += k * p; }
    return endResult(dist, st, pOT, eH, eA, T, r);
  }

  // discrete end game inside [lo, hi] seconds, blended with the smooth model across the window
  const END = { bk: [24, 48], fb: [12, 24] };
  M.brownian = function (sp, st, ex) {
    const T = sp.periods * sp.perLen, f = remFraction(sp, st), inOT = st.period > sp.periods;
    const rLeft = inOT ? clamp(st.clock, 0, sp.otLen || 600) : f * T, zone = END[sp.kind];
    if (!(st.poss && zone && rLeft > 0 && rLeft <= zone[1])) return gauss(sp, st, ex);
    const oF = (sp.otLen || 480) / T; let pO = Phi((ex.mu * oF) / (sp.sigma * Math.sqrt(oF))); if (inOT && sp.tieStands) pO = 0.5;
    const e = sp.kind === 'bk' ? bkEnd(sp, st, ex, rLeft, pO, T) : fbLast(sp, st, ex, pO, T, rLeft);
    if (rLeft <= zone[0]) return e;
    const g = gauss(sp, st, ex), w = (zone[1] - rLeft) / (zone[1] - zone[0]);
    const md = new Map(); for (const [d, p] of g.dist) md.set(d, (md.get(d) || 0) + (1 - w) * p); for (const [d, p] of e.dist) md.set(d, (md.get(d) || 0) + w * p);
    const pH = w * e.pH + (1 - w) * g.pH;
    return Object.assign({}, g, { pH, pA: 1 - pH, pTie: w * e.pTie + (1 - w) * g.pTie, dist: [...md.entries()].sort((x, y) => x[0] - y[0]), fH: w * e.fH + (1 - w) * g.fH, fA: w * e.fA + (1 - w) * g.fA });
  };
  function gauss(sp, st, ex) {
    const T = sp.periods * sp.perLen;
    const f = remFraction(sp, st);
    const inOT = st.period > sp.periods;
    const lead = st.hs - st.as;
    let adj = 0;
    if (sp.kind === 'fb' && st.poss && f > 0) { const ep = epFootball(st.yl, st.down, st.dist); adj = st.poss === 'home' ? ep : -ep; }
    if (sp.kind === 'bk' && st.poss && f > 0) adj = st.poss === 'home' ? 0.9 : -0.9;
    const eps = sp.kind === 'fb' ? 0.004 : 0.0012;
    const m = lead + adj + ex.mu * f;
    // endgame variance: scoring comes in lumps (drives, 3-pointers, fouls), so remaining-margin
    // variance never shrinks all the way to a smooth Brownian path
    const vol = isFinite(ex.vol) && ex.vol > 0 ? ex.vol : 1; // > 1: a higher-variance game (helps the underdog)
    // endgame lumpiness (fouls, threes, drives) fades out over the last minute or so of regulation
    const secLeft = inOT ? clamp(st.clock, 0, sp.otLen || 600) : f * T, fade = Math.min(1, secLeft / (sp.kind === 'bk' ? 90 : 60));
    const s = Math.sqrt(sp.sigma * sp.sigma * vol * vol * (f + eps) + (f > 0 ? sp.vEnd * fade : 0));
    let pWin = 1 - Phi((0.5 - m) / s), pLoss = Phi((-0.5 - m) / s);
    if (f === 0) { pWin = lead > 0 ? 1 : 0; pLoss = lead < 0 ? 1 : 0; }
    let pTie = Math.max(0, 1 - pWin - pLoss);
    const otFrac = (sp.otLen || 480) / T;
    let pOT = Phi((ex.mu * otFrac) / (sp.sigma * Math.sqrt(otFrac)));
    if (inOT && sp.tieStands) pOT = 0.5;
    const pH = pWin + pTie * pOT;
    // distribution of final margin (discretized normal)
    const dist = [];
    const center = lead + adj * (f > 0 ? 1 : 0) + ex.mu * f;
    const span = Math.max(8, Math.ceil(3.2 * s));
    for (let d = Math.floor(center - span); d <= Math.ceil(center + span); d++) {
      const p = f === 0 ? (d === lead ? 1 : 0) : Phi((d + 0.5 - m) / s) - Phi((d - 0.5 - m) / s);
      if (p > 1e-5) dist.push([d, p]);
    }
    const remTotal = ex.total * f;
    const fH = st.hs + (remTotal + ex.mu * f + adj) / 2, fA = st.as + (remTotal - ex.mu * f - adj) / 2;
    return { pH, pA: 1 - pH, pD: 0, pTie, dist, fH, fA, f, adj, sd: s };
  }

  /* ---------- baseball: plate-appearance Monte Carlo ---------- */
  const PA = { bb: 0.096, s1: 0.1465, s2: 0.0464, s3: 0.0037, hr: 0.032 }; // league-average rates per PA
  const K_SHARE = 0.33; // share of outs that are strikeouts
  const GAMMA = 0.41;   // run scoring elasticity of on-base events (calibrated: runs ∝ team strength)
  M.bbRates = function (mult) {
    const s = Math.pow(clamp(mult, 0.4, 2.2), GAMMA);
    const r = { bb: PA.bb * s, s1: PA.s1 * s, s2: PA.s2 * s, s3: PA.s3 * s, hr: PA.hr * Math.pow(s, 1.25) };
    const on = r.bb + r.s1 + r.s2 + r.s3 + r.hr;
    const c1 = r.bb, c2 = c1 + r.s1, c3 = c2 + r.s2, c4 = c3 + r.s3, c5 = c4 + r.hr;
    return [c1, c2, c3, c4, c5, on];
  };
  function halfInning(R, cum, outs, b1, b2, b3, walkoffNeed) {
    // returns runs scored; stops early if walkoffNeed>0 reached
    let runs = 0;
    while (outs < 3) {
      const u = R();
      if (u < cum[0]) { // walk / HBP
        if (b1 && b2 && b3) runs++; else if (b1 && b2) b3 = 1; else if (b1) b2 = 1; b1 = 1;
      } else if (u < cum[1]) { // single
        let n1 = 1, n2 = 0, n3 = 0; runs += b3;
        if (b2) { if (R() < 0.62) runs++; else n3 = 1; }
        if (b1) { if (!n3 && R() < 0.28) n3 = 1; else n2 = 1; }
        b1 = n1; b2 = n2; b3 = n3;
      } else if (u < cum[2]) { // double
        runs += b3 + b2; let n3 = 0;
        if (b1) { if (R() < 0.42) runs++; else n3 = 1; }
        b1 = 0; b2 = 1; b3 = n3;
      } else if (u < cum[3]) { runs += b1 + b2 + b3; b1 = 0; b2 = 0; b3 = 1; }
      else if (u < cum[4]) { runs += b1 + b2 + b3 + 1; b1 = 0; b2 = 0; b3 = 0; }
      else { // out
        if (R() < K_SHARE) { outs++; }
        else if (b1 && outs < 2 && R() < 0.15) { outs += 2; b1 = 0; if (outs < 3 && b3 && R() < 0.3) { runs++; b3 = 0; } }
        else {
          outs++;
          if (outs < 3) {
            if (b3 && R() < 0.5) { runs++; b3 = 0; }
            if (b2 && !b3 && R() < 0.3) { b3 = 1; b2 = 0; }
          }
        }
      }
      if (walkoffNeed > 0 && runs >= walkoffNeed) return runs;
    }
    return runs;
  }
  M.bbSim = function (st, ex, n, seed) {
    const R = rng(seed || 7);
    const lg = ex.lg || 4.45;
    const cumH = M.bbRates(ex.eH / lg), cumA = M.bbRates(ex.eA / lg);
    let wins = 0; const md = new Map(); let sumH = 0, sumA = 0;
    for (let i = 0; i < n; i++) {
      let inn = st.inning, top = st.half === 'top', outs = st.outs || 0;
      let b1 = st.b1 ? 1 : 0, b2 = st.b2 ? 1 : 0, b3 = st.b3 ? 1 : 0;
      let hs = st.hs, as = st.as;
      let done = false;
      if (!top && inn >= 9 && hs > as) done = true;
      while (!done) {
        if (top) {
          as += halfInning(R, cumA, outs, b1, b2, b3, 0);
          if (inn >= 9 && hs > as) { done = true; break; }
          top = false;
        } else {
          const need = inn >= 9 ? as - hs + 1 : 0;
          hs += halfInning(R, cumH, outs, b1, b2, b3, need > 0 ? need : 0);
          if (inn >= 9 && hs !== as) { done = true; break; }
          top = true; inn++;
          if (inn > 25) { if (R() < 0.5) hs++; else as++; done = true; break; }
        }
        outs = 0; b1 = 0; b3 = 0; b2 = inn >= 10 ? 1 : 0; // extra-inning runner on 2nd
      }
      if (hs > as) wins++;
      const d = hs - as; md.set(d, (md.get(d) || 0) + 1);
      sumH += hs; sumA += as;
    }
    const dist = [...md.entries()].sort((x, y) => x[0] - y[0]).map(([d, c]) => [d, c / n]);
    const pH = wins / n;
    return { pH, pA: 1 - pH, pD: 0, dist, fH: sumH / n, fA: sumA / n, n };
  };

  /* ---------- hockey: Poisson with power play / empty net ---------- */
  M.hkLive = function (st, ex, o) {
    o = o || {};
    const rH = ex.eH / 60, rA = ex.eA / 60;
    const otP = (rh, ra) => o.playoff ? rh / (rh + ra) : (() => { const a = rh * 1.5, b = ra * 1.5; const g = 1 - Math.exp(-(a + b) * 5); return g * a / (a + b) + (1 - g) * 0.5; })();
    if (st.period > 3) { // overtime, sudden death
      const lead = st.hs - st.as;
      if (lead !== 0) return { pH: lead > 0 ? 1 : 0, pA: lead > 0 ? 0 : 1, pD: 0, dist: [[lead, 1]], fH: st.hs, fA: st.as, matrix: null };
      const t = clamp(st.clock, 0, 1200) / 60; const a = rH * (o.playoff ? 1 : 1.5), b = rA * (o.playoff ? 1 : 1.5);
      const g = 1 - Math.exp(-(a + b) * t);
      const pH = o.playoff ? a / (a + b) : g * a / (a + b) + (1 - g) * 0.5;
      return { pH, pA: 1 - pH, pD: 0, dist: [[1, pH], [-1, 1 - pH]], fH: st.hs + pH, fA: st.as + 1 - pH, matrix: null };
    }
    let rem = (3 - st.period) * 20 + clamp(st.clock, 0, 1200) / 60;
    let lamH = 0, lamA = 0;
    if (st.pp && st.ppSec > 0) {
      // 5-on-4: about 2.1x the attacking team's even-strength rate; 5-on-3 (ppMen 2): about 4.6x
      const m = Math.min(st.ppSec / 60, rem), two = st.ppMen === 2, up = two ? 4.6 : 2.1, dn = two ? 0.12 : 0.25;
      if (st.pp === 'home') { lamH += rH * up * m; lamA += rA * dn * m; } else { lamA += rA * up * m; lamH += rH * dn * m; }
      rem -= m;
    }
    let en = st.en, enMin = st.enMin;
    const lead0 = st.hs - st.as;
    if (!en && !st.noPull && st.period === 3 && rem <= 5 && Math.abs(lead0) >= 1 && Math.abs(lead0) <= 2) {
      en = lead0 > 0 ? 'away' : 'home'; enMin = Math.abs(lead0) === 1 ? 1.3 : 2.2; // trailing team pulls its goalie late
    }
    if (en) {
      const m = Math.min(rem, isFinite(enMin) ? enMin : 2.5);
      if (en === 'home') { lamH += rH * 2.8 * m; lamA += 0.2 * m; } else { lamA += rA * 2.8 * m; lamH += 0.2 * m; }
      rem -= m;
    }
    lamH += rH * rem; lamA += rA * rem;
    const K = 14, ph = poisPmf(lamH, K), pa = poisPmf(lamA, K);
    let win = 0, tie = 0, loss = 0; const md = new Map(); const matrix = [];
    for (let i = 0; i <= K; i++) {
      for (let j = 0; j <= K; j++) {
        const p = ph[i] * pa[j]; if (p < 1e-9) continue;
        const d = st.hs + i - st.as - j;
        if (d > 0) win += p; else if (d < 0) loss += p; else tie += p;
        md.set(d, (md.get(d) || 0) + p);
        matrix.push([st.hs + i, st.as + j, p]);
      }
    }
    const pOT = otP(rH, rA);
    const pH = win + tie * pOT;
    return { pH, pA: 1 - pH, pD: 0, pOT: tie, dist: [...md.entries()].sort((x, y) => x[0] - y[0]), fH: st.hs + lamH, fA: st.as + lamA, matrix, lamH, lamA };
  };

  /* ---------- soccer: Poisson with red cards, Dixon–Coles ---------- */
  function dcTau(i, j, l, m, rho) {
    if (i === 0 && j === 0) return 1 - l * m * rho;
    if (i === 0 && j === 1) return 1 + l * rho;
    if (i === 1 && j === 0) return 1 + m * rho;
    if (i === 1 && j === 1) return 1 - rho;
    return 1;
  }
  function scoreGrid(st, lamH, lamA, useDC) {
    const K = 10, ph = poisPmf(lamH, K), pa = poisPmf(lamA, K);
    let H = 0, D = 0, A = 0, tot = 0; const matrix = []; const md = new Map();
    for (let i = 0; i <= K; i++) for (let j = 0; j <= K; j++) {
      let p = ph[i] * pa[j];
      if (useDC) p *= dcTau(i, j, lamH, lamA, -0.08);
      tot += p; matrix.push([st.hs + i, st.as + j, p]);
    }
    for (const c of matrix) { c[2] /= tot; const d = c[0] - c[1]; if (d > 0) H += c[2]; else if (d < 0) A += c[2]; else D += c[2]; md.set(d, (md.get(d) || 0) + c[2]); }
    return { H, D, A, matrix, dist: [...md.entries()].sort((x, y) => x[0] - y[0]) };
  }
  M.scLive = function (st, ex) {
    const full = 94, rH = ex.eH / full, rA = ex.eA / full;
    const ko = !!st.ko; // knockout: a draw after 90' goes to 30' of extra time, then penalties (coin flip)
    const minute = clamp(st.minute || 0, 0, ko ? 120 : 130);
    const inET = ko && minute > 90;
    const rem = inET ? Math.max(0.5, 122 - minute) : minute < 90 ? full - minute : Math.max(0.5, 95 - minute);
    const rh = st.redH || 0, ra = st.redA || 0;
    const fH = Math.pow(0.68, rh) * Math.pow(1.25, ra), fA = Math.pow(0.68, ra) * Math.pow(1.25, rh);
    const lamH = rH * fH * rem, lamA = rA * fA * rem;
    const g = scoreGrid(st, lamH, lamA, minute === 0 && st.hs === 0 && st.as === 0);
    let best = g.matrix[0]; for (const c of g.matrix) if (c[2] > best[2]) best = c;
    const out = { pH: g.H, pD: g.D, pA: g.A, dist: g.dist, matrix: g.matrix, fH: st.hs + lamH, fA: st.as + lamA, lamH, lamA, likely: best };
    if (ko) {
      let pET = 0, pPens = g.D, pH = g.H;
      if (!inET) {
        // level after 90' -> extra time from 0-0 relative, 32 minutes of play incl. stoppage, then penalties
        const e = scoreGrid({ hs: 0, as: 0 }, rH * fH * 32, rA * fA * 32, false);
        pET = g.D; pPens = g.D * e.D; pH = g.H + g.D * (e.H + e.D * 0.5);
      } else pH = g.H + g.D * 0.5;
      Object.assign(out, { pH, pA: 1 - pH, pD: 0, pET, pPens, ko: true });
    }
    return out;
  };
  // fit expected goals to a 3-way line (grid search)
  M.scFit = function (pH, pD, pA) {
    const s = pH + pD + pA; if (!(s > 0)) return null; pH /= s; pD /= s; pA /= s;
    let best = null;
    for (let h = 0.2; h <= 3.6; h += 0.05) for (let a = 0.2; a <= 3.2; a += 0.05) {
      const g = scoreGrid({ hs: 0, as: 0 }, h, a, true);
      const e = (g.H - pH) ** 2 + (g.D - pD) ** 2 + (g.A - pA) ** 2;
      if (!best || e < best.e) best = { e, eH: h, eA: a };
    }
    return best;
  };

  /* ---------- tennis: Markov chain ---------- */
  // probability that the server wins the game from point score (a = server pts, b = receiver pts)
  function gameP(p, a, b) {
    const q = 1 - p;
    if (a >= 4 && a - b >= 2) return 1; if (b >= 4 && b - a >= 2) return 0;
    if (a >= 3 && b >= 3) { const deuce = p * p / (p * p + q * q); if (a === b) return deuce; return a > b ? p + q * deuce : p * deuce; }
    return p * gameP(p, a + 1, b) + q * gameP(p, a, b + 1);
  }
  M.tn = {};
  M.tn.gameP = gameP;
  // tiebreak: P(A wins) from (a,b) points; sA/sB: point-win prob on own serve; firstA: A served first point of TB
  function tbP(sA, sB, a, b, firstA, memo) {
    if (a >= 7 && a - b >= 2) return 1; if (b >= 7 && b - a >= 2) return 0;
    if (a >= 6 && b >= 6 && a === b) { const x = sA * (1 - sB), y = (1 - sA) * sB; return x / (x + y); }
    const key = a * 64 + b; if (memo.has(key)) return memo.get(key);
    const n = a + b + 1; // index of next point
    const aServes = n === 1 ? firstA : (Math.floor((n - 2) / 2) % 2 === 0 ? !firstA : firstA);
    const pA = aServes ? sA : 1 - sB;
    const v = pA * tbP(sA, sB, a + 1, b, firstA, memo) + (1 - pA) * tbP(sA, sB, a, b + 1, firstA, memo);
    memo.set(key, v); return v;
  }
  // set: P(A wins set) from games (gA,gB) at the start of a game with server aServes
  function setP(sA, sB, gA, gB, aServes, memo) {
    if (gA >= 6 && gA - gB >= 2) return 1; if (gB >= 6 && gB - gA >= 2) return 0;
    if (gA === 7) return 1; if (gB === 7) return 0;
    if (gA === 6 && gB === 6) return tbP(sA, sB, 0, 0, aServes, new Map());
    const key = gA * 32 + gB * 2 + (aServes ? 1 : 0); if (memo.has(key)) return memo.get(key);
    const hold = aServes ? gameP(sA, 0, 0) : 1 - gameP(sB, 0, 0);
    const v = hold * setP(sA, sB, gA + 1, gB, !aServes, memo) + (1 - hold) * setP(sA, sB, gA, gB + 1, !aServes, memo);
    memo.set(key, v); return v;
  }
  function matchP(pSet, sa, sb, need, memo) {
    if (sa >= need) return 1; if (sb >= need) return 0;
    const key = sa * 8 + sb; if (memo.has(key)) return memo.get(key);
    const v = pSet * matchP(pSet, sa + 1, sb, need, memo) + (1 - pSet) * matchP(pSet, sa, sb + 1, need, memo);
    memo.set(key, v); return v;
  }
  // full state: {bestOf, setsA, setsB, gA, gB, ptA, ptB, aServing}
  M.tn.live = function (sA, sB, st) {
    const need = Math.ceil((st.bestOf || 3) / 2);
    const pNewSet = 0.5 * (setP(sA, sB, 0, 0, true, new Map()) + setP(sA, sB, 0, 0, false, new Map()));
    const after = new Map();
    const matchFrom = (sa, sb) => matchP(pNewSet, sa, sb, need, after);
    const gA = st.gA || 0, gB = st.gB || 0, ptA = st.ptA || 0, ptB = st.ptB || 0, aSrv = st.aServing !== false;
    let pSetNow;
    if (gA === 6 && gB === 6) {
      // in tiebreak: approximate server of the first TB point as the player due to serve
      pSetNow = tbP(sA, sB, ptA, ptB, aSrv, new Map());
    } else {
      const hold = aSrv ? gameP(sA, ptA, ptB) : 1 - gameP(sB, ptB, ptA); // P(A wins current game)
      const memo = new Map();
      pSetNow = hold * setP(sA, sB, gA + 1, gB, !aSrv, memo) + (1 - hold) * setP(sA, sB, gA, gB + 1, !aSrv, memo);
    }
    const p = pSetNow * matchFrom((st.setsA || 0) + 1, st.setsB || 0) + (1 - pSetNow) * matchFrom(st.setsA || 0, (st.setsB || 0) + 1);
    return { pA: p, pB: 1 - p, pSet: pSetNow, pNewSet, pHold: aSrv ? gameP(sA, 0, 0) : gameP(sB, 0, 0) };
  };

  /* ---------- golf: remaining-holes Monte Carlo ---------- */
  M.golfSim = function (players, n, seed) {
    // players: [{toPar, holesLeft}]
    const R = rng(seed || 11); const wins = new Float64Array(players.length);
    const sd = 0.72; // strokes-to-par SD per hole
    for (let s = 0; s < n; s++) {
      let best = Infinity, bestIdx = [];
      for (let i = 0; i < players.length; i++) {
        const pl = players[i]; let x = pl.toPar;
        if (pl.holesLeft > 0) { let u = 0, v = 0; while (u === 0) u = R(); while (v === 0) v = R(); x += Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd * Math.sqrt(pl.holesLeft); }
        if (x < best - 1e-9) { best = x; bestIdx = [i]; } else if (Math.abs(x - best) < 0.5 && pl.holesLeft === 0 && players[bestIdx[0]].holesLeft === 0) bestIdx.push(i);
      }
      for (const i of bestIdx) wins[i] += 1 / bestIdx.length;
    }
    return Array.from(wins, w => w / n);
  };

  /* ---------- season projection vs league-average opponents ---------- */
  M.seasonSim = function (sp, teams, o) {
    // teams: [{key, net, w, l, t, pts, gp, remaining, group}] ; o: {n, seed, kind}
    const n = o.n || 1500, R = rng(o.seed || 5);
    const res = teams.map(() => ({ sum: 0, sq: 0, vals: [] }));
    const rankCounts = teams.map(() => new Float64Array(teams.length + 1));
    const groups = {}; teams.forEach((t, i) => { (groups[t.group || 'all'] = groups[t.group || 'all'] || []).push(i); });
    const probs = teams.map(t => {
      if (sp.kind === 'sc') {
        const lg = o.lg || sp.lg; const eH = Math.max(0.15, lg + t.net / 2), eA = Math.max(0.15, lg - t.net / 2);
        const g = scoreGrid({ hs: 0, as: 0 }, eH, eA, true); return { w: g.H, d: g.D };
      }
      const p = Phi(t.net / sp.sigma); return { w: p, d: 0 };
    });
    const vals = new Float64Array(teams.length);
    for (let s = 0; s < n; s++) {
      for (let i = 0; i < teams.length; i++) {
        const t = teams[i], pr = probs[i];
        let W = t.w, D = t.t || 0;
        for (let g = 0; g < t.remaining; g++) { const u = R(); if (u < pr.w) W++; else if (u < pr.w + pr.d) D++; }
        const v = sp.kind === 'sc' ? (isFinite(t.pts) ? t.pts - 3 * t.w - (t.t || 0) : 0) + 3 * W + D : W + 0.5 * D;
        vals[i] = v + R() * 1e-3; res[i].sum += v; res[i].vals.push(v);
      }
      for (const key in groups) {
        const idx = groups[key].slice().sort((x, y) => vals[y] - vals[x]);
        idx.forEach((ti, r) => { rankCounts[ti][r + 1] += 1; });
      }
    }
    return teams.map((t, i) => {
      const v = res[i].vals.sort((a, b) => a - b);
      return { key: t.key, mean: res[i].sum / n, p10: v[Math.floor(n * 0.1)], p90: v[Math.floor(n * 0.9)], rank: Array.from(rankCounts[i], c => c / n) };
    });
  };

  root.PM = M;
})(typeof window !== 'undefined' ? window : globalThis);
