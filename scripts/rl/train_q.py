#!/usr/bin/env python3
"""Fit Q(features) -> expected final point delta (/100) for bot discard choices. numpy only.
usage: python3 scripts/rl/train_q.py out_weights.json file1.f32 file2.f32 ... [--hid 96,48] [--epochs 20] [--clip 4]
Last 2 input files are held out for validation. Output JSON is loaded into RULES.Q (engine.js qEval)."""
import sys, json, glob, numpy as np
args = sys.argv[1:]
out = args.pop(0)
def opt(name, d):
    if name in args:
        i = args.index(name); v = args[i + 1]; del args[i:i + 2]; return v
    return d
hid = [int(x) for x in opt('--hid', '96,48').split(',')]
epochs = int(opt('--epochs', 20)); clip = float(opt('--clip', 4)); lr = float(opt('--lr', 2e-3)); l2 = float(opt('--l2', 1e-5))
files = sorted(sum([glob.glob(a) for a in args], []))
nf = None
def load(fs):
    arrs = []
    for f in fs:
        a = np.fromfile(f, dtype=np.float32)
        arrs.append(a)
    a = np.concatenate(arrs)
    return a
raw = [np.fromfile(f, dtype=np.float32) for f in files]
# infer width from first file: rows are (nf+1) floats; caller passes --nf if ambiguous
nfc = int(opt('--nf', 53))
D = [r.reshape(-1, nfc) for r in raw if r.size]
val, tr = D[-2:], D[:-2]
Xtr = np.concatenate([d[:, :-1] for d in tr]); ytr = np.clip(np.concatenate([d[:, -1] for d in tr]), -clip, clip)
Xva = np.concatenate([d[:, :-1] for d in val]); yva = np.clip(np.concatenate([d[:, -1] for d in val]), -clip, clip)
mu = Xtr.mean(0); sd = Xtr.std(0); sd[sd < 1e-6] = 1.0
Z = lambda X: (X - mu) / sd
Xtr, Xva = Z(Xtr).astype(np.float32), Z(Xva).astype(np.float32)
ym = ytr.mean(); print('rows', len(Xtr), len(Xva), 'target mean', round(float(ym), 3), 'std', round(float(ytr.std()), 3))
rng = np.random.default_rng(0)
sizes = [Xtr.shape[1]] + hid + [1]
W = [rng.normal(0, np.sqrt(2 / sizes[i]), (sizes[i], sizes[i + 1])).astype(np.float32) for i in range(len(sizes) - 1)]
B = [np.zeros(sizes[i + 1], np.float32) for i in range(len(sizes) - 1)]
W[-1] *= 0.1; B[-1][:] = ym
m = [np.zeros_like(w) for w in W] + [np.zeros_like(b) for b in B]; v = [np.zeros_like(x) for x in m]; t = 0
def fwd(X):
    hs = [X]
    for i in range(len(W) - 1): hs.append(np.maximum(0, hs[-1] @ W[i] + B[i]))
    return hs, (hs[-1] @ W[-1] + B[-1])[:, 0]
def mse(X, y): return float(np.mean((fwd(X)[1] - y) ** 2))
print('baseline var (predict mean)', round(float(np.mean((yva - ym) ** 2)), 4), 'init val', round(mse(Xva, yva), 4))
bs = 4096; n = len(Xtr)
for ep in range(epochs):
    perm = rng.permutation(n); cur = lr * (0.5 * (1 + np.cos(np.pi * ep / epochs)))
    for s in range(0, n, bs):
        idx = perm[s:s + bs]; X = Xtr[idx]; y = ytr[idx]
        hs, p = fwd(X); g = (2 * (p - y) / len(idx))[:, None]
        gW = [None] * len(W); gB = [None] * len(W)
        for i in range(len(W) - 1, -1, -1):
            gW[i] = hs[i].T @ g + l2 * W[i]; gB[i] = g.sum(0)
            if i: g = (g @ W[i].T) * (hs[i] > 0)
        t += 1
        for k, (P, G) in enumerate(zip(W + B, gW + gB)):
            m[k] = 0.9 * m[k] + 0.1 * G; v[k] = 0.999 * v[k] + 0.001 * G * G
            P -= cur * (m[k] / (1 - 0.9 ** t)) / (np.sqrt(v[k] / (1 - 0.999 ** t)) + 1e-8)
    print('epoch', ep, 'train', round(mse(Xtr[:200000], ytr[:200000]), 4), 'val', round(mse(Xva, yva), 4), flush=True)
Q = {'mu': mu.tolist(), 'sd': sd.tolist(), 'W1': W[0].T.round(5).tolist(), 'b1': B[0].round(5).tolist(), 'W2': W[1].T.round(5).tolist(), 'b2': B[1].round(5).tolist(), 'w3': W[2][:, 0].round(5).tolist(), 'b3': float(B[2][0])}
json.dump(Q, open(out, 'w'))
print('wrote', out)
