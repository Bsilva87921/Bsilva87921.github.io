/* Probable Atlas kit: sortable data tables with Table / Chart / Heat-map views, search and paging. */
const T = (() => {
  const { esc, ok, num } = K;
  const REG = new Map();
  function html(o) {
    const tid = K.uid('t');
    o = Object.assign({ view: 'table', limit: 40, search: true, views: ['table', 'chart', 'heat'] }, o);
    o.sort = o.sort || { k: o.cols[1] ? o.cols[1].k : o.cols[0].k, dir: -1 };
    o.chartCol = o.chartCol || (o.cols.find(c => c.num) || o.cols[1] || {}).k;
    o.q = ''; o.shown = o.limit;
    REG.set(tid, o);
    return `<div class="tblx" data-tid="${tid}">${ctl(tid, o)}<div class="tbody-host">${body(o)}</div></div>`;
  }
  function ctl(tid, o) {
    const vs = o.views.length > 1 ? `<div class="seg sm" role="group" aria-label="View">${o.views.map(v => `<button type="button" data-tview="${v}" aria-pressed="${o.view === v}">${{ table: 'Table', chart: 'Chart', heat: 'Heat map' }[v]}</button>`).join('')}</div>` : '';
    const numCols = o.cols.filter(c => c.num);
    const pick = `<label class="picker" ${o.view === 'chart' ? '' : 'hidden'} data-tpick><span class="sr">Chart column</span><select class="sel" data-tcol aria-label="Column to chart">${numCols.map(c => `<option value="${c.k}" ${c.k === o.chartCol ? 'selected' : ''}>${esc(c.lab)}</option>`).join('')}</select></label>`;
    const se = o.search ? `<input class="search" type="search" placeholder="${esc(o.placeholder || 'Search…')}" data-tq aria-label="Search table">` : '';
    return `<div class="tbl-ctl"><div class="l">${se}${o.extraCtl || ''}</div><div class="r">${pick}${vs}</div></div>`;
  }
  function filtered(o) {
    let rows = o.rows;
    if (o.q) { const q = o.q.toLowerCase(); rows = rows.filter(r => String(r._search || r[o.cols[0].k] || '').toLowerCase().includes(q)); }
    const c = o.cols.find(x => x.k === o.sort.k) || o.cols[0];
    const val = r => c.sortVal ? c.sortVal(r) : r[c.k];
    rows = rows.slice().sort((a, b) => {
      const va = val(a), vb = val(b), na = va == null || (typeof va === 'number' && !isFinite(va)), nb = vb == null || (typeof vb === 'number' && !isFinite(vb));
      if (na && nb) return 0; if (na) return 1; if (nb) return -1;
      return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * o.sort.dir;
    });
    return rows;
  }
  function heatBg(o, c, v) {
    if (!ok(v)) return '';
    if (!c._dist) c._dist = o.rows.map(r => r[c.k]).filter(ok).sort((a, b) => a - b);
    const p = S.pctRank(c._dist, v); if (p == null) return '';
    if (c.good) return `background:${C.div((p - 0.5) * 2 * c.good * 0.62)}`;
    return `background:${C.seq(p * 0.62)}`;
  }
  function body(o) {
    const rows = filtered(o);
    if (!rows.length) return `<div class="empty">Nothing matches.</div>`;
    if (o.view === 'chart') {
      const c = o.cols.find(x => x.k === o.chartCol) || o.cols[1];
      const lim = Math.min(rows.length, o.chartLimit || 30);
      const items = rows.filter(r => ok(r[c.k])).slice(0, lim).map(r => ({ name: r._name || r[o.cols[0].k], v: r[c.k], id: r._country, color: c.color ? c.color(r) : (c.good ? (r[c.k] >= (c.mid != null ? c.mid : 0) ? 'var(--s1)' : 'var(--s2)') : 'var(--s1)') }));
      return `<div class="card" style="box-shadow:none">${C.hbars(items, { fmt: c.fmt || (v => num(v, 1)) })}<div class="src">Top ${items.length} by the current sort (${esc(o.cols.find(x => x.k === o.sort.k).lab)}, ${o.sort.dir < 0 ? 'high to low' : 'low to high'}). Change the sort in Table view.</div></div>`;
    }
    const heat = o.view === 'heat';
    const shown = rows.slice(0, o.shown);
    const th = o.cols.map(c => `<th scope="col" ${o.sort.k === c.k ? `aria-sort="${o.sort.dir < 0 ? 'descending' : 'ascending'}"` : ''} title="${esc(c.title || c.lab)}"><button type="button" data-tsort="${c.k}">${esc(c.lab)}</button></th>`).join('');
    const tr = shown.map(r => {
      const attr = r._country ? ` class="click" data-country="${esc(r._country)}" tabindex="0"` : r._series ? ` class="click" data-series="${esc(r._series)}" tabindex="0"` : '';
      return `<tr${attr}>${o.cols.map((c, i) => {
        const v = r[c.k];
        if (c.html) return `<td${i === 0 ? ' class="name"' : ''}>${c.html(r)}</td>`;
        const txt = c.fmt ? c.fmt(v, r) : (typeof v === 'number' ? num(v, c.d != null ? c.d : 1) : esc(v == null ? '–' : v));
        const st = heat && c.num ? heatBg(o, c, v) : '';
        return `<td class="${i === 0 ? 'name' : ''}${!ok(v) && c.num ? ' na' : ''}${st ? ' heat' : ''}"${st ? ` style="${st}"` : ''}>${txt}</td>`;
      }).join('')}</tr>`;
    }).join('');
    const more = rows.length > o.shown ? `<button type="button" class="more" data-tmore>Show ${Math.min(o.limit, rows.length - o.shown)} more of ${rows.length - o.shown}</button>` : '';
    const hn = heat ? `<div class="src">Heat map: each column is shaded against the other rows. ${o.cols.some(c => c.good) ? 'Blue is better than the median and red is worse, where better has a clear direction; otherwise darker means higher.' : 'Darker means higher.'}</div>` : '';
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>${more}${hn}`;
  }
  function refresh(host) { const o = REG.get(host.dataset.tid); host.querySelector('.tbody-host').innerHTML = body(o); }
  function init() {
    document.addEventListener('click', ev => {
      const host = ev.target.closest('.tblx'); if (!host) return;
      const o = REG.get(host.dataset.tid); if (!o) return;
      const s = ev.target.closest('[data-tsort]');
      if (s) { const k = s.dataset.tsort; if (o.sort.k === k) o.sort.dir *= -1; else { o.sort = { k, dir: (o.cols.find(c => c.k === k) || {}).num ? -1 : 1 }; } refresh(host); return; }
      const v = ev.target.closest('[data-tview]');
      if (v) { o.view = v.dataset.tview; host.querySelectorAll('[data-tview]').forEach(b => b.setAttribute('aria-pressed', b === v)); const pk = host.querySelector('[data-tpick]'); if (pk) pk.hidden = o.view !== 'chart'; refresh(host); return; }
      if (ev.target.closest('[data-tmore]')) { o.shown += o.limit; refresh(host); }
    });
    document.addEventListener('input', ev => {
      const host = ev.target.closest('.tblx'); if (!host) return;
      const o = REG.get(host.dataset.tid); if (!o) return;
      if (ev.target.matches('[data-tq]')) { o.q = ev.target.value.trim(); o.shown = o.limit; refresh(host); }
    });
    document.addEventListener('change', ev => {
      const host = ev.target.closest('.tblx'); if (!host) return;
      const o = REG.get(host.dataset.tid); if (!o) return;
      if (ev.target.matches('[data-tcol]')) { o.chartCol = ev.target.value; refresh(host); }
    });
  }
  function gc() { for (const [tid] of REG) if (!document.querySelector(`.tblx[data-tid="${tid}"]`)) REG.delete(tid); }
  return { html, init, gc, REG };
})();

/* Probable Atlas kit: recommendation cards (problem, evidence, impact range, trade-offs, confidence). */
const R = (() => {
  const { esc } = K;
  const CONF = { High: 3, Medium: 2, Low: 1 };
  function conf(level) { const n = CONF[level] || 1; return `<span class="conf" title="${esc(level)} confidence">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}<span style="margin-left:6px;font-size:12px;color:var(--ink-2)">${esc(level)} confidence</span></span>`; }
  function card(r, i) {
    const tone = r.tone || 'var(--accent)';
    return `<article class="reco" style="border-left-color:${tone}">
      <div class="top"><h3><span class="rank">${String(i + 1).padStart(2, '0')}</span>${esc(r.title)}</h3>${conf(r.confidence)}</div>
      <dl>
        <dt>Problem</dt><dd>${r.problem}</dd>
        <dt>Evidence</dt><dd>${r.evidence}</dd>
        <dt>Expected impact</dt><dd>${r.impact}</dd>
        <dt>Trade-offs</dt><dd>${r.tradeoffs}</dd>
        ${r.how ? `<dt>How</dt><dd>${r.how}</dd>` : ''}
      </dl>
    </article>`;
  }
  const list = recs => recs.length ? `<div class="recos">${recs.map(card).join('')}</div>` : `<div class="card empty">No recommendation clears the evidence bar for this economy right now.</div>`;
  return { card, list, conf };
})();
