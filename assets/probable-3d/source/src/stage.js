/* Probable 3D — shared stage: renderer (WebGPU with automatic WebGL2 fallback), camera, resize,
   render loop that sleeps when the scene is off screen or the tab is hidden, drag-to-rotate,
   hover/tap picking in screen space, DOM labels and tooltip, and an optional bloom pass. */
import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function quality(opts) {
  if (opts.quality && opts.quality !== 'auto') return opts.quality;
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  const small = Math.min(screen.width, screen.height) < 600;
  const save = navigator.connection && navigator.connection.saveData;
  if (save || cores <= 2 || mem <= 2) return 'low';
  if (small || cores <= 4) return 'medium';
  return 'high';
}

export class Stage {
  constructor(el, opts) {
    this.el = el; this.opts = opts || {};
    this.q = quality(this.opts);
    this.reduced = !!this.opts.reducedMotion;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.opts.fov || 36, 1, 0.05, 200);
    this.rig = new THREE.Group(); this.scene.add(this.rig);           // everything the user can rotate
    this.yaw = this.opts.yaw || 0; this.pitch = this.opts.pitch || 0; this.vyaw = 0; this.vpitch = 0;
    this.limits = this.opts.limits || { yaw: [-Math.PI, Math.PI], pitch: [-0.5, 0.5], wrapYaw: true };
    this.autoSpin = this.opts.autoSpin || 0;                           // radians per second
    this.items = [];                                                   // pickable { pos: Vector3, data, r }
    this.labels = [];                                                  // { el, pos: Vector3, hideBehind?: fn }
    this.running = false; this.visible = true; this.dirty = true; this.t0 = performance.now(); this.last = this.t0;
    this.hover = null; this.drag = null;
    this.onFrame = null; this.onPick = this.opts.onPick || null; this.tip = null;
  }

  async init() {
    const el = this.el;
    const canvas = document.createElement('canvas');
    canvas.className = 'px3d-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(canvas);
    this.canvas = canvas;
    const r = new THREE.WebGPURenderer({ canvas, antialias: this.q !== 'low', alpha: false, powerPreference: 'high-performance', forceWebGL: !!this.opts.forceWebGL });
    await r.init();
    this.renderer = r;
    this.backend = r.backend && r.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q === 'high' ? 2 : this.q === 'medium' ? 1.5 : 1));
    r.setClearColor(new THREE.Color(this.opts.bg || '#0b1220'), 1);
    r.toneMapping = THREE.NoToneMapping;
    if (this.q !== 'low' && this.opts.bloom !== false) {
      const b = this.opts.bloom || {};
      const pipe = new THREE.RenderPipeline(r);
      const sp = pass(this.scene, this.camera);
      pipe.outputNode = sp.add(bloom(sp, b.strength ?? 0.7, b.radius ?? 0.35, b.threshold ?? 0.55));
      this.pipe = pipe;
    }
    // overlay for labels + tooltip
    const ov = document.createElement('div'); ov.className = 'px3d-overlay'; el.appendChild(ov); this.overlay = ov;
    const tip = document.createElement('div'); tip.className = 'px3d-tip'; tip.hidden = true; tip.setAttribute('role', 'status'); el.appendChild(tip); this.tip = tip;
    this.resize();
    this.ro = new ResizeObserver(() => { this.resize(); this.dirty = true; });
    this.ro.observe(el);
    this.io = new IntersectionObserver(es => { this.visible = es.some(e => e.isIntersecting); this.sync(); }, { rootMargin: '80px' });
    this.io.observe(el);
    this.onVis = () => this.sync(); document.addEventListener('visibilitychange', this.onVis);
    this.bindPointer();
    return this;
  }

  resize() {
    const w = Math.max(10, this.el.clientWidth), h = Math.max(10, this.el.clientHeight);
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (this.onResize) this.onResize(w, h);
    this.camera.updateProjectionMatrix();
  }

  sync() {
    const want = this.visible && !document.hidden && !this.destroyed;
    if (want && !this.running) { this.running = true; this.last = performance.now(); this.renderer.setAnimationLoop(() => this.frame()); }
    else if (!want && this.running) { this.running = false; this.renderer.setAnimationLoop(null); }
  }

  start() { this.sync(); }

  frame() {
    const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const t = (now - this.t0) / 1000;
    const moving = !this.reduced || this.drag || Math.abs(this.vyaw) > 1e-4 || Math.abs(this.vpitch) > 1e-4;
    if (!moving && !this.dirty) return;            // reduced motion: draw only when something changed
    if (!this.drag) {
      if (!this.reduced && !this.hover) this.yaw += this.autoSpin * dt;
      this.yaw += this.vyaw; this.pitch += this.vpitch;
      this.vyaw *= 0.92; this.vpitch *= 0.92;
    }
    const L = this.limits;
    if (L.wrapYaw) { if (this.yaw > Math.PI) this.yaw -= 2 * Math.PI; if (this.yaw < -Math.PI) this.yaw += 2 * Math.PI; }
    else this.yaw = clamp(this.yaw, L.yaw[0], L.yaw[1]);
    this.pitch = clamp(this.pitch, L.pitch[0], L.pitch[1]);
    this.rig.rotation.set(this.pitch, this.yaw, 0, 'XYZ');
    if (this.onFrame) this.onFrame(this.reduced ? 0 : t, dt);
    this.rig.updateMatrixWorld(true);
    if (this.pipe) this.pipe.render(); else this.renderer.render(this.scene, this.camera);
    this.placeLabels();
    this.dirty = false;
  }

  /* ---------- labels ---------- */
  label(text, cls) {
    const d = document.createElement('div'); d.className = 'px3d-label ' + (cls || ''); d.textContent = text;
    this.overlay.appendChild(d); return d;
  }
  clearLabels() { for (const l of this.labels) l.el.remove(); this.labels = []; }
  project(v) {
    const p = this.tmpV || (this.tmpV = new THREE.Vector3());
    p.copy(v).applyMatrix4(this.rig.matrixWorld).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h, z: p.z };
  }
  placeLabels() {
    const groups = {};
    for (const l of this.labels) {
      const s = this.project(l.pos);
      const hide = s.z > 1 || s.x < -40 || s.x > this.w + 40 || s.y < -20 || s.y > this.h + 20 || (l.hidden && l.hidden());
      l.el.style.opacity = hide ? '0' : '';
      if (hide) continue;
      const x = s.x + (l.dx || 0), y = s.y + (l.dy || 0);
      if (l.group) { (groups[l.group] || (groups[l.group] = [])).push({ l, x, y }); continue; }
      l.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
    // labels in a group (centered pills) never sit on top of each other: a later one steps away in its own direction
    for (const k in groups) {
      const G = groups[k].sort((a, b) => a.x - b.x);
      for (const g of G) { g.w = g.l.w || (g.l.w = g.l.el.offsetWidth || 40); g.h = g.l.h || (g.l.h = g.l.el.offsetHeight || 18); }
      for (let i = 1; i < G.length; i++) {
        const b = G[i];
        for (let j = 0; j < i; j++) {
          const a = G[j];
          if (Math.abs(b.x - a.x) < (a.w + b.w) / 2 + 3 && Math.abs(b.y - a.y) < (a.h + b.h) / 2 + 2) b.y = a.y + (b.l.push || -1) * ((a.h + b.h) / 2 + 3);
        }
      }
      for (const g of G) g.l.el.style.transform = `translate(${Math.round(g.x)}px, ${Math.round(g.y)}px)`;
    }
  }

  /* ---------- picking in screen space (forgiving for small marks and touch) ---------- */
  pickAt(x, y) {
    let best = null, bd = Infinity;
    const wpos = this.tmpW || (this.tmpW = new THREE.Vector3());
    for (const it of this.items) {
      if (it.hidden && it.hidden()) continue;
      wpos.copy(it.pos);
      const s = this.project(wpos);
      if (s.z > 1) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      const r = (it.r || 14) + (this.touch ? 10 : 0);
      if (d < r && d < bd) { bd = d; best = it; }
    }
    if (!best && this.pickFallback) best = this.pickFallback(x, y);
    return best;
  }
  showTip(it, x, y) {
    if (!it || !this.tipHTML) { this.tip.hidden = true; return; }
    this.tip.innerHTML = this.tipHTML(it.data);
    this.tip.hidden = false;
    const tw = this.tip.offsetWidth, th = this.tip.offsetHeight;
    let tx = x + 14, ty = y - th - 10;
    if (tx + tw > this.w - 6) tx = x - tw - 14;
    if (ty < 6) ty = y + 16;
    this.tip.style.transform = `translate(${Math.round(clamp(tx, 6, this.w - tw - 6))}px, ${Math.round(clamp(ty, 6, this.h - th - 6))}px)`;
  }

  bindPointer() {
    const c = this.el;
    c.style.touchAction = 'pan-y';
    const pos = e => { const b = c.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    this.onDown = e => {
      if (e.button != null && e.button !== 0) return;
      this.touch = e.pointerType === 'touch';
      const p = pos(e);
      this.drag = { x: p.x, y: p.y, x0: p.x, y0: p.y, moved: 0, id: e.pointerId, t: performance.now() };
      this.vyaw = this.vpitch = 0;
    };
    this.onMove = e => {
      const p = pos(e);
      if (this.drag && e.pointerId === this.drag.id) {
        const dx = p.x - this.drag.x, dy = p.y - this.drag.y;
        this.drag.moved += Math.abs(dx) + Math.abs(dy);
        if (this.drag.moved > 6 && !this.drag.cap) { try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } this.drag.cap = true; c.classList.add('px3d-grabbing'); }
        const k = (this.opts.dragSpeed || 1) * 3.2 / Math.max(300, this.w);
        this.yaw += dx * k; this.pitch += dy * k * 0.6;
        this.vyaw = dx * k * 0.6; this.vpitch = dy * k * 0.36;
        this.drag.x = p.x; this.drag.y = p.y; this.dirty = true;
        this.tip.hidden = true;
        return;
      }
      if (e.pointerType === 'touch') return;
      const it = this.pickAt(p.x, p.y);
      if (it !== this.hover) { this.hover = it; c.style.cursor = it ? 'pointer' : ''; if (this.onHover) this.onHover(it); this.dirty = true; }
      this.showTip(it, p.x, p.y);
    };
    this.onUp = e => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      const p = pos(e), d = this.drag; this.drag = null; c.classList.remove('px3d-grabbing');
      if (d.cap) { try { c.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
      if (d.moved < 8) {
        const it = this.pickAt(p.x, p.y);
        if (it) {
          if (e.pointerType === 'touch' && this.hover !== it && !this.opts.tapOpens) { this.hover = it; this.showTip(it, p.x, p.y); if (this.onHover) this.onHover(it); this.dirty = true; return; }
          if (this.onPick) this.onPick(it.data);
        } else if (e.pointerType === 'touch') { this.hover = null; this.tip.hidden = true; if (this.onHover) this.onHover(null); }
      }
    };
    this.onLeave = () => { if (!this.drag) { this.hover = null; this.tip.hidden = true; c.style.cursor = ''; if (this.onHover) this.onHover(null); } };
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onUp);
    c.addEventListener('pointerleave', this.onLeave);
  }

  destroy() {
    this.destroyed = true; this.sync();
    try { this.ro.disconnect(); this.io.disconnect(); } catch (e) { /* ignore */ }
    document.removeEventListener('visibilitychange', this.onVis);
    const c = this.el;
    c.removeEventListener('pointerdown', this.onDown); c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp); c.removeEventListener('pointercancel', this.onUp); c.removeEventListener('pointerleave', this.onLeave);
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); });
    try { this.renderer.dispose(); } catch (e) { /* ignore */ }
    this.canvas.remove(); this.overlay.remove(); this.tip.remove();
  }
}

export { THREE, clamp };
