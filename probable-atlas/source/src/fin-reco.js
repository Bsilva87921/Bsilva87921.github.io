/* Probable Atlas · Finance: Recommendations (evidence-based, condition-aware, tailored to a simple investor profile). Educational, not advice. */
const VRF = (() => {
  const { esc, ok, num, pct, sgn } = K;
  const BASE = {
    short: { low: { CASH: 40, BND: 35, TIPS: 15, US: 10 }, med: { CASH: 25, BND: 35, TIPS: 15, US: 20, INTL: 5 }, high: { CASH: 15, BND: 30, TIPS: 10, US: 35, INTL: 10 } },
    mid: { low: { US: 25, INTL: 10, BND: 40, TIPS: 10, CASH: 10, GOLD: 5 }, med: { US: 40, INTL: 15, EM: 5, BND: 30, TIPS: 5, GOLD: 5 }, high: { US: 50, INTL: 20, EM: 10, BND: 15, GOLD: 5 } },
    long: { low: { US: 35, INTL: 15, EM: 5, BND: 30, TIPS: 10, GOLD: 5 }, med: { US: 45, INTL: 20, EM: 8, BND: 20, TIPS: 2, GOLD: 5 }, high: { US: 55, INTL: 22, EM: 13, BND: 8, GOLD: 2 } }
  };
  const PROF = { horizon: [['short', 'Under 3 years'], ['mid', '3 to 10 years'], ['long', 'Over 10 years']], risk: [['low', 'Low'], ['med', 'Medium'], ['high', 'High']] };
  function context() {
    const cp = FM.cape(), sb = FM.stockBond(), vm = FM.volModel(), d10 = FM.risk('dd10'), tr = FM.trend();
    const y = id => F.lastVal(id), cashReal = y('DGS3MO') - y('T10YIE');
    const tenYr = F.ser('DGS10'), since08 = []; for (let i = F.idx('2008-01-01'); i <= tenYr.e; i++) since08.push(tenYr.v[i]);
    const y10pct = S.pctRank(since08, y('DGS10')) * 100;
    const conc = (F.annRet('SPY', 3) || 0) - (F.annRet('RSP', 3) || 0);
    return { cp, sb, vm, d10, tr, cashReal, y10pct, conc, curve: y('DGS10') - y('DGS3MO'), be: y('T10YIE'), real10: y('DFII10') };
  }
  function suggested(p, c) {
    const w = Object.assign({}, BASE[p.horizon][p.risk]), notes = [];
    const move = (from, to, amt, why) => { const a = Math.min(amt, w[from] || 0); if (a <= 0) return; w[from] -= a; w[to] = (w[to] || 0) + a; notes.push(`${a} pp from ${FP.LAB.find(x => x.id === from).short} to ${FP.LAB.find(x => x.id === to).short}: ${why}`); };
    if (c.cp && c.cp.pctile > 90 && (w.US || 0) >= 20) move('US', 'INTL', 5, `US valuations are in the ${K.ord(Math.round(c.cp.pctile))} percentile`);
    if (c.sb.now > 0.15 && (w.BND || 0) >= 15) move('BND', 'TIPS', 5, `stocks and bonds have been moving together (correlation ${num(c.sb.now, 2)}), so add inflation protection`);
    if (c.cashReal > 1.5 && p.horizon === 'short' && (w.BND || 0) >= 10) move('BND', 'CASH', 5, `cash pays ${num(c.cashReal, 1)} pp above expected inflation with no price risk`);
    for (const k in w) if (!w[k]) delete w[k];
    return { w, notes };
  }
  function recs(p, c) {
    const out = [];
    const add = (score, r) => out.push(Object.assign({ score }, r));
    // 1. valuation-aware expectations
    if (c.cp) add(c.cp.pctile > 80 ? 90 : 60, {
      title: 'Plan on lower US stock returns than the past decade', confidence: 'Medium', tone: 'var(--s7)',
      problem: `US stocks trade at a Shiller CAPE of <b>${num(c.cp.last.cape, 1)}</b>, the ${K.ord(Math.round(c.cp.pctile))} percentile since 1881. The S&P 500 returned ${FV.P(F.annRet('SPY', 10))} a year over the last 10 years, a pace that started from much lower valuations.`,
      evidence: `Starting valuations explained about ${num(c.cp.r2oos * 100, 0)}% of the variation in the next decade's real returns out of sample (R² ${num(c.cp.r2oos, 2)} vs the running average, re-estimated yearly since 1940). Today's CAPE implies about <b>${sgn(c.cp.fc, 1, '%')}</b> a year after inflation, with a 90% range of ${num(c.cp.lo, 0)}% to ${num(c.cp.hi, 0)}%.`,
      impact: 'Using a realistic return (the lab\'s forward-looking setting) instead of past performance changes retirement math a lot: at 5% instead of 10% a year, money takes about twice as long to double (14 years vs 7).',
      tradeoffs: 'Valuations say little about the next one to three years; expensive markets can get more expensive. This is a planning input, not a reason to sell.',
      how: 'Use conservative return assumptions, raise savings if the plan depends on high returns, and diversify beyond US large caps.'
    });
    // 2. starting yields
    add(c.y10pct > 70 ? 80 : 50, {
      title: c.y10pct > 70 ? 'Bonds pay a real return again; lock in some of it' : 'Know what your bonds can earn from here', confidence: 'High', tone: 'var(--s3)',
      problem: `The 10-year Treasury yields <b>${num(F.lastVal('DGS10'), 2)}%</b> (${K.ord(Math.round(c.y10pct))} percentile since 2008) and the 10-year TIPS real yield is <b>${num(c.real10, 2)}%</b>.`,
      evidence: 'For high-quality bonds, the starting yield has historically been a close guide to the return earned over the following 5-10 years, because coupons dominate and price changes wash out over the bonds\' life. The lab uses today\'s yields as forward returns for that reason.',
      impact: `A 60/40 mix now expects about ${sgn(FP.stats(FP.vec({ US: 0.6, BND: 0.4 }), FP.assumptions('forward').map(a => a.er)).er, 1, '%')} a year by these assumptions, with the bond half doing more of the work than at any time since 2008.`,
      tradeoffs: 'Longer bonds fall when yields rise: a 1 pp rise costs a 20-year Treasury fund about 16% (the lab\'s rate shock). Shorter bonds give up some yield for stability.',
      how: 'Match bond duration to when you need the money; TIPS lock in a real return if inflation is your main worry.'
    });
    // 3. cash
    add(c.cashReal > 1 ? (p.horizon === 'short' ? 95 : 55) : 20, {
      title: c.cashReal > 0 ? 'Cash is a reasonable home for short-term money' : 'Cash is losing to inflation', confidence: 'High', tone: 'var(--s1)',
      problem: `Three-month Treasury bills yield <b>${num(F.lastVal('DGS3MO'), 2)}%</b> against expected inflation of ${num(c.be, 2)}% (10-year breakeven), a real return of about ${sgn(c.cashReal, 1, ' pp')}.`,
      evidence: `Since 1871, US stocks lost money after inflation in ${num(100 - FM.rolling().rows[0].pos, 0)}% of 1-year periods and ${num(100 - FM.rolling().rows[2].pos, 0)}% of 5-year periods (Shiller data); the worst 1-year real loss was ${num(FM.rolling().rows[0].min, 0)}%.`,
      impact: 'Money needed within about three years is safer in T-bills or short Treasuries than in stocks, at little cost while real cash yields are positive.',
      tradeoffs: 'Cash yields can fall quickly when the Fed cuts; over long horizons cash has trailed stocks and bonds.',
      how: 'Hold near-term needs and an emergency fund in T-bills, a Treasury money-market fund or short Treasuries.'
    });
    // 4. stock-bond correlation
    add(c.sb.now > 0 ? 85 : 40, {
      title: c.sb.now > 0 ? 'Bonds are a weaker hedge than they were; diversify the diversifiers' : 'Bonds are cushioning stocks again', confidence: 'Medium', tone: 'var(--s4)',
      problem: `The 52-week correlation between S&P 500 and 10-year Treasury returns is <b>${num(c.sb.now, 2)}</b>. It was negative for most of 2000-2021, which is why a 60/40 portfolio held up in 2008 and 2020 but fell ${FV.P(FP.stress(FP.vec({ US: 0.6, BND: 0.4 })).find(r => r.name.startsWith('2022')).port, 0)} in 2022.`,
      evidence: 'Stock-bond correlation tends to be positive when inflation is the main macro risk and negative when growth is. The rolling chart in Markets shows the 2022 regime change.',
      impact: `In the lab's 2022 replay, adding TIPS, gold or cash in place of part of the bond sleeve reduced the loss; gold returned ${FV.P(FP.assetWindow('GOLD', F.idx('2022-01-03'), F.idx('2022-10-12')).r, 0)} over that window.`,
      tradeoffs: 'Gold and commodities have long stretches of poor returns; TIPS still lose money when real yields jump.',
      how: 'Spread defensive money across Treasuries of different maturities, TIPS, cash and a small allocation to gold or trend-following.'
    });
    // 5. concentration
    if (ok(c.conc)) add(Math.abs(c.conc) > 3 ? 70 : 30, {
      title: c.conc > 0 ? 'The S&P 500 is unusually top-heavy' : 'Market leadership has broadened', confidence: 'Medium', tone: 'var(--s5)',
      problem: `Over three years, the cap-weighted S&P 500 (SPY) returned ${FV.P(F.annRet('SPY', 3))} a year vs ${FV.P(F.annRet('RSP', 3))} for the equal-weight version (RSP), a gap of ${sgn(c.conc, 1, ' pp')} a year.`,
      evidence: 'A wide gap means returns came from a handful of the largest companies. Concentration raises the index\'s exposure to those few stocks\' fortunes.',
      impact: 'Adding equal-weight, small-cap or international stocks spreads company-specific risk without leaving the stock market.',
      tradeoffs: 'Equal-weight and small caps have lagged badly when mega-caps keep winning, and they cost a little more to hold.',
      how: 'Check how much of your stock money sits in the top 10 names; balance with broader funds if it is more than you intended.'
    });
    // 6. international
    add(c.cp && c.cp.pctile > 85 ? 60 : 35, {
      title: 'Keep international stocks in the mix', confidence: 'Medium', tone: 'var(--s1)',
      problem: `Developed ex-US stocks (EFA) returned ${FV.P(F.annRet('EFA', 10))} a year over 10 years vs ${FV.P(F.annRet('SPY', 10))} for the S&P 500, and many investors have drifted to all-US portfolios.`,
      evidence: `Their 3-year weekly correlation with US stocks is ${num(FM.corrMatrix(['SPY', 'EFA'], 156).M[0][1], 2)}: related, but not the same. Leadership between US and non-US stocks has rotated over multi-year cycles, and US valuations are far above their history.`,
      impact: 'A 20-40% non-US share of stocks reduces dependence on one market\'s valuation and currency.',
      tradeoffs: 'Non-US stocks have lagged for most of the past 15 years and add currency swings.',
      how: 'Use a low-cost total international fund rather than picking countries.'
    });
    // 7. rebalancing (evidence from the data: drifted vs rebalanced 60/40)
    const m = FP.monthly(), k0 = m.keys.findIndex(k => k >= '2004-01'); let a = 0.6, b = 0.4, mx = 0.6; for (let k = k0; k < m.keys.length; k++) { const ru = m.R[0][k], rb = m.R[3][k]; if (ok(ru) && ok(rb)) { a *= 1 + ru; b *= 1 + rb; mx = Math.max(mx, a / (a + b)); } }
    add(p.risk === 'low' ? 65 : 50, {
      title: 'Rebalance on a schedule, not a feeling', confidence: 'High', tone: 'var(--s3)',
      problem: `A 60/40 portfolio left alone since 2004 would now be <b>${num(a / (a + b) * 100, 0)}% stocks</b> (peaking at ${num(mx * 100, 0)}%), with much more risk than the investor chose.`,
      evidence: `Monthly-rebalanced 60/40 since ${FP.backtest(FP.vec({ US: 0.6, BND: 0.4 })).from}: worst drawdown ${pct(FP.backtest(FP.vec({ US: 0.6, BND: 0.4 })).p.mdd, 0)} vs ${pct(FP.backtest(FP.vec({ US: 1 })).p.mdd, 0)} for all stocks. Rebalancing is what keeps the risk where you set it.`,
      impact: 'Keeps drawdowns close to what you planned for, and mechanically sells high and buys low.',
      tradeoffs: 'In long bull markets, rebalancing trims winners and lowers returns a little. Taxes and costs matter: use new contributions and tax-advantaged accounts first.',
      how: 'Rebalance once or twice a year, or when any holding drifts more than 5 pp from target.'
    });
    // 8. trend overlay
    if (c.tr) add(p.risk === 'low' ? 55 : 35, {
      title: 'If drawdowns are your main fear, a simple trend rule has history on its side', confidence: 'Medium', tone: 'var(--s7)',
      problem: `Buy-and-hold US stocks fell ${pct(c.tr.all.b.mdd, 0)} at their worst (1929-32) and ${pct(c.tr.since1990.b.mdd, 0)} since 1990.`,
      evidence: `Holding stocks only above their 10-month average, else T-bills: ${pct(c.tr.all.s.cagr, 1)} a year vs ${pct(c.tr.all.b.cagr, 1)} for buy and hold since ${c.tr.from.slice(0, 4)}, with a worst drawdown of ${pct(c.tr.all.s.mdd, 0)} vs ${pct(c.tr.all.b.mdd, 0)} (Kenneth French data, before costs and taxes).`,
      impact: `Similar long-run returns with far smaller crashes; Sharpe ${num(c.tr.all.s.sharpe, 2)} vs ${num(c.tr.all.b.sharpe, 2)}.`,
      tradeoffs: `About ${Math.round(c.tr.switches / c.tr.years * 10) / 10} trades a year, lags in V-shaped rebounds (2020), and taxes in taxable accounts can erase the benefit.`,
      how: 'Apply it to a slice of the stock allocation in a tax-advantaged account, or use a managed-futures fund.'
    });
    // 9. volatility now and correction risk
    add(c.d10.now && c.d10.now.p > c.d10.baseRate * 1.4 ? 75 : 30, {
      title: 'Prepare for a correction instead of trying to time it', confidence: 'Low', tone: 'var(--s2)',
      problem: `The correction model puts the chance of a 10% fall within six months at <b>${pct(c.d10.now.p * 100, 0)}</b> (base rate ${pct(c.d10.baseRate * 100, 0)}). GARCH expects ${num(c.vm.volAnn, 0)}% volatility, near the long-run ${num(c.vm.longRun, 0)}%.`,
      evidence: `Out of sample the model beat the base rate only modestly (Brier skill ${sgn(c.d10.evaluate().bss * 100, 0, '%')}). Timing exits is costly because the best days cluster with the worst: ${FM.clustering().near} of the 10 best S&P 500 days since 1928 came within two months of one of the 20 worst.`,
      impact: `The S&P 500 fell 10% or more at some point in ${FM.intraYear().n10} of the ${FM.intraYear().n} calendar years since 1929, yet finished ${FM.intraYear().posAfter10} of those years higher. Having a plan beforehand is what prevents selling at the bottom.`,
      tradeoffs: 'Holding extra cash for a correction that does not come has a cost (cash has trailed stocks over most long periods).',
      how: 'Decide now what you would do after a 10% and a 20% fall (rebalance into stocks, stay put) and keep near-term needs out of stocks.'
    });
    // 10. crypto sizing
    const rm = FP.riskModel(), w = FP.vec({ US: 0.58, BND: 0.4, BTC: 0.02 }), st = FP.stats(w, FP.assumptions('forward').map(a => a.er));
    add(p.risk === 'high' ? 70 : 25, {
      title: 'Size crypto by its risk, not its weight', confidence: 'High', tone: 'var(--s5)',
      problem: `Bitcoin's volatility is about <b>${num(rm.vol[10] * 100, 0)}%</b> a year, roughly ${num(rm.vol[10] / rm.vol[0], 0)} times US stocks, and it is ${pct(F.drawdown('BTC-USD').dd, 0)} below its high. Since 2014 it has had ${FM.episodes('BTC-USD', 0.5).length} declines of more than 50%, the deepest ${pct(Math.min(...FM.episodes('BTC-USD', 0.5).map(e => e.depth)), 0)}.`,
      evidence: `In a 58/40/2 stocks/bonds/bitcoin mix, the 2% bitcoin slice contributes about <b>${pct(st.rc[10] * 100, 0)}</b> of total portfolio risk (lab risk model). Its correlation with US stocks since 2014 is ${num(rm.raw[0][10], 2)}, so it has not been a reliable crash hedge.`,
      impact: 'Keeping crypto to a few percent caps the damage of a crash at a level you can live with.',
      tradeoffs: 'There is no valuation anchor or cash flow to estimate a long-run return; outcomes are wide in both directions.',
      how: 'Treat it as a speculative satellite: a fixed small weight, rebalanced, and only money you could see halved.'
    });
    const boost = { short: ['Cash', 'short-term'], long: ['valuation', 'international', 'trend'] };
    out.forEach(r => { if (p.horizon === 'short' && /Cash|cash|correction/.test(r.title)) r.score += 20; if (p.horizon === 'long' && /US stock returns|international|trend|Rebalance/.test(r.title)) r.score += 10; if (p.risk === 'high' && /crypto|top-heavy/.test(r.title)) r.score += 10; if (p.risk === 'low' && /hedge|Bonds|Rebalance|trend/.test(r.title)) r.score += 10; });
    return out.sort((a, b) => b.score - a.score);
  }
  function view(st) {
    const p = { horizon: st.rHorizon || 'long', risk: st.rRisk || 'med' }, c = context(), mix = suggested(p, c), list = recs(p, c);
    const e = FP.assumptions('forward').map(a => a.er), w = FP.vec(mix.w).map(v => v / 100), s = FP.stats(w, e);
    const rows = FP.LAB.map((a, i) => w[i] > 0 ? `<div class="mixrow"><span>${esc(a.short)}</span><span class="trk"><b style="width:${w[i] * 100}%"></b></span><b>${num(w[i] * 100, 0)}%</b></div>` : '').join('');
    return `${U.sec('Recommendations', 'Evidence-based ideas ranked for your situation. Each card shows the data behind it, the expected effect and the trade-offs. Educational, not investment advice.')}
      <section class="card prof"><div class="profrow"><div class="ctrl"><label><span>When will you need the money?</span></label>${U.seg('rhorizon', PROF.horizon, p.horizon, 'Horizon')}</div><div class="ctrl"><label><span>How much decline can you sit through?</span></label>${U.seg('rrisk', PROF.risk, p.risk, 'Risk tolerance')}</div></div></section>
      <div class="grid g-5-7" style="margin-top:14px">
        ${U.card('A starting mix for this profile', `Expected ${sgn(s.er, 1, '%')} a year, volatility ${num(s.vol, 1)}%, a bad year ${sgn(s.p5, 0, '%')}.`, `<div class="mixlist">${rows}</div>${mix.notes.length ? `<div class="callout" style="margin-top:10px"><b>Adjusted for today's conditions:</b><ul>${mix.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}<div class="pill-row" style="margin-top:10px"><button type="button" class="btn pri" data-labload="${esc(JSON.stringify(mix.w))}">Open in What-if lab</button><button type="button" class="btn" data-ask="Explain the suggested mix for my profile and the risks.">Ask Atlas why</button></div>`)}
        <div>${R.list(list.slice(0, 3))}</div>
      </div>
      ${U.sec('More ideas', 'Ranked lower for this profile, but worth reading.')}
      ${R.list(list.slice(3))}
      <div class="callout" style="margin-top:14px"><b>Important.</b> Probable Atlas is an educational analytics project. It does not know your full situation (taxes, debts, income, other assets) and is not personalized financial advice. Consider a fee-only fiduciary adviser for decisions that matter.</div>`;
  }
  return { view, recs, context, suggested, BASE, PROF };
})();
