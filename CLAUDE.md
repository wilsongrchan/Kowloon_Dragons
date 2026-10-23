# 幺九龍 / Kowloon Dragons

Names: Chinese title 幺九龍; English title **Kowloon Dragons** (九龍 = Kowloon = "nine dragons"), subtitle "a tile game from the mahjong family". It is NOT playable with a regular mahjong set (needs its own 150-tile set: n copies of number n, 5 of each dragon), so don't call it plain "Mahjong". The jackpot hand 幺九龍 is called **Kowloon Dragon** (singular) in English, and 幺九順 **Kowloon Straight**; the game name stays plural "Kowloon Dragons".

Wilson's self-designed mahjong-inspired game. Single-page test-play site: 1 human vs 3 simple bots.
Wilson writes rules in Traditional Chinese; UI and rules text are Traditional Chinese. Keep game terms in Chinese.

## Layout
- `src/engine.js`   pure game logic (no DOM): deck, claims, win detection, fan scoring, bots, `simGame()` headless sim
- `src/template.html` UI + CSS; contains `/*__ENGINE__*/` placeholder
- `scripts/build.js` inlines engine into template -> `dist/index.html` and `docs/index.html` (publishable single file; GitHub Pages serves `docs/`)
- `scripts/sim.js`   bot-only simulation stats (use before changing any fan/point rule)
- Commands: `npm run build`, `npm run sim`

## Current rules (as implemented; latest from Wilson)
Tiles: 筒/索/萬 n copies of number n (45 each), 中發白 x5 each, 150 total. Value = 10 - n (一=9 ... 九=1), honors 0; number tiles total 495.
Hand 13, win 14: 4 sets + pair.
- 吃碰槓 as normal mahjong. 小字 (1-3) can never kong or concealed-kong (explicit guard in engine.js; naturally impossible anyway, max 3 copies). 7-9 can never be 吃/碰/槓'd, 暗槓 of 7-9 also banned.
- 混碰: numbers 1-3, same number different suits. 小字混刻 (Wilson): the same mixed triplet may also be formed concealed inside the closed hand (decomps() in engine.js); it counts as a triplet for 對對胡/三暗刻/四暗刻, and on ron a mixed triplet completed by the winning tile counts as open (unless the winning tile can go in the pair or a chow). The ONE claimed tile scores 0; the tiles from hand still score. NO 混吃 (removed by Wilson): chows are same-suit only, and a claimed chow may not contain any 7-9 tile at all (hand 56 can't chow 7; hand 78 can't chow 6) -> only 123/234/345/456 can be claimed. Concealed 789 sequences in hand are fine.
- Pong priority when several players can pong the same discard (5/6, honors): discarder's 下家 > 對家 > 上家. Ron > pong/kong > chow.
- 三元大槓: 中發白 5th tile via self-draw (kong then 5th, pong then 4th+5th, or 5 concealed).
- 一番起和 (needs >=1 fan from real conditions; two half-fans alone cannot win).
- Multiplier on sum of all hand point values: 1番 x1, 2番 x2, 3番 x3, 4番(cap) x4 (linear).
- Fan = floor(total incl. halves) so 1+0.5+0.5 = 2.
- 1番: 三元刻(each, stackable), 平胡 (all chows, no dragons), 對對胡(混碰 ok)
- 2番: 混一色, 門清加自摸, 全大字(all tiles 7-9), 斷大字(no 7-9), 三暗刻
- 3番: 清一色, 小三元 (no extra 中發白刻; hand tile sum +20 before multiplier), 幺九順 (same suit 123+456+789; remaining set chow or pong, any suit; pair any)
- 4番: 大三元 (no extra 中發白刻; hand tile sum +40 before multiplier), 四暗刻, 幺九龍 (same suit 123+456+789 + one each of 中發白 + a pair of a same-suit number or a dragon, i.e. that tile type has 3 copies; hand tile sum +40 before multiplier -> 340-396 pts)
- 暗刻: ankan counts as concealed; on ron, the triplet completed by the winning tile counts as open, BUT 榮胡進眼 doesn't ruin concealed triplets (if the winning tile can sit in the pair or a chow, the triplet stays concealed).
- Half fan 碎番 (+0.5, need >=1 real fan first): 槓 (each), 三元大補槓, 門清, 斷一門無三元 (missing one of 筒/索/萬 AND no 中發白), 自摸 (only open hands; 門清加自摸 already includes it), 胡小字 (winning tile is a 小字 1-3)
- 無混吃無混碰 was DELETED as a 碎番 by Wilson (no longer exists).
- 門清加自摸 already includes 門清; 全大字 does not get 門清 half.

