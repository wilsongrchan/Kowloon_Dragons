"""Train the learned-defence model (see dangerML in src/engine.js).

usage: python3 scripts/train_defense.py <dir with p*.jsonl from ddata.cjs> [--write]
Two logistic regressions: P(opponent is tenpai) and P(t is one of the waits | tenpai).
--write patches RULES.DEF_W in src/engine.js.
"""
import sys, json, glob, re
import numpy as np
from scipy.optimize import minimize

def load(d):
    T, W = [], []
    for fn in sorted(glob.glob(d + '/p*.jsonl')):
        for line in open(fn):
            line = line.strip()
            if not line: continue
            r = json.loads(line)
            (T if r['T'] else W).append((r['f'], r['y']))
    return T, W

def fit(rows, l2=1.0):
    X = np.array([r[0] for r in rows], float); y = np.array([r[1] for r in rows], float)
    n, k = X.shape; idx = np.random.RandomState(0).permutation(n); cut = int(n * 0.85)
    tr, te = idx[:cut], idx[cut:]
    def loss(w, X, y):
        z = X @ w; p = 1 / (1 + np.exp(-z))
        l = -np.mean(y * np.log(p + 1e-12) + (1 - y) * np.log(1 - p + 1e-12)) + l2 * 0.5 * np.sum(w[1:] ** 2) / len(y)
        g = X.T @ (p - y) / len(y); g[1:] += l2 * w[1:] / len(y)
        return l, g
    w0 = np.zeros(k); w0[0] = np.log((y.mean() + 1e-6) / (1 - y.mean() + 1e-6))
    res = minimize(loss, w0, args=(X[tr], y[tr]), jac=True, method='L-BFGS-B', options={'maxiter': 500})
    w = res.x
    def auc(w, X, y):
        s = X @ w; o = np.argsort(s); r = np.empty(len(s)); r[o] = np.arange(1, len(s) + 1)
        pos = y == 1; return (r[pos].sum() - pos.sum() * (pos.sum() + 1) / 2) / (pos.sum() * (~pos).sum())
    base = -np.mean(y[te] * np.log(y[tr].mean()) + (1 - y[te]) * np.log(1 - y[tr].mean()))
    p = 1 / (1 + np.exp(-(X[te] @ w)))
    ll = -np.mean(y[te] * np.log(p + 1e-12) + (1 - y[te]) * np.log(1 - p + 1e-12))
    print(f'  n={n} pos={y.mean():.3f} test logloss {ll:.4f} (constant {base:.4f})  AUC {auc(w, X[te], y[te]):.3f}')
    return w

d = sys.argv[1]; T, W = load(d)
print('tenpai model'); wt = fit(T)
print('wait model'); ww = fit(W)
js = '/*DEFW*/' + json.dumps({'t': [round(float(x), 4) for x in wt], 'w': [round(float(x), 4) for x in ww]}) + '/*ENDDEFW*/'
if '--write' in sys.argv:
    p = 'src/engine.js'; s = open(p).read()
    s2 = re.sub(r'/\*DEFW\*/.*?/\*ENDDEFW\*/', lambda m: js, s, flags=re.S); assert s2 != s or js in s
    open(p, 'w').write(s2); print('wrote weights into', p)
