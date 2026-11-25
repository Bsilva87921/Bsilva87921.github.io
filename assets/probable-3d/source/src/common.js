/* Shared pieces for the portfolio project scenes (AI Strategy Lab, Loan Rules Lab, Home Care, Fundraising, Alteryx,
   Bank Complaints): light/dark theme, floor plate and grid, line helpers, easing and camera fitting.
   A theme is { dark, bg, plate, ink, ink2, line, accent, series: [...] } with colors already chosen for the mode. */
import { THREE } from './stage.js';

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const ease = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
export const nf = new Intl.NumberFormat('en-US');
export const DARK = { dark: true, bg: '#0f1622', plate: '#131d2c', ink: '#e8edf4', ink2: '#a3aebf', line: '#5b6b82', accent: '#d3dceb', series: ['#3987e5', '#d95926', '#199e70'] };
export const LIGHT = { dark: false, bg: '#ffffff', plate: '#f1f3f6', ink: '#16202c', ink2: '#56606e', line: '#8d97a6', accent: '#1f3354', series: ['#2a78d6', '#eb6834', '#1baf7a'] };

export function themeOf(t) { const base = t && t.dark === false ? LIGHT : DARK; return Object.assign({}, base, t || {}); }

/* clear color, bloom (none on light backgrounds, where glow reads as blur) and a class the DOM labels key off */
export function applyTheme(st, t) {
  st.setClear(t.bg);
  st.setBloom(t.dark ? 1 : 0);
  st.el.classList.toggle('px3d-light', !t.dark);
}

export function segments(points, color, opacity) {
  const g = new THREE.BufferGeometry().setFromPoints(points);
  const m = new THREE.LineBasicNodeMaterial({ color: new THREE.Color(color), transparent: true, opacity, depthWrite: false });
  return new THREE.LineSegments(g, m);
}
export function recolor(obj, color, opacity) {
  if (!obj || !obj.material) return;
  obj.material.color.set(color);
  if (opacity != null) obj.material.opacity = opacity;
}

/* a flat plate (w × d) under the data with a light grid of nx × nz cells over gw × gd (default: the whole plate) */
export function floor(w, d, nx, nz, theme, gw, gd) {
  gw = gw || w; gd = gd || d;
  const grp = new THREE.Group();
  const plateMat = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(theme.plate), transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(w, d), plateMat); plate.rotation.x = -Math.PI / 2; plate.position.y = -0.004; plate.renderOrder = -2;
  grp.add(plate);
  const pts = [];
  for (let i = 0; i <= nx; i++) { const x = -gw / 2 + gw * i / nx; pts.push(new THREE.Vector3(x, 0, -gd / 2), new THREE.Vector3(x, 0, gd / 2)); }
  for (let j = 0; j <= nz; j++) { const z = -gd / 2 + gd * j / nz; pts.push(new THREE.Vector3(-gw / 2, 0, z), new THREE.Vector3(gw / 2, 0, z)); }
  const grid = segments(pts, theme.line, theme.dark ? 0.22 : 0.3); grid.renderOrder = -1; grp.add(grid);
  grp.userData = { plate, grid };
  grp.setTheme = t => { recolor(plate, t.plate); recolor(grid, t.line, t.dark ? 0.22 : 0.3); };
  return grp;
}

/* place the camera so the box (min..max) stays inside the panel for every yaw the scene swings through: a short
   bisection on the distance, testing the box corners in normalized device coordinates. Top and bottom margins
   leave room for the caption and legend that sit over the canvas. */
