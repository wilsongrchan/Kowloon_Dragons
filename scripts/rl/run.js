// node scripts/rl/run.js gen <totalGames> <outPrefix> [weights.json] [eps]
// node scripts/rl/run.js arena <deals> <weights.json> [seed]
'use strict';
const { spawn } = require('child_process'); const path = require('path'); const os = require('os');
const [mode, N, a3, a4, a5] = [process.argv[2], +process.argv[3], process.argv[4], process.argv[5], process.argv[6]];
const W = Math.min(16, os.cpus().length - 2), per = Math.ceil(N / W), outs = [];
const base = mode === 'arena' ? +(a4 && a5 ? a5 : 0) || 1000 : Math.floor(Math.random() * 1e6) * 100;
const jobs = [];
for (let w = 0; w < W; w++) {
  const args = mode === 'gen' ? { n: per, seed: base + w * per, out: `${a3}_${w}.f32`, weights: a4 && a4 !== '-' ? a4 : null, eps: a5 != null ? +a5 : 0.3 }
    : { n: per, seed: base + w * per, weights: a3 };
  jobs.push(new Promise(ok => { let out = ''; const p = spawn('node', [path.join(__dirname, 'worker.js'), mode, JSON.stringify(args)]); p.stdout.on('data', d => out += d); p.stderr.on('data', d => process.stderr.write(d)); p.on('close', () => ok(out.trim())); }));
}
Promise.all(jobs).then(rs => {
  if (mode === 'gen') { let t = 0; rs.forEach(r => { try { t += JSON.parse(r).rows; } catch (e) {} }); console.log('rows', t, 'files', W); return; }
  let n = 0, s = 0, s2 = 0, cw = 0, bw = 0, cd = 0, bd = 0;
  rs.forEach(r => { const o = JSON.parse(r); n += o.n; s += o.sum; s2 += o.sum2; cw += o.cw; bw += o.bw; cd += o.cd; bd += o.bd; });
  const m = s / n, sd = Math.sqrt(s2 / n - m * m), se = sd / Math.sqrt(n);
  console.log(JSON.stringify({ pairs: n, meanDiff: +m.toFixed(2), se: +se.toFixed(2), candWinRate: +(cw / n).toFixed(3), baseWinRate: +(bw / n).toFixed(3), candDealIn: +(cd / n).toFixed(3), baseDealIn: +(bd / n).toFixed(3) }));
});
