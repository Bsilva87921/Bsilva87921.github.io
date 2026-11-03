/* Probable kit: small touches. Keyboard shortcuts with a "?" help sheet, pull to refresh on phones, numbers
   that count up when they come into view, a confetti burst, and a pop-out window (Document Picture-in-Picture)
   that floats a live view above other windows where the browser supports it. All respect reduced motion. */
const UX = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const typing = t => t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName));
  const keys = []; let helpEl = null, bound = false;
  function key(k, label, run) {
    keys.push({ k, label, run });
    if (bound) return; bound = true;
    document.addEventListener('keydown', ev => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey || typing(ev.target) || document.documentElement.classList.contains('kx-lock')) return;
      if (ev.key === '?') { ev.preventDefault(); help(); return; }
      const hit = keys.find(x => x.k === ev.key); if (hit) { ev.preventDefault(); hit.run(); }
    });
  }
  function help() {
    if (helpEl) { helpEl.remove(); helpEl = null; return; }
    helpEl = document.createElement('div'); helpEl.className = 'kx-help'; helpEl.setAttribute('role', 'dialog'); helpEl.setAttribute('aria-label', 'Keyboard shortcuts');
    const mac = /mac|iphone|ipad/i.test(navigator.platform || '');
    const rows = [[mac ? '⌘ K' : 'Ctrl K', 'Search everything'], ['/', 'Search everything'], ...keys.map(x => [x.k, x.label]), ['?', 'Show or hide this list'], ['Esc', 'Close a panel']];
    helpEl.innerHTML = `<div class="kx-help-in"><button type="button" class="kx-share-x" aria-label="Close">×</button><b>Keyboard shortcuts</b><dl>${rows.map(([k, l]) => `<dt><kbd>${esc(k)}</kbd></dt><dd>${esc(l)}</dd>`).join('')}</dl></div>`;
    document.body.appendChild(helpEl);
    helpEl.addEventListener('click', ev => { if (ev.target === helpEl || ev.target.closest('.kx-share-x')) { helpEl.remove(); helpEl = null; } });
    document.addEventListener('keydown', function esc2(ev) { if (ev.key === 'Escape' && helpEl) { helpEl.remove(); helpEl = null; document.removeEventListener('keydown', esc2); } });
  }
  // pull to refresh (touch screens, at the top of the page)
  function ptr(o) {
    if (!('ontouchstart' in window)) return;
    const ind = document.createElement('div'); ind.className = 'kx-ptr'; ind.innerHTML = '<span class="kx-ptr-spin" aria-hidden="true"></span><span class="kx-ptr-t">Pull to refresh</span>'; document.body.appendChild(ind);
    let y0 = null, dy = 0, busy = false;
    addEventListener('touchstart', e => { if (busy || scrollY > 2 || document.documentElement.classList.contains('kx-lock')) { y0 = null; return; } y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
    addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); if (dy > 8 && scrollY <= 0) { const p = Math.min(1, dy / 90); ind.style.transform = `translate(-50%, ${Math.round(p * 64 - 56)}px)`; ind.classList.toggle('ready', p >= 1); ind.querySelector('.kx-ptr-t').textContent = p >= 1 ? 'Release to refresh' : 'Pull to refresh'; } }, { passive: true });
    addEventListener('touchend', async () => {
      if (y0 == null) return; y0 = null;
      if (dy >= 90 && !busy) {
        busy = true; ind.classList.add('busy'); ind.querySelector('.kx-ptr-t').textContent = 'Refreshing…'; if (window.HAPTIC) HAPTIC.tap();
        try { await o.onRefresh(); } catch (e) { /* ignore */ }
        if (window.HAPTIC) HAPTIC.success(); busy = false; ind.classList.remove('busy', 'ready');
      }
      ind.style.transform = ''; dy = 0;
    });
  }
  // numbers count up once when they first scroll into view: <b data-count>1,234</b>
  const counted = new WeakSet();
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); run(e.target); } }), { threshold: 0.4 }) : null;
  function run(el) {
    const txt = el.textContent, m = txt.match(/-?[\d,]*\.?\d+/); if (!m) return;
    const end = parseFloat(m[0].replace(/,/g, '')), dec = (m[0].split('.')[1] || '').length, pre = txt.slice(0, m.index), post = txt.slice(m.index + m[0].length);
    if (!isFinite(end) || Math.abs(end) < 2) return;
    const t0 = performance.now(), D = 650, fmt = v => pre + v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + post;
    const step = now => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(end * e); if (k < 1) requestAnimationFrame(step); else el.textContent = txt; };
    requestAnimationFrame(step);
  }
  function countUp(root) { if (reduced() || !io) return; (root || document).querySelectorAll('[data-count]').forEach(el => { if (counted.has(el)) return; counted.add(el); io.observe(el); }); }
  // confetti in the given colors
  function confetti(colors) {
    if (reduced()) return;
    const cv = document.createElement('canvas'); cv.className = 'kx-confetti'; cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; document.body.appendChild(cv);
    const ctx = cv.getContext('2d'), N = 140, P = [], cs = (colors && colors.length ? colors : ['#FFB547', '#36d399', '#5ea0f0', '#ff7b72']);
    for (let k = 0; k < N; k++) P.push({ x: cv.width / 2 + (Math.random() - 0.5) * cv.width * 0.3, y: cv.height * 0.35, vx: (Math.random() - 0.5) * 18 * devicePixelRatio, vy: (-Math.random() * 16 - 6) * devicePixelRatio, r: (4 + Math.random() * 6) * devicePixelRatio, c: cs[k % cs.length], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4 });
    const t0 = performance.now();
    (function f(now) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of P) { p.vy += 0.5 * devicePixelRatio; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); }
      if (now - t0 < 2600) requestAnimationFrame(f); else cv.remove();
    })(t0);
  }
  // pop a small live view into an always-on-top window (Chrome and Edge on desktop)
  const pipOK = () => 'documentPictureInPicture' in window;
  async function pip(o) {
    if (!pipOK()) return null;
    const w = await window.documentPictureInPicture.requestWindow({ width: o.width || 360, height: o.height || 220 });
    [...document.styleSheets].forEach(ss => { try { const st = w.document.createElement('style'); st.textContent = [...ss.cssRules].map(r => r.cssText).join('\n'); w.document.head.appendChild(st); } catch (e) { if (ss.href) { const l = w.document.createElement('link'); l.rel = 'stylesheet'; l.href = ss.href; w.document.head.appendChild(l); } } });
    w.document.documentElement.dataset.theme = document.documentElement.dataset.theme || '';
    w.document.body.className = 'kx-pip'; w.document.title = o.title || 'Live';
    const paint = () => { try { w.document.body.innerHTML = o.render(); } catch (e) { /* ignore */ } };
    paint(); const iv = setInterval(paint, o.every || 5000);
    w.addEventListener('pagehide', () => clearInterval(iv));
    if (o.onClick) w.document.addEventListener('click', ev => o.onClick(ev, w));
    return { win: w, update: paint, close: () => w.close() };
  }
  return { key, help, ptr, countUp, confetti, pip, pipOK, reduced };
})();

window.UX = UX;
