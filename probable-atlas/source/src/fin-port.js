/* Probable Atlas · Finance: portfolio lab engine (assumptions, frontier, risk parity, Monte Carlo, stress tests, factor shocks, backtest). */
const FP = (() => {
  const { ok } = K;
  const LAB = [
    { id: 'US', px: 'SPY', name: 'US stocks', short: 'US stocks', cls: 'eq' },
    { id: 'INTL', px: 'EFA', name: 'Developed ex-US stocks', short: 'Intl stocks', cls: 'eq' },
    { id: 'EM', px: 'EEM', name: 'Emerging-market stocks', short: 'EM stocks', cls: 'eq' },
    { id: 'BND', px: 'AGG', name: 'US bonds (aggregate)', short: 'US bonds', cls: 'bd' },
    { id: 'LTT', px: 'TLT', name: 'Long-term Treasuries', short: 'Long Treasuries', cls: 'bd' },
    { id: 'TIPS', px: 'TIP', name: 'Inflation-protected Treasuries', short: 'TIPS', cls: 'bd' },
    { id: 'CASH', px: 'BIL', name: 'Cash (Treasury bills)', short: 'Cash', cls: 'bd' },
    { id: 'GOLD', px: 'GLD', name: 'Gold', short: 'Gold', cls: 'ra' },
    { id: 'REIT', px: 'VNQ', name: 'Real estate (REITs)', short: 'REITs', cls: 'ra' },
    { id: 'CMDTY', px: 'DBC', name: 'Broad commodities', short: 'Commodities', cls: 'ra' },
    { id: 'BTC', px: 'BTC-USD', name: 'Bitcoin', short: 'Bitcoin', cls: 'cx' }
  ];
  const IDS = LAB.map(a => a.id), NA = LAB.length;
  const PRESETS = [
    ['Conservative', { US: 20, INTL: 5, BND: 45, TIPS: 10, CASH: 15, GOLD: 5 }],
    ['Balanced 60/40', { US: 60, BND: 40 }],
    ['Global 60/40', { US: 40, INTL: 15, EM: 5, BND: 35, TIPS: 5 }],
    ['Growth 80/20', { US: 55, INTL: 15, EM: 10, BND: 20 }],
    ['All-weather style', { US: 30, LTT: 40, BND: 15, GOLD: 7.5, CMDTY: 7.5 }],
    ['Permanent portfolio', { US: 25, LTT: 25, CASH: 25, GOLD: 25 }],
    ['All stocks', { US: 70, INTL: 20, EM: 10 }]
  ];
  const vec = obj => IDS.map(id => (obj[id] || 0));

  /* ---------------- monthly returns (complete months only) ---------------- */
  let MR = null;
  function monthly() {
    if (MR) return MR;
    const me = F.monthEnds(); let ix = me.ix.slice(), keys = me.keys.slice();
    const lastIso = F.CAL[F.N - 1], d = new Date(lastIso + 'T12:00:00Z'), nextDay = new Date(d.getTime() + 864e5 * 4);
    if (ix[ix.length - 1] === F.N - 1 && nextDay.getUTCMonth() === d.getUTCMonth()) { ix.pop(); keys.pop(); } // current month not finished
    const R = LAB.map(a => F.sampledRets(a.px, ix));
    return (MR = { ix, keys, R });
  }

  /* ---------------- linear algebra helpers ---------------- */
  function jacobiEig(A) { // symmetric eigen-decomposition (small matrices)
    const n = A.length, a = A.map(r => r.slice()), V = A.map((_, i) => A.map((_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
      if (off < 1e-14) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    return { vals: a.map((r, i) => r[i]), V };
  }
  function nearPSD(C) { // clip negative eigenvalues, restore unit diagonal
    const { vals, V } = jacobiEig(C), n = C.length;
    const M = C.map((_, i) => C.map((_, j) => { let s = 0; for (let k = 0; k < n; k++) s += V[i][k] * Math.max(vals[k], 1e-6) * V[j][k]; return s; }));
    return M.map((r, i) => r.map((v, j) => v / Math.sqrt(M[i][i] * M[j][j])));
  }
  const quad = (w, Sg) => { let s = 0; for (let i = 0; i < w.length; i++) { if (!w[i]) continue; for (let j = 0; j < w.length; j++) s += w[i] * Sg[i][j] * w[j]; } return s; };
  const mv = (Sg, w) => Sg.map(r => r.reduce((s, v, j) => s + v * w[j], 0));
  function projSimplex(v, mask, cap = 1) { // Euclidean projection onto {0 <= w <= cap, sum w = 1} over allowed assets (bisection on the shift)
    const n = v.length; let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) { if (v[i] < lo) lo = v[i]; if (v[i] > hi) hi = v[i]; }
    lo -= 1;
    for (let it = 0; it < 48; it++) {
      const mid = (lo + hi) / 2; let s = 0;
      for (let i = 0; i < n; i++) if (!mask || mask[i]) { const x = v[i] - mid; s += x <= 0 ? 0 : x >= cap ? cap : x; }
      if (s > 1) lo = mid; else hi = mid;
    }
    const th = (lo + hi) / 2, out = new Array(n);
    for (let i = 0; i < n; i++) { const x = v[i] - th; out[i] = (!mask || mask[i]) ? (x <= 0 ? 0 : x >= cap ? cap : x) : 0; }
    return out;
  }
  /* ---------------- risk model: volatilities and correlations from monthly returns since 2008 ---------------- */
  let RISKM = null;
  function riskModel() {
    if (RISKM) return RISKM;
    const m = monthly(), k0 = m.keys.findIndex(k => k >= '2008-01'), R = m.R.map(r => Array.from(r).slice(k0));
    const vol = R.map(r => S.sd(r.filter(ok)) * Math.sqrt(12));
    const C0 = R.map((a, i) => R.map((b, j) => { if (i === j) return 1; const x = [], y = []; for (let t = 0; t < a.length; t++) if (ok(a[t]) && ok(b[t])) { x.push(a[t]); y.push(b[t]); } return S.corr(x, y) || 0; }));
    let avg = 0, cnt = 0; for (let i = 0; i < NA; i++) for (let j = i + 1; j < NA; j++) { avg += C0[i][j]; cnt++; } avg /= cnt;
    const delta = 0.2, Cs = C0.map((r, i) => r.map((v, j) => (i === j ? 1 : (1 - delta) * v + delta * avg)));
    const C = nearPSD(Cs), Sg = C.map((r, i) => r.map((v, j) => v * vol[i] * vol[j]));
    return (RISKM = { vol, C, Sg, raw: C0, from: m.keys[k0], to: m.keys[m.keys.length - 1], months: R[0].length });
  }

  /* ---------------- expected returns (compound, nominal, % a year) ---------------- */
  function assumptions(mode = 'forward') {
    const y = id => F.lastVal(id), be = y('T10YIE'), cp = FM.cape(), hist = 6.8;
    if (mode === 'history') {
      const m = monthly();
      return LAB.map((a, i) => { const r = Array.from(m.R[i]).filter(ok), g = Math.exp(S.mean(r.map(v => Math.log(1 + v))) * 12) - 1; return { id: a.id, er: g * 100, src: `Average yearly return of ${a.px} since ${F.CAL[F.ser(a.px).s].slice(0, 4)}` }; });
    }
    const usReal = cp ? 0.5 * cp.fc + 0.5 * hist : hist;
    const rows = {
      US: [usReal + be, `Half the CAPE model (${K.num(cp ? cp.fc : NaN, 1)}% real) and half the 1871-today average (${hist}% real), plus ${K.num(be, 1)}% expected inflation`],
      INTL: [4.5 + be, 'Long-run real return of world ex-US stocks (about 4.5% since 1900) plus expected inflation; no valuation data in this module'],
      EM: [5.0 + be, 'Assumption: a little above developed ex-US for extra risk, plus expected inflation'],
      BND: [y('DGS5') + 0.4, `Approximate index yield: 5-year Treasury (${K.num(y('DGS5'), 2)}%) plus 0.4 pp for mortgages and corporates`],
      LTT: [y('DGS20'), `Today's 20-year Treasury yield (${K.num(y('DGS20'), 2)}%); the starting yield is the best guide to a bond's 10-year return`],
      TIPS: [y('DFII10') + be, `10-year real yield (${K.num(y('DFII10'), 2)}%) plus expected inflation`],
      CASH: [y('DGS2'), `2-year Treasury yield (${K.num(y('DGS2'), 2)}%) as the market's guess at average cash rates`],
      GOLD: [0.5 + be, 'Assumption: gold has earned roughly 0 to 1% a year above inflation over very long periods'],
      REIT: [usReal + be, 'Assumption: same as US stocks (REITs are equities)'],
      CMDTY: [y('DGS3MO'), 'Assumption: collateral (T-bill) return; no lasting premium from rolling futures'],
      BTC: [usReal + be, 'No reliable basis for an estimate; set equal to US stocks so risk, not hope, drives the result']
    };
    return LAB.map(a => ({ id: a.id, er: rows[a.id][0], src: rows[a.id][1] }));
  }

  /* ---------------- portfolio analytics ---------------- */
  function stats(w, er, rm) { // w: fractions; er: compound % a year
    rm = rm || riskModel();
    const G = er.map(v => v / 100), A = G.map((g, i) => g + rm.vol[i] ** 2 / 2);
    const mu = w.reduce((s, x, i) => s + x * A[i], 0), v2 = quad(w, rm.Sg), sig = Math.sqrt(Math.max(v2, 0)), g = mu - v2 / 2;
    const cash = er[IDS.indexOf('CASH')] / 100;
    const Sw = mv(rm.Sg, w), rc = w.map((x, i) => (v2 > 0 ? x * Sw[i] / v2 : 0));
    const dr = sig > 0 ? w.reduce((s, x, i) => s + x * rm.vol[i], 0) / sig : 1;
    const m = Math.log(1 + g), q = p => (Math.exp(m + S.normInv(p) * sig) - 1) * 100;
    return { er: g * 100, arith: mu * 100, vol: sig * 100, sharpe: sig > 0 ? (mu - cash) / sig : null, rc, dr, p5: q(0.05), p95: q(0.95), var95: -q(0.05) };
  }
  function frontier(er, opt = {}) {
    const rm = riskModel(), A = er.map((v, i) => v / 100 + rm.vol[i] ** 2 / 2), mask = opt.mask || IDS.map(id => id !== 'BTC'), cap = opt.cap || 0.6;
    const tr = rm.Sg.reduce((s, r, i) => s + r[i], 0);
    const solve = (gam, w0) => {
      let w = w0 ? w0.slice() : projSimplex(IDS.map(() => 1 / NA), mask, cap); const eta = 1 / (gam * tr + 1e-9);
      for (let it = 0; it < 250; it++) { const Sw = mv(rm.Sg, w), gr = A.map((a, i) => a - gam * Sw[i]); const nw = projSimplex(w.map((x, i) => x + eta * gr[i]), mask, cap); let d = 0; for (let i = 0; i < NA; i++) d += Math.abs(nw[i] - w[i]); w = nw; if (d < 1e-9) break; }
      return w;
    };
    const pts = []; let w = null;
    for (let k = 0; k <= 28; k++) { const gam = Math.pow(10, 3.3 - k * 0.13); w = solve(gam, w); const s = stats(w, er, rm); pts.push({ w, vol: s.vol, er: s.er, arith: s.arith, sharpe: s.sharpe }); }
    pts.sort((a, b) => a.vol - b.vol);
    const fr = []; for (const p of pts) if (!fr.length || p.arith > fr[fr.length - 1].arith + 1e-6) fr.push(p);
    const minVar = fr[0], maxSharpe = fr.reduce((b, p) => (p.sharpe > b.sharpe ? p : b), fr[0]);
    return { pts: fr, minVar, maxSharpe };
  }
  function riskParity(mask) {
    const rm = riskModel(); mask = mask || IDS.map(id => id !== 'BTC' && id !== 'CASH');
    let w = IDS.map((_, i) => (mask[i] ? 1 / rm.vol[i] : 0)); let s = w.reduce((a, b) => a + b, 0); w = w.map(x => x / s);
    const n = mask.filter(Boolean).length;
    for (let it = 0; it < 800; it++) { const Sw = mv(rm.Sg, w), v2 = quad(w, rm.Sg); w = w.map((x, i) => (mask[i] ? x * Math.pow((v2 / n) / Math.max(x * Sw[i], 1e-12), 0.5) : 0)); s = w.reduce((a, b) => a + b, 0); w = w.map(x => x / s); }
    return w;
  }
  function cloud(er, n = 1600, seed = 5) {
    const rm = riskModel(), R = K.rng(seed), out = [];
    const gam = () => { const u = R(); return -Math.log(Math.max(u, 1e-12)); }; // Dirichlet(1) via exponentials, sparsified
    for (let k = 0; k < n; k++) {
      const w = IDS.map(id => (id !== 'BTC' && R() < 0.55 ? gam() : 0)); const s = w.reduce((a, b) => a + b, 0); if (!s) continue;
      const st = stats(w.map(x => x / s), er, rm); out.push({ vol: st.vol, er: st.er, sharpe: st.sharpe });
    }
    return out;
  }

  /* ---------------- Monte Carlo projection (fat-tailed, monthly) ---------------- */
  function simulate(o) {
    // o: { er, vol (decimal %), start, monthly, years, goal, real (bool), infl, sims, seed }
    const sims = o.sims || 1500, Mn = Math.round(o.years * 12), R = K.rng(o.seed || 11), kL = 0.85, kH = 1.87; // 10% of months drawn from a wider normal: same variance, fatter tails
    const m = Math.log(1 + o.er / 100) / 12, s = o.vol / 100 / Math.sqrt(12), infl = (o.infl || 0) / 100, im = Math.pow(1 + infl, 1 / 12);
    const yrs = Math.ceil(o.years), snap = Array.from({ length: yrs + 1 }, () => new Float64Array(sims)), ends = new Float64Array(sims), mdd = new Float64Array(sims);
    let hitGoal = 0, broke = 0, contribTot = 0;
    for (let p = 0; p < sims; p++) {
      let v = o.start, hi = v, dd = 0, defl = 1, c = o.monthly, dead = false;
      snap[0][p] = v;
      for (let t = 1; t <= Mn; t++) {
        const tz = R.norm() * (R() < 0.1 ? kH : kL);
        if (!dead) {
          v = v * Math.exp(m + s * tz) + c;
          if (v <= 0) { v = 0; dead = true; }
        }
        defl *= im; if (o.real) c *= im; // contributions or withdrawals keep pace with inflation
        if (v > hi) hi = v; else if (hi > 0) dd = Math.min(dd, v / hi - 1);
        if (t % 12 === 0) snap[t / 12][p] = o.real ? v / defl : v;
      }
      const endV = o.real ? v / defl : v; ends[p] = endV; mdd[p] = dd;
      if (o.goal && endV >= o.goal) hitGoal++; if (dead) broke++;
    }
    for (let t = 1; t <= Mn; t++) contribTot += o.monthly;
    const pct = (arr, q) => { const a = Float64Array.from(arr).sort(); return a[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))]; };
    const bands = snap.map((arr, y) => ({ y, p5: pct(arr, 0.05), p10: pct(arr, 0.1), p25: pct(arr, 0.25), p50: pct(arr, 0.5), p75: pct(arr, 0.75), p90: pct(arr, 0.9), p95: pct(arr, 0.95) }));
    return { bands, pGoal: o.goal ? hitGoal / sims : null, pBroke: broke / sims, median: pct(ends, 0.5), p10: pct(ends, 0.1), p90: pct(ends, 0.9), mddMed: pct(mdd, 0.5) * 100, mddBad: pct(mdd, 0.1) * 100, contrib: contribTot, sims };
  }

  /* ---------------- historical backtest (monthly rebalanced) ---------------- */
  function backtest(w) {
    const m = monthly(), held = IDS.map((_, i) => w[i] > 0);
    let k0 = 0; for (let i = 0; i < NA; i++) if (held[i]) { const f = Array.from(m.R[i]).findIndex(ok); k0 = Math.max(k0, f); }
    const run = ws => { const out = []; let v = 1; for (let k = k0; k < m.keys.length; k++) { let r = 0; for (let i = 0; i < NA; i++) if (ws[i]) r += ws[i] * (ok(m.R[i][k]) ? m.R[i][k] : 0); v *= 1 + r; out.push({ key: m.keys[k], r, v }); } return out; };
    const p = run(w), spy = run(vec({ US: 1 })), b6040 = run(vec({ US: 0.6, BND: 0.4 }));
    const summ = arr => { const rs = arr.map(o => o.r), yrs = rs.length / 12; let hi = 1, mdd = 0; arr.forEach(o => { hi = Math.max(hi, o.v); mdd = Math.min(mdd, o.v / hi - 1); }); let worst12 = Infinity; for (let k = 12; k <= arr.length; k++) { const a = k > 12 ? arr[k - 13].v : 1; worst12 = Math.min(worst12, arr[k - 1].v / a - 1); } return { cagr: (Math.pow(arr[arr.length - 1].v, 1 / yrs) - 1) * 100, vol: S.sd(rs) * Math.sqrt(12) * 100, mdd: mdd * 100, worst12: worst12 * 100, end: arr[arr.length - 1].v }; };
    const x = arr => arr.map(o => [F.ymX(o.key, 0) + 0.5 / 12, o.v * 10000]);
    return { from: m.keys[k0], to: m.keys[m.keys.length - 1], p: summ(p), spy: summ(spy), b6040: summ(b6040), curve: { p: x(p), spy: x(spy), b6040: x(b6040) } };
  }

  /* ---------------- stress tests: what each asset did during past sell-offs (proxies before an ETF existed) ---------------- */
  const STRESS = [
    ['1990 Gulf War', '1990-07-16', '1990-10-11'], ['1998 Russia & LTCM', '1998-07-17', '1998-10-08'], ['2000-02 dot-com bust', '2000-03-24', '2002-10-09'],
    ['2007-09 financial crisis', '2007-10-09', '2009-03-09'], ['2011 euro debt crisis', '2011-04-29', '2011-10-03'], ['2015-16 China & oil slump', '2015-05-21', '2016-02-11'],
    ['2018 Q4 sell-off', '2018-09-20', '2018-12-24'], ['2020 COVID crash', '2020-02-19', '2020-03-23'], ['2022 inflation & rate shock', '2022-01-03', '2022-10-12'], ['2025 tariff shock', '2025-02-19', '2025-04-08']
  ];
  function synthBond(yid, mat, a, b) { // total return of a constant-maturity par bond rebuilt from daily yields
    const y = F.ser(yid); if (!y || a < y.s || b > y.e) return null;
    let v = 1; for (let i = a + 1; i <= b; i++) { const y0 = y.v[i - 1] / 100, y1 = y.v[i] / 100, D = (1 / Math.max(y0, 1e-4)) * (1 - Math.pow(1 + y0 / 2, -2 * mat)), dt = (F.ORD[i] - F.ORD[i - 1]) / 365.25; v *= 1 + y0 * dt - D * (y1 - y0); }
    return (v - 1) * 100;
  }
  function assetWindow(id, a, b) { // % return of a lab asset between two calendar indices, with proxies
    const L = LAB.find(x => x.id === id), s = F.ser(L.px);
    if (s && a >= s.s && b <= s.e) return { r: (s.v[b] / s.v[a] - 1) * 100, src: L.px };
    const px = (pid, label) => { const t = F.ser(pid); return t && a >= t.s && b <= t.e ? { r: (t.v[b] / t.v[a] - 1) * 100, src: label } : null; };
    if (id === 'US') return px('^GSPC', 'S&P 500 index (price only)');
    if (id === 'BND') { const r = synthBond('DGS5', 5, a, b); return r == null ? null : { r, src: '5-year Treasury rebuilt from yields' }; }
    if (id === 'LTT') { const r = synthBond(F.has('DGS20') && F.ser('DGS20').s <= a ? 'DGS20' : 'DGS30', 20, a, b); return r == null ? null : { r, src: 'Long Treasury rebuilt from yields' }; }
    if (id === 'CASH') { const r = synthBond('DGS3MO', 0.25, a, b); return r == null ? null : { r, src: '3-month bill rebuilt from yields' }; }
    if (id === 'GOLD') return px('GC=F', 'Gold futures');
    return null;
  }
  function stress(w) {
    return STRESS.map(([name, d0, d1]) => {
      const a = F.idx(d0), b = F.idx(d1); let r = 0, miss = [], proxy = [];
      const per = LAB.map((L, i) => { const x = assetWindow(L.id, a, b); if (w[i] > 0) { if (!x) miss.push(L.short); else { r += w[i] * x.r; if (x.src !== L.px) proxy.push(L.short); } } return x; });
      const sp = (F.at('^GSPC', b) / F.at('^GSPC', a) - 1) * 100;
      return { name, d0, d1, sp, port: miss.length ? null : r, miss, proxy, per, months: (F.ORD[b] - F.ORD[a]) / 30.44 };
    });
  }

  /* ---------------- factor shocks: weekly betas over the last five years ---------------- */
  const FACTORS = [
    { k: 'eq', name: 'US stocks', unit: '%', id: 'SPY', lo: -40, hi: 30, step: 1 },
    { k: 'rates', name: '10-year yield', unit: 'pp', id: 'DGS10', lo: -2, hi: 2, step: 0.25 },
    { k: 'credit', name: 'Credit spread (Baa)', unit: 'pp', id: 'BAA10Y', lo: -1, hi: 3, step: 0.25 },
    { k: 'usd', name: 'US dollar (DXY)', unit: '%', id: 'DX-Y.NYB', lo: -15, hi: 15, step: 1 },
    { k: 'oil', name: 'Oil (WTI)', unit: '%', id: 'CL=F', lo: -60, hi: 80, step: 5 },
    { k: 'infl', name: 'Inflation expectations (10-year breakeven)', unit: 'pp', id: 'T10YIE', lo: -1, hi: 1.5, step: 0.25 }
  ];
  const SCEN = [
    ['Equity crash', { eq: -30, rates: -1, credit: 2.5, usd: 6, oil: -30, infl: -0.75 }],
    ['Stagflation', { eq: -15, rates: 1.25, credit: 1, usd: -4, oil: 50, infl: 1 }],
    ['Rate shock', { eq: -10, rates: 1.5, credit: 0.5, usd: 4, oil: 0, infl: 0.25 }],
    ['Recession', { eq: -22, rates: -1.5, credit: 2, usd: 3, oil: -35, infl: -0.5 }],
    ['Soft landing', { eq: 12, rates: -0.75, credit: -0.4, usd: -2, oil: -10, infl: -0.25 }],
    ['Dollar surge', { eq: -5, rates: 0.25, credit: 0.25, usd: 10, oil: -10, infl: -0.25 }],
    ['Oil spike', { eq: -6, rates: 0.25, credit: 0.5, usd: 1, oil: 60, infl: 0.6 }]
  ];
  let BETAS = null;
  function betas() {
    if (BETAS) return BETAS;
    const we = F.weekEnds().ix.slice(-262), fx = FACTORS.map(f => { const s = F.ser(f.id), out = []; for (let k = 1; k < we.length; k++) { const a = s.v[we[k - 1]], b = s.v[we[k]]; out.push(f.unit === '%' ? (b / a - 1) * 100 : b - a); } return out; });
    BETAS = LAB.map(L => {
      const s = F.ser(L.px), y = []; for (let k = 1; k < we.length; k++) { const a = s.v[we[k - 1]], b = s.v[we[k]]; y.push(ok(a) && ok(b) ? (b / a - 1) * 100 : NaN); }
      const X = y.map((_, t) => FACTORS.map((f, j) => fx[j][t]));
      const fit = S.ols(y, X, { robust: true });
      return fit ? { id: L.id, b: fit.b.slice(1), r2: fit.r2, n: fit.n } : { id: L.id, b: FACTORS.map(() => 0), r2: null, n: 0 };
    });
    return BETAS;
  }
  let FCOV = null;
  function factorCov() { // weekly factor changes over the last five years
    if (FCOV) return FCOV;
    const we = F.weekEnds().ix.slice(-262), fx = FACTORS.map(f => { const s = F.ser(f.id), out = []; for (let k = 1; k < we.length; k++) { const a = s.v[we[k - 1]], b = s.v[we[k]]; out.push(f.unit === '%' ? (b / a - 1) * 100 : b - a); } return out; });
    const k = FACTORS.length, mu = fx.map(a => S.mean(a.filter(ok)));
    const cov = fx.map((a, i) => fx.map((b, j) => { let s = 0, c = 0; for (let t = 0; t < a.length; t++) if (ok(a[t]) && ok(b[t])) { s += (a[t] - mu[i]) * (b[t] - mu[j]); c++; } return c > 1 ? s / (c - 1) : 0; }));
    return (FCOV = { cov, k });
  }
  function conditional(given) { // fill unspecified factors with their expected move given the specified ones (Gaussian conditional mean)
    const keys = FACTORS.map(f => f.k), Sk = keys.filter(k => given[k] != null && isFinite(given[k])), Uk = keys.filter(k => !Sk.includes(k));
    const out = {}; Sk.forEach(k => { out[k] = +given[k]; }); if (!Sk.length) return out;
    const { cov } = factorCov(), iS = Sk.map(k => keys.indexOf(k)), iU = Uk.map(k => keys.indexOf(k));
    const inv = S.inv(iS.map(a => iS.map(b => cov[a][b]))); if (!inv) return out;
    const x = Sk.map(k => out[k]), wv = inv.map(r => r.reduce((s, v, j) => s + v * x[j], 0));
    Uk.forEach((k, u) => { out[k] = iS.reduce((s, b, j) => s + cov[iU[u]][b] * wv[j], 0); });
    return out;
  }
  function shock(w, sh) { // sh: {eq, rates, ...}; returns per-asset and portfolio % moves (linear approximation)
    const B = betas(), x = FACTORS.map(f => sh[f.k] || 0);
    const per = B.map(b => ({ id: b.id, r: b.b.reduce((s, v, j) => s + v * x[j], 0), r2: b.r2 }));
    const port = per.reduce((s, p, i) => s + w[i] * p.r, 0);
    const parts = FACTORS.map((f, j) => ({ k: f.k, name: f.name, c: B.reduce((s, b, i) => s + w[i] * b.b[j] * x[j], 0) }));
    return { per, port, parts };
  }

  return { LAB, IDS, PRESETS, vec, monthly, riskModel, assumptions, stats, frontier, riskParity, cloud, simulate, backtest, STRESS, stress, assetWindow, FACTORS, SCEN, betas, shock, conditional, factorCov, jacobiEig, projSimplex };
})();
