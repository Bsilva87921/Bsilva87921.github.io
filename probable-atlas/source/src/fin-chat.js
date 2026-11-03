/* Probable Atlas · Finance: the Ask AI adapter. A built-in analyst (intent matching over live data and models) plus
   the tool set Claude uses when it is available. */
const FCHAT = (() => {
  const { esc, ok, num, pct, sgn } = K, N = CH.NLU;
  const P = (v, d = 1) => FV.P(v, d);

  /* ---------------- entities ---------------- */
  const ALIAS = [
    ['s&p 500', '^GSPC'], ['s&p500', '^GSPC'], ['s&p', '^GSPC'], ['sp500', '^GSPC'], ['spx', '^GSPC'], ['the market', '^GSPC'], ['stock market', '^GSPC'], ['us stocks', '^GSPC'], ['stocks', '^GSPC'], ['equities', '^GSPC'],
    ['nasdaq 100', 'QQQ'], ['nasdaq', '^IXIC'], ['tech stocks', 'XLK'], ['technology', 'XLK'], ['dow jones', '^DJI'], ['dow', '^DJI'], ['russell 2000', '^RUT'], ['russell', '^RUT'], ['small caps', 'IWM'], ['small-cap', 'IWM'], ['small cap', 'IWM'],
    ['equal weight', 'RSP'], ['value stocks', 'IWD'], ['growth stocks', 'IWF'], ['momentum', 'MTUM'], ['quality', 'QUAL'], ['low volatility', 'USMV'], ['min vol', 'USMV'],
    ['10-year', 'DGS10'], ['10 year', 'DGS10'], ['ten-year', 'DGS10'], ['ten year', 'DGS10'], ['2-year', 'DGS2'], ['2 year', 'DGS2'], ['30-year', 'DGS30'], ['30 year treasury', 'DGS30'], ['t-bill', 'DGS3MO'], ['treasury bills', 'BIL'], ['mortgage', 'MORTGAGE30US'], ['fed funds', 'DFF'], ['sofr', 'SOFR'],
    ['long treasuries', 'TLT'], ['long-term treasuries', 'TLT'], ['long bonds', 'TLT'], ['treasuries', 'IEF'], ['treasury', 'IEF'], ['aggregate bonds', 'AGG'], ['bonds', 'AGG'], ['tips', 'TIP'], ['inflation-protected', 'TIP'], ['junk bonds', 'HYG'], ['high yield', 'HYG'], ['high-yield', 'HYG'], ['corporate bonds', 'LQD'], ['investment grade', 'LQD'], ['emerging market bonds', 'EMB'],
    ['breakeven', 'T10YIE'], ['inflation expectations', 'T10YIE'], ['real yield', 'DFII10'], ['credit spread', 'BAA10Y'], ['high-yield spread', 'BAMLH0A0HYM2'],
    ['gold', 'GC=F'], ['silver', 'SLV'], ['crude', 'CL=F'], ['oil', 'CL=F'], ['wti', 'CL=F'], ['brent', 'DCOILBRENTEU'], ['copper', 'HG=F'], ['natural gas', 'DHHNGSP'], ['commodities', 'DBC'], ['reits', 'VNQ'], ['real estate', 'VNQ'],
    ['bitcoin', 'BTC-USD'], ['btc', 'BTC-USD'], ['crypto', 'BTC-USD'], ['ethereum', 'ETH-USD'], ['ether', 'ETH-USD'], ['eth', 'ETH-USD'],
    ['dollar', 'DX-Y.NYB'], ['dxy', 'DX-Y.NYB'], ['euro', 'DEXUSEU'], ['yen', 'DEXJPUS'], ['pound', 'DEXUSUK'], ['sterling', 'DEXUSUK'], ['yuan', 'DEXCHUS'], ['peso', 'DEXMXUS'],
    ['vix', '^VIX'], ['fear index', '^VIX'], ['move index', '^MOVE'],
    ['emerging markets', 'EEM'], ['emerging', 'EEM'], ['international stocks', 'EFA'], ['international', 'EFA'], ['developed markets', 'EFA'],
    ['ftse', '^FTSE'], ['uk stocks', '^FTSE'], ['dax', '^GDAXI'], ['germany', '^GDAXI'], ['cac', '^FCHI'], ['france', '^FCHI'], ['euro stoxx', '^STOXX50E'], ['europe', '^STOXX50E'], ['nikkei', '^N225'], ['japan', '^N225'], ['hang seng', '^HSI'], ['hong kong', '^HSI'], ['shanghai', '000001.SS'], ['china', '000001.SS'], ['nifty', '^NSEI'], ['india', '^NSEI'], ['kospi', '^KS11'], ['korea', '^KS11'], ['asx', '^AXJO'], ['australia', '^AXJO'], ['tsx', '^GSPTSE'], ['canada', '^GSPTSE'], ['bovespa', '^BVSP'], ['brazil', '^BVSP'], ['mexico', '^MXX'],
    ['financials', 'XLF'], ['banks', 'XLF'], ['energy stocks', 'XLE'], ['energy sector', 'XLE'], ['health care', 'XLV'], ['healthcare', 'XLV'], ['utilities', 'XLU'], ['consumer staples', 'XLP'], ['staples', 'XLP'], ['discretionary', 'XLY'], ['industrials', 'XLI'], ['materials', 'XLB'], ['communication', 'XLC']
  ];
  function findAssets(raw) {
    const q = N.norm(raw), found = []; let rest = q;
    // explicit tickers first (SPY, QQQ...)
    for (const id of Object.keys(F.P.s)) { const t = F.tick(id).toLowerCase(); if (t && t.length >= 2 && new RegExp(`[\\s(]${t.replace(/[.^$*+?()[\]{}|\\-]/g, '\\$&')}[\\s).,?]`).test(rest)) { found.push({ id, i: rest.indexOf(' ' + t) }); } }
    for (const [a, id] of ALIAS.slice().sort((x, y) => y[0].length - x[0].length)) {
      const i = rest.indexOf(' ' + a + ' ') >= 0 ? rest.indexOf(' ' + a + ' ') : rest.indexOf(' ' + a + 's ') >= 0 ? rest.indexOf(' ' + a + 's ') : rest.indexOf(' ' + a + '?') >= 0 ? rest.indexOf(' ' + a + '?') : -1;
      if (i >= 0 && F.has(id)) { found.push({ id, i }); rest = rest.slice(0, i) + ' '.repeat(a.length + 1) + rest.slice(i + a.length + 1); }
    }
    const seen = new Set(); return found.sort((a, b) => a.i - b.i).map(f => f.id).filter(id => !seen.has(id) && seen.add(id));
  }
  function resolve(x) { if (!x) return null; if (F.has(x)) return x; const up = String(x).toUpperCase(); if (F.has(up)) return up; const f = findAssets(String(x)); return f[0] || Object.keys(F.P.s).find(id => F.label(id).toLowerCase().includes(String(x).toLowerCase())) || null; }

  const LABMAP = [['stock', 'US'], ['equit', 'US'], ['s&p', 'US'], ['us', 'US'], ['international', 'INTL'], ['intl', 'INTL'], ['developed', 'INTL'], ['emerging', 'EM'], ['em ', 'EM'], ['bond', 'BND'], ['fixed income', 'BND'], ['treasur', 'LTT'], ['tips', 'TIPS'], ['cash', 'CASH'], ['t-bill', 'CASH'], ['money market', 'CASH'], ['gold', 'GOLD'], ['reit', 'REIT'], ['real estate', 'REIT'], ['commodit', 'CMDTY'], ['bitcoin', 'BTC'], ['crypto', 'BTC'], ['btc', 'BTC']];
  function parsePortfolio(raw) {
    const q = N.norm(raw);
    const ratio = q.match(/\b(\d{1,3})\s?\/\s?(\d{1,3})(?:\s?\/\s?(\d{1,3}))?\b/);
    if (ratio && +ratio[1] + +ratio[2] + (+ratio[3] || 0) >= 95 && +ratio[1] + +ratio[2] + (+ratio[3] || 0) <= 105) { const w = { US: +ratio[1], BND: +ratio[2] }; if (ratio[3]) w.CASH = +ratio[3]; return { w, label: `${ratio[0].replace(/\s/g, '')} stocks/bonds${ratio[3] ? '/cash' : ''}` }; }
    const w = {}; const re = /(\d{1,3}(?:\.\d)?)\s?%\s?(?:in\s|of\s|into\s)?([a-z&\- ]{2,22}?)(?=[,;.]|\sand\s|\splus\s|\swith\s| \d|$|\s(?:in|for)\s)/g; let m, hit = 0;
    while ((m = re.exec(q))) { const name = m[2].trim(); const map = LABMAP.find(([k]) => (' ' + name + ' ').includes(k)); if (map) { w[map[1]] = (w[map[1]] || 0) + parseFloat(m[1]); hit++; } }
    if (hit) { const t = Object.values(w).reduce((a, b) => a + b, 0); if (t < 100 && t > 0 && !w.BND && N.has(q, [' rest in bonds', 'remainder in bonds', 'rest bonds'])) w.BND = 100 - t; return { w, label: Object.entries(w).map(([k, v]) => `${num(v, 0)}% ${FP.LAB.find(a => a.id === k).short}`).join(', ') }; }
    if (N.has(q, ['all stocks', '100% stocks', 'all equities', 'only stocks'])) return { w: { US: 100 }, label: '100% US stocks' };
    const pre = FP.PRESETS.find(([n]) => q.includes(n.toLowerCase().replace(' style', '')) || q.includes(n.toLowerCase().split(' ')[0] + ' portfolio'));
    if (pre) return { w: Object.assign({}, pre[1]), label: pre[0] };
    if (N.has(q, ['my portfolio', 'my mix', 'the lab', 'my allocation']) && ST && ST.lab && ST.lab.w) return { w: Object.assign({}, ST.lab.w), label: 'your What-if lab mix' };
    return null;
  }
  function parsePlan(raw) {
    const q = N.norm(raw), money = N.money(q), age = N.age(q), ra = N.retireAge(q);
    let years = N.years(q.replace(/\d+\s?years? old/, '')); if (!years && age && ra && ra > age) years = ra - age;
    if (!years && age) { const by = q.match(/\bby (?:age\s)?(\d{2})\b/); if (by && +by[1] > age && +by[1] <= 100) years = +by[1] - age; }
    if (!years && /retire/.test(q) && age) years = Math.max(1, 65 - age);
    const monthlyM = q.match(/\$?\s?(\d[\d,]*(?:\.\d+)?)\s?(k)?\s?(?:a|per|each|every|\/)\s?(?:month|mo)\b/), monthly = monthlyM ? parseFloat(monthlyM[1].replace(/,/g, '')) * (monthlyM[2] ? 1000 : 1) : null;
    const withdraw = /withdraw|take out|spend|live on|draw down|income of/.test(q);
    const goalM = q.match(/(?:reach|hit|get to|have|goal of|target of|grow to|become|end up with|save up)\s(?:at least\s)?\$?\s?(\d[\d,]*(?:\.\d+)?)\s?(k|m|million|thousand)?/);
    let goal = goalM ? parseFloat(goalM[1].replace(/,/g, '')) * ({ k: 1e3, thousand: 1e3, m: 1e6, million: 1e6 }[goalM[2]] || 1) : null;
    if (!goal && /millionaire|a million|1 million|one million/.test(q)) goal = 1e6;
    const others = money.filter(x => x.dollar && x.v >= 1000 && x.v !== goal && (!monthly || Math.abs(x.v - monthly) > 1e-6));
    const start = others.length ? others[0].v : null;
    return { start, monthly: monthly != null ? (withdraw ? -monthly : monthly) : null, years, goal, real: !/nominal|future dollars/.test(q) };
  }
  function parseShock(raw) {
    const q = N.norm(raw), sh = {};
    const up = '(?:rise|rises|rising|up|jump|jumps|climb|climbs|increase|increases|go up|goes up|spike|spikes|surge|surges|higher|soar|soars)', dn = '(?:fall|falls|falling|drop|drops|down|decline|declines|crash|crashes|sink|sinks|lower|plunge|plunges|cut|cuts|tumble|tumbles)';
    const isUp = t => new RegExp(up).test(t) || /widen|strengthen/.test(t);
    const rate = q.match(new RegExp(`(?:rates?|yields?|10-year|treasury yields?|interest rates?|the fed)\\s(?:\\w+\\s){0,2}?(${up}|${dn}|hikes?|raises?)\\s(?:by\\s)?(\\d+(?:\\.\\d+)?)\\s?(%|percent|points?|pp|bp|bps|basis points)?`));
    if (rate) { let v = parseFloat(rate[2]); if (/bp|basis/.test(rate[3] || '') || v >= 20) v /= 100; sh.rates = (isUp(rate[1]) || /hike|raise/.test(rate[1])) ? v : -v; }
    const eq = q.match(new RegExp(`(?:stocks?|market|s&p(?: 500)?|equities|shares|nasdaq)\\s(?:\\w+\\s){0,2}?(${up}|${dn})\\s(?:by\\s)?(\\d+(?:\\.\\d+)?)\\s?%?`)) || q.match(/(\d+(?:\.\d+)?)\s?%\s(?:stock |market )?(crash|drop|fall|decline|correction|rally|gain)/);
    if (eq) { if (/^\d/.test(eq[1])) sh.eq = /crash|drop|fall|decline|correction/.test(eq[2]) ? -parseFloat(eq[1]) : parseFloat(eq[1]); else sh.eq = isUp(eq[1]) ? parseFloat(eq[2]) : -parseFloat(eq[2]); }
    const oil = q.match(new RegExp(`oil(?: prices?)?\\s(?:\\w+\\s){0,2}?(${up}|${dn})\\s(?:by\\s)?(\\d+)`)); if (oil) sh.oil = isUp(oil[1]) ? +oil[2] : -oil[2];
    const usd = q.match(new RegExp(`dollar\\s(?:\\w+\\s){0,2}?(${up}|${dn}|strengthens|weakens)\\s(?:by\\s)?(\\d+)`)); if (usd) sh.usd = isUp(usd[1]) ? +usd[2] : -usd[2];
    const cr = q.match(new RegExp(`(?:credit )?spreads?\\s(?:\\w+\\s){0,2}?(${up}|widen|widens|${dn}|tighten|tightens)\\s(?:by\\s)?(\\d+(?:\\.\\d+)?)\\s?(bp|bps|basis points|%|points?|pp)?`)); if (cr) { let v = parseFloat(cr[2]); if (/bp|basis/.test(cr[3] || '') || v >= 20) v /= 100; sh.credit = isUp(cr[1]) ? v : -v; }
    const inf = q.match(new RegExp(`(?:inflation expectations|breakevens?)\\s(?:\\w+\\s){0,2}?(${up}|${dn})\\s(?:by\\s)?(\\d+(?:\\.\\d+)?)`)); if (inf) sh.infl = Math.max(-1.5, Math.min(1.5, (isUp(inf[1]) ? 1 : -1) * parseFloat(inf[2])));
    if (Object.keys(sh).length) return { sh, name: null, partial: true };
    for (const [n, s] of FP.SCEN) if (q.includes(n.toLowerCase())) return { sh: Object.assign({}, s), name: n };
    if (/recession/.test(q)) return { sh: Object.assign({}, FP.SCEN.find(s => s[0] === 'Recession')[1]), name: 'Recession' };
    if (/crash/.test(q)) return { sh: Object.assign({}, FP.SCEN.find(s => s[0] === 'Equity crash')[1]), name: 'Equity crash' };
    if (/inflation/.test(q) && /(spike|surge|rise|jump|higher|returns?|comes back|takes off)/.test(q)) return { sh: Object.assign({}, FP.SCEN.find(s => s[0] === 'Stagflation')[1]), name: 'Stagflation' };
    if (/rates? (rise|go up|climb|jump)|rate hike/.test(q)) return { sh: { rates: 1 }, name: null, partial: true };
    if (/rates? (fall|drop|go down|decline)|rate cut/.test(q)) return { sh: { rates: -1 }, name: null, partial: true };
    return null;
  }

  /* ---------------- building blocks for answers ---------------- */
  const link = (label, tab, anchor, extra = '') => `<a href="#" data-goto="${tab}"${anchor ? ` data-anchor="${anchor}"` : ''}${extra}>${esc(label)} →</a>`;
  const tiles = list => `<div class="tiles">${list.map(t => U.tile(t)).join('')}</div>`;
  const mini = (ids, range = '1Y', h = 170) => {
    const i1 = F.N - 1, ser = ids.slice(0, 4).map((id, k) => { const s = F.ser(id), i0 = FV.rangeStart(range, ids.length > 1 ? null : id), a = Math.max(i0, s.s), b = s.v[a]; return { name: F.short(id), color: C.PAL[k], pts: ids.length > 1 && s.log ? F.pts(id, a, i1, 300, v => v / b * 100) : F.pts(id, a, i1, 300) }; });
    const ax = v => { const a = Math.abs(v); return a >= 1000 ? num(v, 0) : a >= 10 ? num(v, 1) : num(v, 2); };
    return C.line({ series: ser, h, yFmt: v => ids.length > 1 && F.ser(ids[0]).log ? num(v, 0) : ax(v), tipFmt: v => ids.length > 1 && F.ser(ids[0]).log ? num(v, 1) : F.fmtLevel(ids[0], v), tipX: F.xLab, aria: 'Chart' });
  };
  const lab = () => (ST && ST.lab && ST.lab.w ? ST.lab : VL.DEF);
  const erNow = () => FP.assumptions(lab().mode || 'forward').map((a, i) => (lab().mode !== 'history' && lab().er && ok(lab().er[a.id]) ? lab().er[a.id] : a.er));
  const wFrac = obj => { const v = FP.vec(obj), t = v.reduce((a, b) => a + b, 0) || 1; return v.map(x => x / t); };
  const mixTxt = w => FP.LAB.map((a, i) => w[i] > 0.004 ? `${a.short} ${num(w[i] * 100, 0)}%` : '').filter(Boolean).join(', ');

  /* ---------------- intents ---------------- */
  const I = [];
  const intent = (id, words, fn, opts = {}) => I.push(Object.assign({ id, words, fn }, opts));

  intent('help', [/\b(hi|hello|hey)\b/, 'what can you do', 'help', 'how do i use', 'what do you know'], () => ({ md: `I'm the built-in analyst for **Probable Atlas · Finance**. I answer from this page's live data (${F.N.toLocaleString()} trading days, 95 series) and its models. Try:\n- **Markets**: "How is gold doing?", "Compare Nasdaq vs S&P 500", "Best performers this year"\n- **Forecasts**: "Is a correction likely?", "What regime are we in?", "Expected stock returns next decade"\n- **Your situation**: "Stress-test 70/30", "I'm 35 with $50k, saving $500 a month: can I reach $1M by 65?", "What if rates rise 1%?"\n- **Concepts**: "What is value-at-risk?", "Why does the yield curve matter?"`, follow: suggestions(ST).slice(0, 4) }));

  intent('overview', ['market today', 'markets today', 'how are markets', 'how is the market', "how's the market", 'what happened', 'summary', 'summarize', 'brief me', 'update', "today's read", 'overview', 'whats going on', "what's going on", 'market doing'].map(w => w === 'what happened' ? /what happened(?! in| during)/ : w), () => {
    const al = FM.alerts().slice(0, 3);
    return { md: FM.narrative().join(' ') + (al.length ? '\n\n**Alerts**\n' + al.map(a => `- ${a.title}`).join('\n') : ''), extra: tiles(['^GSPC', 'DGS10', '^VIX', 'BTC-USD'].map(id => { const q = F.quote(id), s = F.ser(id); return { lab: F.short(id), val: esc(s.log ? F.fmtLevel(id, q.last) : num(q.last, 2) + '%'), sub: s.log ? U.upDown(q.pct, 2) : U.upDown(q.chg, 2, ' pp'), asset: id }; })) + link('Open Live now', 'live'), follow: ['Is a correction likely?', 'Which sectors are leading?', 'What does this mean for a 60/40 portfolio?'] };
  });

  intent('risk', ['crash', 'correction', 'bear market', 'pullback', 'sell-off', 'selloff', 'downturn', /\b(drop|fall|decline)\b.*\b(chance|likely|probab|risk|odds)/, /\b(chance|likely|probab|odds|risk)\b.*\b(drop|fall|decline|crash)/, 'go down', 'will stocks fall', 'will the market fall'], () => {
    const M = ['pull5', 'dd10', 'bear20'].map(k => FM.risk(k)), E = M.map(m => m.evaluate()), d = M[1];
    const drv = d.contrib.slice(0, 3).map(c => `${({ cape: 'valuations (CAPE)', vix: 'implied volatility', trend: 'the price trend', dcredit: 'credit spreads' })[c.k] || c.name} ${c.c > 0 ? 'raise' : 'lower'} it`).join(', ');
    return { md: `**Model odds, S&P 500:**\n${M.map((m, j) => `- ${m.spec.label}: **${pct(m.now.p * 100, 0)}** (base rate ${pct(m.baseRate * 100, 0)}; out of sample AUC ${num(E[j].auc, 2)}, Brier skill ${sgn(E[j].bss * 100, 0, '%')})`).join('\n')}\n\nWhat drives the 6-month reading: ${drv}.\n\n**How much to trust it:** out of sample these models beat the base rate only modestly, so read them as a tilt, not a forecast. Declines are normal: the S&P 500 fell 10%+ at some point in ${FM.intraYear().n10} of ${FM.intraYear().n} years since 1929 and still ended ${FM.intraYear().posAfter10} of those years higher. Practical use: make sure money you need within a few years isn't in stocks, and decide in advance what you'd do after a 10% or 20% drop.`, extra: link('See drivers and track record', 'models', 'm-risk'), follow: ['How long do bear markets usually last?', 'Stress-test a 60/40 portfolio', 'What regime are we in?'] };
  });

  intent('regime', ['regime', 'bull or bear', 'bull market', 'risk on', 'risk off', 'market state', 'market phase'], () => {
    const rg = FM.regime();
    return { md: `The hidden Markov model reads **${rg.names[rg.state].toLowerCase()}** for the week ending ${K.isoLab(rg.asOf)}: ${rg.names.map((n, k) => `${n} ${pct(rg.now[k] * 100, 0)}`).join(', ')}.\n\n- **Calm** weeks average ${pct(rg.ann[0].vol, 0)} annualized volatility; **choppy** ${pct(rg.ann[1].vol, 0)}; **stress** ${pct(rg.ann[2].vol, 0)}.\n- A calm spell typically lasts about ${num(rg.dur[0], 0)} weeks; stress about ${num(rg.dur[2], 0)}.\n- In 13 weeks the model expects: ${rg.names.map((n, k) => `${n.toLowerCase()} ${pct(rg.in13[k] * 100, 0)}`).join(', ')}.\n\nOut of sample (fit on 1990-2007, run forward), regimes sorted next-month **volatility** well (${pct(rg.fwd[0].vol, 0)} vs ${pct(rg.fwd[1].vol, 0)} vs ${pct(rg.fwd[2].vol, 0)}) but not next-month **returns**. Use it to size risk, not to time entries.`, extra: link('See the regime history', 'models', 'm-regime'), follow: ['What is the expected volatility?', 'Is a correction likely?'] };
  });

  intent('vol', ['volatility', 'volatile', 'vix', 'value at risk', 'value-at-risk', /\bvar\b/, 'how much could i lose', 'worst case', 'swing', 'expected shortfall'], (q) => {
    const vm = FM.volModel(), v = F.lastVal('^VIX'), vp = S.pctRank(Array.from(F.ser('^VIX').v).filter(ok), v) * 100, amt = N.money(q).filter(x => x.dollar && x.v >= 100)[0];
    const bt = vm.backtest();
    let m = `**Volatility now:** the GJR-GARCH model expects **${num(vm.volAnn, 1)}%** annualized for the S&P 500 (typical day ±${num(vm.sdDay, 2)}%), vs a long-run ${num(vm.longRun, 0)}%. The VIX, the market's own estimate, is **${num(v, 1)}** (${K.ord(Math.round(vp))} percentile since 1990).\n\n**Value-at-risk (S&P 500):**\n- 1 day, 99%: ${num(vm.varD.v99, 2)}% (average loss beyond it ${num(vm.varD.es99, 2)}%)\n- 1 day, 95%: ${num(vm.varD.v95, 2)}%\n- 1 month, 95%: ${num(vm.varM.v95, 1)}%; 99%: ${num(vm.varM.v99, 1)}%`;
    if (amt) m += `\n\nOn **${K.money(amt.v, 0)}** fully in the S&P 500, that's about ${K.money(amt.v * vm.varD.v99 / 100, 0)} on a 1-in-100 bad day and ${K.money(amt.v * vm.varM.v95 / 100, 0)} in a 1-in-20 bad month.`;
    m += `\n\nTrack record since ${bt.from.slice(0, 4)}: the 99% line was breached on ${num(bt.rate1, 2)}% of days (target 1%; Kupiec p ${num(bt.k1.p, 2)}), with no clustering of breaches.`;
    return { md: m, extra: link('See the volatility model and backtest', 'models', 'm-vol'), follow: ['What regime are we in?', 'How much could a 60/40 portfolio lose in a bad year?'] };
  });

  intent('valuation', ['overvalued', 'undervalued', 'expensive', 'cheap', 'valuation', 'cape', 'p/e', ' pe ', 'pe ratio', 'bubble', 'expected return', 'next decade', 'long term return', 'long-term return', '10 years', 'ten years', 'shiller', 'buffett'], () => {
    const cp = FM.cape(), bf = FM.buffett();
    return { md: `**US stocks look expensive.** Shiller CAPE is **${num(cp.last.cape, 1)}**, the ${K.ord(Math.round(cp.pctile))} percentile since 1881 (median ${num(cp.median, 1)})${bf ? `; stock market value is ${num(bf.last.v, 0)}% of GDP (${K.ord(Math.round(bf.pctile))} percentile since 1947)` : ''}.\n\nThe CAPE regression implies about **${sgn(cp.fc, 1, '%')} a year after inflation** over the next 10 years, with a 90% range of ${num(cp.lo, 0)}% to ${num(cp.hi, 0)}% based on its out-of-sample errors. Out of sample since 1940 it beat the running historical average (R² ${num(cp.r2oos, 2)}), but it says little about the next year or two: expensive markets can stay expensive.\n\nThe lab's forward-looking assumption blends this model 50/50 with the long-run 6.8% real return, giving **${sgn(FP.assumptions('forward')[0].er, 1, '%')} nominal** for US stocks.`, extra: link('See the CAPE model', 'models', 'm-cape'), follow: ['Should I diversify internationally?', 'What do bonds yield now?', 'Is a correction likely?'] };
  });

  intent('rates', ['yield curve', 'inverted', 'inversion', 'interest rate', 'rates', 'fed ', 'federal reserve', 'treasury yield', 'yields', 'mortgage rate'], () => {
    const y = id => F.lastVal(id), c3 = y('DGS10') - y('DGS3MO'), c2 = y('DGS10') - y('DGS2'), chg = F.chg('DGS10', 252);
    return { md: `**Treasury yields** (${K.isoLab(F.quote('DGS10').date)}): 3-month ${num(y('DGS3MO'), 2)}%, 2-year ${num(y('DGS2'), 2)}%, 10-year **${num(y('DGS10'), 2)}%** (${FV.pp(chg)} over a year), 30-year ${num(y('DGS30'), 2)}%. Fed funds ${num(y('DFF'), 2)}%; 30-year mortgage ${num(y('MORTGAGE30US'), 2)}%.\n\n**Curve:** 10-year minus 3-month is **${FV.pp(c3)}**, 10-year minus 2-year ${FV.pp(c2)}: ${c3 < 0 ? 'inverted, a classic recession warning with a 6-24 month lag' : 'positively sloped (normal)'}. Since the late 1960s every US recession was preceded by a 10y-3m inversion, though lags vary and there were false alarms.\n\nThe 10-year is roughly **${num(y('DFII10'), 2)}% real yield + ${num(y('T10YIE'), 2)}% expected inflation**.`, extra: FV.curveChart([['Latest', F.N - 1], ['1 year ago', F.N - 253]], 180) + link('Open the yield-curve time machine', 'markets'), follow: ['What happens to bonds if rates rise 1%?', 'Are credit spreads warning of trouble?', 'What does breakeven inflation mean?'] };
  });

  intent('credit', ['credit spread', 'spreads', 'junk', 'default', 'corporate bond', 'high-yield spread'], () => {
    const b = F.lastVal('BAA10Y'), hy = F.lastVal('BAMLH0A0HYM2'), bp = S.pctRank(Array.from(F.ser('BAA10Y').v).filter(ok), b) * 100;
    return { md: `The **Baa corporate spread** over the 10-year Treasury is **${num(b, 2)} pp** (${K.ord(Math.round(bp))} percentile since 1990; ${FV.pp(F.chg('BAA10Y', 63))} over 3 months). The **high-yield (junk) spread** is ${num(hy, 2)} pp.\n\n${bp < 30 ? 'Spreads are tight: investors are paying up for corporate credit and demanding little compensation for default risk.' : bp > 70 ? 'Spreads are wide: investors are demanding extra compensation, often a sign of stress.' : 'Spreads are near normal.'} Rapid widening (0.4 pp+ in a month) has often accompanied equity sell-offs; the correction model uses the 3-month change for that reason.`, extra: mini(['BAA10Y'], '10Y'), follow: ['Is a correction likely?', 'How do high-yield bonds behave in a crash?'] };
  });

  intent('inflation', ['inflation', 'tips', 'breakeven', 'cpi', 'hedge against inflation', 'purchasing power'], (q) => {
    const cpi = F.macroM('CPIAUCSL'), L = F.lastOf(cpi), prev = cpi && L ? cpi.v[L.k - 12] : null, yoy = L && ok(prev) ? (L.v / prev - 1) * 100 : null;
    const w22 = [F.idx('2022-01-03'), F.idx('2022-10-12')], g = FP.assetWindow('GOLD', ...w22), t = FP.assetWindow('TIPS', ...w22), c = FP.assetWindow('CMDTY', ...w22);
    return { md: `**Inflation:** CPI is up ${ok(yoy) ? num(yoy, 1) + '%' : 'n/a'} over 12 months (${L ? L.key : ''}). Markets expect **${num(F.lastVal('T5YIE'), 2)}%** a year over 5 years and **${num(F.lastVal('T10YIE'), 2)}%** over 10 (TIPS breakevens). The 10-year TIPS pays **${num(F.lastVal('DFII10'), 2)}%** above inflation.\n\n**What hedged in the 2022 inflation shock** (Jan 3 to Oct 12): commodities ${P(c.r, 0)}, gold ${P(g.r, 0)}, TIPS ${P(t.r, 0)}, S&P 500 ${P((F.at('^GSPC', w22[1]) / F.at('^GSPC', w22[0]) - 1) * 100, 0)}. TIPS protect against inflation itself but still fall when real yields jump; commodities hedge inflation surprises best but have weak long-run returns.`, extra: link('Try a stagflation scenario in the lab', 'whatif'), follow: ['What if inflation spikes?', 'Is gold a good hedge?', 'What does breakeven inflation mean?'] };
  });

  intent('diversify', ['diversif', 'correlat', 'move together', 'hedge', 'stock bond', 'stock-bond', 'protect my portfolio', 'safe haven'], () => {
    const sb = FM.stockBond(), cm = FM.corrMatrix(['SPY', 'AGG', 'TLT', 'GLD', 'EFA', 'BTC-USD', 'DX-Y.NYB'], 156);
    return { md: `**Stock-bond correlation** (52 weeks) is **${num(sb.now, 2)}**. From about 2000 to 2021 it was negative, so bonds rose when stocks fell. Since 2022 it has been ${sb.now > 0 ? 'positive, so bonds have been a weaker hedge' : 'negative again'}.\n\n**3-year correlations with US stocks (weekly):**\n${cm.ids.slice(1).map((id, k) => `- ${F.short(id)}: ${num(cm.M[0][k + 1], 2)}`).join('\n')}\n\nLower or negative correlation means more diversification. In crises correlations among risky assets tend to rise, so the reliable diversifiers have been high-quality government bonds (when inflation is tame), cash, and at times gold and the dollar.`, extra: link('See the correlation matrix', 'markets'), follow: ['Is gold a good hedge?', 'Stress-test a 60/40 portfolio', 'What is risk parity?'] };
  });

  intent('portfolio', ['portfolio', 'allocation', /\b\d{1,3}\s?\/\s?\d{1,3}\b/, 'my mix', 'how risky', 'stress test', 'stress-test', 'how would .* do'], (q) => {
    const pp = parsePortfolio(q) || { w: { US: 60, BND: 40 }, label: '60/40 stocks/bonds' }, w = wFrac(pp.w), e = erNow(), s = FP.stats(w, e), st = FP.stress(w), bt = FP.backtest(w);
    const worst = st.filter(r => ok(r.port)).sort((a, b) => a.port - b.port).slice(0, 3);
    const top = FP.LAB.map((a, i) => ({ a, rc: s.rc[i] })).filter(x => x.rc > 0.01).sort((x, y) => y.rc - x.rc).slice(0, 2);
    return { md: `**${pp.label}** (${mixTxt(w)}), with ${lab().mode === 'history' ? 'past-performance' : 'forward-looking'} assumptions:\n- Expected return **${sgn(s.er, 1, '%')}** a year, volatility **${num(s.vol, 1)}%**\n- A 1-in-20 bad year: **${sgn(s.p5, 0, '%')}**; a good year ${sgn(s.p95, 0, '%')}\n- Risk comes mostly from ${top.map(x => `${x.a.short} (${pct(x.rc * 100, 0)})`).join(' and ')}\n\n**Worst past episodes:** ${worst.map(r => `${r.name} ${P(r.port, 0)} (S&P 500 ${P(r.sp, 0)})`).join('; ')}.\n\n**Backtest ${bt.from} to ${bt.to}:** ${pct(bt.p.cagr, 1)} a year, worst drawdown ${pct(bt.p.mdd, 0)} (S&P 500: ${pct(bt.spy.cagr, 1)}, ${pct(bt.spy.mdd, 0)}).`, extra: `<div class="pill-row"><button type="button" class="btn pri sm" data-labload="${esc(JSON.stringify(pp.w))}">Open this mix in the What-if lab</button></div>`, follow: ['What if rates rise 1%?', 'What if stocks fall 30%?', 'Will this reach $1M in 25 years with $500 a month?'] };
  });

  intent('plan', ['retire', 'retirement', 'goal', 'reach $', 'reach', 'will i have', 'enough money', 'save', 'saving', 'millionaire', 'million by', 'per month', 'a month', 'withdraw', 'nest egg', 'compound'], (q) => {
    const pl = parsePlan(q), pp = parsePortfolio(q), w = pp ? wFrac(pp.w) : VL.frac(), e = erNow(), s = FP.stats(w, e);
    const o = { start: pl.start != null ? pl.start : 10000, monthly: pl.monthly != null ? pl.monthly : 500, years: pl.years || 25, goal: pl.goal || 1e6, real: pl.real };
    const sim = FP.simulate({ er: s.er, vol: s.vol, start: o.start, monthly: o.monthly, years: o.years, goal: o.goal, real: o.real, infl: F.lastVal('T10YIE'), sims: 1500, seed: 7 });
    const assumed = [pl.start == null && 'a $10,000 start', pl.monthly == null && '$500 a month', !pl.years && '25 years', !pl.goal && 'a $1M goal'].filter(Boolean);
    const b = sim.bands, ch = C.line({ series: [{ name: 'Median', pts: b.map(r => [r.y, r.p50]), color: 'var(--s1)', width: 2.2 }], bands: [{ lo: b.map(r => [r.y, r.p10]), hi: b.map(r => [r.y, r.p90]), name: '10th-90th percentile', color: 'var(--s1)', op: 0.15 }], hlines: [{ y: o.goal, label: 'Goal', color: 'var(--s3)' }], h: 170, y0: 0, xTicks: b.filter(r => r.y % Math.max(1, Math.round(o.years / 5)) === 0).map(r => r.y), xFmt: v => 'Yr ' + Math.round(v), yFmt: v => '$' + K.big(v, 1), tipFmt: v => K.money(v, 0), tipX: v => 'Year ' + Math.round(v) });
    return { md: `**${K.money(o.start, 0)} start, ${o.monthly >= 0 ? K.money(o.monthly, 0) + ' a month added' : K.money(-o.monthly, 0) + ' a month withdrawn'}, ${o.years} years, ${pp ? pp.label : 'your lab mix (' + mixTxt(w) + ')'}** (expected ${sgn(s.er, 1, '%')} a year, volatility ${num(s.vol, 1)}%)${assumed.length ? `. I assumed ${assumed.join(', ')}; tell me your numbers to change them` : ''}.\n\n- Chance of reaching **${K.money(o.goal, 0)}**${o.real ? " (in today's dollars)" : ''}: **${pct(sim.pGoal * 100, 0)}**\n- Median outcome: **${K.money(sim.median, 0)}**; 10th-90th percentile ${K.money(sim.p10, 0)} to ${K.money(sim.p90, 0)}\n${o.monthly < 0 ? `- Chance of running out: **${pct(sim.pBroke * 100, 0)}**\n` : ''}- A typical path still suffers a ${pct(sim.mddMed, 0)} drop along the way\n\nBased on 1,500 simulated futures with fat tails; ${o.real ? 'amounts in today\'s dollars, contributions rising with inflation' : 'nominal dollars'}. Educational, not a financial plan.`, extra: ch + link('Open the full planner in the What-if lab', 'whatif'), follow: ['What if I save $1,000 a month instead?', 'How does an 80/20 mix change the odds?', 'What return assumptions are you using?'] };
  });

  intent('scenario', ['what if', 'what happens if', 'scenario', 'shock', 'stagflation', 'soft landing', 'rates rise', 'rates fall', 'if rates', 'if stocks', 'if oil', 'if the dollar', 'if inflation', 'recession hit'], (q) => {
    const ps = parseShock(q); if (!ps) return null;
    const full = ps.partial ? FP.conditional(ps.sh) : ps.sh;
    const pp = parsePortfolio(q), w = pp ? wFrac(pp.w) : wFrac({ US: 60, BND: 40 }), r = FP.shock(w, full);
    const fmtF = (f, v) => `${f.name} ${f.unit === 'pp' ? FV.pp(v) : P(v, 0)}`;
    const given = FP.FACTORS.filter(f => ps.sh[f.k] != null).map(f => fmtF(f, ps.sh[f.k])).join(', ');
    const implied = ps.partial ? FP.FACTORS.filter(f => ps.sh[f.k] == null && Math.abs(full[f.k]) >= (f.unit === 'pp' ? 0.03 : 0.3)).map(f => fmtF(f, full[f.k])).join(', ') : '';
    const desc = given + (implied ? `. Over the last five years, moves like that typically came with: ${implied}` : '');
    const per = r.per.map((p, i) => ({ a: FP.LAB[i], r: p.r })).sort((a, b) => a.r - b.r);
    return { md: `**${ps.name ? ps.name + ': ' : ''}${desc}.** Estimated immediate effect on **${pp ? pp.label : '60/40 stocks/bonds'}: ${P(r.port, 1)}**.\n\nBy asset (sensitivities from five years of weekly data):\n${per.map(x => `- ${x.a.short}: ${P(x.r, 1)}`).join('\n')}\n\nThese are linear estimates: big shocks are rarely linear, and correlations shift in a crisis. For history rather than models, the worst past episodes for this mix were ${FP.stress(w).filter(z => ok(z.port)).sort((a, b) => a.port - b.port).slice(0, 2).map(z => `${z.name} (${P(z.port, 0)})`).join(' and ')}.`, extra: link('Adjust the shocks in the What-if lab', 'whatif'), follow: ['What about a stagflation scenario?', 'How did 60/40 do in 2022?', 'How can I hedge against rising rates?'] };
  });

  intent('sectors', ['sector', 'rotation', 'leading', 'lagging', 'which industries'], () => {
    const rot = FM.rotation(), ret = FM.SECT.filter(F.has).map(id => ({ id, v: F.chg(id, 21) })).sort((a, b) => b.v - a.v);
    return { md: `**Sector rotation (13-week strength vs the S&P 500 and its 4-week change):**\n${['Leading', 'Improving', 'Weakening', 'Lagging'].map(qd => `- **${qd}**: ${rot.filter(r => r.quad === qd).map(r => r.name).join(', ') || 'none'}`).join('\n')}\n\n**Last month:** best ${ret.slice(0, 3).map(r => `${F.ser(r.id).name} ${P(r.v)}`).join(', ')}; worst ${ret.slice(-3).reverse().map(r => `${F.ser(r.id).name} ${P(r.v)}`).join(', ')}.\n\nSector momentum is real but noisy and costly to trade; most investors get sector exposure through a broad index.`, extra: link('Open the rotation map', 'models', 'm-rotation'), follow: ['Is tech overvalued?', 'Compare XLK vs XLE', 'What is momentum investing?'] };
  });

  intent('trend', ['trend', 'moving average', '200-day', '200 day', 'momentum', 'market timing', 'time the market', 'technical'], () => {
    const tr = FM.trend(), ids = ['SPY', 'QQQ', 'EFA', 'EEM', 'AGG', 'TLT', 'GLD', 'BTC-USD'], st = ids.map(id => ({ id, t: FM.trendStatus(id) }));
    return { md: `**Trend today** (price vs 200-day average): ${st.map(x => `${F.short(x.id)} ${x.t.up ? '▲' : '▼'} ${sgn(x.t.above, 1, '%')}`).join(', ')}.\n\n**Evidence for a simple trend rule** (hold US stocks above their 10-month average, else T-bills), ${tr.from.slice(0, 4)}-${tr.to.slice(0, 4)}: ${pct(tr.all.s.cagr, 1)} a year vs ${pct(tr.all.b.cagr, 1)} buy-and-hold, worst drawdown ${pct(tr.all.s.mdd, 0)} vs ${pct(tr.all.b.mdd, 0)}, Sharpe ${num(tr.all.s.sharpe, 2)} vs ${num(tr.all.b.sharpe, 2)}. Since 2010: ${pct(tr.since2010.s.cagr, 1)} vs ${pct(tr.since2010.b.cagr, 1)}, because whipsaws and V-shaped rebounds cost it. Its value is avoiding the worst crashes, not beating the market.`, extra: link('See the trend backtest', 'models', 'm-trend'), follow: ['Is a correction likely?', 'What is the risk appetite gauge saying?'] };
  });

  intent('appetite', ['sentiment', 'fear', 'greed', 'risk appetite', 'mood', 'euphoria', 'panic'], () => {
    const ap = FM.appetite(), N1 = F.N - 1;
    return { md: `**Risk appetite: ${num(ap.now, 0)}/100 (${ap.label.toLowerCase()})**; a week ago ${num(ap.week, 0)}, a month ago ${num(ap.month, 0)}.\n\nComponents (percentile vs the past two years):\n${ap.comps.map(([k, n]) => `- ${n}: ${num(ap.parts[k][N1], 0)}`).join('\n')}\n\nHistorically (${ap.from.slice(0, 4)} onward) the S&P 500 averaged ${P(ap.bucket[0].r63, 1)} over the 3 months after extreme fear vs ${P(ap.bucket[4].r63, 1)} after extreme greed: a mild contrarian tilt, not a timing signal.`, extra: link('See the gauge', 'models', 'm-appetite'), follow: ['Is a correction likely?', 'What regime are we in?'] };
  });

  intent('history', ['1929', '1987', 'black monday', 'dot-com', 'dot com', '2000', '2008', 'financial crisis', 'great depression', 'covid', '2020', '2022', 'how long', 'recover', 'recovery', 'worst day', 'best day', 'bear markets', 'history'], (q) => {
    const cr = FM.crashes(), bd = FM.bigDays(), yr = (q.match(/\b(19[2-9]\d|20[0-2]\d)\b/) || [])[1];
    let pick = yr ? cr.find(c => c.peak.slice(0, 4) <= yr && (c.rec || '9999') >= yr) : null;
    if (!pick && /covid/.test(q)) pick = cr.find(c => c.peak.startsWith('2020')); if (!pick && /financial crisis|2008/.test(q)) pick = cr.find(c => c.peak.startsWith('2007')); if (!pick && /dot/.test(q)) pick = cr.find(c => c.peak.startsWith('2000')); if (!pick && /depression|1929/.test(q)) pick = cr[0];
    if (/worst day|best day|biggest day/.test(q)) return { md: `**Worst S&P 500 days since 1928:** ${bd.worst.slice(0, 5).map(d => `${K.isoLab(d.iso)} ${P(d.r, 1)}`).join('; ')}.\n\n**Best:** ${bd.best.slice(0, 5).map(d => `${K.isoLab(d.iso)} ${P(d.r, 1)}`).join('; ')}.\n\n${FM.clustering().near} of the 10 best days came within two months of one of the 20 worst, which is why selling after a crash often means missing the rebound.`, extra: link('Open History', 'history'), follow: ['How long do bear markets usually last?', 'How often does the market fall 10% in a year?'] };
    const med = arr => S.median(arr);
    const done = cr.filter(c => c.rec), base = `**Declines of 20%+ from a record (S&P 500 price, since 1928):** ${cr.length}. Median decline ${num(-med(cr.map(c => c.depth)), 0)}%, median ${num(med(cr.map(c => c.down)), 0)} months to the bottom and ${num(med(done.map(c => c.back)), 0)} months back to the old high.`;
    if (pick) return { md: `**${K.isoLab(pick.peak)} to ${K.isoLab(pick.trough)}:** the S&P 500 fell **${num(-pick.depth, 0)}%** over ${num(pick.down, 0)} months${pick.rec ? ` and regained its old high on ${K.isoLab(pick.rec)}, ${num(pick.back, 0)} months after the bottom` : ', and has not yet fully recovered'} (price only; dividends shorten recoveries).\n\n${base}`, extra: link('Open History', 'history'), follow: ['How would a 60/40 portfolio have done then?', 'What are the worst days in history?'] };
    return { md: base + `\n\n${cr.slice(-5).map(c => `- ${c.peak.slice(0, 4)}: ${pct(c.depth, 0)}, ${num(c.down, 0)} months down, ${c.rec ? num(c.back, 0) + ' months back' : 'not yet recovered'}`).join('\n')}`, extra: link('Open History', 'history'), follow: ['What happened in 1987?', 'How did the 2008 crisis compare?'] };
  });

  intent('compare', [' vs ', ' versus ', 'compare', 'better than', 'or '], (q) => {
    const ids = findAssets(q); if (ids.length < 2) return null;
    const row = id => { const s = F.ser(id); return s.log ? `| ${F.short(id)} | ${P(F.chg(id, 21))} | ${P(F.ytd(id))} | ${P(F.chg(id, 252))} | ${ok(F.annRet(id, 5)) ? P(F.annRet(id, 5)) : '–'} | ${pct(F.vol(id), 0)} | ${pct(F.drawdown(id).dd, 0)} |` : `| ${F.short(id)} | ${FV.pp(F.chg(id, 21))} | ${FV.pp(F.ytd(id))} | ${FV.pp(F.chg(id, 252))} | – | – | – |`; };
    const cm = FM.corrMatrix(ids.slice(0, 2), 156);
    return { md: `| Market | 1M | YTD | 1Y | 5Y/yr | Vol | From high |\n|---|---|---|---|---|---|---|\n${ids.slice(0, 4).map(row).join('\n')}\n\n3-year weekly correlation between ${F.short(ids[0])} and ${F.short(ids[1])}: **${num(cm.M[0][1], 2)}**.`, extra: mini(ids, '3Y') + link('Compare in Markets', 'markets', null, ` data-focus="${esc(ids[0])}"`), follow: [`What drives ${F.short(ids[0])}?`, 'Which is riskier?'] };
  });

  intent('rank', ['best performing', 'worst performing', 'best performers', 'worst performers', 'top performers', 'biggest gainers', 'biggest losers', 'winners', 'losers', 'leaders', 'best asset', 'worst asset', 'what did best', 'what did worst'], (q) => {
    const per = /today|day/.test(q) ? ['d1', 'today'] : /week/.test(q) ? ['w1', 'this week'] : /month/.test(q) ? ['m1', 'over the last month'] : /year|12 month/.test(q) && !/this year|ytd/.test(q) ? ['y1', 'over 12 months'] : ['ytd', 'this year'];
    const sc = FM.scorecard().filter(r => r.cls !== 'vol' && ok(r[per[0]])).sort((a, b) => b[per[0]] - a[per[0]]);
    return { md: `**Best ${per[1]}:** ${sc.slice(0, 5).map(r => `${F.short(r.id)} ${P(r[per[0]])}`).join(', ')}.\n\n**Worst ${per[1]}:** ${sc.slice(-5).reverse().map(r => `${F.short(r.id)} ${P(r[per[0]])}`).join(', ')}.\n\nAcross ${sc.length} markets; funds include dividends, indexes are price only.`, extra: link('See every market', 'markets'), follow: ['Which sectors are leading?', 'How is bitcoin doing?'] };
  });

  intent('recs', ['recommend', 'should i', 'advice', 'what to do', 'suggest', 'what would you do', 'how should i invest', 'where should i put', 'best investment', 'what should'], (q) => {
    const n = N.norm(q), p = { horizon: /short|soon|next year|1 year|2 years|3 years|house|emergency/.test(n) ? 'short' : /\b(5|6|7|8|9) years|medium/.test(n) ? 'mid' : (ST && ST.rHorizon) || 'long', risk: /conservative|safe|low risk|cautious|retiree/.test(n) ? 'low' : /aggressive|high risk|growth/.test(n) ? 'high' : (ST && ST.rRisk) || 'med' };
    const c = VRF.context(), mix = VRF.suggested(p, c), all = VRF.recs(p, c);
    const ids = findAssets(q), cls = ids.map(id => F.ser(id)).map(s2 => s2.cls === 'bd' || s2.cls === 'rate' ? 'bond' : s2.cls === 'cx' ? 'crypto' : /GC=F|GLD|SLV/.test(s2.id) ? 'gold' : s2.grp === 'world' || /EFA|EEM/.test(s2.id) ? 'intl' : 'stocks');
    const TOPIC = { bond: /bond|cash|rate/i, crypto: /crypto/i, gold: /hedge|diversif/i, intl: /international/i, stocks: /stock|top-heavy|correction|trend/i };
    const focus = cls.length ? all.filter(r => TOPIC[cls[0]].test(r.title + ' ' + r.how)) : [];
    const list = (focus.length ? focus : all).slice(0, focus.length ? 3 : 4);
    const strip = h => String(h).replace(/<[^>]+>/g, '');
    const lead = ids.length ? (F.ser(ids[0]).log ? `**${F.label(ids[0])}** now: ${P(F.ytd(ids[0]))} this year, ${P(F.chg(ids[0], 252))} over 12 months, ${(FM.trendStatus(ids[0]) || {}).up ? 'above' : 'below'} its 200-day average.` : `**${F.label(ids[0])}** is ${F.fmtLevel(ids[0], F.lastVal(ids[0]))}.`) + (cls[0] === 'bond' ? ` The 10-year Treasury yields ${num(F.lastVal('DGS10'), 2)}% (${num(F.lastVal('DFII10'), 2)}% after expected inflation).` : '') + '\n\n' : '';
    return { md: `${lead}I can't give personal advice, but here is what the evidence on this page suggests for a **${PRO_H[p.horizon]}, ${PRO_R[p.risk]}-risk** investor:\n\n${list.map((r, k) => `${k + 1}. **${r.title}.** ${strip(r.how)}`).join('\n')}\n\n**Starting mix for this profile:** ${Object.entries(mix.w).map(([k, v]) => `${FP.LAB.find(a => a.id === k).short} ${v}%`).join(', ')}${mix.notes.length ? ` (tilted for today: ${mix.notes.map(x => x.split(':')[0]).join('; ')})` : ''}.`, extra: `<div class="pill-row"><button type="button" class="btn pri sm" data-labload="${esc(JSON.stringify(mix.w))}">Open this mix in the lab</button></div>` + link('Read the full recommendations', 'recs'), follow: ['Why that mix?', 'What if I am more conservative?', 'Stress-test that mix'] };
  });
  const PRO_H = { short: 'short-horizon (under 3 years)', mid: 'medium-horizon', long: 'long-horizon' }, PRO_R = { low: 'low', med: 'medium', high: 'high' };

  const GLOSS = [
    [['value at risk', 'value-at-risk', 'var'], 'Value-at-risk (VaR)', 'A loss level that should be exceeded only rarely over a horizon: a 1-day 99% VaR of 2.8% means about 1 day in 100 should be worse than −2.8%. Expected shortfall is the average loss on those rare days.', () => `Now (S&P 500): 1-day 99% VaR ${num(FM.volModel().varD.v99, 2)}%.`],
    [['cape', 'shiller pe', 'cyclically adjusted'], 'CAPE (Shiller P/E)', 'Price divided by the average of the last 10 years of inflation-adjusted earnings. Smoothing over a decade removes the boom-bust swings in profits, which makes it a better guide to long-run returns than a one-year P/E.', () => `Now: ${num(FM.cape().last.cape, 1)} (${K.ord(Math.round(FM.cape().pctile))} percentile since 1881).`],
    [['sharpe'], 'Sharpe ratio', 'Return above cash per unit of volatility. 0.5 is typical for a stock index over long periods; higher means more return for the risk taken.', null],
    [['drawdown'], 'Drawdown', 'The fall from the highest previous value to the current (or a later) value. Maximum drawdown is the worst such fall over a period.', () => `S&P 500 now: ${pct(F.drawdown('^GSPC').dd, 1)} from its ${K.isoLab(F.drawdown('^GSPC').highDate)} high.`],
    [['volatility', 'standard deviation'], 'Volatility', 'The standard deviation of returns, scaled to a year. 16% means a typical year lands within about ±16% of its average about two times in three.', () => `S&P 500 GARCH forecast: ${num(FM.volModel().volAnn, 1)}%.`],
    [['beta'], 'Beta', 'How much an asset tends to move when the market moves 1%. A beta of 1.2 means about 1.2% on average; it says nothing about moves unrelated to the market.', null],
    [['correlation'], 'Correlation', 'From −1 to +1, how closely two assets move together. Diversification works best with low or negative correlation.', () => `Stock-bond correlation (52 weeks): ${num(FM.stockBond().now, 2)}.`],
    [['yield curve', 'inversion', 'inverted'], 'Yield curve', 'Treasury yields plotted by maturity. Normally longer maturities pay more. An inverted curve (short rates above long rates) signals that markets expect rate cuts, often because they expect a slowdown.', () => `10-year minus 3-month now: ${FV.pp(F.lastVal('DGS10') - F.lastVal('DGS3MO'))}.`],
    [['breakeven'], 'Breakeven inflation', 'The nominal Treasury yield minus the TIPS yield of the same maturity: the inflation rate at which both would earn the same. It is the market\'s inflation expectation, plus a small risk premium.', () => `10-year breakeven: ${num(F.lastVal('T10YIE'), 2)}%.`],
    [['tips'], 'TIPS', 'Treasury Inflation-Protected Securities: principal rises with CPI, so the yield is a real (after-inflation) return if held to maturity.', () => `10-year TIPS real yield: ${num(F.lastVal('DFII10'), 2)}%.`],
    [['duration'], 'Duration', 'A bond\'s sensitivity to interest rates: a duration of 8 means about an 8% price fall if yields rise 1 percentage point.', null],
    [['hidden markov', 'hmm', 'regime model'], 'Hidden Markov model', 'A model that assumes the market switches between unobserved states (here calm, choppy, stress), each with its own average return and volatility, and infers the probability of each state from recent returns.', null],
    [['garch'], 'GARCH', 'A model in which today\'s volatility depends on yesterday\'s volatility and yesterday\'s surprise. The GJR version lets falls raise volatility more than rises, which fits stock markets.', null],
    [['efficient frontier'], 'Efficient frontier', 'The set of portfolios with the highest expected return for each level of risk, given assumptions about returns, volatilities and correlations.', null],
    [['risk parity'], 'Risk parity', 'A portfolio in which each asset contributes the same share of total risk, which usually means much more in bonds than in stocks.', null],
    [['monte carlo'], 'Monte Carlo simulation', 'Running thousands of random but realistic futures to see the range of outcomes rather than a single average.', null],
    [['auc'], 'AUC', 'How well a model ranks risky periods above safe ones: 0.5 is a coin flip, 1.0 is perfect.', null],
    [['brier'], 'Brier skill score', 'How much more accurate a model\'s probabilities are than simply using the base rate. Positive is better; 10% would be good for markets.', null],
    [['vix'], 'VIX', 'The market\'s expected volatility of the S&P 500 over the next 30 days, from option prices. Around 12-15 is calm, above 30 is stressed.', () => `Now: ${num(F.lastVal('^VIX'), 1)}.`],
    [['credit spread'], 'Credit spread', 'The extra yield a corporate bond pays over a Treasury of the same maturity, compensation for default risk. It widens when investors get nervous.', () => `Baa spread now: ${num(F.lastVal('BAA10Y'), 2)} pp.`],
    [['bear market'], 'Bear market', 'A decline of 20% or more from a high. A correction is a decline of 10-20%.', () => `S&P 500 now ${pct(F.drawdown('^GSPC').dd, 1)} from its high.`],
    [['rebalanc'], 'Rebalancing', 'Bringing a portfolio back to its target weights by selling what has grown and buying what has lagged, which keeps risk where you set it.', null],
    [['momentum'], 'Momentum', 'The tendency of assets that rose over the past 6-12 months to keep outperforming for a while. Strong historically, with sharp reversals.', null],
    [['etf'], 'ETF', 'Exchange-traded fund: a fund that trades like a stock. Most here track indexes cheaply (SPY, AGG, GLD).', null],
    [['real yield', 'real return'], 'Real return', 'Return after inflation. A 5% return with 3% inflation is roughly a 2% real return.', null]
  ];
  intent('explain', ['what is', "what's a", 'what are', 'what does', 'explain', 'define', 'meaning of', 'mean?', 'means'], (q) => {
    const n = N.norm(q), g = GLOSS.find(([keys]) => keys.some(k => n.includes(k)));
    if (!g) return null;
    return { md: `**${g[1]}.** ${g[2]}${g[3] ? '\n\n' + g[3]() : ''}`, follow: ['How accurate are your models?', 'Explain the efficient frontier', 'What is a drawdown?'] };
  });

  intent('method', ['how accurate', 'accuracy', 'track record', 'backtest', 'how does the model', 'how do you know', 'data source', 'where does the data', 'how often', 'updated', 'trust', 'methodology'], () => {
    const vm = FM.volModel(), bt = vm.backtest(), cp = FM.cape(), ev = FM.risk('dd10').evaluate(), rg = FM.regime(), ms = F.ST || {};
    return { md: `**Data:** Yahoo Finance (61 funds, indexes, futures and crypto, daily since 1990; S&P 500 since 1928), FRED (34 rate, credit, FX and commodity series), Robert Shiller (since 1871) and Kenneth French (since 1926). Last refresh ${K.isoLab((ms.fetched_at || '').slice(0, 10))}; runs automatically several times each weekday.\n\n**Out-of-sample track records:**\n- Volatility/VaR: 99% VaR breached ${num(bt.rate1, 2)}% of days vs 1% target (passes Kupiec and Christoffersen tests). Strong.\n- Regimes: separate next-month volatility (${pct(rg.fwd[0].vol, 0)} calm vs ${pct(rg.fwd[2].vol, 0)} stress) but not returns. Useful for risk.\n- CAPE: R² ${num(cp.r2oos, 2)} for 10-year returns vs the running average. Useful for long horizons.\n- Correction risk: AUC ${num(ev.auc, 2)}, Brier skill ${sgn(ev.bss * 100, 1, '%')}. Modest.\n\nEvery forecast is scored on data it did not see when it was made.`, extra: link('Open How it works', 'how'), follow: ['Is a correction likely?', 'What is a Brier skill score?'] };
  });

  intent('econ', ['gdp', 'unemployment', 'jobs report', 'economy', 'recession probability', 'payrolls', 'world economy'], () => ({ md: `Macro questions like growth, jobs and recession odds live in the **Economics** module, which has its own Ask AI with recession models and country data. From the markets side: the yield curve (10y minus 3m) is ${FV.pp(F.lastVal('DGS10') - F.lastVal('DGS3MO'))}, credit spreads are ${num(F.lastVal('BAA10Y'), 2)} pp, and the correction model reads ${pct(FM.risk('dd10').now.p * 100, 0)} for a 10% fall within six months.`, extra: `<a href="${esc(ECON_URL)}"${window.ATLAS_FIN_DATA ? ' target="_blank" rel="noopener"' : ''}>Open the Economics module →</a>`, follow: ['What does the yield curve say?', 'Is a correction likely?'] }));

  intent('asset', [], (q) => { const ids = findAssets(q); if (!ids.length) return null; return assetAnswer(ids[0]); }, { fallback: true });

  function assetAnswer(id) {
    const s = F.ser(id), q = F.quote(id);
    if (!s.log) return { md: `**${F.label(id)}** is **${F.fmtLevel(id, q.last)}** (${K.isoLab(q.date)}): ${FV.pp(F.chg(id, 21))} over a month, ${FV.pp(F.chg(id, 252))} over a year. Five years ago it was ${F.fmtLevel(id, F.at(id, FV.rangeStart('5Y', id)))}.`, extra: mini([id], '5Y'), follow: ['What does the yield curve say?', 'What happens to bonds if rates rise 1%?'] };
    const dd = F.drawdown(id), t = FM.trendStatus(id), v = F.vol(id), sp = id === '^GSPC' || id === 'SPY';
    const notes = id === 'BTC-USD' || id === 'ETH-USD' ? `\n\nCrypto is ${num(v / F.vol('SPY'), 0)}× as volatile as US stocks; since data start it has had ${FM.episodes(id, 0.5).length} declines of more than 50%.` : s.cls === 'vol' ? '\n\nVIX levels: about 12-15 calm, 20-25 elevated, 30+ stressed.' : '';
    return { md: `**${F.label(id)}**: ${F.money(id, q.last)} on ${K.isoLab(q.date)} (${P(q.pct, 2)} that day).\n- Month ${P(F.chg(id, 21))} · YTD ${P(F.ytd(id))} · 1 year ${P(F.chg(id, 252))}${ok(F.annRet(id, 5)) ? ` · 5 years ${P(F.annRet(id, 5))} a year` : ''}\n- ${pct(dd.dd, 1)} from its ${K.isoLab(dd.highDate)} high; volatility ${pct(v, 0)} a year\n- Trend: ${t && t.up ? 'above' : 'below'} its 200-day average (${sgn(t ? t.above : null, 1, '%')})${!sp && F.has('SPY') ? `; 1-year correlation with US stocks ${num((FM.scorecard().find(r => r.id === id) || {}).corr, 2)}` : ''}${notes}`, extra: mini([id], '1Y') + `<a href="#" data-asset="${esc(id)}">Full profile →</a>`, follow: [`Is ${F.short(id)} overvalued?`.replace('Is S&P 500', 'Are US stocks'), `Compare ${F.short(id)} vs gold`, 'Is a correction likely?'] };
  }

  /* ---------------- routing ---------------- */
  let ST = null;
  function answer(q, st) {
    ST = st; const n = N.norm(q);
    const scored = I.filter(x => !x.fallback).map(x => ({ x, s: N.score(n, x.words) })).filter(o => o.s > 0).sort((a, b) => b.s - a.s);
    // scenario and plan language wins when numbers describe a situation
    const pri = [];
    if (/^ (what is|what's|what are|what does|explain|define|meaning of)\b/.test(n) && GLOSS.some(([keys]) => keys.some(k => n.includes(k)))) pri.push('explain');
    if (/\b(19[2-9]\d|20[01]\d|202[0-5])\b/.test(n) && /happen|crash|crisis|bear|fall|fell|drop|during|in (19|20)\d\d/.test(n)) pri.push('history');
    if (parseShock(q) && /what if|if |scenario|shock|happens|stagflation|recession|soft landing/.test(n)) pri.push('scenario');
    if (/(retire|goal|reach|will i have|million|per month|a month|withdraw|save)/.test(n) && (N.money(n).length || N.years(n))) pri.push('plan');
    if (parsePortfolio(q) && !pri.length && !/what is|explain/.test(n)) pri.push('portfolio');
    const order = pri.map(id => I.find(x => x.id === id)).concat(scored.map(o => o.x));
    for (const it of order) { const r = it.fn(q); if (r) return pack(r); }
    const fb = I.find(x => x.id === 'asset').fn(q); if (fb) return pack(fb);
    return pack({ md: `I'm not sure how to answer that from this page's data. I can talk about any of the 60 markets and 34 rates tracked here, the forecasting models, and scenarios for your own portfolio. For example:`, follow: suggestions(st).slice(0, 5) });
  }
  const pack = r => ({ html: CH.md(r.md) + (r.extra ? `<div class="x">${r.extra}</div>` : ''), follow: r.follow });

  function suggestions(st) {
    const out = [], v = F.lastVal('^VIX'), dd = F.drawdown('^GSPC').dd, c3 = F.lastVal('DGS10') - F.lastVal('DGS3MO');
    if (st && st.tab === 'whatif') out.push('How risky is my lab mix?', 'What if rates rise 1%?');
    if (dd < -5) out.push('How long do corrections usually last?'); else out.push('Is a correction likely?');
    if (v > 22) out.push('Why is volatility elevated?');
    if (c3 < 0) out.push('What does the inverted yield curve mean?');
    out.push('Are US stocks overvalued?', "I'm 35 with $50k, saving $500 a month. Can I reach $1M by 65?", 'Stress-test a 60/40 portfolio', 'Which sectors are leading?', 'How is bitcoin doing?', 'What if stocks fall 30%?');
    return Array.from(new Set(out)).slice(0, 6);
  }
  const welcome = () => `<b>Ask about markets, forecasts or your own scenario.</b> Answers use this page's live data (through ${esc(K.isoLab(F.CAL[F.N - 1]))}) and its tested models, and say how much to trust them.`;

  /* ---------------- Claude: instructions, context and tools ---------------- */
  function contextPack(st) {
    const y = id => F.lastVal(id), cp = FM.cape(), rg = FM.regime(), d10 = FM.risk('dd10'), ap = FM.appetite(), vm = FM.volModel();
    const lines = [
      `Data through ${F.CAL[F.N - 1]} (refreshed ${(F.info().fetched || '').slice(0, 16)} UTC).`,
      ...FM.narrative(),
      `Key levels: S&P 500 ${num(F.lastVal('^GSPC'), 0)} (YTD ${P(F.ytd('^GSPC'))}), Nasdaq ${num(F.lastVal('^IXIC'), 0)}, 10-year ${num(y('DGS10'), 2)}%, 2-year ${num(y('DGS2'), 2)}%, 3-month ${num(y('DGS3MO'), 2)}%, fed funds ${num(y('DFF'), 2)}%, 10y TIPS ${num(y('DFII10'), 2)}%, 10y breakeven ${num(y('T10YIE'), 2)}%, Baa spread ${num(y('BAA10Y'), 2)} pp, VIX ${num(y('^VIX'), 1)}, DXY ${num(F.lastVal('DX-Y.NYB'), 1)}, gold ${num(F.lastVal('GC=F'), 0)}, WTI ${num(F.lastVal('CL=F'), 1)}, bitcoin ${num(F.lastVal('BTC-USD'), 0)}.`,
      `Models: regime ${rg.names[rg.state]} (${rg.names.map((n, k) => n + ' ' + Math.round(rg.now[k] * 100) + '%').join(', ')}); GARCH vol ${num(vm.volAnn, 1)}%, 1-day 99% VaR ${num(vm.varD.v99, 2)}%; correction (10% in 6m) ${Math.round(d10.now.p * 100)}% vs base ${Math.round(d10.baseRate * 100)}% (modest skill); CAPE ${num(cp.last.cape, 1)} (${Math.round(cp.pctile)}th pct) -> ${num(cp.fc, 1)}% real/yr next decade (90%: ${num(cp.lo, 0)} to ${num(cp.hi, 0)}); risk appetite ${Math.round(ap.now)}/100 ${ap.label}.`,
      `User is on the "${(TABS.find(t => t[0] === (st && st.tab)) || ['', ''])[1]}" tab. What-if lab mix: ${mixTxt(VL.frac(st))}.`
    ];
    return lines.join('\n');
  }
  const system = st => `You are Ask AI, the analyst built into "Probable Atlas · Finance", an educational markets dashboard made by Bruno Silva. You answer questions about the data, analytics, forecasts and recommendations on this page, and you run scenarios for the user's situation with the tools provided.

Rules:
- Get numbers from the tools or the context below; never invent figures. Cite dates for market levels.
- When you use a model, say how much to trust it (its out-of-sample record is in get_model).
- This is education, not personalized investment advice: explain trade-offs and evidence; do not tell the user to buy or sell a specific security; suggest a fee-only fiduciary adviser for big personal decisions.
- Be concise: lead with the answer, then 2-5 short bullets or sentences. Use Markdown. Use show_chart when a picture helps.
- If asked about macroeconomics (GDP, jobs, recessions), give the market angle and point to the Economics module.

Current context:
${contextPack(st)}`;

  function tools(st) {
    const sch = (props, req) => ({ type: 'object', properties: props, required: req || [] });
    return [
      { name: 'get_market_snapshot', description: 'Latest level and 1-day, 1-month, YTD and 1-year change for the main markets, plus active alerts and a plain-language summary.', execute: () => ({ asOf: F.CAL[F.N - 1], summary: FM.narrative(), alerts: FM.alerts().map(a => a.lvl + ': ' + a.title), markets: ['^GSPC', '^IXIC', '^RUT', 'EFA', 'EEM', 'AGG', 'TLT', 'GC=F', 'CL=F', 'BTC-USD', 'DX-Y.NYB', '^VIX'].map(id => ({ id, name: F.short(id), last: +F.lastVal(id).toFixed(2), d1: r2(F.quote(id).pct), m1: r2(F.chg(id, 21)), ytd: r2(F.ytd(id)), y1: r2(F.chg(id, 252)) })), rates: ['DGS3MO', 'DGS2', 'DGS10', 'DGS30', 'DFII10', 'T10YIE', 'DFF', 'BAA10Y', 'MORTGAGE30US'].map(id => ({ id, name: F.short(id), value: F.lastVal(id), m1: r2(F.chg(id, 21)), y1: r2(F.chg(id, 252)) })) }) },
      { name: 'search_assets', description: 'Find markets or rates by name or ticker (e.g. "gold", "japan", "QQQ", "mortgage"). Returns ids to use with other tools.', inputSchema: sch({ query: { type: 'string' } }, ['query']), execute: i => { const q = String(i.query || ''); const ids = findAssets(q).concat(Object.keys(F.P.s).filter(id => F.label(id).toLowerCase().includes(q.toLowerCase()) || id.toLowerCase() === q.toLowerCase())); return Array.from(new Set(ids)).slice(0, 10).map(id => ({ id, name: F.label(id) })); } },
      { name: 'get_asset', description: 'Detailed statistics for one market or rate: level, returns over many periods, volatility, drawdown, trend, beta and correlation with US stocks.', inputSchema: sch({ id: { type: 'string', description: 'Ticker or id from search_assets, e.g. SPY, ^GSPC, GC=F, DGS10' } }, ['id']), execute: i => { const id = resolve(i.id); if (!id) throw new Error('Unknown market: ' + i.id); const s = F.ser(id), sc = FM.scorecard().find(r => r.id === id); return { id, name: F.label(id), unit: s.log ? 'price' : s.unit, last: F.quote(id), since: F.CAL[s.s], d1: r2(F.quote(id).pct), w1: r2(F.chg(id, 5)), m1: r2(F.chg(id, 21)), m3: r2(F.chg(id, 63)), ytd: r2(F.ytd(id)), y1: r2(F.chg(id, 252)), ann3y: r2(F.annRet(id, 3)), ann5y: r2(F.annRet(id, 5)), ann10y: r2(F.annRet(id, 10)), vol1y: s.log ? r2(F.vol(id)) : null, drawdownFromHigh: s.log ? r2(F.drawdown(id).dd) : null, highDate: s.log ? F.drawdown(id).highDate : null, maxDrawdown: s.log ? F.maxDD(id) : null, trend: FM.trendStatus(id), betaToSP500: sc ? r2(sc.beta) : null, corrToSP500_1y: sc ? r2(sc.corr) : null }; } },
      { name: 'get_model', description: 'Current reading and out-of-sample track record for a model. name: regime, volatility, correction_risk, expected_returns, trend, risk_appetite, sector_rotation, stock_bond_correlation.', inputSchema: sch({ name: { type: 'string', enum: ['regime', 'volatility', 'correction_risk', 'expected_returns', 'trend', 'risk_appetite', 'sector_rotation', 'stock_bond_correlation'] } }, ['name']), execute: i => modelOut(String(i.name)) },
      { name: 'analyze_portfolio', description: 'Expected return, volatility, bad-year loss, risk contributions, past stress tests and a backtest for a portfolio. weights: percentages by asset class id (US, INTL, EM, BND, LTT, TIPS, CASH, GOLD, REIT, CMDTY, BTC). Omit to use the user\'s What-if lab mix.', inputSchema: sch({ weights: { type: 'object', additionalProperties: { type: 'number' } } }), execute: i => { const w = wFrac(i.weights && Object.keys(i.weights).length ? normW(i.weights) : lab().w), e = erNow(), s = FP.stats(w, e), bt = FP.backtest(w); return { mix: mixTxt(w), expectedReturn: r2(s.er), volatility: r2(s.vol), badYear5pct: r2(s.p5), goodYear95pct: r2(s.p95), sharpe: r2(s.sharpe), riskShare: FP.LAB.map((a, k) => ({ asset: a.short, weight: r2(w[k] * 100), risk: r2(s.rc[k] * 100) })).filter(x => x.weight > 0), stress: FP.stress(w).map(r => ({ episode: r.name, portfolio: r2(r.port), sp500: r2(r.sp) })), backtest: { from: bt.from, cagr: r2(bt.p.cagr), maxDD: r2(bt.p.mdd), worst12m: r2(bt.p.worst12) }, assumptions: FP.assumptions(lab().mode || 'forward').map((a, k) => ({ id: a.id, expReturn: r2(e[k]), basis: a.src })) }; } },
      { name: 'simulate_plan', description: 'Monte Carlo projection of savings or withdrawals. start ($), monthly ($, negative = withdrawal), years, goal ($), real (true = today\'s dollars). Optional weights as in analyze_portfolio.', inputSchema: sch({ start: { type: 'number' }, monthly: { type: 'number' }, years: { type: 'number' }, goal: { type: 'number' }, real: { type: 'boolean' }, weights: { type: 'object', additionalProperties: { type: 'number' } } }, ['start', 'years']), execute: i => { const w = wFrac(i.weights && Object.keys(i.weights).length ? normW(i.weights) : lab().w), s = FP.stats(w, erNow()); const sim = FP.simulate({ er: s.er, vol: s.vol, start: +i.start || 0, monthly: +i.monthly || 0, years: Math.max(1, Math.min(60, +i.years || 1)), goal: +i.goal || 0, real: i.real !== false, infl: F.lastVal('T10YIE'), sims: 1500, seed: 7 }); return { mix: mixTxt(w), expectedReturn: r2(s.er), volatility: r2(s.vol), probGoal: sim.pGoal, probRunOut: sim.pBroke, median: Math.round(sim.median), p10: Math.round(sim.p10), p90: Math.round(sim.p90), typicalWorstDrop: r2(sim.mddMed) }; } },
      { name: 'run_scenario', description: 'Estimated immediate effect of market shocks on each asset class and a portfolio. Factors you leave out move by their typical co-movement with the ones you set. Either name (Equity crash, Stagflation, Rate shock, Recession, Soft landing, Dollar surge, Oil spike) or shocks: eq (% US stocks), rates (pp 10-year yield), credit (pp Baa spread), usd (% dollar), oil (% WTI), infl (pp 10-year breakeven).', inputSchema: sch({ name: { type: 'string' }, shocks: { type: 'object', properties: { eq: { type: 'number' }, rates: { type: 'number' }, credit: { type: 'number' }, usd: { type: 'number' }, oil: { type: 'number' }, infl: { type: 'number' } } }, weights: { type: 'object', additionalProperties: { type: 'number' } } }), execute: i => { const sc = FP.SCEN.find(s => s[0].toLowerCase() === String(i.name || '').toLowerCase()); const given = Object.assign({}, sc ? sc[1] : {}, i.shocks || {}); const sh = sc ? given : FP.conditional(given); const w = wFrac(i.weights && Object.keys(i.weights).length ? normW(i.weights) : lab().w), r = FP.shock(w, sh); return { shocksGiven: given, shocksUsed: sh, note: sc ? 'named scenario' : 'unspecified factors set to their expected move given the specified ones (last five years of weekly data)', portfolio: r2(r.port), mix: mixTxt(w), byAsset: r.per.map((p, k) => ({ asset: FP.LAB[k].short, move: r2(p.r), modelR2: r2(p.r2) })) }; } },
      { name: 'get_history', description: 'Historical facts. topic: crashes (20%+ declines since 1928), big_days, intra_year (yearly declines vs returns), rolling_returns (real returns by holding period since 1871), calendar_years (asset-class returns by year), seasonality (average by month since 1926).', inputSchema: sch({ topic: { type: 'string', enum: ['crashes', 'big_days', 'intra_year', 'rolling_returns', 'calendar_years', 'seasonality'] } }, ['topic']), execute: i => histOut(String(i.topic)) },
      { name: 'get_recommendations', description: 'Evidence-based recommendation cards and a suggested starting mix for a profile. horizon: short | mid | long; risk: low | med | high.', inputSchema: sch({ horizon: { type: 'string', enum: ['short', 'mid', 'long'] }, risk: { type: 'string', enum: ['low', 'med', 'high'] } }), execute: i => { const p = { horizon: i.horizon || 'long', risk: i.risk || 'med' }, c = VRF.context(), strip = h => String(h).replace(/<[^>]+>/g, ''); return { profile: p, suggestedMix: VRF.suggested(p, c), cards: VRF.recs(p, c).slice(0, 6).map(r => ({ title: r.title, confidence: r.confidence, problem: strip(r.problem), evidence: strip(r.evidence), impact: strip(r.impact), tradeoffs: strip(r.tradeoffs), how: strip(r.how) })) }; } },
      { name: 'list_charts', description: 'Names of charts show_chart can draw.', execute: () => ({ kinds: ['price (ids[0], range)', 'compare (ids, range)', 'regime', 'volatility', 'correction_risk', 'cape', 'yield_curve', 'stock_bond', 'risk_appetite', 'drawdowns'] }) },
      { name: 'open_tab', description: 'Navigate the page for the user. tab: live, markets, models, whatif, recs, history, how. Optional asset id to open its profile.', inputSchema: sch({ tab: { type: 'string' }, asset: { type: 'string' } }), execute: i => { if (i.asset) { const id = resolve(i.asset); if (id) { FV.openAsset(id); return 'Opened ' + F.label(id); } } if (TABS.find(t => t[0] === i.tab)) { APP.go({ tab: i.tab }); return 'Opened ' + i.tab; } throw new Error('Unknown tab'); } }
    ];
  }
  const r2 = v => (ok(v) ? Math.round(v * 100) / 100 : null);
  function normW(obj) { const out = {}; for (const [k, v] of Object.entries(obj)) { const up = String(k).toUpperCase(); const id = FP.IDS.includes(up) ? up : (FP.LAB.find(a => a.px === up) || {}).id || (LABMAP.find(([m]) => String(k).toLowerCase().includes(m)) || [])[1]; if (id) out[id] = (out[id] || 0) + (+v || 0); } return out; }
  function modelOut(name) {
    if (name === 'regime') { const rg = FM.regime(); return { asOf: rg.asOf, probabilities: Object.fromEntries(rg.names.map((n, k) => [n, r2(rg.now[k])])), in13weeks: Object.fromEntries(rg.names.map((n, k) => [n, r2(rg.in13[k])])), annualized: rg.names.map((n, k) => ({ regime: n, ret: r2(rg.ann[k].ret), vol: r2(rg.ann[k].vol), typicalWeeks: r2(rg.dur[k]) })), outOfSample: { from: rg.oosFrom, nextMonthVol: rg.fwd.map(f => r2(f.vol)), nextMonthRet: rg.fwd.map(f => r2(f.ret)), note: 'Separates volatility, not returns' } }; }
    if (name === 'volatility') { const vm = FM.volModel(), bt = vm.backtest(); return { annualVolForecast: r2(vm.volAnn), next21days: r2(vm.vol21), longRun: r2(vm.longRun), dailySD: r2(vm.sdDay), VaR1d: vm.varD, VaR1m: vm.varM, vix: F.lastVal('^VIX'), params: vm.fit, backtest: { from: bt.from, days: bt.n, breach99pct: r2(bt.rate1), kupiecP99: r2(bt.k1.p), breach95pct: r2(bt.rate5), kupiecP95: r2(bt.k5.p), christoffersenP99: r2(bt.c1.p) } }; }
    if (name === 'correction_risk') return ['pull5', 'dd10', 'bear20'].map(k => { const m = FM.risk(k), e = m.evaluate(); return { model: m.spec.label, probability: r2(m.now.p), baseRate: r2(m.baseRate), drivers: m.contrib.map(c => ({ input: c.name, effectLogOdds: r2(c.c) })), outOfSample: { from: e.from, auc: r2(e.auc), brierSkill: r2(e.bss), riskiestFifthHitRate: r2(e.topHit), safestFifthHitRate: r2(e.botHit) } }; });
    if (name === 'expected_returns') { const cp = FM.cape(), bf = FM.buffett(); return { cape: cp.last.cape, capeMonth: cp.last.key, percentile: r2(cp.pctile), forecastReal10y: r2(cp.fc), range90: [r2(cp.lo), r2(cp.hi)], r2InSample: r2(cp.fit.r2), r2OutOfSample: r2(cp.r2oos), excessCapeYield: r2(cp.ecyNow), marketCapToGDP: bf ? r2(bf.last.v) : null, labAssumptions: FP.assumptions('forward').map(a => ({ id: a.id, expReturn: r2(a.er), basis: a.src })) }; }
    if (name === 'trend') { const tr = FM.trend(); return { rule: '10-month moving average on US stocks, else T-bills', from: tr.from, all: tr.all, since1990: tr.since1990, since2010: tr.since2010, switches: tr.switches, today: ['SPY', 'QQQ', 'EFA', 'EEM', 'AGG', 'TLT', 'GLD', 'BTC-USD'].map(id => ({ id, ...FM.trendStatus(id) })) }; }
    if (name === 'risk_appetite') { const ap = FM.appetite(); return { score: r2(ap.now), label: ap.label, weekAgo: r2(ap.week), monthAgo: r2(ap.month), components: ap.comps.map(([k, n]) => ({ component: n, percentile: r2(ap.parts[k][F.N - 1]) })), forwardReturnsByBucket: ap.bucket.map(b => ({ bucket: b.name, days: b.n, next3mAvg: r2(b.r63) })) }; }
    if (name === 'sector_rotation') return FM.rotation().map(r => ({ id: r.id, name: r.name, quadrant: r.quad, relStrength13w: r2(r.x), change4w: r2(r.y), m1: r2(F.chg(r.id, 21)) }));
    if (name === 'stock_bond_correlation') { const sb = FM.stockBond(); return { now52w: r2(sb.now), note: 'Negative about 2000-2021; positive since 2022' }; }
    throw new Error('Unknown model');
  }
  function histOut(topic) {
    if (topic === 'crashes') return FM.crashes().map(c => ({ peak: c.peak, trough: c.trough, recovered: c.rec, declinePct: r2(c.depth), monthsDown: r2(c.down), monthsToRecover: r2(c.back) }));
    if (topic === 'big_days') { const b = FM.bigDays(); return { worst: b.worst, best: b.best, daysSince1928: b.n }; }
    if (topic === 'intra_year') { const iy = FM.intraYear(); return { years: iy.n, yearsWith10pctDecline: iy.n10, ofThoseEndedUp: iy.posAfter10, yearsUp: iy.pos, medianIntraYearDecline: r2(iy.medDD), last20: iy.rows.slice(-20).map(r => ({ year: r.y, ret: r2(r.r), maxDecline: r2(r.dd) })) }; }
    if (topic === 'rolling_returns') return FM.rolling();
    if (topic === 'calendar_years') { const q = FM.calYears(); return { years: q.years, assets: q.ids.map((id, i) => ({ id, returns: q.M[i].map(r2) })) }; }
    if (topic === 'seasonality') { const mg = FM.monthGrid(); return K.MON.map((m, k) => ({ month: m, avg: r2(mg.avg[k]), pctUp: r2(mg.up[k]) })); }
    throw new Error('Unknown topic');
  }
  function chart(inp) {
    const kind = String(inp.kind || ''), ids = (inp.ids || []).map(resolve).filter(Boolean), range = inp.range || (kind === 'compare' ? '3Y' : '1Y');
    if ((kind === 'price' || kind === 'compare') && ids.length) return `<div class="kicker">${esc(ids.map(F.short).join(' vs '))} · ${esc(range)}</div>` + mini(ids, range, 190);
    if (kind === 'yield_curve') return FV.curveChart([['Latest', F.N - 1], ['1 year ago', F.N - 253]], 190);
    if (kind === 'regime') { const rg = FM.regime(), t0 = rg.xi.findIndex(i => i >= FV.rangeStart('3Y')), lo = [], mid = [], hi = []; for (let t = t0; t < rg.n; t++) { const p = rg.filtAt(t), x = F.X[rg.xi[t]]; lo.push([x, p[0]]); mid.push([x, p[0] + p[1]]); hi.push([x, 1]); } return '<div class="kicker">Regime probabilities, 3 years</div>' + C.line({ series: [], bands: [{ lo: lo.map(p => [p[0], 0]), hi: lo, color: rg.colors[0], op: 0.75, name: 'Calm' }, { lo, hi: mid, color: rg.colors[1], op: 0.75, name: 'Choppy' }, { lo: mid, hi, color: rg.colors[2], op: 0.75, name: 'Stress' }], h: 150, y0: 0, y1: 1, yFmt: v => num(v * 100, 0) + '%', tipX: F.xLab }); }
    if (kind === 'volatility') { const vm = FM.volModel(), i0 = FV.rangeStart('3Y'); return '<div class="kicker">GARCH volatility forecast vs VIX</div>' + C.line({ series: [{ name: 'GARCH', pts: F.seriesPts(vm.condVol, i0, F.N - 1), color: 'var(--s1)' }, { name: 'VIX', pts: F.pts('^VIX', i0, F.N - 1), color: 'var(--s4)', width: 1.4 }], h: 180, yFmt: v => num(v, 0) + '%', tipX: F.xLab }); }
    if (kind === 'correction_risk') { const ev = FM.risk('dd10').evaluate(); return '<div class="kicker">Correction model (out of sample)</div>' + C.line({ series: [{ name: 'Model', pts: ev.oos.map(o => [F.X[o.i], o.p * 100]), color: 'var(--s7)' }, { name: 'Base rate', pts: ev.oos.map(o => [F.X[o.i], o.base * 100]), color: 'var(--axis)', dash: '4 3', width: 1.3 }], h: 180, y0: 0, yFmt: v => num(v, 0) + '%', tipX: F.xLab }); }
    if (kind === 'cape') { const cp = FM.cape(); return '<div class="kicker">Shiller CAPE since 1881</div>' + C.line({ series: [{ name: 'CAPE', pts: cp.rows.filter((_, k) => k % 3 === 0).map(r => [r.x, r.cape]), color: 'var(--s1)' }], hlines: [{ y: cp.median, label: 'Median', color: 'var(--ink-2)' }], h: 180, yFmt: v => num(v, 0), tipX: x => String(Math.floor(x)) }); }
    if (kind === 'stock_bond') { const sb = FM.stockBond(); return '<div class="kicker">Stock-bond correlation, 52 weeks</div>' + C.line({ series: [{ name: 'Correlation', pts: sb.synth, color: 'var(--s1)' }], h: 170, y0: -1, y1: 1, yFmt: v => num(v, 1), tipX: F.xLab }); }
    if (kind === 'risk_appetite') { const ap = FM.appetite(), i0 = FV.rangeStart('3Y'); return '<div class="kicker">Risk appetite, 3 years</div>' + C.line({ series: [{ name: 'Score', pts: F.seriesPts(ap.score, i0, F.N - 1), color: 'var(--s7)' }], h: 170, y0: 0, y1: 100, yFmt: v => num(v, 0), tipX: F.xLab }); }
    if (kind === 'drawdowns') { const id = ids[0] || '^GSPC', s = F.ser(id), dd = new Float64Array(F.N).fill(NaN); let hi = -Infinity; for (let i = s.s; i <= s.e; i++) { hi = Math.max(hi, s.v[i]); dd[i] = (s.v[i] / hi - 1) * 100; } const i0 = FV.rangeStart(range === '1Y' ? 'MAX' : range, id); return `<div class="kicker">${esc(F.short(id))} drawdowns</div>` + C.line({ series: [{ name: 'Drawdown', pts: F.seriesPts(dd, i0, s.e), color: 'var(--s2)', area: true }], h: 170, yFmt: v => num(v, 0) + '%', tipX: F.xLab }); }
    return null;
  }

  function adapter() { return { answer, suggestions, welcome, system, tools, chart }; }
  return { adapter, findAssets, parsePortfolio, parsePlan, parseShock, answer, contextPack };
})();
