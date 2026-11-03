/* Atlas Finance market skyline: today's move in the major markets as a row of glowing 3D towers on a glass
   floor. Gains rise in green, losses sink below the glass in red; each tower is labeled with its market and its
   move, and tapping one opens that market's chart. Heights are in percent (the 10-year yield in basis points,
   10 bp to a 1% tower), compressed above 3% so one wild day cannot flatten the rest. */
import { Stage, THREE, clamp } from './stage.js';
import { vec2, vec3, color, mix, smoothstep, oneMinus, positionLocal, sin, abs, time, float, fract, max, uv } from 'three/tsl';

const SP = 1.0, GAP = 0.5, TW = 0.62, K = 0.62;     // spacing, extra gap between groups, tower width, world units per 1%
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UP = new THREE.Color('#22c37a'), DN = new THREE.Color('#ff5b57'), FLAT = new THREE.Color('#8b98ad');
const capOf = w => w < 480 ? 6 : w < 640 ? 8 : w < 900 ? 9 : 12;
const hOf = v => Math.max(0.06, 0.82 * Math.log1p(Math.abs(v))) * (v < 0 ? -1 : 1);   // log scale: big days stay big without flattening the rest

function towerGeo() {                                 // a bevelled box with its base at y = 0 and its cap at y = 1
  const g = new THREE.BoxGeometry(TW, 1, TW, 1, 6, 1); g.translate(0, 0.5, 0); return g;
}

