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
  // 混一色／清一色（不可彩碰彩眼）；彩一色（只有一個混的部份＝彩眼或一組彩碰，其餘同一花色＋可有三元）1 番
  const suits = new Set(normalKeys.filter(k => k[0] !== 'z').map(k => k[0]));
  const hon = normalKeys.some(k => k[0] === 'z');
  if (suits.size !== 1) return null;
  if (mixedSets === 0 && mixedPairs === 0) return hon ? { name: '混一色', fan: 2 } : { name: '清一色', fan: 4 };
  // 彩眼／彩碰中必須有一張是主色（其餘由另一花色補）
  const main = [...suits][0], hasMain = mixSuits && mixSuits.includes(main);
  if (mixedSets === 0 && mixedPairs === 1) return hasMain ? { name: '彩一色', fan: 1 } : null;
  if (mixedSets === 1 && mixedPairs === 0) return hasMain ? { name: '彩一色', fan: 1 } : null;
  return null;
}
// special: null | '天胡'（莊家起手即胡）| '地胡'（閒家胡莊家第一隻打出的牌）| '人胡'（閒家第一次摸牌自摸，之前無人吃碰槓）
function evaluateHand(melds, concealed, tsumo, winTile, kongDraw, special, lastTile) {
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
      if (tsumo && lastTile) halves.push({ name: '海底撈月', fan: 0.5 }); // 摸牌山最後一張自摸：與自摸重疊
      if (tsumo && kongDraw) halves.push({ name: '槓上自摸', fan: 0.5 }); // 槓後補牌自摸：與自摸、槓重疊，合計追加 1.5 番
      // 不求人已包含門清與自摸；全小字、門清幺九順、七對子不重複算門清
      const noMen = has('不求人') || has('全小字') || has('門清幺九順') || has('七對子');
      if (isConcealed) { if (!tsumo && !noMen) halves.push({ name: '門清', fan: 0.5 }); }
      else if (tsumo) halves.push({ name: '自摸', fan: 0.5 });
      // 斷一門無三元：缺筒索萬其中一門，且沒有中發白；清一色／混一色不重複
      const suits = new Set(allTiles.filter(t => t.s !== 'z').map(t => t.s));
      if (suits.size < 3 && suits.size !== 1 && !allTiles.some(t => t.s === 'z')) halves.push({ name: '斷一門無三元', fan: 0.5 });
      if (winTile && winTile.s !== 'z' && winTile.n <= 3) halves.push({ name: '胡大字', fan: 0.5 });
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
      if (concealed.every(t => t.s !== 'z' && t.n >= 7)) items.push({ name: '全小字', fan: 3 });
      if (concealed.every(t => t.s === 'z' || t.n <= 6)) items.push({ name: '斷小字', fan: 2 });
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
    if (anko >= 4) { add('四暗刻', 4); const ai = items.findIndex(x => x.name === '對對胡'); if (ai >= 0) items.splice(ai, 1); } // 四暗刻不重複算對對胡
    else if (anko === 3) add('三暗刻', 2);
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
    // 混一色／彩一色：第一副三元刻不另計（已包含在混一色內）
    if (fl && fl.name !== '清一色') { const di = items.findIndex(x => x.name === '三元刻'); if (di >= 0) items.splice(di, 1); }
    if (allTiles.every(t => t.s !== 'z' && t.n >= 7)) add('全小字', 3);
    if (allTiles.every(t => t.s === 'z' || t.n <= 6)) add('斷小字', 2);
    if (isConcealed && tsumo) add('不求人', 2);
    cands.push(finish(items, bonus, bonusName, { pair: d.pair, sets: d.sets }));
  }
  // 天胡／地胡／人胡：手牌成形即可（不需另有番種），固定 6 番
  if (special && shapeOk) cands.push(fixed([{ name: special, fan: 6 }], 30, special));
  if (!cands.length) return { ok: false, reason: 'shape' };
  let best = null;
  for (const r of cands) if (!best || (r.ok && !best.ok) || (r.ok === best.ok && r.points > best.points)) best = r;
  return best;
}

