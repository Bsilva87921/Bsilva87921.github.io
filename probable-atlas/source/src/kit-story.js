/* Probable kit: the daily briefing as swipeable stories. A ring button opens five or so full-screen slides,
   each one thing that matters today with a big number and a small chart. Tap the right side (or →) for the
   next slide, the left side for the previous one, hold to pause, swipe down or Esc to close. Slides advance
   on their own unless the visitor prefers reduced motion. "Listen" reads the briefing aloud. */
const STORY = (() => {
  let O = {}, root = null, slides = [], i = 0, raf = 0, t0 = 0, held = 0, paused = false, ringBtn = null, last = null;
  const DUR = 7500;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const today = () => new Date().toISOString().slice(0, 10);
  const SK = () => (O.key || 'probable') + '-story-seen';
  const seenToday = () => { try { return localStorage.getItem(SK()) === today(); } catch (e) { return false; } };
  function svgChart(c) {
    if (!c) return '';
    const W = 320, H = 110;
    if (c.type === 'spark' && c.data && c.data.length > 1) {
      const d = c.data.filter(v => v != null && isFinite(v)); if (d.length < 2) return '';
      const lo = Math.min(...d), hi = Math.max(...d), sx = W / (d.length - 1), sy = v => H - 8 - (hi > lo ? (v - lo) / (hi - lo) : 0.5) * (H - 16);
      const pts = d.map((v, k) => `${(k * sx).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
      return `<svg class="kx-st-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.label || 'Trend')}"><defs><linearGradient id="kxg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".35"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs><polygon points="0,${H} ${pts} ${W},${H}" fill="url(#kxg)"/><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${W}" cy="${sy(d[d.length - 1]).toFixed(1)}" r="6" fill="currentColor"/></svg>${c.label ? `<span class="kx-st-clab">${esc(c.label)}</span>` : ''}`;
    }
    if (c.type === 'split') {
      const parts = [c.a, c.d, c.h].filter(p => p && p.p > 0.001), tot = parts.reduce((s, p) => s + p.p, 0) || 1;
      return `<div class="kx-st-split" role="img" aria-label="${esc(`${c.a.label} ${Math.round(c.a.p * 100)}%, ${c.h.label} ${Math.round(c.h.p * 100)}%`)}">${parts.map(p => `<i style="flex:${(p.p / tot).toFixed(3)};background:${esc(p.color || '#8b98ad')}"></i>`).join('')}</div><div class="kx-st-splab"><b>${esc(c.a.label)} ${Math.round(c.a.p * 100)}%</b>${c.d && c.d.p > 0.001 ? `<span>Draw ${Math.round(c.d.p * 100)}%</span>` : ''}<b>${Math.round(c.h.p * 100)}% ${esc(c.h.label)}</b></div>`;
    }
    if (c.type === 'bars' && c.data && c.data.length) {
      const mx = Math.max(...c.data.map(b => Math.abs(b.v))) || 1, n = c.data.length, bw = W / n;
      return `<svg class="kx-st-chart" viewBox="0 0 ${W} ${H + 22}" role="img" aria-label="${esc(c.label || 'Bars')}"><line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="currentColor" stroke-opacity=".25"/>${c.data.map((b, k) => { const h = Math.max(3, Math.abs(b.v) / mx * (H / 2 - 6)); return `<rect x="${(k * bw + bw * 0.2).toFixed(1)}" y="${(b.v >= 0 ? H / 2 - h : H / 2).toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="${h.toFixed(1)}" rx="3" class="${b.v >= 0 ? 'up' : 'dn'}"/><text x="${(k * bw + bw / 2).toFixed(1)}" y="${H + 16}" text-anchor="middle">${esc(b.label)}</text>`; }).join('')}</svg>`;
    }
    return '';
  }
  function slideHTML(s, k) {
    const bg = s.bg || O.bg || ['#13223d', '#0a1120'];
    return `<article class="kx-st-slide${k === i ? ' on' : ''}" data-k="${k}" style="--st-a:${esc(bg[0])};--st-b:${esc(bg[1])}" aria-hidden="${k !== i}">
      <div class="kx-st-body">${s.kicker ? `<span class="kx-st-kick">${esc(s.icon || '')} ${esc(s.kicker)}</span>` : ''}
      <h3 class="kx-st-title">${esc(s.title)}</h3>
      ${s.value != null && s.value !== '' ? `<div class="kx-st-val kx-${esc(s.tone || 'info')}">${esc(s.value)}</div>` : ''}
      ${s.sub ? `<p class="kx-st-sub">${esc(s.sub)}</p>` : ''}
      <div class="kx-st-viz kx-${esc(s.tone || 'info')}">${svgChart(s.chart)}</div></div>
      <div class="kx-st-acts">${s.cta ? `<button type="button" class="kx-btn pri" data-st="go">${esc(s.cta.label)} →</button>` : ''}${s.ask && O.ask ? `<button type="button" class="kx-btn" data-st="ask">✦ Ask AI</button>` : ''}${window.SHARE ? `<button type="button" class="kx-btn kx-ico" data-st="share" aria-label="Share this slide">${SHARE.ICON}</button>` : ''}</div>
    </article>`;
  }
  function build() {
    root = document.createElement('div'); root.className = 'kx-story'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', O.title || "Today's briefing");
    root.innerHTML = `<div class="kx-st-frame"><div class="kx-st-bars"></div><div class="kx-st-head"><span class="kx-st-av" aria-hidden="true">${esc(O.mark || 'P')}</span><span class="kx-st-name"><b>${esc(O.title || "Today's briefing")}</b><small></small></span><button type="button" class="kx-st-btn" data-st="listen" aria-label="Listen to the briefing" title="Listen">🔊</button><button type="button" class="kx-st-btn" data-st="pause" aria-label="Pause" title="Pause">❚❚</button><button type="button" class="kx-st-btn" data-st="close" aria-label="Close the briefing">×</button></div><div class="kx-st-stage" aria-live="polite"></div><button type="button" class="kx-st-tap prev" data-st="prev" aria-label="Previous"></button><button type="button" class="kx-st-tap next" data-st="next" aria-label="Next"></button></div>`;
    document.body.appendChild(root);
    root.addEventListener('click', ev => {
      if (root._skip) { root._skip = false; return; }              // the click that ends a hold or a swipe
      const b = ev.target.closest('[data-st]'); if (!b) { if (ev.target === root) close(); return; }
      const a = b.dataset.st;
      if (a === 'close') close(); else if (a === 'next') go(i + 1); else if (a === 'prev') go(i - 1);
      else if (a === 'pause') setPause(!paused);
      else if (a === 'listen') listen();
      else if (a === 'go') { const s = slides[i]; close(); if (s.cta && s.cta.go) setTimeout(s.cta.go, 60); }
      else if (a === 'ask') { const s = slides[i]; close(); setTimeout(() => O.ask(s.ask), 60); }
      else if (a === 'share') { const s = slides[i]; setPause(true); SHARE.share({ kicker: s.kicker, title: s.title, value: s.value, tone: s.tone, sub: s.sub, chart: s.chart }, { file: 'probable-briefing' }); }
    });
    // hold to pause; swipe down to close
    let y0 = null, down = 0;
    root.addEventListener('pointerdown', ev => { if (ev.target.closest('.kx-st-acts,.kx-st-head')) return; down = performance.now(); y0 = ev.clientY; held = setTimeout(() => setPause(true, true), 240); });
    root.addEventListener('pointerup', ev => { clearTimeout(held); if (paused && root.dataset.hold) { setPause(false); delete root.dataset.hold; root._skip = true; } if (y0 != null && ev.clientY - y0 > 90) { root._skip = true; close(); } y0 = null; });
    root.addEventListener('keydown', ev => { if (ev.key === 'Escape') close(); else if (ev.key === 'ArrowRight' || ev.key === ' ') { ev.preventDefault(); go(i + 1); } else if (ev.key === 'ArrowLeft') go(i - 1); });
  }
  function setPause(p, hold) { paused = p; if (hold) root.dataset.hold = '1'; const b = root.querySelector('[data-st="pause"]'); b.textContent = p ? '▶' : '❚❚'; b.setAttribute('aria-label', p ? 'Play' : 'Pause'); if (!p) t0 = performance.now() - (root._prog || 0) * DUR; }
  function paint() {
    root.querySelector('.kx-st-bars').innerHTML = slides.map((s, k) => `<span><i style="width:${k < i ? 100 : 0}%"></i></span>`).join('');
    root.querySelector('.kx-st-stage').innerHTML = slideHTML(slides[i], i);
    root.querySelector('.kx-st-name small').textContent = `${i + 1} of ${slides.length}${O.sub ? ' · ' + O.sub : ''}`;
    root._prog = 0; t0 = performance.now();
  }
  function go(k) {
    if (k < 0) k = 0;
    if (k >= slides.length) { markSeen(); close(); return; }
    i = k; paint(); if (window.HAPTIC) HAPTIC.tick();
  }
  function tick() {
    raf = requestAnimationFrame(tick);
    if (!root || root.hidden) return;
    const bar = root.querySelector('.kx-st-bars span:nth-child(' + (i + 1) + ') i'); if (!bar) return;
    if (reduced()) { bar.style.width = '100%'; return; }
    if (paused) return;
    const p = Math.min(1, (performance.now() - t0) / DUR); root._prog = p; bar.style.width = (p * 100).toFixed(1) + '%';
    if (p >= 1) go(i + 1);
  }
  function listen() {
    if (!('speechSynthesis' in window)) { if (window.ALERT) ALERT.toast({ title: 'Reading aloud is not available in this browser' }); return; }
    speechSynthesis.cancel(); setPause(true);
    slides.slice(i).forEach(s => { const u = new SpeechSynthesisUtterance([s.kicker, s.title, s.value, s.sub].filter(Boolean).join('. ')); u.rate = 1.02; speechSynthesis.speak(u); });
  }
  function markSeen() { try { localStorage.setItem(SK(), today()); } catch (e) { /* ignore */ } if (ringBtn) ringBtn.classList.add('seen'); }
  function open(list) {
    slides = (list || (O.slides ? O.slides() : [])).filter(Boolean); if (!slides.length) return;
    if (!root) build();
    last = document.activeElement; i = 0; paused = false; root.hidden = false; document.documentElement.classList.add('kx-lock'); paint();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    setTimeout(() => { const c = root.querySelector('[data-st="close"]'); if (c) c.focus(); }, 30);
  }
  function close() {
    if (!root || root.hidden) return; root.hidden = true; cancelAnimationFrame(raf); document.documentElement.classList.remove('kx-lock');
    try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    if (i >= slides.length - 1) markSeen();
    if (last && last.focus) try { last.focus(); } catch (e) { /* ignore */ }
  }
  function mount(o) {
    O = o || {};
    const host = typeof O.host === 'string' ? document.querySelector(O.host) : O.host;
    if (host) {
      ringBtn = document.createElement('button'); ringBtn.type = 'button'; ringBtn.className = 'kx-st-ring' + (seenToday() ? ' seen' : '');
      ringBtn.setAttribute('aria-label', (O.title || "Today's briefing") + ': open the stories');
      ringBtn.innerHTML = `<span class="kx-st-ring-av" aria-hidden="true">${esc(O.mark || 'P')}</span><span class="kx-st-ring-lbl">${esc(O.label || 'Today')}</span>`;
      ringBtn.addEventListener('click', () => open());
      if (O.prepend) host.prepend(ringBtn); else host.appendChild(ringBtn);
    }
    return { open };
  }
  return { mount, open, close };
})();

window.STORY = STORY;
