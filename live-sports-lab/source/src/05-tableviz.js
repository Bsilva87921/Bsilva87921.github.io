/* ==========================================================================
   Probable — table visualizations: a "Chart" switch draws the table as a
   chart above it (bars, dots, vs-average, scatter, columns, line) and a
   "Heat map" switch shades every numeric cell by its rank in the column.
   Any table wrapped in <div class="vz" data-vz="id" ...> is picked up
   automatically, and re-read every time its table is re-rendered.
   ========================================================================== */
(function () {
  'use strict';
  const APP = window.APP, C = APP.charts, { esc } = APP;
  const V = APP.viz = {};
  const KEY = 'probable-viz';
  let ST = {};
  try { ST = JSON.parse(APP.lsGet(KEY) || '{}') || {}; } catch (e) { ST = {}; }
  const save = () => APP.lsSet(KEY, JSON.stringify(ST));
  const TYPE_LAB = { bars: 'Bars', dots: 'Dots', avg: 'vs Avg', scatter: 'Scatter', cols: 'Columns', line: 'Line' };
  const fin = v => typeof v === 'number' && isFinite(v);

  function state(vz) {
    const id = vz.getAttribute('data-vz');
    if (!ST[id]) ST[id] = {};
    const s = ST[id];
    if (s.on == null) s.on = vz.getAttribute('data-vz-on') !== '0';
    if (s.heat == null) s.heat = vz.getAttribute('data-vz-heat') === '1';
    return s;
  }

  /* ---------- read the table ---------- */
  function num(txt) {
    const t = String(txt == null ? '' : txt).replace(/−/g, '-').replace(/,/g, '').replace(/\s+/g, '').trim();
    if (/^[+-]?(\d+\.?\d*|\.\d+)%?$/.test(t)) return parseFloat(t);
    if (/^\d+:\d{2}$/.test(t)) { const [m, s] = t.split(':'); return +m + s / 60; }
    return NaN;
  }
  function kindOfCol(texts) {
    if (texts.some(t => /%$/.test(t))) return 'pct';
    if (texts.some(t => /^\d+:\d{2}$/.test(t))) return 'time';
    if (texts.filter(t => /^[+−-]?\.\d{3}$/.test(t)).length >= texts.length * 0.5) return 'avg';
    return 'num';
  }
  const TICK = {
    pct: v => (Math.abs(v) >= 10 ? v.toFixed(0) : (+v.toFixed(1)).toString()) + '%',
    time: v => Math.floor(v) + ':' + String(Math.round((v - Math.floor(v)) * 60)).padStart(2, '0'),
    avg: v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(3).replace(/^0\./, '.'),
    num: v => (v < 0 ? '−' : '') + C.fmtAuto(Math.abs(v))
  };
  function read(vz) {
    const tbl = vz.querySelector('table'); if (!tbl || !tbl.tHead || !tbl.tBodies[0]) return null;
    const hr = tbl.tHead.rows[tbl.tHead.rows.length - 1];
    const cols = [...hr.cells].map((th, j) => {
      const lab = (th.getAttribute('data-vz-lab') || th.textContent || '').replace(/[▾▴]/g, '').trim();
      return { j, lab, low: th.hasAttribute('data-low') || !!th.querySelector('[data-low]'), skip: th.classList.contains('l') || th.hasAttribute('data-vz-skip') || lab === '#' || !lab, desc: th.getAttribute('title') || '', sorted: th.getAttribute('aria-sort') && th.getAttribute('aria-sort') !== 'none' };
    });
    const trs = [...tbl.tBodies[0].rows].filter(tr => !tr.classList.contains('grp') && !tr.classList.contains('tot') && tr.cells.length === cols.length);
    const attr = vz.getAttribute('data-vz-attr');
    const rows = trs.map((tr, i) => {
      const labCell = tr.querySelector('td.l');
      const labTxt = tr.getAttribute('data-lab') || (labCell ? (labCell.querySelector('b') || labCell.querySelector('.team span:not(.badge):not(.clinch)') || labCell).textContent.trim() : '#' + (i + 1));
      const cells = [...tr.cells].map(td => ({ txt: td.hasAttribute('data-v') ? td.getAttribute('data-v') : td.textContent.trim(), disp: td.getAttribute('data-d') || td.textContent.trim() }));
      return { tr, i, lab: labTxt, name: tr.getAttribute('data-name') || labTxt, sel: tr.classList.contains('sel'), key: attr ? tr.getAttribute(attr) : null, cells };
    });
    const numeric = cols.filter(c => !c.skip).map(c => {
      const texts = rows.map(r => r.cells[c.j].txt), vals = texts.map(num), n = vals.filter(fin).length;
      return Object.assign(c, { vals, fmt: kindOfCol(texts), n });
    }).filter(c => c.n >= Math.max(2, rows.length * 0.6));
    return { tbl, cols, rows, numeric, attr };
  }

  /* ---------- heat map: shade cells by rank within the column ---------- */
  function heat(d, on, vz) {
    const directional = vz.getAttribute('data-vz-dir') !== '0';
    for (const c of d.numeric) {
      const vals = c.vals.filter(fin).slice().sort((a, b) => a - b), n = vals.length;
      d.rows.forEach((r, i) => {
        const td = r.tr.cells[c.j]; if (!td) return;
        const v = c.vals[i];
        if (!on || !fin(v) || n < 2) { td.style.removeProperty('background'); td.classList.remove('hm'); return; }
        let lo = 0; while (lo < n && vals[lo] < v) lo++; let hi = lo; while (hi < n && vals[hi] === v) hi++;
        let p = ((lo + hi - 1) / 2) / (n - 1);
        if (directional && c.low) p = 1 - p;
        td.style.background = `color-mix(in srgb, var(--heat) ${Math.round(4 + 50 * p)}%, transparent)`;
        td.classList.add('hm');
      });
    }
    vz.classList.toggle('heat', !!on);
  }

  /* ---------- chart ---------- */
  function pick(d, s, vz) {
    const nums = d.numeric; if (!nums.length) return null;
    const sorted = nums.find(c => c.sorted);
    if (sorted && sorted.lab !== s.lastSort) { s.lastSort = sorted.lab; s.m = null; }
    const pref = (vz.getAttribute('data-vz-pref') || '').split(',').map(x => x.trim()).filter(Boolean);
    return nums.find(c => c.lab === s.m) || sorted || nums.find(c => pref.includes(c.lab)) || nums.find(c => c.lab === vz.getAttribute('data-vz-def')) || nums[0];
  }
  function chartHTML(d, s, vz, m) {
    const order = vz.getAttribute('data-vz-order') || 'rank';
    const types = (vz.getAttribute('data-vz-types') || (order === 'rank' ? 'bars,dots,avg,scatter' : 'cols,line')).split(',');
    const type = types.includes(s.type) ? s.type : types[0];
    const fmt = TICK[m.fmt] || TICK.num;
    const pts = d.rows.map((r, i) => ({ lab: r.lab, name: r.name, v: m.vals[i], disp: r.cells[m.j].disp, sel: r.sel, key: r.key })).filter(p => fin(p.v));
    if (pts.length < 2) return '<div class="empty">Not enough values in this column to chart.</div>';
    const attr = d.attr || undefined, what = esc(m.lab);
    const mean = pts.reduce((a, p) => a + p.v, 0) / pts.length;
    let svg = '', cap = '';
    if (order !== 'rank') {
      const seq = order === 'seqrev' ? pts.slice().reverse() : pts;
      if (type === 'line') svg = C.lines([{ key: 'v', label: m.lab, pts: seq.map((p, i) => [i, p.v]), sel: true }], { dots: true, pointTips: true, xFmt: i => (seq[i] ? seq[i].lab : ''), xTipFmt: i => (seq[i] ? seq[i].name : ''), xInt: true, yFmt: fmt, h: 220, aria: m.lab + ' by ' + (vz.getAttribute('data-vz-x') || 'row') });
      else svg = C.cols(seq.map(p => ({ lab: p.lab, v: p.v, sel: p.sel, tip: `${esc(p.name)}: <b>${esc(p.disp)}</b>` })), { base: 0, yFmt: fmt, h: 210, rot: seq.length > 14, aria: m.lab });
      cap = `${what} · ${order === 'seqrev' ? 'oldest to newest' : 'in table order'}`;
      return `<div class="vz-cap">${cap}</div>${svg}`;
    }
    const better = (a, b) => m.low ? a.v - b.v : b.v - a.v;
    const ranked = pts.slice().sort(better);
    const N = s.n === 'all' ? ranked.length : (+s.n || +vz.getAttribute('data-vz-n') || 15);
    let shown = ranked.slice(0, N);
    const selOut = ranked.slice(N).filter(p => p.sel); if (selOut.length) shown = shown.concat(selOut);
    if (type === 'scatter') {
      const nums = d.numeric; let m2 = nums.find(c => c.lab === s.m2 && c !== m) || nums.find(c => c !== m && c.lab === vz.getAttribute('data-vz-def2')) || nums.find(c => c !== m);
      if (!m2) return '<div class="empty">Scatter needs two numeric columns.</div>';
      const f2 = TICK[m2.fmt] || TICK.num;
      const sp = d.rows.map((r, i) => ({ x: m.vals[i], y: m2.vals[i], key: r.key, label: r.lab, sel: r.sel, tip: `${esc(r.name)}<br>${esc(m.lab)} <b>${esc(r.cells[m.j].disp)}</b> · ${esc(m2.lab)} <b>${esc(r.cells[m2.j].disp)}</b>` })).filter(p => fin(p.x) && fin(p.y));
      sp.slice().sort((a, b) => m2.low ? a.y - b.y : b.y - a.y).slice(0, 6).forEach(p => { p.emph = true; });
      sp.slice().sort((a, b) => m.low ? a.x - b.x : b.x - a.x).slice(0, 3).forEach(p => { p.emph = true; });
      const mx = sp.reduce((a, p) => a + p.x, 0) / sp.length, my = sp.reduce((a, p) => a + p.y, 0) / sp.length;
      svg = C.scatter(sp, { xLab: m.lab + (m.low ? ' (lower is better)' : ''), yLab: m2.lab + (m2.low ? ' (lower is better, flipped)' : ''), refX: mx, refY: my, invertY: m2.low, xFmt: fmt, yFmt: f2, attr, h: 340, aria: `${m2.lab} versus ${m.lab}` });
      cap = `${what} (x) vs ${esc(m2.lab)} (y) · dashed lines = averages · labeled: leaders on each axis`;
      return `<div class="vz-cap">${cap}</div>${svg}`;
    }
    if (type === 'dots') {
      svg = C.dots(shown.map(p => ({ lab: p.lab, name: p.name, v: p.v, disp: p.disp, sel: p.sel, key: p.key })), { avg: mean, avgLab: 'avg ' + fmt(mean), xFmt: fmt, attr, aria: m.lab + ' ranking' });
      cap = `${what} · ${m.low ? 'lowest (best)' : 'highest'} first${shown.length < ranked.length ? ` · top ${Math.min(N, ranked.length)} of ${ranked.length}` : ''} · dashed line = average`;
    } else if (type === 'avg') {
      svg = C.hbars(shown, { mode: 'avg', center: mean, flip: m.low, fmt, diffFmt: v => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v)), avgLab: 'average ' + fmt(mean), attr, aria: m.lab + ' versus average' });
      cap = `${what} versus the average of the ${ranked.length} shown in the table${m.low ? ' · lower is better, so below-average values extend right' : ''}`;
    } else {
      svg = C.hbars(shown, { fmt, attr, aria: m.lab + ' ranking' });
      cap = `${what} · ${m.low ? 'lowest (best)' : 'highest'} first${shown.length < ranked.length ? ` · top ${Math.min(N, ranked.length)} of ${ranked.length}` : ''}`;
    }
    return `<div class="vz-cap">${cap}${m.desc ? ` <span class="muted">· ${esc(m.desc)}</span>` : ''}</div><div class="vz-scroll">${svg}</div>`;
  }

  function toolbar(vz, s, d, m) {
    const order = vz.getAttribute('data-vz-order') || 'rank';
    const types = (vz.getAttribute('data-vz-types') || (order === 'rank' ? 'bars,dots,avg,scatter' : 'cols,line')).split(',');
    const type = types.includes(s.type) ? s.type : types[0];
    const sw = (k, on, lab, tip) => `<button type="button" class="switch" role="switch" aria-checked="${on}" data-vzt="${k}" title="${esc(tip)}"><span class="tr" aria-hidden="true"><span class="kn"></span></span>${esc(lab)}</button>`;
    const opt = (c, cur) => `<option value="${esc(c.lab)}" ${c === cur ? 'selected' : ''}>${esc(c.lab)}</option>`;
    let opts = '';
    if (s.on && d && d.numeric.length) {
      opts += `<span class="seg sm" role="group" aria-label="Chart type">${types.map(t => `<button type="button" data-vzy="${t}" aria-pressed="${t === type}">${TYPE_LAB[t] || t}</button>`).join('')}</span>`;
      opts += `<label class="vz-sel"><span>${type === 'scatter' ? 'X' : 'Stat'}</span><select class="sel" data-vzs="m" aria-label="Stat to chart">${d.numeric.map(c => opt(c, m)).join('')}</select></label>`;
      if (type === 'scatter') {
        const m2 = d.numeric.find(c => c.lab === s.m2 && c !== m) || d.numeric.find(c => c !== m && c.lab === vz.getAttribute('data-vz-def2')) || d.numeric.find(c => c !== m);
        if (m2) opts += `<label class="vz-sel"><span>Y</span><select class="sel" data-vzs="m2" aria-label="Second stat">${d.numeric.filter(c => c !== m).map(c => opt(c, m2)).join('')}</select></label>`;
      } else if (order === 'rank' && type !== 'scatter' && d.rows.length > 12) {
        const cur = s.n || vz.getAttribute('data-vz-n') || '15';
        opts += `<label class="vz-sel"><span>Show</span><select class="sel" data-vzs="n" aria-label="How many to chart">${[...new Set(['10', '15', '25', String(cur), 'all'])].sort((a, b) => (a === 'all') - (b === 'all') || +a - +b).map(n => `<option value="${n}" ${String(cur) === n ? 'selected' : ''}>${n === 'all' ? 'All ' + d.rows.length : 'Top ' + n}</option>`).join('')}</select></label>`;
      }
    }
    const heatLeg = s.heat ? `<span class="vz-leg" title="Each numeric cell is shaded by its rank within its column">${vz.getAttribute('data-vz-dir') === '0' ? 'lower' : 'worse'} <i class="ramp"></i> ${vz.getAttribute('data-vz-dir') === '0' ? 'higher' : 'better'}</span>` : '';
    return `${sw('on', s.on, 'Chart', 'Draw this table as a chart above it')}${sw('heat', s.heat, 'Heat map', 'Shade every stat by its rank in the column')}${heatLeg}<span class="vz-opts">${opts}</span>`;
  }

  function refresh(vz) {
    if (!vz.isConnected) return;
    const s = state(vz);
    let bar = vz.querySelector(':scope > .vz-bar'), box = vz.querySelector(':scope > .vz-chart');
    if (!bar) { bar = document.createElement('div'); bar.className = 'vz-ui vz-bar'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Visualize this table'); vz.prepend(bar); }
    if (!box) { box = document.createElement('div'); box.className = 'vz-ui vz-chart'; bar.after(box); }
    const d = read(vz);
    const m = d ? pick(d, s, vz) : null;
    bar.innerHTML = toolbar(vz, s, d, m);
    if (s.on && d && m) { box.hidden = false; box.innerHTML = chartHTML(d, s, vz, m); } else { box.hidden = true; box.innerHTML = ''; }
    if (d) heat(d, s.heat, vz);
  }
  V.refresh = refresh;
  V.refreshAll = root => (root || document).querySelectorAll('.vz').forEach(refresh);
  function refreshId(id) { document.querySelectorAll(`.vz[data-vz="${CSS.escape(id)}"]`).forEach(refresh); }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const t = e.target; if (!t.closest) return;
    const vz = t.closest('.vz'); if (!vz || !t.closest('.vz-bar')) return;
    const id = vz.getAttribute('data-vz'), s = state(vz);
    const sw = t.closest('[data-vzt]');
    if (sw) { const k = sw.getAttribute('data-vzt'); s[k] = !s[k]; save(); refreshId(id); const b = vz.querySelector(`[data-vzt="${k}"]`); if (b) b.focus(); return; }
    const ty = t.closest('[data-vzy]');
    if (ty) { s.type = ty.getAttribute('data-vzy'); save(); refreshId(id); const b = vz.querySelector(`[data-vzy="${s.type}"]`); if (b) b.focus(); }
  });
  document.addEventListener('change', e => {
    const t = e.target; if (!t.closest) return;
    const vz = t.closest('.vz'); if (!vz || !t.hasAttribute('data-vzs')) return;
    const s = state(vz), k = t.getAttribute('data-vzs');
    s[k] = t.value; save();
    refresh(vz); const again = vz.querySelector(`[data-vzs="${k}"]`); if (again) again.focus();
  });
  // pick up every .vz as it appears, and re-read it whenever its table is re-rendered
  const mo = new MutationObserver(muts => {
    const set = new Set();
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType !== 1 || (n.closest && n.closest('.vz-ui'))) continue;
      const host = n.closest && n.closest('.vz'); if (host) set.add(host);
      if (n.querySelectorAll) n.querySelectorAll('.vz').forEach(x => set.add(x));
    }
    set.forEach(refresh);
  });
  if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', () => mo.observe(document.body, { childList: true, subtree: true }));
})();
