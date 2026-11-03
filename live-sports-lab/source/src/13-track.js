/* ==========================================================================
   Probable — Track record: how often the lab's numbers have been right.
   Data: data/track.json from the hourly pipeline (season replay without
   look-ahead, in-game checkpoints, and a prospective log of the live board
   against the betting line). Shown at the top of How it works, in the
   Insights bar and to Ask AI.
   ========================================================================== */
(function () {
  'use strict';
  const APP = window.APP, S = APP.S, LG = APP.LG, esc = APP.esc;
  let T = window.SPORTS_TRACK || null, tried = false;
  const pc = (p, d) => isFinite(p) ? (p * 100).toFixed(d || 0) + '%' : '—';
  const lgName = id => LG[id] ? (LG[id].short || LG[id].name) : id;
  const ORDER = ['nfl', 'nba', 'wnba', 'mlb', 'nhl', 'epl', 'laliga', 'seriea', 'bund', 'ligue1', 'mls'];
  async function load() {
    if (T || tried) return; tried = true;
    try { const r = await fetch(window.SPORTS_TRACK_URL || 'data/track.json', { cache: 'no-cache' }); if (r.ok) { T = await r.json(); refresh(); } } catch (e) { /* offline or not built yet */ }
  }
  const all = () => T && T.all;
  function summary() {
    const a = all(); if (!a || a.n < 50) return null;
    // two-way sports read most naturally as "the favorite won X%"; soccer has draws, so it is left out of that number
    const two = Object.entries(T.leagues).filter(([id]) => APP.kindOf(id) !== 'sc');
    const n2 = two.reduce((s, [, x]) => s + x.n, 0), hit = two.reduce((s, [, x]) => s + x.acc * x.n, 0);
    if (n2 >= 50) return { text: `Track record: replayed without hindsight, the lab's favorite won ${pc(hit / n2)} of ${n2.toLocaleString()} games outside soccer this season — and its odds beat "home edge only" by ${Math.round(a.skill * 100)}% across ${a.n.toLocaleString()} games`, val: pc(hit / n2) };
    return { text: `Track record: replayed without hindsight across ${a.n.toLocaleString()} games, the lab's odds beat "home edge only" by`, val: Math.round(a.skill * 100) + '%' };
  }
  function facts(lg) {
    if (!T) return { unavailable: 'The track record has not been computed yet.' };
    const pick = x => x && { games: x.n, favoriteWon: x.acc, brier: x.brier, homeEdgeOnlyBrier: x.base, skillVsHomeEdge: x.skill, calibration: (x.bins || []).map(b => ({ predicted: b[3], actual: b[4], games: b[2] })), inGame: x.ingame, season: x.season };
    const o = { asOf: T.asOf, method: T.method };
    if (lg && T.leagues[lg]) Object.assign(o, { league: lgName(lg) }, pick(T.leagues[lg]));
    else { o.overall = pick(T.all); o.byLeague = Object.fromEntries(Object.entries(T.leagues).map(([k, v]) => [lgName(k), { games: v.n, favoriteWon: v.acc, brier: v.brier, skill: v.skill }])); }
    if (T.live && T.live.all) o.liveBoardVsLine = { since: T.live.since, games: T.live.all.n, board: T.live.all.model, line: T.live.all.line };
    return o;
  }
  function answer(q, lg) {
    if (!T || !T.all) return { md: 'The track record is still being computed: an hourly job replays every completed game this season with the lab\'s own model, using only results known before each game. Check *How it works* soon.', btn: [['Open How it works', 'method']] };
    const x = lg && T.leagues[lg] ? T.leagues[lg] : T.all, name = lg && T.leagues[lg] ? lgName(lg) : 'all leagues';
    const b = (x.bins || []).filter(z => z[2] >= 20).map(z => `- Picked at ${pc(z[0])}–${pc(Math.min(1, z[1]))}: won ${pc(z[4])} (${z[2]} games, predicted ${pc(z[3])})`).join('\n');
    let md = `**Track record, ${name}${x.season ? ' (' + x.season + ')' : ''}:** the lab's favorite won **${pc(x.acc)}** of ${x.n.toLocaleString()} games. Its Brier score is ${x.brier.toFixed(3)} against ${x.base.toFixed(3)} for "home edge only" (lower is better), a skill of ${Math.round(x.skill * 100)}%.\n\n${b ? 'Calibration — when the lab said…\n' + b : ''}`;
    if (x.ingame && x.ingame.length) md += `\n\nIn-game: ${x.ingame.map(s => `${s.stage} ${pc(s.acc)} right`).join(' · ')}.`;
    if (T.live && T.live.all && T.live.all.n >= 10) { const L = T.live.all; md += `\n\nSince ${new Date(T.live.since).toLocaleDateString()}, the live board's pregame numbers (ratings blended with the line) picked ${pc(L.model.acc)} of ${L.n} games${L.line ? `; the betting line picked ${pc(L.line.acc)} of ${L.line.n}` : ''}.`; }
    md += '\n\nThis is a replay with the rating model alone; the live board also leans on betting lines early in a season.';
    return { md, btn: [['See the full track record', 'method']] };
  }
  function open() { APP.setTab('method'); setTimeout(() => { const el = document.getElementById('track'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80); }

  /* ---------------- section ---------------- */
  function calib(x) {
    const bins = (x.bins || []).filter(b => b[2] >= 5); if (!bins.length) return '';
    const W = 420, H = 260, m = { l: 44, r: 14, t: 14, b: 38 }, X = p => m.l + (p - 0.3) / 0.7 * (W - m.l - m.r), Y = p => H - m.b - (p - 0.3) / 0.7 * (H - m.t - m.b);
    const rMax = Math.max(...bins.map(b => b[2]));
    const ticks = [0.4, 0.6, 0.8, 1].map(v => `<line x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${H - m.b}" class="tr-grid"/><text x="${X(v)}" y="${H - m.b + 16}" class="tr-ax" text-anchor="middle">${pc(v)}</text><line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" class="tr-grid"/><text x="${m.l - 6}" y="${Y(v) + 4}" class="tr-ax" text-anchor="end">${pc(v)}</text>`).join('');
    const dots = bins.map(b => `<circle cx="${X(b[3]).toFixed(1)}" cy="${Y(b[4]).toFixed(1)}" r="${(4 + 10 * Math.sqrt(b[2] / rMax)).toFixed(1)}" class="tr-dot"><title>Predicted ${pc(b[3], 1)} · won ${pc(b[4], 1)} · ${b[2]} games</title></circle>`).join('');
    return `<figure class="tr-fig"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Calibration: predicted chance of the favorite against how often it won">${ticks}<line x1="${X(0.3)}" y1="${Y(0.3)}" x2="${X(1)}" y2="${Y(1)}" class="tr-diag"/>${dots}<text x="${(m.l + W - m.r) / 2}" y="${H - 6}" class="tr-ax" text-anchor="middle">Chance the lab gave its favorite</text></svg><figcaption>Dots on the line mean the probabilities meant what they said: favorites given 70% won about 70% of the time. Dot size = games.</figcaption></figure>`;
  }
  function section() {
    if (!T || !T.all) return `<section class="panel track" id="track"><div class="sec-h"><h2>Track record</h2></div><p class="muted">${tried ? 'The track record is being computed by an hourly job that replays every completed game this season with the lab\'s own model, using only results known before each game.' : 'Loading the track record…'}</p></section>`;
    const a = T.all, ids = ORDER.filter(id => T.leagues[id]);
    const season = x => String(x.season || '').replace(/^(\d{4}(?:-\d{2})?).*$/, '$1');
    const two = ids.filter(id => APP.kindOf(id) !== 'sc'), n2 = two.reduce((s, id) => s + T.leagues[id].n, 0), acc2 = n2 ? two.reduce((s, id) => s + T.leagues[id].acc * T.leagues[id].n, 0) / n2 : a.acc;
    const rows = ids.map(id => { const x = T.leagues[id]; return `<tr><th scope="row">${esc(lgName(id))} <span class="muted">${esc(season(x))}</span></th><td class="num">${x.n.toLocaleString()}</td><td class="num">${pc(x.acc)}${APP.kindOf(id) === 'sc' ? '<sup>*</sup>' : ''}</td><td class="num">${x.brier.toFixed(3)}</td><td class="num">${x.base.toFixed(3)}</td><td class="num ${x.skill > 0 ? 'good' : 'bad'}">${x.skill > 0 ? '+' : ''}${Math.round(x.skill * 100)}%</td></tr>`; }).join('');
    const ig = ids.flatMap(id => (T.leagues[id].ingame || []).map(s => `<tr><th scope="row">${esc(lgName(id))}</th><td>${esc(s.stage)}</td><td class="num">${s.n.toLocaleString()}</td><td class="num">${pc(s.acc)}</td><td class="num">${s.brier.toFixed(3)}</td><td class="num">${s.leaderBrier.toFixed(3)}</td></tr>`)).join('');
    const L = T.live && T.live.all;
    const live = L && L.n ? `<div class="track-live"><span class="eyebrow">Live board vs the betting line · since ${esc(new Date(T.live.since).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }))}</span><div class="tk-row"><div class="tk"><b>${L.n}</b><span>games logged before start and graded</span></div><div class="tk"><b>${pc(L.model.acc)}</b><span>board favorite won · Brier ${L.model.brier.toFixed(3)}</span></div>${L.line ? `<div class="tk"><b>${pc(L.line.acc)}</b><span>betting-line favorite won · Brier ${L.line.brier.toFixed(3)} (${L.line.n} games)</span></div>` : ''}</div></div>` : `<p class="muted small">From now on every game is also logged an hour or so before it starts — the live board's number and the betting line — and graded once it ends, so the record will soon compare the board with the market.</p>`;
    return `<section class="panel track" id="track">
      <div class="sec-h"><h2>Track record</h2><span class="aside">Updated ${esc(new Date(T.asOf).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</span></div>
      <p class="track-lede">Every completed game this season, predicted again with the lab's own rating model using only results known before it started — no hindsight. Brier score measures probability error (0 is perfect; lower is better); skill compares it with knowing only the home edge.</p>
      <div class="tk-row"><div class="tk"><b>${a.n.toLocaleString()}</b><span>games graded</span></div><div class="tk"><b>${pc(acc2)}</b><span>the lab's favorite won (${n2.toLocaleString()} games outside soccer)</span></div><div class="tk"><b>${a.brier.toFixed(3)}</b><span>Brier score (home edge only: ${a.base.toFixed(3)})</span></div><div class="tk"><b class="${a.skill > 0 ? 'good' : 'bad'}">${a.skill > 0 ? '+' : ''}${Math.round(a.skill * 100)}%</b><span>skill vs home edge</span></div></div>
      <div class="track-grid">${calib(a)}<div class="tbl-wrap"><table class="tbl track-tbl"><thead><tr><th>League</th><th>Games</th><th>Favorite won</th><th>Brier</th><th>Home edge</th><th>Skill</th></tr></thead><tbody>${rows}</tbody></table><p class="muted small">* Soccer has three outcomes, so its favorite wins less often; Brier there covers win, draw and loss.</p></div></div>
      ${ig ? `<details class="track-more"><summary>In-game checkpoints (${ids.length} leagues)</summary><p class="muted small">The live models re-run from the score at the end of each period, against simply backing the team that leads.</p><div class="tbl-wrap"><table class="tbl track-tbl"><thead><tr><th>League</th><th>Moment</th><th>Games</th><th>Right</th><th>Brier</th><th>"Leader wins"</th></tr></thead><tbody>${ig}</tbody></table></div></details>` : ''}
      ${live}
      <p class="muted small">Limits: the replay uses the rating model alone (the live board also blends in betting lines early in a season), college football and the Champions League are left out because their ratings come from polls and domestic leagues, and the in-game checkpoints start each period without possession or field position.</p>
    </section>`;
  }
  function refresh(kind, tab) {
    if (tab == null) tab = S.tab;
    if (!tried) load();
    if (tab !== 'method') return;
    const v = document.getElementById('view-method'); if (!v) return;
    const old = document.getElementById('track'); const html = section();
    if (old) old.outerHTML = html; else { const anchor = v.querySelector('.sec-h') || v.firstElementChild; if (anchor) anchor.insertAdjacentHTML('afterend', html); else v.insertAdjacentHTML('afterbegin', html); }
  }
  APP.onRender.push(refresh);
  APP.track = { summary, facts, answer, open, load, get data() { return T; } };
})();
