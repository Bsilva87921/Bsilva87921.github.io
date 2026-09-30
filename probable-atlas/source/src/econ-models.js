/* Probable Atlas · Economics: predictive models, backtests and simulators. Everything runs in the browser on the loaded data. */
const M = (() => {
  const { ok } = K;
  const cache = {};
  const memo = (k, fn) => cache[k] || (cache[k] = fn());
  const atOrBefore = (ms, t, lag = 2) => { for (let i = 0; i <= lag; i++) { const v = E.mAt(ms, t - i); if (ok(v)) return v; } return null; };
  const Z80 = 1.2816;

  /* ================= 1. US recession probability (probit on the yield curve, NY Fed style) ================= */
  function recession() {
    return memo('rec', () => {
      const T10 = E.mSeries('T10Y3M'), GS = E.mSeries('GS10'), TB = E.mSeries('TB3MS'), REC = E.mSeries('USREC');
      const FF = E.mSeries('FEDFUNDS'), DFF = E.mSeries('DFF'), NF = E.mSeries('NFCI'), CORE = E.mYoY(E.mSeries('CPILFESL'));
      let adj = 0;
      if (T10 && GS && TB) { const d = []; for (let i = 0; i < T10.v.length; i++) { const t = T10.t0 + i, a = T10.v[i], g = E.mAt(GS, t), b = E.mAt(TB, t); if (ok(a) && ok(g) && ok(b)) d.push(a - (g - b)); } adj = S.mean(d) || 0; }
      const spread = t => { const a = E.mAt(T10, t); if (ok(a)) return a; const g = E.mAt(GS, t), b = E.mAt(TB, t); return ok(g) && ok(b) ? g - b + adj : null; };
      const ff = t => { const a = E.mAt(FF, t); return ok(a) ? a : E.mAt(DFF, t); };
      const rff = t => { const f = ff(t), c = atOrBefore(CORE, t, 2); return ok(f) && ok(c) ? f - c : null; };
      const nfci = t => E.mAt(NF, t);
      const tRecLast = E.mLast(REC), tNow = Math.max(E.mLast(T10) || 0, 0);
      let tFirst = Infinity; for (const ms of [T10, GS && TB ? GS : null]) if (ms) tFirst = Math.min(tFirst, ms.t0);
      tFirst = Math.max(tFirst, 1959 * 12);
      const specs = {
        classic: { name: 'Yield curve only', xs: t => { const s = spread(t); return ok(s) ? [s] : null; }, from: tFirst, vars: ['Term spread (10y − 3m)'] },
        extended: { name: 'Curve + policy + financial conditions', xs: t => { const s = spread(t), r = rff(t), n = nfci(t); return ok(s) && ok(r) && ok(n) ? [s, r, n] : null; }, from: 1971 * 12, vars: ['Term spread (10y − 3m)', 'Real fed funds rate', 'Financial conditions (NFCI)'] }
      };
      const out = { spread, rff, nfci, adj, tNow, tRecLast, models: {} };
      for (const [key, sp] of Object.entries(specs)) {
        const Y = [], X = [], T = [];
        for (let t = sp.from; t <= tRecLast - 12; t++) { const x = sp.xs(t), y = E.mAt(REC, t + 12); if (x && ok(y)) { Y.push(y); X.push(x); T.push(t); } }
        const fit = S.probit(Y, X);
        if (!fit) continue;
        // full-sample fitted probabilities (plotted at the target month t+12) + current forecast
        const path = [];
        for (let t = sp.from; t <= tNow; t++) { const x = sp.xs(t); if (x) path.push([(t + 12) / 12, fit.prob(x) * 100]); }
        let xNow = null, tUse = tNow; for (let t = tNow; t >= tNow - 3; t--) { xNow = sp.xs(t); if (xNow) { tUse = t; break; } }
        // pseudo out-of-sample: expanding window, refit each January from 1985
        const oos = new Map(); let last = null;
        const yEnd = Math.floor(tNow / 12);
        for (let yr = 1985; yr <= yEnd; yr++) {
          const cut = yr * 12, y2 = [], x2 = [];
          for (let i = 0; i < T.length; i++) if (T[i] + 12 <= cut - 1) { y2.push(Y[i]); x2.push(X[i]); }
          const f2 = S.probit(y2, x2, last ? { start: last.b } : {}) || last; if (!f2) continue; last = f2;
          for (let t = cut; t < cut + 12 && t <= tNow; t++) { const x = sp.xs(t); if (x) oos.set(t, f2.prob(x)); }
        }
        const po = [], yo = [];
        for (const [t, p] of oos) { const y = E.mAt(REC, t + 12); if (ok(y) && t + 12 <= tRecLast) { po.push(p); yo.push(y); } }
        const base = S.mean(yo);
        const recs = E.recessionList().filter(r => r.start >= 1986 * 12).map(r => {
          // signals issued in the 24 months before the recession began (out of sample)
          let mx = 0, first = null;
          for (let t = r.start - 24; t <= r.start - 1; t++) { const p = oos.get(t); if (ok(p)) { mx = Math.max(mx, p); if (first == null && p >= 0.3) first = t; } }
          return { start: r.start, end: r.end, max: mx, lead: first != null ? r.start - first : null };
        });
        const falseAlarms = (() => { let n = 0, on = false; for (const [t, p] of [...oos].sort((a, b) => a[0] - b[0])) { const y = E.mAt(REC, t + 12); const hit = p >= 0.3; if (hit && !on && ok(y)) { const anyRec = [0, 3, 6, 9, 12, 18].some(k => E.mAt(REC, t + k) === 1); if (!anyRec) n++; } on = hit; } return n; })();
        out.models[key] = {
          key, name: sp.name, vars: sp.vars, fit, path, xNow, tUse, pNow: xNow ? fit.prob(xNow) : null, xs: sp.xs,
          oos: [...oos].map(([t, p]) => [(t + 12) / 12, p * 100]).sort((a, b) => a[0] - b[0]),
          score: { auc: S.auc(po, yo), brier: S.brier(po, yo), brier0: base != null ? S.brier(po.map(() => base), yo) : null, n: po.length, recs, falseAlarms }
        };
      }
      return out;
    });
  }
  function recessionProb(key, x) { const m = recession().models[key]; return m ? m.fit.prob(x) : null; }

  /* ================= 2. US GDP nowcast (bridge equation on monthly indicators) ================= */
  const NOW_IND = [
    { id: 'PAYEMS', lab: 'Payroll jobs', tr: 'saar' },
    { id: 'INDPRO', lab: 'Industrial production', tr: 'saar' },
    { id: 'RRSFS', lab: 'Real retail sales', tr: 'saar' },
    { id: 'W875RX1', lab: 'Real income ex transfers', tr: 'saar' },
    { id: 'HOUST', lab: 'Housing starts', tr: 'logd' },
    { id: 'ICSA', lab: 'Jobless claims', tr: 'logd' }
  ];
  function extendAR(ms, tEnd) { // fill months after the last observation using AR(1) on log changes
    const v = ms.v.slice(), last = E.mLast(ms); if (last == null) return { t0: ms.t0, v, filled: 0 };
    const dl = []; for (let t = last - 119; t <= last; t++) { const a = E.mAt(ms, t), b = E.mAt(ms, t - 1); if (ok(a) && ok(b) && a > 0 && b > 0) dl.push([t, Math.log(a / b)]); }
    const fit = S.ols(dl.slice(1).map(d => d[1]), dl.slice(0, -1).map(d => [d[1]]));
    let prev = dl.length ? dl[dl.length - 1][1] : 0, lv = E.mAt(ms, last), filled = 0;
    for (let t = last + 1; t <= tEnd; t++) { const g = fit ? fit.predict([prev]) : prev; lv *= Math.exp(g); prev = g; v[t - ms.t0] = lv; filled++; }
    return { t0: ms.t0, v, filled };
  }
  function nowcast() {
    return memo('now', () => {
      const GDP = E.qSeries('A191RL1Q225SBEA'); if (!GDP) return null;
      const qLast = E.qLast(GDP), qNow = qLast + 1, tEnd = qNow * 3 + 2;
      const src = {}, fill = {};
      for (const ind of NOW_IND) { const ms = E.mSeries(ind.id); if (!ms) continue; const obsLast = E.mLast(ms); const ext = extendAR(ms, tEnd); src[ind.id] = ext; fill[ind.id] = { obs: Math.max(0, Math.min(3, obsLast - qNow * 3 + 1)), last: obsLast }; }
      const qAvg = (ms, q) => { let s = 0; for (let k = 0; k < 3; k++) { const v = E.mAt(ms, q * 3 + k); if (!ok(v)) return null; s += v; } return s / 3; };
      const feat = q => NOW_IND.map(ind => { const ms = src[ind.id]; if (!ms) return null; const a = qAvg(ms, q), b = qAvg(ms, q - 1); if (!ok(a) || !ok(b) || a <= 0 || b <= 0) return null; return ind.tr === 'saar' ? (Math.pow(a / b, 4) - 1) * 100 : 100 * Math.log(a / b); });
      const covid = q => q >= 2020 * 4 && q <= 2021 * 4 + 1;
      const rows = [];
      for (let q = GDP.q0 + 1; q <= qLast; q++) { if (covid(q)) continue; const x = feat(q), y = E.qAt(GDP, q); if (x.every(ok) && ok(y)) rows.push({ q, x, y }); }
      const fit = S.ols(rows.map(r => r.y), rows.map(r => r.x), { robust: true });
      if (!fit) return null;
      const xNow = feat(qNow), est = fit.predict(xNow);
      const means = NOW_IND.map((_, j) => S.mean(rows.map(r => r.x[j])));
      const contrib = NOW_IND.map((ind, j) => ({ lab: ind.lab, id: ind.id, v: fit.b[j + 1] * (xNow[j] - means[j]), x: xNow[j], coef: fit.b[j + 1], p: fit.p[j + 1], obs: fill[ind.id] ? fill[ind.id].obs : 0 }));
      const baseline = fit.b[0] + NOW_IND.reduce((s, _, j) => s + fit.b[j + 1] * means[j], 0);
      // pseudo out-of-sample backtest from 2005 (current-vintage data; flatters real-time accuracy)
      const bt = [];
      for (const r of rows) {
        if (r.q < 2005 * 4) continue;
        const tr = rows.filter(z => z.q < r.q);
        const f = S.ols(tr.map(z => z.y), tr.map(z => z.x)); if (!f) continue;
        const prev = [1, 2, 3, 4].map(k => E.qAt(GDP, r.q - k)).filter(ok);
        bt.push({ q: r.q, y: r.y, m: f.predict(r.x), naive: S.mean(prev), gdpnow: E.qAt(E.qSeries('GDPNOW'), r.q) });
      }
      const both = bt.filter(b => ok(b.gdpnow));
      return {
        qNow, qLast, est, lo: est - Z80 * fit.sigma, hi: est + Z80 * fit.sigma, fit, contrib, baseline, fill, NOW_IND, rows,
        gdpnow: E.qAt(E.qSeries('GDPNOW'), qNow), lastActual: E.qAt(GDP, qLast), bt,
        score: { rmse: S.rmse(bt.map(b => b.m - b.y)), naive: S.rmse(bt.map(b => b.naive - b.y)), n: bt.length, rmseCommon: S.rmse(both.map(b => b.m - b.y)), gdpnowRmse: S.rmse(both.map(b => b.gdpnow - b.y)), nCommon: both.length }
      };
    });
  }

  /* ================= 3. US inflation forecast (direct regressions, horizons 1–12 months) ================= */
  function inflation() {
    return memo('inf', () => {
      const CPI = E.mSeries('CPIAUCSL'); if (!CPI) return null;
      const P12 = E.mYoY(CPI), CORE6 = E.mAnn(E.mSeries('CPILFESL'), 6), MICH = E.mSeries('MICH'), UN = E.mSeries('UNRATE'), NROU = E.qSeries('NROU');
      const OILm = E.mSeries('DCOILWTICO'), OILY = E.mYoY(OILm);
      const ugap = t => { const u = E.mAt(UN, t), n = E.qAt(NROU, Math.floor(t / 3)); return ok(u) && ok(n) ? u - n : null; };
      const xs = t => { const a = E.mAt(P12, t), b = E.mAt(CORE6, t), c = atOrBefore(MICH, t, 1), d = ugap(t), e = E.mAt(OILY, t); return [a, b, c, d, e].every(ok) ? [a, b, c, d, e] : null; };
      const VARS = ['Inflation now (12-month)', 'Core inflation, last 6 months (annualized)', 'Expected inflation (households)', 'Unemployment gap', 'Oil price change (12-month)'];
      const tLast = E.mLast(P12), t0 = 1987 * 12 + 1;
      const fits = [];
      for (let h = 1; h <= 12; h++) {
        const Y = [], X = [];
        for (let t = t0; t <= tLast - h; t++) { const x = xs(t), y = E.mAt(P12, t + h); if (x && ok(y)) { X.push(x); Y.push(y); } }
        fits[h] = S.ols(Y, X, { robust: true });
      }
      const xNow = xs(tLast);
      const path = [[tLast, E.mAt(P12, tLast), E.mAt(P12, tLast), E.mAt(P12, tLast)]];
      for (let h = 1; h <= 12; h++) { const f = fits[h]; if (!f || !xNow) continue; const m = f.predict(xNow); path.push([tLast + h, m, m - Z80 * f.sigma, m + Z80 * f.sigma]); }
      // backtest at 12 months: refit each January using only targets already observed
      const bt = []; let f12 = null, fy = null;
      for (let t = 2000 * 12; t <= tLast - 12; t++) {
        const yr = Math.floor(t / 12);
        if (yr !== fy) { const Y = [], X = []; for (let s = t0; s + 12 <= t; s++) { const x = xs(s), y = E.mAt(P12, s + 12); if (x && ok(y)) { X.push(x); Y.push(y); } } f12 = S.ols(Y, X) || f12; fy = yr; }
        const x = xs(t), y = E.mAt(P12, t + 12); if (!x || !ok(y) || !f12) continue;
        bt.push({ t, y, m: f12.predict(x), rw: x[0], mich: x[2] });
      }
      return {
        tLast, xNow, VARS, fits, path, now: E.mAt(P12, tLast), core: E.mAt(E.mYoY(E.mSeries('CPILFESL')), tLast), oil: atOrBefore(OILm, tLast, 0), oil12: E.mAt(OILm, tLast - 12),
        ugapNow: ugap(tLast), bt,
        score: { rmse: S.rmse(bt.map(b => b.m - b.y)), rw: S.rmse(bt.map(b => b.rw - b.y)), mich: S.rmse(bt.map(b => b.mich - b.y)), n: bt.length },
        forecast(h, x) { const f = fits[h]; return f && x ? f.predict(x) : null; }
      };
    });
  }

  /* ================= Taylor rule ================= */
  function taylor(o = {}) {
    const core = o.core != null ? o.core : latestCorePCE(), gap = o.gap != null ? o.gap : outputGap().v, rstar = o.rstar != null ? o.rstar : 1.0;
    if (!ok(core) || !ok(gap)) return null;
    return { core, gap, rstar, classic: rstar + core + 0.5 * (core - 2) + 0.5 * gap, balanced: rstar + core + 0.5 * (core - 2) + 1.0 * gap };
  }
  function latestCorePCE() { const y = E.mYoY(E.mSeries('PCEPILFE')); const t = E.mLast(y); return t != null ? E.mAt(y, t) : null; }
  function outputGap() { const G = E.qSeries('GDPC1'), P = E.qSeries('GDPPOT'); const q = E.qLast(G); if (q == null) return { v: null }; const a = E.qAt(G, q), b = E.qAt(P, q); return { q, v: ok(a) && ok(b) ? (a / b - 1) * 100 : null }; }

  /* ================= 4. Country growth outlook, contraction risk and backtest ================= */
  function growth() {
    return memo('growth', () => {
      const Y1 = E.VYEAR - 1;  // last year that is (mostly) actual in the WEO vintage
      const G = {};
      for (const c of E.COUNTRIES) { const s = E.imfS('NGDP_RPCH', c.iso, 1980, Y1); if (s.length >= 15) G[c.iso] = new Map(s); }
      const muAt = (m, y) => { const a = []; for (let k = y - 20; k <= y; k++) if (m.has(k)) a.push(m.get(k)); return a.length >= 8 ? S.median(a) : null; };
      const clip = v => K.clamp(v, -15, 15);
      function fitRho(yMax) { let sxy = 0, sxx = 0; for (const iso in G) { const m = G[iso]; for (const [y, g] of m) { if (y > yMax || y === 2020 || y === 2021) continue; const p = m.get(y - 1); if (!ok(p)) continue; const mu = muAt(m, y - 1); if (!ok(mu)) continue; const a = clip(p - mu), b = clip(g - mu); sxy += a * b; sxx += a * a; } } return sxx ? sxy / sxx : 0.3; }
      const rho = fitRho(Y1);
      const sig = {};
      for (const iso in G) { const m = G[iso], res = []; for (const [y, g] of m) { if (y === 2020 || y === 2021) continue; const p = m.get(y - 1), mu = muAt(m, y - 1); if (ok(p) && ok(mu)) res.push(clip(g - mu) - rho * clip(p - mu)); } const mad = S.median(res.map(Math.abs)); sig[iso] = K.clamp((mad || 1.5) * 1.4826, 0.8, 12); }
      // backtest 2000..Y1: AR model vs naive vs 20-year median
      const bt = []; const rhoBy = {};
      for (let y = 2000; y <= Y1; y++) { rhoBy[y] = fitRho(y - 1); for (const iso in G) { const m = G[iso], g = m.get(y), p = m.get(y - 1), mu = muAt(m, y - 1); if (!ok(g) || !ok(p) || !ok(mu)) continue; bt.push({ y, iso, g, m: mu + rhoBy[y] * (p - mu), naive: p, mean: mu }); } }
      const ex = bt.filter(b => b.y !== 2020 && b.y !== 2021);
      const forecast = iso => { const m = G[iso]; if (!m) return null; const last = m.get(Y1), mu = muAt(m, Y1); if (!ok(last) || !ok(mu)) return null; return { mu, next: mu + rho * (last - mu), sigma: sig[iso] }; };
      function fan(iso, n = 6, draws = 2000) {
        const f = forecast(iso); if (!f) return null;
        const R = K.rng(iso.charCodeAt(0) * 131 + iso.charCodeAt(1) * 7 + iso.charCodeAt(2));
        const imfPath = []; for (let y = E.VYEAR; y < E.VYEAR + n; y++) imfPath.push(E.imf('NGDP_RPCH', iso, y));
        const paths = [];
        for (let d = 0; d < draws; d++) {
          let dev = 0, g = G[iso].get(Y1); const p = [];
          for (let k = 0; k < n; k++) {
            const center = ok(imfPath[k]) ? imfPath[k] : f.mu + rho * (g - f.mu);
            const fat = R() < 0.1 ? 1.8 : 0.93;                       // occasional large shocks (fat tails)
            dev = rho * dev + R.norm() * f.sigma * fat * (k === 0 ? 0.55 : 1);  // this year is half observed
            g = center + dev; p.push(g);
          }
          paths.push(p);
        }
        const q = (k, pp) => S.quantile(paths.map(x => x[k]), pp);
        return { years: imfPath.map((_, k) => E.VYEAR + k), imf: imfPath, p10: imfPath.map((_, k) => q(k, .1)), p25: imfPath.map((_, k) => q(k, .25)), p50: imfPath.map((_, k) => q(k, .5)), p75: imfPath.map((_, k) => q(k, .75)), p90: imfPath.map((_, k) => q(k, .9)), pNeg: imfPath.map((_, k) => paths.filter(x => x[k] < 0).length / draws), avg5: S.quantile(paths.map(x => S.mean(x.slice(1, 6))), .5) };
      }
      function risk(iso) {
        const f = forecast(iso); if (!f) return null;
        const gCY = E.imf('NGDP_RPCH', iso, E.CY), gN = E.imf('NGDP_RPCH', iso, E.CY + 1);
        const pCY = ok(gCY) ? S.normCdf((0 - gCY) / (f.sigma * 0.55)) : null, pN = ok(gN) ? S.normCdf((0 - gN) / f.sigma) : null;
        return { gCY, gN, pCY, pN, sigma: f.sigma, model: f.next };
      }
      return {
        rho, sig, G, Y1, forecast, fan, risk, bt,
        score: { rmse: S.rmse(ex.map(b => b.m - b.g)), naive: S.rmse(ex.map(b => b.naive - b.g)), mean: S.rmse(ex.map(b => b.mean - b.g)), mae: S.mae(ex.map(b => b.m - b.g)), n: ex.length, rmseAll: S.rmse(bt.map(b => b.m - b.g)), naiveAll: S.rmse(bt.map(b => b.naive - b.g)) }
      };
    });
  }

  /* ================= 5. Economic archetypes (k-means on standardized fundamentals) ================= */
  const ARCH_FEAT = [
    { lab: 'Income per person (PPP)', f: iso => { const v = E.imf('PPPPC', iso, E.CY); return ok(v) && v > 0 ? Math.log(v) : null; } },
    { lab: '10-year growth', f: iso => E.avg('imf', 'NGDP_RPCH', iso, E.CY - 10, E.CY - 1) },
    { lab: 'Inflation (5-yr median)', f: iso => { const a = []; for (let y = E.CY - 5; y < E.CY; y++) { const v = E.imf('PCPIPCH', iso, y); if (ok(v)) a.push(v); } const m = S.median(a); return ok(m) ? Math.sign(m) * Math.log1p(Math.abs(m)) : null; } },
    { lab: 'Government debt', f: iso => E.imf('GGXWDG_NGDP', iso, E.CY) },
    { lab: 'Current account (5-yr)', f: iso => E.avg('imf', 'BCA_NGDPD', iso, E.CY - 5, E.CY - 1) },
    { lab: 'Investment', f: iso => E.wbLatest('NE.GDI.TOTL.ZS', iso).v },
    { lab: 'Government effectiveness', f: iso => E.wgiLatest('GE.EST', iso).v }
  ];
  const ARCH_T = [
    { name: 'Slow-growth, high-debt', w: [0.7, -0.6, -0.6, 1.4, 0, -0.3, 0.8], blurb: 'Higher-income economies carrying heavy public debt, with growth below the global norm.' },
    { name: 'Rich surplus economies', w: [1, -0.1, -0.6, -0.6, 0.9, -0.1, 1], blurb: 'Wealthy, well-governed economies with external surpluses and moderate debt.' },
    { name: 'Fast-growing, investment-led', w: [-0.1, 0.9, 0, -0.2, -0.5, 1.1, -0.2], blurb: 'Catching up quickly on the back of high investment.' },
    { name: 'Inflation-prone', w: [-0.9, -0.9, 2, 0.2, -0.4, -1, -1], blurb: 'Persistent high inflation, weak recent growth and weaker institutions.' },
    { name: 'Lower-income, weaker institutions', w: [-0.9, 0.1, 0, -0.3, -0.2, -0.4, -0.9], blurb: 'Lower incomes and weaker public institutions; growth is middling and volatile.' }
  ];
  function archetypes() {
    return memo('arch', () => {
      const rows = [];
      for (const c of E.COUNTRIES) { const pop = E.indById('pop').get(c.iso); if (ok(pop) && pop < 0.5) continue; const x = ARCH_FEAT.map(f => f.f(c.iso)); if (x.filter(ok).length >= 5 && ok(x[0])) rows.push({ iso: c.iso, x }); }
      const k = ARCH_FEAT.length;
      for (let j = 0; j < k; j++) { // impute with the median, then clip to the 4th-96th percentile so outliers can't form their own cluster
        const col = rows.map(r => r.x[j]), med = S.median(col), lo = S.quantile(col, .04), hi = S.quantile(col, .96);
        for (const r of rows) r.x[j] = K.clamp(ok(r.x[j]) ? r.x[j] : med, lo, hi);
      }
      const st = S.standardize(rows.map(r => r.x));
      const km = S.kmeans(st.Z, ARCH_T.length, 17, 16);
      const pca = S.pca2(st.Z);
      // name clusters by best template match (greedy unique assignment)
      const score = km.C.map(c => ARCH_T.map(t => c.reduce((s, v, j) => s + v * t.w[j], 0)));
      const names = new Array(km.C.length), used = new Set(), taken = new Set();
      for (let n = 0; n < km.C.length; n++) { let best = null; score.forEach((r, ci) => { if (taken.has(ci)) return; r.forEach((s, ti) => { if (used.has(ti)) return; if (!best || s > best.s) best = { s, ci, ti }; }); }); taken.add(best.ci); used.add(best.ti); names[best.ci] = ARCH_T[best.ti]; }
      const members = rows.map((r, i) => ({ iso: r.iso, c: km.lab[i], pc: pca.scores[i], z: st.Z[i] }));
      const byIso = {}; members.forEach(m => byIso[m.iso] = m);
      const nearest = (iso, n = 5) => { const a = byIso[iso]; if (!a) return []; return members.filter(m => m.iso !== iso).map(m => ({ iso: m.iso, d: Math.sqrt(a.z.reduce((s, v, j) => s + (v - m.z[j]) ** 2, 0)) })).sort((x, y) => x.d - y.d).slice(0, n); };
      return { members, byIso, names, C: km.C, pca, feat: ARCH_FEAT, nearest };
    });
  }

  /* ================= 6. Anomalies: this year versus each economy's own recent history ================= */
  const ANOM = [
    { id: 'NGDP_RPCH', lab: 'Growth', unit: '%' }, { id: 'PCPIPCH', lab: 'Inflation', unit: '%' }, { id: 'LUR', lab: 'Unemployment', unit: '%' },
    { id: 'GGXCNL_NGDP', lab: 'Budget balance', unit: '% GDP' }, { id: 'BCA_NGDPD', lab: 'Current account', unit: '% GDP' }
  ];
  function anomalies(iso) {
    const key = 'anom' + (iso || '');
    return memo(key, () => {
      const list = [], isos = iso ? [iso] : E.COUNTRIES.map(c => c.iso);
      for (const c of isos) for (const a of ANOM) {
        const v = E.imf(a.id, c, E.CY); if (!ok(v)) continue;
        const h = []; for (let y = E.CY - 11; y <= E.CY - 2; y++) { if (y === 2020 || y === 2021) continue; const x = E.imf(a.id, c, y); if (ok(x)) h.push(x); }
        if (h.length < 6) continue;
        const m = S.mean(h), s = Math.max(S.sd(h), a.id === 'PCPIPCH' ? 0.6 : 0.4), z = (v - m) / s;
        list.push({ iso: c, ind: a, v, m, s, z });
      }
      return list.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    });
  }

  /* ================= 7. Growth levers: cross-country panel regression (country-decades) ================= */
  const LEVERS = [
    { k: 'inv', noun: "investment as a share of GDP", lab: 'Investment (% GDP)', unit: 'pp', lever: true, dir: 1, get: (iso, a, b) => E.avg('wb', 'NE.GDI.TOTL.ZS', iso, a, b) },
    { k: 'trade', noun: "trade openness (adjusted for size)", lab: 'Trade openness, adjusted for country size', unit: 'log', lever: true, dir: 1, get: (iso, a, b) => { const v = E.avg('wb', 'NE.TRD.GNFS.ZS', iso, a, b), p = E.avg('wb', 'SP.POP.TOTL', iso, a, b); if (!ok(v) || v <= 0 || !ok(p) || p <= 0) return null; const z = tradeSize(); return Math.log(v) - z.b * (Math.log(p) - z.m); }, show: (v, iso) => { const z = tradeSize(), p = E.wbLatest('SP.POP.TOTL', iso).v; return ok(p) ? K.num(Math.exp(v + z.b * (Math.log(p) - z.m)), 0) + '% of GDP' : K.num(v, 2); } },
    { k: 'infl', noun: "inflation", lab: 'Inflation (log scale)', unit: 'log', lever: true, dir: -1, get: (iso, a, b) => { const v = E.avg('wb', 'FP.CPI.TOTL.ZG', iso, a, b); return ok(v) ? 100 * Math.log(1 + K.clamp(v, -5, 200) / 100) : null; }, show: v => K.num((Math.exp(v / 100) - 1) * 100, 1) + '% a year' },
    { k: 'ge', noun: "government effectiveness", lab: 'Government effectiveness', unit: 'idx', lever: true, dir: 1, get: (iso, a, b) => E.avg('wgi', 'GE.EST', iso, Math.max(a, 1996), b) },
    { k: 'flfp', noun: "women's labor force participation", lab: 'Female labor participation', unit: 'pp', lever: true, dir: 1, get: (iso, a, b) => E.avg('wb', 'SL.TLF.CACT.FE.ZS', iso, a, b) },
    { k: 'debt', noun: "starting government debt", lab: 'Government debt at start (% GDP)', unit: 'pp', lever: true, dir: -1, get: (iso, a) => E.imf('GGXWDG_NGDP', iso, a) },
    { k: 'popg', noun: "population growth", lab: 'Population growth', unit: 'pp', lever: false, get: (iso, a, b) => E.avg('wb', 'SP.POP.GROW', iso, a, b) },
    { k: 'lny0', noun: "starting income", lab: 'Starting income (log GDP per person, PPP)', unit: 'log', lever: false, get: (iso, a) => { const v = E.wb('NY.GDP.PCAP.PP.KD', iso, a) || E.wb('NY.GDP.PCAP.PP.KD', iso, a + 1); return ok(v) && v > 0 ? Math.log(v) : null; } }
  ];
  let TS = null;
  function tradeSize() { // big countries trade less relative to GDP: ln(trade) = a + b ln(population)
    if (TS) return TS;
    const y = [], x = [];
    for (const c of E.COUNTRIES) { const t = E.avg('wb', 'NE.TRD.GNFS.ZS', c.iso, E.VYEAR - 10, E.VYEAR - 1), p = E.avg('wb', 'SP.POP.TOTL', c.iso, E.VYEAR - 10, E.VYEAR - 1); if (ok(t) && t > 0 && ok(p) && p > 5e5) { y.push(Math.log(t)); x.push([Math.log(p)]); } }
    const f = S.ols(y, x);
    TS = { b: f ? f.b[1] : -0.2, m: S.mean(x.map(v => v[0])), r2: f ? f.r2 : null };
    return TS;
  }
  function levers() {
    return memo('lev', () => {
      const PER = [[1996, 2005], [2006, 2015], [2016, E.VYEAR - 1]];
      const rows = [];
      for (const c of E.COUNTRIES) {
        const pop = E.indById('pop').get(c.iso); if (!ok(pop) || pop < 1) continue;
        PER.forEach(([a, b], pi) => {
          const y = E.avg('wb', 'NY.GDP.PCAP.KD.ZG', c.iso, a, b); if (!ok(y)) return;
          const x = LEVERS.map(L => L.get(c.iso, a, b)); if (!x.every(ok)) return;
          rows.push({ iso: c.iso, p: pi, y: K.clamp(y, -10, 15), x: x.concat([pi === 1 ? 1 : 0, pi === 2 ? 1 : 0]) });
        });
      }
      const fit = S.ols(rows.map(r => r.y), rows.map(r => r.x), { robust: true });
      if (!fit) return null;
      const coef = LEVERS.map((L, j) => ({ ...L, b: fit.b[j + 1], se: fit.se[j + 1], p: fit.p[j + 1] }));
      const latest = iso => { const a = E.VYEAR - 5, b = E.VYEAR - 1; return LEVERS.map(L => L.k === 'debt' ? E.imf('GGXWDG_NGDP', iso, E.CY) : L.k === 'lny0' ? (() => { const v = E.wbLatest('NY.GDP.PCAP.PP.KD', iso).v; return ok(v) ? Math.log(v) : null; })() : L.get(iso, a, b)); };
      return { fit, coef, rows, n: rows.length, countries: new Set(rows.map(r => r.iso)).size, latest, PER };
    });
  }
  function leverTargets(iso) { // income-group peers' 75th percentile (or 25th for lower-is-better levers)
    const lv = levers(); if (!lv) return null;
    const peers = E.peers(iso).map(c => c.iso), mine = lv.latest(iso);
    const vals = peers.map(p => lv.latest(p));
    return lv.coef.map((L, j) => {
      if (!L.lever) return null;
      const dist = vals.map(v => v[j]).filter(ok);
      const pct = S.pctRank(dist, mine[j]), below = L.dir > 0 ? pct < 0.5 : pct > 0.5;
      // realistic target: the peer median when lagging peers, otherwise the best quartile
      let tgt = S.quantile(dist, L.dir > 0 ? (below ? 0.5 : 0.75) : (below ? 0.5 : 0.25));
      const ahead = ok(mine[j]) && (L.dir > 0 ? mine[j] >= tgt : mine[j] <= tgt);
      if (ahead) tgt = mine[j];  // already at or beyond the best quartile: no gap to close
      return { L, j, cur: mine[j], tgt, med: S.median(dist), pct, n: dist.length, ahead };
    });
  }

  /* ================= 8. Public debt dynamics with Monte Carlo ================= */
  function debtBase(iso) {
    const d0 = E.imf('GGXWDG_NGDP', iso, E.CY); if (!ok(d0)) return null;
    const yrs = [], g = [], pi = [], ob = [];
    for (let y = E.CY; y <= E.CY + 10; y++) {
      const gy = E.imf('NGDP_RPCH', iso, y), py = E.imf('PCPIPCH', iso, y), by = E.imf('GGXCNL_NGDP', iso, y);
      yrs.push(y); g.push(ok(gy) ? gy : g[g.length - 1]); pi.push(ok(py) ? Math.min(py, 60) : pi[pi.length - 1]); ob.push(ok(by) ? by : ob[ob.length - 1]);
    }
    if (!g.every(ok) || !pi.every(ok) || !ob.every(ok)) return null;
    // default effective interest rate: US from federal interest outlays; others: recent nominal growth minus 1 point (r − g of about −1)
    let i0;
    if (iso === 'USA') { const a = E.aSeries('FYOIGDA188S'), dq = E.qSeries('GFDEGDQ188S'); const ia = a ? a.v[a.v.length - 1] : null, dd = dq ? E.qAt(dq, E.qLast(dq)) : null; i0 = ok(ia) && ok(dd) && dd > 0 ? ia / dd * 100 : 3.2; }
    else { const gn = []; for (let y = E.CY - 10; y < E.CY; y++) { const a = E.imf('NGDP_RPCH', iso, y), b = E.imf('PCPIPCH', iso, y); if (ok(a) && ok(b)) gn.push((1 + a / 100) * (1 + Math.min(b, 60) / 100) * 100 - 100); } i0 = K.clamp((S.median(gn) || 5) - 1, 0.5, 25); }
    const sigma = (growth().sig[iso]) || 2;
    // stock-flow adjustment so the baseline reproduces the IMF debt path where the IMF publishes one
    const sfa = [];
    for (let k = 0; k < yrs.length - 1; k++) { const a = E.imf('GGXWDG_NGDP', iso, yrs[k]), b = E.imf('GGXWDG_NGDP', iso, yrs[k + 1]); const gn = (1 + g[k + 1] / 100) * (1 + pi[k + 1] / 100) - 1; sfa.push(ok(a) && ok(b) ? b - (a / (1 + gn) - ob[k + 1]) : null); }
    const sm = S.mean(sfa.filter(ok)) || 0; for (let k = 0; k < sfa.length; k++) if (!ok(sfa[k])) sfa[k] = sm;
    const imfEnd = (() => { let y = null; for (const yy of yrs) if (ok(E.imf('GGXWDG_NGDP', iso, yy))) y = yy; return y; })();
    return { iso, d0, yrs, g, pi, ob, i0, sigma, sfa, imfEnd };
  }
  function debtSim(base, sc = {}, draws = 1500) {
    const di = sc.di || 0, dg = sc.dg || 0, dpb = sc.dpb || 0, dpi = sc.dpi || 0, n = base.yrs.length - 1;
    const i = base.i0 + di;
    // baseline primary balance consistent with IMF overall balance and our interest-rate assumption
    const pbBase = []; { let d = base.d0; for (let k = 0; k < n; k++) { const gn = (1 + base.g[k + 1] / 100) * (1 + base.pi[k + 1] / 100) - 1; pbBase.push(base.ob[k + 1] + base.i0 / 100 * d / (1 + gn)); d = d / (1 + gn) - base.ob[k + 1] + base.sfa[k]; } }
    const step = (d, k, gShock, piShock) => { const gn = (1 + (base.g[k + 1] + dg + gShock) / 100) * (1 + (base.pi[k + 1] + dpi + piShock) / 100) - 1; return d * (1 + i / 100) / (1 + gn) - (pbBase[k] + dpb) + base.sfa[k]; };
    const central = [base.d0]; { let d = base.d0; for (let k = 0; k < n; k++) { d = step(d, k, 0, 0); central.push(d); } }
    const R = K.rng(99 + base.iso.charCodeAt(0));
    const paths = [];
    for (let s = 0; s < draws; s++) { let d = base.d0, e = 0; const p = [d]; for (let k = 0; k < n; k++) { e = 0.35 * e + R.norm() * base.sigma; d = step(d, k, e, 0.4 * e + R.norm() * 0.6); p.push(d); } paths.push(p); }
    const q = (k, pp) => S.quantile(paths.map(x => x[k]), pp);
    const last = n, dN = central[last];
    const gnEnd = (1 + (base.g[n] + dg) / 100) * (1 + (base.pi[n] + dpi) / 100) - 1;
    return {
      yrs: base.yrs, central, p10: base.yrs.map((_, k) => q(k, .1)), p90: base.yrs.map((_, k) => q(k, .9)), p25: base.yrs.map((_, k) => q(k, .25)), p75: base.yrs.map((_, k) => q(k, .75)),
      pUp: paths.filter(p => p[last] > base.d0 + 10).length / draws, p100: paths.filter(p => p[last] > Math.max(100, base.d0)).length / draws,
      stabPB: dN * (i / 100 - gnEnd) / (1 + gnEnd), pbEnd: pbBase[n - 1] + dpb, i, rg: i - gnEnd * 100
    };
  }

  /* ================= 9. US macro what-if (re-runs the recession and inflation models) ================= */
  function usScenario(sc) {
    const rec = recession(), inf = inflation();
    const spread = sc.y10 - sc.y3m, rff = sc.ff - sc.core;
    const pC = rec.models.classic ? rec.models.classic.fit.prob([spread]) : null;
    const pE = rec.models.extended ? rec.models.extended.fit.prob([spread, rff, sc.nfci]) : null;
    let path = null;
    if (inf && inf.xNow) {
      const x = inf.xNow.slice();
      x[2] = sc.mich; x[3] = sc.unemp - (inf.xNow[3] != null ? (E.mAt(E.mSeries('UNRATE'), inf.tLast) - inf.xNow[3]) : 4.2);
      x[4] = ok(inf.oil12) && inf.oil12 > 0 ? (sc.oil / inf.oil12 - 1) * 100 : x[4];
      path = [[inf.tLast, inf.now]]; for (let h = 1; h <= 12; h++) path.push([inf.tLast + h, inf.forecast(h, x)]);
    }
    const ty = taylor({ core: sc.corePCE, gap: sc.gap, rstar: sc.rstar });
    return { spread, rff, pC, pE, path, taylor: ty };
  }

  return { tradeSize, recession, recessionProb, nowcast, inflation, taylor, latestCorePCE, outputGap, growth, archetypes, ARCH_T, anomalies, levers, leverTargets, LEVERS, debtBase, debtSim, usScenario, NOW_IND };
})();
