/* =====================================================================
   Physics + Coding: Planet Launch, Formula Frenzy, Robot Coder, Code Tracer
   ===================================================================== */

/* ---------- Planet Launch ---------- */
const PLANETS = {
  earth: { name: 'Earth', g: 9.81, sky: ['#5fa9e3', '#d4ecfb'], ground: '#4c9a48', edge: '#357033' },
  moon: { name: 'the Moon', g: 1.62, sky: ['#03040a', '#1d2136'], ground: '#a3a5ad', edge: '#757884', stars: true },
  mars: { name: 'Mars', g: 3.71, sky: ['#c97b52', '#f1c9a8'], ground: '#b4532e', edge: '#843a1e' },
  jupiter: { name: 'Jupiter', g: 24.79, sky: ['#b5865b', '#efdab6'], ground: '#9c6b3c', edge: '#73502b', bands: true }
};
function launchTargets(d, r) {
  const seq = d <= 1 ? ['earth', 'earth', 'earth'] : d === 2 ? ['earth', 'earth', 'moon'] : d === 3 ? ['earth', 'moon', 'mars'] : r.shuffle(['earth', 'moon', 'mars', 'jupiter']).slice(0, 3);
  return seq.map(p => {
    const D = r.int(22, d <= 2 ? 55 : 80);
    const H = d >= 3 && r.chance(0.45) ? r.int(3, d >= 6 ? 14 : 9) : 0;
    const w = d <= 2 ? 3 : d <= 5 ? 2.5 : d <= 8 ? 2 : 1.5;
    let wall = null;
    if (d >= 4 && r.chance(0.45)) { const wx = Math.round(D * r.float(0.35, 0.6)); wall = { x: wx, h: Math.min(r.int(5, d >= 7 ? 16 : 11), Math.round(D * 0.6)) }; }
    const W = Math.max(D + 18, 45);
    const vmax = Math.ceil(Math.sqrt(2 * W * PLANETS[p].g));
    return { planet: p, D, H, w, wall, W, vmax };
  });
}
function collideShot(x1, y1, x2, y2, T) {
  const cross = (yA, yB, level) => (yA - level) / (yA - yB);
  if (y1 >= T.H && y2 < T.H) {
    const f = cross(y1, y2, T.H), xc = x1 + f * (x2 - x1);
    if (Math.abs(xc - T.D) <= T.w) return { type: 'hit', x: xc, y: T.H };
  }
  if (T.wall) {
    const L = T.wall.x - 0.6, R = T.wall.x + 0.6;
    if (x1 < L && x2 >= L) { const yc = y1 + (L - x1) / (x2 - x1) * (y2 - y1); if (yc < T.wall.h) return { type: 'wall', x: L, y: yc }; }
    if (y1 >= T.wall.h && y2 < T.wall.h) { const xc = x1 + cross(y1, y2, T.wall.h) * (x2 - x1); if (xc >= L && xc <= R) return { type: 'wall', x: xc, y: T.wall.h }; }
  }
  if (T.H > 0) {
    const L = T.D - T.w * 0.6;
    if (x1 < L && x2 >= L) { const yc = y1 + (L - x1) / (x2 - x1) * (y2 - y1); if (yc < T.H) return { type: 'column', x: L, y: yc }; }
  }
  if (y2 < 0) { const xc = x1 + cross(y1, y2, 0) * (x2 - x1); return { type: 'ground', x: xc, y: 0 }; }
  return null;
}
const STARFIELD = Array.from({ length: 60 }, (_, i) => [((i * 7919) % 1000) / 1000, ((i * 4111) % 1000) / 1000, (i % 3) + 1]);
IMPL.launch = {
  play(ctx) {
    const r = ctx.r, d = ctx.diff, targets = launchTargets(d, r), SHOTS = 12;
    let ti = 0, shotsUsed = 0, shotsThis = 0, hits = 0, score = 0, firstShotHit = false, ghosts = [], flight = null;
    let angle = 45, speed = Math.round(targets[0].vmax * 5) / 10;
    let cw = 600, chh = 336, dpr = 1, shakeT = 0, flash = 0, lastNow = 0, beam = 0;
    const parts = [];
    const wrap = h('div', { class: 'pl-wrap' });
    const cv = h('canvas', { role: 'img', 'aria-label': 'Launch field with a cannon on the left and a target pad' });
    const info = h('div', { class: 'pl-info' });
    wrap.append(cv, info);
    const angIn = h('input', { type: 'range', id: 'plAngle', min: '10', max: '80', step: '1' });
    const spdIn = h('input', { type: 'range', id: 'plSpeed', min: '1', step: '0.1' });
    const angVal = h('b'), spdVal = h('b');
    const nud = (fn, label, txt) => h('button', { class: 'nudge', type: 'button', 'aria-label': label, onclick: fn }, txt);
    const fireB = h('button', { class: 'btn primary big', type: 'button', onclick: fire }, 'Launch');
    const readout = h('p', { class: 'readout', 'aria-live': 'polite' }, 'Set your angle and speed, then launch.');
    const shotsEl = h('div', { class: 'shots', 'aria-hidden': 'true' });
    const notes = h('p', { class: 'pl-notes' });
    ctx.body.append(h('div', { class: 'stack' }, wrap, readout,
      h('div', { class: 'pl-ctrls' },
        h('div', { class: 'slider' }, h('label', { for: 'plAngle' }, 'Angle', angVal), h('div', { class: 'row' }, nud(() => setAngle(angle - 1), 'Lower the angle', '−'), angIn, nud(() => setAngle(angle + 1), 'Raise the angle', '+'))),
        h('div', { class: 'slider' }, h('label', { for: 'plSpeed' }, 'Speed', spdVal), h('div', { class: 'row' }, nud(() => setSpeed(speed - 0.1), 'Less speed', '−'), spdIn, nud(() => setSpeed(speed + 0.1), 'More speed', '+')))),
      h('div', { class: 'row center' }, fireB), shotsEl, notes));
    angIn.addEventListener('input', () => setAngle(+angIn.value));
    spdIn.addEventListener('input', () => setSpeed(+spdIn.value));

    const T = () => targets[ti];
    const P = () => PLANETS[T().planet];
    const x0 = -4;
    const scale = () => cw / (T().W - x0);
    const gy = () => chh * 0.84;
    const X = m => (m - x0) * scale();
    const Y = m => gy() - m * scale();
    function setAngle(v) { angle = clamp(Math.round(v), 10, 80); angIn.value = angle; angVal.textContent = angle + '°'; updNotes(); }
    function setSpeed(v) { speed = clamp(Math.round(v * 10) / 10, 1, T().vmax); spdIn.value = speed; spdVal.textContent = fmt(speed, 1) + ' m/s'; updNotes(); }
    function updNotes() {
      const t = T(), p = P();
      const R = speed * speed * Math.sin(2 * angle * Math.PI / 180) / p.g;
      notes.innerHTML = `On ${p.name}, gravity is <code>g = ${p.g} m/s²</code>. Flat-ground range: <code>R = v² × sin(2 × angle) / g</code>.` +
        (t.H ? ` The pad is raised ${t.H} m, so you need a bit more than the flat range.` : '') +
        (d <= 3 ? `<br>Your settings now: R = ${fmt(speed, 1)}² × sin(${2 * angle}°) / ${p.g} = <code>${fmt(R, 1)} m</code>` : '') +
        (p.name === 'Jupiter' ? '<br>Jupiter has no solid surface; this is a pretend deck at cloud-top gravity.' : '');
    }
    function updHud() {
      ctx.hud('score', 'Score', fmt(score));
      ctx.hud('target', 'Target', `${Math.min(ti + 1, 3)}/3`);
      ctx.hud('shots', 'Shots left', String(SHOTS - shotsUsed), SHOTS - shotsUsed <= 2 ? 'low' : '');
      shotsEl.innerHTML = '';
      for (let i = 0; i < SHOTS; i++) shotsEl.append(h('i', { class: i < shotsUsed ? 'used' : '' }));
    }
    function setupTarget() {
      const t = T(), p = P();
      ghosts = []; shotsThis = 0; beam = 0;
      spdIn.max = String(t.vmax);
      setSpeed(Math.round(t.vmax * 5) / 10); setAngle(45);
      info.innerHTML = `${p.name.replace(/^the /, 'The ')} · g = ${p.g} m/s²<br>Target ${t.D} m away${t.H ? `, ${t.H} m up` : ''}${t.wall ? `<br>Wall: ${t.wall.h} m tall at ${t.wall.x} m` : ''}`;
      readout.className = 'readout'; readout.textContent = `Target ${ti + 1} of 3 on ${p.name}.`;
      fireB.disabled = false; updHud();
    }
    function size() {
      const w = wrap.clientWidth || 600;
      dpr = Math.min(2, window.devicePixelRatio || 1); cw = w; chh = Math.round(w * 0.56);
      cv.width = Math.round(cw * dpr); cv.height = Math.round(chh * dpr); cv.style.height = chh + 'px';
    }
    function strokePath(c, path, color, width, dash) {
      if (path.length < 2) return;
      c.save(); c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; if (dash) c.setLineDash(dash);
      c.beginPath(); c.moveTo(X(path[0][0]), Y(path[0][1])); for (const q of path) c.lineTo(X(q[0]), Y(q[1])); c.stroke(); c.restore();
    }
    const ellipse = (c, x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); };
    function spawn(x, y, color, n, kind) {
      if (reduceMotion()) return;
      for (let i = 0; i < n; i++) { const a = -Math.PI * (kind === 'dust' ? Math.random() : Math.random() * 2), sp = (kind === 'dust' ? 60 : 90) + Math.random() * 180; parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 1.5 + Math.random() * (kind === 'dust' ? 4 : 2.5), c: color, life: 1, k: kind }); }
      parts.push({ x, y, r: 4, vr: 220, c: color, life: 1, k: 'ring' });
    }
    function draw(now) {
      const c = cv.getContext('2d'), t = T(), p = P(), s = scale(), G = gy(), tt = now / 1000;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (shakeT > 0) c.translate((Math.random() - 0.5) * shakeT * 14, (Math.random() - 0.5) * shakeT * 10);
      const grd = c.createLinearGradient(0, 0, 0, G); grd.addColorStop(0, p.sky[0]); grd.addColorStop(1, p.sky[1]);
      c.fillStyle = grd; c.fillRect(-20, -20, cw + 40, chh + 40);
      if (p.stars || t.planet === 'mars') { STARFIELD.forEach((st, i) => { c.globalAlpha = (p.stars ? 0.85 : 0.22) * (0.6 + 0.4 * Math.sin(tt * 1.6 + i)); c.fillStyle = '#fff'; c.fillRect(st[0] * cw, st[1] * G * 0.85, st[2] * 0.9, st[2] * 0.9); }); c.globalAlpha = 1; }
      if (t.planet === 'earth') {
        const sun = c.createRadialGradient(cw * 0.86, chh * 0.16, 2, cw * 0.86, chh * 0.16, 70); sun.addColorStop(0, 'rgba(255,250,220,1)'); sun.addColorStop(0.25, 'rgba(255,236,160,.85)'); sun.addColorStop(1, 'rgba(255,236,160,0)');
        c.fillStyle = sun; c.fillRect(cw * 0.86 - 70, chh * 0.16 - 70, 140, 140);
        for (let k = 0; k < 3; k++) { const cx = ((tt * (10 + k * 4) + k * 260) % (cw + 240)) - 120, cy = chh * (0.18 + k * 0.1); c.fillStyle = 'rgba(255,255,255,.82)'; ellipse(c, cx, cy, 46, 13); c.fill(); ellipse(c, cx - 18, cy - 9, 22, 14); c.fill(); ellipse(c, cx + 14, cy - 11, 26, 16); c.fill(); }
        c.fillStyle = 'rgba(52,120,64,.45)'; c.beginPath(); c.moveTo(0, G); for (let x = 0; x <= cw; x += 12) c.lineTo(x, G - 18 - Math.sin(x / 70) * 12 - Math.sin(x / 23) * 4); c.lineTo(cw, G); c.fill();
      } else if (t.planet === 'moon') {
        const ex = cw * 0.82, ey = chh * 0.2, er = Math.max(14, cw * 0.03);
        const eg = c.createRadialGradient(ex - er * 0.3, ey - er * 0.3, 1, ex, ey, er); eg.addColorStop(0, '#9be3ff'); eg.addColorStop(0.55, '#2f7bd8'); eg.addColorStop(1, '#173f7a');
        c.save(); c.shadowColor = 'rgba(120,190,255,.8)'; c.shadowBlur = 24; c.fillStyle = eg; ellipse(c, ex, ey, er, er); c.fill(); c.restore();
        c.fillStyle = 'rgba(70,170,90,.85)'; ellipse(c, ex - er * 0.2, ey + er * 0.1, er * 0.35, er * 0.22); c.fill();
      } else if (t.planet === 'mars') {
        c.fillStyle = 'rgba(255,240,220,.9)'; ellipse(c, cw * 0.8, chh * 0.18, 9, 9); c.fill();
        c.fillStyle = 'rgba(140,55,28,.5)'; c.beginPath(); c.moveTo(0, G); for (let x = 0; x <= cw; x += 10) c.lineTo(x, G - 10 - Math.abs(Math.sin(x / 90)) * 22); c.lineTo(cw, G); c.fill();
      } else {
        for (let i = 0; i < 6; i++) { const y = chh * (0.04 + i * 0.13), off = (tt * (i % 2 ? 9 : -7)) % 80; const bg = c.createLinearGradient(0, y, 0, y + chh * 0.07); bg.addColorStop(0, 'rgba(120,62,24,0)'); bg.addColorStop(0.5, `rgba(${110 + i * 8},${58 + i * 5},26,.22)`); bg.addColorStop(1, 'rgba(120,62,24,0)'); c.fillStyle = bg; c.fillRect(-80 + off, y, cw + 160, chh * 0.07); }
        c.fillStyle = 'rgba(190,80,50,.45)'; ellipse(c, cw * 0.72 + Math.sin(tt * 0.2) * 12, chh * 0.32, 34, 15); c.fill();
      }
      const gg = c.createLinearGradient(0, G, 0, chh); gg.addColorStop(0, p.ground); gg.addColorStop(1, p.edge);
      c.fillStyle = gg; c.fillRect(-20, G, cw + 40, chh - G + 20);
      c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-20, G, cw + 40, 2);
      if (t.planet === 'moon') { [[0.18, 0.5, 16], [0.42, 0.75, 10], [0.66, 0.45, 20], [0.88, 0.8, 9]].forEach(([fx, fy, rr]) => { c.fillStyle = 'rgba(80,82,92,.45)'; ellipse(c, cw * fx, G + (chh - G) * fy, rr, rr * 0.35); c.fill(); }); }
      const step = s * 10 < 36 ? 20 : 10;
      c.fillStyle = 'rgba(255,255,255,.92)'; c.font = '600 10px "JetBrains Mono", monospace'; c.textAlign = 'center';
      for (let m = 0; m <= t.W; m += step) { const x = X(m); c.fillRect(x - 0.5, G + 4, 1, 6); c.fillText(m + ' m', x, G + 22); }
      if (t.wall) {
        const wx = X(t.wall.x - 0.6), wy = Y(t.wall.h), ww = 1.2 * s, wh = t.wall.h * s;
        const wg = c.createLinearGradient(wx, 0, wx + ww, 0); wg.addColorStop(0, '#2b3044'); wg.addColorStop(0.5, '#5a6178'); wg.addColorStop(1, '#2b3044');
        c.fillStyle = wg; c.fillRect(wx, wy, ww, wh); c.fillStyle = '#9aa3bd'; c.fillRect(wx, wy, ww, 3);
      }
      const tc = cssVar('--d-physics') || '#22d3ee', pulse = (Math.sin(tt * 4) + 1) / 2;
      const px = X(t.D), py = Y(t.H);
      const bm = c.createLinearGradient(0, py, 0, 0); bm.addColorStop(0, hexA(tc, 0.32 + beam * 0.4)); bm.addColorStop(1, hexA(tc, 0));
      c.fillStyle = bm; c.fillRect(X(t.D - t.w), 0, 2 * t.w * s, py - 4);
      if (t.H > 0) { const cg = c.createLinearGradient(X(t.D - t.w * 0.6), 0, X(t.D + t.w * 0.6), 0); cg.addColorStop(0, '#1d2236'); cg.addColorStop(0.5, '#3d4460'); cg.addColorStop(1, '#1d2236'); c.fillStyle = cg; c.fillRect(X(t.D - t.w * 0.6), py, t.w * 1.2 * s, t.H * s); }
      c.strokeStyle = hexA(tc, 1 - pulse); c.lineWidth = 2; ellipse(c, px, py - 2, t.w * s + pulse * 14, 5 + pulse * 4); c.stroke();
      c.save(); c.shadowColor = tc; c.shadowBlur = 16 + beam * 20; c.fillStyle = tc; c.fillRect(X(t.D - t.w), py - 5, 2 * t.w * s, 6); c.restore();
      c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.moveTo(px, py - 5); c.lineTo(px, py - 36); c.stroke();
      const wave = Math.sin(tt * 6) * 3;
      c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(px, py - 36); c.quadraticCurveTo(px + 9, py - 34 + wave, px + 18, py - 30); c.lineTo(px, py - 24); c.fill();
      ghosts.forEach(gp => strokePath(c, gp, 'rgba(255,255,255,.4)', 1.5, [4, 5]));
      if (d <= 2 && !flight) {
        const th = angle * Math.PI / 180, vx = speed * Math.cos(th), vy = speed * Math.sin(th), Tf = 2 * vy / p.g, guide = [];
        for (let k = 0; k <= 24; k++) { const u = Tf * 0.35 * k / 24; guide.push([vx * u, vy * u - 0.5 * p.g * u * u]); }
        strokePath(c, guide, 'rgba(255,255,255,.9)', 2.5, [2, 7]);
      }
      if (flight) {
        c.save(); c.shadowColor = '#ffffff'; c.shadowBlur = 12; strokePath(c, flight.path, 'rgba(255,255,255,.95)', 2.5); c.restore();
        const n = flight.path.length;
        for (let k = Math.max(0, n - 14); k < n; k++) { const q = flight.path[k], f = (k - (n - 14)) / 14; c.fillStyle = `rgba(255,210,140,${0.08 + f * 0.35})`; ellipse(c, X(q[0]), Y(q[1]), 2 + f * 6, 2 + f * 6); c.fill(); }
        const bx = X(flight.px), by = Y(flight.py), ac = cssVar('--accent-2') || '#f472b6';
        if (by < 6) { c.fillStyle = ac; c.beginPath(); c.moveTo(bx, 4); c.lineTo(bx - 7, 16); c.lineTo(bx + 7, 16); c.fill(); c.fillStyle = '#fff'; c.fillText(fmt(flight.py, 0) + ' m', bx, 30); }
        else { const og = c.createRadialGradient(bx - 2, by - 2, 1, bx, by, 9); og.addColorStop(0, '#ffffff'); og.addColorStop(0.4, '#ffe08a'); og.addColorStop(1, ac); c.save(); c.shadowColor = ac; c.shadowBlur = 18; c.fillStyle = og; ellipse(c, bx, by, 7, 7); c.fill(); c.restore(); }
      }
      for (const q of parts) {
        c.globalAlpha = Math.max(0, q.life);
        if (q.k === 'ring') { c.strokeStyle = q.c; c.lineWidth = 3 * q.life; ellipse(c, q.x, q.y, q.r, q.r * 0.4); c.stroke(); }
        else { c.fillStyle = q.c; if (q.k === 'spark') { c.shadowColor = q.c; c.shadowBlur = 10; } ellipse(c, q.x, q.y, q.r, q.r); c.fill(); c.shadowBlur = 0; }
      }
      c.globalAlpha = 1;
      const lx = X(0), ly = G - 10;
      c.save(); c.translate(lx, ly); c.rotate(-angle * Math.PI / 180);
      const bg2 = c.createLinearGradient(0, -7, 0, 7); bg2.addColorStop(0, '#5b647f'); bg2.addColorStop(0.5, '#262c45'); bg2.addColorStop(1, '#151a2c');
      c.fillStyle = bg2; c.fillRect(0, -6, 34, 12); c.fillStyle = '#7c86a6'; c.fillRect(30, -7, 6, 14);
      if (flash > 0) { const fg = c.createRadialGradient(40, 0, 1, 40, 0, 26 * flash + 4); fg.addColorStop(0, 'rgba(255,255,255,1)'); fg.addColorStop(0.4, 'rgba(255,200,90,.9)'); fg.addColorStop(1, 'rgba(255,120,40,0)'); c.fillStyle = fg; ellipse(c, 40, 0, 28 * flash + 4, 16 * flash + 3); c.fill(); }
      c.restore();
      const hub = c.createRadialGradient(lx - 3, ly - 4, 1, lx, ly, 13); hub.addColorStop(0, '#8b94b3'); hub.addColorStop(1, '#1c2236');
      c.fillStyle = hub; ellipse(c, lx, ly, 12, 12); c.fill(); c.fillStyle = '#1c2236'; c.fillRect(lx - 15, ly + 2, 30, 8);
    }
    function hexA(col, a) { const [rr, g2, b2] = hexRgb(col); return `rgba(${Math.round(rr * 255)},${Math.round(g2 * 255)},${Math.round(b2 * 255)},${clamp(a, 0, 1).toFixed(3)})`; }
    function loop(now) {
      ctx.raf(loop);
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016; lastNow = now;
      shakeT = Math.max(0, shakeT - dt * 2.4); flash = Math.max(0, flash - dt * 5); beam = Math.max(0, beam - dt * 0.8);
      for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.life -= dt * (q.k === 'ring' ? 2.2 : 1.3); if (q.life <= 0) { parts.splice(i, 1); continue; } if (q.k === 'ring') q.r += q.vr * dt; else { q.vy += 380 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.98; } }
      if (flight) stepFlight(dt);
      draw(now);
    }
    function fire() {
      if (flight || ctx.done || shotsUsed >= SHOTS) return;
      shotsUsed++; shotsThis++; fireB.disabled = true; SFX.launch(); updHud(); flash = 1;
      const g = P().g, th = angle * Math.PI / 180, vx = speed * Math.cos(th), vy = speed * Math.sin(th);
      flight = { path: [[0, 0]], vx, vy, g, tt: 0, px: 0, py: 0, maxY: 0, k: Math.max(1, (2 * vy / g) / 2.2) };
      readout.className = 'readout'; readout.textContent = flight.k > 1.2 ? `In flight… (shown ${fmt(flight.k, 1)}× faster)` : 'In flight…';
    }
    function stepFlight(dt) {
      const f = flight, t = T();
      let adv = dt * f.k, outcome = null;
      while (adv > 0 && !outcome) {
        const sdt = Math.min(1 / 400, adv); adv -= sdt;
        const t2 = f.tt + sdt, x2 = f.vx * t2, y2 = f.vy * t2 - 0.5 * f.g * t2 * t2;
        outcome = collideShot(f.px, f.py, x2, y2, t);
        f.tt = t2; f.px = x2; f.py = y2; f.maxY = Math.max(f.maxY, f.py);
        if (outcome) { f.px = outcome.x; f.py = outcome.y; }
      }
      f.path.push([f.px, f.py]);
      if (outcome) landed(outcome);
    }
    function landed(o) {
      const f = flight; flight = null;
      ghosts.push(f.path.slice()); if (ghosts.length > 4) ghosts.shift();
      const t = T(), p = P(), ix = X(o.x), iy = Y(o.y);
      if (o.type === 'hit') {
        hits++;
        const pts = [500, 350, 250][shotsThis - 1] || 150;
        score += pts; if (shotsThis === 1) firstShotHit = true;
        SFX.good(); readout.className = 'readout good'; beam = 1; shakeT = 0.35;
        spawn(ix, iy, cssVar('--d-physics') || '#22d3ee', 34, 'spark'); spawn(ix, iy, '#ffffff', 12, 'spark');
        readout.textContent = `Hit${shotsThis === 1 ? ' on the first shot' : ''}! +${pts} · flight ${fmt(f.tt, 1)} s · peak ${fmt(f.maxY, 1)} m`;
        updHud();
        ctx.timeout(() => { ti++; if (ti >= targets.length) end(); else setupTarget(); }, 1700);
        return;
      }
      SFX.thud(); shakeT = 0.6;
      spawn(ix, iy, o.type === 'ground' ? p.ground : '#9aa3bd', 26, 'dust');
      readout.className = 'readout';
      if (o.type === 'wall') readout.textContent = `Blocked by the wall at ${fmt(o.y, 1)} m high. Aim higher.`;
      else if (o.type === 'column') readout.textContent = 'Hit the side of the platform. Aim higher or add speed.';
      else {
        const diff = o.x - t.D;
        readout.textContent = t.H && Math.abs(diff) <= t.w ? 'Landed under the platform. You need more height.' : `Landed at ${fmt(o.x, 1)} m: ${fmt(Math.abs(diff), 1)} m ${diff < 0 ? 'short' : 'long'}.`;
      }
      updHud();
      if (shotsUsed >= SHOTS) ctx.timeout(end, 1300);
      else fireB.disabled = false;
    }
    function end() {
      const stars = hits === 3 ? (shotsUsed <= 5 ? 3 : shotsUsed <= 8 ? 2 : 1) : 0;
      ctx.finish({
        score, stars, perf: hits / 3, badges: firstShotHit ? ['bullseye'] : [],
        summary: [['Targets hit', `${hits}/3`], ['Shots used', `${shotsUsed}/${SHOTS}`], ['Goal for 3★', '3 hits in 5 shots']],
        lesson: 'On flat ground, range = v² × sin(2 × angle) / g. Double the speed and the range quadruples. On the Moon, with 1/6 of Earth’s gravity, the same shot flies about 6 times farther.'
      });
    }
    ctx.onKey(e => {
      const big = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') { setAngle(angle - 1); return true; }
      if (e.key === 'ArrowRight') { setAngle(angle + 1); return true; }
      if (e.key === 'ArrowUp') { setSpeed(speed + 0.1 * big); return true; }
      if (e.key === 'ArrowDown') { setSpeed(speed - 0.1 * big); return true; }
      if (e.key === ' ' || e.key === 'Enter') { fire(); return true; }
      return false;
    });
    try { const ro = new ResizeObserver(() => size()); ro.observe(wrap); ctx.onCleanup(() => ro.disconnect()); }
    catch (e) { const f = () => size(); window.addEventListener('resize', f); ctx.onCleanup(() => window.removeEventListener('resize', f)); }
    size(); setupTarget(); ctx.raf(loop);
  }
};