## Implementation assumptions (NOT yet decided by Wilson; change in engine.js `RULES` / `evaluateHand`)
- 幺九龍: 12 distinct tiles + two more copies of a same-suit number or dragon (3 copies of it; 一/二 impossible) - confirmed by Wilson's wording.
- 自摸 half-fan not given on top of 門清加自摸 (assumed).
- 平胡 pair cannot be honor. 斷一門無三元 does not stack with 清一色 (混一色 has honors so already excluded).
- 全大字 + 門清加自摸 still stack (2+2, hits 4 cap).
- 吃 only from player on your left; no mixed 槓; no robbing the kong.
- Payment placeholder: tsumo each pays 1x; ron discarder pays 2x (RULES.RON_MULT). No dealer bonus/wind rotation.
- Bots are naive (no defense, random claims) - for rule testing only.

## Sim findings (current rules: linear x1-x4; 小三元 +20, 大三元 +40, 幺九龍 +40)
Bots (10k games): ~96% win rate, avg 87 pts. Fan split 1番 32 / 2番 32 / 3番 21 / 4番 15 %. Avg score by actual fan: 39 / 80 / 126 / 149.
Generated concealed hands, avg score ron/tsumo: 全大字 71/112 (weakest by design), 混一色 158/184, 對對胡 178/196, 小三元 177/188, 四暗刻 192/195, 清一色 197/228, 斷大字 235/328, 大三元 245/247, 幺九順 251/260, 幺九龍 362/362.
Tier overlap: only ~21% of 2番 hands score below the 1番 median (was 39% with x1.5/x2/x3).
Known: concealed tsumo stacks hit the 4番 cap easily (斷大字+門清自摸 ~328); 1.5番 floors to 1番 so the 0.5 -> 2番 cliff now doubles the score. Wilson accepted 全大字 being low (博弈) and 斷大字 as is.

## Working style
Prefer one change at a time, simulate before changing scoring, and keep Wilson's rule text as source of truth.

## UI features (src/template.html)
- Bot melds render in the seat header (top right, gold-tinted .melds box), discards below; same shaded box for your own melds.
- Table layout: 對家 on top, 上家 (left) and 下家 (right) side by side, you at the bottom (#opps grid in template.html).
- Hand reordering: mouse drag, touch long-press drag, select + ◀ ▶ buttons, 整理 button resets to auto-sort. State: UI.manual / UI.order.
- Selection: tap a hand tile = select (highlight + info line #selinfo under the hand); tap again = unselect (touch). Discard ONLY via the 打出 button (#discardBtn); on mouse, clicking an already-selected tile also discards.
- Hover (desktop) or tap (phone, non-hand tiles) any tile -> tooltip with total copies / seen / remaining (seen = own hand + all discards + all melds). Tooltip element #tip.
- Mobile checked at 390px width (no horizontal overflow, touch drag works). Tests used Playwright (python) + jsdom auto-play.
- Bilingual UI (中文 default / English): `LANG`, `L(zh,en)`, `tn/kn/knFull` tile names, `yn` yaku-name map (YAKU_EN), `RULES_HTML.{zh,en}` rules dialog, header button #langBtn (remembers choice in localStorage 'yjl-lang'). English mode shows digits on tiles instead of 一二三. Log/status/claim buttons/result dialog are re-rendered on language switch. When changing any rule, update BOTH rules texts (RULES_HTML.zh and .en) and YAKU_EN if yaku names change.
- Rules dialog has collapsed `<details class="eg">` tile examples built with `X(label, 'p1 s1 m1*|...')` (tile keys p/s/m1-9, z1-3; `*` = claimed tile, faded) and `EG(title, rows)`; update them when a hand definition changes. English name for 三元刻 is "Dragon triplet" (revealed pung or concealed triplet).
- Tiles are drawn in CSS (no images): big digit + suit icon (筒 = ring, 索 = stick, 萬 = 萬 character), dragons 中/發/白 (白 = blue frame); gold badge = point value. `faceHTML(suit, n, badge)` builds the face; the rules examples reuse it.
- Cheat sheet (番種速查): sidebar `#cheat` on >=1180px, header button `#cheatBtn` -> `#cheatDlg` dialog below that. Content from `CHEAT_TIERS` / `CHEAT_MINOR` / `cheatHTML()` in template.html; update with rule changes (along with both rules texts).
- Result dialog: big gold score (.hero) under the title; muted gold dragon SVG as #result background (data URI, opacity .24).
- Muted gold dragon drawn in the shape of 九 (SVG data URIs): in the header right after the title (header::before, in-flow so panels can't cover it; --dragon-h, light/dark variants) and as the result dialog background (--dragon). Seat headers show a labeled bigger score (分數/Points). On <=520px bot called tiles move to their own row under the header.
- Cheat sheet is live: cheatStates() (template.html) reads your melds/hand each render() -> gold "✓" = supported by your melds/hand, grey+strikethrough = ruled out (reason shown). Keep its rules in sync with rule changes.
