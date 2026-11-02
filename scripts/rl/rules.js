// node scripts/rl/rules.js <games> '<json rules>'   -> per-style net/hand + win share + yaku shares for a rule variant
'use strict';
const { spawn } = require('child_process'); const path = require('path'); const os = require('os');
const N = +process.argv[2] || 4000, rules = JSON.parse(process.argv[3] || '{}'), seed = +process.argv[4] || 5000;
const W = Math.min(16, os.cpus().length - 2), per = Math.ceil(N / W) - (Math.ceil(N / W) % 4);   // multiple of 4 so every style sits in every seat equally
const jobs = [];
for (let w = 0; w < W; w++) jobs.push(new Promise(ok => { let out = ''; const p = spawn('node', [path.join(__dirname, 'worker.js'), 'rules', JSON.stringify({ n: per, seed: seed + w * per, rules })]); p.stdout.on('data', d => out += d); p.on('close', () => ok(JSON.parse(out))); }));
Promise.all(jobs).then(rs => {
  const A = { net: [0, 0, 0, 0], wins: [0, 0, 0, 0], fans: [0, 0, 0, 0], games: 0, draws: 0, items: {}, fanH: {} };
  rs.forEach(r => { A.games += r.games; A.draws += r.draws; for (let i = 0; i < 4; i++) { A.net[i] += r.net[i]; A.wins[i] += r.wins[i]; A.fans[i] += r.fans[i]; } for (const k in r.items) A.items[k] = (A.items[k] || 0) + r.items[k]; for (const k in r.fanH) A.fanH[k] = (A.fanH[k] || 0) + r.fanH[k]; });
  const nm = ['dui', 'closed', 'pinfu', 'bal'], g = A.games, tw = A.wins.reduce((a, b) => a + b, 0);
  const o = { rules, games: g, avgFanWin: +(A.fans.reduce((a, b) => a + b, 0) / tw).toFixed(2), style: {} };
  nm.forEach((n, i) => o.style[n] = { netPerHand: +(A.net[i] / g).toFixed(1), winRate: +(A.wins[i] / g).toFixed(3), avgFan: +(A.fans[i] / Math.max(1, A.wins[i])).toFixed(2) });
  o.topYaku = Object.entries(A.items).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, v]) => k + ' ' + (100 * v / tw).toFixed(0) + '%').join(', ');
  console.log(JSON.stringify(o));
});
