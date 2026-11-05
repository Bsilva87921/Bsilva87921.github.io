/* =====================================================================
   Finance, Economics, Business: Market Mayhem, Money Math, Econ Shock, Pop-Up Tycoon, Break-Even
   ===================================================================== */
function normCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), dd = 0.3989423 * Math.exp(-z * z / 2);
  const p = dd * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
const signPct = (x, dec = 0) => (x > 0 ? '+' : x < 0 ? '−' : '') + fmt(Math.abs(x) * 100, dec) + '%';

/* ---------- Market Mayhem ---------- */
const ASSETS = [
  { id: 's', name: 'Stocks', sub: 'Index fund · ~9% a year on average, big swings', mu: 0.09, sd: 0.16, col: 'var(--d-math)' },
  { id: 'b', name: 'Bonds', sub: 'Government bonds · ~4% a year, smaller swings', mu: 0.04, sd: 0.06, col: 'var(--d-physics)' },
  { id: 'c', name: 'Cash', sub: 'Savings account · pays this year’s rate, never drops', mu: 0, sd: 0, col: 'var(--d-world)' },
  { id: 'k', name: 'Crypto', sub: 'Speculative · can double or crash in a year', mu: 0.10, sd: 0.6, col: 'var(--d-finance)' }
];
const NEWS = [
  { h: 'Calm year ahead: economists expect steady growth.', s: 0, b: 0, c: 0, k: 0, i: 0, why: 'Quiet years are common, and staying invested through them is how long-run returns build up.' },
  { h: 'Recession fears grow as shoppers cut back.', s: -0.12, b: 0.03, c: -0.005, k: -0.2, i: -0.01, why: 'In a slowdown, company profits fall and stocks often drop, while nervous investors buy safer bonds.' },
  { h: 'Tech boom! AI companies post record profits.', s: 0.08, b: 0, c: 0, k: 0.25, i: 0, why: 'Booms lift stocks. Speculative assets tend to swing even harder in both directions.' },
  { h: 'Inflation jumps to 7%. The central bank vows to raise rates.', s: -0.07, b: -0.09, c: 0.02, k: -0.2, i: 0.045, why: 'Rising rates push existing bond prices down and make future profits worth less today. Cash pays more, but inflation eats it.' },
  { h: 'The central bank cuts interest rates.', s: 0.06, b: 0.05, c: -0.015, k: 0.15, i: 0.005, why: 'Lower rates raise bond prices and make borrowing cheaper, which tends to help stocks. Savings accounts pay less.' },
  { h: 'Supply shock: factories shut and shipping stalls.', s: -0.1, b: 0.02, c: 0, k: -0.15, i: 0.02, why: 'Shortages raise costs and slow the economy, hurting stocks and pushing prices up.' },
  { h: 'A major crypto exchange collapses.', s: -0.02, b: 0.01, c: 0, k: -0.45, i: 0, why: 'Concentrated, speculative bets can lose most of their value fast. Diversified portfolios barely notice.' },
  { h: 'Strong earnings season beats expectations.', s: 0.07, b: 0, c: 0, k: 0.05, i: 0, why: 'Over the long run, stock prices follow company profits.' },
  { h: 'Oil prices spike after a production cut.', s: -0.05, b: -0.02, c: 0.005, k: -0.05, i: 0.02, why: 'Energy costs ripple through the economy, raising inflation and squeezing profits.' },
  { h: 'Crypto mania: everyone is talking about coins.', s: 0.02, b: 0, c: 0, k: 0.35, i: 0, why: 'Hype can push prices up fast and reverse just as fast. Chasing it is risky.' },
  { h: 'Bond rally as investors look for safety.', s: -0.02, b: 0.06, c: -0.005, k: -0.05, i: -0.005, why: 'When investors get nervous, demand for bonds rises, and so do bond prices.' },
  { h: 'Trade tensions rise between major economies.', s: -0.06, b: 0.02, c: 0, k: -0.05, i: 0.01, why: 'Tariffs and uncertainty raise costs and make companies cautious.' },
  { h: 'Productivity boom: new tools make workers faster.', s: 0.06, b: 0.01, c: 0, k: 0.05, i: -0.005, why: 'Higher productivity lets the economy grow without as much inflation.' }
];
function mkYears(r) {
  const order = r.shuffle(NEWS);
  return order.slice(0, 10).map(n => {
    const cash = clamp(0.03 + n.c, 0.002, 0.08);
    return {
      n, cash,
      ret: [clamp(r.normal(0.09 + n.s, 0.16), -0.5, 0.8), clamp(r.normal(0.04 + n.b, 0.06), -0.25, 0.3), cash, clamp(r.normal(0.10 + n.k, 0.6), -0.85, 3)],
      infl: clamp(0.025 + n.i + r.normal(0, 0.008), -0.01, 0.12)
    };
  });
}
function lineChart(series, opts = {}) {
  const Wd = 600, Ht = 190, padL = 58, padR = 14, padT = 14, padB = 26;
  const all = series.flatMap(s => s.v);
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 1) { hi += 1; lo -= 1; }
  const span = hi - lo; lo -= span * 0.08; hi += span * 0.08;
  const n = opts.n || 10;
  const X = i => padL + (Wd - padL - padR) * i / n, Y = v => padT + (Ht - padT - padB) * (1 - (v - lo) / (hi - lo));
  let s = `<svg viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="${esc(opts.label || 'Line chart')}">`;
  for (let k = 0; k <= 3; k++) { const v = lo + (hi - lo) * k / 3, y = Y(v); s += `<line x1="${padL}" x2="${Wd - padR}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${padL - 8}" y="${y + 3}" text-anchor="end">${money(v)}</text>`; }
  for (let i = 0; i <= n; i += 2) s += `<text x="${X(i)}" y="${Ht - 6}" text-anchor="middle">Yr ${i}</text>`;
  series.forEach(se => {
    if (!se.v.length) return;
    const pts = se.v.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    if (se.fill) s += `<polygon points="${X(0)},${Y(lo)} ${pts} ${X(se.v.length - 1)},${Y(lo)}" fill="${se.color}" opacity=".12"/>`;
    s += `<polyline points="${pts}" fill="none" stroke="${se.color}" stroke-width="${se.w || 2.5}" stroke-linejoin="round" stroke-linecap="round" ${se.dash ? `stroke-dasharray="${se.dash}"` : 'pathLength="1" class="draw glowline"'}/>`;
    const li = se.v.length - 1;
    s += `<circle cx="${X(li)}" cy="${Y(se.v[li])}" r="${se.w ? 3 : 4.5}" fill="${se.color}"/>`;
  });
  return s + '</svg>';
}
IMPL.market = {
  play(ctx) {
    const r = ctx.r, YEARS = mkYears(r), START = 10000, FEE = 0.01;
    let year = 0, value = START, shown = START, alloc = [5, 3, 2, 0], lastAlloc = alloc.slice(), fees = 0, phase = 'decide';
    const hist = [START], bench = { cash: [START], mix: [START], stocks: [START] }, real = [START];
    let inflIdx = 1, worst = 0, best = 0, cryptoSum = 0, cashSum = 0;
    const head = h('div', { class: 'mk-head' });
    const news = h('div', { class: 'news' });
    const allocEl = h('div', { class: 'alloc' });
    const chart = h('div', { class: 'chart panel' });
    const actBtn = h('button', { class: 'btn primary big', type: 'button', onclick: act }, 'Run the year');
    const note = h('p', { class: 'msg', 'aria-live': 'polite' });
    const resultBox = h('div', { class: 'stack' });
    ctx.body.append(h('div', { class: 'stack' }, h('div', { class: 'panel stack' }, head, news), allocEl, note, resultBox, h('div', { class: 'row center' }, actBtn), chart));
    const chips = () => alloc.reduce((a, b) => a + b, 0);
    function drawHead() {
      const chg = value / START - 1;
      head.innerHTML = '';
      const vb = h('b', null, money(shown));
      head.append(h('div', { class: 'mk-val' }, h('small', null, `Portfolio · year ${Math.min(year + 1, 10)} of 10`), vb),
        h('span', { class: 'mk-chg ' + (chg >= 0 ? 'up' : 'down') }, `${signPct(chg, 1)} since start`));
      ctx.hud('year', 'Year', `${Math.min(year + 1, 10)}/10`);
      ctx.hud('value', 'Value', fmtK(Math.round(value)));
      if (shown !== value) { const from = shown; countUp(vb, 1, f => money(from + (value - from) * f), 900); shown = value; }
    }
    function drawNews() {
      const Yr = YEARS[year];
      news.innerHTML = '';
      news.append(h('small', null, `Headline · year ${year + 1}`), h('p', null, Yr.n.h));
      news.classList.remove('flash'); void news.offsetWidth; news.classList.add('flash');
    }
    function drawAlloc(locked, Yr) {
      allocEl.innerHTML = '';
      ASSETS.forEach((A, i) => {
        const bar = h('div', { class: 'chipbar', 'aria-hidden': 'true' });
        for (let k = 0; k < 10; k++) bar.append(h('i', { class: k < alloc[i] ? 'on' : '' }));
        const sub = A.id === 'c' ? `Savings account · pays ${pct(YEARS[Math.min(year, 9)].cash, 1)} this year, never drops` : A.sub;
        const right = locked && Yr ? h('span', { class: 'ret ' + (Yr.ret[i] >= 0 ? 'up' : 'down') }, signPct(Yr.ret[i], 1))
          : h('div', { class: 'ctl' },
            h('button', { class: 'nudge', type: 'button', 'aria-label': `Less ${A.name}`, onclick: () => setChip(i, -1) }, '−'),
            h('b', null, alloc[i] * 10 + '%'),
            h('button', { class: 'nudge', type: 'button', 'aria-label': `More ${A.name}`, onclick: () => setChip(i, 1) }, '+'));
        const row = h('div', { class: 'asset', style: `--ac:${A.col}` }, h('div', { class: 'nm' }, A.name, h('small', null, sub)), right, bar);
        allocEl.append(row);
      });
      if (!locked) {
        const left = 10 - chips();
        note.className = 'msg' + (left ? ' bad' : '');
        note.textContent = left ? `Place ${left} more chip${left === 1 ? '' : 's'} (each is 10% of your money).` : feePreview();
        actBtn.disabled = left !== 0;
      }
    }
    function feePreview() {
      const moved = alloc.reduce((s, a, i) => s + Math.abs(a - lastAlloc[i]), 0) / 2 / 10;
      return moved > 0 ? `Changing your mix moves ${pct(moved)} of your money: fee ${money(value * moved * FEE)}.` : 'Same mix as last year: no fee.';
    }
    function setChip(i, dlt) {
      if (phase !== 'decide') return;
      if (dlt > 0 && chips() >= 10) { const j = alloc.findIndex((a, k) => k !== i && a > 0 && k === 2) >= 0 ? 2 : alloc.findIndex((a, k) => k !== i && a > 0); if (j < 0) return; alloc[j]--; }
      if (dlt < 0 && alloc[i] <= 0) return;
      alloc[i] = clamp(alloc[i] + dlt, 0, 10);
      SFX.click(); drawAlloc(false);
    }
    function drawChart() {
      chart.innerHTML = '';
      chart.append(h('div', { class: 'row spread' }, h('b', null, 'Portfolio value'), h('div', { class: 'legend-mini' }, h('span', null, h('i', { style: 'background:var(--accent)' }), 'You'), h('span', null, h('i', { style: 'background:var(--ink-2)' }), '60/40 portfolio'))),
        h('div', { html: lineChart([{ v: bench.mix, color: 'var(--ink-2)', dash: '5 5', w: 2 }, { v: hist, color: 'var(--accent)', fill: true }], { label: 'Your portfolio value by year compared with a 60/40 portfolio' }) }));
    }
    function act() {
      if (phase === 'decide') runYear(); else if (phase === 'result') nextYear();
    }
    function runYear() {
      if (chips() !== 10) return;
      const Yr = YEARS[year];
      const moved = alloc.reduce((s, a, i) => s + Math.abs(a - lastAlloc[i]), 0) / 2 / 10;
      const fee = year === 0 ? 0 : value * moved * FEE;
      fees += fee;
      const before = value - fee;
      const port = alloc.reduce((s, a, i) => s + a / 10 * Yr.ret[i], 0);
      value = Math.max(0, before * (1 + port));
      const yrChg = value / (before + fee) - 1;
      worst = Math.min(worst, yrChg); best = Math.max(best, yrChg);
      cryptoSum += alloc[3]; cashSum += alloc[2];
      lastAlloc = alloc.slice();
      hist.push(value);
      bench.cash.push(bench.cash[bench.cash.length - 1] * (1 + Yr.cash));
      bench.mix.push(bench.mix[bench.mix.length - 1] * (1 + 0.6 * Yr.ret[0] + 0.4 * Yr.ret[1]));
      bench.stocks.push(bench.stocks[bench.stocks.length - 1] * (1 + Yr.ret[0]));
      inflIdx *= 1 + Yr.infl;
      phase = 'result';
      SFX[yrChg >= 0 ? 'coin' : 'thud']();
      drawHead(); drawAlloc(true, Yr); drawChart();
      note.className = 'msg ' + (yrChg >= 0 ? 'good' : 'bad');
      note.textContent = `Your portfolio ${yrChg >= 0 ? 'gained' : 'lost'} ${signPct(yrChg, 1).replace(/^[+−]/, '')} this year${fee ? ` (after a ${money(fee)} fee)` : ''}. Inflation: ${pct(Yr.infl, 1)}.`;
      resultBox.innerHTML = '';
      resultBox.append(h('div', { class: 'coach' }, h('b', null, 'What happened'), Yr.n.why + ' Headlines shift the odds, but they never guarantee the outcome.'));
      actBtn.textContent = year >= 9 ? 'See final results' : 'Next year';
      actBtn.disabled = false;
    }
    function nextYear() {
      year++;
      if (year >= 10) return end();
      phase = 'decide'; resultBox.innerHTML = '';
      actBtn.textContent = 'Run the year';
      drawHead(); drawNews(); drawAlloc(false);
    }
    function end() {
      const realV = value / inflIdx, mix = bench.mix[10], cashB = bench.cash[10], stocksB = bench.stocks[10];
      const goals = [value > cashB, realV >= 12000, value >= mix];
      const stars = goals.filter(Boolean).length;
      let lesson;
      if (cryptoSum / 10 >= 3) lesson = `You kept about ${Math.round(cryptoSum)}% of your chips in crypto on average. Big speculative bets turn your result into a coin flip; small slices limit the damage.`;
      else if (cashSum / 10 >= 5) lesson = `Cash felt safe, but after ${pct(inflIdx - 1)} of total inflation its buying power barely grew. Over long periods, low-risk can quietly mean low growth.`;
      else if (fees > 250) lesson = `Changing your mix often cost ${money(fees)} in fees. Frequent trading is a hidden drag; steady, diversified portfolios avoid it.`;
      else lesson = 'A diversified mix you hold through good and bad years is hard to beat. Notice that the headlines often didn’t predict how the year turned out.';
      ctx.finish({
        score: Math.round(value), scoreLabel: 'Final portfolio', scoreText: money(value), stars, perf: stars / 3,
        badges: value >= mix ? ['investor'] : [],
        summary: [['After inflation', money(realV)], ['60/40 portfolio', money(mix)], ['All stocks', money(stocksB)], ['All cash', money(cashB)], ['Fees paid', money(fees)], ['Worst year', signPct(worst, 1)]],
        lesson: lesson + ` Goals: ${goals[0] ? '✓' : '✗'} beat cash · ${goals[1] ? '✓' : '✗'} $12,000+ after inflation · ${goals[2] ? '✓' : '✗'} beat 60/40. This is a simplified simulation for learning, not investment advice.`
      });
    }
    drawHead(); drawNews(); drawAlloc(false); drawChart();
  }
};

