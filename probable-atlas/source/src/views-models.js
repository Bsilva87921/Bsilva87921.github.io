/* Probable Atlas · Economics: "Models & forecasts" tab. */
const VM = (() => {
  const { esc, ok, num, pct, sgn } = K;
  const coefTable = (vars, fit, isProbit) => `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Variable</th><th>Coefficient</th><th>${isProbit ? 'z' : 't'}</th><th>p-value</th></tr></thead><tbody>${['Constant'].concat(vars).map((v, i) => `<tr><td>${esc(v)}</td><td>${num(fit.b[i], 3)}</td><td>${num(isProbit ? fit.z[i] : fit.t[i], 2)}</td><td>${fit.p[i] < 0.001 ? '<0.001' : num(fit.p[i], 3)}</td></tr>`).join('')}</tbody></table></div>`;
  const qx = q => q / 4 + 0.125;

  /* ---------------- US ---------------- */
  function recessionCard(st) {
    const rec = M.recession(), key = rec.models[st.recModel] ? st.recModel : 'classic', m = rec.models[key]; if (!m) return '';
    const other = rec.models[key === 'classic' ? 'extended' : 'classic'];
    const x0 = key === 'classic' ? 1960 : 1972, x1 = (rec.tNow + 13) / 12;
    const chart = C.line({ series: [{ name: 'Model probability (fit on all data)', pts: m.path.filter(p => p[0] >= x0), color: 'var(--s1)', width: 1.8 }, { name: 'Out-of-sample (refit each year, from 1985)', pts: m.oos, color: 'var(--s2)', width: 1.8 }], shade: E.recessions(), shadeName: 'Recession', h: 420, x0, x1, y0: 0, y1: 100, zero: false, hlines: [{ y: 30, label: '30% alert line', color: 'var(--ink-2)' }], yFmt: v => num(v, 0) + '%', tipX: x => 'Recession in ' + K.mLab(Math.round(x * 12)), aria: 'Recession probability history' });
    const sc = m.score;
    const recRows = sc.recs.map(r => `<tr><td>${K.mLab(r.start)}–${K.mLab(r.end)}</td><td>${pct(r.max * 100, 0)}</td><td>${r.lead != null ? r.lead + ' months' : 'Missed'}</td></tr>`).join('');
    const vars = m.vars.map((v, i) => `${v}: <b>${num(m.xNow[i], 2)}</b>`).join(' · ');
    return V.sec('Will the US be in recession a year from now?', 'A probit model in the style of the New York Fed: the slope of the Treasury yield curve has preceded every US recession since the 1960s.', V.seg('recmodel', [['classic', 'Yield curve'], ['extended', 'Curve + policy + conditions']], key)) +
      `<div class="grid g-8-4">${V.card('Probability of recession 12 months ahead', `Plotted at the month being predicted, so peaks should line up with the shaded recessions. Inputs today (${K.mLab(m.tUse)}): ${vars}.`, chart)}
       <section class="card"><h3>Today's reading</h3><div class="gauge" style="margin:8px 0">${C.gauge(m.pNow)}<div class="cap">Chance the US is in recession in ${K.mLab(m.tUse + 12)}. The ${esc(other.name.toLowerCase())} model says <b>${pct(other.pNow * 100, 0)}</b>.</div></div>
       <h3 style="margin-top:12px">Track record (out of sample)</h3>
       <div class="kv" style="margin-top:6px"><dt>Ranking skill (AUC, 0.5 = coin flip)</dt><dd>${num(sc.auc, 2)}</dd><dt>Brier score (lower is better)</dt><dd>${num(sc.brier, 3)}</dd><dt>Brier of always guessing the base rate</dt><dd>${num(sc.brier0, 3)}</dd><dt>False alarms (crossed 30%, no recession)</dt><dd>${sc.falseAlarms}</dd><dt>Months evaluated</dt><dd>${sc.n}</dd></div>
       <div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Recession</th><th title="Highest out-of-sample probability in the 24 months before it began">Peak odds</th><th title="Months before the start that the odds first reached 30%">Warning</th></tr></thead><tbody>${recRows}</tbody></table></div>
       <div class="src">Out-of-sample means each year's forecast used only data available before it. NBER dates recessions months after the fact, which this test ignores.</div></section></div>` +
      `<div class="grid g2" style="margin-top:14px">${V.card('Model coefficients', `Probit fit on ${m.fit.n} months${key === 'classic' ? ' since 1959' : ' since 1971'}; pseudo R² ${num(m.fit.pseudoR2, 2)}. A negative spread coefficient means a flatter or inverted curve raises the odds.`, coefTable(m.vars, m.fit, true))}
       ${V.card('How to read it', '', `<div class="prose" style="font-size:13.5px"><p>When short-term rates rise above long-term rates (an inverted curve), markets expect the Fed to cut, usually because they expect a slowdown. The model turns the spread into a probability using 65 years of history.</p><p>The spread is ${sgn(rec.spread(rec.tNow), 2)} pp today${rec.spread(rec.tNow) > 0 ? ', which is positive, so the odds are low' : ', which is inverted, so the odds are elevated'}. The 2022–24 inversion was the longest on record and was not followed by a recession, a reminder that this is a probability, not a verdict.</p></div>`)}</div>`;
  }
  function nowcastCard() {
    const n = M.nowcast(); if (!n) return '';
    const items = n.contrib.map(c => ({ name: c.lab, v: c.v, color: c.v >= 0 ? 'var(--s1)' : 'var(--s2)', title: `${c.lab}: ${sgn(c.x, 1)} (coef ${num(c.coef, 3)}, ${c.obs}/3 months observed)` }));
    const cov = n.contrib.map(c => `<tr><td>${esc(c.lab)}</td><td>${c.obs}/3</td><td>${sgn(c.x, 1)}${c.id === 'HOUST' || c.id === 'ICSA' ? '%' : '% ann.'}</td><td>${num(c.coef, 3)}</td><td>${c.p < 0.001 ? '<0.001' : num(c.p, 3)}</td></tr>`).join('');
    const bt = n.bt.filter(b => b.q >= 2010 * 4);
    const chart = C.line({ series: [{ name: 'Actual GDP growth', pts: bt.map(b => [qx(b.q), b.y]), color: 'var(--ink-2)', width: 1.6, dots: true, gap: 0.3 }, { name: 'Bridge-model nowcast', pts: bt.map(b => [qx(b.q), b.m]), color: 'var(--s1)', width: 2, gap: 0.3 }, { name: 'Atlanta Fed GDPNow', pts: bt.filter(b => ok(b.gdpnow)).map(b => [qx(b.q), b.gdpnow]), color: 'var(--s2)', width: 1.5, dash: '4 3', gap: 0.3 }], h: 260, y0: -10, y1: 12, yFmt: v => num(v, 0) + '%', tipX: x => K.qLab(Math.floor(x * 4)), aria: 'Nowcast backtest' });
    return V.sec(`What will ${K.qLab(n.qNow)} GDP growth be?`, 'A bridge-equation nowcast: monthly data already published for the quarter are mapped to GDP growth, and months not yet published are filled with a short-run forecast.') +
      `<div class="tiles">${V.tile({ hero: true, lab: `Nowcast, ${K.qLab(n.qNow)} (annualized)`, val: pct(n.est, 1), sub: `80% range ${num(n.lo, 1)} to ${num(n.hi, 1)}% · R² ${num(n.fit.r2, 2)} on ${n.fit.n} quarters` })}${V.tile({ lab: 'Atlanta Fed GDPNow', val: pct(n.gdpnow, 1), sub: 'Independent check, updated after each release' })}${V.tile({ lab: `Last quarter (${K.qLab(n.qLast)})`, val: pct(n.lastActual, 1), sub: 'Bureau of Economic Analysis' })}${V.tile({ lab: 'Average quarter since 1992', val: pct(n.baseline, 1), sub: 'The nowcast starts here, then indicators push it up or down' })}</div>` +
      `<div class="grid g2" style="margin-top:14px">${V.card('What is moving the nowcast', 'Contribution of each indicator relative to an average quarter, in percentage points of annualized growth.', C.hbars(items, { fmt: v => sgn(v, 2) + ' pp' }))}
      ${V.card('Inputs and coverage', 'Months of the quarter already published. Unpublished months are forecast from each series\' recent momentum.', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Indicator</th><th>Months in</th><th>Quarter change</th><th>Coef.</th><th>p-value</th></tr></thead><tbody>${cov}</tbody></table></div>`)}</div>` +
      `<div class="grid g-8-4" style="margin-top:14px">${V.card('Backtest: nowcast vs what happened', 'Each quarter re-estimated using only earlier quarters. The pandemic quarters (2020 to mid-2021) are left out of both the fit and the test.', chart)}
      <section class="card"><h3>Accuracy</h3><div class="kv" style="margin-top:8px"><dt>Nowcast error (RMSE), 2005–now</dt><dd>${num(n.score.rmse, 2)} pp</dd><dt>Naive guess (last 4 quarters' average)</dt><dd>${num(n.score.naive, 2)} pp</dd><dt>Same quarters as GDPNow (${n.score.nCommon})</dt><dd>${num(n.score.rmseCommon, 2)} pp</dd><dt>Atlanta Fed GDPNow</dt><dd>${num(n.score.gdpnowRmse, 2)} pp</dd></div><div class="src">Tested on today's revised data, which flatters any model versus real time. GDPNow uses many more inputs and is the stronger benchmark.</div></section></div>`;
  }
  function inflationCard() {
    const f = M.inflation(); if (!f) return '';
    const hist = E.mPts(E.mYoY(E.mSeries('CPIAUCSL')), f.tLast - 72);
    const path = f.path.map(p => [p[0] / 12, p[1]]), band = { lo: f.path.map(p => [p[0] / 12, p[2]]), hi: f.path.map(p => [p[0] / 12, p[3]]), name: '80% range', color: 'var(--s1)', op: 0.18 };
    const chart = C.line({ series: [{ name: 'CPI inflation (12-month)', pts: hist, color: 'var(--ink-2)', width: 2 }, { name: 'Forecast', pts: path, color: 'var(--s1)', width: 2.4, dash: '6 4' }], bands: [band], h: 280, hlines: [{ y: 2, label: '2% goal', color: 'var(--s3)' }], yFmt: v => num(v, 1) + '%', tipX: x => K.mLab(Math.round(x * 12)), aria: 'Inflation forecast' });
    const fit = f.fits[12];
    // contribution vs a neutral reading: inflation-type inputs vs 2%, gap vs 0, oil vs 0
    const neutral = [2, 2, 2.9, 0, 0];
    const SHORT = ['Inflation now', 'Core momentum (6 mo)', 'Household expectations', 'Unemployment gap', 'Oil prices (12 mo)'];
    const items = f.VARS.map((v, j) => ({ name: SHORT[j], v: fit.b[j + 1] * (f.xNow[j] - neutral[j]), title: `today ${num(f.xNow[j], 2)} vs neutral ${num(neutral[j], 1)}; coefficient ${num(fit.b[j + 1], 3)}`, color: fit.b[j + 1] * (f.xNow[j] - neutral[j]) >= 0 ? 'var(--s2)' : 'var(--s1)' }));
    const bt = f.bt.filter(b => b.t >= 2001 * 12);
    const btChart = C.line({ series: [{ name: 'Actual (12-month)', pts: bt.map(b => [(b.t + 12) / 12, b.y]), color: 'var(--ink-2)', width: 1.6 }, { name: 'Model forecast made 12 months earlier', pts: bt.map(b => [(b.t + 12) / 12, b.m]), color: 'var(--s1)', width: 2 }, { name: 'Random walk (inflation stays put)', pts: bt.map(b => [(b.t + 12) / 12, b.rw]), color: 'var(--s2)', width: 1.3, dash: '4 3' }], shade: E.recessions(), h: 250, yFmt: v => num(v, 0) + '%', tipX: x => K.mLab(Math.round(x * 12)), aria: 'Inflation backtest' });
    const p12 = f.path[12];
    return V.sec('Where is inflation heading?', 'Direct regressions for each horizon from 1 to 12 months, using today\'s inflation, core momentum, household expectations, labor-market slack and oil prices.') +
      `<div class="tiles">${V.tile({ hero: true, lab: `CPI inflation in ${K.mLab(f.tLast + 12)} (forecast)`, val: pct(p12 && p12[1], 1), sub: `80% range ${num(p12 && p12[2], 1)} to ${num(p12 && p12[3], 1)}% · today ${pct(f.now, 1)} (${K.mLab(f.tLast)})` })}${V.tile({ lab: 'Core CPI, 12-month', val: pct(f.core, 1), sub: `Core CPI, last 6 months annualized: ${pct(f.xNow[1], 1)}` })}${V.tile({ lab: 'Household expectations (1 year)', val: pct(f.xNow[2], 1), sub: 'University of Michigan survey' })}${V.tile({ lab: 'Unemployment gap', val: sgn(f.ugapNow, 2), unit: 'pp', sub: 'Jobless rate minus CBO natural rate' })}</div>` +
      `<div class="grid g-8-4" style="margin-top:14px">${V.card('Inflation forecast', 'The shaded band holds 80% of outcomes if the future looks like the past 35 years of forecast errors.', chart)}${V.card('What pushes the 12-month forecast', 'Each input\'s pull on the forecast versus a neutral reading (2% inflation, normal slack, flat oil). Orange raises it, blue lowers it.', C.hbars(items, { fmt: v => sgn(v, 2) + ' pp' }))}</div>` +
      `<div class="grid g-8-4" style="margin-top:14px">${V.card('Backtest: 12-month-ahead forecasts since 2001', 'Refit every January using only data available at the time. Shaded bands are recessions.', btChart)}<section class="card"><h3>Accuracy, 12 months ahead</h3><div class="kv" style="margin-top:8px"><dt>Model error (RMSE)</dt><dd>${num(f.score.rmse, 2)} pp</dd><dt>Random walk</dt><dd>${num(f.score.rw, 2)} pp</dd><dt>Household expectations</dt><dd>${num(f.score.mich, 2)} pp</dd><dt>Forecasts scored</dt><dd>${f.score.n}</dd></div><div class="src">${f.score.rmse < f.score.rw ? 'The model beats the random walk' : 'The model does not beat the random walk'}${f.score.rmse < f.score.mich ? ' and household expectations.' : ', but household expectations have been about as accurate.'} Inflation forecasting is hard; 2021–22 dominates the errors.</div></section></div>`;
  }
  function taylorCard() {
    const ty = M.taylor(); if (!ty) return '';
    const pce = E.mYoY(E.mSeries('PCEPILFE')), G = E.qSeries('GDPC1'), P = E.qSeries('GDPPOT'), FF = E.mSeries('FEDFUNDS');
    const rule = [], rule2 = [];
    for (let t = 1990 * 12; t <= E.mLast(pce); t++) { const c = E.mAt(pce, t), q = Math.floor(t / 3), a = E.qAt(G, q), b = E.qAt(P, q); if (!ok(c) || !ok(a) || !ok(b)) continue; const gap = (a / b - 1) * 100; rule.push([t / 12, ty.rstar + c + 0.5 * (c - 2) + 0.5 * gap]); rule2.push([t / 12, ty.rstar + c + 0.5 * (c - 2) + gap]); }
    const chart = C.line({ series: [{ name: 'Fed funds rate', pts: E.mPts(FF, 1990 * 12), color: 'var(--ink-2)', width: 2 }, { name: 'Taylor (1993) rule', pts: rule, color: 'var(--s1)', width: 1.8 }, { name: 'Balanced-approach rule', pts: rule2, color: 'var(--s2)', width: 1.4, dash: '4 3' }], shade: E.recessions(), h: 260, yFmt: v => num(v, 0) + '%', tipX: x => K.mLab(Math.round(x * 12)), aria: 'Taylor rule' });
    const ff = E.mAt(E.mSeries('DFF'), E.mLast(E.mSeries('DFF')));
    return V.sec('Is monetary policy tight or loose?', 'The Taylor rule sets a benchmark policy rate from inflation and the output gap. Central banks do not follow it mechanically, but gaps from it are informative.') +
      `<div class="grid g-8-4">${V.card('Fed funds rate vs policy rules', `Neutral real rate r* = ${num(ty.rstar, 1)}% (change it in the What-if lab). Uses core PCE inflation and the CBO output gap.`, chart)}<section class="card"><h3>Today</h3><div class="kv" style="margin-top:8px"><dt>Fed funds rate</dt><dd>${pct(ff, 2)}</dd><dt>Taylor (1993) rule</dt><dd>${pct(ty.classic, 2)}</dd><dt>Balanced-approach rule</dt><dd>${pct(ty.balanced, 2)}</dd><dt>Core PCE inflation</dt><dd>${pct(ty.core, 2)}</dd><dt>Output gap (CBO)</dt><dd>${sgn(ty.gap, 2)}%</dd></div><div class="src">Rule = r* + inflation + 0.5 × (inflation − 2) + 0.5 × output gap (1.0 in the balanced approach). A constant r* is a simplification; estimates of r* have moved over time.</div></section></div>`;
  }
  function us(st) { return recessionCard(st) + nowcastCard() + inflationCard() + taylorCard() + countryModels('USA', st, true); }

  /* ---------------- world ---------------- */
  function world(st) {
    const g = M.growth(), arch = M.archetypes();
    const W = code => E.imfS('NGDP_RPCH', code, 1980, E.CY + 5);
    const outlook = C.line({ series: [{ name: 'World', pts: W('WEOWORLD'), color: 'var(--s1)', width: 2.4 }, { name: 'Advanced economies', pts: W('ADVEC'), color: 'var(--s2)', width: 1.8 }, { name: 'Emerging & developing', pts: W('OEMDC'), color: 'var(--s3)', width: 1.8 }], h: 280, projFrom: E.VYEAR - 0.5, projLabel: 'IMF projection', endLabels: true, yFmt: v => num(v, 0) + '%', tipX: x => String(Math.round(x)), aria: 'World growth outlook' });
    // contraction risk
    const risk = E.COUNTRIES.filter(c => (E.indById('pop').get(c.iso) || 0) >= 1).map(c => { const r = g.risk(c.iso); return r && ok(r.pN) ? { _country: c.iso, name: c.name, gCY: r.gCY, gN: r.gN, model: r.model, sig: r.sigma, p: r.pN * 100 } : null; }).filter(Boolean);
    const top = risk.slice().sort((a, b) => b.p - a.p).slice(0, 15).map(r => ({ name: r.name, v: r.p, id: r._country, color: r.p >= 30 ? 'var(--s2)' : 'var(--s1)' }));
    const riskTbl = T.html({ cols: [{ k: 'name', lab: 'Economy' }, { k: 'gCY', lab: `Growth ${E.CY}`, num: true, good: 1, fmt: v => pct(v, 1) }, { k: 'gN', lab: `IMF ${E.CY + 1}`, num: true, good: 1, fmt: v => pct(v, 1) }, { k: 'model', lab: `Our model ${E.CY + 1}`, num: true, good: 1, fmt: v => pct(v, 1), title: 'Mean-reverting model: growth drifts back toward its 20-year median' }, { k: 'sig', lab: 'Typical error', num: true, good: -1, fmt: v => num(v, 1) + ' pp', title: 'How far a year\'s growth usually lands from forecast for this economy' }, { k: 'p', lab: 'Chance of contraction', num: true, good: -1, fmt: v => pct(v, 0) }], rows: risk, sort: { k: 'p', dir: -1 }, placeholder: 'Find an economy…', limit: 15, chartCol: 'p' });
    // archetypes
    const cols = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s7)'];
    const pts = arch.members.map(m => { const big = (E.BYISO[m.iso].rank || 999) <= 12; return { x: m.pc[0], y: m.pc[1], id: m.iso, name: E.name(m.iso), color: cols[m.c], r: big ? 6 : 4, lab: big ? m.iso : '', cl: arch.names[m.c].name }; });
    const scat = C.scatter({ pts, h: 340, xLab: 'Component 1 (mostly income and institutions)', yLab: 'Component 2 (mostly inflation and growth)', xFmt: v => num(v, 1), yFmt: v => num(v, 1), tip: p => `<b>${esc(p.name)}</b>${K.tipRow(p.color, 'Archetype', esc(p.cl))}`, legendItems: arch.names.map((n, i) => ({ name: n.name, color: cols[i], kind: 'sq' })), aria: 'Archetype map' });
    const mapVals = {}; arch.members.forEach(m => mapVals[m.iso] = m.c);
    const amap = C.map({ vals: mapVals, color: v => cols[v], tip: (iso, v) => `<b>${esc(E.name(iso))}</b>${K.tipRow(cols[v], 'Archetype', esc(arch.names[v].name))}`, aria: 'Archetype world map' });
    const summ = arch.names.map((n, ci) => {
      const mem = arch.members.filter(m => m.c === ci).map(m => E.BYISO[m.iso]).sort((a, b) => (a.rank || 999) - (b.rank || 999));
      return `<div class="tile"><span class="lab"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${cols[ci]};margin-right:6px"></i>${esc(n.name)} · ${mem.length}</span><span class="sub">${esc(n.blurb)}</span><span class="sub">${mem.slice(0, 6).map(c => V.clink(c.iso)).join(', ')}</span></div>`;
    }).join('');
    // anomalies
    const an = M.anomalies().filter(x => (E.indById('pop').get(x.iso) || 0) >= 5).slice(0, 12);
    const anRows = an.map(x => `<tr><td>${V.clink(x.iso)}</td><td>${esc(x.ind.lab)}</td><td>${num(x.v, 1)}</td><td>${num(x.m, 1)}</td><td>${sgn(x.z, 1)}</td></tr>`).join('');
    // backtest by year
    const yrs = [...new Set(g.bt.map(b => b.y))].sort();
    const byY = yrs.map(y => { const e = g.bt.filter(b => b.y === y); return { y, m: S.rmse(e.map(b => b.m - b.g)), n: S.rmse(e.map(b => b.naive - b.g)) }; });
    const btChart = C.line({ series: [{ name: 'Our model', pts: byY.map(r => [r.y, r.m]), color: 'var(--s1)', width: 2, dots: true }, { name: 'Naive (same as last year)', pts: byY.map(r => [r.y, r.n]), color: 'var(--s2)', width: 1.6, dash: '4 3' }], h: 230, y0: 0, yFmt: v => num(v, 0) + ' pp', tipX: x => String(Math.round(x)), aria: 'Growth model accuracy by year' });
    return V.sec('The global outlook', `IMF projections to ${E.CY + 5}, a model of each economy's chance of contracting, archetypes found by clustering, and the year's biggest breaks from trend.`) +
      V.card('Real GDP growth: world, advanced and emerging economies', `${esc(E.VINT)}. Shaded years are projections.`, outlook) +
      V.sec(`Which economies could shrink in ${E.CY + 1}?`, `The IMF's ${E.CY + 1} forecast is the center; the spread comes from how far each economy's growth has typically landed from a simple forecast since 1980. Economies with at least 1 million people.`) +
      `<div class="grid g-7-5">${riskTbl}${V.card('Highest odds of contraction', 'Click a bar for the country profile.', C.hbars(top, { lo: 0, fmt: v => pct(v, 0) }))}</div>` +
      V.sec('Economic archetypes', `K-means clustering of ${arch.members.length} economies on seven standardized fundamentals (income, 10-year growth, inflation, debt, current account, investment, government effectiveness). Principal components compress the seven into two axes for the chart; they explain ${pct((arch.pca.share[0] + arch.pca.share[1]) * 100, 0)} of the variation.`) +
      `<div class="grid g2">${V.card('Archetype map', 'Hover for the country; click to open it. Colors are backed by the legend and the list below.', scat)}${V.card('Where the archetypes are', '', `<div class="map">${amap}</div>`)}</div><div class="tiles" style="margin-top:14px">${summ}</div>` +
      V.sec('Anomalies: this year versus the last decade', 'IMF current-year figures compared with each economy\'s own 2015–24 history (pandemic years excluded). z is how many standard deviations away. Economies with 5 million people or more.') +
      `<div class="grid g-7-5">${V.card('Biggest breaks from trend', '', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Economy</th><th>Indicator</th><th>${E.CY}</th><th>10-yr avg</th><th>z</th></tr></thead><tbody>${anRows}</tbody></table></div>`)}
       ${V.card('How accurate is the growth model?', `Every year since 2000, each economy's growth was forecast one year ahead using only earlier data (${num(g.score.n, 0)} forecasts, pandemic years excluded).`, `${btChart}<div class="kv" style="margin-top:8px"><dt>Model error (RMSE)</dt><dd>${num(g.score.rmse, 2)} pp</dd><dt>Naive: same as last year</dt><dd>${num(g.score.naive, 2)} pp</dd><dt>Naive: 20-year median</dt><dd>${num(g.score.mean, 2)} pp</dd><dt>Median absolute error</dt><dd>${num(g.score.mae, 2)} pp</dd></div>`)}</div>`;
  }

  /* ---------------- single country (also used for the US world-data view) ---------------- */
  function countryModels(iso, st, compact) {
    const g = M.growth(), fan = g.fan(iso), arch = M.archetypes(), am = arch.byIso[iso];
    let out = V.sec(compact ? 'The US in the global models' : `${E.name(iso)}: forecasts`, compact ? 'The same cross-country models used for every economy.' : `A Monte Carlo growth outlook around the IMF path, the debt path, archetype and peers, and this year's anomalies.`);
    if (fan) {
      const hist = E.imfS('NGDP_RPCH', iso, 2000, g.Y1);
      const chart = C.line({ series: [{ name: 'Actual growth', pts: hist, color: 'var(--ink-2)', width: 2 }, { name: 'IMF forecast', pts: fan.years.map((y, k) => [y, fan.imf[k]]).filter(p => ok(p[1])), color: 'var(--s1)', width: 2.2, dots: true }, { name: 'Simulated median', pts: fan.years.map((y, k) => [y, fan.p50[k]]), color: 'var(--s2)', width: 1.4, dash: '4 3' }], bands: [{ lo: fan.years.map((y, k) => [y, fan.p10[k]]), hi: fan.years.map((y, k) => [y, fan.p90[k]]), name: '80% of simulations', color: 'var(--s1)', op: 0.14 }, { lo: fan.years.map((y, k) => [y, fan.p25[k]]), hi: fan.years.map((y, k) => [y, fan.p75[k]]), color: 'var(--s1)', op: 0.18 }], h: 280, projFrom: E.VYEAR - 0.5, projLabel: 'Forecast', yFmt: v => num(v, 0) + '%', tipX: x => String(Math.round(x)), aria: 'Growth outlook' });
      const pn = fan.years.map((y, k) => `<tr><td>${y}</td><td>${pct(fan.imf[k], 1)}</td><td>${pct(fan.p10[k], 1)} to ${pct(fan.p90[k], 1)}</td><td>${pct(fan.pNeg[k] * 100, 0)}</td></tr>`).join('');
      out += `<div class="grid g-8-4">${V.card('Growth outlook with uncertainty', `2,000 simulated paths: shocks the size of ${E.name(iso)}'s own history (typical error ${num(fan && g.sig[iso], 1)} pp), persisting at ${num(g.rho, 2)} a year, around the IMF path.`, chart)}${V.card('Year by year', '', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Year</th><th>IMF</th><th>80% range</th><th>Shrinks</th></tr></thead><tbody>${pn}</tbody></table></div>`)}</div>`;
    }
    const base = M.debtBase(iso);
    if (base) {
      const sim = M.debtSim(base, {});
      const chart = C.line({ series: [{ name: 'Debt history', pts: E.imfS('GGXWDG_NGDP', iso, 2000, E.CY), color: 'var(--ink-2)', width: 2 }, { name: 'IMF path', pts: base.yrs.map(y => [y, E.imf('GGXWDG_NGDP', iso, y)]).filter(p => ok(p[1])), color: 'var(--s1)', width: 2, dots: true }, { name: 'Extended baseline', pts: base.yrs.map((y, k) => [y, sim.central[k]]), color: 'var(--s2)', width: 1.6, dash: '4 3' }], bands: [{ lo: base.yrs.map((y, k) => [y, sim.p10[k]]), hi: base.yrs.map((y, k) => [y, sim.p90[k]]), name: '80% of simulations', color: 'var(--s2)', op: 0.14 }], h: 260, yFmt: v => num(v, 0) + '%', tipX: x => String(Math.round(x)), aria: 'Debt path' });
      out += `<div class="grid g-8-4" style="margin-top:14px">${V.card('Government debt path (% of GDP)', `IMF path to ${base.imfEnd}, extended to ${base.yrs[base.yrs.length - 1]} with the debt equation, and 1,500 simulations with growth and inflation shocks. Test changes in the What-if lab.`, chart)}<section class="card"><h3>Debt arithmetic</h3><div class="kv" style="margin-top:8px"><dt>Debt, ${E.CY}</dt><dd>${pct(base.d0, 0)}</dd><dt>Baseline, ${base.yrs[base.yrs.length - 1]}</dt><dd>${pct(sim.central[sim.central.length - 1], 0)}</dd><dt>Effective interest rate</dt><dd>${pct(sim.i, 1)}</dd><dt>Interest minus growth (r − g)</dt><dd>${sgn(sim.rg, 1)} pp</dd><dt>Primary balance needed to stabilize</dt><dd>${sgn(sim.stabPB, 1)}% GDP</dd><dt>Planned primary balance</dt><dd>${sgn(sim.pbEnd, 1)}% GDP</dd><dt>Chance debt is 10+ pp higher</dt><dd>${pct(sim.pUp * 100, 0)}</dd></div></section></div>`;
    }
    if (am) {
      const n = arch.names[am.c], near = arch.nearest(iso, 6);
      const zb = arch.feat.map((f, j) => ({ name: f.lab, v: am.z[j], color: am.z[j] >= 0 ? 'var(--s1)' : 'var(--s2)' }));
      out += `<div class="grid g2" style="margin-top:14px">${V.card(`Archetype: ${n.name}`, esc(n.blurb) + ` Most similar economies: ${near.map(x => V.clink(x.iso)).join(', ')}.`, C.hbars(zb, { lo: -2.5, hi: 2.5, fmt: v => sgn(v, 1) + ' sd' }))}`;
      const an = M.anomalies(iso);
      out += V.card('Anomalies this year', `${E.CY} versus the previous decade (pandemic years excluded). |z| of 2 or more is unusual.`, an.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Indicator</th><th>${E.CY}</th><th>10-yr avg</th><th>z</th></tr></thead><tbody>${an.map(x => `<tr><td>${esc(x.ind.lab)}</td><td>${num(x.v, 1)}</td><td>${num(x.m, 1)}</td><td>${sgn(x.z, 1)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Not enough history.</div>') + '</div>';
    }
    const bt = g.bt.filter(b => b.iso === iso && b.y !== 2020 && b.y !== 2021);
    if (bt.length) out += `<div class="callout" style="margin-top:14px"><b>Track record for ${esc(E.name(iso))}:</b> one-year-ahead growth forecasts since 2000 missed by ${num(S.rmse(bt.map(b => b.m - b.g)), 2)} pp on average (RMSE), versus ${num(S.rmse(bt.map(b => b.naive - b.g)), 2)} pp for "same as last year" (${bt.length} years).</div>`;
    return out;
  }
  function view(st) { return st.scope === 'WLD' ? world(st) : st.scope === 'USA' ? us(st) : countryModels(st.scope, st, false); }
  return { view, countryModels };
})();
