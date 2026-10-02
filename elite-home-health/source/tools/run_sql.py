#!/usr/bin/env python3
"""Run every query in sql/*.sql against data/elite.db and print the results (also saves data/sql_results.json)."""
import glob, json, os, sqlite3, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
con = sqlite3.connect(os.path.join(ROOT, 'data', 'elite.db'))
out = {}
files = sorted(glob.glob(os.path.join(ROOT, 'sql', '*.sql')))
only = sys.argv[1:] 
for f in files:
    name = os.path.basename(f)[:-4]
    if only and not any(o in name for o in only): continue
    sql = open(f).read()
    cur = con.execute(sql)
    cols = [d[0] for d in cur.description]
    rows = cur.fetchall()
    out[name] = {'cols': cols, 'rows': rows}
    print(f'\n== {name} ({len(rows)} rows)')
    w = [max(len(str(c)), *(len(str(r[i])) for r in rows[:40])) for i, c in enumerate(cols)] if rows else [len(c) for c in cols]
    print('  '.join(str(c).ljust(w[i]) for i, c in enumerate(cols)))
    for r in rows[:40]: print('  '.join(str(v).ljust(w[i]) for i, v in enumerate(r)))
json.dump(out, open(os.path.join(ROOT, 'data', 'sql_results.json'), 'w'), indent=1, default=str)
