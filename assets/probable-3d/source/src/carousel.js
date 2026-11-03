/* Sports Lab scoreboard carousel: a ring of 3D game cards that turns one card at a time. Each card is drawn
   on a canvas (league, clock, both teams with their scores, and a win-chance bar in team colors) and mapped
   onto a rounded glass panel, so the text stays crisp. Live games come first and glow; drag to spin, use the
   arrows, or tap a card to open the game. With four games or fewer the cards stand in a gentle arc. */
import { Stage, THREE, clamp } from './stage.js';
import { vec3, color, mix, smoothstep, oneMinus, sin, abs, time, hash, instanceIndex, float, length, uv } from 'three/tsl';

const CW = 2.5, CH = 1.56;                        // card size in world units (16:10)
const MAXC = 16;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- card artwork (2D canvas) ---------- */
const FD = '"Big Shoulders Display","Oswald","Arial Narrow",system-ui,sans-serif';
const FB = '"Barlow","Segoe UI",system-ui,-apple-system,sans-serif';
const FM = '"JetBrains Mono",ui-monospace,Menlo,monospace';
function hexRGB(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [136, 136, 136]; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function lum([r, g, b]) { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function lift(h) {                                // keep very dark team colors visible on the night card
  let [r, g, b] = hexRGB(h); const L = lum([r, g, b]);
  if (L < 0.035) { const k = 0.32; r = Math.round(r + (255 - r) * k); g = Math.round(g + (255 - g) * k); b = Math.round(b + (255 - b) * k); }
  return `rgb(${r},${g},${b})`;
}
const inkOn = h => lum(hexRGB(h)) > 0.42 ? '#0b1220' : '#ffffff';
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function fit(ctx, text, max) { let t = String(text || ''); if (ctx.measureText(t).width <= max) return t; while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1); return t + '…'; }

function drawCard(cv, g, accent, front) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, s = W / 800;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); ctx.scale(s, s);
  const w = 800, h = 500, live = g.state === 'in', post = g.state === 'post';
  // panel
  const pad = 14;
  rr(ctx, pad, pad, w - 2 * pad, h - 2 * pad, 34);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, live ? '#1c2c49' : '#17243c'); bg.addColorStop(1, live ? '#0f1a2f' : '#0d1627');
  ctx.fillStyle = bg; ctx.fill();
  ctx.lineWidth = live ? 5 : 2.5; ctx.strokeStyle = live ? accent : front ? 'rgba(200,215,240,.42)' : 'rgba(200,215,240,.22)'; ctx.stroke();
  // team-color sheen across the top
  ctx.save(); rr(ctx, pad, pad, w - 2 * pad, h - 2 * pad, 34); ctx.clip();
  const sh = ctx.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, lift(g.away.color)); sh.addColorStop(1, lift(g.home.color));
  ctx.globalAlpha = 0.9; ctx.fillStyle = sh; ctx.fillRect(0, 0, w, 10 + pad); ctx.globalAlpha = 1; ctx.restore();
  const x0 = 50, x1 = w - 50;
  // top row: league + status
  ctx.textBaseline = 'middle';
  ctx.font = `700 26px ${FM}`; const lgTxt = String(g.league || '').toUpperCase();
  const lw = ctx.measureText(lgTxt).width + 28;
  rr(ctx, x0, 44, lw, 42, 21); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill();
  ctx.fillStyle = '#c9d5e8'; ctx.textAlign = 'left'; ctx.fillText(lgTxt, x0 + 14, 66);
  ctx.textAlign = 'right';
  if (live) {
    ctx.font = `800 28px ${FB}`; const t = fit(ctx, g.status || 'Live', 360); const tw = ctx.measureText(t).width;
    ctx.fillStyle = accent; ctx.fillText(t, x1, 66);
    ctx.font = `800 22px ${FM}`; const lv = 'LIVE', lvw = ctx.measureText(lv).width + 40, lx = x1 - tw - 16 - lvw;
    rr(ctx, lx, 47, lvw, 38, 19); ctx.fillStyle = 'rgba(255,90,90,.16)'; ctx.fill();
    ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(lx + 17, 66, 7, 0, 7); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillText(lv, lx + 30, 67);
  } else {
    ctx.font = `700 27px ${FB}`; ctx.fillStyle = post ? '#d4dceb' : '#aab7cb'; ctx.fillText(fit(ctx, post ? 'Final' + (g.statusNote ? ' · ' + g.statusNote : '') : g.status, 470), x1, 66);
  }
  // team rows: away on top, home below (scoreboard order)
  const rows = [['away', 148], ['home', 252]];
  for (const [k, y] of rows) {
    const t = g[k], c = lift(t.color), win = post && t.winner, lose = post && !t.winner && (g.home.winner || g.away.winner);
    rr(ctx, x0, y - 38, 112, 76, 16); ctx.fillStyle = c; ctx.fill();
    ctx.fillStyle = inkOn(t.color || '#888888'); ctx.textAlign = 'center'; ctx.font = `900 40px ${FD}`; ctx.fillText(String(t.abbr || '').slice(0, 4), x0 + 56, y + 2);
    ctx.textAlign = 'left'; ctx.font = `${win ? 800 : 600} 38px ${FB}`; ctx.fillStyle = lose ? '#7f8ca3' : '#eef3fb';
    ctx.fillText(fit(ctx, t.name, 420), x0 + 136, y - (t.sub ? 10 : 0));
    if (t.sub) { ctx.font = `500 23px ${FB}`; ctx.fillStyle = '#8e9bb2'; ctx.fillText(fit(ctx, t.sub, 420), x0 + 136, y + 26); }
    if (t.score != null && g.state !== 'pre') {
      ctx.textAlign = 'right'; ctx.font = `900 84px ${FD}`; ctx.fillStyle = lose ? '#7f8ca3' : '#ffffff'; ctx.fillText(String(t.score), x1, y + 4);
    }
  }
  // win-chance bar
  const by = 342, bh = 34, bw = x1 - x0;
  const pA = clamp(g.pA || 0, 0, 1), pD = clamp(g.pD || 0, 0, 1), pH = clamp(g.pH || 0, 0, 1), tot = pA + pD + pH || 1;
  ctx.save(); rr(ctx, x0, by, bw, bh, bh / 2); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x0, by, bw, bh);
  let xx = x0;
  const seg = (p, col) => { const ww = bw * p / tot; ctx.fillStyle = col; ctx.fillRect(xx, by, ww, bh); xx += ww; };
  seg(pA, lift(g.away.color)); if (pD > 0.001) seg(pD, '#7d8798'); seg(pH, lift(g.home.color));
  // divider glints between segments
  ctx.fillStyle = 'rgba(11,18,32,.9)'; ctx.fillRect(x0 + bw * pA / tot - 2, by, 4, bh); if (pD > 0.001) ctx.fillRect(x0 + bw * (pA + pD) / tot - 2, by, 4, bh);
  ctx.restore();
  const pc = v => Math.round(v * 100) + '%';
  ctx.font = `800 31px ${FB}`; ctx.fillStyle = '#eef3fb';
  ctx.textAlign = 'left'; ctx.fillText(`${g.away.abbr} ${pc(pA)}`, x0, by + bh + 34);
  ctx.textAlign = 'right'; ctx.fillText(`${pc(pH)} ${g.home.abbr}`, x1, by + bh + 34);
  if (pD > 0.001) { ctx.textAlign = 'center'; ctx.font = `600 25px ${FB}`; ctx.fillStyle = '#aab7cb'; ctx.fillText(`Draw ${pc(pD)}`, x0 + bw / 2, by + bh + 34); }
  else { ctx.textAlign = 'center'; ctx.font = `600 23px ${FB}`; ctx.fillStyle = '#8e9bb2'; ctx.fillText(post ? 'pregame win chance' : live ? 'win chance now' : 'win chance', x0 + bw / 2, by + bh + 34); }
}