/* ---- game state ---- */
function newGame(dealer = 0) {
  const g = { wall: shuffle(makeDeck()), hands: [[], [], [], []], melds: [[], [], [], []], discards: [[], [], [], []], dealer, last: null, over: null, drawN: [0, 0, 0, 0], discardN: 0, calls: 0 };
  for (let r = 0; r < 13; r++) for (let s = 0; s < 4; s++) g.hands[s].push(g.wall.pop());
  g.persona = g.hands.map(() => pickPersona()); g.persona0 = g.persona.slice();
  return g;
}
function drawTile(g, seat, replacement) {
  if (!g.wall.length) return null;
  const t = replacement ? g.wall.shift() : g.wall.pop();
  g.hands[seat].push(t); g.lastDraw = t; g.lastDrawRep = !!replacement; g.lastDrawLast = g.wall.length === 0; g.drawN[seat]++;
  return t;
}
function selfOptions(g, seat, noWin) {
  const h = g.hands[seat], ms = g.melds[seat];
  let win = null;
  if (!noWin) {
    // 天胡：莊家起手即胡；人胡：閒家第一次摸牌自摸，之前無人吃碰槓
    const sp = g.calls === 0 && g.drawN[seat] === 1 ? (seat === g.dealer && g.discardN === 0 ? '天胡' : seat !== g.dealer ? '人胡' : null) : null;
    const ev = evaluateHand(ms, h, true, g.lastDraw, g.lastDrawRep, sp, g.lastDrawLast); if (ev.ok) win = ev;
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
function easyDiscard(g, seat) {
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
function easySelf(g, seat, opts) {
  if (opts.win) return { win: true };
  if (opts.kongs.length && Math.random() < 0.6) return { kong: opts.kongs[0] };
  return { discard: easyDiscard(g, seat).id };
}
function easyClaim(g, s, from, t, o) {
  if (o.kong.length && Math.random() < 0.5) return { seat: s, kind: 'kong', opt: o.kong[0] };
  if (o.pong.length) {
    const nat = o.pong.find(p => !p.mixed);
    const p = nat || (Math.random() < 0.3 ? o.pong[0] : null);
    if (p && (t.s === 'z' || Math.random() < 0.45)) return { seat: s, kind: 'pong', opt: p };
  }
  return null;
}
function easyChow(g, s, from, t, o) { return o.chow.length && Math.random() < 0.2 ? { seat: s, kind: 'chow', opt: o.chow[0] } : null; }
function botClaims(g, from, t, skip = []) {
  for (let i = 1; i < 4; i++) {
    const s = (from + i) % 4; if (skip.includes(s)) continue;
    const o = claimOptions(g, s, t, from);
    if (o.ron && !(proLevel(g, s) && greedDecline(g, s, o.ron, t, false))) return { seat: s, kind: 'ron', ev: o.ron };
  }
  for (let i = 1; i < 4; i++) {
    const s = (from + i) % 4; if (skip.includes(s)) continue;
    const o = claimOptions(g, s, t, from);
    const c = proLevel(g, s) ? proClaim(g, s, from, t, o) : easyClaim(g, s, from, t, o);
    if (c) return c;
  }
  const s = (from + 1) % 4;
  if (!skip.includes(s)) {
    const o = claimOptions(g, s, t, from);
    const c = proLevel(g, s) ? proChow(g, s, from, t, o) : easyChow(g, s, from, t, o);
    if (c) return c;
  }
  return null;
}

/* ---- 高手電腦：算向聽數、看牌效率與場上形勢（鳴牌、已見牌），不亂打 ---- */
RULES.BOT_LEVEL = 'easy';   // 'easy' | 'pro'；模擬時可用 g.botLv[seat] 逐家指定
// 貪番（像真人一樣：牌山還長、手上已能胡時，放掉小胡，改做更大的牌）
RULES.PRO_GREED = true;
RULES.GREED_WALL = 56;   // 牌山至少剩這麼多張才肯放棄胡牌
RULES.GREED_KEEP = 30;   // 目標做到一半，牌山剩不到這個數就放棄目標，回頭保底
RULES.GREED_EV = 0.9;    // 預估期望值 ≥ 現有胡牌 × 這個比例，就賭一把
/* ---- 高手電腦的「性格」：每位電腦開局依手牌隨機組合幾個特點（可疊加），不是個個都像同一個人 ----
   routes：偏好的路線（番數加成 ×2.5；其他路線在還差 2 步以上時多算 1 步，前期會往偏好走）
   pung：'any' 能碰就碰／'dragon' 只碰三元／預設 看向聽數；chow：'never' 不吃／'often' 愛吃
   def：防守程度（<1 莽、>1 謹慎）；bon：番數加成權重（小＝求快、大＝求大）
   一場遊戲開始時每位電腦挑一次，整場不變（重新整理或離開再回來才重抽）；
   偏好的路線比最近的路線慢 3 步以上就放棄路線（轉向，只限這一手），其餘特點照舊。 */
RULES.PERSONA = true;
const ROUTE_ZH = { twosuit: '缺一門', nosmall: '斷小字', flush: '一色', duidui: '對對', dragon: '三元', closed: '門清', seven: '七對', pinfu: '平胡' };
function mkPersona(o) {
  const P = Object.assign({ routes: [], pung: null, chow: null, def: 1, bon: 0.4 }, o);
  const tags = P.routes.map(r => ROUTE_ZH[r]);
  if (P.pung === 'any') tags.push('愛碰'); if (P.pung === 'dragon') tags.push('只碰三元');
  if (P.chow === 'never') tags.push('不吃'); if (P.chow === 'often') tags.push('愛吃');
  if (P.def < 1) tags.push('莽'); if (P.def > 1) tags.push('謹慎');
  if (P.bon < 0.3) tags.push('求快'); if (P.bon > 0.5) tags.push('求大');
  P.label = tags.join('・') || '均衡';
  return P;
}
const PERSONA_BAL = mkPersona({});
function pickPersona() {   // 開局（一場）挑一次，之後整場不變；每手牌的路線若不合手牌會自己轉向
  if (!RULES.PERSONA) return PERSONA_BAL;
  const R = Math.random;
  const fit = { nosmall: 0.2, flush: 0.18, duidui: 0.14, dragon: 0.14, closed: 0.16, seven: 0.05, pinfu: 0.12 };
  let routes = Object.keys(fit).filter(k => R() < fit[k]);
  if (routes.includes('closed')) routes = routes.filter(r => r !== 'duidui' && r !== 'dragon');
  if (routes.length > 3) routes = routes.sort(() => R() - 0.5).slice(0, 3);
  const closed = routes.includes('closed');
  const pr = R(), cr = R(), dr = R(), br = R();
  return mkPersona({
    routes,
    pung: closed ? null : pr < 0.22 ? 'any' : pr < 0.32 ? 'dragon' : null,
    chow: cr < 0.12 ? 'never' : cr < 0.27 && !closed ? 'often' : null,
    def: dr < 0.22 ? 0.5 : dr < 0.47 ? 1.6 : 1,
    bon: br < 0.25 ? 0.2 : br < 0.5 ? 0.7 : 0.4,
  });
}
let PRO_P = null;        // 目前這位電腦的性格（planList 會依此調整各路線）
function applyPersona(plans, a, melds) {
  const P = PRO_P; if (!P || !P.routes.length) return;
  let su = -1;
  if (P.routes.includes('flush')) {   // 主花色：手牌＋鳴牌裡最多的一門
    const cnt = [0, 0, 0]; for (let i = 0; i < 27; i++) cnt[Math.floor(i / 9)] += a[i];
    melds.forEach(m => m.tiles.forEach(t => { if (t.s !== 'z') cnt[ORD[t.s + 1] / 9]++; }));
    su = cnt.indexOf(Math.max(...cnt));
    // 一色＋對對疊加：同花色全刻子的專用路線
    if (P.routes.includes('duidui') && melds.every(m => m.type !== 'chow' && m.tiles.every(t => t.s === 'z' || ORD[t.s + 1] === su * 9))) {
      const mk = a.map((v, i) => (i >= 27 || Math.floor(i / 9) === su) ? v : 0), cnt2 = mk.reduce((x, y) => x + y, 0);
      plans.push({ n: 'fdui', sh: shanten(mk, 4 - melds.length, 'duidui') + Math.max(0, 13 - 3 * melds.length - cnt2), b: 60 });
    }
  }
  if (P.routes.includes('twosuit')) {   // 缺一門（沒有三元）：只用手牌＋鳴牌裡最多的兩門
    const cnt = [0, 0, 0]; for (let i = 0; i < 27; i++) cnt[Math.floor(i / 9)] += a[i];
    melds.forEach(m => m.tiles.forEach(t => { if (t.s !== 'z') cnt[ORD[t.s + 1] / 9]++; }));
    const out = cnt.indexOf(Math.min(...cnt));
    if (!melds.some(m => m.tiles.some(t => t.s === 'z' || ORD[t.s + 1] === out * 9))) plans.push({ n: 'twosuit', sh: shanten(a.map((v, i) => (i < 27 && Math.floor(i / 9) !== out) ? v : 0), 4 - melds.length, 'normal'), b: 14 });
  }
  for (const p of plans) {
    if (p.n === 'goal' || p.n === 'any') continue;
    const fav = p.n === 'fdui' || P.routes.includes(p.n) || (p.n.startsWith('flush') && +p.n.slice(5) === su);
    if (fav) p.b *= 2.5; else if (p.sh >= 2) p.sh += 1;
  }
}
function personaOf(g, seat) { return (g.persona && g.persona[seat]) || PERSONA_BAL; }
let PRO_G = null;        // 目前這位高手的目標 {t:'pure'|'dui', su, fan, dv}，planList 會多算一條 'goal' 路線
function proGoal(g, seat) {
  const G = g.goal && g.goal[seat];
  if (G && g.wall.length < RULES.GREED_KEEP) { g.goal[seat] = null; return null; }
  return G || null;
}
function proLevel(g, seat) { return ((g.botLv && g.botLv[seat]) || RULES.BOT_LEVEL) === 'pro'; }
const NK = ORDER.length;                                    // 30 種牌，順序同 ORDER：p1-9 s1-9 m1-9 z1-3
const copiesIdx = i => i >= 27 ? 5 : (i % 9) + 1;           // 引擎編號 n 有 n 張
const idxOf = k => ORD[k];
function arrOf(tiles) { const a = new Array(NK).fill(0); for (const t of tiles) a[ORD[t.k]]++; return a; }

// 向聽數（還差幾步聽牌；-1 = 已成形）。mode：closed/normal 一般、pinfu 只順子、duidui 只刻子、flush 已預先清掉其他花色
const SH_CACHE = new Map();
function shanten(c0, need, mode, init) {
  const key = mode + need + (init ? init.s + '.' + init.p : '') + c0.join('');
  const hit = SH_CACHE.get(key); if (hit !== undefined) return hit;
  const c = c0.slice(), useChow = mode !== 'duidui', usePung = mode !== 'pinfu', useMixed = mode !== 'pinfu', honPair = mode !== 'pinfu';
  let best = 99;
  const rec = (i, s, p, pr) => {
    while (i < NK && c[i] === 0) i++;
    if (i === NK) { const v = 2 * need - 2 * s - Math.min(p, need - s) - pr; if (v < best) best = v; return; }
    const n = i % 9, z = i >= 27;
    if (usePung && s < need && c[i] >= 3) { c[i] -= 3; rec(i, s + 1, p, pr); c[i] += 3; }
    if (useChow && s < need && !z && n <= 6 && c[i + 1] > 0 && c[i + 2] > 0) { c[i]--; c[i + 1]--; c[i + 2]--; rec(i, s + 1, p, pr); c[i]++; c[i + 1]++; c[i + 2]++; }
    if (useMixed && s < need && !z && n <= 2) {
      const ks = [n, 9 + n, 18 + n], si = Math.floor(i / 9);
      c[i]--;
      for (let a = 0; a < 3; a++) for (let b = a; b < 3; b++) {
        const x = ks[a], y = ks[b];
        if (x === y ? c[x] < 2 : (c[x] < 1 || c[y] < 1)) continue;
        if (si === a && a === b && x === i) continue;
        if (new Set([si, a, b]).size === 1) continue;
        c[x]--; c[y]--; rec(i, s + 1, p, pr); c[x]++; c[y]++;
      }
      c[i]++;
    }
    if (!pr && c[i] >= 2 && (honPair || !z)) { c[i] -= 2; rec(i, s, p, 1); c[i] += 2; }
    if (!pr && useMixed && !z && n <= 2) for (let d = Math.floor(i / 9) + 1; d < 3; d++) { const j = d * 9 + n; if (c[j] > 0) { c[i]--; c[j]--; rec(i, s, p, 1); c[i]++; c[j]++; } }
    if (s + p < need) {
      if (mode !== 'pinfu' && c[i] >= 2) { c[i] -= 2; rec(i, s, p + 1, pr); c[i] += 2; }
      if (useMixed && !z && n <= 2) for (let d = Math.floor(i / 9) + 1; d < 3; d++) { const j = d * 9 + n; if (c[j] > 0) { c[i]--; c[j]--; rec(i, s, p + 1, pr); c[i]++; c[j]++; } }
      if (useChow && !z) {
        if (n <= 7 && c[i + 1] > 0) { c[i]--; c[i + 1]--; rec(i, s, p + 1, pr); c[i]++; c[i + 1]++; }
        if (n <= 6 && c[i + 2] > 0) { c[i]--; c[i + 2]--; rec(i, s, p + 1, pr); c[i]++; c[i + 2]++; }
      }
    }
    c[i]--; rec(i, s, p, pr); c[i]++;
  };
  rec(0, init ? init.s : 0, init ? init.p : 0, 0);
  if (SH_CACHE.size > 60000) SH_CACHE.clear();
  SH_CACHE.set(key, best); return best;
}

// 各條「路線」的向聽數與番數價值：沒有任何一條成形就不算胡（一番起胡）
function planList(a, melds) {
  const need = 4 - melds.length, open = melds.some(m => m.open);
  const plans = [];
  const mTiles = melds.flatMap(m => m.tiles);
  const allChow = melds.every(m => m.type === 'chow'), allPung = melds.every(m => m.type !== 'chow');
  const dragonMeld = melds.some(m => m.tiles[0].s === 'z');
  const mask = f => a.map((v, i) => f(i) ? v : 0);
  if (!open) plans.push({ n: 'closed', sh: shanten(a, need, 'normal') + 1, b: 8 });          // 門清自摸（不求人）：只能靠自摸
  if (allChow && !dragonMeld) plans.push({ n: 'pinfu', sh: shanten(mask(i => i < 27), need, 'pinfu'), b: 12 });
  if (allPung) plans.push({ n: 'duidui', sh: shanten(a, need, 'duidui'), b: 14 });
  if (dragonMeld) plans.push({ n: 'dragon', sh: shanten(a, need, 'normal'), b: 24 });
  else for (let z = 27; z < 30; z++) {
    if (a[z] >= 3) { const c = a.slice(); c[z] -= 3; plans.push({ n: 'dragon', sh: shanten(c, need, 'normal', { s: 1, p: 0 }), b: 24 }); }
    else if (a[z] === 2) { const c = a.slice(); c[z] -= 2; plans.push({ n: 'dragon', sh: shanten(c, need, 'normal', { s: 0, p: 1 }) + 0, b: 24 }); }
  }
  if (!mTiles.some(t => t.s !== 'z' && t.n >= 7)) plans.push({ n: 'nosmall', sh: shanten(mask(i => i >= 27 || i % 9 <= 5), need, 'normal'), b: 30 });
  for (let su = 0; su < 3; su++) {
    if (mTiles.some(t => t.s !== 'z' && ORD[t.s + 1] !== su * 9)) continue;
    plans.push({ n: 'flush' + su, sh: shanten(mask(i => i >= 27 || Math.floor(i / 9) === su), need, 'normal'), b: 28 });
  }
  if (!melds.length) { let pr = 0; for (let i = 0; i < NK; i++) pr += a[i] >> 1; plans.push({ n: 'seven', sh: 6 - Math.min(7, pr), b: 28 }); }
  if (PRO_G) {   // 目標路線：清一色（把字牌換掉）／對對（把順子換成刻子）；少了的牌每張要多摸一次
    const su = PRO_G.su, pure = PRO_G.t === 'pure';
    const ok = pure ? melds.every(m => m.tiles.every(t => t.s !== 'z' && ORD[t.s + 1] === su * 9)) : melds.every(m => m.type !== 'chow' && m.tiles.every(t => t.s === 'z' || ORD[t.s + 1] === su * 9));
    if (ok) {
      const mk = mask(i => (pure ? i < 27 : true) && (i >= 27 ? !pure : Math.floor(i / 9) === su));
      const cnt = mk.reduce((x, y) => x + y, 0), pad = Math.max(0, 13 - 3 * melds.length - cnt);
      plans.push({ n: 'goal', sh: shanten(mk, need, pure ? 'normal' : 'duidui') + pad, b: 60 });
    }
  }
  if (!plans.length) plans.push({ n: 'any', sh: shanten(a, need, 'normal') + 2, b: 0 });
  applyPersona(plans, a, melds);
  return plans;
}
const bestSh = plans => plans.reduce((m, p) => Math.min(m, p.sh), 99);

// 場上還看不到的牌：總數 − 自己手牌 − 所有鳴牌 − 所有棄牌
function unseenArr(g, seat) {
  const u = []; for (let i = 0; i < NK; i++) u.push(copiesIdx(i));
  g.hands[seat].forEach(t => u[ORD[t.k]]--);
  g.melds.forEach(ms => ms.forEach(m => m.tiles.forEach(t => u[ORD[t.k]]--)));
  g.discards.forEach(d => d.forEach(t => u[ORD[t.k]]--));
  return u.map(v => Math.max(0, v));
}
function relevantKeys(a) {
  const r = new Set();
  for (let i = 0; i < NK; i++) if (a[i] > 0) {
    r.add(i); if (i >= 27) continue;
    const su = Math.floor(i / 9), n = i % 9;
    for (let d = -2; d <= 2; d++) if (n + d >= 0 && n + d <= 8) r.add(su * 9 + n + d);
    if (n <= 2) for (let s2 = 0; s2 < 3; s2++) r.add(s2 * 9 + n);
  }
  return [...r];
}
// 摸到哪些牌會讓某條路線前進（進張數）
function ukeire(a, melds, u, planNames, cur) {
  let tot = 0;
  for (const x of relevantKeys(a)) {
    if (!u[x]) continue;
    a[x]++;
    const pl = planList(a, melds).filter(p => planNames.has(p.n));
    a[x]--;
    if (bestSh(pl) < cur) tot += u[x];
  }
  return tot;
}

// 對手威脅：鳴牌多、牌局後段、疑似做一色
function threats(g, seat) {
  const prog = 1 - g.wall.length / 98, th = [];
  for (let o = 0; o < 4; o++) {
    if (o === seat) { th.push(0); continue; }
    const ms = g.melds[o], suits = new Set(ms.flatMap(m => m.tiles).filter(t => t.s !== 'z').map(t => t.s));
    th.push({ w: 0.35 + 0.55 * prog + 0.6 * Math.min(3, ms.length), flush: suits.size === 1 && ms.length >= 1 ? [...suits][0] : null });
  }
  return th;
}
function dangerOf(g, seat, t, u, th) {
  const i = ORD[t.k], remain = u[i];
  let tot = 0;
  for (let o = 0; o < 4; o++) {
    if (o === seat) continue;
    const T = th[o]; let d = remain <= 0 ? 0 : Math.min(1, remain / 3) + 0.2;
    if (t.s === 'z') d *= 0.7;
    else { if (t.n >= 4 && t.n <= 6) d *= 1.25; if (T.flush) d *= t.s === T.flush ? 1.8 : 0.5; }
    if (g.discards[o].some(x => x.k === t.k)) d *= 0.3;
    tot += T.w * d;
  }
  return tot;
}

function proDiscard(g, seat) {
  PRO_G = proGoal(g, seat); PRO_P = personaOf(g, seat);
  const h = g.hands[seat], melds = g.melds[seat];
  if (PRO_P.routes.length) {   // 轉向：偏好的路線比最近的路線慢 3 步以上，就改走手牌現在最順的路線，並換掉會衝突的習慣
    PRO_P = null; const pl = planList(arrOf(h), melds); PRO_P = personaOf(g, seat);
    const fav = pl.filter(p => PRO_P.routes.includes(p.n) || (PRO_P.routes.includes('flush') && p.n.startsWith('flush')));
    if (!fav.length || bestSh(fav) - bestSh(pl) >= 3) {
      const top = pl.filter(p => p.n !== 'any' && p.n !== 'goal').sort((x, y) => (x.sh - y.sh) || (y.b - x.b))[0];
      const nm = top ? (top.n.startsWith('flush') ? 'flush' : top.n) : null, o = { routes: nm ? [nm] : [] };
      if (nm === 'pinfu') { o.routes.push('twosuit'); o.pung = null; o.chow = 'often'; }      // 全順子：不碰、多吃，順便缺一門（反正沒有三元）
      if (nm === 'duidui' || nm === 'dragon' || nm === 'seven') { o.chow = 'never'; if (nm !== 'seven' && !PRO_P.pung) o.pung = 'any'; }
      g.persona[seat] = PRO_P = mkPersona(Object.assign({}, PRO_P, o)); (g.pivots = g.pivots || []).push({ seat, to: nm });
    }
  }
  const a = arrOf(h), u = unseenArr(g, seat), th = threats(g, seat);
  const cands = [];
  const seenKey = new Set();
  for (const t of h) {
    if (seenKey.has(t.k)) continue; seenKey.add(t.k);
    const i = ORD[t.k]; a[i]--;
    const plans = planList(a, melds), sh = bestSh(plans);
    cands.push({ t, i, plans, sh });
    a[i]++;
  }
  if (PRO_G && !cands.some(c => c.plans.some(p => p.n === 'goal'))) { g.goal[seat] = null; PRO_G = null; return proDiscard(g, seat); }
  if (PRO_G) {   // 有目標：以目標路線的向聽為主，同時盡量保住原本的聽牌（保底）
    let bb = null, bsc = -1e9;
    for (const c of cands) {
      const gp = c.plans.find(p => p.n === 'goal'), gsh = gp ? gp.sh : 9;
      const fsh = bestSh(c.plans.filter(p => p.n !== 'goal'));
      if (fsh > 1) continue;
      let sc = -100 * gsh - 70 * fsh - 6 * dangerOf(g, seat, c.t, u, th) - 0.15 * val(c.t) + Math.random() * 0.3;
      if (gsh > 0) { a[c.i]--; sc += 1.2 * ukeire(a, melds, u, new Set(['goal']), gsh); a[c.i]++; }
      if (sc > bsc) { bsc = sc; bb = c.t; }
    }
    if (bb) return bb;
  }
  const minSh = Math.min(...cands.map(c => c.sh));
  const mult = minSh <= 0 ? 0.45 : minSh === 1 ? 0.8 : 1.0;
  let best = null, bs = -1e9;
  for (const c of cands) {
    if (c.sh > minSh + 1) continue;
    let sc = -100 * c.sh;
    const names = new Set(c.plans.filter(p => p.sh <= c.sh + 1).map(p => p.n));
    a[c.i]--;
    if (c.sh === minSh) {
      const act = new Set(c.plans.filter(p => p.sh === c.sh).map(p => p.n));
      sc += 1.5 * ukeire(a, melds, u, act, c.sh);
    }
    a[c.i]++;
    let bonus = 0; for (const p of c.plans) if (p.sh <= c.sh + 1) bonus = Math.max(bonus, p.b - 10 * (p.sh - c.sh));
    sc += bonus * (RULES.PRO_BONUS == null ? PRO_P.bon : RULES.PRO_BONUS * PRO_P.bon / 0.4);
    sc -= 6 * mult * PRO_P.def * dangerOf(g, seat, c.t, u, th);
    sc -= 0.15 * val(c.t) + Math.random() * 0.3;
    if (sc > bs) { bs = sc; best = c.t; }
  }
  return best || h[0];
}
// 要不要放掉這次胡牌？只在牌山還長、現在只是小胡、而且保得住聽牌時才考慮
function greedDecline(g, seat, ev, tile, tsumo) {
  if (!RULES.PRO_GREED || ev.fan > 4 || g.wall.length < RULES.GREED_WALL) return false;
  PRO_P = personaOf(g, seat);
  const names = ev.items.map(i => i.name), has = n => names.includes(n);
  if (has('天胡') || has('地胡') || has('人胡')) return false;
  const melds = g.melds[seat], hand = tsumo ? g.hands[seat] : g.hands[seat].concat([tile]);
  const suits = new Set(hand.concat(...melds.map(m => m.tiles)).filter(t => t.s !== 'z').map(t => t.s));
  if (suits.size !== 1) return false;
  const su = ORD[[...suits][0] + 1] / 9, hz = hand.filter(t => t.s === 'z').length;
  const goals = [];
  if (has('混一色') && !melds.some(m => m.tiles[0].s === 'z') && hz === 2) goals.push({ t: 'pure', su, fan: Math.min(6, ev.fan + 2), dv: 4 * hz });
  if ((has('混一色') || has('清一色')) && !has('對對胡') && !has('七對子') && !has('平胡') && melds.every(m => m.type !== 'chow')) goals.push({ t: 'dui', su, fan: Math.min(6, ev.fan + 1), dv: 0 });
  if (!goals.length) return false;
  const u = unseenArr(g, seat), tot = u.reduce((x, y) => x + y, 0) || 1, W = g.wall.length;
  let h = 0.03; for (let o = 0; o < 4; o++) if (o !== seat) h += (proLevel(g, o) ? 0.02 : 0.012) + 0.012 * g.melds[o].length;
  let bestV = 0, bestG = null;
  for (const G of goals) {
    PRO_G = G;
    let bd = null; const seen = new Set();
    for (const d of hand) {
      if (seen.has(d.k)) continue; seen.add(d.k);
      const a = arrOf(hand); a[ORD[d.k]]--;
      const pl = planList(a, melds), gp = pl.find(p => p.n === 'goal'); if (!gp) continue;
      if (bestSh(pl.filter(p => p.n !== 'goal')) > 0) continue;   // 放掉後原本還要聽牌，保底
      const outs = ukeire(a, melds, u, new Set(['goal']), gp.sh), sc = -100 * gp.sh + outs;
      if (!bd || sc > bd.sc) bd = { sc, gsh: gp.sh, outs };
    }
    if (!bd) continue;
    const q = Math.min(0.5, bd.outs / tot); if (q <= 0) continue;
    const steps = bd.gsh + 1, N = Math.max(1, W / 4); let P = 1;
    for (let i = 0; i < steps; i++) P *= q / (q + h) * (1 - Math.exp(-(q + h) * N / steps));
    const v = P * (ev.tilePts + G.dv) * G.fan + (1 - P) * 0.35 * ev.points;
    if (v > bestV) { bestV = v; bestG = G; }
  }
  PRO_G = null;
  if (!bestG || bestV < RULES.GREED_EV * ev.points) return false;
  g.goal = g.goal || [null, null, null, null]; g.goal[seat] = bestG;
  g.declines = (g.declines || 0) + 1;
  (g.greedLog = g.greedLog || []).push({ seat, goal: bestG.t, tsumo });
  return true;
}
function proSelf(g, seat, opts) {
  PRO_G = proGoal(g, seat);
  if (opts.win) {
    if (opts.noGreed || !greedDecline(g, seat, opts.win, g.lastDraw, true)) return { win: true };
    return { discard: proDiscard(g, seat).id };   // 放掉這次自摸，繼續做大
  }
  if (opts.kongs.length) return { kong: opts.kongs[0] };
  return { discard: proDiscard(g, seat).id };
}
// 鳴牌後的向聽數（鳴完要再打一張，取最好的打法）
function afterClaimSh(g, seat, opt, t, kind) {
  const h = g.hands[seat].filter(x => !opt.tiles.some(y => y.id === x.id));
  const meld = { type: kind === 'chow' ? 'chow' : kind === 'pong' ? 'pong' : 'kong', tiles: [...opt.tiles, t], open: true, mixed: !!opt.mixed, claimed: opt.mixed ? t.id : null };
  const ms = [...g.melds[seat], meld], a = arrOf(h);
  if (kind === 'kong') return bestSh(planList(a, ms));
  let best = 99; const seen = new Set();
  for (const x of h) { if (seen.has(x.k)) continue; seen.add(x.k); a[ORD[x.k]]--; best = Math.min(best, bestSh(planList(a, ms))); a[ORD[x.k]]++; }
  return best;
}
function curSh(g, seat) { return bestSh(planList(arrOf(g.hands[seat]), g.melds[seat])); }
function goalAllows(kind, tiles) {
  if (!PRO_G) return true;
  const su = PRO_G.su, pure = PRO_G.t === 'pure';
  if (!pure && kind === 'chow') return false;
  return tiles.every(x => x.s === 'z' ? !pure : ORD[x.s + 1] === su * 9);
}
function proClaimKind(g, seat, t, list, kind) {
  PRO_G = proGoal(g, seat); PRO_P = personaOf(g, seat);
  if (!list.length) return null;
  const cur = curSh(g, seat); if (cur <= 0) return null;       // 已聽牌：保住門清，不鳴
  let P = PRO_P; const closed = P.routes.includes('closed');
  if (P.pung || P.chow) {   // 習慣要讓位給手牌現在的方向：全順子就別碰、多吃；全刻子就別吃
    PRO_P = null; const pl = planList(arrOf(g.hands[seat]), g.melds[seat]); PRO_P = P;
    const m = bestSh(pl), at = new Set(pl.filter(p => p.sh === m).map(p => p.n));
    const tri = at.has('duidui') || at.has('dragon') || at.has('seven');
    if (at.has('pinfu') && !tri) P = Object.assign({}, P, { pung: null, chow: P.chow === 'never' ? null : 'often' });
    else if (tri && !at.has('pinfu')) P = Object.assign({}, P, { chow: 'never' });
  }
  if (closed && g.wall.length >= 45) return null;               // 門清派：前期不鳴牌，後段才鬆口
  if (kind === 'chow' && P.chow === 'never') return null;
  if (kind !== 'chow' && P.pung === 'dragon' && t.s !== 'z') return null;
  let best = null, bs = cur;
  const su = P.routes.includes('flush') ? flushSuit(g, seat) : -1;
  for (const o of list) {
    if (!goalAllows(kind, [...o.tiles, t])) continue;
    if (su >= 0 && [...o.tiles, t].some(x => x.s !== 'z' && ORD[x.s + 1] !== su * 9)) continue;   // 一色派只鳴主花色／字牌
    if (P.routes.includes('duidui') && kind === 'chow' && su >= 0) continue;
    const sh = afterClaimSh(g, seat, o, t, kind);
    const dragon = t.s === 'z';
    const loose = cur >= 1 && sh <= cur && ((kind !== 'chow' && (P.pung === 'any' || P.pung === 'dragon')) || (kind === 'chow' && P.chow === 'often'));   // 愛碰／愛吃：不退步就鳴
    if (sh < bs || (sh === cur && ((dragon && !best && cur >= 1 && kind !== 'chow') || (loose && !best)))) { bs = Math.min(bs, sh); best = o; }
  }
  return best ? { seat, kind, opt: best } : null;
}
function flushSuit(g, seat) {
  const cnt = [0, 0, 0]; g.hands[seat].forEach(t => { if (t.s !== 'z') cnt[ORD[t.s + 1] / 9]++; });
  g.melds[seat].forEach(m => m.tiles.forEach(t => { if (t.s !== 'z') cnt[ORD[t.s + 1] / 9]++; }));
  return cnt.indexOf(Math.max(...cnt));
}
function proClaim(g, seat, from, t, o) {
  const k = proClaimKind(g, seat, t, o.kong, 'kong'); if (k) return k;
  const natural = proClaimKind(g, seat, t, o.pong.filter(p => !p.mixed), 'pong'); if (natural) return natural;
  return proClaimKind(g, seat, t, o.pong.filter(p => p.mixed), 'pong');
}
function proChow(g, seat, from, t, o) { return proClaimKind(g, seat, t, o.chow, 'chow'); }
function botDiscard(g, seat) { return proLevel(g, seat) ? proDiscard(g, seat) : easyDiscard(g, seat); }
function botSelf(g, seat, opts) { return proLevel(g, seat) ? proSelf(g, seat, opts) : easySelf(g, seat, opts); }

/* ---- headless simulation (all four seats are bots) ---- */
function simGame(levels, personas) {
  const g = newGame(0); if (levels) g.botLv = levels;
  if (personas) { g.persona = personas.map((k, i) => k ? (typeof k === 'string' ? PERSONA_BAL : mkPersona(k)) : g.persona[i]); g.persona0 = g.persona.slice(); }
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
if (typeof module !== 'undefined') module.exports = { mkPersona, pickPersona, greedDecline, proDiscard, proSelf, selfOptions, RULES, shanten, planList, arrOf, makeDeck, evaluateHand, simGame, newGame, counts, decomps, tname, val, sevenPairsShape };