/* ---------- Formula Frenzy ---------- */
const PHYS_CONCEPTS = [
  { q: 'In a vacuum, a hammer and a feather are dropped together. Which lands first?', c: ['They land together', 'The hammer', 'The feather', 'It depends on the planet'], e: 'With no air resistance, gravity accelerates everything equally. Apollo 15 astronauts showed this on the Moon in 1971.', t: 1 },
  { q: 'What is the SI unit of force?', c: ['Newton (N)', 'Joule (J)', 'Watt (W)', 'Pascal (Pa)'], e: '1 newton is the force that accelerates 1 kg at 1 m/s².', t: 1 },
  { q: 'What is the SI unit of energy?', c: ['Joule (J)', 'Newton (N)', 'Watt (W)', 'Volt (V)'], e: 'A joule is the work done by 1 newton over 1 meter. A watt is 1 joule per second.', t: 1 },
  { q: 'Which has more inertia?', c: ['A loaded truck', 'A bicycle', 'They have the same inertia', 'Whichever is moving faster'], e: 'Inertia depends on mass, not speed. More mass, more resistance to changes in motion.', t: 1 },
  { q: 'Newton’s third law says every action has…', c: ['An equal and opposite reaction', 'A bigger reaction', 'No reaction in space', 'A delayed reaction'], e: 'A rocket pushes exhaust backward; the exhaust pushes the rocket forward.', t: 1 },
  { q: 'What happens to your mass and weight on the Moon?', c: ['Mass stays the same; weight gets smaller', 'Both get smaller', 'Weight stays the same; mass gets smaller', 'Both stay the same'], e: 'Mass is the amount of matter. Weight is the pull of gravity on it, which is weaker on the Moon.', t: 1 },
  { q: 'Why do astronauts float inside the International Space Station?', c: ['They and the station are falling around Earth together', 'There is no gravity in space', 'The station blocks gravity', 'They are too far from Earth to feel gravity'], e: 'Gravity at the ISS is still about 90% as strong as on the ground. Everything is in free fall together, so nothing presses on anything.', t: 2 },
  { q: 'At what launch angle does a projectile travel farthest on flat ground, ignoring air?', c: ['45°', '30°', '60°', '90°'], e: 'Range depends on sin(2 × angle), which is largest when 2 × angle = 90°, so the angle is 45°.', t: 2 },
  { q: 'If you double an object’s speed, its kinetic energy…', c: ['Quadruples', 'Doubles', 'Stays the same', 'Halves'], e: 'KE = ½mv², so twice the speed gives 2² = 4 times the energy. That is why high-speed crashes are so much worse.', t: 2 },
  { q: 'Sound travels fastest through…', c: ['Steel', 'Water', 'Air', 'A vacuum'], e: 'Sound moves about 5,900 m/s in steel, about 1,480 m/s in water and 343 m/s in air. It can’t cross a vacuum.', t: 2 },
  { q: 'Heat flowing through a metal spoon from your hot soup is called…', c: ['Conduction', 'Convection', 'Radiation', 'Insulation'], e: 'Conduction passes heat by direct contact between particles.', t: 2 },
  { q: 'Light bending as it passes from air into water is called…', c: ['Refraction', 'Reflection', 'Diffraction', 'Absorption'], e: 'Light slows down in water, which bends its path. That’s why a straw looks broken in a glass.', t: 2 },
  { q: 'Which statement about energy is true?', c: ['It changes form but is never created or destroyed', 'Machines can create it from nothing', 'Friction destroys it', 'It can only be stored in batteries'], e: 'Conservation of energy: friction turns motion into heat, it doesn’t delete it.', t: 2 },
  { q: 'Two resistors are connected in series. The total resistance is…', c: ['The sum of both', 'Less than either one', 'Their average', 'Always zero'], e: 'In series, current must pass through both, so the resistances add: R = R₁ + R₂.', t: 3 },
  { q: 'Which color of visible light carries the most energy per photon?', c: ['Violet', 'Red', 'Green', 'Yellow'], e: 'Shorter wavelength means higher frequency and more energy per photon (E = hf).', t: 3 },
  { q: 'A car goes around a curve at a steady 50 km/h. Is it accelerating?', c: ['Yes, because its direction is changing', 'No, its speed is constant', 'Only if it brakes', 'Only if it speeds up'], e: 'Velocity includes direction. Changing direction is acceleration, called centripetal acceleration.', t: 3 },
  { q: 'A ball rolls off a table. Ignoring air, its horizontal speed while it falls…', c: ['Stays the same', 'Increases', 'Decreases', 'Drops to zero'], e: 'Gravity acts only downward, so the horizontal velocity doesn’t change.', t: 3 },
  { q: 'What does a transformer change?', c: ['The voltage of alternating current', 'Direct current into light', 'Mass into energy', 'Heat into electricity'], e: 'Transformers step voltage up for long-distance power lines and down for homes.', t: 3 }
];
function unitQ(kind, q, ans, unit, r, extras, dec = 0, explain = '') {
  const f = v => `${fmt(v, dec)} ${unit}`;
  return { kind, q, choices: [f(ans), ...nearNums(ans, r, extras, { dec }).map(f)], explain, key: q };
}
function physGen(d, r) {
  if (r.chance(0.3)) { const it = pickTiered(PHYS_CONCEPTS, d, r); return { kind: 'Concept', q: it.q, choices: it.c, explain: it.e, key: it.q, wide: true }; }
  const types = [['speed', 2], ['force', 2], ['density', 1.5], ['ohm', 2], ['weight', 1.5]];
  if (d >= 3) types.push(['ke', 2], ['pe', 2], ['momentum', 1.5], ['power', 1.5], ['work', 1]);
  if (d >= 5) types.push(['wave', 1.5], ['pressure', 1], ['accel', 1.5]);
  if (d >= 7) types.push(['fall', 1.5], ['kev', 1.5]);
  const t = r.weighted(types);
  if (t === 'speed') {
    const v = r.int(4, 18) * 5, tt = r.pick([1.5, 2, 2.5, 3, 4]), dist = v * tt;
    return unitQ('Speed', `A train travels <b>${fmt(dist, dist % 1 ? 1 : 0)} km</b> in <b>${tt} hours</b>. What is its average speed?`, v, 'km/h', r, [dist * tt, v + 5, v - 5], 0, `Speed = distance ÷ time = ${fmt(dist, dist % 1 ? 1 : 0)} ÷ ${tt} = <b>${v} km/h</b>.`);
  }
  if (t === 'force') {
    const m = r.int(2, 25), a = r.int(2, 10), F = m * a;
    return unitQ('Force', `What net force accelerates a <b>${m} kg</b> cart at <b>${a} m/s²</b>?`, F, 'N', r, [m + a, F * 2, Math.round(m / a)], 0, `F = m × a = ${m} × ${a} = <b>${F} N</b>.`);
  }
  if (t === 'density') {
    const rho = r.pick([0.5, 0.8, 1.2, 2, 2.5, 4, 8]), V = r.pick([10, 20, 25, 40, 50]), m = rho * V;
    return unitQ('Density', `A block has a mass of <b>${fmt(m)} g</b> and a volume of <b>${V} cm³</b>. What is its density?`, rho, 'g/cm³', r, [V / m, rho * 2, rho + 1], 1, `Density = mass ÷ volume = ${fmt(m)} ÷ ${V} = <b>${rho} g/cm³</b>. ${rho < 1 ? 'Less than water’s 1 g/cm³, so it floats.' : 'More than water’s 1 g/cm³, so it sinks.'}`);
  }
  if (t === 'ohm') {
    const I = r.pick([0.5, 1, 2, 3, 4, 5]), R = r.pick([2, 4, 5, 6, 10, 12, 20]), V = I * R;
    if (r.chance(0.5)) return unitQ('Circuits', `A current of <b>${I} A</b> flows through a <b>${R} Ω</b> resistor. What is the voltage across it?`, V, 'V', r, [I + R, R / I, V * 2], V % 1 ? 1 : 0, `Ohm’s law: V = I × R = ${I} × ${R} = <b>${fmt(V, V % 1 ? 1 : 0)} V</b>.`);
    return unitQ('Circuits', `A <b>${fmt(V, V % 1 ? 1 : 0)} V</b> battery is connected to a <b>${R} Ω</b> resistor. What current flows?`, I, 'A', r, [V * R, R / V, I * 2], 1, `Ohm’s law rearranged: I = V ÷ R = ${fmt(V, V % 1 ? 1 : 0)} ÷ ${R} = <b>${I} A</b>.`);
  }
  if (t === 'weight') {
    const p = r.pick([['the Moon', 1.6], ['Mars', 3.7], ['Earth', 9.8]]), m = r.pick([5, 10, 20, 30, 50, 60, 80]), W = round2(m * p[1]);
    return unitQ('Weight', `What does a <b>${m} kg</b> backpack weigh on ${p[0]} (g = ${p[1]} m/s²)?`, W, 'N', r, [m, m * 9.8, m / p[1]], W % 1 ? 1 : 0, `Weight = m × g = ${m} × ${p[1]} = <b>${fmt(W, W % 1 ? 1 : 0)} N</b>. Its mass is still ${m} kg everywhere.`);
  }
  if (t === 'ke') {
    const m = r.pick([2, 4, 6, 8, 10]), v = r.int(2, 10), KE = 0.5 * m * v * v;
    return unitQ('Energy', `What is the kinetic energy of a <b>${m} kg</b> ball moving at <b>${v} m/s</b>?`, KE, 'J', r, [m * v * v, 0.5 * m * v, m * v], 0, `KE = ½ × m × v² = ½ × ${m} × ${v}² = <b>${fmt(KE)} J</b>.`);
  }
  if (t === 'pe') {
    const m = r.int(2, 20), hh = r.int(2, 15), PE = m * 10 * hh;
    return unitQ('Energy', `How much gravitational potential energy does a <b>${m} kg</b> box gain when lifted <b>${hh} m</b>? (Use g = 10 m/s².)`, PE, 'J', r, [m * hh, PE / 2, m * 10 + hh], 0, `PE = m × g × h = ${m} × 10 × ${hh} = <b>${fmt(PE)} J</b>.`);
  }
  if (t === 'momentum') {
    const m = r.pick([2, 5, 10, 40, 60, 80]), v = r.int(2, 15), p = m * v;
    return unitQ('Momentum', `What is the momentum of a <b>${m} kg</b> object moving at <b>${v} m/s</b>?`, p, 'kg·m/s', r, [m + v, p / 2, p * 2], 0, `p = m × v = ${m} × ${v} = <b>${fmt(p)} kg·m/s</b>.`);
  }
  if (t === 'power') {
    const V = r.pick([12, 120, 230]), I = r.pick([0.5, 2, 3, 5, 10]), P = V * I;
    return unitQ('Power', `A device draws <b>${I} A</b> from a <b>${V} V</b> supply. How much power does it use?`, P, 'W', r, [V / I, V + I, P * 2], 0, `P = V × I = ${V} × ${I} = <b>${fmt(P)} W</b>.`);
  }
  if (t === 'work') {
    const F = r.int(2, 16) * 5, dd = r.int(2, 20), W = F * dd;
    return unitQ('Work', `You push a sled with a <b>${F} N</b> force for <b>${dd} m</b>. How much work do you do?`, W, 'J', r, [F + dd, W / 2, Math.round(F / dd)], 0, `Work = force × distance = ${F} × ${dd} = <b>${fmt(W)} J</b>.`);
  }
  if (t === 'wave') {
    const f = r.pick([2, 5, 10, 20, 50, 100]), lam = r.pick([0.5, 2, 3, 4, 10]), v = f * lam;
    return unitQ('Waves', `A wave has a frequency of <b>${f} Hz</b> and a wavelength of <b>${lam} m</b>. How fast does it travel?`, v, 'm/s', r, [f / lam, f + lam, v * 2], v % 1 ? 1 : 0, `Wave speed = frequency × wavelength = ${f} × ${lam} = <b>${fmt(v, v % 1 ? 1 : 0)} m/s</b>.`);
  }
  if (t === 'pressure') {
    const A = r.pick([0.5, 2, 4, 5, 10]), P = r.pick([20, 50, 100, 150, 200]), F = P * A;
    return unitQ('Pressure', `A force of <b>${fmt(F)} N</b> pushes on an area of <b>${A} m²</b>. What is the pressure?`, P, 'Pa', r, [F * A, P * 2, P / 2], 0, `Pressure = force ÷ area = ${fmt(F)} ÷ ${A} = <b>${P} Pa</b>.`);
  }
  if (t === 'accel') {
    const v = r.pick([10, 15, 20, 24, 30]), tt = r.pick([2, 3, 4, 5, 6]), a = round2(v / tt);
    return unitQ('Acceleration', `A car speeds up from 0 to <b>${v} m/s</b> in <b>${tt} s</b>. What is its average acceleration?`, a, 'm/s²', r, [v * tt, tt / v * 10, a * 2], a % 1 ? 1 : 0, `a = change in velocity ÷ time = ${v} ÷ ${tt} = <b>${fmt(a, a % 1 ? 1 : 0)} m/s²</b>.`);
  }
  if (t === 'fall') {
    const tt = r.int(1, 5), hh = 5 * tt * tt;
    return unitQ('Free fall', `A stone is dropped from <b>${hh} m</b>. How long until it hits the ground? (Use g = 10 m/s², no air.)`, tt, 's', r, [hh / 10, Math.round(Math.sqrt(hh)), tt * 2], 0, `h = ½ g t², so t = √(2h ÷ g) = √(${2 * hh} ÷ 10) = √${2 * hh / 10} = <b>${tt} s</b>.`);
  }
  const m = r.pick([2, 4, 8, 10]), v = r.int(2, 10), KE = 0.5 * m * v * v;
  return unitQ('Energy', `A <b>${m} kg</b> object has <b>${fmt(KE)} J</b> of kinetic energy. How fast is it moving?`, v, 'm/s', r, [Math.round(KE / m), Math.round(Math.sqrt(KE / m)), Math.round(2 * KE / m)], 0, `v = √(2 × KE ÷ m) = √(2 × ${fmt(KE)} ÷ ${m}) = √${2 * KE / m} = <b>${v} m/s</b>.`);
}
QGEN.physics = physGen;
IMPL.formula = {
  play(ctx) {
    runQuiz(ctx, { mode: 'classic', count: 10, perQ: 45, gen: physGen,
      lesson: 'Start every physics problem by writing the formula, then plug in numbers with their units. Units are a free check: N = kg × m/s², J = N × m.' });
  }
};

