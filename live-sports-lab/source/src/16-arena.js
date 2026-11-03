/* ==========================================================================
   Probable — Live scoreboard (3D hero on the Live board). A ring of game
   cards that turns one card at a time: league, clock, both teams with their
   scores, and a win-chance bar in team colors. Live games glow and come
   first. Uses the shared Probable 3D bundle (WebGPU with a WebGL 2 fallback)
   and keeps a 2D summary when the browser can't draw it.
   ========================================================================== */
(function () {
  'use strict';
  const APP = window.APP, S = APP.S, LG = APP.LG, esc = APP.esc;
  const WIN = [-10, 30];                                   // hours around now
  let el = null, ctl = null, mounting = false, lastSig = '', failed = false;

  function build() {
    if (el) return el;
    el = document.createElement('section');
    el.className = 'arena'; el.id = 'arena'; el.setAttribute('aria-label', 'Live scoreboard: every game as a 3D card');
    el.innerHTML = `<div class="wrap arena-in">
      <div class="arena-copy">
        <span class="arena-eyebrow"><i class="arena-dot" aria-hidden="true"></i>Live scoreboard · 3D</span>
        <h2 class="arena-h">Every game at a glance</h2>
        <p class="arena-lede">Each card is one game: the score, the clock and each team's chance to win right now. Live games glow and come first. Swipe or use the arrows to turn the board, and tap a card to open the game.</p>
        <div class="arena-stats" id="arenaStats"></div>
        <div class="arena-legend" aria-hidden="true"><span><i class="lg-live"></i>Live</span><span><i class="lg-pre"></i>Upcoming</span><span><i class="lg-post"></i>Final</span><span class="lg-split"><i></i>Bar = chance to win</span></div>
      </div>
      <div class="arena-stage px3d" id="arenaStage"><div class="px3d-fallback" id="arenaFb">Loading the 3D scoreboard…</div></div>
    </div>`;
    const mast = document.querySelector('.mast');
    mast.parentNode.insertBefore(el, mast.nextSibling);
    return el;
  }

  // the snapshot copy is drawn around the moment it was captured, the live board around now
  const nowRef = () => S.mode === 'snapshot' && S.capturedAt ? +new Date(S.capturedAt) : Date.now();
  function games() {
    const now = nowRef(), w0 = now + WIN[0] * 3600e3, w1 = now + WIN[1] * 3600e3;
    return APP.allGames().filter(g => !g.void && g.start && +new Date(g.start) >= w0 - 3 * 3600e3 && +new Date(g.start) <= w1);
  }
  function card(g) {
    const P = APP.predict(g), live = g.state === 'in', R = live ? P.now : P.pre;
    const pD = R.pD || 0, pH = R.pH, pA = R.pA != null ? R.pA : 1 - pH - pD;
    const side = t => ({ abbr: t.abbr, name: t.name, sub: t.record || '', color: APP.teamColor(g.lg, t), score: t.score, winner: !!t.winner });
    const note = g.state === 'post' ? ((/(OT|SO|AET|Pen)/i.exec(g.detail || '') || [])[1] || '') : '';
    return {
      id: g.id, lg: g.lg, league: LG[g.lg].short || LG[g.lg].name, state: g.state, t: +new Date(g.start),
      status: live ? (g.detail || 'Live') : g.state === 'pre' ? APP.when(g.start) : 'Final', statusNote: note,
      away: side(g.away), home: side(g.home), pH, pA, pD,
      fav: APP.favs ? APP.favs.game(g) : false
    };
  }
  function data() {
    const now = nowRef();
    const all = games().map(card);
    const live = all.filter(c => c.state === 'in').sort((a, b) => (b.fav - a.fav) || Math.abs(a.pH - a.pA) - Math.abs(b.pH - b.pA));
    const pre = all.filter(c => c.state === 'pre').sort((a, b) => (b.fav - a.fav) || a.t - b.t);
    const post = all.filter(c => c.state === 'post').sort((a, b) => (b.fav - a.fav) || b.t - a.t);
    const pick = [...live, ...pre.slice(0, Math.max(4, 12 - live.length)), ...post.slice(0, 4)].slice(0, 16);
    return { now, games: pick, all };
  }
  function stats(d) {
    const live = d.all.filter(g => g.state === 'in').length, up = d.all.filter(g => g.state === 'pre' && g.t - d.now < 24 * 3600e3).length;
    const fin = d.all.filter(g => g.state === 'post').length;
    const close = d.all.filter(g => g.state === 'in').sort((a, b) => Math.abs(a.pH - a.pA) - Math.abs(b.pH - b.pA))[0];
    const cap = S.mode === 'snapshot';
    return `<div class="astat"><b data-count>${live}</b><span>${cap ? 'live at capture' : 'live now'}</span></div><div class="astat"><b data-count>${up}</b><span>in the next 24 h</span></div><div class="astat"><b data-count>${fin}</b><span>final, last 10 h</span></div>` +
      (close ? `<button type="button" class="astat astat-btn" data-game="${esc(close.id)}"><b>${Math.round(Math.max(close.pH, close.pA) * 100)}%</b><span>closest live: ${esc(close.away.abbr)}–${esc(close.home.abbr)}</span></button>` : '');
  }
  async function mount(d) {
    if (ctl || mounting || failed) return;
    mounting = true;
    const stage = document.getElementById('arenaStage'), fb = document.getElementById('arenaFb');
    try {
      ctl = await window.PX3D.mount(stage, 'carousel', d, {
        bg: getComputedStyle(document.documentElement).getPropertyValue('--arena-bg').trim() || '#0a1120',
        accent: '#FFB547',
        onPick: g => { if (g && g.id) { if (window.HAPTIC) HAPTIC.tap(); APP.openGame(g.id); } },
        onFail: () => { failed = true; }
      });
      const badge = document.createElement('span'); badge.className = 'px3d-badge'; badge.textContent = ctl.backend === 'WebGPU' ? 'WebGPU' : 'WebGL 2'; stage.appendChild(badge);
      const nav = (cls, k, label, txt) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'px3d-nav ' + cls; b.setAttribute('aria-label', label); b.textContent = txt; b.addEventListener('click', () => { ctl.step(k); if (window.HAPTIC) HAPTIC.tick(); }); stage.appendChild(b); return b; };
      nav('prev', -1, 'Previous game', '‹'); nav('next', 1, 'Next game', '›');
      stage.classList.toggle('few', d.games.length <= 4);
      window.PX3D.motionToggle(stage, ctl);
    } catch (e) {
      failed = true;
      if (fb) fb.textContent = 'This browser can’t draw the 3D scoreboard, so the board below has everything.';
      el.classList.add('arena-2d');
    } finally { mounting = false; }
  }
  function refresh(kind, tab) {
    if (S.mode === 'loading') return;
    build();
    const show = tab === 'board' && !S.q;
    el.hidden = !show;
    if (!show) return;
    const d = data();
    const sig = d.games.map(g => [g.id, g.state, g.status, g.away.score, g.home.score, Math.round(g.pH * 100), g.fav ? 1 : 0].join(':')).join(',');
    document.getElementById('arenaStats').innerHTML = stats(d);
    if (sig === lastSig && ctl) return; lastSig = sig;
    const stage = document.getElementById('arenaStage'); if (stage) stage.classList.toggle('few', d.games.length <= 4);
    if (ctl) ctl.update(d);
    else if (window.PX3D) window.PX3D.idle(() => mount(d));
  }
  APP.onRender.push(refresh);
  APP.arena = { data, get ctl() { return ctl; }, refresh: () => { lastSig = ''; refresh('board', S.tab); } };
})();