/* ---------- Money Math ---------- */
const FIN_CONCEPTS = [
  { q: 'What does diversification mean?', c: ['Spreading money across many investments to lower risk', 'Putting everything into the best-performing stock', 'Moving money between banks often', 'Only investing in your home country'], e: 'If one investment falls, the others cushion the blow.', t: 1 },
  { q: 'What is an index fund?', c: ['A fund that holds all the stocks in a market index', 'A fund run by a star stock picker', 'A type of savings account', 'A government bond'], e: 'Index funds track a market, like the S&P 500, usually at very low cost.', t: 1 },
  { q: 'Why is carrying a credit card balance expensive?', c: ['Interest compounds on the unpaid balance', 'Cards charge a fee on every swipe', 'Your balance grows with inflation', 'Banks double balances every year'], e: 'Card APRs are often above 20%, and interest is charged on top of interest.', t: 1 },
  { q: 'Owning a share of stock means you…', c: ['Own a small piece of the company', 'Lent money to the company', 'Work for the company', 'Get guaranteed interest'], e: 'Shareholders own part of the business and share in its profits and losses.', t: 1 },
  { q: 'Buying a bond means you…', c: ['Lend money to a government or company in return for interest', 'Own part of a company', 'Buy foreign currency', 'Insure your home'], e: 'A bond is a loan. The borrower pays interest and returns the money at the end.', t: 1 },
  { q: 'Money sits in a 0% account while inflation is 4%. What happens?', c: ['It loses about 4% of its buying power each year', 'It keeps its value', 'It gains 4%', 'It is taxed at 4%'], e: 'The dollar amount stays the same, but it buys less each year.', t: 1 },
  { q: 'Paying only the minimum on a credit card each month…', c: ['Can take years and cost far more in interest', 'Pays it off within a month', 'Is the fastest way to build credit', 'Avoids all interest'], e: 'Minimum payments mostly cover interest, so the balance shrinks very slowly.', t: 1 },
  { q: 'What is the biggest advantage of starting to invest young?', c: ['More years for compound growth', 'Lower taxes forever', 'Guaranteed returns', 'No risk at all'], e: 'Each year of growth builds on the last, so time is the most powerful ingredient.', t: 1 },
  { q: 'APY differs from APR because APY includes…', c: ['The effect of compounding', 'Only the bank’s fees', 'The inflation rate', 'Your credit score'], e: 'APY shows what you actually earn in a year once interest earns interest.', t: 2 },
  { q: 'Which matters most in a FICO credit score?', c: ['Paying bills on time', 'How much you earn', 'Your age', 'How many bank accounts you have'], e: 'Payment history is about 35% of a FICO score. Income isn’t part of it.', t: 2 },
  { q: 'An employer 401(k) match is best described as…', c: ['Extra money your employer adds when you contribute', 'A loan from your employer', 'A fee you pay your employer', 'A bonus for not saving'], e: 'If your employer matches 50% up to 6% of pay, not contributing leaves free money on the table.', t: 2 },
  { q: 'Your raise moves you into a higher tax bracket. What happens?', c: ['Only the income above the threshold is taxed at the higher rate', 'All of your income is taxed at the higher rate', 'Your take-home pay always falls', 'You stop paying the lower rates'], e: 'US income tax brackets are marginal, so a raise never lowers your take-home pay because of brackets.', t: 2 },
  { q: 'A fund’s expense ratio is…', c: ['Its yearly fee as a percent of your investment', 'Its return last year', 'Its share price', 'How many stocks it holds'], e: 'A 1% fee on $100,000 is $1,000 a year, every year, so low fees compound in your favor.', t: 2 },
  { q: 'In finance, liquidity means…', c: ['How quickly an asset can become cash without losing value', 'How risky an investment is', 'How much interest it pays', 'How big a company is'], e: 'Cash is perfectly liquid; a house is not.', t: 2 },
  { q: 'A bear market usually means prices have…', c: ['Fallen 20% or more from a recent high', 'Risen steadily for a year', 'Stayed flat', 'Dropped 1% in a day'], e: 'A bull market rises; a bear market falls 20% or more.', t: 2 },
  { q: 'Roth IRA contributions are made with…', c: ['Money you’ve already paid tax on', 'Pre-tax money', 'Only your employer’s money', 'Borrowed money'], e: 'Roth: pay tax now, and qualified withdrawals later are tax-free. Traditional: often a tax break now, taxed when withdrawn.', t: 3 },
  { q: 'Dollar-cost averaging means…', c: ['Investing a fixed amount on a regular schedule', 'Buying only after prices drop', 'Converting dollars to other currencies', 'Averaging your bank fees'], e: 'A fixed amount buys more shares when prices are low and fewer when they are high.', t: 3 }
];
function moneyQ(kind, q, ans, r, extras, dec, explain, fmtFn) {
  const f = fmtFn || (v => money(v, dec));
  return { kind, q, choices: [f(ans), ...nearNums(ans, r, extras, { dec }).map(f)], explain, key: q };
}
function moneyGen(d, r) {
  if (r.chance(0.3)) { const it = pickTiered(FIN_CONCEPTS, d, r); return { kind: 'Concept', q: it.q, choices: it.c, explain: it.e, key: it.q, wide: true }; }
  const types = [['rule72', 2], ['simple', 1.5], ['budget', 1.5], ['pctchg', 1.5], ['cc', 1.5]];
  if (d >= 3) types.push(['compound', 2], ['paycheck', 1], ['emergency', 1], ['real', 1.5]);
  if (d >= 5) types.push(['recover', 1.5], ['networth', 1]);
  const t = r.weighted(types);
  if (t === 'rule72') {
    const rate = r.pick([3, 4, 6, 8, 9, 12]), yrs = 72 / rate, exact = Math.log(2) / Math.log(1 + rate / 100);
    return { kind: 'Rule of 72', q: `Using the Rule of 72, about how many years does money take to double at <b>${rate}%</b> a year?`, choices: [yrs + ' years', ...nearNums(yrs, r, [yrs * 2, Math.round(yrs / 2), Math.round(100 / rate)]).map(v => v + ' years')], explain: `72 ÷ ${rate} = <b>${yrs} years</b>. (The exact answer is ${fmt(exact, 1)} years: the rule is a handy shortcut.)`, key: 'r72' + rate };
  }
  if (t === 'simple') {
    const P = r.pick([500, 800, 1200, 2000, 2500]), rate = r.pick([3, 4, 5, 6]), yrs = r.pick([2, 3, 4, 5]), I = P * rate / 100 * yrs;
    return moneyQ('Interest', `How much interest does <b>${money(P)}</b> earn at <b>${rate}%</b> simple interest over <b>${yrs} years</b>?`, I, r, [P * rate / 100, I + P, P * (1 + rate / 100) ** yrs - P], 0, `Simple interest = principal × rate × time = ${money(P)} × ${rate / 100} × ${yrs} = <b>${money(I)}</b>.`);
  }
  if (t === 'budget') {
    const T = r.pick([3000, 3600, 4000, 4800, 5200]), part = r.pick([['needs', 0.5], ['wants', 0.3], ['savings', 0.2]]);
    return moneyQ('Budgeting', `Using the 50/30/20 rule, how much of a <b>${money(T)}</b> monthly take-home pay goes to <b>${part[0]}</b>?`, T * part[1], r, [T * 0.5, T * 0.3, T * 0.2, T * 0.1], 0, `50/30/20 means 50% needs, 30% wants, 20% savings. ${part[1] * 100}% of ${money(T)} = <b>${money(T * part[1])}</b>.`);
  }
  if (t === 'pctchg') {
    const a = r.pick([40, 50, 80, 120, 200]), c = r.pick([-0.25, -0.2, -0.1, 0.1, 0.2, 0.25, 0.3, 0.5]), b = a * (1 + c);
    const f = v => signPct(v / 100, 0);
    return { kind: 'Percent change', q: `A stock goes from <b>${money(a)}</b> to <b>${money(b)}</b>. What is the percent change?`, choices: [f(c * 100), ...nearNums(c * 100, r, [Math.round((b - a) / b * 100), -c * 100, c * 50], { neg: true }).map(f)], explain: `Change ÷ starting value = ${money(b - a)} ÷ ${money(a)} = <b>${signPct(c)}</b>. Always divide by where you started.`, key: `pc${a}${c}` };
  }
  if (t === 'cc') {
    const B = r.pick([1000, 1500, 2000, 3000]), apr = r.pick([18, 24, 30]), m = B * apr / 100 / 12;
    return moneyQ('Credit cards', `Your credit card balance is <b>${money(B)}</b> at <b>${apr}% APR</b>. About how much interest is charged in one month?`, m, r, [B * apr / 100, B * apr / 100 / 52, m * 2], 0, `${apr}% a year ÷ 12 = ${apr / 12}% a month. ${money(B)} × ${apr / 12}% ≈ <b>${money(m)}</b>, every month the balance stays.`);
  }
  if (t === 'compound') {
    const P = r.pick([1000, 2000, 5000, 10000]), rate = r.pick([5, 10, 20]), n = r.pick([2, 3]), A = P * (1 + rate / 100) ** n;
    const dec = Math.abs(A - Math.round(A)) > 0.001 ? 2 : 0;
    return moneyQ('Compound interest', `You invest <b>${money(P)}</b> at <b>${rate}%</b> a year, compounded yearly. What is it worth after <b>${n} years</b>?`, A, r, [P * (1 + rate / 100 * n), P * (1 + rate / 100) ** (n + 1), P * rate / 100 * n], dec, `${money(P)} × ${(1 + rate / 100).toFixed(2)}${n === 2 ? '²' : '³'} = <b>${money(A, dec)}</b>. Simple interest would give only ${money(P * (1 + rate / 100 * n))}; the difference is interest earning interest.`);
  }
  if (t === 'paycheck') {
    const S = r.pick([39000, 52000, 65000, 78000]);
    return moneyQ('Paychecks', `You earn <b>${money(S)}</b> a year, paid every two weeks. What is each paycheck before taxes?`, S / 26, r, [S / 24, S / 12, S / 52], 0, `Every two weeks means 26 paychecks a year (not 24). ${money(S)} ÷ 26 = <b>${money(S / 26)}</b>.`);
  }
  if (t === 'emergency') {
    const E = r.pick([2000, 2500, 3200, 4000]), mo = r.pick([3, 6]);
    return moneyQ('Emergency fund', `Your essential expenses are <b>${money(E)}</b> a month. How big is a <b>${mo}-month</b> emergency fund?`, E * mo, r, [E * (mo + 3), E * 12, E * (mo === 3 ? 1 : 3)], 0, `${money(E)} × ${mo} = <b>${money(E * mo)}</b>. Many planners suggest 3 to 6 months of essential costs.`);
  }
  if (t === 'real') {
    const nom = r.pick([5, 6, 7, 8, 10]), inf = r.pick([2, 3, 4]);
    const f = v => v + '%';
    return { kind: 'Inflation', q: `Your investments earn <b>${nom}%</b> this year while inflation is <b>${inf}%</b>. Roughly what is your real return?`, choices: [f(nom - inf), ...nearNums(nom - inf, r, [nom + inf, nom, inf]).map(f)], explain: `Real return ≈ nominal return − inflation = ${nom}% − ${inf}% = <b>${nom - inf}%</b>. That’s the growth in what your money can actually buy.`, key: `re${nom}${inf}` };
  }
  if (t === 'recover') {
    const x = r.pick([10, 20, 25, 50, 75]), need = x / (100 - x) * 100;
    const f = v => fmt(v, v % 1 ? 1 : 0) + '%';
    return { kind: 'Losses', q: `An investment falls <b>${x}%</b>. What percent gain does it need to get back to even?`, choices: [f(need), ...nearNums(need, r, [x, x * 2, x / 2], { dec: 1 }).map(f)], explain: `After a ${x}% drop you have ${100 - x}% left. To grow ${100 - x} back to 100 you need ${100 - x} × (1 + g) = 100, so g = <b>${f(need)}</b>. Losses hurt more than equal gains help.`, key: 'rc' + x };
  }
  const sav = r.pick([3000, 5000, 8000]), car = r.pick([6000, 9000, 12000]), loan = r.pick([15000, 20000, 25000]), card = r.pick([1000, 2000]);
  const nw = sav + car - loan - card;
  return moneyQ('Net worth', `You have <b>${money(sav)}</b> in savings and a car worth <b>${money(car)}</b>. You owe <b>${money(loan)}</b> in student loans and <b>${money(card)}</b> on a credit card. What is your net worth?`, nw, r, [sav + car + loan + card, sav + car - loan, sav - loan - card], 0, `Net worth = assets − debts = ${money(sav + car)} − ${money(loan + card)} = <b>${money(nw)}</b>. Negative net worth is common early on and improves as debt is paid down.`);
}
QGEN.finance = moneyGen;
IMPL.money = {
  play(ctx) {
    runQuiz(ctx, { mode: 'classic', count: 10, perQ: 45, gen: moneyGen,
      lesson: 'Three ideas carry most of personal finance: compounding (time multiplies money), interest rates (they work for you when saving and against you when borrowing), and inflation (it quietly shrinks cash).' });
  }
};