/* ---------- Robot Coder ---------- */
const RC_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const RC_CMD = { F: { sym: '↑', name: 'Forward' }, L: { sym: '↺', name: 'Turn left' }, R: { sym: '↻', name: 'Turn right' }, P: { sym: 'P1', name: 'Call P1' } };
const RC_LEVELS = [
  { name: 'First steps', map: ['S..G'], main: 6, p1: 0, best: 3, concept: 'A program is a list of instructions run in order. Move forward until you reach the gem.', take: 'Computers follow instructions exactly, one at a time, in order. That is called sequencing.' },
  { name: 'Turn the corner', map: ['S.#', '#.#', '#.G'], main: 8, p1: 0, best: 6, concept: 'Turning changes which way the robot faces. It doesn’t move the robot.', take: 'Every step counts, including turns. Programmers trace code in their heads to predict where things end up.' },
  { name: 'Gem collector', map: ['SG.G', '###.', '###G'], main: 8, p1: 0, best: 6, concept: 'Collect every gem. Plan the whole path before you press Run.', take: 'Planning the whole route first, then writing code, beats trial and error. That planning step is algorithm design.' },
  { name: 'Staircase', map: ['S.###', '#..##', '##..#', '###.G'], main: 14, p1: 0, best: 13, concept: 'This works, but it’s long and repetitive. Spot the pattern that repeats.', take: 'When you notice yourself repeating the same steps, that is a signal to use a function.' },
  { name: 'Functions!', map: ['S.###', '#..##', '##..#', '###.G'], main: 5, p1: 4, best: 8, concept: 'P1 is a function: a mini-program you can call by name. Put the repeating steps in P1, then call P1 from Main.', take: 'Functions let you write a pattern once and reuse it. Programmers call this DRY: Don’t Repeat Yourself.' },
  { name: 'Square dance', map: ['S..G', '.##.', '.##.', 'G..G'], main: 4, p1: 4, best: 7, concept: 'One function, called three times, can walk three sides of the square.', take: 'The same function can solve a problem in several places. Good functions are small and reusable.' },
  { name: 'Loop de loop', map: ['S.G..G...G..G'], main: 2, p1: 2, best: 3, concept: 'A function can call itself. If P1 is “forward, P1”, it repeats forever. The program stops when every gem is collected.', take: 'A function that calls itself is recursion. It’s one way to make a loop.' },
  { name: 'Spiral staircase', map: ['S.#####', '#G.####', '##..###', '###G.##', '####..#', '#####GG'], main: 2, p1: 5, best: 6, concept: 'Combine a pattern with recursion: one step of the stairs, then call P1 again.', take: 'Recursion handles problems of any length: the same short code climbs 3 stairs or 300.' },
  { name: 'U-turn', map: ['S.G..', '####.', 'G.G..'], main: 6, p1: 5, best: 8, concept: 'Use P1 for the long straight runs and Main for the turns between them.', take: 'Breaking a problem into parts (straight runs vs turns) is called decomposition.' },
  { name: 'The spiral', map: ['S....', '####.', '..G#.', '.###.', 'G...G'], main: 2, p1: 7, best: 7, concept: 'Bumping into a wall wastes a step but doesn’t stop the program. Use that to walk a whole spiral with one function.', take: 'Clever programs use the rules of their world. Here a bump acts like a built-in “stop at the wall”.' }
];
function rcParse(L) {
  const walls = new Set(), gems = [];
  let start = null;
  L.map.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') walls.add(x + ',' + y); if (ch === 'S') start = { x, y }; if (ch === 'G') gems.push({ x, y }); }));
  return { walls, gems, start, H: L.map.length, W: L.map[0].length };
}
// Runs a program to completion (no animation). Returns { won, steps } — used by the game and by tests.
function rcSimulate(L, prog, onStep) {
  const M = rcParse(L);
  let x = M.start.x, y = M.start.y, dir = 0, steps = 0, calls = 0;
  const left = new Set(M.gems.map(g => g.x + ',' + g.y));
  const stack = [{ list: 'main', i: 0 }];
  while (stack.length) {
    const fr = stack[stack.length - 1], cmds = prog[fr.list];
    if (fr.i >= cmds.length) { stack.pop(); continue; }
    const c = cmds[fr.i], at = { list: fr.list, idx: fr.i };
    fr.i++;
    if (c === 'P') {
      if (fr.i >= cmds.length) stack.pop();
      if (stack.length > 400) return { won: false, steps, why: 'depth' };
      if (++calls > 2000) return { won: false, steps, why: 'limit' };
      stack.push({ list: 'p1', i: 0 });
      if (onStep) onStep({ at, call: true });
      continue;
    }
    let bump = false;
    if (c === 'L') dir = (dir + 3) % 4;
    else if (c === 'R') dir = (dir + 1) % 4;
    else {
      const nx = x + RC_DIRS[dir][0], ny = y + RC_DIRS[dir][1];
      if (nx < 0 || ny < 0 || nx >= M.W || ny >= M.H || M.walls.has(nx + ',' + ny)) bump = true; else { x = nx; y = ny; }
    }
    const got = left.delete(x + ',' + y);
    steps++;
    if (onStep) onStep({ at, cmd: c, x, y, dir, bump, got, left: left.size });
    if (!left.size) return { won: true, steps };
    if (steps >= 400) return { won: false, steps, why: 'limit' };
  }
  return { won: false, steps, why: 'end', left: left.size };
}
IMPL.robot = {
  intro() {
    const grid = h('div', { class: 'lvl-grid' });
    RC_LEVELS.forEach((L, i) => {
      const n = i + 1, st = S.robot.stars[n] || 0, locked = n > S.robot.unlocked;
      grid.append(h('button', { type: 'button', disabled: locked, title: L.name, 'aria-label': `Level ${n}: ${L.name}${locked ? ' (locked)' : ''}`, onclick: () => openGame('robot', { level: n }) }, n, h('span', { class: 's', html: starsHTML(st) })));
    });
    const nextLvl = Math.min(S.robot.unlocked, RC_LEVELS.length);
    return h('div', null, h('h3', null, 'Levels'), grid,
      h('div', { class: 'sheet-actions' }, h('button', { class: 'btn ghost', type: 'button', onclick: closeModal }, 'Back'), h('button', { class: 'btn primary', type: 'button', onclick: () => openGame('robot', { level: nextLvl }) }, `Play level ${nextLvl}`)));
  },
  play(ctx) {
    const n = clamp(ctx.opts.level || Math.min(S.robot.unlocked, RC_LEVELS.length), 1, RC_LEVELS.length);
    const L = RC_LEVELS[n - 1], M = rcParse(L);
    const prog = { main: [], p1: [] };
    let active = 'main', running = false, runs = 0, cell = 48, fast = false;
    $('#gSub').textContent = `Coding · Level ${n} of ${RC_LEVELS.length}`;
    const GAP = 5;
    const stage = h('div', { class: 'rc-stage', role: 'img', 'aria-label': `Level map, ${M.W} by ${M.H} tiles, ${M.gems.length} gems` });
    const board = h('div', { class: 'rc-board' });
    stage.append(board);
    const gemEls = {};
    const msg = h('p', { class: 'msg', 'aria-live': 'polite' });
    const rows = {};
    let botEl = null, hopEl = null, cubeEl = null, lastAdded = null;
    const usedChip = () => ctx.hud('used', 'Commands', String(prog.main.length + prog.p1.length));
    function buildBoard() {
      // Size the stage to the projected outline of the open tiles (rotateZ(-45deg) then rotateX(56deg)),
      // so long thin levels get a short stage and the controls stay on screen.
      const avail = Math.min(ctx.body.clientWidth - 36, 684), K = Math.SQRT1_2, CY = Math.cos(56 * Math.PI / 180);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) {
        if (M.walls.has(x + ',' + y)) continue;
        for (const [cx, cy] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) {
          const dx = cx - M.W / 2, dy = cy - M.H / 2, px = K * (dx + dy), py = K * (dy - dx) * CY;
          x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
        }
      }
      const HEAD = 1.1, FOOT = 0.45, maxH = clamp(innerHeight - 500, 220, 430);
      cell = clamp(Math.floor(Math.min((avail - 40) / (x1 - x0), (maxH - 56) / (y1 - y0 + HEAD + FOOT)) - GAP), 22, 64);
      const u = cell + GAP, Wp = M.W * cell + (M.W - 1) * GAP, Hp = M.H * cell + (M.H - 1) * GAP;
      stage.style.height = Math.round(Math.max((y1 - y0 + HEAD + FOOT) * u + 56, 190)) + 'px';
      board.style.transform = `translate(-50%,-50%) translate(${(-(x0 + x1) / 2 * u).toFixed(1)}px,${(-(y0 + y1 - HEAD + FOOT) / 2 * u).toFixed(1)}px) rotateX(56deg) rotateZ(-45deg)`;
      board.innerHTML = '';
      board.style.width = Wp + 'px'; board.style.height = Hp + 'px';
      for (let y = 0; y < M.H; y++) for (let x = 0; x < M.W; x++) {
        if (M.walls.has(x + ',' + y)) continue;
        const isStart = M.start.x === x && M.start.y === y;
        const c = h('div', { class: 'rc-cell' + (isStart ? ' start' : ''), style: `left:${x * (cell + GAP)}px;top:${y * (cell + GAP)}px;width:${cell}px;height:${cell}px` });
        if (M.gems.some(q => q.x === x && q.y === y)) { const ge = h('div', { class: 'rc-gem' }, h('i')); c.append(ge); gemEls[x + ',' + y] = ge; }
        board.append(c);
      }
      const sz = Math.round(cell * 0.62), ht = Math.round(cell * 0.5), off = Math.round((cell - sz) / 2);
      cubeEl = h('div', { class: 'rc-cube', style: `left:${off}px;top:${off}px;width:${sz}px;height:${sz}px` },
        h('span', { class: 'f tp', style: `transform:translateZ(${ht}px)` }, h('i', { class: 'visor' })),
        h('span', { class: 'f sd', style: `top:${sz}px;height:${ht}px;transform-origin:top;transform:rotateX(90deg)` }),
        h('span', { class: 'f sd', style: `top:${-ht}px;height:${ht}px;transform-origin:bottom;transform:rotateX(-90deg)` }),
        h('span', { class: 'f fr', style: `left:${sz}px;width:${ht}px;transform-origin:left;transform:rotateY(-90deg)` }, h('i', { class: 'eye' }), h('i', { class: 'eye' })),
        h('span', { class: 'f sd', style: `left:${-ht}px;width:${ht}px;transform-origin:right;transform:rotateY(90deg)` }));
      hopEl = h('div', { class: 'rc-hop' }, cubeEl);
      botEl = h('div', { class: 'rc-bot', 'aria-hidden': 'true', style: `width:${cell}px;height:${cell}px` }, h('div', { class: 'rc-shadow' }), hopEl);
      board.append(botEl);
    }
    let rx = M.start.x, ry = M.start.y, rot = 0;
    function placeBot(bump) {
      if (!botEl) return;
      botEl.style.transform = `translate3d(${rx * (cell + GAP)}px, ${ry * (cell + GAP)}px, 0)`;
      cubeEl.style.transform = `rotateZ(${rot}deg)`;
      if (bump && !reduceMotion()) { hopEl.classList.remove('hop'); void hopEl.offsetWidth; hopEl.classList.add('hop'); }
    }
    function resetBot() {
      rx = M.start.x; ry = M.start.y; rot = 0;
      Object.values(gemEls).forEach(g => g.classList.remove('got'));
      placeBot(); clearRun();
    }
    function drawRows() {
      ['main', 'p1'].forEach(key => {
        const R = rows[key]; if (!R) return;
        const limit = key === 'main' ? L.main : L.p1;
        R.slots.innerHTML = '';
        for (let i = 0; i < limit; i++) {
          const c = prog[key][i];
          R.slots.append(c ? h('button', { class: 'rc-slot full' + (lastAdded && lastAdded.key === key && lastAdded.i === i ? ' new' : ''), type: 'button', 'aria-label': `${RC_CMD[c].name}, step ${i + 1} of ${key === 'main' ? 'Main' : 'P1'}. Tap to remove.`, onclick: e => { e.stopPropagation(); removeAt(key, i); } }, RC_CMD[c].sym) : h('span', { class: 'rc-slot' }));
        }
        R.row.classList.toggle('active', active === key);
        R.row.setAttribute('aria-pressed', String(active === key));
      });
      usedChip();
    }
    function add(c) {
      if (running || ctx.done) return;
      const limit = active === 'main' ? L.main : L.p1;
      if (prog[active].length >= limit) { say(`${active === 'main' ? 'Main' : 'P1'} is full. ${L.p1 && active === 'main' ? 'Tap the P1 row to fill it instead.' : 'Remove a command first.'}`, 'bad'); return; }
      prog[active].push(c); lastAdded = { key: active, i: prog[active].length - 1 }; SFX.click(); say(''); drawRows(); lastAdded = null;
    }
    function removeAt(key, i) { if (running) return; prog[key].splice(i, 1); drawRows(); }
    function say(t, cls = '') { msg.className = 'msg ' + cls; msg.textContent = t; }
    function clearRun() { $$('.rc-slot.run', ctx.body).forEach(s => s.classList.remove('run')); }
    function lightAt(at) { clearRun(); const R = rows[at.list]; if (R && R.slots.children[at.idx]) R.slots.children[at.idx].classList.add('run'); }
    function run() {
      if (running || ctx.done) return;
      if (!prog.main.length) { say('Add commands to Main first.', 'bad'); return; }
      resetBot(); running = true; runs++; say('Running…');
      const events = [];
      const res = rcSimulate(L, prog, ev => events.push(ev));
      const stepT = fast ? 120 : 250;
      const maxAnim = res.won ? events.length : Math.min(events.length, 60);
      let k = 0;
      const tick = () => {
        if (k >= maxAnim) return done(res);
        const ev = events[k++];
        lightAt(ev.at);
        if (ev.call) { ctx.timeout(tick, Math.round(stepT * 0.35)); return; }
        if (ev.cmd === 'L') rot -= 90; else if (ev.cmd === 'R') rot += 90;
        rx = ev.x; ry = ev.y; placeBot(ev.bump);
        if (ev.bump) SFX.thud();
        if (ev.got) { const ge = gemEls[ev.x + ',' + ev.y]; ge.classList.add('got'); SFX.coin(); burstFrom(ge, cssVar('--d-coding'), 16); }
        ctx.timeout(tick, stepT);
      };
      ctx.timeout(tick, 180);
    }
    function done(res) {
      running = false; clearRun();
      if (res.won) return win();
      SFX.bad();
      if (res.why === 'limit') say('Stopped after 400 moves. Your program may loop forever without reaching every gem.', 'bad');
      else if (res.why === 'depth') say('Too many nested P1 calls. Make sure P1 moves the robot before calling itself.', 'bad');
      else say(`The program ended with ${res.left} gem${res.left === 1 ? '' : 's'} left. Edit it and run again.`, 'bad');
    }
    function win() {
      const used = prog.main.length + prog.p1.length;
      const stars = used <= L.best ? 3 : used <= L.best + 2 ? 2 : 1;
      const prev = S.robot.stars[n] || 0;
      S.robot.stars[n] = Math.max(prev, stars);
      if (n >= S.robot.unlocked && n < RC_LEVELS.length) S.robot.unlocked = n + 1;
      const all = RC_LEVELS.every((_, i) => S.robot.stars[i + 1]);
      SFX.good();
      ctx.finish({
        score: stars * 100 + (prev ? 0 : 50), stars, perf: stars / 3, noAdapt: true, badges: all ? ['robot'] : [],
        title: `Level ${n} cleared`,
        summary: [['Commands used', String(used)], ['Fewest possible', String(L.best)], ['Runs', String(runs)]],
        lesson: L.take + (stars < 3 ? ` For 3 stars, solve it with ${L.best} commands.` : ''),
        again: n < RC_LEVELS.length ? { label: `Level ${n + 1}`, opts: { level: n + 1 } } : { label: 'Replay level', opts: { level: n } }
      });
    }
    const mkRow = (key, label, limit) => {
      const slots = h('div', { class: 'rc-slots' });
      const row = h('div', { class: 'rc-row', role: 'button', tabindex: '0', 'aria-label': `${label} program, ${limit} slots. Select to add commands here.`, onclick: () => { active = key; drawRows(); }, onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); active = key; drawRows(); } } }, h('b', null, label), slots);
      rows[key] = { row, slots };
      return row;
    };
    const pal = h('div', { class: 'rc-pal', role: 'group', 'aria-label': 'Commands' },
      ['F', 'L', 'R'].concat(L.p1 ? ['P'] : []).map(c => h('button', { type: 'button', onclick: () => add(c), 'aria-label': 'Add ' + RC_CMD[c].name }, RC_CMD[c].sym, h('small', null, RC_CMD[c].name))));
    const speedB = h('button', { class: 'btn small', type: 'button', onclick: () => { fast = !fast; speedB.textContent = fast ? 'Speed: fast' : 'Speed: normal'; } }, 'Speed: normal');
    ctx.body.append(h('div', { class: 'stack' },
      h('div', { class: 'rc-top' }, h('div', null, h('h3', null, `Level ${n}: ${L.name}`), h('p', { class: 'rc-concept' }, L.concept))),
      stage,
      h('div', { class: 'rc-prog' }, mkRow('main', 'Main', L.main), L.p1 ? mkRow('p1', 'P1', L.p1) : null),
      pal, msg,
      h('div', { class: 'row center' }, h('button', { class: 'btn primary', type: 'button', onclick: run }, '▶ Run'), h('button', { class: 'btn', type: 'button', onclick: () => { if (!running) { resetBot(); say(''); } } }, 'Reset robot'), h('button', { class: 'btn ghost', type: 'button', onclick: () => { if (!running) { prog.main = []; prog.p1 = []; drawRows(); say(''); } } }, 'Clear'), speedB),
      h('p', { class: 'prompt' }, 'Tip: tap a command in a row to remove it.', h('span', { class: 'kbd-only' }, ' Keyboard: ↑ ← → add moves, P adds P1, Backspace removes, Enter runs.'))));
    ctx.onKey(e => {
      if (e.key === 'ArrowUp') { add('F'); return true; }
      if (e.key === 'ArrowLeft') { add('L'); return true; }
      if (e.key === 'ArrowRight') { add('R'); return true; }
      if ((e.key === 'p' || e.key === 'P') && L.p1) { add('P'); return true; }
      if (e.key === 'Backspace') { if (!running && prog[active].length) { prog[active].pop(); drawRows(); } return true; }
      if (e.key === 'Enter') { run(); return true; }
      return false;
    });
    ctx.hud('lvl', 'Level', `${n}/10`);
    buildBoard(); resetBot(); drawRows();
    const onResize = () => { if (!running) { buildBoard(); resetBot(); } };
    window.addEventListener('resize', onResize);
    ctx.onCleanup(() => window.removeEventListener('resize', onResize));
  }
};

