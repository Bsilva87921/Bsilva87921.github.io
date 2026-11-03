/* ==========================================================================
   Probable — Live arena (3D hero on the Live board). Every game in a 40-hour
   window on one timeline: lanes by sport, a glowing NOW line, one orb per
   game split by each team's win probability. Uses the shared Probable 3D
   bundle (WebGPU with a WebGL 2 fallback) and keeps a 2D summary when the
   browser can't draw it.
   ========================================================================== */
(function () {
  'use strict';
  const APP = window.APP, S = APP.S, LG = APP.LG, esc = APP.esc;
  const LANES = [['fb', 'Football'], ['bk', 'Basketball'], ['bb', 'Baseball'], ['hk', 'Hockey'], ['sc', 'Soccer']];
  const WIN = [-10, 30];                                   // hours around now
  let el = null, ctl = null, mounting = false, lastSig = '', failed = false;

  function build() {
    if (el) return el;
    el = document.createElement('section');
    el.className = 'arena'; el.id = 'arena'; el.setAttribute('aria-label', 'Live arena: every game on one 3D timeline');
    el.innerHTML = `<div class="wrap arena-in">
      <div class="arena-copy">
        <span class="arena-eyebrow"><i class="arena-dot" aria-hidden="true"></i>Live arena · 3D</span>
        <h2 class="arena-h">Every game, one timeline</h2>
        <p class="arena-lede">Each orb is a game, split between the two teams' colors by each side's chance to win. Live games glow on a beam of light; the line marks now. Drag to look around and tap an orb to open the game.</p>
        <div class="arena-stats" id="arenaStats"></div>
        <div class="arena-legend" aria-hidden="true"><span><i class="lg-live"></i>Live</span><span><i class="lg-pre"></i>Upcoming</span><span><i class="lg-post"></i>Final</span><span class="lg-split"><i></i>Color share = win chance</span></div>
      </div>
      <div class="arena-stage px3d" id="arenaStage"><div class="px3d-fallback" id="arenaFb">Loading the 3D arena…</div></div>
    </div>`;
    const mast = document.querySelector('.mast');
    mast.parentNode.insertBefore(el, mast.nextSibling);
    return el;
  }

  const laneOf = g => APP.kindOf(g.lg);
  function games() {
    const now = Date.now(), w0 = now + WIN[0] * 3600e3, w1 = now + WIN[1] * 3600e3;
    return APP.allGames().filter(g => !g.void && g.start && +new Date(g.start) >= w0 - 3 * 3600e3 && +new Date(g.start) <= w1);
  }
  function data() {
    const now = S.mode === 'snapshot' && S.capturedAt ? +new Date(S.capturedAt) : Date.now();
    const gs = games(), used = new Set(gs.map(laneOf));
    const out = gs.map(g => {
      const P = APP.predict(g), live = g.state === 'in', R = live ? P.now : P.pre;
      const pD = R.pD || 0, pH = R.pH, pA = R.pA != null ? R.pA : 1 - pH - pD;
      const sc = APP.kindOf(g.lg) === 'sc';
      const rh = APP.teamRank ? APP.teamRank(g, 'home') : null, ra = APP.teamRank ? APP.teamRank(g, 'away') : null;
      const rk = Math.min(rh ? rh.rank : 99, ra ? ra.rank : 99);
      const score = g.state === 'pre' ? '' : ` · ${g.away.abbr} ${g.away.score ?? 0}–${g.home.score ?? 0} ${g.home.abbr}`;
      return {
        id: g.id, lane: laneOf(g), t: +new Date(g.start), state: g.state, pH, pA, pD,
        cH: APP.teamColor(g.lg, g.home), cA: APP.teamColor(g.lg, g.away), hAbbr: g.home.abbr, aAbbr: g.away.abbr,
        title: sc ? `${g.home.name} vs ${g.away.name}` : `${g.away.name} at ${g.home.name}`,
        sub: `${LG[g.lg].short || LG[g.lg].name} · ${g.state === 'pre' ? APP.when(g.start) : g.detail || ''}${score}${g.state === 'post' ? ' · pregame odds' : ''}`,
        rank: g.state === 'in' ? 0 : rk
      };
    });
    return { now, games: out, lanes: LANES.filter(([k]) => used.has(k)).map(([id, label]) => ({ id, label })), window: [now + WIN[0] * 3600e3, now + WIN[1] * 3600e3] };
  }
  function stats(d) {
    const live = d.games.filter(g => g.state === 'in').length, up = d.games.filter(g => g.state === 'pre' && g.t - d.now < 24 * 3600e3).length;
    const fin = d.games.filter(g => g.state === 'post').length;
    const close = d.games.filter(g => g.state === 'in').sort((a, b) => Math.abs(a.pH - a.pA) - Math.abs(b.pH - b.pA))[0];
    const cap = S.mode === 'snapshot';
    return `<div class="astat"><b>${live}</b><span>${cap ? 'live at capture' : 'live now'}</span></div><div class="astat"><b>${up}</b><span>in the next 24 h</span></div><div class="astat"><b>${fin}</b><span>final, last 10 h</span></div>` +
      (close ? `<button type="button" class="astat astat-btn" data-game="${esc(close.id)}"><b>${Math.round(Math.max(close.pH, close.pA) * 100)}%</b><span>closest live: ${esc(close.aAbbr)}–${esc(close.hAbbr)}</span></button>` : '');
  }
  async function mount(d) {
    if (ctl || mounting || failed) return;
    mounting = true;
    const stage = document.getElementById('arenaStage'), fb = document.getElementById('arenaFb');
    try {
      ctl = await window.PX3D.mount(stage, 'arena', d, {
        bg: getComputedStyle(document.documentElement).getPropertyValue('--arena-bg').trim() || '#0a1120',
        accent: '#FFB547',
        onPick: g => { if (g && g.id) APP.openGame(g.id); },
        onFail: () => { failed = true; }
      });
      const badge = document.createElement('span'); badge.className = 'px3d-badge'; badge.textContent = ctl.backend === 'WebGPU' ? 'WebGPU' : 'WebGL 2'; stage.appendChild(badge);
      window.PX3D.motionToggle(stage, ctl);
    } catch (e) {
      failed = true;
      if (fb) fb.textContent = 'This browser can’t draw the 3D arena, so the board below has everything.';
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
    const sig = d.games.map(g => g.id + g.state + Math.round(g.pH * 100)).join(',') + '|' + Math.round(d.now / 600e3);
    document.getElementById('arenaStats').innerHTML = stats(d);
    if (sig === lastSig && ctl) return; lastSig = sig;
    if (ctl) ctl.update(d);
    else if (window.PX3D) window.PX3D.idle(() => mount(d));
  }
  APP.onRender.push(refresh);
  APP.arena = { data, get ctl() { return ctl; } };
})();
