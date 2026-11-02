/* Probable Atlas · Finance: What-if lab (portfolio builder, frontier, Monte Carlo plan, stress tests, shock scenarios, backtest). */
const VL = (() => {
  const { esc, ok, num, pct, sgn } = K;
  const DEF = { w: { US: 40, INTL: 15, EM: 5, BND: 30, TIPS: 5, GOLD: 5 }, mode: 'forward', er: {}, mc: { start: 50000, monthly: 500, years: 25, goal: 750000, real: true }, sh: { eq: -20, rates: 0.5, credit: 1, usd: 3, oil: -10, infl: 0 }, scen: '' };
  let L = null;
  const lab = st => { if (!st.lab || !st.lab.w) st.lab = JSON.parse(JSON.stringify(DEF)); L = st.lab; L.mc = Object.assign({}, DEF.mc, L.mc || {}); L.sh = Object.assign({}, DEF.sh, L.sh || {}); L.er = L.er || {}; return L; };
  const weights = () => FP.vec(L.w);
  const total = () => weights().reduce((a, b) => a + b, 0);
  const frac = () => { const t = total(); return weights().map(v => (t > 0 ? v / t : 0)); };
  const ers = () => FP.assumptions(L.mode).map(a => (L.mode === 'forward' && ok(L.er[a.id]) ? L.er[a.id] : a.er));
  const COL = { eq: 'var(--s1)', bd: 'var(--s3)', ra: 'var(--s4)', cx: 'var(--s5)' };

  function sliders() {
    const t = total();
    return `<div class="presets">${FP.PRESETS.map(([n]) => `<button type="button" class="chip" data-preset="${esc(n)}">${esc(n)}</button>`).join('')}</div>
      <div class="wl">${FP.LAB.map(a => `<div class="wrow"><label for="lw-${a.id}"><i style="background:${COL[a.cls]}"></i>${esc(a.name)} <span class="muted mono">${esc(a.px)}</span></label><output id="lo-${a.id}">${num(L.w[a.id] || 0, 0)}%</output><input id="lw-${a.id}" type="range" min="0" max="100" step="1" value="${L.w[a.id] || 0}" data-lw="${a.id}" aria-label="${esc(a.name)} weight"></div>`).join('')}</div>
      <div class="wtot" id="wtot">${totLine(t)}</div>
      <div class="ctrl" style="margin-top:8px"><label><span>Return assumptions</span></label>${U.seg('labmode', [['forward', 'Forward-looking'], ['history', 'Past performance']], L.mode, 'Return assumptions')}<div class="hint">${L.mode === 'forward' ? 'Built from today\'s yields and valuations. Edit any line below.' : 'Average past returns of each fund. Recent winners look better than they should.'}</div></div>
      <details class="assume"${L.open ? ' open' : ''}><summary>Assumptions behind the numbers</summary>${assumeTable()}</details>`;
  }
  const totLine = t => `<span>Total <b class="${Math.abs(t - 100) < 0.5 ? '' : 'warnc'}">${num(t, 0)}%</b>${Math.abs(t - 100) >= 0.5 ? ' · analysis scales it to 100%' : ''}</span><span class="pill-row"><button type="button" class="btn sm" data-labscale>Scale to 100%</button><button type="button" class="btn sm" data-labclear>Clear</button></span>`;
  function assumeTable() {
    const A = FP.assumptions(L.mode), rm = FP.riskModel(), e = ers();
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Asset</th><th>Return a year</th><th>Volatility</th><th>Basis</th></tr></thead><tbody>${FP.LAB.map((a, i) => `<tr><td class="name">${esc(a.short)}</td><td>${L.mode === 'forward' ? `<input class="ernum" type="number" step="0.1" value="${num(e[i], 1).replace(K.MINUS, '-')}" data-er="${a.id}" aria-label="Expected return for ${esc(a.short)}">%` : esc(num(e[i], 1) + '%')}</td><td>${num(rm.vol[i] * 100, 1)}%</td><td class="wrap">${esc(A[i].src)}</td></tr>`).join('')}</tbody></table></div>${U.src(`Volatility and correlations: monthly returns ${esc(rm.from)} to ${esc(rm.to)} (Bitcoin from 2014), shrunk 20% toward the average correlation for stability. Returns are compound, before fees and taxes.`)}${L.mode === 'forward' && Object.keys(L.er).length ? '<button type="button" class="btn sm" data-erreset style="margin-top:6px">Reset to model values</button>' : ''}`;
  }

  /* ---------------- results ---------------- */
  function statTiles(s) {
    return [U.tile({ lab: 'Expected return', val: sgn(s.er, 1, '%'), sub: 'a year, compound, next decade' }), U.tile({ lab: 'Volatility', val: num(s.vol, 1) + '%', sub: 'typical yearly swing' }), U.tile({ lab: 'A bad year (1 in 20)', val: sgn(s.p5, 0, '%'), sub: `a good year: ${sgn(s.p95, 0, '%')}` }), U.tile({ lab: 'Sharpe ratio', val: num(s.sharpe, 2), sub: 'return above cash per unit of risk' }), U.tile({ lab: 'Diversification', val: num(s.dr, 2) + '×', sub: 'average asset risk ÷ portfolio risk' })].join('');
  }
  function frontierChart(s, w, e) {
    const fr = FP.frontier(e), rp = FP.riskParity(), rps = FP.stats(rp, e), cl = FP.cloud(e);
    const sMax = cl.reduce((a, c) => Math.max(a, c.sharpe || 0), 0.01);
    const cloud = cl.map(c => ({ x: c.vol, y: c.er, color: C.seq(K.clamp((c.sharpe || 0) / sMax, 0, 1) * 0.9), r: 1.6, op: 0.6 }));
    const rm = FP.riskModel();
    const assets = FP.LAB.map((a, i) => ({ x: rm.vol[i] * 100, y: e[i], r: 3.5, color: 'var(--ink-2)', lab: a.short, name: a.name })).filter(p => p.x < 40);
    const presets = FP.PRESETS.map(([n, o]) => { const st = FP.stats(FP.vec(o).map(v => v / 100), e); return { x: st.vol, y: st.er, r: 3.2, color: 'var(--s4)', name: n }; });
    const pts = assets.concat(presets, [{ x: fr.maxSharpe.vol, y: fr.maxSharpe.er, r: 6, color: 'var(--s3)', lab: 'Best Sharpe', name: 'Highest Sharpe on the frontier (max 60% per asset, no Bitcoin)', w: fr.maxSharpe.w }, { x: rps.vol, y: rps.er, r: 6, color: 'var(--s7)', lab: 'Risk parity', name: 'Risk parity (equal risk from each asset, excl. cash and Bitcoin)', w: rp }, { x: s.vol, y: s.er, r: 8, color: 'var(--s2)', lab: 'You', name: 'Your portfolio', w }]);
    const mix = ww => ww ? FP.LAB.map((a, i) => ww[i] > 0.005 ? `${a.short} ${num(ww[i] * 100, 0)}%` : '').filter(Boolean).join(', ') : '';
    const ch = C.scatter({ pts, cloud, paths: [{ pts: fr.pts.map(p => [p.vol, p.er]), color: 'var(--s3)', width: 2.2 }], h: 330, x0: 0, x1: 26, xLab: 'Volatility (% a year)', yLab: 'Expected return (% a year)', xFmt: v => num(v, 0), yFmt: v => num(v, 1), tip: p => `<b>${esc(p.name)}</b>${K.tipRow(null, 'Expected return', esc(num(p.y, 2) + '%'))}${K.tipRow(null, 'Volatility', esc(num(p.x, 1) + '%'))}${p.w ? `<div class="mix">${esc(mix(p.w))}</div>` : ''}`, legendItems: [{ name: 'Efficient frontier', color: 'var(--s3)' }, { name: 'Your portfolio', color: 'var(--s2)' }, { name: 'Risk parity', color: 'var(--s7)' }, { name: 'Presets', color: 'var(--s4)' }, { name: 'Random portfolios (darker = better Sharpe)', color: C.seq(0.8) }] });
    return ch + U.src(`Bitcoin (volatility ${num(rm.vol[10] * 100, 0)}%) sits off the chart. The frontier is the best return for each level of risk under these assumptions; small changes to assumptions can swing it a lot, which is why most investors hold something simpler near it.`);
  }
  function riskBars(s, w) {
    const items = FP.LAB.map((a, i) => ({ a, w: w[i], rc: s.rc[i] })).filter(d => d.w > 0.001).sort((x, y) => y.rc - x.rc);
    return `<div class="rbars">${items.map(d => `<div class="rb" data-tip="${esc(`<b>${d.a.name}</b>${K.tipRow(null, 'Share of money', pct(d.w * 100, 1))}${K.tipRow(null, 'Share of risk', pct(d.rc * 100, 1))}`)}"><span class="nm">${esc(d.a.short)}</span><span class="trk"><b class="w" style="width:${(d.w * 100).toFixed(1)}%"></b><b class="r" style="width:${Math.max(0, d.rc * 100).toFixed(1)}%"></b></span><span class="v">${num(d.w * 100, 0)}% / ${num(d.rc * 100, 0)}%</span></div>`).join('')}</div><div class="legend"><span><i class="sq" style="background:var(--line-2)"></i>Money</span><span><i class="sq" style="background:var(--s2)"></i>Risk</span></div>` + U.src('Risk share is each holding\'s contribution to portfolio variance. A 60/40 mix usually gets about 90% of its risk from stocks.');
  }
  function mcPanel(s) {
    const m = L.mc, be = F.lastVal('T10YIE');
    const sim = FP.simulate({ er: s.er, vol: s.vol, start: +m.start || 0, monthly: +m.monthly || 0, years: +m.years || 1, goal: +m.goal || 0, real: !!m.real, infl: be, sims: 1500, seed: 7 });
    const b = sim.bands, x = r => r.y;
    const ch = C.line({ series: [{ name: 'Median path', pts: b.map(r => [x(r), r.p50]), color: 'var(--s1)', width: 2.4 }, { name: 'Money put in', pts: b.map(r => [x(r), (+m.start || 0) + (+m.monthly || 0) * 12 * r.y]), color: 'var(--ink-2)', width: 1.3, dash: '4 3' }], bands: [{ lo: b.map(r => [x(r), r.p10]), hi: b.map(r => [x(r), r.p90]), name: '10th-90th percentile', color: 'var(--s1)', op: 0.13 }, { lo: b.map(r => [x(r), r.p25]), hi: b.map(r => [x(r), r.p75]), name: '25th-75th percentile', color: 'var(--s1)', op: 0.2 }], hlines: m.goal ? [{ y: +m.goal, label: 'Goal ' + K.money(+m.goal), color: 'var(--s3)' }] : [], h: 300, y0: 0, xTicks: b.filter(r => r.y % Math.max(1, Math.round(m.years / 6)) === 0).map(r => r.y), xFmt: v => 'Yr ' + Math.round(v), yFmt: v => '$' + K.big(v, 1), tipFmt: v => K.money(v, 0), tipX: v => 'Year ' + Math.round(v), aria: 'Monte Carlo projection' });
    const inp = (k, lab, step, extra = '') => `<label class="fld"><span>${lab}</span><input type="number" inputmode="decimal" step="${step}" value="${m[k]}" data-mc="${k}" ${extra}></label>`;
    return U.card('Project your plan', `1,500 simulated futures using this mix's expected return (${sgn(s.er, 1, '%')}) and volatility (${num(s.vol, 1)}%), with fat tails: about 1 month in 10 swings twice as hard as usual. ${m.real ? `Shown in today's dollars (inflation ${num(be, 1)}%, the 10-year breakeven); contributions rise with inflation.` : 'Shown in future (nominal) dollars.'}`,
      `<div class="mcin">${inp('start', 'Starting amount ($)', 1000, 'min="0"')}${inp('monthly', 'Monthly contribution ($, negative to withdraw)', 50)}${inp('years', 'Years', 1, 'min="1" max="60"')}${inp('goal', 'Goal ($)', 10000, 'min="0"')}<label class="tog"><input type="checkbox" data-mc="real" ${m.real ? 'checked' : ''}> In today's dollars</label></div>
      <div class="tiles t5 mini" style="margin-top:10px">${[U.tile({ lab: 'Median outcome', val: K.money(sim.median, 0), sub: `after ${m.years} years` }), U.tile({ lab: 'Range (10th-90th)', val: '$' + K.big(sim.p10, 1) + '–' + K.big(sim.p90, 1) }), U.tile({ lab: 'Chance of reaching goal', val: sim.pGoal != null ? pct(sim.pGoal * 100, 0) : '–' }), U.tile({ lab: 'Chance of running out', val: pct(sim.pBroke * 100, 0), sub: (+m.monthly < 0) ? 'with these withdrawals' : 'no withdrawals' }), U.tile({ lab: 'Typical worst drop on the way', val: pct(sim.mddMed, 0), sub: `1 in 10 paths: ${pct(sim.mddBad, 0)}` })].join('')}</div>${ch}`);
  }
  function stressPanel(w) {
    const rows = FP.stress(w);
    const sc = Math.max(10, ...rows.map(r => Math.abs(r.sp)), ...rows.map(r => Math.abs(r.port || 0)));
    const bar = (v, col) => ok(v) ? `<span class="sbar"><b style="width:${Math.abs(v) / sc * 100}%;background:${col}"></b></span>` : '<span class="sbar"></span>';
    return U.card('Stress test: past sell-offs', 'How this mix would have done from the S&P 500 peak to its trough in each episode, held without rebalancing. Before a fund existed, a rebuilt proxy stands in where one is available.',
      `<div class="stress">${rows.map(r => `<div class="st"><div class="nm"><b>${esc(r.name)}</b><small>${esc(K.isoLab(r.d0))} to ${esc(K.isoLab(r.d1))}${r.proxy.length ? ' · proxy for ' + esc(r.proxy.join(', ')) : ''}</small></div><div class="bars2"><div><span class="lb">You</span>${bar(r.port, 'var(--s2)')}<span class="v">${r.port == null ? `<span class="muted" title="${esc('No data for ' + r.miss.join(', '))}">n/a</span>` : esc(FV.P(r.port, 1))}</span></div><div><span class="lb">S&amp;P 500</span>${bar(r.sp, 'var(--line-2)')}<span class="v">${esc(FV.P(r.sp, 1))}</span></div></div></div>`).join('')}</div>`);
  }
  function shockPanel(w) {
    const r = FP.shock(w, L.sh);
    const sl = FP.FACTORS.map(f => `<div class="ctrl"><label for="sh-${f.k}"><span>${esc(f.name)}</span><output id="so-${f.k}">${sgn(+L.sh[f.k] || 0, f.unit === 'pp' ? 2 : 0, f.unit === 'pp' ? ' pp' : '%')}</output></label><input id="sh-${f.k}" type="range" min="${f.lo}" max="${f.hi}" step="${f.step}" value="${L.sh[f.k] || 0}" data-shock="${f.k}"></div>`).join('');
    const items = r.per.map((p, i) => ({ name: FP.LAB[i].short + (w[i] > 0 ? ` (${num(w[i] * 100, 0)}%)` : ''), v: p.r, color: p.r >= 0 ? 'var(--s1)' : 'var(--s2)', tip: `<b>${esc(FP.LAB[i].name)}</b>${K.tipRow(null, 'Estimated move', esc(FV.P(p.r, 1)))}${K.tipRow(null, 'Fit of the factor model (R²)', esc(ok(p.r2) ? num(p.r2, 2) : '–'))}` }));
    return U.card('Shock scenarios', `Pick a scenario or set the shocks yourself. Each asset's sensitivity comes from a regression of its weekly returns on the six factors over the last five years.`,
      `<div class="presets">${FP.SCEN.map(([n]) => `<button type="button" class="chip" data-scen="${esc(n)}" aria-pressed="${L.scen === n}">${esc(n)}</button>`).join('')}</div><div class="grid g-5-7" style="margin-top:10px"><div class="ctrls one">${sl}</div><div><div class="tiles t2 mini">${U.tile({ lab: 'Your portfolio', val: esc(FV.P(r.port, 1)), sub: 'estimated immediate move' })}${U.tile({ lab: 'Biggest driver', val: esc(r.parts.slice().sort((a, b) => Math.abs(b.c) - Math.abs(a.c))[0].name), sub: esc(FV.P(r.parts.slice().sort((a, b) => Math.abs(b.c) - Math.abs(a.c))[0].c, 1)) + ' of the move' })}</div>${C.hbars(items, { fmt: v => FV.P(v, 1) })}</div></div>` + U.src('Linear sensitivities are a first approximation; large shocks are rarely linear, and correlations shift in a crisis.'));
  }
  function backtestPanel(w) {
    const bt = FP.backtest(w);
    const ch = C.line({ series: [{ name: 'Your mix', pts: bt.curve.p, color: 'var(--s2)', width: 2.2 }, { name: 'US stocks (SPY)', pts: bt.curve.spy, color: 'var(--s1)', width: 1.4 }, { name: '60/40 (SPY/AGG)', pts: bt.curve.b6040, color: 'var(--s3)', width: 1.4, dash: '4 3' }], h: 260, logY: true, yFmt: v => '$' + K.big(v, 0), tipFmt: v => K.money(v, 0), tipX: x => K.MON[Math.floor((x % 1) * 12)] + ' ' + Math.floor(x), aria: 'Backtest growth of $10,000' });
    const r = (lab, o) => `<tr><td class="name">${lab}</td><td>${pct(o.cagr, 1)}</td><td>${pct(o.vol, 1)}</td><td>${pct(o.mdd, 0)}</td><td>${pct(o.worst12, 0)}</td><td>${K.money(o.end * 10000, 0)}</td></tr>`;
    return U.card(`Backtest, ${bt.from} to ${bt.to}`, 'Growth of $10,000 with monthly rebalancing, using the funds\' real total returns. The start date is when the youngest fund you hold began trading. Past results are not forecasts.',
      ch + `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Portfolio</th><th>Return a year</th><th>Volatility</th><th>Worst drawdown</th><th>Worst 12 months</th><th>$10,000 became</th></tr></thead><tbody>${r('Your mix', bt.p)}${r('US stocks (SPY)', bt.spy)}${r('60/40 (SPY/AGG)', bt.b6040)}</tbody></table></div>`);
  }
  function results() {
    const w = frac(), e = ers(), s = FP.stats(w, e);
    return { s, w, e, html: { stats: statTiles(s), front: frontierChart(s, w, e), risk: riskBars(s, w), mc: mcPanel(s), stress: stressPanel(w), shock: shockPanel(w), bt: backtestPanel(w) } };
  }
  function view(st) {
    lab(st);
    if (total() <= 0) L.w = Object.assign({}, DEF.w);
    const R = results();
    return `${U.sec('What-if lab', 'Build a portfolio from 11 asset classes and see its expected return, risk, worst cases and odds of reaching a goal. Educational, not investment advice.')}
      <div class="grid lab">
        <section class="card labmix"><div class="head"><div><h3>Your mix</h3><div class="note">Drag the sliders or start from a preset.</div></div></div>${sliders()}</section>
        <div class="labout">
          <div class="tiles t5 mini" id="labStats">${R.html.stats}</div>
          <div style="margin-top:12px" id="labFront">${U.card('Risk and return map', 'Your portfolio against the efficient frontier, 1,600 random portfolios and common presets.', R.html.front)}</div>
          <div style="margin-top:12px" id="labRisk">${U.card('Where the risk comes from', 'Money in each holding versus its share of total risk.', R.html.risk)}</div>
        </div>
      </div>
      <div style="margin-top:14px" id="labMC">${R.html.mc}</div>
      <div class="grid g2" style="margin-top:14px"><div id="labStress">${R.html.stress}</div><div id="labShock">${R.html.shock}</div></div>
      <div style="margin-top:14px" id="labBT">${R.html.bt}</div>`;
  }
  function paint(parts) {
    const R = results(), $ = id => document.getElementById(id);
    const set = (id, html) => { const el = $(id); if (el) { el.innerHTML = html; C.mount(el); } };
    if (parts.includes('stats')) set('labStats', R.html.stats);
    if (parts.includes('front')) set('labFront', U.card('Risk and return map', 'Your portfolio against the efficient frontier, 1,600 random portfolios and common presets.', R.html.front));
    if (parts.includes('risk')) set('labRisk', U.card('Where the risk comes from', 'Money in each holding versus its share of total risk.', R.html.risk));
    if (parts.includes('mc')) set('labMC', R.html.mc);
    if (parts.includes('stress')) set('labStress', R.html.stress);
    if (parts.includes('shock')) set('labShock', R.html.shock);
    if (parts.includes('bt')) set('labBT', R.html.bt);
    C.gc();
  }
  const slow = K.debounce(() => paint(['front', 'mc', 'stress', 'shock', 'bt']), 220);
  const mcSlow = K.debounce(() => paint(['mc']), 250);
  function onInput(el, st) {
    lab(st);
    if (el.matches('[data-lw]')) {
      L.w[el.dataset.lw] = +el.value; const o = document.getElementById('lo-' + el.dataset.lw); if (o) o.textContent = el.value + '%';
      const t = document.getElementById('wtot'); if (t) t.innerHTML = totLine(total());
      paint(['stats', 'risk']); slow(); st.save(); return true;
    }
    if (el.matches('[data-mc]')) { const k = el.dataset.mc; L.mc[k] = k === 'real' ? el.checked : el.value; mcSlow(); st.save(); return true; }
    if (el.matches('[data-shock]')) { const k = el.dataset.shock; L.sh[k] = +el.value; L.scen = ''; const f = FP.FACTORS.find(x => x.k === k), o = document.getElementById('so-' + k); if (o) o.textContent = sgn(+el.value, f.unit === 'pp' ? 2 : 0, f.unit === 'pp' ? ' pp' : '%'); shockSlow(); st.save(); return true; }
    if (el.matches('[data-er]')) { const v = parseFloat(el.value); if (isFinite(v)) { L.er[el.dataset.er] = v; paint(['stats', 'risk']); slow(); st.save(); } return true; }
    return false;
  }
  const shockSlow = K.debounce(() => paint(['shock']), 120);
  function onClick(ev, st, rerender) {
    lab(st); const t = ev.target;
    const pr = t.closest('[data-preset]'); if (pr) { const p = FP.PRESETS.find(x => x[0] === pr.dataset.preset); L.w = Object.assign({}, p[1]); st.save(); rerender(); return true; }
    if (t.closest('[data-labscale]')) { const tt = total(); if (tt > 0) for (const k in L.w) L.w[k] = Math.round(L.w[k] / tt * 1000) / 10; st.save(); rerender(); return true; }
    if (t.closest('[data-labclear]')) { L.w = {}; st.save(); rerender(); return true; }
    const md = t.closest('[data-labmode]'); if (md) { L.mode = md.dataset.labmode; st.save(); rerender(); return true; }
    if (t.closest('[data-erreset]')) { L.er = {}; st.save(); rerender(); return true; }
    const sc = t.closest('[data-scen]'); if (sc) { const s = FP.SCEN.find(x => x[0] === sc.dataset.scen); L.sh = Object.assign({}, s[1]); L.scen = s[0]; st.save(); paint(['shock']); return true; }
    const sm = t.closest('summary'); if (sm && sm.closest('.assume')) { L.open = !sm.parentElement.open; st.save(); return false; }
    return false;
  }
  function load(st, w) { lab(st); L.w = Object.assign({}, w); st.save(); }
  return { view, onInput, onClick, load, DEF, frac: st => { lab(st || STATE); return frac(); }, ers: st => { lab(st || STATE); return ers(); }, lab };
})();
