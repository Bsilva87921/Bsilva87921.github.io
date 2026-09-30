/* Probable Atlas · Economics: "What-if lab" tab (US macro scenario, growth levers, debt dynamics). */
const VW = (() => {
  const { esc, ok, num, pct, sgn } = K;
  const W = { us: null, usBase: null, lev: null, debt: null };
  const slider = (grp, k, lab, v, min, max, step, fmt, hint) => `<div class="ctrl"><label for="wi-${grp}-${k}">${esc(lab)} <output id="wo-${grp}-${k}">${fmt(v)}</output></label><input id="wi-${grp}-${k}" type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-wi="${grp}" data-k="${k}">${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  const lastRaw = id => { const r = E.raw(id); return r && r.length ? r[r.length - 1][1] : null; };

  /* ================= US macro scenario ================= */
  function usToday() {
    const inf = M.inflation(), un = E.mSeries('UNRATE');
    const core = E.mYoY(E.mSeries('CPILFESL'));
    return { ff: lastRaw('DFF'), y3m: lastRaw('DGS3MO'), y10: lastRaw('DGS10'), nfci: lastRaw('NFCI'), core: E.mAt(core, E.mLast(core)), corePCE: M.latestCorePCE(), gap: M.outputGap().v, rstar: 1.0, unemp: E.mAt(un, E.mLast(un)), mich: inf.xNow[2], oil: inf.oil };
  }
  const PRESETS = {
    today: ['Today', () => ({})],
    soft: ['Soft landing', b => ({ ff: b.ff - 1, y10: b.y10 - 0.3, nfci: b.nfci - 0.1, unemp: b.unemp + 0.1, oil: b.oil * 0.9, mich: b.mich - 0.3, corePCE: b.corePCE - 0.4 })],
    oil: ['Oil shock', b => ({ oil: b.oil * 1.6, mich: b.mich + 0.8, nfci: b.nfci + 0.2, corePCE: b.corePCE + 0.3 })],
    credit: ['Credit crunch', b => ({ nfci: b.nfci + 1.0, y10: b.y10 - 0.5, unemp: b.unemp + 1.0, gap: b.gap - 1.5 })],
    invert: ['Curve re-inverts', b => ({ ff: b.ff + 1.5, y10: b.y10 - 0.4 })],
    cuts: ['Aggressive cuts', b => ({ ff: Math.max(0.1, b.ff - 2), y10: b.y10 + 0.2, mich: b.mich + 0.4 })]
  };
  function usControls(sc) {
    const f2 = v => num(v, 2) + '%', f1 = v => num(v, 1) + '%';
    return `<div class="presets" role="group" aria-label="Scenario presets">${Object.entries(PRESETS).map(([k, [lab]]) => `<button type="button" class="chip" data-preset="${k}" aria-pressed="${W.usPreset === k}">${esc(lab)}</button>`).join('')}</div>
      <div class="ctrls" style="margin-top:12px">
        ${slider('us', 'ff', 'Fed funds rate', sc.ff, 0, 9, 0.05, f2, 'The 3-month yield moves with it')}
        ${slider('us', 'y10', '10-year Treasury yield', sc.y10, 0, 9, 0.05, f2)}
        ${slider('us', 'nfci', 'Financial conditions (NFCI)', sc.nfci, -1.2, 3, 0.05, v => num(v, 2), 'Below 0 = looser than average')}
        ${slider('us', 'unemp', 'Unemployment rate', sc.unemp, 3, 11, 0.1, f1)}
        ${slider('us', 'mich', 'Expected inflation (households)', sc.mich, 1, 8, 0.1, f1)}
        ${slider('us', 'oil', 'Oil price (WTI, $/barrel)', sc.oil, 30, 200, 1, v => '$' + num(v, 0))}
        ${slider('us', 'corePCE', 'Core PCE inflation (for the Taylor rule)', sc.corePCE, 0, 8, 0.1, f1)}
        ${slider('us', 'rstar', 'Neutral real rate (r*)', sc.rstar, -1, 3, 0.1, f1)}
      </div>`;
  }
  function usOutputs() {
    const sc = W.us, b = W.usBase;
    const s = Object.assign({}, sc, { y3m: sc.y3m }), r = M.usScenario(s), r0 = M.usScenario(Object.assign({}, b));
    const inf = M.inflation(), hist = E.mPts(E.mYoY(E.mSeries('CPIAUCSL')), inf.tLast - 36);
    const chart = C.line({ series: [{ name: 'CPI inflation', pts: hist, color: 'var(--ink-2)', width: 2 }, { name: 'Baseline forecast', pts: r0.path.map(p => [p[0] / 12, p[1]]), color: 'var(--s1)', width: 2, dash: '5 4' }, { name: 'Scenario forecast', pts: r.path.map(p => [p[0] / 12, p[1]]), color: 'var(--s2)', width: 2.4 }], h: 250, hlines: [{ y: 2, label: '2% goal', color: 'var(--s3)' }], yFmt: v => num(v, 1) + '%', tipX: x => K.mLab(Math.round(x * 12)), aria: 'Scenario inflation path' });
    const d = (a, c, dd = 1, u = ' pp') => ok(a) && ok(c) ? V.upDown(a - c, dd, u) : '';
    const p12 = r.path[12] ? r.path[12][1] : null, p12b = r0.path[12] ? r0.path[12][1] : null;
    const tyGap = r.taylor ? sc.ff - r.taylor.classic : null;
    return `<div class="out">
        <div class="tile"><span class="lab">Recession odds (yield curve)</span><div class="gauge">${C.gauge(r.pC || 0)}</div><span class="sub">${d(r.pC * 100, r0.pC * 100, 0)} vs baseline ${pct(r0.pC * 100, 0)}</span></div>
        <div class="tile"><span class="lab">Recession odds (curve + conditions)</span><div class="gauge">${C.gauge(r.pE || 0)}</div><span class="sub">${d(r.pE * 100, r0.pE * 100, 0)} vs baseline ${pct(r0.pE * 100, 0)}</span></div>
        ${V.tile({ lab: '12-month CPI forecast', val: pct(p12, 1), sub: `${d(p12, p12b, 2)} vs baseline ${pct(p12b, 1)}` })}
        ${V.tile({ lab: 'Taylor rule rate', val: pct(r.taylor && r.taylor.classic, 2), sub: ok(tyGap) ? `Your fed funds rate is ${num(Math.abs(tyGap), 2)} pp ${tyGap < 0 ? 'below (looser than)' : 'above (tighter than)'} the rule` : '' })}
        ${V.tile({ lab: 'Yield curve (10y − 3m)', val: sgn(r.spread, 2), unit: 'pp', sub: r.spread < 0 ? 'Inverted' : 'Positive' })}
        ${V.tile({ lab: 'Real fed funds rate', val: sgn(r.rff, 2), unit: '%', sub: 'Fed funds minus core CPI inflation' })}
      </div>${V.card('Inflation path: baseline vs your scenario', 'Same regression models as the forecast tab, re-run with your inputs. Oil, expectations and slack feed through; the fed funds rate works through the recession models, not this equation.', chart)}`;
  }
  function usLab() {
    if (!W.us) { W.usBase = usToday(); W.us = Object.assign({}, W.usBase); W.usPreset = 'today'; }
    return V.sec('US macro scenario', 'Move the inputs or pick a preset; both recession models, the inflation forecast and the Taylor rule re-run instantly on the same fitted coefficients.') +
      `<div class="grid g-7-5"><section class="card" id="wiUsCtl">${usControls(W.us)}</section><section class="card"><h3>Scenario vs today</h3><div class="kv" style="margin-top:8px">${[['Fed funds', 'ff', 2, '%'], ['10-year', 'y10', 2, '%'], ['NFCI', 'nfci', 2, ''], ['Unemployment', 'unemp', 1, '%'], ['Expected inflation', 'mich', 1, '%'], ['Oil', 'oil', 0, '$']].map(([l, k, dd, u]) => `<dt>${l}</dt><dd id="wiCmp-${k}">${u === '$' ? '$' + num(W.us[k], 0) : num(W.us[k], dd) + u} <span class="muted">(today ${u === '$' ? '$' + num(W.usBase[k], 0) : num(W.usBase[k], dd) + u})</span></dd>`).join('')}</div><div class="src">Today's values are the latest daily or monthly readings. The 3-month yield keeps today's gap to the fed funds rate.</div></section></div><div id="wiUsOut" style="margin-top:14px">${usOutputs()}</div>`;
  }

  /* ================= growth levers ================= */
  function levState(iso) {
    const lv = M.levers(), tg = M.leverTargets(iso); if (!lv || !tg) return null;
    const cur = lv.latest(iso);
    return { iso, cur, vals: cur.slice(), tg };
  }
  // slider units per lever (display) <-> model units
  const LV_UI = {
    inv: { lab: "Investment", min: 5, max: 50, step: 0.5, toM: v => v, fromM: v => v, fmt: v => num(v, 1) + '% of GDP' },
    trade: { lab: "Trade (size-adjusted)", min: 5, max: 250, step: 1, toM: (v, iso) => { const z = M.tradeSize(), p = E.wbLatest('SP.POP.TOTL', iso).v; return Math.log(v) - z.b * (Math.log(p) - z.m); }, fromM: (m, iso) => { const z = M.tradeSize(), p = E.wbLatest('SP.POP.TOTL', iso).v; return Math.exp(m + z.b * (Math.log(p) - z.m)); }, fmt: v => num(v, 0) + '% of GDP' },
    infl: { lab: "Inflation", min: 0, max: 60, step: 0.5, toM: v => 100 * Math.log(1 + v / 100), fromM: m => (Math.exp(m / 100) - 1) * 100, fmt: v => num(v, 1) + '% a year' },
    ge: { lab: "Government effectiveness", min: -2.5, max: 2.5, step: 0.05, toM: v => v, fromM: v => v, fmt: v => num(v, 2) },
    flfp: { lab: "Women's participation", min: 5, max: 85, step: 0.5, toM: v => v, fromM: v => v, fmt: v => num(v, 1) + '%' },
    debt: { lab: "Government debt", min: 0, max: 260, step: 1, toM: v => v, fromM: v => v, fmt: v => num(v, 0) + '% of GDP' }
  };
  function levControls() {
    const s = W.lev, lv = M.levers();
    return `<div class="presets"><button type="button" class="chip" data-levpreset="gap">Close gaps to peers (significant levers)</button><button type="button" class="chip" data-levpreset="reset">Reset to today</button></div><div class="ctrls" style="margin-top:12px">${lv.coef.map((L, j) => {
      if (!L.lever || !ok(s.cur[j])) return '';
      const ui = LV_UI[L.k], v = ui.fromM(s.vals[j], s.iso), cur = ui.fromM(s.cur[j], s.iso), t = s.tg[j], tv = t && ok(t.tgt) ? ui.fromM(t.tgt, s.iso) : null;
      const sig = L.p < 0.10 && Math.sign(L.b) === L.dir;
      return slider('lev', L.k, ui.lab, +v.toFixed(2), Math.min(ui.min, Math.floor(cur)), Math.max(ui.max, Math.ceil(cur)), ui.step, ui.fmt, `Today ${ui.fmt(cur)} · ${t && t.ahead ? 'already in the best quartile of peers' : 'peer target ' + (tv != null ? ui.fmt(tv) : '–')} · ${sig ? `significant (p ${L.p < 0.001 ? '<0.001' : num(L.p, 3)})` : `not significant (p ${num(L.p, 2)}), so treat as zero`}`);
    }).join('')}</div>`;
  }
  function levOutputs() {
    const s = W.lev, lv = M.levers(), k = lv.fit.k;
    const dx = new Array(k).fill(0);
    lv.coef.forEach((L, j) => { if (L.lever && ok(s.cur[j]) && ok(s.vals[j])) dx[j + 1] = s.vals[j] - s.cur[j]; });
    const dg = dx.reduce((a, v, i) => a + v * lv.fit.b[i], 0);
    let vv = 0; for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) vv += dx[a] * lv.fit.cov[a][b] * dx[b];
    const se = Math.sqrt(Math.max(vv, 0)), lo = dg - 1.645 * se, hi = dg + 1.645 * se;
    const items = lv.coef.map((L, j) => L.lever && ok(s.cur[j]) ? { name: LV_UI[L.k].lab, v: lv.fit.b[j + 1] * dx[j + 1], color: lv.fit.b[j + 1] * dx[j + 1] >= 0 ? 'var(--s1)' : 'var(--s2)' } : null).filter(Boolean);
    const inc10 = (Math.pow(1 + dg / 100, 10) - 1) * 100;
    return `<div class="grid"><div class="out two">${V.tile({ hero: true, lab: 'Change in growth per person, per year', val: sgn(dg, 2), unit: 'pp', sub: `90% interval ${sgn(lo, 2)} to ${sgn(hi, 2)} pp` })}${V.tile({ lab: 'Income per person after 10 years', val: sgn(inc10, 1), unit: '%', sub: 'Versus the current path' })}${V.tile({ lab: 'Evidence base', val: String(lv.n), unit: 'obs.', sub: `${lv.countries} economies × 3 decades · R² ${num(lv.fit.r2, 2)}` })}</div>${V.card('Contribution by lever', 'Percentage points of yearly growth per person over a decade.', C.hbars(items, { fmt: v => sgn(v, 2) + ' pp' }))}</div>`;
  }
  function levLab(iso) {
    if (!W.lev || W.lev.iso !== iso) W.lev = levState(iso);
    if (!W.lev) return V.card('Growth levers', '', '<div class="empty">Not enough data for this economy.</div>');
    return V.sec(`Growth levers: ${E.name(iso)}`, 'Cross-country evidence from three decades: how average growth per person has differed with investment, openness, institutions, inflation, participation and debt, holding starting income and population growth fixed. Associations, not proof of cause.') +
      `<div class="grid g-7-5"><section class="card" id="wiLevCtl">${levControls()}</section><div id="wiLevOut">${levOutputs()}</div></div>`;
  }

  /* ================= debt dynamics ================= */
  function debtOutputs(part) {
    const s = W.debt, base = M.debtBase(s.iso); if (!base) return '<div class="empty">No IMF debt data for this economy.</div>';
    const b0 = M.debtSim(base, {}), sim = M.debtSim(base, s.sc);
    const chart = C.line({ series: [{ name: 'IMF path', pts: base.yrs.map(y => [y, E.imf('GGXWDG_NGDP', s.iso, y)]).filter(p => ok(p[1])), color: 'var(--ink-2)', width: 1.6, dots: true }, { name: 'Baseline', pts: base.yrs.map((y, k) => [y, b0.central[k]]), color: 'var(--s1)', width: 1.8, dash: '5 4' }, { name: 'Your scenario', pts: base.yrs.map((y, k) => [y, sim.central[k]]), color: 'var(--s2)', width: 2.4 }], bands: [{ lo: base.yrs.map((y, k) => [y, sim.p10[k]]), hi: base.yrs.map((y, k) => [y, sim.p90[k]]), name: 'Scenario, 80% of simulations', color: 'var(--s2)', op: 0.14 }], h: 260, yFmt: v => num(v, 0) + '%', tipX: x => String(Math.round(x)), aria: 'Debt scenario' });
    const end = sim.central[sim.central.length - 1], y1 = base.yrs[base.yrs.length - 1];
    if (part === 'chart') return V.card('Debt path', 'Debt next year = debt × (1 + interest) ÷ (1 + nominal growth) − primary balance (+ IMF stock-flow adjustments).', chart);
    return `<div class="out two">${V.tile({ hero: true, lab: `Debt in ${y1} (% of GDP)`, val: pct(end, 0), sub: `${V.upDown(end - b0.central[b0.central.length - 1], 0, ' pp')} vs baseline ${pct(b0.central[b0.central.length - 1], 0)}` })}${V.tile({ lab: 'Chance debt is 10+ pp higher', val: pct(sim.pUp * 100, 0), sub: `Baseline ${pct(b0.pUp * 100, 0)}` })}${V.tile({ lab: 'Primary balance to stabilize', val: sgn(sim.stabPB, 1), unit: '% GDP', sub: `Scenario plan ${sgn(sim.pbEnd, 1)}%` })}${V.tile({ lab: 'Interest minus growth (r − g)', val: sgn(sim.rg, 1), unit: 'pp', sub: `Effective rate ${pct(sim.i, 1)}` })}${V.tile({ lab: 'Chance debt tops 100% of GDP', val: pct(sim.p100 * 100, 0), sub: base.d0 >= 100 ? 'Already above 100%: chance it ends higher' : `Baseline ${pct(b0.p100 * 100, 0)}` })}</div>`;
  }
  function debtLab(iso) {
    if (!W.debt || W.debt.iso !== iso) W.debt = { iso, sc: { di: 0, dg: 0, dpb: 0, dpi: 0 } };
    const base = M.debtBase(iso); if (!base) return '';
    const f = v => sgn(v, 1) + ' pp';
    return V.sec(`Public debt simulator: ${E.name(iso)}`, `Start from the IMF path (${pct(base.d0, 0)} of GDP in ${E.CY}) and apply shocks; 1,500 simulations add random growth and inflation surprises of the size this economy has seen.`) +
      `<div class="grid g-7-5"><section class="card" id="wiDebtCtl"><div class="ctrls">${slider('debt', 'di', 'Interest rate on debt', 0, -3, 5, 0.1, f, `Effective rate today about ${pct(base.i0, 1)}`)}${slider('debt', 'dg', 'Real growth, every year', 0, -3, 3, 0.1, f)}${slider('debt', 'dpi', 'Inflation, every year', 0, -3, 8, 0.1, f, 'Surprise inflation erodes debt')}${slider('debt', 'dpb', 'Primary balance (tax minus non-interest spending)', 0, -4, 6, 0.1, v => sgn(v, 1) + '% GDP', 'Positive = fiscal tightening')}</div><div class="src">Shocks apply from ${E.CY + 1}. The model does not feed tighter budgets back into growth; see Recommendations for that trade-off.</div></section><div id="wiDebtOut">${debtOutputs()}</div></div><div id="wiDebtChart" style="margin-top:14px">${debtOutputs('chart')}</div>`;
  }

  function view(st) {
    const iso = st.scope === 'WLD' ? st.wiIso : st.scope;
    const pick = st.scope === 'WLD' ? `<div class="card" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>Economy for the growth and debt simulators:</b>${V.countrySel('wiiso', iso, 'Economy to simulate')}<span class="muted" style="font-size:13px">Pick United States in the scope bar for the US macro scenario.</span></div>` : '';
    return (st.scope === 'USA' ? usLab() : '') + (pick ? V.sec('What-if lab', 'Change the inputs and re-run the models. Pick any economy.') + pick : '') + levLab(iso) + debtLab(iso);
  }

  /* events */
  function onInput(el) {
    const grp = el.dataset.wi, k = el.dataset.k, v = +el.value;
    if (grp === 'us') {
      if (k === 'ff') W.us.y3m = W.usBase.y3m + (v - W.usBase.ff);
      W.us[k] = v; W.usPreset = null;
      const o = document.getElementById('wo-us-' + k); if (o) o.textContent = { ff: num(v, 2) + '%', y10: num(v, 2) + '%', nfci: num(v, 2), unemp: num(v, 1) + '%', mich: num(v, 1) + '%', oil: '$' + num(v, 0), corePCE: num(v, 1) + '%', rstar: num(v, 1) + '%' }[k];
      K.$$('[data-preset]').forEach(b => b.setAttribute('aria-pressed', 'false'));
      const cmp = document.getElementById('wiCmp-' + k); if (cmp) cmp.firstChild.textContent = (k === 'oil' ? '$' + num(v, 0) : num(v, k === 'ff' || k === 'y10' || k === 'nfci' ? 2 : 1) + (k === 'nfci' ? '' : '%')) + ' ';
      paint('wiUsOut', usOutputs());
    } else if (grp === 'lev') {
      const lv = M.levers(), j = lv.coef.findIndex(L => L.k === k), ui = LV_UI[k];
      W.lev.vals[j] = ui.toM(v, W.lev.iso);
      const o = document.getElementById('wo-lev-' + k); if (o) o.textContent = ui.fmt(v);
      paint('wiLevOut', levOutputs());
    } else if (grp === 'debt') {
      W.debt.sc[k] = v;
      const o = document.getElementById('wo-debt-' + k); if (o) o.textContent = k === 'dpb' ? sgn(v, 1) + '% GDP' : sgn(v, 1) + ' pp';
      paint('wiDebtOut', debtOutputs()); paint2('wiDebtChart', debtOutputs('chart'));
    }
  }
  const put = (id, html) => { const el = document.getElementById(id); if (!el) return; el.innerHTML = html; C.mount(el); C.gc(); };
  const paint = K.debounce(put, 40), paint2 = K.debounce(put, 40);
  function onClick(ev) {
    const p = ev.target.closest('[data-preset]');
    if (p) { const k = p.dataset.preset; W.us = Object.assign({}, W.usBase, PRESETS[k][1](W.usBase)); W.us.y3m = W.usBase.y3m + (W.us.ff - W.usBase.ff); W.usPreset = k; const c = document.getElementById('wiUsCtl'); c.innerHTML = usControls(W.us); K.$$('[id^="wiCmp-"]').forEach(el => { const kk = el.id.slice(6); el.firstChild.textContent = (kk === 'oil' ? '$' + num(W.us[kk], 0) : num(W.us[kk], kk === 'ff' || kk === 'y10' || kk === 'nfci' ? 2 : 1) + (kk === 'nfci' ? '' : '%')) + ' '; }); const o = document.getElementById('wiUsOut'); o.innerHTML = usOutputs(); C.mount(o); return true; }
    const lp = ev.target.closest('[data-levpreset]');
    if (lp) { const s = W.lev; if (lp.dataset.levpreset === 'reset') s.vals = s.cur.slice(); else { const lv = M.levers(); lv.coef.forEach((L, j) => { const t = s.tg[j]; if (!L.lever || !t || !ok(t.tgt) || !ok(s.cur[j])) return; const sig = L.p < 0.10 && Math.sign(L.b) === L.dir; if (sig && (L.dir > 0 ? t.tgt > s.cur[j] : t.tgt < s.cur[j])) s.vals[j] = t.tgt; }); } document.getElementById('wiLevCtl').innerHTML = levControls(); const o = document.getElementById('wiLevOut'); o.innerHTML = levOutputs(); C.mount(o); return true; }
    return false;
  }
  return { view, onInput, onClick, W };
})();
