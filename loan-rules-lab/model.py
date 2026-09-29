"""Train the Loan Rules Lab risk model: probability that a loan is NOT fully paid.

Logistic regression on information known about the applicant (FICO, debt-to-income, inquiries, public records,
revolving utilization, annual income, loan purpose). The interest rate and installment are left out on purpose:
a lender sets them after the credit decision. Delinquencies were tested and dropped: once FICO is in the model
their weight turns slightly negative (fewer delinquencies = more risk), which makes no business sense, and
removing them does not lower out-of-fold AUC.

Outputs
  model.json  coefficients for the in-page application scorer (model fitted on all loans)
  risk array  out-of-fold predictions added to data.json: every loan is scored by a model trained on the
              other 4 folds, so the accuracy shown on the page is out-of-sample.

Usage: python3 model.py <loan_data.csv> <data.json> <model.json>
"""
import sys, json
import numpy as np, pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.metrics import roc_auc_score

src, data_path, model_path = sys.argv[1], sys.argv[2], sys.argv[3]
df = pd.read_csv(src)
y = df['not.fully.paid'].values

# numeric features: (key used in the page, source column, cap applied before modelling, transform)
NUM = [('fico', 'fico', None, 'raw'), ('dti', 'dti', None, 'raw'), ('inq', 'inq.last.6mths', 10, 'raw'),
       ('pub', 'pub.rec', 3, 'raw'), ('util', 'revol.util', None, 'raw'),
       ('income', 'log.annual.inc', None, 'log')]  # log.annual.inc is already the natural log of income
BASE_PURPOSE = 'debt_consolidation'
purposes = sorted(df['purpose'].unique())
X = pd.DataFrame({k: (df[c].clip(upper=cap) if cap else df[c]) for k, c, cap, _ in NUM})
for p in purposes:
    if p != BASE_PURPOSE:
        X['p_' + p] = (df['purpose'] == p).astype(float)

pipe = make_pipeline(StandardScaler(), LogisticRegression(max_iter=5000))
skf = StratifiedKFold(5, shuffle=True, random_state=42)
oof = cross_val_predict(pipe, X, y, cv=skf, method='predict_proba')[:, 1]
auc = roc_auc_score(y, oof)
auc_fico = roc_auc_score(y, -df['fico'])
print(f'out-of-fold AUC {auc:.4f}; FICO alone {auc_fico:.4f}')

dec = pd.qcut(pd.Series(oof).rank(method='first'), 10, labels=False)
tab = pd.DataFrame({'dec': dec, 'y': y, 'p': oof}).groupby('dec').agg(actual=('y', 'mean'), predicted=('p', 'mean'), n=('y', 'size'))
print(tab.round(3))

pipe.fit(X, y)
sc, lr = pipe.named_steps['standardscaler'], pipe.named_steps['logisticregression']
w = lr.coef_[0] / sc.scale_          # weight per raw unit
mu = sc.mean_
cols = list(X.columns)
model = {
    'intercept': float(lr.intercept_[0]),   # logit when every feature equals its average
    'num': [{'key': k, 'w': float(w[cols.index(k)]), 'mu': float(mu[cols.index(k)]), 'cap': cap, 'log': t == 'log'}
            for k, _, cap, t in NUM],
    'purpose': {p: (float(w[cols.index('p_' + p)]) if p != BASE_PURPOSE else 0.0) for p in purposes},
    'purposeMu': {p: (float(mu[cols.index('p_' + p)]) if p != BASE_PURPOSE else float((df['purpose'] == p).mean())) for p in purposes},
    'auc': round(float(auc), 4), 'aucFico': round(float(auc_fico), 4), 'folds': 5, 'n': int(len(df)),
}
# check: the exported formula reproduces sklearn's full-data predictions
z = model['intercept'] + sum(f['w'] * (X[f['key']].values - f['mu']) for f in model['num'])
z += sum(model['purpose'][p] * ((df['purpose'] == p).astype(float).values - model['purposeMu'][p]) for p in purposes if p != BASE_PURPOSE)
diff = np.abs(1 / (1 + np.exp(-z)) - pipe.predict_proba(X)[:, 1]).max()
print('max formula difference vs sklearn', diff)
assert diff < 1e-9
print('weights per unit:', {f['key']: round(f['w'], 5) for f in model['num']})
print('purpose weights:', {p: round(v, 3) for p, v in model['purpose'].items()})

with open(model_path, 'w') as f:
    json.dump(model, f, separators=(',', ':'))
data = json.load(open(data_path))
assert data['n'] == len(df)
data['risk'] = [int(round(p * 1000)) for p in oof]   # per-mille, out-of-fold
with open(data_path, 'w') as f:
    json.dump(data, f, separators=(',', ':'))
print('wrote', model_path, 'and risk scores into', data_path)
