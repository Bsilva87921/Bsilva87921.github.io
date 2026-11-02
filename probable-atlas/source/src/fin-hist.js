/* Probable Atlas · Finance: History tab and How it works. */
const VHF = (() => {
  const { esc, ok, num, pct, sgn } = K;
  function spxCard() {
    const L = F.spxLong(), cr = FM.crashes(), step = Math.max(1, Math.floor(L.v.length / 1400)), pts = [];
    for (let i = 0; i < L.v.length; i += step) pts.push([L.x[i], L.v[i]]); pts.push([L.x[L.x.length - 1], L.v[L.v.length - 1]]);
    const zones = cr.map(c => ({ a: c.xp, b: c.xr || L.x[L.x.length - 1], color: 'var(--crit)', op: 0.1 }));
    const ch = C.line({ series: [{ name: 'S&P 500 (price index)', pts, color: 'var(--s1)', width: 1.6 }], zones, zoneLegend: [{ name: 'From a record high to full recovery, declines of 20%+', color: 'var(--crit)' }], shade: F.recessions(), shadeName: 'US recession (since 1947)', h: 320, logY: true, yFmt: v => K.big(v, 0), tipFmt: v => num(v, 2), tipX: x => { const i = L.x.findIndex(v => v >= x); return K.isoLab(L.iso[Math.max(0, i)]); }, aria: 'S&P 500 since 1928' });
    const rows = cr.map(c => `<tr><td class="name">${esc(K.isoLab(c.peak))}</td><td>${esc(K.isoLab(c.trough))}</td><td class="down">${pct(c.depth, 0)}</td><td>${num(c.down, 0)} mo</td><td>${c.rec ? num(c.back, 0) + ' mo' : '<span class="muted">not yet</span>'}</td><td>${c.rec ? num(c.down + c.back, 0) + ' mo' : '–'}</td></tr>`).join('');
    return U.card('S&P 500 since 1928', 'Daily closes on a log scale, so equal heights mean equal percentage moves. Shaded: every decline of 20% or more from a record high, through to its full recovery (price only; with dividends, recoveries were shorter).',
      ch + `<div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Record high</th><th>Bottom</th><th>Decline</th><th>Falling</th><th>Recovering</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></div>`);
  }
  function intraCard(st) {
    const iy = FM.intraYear(), from = st.hFrom || '1980', rows = iy.rows.filter(r => r.y >= +from);
    const items = rows.map(r => ({ label: r.ytd ? r.y + '*' : String(r.y), y: r.r, mark: r.dd, color: r.r >= 0 ? 'color-mix(in oklab, var(--s1) 60%, var(--surface))' : 'color-mix(in oklab, var(--s2) 60%, var(--surface))', r }));
    const ch = C.bars({ items, h: 260, yFmt: v => num(v, 0) + '%', legendItems: [{ name: 'Calendar-year return', color: 'var(--s1)' }, { name: 'Deepest fall within the year', color: 'var(--crit)' }], tip: d => `<b>${esc(d.label)}${d.r.ytd ? ' (year to date)' : ''}</b>${K.tipRow('var(--s1)', 'Year return', esc(FV.P(d.r.r, 1)))}${K.tipRow('var(--crit)', 'Deepest fall inside the year', esc(pct(d.r.dd, 1)))}` });
    return U.card('Declines inside the year are normal', `Since 1929, the S&P 500 fell 10% or more at some point in ${iy.n10} of ${iy.n} years, yet ended ${iy.posAfter10} of those years higher. The typical (median) fall inside a year was ${pct(iy.medDD, 0)}; ${iy.pos} of ${iy.n} years ended up.`, ch, U.seg('hfrom', [['1929', 'Since 1929'], ['1980', 'Since 1980'], ['2000', 'Since 2000']], from, 'Start year'));
  }
  function bigDaysCard() {
    const bd = FM.bigDays(), row = d => `<tr><td class="name">${esc(K.isoLab(d.iso))}</td><td class="${K.cls(d.r)}">${esc(FV.P(d.r, 1))}</td></tr>`;
    return U.card('The biggest days', `${bd.n.toLocaleString()} trading days since 1928; ${bd.over2.toLocaleString()} moved 2% or more either way. ${FM.clustering().near} of the 10 best days came within two months of one of the 20 worst.`, `<div class="grid g2"><div><div class="kicker">Worst</div><div class="tbl-wrap"><table class="tbl"><tbody>${bd.worst.map(row).join('')}</tbody></table></div></div><div><div class="kicker">Best</div><div class="tbl-wrap"><table class="tbl"><tbody>${bd.best.map(row).join('')}</tbody></table></div></div></div>`);
  }
  function quiltCard() {
    const q = FM.calYears(), nA = q.ids.length;
    const cols = q.years.map((y, j) => q.ids.map((id, i) => ({ id, v: q.M[i][j] })).filter(d => ok(d.v)).sort((a, b) => b.v - a.v));
    let h = `<div class="pq" style="grid-template-columns:repeat(${q.years.length},minmax(58px,1fr))">${q.years.map(y => `<div class="h">${y === q.ytdYear ? y + ' YTD' : y}</div>`).join('')}`;
    for (let r = 0; r < nA; r++) h += cols.map((col, j) => { const d = col[r]; if (!d) return '<div class="qc empty"></div>'; return `<div class="qc" data-qk="${esc(d.id)}" style="${FV.heatBg(d.v, 30)}" data-tip="${esc(`<b>${F.label(d.id)}, ${q.years[j]}</b>${K.tipRow(null, 'Return', FV.P(d.v, 1))}${K.tipRow(null, 'Rank', (r + 1) + ' of ' + col.length)}`)}"><span>${esc(F.tick(d.id) || F.short(d.id))}</span><b>${esc(sgn(d.v, 0, ''))}</b></div>`; }).join('');
    h += '</div>';
    return U.card('Asset-class returns by year, best to worst', 'Total returns of the main funds each calendar year. Hover a cell to trace that asset across years: last year\'s winner is rarely next year\'s, which is the case for owning several.', `<div class="pq-wrap">${h}</div>` + U.src('SPY US stocks · IWM small caps · EFA developed ex-US · EEM emerging · AGG US bonds · TLT long Treasuries · TIP TIPS · HYG high yield · GLD gold · VNQ REITs · DBC commodities · BIL T-bills · BTC bitcoin (from 2015).'));
  }
  function monthCard(st) {
    const mg = FM.monthGrid(); if (!mg) return '';
    const all = st.mAll === '1', years = all ? mg.years : mg.years.slice(-40);
    let h = `<div class="mg" style="grid-template-columns:48px repeat(12,minmax(34px,1fr)) minmax(52px,1.2fr)"><div class="h"></div>${K.MON.map(m => `<div class="h">${m}</div>`).join('')}<div class="h">Year</div>`;
    for (const y of years.slice().reverse()) {
      const r = mg.rows[y], yi = mg.years.indexOf(y);
      h += `<div class="n">${y}</div>` + r.map((v, m) => ok(v) ? `<div class="c" style="${FV.heatBg(v, 8)}" data-tip="${esc(`<b>${K.MON[m]} ${y}</b>${K.tipRow(null, 'US stock market', FV.P(v, 2))}`)}">${esc(sgn(v, 1, ''))}</div>` : '<div class="c empty"></div>').join('') + `<div class="c tot" style="${FV.heatBg(mg.yr[yi], 35)}">${esc(sgn(mg.yr[yi], 0, ''))}</div>`;
    }
    h += '</div>';
    const avg = C.bars({ items: mg.avg.map((v, m) => ({ label: K.MON[m], y: v, color: v >= 0 ? 'var(--s1)' : 'var(--s2)', up: mg.up[m] })), h: 180, yFmt: v => num(v, 1) + '%', valueLabels: true, tip: d => `<b>${d.label}</b>${K.tipRow(d.color, 'Average return', esc(FV.P(d.y, 2)))}${K.tipRow(null, 'Months up', esc(pct(d.up, 0)))}` });
    return U.card('Every month since 1926', `US stock market total return (Kenneth French: all NYSE, AMEX and Nasdaq stocks, plus T-bills). ${all ? 'All years' : 'Last 40 years'}, newest first.`, avg + `<div class="mg-wrap" style="margin-top:10px">${h}</div>`, U.seg('mall', [['0', 'Last 40 years'], ['1', 'Since 1926']], all ? '1' : '0', 'Years shown'));
  }
  function rollingCard() {
    const ro = FM.rolling(); if (!ro) return '';
    const W = 640, rowH = 34, H = ro.rows.length * rowH + 34, lo = -60, hi = 60, sx = v => 110 + (K.clamp(v, lo, hi) - lo) / (hi - lo) * (W - 130);
    let g = ''; for (let t = -60; t <= 60; t += 20) g += `<line x1="${sx(t)}" x2="${sx(t)}" y1="8" y2="${H - 22}" class="${t === 0 ? 'zero' : 'gridl'}"/><text x="${sx(t)}" y="${H - 6}" text-anchor="middle">${t > 0 ? '+' : ''}${t}%</text>`;
    ro.rows.forEach((r, k) => { const y = 20 + k * rowH; g += `<text x="0" y="${y + 4}" class="ttl">${r.h} year${r.h > 1 ? 's' : ''}</text><line x1="${sx(r.min)}" x2="${sx(r.max)}" y1="${y}" y2="${y}" style="stroke:var(--axis);stroke-width:2"/><line x1="${sx(r.p10)}" x2="${sx(r.p90)}" y1="${y}" y2="${y}" style="stroke:var(--s1);stroke-width:9;stroke-linecap:round;opacity:.55"/><circle cx="${sx(r.med)}" cy="${y}" r="5" class="dotring" style="fill:var(--s1)"/><rect x="${sx(r.min) - 4}" y="${y - 12}" width="${sx(r.max) - sx(r.min) + 8}" height="24" style="fill:transparent" data-tip="${esc(`<b>Holding ${r.h} year${r.h > 1 ? 's' : ''}</b>${K.tipRow(null, 'Worst', pct(r.min, 1) + ' a year')}${K.tipRow(null, '10th percentile', pct(r.p10, 1))}${K.tipRow(null, 'Median', pct(r.med, 1))}${K.tipRow(null, '90th percentile', pct(r.p90, 1))}${K.tipRow(null, 'Best', pct(r.max, 1))}${K.tipRow(null, 'Periods with a gain', pct(r.pos, 0))}`)}"/>`; });
    return U.card('Time in the market narrows the range', `Real (after-inflation) total return of US stocks a year, over every rolling period since ${esc(ro.from.slice(0, 4))}. Thick bar: middle 80% of outcomes; dot: median; thin line: best to worst.`, `<div class="chart"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Range of rolling returns by holding period">${g}</svg></div>` + U.src(`Worst 1-year real return ${pct(ro.rows[0].min, 0)}; worst 20-year ${pct(ro.rows[4].min, 1)} a year; no 30-year period lost money after inflation. Source: Robert Shiller.`));
  }
  function factorCard() {
    const ff = F.french(); if (!ff) return '';
    const grow = (blk, key, from, name, color) => { const b = ff[blk]; if (!b || !b[key]) return null; let v = 1; const pts = []; b[key].forEach((r, k) => { if (!ok(r)) return; const kk = F.ymKey(b.s, k); if (kk < from) return; v *= 1 + r / 100; pts.push([F.ymX(b.s, k), v]); }); return { name, color, pts, end: v }; };
    const from = '1963-07';
    const ser = [grow('f3', 'MKT', from, 'Market minus T-bills', 'var(--s1)'), grow('f3', 'SMB', from, 'Small minus big (size)', 'var(--s2)'), grow('f3', 'HML', from, 'Cheap minus expensive (value)', 'var(--s3)'), grow('mom', 'MOM', from, 'Winners minus losers (momentum)', 'var(--s4)'), grow('f5', 'RMW', from, 'Profitable minus unprofitable', 'var(--s5)'), grow('f5', 'CMA', from, 'Conservative minus aggressive investment', 'var(--s7)')].filter(Boolean);
    const ch = C.line({ series: ser.map(s => ({ name: s.name, pts: s.pts.filter((_, k) => k % 2 === 0), color: s.color, width: 1.7 })), logY: true, h: 300, yFmt: v => '$' + num(v, v < 10 ? 1 : 0), tipFmt: v => '$' + num(v, 2), tipX: x => K.MON[Math.floor((x % 1) * 12)] + ' ' + Math.floor(x), aria: 'Factor returns since 1963' });
    const hml = ser.find(s => /value/.test(s.name));
    return U.card('Factor premiums since 1963', 'Growth of $1 in long-short US factor portfolios (excess of their short side; no costs). These are the building blocks behind "smart beta" funds.', ch + U.src(`Value (cheap minus expensive) grew $1 to $${num(hml.end, 1)} but suffered a long drawdown after 2007; premiums are real but can vanish for a decade. Source: Kenneth French data library (Tuck School of Business).`));
  }
  function view(st) {
    return `${U.sec('History', 'Nearly a century of market data: crashes and recoveries, normal volatility, and what diversification has looked like year by year.')}
      ${spxCard()}
      <div style="margin-top:14px">${intraCard(st)}</div>
      <div class="grid g-7-5" style="margin-top:14px">${rollingCard()}${bigDaysCard()}</div>
      <div style="margin-top:14px">${quiltCard()}</div>
      <div style="margin-top:14px">${monthCard(st)}</div>
      <div style="margin-top:14px">${factorCard()}</div>`;
  }

  /* ---------------- How it works ---------------- */
  function how() {
    const ms = F.ST || {}, src = ms.sources || {}, vm = FM.volModel(), bt = vm.backtest(), rg = FM.regime(), cp = FM.cape(), d10 = FM.risk('dd10'), ev = d10.evaluate(), tr = FM.trend(), ap = FM.appetite();
    const srcRows = Object.entries(src).map(([k, v]) => `<tr><td class="name">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');
    const val = [
      ['Volatility & VaR (GJR-GARCH)', `99% VaR breached on ${num(bt.rate1, 2)}% of days vs 1% expected (Kupiec p ${num(bt.k1.p, 2)}); no clustering (Christoffersen p ${num(bt.c1.p, 2)})`, 'Strong'],
      ['Market regimes (hidden Markov)', `Out of sample from ${rg.oosFrom.slice(0, 4)}: next-month volatility ${num(rg.fwd[0].vol, 0)}% / ${num(rg.fwd[1].vol, 0)}% / ${num(rg.fwd[2].vol, 0)}% by regime; returns not separated`, 'Useful for risk'],
      ['Expected returns (CAPE)', `Out-of-sample R² ${num(cp.r2oos, 2)} for 10-year real returns since 1940`, 'Useful'],
      ['Correction risk (logistic)', `AUC ${num(ev.auc, 2)}, Brier skill ${sgn(ev.bss * 100, 1, '%')} vs the base rate, 2000 onward`, 'Modest'],
      ['Trend rule (10-month average)', `Since ${tr.from.slice(0, 4)}: worst drawdown ${pct(tr.all.s.mdd, 0)} vs ${pct(tr.all.b.mdd, 0)}; return ${pct(tr.all.s.cagr, 1)} vs ${pct(tr.all.b.cagr, 1)} a year`, 'Historical'],
      ['Risk appetite gauge', `Next-3-month S&P 500 return ${FV.P(ap.bucket[0].r63, 1)} after extreme fear vs ${FV.P(ap.bucket[4].r63, 1)} after extreme greed (${ap.from.slice(0, 4)} onward)`, 'Descriptive']
    ].map(r => `<tr><td class="name">${esc(r[0])}</td><td class="wrap">${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('');
    return `${U.sec('How it works', 'Sources, methods, validation and limits. Everything on this page is computed in your browser from the data files listed here.')}
      <div class="grid g2">
        ${U.card('Data', `Refreshed automatically by a scheduled GitHub Actions job: weekday mornings, evenings, and several times during US trading hours (GitHub runs schedules on a best-effort basis, so refreshes can be late). Last refresh ${esc(K.isoLab((ms.fetched_at || '').slice(0, 10)))} (${esc(K.ago(ms.fetched_at || ''))}).`, `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Source</th><th>Status</th></tr></thead><tbody>${srcRows}</tbody></table></div><div class="prose sm" style="margin-top:10px"><ul><li><b>Yahoo Finance</b> (via the open-source yfinance library): daily history for 61 funds, indexes, futures and crypto since 1990 (S&P 500 since 1928). Fund prices are dividend-adjusted, so returns are total returns.</li><li><b>FRED</b>, Federal Reserve Bank of St. Louis: Treasury yields, TIPS, breakevens, policy rates, credit spreads, dollar, FX, oil, gas, financial-conditions indexes, CPI, recessions (NBER) and the Fed's Z.1 equity values.</li><li><b>Robert Shiller</b> (Yale): S&P 500 prices, dividends, earnings, CPI and CAPE monthly since 1871.</li><li><b>Kenneth French</b> data library (Dartmouth): US market and factor returns monthly since 1926.</li></ul></div>`)}
        ${U.card('Validation at a glance', 'Every forecast is scored on data it did not see when it was made.', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Model</th><th>Out-of-sample result</th><th>Verdict</th></tr></thead><tbody>${val}</tbody></table></div>`)}
      </div>
      <div class="grid g2" style="margin-top:14px">
        ${U.card('Methods', '', `<div class="prose sm">
          <h3>Regimes</h3><p>Three-state Gaussian hidden Markov model on weekly log returns of the S&P 500 since 1990, fitted by expectation-maximization (Baum-Welch) from three starting points. "Now" uses filtered probabilities (only past data); the history chart uses smoothed probabilities.</p>
          <div class="formula">r<sub>t</sub> | s<sub>t</sub>=k ~ N(μ<sub>k</sub>, σ<sub>k</sub>²),  P(s<sub>t</sub>=k | s<sub>t-1</sub>=j) = A<sub>jk</sub></div>
          <h3>Volatility and VaR</h3><p>GJR-GARCH(1,1) with variance targeting, fitted by quasi-maximum likelihood (Nelder-Mead). Value-at-risk uses filtered historical simulation: the empirical quantile of the model's standardized residuals times tomorrow's forecast volatility.</p>
          <div class="formula">σ²<sub>t+1</sub> = ω + (α + γ·1[r<sub>t</sub>&lt;0]) r²<sub>t</sub> + β σ²<sub>t</sub></div>
          <h3>Correction risk</h3><p>Logistic regression with an L2 (ridge) penalty, λ = 16 on standardized inputs: VIX (log), S&P 500 versus its 200-day average, 3-month change in the Baa credit spread, and log Shiller CAPE. Targets: a fall of 5% within 63 trading days, 10% within 126, 20% within 252, measured from each month-end close. Re-estimated every January; training stops where outcomes were not yet known.</p>
          <h3>Expected returns</h3><p>OLS of the next 10 years' annualized real total return (Shiller) on log CAPE, monthly since 1881. Ranges use out-of-sample errors because overlapping windows overstate in-sample fit. The lab's US stock assumption averages this model with the 1871-today real return.</p>
          <h3>Portfolio lab</h3><p>Volatilities and correlations from monthly fund returns since 2008, shrunk 20% toward the average correlation and repaired to be positive semi-definite. Efficient frontier by projected gradient ascent with a 60% cap per asset. Monte Carlo: 1,500 monthly paths with a variance-preserving normal mixture for fat tails. Shock scenarios use five-year weekly regressions on six factors with robust (HC1) errors.</p>
          <h3>Risk appetite</h3><p>Six readings (momentum, sector breadth, VIX versus its average, stocks versus Treasuries, junk versus Treasuries, position in the 52-week range), each ranked against its trailing two years, then averaged.</p></div>`)}
        ${U.card('Limits and glossary', '', `<div class="prose sm"><h3>What this cannot do</h3><ul><li>Forecast short-term market moves reliably. Every model here that tries shows modest skill at best, and says so.</li><li>Know your situation. Taxes, fees, debts and goals change the right answer.</li><li>Guarantee data. Free sources can be revised, delayed or missing; failed series keep their last good copy and are flagged in the status table.</li><li>Capture crises fully. Correlations and liquidity change in a panic; linear sensitivities understate tail moves.</li></ul>
          <h3>Glossary</h3><ul><li><b>Volatility</b>: standard deviation of returns, annualized. 16% means a typical year swings about ±16%.</li><li><b>Value-at-risk (VaR)</b>: a loss that should be exceeded only rarely (1 day in 100 at 99%). <b>Expected shortfall</b>: the average loss on those rare days.</li><li><b>Drawdown</b>: decline from the highest prior value.</li><li><b>Sharpe ratio</b>: return above cash per unit of volatility.</li><li><b>CAPE</b>: price divided by 10-year average inflation-adjusted earnings.</li><li><b>Breakeven inflation</b>: nominal Treasury yield minus TIPS yield, the market's inflation expectation.</li><li><b>AUC</b>: how well a model ranks risky months above safe ones (0.5 = coin flip). <b>Brier skill</b>: improvement in probability accuracy over the base rate.</li><li><b>Beta</b>: how much an asset moves when the S&P 500 moves 1%.</li></ul></div>`)}
      </div>
      <div class="callout" style="margin-top:14px"><b>Educational, not investment advice.</b> Built by Bruno Silva as part of Probable Atlas. Past performance does not guarantee future results.</div>`;
  }
  return { view, how };
})();
