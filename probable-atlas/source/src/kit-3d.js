/* Probable kit: loader for the shared 3D bundle (Three.js r186, WebGPU with a WebGL 2 fallback). The bundle loads after
   the page is interactive and only when the browser can draw it; if it can't, the page keeps its 2D design.
   A "still" toggle stops the motion and is remembered per visitor. */
const PX3D = (() => {
  const URL_ = window.PROBABLE_3D_URL || '/assets/probable-3d/probable-3d.js?v=3';
  const KEY = 'px3d-still';
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* blocked */ } } };
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const still = () => reduce() || ls.get(KEY) === '1';
  let mod = null;
  function can() {
    try { if (navigator.gpu) return true; const c = document.createElement('canvas'); return !!(c.getContext('webgl2')); } catch (e) { return false; }
  }
  function load() { return mod || (mod = import(URL_)); }
  const idle = fn => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1800 }) : setTimeout(fn, 350));
  async function mount(el, kind, data, opts) {
    if (!el || !can()) throw new Error('3D not available');
    const m = await load();
    const ctl = await m.mount(el, kind, data, Object.assign({ reducedMotion: still() }, opts || {}));
    el.classList.add('px3d-on');
    return ctl;
  }
  // a small "motion" switch inside a 3D panel
  function motionToggle(host, ctl) {
    if (!host || host.querySelector('.px3d-still')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'px3d-still';
    const paint = () => { const s = ls.get(KEY) === '1' || reduce(); b.setAttribute('aria-pressed', String(s)); b.textContent = s ? '▶ Motion' : '❚❚ Still'; b.title = s ? 'Turn the 3D motion back on' : 'Stop the 3D motion'; };
    b.addEventListener('click', () => { const s = !(ls.get(KEY) === '1'); ls.set(KEY, s ? '1' : '0'); if (ctl && ctl.setPaused) ctl.setPaused(s || reduce()); paint(); });
    paint(); host.appendChild(b);
  }
  return { mount, can, load, idle, still, motionToggle };
})();