/* ---------- Econ Shock ---------- */
const ECON = [
  { q: 'A frost destroys half of Florida’s orange crop. What happens to the price of orange juice?', c: ['It rises', 'It falls', 'It stays the same', 'It drops to zero'], e: 'Supply falls while demand stays the same, so the price rises.', t: 1 },
  { q: 'A big study says coffee is very good for you. What happens in the coffee market?', c: ['Demand rises, pushing the price up', 'Demand falls, pushing the price down', 'Supply rises, pushing the price down', 'Nothing changes'], e: 'Tastes shift toward coffee, so demand rises. With supply unchanged, the price goes up.', t: 1 },
  { q: 'Hot dog prices jump. What likely happens to sales of hot dog buns?', c: ['They fall', 'They rise', 'They stay the same', 'Bun prices double'], e: 'Hot dogs and buns are complements: they’re used together, so when one gets pricier people buy less of both.', t: 1 },
  { q: 'Coffee prices soar. What likely happens to the demand for tea?', c: ['It rises', 'It falls', 'It stays the same', 'Tea stops being sold'], e: 'Tea is a substitute for coffee, so some people switch.', t: 1 },
  { q: 'You can work a shift that pays $80 or go to a free concert. What is the opportunity cost of the concert?', c: ['The $80 you give up', 'Nothing, because it’s free', 'Only your travel time', 'The price of a ticket'], e: 'Opportunity cost is the value of the best option you give up. A “free” concert still costs you $80 of wages.', t: 1 },
  { q: 'New technology makes TVs much cheaper to build. What happens to TV prices?', c: ['They fall', 'They rise', 'They stay the same', 'TVs stop being made'], e: 'Lower costs increase supply, and more TVs at every price push the price down.', t: 1 },
  { q: 'Concert tickets sell out in minutes and resell for triple the price. What does that suggest?', c: ['The original price was below what many fans would pay', 'The concert was overpriced', 'Few people wanted to go', 'Resellers set the original price'], e: 'A shortage at the official price means demand was bigger than supply at that price.', t: 1 },
  { q: 'What is inflation?', c: ['A general rise in prices across the economy over time', 'A rise in one product’s price', 'Growth in population', 'A fall in stock prices'], e: 'Inflation means a dollar buys less than before, across most goods and services.', t: 1 },
  { q: 'GDP measures…', c: ['The total value of goods and services a country produces', 'A country’s total savings', 'The government’s budget', 'Only a country’s exports'], e: 'Gross domestic product adds up the market value of everything produced in a period.', t: 1 },
  { q: 'Why can’t a country simply print lots of money to make everyone rich?', c: ['More money chasing the same goods mostly pushes prices up', 'Printing is too expensive', 'Banks won’t accept new money', 'It would make money illegal'], e: 'If the amount of real stuff doesn’t grow, extra money mainly bids up prices: inflation.', t: 1 },
  { q: 'The central bank raises interest rates. What usually happens to borrowing?', c: ['It falls, because loans cost more', 'It rises', 'It is banned', 'It doesn’t change'], e: 'Higher rates make mortgages and business loans pricier, which cools spending and inflation.', t: 2 },
  { q: 'A city caps rent below the market price. In the basic supply-and-demand model, what happens?', c: ['A shortage of apartments', 'A surplus of apartments', 'Rents rise', 'Nothing changes'], e: 'A price ceiling below equilibrium means more people want apartments than landlords offer.', t: 2 },
  { q: 'The government guarantees dairy farmers a minimum milk price above the market price. What happens?', c: ['A surplus of milk', 'A shortage of milk', 'Milk prices fall', 'Nothing changes'], e: 'A price floor above equilibrium means more is supplied than buyers want: a surplus.', t: 2 },
  { q: 'Gas prices double, but people barely cut back on driving to work. Demand for gas is…', c: ['Inelastic', 'Elastic', 'Perfectly elastic', 'Zero'], e: 'Inelastic demand hardly responds to price, usually because there are few substitutes in the short run.', t: 2 },
  { q: 'A factory pollutes a river and hurts downstream fishers, who aren’t paid for it. This is…', c: ['A negative externality', 'A public good', 'A subsidy', 'Comparative advantage'], e: 'An externality is a cost (or benefit) that falls on people outside the deal.', t: 2 },
  { q: 'Why do governments, rather than companies, usually provide street lights?', c: ['It’s hard to charge users, and one person’s use doesn’t reduce another’s', 'Companies aren’t allowed to sell lights', 'Lights are too cheap to sell', 'Nobody wants street lights'], e: 'Street lights are a public good: non-excludable and non-rival, so markets tend to under-provide them.', t: 2 },
  { q: 'The US dollar gets stronger against the euro. What happens for Americans?', c: ['European goods and trips get cheaper', 'European goods get more expensive', 'Nothing changes', 'US exports get cheaper for Europeans'], e: 'A stronger dollar buys more euros. The flip side: US exports get pricier for Europeans.', t: 2 },
  { q: 'A country adds a 25% tariff on imported steel. Who pays more for steel in the short run?', c: ['Domestic buyers of steel', 'Only foreign governments', 'Nobody', 'Only foreign steel makers'], e: 'Tariffs raise the price of imports, and domestic producers can raise prices too, so local buyers pay more.', t: 2 },
  { q: 'An almost-empty theater has the same costs whether 10 or 100 people come. Selling one more ticket mostly adds…', c: ['Profit, since the marginal cost is near zero', 'Big new costs', 'Nothing at all', 'A loss'], e: 'Marginal cost is the cost of one more unit. For an empty seat it’s close to zero.', t: 2 },
  { q: 'You bought a non-refundable ticket but now feel sick. A rational decision ignores…', c: ['The ticket price, because it’s a sunk cost', 'How sick you feel', 'The weather', 'What else you could do instead'], e: 'Money already spent and unrecoverable shouldn’t drive future choices.', t: 2 },
  { q: 'Prices rise 5% this year but your pay rises 3%. Your real wage…', c: ['Falls about 2%', 'Rises 3%', 'Rises 8%', 'Stays the same'], e: 'Real wages adjust for prices: 3% − 5% ≈ −2% in buying power.', t: 2 },
  { q: 'A factory’s cost per unit falls as it produces more. This is called…', c: ['Economies of scale', 'Diminishing returns', 'Price elasticity', 'Deflation'], e: 'Fixed costs get spread over more units, and bulk buying lowers costs.', t: 2 },
  { q: 'The government cuts taxes during a recession. What is the goal?', c: ['Boost spending and demand', 'Shrink GDP', 'Raise interest rates', 'Reduce the money supply'], e: 'This is fiscal policy: more money in people’s pockets supports spending.', t: 2 },
  { q: 'Ride apps raise prices when demand spikes. Economically, this…', c: ['Draws more drivers out and gives rides to those who value them most', 'Creates a shortage', 'Reduces the number of drivers', 'Has no effect on drivers'], e: 'Higher prices increase quantity supplied and ration the limited rides.', t: 2 },
  { q: 'Country A makes cloth at a lower opportunity cost; Country B makes wine at a lower opportunity cost. What does comparative advantage suggest?', c: ['Each specializes and trades, so both can consume more', 'A should make everything', 'B should stop trading', 'Neither should trade'], e: 'Specializing in what you give up least to produce makes total output bigger.', t: 3 },
  { q: 'Two rival stores would both earn more by keeping prices high, but each is tempted to undercut. This is…', c: ['A prisoner’s dilemma', 'A monopoly', 'A public good', 'An externality'], e: 'Each acting in its own interest leaves both worse off: a classic game theory trap.', t: 3 },
  { q: 'After getting full insurance, someone drives less carefully. Economists call this…', c: ['Moral hazard', 'Adverse selection', 'Inflation', 'Arbitrage'], e: 'When you’re protected from the cost of risk, you may take more of it.', t: 3 },
  { q: 'If buying insurance were optional, mostly sick people might sign up. This is…', c: ['Adverse selection', 'Moral hazard', 'A price ceiling', 'Comparative advantage'], e: 'When buyers know more about their risk than sellers, the riskiest buyers are the most eager.', t: 3 },
  { q: 'Your first slice of pizza is amazing; your fifth, much less so. This is…', c: ['Diminishing marginal utility', 'Inflation', 'Economies of scale', 'Opportunity cost'], e: 'Each extra unit tends to add less satisfaction than the one before.', t: 3 },
  { q: 'Why might a central bank worry about deflation (falling prices)?', c: ['People delay spending while waiting for lower prices, slowing the economy', 'Falling prices always create jobs', 'It makes debts easier to repay', 'It never causes problems'], e: 'Deflation also makes existing debts heavier, since dollars become worth more.', t: 3 },
  { q: 'A town has just one bakery. Compared with a competitive market, it can…', c: ['Charge higher prices and sell less', 'Charge any price without losing customers', 'Never make a profit', 'Only charge its costs'], e: 'A monopoly faces the whole demand curve. Higher prices lose some customers but can still raise profit.', t: 3 },
  { q: 'Your income rises and you buy fewer instant noodles. Instant noodles are…', c: ['An inferior good', 'A normal good', 'A luxury good', 'A public good'], e: 'Demand for an inferior good falls as income rises because people switch to options they prefer.', t: 3 },
  { q: 'Share prices often move within seconds of public news. This suggests…', c: ['Markets quickly price in public information', 'Everyone has secret information', 'News never matters', 'Prices are set by the government'], e: 'Because information spreads fast, it’s very hard to profit from news everyone can see.', t: 3 }
];
function econGen(d, r) { const it = pickTiered(ECON, d, r); return { kind: 'Scenario', q: it.q, choices: it.c, explain: it.e, key: it.q, wide: true }; }
QGEN.econ = econGen;
IMPL.econ = {
  play(ctx) {
    runQuiz(ctx, { mode: 'classic', count: 10, perQ: 40, gen: econGen,
      lesson: 'For any market shock, ask two questions: did it change supply (sellers) or demand (buyers)? And which way? Price and quantity follow from the answer.' });
  }
};

