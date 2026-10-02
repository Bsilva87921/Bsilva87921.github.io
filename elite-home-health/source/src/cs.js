/* Case study: Closing the Hours Gap (every number is computed from the same data as the dashboard). */
const CS = (() => {
  const { esc, ok, num, pct, money, sgn } = K;
  const ALL = { period: '12', office: 'ALL', payer: 'ALL', service: 'ALL', shift: 'ALL' };
  const sqlBox = (key, title) => { const q = (window.ELITE_SQL || {})[key]; return q ? `<details><summary>SQL · ${esc(title)} (sql/${esc(key)}.sql)</summary><pre>${esc(q.trim())}</pre></details>` : ''; };
  const fig = (body, cap) => `<div class="fig">${body}<div class="figcap">${cap}</div></div>`;
  const sumRows = (rows, k) => rows.reduce((s, r) => s + r[k], 0);

  function analyze() {
    const L12 = X.months('12'), set = new Set(L12);
    const c = X.compute(L12, ALL);
    const shift = Object.fromEntries(X.SHF.map(s => [s[0], X.compute(L12, { ...ALL, shift: s[0] })]));
    const office = Object.fromEntries(X.OFF.map(o => [o[0], X.compute(L12, { ...ALL, office: o[0] })]));
    const offHours = shift.EVE.unfilled + shift.WKD.unfilled;
    // regression on office-months: fill rate ~ early-turnover rate + office effects
    const ys = [], xs = [], pts = [];
    for (const w of X.WF) {
      const sv = X.SV.filter(r => r.month === w.month && r.office === w.office);
      const fill = sumRows(sv, 'delivered_hours') / sumRows(sv, 'authorized_hours') * 100, early = w.terms_90d * 1200 / w.headcount;
      ys.push(fill); xs.push([early, w.office === 'GRN' ? 1 : 0, w.office === 'KOK' ? 1 : 0, w.office === 'RUR' ? 1 : 0]);
      pts.push({ x: early, y: fill, office: w.office, month: w.month });
    }
    const reg = S.ols(ys, xs, { robust: true });
    const rCorr = S.corr(pts.map(p => p.x), pts.map(p => p.y));
    // difference-in-differences: Greenfield pilot (Apr 2026) vs the other offices, six months before and after
    const pre = X.MONTHS.filter(m => m >= '2025-10' && m <= '2026-03'), post = X.MONTHS.filter(m => m >= '2026-04');
    const grp = (offices, ms) => { const s = new Set(ms), sv = X.SV.filter(r => s.has(r.month) && offices.includes(r.office)), wf = X.WF.filter(r => s.has(r.month) && offices.includes(r.office)); return { fill: sumRows(sv, 'delivered_hours') / sumRows(sv, 'authorized_hours'), early: sumRows(wf, 'terms_90d') * 12 / (sumRows(wf, 'headcount')), auth: sumRows(sv, 'authorized_hours'), hires: sumRows(wf, 'hires'), t90: sumRows(wf, 'terms_90d') }; };
    const others = ['BED', 'KOK', 'RUR'];
    const P0 = grp(['GRN'], pre), P1 = grp(['GRN'], post), O0 = grp(others, pre), O1 = grp(others, post);
    const didFill = (P1.fill - P0.fill) - (O1.fill - O0.fill), didEarly = (P1.early - P0.early) - (O1.early - O0.early);
    const relEarly = (P1.early / P0.early) / (O1.early / O0.early) - 1;
    const O12 = grp(others, L12);
    const rate = c.billed / c.deliv, margin = c.marginHr;
    const clientMonths = sumRows(X.RF.filter(r => set.has(r.month)), 'active_clients');
    const revClientMonth = c.billed / clientMonths;
    const rural = office.RUR, nonRural = X.compute(L12, { ...ALL }); // network
    const restLost = (c.lostStaff - rural.lostStaff) / (c.referrals - rural.referrals);
    return { L12, c, shift, office, offHours, reg, rCorr, pts, P0, P1, O0, O1, didFill, didEarly, relEarly, O12, rate, margin, revClientMonth, rural, restLost };
  }

  function render() {
    const A = analyze(), c = A.c, L = A.L12;
    const per10 = A.reg.b[1] * 10, se10 = A.reg.se[1] * 10;
    const weekendGap = A.shift.DAY.fill - A.shift.WKD.fill;
    // ---- recommendation math ----
    const r1 = { lo: 0.5 * A.didFill, hi: A.didFill };
    r1.hoursLo = A.O12.auth * r1.lo; r1.hoursHi = A.O12.auth * r1.hi;
    r1.revLo = r1.hoursLo * A.rate; r1.revHi = r1.hoursHi * A.rate;
    r1.cost = A.O12.hires * 250 + 55000;
    r1.exits = A.O12.t90 * Math.abs(A.relEarly);
    r1.replace = r1.exits * 2500;
    const U = A.offHours;
    const r2 = { hLo: U / 3, hHi: U / 2 };
    r2.revLo = r2.hLo * A.rate; r2.revHi = r2.hHi * A.rate;
    r2.netLo = r2.hLo * (A.margin - 3); r2.netHi = r2.hHi * (A.margin - 3);
    r2.blanket = 2 * (A.shift.EVE.deliv + A.shift.WKD.deliv);
    const ruralLost = A.rural.lostStaff, r3 = { admits: ruralLost / 2 };
    r3.revLo = r3.admits * A.revClientMonth * 4; r3.revHi = r3.admits * A.revClientMonth * 8;
    const denialGain = Math.max(0, c.denialPct - 0.025) * c.billed;
    const vaNow = X.compute(L, { ...ALL, payer: 'VAC' }), vaDaily = vaNow.billed / 365;
    const vaCash = (vaNow.arDays - 45) * vaDaily;
    const totLo = r1.revLo + r2.revLo + r3.revLo, totHi = r1.revHi + r2.revHi + r3.revHi;

    // ---- figures ----
    const monthsAll = X.MONTHS;
    const f1 = C.line({ series: [{ name: 'Authorized hours', pts: monthsAll.map(m => [X.mX(m), X.compute([m], ALL).auth]), color: 'var(--ink-2)', width: 2, dash: '5 4' }, { name: 'Delivered hours', pts: monthsAll.map(m => [X.mX(m), X.compute([m], ALL).deliv]), color: 'var(--s1)', width: 2.4, area: true }], h: 240, yFmt: v => K.big(v, 0), tipFmt: v => num(v, 0) + ' hrs', tipX: x => X.mLab(X.MONTHS[Math.round((x - 2024.75) * 12)]), aria: 'Authorized vs delivered hours' });
    const heatRows = X.OFF.map(o => { const r = { name: o[1] }; for (const s of X.SHF) r[s[0]] = X.compute(L, { ...ALL, office: o[0], shift: s[0] }).fill * 100; r.all = A.office[o[0]].fill * 100; r.unb = A.office[o[0]].unbilled; return r; });
    const f2 = T.html({ cols: [{ k: 'name', lab: 'Office' }].concat(X.SHF.map(s => ({ k: s[0], lab: s[1], num: true, good: 1, fmt: v => pct(v, 1) }))).concat([{ k: 'all', lab: 'All shifts', num: true, good: 1, fmt: v => pct(v, 1) }, { k: 'unb', lab: 'Unbilled revenue', num: true, good: -1, fmt: v => money(v) }]), rows: heatRows, sort: { k: 'all', dir: -1 }, search: false, views: ['heat', 'table'], view: 'heat', limit: 10 });
    const OC = { BED: 'var(--s1)', GRN: 'var(--s2)', KOK: 'var(--s3)', RUR: 'var(--s7)' };
    const f3 = C.scatter({ pts: A.pts.map(p => ({ x: p.x, y: p.y, color: OC[p.office], r: 4.5, name: X.name(X.OFF, p.office) + ', ' + X.mLab(p.month) })), h: 300, fit: { b0: S.mean(A.pts.map(p => p.y)) - A.reg.b[1] * S.mean(A.pts.map(p => p.x)), b1: A.reg.b[1] }, xLab: '90-day exits (annualized, % of caregivers)', yLab: 'Fill rate (%)', xFmt: v => num(v, 0), yFmt: v => num(v, 0), tip: p => `<b>${esc(p.name)}</b>${K.tipRow(p.color, 'Early-exit rate', pct(p.x, 1))}${K.tipRow(null, 'Fill rate', pct(p.y, 1))}`, legendItems: X.OFF.map(o => ({ name: o[1], color: OC[o[0]], kind: 'sq' })), aria: 'Early turnover vs fill rate' });
    const early = offs => X.MONTHS.slice(2).map(m => { const i = X.MONTHS.indexOf(m), ms = new Set(X.MONTHS.slice(i - 2, i + 1)); const wf = X.WF.filter(r => ms.has(r.month) && offs.includes(r.office)); return [X.mX(m), sumRows(wf, 'terms_90d') * 12 / sumRows(wf, 'headcount') * 100]; });
    const f4 = C.line({ series: [{ name: 'Greenfield (pilot)', pts: early(['GRN']), color: 'var(--s2)', width: 2.4 }, { name: 'Other offices', pts: early(['BED', 'KOK', 'RUR']), color: 'var(--s1)', width: 2 }], h: 240, y0: 0, vlines: [{ x: 2026.25, label: 'Mentor program starts' }], yFmt: v => num(v, 0) + '%', tipFmt: v => pct(v, 1), tipX: x => X.mLab(X.MONTHS[Math.round((x - 2024.75) * 12)]), aria: 'Early exits: pilot vs others' });
    const f5 = C.hbars(X.OFF.map(o => ({ name: o[1], v: A.office[o[0]].lostStaffPct * 100, color: o[0] === 'RUR' ? 'var(--s2)' : 'var(--s1)' })), { lo: 0, fmt: v => pct(v, 1) });
    const recTbl = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Recommendation</th><th>Revenue a year</th><th>Also</th><th>Cost</th></tr></thead><tbody>
      <tr><td>1. Mentor program</td><td>${money(r1.revLo)} – ${money(r1.revHi)}</td><td>${num(r1.exits, 0)} fewer early exits</td><td>≈ ${money(r1.cost)}</td></tr>
      <tr><td>2. Open-shift incentive</td><td>${money(r2.revLo)} – ${money(r2.revHi)}</td><td>+${money(r2.netLo)}–${money(r2.netHi)} margin</td><td>$3 per hour filled</td></tr>
      <tr><td>3. Rural recruiting</td><td>${money(r3.revLo)} – ${money(r3.revHi)}</td><td>${num(r3.admits, 0)} more admissions</td><td>Mileage, recruiting</td></tr>
      <tr><td><b>Total</b></td><td><b>${money(totLo)} – ${money(totHi)}</b></td><td></td><td></td></tr></tbody></table></div>`;

    $html(`
    <p class="meta">Bruno Silva · ${esc(X.mLab(L[0]))} – ${esc(X.mLab(L[L.length - 1]))} data · Interactive version of every chart in the <a href="index.html">dashboard</a></p>
    <div class="tldr"><p><b>Summary for a busy reader.</b></p>
      <p>Over the last 12 months the agency delivered <b>${pct(c.fill * 100, 1)}</b> of the care hours its clients were authorized for. The other ${num(c.unfilled, 0)} hours were <b>${money(c.unbilled)} of revenue</b> it had already won but could not staff, and ${num(c.lostStaff, 0)} referrals were turned away for lack of a caregiver.</p>
      <p>The gap is concentrated in <b>evenings, weekends and rural counties</b>, and it tracks one thing more than anything else: <b>caregivers leaving in their first 90 days</b>. When Greenfield added a 90-day mentor program, its early exits fell about ${pct(Math.abs(A.relEarly) * 100, 0)} relative to the other offices, and its fill rate rose ${num(A.didFill * 100, 1)} points more.</p>
      <p>Three changes would close most of the gap: scale the mentor program, pay a targeted incentive only on hard-to-fill open shifts, and recruit caregivers where rural clients live. Together they are worth <b>${money(totLo)} – ${money(totHi)} a year</b> in revenue.</p></div>

    <h2>1. The business question</h2>
    <p class="lede">In home care, demand is not the hard part; staffing is. A client's Medicaid waiver, managed-care plan, VA or private-pay agreement authorizes a set number of hours. Every authorized hour that is not staffed is care a client goes without, revenue the agency never bills, and a reason for a case manager to refer the next client elsewhere.</p>
    <p>So the question a strategic operations analyst should own is: <b>how many authorized hours are we failing to deliver, where, why, and what would it take to deliver them?</b></p>

    <h2>2. Data and approach</h2>
    <p>I built a SQLite database with the five feeds an agency already has: scheduling and EVV (hours authorized, scheduled, delivered, missed and verified, by office, payer, service and shift), payroll and HR (headcount, hires, separations, 90-day exits, overtime), intake (referrals, admissions, reasons lost, days to start of care), billing (billed, denied, A/R by payer) and quality (client surveys, incidents, Medicare hospitalizations). It covers 24 months, 4 offices, 5 payers, 3 service lines and 3 shift types.</p>
    <p><b>About the data:</b> Elite's internal data is not public, so this is an illustrative sample I generated to behave like an Indiana agency of Elite's size (about ${num(Math.round(c.headcount / 10) * 10, 0)} caregivers and $${num(c.billed / 1e6, 0)} million a year in billing). It uses current Indiana payers, including PathWays for Aging, and CMS benchmarks for Medicare quality. The method, SQL and dashboard are built to run on real exports.</p>
    <p>The analysis follows the steps a manager would ask for: size the gap, find where it lives, test what drives it, check whether a fix already works, and price the options.</p>

    <h2>3. Findings</h2>
    <h3>Finding 1: about one hour in ten that clients are authorized for goes unstaffed</h3>
    <p>${pct(c.fill * 100, 1)} of authorized hours were delivered in the last 12 months, against a 92% goal. The gap has narrowed since the PathWays transition in late 2024, but at today's rates it is still worth <b>${money(c.unbilled)} a year</b>.</p>
    ${fig(f1, 'Authorized vs delivered hours by month. The space between the lines is unstaffed care.')}
    ${sqlBox('01_hours_gap_overview', 'size of the gap by year')}

    <h3>Finding 2: the gap lives in evenings, weekends and rural counties</h3>
    <p>Weekday daytime shifts are ${pct(A.shift.DAY.fill * 100, 1)} filled; weekends are ${pct(A.shift.WKD.fill * 100, 1)}, a ${num(weekendGap * 100, 1)}-point gap. Evenings and weekends hold ${pct((A.shift.EVE.auth + A.shift.WKD.auth) / c.auth * 100, 0)} of authorized hours but <b>${pct(A.offHours / c.unfilled * 100, 0)} of the unstaffed ones</b>. Rural statewide coverage fills ${pct(A.rural.fill * 100, 1)} of its hours, and on rural weekends the fill rate drops to ${pct(X.compute(L, { ...ALL, office: 'RUR', shift: 'WKD' }).fill * 100, 1)}.</p>
    ${fig(f2, 'Fill rate by office and shift, last 12 months. Blue is better than the median cell, red is worse.')}
    ${sqlBox('02_gap_by_shift_and_office', 'fill rate by office and shift')}

    <h3>Finding 3: early caregiver turnover is the strongest driver</h3>
    <p>Across ${A.pts.length} office-months, offices lose more hours in the months they lose more new caregivers. Holding office differences constant, every 10 more early exits per 100 caregivers (annualized) goes with a <b>${num(Math.abs(per10), 1)}-point lower fill rate</b> (±${num(1.96 * se10, 1)}, 95% confidence; correlation ${num(A.rCorr, 2)}). Turnover overall is ${pct(c.turnover * 100, 0)} a year, and <b>${pct(c.early90 * 100, 0)} of the caregivers who leave do so within 90 days</b>, before they are fully productive.</p>
    <p>This echoes something I found at JPMorgan Chase: when average handle time rose, the cause was a wave of associates in their first six months, and targeted coaching for that group cut handle time by 30 seconds and saved about $20 million. In home care the new-hire effect shows up as unstaffed hours instead of handle time.</p>
    ${fig(f3, 'Each dot is one office in one month. Dashed line: regression slope after controlling for office.')}
    ${sqlBox('03_turnover_vs_fill', 'office-month turnover and fill rate')}

    <h3>Finding 4: the fix is already working in Greenfield</h3>
    <p>Greenfield started pairing every new caregiver with an experienced mentor for their first 90 days in April 2026. Comparing the six months before and after with the other three offices (a difference-in-differences), Greenfield's early-exit rate fell from ${pct(A.P0.early * 100, 1)} to ${pct(A.P1.early * 100, 1)} while the others moved from ${pct(A.O0.early * 100, 1)} to ${pct(A.O1.early * 100, 1)}. That is about <b>${pct(Math.abs(A.relEarly) * 100, 0)} fewer early exits</b> than the trend would predict, and Greenfield's fill rate rose <b>${num(A.didFill * 100, 1)} points more</b> than the others'.</p>
    ${fig(f4, 'Annualized 90-day exits, 3-month rolling average. Greenfield vs the other offices.')}
    ${sqlBox('04_mentor_pilot_did', 'difference-in-differences')}
    <p>Six months of one office is early evidence, not proof: Greenfield may differ in ways the comparison misses. That is why the first recommendation below rolls the program out in a way that keeps measuring it.</p>

    <h3>Finding 5: the gap costs growth, not just revenue</h3>
    <p>${pct(c.lostStaffPct * 100, 1)} of referrals were turned away because no caregiver was available. In rural statewide coverage it was <b>${pct(A.rural.lostStaffPct * 100, 1)}</b>, against ${pct(A.restLost * 100, 1)} elsewhere, and days to start of care were ${num(A.rural.daysToStart, 1)} versus ${num(c.daysToStart, 1)} across the agency. Referral sources notice: an agency that says no twice stops getting the call.</p>
    ${fig(f5, 'Share of referrals lost because no caregiver was available, last 12 months.')}
    ${sqlBox('05_referrals_lost', 'referrals lost by office')}

    <h2>4. Recommendations</h2>
    <h3>1. Roll the 90-day mentor program out to Bedford, Kokomo and rural coverage</h3>
    <p><b>What:</b> pair each new caregiver with a mentor (a $250 stipend per new hire), add check-ins at days 7, 30, 60 and 90, and fund one program coordinator. Roll it out one office per month so the later offices act as a comparison group.</p>
    <p><b>Impact:</b> if the other offices get half to all of Greenfield's effect, fill rises ${num(r1.lo * 100, 1)}–${num(r1.hi * 100, 1)} points: <b>${num(r1.hoursLo, 0)}–${num(r1.hoursHi, 0)} more care hours and ${money(r1.revLo)}–${money(r1.revHi)} more revenue a year</b>, plus about ${num(r1.exits, 0)} fewer early exits (≈ ${money(r1.replace)} in recruiting and training cost avoided at $2,500 per hire). Cost: about ${money(r1.cost)} a year.</p>
    <p><b>Trade-offs:</b> mentors' time is a real cost and burns out good caregivers if they carry too many mentees; cap it at two at a time.</p>

    <h3>2. Pay a targeted incentive on hard-to-fill open shifts, not a blanket differential</h3>
    <p><b>What:</b> a $3-an-hour bonus only on evening and weekend shifts that are still open 48 hours ahead, plus a small float pool of caregivers who prefer those hours.</p>
    <p><b>Impact:</b> recovering a third to a half of the ${num(U, 0)} unstaffed evening and weekend hours is worth <b>${money(r2.revLo)}–${money(r2.revHi)} in revenue and ${money(r2.netLo)}–${money(r2.netHi)} in margin after the bonus</b>. A blanket $2 differential on every evening and weekend hour would cost about ${money(r2.blanket)} a year, more than it could recover. Targeting the bonus is what makes it pay.</p>
    <p><b>Trade-offs:</b> caregivers may learn to wait for bonuses, so rotate which shifts qualify and watch the open-shift rate weekly.</p>

    <h3>3. Recruit caregivers where rural clients live</h3>
    <p><b>What:</b> post jobs by county instead of by office, recruit through local churches, community colleges and family caregivers already in the Medicaid program, match caregivers to clients by drive time, and reimburse mileage.</p>
    <p><b>Impact:</b> halving rural referrals lost for lack of a caregiver adds about <b>${num(r3.admits, 0)} admissions a year</b>. At ${money(A.revClientMonth)} of revenue per client-month, that is ${money(r3.revLo)}–${money(r3.revHi)} a year if they stay four to eight months.</p>
    <p><b>Trade-offs:</b> smaller, scattered caregiver pools are harder to supervise, so pair this with remote check-ins and EVV monitoring.</p>

    <h3>Quick win: protect what is already earned</h3>
    <p>Denials run ${pct(c.denialPct * 100, 1)}; tracking authorizations before they expire and fixing the top three denial reasons to reach 2.5% protects about <b>${money(denialGain)} a year</b>. VA Community Care takes ${num(vaNow.arDays, 0)} days to pay; getting it to 45 frees about <b>${money(vaCash)} in cash</b>.</p>
    ${recTbl}
    ${sqlBox('06_revenue_cycle_by_payer', 'revenue cycle by payer')}

    <h2>5. How I would run it: the first 90 days</h2>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th style="text-align:left">What</th><th style="text-align:left">Measure</th></tr></thead><tbody>
      <tr><td>Days 1–30</td><td style="white-space:normal;text-align:left">Connect scheduling/EVV, payroll, intake and billing exports into one model; agree on the KPI definitions (the dashboard's dictionary) with operations and finance; rebuild this analysis on real data.</td><td style="white-space:normal;text-align:left">One trusted weekly KPI pack</td></tr>
      <tr><td>Days 31–60</td><td style="white-space:normal;text-align:left">Start the mentor rollout in one office and the open-shift incentive in one region, each with a comparison group; set up authorization-expiry alerts.</td><td style="white-space:normal;text-align:left">90-day exits, open-shift fill, denials</td></tr>
      <tr><td>Days 61–90</td><td style="white-space:normal;text-align:left">Read out the results, scale what works, launch rural county recruiting, and set quarterly targets by office.</td><td style="white-space:normal;text-align:left">Fill rate, referrals lost, days to start</td></tr>
    </tbody></table></div>
    ${sqlBox('07_kpi_scorecard', 'office KPI scorecard')}

    <h2>6. Assumptions and what I'd do with more time</h2>
    <ul>
      <li>Unfilled hours are valued at the average billed rate for the same payer and service; the replacement cost per caregiver ($2,500), mentor stipend ($250), coordinator ($55,000) and length of stay (4–8 months) are assumptions to replace with Elite's figures.</li>
      <li>The turnover regression shows association, not cause; the mentor-program comparison is the stronger evidence and should keep being measured as it scales.</li>
      <li>With real data I would add caregiver-level survival analysis (who leaves early, and why), drive-time matching from client and caregiver addresses, and a weekly forecast of open shifts by office.</li>
    </ul>
    <div class="pill-row" style="margin:22px 0 8px"><a class="btn pri" href="index.html">Explore the dashboard</a><a class="btn" href="https://github.com/Bsilva87921/bsilva87921.github.io/tree/main/elite-home-health" target="_blank" rel="noopener">See the SQL and data</a></div>
    `);
  }
  function $html(h) { const el = document.getElementById('cs'); el.innerHTML = h; C.mount(el); }
  function start() { X.theme(); C.init(); T.init(); render(); }
  return { start, analyze };
})();
