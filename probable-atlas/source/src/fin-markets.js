/* Probable Atlas · Finance: Markets tab (explorer, distribution, scorecard, rates & credit, correlations). */
const VMK = (() => {
  const { esc, ok, num, pct, sgn } = K;
  const COLS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s7)'];
  const VIEWS = [['price', 'Price'], ['growth', 'Growth of $10k'], ['dd', 'Drawdown'], ['vol', 'Volatility'], ['rel', 'vs S&P 500']];
  function assetOptions() {
    return F.GROUPS.map(([g, lab]) => ({ group: lab, items: F.assets(g).map(id => [id, F.label(id)]).sort((a, b) => g === 'fred' ? 0 : a[1].localeCompare(b[1])) })).filter(o => o.items.length);
  }
  function seriesFor(id, view, i0, i1, color) {
    const s = F.ser(id), a = Math.max(i0, s.s), base = s.v[a];
    if (!s.log) { // rates and spreads: levels only
      return { name: F.short(id), color, pts: F.pts(id, i0, i1, 800) };
    }
    if (view === 'price') return { name: F.short(id), color, pts: F.pts(id, i0, i1, 800) };
    if (view === 'growth') return { name: F.short(id), color, pts: F.pts(id, i0, i1, 800, v => v / base * 10000) };
    if (view === 'dd') { const dd = new Float64Array(F.N).fill(NaN); let hi = -Infinity; for (let i = s.s; i <= s.e; i++) { hi = Math.max(hi, s.v[i]); dd[i] = (s.v[i] / hi - 1) * 100; } return { name: F.short(id), color, pts: F.seriesPts(dd, a, Math.min(i1, s.e), 800), area: true }; }
    if (view === 'vol') { const v = new Float64Array(F.N).fill(NaN); const r = []; for (let i = s.s + 1; i <= s.e; i++) { r.push(Math.log(s.v[i] / s.v[i - 1])); if (r.length > 63) r.shift(); if (r.length === 63) v[i] = S.sd(r) * Math.sqrt(252) * 100; } return { name: F.short(id), color, pts: F.seriesPts(v, a, Math.min(i1, s.e), 800) }; }
    if (view === 'rel') { const b = F.ser('^GSPC'), rb = b.v[a]; return { name: F.short(id) + ' vs S&P 500', color, pts: F.pts(id, i0, i1, 800, (v, i) => (v / base) / (b.v[i] / rb) * 100) }; }
  }
  function explorer(st) {
    const id = F.has(st.focus) ? st.focus : '^GSPC', s = F.ser(id), cmp = (st.cmp || []).filter(c => F.has(c) && c !== id).slice(0, 4);
    let view = st.mview || 'price'; if (!s.log) view = 'price'; if (cmp.length && view === 'price' && s.log) view = 'growth';
    const i1 = F.N - 1, i0 = FV.rangeStart(st.range || '5Y', id);
    const ids = [id].concat(cmp.filter(c => F.ser(c).log === s.log));
    const series = ids.map((x, k) => seriesFor(x, view, i0, i1, COLS[k]));
    const logOK = s.log && (view === 'price' || view === 'growth') && s.cls !== 'vol';
    const logY = logOK && st.logY;
    const axisLv = v => { const a = Math.abs(v); return s.log ? num(v, a >= 1000 ? 0 : a >= 10 ? 1 : 2) : num(v, 2); };
    const fmt = view === 'dd' || view === 'vol' ? (v => num(v, 0) + '%') : view === 'growth' ? (v => '$' + K.big(v, 1)) : view === 'rel' ? (v => num(v, 0)) : axisLv;
    const tfmt = view === 'dd' || view === 'vol' ? (v => num(v, 1) + '%') : view === 'growth' ? (v => K.money(v, 0)) : view === 'rel' ? (v => num(v, 1)) : (v => F.fmtLevel(id, v));
    const rec = F.recessions().filter(([a, b]) => b > F.X[i0]);
    const chart = C.line({ series, h: 340, logY, yFmt: fmt, tipFmt: tfmt, tipX: F.xLab, shade: rec, shadeName: 'US recession', hlines: view === 'rel' || view === 'growth' ? [{ y: view === 'rel' ? 100 : 10000, color: 'var(--axis)' }] : [], zero: view === 'dd' ? true : false, aria: 'Market explorer chart' });
    // range statistics for the focus series
    let stats = '';
    if (s.log) {
      const a = Math.max(i0, s.s), r = F.rets(id, a + 1, i1), tot = (s.v[i1] / s.v[a] - 1) * 100, yrs = (F.ORD[i1] - F.ORD[a]) / 365.25;
      const mdd = F.maxDD(id, a, i1), best = Math.max(...r), worst = Math.min(...r), up = r.filter(x => x > 0).length / r.length * 100;
      const vol = S.sd(r) * Math.sqrt(252) * 100, ann = yrs >= 1 ? (Math.pow(1 + tot / 100, 1 / yrs) - 1) * 100 : null;
      stats = `<div class="tiles t6 mini">${[
        U.tile({ lab: 'Total return', val: esc(FV.P(tot)), sub: ann != null ? `${FV.P(ann)} a year` : 'under a year' }),
        U.tile({ lab: 'Volatility', val: esc(pct(vol, 1)), sub: 'annualized' }),
        U.tile({ lab: 'Worst drawdown', val: esc(pct(mdd.mdd, 1)), sub: `${K.isoLab(mdd.peak)} to ${K.isoLab(mdd.trough)}` }),
        U.tile({ lab: 'Best day', val: esc(FV.P((Math.exp(best) - 1) * 100)) }),
        U.tile({ lab: 'Worst day', val: esc(FV.P((Math.exp(worst) - 1) * 100)) }),
        U.tile({ lab: 'Up days', val: esc(pct(up, 0)), sub: `${r.length.toLocaleString()} trading days` })
      ].join('')}</div>`;
    } else {
      const a = Math.max(i0, s.s), lv = []; for (let i = a; i <= i1; i++) if (ok(s.v[i])) lv.push(s.v[i]);
      stats = `<div class="tiles t4 mini">${[U.tile({ lab: 'Latest', val: esc(F.fmtLevel(id, s.v[s.e])) }), U.tile({ lab: 'Change over range', val: esc(FV.pp(s.v[s.e] - s.v[a])) }), U.tile({ lab: 'Range high', val: esc(F.fmtLevel(id, Math.max(...lv))) }), U.tile({ lab: 'Range low', val: esc(F.fmtLevel(id, Math.min(...lv))) })].join('')}</div>`;
    }
    const cmpChips = cmp.map((c, k) => `<button type="button" class="chip on" data-uncmp="${esc(c)}" style="border-color:${COLS[k + 1]}" aria-label="Remove ${esc(F.short(c))}"><i style="background:${COLS[k + 1]}"></i>${esc(F.short(c))} ×</button>`).join('');
    const addSel = cmp.length < 4 ? `<label class="picker"><span class="sr">Compare with</span><select class="sel" data-addcmp aria-label="Compare with"><option value="">+ Compare…</option>${assetOptions().map(o => `<optgroup label="${esc(o.group)}">${o.items.filter(([v]) => v !== id && !cmp.includes(v)).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</optgroup>`).join('')}</select></label>` : '';
    const ctl = `<div class="exp-ctl"><div class="row">${U.sel('focus', assetOptions(), id, 'Market')}${cmpChips}${addSel}</div><div class="row">${U.seg('range', FV.RANGES, st.range || '5Y', 'Range')}${s.log ? U.seg('mview', VIEWS, view, 'View') : ''}${logOK ? `<label class="tog"><input type="checkbox" data-logy ${logY ? 'checked' : ''}> Log scale</label>` : ''}</div></div>`;
    return `<section class="card">${ctl}${chart}${U.src(`${esc(F.label(id))}: ${s.log ? (s.cls === 'ix' ? 'price index' : s.cls === 'vol' ? 'index level' : 'total return (adjusted close)') : esc(s.unit === '%' ? 'percent' : s.unit)}. Shaded bands are US recessions (NBER). Source: ${s.log ? 'Yahoo Finance' : 'FRED'}.`)}${stats}</section>`;
  }
  function distribution(st) {
    const id = F.has(st.focus) && F.ser(st.focus).log ? st.focus : '^GSPC', s = F.ser(id), i0 = FV.rangeStart(st.range === '1M' || st.range === '3M' ? '1Y' : (st.range || '5Y'), id);
    const r = F.rets(id, i0 + 1, s.e).map(x => (Math.exp(x) - 1) * 100), m = S.mean(r), sd = S.sd(r);
    const lo = -4, hi = 4, w = 0.25, bins = []; for (let x = lo; x < hi - 1e-9; x += w) bins.push({ a: x, b: x + w, n: 0 });
    let tl = 0, tr = 0; r.forEach(v => { if (v < lo) tl++; else if (v >= hi) tr++; else bins[Math.min(bins.length - 1, Math.floor((v - lo) / w))].n++; });
    const n = r.length, pdf = x => Math.exp(-((x - m) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI));
    const items = bins.map(b => ({ label: Math.abs(b.a - Math.round(b.a)) < 1e-9 ? sgn(b.a, 0, '%') : '', y: b.n / n * 100, color: b.a + w / 2 < 0 ? 'var(--s2)' : 'var(--s1)', exp: pdf(b.a + w / 2) * w * 100, b }));
    const k = r.reduce((a, v) => a + ((v - m) / sd) ** 4, 0) / n, sk = r.reduce((a, v) => a + ((v - m) / sd) ** 3, 0) / n, big = r.filter(v => Math.abs(v - m) > 3 * sd).length / n * 100;
    const ch = C.bars({ items, h: 210, yFmt: v => num(v, 0) + '%', labelEvery: 4, tip: d => `<b>${esc(num(d.b.a, 2))}% to ${esc(num(d.b.b, 2))}%</b>${K.tipRow(d.color, 'Share of days', esc(num(d.y, 1) + '%'))}${K.tipRow(null, 'If returns were normal', esc(num(d.exp, 1) + '%'))}` });
    return U.card('How it moves day to day', `${esc(F.short(id))}, daily returns over the selected range. Tails beyond ±4%: ${tl} down days, ${tr} up days.`, ch + `<dl class="kv" style="margin-top:8px">${[['Average day', FV.P(m, 3)], ['Typical swing (1 s.d.)', '±' + num(sd, 2) + '%'], ['Days beyond 3 s.d.', `${num(big, 2)}% (a normal curve says 0.27%)`], ['Kurtosis (normal = 3)', num(k, 1)], ['Skew', num(sk, 2)]].map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>`);
  }
  function seasonality(st) {
    const id = F.has(st.focus) && F.ser(st.focus).log ? st.focus : '^GSPC', me = F.monthEnds(), v = F.sampled(id, me.ix), by = Array.from({ length: 12 }, () => []);
    for (let k = 1; k < v.length - 1; k++) if (ok(v[k]) && ok(v[k - 1])) by[+me.keys[k].slice(5, 7) - 1].push((v[k] / v[k - 1] - 1) * 100);
    const items = by.map((a, m) => ({ label: K.MON[m], y: S.mean(a), color: S.mean(a) >= 0 ? 'var(--s1)' : 'var(--s2)', n: a.length, up: a.filter(x => x > 0).length / a.length * 100, med: S.median(a) }));
    return U.card('Seasonality', `${esc(F.short(id))}: average return by calendar month since ${esc(F.CAL[F.ser(id).s].slice(0, 4))}. Patterns this noisy rarely survive costs; read it as history, not a forecast.`, C.bars({ items, h: 210, yFmt: v => num(v, 1) + '%', tip: d => `<b>${d.label}</b>${K.tipRow(d.color, 'Average', esc(FV.P(d.y, 2)))}${K.tipRow(null, 'Median', esc(FV.P(d.med, 2)))}${K.tipRow(null, 'Up years', esc(pct(d.up, 0) + ' of ' + d.n))}` }));
  }
  function scoreTable() {
    const rows = FM.scorecard().map(r => Object.assign({ _asset: r.id, _name: F.short(r.id), _search: r.name + ' ' + r.id }, r));
    const P = v => FV.P(v), cls = v => `<span class="${K.cls(v)}">${esc(FV.P(v))}</span>`;
    return T.html({
      rows, limit: 25, placeholder: 'Search 60 markets…', sort: { k: 'ytd', dir: -1 },
      cols: [
        { k: 'name', lab: 'Market', html: r => `${esc(F.short(r.id))} <span class="muted mono">${esc(F.tick(r.id))}</span>` },
        { k: 'd1', lab: '1D', num: true, html: r => cls(r.d1), good: 1, fmt: P },
        { k: 'm1', lab: '1M', num: true, html: r => cls(r.m1), good: 1 },
        { k: 'ytd', lab: 'YTD', num: true, html: r => cls(r.ytd), good: 1 },
        { k: 'y1', lab: '1Y', num: true, fmt: P, good: 1 },
        { k: 'y3', lab: '3Y/yr', num: true, fmt: P, good: 1, title: 'Annualized return over 3 years' },
        { k: 'y5', lab: '5Y/yr', num: true, fmt: P, good: 1, title: 'Annualized return over 5 years' },
        { k: 'y10', lab: '10Y/yr', num: true, fmt: P, good: 1, title: 'Annualized return over 10 years' },
        { k: 'vol', lab: 'Vol', num: true, fmt: v => ok(v) ? num(v, 1) + '%' : '–', good: -1, title: 'Annualized volatility, last year' },
        { k: 'sharpe', lab: 'Sharpe', num: true, fmt: v => ok(v) ? num(v, 2) : '–', good: 1, title: '5-year return above T-bills per unit of volatility' },
        { k: 'mdd', lab: 'Max DD', num: true, fmt: v => ok(v) ? num(v, 0) + '%' : '–', good: 1, title: 'Worst peak-to-trough fall in the data' },
        { k: 'dd', lab: 'From high', num: true, fmt: v => ok(v) ? num(v, 1) + '%' : '–', good: 1 },
        { k: 'beta', lab: 'Beta', num: true, fmt: v => ok(v) ? num(v, 2) : '–', title: 'Sensitivity to the S&P 500, 3 years of weekly returns' },
        { k: 'trend', lab: 'vs 200d', num: true, fmt: v => ok(v) ? sgn(v, 1, '%') : '–', good: 1, title: 'Price versus its 200-day moving average' }
      ]
    });
  }
  function curveMachine(st) {
    const N = F.N - 1, back = K.clamp(+st.cback || 0, 0, N - F.ser('DGS3MO').s), i = N - back;
    const extra = st.cback ? [['Selected: ' + K.isoLab(F.CAL[i]), i]] : [];
    const ch = FV.curveChart(extra.concat([['Latest', N]]).concat(st.cback ? [] : [['1 year ago', N - 252], ['5 years ago', FV.rangeStart('5Y')]]), 250);
    const sl = `<div class="ctrl" style="margin-top:6px"><label><span>Drag to travel back in time</span><output>${esc(K.isoLab(F.CAL[i]))}</output></label><input type="range" data-cback min="0" max="${N - F.ser('DGS3MO').s}" step="5" value="${back}" style="direction:rtl" aria-label="Date for the yield curve"><div class="pill-row" style="margin-top:6px"><button type="button" class="btn" data-cplay>${st.cplay ? 'Pause' : 'Play history'}</button>${['1990-07-02', '2000-03-24', '2006-12-29', '2008-12-31', '2019-08-30', '2023-07-03'].map(d => `<button type="button" class="chip" data-cjump="${d}">${d.slice(0, 4)}</button>`).join('')}<button type="button" class="chip" data-cjump="now">Today</button></div></div>`;
    const sp = F.at('DGS10', i) - F.at('DGS3MO', i);
    return U.card('Yield curve time machine', `Treasury yields by maturity. On ${esc(K.isoLab(F.CAL[i]))} the 10-year minus 3-month spread was <b>${esc(FV.pp(sp))}</b>${sp < 0 ? ' (inverted)' : ''}.`, `<div id="curveHost">${ch}</div>${sl}`);
  }
  function spreads(st) {
    const i0 = FV.rangeStart(st.range === 'MAX' || !st.range ? 'MAX' : st.range === '1M' || st.range === '3M' || st.range === '6M' || st.range === 'YTD' ? '1Y' : st.range), N = F.N - 1;
    const d = (a, b) => { const out = new Float64Array(F.N).fill(NaN), A = F.ser(a), B = F.ser(b); for (let i = Math.max(A.s, B.s); i <= Math.min(A.e, B.e); i++) out[i] = A.v[i] - B.v[i]; return out; };
    const s1 = d('DGS10', 'DGS3MO'), s2 = d('DGS10', 'DGS2');
    const rec = F.recessions().filter(([a, b]) => b > F.X[i0]);
    const c1 = C.line({ series: [{ name: '10-year minus 3-month', pts: F.seriesPts(s1, i0, N), color: 'var(--s1)' }, { name: '10-year minus 2-year', pts: F.seriesPts(s2, i0, N), color: 'var(--s4)', width: 1.5 }], h: 230, yFmt: v => num(v, 1), tipFmt: v => sgn(v, 2, ' pp'), tipX: F.xLab, shade: rec, shadeName: 'US recession', aria: 'Yield curve spreads' });
    const c2 = C.line({ series: [{ name: 'Baa corporate spread', pts: F.pts('BAA10Y', i0, N), color: 'var(--s2)' }, { name: 'High-yield spread (since 2023)', pts: F.pts('BAMLH0A0HYM2', i0, N), color: 'var(--s5)', width: 1.5 }], h: 230, yFmt: v => num(v, 1), tipFmt: v => num(v, 2) + ' pp', tipX: F.xLab, shade: rec, shadeName: 'US recession', aria: 'Credit spreads' });
    const c3 = C.line({ series: [{ name: '10-year real yield (TIPS)', pts: F.pts('DFII10', i0, N), color: 'var(--s3)' }, { name: '10-year breakeven inflation', pts: F.pts('T10YIE', i0, N), color: 'var(--s7)' }, { name: 'Fed funds', pts: F.pts('DFF', i0, N), color: 'var(--s4)', width: 1.4 }], h: 230, yFmt: v => num(v, 1) + '%', tipFmt: v => num(v, 2) + '%', tipX: F.xLab, aria: 'Real yields and inflation expectations' });
    return `<div class="grid g2">${U.card('Is the curve inverted?', 'Below zero means short rates above long rates, a classic recession warning with long and variable lags.', c1)}${U.card('Credit spreads', 'Extra yield on corporate bonds over Treasuries; it widens when investors fear defaults. The high-yield series on FRED only covers the last three years.', c2)}</div><div class="grid g2" style="margin-top:14px">${U.card('Real yields and expected inflation', 'A 10-year Treasury yield is roughly the real yield plus breakeven inflation.', c3)}${U.card('Why stock-bond correlation matters', 'Rolling 52-week correlation of weekly S&P 500 and 10-year Treasury returns. Negative means bonds cushion stock sell-offs.', stockBond())}</div>`;
  }
  function stockBond() {
    const sb = FM.stockBond();
    return C.line({ series: [{ name: 'S&P 500 vs 10-year Treasury (rebuilt from yields)', pts: sb.synth, color: 'var(--s1)' }, { name: 'SPY vs IEF (funds)', pts: sb.etf, color: 'var(--s4)', width: 1.3, dash: '4 3' }], h: 230, y0: -1, y1: 1, yFmt: v => num(v, 1), tipFmt: v => num(v, 2), tipX: F.xLab, aria: 'Rolling stock-bond correlation' }) + U.src(`Now ${num(sb.now, 2)}. It was negative from about 2000 to 2021 and turned positive with the 2022 inflation shock, which is why bonds failed to protect portfolios that year.`);
  }
  const CORR_IDS = ['SPY', 'QQQ', 'IWM', 'EFA', 'EEM', 'AGG', 'TLT', 'TIP', 'HYG', 'GLD', 'DBC', 'VNQ', 'BTC-USD', 'DX-Y.NYB'];
  function corrPanel(st) {
    const weeks = +(st.cwin || 156), cm = FM.corrMatrix(CORR_IDS, weeks), cl = FM.cluster(cm.M), ord = cl.order, n = ord.length;
    const cs = 30, lw = 112, dw = 90, top = 74, W = dw + lw + n * cs + 4, H = top + n * cs + 6;
    let svg = '';
    // dendrogram on the left, leaves aligned with matrix rows
    const pos = {}; ord.forEach((leaf, k) => { pos[leaf] = top + k * cs + cs / 2; });
    const maxH = cl.root.h || 1, xh = h => dw - 6 - (h / maxH) * (dw - 12);
    const draw = node => { if (!node.l) return { y: pos[node.items[0]], x: dw - 6 }; const a = draw(node.l), b = draw(node.r), x = xh(node.h); svg += `<path d="M${a.x} ${a.y}H${x}V${b.y}H${b.x}" style="fill:none;stroke:var(--ink-2);stroke-width:1.2"/>`; return { y: (a.y + b.y) / 2, x }; };
    draw(cl.root);
    ord.forEach((i, r) => {
      svg += `<text x="${dw + lw - 6}" y="${top + r * cs + cs / 2 + 4}" text-anchor="end" class="lbl">${esc(F.short(cm.ids[i]))}</text>`;
      svg += `<text transform="translate(${dw + lw + r * cs + cs / 2 + 4},${top - 6}) rotate(-55)" class="lbl" style="font-size:10.5px">${esc(F.tick(cm.ids[i]) || F.short(cm.ids[i]))}</text>`;
      ord.forEach((j, c) => { const v = cm.M[i][j]; svg += `<rect x="${dw + lw + c * cs}" y="${top + r * cs}" width="${cs - 2}" height="${cs - 2}" rx="3" style="fill:${ok(v) ? C.div(v * 0.85) : 'var(--grid)'}" data-tip="${esc(`<b>${F.short(cm.ids[i])} × ${F.short(cm.ids[j])}</b>${K.tipRow(null, 'Correlation', ok(v) ? num(v, 2) : 'n/a')}`)}"/>`; if (ok(v) && i !== j) svg += `<text x="${dw + lw + c * cs + cs / 2 - 1}" y="${top + r * cs + cs / 2 + 3}" text-anchor="middle" style="font:9.5px var(--f-mono);fill:var(--ink);pointer-events:none">${(v < 0 ? '−' : '') + Math.abs(v).toFixed(1).replace(/^0/, '')}</text>`; });
    });
    const legend = C.rampHTML('div', -1, 1, v => num(v, 0), 'Correlation');
    return U.card('What moves together', `Correlation of weekly returns over the last ${weeks / 52} year${weeks > 52 ? 's' : ''}, ordered by hierarchical clustering (the tree joins the most similar markets first). Blue moves together; red moves opposite.`, `<div class="mtx-wrap"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="mtx" role="img" aria-label="Correlation matrix">${svg}</svg></div><div style="margin-top:8px">${legend}</div>`, U.seg('cwin', [['52', '1Y'], ['156', '3Y'], ['520', '10Y']], String(weeks), 'Window'));
  }
  function curveNote() { // latest inversion episode in the data and whether an NBER recession followed
    const a = F.ser('DGS10'), b = F.ser('DGS3MO'); let st = null, en = null;
    for (let i = Math.max(a.s, b.s); i <= Math.min(a.e, b.e); i++) { const inv = a.v[i] - b.v[i] < 0; if (inv && st == null) { st = i; en = null; } if (!inv && st != null && en == null) en = i; if (inv && en != null && i - en > 63) { st = i; en = null; } }
    if (st == null) return 'No inversion in the data since 1990.';
    const xs = F.X[st], rec = F.recessions().find(([r0]) => r0 > xs);
    const span = `${K.isoLab(F.CAL[st])} to ${en ? K.isoLab(F.CAL[en]) : 'today'}`;
    return rec ? `The latest inversion (${span}) was followed by a recession starting around ${Math.floor(rec[0])}.` : `The latest inversion (${span}) has not been followed by an NBER-dated recession in this data so far.`;
  }
  function view(st) {
    return `${U.sec('Market explorer', 'Any of 60 markets or 34 rates since 1990. Compare up to five, switch views, change the range.')}
      ${explorer(st)}
      <div class="grid g2" style="margin-top:14px">${distribution(st)}${seasonality(st)}</div>
      ${U.sec('Every market, side by side', 'Sort any column. Switch to Heat map to shade each column against the others. Click a row for details.')}
      ${scoreTable()}
      ${U.sec('Rates and credit', 'The price of money and of risk.')}
      <div class="grid g-7-5">${curveMachine(st)}${U.card('The curve, decoded', '', `<div class="prose sm"><p><b>Normal</b>: longer loans pay more. <b>Flat or inverted</b>: markets expect rate cuts, usually because they expect the economy to slow.</p><p>Since the late 1960s every US recession was preceded by an inverted 10-year minus 3-month curve, with lags of roughly 6 to 24 months (New York Fed research), though not every inversion was followed by one.</p><p>${curveNote()}</p><p>Steepening after an inversion has often come just before recessions start, as the Fed cuts.</p></div>`)}</div>
      <div style="margin-top:14px">${spreads(st)}</div>
      ${U.sec('Correlations', 'Diversification only works if assets do not fall together.')}
      ${corrPanel(st)}`;
  }
  return { view, explorer, curveMachine, corrPanel, assetOptions, CORR_IDS };
})();
