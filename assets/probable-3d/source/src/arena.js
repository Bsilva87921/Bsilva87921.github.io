/* Sports Lab "Live arena": every game on one 3D timeline. x = start time (a glowing NOW line),
   lanes = sports, each orb = one game. The orb is split between the two teams' colors so that the
   share of its surface in each color equals that team's win probability (a sphere zone's area is
   proportional to its height, so a cut at y = 1 - 2p gives exactly p). Live games glow, pulse and
   stand on a light beam; finals sit lower and dimmer. */
import { Stage, THREE, clamp } from './stage.js';
import { instancedBufferAttribute, positionLocal, positionViewDirection, normalView, vec3, float, mix, smoothstep, oneMinus, abs, min, max, dot, pow, sin, time, hash, instanceIndex, color, uniform, fract } from 'three/tsl';

const MAX = 180, LANE_GAP = 1.15, X0 = -5.6, X1 = 6.9;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function arena(el, data, opts) {
  const st = await new Stage(el, Object.assign({ fov: 34, bg: opts.bg || '#0b1220', limits: { yaw: [-0.55, 0.55], pitch: [-0.12, 0.3], wrapYaw: false }, bloom: { strength: 0.85, radius: 0.4, threshold: 0.42 } }, opts)).init();
  const { scene, rig, camera } = st;
  const accent = new THREE.Color(opts.accent || '#FFB547');
  camera.position.set(0.5, 4.9, 10.9); camera.lookAt(0.55, 0.62, 0);
  st.onResize = (w, h) => {           // keep the whole timeline in view on narrow screens
    const a = w / h; camera.fov = a < 1.2 ? 52 : a < 2 ? 40 : 34;
    camera.position.set(0.5, a < 1.2 ? 6.4 : 4.9, a < 1.2 ? 14 : 10.9); camera.lookAt(0.55, 0.62, 0);
  };
  st.resize();

  scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x0b1220, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-4, 8, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(accent, 1.2); rim.position.set(5, 3, -6); scene.add(rim);

  /* ---------- floor: fading grid ---------- */
  const floorMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const px = positionLocal.x, pz = positionLocal.y;
  const line = (v, k) => smoothstep(0.46, 0.5, abs(fract(v.mul(k)).sub(0.5)));
  const grid = max(line(px, 1), line(pz, 1)).mul(0.55).add(max(line(px, 4), line(pz, 4)).mul(0.12));
  const fade = oneMinus(smoothstep(3.2, 8.6, vec3(px.mul(0.62), pz, 0).length()));
  floorMat.colorNode = mix(color('#0f2236'), color('#5e86b8'), grid);
  floorMat.opacityNode = fade.mul(grid.mul(0.9).add(0.18));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 10, 1, 1), floorMat);
  floor.rotation.x = -Math.PI / 2; rig.add(floor);

  /* ---------- NOW line ---------- */
  const nowMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  nowMat.colorNode = vec3(accent.r, accent.g, accent.b);
  nowMat.opacityNode = pow(oneMinus(positionLocal.y.add(0.5)), 2.2).mul(0.22);       // a faint light curtain, brightest at the floor
  const nowBar = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), nowMat); nowBar.rotation.y = Math.PI / 2; rig.add(nowBar);
  const nowFloor = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 1), new THREE.MeshBasicNodeMaterial({ color: accent, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
  nowFloor.rotation.x = -Math.PI / 2; nowFloor.position.y = 0.01; rig.add(nowFloor);

  /* ---------- orbs ---------- */
  const fA = new Float32Array(MAX), fB = new Float32Array(MAX), cH = new Float32Array(MAX * 3), cA = new Float32Array(MAX * 3), gl = new Float32Array(MAX);
  const aH = new THREE.InstancedBufferAttribute(fA, 1), aA = new THREE.InstancedBufferAttribute(fB, 1), aCH = new THREE.InstancedBufferAttribute(cH, 3), aCA = new THREE.InstancedBufferAttribute(cA, 3), aG = new THREE.InstancedBufferAttribute(gl, 1);
  for (const a of [aH, aA, aCH, aCA, aG]) a.setUsage(THREE.DynamicDrawUsage);
  const orbMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.32, metalness: 0.15 });
  {
    const yH = instancedBufferAttribute(aH, 'float'), yA = instancedBufferAttribute(aA, 'float');
    const colH = instancedBufferAttribute(aCH, 'vec3'), colA = instancedBufferAttribute(aCA, 'vec3'), g = instancedBufferAttribute(aG, 'float');
    const y = positionLocal.y, e = float(0.03);
    const top = smoothstep(yH.sub(e), yH.add(e), y);
    const bot = oneMinus(smoothstep(yA.sub(e), yA.add(e), y));
    const draw = vec3(0.62, 0.66, 0.72);
    const base = mix(mix(draw, colH, top), colA, bot);
    const seam = oneMinus(smoothstep(0.0, 0.035, min(abs(y.sub(yH)), abs(y.sub(yA))))).mul(smoothstep(-0.999, -0.98, yA).mul(oneMinus(smoothstep(0.98, 0.999, yH))).max(0.0));
    const fres = pow(oneMinus(abs(dot(normalView, positionViewDirection))), 2.2);
    const pulse = sin(time.mul(2.6).add(hash(instanceIndex).mul(6.283))).mul(0.5).add(0.5);
    orbMat.colorNode = mix(base, vec3(1, 1, 1), 0.12);
    orbMat.emissiveNode = base.mul(g.mul(0.62).add(0.16)).add(vec3(accent.r, accent.g, accent.b).mul(fres.mul(g).mul(pulse.mul(0.9).add(0.35)))).add(vec3(1, 1, 1).mul(seam.mul(0.9)));
  }
  const orbGeo = new THREE.IcosahedronGeometry(1, 4);
  for (const a of [['aH', aH], ['aA', aA], ['aCH', aCH], ['aCA', aCA], ['aG', aG]]) orbGeo.setAttribute(a[0], a[1]);
  const orbs = new THREE.InstancedMesh(orbGeo, orbMat, MAX); orbs.count = 0; orbs.frustumCulled = false; rig.add(orbs);

  /* live halos + light beams */
  const haloMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  haloMat.colorNode = vec3(accent.r, accent.g, accent.b).mul(1.4);
  haloMat.opacityNode = sin(time.mul(2.6).add(hash(instanceIndex).mul(6.283))).mul(0.25).add(0.6);
  const halos = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.03, 8, 64), haloMat, MAX); halos.count = 0; halos.frustumCulled = false; rig.add(halos);
  const beamMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  beamMat.colorNode = vec3(accent.r, accent.g, accent.b);
  beamMat.opacityNode = oneMinus(positionLocal.y.add(0.5)).mul(0.55);
  const beams = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), beamMat, MAX); beams.count = 0; beams.frustumCulled = false; rig.add(beams);

  /* drifting sparks (stadium-light bokeh) */
  {
    const n = st.q === 'high' ? 220 : 90, g = new THREE.IcosahedronGeometry(1, 0);
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    m.colorNode = mix(color('#7fb2ff'), vec3(accent.r, accent.g, accent.b), hash(instanceIndex.add(7)));
    m.opacityNode = sin(time.mul(0.7).add(hash(instanceIndex).mul(30.0))).mul(0.35).add(0.45);
    const sp = new THREE.InstancedMesh(g, m, n), M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
    for (let i = 0; i < n; i++) {
      const r = 0.012 + rnd(i, 3) * 0.022; s.set(r, r, r);
      M.compose(new THREE.Vector3((rnd(i, 1) - 0.5) * 17, 0.3 + rnd(i, 2) * 4.2, (rnd(i, 4) - 0.5) * 9 - 1.5), q, s); sp.setMatrixAt(i, M);
    }
    sp.frustumCulled = false; rig.add(sp); st.sparks = sp;
  }

  /* ---------- data → instances ---------- */
  let model = { games: [], lanes: [] }, layout = [];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler(), tmpC = new THREE.Color();
  const hsl = {};
  function setColor(arr, i, hex) {                      // lift very dark team colors so they read on the night background
    tmpC.set(hex || '#888888'); tmpC.getHSL(hsl, THREE.SRGBColorSpace);
    if (hsl.l < 0.34) tmpC.setHSL(hsl.h, Math.min(1, hsl.s * 1.05), 0.34, THREE.SRGBColorSpace);
    arr[i * 3] = tmpC.r; arr[i * 3 + 1] = tmpC.g; arr[i * 3 + 2] = tmpC.b;
  }
  function xOf(t, w) { return X0 + clamp((t - w[0]) / (w[1] - w[0]), 0, 1) * (X1 - X0); }

  function apply(d) {
    model = d || model;
    const lanes = model.lanes || [];
    const now = model.now || Date.now();
    const w = model.window || [now - 10 * 3600e3, now + 30 * 3600e3];
    const laneZ = {}; lanes.forEach((l, i) => { laneZ[l.id] = (i - (lanes.length - 1) / 2) * LANE_GAP; });
    // priority: live, then rank, then start time; cap to MAX and 6 per stack
    const gs = (model.games || []).filter(g => laneZ[g.lane] != null && g.t >= w[0] - 3600e3 && g.t <= w[1]).slice()
      .sort((a, b) => (a.state === 'in' ? 0 : 1) - (b.state === 'in' ? 0 : 1) || (a.rank ?? 99) - (b.rank ?? 99) || a.t - b.t);
    const stacks = new Map(); layout = [];
    for (const g of gs) {
      if (layout.length >= MAX) break;
      const slot = g.lane + '|' + Math.round(g.t / (45 * 60e3));
      const k = stacks.get(slot) || { n: 0, more: 0, x: xOf(g.t, w), z: laneZ[g.lane] };
      if (k.n >= 5) { k.more++; stacks.set(slot, k); continue; }
      const r = g.state === 'in' ? 0.25 : g.state === 'pre' ? 0.2 : 0.16;
      layout.push({ g, x: k.x, z: k.z, y: 0.4 + k.n * 0.44 + (g.state === 'post' ? -0.06 : 0), r, slot });
      k.n++; stacks.set(slot, k);
    }
    // instance attributes
    let nl = 0;
    layout.forEach((L, i) => {
      const g = L.g, pH = clamp(+g.pH || 0, 0, 1), pA = clamp(+g.pA || 0, 0, 1);
      fA[i] = 1 - 2 * pH; fB[i] = 2 * pA - 1;
      setColor(cH, i, g.cH); setColor(cA, i, g.cA);
      gl[i] = g.state === 'in' ? 1 : g.state === 'pre' ? 0.45 : 0.12;
      if (g.state === 'in') nl++;
    });
    orbs.count = layout.length; halos.count = nl; beams.count = nl;
    for (const a of [aH, aA, aCH, aCA, aG]) a.needsUpdate = true;
    // static furniture
    const xn = xOf(now, w);
    const depth = Math.max(1, lanes.length) * LANE_GAP + 0.6;
    nowBar.scale.set(depth, 2.9, 1); nowBar.position.set(xn, 1.45, 0);
    nowFloor.scale.set(1, depth + 0.8, 1); nowFloor.position.set(xn, 0.012, 0);
    // labels: lanes, clock ticks, NOW, "+n" on full stacks
    st.clearLabels();
    lanes.forEach(l => { const e = st.label(l.label, 'px3d-lane'); st.labels.push({ el: e, pos: new THREE.Vector3(X0 - 0.3, 0.05, laneZ[l.id]), dx: -4 }); });
    const front = (lanes.length / 2) * LANE_GAP + 0.55;
    const step = (w[1] - w[0]) > 30 * 3600e3 ? 6 : 3, t0 = new Date(w[0]); t0.setMinutes(0, 0, 0);
    for (let t = +t0; t <= w[1]; t += 3600e3) {
      const d = new Date(t); if (d.getHours() % step) continue;
      if (Math.abs(t - now) < 1.6 * 3600e3) continue;
      const txt = d.getHours() === 0 ? d.toLocaleDateString([], { weekday: 'short' }) : d.toLocaleTimeString([], { hour: 'numeric' });
      const e = st.label(txt, 'px3d-tick'); st.labels.push({ el: e, pos: new THREE.Vector3(xOf(t, w), 0, front) });
    }
    const nl2 = st.label('NOW', 'px3d-now'); st.labels.push({ el: nl2, pos: new THREE.Vector3(xn, 0.02, front - 0.1) });
    for (const k of stacks.values()) if (k.more) { const e = st.label('+' + k.more, 'px3d-more'); st.labels.push({ el: e, pos: new THREE.Vector3(k.x, 0.4 + 5 * 0.44 + 0.02, k.z) }); }
    // pickable items
    st.items = layout.map(L => ({ pos: new THREE.Vector3(L.x, L.y, L.z), data: L.g, r: 16, L }));
    place(0);
    st.dirty = true;
  }

  function place(t) {
    let h = 0;
    layout.forEach((L, i) => {
      const live = L.g.state === 'in', hov = st.hover && st.hover.L === L;
      const bob = t ? Math.sin(t * 1.1 + i * 1.7) * 0.035 : 0;
      const sc = L.r * (hov ? 1.35 : 1) * (live && t ? 1 + Math.sin(t * 2.6 + i) * 0.04 : 1);
      P.set(L.x, L.y + bob, L.z); S.set(sc, sc, sc); E.set(0, t * 0.25 + i, 0); Q.setFromEuler(E);
      M.compose(P, Q, S); orbs.setMatrixAt(i, M);
      st.items[i] && st.items[i].pos.copy(P);
      if (live) {
        E.set(Math.PI / 2 + Math.sin(t * 0.8 + i) * 0.2, 0, t * 0.6); Q.setFromEuler(E); S.set(sc * 1.65, sc * 1.65, sc * 1.65);
        M.compose(P, Q, S); halos.setMatrixAt(h, M);
        const bh = Math.max(0.05, L.y + bob - sc);
        Q.identity(); S.set(0.018, bh, 0.018); M.compose(new THREE.Vector3(L.x, bh / 2, L.z), Q, S); beams.setMatrixAt(h, M);
        h++;
      }
    });
    orbs.instanceMatrix.needsUpdate = true; halos.instanceMatrix.needsUpdate = true; beams.instanceMatrix.needsUpdate = true;
  }

  st.onFrame = (t) => {
    place(t);
    if (!st.drag && !st.hover && t) { st.yaw += (Math.sin(t * 0.09) * 0.22 - st.yaw) * 0.01; }
    if (st.sparks && t) st.sparks.rotation.y = Math.sin(t * 0.03) * 0.08;
  };
  st.onHover = () => { st.dirty = true; };
  st.tipHTML = g => {
    const pct = p => Math.round(p * 100) + '%';
    const bar = `<span class="px3d-split"><i style="width:${(g.pA * 100).toFixed(1)}%;background:${esc(g.cA)}"></i><i style="width:${((g.pD || 0) * 100).toFixed(1)}%;background:#9aa4b2"></i><i style="width:${(g.pH * 100).toFixed(1)}%;background:${esc(g.cH)}"></i></span>`;
    return `<b>${esc(g.title)}</b><span class="px3d-sub">${esc(g.sub)}</span>${bar}<span class="px3d-probs">${esc(g.aAbbr)} ${pct(g.pA)}${g.pD ? ' · draw ' + pct(g.pD) : ''} · ${esc(g.hAbbr)} ${pct(g.pH)}</span>${g.state === 'in' || g.state === 'pre' ? '<span class="px3d-hint">Tap to open the game</span>' : ''}`;
  };
  apply(data);
  st.start();
  return { stage: st, backend: st.backend, update: d => apply(d), destroy: () => st.destroy(), setPaused: p => { st.reduced = !!p; st.dirty = true; } };
}
