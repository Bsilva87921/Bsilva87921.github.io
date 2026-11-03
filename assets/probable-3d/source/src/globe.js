/* Atlas Economics data globe: land as a field of dots, each economy a light spike whose height and
   color show the selected indicator (diverging around a neutral value), an atmosphere rim, slow spin,
   drag to turn, hover for the number, tap to open the country. */
import { Stage, THREE, clamp } from './stage.js';
import { positionLocal, positionViewDirection, normalView, vec3, float, mix, smoothstep, oneMinus, abs, dot, pow, color, instanceIndex, hash, sin, time, uv } from 'three/tsl';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const D2R = Math.PI / 180;
function ll(lat, lon, r, out) {           // y up, lon 0 facing +z
  const la = lat * D2R, lo = lon * D2R;
  return (out || new THREE.Vector3()).set(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
}

export async function globe(el, data, opts) {
  const st = await new Stage(el, Object.assign({ fov: 30, bg: opts.bg || '#0c1a22', autoSpin: 0.07, limits: { yaw: [-Math.PI, Math.PI], pitch: [-0.55, 0.55], wrapYaw: true }, bloom: { strength: 0.75, radius: 0.45, threshold: 0.5 } }, opts)).init();
  const { scene, rig, camera } = st;
  const accent = new THREE.Color(opts.accent || '#46c2b0');
  camera.position.set(0, 0, 3.75); camera.lookAt(0, 0, 0);
  st.onResize = (w, h) => {            // fit the globe, its spikes and halo in both directions
    const a = w / h, vf = camera.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * a), R = opts.fitRadius || 1.36;
    camera.position.z = Math.max(R / Math.tan(vf), R / Math.tan(hf)) + 0.15; camera.lookAt(0, 0, 0);
  };
  st.resize();
  // start with the user's longitude roughly facing the camera (Atlantic view by default)
  st.yaw = -((opts.centerLon ?? -30) * D2R); st.pitch = 0.32;

  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x081018, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-3, 2, 4); scene.add(key);

  /* globe body */
  const bodyMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.85, metalness: 0.0 });
  const fres = pow(oneMinus(abs(dot(normalView, positionViewDirection))), 2.6);
  bodyMat.colorNode = mix(color('#0f2a3a'), color('#081720'), smoothstep(-1, 1, positionLocal.y).mul(0.6));
  bodyMat.emissiveNode = vec3(accent.r, accent.g, accent.b).mul(fres.mul(0.35));
  rig.add(new THREE.Mesh(new THREE.SphereGeometry(0.995, 72, 48), bodyMat));
  /* atmosphere: a soft halo just outside the silhouette (a disc behind the globe, facing the camera) */
  const atmMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const rr = uv().sub(0.5).length().mul(3.0);                                   // plane is 3 units wide → rr is world radius
  atmMat.colorNode = vec3(accent.r, accent.g, accent.b);
  atmMat.opacityNode = smoothstep(0.985, 1.02, rr).mul(pow(oneMinus(smoothstep(1.0, 1.42, rr)), 2.0)).mul(0.55);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), atmMat); halo.position.z = -0.05; halo.renderOrder = -1; scene.add(halo);
  /* graticule */
  {
    const pts = [];
    for (let lat = -60; lat <= 60; lat += 30) for (let lo = -180; lo < 180; lo += 3) { pts.push(ll(lat, lo, 1.002), ll(lat, lo + 3, 1.002)); }
    for (let lo = -180; lo < 180; lo += 30) for (let la = -84; la < 84; la += 3) { pts.push(ll(la, lo, 1.002), ll(la + 3, lo, 1.002)); }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    rig.add(new THREE.LineSegments(g, new THREE.LineBasicNodeMaterial({ color: new THREE.Color('#2b5068'), transparent: true, opacity: 0.35, depthWrite: false })));
  }

  /* land dots */
  {
    const L = data.land || [], n = Math.floor(L.length / 2);
    const g = new THREE.CircleGeometry(1, 6);
    const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.6, side: THREE.DoubleSide });
    m.colorNode = mix(color('#2f5874'), color('#4f86a6'), hash(instanceIndex));
    m.emissiveNode = color('#123447').mul(0.6);
    const dots = new THREE.InstancedMesh(g, m, Math.max(1, n));
    const M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
    const r = n > 9000 ? 0.0062 : 0.0082;
    for (let i = 0; i < n; i++) {
      ll(L[2 * i], L[2 * i + 1], 1.001, P);
      Q.setFromUnitVectors(Z, P.clone().normalize()); S.set(r, r, r);
      M.compose(P, Q, S); dots.setMatrixAt(i, M);
    }
    dots.count = n; rig.add(dots);
  }

  /* spikes */
  const MAX = 260;
  const spikeGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false); spikeGeo.translate(0, 0.5, 0);
  const spikeMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0.1 });
  spikeMat.emissiveNode = vec3(1, 1, 1).mul(0.0);
  const spikes = new THREE.InstancedMesh(spikeGeo, spikeMat, MAX); spikes.count = 0; spikes.frustumCulled = false; rig.add(spikes);
  const capGeo = new THREE.SphereGeometry(1, 12, 8);
  const capMat = new THREE.MeshBasicNodeMaterial({});
  capMat.colorNode = vec3(1, 1, 1).mul(sin(time.mul(1.6).add(hash(instanceIndex).mul(6.28))).mul(0.15).add(1.15));
  const caps = new THREE.InstancedMesh(capGeo, capMat, MAX); caps.count = 0; caps.frustumCulled = false; rig.add(caps);

  let cur = [], target = [], model = null;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
  const camDir = new THREE.Vector3(), nW = new THREE.Vector3();
  function facing(pos) { nW.copy(pos).normalize().applyQuaternion(rig.quaternion); camDir.copy(camera.position).normalize(); return nW.dot(camDir); }

  function apply(d) {
    model = d || model;
    const m = model.metric || {}, cs = (model.countries || []).filter(c => isFinite(c.value) && isFinite(c.lat)).slice(0, MAX);
    const center = m.center ?? 0;
    const devs = cs.map(c => Math.abs(c.value - center)).sort((a, b) => a - b);
    const cap = m.cap || devs[Math.floor(devs.length * 0.95)] || 1;
    const pos = new THREE.Color(m.pos || '#5cc8ff'), neg = new THREE.Color(m.neg || '#ff7a59'), mid = new THREE.Color('#9fb3c2');
    const prev = new Map(cur.map(c => [c.iso, c.h]));
    target = cs.map(c => {
      const dv = c.value - center, k = clamp(Math.abs(dv) / cap, 0, 1);
      const h = 0.03 + 0.3 * Math.pow(k, 0.85);
      const col = mid.clone().lerp(dv >= 0 ? pos : neg, clamp(0.35 + k * 0.9, 0, 1));
      return { c, h, col, base: ll(c.lat, c.lon, 1.0), h0: prev.get(c.c ? c.c.iso : c.iso) ?? 0.02, iso: c.iso };
    });
    cur = target.map(t => ({ iso: t.c.iso, h: t.h0 }));
    spikes.count = caps.count = target.length;
    target.forEach((t, i) => { spikes.setColorAt(i, t.col); C.copy(t.col).multiplyScalar(1.35); caps.setColorAt(i, C); });
    if (spikes.instanceColor) spikes.instanceColor.needsUpdate = true; if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
    // labels for the extremes
    st.clearLabels();
    const top = target.slice().sort((a, b) => Math.abs(b.c.value - center) - Math.abs(a.c.value - center)).slice(0, el.clientWidth < 520 ? 3 : 6);
    for (const t of top) {
      const e = st.label(t.c.name + ' ' + (t.c.text || t.c.value), 'px3d-glabel');
      const lab = { el: e, pos: new THREE.Vector3(), dy: -10, t };
      lab.hidden = () => facing(lab.pos) < 0.25;
      st.labels.push(lab);
    }
    st.items = target.map(t => { const it = { pos: new THREE.Vector3(), data: t.c, r: 12, t }; it.hidden = () => facing(it.pos) < 0.12; return it; });
    st.dirty = true;
  }

  function place(dt) {
    let moving = false;
    target.forEach((t, i) => {
      const c = cur[i]; const k = 1 - Math.pow(0.0015, dt || 1);
      const nh = c.h + (t.h - c.h) * (dt ? k : 1); if (Math.abs(nh - c.h) > 1e-4) moving = true; c.h = nh;
      const hov = st.hover && st.hover.t === t;
      const n = t.base.clone().normalize();
      Q.setFromUnitVectors(Y, n);
      const w = hov ? 0.013 : 0.0078;
      S.set(w, c.h, w); M.compose(t.base, Q, S); spikes.setMatrixAt(i, M);
      P.copy(n).multiplyScalar(1 + c.h); const cr = hov ? 0.022 : 0.0135; S.set(cr, cr, cr); M.compose(P, Q, S); caps.setMatrixAt(i, M);
      if (st.items[i]) st.items[i].pos.copy(P);
    });
    for (const l of st.labels) if (l.t) { const i = target.indexOf(l.t); if (i >= 0) l.pos.copy(t2(i)); }
    spikes.instanceMatrix.needsUpdate = true; caps.instanceMatrix.needsUpdate = true;
    if (moving) st.dirty = true;
  }
  const t2 = i => { const t = target[i]; return t.base.clone().normalize().multiplyScalar(1 + cur[i].h + 0.02); };

  st.onFrame = (t, dt) => place(dt || 0.016);
  st.onHover = () => { st.dirty = true; };
  st.tipHTML = c => `<b>${esc(c.name)}</b><span class="px3d-big">${esc(c.text || c.value)}</span><span class="px3d-sub">${esc((model.metric && model.metric.label) || '')}${c.rank ? ' · rank ' + esc(c.rank) + ' of ' + esc(c.of) : ''}</span>${opts.onPick ? '<span class="px3d-hint">Tap for the country profile</span>' : ''}`;
  apply(data); place(0);
  st.start();
  return {
    stage: st, backend: st.backend, update: d => apply(d), destroy: () => st.destroy(),
    focus: (lat, lon) => { st.yaw = -lon * D2R; st.pitch = clamp(lat * D2R * 0.8, -0.5, 0.5); st.vyaw = st.vpitch = 0; st.dirty = true; },
    setPaused: p => { st.reduced = !!p; st.dirty = true; }
  };
}
