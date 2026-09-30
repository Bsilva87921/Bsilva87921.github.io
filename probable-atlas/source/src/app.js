/* Probable Atlas · Economics: app shell (routing, scope, module nav, country drawer, events). */
const TABS = [['live', 'Live now'], ['indicators', 'Indicators'], ['models', 'Models & forecasts'], ['whatif', 'What-if lab'], ['recs', 'Recommendations'], ['history', 'History'], ['how', 'How it works']];
const MODULES = [['econ', 'Economics', true], ['fin', 'Finance & markets'], ['comm', 'Commodities & scarcity'], ['wx', 'Weather & climate'], ['ag', 'Agriculture & food'], ['hunger', 'Hunger'], ['wealth', 'Wealth & inequality'], ['tech', 'Tech & innovation'], ['conflict', 'Conflict & security'], ['pulse', 'World Pulse']];
const STATE = K.store('atlas-econ-v1', { scope: 'WLD', tab: 'live', mapInd: 'g', indGrp: 'Growth & size', indFilter: 'top40', usSeries: 'UNRATE', usRange: '10', cSeries: 'imf:NGDP_RPCH', recModel: 'classic', wiIso: 'CHN' }, ['tab', 'scope', 'mapInd', 'indGrp', 'indFilter', 'usRange', 'recModel', 'usSeries', 'cSeries', 'wiIso']);

