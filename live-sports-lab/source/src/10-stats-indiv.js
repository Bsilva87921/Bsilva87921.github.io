/* ==========================================================================
   Probable — Stats center for the individual sports: tennis, golf and UFC.
   Same four sections as the team leagues (Rankings in place of team stats,
   player stats, advanced analytics, history), built from SNAPSHOT.indiv:
   ATP/WTA rankings, Tennis Abstract Elo, 2026 titles and every Open Era Slam
   final; OWGR, 2026 PGA Tour stats, strokes gained and every major since 1934;
   UFC rankings, fighter records and career stats and every title reign.
   The live site refreshes tennis rankings and PGA Tour stats from ESPN.
   ========================================================================== */
(function () {
  'use strict';
  const APP = window.APP, C = APP.charts, { S, esc } = APP;
  const D = (typeof SNAPSHOT !== 'undefined' && SNAPSHOT.indiv) || null;
  const $ = (s, r) => (r || document).querySelector(s);
  const fin = v => typeof v === 'number' && isFinite(v);
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const nk = s => fold(s).replace(/[^a-z]/g, '');
  const mean = a => { const b = a.filter(fin); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : NaN; };
  const F = {
    i: v => fin(v) ? Math.round(v).toLocaleString() : '—', d1: v => fin(v) ? v.toFixed(1) : '—', d2: v => fin(v) ? v.toFixed(2) : '—', d3: v => fin(v) ? v.toFixed(3) : '—',
    pc: v => fin(v) ? v.toFixed(1) + '%' : '—', pc0: v => fin(v) ? Math.round(v) + '%' : '—', sgn: v => !fin(v) ? '—' : Math.abs(v) < 0.005 ? '0.00' : (v > 0 ? '+' : '−') + Math.abs(v).toFixed(2),
    sgn0: v => fin(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v)) : '—',
    money: v => fin(v) ? (v >= 1e6 ? '$' + (v / 1e6).toFixed(v >= 1e7 ? 1 : 2) + 'M' : '$' + Math.round(v / 1e3) + 'K') : '—'
  };
  const SPORTS = [{ id: 'tennis', name: 'Tennis' }, { id: 'golf', name: 'Golf' }, { id: 'ufc', name: 'UFC' }];
  const VN = { teams: 'Rankings', players: 'Player stats', analytics: 'Advanced analytics', history: 'History' };
  const IX = APP.IX = { tour: 'atp', surf: 'all', div: 'Lightweight', hdiv: 'Heavyweight', ptSort: null, live: {} };
  const is = id => !!D && SPORTS.some(s => s.id === id);
  const alive = tok => APP.SX && APP.SX.tok === tok && S.tab === 'stats';
  const live = () => S.mode === 'live';
  const src = (txt) => `<div class="srcline">${txt}</div>`;
  const dateTxt = d => { if (!d) return ''; const t = new Date(d + 'T12:00:00Z'); return isNaN(t) ? String(d) : t.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); };
  const nat = c => c ? `<span class="nat">${esc(String(c).length > 3 ? c : c.toUpperCase())}</span>` : '';
  const th = (lab, o) => { o = o || {}; return `<th${o.l ? ' class="l"' : ''}${o.title ? ` title="${esc(o.title)}"` : ''}${o.skip ? ' data-vz-skip' : ''}>${o.low ? `<span data-low="1">${esc(lab)}</span>` : esc(lab)}</th>`; };
  const td = (disp, v) => v == null ? `<td>${disp}</td>` : `<td data-v="${fin(v) ? v : ''}" data-d="${esc(String(disp).replace(/<[^>]+>/g, ''))}">${disp}</td>`;
  const vz = (id, head, body, o) => { o = o || {}; return `<div class="vz" data-vz="${id}" data-vz-n="${o.n || 20}"${o.def ? ` data-vz-def="${esc(o.def)}"` : ''}${o.on === false ? ' data-vz-on="0"' : ''}${o.heat ? ' data-vz-heat="1"' : ''}${o.types ? ` data-vz-types="${o.types}"` : ''} data-vz-attr="data-ix-player"><div class="tbl-wrap${o.tall ? ' mini tall' : ''}"><table class="tbl sx"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`; };
  const seg = (attr, cur, opts) => `<span class="seg" role="group">${opts.map(([v, l]) => `<button type="button" ${attr}="${esc(v)}" aria-pressed="${v === cur}">${esc(l)}</button>`).join('')}</span>`;
  const tile = (eb, val, sub, small) => `<div class="panel tile"><span class="eyebrow">${eb}</span><span class="val${small ? ' val-sm' : ''}">${val}</span><span class="sub">${sub || ''}</span></div>`;
  const gloss = (rows) => `<details class="panel gloss"><summary><b>Metric guide</b><span class="note">${rows.length} metrics: what each tells you and how it is computed</span></summary><div class="tbl-wrap"><table class="tbl sx gl"><thead><tr><th class="l">Metric</th><th class="l">What it tells you</th><th class="l">How it's computed</th></tr></thead><tbody>${rows.map(r => `<tr><td class="l"><b>${esc(r[0])}</b></td><td class="l">${esc(r[1])}</td><td class="l">${esc(r[2])}</td></tr>`).join('')}</tbody></table></div></details>`;
  const pearson = (xs, ys) => { const p = xs.map((x, i) => [x, ys[i]]).filter(q => fin(q[0]) && fin(q[1])); if (p.length < 5) return NaN; const mx = mean(p.map(q => q[0])), my = mean(p.map(q => q[1])); let a = 0, b = 0, c = 0; for (const [x, y] of p) { a += (x - mx) * (y - my); b += (x - mx) ** 2; c += (y - my) ** 2; } return a / Math.sqrt(b * c); };
  const surname = n => { const p = String(n).split(' '); return p.length > 1 ? p.slice(1).join(' ') : n; };

  /* ================= tennis ================= */
  const EVN = { AO: 'Australian Open', RG: 'Roland Garros', W: 'Wimbledon', USO: 'US Open' };
  function slamIdx(tour) {
    const key = 'slam_' + tour; if (IX[key]) return IX[key];
    const rows = (tour === 'atp' ? D.tennis.men : D.tennis.women).map(r => ({ y: r[0], ev: r[1] === 'AO-Dec' ? 'AO' : r[1], w: r[2], r: r[3] }));
    const by = {};
    const rec = n => (by[nk(n)] = by[nk(n)] || { name: n, won: [], lost: [], ev: { AO: 0, RG: 0, W: 0, USO: 0 } });
    for (const x of rows) { const a = rec(x.w); a.won.push(x); a.ev[x.ev]++; rec(x.r).lost.push(x); }
    return (IX[key] = { rows, by });
  }
  async function tennisRank(tour) {
    const base = D.tennis[tour];
    if (!live()) return { rows: base, live: false };
    if (IX.live[tour]) return IX.live[tour];
    try {
      const js = await APP.fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/rankings?region=us&lang=en`, 12000);
      const ranks = (js.rankings && js.rankings[0] && js.rankings[0].ranks) || [];
      const byName = {}; for (const r of base) byName[nk(r[1])] = r;
      const rows = ranks.filter(r => r.athlete && fin(+r.current)).map(r => { const a = r.athlete, old = byName[nk(a.displayName)]; return [+r.current, a.displayName, a.citizenshipCountry || (old && old[2]) || '', fin(+a.age) ? +a.age : old ? old[3] : null, +r.points, fin(+r.previous) && +r.previous > 0 ? +r.previous : +r.current]; }).sort((a, b) => a[0] - b[0]).slice(0, 100);
      // ESPN's feed can lag the official ranking; only trust it when it is at least as fresh as the snapshot (points of No. 1 differ otherwise)
      if (rows.length >= 30) return (IX.live[tour] = { rows, live: true });
    } catch (e) { /* fall back */ }
    return (IX.live[tour] = { rows: base, live: false });
  }
  function tennisModel(tour, rank) {
    const elo = {}, ti = {}, ytd = {};
    for (const r of D.tennis[tour === 'atp' ? 'atpElo' : 'wtaElo']) elo[nk(r[0])] = { all: r[1], hard: r[2], clay: r[3], grass: r[4] };
    for (const r of D.tennis[tour === 'atp' ? 'atpTitles' : 'wtaTitles']) ti[nk(r[0])] = { n: r[1], gs: r[2], k1: r[3], k5: r[4], k2: r[5] };
    for (const r of D.tennis[tour === 'atp' ? 'atpYtd' : 'wtaYtd'] || []) ytd[nk(r[0])] = { w: r[1], l: r[2] };
    const sl = slamIdx(tour);
    const players = rank.map(r => { const k = nk(r[1]), s = sl.by[k]; return { k, rank: r[0], name: r[1], cc: r[2], age: r[3], pts: r[4], prev: r[5], move: fin(r[5]) ? r[5] - r[0] : 0, elo: elo[k] || null, ti: ti[k] || null, ytd: ytd[k] || null, slams: s ? s.won.length : 0, sfin: s ? s.won.length + s.lost.length : 0, sev: s ? s.ev : null }; });
    return { players, elo, ti, sl };
  }
  async function tennis(el, view, tok) {
    const tour = IX.tour, T = D.tennis;
    const R = await tennisRank(tour); if (!alive(tok)) return;
    const M = tennisModel(tour, R.rows), P = M.players, asOf = T.asOf[tour];
    const ctl = `<div class="panel ptool">${seg('data-ix-tour', tour, [['atp', 'ATP · men'], ['wta', 'WTA · women']])}<span class="note">${R.live ? 'ESPN live ranking feed' : 'Official ranking of ' + esc(dateTxt(asOf))}${view === 'history' ? '' : ' · click a player for a profile'}</span></div>`;
    const tourN = tour === 'atp' ? 'ATP' : 'WTA';
    if (view === 'teams') {
      const top = P[0], second = P[1], nations = {}; for (const p of P) nations[p.cc] = (nations[p.cc] || 0) + 1;
      const nat1 = Object.entries(nations).sort((a, b) => b[1] - a[1])[0] || ['', 0], mover = P.slice().sort((a, b) => b.move - a.move)[0];
      const tiles = `<div class="tiles sx-tiles">${tile('World No. 1', esc(top.name), `${F.i(top.pts)} points · ${F.i(top.pts - second.pts)} ahead of ${esc(surname(second.name))}`, true)}${tile('Top-10 average age', F.d1(mean(P.slice(0, 10).map(p => p.age))), `top 100: ${F.d1(mean(P.map(p => p.age)))}`)}${tile('Nations in the top 100', Object.keys(nations).length, `${esc(nat1[0])} leads with ${nat1[1]} players`)}${mover && mover.move > 0 ? tile('Biggest climber this week', esc(mover.name), `up ${mover.move} to No. ${mover.rank}`, true) : ''}</div>`;
      const head = th('#', { skip: 1 }) + th('Player', { l: 1 }) + th('Nation', { skip: 1 }) + th('Age') + th('Points') + th('Move', { title: 'Places gained since the previous ranking' }) + th('Elo', { title: 'Tennis Abstract Elo rating (all surfaces)' }) + th('Slams', { title: 'Open Era Grand Slam singles titles' }) + th('2026 titles');
      const body = P.map(p => `<tr data-ix-player="${esc(p.name)}" data-lab="${esc(surname(p.name))}" data-name="${esc(p.name)}"><td class="rk">${p.rank}</td><td class="l"><b>${esc(p.name)}</b></td><td>${nat(p.cc)}</td>${td(fin(p.age) ? p.age : '—', p.age)}${td(F.i(p.pts), p.pts)}<td class="${p.move > 0 ? 'delta-up' : p.move < 0 ? 'delta-dn' : ''}">${p.move ? F.sgn0(p.move) : '—'}</td>${td(p.elo ? F.i(p.elo.all) : '—', p.elo ? p.elo.all : null)}${td(p.slams || '—', p.slams)}${td(p.ti ? p.ti.n : '—', p.ti ? p.ti.n : 0)}</tr>`).join('');
      el.innerHTML = ctl + tiles + `<div class="panel">${vz('tn-rank-' + tour, head, body, { def: 'Points', n: 20 })}</div>` + src(`${tourN} singles ranking (${R.live ? 'ESPN' : 'official, ' + esc(dateTxt(asOf))}) · Elo from Tennis Abstract (${esc(dateTxt(T.asOf.atp_elo))}) · Slams: every Open Era final since 1968`);
      return;
    }
    if (view === 'players') {
      const hasYtd = P.some(p => p.ytd);
      const rows = P.slice(0, 60);
      const head = th('Player', { l: 1 }) + th('Rank') + (hasYtd ? th('2026 W-L', { skip: 1 }) + th('Win %') : '') + th('2026 titles') + th('Slams 2026', { title: 'Grand Slam titles this season' }) + th(tour === 'atp' ? 'Masters' : 'WTA 1000') + th('500s') + th('250s') + th('Elo') + th('Hard Elo') + th('Clay Elo') + th('Grass Elo') + th('Career Slams') + th('Slam finals') + th('Final win %');
      const body = rows.map(p => { const wl = p.ytd, wp = wl ? 100 * wl.w / (wl.w + wl.l) : NaN, e = p.elo || {}, t = p.ti || {}; return `<tr data-ix-player="${esc(p.name)}" data-lab="${esc(surname(p.name))}" data-name="${esc(p.name)}"><td class="l"><b>${esc(p.name)}</b> ${nat(p.cc)}</td>${td(p.rank, p.rank)}${hasYtd ? `<td>${wl ? wl.w + '-' + wl.l : '—'}</td>${td(F.pc(wp), wp)}` : ''}${td(t.n || 0, t.n || 0)}${td(t.gs || 0, t.gs || 0)}${td(t.k1 || 0, t.k1 || 0)}${td(t.k5 || 0, t.k5 || 0)}${td(t.k2 || 0, t.k2 || 0)}${td(F.i(e.all), e.all)}${td(F.i(e.hard), e.hard)}${td(F.i(e.clay), e.clay)}${td(F.i(e.grass), e.grass)}${td(p.slams, p.slams)}${td(p.sfin, p.sfin)}${td(p.sfin ? F.pc0(100 * p.slams / p.sfin) : '—', p.sfin ? 100 * p.slams / p.sfin : null)}</tr>`; }).join('');
      el.innerHTML = ctl + `<div class="panel">${vz('tn-pl-' + tour, head, body, { def: 'Elo', n: 20 })}</div>` + src(`2026 titles: ${esc(tourN)} tour-level singles through ${esc(dateTxt(T.asOf[tour === 'atp' ? 'atp_titles_2026' : 'wta_titles_2026']))}${hasYtd ? ` · win–loss through ${esc(dateTxt(T.asOf.atp_ytd))} (tour-level, incl. Davis Cup)` : ''} · Elo: Tennis Abstract · Slam finals since 1968`);
      return;
    }
    if (view === 'analytics') {
      const surf = IX.surf, sk = { all: 'all', hard: 'hard', clay: 'clay', grass: 'grass' }[surf];
      const withElo = P.filter(p => p.elo);
      // 1) Elo vs ranking points
      const sc = withElo.slice(0, 40).map((p, i) => ({ x: p.pts, y: p.elo.all, key: p.name, label: surname(p.name), emph: i < 12, tip: `${esc(p.name)}<br>No. ${p.rank} · ${F.i(p.pts)} pts · Elo <b>${F.i(p.elo.all)}</b>` }));
      const eloRank = withElo.slice().sort((a, b) => b.elo.all - a.elo.all); eloRank.forEach((p, i) => { p.eloRank = i + 1; });
      const gaps = withElo.filter(p => p.rank <= 60).map(p => ({ p, d: p.rank - p.eloRank }));
      const under = gaps.slice().sort((a, b) => b.d - a.d).slice(0, 5), over = gaps.slice().sort((a, b) => a.d - b.d).slice(0, 5);
      // 2) win-probability matrix (Elo)
      const top8 = withElo.slice().sort((a, b) => b.elo[sk] - a.elo[sk]).slice(0, 8);
      const wp = (a, b) => 1 / (1 + Math.pow(10, (b.elo[sk] - a.elo[sk]) / 400));
      const mh = th('Player', { l: 1 }) + top8.map(b => th(surname(b.name))).join('') + th('Avg vs top 8', { title: 'Average win probability against the other seven' });
      const mb = top8.map(a => `<tr data-ix-player="${esc(a.name)}" data-lab="${esc(surname(a.name))}" data-name="${esc(a.name)}"><td class="l"><b>${esc(a.name)}</b> <span class="muted small">${F.i(a.elo[sk])}</span></td>${top8.map(b => a === b ? '<td class="muted">—</td>' : td(F.pc0(100 * wp(a, b)), 100 * wp(a, b))).join('')}${td(F.pc0(100 * mean(top8.filter(b => b !== a).map(b => wp(a, b)))), 100 * mean(top8.filter(b => b !== a).map(b => wp(a, b))))}</tr>`).join('');
      // 3) surface specialists
      const top20 = eloRank.slice(0, 24);
      const sh = th('Player', { l: 1 }) + th('Elo') + th('Hard') + th('Clay') + th('Grass') + th('Clay − hard', { title: 'Clay Elo minus hard-court Elo' }) + th('Grass − hard', { title: 'Grass Elo minus hard-court Elo' }) + th('Best surface', { skip: 1 });
      const sb = top20.map(p => { const e = p.elo, best = ['hard', 'clay', 'grass'].sort((x, y) => e[y] - e[x])[0]; return `<tr data-ix-player="${esc(p.name)}" data-lab="${esc(surname(p.name))}" data-name="${esc(p.name)}"><td class="l"><b>${esc(p.name)}</b></td>${td(F.i(e.all), e.all)}${td(F.i(e.hard), e.hard)}${td(F.i(e.clay), e.clay)}${td(F.i(e.grass), e.grass)}${td(F.sgn0(e.clay - e.hard), e.clay - e.hard)}${td(F.sgn0(e.grass - e.hard), e.grass - e.hard)}<td>${best[0].toUpperCase() + best.slice(1)}</td></tr>`; }).join('');
      // 4) concentration of ranking points
      const tot = P.reduce((s, p) => s + (p.pts || 0), 0), sh1 = P[0].pts / tot, sh3 = P.slice(0, 3).reduce((s, p) => s + p.pts, 0) / tot, sh10 = P.slice(0, 10).reduce((s, p) => s + p.pts, 0) / tot;
      const t20 = P.slice(0, 20), t20s = t20.reduce((s, p) => s + p.pts, 0), eff = 1 / t20.reduce((s, p) => s + Math.pow(p.pts / t20s, 2), 0);
      el.innerHTML = ctl + `<div class="tiles sx-tiles">${tile('No. 1’s share of top-100 points', F.pc(100 * sh1), `${esc(P[0].name)}`)}${tile('Top 3 / top 10 share', `${F.pc0(100 * sh3)}<small>/ ${F.pc0(100 * sh10)}</small>`, 'of all top-100 ranking points')}${tile('Effective contenders', F.d1(eff), 'inverse Herfindahl index of the top 20’s points: lower = a more dominant elite')}${tile('Elo No. 1', esc(eloRank[0].name), `Elo ${F.i(eloRank[0].elo.all)} · ${F.i(eloRank[0].elo.all - eloRank[1].elo.all)} over No. 2`, true)}</div>
        <div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Form vs ranking</h2><span class="aside">Elo rating (recent results, opponent strength) against 52-week ranking points</span></div>${C.scatter(sc, { xLab: 'Ranking points', yLab: 'Elo rating', attr: 'data-ix-player', h: 380, aria: 'Elo versus ranking points' })}
          <div class="sx-two"><div><span class="eyebrow">Better than the ranking says (Elo rank above ranking)</span><ol class="hl-list">${under.map(g => `<li><b>${esc(g.p.name)}</b><span class="v">No. ${g.p.rank} · Elo No. ${g.p.eloRank}</span></li>`).join('')}</ol></div><div><span class="eyebrow">Ranking ahead of form</span><ol class="hl-list">${over.map(g => `<li><b>${esc(g.p.name)}</b><span class="v">No. ${g.p.rank} · Elo No. ${g.p.eloRank}</span></li>`).join('')}</ol></div></div></div>
        <div class="panel"><div class="ptool"><b>Head-to-head win probability</b>${seg('data-ix-surf', surf, [['all', 'All surfaces'], ['hard', 'Hard'], ['clay', 'Clay'], ['grass', 'Grass']])}<span class="note">Row player's chance to beat the column player: 1 ÷ (1 + 10^(−Elo gap ÷ 400))</span></div>${vz('tn-h2h-' + tour + '-' + surf, mh, mb, { on: false, heat: true, def: 'Avg vs top 8', n: 8 })}</div>
        <div class="panel"><div class="ptool"><b>Surface specialists</b><span class="note">Tennis Abstract surface Elo for the top 24 · heat shows each column's leaders</span></div>${vz('tn-surf-' + tour, sh, sb, { on: false, heat: true, def: 'Clay − hard', n: 24, types: 'bars,dots,avg' })}</div>`
        + gloss([['Elo rating', 'Current strength from recent results, weighted by opponent strength; the best single predictor of match outcomes', 'Tennis Abstract: every match moves both players by K × (result − expected), expected = 1 ÷ (1 + 10^(−gap ÷ 400))'], ['Surface Elo', 'Strength on hard, clay or grass only', 'Same formula using only matches on that surface (blended with overall Elo on Tennis Abstract)'], ['Win probability', 'Chance the row player beats the column player', '1 ÷ (1 + 10^((Elo_B − Elo_A) ÷ 400))'], ['Ranking points', 'Official 52-week ranking total', 'Points from the best results of the past 52 weeks (Slams 2000 for a title)'], ['Effective contenders', 'How many equal-sized players the top 20’s points are worth', '1 ÷ Σ(share²) of ranking points among the top 20'], ['Slam final win %', 'How often a player converts a Grand Slam final', 'Slam titles ÷ Slam finals, Open Era']])
        + src('Elo: Tennis Abstract ratings of ' + esc(dateTxt(T.asOf.atp_elo)) + ' · ranking points: ' + (R.live ? 'ESPN' : 'official ranking of ' + esc(dateTxt(asOf))));
      return;
    }
    // history
    const sl = M.sl, lead = Object.values(sl.by).filter(a => a.won.length).sort((a, b) => b.won.length - a.won.length || a.won[0].y - b.won[0].y);
    const years = [...new Set(sl.rows.map(r => r.y))].sort((a, b) => b - a);
    const cell = (y, ev) => { const r = sl.rows.filter(x => x.y === y && x.ev === ev); return r.length ? r.map(x => `<span data-tip="${esc(EVN[ev])} ${y}: <b>${esc(x.w)}</b> d. ${esc(x.r)}" data-ix-player="${esc(x.w)}" class="gc">${esc(surname(x.w))}</span>`).join(' · ') : '<span class="muted">—</span>'; };
    const grid = years.map(y => `<tr><td class="l"><b>${y}</b></td>${['AO', 'RG', 'W', 'USO'].map(ev => `<td class="l">${cell(y, ev)}</td>`).join('')}</tr>`).join('');
    const lh = th('#', { skip: 1 }) + th('Player', { l: 1 }) + th('Slams') + th('Finals') + th('Final win %') + th('AO') + th('RG') + th('W') + th('USO') + th('First', { skip: 1 }) + th('Last', { skip: 1 });
    const lb = lead.slice(0, 40).map((a, i) => `<tr data-ix-player="${esc(a.name)}" data-lab="${esc(surname(a.name))}" data-name="${esc(a.name)}"><td class="rk">${i + 1}</td><td class="l"><b>${esc(a.name)}</b></td>${td(a.won.length, a.won.length)}${td(a.won.length + a.lost.length, a.won.length + a.lost.length)}${td(F.pc0(100 * a.won.length / (a.won.length + a.lost.length)), 100 * a.won.length / (a.won.length + a.lost.length))}${td(a.ev.AO, a.ev.AO)}${td(a.ev.RG, a.ev.RG)}${td(a.ev.W, a.ev.W)}${td(a.ev.USO, a.ev.USO)}<td>${a.won[0].y}</td><td>${a.won[a.won.length - 1].y}</td></tr>`).join('');
    const tl = lead.slice(0, 12).map(a => ({ lab: surname(a.name), name: a.name, years: a.won.map(x => x.y), lost: a.lost.map(x => x.y), key: a.name }));
    const last = sl.rows[sl.rows.length - 1], since = sl.rows.filter(r => r.y >= 2020), champs2020 = new Set(since.map(r => nk(r.w))).size;
    const active = P.filter(p => p.slams).sort((a, b) => b.slams - a.slams)[0];
    el.innerHTML = ctl + `<div class="tiles sx-tiles">${tile('Most Slams, Open Era', esc(lead[0].name), `${lead[0].won.length} titles in ${lead[0].won.length + lead[0].lost.length} finals`, true)}${tile('Latest Slam champion', esc(last.w), `${esc(EVN[last.ev])} ${last.y} · d. ${esc(last.r)}`, true)}${active ? tile('Most Slams in today’s top 100', esc(active.name), `${active.slams} · ranked No. ${active.rank}`, true) : ''}${tile('Different champions since 2020', champs2020, `${since.length} Slams played`)}</div>
      <div class="panel"><div class="ptool"><b>Grand Slam titles, Open Era</b><span class="note">${sl.rows.length} finals since the 1968 French Open · championships won per player</span></div>${vz('tn-lead-' + tour, lh, lb, { def: 'Slams', n: 20 })}</div>
      <div class="sx-two"><div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Title timeline</h2><span class="aside">● Slam title · ○ lost final · the 12 most decorated</span></div>${C.timeline(tl, { attr: 'data-ix-player', winLab: 'Slam title', lostLab: 'lost final', aria: 'Grand Slam titles by year' })}</div>
        <div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Champions by year</h2><span class="aside">hover a name for the final</span></div><div class="tbl-wrap mini tall"><table class="tbl sx slams"><thead><tr><th class="l">Year</th><th class="l">Australian Open</th><th class="l">Roland Garros</th><th class="l">Wimbledon</th><th class="l">US Open</th></tr></thead><tbody>${grid}</tbody></table></div></div></div>`
      + src('Grand Slam singles finals 1968–2026 (Wikipedia champions lists, 2025–26 finals confirmed with news reports). 1977 had two Australian Opens; there was none in 1986 and no Wimbledon in 2020.');
  }

  /* ================= golf ================= */
  const MJ = { M: 'Masters', PGA: 'PGA Championship', USO: 'U.S. Open', OPEN: 'The Open' };
  function majorIdx() {
    if (IX.mj) return IX.mj;
    const by = {};
    for (const [y, ev, w] of D.golf.majors) { const a = (by[nk(w)] = by[nk(w)] || { name: w, won: [], ev: { M: 0, PGA: 0, USO: 0, OPEN: 0 } }); a.won.push({ y, ev }); a.ev[ev]++; }
    for (const r of D.golf.leaders) { const a = (by[nk(r[0])] = by[nk(r[0])] || { name: r[0], won: [], ev: { M: 0, PGA: 0, USO: 0, OPEN: 0 } }); a.total = r[1]; a.all = { M: r[2], PGA: r[3], USO: r[4], OPEN: r[5] }; }
    for (const a of Object.values(by)) if (!a.total) { a.total = a.won.length; a.all = a.ev; }
    const wins = {}; for (const [, , w] of D.golf.pga) wins[nk(w)] = (wins[nk(w)] || 0) + 1;
    return (IX.mj = { by, wins });
  }
  async function golfStats() {
    const base = D.golf.stats;
    if (!live()) return { st: base, live: false };
    if (IX.live.golf) return IX.live.golf;
    try {
      const y = new Date().getFullYear();
      const js = await APP.fetchJSON(`https://site.web.api.espn.com/apis/common/v3/sports/golf/pga/statistics/byathlete?region=us&lang=en&season=${y}&sort=general.amount:desc&limit=100&page=1`, 15000);
      const ages = {}; for (const r of base.rows) ages[nk(r[0])] = r[1];
      const rows = (js.athletes || []).map(a => { const v = ((a.categories || [])[0] || {}).values || []; const n = x => x == null || x === '' ? null : +x; return [a.athlete && a.athlete.displayName, ages[nk(a.athlete && a.athlete.displayName)] || null, n(v[0]), n(v[1]), n(v[2]), n(v[3]), n(v[4]), n(v[5]), n(v[6]), n(v[7]), n(v[8]), n(v[9]), n(v[10]), n(v[11]), n(v[13]), n(v[14])]; }).filter(r => r[0] && fin(r[2]) && r[2] > 0);
      if (rows.length >= 30) return (IX.live.golf = { st: { season: y, cols: base.cols, rows }, live: true });
    } catch (e) { /* fall back */ }
    return (IX.live.golf = { st: base, live: false });
  }
  async function golf(el, view, tok) {
    const G = D.golf, MI = majorIdx();
    const ctl = (extra) => `<div class="panel ptool"><b>Men's professional golf</b><span class="note">${extra || ''}</span></div>`;
    if (view === 'teams') {
      const O = G.owgr, nations = {}; for (const r of O) nations[r[2]] = (nations[r[2]] || 0) + 1;
      const nat1 = Object.entries(nations).sort((a, b) => b[1] - a[1])[0];
      const top10Maj = O.slice(0, 10).reduce((s, r) => s + ((MI.by[nk(r[1])] || {}).total || 0), 0);
      const head = th('#', { skip: 1 }) + th('Player', { l: 1 }) + th('Nation', { skip: 1 }) + th('Avg points', { title: 'OWGR average points (total ÷ events)' }) + th('Total points') + th('Events', { title: 'Events counted in the divisor' }) + th('Majors', { title: 'Career major championships' }) + th('2026 wins', { title: 'PGA Tour wins this season' });
      const body = O.map(r => { const m = MI.by[nk(r[1])], w = MI.wins[nk(r[1])] || 0; return `<tr data-ix-player="${esc(r[1])}" data-lab="${esc(surname(r[1]))}" data-name="${esc(r[1])}"><td class="rk">${r[0]}</td><td class="l"><b>${esc(r[1])}</b></td><td>${nat(r[2])}</td>${td(F.d2(r[3]), r[3])}${td(F.d1(r[4]), r[4])}${td(r[5], r[5])}${td(m ? m.total : 0, m ? m.total : 0)}${td(w, w)}</tr>`; }).join('');
      el.innerHTML = ctl('Official World Golf Ranking of ' + esc(dateTxt(G.asOf.owgr)) + ' · click a player for a profile') + `<div class="tiles sx-tiles">${tile('World No. 1', esc(O[0][1]), `${F.d2(O[0][3])} avg points · ${(O[0][3] / O[1][3]).toFixed(1)}× No. 2`, true)}${tile('Majors held by the top 10', top10Maj, 'career major titles combined')}${tile('Nations in the top 100', Object.keys(nations).length, `${esc(nat1[0])} leads with ${nat1[1]}`)}${tile('2026 PGA Tour events', G.pga.length, `${Object.keys(MI.wins).length} different winners`)}</div>
        <div class="panel">${vz('gf-owgr', head, body, { def: 'Avg points', n: 20 })}</div>` + src('Official World Golf Ranking (owgr.com), week ending ' + esc(dateTxt(G.asOf.owgr)) + ' · majors 1934–2026 plus all-time totals · 2026 PGA Tour winners');
      return;
    }
    const GS = await golfStats(); if (!alive(tok)) return;
    const st = GS.st, cix = n => st.cols.indexOf(n) + 2;
    const val = (r, n) => r[cix(n)];
    if (view === 'players') {
      const head = th('Player', { l: 1 }) + th('Age') + th('Earnings') + th('FedEx pts') + th('Events') + th('Cuts') + th('Cut %') + th('Top 10') + th('Top-10 %') + th('Wins') + th('Scoring avg', { low: 1 }) + th('Drive yds') + th('Drive acc %') + th('GIR %') + th('Putts/hole', { low: 1 }) + th('Sand save %') + th('Birdies/rd');
      const body = st.rows.map(r => { const ev = val(r, 'EVNTS'), cuts = val(r, 'CUTS'), t10 = val(r, 'TOP10'); return `<tr data-ix-player="${esc(r[0])}" data-lab="${esc(surname(r[0]))}" data-name="${esc(r[0])}"><td class="l"><b>${esc(r[0])}</b></td>${td(r[1] || '—', r[1])}${td(F.money(val(r, 'EARN')), val(r, 'EARN'))}${td(F.i(val(r, 'CUP')), val(r, 'CUP'))}${td(ev, ev)}${td(cuts, cuts)}${td(ev ? F.pc0(100 * cuts / ev) : '—', ev ? 100 * cuts / ev : null)}${td(t10, t10)}${td(ev ? F.pc0(100 * t10 / ev) : '—', ev ? 100 * t10 / ev : null)}${td(val(r, 'WINS'), val(r, 'WINS'))}${td(F.d2(val(r, 'SCORE')), val(r, 'SCORE'))}${td(F.d1(val(r, 'DDIS')), val(r, 'DDIS'))}${td(F.pc(val(r, 'DACC')), val(r, 'DACC'))}${td(F.pc(val(r, 'GIR')), val(r, 'GIR'))}${td(F.d3(val(r, 'PUTTS')), val(r, 'PUTTS'))}${td(F.pc(val(r, 'SAND')), val(r, 'SAND'))}${td(F.d2(val(r, 'BIRDS')), val(r, 'BIRDS'))}</tr>`; }).join('');
      el.innerHTML = ctl(`${st.season} PGA Tour season statistics · top ${st.rows.length} by earnings`) + `<div class="panel">${vz('gf-stats', head, body, { def: 'Scoring avg', n: 25 })}</div>` + src((GS.live ? 'ESPN PGA Tour statistics (live)' : 'ESPN PGA Tour statistics through ' + esc(dateTxt(G.asOf.golf_stats))) + ' · Putts/hole = putts per hole played · Cut % and Top-10 % computed from events');
      return;
    }
    if (view === 'analytics') {
      const sg = G.sg || [];
      const sgh = th('Player', { l: 1 }) + th('SG: Total') + th('Off the tee') + th('Approach') + th('Around green') + th('Putting') + th('Tee to green', { title: 'Off the tee + approach + around the green' }) + th('Rounds');
      const sgb = sg.map(r => `<tr data-ix-player="${esc(r[0])}" data-lab="${esc(surname(r[0]))}" data-name="${esc(r[0])}"><td class="l"><b>${esc(r[0])}</b></td>${td(F.sgn(r[1]), r[1])}${td(F.sgn(r[2]), r[2])}${td(F.sgn(r[3]), r[3])}${td(F.sgn(r[4]), r[4])}${td(F.sgn(r[5]), r[5])}${td(F.sgn(r[2] + r[3] + r[4]), r[2] + r[3] + r[4])}${td(r[6], r[6])}</tr>`).join('');
      const top = st.rows.slice(0, 60), lab12 = new Set(top.slice(0, 14).map(r => r[0]));
      const dd = top.filter(r => fin(val(r, 'DDIS')) && fin(val(r, 'DACC'))).map(r => ({ x: val(r, 'DDIS'), y: val(r, 'DACC'), key: r[0], label: surname(r[0]), emph: lab12.has(r[0]), tip: `${esc(r[0])}<br>${F.d1(val(r, 'DDIS'))} yds · ${F.pc(val(r, 'DACC'))} fairways` }));
      const bp = sg.map(r => ({ x: r[2] + r[3] + r[4], y: r[5], key: r[0], label: surname(r[0]), emph: true, tip: `${esc(r[0])}<br>Tee to green <b>${F.sgn(r[2] + r[3] + r[4])}</b> · putting <b>${F.sgn(r[5])}</b>` }));
      const statsFor = ['GIR', 'DDIS', 'DACC', 'PUTTS', 'BIRDS', 'SAND'], labs = { GIR: 'Greens in regulation %', DDIS: 'Driving distance', DACC: 'Driving accuracy %', PUTTS: 'Putts per hole', BIRDS: 'Birdies per round', SAND: 'Sand save %' };
      const scr = st.rows.filter(r => fin(val(r, 'SCORE')) && val(r, 'RNDS') >= 20);
      const cor = statsFor.map(n => ({ lab: labs[n], name: labs[n], v: -pearson(scr.map(r => val(r, n)), scr.map(r => val(r, 'SCORE'))) })).filter(x => fin(x.v)).sort((a, b) => b.v - a.v).map(x => Object.assign(x, { disp: (x.v >= 0 ? '' : '−') + Math.abs(x.v).toFixed(2) }));
      el.innerHTML = ctl('Where the strokes come from') + (sg.length ? `<div class="panel"><div class="ptool"><b>Strokes gained</b><span class="note">Shots better than the field average per round · top ${sg.length} by SG: Total</span></div>${vz('gf-sg', sgh, sgb, { def: 'SG: Total', n: 20, types: 'bars,avg,dots,scatter', tall: true })}</div>` : '')
        + `<div class="sx-two">${bp.length ? `<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Ball-striking vs putting</h2><span class="aside">strokes gained per round</span></div>${C.scatter(bp, { refX: 0, refY: 0, xLab: 'SG: tee to green', yLab: 'SG: putting', quad: { tr: 'Complete game', tl: 'Putter carries', br: 'Ball-strikers', bl: 'Searching' }, attr: 'data-ix-player', h: 340, xFmt: F.sgn, yFmt: F.sgn, aria: 'Ball-striking versus putting' })}</div>` : ''}
          <div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Distance vs accuracy</h2><span class="aside">driving, top 60 money earners</span></div>${C.scatter(dd, { refX: mean(dd.map(p => p.x)), refY: mean(dd.map(p => p.y)), xLab: 'Driving distance (yds)', yLab: 'Driving accuracy (%)', quad: { tr: 'Long and straight', tl: 'Short, straight', br: 'Bombers', bl: 'Short and wild' }, attr: 'data-ix-player', h: 340, aria: 'Driving distance versus accuracy' })}</div></div>
        <div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">What tracks scoring average</h2><span class="aside">correlation with a lower scoring average across ${scr.length} players with 20+ rounds · 1 = perfectly linked</span></div>${C.hbars(cor, { fmt: v => v.toFixed(2), aria: 'Correlation of each stat with scoring average' })}<p class="note">Greens in regulation and birdies usually lead: approach play produces the scoring chances. A negative value means the stat moves the wrong way (e.g. more putts per hole).</p></div>`
        + gloss([['Strokes gained (SG)', 'Shots a player gains on the field average per round', 'For each shot: field-average strokes to hole out before − after − 1, summed per round (PGA Tour ShotLink)'], ['SG: off the tee / approach / around the green / putting', 'Where the strokes are gained', 'The same shot values split by shot type; tee to green = the first three'], ['Scoring average', 'Strokes per round (lower is better)', 'Total strokes ÷ rounds (adjusted by the tour for course difficulty)'], ['Greens in regulation', 'Share of holes reached with two strokes to spare for par', 'Greens hit in regulation ÷ holes played'], ['Putts per hole', 'Putting efficiency (lower is better)', 'Putts ÷ holes played'], ['Sand save %', 'Up-and-downs from greenside bunkers', 'Par-or-better after a greenside bunker ÷ attempts'], ['OWGR average points', 'World ranking strength', 'Points (two-year window, decaying) ÷ events played (min 40)']])
        + src((sg.length ? 'Strokes gained: TourBreakdown (PGA Tour ShotLink data), 2026 season · ' : '') + (GS.live ? 'ESPN PGA Tour statistics (live)' : 'ESPN PGA Tour statistics through ' + esc(dateTxt(G.asOf.golf_stats))));
      return;
    }
    // history
    const years = [...new Set(G.majors.map(r => r[0]))].sort((a, b) => b - a);
    const grid = years.map(y => `<tr><td class="l"><b>${y}</b></td>${['M', 'PGA', 'USO', 'OPEN'].map(ev => { const r = G.majors.find(x => x[0] === y && x[1] === ev); return `<td class="l">${r ? `<span class="gc" data-ix-player="${esc(r[2])}">${esc(r[2])}</span>` : '<span class="muted">—</span>'}</td>`; }).join('')}</tr>`).join('');
    const L = Object.values(MI.by).filter(a => a.total >= 3).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    const lh = th('#', { skip: 1 }) + th('Player', { l: 1 }) + th('Majors') + th('Masters') + th('PGA') + th('U.S. Open') + th('The Open') + th('First', { skip: 1 }) + th('Last', { skip: 1 });
    const lb = L.map((a, i) => `<tr data-ix-player="${esc(a.name)}" data-lab="${esc(surname(a.name))}" data-name="${esc(a.name)}"><td class="rk">${i + 1}</td><td class="l"><b>${esc(a.name)}</b></td>${td(a.total, a.total)}${td(a.all.M, a.all.M)}${td(a.all.PGA, a.all.PGA)}${td(a.all.USO, a.all.USO)}${td(a.all.OPEN, a.all.OPEN)}<td>${a.won.length ? a.won[0].y : '—'}</td><td>${a.won.length ? a.won[a.won.length - 1].y : '—'}</td></tr>`).join('');
    const tl = Object.values(MI.by).filter(a => a.won.length).sort((a, b) => b.won.length - a.won.length).slice(0, 12).map(a => ({ lab: surname(a.name), name: a.name, years: a.won.map(x => x.y), key: a.name }));
    const lastM = G.majors[G.majors.length - 1], since = G.majors.filter(r => r[0] >= 2016), multi = Object.entries(since.reduce((o, r) => { o[r[2]] = (o[r[2]] || 0) + 1; return o; }, {})).filter(x => x[1] > 1).length;
    const winsList = Object.entries(MI.wins).map(([k, n]) => ({ n, name: (G.pga.find(r => nk(r[2]) === k) || [])[2] })).sort((a, b) => b.n - a.n).slice(0, 12).map(x => ({ lab: surname(x.name), name: x.name, v: x.n, key: x.name }));
    el.innerHTML = ctl('Major championships since 1934 · the 2026 season') + `<div class="tiles sx-tiles">${tile('Most majors', esc(L[0].name), `${L[0].total} · Masters ${L[0].all.M}, PGA ${L[0].all.PGA}, U.S. Open ${L[0].all.USO}, Open ${L[0].all.OPEN}`, true)}${tile('Latest major', esc(lastM[2]), `${esc(MJ[lastM[1]])} ${lastM[0]}`, true)}${tile('Different major winners since 2016', new Set(since.map(r => nk(r[2]))).size, `${since.length} majors · ${multi} won more than one`)}${tile('2026 majors', '4', G.majors.filter(r => r[0] === 2026).map(r => esc(surname(r[2]))).join(' · '))}</div>
      <div class="panel"><div class="ptool"><b>Major champions</b><span class="note">players with three or more majors (all eras) · championships won per player</span></div>${vz('gf-lead', lh, lb, { def: 'Majors', n: 20 })}</div>
      <div class="sx-two"><div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Title timeline</h2><span class="aside">● major title since 1934 · the 12 most decorated</span></div>${C.timeline(tl, { attr: 'data-ix-player', winLab: 'major', aria: 'Major titles by year' })}</div>
        <div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">2026 PGA Tour winners</h2><span class="aside">${G.pga.length} events through ${esc(dateTxt(G.asOf.pga_2026))}</span></div>${C.hbars(winsList, { attr: 'data-ix-player', fmt: v => String(Math.round(v)), aria: '2026 wins by player' })}<div class="tbl-wrap mini"><table class="tbl sx"><thead><tr><th class="l">Final round</th><th class="l">Event</th><th class="l">Winner</th></tr></thead><tbody>${G.pga.slice().reverse().map(r => `<tr><td class="l">${esc(dateTxt(r[0]))}</td><td class="l">${esc(r[1])}</td><td class="l"><b>${esc(r[2])}</b></td></tr>`).join('')}</tbody></table></div></div></div>
      <div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Major champions by year</h2><span class="aside">${G.majors.length} majors since 1934 (none in the war years; no Open in 2020)</span></div><div class="tbl-wrap mini tall"><table class="tbl sx slams"><thead><tr><th class="l">Year</th><th class="l">Masters</th><th class="l">PGA Championship</th><th class="l">U.S. Open</th><th class="l">The Open</th></tr></thead><tbody>${grid}</tbody></table></div></div>`
      + src('Majors: Wikipedia winners lists (2025–26 confirmed with news reports) · all-time totals include pre-1934 majors · 2026 PGA Tour: official events');
  }

  /* ================= UFC ================= */
  const DIVS = () => Object.keys(D.ufc.rank);
  const days = (a, b) => Math.round(((b ? new Date(b) : new Date(D.ufc.asOf || Date.now())) - new Date(a)) / 864e5);
  function ufcIdx() {
    if (IX.uf) return IX.uf;
    const F2 = {}, CR = {}, RG = {};
    for (const f of D.ufc.fighters) F2[nk(f[0])] = { name: f[0], w: f[1], l: f[2], d: f[3], nc: f[4], cc: f[5], age: f[6], ht: f[7], reach: f[8], stance: f[9] };
    for (const c of D.ufc.career) CR[nk(c[0])] = { slpm: c[1], sacc: c[2], sapm: c[3], sdef: c[4], td: c[5], tdacc: c[6], tddef: c[7], sub: c[8], ko: c[9], subw: c[10], dec: c[11] };
    for (const r of D.ufc.reigns) { const a = (RG[nk(r[1])] = RG[nk(r[1])] || { name: r[1], reigns: [], def: 0, days: 0 }); a.reigns.push(r); a.def += r[4] || 0; a.days += days(r[2], r[3]); }
    // title-fight wins: every reign won in the cage (not by promotion from interim) plus its defenses — the rule the UFC record book uses
    const TFW = {}, promoted = new Set();
    for (const r of D.ufc.reigns) { const k = nk(r[1]); if (r[6] === 'promoted') promoted.add(k + '|' + r[0]); }
    for (const r of D.ufc.reigns) { const k = nk(r[1]), viaPromo = r[5] === 'undisputed' && promoted.has(k + '|' + r[0]) && D.ufc.reigns.some(q => nk(q[1]) === k && q[0] === r[0] && q[6] === 'promoted' && q[3] === r[2]); TFW[k] = (TFW[k] || 0) + (viaPromo ? 0 : 1) + (r[4] || 0); }
    for (const [n, w] of D.ufc.tfw) TFW[nk(n)] = w;
    const DIV = {}; for (const [d, lst] of Object.entries(D.ufc.rank)) for (const [r, n] of lst) { const k = nk(n); if (!/pound/i.test(d) && !DIV[k]) DIV[k] = { d, r }; }
    return (IX.uf = { F: F2, CR, RG, TFW, DIV });
  }
  const recOf = f => f ? `${f.w}-${f.l}${f.d ? '-' + f.d : ''}${f.nc ? ` (${f.nc} NC)` : ''}` : '—';
  const wpOf = f => f ? 100 * f.w / (f.w + f.l + (f.d || 0)) : NaN;
  function ufc(el, view) {
    const U = ufcIdx(), R = D.ufc.rank, divs = DIVS();
    if (!R[IX.div]) IX.div = divs.includes('Lightweight') ? 'Lightweight' : divs[0];
    const divSel = (id, cur, list) => `<label class="sr" for="${id}">Division</label><select id="${id}" class="sel">${list.map(d => `<option value="${esc(d)}" ${d === cur ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>`;
    const cur = D.ufc.current;
    if (view === 'teams') {
      const lst = R[IX.div] || [], champ = lst.find(x => x[0] === 'C');
      const reign = champ ? D.ufc.reigns.filter(r => nk(r[1]) === nk(champ[1]) && r[0] === IX.div && !r[3]).slice(-1)[0] : null;
      const tiles = `<div class="tiles sx-tiles">${champ ? tile('Champion', esc(champ[1]), reign ? `since ${esc(dateTxt(reign[2]))} · ${reign[4]} defense${reign[4] === 1 ? '' : 's'} · ${days(reign[2])} days` : recOf(U.F[nk(champ[1])]), true) : tile('Division', esc(IX.div), 'pound-for-pound: across divisions', true)}${tile('No. 1 contender', esc((lst.find(x => x[0] === 1) || [])[1] || '—'), recOf(U.F[nk((lst.find(x => x[0] === 1) || [])[1])]), true)}${tile('Average record of the ranked', F.pc0(mean(lst.map(x => wpOf(U.F[nk(x[1])])))), 'win % of the champion and top 15')}${tile('Title changes since 2020', D.ufc.reigns.filter(r => r[0] === IX.div && r[2] >= '2020' && r[5] === 'undisputed').length || '—', 'undisputed reigns begun')}</div>`;
      const head = th('#', { skip: 1 }) + th('Fighter', { l: 1 }) + th('Nation', { skip: 1 }) + th('Record', { skip: 1 }) + th('Win %') + th('Wins') + th('Losses', { low: 1 }) + th('Move') + th('Age') + th('Reach (in)') + th('Title reigns') + th('Title-fight wins');
      const body = lst.map(x => { const k = nk(x[1]), f = U.F[k], g = U.RG[k], reach = f && f.reach ? parseFloat(String(f.reach)) : NaN; return `<tr data-ix-player="${esc(x[1])}" data-lab="${esc(surname(x[1]))}" data-name="${esc(x[1])}"${x[0] === 'C' ? ' class="champ"' : ''}><td class="rk">${x[0] === 'C' ? '<b>C</b>' : x[0]}</td><td class="l"><b>${esc(x[1])}</b></td><td>${nat(f && f.cc)}</td><td>${recOf(f)}</td>${td(F.pc0(wpOf(f)), wpOf(f))}${td(f ? f.w : '—', f ? f.w : null)}${td(f ? f.l : '—', f ? f.l : null)}<td class="${x[2] > 0 ? 'delta-up' : x[2] < 0 ? 'delta-dn' : ''}">${x[2] ? F.sgn0(x[2]) : '—'}</td>${td(f && f.age ? f.age : '—', f && f.age ? f.age : null)}${td(fin(reach) ? reach : '—', fin(reach) ? reach : null)}${td(g ? g.reigns.length : 0, g ? g.reigns.length : 0)}${td(U.TFW[k] || 0, U.TFW[k] || 0)}</tr>`; }).join('');
      const champs = `<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Current champions</h2><span class="aside">as of ${esc(dateTxt(D.ufc.asOf))}</span></div><div class="champ-grid">${cur.map(([d, n, ty, since]) => { const r = D.ufc.reigns.filter(q => q[0] === d && nk(q[1]) === nk(n) && !q[3]).slice(-1)[0]; return `<button type="button" class="ccard" data-ix-player="${esc(n)}"><span class="eyebrow">${esc(d)}${ty === 'interim' ? ' · interim' : ''}</span><b>${esc(n)}</b><span class="muted small">${recOf(U.F[nk(n)])} · since ${esc(dateTxt(since))}${r ? ` · ${r[4]} def.` : ''}</span></button>`; }).join('')}</div></div>`;
      el.innerHTML = `<div class="panel ptool">${divSel('ix-div', IX.div, divs)}<span class="note">UFC rankings of ${esc(dateTxt(D.ufc.asOf))} · champion first, then 1–15 · click a fighter for a profile</span></div>` + tiles + `<div class="panel">${vz('uf-rank-' + nk(IX.div), head, body, { def: 'Win %', n: 16 })}</div>` + champs + src('Rankings: UFC via Sportradar · records: ufcstats.com and UFC.com (all professional MMA fights) · reigns: every UFC title reign');
      return;
    }
    if (view === 'players') {
      const rows = D.ufc.career.map(c => { const k = nk(c[0]), f = U.F[k], cr = U.CR[k], dv = U.DIV[k]; return { name: c[0], k, f, cr, dv }; });
      const head = th('Fighter', { l: 1 }) + th('Division', { skip: 1 }) + th('Rank', { low: 1 }) + th('Record', { skip: 1 }) + th('SLpM', { title: 'Significant strikes landed per minute' }) + th('Str. acc.', { title: 'Significant strike accuracy' }) + th('SApM', { low: 1, title: 'Significant strikes absorbed per minute' }) + th('Str. def.', { title: 'Share of opponents’ significant strikes avoided' }) + th('Strike diff', { title: 'SLpM − SApM' }) + th('TD avg', { title: 'Takedowns landed per 15 minutes' }) + th('TD acc.') + th('TD def.') + th('Sub avg', { title: 'Submission attempts per 15 minutes' }) + th('KO/TKO') + th('Sub') + th('Dec') + th('Finish %', { title: 'Wins by KO/TKO or submission ÷ all wins' });
      const body = rows.map(({ name, f, cr, dv }) => { const c = cr, diff = c.slpm - c.sapm, wins = c.ko + c.subw + c.dec, fp = wins ? 100 * (c.ko + c.subw) / wins : NaN; return `<tr data-ix-player="${esc(name)}" data-lab="${esc(surname(name))}" data-name="${esc(name)}"><td class="l"><b>${esc(name)}</b></td><td>${dv ? esc(dv.d.replace("Women's ", 'W ')) : '—'}</td>${td(dv ? (dv.r === 'C' ? 'C' : dv.r) : '—', dv ? (dv.r === 'C' ? 0 : dv.r) : null)}<td>${recOf(f)}</td>${td(F.d2(c.slpm), c.slpm)}${td(F.pc0(c.sacc), c.sacc)}${td(F.d2(c.sapm), c.sapm)}${td(F.pc0(c.sdef), c.sdef)}${td(F.sgn(diff), diff)}${td(F.d2(c.td), c.td)}${td(F.pc0(c.tdacc), c.tdacc)}${td(F.pc0(c.tddef), c.tddef)}${td(F.d2(c.sub), c.sub)}${td(c.ko, c.ko)}${td(c.subw, c.subw)}${td(c.dec, c.dec)}${td(F.pc0(fp), fp)}</tr>`; }).join('');
      el.innerHTML = `<div class="panel ptool"><b>Career fight statistics</b><span class="note">${rows.length} champions and top contenders · UFC.com career stats (TD accuracy estimated where UFC.com's count is inconsistent)</span></div><div class="panel">${vz('uf-career', head, body, { def: 'Strike diff', n: 25 })}</div>` + src('Career statistics: UFC.com athlete pages (UFC fights only) · records: ufcstats.com/UFC.com (all pro fights)');
      return;
    }
    if (view === 'analytics') {
      const rows = D.ufc.career.map(c => ({ name: c[0], c: U.CR[nk(c[0])], dv: U.DIV[nk(c[0])] }));
      const style = rows.map(({ name, c }) => ({ x: c.slpm - c.sapm, y: c.td + c.sub, key: name, label: surname(name), emph: true, tip: `${esc(name)}<br>strike diff <b>${F.sgn(c.slpm - c.sapm)}</b>/min · TD ${F.d2(c.td)} + sub ${F.d2(c.sub)} per 15` }));
      const defn = rows.map(({ name, c }) => ({ x: c.sdef, y: c.tddef, key: name, label: surname(name), emph: true, tip: `${esc(name)}<br>strike defense ${F.pc0(c.sdef)} · takedown defense ${F.pc0(c.tddef)}` }));
      const champs = new Set(D.ufc.current.map(c => nk(c[1])));
      const how = rows.filter(r => champs.has(nk(r.name)) || (r.dv && r.dv.r !== 'C' && r.dv.r <= 3)).sort((a, b) => (b.c.ko + b.c.subw) / (b.c.ko + b.c.subw + b.c.dec) - (a.c.ko + a.c.subw) / (a.c.ko + a.c.subw + a.c.dec)).slice(0, 22).map(r => ({ lab: surname(r.name), name: r.name, parts: [r.c.ko, r.c.subw, r.c.dec], key: r.name, sel: champs.has(nk(r.name)) }));
      const und = D.ufc.reigns.filter(r => r[5] === 'undisputed').map(r => ({ r, d: days(r[2], r[3]) }));
      const longest = und.slice().sort((a, b) => b.d - a.d).slice(0, 15).map(x => ({ lab: surname(x.r[1]), name: `${x.r[1]} · ${x.r[0]} (${x.r[2].slice(0, 4)}–${x.r[3] ? x.r[3].slice(0, 4) : 'now'})`, v: x.d, disp: `${F.i(x.d)} d · ${x.r[4]} def.`, key: x.r[1] }));
      const byDiv = {}; for (const x of und) { const b = (byDiv[x.r[0]] = byDiv[x.r[0]] || { n: 0, d: [], def: [] }); b.n++; b.d.push(x.d); b.def.push(x.r[4]); }
      const dh = th('Division', { l: 1 }) + th('Undisputed reigns') + th('Avg reign (days)') + th('Avg defenses') + th('Longest (days)') + th('Current champion', { skip: 1 });
      const db = Object.entries(byDiv).map(([d, b]) => `<tr data-lab="${esc(d.replace("Women's ", 'W '))}" data-name="${esc(d)}"><td class="l"><b>${esc(d)}</b></td>${td(b.n, b.n)}${td(F.i(mean(b.d)), mean(b.d))}${td(F.d1(mean(b.def)), mean(b.def))}${td(F.i(Math.max(...b.d)), Math.max(...b.d))}<td>${esc((cur.find(c => c[0] === d) || [])[1] || '— (vacant or discontinued)')}</td></tr>`).join('');
      el.innerHTML = `<div class="sx-two"><div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Striker or grappler?</h2><span class="aside">striking differential vs grappling output</span></div>${C.scatter(style, { refX: 0, xLab: 'Strike differential (landed − absorbed per min)', yLab: 'Takedowns + sub attempts per 15 min', quad: { tr: 'Complete fighters', tl: 'Grapplers', br: 'Strikers', bl: 'Outworked' }, attr: 'data-ix-player', h: 340, xFmt: F.sgn, aria: 'Fighting style map' })}</div>
        <div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Defensive profile</h2><span class="aside">share of strikes and takedowns stopped</span></div>${C.scatter(defn, { refX: mean(defn.map(p => p.x)), refY: mean(defn.map(p => p.y)), xLab: 'Striking defense %', yLab: 'Takedown defense %', quad: { tr: 'Hard to hit, hard to drag down', tl: 'Hittable, stays up', br: 'Elusive, takedown risk', bl: 'Vulnerable' }, attr: 'data-ix-player', h: 340, aria: 'Defensive profile' })}</div></div>
        <div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">How they win</h2><span class="aside">share of career wins by method · champions highlighted · sorted by finish rate</span></div>${C.stack(how, { keys: [{ lab: 'KO/TKO' }, { lab: 'Submission' }, { lab: 'Decision' }], attr: 'data-ix-player', aria: 'Wins by method' })}</div>
        <div class="sx-two"><div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Longest title reigns</h2><span class="aside">undisputed reigns, days held</span></div>${C.hbars(longest, { attr: 'data-ix-player', fmt: v => F.i(v), aria: 'Longest UFC title reigns' })}</div>
          <div class="panel"><div class="ptool"><b>Title turnover by division</b></div>${vz('uf-divs', dh, db, { def: 'Avg reign (days)', n: 12, on: false })}</div></div>`
        + gloss([['SLpM / SApM', 'Significant strikes landed / absorbed per minute of fight time', 'Significant strikes ÷ minutes fought (UFC fights)'], ['Striking accuracy / defense', 'Share of own strikes that land / of opponents’ strikes avoided', 'Landed ÷ attempted; 1 − opponents’ landed ÷ attempted'], ['Strike differential', 'Net striking per minute: the best simple striking predictor', 'SLpM − SApM'], ['TD avg / accuracy / defense', 'Wrestling offense and defense', 'Takedowns per 15 min; landed ÷ attempted; stuffed ÷ faced'], ['Sub avg', 'Submission threat', 'Submission attempts per 15 minutes'], ['Finish %', 'How often wins end early', '(KO/TKO + submission wins) ÷ wins'], ['Reign length / defenses', 'Dominance as champion', 'Days from winning the belt to losing, vacating or today; successful defenses in that reign']])
        + src('Career stats: UFC.com · reigns: every UFC title reign through ' + esc(dateTxt(D.ufc.asOf)));
      return;
    }
    // history
    const hd = D.ufc.reigns.some(r => r[0] === IX.hdiv) ? IX.hdiv : D.ufc.reigns[0][0], hdivs = [...new Set(D.ufc.reigns.map(r => r[0]))];
    const lin = D.ufc.reigns.filter(r => r[0] === hd);
    const lh = th('#', { skip: 1 }) + th('Champion', { l: 1 }) + th('Won', { skip: 1 }) + th('Ended', { skip: 1 }) + th('Days') + th('Defenses') + th('Type', { skip: 1 }) + th('How it ended', { skip: 1 });
    const lb = lin.slice().reverse().map((r, i) => `<tr data-ix-player="${esc(r[1])}" data-lab="${esc(surname(r[1]))}" data-name="${esc(r[1])}"${r[5] === 'interim' ? ' class="ghost"' : ''}><td class="rk">${lin.length - i}</td><td class="l"><b>${esc(r[1])}</b></td><td>${esc(r[2])}</td><td>${esc(r[3] || 'current')}</td>${td(F.i(days(r[2], r[3])), days(r[2], r[3]))}${td(r[4], r[4])}<td>${esc(r[5])}</td><td>${esc(r[6])}</td></tr>`).join('');
    const tfw = D.ufc.tfw.slice(0, 20).map(([n, w]) => ({ lab: surname(n), name: n, v: w, key: n }));
    const byF = Object.values(U.RG).sort((a, b) => b.def - a.def || b.days - a.days).slice(0, 25);
    const fh = th('#', { skip: 1 }) + th('Fighter', { l: 1 }) + th('Reigns') + th('Total defenses') + th('Days as champion') + th('Title-fight wins') + th('Divisions', { skip: 1 });
    const fb = byF.map((a, i) => `<tr data-ix-player="${esc(a.name)}" data-lab="${esc(surname(a.name))}" data-name="${esc(a.name)}"><td class="rk">${i + 1}</td><td class="l"><b>${esc(a.name)}</b></td>${td(a.reigns.length, a.reigns.length)}${td(a.def, a.def)}${td(F.i(a.days), a.days)}${td(U.TFW[nk(a.name)] || '—', U.TFW[nk(a.name)] || null)}<td>${esc([...new Set(a.reigns.map(r => r[0]))].join(', '))}</td></tr>`).join('');
    el.innerHTML = `<div class="tiles sx-tiles">${tile('Most title-fight wins', esc(D.ufc.tfw[0][0]), `${D.ufc.tfw[0][1]} wins`, true)}${tile('Most defenses in one reign', esc(D.ufc.reigns.slice().sort((a, b) => b[4] - a[4])[0][1]), `${D.ufc.reigns.slice().sort((a, b) => b[4] - a[4])[0][4]} (${esc(D.ufc.reigns.slice().sort((a, b) => b[4] - a[4])[0][0])})`, true)}${tile('Title reigns on record', D.ufc.reigns.length, `${D.ufc.reigns.filter(r => r[5] === 'interim').length} interim · ${hdivs.length} divisions`)}${tile('Two-division champions', Object.values(U.RG).filter(a => new Set(a.reigns.filter(r => r[5] === 'undisputed').map(r => r[0])).size > 1).length, 'held undisputed belts in two divisions')}</div>
      <div class="panel"><div class="ptool">${divSel('ix-hdiv', hd, hdivs)}<b>Title lineage</b><span class="note">${lin.length} reigns · newest first · grey = interim</span></div>${vz('uf-lin-' + nk(hd), lh, lb, { def: 'Days', n: 20, on: false })}</div>
      <div class="sx-two"><div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Most UFC title-fight wins</h2><span class="aside">interim title fights included</span></div>${C.hbars(tfw, { attr: 'data-ix-player', fmt: v => String(Math.round(v)), aria: 'Most title-fight wins' })}</div>
        <div class="panel"><div class="ptool"><b>Championship careers</b><span class="note">title reigns and defenses per fighter (all divisions)</span></div>${vz('uf-careers', fh, fb, { def: 'Total defenses', n: 20 })}</div></div>`
      + src('Every UFC title reign (undisputed and interim) from Wikipedia’s “List of UFC champions”, 2025–26 changes confirmed with news reports · title-fight wins: UFC records');
  }

  /* ================= player card ================= */
  function openPlayer(sport, name) {
    const el = $('#drawer'); if (!el) return;
    el.hidden = false; document.body.style.overflow = 'hidden';
    el.innerHTML = `<div class="drawer-scrim" data-close></div><aside class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="ix-ttl"><div class="dr-head"><span class="lg-tag">${esc(sport === 'ufc' ? 'UFC' : sport[0].toUpperCase() + sport.slice(1))}</span><span class="ttl" id="ix-ttl">${esc(name)}</span><button type="button" class="icon-btn" data-close aria-label="Close">✕ Close</button></div><div class="dr-body" id="ix-body"></div></aside>`;
    const body = $('#ix-body'), k = nk(name), tiles = [], parts = [];
    if (sport === 'tennis') {
      for (const tour of ['atp', 'wta']) {
        const M = tennisModel(tour, (IX.live[tour] && IX.live[tour].rows) || D.tennis[tour]), p = M.players.find(x => x.k === k), s = M.sl.by[k];
        if (!p && !s) continue;
        if (p) tiles.push(tile(`${tour.toUpperCase()} ranking`, 'No. ' + p.rank, `${F.i(p.pts)} points${p.age ? ' · age ' + p.age : ''} · ${esc(p.cc || '')}`), tile('Elo', p.elo ? F.i(p.elo.all) : '—', p.elo ? `hard ${F.i(p.elo.hard)} · clay ${F.i(p.elo.clay)} · grass ${F.i(p.elo.grass)}` : 'outside the Elo top 50'), tile('2026 season', p.ti ? p.ti.n + ' titles' : '0 titles', p.ytd ? `${p.ytd.w}-${p.ytd.l} in matches` : ''));
        if (s) {
          tiles.push(tile('Grand Slam titles', s.won.length, `${s.won.length + s.lost.length} finals · AO ${s.ev.AO} · RG ${s.ev.RG} · W ${s.ev.W} · USO ${s.ev.USO}`));
          const all = s.won.map(x => ({ x, w: 1 })).concat(s.lost.map(x => ({ x, w: 0 }))).sort((a, b) => b.x.y - a.x.y || (b.x.ev > a.x.ev ? 1 : -1));
          parts.push(`<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:17px">Grand Slam finals</h2><span class="aside">${s.won.length}-${s.lost.length}</span></div><ul class="plays">${all.map(({ x, w }) => `<li><span class="t">${x.y}</span><span>${esc(EVN[x.ev])} · ${w ? 'd. ' + esc(x.r) : 'lost to ' + esc(x.w)}</span><span class="s">${w ? '<b>W</b>' : 'L'}</span></li>`).join('')}</ul></div>`);
        }
      }
    } else if (sport === 'golf') {
      const o = D.golf.owgr.find(r => nk(r[1]) === k), st = D.golf.stats, r = st.rows.find(q => nk(q[0]) === k), m = majorIdx().by[k], ix = n => st.cols.indexOf(n) + 2, sg = (D.golf.sg || []).find(q => nk(q[0]) === k);
      if (o) tiles.push(tile('World ranking', 'No. ' + o[0], `${F.d2(o[3])} avg points · ${o[5]} events · ${esc(o[2])}`));
      if (m) tiles.push(tile('Major championships', m.total, `Masters ${m.all.M} · PGA ${m.all.PGA} · U.S. Open ${m.all.USO} · Open ${m.all.OPEN}`));
      if (r) tiles.push(tile(`${st.season} PGA Tour`, `${r[ix('WINS')]} win${r[ix('WINS')] === 1 ? '' : 's'}`, `${F.money(r[ix('EARN')])} · ${r[ix('TOP10')]} top 10s in ${r[ix('EVNTS')]} events · scoring ${F.d2(r[ix('SCORE')])}`));
      if (sg) tiles.push(tile('Strokes gained / round', F.sgn(sg[1]), `tee ${F.sgn(sg[2])} · approach ${F.sgn(sg[3])} · short game ${F.sgn(sg[4])} · putting ${F.sgn(sg[5])}`));
      if (m && m.won.length) parts.push(`<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:17px">Major titles</h2><span class="aside">since 1934</span></div><ul class="plays">${m.won.slice().reverse().map(x => `<li><span class="t">${x.y}</span><span>${esc(MJ[x.ev])}</span><span class="s"><b>W</b></span></li>`).join('')}</ul></div>`);
      const wins = D.golf.pga.filter(q => nk(q[2]) === k);
      if (wins.length) parts.push(`<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:17px">2026 PGA Tour wins</h2></div><ul class="plays">${wins.map(q => `<li><span class="t">${esc(dateTxt(q[0]))}</span><span>${esc(q[1])}</span><span class="s"><b>W</b></span></li>`).join('')}</ul></div>`);
    } else {
      const U = ufcIdx(), f = U.F[k], c = U.CR[k], g = U.RG[k], dv = U.DIV[k];
      if (f) tiles.push(tile('Record', recOf(f), `${F.pc0(wpOf(f))} wins · ${esc(f.cc || '')}${f.age ? ' · age ' + f.age : ''}${f.reach ? ' · reach ' + esc(f.reach) : ''}`));
      if (dv) tiles.push(tile(esc(dv.d), dv.r === 'C' ? 'Champion' : 'No. ' + dv.r, 'current UFC ranking'));
      if (g) tiles.push(tile('UFC title reigns', g.reigns.length, `${g.def} defenses · ${F.i(g.days)} days as champion · ${U.TFW[k] || 0} title-fight wins`));
      if (c) tiles.push(tile('Striking', `${F.d2(c.slpm)}<small>/ ${F.d2(c.sapm)}</small>`, `landed / absorbed per min · accuracy ${F.pc0(c.sacc)} · defense ${F.pc0(c.sdef)}`), tile('Grappling', F.d2(c.td) + '<small> TD/15</small>', `TD accuracy ${F.pc0(c.tdacc)} · TD defense ${F.pc0(c.tddef)} · subs ${F.d2(c.sub)}/15`), tile('Wins by method', `${c.ko}-${c.subw}-${c.dec}`, 'KO/TKO – submission – decision'));
      if (g) parts.push(`<div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:17px">Title reigns</h2></div><ul class="plays">${g.reigns.slice().reverse().map(r => `<li><span class="t">${esc(r[2].slice(0, 4))}</span><span>${esc(r[0])}${r[5] === 'interim' ? ' (interim)' : ''} · ${esc(r[2])} → ${esc(r[3] || 'now')} · ${r[4]} def.</span><span class="s">${esc(r[6])}</span></li>`).join('')}</ul></div>`);
    }
    body.innerHTML = (tiles.length ? `<div class="tiles sx-tiles">${tiles.join('')}</div>` : '<div class="panel empty">No profile data for this player in the current data set.</div>') + parts.join('');
    setTimeout(() => { const b = el.querySelector('[data-close].icon-btn'); if (b) b.focus(); }, 30);
  }

  /* ================= shell ================= */
  function view(el, id, v, tok) {
    el.innerHTML = '<div class="panel panel-pad"><div class="skel-line"></div><div class="skel-line"></div><div class="skel-line"></div></div>';
    const run = id === 'tennis' ? tennis(el, v, tok) : id === 'golf' ? golf(el, v, tok) : Promise.resolve(ufc(el, v));
    Promise.resolve(run).catch(e => { if (alive(tok)) el.innerHTML = `<div class="panel empty">Couldn't build this view (${esc(e && e.message || e)}).</div>`; });
  }
  document.addEventListener('click', e => {
    const t = e.target; if (!t.closest || !t.closest('#view-stats') || !APP.SX || !is(APP.SX.lg)) return;
    const a = t.closest('[data-ix-tour]'); if (a) { IX.tour = a.getAttribute('data-ix-tour'); APP.renderStats(); return; }
    const s = t.closest('[data-ix-surf]'); if (s) { IX.surf = s.getAttribute('data-ix-surf'); APP.renderStats(); return; }
    const p = t.closest('[data-ix-player]'); if (p) { openPlayer(APP.SX.lg, p.getAttribute('data-ix-player')); }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'ix-div') { IX.div = e.target.value; APP.renderStats(); }
    if (e.target.id === 'ix-hdiv') { IX.hdiv = e.target.value; APP.renderStats(); }
  });
  APP.indiv = { is, ok: () => !!D, sports: SPORTS, VN, view };
})();
