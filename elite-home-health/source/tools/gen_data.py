#!/usr/bin/env python3
"""Generate an illustrative operations dataset for an Indiana home care agency (modeled on Elite Home Healthcare's
footprint: Bedford, Greenfield, Kokomo offices plus rural statewide coverage). NOT Elite's actual data.

Writes data/elite.db (SQLite) and data/elite.json (compact arrays for the dashboard).
Patterns built in (so the case study has something real to find): a weekend/evening and rural staffing gap,
early caregiver turnover that drags on fill rate, a Greenfield 90-day mentor pilot from April 2026,
PathWays (Medicaid managed LTSS) denials that improved after the 2024 transition, and seasonal dips.
"""
import json, os, sqlite3, math
import numpy as np

R = np.random.default_rng(20261002)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data')
os.makedirs(OUT, exist_ok=True)

MONTHS = [f"{2024 + (9 + i) // 12}-{(9 + i) % 12 + 1:02d}" for i in range(24)]   # 2024-10 .. 2026-09
OFFICES = [  # id, name, region, share of hours, fill adj, turnover adj, days-to-start base, rural
    ('BED', 'Bedford', 'South Central', 0.34, 0.010, 0.00, 4.8, 0),
    ('GRN', 'Greenfield', 'Central', 0.28, 0.000, 0.02, 4.2, 0),
    ('KOK', 'Kokomo', 'North Central', 0.22, -0.010, 0.03, 5.4, 0),
    ('RUR', 'Rural statewide', 'Statewide', 0.16, -0.065, 0.10, 8.1, 1),
]
PAYERS = [  # id, name, share, bill rate/hr, labor-cost multiplier, denial start, denial end, AR days start, end
    ('PWY', 'PathWays (Medicaid managed LTSS)', 0.47, 26.40, 1.00, 0.095, 0.032, 64, 46),
    ('HWW', 'Health & Wellness waiver', 0.20, 27.10, 1.00, 0.034, 0.028, 40, 37),
    ('MCR', 'Medicare home health', 0.04, 152.0, 3.90, 0.046, 0.038, 36, 33),
    ('PVT', 'Private pay', 0.12, 32.00, 1.00, 0.010, 0.008, 22, 19),
    ('VAC', 'VA Community Care', 0.13, 28.20, 1.00, 0.058, 0.047, 71, 61),
]
SERVICES = [('ATT', 'Attendant & personal care'), ('HMR', 'Homemaker & respite'), ('SKL', 'Skilled nursing & therapy')]
VALID = {'PWY': {'ATT': .72, 'HMR': .23, 'SKL': .05}, 'HWW': {'ATT': .70, 'HMR': .25, 'SKL': .05}, 'MCR': {'SKL': 1.0},
         'PVT': {'ATT': .75, 'HMR': .25}, 'VAC': {'ATT': .68, 'HMR': .32}}
SHIFTS = [('DAY', 'Weekday daytime', 0.62, 0.020), ('EVE', 'Evenings & overnight', 0.18, -0.045), ('WKD', 'Weekends', 0.20, -0.085)]
SEASON = {1: -0.012, 2: -0.006, 3: 0, 4: 0, 5: 0, 6: -0.006, 7: -0.012, 8: -0.004, 9: 0, 10: 0, 11: -0.012, 12: -0.030}

def mi(m): return MONTHS.index(m)

# ---------------- workforce first (turnover drives fill) ----------------
workforce, turn90 = [], {}
base_total_hours = 70000.0
for i, m in enumerate(MONTHS):
    mon = int(m[5:])
    growth = (1 + 0.0085) ** i
    for oid, oname, reg, share, fadj, tadj, d0, rural in OFFICES:
        hours = base_total_hours * growth * share
        head = hours * 0.91 / 112.0
        pilot = oid == 'GRN' and m >= '2026-04'
        ramp = min(1.0, (mi(m) - mi('2026-04') + 1) / 3) if pilot else 0
        ann = 0.66 + tadj + (0.05 if mon in (11, 12, 1) else 0) + R.normal(0, 0.03)
        early_share = 0.54 + (0.05 if rural else 0) - 0.12 * ramp + R.normal(0, 0.02)
        terms = head * ann / 12
        t90 = terms * early_share
        terms = terms - t90 * (0.28 * ramp)          # the pilot keeps new hires who would have left early
        t90 = t90 * (1 - 0.28 * ramp)
        hires = terms + head * 0.0085 + R.normal(0, head * 0.004)
        apps = hires * (6.8 + R.normal(0, 0.6)) * (1.25 if rural else 1)
        ttf = (11 + (6 if rural else 0) + (2 if mon in (11, 12) else 0) + R.normal(0, 1.2)) * (0.9 if pilot else 1)
        ot = hours * (0.055 + (0.03 if rural else 0) + R.normal(0, 0.006))
        turn90[(m, oid)] = t90 / head * 12
        workforce.append(dict(month=m, office=oid, headcount=round(head), hires=round(hires), terms=round(terms),
                              terms_90d=round(t90), applicants=round(apps), days_to_hire=round(ttf, 1),
                              overtime_hours=round(ot), mentor_program=1 if pilot else 0))

