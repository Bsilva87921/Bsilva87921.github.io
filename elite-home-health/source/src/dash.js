/* Home Care Operations Dashboard (Elite Home Healthcare work sample). */
const DASH = (() => {
  const { $, $$, esc, ok, num, pct, sgn, money } = K;
  const F = { period: '12', office: 'ALL', payer: 'ALL', service: 'ALL', shift: 'ALL' };
  const WI = { fill: null, early: 30, denial: 2.5 };
  const sel = (key, lab, opts) => `<label class="f"><span>${esc(lab)}</span><select class="sel" data-f="${key}" aria-label="${esc(lab)}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${F[key] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  function filters() {
    $('#filters').innerHTML =
      sel('period', 'Period', [['3', 'Last 3 months'], ['6', 'Last 6 months'], ['12', 'Last 12 months'], ['all', 'All 24 months']]) +
      sel('office', 'Office', [['ALL', 'All offices']].concat(X.OFF.map(o => [o[0], o[1]]))) +
      sel('payer', 'Payer', [['ALL', 'All payers']].concat(X.PAY.map(p => [p[0], p[1]]))) +
      sel('service', 'Service', [['ALL', 'All services']].concat(X.SRV.map(s => [s[0], s[1]]))) +
      sel('shift', 'Shift', [['ALL', 'All shifts']].concat(X.SHF.map(s => [s[0], s[1]]))) +
      `<button type="button" class="btn" id="resetF">Reset</button>`;
  }
  const fLabel = () => [F.office !== 'ALL' ? X.name(X.OFF, F.office) : 'All offices', F.payer !== 'ALL' ? X.name(X.PAY, F.payer) : 'all payers', F.service !== 'ALL' ? X.name(X.SRV, F.service) : 'all services', F.shift !== 'ALL' ? X.name(X.SHF, F.shift) : 'all shifts'].join(' · ');
  const STL = { good: ['good', 'On target'], warn: ['warn', 'Near target'], crit: ['crit', 'Off target'] };
  const badge = st => st ? `<span class="badge st-${STL[st][0]}"><i></i>${STL[st][1]}</span>` : '';
  function kpiTile(def, cur, prev) {
    const v = cur[def.k], p = prev ? prev[def.k] : null, st = X.status(def, v);
    let d = '';
    if (ok(v) && ok(p)) {
      const ch = v - p, better = def.dir > 0 ? ch > 0 : ch < 0, isPct = /pct|rate|fill|evv|turnover|early|overtime|satisfaction|admit|Rate|Pct/i.test(def.k);
      const txt = def.k === 'unbilled' ? (ch >= 0 ? '+' : K.MINUS) + money(Math.abs(ch)) : isPct ? sgn(ch * 100, 1, ' pp') : sgn(ch, def.k === 'marginHr' ? 2 : 1);
      d = `<span class="delta ${Math.abs(ch) < 1e-9 ? 'flat' : better ? 'up' : 'down'}">${txt}</span> vs prior period`;
    }
    return `<div class="tile kpi" title="${esc(def.def)}"><span class="lab">${esc(def.lab)}</span><span class="val">${ok(v) ? def.fmt(v) : '–'}</span><span class="sub">${d || '&nbsp;'}</span><div class="tgt"><span class="t">${def.tgt != null ? 'Target ' + (def.dir > 0 ? '≥ ' : '≤ ') + def.fmt(def.tgt) : 'No target: lower is better'}</span>${badge(st)}</div></div>`;
  }
  /* --------- auto insights --------- */
  function insights(cur) {
    const out = [], ms = cur.months;
    // worst office x shift cell
    let worst = null;
    for (const o of X.OFF) for (const s of X.SHF) { if ((F.office !== 'ALL' && F.office !== o[0]) || (F.shift !== 'ALL' && F.shift !== s[0])) continue; const c = X.compute(ms, { ...F, office: o[0], shift: s[0] }); if (c.auth > 500 && (!worst || c.fill < worst.c.fill)) worst = { o, s, c }; }
    out.push(['crit', `<b>${pct(cur.fill * 100, 1)} of authorized hours were delivered</b>, leaving ${num(cur.unfilled, 0)} hours (${money(cur.unbilled)}) unstaffed${worst ? `. The weakest spot is <b>${esc(worst.o[1])}, ${esc(worst.s[1].toLowerCase())}</b> at ${pct(worst.c.fill * 100, 1)}` : ''}.`]);
    out.push([cur.early90 > 0.45 ? 'serious' : 'warn', `<b>${pct(cur.early90 * 100, 0)} of caregivers who leave do so within 90 days</b> (turnover ${pct(cur.turnover * 100, 0)} a year). Early exits are the biggest driver of the hours gap; see the case study.`]);
    let wp = null; for (const p of X.PAY) { if (F.payer !== 'ALL' && F.payer !== p[0]) continue; const c = X.compute(ms, { ...F, payer: p[0] }); if (c.billed > 0 && (!wp || c.denialPct > wp.c.denialPct)) wp = { p, c }; }
    if (wp) out.push([wp.c.denialPct > 0.04 ? 'serious' : 'warn', `<b>${esc(wp.p[1])}</b> has the highest denial rate at ${pct(wp.c.denialPct * 100, 1)} with ${num(wp.c.arDays, 0)} days in A/R.`]);
    out.push([cur.lostStaffPct > 0.07 ? 'serious' : 'info', `<b>${num(cur.lostStaff, 0)} referrals (${pct(cur.lostStaffPct * 100, 1)}) were turned away because no caregiver was available</b>; days to start of care averaged ${num(cur.daysToStart, 1)}.`]);
    const ICON = { crit: '!', serious: '!', warn: '~', info: 'i', good: '✓' };
    return `<ul class="alerts">${out.map(([l, t]) => `<li><span class="ico st-${l}" aria-hidden="true">${ICON[l]}</span><div>${t}</div></li>`).join('')}</ul>`;
  }
  /* --------- sections --------- */
  const card = (t, n, b, ctl) => V2.card(t, n, b, ctl);
  function overview(cur, prev) {
    const ms = cur.months, f = F;
    const auth = ms.map(m => { const c = X.compute([m], f); return [X.mX(m), c.auth]; }), del = ms.map(m => { const c = X.compute([m], f); return [X.mX(m), c.deliv]; });
    const chart = C.line({ series: [{ name: 'Authorized hours', pts: auth, color: 'var(--ink-2)', width: 2, dash: '5 4' }, { name: 'Delivered hours', pts: del, color: 'var(--s1)', width: 2.4, area: true }], h: 250, yFmt: v => K.big(v, 0), tipFmt: v => num(v, 0) + ' hrs', tipX: x => X.mLab(X.MONTHS.find(m => Math.abs(X.mX(m) - x) < 0.01) || X.MONTHS[0]), x0: X.mX(ms[0]) - 0.02, x1: X.mX(ms[ms.length - 1]) + 0.02, xFmt: x => { const m = X.MONTHS.find(mm => Math.abs(X.mX(mm) - x) < 0.01); return m ? X.mShort(m) : ''; }, xTicks: ms.filter((m, i) => ms.length <= 6 || i % Math.ceil(ms.length / 6) === 0).map(X.mX), aria: 'Authorized vs delivered hours' });
    return `<section id="overview">${V2.sec('Overview', `${esc(fLabel())} · ${X.mLab(ms[0])} – ${X.mLab(ms[ms.length - 1])}. Each tile compares with the previous period of the same length and with its target.`)}
      <div class="tiles t4">${X.KPI.map(d => kpiTile(d, cur, prev)).join('')}</div>
      <div class="grid g-7-5" style="margin-top:14px">${card('Authorized vs delivered hours', 'The space between the lines is care clients were approved for that did not happen.', chart)}${card('What needs attention', 'Generated from the filtered data.', insights(cur))}</div></section>`;
  }
  function staffing(cur) {
    const ms = cur.months;
    const byShift = X.SHF.map(s => { const c = X.compute(ms, { ...F, shift: s[0] }); return { label: s[1], y: c.fill * 100, color: c.fill >= 0.92 ? 'var(--s1)' : 'var(--s2)', auth: c.auth }; }).filter(d => d.auth > 0);
    const shiftBars = C.bars({ items: byShift, h: 230, y0: 60, y1: 100, yFmt: v => num(v, 0) + '%', name: 'Fill rate', hlines: [{ y: 92, label: 'Target 92%', color: 'var(--ink-2)' }], valueLabels: true, aria: 'Fill rate by shift' });
    // office x shift heat table
    const rows = X.OFF.filter(o => F.office === 'ALL' || F.office === o[0]).map(o => { const r = { name: o[1] }; for (const s of X.SHF) { const c = X.compute(ms, { ...F, office: o[0], shift: s[0] }); r[s[0]] = c.auth ? c.fill * 100 : null; } const t = X.compute(ms, { ...F, office: o[0] }); r.all = t.fill * 100; r.unf = t.unbilled; return r; });
    const heat = T.html({ cols: [{ k: 'name', lab: 'Office' }].concat(X.SHF.map(s => ({ k: s[0], lab: s[1], num: true, good: 1, fmt: v => pct(v, 1) }))).concat([{ k: 'all', lab: 'All shifts', num: true, good: 1, fmt: v => pct(v, 1) }, { k: 'unf', lab: 'Unbilled revenue', num: true, good: -1, fmt: v => money(v) }]), rows, sort: { k: 'all', dir: 1 }, search: false, views: ['heat', 'table'], view: 'heat', limit: 10 });
    const trend = C.line({ series: [{ name: 'Fill rate', pts: X.series(F, 'fill').map(p => [p[0], p[1] * 100]), color: 'var(--s1)', width: 2.2, dots: true }], h: 230, y0: 75, y1: 100, hlines: [{ y: 92, label: 'Target', color: 'var(--ink-2)' }], yFmt: v => num(v, 0) + '%', tipFmt: v => pct(v, 1), tipX: x => X.mLab(X.MONTHS[Math.round((x - 2024.75) * 12)] || X.MONTHS[0]), aria: 'Fill rate trend' });
    const svc = X.SRV.map(s => { const c = X.compute(ms, { ...F, service: s[0] }); return c.auth ? { name: s[1], v: c.unbilled, color: 'var(--s2)' } : null; }).filter(Boolean);
    return `<section id="staffing">${V2.sec('Staffing & hours', 'Where authorized hours go unstaffed, by shift, office and service.')}
      <div class="grid g2">${card('Fill rate by shift', 'Evenings and weekends are hardest to staff.', shiftBars)}${card('Fill rate trend, all 24 months', 'December holidays and the 2024–25 PathWays transition show as dips.', trend)}</div>
      <div class="grid g-7-5" style="margin-top:14px">${card('Fill rate: office × shift', 'Heat map: blue is above the median cell, red below.', heat)}${card('Unbilled revenue by service', 'Unfilled hours valued at each service\'s billed rate.', C.hbars(svc, { lo: 0, fmt: v => money(v) }))}</div></section>`;
  }
  function workforce(cur) {
    const offs = X.OFF.filter(o => F.office === 'ALL' || F.office === o[0]);
    const turn = C.line({ series: offs.map((o, i) => ({ name: o[1], pts: X.series({ ...F, office: o[0] }, 'turnover', X.MONTHS, 3).map(p => [p[0], p[1] * 100]), color: C.PAL[i], width: 2 })), h: 250, endLabels: true, yFmt: v => num(v, 0) + '%', tipFmt: v => pct(v, 0), vlines: [{ x: 2026.25, label: 'Greenfield mentor pilot' }], tipX: x => X.mLab(X.MONTHS[Math.round((x - 2024.75) * 12)] || X.MONTHS[0]), aria: 'Turnover by office' });
    const early = C.line({ series: offs.map((o, i) => ({ name: o[1], pts: X.series({ ...F, office: o[0] }, 'early90', X.MONTHS, 3).map(p => [p[0], p[1] * 100]), color: C.PAL[i], width: 2 })), h: 250, endLabels: true, y0: 0, yFmt: v => num(v, 0) + '%', tipFmt: v => pct(v, 0), hlines: [{ y: 40, label: 'Target ≤ 40%' }], vlines: [{ x: 2026.25, label: 'Pilot' }], tipX: x => X.mLab(X.MONTHS[Math.round((x - 2024.75) * 12)] || X.MONTHS[0]), aria: 'Early exits by office' });
    const hires = C.line({ series: [{ name: 'Hires', pts: X.series(F, 'hires'), color: 'var(--s3)', width: 2 }, { name: 'Separations', pts: X.series(F, 'terms'), color: 'var(--s2)', width: 2 }], h: 220, yFmt: v => num(v, 0), tipX: x => X.mLab(X.MONTHS[Math.round((x - 2024.75) * 12)] || X.MONTHS[0]), aria: 'Hires vs separations' });
    return `<section id="workforce">${V2.sec('Workforce', 'Caregivers are the capacity. Uses the office filter; caregivers are not split by payer, service or shift.')}
      <div class="tiles t4">${V2.tile({ lab: 'Average caregivers', val: num(cur.headcount, 0) })}${V2.tile({ lab: 'Applicants per hire', val: num(cur.appsPerHire, 1) })}${V2.tile({ lab: 'Days to hire', val: num(cur.daysToHire, 1), sub: 'Application to first shift' })}${V2.tile({ lab: 'Overtime share', val: pct(cur.overtime * 100, 1), sub: 'of delivered hours' })}</div>
      <div class="grid g2" style="margin-top:14px">${card('Caregiver turnover, annualized', '3-month rolling: separations ÷ average headcount, annualized.', turn)}${card('Share of exits within 90 days', '3-month rolling. Greenfield started a 90-day mentor program in April 2026.', early)}</div>
      <div style="margin-top:14px">${card('Hires vs separations each month', 'Hiring has to outrun separations to grow capacity.', hires)}</div></section>`;
  }
  function revenue(cur) {
    const ms = cur.months;
    const pays = X.PAY.filter(p => F.payer === 'ALL' || F.payer === p[0]);
    const rev = C.line({ series: [{ name: 'Billed revenue', pts: X.series(F, 'billed'), color: 'var(--s1)', width: 2.2, area: true }], h: 230, yFmt: v => '$' + K.big(v, 1), tipFmt: v => money(v), tipX: x => X.mLab(X.MONTHS[Math.round((x - 2024.75) * 12)] || X.MONTHS[0]), aria: 'Billed revenue' });
    const den = C.line({ series: pays.map((p, i) => ({ name: p[1].replace(' (Medicaid managed LTSS)', ''), pts: X.series({ ...F, payer: p[0] }, 'denialPct').map(q => [q[0], q[1] * 100]), color: C.PAL[i], width: 1.8 })), h: 250, y0: 0, hlines: [{ y: 3, label: 'Target ≤ 3%' }], yFmt: v => num(v, 0) + '%', tipFmt: v => pct(v, 1), tipX: x => X.mLab(X.MONTHS[Math.round((x - 2024.75) * 12)] || X.MONTHS[0]), aria: 'Denial rate by payer' });
    const ar = pays.map((p, i) => { const c = X.compute(ms, { ...F, payer: p[0] }); return { name: p[1].replace(' (Medicaid managed LTSS)', ''), v: c.arDays, color: c.arDays > 40 ? 'var(--s2)' : 'var(--s1)' }; });
    const mix = pays.map(p => { const c = X.compute(ms, { ...F, payer: p[0] }); return { name: p[1].replace(' (Medicaid managed LTSS)', ''), v: c.billed, color: 'var(--s1)' }; });
    return `<section id="revenue">${V2.sec('Revenue cycle', 'Getting paid for the care delivered. A/R uses the payer filter only.')}
      <div class="tiles t4">${V2.tile({ lab: 'Billed revenue', val: money(cur.billed), sub: `${money(cur.revPerHr, 2)} per delivered hour` })}${V2.tile({ lab: 'Direct labor share', val: pct(cur.laborPct * 100, 1), sub: 'of billed revenue' })}${V2.tile({ lab: 'A/R balance (latest month)', val: money(cur.arBalance) })}${V2.tile({ lab: 'A/R over 90 days', val: pct(cur.ar90 * 100, 1) })}</div>
      <div class="grid g2" style="margin-top:14px">${card('Billed revenue by month', '', rev)}${card('Denial rate by payer', 'PathWays denials were high after the 2024 managed-care transition and have come down.', den)}</div>
      <div class="grid g2" style="margin-top:14px">${card('Days in A/R by payer', 'Latest month. Orange is above the 40-day target.', C.hbars(ar, { lo: 0, fmt: v => num(v, 0) + ' days' }))}${card('Revenue by payer', 'Billed in the selected period.', C.hbars(mix, { lo: 0, fmt: v => money(v) }))}</div></section>`;
  }
  function growth(cur) {
    const ms = cur.months;
    const funnel = [{ name: 'Referrals received', v: cur.referrals, color: 'var(--ink-2)' }, { name: 'Admitted', v: cur.admissions, color: 'var(--s1)' }, { name: 'Lost: no caregiver', v: cur.lostStaff, color: 'var(--s2)' }, { name: 'Lost: other reasons', v: cur.lostOther, color: 'var(--s4)' }];
    const offs = X.OFF.filter(o => F.office === 'ALL' || F.office === o[0]);
    const lost = offs.map(o => { const c = X.compute(ms, { ...F, office: o[0] }); return { name: o[1], v: c.lostStaffPct * 100, color: c.lostStaffPct > 0.05 ? 'var(--s2)' : 'var(--s1)' }; });
    const sat = C.line({ series: offs.map((o, i) => ({ name: o[1], pts: X.series({ ...F, office: o[0] }, 'satisfaction', X.MONTHS, 3).map(p => [p[0], p[1] * 100]), color: C.PAL[i], width: 1.8 })), h: 240, endLabels: true, hlines: [{ y: 85, label: 'Target 85%' }], yFmt: v => num(v, 0) + '%', tipFmt: v => pct(v, 1), tipX: x => X.mLab(X.MONTHS[Math.round((x - 2024.75) * 12)] || X.MONTHS[0]), aria: 'Client satisfaction' });
    const dts = C.line({ series: [{ name: 'Days to start of care', pts: X.series(F, 'daysToStart'), color: 'var(--s1)', width: 2, dots: true }], h: 240, y0: 0, hlines: [{ y: 5, label: 'Target ≤ 5 days' }], yFmt: v => num(v, 0), tipFmt: v => num(v, 1) + ' days', tipX: x => X.mLab(X.MONTHS[Math.round((x - 2024.75) * 12)] || X.MONTHS[0]), aria: 'Days to start of care' });
    return `<section id="growth">${V2.sec('Growth & quality', 'Referrals turn into revenue only when a caregiver is available; quality keeps referral sources sending them.')}
      <div class="grid g2">${card('What happened to referrals', 'Uses office and payer filters.', C.hbars(funnel, { lo: 0, fmt: v => num(v, 0) }))}${card('Referrals lost for lack of a caregiver', 'Share of referrals, by office.', C.hbars(lost, { lo: 0, fmt: v => pct(v, 1) }))}</div>
      <div class="grid g2" style="margin-top:14px">${card('Days from referral to first visit', '', dts)}${card('Client satisfaction (9–10 out of 10)', '3-month rolling.', sat)}</div>
      <div class="tiles t4" style="margin-top:14px">${V2.tile({ lab: 'Active clients (latest month)', val: num(cur.activeClients, 0) })}${V2.tile({ lab: 'Medicare hospitalization rate', val: pct(cur.hospRate * 100, 1), sub: 'CMS comparison average ≈ 14%' })}${V2.tile({ lab: 'Medicare ER visits (no admission)', val: pct(cur.edRate * 100, 1), sub: 'CMS comparison average ≈ 13%' })}${V2.tile({ lab: 'Incidents per 10,000 hours', val: num(cur.incidents10k, 1), sub: `Complaints: ${num(cur.complaints10k, 1)} per 10,000 hours` })}</div></section>`;
  }
  function scorecard(cur) {
    const ms = cur.months;
    const rows = X.OFF.map(o => { const c = X.compute(ms, { ...F, office: o[0] }); return { name: o[1], fill: c.fill * 100, missed: c.missedPct * 100, evv: c.evvPct * 100, turn: c.turnover * 100, early: c.early90 * 100, admit: c.admitRate * 100, dts: c.daysToStart, margin: c.marginHr, sat: c.satisfaction * 100, unb: c.unbilled }; });
    const col = (k, lab, good, fmt) => ({ k, lab, num: true, good, fmt });
    return `<section id="scorecard">${V2.sec('Office scorecard', 'Every office on the same KPIs for the selected period and payer, service and shift filters. Switch to Table to sort.')}
      ${T.html({ cols: [{ k: 'name', lab: 'Office' }, col('fill', 'Fill rate', 1, v => pct(v, 1)), col('missed', 'Missed visits', -1, v => pct(v, 1)), col('evv', 'EVV', 1, v => pct(v, 1)), col('turn', 'Turnover', -1, v => pct(v, 0)), col('early', '90-day exits', -1, v => pct(v, 0)), col('admit', 'Admit rate', 1, v => pct(v, 1)), col('dts', 'Days to start', -1, v => num(v, 1)), col('margin', 'Margin/hr', 1, v => money(v, 2)), col('sat', 'Satisfaction', 1, v => pct(v, 1)), col('unb', 'Unbilled revenue', -1, v => money(v))], rows, sort: { k: 'fill', dir: -1 }, search: false, views: ['heat', 'table', 'chart'], view: 'heat', limit: 10 })}</section>`;
  }
  /* --------- what-if --------- */
  function whatifOut(cur) {
    const yrF = 12 / cur.months.length;
    const target = WI.fill / 100, addHours = Math.max(0, (target - cur.fill) * cur.auth) * yrF;
    const rate = cur.deliv ? cur.billed / cur.deliv : 0, marginHr = cur.marginHr || 0;
    const earlyCut = WI.early / 100, keep = cur.terms * cur.early90 * earlyCut * yrF;
    const hireCost = 2500;   // assumption: recruiting, onboarding and training cost per replaced caregiver
    const denCut = Math.max(0, cur.denialPct - WI.denial / 100) * cur.billed * yrF;
    return `<div class="out two">${V2.tile({ hero: true, lab: 'Extra revenue a year from filling more hours', val: money(addHours * rate), sub: `${num(addHours, 0)} more care hours a year · about ${money(addHours * marginHr)} gross margin` })}${V2.tile({ lab: 'Caregivers kept a year', val: num(keep, 0), sub: `≈ ${money(keep * hireCost)} in replacement cost avoided (assumes $2,500 per hire)` })}${V2.tile({ lab: 'Revenue protected from denials', val: money(denCut), sub: `Denial rate ${pct(cur.denialPct * 100, 1)} → ${pct(WI.denial, 1)}` })}</div>`;
  }
  function whatif(cur) {
    if (WI.fill == null) WI.fill = Math.min(97, Math.max(+(cur.fill * 100 + 3).toFixed(1), 92));
    const sl = (k, lab, v, min, max, step, fmt, hint) => `<div class="ctrl"><label for="wi-${k}">${esc(lab)} <output id="wo-${k}">${fmt(v)}</output></label><input id="wi-${k}" type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-wi="${k}"><span class="hint">${esc(hint)}</span></div>`;
    return `<section id="whatif">${V2.sec('What-if', 'Set a goal and see what it is worth a year, using the filtered data as the baseline.')}
      <div class="grid g-7-5"><section class="card"><div class="ctrls">${sl('fill', 'Raise the hours fill rate to', WI.fill, 80, 99, 0.5, v => num(v, 1) + '%', `Today ${pct(cur.fill * 100, 1)}`)}${sl('early', 'Cut early (90-day) exits by', WI.early, 0, 60, 5, v => v + '%', 'Mentoring and onboarding programs')}${sl('denial', 'Bring the denial rate down to', WI.denial, 0.5, 8, 0.1, v => num(v, 1) + '%', `Today ${pct(cur.denialPct * 100, 1)}`)}</div></section><div id="wiOut">${whatifOut(cur)}</div></div></section>`;
  }
  function dictionary() {
    const rows = X.KPI.map(d => `<tr><td>${esc(d.lab)}</td><td>${esc(d.grp)}</td><td style="white-space:normal;min-width:260px;text-align:left">${esc(d.def)}</td><td>${d.tgt != null ? (d.dir > 0 ? '≥ ' : '≤ ') + esc(d.fmt(d.tgt)) : '–'}</td><td>${esc(d.src)}</td><td>${esc(d.filt)}</td></tr>`).join('');
    return `<section id="dictionary">${V2.sec('KPI dictionary', 'One definition per metric, so every report means the same thing. Targets are typical operating goals and can be adjusted.')}<div class="tbl-wrap"><table class="tbl"><thead><tr><th>KPI</th><th>Area</th><th style="text-align:left">Definition</th><th>Target</th><th>Source system</th><th>Filters that apply</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  let CUR = null;
  function render() {
    const ms = X.months(F.period), pm = X.priorMonths(F.period);
    const cur = X.compute(ms, F), prev = pm.length ? X.compute(pm, F) : null;
    CUR = cur;
    const main = $('#main'), y = scrollY;
    main.innerHTML = overview(cur, prev) + staffing(cur) + workforce(cur) + revenue(cur) + growth(cur) + scorecard(cur) + whatif(cur) + dictionary();
    C.mount(main); C.gc(); T.gc();
    scrollTo(0, y);
  }
  function bind() {
    document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.f; if (k) { F[k] = e.target.value; WI.fill = null; render(); } });
    document.addEventListener('click', e => { if (e.target.id === 'resetF') { Object.assign(F, { period: '12', office: 'ALL', payer: 'ALL', service: 'ALL', shift: 'ALL' }); WI.fill = null; filters(); render(); } });
    document.addEventListener('input', e => {
      const k = e.target.dataset && e.target.dataset.wi; if (!k) return;
      WI[k] = +e.target.value;
      $('#wo-' + k).textContent = k === 'early' ? WI[k] + '%' : num(WI[k], 1) + '%';
      $('#wiOut').innerHTML = whatifOut(CUR);
    });
  }
  function start() { X.theme(); C.init(); T.init(); filters(); bind(); render(); }
  return { start, F };
})();

/* small view helpers shared with the case study */
const V2 = {
  sec: (t, p) => `<div class="sec-h"><div><h2>${K.esc(t)}</h2>${p ? `<p>${p}</p>` : ''}</div></div>`,
  card: (t, n, b, ctl) => `<section class="card"><div class="head"><div><h3>${K.esc(t)}</h3>${n ? `<div class="note">${n}</div>` : ''}</div>${ctl ? `<div class="ctl">${ctl}</div>` : ''}</div>${b}</section>`,
  tile: o => `<div class="tile${o.hero ? ' hero' : ''}"><span class="lab">${K.esc(o.lab)}</span><span class="val">${o.val}${o.unit ? `<small>${K.esc(o.unit)}</small>` : ''}</span>${o.sub ? `<span class="sub">${o.sub}</span>` : ''}</div>`
};
