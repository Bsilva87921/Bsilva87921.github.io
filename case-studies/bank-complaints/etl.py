"""Load the CFPB complaint export into SQLite, run analysis.sql, and write compact JSON for the web page.
Usage: python3 etl.py complaints.csv
"""
import sys, re, json, sqlite3
import pandas as pd

src = sys.argv[1] if len(sys.argv) > 1 else 'complaints.csv'
df = pd.read_csv(src, low_memory=False)
cols = {'Date received': 'date_received', 'Sub-product': 'sub_product', 'Issue': 'issue', 'Sub-issue': 'sub_issue',
        'Company': 'company', 'ZIP code': 'zip', 'Tags': 'tags', 'Submitted via': 'channel',
        'Company response to consumer': 'response', 'Timely response?': 'timely', 'Complaint ID': 'complaint_id'}
t = df[list(cols)].rename(columns=cols)
t['date_received'] = pd.to_datetime(t['date_received'], utc=True).dt.strftime('%Y-%m-%d')
t['zip'] = t['zip'].astype('string')

con = sqlite3.connect('complaints.db')
t.to_sql('complaints', con, if_exists='replace', index=False)

results = {}
sql = open('analysis.sql').read()
for block in re.split(r'\n(?=-- name: )', sql):
    m = re.match(r'-- name: (\w+)', block.strip())
    if not m:
        continue
    cur = con.execute(block.strip())
    names = [d[0] for d in cur.description]
    results[m.group(1)] = [dict(zip(names, r)) for r in cur.fetchall()]
    print('\n==', m.group(1)); [print(r) for r in results[m.group(1)]]

# compact cube for the interactive page: quarter x sub-issue x region x outcome x tags
def outcome(r):
    return {'Closed with monetary relief': 1, 'Closed with non-monetary relief': 2}.get(r, 0)
t['q'] = t['date_received'].str[:4] + 'Q' + ((t['date_received'].str[5:7].astype(int) - 1) // 3 + 1).astype(str)
t['cf'] = t['zip'].fillna('').str[:3].isin(['327', '328', '347']).astype(int)
t['out'] = t['response'].map(outcome)
t['old'] = t['tags'].fillna('').str.contains('Older American').astype(int)
t['sub_issue'] = t['sub_issue'].fillna('Not specified')
subs = t['sub_issue'].value_counts().index.tolist()
qs = sorted(t['q'].unique())
g = t.groupby(['q', 'sub_issue', 'cf', 'out', 'old']).size().reset_index(name='n')
cube = [[qs.index(r.q), subs.index(r.sub_issue), int(r.cf), int(r.out), int(r.old), int(r.n)] for r in g.itertuples()]
dts = pd.to_datetime(t['date_received'])
span = {str(y): round(((g.max() - g.min()).days + 1) / 30.44, 2) for y, g in dts.groupby(dts.dt.year)}
json.dump({'subs': subs, 'quarters': qs, 'cube': cube, 'n': int(len(t)),
           'first': t['date_received'].min(), 'last': t['date_received'].max(),
           'monthsByYear': span,
           'sql': results}, open('cube.json', 'w'), separators=(',', ':'))
print('\ncube rows', len(cube), 'sub-issues', len(subs))
