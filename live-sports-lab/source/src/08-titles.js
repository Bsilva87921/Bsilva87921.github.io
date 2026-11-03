/* ==========================================================================
   Probable — championships and finals for every team league.
   SNAPSHOT.titles holds verified winner / runner-up histories (see data/make_extra.py).
   Franchises are matched by abbreviation (US leagues, following relocations) or by
   club / school name (soccer, college football).
   ========================================================================== */
(function () {
  'use strict';
  const APP = window.APP, C = APP.charts, { esc, badge } = APP;
  const T = (typeof SNAPSHOT !== 'undefined' && SNAPSHOT.titles) || {};
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  const DEF = {
    nfl: { trophy: 'Super Bowl', plural: 'Super Bowls', col: 'Super Bowls', finals: 'Super Bowl', abbr: true, pre: 'NFL titles before the Super Bowl (1920–65)', preCol: 'All NFL titles', src: 'Super Bowl I–LX; NFL championship games 1920–1965' },
    nba: { trophy: 'NBA title', plural: 'NBA titles', col: 'Titles', finals: 'NBA Finals', abbr: true, src: 'BAA/NBA Finals since 1947' },
    mlb: { trophy: 'World Series', plural: 'World Series titles', col: 'WS titles', finals: 'World Series', abbr: true, src: 'World Series since 1903' },
    nhl: { trophy: 'Stanley Cup', plural: 'Stanley Cups', col: 'Cups', finals: 'Stanley Cup Final', abbr: true, pre: 'pre-NHL Cup (1916)', src: 'Stanley Cup Finals of the NHL era (1918–), plus the Canadiens’ 1916 Cup' },
    wnba: { trophy: 'WNBA title', plural: 'WNBA titles', col: 'Titles', finals: 'WNBA Finals', abbr: true, src: 'WNBA Finals since 1997' },
    ncaaf: { trophy: 'national title', plural: 'national titles', col: 'Natl titles', finals: 'title game', school: true, src: 'AP poll champions since 1936, coaches’ poll, BCS and CFP champions (a split season counts for both schools)' },
    ucl: { trophy: 'European Cup', plural: 'European Cups', col: 'European Cups', finals: 'final', shift: -1, src: 'European Cup / Champions League finals since 1956' },
    mls: { trophy: 'MLS Cup', plural: 'MLS Cups', col: 'MLS Cups', finals: 'MLS Cup final', src: 'MLS Cup finals since 1996' },
    epl: { trophy: 'league title', plural: 'English league titles', col: 'Titles', era: 1992, eraCol: 'PL titles', src: 'English top flight since 1888–89 (Premier League since 1992–93)' },
    laliga: { trophy: 'league title', plural: 'Spanish league titles', col: 'Titles', src: 'Spanish top flight since 1929' },
    seriea: { trophy: 'Scudetto', plural: 'Italian league titles', col: 'Titles', src: 'Italian champions since 1898 (Juventus 2005 and 2006 revoked titles excluded)' },
    bund: { trophy: 'German title', plural: 'German titles', col: 'Titles', era: 1963, eraCol: 'Bundesliga', src: 'German champions since 1903 (Bundesliga since 1963–64)' },
    ligue1: { trophy: 'league title', plural: 'French league titles', col: 'Titles', src: 'French top flight since 1932–33' }
  };
  const START = { epl: 1, laliga: 1, seriea: 1, bund: 1, ligue1: 1, ucl: 1 }, END = { nba: 1, nhl: 1 };
  function seasonLab(lg, y, single) {
    if (single || (lg === 'bund' && y < 1963) || (lg === 'seriea' && y < 1909)) return String(y);
    if (END[lg]) return (y - 1) + '–' + String(y).slice(-2);
    if (START[lg]) return y + '–' + String(y + 1).slice(-2);
    return String(y);
  }

  // live ESPN abbreviations → the keys used in the history files
  const AL = { nfl: { JAX: 'JAC', LAR: 'LA', WSH: 'WAS', OAK: 'LV', SD: 'LAC', STL: 'LA' }, mlb: { ARI: 'AZ', CHW: 'CWS', OAK: 'ATH' }, nhl: { UTAH: 'UTA' }, nba: {}, wnba: { GS: 'GSV', LV: 'LVA', LA: 'LAS', NY: 'NYL', WSH: 'WAS', POR: 'PDX', CONN: 'CON' } };
  const canonAbbr = (lg, a) => { const u = String(a || '').toUpperCase(); return (AL[lg] && AL[lg][u]) || u; };
  // club names: fold accents, drop legal-form words, alias the names that differ between sources
  const STOP = new Set(['fc', 'cf', 'afc', 'sc', 'ac', 'as', 'ssc', 'ss', 'club', 'de', 'del', 'calcio', 'the', 'cp', 'sl', 'bc', 'sv', 'vfl', 'vfb', 'tsg', 'tsv', 'rc', 'rcd', 'ud', 'cd', 'sd', 'fk', 'sk', 'osc', 'losc', 'ogc', 'stade', 'olympique', 'hotspur', 'football', 'futbol', 'balompie', 'rsc', 'kv', '04', '05', '1', '1846', '1848', '1899', '1900', '1904', '1907', '1909', '1913', '29']);
  const ALIAS = {
    'inter milan': 'inter', 'internazionale': 'inter', 'inter': 'inter', 'fc internazionale milano': 'inter', 'ac milan': 'milan', 'milan': 'milan',
    'bayern munich': 'bayern', 'fc bayern munchen': 'bayern', 'bayern munchen': 'bayern', 'bayern': 'bayern',
    'paris saint-germain': 'psg', 'paris sg': 'psg', 'psg': 'psg', 'athletic club': 'athletic', 'athletic bilbao': 'athletic',
    'atletico madrid': 'atletico', 'atletico de madrid': 'atletico', 'real betis': 'betis', 'real betis seville': 'betis',
    'deportivo la coruna': 'deportivo', 'rc deportivo de a coruna': 'deportivo', 'deportivo': 'deportivo', 'olympique lyonnais': 'lyon', 'lyon': 'lyon',
    'stade rennais': 'rennes', 'rennes': 'rennes', 'lille osc': 'lille', 'losc lille': 'lille', 'lille': 'lille', 'olympique lillois': 'olympiquelillois',
    'as saint-etienne': 'saintetienne', 'saint-etienne': 'saintetienne', 'girondins de bordeaux': 'bordeaux', 'bordeaux': 'bordeaux',
    'as monaco': 'monaco', 'monaco': 'monaco', 'ogc nice': 'nice', 'nice': 'nice', 'rc strasbourg alsace': 'strasbourg', 'strasbourg': 'strasbourg',
    'borussia monchengladbach': 'gladbach', "borussia m'gladbach": 'gladbach', 'monchengladbach': 'gladbach', 'borussia dortmund': 'dortmund', 'dortmund': 'dortmund',
    '1. fc koln': 'koln', 'fc cologne': 'koln', 'koln': 'koln', 'cologne': 'koln', 'hamburger sv': 'hamburg', 'hamburg sv': 'hamburg', 'hamburg': 'hamburg',
    'werder bremen': 'bremen', 'sv werder bremen': 'bremen', 'schalke 04': 'schalke', 'fc schalke 04': 'schalke', 'bayer leverkusen': 'leverkusen', 'bayer 04 leverkusen': 'leverkusen',
    'hellas verona': 'verona', 'verona': 'verona', 'ss lazio': 'lazio', 'as roma': 'roma', 'ssc napoli': 'napoli', 'acf fiorentina': 'fiorentina',
    'manchester united': 'manutd', 'man united': 'manutd', 'manchester city': 'mancity', 'man city': 'mancity', 'tottenham hotspur': 'tottenham',
    'wolverhampton wanderers': 'wolves', 'wolves': 'wolves', "nott'm forest": 'nottinghamforest', 'brighton & hove albion': 'brighton', 'brighton and hove albion': 'brighton',
    'steaua bucuresti': 'steaua', 'steaua bucharest': 'steaua', 'fcsb': 'steaua', 'red star belgrade': 'redstar', 'crvena zvezda': 'redstar', 'fk crvena zvezda': 'redstar',
    'psv eindhoven': 'psv', 'psv': 'psv', 'feyenoord rotterdam': 'feyenoord', 'sl benfica': 'benfica', 'fc porto': 'porto', 'afc ajax': 'ajax',
    'los angeles fc': 'lafc', 'lafc': 'lafc', 'new york red bulls': 'nyrb', 'red bull new york': 'nyrb', 'la galaxy': 'lagalaxy', 'los angeles galaxy': 'lagalaxy',
    'kansas city wizards': 'sportingkansascity', 'd.c. united': 'dcunited', 'dc united': 'dcunited', 'seattle sounders fc': 'seattle', 'seattle sounders': 'seattle',
    'houston dynamo fc': 'houston', 'houston dynamo': 'houston', 'chicago fire fc': 'chicagofire', 'chicago fire': 'chicagofire', 'columbus crew sc': 'columbuscrew'
  };
  function clubKey(name) {
    const f = fold(name);
    if (ALIAS[f]) return ALIAS[f];
    return f.replace(/&/g, ' and ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).join('');
  }
  // college: the title-winning schools, as ESPN (live) and the snapshot (school names) spell them
  const SCHOOL = {
    'Alabama': ['alabama', 'alabama crimson tide'], 'Notre Dame': ['notre dame', 'notre dame fighting irish'], 'USC': ['usc', 'usc trojans', 'southern california'],
    'Ohio State': ['ohio state', 'ohio state buckeyes'], 'Oklahoma': ['oklahoma', 'oklahoma sooners'], 'Nebraska': ['nebraska', 'nebraska cornhuskers'],
    'Miami (FL)': ['miami (fl)', 'miami hurricanes', 'miami'], 'Minnesota': ['minnesota', 'minnesota golden gophers'], 'LSU': ['lsu', 'lsu tigers'],
    'Texas': ['texas', 'texas longhorns'], 'Michigan': ['michigan', 'michigan wolverines'], 'Georgia': ['georgia', 'georgia bulldogs'], 'Clemson': ['clemson', 'clemson tigers'],
    'Florida State': ['florida state', 'florida state seminoles'], 'Florida': ['florida', 'florida gators'], 'Pittsburgh': ['pittsburgh', 'pitt', 'pittsburgh panthers'],
    'Army': ['army', 'army black knights'], 'Tennessee': ['tennessee', 'tennessee volunteers'], 'Michigan State': ['michigan state', 'michigan state spartans'],
    'Auburn': ['auburn', 'auburn tigers'], 'Penn State': ['penn state', 'penn state nittany lions'], 'Texas Christian': ['tcu', 'tcu horned frogs', 'texas christian'],
    'Texas A&M': ['texas a&m', 'texas a&m aggies'], 'Maryland': ['maryland', 'maryland terrapins'], 'UCLA': ['ucla', 'ucla bruins'], 'Syracuse': ['syracuse', 'syracuse orange'],
    'BYU': ['byu', 'byu cougars', 'brigham young'], 'Colorado': ['colorado', 'colorado buffaloes'], 'Georgia Tech': ['georgia tech', 'georgia tech yellow jackets'],
    'Washington': ['washington', 'washington huskies'], 'Indiana': ['indiana', 'indiana hoosiers'], 'Ole Miss': ['ole miss', 'ole miss rebels', 'mississippi'], 'Oregon': ['oregon', 'oregon ducks']
  };
  const SCHOOL_IDX = {}; for (const [s, arr] of Object.entries(SCHOOL)) for (const a of arr) SCHOOL_IDX[a] = s;
  const schoolOf = name => { const f = fold(name); return SCHOOL_IDX[f] ? fold(SCHOOL_IDX[f]) : f; };

  // ---------- normalize every league to [{y, w, wk, r, rk, sc, note, single, pre}] ----------
  const CACHE = {};
  function build(lg) {
    if (CACHE[lg]) return CACHE[lg];
    const d = T[lg], def = DEF[lg]; if (!d || !def) return null;
    const keyOf = (name, abbr) => def.abbr ? (abbr ? canonAbbr(lg, abbr) : 'n:' + fold(name)) : def.school ? schoolOf(name) : clubKey(name);
    const rows = [];
    const seen = {};
    const push = (o) => { rows.push(o); };
    if (def.abbr) {
      for (const r of d.rows) push({ y: r[0], w: r[1], wk: keyOf(r[1], r[2]), r: r[3], rk: r[3] ? keyOf(r[3], r[4]) : null, sc: r[5] || '', note: lg === 'nfl' && r[6] ? 'Super Bowl ' + r[6] : '' });
      for (const r of d.pre || []) push({ y: r[0], w: r[1], wk: keyOf(r[1], r[2]), r: r[3] || '', rk: r[3] ? keyOf(r[3], r[4]) : null, sc: '', note: lg === 'nfl' ? 'NFL championship' : 'pre-NHL', pre: true });
    } else if (lg === 'ncaaf') {
      for (const r of d.rows) { const vac = /vacated/i.test(r[2]); push({ y: r[0], w: r[1], wk: keyOf(r[1]), r: r[3] || '', rk: r[3] ? keyOf(r[3]) : null, sc: r[4] || '', note: r[2], vac }); }
    } else if (lg === 'ucl') {
      for (const r of d.rows) push({ y: r[0] + def.shift, w: r[1], wk: keyOf(r[1]), r: r[2], rk: keyOf(r[2]), sc: r[3] || '', note: r[4] ? 'Final in ' + r[4] : '' });
    } else if (lg === 'mls') {
      for (const r of d.rows) push({ y: r[0], w: r[1], wk: keyOf(r[1]), r: r[2], rk: keyOf(r[2]), sc: r[3] || '' });
    } else {
      for (const r of d.rows) { const k = r[0], single = (lg === 'seriea' && k < 1909) || !!seen[k]; seen[k] = 1; push({ y: k, w: r[1], wk: keyOf(r[1]), r: r[2] || '', rk: r[2] ? keyOf(r[2]) : null, sc: '', note: r[3] || '', single: false, dup: single }); }
      // the first of two seasons that share a start year (Italy 1909, Spain 1929) was a single-year season
      const byY = {}; rows.forEach((o, i) => { (byY[o.y] = byY[o.y] || []).push(i); });
      for (const idx of Object.values(byY)) if (idx.length > 1) rows[idx[0]].single = true;
      if (lg === 'seriea') for (const o of rows) if (o.y < 1909) o.single = true;
      for (const r of d.pre || []) push({ y: r[0], w: r[1], wk: keyOf(r[1]), r: r[2] || '', rk: r[2] ? keyOf(r[2]) : null, sc: '', note: 'before the Bundesliga', pre: true, single: true });
    }
    rows.sort((a, b) => a.y - b.y || (a.single ? -1 : 0));
    // per franchise
    const by = {};
    const rec = (k, name) => (by[k] = by[k] || { key: k, name, won: [], lost: [], pre: [], era: [] });
    for (const o of rows) {
      if (o.vac) continue;
      const a = rec(o.wk, o.w); a.name = o.w;
      (o.pre ? a.pre : a.won).push(o.y);
      if (def.era && !o.pre && o.y >= def.era) a.era.push(o.y);
      if (o.rk) { const b = rec(o.rk, o.r); if (!b.name) b.name = o.r; if (!o.pre) b.lost.push(o.y); }
    }
    // soccer "pre" titles (German championship before the Bundesliga) count as titles
    if (!def.abbr) for (const a of Object.values(by)) if (a.pre.length) { a.won = a.won.concat(a.pre).sort((x, y) => x - y); }
    CACHE[lg] = { rows, by, def };
    return CACHE[lg];
  }

  function teamKey(lg, t) {
    const def = DEF[lg]; if (!def || !t) return null;
    if (def.abbr) return canonAbbr(lg, t.abbr || t.key);
    if (def.school) return schoolOf(t.name);
    return clubKey(t.name);
  }
  // one team's record: {n, won:[], lost:[], pre:[], era:[], last, finals, fw, fl}
  function forTeam(lg, t) {
    const B = build(lg); if (!B) return null;
    const k = teamKey(lg, t), a = B.by[k] || { won: [], lost: [], pre: [], era: [] };
    const won = a.won.slice().sort((x, y) => x - y), lost = a.lost.slice().sort((x, y) => x - y);
    const def = B.def, fw = won.filter(y => B.rows.some(o => o.y === y && o.rk && !o.pre && o.wk === k)).length;
    return { n: won.length, won, lost, pre: a.pre.slice().sort((x, y) => x - y), era: a.era, last: won.length ? won[won.length - 1] : null, finals: (def.abbr || def.finals) ? fw + lost.length : null, fw, fl: lost.length, all: won.length + (def.abbr ? a.pre.length : 0) };
  }
  const has = lg => !!(T[lg] && DEF[lg]);
  const count = (lg, t) => { const r = has(lg) ? forTeam(lg, t) : null; return r ? (DEF[lg].abbr && DEF[lg].pre && lg === 'nhl' ? r.all : r.n) : NaN; };

  // ---------- views ----------
  const yrs = (lg, arr, max) => { const a = arr.slice().reverse(); const s = a.slice(0, max || 99).map(y => `<span class="yr">${esc(seasonLab(lg, y))}</span>`).join(''); return s + (a.length > (max || 99) ? `<span class="muted"> +${a.length - max}</span>` : ''); };
  // team card block
  function cardHTML(lg, t, curY) {
    if (!has(lg)) return '';
    const def = DEF[lg], r = forTeam(lg, t); if (!r) return '';
    const B = build(lg), latest = B.rows.filter(o => !o.pre).slice(-1)[0];
    const drought = r.last != null && latest ? latest.y - r.last : null;
    const tiles = [`<div class="panel tile"><span class="eyebrow">${esc(def.plural)}</span><span class="val">${lg === 'nhl' ? r.all : r.n}</span><span class="sub">${r.n ? `last: ${esc(seasonLab(lg, r.last))}${drought ? ` · ${drought} season${drought === 1 ? '' : 's'} ago` : ' · reigning champion'}` : 'never won'}</span></div>`];
    if (r.finals != null) tiles.push(`<div class="panel tile"><span class="eyebrow">${esc(def.finals)} record</span><span class="val">${r.fw}-${r.fl}</span><span class="sub">${r.finals} appearance${r.finals === 1 ? '' : 's'}${r.finals ? ' · ' + Math.round(100 * r.fw / r.finals) + '% won' : ''}</span></div>`);
    else if (r.lost.length || !def.finals) tiles.push(`<div class="panel tile"><span class="eyebrow">Runner-up finishes</span><span class="val">${r.lost.length}</span><span class="sub">${r.lost.length ? 'last: ' + esc(seasonLab(lg, r.lost[r.lost.length - 1])) : '—'}</span></div>`);
    if (def.pre && lg === 'nfl') tiles.push(`<div class="panel tile"><span class="eyebrow">All NFL titles</span><span class="val">${r.n + r.pre.length}</span><span class="sub">${r.pre.length} before the Super Bowl</span></div>`);
    if (def.era) tiles.push(`<div class="panel tile"><span class="eyebrow">${esc(def.eraCol)} era</span><span class="val">${r.era.length}</span><span class="sub">since ${esc(seasonLab(lg, def.era))}</span></div>`);
    return `<div class="panel panel-pad titles-card"><div class="sec-h"><h2 style="font-size:17px">Championships &amp; finals</h2><span class="aside">${esc(def.src)}</span></div><div class="tiles sx-tiles">${tiles.join('')}</div>
      ${r.n ? `<div class="yrs"><span class="eyebrow">Title seasons</span>${yrs(lg, r.won.concat(lg === 'nhl' ? r.pre : []).sort((a, b) => a - b))}</div>` : ''}${r.lost.length ? `<div class="yrs"><span class="eyebrow">${def.finals ? 'Lost ' + esc(def.finals) : 'Runner-up'}</span>${yrs(lg, r.lost)}</div>` : ''}${def.pre && lg === 'nfl' && r.pre.length ? `<div class="yrs"><span class="eyebrow">NFL titles before the Super Bowl</span>${yrs(lg, r.pre)}</div>` : ''}</div>`;
  }

  // League panel for the History view. teams: current teams [{key, abbr, name, color}], berths: {teamKey → count}, span label
  function panelHTML(lg, o) {
    if (!has(lg)) return '';
    o = o || {};
    const B = build(lg), def = B.def, cur = (o.teams || []);
    const curKeys = new Map(cur.map(t => [teamKey(lg, t), t]));
    // all franchises with a title or final, plus every current team
    const keys = new Set(Object.keys(B.by)); for (const k of curKeys.keys()) keys.add(k);
    const since = 2000;
    const list = [...keys].map(k => {
      const t = curKeys.get(k), a = B.by[k] || { won: [], lost: [], pre: [], era: [], name: '' };
      const won = a.won.slice().sort((x, y) => x - y), lost = a.lost.slice().sort((x, y) => x - y);
      const fw = won.filter(y => B.rows.some(r => r.y === y && r.rk && !r.pre && r.wk === k)).length;
      const nm = t ? t.name : (def.abbr ? (APP.TEAMS && APP.TEAMS[lg] && APP.TEAMS[lg][k] && APP.TEAMS[lg][k].name) || a.name : a.name);
      return { k, t, name: nm || k, abbr: t ? t.abbr : (def.abbr && !String(k).startsWith('n:') ? k : ''), color: t ? t.color : null, cur: !!t, won, lost, pre: a.pre, era: a.era, fw, n: won.length + (lg === 'nhl' ? a.pre.length : 0), last: won.length ? won[won.length - 1] : null, s2k: won.filter(y => y >= since).length, berths: o.berths ? o.berths[t ? t.key : ''] : null };
    }).filter(x => x.n || x.lost.length || x.cur || x.pre.length);
    list.sort((a, b) => b.n - a.n || (b.fw + b.lost.length) - (a.fw + a.lost.length) || (b.last || 0) - (a.last || 0) || a.name.localeCompare(b.name));
    const main = B.rows.filter(r => !r.pre), latest = main[main.length - 1];
    const champs = new Set(main.filter(r => r.y > latest.y - 25).map(r => r.wk)).size;
    const top = list[0];
    const cur0 = list.filter(x => x.cur && x.n);
    const longest = cur0.slice().sort((a, b) => (a.last || 0) - (b.last || 0))[0];
    const never = list.filter(x => x.cur && !x.n).length;
    const lab = y => seasonLab(lg, y);
    const tiles = `<div class="tiles sx-tiles">
      <div class="panel tile"><span class="eyebrow">Reigning champion</span><span class="val val-sm">${esc(latest.w)}</span><span class="sub">${esc(lab(latest.y))}${latest.r ? ` · beat ${esc(latest.r)}${latest.sc ? ' ' + esc(latest.sc) : ''}` : ''}</span></div>
      <div class="panel tile"><span class="eyebrow">Most ${esc(def.plural)}</span><span class="val val-sm">${esc(top.name)}</span><span class="sub">${top.n} · last ${top.last ? esc(lab(top.last)) : '—'}</span></div>
      <div class="panel tile"><span class="eyebrow">Different champions</span><span class="val">${champs}<small>in 25 seasons</small></span><span class="sub">${never ? `${never} current ${never === 1 ? 'team has' : 'teams have'} never won` : 'every current team has won'}</span></div>
      ${longest ? `<div class="panel tile"><span class="eyebrow">Longest wait (past winners)</span><span class="val val-sm">${esc(longest.name)}</span><span class="sub">last title ${esc(lab(longest.last))} · ${latest.y - longest.last} seasons</span></div>` : ''}</div>`;
    const showBerth = list.some(x => x.berths != null);
    const hasFinals = !!def.finals || lg === 'ncaaf';
    const head = `<tr><th>#</th><th class="l">Team</th><th title="${esc(def.src)}">${esc(def.col)}</th>${hasFinals ? `<th title="${esc(def.finals)} appearances">Finals</th><th data-vz-skip title="${esc(def.finals)} record">Finals W-L</th><th title="Share of finals won">Finals win %</th>` : `<th title="Runner-up finishes">Runner-up</th>`}<th title="Titles won since the 2000 season">Since 2000</th>${def.era ? `<th>${esc(def.eraCol)}</th>` : ''}${lg === 'nfl' ? `<th title="Super Bowls plus NFL championships 1920–1965">All NFL</th>` : ''}<th data-vz-skip>Last title</th>${showBerth ? `<th title="Postseason berths flagged in the loaded standings (${esc(o.span || '')})">Playoff berths</th>` : ''}</tr>`;
    const body = list.map((x, i) => {
      const fin = x.fw + x.lost.length;
      return `<tr data-lab="${esc(x.abbr || x.name.split(' ').slice(-1)[0])}" data-name="${esc(x.name)}"${x.t ? ` data-sx-team="${esc(x.t.key)}"` : ''} class="${x.cur ? '' : 'ghost'}${o.sel && x.t && x.t.key === o.sel ? ' sel' : ''}"><td class="rk">${i + 1}</td><td class="l"><span class="team">${x.abbr || x.color ? badge(lg, { abbr: x.abbr || x.name.slice(0, 3).toUpperCase(), color: x.color }) : ''}<span>${esc(x.name)}</span>${x.cur ? '' : '<span class="muted small"> · not in league now</span>'}</span></td><td><b>${x.n}</b></td>${hasFinals ? `<td>${fin}</td><td>${x.fw}-${x.lost.length}</td><td>${fin ? (100 * x.fw / fin).toFixed(0) + '%' : '—'}</td>` : `<td>${x.lost.length}</td>`}<td>${x.s2k}</td>${def.era ? `<td>${x.era.length}</td>` : ''}${lg === 'nfl' ? `<td>${x.n + x.pre.length}</td>` : ''}<td>${x.last ? esc(lab(x.last)) : '—'}</td>${showBerth ? `<td>${x.berths == null ? '—' : x.berths}</td>` : ''}</tr>`;
    }).join('');
    const tl = list.filter(x => x.n).slice(0, 12).map(x => ({ lab: x.abbr || x.name, name: x.name, years: x.won.concat(lg === 'nhl' ? x.pre : []), lost: x.lost, key: x.t ? x.t.key : null, sel: o.sel && x.t && x.t.key === o.sel }));
    const plotted = tl.flatMap(x => x.years.concat(x.lost)), y0 = plotted.length ? Math.min(...plotted) : latest.y - 1, y1 = latest.y;
    const champRows = B.rows.slice().reverse().map(r => `<tr${r.pre ? ' class="ghost"' : ''}><td class="l">${esc(seasonLab(lg, r.y, r.single))}</td><td class="l"><b>${esc(r.w)}</b>${r.vac ? ' <span class="muted small">(vacated)</span>' : ''}</td><td class="l">${esc(r.r || '—')}</td><td class="l">${esc(r.sc || '')}${r.note ? ` <span class="muted small">${esc(r.note)}</span>` : ''}</td></tr>`).join('');
    return `<div class="sec-h"><h2>Championships &amp; postseason</h2><span class="aside">${esc(def.src)}</span></div>${tiles}
      <div class="panel"><div class="ptool"><b>${esc(def.plural[0].toUpperCase() + def.plural.slice(1))} by franchise</b><span class="note">${hasFinals ? 'Finals = appearances in the ' + esc(def.finals) : 'Runner-up = second place in the final table'}${showBerth ? ' · playoff berths counted from the loaded standings' : ''} · grey = not in the league this season</span></div>
        <div class="vz" data-vz="titles-${lg}" data-vz-attr="data-sx-team" data-vz-n="15" data-vz-def="${esc(def.col)}"><div class="tbl-wrap mini tall"><table class="tbl sx"><caption class="sr">${esc(def.plural)} by team</caption><thead>${head}</thead><tbody>${body}</tbody></table></div></div></div>
      <div class="sx-two"><div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Title timeline</h2><span class="aside">● title · ○ lost final · the ${tl.length} most decorated</span></div>${C.timeline(tl, { y0, y1, attr: 'data-sx-team', winLab: def.trophy, lostLab: def.finals ? 'lost ' + def.finals : 'runner-up', yFmt: y => lab(y), aria: 'Titles by season for the most decorated teams' })}</div>
        <div class="panel panel-pad"><div class="sec-h"><h2 style="font-size:18px">Champions by season</h2><span class="aside">${B.rows.length} seasons · newest first</span></div><div class="tbl-wrap mini tall"><table class="tbl sx champs"><thead><tr><th class="l">Season</th><th class="l">Champion</th><th class="l">Runner-up</th><th class="l">Result</th></tr></thead><tbody>${champRows}</tbody></table></div></div></div>`;
  }

  APP.titles = { has, def: lg => DEF[lg], forTeam, count, cardHTML, panelHTML, seasonLab, teamKey, clubKey, build };
})();
