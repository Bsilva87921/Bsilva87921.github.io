/* Probable Atlas · Finance: app shell (tabs, module nav, asset drawer, events, theme, chat hookup). */
const TABS = [['live', 'Live now'], ['news', 'News'], ['markets', 'Markets'], ['models', 'Models & forecasts'], ['whatif', 'What-if lab'], ['recs', 'Recommendations'], ['history', 'History'], ['how', 'How it works']];
const ECON_URL = window.ATLAS_FIN_DATA ? 'https://bsilva87921.github.io/probable-atlas/' : '../';
const MODULES = [['econ', 'Economics', false, ECON_URL], ['fin', 'Finance & markets', true], ['comm', 'Commodities & scarcity'], ['wx', 'Weather & climate'], ['ag', 'Agriculture & food'], ['hunger', 'Hunger'], ['wealth', 'Wealth & inequality'], ['tech', 'Tech & innovation'], ['conflict', 'Conflict & security'], ['pol', 'Politics & governance'], ['health', 'Health & medicine'], ['pulse', 'World Pulse']];
const STATE = K.store('atlas-fin-v1', { tab: 'live', focus: '^GSPC', cmp: [], range: '5Y', mview: 'price', logY: true, sectPer: 'm1', cwin: '156', cback: 0, rHorizon: 'long', rRisk: 'med', hFrom: '1980', mAll: '0', lab: null }, ['tab', 'focus', 'cmp', 'range', 'mview', 'logY', 'sectPer', 'cwin', 'rHorizon', 'rRisk', 'hFrom', 'lab']);

