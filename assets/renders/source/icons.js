// Probable · 3D module renders. Twelve glossy objects, one per Atlas module, lit by a soft studio environment and
// rendered on a transparent background. Built with esbuild against the vendored three.js; driven by render.py.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAND_B64, LAND_N } from './land.js';

const SIZE = +(new URLSearchParams(location.search).get('size') || 1024);
const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
canvas.style.cssText = `width:${SIZE}px;height:${SIZE}px;display:block`;
document.body.appendChild(canvas);
const R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
R.setPixelRatio(1); R.setSize(SIZE, SIZE, false);
R.setClearColor(0x000000, 0);
R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.0;
R.outputColorSpace = THREE.SRGBColorSpace;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.VSMShadowMap;

/* ---------- studio environment: a dark room with softboxes, prefiltered for reflections ---------- */
function studio() {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(26, 16, 26), new THREE.MeshBasicMaterial({ color: 0x1c2027, side: THREE.BackSide }));
  room.position.y = 5; s.add(room);
  const panel = (w, h, pos, k, col = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 1, 0); s.add(m);
  };
  panel(12, 5, [0, 12.5, 1.5], 3.6);              // big top softbox
  panel(3.2, 9, [-12.5, 4, 5], 2.4);              // left strip (key side)
  panel(3.2, 9, [12.5, 4, -2], 1.3, 0xd6e4ff);    // right strip, cool
  panel(14, 2.2, [0, 2.5, -12.5], 1.6);           // back rim
  panel(9, 2.4, [0, 0.6, 12.5], 1.15);            // low front fill
  return s;
}
const pmrem = new THREE.PMREMGenerator(R);
const ENV = pmrem.fromScene(studio(), 0.03).texture;

/* ---------- materials ---------- */
const C = c => new THREE.Color(c);
const gloss = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: C(c), roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, ...o });
const satin = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: C(c), roughness: 0.55, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.45, sheen: 0.5, sheenRoughness: 0.6, sheenColor: C(0xffffff), ...o });
const metal = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: C(c), roughness: 0.22, metalness: 1, clearcoat: 0.6, clearcoatRoughness: 0.18, ...o });
const glow = (c, k = 1.6) => new THREE.MeshBasicMaterial({ color: C(c).multiplyScalar(k) });

