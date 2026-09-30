/* Probable Atlas · Economics: recommendation engine + "Recommendations" tab. */
const VR = (() => {
  const { esc, ok, num, pct, sgn } = K;
  const LEVER_TXT = {
    inv: { title: 'Raise investment toward the peer median', how: 'Faster permitting, deeper long-term credit markets, and public infrastructure chosen by cost-benefit tests.', trade: 'Needs domestic savings or foreign capital. Quality matters more than volume: poorly chosen projects add debt without growth, and public borrowing can crowd out private investment.' },
    trade: { title: 'Lower trade barriers and deepen trade ties', how: 'Cut tariffs and non-tariff barriers, speed up customs and logistics, and widen trade agreements.', trade: 'Gains are uneven: import-competing workers and regions lose and need adjustment support. More openness also means more exposure to foreign shocks.' },
    ge: { title: 'Strengthen government effectiveness', how: 'Build civil-service capacity, digitize public services, make budgets transparent and simplify regulation.', trade: 'Slow to change and hard to measure (the index comes from surveys and expert ratings). Needs sustained political commitment rather than one-off reforms.' },
    infl: { title: 'Bring inflation down and keep it stable', how: 'An independent central bank with a clear target, backed by a sustainable budget.', trade: 'Disinflation usually costs output and jobs in the short run.' },
    flfp: { title: 'Raise women\'s participation in paid work', how: 'Childcare, parental leave, flexible work and removing legal barriers.', trade: 'Public cost of childcare and leave programs; effects build over years.' },
    debt: { title: 'Bring public debt down', how: 'A credible medium-term fiscal plan.', trade: 'Short-run growth drag from tightening.' }
  };
  const capConf = (p, cap = 'Medium') => { const lvl = p < 0.01 ? 'High' : p < 0.05 ? 'Medium' : 'Low'; const ord = { Low: 1, Medium: 2, High: 3 }; return ord[lvl] > ord[cap] ? cap : lvl; };

  function leverRecs(iso) {
    const lv = M.levers(), tg = M.leverTargets(iso); if (!lv || !tg) return [];
    const out = [];
    lv.coef.forEach((L, j) => {
      const t = tg[j]; if (!L.lever || !t || !ok(t.cur) || !ok(t.tgt)) return;
      const sig = L.p < 0.10 && Math.sign(L.b) === L.dir; if (!sig) return;
      const gap = t.tgt - t.cur; if (L.dir > 0 ? gap <= 0 : gap >= 0) return;
      const dg = L.b * gap, se = Math.abs(L.se * gap); if (dg < 0.05) return;
      const txt = LEVER_TXT[L.k];
      const show = v => L.show ? L.show(v, iso) : L.k === 'ge' ? num(v, 2) : num(v, 1) + (L.unit === 'pp' ? '%' : '');
      const perUnit = L.k === 'trade' ? 'a 10% rise in trade relative to GDP' : L.k === 'ge' ? 'a 0.1-point better score' : '1 point more';
      const perV = L.k === 'trade' ? L.b * Math.log(1.1) : L.k === 'ge' ? L.b * 0.1 : L.b;
      out.push({
        kind: 'lever', score: dg, title: txt.title,
        problem: `${esc(E.name(iso))} is at the ${K.ord(Math.round((L.dir > 0 ? t.pct : 1 - t.pct) * 100))} percentile of its ${t.n} ${esc(E.BYISO[iso].inc.toLowerCase())} peers on ${esc(L.noun)}: <b>${show(t.cur)}</b> vs a peer median of ${show(t.med)}.`,
        evidence: `Across ${lv.n} country-decades (${lv.countries} economies, 1996–${E.VYEAR - 1}), ${perUnit} went with <b>${sgn(perV, 2)} pp</b> faster yearly growth per person, holding starting income and population growth fixed (p ${L.p < 0.001 ? '< 0.001' : '= ' + num(L.p, 3)}, robust errors). This is an association across countries, not proof of cause.`,
        impact: `Moving to ${show(t.tgt)} (${t.pct < 0.5 === (L.dir > 0) ? 'the peer median' : 'the best quartile'}) is associated with <b>${sgn(dg, 2)} pp</b> growth per person a year (90% range ${sgn(dg - 1.645 * se, 2)} to ${sgn(dg + 1.645 * se, 2)}), about <b>${sgn((Math.pow(1 + dg / 100, 10) - 1) * 100, 1)}%</b> more income per person after a decade.`,
        tradeoffs: txt.trade, how: txt.how, confidence: capConf(L.p)
      });
    });
    return out;
  }
  function fiscalRec(iso) {
    const base = M.debtBase(iso); if (!base) return null;
    const b0 = M.debtSim(base, {}), d5 = E.imf('GGXWDG_NGDP', iso, E.CY + 5);
    const rising = ok(d5) && d5 - base.d0 > 3, gapPB = b0.stabPB - b0.pbEnd;
    if (!(base.d0 >= 60 && (rising || gapPB > 1))) return null;
    const adj = Math.max(0.5, Math.round(gapPB * 2) / 2);
    const sim = M.debtSim(base, { dpb: adj }), y1 = base.yrs[base.yrs.length - 1];
    const endB = b0.central[b0.central.length - 1], endS = sim.central[sim.central.length - 1];
    return {
      kind: 'fiscal', score: 0.4 + Math.min(1, (endB - base.d0) / 40), title: 'Put public debt on a stable path',
      problem: `Government debt is ${pct(base.d0, 0)} of GDP and on the IMF path reaches ${pct(d5, 0)} by ${E.CY + 5}; the extended baseline is ${pct(endB, 0)} by ${y1}.`,
      evidence: `Debt arithmetic: with an effective interest rate of ${pct(b0.i, 1)} and nominal growth that leaves r − g at ${sgn(b0.rg, 1)} pp, stabilizing debt needs a primary balance of ${sgn(b0.stabPB, 1)}% of GDP versus ${sgn(b0.pbEnd, 1)}% planned. In ${pct(b0.pUp * 100, 0)} of 1,500 simulations debt ends 10+ pp higher.`,
      impact: `A phased adjustment of about <b>${num(adj, 1)}% of GDP</b> in the primary balance holds debt near <b>${pct(endS, 0)}</b> in ${y1} instead of ${pct(endB, 0)} (chance of a 10+ pp rise falls to ${pct(sim.pUp * 100, 0)}).`,
      tradeoffs: `Typical fiscal multipliers of 0.5–1.0 imply ${num(adj * 0.5, 1)}–${num(adj, 1)} pp less growth while the adjustment happens, less if it is gradual, credible and weighted toward efficient spending cuts and broad-based taxes. Test the numbers in the What-if lab.`,
      how: 'A multi-year budget rule, spending reviews, and closing tax gaps before raising rates.', confidence: 'Medium'
    };
  }
  function inflationRec(iso) {
    const inf = E.imf('PCPIPCH', iso, E.CY); if (!ok(inf) || inf < 5) return null;
    const inc = E.BYISO[iso].iid, grp = E.COUNTRIES.filter(c => c.iid === inc);
    const g = (lo, hi) => { const a = grp.map(c => { const i5 = E.avg('imf', 'PCPIPCH', c.iso, E.VYEAR - 10, E.VYEAR - 1), g5 = E.avg('imf', 'NGDP_RPCH', c.iso, E.VYEAR - 10, E.VYEAR - 1); return ok(i5) && ok(g5) && i5 >= lo && i5 < hi ? g5 : null; }).filter(ok); return { m: S.median(a), n: a.length }; };
    const low = g(-5, 6), high = g(10, 1e9);
    return {
      kind: 'inflation', score: 0.6 + Math.min(1, inf / 40), title: 'Bring inflation down and keep it stable',
      problem: `Inflation is forecast at <b>${pct(inf, 1)}</b> in ${E.CY} (${E.CY - 1}: ${pct(E.imf('PCPIPCH', iso, E.CY - 1), 1)}), well above the 2–5% range most central banks target.`,
      evidence: ok(low.m) && ok(high.m) ? `Among ${esc(E.BYISO[iso].inc.toLowerCase())} economies over the last decade, those averaging inflation under 6% grew a median ${pct(low.m, 1)} a year (${low.n} economies) versus ${pct(high.m, 1)} for those above 10% (${high.n} economies). High inflation also erodes real wages and savings.` : 'High inflation erodes real wages and savings and raises borrowing costs.',
      impact: ok(low.m) && ok(high.m) ? `If the peer pattern holds, sustained single-digit inflation is associated with roughly <b>${sgn(low.m - high.m, 1)} pp</b> faster growth a year; the causal share is uncertain.` : 'Lower, predictable inflation supports investment and real incomes.',
      tradeoffs: 'Disinflation usually costs output and jobs in the short run; it works best with central-bank independence, a clear target and a budget that does not rely on money creation.',
      how: 'A credible inflation target, positive real interest rates, and ending central-bank financing of deficits.', confidence: 'Low'
    };
  }
  function externalRec(iso) {
    const ca = E.imf('BCA_NGDPD', iso, E.CY), r = E.wbLatest('FI.RES.TOTL.MO', iso).v; if (!ok(ca) || !ok(r) || !(ca <= -4 && r < 3)) return null;
    const tr = E.wbLatest('NE.TRD.GNFS.ZS', iso).v, ex = E.wbLatest('NE.EXP.GNFS.ZS', iso).v, im = ok(tr) && ok(ex) ? tr - ex : null;
    const need = ok(im) ? (3 - r) / 12 * im : null;
    return {
      kind: 'external', score: 0.7, title: 'Rebuild external buffers',
      problem: `A current-account deficit of ${pct(-ca, 1)} of GDP with reserves covering only ${num(r, 1)} months of imports leaves the economy exposed to a sudden stop in foreign financing.`,
      evidence: 'Three months of import cover is the traditional minimum reserve benchmark; large deficits financed by short-term flows have preceded many currency crises.',
      impact: ok(need) ? `Reaching three months of cover means adding reserves worth about <b>${pct(need, 1)} of GDP</b>.` : 'Reaching three months of import cover.',
      tradeoffs: 'Holding reserves has a carrying cost, and narrowing the deficit may need tighter policy or a weaker currency, which raises import prices.',
      how: 'Let the exchange rate adjust, favor long-term and equity financing (FDI) over short-term debt, and build reserves when inflows are strong.', confidence: 'Medium'
    };
  }
  function youthRec(iso) {
    const y = E.wbLatest('SL.UEM.1524.ZS', iso).v; if (!ok(y) || y < 15) return null;
    const med = S.median(E.peers(iso).map(c => E.wbLatest('SL.UEM.1524.ZS', c.iso).v).filter(ok)); if (!ok(med) || y < med * 1.3) return null;
    return {
      kind: 'labor', score: 0.3, title: 'Get more young people into work',
      problem: `Youth unemployment is <b>${pct(y, 1)}</b>, against a peer median of ${pct(med, 1)}.`,
      evidence: 'World Bank / ILO modeled estimates. Long spells of youth joblessness lower lifetime earnings.',
      impact: `Matching the peer median would cut youth unemployment by about <b>${num(y - med, 1)} pp</b>.`,
      tradeoffs: 'Training programs and hiring subsidies cost money and have mixed results; results depend on design and on labor-market rules.',
      how: 'Apprenticeships tied to employers, easier first hires, and job-search support.', confidence: 'Low'
    };
  }
  function usMacroRecs() {
    const out = [];
    const ty = M.taylor(), ffNow = (E.raw('DFF') || []).slice(-1)[0], ff = ffNow ? ffNow[1] : null, inf = M.inflation();
    if (ty && ok(ff) && ty.classic - ff > 1 && ty.core > 2.5) {
      const rec = M.recession(), cm = rec.models.classic, sp = rec.spread(rec.tNow), half = (ty.classic - ff) / 2;
      const p0 = cm.fit.prob([sp]), p1 = cm.fit.prob([sp - half]);
      out.push({
        kind: 'monetary', score: 0.9, title: 'Keep policy firm until core inflation is clearly back toward 2%',
        problem: `Core PCE inflation is <b>${pct(ty.core, 1)}</b> and the model sees CPI inflation at ${pct(inf.path[12] && inf.path[12][1], 1)} a year from now, while the fed funds rate (${pct(ff, 2)}) sits ${num(ty.classic - ff, 1)} pp below the Taylor (1993) rule (${pct(ty.classic, 1)}).`,
        evidence: `Rule = r* ${num(ty.rstar, 1)}% + inflation + 0.5 × (inflation − 2) + 0.5 × output gap (${sgn(ty.gap, 1)}%). Household inflation expectations are ${pct(inf.xNow[2], 1)}.`,
        impact: 'Holding rather than cutting keeps real rates positive and reduces the risk that expectations drift up. Our inflation equation has no direct policy channel, so the inflation gain is not quantified here.',
        tradeoffs: `Tighter policy raises recession risk: closing half the gap (+${num(half, 2)} pp) with long rates unchanged would lift the yield-curve model's 12-month recession odds from ${pct(p0 * 100, 0)} to ${pct(p1 * 100, 0)}.`,
        how: 'Data-dependent guidance tied to core inflation and the labor market; test paths in the What-if lab.', confidence: 'Low', tone: 'var(--s2)'
      });
    }
    const pNow = M.recession().models.classic.pNow;
    if (pNow >= 0.3) out.push({ kind: 'cycle', score: 1, title: 'Prepare counter-cyclical options now', problem: `Recession odds within 12 months are ${pct(pNow * 100, 0)}.`, evidence: 'Yield-curve probit, AUC shown on the Models tab.', impact: 'Faster response if the downturn arrives.', tradeoffs: 'Preparing costs little; acting early on a false alarm can add inflation or debt.', confidence: 'Medium' });
    return out;
  }
  function recsFor(iso) {
    const list = [];
    if (iso === 'USA') list.push(...usMacroRecs());
    for (const f of [inflationRec, externalRec, fiscalRec, youthRec]) { const r = f(iso); if (r) list.push(r); }
    list.push(...leverRecs(iso));
    return list.sort((a, b) => b.score - a.score);
  }

  /* ---------------- world view: opportunities across economies ---------------- */
  function opportunities() {
    const lv = M.levers(); if (!lv) return [];
    const latest = new Map(); for (const c of E.COUNTRIES) latest.set(c.iso, lv.latest(c.iso));
    const byInc = {}; for (const c of E.COUNTRIES) (byInc[c.iid] = byInc[c.iid] || []).push(c.iso);
    const tgt = {};
    for (const [inc, isos] of Object.entries(byInc)) tgt[inc] = lv.coef.map((L, j) => { const d = isos.map(i => latest.get(i)[j]).filter(ok); return d.length >= 5 ? { med: S.median(d), q: S.quantile(d, L.dir > 0 ? 0.75 : 0.25), dist: d } : null; });
    const rows = [];
    for (const c of E.COUNTRIES) {
      const pop = E.indById('pop').get(c.iso); if (!ok(pop) || pop < 1) continue;
      const x = latest.get(c.iso); let gain = 0, best = null, n = 0;
      lv.coef.forEach((L, j) => {
        const t = tgt[c.iid] && tgt[c.iid][j]; if (!L.lever || !t || !ok(x[j])) return;
        if (!(L.p < 0.10 && Math.sign(L.b) === L.dir)) return;
        const below = L.dir > 0 ? x[j] < t.med : x[j] > t.med; const target = below ? t.med : t.q;
        const gap = target - x[j]; if (L.dir > 0 ? gap <= 0 : gap >= 0) return;
        const dg = L.b * gap; if (dg <= 0.05) return; n++; gain += dg; if (!best || dg > best.dg) best = { L, dg };
      });
      const d0 = E.imf('GGXWDG_NGDP', c.iso, E.CY), d5 = E.imf('GGXWDG_NGDP', c.iso, E.CY + 5), inf = E.imf('PCPIPCH', c.iso, E.CY);
      rows.push({ _country: c.iso, name: c.name, gain, inc10: (Math.pow(1 + gain / 100, 10) - 1) * 100, lever: best ? ({ inv: 'Investment', trade: 'Trade openness', ge: 'Gov. effectiveness', infl: 'Inflation', flfp: 'Participation', debt: 'Debt' })[best.L.k] : '–', n, debt: ok(d0) && ok(d5) ? d5 - d0 : null, inf, rank: c.rank });
    }
    return rows;
  }
  function world() {
    const rows = opportunities();
    const debtUp = rows.filter(r => ok(r.debt) && r.debt > 3).length, infHi = rows.filter(r => ok(r.inf) && r.inf >= 5).length, withGain = rows.filter(r => r.gain > 0.25).length;
    const top = rows.slice().sort((a, b) => b.gain - a.gain).slice(0, 12).map(r => ({ name: r.name, v: r.gain, id: r._country, color: 'var(--s1)' }));
    const tbl = T.html({ cols: [{ k: 'name', lab: 'Economy' }, { k: 'rank', lab: 'GDP rank', fmt: v => ok(v) ? '#' + v : '–' }, { k: 'gain', lab: 'Growth upside', num: true, good: 1, fmt: v => sgn(v, 2) + ' pp', title: 'Sum of associated growth gains from closing significant lever gaps to income-group peers (pp per person per year)' }, { k: 'inc10', lab: 'Income after 10 yrs', num: true, good: 1, fmt: v => sgn(v, 1) + '%' }, { k: 'lever', lab: 'Biggest lever' }, { k: 'debt', lab: `Debt Δ ${E.CY}–${E.CY + 5}`, num: true, good: -1, fmt: v => ok(v) ? sgn(v, 0) + ' pp' : '–' }, { k: 'inf', lab: `Inflation ${E.CY}`, num: true, good: -1, fmt: v => pct(v, 1) }], rows, sort: { k: 'rank', dir: 1 }, placeholder: 'Find an economy…', limit: 15, chartCol: 'gain' });
    return V.sec('Where improvement pays most', 'For every economy, the engine compares each growth lever with income-group peers and adds up the growth associated with closing the gaps, using only levers that are statistically significant in the cross-country evidence. Open any economy for its full, ranked recommendations with trade-offs.') +
      `<div class="tiles">${V.tile({ lab: 'Economies with a growth upside above 0.25 pp a year', val: String(withGain), unit: `of ${rows.length}` })}${V.tile({ lab: `Debt rising by more than 3 pp of GDP by ${E.CY + 5}`, val: String(debtUp), unit: 'economies', sub: 'IMF projections' })}${V.tile({ lab: 'Inflation at 5% or more', val: String(infHi), unit: 'economies', sub: `${E.CY} IMF forecast` })}</div>` +
      `<div class="grid g-7-5" style="margin-top:14px">${tbl}${V.card('Largest associated growth upside', 'pp of growth per person a year. Click a bar for the country.', C.hbars(top, { lo: 0, fmt: v => sgn(v, 2) }))}</div>` +
      `<div class="callout" style="margin-top:14px"><b>How to read this:</b> the upside is what peers' experience suggests, not a promise. Levers interact, institutions take years to change, and cross-country regressions cannot fully separate cause from correlation. Each recommendation shows its confidence level for that reason.</div>`;
  }
  function country(iso) {
    const recs = recsFor(iso);
    const lv = M.levers();
    return V.sec(`Recommendations: ${E.name(iso)}`, `Ranked by expected impact. Each one states the problem, the evidence, the expected impact with a range, the trade-offs and a confidence level. The engine only suggests a structural lever when the cross-country evidence is statistically significant (p < 0.10).`) +
      R.list(recs.map(r => Object.assign({}, r, { title: r.title }))) +
      (lv ? `<div class="grid g2" style="margin-top:14px">${V.card('Evidence behind the levers', `Panel regression of average yearly growth per person on starting income, population growth and six levers; ${lv.n} country-decades, robust standard errors, decade effects. R² ${num(lv.fit.r2, 2)}. Used = significant at p < 0.10 with the expected sign.`, `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Variable</th><th>Coefficient</th><th>Std. error</th><th>p-value</th><th>Used?</th></tr></thead><tbody>${lv.coef.map(L => `<tr><td>${esc(L.lab)}</td><td>${num(L.b, 3)}</td><td>${num(L.se, 3)}</td><td>${L.p < 0.001 ? '<0.001' : num(L.p, 3)}</td><td>${!L.lever ? 'Control' : L.p < 0.10 && Math.sign(L.b) === L.dir ? 'Yes' : 'No'}</td></tr>`).join('')}</tbody></table></div>`)}${V.card('What the engine will not do', '', `<div class="prose" style="font-size:13.5px"><ul><li>Recommend a lever the data cannot distinguish from zero.</li><li>Claim a causal effect: every estimate is an association across economies.</li><li>Ignore costs: every card lists trade-offs, and the fiscal ones are quantified in the What-if lab.</li><li>Give investment or political advice; this is an analytical tool.</li></ul></div>`)}</div>` : '');
  }
  function view(st) { return st.scope === 'WLD' ? world() : country(st.scope); }
  return { view, recsFor, opportunities };
})();
