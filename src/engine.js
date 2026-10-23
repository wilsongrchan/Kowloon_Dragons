'use strict';
/* ===== 幺九龍 engine (no DOM) ===== */
const RULES = {
  ALLOW_789_ANKAN: false,      // 7-9 可否暗槓（字面解讀：不可）
  PAIR_HONOR_BREAKS_PINGHU: true, // 平胡的將不可以是中發白
  RON_MULT: 2,                 // 出銃者付 2x，自摸每家付 1x
};
const NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const SUITN = { p: '筒', s: '索', m: '萬' };
const HON = { 1: '中', 2: '發', 3: '白' };
const ORDER = [];
for (const s of ['p', 's', 'm']) for (let n = 1; n <= 9; n++) ORDER.push(s + n);
ORDER.push('z1', 'z2', 'z3');
const ORD = {}; ORDER.forEach((k, i) => ORD[k] = i);

const tname = t => t.s === 'z' ? HON[t.n] : NUM[t.n] + SUITN[t.s];
const val = t => t.s === 'z' ? 0 : 10 - t.n;
const sortTiles = a => a.slice().sort((x, y) => ORD[x.k] - ORD[y.k] || x.id - y.id);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function makeDeck() {
  let id = 0; const d = [];
  for (const s of ['p', 's', 'm']) for (let n = 1; n <= 9; n++) for (let c = 0; c < n; c++) d.push({ id: id++, s, n, k: s + n });
  for (let h = 1; h <= 3; h++) for (let c = 0; c < 5; c++) d.push({ id: id++, s: 'z', n: h, k: 'z' + h });
  return d;
}
function counts(tiles) { const c = {}; for (const t of tiles) c[t.k] = (c[t.k] || 0) + 1; return c; }

/* ---- decompose concealed tiles into `need` sets + 1 pair ---- */
function decomps(c0, need) {
  const c = Object.assign({}, c0), res = [];
  (function rec(sets, pair) {
    let k = null;
    for (const o of ORDER) if (c[o] > 0) { k = o; break; }
    if (k === null) { if (sets.length === need && pair) res.push({ pair, sets: sets.slice() }); return; }
    if (sets.length > need) return;
    if (!pair && c[k] >= 2) { c[k] -= 2; rec(sets, k); c[k] += 2; }
    if (!pair && k[0] !== 'z' && +k.slice(1) <= 3) {
      // 小字混眼：1-3 同數字、不同花色的兩張可以當眼（pair 寫成 'p1/s1'）
      for (const s2 of ['p', 's', 'm']) {
        const k2 = s2 + k.slice(1);
        if (s2 === k[0] || !(c[k2] > 0)) continue;
        c[k]--; c[k2]--; rec(sets, k + '/' + k2); c[k]++; c[k2]++;
      }
    }
    if (sets.length < need) {
      if (c[k] >= 3) { c[k] -= 3; sets.push({ type: 'pong', k }); rec(sets, pair); sets.pop(); c[k] += 3; }
      if (k[0] !== 'z' && +k.slice(1) <= 3) {
        // 小字混刻：1-3 同數字、不同花色的三張可在手牌內自成刻子（全同花色的就是一般刻子）
        const nn = k.slice(1), ks3 = ['p', 's', 'm'].map(s => s + nn);
        c[k]--;
        for (let i = 0; i < 3; i++) for (let j = i; j < 3; j++) {
          const a = ks3[i], b = ks3[j];
          if (a === b ? c[a] < 2 : (c[a] < 1 || c[b] < 1)) continue;
          if (new Set([k[0], a[0], b[0]]).size === 1) continue;
          c[a]--; c[b]--; sets.push({ type: 'pong', k, mixed: true, keys: [k, a, b] });
          rec(sets, pair);
          sets.pop(); c[a]++; c[b]++;
        }
        c[k]++;
      }
      if (k[0] !== 'z') {
        const n = +k[1];
        if (n <= 7) {
          const k2 = k[0] + (n + 1), k3 = k[0] + (n + 2);
          if (c[k2] > 0 && c[k3] > 0) {
            c[k]--; c[k2]--; c[k3]--; sets.push({ type: 'chow', k }); rec(sets, pair); sets.pop(); c[k]++; c[k2]++; c[k3]++;
          }
        }
      }
    }
  })([], null);
  return res;
}

