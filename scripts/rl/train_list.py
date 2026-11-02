#!/usr/bin/env python3
"""Listwise fit: score(f) so that within one decision the candidate ranking matches the rollout values.
usage: python3 scripts/rl/train_list.py out.json "glob/r*_*.f32" [--K 4 --nf 52 --hid 64,32 --epochs 60 --lr 2e-3 --l2 1e-4 --val 0.15]
Rows (from worker.js 'roll'): [groupSize, K x (nf features + qhat)]."""
import sys, json, glob, numpy as np
args = sys.argv[1:]; out = args.pop(0); pat = args.pop(0)
def opt(n, d):
    if n in args:
        i = args.index(n); v = args[i + 1]; del args[i:i + 2]; return v
    return d
K = int(opt('--K', 4)); nf = int(opt('--nf', 52)); hid = [int(x) for x in opt('--hid', '64,32').split(',')]
epochs = int(opt('--epochs', 60)); lr = float(opt('--lr', 2e-3)); l2 = float(opt('--l2', 1e-4)); vfrac = float(opt('--val', 0.15)); seed = int(opt('--seed', 0))
w = 1 + K * (nf + 1)
A = np.concatenate([np.fromfile(f, dtype=np.float32).reshape(-1, w) for f in sorted(glob.glob(pat))])
rng = np.random.default_rng(seed); A = A[rng.permutation(len(A))]
nv = int(len(A) * vfrac); V, T = A[:nv], A[nv:]
def split(D):
    gs = D[:, 0].astype(int); X = D[:, 1:].reshape(len(D), K, nf + 1)
    return gs, X[:, :, :nf], X[:, :, nf]
gsT, XT, QT = split(T); gsV, XV, QV = split(V)
mask = lambda gs: (np.arange(K)[None, :] < gs[:, None])
mT, mV = mask(gsT), mask(gsV)
allx = XT[mT]; mu = allx.mean(0); sd = allx.std(0); sd[sd < 1e-6] = 1
XT = (XT - mu) / sd; XV = (XV - mu) / sd
print('groups', len(T), len(V), 'adv std', float(np.std((QT - np.where(mT, QT, 0).sum(1, keepdims=True) / gsT[:, None])[mT])))
sizes = [nf] + hid + [1]
W = [rng.normal(0, np.sqrt(2 / sizes[i]), (sizes[i], sizes[i + 1])).astype(np.float32) for i in range(len(sizes) - 1)]; W[-1] *= 0.1
B = [np.zeros(sizes[i + 1], np.float32) for i in range(len(sizes) - 1)]
mm = [np.zeros_like(x) for x in W + B]; vv = [np.zeros_like(x) for x in W + B]; t = 0
def fwd(X):  # X (n,K,nf) -> scores (n,K)
    sh = X.shape; h = [X.reshape(-1, nf)]
    for i in range(len(W) - 1): h.append(np.maximum(0, h[-1] @ W[i] + B[i]))
    return h, (h[-1] @ W[-1] + B[-1]).reshape(sh[0], K)
def center(S, m, gs): return np.where(m, S - np.where(m, S, 0).sum(1, keepdims=True) / gs[:, None], 0)
def evalg(X, Q, m, gs):
    _, S = fwd(X); S = np.where(m, S, -1e9)
    pick = S.argmax(1); base = Q[:, 0]   # candidate 0 = heuristic's top choice
    got = Q[np.arange(len(Q)), pick]
    best = np.where(m, Q, -1e9).max(1)
    return float((got - base).mean()), float((best - base).mean()), float((pick == Q.argmax(1)).mean())
def mse(X, Q, m, gs):
    _, S = fwd(X); d = center(S, m, gs) - center(Q, m, gs); return float((d ** 2).sum() / m.sum())
bs = 256
for ep in range(epochs):
    perm = rng.permutation(len(XT)); cur = lr * 0.5 * (1 + np.cos(np.pi * ep / epochs))
    for s in range(0, len(perm), bs):
        idx = perm[s:s + bs]; X, Q, m, gs = XT[idx], QT[idx], mT[idx], gsT[idx]
        h, S = fwd(X); d = center(S, m, gs) - center(Q, m, gs)
        g = (2 * d / m.sum())
        g = g - np.where(m, g, 0).sum(1, keepdims=True) / gs[:, None]; g = np.where(m, g, 0).reshape(-1, 1)
        gW = [None] * len(W); gB = [None] * len(W)
        for i in range(len(W) - 1, -1, -1):
            gW[i] = h[i].T @ g + l2 * W[i]; gB[i] = g.sum(0)
            if i: g = (g @ W[i].T) * (h[i] > 0)
        t += 1
        for k, (P, G) in enumerate(zip(W + B, gW + gB)):
            mm[k] = 0.9 * mm[k] + 0.1 * G; vv[k] = 0.999 * vv[k] + 0.001 * G * G
            P -= cur * (mm[k] / (1 - 0.9 ** t)) / (np.sqrt(vv[k] / (1 - 0.999 ** t)) + 1e-8)
    if ep % 5 == 4 or ep == epochs - 1:
        print('ep', ep, 'mse tr', round(mse(XT, QT, mT, gsT), 5), 'va', round(mse(XV, QV, mV, gsV), 5), 'gain vs heuristic (va): picked, oracle, agree', [round(x, 4) for x in evalg(XV, QV, mV, gsV)], flush=True)
Q = {'mu': mu.tolist(), 'sd': sd.tolist(), 'W1': W[0].T.round(5).tolist(), 'b1': B[0].round(5).tolist(), 'W2': W[1].T.round(5).tolist(), 'b2': B[1].round(5).tolist(), 'w3': W[2][:, 0].round(5).tolist(), 'b3': float(B[2][0])}
json.dump(Q, open(out, 'w')); print('wrote', out)