/* ---------- Pop-Up Tycoon ---------- */
const TY_WEATHER = [
  { name: 'Scorching', temp: '35 °C / 95 °F', traffic: 1.35, mu: 2.6 },
  { name: 'Sunny', temp: '28 °C / 82 °F', traffic: 1.15, mu: 2.2 },
  { name: 'Cloudy', temp: '21 °C / 70 °F', traffic: 0.85, mu: 1.8 },
  { name: 'Rainy', temp: '16 °C / 61 °F', traffic: 0.45, mu: 1.4 }
];
const TY_EVENTS = [
  { name: 'Street festival nearby', note: 'Big crowds expected.', traffic: 1.7, mu: 0 },
  { name: 'A competitor opened across the street', note: 'Shoppers have another option.', traffic: 1, mu: -0.35 },
  { name: 'A local influencer posted about you', note: 'Curious new customers are coming.', traffic: 1.35, mu: 0.1 },
  { name: 'Road work blocks the sidewalk', note: 'Fewer people walking by.', traffic: 0.6, mu: 0 },
  { name: 'School is out for summer', note: 'Families everywhere, on a budget.', traffic: 1.3, mu: -0.1 }
];
const TY = { cost: 0.45, rent: 8, base: 110, sd: 0.7, days: 7, start: 50, stars: [0.3, 0.55, 0.75], mogul: 0.82 };
function tyPlan(r) {
  const plan = [];
  let wi = r.int(0, 2);
  for (let i = 0; i < TY.days; i++) {
    if (i) wi = clamp(wi + r.pick([-1, 0, 0, 1]), 0, 3);
    const actual = r.chance(0.75) ? wi : clamp(wi + r.pick([-1, 1]), 0, 3);
    plan.push({ fc: wi, actual, ev: r.chance(0.3) ? r.pick(TY_EVENTS) : null, n1: r.normal(0, 0.06), n2: r.normal(0, 0.05) });
  }
  return plan;
}
function tyBestPrice(mu) {
  let best = { p: 0.5, v: -1 };
  for (let p = 0.5; p <= 4.0001; p += 0.25) { const v = (p - TY.cost) * (1 - normCdf((p - mu) / TY.sd)); if (v > best.v) best = { p: Math.round(p * 100) / 100, v }; }
  return best.p;
}
function tyDay(day, price, cups, ads, rep) {
  const W = TY_WEATHER[day.actual];
  const adMult = ads >= 25 ? 1.45 : ads >= 10 ? 1.22 : 1;
  const traffic = Math.max(0, Math.round(TY.base * W.traffic * (day.ev ? day.ev.traffic : 1) * adMult * rep * (1 + day.n1)));
  const mu = W.mu + (day.ev ? day.ev.mu : 0);
  const pBuy = 1 - normCdf((price - mu) / TY.sd);
  const wanted = Math.max(0, Math.round(traffic * pBuy * (1 + day.n2)));
  const sold = Math.min(wanted, cups), lost = wanted - sold, unsold = cups - sold;
  const revenue = sold * price, cupCost = cups * TY.cost, profit = revenue - cupCost - TY.rent - ads;
  return { W, traffic, wanted, sold, lost, unsold, revenue, cupCost, profit, mu, pBuy, bestP: tyBestPrice(mu), soldOutAt: lost > 0 ? sold / wanted : null };
}
function tyPar(plan) {
  let rep = 1, cash = TY.start, total = 0;
  for (const D of plan) {
    if (cash < TY.rent + TY.cost * 10) break;
    const W = TY_WEATHER[D.actual], p = tyBestPrice(W.mu + (D.ev ? D.ev.mu : 0));
    let best = null;
    for (const ads of [0, 10, 25]) {
      const maxC = Math.max(0, Math.min(400, Math.floor((cash - TY.rent - ads) / TY.cost / 5) * 5));
      const cups = Math.min(maxC, Math.ceil(tyDay(D, p, 400, ads, rep).wanted / 5) * 5);
      const o = tyDay(D, p, cups, ads, rep);
      if (!best || o.profit > best.o.profit) best = { o, ads };
    }
    total += best.o.profit; cash += best.o.profit; rep = tyRep(rep, best.o, p, best.ads);
  }
  return total;
}
function tyRep(rep, o, price, ads) {
  let d = 0;
  if (o.wanted && o.lost > 0.15 * o.wanted) d -= 0.04;
  if (price <= o.mu - 0.3) d += 0.03; else if (price >= o.mu + 0.6) d -= 0.03;
  d += ads >= 25 ? 0.02 : ads >= 10 ? 0.01 : 0;
  return clamp(rep + d, 0.8, 1.25);
}
function tyCoach(o, price, cups) {
  const w = o.W.name.toLowerCase();
  if (o.wanted && o.lost > 0.1 * o.wanted) return `You sold out${o.soldOutAt != null ? ` around ${tyClock(o.soldOutAt)}` : ''} and ${o.lost} customers left empty-handed. On a ${w} day, make more cups${price < o.bestP ? ' or raise your price' : ''}.`;
  if (cups && o.unsold > 0.25 * cups) return `${o.unsold} cups were poured out: ${money(o.unsold * TY.cost, 2)} of wasted ingredients. Make fewer on ${w} days.`;
  if (price < o.bestP - 0.4) return `Customers would have paid more. The sweet spot today was about ${money(o.bestP, 2)}: slightly fewer sales, but more profit per cup.`;
  if (price > o.bestP + 0.4) return `Only ${pct(o.pBuy)} of passers-by bought. A price near ${money(o.bestP, 2)} would have sold far more.`;
  return `Nicely balanced: your price and stock were close to ideal for a ${w} day.`;
}
function tyClock(frac) { const mins = Math.round(9 * 60 + frac * 8 * 60); const hh = Math.floor(mins / 60), mm = mins % 60; return `${hh > 12 ? hh - 12 : hh}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`; }
IMPL.tycoon = {
  play(ctx) {
    const r = ctx.r, plan = tyPlan(r), par = Math.max(50, tyPar(plan));
    let day = 0, cash = TY.start, rep = 1, price = 1.5, cups = 100, ads = 0, totalSold = 0, wasted = 0, lostTotal = 0, bestDay = -Infinity, phase = 'plan';
    const top = h('div', { class: 'ty-grid' });
    const fc = h('div', { class: 'news' });
    const ctrls = h('div', { class: 'stack' });
    const costLine = h('p', { class: 'cost-line' });
    const street = h('div', { class: 'street', 'aria-hidden': 'true' });
    function paintStreet(wi) {
      street.innerHTML = ''; street.dataset.wx = String(wi);
      if (wi <= 1) street.append(h('div', { class: 'sun' }));
      if (wi >= 1) street.append(h('div', { class: 'cloud' }), h('div', { class: 'cloud c2' }));
      if (wi === 3) street.append(h('div', { class: 'rain' }));
      street.append(h('div', { class: 'ground' }), h('div', { class: 'stand' }, 'LEMONADE'));
    }
    const report = h('div', { class: 'stack' });
    const btn = h('button', { class: 'btn primary big', type: 'button', onclick: act }, 'Open the stand');
    ctx.body.append(h('div', { class: 'stack' }, h('div', { class: 'panel stack' }, top, fc), ctrls, costLine, street, report, h('div', { class: 'row center' }, btn)));
    const maxCups = () => Math.max(0, Math.min(400, Math.floor((cash - TY.rent - ads) / TY.cost / 5) * 5));
    function drawTop() {
      top.innerHTML = '';
      [['Day', `${Math.min(day + 1, TY.days)} of ${TY.days}`], ['Cash', money(cash, 2)], ['Reputation', `${Math.round(rep * 100)}%`]].forEach(([k, v]) => top.append(h('div', null, h('small', null, k), h('b', null, v))));
      ctx.hud('day', 'Day', `${Math.min(day + 1, TY.days)}/${TY.days}`);
      ctx.hud('profit', 'Profit', money(cash - TY.start));
    }
    function drawForecast() {
      const D = plan[day], W = TY_WEATHER[D.fc];
      fc.innerHTML = '';
      paintStreet(D.fc);
      fc.append(...[h('small', null, `Forecast · day ${day + 1}`), h('p', null, `${W.name}, ${W.temp}`), D.ev ? h('p', { style: 'font-weight:400;font-size:15px;margin-top:6px' }, h('b', null, D.ev.name + '. '), D.ev.note) : null].filter(Boolean));
    }
    function slider(label, id, min, max, step, val, fmtv, onv, stepBtn) {
      const inp = h('input', { type: 'range', id, min: String(min), max: String(max), step: String(step), value: String(val) });
      const out = h('b', null, fmtv(val));
      const set = v => { v = clamp(Math.round(v / step) * step, min, max); inp.value = String(v); out.textContent = fmtv(v); onv(v); preview(); };
      inp.addEventListener('input', () => set(+inp.value));
      return h('div', { class: 'slider' }, h('label', { for: id }, label, out), h('div', { class: 'row' },
        h('button', { class: 'nudge', type: 'button', 'aria-label': 'Less', onclick: () => set(+inp.value - stepBtn) }, '−'), inp,
        h('button', { class: 'nudge', type: 'button', 'aria-label': 'More', onclick: () => set(+inp.value + stepBtn) }, '+')));
    }
    function drawCtrls() {
      ctrls.innerHTML = '';
      cups = Math.min(cups, maxCups());
      const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Advertising' });
      [[0, 'No ads'], [10, 'Flyers $10'], [25, 'Social $25']].forEach(([v, l]) => seg.append(h('button', { type: 'button', 'aria-pressed': String(ads === v), onclick: () => { ads = v; cups = Math.min(cups, maxCups()); drawCtrls(); preview(); } }, l)));
      ctrls.append(h('div', { class: 'pl-ctrls' },
        slider('Price per cup', 'tyPrice', 0.5, 4, 0.25, price, v => money(v, 2), v => { price = v; }, 0.25),
        slider(`Cups to make (max ${maxCups()})`, 'tyCups', 0, Math.max(5, maxCups()), 5, cups, v => `${v} cups`, v => { cups = Math.min(v, maxCups()); }, 5)),
        h('div', { class: 'stack', style: 'gap:6px' }, h('b', { style: 'font-size:14px' }, 'Advertising'), seg));
      preview();
    }
    function preview() {
      const cost = cups * TY.cost + TY.rent + ads;
      const be = price > 0 ? Math.ceil(cost / price) : 0;
      costLine.innerHTML = `Today’s costs: cups ${money(cups * TY.cost, 2)} + permit ${money(TY.rent, 2)} + ads ${money(ads, 2)} = <b>${money(cost, 2)}</b> · Break-even: <b>${be} cups</b> sold at ${money(price, 2)}` + (be > cups ? ' (more than you’re making!)' : '');
      btn.disabled = phase === 'plan' && cash < TY.rent + ads;
    }
    function act() { if (phase === 'plan') openDay(); else if (phase === 'report') nextDay(); }
    function openDay() {
      if (cups > maxCups()) cups = maxCups();
      phase = 'sim'; btn.disabled = true;
      const D = plan[day], o = tyDay(D, price, cups, ads, rep);
      cash += o.profit; totalSold += o.sold; wasted += o.unsold; lostTotal += o.lost; bestDay = Math.max(bestDay, o.profit);
      rep = tyRep(rep, o, price, ads);
      ctrls.innerHTML = ''; costLine.textContent = '';
      animateDay(o, () => showReport(D, o));
    }
    function animateDay(o, done) {
      paintStreet(TY_WEATHER.indexOf(o.W));
      let coinsShown = 0;
      const clock = h('div', { class: 'clock' }, '9:00 AM'), counts = h('div', { class: 'counts' });
      street.append(clock, counts);
      const N = Math.min(26, Math.max(6, Math.round(o.traffic / 6)));
      const buyers = Math.round(N * o.sold / Math.max(1, o.traffic)), missers = Math.round(N * o.lost / Math.max(1, o.traffic));
      const kinds = r.shuffle([...Array(N)].map((_, i) => i < buyers ? 'buy' : i < buyers + missers ? 'miss' : ''));
      const dur = reduceMotion() ? 300 : 2600, t0 = performance.now();
      kinds.forEach((k, i) => ctx.timeout(() => {
        const w = h('div', { class: 'walker ' + k, style: `left:-14px;transition:transform ${Math.round(dur * 0.55)}ms linear` });
        street.append(w);
        requestAnimationFrame(() => { w.style.transform = `translateX(${street.clientWidth + 20}px)`; });
        ctx.timeout(() => w.remove(), dur * 0.6);
      }, (i / N) * dur * 0.5));
      const tick = () => {
        const f = Math.min(1, (performance.now() - t0) / dur);
        clock.textContent = tyClock(f);
        counts.innerHTML = `Walked by: ${Math.round(o.traffic * f)}<br>Sold: ${Math.round(o.sold * f)}${o.lost ? `<br>Turned away: ${Math.round(o.lost * f)}` : ''}`;
        const coinsDue = Math.floor(Math.round(o.sold * f) / Math.max(1, Math.ceil(o.sold / 12)));
        while (coinsShown < coinsDue && !reduceMotion()) { coinsShown++; const cn = h('div', { class: 'coin', style: `margin-left:${Math.round((Math.random() - 0.5) * 70)}px` }, '+$'); street.append(cn); ctx.timeout(() => cn.remove(), 950); }
        if (f < 1) ctx.timeout(tick, 60); else done();
      };
      tick();
    }
    function showReport(D, o) {
      phase = 'report';
      SFX[o.profit >= 0 ? 'coin' : 'thud']();
      drawTop();
      const surprise = D.fc !== D.actual ? `The forecast said ${TY_WEATHER[D.fc].name.toLowerCase()}, but it turned out ${o.W.name.toLowerCase()}. ` : '';
      report.innerHTML = '';
      report.append(h('div', { class: 'panel' },
        h('p', { class: 'eyebrow' }, `Day ${day + 1} report · ${o.W.name}`),
        h('p', { style: 'margin:6px 0 10px' }, `${surprise}${o.traffic} people walked by, ${o.wanted} wanted lemonade, and you sold ${o.sold}${o.soldOutAt != null ? `, selling out around ${tyClock(o.soldOutAt)}` : ''}.`),
        h('table', { class: 'pl-table' }, h('tbody', null,
          h('tr', null, h('td', null, `Revenue (${o.sold} × ${money(price, 2)})`), h('td', null, money(o.revenue, 2))),
          h('tr', null, h('td', null, `Cups made (${cups} × ${money(TY.cost, 2)})`), h('td', null, '−' + money(o.cupCost, 2))),
          h('tr', null, h('td', null, 'Permit'), h('td', null, '−' + money(TY.rent, 2))),
          h('tr', null, h('td', null, 'Advertising'), h('td', null, '−' + money(ads, 2))),
          h('tr', { class: 'total' }, h('td', null, 'Profit'), h('td', { class: o.profit >= 0 ? 'up' : 'down' }, money(o.profit, 2)))))),
        h('div', { class: 'coach' }, h('b', null, 'Coach'), tyCoach(o, price, cups)));
      btn.textContent = day >= TY.days - 1 ? 'See final results' : 'Next day';
      btn.disabled = false;
      $$('.walker,.clock,.counts', street).forEach(e => e.remove());
    }
    function nextDay() {
      day++;
      if (day >= TY.days || cash < TY.rent + TY.cost * 10) return end(day < TY.days);
      phase = 'plan'; report.innerHTML = ''; btn.textContent = 'Open the stand';
      drawTop(); drawForecast(); drawCtrls();
    }
    function end(broke) {
      const profit = cash - TY.start, ratio = profit / par, t = TY.stars;
      const stars = (ratio >= t[0]) + (ratio >= t[1]) + (ratio >= t[2]);
      ctx.finish({
        score: Math.max(0, Math.round(profit)), scoreLabel: 'Total profit', scoreText: money(profit, 2), stars, perf: clamp(ratio, 0, 1),
        badges: ratio >= TY.mogul ? ['tycoon'] : [],
        summary: [['Par this week', money(par)], ['You reached', pct(Math.max(0, ratio))], ['Cups sold', fmt(totalSold)], ['Cups wasted', fmt(wasted)], ['Turned away', fmt(lostTotal)], ['Stars at', '30% · 55% · 75% of par']],
        lesson: (broke ? 'You ran low on cash before the week ended: cash flow keeps a business alive. ' : '') + 'Par is what a planner with a perfect forecast would have earned this week. Profit = (price − cost per cup) × cups sold − fixed costs, so the best price balances margin against volume, and the best stock level balances waste against lost sales.'
      });
    }
    drawTop(); drawForecast(); drawCtrls();
  }
};

