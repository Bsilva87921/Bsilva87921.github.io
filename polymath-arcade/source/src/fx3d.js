/* =====================================================================
   Visual engine: living WebGL crystal field, 3D tilt, counters, sigils, transitions
   ===================================================================== */
const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
function hexRgb(str) {
  str = String(str || '').trim();
  if (str[0] === '#') {
    let s = str.slice(1);
    if (s.length === 3) s = s.split('').map(c => c + c).join('');
    const n = parseInt(s.slice(0, 6), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0] / 255, p[1] / 255, p[2] / 255]; }
  return [0.65, 0.55, 1];
}
function quietVT(vt) { if (vt) ['ready', 'finished', 'updateCallbackDone'].forEach(k => vt[k] && vt[k].catch(() => {})); return vt; }
function withVT(fn) {
  if (!document.startViewTransition || reduceMotion()) { fn(); return null; }
  try { return quietVT(document.startViewTransition(fn)); } catch (e) { fn(); return null; }
}

/* ---------- 3D tilt with moving glare ---------- */
function bindTilt(el, max = 14) {
  if (reduceMotion() || (window.matchMedia && matchMedia('(hover: none)').matches)) return;
  let frame = 0, px = 0.5, py = 0.5;
  const apply = () => {
    frame = 0;
    el.style.setProperty('--rx', ((0.5 - py) * max).toFixed(2) + 'deg');
    el.style.setProperty('--ry', ((px - 0.5) * max).toFixed(2) + 'deg');
    el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
  };
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    px = clamp((e.clientX - r.left) / r.width, 0, 1); py = clamp((e.clientY - r.top) / r.height, 0, 1);
    el.classList.add('tilting');
    if (!frame) frame = requestAnimationFrame(apply);
  });
  el.addEventListener('pointerleave', () => {
    cancelAnimationFrame(frame); frame = 0;
    el.classList.remove('tilting');
    el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
  });
}

