/* Probable Atlas · Finance 2.0: the pinned Insights bar (key readings from the live data and models) and the 3D
   US Treasury yield-curve terrain in the masthead. */
const FX = (() => {
  const { esc } = K;
  const ok = v => v != null && isFinite(v);
  const sg = (v, d, u) => (v > 0 ? '+' : v < 0 ? '−' : '') + K.num(Math.abs(v), d) + (u || '');
  function scrollToTitle(title) {
    const h = [...document.querySelectorAll('#main h2, #main h3')].find(x => x.textContent.trim().toLowerCase().startsWith(title.toLowerCase()));
    if (!h) return;
    const off = (document.querySelector('.bar') || { offsetHeight: 0 }).offsetHeight + (document.getElementById('insBar') || { offsetHeight: 0 }).offsetHeight + 12;
    scrollTo({ top: h.getBoundingClientRect().top + scrollY - off, behavior: 'smooth' });
  }
  const toCard = (tab, title) => () => { APP.go({ tab }); setTimeout(() => scrollToTitle(title), 90); };
  function insights() {
    const out = [], tryAdd = f => { try { const x = f(); if (x) out.push(x); } catch (e) { console.warn('insight', e); } };
    tryAdd(() => {
      const q = F.quote('^GSPC'), y = F.ytd('^GSPC'), dd = F.drawdown('^GSPC');
      return { id: 'spx', tag: 'S&P 500', tone: q.pct >= 0 ? 'up' : 'down', text: `S&P 500 at ${K.num(q.last, 0)}: ${sg(q.pct, 2, '%')} on ${K.isoLab(q.date)}, ${sg(y, 1, '%')} this year${dd && dd.dd < -0.5 ? `, ${K.num(-dd.dd, 1)}% below its record` : ', at a record'}`, val: sg(q.pct, 2, '%'), go: () => FV.openAsset('^GSPC'), ask: 'How is the S&P 500 doing, and what are the risks?' };
    });
    tryAdd(() => { const rg = FM.regime(); const p = rg.now[rg.state]; return { id: 'regime', tag: 'Regime', tone: rg.state === 0 ? 'up' : rg.state === 2 ? 'down' : 'warn', text: `The regime model reads the market as ${rg.names[rg.state].toLowerCase()}, with probability`, val: K.num(p * 100, 0) + '%', go: toCard('models', 'Market regimes'), ask: 'What does the regime model say right now?' }; });
    tryAdd(() => { const d = FM.dd10(); if (!d.now) return null; const hi = d.now.p > d.baseRate * 1.25; return { id: 'corr', tag: 'Correction risk', tone: hi ? 'warn' : 'info', text: `Chance of a 10% fall within six months, against a ${K.num(d.baseRate * 100, 0)}% base rate (modest skill)`, val: K.num(d.now.p * 100, 0) + '%', go: toCard('models', 'Correction and bear-market risk'), ask: 'Is a correction likely?' }; });
    tryAdd(() => { const v = F.lastVal('^VIX'), vm = FM.volModel(); return { id: 'vol', tag: 'Volatility', tone: v >= 22 ? 'warn' : 'info', text: `VIX ${K.num(v, 1)}; the GARCH model expects daily S&P 500 swings of about`, val: '±' + K.num(vm.sdDay, 1) + '%', go: toCard('models', 'Volatility and value-at-risk'), ask: 'How volatile are markets right now?' }; });
    tryAdd(() => { const s10 = F.lastVal('DGS10'), s3 = F.lastVal('DGS3MO'); if (!ok(s10) || !ok(s3)) return null; const d = s10 - s3; return { id: 'curve', tag: 'Yield curve', tone: d < 0 ? 'warn' : 'info', text: `10-year Treasury ${K.num(s10, 2)}% vs 3-month ${K.num(s3, 2)}%: the curve is ${d < 0 ? 'inverted' : 'upward sloping'}, spread`, val: sg(d, 2, ' pp'), go: () => { APP.go({ tab: 'markets' }); setTimeout(() => scrollToTitle('Yield curve'), 90); }, ask: 'What is the yield curve saying?' }; });
    tryAdd(() => { const ap = FM.appetite(); if (!ok(ap.now)) return null; return { id: 'appetite', tag: 'Risk appetite', tone: ap.now < 30 ? 'down' : ap.now > 70 ? 'up' : 'info', text: `Risk appetite gauge (six market readings): ${ap.label.toLowerCase()}`, val: K.num(ap.now, 0) + '/100', go: toCard('models', 'Risk appetite gauge'), ask: 'What does the risk appetite gauge measure?' }; });
    tryAdd(() => { const cp = FM.cape(); if (!cp) return null; return { id: 'cape', tag: 'Valuation', tone: cp.pctile > 90 ? 'warn' : 'info', text: `CAPE ${K.num(cp.last.cape, 1)}, ${K.ord(Math.round(cp.pctile))} percentile since 1881; history implies a 10-year real return near`, val: K.num(cp.fc, 1) + '%/yr', go: toCard('models', 'Long-run expected returns'), ask: 'Are stocks overvalued?' }; });
    tryAdd(() => {   // biggest mover of the day among the tracked markets
      const ids = F.GROUPS.flatMap(([g]) => F.assets(g)).filter(id => F.ser(id) && F.ser(id).log && F.ser(id).cls !== 'vol');
      const mv = ids.map(id => ({ id, q: F.quote(id) })).filter(x => x.q && ok(x.q.pct)).sort((a, b) => Math.abs(b.q.pct) - Math.abs(a.q.pct))[0];
      if (!mv || Math.abs(mv.q.pct) < 1) return null;
      return { id: 'mover', tag: 'Biggest mover', tone: mv.q.pct >= 0 ? 'up' : 'down', text: `${F.short(mv.id)} moved the most of ${ids.length} markets on ${K.isoLab(mv.q.date)}`, val: sg(mv.q.pct, 1, '%'), go: () => FV.openAsset(mv.id), ask: `Why did ${F.short(mv.id)} move so much?` };
    });
    return out;
  }
  // monthly Treasury curve since 1990 for the 3D terrain
  function surfaceData() {
    const me = F.monthEnds(), ids = FV.MAT.map(m => m[0]), NM = { '1M': '1-month', '3M': '3-month', '6M': '6-month', '1Y': '1-year', '2Y': '2-year', '3Y': '3-year', '5Y': '5-year', '7Y': '7-year', '10Y': '10-year', '20Y': '20-year', '30Y': '30-year' };
    const z = [];
    me.ix.forEach(i => { for (const id of ids) { let v = NaN; for (let j = i; j >= Math.max(0, i - 25) && !ok(v); j--) v = F.at(id, j); z.push(ok(v) ? v : NaN); } });
    return { dates: me.keys, mats: FV.MLAB.map(l => ({ label: l, name: NM[l] || l })), z };
  }
  let ctl = null;
  async function mount3d() {
    const host = document.getElementById('mast3d'); if (!host || ctl) return;
    const mast = document.querySelector('.mast');
    try {
      const bg = getComputedStyle(mast).backgroundColor;
      ctl = await PX3D.mount(host, 'surface', surfaceData(), { bg: toHex(bg), accent: getComputedStyle(document.documentElement).getPropertyValue('--band-accent').trim() || '#F2B33D' });
      const b = document.createElement('span'); b.className = 'px3d-badge'; b.textContent = ctl.backend === 'WebGPU' ? 'WebGPU' : 'WebGL 2'; host.appendChild(b);
      PX3D.motionToggle(host, ctl);
      mast.classList.add('has3d-on');
    } catch (e) { mast.classList.add('no3d'); }
  }
  function toHex(c) { const m = String(c).match(/\d+(\.\d+)?/g); if (!m) return '#0c1a22'; return '#' + m.slice(0, 3).map(x => (+x | 0).toString(16).padStart(2, '0')).join(''); }
  function init() {
    INS.mount({ ask: q => { if (HAS_CH()) CH.open(q); } });
    INS.set(insights());
    try { localStorage.setItem('atlas-ins-fin', JSON.stringify({ t: Date.now(), items: INS.items.map(({ id, tag, tone, text, val, ask }) => ({ id, tag, tone, text, val, ask })) })); } catch (e) { /* storage unavailable */ }
    PAPP.init({ sw: '../sw.js', scope: '/probable-atlas/', host: '.strip .r', before: document.getElementById('themeBtn'), name: 'Probable Atlas' });
    PAPP.ask(q => { if (typeof CH !== 'undefined') CH.open(q); });
    if (document.getElementById('mast3d')) PX3D.idle(mount3d);
  }
  return { init, insights, surfaceData };
})();
