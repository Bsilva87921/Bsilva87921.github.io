/* Probable Atlas kit: SVG charts drawn at the container's real pixel width (legible on phones), with hover layers. */
const C = (() => {
  const { esc, ok, num } = K;
  const REG = new Map();          // cid -> {type, opts, model}
  const PAL = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];

  /* ---- color scales (theme-aware through CSS variables) ---- */
  const seq = p => `color-mix(in oklab, var(--seq-1) ${Math.round(K.clamp(p, 0, 1) * 100)}%, var(--seq-0))`;
  const div = t => { // t in [-1, 1]
    t = K.clamp(t, -1, 1);
    return t < 0 ? `color-mix(in oklab, var(--div-neg) ${Math.round(-t * 100)}%, var(--div-mid))` : `color-mix(in oklab, var(--div-pos) ${Math.round(t * 100)}%, var(--div-mid))`;
  };

  /* ---- ticks ---- */
  function niceStep(span, n) { const raw = span / Math.max(n, 1), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }
  function yTicks(lo, hi, n) { if (lo === hi) { lo -= 1; hi += 1; } const st = niceStep(hi - lo, n), a = Math.floor(lo / st) * st, b = Math.ceil(hi / st) * st, out = []; for (let v = a; v <= b + st / 2; v += st) out.push(+v.toFixed(10)); return { ticks: out, lo: a, hi: b }; }
  function xYearTicks(lo, hi, w) { const span = hi - lo, maxN = Math.max(2, Math.floor(w / 64)); const steps = [0.25, 0.5, 1, 2, 5, 10, 20, 25, 50]; let st = steps.find(s => span / s <= maxN) || 50; const out = []; for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) out.push(+v.toFixed(4)); return { ticks: out, st }; }
  const yearLab = (x, st) => st >= 1 ? String(Math.round(x)) : (K.MON[Math.round((x % 1) * 12) % 12] + ' ' + String(Math.floor(x)).slice(2));

  function place(cid, type, opts) {
    REG.set(cid, { type, opts });
    const h = opts.h || 240;
    return `<div class="chart" data-cid="${cid}" style="min-height:${h}px" role="img" aria-label="${esc(opts.aria || opts.title || 'chart')}"></div>`;
  }
  function legendHTML(items) {
    if (!items || items.length < 2) return '';
    return `<div class="legend">${items.map(it => `<span><i class="${it.kind || ''}" style="background:${it.color}"></i>${esc(it.name)}</span>`).join('')}</div>`;
  }

  /* ---------------- time-series / line chart ---------------- */
  function line(opts) { const cid = K.uid('c'); return (opts.legend !== false ? legendHTML(legendItems(opts)) : '') + place(cid, 'line', opts); }
  function legendItems(o) {
    const it = (o.series || []).filter(s => s.name && !s.noLegend).map((s, i) => ({ name: s.name, color: s.color || PAL[i] }));
    for (const b of o.bands || []) if (b.name) it.push({ name: b.name, color: b.color || 'var(--s1)', kind: 'band' });
    if (o.shade && o.shade.length && o.shadeName) it.push({ name: o.shadeName, color: 'var(--rec)', kind: 'sq' });
    return it;
  }
  function drawLine(o, W) {
    const H = o.h || 240, endW = o.endLabels ? Math.min(120, Math.max(70, W * 0.16)) : 0;
    const m = { l: o.ml || 44, r: 12 + endW, t: 12, b: 24 };
    const iw = Math.max(40, W - m.l - m.r), ih = H - m.t - m.b;
    const ser = (o.series || []).map((s, i) => Object.assign({ color: PAL[i] }, s, { pts: (s.pts || []).filter(p => ok(p[0]) && ok(p[1])) }));
    const bands = (o.bands || []).map(b => Object.assign({}, b));
    let xs = [], ys = [];
    for (const s of ser) for (const p of s.pts) { xs.push(p[0]); ys.push(p[1]); }
    for (const b of bands) for (let i = 0; i < b.lo.length; i++) { xs.push(b.lo[i][0]); ys.push(b.lo[i][1], b.hi[i][1]); }
    for (const hl of o.hlines || []) ys.push(hl.y);
    if (!xs.length) return `<div class="empty">No data for this view.</div>`;
    let x0 = o.x0 != null ? o.x0 : Math.min(...xs), x1 = o.x1 != null ? o.x1 : Math.max(...xs);
    if (x1 === x0) x1 = x0 + 1;
    let ylo = o.y0 != null ? o.y0 : Math.min(...ys), yhi = o.y1 != null ? o.y1 : Math.max(...ys);
    if (o.zero !== false && ylo > 0 && ylo < (yhi - ylo) * 0.35) ylo = 0;
    const yt = yTicks(ylo, yhi, Math.max(3, Math.floor(ih / 42)));
    const Y0 = o.y0 != null ? o.y0 : yt.lo, Y1 = o.y1 != null ? o.y1 : yt.hi;
    const sx = x => m.l + (x - x0) / (x1 - x0) * iw, sy = y => m.t + ih - (y - Y0) / (Y1 - Y0) * ih;
    const yF = o.yFmt || (v => num(v, Math.abs(Y1 - Y0) < 5 ? 1 : 0));
    let g = '';
    for (const t of yt.ticks) if (t >= Y0 - 1e-9 && t <= Y1 + 1e-9) g += `<line class="gridl" x1="${m.l}" x2="${m.l + iw}" y1="${sy(t)}" y2="${sy(t)}"/><text x="${m.l - 6}" y="${sy(t) + 3.5}" text-anchor="end">${esc(yF(t))}</text>`;
    const xt = o.xTicks ? { ticks: o.xTicks, st: 1 } : xYearTicks(x0, x1, iw);
    const xF = o.xFmt || (x => yearLab(x, xt.st));
    for (const t of xt.ticks) if (t >= x0 - 1e-9 && t <= x1 + 1e-9) g += `<text x="${sx(t)}" y="${H - 6}" text-anchor="middle">${esc(xF(t))}</text>`;
    let sh = '';
    for (const [a, b] of o.shade || []) { const A = Math.max(a, x0), B = Math.min(b, x1); if (B > A) sh += `<rect class="rec" x="${sx(A)}" y="${m.t}" width="${Math.max(1, sx(B) - sx(A))}" height="${ih}"/>`; }
    if (o.projFrom != null && o.projFrom < x1) sh += `<rect x="${sx(Math.max(o.projFrom, x0))}" y="${m.t}" width="${sx(x1) - sx(Math.max(o.projFrom, x0))}" height="${ih}" style="fill:var(--accent-wash)"/><text x="${sx(Math.max(o.projFrom, x0)) + 4}" y="${m.t + 11}" class="lbl" style="font-size:10.5px">${esc(o.projLabel || 'Projection')}</text>`;
    if (Y0 < 0 && Y1 > 0) g += `<line class="zero" x1="${m.l}" x2="${m.l + iw}" y1="${sy(0)}" y2="${sy(0)}"/>`;
    for (const hl of o.hlines || []) g += `<line x1="${m.l}" x2="${m.l + iw}" y1="${sy(hl.y)}" y2="${sy(hl.y)}" style="stroke:${hl.color || 'var(--ink-2)'};stroke-dasharray:4 4;stroke-width:1.2"/>${hl.label ? `<text x="${m.l + iw - 4}" y="${sy(hl.y) - 5}" text-anchor="end" class="lbl" style="font-size:10.5px">${esc(hl.label)}</text>` : ''}`;
    let bd = '';
    for (const b of bands) {
      const up = b.hi.map(p => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`), dn = b.lo.slice().reverse().map(p => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`);
      bd += `<polygon points="${up.concat(dn).join(' ')}" style="fill:${b.color || 'var(--s1)'};opacity:${b.op || 0.18}"/>`;
    }
    let ls = '';
    for (const s of ser) {
      if (!s.pts.length) continue;
      const pts = s.pts.map(p => [sx(p[0]), sy(p[1])]);
      const segs = []; let cur = [];
      s.pts.forEach((p, i) => { if (i && s.gap && p[0] - s.pts[i - 1][0] > s.gap) { segs.push(cur); cur = []; } cur.push(pts[i]); });
      segs.push(cur);
      const path = segs.filter(sg => sg.length).map(sg => 'M' + sg.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L')).join('');
      if (s.area) { const base = sy(Math.max(Y0, Math.min(0, Y1))); ls += `<path d="M${pts[0][0].toFixed(1)} ${base}L${pts.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L')}L${pts[pts.length - 1][0].toFixed(1)} ${base}Z" style="fill:${s.color};opacity:.14"/>`; }
      if (s.projFrom != null) {
        const a = s.pts.filter(p => p[0] <= s.projFrom), b = s.pts.filter(p => p[0] >= s.projFrom);
        const mk = arr => arr.length ? 'M' + arr.map(p => sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1)).join('L') : '';
        ls += `<path d="${mk(a)}" style="fill:none;stroke:${s.color};stroke-width:${s.width || 2};stroke-linejoin:round"/>`;
        ls += `<path d="${mk(b)}" style="fill:none;stroke:${s.color};stroke-width:${s.width || 2};stroke-dasharray:5 4;stroke-linejoin:round"/>`;
      } else ls += `<path d="${path}" style="fill:none;stroke:${s.color};stroke-width:${s.width || 2};${s.dash ? 'stroke-dasharray:' + s.dash + ';' : ''}stroke-linejoin:round;stroke-linecap:round;${s.dim ? 'opacity:.55' : ''}"/>`;
      if (s.dots) for (const q of pts) ls += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3.2" class="dotring" style="fill:${s.color}"/>`;
    }
    let mk = '';
    for (const p of o.marks || []) { if (!ok(p.x) || !ok(p.y)) continue; mk += `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="${p.r || 4.5}" class="dotring" style="fill:${p.color || 'var(--ink)'}"/>`; if (p.label) mk += `<text x="${sx(p.x) + (p.dx || 7)}" y="${sy(p.y) + (p.dy || -7)}" class="lbl" text-anchor="${p.anchor || 'start'}">${esc(p.label)}</text>`; }
    for (const v of o.vlines || []) { if (v.x < x0 || v.x > x1) continue; mk += `<line x1="${sx(v.x)}" x2="${sx(v.x)}" y1="${m.t}" y2="${m.t + ih}" style="stroke:var(--ink-2);stroke-dasharray:2 3"/>${v.label ? `<text x="${sx(v.x) + 4}" y="${m.t + 22}" class="lbl" style="font-size:10.5px">${esc(v.label)}</text>` : ''}`; }
    let el = '';
    if (o.endLabels) {
      const labs = ser.filter(s => s.pts.length && s.name).map(s => ({ y: sy(s.pts[s.pts.length - 1][1]), s }));
      labs.sort((a, b) => a.y - b.y);
      for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 13) labs[i].y = labs[i - 1].y + 13;
      for (const l of labs) el += `<text x="${m.l + iw + 6}" y="${l.y + 3.5}" class="lbl">${esc(l.s.name.length > 16 ? l.s.name.slice(0, 15) + '…' : l.s.name)}</text>`;
    }
    const model = { m, iw, ih, x0, x1, Y0, Y1, ser, bands, tipX: o.tipX || (x => xF(x)), yF: o.tipFmt || yF };
    return { svg: `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${sh}${g}${bd}${ls}${mk}${el}<line class="xh" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" visibility="hidden"/><g class="hov"></g><rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}"/></svg>`, model };
  }
  function nearest(pts, x) { let lo = 0, hi = pts.length - 1; if (hi < 0) return null; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid][0] < x) lo = mid; else hi = mid; } return Math.abs(pts[lo][0] - x) <= Math.abs(pts[hi][0] - x) ? pts[lo] : pts[hi]; }
  function hoverLine(el, mdl, ev) {
    const svg = el.querySelector('svg'), r = svg.getBoundingClientRect(), W = +svg.getAttribute('width');
    const px = (ev.clientX - r.left) * W / r.width;
    const x = mdl.x0 + (px - mdl.m.l) / mdl.iw * (mdl.x1 - mdl.x0);
    const sx = v => mdl.m.l + (v - mdl.x0) / (mdl.x1 - mdl.x0) * mdl.iw, sy = v => mdl.m.t + mdl.ih - (v - mdl.Y0) / (mdl.Y1 - mdl.Y0) * mdl.ih;
    let best = null;
    for (const s of mdl.ser) { const p = nearest(s.pts, x); if (p && (!best || Math.abs(p[0] - x) < Math.abs(best[0] - x))) best = p; }
    if (!best) return;
    const tx = best[0], tol = (mdl.x1 - mdl.x0) / 400 + 1e-9;
    const rows = []; let dots = '';
    for (const s of mdl.ser) { if (s.noTip) continue; const p = nearest(s.pts, tx); if (!p || Math.abs(p[0] - tx) > Math.max(tol, s.tol || 0)) continue; rows.push(K.tipRow(s.color, s.name || '', esc(mdl.yF(p[1])))); dots += `<circle cx="${sx(p[0])}" cy="${sy(p[1])}" r="4" class="dotring" style="fill:${s.color}"/>`; }
    for (const b of mdl.bands) { if (!b.name) continue; const lo = nearest(b.lo, tx), hi = nearest(b.hi, tx); if (lo && Math.abs(lo[0] - tx) <= tol) rows.push(K.tipRow(null, b.name, esc(mdl.yF(lo[1]) + ' to ' + mdl.yF(hi[1])))); }
    const xh = svg.querySelector('.xh'); xh.setAttribute('x1', sx(tx)); xh.setAttribute('x2', sx(tx)); xh.setAttribute('visibility', 'visible');
    svg.querySelector('.hov').innerHTML = dots;
    K.tip.show(`<b>${esc(mdl.tipX(tx))}</b>${rows.join('')}`, ev);
  }

  /* ---------------- vertical bars ---------------- */
  function bars(opts) { const cid = K.uid('c'); return (opts.legendItems ? legendHTML(opts.legendItems) : '') + place(cid, 'bars', opts); }
  function drawBars(o, W) {
    const H = o.h || 220, m = { l: o.ml || 40, r: 10, t: 12, b: o.rotate ? 44 : 24 };
    const it = o.items.filter(d => ok(d.y)); if (!it.length) return `<div class="empty">No data.</div>`;
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    let lo = Math.min(0, ...it.map(d => d.lo != null ? d.lo : d.y)), hi = Math.max(0, ...it.map(d => d.hi != null ? d.hi : d.y));
    if (o.y0 != null) lo = o.y0; if (o.y1 != null) hi = o.y1;
    const yt = yTicks(lo, hi, Math.max(3, Math.floor(ih / 40))), Y0 = yt.lo, Y1 = yt.hi;
    const sy = y => m.t + ih - (y - Y0) / (Y1 - Y0) * ih, n = o.items.length, bw = iw / n, gap = Math.min(2, bw * 0.25);
    const yF = o.yFmt || (v => num(v, 0));
    let g = '';
    for (const t of yt.ticks) g += `<line class="gridl" x1="${m.l}" x2="${m.l + iw}" y1="${sy(t)}" y2="${sy(t)}"/><text x="${m.l - 6}" y="${sy(t) + 3.5}" text-anchor="end">${esc(yF(t))}</text>`;
    let b = '';
    const every = o.labelEvery || Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / (o.rotate ? 18 : 46)))));
    o.items.forEach((d, i) => {
      const x = m.l + i * bw + gap / 2, w = Math.max(1, bw - gap);
      if (ok(d.y)) {
        const y = sy(Math.max(d.y, 0)), h = Math.abs(sy(d.y) - sy(0));
        const rr = Math.min(3, w / 2);
        const col = d.color || o.color || 'var(--s1)';
        const path = d.y >= 0
          ? `M${x} ${y + h}V${y + rr}Q${x} ${y} ${x + rr} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V${y + h}Z`
          : `M${x} ${sy(0)}V${sy(d.y) - rr}Q${x} ${sy(d.y)} ${x + rr} ${sy(d.y)}H${x + w - rr}Q${x + w} ${sy(d.y)} ${x + w} ${sy(d.y) - rr}V${sy(0)}Z`;
        b += `<path d="${path}" style="fill:${col};${d.proj ? 'opacity:.45' : ''}"/>`;
        if (d.proj) b += `<path d="${path}" style="fill:none;stroke:${col};stroke-width:1;stroke-dasharray:3 2"/>`;
        if (d.lo != null && d.hi != null) b += `<line x1="${x + w / 2}" x2="${x + w / 2}" y1="${sy(d.lo)}" y2="${sy(d.hi)}" style="stroke:var(--ink-2);stroke-width:1.2"/>`;
        if (o.valueLabels) b += `<text x="${x + w / 2}" y="${d.y >= 0 ? y - 4 : sy(d.y) + 12}" text-anchor="middle" class="lbl" style="font-size:10.5px">${esc(yF(d.y))}</text>`;
      }
      if (i % every === 0 || i === n - 1 && o.lastLabel) {
        const lx = x + w / 2;
        b += o.rotate ? `<text transform="translate(${lx},${H - m.b + 12}) rotate(-40)" text-anchor="end">${esc(d.label)}</text>` : `<text x="${lx}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
      }
      b += `<rect class="hit" data-i="${i}" x="${m.l + i * bw}" y="${m.t}" width="${bw}" height="${ih}"/>`;
    });
    if (Y0 < 0) g += `<line class="zero" x1="${m.l}" x2="${m.l + iw}" y1="${sy(0)}" y2="${sy(0)}"/>`;
    for (const hl of o.hlines || []) g += `<line x1="${m.l}" x2="${m.l + iw}" y1="${sy(hl.y)}" y2="${sy(hl.y)}" style="stroke:${hl.color || 'var(--ink-2)'};stroke-dasharray:4 4"/>${hl.label ? `<text x="${m.l + iw - 4}" y="${sy(hl.y) - 5}" text-anchor="end" class="lbl" style="font-size:10.5px">${esc(hl.label)}</text>` : ''}`;
    return { svg: `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${g}${b}</svg>`, model: { items: o.items, tip: o.tip || (d => `<b>${esc(d.label)}</b>${K.tipRow(d.color || o.color || 'var(--s1)', o.name || 'Value', esc(yF(d.y)))}`) } };
  }

  /* ---------------- scatter ---------------- */
  function scatter(opts) { const cid = K.uid('c'); return (opts.legendItems ? legendHTML(opts.legendItems) : '') + place(cid, 'scatter', opts); }
  function drawScatter(o, W) {
    const H = o.h || 300, m = { l: 48, r: 14, t: o.yLab ? 24 : 12, b: 38 };
    const pts = o.pts.filter(p => ok(p.x) && ok(p.y)); if (!pts.length) return `<div class="empty">No data.</div>`;
    const iw = W - m.l - m.r, ih = H - m.t - m.b, tx = o.logX ? v => Math.log10(v) : v => v;
    const xs = pts.map(p => tx(p.x)), ys = pts.map(p => p.y);
    const xt = yTicks(o.x0 != null ? tx(o.x0) : Math.min(...xs), o.x1 != null ? tx(o.x1) : Math.max(...xs), Math.max(3, Math.floor(iw / 80)));
    const yt = yTicks(o.y0 != null ? o.y0 : Math.min(...ys), o.y1 != null ? o.y1 : Math.max(...ys), Math.max(3, Math.floor(ih / 44)));
    const X0 = xt.lo, X1 = xt.hi, Y0 = yt.lo, Y1 = yt.hi;
    const sx = v => m.l + (tx(v) - X0) / (X1 - X0) * iw, sy = v => m.t + ih - (v - Y0) / (Y1 - Y0) * ih;
    const xF = o.xFmt || (v => num(v, 0)), yF = o.yFmt || (v => num(v, 0));
    let g = '';
    for (const t of yt.ticks) g += `<line class="gridl" x1="${m.l}" x2="${m.l + iw}" y1="${sy(t)}" y2="${sy(t)}"/><text x="${m.l - 6}" y="${sy(t) + 3.5}" text-anchor="end">${esc(yF(t))}</text>`;
    for (const t of xt.ticks) { const xv = o.logX ? Math.pow(10, t) : t; g += `<line class="gridl" x1="${sx(xv)}" x2="${sx(xv)}" y1="${m.t}" y2="${m.t + ih}"/><text x="${sx(xv)}" y="${m.t + ih + 14}" text-anchor="middle">${esc(xF(xv))}</text>`; }
    if (Y0 < 0 && Y1 > 0) g += `<line class="zero" x1="${m.l}" x2="${m.l + iw}" y1="${sy(0)}" y2="${sy(0)}"/>`;
    if (!o.logX && X0 < 0 && X1 > 0) g += `<line class="zero" x1="${sx(0)}" x2="${sx(0)}" y1="${m.t}" y2="${m.t + ih}"/>`;
    g += `<text x="${m.l + iw}" y="${H - 4}" text-anchor="end" class="ttl">${esc(o.xLab || '')}</text><text x="${m.l - 40}" y="${m.t - 10}" class="ttl">${esc(o.yLab || '')}</text>`;
    let fit = '';
    if (o.fit) { const a = X0, b = X1, f = v => o.fit.b0 + o.fit.b1 * v; const xa = o.logX ? Math.pow(10, a) : a, xb = o.logX ? Math.pow(10, b) : b; fit = `<line x1="${sx(xa)}" x2="${sx(xb)}" y1="${sy(K.clamp(f(a), Y0, Y1))}" y2="${sy(K.clamp(f(b), Y0, Y1))}" style="stroke:var(--ink-2);stroke-width:1.5;stroke-dasharray:6 4"/>`; }
    let d = '', lab = '';
    const sorted = pts.slice().sort((a, b) => (b.r || 4) - (a.r || 4));
    for (const p of sorted) d += `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="${p.r || 4.5}" class="dotring" style="fill:${p.color || 'var(--s1)'};${p.dim ? 'opacity:.35' : ''}"/>`;
    const placed = [];
    for (const p of pts.filter(q => q.lab).sort((a, b) => (b.r || 4) - (a.r || 4))) {
      const x = sx(p.x) + (p.r || 4.5) + 3, y = sy(p.y) + 3.5, w = p.lab.length * 6.6 + 2;
      if (placed.some(b => x < b.x + b.w && x + w > b.x && Math.abs(y - b.y) < 12) || x + w > m.l + iw + 10) continue;
      placed.push({ x, y, w }); lab += `<text x="${x}" y="${y}" class="lbl">${esc(p.lab)}</text>`;
    }
    const model = { pts: pts.map(p => Object.assign({ px: sx(p.x), py: sy(p.y) }, p)), tip: o.tip, xF, yF, xLab: o.xLab, yLab: o.yLab };
    return { svg: `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${g}${fit}${d}${lab}<g class="hov"></g><rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}"/></svg>`, model };
  }
  function hoverScatter(el, mdl, ev, click) {
    const svg = el.querySelector('svg'), r = svg.getBoundingClientRect(), W = +svg.getAttribute('width');
    const px = (ev.clientX - r.left) * W / r.width, py = (ev.clientY - r.top) * W / r.width;
    let best = null, bd = 26 * 26;
    for (const p of mdl.pts) { const d = (p.px - px) ** 2 + (p.py - py) ** 2; if (d < bd) { bd = d; best = p; } }
    const hov = svg.querySelector('.hov');
    if (!best) { hov.innerHTML = ''; K.tip.hide(); svg.style.cursor = ''; return; }
    hov.innerHTML = `<circle cx="${best.px}" cy="${best.py}" r="${(best.r || 4.5) + 3}" style="fill:none;stroke:var(--ink);stroke-width:1.5"/>`;
    svg.style.cursor = best.id ? 'pointer' : '';
    if (click && best.id) { K.tip.hide(); document.dispatchEvent(new CustomEvent('atlas:country', { detail: best.id })); return; }
    K.tip.show(mdl.tip ? mdl.tip(best) : `<b>${esc(best.name || '')}</b>${K.tipRow(null, mdl.xLab || 'x', esc(mdl.xF(best.x)))}${K.tipRow(null, mdl.yLab || 'y', esc(mdl.yF(best.y)))}`, ev);
  }

  /* ---------------- choropleth map ---------------- */
  function map(opts) { const cid = K.uid('c'); return place(cid, 'map', Object.assign({ h: 10 }, opts)); }
  function drawMap(o, W) {
    const H = Math.round(W * MAP.h / MAP.w);
    let p = `<path class="sea" d="${MAP.outline}"/>`;
    for (const iso in MAP.p) {
      const v = o.vals[iso];
      p += ok(v) ? `<path class="c${o.hl === iso ? ' on' : ''}" data-iso="${iso}" d="${MAP.p[iso]}" style="fill:${o.color(v, iso)}"/>` : `<path class="c nd" data-iso="${iso}" d="${MAP.p[iso]}"/>`;
    }
    return { svg: `<svg viewBox="0 0 ${MAP.w} ${MAP.h}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet">${p}</svg>`, model: o };
  }

  /* ---------------- small inline pieces (fixed size, no mount) ---------------- */
  function spark(vals, o = {}) {
    const v = vals.map((x, i) => [i, x]).filter(p => ok(p[1])); if (v.length < 2) return '';
    const w = o.w || 120, h = o.h || 28, lo = Math.min(...v.map(p => p[1])), hi = Math.max(...v.map(p => p[1])), n = vals.length - 1 || 1;
    const sx = i => 1 + i / n * (w - 2), sy = y => h - 2 - (hi === lo ? 0.5 : (y - lo) / (hi - lo)) * (h - 4);
    const d = 'M' + v.map(p => sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1)).join('L');
    const last = v[v.length - 1];
    const z = o.zero && lo < 0 && hi > 0 ? `<line x1="0" x2="${w}" y1="${sy(0)}" y2="${sy(0)}" style="stroke:var(--axis);stroke-width:1"/>` : '';
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${z}<path d="${d}" style="fill:none;stroke:${o.color || 'var(--s1)'};stroke-width:1.6;stroke-linejoin:round"/><circle cx="${sx(last[0])}" cy="${sy(last[1])}" r="2.4" style="fill:${o.color || 'var(--s1)'}"/></svg>`;
  }
  function gauge(p, o = {}) { // p in 0..1
    const a0 = Math.PI, a = Math.PI * (1 - K.clamp(p, 0, 1)), R = 60, cx = 75, cy = 72;
    const arc = (from, to, col, w) => { const x1 = cx + R * Math.cos(from), y1 = cy - R * Math.sin(from), x2 = cx + R * Math.cos(to), y2 = cy - R * Math.sin(to); return `<path d="M${x1} ${y1}A${R} ${R} 0 0 1 ${x2} ${y2}" style="fill:none;stroke:${col};stroke-width:${w};stroke-linecap:round"/>`; };
    const col = p >= 0.5 ? 'var(--crit)' : p >= 0.3 ? 'var(--serious)' : p >= 0.15 ? 'var(--warn)' : 'var(--good)';
    return `<svg viewBox="0 0 150 94" aria-hidden="true">${arc(a0, 0.0001, 'var(--line)', 12)}${p > 0.005 ? arc(a0, a, col, 12) : ''}<text x="${cx}" y="${cy - 2}" text-anchor="middle" style="font:600 20px var(--f-mono);fill:var(--ink)">${Math.round(p * 100)}%</text><text x="${cx - R}" y="92" text-anchor="middle" style="font:10px var(--f-sans);fill:var(--muted)">0%</text><text x="${cx + R}" y="92" text-anchor="middle" style="font:10px var(--f-sans);fill:var(--muted)">100%</text></svg>`;
  }
  function hbars(items, o = {}) { // HTML bars, supports negatives
    const vals = items.map(d => d.v).filter(ok); if (!vals.length) return '<div class="empty">No data.</div>';
    const lo = Math.min(0, o.lo != null ? o.lo : Math.min(...vals)), hi = Math.max(0, o.hi != null ? o.hi : Math.max(...vals)), span = hi - lo || 1;
    const z = (0 - lo) / span * 100, f = o.fmt || (v => num(v, 1));
    return `<div class="hbars">${items.map(d => {
      if (!ok(d.v)) return `<div class="hbar"><span class="nm">${esc(d.name)}</span><span class="trk"></span><span class="v na">–</span></div>`;
      const l = d.v >= 0 ? z : (d.v - lo) / span * 100, w = Math.abs(d.v) / span * 100;
      return `<div class="hbar${d.id ? ' click' : ''}"${d.id ? ` data-country="${esc(d.id)}" role="button" tabindex="0"` : ''} title="${esc(d.title || '')}"><span class="nm">${esc(d.name)}</span><span class="trk"><span class="z" style="left:${z}%"></span><b style="left:${l}%;width:${Math.max(w, 0.6)}%;background:${d.color || o.color || 'var(--s1)'}"></b></span><span class="v">${esc(f(d.v))}</span></div>`;
    }).join('')}</div>`;
  }
  function rampHTML(kind, lo, hi, fmt, label) {
    const stops = [0, .25, .5, .75, 1].map(t => kind === 'div' ? div(t * 2 - 1) : seq(t));
    return `<div class="scale">${label ? `<span>${esc(label)}</span>` : ''}<span>${esc(fmt(lo))}</span><span class="ramp" style="background:linear-gradient(90deg,${stops.join(',')})"></span><span>${esc(fmt(hi))}</span><span><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--grid);vertical-align:-1px;margin-right:4px"></i>No data</span></div>`;
  }

  /* ---------------- mount + events ---------------- */
  const DRAW = { line: drawLine, bars: drawBars, scatter: drawScatter, map: drawMap };
  function mount(root = document) {
    for (const el of root.querySelectorAll('.chart[data-cid]')) {
      const reg = REG.get(el.dataset.cid); if (!reg) continue;
      const W = Math.max(260, Math.floor(el.clientWidth || el.parentElement.clientWidth || 600));
      if (reg.w === W && el.firstChild) continue;
      const out = DRAW[reg.type](reg.opts, W);
      if (typeof out === 'string') { el.innerHTML = out; reg.model = null; }
      else { el.innerHTML = out.svg; reg.model = out.model; }
      el.style.minHeight = '';
      reg.w = W;
    }
  }
  function gc() { for (const [cid] of REG) if (!document.querySelector(`.chart[data-cid="${cid}"]`)) REG.delete(cid); }
  function onMove(ev) {
    const el = ev.target.closest && ev.target.closest('.chart[data-cid]');
    if (!el) return;
    const reg = REG.get(el.dataset.cid); if (!reg || !reg.model) return;
    if (reg.type === 'line' && ev.target.classList.contains('hit')) hoverLine(el, reg.model, ev);
    else if (reg.type === 'scatter' && ev.target.classList.contains('hit')) hoverScatter(el, reg.model, ev);
    else if (reg.type === 'bars' && ev.target.dataset.i != null) { const d = reg.model.items[+ev.target.dataset.i]; if (d && ok(d.y)) K.tip.show(reg.model.tip(d), ev); else K.tip.hide(); }
    else if (reg.type === 'map') {
      const iso = ev.target.dataset && ev.target.dataset.iso;
      if (iso) { const v = reg.model.vals[iso]; K.tip.show(reg.model.tip ? reg.model.tip(iso, v) : `<b>${esc(iso)}</b>`, ev); } else K.tip.hide();
    }
  }
  function onLeave(ev) {
    const el = ev.target.closest && ev.target.closest('.chart[data-cid]'); if (!el) return;
    if (ev.relatedTarget && el.contains(ev.relatedTarget)) return;
    K.tip.hide();
    const xh = el.querySelector('.xh'); if (xh) xh.setAttribute('visibility', 'hidden');
    const hv = el.querySelector('.hov'); if (hv) hv.innerHTML = '';
  }
  function onClick(ev) {
    const el = ev.target.closest && ev.target.closest('.chart[data-cid]'); if (!el) return;
    const reg = REG.get(el.dataset.cid); if (!reg || !reg.model) return;
    if (reg.type === 'map' && ev.target.dataset.iso && reg.model.vals[ev.target.dataset.iso] != null) document.dispatchEvent(new CustomEvent('atlas:country', { detail: ev.target.dataset.iso }));
    if (reg.type === 'scatter' && ev.target.classList.contains('hit')) hoverScatter(el, reg.model, ev, true);
    if (reg.type === 'line' || reg.type === 'bars') onMove(ev); // tap shows the tooltip on touch screens
  }
  function init() {
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerout', onLeave, { passive: true });
    document.addEventListener('click', onClick);
    addEventListener('resize', K.debounce(() => mount(), 150));
    addEventListener('scroll', () => K.tip.hide(), { passive: true });
  }
  return { PAL, seq, div, line, bars, scatter, map, spark, gauge, hbars, rampHTML, mount, gc, init, REG };
})();
