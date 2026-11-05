/* =====================================================================
   Guided tour: a spotlight that glides between parts of the app and a
   3D card that turns over for each step, led by a little guide cube.
   ===================================================================== */
const Tour = (() => {
  let root = null, card = null, spot = null, steps = [], i = 0, raf = 0, lastKey = '', busy = false, returnFocus = null, onKeyRef = null;
  const isVis = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(el).visibility !== 'hidden'; };
  const pick = sels => { for (const s of [].concat(sels || [])) { const el = $(s); if (isVis(el)) return el; } return null; };
  const FACES = [[0, 0], [0, -90], [0, -180], [0, -270], [-90, -360], [90, -360], [0, -450], [0, -540], [-90, -720], [0, -720], [0, -810]];

  function defs() {
    const list = [
      { id: 'welcome', center: true, art: 'carousel', title: 'Welcome to Polymath Arcade',
        body: `${GAMES.length} quick games across ${DOMAIN_ORDER.length} subjects, from mental math to supply and demand. This short tour shows you around.`,
        note: 'A Probable app by Bruno Silva', next: 'Start the tour', back: 'Not now' },
      { id: 'card', sel: '.hero .pwrap', optional: true, title: 'Your player card',
        body: 'Every round earns XP. Climb ten ranks, from Rookie to Polymath. Tap the card to flip it and see your lab record.' },
      { id: 'stats', sel: '.hero-stats', title: 'Goal, streak and badges',
        body: `Play 3 rounds a day to hit your daily goal, come back tomorrow to grow your streak, and unlock ${BADGES.length} badges on the way.` },
      { id: 'daily', sel: '.holo', title: 'The Daily Challenge',
        body: 'One question from every subject, the same set for everyone today. Your first finish each day earns double XP.' },
      { id: 'legend', sel: '.legend', title: 'Filter by subject',
        body: 'Jump straight to Math, Coding, Finance or any of the ten subjects.' },
      { id: 'tile', sel: '#gameTable .tile', title: 'Every tile is a game', pad: 8,
        body: 'Each one has its own living 3D emblem. Open a tile for the rules, your best score and the skills it trains. Stars and the level bar track your progress.' },
      { id: 'tabs', sel: '.tabbar', title: 'Three places to go',
        body: 'Games, today’s Daily Challenge, and your Profile with the skill radar, subject levels and badges.' },
      { id: 'install', sel: '#installBtn', title: 'Install the app', optional: true,
        body: 'Add Polymath Arcade to your home screen or desktop. It opens full screen and works offline.' },
      { id: 'tools', sel: '.top-actions', title: 'Make it yours',
        body: 'Your streak lives up here, along with sound on or off and the light and dark switch.' },
      { id: 'done', center: true, art: 'finale', title: 'You’re all set',
        body: 'Warm up with a round of Memory Matrix, or explore on your own. Every game adapts to you as you play. Replay this tour any time from the Tour button.',
        next: 'Play Memory Matrix', back: 'Explore', finale: true }
    ];
    return list.filter(s => s.center || !s.optional || pick(s.sel));
  }

  function build() {
    root = h('div', { class: 'tour' });
    const block = h('div', { class: 'tour-block' });
    spot = h('div', { class: 'tour-spot', 'aria-hidden': 'true' }, h('i', { class: 'tour-ring' }));
    card = h('div', { class: 'tour-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tourTitle' },
      h('div', { class: 'tc-in' },
        h('div', { class: 'tc-head' },
          h('span', { class: 'tc-guide', 'aria-hidden': 'true' }, h('span', { class: 'cube mini' }, ...['Pm', 'XP', 'Dc', 'Aa', 'Go', '✓'].map(t => h('i', null, t)))),
          h('span', { class: 'tc-step' }),
          h('button', { class: 'tc-skip', type: 'button', onclick: () => end() }, 'Skip tour')),
        h('div', { class: 'tc-art', 'aria-hidden': 'true' }),
        h('h3', { id: 'tourTitle' }),
        h('p', { class: 'tc-body', 'aria-live': 'polite' }),
        h('p', { class: 'tc-note' }),
        h('div', { class: 'tc-foot' },
          h('div', { class: 'tc-dots', 'aria-hidden': 'true' }),
          h('div', { class: 'tc-btns' },
            h('button', { class: 'btn ghost small tc-back', type: 'button', onclick: () => back() }),
            h('button', { class: 'btn primary small tc-next', type: 'button', onclick: () => next() })))));
    root.append(block, spot, card);
    document.body.append(root);
    requestAnimationFrame(() => root.classList.add('on'));
  }

  function artFor(s) {
    if (s.art === 'carousel') {
      return h('div', { class: 'tc-carousel' }, h('div', { class: 'car-tilt' }, h('div', { class: 'car-ring' },
        DOMAIN_ORDER.map((d, k) => h('span', { class: 'car-card', style: `--i:${k};--dc:var(--d-${d})` },
          h('span', { class: 'cc-ico', html: sigilSVG(GAMES.find(g => g.domain === d).id) }), h('b', null, DOMAINS[d]))))));
    }
    if (s.art === 'finale') return h('div', { class: 'tc-finale' }, h('span', { class: 'cube big' }, ...['Pm', 'Ar', 'Ec', 'Rc', 'Ms', 'Lx'].map(t => h('i', null, t))));
    return null;
  }

  function fill(s, k) {
    $('.tc-step', card).textContent = s.center && k === 0 ? 'Quick tour' : `Step ${k + 1} of ${steps.length}`;
    const art = $('.tc-art', card); art.innerHTML = ''; const a = artFor(s); if (a) art.append(a);
    art.hidden = !a;
    $('#tourTitle', card).textContent = s.title;
    $('.tc-body', card).textContent = s.body;
    const note = $('.tc-note', card); note.textContent = s.note || ''; note.hidden = !s.note;
    const bk = $('.tc-back', card), nx = $('.tc-next', card);
    bk.textContent = s.back || 'Back'; bk.hidden = !s.back && k === 0;
    nx.textContent = s.next || (k === steps.length - 1 ? 'Finish' : 'Next');
    $('.tc-skip', card).hidden = k === 0 || k === steps.length - 1;
    $('.tc-dots', card).innerHTML = steps.map((_, j) => `<i class="${j === k ? 'on' : j < k ? 'past' : ''}"></i>`).join('');
    const [fx, fy] = FACES[k % FACES.length];
    $('.tc-guide .cube', card).style.transform = `rotateX(${fx}deg) rotateY(${fy}deg)`;
    card.classList.toggle('wide', !!s.center);
  }

  function inView(el) {
    const r = el.getBoundingClientRect(), top = 76, bottom = innerHeight - 96;
    return r.top >= top && r.bottom <= bottom;
  }

  function show(k, dir = 1) {
    if (busy) return;
    const s = steps[k]; if (!s) return;
    i = k; busy = true;
    const target = s.center ? null : pick(s.sel);
    if (target && getComputedStyle(target).position !== 'fixed' && !target.closest('.topbar,.tabbar') && !inView(target)) {
      target.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
    }
    const swap = () => {
      fill(s, k);
      card.classList.add('snap');
      card.classList.remove('out-l', 'out-r');
      card.classList.add(dir > 0 ? 'in-r' : 'in-l');
      void card.offsetWidth;
      card.classList.remove('snap', 'in-r', 'in-l');
      lastKey = '';
      busy = false;
      const f = $('.tc-next', card); if (f) f.focus({ preventScroll: true });
      if (s.finale && !reduceMotion()) setTimeout(() => { FX.burst(150); SFX.win(); }, 260);
    };
    if (root.dataset.started) {
      card.classList.add(dir > 0 ? 'out-l' : 'out-r');
      setTimeout(swap, reduceMotion() ? 0 : 200);
    } else { root.dataset.started = '1'; swap(); }
    root._target = target; root._pad = s.pad ?? 10;
  }

  function place() {
    if (!root) return;
    raf = requestAnimationFrame(place);
    const t = root._target, pad = root._pad || 10, W = innerWidth, H = innerHeight;
    let x = 0, y = 0, w = 0, hh = 0, rad = 24;
    const live = t && t.isConnected;
    if (live) {
      const r = t.getBoundingClientRect(), cs = getComputedStyle(t);
      x = r.left - pad; y = r.top - pad; w = r.width + pad * 2; hh = r.height + pad * 2;
      rad = (parseFloat(cs.borderTopLeftRadius) || 12) + pad;
    }
    const narrow = W < 600, cw = Math.min(narrow ? W - 24 : (live ? 372 : 430), W - 24), ch = card.offsetHeight || 260;
    let cx, cy;
    if (!live) { cx = (W - cw) / 2; cy = Math.max(12, (H - ch) / 2); x = cx; y = cy; w = cw; hh = ch; }
    else if (narrow) {
      cx = 12;
      const below = y + hh + 14, above = y - ch - 14;
      cy = (y + hh / 2 > H * 0.55 && above > 12) ? above : (below + ch < H - 12 ? below : (above > 12 ? above : H - ch - 12));
    } else {
      cx = clamp(x + w / 2 - cw / 2, 12, W - cw - 12);
      if (y + hh + 16 + ch < H - 12) cy = y + hh + 16;
      else if (y - 16 - ch > 12) cy = y - 16 - ch;
      else { cy = clamp(y + hh / 2 - ch / 2, 12, H - ch - 12); cx = x + w + 18 + cw < W - 12 ? x + w + 18 : Math.max(12, x - 18 - cw); }
    }
    const key = [x, y, w, hh, cx, cy, cw].map(v => Math.round(v)).join(',');
    if (key === lastKey) return;
    lastKey = key;
    Object.assign(spot.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px', borderRadius: rad + 'px' });
    Object.assign(card.style, { left: cx + 'px', top: cy + 'px', width: cw + 'px' });
  }

  function next() {
    if (busy) return;
    SFX.click();
    const s = steps[i];
    if (s && s.finale) { end(); openIntro('memory'); return; }
    if (i >= steps.length - 1) { end(); return; }
    show(i + 1, 1);
  }
  function back() {
    if (busy) return;
    SFX.click();
    const s = steps[i];
    if (s && s.finale) { end(); return; }
    if (i === 0) { end(); return; }
    show(i - 1, -1);
  }
  function onKey(e) {
    if (!root) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); next(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); back(); return; }
    if (e.key === 'Tab') {
      const f = $$('button:not([hidden])', card).filter(b => b.offsetParent !== null);
      if (!f.length) return;
      const a = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(a + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  }
  function end() {
    if (!root) return;
    cancelAnimationFrame(raf); raf = 0;
    document.removeEventListener('keydown', onKeyRef, true);
    const r = root; root = null; card = null; spot = null; busy = false;
    r.classList.remove('on');
    setTimeout(() => r.remove(), reduceMotion() ? 0 : 320);
    if (!S.tour) { S.tour = 1; persist(); }
    try { (returnFocus && returnFocus.isConnected ? returnFocus : $('#tourBtn')).focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function start(opts = {}) {
    if (root || CUR) return;
    returnFocus = document.activeElement;
    if (!$('#modal').hidden) closeModal();
    const begin = () => {
      steps = defs(); i = 0;
      try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (e) { window.scrollTo(0, 0); }
      build();
      onKeyRef = onKey;
      document.addEventListener('keydown', onKeyRef, true);
      show(0, 1);
      place();
    };
    if (VIEW !== 'home' || FILTER !== 'all') { FILTER = 'all'; VIEW = 'home'; render(); setTimeout(begin, 80); }
    else begin();
  }
  return { start, end, get active() { return !!root; } };
})();
