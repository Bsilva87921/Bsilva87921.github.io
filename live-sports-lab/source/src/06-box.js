/* ==========================================================================
   Probable — game center box scores: line score, leaders, team stats,
   player box scores, in-game advanced metrics, win-probability analytics
   ========================================================================== */
(function () {
  'use strict';
  const APP = window.APP, C = APP.charts;
  const { esc, kindOf, ord } = APP;
  const BOX = APP.box = {};
  const fin = v => typeof v === 'number' && isFinite(v);
  const pair = s => { const m = String(s == null ? '' : s).match(/^\s*(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)\s*$/); return m ? [+m[1], +m[2]] : [NaN, NaN]; };
  const numOf = s => { const t = String(s == null ? '' : s).trim(); const p = pair(t); if (fin(p[0])) return p[0]; if (/^\d+:\d{2}$/.test(t)) { const [a, b] = t.split(':'); return +a + b / 60; } return parseFloat(t.replace(/[,%]/g, '')); };
  const pc = (a, b) => fin(a) && fin(b) && b > 0 ? (100 * a / b).toFixed(1) + '%' : '—';
  const d1 = v => fin(v) ? v.toFixed(1) : '—', d2 = v => fin(v) ? v.toFixed(2) : '—';
  const per = (kind, n) => !n ? '' : kind === 'bb' ? ord(n) : kind === 'sc' ? (n === 1 ? '1st half' : n === 2 ? '2nd half' : 'ET') : (kind === 'hk' ? (n > 3 ? 'OT' : 'P' + n) : (n > 4 ? 'OT' : 'Q' + n));

  /* ---------- ESPN summary → normalized box ---------- */
  BOX.parse = function (js, g) {
    const kind = kindOf(g.lg), b = { src: 'ESPN', team: [], adv: [], players: { away: [], home: [] }, leaders: [], scoring: [], drives: [], recent: [], inj: [], notes: [] };
    const sideOf = (id, abbr, i) => (id && String(id) === String(g.home.id)) || (abbr && abbr === g.home.abbr) ? 'home' : (id && String(id) === String(g.away.id)) || (abbr && abbr === g.away.abbr) ? 'away' : (i ? 'home' : 'away');
    // line score
    const hc = js.header && js.header.competitions && js.header.competitions[0];
    if (hc && hc.competitors) {
      const ls = { away: null, home: null };
      hc.competitors.forEach((c, i) => { const s = c.homeAway || sideOf(c.team && c.team.id, c.team && c.team.abbreviation, i); ls[s] = (c.linescores || []).map(x => x.displayValue != null ? x.displayValue : x.value); });
      if (ls.away && ls.home && ls.away.length && ls.home.length) {
        const n = Math.max(ls.away.length, ls.home.length), reg = kind === 'bb' ? 9 : kind === 'hk' ? 3 : kind === 'sc' ? 2 : 4;
        b.line = { labels: Array.from({ length: n }, (_, i) => kind === 'bb' ? String(i + 1) : kind === 'sc' ? (i < 2 ? (i ? '2H' : '1H') : 'ET') : i < reg ? String(i + 1) : (n - reg > 1 ? 'OT' + (i - reg + 1) : 'OT')), a: ls.away, h: ls.home };
        if (kind === 'bb') { const rhe = s => { const c = hc.competitors.find(x => x.homeAway === s); return c ? [c.score, c.hits, c.errors] : null; }; const ra = rhe('away'), rh = rhe('home'); if (ra && rh && ra[1] != null) b.line.rhe = { a: ra, h: rh }; }
      }
    }
    // team stats
    const tmap = { away: {}, home: {} }, order = [];
    ((js.boxscore && js.boxscore.teams) || []).forEach((t, i) => {
      const s = t.homeAway || sideOf(t.team && t.team.id, t.team && t.team.abbreviation, i);
      const add = (k, lab, dv, grp) => { if (dv == null || dv === '') return; if (!order.some(o => o.k === k)) order.push({ k, lab, grp }); tmap[s][k] = String(dv); };
      for (const st of t.statistics || []) {
        if (Array.isArray(st.stats)) for (const x of st.stats) add((st.name || '') + '.' + x.name, x.label || x.displayName || x.abbreviation || x.name, x.displayValue, st.displayName || st.name);
        else add(st.name, st.label || st.displayName || st.name, st.displayValue);
      }
    });
    b.team = order.filter(o => tmap.away[o.k] != null && tmap.home[o.k] != null).map(o => ({ k: o.k, lab: o.lab, grp: o.grp, a: tmap.away[o.k], h: tmap.home[o.k] }));
    b.adv = advanced(kind, tmap, g);
    // players
    ((js.boxscore && js.boxscore.players) || []).forEach((p, i) => {
      const s = sideOf(p.team && p.team.id, p.team && p.team.abbreviation, i);
      for (const grp of p.statistics || []) {
        const rows = (grp.athletes || []).map(a => ({ id: String((a.athlete && a.athlete.id) || ''), name: (a.athlete && (a.athlete.shortName || a.athlete.displayName)) || '—', pos: (a.athlete && a.athlete.position && a.athlete.position.abbreviation) || '', starter: !!a.starter, dnp: !!a.didNotPlay || !(a.stats && a.stats.length), reason: a.reason || '', stats: a.stats || [] }));
        if (!rows.length) continue;
        const nm = grp.text || grp.name || grp.type || '';
        b.players[s].push({ name: String(nm).replace(new RegExp('^' + (p.team && p.team.displayName || '#none#') + '\\s*', 'i'), '') || 'Box score', labels: grp.labels || [], rows, totals: grp.totals || [] });
      }
    });
    if (kind === 'sc' && js.rosters) (js.rosters || []).forEach((r, i) => {
      const s = r.homeAway || sideOf(r.team && r.team.id, r.team && r.team.abbreviation, i);
      const want = [['totalGoals', 'G'], ['goalAssists', 'A'], ['totalShots', 'SH'], ['shotsOnTarget', 'ST'], ['foulsCommitted', 'FC'], ['foulsSuffered', 'FS'], ['yellowCards', 'YC'], ['redCards', 'RC'], ['saves', 'SV'], ['offsides', 'OF']];
      const rows = (r.roster || []).filter(x => x.starter || x.subbedIn).map(x => { const m = {}; for (const st of x.stats || []) m[st.name] = st.displayValue != null ? st.displayValue : st.value; return { id: String((x.athlete && x.athlete.id) || ''), name: (x.athlete && (x.athlete.shortName || x.athlete.displayName)) || '—', pos: (x.position && x.position.abbreviation) || '', starter: !!x.starter, dnp: false, stats: want.map(w => m[w[0]] != null ? String(m[w[0]]) : '0') }; });
      if (rows.length) b.players[s].push({ name: 'Lineup', labels: want.map(w => w[1]), rows, totals: [] });
    });
    // leaders
    const L = js.leaders || [];
    if (L.length >= 2) {
      const la = L.find((x, i) => sideOf(x.team && x.team.id, x.team && x.team.abbreviation, i) === 'away') || L[0], lh = L.find((x, i) => sideOf(x.team && x.team.id, x.team && x.team.abbreviation, i) === 'home') || L[1];
      for (const cat of la.leaders || []) {
        const ch = (lh.leaders || []).find(x => x.name === cat.name), A = cat.leaders && cat.leaders[0], H = ch && ch.leaders && ch.leaders[0];
        if (!A && !H) continue;
        const who = x => x ? { n: (x.athlete && (x.athlete.shortName || x.athlete.displayName)) || '', v: x.displayValue || '' } : null;
        b.leaders.push({ lab: cat.displayName || cat.name, a: who(A), h: who(H) });
      }
    }
    // plays
    b.scoring = (js.scoringPlays || []).map(p => ({ t: per(kind, p.period && p.period.number) + ' ' + ((p.clock && p.clock.displayValue) || ''), text: p.text || (p.type && p.type.text) || '', s: p.awayScore != null ? p.awayScore + '–' + p.homeScore : '', team: (p.team && p.team.abbreviation) || '' }));
    const prev = (js.drives && js.drives.previous) || [];
    b.drives = prev.map(d => ({ team: (d.team && (d.team.abbreviation || d.team.shortDisplayName)) || '', res: d.displayResult || d.result || '', desc: d.description || '', score: !!d.isScore, t: (d.start && d.start.period && d.start.period.number ? per(kind, d.start.period.number) + ' ' : '') + ((d.start && d.start.clock && d.start.clock.displayValue) || '') }));
    const plays = (js.plays || []).slice();
    b.recent = plays.slice(-25).reverse().map(p => ({ t: per(kind, p.period && p.period.number) + ' ' + ((p.clock && p.clock.displayValue) || ''), text: p.text || (p.type && p.type.text) || '', s: p.awayScore != null ? p.awayScore + '–' + p.homeScore : '', score: !!p.scoringPlay }));
    if (!b.scoring.length && js.keyEvents) b.scoring = (js.keyEvents || []).filter(k => k.text || k.type).map(k => ({ t: (k.clock && k.clock.displayValue) || '', text: ((k.type && k.type.text) ? k.type.text + ': ' : '') + (k.text || k.shortText || ''), s: '', team: (k.team && k.team.abbreviation) || '' }));
    // win probability with play text
    const text = new Map(); for (const p of plays) if (p.id) text.set(String(p.id), p.text || ''); for (const d of prev) for (const p of d.plays || []) if (p.id && !text.has(String(p.id))) text.set(String(p.id), p.text || '');
    const wp = (js.winprobability || []).map(x => ({ p: +x.homeWinPercentage, id: String(x.playId || '') })).filter(x => fin(x.p));
    b.wp = wp.map(x => x.p); b.wpText = wp.map(x => text.get(x.id) || '');
    // context
    b.inj = (js.injuries || []).map((t, i) => ({ team: (t.team && t.team.abbreviation) || '', list: (t.injuries || []).map(x => ({ n: (x.athlete && x.athlete.displayName) || '', st: x.status || (x.type && x.type.description) || '', d: (x.details && (x.details.type || x.details.detail)) || '' })) })).filter(t => t.list.length);
    const ss = js.seasonseries && js.seasonseries[0]; if (ss && (ss.summary || ss.description)) b.notes.push(ss.summary || ss.description);
    const gi = js.gameInfo; if (gi && gi.attendance) b.notes.push('Attendance ' + Number(gi.attendance).toLocaleString());
    if (gi && gi.officials && gi.officials.length) b.notes.push('Officials: ' + gi.officials.slice(0, 4).map(o => o.displayName || o.fullName).filter(Boolean).join(', '));
    return b;
  };

  // advanced in-game metrics from the team box
  function advanced(kind, T, g) {
    const A = T.away, H = T.home, out = [], sa = +g.away.score, sh = +g.home.score;
    const get = (m, ...ks) => { for (const k of ks) { if (m[k] != null) return m[k]; const hit = Object.keys(m).find(x => x.endsWith('.' + k)); if (hit) return m[hit]; } return null; };
    const row = (lab, a, h, tip) => { if (a == null || h == null || a === '—' || h === '—') return; out.push({ lab, a, h, tip: tip || '' }); };
    if (kind === 'bk') {
      const side = (m, pts, om) => {
        const [fgm, fga] = pair(get(m, 'fieldGoalsMade-fieldGoalsAttempted')), [tpm, tpa] = pair(get(m, 'threePointFieldGoalsMade-threePointFieldGoalsAttempted')), [ftm, fta] = pair(get(m, 'freeThrowsMade-freeThrowsAttempted'));
        const orb = numOf(get(m, 'offensiveRebounds')), tov = numOf(get(m, 'totalTurnovers', 'turnovers')), odrb = numOf(get(om, 'defensiveRebounds'));
        return { fgm, fga, tpm, tpa, ftm, fta, orb, tov, odrb, pts, poss: fga - orb + tov + 0.44 * fta };
      };
      const a = side(A, sa, H), h = side(H, sh, A), poss = (a.poss + h.poss) / 2;
      if (!fin(poss) || poss <= 0) return out;
      row('Possessions', d1(a.poss), d1(h.poss), 'FGA − OREB + TOV + 0.44 × FTA');
      row('Points per 100 poss.', d1(100 * a.pts / poss), d1(100 * h.pts / poss), 'Offensive rating on the game\'s average possessions');
      row('eFG%', pc(a.fgm + 0.5 * a.tpm, a.fga), pc(h.fgm + 0.5 * h.tpm, h.fga), 'Field goal % with threes worth 1.5 makes');
      row('True shooting %', pc(a.pts, 2 * (a.fga + 0.44 * a.fta)), pc(h.pts, 2 * (h.fga + 0.44 * h.fta)));
      row('Turnover %', pc(a.tov, a.fga + 0.44 * a.fta + a.tov), pc(h.tov, h.fga + 0.44 * h.fta + h.tov), 'Turnovers per 100 plays');
      row('Off. rebound %', pc(a.orb, a.orb + a.odrb), pc(h.orb, h.orb + h.odrb), 'Share of own misses rebounded');
      row('FT rate', d2(a.fta / a.fga), d2(h.fta / h.fga), 'Free-throw attempts per shot');
      row('3PA rate', pc(a.tpa, a.fga), pc(h.tpa, h.fga), 'Share of shots from three');
    } else if (kind === 'fb') {
      const side = (m, pts, om) => {
        const [c, att] = pair(get(m, 'completionAttempts')), [sk] = pair(get(m, 'sacksYardsLost')), ra = numOf(get(m, 'rushingAttempts')), yds = numOf(get(m, 'totalYards'));
        const [t3, a3] = pair(get(m, 'thirdDownEff')), [t4, a4] = pair(get(m, 'fourthDownEff')), [rz, rza] = pair(get(m, 'redZoneAttempts')), drives = numOf(get(m, 'totalDrives'));
        const to = numOf(get(m, 'turnovers')), oto = numOf(get(om, 'turnovers')), plays = numOf(get(m, 'totalOffensivePlays'));
        return { c, att, sk, ra, yds, t3, a3, t4, a4, rz, rza, drives, to, oto, pts, plays: fin(plays) ? plays : att + (fin(sk) ? sk : 0) + ra };
      };
      const a = side(A, sa, H), h = side(H, sh, A);
      row('Yards per play', d2(a.yds / a.plays), d2(h.yds / h.plays));
      row('3rd-down conversion', pc(a.t3, a.a3), pc(h.t3, h.a3));
      if (a.a4 || h.a4) row('4th-down conversion', pc(a.t4, a.a4), pc(h.t4, h.a4));
      if (fin(a.rza) && fin(h.rza)) row('Red-zone TD rate', pc(a.rz, a.rza), pc(h.rz, h.rza), 'Touchdowns per red-zone trip');
      if (fin(a.drives) && a.drives > 0 && fin(h.drives)) row('Points per drive', d2(a.pts / a.drives), d2(h.pts / h.drives));
      if (fin(a.to) && fin(h.to)) row('Turnover margin', (a.oto - a.to > 0 ? '+' : '') + (a.oto - a.to), (h.oto - h.to > 0 ? '+' : '') + (h.oto - h.to));
      if (fin(a.att)) row('Pass rate', pc(a.att + (fin(a.sk) ? a.sk : 0), a.plays), pc(h.att + (fin(h.sk) ? h.sk : 0), h.plays), 'Dropbacks per offensive play');
    } else if (kind === 'hk') {
      const s = m => numOf(get(m, 'shotsTotal', 'shots')), ppg = m => numOf(get(m, 'powerPlayGoals')), ppo = m => numOf(get(m, 'powerPlayOpportunities'));
      const shA = s(A), shH = s(H);
      if (fin(shA) && fin(shH) && shA + shH > 0) {
        row('Shot share', pc(shA, shA + shH), pc(shH, shA + shH), 'Share of all shots on goal');
        row('Shooting %', pc(sa, shA), pc(sh, shH));
        row('Save %', pc(shH - sh, shH), pc(shA - sa, shA));
        row('PDO', d1(100 * sa / shA + 100 * (shH - sh) / shH), d1(100 * sh / shH + 100 * (shA - sa) / shA), 'Shooting % + save %; about 100 is normal');
      }
      if (fin(ppo(A)) && fin(ppo(H))) row('Power play', `${ppg(A) || 0}/${ppo(A)}`, `${ppg(H) || 0}/${ppo(H)}`);
      const fo = m => numOf(get(m, 'faceoffPercent')); if (fin(fo(A))) row('Faceoff %', d1(fo(A)) + '%', d1(fo(H)) + '%');
    } else if (kind === 'sc') {
      const shots = m => numOf(get(m, 'totalShots')), sot = m => numOf(get(m, 'shotsOnTarget')), acc = m => numOf(get(m, 'accuratePasses')), pas = m => numOf(get(m, 'totalPasses'));
      if (fin(shots(A)) && fin(shots(H))) {
        row('Shot accuracy', pc(sot(A), shots(A)), pc(sot(H), shots(H)), 'Shots on target per shot');
        row('Conversion', pc(sa, shots(A)), pc(sh, shots(H)), 'Goals per shot');
        row('Goals per shot on target', d2(sa / sot(A)), d2(sh / sot(H)));
      }
      if (fin(pas(A)) && fin(pas(H))) row('Pass accuracy', pc(acc(A), pas(A)), pc(acc(H), pas(H)));
    } else if (kind === 'bb') {
      const hbw = m => numOf(get(m, 'hits')) + (numOf(get(m, 'walks')) || 0);
      if (fin(hbw(A)) && fin(hbw(H))) row('Baserunners (H + BB)', String(hbw(A)), String(hbw(H)));
      const lob = m => get(m, 'leftOnBase', 'LOB'); if (lob(A) != null && lob(H) != null) row('Left on base', lob(A), lob(H));
    }
    return out;
  }

  /* ---------- win-probability analytics ---------- */
  function wpStats(wp, g) {
    if (!wp || wp.length < 4) return null;
    let exc = 0, lc = 0, big = { d: 0, i: -1 };
    for (let i = 1; i < wp.length; i++) { const d = wp[i] - wp[i - 1]; exc += Math.abs(d); if ((wp[i] - 0.5) * (wp[i - 1] - 0.5) < 0) lc++; if (Math.abs(d) > Math.abs(big.d)) big = { d, i }; }
    const winner = g.state === 'post' ? (g.home.winner ? 'home' : g.away.winner ? 'away' : null) : (wp[wp.length - 1] >= 0.5 ? 'home' : 'away');
    const minW = winner ? Math.min(...wp.map(p => winner === 'home' ? p : 1 - p)) : NaN;
    return { exc, lc, big, winner, minW };
  }

  /* ---------- render ---------- */
  BOX.render = function (b, g, st) {
    if (!b) return '';
    const kind = kindOf(g.lg), A = g.away.abbr, H = g.home.abbr;
    const tabs = [['sum', 'Summary']];
    if (b.team && b.team.length) tabs.push(['team', 'Team stats']);
    if (b.players && b.players.away.length) tabs.push(['away', A + ' box']);
    if (b.players && b.players.home.length) tabs.push(['home', H + ' box']);
    if ((b.scoring && b.scoring.length) || (b.drives && b.drives.length) || (b.recent && b.recent.length)) tabs.push(['plays', kind === 'fb' && b.drives && b.drives.length ? 'Drives & plays' : 'Plays']);
    let cur = st && st.boxTab; if (!tabs.some(t => t[0] === cur)) cur = 'sum';
    const nav = `<div class="bx-nav seg" role="tablist" aria-label="Box score sections">${tabs.map(([k, l]) => `<button type="button" role="tab" data-bx="${k}" aria-pressed="${k === cur}">${esc(l)}</button>`).join('')}</div>`;
    let body = '';
    if (cur === 'sum') body = summary(b, g, kind);
    else if (cur === 'team') body = mirror(b.team, g);
    else if (cur === 'away' || cur === 'home') body = players(b.players[cur], cur === 'away' ? g.away : g.home, kind);
    else body = playsHTML(b, g, kind);
    const src = b.src === 'ESPN' ? `ESPN game feed${g.state === 'in' ? ' · refreshes with the board' : ''}` : `Sportradar box score · retrieved with the snapshot`;
    return `<div class="panel panel-pad bx"><div class="sec-h"><h2 style="font-size:17px">${g.state === 'in' ? 'Live box score' : g.state === 'post' ? 'Box score' : 'Game preview'}</h2><span class="aside">${esc(src)}</span></div>${nav}<div class="bx-body">${body}</div></div>`;
  };
  function summary(b, g, kind) {
    const A = g.away.abbr, H = g.home.abbr; let h = '';
    if (b.line) {
      const L = b.line, sumOf = arr => arr.reduce((s, x) => s + (fin(+x) ? +x : 0), 0);
      const rhe = L.rhe ? ['R', 'H', 'E'] : ['T'];
      const tot = side => L.rhe ? L.rhe[side] : [side === 'a' ? (g.away.score ?? sumOf(L.a)) : (g.home.score ?? sumOf(L.h))];
      h += `<div class="tbl-wrap"><table class="tbl sx line"><thead><tr><th class="l">Team</th>${L.labels.map(l => `<th>${esc(l)}</th>`).join('')}${rhe.map(x => `<th class="t">${x}</th>`).join('')}</tr></thead><tbody>${[['a', g.away], ['h', g.home]].map(([s, t]) => `<tr><td class="l"><b>${esc(t.abbr)}</b></td>${L[s].map(v => `<td>${esc(v == null ? '' : v)}</td>`).join('')}${tot(s).map(v => `<td class="t"><b>${esc(v == null ? '' : v)}</b></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    if (b.leaders && b.leaders.length) h += `<div class="bx-lead">${b.leaders.map(l => `<div class="ld"><span class="la">${l.a ? `<b>${esc(l.a.n)}</b><span>${esc(l.a.v)}</span>` : '<span class="muted">—</span>'}</span><span class="lc">${esc(l.lab)}</span><span class="lh">${l.h ? `<b>${esc(l.h.n)}</b><span>${esc(l.h.v)}</span>` : '<span class="muted">—</span>'}</span></div>`).join('')}</div>`;
    if (b.adv && b.adv.length) h += `<div class="bx-sub"><span class="eyebrow">In-game advanced metrics</span><table class="stats-table adv"><thead><tr><th>${esc(A)}</th><th></th><th>${esc(H)}</th></tr></thead><tbody>${b.adv.map(r => `<tr title="${esc(r.tip || '')}"><td>${esc(r.a)}</td><td>${esc(r.lab)}</td><td>${esc(r.h)}</td></tr>`).join('')}</tbody></table></div>`;
    const w = wpStats(b.wp, g);
    if (w) {
      const bigTxt = w.big.i > 0 ? `${(Math.abs(w.big.d) * 100).toFixed(0)} pts toward ${w.big.d > 0 ? H : A}${b.wpText && b.wpText[w.big.i] ? ': ' + b.wpText[w.big.i] : ''}` : '';
      h += `<div class="bx-sub"><span class="eyebrow">Win-probability story</span><div class="kv"><div><span class="k">Excitement index</span><span class="v">${w.exc.toFixed(1)}</span><span class="n">sum of every swing in win probability</span></div><div><span class="k">Lead changes (in win probability)</span><span class="v">${w.lc}</span></div>${w.winner ? `<div><span class="k">${g.state === 'post' ? 'Winner\'s lowest point' : 'Leader\'s lowest point'}</span><span class="v">${(w.minW * 100).toFixed(0)}%</span><span class="n">${esc(g[w.winner].abbr)} win probability at its worst</span></div>` : ''}</div>${bigTxt ? `<p class="note"><b>Biggest single swing:</b> ${esc(bigTxt)}</p>` : ''}</div>`;
    }
    if (b.inj && b.inj.length) h += `<div class="bx-sub"><span class="eyebrow">Injury report</span><div class="sx-two">${b.inj.map(t => `<div><b>${esc(t.team)}</b><ul class="inj">${t.list.slice(0, 8).map(x => `<li>${esc(x.n)} <span class="muted">${esc(x.st)}${x.d ? ' · ' + esc(x.d) : ''}</span></li>`).join('')}</ul></div>`).join('')}</div></div>`;
    if (b.notes && b.notes.length) h += `<p class="note">${b.notes.map(esc).join(' · ')}</p>`;
    return h || '<p class="note">The box score fills in once the game starts.</p>';
  }
  function mirror(rows, g) {
    const out = rows.map(r => {
      const a = numOf(r.a), h = numOf(r.h), ok = fin(a) && fin(h) && a >= 0 && h >= 0 && a + h > 0, pa = ok ? 100 * a / (a + h) : 50;
      return `<div class="mir"><span class="va">${esc(r.a)}</span><span class="lab">${esc(r.lab)}</span><span class="vh">${esc(r.h)}</span><span class="bar" aria-hidden="true">${ok ? `<i class="a" style="width:${pa.toFixed(1)}%"></i><i class="h" style="width:${(100 - pa).toFixed(1)}%"></i>` : ''}</span></div>`;
    }).join('');
    return `<div class="mir-head"><span><i style="background:var(--away)"></i>${esc(g.away.abbr)}</span><span>${esc(g.home.abbr)}<i style="background:var(--home)"></i></span></div><div class="mirs">${out}</div>`;
  }
  function players(groups, team, kind) {
    if (!groups || !groups.length) return '<p class="note">No player stats yet.</p>';
    return groups.map(gr => {
      const act = gr.rows.filter(r => !r.dnp), dnp = gr.rows.filter(r => r.dnp);
      const st = act.filter(r => r.starter), bn = act.filter(r => !r.starter), split = kind === 'bk' && st.length && bn.length;
      const tr = r => `<tr data-lab="${esc(String(r.name).split(' ').slice(-1)[0])}" data-name="${esc(r.name)}"><td class="l"><b>${esc(r.name)}</b>${r.pos ? ` <span class="muted">${esc(r.pos)}</span>` : ''}</td>${r.stats.map(s => `<td>${esc(String(s))}</td>`).join('')}</tr>`;
      const rows = split ? st.map(tr).join('') + `<tr class="grp"><td colspan="${gr.labels.length + 1}">Bench</td></tr>` + bn.map(tr).join('') : act.map(tr).join('');
      return `<div class="bx-grp"><span class="eyebrow">${esc(team.abbr)} · ${esc(gr.name)}</span><div class="vz" data-vz="box" data-vz-on="0" data-vz-dir="0" data-vz-types="bars,dots" data-vz-n="10" data-vz-pref="PTS,YDS,SOG,G,H,K,TOT,SV,R"><div class="tbl-wrap"><table class="tbl sx box"><thead><tr><th class="l">${split ? 'Starters' : 'Player'}</th>${gr.labels.map(l => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${rows}${gr.totals && gr.totals.length && gr.totals.some(x => x !== '' && x != null) ? `<tr class="tot"><td class="l">Team</td>${gr.totals.map(s => `<td>${esc(String(s == null ? '' : s))}</td>`).join('')}</tr>` : ''}</tbody></table></div></div>${dnp.length ? `<p class="note">Did not play: ${dnp.map(r => esc(r.name) + (r.reason ? ` (${esc(r.reason.toLowerCase())})` : '')).join(', ')}</p>` : ''}</div>`;
    }).join('');
  }
  function playsHTML(b, g, kind) {
    let h = '';
    if (b.drives && b.drives.length) h += `<span class="eyebrow">Drives</span><ul class="plays drives">${b.drives.slice().reverse().slice(0, 24).map(d => `<li class="${d.score ? 'sc' : ''}"><span class="t">${esc(d.team)}</span><span><b>${esc(d.res)}</b> <span class="muted">${esc(d.desc)}</span></span><span class="s">${esc(d.t)}</span></li>`).join('')}</ul>`;
    if (b.scoring && b.scoring.length) h += `<span class="eyebrow">Scoring</span><ul class="plays">${b.scoring.slice().reverse().map(p => `<li class="sc"><span class="t">${esc(p.t)}</span><span>${p.team ? `<b>${esc(p.team)}</b> ` : ''}${esc(p.text)}</span><span class="s">${esc(p.s)}</span></li>`).join('')}</ul>`;
    if (b.recent && b.recent.length && !(b.drives && b.drives.length)) h += `<span class="eyebrow">Latest plays</span><ul class="plays">${b.recent.map(p => `<li class="${p.score ? 'sc' : ''}"><span class="t">${esc(p.t)}</span><span>${esc(p.text)}</span><span class="s">${esc(p.s)}</span></li>`).join('')}</ul>`;
    return h || '<p class="note">No plays yet.</p>';
  }

  /* ---------- snapshot boxes (compact arrays → normalized) ---------- */
  BOX.fromSnap = function (id, g) {
    const s = typeof SNAPSHOT !== 'undefined' && SNAPSHOT.stats && SNAPSHOT.stats.box && SNAPSHOT.stats.box[id]; if (!s) return null;
    const grp = x => x ? x.map(q => ({ name: q.n, labels: q.l, rows: q.r.map(r => ({ name: r[0], pos: r[1], starter: !!r[2], dnp: false, stats: r.slice(3) })), totals: q.t || [] })) : [];
    return {
      src: 'Sportradar', line: s.line || null,
      team: (s.team || []).map(r => ({ lab: r[0], a: String(r[1]), h: String(r[2]) })),
      adv: (s.adv || []).map(r => ({ lab: r[0], a: String(r[1]), h: String(r[2]), tip: r[3] || '' })),
      players: { away: grp(s.pa), home: grp(s.ph) },
      leaders: (s.lead || []).map(r => ({ lab: r[0], a: r[1] ? { n: r[1], v: r[2] } : null, h: r[3] ? { n: r[3], v: r[4] } : null })),
      scoring: (s.scoring || []).map(r => ({ t: r[0], text: r[1], s: r[2] || '', team: r[3] || '' })),
      drives: [], recent: [], inj: [], notes: s.notes || [], wp: null
    };
  };
})();
