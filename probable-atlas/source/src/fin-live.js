/* Probable Atlas · Finance: shared view helpers, the asset drawer and the Live now tab. */
const FV = (() => {
  const { esc, ok, num, pct, sgn } = K;
  const RANGES = [['1M', '1M'], ['3M', '3M'], ['6M', '6M'], ['YTD', 'YTD'], ['1Y', '1Y'], ['3Y', '3Y'], ['5Y', '5Y'], ['10Y', '10Y'], ['MAX', 'Max']];
  function rangeStart(r, id) {
    const N = F.N, s = id ? F.ser(id).s : 0, back = { '1M': 21, '3M': 63, '6M': 126, '1Y': 252 }[r];
    if (back) return Math.max(s, N - 1 - back);
    if (r === 'YTD') return Math.max(s, F.idx(F.ytdBase()));
    const yrs = { '3Y': 3, '5Y': 5, '10Y': 10 }[r];
    if (yrs) return Math.max(s, F.idx(F.ordToIso(F.ORD[N - 1] - Math.round(yrs * 365.25))));
    return s;
  }
  const P = (v, d = 1) => ok(v) ? sgn(v, d, '%') : '–';
  const pp = (v, d = 2) => ok(v) ? sgn(v, d, ' pp') : '–';
  const chgTxt = (id, v, d) => F.ser(id).log ? P(v, d) : pp(v, d);
  const heatBg = (v, scale) => ok(v) ? `background:${C.div(K.clamp(v / scale, -1, 1) * 0.62)}` : '';
  const cell = (v, scale, d = 1, tip, unit) => `<div class="c"${ok(v) ? ` style="${heatBg(v, scale)}"` : ''}${tip ? ` data-tip="${esc(tip)}"` : ''}>${ok(v) ? (unit === 'pp' ? sgn(v, 2, '') : sgn(v, d, '')) : '–'}</div>`;
  const asLink = (id, label) => `<a href="#" data-asset="${esc(id)}">${esc(label || F.short(id))}</a>`;
  const sparkFor = (id, days = 63, o = {}) => { const s = F.ser(id), a = Math.max(s.s, s.e - days), v = []; for (let i = a; i <= s.e; i++) v.push(s.v[i]); const up = v[v.length - 1] >= v[0]; return C.spark(v, Object.assign({ w: 110, h: 26, color: s.log ? (up ? 'var(--s1)' : 'var(--s2)') : 'var(--s7)' }, o)); };
  const asOf = () => { const i = F.info(); return `Prices through ${K.isoLab(F.CAL[F.N - 1])}${i.fetched ? ' · refreshed ' + esc(K.ago(i.fetched)) : ''}`; };

  /* ---------------- asset drawer ---------------- */
  function openAsset(id) {
    const s = F.ser(id); if (!s) return;
    const q = F.quote(id), dd = s.log ? F.drawdown(id) : null, ts = FM.trendStatus(id), mdd = s.log ? F.maxDD(id) : null;
    const i0 = rangeStart('5Y', id), pts = F.pts(id, i0, s.e, 700);
    const ma = []; if (s.log) { for (let i = Math.max(i0, s.s + 199); i <= s.e; i += Math.max(1, Math.floor((s.e - i0) / 400))) ma.push([F.X[i], F.sma(id, 200, i)]); }
    const chart = C.line({ series: [{ name: F.short(id), pts, color: 'var(--s1)', width: 1.8 }].concat(ma.length ? [{ name: '200-day average', pts: ma, color: 'var(--s4)', width: 1.4, dash: '5 3' }] : []), h: 230, logY: s.log && s.cls !== 'vol', yFmt: v => F.fmtLevel(id, v), tipX: F.xLab, aria: F.label(id) + ' over five years' });
    const yrs = []; const y1 = +F.CAL[F.N - 1].slice(0, 4);
    if (s.log) for (let y = Math.max(+F.CAL[s.s].slice(0, 4) + 1, y1 - 11); y <= y1; y++) { const a = F.idx(`${y - 1}-12-31`), b = y === y1 ? s.e : F.idx(`${y}-12-31`); if (a >= s.s) yrs.push({ label: y === y1 ? `${y} YTD` : String(y), y: (s.v[b] / s.v[a] - 1) * 100, color: s.v[b] >= s.v[a] ? 'var(--s1)' : 'var(--s2)' }); }
    const tiles = [
      U.tile({ lab: 'Last', val: esc(F.money(id, q.last)), sub: `${K.isoLab(q.date)} ${s.log ? U.upDown(q.pct, 2) : U.upDown(q.chg, 2, ' pp')}` }),
      U.tile({ lab: 'Year to date', val: esc(chgTxt(id, F.ytd(id))) }),
      U.tile({ lab: '1 year', val: esc(chgTxt(id, F.chg(id, 252))) }),
      s.log ? U.tile({ lab: 'Volatility (1 year)', val: esc(pct(F.vol(id), 1)), sub: 'annualized' }) : U.tile({ lab: '1 month', val: esc(pp(F.chg(id, 21))) }),
      s.log ? U.tile({ lab: 'From its high', val: esc(pct(dd.dd, 1)), sub: `High ${K.isoLab(dd.highDate)}` }) : U.tile({ lab: '5 years ago', val: esc(F.fmtLevel(id, F.at(id, rangeStart('5Y', id)))) }),
      s.log && ts ? U.tile({ lab: 'Trend', val: ts.up ? 'Up' : 'Down', sub: `${sgn(ts.above, 1, '%')} vs 200-day average` }) : U.tile({ lab: '10 years ago', val: esc(F.fmtLevel(id, F.at(id, rangeStart('10Y', id)))) })
    ].join('');
    const kv = s.log ? `<dl class="kv">${[['3-year return (a year)', P(F.annRet(id, 3))], ['5-year return (a year)', P(F.annRet(id, 5))], ['10-year return (a year)', P(F.annRet(id, 10))], ['Worst drawdown since ' + F.CAL[s.s].slice(0, 4), pct(mdd.mdd, 1) + ` (${mdd.peak.slice(0, 4)}–${mdd.trough.slice(0, 4)})`], ['12-month momentum (skip 1)', ts && ok(ts.mom) ? P(ts.mom) : '–']].map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>` : '';
    K.drawer.open(`<div class="dh"><div><div class="kicker" style="color:var(--band-accent)">${esc(F.CLS[s.cls] || 'Market')}${F.tick(id) ? ' · ' + esc(F.tick(id)) : ''}</div><h2 id="drTitle">${esc(F.short(id))}</h2><div class="meta">${esc(s.name)}${s.cur && s.cur !== 'USD' ? ' · prices in ' + esc(s.cur) : ''} · data since ${esc(K.isoLab(F.CAL[s.s]))}</div></div><button type="button" class="x" data-close aria-label="Close">×</button></div>
      <div class="db"><div class="tiles t3">${tiles}</div>
      ${U.card('Last five years', s.log ? 'Log scale, with the 200-day moving average.' : 'Daily values.', chart)}
      ${yrs.length ? U.card('Calendar-year returns', 'Total return including dividends for funds; price change for indexes.', C.bars({ items: yrs, h: 180, yFmt: v => num(v, 0) + '%', valueLabels: yrs.length <= 8, tip: d => `<b>${esc(d.label)}</b>${K.tipRow(d.color, 'Return', esc(P(d.y)))}` })) : ''}
      ${kv ? U.card('Risk and return', '', kv) : ''}
      <div class="pill-row"><button type="button" class="btn pri" data-goto="markets" data-focus="${esc(id)}">Chart it in Markets</button><button type="button" class="btn" data-ask="${esc('How is ' + F.short(id) + ' doing, and what are the risks?')}">Ask AI about ${esc(F.short(id))}</button><button type="button" class="btn" data-close>Close</button></div></div>`);
    C.mount(document.getElementById('drawer'));
    if (typeof FINX !== 'undefined') { try { FINX.onAsset(id); } catch (e) { console.error(e); } }
  }

  /* ---------------- Live now ---------------- */
  const HERO = ['^IXIC', '^RUT', 'DGS10', '^VIX', 'DX-Y.NYB', 'GC=F', 'CL=F', 'BTC-USD'];
  const QUILT = [
    ['US stocks', ['^GSPC', '^IXIC', '^DJI', '^RUT', 'RSP']], ['World stocks', ['EFA', 'EEM', '^FTSE', '^GDAXI', '^N225', '^HSI', '000001.SS', '^NSEI']],
    ['Bonds', ['SHY', 'IEF', 'TLT', 'TIP', 'LQD', 'HYG', 'EMB']], ['Real assets & crypto', ['GC=F', 'SLV', 'CL=F', 'HG=F', 'DBC', 'VNQ', 'BTC-USD', 'ETH-USD']], ['Dollar & volatility', ['DX-Y.NYB', '^VIX', '^MOVE']]
  ];
  const PER = [['d1', '1D', 1], ['w1', '1W', 5], ['m1', '1M', 21], ['m3', '3M', 63], ['ytd', 'YTD', null], ['y1', '1Y', 252]];
  function quilt() {
    const val = (id, k, n) => k === 'ytd' ? F.ytd(id) : k === 'd1' ? F.quote(id).pct : F.chg(id, n);
    const all = {}; PER.forEach(([k, , n]) => { all[k] = QUILT.flatMap(g => g[1]).map(id => Math.abs(val(id, k, n))).filter(ok); });
    const scale = {}; PER.forEach(([k]) => { scale[k] = Math.max(0.5, S.quantile(all[k], 0.85) || 1); });
    let h = `<div class="heat quilt" style="grid-template-columns:minmax(120px,1.6fr) repeat(6,minmax(52px,1fr))"><div class="h" style="text-align:left">Market</div>${PER.map(p => `<div class="h">${p[1]}</div>`).join('')}`;
    for (const [g, ids] of QUILT) {
      h += `<div class="grp">${esc(g)}</div>`;
      for (const id of ids) {
        if (!F.has(id)) continue;
        h += `<div class="n row-click" data-asset="${esc(id)}" role="button" tabindex="0">${esc(F.short(id))}</div>`;
        for (const [k, lab, n] of PER) { const v = val(id, k, n); h += cell(v, scale[k], k === 'd1' || k === 'w1' ? 1 : 1, `<b>${esc(F.short(id))}</b>${K.tipRow(null, lab, esc(P(v, 2)))}${K.tipRow(null, 'Last', esc(F.money(id, F.quote(id).last)))}`); }
      }
    }
    return h + '</div>';
  }
  function sectorGrid(per) {
    const n = { d1: 1, w1: 5, m1: 21, ytd: null, y1: 252 }[per];
    const items = FM.SECT.filter(F.has).map(id => ({ id, v: per === 'ytd' ? F.ytd(id) : per === 'd1' ? F.quote(id).pct : F.chg(id, n) })).sort((a, b) => b.v - a.v);
    const sc = Math.max(0.6, ...items.map(d => Math.abs(d.v))), spy = per === 'ytd' ? F.ytd('SPY') : per === 'd1' ? F.quote('SPY').pct : F.chg('SPY', n);
    return `<div class="sectors">${items.map(d => `<button type="button" class="sect" data-asset="${d.id}" style="${heatBg(d.v, sc)}" data-tip="${esc(`<b>${F.ser(d.id).name} (${d.id})</b>${K.tipRow(null, 'Return', P(d.v, 2))}${K.tipRow(null, 'vs S&P 500', sgn(d.v - spy, 2, ' pp'))}`)}"><span>${esc(F.ser(d.id).name)}</span><b>${P(d.v)}</b></button>`).join('')}</div>${U.src(`S&P 500 (SPY): ${P(spy)}. Sector funds from State Street SPDR; tap a sector for its chart.`)}`;
  }
  function worldBoard() {
    const ids = ['^GSPC', '^GSPTSE', '^BVSP', '^MXX', '^FTSE', '^GDAXI', '^FCHI', '^STOXX50E', '^N225', '^HSI', '000001.SS', '^KS11', '^NSEI', '^AXJO'].filter(F.has);
    return `<div class="board">${ids.map(id => { const q = F.quote(id), y = F.ytd(id); return `<div class="brow" data-asset="${id}" role="button" tabindex="0"><span class="nm">${esc(F.short(id))}<small>${esc(F.ser(id).cur)} · ${esc(K.isoLab(q.date).replace(/, \d{4}$/, ''))}</small></span><span class="lv">${esc(F.fmtLevel(id, q.last))}</span>${U.upDown(q.pct, 1)}<span class="yt ${K.cls(y)}">${esc(P(y))} <small>YTD</small></span>${sparkFor(id, 252, { w: 84, h: 22 })}</div>`; }).join('')}</div>${U.src('Local-currency price indexes (no dividends). Markets close at different times, so a day can include news that landed after the US close.')}`;
  }
  const MAT = [['DGS1MO', 1 / 12], ['DGS3MO', 0.25], ['DGS6MO', 0.5], ['DGS1', 1], ['DGS2', 2], ['DGS3', 3], ['DGS5', 5], ['DGS7', 7], ['DGS10', 10], ['DGS20', 20], ['DGS30', 30]];
  const MLAB = ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'];
  function curveAt(i) { return MAT.map(([id], k) => [k, F.at(id, i)]).filter(p => ok(p[1])); }
  function curveChart(dates, h = 230) {
    const cols = ['var(--s1)', 'var(--s4)', 'var(--s7)', 'var(--s3)'];
    const series = dates.map(([lab, i], k) => ({ name: lab, pts: curveAt(i), color: cols[k % 4], width: k ? 1.6 : 2.4, dash: k ? '5 3' : null, dots: !k }));
    return C.line({ series, h, xTicks: MAT.map((_, k) => k), xFmt: k => MLAB[Math.round(k)] || '', zero: false, yFmt: v => num(v, 1) + '%', tipX: k => MLAB[Math.round(k)] + ' Treasury', tipFmt: v => num(v, 2) + '%', aria: 'Treasury yield curve' });
  }
  function movers() {
    const ids = Object.keys(F.P.s).filter(id => F.ser(id).log && F.ser(id).cls !== 'vol' && F.quote(id).date === F.CAL[F.N - 1]);
    const r = ids.map(id => ({ id, v: F.quote(id).pct })).filter(d => ok(d.v)).sort((a, b) => b.v - a.v);
    const li = arr => `<ul class="movers">${arr.map(d => `<li><a href="#" data-asset="${d.id}">${esc(F.short(d.id))}</a>${U.upDown(d.v, 2)}</li>`).join('')}</ul>`;
    return `<div class="g2 grid" style="gap:10px"><div><div class="kicker">Up most</div>${li(r.slice(0, 5))}</div><div><div class="kicker">Down most</div>${li(r.slice(-5).reverse())}</div></div>`;
  }
  function signals() {
    const rg = FM.regime(), vm = FM.volModel(), d10 = FM.risk('dd10'), ap = FM.appetite();
    const regBar = `<div class="stackbar" role="img" aria-label="Regime probabilities">${rg.now.map((p, k) => `<i style="width:${(p * 100).toFixed(1)}%;background:${rg.colors[k]}" data-tip="${esc(`<b>${rg.names[k]}</b>${K.tipRow(null, 'Probability', pct(p * 100, 0))}`)}"></i>`).join('')}</div><div class="stacklab">${rg.now.map((p, k) => `<span><i style="background:${rg.colors[k]}"></i>${rg.names[k]} ${pct(p * 100, 0)}</span>`).join('')}</div>`;
    const apSegs = [{ to: 25, color: 'var(--crit)' }, { to: 45, color: 'var(--serious)' }, { to: 55, color: 'var(--line-2)' }, { to: 75, color: 'color-mix(in oklab, var(--s1) 55%, var(--surface))' }, { to: 100, color: 'var(--s1)' }];
    const g = d10.now ? d10.now.p : null;
    return `<div class="sig grid g4">
      <section class="card sigc"><div class="kicker">Market regime</div><div class="big">${esc(rg.names[rg.state])}</div>${regBar}<div class="note">Hidden Markov model on weekly S&P 500 returns since 1990, week ending ${esc(K.isoLab(rg.asOf))}. Regimes forecast volatility well, returns poorly.</div><a href="#" data-goto="models" data-anchor="m-regime" class="more-link">How it works</a></section>
      <section class="card sigc"><div class="kicker">Expected volatility</div><div class="big">${num(vm.volAnn, 1)}%<small> a year</small></div><div class="kv2"><span>Typical day</span><b>±${num(vm.sdDay, 2)}%</b><span>1-day 99% VaR</span><b>${num(vm.varD.v99, 2)}%</b><span>VIX (market's view)</span><b>${num(F.lastVal('^VIX'), 1)}</b></div><div class="note">GJR-GARCH forecast for the S&P 500. Long-run average ${num(vm.longRun, 0)}%.</div><a href="#" data-goto="models" data-anchor="m-vol" class="more-link">Backtest</a></section>
      <section class="card sigc"><div class="kicker">Correction risk, 6 months</div><div class="gauge">${C.gauge(g || 0)}</div><div class="note">Chance of a 10%+ fall within six months. Base rate ${pct(d10.baseRate * 100, 0)}. ${U.skill('low', 'Out of sample, only modestly better than the base rate.')}</div><a href="#" data-goto="models" data-anchor="m-risk" class="more-link">Drivers and track record</a></section>
      <section class="card sigc"><div class="kicker">Risk appetite</div><div class="gauge">${C.dial(ap.now, apSegs, { lo: 'Fear', hi: 'Greed' })}</div><div class="big sm">${esc(ap.label)}</div><div class="note">Six market gauges vs the past two years. A week ago ${num(ap.week, 0)}, a month ago ${num(ap.month, 0)}.</div><a href="#" data-goto="models" data-anchor="m-appetite" class="more-link">Components</a></section>
    </div>`;
  }
  function live(st) {
    const sp = F.quote('^GSPC'), ytd = F.ytd('^GSPC'), dd = F.drawdown('^GSPC');
    const hero = U.tile({ hero: true, asset: '^GSPC', lab: 'S&P 500', val: num(sp.last, 0), sub: `${U.upDown(sp.pct, 2)} today · ${U.upDown(ytd, 1)} this year · ${dd.dd > -0.5 ? 'at a record' : num(-dd.dd, 1) + '% below record'}`, spark: sparkFor('^GSPC', 126, { w: 260, h: 34 }) });
    const tiles = HERO.map(id => { const q = F.quote(id), s = F.ser(id); return U.tile({ asset: id, lab: F.short(id), val: esc(s.log ? F.fmtLevel(id, q.last) : num(q.last, 2) + '%'), sub: `${s.log ? U.upDown(q.pct, 2) : U.upDown(q.chg, 2, ' pp')} <span class="muted">1D</span> · ${s.log ? U.upDown(F.chg(id, 21), 1) : U.upDown(F.chg(id, 21), 2, ' pp')} <span class="muted">1M</span>`, spark: sparkFor(id, 63) }); }).join('');
    const narr = FM.narrative();
    const per = st.sectPer || 'm1';
    const c3 = F.lastVal('DGS10') - F.lastVal('DGS3MO'), c2 = F.lastVal('DGS10') - F.lastVal('DGS2');
    const rates = `<dl class="kv">${[['10-year minus 3-month', pp(c3)], ['10-year minus 2-year', pp(c2)], ['Fed funds (effective)', num(F.lastVal('DFF'), 2) + '%'], ['10-year real yield (TIPS)', num(F.lastVal('DFII10'), 2) + '%'], ['10-year breakeven inflation', num(F.lastVal('T10YIE'), 2) + '%'], ['Baa corporate spread', num(F.lastVal('BAA10Y'), 2) + ' pp'], ['High-yield spread', num(F.lastVal('BAMLH0A0HYM2'), 2) + ' pp'], ['30-year mortgage', num(F.lastVal('MORTGAGE30US'), 2) + '%']].map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>`;
    const N = F.N - 1;
    return `${U.sec('Market pulse', asOf())}
      <div class="tiles pulse">${hero}${tiles}</div>
      <div class="read"><div class="kicker">Today's read</div>${narr.map(t => `<p>${esc(t)}</p>`).join('')}<div class="pill-row">${['What does this mean for a 60/40 portfolio?', 'Is a correction likely?', 'Are stocks overvalued?'].map(q => `<button type="button" class="chip" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div></div>
      ${U.sec('Signals', 'Four models, each with its track record one click away.')}
      ${signals()}
      ${U.sec('Alerts', 'Rules that fire when a reading is unusual.')}
      ${U.alerts(FM.alerts())}
      ${U.sec('Cross-asset scoreboard', 'Total returns for funds, price changes for indexes and futures. Each column is shaded on its own scale; blue is up, red is down.')}
      <section class="card">${quilt()}</section>
      <div class="grid g2" style="margin-top:14px">
        ${U.card('US sectors', 'Which parts of the market are leading.', sectorGrid(per), U.seg('sectper', [['d1', '1D'], ['w1', '1W'], ['m1', '1M'], ['ytd', 'YTD'], ['y1', '1Y']], per, 'Period'))}
        ${U.card('World markets', 'Last close, day change and year to date.', worldBoard())}
      </div>
      <div class="grid g-7-5" style="margin-top:14px">
        ${U.card('Treasury yield curve', 'Today against one month and one year ago.', curveChart([['Latest', N], ['1 month ago', N - 21], ['1 year ago', N - 252]]))}
        ${U.card('Rates and credit', '', rates)}
      </div>
      ${U.sec('Biggest movers today', 'Across the 60 markets tracked here.')}
      <section class="card">${movers()}</section>`;
  }

  return { live, openAsset, quilt, sectorGrid, worldBoard, curveChart, curveAt, MAT, MLAB, RANGES, rangeStart, P, pp, chgTxt, heatBg, cell, asLink, sparkFor, asOf, PER };
})();
