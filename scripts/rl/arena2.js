// Paired same-deal arena for bot levels under 兩番起胡 (RULES.MIN_TOTAL = 2).
// node scripts/rl/arena2.js <deals> [candLevel=master] [baseLevel=pro2] [seed] ['{"RULE":value}' candidate-only rule switches]
// Each deal is played 4 times (candidate at each seat) and once-per-seat as all-baseline; the diff of that seat's
// net points is the sample. SE is printed so you know what is noise.
'use strict';
const { fork } = require('child_process'); const os = require('os');
if (process.argv[2] === '--worker') {
  const E = require('../../src/engine.js'); const a = JSON.parse(process.argv[3]);
  const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const seeded = s => { Math.random = mulberry(s); };
  E.RULES.MIN_TOTAL = a.minTotal;
  const PERS = (a.rules || {}).persona || null; if (a.rules) delete a.rules.persona;
  { const r = a.rules || {}; if (r.P2) { Object.assign(E.RULES.P2, r.P2); delete r.P2; } Object.assign(E.RULES, r); }
  const BAL = ['bal', 'bal', 'bal', 'bal'];
  let n = 0, sum = 0, sum2 = 0, cw = 0, bw = 0, cd = 0, bd = 0, cdr = 0, bdr = 0, cfan = 0, bfan = 0;
  for (let k = 0; k < a.n; k++) for (let rot = 0; rot < 4; rot++) {
    const sd = a.seed + k, lv = [a.base, a.base, a.base, a.base]; lv[rot] = a.cand;
    const ps = BAL.slice(); if (PERS) { seeded(sd + 99); ps[rot] = PERS === 'random' ? E.pickPersona() : PERS; }
    seeded(sd); const x = E.simGame(lv, ps, {});
    seeded(sd); const y = E.simGame([a.base, a.base, a.base, a.base], BAL, {});
    const dx = x.draw ? 0 : x.res.delta[rot], dy = y.draw ? 0 : y.res.delta[rot], d = dx - dy;
    n++; sum += d; sum2 += d * d;
    if (x.draw) cdr++; if (y.draw) bdr++;
    if (!x.draw && x.res.winner === rot) { cw++; cfan += x.res.ev.fan; }
    if (!y.draw && y.res.winner === rot) { bw++; bfan += y.res.ev.fan; }
    if (!x.draw && x.res.from === rot && !x.res.tsumo) cd++; if (!y.draw && y.res.from === rot && !y.res.tsumo) bd++;
  }
  process.send({ n, sum, sum2, cw, bw, cd, bd, cdr, bdr, cfan, bfan });
} else {
  const N = +process.argv[2] || 400, cand = process.argv[3] || 'master', base = process.argv[4] || 'pro2', seed0 = +process.argv[5] || 1000;
  const rules = process.argv[6] ? JSON.parse(process.argv[6]) : {}, minTotal = process.env.MINTOT != null ? +process.env.MINTOT : 2;
  const W = Math.max(1, Math.min(16, os.cpus().length - 2)), per = Math.ceil(N / W);
  const rs = []; let done = 0;
  for (let w = 0; w < W; w++) {
    const c = fork(__filename, ['--worker', JSON.stringify({ n: per, seed: seed0 + w * per, cand, base, minTotal, rules })]);
    c.on('message', m => { rs.push(m); if (++done === W) fin(); });
  }
  function fin() {
    const T = { n: 0, sum: 0, sum2: 0, cw: 0, bw: 0, cd: 0, bd: 0, cdr: 0, bdr: 0, cfan: 0, bfan: 0 };
    rs.forEach(r => { for (const k in T) T[k] += r[k]; });
    const m = T.sum / T.n, sd = Math.sqrt(T.sum2 / T.n - m * m), f = x => +x.toFixed(3);
    console.log(JSON.stringify({ cand, base, minTotal, deals: T.n, meanDiff: +m.toFixed(2), se: +(sd / Math.sqrt(T.n)).toFixed(2),
      candWin: f(T.cw / T.n), baseWin: f(T.bw / T.n), candDealIn: f(T.cd / T.n), baseDealIn: f(T.bd / T.n), candDraw: f(T.cdr / T.n), baseDraw: f(T.bdr / T.n),
      candFan: f(T.cfan / Math.max(1, T.cw)), baseFan: f(T.bfan / Math.max(1, T.bw)) }));
  }
}