/* ---------- Break-Even ---------- */
const BIZ_CONCEPTS = [
  { q: 'Which of these is a fixed cost for a bakery?', c: ['Monthly rent', 'Flour', 'Paper bags per sale', 'Card fees per sale'], e: 'Fixed costs stay the same whether you sell 10 loaves or 1,000. Variable costs grow with each sale.', t: 1 },
  { q: 'A business can be profitable and still run out of money because…', c: ['Cash may arrive later than bills are due', 'Profit is always fake', 'Taxes are paid daily', 'Banks hold all profits'], e: 'If customers pay in 60 days but suppliers want payment in 30, profit on paper doesn’t pay today’s bills. Cash flow matters.', t: 2 },
  { q: 'A minimum viable product (MVP) is…', c: ['The simplest version that lets you learn from real customers', 'The final, perfect product', 'The cheapest product on the market', 'A product with every feature'], e: 'Launch small, learn fast, then improve.', t: 1 },
  { q: 'Gross profit is revenue minus…', c: ['The direct cost of the goods sold', 'All expenses including taxes', 'Only rent', 'Only salaries'], e: 'Gross profit subtracts cost of goods sold. Net profit subtracts every expense.', t: 2 },
  { q: 'Raising money by selling shares of your company is…', c: ['Equity financing', 'Debt financing', 'A grant', 'Revenue'], e: 'Equity gives investors ownership. Debt must be repaid with interest but keeps ownership with you.', t: 2 },
  { q: 'A competitive advantage is…', c: ['Something that lets you serve customers better or cheaper than rivals', 'Having more employees than rivals', 'Being the newest company', 'Spending the most on ads'], e: 'Examples: lower costs, a strong brand, a patent, or a network that grows more valuable with users.', t: 1 },
  { q: 'Market segmentation means…', c: ['Dividing customers into groups with similar needs', 'Splitting a company in two', 'Selling only online', 'Lowering prices for everyone'], e: 'Different groups (students, families, businesses) often want different products, prices and messages.', t: 2 },
  { q: 'A startup’s burn rate is…', c: ['How much more cash it spends than it earns each month', 'How fast it hires', 'Its yearly revenue', 'Its tax rate'], e: 'Runway = cash in the bank ÷ monthly burn.', t: 2 },
  { q: 'Accounts receivable is…', c: ['Money customers owe the business', 'Money the business owes suppliers', 'Cash in the bank', 'The owner’s salary'], e: 'Receivables become cash only when customers actually pay.', t: 3 },
  { q: 'A business “pivots” when it…', c: ['Changes strategy based on what it learned', 'Shuts down', 'Doubles its prices', 'Hires a new CEO'], e: 'Many famous products started as something else and pivoted after listening to customers.', t: 3 },
  { q: 'A KPI is…', c: ['A key performance indicator: a number that tracks progress toward a goal', 'A type of business loan', 'A tax form', 'A legal contract'], e: 'Good KPIs are specific, measurable and tied to what matters, like retention or margin.', t: 1 }
];
function bizGen(d, r) {
  if (r.chance(0.25)) { const it = pickTiered(BIZ_CONCEPTS, d, r); return { kind: 'Concept', q: it.q, choices: it.c, explain: it.e, key: it.q, wide: true }; }
  const types = [['profit', 2], ['margin', 2], ['breakeven', 2], ['funnel', 1.5]];
  if (d >= 3) types.push(['markup', 1.5], ['roi', 1.5], ['runway', 1.5]);
  if (d >= 5) types.push(['ltv', 1.5], ['payback', 1.5], ['pricechg', 1.5]);
  const t = r.weighted(types);
  const pctF = v => fmt(v, v % 1 ? 1 : 0) + '%';
  if (t === 'profit') {
    const p = r.pick([5, 8, 10, 12, 15, 20]), c = r.int(1, Math.floor(p / 2)), q = r.pick([100, 200, 250, 400, 500]), F = r.pick([300, 500, 800, 1000]);
    const pr = q * (p - c) - F;
    return moneyQ('Profit', `You sell <b>${q}</b> items at <b>${money(p)}</b> each. Each costs <b>${money(c)}</b> to make, and fixed costs are <b>${money(F)}</b>. What is your profit?`, pr, r, [q * p - F, q * (p - c), q * p], 0, `Profit = units × (price − cost) − fixed = ${q} × ${money(p - c)} − ${money(F)} = <b>${money(pr)}</b>.`);
  }
  if (t === 'margin' || t === 'markup') {
    const P = r.pick([20, 40, 50, 80, 100, 200]), m = r.pick([20, 25, 40, 50, 60]), C = P * (1 - m / 100), mk = (P - C) / C * 100;
    if (t === 'margin') return { kind: 'Margin', q: `A product sells for <b>${money(P)}</b> and costs <b>${money(C)}</b> to make. What is its gross margin?`, choices: [pctF(m), ...nearNums(m, r, [mk, 100 - m, m / 2], { dec: 1 }).map(pctF)], explain: `Margin = (price − cost) ÷ <i>price</i> = ${money(P - C)} ÷ ${money(P)} = <b>${pctF(m)}</b>.`, key: `mg${P}${m}` };
    return { kind: 'Markup', q: `A shop buys a product for <b>${money(C)}</b> and sells it for <b>${money(P)}</b>. What is the markup on cost?`, choices: [pctF(Math.round(mk * 10) / 10), ...nearNums(Math.round(mk * 10) / 10, r, [m, mk * 2, 100 - m], { dec: 1 }).map(pctF)], explain: `Markup = (price − cost) ÷ <i>cost</i> = ${money(P - C)} ÷ ${money(C)} = <b>${pctF(Math.round(mk * 10) / 10)}</b>. The margin on the same sale is only ${m}%, because it divides by the price.`, key: `mk${P}${m}` };
  }
  if (t === 'breakeven') {
    const u = r.pick([3, 4, 5, 6, 8, 10, 15]), c = r.int(1, 6), p = c + u, BE = r.pick([150, 200, 300, 400, 500, 600]), F = BE * u;
    return { kind: 'Break-even', q: `Fixed costs are <b>${money(F)}</b> a month. Each sale brings in <b>${money(p)}</b> and costs <b>${money(c)}</b> to make. How many sales do you need to break even?`, choices: [fmt(BE) + ' sales', ...nearNums(BE, r, [Math.round(F / p), Math.round(F / c), BE * 2]).map(v => fmt(v) + ' sales')], explain: `Each sale contributes ${money(p)} − ${money(c)} = ${money(u)} toward fixed costs. ${money(F)} ÷ ${money(u)} = <b>${fmt(BE)} sales</b>.`, key: `be${F}${u}` };
  }
  if (t === 'funnel') {
    const V = r.pick([2000, 5000, 10000, 20000]), c = r.pick([1, 2, 2.5, 3, 4]), A = r.pick([25, 40, 50, 60]), rev = V * c / 100 * A;
    return moneyQ('Sales funnel', `<b>${fmt(V)}</b> people visit your online store. <b>${c}%</b> buy, spending <b>${money(A)}</b> on average. What is the revenue?`, rev, r, [V * c / 100, rev * 10, V * A / 100], 0, `${fmt(V)} × ${c}% = ${fmt(V * c / 100)} buyers × ${money(A)} = <b>${money(rev)}</b>.`);
  }
  if (t === 'roi') {
    const C = r.pick([2000, 4000, 5000, 8000, 10000]), roi = r.pick([10, 20, 25, 40, 50, 150]), G = C * (1 + roi / 100);
    return { kind: 'ROI', q: `You invest <b>${money(C)}</b> in new equipment, and it returns <b>${money(G)}</b> in total. What is the return on investment?`, choices: [pctF(roi), ...nearNums(roi, r, [100 + roi, Math.round((G - C) / G * 1000) / 10, roi / 2], { dec: 1 }).map(pctF)], explain: `ROI = (return − cost) ÷ cost = ${money(G - C)} ÷ ${money(C)} = <b>${roi}%</b>.`, key: `roi${C}${roi}` };
  }
  if (t === 'runway') {
    const B = r.pick([10, 12, 15, 20, 25, 30]) * 1000, mo = r.pick([6, 8, 10, 12, 18]), K = B * mo;
    return { kind: 'Runway', q: `A startup has <b>${money(K)}</b> in the bank and spends <b>${money(B)}</b> more than it earns each month. How many months of runway does it have?`, choices: [mo + ' months', ...nearNums(mo, r, [mo + 2, mo - 2, mo * 2]).map(v => v + ' months')], explain: `Runway = cash ÷ monthly burn = ${money(K)} ÷ ${money(B)} = <b>${mo} months</b> to become profitable or raise more money.`, key: `rw${K}${B}` };
  }
  if (t === 'ltv') {
    const m = r.pick([20, 30, 50]), n = r.pick([12, 18, 24, 36]), g = r.pick([40, 50, 60]), L = m * n * g / 100;
    return moneyQ('Lifetime value', `A subscriber pays <b>${money(m)}</b> a month and stays <b>${n} months</b> on average. Your gross margin is <b>${g}%</b>. What is a customer’s lifetime gross profit?`, L, r, [m * n, m * n * (1 - g / 100), m * 12 * g / 100], 0, `${money(m)} × ${n} months = ${money(m * n)} in revenue. × ${g}% margin = <b>${money(L)}</b>.`);
  }
  if (t === 'payback') {
    const gp = r.pick([20, 25, 30, 50, 60]), mo = r.pick([3, 4, 5, 6, 8, 12]), CAC = gp * mo;
    return { kind: 'Payback', q: `It costs <b>${money(CAC)}</b> in ads to win a customer, who brings in <b>${money(gp)}</b> of gross profit a month. How many months until the customer pays back that cost?`, choices: [mo + ' months', ...nearNums(mo, r, [mo + 1, mo * 2, Math.round(mo / 2)]).map(v => v + ' months')], explain: `${money(CAC)} ÷ ${money(gp)} per month = <b>${mo} months</b>. Shorter payback means growth needs less cash.`, key: `pb${CAC}${gp}` };
  }
  const p = r.pick([10, 20, -10]), v = p > 0 ? r.pick([-5, -10, -15]) : r.pick([15, 20, 25]);
  const chg = ((1 + p / 100) * (1 + v / 100) - 1) * 100;
  const f = x => (x > 0 ? '+' : x < 0 ? '−' : '') + fmt(Math.abs(x), 1) + '%';
  return { kind: 'Pricing', q: `You ${p > 0 ? 'raise' : 'cut'} prices by <b>${Math.abs(p)}%</b> and sell <b>${Math.abs(v)}% ${v < 0 ? 'fewer' : 'more'}</b> units. What happens to revenue?`, choices: [f(chg), ...nearNums(Math.round(chg * 10) / 10, r, [p + v, p, -v], { dec: 1, neg: true }).map(f)], explain: `Revenue = price × units: ${(1 + p / 100).toFixed(2)} × ${(1 + v / 100).toFixed(2)} = ${((1 + p / 100) * (1 + v / 100)).toFixed(3)}, a change of <b>${f(chg)}</b>. You can’t just add the percentages.`, key: `pc${p}${v}` };
}
QGEN.business = bizGen;
IMPL.breakeven = {
  play(ctx) {
    runQuiz(ctx, { mode: 'classic', count: 10, perQ: 50, gen: bizGen,
      lesson: 'Founders live by unit economics: what each sale earns after its direct cost, how many sales cover fixed costs, and how long the cash lasts. Margin divides by price; markup divides by cost.' });
  }
};