/* ---- score a complete 14-tile hand ---- */
function evaluateHand(melds, concealed, tsumo, winTile) {
  const allTiles = concealed.slice(); melds.forEach(m => allTiles.push(...m.tiles));
  let pts = 0;
  concealed.forEach(t => pts += val(t));
  melds.forEach(m => m.tiles.forEach(t => { if (!(m.mixed && t.id === m.claimed)) pts += val(t); }));
  const need = 4 - melds.length;
  if (need < 0) return { ok: false };
  // 幺九龍：同一花色 123+456+789 + 中發白各一 + 同花色或三元的眼（該牌共三張）（該牌共三張）
  if (!melds.length && concealed.length === 14) {
    const c0 = counts(concealed);
    for (const su of ['p', 's', 'm']) {
      const keys = []; for (let n = 1; n <= 9; n++) keys.push(su + n); keys.push('z1', 'z2', 'z3');
      if (keys.every(k => c0[k] >= 1) && keys.some(k => c0[k] === 3)) {
        const points = Math.round((pts + 40) * 4);
        return { ok: true, items: [{ name: '幺九龍', fan: 4 }], halves: [], base: 4, total: 4, fan: 4, mult: 4, tilePts: pts + 40, bonus: 40, bonusName: '幺九龍', points, pair: null, tsumo };
      }
    }
  }
  const ds = decomps(counts(concealed), need);
  if (!ds.length) return { ok: false, reason: 'shape' };
  const isConcealed = melds.every(m => !m.open);
  const suits = new Set(allTiles.filter(t => t.s !== 'z').map(t => t.s));
  const hasHonor = allTiles.some(t => t.s === 'z');
  let best = null;
  for (const d of ds) {
    const sets = [
      ...melds.map(m => ({ kind: m.type === 'chow' ? 'chow' : 'pong', k: m.tiles[0].k })),
      ...d.sets.map(s => ({ kind: s.type, k: s.k, keys: s.keys }))
    ];
    const items = []; let base = 0;
    const add = (name, f) => { items.push({ name, fan: f }); base += f; };
    const dragonSets = sets.filter(s => s.kind === 'pong' && s.k[0] === 'z');
    const dr = dragonSets.length;
    const pairHon = d.pair[0] === 'z';
    let bonus = 0, bonusName = null;
    if (dr === 3) { add('大三元', 4); bonus = 40; bonusName = '大三元'; }
    else if (dr === 2 && pairHon && !dragonSets.some(s => s.k === d.pair)) { add('小三元', 3); bonus = 20; bonusName = '小三元'; }
    else for (let i = 0; i < dr; i++) add('三元刻', 1);
    if (sets.every(s => s.kind === 'chow') && !(RULES.PAIR_HONOR_BREAKS_PINGHU && pairHon)) add('平胡', 1);
    if (sets.every(s => s.kind === 'pong')) add('對對胡', 1);
    // 暗刻：暗槓算暗刻；榮和時，靠胡牌完成的刻子算明刻
    // 榮胡進眼（或胡牌可放進順子）不毀暗刻：只有胡牌別無去處、必須放進該刻子時，該刻才算明刻
    let anko = melds.filter(m => m.type === 'kong' && !m.open).length;
    const winK = (!tsumo && winTile) ? winTile.k : null;
    const inChow = (ck, k) => ck[0] === k[0] && +k.slice(1) >= +ck.slice(1) && +k.slice(1) <= +ck.slice(1) + 2;
    const altPlace = winK && (d.pair.split('/').includes(winK) || d.sets.some(s => s.type === 'chow' && inChow(s.k, winK)));
    for (const s of d.sets) if (s.type === 'pong' && !(winK && (s.keys ? s.keys.includes(winK) : s.k === winK) && !altPlace)) anko++;
    if (anko >= 4) add('四暗刻', 4); else if (anko === 3) add('三暗刻', 2);
    // 幺九順：同花色 123+456+789，剩下一組可順可碰（可不同花色），眼任意
    for (const su of ['p', 's', 'm']) {
      const a = sets.find(s => s.kind === 'chow' && s.k === su + 1), b = sets.find(s => s.kind === 'chow' && s.k === su + 4), c3 = sets.find(s => s.kind === 'chow' && s.k === su + 7);
      if (a && b && c3) { const rest = sets.filter(s => s !== a && s !== b && s !== c3); if (rest.length === 1) { add('幺九順', 3); break; } }
    }
    if (suits.size === 1 && !hasHonor) add('清一色', 3);
    else if (suits.size === 1) add('混一色', 2);
    const oneSuit = suits.size === 1;
    if (allTiles.every(t => t.s !== 'z' && t.n >= 7)) add('全大字', 2);
    if (allTiles.every(t => t.s === 'z' || t.n <= 6)) add('斷大字', 2);
    if (isConcealed && tsumo) add('門清加自摸', 2);

    const halves = [];
    if (base >= 1) {
      const kongs = melds.filter(m => m.type === 'kong').length;
      if (kongs) halves.push({ name: '槓×' + kongs, fan: 0.5 * kongs });
      const bigs = melds.filter(m => m.big).length;
      if (bigs) halves.push({ name: '三元大補槓×' + bigs, fan: 0.5 * bigs });
      const quanDa = items.some(i => i.name === '全大字');
      // 門清加自摸 已包含門清與自摸；全大字 不重複算門清
      if (isConcealed) { if (!tsumo && !quanDa) halves.push({ name: '門清', fan: 0.5 }); }
      else if (tsumo) halves.push({ name: '自摸', fan: 0.5 }); // 門清加自摸已包含自摸
      // 斷一門無三元：缺筒索萬其中一門，且沒有中發白；清一色/混一色不重複
      if (suits.size < 3 && !oneSuit && !hasHonor) halves.push({ name: '斷一門無三元', fan: 0.5 });
      if (winTile && winTile.s !== 'z' && winTile.n <= 3) halves.push({ name: '胡小字', fan: 0.5 });
    }
    const halfSum = halves.reduce((a, h) => a + h.fan, 0);
    const total = base + halfSum;
    const fan = Math.min(4, Math.floor(total));
    const mult = [0, 1, 2, 3, 4][fan];
    const points = Math.round((pts + bonus) * mult);
    const r = { ok: base >= 1, items, halves, base, total, fan, mult, tilePts: pts + bonus, bonus, bonusName, points, pair: d.pair, tsumo };
    if (!best || (r.ok && !best.ok) || (r.ok === best.ok && r.points > best.points)) best = r;
  }
  return best;
}

