// node scripts/sim.js [N]  ->  bot-only games, prints win/fan/condition stats
const E = require('../src/engine.js');
const N = +process.argv[2] || 3000;
let wins = 0, draws = 0, tsumo = 0, pts = 0; const fanH = {}, names = {};
for (let i = 0; i < N; i++) {
  const r = E.simGame();
  if (r.draw) { draws++; continue; }
  wins++; const e = r.res.ev; if (r.res.tsumo) tsumo++;
  fanH[e.fan] = (fanH[e.fan] || 0) + 1; pts += e.points;
  e.items.concat(e.halves).forEach(x => { const n = x.name.replace(/×\d+/, ''); names[n] = (names[n] || 0) + 1; });
}
console.log({ N, wins, draws, tsumo, avgPts: (pts / wins).toFixed(1), fanH, names });
