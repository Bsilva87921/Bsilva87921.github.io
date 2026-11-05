/* =====================================================================
   3D tile emblems: a small animated CSS 3D scene for every game.
   Scenes animate only while their tile is on screen. A few carry live
   data (flip digits, prices, candles, letters, gauge) from one ticker.
   ===================================================================== */
const EMB = (() => {
  const I = (cls, kids = '', style = '') => `<i class="${cls}"${style ? ` style="${style}"` : ''}>${kids}</i>`;
  const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');
  const flap = d => I('u', `<b>${d}</b>`) + I('l', `<b>${d}</b>`) + I('fu', `<b>${d}</b>`) + I('fl', `<b>${d}</b>`);
  const DEALS = [['$4.99', '$3.99', '−20%'], ['$12', '$9', '−25%'], ['$2.50', '$2', '−20%'], ['$80', '$60', '−25%'], ['$1.60', '$1.20', '−25%']];
  const WORD = [['W', 4], ['O', 1], ['R', 1], ['D', 2]];
  const SCENES = {
    memory: () => I('mm-grid', [['●', 0, 0], ['▲', 1, 0], ['▲', 0, 1], ['●', 1, 1]]
      .map(([k, x, y], i) => I('mm-c', I('f') + I('k', k), `--x:${8 + x * 30}px;--y:${8 + y * 30}px;--d:${(i * 0.65).toFixed(2)}s`)).join('')),
    clash: () => I('cc-shadow') + I('cc-cube', [['rotateY(0deg)', '#ef4444', '#3b82f6', 'RED'], ['rotateY(90deg)', '#3b82f6', '#facc15', 'BLUE'], ['rotateY(180deg)', '#22c55e', '#ef4444', 'GREEN'],
      ['rotateY(-90deg)', '#ec4899', '#22c55e', 'PINK'], ['rotateX(90deg)', '#facc15', '#ec4899', 'GOLD'], ['rotateX(-90deg)', '#06b6d4', '#a855f7', 'CYAN']]
      .map(([t, fc, wc, w]) => I('cc-f', `<b>${w}</b>`, `--t:${t};--fc:${fc};--wc:${wc}`)).join('')),
    pattern: () => I('pp-plane', rep(9, i => { const x = i % 3, y = Math.floor(i / 3); return I('pp-b' + ((x + y) % 2 ? ' alt' : ''), I('w'), `--x:${x * 17}px;--y:${y * 17}px;--d:${((x + y) * 0.17).toFixed(2)}s`); })),
    sprint: () => I('sf-op', I('o1', '×') + I('o2', '+')) + I('sf-row', I('sf', flap(4)) + I('sf', flap(2))),
    target: () => I('tg-board', I('r r1') + I('r r2') + I('r r3')) +
      I('tg-dart', '<svg viewBox="0 0 40 12" aria-hidden="true"><path d="M0 6l7-2.6v5.2z" fill="#cbd5e1"/><rect x="6" y="5.2" width="24" height="1.6" rx=".8" fill="currentColor"/><path d="M27 6l10-5 3 .6-6.5 4.4 6.5 4.4-3 .6z" fill="currentColor" opacity=".85"/></svg>'),
    launch: () => I('pl-stars', I('') + I('') + I('')) + I('pl-grp', I('pl-planet') + I('pl-ring') + I('pl-orbit', I('pl-arm', I('pl-moon')))),
    formula: () => I('at-grp', I('at-nuc') + [[0, 2.2], [60, 2.9], [120, 3.6]].map(([r, t]) => I('at-o', I('at-p', I('at-e')), `--r:${r}deg;--t:${t}s`)).join('')),
    estimate: () => I('es-dial', I('es-face', '<svg viewBox="0 0 64 38" aria-hidden="true"><path d="M6 34a26 26 0 0 1 52 0" fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width="5" stroke-linecap="round"/><path d="M6 34a26 26 0 0 1 52 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-dasharray="40 200"/><path d="M11 34a21 21 0 0 1 42 0" fill="none" stroke="currentColor" stroke-opacity=".7" stroke-width="2.4" stroke-dasharray="1.2 5.4"/></svg>') +
      I('es-needle') + I('es-hub')) + '<b class="es-read">≈ 62%</b>',
    shopper: () => I('sh-pend', I('sh-str') + I('sh-tag', I('sh-face sh-f', I('hole') + '<s>$4.99</s><b>$3.99</b>') + I('sh-face sh-b', I('hole') + '<b>SALE</b><small>−20%</small>'))),
    globe: () => I('gl-glow') + I('gl-ax', I('gl-spin', rep(6, i => I('gl-m', '', `--r:${i * 30}deg`)) +
      [[0, 50], [-14, 41.4], [14, 41.4]].map(([y, s]) => I('gl-p', '', `--y:${y}px;--s:${s}px`)).join('') +
      [[20, 25], [80, -10], [150, 35], [230, 5], [300, -30]].map(([lo, la]) => I('gl-dot', '', `--lon:${lo}deg;--lat:${la}deg`)).join(''))) + I('gl-pin'),
    robot: () => I('rb-board', rep(9, i => I('rb-t', '', `--x:${(i % 3) * 16}px;--y:${Math.floor(i / 3) * 16}px`)) + I('rb-gem') + I('rb-bot', I('top', I('eye')) + I('s') + I('w'))),
    tracer: () => I('ct-grp', I('ct-pane p3') + I('ct-pane p2') + I('ct-pane p1', I('ct-dots', I('') + I('') + I('')) +
      [[60, 0, 'var(--dc)'], [42, 8, '#f472b6'], [52, 8, '#fbbf24'], [34, 16, '#22d3ee'], [46, 0, 'var(--dc)']].map(([w, x, c], i) => I('ln', '', `--w:${w}%;--ind:${x}px;--c:${c};--row:${i}`)).join('') + I('ct-caret')) + '<b class="ct-out">→ 42</b>'),
    elements: () => I('el-shadow') + I('el-cube', [['rotateY(0deg)', '#22d3ee', 1, 'H'], ['rotateY(90deg)', '#94a3b8', 6, 'C'], ['rotateY(180deg)', '#f87171', 8, 'O'],
      ['rotateY(-90deg)', '#a78bfa', 11, 'Na'], ['rotateX(90deg)', '#fb923c', 26, 'Fe'], ['rotateX(-90deg)', '#fbbf24', 79, 'Au']]
      .map(([t, c, n, s]) => I('el-f', `<small>${n}</small><b>${s}</b>`, `--t:${t};--c:${c}`)).join('')),
    science: () => I('dn-tilt', I('dn-spin', rep(8, i => I('dn-r', I('a') + I('b'), `--i:${i}`)))),
    market: () => I('mk-grp', I('mk-base') + rep(6, i => I('mk-c up', I('wk') + I('fr') + I('sd') + I('tp'), `--x:${4 + i * 10}px;--h:${10 + (i * 7) % 13}px;--o:${8 + (i * 5) % 14}px`))),
    money: () => I('mo-shadow') + I('mo-tilt', I('mo-coin', I('fa', '<b>$</b>') + rep(5, i => I('ed', '', `--z:${i - 2}px`)) + I('fb', '<b>¢</b>'))) + I('mo-spark'),
    econ: () => I('ec-plane', I('ax') + I('ln sup') + I('dw', I('ln dem')) + I('eq') + '<small class="lb s">S</small><small class="lb d">D</small>') +
      I('ec-bolt', '<svg viewBox="0 0 16 24" aria-hidden="true"><path d="M10 0L1 14h6l-2 10 10-15H9z" fill="#facc15" stroke="#f59e0b" stroke-width="1" stroke-linejoin="round"/></svg>'),
    tycoon: () => I('ty-scene', I('ty-base', I('ty-front', I('win') + I('door') + I('ty-awn')) + I('ty-coin c1') + I('ty-coin c2'))),
    breakeven: () => I('be-grp', I('be-base') + I('be-post') + I('be-beam', I('be-hang l', I('be-ch') + I('be-pan', I('be-box'))) + I('be-hang r', I('be-ch') + I('be-pan', I('be-coins')))) + '<b class="be-eq">=</b>'),
    scramble: () => I('ws-row', WORD.map(([ch, pts], i) => I('ws-t', I('ws-in', `<b>${ch}</b><small>${pts}</small>`), `--x:${i * 17}px`)).join('')),
    lexicon: () => I('lx-book', I('lx-pg l') + I('lx-pg r') + rep(3, i => I('lx-flip', '', `--d:${(i * 1.1).toFixed(1)}s`))) + '<b class="lx-aa">Aa</b>'
  };

  /* Live data for a few scenes. Each receives the instance { el, st }. */
  const TICK = {
    sprint(inst) {
      const st = inst.st, cells = $$('.sf', inst.el);
      const a = 2 + Math.floor(Math.random() * 8), b = 2 + Math.floor(Math.random() * 8);
      const next = String(a * b).padStart(2, '0');
      const prev = st.v || '42'; st.v = next;
      cells.forEach((c, i) => {
        const o = prev[i], n = next[i];
        if (o === n) return;
        $('.fu b', c).textContent = o; $('.u b', c).textContent = n; $('.fl b', c).textContent = n; $('.l b', c).textContent = o;
        c.classList.remove('go'); void c.offsetWidth; c.classList.add('go');
        clearTimeout(c._t); c._t = setTimeout(() => { $('.l b', c).textContent = n; }, 640);
      });
    },
    estimate(inst) {
      const a = Math.round(-68 + Math.random() * 136);
      inst.el.style.setProperty('--a', a + 'deg');
      const r = $('.es-read', inst.el); if (r) r.textContent = '≈ ' + Math.round((a + 90) / 180 * 100) + '%';
    },
    shopper(inst) {
      const st = inst.st; st.k = ((st.k || 0) + 1) % (DEALS.length * 2);
      if (st.k % 2) return;            // change the deal every other tick, while the back faces you
      const [was, now, off] = DEALS[st.k / 2];
      const f = $('.sh-f', inst.el), b = $('.sh-b', inst.el);
      if (f) { $('s', f).textContent = was; $('b', f).textContent = now; }
      if (b) $('small', b).textContent = off;
    },
    market(inst) {
      const st = inst.st;
      if (!st.px) { st.px = [50]; for (let i = 0; i < 6; i++) st.px.push(st.px[i] + (Math.random() - 0.45) * 14); }
      st.px.shift(); st.px.push(clamp(st.px[st.px.length - 1] + (Math.random() - 0.48) * 16, 12, 92));
      const lo = Math.min(...st.px), hi = Math.max(...st.px), k = 38 / Math.max(18, hi - lo);
      $$('.mk-c', inst.el).forEach((c, i) => {
        const o = st.px[i], cl = st.px[i + 1], up = cl >= o;
        c.classList.toggle('up', up); c.classList.toggle('dn', !up);
        c.style.setProperty('--o', (6 + (Math.min(o, cl) - lo) * k).toFixed(1) + 'px');
        c.style.setProperty('--h', Math.max(3, Math.abs(cl - o) * k).toFixed(1) + 'px');
      });
    },
    scramble(inst) {
      const st = inst.st; st.n = (st.n || 0) + 1;
      const solved = st.n % 3 === 0;
      let order = [0, 1, 2, 3];
      if (!solved) { do { order = order.slice().sort(() => Math.random() - 0.5); } while (order.join('') === '0123'); }
      const tiles = $$('.ws-t', inst.el);
      order.forEach((ti, slot) => {
        const t = tiles[ti]; if (!t) return;
        const x = slot * 17 + 'px';
        if (t.style.getPropertyValue('--x') !== x) { const inn = t.firstChild; inn.classList.remove('hop'); void inn.offsetWidth; inn.classList.add('hop'); }
        t.style.setProperty('--x', x);
      });
      inst.el.classList.toggle('solved', solved);
    }
  };

  const inst = new Set();
  let io = null, timer = 0;
  const motionOK = () => !reduceMotion();
  function observer() {
    if (io || typeof IntersectionObserver === 'undefined') return io;
    io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.target.isConnected) { io.unobserve(e.target); return; }
      e.target.classList.toggle('live', e.isIntersecting);
    }), { rootMargin: '60px 0px' });
    return io;
  }
  function tickOne(it, force) {
    const fn = TICK[it.id]; if (!fn) return;
    const now = performance.now();
    if (!force && now - (it.last || 0) < 900) return;
    it.last = now;
    try { fn(it); } catch (e) { /* a scene must never break the page */ }
  }
  function loop() {
    if (document.hidden || document.body.classList.contains('in-game')) return;
    for (const it of inst) {
      if (!it.el.isConnected) { inst.delete(it); continue; }
      if (it.tile.classList.contains('live')) tickOne(it);
    }
  }
  return {
    has: id => !!SCENES[id],
    el(id) {
      const make = SCENES[id];
      return h('span', { class: 'emb emb-' + id, 'aria-hidden': 'true', html: make ? make() : '' });
    },
    watch(tile, id, el) {
      const o = observer();
      if (o) o.observe(tile); else tile.classList.add('live');
      if (!el) return;
      const it = { id, el, tile, st: {}, last: 0 };
      if (id === 'tracer') {
        const caret = $('.ct-caret', el), out = $('.ct-out', el);
        if (caret && out) caret.addEventListener('animationiteration', () => { out.textContent = '→ ' + [3, 7, 12, 15, 21, 24, 42, 64, 81, 100][Math.floor(Math.random() * 10)]; });
      }
      if (!TICK[id] || !motionOK()) return;
      inst.add(it);
      tile.addEventListener('pointerenter', () => tickOne(it, true));
      if (!timer) timer = setInterval(loop, 1500);
    }
  };
})();