/* ---------- Animated number ---------- */
function countUp(el, to, fmtFn = v => fmt(Math.round(v)), dur = 1000) {
  if (reduceMotion() || !Number.isFinite(to)) { el.textContent = fmtFn(to); return; }
  const t0 = performance.now();
  const step = now => {
    const f = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - f, 3);
    el.textContent = fmtFn(to * e);
    if (f < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function burstFrom(el, color, n) {
  if (!el || !el.getBoundingClientRect) return;
  const r = el.getBoundingClientRect();
  FX.burstAt(r.left + r.width / 2, r.top + r.height / 2, color || cssVar('--accent'), n);
}

/* ---------- Daily reset countdown + dock indicator ---------- */
let TICKER = 0;
function startTicker() {
  clearInterval(TICKER);
  const upd = () => {
    const els = $$('.count b');
    if (!els.length) return;
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((mid - now) / 1000));
    const txt = [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(v => String(v).padStart(2, '0')).join(':');
    els.forEach(e => { e.textContent = txt; });
  };
  upd(); TICKER = setInterval(upd, 1000);
}
function placeTabInd() {
  const on = $('.tabbar button.on'), ind = $('.tab-ind');
  if (!on || !ind) return;
  ind.style.width = on.offsetWidth + 'px';
  ind.style.transform = `translateX(${on.offsetLeft}px)`;
}

/* ---------- Game sigils (line icons, colored by subject) ---------- */
const SIGILS = {
  memory: '<g fill="none" stroke="currentColor" stroke-width="2.4"><rect x="4" y="4" width="9" height="9" rx="2"/><rect x="15.5" y="4" width="9" height="9" rx="2" fill="currentColor"/><rect x="27" y="4" width="9" height="9" rx="2"/><rect x="4" y="15.5" width="9" height="9" rx="2" fill="currentColor"/><rect x="15.5" y="15.5" width="9" height="9" rx="2"/><rect x="27" y="15.5" width="9" height="9" rx="2"/><rect x="4" y="27" width="9" height="9" rx="2"/><rect x="15.5" y="27" width="9" height="9" rx="2"/><rect x="27" y="27" width="9" height="9" rx="2" fill="currentColor"/></g>',
  clash: '<g stroke="currentColor" stroke-width="2.4"><circle cx="15" cy="20" r="11" fill="none"/><circle cx="25" cy="20" r="11" fill="currentColor" fill-opacity=".35"/></g>',
  pattern: '<g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M7 33v-6M15 33v-12M23 33v-18"/><path d="M32 33V6" stroke-dasharray="3 4"/></g>',
  sprint: '<path d="M23 3L8 23h11l-3 14 16-21H21z" fill="currentColor" fill-opacity=".3" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>',
  target: '<g fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="20" cy="20" r="16"/><circle cx="20" cy="20" r="9.5"/><circle cx="20" cy="20" r="3.5" fill="currentColor"/></g>',
  launch: '<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 33C10 7 28 7 36 33" stroke-dasharray="3 4"/><path d="M2 35h36"/><circle cx="11" cy="17" r="3.5" fill="currentColor"/></g>',
  formula: '<g fill="none" stroke="currentColor" stroke-width="2.2"><ellipse cx="20" cy="20" rx="16" ry="6.5"/><ellipse cx="20" cy="20" rx="16" ry="6.5" transform="rotate(60 20 20)"/><ellipse cx="20" cy="20" rx="16" ry="6.5" transform="rotate(-60 20 20)"/><circle cx="20" cy="20" r="3" fill="currentColor"/></g>',
  estimate: '<g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 30a15 15 0 0 1 30 0"/><path d="M20 30l8-10"/><path d="M9 21l2 1.5M20 15v2.5M31 21l-2 1.5"/><circle cx="20" cy="30" r="2.6" fill="currentColor"/></g>',
  shopper: '<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M21 4h14v14L19 34 5 20z"/><circle cx="28.5" cy="10.5" r="2.4" fill="currentColor"/></g>',
  globe: '<g fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="20" cy="20" r="15"/><ellipse cx="20" cy="20" rx="6.5" ry="15"/><path d="M5 20h30M7.5 12.5h25M7.5 27.5h25"/></g>',
  robot: '<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="8" y="12" width="24" height="19" rx="6"/><path d="M20 12V6"/><circle cx="20" cy="5" r="2.2" fill="currentColor"/><circle cx="15" cy="21.5" r="2.6" fill="currentColor"/><circle cx="25" cy="21.5" r="2.6" fill="currentColor"/><path d="M4 19v6M36 19v6"/></g>',
  tracer: '<g fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 11l-9 9 9 9M27 11l9 9-9 9M23 6l-6 28"/></g>',
  elements: '<g fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 4l13.9 8v16L20 36 6.1 28V12z"/><path d="M20 11l7.8 4.5v9L20 29l-7.8-4.5v-9z" fill="currentColor" fill-opacity=".3"/></g>',
  science: '<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h10M16.5 4v11L7 31.5A3 3 0 0 0 9.6 36h20.8a3 3 0 0 0 2.6-4.5L23.5 15V4"/><path d="M11 26h18" /><circle cx="17" cy="31" r="1.6" fill="currentColor"/><circle cx="23" cy="29" r="1.2" fill="currentColor"/></g>',
  market: '<g stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 6v28M20 3v32M30 10v24"/><rect x="6.5" y="13" width="7" height="13" rx="1.5" fill="currentColor" fill-opacity=".35"/><rect x="16.5" y="8" width="7" height="15" rx="1.5" fill="none"/><rect x="26.5" y="16" width="7" height="10" rx="1.5" fill="currentColor" fill-opacity=".35"/></g>',
  money: '<g fill="none" stroke="currentColor" stroke-width="2.2"><ellipse cx="20" cy="10" rx="12" ry="4.5" fill="currentColor" fill-opacity=".3"/><path d="M8 10v6.5c0 2.5 5.4 4.5 12 4.5s12-2 12-4.5V10M8 16.5V23c0 2.5 5.4 4.5 12 4.5s12-2 12-4.5v-6.5M8 23v6.5c0 2.5 5.4 4.5 12 4.5s12-2 12-4.5V23"/></g>',
  econ: '<g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 7c8 18 17 22 30 25M5 32C16 30 25 21 35 7"/><circle cx="20" cy="21" r="3" fill="currentColor"/></g>',
  tycoon: '<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M5 14h30l-3-8H8z" fill="currentColor" fill-opacity=".3"/><path d="M5 14c0 3 2.6 4.4 5 4.4s5-1.4 5-4.4c0 3 2.6 4.4 5 4.4s5-1.4 5-4.4c0 3 2.6 4.4 5 4.4S35 17 35 14"/><path d="M8 18.5V34h24V18.5M17 34v-8h6v8"/></g>',
  breakeven: '<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 5v29M10 34h20M7 11h26"/><path d="M7 11l-4.5 10h9zM33 11l-4.5 10h9z" fill="currentColor" fill-opacity=".3"/></g>',
  scramble: '<g stroke="currentColor" stroke-width="2.2" fill="none"><rect x="3" y="13" width="11" height="13" rx="2.5" transform="rotate(-8 8.5 19.5)"/><rect x="14.5" y="9" width="11" height="13" rx="2.5" fill="currentColor" fill-opacity=".3"/><rect x="26" y="14" width="11" height="13" rx="2.5" transform="rotate(9 31.5 20.5)"/></g>',
  lexicon: '<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M20 10c-4.5-3.5-10-3.5-15-2v23c5-1.5 10.5-1.5 15 2 4.5-3.5 10-3.5 15-2V8c-5-1.5-10.5-1.5-15 2z"/><path d="M20 10v23"/></g>',
  daily: '<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="20" cy="20" r="7.5" fill="currentColor" fill-opacity=".3"/><path d="M20 3v5M20 32v5M3 20h5M32 20h5M8 8l3.5 3.5M28.5 28.5L32 32M8 32l3.5-3.5M28.5 11.5L32 8"/></g>'
};
const sigilSVG = id => `<svg viewBox="0 0 40 40" aria-hidden="true">${SIGILS[id] || SIGILS.daily}</svg>`;

/* ---------- Living WebGL crystal field ---------- */
const BG3D = (() => {
  const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const PHI = (1 + Math.sqrt(5)) / 2;
  const icoV = [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]].map(norm);
  const icoF = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const tris = (V, F) => F.map(f => f.map(i => V[i]));
  const subdivide = T => T.flatMap(([a, b, c]) => { const ab = norm(mid(a, b)), bc = norm(mid(b, c)), ca = norm(mid(c, a)); return [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]; });
  const tetra = s => tris([[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]].map(v => norm(v).map(x => x * s)), [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]]);
  const SHAPES = {
    ico: () => tris(icoV, icoF),
    geo: () => subdivide(tris(icoV, icoF)),
    octa: () => tris([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]]),
    crystal: () => { const ring = [...Array(6)].map((_, i) => [Math.cos(i * Math.PI / 3) * 0.6, 0, Math.sin(i * Math.PI / 3) * 0.6]); const T = []; for (let i = 0; i < 6; i++) { const a = ring[i], b = ring[(i + 1) % 6]; T.push([[0, 1.4, 0], a, b], [[0, -1.05, 0], b, a]); } return T; },
    star: () => tetra(1.1).concat(tetra(1.1).map(t => t.map(v => [-v[0], -v[1], -v[2]]))),
    tetra: () => tetra(1.2)
  };
  function build(T) {
    const out = [];
    for (const t of T) {
      let [a, b, c] = t;
      const cen = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
      let n = cross(sub(b, a), sub(c, a));
      if (dot(n, cen) < 0) { [b, c] = [c, b]; n = [-n[0], -n[1], -n[2]]; }
      n = norm(n);
      [[a, 1, 0, 0], [b, 0, 1, 0], [c, 0, 0, 1]].forEach(([p, x, y, z]) => out.push(p[0], p[1], p[2], n[0], n[1], n[2], x, y, z));
    }
    return new Float32Array(out);
  }
  const persp = (fovy, aspect, near, far) => { const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far); return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]); };
  const lookAt = (e, c, u) => { const z = norm(sub(e, c)), x = norm(cross(u, z)), y = cross(z, x); return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]); };
  const model = (t, r, s) => {
    const cx = Math.cos(r[0]), sx = Math.sin(r[0]), cy = Math.cos(r[1]), sy = Math.sin(r[1]), cz = Math.cos(r[2]), sz = Math.sin(r[2]);
    return new Float32Array([cz * cy * s, sz * cy * s, -sy * s, 0, (cz * sy * sx - sz * cx) * s, (sz * sy * sx + cz * cx) * s, cy * sx * s, 0, (cz * sy * cx + sz * sx) * s, (sz * sy * cx - cz * sx) * s, cy * cx * s, 0, t[0], t[1], t[2], 1]);
  };
  const VS = `attribute vec3 p;attribute vec3 n;attribute vec3 b;uniform mat4 M,V,P;varying vec3 vN,vW,vB;
void main(){vec4 w=M*vec4(p,1.0);vW=w.xyz;vN=normalize((M*vec4(n,0.0)).xyz);vB=b;gl_Position=P*V*w;}`;
  const FS = `precision mediump float;uniform vec3 uColor,uCam,uRim,uTint,uCalm;uniform float uAlpha,uTime,uDark,uTintAmt,uBack;varying vec3 vN,vW,vB;
vec3 hue(float h){return clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);}
void main(){vec3 N=normalize(vN);if(uBack>0.5)N=-N;vec3 V=normalize(uCam-vW);
float fr=pow(1.0-max(dot(N,V),0.0),2.0);
float dif=max(dot(N,normalize(vec3(0.5,0.8,0.6))),0.0)*0.6+max(dot(N,normalize(vec3(-0.7,-0.3,0.5))),0.0)*0.3+0.3;
vec3 base=mix(uColor,uTint,uTintAmt*0.65);
vec3 irid=hue(fr*0.7+dot(N,vec3(0.3,0.5,0.2))*0.35+uTime*0.03);
vec3 col=base*dif+irid*fr*mix(0.35,0.6,uDark)+uRim*fr*0.7;
float e=min(min(vB.x,vB.y),vB.z);float edge=1.0-smoothstep(0.0,0.04,e);
vec3 ec=mix(base*0.62,mix(uRim,base,0.35)*1.3,uDark);col=mix(col,ec,edge*0.85);
float a=clamp(uAlpha*(0.3+fr*0.7)+edge*mix(0.55,0.7,uDark),0.0,1.0);if(uBack>0.5)a*=0.45;
float cx=abs(gl_FragCoord.x/uCalm.x-0.5)*2.0;a*=1.0-uCalm.z*(1.0-smoothstep(uCalm.y,1.0,cx));
gl_FragColor=vec4(col*a,a);}`;
  const PVS = `attribute vec3 p;attribute float s;uniform mat4 V,P;uniform float uTime,uSize;varying float vA;
void main(){vec4 v=V*vec4(p,1.0);gl_Position=P*v;vA=0.55+0.45*sin(uTime*(0.5+s*1.5)+s*40.0);gl_PointSize=uSize*(0.5+s)*(60.0/max(-v.z,1.0));}`;
  const PFS = `precision mediump float;uniform vec3 uCol;uniform float uAlpha;varying float vA;
void main(){float d=length(gl_PointCoord-0.5);float a=smoothstep(0.5,0.0,d)*vA*uAlpha;gl_FragColor=vec4(uCol*a,a);}`;

  const B = {
    ok: false, gl: null, cv: null, raf: 0, last: 0, t0: 0, dpr: 1, quality: 2, isStatic: false, inGame: false,
    mouse: { x: 0, y: 0, tx: 0, ty: 0 }, scroll: 0, tint: [0.6, 0.5, 1], tintAmt: 0, tintTarget: 0, boostAmt: 0,
    dark: true, cols: [], rim: [1, 1, 1], starCol: [1, 1, 1], crystals: [], buffers: {}, stars: null, nStars: 0,
    frames: 0, acc: 0, P: null, aspect: 1, sk: 1, calm: [1, 0.5, 0.4],
    init() {
      const cv = $('#bg3d'); this.cv = cv;
      let gl = null;
      try { gl = cv.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'low-power' }); } catch (e) { gl = null; }
      if (!gl) { cv.style.display = 'none'; return; }
      this.gl = gl;
      try { this.setup(); } catch (e) { console.warn('3D background disabled:', e); cv.style.display = 'none'; return; }
      this.ok = true;
      cv.addEventListener('webglcontextlost', e => { e.preventDefault(); this.ok = false; cancelAnimationFrame(this.raf); cv.style.display = 'none'; });
      addEventListener('resize', () => this.resize());
      addEventListener('pointermove', e => { this.mouse.tx = (e.clientX / innerWidth - 0.5) * 2; this.mouse.ty = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
      addEventListener('scroll', () => { this.scroll = window.scrollY || 0; }, { passive: true });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.kick(); });
      this.isStatic = reduceMotion();
      this.t0 = performance.now();
      this.theme(); this.resize(); this.kick();
    },
    compile(vs, fs) {
      const gl = this.gl, mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = gl.createProgram();
      gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}, a = {};
      const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < nu; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
      const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); for (let i = 0; i < na; i++) { const info = gl.getActiveAttrib(p, i); a[info.name] = gl.getAttribLocation(p, info.name); }
      return { p, u, a };
    },
    setup() {
      const gl = this.gl;
      this.mesh = this.compile(VS, FS);
      this.pts = this.compile(PVS, PFS);
      for (const k of Object.keys(SHAPES)) {
        const data = build(SHAPES[k]()), buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        this.buffers[k] = { buf, count: data.length / 9 };
      }
      const rnd = makeRng(20261105);
      // Hero crystals: framed around the edges so the content stays calm
      const layout = [
        ['geo', -0.86, 0.62, -1.5, 1.05], ['crystal', 0.84, 0.7, -2.5, 1.2], ['octa', -0.72, -0.5, 0.5, 0.75], ['ico', 0.9, -0.38, -1, 0.95],
        ['star', -0.2, 0.92, -7, 1.3], ['tetra', 0.42, -0.9, -4, 0.8], ['ico', -0.98, 0.05, -8, 1.4], ['geo', 0.98, 0.25, -9, 1.5],
        ['crystal', 0.15, 1.15, -12, 1.6], ['octa', -0.5, -1.05, -10, 1.3]
      ];
      this.crystals = layout.map((L, i) => ({ kind: L[0], nx: L[1], ny: L[2], z: L[3], s: L[4], ci: i % 10, rs: [rnd.float(-0.25, 0.25), rnd.float(0.12, 0.35), rnd.float(-0.15, 0.15)], ph: rnd.float(0, 6.28), alpha: rnd.float(0.5, 0.75), pos: [0, 0, 0] }));
      for (let i = 0; i < 8; i++) this.crystals.push({ kind: rnd.pick(['tetra', 'octa', 'crystal']), nx: rnd.float(-1.1, 1.1), ny: rnd.float(-1.2, 1.2), z: rnd.float(-14, -5), s: rnd.float(0.25, 0.45), ci: rnd.int(0, 9), rs: [rnd.float(-0.6, 0.6), rnd.float(-0.6, 0.6), rnd.float(-0.4, 0.4)], ph: rnd.float(0, 6.28), alpha: 0.55, pos: [0, 0, 0] });
      this.crystals.sort((a, b) => a.z - b.z);
      const N = 1100, arr = new Float32Array(N * 4);
      for (let i = 0; i < N; i++) { arr[i * 4] = rnd.float(-30, 30); arr[i * 4 + 1] = rnd.float(-20, 20); arr[i * 4 + 2] = rnd.float(-40, 4); arr[i * 4 + 3] = rnd.next(); }
      this.stars = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.stars); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      this.nStars = N;
    },
    theme() {
      this.dark = effectiveTheme() === 'dark';
      this.cols = DOMAIN_ORDER.map(d => hexRgb(cssVar('--d-' + d)));
      this.rim = this.dark ? [0.85, 0.9, 1] : [1, 1, 1];
      this.starCol = this.dark ? [0.86, 0.9, 1] : [0.55, 0.4, 0.95];
      this.kick();
    },
    focus(varName) {
      if (varName) { this.tint = hexRgb(cssVar(varName)); this.tintTarget = 1; this.inGame = true; }
      else { this.tintTarget = 0; this.inGame = false; }
      this.kick();
    },
    boost() { this.boostAmt = 1; this.kick(); },
    resize() {
      if (!this.ok) return;
      const q = [0.75, 1, 1.5][this.quality];
      this.dpr = Math.min(window.devicePixelRatio || 1, q);
      const w = Math.max(1, Math.round(innerWidth * this.dpr)), hh = Math.max(1, Math.round(innerHeight * this.dpr));
      this.cv.width = w; this.cv.height = hh;
      this.gl.viewport(0, 0, w, hh);
      this.aspect = innerWidth / Math.max(1, innerHeight);
      this.P = persp(50 * Math.PI / 180, this.aspect, 0.1, 100);
      const t = Math.tan(25 * Math.PI / 180);
      const narrow = this.aspect < 0.8;
      this.sk = narrow ? 0.58 : this.aspect < 1.15 ? 0.8 : 1;
      this.calm = [w, narrow ? 0.62 : 0.5, narrow ? 0.62 : 0.42];
      for (const c of this.crystals) {
        const half = (10 - c.z) * t, spreadX = narrow ? 1.14 : this.aspect < 1.15 ? 1.02 : 0.92;
        c.pos = [c.nx * half * this.aspect * spreadX, c.ny * half * 0.92, c.z];
      }
      this.kick();
    },
    kick() {
      if (!this.ok) return;
      if (this.isStatic) { this.draw(performance.now()); return; }
      if (!this.raf) this.raf = requestAnimationFrame(t => this.loop(t));
    },
    loop(now) {
      this.raf = 0;
      if (!this.ok || document.hidden) return;
      this.raf = requestAnimationFrame(t => this.loop(t));
      const dt = now - this.last;
      if (this.inGame && dt < 42) return;
      this.last = now;
      if (!this.inGame && dt < 250) {
        this.frames++; this.acc += dt;
        if (this.frames >= 120) {
          const avg = this.acc / this.frames; this.frames = 0; this.acc = 0;
          if (avg > 30 && this.quality > 0) { this.quality--; this.resize(); }
          else if (avg > 45 && this.quality === 0) { this.isStatic = true; cancelAnimationFrame(this.raf); this.raf = 0; }
        }
      }
      this.draw(now);
    },
    draw(now) {
      const gl = this.gl, t = (now - this.t0) / 1000, m = this.mouse;
      m.x += (m.tx - m.x) * 0.045; m.y += (m.ty - m.y) * 0.045;
      this.tintAmt += (this.tintTarget - this.tintAmt) * 0.06;
      this.boostAmt *= 0.985;
      const sc = Math.min(this.scroll / 900, 1.8);
      const eye = [m.x * 0.9, -m.y * 0.55 - sc * 1.3, 10], ctr = [m.x * 0.25, -sc * 1.5, 0];
      const V = lookAt(eye, ctr, [0, 1, 0]);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND);
      // Stars / dust
      const P = this.pts; gl.useProgram(P.p);
      gl.blendFunc(gl.ONE, this.dark ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(P.u.V, false, V); gl.uniformMatrix4fv(P.u.P, false, this.P);
      gl.uniform1f(P.u.uTime, t); gl.uniform1f(P.u.uSize, (this.dark ? 3.2 : 2.6) * this.dpr);
      gl.uniform3fv(P.u.uCol, this.starCol); gl.uniform1f(P.u.uAlpha, this.dark ? 0.85 : 0.45);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.stars);
      gl.enableVertexAttribArray(P.a.p); gl.vertexAttribPointer(P.a.p, 3, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(P.a.s); gl.vertexAttribPointer(P.a.s, 1, gl.FLOAT, false, 16, 12);
      gl.drawArrays(gl.POINTS, 0, this.quality === 0 ? this.nStars >> 1 : this.nStars);
      gl.disableVertexAttribArray(P.a.s);
      // Crystals
      const Mh = this.mesh; gl.useProgram(Mh.p);
      gl.blendFunc(gl.ONE, this.dark ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(Mh.u.V, false, V); gl.uniformMatrix4fv(Mh.u.P, false, this.P);
      gl.uniform3fv(Mh.u.uCam, eye); gl.uniform3fv(Mh.u.uRim, this.rim); gl.uniform3fv(Mh.u.uTint, this.tint);
      gl.uniform1f(Mh.u.uTime, t); gl.uniform1f(Mh.u.uDark, this.dark ? 1 : 0); gl.uniform1f(Mh.u.uTintAmt, this.tintAmt);
      gl.uniform3fv(Mh.u.uCalm, this.calm);
      gl.enable(gl.CULL_FACE);
      const spin = 1 + this.boostAmt * 6;
      for (const c of this.crystals) {
        const B = this.buffers[c.kind];
        gl.bindBuffer(gl.ARRAY_BUFFER, B.buf);
        gl.enableVertexAttribArray(Mh.a.p); gl.vertexAttribPointer(Mh.a.p, 3, gl.FLOAT, false, 36, 0);
        gl.enableVertexAttribArray(Mh.a.n); gl.vertexAttribPointer(Mh.a.n, 3, gl.FLOAT, false, 36, 12);
        gl.enableVertexAttribArray(Mh.a.b); gl.vertexAttribPointer(Mh.a.b, 3, gl.FLOAT, false, 36, 24);
        const tt = t * spin;
        const pos = [c.pos[0], c.pos[1] + Math.sin(t * 0.45 + c.ph) * 0.28, c.pos[2]];
        gl.uniformMatrix4fv(Mh.u.M, false, model(pos, [c.ph + tt * c.rs[0], c.ph * 0.7 + tt * c.rs[1], tt * c.rs[2]], c.s * this.sk));
        gl.uniform3fv(Mh.u.uColor, this.cols[c.ci]);
        gl.uniform1f(Mh.u.uAlpha, c.alpha * (this.dark ? 0.85 : 0.75));
        gl.cullFace(gl.FRONT); gl.uniform1f(Mh.u.uBack, 1); gl.drawArrays(gl.TRIANGLES, 0, B.count);
        gl.cullFace(gl.BACK); gl.uniform1f(Mh.u.uBack, 0); gl.drawArrays(gl.TRIANGLES, 0, B.count);
      }
      gl.disable(gl.CULL_FACE);
      gl.disableVertexAttribArray(Mh.a.n); gl.disableVertexAttribArray(Mh.a.b); gl.disableVertexAttribArray(Mh.a.p);
    }
  };
  return B;
})();