const APP = (() => {
  const { $, $$, esc, ok, num, pct, sgn } = K;
  function header() {
    $('#modnav').innerHTML = MODULES.map(([k, lab, on]) => `<button type="button" ${on ? 'aria-current="true"' : 'disabled title="Coming next in the Atlas build plan"'}>${esc(lab)}${on ? '' : ' <span class="soon">soon</span>'}</button>`).join('');
    // faint world map behind the masthead
    const g = $('#grat'); g.setAttribute('viewBox', `0 0 ${MAP.w} ${MAP.h}`);
    g.innerHTML = `<path d="${MAP.outline}" style="fill:none;stroke:#5FD3C8;stroke-width:1"/>` + Object.values(MAP.p).map(d => `<path d="${d}" style="fill:#5FD3C8;opacity:.35"/>`).join('');
    $('#tabs').innerHTML = TABS.map(([k, l]) => `<button type="button" role="tab" id="tab-${k}" data-tab="${k}" aria-selected="${STATE.tab === k}" aria-controls="main">${esc(l)}</button>`).join('');
    const opts = E.COUNTRIES.filter(c => c.gdp).map(c => [c.iso, c.name]).sort((a, b) => a[1].localeCompare(b[1]));
    $('#countrySel').innerHTML = `<option value="">Any country…</option>` + opts.map(([i, n]) => `<option value="${i}">${esc(n)}</option>`).join('');
    const st = E.ST || {}, fetched = st.fetched_at || E.W.fetched_at;
    const usLast = E.us('DGS10') ? E.us('DGS10').last : '';
    const snap = !!window.ATLAS_DATA;
    $('#fresh').innerHTML = `<span><span class="dot"></span>${snap ? 'Saved snapshot' : 'Data refreshed'} ${esc(K.isoLab((fetched || '').slice(0, 10)))}${snap ? '' : ' (' + esc(K.ago(fetched)) + ')'}</span><span>${esc(E.VINT)}</span><span>FRED through ${esc(K.isoLab(usLast))}</span>`;
    $('#footVer').textContent = snap ? 'This copy runs on saved data. The live version refreshes twice a day at bsilva87921.github.io/probable-atlas/' : 'Refreshed automatically by a scheduled GitHub Actions job.';
  }
  function syncScopeUI() {
    $$('#scopeSeg [data-scope]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scope === STATE.scope)));
    $('#countrySel').value = STATE.scope !== 'WLD' && STATE.scope !== 'USA' ? STATE.scope : '';
    $$('#tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === STATE.tab)));
    const lab = STATE.scope === 'WLD' ? 'World' : E.name(STATE.scope);
    document.title = `Probable Atlas · Economics · ${lab}`;
  }
  function render(keepScroll) {
    const main = $('#main');
    if (STATE.scope !== 'WLD' && !E.BYISO[STATE.scope]) STATE.scope = 'WLD';
    syncScopeUI();
    let html = '';
    try {
      html = STATE.tab === 'live' ? V.live(STATE) : STATE.tab === 'indicators' ? VI.view(STATE) : STATE.tab === 'models' ? VM.view(STATE) : STATE.tab === 'whatif' ? VW.view(STATE) : STATE.tab === 'recs' ? VR.view(STATE) : STATE.tab === 'history' ? VH.view(STATE) : VH.how();
    } catch (e) { console.error(e); html = `<div class="card empty">Something went wrong building this view (${esc(e.message)}). Try another tab or scope.</div>`; }
    main.innerHTML = html;
    C.mount(main); C.gc(); T.gc();
    if (!keepScroll) { const bar = $('.bar'); const top = bar.getBoundingClientRect().top + scrollY; if (scrollY > top) scrollTo({ top, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' }); }
    STATE.save();
  }
  /* ---------------- country profile drawer ---------------- */
  function openCountry(iso) {
    if (!E.BYISO[iso]) return;
    const c = E.BYISO[iso], ind = id => E.indById(id), v = id => ind(id).get(iso);
    const rk = M.growth().risk(iso), fan = M.growth().fan(iso), am = M.archetypes().byIso[iso];
    const hist = E.imfS('NGDP_RPCH', iso, 2000, E.CY + 5);
    const chart = fan ? C.line({ series: [{ name: 'Growth', pts: hist, color: 'var(--s1)', width: 2, projFrom: E.VYEAR - 0.5 }, { name: 'World', pts: E.imfS('NGDP_RPCH', 'WEOWORLD', 2000, E.CY + 5), color: 'var(--s3)', width: 1.4, dash: '4 3' }], bands: [{ lo: fan.years.map((y, k) => [y, fan.p10[k]]), hi: fan.years.map((y, k) => [y, fan.p90[k]]), name: '80% range', color: 'var(--s1)', op: 0.14 }], h: 220, projFrom: E.VYEAR - 0.5, projLabel: 'IMF projection', yFmt: x => num(x, 0) + '%', tipX: x => String(Math.round(x)), aria: 'Growth history and outlook' }) : '';
    const recs = VR.recsFor(iso).slice(0, 3);
    const arch = am ? M.archetypes().names[am.c] : null;
    const tiles = [
      V.tile({ lab: `Growth ${E.CY}`, val: E.fmtInd(ind('g'), v('g')), sub: `${E.CY + 1}: ${E.fmtInd(ind('g1'), v('g1'))}` }),
      V.tile({ lab: `Inflation ${E.CY}`, val: E.fmtInd(ind('inf'), v('inf')) }),
      V.tile({ lab: 'Unemployment', val: E.fmtInd(ind('unemp'), v('unemp')) }),
      V.tile({ lab: 'Government debt', val: E.fmtInd(ind('debt'), v('debt')), unit: 'GDP' }),
      V.tile({ lab: 'GDP per person', val: E.fmtInd(ind('gdppc'), v('gdppc')) }),
      V.tile({ lab: `Contraction risk ${E.CY + 1}`, val: rk && ok(rk.pN) ? pct(rk.pN * 100, 0) : '–' })
    ].join('');
    K.drawer.open(`<div class="dh"><div><div class="kicker" style="color:var(--band-accent)">Country profile</div><h2 id="drTitle">${esc(c.name)}</h2><div class="meta">${esc(c.region)} · ${esc(c.inc)} · #${c.rank || '–'} by GDP${c.cap ? ' · capital ' + esc(c.cap) : ''}</div></div><button type="button" class="x" data-close aria-label="Close">×</button></div>
      <div class="db"><div class="tiles">${tiles}</div>
      ${chart ? V.card('Growth since 2000 and outlook', 'IMF data; the band is 80% of simulated paths.', chart) : ''}
      ${V.card(`Versus ${c.inc.toLowerCase()} peers`, 'Percentile among peers; right is always stronger.', V.peerBars(iso))}
      ${arch ? `<div class="callout"><b>Archetype: ${esc(arch.name)}.</b> ${esc(arch.blurb)} Most similar: ${M.archetypes().nearest(iso, 4).map(x => V.clink(x.iso)).join(', ')}.</div>` : ''}
      ${recs.length ? `<div><div class="sec-h" style="margin-top:4px"><h2 style="font-size:18px">Top recommendations</h2></div>${R.list(recs)}</div>` : ''}
      <div class="pill-row"><button type="button" class="btn pri" data-scopeto="${iso}">Open ${esc(c.name)} in every tab</button><button type="button" class="btn" data-close>Close</button></div></div>`);
    C.mount($('#drawer'));
  }

  /* ---------------- events ---------------- */
  function go(patch, keepScroll) { Object.assign(STATE, patch); render(keepScroll); }
  function bind() {
    document.addEventListener('click', ev => {
      const t = ev.target;
      if (VW.onClick(ev)) return;
      const sc = t.closest('#scopeSeg [data-scope]'); if (sc) { go({ scope: sc.dataset.scope }); return; }
      const tb = t.closest('#tabs [data-tab]'); if (tb) { go({ tab: tb.dataset.tab }); tb.scrollIntoView({ block: 'nearest', inline: 'nearest' }); return; }
      const gt = t.closest('[data-goto]'); if (gt) { ev.preventDefault(); go({ tab: gt.dataset.goto, scope: gt.dataset.goto === 'models' && STATE.scope === 'WLD' ? 'USA' : STATE.scope }); return; }
      if (t.closest('[data-close]') || t.id === 'scrim') { K.drawer.close(); return; }
      const st = t.closest('[data-scopeto]'); if (st) { K.drawer.close(); go({ scope: st.dataset.scopeto }); return; }
      const cl = t.closest('[data-country]'); if (cl) { ev.preventDefault(); openCountry(cl.dataset.country); return; }
      const se = t.closest('[data-series]'); if (se && VI.SPEC[se.dataset.series]) { go({ scope: 'USA', tab: 'indicators', usSeries: se.dataset.series }); return; }
      const rr = t.closest('[data-usrange]'); if (rr) { go({ usRange: rr.dataset.usrange }, true); return; }
      const rm = t.closest('[data-recmodel]'); if (rm) { go({ recModel: rm.dataset.recmodel }, true); return; }
    });
    document.addEventListener('change', ev => {
      const t = ev.target;
      if (t.id === 'countrySel') { if (t.value) go({ scope: t.value }); return; }
      const map = { mapind: 'mapInd', indgrp: 'indGrp', indfilter: 'indFilter', usseries: 'usSeries', cseries: 'cSeries', wiiso: 'wiIso' };
      for (const [a, k] of Object.entries(map)) if (t.hasAttribute('data-' + a)) { go({ [k]: t.value }, true); return; }
    });
    document.addEventListener('input', ev => { if (ev.target.matches('[data-wi]')) VW.onInput(ev.target); });
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape' && K.drawer.isOpen) { K.drawer.close(); return; }
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[data-country][tabindex],[data-series][tabindex],tr[data-country],tr[data-series]')) { ev.preventDefault(); ev.target.click(); }
      if (ev.key === 'Tab' && K.drawer.isOpen) { const f = $$('#drawer button, #drawer a, #drawer select, #drawer [tabindex]'); if (!f.length) return; const a = f[0], b = f[f.length - 1]; if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); b.focus(); } else if (!ev.shiftKey && document.activeElement === b) { ev.preventDefault(); a.focus(); } }
      if (ev.target.matches('#tabs [data-tab]') && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) { const i = TABS.findIndex(x => x[0] === STATE.tab), j = (i + (ev.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length; go({ tab: TABS[j][0] }); $('#tab-' + TABS[j][0]).focus(); }
    });
    document.addEventListener('atlas:country', ev => openCountry(ev.detail));
    $('#scrim').addEventListener('click', () => K.drawer.close());
  }
  function hashRoute() {
    const h = (location.hash || '').replace('#', '').trim();
    if (!h) return;
    const tab = TABS.find(t => t[0] === h.toLowerCase()); if (tab) { STATE.tab = tab[0]; return; }
    const up = h.toUpperCase(); if (up === 'WLD' || up === 'WORLD') STATE.scope = 'WLD'; else if (E.BYISO[up]) STATE.scope = up;
  }
  async function start() {
    C.init(); T.init(); bind();
    try { await E.load(); } catch (e) { $('#main').innerHTML = `<div class="card empty">Could not load the data (${esc(e.message)}). Please refresh in a minute.</div>`; return; }
    E.buildCatalog(); header(); hashRoute(); render(true);
  }
  return { start, render, openCountry, go };
})();
document.addEventListener('DOMContentLoaded', () => APP.start());
