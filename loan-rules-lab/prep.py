"""Validate the Kaggle LendingClub loan_data.csv and write compact columnar JSON for the web tool.

Usage: python3 prep.py <path-to-loan_data.csv> <out.json>
"""
import sys, json, math
import pandas as pd

EXPECTED = ['credit.policy', 'purpose', 'int.rate', 'installment', 'log.annual.inc', 'dti', 'fico',
            'days.with.cr.line', 'revol.bal', 'revol.util', 'inq.last.6mths', 'delinq.2yrs', 'pub.rec',
            'not.fully.paid']

src, out = sys.argv[1], sys.argv[2]
df = pd.read_csv(src)
missing = [c for c in EXPECTED if c not in df.columns]
if missing:
    sys.exit(f'Missing columns: {missing}')
print('rows', len(df), 'cols', len(df.columns))
print('nulls', int(df[EXPECTED].isna().sum().sum()))
print('duplicates', int(df.duplicated().sum()))
for c in ['fico', 'dti', 'inq.last.6mths', 'delinq.2yrs', 'pub.rec', 'revol.util', 'int.rate']:
    print(f'{c:16s} min {df[c].min():>9} max {df[c].max():>9} mean {df[c].mean():.3f}')
print('purpose', df['purpose'].value_counts().to_dict())
print('credit.policy', df['credit.policy'].value_counts().to_dict())
print('not.fully.paid', df['not.fully.paid'].value_counts().to_dict())

purposes = sorted(df['purpose'].unique().tolist())
pidx = {p: i for i, p in enumerate(purposes)}
data = {
    'n': int(len(df)),
    'purposes': purposes,
    'fico': df['fico'].astype(int).tolist(),
    'dti10': [int(round(v * 10)) for v in df['dti']],            # DTI % x10
    'inq': df['inq.last.6mths'].astype(int).tolist(),
    'delinq': df['delinq.2yrs'].astype(int).tolist(),
    'pub': df['pub.rec'].astype(int).tolist(),
    'util10': [int(round(v * 10)) for v in df['revol.util']],    # utilization % x10
    'purpose': [pidx[p] for p in df['purpose']],
    'policy': df['credit.policy'].astype(int).tolist(),
    'nfp': df['not.fully.paid'].astype(int).tolist(),
    'rate': [int(round(v * 10000)) for v in df['int.rate']],     # basis points
    'income': [int(round(math.exp(v) / 100.0)) * 100 for v in df['log.annual.inc']],
}
with open(out, 'w') as f:
    json.dump(data, f, separators=(',', ':'))
print('wrote', out)
