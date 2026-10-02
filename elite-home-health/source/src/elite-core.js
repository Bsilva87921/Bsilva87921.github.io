/* Home care operations metrics engine (shared by the dashboard and the case study). Data: window.ELITE_DATA (illustrative sample). */
const X = (() => {
  const { ok } = K;
  const D = window.ELITE_DATA;
  const unpack = t => t.rows.map(r => { const o = {}; t.cols.forEach((c, i) => o[c] = r[i]); return o; });
  const SV = unpack(D.service), WF = unpack(D.workforce), RF = unpack(D.referrals), QL = unpack(D.quality), AR = unpack(D.ar);
  const M = D.meta, MONTHS = M.months;
  const name = (list, id) => (list.find(x => x[0] === id) || [id, id])[1];
  const OFF = M.offices, PAY = M.payers, SRV = M.services, SHF = M.shifts;
  const mLab = m => K.MON[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
  const mShort = m => K.MON[+m.slice(5, 7) - 1] + ' ’' + m.slice(2, 4);
  const mX = m => +m.slice(0, 4) + (+m.slice(5, 7) - 1) / 12;
  // billed rate per delivered hour by payer|service (values unfilled hours)
  const RATE = {};
  { const t = {}; for (const r of SV) { const k = r.payer + '|' + r.service; t[k] = t[k] || [0, 0]; t[k][0] += r.billed; t[k][1] += r.delivered_hours; } for (const k in t) RATE[k] = t[k][0] / t[k][1]; }
  const sum = (rows, f) => { let s = 0; for (const r of rows) s += typeof f === 'string' ? r[f] : f(r); return s; };

  function months(period, endIdx = MONTHS.length - 1) { const n = period === 'all' ? MONTHS.length : +period; return MONTHS.slice(Math.max(0, endIdx - n + 1), endIdx + 1); }
  function priorMonths(period) { const n = period === 'all' ? 0 : +period; if (!n || MONTHS.length - 2 * n < 0) return []; return MONTHS.slice(MONTHS.length - 2 * n, MONTHS.length - n); }
  const match = (r, f, dims) => dims.every(d => f[d] === 'ALL' || r[d] === f[d]);

  /* compute every KPI for a set of months under a filter */
  function compute(ms, f) {
    const set = new Set(ms);
    const sv = SV.filter(r => set.has(r.month) && match(r, f, ['office', 'payer', 'service', 'shift']));
    const wf = WF.filter(r => set.has(r.month) && match(r, f, ['office']));
    const rf = RF.filter(r => set.has(r.month) && match(r, f, ['office', 'payer']));
    const ql = QL.filter(r => set.has(r.month) && match(r, f, ['office']));
    const ar = AR.filter(r => r.month === ms[ms.length - 1] && match(r, f, ['payer']));
    const svOffice = SV.filter(r => set.has(r.month) && match(r, f, ['office']));   // for per-10k-hour rates
    const auth = sum(sv, 'authorized_hours'), deliv = sum(sv, 'delivered_hours'), billed = sum(sv, 'billed');
    const visits = sum(sv, 'visits'), missed = sum(sv, 'missed_visits');
    const head = sum(wf, 'headcount') / Math.max(1, ms.length), terms = sum(wf, 'terms');
    const hoursO = sum(svOffice, 'delivered_hours');
    const lastM = ms[ms.length - 1];
    const arBal = sum(ar, 'ar_balance');
    const lastBilled = sum(SV.filter(r => r.month === lastM && match(r, f, ['payer'])), 'billed');
    return {
      months: ms, auth, deliv, billed,
      fill: auth ? deliv / auth : null,
      unfilled: auth - deliv,
      unbilled: sum(sv, r => (r.authorized_hours - r.delivered_hours) * RATE[r.payer + '|' + r.service]),
      missedPct: visits + missed ? missed / (visits + missed) : null,
      latePct: visits ? sum(sv, 'late_visits') / visits : null,
      evvPct: visits ? sum(sv, 'evv_verified') / visits : null,
      denialPct: billed ? sum(sv, 'denied') / billed : null,
      marginHr: deliv ? (billed - sum(sv, 'labor_cost')) / deliv : null,
      laborPct: billed ? sum(sv, 'labor_cost') / billed : null,
      revPerHr: deliv ? billed / deliv : null,
      headcount: head,
      turnover: head ? terms / head * 12 / ms.length : null,
      early90: terms ? sum(wf, 'terms_90d') / terms : null,
      hires: sum(wf, 'hires'), terms,
      daysToHire: wf.length ? sum(wf, 'days_to_hire') / wf.length : null,
      appsPerHire: sum(wf, 'hires') ? sum(wf, 'applicants') / sum(wf, 'hires') : null,
      overtime: hoursO ? sum(wf, 'overtime_hours') / hoursO : null,
      referrals: sum(rf, 'referrals'), admissions: sum(rf, 'admissions'), lostStaff: sum(rf, 'lost_no_caregiver'), lostOther: sum(rf, 'lost_other'),
      admitRate: sum(rf, 'referrals') ? sum(rf, 'admissions') / sum(rf, 'referrals') : null,
      lostStaffPct: sum(rf, 'referrals') ? sum(rf, 'lost_no_caregiver') / sum(rf, 'referrals') : null,
      daysToStart: sum(rf, 'admissions') ? sum(rf, 'days_to_start_sum') / sum(rf, 'admissions') : null,
      activeClients: sum(RF.filter(r => r.month === lastM && match(r, f, ['office', 'payer'])), 'active_clients'),
      satisfaction: sum(ql, 'survey_responses') ? sum(ql, 'survey_top_box') / sum(ql, 'survey_responses') : null,
      incidents10k: hoursO ? sum(ql, 'incidents') / hoursO * 1e4 : null,
      complaints10k: hoursO ? sum(ql, 'complaints') / hoursO * 1e4 : null,
      hospRate: sum(ql, 'mcr_episodes') ? sum(ql, 'mcr_hospitalizations') / sum(ql, 'mcr_episodes') : null,
      edRate: sum(ql, 'mcr_episodes') ? sum(ql, 'mcr_ed_visits') / sum(ql, 'mcr_episodes') : null,
      arDays: lastBilled ? arBal / (lastBilled / 30.4) : null,
      ar90: arBal ? sum(ar, 'ar_over_90') / arBal : null,
      arBalance: arBal
    };
  }
  /* monthly series of one KPI */
  const series = (f, key, ms = MONTHS, win = 1) => ms.map(m => { const i = MONTHS.indexOf(m); if (i < win - 1) return [mX(m), null]; return [mX(m), compute(MONTHS.slice(i - win + 1, i + 1), f)[key]]; }).filter(p => ok(p[1]));

  /* KPI catalog: targets are typical operating goals for an agency like this (adjustable) */
  const KPI = [
    { k: 'fill', lab: 'Hours fill rate', fmt: v => K.pct(v * 100, 1), tgt: 0.92, dir: 1, grp: 'Staffing', def: 'Delivered hours ÷ authorized hours. The share of care clients are approved for that actually happens.', src: 'Scheduling / EVV system', filt: 'All filters' },
    { k: 'unbilled', lab: 'Revenue from unfilled hours', fmt: v => K.money(v), dir: -1, grp: 'Staffing', def: 'Unfilled hours × the average billed rate for that payer and service: revenue the agency was authorized for but could not staff.', src: 'Scheduling + billing', filt: 'All filters' },
    { k: 'missedPct', lab: 'Missed visit rate', fmt: v => K.pct(v * 100, 1), tgt: 0.03, dir: -1, grp: 'Staffing', def: 'Missed visits ÷ (completed + missed visits).', src: 'EVV system', filt: 'All filters' },
    { k: 'evvPct', lab: 'EVV compliance', fmt: v => K.pct(v * 100, 1), tgt: 0.97, dir: 1, grp: 'Staffing', def: 'Visits verified by electronic visit verification ÷ completed visits. Unverified visits put Medicaid payment at risk.', src: 'EVV aggregator', filt: 'All filters' },
    { k: 'turnover', lab: 'Caregiver turnover (annualized)', fmt: v => K.pct(v * 100, 0), tgt: 0.60, dir: -1, grp: 'Workforce', def: 'Separations ÷ average headcount, annualized.', src: 'HRIS / payroll', filt: 'Office' },
    { k: 'early90', lab: 'Exits within 90 days of hire', fmt: v => K.pct(v * 100, 0), tgt: 0.40, dir: -1, grp: 'Workforce', def: 'Separations of caregivers in their first 90 days ÷ all separations.', src: 'HRIS', filt: 'Office' },
    { k: 'daysToHire', lab: 'Days to hire', fmt: v => K.num(v, 1), tgt: 12, dir: -1, grp: 'Workforce', def: 'Average days from application to first scheduled shift.', src: 'Applicant tracking', filt: 'Office' },
    { k: 'overtime', lab: 'Overtime share of hours', fmt: v => K.pct(v * 100, 1), tgt: 0.06, dir: -1, grp: 'Workforce', def: 'Overtime hours ÷ delivered hours.', src: 'Payroll', filt: 'Office' },
    { k: 'denialPct', lab: 'Claim denial rate', fmt: v => K.pct(v * 100, 1), tgt: 0.03, dir: -1, grp: 'Revenue cycle', def: 'Denied dollars ÷ billed dollars.', src: 'Billing / clearinghouse', filt: 'All filters' },
    { k: 'arDays', lab: 'Days in A/R', fmt: v => K.num(v, 0), tgt: 40, dir: -1, grp: 'Revenue cycle', def: 'Accounts receivable ÷ average daily billing in the latest month.', src: 'Billing', filt: 'Payer' },
    { k: 'marginHr', lab: 'Gross margin per hour', fmt: v => K.money(v, 2), tgt: 10.5, dir: 1, grp: 'Revenue cycle', def: '(Billed − direct care labor) ÷ delivered hours.', src: 'Billing + payroll', filt: 'All filters' },
    { k: 'admitRate', lab: 'Referral admit rate', fmt: v => K.pct(v * 100, 1), tgt: 0.75, dir: 1, grp: 'Growth', def: 'Admissions ÷ referrals received.', src: 'Intake / CRM', filt: 'Office, payer' },
    { k: 'lostStaffPct', lab: 'Referrals lost: no caregiver', fmt: v => K.pct(v * 100, 1), tgt: 0.05, dir: -1, grp: 'Growth', def: 'Referrals declined because no caregiver was available ÷ referrals.', src: 'Intake / CRM', filt: 'Office, payer' },
    { k: 'daysToStart', lab: 'Days to start of care', fmt: v => K.num(v, 1), tgt: 5, dir: -1, grp: 'Growth', def: 'Average days from referral to first visit.', src: 'Intake + scheduling', filt: 'Office, payer' },
    { k: 'satisfaction', lab: 'Client satisfaction (top box)', fmt: v => K.pct(v * 100, 1), tgt: 0.85, dir: 1, grp: 'Quality', def: 'Share of survey responses rating care 9–10 out of 10.', src: 'Client survey', filt: 'Office' },
    { k: 'hospRate', lab: 'Hospitalization rate (Medicare)', fmt: v => K.pct(v * 100, 1), tgt: 0.14, dir: -1, grp: 'Quality', def: 'Medicare home health episodes with an acute-care hospitalization ÷ episodes. Target set at the CMS comparison average of about 14%.', src: 'OASIS / claims', filt: 'Office' }
  ];
  const kpi = k => KPI.find(x => x.k === k);
  function status(def, v) {
    if (!ok(v) || def.tgt == null) return null;
    const gap = def.dir > 0 ? v - def.tgt : def.tgt - v, rel = gap / Math.abs(def.tgt);
    return rel >= 0 ? 'good' : rel >= -0.06 ? 'warn' : 'crit';
  }
  /* theme toggle (remembered per viewer) */
  function theme() {
    const root = document.documentElement;
    try { const t = localStorage.getItem('elite-theme'); if (t) root.dataset.theme = t; } catch (e) { /* ignore */ }
    const btn = document.getElementById('themeBtn'); if (!btn) return;
    const cur = () => root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const paint = () => { const d = cur() === 'dark'; btn.innerHTML = d ? '☀︎ Light mode' : '☾ Dark mode'; btn.setAttribute('aria-label', d ? 'Switch to light mode' : 'Switch to dark mode'); };
    btn.addEventListener('click', () => { const n = cur() === 'dark' ? 'light' : 'dark'; root.dataset.theme = n; try { localStorage.setItem('elite-theme', n); } catch (e) { /* ignore */ } paint(); });
    paint();
  }
  return { D, SV, WF, RF, QL, AR, MONTHS, OFF, PAY, SRV, SHF, name, mLab, mShort, mX, RATE, months, priorMonths, compute, series, KPI, kpi, status, theme, sum, match };
})();
