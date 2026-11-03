/* Probable kit: the pinned Insights bar shared by the Probable sites. It stays at the top while the page scrolls and
   rotates through the site's key live insights; each one can jump to where it comes from or go to Ask AI.
   Auto-rotation pauses on hover, on keyboard focus, with the pause button, and starts paused for reduced motion. */
const INS = (() => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let root = null, items = [], i = 0, timer = null, held = false, paused = false, O = {}, sig = '';
  const ICON = { up: '▲', down: '▼', warn: '!', live: '●', info: '✦' };
  function mount(opts) {
    O = Object.assign({ interval: 7000 }, opts || {});
    if (root) return;
    root = document.createElement('div');
    root.className = 'ins'; root.id = 'insBar';
    root.setAttribute('role', 'region'); root.setAttribute('aria-roledescription', 'carousel'); root.setAttribute('aria-label', 'Insights');
    root.innerHTML = `<div class="ins-in">
      <span class="ins-stk" aria-hidden="true"><svg viewBox="0 0 16 16" width="13" height="13"><path d="M8 0l1.8 5.2L15 7l-5.2 1.8L8 14l-1.8-5.2L1 7l5.2-1.8z" fill="currentColor"/></svg>Insights</span>
      <div class="ins-view" aria-live="off"></div>
      <div class="ins-ctl">
        <button type="button" class="ins-b" data-ins="prev" aria-label="Previous insight">‹</button>
        <span class="ins-n" aria-hidden="true"></span>
        <button type="button" class="ins-b" data-ins="next" aria-label="Next insight">›</button>
        <button type="button" class="ins-b ins-p" data-ins="pause" aria-pressed="false" aria-label="Pause insights">❚❚</button>
        <button type="button" class="ins-b ins-sh" data-ins="share" aria-label="Share this insight" title="Share" hidden><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v6h14v-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button type="button" class="ins-ask" data-ins="ask"><span aria-hidden="true">✦</span> Ask AI</button>
      </div></div><i class="ins-prog" aria-hidden="true"></i>`;
    (O.parent || document.body).insertBefore(root, (O.parent || document.body).firstChild);
    paused = reduce() || O.paused === true;
    if (O.share) root.querySelector('.ins-sh').hidden = false;
    root.addEventListener('click', onClick);
    root.addEventListener('mouseenter', () => { held = true; sync(); });
    root.addEventListener('mouseleave', () => { held = false; sync(); });
    root.addEventListener('focusin', () => { held = true; sync(); });
    root.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) { held = false; sync(); } });
    document.addEventListener('visibilitychange', sync);
    paintPause();
  }
  function onClick(e) {
    const b = e.target.closest('[data-ins]'); if (!b) return;
    const a = b.dataset.ins, it = items[i];
    if (a === 'prev' || a === 'next') { go(a === 'next' ? 1 : -1, true); return; }
    if (a === 'pause') { paused = !paused; paintPause(); sync(); return; }
    if (a === 'ask') { if (O.ask) O.ask(it && it.ask ? it.ask : ''); return; }
    if (a === 'share') { if (O.share && it) O.share(it); return; }
    if (a === 'go' && it) { if (typeof it.go === 'function') it.go(); else if (O.go) O.go(it); }
  }
  function paintPause() {
    const p = root && root.querySelector('.ins-p'); if (!p) return;
    p.setAttribute('aria-pressed', String(paused)); p.setAttribute('aria-label', paused ? 'Play insights' : 'Pause insights'); p.textContent = paused ? '▶' : '❚❚';
    root.classList.toggle('ins-paused', paused);
  }
  function set(list) {
    const next = (list || []).filter(x => x && x.text);
    const s = next.map(x => x.id + '|' + x.text + '|' + (x.val || '')).join('\n');
    if (s === sig) return; sig = s;
    const cur = items[i] && items[i].id;
    items = next; const k = items.findIndex(x => x.id === cur); i = k >= 0 ? k : 0;
    if (!root) return;
    root.hidden = !items.length;
    render(false); sync();
  }
  function render(announce) {
    const v = root.querySelector('.ins-view'), it = items[i]; if (!it) { v.innerHTML = ''; return; }
    v.setAttribute('aria-live', announce ? 'polite' : 'off');
    const tone = it.tone || 'info';
    v.innerHTML = `<button type="button" class="ins-item ins-${esc(tone)}" data-ins="go" title="${esc(it.text + (it.val ? ' ' + it.val : ''))}">${it.tag ? `<span class="ins-tag"><span aria-hidden="true">${ICON[tone] || ICON.info}</span>${esc(it.tag)}</span>` : ''}<span class="ins-txt">${esc(it.text)}</span>${it.val ? `<b class="ins-val">${esc(it.val)}</b>` : ''}</button>`;
    root.querySelector('.ins-n').textContent = items.length > 1 ? (i + 1) + '/' + items.length : '';
    root.querySelectorAll('[data-ins=prev],[data-ins=next],.ins-p,.ins-n').forEach(b => { b.hidden = items.length < 2; });
    const prog = root.querySelector('.ins-prog'); prog.style.animation = 'none'; void prog.offsetWidth; prog.style.animation = '';
    root.style.setProperty('--ins-dur', (O.interval / 1000) + 's');
  }
  function go(d, manual) { if (!items.length) return; i = (i + d + items.length) % items.length; render(!!manual); sync(); }
  function sync() {
    clearTimeout(timer);
    const run = !paused && !held && !document.hidden && items.length > 1;
    if (root) root.classList.toggle('ins-run', run);
    if (run) timer = setTimeout(() => go(1, false), O.interval);
  }
  return { mount, set, go: d => go(d, true), get items() { return items; }, get current() { return items[i] || null; }, get el() { return root; } };
})();
