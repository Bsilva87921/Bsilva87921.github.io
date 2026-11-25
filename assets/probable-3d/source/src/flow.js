/* Alteryx Workflow Lab: a workflow as a 3D pipeline. Each tool is a rounded block in its tool-palette color (In/Out,
   Preparation, Join, Transform, Reporting) at its place on the canvas; records travel the connections as particles,
   more of them where more records flow, and each block shows how many records leave it. */
import { Stage, THREE } from './stage.js';
import { uniform, diffuseColor } from 'three/tsl';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { esc, nf, themeOf, applyTheme, gridFloor, fit, recolor, lights, markColor } from './common.js';

const SX = 1.5, SZ = 1.35, NW = 0.66, NH = 0.36;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const fmtN = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 2).replace(/\.?0+$/, '') + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : nf.format(n);

export async function flow(el, data, opts) {
  let theme = themeOf(opts.theme);
  const st = await new Stage(el, Object.assign({ fov: 32, bg: theme.bg, limits: { yaw: [-0.85, 0.85], pitch: [-0.12, 0.32], wrapYaw: false }, bloom: { strength: 0.6, radius: 0.4, threshold: 0.45 } }, opts)).init();
  const { scene, rig, camera } = st;
  applyTheme(st, theme);
  const Lt = lights(scene, theme);

  const nodeGeo = new RoundedBoxGeometry(NW, NH, NW, 4, 0.1);
  const dotGeo = new THREE.SphereGeometry(1, 12, 8);
  const tubeMat = new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(theme.line), transparent: true, opacity: 0.55, depthWrite: false });
  const dotGlow = uniform(1.1);
  let G = null, N = [], Ecs = [], dots = null, dotInfo = [], labs = [], fl = null, born = performance.now(), bounds = { hx: 3, hz: 1.5 };

  function catColor(cat) { return (theme.cats && theme.cats[cat]) || theme.series[0]; }

  function clear() {
    if (G) { rig.remove(G); G.traverse(o => { if (o.geometry && o.geometry !== nodeGeo && o.geometry !== dotGeo) o.geometry.dispose(); if (o.material && o.material !== tubeMat) o.material.dispose(); }); }
    for (const L of labs) L.el.remove();
    st.labels = st.labels.filter(l => !labs.includes(l)); labs = [];
    N = []; Ecs = []; dotInfo = []; dots = null;
  }

  function build(d) {
    clear();
    G = new THREE.Group(); rig.add(G);
    const nodes = (d && d.nodes) || [];
    if (!nodes.length) return;
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    bounds = { hx: (Math.max(...xs) - Math.min(...xs)) * SX / 2 + NW, hz: (Math.max(...ys) - Math.min(...ys)) * SZ / 2 + NW };
    const byId = {};
    // a single-row workflow bows into a gentle arc so it reads in depth
    const oneRow = ys.every(y => y === ys[0]), x0 = Math.min(...xs), x1 = Math.max(...xs), half = Math.max(1, (x1 - x0) / 2);
    const bow = n => oneRow ? -0.9 * (1 - Math.pow((n.x - (x0 + x1) / 2) / half, 2)) : 0;
    if (oneRow) bounds.hz += 0.45;
    nodes.forEach((n, i) => {
      const cU = uniform(markColor(new THREE.Color(), catColor(n.cat), theme)), gU = uniform(theme.dark ? 0.32 : 0.06);
      const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.3, metalness: 0.1 });
      m.colorNode = cU; m.emissiveNode = cU.mul(gU);
      const mesh = new THREE.Mesh(nodeGeo, m);
      const p = V3((n.x - cx) * SX, NH / 2, (n.y - cy) * SZ + bow(n) + (oneRow ? 0.45 : 0));
      mesh.position.copy(p); G.add(mesh);
      const rec = { n, mesh, cU, gU, p, i, pos: p.clone().setY(NH) };
      N.push(rec); byId[n.id] = rec;
      const L1 = st.label(n.name, 'px3d-tick px3d-node'); const l1 = { el: L1, pos: V3(p.x, 0, p.z + NW * 0.62), group: 'fl', push: 1 }; st.labels.push(l1); labs.push(l1);
      if (n.count != null && (st.w >= 440 || i === 0 || i === nodes.length - 1)) {
        const L2 = st.label(fmtN(n.count), 'px3d-glabel px3d-count'); const l2 = { el: L2, pos: V3(p.x, NH + 0.06, p.z), dy: -6, group: 'fl', push: -1 }; st.labels.push(l2); labs.push(l2);
      }
    });
    // grid lines run between tool columns and rows, so every tool sits in its own cell
    const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
    const gx = [], gz = [];
    for (let k = xmin; k <= xmax + 1; k++) gx.push((k - 0.5 - cx) * SX);
    for (let k = ymin; k <= ymax + 1; k++) gz.push((k - 0.5 - cy) * SZ);
    const zLo = oneRow ? -1.35 : gz[0], zHi = oneRow ? 1.05 : gz[gz.length - 1];
    fl = gridFloor(gx[0], gx[gx.length - 1], zLo, zHi, gx, oneRow ? [zLo, zHi] : gz, theme, 0.3);
    G.add(fl);
    // connections, and the particles that travel them
    const edges = (d.edges || []).filter(e => byId[e[0]] && byId[e[1]]);
    let total = 0;
    edges.forEach(e => {
      const a = byId[e[0]], b = byId[e[1]];
      const A = a.p.clone().add(V3(NW * 0.5, 0, 0)), Bp = b.p.clone().add(V3(-NW * 0.5, 0, 0));
      if (Math.abs(b.p.x - a.p.x) < 0.01) { A.copy(a.p).add(V3(0, 0, Math.sign(b.p.z - a.p.z) * NW * 0.5)); Bp.copy(b.p).add(V3(0, 0, -Math.sign(b.p.z - a.p.z) * NW * 0.5)); }
      const mid = A.clone().lerp(Bp, 0.5); mid.y += 0.28 + A.distanceTo(Bp) * 0.06;
      const curve = new THREE.CatmullRomCurve3([A, A.clone().lerp(mid, 0.5).setY(mid.y * 0.8), mid, Bp.clone().lerp(mid, 0.5).setY(mid.y * 0.8), Bp]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.017, 6, false), tubeMat); G.add(tube);
      const flowN = a.n.count != null ? a.n.count : 1000;
      const k = Math.max(2, Math.min(9, Math.round(2 + Math.log10(flowN + 1) * 1.1)));
      Ecs.push({ curve, a, b, k, start: total }); total += k;
    });
    if (total) {
      const dm = new THREE.MeshStandardNodeMaterial({ roughness: 0.2, metalness: 0 });
      dm.emissiveNode = diffuseColor.rgb.mul(dotGlow);
      dots = new THREE.InstancedMesh(dotGeo, dm, total);
      dots.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3);
      dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage); dots.frustumCulled = false;
      G.add(dots);
      Ecs.forEach(E => { for (let j = 0; j < E.k; j++) dotInfo.push({ E, ph: j / E.k }); });
      paintDots();
    }
    st.items = N.map(r => ({ pos: r.pos, data: r, r: 26 }));
    born = performance.now();
    setCam();
  }

  const tmpC = new THREE.Color();
  function paintDots() {
    dotGlow.value = theme.dark ? 1.1 : 0.15;
    if (!dots) return;
    const ic = dots.instanceColor.array;
    dotInfo.forEach((di, i) => { tmpC.set(catColor(di.E.a.n.cat)); ic[i * 3] = tmpC.r; ic[i * 3 + 1] = tmpC.g; ic[i * 3 + 2] = tmpC.b; });
    dots.instanceColor.needsUpdate = true;
  }

  const dummy = new THREE.Object3D(), P = new THREE.Vector3();
  function frameFlow(t) {
    const now = performance.now();
    N.forEach((r, i) => {
      const k = st.reduced ? 1 : Math.min(1, Math.max(0, (now - born - i * 90) / 600)), e = 1 - Math.pow(1 - k, 3);
      const hov = st.hover && st.hover.data === r;
      r.mesh.scale.setScalar((0.6 + 0.4 * e) * (hov ? 1.12 : 1));
      r.mesh.position.y = NH / 2 + (1 - e) * 0.4;
    });
    if (dots) {
      const speed = st.reduced ? 0 : 0.18;
      dotInfo.forEach((di, i) => {
        const u = ((di.ph + (t || 0) * speed) % 1 + 1) % 1;
        di.E.curve.getPointAt(u, P);
        dummy.position.copy(P); dummy.scale.setScalar(0.034); dummy.updateMatrix();
        dots.setMatrixAt(i, dummy.matrix);
      });
      dots.instanceMatrix.needsUpdate = true;
    }
    return now - born < 1400;
  }

  function setCam() { fit(camera, st.w / st.h, V3(-bounds.hx - 0.2, 0, -bounds.hz - 0.2), V3(bounds.hx + 0.2, 0.9, bounds.hz + 0.45), 0.5, [-0.5, -0.3, -0.1]); }
  st.onResize = () => setCam(); st.resize();
  st.yaw = -0.3; st.pitch = 0.0;
  st.onHover = () => { st.dirty = true; };
  st.tipHTML = r => `<b>${esc(r.n.name)}</b>${r.n.count != null ? `<span class="px3d-big">${nf.format(r.n.count)}<small> records out</small></span>` : ''}${r.n.desc ? `<span class="px3d-sub">${esc(r.n.desc)}</span>` : ''}${r.n.catName ? `<span class="px3d-sub">${esc(r.n.catName)} tool</span>` : ''}`;
  st.onFrame = t => {
    if (frameFlow(t)) st.dirty = true;
    if (!st.drag && !st.hover && t) st.yaw += ((-0.3 + Math.sin(t * 0.1) * 0.2) - st.yaw) * 0.012;
  };

  build(data);
  st.start();
  return {
    stage: st, backend: st.backend,
    update: d => { build(d); st.dirty = true; },
    setTheme: t => {
      theme = themeOf(t); applyTheme(st, theme); Lt.setTheme(theme); recolor({ material: tubeMat }, theme.line, theme.dark ? 0.55 : 0.7);
      N.forEach(r => { markColor(r.cU.value, catColor(r.n.cat), theme); r.gU.value = theme.dark ? 0.32 : 0.06; });
      if (fl) fl.setTheme(theme); paintDots(); st.dirty = true;
    },
    destroy: () => st.destroy(),
    setPaused: p => { st.reduced = !!p; st.dirty = true; }
  };
}
