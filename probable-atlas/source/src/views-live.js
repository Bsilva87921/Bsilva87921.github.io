/* Probable Atlas · Economics: shared view helpers + "Live now" tab. */
const V = (() => {
  const { esc, ok, num, pct, sgn } = K;
  const sec = (t, p, right = '') => `<div class="sec-h"><div><h2>${esc(t)}</h2>${p ? `<p>${p}</p>` : ''}</div>${right}</div>`;
  const tile = o => `<div class="tile${o.hero ? ' hero' : ''}"${o.title ? ` title="${esc(o.title)}"` : ''}><span class="lab">${esc(o.lab)}</span><span class="val">${o.val}${o.unit ? `<small>${esc(o.unit)}</small>` : ''}</span>${o.sub ? `<span class="sub">${o.sub}</span>` : ''}${o.spark || ''}</div>`;
  const badge = (lvl, txt) => `<span class="badge st-${lvl}"><i></i>${esc(txt)}</span>`;
  const clink = (iso, label) => `<a href="#${esc(iso)}" data-country="${esc(iso)}">${esc(label || E.name(iso))}</a>`;
  const card = (title, note, body, ctl = '') => `<section class="card"><div class="head"><div><h3>${esc(title)}</h3>${note ? `<div class="note">${note}</div>` : ''}</div>${ctl ? `<div class="ctl">${ctl}</div>` : ''}</div>${body}</section>`;
  const src = h => `<div class="src">${h}</div>`;
  const ICON = { crit: '!', serious: '!', warn: '~', good: '✓', info: 'i' };
  const LVL = { crit: 'Critical', serious: 'Serious', warn: 'Watch', good: 'Healthy', info: 'Note' };
  const alerts = list => list.length ? `<ul class="alerts">${list.map(a => `<li><span class="ico st-${a.lvl}" aria-hidden="true">${ICON[a.lvl]}</span><div><b>${a.title}</b> <span class="badge st-${a.lvl}"><i></i>${LVL[a.lvl]}</span><div class="why">${a.why}</div></div></li>`).join('')}</ul>` : `<div class="empty">No alerts right now.</div>`;
  const upDown = (v, d = 1, unit = '') => `<span class="delta ${K.cls(v)}">${sgn(v, d, unit)}</span>`;
  const deltaBad = (v, d = 1, unit = '', goodDir = 1) => `<span class="delta ${!ok(v) || v === 0 ? 'flat' : (v > 0) === (goodDir > 0) ? 'up' : 'down'}">${sgn(v, d, unit)}</span>`;
  const seg = (name, opts, cur) => `<div class="seg sm" role="group">${opts.map(([v, l]) => `<button type="button" data-${name}="${esc(v)}" aria-pressed="${String(v) === String(cur)}">${esc(l)}</button>`).join('')}</div>`;
  const sel = (name, opts, cur, aria) => `<label class="picker"><span class="sr">${esc(aria)}</span><select class="sel" data-${name} aria-label="${esc(aria)}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  const countrySel = (name, cur, aria = 'Country') => sel(name, E.COUNTRIES.filter(c => c.gdp).map(c => [c.iso, c.name]).sort((a, b) => a[1].localeCompare(b[1])), cur, aria);
  const mapColor = ind => {
    const vals = Object.values(E.column(ind.id));
    if (ind.div != null) { const span = Math.max(Math.abs(S.quantile(vals, 0.05) - ind.div), Math.abs(S.quantile(vals, 0.95) - ind.div)) || 1; const g = ind.good || 1; return { fn: v => { const t = (v - ind.div) / span * g; return C.div(Math.sign(t) * Math.sqrt(Math.min(1, Math.abs(t)))); }, kind: 'div', lo: ind.div - span, hi: ind.div + span }; }
    if (ind.log) { const lv = vals.filter(v => v > 0).map(Math.log); const a = S.quantile(lv, 0.03), b = S.quantile(lv, 0.97); return { fn: v => C.seq(v > 0 ? (Math.log(v) - a) / (b - a) : 0), kind: 'seq', lo: Math.exp(a), hi: Math.exp(b) }; }
    const a = S.quantile(vals, 0.03), b = S.quantile(vals, 0.97);
    return { fn: v => C.seq((v - a) / (b - a || 1)), kind: 'seq', lo: a, hi: b };
  };
  function worldMap(indId, hl) {
    const ind = E.indById(indId), vals = E.column(indId), mc = mapColor(ind);
    const opts = E.IND.filter(i => i.map).map(i => [i.id, i.short]);
    const scaleNote = ind.div != null ? (ind.id === 'inf' ? `Centered on a ${E.INFL_TARGET}% inflation target: red is further above it.` : ind.good ? 'Blue is stronger, red is weaker; gray is near zero.' : 'Blue is a surplus, red a deficit.') : 'Darker means higher.';
    return card(`${ind.lab}`, `${esc(ind.src)} data for ${Object.keys(vals).length} economies. ${scaleNote} Click a country for its profile.`,
      `<div class="map">${C.map({ vals, color: mc.fn, hl, aria: ind.lab + ' world map', tip: (iso, v) => `<b>${esc(E.name(iso))}</b>${K.tipRow(null, ind.short, esc(E.fmtInd(ind, v)))}${E.BYISO[iso] && E.BYISO[iso].rank ? K.tipRow(null, 'GDP rank', '#' + E.BYISO[iso].rank) : ''}` })}</div>${C.rampHTML(mc.kind, mc.lo, mc.hi, v => E.fmtInd(ind, v))}`,
      sel('mapind', opts, indId, 'Map indicator'));
  }

  /* ---------------- market pulse (daily FRED) ---------------- */
  const PULSE = [
    ['DGS10', '10-year Treasury', '%', 2, -1], ['DGS2', '2-year Treasury', '%', 2, -1], ['T10Y3M', 'Yield curve (10y − 3m)', 'pp', 2, 1], ['BAA10Y', 'Corporate credit spread', 'pp', 2, -1],
    ['DCOILWTICO', 'Oil (WTI)', '$', 2, 0], ['DTWEXBGS', 'Dollar index', '', 1, 0], ['VIXCLS', 'Stock volatility (VIX)', '', 1, -1], ['SP500', 'S&P 500', '', 0, 1]
  ];
  function pulse(days = 130) {
    return `<div class="tiles">${PULSE.map(([id, lab, unit, d, good]) => {
      const r = E.raw(id); if (!r || !r.length) return '';
      const last = r[r.length - 1];
      const lastD = String(last[0]), dt = new Date(+lastD.slice(0, 4), +lastD.slice(4, 6) - 1, +lastD.slice(6, 8));
      const monthAgo = r.slice().reverse().find(x => { const s = String(x[0]); return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)) <= new Date(dt - 30 * 864e5); });
      const ch = monthAgo ? (id === 'SP500' || id === 'DCOILWTICO' || id === 'DTWEXBGS' ? (last[1] / monthAgo[1] - 1) * 100 : last[1] - monthAgo[1]) : null;
      const pctCh = id === 'SP500' || id === 'DCOILWTICO' || id === 'DTWEXBGS';
      const recent = r.slice(-days).map(x => x[1]);
      const val = unit === '$' ? '$' + num(last[1], d) : num(last[1], d) + (unit === '%' ? '%' : '');
      return tile({ lab: lab, val, unit: unit === 'pp' ? 'pp' : '', sub: `${upDown(ch, pctCh ? 1 : 2, pctCh ? '%' : '')} over a month · ${K.dLab(last[0])}`, spark: C.spark(recent, { w: 160, h: 30, color: 'var(--s1)', zero: id === 'T10Y3M' }) });
    }).join('')}</div>`;
  }

  /* ---------------- "what changed": latest US releases ---------------- */
  const FEED = [
    ['PAYEMS', 'Payroll jobs', 'diff', 'K', 0, 1], ['UNRATE', 'Unemployment rate', 'level', '%', 1, -1], ['CPIAUCSL', 'CPI inflation (12-month)', 'yoy', '%', 1, -1], ['CPILFESL', 'Core CPI (12-month)', 'yoy', '%', 1, -1],
    ['PCEPILFE', 'Core PCE inflation (12-month)', 'yoy', '%', 1, -1], ['RRSFS', 'Real retail sales (12-month)', 'yoy', '%', 1, 1], ['INDPRO', 'Industrial production (12-month)', 'yoy', '%', 1, 1],
    ['HOUST', 'Housing starts', 'level', 'K', 0, 1], ['UMCSENT', 'Consumer sentiment', 'level', '', 1, 1], ['JTSJOL', 'Job openings', 'level', 'K', 0, 1], ['ICSA', 'Jobless claims (weekly)', 'raw', '', 0, -1],
    ['A191RL1Q225SBEA', 'Real GDP growth (annualized)', 'q', '%', 1, 1], ['SAHMREALTIME', 'Sahm rule indicator', 'level', 'pp', 2, -1], ['MICH', 'Expected inflation (households)', 'level', '%', 1, -1],
    ['PCEC96', 'Real consumer spending (12-month)', 'yoy', '%', 1, 1], ['CSUSHPISA', 'Home prices (12-month)', 'yoy', '%', 1, 0]
  ];
  function feedItems() {
    const out = [];
    for (const [id, lab, tr, unit, d, good] of FEED) {
      const s = E.us(id); if (!s) continue;
      let v, prev, date, hist = [];
      if (tr === 'q') { const q = E.qSeries(id), t = E.qLast(q); v = E.qAt(q, t); prev = E.qAt(q, t - 1); date = K.qLab(t); hist = q.v.slice(-120); }
      else if (tr === 'raw') { const r = E.raw(id); const a = r[r.length - 1], b = r[r.length - 2]; v = a[1]; prev = b[1]; date = 'week of ' + K.dLab(a[0]); hist = r.map(x => x[1]); }
      else {
        let ms = E.mSeries(id); if (tr === 'yoy') ms = E.mYoY(ms); if (tr === 'diff') ms = E.mDiff(ms);
        const t = E.mLast(ms); v = E.mAt(ms, t); prev = E.mAt(ms, t - 1); date = K.mLab(t); hist = ms.v.slice(-240);
      }
      const chg = ok(v) && ok(prev) ? v - prev : null;
      const dh = []; for (let i = 1; i < hist.length; i++) if (ok(hist[i]) && ok(hist[i - 1])) dh.push(hist[i] - hist[i - 1]);
      const sdc = S.sd(dh), z = ok(chg) && sdc ? chg / sdc : null;
      out.push({ id, lab, v, prev, chg, z, date, unit, d, good, last: s.last });
    }
    return out.sort((a, b) => (b.last || '').localeCompare(a.last || ''));
  }
  const fmtFeed = (it, v) => !ok(v) ? '–' : it.unit === 'K' ? num(v, 0) + 'K' : it.unit === '%' ? num(v, it.d) + '%' : it.unit === 'pp' ? num(v, it.d) : num(v, it.d);
  function feed(n = 10) {
    return `<div class="feed">${feedItems().slice(0, n).map(it => {
      const size = ok(it.z) ? (Math.abs(it.z) >= 2 ? 'Big move' : Math.abs(it.z) >= 1 ? 'Notable' : 'Typical') : '';
      const dir = !ok(it.chg) || it.good === 0 ? 'flat' : (it.chg > 0) === (it.good > 0) ? 'up' : 'down';
      return `<div class="it" data-series="${it.id}" role="button" tabindex="0" style="cursor:pointer"><div><div class="nm">${esc(it.lab)}</div><div class="dt">${esc(it.date)}${size ? ' · ' + size + ' (' + sgn(it.z, 1) + ' sd)' : ''}</div></div><div><div class="vv">${fmtFeed(it, it.v)}</div><div class="ch"><span class="delta ${dir}">${it.id === 'PAYEMS' ? '' : sgn(it.chg, it.d)}${it.id === 'PAYEMS' ? 'prior ' + fmtFeed(it, it.prev) : ' vs prior'}</span></div></div></div>`;
    }).join('')}</div>`;
  }

  /* ---------------- alerts ---------------- */
  function usAlerts() {
    const a = [];
    const rec = M.recession(), cm = rec.models.classic, em = rec.models.extended;
    const sp = rec.spread(rec.tNow);
    if (cm) { const p = cm.pNow; a.push({ lvl: p >= 0.5 ? 'crit' : p >= 0.3 ? 'serious' : p >= 0.15 ? 'warn' : 'good', title: `Recession odds within 12 months: ${pct(p * 100, 0)}`, why: `Yield-curve model (term spread ${sgn(sp, 2)} pp). The model with financial conditions says ${em ? pct(em.pNow * 100, 0) : '–'}.` }); }
    if (ok(sp)) a.push(sp < 0 ? { lvl: 'serious', title: 'The yield curve is inverted', why: `10-year yield below the 3-month rate by ${num(-sp, 2)} pp; inversions preceded every US recession since 1969.` } : { lvl: 'good', title: 'The yield curve is positive', why: `10-year minus 3-month is ${sgn(sp, 2)} pp. It un-inverted after the 2022–24 inversion.` });
    const sahm = E.mSeries('SAHMREALTIME'), st = E.mLast(sahm), sv = E.mAt(sahm, st);
    if (ok(sv)) a.push({ lvl: sv >= 0.5 ? 'crit' : sv >= 0.3 ? 'warn' : 'good', title: `Sahm rule: ${num(sv, 2)} pp`, why: `Triggers at 0.50: the 3-month average jobless rate has risen that far above its 12-month low (${K.mLab(st)}).` });
    const inf = M.inflation(), core = M.latestCorePCE();
    if (ok(core)) a.push({ lvl: core >= 3 ? 'serious' : core >= 2.5 ? 'warn' : 'good', title: `Core PCE inflation ${pct(core, 1)} vs the Fed's 2% goal`, why: `CPI inflation is ${pct(inf.now, 1)}; the model sees ${pct(inf.path[12] ? inf.path[12][1] : null, 1)} in 12 months.` });
    const ty = M.taylor(), ff = E.mAt(E.mSeries('DFF'), E.mLast(E.mSeries('DFF')));
    if (ty && ok(ff)) { const g = ff - ty.classic; a.push({ lvl: Math.abs(g) >= 1.5 ? 'warn' : 'info', title: `Policy rate ${pct(ff, 2)} vs Taylor rule ${pct(ty.classic, 2)}`, why: `The rule (r* ${num(ty.rstar, 1)}%, core PCE ${pct(ty.core, 1)}, output gap ${sgn(ty.gap, 1)}%) implies policy is ${g < 0 ? 'looser' : 'tighter'} than the rule by ${num(Math.abs(g), 1)} pp.` }); }
    const cl = E.raw('ICSA'); if (cl && cl.length > 60) { const avg4 = S.mean(cl.slice(-4).map(x => x[1])), low = Math.min(...cl.slice(-52).map(x => x[1])); const up = (avg4 / low - 1) * 100; a.push({ lvl: up >= 25 ? 'serious' : up >= 15 ? 'warn' : 'good', title: `Jobless claims ${num(avg4 / 1000, 0)}K (4-week average)`, why: `${num(up, 0)}% above the 52-week low; rises above 20–25% have historically signaled a weakening job market.` }); }
    const bs = E.mSeries('BAA10Y'), bt = E.mLast(bs), bv = E.mAt(bs, bt); if (ok(bv)) { const p = S.pctRank(bs.v, bv); a.push({ lvl: p >= 0.8 ? 'serious' : p >= 0.6 ? 'warn' : 'good', title: `Credit spread ${num(bv, 2)} pp`, why: `Higher than ${num(p * 100, 0)}% of months since 1986; wide spreads signal credit stress.` }); }
    const def = E.imf('GGXCNL_NGDP', 'USA', E.CY); if (ok(def)) a.push({ lvl: def <= -6 ? 'serious' : def <= -3 ? 'warn' : 'good', title: `Government deficit ${pct(-def, 1)} of GDP in ${E.CY}`, why: `IMF projects general government debt at ${pct(E.imf('GGXWDG_NGDP', 'USA', E.CY), 0)} of GDP, rising to ${pct(E.imf('GGXWDG_NGDP', 'USA', E.CY + 5), 0)} by ${E.CY + 5}.` });
    const order = { crit: 0, serious: 1, warn: 2, info: 3, good: 4 };
    return a.sort((x, y) => order[x.lvl] - order[y.lvl]);
  }
  function worldAlerts() {
    const a = [], big = E.COUNTRIES.filter(c => (E.indById('pop').get(c.iso) || 0) >= 5);
    const shrink = big.filter(c => { const g = E.imf('NGDP_RPCH', c.iso, E.CY); return ok(g) && g < 0; });
    if (shrink.length) a.push({ lvl: shrink.length >= 12 ? 'serious' : 'warn', title: `${shrink.length} economies (5m+ people) are forecast to shrink in ${E.CY}`, why: shrink.sort((x, y) => E.imf('NGDP_RPCH', x.iso, E.CY) - E.imf('NGDP_RPCH', y.iso, E.CY)).slice(0, 6).map(c => `${clink(c.iso)} ${pct(E.imf('NGDP_RPCH', c.iso, E.CY), 1)}`).join(', ') });
    const hi = big.filter(c => { const v = E.imf('PCPIPCH', c.iso, E.CY); return ok(v) && v >= 20; });
    if (hi.length) a.push({ lvl: 'serious', title: `${hi.length} economies have inflation of 20% or more`, why: hi.sort((x, y) => E.imf('PCPIPCH', y.iso, E.CY) - E.imf('PCPIPCH', x.iso, E.CY)).slice(0, 6).map(c => `${clink(c.iso)} ${pct(E.imf('PCPIPCH', c.iso, E.CY), 0)}`).join(', ') });
    const debt = big.filter(c => { const d = E.imf('GGXWDG_NGDP', c.iso, E.CY), d5 = E.imf('GGXWDG_NGDP', c.iso, E.CY + 5); return ok(d) && ok(d5) && d >= 90 && d5 - d >= 5; });
    if (debt.length) a.push({ lvl: 'warn', title: `${debt.length} economies have debt above 90% of GDP and still rising`, why: debt.sort((x, y) => (E.imf('GGXWDG_NGDP', y.iso, E.CY + 5) - E.imf('GGXWDG_NGDP', y.iso, E.CY)) - (E.imf('GGXWDG_NGDP', x.iso, E.CY + 5) - E.imf('GGXWDG_NGDP', x.iso, E.CY))).slice(0, 6).map(c => `${clink(c.iso)} ${pct(E.imf('GGXWDG_NGDP', c.iso, E.CY), 0)} → ${pct(E.imf('GGXWDG_NGDP', c.iso, E.CY + 5), 0)}`).join(', ') });
    const ext = big.filter(c => { const ca = E.imf('BCA_NGDPD', c.iso, E.CY), r = E.wbLatest('FI.RES.TOTL.MO', c.iso).v; return ok(ca) && ca <= -4 && ok(r) && r < 3; });
    if (ext.length) a.push({ lvl: 'warn', title: `${ext.length} economies combine a large current-account deficit with thin reserves`, why: ext.slice(0, 6).map(c => `${clink(c.iso)} (deficit ${pct(-E.imf('BCA_NGDPD', c.iso, E.CY), 1)}, reserves ${num(E.wbLatest('FI.RES.TOTL.MO', c.iso).v, 1)} mo)`).join(', ') });
    const an = M.anomalies().filter(x => (E.indById('pop').get(x.iso) || 0) >= 5 && Math.abs(x.z) >= 2.5).slice(0, 4);
    if (an.length) a.push({ lvl: 'info', title: 'Biggest breaks from recent history', why: an.map(x => `${clink(x.iso)}: ${x.ind.lab.toLowerCase()} ${num(x.v, 1)}${x.ind.unit === '%' ? '%' : ''} vs a ${num(x.m, 1)} average (${sgn(x.z, 1)} sd)`).join('; ') });
    const wg = E.imf('NGDP_RPCH', 'WEOWORLD', E.CY), trend = S.mean([2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019].map(y => E.imf('NGDP_RPCH', 'WEOWORLD', y)));
    if (ok(wg)) a.unshift({ lvl: wg < 2.5 ? 'serious' : wg < trend - 0.3 ? 'warn' : 'good', title: `World growth ${pct(wg, 1)} in ${E.CY}`, why: `Below the 2012–19 average of ${pct(trend, 1)}. A global recession is usually defined as world growth under about 2.5%, or falling output per person.` });
    return a;
  }
  function countryAlerts(iso) {
    const a = [], g = E.imf('NGDP_RPCH', iso, E.CY), inf = E.imf('PCPIPCH', iso, E.CY), d = E.imf('GGXWDG_NGDP', iso, E.CY), d5 = E.imf('GGXWDG_NGDP', iso, E.CY + 5), ca = E.imf('BCA_NGDPD', iso, E.CY);
    const rk = M.growth().risk(iso);
    if (ok(g)) a.push({ lvl: g < 0 ? 'crit' : g < 1 ? 'warn' : 'good', title: `Growth ${pct(g, 1)} in ${E.CY}`, why: `IMF forecast; ${E.CY + 1}: ${pct(E.imf('NGDP_RPCH', iso, E.CY + 1), 1)}.${rk && ok(rk.pN) ? ` Chance of a contraction in ${E.CY + 1}: ${pct(rk.pN * 100, 0)}.` : ''}` });
    if (ok(inf)) a.push({ lvl: inf >= 20 ? 'crit' : inf >= 8 ? 'serious' : inf >= 4 ? 'warn' : inf < 0 ? 'warn' : 'good', title: `Inflation ${pct(inf, 1)}`, why: inf < 0 ? 'Falling prices can deepen debt burdens and delay spending.' : `Versus a typical ${E.INFL_TARGET}–3% target.` });
    if (ok(d)) a.push({ lvl: d >= 100 && d5 > d ? 'serious' : d >= 70 && d5 > d + 3 ? 'warn' : 'good', title: `Government debt ${pct(d, 0)} of GDP`, why: ok(d5) ? `IMF path: ${pct(d5, 0)} by ${E.CY + 5} (${sgn(d5 - d, 0)} pp).` : '' });
    if (ok(ca)) { const r = E.wbLatest('FI.RES.TOTL.MO', iso).v; a.push({ lvl: ca <= -4 && ok(r) && r < 3 ? 'serious' : ca <= -4 ? 'warn' : 'good', title: `Current account ${sgn(ca, 1)}% of GDP`, why: ok(r) ? `Reserves cover ${num(r, 1)} months of imports (3 is a common minimum).` : '' }); }
    for (const x of M.anomalies(iso).filter(x => Math.abs(x.z) >= 2).slice(0, 2)) a.push({ lvl: 'info', title: `Unusual ${x.ind.lab.toLowerCase()}`, why: `${num(x.v, 1)} this year vs ${num(x.m, 1)} on average over the previous decade (${sgn(x.z, 1)} sd).` });
    const order = { crit: 0, serious: 1, warn: 2, info: 3, good: 4 };
    return a.sort((x, y) => order[x.lvl] - order[y.lvl]);
  }

  /* ---------------- LIVE views ---------------- */
  function liveWorld(st) {
    const wg = E.imf('NGDP_RPCH', 'WEOWORLD', E.CY), wg0 = E.imf('NGDP_RPCH', 'WEOWORLD', E.CY - 1), ae = E.imf('NGDP_RPCH', 'ADVEC', E.CY), em = E.imf('NGDP_RPCH', 'OEMDC', E.CY), wi = E.imf('PCPIPCH', 'WEOWORLD', E.CY);
    const shrink = E.COUNTRIES.filter(c => { const g = E.imf('NGDP_RPCH', c.iso, E.CY); return ok(g) && g < 0; }).length, withData = Object.keys(E.column('g')).length;
    const rec = M.recession().models.classic, now = M.nowcast();
    const wS = E.imfS('NGDP_RPCH', 'WEOWORLD', 2000, E.CY + 5).map(p => p[1]);
    return sec('The world economy right now', `Headline numbers from the ${esc(E.VINT)} and daily US market data. Every figure links to its source in How it works.`) +
      `<div class="tiles t6">
        ${tile({ hero: true, lab: `World real GDP growth, ${E.CY}`, val: pct(wg, 1), sub: `${upDown(wg - wg0, 1, ' pp')} vs ${E.CY - 1} (${pct(wg0, 1)}). IMF projects ${pct(E.imf('NGDP_RPCH', 'WEOWORLD', E.CY + 1), 1)} in ${E.CY + 1}.`, spark: C.spark(wS, { w: 220, h: 34, color: 'var(--band-accent)', zero: true }) })}
        ${tile({ lab: 'Advanced economies', val: pct(ae, 1), sub: `${E.CY} growth · ${E.CY + 1}: ${pct(E.imf('NGDP_RPCH', 'ADVEC', E.CY + 1), 1)}` })}
        ${tile({ lab: 'Emerging & developing', val: pct(em, 1), sub: `${E.CY} growth · ${E.CY + 1}: ${pct(E.imf('NGDP_RPCH', 'OEMDC', E.CY + 1), 1)}` })}
        ${tile({ lab: `World inflation, ${E.CY}`, val: pct(wi, 1), sub: `${upDown(wi - E.imf('PCPIPCH', 'WEOWORLD', E.CY - 1), 1, ' pp')} vs ${E.CY - 1}` })}
        ${tile({ lab: `Economies shrinking in ${E.CY}`, val: String(shrink), unit: `of ${withData}`, sub: `${pct(shrink / withData * 100, 0)} of economies with an IMF forecast` })}
        ${tile({ lab: 'US recession odds, next 12 months', val: rec ? pct(rec.pNow * 100, 0) : '–', sub: 'Yield-curve probit model · <a href="#" data-goto="models">see the model</a>' })}
        ${tile({ lab: `US GDP nowcast, ${now ? K.qLab(now.qNow) : ''}`, val: now ? pct(now.est, 1) : '–', sub: now ? `annualized · 80% range ${num(now.lo, 1)} to ${num(now.hi, 1)} · Atlanta Fed GDPNow ${pct(now.gdpnow, 1)}` : '' })}
        ${tile({ lab: `World government debt, ${E.CY}`, val: pct(E.imf('GGXWDG_NGDP', 'WEOWORLD', E.CY), 0), unit: 'of GDP', sub: `IMF path: ${pct(E.imf('GGXWDG_NGDP', 'WEOWORLD', E.CY + 5), 0)} by ${E.CY + 5}` })}
        ${tile({ lab: `Median economy, ${E.CY}`, val: pct(S.median(Object.values(E.column('g'))), 1), sub: `growth · median inflation ${pct(S.median(Object.values(E.column('inf'))), 1)}` })}
        ${tile({ lab: `Double-digit inflation, ${E.CY}`, val: String(Object.values(E.column('inf')).filter(v => v >= 10).length), unit: 'economies', sub: `${String(Object.values(E.column('inf')).filter(v => v < 0).length)} have falling prices` })}
        ${(() => { const r = E.raw('DCOILWTICO'); const a = r && r[r.length - 1]; return tile({ lab: 'Oil price (WTI)', val: a ? '$' + num(a[1], 2) : '–', sub: a ? `per barrel · ${K.dLab(a[0])}` : '' }); })()}
      </div>` +
      `<div class="grid g-8-4" style="margin-top:14px"><div class="grid" style="align-content:start">${worldMap(st.mapInd, null)}${card(`Fastest and slowest of the 40 largest economies, ${E.CY}`, 'IMF real GDP growth forecasts. Click a bar for the profile.', leaders())}</div>${card('Alerts', 'Rules applied to the latest data. Each alert has an icon and a label, not just a color.', alerts(worldAlerts()))}</div>` +
      sec('Markets and US data', 'Daily market readings and the latest US releases from FRED.') +
      `<div class="grid g-8-4">${card('Market pulse', 'Last six months of daily data.', pulse())}${card('What changed', 'Newest US releases first. "Big move" means the change was more than two standard deviations of its usual monthly change. Click one to chart it; see every release under United States.', feed(6))}</div>`;
  }
  function leaders() {
    const rows = E.COUNTRIES.filter(c => c.top40).map(c => ({ name: c.name, v: E.imf('NGDP_RPCH', c.iso, E.CY), id: c.iso })).filter(r => ok(r.v)).sort((a, b) => b.v - a.v);
    const pick = rows.slice(0, 6).concat(rows.slice(-6));
    return C.hbars(pick.map(r => ({ ...r, color: r.v >= 0 ? 'var(--s1)' : 'var(--s2)' })), { fmt: v => pct(v, 1) });
  }
  function liveUS() {
    const now = M.nowcast(), rec = M.recession(), cm = rec.models.classic, inf = M.inflation();
    const un = E.mSeries('UNRATE'), ut = E.mLast(un), pay = E.mDiff(E.mSeries('PAYEMS')), pt = E.mLast(pay);
    const cpi = E.mYoY(E.mSeries('CPIAUCSL')), ct = E.mLast(cpi), core = M.latestCorePCE();
    const ffr = E.raw('DFF'), y10 = E.raw('DGS10'), sp = E.raw('T10Y3M');
    const lastRaw = r => r ? r[r.length - 1] : null;
    return sec('United States: the latest read', 'The national deep dive runs on 52 FRED series refreshed twice a day, plus in-browser models.') +
      `<div class="tiles t6">
        ${tile({ hero: true, lab: `GDP nowcast, ${now ? K.qLab(now.qNow) : ''} (annualized)`, val: now ? pct(now.est, 1) : '–', sub: now ? `80% range ${num(now.lo, 1)} to ${num(now.hi, 1)}%. Atlanta Fed GDPNow: ${pct(now.gdpnow, 1)}. Last quarter (${K.qLab(now.qLast)}): ${pct(now.lastActual, 1)}.` : '' })}
        <div class="tile"><span class="lab">Recession odds, next 12 months</span><div class="gauge">${C.gauge(cm ? cm.pNow : 0)}</div><span class="sub">Yield-curve model · with financial conditions: ${rec.models.extended ? pct(rec.models.extended.pNow * 100, 0) : '–'}</span></div>
        ${tile({ lab: `Unemployment, ${K.mLab(ut)}`, val: pct(E.mAt(un, ut), 1), sub: `${deltaBad(E.mAt(un, ut) - E.mAt(un, ut - 12), 1, ' pp', -1)} over a year`, spark: C.spark(un.v.slice(-36), { w: 150, h: 26 }) })}
        ${tile({ lab: `Payroll jobs added, ${K.mLab(pt)}`, val: num(E.mAt(pay, pt), 0), unit: 'K', sub: `3-month average ${num(S.mean([0, 1, 2].map(k => E.mAt(pay, pt - k))), 0)}K`, spark: C.spark(pay.v.slice(-36), { w: 150, h: 26, zero: true }) })}
        ${tile({ lab: `CPI inflation, ${K.mLab(ct)}`, val: pct(E.mAt(cpi, ct), 1), sub: `Core PCE ${pct(core, 1)} · model: ${pct(inf.path[12] ? inf.path[12][1] : null, 1)} in 12 months`, spark: C.spark(cpi.v.slice(-36), { w: 150, h: 26 }) })}
        ${tile({ lab: 'Fed funds rate', val: pct(lastRaw(ffr) && lastRaw(ffr)[1], 2), sub: `as of ${lastRaw(ffr) ? K.dLab(lastRaw(ffr)[0]) : ''}` })}
        ${tile({ lab: '10-year Treasury yield', val: pct(lastRaw(y10) && lastRaw(y10)[1], 2), sub: `Curve (10y − 3m): ${sgn(lastRaw(sp) && lastRaw(sp)[1], 2)} pp` })}
        ${(() => { const j = E.mSeries('JTSJOL'), t = E.mLast(j); const v = E.mAt(j, t); return tile({ lab: `Job openings, ${K.mLab(t)}`, val: num(v / 1000, 2), unit: 'million', sub: `${upDown((v - E.mAt(j, t - 12)) / 1000, 2, 'M')} over a year` }); })()}
        ${(() => { const s = E.mSeries('UMCSENT'), t = E.mLast(s); return tile({ lab: `Consumer sentiment, ${K.mLab(t)}`, val: num(E.mAt(s, t), 1), sub: `Long-run average ${num(S.mean(s.v), 0)} (U. Michigan)` }); })()}
        ${(() => { const r = E.raw('MORTGAGE30US'); const a = r && r[r.length - 1]; return tile({ lab: '30-year mortgage rate', val: a ? pct(a[1], 2) : '–', sub: a ? `week of ${K.dLab(a[0])}` : '' }); })()}
        ${(() => { const h = E.mYoY(E.mSeries('CSUSHPISA')), t = E.mLast(h); return tile({ lab: `Home prices, ${K.mLab(t)}`, val: pct(E.mAt(h, t), 1), sub: '12-month change (Case-Shiller)' }); })()}
      </div>` +
      `<div class="grid g-7-5" style="margin-top:14px">${card('Alerts', 'Rules applied to the latest US data.', alerts(usAlerts()))}${card('What changed', 'Newest releases first; click one to chart it.', feed(12))}</div>` +
      sec('Market pulse', 'Six months of daily data.') + pulse();
  }
  function peerBars(iso) {
    const ids = ['g', 'g10', 'inf', 'unemp', 'debt', 'bal', 'ca', 'inv', 'ge', 'gdppc'];
    const peers = E.peers(iso).map(c => c.iso);
    const items = ids.map(id => { const ind = E.indById(id), col = E.column(id), v = col[iso]; if (!ok(v)) return null; const dist = peers.map(p => col[p]).filter(ok); const p = S.pctRank(dist, v); const signed = ind.good ? (ind.good > 0 ? p : 1 - p) : p; return { name: ind.short, v: signed * 100, title: `${E.fmtInd(ind, v)} vs peer median ${E.fmtInd(ind, S.median(dist))}`, color: ind.good ? (signed >= 0.5 ? 'var(--s1)' : 'var(--s2)') : 'var(--s7)' }; }).filter(Boolean);
    return C.hbars(items, { lo: 0, hi: 100, fmt: v => K.ord(Math.round(v)) + ' pct' });
  }
  function liveCountry(iso) {
    const c = E.BYISO[iso], ind = id => E.indById(id);
    const v = id => ind(id).get(iso), rk = M.growth().risk(iso);
    const gS = E.imfS('NGDP_RPCH', iso, 2000, E.CY + 5).map(p => p[1]);
    return sec(`${E.name(iso)} right now`, `${esc(c.region)} · ${esc(c.inc)} · #${c.rank || '–'} economy by GDP. Figures are IMF ${E.CY} forecasts unless marked.`) +
      `<div class="tiles t6">
        ${tile({ hero: true, lab: `Real GDP growth, ${E.CY}`, val: E.fmtInd(ind('g'), v('g')), sub: `${E.CY + 1}: ${E.fmtInd(ind('g1'), v('g1'))} · 10-year average ${E.fmtInd(ind('g10'), v('g10'))}`, spark: C.spark(gS, { w: 220, h: 34, color: 'var(--band-accent)', zero: true }) })}
        ${tile({ lab: `Inflation, ${E.CY}`, val: E.fmtInd(ind('inf'), v('inf')), sub: `${E.CY - 1}: ${pct(E.imf('PCPIPCH', iso, E.CY - 1), 1)}` })}
        ${tile({ lab: 'Unemployment', val: E.fmtInd(ind('unemp'), v('unemp')), sub: `Youth: ${E.fmtInd(ind('youth'), v('youth'))}` })}
        ${tile({ lab: 'Government debt', val: E.fmtInd(ind('debt'), v('debt')), unit: 'of GDP', sub: `Budget balance ${E.fmtInd(ind('bal'), v('bal'))}` })}
        ${tile({ lab: 'Current account', val: E.fmtInd(ind('ca'), v('ca')), unit: 'of GDP', sub: `Reserves ${E.fmtInd(ind('res'), v('res'))}` })}
        ${tile({ lab: 'GDP per person', val: E.fmtInd(ind('gdppc'), v('gdppc')), sub: `At PPP ${E.fmtInd(ind('ppppc'), v('ppppc'))}` })}
        ${tile({ lab: `Chance of contraction, ${E.CY + 1}`, val: rk && ok(rk.pN) ? pct(rk.pN * 100, 0) : '–', sub: 'From the IMF forecast and this economy\'s forecast-error history' })}
        ${tile({ lab: 'Population', val: E.fmtInd(ind('pop'), v('pop')), sub: `Share of world GDP (PPP) ${E.fmtInd(ind('share'), v('share'))}` })}
        ${tile({ lab: 'Investment', val: E.fmtInd(ind('inv'), v('inv')), unit: 'of GDP', sub: `Savings ${E.fmtInd(ind('sav'), v('sav'))}` })}
        ${tile({ lab: 'Government effectiveness', val: E.fmtInd(ind('ge'), v('ge')), sub: 'World Bank index, −2.5 to 2.5' })}
        ${tile({ lab: 'Life expectancy', val: E.fmtInd(ind('life'), v('life')), sub: `Internet users ${E.fmtInd(ind('net'), v('net'))}` })}
      </div>` +
      `<div class="grid g-7-5" style="margin-top:14px">${card('Alerts', 'Rules applied to the latest IMF and World Bank data.', alerts(countryAlerts(iso)))}${card(`Versus ${c.inc.toLowerCase()} peers`, `Percentile among ${E.peers(iso).length} ${esc(c.inc.toLowerCase())} economies, flipped where lower is better so right is always stronger. Blue is above the median, orange below it; purple has no better or worse direction.`, peerBars(iso))}</div>` +
      `<div class="grid g2" style="margin-top:14px">${worldMap(STATE.mapInd, iso)}${card('Where it sits in the world', 'Same indicator, all economies. Click another country to compare.', `<div class="kv">${E.IND.filter(i => i.map).map(i => { const col = E.column(i.id), vals = Object.values(col), val = col[iso]; const rank = ok(val) ? vals.filter(x => (i.good < 0 ? x < val : x > val)).length + 1 : null; return `<dt>${esc(i.short)}</dt><dd>${E.fmtInd(i, val)} <span class="muted">${rank ? '#' + rank + ' of ' + vals.length : ''}</span></dd>`; }).join('')}</div>`)}</div>`;
  }
  function live(st) { return st.scope === 'WLD' ? liveWorld(st) : st.scope === 'USA' ? liveUS(st) : liveCountry(st.scope); }

  return { sec, tile, badge, clink, card, src, alerts, upDown, deltaBad, seg, sel, countrySel, worldMap, mapColor, pulse, feed, feedItems, usAlerts, worldAlerts, countryAlerts, peerBars, live };
})();
