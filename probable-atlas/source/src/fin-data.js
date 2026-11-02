/* Probable Atlas · Finance: data layer (daily market panel since 1990, S&P 500 since 1928, Shiller since 1871, French factors since 1926). */
const F = (() => {
  const { ok } = K;
  let P = null, L = null, ST = null;
  let CAL = [], N = 0, X = null, ORD = null;
  const SER = new Map();
  const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
  const DAY = 864e5;

  async function load() {
    if (window.ATLAS_FIN_DATA) ({ panel: P, long: L, status: ST } = window.ATLAS_FIN_DATA);
    else {
      const get = async n => {
        for (const base of ['../data/', 'data/', 'snapshot/']) {
          try { const r = await fetch(base + n, { cache: 'no-cache' }); if (r.ok) return await r.json(); } catch (e) { /* try next */ }
        }
        throw new Error('Could not load ' + n);
      };
      [P, L, ST] = await Promise.all([get('markets.json'), get('markets-long.json').catch(() => null), get('mstatus.json').catch(() => ({}))]);
    }
    prep();
  }

  /* ---- calendar ---- */
  const isoToOrd = s => Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY);
  const ordToIso = o => new Date(o * DAY).toISOString().slice(0, 10);
  function fracYear(o) { const d = new Date(o * DAY), y = d.getUTCFullYear(), a = Date.UTC(y, 0, 1) / DAY, b = Date.UTC(y + 1, 0, 1) / DAY; return y + (o - a + 0.5) / (b - a); }
  function decCal(c) {
    const out = [c.d0]; let o = isoToOrd(c.d0); const ords = [o];
    for (const ch of c.g) { o += B36.indexOf(ch); ords.push(o); out.push(ordToIso(o)); }
    return { iso: out, ord: ords };
  }
  function prep() {
    const c = decCal(P.cal); CAL = c.iso; ORD = c.ord; N = CAL.length;
    X = new Float64Array(N); for (let i = 0; i < N; i++) X[i] = fracYear(ORD[i]);
    SER.clear(); MONTH = null; WEEK = null; LONGSPX = null;
  }
  // binary search: last index with CAL[i] <= iso (or -1)
  function idx(iso) { let lo = 0, hi = N - 1; if (iso < CAL[0]) return -1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (CAL[m] <= iso) lo = m; else hi = m - 1; } return lo; }
  function idxX(x) { let lo = 0, hi = N - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (X[m] < x) lo = m; else hi = m; } return Math.abs(X[lo] - x) <= Math.abs(X[hi] - x) ? lo : hi; }
  const xLab = x => K.isoLab(CAL[idxX(x)]);

  /* ---- series (decoded lazily onto the full calendar; NaN outside the series' span) ---- */
  function ser(id) {
    if (SER.has(id)) return SER.get(id);
    const s = P.s[id]; if (!s) return null;
    const v = new Float64Array(N).fill(NaN); let acc = 0;
    for (let i = 0; i < s.d.length; i++) { acc += s.d[i]; v[s.s + i] = s.e === 'l' ? Math.exp(acc / 1e4) : acc / s.k; }
    const meta = P.meta[id], fm = P.fred[id];
    const o = { id, v, s: s.s, e: s.s + s.d.length - 1, log: s.e === 'l', name: meta ? meta[0] : fm ? fm[0] : id, cls: meta ? meta[1] : 'rate', grp: meta ? meta[2] : 'fred', cur: meta ? meta[3] : '', unit: fm ? fm[1] : '', q: P.q[id] || null };
    SER.set(id, o); return o;
  }
  const has = id => !!P.s[id];
  const at = (id, i) => { const s = ser(id); return s && i >= s.s && i <= s.e ? s.v[i] : NaN; };
  const lastIdx = id => { const s = ser(id); return s ? s.e : -1; };
  const lastVal = id => { const s = ser(id); return s ? s.v[s.e] : NaN; };
  function quote(id) {
    const s = ser(id); if (!s) return null;
    const q = s.q;
    if (q && ok(q[0])) {
      const chg = ok(q[1]) ? q[0] - q[1] : null;
      return { last: q[0], prev: q[1], chg, pct: chg != null && s.log ? chg / q[1] * 100 : null, date: q[2] };
    }
    const v = s.v[s.e], p = s.v[s.e - 1];
    return { last: v, prev: p, chg: v - p, pct: s.log ? (v / p - 1) * 100 : null, date: CAL[s.e] };
  }
  // change over n trading days ending at i (default latest): % for prices, percentage points for rates
  function chg(id, n, i) {
    const s = ser(id); if (!s) return null;
    const e = i == null ? s.e : Math.min(i, s.e), b = e - n;
    if (b < s.s) return null;
    return s.log ? (s.v[e] / s.v[b] - 1) * 100 : s.v[e] - s.v[b];
  }
  function chgSince(id, iso, i) { // change since the close on or before a date
    const s = ser(id); if (!s) return null;
    const e = i == null ? s.e : Math.min(i, s.e), b = idx(iso);
    if (b < s.s || b >= e) return null;
    return s.log ? (s.v[e] / s.v[b] - 1) * 100 : s.v[e] - s.v[b];
  }
  const ytdBase = () => { const y = CAL[N - 1].slice(0, 4); return (+y - 1) + '-12-31'; };
  const ytd = id => chgSince(id, ytdBase());
  function annRet(id, years, i) { // annualized total return over the last N years (null if history too short)
    const s = ser(id); if (!s || !s.log) return null;
    const e = i == null ? s.e : i, tgt = ordToIso(ORD[e] - Math.round(years * 365.25)), b = idx(tgt);
    if (b < s.s || (ORD[e] - ORD[b]) < years * 365.25 - 10) return null;
    return (Math.pow(s.v[e] / s.v[b], 365.25 / (ORD[e] - ORD[b])) - 1) * 100;
  }
  function rets(id, i0, i1) { // daily log returns between indices (inclusive end), skipping gaps
    const s = ser(id), out = []; if (!s) return out;
    const a = Math.max(i0, s.s + 1), b = Math.min(i1, s.e);
    for (let i = a; i <= b; i++) { const r = s.log ? Math.log(s.v[i] / s.v[i - 1]) : s.v[i] - s.v[i - 1]; if (ok(r)) out.push(r); }
    return out;
  }
  function vol(id, n = 252, i) { const s = ser(id); if (!s) return null; const e = i == null ? s.e : i; const r = rets(id, e - n + 1, e); return r.length > n * 0.6 ? S.sd(r) * Math.sqrt(252) * 100 : null; }
  function sma(id, n, i) { const s = ser(id); if (!s) return null; const e = i == null ? s.e : i; if (e - n + 1 < s.s) return null; let t = 0; for (let k = e - n + 1; k <= e; k++) t += s.v[k]; return t / n; }
  function drawdown(id, i) { // from the running high within the panel
    const s = ser(id); if (!s) return null; const e = i == null ? s.e : i; let hi = -Infinity, hiI = s.s;
    for (let k = s.s; k <= e; k++) if (s.v[k] > hi) { hi = s.v[k]; hiI = k; }
    return { dd: (s.v[e] / hi - 1) * 100, high: hi, highDate: CAL[hiI], highIdx: hiI };
  }
  function maxDD(id, i0, i1) {
    const s = ser(id); if (!s) return null; const a = Math.max(i0 == null ? s.s : i0, s.s), b = Math.min(i1 == null ? s.e : i1, s.e);
    let hi = -Infinity, mdd = 0, pk = a, tr = a, curPk = a;
    for (let k = a; k <= b; k++) { if (s.v[k] > hi) { hi = s.v[k]; curPk = k; } const d = s.v[k] / hi - 1; if (d < mdd) { mdd = d; pk = curPk; tr = k; } }
    return { mdd: mdd * 100, peak: CAL[pk], trough: CAL[tr] };
  }
  function hi52(id) { const s = ser(id); if (!s) return null; let hi = -Infinity, lo = Infinity; for (let k = Math.max(s.s, s.e - 251); k <= s.e; k++) { hi = Math.max(hi, s.v[k]); lo = Math.min(lo, s.v[k]); } return { hi, lo, pos: hi > lo ? (s.v[s.e] - lo) / (hi - lo) : 0.5 }; }

  /* ---- chart points (min/max bucketing keeps spikes visible) ---- */
  function pts(id, i0, i1, maxN = 900, tf) {
    const s = ser(id); if (!s) return [];
    const a = Math.max(i0, s.s), b = Math.min(i1, s.e); if (b < a) return [];
    const f = tf || (v => v), n = b - a + 1, out = [];
    if (n <= maxN) { for (let i = a; i <= b; i++) { const y = f(s.v[i], i); if (ok(y)) out.push([X[i], y]); } return out; }
    const bucket = Math.ceil(n / (maxN / 2));
    for (let st = a; st <= b; st += bucket) {
      let mi = -1, ma = -1;
      for (let i = st; i < Math.min(b + 1, st + bucket); i++) { const y = f(s.v[i], i); if (!ok(y)) continue; if (mi < 0 || y < f(s.v[mi], mi)) mi = i; if (ma < 0 || y > f(s.v[ma], ma)) ma = i; }
      if (mi < 0) continue;
      const pair = mi < ma ? [mi, ma] : mi > ma ? [ma, mi] : [mi];
      for (const i of pair) out.push([X[i], f(s.v[i], i)]);
    }
    if (out.length && out[out.length - 1][0] !== X[b]) out.push([X[b], f(s.v[b], b)]);
    return out;
  }
  function seriesPts(arr, i0, i1, maxN = 900) { // arbitrary Float64Array aligned to CAL
    const out = [], n = i1 - i0 + 1, step = Math.max(1, Math.floor(n / maxN));
    for (let i = i0; i <= i1; i += step) if (ok(arr[i])) out.push([X[i], arr[i]]);
    if (ok(arr[i1]) && (!out.length || out[out.length - 1][0] !== X[i1])) out.push([X[i1], arr[i1]]);
    return out;
  }

  /* ---- month-end and week-end sampling ---- */
  let MONTH = null, WEEK = null;
  function monthEnds() {
    if (MONTH) return MONTH;
    const ix = [], keys = [];
    for (let i = 0; i < N; i++) { const k = CAL[i].slice(0, 7); if (i === N - 1 || CAL[i + 1].slice(0, 7) !== k) { ix.push(i); keys.push(k); } }
    return (MONTH = { ix, keys });
  }
  function weekEnds() {
    if (WEEK) return WEEK;
    const ix = []; const wk = o => Math.floor((o + 3) / 7); // Monday-start weeks (1970-01-01 was a Thursday)
    for (let i = 0; i < N; i++) if (i === N - 1 || wk(ORD[i + 1]) !== wk(ORD[i])) ix.push(i);
    return (WEEK = { ix });
  }
  function sampled(id, ix) { const s = ser(id); return ix.map(i => (s && i >= s.s && i <= s.e) ? s.v[i] : NaN); }
  function sampledRets(id, ix) { // simple returns between consecutive sample points (NaN where unavailable)
    const v = sampled(id, ix), s = ser(id), out = new Float64Array(ix.length).fill(NaN);
    for (let k = 1; k < ix.length; k++) if (ok(v[k]) && ok(v[k - 1])) out[k] = s.log ? v[k] / v[k - 1] - 1 : v[k] - v[k - 1];
    return out;
  }

  /* ---- long history ---- */
  let LONGSPX = null;
  function spxLong() { // S&P 500 price index, daily since 1928 (price only, no dividends)
    if (LONGSPX) return LONGSPX;
    const iso = [], val = [];
    if (L && L.gspc) {
      const c = decCal(L.gspc.cal); let acc = 0;
      for (let i = 0; i < L.gspc.d.length; i++) { acc += L.gspc.d[i]; iso.push(c.iso[i]); val.push(Math.exp(acc / 1e4)); }
    }
    const g = ser('^GSPC');
    for (let i = g.s; i <= g.e; i++) if (!iso.length || CAL[i] > iso[iso.length - 1]) { iso.push(CAL[i]); val.push(g.v[i]); }
    const x = iso.map(s => fracYear(isoToOrd(s)));
    return (LONGSPX = { iso, v: val, x });
  }
  const shiller = () => (L && L.shiller) || null;
  const french = () => (L && L.ff) || null;
  const ymX = (s0, k) => { const y0 = +s0.slice(0, 4), m0 = +s0.slice(5, 7) - 1, t = y0 * 12 + m0 + k; return Math.floor(t / 12) + ((t % 12) + 0.5) / 12; };
  const ymKey = (s0, k) => { const y0 = +s0.slice(0, 4), m0 = +s0.slice(5, 7) - 1, t = y0 * 12 + m0 + k; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };

  /* ---- macro context ---- */
  function recessions() { // [[x0, x1], ...] from NBER USREC (monthly)
    const r = P.macro && P.macro.m && P.macro.m.USREC; if (!r) return [];
    const out = []; let st = null;
    r.v.forEach((v, k) => { const x = ymX(r.s, k) - 0.5 / 12; if (v === 1 && st == null) st = x; if (v !== 1 && st != null) { out.push([st, x]); st = null; } });
    if (st != null) out.push([st, ymX(r.s, r.v.length)]);
    return out;
  }
  function macroM(id) { const r = P.macro && P.macro.m && P.macro.m[id]; return r || null; }
  function macroQ(id) { const r = P.macro && P.macro.q && P.macro.q[id]; return r || null; }
  function lastOf(r) { if (!r) return null; for (let k = r.v.length - 1; k >= 0; k--) if (ok(r.v[k])) return { v: r.v[k], key: ymKey(r.s, k), k }; return null; }

  /* ---- catalog ---- */
  const GROUPS = [['us', 'US indexes'], ['core', 'Core asset classes'], ['style', 'US styles & factors'], ['sector', 'US sectors'], ['world', 'World stock markets'], ['macro', 'Dollar & commodities'], ['fred', 'Rates, credit & FX']];
  function assets(grp) { return Object.keys(P.s).filter(id => (ser(id).grp === grp)); }
  const CLS = { eq: 'Stocks', bd: 'Bonds', ra: 'Real assets', cx: 'Crypto', ix: 'Index', vol: 'Volatility', fx: 'Currency', rate: 'Rate' };
  const SHORT = { '^GSPC': 'S&P 500', '^IXIC': 'Nasdaq', '^DJI': 'Dow', '^RUT': 'Russell 2000', '^VIX': 'VIX', '^VIX3M': 'VIX 3M', '^MOVE': 'MOVE', 'DX-Y.NYB': 'Dollar (DXY)', 'GC=F': 'Gold', 'CL=F': 'WTI oil', 'HG=F': 'Copper', 'BTC-USD': 'Bitcoin', 'ETH-USD': 'Ether', '^FTSE': 'FTSE 100', '^GDAXI': 'DAX', '^FCHI': 'CAC 40', '^STOXX50E': 'Euro Stoxx 50', '^N225': 'Nikkei 225', '^HSI': 'Hang Seng', '000001.SS': 'Shanghai', '^NSEI': 'Nifty 50', '^KS11': 'KOSPI', '^AXJO': 'ASX 200', '^GSPTSE': 'TSX', '^BVSP': 'Bovespa', '^MXX': 'IPC Mexico', DGS10: '10-year yield', DGS2: '2-year yield', DGS3MO: '3-month bill', DGS30: '30-year yield', DFF: 'Fed funds', BAA10Y: 'Baa spread', BAMLH0A0HYM2: 'High-yield spread', DTWEXBGS: 'Broad dollar', DCOILWTICO: 'WTI spot', DFII10: '10-year real yield', T10YIE: '10-year breakeven' };
  const short = id => SHORT[id] || (ser(id) ? ser(id).name : id);
  const tick = id => /^(\^|DGS|DF|T5|T10|BAA|AAA|BAML|DTW|DEX|DCO|DHH|NFCI|STL|MORT|SOFR)/.test(id) ? '' : id.replace('-USD', '').replace('=F', '').replace('.NYB', '');
  function label(id) { const t = tick(id), n = short(id); return t && !n.includes(t) ? `${n} (${t})` : n; }

  /* ---- formatting ---- */
  function fmtLevel(id, v) {
    const s = ser(id); if (!ok(v)) return '–';
    if (!s.log) return s.unit === '%' || s.unit === 'pp' ? K.num(v, 2) + (s.unit === '%' ? '%' : ' pp') : K.num(v, Math.abs(v) < 10 ? 4 : 2);
    if (s.cls === 'vol') return K.num(v, 2);
    const a = Math.abs(v);
    return a >= 10000 ? K.num(v, 0) : a >= 1000 ? K.num(v, 1) : a >= 10 ? K.num(v, 2) : K.num(v, a >= 1 ? 3 : 4);
  }
  const money = (id, v) => (ser(id) && ser(id).cur === 'USD' && ser(id).cls !== 'vol' && ser(id).cls !== 'ix' && ser(id).cls !== 'fx' ? '$' : '') + fmtLevel(id, v);

  const info = () => ({ fetched: (P && P.fetched_at) || (ST && ST.fetched_at), status: ST || {}, last: CAL[N - 1], first: CAL[0], days: N });

  return {
    load, get P() { return P; }, get L() { return L; }, get ST() { return ST; }, get CAL() { return CAL; }, get N() { return N; }, get X() { return X; }, get ORD() { return ORD; },
    idx, idxX, xLab, isoToOrd, ordToIso, fracYear, ser, has, at, lastIdx, lastVal, quote, chg, chgSince, ytd, ytdBase, annRet, rets, vol, sma, drawdown, maxDD, hi52,
    pts, seriesPts, monthEnds, weekEnds, sampled, sampledRets, spxLong, shiller, french, ymX, ymKey, recessions, macroM, macroQ, lastOf,
    GROUPS, assets, CLS, short, tick, label, fmtLevel, money, info
  };
})();
