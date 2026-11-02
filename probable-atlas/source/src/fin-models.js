/* Probable Atlas · Finance: predictive and risk models. Every model reports how it would have done out of sample. */
const FM = (() => {
  const { ok } = K;
  const memo = fn => { let v = null, done = false; return () => { if (!done) { v = fn(); done = true; } return v; }; };
  const T252 = 252;

  /* ---------------- generic optimizer: Nelder-Mead ---------------- */
  function nelderMead(f, x0, opt = {}) {
    const n = x0.length, step = opt.step || 0.5, maxIt = opt.maxIt || 400, tol = opt.tol || 1e-9;
    let simplex = [x0.slice()].concat(x0.map((_, i) => { const x = x0.slice(); x[i] += step; return x; }));
    let vals = simplex.map(f);
    for (let it = 0; it < maxIt; it++) {
      const ord = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
      simplex = ord.map(i => simplex[i]); vals = ord.map(i => vals[i]);
      if (Math.abs(vals[n] - vals[0]) < tol * (Math.abs(vals[0]) + tol)) break;
      const c = new Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += simplex[i][j] / n;
      const pt = (a, t) => c.map((cj, j) => cj + t * (a[j] - cj));
      const xr = pt(simplex[n], -1), fr = f(xr);
      if (fr < vals[0]) { const xe = pt(simplex[n], -2), fe = f(xe); if (fe < fr) { simplex[n] = xe; vals[n] = fe; } else { simplex[n] = xr; vals[n] = fr; } }
      else if (fr < vals[n - 1]) { simplex[n] = xr; vals[n] = fr; }
      else {
        const xc = fr < vals[n] ? pt(simplex[n], -0.5) : pt(simplex[n], 0.5), fc = f(xc);
        if (fc < Math.min(fr, vals[n])) { simplex[n] = xc; vals[n] = fc; }
        else { for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j])); vals[i] = f(simplex[i]); } }
      }
    }
    const b = vals.indexOf(Math.min(...vals));
    return { x: simplex[b], f: vals[b] };
  }
  const chi2p1 = x => ok(x) && x > 0 ? 1 - erf(Math.sqrt(x / 2)) : 1; // p-value, chi-square with 1 df
  function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }

  /* ---------------- 1) Market regimes: 3-state Gaussian hidden Markov model on weekly S&P 500 returns ---------------- */
  const REG_NAMES = ['Calm', 'Choppy', 'Stress'];
  const REG_COL = ['var(--s3)', 'var(--s4)', 'var(--s8)'];
  function hmmRun(x, th) { // forward-backward with scaling on flat typed arrays (3 states)
    const n = x.length, Kn = 3, al = new Float64Array(n * Kn), be = new Float64Array(n * Kn), B = new Float64Array(n * Kn), c = new Float64Array(n);
    const A = th.A, mu = th.mu, sd = th.sd, nrm = sd.map(v => 1 / (v * 2.5066282746310002)), iv = sd.map(v => 1 / (2 * v * v));
    for (let t = 0; t < n; t++) {
      const o = t * Kn; let cs = 0;
      for (let k = 0; k < Kn; k++) {
        const d = x[t] - mu[k]; B[o + k] = Math.exp(-d * d * iv[k]) * nrm[k] + 1e-300;
        let s = 0; if (t === 0) s = th.pi[k]; else { const p = o - Kn; s = al[p] * A[0][k] + al[p + 1] * A[1][k] + al[p + 2] * A[2][k]; }
        al[o + k] = s * B[o + k]; cs += al[o + k];
      }
      c[t] = cs; for (let k = 0; k < Kn; k++) al[o + k] /= cs;
    }
    for (let k = 0; k < Kn; k++) be[(n - 1) * Kn + k] = 1;
    for (let t = n - 2; t >= 0; t--) { const o = t * Kn, q = o + Kn; for (let j = 0; j < Kn; j++) be[o + j] = (A[j][0] * B[q] * be[q] + A[j][1] * B[q + 1] * be[q + 1] + A[j][2] * B[q + 2] * be[q + 2]) / c[t + 1]; }
    const ga = new Float64Array(n * Kn);
    for (let t = 0; t < n; t++) { const o = t * Kn; let s = 0; for (let k = 0; k < Kn; k++) { ga[o + k] = al[o + k] * be[o + k]; s += ga[o + k]; } for (let k = 0; k < Kn; k++) ga[o + k] /= s; }
    const xi = [new Float64Array(Kn), new Float64Array(Kn), new Float64Array(Kn)];
    for (let t = 0; t < n - 1; t++) { const o = t * Kn, q = o + Kn, ic = 1 / c[t + 1]; for (let j = 0; j < Kn; j++) { const a = al[o + j] * ic; for (let k = 0; k < Kn; k++) xi[j][k] += a * A[j][k] * B[q + k] * be[q + k]; } }
    let ll = 0; for (let t = 0; t < n; t++) ll += Math.log(c[t]);
    const row = (arr, t) => [arr[t * Kn], arr[t * Kn + 1], arr[t * Kn + 2]];
    return { al, ga, ll, xi, n, filtAt: t => row(al, t), smoothAt: t => row(ga, t) };
  }
  function hmmFit(x) {
    const Kn = 3, m0 = S.mean(x), s0 = S.sd(x), n = x.length;
    const inits = [
      { mu: [m0 + 0.2 * s0, m0, m0 - 0.6 * s0], sd: [0.55 * s0, 1.0 * s0, 2.3 * s0] },
      { mu: [m0, m0, m0], sd: [0.65 * s0, 1.2 * s0, 2.0 * s0] },
      { mu: [m0 + 0.1 * s0, m0 - 0.1 * s0, m0 - 0.3 * s0], sd: [0.7 * s0, 1.4 * s0, 3.0 * s0] }
    ];
    let best = null;
    for (const ini of inits) {
      let th = { mu: ini.mu.slice(), sd: ini.sd.slice(), pi: [0.4, 0.4, 0.2], A: [[0.95, 0.04, 0.01], [0.05, 0.9, 0.05], [0.02, 0.1, 0.88]] };
      let prev = -Infinity, run = null;
      for (let it = 0; it < 300; it++) {
        run = hmmRun(x, th);
        if (run.ll - prev < 1e-8 * Math.abs(run.ll)) break; prev = run.ll;
        const g = run.ga, A = run.xi.map(r => { const s = r[0] + r[1] + r[2]; return [r[0] / s, r[1] / s, r[2] / s]; });
        const mu = [], sd = [];
        for (let k = 0; k < Kn; k++) { let w = 0, m = 0; for (let t = 0; t < n; t++) { w += g[t * Kn + k]; m += g[t * Kn + k] * x[t]; } m /= w; let v = 0; for (let t = 0; t < n; t++) { const d = x[t] - m; v += g[t * Kn + k] * d * d; } mu.push(m); sd.push(Math.max(Math.sqrt(v / w), 0.002)); }
        th = { mu, sd, A, pi: [g[0], g[1], g[2]] };
      }
      if (!best || run.ll > best.ll) best = { th, ll: run.ll };
    }
    const ord = [0, 1, 2].sort((a, b) => best.th.sd[a] - best.th.sd[b]), th = best.th;
    return { mu: ord.map(k => th.mu[k]), sd: ord.map(k => th.sd[k]), pi: ord.map(k => th.pi[k]), A: ord.map(j => ord.map(k => th.A[j][k])), ll: best.ll };
  }
  const regime = memo(() => {
    const we = F.weekEnds().ix.slice();
    if (new Date(F.CAL[F.N - 1] + 'T12:00:00Z').getUTCDay() < 5 && we[we.length - 1] === F.N - 1) we.pop(); // drop a partial week
    const g = F.ser('^GSPC'), ix = we.filter(i => i > g.s), x = [], xi = [];
    for (let k = 1; k < ix.length; k++) { const r = Math.log(g.v[ix[k]] / g.v[ix[k - 1]]); if (ok(r)) { x.push(r); xi.push(ix[k]); } }
    const th = hmmFit(x), run = hmmRun(x, th);
    const n = x.length, now = run.filtAt(n - 1);
    const pow = (p, h) => { let v = p.slice(); for (let s = 0; s < h; s++) v = [0, 1, 2].map(k => v.reduce((a, pj, j) => a + pj * th.A[j][k], 0)); return v; };
    // pseudo out-of-sample check: parameters fitted on 1990-2007 only, then filtered forward with no re-fitting
    const cut = xi.findIndex(i => F.CAL[i] >= '2008-01-01');
    const thOld = hmmFit(x.slice(0, cut)), runOld = hmmRun(x, thOld);
    const fwd = [0, 1, 2].map(() => ({ n: 0, vol: 0, ret: 0, neg: 0 }));
    for (let t = cut; t < n - 4; t++) {
      const p = runOld.filtAt(t), k = p.indexOf(Math.max(...p)), i0 = xi[t], i1 = Math.min(F.N - 1, i0 + 20);
      const r = F.rets('^GSPC', i0 + 1, i1), v = S.sd(r) * Math.sqrt(252) * 100, R = (g.v[i1] / g.v[i0] - 1) * 100;
      if (!ok(v)) continue;
      fwd[k].n++; fwd[k].vol += v; fwd[k].ret += R; if (R < 0) fwd[k].neg++;
    }
    fwd.forEach(f => { if (f.n) { f.vol /= f.n; f.ret /= f.n; f.neg = f.neg / f.n * 100; } });
    return {
      th, x, xi, filtAt: run.filtAt, smoothAt: run.smoothAt, n, now, state: now.indexOf(Math.max(...now)), asOf: F.CAL[xi[n - 1]],
      dur: th.A.map((r, k) => 1 / Math.max(1e-6, 1 - r[k])), ann: th.mu.map((m, k) => ({ ret: (Math.exp(m * 52) - 1) * 100, vol: th.sd[k] * Math.sqrt(52) * 100 })),
      in4: pow(now, 4), in13: pow(now, 13), fwd, oosFrom: F.CAL[xi[cut]], names: REG_NAMES, colors: REG_COL,
      share: [0, 1, 2].map(k => { let a = 0; for (let t = 0; t < n; t++) a += run.ga[t * 3 + k]; return a / n * 100; })
    };
  });

  /* ---------------- 2) Volatility and value-at-risk: GJR-GARCH(1,1), filtered historical simulation ---------------- */
  function gjrFilter(r, v0, p) {
    const [a, g, b] = p, w = v0 * (1 - a - g / 2 - b), h = new Float64Array(r.length + 1); h[0] = v0;
    for (let t = 0; t < r.length; t++) h[t + 1] = w + (a + (r[t] < 0 ? g : 0)) * r[t] * r[t] + b * h[t];
    return h;
  }
  function gjrFit(r, start) { // variance targeting; a, g/2, b kept positive with a + g/2 + b < 1
    const v0 = S.variance(r), n = r.length;
    const tr = u => { const e0 = Math.exp(u[0]), e1 = Math.exp(u[1]), e2 = Math.exp(u[2]), d = 1 + e0 + e1 + e2; return [e0 / d, 2 * e1 / d, e2 / d]; };
    const nll = u => { const [a, g, b] = tr(u), w = v0 * (1 - a - g / 2 - b); let h = v0, s = 0; for (let t = 0; t < n; t++) { const x = r[t], x2 = x * x; s += Math.log(h) + x2 / h; h = w + (x < 0 ? a + g : a) * x2 + b * h; } return 0.5 * s; };
    const p0 = start ? [start.a, start.g / 2, start.b] : [0.02, 0.05, 0.88], rest = 1 - p0[0] - p0[1] - p0[2];
    const res = nelderMead(nll, p0.map(p => Math.log(p / rest)), { step: start ? 0.25 : 0.6, maxIt: start ? 160 : 500, tol: 1e-10 });
    const p = tr(res.x);
    return { a: p[0], g: p[1], b: p[2], v0, pers: p[0] + p[1] / 2 + p[2], nll: res.f };
  }
  function fhs(z, q) { // empirical quantile and expected shortfall of standardized residuals
    const s = Float64Array.from(z).sort(), i = Math.max(0, Math.floor(q * s.length) - 1);
    let es = 0; for (let k = 0; k <= i; k++) es += s[k];
    return { q: s[i], es: es / (i + 1) };
  }
  function kupiec(x, n, p) { const ph = x / n; if (!n) return null; const l0 = (n - x) * Math.log(1 - p) + x * Math.log(p), l1 = (n - x) * Math.log(1 - ph || 1) + (x ? x * Math.log(ph) : 0); const lr = -2 * (l0 - l1); return { lr, p: chi2p1(lr) }; }
  function christoffersen(hits) {
    let n00 = 0, n01 = 0, n10 = 0, n11 = 0;
    for (let t = 1; t < hits.length; t++) { const a = hits[t - 1], b = hits[t]; if (!a && !b) n00++; else if (!a && b) n01++; else if (a && !b) n10++; else n11++; }
    const pi = (n01 + n11) / (n00 + n01 + n10 + n11), p0 = n01 / Math.max(1, n00 + n01), p1 = n11 / Math.max(1, n10 + n11);
    const L = (k, p) => k ? k * Math.log(Math.max(p, 1e-12)) : 0;
    const l0 = L(n00 + n10, 1 - pi) + L(n01 + n11, pi), l1 = L(n00, 1 - p0) + L(n01, p0) + L(n10, 1 - p1) + L(n11, p1);
    const lr = -2 * (l0 - l1); return { lr, p: chi2p1(lr), clustered: n11 };
  }
  const volModel = memo(() => {
    const g = F.ser('^GSPC'), i0 = g.s + 1, raw = F.rets('^GSPC', i0, g.e), mu = S.mean(raw), r = raw.map(v => v - mu);
    const fit = gjrFit(r), h = gjrFilter(r, fit.v0, [fit.a, fit.g, fit.b]);
    const z = r.map((v, t) => v / Math.sqrt(h[t]));
    const hNext = h[r.length], VL = fit.v0;
    const term = k => VL + Math.pow(fit.pers, k - 1) * (hNext - VL);
    let s21 = 0; for (let k = 1; k <= 21; k++) s21 += term(k);
    const q1 = fhs(z, 0.01), q5 = fhs(z, 0.05), sd1 = Math.sqrt(hNext);
    const varD = { v99: -(mu + sd1 * q1.q) * 100, es99: -(mu + sd1 * q1.es) * 100, v95: -(mu + sd1 * q5.q) * 100, es95: -(mu + sd1 * q5.es) * 100 };
    const sdM = Math.sqrt(s21), varM = { v95: -(21 * mu - 1.6449 * sdM) * 100, v99: -(21 * mu - 2.3263 * sdM) * 100 };
    const condVol = new Float64Array(F.N).fill(NaN); for (let t = 0; t < r.length; t++) condVol[i0 + t] = Math.sqrt(h[t] * 252) * 100; // forecast made the day before
    const termCurve = [1, 5, 10, 21, 42, 63, 126, 252].map(k => { let s = 0; for (let j = 1; j <= k; j++) s += term(j); return [k, Math.sqrt(s / k * 252) * 100]; });
    let bt = null;
    const backtest = () => { // out of sample: re-fit every two years on the data available then, forecast one day ahead
      if (bt) return bt;
      const startI = F.idx('2000-01-01') - i0 + 1, hit1 = [], hit5 = [], rows = [], pairs = [];
      let prevFit = null;
      for (let st = startI; st < r.length; st += 504) {
        const trn = r.slice(0, st), f2 = gjrFit(trn, prevFit); prevFit = f2;
        const hh = gjrFilter(r, f2.v0, [f2.a, f2.g, f2.b]);
        const zz = trn.map((v, t) => v / Math.sqrt(hh[t])), a1 = fhs(zz, 0.01), a5 = fhs(zz, 0.05);
        for (let t = st; t < Math.min(r.length, st + 504); t++) {
          const sd = Math.sqrt(hh[t]), v1 = -(mu + sd * a1.q), v5 = -(mu + sd * a5.q), rr = raw[t];
          hit1.push(rr < -v1 ? 1 : 0); hit5.push(rr < -v5 ? 1 : 0);
          rows.push([i0 + t, rr * 100, -v1 * 100, -v5 * 100]);
          if (t % 5 === 0 && t + 21 <= r.length) { let s = 0; for (let k = 0; k < 21; k++) s += r[t + k] ** 2; pairs.push([sd * Math.sqrt(252) * 100, Math.sqrt(s / 21 * 252) * 100]); }
        }
      }
      const x1 = hit1.reduce((a, b) => a + b, 0), x5 = hit5.reduce((a, b) => a + b, 0), n = hit1.length;
      return (bt = { n, x1, x5, rate1: x1 / n * 100, rate5: x5 / n * 100, k1: kupiec(x1, n, 0.01), k5: kupiec(x5, n, 0.05), c1: christoffersen(hit1), c5: christoffersen(hit5), rows, from: F.CAL[rows[0][0]], fcCorr: S.corr(pairs.map(p => p[0]), pairs.map(p => p[1])) });
    };
    return {
      fit, mu, z, h, condVol, i0, sdDay: sd1 * 100, volAnn: Math.sqrt(hNext * 252) * 100, vol21: Math.sqrt(s21 / 21 * 252) * 100, longRun: Math.sqrt(VL * 252) * 100,
      halfLife: Math.log(0.5) / Math.log(fit.pers), varD, varM, q1, q5, termCurve, backtest
    };
  });

  /* ---------------- 3) Drawdown risk: ridge logistic regression, expanding-window out-of-sample test ---------------- */
  const FEATS = [
    ['trend', 'Trend: S&P 500 vs its 200-day average', 'pct'], ['mom', 'Momentum: 12-month return, skipping the latest month', 'pct'],
    ['vix', 'Implied volatility (VIX, log)', 'log'], ['credit', 'Corporate credit spread (Baa)', 'pp'], ['dcredit', 'Credit spread change, 3 months', 'pp'],
    ['curve', 'Yield curve: 10-year minus 3-month', 'pp'], ['nfci', 'Financial conditions (Chicago Fed)', 'idx'], ['cape', 'Valuation: Shiller CAPE (log)', 'log'], ['dd', 'Distance below 52-week high', 'pct']
  ];
  let CAPE_BY_MONTH = null;
  function capeAt(iso) {
    if (!CAPE_BY_MONTH) { CAPE_BY_MONTH = {}; const sh = F.shiller(); if (sh) sh.CAPE.forEach((v, k) => { if (ok(v)) CAPE_BY_MONTH[F.ymKey(sh.s, k)] = v; }); }
    let key = iso.slice(0, 7);
    for (let tries = 0; tries < 6; tries++) { if (CAPE_BY_MONTH[key]) return CAPE_BY_MONTH[key]; const y = +key.slice(0, 4), m = +key.slice(5, 7) - 2; key = m < 0 ? `${y - 1}-12` : `${y}-${String(m + 1).padStart(2, '0')}`; }
    return null;
  }
  function featAt(i) {
    const g = F.ser('^GSPC'), v = g.v; if (i - 252 < g.s) return null;
    const sma = F.sma('^GSPC', 200, i); let hi = 0; for (let k = i - 251; k <= i; k++) hi = Math.max(hi, v[k]);
    const at = id => F.at(id, i), b = F.at('BAA10Y', i), b3 = F.at('BAA10Y', i - 63), cape = capeAt(F.CAL[i]);
    const f = { trend: (v[i] / sma - 1) * 100, mom: (v[i - 21] / v[i - 252] - 1) * 100, vix: Math.log(at('^VIX')), credit: b, dcredit: b - b3, curve: at('DGS10') - at('DGS3MO'), nfci: at('NFCI'), cape: cape ? Math.log(cape) : NaN, dd: (v[i] / hi - 1) * 100 };
    return FEATS.every(([k]) => ok(f[k])) ? f : null;
  }
  function logitRidge(Xs, y, lam) { // Xs: standardized rows; returns [b0, b...]
    const n = Xs.length, k = Xs[0].length + 1; let b = new Array(k).fill(0);
    const ybar = y.reduce((a, c) => a + c, 0) / n; b[0] = Math.log(ybar / (1 - ybar));
    for (let it = 0; it < 50; it++) {
      const H = Array.from({ length: k }, () => new Array(k).fill(0)), gr = new Array(k).fill(0);
      for (let i = 0; i < n; i++) {
        const row = [1].concat(Xs[i]); let eta = 0; for (let j = 0; j < k; j++) eta += row[j] * b[j];
        const p = 1 / (1 + Math.exp(-eta)), w = Math.max(p * (1 - p), 1e-9);
        for (let a = 0; a < k; a++) { gr[a] += (y[i] - p) * row[a]; for (let c = a; c < k; c++) H[a][c] += w * row[a] * row[c]; }
      }
      for (let a = 0; a < k; a++) for (let c = 0; c < a; c++) H[a][c] = H[c][a];
      for (let a = 1; a < k; a++) { H[a][a] += lam; gr[a] -= lam * b[a]; }
      const Hi = S.inv(H); if (!Hi) break;
      const step = Hi.map(r => r.reduce((s, v, j) => s + v * gr[j], 0));
      b = b.map((v, j) => v + step[j]);
      if (step.reduce((s, v) => s + Math.abs(v), 0) < 1e-8) break;
    }
    return b;
  }
  const sigm = t => 1 / (1 + Math.exp(-t));
  const RISK_FEATS = ['vix', 'trend', 'dcredit', 'cape'];
  const RISK_SPECS = { pull5: { horizon: 63, drop: 0.05, lam: 16, label: '5% pullback within 3 months' }, dd10: { horizon: 126, drop: 0.10, lam: 16, label: '10% correction within 6 months' }, bear20: { horizon: 252, drop: 0.20, lam: 16, label: '20% bear market within 12 months' } };
  let ROWS = null;
  function riskRows() { // month-end feature rows since 1991 (the current, partial month is excluded from training)
    if (ROWS) return ROWS;
    const me = F.monthEnds(); ROWS = [];
    for (let k = 0; k < me.ix.length; k++) { const i = me.ix[k]; if (i === F.N - 1) continue; const f = featAt(i); if (f) ROWS.push({ i, key: me.keys[k], f }); }
    return ROWS;
  }
  function ddModel(spec) {
    const { horizon, drop, lam } = spec, FE = FEATS.filter(([k]) => (spec.feats || RISK_FEATS).includes(k));
    const g = F.ser('^GSPC');
    const rows = riskRows().map(r => {
      let y = null; const i = r.i;
      if (i + horizon <= g.e) { let mn = Infinity; for (let j = i + 1; j <= i + horizon; j++) mn = Math.min(mn, g.v[j]); y = mn <= g.v[i] * (1 - drop) ? 1 : 0; }
      return { i, key: r.key, f: r.f, y };
    });
    const lab = rows.filter(r => r.y != null);
    const fitOn = list => {
      const M = list.map(r => FE.map(([kk]) => r.f[kk])), st = S.standardize(M);
      return { b: logitRidge(st.Z, list.map(r => r.y), lam), mu: st.mu, sg: st.sg };
    };
    const pred = (m, f) => { const z = FE.map(([kk], j) => (f[kk] - m.mu[j]) / m.sg[j]); return { p: sigm(m.b[0] + z.reduce((s, v, j) => s + v * m.b[j + 1], 0)), z }; };
    const full = fitOn(lab), nowF = featAt(F.N - 1), now = nowF ? pred(full, nowF) : null;
    const contrib = now ? FE.map(([kk, name], j) => ({ k: kk, name, z: now.z[j], beta: full.b[j + 1], c: full.b[j + 1] * now.z[j], raw: nowF[kk] })).sort((a, b) => Math.abs(b.c) - Math.abs(a.c)) : [];
    const baseRate = lab.filter(r => r.y).length / lab.length;
    let ev = null;
    const evaluate = () => { // expanding window, re-estimated each January, trained only on outcomes already known at the time
      if (ev) return ev;
      const gap = Math.ceil(horizon / 21) + 1, oos = []; let m = null, base = null, yr = null;
      const startK = lab.findIndex(r => r.key >= '2000-01');
      for (let t = startK; t < lab.length; t++) {
        const y = lab[t].key.slice(0, 4);
        if (y !== yr || !m) { const train = lab.slice(0, Math.max(0, t - gap + 1)); if (train.length < 60 || !train.some(r => r.y) || train.every(r => r.y)) continue; m = fitOn(train); base = train.filter(r => r.y).length / train.length; yr = y; }
        oos.push({ key: lab[t].key, i: lab[t].i, p: pred(m, lab[t].f).p, y: lab[t].y, base });
      }
      const P = oos.map(o => o.p), Y = oos.map(o => o.y), B = oos.map(o => o.base);
      const brier = S.brier(P, Y), brierClim = S.brier(B, Y);
      const bins = [[0, 0.15], [0.15, 0.25], [0.25, 0.35], [0.35, 0.5], [0.5, 1.01]].map(([a, b]) => { const sel = oos.filter(o => o.p >= a && o.p < b); return { lo: a, hi: Math.min(b, 1), n: sel.length, p: S.mean(sel.map(o => o.p)), hit: sel.length ? sel.filter(o => o.y).length / sel.length : null }; });
      // top-quintile lift: how often the event followed the riskiest 20% of model readings
      const srt = oos.slice().sort((a, b) => b.p - a.p), top = srt.slice(0, Math.round(srt.length / 5)), bot = srt.slice(-Math.round(srt.length / 5));
      return (ev = { oos, auc: S.auc(P, Y), brier, brierClim, bss: 1 - brier / brierClim, bins, from: oos.length ? oos[0].key : null, topHit: top.filter(o => o.y).length / top.length, botHit: bot.filter(o => o.y).length / bot.length });
    };
    const hist = () => rows.map(r => ({ key: r.key, i: r.i, p: pred(full, r.f).p, y: r.y }));
    return { spec, feats: FE, n: lab.length, events: lab.filter(r => r.y).length, baseRate, now, nowF, contrib, coef: full, evaluate, hist };
  }
  const RISK = {};
  const risk = key => RISK[key] || (RISK[key] = ddModel(RISK_SPECS[key]));
  const dd10 = () => risk('dd10');

  /* ---------------- 4) Long-run expected returns: Shiller CAPE ---------------- */
  const cape = memo(() => {
    const sh = F.shiller(); if (!sh) return null;
    const n = sh.CAPE.length, rows = [];
    for (let k = 0; k < n; k++) {
      const c = sh.CAPE[k]; if (!ok(c)) continue;
      const fwd = k + 120 < sh.TRP.length && ok(sh.TRP[k + 120]) && ok(sh.TRP[k]) ? (Math.pow(sh.TRP[k + 120] / sh.TRP[k], 0.1) - 1) * 100 : null;
      // trailing 10-year inflation for the real bond yield (excess CAPE yield)
      const inf = k >= 120 && ok(sh.CPI[k]) && ok(sh.CPI[k - 120]) ? (Math.pow(sh.CPI[k] / sh.CPI[k - 120], 0.1) - 1) * 100 : null;
      const ecy = ok(inf) && ok(sh.GS10[k]) ? 100 / c - (sh.GS10[k] - inf) : null;
      rows.push({ k, key: F.ymKey(sh.s, k), x: F.ymX(sh.s, k), cape: c, lc: Math.log(c), fwd, ecy });
    }
    const lab = rows.filter(r => ok(r.fwd));
    const fit = S.ols(lab.map(r => r.fwd), lab.map(r => [r.lc]));
    // out-of-sample: from 1940, each month uses only pairs whose 10-year outcome was known
    const oos = []; let f = null, mean = null, yr = null;
    for (let t = 0; t < lab.length; t++) {
      if (lab[t].key < '1940-01') continue;
      const y = lab[t].key.slice(0, 4);
      if (y !== yr) { const tr = lab.filter(r => r.k <= lab[t].k - 120); if (tr.length < 240) continue; f = S.ols(tr.map(r => r.fwd), tr.map(r => [r.lc])); mean = S.mean(tr.map(r => r.fwd)); yr = y; }
      if (!f) continue;
      oos.push({ key: lab[t].key, x: lab[t].x, pred: f.predict([lab[t].lc]), mean, y: lab[t].fwd });
    }
    const sse = oos.reduce((s, o) => s + (o.y - o.pred) ** 2, 0), sseM = oos.reduce((s, o) => s + (o.y - o.mean) ** 2, 0);
    const last = rows[rows.length - 1], pctile = S.pctRank(rows.map(r => r.cape), last.cape) * 100;
    const fc = fit.predict([last.lc]), oosRmse = Math.sqrt(sse / oos.length);
    const ecyRows = rows.filter(r => ok(r.ecy));
    return { rows, lab, fit, oos, r2oos: 1 - sse / sseM, oosRmse, last, pctile, fc, lo: fc - 1.645 * oosRmse, hi: fc + 1.645 * oosRmse, ecyNow: ecyRows.length ? ecyRows[ecyRows.length - 1].ecy : null, ecyPct: ecyRows.length ? S.pctRank(ecyRows.map(r => r.ecy), ecyRows[ecyRows.length - 1].ecy) * 100 : null, median: S.median(rows.map(r => r.cape)) };
  });
  const buffett = memo(() => { // corporate equity market value / GDP
    const e = F.macroQ('NCBEILQ027S'), g = F.macroQ('GDP'); if (!e || !g) return null;
    const out = [];
    e.v.forEach((v, k) => { if (!ok(v)) return; const key = F.ymKey(e.s, k), gk = g.v.findIndex((_, j) => F.ymKey(g.s, j) === key); const gv = gk >= 0 ? g.v[gk] : null; if (ok(gv)) out.push({ key, x: F.ymX(e.s, k), v: v / 1000 / gv * 100 }); });
    if (!out.length) return null;
    const last = out[out.length - 1];
    return { rows: out, last, pctile: S.pctRank(out.map(r => r.v), last.v) * 100 };
  });

  /* ---------------- 5) Trend following: 10-month moving-average rule on US stocks since 1926 ---------------- */
  function perf(r, rf) { // monthly simple returns
    let v = 1, hi = 1, mdd = 0; const ex = [];
    r.forEach((x, k) => { v *= 1 + x; hi = Math.max(hi, v); mdd = Math.min(mdd, v / hi - 1); ex.push(x - (rf ? rf[k] : 0)); });
    const yrs = r.length / 12;
    return { cagr: (Math.pow(v, 1 / yrs) - 1) * 100, vol: S.sd(r) * Math.sqrt(12) * 100, sharpe: S.mean(ex) * 12 / (S.sd(r) * Math.sqrt(12)), mdd: mdd * 100, end: v };
  }
  const trend = memo(() => {
    const ff = F.french(); if (!ff) return null;
    const f = ff.f3, n = f.MKT.length, mkt = [], rf = [], keys = [];
    for (let k = 0; k < n; k++) if (ok(f.MKT[k]) && ok(f.RF[k])) { mkt.push((f.MKT[k] + f.RF[k]) / 100); rf.push(f.RF[k] / 100); keys.push(F.ymKey(f.s, k)); }
    const idx = []; let v = 1; mkt.forEach(r => { v *= 1 + r; idx.push(v); });
    const strat = [], bh = [], cash = [], inv = [], sKeys = []; let switches = 0, prevIn = null;
    for (let k = 10; k < mkt.length; k++) {
      let s = 0; for (let j = k - 10; j < k; j++) s += idx[j];
      const on = idx[k - 1] > s / 10; // signal known at the end of the prior month
      if (prevIn != null && on !== prevIn) switches++; prevIn = on;
      strat.push(on ? mkt[k] : rf[k]); bh.push(mkt[k]); cash.push(rf[k]); inv.push(on ? 1 : 0); sKeys.push(keys[k]);
    }
    const sub = from => { const a = sKeys.findIndex(kk => kk >= from); return { s: perf(strat.slice(a), cash.slice(a)), b: perf(bh.slice(a), cash.slice(a)) }; };
    const curve = (arr) => { let w = 1; return arr.map((r, k) => { w *= 1 + r; return [F.ymX(sKeys[k].slice(0, 4) + '-' + sKeys[k].slice(5, 7), 0), w]; }); };
    return { all: { s: perf(strat, cash), b: perf(bh, cash) }, since1990: sub('1990-01'), since2010: sub('2010-01'), switches, years: strat.length / 12, from: sKeys[0], to: sKeys[sKeys.length - 1], pctIn: S.mean(inv) * 100, curveS: curve(strat), curveB: curve(bh) };
  });
  function trendStatus(id) {
    const s = F.ser(id); if (!s || !s.log) return null;
    const m200 = F.sma(id, 200), last = s.v[s.e];
    const mom = s.e - 252 >= s.s ? (s.v[s.e - 21] / s.v[s.e - 252] - 1) * 100 : null;
    const above = m200 ? (last / m200 - 1) * 100 : null;
    return { above, mom, up: above != null ? above > 0 : null, score: (above > 0 ? 1 : 0) + (mom > 0 ? 1 : 0) };
  }

  /* ---------------- 6) Risk appetite gauge: six market-based components, percentile-ranked ---------------- */
  const SECT = ['XLK', 'XLC', 'XLY', 'XLF', 'XLV', 'XLI', 'XLP', 'XLE', 'XLB', 'XLU', 'XLRE'];
  const COMP = [['mom', 'Momentum: S&P 500 vs 125-day average'], ['breadth', 'Breadth: sectors above their 50-day average'], ['calm', 'Volatility: VIX vs its 50-day average (inverted)'], ['stocks', 'Stocks vs Treasuries, 20-day returns'], ['junk', 'Junk bonds vs Treasuries, 20-day returns'], ['range', 'S&P 500 position in its 52-week range']];
  const appetite = memo(() => {
    const start = F.idx('2007-06-01'), E = F.N - 1, W = 504, NN = F.N;
    const raw = {}; COMP.forEach(([k]) => { raw[k] = new Float64Array(NN).fill(NaN); });
    const sp = F.ser('^GSPC').v, vx = F.ser('^VIX').v, spy = F.ser('SPY').v, ief = F.ser('IEF').v, hyg = F.ser('HYG').v;
    const smaArr = (v, n) => { const out = new Float64Array(NN).fill(NaN); let s = 0, c = 0; for (let i = 0; i < NN; i++) { const a = v[i]; if (a === a) { s += a; c++; } if (i >= n) { const b = v[i - n]; if (b === b) { s -= b; c--; } } if (c === n) out[i] = s / n; } return out; };
    const m125 = smaArr(sp, 125), v50 = smaArr(vx, 50), sv = [], sm = [];
    SECT.forEach(id => { if (F.has(id)) { const v = F.ser(id).v; sv.push(v); sm.push(smaArr(v, 50)); } });
    for (let i = start; i <= E; i++) {
      raw.mom[i] = sp[i] / m125[i] - 1;
      let up = 0, tot = 0; for (let j = 0; j < sv.length; j++) { const v = sv[j][i], m = sm[j][i]; if (v === v && m === m) { tot++; if (v > m) up++; } } raw.breadth[i] = tot ? up / tot : NaN;
      raw.calm[i] = -(vx[i] / v50[i] - 1);
      raw.stocks[i] = spy[i] / spy[i - 20] - ief[i] / ief[i - 20]; raw.junk[i] = hyg[i] / hyg[i - 20] - ief[i] / ief[i - 20];
      let hi = -Infinity, lo = Infinity; for (let k = i - 251; k <= i; k++) { const v = sp[k]; if (v > hi) hi = v; if (v < lo) lo = v; } raw.range[i] = (sp[i] - lo) / (hi - lo);
    }
    const score = new Float64Array(NN).fill(NaN), parts = {};
    COMP.forEach(([k]) => { parts[k] = new Float64Array(NN).fill(NaN); });
    const s0 = start + W, tmp = new Float64Array(NN);
    for (let i = s0; i <= E; i++) tmp[i] = 0;
    for (const [k] of COMP) {
      const R = raw[k], Pk = parts[k];
      for (let i = s0; i <= E; i++) {
        const v = R[i]; if (v !== v) continue; let below = 0, n = 0;
        for (let j = i - W; j < i; j++) { const u = R[j]; if (u === u) { n++; if (u < v) below++; else if (u === v) below += 0.5; } }
        if (n > W * 0.6) Pk[i] = below / n * 100;
      }
    }
    for (let i = s0; i <= E; i++) { let s = 0, c = 0; for (const [k] of COMP) { const v = parts[k][i]; if (v === v) { s += v; c++; } } if (c >= 4) score[i] = s / c; }
    // does the gauge predict anything? forward S&P 500 returns by score bucket (overlapping windows; informative, not a trading rule)
    const B = [[0, 25, 'Extreme fear'], [25, 45, 'Fear'], [45, 55, 'Neutral'], [55, 75, 'Greed'], [75, 101, 'Extreme greed']];
    const bucket = B.map(([a, b, name]) => { const f21 = [], f63 = []; for (let i = s0; i <= E - 63; i++) { const v = score[i]; if (v !== v || v < a || v >= b) continue; f21.push((sp[i + 21] / sp[i] - 1) * 100); f63.push((sp[i + 63] / sp[i] - 1) * 100); } return { name, lo: a, hi: Math.min(b, 100), n: f21.length, r21: S.mean(f21), r63: S.mean(f63), neg63: f63.length ? f63.filter(v => v < 0).length / f63.length * 100 : null }; });
    const now = score[E], lab = B.find(([a, b]) => now >= a && now < b);
    return { score, parts, raw, now, label: lab ? lab[2] : '–', week: score[E - 5], month: score[E - 21], year: score[E - 252], bucket, from: F.CAL[s0], comps: COMP };
  });

  /* ---------------- 7) Correlations: weekly returns, clustered ---------------- */
  function corrMatrix(ids, weeks) {
    const we = F.weekEnds().ix, ix = we.slice(Math.max(0, we.length - weeks - 1));
    const R = ids.map(id => F.sampledRets(id, ix));
    const M = ids.map((_, a) => ids.map((_, b) => { if (a === b) return 1; const x = [], y = []; for (let t = 1; t < ix.length; t++) if (ok(R[a][t]) && ok(R[b][t])) { x.push(R[a][t]); y.push(R[b][t]); } return x.length >= Math.min(26, weeks * 0.6) ? S.corr(x, y) : null; }));
    return { ids, M, weeks };
  }
  function cluster(M) { // average-linkage hierarchical clustering on d = sqrt((1 - rho) / 2); returns leaf order and merges
    const n = M.length; let cl = M.map((_, i) => ({ id: i, items: [i], h: 0 })); const merges = [];
    const d = (a, b) => { let s = 0, c = 0; for (const i of a.items) for (const j of b.items) { const r = M[i][j]; if (ok(r)) { s += Math.sqrt(Math.max(0, (1 - r) / 2)); c++; } } return c ? s / c : 1; };
    let next = n;
    while (cl.length > 1) {
      let bi = 0, bj = 1, bd = Infinity;
      for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) { const v = d(cl[i], cl[j]); if (v < bd) { bd = v; bi = i; bj = j; } }
      const a = cl[bi], b = cl[bj], m = { id: next++, items: a.items.concat(b.items), h: bd, l: a, r: b };
      merges.push(m); cl = cl.filter((_, k) => k !== bi && k !== bj).concat([m]);
    }
    return { order: cl[0].items, root: cl[0] };
  }
  const stockBond = memo(() => { // rolling 52-week correlation: S&P 500 vs a 10-year Treasury bond rebuilt from yields (works back to 1990)
    const we = F.weekEnds().ix, sp = F.ser('^GSPC'), y = F.ser('DGS10'), out = [];
    const rs = [], rb = [];
    for (let k = 1; k < we.length; k++) {
      const a = we[k - 1], b = we[k], y0 = y.v[a] / 100, y1 = y.v[b] / 100;
      const D = (1 / y0) * (1 - Math.pow(1 + y0 / 2, -20)), weeks = (F.ORD[b] - F.ORD[a]) / 7;
      rs.push(sp.v[b] / sp.v[a] - 1); rb.push(y0 * weeks / 52 - D * (y1 - y0));
      if (rs.length >= 52) out.push([F.X[b], S.corr(rs.slice(-52), rb.slice(-52))]);
    }
    const etf = []; // the same with real ETF returns where they exist
    for (let k = 52; k < we.length; k++) { const ix = we.slice(k - 52, k + 1); const a = F.sampledRets('SPY', ix), b = F.sampledRets('IEF', ix); const x = [], z = []; for (let t = 1; t < ix.length; t++) if (ok(a[t]) && ok(b[t])) { x.push(a[t]); z.push(b[t]); } if (x.length >= 40) etf.push([F.X[we[k]], S.corr(x, z)]); }
    return { synth: out, etf, now: out.length ? out[out.length - 1][1] : null };
  });

  /* ---------------- 8) Sector rotation map (relative strength vs the S&P 500, weekly) ---------------- */
  const rotation = memo(() => {
    const we = F.weekEnds().ix, n = we.length, out = [];
    for (const id of SECT) {
      if (!F.has(id)) continue;
      const rs = we.map(i => F.at(id, i) / F.at('SPY', i));
      const tail = [];
      for (let k = n - 6; k < n; k++) {
        const X13 = (rs[k] / rs[k - 13] - 1) * 100, X13p = (rs[k - 4] / rs[k - 17] - 1) * 100;
        if (ok(X13) && ok(X13p)) tail.push([X13, X13 - X13p]);
      }
      if (tail.length < 2) continue;
      const [x, y] = tail[tail.length - 1];
      out.push({ id, name: F.ser(id).name, tail, x, y, quad: x >= 0 ? (y >= 0 ? 'Leading' : 'Weakening') : (y >= 0 ? 'Improving' : 'Lagging') });
    }
    return out;
  });

  /* ---------------- 9) Asset scorecard (returns, risk, trend) ---------------- */
  const scorecard = memo(() => {
    const ids = Object.keys(F.P.s).filter(id => F.ser(id).log);
    const we = F.weekEnds().ix, ix3 = we.slice(-157), ix1 = we.slice(-53), spy3 = F.sampledRets('SPY', ix3), spy1 = F.sampledRets('SPY', ix1);
    const rf5 = (() => { const b = F.ser('DGS3MO'); let s = 0, c = 0; for (let i = Math.max(b.s, b.e - 1260); i <= b.e; i++) { s += b.v[i]; c++; } return s / c; })();
    return ids.map(id => {
      const s = F.ser(id), q = F.quote(id), ts = trendStatus(id), r3 = F.sampledRets(id, ix3), r1 = F.sampledRets(id, ix1);
      const pair = (a, b) => { const x = [], y = []; for (let t = 1; t < a.length; t++) if (ok(a[t]) && ok(b[t])) { x.push(a[t]); y.push(b[t]); } return [x, y]; };
      const [x3, y3] = pair(r3, spy3), [x1, y1] = pair(r1, spy1);
      const beta = x3.length > 100 ? S.corr(x3, y3) * S.sd(x3) / S.sd(y3) : null;
      const a5 = F.annRet(id, 5), v5 = F.vol(id, 1260);
      return {
        id, name: F.label(id), grp: s.grp, cls: s.cls, last: q.last, d1: q.pct, w1: F.chg(id, 5), m1: F.chg(id, 21), m3: F.chg(id, 63), ytd: F.ytd(id), y1: F.chg(id, 252),
        y3: F.annRet(id, 3), y5: a5, y10: F.annRet(id, 10), vol: F.vol(id, 252), sharpe: ok(a5) && ok(v5) && s.cls !== 'vol' ? (a5 - rf5) / v5 : null,
        mdd: F.maxDD(id).mdd, dd: F.drawdown(id).dd, beta: s.cls === 'vol' ? null : beta, corr: x1.length > 40 ? S.corr(x1, y1) : null, trend: ts ? ts.above : null, mom: ts ? ts.mom : null
      };
    });
  });

  /* ---------------- 10) Alerts: rule-based, each with the reading that triggered it ---------------- */
  const alerts = memo(() => {
    const A = [], add = (lvl, title, why) => A.push({ lvl, title, why });
    const v = F.lastVal('^VIX'), vp = S.pctRank(Array.from(F.ser('^VIX').v).filter(ok), v) * 100;
    if (v >= 30) add('crit', `Volatility is high: VIX ${K.num(v, 1)}`, `Higher than ${K.num(vp, 0)}% of days since 1990. Markets are pricing daily swings of about ${K.num(v / Math.sqrt(252), 1)}%.`);
    else if (v >= 22) add('warn', `Volatility is elevated: VIX ${K.num(v, 1)}`, `Above its long-run median (${K.num(S.median(Array.from(F.ser('^VIX').v).filter(ok)), 1)}); ${K.num(vp, 0)}th percentile since 1990.`);
    const dd = F.drawdown('^GSPC');
    if (dd.dd <= -20) add('crit', `S&P 500 in a bear market: ${K.pct(dd.dd, 1)} from its high`, `Peak on ${K.isoLab(dd.highDate)}.`);
    else if (dd.dd <= -10) add('serious', `S&P 500 in a correction: ${K.pct(dd.dd, 1)} from its high`, `Peak on ${K.isoLab(dd.highDate)}.`);
    else if (dd.dd <= -5) add('warn', `S&P 500 pullback: ${K.pct(dd.dd, 1)} from its high`, `Peak on ${K.isoLab(dd.highDate)}.`);
    else if (dd.dd > -0.5) add('good', 'S&P 500 at or near a record high', `Within ${K.num(-dd.dd, 1)}% of the ${K.isoLab(dd.highDate)} close.`);
    const c3 = F.lastVal('DGS10') - F.lastVal('DGS3MO'), c2 = F.lastVal('DGS10') - F.lastVal('DGS2');
    if (c3 < 0) add('warn', `Yield curve inverted: 10-year minus 3-month ${K.sgn(c3, 2)} pp`, 'Inversions preceded every US recession since 1970, with a lag of 6 to 24 months and some false alarms.');
    const cr = F.chg('BAA10Y', 21);
    if (cr != null && cr >= 0.4) add('serious', `Credit spreads widening fast: ${K.sgn(cr, 2)} pp in a month`, `Baa spread now ${K.num(F.lastVal('BAA10Y'), 2)} pp. Fast widening often accompanies equity stress.`);
    const t10 = F.chg('DGS10', 21);
    if (t10 != null && Math.abs(t10) >= 0.4) add('warn', `10-year yield moved ${K.sgn(t10, 2)} pp in a month`, `Now ${K.num(F.lastVal('DGS10'), 2)}%. Long-bond prices move about 8 times the yield change in the opposite direction.`);
    const dx = F.chg('DX-Y.NYB', 21); if (dx != null && Math.abs(dx) >= 3) add('warn', `Dollar ${dx > 0 ? 'surged' : 'slid'} ${K.sgn(dx, 1)}% in a month`, 'Big dollar moves shift returns on foreign assets and commodities for US investors.');
    const oil = F.chg('CL=F', 21); if (oil != null && Math.abs(oil) >= 15) add('warn', `Oil ${oil > 0 ? 'jumped' : 'fell'} ${K.sgn(oil, 0)}% in a month`, `WTI near $${K.num(F.lastVal('CL=F'), 0)} a barrel.`);
    const btc = F.drawdown('BTC-USD'); if (btc && btc.dd <= -30) { const ep = episodes('BTC-USD', 0.5); add('info', `Bitcoin ${K.pct(btc.dd, 0)} from its high`, `High on ${K.isoLab(btc.highDate)}. Since ${F.CAL[F.ser('BTC-USD').s].slice(0, 4)} it has fallen more than 50% from a record ${ep.length} times, by as much as ${K.pct(Math.min(...ep.map(e => e.depth)), 0)}.`); }
    const ap = appetite(); if (ok(ap.now)) { if (ap.now >= 80) add('warn', `Risk appetite is euphoric: ${K.num(ap.now, 0)}/100`, 'Historically followed by weaker but still mostly positive 3-month returns; not a timing signal on its own.'); else if (ap.now <= 20) add('info', `Risk appetite is fearful: ${K.num(ap.now, 0)}/100`, 'Fearful readings were followed by above-average 3-month returns, with wider swings.'); }
    const rg = regime(); if (rg.state === 2) add('serious', `Regime model: stress (${K.num(rg.now[2] * 100, 0)}% probability)`, 'Weekly returns look like past high-volatility episodes. Volatility tends to persist for weeks.');
    const d = dd10(); if (d.now && d.now.p >= Math.max(0.33, d.baseRate * 1.5)) add('warn', `Correction risk above normal: ${K.num(d.now.p * 100, 0)}% model chance of a 10% fall within 6 months`, `Base rate since 1991: ${K.num(d.baseRate * 100, 0)}%. The model's out-of-sample skill is modest, so read this as a tilt, not a forecast.`);
    const rank = { crit: 0, serious: 1, warn: 2, info: 3, good: 4 };
    return A.sort((a, b) => rank[a.lvl] - rank[b.lvl]);
  });

  /* ---------------- 11) History: crashes, big days, rolling returns ---------------- */
  const crashes = memo(() => { // S&P 500 (price) declines of 20%+ since 1928, daily closes
    const L = F.spxLong(), v = L.v, out = []; let pk = 0, tr = 0, inDD = false;
    for (let i = 1; i < v.length; i++) {
      if (!inDD) { if (v[i] >= v[pk]) pk = i; else if (v[i] / v[pk] - 1 <= -0.2) { inDD = true; tr = i; } }
      else {
        if (v[i] < v[tr]) tr = i;
        if (v[i] >= v[pk]) { out.push({ pk, tr, rec: i }); inDD = false; pk = i; }
      }
    }
    if (inDD) out.push({ pk, tr, rec: null });
    return out.map(o => ({ peak: L.iso[o.pk], trough: L.iso[o.tr], rec: o.rec != null ? L.iso[o.rec] : null, depth: (v[o.tr] / v[o.pk] - 1) * 100, down: (F.isoToOrd(L.iso[o.tr]) - F.isoToOrd(L.iso[o.pk])) / 30.44, back: o.rec != null ? (F.isoToOrd(L.iso[o.rec]) - F.isoToOrd(L.iso[o.tr])) / 30.44 : null, xp: L.x[o.pk], xt: L.x[o.tr], xr: o.rec != null ? L.x[o.rec] : null }));
  });
  const bigDays = memo(() => { const L = F.spxLong(), d = []; for (let i = 1; i < L.v.length; i++) d.push({ iso: L.iso[i], r: (L.v[i] / L.v[i - 1] - 1) * 100 }); const s = d.slice().sort((a, b) => a.r - b.r); return { worst: s.slice(0, 10), best: s.slice(-10).reverse(), n: d.length, over2: d.filter(x => Math.abs(x.r) >= 2).length }; });
  const intraYear = memo(() => { // calendar-year price return and the deepest fall inside each year (S&P 500, since 1928)
    const L = F.spxLong(), out = []; let y = null, a = null, hi = null, mdd = 0, last = null;
    for (let i = 0; i < L.v.length; i++) {
      const yy = +L.iso[i].slice(0, 4);
      if (yy !== y) { if (y != null && a != null) out.push({ y, r: (last / a - 1) * 100, dd: mdd * 100 }); y = yy; a = i > 0 ? L.v[i - 1] : L.v[i]; hi = a; mdd = 0; }
      hi = Math.max(hi, L.v[i]); mdd = Math.min(mdd, L.v[i] / hi - 1); last = L.v[i];
    }
    if (y != null) out.push({ y, r: (last / a - 1) * 100, dd: mdd * 100, ytd: true });
    const full = out.filter(o => !o.ytd && o.y >= 1929);
    return { rows: out, n: full.length, n10: full.filter(o => o.dd <= -10).length, pos: full.filter(o => o.r > 0).length, posAfter10: full.filter(o => o.dd <= -10 && o.r > 0).length, avgDD: S.mean(full.map(o => o.dd)), medDD: S.median(full.map(o => o.dd)) };
  });
  function episodes(id, thr) { // peak-to-trough declines deeper than thr (fraction) in a panel series
    const s = F.ser(id), out = []; if (!s) return out; let pk = s.s, tr = s.s, inDD = false;
    for (let i = s.s + 1; i <= s.e; i++) {
      if (!inDD) { if (s.v[i] >= s.v[pk]) pk = i; else if (s.v[i] / s.v[pk] - 1 <= -thr) { inDD = true; tr = i; } }
      else { if (s.v[i] < s.v[tr]) tr = i; if (s.v[i] >= s.v[pk]) { out.push({ pk: F.CAL[pk], tr: F.CAL[tr], depth: (s.v[tr] / s.v[pk] - 1) * 100 }); inDD = false; pk = i; } }
    }
    if (inDD) out.push({ pk: F.CAL[pk], tr: F.CAL[tr], depth: (s.v[tr] / s.v[pk] - 1) * 100, open: true });
    return out;
  }
  const clustering = memo(() => { // do the best days sit next to the worst ones?
    const bd = bigDays(), L = F.spxLong(), all = []; for (let i = 1; i < L.v.length; i++) all.push({ iso: L.iso[i], o: F.isoToOrd(L.iso[i]), r: L.v[i] / L.v[i - 1] - 1 });
    const worst = all.slice().sort((a, b) => a.r - b.r).slice(0, 20), best = all.slice().sort((a, b) => b.r - a.r).slice(0, 10);
    const near = best.filter(b => worst.some(w => Math.abs(w.o - b.o) <= 61)).length;
    return { near, of: best.length };
  });
  const rolling = memo(() => { // real total returns of US stocks (Shiller) over rolling horizons
    const sh = F.shiller(); if (!sh) return null; const T = sh.TRP, out = [];
    for (const h of [1, 3, 5, 10, 20, 30]) {
      const r = []; for (let k = 0; k + h * 12 < T.length; k++) if (ok(T[k]) && ok(T[k + h * 12])) r.push((Math.pow(T[k + h * 12] / T[k], 1 / h) - 1) * 100);
      out.push({ h, n: r.length, min: Math.min(...r), p10: S.quantile(r, 0.1), med: S.median(r), p90: S.quantile(r, 0.9), max: Math.max(...r), pos: r.filter(x => x > 0).length / r.length * 100 });
    }
    return { rows: out, from: sh.s };
  });
  const calYears = memo(() => { // calendar-year total returns for the asset-class quilt
    const ids = ['SPY', 'IWM', 'EFA', 'EEM', 'AGG', 'TLT', 'TIP', 'HYG', 'GLD', 'VNQ', 'DBC', 'BIL', 'BTC-USD'];
    const y1 = +F.CAL[F.N - 1].slice(0, 4), years = []; for (let y = 2008; y <= y1; y++) years.push(y);
    const val = (id, y) => { const a = F.idx(`${y - 1}-12-31`), b = y === y1 ? F.N - 1 : F.idx(`${y}-12-31`), s = F.ser(id); if (a < s.s || b > s.e || a < 0) return null; return (s.v[b] / s.v[a] - 1) * 100; };
    return { ids, years, ytdYear: y1, M: ids.map(id => years.map(y => val(id, y))) };
  });
  const monthGrid = memo(() => { // US stock market total return by month (French: market + T-bill), since 1926
    const ff = F.french(); if (!ff) return null; const f = ff.f3, rows = {};
    f.MKT.forEach((v, k) => { if (!ok(v) || !ok(f.RF[k])) return; const key = F.ymKey(f.s, k), y = +key.slice(0, 4), m = +key.slice(5, 7) - 1; (rows[y] = rows[y] || new Array(12).fill(null))[m] = v + f.RF[k]; });
    const years = Object.keys(rows).map(Number).sort((a, b) => a - b);
    const yr = years.map(y => rows[y].reduce((p, r) => r == null ? p : p * (1 + r / 100), 1) * 100 - 100);
    const avg = new Array(12).fill(0).map((_, m) => S.mean(years.map(y => rows[y][m]).filter(ok)));
    const up = new Array(12).fill(0).map((_, m) => { const a = years.map(y => rows[y][m]).filter(ok); return a.filter(v => v > 0).length / a.length * 100; });
    return { years, rows, yr, avg, up };
  });

  /* ---------------- 12) Plain-language read of current conditions ---------------- */
  function narrative() {
    const q = F.quote('^GSPC'), dd = F.drawdown('^GSPC'), v = F.lastVal('^VIX'), rg = regime(), d10 = dd10(), ap = appetite(), vm = volModel(), cp = cape();
    const day = q.pct, dir = day > 0.05 ? 'rose' : day < -0.05 ? 'fell' : 'was flat';
    const s = [];
    s.push(`The S&P 500 ${dir}${Math.abs(day) > 0.05 ? ' ' + K.num(Math.abs(day), 1) + '%' : ''} on ${K.isoLab(q.date)} to ${K.num(q.last, 0)}, ${dd.dd > -0.5 ? 'at a record high' : K.num(-dd.dd, 1) + '% below its ' + K.isoLab(dd.highDate) + ' record'} and ${F.ytd('^GSPC') >= 0 ? 'up' : 'down'} ${K.num(Math.abs(F.ytd('^GSPC')), 1)}% this year.`);
    s.push(`Volatility is ${v >= 30 ? 'high' : v >= 22 ? 'elevated' : v >= 15 ? 'normal' : 'low'} (VIX ${K.num(v, 1)}); the GARCH model expects about ${K.num(vm.sdDay, 1)}% daily swings, and the regime model reads ${rg.names[rg.state].toLowerCase()} (${K.num(rg.now[rg.state] * 100, 0)}% probability).`);
    if (d10.now) s.push(`The correction model puts the chance of a 10% fall within six months at ${K.num(d10.now.p * 100, 0)}%, against a ${K.num(d10.baseRate * 100, 0)}% base rate; its track record is modest and the reading mostly reflects ${d10.contrib[0] && d10.contrib[0].k === 'cape' ? 'high valuations' : 'current market stress'}.`);
    if (ok(ap.now)) s.push(`Risk appetite is ${ap.label.toLowerCase()} at ${K.num(ap.now, 0)}/100.`);
    if (cp) s.push(`Valuations are ${cp.pctile > 90 ? 'very high' : cp.pctile > 70 ? 'high' : cp.pctile > 30 ? 'middling' : 'low'} (CAPE ${K.num(cp.last.cape, 1)}, ${K.ord(Math.round(cp.pctile))} percentile since 1881), which historically pointed to ${K.num(cp.fc, 1)}% a year real returns over the next decade.`);
    return s;
  }

  return { nelderMead, regime, REG_NAMES, REG_COL, volModel, gjrFit, kupiec, christoffersen, FEATS, featAt, dd10, risk, RISK_SPECS, RISK_FEATS, ddModel, logitRidge, cape, buffett, trend, trendStatus, perf, appetite, COMP, SECT, corrMatrix, cluster, stockBond, rotation, scorecard, alerts, crashes, bigDays, intraYear, episodes, clustering, rolling, calYears, monthGrid, narrative, capeAt };
})();
