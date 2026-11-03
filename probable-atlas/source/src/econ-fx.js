/* Probable Atlas · Economics 2.0: the pinned Insights bar (key readings from the IMF, World Bank and FRED data and the
   models) and the 3D data globe in the masthead, with an indicator switch. */
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
  const toCard = (patch, title) => () => { APP.go(patch); if (title) setTimeout(() => scrollToTitle(title), 90); };
  function insights() {
    const out = [], add = f => { try { const x = f(); if (x) out.push(x); } catch (e) { console.warn('insight', e); } };
    const CY = E.CY;
    add(() => { const g = E.imf('NGDP_RPCH', 'WEOWORLD', CY), g0 = E.imf('NGDP_RPCH', 'WEOWORLD', CY - 1); if (!ok(g)) return null; return { id: 'world', tag: 'World', tone: g >= g0 ? 'up' : 'down', text: `The IMF sees the world economy growing in ${CY} (${CY - 1}: ${K.num(g0, 1)}%) — ${E.VINT}`, val: K.num(g, 1) + '%', story: { kicker: 'World economy · ' + String(E.VINT || '').replace(/World Economic Outlook\s*\(([A-Za-z]+)\s+(\d{4})\)/, (m, mo, y) => 'IMF outlook, ' + mo.slice(0, 3) + ' ' + y), title: `The IMF sees the world economy growing ${K.num(g, 1)}% in ${CY}`, value: K.num(g, 1) + '%', sub: `${CY - 1}: ${K.num(g0, 1)}% · ${CY + 1}: ${K.num(E.imf('NGDP_RPCH', 'WEOWORLD', CY + 1), 1)}%`, bars: 'WEOWORLD' }, go: toCard({ scope: 'WLD', tab: 'live' }), ask: 'How is the world economy doing?' }; });
    add(() => { const r = M.recession().models.classic; if (!r || !ok(r.pNow)) return null; return { id: 'rec', tag: 'US recession', tone: r.pNow > 0.3 ? 'warn' : 'info', text: 'Chance of a US recession within 12 months (yield-curve probit, out-of-sample AUC 0.78)', val: K.num(r.pNow * 100, 0) + '%', story: { kicker: 'US recession odds', title: 'Chance of a US recession within the next 12 months', value: K.num(r.pNow * 100, 0) + '%', sub: 'Yield-curve probit model · out-of-sample AUC 0.78' }, go: toCard({ scope: 'USA', tab: 'models' }, 'Recession'), ask: 'Will the US have a recession?' }; });
    add(() => { const n = M.nowcast(); if (!n || !ok(n.est)) return null; return { id: 'now', tag: 'GDP nowcast', tone: n.est < 0 ? 'down' : 'up', text: `US GDP nowcast for ${K.qLab(n.qNow)}, annualized (Atlanta Fed GDPNow ${K.num(n.gdpnow, 1)}%)`, val: K.num(n.est, 1) + '%', story: { kicker: 'US GDP nowcast · ' + K.qLab(n.qNow), title: 'US growth this quarter, at an annual rate', value: K.num(n.est, 1) + '%', sub: `The Atlanta Fed's GDPNow reads ${K.num(n.gdpnow, 1)}%`, bars: 'USA' }, go: toCard({ scope: 'USA', tab: 'models' }, 'GDP nowcast'), ask: 'What does the GDP nowcast say?' }; });
    add(() => { const inf = M.inflation(); if (!inf || !inf.path || !inf.path.length) return null; const p = inf.path[inf.path.length - 1]; return { id: 'infl', tag: 'US inflation', tone: p[1] > inf.now ? 'warn' : 'up', text: `US inflation is ${K.num(inf.now, 1)}%; the model's 12-month forecast is`, val: K.num(p[1], 1) + '%', story: { kicker: 'US inflation', title: `Inflation is ${K.num(inf.now, 1)}% now; the model sees this in a year`, value: K.num(p[1], 1) + '%', sub: 'Twelve-month forecast from the inflation model' }, go: toCard({ scope: 'USA', tab: 'models' }, 'Inflation'), ask: 'Where is US inflation heading?' }; });
    add(() => { const ty = M.taylor(), ffS = E.mSeries('DFF'); const ff = ffS ? E.mAt(ffS, E.mLast(ffS)) : null; if (!ty || !ok(ff)) return null; const d = ff - ty.classic; return { id: 'fed', tag: 'Fed policy', tone: Math.abs(d) > 1 ? 'warn' : 'info', text: `Fed funds ${K.num(ff, 2)}% vs the Taylor rule's ${K.num(ty.classic, 1)}%: policy looks ${d > 0.5 ? 'tight' : d < -0.5 ? 'loose' : 'about neutral'} by`, val: sg(d, 1, ' pp'), story: { kicker: 'Fed policy', title: `Policy looks ${d > 0.5 ? 'tight' : d < -0.5 ? 'loose' : 'about neutral'}: fed funds ${K.num(ff, 2)}% vs the Taylor rule's ${K.num(ty.classic, 1)}%`, value: sg(d, 1, ' pp'), sub: 'Gap between the actual rate and the classic Taylor rule' }, go: toCard({ scope: 'USA', tab: 'models' }, 'Taylor rule'), ask: 'Is the Fed too tight or too loose?' }; });
    add(() => { const col = E.column('g'), ent = Object.entries(col).filter(([, v]) => ok(v)); const sh = ent.filter(([, v]) => v < 0).length; return { id: 'shrink', tag: 'Contraction', tone: sh > 10 ? 'warn' : 'info', text: `Economies the IMF expects to shrink in ${CY}, out of ${ent.length}`, val: String(sh), story: { kicker: 'Contraction · ' + CY, title: `Economies the IMF expects to shrink in ${CY}`, value: String(sh), sub: `Out of ${ent.length} with a forecast` }, go: toCard({ scope: 'WLD', tab: 'indicators' }), ask: 'Which economies are shrinking this year?' }; });
    add(() => { const col = E.column('g'), top = Object.entries(col).filter(([iso, v]) => ok(v) && E.BYISO[iso]).sort((a, b) => b[1] - a[1])[0]; if (!top) return null; return { id: 'fast', tag: 'Fastest growing', tone: 'up', text: `Fastest-growing economy in ${CY}: ${E.name(top[0])}`, val: sg(top[1], 1, '%'), story: { kicker: 'Fastest growing · ' + CY, title: E.name(top[0]), value: sg(top[1], 1, '%'), sub: 'Real GDP growth forecast from the IMF', bars: top[0] }, go: () => APP.openCountry(top[0]), ask: `Why is ${E.name(top[0])} growing so fast?` }; });
    add(() => { const col = E.column('inf'), n = Object.values(col).filter(v => ok(v) && v >= 10).length; return { id: 'hiinf', tag: 'High inflation', tone: 'warn', text: `Economies with double-digit inflation in ${CY}`, val: String(n), story: { kicker: 'High inflation · ' + CY, title: 'Economies with double-digit inflation', value: String(n), sub: `IMF forecasts for ${CY}` }, go: toCard({ scope: 'WLD', tab: 'indicators' }), ask: 'Where is inflation highest?' }; });
    return out;
  }
  /* ---------------- globe ---------------- */
  const METRICS = [['g', 'Growth'], ['inf', 'Inflation'], ['unemp', 'Unemployment'], ['debt', 'Gov. debt']];
  let geo = null;
  function land() {
    if (geo) return geo;
    const bin = atob(GLOBE_GEO.land), n = bin.length / 2, out = new Float32Array(n);
    for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v > 32767) v -= 65536; out[i] = v / 100; }
    return (geo = out);
  }
  function globeData(id) {
    const ind = E.indById(id); if (!ind) return null;
    const rows = E.COUNTRIES.map(c => ({ c, v: ind.get(c.iso), p: GLOBE_GEO.cent[c.iso] })).filter(x => ok(x.v) && x.p);
    const sorted = rows.map(x => x.v).sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
    const center = ind.div != null ? ind.div : med;
    const desc = rows.slice().sort((a, b) => (ind.good === -1 ? a.v - b.v : b.v - a.v));
    const rank = new Map(desc.map((x, i) => [x.c.iso, i + 1]));
    const fmt = v => ind.fmt ? ind.fmt(v) : (ind.unit === '%' ? sg(v, ind.d ?? 1, '%') : K.num(v, ind.d ?? 1) + (ind.unit || ''));
    const good = ind.good || 0, blue = '#5cc8ff', coral = '#ff7a59';
    return {
      land: land(),
      countries: rows.map(x => ({ iso: x.c.iso, name: x.c.name || E.name(x.c.iso), lat: x.p[0], lon: x.p[1], value: x.v, text: id === 'debt' || id === 'unemp' ? K.num(x.v, ind.d ?? 0) + '%' : fmt(x.v), rank: good ? rank.get(x.c.iso) : null, of: rows.length })),
      metric: { label: ind.lab + (good ? (good > 0 ? ' · rank 1 = highest' : ' · rank 1 = lowest') : ''), center, pos: good < 0 ? coral : blue, neg: good < 0 ? blue : coral }
    };
  }
  let ctl = null, cur = 'g';
  function caption(id) {
    const ind = E.indById(id), cap = document.querySelector('#mast3d .m3-cap');
    if (!cap || !ind) return;
    const div = ind.div != null ? (ind.div === 0 ? 'Spikes rise from zero' : `Spikes rise from the ${K.num(ind.div, 1)}% target`) : 'Spikes rise from the median economy';
    cap.innerHTML = `<b>${esc(ind.lab)}</b><span>${esc(div)} · ${ind.good < 0 ? 'coral = worse, blue = better' : ind.good > 0 ? 'blue = stronger, coral = weaker' : 'blue = above, coral = below'} · drag to spin, tap a spike for the country</span>`;
  }
  async function mount3d() {
    const host = document.getElementById('mast3d'); if (!host || ctl) return;
    const mast = document.querySelector('.mast');
    try {
      const bg = toHex(getComputedStyle(mast).backgroundColor);
      ctl = await PX3D.mount(host, 'globe', globeData(cur), { bg, accent: getComputedStyle(document.documentElement).getPropertyValue('--band-accent').trim() || '#46c2b0', centerLon: -40, onPick: c => { if (c && c.iso) APP.openCountry(c.iso); } });
      const b = document.createElement('span'); b.className = 'px3d-badge'; b.textContent = ctl.backend === 'WebGPU' ? 'WebGPU' : 'WebGL 2'; host.appendChild(b);
      PX3D.motionToggle(host, ctl);
      const chips = document.createElement('div'); chips.className = 'm3-chips'; chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'Globe indicator');
      chips.innerHTML = METRICS.map(([id, l]) => `<button type="button" data-gm="${id}" aria-pressed="${id === cur}">${esc(l)}</button>`).join('');
      chips.addEventListener('click', e => { const b2 = e.target.closest('[data-gm]'); if (!b2) return; cur = b2.dataset.gm; chips.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.gm === cur))); caption(cur); ctl.update(globeData(cur)); });
      host.appendChild(chips);
      caption(cur); mast.classList.add('has3d-on');
    } catch (e) { mast.classList.add('no3d'); }
  }
  function toHex(c) { const m = String(c).match(/\d+(\.\d+)?/g); if (!m) return '#0c1a22'; return '#' + m.slice(0, 3).map(x => (+x | 0).toString(16).padStart(2, '0')).join(''); }
  function init() {
    INS.mount({ ask: q => { if (typeof CH !== 'undefined') CH.open(q); }, share: it => { if (typeof EX !== 'undefined') EX.shareInsight(it); } });
    INS.set(insights());
    try { localStorage.setItem('atlas-ins-econ', JSON.stringify({ t: Date.now(), items: INS.items.map(({ id, tag, tone, text, val, ask, story }) => ({ id, tag, tone, text, val, ask, story })) })); } catch (e) { /* storage unavailable */ }
    PAPP.init({ sw: 'sw.js', scope: '/probable-atlas/', host: '.strip .r', before: document.getElementById('themeBtn'), name: 'Probable Atlas' });
    PAPP.ask(q => { if (typeof CH !== 'undefined') CH.open(q); });
    if (document.getElementById('mast3d')) PX3D.idle(mount3d);
  }
  return { init, insights, globeData };
})();