# ---------------- service hours, billing ----------------
service, ar = [], []
for i, m in enumerate(MONTHS):
    mon = int(m[5:])
    growth = (1 + 0.0085) ** i
    evv = min(0.985, 0.935 + i * 0.0018)
    for oid, oname, reg, oshare, fadj, tadj, d0, rural in OFFICES:
        t90x = turn90[(m, oid)] - 0.36                  # early-turnover excess vs a typical 0.36 annualized
        pilot_boost = 0.008 * min(1.0, max(0, (mi(m) - mi('2026-04') + 1) / 3)) if oid == 'GRN' and m >= '2026-04' else 0
        for pid, pname, pshare, rate, lmul, den0, den1, ar0, ar1 in PAYERS:
            for sid, sshare in VALID[pid].items():
                for shid, shname, shshare, shadj in SHIFTS:
                    if pid == 'MCR' and shid == 'EVE':
                        continue
                    sh = shshare if pid != 'MCR' else {'DAY': 0.85, 'WKD': 0.15}[shid]
                    auth = base_total_hours * growth * oshare * pshare * sshare * sh * (1 + R.normal(0, 0.03))
                    fill = 0.915 + fadj + shadj + SEASON[mon] - 0.10 * t90x + pilot_boost
                    fill += 0.045 if pid == 'MCR' else 0.02 if pid == 'PVT' else 0
                    fill -= 0.02 if (pid == 'PWY' and m <= '2025-02') else 0     # authorization churn during the transition
                    fill = float(np.clip(fill + R.normal(0, 0.012), 0.6, 0.995))
                    delivered = auth * fill
                    scheduled = min(auth, delivered + auth * (0.035 + R.normal(0, 0.004)))
                    vlen = 1.0 if sid == 'SKL' else 3.6
                    visits = delivered / vlen
                    missed = (scheduled - delivered) / vlen
                    late = visits * (0.055 + (0.03 if rural else 0) + (0.02 if shid == 'WKD' else 0) + R.normal(0, 0.005))
                    r = rate * (0.86 if sid == 'HMR' else 1) * (1 + 0.02 * (i >= 15))
                    billed = delivered * r
                    den = den0 + (den1 - den0) * min(1, i / 14) + R.normal(0, 0.004)
                    den = max(0.003, den)
                    wage = (15.75 + (0.75 if i >= 12 else 0)) * (1.18) * lmul * (1.06 if shid != 'DAY' else 1) * (0.97 if sid == 'HMR' else 1)
                    labor = delivered * wage + (scheduled - delivered) * 0.15 * wage
                    service.append(dict(month=m, office=oid, payer=pid, service=sid, shift=shid,
                                        authorized_hours=round(auth, 1), scheduled_hours=round(scheduled, 1), delivered_hours=round(delivered, 1),
                                        visits=round(visits), missed_visits=round(missed), late_visits=round(late), evv_verified=round(visits * (evv + R.normal(0, 0.004))),
                                        billed=round(billed), denied=round(billed * den), labor_cost=round(labor)))
        # AR snapshot by payer (company level, attributed to office by billing share later)
    for pid, pname, pshare, rate, lmul, den0, den1, ar0, ar1 in PAYERS:
        b = sum(s['billed'] for s in service if s['month'] == m and s['payer'] == pid)
        days = ar0 + (ar1 - ar0) * min(1, i / 16) + R.normal(0, 1.5)
        ar.append(dict(month=m, payer=pid, ar_balance=round(b / 30.4 * days), ar_over_90=round(b / 30.4 * days * (0.10 + 0.12 * (days > 55) + R.normal(0, 0.01))), ar_days=round(days, 1)))

