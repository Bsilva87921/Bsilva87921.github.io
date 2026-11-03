/* ==========================================================================
   Probable — Insights for the pinned bar: the handful of things worth knowing
   right now, computed from the live board, the models and the track record.
   Each insight opens the game (or section) it comes from, or goes to Ask AI.
   ========================================================================== */
(function () {
  'use strict';
  const APP = window.APP, S = APP.S, LG = APP.LG;
  const pc = p => Math.round(p * 100) + '%';
  const lgName = g => LG[g.lg].short || LG[g.lg].name;
  const nm = (g, s) => APP.shortName(g[s], g.lg);
  const fav = (P, g) => { const h = P.pH >= (P.pA ?? 1 - P.pH); return { side: h ? 'home' : 'away', p: h ? P.pH : (P.pA ?? 1 - P.pH) }; };
  function list() {
    if (S.mode === 'loading') return [];
    const out = [], all = APP.allGames().filter(g => !g.void), cap = S.mode === 'snapshot';
    const live = all.filter(g => g.state === 'in');
    const now = cap && S.capturedAt ? +new Date(S.capturedAt) : Date.now();
    const open = id => () => APP.openGame(id);
    if (live.length) {
      const lgs = [...new Set(live.map(lgName))];
      out.push({ id: 'live', tag: cap ? 'At capture' : 'Live', tone: 'live', text: `${live.length} game${live.length === 1 ? '' : 's'} ${cap ? 'were' : ''} in progress: ${lgs.slice(0, 4).join(', ')}${lgs.length > 4 ? '…' : ''}`, val: '', go: () => { APP.setTab('board'); setTimeout(() => { const h = [...document.querySelectorAll('#view-board .sec-h h2')].find(x => /live now|in progress/i.test(x.textContent)); if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); }, ask: 'Which live games are closest right now?' });
      const pr = live.map(g => ({ g, P: APP.predict(g) })).filter(x => x.P.src !== 'none' || x.g.state === 'in');
      const close = pr.slice().sort((a, b) => Math.abs(a.P.now.pH - (a.P.now.pA ?? 1 - a.P.now.pH)) - Math.abs(b.P.now.pH - (b.P.now.pA ?? 1 - b.P.now.pH)))[0];
      if (close) { const f = fav(close.P.now, close.g); out.push({ id: 'close-' + close.g.id, tag: 'Closest', tone: 'live', text: `Closest live game: ${nm(close.g, 'away')} at ${nm(close.g, 'home')}, ${close.g.detail || ''} — ${nm(close.g, f.side)}`, val: pc(f.p), go: open(close.g.id), ask: `Who will win ${close.g.away.abbr} at ${close.g.home.abbr}?` }); }
      const sw = pr.map(x => ({ ...x, d: x.P.now.pH - x.P.pre.pH })).filter(x => Math.abs(x.d) > 0.12).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
      if (sw) { const s = sw.d > 0 ? 'home' : 'away', from = s === 'home' ? sw.P.pre.pH : (sw.P.pre.pA ?? 1 - sw.P.pre.pH), to = s === 'home' ? sw.P.now.pH : (sw.P.now.pA ?? 1 - sw.P.now.pH); out.push({ id: 'swing-' + sw.g.id, tag: 'Swing', tone: sw.d > 0 ? 'up' : 'down', text: `Biggest swing: ${nm(sw.g, s)} went from ${pc(from)} before the game to`, val: pc(to), go: open(sw.g.id), ask: `Why did the odds in ${sw.g.away.abbr} at ${sw.g.home.abbr} swing so much?` }); }
      const up = pr.filter(x => { const pre = x.P.pre, n = x.P.now; const dogH = pre.pH < 0.36, dogA = (pre.pA ?? 1 - pre.pH) < 0.36; return (dogH && n.pH > 0.5) || (dogA && (n.pA ?? 1 - n.pH) > 0.5); })[0];
      if (up) { const s = up.P.pre.pH < 0.36 ? 'home' : 'away'; out.push({ id: 'upset-' + up.g.id, tag: 'Upset watch', tone: 'warn', text: `Upset watch: ${nm(up.g, s)} was ${pc(s === 'home' ? up.P.pre.pH : (up.P.pre.pA ?? 1 - up.P.pre.pH))} before kickoff and is now favored at`, val: pc(s === 'home' ? up.P.now.pH : (up.P.now.pA ?? 1 - up.P.now.pH)), go: open(up.g.id), ask: `Can ${up.g[s].name} hold on to win?` }); }
    }
    const pre = all.filter(g => g.state === 'pre' && +new Date(g.start) - now < 36 * 3600e3 && +new Date(g.start) > now - 3600e3);
    const feat = APP.featuredList ? APP.featuredList(pre)[0] : null;
    if (feat) { const P = APP.predict(feat), f = fav(P.pre, feat); out.push({ id: 'next-' + feat.id, tag: 'Up next', tone: 'info', text: `Top matchup: ${nm(feat, 'away')} at ${nm(feat, 'home')}, ${APP.when(feat.start)} — ${nm(feat, f.side)}`, val: pc(f.p), go: open(feat.id), ask: `Who will win ${feat.away.abbr} at ${feat.home.abbr}, and why?` }); }
    const favs = pre.map(g => ({ g, P: APP.predict(g) })).filter(x => x.P.src !== 'none').map(x => ({ ...x, f: fav(x.P.pre, x.g) })).sort((a, b) => b.f.p - a.f.p);
    if (favs[0] && favs[0].f.p > 0.7) { const x = favs[0]; out.push({ id: 'fav-' + x.g.id, tag: 'Favorite', tone: 'info', text: `Biggest favorite on the slate: ${nm(x.g, x.f.side)} (${lgName(x.g)}) vs ${nm(x.g, x.f.side === 'home' ? 'away' : 'home')}`, val: pc(x.f.p), go: open(x.g.id), ask: `How likely is an upset in ${x.g.away.abbr} at ${x.g.home.abbr}?` }); }
    const gap = pre.concat(live).map(g => ({ g, P: APP.predict(g), L: APP.lineProbs(g) })).filter(x => x.L && x.P.src === 'blend').map(x => ({ ...x, d: x.P.pre.pH - x.L.pH })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
    if (gap && Math.abs(gap.d) >= 0.06) { const s = gap.d > 0 ? 'home' : 'away'; out.push({ id: 'gap-' + gap.g.id, tag: 'Model vs line', tone: 'info', text: `Biggest gap with the betting line: the model gives ${nm(gap.g, s)} ${pc(s === 'home' ? gap.P.pre.pH : 1 - gap.P.pre.pH)} against the line's`, val: pc(s === 'home' ? gap.L.pH : 1 - gap.L.pH), go: open(gap.g.id), ask: `Why does the model disagree with the betting line on ${gap.g.away.abbr} at ${gap.g.home.abbr}?` }); }
    const fin = all.filter(g => g.state === 'post' && now - +new Date(g.start) < 48 * 3600e3).map(g => { const P = APP.predict(g); const w = g.home.winner ? 'home' : g.away.winner ? 'away' : null; return w && P.src !== 'none' ? { g, w, p: w === 'home' ? P.pre.pH : (P.pre.pA ?? 1 - P.pre.pH) } : null; }).filter(Boolean).sort((a, b) => a.p - b.p)[0];
    if (fin && fin.p < 0.35) out.push({ id: 'upset-' + fin.g.id, tag: 'Upset', tone: 'down', text: `Biggest recent upset: ${nm(fin.g, fin.w)} won ${fin.g.away.score}–${fin.g.home.score} with a pregame chance of`, val: pc(fin.p), go: open(fin.g.id), ask: `How big an upset was ${fin.g.away.abbr} at ${fin.g.home.abbr}?` });
    const T = APP.track && APP.track.summary && APP.track.summary();
    if (T) out.push({ id: 'track', tag: 'Track record', tone: 'info', text: T.text, val: T.val, go: () => APP.track.open(), ask: 'How accurate are the Sports Lab predictions?' });
    return out.slice(0, 8);
  }
  let mounted = false, tm = null;
  function refresh() {
    if (!window.INS) return;
    if (!mounted) { mounted = true; window.INS.mount({ ask: q => { if (window.CH) window.CH.open(q); } }); }
    clearTimeout(tm); tm = setTimeout(() => { try { window.INS.set(list()); } catch (e) { console.error(e); } }, 30);
  }
  APP.onRender.push(refresh);
  APP.insights = { list };
})();