/* ---------- rounded card geometry with 0..1 UVs ---------- */
function cardGeo(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, 10), p = g.attributes.position, u = g.attributes.uv;
  for (let i = 0; i < p.count; i++) u.setXY(i, (p.getX(i) - x) / w, (p.getY(i) - y) / h);
  u.needsUpdate = true; return g;
}

export async function carousel(el, data, opts) {
  const st = await new Stage(el, Object.assign({ fov: 30, bg: opts.bg || '#0a1120', limits: { yaw: [-1e6, 1e6], pitch: [-0.06, 0.1], wrapYaw: false }, bloom: { strength: 0.5, radius: 0.45, threshold: 0.7 }, dragSpeed: 1.15, tapOpens: true }, opts)).init();
  const { scene, rig, camera, renderer } = st;
  const accentHex = opts.accent || '#FFB547', accent = new THREE.Color(accentHex);
  const TEX = st.q === 'high' ? 800 : st.q === 'medium' ? 640 : 512;
  const maxAniso = renderer.getMaxAnisotropy ? renderer.getMaxAnisotropy() : 4;

  /* floor: a soft stage glow with fine rings */
  {
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    const d = length(uv().sub(0.5)).mul(2);
    const ring = smoothstep(0.48, 0.5, abs(sin(d.mul(22)))).mul(oneMinus(smoothstep(0.15, 0.9, d))).mul(0.05);
    m.colorNode = mix(color('#1d3a66'), vec3(accent.r, accent.g, accent.b), ring.mul(3.0));
    m.opacityNode = oneMinus(smoothstep(0.0, 0.95, d)).mul(0.5).add(ring);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), m); f.rotation.x = -Math.PI / 2; f.position.y = -CH / 2 - 0.38; scene.add(f);
  }
  /* drifting sparks */
  {
    const n = st.q === 'high' ? 160 : 70, g = new THREE.IcosahedronGeometry(1, 0);
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    m.colorNode = mix(color('#7fb2ff'), vec3(accent.r, accent.g, accent.b), hash(instanceIndex.add(7)));
    m.opacityNode = sin(time.mul(0.7).add(hash(instanceIndex).mul(30.0))).mul(0.3).add(0.4);
    const sp = new THREE.InstancedMesh(g, m, n), M = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3();
    const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
    for (let i = 0; i < n; i++) { const r = 0.01 + rnd(i, 3) * 0.02; sv.set(r, r, r); M.compose(new THREE.Vector3((rnd(i, 1) - 0.5) * 18, -1 + rnd(i, 2) * 5, (rnd(i, 4) - 0.5) * 12 - 3), q, sv); sp.setMatrixAt(i, M); }
    sp.frustumCulled = false; scene.add(sp); st.sparks = sp;
  }

  const geo = cardGeo(CW, CH, 0.16);
  const glowGeo = cardGeo(CW + 0.16, CH + 0.16, 0.24);
  let cards = [], N = 0, ring = true, R = 4, step = 1, targetYaw = null, lastInput = 0, advanceAt = 0, intro = 0;
  const sigOf = g => [g.id, g.state, g.status, g.away.score, g.home.score, Math.round((g.pH || 0) * 100), Math.round((g.pD || 0) * 100), g.away.winner, g.home.winner].join('|');

  function makeCard(g, i) {
    const cv = document.createElement('canvas'); cv.width = TEX; cv.height = Math.round(TEX * 0.625);
    drawCard(cv, g, accentHex, false);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, maxAniso);
    const mat = new THREE.MeshBasicNodeMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.FrontSide });
    const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 2;
    const gm = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide });
    gm.colorNode = vec3(accent.r, accent.g, accent.b);
    gm.opacityNode = sin(time.mul(2.4).add(float(i * 1.7))).mul(0.12).add(0.3);
    const glow = new THREE.Mesh(glowGeo, gm); glow.position.z = -0.012; glow.visible = g.state === 'in'; glow.renderOrder = 1;
    const grp = new THREE.Group(); grp.add(glow); grp.add(mesh); rig.add(grp);
    return { g, sig: sigOf(g), cv, tex, mat, mesh, glow, grp, front: false };
  }
  function layout() {
    ring = N > 4;
    if (ring) {
      step = 2 * Math.PI / N;
      R = Math.max(3.4, (CW + 0.55) / (2 * Math.sin(step / 2)));
      cards.forEach((c, i) => { const a = i * step; c.grp.position.set(R * Math.sin(a), 0, R * Math.cos(a)); c.grp.rotation.set(0, a, 0); c.base = a; });
      st.limits = { yaw: [-1e6, 1e6], pitch: [-0.06, 0.1], wrapYaw: false };
    } else {
      const gap = CW + 0.38;
      cards.forEach((c, i) => { const x = (i - (N - 1) / 2) * gap; c.grp.position.set(x, 0, -Math.abs(x) * 0.22); c.grp.rotation.set(0, -x * 0.1, 0); c.base = 0; });
      R = 0; st.limits = { yaw: [-0.28, 0.28], pitch: [-0.06, 0.1], wrapYaw: false };
    }
    st.yaw = 0; targetYaw = null; fitCam();
  }
  function fitCam() {
    const a = st.w / st.h, vf = camera.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * a);
    const span = ring ? CW * (a < 1.5 ? 1.18 : 1.42) : Math.max(CW * 1.15, N * (CW + 0.38));      // what must fit across
    const d = Math.max((CH * 1.3) / Math.tan(vf) / 2, span / 2 / Math.tan(hf)) + 0.35;
    const zf = ring ? R : 0;
    camera.position.set(0, 0.55, zf + d); camera.lookAt(0, -0.06, zf);
  }
  st.onResize = () => fitCam();

  function apply(d) {
    const games = ((d && d.games) || []).slice(0, MAXC);
    const same = games.length === cards.length && games.every((g, i) => g.id === cards[i].g.id);
    if (!same) {
      const keep = cards.length ? (cards[frontIndex()] || {}).g : null;
      for (const c of cards) { rig.remove(c.grp); c.tex.dispose(); c.mat.dispose(); c.glow.material.dispose(); }
      cards = games.map((g, i) => makeCard(g, i)); N = cards.length; layout();
      const j = keep ? cards.findIndex(c => c.g.id === keep.id) : -1;
      if (j > 0 && ring) st.yaw = -j * step; else intro = performance.now();
    } else {
      cards.forEach((c, i) => { const g = games[i], sg = sigOf(g); c.g = g; if (sg !== c.sig) { c.sig = sg; drawCard(c.cv, g, accentHex, c.front); c.tex.needsUpdate = true; } c.glow.visible = g.state === 'in'; });
    }
    st.dirty = true;
  }
  const frontIndex = () => ring ? ((Math.round(-st.yaw / step) % N) + N) % N : -1;
  function go(k) {                                  // turn the ring by k cards
    if (!ring || !N) return;
    const cur = Math.round(-st.yaw / step);
    targetYaw = -(cur + k) * step; lastInput = performance.now(); advanceAt = lastInput + 6000;
    if (st.reduced) { st.yaw = targetYaw; targetYaw = null; }
    st.dirty = true;
  }

  /* picking: ray against the card faces */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  st.pickFallback = (x, y) => {
    ndc.set(x / st.w * 2 - 1, -(y / st.h) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(cards.map(c => c.mesh), false)[0]; if (!hit) return null;
    const c = cards.find(k => k.mesh === hit.object); if (!c || c.mat.opacity < 0.35) return null;
    return { pos: hit.point.clone(), data: c.g, card: c };
  };
  st.onHover = it => { cards.forEach(c => { c.hov = !!(it && it.card === c); }); st.el.style.cursor = it ? 'pointer' : ''; st.dirty = true; };
  st.tipHTML = null;
  const userTouch = () => { lastInput = performance.now(); advanceAt = lastInput + 6000; targetYaw = null; };
  el.addEventListener('pointerdown', userTouch);

  const camDir = new THREE.Vector3(), nrm = new THREE.Vector3(), wq = new THREE.Quaternion();
  st.onFrame = (t) => {
    const now = performance.now();
    if (ring && N > 1) {
      if (!st.drag && targetYaw == null && Math.abs(st.vyaw) < 0.0015) {
        // settle on the nearest card, then advance one card every few seconds
        const near = -Math.round(-st.yaw / step) * step;
        if (Math.abs(near - st.yaw) > 0.002) st.yaw += (near - st.yaw) * 0.08;
        if (!st.reduced && !st.hover && now > advanceAt) { go(1); advanceAt = now + 4200; lastInput = 0; }
      }
      if (targetYaw != null && !st.drag) {
        st.yaw += (targetYaw - st.yaw) * 0.085;
        if (Math.abs(targetYaw - st.yaw) < 0.002) { st.yaw = targetYaw; targetYaw = null; }
      }
      if (st.yaw > Math.PI * 3 || st.yaw < -Math.PI * 3) { const k = Math.round(st.yaw / (2 * Math.PI)) * 2 * Math.PI; st.yaw -= k; if (targetYaw != null) targetYaw -= k; }
    } else if (!st.drag && t) st.yaw += (Math.sin(t * 0.25) * 0.08 - st.yaw) * 0.02;
    // per-card emphasis: face the camera = bright, edge-on = dim; the front card is a touch larger
    camera.getWorldDirection(camDir);
    const fi = frontIndex(), k0 = intro ? clamp((now - intro) / 900, 0, 1) : 1, ease = 1 - Math.pow(1 - k0, 3);
    cards.forEach((c, i) => {
      nrm.set(0, 0, 1).applyQuaternion(c.grp.getWorldQuaternion(wq));
      const facing = -nrm.dot(camDir);                     // 1 = facing the camera
      c.mat.opacity = clamp((facing - 0.05) / 0.55, 0, 1) * ease;
      c.glow.material.opacity = c.mat.opacity;
      const isFront = ring ? i === fi : true;
      const sc = (isFront && ring ? 1.06 : 1) * (c.hov ? 1.03 : 1) * (0.92 + 0.08 * ease);
      c.grp.scale.setScalar(c.grp.scale.x + (sc - c.grp.scale.x) * 0.2);
      c.grp.position.y = t ? Math.sin(t * 0.9 + i * 1.3) * 0.025 : 0;
      if (isFront !== c.front) { c.front = isFront; drawCard(c.cv, c.g, accentHex, isFront); c.tex.needsUpdate = true; }
    });
    if (st.sparks && t) st.sparks.rotation.y = Math.sin(t * 0.03) * 0.1;
    if (intro && k0 >= 1) intro = 0;
  };
  // repaint once the page fonts are ready (canvas text uses them)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { cards.forEach(c => { drawCard(c.cv, c.g, accentHex, c.front); c.tex.needsUpdate = true; }); st.dirty = true; });
  apply(data);
  advanceAt = performance.now() + 4500;
  st.start();
  return {
    stage: st, backend: st.backend, update: d => apply(d), destroy: () => { el.removeEventListener('pointerdown', userTouch); st.destroy(); },
    setPaused: p => { st.reduced = !!p; st.dirty = true; }, step: k => go(k), get front() { const i = frontIndex(); return i >= 0 && cards[i] ? cards[i].g : null; }
  };
}
export { esc };
