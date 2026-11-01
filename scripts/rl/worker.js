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
