/* Probable Atlas · Economics: data layer (World Bank, IMF WEO, FRED). */
const E = (() => {
  const { ok } = K;
  let W = null, U = null, ST = null;
  const NAME_FIX = {
    'Korea, Rep.': 'South Korea', "Korea, Dem. People's Rep.": 'North Korea', 'Egypt, Arab Rep.': 'Egypt', 'Iran, Islamic Rep.': 'Iran', 'Venezuela, RB': 'Venezuela',
    'Yemen, Rep.': 'Yemen', 'Gambia, The': 'The Gambia', 'Bahamas, The': 'The Bahamas', 'Hong Kong SAR, China': 'Hong Kong SAR', 'Macao SAR, China': 'Macao SAR',
    'Russian Federation': 'Russia', 'Turkiye': 'Türkiye', 'Viet Nam': 'Vietnam', 'Slovak Republic': 'Slovakia', 'Kyrgyz Republic': 'Kyrgyzstan', 'Lao PDR': 'Laos',
    'Micronesia, Fed. Sts.': 'Micronesia', 'Congo, Dem. Rep.': 'DR Congo', 'Congo, Rep.': 'Republic of the Congo', 'Syrian Arab Republic': 'Syria', 'Brunei Darussalam': 'Brunei',
    "Cote d'Ivoire": "Côte d'Ivoire", 'Sao Tome and Principe': 'São Tomé and Príncipe', 'Curacao': 'Curaçao', 'St. Kitts and Nevis': 'Saint Kitts and Nevis',
    'St. Lucia': 'Saint Lucia', 'St. Vincent and the Grenadines': 'Saint Vincent and the Grenadines', 'Virgin Islands (U.S.)': 'U.S. Virgin Islands', 'Somalia, Fed. Rep.': 'Somalia'
  };
  const G20 = ['ARG', 'AUS', 'BRA', 'CAN', 'CHN', 'FRA', 'DEU', 'IND', 'IDN', 'ITA', 'JPN', 'KOR', 'MEX', 'RUS', 'SAU', 'ZAF', 'TUR', 'GBR', 'USA'];
  const INFL_TARGET = 2;

  async function load() {
    if (window.ATLAS_DATA) ({ world: W, us: U, status: ST } = window.ATLAS_DATA);
    else {
      const get = async n => { for (const base of ['data/', 'snapshot/']) { try { const r = await fetch(base + n, { cache: 'no-cache' }); if (r.ok) return await r.json(); } catch (e) { /* try next */ } } throw new Error('Could not load ' + n); };
      [W, U, ST] = await Promise.all([get('world.json'), get('us.json'), get('status.json').catch(() => ({}))]);
    }
    prep();
  }

  /* ---------------- world ---------------- */
  let COUNTRIES = [], BYISO = {}, CY = 2026, VINT = '', VYEAR = 2026;
  function prep() {
    VINT = (W.imf_meta && W.imf_meta.source) || 'IMF World Economic Outlook';
    const m = VINT.match(/(19|20)\d\d/); VYEAR = m ? +m[0] : new Date(W.fetched_at).getUTCFullYear();
    CY = new Date(W.fetched_at || Date.now()).getUTCFullYear();
    const gdp = W.imf.NGDPD ? W.imf.NGDPD.d : {};
    COUNTRIES = [];
    for (const [iso, c] of Object.entries(W.countries || {})) {
      if (c.agg) continue;
      const hasData = gdp[iso] || (W.wb['NY.GDP.MKTP.CD'] && W.wb['NY.GDP.MKTP.CD'].d[iso]);
      if (!hasData) continue;
      const o = { iso, name: NAME_FIX[c.n] || c.n, region: c.r, inc: c.inc, iid: c.iid, cap: c.cap };
      COUNTRIES.push(o); BYISO[iso] = o;
    }
    const gdpNow = iso => imf('NGDPD', iso, CY) || (wbLatest('NY.GDP.MKTP.CD', iso).v || 0) / 1e9;
    COUNTRIES.forEach(c => { c.gdp = gdpNow(c.iso); });
    COUNTRIES.sort((a, b) => (b.gdp || 0) - (a.gdp || 0));
    COUNTRIES.forEach((c, i) => { c.rank = c.gdp ? i + 1 : null; c.top40 = c.gdp && i < 40; c.g20 = G20.includes(c.iso); });
  }
  const val = (blk, code, iso, y) => { const s = blk[code]; if (!s) return null; const a = s.d[iso]; if (!a) return null; const v = a[y - s.y0]; return ok(v) ? v : null; };
  const imf = (code, iso, y) => val(W.imf, code, iso, y);
  const wb = (code, iso, y) => val(W.wb, code, iso, y);
  const wgi = (code, iso, y) => val(W.wgi, code, iso, y);
  function series(blk, code, iso, from, to) {
    const s = blk[code]; if (!s || !s.d[iso]) return [];
    const a = s.d[iso], out = [];
    for (let i = 0; i < a.length; i++) { const y = s.y0 + i; if ((from && y < from) || (to && y > to)) continue; if (ok(a[i])) out.push([y, a[i]]); }
    return out;
  }
  const imfS = (code, iso, from, to) => series(W.imf, code, iso, from, to);
  const wbS = (code, iso, from, to) => series(W.wb, code, iso, from, to);
  const wgiS = (code, iso, from, to) => series(W.wgi, code, iso, from, to);
  function latestOf(blk, code, iso, maxY) { const s = blk[code]; if (!s || !s.d[iso]) return { y: null, v: null }; const a = s.d[iso]; for (let i = a.length - 1; i >= 0; i--) { const y = s.y0 + i; if (maxY && y > maxY) continue; if (ok(a[i])) return { y, v: a[i] }; } return { y: null, v: null }; }
  const wbLatest = (code, iso, maxY) => latestOf(W.wb, code, iso, maxY);
  const wgiLatest = (code, iso) => latestOf(W.wgi, code, iso);
  const imfLatestActual = (code, iso) => latestOf(W.imf, code, iso, VYEAR - 1);
  function avg(blk, code, iso, y0, y1) { const a = []; for (let y = y0; y <= y1; y++) { const v = val(blk, code, iso, y); if (ok(v)) a.push(v); } return a.length >= Math.max(2, (y1 - y0 + 1) * 0.6) ? S.mean(a) : null; }

  /* Indicator catalog for the world tables, maps and country profiles. good: +1 higher is better, -1 lower is better, 0 neutral. */
  const IND = [];
  const add = (o) => { IND.push(o); return o; };
  const cyLab = () => String(CY);
  function buildCatalog() {
    IND.length = 0;
    add({ id: 'g', grp: 'Growth & size', lab: `Real GDP growth, ${CY}`, short: 'Growth', unit: '%', d: 1, good: 1, div: 0, get: iso => imf('NGDP_RPCH', iso, CY), src: 'IMF', map: true });
    add({ id: 'g1', grp: 'Growth & size', lab: `Real GDP growth, ${CY + 1}`, short: `Growth ${CY + 1}`, unit: '%', d: 1, good: 1, div: 0, get: iso => imf('NGDP_RPCH', iso, CY + 1), src: 'IMF' });
    add({ id: 'g10', grp: 'Growth & size', lab: `Average growth, ${CY - 10}–${CY - 1}`, short: '10-yr growth', unit: '%', d: 1, good: 1, div: 0, get: iso => avg(W.imf, 'NGDP_RPCH', iso, CY - 10, CY - 1), src: 'IMF' });
    add({ id: 'gdp', grp: 'Growth & size', lab: `GDP, ${CY} (US$ bn)`, short: 'GDP $bn', unit: '', d: 0, good: 0, get: iso => imf('NGDPD', iso, CY), fmt: v => K.big(v * 1e9, 1, '$'), src: 'IMF', log: true, map: true });
    add({ id: 'gdppc', grp: 'Growth & size', lab: `GDP per person, ${CY} (US$)`, short: 'GDP/person', unit: '$', d: 0, good: 1, get: iso => imf('NGDPDPC', iso, CY), fmt: v => K.money(v), src: 'IMF', log: true, map: true });
    add({ id: 'ppppc', grp: 'Growth & size', lab: `GDP per person at PPP, ${CY}`, short: 'GDP/person PPP', unit: '$', d: 0, good: 1, get: iso => imf('PPPPC', iso, CY), fmt: v => K.money(v), src: 'IMF', log: true });
    add({ id: 'share', grp: 'Growth & size', lab: `Share of world GDP (PPP), ${CY}`, short: 'World share', unit: '%', d: 2, good: 0, get: iso => imf('PPPSH', iso, CY), src: 'IMF' });
    add({ id: 'pop', grp: 'Growth & size', lab: 'Population (millions)', short: 'Population', unit: 'm', d: 1, good: 0, get: iso => imf('LP', iso, CY) || (wbLatest('SP.POP.TOTL', iso).v || null) / 1e6, src: 'IMF', log: true });
    add({ id: 'inf', grp: 'Prices & jobs', lab: `Inflation, ${CY}`, short: 'Inflation', unit: '%', d: 1, good: -1, div: INFL_TARGET, get: iso => imf('PCPIPCH', iso, CY), src: 'IMF', map: true });
    add({ id: 'unemp', grp: 'Prices & jobs', lab: `Unemployment, ${CY}`, short: 'Unemployment', unit: '%', d: 1, good: -1, get: iso => imf('LUR', iso, CY) || wbLatest('SL.UEM.TOTL.ZS', iso).v, src: 'IMF / World Bank', map: true });
    add({ id: 'youth', grp: 'Prices & jobs', lab: 'Youth unemployment (15–24)', short: 'Youth unemp.', unit: '%', d: 1, good: -1, get: iso => wbLatest('SL.UEM.1524.ZS', iso).v, src: 'World Bank' });
    add({ id: 'lfp', grp: 'Prices & jobs', lab: 'Labor force participation', short: 'Participation', unit: '%', d: 1, good: 1, get: iso => wbLatest('SL.TLF.CACT.ZS', iso).v, src: 'World Bank' });
    add({ id: 'flfp', grp: 'Prices & jobs', lab: 'Female labor force participation', short: 'Female part.', unit: '%', d: 1, good: 1, get: iso => wbLatest('SL.TLF.CACT.FE.ZS', iso).v, src: 'World Bank' });
    add({ id: 'debt', grp: 'Public finance', lab: `Government debt, ${CY} (% GDP)`, short: 'Gov. debt', unit: '%', d: 0, good: -1, get: iso => imf('GGXWDG_NGDP', iso, CY), src: 'IMF', map: true });
    add({ id: 'bal', grp: 'Public finance', lab: `Budget balance, ${CY} (% GDP)`, short: 'Budget bal.', unit: '%', d: 1, good: 1, div: 0, get: iso => imf('GGXCNL_NGDP', iso, CY), src: 'IMF', map: true });
    add({ id: 'debt5', grp: 'Public finance', lab: `Debt change, ${CY - 5}–${CY} (pp)`, short: 'Debt Δ5y', unit: 'pp', d: 0, good: -1, get: iso => { const a = imf('GGXWDG_NGDP', iso, CY), b = imf('GGXWDG_NGDP', iso, CY - 5); return ok(a) && ok(b) ? a - b : null; }, src: 'IMF' });
    add({ id: 'tax', grp: 'Public finance', lab: 'Tax revenue (% GDP)', short: 'Tax revenue', unit: '%', d: 1, good: 0, get: iso => wbLatest('GC.TAX.TOTL.GD.ZS', iso).v, src: 'World Bank' });
    add({ id: 'ca', grp: 'External', lab: `Current account, ${CY} (% GDP)`, short: 'Current acct.', unit: '%', d: 1, good: 0, div: 0, get: iso => imf('BCA_NGDPD', iso, CY), src: 'IMF', map: true });
    add({ id: 'trade', grp: 'External', lab: 'Trade (% GDP)', short: 'Trade', unit: '%', d: 0, good: 0, get: iso => wbLatest('NE.TRD.GNFS.ZS', iso).v, src: 'World Bank' });
    add({ id: 'fdi', grp: 'External', lab: 'Foreign direct investment inflows (% GDP)', short: 'FDI in', unit: '%', d: 1, good: 1, get: iso => wbLatest('BX.KLT.DINV.WD.GD.ZS', iso).v, src: 'World Bank' });
    add({ id: 'res', grp: 'External', lab: 'Reserves (months of imports)', short: 'Reserves', unit: 'mo', d: 1, good: 1, get: iso => wbLatest('FI.RES.TOTL.MO', iso).v, src: 'World Bank' });
    add({ id: 'xdebt', grp: 'External', lab: 'External debt (% GNI)', short: 'Ext. debt', unit: '%', d: 0, good: -1, get: iso => wbLatest('DT.DOD.DECT.GN.ZS', iso).v, src: 'World Bank' });
    add({ id: 'inv', grp: 'Structure & capability', lab: 'Investment (% GDP)', short: 'Investment', unit: '%', d: 1, good: 1, get: iso => wbLatest('NE.GDI.TOTL.ZS', iso).v, src: 'World Bank' });
    add({ id: 'sav', grp: 'Structure & capability', lab: 'Gross savings (% GDP)', short: 'Savings', unit: '%', d: 1, good: 1, get: iso => wbLatest('NY.GNS.ICTR.ZS', iso).v, src: 'World Bank' });
    add({ id: 'manuf', grp: 'Structure & capability', lab: 'Manufacturing (% GDP)', short: 'Manufacturing', unit: '%', d: 1, good: 0, get: iso => wbLatest('NV.IND.MANF.ZS', iso).v, src: 'World Bank' });
    add({ id: 'rd', grp: 'Structure & capability', lab: 'R&D spending (% GDP)', short: 'R&D', unit: '%', d: 2, good: 1, get: iso => wbLatest('GB.XPD.RSDV.GD.ZS', iso).v, src: 'World Bank' });
    add({ id: 'tert', grp: 'Structure & capability', lab: 'Tertiary enrollment (% gross)', short: 'Tertiary', unit: '%', d: 0, good: 1, get: iso => wbLatest('SE.TER.ENRR', iso).v, src: 'World Bank' });
    add({ id: 'net', grp: 'Structure & capability', lab: 'Internet users (% population)', short: 'Internet', unit: '%', d: 0, good: 1, get: iso => wbLatest('IT.NET.USER.ZS', iso).v, src: 'World Bank' });
    add({ id: 'ge', grp: 'Structure & capability', lab: 'Government effectiveness (−2.5 to 2.5)', short: 'Gov. effect.', unit: '', d: 2, good: 1, get: iso => wgiLatest('GE.EST', iso).v, src: 'World Bank WGI' });
    add({ id: 'rl', grp: 'Structure & capability', lab: 'Rule of law (−2.5 to 2.5)', short: 'Rule of law', unit: '', d: 2, good: 1, get: iso => wgiLatest('RL.EST', iso).v, src: 'World Bank WGI' });
    add({ id: 'cc', grp: 'Structure & capability', lab: 'Control of corruption (−2.5 to 2.5)', short: 'Anti-corruption', unit: '', d: 2, good: 1, get: iso => wgiLatest('CC.EST', iso).v, src: 'World Bank WGI' });
    add({ id: 'gini', grp: 'Structure & capability', lab: 'Income inequality (Gini, 0–100)', short: 'Gini', unit: '', d: 1, good: -1, get: iso => wbLatest('SI.POV.GINI', iso).v, src: 'World Bank' });
    add({ id: 'pov', grp: 'Structure & capability', lab: 'Extreme poverty (% population)', short: 'Poverty', unit: '%', d: 1, good: -1, get: iso => wbLatest('SI.POV.DDAY', iso).v, src: 'World Bank' });
    add({ id: 'life', grp: 'Structure & capability', lab: 'Life expectancy (years)', short: 'Life exp.', unit: 'y', d: 1, good: 1, get: iso => wbLatest('SP.DYN.LE00.IN', iso).v, src: 'World Bank' });
  }
  const indById = id => IND.find(i => i.id === id);
  const fmtInd = (ind, v) => !ok(v) ? '–' : ind.fmt ? ind.fmt(v) : K.num(v, ind.d) + (ind.unit === '%' ? '%' : ind.unit === 'pp' ? ' pp' : ind.unit === 'mo' ? ' mo' : ind.unit === 'y' ? ' y' : ind.unit === 'm' ? 'm' : '');
  const CACHE = new Map();
  function column(id) { if (CACHE.has(id)) return CACHE.get(id); const ind = indById(id), out = {}; for (const c of COUNTRIES) { const v = ind.get(c.iso); if (ok(v)) out[c.iso] = v; } CACHE.set(id, out); return out; }
  function peers(iso) { const c = BYISO[iso]; return c ? COUNTRIES.filter(x => x.iid === c.iid) : COUNTRIES; }

  /* aggregates (World, advanced, emerging) from the IMF groups, with World Bank history for the long view */
  const WORLD = { WEOWORLD: 'World', ADVEC: 'Advanced economies', OEMDC: 'Emerging & developing' };

  /* ---------------- United States (FRED) ---------------- */
  const us = id => U.series[id];
  const usLab = id => (U.labels[id] || [id, ''])[0];
  function mSeries(id) { const s = us(id); if (!s || (s.k !== 'm' && s.k !== 'd')) return null; return { t0: K.mIdx(s.s), v: s.v }; }
  function qSeries(id) { const s = us(id); if (!s || s.k !== 'q') return null; return { q0: K.qIdx(s.s), v: s.v }; }
  function aSeries(id) { const s = us(id); if (!s || s.k !== 'a') return null; return { y0: +s.s, v: s.v }; }
  const mAt = (ms, t) => { if (!ms) return null; const v = ms.v[t - ms.t0]; return ok(v) ? v : null; };
  const qAt = (qs, q) => { if (!qs) return null; const v = qs.v[q - qs.q0]; return ok(v) ? v : null; };
  function mLast(ms) { for (let i = ms.v.length - 1; i >= 0; i--) if (ok(ms.v[i])) return ms.t0 + i; return null; }
  function qLast(qs) { for (let i = qs.v.length - 1; i >= 0; i--) if (ok(qs.v[i])) return qs.q0 + i; return null; }
  function mYoY(ms) { if (!ms) return null; const v = ms.v.map((x, i) => i >= 12 && ok(x) && ok(ms.v[i - 12]) && ms.v[i - 12] ? (x / ms.v[i - 12] - 1) * 100 : null); return { t0: ms.t0, v }; }
  function mAnn(ms, n = 3) { if (!ms) return null; const v = ms.v.map((x, i) => i >= n && ok(x) && ok(ms.v[i - n]) && ms.v[i - n] ? (Math.pow(x / ms.v[i - n], 12 / n) - 1) * 100 : null); return { t0: ms.t0, v }; }
  function mDiff(ms, n = 1) { if (!ms) return null; return { t0: ms.t0, v: ms.v.map((x, i) => i >= n && ok(x) && ok(ms.v[i - n]) ? x - ms.v[i - n] : null) }; }
  const mPts = (ms, from) => { if (!ms) return []; const o = []; ms.v.forEach((v, i) => { const t = ms.t0 + i; if (ok(v) && (!from || t >= from)) o.push([t / 12, v]); }); return o; };
  const qPts = (qs, from) => { if (!qs) return []; const o = []; qs.v.forEach((v, i) => { const q = qs.q0 + i; if (ok(v) && (!from || q >= from)) o.push([q / 4 + 0.125, v]); }); return o; };
  function recessions() { // [[x0, x1]] in fractional years from USREC
    const ms = mSeries('USREC'); if (!ms) return [];
    const out = []; let st = null;
    ms.v.forEach((v, i) => { const t = ms.t0 + i; if (v === 1 && st == null) st = t; if (v !== 1 && st != null) { out.push([st / 12, t / 12]); st = null; } });
    if (st != null) out.push([st / 12, (ms.t0 + ms.v.length) / 12]);
    return out;
  }
  function recessionList() { // with month indexes
    const ms = mSeries('USREC'); if (!ms) return [];
    const out = []; let st = null;
    ms.v.forEach((v, i) => { const t = ms.t0 + i; if (v === 1 && st == null) st = t; if (v !== 1 && st != null) { out.push({ start: st, end: t - 1 }); st = null; } });
    return out;
  }
  const raw = id => { const s = us(id); return s && s.r ? s.r : null; };

  return {
    load, get W() { return W; }, get U() { return U; }, get ST() { return ST; }, get CY() { return CY; }, get VINT() { return VINT; }, get VYEAR() { return VYEAR; },
    get COUNTRIES() { return COUNTRIES; }, BYISO, G20, INFL_TARGET, WORLD, imf, wb, wgi, imfS, wbS, wgiS, wbLatest, wgiLatest, imfLatestActual, avg: (src, code, iso, a, b) => avg(src === 'imf' ? W.imf : src === 'wgi' ? W.wgi : W.wb, code, iso, a, b),
    IND, buildCatalog, indById, fmtInd, column, peers, cyLab,
    us, usLab, mSeries, qSeries, aSeries, mAt, qAt, mLast, qLast, mYoY, mAnn, mDiff, mPts, qPts, recessions, recessionList, raw,
    name: iso => (BYISO[iso] && BYISO[iso].name) || (W.imf_meta && W.imf_meta.countries && W.imf_meta.countries[iso]) || WORLD[iso] || iso
  };
})();
