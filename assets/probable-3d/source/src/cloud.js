/* Loan Rules Lab: every LendingClub loan as one point in 3D: FICO left to right, debt-to-income front to back, the
   risk model's predicted risk upward. Each loan takes the color of the decision the reader's rules give it, and the
   rules themselves stand in the cloud as glass planes (the FICO floor, the manual-review band, the debt-to-income cap
   and the risk cap) that move with the sliders. Loans that were not fully paid are drawn larger. */
import { Stage, THREE, clamp } from './stage.js';
import { diffuseColor, uniform } from 'three/tsl';
import { esc, themeOf, applyTheme, segments, recolor, gridFloor, fit, lights } from './common.js';

const W = 6.6, H = 3.15, D = 3.8;                                   // footprint and height of the cloud
const F0 = 610, F1 = 830, R1 = 450, D1 = 300;                     // FICO range; risk and DTI are stored in tenths
const xOf = f => -W / 2 + W * (f - F0) / (F1 - F0);
const yOf = r10 => H * Math.min(R1, Math.max(0, r10)) / R1;
const zOf = d10 => D / 2 - D * Math.min(D1, Math.max(0, d10)) / D1; // low debt-to-income in front
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const hash = i => { let h = (i + 1) * 2654435761 >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; return (h >>> 8) / 16777216; };

