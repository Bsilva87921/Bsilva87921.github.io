/* Masthead 3D view (shared Project3D panel): the share of authorized hours left unfilled, by month (left to right)
   for each shift (front to back), colored by shift. On the dashboard it follows the office, payer, service and shift
   filters. Evenings and weekends sit at the back because their gap is the largest. */
const PX3D = (() => {
  const D = window.ELITE_DATA;
  const OFF = D.meta.offices, SH = D.meta.shifts, MON = D.meta.months;
  const cols = D.service.cols, ix = n => cols.indexOf(n);
  const iM = ix('month'), iO = ix('office'), iP = ix('payer'), iS = ix('service'), iSh = ix('shift'), iA = ix('authorized_hours'), iD = ix('delivered_hours');
  const nf = new Intl.NumberFormat('en-US');
  const mLabel = m => { const [y, mm] = m.split('-'); return new Date(+y, +mm - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); };
  const F0 = { period: '12', office: 'ALL', payer: 'ALL', service: 'ALL', shift: 'ALL' };
  function data(F) {
    F = F || F0;
    const n = F.period === 'all' ? MON.length : Math.min(MON.length, +F.period || 12);
    const ms = MON.slice(MON.length - n), C = ms.length, R = SH.length;
    const gap = new Array(R * C).fill(0), auth = new Array(R * C).fill(0);
    const mi = {}, si = {};
    ms.forEach((m, i) => { mi[m] = i; }); SH.forEach((s, i) => { si[s[0]] = i; });
    for (const r of D.service.rows) {
      const c = mi[r[iM]]; if (c == null) continue;
      if (F.office !== 'ALL' && r[iO] !== F.office) continue;
      if (F.payer !== 'ALL' && r[iP] !== F.payer) continue;
      if (F.service !== 'ALL' && r[iS] !== F.service) continue;
      const k = si[r[iSh]] * C + c;
      gap[k] += Math.max(0, r[iA] - r[iD]); auth[k] += r[iA];
    }
    const office = F.office === 'ALL' ? 'All offices' : (OFF.find(o => o[0] === F.office) || [0, F.office])[1];
    const SHORT = { DAY: 'Weekday days', EVE: 'Evenings & nights', WKD: 'Weekends' };
    return {
      cols: ms.map(mLabel), colShort: ms.map(m => mLabel(m).replace(' 20', ' ’')), rows: SH.map(s => s[1]), rowShort: SH.map(s => SHORT[s[0]] || s[1]),
      rowColor: SH.map((s, i) => i), dimRow: SH.map(s => F.shift !== 'ALL' && F.shift !== s[0]), v: gap.map((g, k) => (auth[k] ? g / auth[k] : 0)), rowRoom: 1.3,
      colEvery: Math.max(1, Math.round(C / 6)), tilt: 0.5,
      tip: (r, c, val) => {
        const k = r * C + c;
        return `<b>${SH[r][1]} · ${office}</b><span class="px3d-big">${(val * 100).toFixed(1)}%<small> of authorized hours unfilled</small></span><span class="px3d-sub">${mLabel(ms[c])} · ${nf.format(Math.round(gap[k]))} of ${nf.format(Math.round(auth[k]))} hours</span>`;
      }
    };
  }
  function start() {
    const host = document.getElementById('px3d'); if (!host || !window.Project3D) return;
    let ctl = null;
    const F = () => (typeof DASH !== 'undefined' && DASH.F ? DASH.F : F0);
    Project3D.mount(host, 'bars', () => data(F())).then(c => { ctl = c; });
    const again = () => requestAnimationFrame(() => { if (ctl) ctl.update(data(F())); });
    document.addEventListener('change', e => { if (e.target.dataset && e.target.dataset.f) again(); });
    document.addEventListener('click', e => { if (e.target.id === 'resetF') again(); });
  }
  return { start, data };
})();
document.addEventListener('DOMContentLoaded', () => PX3D.start());
