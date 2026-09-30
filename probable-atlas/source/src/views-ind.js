/* Probable Atlas · Economics: "Indicators" tab. */
const VI = (() => {
  const { esc, ok, num, pct, sgn } = K;
  const GROUPS = ['Growth & size', 'Prices & jobs', 'Public finance', 'External', 'Structure & capability'];
  function filterOpts() {
    const regions = [...new Set(E.COUNTRIES.map(c => c.region).filter(Boolean))].sort();
    const incs = ['High income', 'Upper middle income', 'Lower middle income', 'Low income'];
    return [['top40', 'Top 40 economies'], ['g20', 'G20 members'], ['all', 'All economies']].concat(regions.map(r => ['r:' + r, r]), incs.map(i => ['i:' + i, i]));
  }
  function filtered(f) {
    return E.COUNTRIES.filter(c => f === 'all' ? true : f === 'top40' ? c.top40 : f === 'g20' ? c.g20 : f.startsWith('r:') ? c.region === f.slice(2) : f.startsWith('i:') ? c.inc === f.slice(2) : true);
  }
  function worldTable(st) {
    const inds = E.IND.filter(i => i.grp === st.indGrp);
    const rows = filtered(st.indFilter).map(c => { const r = { _country: c.iso, _name: c.name, _search: c.name + ' ' + c.iso, name: c.name, rank: c.rank }; for (const i of inds) r[i.id] = E.column(i.id)[c.iso]; return r; });
    const cols = [{ k: 'name', lab: 'Economy', html: r => `<span class="flag">${r._country}</span>${esc(r.name)}` }, { k: 'rank', lab: 'GDP rank', num: false, fmt: v => ok(v) ? '#' + v : '–', title: `Rank by GDP in US dollars, ${E.CY}` }]
      .concat(inds.map(i => ({ k: i.id, lab: i.short, title: `${i.lab} · ${i.src}`, num: true, good: i.good, mid: i.div, fmt: v => E.fmtInd(i, v) })));
    const ctl = V.sel('indgrp', GROUPS.map(g => [g, g]), st.indGrp, 'Indicator group') + V.sel('indfilter', filterOpts(), st.indFilter, 'Which economies');
    return V.sec('Every economy, every indicator', `${E.COUNTRIES.length} economies · IMF ${esc(E.VINT)} and World Bank data. Pick a group of indicators, filter the economies, and switch between Table, Chart and Heat map. Click a row for the full profile.`) +
      T.html({ cols, rows, sort: { k: 'rank', dir: 1 }, extraCtl: ctl, placeholder: 'Find an economy…', limit: 50 });
  }

  /* ---------------- US series table + explorer ---------------- */
  const US_CAT = [
    ['Output & activity', [['A191RL1Q225SBEA', 'Real GDP growth (annualized)', 'q', '%', 1, 1], ['GDPNOW', 'Atlanta Fed GDPNow', 'q', '%', 1, 1], ['INDPRO', 'Industrial production', 'yoy', '%', 1, 1], ['TCU', 'Capacity utilization', 'level', '%', 1, 1], ['RRSFS', 'Real retail sales', 'yoy', '%', 1, 1], ['PCEC96', 'Real consumer spending', 'yoy', '%', 1, 1], ['W875RX1', 'Real income ex transfers', 'yoy', '%', 1, 1]]],
    ['Labor market', [['UNRATE', 'Unemployment rate', 'level', '%', 1, -1], ['U6RATE', 'Underemployment (U-6)', 'level', '%', 1, -1], ['PAYEMS', 'Payroll jobs added (monthly)', 'diff', 'K', 0, 1], ['CIVPART', 'Labor force participation', 'level', '%', 1, 1], ['LNS12300060', 'Prime-age employment rate', 'level', '%', 1, 1], ['JTSJOL', 'Job openings', 'level', 'K', 0, 1], ['ICSA', 'Initial jobless claims', 'level', 'K', 0, -1], ['SAHMREALTIME', 'Sahm rule indicator', 'level', 'pp', 2, -1], ['AHETPI', 'Hourly earnings', 'yoy', '%', 1, 0]]],
    ['Prices', [['CPIAUCSL', 'CPI inflation', 'yoy', '%', 1, -1], ['CPILFESL', 'Core CPI inflation', 'yoy', '%', 1, -1], ['PCEPI', 'PCE inflation', 'yoy', '%', 1, -1], ['PCEPILFE', 'Core PCE inflation', 'yoy', '%', 1, -1], ['MICH', 'Expected inflation, 1 year (households)', 'level', '%', 1, -1], ['T5YIE', '5-year breakeven inflation', 'level', '%', 2, -1]]],
    ['Rates & credit', [['DFF', 'Fed funds rate', 'level', '%', 2, 0], ['DGS3MO', '3-month Treasury', 'level', '%', 2, 0], ['DGS2', '2-year Treasury', 'level', '%', 2, 0], ['DGS10', '10-year Treasury', 'level', '%', 2, 0], ['T10Y3M', 'Curve: 10y − 3m', 'level', 'pp', 2, 1], ['T10Y2Y', 'Curve: 10y − 2y', 'level', 'pp', 2, 1], ['BAA10Y', 'Credit spread (Baa − 10y)', 'level', 'pp', 2, -1], ['NFCI', 'Financial conditions (NFCI)', 'level', '', 2, -1], ['MORTGAGE30US', '30-year mortgage rate', 'level', '%', 2, -1]]],
    ['Markets', [['SP500', 'S&P 500 (12-month change)', 'yoy', '%', 1, 1], ['VIXCLS', 'Stock volatility (VIX)', 'level', '', 1, -1], ['DCOILWTICO', 'Oil price (WTI)', 'level', '$', 2, 0], ['DTWEXBGS', 'Trade-weighted dollar', 'level', '', 1, 0]]],
    ['Housing & consumers', [['HOUST', 'Housing starts', 'level', 'K', 0, 1], ['PERMIT', 'Building permits', 'level', 'K', 0, 1], ['CSUSHPISA', 'Home prices (Case-Shiller)', 'yoy', '%', 1, 0], ['UMCSENT', 'Consumer sentiment', 'level', '', 1, 1], ['M2SL', 'Money supply (M2)', 'yoy', '%', 1, 0]]],
    ['Fiscal & external', [['GFDEGDQ188S', 'Federal debt (% GDP)', 'q', '%', 1, -1], ['FYFSGDA188S', 'Federal balance (% GDP)', 'a', '%', 1, 1], ['FYOIGDA188S', 'Federal interest outlays (% GDP)', 'a', '%', 2, -1], ['BOPGSTB', 'Trade balance ($ bn, monthly)', 'bn', '$', 1, 0]]]
  ];
  const SPEC = {}; US_CAT.forEach(([g, list]) => list.forEach(x => SPEC[x[0]] = { id: x[0], lab: x[1], tr: x[2], unit: x[3], d: x[4], good: x[5], grp: g }));
  function usTransform(sp) { // -> {pts:[[x,y]], freq, lastLab, v, prev, yearAgo, hist}
    const id = sp.id;
    if (sp.tr === 'q') { const q = E.qSeries(id); const t = E.qLast(q); return { pts: E.qPts(q), v: E.qAt(q, t), prev: E.qAt(q, t - 1), ya: E.qAt(q, t - 4), date: K.qLab(t), hist: q.v.slice(Math.max(0, 1990 * 4 - q.q0)), spark: q.v.slice(-20) }; }
    if (sp.tr === 'a') { const a = E.aSeries(id); const n = a.v.length - 1; return { pts: a.v.map((v, i) => [a.y0 + i + 0.5, v]).filter(p => ok(p[1])), v: a.v[n], prev: a.v[n - 1], ya: a.v[n - 1], date: String(a.y0 + n), hist: a.v.slice(Math.max(0, 1990 - a.y0)), spark: a.v.slice(-20) }; }
    let ms = E.mSeries(id);
    if (sp.tr === 'yoy') ms = E.mYoY(ms); else if (sp.tr === 'diff') ms = E.mDiff(ms);
    else if (sp.tr === 'bn') ms = { t0: ms.t0, v: ms.v.map(x => ok(x) ? x / 1000 : null) };
    else if (id === 'ICSA') ms = { t0: ms.t0, v: ms.v.map(x => ok(x) ? x / 1000 : null) };
    const t = E.mLast(ms);
    const s = E.us(id), raw = s.r && sp.tr === 'level' ? s.r : null;
    let v = E.mAt(ms, t), prev = E.mAt(ms, t - 1), date = K.mLab(t);
    if (raw) { const a = raw[raw.length - 1]; v = id === 'ICSA' ? a[1] / 1000 : a[1]; prev = id === 'ICSA' ? raw[raw.length - 2][1] / 1000 : raw[raw.length - 2][1]; date = K.dLab(a[0]); }
    return { pts: E.mPts(ms), v, prev, ya: E.mAt(ms, t - 12), date, hist: ms.v.slice(Math.max(0, 1990 * 12 - ms.t0)), spark: ms.v.slice(-36), raw };
  }
  const fmtU = (sp, v) => !ok(v) ? '–' : sp.unit === '%' ? num(v, sp.d) + '%' : sp.unit === 'K' ? num(v, 0) + 'K' : sp.unit === '$' ? (sp.tr === 'bn' ? K.MINUS.repeat(v < 0 ? 1 : 0) + '$' + num(Math.abs(v), 1) + 'bn' : '$' + num(v, sp.d)) : sp.unit === 'pp' ? num(v, sp.d) + ' pp' : num(v, sp.d);
  function usExplorer(st) {
    const sp = SPEC[st.usSeries] || SPEC.UNRATE, tr = usTransform(sp);
    const now = new Date(E.U.fetched_at), x1 = now.getUTCFullYear() + now.getUTCMonth() / 12 + 0.05;
    const range = st.usRange;
    let pts = tr.pts;
    if (range === '2' && tr.raw && sp.tr === 'level') pts = tr.raw.map(r => { const s = String(r[0]); return [+s.slice(0, 4) + (+s.slice(4, 6) - 1) / 12 + (+s.slice(6, 8) - 1) / 365, sp.id === 'ICSA' ? r[1] / 1000 : r[1]]; });
    const x0 = range === 'max' ? null : x1 - +range;
    if (x0) pts = pts.filter(p => p[0] >= x0);
    const hl = [];
    if (sp.id === 'UNRATE') { const n = E.qSeries('NROU'); const q = E.qLast(E.qSeries('A191RL1Q225SBEA')); hl.push({ y: E.qAt(n, q), label: 'CBO natural rate', color: 'var(--s2)' }); }
    if (/CPI|PCE/.test(sp.id) && sp.tr === 'yoy') hl.push({ y: 2, label: '2% goal', color: 'var(--s3)' });
    const chart = C.line({ series: [{ name: sp.lab, pts, color: 'var(--s1)', width: 2 }], shade: E.recessions(), shadeName: 'US recession (NBER)', h: 280, x0: x0 || undefined, x1, hlines: hl, yFmt: v => fmtU(sp, v), tipX: x => pts.length > 400 && range === '2' ? K.MON[Math.floor((x % 1) * 12)] + ' ' + Math.floor(x) : (sp.tr === 'q' ? 'Q' + (Math.floor((x % 1) * 4) + 1) + ' ' + Math.floor(x) : sp.tr === 'a' ? String(Math.floor(x)) : K.MON[Math.round((x % 1) * 12) % 12] + ' ' + Math.floor(x + 1e-6)), aria: sp.lab + ' chart' });
    const ranges = [['2', '2y'], ['5', '5y'], ['10', '10y'], ['30', '30y'], ['max', 'Max']];
    const pick = V.sel('usseries', Object.values(SPEC).map(s => [s.id, s.grp + ' · ' + s.lab]), sp.id, 'Series');
    return V.card(sp.lab, `${esc(E.usLab(sp.id))} · FRED series <span class="mono">${sp.id}</span> · latest ${esc(tr.date)}: <b>${fmtU(sp, tr.v)}</b>. Shaded bands are NBER-dated recessions.`, chart, pick + V.seg('usrange', ranges, range));
  }
  function usTable(st) {
    const rows = [];
    let order = 0;
    for (const [g, list] of US_CAT) for (const x of list) {
      const sp = SPEC[x[0]]; if (!E.us(sp.id)) continue;
      const tr = usTransform(sp), p = S.pctRank(tr.hist, tr.v);
      rows.push({ _series: sp.id, _order: order++, _search: sp.lab + ' ' + sp.id + ' ' + g, name: sp.lab, grp: g, v: tr.v, date: tr.date, prev: tr.prev, chg: ok(tr.v) && ok(tr.prev) ? tr.v - tr.prev : null, ya: tr.ya, pct: p != null ? p * 100 : null, spark: tr.spark, sp });
    }
    const cols = [
      { k: 'name', lab: 'Series', sortVal: r => r._order },
      { k: 'grp', lab: 'Category' },
      { k: 'v', lab: 'Latest', num: true, fmt: (v, r) => fmtU(r.sp, v), sortVal: r => r.pct },
      { k: 'date', lab: 'As of', sortVal: r => r._order },
      { k: 'chg', lab: 'Change', num: true, fmt: (v, r) => `<span class="delta ${!ok(v) || r.sp.good === 0 ? 'flat' : (v > 0) === (r.sp.good > 0) ? 'up' : 'down'}">${sgn(v, r.sp.d)}</span>` },
      { k: 'ya', lab: 'Year ago', num: true, fmt: (v, r) => fmtU(r.sp, v) },
      { k: 'pct', lab: 'Percentile since 1990', num: true, good: 0, fmt: v => ok(v) ? K.ord(Math.round(v)) : '–', title: 'Where the latest reading ranks against every reading since 1990 (100th = highest ever)' },
      { k: 'spark', lab: 'Trend', html: r => C.spark(r.spark, { w: 110, h: 22, zero: /T10Y|diff/.test(r.sp.id + r.sp.tr) }) }
    ];
    return T.html({ cols, rows, sort: { k: 'name', dir: 1 }, views: ['table', 'heat'], placeholder: 'Find a series…', limit: 60 });
  }
  function us(st) {
    return V.sec('United States indicators', 'Every FRED series behind the national deep dive. The explorer charts any series back to its first observation; the table ranks today\'s reading against history. Click a row to chart it.') + usExplorer(st) + `<div style="margin-top:14px">${usTable(st)}</div>`;
  }

  /* ---------------- single-country indicators ---------------- */
  const EXPL = [
    ['imf:NGDP_RPCH', 'Real GDP growth (%)'], ['imf:PCPIPCH', 'Inflation (%)'], ['imf:LUR', 'Unemployment (%)'], ['imf:GGXWDG_NGDP', 'Government debt (% GDP)'], ['imf:GGXCNL_NGDP', 'Budget balance (% GDP)'],
    ['imf:BCA_NGDPD', 'Current account (% GDP)'], ['imf:NGDPDPC', 'GDP per person (US$)'], ['imf:PPPPC', 'GDP per person, PPP'], ['wb:NE.GDI.TOTL.ZS', 'Investment (% GDP)'], ['wb:NE.TRD.GNFS.ZS', 'Trade (% GDP)'],
    ['wb:BX.KLT.DINV.WD.GD.ZS', 'FDI inflows (% GDP)'], ['wb:FI.RES.TOTL.MO', 'Reserves (months of imports)'], ['wb:SL.TLF.CACT.FE.ZS', 'Female labor participation (%)'], ['wb:GB.XPD.RSDV.GD.ZS', 'R&D (% GDP)'],
    ['wb:IT.NET.USER.ZS', 'Internet users (%)'], ['wb:SP.DYN.LE00.IN', 'Life expectancy'], ['wb:SI.POV.GINI', 'Gini index'], ['wgi:GE.EST', 'Government effectiveness'], ['wgi:CC.EST', 'Control of corruption']
  ];
  function countryExplorer(iso, st) {
    const [srcKey, code] = st.cSeries.split(/:(.+)/);
    const lab = (EXPL.find(e => e[0] === st.cSeries) || [0, code])[1];
    const getS = (i) => srcKey === 'imf' ? E.imfS(code, i, 1980, E.CY + 6) : srcKey === 'wgi' ? E.wgiS(code, i) : E.wbS(code, i, 1970);
    const mine = getS(iso);
    const peers = E.peers(iso).map(c => c.iso).filter(p => p !== iso), byYear = new Map();
    for (const p of peers) for (const [y, v] of getS(p)) { if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(v); }
    const med = [...byYear].filter(([, a]) => a.length >= 5).map(([y, a]) => [y, S.median(a)]).sort((a, b) => a[0] - b[0]);
    const series = [{ name: E.name(iso), pts: mine, color: 'var(--s1)', width: 2.4, projFrom: srcKey === 'imf' ? E.VYEAR - 0.5 : undefined }, { name: `${E.BYISO[iso].inc} median`, pts: med, color: 'var(--s2)', width: 1.6, dash: '5 4' }];
    if (srcKey === 'imf') { const w = E.imfS(code, 'WEOWORLD', 1980, E.CY + 6); if (w.length) series.push({ name: 'World', pts: w, color: 'var(--s3)', width: 1.6 }); }
    const chart = C.line({ series, h: 280, projFrom: srcKey === 'imf' ? E.VYEAR - 0.5 : undefined, projLabel: 'IMF projection', xTicks: undefined, tipX: x => String(Math.round(x)), aria: lab });
    return V.card(lab, `${E.name(iso)} against the median of its income group${srcKey === 'imf' ? ' and the world; dashed years are IMF projections' : ''}.`, chart, V.sel('cseries', EXPL, st.cSeries, 'Indicator to chart'));
  }
  function countryTable(iso) {
    const peers = E.peers(iso).map(c => c.iso);
    const rows = E.IND.map((i, n) => {
      const col = E.column(i.id), v = col[iso], dist = peers.map(p => col[p]).filter(ok), all = Object.values(col);
      const p = ok(v) ? S.pctRank(dist, v) : null;
      const rank = ok(v) ? all.filter(x => (i.good < 0 ? x < v : x > v)).length + 1 : null;
      return { _order: n, name: i.lab, grp: i.grp, v, med: S.median(dist), pct: p != null ? (i.good < 0 ? 1 - p : p) * 100 : null, rank, of: all.length, src: i.src, ind: i };
    });
    const cols = [
      { k: 'name', lab: 'Indicator', sortVal: r => r._order }, { k: 'grp', lab: 'Group' },
      { k: 'v', lab: E.name(iso), num: true, fmt: (v, r) => E.fmtInd(r.ind, v), sortVal: r => r.pct },
      { k: 'med', lab: 'Peer median', num: true, fmt: (v, r) => E.fmtInd(r.ind, v) },
      { k: 'pct', lab: 'Standing vs peers', num: true, good: 1, fmt: v => ok(v) ? K.ord(Math.round(v)) + ' pct' : '–', title: 'Percentile among income-group peers, flipped where lower is better (higher is always stronger)' },
      { k: 'rank', lab: 'World rank', num: true, fmt: (v, r) => ok(v) ? `#${v} of ${r.of}` : '–', sortVal: r => r.rank },
      { k: 'src', lab: 'Source' }
    ];
    return T.html({ cols, rows, sort: { k: 'name', dir: 1 }, views: ['table', 'heat'], placeholder: 'Find an indicator…', limit: 60 });
  }
  function country(iso, st) {
    return V.sec(`${E.name(iso)}: indicators`, `${E.IND.length} indicators against ${E.peers(iso).length} ${esc(E.BYISO[iso].inc.toLowerCase())} peers, plus long-run history for any series.`) + countryExplorer(iso, st) + `<div style="margin-top:14px">${countryTable(iso)}</div>`;
  }
  function view(st) { return st.scope === 'WLD' ? worldTable(st) : st.scope === 'USA' ? us(st) : country(st.scope, st); }
  return { view, SPEC, US_CAT, usTransform, fmtU, EXPL, GROUPS };
})();