const _c = [], _p = new THREE.Vector3(), _r = new THREE.Matrix4();
for (let i = 0; i < 8; i++) _c.push(new THREE.Vector3());
export function fit(camera, aspect, min, max, tilt, yaws, m) {
  m = Object.assign({ x: 0.93, top: 0.78, bottom: 0.82 }, m || {});
  camera.aspect = aspect; camera.updateProjectionMatrix();
  const c0 = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5), c = c0.clone();
  let k = 0; for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) _c[k++].set(x, y, z);
  const place = dist => { camera.position.set(c.x, c.y + dist * Math.sin(tilt), c.z + dist * Math.cos(tilt)); camera.lookAt(c); camera.updateMatrixWorld(true); };
  const ok = dist => {
    place(dist);
    for (const yw of yaws) {
      _r.makeRotationY(yw);
      for (const q of _c) { _p.copy(q).applyMatrix4(_r).project(camera); if (_p.z > 1 || Math.abs(_p.x) > m.x || _p.y > m.top || _p.y < -m.bottom) return false; }
    }
    return true;
  };
  const solve = () => { let lo = 0.3, hi = 120; for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; } place(hi); return hi; };
  // twice: fit, then slide the aim point so the data sits centered at the scene's resting yaw, then fit again
  for (let pass = 0; pass < 2; pass++) {
    const dist = solve();
    _r.makeRotationY(yaws[Math.floor(yaws.length / 2)]);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of _c) { _p.copy(q).applyMatrix4(_r).project(camera); x0 = Math.min(x0, _p.x); x1 = Math.max(x1, _p.x); y0 = Math.min(y0, _p.y); y1 = Math.max(y1, _p.y); }
    const vf = camera.fov * Math.PI / 360, hh = dist * Math.tan(vf), hw = hh * aspect;
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    c.addScaledVector(right, (x0 + x1) / 2 * hw * 0.8).addScaledVector(up, ((y0 + y1) / 2 - (m.top - m.bottom) / 2) * hh * 0.8);
  }
  solve();
}

/* key, fill and sky lights that suit both a dark and a light panel */
export function lights(scene, theme) {
  const hemi = new THREE.HemisphereLight(0xf3f6fc, 0x1b2330, 1.25);
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-4, 8, 6);
  const fill = new THREE.DirectionalLight(0xb3c4e0, 0.45); fill.position.set(5, 3, -5);
  scene.add(hemi, key, fill);
  const set = t => {
    hemi.groundColor.set(t.dark ? '#1b2330' : '#b4bdca'); hemi.intensity = t.dark ? 1.25 : 1.55;
    key.intensity = t.dark ? 1.5 : 1.25; fill.intensity = t.dark ? 0.45 : 0.6;
  };
  set(theme);
  return { setTheme: set };
}

/* marks read a touch lighter on a light panel, where full-strength dark hues look heavy once shaded */
const WHITE = new THREE.Color('#ffffff');
export function markColor(out, hex, theme, k) { out.set(hex); if (!theme.dark) out.lerp(WHITE, k == null ? 0.16 : k); return out; }

export function lerpColor(out, a, b, k) { return out.copy(a).lerp(b, k); }

/* a plate spanning x0..x1 × z0..z1 (plus a margin) with grid lines exactly at the given x and z positions, so the
   grid lines up with the data's own scale: ticks, bar boundaries or tool columns */
export function gridFloor(x0, x1, z0, z1, xs, zs, theme, margin) {
  const m = margin == null ? 0.25 : margin, grp = new THREE.Group();
  const plateMat = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(theme.plate), transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 2 * m, z1 - z0 + 2 * m), plateMat);
  plate.rotation.x = -Math.PI / 2; plate.position.set((x0 + x1) / 2, -0.004, (z0 + z1) / 2); plate.renderOrder = -2; grp.add(plate);
  const pts = [];
  for (const x of xs) pts.push(new THREE.Vector3(x, 0, z0), new THREE.Vector3(x, 0, z1));
  for (const z of zs) pts.push(new THREE.Vector3(x0, 0, z), new THREE.Vector3(x1, 0, z));
  const grid = segments(pts, theme.line, theme.dark ? 0.24 : 0.32); grid.renderOrder = -1; grp.add(grid);
  grp.setTheme = t => { recolor(plate, t.plate); recolor(grid, t.line, t.dark ? 0.24 : 0.32); };
  return grp;
}
