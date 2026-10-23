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
      // 彩眼：1-3 同數字、不同花色的兩張可以當眼（pair 寫成 'p1/s1'）
      for (const s2 of ['p', 's', 'm']) {
        const k2 = s2 + k.slice(1);
        if (s2 === k[0] || !(c[k2] > 0)) continue;
        c[k]--; c[k2]--; rec(sets, k + '/' + k2); c[k]++; c[k2]++;
      }
    }
    if (sets.length < need) {
      if (c[k] >= 3) { c[k] -= 3; sets.push({ type: 'pong', k }); rec(sets, pair); sets.pop(); c[k] += 3; }
      if (k[0] !== 'z' && +k.slice(1) <= 3) {
        // 彩刻：1-3 同數字、不同花色的三張可在手牌內自成刻子（全同花色的就是一般刻子）
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

/* ---- 新番種（Wilson 的最終清單）：封頂 6 番，倍數 = 番數 ---- */
const CAP = 6;
function sevenPairsShape(concealed) {
  // 七對子：14 張全是對子（可重複，如 8888 算兩對）；不可彩眼
  if (concealed.length !== 14) return null;
  const c = counts(concealed), pairs = [];
  for (const k of ORDER) {
    const n = c[k] || 0; if (n % 2) return null;
    for (let i = 0; i < n / 2; i++) pairs.push(k);
  }
  return pairs.length === 7 ? { pairs } : null;
}
function flushOf(normalKeys, mixedSets, mixedPairs, mixSuits) {
  // 混一色／清一色（不可彩碰彩眼）；彩眼混一色、彩碰混一色（只有一個混的部份，其餘同一花色＋可有三元）各 1 番
  const suits = new Set(normalKeys.filter(k => k[0] !== 'z').map(k => k[0]));
  const hon = normalKeys.some(k => k[0] === 'z');
  if (suits.size !== 1) return null;
  if (mixedSets === 0 && mixedPairs === 0) return hon ? { name: '混一色', fan: 2 } : { name: '清一色', fan: 4 };
  // 彩眼／彩碰中必須有一張是主色（其餘由另一花色補）
  const main = [...suits][0], hasMain = mixSuits && mixSuits.includes(main);
  if (mixedSets === 0 && mixedPairs === 1) return hasMain ? { name: '彩眼混一色', fan: 1 } : null;
  if (mixedSets === 1 && mixedPairs === 0) return hasMain ? { name: '彩碰混一色', fan: 1 } : null;
  return null;
}
// special: null | '天胡'（莊家起手即胡）| '地胡'（閒家胡莊家第一隻打出的牌）| '人胡'（閒家第一次摸牌自摸，之前無人吃碰槓）
function evaluateHand(melds, concealed, tsumo, winTile, kongDraw, special) {
  const allTiles = concealed.slice(); melds.forEach(m => allTiles.push(...m.tiles));
  let pts = 0;
  concealed.forEach(t => pts += val(t));
  melds.forEach(m => m.tiles.forEach(t => { if (!(m.mixed && t.id === m.claimed)) pts += val(t); }));
  const need = 4 - melds.length;
  if (need < 0) return { ok: false };
  const isConcealed = melds.every(m => !m.open);
  const fixed = (items, bonus, bonusName) => ({ ok: true, items, halves: [], base: 6, total: 6, fan: 6, mult: 6, tilePts: pts + bonus, bonus, bonusName, points: Math.round((pts + bonus) * 6), tsumo });
  const finish = (items, bonus, bonusName, extra) => {
    const base = items.reduce((a, i) => a + i.fan, 0);
    const halves = [];
    const has = n => items.some(i => i.name === n);
    if (base >= 1) {
      const kongs = melds.filter(m => m.type === 'kong').length;
      if (kongs) halves.push({ name: '槓×' + kongs, fan: 0.5 * kongs });
      const bigs = melds.filter(m => m.big).length;
      if (bigs) halves.push({ name: '三元大補槓×' + bigs, fan: 0.5 * bigs });
      if (tsumo && kongDraw) halves.push({ name: '槓上自摸', fan: 0.5 }); // 槓後補牌自摸：與自摸、槓重疊，合計追加 1.5 番
      // 不求人已包含門清與自摸；全大字、門清幺九順、七對子不重複算門清
      const noMen = has('不求人') || has('全大字') || has('門清幺九順') || has('七對子');
      if (isConcealed) { if (!tsumo && !noMen) halves.push({ name: '門清', fan: 0.5 }); }
      else if (tsumo) halves.push({ name: '自摸', fan: 0.5 });
      // 斷一門無三元：缺筒索萬其中一門，且沒有中發白；清一色／混一色不重複
      const suits = new Set(allTiles.filter(t => t.s !== 'z').map(t => t.s));
      if (suits.size < 3 && suits.size !== 1 && !allTiles.some(t => t.s === 'z')) halves.push({ name: '斷一門無三元', fan: 0.5 });
      if (winTile && winTile.s !== 'z' && winTile.n <= 3) halves.push({ name: '胡小字', fan: 0.5 });
    }
    const total = base + halves.reduce((a, h) => a + h.fan, 0);
    const fan = Math.min(CAP, Math.floor(total)), mult = fan;
    const points = Math.round((pts + bonus) * mult);
    return Object.assign({ ok: base >= 1, items, halves, base, total, fan, mult, tilePts: pts + bonus, bonus, bonusName, points, tsumo }, extra || {});
  };
  const cands = [];
  let shapeOk = false;
  // 幺九龍／門清幺九龍：同花 123+456+789 + 中發白各一 + 同花或三元的眼（該牌共三張）；吃的牌只可以是同花 123／456
  if (allTiles.length === 14) {
    const c0 = counts(allTiles);
    for (const su of ['p', 's', 'm']) {
      const keys = []; for (let n = 1; n <= 9; n++) keys.push(su + n); keys.push('z1', 'z2', 'z3');
      if (!keys.every(k => c0[k] >= 1) || !keys.some(k => c0[k] === 3)) continue;
      if (!melds.every(m => m.type === 'chow' && m.tiles[0].s === su && (m.tiles[0].n === 1 || m.tiles[0].n === 4))) continue;
      const nm = isConcealed ? '門清幺九龍' : '幺九龍';
      cands.push(fixed([{ name: nm, fan: 6 }], isConcealed ? 90 : 30, nm)); shapeOk = true;
    }
  }
  // 七對子
  if (!melds.length) {
    const sp = sevenPairsShape(concealed);
    if (sp) {
      shapeOk = true;
      const items = [{ name: '七對子', fan: 2 }];
      const fl = flushOf(sp.pairs.flatMap(k => [k, k]), 0, 0); if (fl) items.push(fl);
      if (isConcealed && tsumo) items.push({ name: '不求人', fan: 2 });
      if (concealed.every(t => t.s !== 'z' && t.n >= 7)) items.push({ name: '全大字', fan: 3 });
      if (concealed.every(t => t.s === 'z' || t.n <= 6)) items.push({ name: '斷大字', fan: 2 });
      cands.push(finish(items, 0, null, { pair: 'seven' }));
    }
  }
  // 一般：N 組 + 眼
  const ds = decomps(counts(concealed), need);
  if (ds.length) shapeOk = true;
  for (const d of ds) {
    const sets = [
      ...melds.map(m => ({ kind: m.type === 'chow' ? 'chow' : 'pong', k: m.tiles[0].k, mixed: !!m.mixed, kong: m.type === 'kong', mkeys: m.mixed ? m.tiles.map(t => t.k) : undefined })),
      ...d.sets.map(s => ({ kind: s.type, k: s.k, keys: s.keys, mixed: !!s.mixed }))
    ];
    const items = []; let bonus = 0, bonusName = null;
    const add = (name, f) => items.push({ name, fan: f });
    const dragonSets = sets.filter(s => s.kind === 'pong' && s.k[0] === 'z'), dr = dragonSets.length;
    const pairMixed = d.pair.includes('/');
    const pairHon = d.pair[0] === 'z' && !pairMixed;
    if (dr === 3 && dragonSets.every(s => s.kong)) { add('槓三元', 6); bonus = 90; bonusName = '槓三元'; }
    else if (dr === 3) { add('大三元', 4); bonus = 60; bonusName = '大三元'; }
    else if (dr === 2 && pairHon && !dragonSets.some(s => s.k === d.pair)) { add('小三元', 3); bonus = 30; bonusName = '小三元'; }
    else for (let i = 0; i < dr; i++) add('三元刻', 1);
    if (sets.every(s => s.kind === 'chow') && !pairHon) add('平胡', 1);
    if (sets.every(s => s.kind === 'pong')) add('對對胡', 1);
    // 暗刻：暗槓算暗刻；榮胡時，靠胡牌完成的刻子算明刻；榮胡進眼（或胡牌可放進順子）不毀暗刻
    let anko = melds.filter(m => m.type === 'kong' && !m.open).length;
    const winK = (!tsumo && winTile) ? winTile.k : null;
    const inChow = (ck, k) => ck[0] === k[0] && +k.slice(1) >= +ck.slice(1) && +k.slice(1) <= +ck.slice(1) + 2;
    const altPlace = winK && (d.pair.split('/').includes(winK) || d.sets.some(s => s.type === 'chow' && inChow(s.k, winK)));
    for (const s of d.sets) if (s.type === 'pong' && !(winK && (s.keys ? s.keys.includes(winK) : s.k === winK) && !altPlace)) anko++;
    if (anko >= 4) add('四暗刻', 4); else if (anko === 3) add('三暗刻', 2);
    // 幺九順：同花 123+456+789，剩下一組可順可碰（可不同花色），眼任意；門清的話是門清幺九順（+30，不重複算門清）
    for (const su of ['p', 's', 'm']) {
      const a = sets.find(s => s.kind === 'chow' && s.k === su + 1), b = sets.find(s => s.kind === 'chow' && s.k === su + 4), c3 = sets.find(s => s.kind === 'chow' && s.k === su + 7);
      if (a && b && c3 && sets.filter(s => s !== a && s !== b && s !== c3).length === 1) {
        if (isConcealed) { add('門清幺九順', 4); bonus = Math.max(bonus, 30); bonusName = bonusName || '門清幺九順'; } else add('幺九順', 3);
        break;
      }
    }
    // 一色系
    const normalKeys = [];
    for (const s of sets) {
      if (s.mixed) continue;
      if (s.kind === 'chow') { const n = +s.k.slice(1); for (let i = 0; i < 3; i++) normalKeys.push(s.k[0] + (n + i)); }
      else normalKeys.push(s.k, s.k, s.k);
    }
    if (!pairMixed) normalKeys.push(d.pair, d.pair);
    const mixSuits = pairMixed ? d.pair.split('/').map(k => k[0]) : (((sets.find(s => s.mixed) || {}).keys || (sets.find(s => s.mixed) || {}).mkeys) || []).map(k => k[0]);
    const fl = flushOf(normalKeys, sets.filter(s => s.mixed).length, pairMixed ? 1 : 0, mixSuits); if (fl) items.push(fl);
    // 混一色／彩眼混一色／彩碰混一色：第一副三元刻不另計（已包含在混一色內）
    if (fl && fl.name !== '清一色') { const di = items.findIndex(x => x.name === '三元刻'); if (di >= 0) items.splice(di, 1); }
    if (allTiles.every(t => t.s !== 'z' && t.n >= 7)) add('全大字', 3);
    if (allTiles.every(t => t.s === 'z' || t.n <= 6)) add('斷大字', 2);
    if (isConcealed && tsumo) add('不求人', 2);
    cands.push(finish(items, bonus, bonusName, { pair: d.pair }));
  }
  // 天胡／地胡／人胡：手牌成形即可（不需另有番種），固定 6 番
  if (special && shapeOk) cands.push(fixed([{ name: special, fan: 6 }], 0, special));
  if (!cands.length) return { ok: false, reason: 'shape' };
  let best = null;
  for (const r of cands) if (!best || (r.ok && !best.ok) || (r.ok === best.ok && r.points > best.points)) best = r;
  return best;
}

/* ---- game state ---- */
function newGame(dealer = 0) {
  const g = { wall: shuffle(makeDeck()), hands: [[], [], [], []], melds: [[], [], [], []], discards: [[], [], [], []], dealer, last: null, over: null, drawN: [0, 0, 0, 0], discardN: 0, calls: 0 };
  for (let r = 0; r < 13; r++) for (let s = 0; s < 4; s++) g.hands[s].push(g.wall.pop());
  return g;
}
function drawTile(g, seat, replacement) {
  if (!g.wall.length) return null;
  const t = replacement ? g.wall.shift() : g.wall.pop();
  g.hands[seat].push(t); g.lastDraw = t; g.lastDrawRep = !!replacement; g.drawN[seat]++;
  return t;
}
function selfOptions(g, seat, noWin) {
  const h = g.hands[seat], ms = g.melds[seat];
  let win = null;
  if (!noWin) {
    // 天胡：莊家起手即胡；人胡：閒家第一次摸牌自摸，之前無人吃碰槓
    const sp = g.calls === 0 && g.drawN[seat] === 1 ? (seat === g.dealer && g.discardN === 0 ? '天胡' : seat !== g.dealer ? '人胡' : null) : null;
    const ev = evaluateHand(ms, h, true, g.lastDraw, g.lastDrawRep, sp); if (ev.ok) win = ev;
  }
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
  const h = g.hands[seat]; g.calls++;
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
  g.discards[seat].push(t); g.last = { t, from: seat }; g.discardN++;
  return t;
}
function claimOptions(g, seat, t, from) {
  const h = g.hands[seat], ms = g.melds[seat];
  const res = { ron: null, pong: [], kong: [], chow: [] };
  const sp = from === g.dealer && seat !== g.dealer && g.discardN === 1 && g.calls === 0 ? '地胡' : null; // 地胡：閒家胡莊家第一隻打出的牌
  const ev = evaluateHand(ms, [...h, t], false, t, false, sp); if (ev.ok) res.ron = ev;
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
  g.calls++;
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
if (typeof module !== 'undefined') module.exports = { RULES, makeDeck, evaluateHand, simGame, newGame, counts, decomps, tname, val, sevenPairsShape };