/* ---- game state ---- */
function newGame(dealer = 0) {
  const g = { wall: shuffle(makeDeck()), hands: [[], [], [], []], melds: [[], [], [], []], discards: [[], [], [], []], dealer, last: null, over: null };
  for (let r = 0; r < 13; r++) for (let s = 0; s < 4; s++) g.hands[s].push(g.wall.pop());
  return g;
}
function drawTile(g, seat, replacement) {
  if (!g.wall.length) return null;
  const t = replacement ? g.wall.shift() : g.wall.pop();
  g.hands[seat].push(t); g.lastDraw = t;
  return t;
}
function selfOptions(g, seat, noWin) {
  const h = g.hands[seat], ms = g.melds[seat];
  let win = null;
  if (!noWin) { const ev = evaluateHand(ms, h, true, g.lastDraw); if (ev.ok) win = ev; }
  const kongs = []; const c = counts(h);
  for (const k in c) {
    const hon = k[0] === 'z', n = +k[1];
    if (c[k] >= 4 && (hon || (n >= 4 && (n <= 6 || RULES.ALLOW_789_ANKAN)))) kongs.push({ kind: 'ankan', k, count: 4 }); // 小字(1-3)不能槓、不能暗槓
    if (hon && c[k] >= 5) kongs.push({ kind: 'ankan', k, count: 5, big: true });
  }
  ms.forEach((m, i) => {
    const k = m.tiles[0].k;
    if (m.type === 'pong' && !m.mixed && (k[0] === 'z' || +k.slice(1) >= 4) && c[k] >= 1) kongs.push({ kind: 'add', meldIndex: i, k, count: 4 });
    if (m.type === 'kong' && !m.big && k[0] === 'z' && c[k] >= 1) kongs.push({ kind: 'add', meldIndex: i, k, count: 5, big: true });
  });
  return { win, kongs };
}
function removeTile(arr, t) { const i = arr.findIndex(x => x.id === t.id); if (i >= 0) arr.splice(i, 1); }
function applyKong(g, seat, opt) {
  const h = g.hands[seat];
  if (opt.kind === 'ankan') {
    const ts = h.filter(t => t.k === opt.k).slice(0, opt.count);
    ts.forEach(t => removeTile(h, t));
    g.melds[seat].push({ type: 'kong', tiles: ts, open: false, mixed: false, claimed: null, big: !!opt.big });
  } else {
    const m = g.melds[seat][opt.meldIndex];
    const t = h.find(x => x.k === opt.k); removeTile(h, t);
    m.tiles.push(t); m.type = 'kong'; if (opt.big) m.big = true;
  }
}
function discardTile(g, seat, id) {
  const t = g.hands[seat].find(x => x.id === id);
  removeTile(g.hands[seat], t);
  g.discards[seat].push(t); g.last = { t, from: seat };
  return t;
}
function claimOptions(g, seat, t, from) {
  const h = g.hands[seat], ms = g.melds[seat];
  const res = { ron: null, pong: [], kong: [], chow: [] };
  const ev = evaluateHand(ms, [...h, t], false, t); if (ev.ok) res.ron = ev;
  const hon = t.s === 'z';
  if (!(hon || t.n <= 6)) return res;           // 7-9 不可吃碰槓
  const same = h.filter(x => x.k === t.k);
  if (same.length >= 2) res.pong.push({ tiles: same.slice(0, 2), mixed: false });
  if (same.length >= 3 && (hon || t.n >= 4)) res.kong.push({ tiles: same.slice(0, 3), mixed: false }); // 小字不能槓
  if (!hon && t.n <= 3) {
    const cand = h.filter(x => x.s !== 'z' && x.n === t.n), seen = new Set();
    for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) {
      const a = cand[i], b = cand[j];
      if (a.s === t.s && b.s === t.s) continue;
      const key = [a.s, b.s].sort().join('');
      if (seen.has(key)) continue; seen.add(key);
      res.pong.push({ tiles: [a, b], mixed: true });
    }
  }
  if (!hon && from === (seat + 3) % 4) {
    for (const [a, b] of [[-2, -1], [-1, 1], [1, 2]]) {
      const n1 = t.n + a, n2 = t.n + b;
      if (n1 < 1 || n2 < 1 || n1 > 6 || n2 > 6) continue; // 吃的順子不可含 7-9（有56也不可吃7，有78也不可吃6）
      const t1 = h.find(x => x.s === t.s && x.n === n1), t2 = h.find(x => x.s === t.s && x.n === n2);
      if (t1 && t2) res.chow.push({ tiles: [t1, t2], mixed: false });
    }
  }
  return res;
}
function applyClaim(g, seat, kind, opt, t, from) {
  opt.tiles.forEach(x => removeTile(g.hands[seat], x));
  const d = g.discards[from]; if (d.length && d[d.length - 1].id === t.id) d.pop();
  const tiles = [...opt.tiles, t].sort((a, b) => (a.n - b.n) || (ORD[a.k] - ORD[b.k]));
  g.melds[seat].push({ type: kind === 'chow' ? 'chow' : kind === 'pong' ? 'pong' : 'kong', tiles, open: true, mixed: !!opt.mixed, claimed: opt.mixed ? t.id : null, big: false });
  g.last = null;
}
function winResult(g, seat, tsumo, from, ev) {
  const delta = [0, 0, 0, 0];
  if (tsumo) { for (let s = 0; s < 4; s++) if (s !== seat) { delta[s] -= ev.points; delta[seat] += ev.points; } }
  else { const p = ev.points * RULES.RON_MULT; delta[from] -= p; delta[seat] += p; }
  return { winner: seat, tsumo, from, ev, delta };
}

