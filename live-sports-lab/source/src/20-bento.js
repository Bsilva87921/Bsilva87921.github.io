/* ==========================================================================
   Probable Sports Lab · "Today by sport": a bento grid of the sports on the
   board. Each tile has a photo, an SVG icon, the games in play today and its
   leagues; the busiest sport gets the big tile. Tapping a tile or a league
   filters the board, exactly like the league rail.
   ========================================================================== */
(function () {
  'use strict';
  const APP = window.APP, S = APP.S, LG = APP.LG, esc = APP.esc, M = window.MEDIA;
  if (!M) return;
  const SPORTS = [
    { id: 'football', name: 'Football', photo: 'stadium-lights', lgs: ['nfl', 'ncaaf'], pos: '50% 62%' },
    { id: 'basketball', name: 'Basketball', photo: 'basketball-hoop', lgs: ['nba', 'wnba'], pos: '50% 35%' },
    { id: 'baseball', name: 'Baseball', photo: 'baseball-night', lgs: ['mlb'], pos: '50% 55%' },
    { id: 'hockey', name: 'Hockey', photo: 'hockey-play', lgs: ['nhl'], pos: '50% 40%' },
    { id: 'soccer', name: 'Soccer', photo: 'soccer-ball', lgs: ['epl', 'laliga', 'seriea', 'bund', 'ligue1', 'mls', 'ucl'], pos: '62% 50%' },
    { id: 'tennis', name: 'Tennis', photo: 'tennis-aerial', ex: 'tennis', pos: '50% 50%' },
    { id: 'golf', name: 'Golf', photo: 'golf-flag', ex: 'golf', pos: '62% 62%' },
    { id: 'mma', name: 'UFC', photo: 'fight-ring', ex: 'ufc', pos: '50% 72%' }
  ];
  const sportOf = id => (SPORTS.find(s => (s.lgs || []).includes(id) || s.ex === id) || {}).id || 'spark';
  APP.sportOf = sportOf;
  const nowRef = () => S.mode === 'snapshot' && S.capturedAt ? +new Date(S.capturedAt) : Date.now();
  const lgName = id => (LG[id] && (LG[id].short || LG[id].name)) || ({ tennis: 'Tennis', golf: 'Golf', ufc: 'UFC' }[id] || id);

  function count(sp) {
    if (sp.ex) {
      const x = S.extras || {};
      if (sp.ex === 'tennis') { const m = x.tennis || []; const live = m.filter(t => t.state === 'in').length; return { live, total: m.length, note: m.length ? `${m.length} featured match${m.length === 1 ? '' : 'es'}` : 'No featured matches right now', per: {} }; }
      if (sp.ex === 'golf') { const g = x.golf; return { live: g && g.state === 'in' ? 1 : 0, total: g ? 1 : 0, note: g ? g.name + (g.detail ? ' · ' + g.detail : '') : 'No tournament on the board', per: {} }; }
      const u = x.ufc; return { live: 0, total: u && u.last ? 1 : 0, note: u && u.last ? 'Latest card: ' + u.last.name : 'Next card coming up', per: {} };
    }
    const now = nowRef(), lo = now - 10 * 3600e3, hi = now + 24 * 3600e3;
    let live = 0, up = 0, fin = 0; const per = {};
    for (const id of sp.lgs) for (const g of ((S.data[id] || {}).games || [])) {
      if (g.void || !g.start) continue;
      const t = +new Date(g.start);
      const hit = g.state === 'in' ? (live++, 1) : g.state === 'pre' && t <= hi && t >= now - 3 * 3600e3 ? (up++, 1) : g.state === 'post' && t >= lo ? (fin++, 1) : 0;
      if (hit) per[id] = (per[id] || 0) + 1;
    }
    return { live, up, fin, total: live + up + fin, per };
  }
  function busiest(sp, c) {
    if (sp.ex) return sp.ex;
    const ids = Object.keys(c.per).sort((a, b) => c.per[b] - c.per[a]);
    return ids[0] || sp.lgs[0];
  }
  function tile(sp, c, size) {
    const lgs = sp.ex ? [] : sp.lgs.filter(id => c.per[id]).sort((a, b) => c.per[b] - c.per[a]);
    const shown = sp.ex ? [] : (lgs.length ? lgs : sp.lgs.slice(0, 2)).slice(0, size === 'xl' ? 7 : size === 'wide' ? 5 : 3);
    const chips = sp.ex ? '' : shown.map(id => `<button type="button" class="sb-lg" data-sb-lg="${esc(id)}" aria-label="${esc(lgName(id))}: ${c.per[id] || 0} games">${esc(lgName(id))}${c.per[id] ? `<small>${c.per[id]}</small>` : ''}</button>`).join('');
    const label = sp.ex ? '' : c.live ? `${c.live} live · ${c.up} in the next 24 h` : c.total ? `${c.up} in the next 24 h · ${c.fin} final` : 'Nothing on today';
    const sizes = size === 'xl' ? '(max-width: 900px) 100vw, 50vw' : '(max-width: 900px) 50vw, 25vw';
    const go = busiest(sp, c);
    return `<article class="sb-t ${size}" data-sb-go="${esc(go)}" tabindex="0" role="button" aria-label="${esc(sp.name)}: ${sp.ex ? esc(c.note) : `${c.total} games today`}. Show on the board">
      ${M.photo(sp.photo, { alt: '', sizes, pos: sp.pos, widths: [480, 960] })}
      <div class="sb-in">
        <span class="sb-name mx-glass">${M.icon(sp.id)}<b>${esc(sp.name)}</b>${c.live ? `<i class="sb-live"><span aria-hidden="true"></span>${c.live} live</i>` : ''}</span>
        <div class="sb-foot">
          ${sp.ex ? `<p class="sb-note">${esc(c.note)}</p>` : `<div class="sb-n"><b data-count>${c.total}</b><span>${esc(label)}</span></div>`}
          ${chips ? `<div class="sb-lgs">${chips}</div>` : ''}
        </div>
      </div>
    </article>`;
  }

  let sec = null, lastSig = '';
  function build() {
    if (sec) return sec;
    const rb = document.querySelector('.railbar'); if (!rb) return null;
    sec = document.createElement('section');
    sec.className = 'wrap sb'; sec.id = 'sportBento'; sec.setAttribute('aria-label', 'Today by sport');
    sec.innerHTML = `<div class="sb-h"><h2>Today by sport</h2><span class="aside">Busiest first · tap a sport or a league to filter the board</span></div><div class="sb-grid" id="sbGrid"></div>`;
    rb.parentNode.insertBefore(sec, rb);
    const pick = id => {
      const chip = document.querySelector(`#rail .chip[data-lg="${CSS.escape(id)}"]`);
      if (chip) chip.click();
      const bar = document.querySelector('.railbar'); if (bar) bar.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    };
    sec.addEventListener('click', e => {
      const lg = e.target.closest('[data-sb-lg]'); if (lg) { pick(lg.getAttribute('data-sb-lg')); return; }
      const t = e.target.closest('[data-sb-go]'); if (t) pick(t.getAttribute('data-sb-go'));
    });
    sec.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-sb-go]')) { e.preventDefault(); pick(e.target.getAttribute('data-sb-go')); } });
    return sec;
  }
  function refresh(kind, tab) {
    if (S.mode === 'loading') return;
    const el = build(); if (!el) return;
    const show = tab === 'board' && !S.q;
    el.hidden = !show;
    if (!show) return;
    const rows = SPORTS.map(sp => ({ sp, c: count(sp) }));
    const team = rows.filter(r => !r.sp.ex).sort((a, b) => (b.c.live - a.c.live) * 3 + (b.c.total - a.c.total));
    const extras = rows.filter(r => r.sp.ex).sort((a, b) => b.c.live - a.c.live || b.c.total - a.c.total);
    const order = [...team, ...extras];
    const sig = order.map(r => [r.sp.id, r.c.live, r.c.total, r.c.note || '', Object.entries(r.c.per).join('.')].join(':')).join('|');
    if (sig === lastSig) return; lastSig = sig;
    document.getElementById('sbGrid').innerHTML = order.map((r, i) => tile(r.sp, r.c, i === 0 ? 'xl' : i === 1 ? 'wide' : '')).join('');
  }
  APP.onRender.push(refresh);
})();
