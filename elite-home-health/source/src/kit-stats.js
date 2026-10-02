/* Probable Atlas kit: statistics toolkit (descriptive stats, OLS with robust errors, probit, scoring, clustering, PCA). */
const S = (() => {
  const ok = v => v != null && typeof v === 'number' && isFinite(v);
  const clean = a => a.filter(ok);
  const sum = a => { let s = 0; for (const v of a) s += v; return s; };
  const mean = a => { a = clean(a); return a.length ? sum(a) / a.length : null; };
  function variance(a) { a = clean(a); if (a.length < 2) return null; const m = sum(a) / a.length; let s = 0; for (const v of a) s += (v - m) ** 2; return s / (a.length - 1); }
  const sd = a => { const v = variance(a); return v == null ? null : Math.sqrt(v); };
  function quantile(a, p) { a = clean(a).sort((x, y) => x - y); if (!a.length) return null; const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); }
  const median = a => quantile(a, 0.5);
  function pctRank(a, x) { a = clean(a); if (!a.length || !ok(x)) return null; let below = 0, eq = 0; for (const v of a) { if (v < x) below++; else if (v === x) eq++; } return (below + 0.5 * eq) / a.length; }
  function corr(x, y) {
    const px = [], py = [];
    for (let i = 0; i < x.length; i++) if (ok(x[i]) && ok(y[i])) { px.push(x[i]); py.push(y[i]); }
    const n = px.length; if (n < 3) return null;
    const mx = sum(px) / n, my = sum(py) / n; let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = px[i] - mx, dy = py[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
  }

  /* ---- distributions ---- */
  function erf(x) { // Abramowitz-Stegun 7.1.26 refined via higher-precision series for small x
    const s = Math.sign(x); x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function normCdf(z) { // high accuracy (W. J. Cody style via complementary error function)
    if (!ok(z)) return null;
    if (z < -38) return 0; if (z > 38) return 1;
    const a = Math.abs(z), t = 1 / (1 + 0.2316419 * a);
    const d = 0.3989422804014327 * Math.exp(-a * a / 2);
    const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return z > 0 ? 1 - p : p;
  }
  const normPdf = z => 0.3989422804014327 * Math.exp(-z * z / 2);
  function normInv(p) { // Acklam
    if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425; let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  function lgamma(x) { const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61503916999185, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x); x -= 1; let a = c[0]; const t = x + g + 0.5; for (let i = 1; i < 9; i++) a += c[i] / (x + i); return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a); }
  function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d; for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c; aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; } return h; }
  function ibeta(x, a, b) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
  const tPval = (t, df) => ok(t) && df > 0 ? ibeta(df / (df + t * t), df / 2, 0.5) : null; // two-sided
  function tCrit(df, p = 0.975) { if (df > 200) return normInv(p); let lo = 0, hi = 50; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; (1 - tPval(m, df) / 2 < p) ? lo = m : hi = m; } return (lo + hi) / 2; }

  /* ---- linear algebra (small k) ---- */
  function inv(A) {
    const n = A.length, M = A.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => i === j ? 1 : 0)));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      [M[c], M[p]] = [M[p], M[c]];
      const d = M[c][c]; for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
    }
    return M.map(r => r.slice(n));
  }
  const matVec = (A, v) => A.map(r => r.reduce((s, x, j) => s + x * v[j], 0));

  /* ---- OLS: X rows WITHOUT intercept; intercept added. Returns coefficients, SEs (HC1 robust if robust), fit stats ---- */
  function ols(y, X, opt = {}) {
    const rows = [], ys = [];
    for (let i = 0; i < y.length; i++) { const x = X[i]; if (!ok(y[i]) || !x || x.some(v => !ok(v))) continue; rows.push([1].concat(x)); ys.push(y[i]); }
    const n = rows.length, k = rows[0] ? rows[0].length : 0;
    if (n <= k + 1) return null;
    const XtX = Array.from({ length: k }, () => new Array(k).fill(0)), Xty = new Array(k).fill(0);
    for (let i = 0; i < n; i++) { const r = rows[i]; for (let a = 0; a < k; a++) { Xty[a] += r[a] * ys[i]; for (let b = a; b < k; b++) XtX[a][b] += r[a] * r[b]; } }
    for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) XtX[a][b] = XtX[b][a];
    const XtXi = inv(XtX); if (!XtXi) return null;
    const b = matVec(XtXi, Xty);
    const fit = rows.map(r => r.reduce((s, v, j) => s + v * b[j], 0)), res = ys.map((v, i) => v - fit[i]);
    const my = sum(ys) / n, sst = ys.reduce((s, v) => s + (v - my) ** 2, 0), sse = res.reduce((s, v) => s + v * v, 0);
    const df = n - k, s2 = sse / df;
    let cov;
    if (opt.robust) { // HC1
      const meat = Array.from({ length: k }, () => new Array(k).fill(0));
      for (let i = 0; i < n; i++) { const r = rows[i], e2 = res[i] * res[i]; for (let a = 0; a < k; a++) for (let c = 0; c < k; c++) meat[a][c] += e2 * r[a] * r[c]; }
      const tmp = XtXi.map(row => meat[0].map((_, j) => row.reduce((s, v, m) => s + v * meat[m][j], 0)));
      cov = tmp.map(row => XtXi[0].map((_, j) => row.reduce((s, v, m) => s + v * XtXi[m][j], 0) * n / df));
    } else cov = XtXi.map(r => r.map(v => v * s2));
    const se = cov.map((r, i) => Math.sqrt(Math.max(r[i], 0)));
    const t = b.map((v, i) => v / se[i]), p = t.map(v => tPval(v, df));
    return {
      b, se, t, p, cov, n, k, df, r2: sst ? 1 - sse / sst : null, adjR2: sst ? 1 - (sse / df) / (sst / (n - 1)) : null,
      rmse: Math.sqrt(sse / n), sigma: Math.sqrt(s2), resid: res, fitted: fit,
      predict: x => [1].concat(x).reduce((s, v, j) => s + v * b[j], 0),
      predSE: x => { const r = [1].concat(x); let v = 0; for (let a = 0; a < k; a++) for (let c = 0; c < k; c++) v += r[a] * cov[a][c] * r[c]; return Math.sqrt(Math.max(v, 0)); }
    };
  }

  /* ---- probit by Newton-Raphson ---- */
  function probit(y, X, opt = {}) {
    const rows = [], ys = [];
    for (let i = 0; i < y.length; i++) { const x = X[i]; if (!ok(y[i]) || !x || x.some(v => !ok(v))) continue; rows.push([1].concat(x)); ys.push(y[i] ? 1 : 0); }
    const n = rows.length, k = rows[0] ? rows[0].length : 0;
    if (n < k + 5) return null;
    const ybar = sum(ys) / n; if (ybar <= 0 || ybar >= 1) return null;
    let b = opt.start ? opt.start.slice() : [normInv(ybar)].concat(new Array(k - 1).fill(0));
    let ll = -Infinity, H = null;
    for (let it = 0; it < 60; it++) {
      const g = new Array(k).fill(0); H = Array.from({ length: k }, () => new Array(k).fill(0)); let L = 0;
      for (let i = 0; i < n; i++) {
        const r = rows[i], xb = r.reduce((s, v, j) => s + v * b[j], 0);
        const P = Math.min(Math.max(normCdf(xb), 1e-12), 1 - 1e-12), ph = normPdf(xb);
        L += ys[i] ? Math.log(P) : Math.log(1 - P);
        const lam = ys[i] ? ph / P : -ph / (1 - P);
        const w = lam * (lam + xb);
        for (let a = 0; a < k; a++) { g[a] += lam * r[a]; for (let c = a; c < k; c++) H[a][c] -= w * r[a] * r[c]; }
      }
      for (let a = 0; a < k; a++) for (let c = 0; c < a; c++) H[a][c] = H[c][a];
      const Hi = inv(H.map(r => r.map(v => -v))); if (!Hi) break;
      const step = matVec(Hi, g);
      b = b.map((v, i) => v + step[i]);
      if (Math.abs(L - ll) < 1e-9) { ll = L; break; }
      ll = L;
    }
    const cov = inv(H.map(r => r.map(v => -v))) || H.map(r => r.map(() => NaN));
    const se = cov.map((r, i) => Math.sqrt(Math.max(r[i], 0)));
    const ll0 = n * (ybar * Math.log(ybar) + (1 - ybar) * Math.log(1 - ybar));
    const z = b.map((v, i) => v / se[i]);
    return { b, se, z, p: z.map(v => 2 * (1 - normCdf(Math.abs(v)))), n, ll, pseudoR2: 1 - ll / ll0, prob: x => normCdf([1].concat(x).reduce((s, v, j) => s + v * b[j], 0)) };
  }

  /* ---- forecast scoring ---- */
  function auc(scores, labels) {
    const pts = []; for (let i = 0; i < scores.length; i++) if (ok(scores[i]) && labels[i] != null) pts.push([scores[i], labels[i] ? 1 : 0]);
    const pos = pts.filter(p => p[1]).length, neg = pts.length - pos; if (!pos || !neg) return null;
    pts.sort((a, b) => a[0] - b[0]);
    let rank = 0, rsum = 0, i = 0;
    while (i < pts.length) { let j = i; while (j < pts.length && pts[j][0] === pts[i][0]) j++; const r = (i + j + 1) / 2; for (let m = i; m < j; m++) if (pts[m][1]) rsum += r; i = j; }
    return (rsum - pos * (pos + 1) / 2) / (pos * neg);
  }
  function brier(p, y) { let s = 0, n = 0; for (let i = 0; i < p.length; i++) if (ok(p[i]) && y[i] != null) { s += (p[i] - (y[i] ? 1 : 0)) ** 2; n++; } return n ? s / n : null; }
  function rmse(err) { const e = clean(err); return e.length ? Math.sqrt(e.reduce((s, v) => s + v * v, 0) / e.length) : null; }
  function mae(err) { const e = clean(err); return e.length ? e.reduce((s, v) => s + Math.abs(v), 0) / e.length : null; }

  /* ---- standardize, k-means (k-means++ with restarts), PCA (power iteration) ---- */
  function standardize(M) { // columns
    const k = M[0].length, mu = [], sg = [];
    for (let j = 0; j < k; j++) { const col = M.map(r => r[j]); mu.push(mean(col)); sg.push(sd(col) || 1); }
    return { Z: M.map(r => r.map((v, j) => (v - mu[j]) / sg[j])), mu, sg };
  }
  const d2 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return s; };
  function kmeans(Z, k, seed = 11, restarts = 12) {
    const R = K.rng(seed); let best = null;
    for (let rs = 0; rs < restarts; rs++) {
      const C = [Z[Math.floor(R() * Z.length)].slice()];
      while (C.length < k) { const w = Z.map(z => Math.min(...C.map(c => d2(z, c)))), tot = sum(w); let u = R() * tot, i = 0; while (u > w[i] && i < w.length - 1) { u -= w[i]; i++; } C.push(Z[i].slice()); }
      let lab = new Array(Z.length).fill(0);
      for (let it = 0; it < 100; it++) {
        let moved = false;
        Z.forEach((z, i) => { let bi = 0, bd = Infinity; C.forEach((c, j) => { const d = d2(z, c); if (d < bd) { bd = d; bi = j; } }); if (lab[i] !== bi) { lab[i] = bi; moved = true; } });
        for (let j = 0; j < k; j++) { const mem = Z.filter((_, i) => lab[i] === j); if (mem.length) C[j] = mem[0].map((_, c) => mean(mem.map(m => m[c]))); }
        if (!moved && it) break;
      }
      const inertia = Z.reduce((s, z, i) => s + d2(z, C[lab[i]]), 0);
      if (!best || inertia < best.inertia) best = { lab, C, inertia };
    }
    return best;
  }
  function pca2(Z) {
    const n = Z.length, k = Z[0].length;
    const Cv = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, b) => Z.reduce((s, r) => s + r[a] * r[b], 0) / (n - 1)));
    const comps = [], vals = []; let M = Cv.map(r => r.slice());
    for (let c = 0; c < 2; c++) {
      let v = new Array(k).fill(0).map((_, i) => 1 / Math.sqrt(k) + i * 1e-3);
      for (let it = 0; it < 300; it++) { const w = matVec(M, v), nn = Math.sqrt(sum(w.map(x => x * x))) || 1; v = w.map(x => x / nn); }
      const lam = v.reduce((s, x, i) => s + x * matVec(M, v)[i], 0);
      comps.push(v); vals.push(lam);
      M = M.map((r, a) => r.map((x, b) => x - lam * v[a] * v[b]));
    }
    const tot = Cv.reduce((s, r, i) => s + r[i], 0);
    return { comps, share: vals.map(v => v / tot), scores: Z.map(r => comps.map(c => r.reduce((s, x, i) => s + x * c[i], 0))) };
  }

  return { ok, clean, sum, mean, variance, sd, quantile, median, pctRank, corr, normCdf, normPdf, normInv, tPval, tCrit, inv, ols, probit, auc, brier, rmse, mae, standardize, kmeans, pca2 };
})();