/* ---- bots ---- */
function botDiscard(g, seat) {
  const h = g.hands[seat], c = counts(h), sc = { p: 0, s: 0, m: 0 };
  h.forEach(t => { if (t.s !== 'z') sc[t.s]++; }); g.melds[seat].forEach(m => m.tiles.forEach(t => { if (t.s !== 'z') sc[t.s]++; }));
  let best = null, bs = 1e9;
  for (const t of h) {
    let s = (c[t.k] - 1) * 3 + Math.random() * 0.8;
    if (t.s === 'z') s += c[t.k] >= 2 ? 1 : -1;
    else {
      const g1 = d => c[t.s + (t.n + d)] || 0;
      s += g1(-1) * 2 + g1(1) * 2 + g1(-2) + g1(2) + sc[t.s] * 0.3 + val(t) * 0.05;
    }
    if (s < bs) { bs = s; best = t; }
  }
  return best;
}
function botSelf(g, seat, opts) {
  if (opts.win) return { win: true };
  if (opts.kongs.length && Math.random() < 0.6) return { kong: opts.kongs[0] };
  return { discard: botDiscard(g, seat).id };
}
function botClaims(g, from, t, skip = []) {
  for (let i = 1; i < 4; i++) {
    const s = (from + i) % 4; if (skip.includes(s)) continue;
    const o = claimOptions(g, s, t, from);
    if (o.ron) return { seat: s, kind: 'ron', ev: o.ron };
  }
  for (let i = 1; i < 4; i++) {
    const s = (from + i) % 4; if (skip.includes(s)) continue;
    const o = claimOptions(g, s, t, from);
    if (o.kong.length && Math.random() < 0.5) return { seat: s, kind: 'kong', opt: o.kong[0] };
    if (o.pong.length) {
      const nat = o.pong.find(p => !p.mixed);
      const p = nat || (Math.random() < 0.3 ? o.pong[0] : null);
      if (p && (t.s === 'z' || Math.random() < 0.45)) return { seat: s, kind: 'pong', opt: p };
    }
  }
  const s = (from + 1) % 4;
  if (!skip.includes(s)) {
    const o = claimOptions(g, s, t, from);
    if (o.chow.length && Math.random() < 0.2) return { seat: s, kind: 'chow', opt: o.chow[0] };
  }
  return null;
}

/* ---- headless simulation (all four seats are bots) ---- */
function simGame() {
  const g = newGame(0);
  let seat = 0, rep = false, needDraw = true, guard = 0;
  while (guard++ < 2000) {
    if (needDraw) { if (!drawTile(g, seat, rep)) return { draw: true, g }; }
    const drew = needDraw; needDraw = true; rep = false;
    const opts = selfOptions(g, seat, !drew);
    const act = botSelf(g, seat, opts);
    if (act.win) return { res: winResult(g, seat, true, null, opts.win), g };
    if (act.kong) { applyKong(g, seat, act.kong); rep = true; continue; }
    const t = discardTile(g, seat, act.discard);
    const c = botClaims(g, seat, t, []);
    if (c) {
      if (c.kind === 'ron') { const ev = c.ev; return { res: winResult(g, c.seat, false, seat, ev), g }; }
      applyClaim(g, c.seat, c.kind, c.opt, t, seat);
      seat = c.seat; if (c.kind === 'kong') { rep = true; } else needDraw = false;
      continue;
    }
    seat = (seat + 1) % 4;
  }
  return { draw: true, g };
}
if (typeof module !== 'undefined') module.exports = { RULES, makeDeck, evaluateHand, simGame, newGame, counts, decomps, tname, val };