# ---------------- growth (referrals) and quality ----------------
growth_rows, quality = [], []
for i, m in enumerate(MONTHS):
    mon = int(m[5:])
    for oid, oname, reg, oshare, fadj, tadj, d0, rural in OFFICES:
        fill_o = sum(s['delivered_hours'] for s in service if s['month'] == m and s['office'] == oid) / sum(s['authorized_hours'] for s in service if s['month'] == m and s['office'] == oid)
        for pid, pname, pshare, *_ in PAYERS:
            ref = max(1, 260 * oshare * pshare * (1 + 0.012 * i) * (1 + R.normal(0, 0.08)))
            lost_staff = ref * max(0.02, (0.94 - fill_o) * 1.6 + R.normal(0, 0.01))
            lost_other = ref * (0.17 + R.normal(0, 0.02))
            adm = max(0, ref - lost_staff - lost_other)
            dts = d0 + (1.5 if pid == 'PWY' and m <= '2025-03' else 0) + (2.5 if fill_o < 0.86 else 0) + R.normal(0, 0.5)
            hours = sum(s['delivered_hours'] for s in service if s['month'] == m and s['office'] == oid and s['payer'] == pid)
            active = hours / (14.0 if pid == 'MCR' else 58.0)
            growth_rows.append(dict(month=m, office=oid, payer=pid, referrals=round(ref), admissions=round(adm), lost_no_caregiver=round(lost_staff),
                                    lost_other=round(lost_other), days_to_start_sum=round(dts * adm, 1), active_clients=round(active),
                                    discharges=round(active * (0.045 if pid != 'MCR' else 0.42) * (1 + R.normal(0, 0.1)))))
        hrs = sum(s['delivered_hours'] for s in service if s['month'] == m and s['office'] == oid)
        mcr_adm = sum(g['admissions'] for g in growth_rows if g['month'] == m and g['office'] == oid and g['payer'] == 'MCR')
        resp = round(hrs / 950 * (1 + R.normal(0, 0.1)))
        top = 0.835 + 0.25 * (fill_o - 0.89) + R.normal(0, 0.015)
        quality.append(dict(month=m, office=oid, survey_responses=resp, survey_top_box=round(resp * min(0.97, top)),
                            incidents=int(R.poisson(hrs / 10000 * (3.1 + (0.6 if rural else 0)))), falls=int(R.poisson(hrs / 10000 * 1.2)),
                            mcr_episodes=max(1, round(mcr_adm * 1.4)), mcr_hospitalizations=int(R.binomial(max(1, round(mcr_adm * 1.4)), 0.142 + (0.015 if rural else 0))),
                            mcr_ed_visits=int(R.binomial(max(1, round(mcr_adm * 1.4)), 0.128)),
                            complaints=int(R.poisson(hrs / 10000 * (1.1 + 6 * max(0, 0.9 - fill_o))))))

# ---------------- write SQLite ----------------
db = os.path.join(OUT, 'elite.db')
if os.path.exists(db):
    os.remove(db)
con = sqlite3.connect(db)
c = con.cursor()
c.execute('CREATE TABLE dim_office (office TEXT PRIMARY KEY, name TEXT, region TEXT, rural INTEGER)')
c.executemany('INSERT INTO dim_office VALUES (?,?,?,?)', [(o[0], o[1], o[2], o[7]) for o in OFFICES])
c.execute('CREATE TABLE dim_payer (payer TEXT PRIMARY KEY, name TEXT, bill_rate REAL)')
c.executemany('INSERT INTO dim_payer VALUES (?,?,?)', [(p[0], p[1], p[3]) for p in PAYERS])
c.execute('CREATE TABLE dim_service (service TEXT PRIMARY KEY, name TEXT)')
c.executemany('INSERT INTO dim_service VALUES (?,?)', SERVICES)
c.execute('CREATE TABLE dim_shift (shift TEXT PRIMARY KEY, name TEXT)')
c.executemany('INSERT INTO dim_shift VALUES (?,?)', [(s[0], s[1]) for s in SHIFTS])
def table(name, rows):
    cols = list(rows[0].keys())
    c.execute(f'CREATE TABLE {name} ({", ".join(cols)})')
    c.executemany(f'INSERT INTO {name} VALUES ({",".join("?" * len(cols))})', [tuple(r[k] for k in cols) for r in rows])
table('fact_service_month', service)
table('fact_workforce_month', workforce)
table('fact_referrals_month', growth_rows)
table('fact_quality_month', quality)
table('fact_ar_month', ar)
con.commit(); con.close()

# ---------------- compact JSON for the dashboard ----------------
def pack(rows):
    cols = list(rows[0].keys())
    return {'cols': cols, 'rows': [[r[k] for k in cols] for r in rows]}
meta = {'months': MONTHS, 'offices': [[o[0], o[1], o[2], o[7]] for o in OFFICES], 'payers': [[p[0], p[1]] for p in PAYERS],
        'services': SERVICES, 'shifts': [[s[0], s[1]] for s in SHIFTS]}
json.dump({'meta': meta, 'service': pack(service), 'workforce': pack(workforce), 'referrals': pack(growth_rows), 'quality': pack(quality), 'ar': pack(ar)},
          open(os.path.join(OUT, 'elite.json'), 'w'), separators=(',', ':'))
print('rows', len(service), len(workforce), len(growth_rows), len(quality), len(ar), 'json bytes', os.path.getsize(os.path.join(OUT, 'elite.json')))
