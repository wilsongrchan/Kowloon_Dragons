// worker for gen.js / arena.js: node worker.js <mode> <json args>
'use strict';
const fs = require('fs');
const E = require('../../src/engine.js');
const [mode, argj] = [process.argv[2], JSON.parse(process.argv[3])];
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const realRandom = Math.random;
const seeded = s => { Math.random = mulberry(s); };
if (argj.weights) E.RULES.Q = JSON.parse(fs.readFileSync(argj.weights, 'utf8'));
if (argj.eps != null) E.RULES.Q_EPS = argj.eps;
if (argj.lambda != null) E.RULES.Q_LAMBDA = argj.lambda;
const PRO = ['pro', 'pro', 'pro', 'pro'], BAL = ['bal', 'bal', 'bal', 'bal'];
if (mode === 'gen') {   // self-play data: rows of [features..., label]
  const rows = []; let nf = 0;
  for (let k = 0; k < argj.n; k++) {
    seeded(argj.seed + k);
    const r = E.simGame(PRO, BAL, { qrec: [1, 1, 1, 1], qrows: [], useQ: argj.weights ? [1, 1, 1, 1] : null });
    const g = r.g, d = r.draw ? [0, 0, 0, 0] : r.res.delta;
    for (const row of g.qrows) { nf = row.f.length; rows.push(...row.f, d[row.s] / 100); }
  }
  const buf = Buffer.from(new Float32Array(rows).buffer);
  fs.writeFileSync(argj.out, buf); console.log(JSON.stringify({ rows: rows.length / (nf + 1), nf: nf + 1 }));
} else if (mode === 'roll') {   // 每個被選中的決策：前 K 個候選各用 M 個「重洗過的世界」打完，記下平均得分（同一世界、同一組亂數，差異才準）
  const K = argj.K || 4, M = argj.M || 6, PL = argj.pl == null ? 0.15 : argj.pl, NF = 52; const out = []; let groups = 0;
  const hook = (g, seat, pool, ctx) => {
    if (Math.random() > PL) return null;
    const cand = pool.slice().sort((x, y) => y.sc - x.sc).slice(0, K); if (cand.length < 2) return null;
    for (const c of cand) { ctx.a[c.i]--; c.f = E.qFeat(c, ctx); ctx.a[c.i]++; }
    const sums = cand.map(() => 0), saved = Math.random;
    for (let m = 0; m < M; m++) {
      const sd = Math.floor(saved() * 1e9), W = E.cloneWorld(g, seat, true);
      cand.forEach((c, ci) => {
        const wc = E.cloneWorld(W, seat, false), tile = wc.hands[seat].find(x => x.k === c.t.k);
        Math.random = mulberry(sd);
        const t = E.discardTile(wc, seat, tile.id), r = E.continueAfterDiscard(wc, seat, t);
        sums[ci] += r.draw ? 0 : r.res.delta[seat] / 100;
      });
    }
    Math.random = saved;
    out.push(cand.length); for (let ci = 0; ci < K; ci++) { const c = cand[Math.min(ci, cand.length - 1)]; out.push(...c.f, sums[Math.min(ci, cand.length - 1)] / M); }
    groups++;
    const top = pool.slice().sort((x, y) => y.sc - x.sc).slice(0, 4);
    return Math.random() < (argj.eps == null ? 0.3 : argj.eps) ? top[Math.floor(Math.random() * top.length)].t : pool.reduce((x, y) => y.sc > x.sc ? y : x).t;
  };
  for (let k = 0; k < argj.n; k++) { seeded(argj.seed + k); E.simGame(PRO, BAL, { rollHook: hook }); }
  fs.writeFileSync(argj.out, Buffer.from(new Float32Array(out).buffer)); console.log(JSON.stringify({ groups, width: 1 + K * (NF + 1) }));
} else if (mode === 'rules') {   // 規則改動測試：四種打法（對對／門清／平胡／均衡）輪流坐四個位置，看各自的平均得分
  Object.assign(E.RULES, argj.rules || {});
  const ST = [{ routes: ['duidui'], pung: 'any', chow: 'never' }, { routes: ['closed'] }, { routes: ['pinfu', 'twosuit'], chow: 'often' }, {}];
  const names = ['dui', 'closed', 'pinfu', 'bal'], agg = { net: [0, 0, 0, 0], wins: [0, 0, 0, 0], fans: [0, 0, 0, 0], games: 0, draws: 0, items: {}, fanH: {} };
  for (let k = 0; k < argj.n; k++) {
    const rot = k % 4, ps = [0, 1, 2, 3].map(seat => ST[(seat + rot) % 4]);   // seat -> style index
    seeded(argj.seed + k);
    const r = E.simGame(PRO, ps, {}); agg.games++;
    if (r.draw) { agg.draws++; continue; }
    const si = (r.res.winner + rot) % 4; agg.wins[si]++; agg.fans[si] += r.res.ev.fan;
    for (let seat = 0; seat < 4; seat++) agg.net[(seat + rot) % 4] += r.res.delta[seat];
    for (const i of r.res.ev.items) { const nm = i.name.replace(/×\d+/, ''); agg.items[nm] = (agg.items[nm] || 0) + 1; }
    agg.fanH[r.res.ev.fan] = (agg.fanH[r.res.ev.fan] || 0) + 1;
  }
  agg.names = names; console.log(JSON.stringify(agg));
} else if (mode === 'arena') {   // paired: candidate (learned) at seat rot vs all-heuristic on the same deal
  let sum = 0, sum2 = 0, n = 0, cw = 0, bw = 0, cd = 0, bd = 0;
  for (let k = 0; k < argj.n; k++) for (let rot = 0; rot < 4; rot++) {
    const sd = argj.seed + k;
    const useQ = [0, 0, 0, 0]; useQ[rot] = 1;
    seeded(sd); const a = E.simGame(PRO, BAL, { useQ });
    seeded(sd); const b = E.simGame(PRO, BAL, {});
    const da = a.draw ? 0 : a.res.delta[rot], db = b.draw ? 0 : b.res.delta[rot];
    const diff = da - db; sum += diff; sum2 += diff * diff; n++;
    if (!a.draw && a.res.winner === rot) cw++; if (!b.draw && b.res.winner === rot) bw++;
    if (!a.draw && a.res.from === rot && !a.res.tsumo) cd++; if (!b.draw && b.res.from === rot && !b.res.tsumo) bd++;
  }
  console.log(JSON.stringify({ n, sum, sum2, cw, bw, cd, bd }));
}
