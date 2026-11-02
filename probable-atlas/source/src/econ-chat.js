/* Probable Atlas · Economics: the Ask Atlas adapter (built-in analyst over World Bank, IMF and FRED data and the module's models,
   plus the tool set Claude uses when it is available). */
const ECHAT = (() => {
  const { esc, ok, num, pct, sgn } = K, N = CH.NLU;
  let ST = null;

  /* ---------------- entities ---------------- */
  const CALIAS = { 'us': 'USA', 'u.s.': 'USA', 'usa': 'USA', 'america': 'USA', 'united states': 'USA', 'the states': 'USA', 'uk': 'GBR', 'britain': 'GBR', 'england': 'GBR', 'united kingdom': 'GBR', 'south korea': 'KOR', 'korea': 'KOR', 'russia': 'RUS', 'china': 'CHN', 'germany': 'DEU', 'japan': 'JPN', 'india': 'IND', 'brazil': 'BRA', 'mexico': 'MEX', 'canada': 'CAN', 'france': 'FRA', 'italy': 'ITA', 'spain': 'ESP', 'turkey': 'TUR', 'türkiye': 'TUR', 'argentina': 'ARG', 'egypt': 'EGY', 'iran': 'IRN', 'vietnam': 'VNM', 'saudi': 'SAU', 'saudi arabia': 'SAU', 'uae': 'ARE', 'emirates': 'ARE', 'south africa': 'ZAF', 'nigeria': 'NGA', 'indonesia': 'IDN', 'australia': 'AUS', 'netherlands': 'NLD', 'holland': 'NLD', 'switzerland': 'CHE', 'sweden': 'SWE', 'norway': 'NOR', 'poland': 'POL', 'israel': 'ISR', 'chile': 'CHL', 'colombia': 'COL', 'peru': 'PER', 'philippines': 'PHL', 'thailand': 'THA', 'malaysia': 'MYS', 'singapore': 'SGP', 'pakistan': 'PAK', 'bangladesh': 'BGD', 'venezuela': 'VEN', 'portugal': 'PRT', 'greece': 'GRC', 'ireland': 'IRL', 'cape verde': 'CPV', 'cabo verde': 'CPV', 'angola': 'AGO', 'mozambique': 'MOZ', 'kenya': 'KEN', 'ethiopia': 'ETH', 'ghana': 'GHA', 'morocco': 'MAR', 'ukraine': 'UKR', 'taiwan': 'TWN', 'hong kong': 'HKG', 'new zealand': 'NZL' };
  const DEMONYM = { american: 'USA', british: 'GBR', chinese: 'CHN', german: 'DEU', japanese: 'JPN', indian: 'IND', brazilian: 'BRA', mexican: 'MEX', canadian: 'CAN', french: 'FRA', italian: 'ITA', spanish: 'ESP', turkish: 'TUR', argentine: 'ARG', argentinian: 'ARG', russian: 'RUS', korean: 'KOR', australian: 'AUS', portuguese: 'PRT', nigerian: 'NGA', 'south african': 'ZAF', egyptian: 'EGY', indonesian: 'IDN', swiss: 'CHE', dutch: 'NLD', greek: 'GRC', irish: 'IRL', polish: 'POL', israeli: 'ISR', saudi: 'SAU', vietnamese: 'VNM' };
  let NAMES = null;
  function countries(raw) {
    const q = N.norm(raw); if (!NAMES) { NAMES = []; for (const c of E.COUNTRIES) NAMES.push([c.name.toLowerCase(), c.iso]); for (const [a, iso] of Object.entries(CALIAS)) NAMES.push([a, iso]); for (const [a, iso] of Object.entries(DEMONYM)) NAMES.push([a, iso]); NAMES.sort((a, b) => b[0].length - a[0].length); }
    const found = []; let rest = q;
    for (const [n, iso] of NAMES) { const re = new RegExp(`[\\s(]${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:'s)?[\\s).,?]`); const m = rest.match(re); if (m && E.BYISO[iso]) { found.push({ iso, i: m.index }); rest = rest.slice(0, m.index) + ' '.repeat(m[0].length) + rest.slice(m.index + m[0].length); } }
    if (/\b(world|global)\b/.test(q)) found.push({ iso: 'WLD', i: q.search(/\b(world|global)\b/) });
    const seen = new Set(); return found.sort((a, b) => a.i - b.i).map(f => f.iso).filter(x => !seen.has(x) && seen.add(x));
  }
  const IALIAS = [[/next year'?s? growth|growth next year|growth forecast|grow next year/, 'g1'], [/youth unemployment/, 'youth'], [/per (capita|person)|income per|how rich|richest|poorest|gdp per/, 'gdppc'], [/\bppp\b/, 'ppppc'], [/unemployment|jobless|joblessness/, 'unemp'], [/inflation|prices|cost of living/, 'inf'], [/debt to gdp|government debt|public debt|national debt|\bdebt\b/, 'debt'], [/deficit|budget|fiscal balance/, 'bal'], [/current account/, 'ca'], [/\btrade\b|openness/, 'trade'], [/\bfdi\b|foreign direct investment/, 'fdi'], [/reserves/, 'res'], [/external debt/, 'xdebt'], [/investment/, 'inv'], [/savings/, 'sav'], [/manufacturing/, 'manuf'], [/r&d|research/, 'rd'], [/internet/, 'net'], [/corruption/, 'cc'], [/rule of law/, 'rl'], [/government effectiveness|governance/, 'ge'], [/inequality|gini/, 'gini'], [/poverty|poor people/, 'pov'], [/life expectancy/, 'life'], [/population|people live/, 'pop'], [/share of (the )?world/, 'share'], [/biggest economy|largest economy|size of the economy|\bgdp\b(?! growth)/, 'gdp'], [/growth|growing|grow|expansion/, 'g']];
  const indicatorOf = raw => { const q = N.norm(raw); const m = IALIAS.find(([re]) => re.test(q)); return m ? m[1] : null; };
  const nameOf = iso => iso === 'WLD' ? 'the world' : E.name(iso);
  const val = (id, iso) => { const ind = E.indById(id); return ind ? ind.get(iso) : null; };
  const fmt = (id, v) => E.fmtInd(E.indById(id), v);
  const link = (label, tab, scope) => `<a href="#" data-goto="${tab}"${scope ? ` data-scopeto-tab="${esc(scope)}"` : ''}>${esc(label)} →</a>`;
  const clink = iso => iso === 'WLD' ? 'World' : `<a href="#" data-country="${esc(iso)}">${esc(E.name(iso))}</a>`;
  const rankOf = (id, iso) => { const col = E.column(id), ind = E.indById(id), arr = Object.entries(col).sort((a, b) => (b[1] - a[1]) * (ind.good === -1 ? -1 : 1)); const k = arr.findIndex(([i]) => i === iso); return k >= 0 ? { r: k + 1, n: arr.length } : null; };
  const world = id => { const W = { g: ['NGDP_RPCH', E.CY], g1: ['NGDP_RPCH', E.CY + 1], inf: ['PCPIPCH', E.CY] }[id]; return W ? E.imf(W[0], 'WEOWORLD', W[1]) : null; };

  /* ---------------- US helpers ---------------- */
  const lastRaw = id => { const r = E.raw(id); return r && r.length ? r[r.length - 1][1] : null; };
  function latestUS(id) { const s = E.us(id); if (!s) return null; if (s.r && s.r.length) { const [d, v] = s.r[s.r.length - 1]; return { v, date: String(d).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') }; } if (s.k === 'q') { const qs = E.qSeries(id), q = E.qLast(qs); return { v: E.qAt(qs, q), date: K.qLab(q) }; } const ms = E.mSeries(id); if (ms) { const t = E.mLast(ms); return { v: E.mAt(ms, t), date: K.mLab(t) }; } return null; }
  const mLastVal = id => { const ms = E.mSeries(id); if (!ms) return null; const t = E.mLast(ms); return { v: E.mAt(ms, t), t }; };
  function usBase() { const inf = M.inflation(), un = E.mSeries('UNRATE'), core = E.mYoY(E.mSeries('CPILFESL')); return { ff: lastRaw('DFF'), y3m: lastRaw('DGS3MO'), y10: lastRaw('DGS10'), nfci: lastRaw('NFCI'), core: E.mAt(core, E.mLast(core)), corePCE: M.latestCorePCE(), gap: M.outputGap().v, rstar: 1.0, unemp: E.mAt(un, E.mLast(un)), mich: inf && inf.xNow ? inf.xNow[2] : null, oil: inf ? inf.oil : null }; }
  function parseUS(raw) { // "fed cuts 1%", "rates rise 50bp", "oil hits $120", "unemployment rises to 6%", "10-year at 5.5%"
    const q = N.norm(raw), b = usBase(), sc = Object.assign({}, b), notes = [];
    const n = s => parseFloat(s);
    let m;
    if ((m = q.match(/(?:fed|fed funds|policy rate|interest rates?|rates?)\s(?:\w+\s){0,2}?(cut|cuts|lower|lowers|fall|falls|drop|drops|hike|hikes|raise|raises|rise|rises|up|down)\s(?:\w+\s){0,2}?(?:by\s)?(\d+(?:\.\d+)?)\s?(%|bp|bps|basis points|points?|pp)?/))) { let v = n(m[2]); if (/bp|basis/.test(m[3] || '') || v >= 20) v /= 100; const d = /cut|lower|fall|drop|down/.test(m[1]) ? -v : v; sc.ff = b.ff + d; sc.y3m = b.y3m + d; notes.push(`fed funds ${sgn(d, 2, ' pp')}`); }
    if ((m = q.match(/(?:10-year|10 year|long rates?|treasury yield)\s(?:\w+\s){0,2}?(?:to|at|hits?|reaches?)\s(\d+(?:\.\d+)?)/))) { sc.y10 = n(m[1]); notes.push(`10-year at ${num(sc.y10, 2)}%`); }
    if ((m = q.match(/oil\s(?:\w+\s){0,2}?(?:to|at|hits?|reaches?)\s\$?(\d+)/))) { sc.oil = n(m[1]); notes.push(`oil at $${m[1]}`); }
    else if ((m = q.match(/oil\s(?:\w+\s){0,2}?(rise|rises|spike|spikes|jump|jumps|fall|falls|drop|drops)\s(?:by\s)?(\d+)\s?%/))) { const f = /fall|drop/.test(m[1]) ? -1 : 1; sc.oil = b.oil * (1 + f * n(m[2]) / 100); notes.push(`oil ${f > 0 ? '+' : '−'}${m[2]}%`); }
    if ((m = q.match(/unemployment\s(?:\w+\s){0,2}?(?:to|at|hits?|reaches?)\s(\d+(?:\.\d+)?)/))) { sc.unemp = n(m[1]); sc.gap = (b.gap || 0) - 2 * (sc.unemp - b.unemp); notes.push(`unemployment ${num(sc.unemp, 1)}%`); }
    if ((m = q.match(/inflation expectations?\s(?:\w+\s){0,2}?(?:to|at)\s(\d+(?:\.\d+)?)/))) { sc.mich = n(m[1]); notes.push(`expected inflation ${m[1]}%`); }
    if (/financial (stress|crisis)|credit crunch|banking crisis/.test(q)) { sc.nfci = b.nfci + 1; sc.y10 = b.y10 - 0.5; sc.unemp = b.unemp + 1; sc.gap = (b.gap || 0) - 1.5; notes.push('a credit crunch (financial conditions +1, unemployment +1 pp)'); }
    return notes.length ? { sc, base: b, notes } : null;
  }

  /* ---------------- intents ---------------- */
  const I = [];
  const intent = (id, words, fn) => I.push({ id, words, fn });
  intent('help', [/\b(hi|hello|hey)\b/, 'what can you do', 'help', 'how do i use'], () => ({ md: `I'm the built-in analyst for **Probable Atlas · Economics**: World Bank, IMF and Federal Reserve data for ${E.COUNTRIES.length}+ economies, plus the module's forecasting models. Try:\n- "How is Brazil's economy doing?" or "Compare Germany and France"\n- "Which countries have the highest inflation?"\n- "Will the US go into recession?" or "What's the inflation outlook?"\n- "What if the Fed cuts rates by 1%?" or "What if oil hits $120?"\n- "What should Argentina do?" or "What is the Sahm rule?"`, follow: suggestions(ST).slice(0, 4) }));

  intent('recession', ['recession', 'contraction', 'downturn', 'hard landing', 'soft landing'], (q) => {
    const c = countries(q).filter(x => x !== 'WLD'), iso = c[0];
    if (iso && iso !== 'USA') return countryRisk(iso);
    const rec = M.recession(), cl = rec.models.classic, ex = rec.models.extended, nc = M.nowcast(), sahm = mLastVal('SAHMREALTIME');
    const sc = m => m && m.score ? `AUC ${num(m.score.auc, 2)}${m.score.brier0 ? `, Brier ${num(m.score.brier, 3)} vs ${num(m.score.brier0, 3)} base` : ''}` : '';
    return { md: `**US recession odds (12 months ahead), probit models:**\n- Yield curve only: **${pct(cl.pNow * 100, 0)}** (${sc(cl)}, out of sample since 1985)\n- Curve + real policy rate + financial conditions: **${pct(ex.pNow * 100, 0)}** (${sc(ex)})\n\n${nc ? `**Nowcast:** GDP growth this quarter about **${sgn(nc.est, 1, '%')}** annualized (80% range ${num(nc.lo, 1)} to ${num(nc.hi, 1)}); last official ${sgn(nc.lastActual, 1, '%')}.` : ''}${sahm ? ` **Sahm rule** indicator: ${num(sahm.v, 2)} (a reading of 0.50+ has marked the early months of past recessions).` : ''}\n\nYield-curve models gave early warnings before most past recessions but also false alarms, notably after the 2022-24 inversion; read them as risk levels, not calls.`, extra: link('Open the recession models', 'models'), follow: ['What is the inflation outlook?', 'What if the Fed cuts rates by 1%?', 'What is the Sahm rule?'] };
  });

  intent('inflation_us', ['inflation outlook', 'inflation forecast', 'is inflation', 'will inflation', 'cpi', 'core inflation', 'pce'], (q) => {
    const c = countries(q).filter(x => x !== 'USA'); if (c.length) return null;
    const inf = M.inflation(), ty = M.taylor(); if (!inf) return null;
    const p12 = inf.path[inf.path.length - 1];
    return { md: `**US inflation:** CPI ${num(inf.now, 1)}% over 12 months; core ${num(inf.core, 1)}%. The model (current inflation, recent core momentum, household expectations, unemployment gap, oil) projects **${num(p12[1], 1)}%** in 12 months (80% range ${num(p12[2], 1)}% to ${num(p12[3], 1)}%).\n\nOut-of-sample 12-month error since 2000: RMSE ${num(inf.score.rmse, 2)} pp vs ${num(inf.score.rw, 2)} for "inflation stays where it is" and ${num(inf.score.mich, 2)} for household expectations.${ty ? `\n\n**Taylor rule** (core PCE ${num(ty.core, 1)}%, output gap ${sgn(ty.gap, 1, '%')}): fed funds of about ${num(ty.classic, 1)}% vs the actual ${num(lastRaw('DFF'), 2)}%.` : ''}`, extra: link('Open the inflation model', 'models'), follow: ['Will the US go into recession?', 'What if oil hits $120?', 'Which countries have the highest inflation?'] };
  });

  intent('whatif', ['what if', 'what happens if', 'scenario', 'if the fed', 'if rates', 'if oil', 'if unemployment'], (q) => {
    const p = parseUS(q); if (!p) return null;
    const r = M.usScenario(p.sc), b = M.usScenario(p.base);
    const inf12 = r.path ? r.path[r.path.length - 1][1] : null, base12 = b.path ? b.path[b.path.length - 1][1] : null;
    return { md: `**Scenario: ${p.notes.join(', ')}.** Re-running the module's fitted models:\n- Recession odds (curve only): **${pct(r.pC * 100, 0)}** vs ${pct(b.pC * 100, 0)} today\n- Recession odds (curve + policy + conditions): **${pct(r.pE * 100, 0)}** vs ${pct(b.pE * 100, 0)} today\n${ok(inf12) ? `- Inflation in 12 months: **${num(inf12, 1)}%** vs ${num(base12, 1)}% on today's inputs\n` : ''}${r.taylor ? `- Taylor-rule fed funds: ${num(r.taylor.classic, 1)}%\n` : ''}\nThese are the same coefficients the Models tab uses, so the scenario shows what the models imply, not what will happen.`, extra: link('Fine-tune it in the What-if lab', 'whatif'), follow: ['What if unemployment rises to 6%?', 'What if oil hits $120?', 'Will the US go into recession?'] };
  });

  intent('rank', ['highest', 'lowest', 'fastest', 'slowest', 'most', 'least', 'top', 'richest', 'poorest', 'biggest', 'largest', 'smallest', 'which countries', 'rank', 'best', 'worst'], (q) => {
    const n = N.norm(q), id = indicatorOf(q) || (/richest|poorest/.test(n) ? 'gdppc' : /biggest|largest/.test(n) ? 'gdp' : null); if (!id) return null;
    const ind = E.indById(id), col = E.column(id), low = /lowest|slowest|least|smallest|poorest|worst/.test(n) !== (ind.good === -1 && /best/.test(n));
    const big = /\b(g20)\b/.test(n) ? E.G20 : /\b(major|big|large) (economies|countries)\b/.test(n) ? E.COUNTRIES.filter(c => c.top40).map(c => c.iso) : null;
    const arr = Object.entries(col).filter(([iso]) => !big || big.includes(iso)).sort((a, b) => low ? a[1] - b[1] : b[1] - a[1]).slice(0, 10);
    return { md: `**${low ? 'Lowest' : 'Highest'}: ${ind.lab}${big ? ' (' + (/g20/.test(n) ? 'G20' : 'top 40 economies') + ')' : ''}:**\n${arr.map(([iso, v], k) => `${k + 1}. ${E.name(iso)}: ${fmt(id, v)}`).join('\n')}${world(id) != null ? `\n\nWorld: ${fmt(id, world(id))}.` : ''}\n\nSource: ${ind.src}.`, extra: link('See the full table', 'indicators'), follow: [`Why is ${E.name(arr[0][0])}'s ${ind.short.toLowerCase()} so ${low ? 'low' : 'high'}?`, 'Compare the US and China', 'Which economies are growing fastest?'] };
  });

  intent('compare', [' vs ', ' versus ', 'compare', ' and '], (q) => {
    const c = countries(q).filter(x => x !== 'WLD'); if (c.length < 2) return null;
    const ids = ['g', 'g1', 'inf', 'unemp', 'debt', 'bal', 'gdppc', 'ca'];
    return { md: `| Indicator | ${c.slice(0, 3).map(E.name).join(' | ')} |\n|---|${c.slice(0, 3).map(() => '---').join('|')}|\n${ids.map(id => `| ${E.indById(id).short} | ${c.slice(0, 3).map(iso => fmt(id, val(id, iso))).join(' | ')} |`).join('\n')}\n\nSources: IMF ${E.VINT}; World Bank.`, extra: c.slice(0, 3).map(clink).join(' · '), follow: [`What should ${E.name(c[0])} do?`, `How fast will ${E.name(c[1])} grow next year?`] };
  });

  intent('indicator', [/growth|inflation|unemployment|debt|deficit|budget|current account|per capita|gdp|trade|reserves|poverty|inequality|population|corruption|investment|manufacturing/], (q) => {
    const id = indicatorOf(q); const c = countries(q); if (!id) return null;
    const iso = c[0] || (ST && ST.scope) || 'WLD';
    if (iso === 'WLD') { const w = world(id); if (w == null) return null; return { md: `**World** · ${E.indById(id).lab}: **${fmt(id, w)}** (IMF, ${E.VINT}). Advanced economies: ${fmt(id, E.imf(id === 'inf' ? 'PCPIPCH' : 'NGDP_RPCH', 'ADVEC', id === 'g1' ? E.CY + 1 : E.CY))}; emerging and developing: ${fmt(id, E.imf(id === 'inf' ? 'PCPIPCH' : 'NGDP_RPCH', 'OEMDC', id === 'g1' ? E.CY + 1 : E.CY))}.`, extra: link('Open the world map', 'live'), follow: ['Which economies are growing fastest?', 'Which countries have the highest inflation?'] }; }
    const ind = E.indById(id), v = val(id, iso), rk = rankOf(id, iso), peers = E.peers(iso).map(p => val(id, p.iso)).filter(ok), med = S.median(peers);
    const series = id === 'g' || id === 'g1' ? E.imfS('NGDP_RPCH', iso, 2000, E.CY + 5) : id === 'inf' ? E.imfS('PCPIPCH', iso, 2000, E.CY + 5) : id === 'debt' ? E.imfS('GGXWDG_NGDP', iso, 2000, E.CY + 5) : id === 'unemp' ? E.imfS('LUR', iso, 2000, E.CY + 5) : [];
    const ch = series.length > 4 ? C.line({ series: [{ name: E.name(iso), pts: series, color: 'var(--s1)', projFrom: E.VYEAR - 0.5 }], h: 160, projFrom: E.VYEAR - 0.5, projLabel: 'IMF projection', yFmt: x => num(x, 0) + (ind.unit === '%' ? '%' : ''), tipX: x => String(Math.round(x)) }) : '';
    return { md: `**${E.name(iso)}** · ${ind.lab}: **${fmt(id, v)}**.${rk ? ` Ranked ${K.ord(rk.r)} of ${rk.n} economies${ind.good ? ` (1st = ${ind.good > 0 ? 'highest' : 'lowest'})` : ''}.` : ''}${ok(med) ? ` Median among ${E.BYISO[iso].inc.toLowerCase()} peers: ${fmt(id, med)}.` : ''}\n\nSource: ${ind.src}.`, extra: ch + clink(iso), follow: [`How is ${E.name(iso)}'s economy doing overall?`, `What should ${E.name(iso)} do?`] };
  });

  intent('country', ['economy', 'how is', "how's", 'doing', 'outlook', 'overview', 'profile', 'tell me about'], (q) => {
    const c = countries(q); const iso = c[0] || (ST && ST.scope !== 'WLD' ? ST.scope : null);
    if (!iso || iso === 'WLD') return worldOverview();
    return countryAnswer(iso);
  });

  intent('recs', ['recommend', 'should', 'advice', 'policy', 'what to do', 'fix', 'improve', 'reform'], (q) => {
    const c = countries(q); const iso = (c[0] && c[0] !== 'WLD') ? c[0] : (ST && ST.scope !== 'WLD' ? ST.scope : 'USA');
    const list = VR.recsFor(iso).slice(0, 3), strip = h => String(h).replace(/<[^>]+>/g, '');
    if (!list.length) return { md: `No recommendation clears the evidence bar for ${E.name(iso)} right now; its main indicators are near peer norms.`, follow: [`How is ${E.name(iso)}'s economy doing?`] };
    return { md: `**Evidence-based options for ${E.name(iso)}** (ranked by the Recommendations tab):\n\n${list.map((r, k) => `${k + 1}. **${strip(r.title)}** (${r.confidence} confidence). ${strip(r.impact)}`).join('\n')}\n\nEach comes with the evidence and trade-offs in the Recommendations tab. These are analytical, not political, recommendations.`, extra: link('Read them in full', 'recs'), follow: [`What if ${E.name(iso)} grows 1 pp faster?`, `Compare ${E.name(iso)} with its peers`] };
  });

  intent('fed', ['fed ', 'federal reserve', 'interest rate', 'fed funds', 'taylor', 'rate cut', 'rate hike', 'monetary policy'], () => {
    const ty = M.taylor(), ff = lastRaw('DFF'), y10 = lastRaw('DGS10'), y3 = lastRaw('DGS3MO');
    return { md: `**Fed funds** ${num(ff, 2)}%; 3-month bill ${num(y3, 2)}%, 10-year ${num(y10, 2)}% (curve ${sgn(y10 - y3, 2, ' pp')}).${ty ? `\n\nThe **Taylor rule** with core PCE ${num(ty.core, 1)}%, a ${sgn(ty.gap, 1, '%')} output gap and a 1% neutral real rate suggests about **${num(ty.classic, 1)}%** (the "balanced" variant ${num(ty.balanced, 1)}%), so policy is ${ff > ty.classic + 0.5 ? 'tighter' : ff < ty.classic - 0.5 ? 'looser' : 'roughly in line with'} than the rule${ff > ty.classic + 0.5 || ff < ty.classic - 0.5 ? ' suggests' : ''}.` : ''}\n\nThe rule is a benchmark, not a forecast: the Fed also weighs risks, financial stability and uncertainty about the neutral rate.`, extra: link('Open the models', 'models'), follow: ['What if the Fed cuts rates by 1%?', 'Will the US go into recession?'] };
  });

  const GLOSS = [
    [['sahm'], 'Sahm rule', 'Signals a recession when the 3-month average unemployment rate rises 0.50 pp or more above its low of the previous 12 months. It has caught the early months of every US recession since 1970, with occasional near-misses.'],
    [['gdp'], 'GDP', 'Gross domestic product: the value of all final goods and services produced in a year. Real GDP removes inflation; growth is its percentage change.'],
    [['ppp', 'purchasing power parity'], 'Purchasing power parity (PPP)', 'Adjusts for price differences between countries, so a dollar of income buys the same basket everywhere. Better than market exchange rates for comparing living standards.'],
    [['output gap'], 'Output gap', 'How far actual GDP is above or below its estimated potential (CBO). Positive means the economy is running hot.'],
    [['taylor rule'], 'Taylor rule', 'A benchmark for the policy rate: neutral real rate + inflation + half the inflation gap + half (or all) of the output gap.'],
    [['yield curve', 'inversion', 'inverted'], 'Yield curve', 'Treasury yields by maturity. When short rates rise above long rates (inversion), markets expect cuts, usually because they expect a slowdown.'],
    [['current account'], 'Current account', 'Exports minus imports of goods and services plus net income from abroad. A deficit must be financed by borrowing or investment from abroad.'],
    [['probit'], 'Probit model', 'A regression that turns indicators into a probability (between 0 and 1) using the normal distribution; used here for recession odds.'],
    [['nowcast'], 'Nowcast', 'An estimate of this quarter\'s GDP growth from monthly data released before the official number.'],
    [['inflation'], 'Inflation', 'The rise in the general price level, usually measured by the consumer price index (CPI) or PCE prices over 12 months. Central banks often target 2%.'],
    [['debt to gdp', 'debt-to-gdp'], 'Debt-to-GDP', 'Government debt as a share of annual output. What matters for sustainability is the gap between interest rates and growth, and the primary balance.'],
    [['gini'], 'Gini coefficient', 'Income inequality from 0 (everyone equal) to 100 (one person has everything).'],
    [['auc'], 'AUC', 'How well a model ranks risky months above safe ones: 0.5 is a coin flip, 1.0 is perfect.']
  ];
  intent('explain', ['what is', "what's", 'what are', 'what does', 'explain', 'define', 'meaning'], (q) => { const n = N.norm(q), g = GLOSS.find(([keys]) => keys.some(k => n.includes(k))); return g ? { md: `**${g[1]}.** ${g[2]}`, follow: ['Will the US go into recession?', 'Which economies are growing fastest?'] } : null; });

  intent('method', ['how accurate', 'accuracy', 'track record', 'data source', 'where does the data', 'how often', 'updated', 'methodology'], () => {
    const rec = M.recession(), g = M.growth(), inf = M.inflation(), nc = M.nowcast(), st = E.ST || {};
    return { md: `**Data:** World Bank WDI and governance indicators, IMF World Economic Outlook (${E.VINT}), and ${Object.keys(E.U.series).length} FRED series for the US. Last refresh ${K.isoLab((st.fetched_at || '').slice(0, 10))}.\n\n**Out-of-sample records:**\n- Recession (yield curve): AUC ${num(rec.models.classic.score.auc, 2)} since 1985\n- Growth (AR toward 20-year median): RMSE ${num(g.score.rmse, 2)} pp vs ${num(g.score.naive, 2)} for "same as last year"\n${inf ? `- Inflation, 12 months: RMSE ${num(inf.score.rmse, 2)} vs ${num(inf.score.rw, 2)} for no change\n` : ''}${nc ? `- GDP nowcast: RMSE ${num(nc.score.rmse, 2)} pp vs ${num(nc.score.naive, 2)} naive` : ''}`, extra: link('Open How it works', 'how'), follow: ['Will the US go into recession?'] };
  });

  intent('markets', ['stock', 'stocks', 'market', 's&p', 'bitcoin', 'portfolio', 'invest', 'bonds', 'gold'], () => ({ md: 'Markets, portfolios and investment questions live in the **Finance & markets** module, which has its own Ask Atlas with valuation, volatility, correction-risk and portfolio models.', extra: `<a href="finance/">Open Finance & markets →</a>`, follow: ['Will the US go into recession?', 'What is the inflation outlook?'] }));

  function worldOverview() {
    const g = world('g'), g1 = world('g1'), inf = world('inf'), top = Object.entries(E.column('g')).sort((a, b) => b[1] - a[1]).slice(0, 3), al = (V.worldAlerts ? V.worldAlerts() : []).slice(0, 3);
    return { md: `**World economy (IMF ${E.VINT}):** growth ${num(g, 1)}% in ${E.CY}, ${num(g1, 1)}% expected in ${E.CY + 1}; inflation ${num(inf, 1)}%. Fastest growing: ${top.map(([iso, v]) => `${E.name(iso)} ${num(v, 1)}%`).join(', ')}.${al.length ? '\n\n**Alerts**\n' + al.map(a => `- ${String(a.title).replace(/<[^>]+>/g, '')}`).join('\n') : ''}`, extra: link('Open Live now', 'live'), follow: ['Will the US go into recession?', 'Which countries have the highest inflation?', 'How is China doing?'] };
  }
  function countryRisk(iso) {
    const rk = M.growth().risk(iso);
    return { md: `**${E.name(iso)}:** IMF expects ${fmt('g', val('g', iso))} growth in ${E.CY} and ${fmt('g1', val('g1', iso))} in ${E.CY + 1}. The module's growth model, which widens the IMF path by ${E.name(iso)}'s own historical forecast errors, puts the chance of a contraction (negative growth) in ${E.CY + 1} at **${rk && ok(rk.pN) ? pct(rk.pN * 100, 0) : 'n/a'}**.`, extra: clink(iso), follow: [`How is ${E.name(iso)}'s economy doing?`, `What should ${E.name(iso)} do?`] };
  }
  function countryAnswer(iso) {
    const c = E.BYISO[iso], ids = ['g', 'g1', 'inf', 'unemp', 'debt', 'bal', 'gdppc'], rk = M.growth().risk(iso), al = (V.countryAlerts ? V.countryAlerts(iso) : []).slice(0, 3);
    const hist = E.imfS('NGDP_RPCH', iso, 2005, E.CY + 4);
    const ch = hist.length > 4 ? C.line({ series: [{ name: 'Growth', pts: hist, color: 'var(--s1)', projFrom: E.VYEAR - 0.5 }, { name: 'World', pts: E.imfS('NGDP_RPCH', 'WEOWORLD', 2005, E.CY + 4), color: 'var(--s3)', width: 1.3, dash: '4 3' }], h: 160, projFrom: E.VYEAR - 0.5, projLabel: 'IMF projection', yFmt: x => num(x, 0) + '%', tipX: x => String(Math.round(x)) }) : '';
    return { md: `**${c.name}** (${c.region}, ${c.inc.toLowerCase()}, #${c.rank || '–'} by GDP):\n${ids.map(id => `- ${E.indById(id).lab}: ${fmt(id, val(id, iso))}`).join('\n')}\n- Chance of a contraction in ${E.CY + 1}: ${rk && ok(rk.pN) ? pct(rk.pN * 100, 0) : 'n/a'}${al.length ? '\n\n**Flags:** ' + al.map(a => String(a.title).replace(/<[^>]+>/g, '')).join('; ') : ''}`, extra: ch + clink(iso), follow: [`What should ${c.name} do?`, `Compare ${c.name} with ${iso === 'USA' ? 'China' : 'the US'}`, `What is ${c.name}'s inflation outlook?`] };
  }

  function answer(q, st) {
    ST = st; const n = N.norm(q);
    const pri = [];
    if (/^ (what is|what's|what are|what does|explain|define)\b/.test(n) && GLOSS.some(([keys]) => keys.some(k => n.includes(k))) && !countries(q).length) pri.push('explain');
    if (parseUS(q) && /what if|if |scenario|happens/.test(n)) pri.push('whatif');
    if (countries(q).filter(x => x !== 'WLD').length >= 2 && /compare| vs | versus |difference|better/.test(n)) pri.push('compare');
    if (/(highest|lowest|fastest|slowest|most|least|richest|poorest|biggest|largest|top \d+|which countr)/.test(n)) pri.push('rank');
    const scored = I.map(x => ({ x, s: N.score(n, x.words) })).filter(o => o.s > 0).sort((a, b) => b.s - a.s);
    for (const it of pri.map(id => I.find(x => x.id === id)).concat(scored.map(o => o.x))) { const r = it.fn(q); if (r) return pack(r); }
    const c = countries(q); if (c.length) return pack(c[0] === 'WLD' ? worldOverview() : countryAnswer(c[0]));
    return pack({ md: 'I\'m not sure how to answer that from this page\'s data. I can talk about any of the 190+ economies here, US recession and inflation models, and what-if scenarios. For example:', follow: suggestions(st).slice(0, 5) });
  }
  const pack = r => ({ html: CH.md(r.md) + (r.extra ? `<div class="x">${r.extra}</div>` : ''), follow: r.follow });
  function suggestions(st) {
    const sc = st && st.scope && st.scope !== 'WLD' ? E.name(st.scope) : null;
    return Array.from(new Set([sc ? `How is ${sc}'s economy doing?` : 'How is the world economy doing?', 'Will the US go into recession?', 'What is the inflation outlook?', 'Which economies are growing fastest?', 'What if the Fed cuts rates by 1%?', sc ? `What should ${sc} do?` : 'Compare Germany and France'])).slice(0, 6);
  }
  const welcome = () => `<b>Ask about any economy, the forecasts or a what-if.</b> Answers come from World Bank, IMF and Federal Reserve data on this page and the module's tested models.`;

  /* ---------------- Claude ---------------- */
  function contextPack(st) {
    const rec = M.recession(), inf = M.inflation(), nc = M.nowcast(), ty = M.taylor();
    return [`Data: IMF ${E.VINT}; FRED refreshed ${((E.ST || {}).fetched_at || '').slice(0, 16)} UTC. Current year ${E.CY}.`, `World growth ${num(world('g'), 1)}% (${E.CY}), ${num(world('g1'), 1)}% (${E.CY + 1}); world inflation ${num(world('inf'), 1)}%.`, `US: recession probability 12m ${Math.round(rec.models.classic.pNow * 100)}% (curve) / ${Math.round(rec.models.extended.pNow * 100)}% (extended); CPI ${inf ? num(inf.now, 1) : '–'}%, core ${inf ? num(inf.core, 1) : '–'}%; nowcast ${nc ? num(nc.est, 1) : '–'}%; fed funds ${num(lastRaw('DFF'), 2)}%, Taylor ${ty ? num(ty.classic, 1) : '–'}%; 10y ${num(lastRaw('DGS10'), 2)}%, unemployment ${num((mLastVal('UNRATE') || {}).v, 1)}%.`, `User scope: ${st && st.scope ? nameOf(st.scope) : 'World'}; tab: ${st && st.tab}.`].join('\n');
  }
  const system = st => `You are Ask Atlas, the analyst built into "Probable Atlas · Economics", an educational dashboard by Bruno Silva covering 190+ economies (World Bank, IMF, FRED) with tested forecasting models. Answer questions about the data, models, forecasts and recommendations, and run US what-if scenarios with the tools.

Rules:
- Get numbers from the tools or the context below; never invent figures. Name the source and year.
- When you use a model, mention its out-of-sample record (in get_model).
- Be even-handed on policy: give evidence and trade-offs, not partisan opinions.
- Be concise: lead with the answer, then 2-5 bullets. Use Markdown. Use show_chart when a picture helps.
- For markets and investing questions, point to the Finance & markets module.

Current context:
${contextPack(st)}`;
  const r2 = v => (ok(v) ? Math.round(v * 100) / 100 : null);
  function iso3(x) { if (!x) return null; const up = String(x).toUpperCase(); if (E.BYISO[up] || up === 'WLD') return up; const c = countries(String(x)); return c[0] || null; }
  function tools(st) {
    const sch = (p, r) => ({ type: 'object', properties: p, required: r || [] });
    const IDS = () => E.IND ? E.IND.map(i => i.id) : [];
    return [
      { name: 'get_country', description: 'Key indicators, growth outlook, contraction risk and alerts for one economy (ISO3 code or name, e.g. BRA, "Germany"). Use WLD for the world.', inputSchema: sch({ country: { type: 'string' } }, ['country']), execute: i => { const iso = iso3(i.country); if (!iso) throw new Error('Unknown country'); if (iso === 'WLD') return { growth: world('g'), growthNext: world('g1'), inflation: world('inf'), source: E.VINT }; const c = E.BYISO[iso], rk = M.growth().risk(iso); return { iso, name: c.name, region: c.region, income: c.inc, rankByGDP: c.rank, indicators: Object.fromEntries((E.IND || []).map(ind => [ind.id + ' (' + ind.short + ')', r2(ind.get(iso))])), contractionRiskNextYear: rk ? r2(rk.pN) : null, alerts: (V.countryAlerts ? V.countryAlerts(iso) : []).map(a => String(a.title).replace(/<[^>]+>/g, '')) }; } },
      { name: 'rank_countries', description: 'Top or bottom economies by an indicator id (g growth, g1 next-year growth, inf inflation, unemp, debt, bal budget balance, gdppc, gdp, ca current account, trade, gini, pov, life, rd, etc.).', inputSchema: sch({ indicator: { type: 'string' }, order: { type: 'string', enum: ['high', 'low'] }, n: { type: 'number' }, group: { type: 'string', enum: ['all', 'g20', 'top40'] } }, ['indicator']), execute: i => { const id = E.indById(i.indicator) ? i.indicator : indicatorOf(String(i.indicator)); if (!id) throw new Error('Unknown indicator. Known: ' + IDS().join(', ')); const col = E.column(id), lim = i.group === 'g20' ? E.G20 : i.group === 'top40' ? E.COUNTRIES.filter(c => c.top40).map(c => c.iso) : null; return { indicator: E.indById(id).lab, source: E.indById(id).src, list: Object.entries(col).filter(([iso]) => !lim || lim.includes(iso)).sort((a, b) => i.order === 'low' ? a[1] - b[1] : b[1] - a[1]).slice(0, Math.min(25, i.n || 10)).map(([iso, v]) => ({ iso, name: E.name(iso), value: r2(v) })) }; } },
      { name: 'compare_countries', description: 'Side-by-side indicators for up to 6 economies.', inputSchema: sch({ countries: { type: 'array', items: { type: 'string' } } }, ['countries']), execute: i => (i.countries || []).map(iso3).filter(Boolean).slice(0, 6).map(iso => ({ iso, name: E.name(iso), growth: r2(val('g', iso)), growthNext: r2(val('g1', iso)), inflation: r2(val('inf', iso)), unemployment: r2(val('unemp', iso)), debt: r2(val('debt', iso)), budget: r2(val('bal', iso)), gdpPerPerson: r2(val('gdppc', iso)), currentAccount: r2(val('ca', iso)) })) },
      { name: 'get_series', description: 'Annual IMF history and projections for a country: code NGDP_RPCH (growth), PCPIPCH (inflation), LUR (unemployment), GGXWDG_NGDP (debt), BCA_NGDPD (current account).', inputSchema: sch({ country: { type: 'string' }, code: { type: 'string' }, from: { type: 'number' } }, ['country', 'code']), execute: i => { const iso = iso3(i.country) === 'WLD' ? 'WEOWORLD' : iso3(i.country); return E.imfS(String(i.code), iso, +i.from || 2000, E.CY + 5).map(([y, v]) => [y, r2(v)]); } },
      { name: 'get_us', description: 'Latest US data: unemployment, payrolls, CPI and core, fed funds, yields, Sahm rule, GDP, consumer sentiment.', execute: () => { const ids = ['UNRATE', 'PAYEMS', 'CPIAUCSL', 'CPILFESL', 'FEDFUNDS', 'DGS10', 'DGS2', 'DGS3MO', 'SAHMREALTIME', 'UMCSENT', 'A191RL1Q225SBEA', 'ICSA', 'MORTGAGE30US', 'INDPRO', 'JTSJOL']; return ids.map(id => { const l = latestUS(id); return { id, name: E.usLab(id), last: l ? r2(l.v) : null, date: l ? l.date : null }; }); } },
      { name: 'get_model', description: 'Current output and out-of-sample record of a model: recession, nowcast, inflation, taylor, growth (needs country).', inputSchema: sch({ name: { type: 'string', enum: ['recession', 'nowcast', 'inflation', 'taylor', 'growth'] }, country: { type: 'string' } }, ['name']), execute: i => {
        if (i.name === 'recession') { const rec = M.recession(); return Object.values(rec.models).map(m => ({ model: m.name, probability12m: r2(m.pNow), inputs: m.vars, outOfSample: { auc: r2(m.score.auc), brier: r2(m.score.brier), brierBase: r2(m.score.brier0), n: m.score.n } })); }
        if (i.name === 'nowcast') { const nc = M.nowcast(); return nc ? { quarter: K.qLab(nc.qNow), estimate: r2(nc.est), range80: [r2(nc.lo), r2(nc.hi)], gdpNow: r2(nc.gdpnow), lastActual: r2(nc.lastActual), rmse: r2(nc.score.rmse), naiveRmse: r2(nc.score.naive) } : null; }
        if (i.name === 'inflation') { const inf = M.inflation(); return inf ? { now: r2(inf.now), core: r2(inf.core), path12m: inf.path.map(p => ({ month: K.mLab(p[0]), mid: r2(p[1]), lo: r2(p[2]), hi: r2(p[3]) })), rmse12m: r2(inf.score.rmse), noChangeRmse: r2(inf.score.rw) } : null; }
        if (i.name === 'taylor') return M.taylor();
        if (i.name === 'growth') { const iso = iso3(i.country || 'USA'); const g = M.growth(), f = g.fan(iso), rk = g.risk(iso); return { country: E.name(iso), years: f ? f.years : null, imf: f ? f.imf.map(r2) : null, p10: f ? f.p10.map(r2) : null, p90: f ? f.p90.map(r2) : null, contractionRiskNextYear: rk ? r2(rk.pN) : null, modelRmse: r2(g.score.rmse), naiveRmse: r2(g.score.naive) }; }
        throw new Error('Unknown model');
      } },
      { name: 'run_us_scenario', description: 'Re-run the US recession models, 12-month inflation forecast and Taylor rule with changed inputs. Any of: ff (fed funds %), y3m, y10 (yields %), nfci (financial conditions), unemp (%), oil ($/bbl), mich (expected inflation %), corePCE (%), gap (output gap %). Omitted inputs stay at today\'s values.', inputSchema: sch({ ff: { type: 'number' }, y3m: { type: 'number' }, y10: { type: 'number' }, nfci: { type: 'number' }, unemp: { type: 'number' }, oil: { type: 'number' }, mich: { type: 'number' }, corePCE: { type: 'number' }, gap: { type: 'number' } }), execute: i => { const b = usBase(), sc = Object.assign({}, b); for (const k of Object.keys(b)) if (i[k] != null && isFinite(i[k])) sc[k] = +i[k]; const r = M.usScenario(sc), r0 = M.usScenario(b); return { inputs: sc, today: b, recessionCurve: r2(r.pC), recessionCurveToday: r2(r0.pC), recessionExtended: r2(r.pE), recessionExtendedToday: r2(r0.pE), inflationIn12m: r.path ? r2(r.path[r.path.length - 1][1]) : null, inflationIn12mToday: r0.path ? r2(r0.path[r0.path.length - 1][1]) : null, taylor: r.taylor }; } },
      { name: 'get_recommendations', description: 'Evidence-based policy recommendation cards for an economy (problem, evidence, impact, trade-offs, confidence).', inputSchema: sch({ country: { type: 'string' } }, ['country']), execute: i => { const iso = iso3(i.country) || 'USA', strip = h => String(h).replace(/<[^>]+>/g, ''); return VR.recsFor(iso).slice(0, 5).map(r => ({ title: strip(r.title), confidence: r.confidence, problem: strip(r.problem), evidence: strip(r.evidence), impact: strip(r.impact), tradeoffs: strip(r.tradeoffs) })); } },
      { name: 'list_charts', description: 'What show_chart can draw.', execute: () => ({ kinds: ['indicator (countries[], code as in get_series)', 'us (id: FRED series id, e.g. UNRATE)', 'recession (US recession probability path)'] }) },
      { name: 'open_tab', description: 'Navigate the page: tab live, indicators, models, whatif, recs, history, how; optional country to set the scope.', inputSchema: sch({ tab: { type: 'string' }, country: { type: 'string' } }), execute: i => { const patch = {}; if (i.tab && TABS.find(t => t[0] === i.tab)) patch.tab = i.tab; const iso = iso3(i.country); if (iso) patch.scope = iso; APP.go(patch); return 'Opened'; } }
    ];
  }
  function chart(inp) {
    const kind = String(inp.kind || '');
    if (kind === 'indicator' || kind === 'price' || kind === 'compare') { const isos = (inp.countries || inp.ids || ['USA']).map(iso3).filter(Boolean).slice(0, 4), code = inp.code || 'NGDP_RPCH'; return C.line({ series: isos.map((iso, k) => ({ name: E.name(iso), pts: E.imfS(code, iso === 'WLD' ? 'WEOWORLD' : iso, 2000, E.CY + 5), color: C.PAL[k], projFrom: E.VYEAR - 0.5 })), h: 180, projFrom: E.VYEAR - 0.5, projLabel: 'IMF projection', yFmt: v => num(v, 0), tipX: x => String(Math.round(x)) }); }
    if (kind === 'us') { const id = String(inp.id || 'UNRATE'); const pts = E.qSeries(id) ? E.qPts(E.qSeries(id), 1990 * 4) : E.mPts(E.mSeries(id), 1990 * 12); if (!pts.length) return null; return `<div class="kicker">${esc(E.usLab(id))}</div>` + C.line({ series: [{ name: E.usLab(id), pts, color: 'var(--s1)' }], h: 170, shade: E.recessions(), yFmt: v => num(v, 1), tipX: x => String(Math.floor(x)) }); }
    if (kind === 'recession') { const m = M.recession().models.classic; return '<div class="kicker">US recession probability (yield curve), out of sample</div>' + C.line({ series: [{ name: 'Probability', pts: m.oos, color: 'var(--s7)' }], shade: E.recessions(), h: 170, y0: 0, yFmt: v => num(v, 0) + '%', tipX: x => String(Math.floor(x)) }); }
    return null;
  }
  function adapter() { return { answer, suggestions, welcome, system, tools, chart }; }
  return { adapter, answer, countries, indicatorOf };
})();
