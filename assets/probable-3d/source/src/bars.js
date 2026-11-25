/* A 3D bar field for the project dashboards: columns run left to right (quarters, months, years), rows run front to
   back (issues, offices × shifts, gift types), and bar height is the measure. Bars are colored either by a
   sequential ramp of their value (one hue, light to dark) or by their row's series color, never both. Heights glide
   when the page's filters change; hover reads any bar. */
import { Stage, THREE } from './stage.js';
import { positionLocal, smoothstep, mix, float, vec3, diffuseColor, uniform } from 'three/tsl';
import { esc, nf, themeOf, applyTheme, floor, fit, lights, markColor } from './common.js';

const HMAX = 2.7;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export async function bars(el, data, opts) {
  let theme = themeOf(opts.theme);
  const st = await new Stage(el, Object.assign({ fov: 30, bg: theme.bg, limits: { yaw: [-0.95, 0.95], pitch: [-0.14, 0.3], wrapYaw: false }, bloom: { strength: 0.42, radius: 0.36, threshold: 0.58 } }, opts)).init();
  const { scene, rig, camera } = st;
  applyTheme(st, theme);
  const Lt = lights(scene, theme);

  const mat = new THREE.MeshStandardNodeMaterial({ roughness: 0.38, metalness: 0.06 });
  // darker toward the floor, full color at the cap: reads as a lit tower without changing the bar's hue
  mat.colorNode = vec3(1, 1, 1).mul(mix(float(0.8), float(1.0), smoothstep(0.0, 1.0, positionLocal.y)));
  const glow = uniform(0.22);
  mat.emissiveNode = diffuseColor.rgb.mul(glow);
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);

  let mesh = null, fl = null, B = [], d = null, layoutKey = '', born = performance.now(), dims = { w: 4, dp: 3, cs: 0.4, rs: 0.6 };
  const dummy = new THREE.Object3D(), tmp = new THREE.Color(), lo = new THREE.Color(), hi = new THREE.Color(), acc = new THREE.Color();
  let labelEls = [];

  function rowZ(r) {                     // rows front to back, with a gap between row groups
    let gaps = 0;
    if (d.groups) for (const g of d.groups) if (r >= g[1] && g[1] > 0) gaps++;
    return r * dims.rs + gaps * dims.rs * 0.55;
  }

  function build() {
    if (mesh) { rig.remove(mesh); mesh.dispose && mesh.dispose(); }
    if (fl) rig.remove(fl);
    for (const L of labelEls) L.el.remove();
    st.labels = st.labels.filter(l => !labelEls.includes(l)); labelEls = [];
    const R = d.rows.length, C = d.cols.length;
    const cs = Math.min(0.62, Math.max(0.24, 8.2 / C)), rs = Math.min(0.95, Math.max(0.34, 5.2 / Math.max(3, R + (d.groups ? d.groups.length * 0.55 : 0))));
    dims = { cs, rs, w: 0, dp: 0 };
    const zLast = rowZ(R - 1);
    dims.w = (C - 1) * cs; dims.dp = zLast;
    const x0 = -dims.w / 2, z0 = dims.dp / 2;                       // first row at the front
    mesh = new THREE.InstancedMesh(box, mat, R * C);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(R * C * 3), 3);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
    rig.add(mesh);
    B = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      B.push({ r, c, x: x0 + c * cs, z: z0 - rowZ(r), h: 0, h0: 0, th: 0, v: 0, pos: V3(0, 0, 0) });
    }
    fl = floor(dims.w + cs * 1.6, dims.dp + rs * 1.6, Math.max(1, Math.round(C / (d.colEvery || 1))), Math.max(1, R), theme, dims.w + cs, dims.dp + rs);
    rig.add(fl);
    // labels: every k-th column along the front, each row along the right edge, groups along the left
    const lab = (text, cls, pos, extra) => { const e = st.label(text, cls); const L = Object.assign({ el: e, pos }, extra || {}); st.labels.push(L); labelEls.push(L); return L; };
    const every = d.colEvery || Math.ceil(C / 8);
    for (let c = 0; c < C; c += every) lab(d.colShort ? d.colShort[c] : d.cols[c], 'px3d-tick', V3(x0 + c * cs, 0, z0 + rs * 0.75));
    if (d.xTitle) lab(d.xTitle, 'px3d-tick px3d-axis px3d-y', V3(x0 - cs * 0.9, 0, z0 + rs * 0.75));
    if (d.rowLabels !== false && st.w >= 460) for (let r = 0; r < R; r += (d.rowEvery || 1)) lab(d.rowShort ? d.rowShort[r] : d.rows[r], 'px3d-tick px3d-y2 px3d-row', V3(x0 + dims.w + cs * 0.7, 0, z0 - rowZ(r)));
    if (d.groups) for (const g of d.groups) lab(g[0], 'px3d-tick px3d-y px3d-grp', V3(x0 - cs * 0.8, 0, z0 - (rowZ(g[1]) + rowZ(g[2])) / 2));
    notes = [];
    for (const nt of d.notes || []) { const L = lab(nt.text, 'px3d-glabel px3d-note', V3(0, 0, 0), { group: 'note' }); notes.push({ L, nt }); }
    setCam();
  }
  let notes = [];

  function setValues() {
    const R = d.rows.length, C = d.cols.length;
    // an optional cap keeps one outlier from flattening the rest: capped bars stop at the top and carry a note
    const max = d.capAt > 0 ? d.capAt : Math.max(1e-9, ...d.v.map(x => (isFinite(x) ? x : 0)));
    for (const b of B) {
      const v = d.v[b.r * C + b.c]; b.v = isFinite(v) ? v : 0;
      b.h0 = b.h; b.th = Math.max(0.012, HMAX * Math.min(1, b.v / max));
    }
    born = performance.now();
    paint();
  }

  function paint() {
    if (!mesh) return;
    const C = d.cols.length, ic = mesh.instanceColor.array;
    const max = d.capAt > 0 ? d.capAt : Math.max(1e-9, ...B.map(b => b.v));
    lo.set(theme.seq ? theme.seq[0] : theme.series[0]); hi.set(theme.seq ? theme.seq[1] : theme.series[0]); acc.set(theme.accent);
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if ((d.hiCol != null && d.hiCol >= 0 && b.c === d.hiCol) || (d.hiRow != null && d.hiRow >= 0 && b.r === d.hiRow)) tmp.copy(acc);
      else if (d.rowColor) markColor(tmp, theme.series[d.rowColor[b.r] % theme.series.length], theme);
      else tmp.copy(lo).lerp(hi, Math.pow(Math.min(1, b.v / max), 0.7));
      if (d.dimRow && d.dimRow[b.r]) tmp.lerp(new THREE.Color(theme.bg), 0.7);
      ic[i * 3] = tmp.r; ic[i * 3 + 1] = tmp.g; ic[i * 3 + 2] = tmp.b;
    }
    mesh.instanceColor.needsUpdate = true;
    glow.value = theme.dark ? 0.22 : 0.05;
    st.dirty = true;
  }

  function frameBars() {
    if (!mesh) return false;
    const now = performance.now(); let moving = false;
    const C = d.cols.length, bw = dims.cs * 0.74, bd = dims.rs * 0.66;
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      const k = st.reduced ? 1 : Math.min(1, Math.max(0, (now - born - b.c * 14 - b.r * 22) / 650)), e = 1 - Math.pow(1 - k, 3);
      if (k < 1) moving = true;
      b.h = b.h0 + (b.th - b.h0) * e;
      const hov = st.hover && st.hover.data === b;
      dummy.position.set(b.x, 0, b.z); dummy.scale.set(bw * (hov ? 1.18 : 1), b.h, bd * (hov ? 1.18 : 1)); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      b.pos.set(b.x, b.h, b.z);
    }
    mesh.instanceMatrix.needsUpdate = true;
    for (const { L, nt } of notes) { const b = B[nt.r * C + nt.c]; if (b) L.pos.set(b.x, b.h + 0.12, b.z); }
    return moving;
  }

  function setCam() { const rl = d && d.rowLabels !== false && st.w >= 460 ? (d.rowRoom || 1.4) : 0.3; fit(camera, st.w / st.h, V3(-dims.w / 2 - dims.cs * 1.2, 0, -dims.dp / 2 - dims.rs * 0.6), V3(dims.w / 2 + dims.cs * 0.6 + rl, HMAX + 0.3, dims.dp / 2 + dims.rs * 1.1), d && d.tilt != null ? d.tilt : 0.5, [-0.54, -0.36, -0.18]); }

  function apply(nd, force) {
    const key = nd.rows.join('|') + '#' + nd.cols.join('|') + '#' + JSON.stringify(nd.groups || []) + '#' + JSON.stringify(nd.notes || []) + '#' + st.w;
    const prev = d; d = nd;
    if (force || key !== layoutKey || !prev) { layoutKey = key; build(); if (prev) for (const b of B) b.h = 0; }
    setValues();
    st.items = B.map(b => ({ pos: b.pos, data: b, r: Math.max(10, Math.min(22, 900 / B.length)) }));
  }

  st.onResize = () => { if (!d) return; const w = st.w; if (Math.abs((st._lw || 0) - w) > 60 || (st._lw >= 460) !== (w >= 460)) { st._lw = w; apply(d, true); } else setCam(); };
  st.onHover = () => { st.dirty = true; };
  st.tipHTML = b => d.tip ? d.tip(b.r, b.c, b.v) : `<b>${esc(d.rows[b.r])}</b><span class="px3d-big">${esc(d.fmt ? d.fmt(b.v) : nf.format(Math.round(b.v)))}</span><span class="px3d-sub">${esc(d.cols[b.c])}</span>`;
  st.yaw = -0.36; st.pitch = 0.0;
  st.onFrame = t => {
    if (frameBars()) st.dirty = true;
    if (!st.drag && !st.hover && t) st.yaw += ((-0.36 + Math.sin(t * 0.085) * 0.18) - st.yaw) * 0.012;
  };

  st._lw = st.w;
  apply(data, true);
  st.start();
  return {
    stage: st, backend: st.backend,
    update: nd => apply(Object.assign({}, d, nd)),
    setTheme: t => { theme = themeOf(t); applyTheme(st, theme); Lt.setTheme(theme); if (fl) fl.setTheme(theme); paint(); },
    destroy: () => st.destroy(),
    setPaused: p => { st.reduced = !!p; st.dirty = true; }
  };
}
