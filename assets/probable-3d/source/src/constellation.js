/* AI Strategy Lab: the use-case pipeline as a 3D constellation. Each use case is a sphere placed by value (left to
   right) and feasibility (front to back) and lifted to its score, so the weights the reader sets raise or sink it.
   Glass planes mark the 60-point (Plan next) and 70-point (Pilot now) bars; sphere size is the hours a year it
   frees up; a stem drops each sphere to its spot on the floor. */
import { Stage, THREE } from './stage.js';
import { uniform } from 'three/tsl';
import { esc, ease, nf, themeOf, applyTheme, segments, recolor, floor, fit, lights, markColor } from './common.js';

const S = 1.2, HY = 0.032, E = 2.85;                 // world units per rating step, per score point; plane half-size
const xOf = v => (v - 3) * S;                        // value: left to right
const zOf = f => (3 - f) * S;                        // feasibility: more feasible toward the back
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const TIERS = ['now', 'next', 'later'];

export async function constellation(el, data, opts) {
  let theme = themeOf(opts.theme);
  const st = await new Stage(el, Object.assign({ fov: 34, bg: theme.bg, limits: { yaw: [-1.0, 1.0], pitch: [-0.16, 0.34], wrapYaw: false }, bloom: { strength: 0.5, radius: 0.38, threshold: 0.42 } }, opts)).init();
  const { scene, rig, camera } = st;
  applyTheme(st, theme);
  const Lt = lights(scene, theme);

  const fl = floor(E * 2, E * 2, 4, 4, theme, 4 * S, 4 * S); rig.add(fl);

  /* score planes */
  function plane(score, tierKey, opacity) {
    const g = new THREE.Group(); g.position.y = score * HY;
    const m = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(theme.tiers[tierKey]), transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(E * 2, E * 2), m); p.rotation.x = -Math.PI / 2; p.renderOrder = 2; g.add(p);
    const edge = segments([V3(-E, 0, -E), V3(E, 0, -E), V3(E, 0, -E), V3(E, 0, E), V3(E, 0, E), V3(-E, 0, E), V3(-E, 0, E), V3(-E, 0, -E)], theme.tiers[tierKey], 0.55);
    g.add(edge); rig.add(g);
    g.setTheme = t => { recolor(p, t.tiers[tierKey], opacity * (t.dark ? 1 : 1.2)); recolor(edge, t.tiers[tierKey], t.dark ? 0.6 : 0.75); };
    return g;
  }
  const pNow = plane(70, 'now', 0.045), pNext = plane(60, 'next', 0.022);

  /* labels that never change */
  const lab = (text, cls, pos, extra) => { const e = st.label(text, cls); st.labels.push(Object.assign({ el: e, pos }, extra || {})); return e; };
  for (let v = 1; v <= 5; v++) lab(String(v), 'px3d-tick', V3(xOf(v), 0, E + 0.28));
  lab('Value →', 'px3d-tick px3d-axis', V3(0, 0, E + 0.72));
  for (let f = 1; f <= 5; f++) lab(String(f), 'px3d-tick px3d-y', V3(-E - 0.2, 0, zOf(f)));
  lab('Feasibility →', 'px3d-tick px3d-axis px3d-y', V3(-E - 0.7, 0, 0));
  lab((data.tierNames && data.tierNames.now || 'Pilot now') + ' · 70+', 'px3d-tick px3d-plane now', V3(E, 70 * HY, E), { dx: 6 });
  lab((data.tierNames && data.tierNames.next || 'Plan next') + ' · 60+', 'px3d-tick px3d-plane next', V3(E, 60 * HY, E), { dx: 6 });

  /* spheres, stems and floor spots */
  const geo = new THREE.SphereGeometry(1, 36, 24), spotGeo = new THREE.CircleGeometry(1, 28);
  let balls = [], stems = null, names = [], born = performance.now(), hMax = 1;
  const stemMat = new THREE.LineBasicNodeMaterial({ color: new THREE.Color(theme.line), transparent: true, opacity: 0.6, depthWrite: false });

  function layout(items) {
    // use cases that share a value/feasibility cell sit on a small ring around it
    const cells = {};
    items.forEach(u => { const k = u.v + ':' + u.f; (cells[k] || (cells[k] = [])).push(u); });
    const pos = {};
    for (const k in cells) {
      const L = cells[k];
      L.forEach((u, i) => {
        const a = L.length > 1 ? (i / L.length) * Math.PI * 2 + 0.6 : 0, rr = L.length > 1 ? 0.3 : 0;
        pos[u.id] = [xOf(u.v) + Math.cos(a) * rr, zOf(u.f) + Math.sin(a) * rr];
      });
    }
    return pos;
  }

  function build(d) {
    for (const b of balls) { rig.remove(b.mesh); rig.remove(b.spot); b.mesh.material.dispose(); b.spot.material.dispose(); }
    if (stems) { rig.remove(stems); stems.geometry.dispose(); }
    for (const n of names) n.el.remove();
    st.labels = st.labels.filter(l => !names.includes(l)); names = [];
    const items = (d && d.items) || [];
    hMax = Math.max(1, ...items.map(u => u.h || 0));
    const P = layout(items);
    balls = items.map(u => {
      const col = markColor(new THREE.Color(), theme.tiers[u.t] || theme.tiers.later, theme, 0.14);
      const cU = uniform(col.clone()), gU = uniform(0.3);
      const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.32, metalness: 0.08, transparent: true });
      m.colorNode = cU; m.emissiveNode = cU.mul(gU);
      const mesh = new THREE.Mesh(geo, m);
      const r = 0.1 + 0.2 * Math.sqrt((u.h || 0) / hMax);
      const [x, z] = P[u.id];
      mesh.scale.setScalar(r); mesh.position.set(x, 0, z); rig.add(mesh);
      const sm = new THREE.MeshBasicNodeMaterial({ color: col.clone(), transparent: true, opacity: 0.45, depthWrite: false });
      const spot = new THREE.Mesh(spotGeo, sm); spot.rotation.x = -Math.PI / 2; spot.position.set(x, 0.003, z); spot.scale.setScalar(r * 0.75); rig.add(spot);
      return { u, mesh, spot, cU, gU, col, from: col.clone(), to: col.clone(), x, z, r, y: 0, y0: 0, ty: (u.s || 0) * HY, pos: V3(x, 0, z) };
    });
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(balls.length * 6), 3));
    stems = new THREE.LineSegments(sg, stemMat); rig.add(stems);
    st.items = balls.map(b => ({ pos: b.pos, data: b, r: 18 }));
    nameLabels();
    born = performance.now(); paint(); st.dirty = true;
  }

  function nameLabels() {
    for (const n of names) n.el.remove();
    st.labels = st.labels.filter(l => !names.includes(l)); names = [];
    const cap = st.w < 460 ? 0 : st.w < 620 ? 2 : 3;
    balls.filter(b => b.u.t === 'now' && !b.u.dim).sort((a, b) => (b.u.s || 0) - (a.u.s || 0)).slice(0, cap).forEach(b => {
      const e = st.label(b.u.short || b.u.name, 'px3d-glabel');
      const L = { el: e, pos: b.pos, dy: -Math.round(b.r * 60) - 12, group: 'nm', b };
      st.labels.push(L); names.push(L);
    });
  }

  function paint() {        // tier glow, dimming and target colors for the current theme
    for (const b of balls) {
      markColor(b.to, theme.tiers[b.u.t] || theme.tiers.later, theme, 0.14);
      b.gU.value = theme.dark ? (b.u.t === 'now' ? 0.5 : 0.18) : 0.2;
      b.mesh.material.opacity = b.u.dim ? 0.22 : 1;
      b.spot.material.opacity = b.u.dim ? 0.12 : (theme.dark ? 0.42 : 0.5);
    }
  }

  function update(d) {
    const items = (d && d.items) || [];
    if (items.length !== balls.length || items.some((u, i) => u.id !== balls[i].u.id || u.v !== balls[i].u.v || u.f !== balls[i].u.f)) { build(d); return; }
    balls.forEach((b, i) => { b.u = items[i]; b.y0 = b.y; b.ty = (b.u.s || 0) * HY; b.from.copy(b.col); });
    paint(); nameLabels(); born = performance.now(); st.dirty = true;
  }

  function frameBalls() {
    const k = st.reduced ? 1 : ease((performance.now() - born) / 750);
    const a = stems ? stems.geometry.attributes.position.array : null;
    balls.forEach((b, i) => {
      b.y = b.y0 + (b.ty - b.y0) * k;
      b.col.copy(b.from).lerp(b.to, k); b.cU.value.copy(b.col); b.spot.material.color.copy(b.col);
      const hov = st.hover && st.hover.data === b;
      b.mesh.scale.setScalar(b.r * (hov ? 1.25 : 1));
      b.mesh.position.y = b.y; b.pos.set(b.x, b.y, b.z);
      if (a) { a.set([b.x, 0.004, b.z, b.x, Math.max(0.004, b.y), b.z], i * 6); }
    });
    if (stems) stems.geometry.attributes.position.needsUpdate = true;
    return k < 1;
  }

  const setCam = () => fit(camera, st.w / st.h, V3(-E - 0.3, 0, -E - 0.3), V3(E + 0.4, 3.45, E + 0.55), 0.4, [-0.6, -0.38, -0.16]);
  st.onResize = () => { setCam(); if (balls.length) nameLabels(); }; st.resize();
  st.yaw = -0.38; st.pitch = 0.02;

  st.onHover = () => { st.dirty = true; };
  st.tipHTML = b => {
    const u = b.u, tn = (data.tierNames || {})[u.t] || u.t;
    return `<b>${esc(u.name)}</b><span class="px3d-big">${Math.round(u.s || 0)}<small> / 100</small></span>` +
      `<span class="px3d-sub">${esc(tn)}${u.dept ? ' · ' + esc(u.dept) : ''}</span>` +
      `<span class="px3d-sub">Value ${u.v}/5 · Feasibility ${u.f}/5 · Risk ${u.r}/5 · Effort ${u.e}/5</span>` +
      (u.h ? `<span class="px3d-sub">About ${nf.format(Math.round(u.h))} hours a year</span>` : '') +
      (opts.pickHint ? `<span class="px3d-hint">${esc(st.touch ? opts.pickHint.touch : opts.pickHint.mouse)}</span>` : '');
  };
  st.onFrame = t => {
    const moving = frameBalls();
    if (moving) st.dirty = true;
    if (!st.drag && !st.hover && t) st.yaw += ((-0.38 + Math.sin(t * 0.09) * 0.22) - st.yaw) * 0.012;
  };

  build(data);
  st.start();
  return {
    stage: st, backend: st.backend,
    update,
    setTheme: t => { theme = themeOf(t); applyTheme(st, theme); Lt.setTheme(theme); fl.setTheme(theme); pNow.setTheme(theme); pNext.setTheme(theme); recolor(stems, theme.line, theme.dark ? 0.55 : 0.7); paint(); for (const b of balls) b.from.copy(b.to); born = 0; st.dirty = true; },
    destroy: () => st.destroy(),
    setPaused: p => { st.reduced = !!p; st.dirty = true; }
  };
}
export { TIERS };
