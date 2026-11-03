/* Atlas Finance yield-curve terrain: the US Treasury curve every month since 1990 as one surface
   (time left to right, maturity front to back, height = yield). Inverted months (10-year below
   3-month) are tinted; today's curve glows at the front; hover reads any month and maturity and
   draws that month's whole curve. */
import { Stage, THREE, clamp } from './stage.js';
import { vec3, color, mix, attribute, float } from 'three/tsl';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const W = 9.2, D = 3.4, HY = 0.2, SUB = 4;   // width (time), depth (maturity), height per percentage point, sub-steps between maturities
const STOPS = [[0, '#1d2a5c'], [1.5, '#22508c'], [3, '#1f8aa0'], [4.5, '#36b98f'], [6, '#a9d35c'], [8, '#f6d860']];   // one direction of lightness: low yields dark, high yields bright
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function ramp(y, out) {
  if (y <= STOPS[0][0]) return out.set(STOPS[0][1]);
  for (let i = 1; i < STOPS.length; i++) if (y <= STOPS[i][0]) { const [y0, c0] = STOPS[i - 1], [y1, c1] = STOPS[i]; tmpA.set(c0); tmpB.set(c1); return out.copy(tmpA).lerp(tmpB, (y - y0) / (y1 - y0)); }
  return out.set(STOPS[STOPS.length - 1][1]);
}

