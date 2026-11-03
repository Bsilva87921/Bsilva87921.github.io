/* ==========================================================================
   Probable — charts (hand-built SVG, theme-aware)
   ========================================================================== */
(function () {
  'use strict';
  const APP = window.APP, { esc, pct, pct1, hexToRgb, lum } = APP;
  const C = APP.charts = {};
  const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const isDark = () => lum(hexToRgb(cssv('--surface') || '#ffffff')) < 0.2;
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b); t = Math.max(0, Math.min(1, t));
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  C.divColor = p => { const a = cssv('--away'), h = cssv('--home'), m = isDark() ? '#2A3040' : '#EEEDEA'; return p < 0.5 ? mix(a, m, p / 0.5) : mix(m, h, (p - 0.5) / 0.5); };
  C.seqColor = t => isDark() ? mix('#14233A', '#86b6ef', Math.pow(t, 0.8)) : mix('#EEF4FC', '#1c5cab', Math.pow(t, 0.8));
  C.ink = fill => APP.textOn(fill);
  const f1 = x => (Math.round(x * 10) / 10).toFixed(1);

  // sparkline of home WP over time; y centered at 50%
  C.spark = function (h, w, ht) {
    w = w || 88; ht = ht || 24;
    if (!h || h.length < 2) return '';
    const ts = h.map(q => q[0]), t0 = Math.min(...ts), t1 = Math.max(...ts);
    const X = t => 2 + (w - 6) * ((t - t0) / Math.max(1, t1 - t0)), Y = p => 2 + (ht - 4) * (1 - p);
    const pts = h.map(([t, p]) => [X(t), Y(p)]);
    const d = pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('');
    const last = pts[pts.length - 1], p = h[h.length - 1][1];
    return `<svg class="chart spark" width="${w}" height="${ht}" viewBox="0 0 ${w} ${ht}" aria-hidden="true"><line class="mid" x1="0" x2="${w}" y1="${Y(0.5)}" y2="${Y(0.5)}"/><path class="lk" d="${d}" style="stroke-width:1.5"/><circle class="dot ${p >= 0.5 ? 'bh' : 'ba'}" cx="${last[0]}" cy="${last[1]}" r="3"/></svg>`;
  };

  // WP line over x (time or play index)
  C.wpLine = function (pts, o) {
    o = o || {};
    const W = 640, H = 210, pl = 44, pr = 12, pt = 12, pb = 26;
    if (!pts || pts.length < 2) return '<div class="empty">Not enough history yet. The line fills in as the game updates.</div>';
    pts = pts.slice().sort((a, b) => a[0] - b[0]);
    const x0 = pts[0][0], x1 = pts[pts.length - 1][0];
    const X = x => pl + (W - pl - pr) * ((x - x0) / Math.max(1e-9, x1 - x0)), Y = p => pt + (H - pt - pb) * (1 - p);
    const d = pts.map((q, i) => (i ? 'L' : 'M') + X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1)).join('');
    const area = d + `L${X(x1).toFixed(1)} ${Y(0.5)}L${X(x0).toFixed(1)} ${Y(0.5)}Z`;
    const id = 'c' + Math.random().toString(36).slice(2, 8);
    const last = pts[pts.length - 1];
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(p => `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${Y(p)}" y2="${Y(p)}"/><text x="${pl - 6}" y="${Y(p) + 4}" text-anchor="end">${p === 0.5 ? '50%' : Math.round((p > 0.5 ? p : 1 - p) * 100) + '%'}</text>`).join('');
    const xl = o.xLabels ? o.xLabels.map(([x, t]) => `<text x="${X(x)}" y="${H - 6}" text-anchor="middle">${esc(t)}</text>`).join('') : '';
    return `<div class="chart-wrap" data-wp='${esc(JSON.stringify({ x0, x1, pl, pr, W, pts: pts.map(q => [q[0], +q[1].toFixed(4)]), hA: o.home, aA: o.away, lab: o.xFmt || '' }))}'>
      <svg class="chart ${o.big ? 'big' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Win probability over time')}">
        <defs><clipPath id="${id}t"><rect x="0" y="0" width="${W}" height="${Y(0.5)}"/></clipPath><clipPath id="${id}b"><rect x="0" y="${Y(0.5)}" width="${W}" height="${H}"/></clipPath></defs>
        ${ticks}
        <text x="${pl + 4}" y="${pt + 10}" class="lbl">${esc(o.home || 'HOME')} ↑</text>
        <text x="${pl + 4}" y="${H - pb - 4}" class="lbl">${esc(o.away || 'AWAY')} ↓</text>
        <path d="${area}" class="ah" clip-path="url(#${id}t)"/><path d="${area}" class="aa" clip-path="url(#${id}b)"/>
        <line class="mid" x1="${pl}" x2="${W - pr}" y1="${Y(0.5)}" y2="${Y(0.5)}"/>
        <path d="${d}" class="lk"/>
        <circle class="dot ${last[1] >= 0.5 ? 'bh' : 'ba'}" cx="${X(last[0])}" cy="${Y(last[1])}" r="4.5"/>
        ${xl}
        <line class="cursor" x1="0" x2="0" y1="${pt}" y2="${H - pb}" visibility="hidden"/>
      </svg></div>`;
  };

  // distribution of final margin (home − away)
  C.hist = function (dist, o) {
    o = o || {};
    let items = (dist || []).filter(([, p]) => p > 0.0015);
    if (!items.length) return '<div class="empty">No distribution</div>';
    let lo = Math.min(0, ...items.map(x => x[0])), hi = Math.max(0, ...items.map(x => x[0]));
    const span = hi - lo + 1, b = span > 70 ? 4 : span > 44 ? 3 : span > 30 ? 2 : 1;
    const bins = new Map();
    for (const [d, p] of dist) { if (d < lo || d > hi) continue; const k = d === 0 ? 0 : d > 0 ? Math.ceil(d / b) : -Math.ceil(-d / b); bins.set(k, (bins.get(k) || 0) + p); }
    const keys = [...bins.keys()].sort((a, c) => a - c);
    const W = 640, H = 200, pl = 36, pr = 8, pt = 16, pb = 34;
    const n = keys.length, slot = (W - pl - pr) / n, bw = Math.max(3, Math.min(24, slot - 2));
    const pmax = Math.max(...bins.values());
    const Y = p => pt + (H - pt - pb) * (1 - p / pmax);
    const lab = k => k === 0 ? 'Tie' : (b === 1 ? (k > 0 ? '+' : '−') + Math.abs(k) : (k > 0 ? '+' : '−') + ((Math.abs(k) - 1) * b + 1) + '–' + Math.abs(k) * b);
    let bars = '', xt = '';
    const every = Math.ceil(n / 9);
    keys.forEach((k, i) => {
      const p = bins.get(k), x = pl + i * slot + (slot - bw) / 2, y = Y(p), hgt = Math.max(1, H - pb - y);
      const cls = k > 0 ? 'bh' : k < 0 ? 'ba' : 'bd';
      const who = k > 0 ? (o.home || 'Home') + ' by ' + lab(k).replace('+', '') : k < 0 ? (o.away || 'Away') + ' by ' + lab(k).replace('−', '') : (o.tieLabel || 'Tied');
      const r = Math.min(4, bw / 2);
      bars += `<path class="${cls}" d="M${x.toFixed(1)} ${(H - pb).toFixed(1)}V${(y + r).toFixed(1)}Q${x.toFixed(1)} ${y.toFixed(1)} ${(x + r).toFixed(1)} ${y.toFixed(1)}H${(x + bw - r).toFixed(1)}Q${(x + bw).toFixed(1)} ${y.toFixed(1)} ${(x + bw).toFixed(1)} ${(y + r).toFixed(1)}V${(H - pb).toFixed(1)}Z" data-tip="${esc(who)}: <b>${pct1(p)}</b>"/>
        <rect x="${(pl + i * slot).toFixed(1)}" y="${pt}" width="${slot.toFixed(1)}" height="${H - pt - pb}" fill="transparent" data-tip="${esc(who)}: <b>${pct1(p)}</b>"/>`;
      if (i % every === 0 || k === 0) xt += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - pb + 14}" text-anchor="middle">${lab(k)}</text>`;
    });
    const yt = [0, 0.5, 1].map(f => `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${Y(pmax * f)}" y2="${Y(pmax * f)}"/><text x="${pl - 6}" y="${Y(pmax * f) + 4}" text-anchor="end">${Math.round(pmax * f * 100)}%</text>`).join('');
    const unit = o.unit || 'pts';
    return `<svg class="chart ${o.big ? 'big' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Distribution of final margin">${yt}${bars}<line class="ax" x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}"/>${xt}
      <text x="${pl}" y="${H - 4}" class="lbl">← ${esc(o.away || 'Away')} wins by (${unit})</text><text x="${W - pr}" y="${H - 4}" text-anchor="end" class="lbl">${esc(o.home || 'Home')} wins by →</text></svg>`;
  };

  // soccer / hockey final-score grid
  C.matrix = function (cells, o) {
    o = o || {};
    if (!cells || !cells.length) return '';
    const hs0 = Math.min(...cells.map(c => c[0])), as0 = Math.min(...cells.map(c => c[1]));
    const N = 6, grid = [];
    for (let i = 0; i < N; i++) { grid.push(new Array(N).fill(0)); }
    for (const [h, a, p] of cells) { const i = Math.min(N - 1, h - hs0), j = Math.min(N - 1, a - as0); grid[i][j] += p; }
    let pmax = 0, best = [0, 0]; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (grid[i][j] > pmax) { pmax = grid[i][j]; best = [i, j]; }
    const cs = 44, pl = 58, pt = 40, W = pl + N * cs + 8, H = pt + N * cs + 10;
    let out = '';
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const p = grid[i][j], fill = C.seqColor(p / pmax), x = pl + j * cs, y = pt + i * cs;
      const hg = hs0 + i + (i === N - 1 ? '+' : ''), ag = as0 + j + (j === N - 1 ? '+' : '');
      out += `<rect x="${x + 1}" y="${y + 1}" width="${cs - 2}" height="${cs - 2}" rx="4" fill="${fill}" data-tip="${esc(o.home || 'Home')} ${hg} – ${ag} ${esc(o.away || 'Away')}: <b>${pct1(p)}</b>"/>`;
      if (p >= 0.015) out += `<text x="${x + cs / 2}" y="${y + cs / 2 + 4}" text-anchor="middle" style="fill:${C.ink(fill)};font-size:11px;font-weight:600;pointer-events:none">${Math.round(p * 100)}%</text>`;
    }
    out += `<rect class="hl" x="${pl + best[1] * cs + 1}" y="${pt + best[0] * cs + 1}" width="${cs - 2}" height="${cs - 2}" rx="4"/>`;
    for (let j = 0; j < N; j++) out += `<text x="${pl + j * cs + cs / 2}" y="${pt - 8}" text-anchor="middle">${as0 + j}${j === N - 1 ? '+' : ''}</text>`;
    for (let i = 0; i < N; i++) out += `<text x="${pl - 8}" y="${pt + i * cs + cs / 2 + 4}" text-anchor="end">${hs0 + i}${i === N - 1 ? '+' : ''}</text>`;
    out += `<text x="${pl + N * cs / 2}" y="14" text-anchor="middle" class="lbl">${esc(o.away || 'Away')} goals →</text><text x="12" y="${pt + N * cs / 2}" class="lbl" transform="rotate(-90 12 ${pt + N * cs / 2})" text-anchor="middle">${esc(o.home || 'Home')} goals →</text>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" style="max-width:${W + 40}px" role="img" aria-label="Final score probabilities">${out}</svg>`;
  };

  // conditional surface: rows = lead (home − away), cols = game time
  C.surface = function (sf, o) {
    o = o || {};
    const nx = sf.xs.length, ny = sf.ys.length, cw = o.compact ? 40 : Math.max(26, Math.min(44, 600 / nx)), ch = o.compact ? 26 : 22;
    const pl = o.compact ? 108 : 78, pt = 10, pb = o.compact ? 54 : 40, W = pl + nx * cw + 8, H = pt + ny * ch + pb;
    let out = '';
    for (let yi = 0; yi < ny; yi++) for (let xi = 0; xi < nx; xi++) {
      const v = sf.v[yi] && sf.v[yi][xi]; const x = pl + xi * cw, y = pt + yi * ch;
      if (v == null) { out += `<rect x="${x + 1}" y="${y + 1}" width="${cw - 2}" height="${ch - 2}" rx="3" fill="var(--sunk)"/>`; continue; }
      const fill = C.divColor(v), lead = sf.ys[yi];
      const leadTxt = lead === 0 ? 'Tied' : (lead > 0 ? (o.home || 'Home') + ' +' + lead : (o.away || 'Away') + ' +' + (-lead));
      out += `<rect x="${x + 1}" y="${y + 1}" width="${cw - 2}" height="${ch - 2}" rx="3" fill="${fill}" data-tip="${esc(leadTxt)} · ${esc(sf.xl[xi])}<br>${esc(o.home || 'Home')} win: <b>${pct(v)}</b>"/>`;
      if (cw >= 34 && !o.compact) out += `<text x="${x + cw / 2}" y="${y + ch / 2 + 4}" text-anchor="middle" style="fill:${C.ink(fill)};font-size:10px;pointer-events:none">${Math.round(v * 100)}</text>`;
    }
    if (sf.mark) { const [mx, my] = sf.mark; out += `<rect class="hl" x="${pl + mx * cw}" y="${pt + my * ch}" width="${cw}" height="${ch}" rx="4" style="stroke-width:2"/>`; }
    sf.ys.forEach((l, yi) => { if (yi % (ny > 13 ? 2 : 1) === 0 || l === 0) out += `<text x="${pl - 8}" y="${pt + yi * ch + ch / 2 + 5}" text-anchor="end">${l === 0 ? 'Tied' : (l > 0 ? esc(o.home || 'Home') + ' +' + l : esc(o.away || 'Away') + ' +' + (-l))}</text>`; });
    const every = Math.ceil(nx / (o.compact ? 6 : 10));
    sf.xs.forEach((x, xi) => { if (xi % every === 0 || xi === nx - 1) out += `<text x="${pl + xi * cw + cw / 2}" y="${pt + ny * ch + 14}" text-anchor="middle">${esc(sf.xt[xi])}</text>`; });
    out += `<text x="${pl + nx * cw / 2}" y="${H - 6}" text-anchor="middle" class="lbl">${esc(sf.xTitle || '')}</text>`;
    return `<div style="overflow-x:auto"><svg class="chart ${o.compact ? 'big' : ''}" viewBox="0 0 ${W} ${H}" style="min-width:${o.compact ? 0 : Math.min(W, 520)}px;max-width:${W + 60}px" role="img" aria-label="Win probability by score margin and game time">${out}</svg></div>`;
  };

  // horizontal diverging bars for power ratings
  C.ratingBars = function (rows, o) {
    o = o || {};
    if (!rows.length) return '';
    const W = 640, rh = 20, pl = 56, pr = 52, pt = 8, H = pt + rows.length * rh + 18;
    const m = Math.max(0.1, ...rows.map(r => Math.abs(r.v)));
    const zx = pl + (W - pl - pr) / 2, sx = (W - pl - pr) / 2 / m;
    let out = `<line class="ax" x1="${zx}" x2="${zx}" y1="${pt - 4}" y2="${pt + rows.length * rh}"/>`;
    rows.forEach((r, i) => {
      const y = pt + i * rh + 4, w = Math.abs(r.v) * sx, x = r.v >= 0 ? zx : zx - w;
      const cls = r.sel ? '' : 'bk';
      out += `<rect x="${x.toFixed(1)}" y="${y}" width="${Math.max(1, w).toFixed(1)}" height="${rh - 8}" rx="3" class="${cls}" ${r.sel ? 'style="fill:var(--accent)"' : ''} data-tip="${esc(r.name)}: <b>${(r.v >= 0 ? '+' : '') + r.v.toFixed(2)}</b> ${esc(o.unit || '')}/game vs average"/>`;
      out += `<text x="${pl - 8}" y="${y + rh / 2}" text-anchor="end" class="${r.sel ? 'lbl-strong' : ''}">${esc(r.abbr)}</text>`;
      out += `<text x="${r.v >= 0 ? x + w + 5 : x - 5}" y="${y + rh / 2}" text-anchor="${r.v >= 0 ? 'start' : 'end'}" class="lbl">${(r.v >= 0 ? '+' : '−') + Math.abs(r.v).toFixed(o.dp == null ? 1 : o.dp)}</text>`;
    });
    out += `<text x="${zx}" y="${H - 2}" text-anchor="middle">average</text>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Power ratings">${out}</svg>`;
  };

  // simple one-series line (tennis sensitivity)
  C.line = function (pts, o) {
    o = o || {};
    const W = 560, H = 190, pl = 40, pr = 14, pt = 12, pb = 30;
    const x0 = pts[0][0], x1 = pts[pts.length - 1][0];
    const X = x => pl + (W - pl - pr) * ((x - x0) / (x1 - x0)), Y = p => pt + (H - pt - pb) * (1 - p);
    const d = pts.map((q, i) => (i ? 'L' : 'M') + X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1)).join('');
    let out = [0, 0.5, 1].map(p => `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${Y(p)}" y2="${Y(p)}"/><text x="${pl - 6}" y="${Y(p) + 4}" text-anchor="end">${p * 100}%</text>`).join('');
    for (let x = Math.ceil(x0 / 5) * 5; x <= x1; x += 5) out += `<text x="${X(x)}" y="${H - pb + 14}" text-anchor="middle">${x}%</text>`;
    out += `<path d="${d}" class="la"/>`;
    for (const q of pts) out += `<rect x="${X(q[0]) - 6}" y="${pt}" width="12" height="${H - pt - pb}" fill="transparent" data-tip="${esc(o.xName || 'x')} ${q[0]}% → <b>${pct1(q[1])}</b>"/>`;
    if (o.mark) out += `<circle class="dot ba" cx="${X(o.mark[0])}" cy="${Y(o.mark[1])}" r="5"/>`;
    out += `<text x="${(pl + W - pr) / 2}" y="${H - 4}" text-anchor="middle" class="lbl">${esc(o.xTitle || '')}</text>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Sensitivity')}">${out}</svg>`;
  };

  /* ---------- generic helpers for the stats center ---------- */
  function niceTicks(lo, hi, n) {
    if (!(hi > lo)) hi = lo + 1;
    const raw = (hi - lo) / Math.max(1, n || 5), mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    const step = (r >= 7.5 ? 10 : r >= 3.5 ? 5 : r >= 1.5 ? 2 : 1) * mag;
    const out = []; for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toPrecision(12));
    return out;
  }
  const fmtAuto = v => { const a = Math.abs(v); return a >= 1000 ? Math.round(v).toLocaleString() : a >= 100 ? v.toFixed(0) : a >= 10 ? (+v.toFixed(1)).toString() : a >= 1 ? (+v.toFixed(2)).toString() : (+v.toFixed(3)).toString(); };
  C.niceTicks = niceTicks; C.fmtAuto = fmtAuto;
  const attrOf = (o, p) => (o.attr && p.key != null ? ` ${o.attr}="${esc(p.key)}"` : '');

  // scatter: pts [{x, y, key, label, tip (trusted html), sel, emph}]
  C.scatter = function (pts, o) {
    o = o || {};
    pts = (pts || []).filter(p => isFinite(p.x) && isFinite(p.y));
    if (!pts.length) return '<div class="empty">Nothing to plot yet.</div>';
    const W = 640, H = o.h || 360, pl = 58, pr = 16, pt = 14, pb = 44;
    let x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
    if (o.refX != null) { x0 = Math.min(x0, o.refX); x1 = Math.max(x1, o.refX); }
    if (o.refY != null) { y0 = Math.min(y0, o.refY); y1 = Math.max(y1, o.refY); }
    if (o.diag) { const lo = Math.min(x0, y0), hi = Math.max(x1, y1); x0 = y0 = lo; x1 = y1 = hi; }
    const px = (x1 - x0) * 0.07 || Math.abs(x0) * 0.1 || 1, py = (y1 - y0) * 0.09 || Math.abs(y0) * 0.1 || 1;
    x0 -= px; x1 += px; y0 -= py; y1 += py;
    const X = v => pl + (W - pl - pr) * (v - x0) / (x1 - x0);
    const Y = v => o.invertY ? pt + (H - pt - pb) * (v - y0) / (y1 - y0) : pt + (H - pt - pb) * (1 - (v - y0) / (y1 - y0));
    const xf = o.xFmt || fmtAuto, yf = o.yFmt || fmtAuto;
    let out = '';
    for (const t of niceTicks(y0, y1, 5)) out += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/><text x="${pl - 6}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end">${esc(yf(t))}</text>`;
    for (const t of niceTicks(x0, x1, 6)) out += `<line class="gl" x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${pt}" y2="${H - pb}"/><text x="${X(t).toFixed(1)}" y="${H - pb + 15}" text-anchor="middle">${esc(xf(t))}</text>`;
    if (o.diag) { const a = Math.max(x0, y0), b = Math.min(x1, y1); out += `<line class="ref" x1="${X(a).toFixed(1)}" y1="${Y(a).toFixed(1)}" x2="${X(b).toFixed(1)}" y2="${Y(b).toFixed(1)}"/>`; if (o.diagLab) out += `<text class="lbl" x="${(X(b) - 6).toFixed(1)}" y="${(Y(b) + 16).toFixed(1)}" text-anchor="end">${esc(o.diagLab)}</text>`; }
    if (o.refX != null) out += `<line class="ref" x1="${X(o.refX).toFixed(1)}" x2="${X(o.refX).toFixed(1)}" y1="${pt}" y2="${H - pb}"/>`;
    if (o.refY != null) out += `<line class="ref" x1="${pl}" x2="${W - pr}" y1="${Y(o.refY).toFixed(1)}" y2="${Y(o.refY).toFixed(1)}"/>`;
    if (o.quad) {
      const q = o.quad;
      if (q.tl) out += `<text class="quad" x="${pl + 8}" y="${pt + 14}">${esc(q.tl)}</text>`;
      if (q.tr) out += `<text class="quad" x="${W - pr - 8}" y="${pt + 14}" text-anchor="end">${esc(q.tr)}</text>`;
      if (q.bl) out += `<text class="quad" x="${pl + 8}" y="${H - pb - 8}">${esc(q.bl)}</text>`;
      if (q.br) out += `<text class="quad" x="${W - pr - 8}" y="${H - pb - 8}" text-anchor="end">${esc(q.br)}</text>`;
    }
    const ord = pts.slice().sort((a, b) => (a.sel ? 1 : 0) - (b.sel ? 1 : 0));
    for (const p of ord) out += `<circle class="pt${p.sel ? ' sel' : ''}" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${p.sel ? 6.5 : 4.5}"/>`;
    const boxes = [];
    for (const p of pts) boxes.push([X(p.x) - 5, Y(p.y) - 5, 10, 10]);
    let labels = '';
    const lab = pts.filter(p => p.label && (p.sel || p.emph)).sort((a, b) => (b.sel ? 1 : 0) - (a.sel ? 1 : 0));
    for (const p of lab) {
      const cx = X(p.x), cy = Y(p.y), w = String(p.label).length * 6.3 + 2;
      let placed = false;
      for (const side of [1, -1]) {
        const bx = side > 0 ? cx + 8 : cx - 8 - w, by = cy - 9;
        if (bx < pl || bx + w > W - pr + 4) continue;
        if (boxes.slice(pts.length).some(b => bx < b[0] + b[2] && bx + w > b[0] && by < b[1] + b[3] && by + 13 > b[1])) continue;
        boxes.push([bx, by, w, 13]);
        labels += `<text class="${p.sel ? 'lbl-strong' : 'lbl'}" x="${(side > 0 ? cx + 8 : cx - 8).toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="${side > 0 ? 'start' : 'end'}">${esc(p.label)}</text>`;
        placed = true; break;
      }
      if (!placed && p.sel) labels += `<text class="lbl-strong" x="${cx.toFixed(1)}" y="${(cy - 10).toFixed(1)}" text-anchor="middle">${esc(p.label)}</text>`;
    }
    let hits = '';
    for (const p of pts) hits += `<circle class="hit" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="10" data-tip="${p.tip || esc(p.label || '')}"${attrOf(o, p)}/>`;
    const yMid = (pt + H - pb) / 2;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Scatter plot')}">${out}${labels}${hits}<text class="lbl" x="${(pl + W - pr) / 2}" y="${H - 6}" text-anchor="middle">${esc(o.xLab || '')}</text><text class="lbl" x="13" y="${yMid}" transform="rotate(-90 13 ${yMid})" text-anchor="middle">${esc(o.yLab || '')}</text></svg>`;
  };

  // multi-line: series [{key, label, pts:[[x,y]], sel, strong}]; unselected series recede to thin grey lines
  C.lines = function (series, o) {
    o = o || {};
    series = (series || []).map(s => Object.assign({}, s, { pts: (s.pts || []).filter(q => isFinite(q[0]) && isFinite(q[1])).sort((a, b) => a[0] - b[0]) })).filter(s => s.pts.length);
    if (!series.length) return '<div class="empty">No data yet.</div>';
    const all = series.flatMap(s => s.pts);
    const W = 640, H = o.h || 280, pl = 52, pr = o.endLab ? 76 : 14, pt = 12, pb = 30;
    let x0 = Math.min(...all.map(q => q[0])), x1 = Math.max(...all.map(q => q[0]));
    let y0 = o.y0 != null ? o.y0 : Math.min(...all.map(q => q[1])), y1 = o.y1 != null ? o.y1 : Math.max(...all.map(q => q[1]));
    if (o.ref != null) { y0 = Math.min(y0, o.ref); y1 = Math.max(y1, o.ref); }
    if (o.y0 == null || o.y1 == null) { const pad = (y1 - y0) * 0.06 || Math.abs(y1) * 0.1 || 1; if (o.y0 == null) y0 -= pad; if (o.y1 == null) y1 += pad; }
    if (x1 === x0) { x0 -= 1; x1 += 1; }
    const X = v => pl + (W - pl - pr) * (v - x0) / (x1 - x0), Y = v => pt + (H - pt - pb) * (1 - (v - y0) / (y1 - y0));
    const yf = o.yFmt || fmtAuto;
    let out = '';
    for (const t of niceTicks(y0, y1, 5)) out += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/><text x="${pl - 6}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end">${esc(yf(t))}</text>`;
    if (o.xTime) {
      const d0 = new Date(x0), d1 = new Date(x1), months = [];
      for (let d = new Date(d0.getFullYear(), d0.getMonth() + 1, 1); d <= d1; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(d);
      const every = Math.ceil(months.length / 8) || 1;
      months.forEach((d, i) => { if (i % every) return; const x = X(+d); out += `<text x="${x.toFixed(1)}" y="${H - pb + 16}" text-anchor="middle">${esc(d.toLocaleDateString([], { month: 'short' }))}</text>`; });
    } else {
      let ticks = niceTicks(x0, x1, 7); if (o.xInt) ticks = ticks.filter(t => Number.isInteger(t));
      const xf = o.xFmt || (v => String(v));
      for (const t of ticks) out += `<text x="${X(t).toFixed(1)}" y="${H - pb + 16}" text-anchor="middle">${esc(xf(t))}</text>`;
    }
    out += `<line class="ax" x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}"/>`;
    if (o.ref != null) out += `<line class="ref" x1="${pl}" x2="${W - pr}" y1="${Y(o.ref).toFixed(1)}" y2="${Y(o.ref).toFixed(1)}"/>${o.refLab ? `<text class="lbl" x="${W - pr - 4}" y="${(Y(o.ref) - 5).toFixed(1)}" text-anchor="end">${esc(o.refLab)}</text>` : ''}`;
    const path = s => s.pts.map((q, i) => (i ? 'L' : 'M') + X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1)).join('');
    const bg = series.filter(s => !s.sel && !s.strong), fg = series.filter(s => s.sel || s.strong).sort((a, b) => (a.sel ? 1 : 0) - (b.sel ? 1 : 0));
    for (const s of bg) out += `<path class="ln" d="${path(s)}"/>`;
    for (const s of fg) out += `<path class="ln ${s.sel ? 'sel' : 'alt'}" d="${path(s)}"/>`;
    if (o.dots) for (const s of fg.length ? fg : series) for (const q of s.pts) out += `<circle class="dot ${s.sel ? 'dsel' : 'dalt'}" cx="${X(q[0]).toFixed(1)}" cy="${Y(q[1]).toFixed(1)}" r="3.5"/>`;
    if (o.endLab) {
      const placed = [];
      for (const s of fg.slice().reverse()) {
        const q = s.pts[s.pts.length - 1]; let y = Y(q[1]) + 4;
        for (let k = 0; k < 6 && placed.some(p => Math.abs(p - y) < 12); k++) y += 12;
        placed.push(y);
        out += `<text class="${s.sel ? 'lbl-strong' : 'lbl'}" x="${(X(q[0]) + 6).toFixed(1)}" y="${y.toFixed(1)}">${esc(s.label || '')}</text>`;
      }
    }
    for (const s of series) out += `<path class="hitln" d="${path(s)}" data-tip="${s.tip || esc(s.label || '')}"${attrOf(o, s)}/>`;
    if (o.pointTips) for (const s of fg.length ? fg : series) for (const q of s.pts) out += `<circle class="hit" cx="${X(q[0]).toFixed(1)}" cy="${Y(q[1]).toFixed(1)}" r="8" data-tip="${esc(s.label || '')}${s.label ? ' · ' : ''}${esc(o.xTipFmt ? o.xTipFmt(q[0]) : String(q[0]))}: <b>${esc(yf(q[1]))}</b>"/>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Line chart')}">${out}</svg>`;
  };

  // vertical columns from a baseline: items [{lab, v, tip, sel, key, mark}]
  C.cols = function (items, o) {
    o = o || {};
    items = (items || []).filter(it => isFinite(it.v));
    if (!items.length) return '<div class="empty">No data yet.</div>';
    const n = items.length, W = 640, H = o.h || 210, pl = 50, pr = 10, pt = 14, pb = o.rot ? 50 : 28;
    const base = o.base || 0;
    let lo = Math.min(base, ...items.map(i => i.v)), hi = Math.max(base, ...items.map(i => i.v));
    if (o.lo != null) lo = Math.min(lo, o.lo); if (o.hi != null) hi = Math.max(hi, o.hi);
    const pad = (hi - lo) * 0.08 || 1; if (lo < base) lo -= pad; hi += pad;
    const Y = v => pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo)), yb = Y(base);
    const slot = (W - pl - pr) / n, bw = Math.max(2, Math.min(30, slot * 0.72));
    const yf = o.yFmt || fmtAuto;
    let out = '';
    for (const t of niceTicks(lo, hi, 4)) out += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/><text x="${pl - 6}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end">${esc(yf(t))}</text>`;
    const every = o.labEvery || Math.ceil(n / (o.rot ? 24 : 14));
    items.forEach((it, i) => {
      const x = pl + i * slot + (slot - bw) / 2, y = Y(it.v), up = it.v >= base, r = Math.min(3, bw / 2), h = Math.abs(y - yb);
      const cls = it.sel ? 'csel' : up ? 'cp' : 'cn';
      if (h < 0.5) out += `<rect class="${cls}" x="${x.toFixed(1)}" y="${(yb - 0.5).toFixed(1)}" width="${bw.toFixed(1)}" height="1"/>`;
      else if (up) out += `<path class="${cls}" d="M${x.toFixed(1)} ${yb.toFixed(1)}V${(y + r).toFixed(1)}Q${x.toFixed(1)} ${y.toFixed(1)} ${(x + r).toFixed(1)} ${y.toFixed(1)}H${(x + bw - r).toFixed(1)}Q${(x + bw).toFixed(1)} ${y.toFixed(1)} ${(x + bw).toFixed(1)} ${(y + r).toFixed(1)}V${yb.toFixed(1)}Z"/>`;
      else out += `<path class="${cls}" d="M${x.toFixed(1)} ${yb.toFixed(1)}V${(y - r).toFixed(1)}Q${x.toFixed(1)} ${y.toFixed(1)} ${(x + r).toFixed(1)} ${y.toFixed(1)}H${(x + bw - r).toFixed(1)}Q${(x + bw).toFixed(1)} ${y.toFixed(1)} ${(x + bw).toFixed(1)} ${(y - r).toFixed(1)}V${yb.toFixed(1)}Z"/>`;
      if (it.mark) out += `<circle class="mk" cx="${(x + bw / 2).toFixed(1)}" cy="${(Math.min(y, yb) - 7).toFixed(1)}" r="3"/>`;
      if (i % every === 0 || i === n - 1) {
        const lx = x + bw / 2, ly = H - pb + 14;
        out += o.rot ? `<text x="${lx.toFixed(1)}" y="${ly}" text-anchor="end" transform="rotate(-45 ${lx.toFixed(1)} ${ly})">${esc(it.lab)}</text>` : `<text x="${lx.toFixed(1)}" y="${ly}" text-anchor="middle">${esc(it.lab)}</text>`;
      }
      out += `<rect class="hitr" x="${(pl + i * slot).toFixed(1)}" y="${pt}" width="${slot.toFixed(1)}" height="${H - pt - pb}" data-tip="${it.tip || esc(it.lab + ': ' + yf(it.v))}"${attrOf(o, it)}/>`;
    });
    out += `<line class="ax" x1="${pl}" x2="${W - pr}" y1="${yb.toFixed(1)}" y2="${yb.toFixed(1)}"/>`;
    if (o.baseLab) out += `<text class="lbl" x="${W - pr}" y="${(yb - 5).toFixed(1)}" text-anchor="end">${esc(o.baseLab)}</text>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Column chart')}">${out}</svg>`;
  };

  // ranked dot plot (no zero baseline needed): rows [{lab, name, v, disp, sel, key}] in display order
  C.dots = function (rows, o) {
    o = o || {};
    rows = (rows || []).filter(r => isFinite(r.v));
    if (!rows.length) return '<div class="empty">No data for this stat.</div>';
    const W = 640, rh = 19, pl = 62, pr = 70, pt = 8, H = pt + rows.length * rh + 26;
    let lo = Math.min(...rows.map(r => r.v)), hi = Math.max(...rows.map(r => r.v));
    if (o.avg != null && isFinite(o.avg)) { lo = Math.min(lo, o.avg); hi = Math.max(hi, o.avg); }
    const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.05 || 1; lo -= pad; hi += pad;
    const X = v => pl + (W - pl - pr) * (v - lo) / (hi - lo), yb = pt + rows.length * rh;
    const xf = o.xFmt || fmtAuto;
    let out = '';
    for (const t of niceTicks(lo, hi, 5)) out += `<line class="gl" x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${pt}" y2="${yb}"/><text x="${X(t).toFixed(1)}" y="${yb + 15}" text-anchor="middle">${esc(xf(t))}</text>`;
    if (o.avg != null && isFinite(o.avg)) out += `<line class="ref" x1="${X(o.avg).toFixed(1)}" x2="${X(o.avg).toFixed(1)}" y1="${pt - 2}" y2="${yb}"/><text class="lbl" x="${(X(o.avg) + 4).toFixed(1)}" y="${H - 2}">${esc(o.avgLab || 'league avg')}</text>`;
    rows.forEach((r, i) => {
      const y = pt + i * rh + rh / 2;
      out += `<line class="rowl" x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}"/>`;
      out += `<text x="${pl - 8}" y="${y + 4}" text-anchor="end" class="${r.sel ? 'lbl-strong' : ''}">${esc(r.lab)}</text>`;
      out += `<circle class="pt${r.sel ? ' sel' : ''}" cx="${X(r.v).toFixed(1)}" cy="${y}" r="${r.sel ? 6 : 4.5}"/>`;
      out += `<text x="${W - pr + 8}" y="${y + 4}" class="${r.sel ? 'lbl-strong' : 'lbl'}">${esc(r.disp != null ? r.disp : xf(r.v))}</text>`;
      out += `<rect class="hitr" x="0" y="${y - rh / 2}" width="${W}" height="${rh}" data-tip="${esc(r.name || r.lab)}: <b>${esc(r.disp != null ? r.disp : xf(r.v))}</b>${o.tipSuffix ? ' ' + esc(o.tipSuffix(r)) : ''}"${attrOf(o, r)}/>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Ranking')}">${out}</svg>`;
  };

  // ranked horizontal bars: rows [{lab, name, v, disp, sel, key}] in display order.
  // o.center (default 0) is the baseline; o.flip makes "lower is better" read left→right as worse→better
  // (used by the "vs average" view, which drops the numeric axis and labels the average instead).
  C.hbars = function (rows, o) {
    o = o || {};
    rows = (rows || []).filter(r => isFinite(r.v));
    if (!rows.length) return '<div class="empty">No values to chart.</div>';
    const avgMode = o.mode === 'avg', c0 = isFinite(o.center) ? o.center : 0;
    const val = r => avgMode ? (o.flip ? c0 - r.v : r.v - c0) : r.v;
    const W = 640, rh = 21, pl = 88, pr = 70, pt = avgMode ? 20 : 8, pb = avgMode ? 8 : 26, H = pt + rows.length * rh + pb;
    let lo = Math.min(0, ...rows.map(val)), hi = Math.max(0, ...rows.map(val));
    if (avgMode) { const m = Math.max(Math.abs(lo), Math.abs(hi)) || 1; lo = -m; hi = m; }
    else { const pad = (hi - lo) * 0.02; if (lo < 0) lo -= pad; hi += pad; if (hi === lo) hi = lo + 1; }
    const X = v => pl + (W - pl - pr) * (v - lo) / (hi - lo), x0 = X(0);
    const xf = o.fmt || fmtAuto;
    let out = '';
    if (!avgMode) for (const t of niceTicks(lo, hi, 5)) out += `<line class="gl" x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${pt}" y2="${H - pb}"/><text x="${X(t).toFixed(1)}" y="${H - pb + 15}" text-anchor="middle">${esc(xf(t))}</text>`;
    else out += `<text class="lbl" x="${(x0 + 6).toFixed(1)}" y="12">better →</text><text class="lbl" x="${(x0 - 6).toFixed(1)}" y="12" text-anchor="end">← worse</text>`;
    rows.forEach((r, i) => {
      const y = pt + i * rh, bh = 13, by = y + (rh - bh) / 2, v = val(r), xe = X(v), rr = Math.min(4, Math.abs(xe - x0) / 2);
      const cls = 'hb' + (r.sel ? ' sel' : v < 0 ? ' neg' : '');
      if (Math.abs(xe - x0) < 0.8) out += `<rect class="${cls}" x="${(x0 - 0.5).toFixed(1)}" y="${by}" width="1" height="${bh}"/>`;
      else if (v >= 0) out += `<path class="${cls}" d="M${x0.toFixed(1)} ${by}H${(xe - rr).toFixed(1)}Q${xe.toFixed(1)} ${by} ${xe.toFixed(1)} ${(by + rr).toFixed(1)}V${(by + bh - rr).toFixed(1)}Q${xe.toFixed(1)} ${by + bh} ${(xe - rr).toFixed(1)} ${by + bh}H${x0.toFixed(1)}Z"/>`;
      else out += `<path class="${cls}" d="M${x0.toFixed(1)} ${by}H${(xe + rr).toFixed(1)}Q${xe.toFixed(1)} ${by} ${xe.toFixed(1)} ${(by + rr).toFixed(1)}V${(by + bh - rr).toFixed(1)}Q${xe.toFixed(1)} ${by + bh} ${(xe + rr).toFixed(1)} ${by + bh}H${x0.toFixed(1)}Z"/>`;
      out += `<text x="${pl - 8}" y="${by + bh - 2}" text-anchor="end" class="${r.sel ? 'lbl-strong' : 'lbl'}">${esc(r.lab)}</text>`;
      const lx = v >= 0 ? Math.max(xe, x0) + 5 : Math.min(xe, x0) - 5;
      out += `<text x="${lx.toFixed(1)}" y="${by + bh - 2}" text-anchor="${v >= 0 ? 'start' : 'end'}" class="${r.sel ? 'lbl-strong' : 'lbl'}">${esc(r.disp != null ? r.disp : xf(r.v))}</text>`;
      out += `<rect class="hitr" x="0" y="${y}" width="${W}" height="${rh}" data-tip="${esc(r.name || r.lab)}: <b>${esc(r.disp != null ? r.disp : xf(r.v))}</b>${avgMode ? ` · ${esc(o.diffFmt ? o.diffFmt(r.v - c0) : xf(r.v - c0))} vs avg` : ''}"${attrOf(o, r)}/>`;
    });
    out += `<line class="ax" x1="${x0.toFixed(1)}" x2="${x0.toFixed(1)}" y1="${pt - 2}" y2="${H - pb}"/>`;
    if (avgMode && o.avgLab) out += `<text class="lbl" x="${(x0).toFixed(1)}" y="${H - 1}" text-anchor="middle">${esc(o.avgLab)}</text>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H + (avgMode && o.avgLab ? 6 : 0)}" role="img" aria-label="${esc(o.aria || 'Ranked bars')}">${out}</svg>`;
  };

  // percentile profile: rows [{lab, p (0–1, higher = better), disp, sub}] — Savant-style bars on a 0–100 track
  C.pctl = function (rows, o) {
    o = o || {};
    rows = (rows || []).filter(r => isFinite(r.p));
    if (!rows.length) return '';
    const W = 640, rh = 26, pl = 150, pr = 92, pt = 20, H = pt + rows.length * rh + 6;
    const X = p => pl + (W - pl - pr) * p;
    let out = `<text class="lbl" x="${X(0)}" y="11">0</text><text class="lbl" x="${X(0.5)}" y="11" text-anchor="middle">50th</text><text class="lbl" x="${X(1)}" y="11" text-anchor="end">100</text>`;
    out += `<line class="ref" x1="${X(0.5)}" x2="${X(0.5)}" y1="${pt - 3}" y2="${H - 4}"/>`;
    rows.forEach((r, i) => {
      const y = pt + i * rh, bh = 12, by = y + (rh - bh) / 2, p = Math.max(0, Math.min(1, r.p));
      out += `<rect class="trk" x="${X(0)}" y="${by}" width="${(X(1) - X(0)).toFixed(1)}" height="${bh}" rx="6"/>`;
      out += `<rect x="${X(0)}" y="${by}" width="${Math.max(bh, X(p) - X(0)).toFixed(1)}" height="${bh}" rx="6" style="fill:${C.seqColor(0.18 + 0.82 * p)}"/>`;
      const cxp = Math.max(X(0) + 11, X(p) - 11).toFixed(1), fillc = C.seqColor(0.18 + 0.82 * p);
      out += `<circle class="pk" cx="${cxp}" cy="${by + bh / 2}" r="11" style="fill:${fillc}"/>`;
      out += `<text x="${cxp}" y="${by + bh / 2 + 3.3}" text-anchor="middle" style="fill:${APP.textOn(fillc)};font-size:${p >= 0.995 ? 8.5 : 9.5}px;font-weight:700;pointer-events:none">${Math.round(p * 100)}</text>`;
      out += `<text x="${pl - 10}" y="${by + bh - 2}" text-anchor="end" class="lbl">${esc(r.lab)}</text>`;
      out += `<text x="${W - pr + 10}" y="${by + bh - 2}" class="lbl-strong">${esc(r.disp)}</text>`;
      out += `<rect class="hitr" x="0" y="${y}" width="${W}" height="${rh}" data-tip="${esc(r.lab)}: <b>${esc(r.disp)}</b><br>${Math.round(p * 100)}th percentile${r.sub ? ' · ' + esc(r.sub) : ''}"/>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Percentile profile')}">${out}</svg>`;
  };

  // title timeline: one row per team, a filled dot for every title and a ring for every lost final
  // rows [{lab, name, years:[], lost:[], sel, key}], o {y0, y1, attr, aria, winLab, lostLab}
  C.timeline = function (rows, o) {
    o = o || {};
    rows = (rows || []).filter(r => (r.years || []).length || (r.lost || []).length);
    if (!rows.length) return '<div class="empty">No titles to chart.</div>';
    const all = rows.flatMap(r => (r.years || []).concat(r.lost || []));
    const y0 = o.y0 != null ? o.y0 : Math.min(...all), y1 = o.y1 != null ? o.y1 : Math.max(...all);
    const W = 640, rh = 22, pl = 112, pr = 34, pt = 6, pb = 24, H = pt + rows.length * rh + pb;
    const X = y => pl + (W - pl - pr) * (y - y0) / Math.max(1, y1 - y0);
    let out = '';
    const span = y1 - y0, step = span > 80 ? 20 : span > 40 ? 10 : span > 16 ? 5 : span > 8 ? 2 : 1;
    for (let t = Math.ceil(y0 / step) * step; t <= y1; t += step) out += `<line class="gl" x1="${X(t).toFixed(1)}" x2="${X(t).toFixed(1)}" y1="${pt}" y2="${H - pb}"/><text x="${X(t).toFixed(1)}" y="${H - pb + 15}" text-anchor="middle">${t}</text>`;
    rows.forEach((r, i) => {
      const cy = pt + i * rh + rh / 2;
      out += `<line class="trk-l" x1="${pl}" x2="${W - pr}" y1="${cy}" y2="${cy}"/>`;
      for (const y of r.lost || []) out += `<circle class="tl-lost" cx="${X(y).toFixed(1)}" cy="${cy}" r="3.6" data-tip="${esc(r.name || r.lab)} · ${esc(o.lostLab || 'lost final')} <b>${esc(o.yFmt ? o.yFmt(y) : String(y))}</b>"/>`;
      for (const y of r.years || []) out += `<circle class="tl-win${r.sel ? ' sel' : ''}" cx="${X(y).toFixed(1)}" cy="${cy}" r="4.4" data-tip="${esc(r.name || r.lab)} · ${esc(o.winLab || 'title')} <b>${esc(o.yFmt ? o.yFmt(y) : String(y))}</b>"/>`;
      out += `<text x="${pl - 8}" y="${cy + 4}" text-anchor="end" class="${r.sel ? 'lbl-strong' : 'lbl'}">${esc(r.lab)}</text><text x="${W - pr + 8}" y="${cy + 4}" class="lbl-strong">${(r.years || []).length}</text>`;
      out += `<rect class="hitr" x="0" y="${cy - rh / 2}" width="${pl}" height="${rh}" data-tip="${esc(r.name || r.lab)}: <b>${(r.years || []).length}</b> ${esc(o.winLab || 'titles')}${(r.lost || []).length ? ` · ${(r.lost || []).length} lost finals` : ''}"${attrOf(o, r)}/>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Title timeline')}">${out}</svg>`;
  };
  // 100% stacked horizontal bars: rows [{lab, name, parts:[n0, n1, ...], sel, key}], o.keys [{lab}] (series order = s0, s1, ...)
  C.stack = function (rows, o) {
    o = o || {};
    rows = (rows || []).filter(r => r.parts && r.parts.some(v => v > 0));
    if (!rows.length) return '<div class="empty">Nothing to chart.</div>';
    const W = 640, rh = 22, pl = 112, pr = 40, pt = 28, H = pt + rows.length * rh + 8, keys = o.keys || [];
    const X = p => pl + (W - pl - pr) * p;
    let out = '', lx = pl;
    keys.forEach((k, j) => { out += `<rect class="stk s${j}" x="${lx}" y="6" width="10" height="10" rx="2"/><text x="${lx + 14}" y="15" class="lbl">${esc(k.lab)}</text>`; lx += 24 + 6.4 * String(k.lab).length; });
    rows.forEach((r, i) => {
      const tot = r.parts.reduce((a, b) => a + (b || 0), 0), y = pt + i * rh + 4, bh = rh - 8;
      let acc = 0;
      r.parts.forEach((v, j) => {
        if (!(v > 0)) return;
        const x = X(acc / tot), w = X((acc + v) / tot) - x; acc += v;
        out += `<rect class="stk s${j}" x="${(x + 0.5).toFixed(1)}" y="${y}" width="${Math.max(0.5, w - 1).toFixed(1)}" height="${bh}" rx="2" data-tip="${esc(r.name || r.lab)} · ${esc((keys[j] || {}).lab || '')}: <b>${v}</b> (${Math.round(100 * v / tot)}%)"/>`;
        if (w > 26) out += `<text x="${(x + w / 2).toFixed(1)}" y="${y + bh / 2 + 4}" text-anchor="middle" class="stk-t">${Math.round(100 * v / tot)}%</text>`;
      });
      out += `<text x="${pl - 8}" y="${y + bh / 2 + 4}" text-anchor="end" class="${r.sel ? 'lbl-strong' : 'lbl'}">${esc(r.lab)}</text><text x="${W - pr + 6}" y="${y + bh / 2 + 4}" class="lbl">${esc(r.tot != null ? r.tot : tot)}</text>`;
      out += `<rect class="hitr" x="0" y="${y - 4}" width="${pl}" height="${rh}"${attrOf(o, r)}/>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Share chart')}">${out}</svg>`;
  };

  /* ---------- tooltip + crosshair ---------- */
  let tip;
  function place(e, html) {
    tip = tip || document.getElementById('tip');
    if (!tip) return;
    tip.innerHTML = html; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hide() { if (tip) tip.hidden = true; }
  document.addEventListener('mousemove', e => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t) { place(e, t.getAttribute('data-tip')); return; }
    const wp = e.target.closest && e.target.closest('[data-wp]');
    if (wp) {
      const cfg = JSON.parse(wp.getAttribute('data-wp')); const svg = wp.querySelector('svg'); const r = svg.getBoundingClientRect();
      const sx = (e.clientX - r.left) / r.width * cfg.W; const t01 = (sx - cfg.pl) / (cfg.W - cfg.pl - cfg.pr);
      if (t01 < 0 || t01 > 1) { hide(); return; }
      const xv = cfg.x0 + t01 * (cfg.x1 - cfg.x0);
      let best = cfg.pts[0]; for (const q of cfg.pts) if (Math.abs(q[0] - xv) < Math.abs(best[0] - xv)) best = q;
      const cur = svg.querySelector('.cursor'); const bx = cfg.pl + (cfg.W - cfg.pl - cfg.pr) * ((best[0] - cfg.x0) / Math.max(1e-9, cfg.x1 - cfg.x0));
      cur.setAttribute('x1', bx); cur.setAttribute('x2', bx); cur.setAttribute('visibility', 'visible');
      const when = cfg.lab === 'time' ? new Date(best[0]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : cfg.lab === 'play' ? 'Play ' + Math.round(best[0]) : '';
      place(e, `${when ? esc(when) + '<br>' : ''}${esc(cfg.hA || 'Home')} <b>${pct1(best[1])}</b> · ${esc(cfg.aA || 'Away')} <b>${pct1(1 - best[1])}</b>`);
      return;
    }
    hide();
    document.querySelectorAll('.chart .cursor[visibility="visible"]').forEach(c => c.setAttribute('visibility', 'hidden'));
  }, { passive: true });
  document.addEventListener('scroll', hide, { passive: true, capture: true });
})();