export async function skyline(el, data, opts) {
  const st = await new Stage(el, Object.assign({ fov: 30, bg: opts.bg || '#0c1a22', limits: { yaw: [-0.32, 0.32], pitch: [-0.1, 0.14], wrapYaw: false }, bloom: { strength: 0.55, radius: 0.42, threshold: 0.6 }, tapOpens: true }, opts)).init();
  const { scene, rig, camera } = st;
  const accent = new THREE.Color(opts.accent || '#F2B33D');
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x0a1218, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(-4, 7, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(accent, 0.7); rim.position.set(5, 2, -6); scene.add(rim);

  /* glass floor with a fine grid; losses show through it */
  const floorMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
  {
    const p = uv().mul(vec2(24, 8)), line = v => smoothstep(0.47, 0.5, abs(fract(v).sub(0.5)));
    const grid = max(line(p.x), line(p.y));
    const edge = oneMinus(smoothstep(0.32, 0.5, max(abs(uv().x.sub(0.5)), abs(uv().y.sub(0.5)))));
    floorMat.colorNode = mix(color('#14303d'), color('#6fa3b5'), grid.mul(0.7));
    floorMat.opacityNode = edge.mul(grid.mul(0.16).add(0.4));
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 7), floorMat); floor.rotation.x = -Math.PI / 2; floor.renderOrder = 5; rig.add(floor);
  const zero = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.035), new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: accent, opacity: 0.6 }));
  zero.rotation.x = -Math.PI / 2; zero.position.set(0, 0.003, 0.52); rig.add(zero);

  const geo = towerGeo();
  let towers = [], items = [], shown = [], born = 0, narrow = false, curW = 1, lastCap = 0;

  function matFor(v) {
    const c = Math.abs(v) < 0.05 ? FLAT : v > 0 ? UP : DN;
    const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0.12 });
    const t = positionLocal.y;                                  // 0 at the floor, 1 at the cap
    const base = vec3(c.r, c.g, c.b);
    m.colorNode = mix(base.mul(0.35), base, smoothstep(0.0, 1.0, t));
    m.emissiveNode = base.mul(float(0.1).add(smoothstep(0.8, 1.0, t).mul(0.85)).add(sin(time.mul(1.6)).mul(0.05)));
    return m;
  }
  function build() {
    for (const T of towers) { rig.remove(T.mesh); rig.remove(T.cap); T.mesh.material.dispose(); T.cap.material.dispose(); }
    towers = []; st.clearLabels();
    narrow = st.w < 560;
    const cap = capOf(st.w); lastCap = cap;            // fewer towers on narrow panels so labels never collide
    const pool = items.filter(d => (d.tier || 1) <= (cap >= 12 ? 3 : cap >= 9 ? 2 : 1));
    shown = (cap === 6 ? pool.filter(d => d.core6).concat(pool.filter(d => !d.core6)) : pool).slice(0, cap).sort((a, b) => items.indexOf(a) - items.indexOf(b));
    // x positions with gaps between groups
    let x = 0; const xs = [];
    shown.forEach((d, i) => { if (i && d.grp !== shown[i - 1].grp) x += GAP; xs.push(x); x += SP; });
    const width = x - SP, off = width / 2;
    shown.forEach((d, i) => {
      const px = xs[i] - off, h = hOf(d.v), up = h >= 0;
      const mesh = new THREE.Mesh(geo, matFor(d.v)); mesh.position.set(px, 0, 0);
      if (!up) mesh.rotation.x = Math.PI;                       // grow downward, cap at the bottom
      mesh.scale.set(1, 0.001, 1); rig.add(mesh);
      const capMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const cc = Math.abs(d.v) < 0.05 ? FLAT : up ? UP : DN; capMat.colorNode = vec3(cc.r, cc.g, cc.b).mul(1.6); capMat.opacity = 0.9;
      const cap = new THREE.Mesh(new THREE.PlaneGeometry(TW * 0.92, TW * 0.92), capMat); cap.rotation.x = -Math.PI / 2; cap.renderOrder = 6; rig.add(cap);
      const T = { d, mesh, cap, h, x: px, i };
      // labels: the move at the tip, the market under the row
      T.val = st.label(`${d.v > 0.004 ? '▲' : d.v < -0.004 ? '▼' : '•'} ${d.label}`, 'px3d-sky-val ' + (Math.abs(d.v) < 0.05 ? 'flat' : up ? 'up' : 'dn'));
      T.valPos = new THREE.Vector3(px, h, 0); st.labels.push({ el: T.val, pos: T.valPos, dy: up ? -16 : 6 });
      const nm = st.label(d.short || d.name, 'px3d-tick px3d-sky-name' + (up ? '' : ' above')); st.labels.push({ el: nm, pos: new THREE.Vector3(px, 0, 0.5), dy: up ? 5 : -5 });
      towers.push(T);
    });
    zero.scale.set(width + 1.2, 1, 1); floor.scale.set(Math.max(1, (width + 4) / 20), 1, 1);
    st.items = towers.map(T => ({ pos: new THREE.Vector3(T.x, T.h / 2, 0), data: T.d, r: 22, T }));
    curW = width; fitCam(width); born = performance.now(); st.dirty = true;
  }
  function fitCam(width) {
    const a = st.w / st.h, vf = camera.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * a);
    const maxUp = Math.max(0.8, ...towers.map(T => T.h)), maxDn = Math.max(0.5, ...towers.map(T => -T.h));
    const span = width + 1.5, tall = maxUp + maxDn + 1.7;
    const d = Math.max(span / 2 / Math.tan(hf), tall / 2 / Math.tan(vf)) * 1.08 + 1.0;
    const cy = (maxUp - maxDn) / 2;
    camera.position.set(0, cy + d * 0.24, d); camera.lookAt(0, cy, 0);
  }
  let rq = 0;
  st.onResize = () => { fitCam(curW); cancelAnimationFrame(rq); rq = requestAnimationFrame(() => { if (items.length && capOf(st.w) !== lastCap) build(); }); };

  const tmpS = new THREE.Vector3();
  function place(t) {
    const now = performance.now();
    towers.forEach((T, i) => {
      const k = st.reduced ? 1 : clamp((now - born - i * 60) / 900, 0, 1), e = 1 - Math.pow(1 - k, 3);
      const hov = st.hover && st.hover.T === T;
      const h = Math.abs(T.h) * e;
      T.mesh.scale.set(hov ? 1.12 : 1, Math.max(0.001, h), hov ? 1.12 : 1);
      const tipY = (T.h >= 0 ? h : -h);
      T.cap.position.set(T.x, tipY + (T.h >= 0 ? 0.004 : -0.004), 0);
      T.cap.material.opacity = 0.55 + (t ? Math.sin(t * 2 + i) * 0.15 : 0) + (hov ? 0.3 : 0);
      T.valPos.set(T.x, tipY, 0);
      T.val.style.opacity = String(e);
    });
  }
  st.onFrame = (t) => {
    place(t);
    if (!st.drag && !st.hover && t) st.yaw += (Math.sin(t * 0.12) * 0.12 - st.yaw) * 0.01;
    if (performance.now() - born < 1400) st.dirty = true;
  };
  st.onHover = () => { st.dirty = true; };
  st.tipHTML = d => `<b>${esc(d.name)}</b><span class="px3d-big ${d.v > 0 ? 'up' : d.v < 0 ? 'dn' : ''}">${esc(d.exact || d.label)}</span>${d.last ? `<span class="px3d-sub">${esc(d.last)}</span>` : ''}${d.sub ? `<span class="px3d-sub">${esc(d.sub)}</span>` : ''}<span class="px3d-hint">Tap for the chart</span>`;
  function apply(d) { items = (d && d.items) || []; build(); }
  apply(data);
  st.start();
  return { stage: st, backend: st.backend, update: d => apply(d), destroy: () => st.destroy(), setPaused: p => { st.reduced = !!p; st.dirty = true; } };
}