const HAS_CH = () => typeof CH !== 'undefined';
const APP = (() => {
  const { $, $$, esc } = K;
  function mastArt() { // the S&P 500 since 1928 on a log scale, drawn faintly behind the title
    const L = F.spxLong(), n = L.v.length, step = Math.max(1, Math.floor(n / 700)), lo = Math.log(Math.min(...L.v)), hi = Math.log(Math.max(...L.v));
    let d = ''; for (let i = 0; i < n; i += step) d += (d ? 'L' : 'M') + (i / (n - 1) * 1000).toFixed(1) + ' ' + (300 - (Math.log(L.v[i]) - lo) / (hi - lo) * 260 - 20).toFixed(1);
    const g = $('#grat'); g.setAttribute('viewBox', '0 0 1000 300');
    g.innerHTML = `<path d="${d}L1000 300L0 300Z" style="fill:var(--band-accent);opacity:.18"/><path d="${d}" style="fill:none;stroke:var(--band-accent);stroke-width:1.6;vector-effect:non-scaling-stroke"/>`;
  }
  function header() {
    const ic = k => window.MEDIA ? MEDIA.icon(k) : '';
    $('#modnav').innerHTML = MODULES.map(([k, lab, on, href]) => on ? `<button type="button" aria-current="true">${ic(k)}${esc(lab)}</button>` : href ? `<a class="modlink" href="${esc(href)}"${window.ATLAS_FIN_DATA ? ' target="_blank" rel="noopener"' : ''}>${ic(k)}${esc(lab)}</a>` : `<button type="button" disabled title="Coming next in the Atlas build plan">${ic(k)}${esc(lab)} <span class="soon">soon</span></button>`).join('');
    // a photograph behind the masthead (blurred placeholder first, darkened for contrast)
    if (window.MEDIA && $('#mastPhoto')) $('#mastPhoto').innerHTML = MEDIA.photo('nyc-dusk', { alt: '', eager: true, sizes: '100vw', pos: '50% 58%' });
    mastArt();
    $('#tabs').innerHTML = TABS.map(([k, l]) => `<button type="button" role="tab" id="tab-${k}" data-tab="${k}" aria-selected="${STATE.tab === k}" aria-controls="main">${esc(l)}</button>`).join('');
    $('#assetSel').innerHTML = `<option value="">Any market or rate…</option>` + VMK.assetOptions().map(o => `<optgroup label="${esc(o.group)}">${o.items.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</optgroup>`).join('');
    const i = F.info(), snap = !!window.ATLAS_FIN_DATA;
    $('#fresh').innerHTML = `<span><span class="dot"></span>${snap ? 'Saved snapshot' : 'Data refreshed'} ${esc(K.isoLab((i.fetched || '').slice(0, 10)))}${snap ? '' : ' (' + esc(K.ago(i.fetched)) + ')'}</span><span>Prices through ${esc(K.isoLab(F.CAL[F.N - 1]))}</span>`;
    $('#footVer').textContent = snap ? 'This copy runs on saved data. The live version refreshes during US trading hours at bsilva87921.github.io/probable-atlas/finance/' : 'Refreshed automatically by a scheduled GitHub Actions job.';
  }
  function render(keepScroll) {
    const main = $('#main');
    $$('#tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === STATE.tab)));
    document.title = `Probable Atlas · Finance · ${TABS.find(t => t[0] === STATE.tab)[1]}`;
    let html = '';
    try {
      html = STATE.tab === 'live' ? FV.live(STATE) : STATE.tab === 'news' ? '<div id="newsHost"></div>' : STATE.tab === 'markets' ? VMK.view(STATE) : STATE.tab === 'models' ? VMO.view(STATE) : STATE.tab === 'whatif' ? VL.view(STATE) : STATE.tab === 'recs' ? VRF.view(STATE) : STATE.tab === 'history' ? VHF.view(STATE) : VHF.how();
    } catch (e) { console.error(e); html = `<div class="card empty">Something went wrong building this view (${esc(e.message)}). Try another tab.</div>`; }
    main.innerHTML = html;
    C.mount(main); C.gc(); T.gc();
    if (typeof FINX !== 'undefined') { try { FINX.after(main, STATE, keepScroll); } catch (e) { console.error(e); } }
    if (!keepScroll) { const bar = $('.bar'); const top = bar.getBoundingClientRect().top + scrollY; if (scrollY > top) scrollTo({ top, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' }); }
    STATE.save();
    if (HAS_CH()) CH.context(STATE);
  }
  function go(patch, keepScroll) {
    const tabChange = patch.tab && patch.tab !== STATE.tab;
    Object.assign(STATE, patch);
    // cross-fade between tabs where view transitions exist (skipped for reduced motion)
    if (tabChange && document.startViewTransition && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) document.startViewTransition(() => render(keepScroll)); else render(keepScroll);
  }
  function scrollToId(id) { const el = document.getElementById(id); if (!el) return; const bar = $('.bar').offsetHeight; scrollTo({ top: el.getBoundingClientRect().top + scrollY - bar - 10, behavior: 'smooth' }); }
  let playT = null;
  function curve() { const host = document.getElementById('curveHost'); if (!host) return; const card = host.closest('.card'); const tmp = document.createElement('div'); tmp.innerHTML = VMK.curveMachine(STATE); card.replaceWith(tmp.firstElementChild); C.mount($('#main')); C.gc(); }
  function stopPlay() { if (playT) { clearInterval(playT); playT = null; STATE.cplay = false; } }
  function bind() {
    document.addEventListener('click', ev => {
      const t = ev.target;
      if (STATE.tab === 'whatif' && VL.onClick(ev, STATE, () => render(true))) return;
      const tb = t.closest('#tabs [data-tab]'); if (tb) { stopPlay(); go({ tab: tb.dataset.tab }); tb.scrollIntoView({ block: 'nearest', inline: 'nearest' }); return; }
      const gt = t.closest('[data-goto]'); if (gt) { ev.preventDefault(); K.drawer.close(); const patch = { tab: gt.dataset.goto }; if (gt.dataset.focus) { patch.focus = gt.dataset.focus; patch.cmp = []; } go(patch); if (gt.dataset.anchor) setTimeout(() => scrollToId(gt.dataset.anchor), 60); return; }
      const an = t.closest('[data-anchor]'); if (an) { ev.preventDefault(); scrollToId(an.dataset.anchor); return; }
      const ask = t.closest('[data-ask]'); if (ask) { ev.preventDefault(); K.drawer.close(); if (HAS_CH()) CH.open(ask.dataset.ask || ''); return; }
      if (t.closest('[data-close]') || t.id === 'scrim') { K.drawer.close(); return; }
      const ll = t.closest('[data-labload]'); if (ll) { VL.load(STATE, JSON.parse(ll.dataset.labload)); go({ tab: 'whatif' }); return; }
      const as = t.closest('[data-asset]'); if (as && !t.closest('.chat')) { ev.preventDefault(); FV.openAsset(as.dataset.asset); return; }
      const un = t.closest('[data-uncmp]'); if (un) { go({ cmp: (STATE.cmp || []).filter(c => c !== un.dataset.uncmp) }, true); return; }
      if (t.closest('[data-cplay]')) { if (playT) { stopPlay(); curve(); return; } STATE.cplay = true; if (!(+STATE.cback)) STATE.cback = F.N - 1 - F.ser('DGS3MO').s; curve(); playT = setInterval(() => { STATE.cback = Math.max(0, (+STATE.cback) - 21); curve(); if (!(+STATE.cback)) stopPlay(), curve(); }, 90); return; }
      const cj = t.closest('[data-cjump]'); if (cj) { stopPlay(); STATE.cback = cj.dataset.cjump === 'now' ? 0 : F.N - 1 - F.idx(cj.dataset.cjump); curve(); return; }
      const segs = { sectper: 'sectPer', range: 'range', mview: 'mview', cwin: 'cwin', hfrom: 'hFrom', mall: 'mAll', rhorizon: 'rHorizon', rrisk: 'rRisk' };
      for (const [a, k] of Object.entries(segs)) { const b = t.closest(`[data-${a}]`); if (b && b.tagName === 'BUTTON') { go({ [k]: b.dataset[a] }, true); return; } }
    });
    document.addEventListener('change', ev => {
      const t = ev.target;
      if (t.id === 'assetSel') { if (t.value) { FV.openAsset(t.value); t.value = ''; } return; }
      if (t.matches('[data-focus]')) { go({ focus: t.value, cmp: (STATE.cmp || []).filter(c => c !== t.value) }, true); return; }
      if (t.matches('[data-addcmp]')) { if (t.value) go({ cmp: (STATE.cmp || []).concat([t.value]).slice(0, 4) }, true); return; }
      if (t.matches('[data-logy]')) { go({ logY: t.checked }, true); return; }
    });
    document.addEventListener('input', ev => {
      const t = ev.target;
      if (STATE.tab === 'whatif' && VL.onInput(t, STATE)) return;
      if (t.matches('[data-cback]')) { stopPlay(); STATE.cback = +t.value; const host = document.getElementById('curveHost'); if (host) { const back = +t.value, N = F.N - 1, i = N - back; host.innerHTML = FV.curveChart(back ? [['Selected: ' + K.isoLab(F.CAL[i]), i], ['Latest', N]] : [['Latest', N], ['1 year ago', N - 252], ['5 years ago', FV.rangeStart('5Y')]], 250); C.mount(host); const out = host.parentElement.querySelector('output'); if (out) out.textContent = K.isoLab(F.CAL[i]); } return; }
    });
    document.addEventListener('pointerover', ev => { const q = ev.target.closest && ev.target.closest('[data-qk]'); const box = ev.target.closest && ev.target.closest('.pq'); if (!box) return; $$('.pq .qc.on').forEach(e => e.classList.remove('on')); box.classList.toggle('hl', !!q); if (q) $$(`.pq .qc[data-qk="${CSS.escape(q.dataset.qk)}"]`).forEach(e => e.classList.add('on')); }, { passive: true });
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { if (HAS_CH() && CH.isOpen()) { CH.close(); return; } if (K.drawer.isOpen) { K.drawer.close(); return; } }
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[data-asset][tabindex],tr[data-asset]')) { ev.preventDefault(); ev.target.click(); }
      if (ev.key === 'Tab' && K.drawer.isOpen) { const f = $$('#drawer button, #drawer a, #drawer select, #drawer [tabindex]'); if (!f.length) return; const a = f[0], b = f[f.length - 1]; if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); b.focus(); } else if (!ev.shiftKey && document.activeElement === b) { ev.preventDefault(); a.focus(); } }
      if (ev.target.matches('#tabs [data-tab]') && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) { const i = TABS.findIndex(x => x[0] === STATE.tab), j = (i + (ev.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length; go({ tab: TABS[j][0] }); $('#tab-' + TABS[j][0]).focus(); }
    });
    document.addEventListener('atlas:country', ev => FV.openAsset(ev.detail));
    document.addEventListener('atlas:theme', () => render(true));
    $('#scrim').addEventListener('click', () => K.drawer.close());
  }
  function hashRoute() { const h = (location.hash || '').replace('#', '').trim().toLowerCase(); const tab = TABS.find(t => t[0] === h); if (tab) STATE.tab = tab[0]; }
  async function start() {
    U.theme(); C.init(); T.init(); bind();
    try { await F.load(); } catch (e) { $('#main').innerHTML = `<div class="card empty">Could not load the market data (${esc(e.message)}). Please refresh in a minute.</div>`; return; }
    header(); hashRoute();
    if (HAS_CH()) CH.init(FCHAT.adapter(), STATE);
    if (typeof FX !== 'undefined') { try { FX.init(STATE); } catch (e) { console.error(e); } }
    if (typeof FINX !== 'undefined') { try { FINX.init(STATE); } catch (e) { console.error(e); } }
    setTimeout(() => render(true), 0);
  }
  return { start, render, go };
})();
document.addEventListener('DOMContentLoaded', () => APP.start());