export async function surface(el, data, opts) {
  const st = await new Stage(el, Object.assign({ fov: 32, bg: opts.bg || '#0c1a22', limits: { yaw: [-1.25, 0.95], pitch: [-0.22, 0.32], wrapYaw: false }, bloom: { strength: 0.6, radius: 0.4, threshold: 0.62 } }, opts)).init();
  const { scene, rig, camera } = st;
  const accent = new THREE.Color(opts.accent || '#F2B33D');
  const setCam = a => { const far = a < 1.1 ? 1.55 : a < 1.6 ? 1.22 : 1; camera.position.set(1.6 * far, 3.7 * far, 9.4 * far); camera.lookAt(0, 0.5, 0); };
  st.onResize = (w, h) => setCam(w / h); st.resize();
  st.yaw = -0.18; st.pitch = 0.02;

  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x0a1218, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-4, 7, 5); scene.add(key);
  const back = new THREE.DirectionalLight(accent, 0.6); back.position.set(4, 2, -6); scene.add(back);

  const dates = data.dates, mats = data.mats, R = dates.length, C0 = mats.length;
  const C = (C0 - 1) * SUB + 1;
  const val = (r, c) => data.z[r * C0 + c];
  // fill gaps in each row across maturities (linear), then down the column for leading gaps
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C0; c++) if (!isFinite(val(r, c))) {
      let a = c - 1; while (a >= 0 && !isFinite(val(r, a))) a--;
      let b = c + 1; while (b < C0 && !isFinite(val(r, b))) b++;
      const v = a >= 0 && b < C0 ? val(r, a) + (val(r, b) - val(r, a)) * (c - a) / (b - a) : a >= 0 ? val(r, a) : b < C0 ? val(r, b) : 0;
      data.z[r * C0 + c] = v; (data.filled || (data.filled = new Set())).add(r * C0 + c);
    }
  }
  const xOf = r => -W / 2 + W * r / Math.max(1, R - 1);
  const zOf = cf => D / 2 - D * cf / Math.max(1, C - 1);          // short maturities in front, long end at the back
  const inv = new Uint8Array(R);
  const i10 = mats.findIndex(m => m.label === '10Y'), i3 = mats.findIndex(m => m.label === '3M');
  for (let r = 0; r < R; r++) inv[r] = i10 >= 0 && i3 >= 0 && val(r, i10) < val(r, i3) ? 1 : 0;
  const yAt = (r, cf) => { const c = cf / SUB, a = Math.floor(c), b = Math.min(C0 - 1, a + 1), f = c - a; return val(r, a) * (1 - f) + val(r, b) * f; };

  /* surface mesh */
  const pos = new Float32Array(R * C * 3), col = new Float32Array(R * C * 3), idx = [];
  const cc = new THREE.Color();
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const i = r * C + c, y = yAt(r, c);
    pos[i * 3] = xOf(r); pos[i * 3 + 1] = Math.max(0, y) * HY; pos[i * 3 + 2] = zOf(c);
    ramp(y, cc);
    col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
  }
  for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) { const a = r * C + c, b = a + C; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });
  mat.colorNode = attribute('color', 'vec3');
  mat.emissiveNode = attribute('color', 'vec3').mul(0.22);
  const surf = new THREE.Mesh(g, mat); rig.add(surf);

  /* contour lines: each maturity along time, and every 5 years across maturities */
  {
    const seg = [];
    const P = (r, c, lift) => new THREE.Vector3(xOf(r), Math.max(0, yAt(r, c)) * HY + (lift || 0.006), zOf(c));
    for (let m = 0; m < C0; m++) { const c = m * SUB; for (let r = 0; r < R - 1; r++) seg.push(P(r, c), P(r + 1, c)); }
    for (let r = 0; r < R; r++) { const d = String(dates[r]); if (!/-01$/.test(d) || +d.slice(0, 4) % 5) continue; for (let c = 0; c < C - 1; c++) seg.push(P(r, c, 0.01), P(r, c + 1, 0.01)); }
    const lg = new THREE.BufferGeometry().setFromPoints(seg);
    rig.add(new THREE.LineSegments(lg, new THREE.LineBasicNodeMaterial({ color: new THREE.Color('#ffffff'), transparent: true, opacity: 0.14, depthWrite: false })));
    // floor frame
    const fr = [new THREE.Vector3(-W / 2, 0, -D / 2), new THREE.Vector3(W / 2, 0, -D / 2), new THREE.Vector3(W / 2, 0, -D / 2), new THREE.Vector3(W / 2, 0, D / 2), new THREE.Vector3(W / 2, 0, D / 2), new THREE.Vector3(-W / 2, 0, D / 2), new THREE.Vector3(-W / 2, 0, D / 2), new THREE.Vector3(-W / 2, 0, -D / 2)];
    for (let k = 1; k <= 4; k++) { const y = k * 2 * HY; fr.push(new THREE.Vector3(-W / 2, y, -D / 2), new THREE.Vector3(W / 2, y, -D / 2)); }
    rig.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(fr), new THREE.LineBasicNodeMaterial({ color: new THREE.Color('#5d7f99'), transparent: true, opacity: 0.45, depthWrite: false })));
  }
  /* inverted months: coral bands on the floor under the surface */
  {
    const v = [];
    for (let r = 0; r < R; r++) if (inv[r]) { const x0 = xOf(Math.max(0, r - 0.5)), x1 = xOf(Math.min(R - 1, r + 0.5)); v.push(x0, 0.002, -D / 2, x1, 0.002, -D / 2, x1, 0.002, D / 2, x0, 0.002, -D / 2, x1, 0.002, D / 2, x0, 0.002, D / 2); }
    if (v.length) {
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
      const bm = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color('#ff5d5d'), transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
      rig.add(new THREE.Mesh(bg, bm));
    }
  }
  /* today's curve, glowing */
  {
    const pts = []; for (let c = 0; c < C; c++) pts.push(new THREE.Vector3(xOf(R - 1) + 0.02, Math.max(0, yAt(R - 1, c)) * HY + 0.02, zOf(c)));
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.022, 8, false);
    const tm = new THREE.MeshBasicNodeMaterial({}); tm.colorNode = vec3(accent.r, accent.g, accent.b).mul(1.9);
    rig.add(new THREE.Mesh(tube, tm));
  }
  /* hover: marker + that month's curve */
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicNodeMaterial({ color: new THREE.Color('#ffffff') }));
  marker.visible = false; rig.add(marker);
  const hlGeo = new THREE.BufferGeometry(); hlGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(C * 3), 3));
  const hlMat = new THREE.LineBasicNodeMaterial({ transparent: true, depthWrite: false }); hlMat.colorNode = vec3(1, 1, 1).mul(1.6);
  const hl = new THREE.Line(hlGeo, hlMat); hl.visible = false; rig.add(hl);

  /* labels */
  const lab = (text, cls, v) => { const e = st.label(text, cls); st.labels.push({ el: e, pos: v }); };
  for (let r = 0; r < R; r++) { const d = String(dates[r]); if (/-01$/.test(d) && +d.slice(0, 4) % 10 === 0) lab(d.slice(0, 4), 'px3d-tick', new THREE.Vector3(xOf(r), 0, D / 2 + 0.32)); }
  mats.forEach((m, k) => { if (['3M', '2Y', '10Y', '30Y'].includes(m.label)) lab(m.label, 'px3d-tick', new THREE.Vector3(W / 2 + 0.38, 0, zOf(k * SUB))); });
  lab('Today', 'px3d-now', new THREE.Vector3(xOf(R - 1), Math.max(0, yAt(R - 1, C - 1)) * HY + 0.3, zOf(C - 1)));
  for (let k = 1; k <= 4; k++) lab(2 * k + '%', 'px3d-tick px3d-y2', new THREE.Vector3(W / 2 + 0.12, 2 * k * HY, -D / 2));

  /* picking: ray against the surface */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  st.pickFallback = (x, y) => {
    ndc.set(x / st.w * 2 - 1, -(y / st.h) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(surf, false)[0]; if (!hit) return null;
    const p = surf.worldToLocal(hit.point.clone());
    const r = clamp(Math.round((p.x + W / 2) / W * (R - 1)), 0, R - 1), cf = clamp((D / 2 - p.z) / D * (C - 1), 0, C - 1);
    const m = clamp(Math.round(cf / SUB), 0, C0 - 1);
    return { pos: new THREE.Vector3(xOf(r), Math.max(0, val(r, m)) * HY, zOf(m * SUB)), data: { r, m, date: dates[r], mat: mats[m], y: val(r, m), filled: data.filled && data.filled.has(r * C0 + m), inv: !!inv[r], s10: i10 >= 0 && i3 >= 0 ? val(r, i10) - val(r, i3) : null } };
  };
  st.onHover = it => {
    if (it && it.data && it.data.r != null) {
      marker.position.copy(it.pos); marker.visible = true;
      const a = hlGeo.attributes.position.array; for (let c = 0; c < C; c++) { a[c * 3] = xOf(it.data.r); a[c * 3 + 1] = Math.max(0, yAt(it.data.r, c)) * HY + 0.012; a[c * 3 + 2] = zOf(c); }
      hlGeo.attributes.position.needsUpdate = true; hl.visible = true;
    } else { marker.visible = false; hl.visible = false; }
    st.dirty = true;
  };
  const mon = d => { const [y, m] = String(d).split('-'); return new Date(+y, +m - 1, 1).toLocaleDateString([], { month: 'short', year: 'numeric' }); };
  st.tipHTML = d => `<b>${esc(mon(d.date))} · ${esc(d.mat.name || d.mat.label)}</b><span class="px3d-big">${d.y.toFixed(2)}%</span><span class="px3d-sub">10-year minus 3-month: ${d.s10 == null ? '—' : (d.s10 >= 0 ? '+' : '') + d.s10.toFixed(2) + ' pp'}${d.inv ? ' · inverted' : ''}${d.filled ? ' · estimated' : ''}</span>`;
  st.onFrame = t => { if (!st.drag && !st.hover && t) st.yaw += ((-0.18 + Math.sin(t * 0.08) * 0.22) - st.yaw) * 0.012; };
  st.start();
  return { stage: st, backend: st.backend, destroy: () => st.destroy(), setPaused: p => { st.reduced = !!p; st.dirty = true; } };
}
