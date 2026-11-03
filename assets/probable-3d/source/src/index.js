/* Probable 3D — one bundle for the Probable sites. mount(el, kind, data, opts) resolves to a controller
   ({ update, destroy, setPaused, backend }) or rejects; the page keeps its 2D design when it rejects.
   WebGPU is used where the browser offers it. If the WebGPU device is lost or reports errors in the
   first seconds, the scene is rebuilt on WebGL 2 and that choice is remembered for the device. */
import { arena } from './arena.js';
import { globe } from './globe.js';
import { surface } from './surface.js';
import { carousel } from './carousel.js';
import { skyline } from './skyline.js';
const KINDS = { arena, globe, surface, carousel, skyline };
export const version = '1.1.0';
const KEY = 'px3d-backend';
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } };
const GPU_ERR = /popErrorScope|device lost|devicelost|webgpu|wgsl|gpuvalidation|createrenderpipeline|shader module|instance dropped/i;

export async function mount(el, kind, data, opts) {
  const fn = KINDS[kind]; if (!fn) throw new Error('Unknown 3D scene ' + kind);
  opts = opts || {};
  const q = (location.search.match(/[?&]gl=(webgl|webgpu)/) || [])[1];
  let forceWebGL = q ? q === 'webgl' : (opts.forceWebGL || lsGet(KEY) === 'webgl' || !navigator.gpu);
  let cur = null, last = data, dead = false;
  const build = async fw => { const c = await fn(el, last, Object.assign({}, opts, { forceWebGL: fw })); el.dataset.px3d = c.backend; return c; };
  try { cur = await build(forceWebGL); }
  catch (e) { if (forceWebGL) throw e; cur = await build(true); lsSet(KEY, 'webgl'); }
  const api = {
    get backend() { return cur ? cur.backend : 'none'; },
    update(d) { last = d; if (cur && cur.update) cur.update(d); },
    setPaused(p) { if (cur && cur.setPaused) cur.setPaused(p); },
    focus(...a) { if (cur && cur.focus) cur.focus(...a); },
    step(k) { if (cur && cur.step) cur.step(k); },
    get front() { return cur ? cur.front : null; },
    destroy() { dead = true; if (cur) cur.destroy(); cur = null; }
  };
  if (cur.backend === 'WebGPU') {
    // watch the first seconds: on any GPU failure, rebuild the same scene on WebGL 2
    let tripped = false, cleanup = () => { };
    const trip = async why => {
      if (tripped || dead) return; tripped = true; cleanup();
      try { cur.destroy(); } catch (e) { /* ignore */ }
      lsSet(KEY, 'webgl');
      try { cur = await build(true); if (opts.onBackend) opts.onBackend(cur.backend, why); } catch (e) { cur = null; if (opts.onFail) opts.onFail(e); }
    };
    const onRej = ev => { const m = String((ev.reason && (ev.reason.message || ev.reason)) || ''); if (GPU_ERR.test(m)) { ev.preventDefault(); trip(m); } };
    const onErr = ev => { if (GPU_ERR.test(String(ev.message || ''))) trip(ev.message); };
    const ce = console.error;
    console.error = function (...a) { try { if (GPU_ERR.test(a.map(String).join(' '))) trip('console'); } catch (e) { /* ignore */ } return ce.apply(this, a); };
    window.addEventListener('unhandledrejection', onRej); window.addEventListener('error', onErr);
    const r = cur.stage && cur.stage.renderer; if (r) r.onDeviceLost = () => trip('device lost');
    cleanup = () => { window.removeEventListener('unhandledrejection', onRej); window.removeEventListener('error', onErr); if (console.error !== ce) console.error = ce; };
    setTimeout(() => { cleanup(); if (!tripped) lsSet(KEY, 'webgpu'); }, 5000);
  }
  return api;
}