/* ---------- Code Tracer ---------- */
function codeGen(d, r) {
  const py = r.chance(0.5);
  const kinds = [['arith', 3], ['mod', 2]];
  if (d >= 2) kinds.push(['ifelse', 2], ['loopsum', 3]);
  if (d >= 3) kinds.push(['while', 2], ['strindex', 2], ['list', 2]);
  if (d >= 4) kinds.push(['bool', 1.5], ['func', 2]);
  if (d >= 5) kinds.push(['nested', 2], ['slice', 1.5]);
  if (d >= 6) kinds.push(['swap', 1.5], ['revstr', 1.5]);
  if (d >= 7) kinds.push(['comp', 2], ['recur', 2]);
  if (d >= 8) kinds.push(['count', 2]);
  const k = r.weighted(kinds);
  const out = s => py ? `print(${s})` : `console.log(${s});`;
  const v = s => py ? s : `let ${s};`;
  let code, ans, wrong = [], ex, numeric = true;
  if (k === 'arith') {
    const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 5), paren = r.chance(0.4);
    const expr = paren ? `(x + y) * ${c}` : `x + y * ${c}`;
    ans = paren ? (a + b) * c : a + b * c;
    code = [v(`x = ${a}`), v(`y = ${b}`), py ? `x = ${expr}` : `x = ${expr};`, out('x')].join('\n');
    wrong = [paren ? a + b * c : (a + b) * c, a + b + c, ans + 1];
    ex = paren ? `Brackets first: (${a} + ${b}) × ${c} = ${ans}.` : `Multiplication before addition: ${b} × ${c} = ${b * c}, then ${a} + ${b * c} = ${ans}.`;
  } else if (k === 'mod') {
    const n = r.int(11, 49), m = r.int(3, 9), useMod = r.chance(0.55);
    ans = useMod ? n % m : Math.floor(n / m);
    code = [v(`n = ${n}`), out(useMod ? `n % ${m}` : py ? `n // ${m}` : `Math.floor(n / ${m})`)].join('\n');
    wrong = useMod ? [Math.floor(n / m), m - (n % m), (n % m) + 1] : [n % m, Math.ceil(n / m) === ans ? ans + 1 : Math.ceil(n / m), ans - 1];
    ex = useMod ? `% gives the remainder: ${n} = ${m} × ${Math.floor(n / m)} + ${n % m}, so the answer is ${n % m}.` : `${py ? '//' : 'Math.floor(n / m)'} divides and rounds down: ${n} ÷ ${m} = ${fmt(n / m, 2)} → ${ans}.`;
  } else if (k === 'ifelse') {
    const t1 = r.pick([80, 85, 90]), t2 = r.pick([60, 65, 70]);
    const score = r.pick([t1, t2, t2 - 1, t1 - 1, r.int(40, 99)]);
    ans = score >= t1 ? 'A' : score >= t2 ? 'B' : 'C'; numeric = false;
    code = py ? `score = ${score}\nif score >= ${t1}:\n    print("A")\nelif score >= ${t2}:\n    print("B")\nelse:\n    print("C")`
      : `let score = ${score};\nif (score >= ${t1}) {\n  console.log("A");\n} else if (score >= ${t2}) {\n  console.log("B");\n} else {\n  console.log("C");\n}`;
    wrong = ['A', 'B', 'C', 'A and B'].filter(x => x !== ans);
    ex = `${score} ${score >= t1 ? '≥' : '<'} ${t1}${score >= t1 ? '' : `, and ${score} ${score >= t2 ? '≥' : '<'} ${t2}`}. Only the first true branch runs, so it prints ${ans}.`;
  } else if (k === 'loopsum') {
    const n = r.int(4, 9), step2 = d >= 4 && r.chance(0.4);
    let s = 0;
    if (step2) { for (let i = 0; i < n; i += 2) s += i; } else { for (let i = 1; i < n; i++) s += i; }
    ans = s;
    code = py ? `total = 0\nfor i in range(${step2 ? `0, ${n}, 2` : `1, ${n}`}):\n    total += i\nprint(total)`
      : `let total = 0;\nfor (let i = ${step2 ? 0 : 1}; i < ${n}; i${step2 ? ' += 2' : '++'}) {\n  total += i;\n}\nconsole.log(total);`;
    const vals = []; if (step2) { for (let i = 0; i < n; i += 2) vals.push(i); } else { for (let i = 1; i < n; i++) vals.push(i); }
    wrong = [s + n, s - vals[vals.length - 1], s + 1];
    ex = `The loop stops before ${n}, so i takes ${vals.join(', ')}. ${vals.join(' + ')} = ${s}.`;
  } else if (k === 'while') {
    let n = r.int(10, 100); const n0 = n, trail = [n]; let c = 0;
    while (n > 1) { n = Math.floor(n / 2); c++; trail.push(n); }
    ans = c;
    code = py ? `n = ${n0}\ncount = 0\nwhile n > 1:\n    n = n // 2\n    count += 1\nprint(count)`
      : `let n = ${n0};\nlet count = 0;\nwhile (n > 1) {\n  n = Math.floor(n / 2);\n  count++;\n}\nconsole.log(count);`;
    wrong = [c + 1, c - 1, Math.floor(n0 / 2)];
    ex = `n goes ${trail.join(' → ')}: that’s ${c} halvings before n stops being greater than 1.`;
  } else if (k === 'strindex') {
    const word = r.pick(['planet', 'python', 'coding', 'binary', 'matrix', 'galaxy', 'rocket', 'silver']);
    numeric = false;
    if (r.chance(0.65)) {
      const i = r.int(1, word.length - 2); ans = word[i];
      code = [py ? `word = "${word}"` : `const word = "${word}";`, out(`word[${i}]`)].join('\n');
      wrong = [word[i - 1], word[i + 1], word[0], word[word.length - 1]].filter(x => x !== ans);
      ex = `Indexes start at 0: ${[...word].map((ch, j) => `${j}=${ch}`).join(', ')}. So word[${i}] is “${ans}”.`;
    } else {
      ans = String(word.length); numeric = true;
      code = [py ? `word = "${word}"` : `const word = "${word}";`, out(py ? 'len(word)' : 'word.length')].join('\n');
      wrong = [word.length - 1, word.length + 1, word.length * 2];
      ex = `“${word}” has ${word.length} characters. Length counts from 1, even though indexes start at 0.`;
    }
  } else if (k === 'list') {
    const nums = r.sample([3, 4, 7, 8, 12, 15, 16, 21, 23, 42], 4), add = r.pick([5, 9, 30, 99]);
    const variant = r.pick(['len', 'last', 'index']);
    const decl = py ? `nums = [${nums.join(', ')}]` : `const nums = [${nums.join(', ')}];`;
    const push = py ? `nums.append(${add})` : `nums.push(${add});`;
    if (variant === 'len') { ans = 5; code = [decl, push, out(py ? 'len(nums)' : 'nums.length')].join('\n'); wrong = [4, 6, add]; ex = `The list starts with 4 items and ${py ? 'append' : 'push'} adds one more: 5.`; }
    else if (variant === 'last') { ans = add; code = [decl, push, out(py ? 'nums[-1]' : 'nums[nums.length - 1]')].join('\n'); wrong = [nums[3], nums[0], 5]; ex = `${py ? 'append' : 'push'} adds ${add} to the end, and ${py ? 'nums[-1]' : 'nums[nums.length - 1]'} reads the last item.`; }
    else { ans = nums[1]; code = [decl, out('nums[1]')].join('\n'); wrong = [nums[0], nums[2], 1]; ex = `Index 0 is ${nums[0]}, so index 1 is the second item: ${nums[1]}.`; }
  } else if (k === 'bool') {
    const a = r.chance(0.5), b = r.chance(0.5);
    const forms = [
      [py ? 'a and not b' : 'a && !b', a && !b], [py ? 'a or b' : 'a || b', a || b], [py ? 'not (a and b)' : '!(a && b)', !(a && b)],
      [py ? 'not a or b' : '!a || b', !a || b], [py ? '(a or b) and not a' : '(a || b) && !a', (a || b) && !a]
    ];
    const [expr, val] = r.pick(forms);
    const T = py ? 'True' : 'true', F = py ? 'False' : 'false';
    numeric = false; ans = val ? T : F;
    code = [py ? `a = ${a ? T : F}` : `const a = ${a ? T : F};`, py ? `b = ${b ? T : F}` : `const b = ${b ? T : F};`, out(expr)].join('\n');
    wrong = [val ? F : T];
    ex = `With a = ${a ? T : F} and b = ${b ? T : F}, ${expr} evaluates to ${ans}. ${py ? '“not” flips a value; “and” needs both; “or” needs either.' : '! flips a value; && needs both; || needs either.'}`;
  } else if (k === 'func') {
    const form = r.pick(['sq', 'lin', 'tri']), a = r.int(2, 6), b = r.int(1, 5), c = r.int(1, 5);
    const f = form === 'sq' ? x => x * x - c : form === 'lin' ? x => 2 * x + c : x => x * (x + 1);
    const body = form === 'sq' ? `x * x - ${c}` : form === 'lin' ? `2 * x + ${c}` : 'x * (x + 1)';
    ans = f(a) + f(b);
    code = py ? `def f(x):\n    return ${body}\n\nprint(f(${a}) + f(${b}))` : `function f(x) {\n  return ${body};\n}\nconsole.log(f(${a}) + f(${b}));`;
    wrong = [f(a + b), f(a) * f(b), ans + 1];
    ex = `f(${a}) = ${f(a)} and f(${b}) = ${f(b)}, so the sum is ${ans}.`;
  } else if (k === 'nested') {
    const A = r.int(2, 5), B = r.int(2, 5), tri = d >= 7 && r.chance(0.4);
    ans = tri ? A * (A - 1) / 2 : A * B;
    code = py ? `count = 0\nfor i in range(${A}):\n    for j in range(${tri ? 'i' : B}):\n        count += 1\nprint(count)`
      : `let count = 0;\nfor (let i = 0; i < ${A}; i++) {\n  for (let j = 0; j < ${tri ? 'i' : B}; j++) {\n    count++;\n  }\n}\nconsole.log(count);`;
    wrong = tri ? [A * A, A * (A + 1) / 2, A] : [A + B, (A + 1) * (B + 1), A * B + A];
    ex = tri ? `The inner loop runs i times: ${[...Array(A).keys()].join(' + ')} = ${ans}.` : `The inner loop runs ${B} times for each of the ${A} outer passes: ${A} × ${B} = ${ans}.`;
  } else if (k === 'slice') {
    const word = r.pick(['planet', 'python', 'monday', 'string', 'tablet', 'garden']), i = r.int(1, 2), j = i + r.int(2, 3);
    numeric = false; ans = word.slice(i, j);
    code = [py ? `word = "${word}"` : `const word = "${word}";`, out(py ? `word[${i}:${j}]` : `word.slice(${i}, ${j})`)].join('\n');
    wrong = [word.slice(i, j + 1), word.slice(i - 1, j - 1), word.slice(i + 1, j + 1)];
    ex = `A slice starts at index ${i} and stops before index ${j}: characters ${i} to ${j - 1}, which spell “${ans}”.`;
  } else if (k === 'swap') {
    const a = r.int(2, 9); let b = r.int(2, 9); if (b === a) b = a + 1;
    const temp = r.chance(0.5); numeric = false;
    ans = temp ? `${b} ${a}` : `${b} ${b}`;
    code = temp ? (py ? `a = ${a}\nb = ${b}\ntemp = a\na = b\nb = temp\nprint(a, b)` : `let a = ${a};\nlet b = ${b};\nlet temp = a;\na = b;\nb = temp;\nconsole.log(a, b);`)
      : (py ? `a = ${a}\nb = ${b}\na = b\nb = a\nprint(a, b)` : `let a = ${a};\nlet b = ${b};\na = b;\nb = a;\nconsole.log(a, b);`);
    wrong = [`${b} ${a}`, `${a} ${b}`, `${a} ${a}`, `${b} ${b}`].filter(x => x !== ans);
    ex = temp ? 'temp saves the old a, so the values really swap.' : `After a = b, both hold ${b}. Then b = a copies ${b} back. The old ${a} is lost: a classic swap bug.`;
  } else if (k === 'revstr') {
    const w = r.pick(['abc', 'code', 'loop', 'data', 'star', 'stop']), rev = r.chance(0.7);
    numeric = false; ans = rev ? [...w].reverse().join('') : w;
    code = py ? `s = ""\nfor c in "${w}":\n    s = ${rev ? 'c + s' : 's + c'}\nprint(s)` : `let s = "";\nfor (const c of "${w}") {\n  s = ${rev ? 'c + s' : 's + c'};\n}\nconsole.log(s);`;
    wrong = [rev ? w : [...w].reverse().join(''), w.slice(1) + w[0], w[w.length - 1] + w.slice(0, -1)];
    ex = rev ? 'Each new letter is added to the front, so the string comes out reversed.' : 'Each letter is added to the end, so the string is rebuilt in order.';
  } else if (k === 'comp') {
    const s0 = r.int(1, 4), nums = [0, 1, 2, 3, 4, 5].map(i => s0 + i);
    const evens = nums.filter(x => x % 2 === 0);
    ans = evens.reduce((a, b) => a + b * b, 0);
    code = py ? `nums = [${nums.join(', ')}]\nevens = [n * n for n in nums if n % 2 == 0]\nprint(sum(evens))`
      : `const nums = [${nums.join(', ')}];\nconst evens = nums.filter(n => n % 2 === 0).map(n => n * n);\nconsole.log(evens.reduce((a, b) => a + b, 0));`;
    wrong = [evens.reduce((a, b) => a + b, 0), nums.filter(x => x % 2).reduce((a, b) => a + b * b, 0), nums.reduce((a, b) => a + b * b, 0)];
    ex = `Keep the even numbers (${evens.join(', ')}), square them (${evens.map(x => x * x).join(', ')}), then add: ${ans}.`;
  } else if (k === 'recur') {
    if (r.chance(0.5)) {
      const n = r.int(3, 6), fact = x => x <= 1 ? 1 : x * fact(x - 1);
      ans = fact(n);
      code = py ? `def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)\n\nprint(fact(${n}))` : `function fact(n) {\n  if (n <= 1) return 1;\n  return n * fact(n - 1);\n}\nconsole.log(fact(${n}));`;
      wrong = [fact(n - 1), n * (n - 1), fact(n) + n];
      ex = `fact(${n}) = ${[...Array(n).keys()].map(i => n - i).join(' × ')} = ${ans}.`;
    } else {
      const n = r.int(5, 9), fib = x => x < 2 ? x : fib(x - 1) + fib(x - 2);
      ans = fib(n);
      code = py ? `def fib(n):\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)\n\nprint(fib(${n}))` : `function fib(n) {\n  if (n < 2) return n;\n  return fib(n - 1) + fib(n - 2);\n}\nconsole.log(fib(${n}));`;
      wrong = [fib(n - 1), fib(n + 1), ans + 1];
      ex = `fib counts 0, 1, 1, 2, 3, 5, 8, 13, 21, 34…; fib(${n}) is ${ans}.`;
    }
  } else {
    const word = r.pick(['banana', 'mississippi', 'letter', 'coffee', 'success', 'balloon']);
    const letters = [...new Set(word)].filter(ch => word.split(ch).length - 1 >= 2);
    const ch = r.pick(letters.length ? letters : [...word]);
    ans = word.split(ch).length - 1;
    code = py ? `counts = {}\nfor ch in "${word}":\n    counts[ch] = counts.get(ch, 0) + 1\nprint(counts["${ch}"])` : `const counts = {};\nfor (const ch of "${word}") {\n  counts[ch] = (counts[ch] || 0) + 1;\n}\nconsole.log(counts["${ch}"]);`;
    wrong = [ans + 1, ans - 1, word.length];
    ex = `The loop counts each letter. “${ch}” appears ${ans} times in “${word}”.`;
  }
  let choices;
  if (numeric && typeof ans === 'number') choices = [ans, ...nearNums(ans, r, wrong, { neg: false })];
  else { const seen = new Set([String(ans)]); choices = [String(ans)]; wrong.forEach(w => { const s = String(w); if (s && !seen.has(s)) { seen.add(s); choices.push(s); } }); choices = choices.slice(0, 4); }
  return { kind: 'Trace the code', langLabel: py ? 'Python' : 'JavaScript', lang: py ? 'py' : 'js', q: 'What does this print?', code, choices: choices.map(c => esc(c)), explain: esc(ex), monoChoices: true, key: code };
}
QGEN.coding = codeGen;
IMPL.tracer = {
  play(ctx) {
    runQuiz(ctx, { mode: 'classic', count: 10, perQ: 50, gen: codeGen,
      lesson: 'Trace code like the computer does: one line at a time, writing down each variable’s value as it changes. Watch for loops that stop one early and indexes that start at 0.' });
  }
};