/* ---------- geometry helpers ---------- */
function roundedBox(w, h, d, r, seg = 28) {
  r = Math.min(r, w / 2, h / 2, d / 2);
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3(), c = new THREE.Vector3(), dir = new THREE.Vector3();
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, cl = THREE.MathUtils.clamp;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // spread the face vertices towards the edges so the rounded band gets enough of them
    const sx = Math.sign(v.x) * Math.pow(Math.abs(v.x) / (w / 2), 0.55) * (w / 2);
    const sy = Math.sign(v.y) * Math.pow(Math.abs(v.y) / (h / 2), 0.55) * (h / 2);
    const sz = Math.sign(v.z) * Math.pow(Math.abs(v.z) / (d / 2), 0.55) * (d / 2);
    v.set(sx, sy, sz);
    c.set(cl(v.x, -hx, hx), cl(v.y, -hy, hy), cl(v.z, -hz, hz));
    dir.subVectors(v, c); const len = dir.length();
    if (len > 1e-6) { dir.divideScalar(len); v.copy(c).addScaledVector(dir, r); n.setXYZ(i, dir.x, dir.y, dir.z); }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  p.needsUpdate = true; n.needsUpdate = true;
  return g;
}
const lathe = (pts, seg = 96) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
const smooth2 = (pts, n = 64) => new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(n).map(p => [Math.max(0, p.x), p.y]);
function extrude(shape, depth, bevel = 0.04, seg = 6) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: seg, curveSegments: 48 });
  g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g;
}
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const mesh = (g, m, pos = [0, 0, 0], rot = [0, 0, 0], sc = 1) => { const o = new THREE.Mesh(g, m); o.position.set(...pos); o.rotation.set(...rot); o.scale.setScalar(sc); return o; };
function glowSprite(color, size, k = 1) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
  const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128); const c = C(color);
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
  gr.addColorStop(0, `rgba(${rgb},${0.9 * k})`); gr.addColorStop(0.35, `rgba(${rgb},${0.35 * k})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size); return s;
}

/* ---------- the twelve objects ---------- */
const B = {};

B.econ = () => {
  const g = new THREE.Group();
  // dotted continents from the Atlas globe data (Natural Earth, public domain)
  const bin = atob(LAND_B64), a = new Int16Array(LAND_N * 2);
  for (let i = 0; i < a.length; i++) { const lo = bin.charCodeAt(i * 2), hi = bin.charCodeAt(i * 2 + 1); a[i] = (hi << 8 | lo) << 16 >> 16; }
  const W = 4096, H = 2048;
  const mk = (bg, dot) => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, W, H); x.fillStyle = dot;
    for (let i = 0; i < LAND_N; i++) { const lat = a[i * 2] / 100, lon = a[i * 2 + 1] / 100, px = (lon + 180) / 360 * W, py = (90 - lat) / 180 * H, k = 1 / Math.max(0.18, Math.cos(lat * Math.PI / 180));
      x.beginPath(); x.ellipse(px, py, Math.min(6.2 * k, 40), 6.2, 0, 0, Math.PI * 2); x.fill(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const map = mk('#137a84', '#c4fff6'), emi = mk('#000000', '#4ff3dd');
  const earth = mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshPhysicalMaterial({ map, emissiveMap: emi, emissive: C(0xffffff), emissiveIntensity: 0.75, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.08 }));
  earth.rotation.set(0.35, -1.25, 0.12); g.add(earth);
  const ringG = new THREE.TorusGeometry(1.32, 0.024, 24, 256);
  const ring = mesh(ringG, metal(0xdff7f3, { roughness: 0.15 }), [0, 0, 0], [1.28, 0.12, 0.3]); g.add(ring);
  const sat = mesh(new THREE.SphereGeometry(0.075, 32, 24), glow(0x6ff7e6, 2.2)); sat.position.set(1.26, 0.33, 0.24); g.add(sat);
  const halo = glowSprite(0x2ec4b6, 3.6, 0.42); g.add(halo);
  return g;
};

B.fin = () => {
  const g = new THREE.Group();
  g.add(mesh(roundedBox(2.4, 0.16, 1.25, 0.08), gloss(0x222a39, { roughness: 0.4 }), [0, 0.08, 0]));
  const hs = [0.62, 1.05, 0.86, 1.62], cols = [0xf8d27a, 0xf4bd4e, 0xf0a93a, 0xec9322];
  const xs = hs.map((h, i) => -0.84 + i * 0.56);
  hs.forEach((h, i) => g.add(mesh(roundedBox(0.4, h, 0.4, 0.09), gloss(cols[i], { roughness: 0.25 }), [xs[i], 0.16 + h / 2, 0])));
  const pts = [new THREE.Vector3(-1.12, 0.62, 0.38), ...hs.map((h, i) => new THREE.Vector3(xs[i], 0.16 + h + (i === 2 ? 0.34 : 0.22), 0.38)), new THREE.Vector3(1.22, 2.2, 0.38)];
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.4);
  g.add(mesh(new THREE.TubeGeometry(curve, 200, 0.05, 20, false), gloss(0xffffff, { roughness: 0.18 })));
  const end = curve.getPoint(1), tan = curve.getTangent(1);
  const cone = mesh(new THREE.ConeGeometry(0.15, 0.32, 40), gloss(0xffffff, { roughness: 0.18 }));
  cone.position.copy(end).addScaledVector(tan, 0.1); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan); g.add(cone);
  return g;
};

B.comm = () => {
  const g = new THREE.Group();
  // a faceted gem (flat shaded lathe) and an oil drop
  const gemG = lathe([[0, -0.82], [0.62, 0.02], [0.46, 0.3], [0, 0.32]], 8); gemG.computeVertexNormals();
  const gem = mesh(gemG, new THREE.MeshPhysicalMaterial({ color: C(0x6fd2ff), roughness: 0.08, metalness: 0.15, clearcoat: 1, flatShading: true, iridescence: 0.6, iridescenceIOR: 1.6, emissive: C(0x0b5a7a), emissiveIntensity: 0.25 }), [-0.45, 0.82, -0.15], [0.1, 0.4, -0.12]);
  g.add(gem);
  const drop = lathe(smooth2([[0, 0.78], [0.1, 0.56], [0.27, 0.22], [0.38, -0.08], [0.36, -0.32], [0.22, -0.5], [0, -0.55]], 80));
  g.add(mesh(drop, gloss(0x17161c, { roughness: 0.12, clearcoatRoughness: 0.05 }), [0.62, 0.56, 0.35], [0, 0, -0.08]));
  g.add(mesh(new THREE.SphereGeometry(0.16, 40, 30), metal(0xd9873f, { roughness: 0.3 }), [0.05, 0.16, 0.62])); // copper nugget
  return g;
};

B.wx = () => {
  const g = new THREE.Group();
  const sun = mesh(new THREE.SphereGeometry(0.62, 64, 48), new THREE.MeshPhysicalMaterial({ color: C(0xffc53d), emissive: C(0xffa51f), emissiveIntensity: 0.55, roughness: 0.35, clearcoat: 1 }), [0.55, 1.45, -0.55]);
  g.add(sun); g.add(at(glowSprite(0xffb23a, 2.6, 0.5), 0.55, 1.45, -0.7));
  const puffs = [[0, 0.95, 0, 0.62], [-0.62, 0.78, 0.05, 0.46], [0.62, 0.8, 0.02, 0.48], [-0.25, 1.28, -0.05, 0.42], [0.3, 1.25, -0.02, 0.45], [-1.0, 0.62, 0.1, 0.3], [1.02, 0.64, 0.1, 0.32]];
  const geos = puffs.map(([x, y, z, r]) => new THREE.SphereGeometry(r, 64, 48).translate(x, y, z));
  for (const [x, z, r] of [[-0.55, 0.12, 0.4], [0, 0.18, 0.44], [0.55, 0.12, 0.4]]) geos.push(new THREE.SphereGeometry(r, 64, 48).scale(1, 0.75, 1).translate(x, 0.62, z));
  g.add(mesh(mergeGeometries(geos), satin(0xffffff, { roughness: 0.4, clearcoat: 0.5, emissive: C(0x8b97a8), emissiveIntensity: 0.32 })));
  const s = new THREE.Shape(); s.moveTo(0.1, 0.5); s.lineTo(-0.28, -0.05); s.lineTo(-0.02, -0.05); s.lineTo(-0.18, -0.55); s.lineTo(0.3, 0.08); s.lineTo(0.04, 0.08); s.lineTo(0.22, 0.5); s.closePath();
  g.add(mesh(extrude(s, 0.12, 0.03), gloss(0xffd43b, { emissive: C(0xffb000), emissiveIntensity: 0.25 }), [0.05, 0.12, 0.62], [0, 0.25, 0], 0.92));
  return g;
};

B.ag = () => {
  const g = new THREE.Group();
  const pot = lathe(smooth2([[0, 0], [0.5, 0], [0.56, 0.08], [0.66, 0.72], [0.74, 0.76], [0.74, 0.86], [0.6, 0.86], [0.56, 0.78]], 60));
  g.add(mesh(pot, gloss(0xd2693c, { roughness: 0.45, clearcoat: 0.4 })));
  g.add(mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.06, 64), satin(0x3b2a1f, { roughness: 0.9, clearcoat: 0 }), [0, 0.76, 0]));
  const stemCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.76, 0), new THREE.Vector3(0.03, 1.15, 0.02), new THREE.Vector3(-0.02, 1.55, 0), new THREE.Vector3(0.02, 1.85, 0.02)]);
  const green = gloss(0x4fbf5c, { roughness: 0.35 });
  g.add(mesh(new THREE.TubeGeometry(stemCurve, 64, 0.045, 16), green));
  const leaf = new THREE.Shape(); leaf.moveTo(0, 0); leaf.quadraticCurveTo(0.42, 0.34, 0.95, 0.02); leaf.quadraticCurveTo(0.45, -0.22, 0, 0);
  const lg = extrude(leaf, 0.035, 0.03);
  // bend the leaves a little upward along their length
  const p = lg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, p.getZ(i) - 0.22 * x * x); } lg.computeVertexNormals();
  g.add(mesh(lg, gloss(0x5fcf6a, { roughness: 0.3 }), [0.02, 1.55, 0], [0.5, 0.2, 0.45]));
  g.add(mesh(lg, gloss(0x45b553, { roughness: 0.3 }), [-0.02, 1.3, 0], [-0.4, Math.PI + 0.25, 0.35], 0.82));
  g.add(mesh(lg, gloss(0x6bd774, { roughness: 0.3 }), [0.02, 1.84, 0.01], [0.2, 0.9, 1.05], 0.55));
  return g;
};

B.hunger = () => {
  const g = new THREE.Group();
  const outer = lathe(smooth2([[0, 0], [0.42, 0], [0.48, 0.05], [0.86, 0.42], [1.04, 0.78]], 70));
  const inner = lathe(smooth2([[0, 0.12], [0.4, 0.12], [0.8, 0.44], [0.97, 0.76]], 70));
  g.add(mesh(outer, gloss(0xf08a4b, { roughness: 0.3, side: THREE.DoubleSide })));
  g.add(mesh(inner, satin(0xfff3e0, { side: THREE.DoubleSide })));
  g.add(mesh(new THREE.TorusGeometry(1.0, 0.035, 20, 160), gloss(0xf6a26c), [0, 0.775, 0], [Math.PI / 2, 0, 0]));
  // a heap of grain
  const grain = new THREE.CapsuleGeometry(0.046, 0.1, 6, 12), rice = satin(0xfffdf6, { roughness: 0.42, emissive: C(0x4a4236), emissiveIntensity: 0.45 });
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const inst = new THREE.InstancedMesh(grain, rice, 340), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 340; i++) {
    const r = Math.sqrt(rnd()) * 0.86, a = rnd() * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const y = 0.74 + 0.36 * Math.cos(Math.min(1, r / 0.86) * Math.PI / 2) + rnd() * 0.04;
    e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); inst.setMatrixAt(i, m4);
  }
  g.add(inst);
  // a smooth mound under the grains so no dark gaps show between them
  const mound = mesh(new THREE.SphereGeometry(0.86, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), satin(0xf6efe2, { roughness: 0.6, emissive: C(0x3a342b), emissiveIntensity: 0.3 }), [0, 0.7, 0]);
  mound.scale.set(1, 0.42, 1); g.add(mound);
  return g;
};

B.wealth = () => {
  const g = new THREE.Group();
  const coin = lathe([[0, 0], [0.4, 0], [0.43, 0.012], [0.44, 0.05], [0.43, 0.088], [0.4, 0.1], [0.34, 0.1], [0.33, 0.112], [0.31, 0.1], [0, 0.1]], 96);
  const gold = metal(0xf2c14e, { roughness: 0.26 });
  const stacks = [[-0.62, -0.1, 5], [0.12, -0.32, 8], [0.78, 0.1, 3]];
  for (const [x, z, n] of stacks) for (let i = 0; i < n; i++) g.add(mesh(coin, gold, [x + (Math.sin(i * 2.1) * 0.02), i * 0.108, z + Math.cos(i * 1.7) * 0.02], [0, i * 0.7, 0]));
  g.add(mesh(coin, gold, [0.15, 0.42, 0.62], [Math.PI / 2 - 0.35, 0, 0.18]));
  return g;
};

B.tech = () => {
  const g = new THREE.Group();
  g.add(mesh(roundedBox(1.7, 0.24, 1.7, 0.1), gloss(0x2a2350, { roughness: 0.35 }), [0, 0.32, 0]));
  g.add(mesh(roundedBox(0.95, 0.09, 0.95, 0.05), gloss(0x7b6cf6, { roughness: 0.2, emissive: C(0x4b3bd6), emissiveIntensity: 0.25 }), [0, 0.47, 0]));
  g.add(mesh(roundedBox(0.42, 0.04, 0.42, 0.02), glow(0xbdb5ff, 1.4), [0, 0.525, 0]));
  const pin = roundedBox(0.12, 0.06, 0.32, 0.025, 10), gm = metal(0xf2c14e, { roughness: 0.25 });
  for (let i = 0; i < 6; i++) {
    const t = -0.62 + i * 0.248;
    g.add(mesh(pin, gm, [t, 0.24, 0.96])); g.add(mesh(pin, gm, [t, 0.24, -0.96]));
    g.add(mesh(pin, gm, [0.96, 0.24, t], [0, Math.PI / 2, 0])); g.add(mesh(pin, gm, [-0.96, 0.24, t], [0, Math.PI / 2, 0]));
  }
  const trace = gloss(0x9d92ff, { roughness: 0.3 });
  for (const [x, z, w, d] of [[0.62, 0.3, 0.3, 0.035], [0.62, -0.3, 0.3, 0.035], [-0.62, 0.3, 0.3, 0.035], [-0.62, -0.3, 0.3, 0.035], [0.3, 0.62, 0.035, 0.3], [-0.3, 0.62, 0.035, 0.3], [0.3, -0.62, 0.035, 0.3], [-0.3, -0.62, 0.035, 0.3]])
    g.add(mesh(roundedBox(w, 0.02, d, 0.01, 6), trace, [x, 0.445, z]));
  g.add(at(glowSprite(0x7b6cf6, 2.4, 0.35), 0, 0.6, 0));
  return g;
};

B.conflict = () => {
  const g = new THREE.Group(), sh = new THREE.Group();
  const shield = (w, h, r) => { const s = new THREE.Shape(), t = h * 0.5, x = w * 0.5;
    s.moveTo(-x + r, t); s.lineTo(x - r, t); s.quadraticCurveTo(x, t, x, t - r); s.lineTo(x, h * 0.02);
    s.bezierCurveTo(x, -h * 0.26, w * 0.2, -h * 0.4, 0, -t); s.bezierCurveTo(-w * 0.2, -h * 0.4, -x, -h * 0.26, -x, h * 0.02);
    s.lineTo(-x, t - r); s.quadraticCurveTo(-x, t, -x + r, t); return s; };
  sh.add(mesh(extrude(shield(1.5, 1.82, 0.16), 0.24, 0.07, 8), gloss(0x5d7fb5, { roughness: 0.28 })));
  sh.add(mesh(extrude(shield(1.14, 1.42, 0.1), 0.06, 0.03, 6), gloss(0xe6ecf6, { roughness: 0.22, metalness: 0.25 }), [0, 0.02, 0.17]));
  const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.13 : 0.3, a = Math.PI / 2 + i * Math.PI / 5; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? star.lineTo(x, y) : star.moveTo(x, y); } star.closePath();
  sh.add(mesh(extrude(star, 0.06, 0.025), gloss(0x4a6cab, { roughness: 0.25 }), [0, 0.08, 0.25]));
  sh.position.y = 0.98; sh.rotation.y = -0.38; g.add(sh);
  return g;
};

B.pol = () => {
  const g = new THREE.Group();
  g.add(mesh(roundedBox(1.55, 1.08, 1.1, 0.12), gloss(0x3f6fe0, { roughness: 0.28 }), [0, 0.54, 0]));
  g.add(mesh(roundedBox(1.62, 0.12, 1.17, 0.06), gloss(0xeef2fb, { roughness: 0.3 }), [0, 1.1, 0]));
  g.add(mesh(roundedBox(0.78, 0.06, 0.12, 0.03), gloss(0x101626, { roughness: 0.4 }), [0, 1.165, 0]));
  const card = new THREE.Group();
  card.add(mesh(roundedBox(0.66, 0.84, 0.03, 0.03, 10), satin(0xffffff, { roughness: 0.4 })));
  const tick = new THREE.Shape(); tick.moveTo(-0.2, 0.0); tick.lineTo(-0.06, -0.14); tick.lineTo(0.22, 0.18); tick.lineTo(0.16, 0.24); tick.lineTo(-0.06, 0.0); tick.lineTo(-0.14, 0.07); tick.closePath();
  card.add(mesh(extrude(tick, 0.03, 0.012, 3), gloss(0x2fbf71, { roughness: 0.25 }), [0, 0.12, 0.03]));
  card.position.set(0.02, 1.48, 0); card.rotation.set(0, 0.0, 0.06); g.add(card);
  g.add(mesh(roundedBox(0.36, 0.07, 0.04, 0.02, 6), gloss(0xd9e2f5, { roughness: 0.35 }), [0.02, 1.62 + 0.0, 0.035], [0, 0, 0.06]));
  g.rotation.y = -0.42;
  return g;
};

B.health = () => {
  const g = new THREE.Group();
  const plus = new THREE.Shape(), a = 0.2, b = 0.62, r = 0.08;
  plus.moveTo(-a + r, b); plus.lineTo(a - r, b); plus.quadraticCurveTo(a, b, a, b - r); plus.lineTo(a, a); plus.lineTo(b - r, a); plus.quadraticCurveTo(b, a, b, a - r);
  plus.lineTo(b, -a + r); plus.quadraticCurveTo(b, -a, b - r, -a); plus.lineTo(a, -a); plus.lineTo(a, -b + r); plus.quadraticCurveTo(a, -b, a - r, -b);
  plus.lineTo(-a + r, -b); plus.quadraticCurveTo(-a, -b, -a, -b + r); plus.lineTo(-a, -a); plus.lineTo(-b + r, -a); plus.quadraticCurveTo(-b, -a, -b, -a + r);
  plus.lineTo(-b, a - r); plus.quadraticCurveTo(-b, a, -b + r, a); plus.lineTo(-a, a); plus.lineTo(-a, b - r); plus.quadraticCurveTo(-a, b, -a + r, b);
  g.add(mesh(extrude(plus, 0.24, 0.06, 8), gloss(0xef5b6e, { roughness: 0.26 }), [-0.32, 1.12, -0.35], [0, 0.35, 0]));
  const cap = new THREE.Group(), rr = 0.3, L = 0.52;
  const halfA = new THREE.CapsuleGeometry(rr, L, 16, 64); // split the capsule in two coloured halves with clipping-free geometry
  const top = halfA.clone(), bot = halfA.clone();
  const keep = (geo, sign) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (sign * y < 0) p.setY(i, 0); } p.needsUpdate = true; geo.computeVertexNormals(); return geo; };
  cap.add(mesh(keep(top, 1), gloss(0xffffff, { roughness: 0.22 })));
  cap.add(mesh(keep(bot, -1), gloss(0xef5b6e, { roughness: 0.22 })));
  cap.add(mesh(new THREE.TorusGeometry(rr * 0.995, 0.012, 12, 96), gloss(0xd94a5d), [0, 0, 0], [Math.PI / 2, 0, 0]));
  cap.position.set(0.48, 0.52, 0.42); cap.rotation.set(0.25, 0.3, -1.05); g.add(cap);
  return g;
};

B.pulse = () => {
  const g = new THREE.Group();
  const ring = new THREE.TorusGeometry(1.0, 0.17, 48, 240);
  const col = new Float32Array(ring.attributes.position.count * 3), p = ring.attributes.position, ca = C(0x39d0ff), cb = C(0xb061ff), t = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const ang = Math.atan2(p.getY(i), p.getX(i)); t.copy(ca).lerp(cb, (Math.sin(ang + 0.6) + 1) / 2); col.set([t.r, t.g, t.b], i * 3); }
  ring.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.add(mesh(ring, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.18, clearcoat: 1, emissive: C(0x2a2a60), emissiveIntensity: 0.25 }), [0, 1.18, 0], [0.1, -0.35, 0]));
  const wave = [[-1.55, 0], [-0.5, 0], [-0.32, 0.18], [-0.16, -0.62], [0.04, 0.82], [0.22, -0.3], [0.36, 0], [1.55, 0]].map(([x, y]) => new THREE.Vector3(x, 1.18 + y * 0.62, 0.06));
  const curve = new THREE.CatmullRomCurve3(wave, false, 'catmullrom', 0.08);
  g.add(mesh(new THREE.TubeGeometry(curve, 400, 0.04, 16), glow(0xffffff, 1.5), [0, 0, 0], [0, -0.35, 0]));
  g.add(at(glowSprite(0x6fdcff, 3.6, 0.42), 0, 1.18, -0.2));
  g.add(mesh(new THREE.SphereGeometry(0.1, 32, 24), glow(0xffffff, 2), [0.04, 1.18 + 0.82 * 0.62, 0.06]));
  return g;
};

/* ---------- staging: fit, light, shadow, render ---------- */
function stage(build, o = {}) {
  const scene = new THREE.Scene(); scene.environment = ENV; scene.environmentIntensity = o.env ?? 1.0;
  const obj = build();
  obj.traverse(m => { if (m.isMesh || m.isInstancedMesh) { m.castShadow = true; m.receiveShadow = false; } });
  // fit to the solid parts only (glow sprites would make the object look small)
  const box = new THREE.Box3(); obj.updateMatrixWorld(true); obj.traverse(m => { if (m.isMesh || m.isInstancedMesh) box.expandByObject(m, true); });
  const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  obj.position.sub(new THREE.Vector3(ctr.x, box.min.y, ctr.z));
  const holder = new THREE.Group(); holder.add(obj); scene.add(holder);
  holder.updateMatrixWorld(true); const hb = new THREE.Box3(); holder.traverse(m => { if (m.isMesh || m.isInstancedMesh) hb.expandByObject(m, true); });
  const sph = hb.getBoundingSphere(new THREE.Sphere());
  const key = new THREE.DirectionalLight(0xffffff, o.key ?? 1.6); key.position.set(-2.4, 9, 3.4); key.castShadow = o.cast !== false;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 16; key.shadow.blurSamples = 24; key.shadow.bias = -0.0005;
  const sc = key.shadow.camera; sc.left = sc.bottom = -4; sc.right = sc.top = 4; sc.near = 0.5; sc.far = 25; scene.add(key);
  scene.add(new THREE.HemisphereLight(0xe6eeff, 0x2a2622, 0.35));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: o.shadow ?? 0.16 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // soft contact shadow under the object
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'); const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, toneMapped: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.002; blob.scale.set(size.x * 1.25 + 0.4, size.z * 1.25 + 0.4, 1); if (o.blob !== false) scene.add(blob);
  const cam = new THREE.PerspectiveCamera(o.fov ?? 24, 1, 0.1, 100), el = (o.elev ?? 16) * Math.PI / 180;
  const dist = sph.radius / Math.sin(cam.fov * Math.PI / 360) * (o.zoom ?? 1.04);
  cam.position.set(sph.center.x, sph.center.y + Math.sin(el) * dist, sph.center.z + Math.cos(el) * dist); cam.lookAt(sph.center);
  return { scene, cam };
}
const OPTS = { econ: { elev: 10, shadow: 0.0, zoom: 0.86, cast: false }, fin: { shadow: 0.12 }, pulse: { elev: 8, cast: false }, conflict: { elev: 10, zoom: 1.1 }, health: { elev: 14 }, wx: { elev: 10 } };
window.NAMES = Object.keys(B);
window.renderIcon = name => {
  const { scene, cam } = stage(B[name], OPTS[name] || {});
  R.render(scene, cam);
  return canvas.toDataURL('image/png');
};
window.READY = true;