export async function cloud(el, data, opts) {
  let theme = themeOf(opts.theme);
  const st = await new Stage(el, Object.assign({ fov: 32, bg: theme.bg, limits: { yaw: [-1.05, 1.05], pitch: [-0.18, 0.36], wrapYaw: false }, bloom: { strength: 0.35, radius: 0.3, threshold: 0.62 } }, opts)).init();
  const { scene, rig, camera } = st;
  applyTheme(st, theme);
  const Lt = lights(scene, theme);

  const fl = gridFloor(-W / 2, W / 2, -D / 2, D / 2, [F0, 650, 700, 750, 800, F1].map(xOf), [0, 100, 200, 300].map(zOf), theme, 0.25); rig.add(fl);
  // back and right walls: faint frames that give the cloud a box to sit in (the cloud is low on the right)
  const wallPts = [];
  for (let k = 1; k <= 4; k++) { const y = yOf(k * 100); wallPts.push(V3(-W / 2, y, -D / 2), V3(W / 2, y, -D / 2), V3(W / 2, y, -D / 2), V3(W / 2, y, D / 2)); }
  wallPts.push(V3(W / 2, 0, -D / 2), V3(W / 2, H, -D / 2));
  const walls = segments(wallPts, theme.line, theme.dark ? 0.2 : 0.28); rig.add(walls);

  /* the points */
  const n = data.fico.length;
  const P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    P[i * 3] = xOf(data.fico[i] + (hash(i) - 0.5) * 4.6);           // FICO comes in steps of 5: spread each step a little
    P[i * 3 + 1] = yOf(data.risk[i]);
    P[i * 3 + 2] = zOf(data.dti10[i]);
  }
  const geo = new THREE.IcosahedronGeometry(1, st.q === 'high' ? 1 : 0);
  const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.45, metalness: 0.0 });
  const glow = uniform(0.45);
  mat.emissiveNode = diffuseColor.rgb.mul(glow);
  const pts = new THREE.InstancedMesh(geo, mat, n);
  pts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  pts.frustumCulled = false;
  rig.add(pts);
  const vis = new Uint8Array(n);
  const dummy = new THREE.Object3D(), cs = [new THREE.Color(), new THREE.Color(), new THREE.Color()], ghost = new THREE.Color();
  let state = { dec: data.dec, seg: data.seg, show: data.show || 'all', rules: data.rules || {} };

  function paintPoints() {
    const s = state, ic = pts.instanceColor.array;
    theme.dec.forEach((h, k) => cs[k].set(h));
    ghost.set(theme.line);
    for (let i = 0; i < n; i++) {
      const inSeg = !s.seg || s.seg[i];
      const bad = data.bad[i] === 1;
      const dim = s.show === 'bad' && !bad;
      vis[i] = inSeg && !dim ? 1 : 0;
      const r = !inSeg ? 0 : dim ? 0.012 : bad ? 0.046 : 0.03;
      dummy.position.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); dummy.scale.setScalar(Math.max(r, 1e-5)); dummy.updateMatrix();
      pts.setMatrixAt(i, dummy.matrix);
      const c = dim ? ghost : cs[s.dec ? s.dec[i] : 0];
      ic[i * 3] = c.r; ic[i * 3 + 1] = c.g; ic[i * 3 + 2] = c.b;
    }
    pts.instanceMatrix.needsUpdate = true; pts.instanceColor.needsUpdate = true;
    glow.value = theme.dark ? 0.45 : 0.12;
    st.dirty = true;
  }

  /* rule planes */
  const planeMat = hex => new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(hex), transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const ficoPlane = new THREE.Mesh(new THREE.PlaneGeometry(D, H + 0.25), planeMat(theme.dec[2])); ficoPlane.rotation.y = Math.PI / 2; ficoPlane.position.y = (H + 0.25) / 2; ficoPlane.renderOrder = 3;
  const bandBox = new THREE.Mesh(new THREE.BoxGeometry(1, H + 0.25, D), planeMat(theme.dec[1])); bandBox.position.y = (H + 0.25) / 2; bandBox.renderOrder = 3;
  const dtiPlane = new THREE.Mesh(new THREE.PlaneGeometry(W, H + 0.25), planeMat(theme.dec[2])); dtiPlane.position.y = (H + 0.25) / 2; dtiPlane.renderOrder = 3;
  const riskPlane = new THREE.Mesh(new THREE.PlaneGeometry(W, D), planeMat(theme.dec[2])); riskPlane.rotation.x = -Math.PI / 2; riskPlane.renderOrder = 3;
  const ficoEdge = segments([V3(0, 0, -D / 2), V3(0, H + 0.25, -D / 2), V3(0, H + 0.25, -D / 2), V3(0, H + 0.25, D / 2), V3(0, H + 0.25, D / 2), V3(0, 0, D / 2)], theme.dec[2], 0.75);
  rig.add(ficoPlane, bandBox, dtiPlane, riskPlane, ficoEdge);
  const cur = { f: xOf(660), b: 0, d: zOf(250), r: yOf(400) };

  const lab = (text, cls, pos, extra) => { const e = st.label(text, cls); const L = Object.assign({ el: e, pos }, extra || {}); st.labels.push(L); return L; };
  [650, 700, 750, 800].forEach(f => lab(String(f), 'px3d-tick', V3(xOf(f), 0, D / 2 + 0.3)));
  lab('FICO score →', 'px3d-tick px3d-axis', V3(0, 0, D / 2 + 0.78));
  [0, 10, 20].forEach(d => lab(d + '% DTI', 'px3d-tick px3d-y2', V3(W / 2 + 0.12, 0, zOf(d * 10))));
  lab('Debt-to-income', 'px3d-tick px3d-axis px3d-y2', V3(W / 2 + 0.16, 0, D / 2 + 0.6));
  [10, 20, 30, 40].forEach(r => lab(r + '% risk', 'px3d-tick px3d-y2', V3(W / 2 + 0.1, yOf(r * 10), -D / 2)));
  lab('Predicted risk', 'px3d-tick px3d-axis px3d-y2', V3(W / 2 + 0.1, H + 0.3, -D / 2));
  const lFico = lab('', 'px3d-glabel px3d-rule bad', V3(0, H + 0.3, D / 2), { group: 'rule' });
  const lBand = lab('', 'px3d-glabel px3d-rule warn', V3(0, H + 0.3, D / 2), { group: 'rule', push: 1 });
  const lDti = lab('', 'px3d-glabel px3d-rule bad', V3(W / 2, H + 0.3, 0), { group: 'rule2' });
  const lRisk = lab('', 'px3d-glabel px3d-rule bad', V3(W / 2, 0, D / 2), { group: 'rule2', push: 1 });

  function rulesTarget() {
    const r = state.rules || {};
    const minF = r.minFico || 660, band = r.band || 0;
    return { f: xOf(minF), b: band > 0 ? xOf(minF + band) - xOf(minF) : 0, d: r.maxDti != null ? zOf(r.maxDti * 10) : null, r: r.maxRisk != null ? yOf(r.maxRisk * 10) : null, minF, band, maxDti: r.maxDti, maxRisk: r.maxRisk };
  }
  function placeRules(snap) {
    const T = rulesTarget(), k = snap || st.reduced ? 1 : 0.2;
    cur.f += (T.f - cur.f) * k; cur.b += (T.b - cur.b) * k;
    if (T.d != null) cur.d += (T.d - cur.d) * k;
    if (T.r != null) cur.r += (T.r - cur.r) * k;
    ficoPlane.position.x = cur.f; ficoEdge.position.x = cur.f;
    bandBox.visible = T.b > 0.001; bandBox.scale.x = Math.max(0.001, cur.b); bandBox.position.x = cur.f + cur.b / 2;
    dtiPlane.visible = T.d != null; dtiPlane.position.z = cur.d;
    riskPlane.visible = T.r != null; riskPlane.position.y = cur.r;
    lFico.el.textContent = 'FICO floor ' + T.minF; lFico.pos.set(cur.f, H + 0.3, D / 2);
    lBand.el.textContent = T.band > 0 ? `Review ${T.minF}–${T.minF + T.band - 1}` : ''; lBand.el.style.display = T.band > 0 ? '' : 'none'; lBand.pos.set(cur.f + cur.b, H + 0.3, D / 2);
    lDti.el.textContent = T.maxDti != null ? `DTI cap ${T.maxDti}%` : ''; lDti.el.style.display = T.d != null ? '' : 'none'; lDti.pos.set(W * 0.12, H + 0.3, cur.d);
    lRisk.el.textContent = T.maxRisk != null ? `Risk cap ${T.maxRisk}%` : ''; lRisk.el.style.display = T.r != null ? '' : 'none'; lRisk.pos.set(W / 2, cur.r, D / 2);
    lFico.w = lBand.w = lDti.w = lRisk.w = 0;        // label widths change with their text
    return Math.abs(T.f - cur.f) + Math.abs(T.b - cur.b) + (T.d != null ? Math.abs(T.d - cur.d) : 0) + (T.r != null ? Math.abs(T.r - cur.r) : 0) > 0.002;
  }
  function paintPlanes() {
    recolor(ficoPlane, theme.dec[2], theme.dark ? 0.1 : 0.09); recolor(ficoEdge, theme.dec[2], 0.8);
    recolor(bandBox, theme.dec[1], theme.dark ? 0.08 : 0.1);
    recolor(dtiPlane, theme.dec[2], theme.dark ? 0.08 : 0.07); recolor(riskPlane, theme.dec[2], theme.dark ? 0.08 : 0.07);
  }

  /* hover: a ring around the loan under the pointer, picked in screen space */
  const ring = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(theme.ink), transparent: true, opacity: 0.9, wireframe: true }));
  ring.visible = false; rig.add(ring);
  const M = new THREE.Matrix4();
  st.pickFallback = (x, y) => {
    M.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(rig.matrixWorld);
    const e = M.elements; let best = -1, bd = (st.touch ? 22 : 11) ** 2;
    for (let i = 0; i < n; i++) {
      if (!vis[i]) continue;
      const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
      const w = e[3] * px + e[7] * py + e[11] * pz + e[15]; if (w <= 0) continue;
      const sx = ((e[0] * px + e[4] * py + e[8] * pz + e[12]) / w * 0.5 + 0.5) * st.w;
      const sy = (-(e[1] * px + e[5] * py + e[9] * pz + e[13]) / w * 0.5 + 0.5) * st.h;
      const d2 = (sx - x) * (sx - x) + (sy - y) * (sy - y);
      if (d2 < bd) { bd = d2; best = i; }
    }
    return best < 0 ? null : { pos: V3(P[best * 3], P[best * 3 + 1], P[best * 3 + 2]), data: { i: best } };
  };
  st.onHover = it => {
    if (it) { const i = it.data.i; ring.position.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); ring.scale.setScalar(data.bad[i] ? 0.085 : 0.07); ring.visible = true; }
    else ring.visible = false;
    st.dirty = true;
  };
  const names = data.decNames || ['Auto-approve', 'Manual review', 'Decline'];
  st.tipHTML = d => {
    const i = d.i, info = data.info ? data.info(i) : {};
    const dec = state.dec ? state.dec[i] : 0;
    return `<b>${esc(info.id || 'Loan ' + (i + 1))}${info.purpose ? ' · ' + esc(info.purpose) : ''}</b>` +
      `<span class="px3d-big">${esc(names[dec])}</span>` +
      `<span class="px3d-sub">FICO ${data.fico[i]} · DTI ${(data.dti10[i] / 10).toFixed(1)}% · predicted risk ${(data.risk[i] / 10).toFixed(1)}%</span>` +
      `<span class="px3d-sub">${data.bad[i] ? 'Not fully paid' : 'Paid in full'}</span>`;
  };

  const setCam = () => fit(camera, st.w / st.h, V3(-W / 2 - 0.1, 0, -D / 2 - 0.1), V3(W / 2 + 1.05, H + 0.35, D / 2 + 0.45), 0.34, [-0.68, -0.42, -0.16], { x: 0.92 });
  st.onResize = setCam; st.resize();
  st.yaw = -0.42; st.pitch = 0.02;
  st.onFrame = t => {
    if (placeRules()) st.dirty = true;
    if (!st.drag && !st.hover && t) st.yaw += ((-0.42 + Math.sin(t * 0.08) * 0.26) - st.yaw) * 0.012;
  };

  paintPoints(); paintPlanes(); placeRules(true);
  st.start();
  return {
    stage: st, backend: st.backend,
    update: d => { state = Object.assign({}, state, d || {}); paintPoints(); st.dirty = true; },
    setTheme: t => { theme = themeOf(t); applyTheme(st, theme); Lt.setTheme(theme); fl.setTheme(theme); recolor(walls, theme.line, theme.dark ? 0.2 : 0.28); recolor(ring, theme.ink); paintPoints(); paintPlanes(); },
    destroy: () => st.destroy(),
    setPaused: p => { st.reduced = !!p; st.dirty = true; }
  };
}
