# 幺九龍 / Kowloon Dragons

Names: Chinese title 幺九龍; English title **Kowloon Dragons** (九龍 = Kowloon = "nine dragons"), subtitle "a tile game from the mahjong family". It is NOT playable with a regular mahjong set (needs its own 150-tile set: n copies of number n, 5 of each dragon), so don't call it plain "Mahjong". The jackpot hand 幺九龍 is called **Kowloon Dragon** (singular) in English, and 幺九順 **Kowloon Straight**; the game name stays plural "Kowloon Dragons".

Wilson's self-designed mahjong-inspired game. Single-page test-play site: 1 human vs 3 simple bots.
Wilson writes rules in Traditional Chinese; UI and rules text are Traditional Chinese. Keep game terms in Chinese.

## NUMBER ORDER FLIPPED (Wilson, 2026-10-24) — read this first
The shown numbers are reversed: displayed d = 10 - n, so there are (10 - d) copies of number d (nine 1s ... one 9) and the tile value equals its face number (一=1 ... 九=9); the gold point badge is hidden (`.tile .v{display:none}`). It is a DISPLAY layer only: `src/engine.js` keeps the legacy internal numbering n (n copies, value 10 - n, key 'p1' = displayed 九筒). Everything below this section is written in ENGINE numbering; convert to the screen with d = 10 - n:
- engine 1-3 (rare, mixed pung/triplet/pair, no kong, 胡 bonus tile) = shown 7-9 = 大字牌; engine 7-9 (never claimable) = shown 1-3 = 小字牌. Claimable chows are shown 456/567/678/789; pung is 4-9, kong 4-6.
- Renamed yaku: 全大字 -> 全小字 (all shown 1-3), 斷大字 -> 斷小字 (no shown 1-3), 胡小字 -> 胡大字 (win on shown 7-9). English All Small / No Small / Win on a big tile. Japanese 全小字 / 断小字 / 大字和了.
- Display code: `dnum`, `tn`, `ORD` flip in template.html; `X()` reverses each group's tile order so sequences read 1->9; chow melds are reversed in `meldEl`; `seqTiles`/chow labels sort descending by engine n. Rules examples (`X('..','p1 p2 p3')`, EXGEN) stay in engine numbering and show flipped automatically. New text must use shown numbers.
- Tagline is now 九張一，一張九，要不要來打兩手？ (ja 九は一枚、一は九枚。一局、打たない？). `X()` also sorts number groups ascending by shown number (`exOrder`, dragon groups and the final pair stay in place).

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
- 彩碰: numbers 1-3, same number different suits. 彩刻 (Wilson): the same mixed triplet may also be formed concealed inside the closed hand (decomps() in engine.js); it counts as a triplet for 對對胡/三暗刻/四暗刻, and on ron a mixed triplet completed by the winning tile counts as open (unless the winning tile can go in the pair or a chow). The ONE claimed tile scores 0; the tiles from hand still score. 彩眼 (Wilson): two tiles of the same number 1-3 in different suits may form the pair (pair string 'p1/s1' in decomps()); not a dragon pair; 幺九龍's pair still needs identical tiles. NO 彩吃 (removed by Wilson): chows are same-suit only, and a claimed chow may not contain any 7-9 tile at all (hand 56 can't chow 7; hand 78 can't chow 6) -> only 123/234/345/456 can be claimed. Concealed 789 sequences in hand are fine.
- Pong priority when several players can pong the same discard (5/6, honors): discarder's 下家 > 對家 > 上家. Ron > pong/kong > chow.
- 三元大槓: 中發白 5th tile via self-draw (kong then 5th, pong then 4th+5th, or 5 concealed).
- 一番起胡 (needs >=1 fan from real conditions; two half-fans alone cannot win).
- FINAL RULE SET (Wilson, 2026-10-23): cap 6 fan, multiplier = fan (x1..x6). Score = (hand tile points + instant bonus) x multiplier.
- Fan = floor(total incl. halves) so 1+0.5+0.5 = 2; need >=1 full fan from real conditions (halves alone can't win).
- 1番: 三元刻 (each, stackable; open pung or concealed triplet), 平胡 (all chows, no dragons), 對對胡 (彩碰 ok), 彩眼混一色 (half OR full flush whose pair is a 彩眼, at least one tile of the pair must be the main suit; first 三元刻 not counted), 彩碰混一色 (half OR full flush with exactly ONE 彩碰, at least one tile of it must be the main suit (engine 2p 2p 2m = shown 8筒8筒8萬 in a 筒 hand); more not allowed; first 三元刻 not counted)
- 2番: 混一色 (no 彩碰/彩刻/彩眼; no 斷一門; first 三元刻 not counted — the 1st dragon triplet is absorbed, 2nd/3rd still count), 不求人 (concealed + tsumo; replaces 門清/自摸), 斷小字 (no 7-9), 三暗刻, 七對子 (7 pairs, 8888 = two pairs, may stack 混一色/清一色, NO mixed pair, fully concealed, no 門清 half)
- 3番: 小三元 (+30 hand pts), 全小字 (all 7-9; no 門清 half), 幺九順 (same suit 123+456+789; remaining set chow or pung any suit; pair any; open hand)
- 4番: 清一色 (no mixed; no 斷一門無三元), 四暗刻, 大三元 (+60), 門清幺九順 (concealed 幺九順, +30, no 門清 half)
- 6番 (cap): 幺九龍 (+30; claimed 123/456 chows of that suit allowed), 門清幺九龍 (+90, no open melds), 槓三元 (kongs of all 3 dragons, +90), 天胡 (dealer wins on starting 14), 地胡 (non-dealer wins on the dealer's first discard), 人胡 (non-dealer wins by tsumo on their first draw, no calls before). 天胡/地胡/人胡 need only a complete shape (no other fan), flat 6 fan, pts x6, no bonus. Engine tracks g.drawN / g.discardN / g.calls for these.
- 暗刻: ankan counts as concealed; on ron, the triplet completed by the winning tile counts as open, BUT 榮胡進眼 doesn't ruin concealed triplets (if the winning tile can sit in the pair or a chow, the triplet stays concealed).
- Half fan 碎番 (+0.5, need >=1 real fan first): 槓上自摸 (self-draw on the replacement tile after a kong; stacks with 自摸 and 槓, so +1.5 in total; engine: g.lastDrawRep -> evaluateHand kongDraw), 槓 (each), 三元大補槓, 門清, 斷一門無三元 (missing one of 筒/索/萬 AND no 中發白), 自摸 (only open hands; 門清加自摸 already includes it), 胡大字 (winning tile is a 小字 1-3)
- 無彩吃無彩碰 was DELETED as a 碎番 by Wilson (no longer exists).
- 不求人 (was 門清加自摸) already includes 門清 and 自摸; 全小字, 七對子 and 門清幺九順 do not get the 門清 half. Cheat sheet shows 門清幺九順/門清幺九龍 as one-line rows (just the bonus) to save space.

## Implementation assumptions (NOT yet decided by Wilson; change in engine.js `RULES` / `evaluateHand`)
- 幺九龍: 12 distinct tiles + two more copies of a same-suit number or dragon (3 copies of it; 一/二 impossible) - confirmed by Wilson's wording.
- 自摸 half-fan not given on top of 不求人 (assumed; given only to open hands).
- 平胡 pair cannot be honor. 斷一門無三元 does not stack with 清一色 (混一色 has honors so already excluded).
- 全小字 + 不求人 still stack (3+2). 斷一門 and 無三元 are ONE combined half fan (斷一門無三元) - not split (balance test: splitting inflated scores ~20%).
- 吃 only from player on your left; no mixed 槓; no robbing the kong.
- Payment placeholder: tsumo each pays 1x; ron discarder pays 2x (RULES.RON_MULT). No dealer bonus/wind rotation.
- Bots are naive (no defense, random claims) - for rule testing only.

## Sim findings (bonuses now 小三元 +30, 大三元 +60, 幺九龍 +50 — Wilson's change; figures below were measured with the old +20/+40/+40 and are slightly stale: per-hand averages for 小三元/大三元/幺九龍 rise by ~10/20/10 pts × 3-4. Bot sim 20k games: old avg 86.5 pts, new avg 87.4 pts, fan split unchanged ~32/32/21/15%)
Bots (10k games): ~96% win rate, avg 87 pts. Fan split 1番 32 / 2番 32 / 3番 21 / 4番 15 %. Avg score by actual fan: 39 / 80 / 126 / 149.
Generated concealed hands, avg score ron/tsumo: 全小字 71/112 (weakest by design), 混一色 158/184, 對對胡 178/196, 小三元 177/188, 四暗刻 192/195, 清一色 197/228, 斷小字 235/328, 大三元 245/247, 幺九順 251/260, 幺九龍 362/362.
Tier overlap: only ~21% of 2番 hands score below the 1番 median (was 39% with x1.5/x2/x3).
Known: concealed tsumo stacks hit the 4番 cap easily (斷小字+門清自摸 ~328); 1.5番 floors to 1番 so the 0.5 -> 2番 cliff now doubles the score. Wilson accepted 全小字 being low (博弈) and 斷小字 as is.

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
- Cheat sheet is live: cheatStates() (template.html) reads your melds/hand each render() -> gold "✓" ONLY for what you already have (dragon triplet, 門清 while no open meld, kong, formed concealed triplets), grey (no strikethrough) = no longer possible; desktop sidebar width is draggable via #cheatGrip (localStorage yjl-cheatw, dblclick resets) (reason shown); never highlight merely-possible hands (Wilson's request). Keep its rules in sync with rule changes.
- 混一色/清一色 can't include 彩碰/彩刻/彩眼 (automatic: those tiles span 2+ suits; stated in both rules texts).
- Online rooms (header 線上/Online button -> #lobby dialog): serverless WebRTC via PeerJS (loaded lazily from unpkg; free PeerJS cloud broker; STUN only, no TURN). Host's browser runs the engine and the existing play() loop (host = seat 0); guests get per-seat rotated state snapshots (`snapshot()`, hand tiles only for their own seat), prompts ('self'/'claim'), logs and results, and answer with 'act'. Seat kinds in ROOM.kind: host/human/bot/open. Remote prompts time out (60s turn, 20s claim -> bot/pass); a disconnect in game turns the seat into a bot. Room code = peer id 'kowloon-'+CODE; invite link ?room=CODE. Solo vs 3 bots is unchanged (ROOM.mode 'solo').

## UI notes (landing / rooms / settings)
- Naming (Wilson): 彩碰, 彩刻, 彩眼, 彩吃 (no 彩吃), 平胡; always 胡 not 和. Room codes: 4 letters, no digits. 彩眼 is 可榮胡 only (never callable).
- Flow: `#landing` (創建房間 / 加入房間 / 電腦對戰, name field, tagline 一張一，九張九，要不要來打兩手？) -> bots or PeerJS room -> `#lobby` full-page room panel (seats, ready, A+B time control, host starts) -> dragon-iris transition (`dragonZoom`) -> table. Brand title returns to landing. Don't reuse the class names `clk`/`hero` (already used by game CSS).
- Time control A+B: A = bank per hand, B = per-turn; B drains first, then A; at 0 a bot plays. Seat pill shows A + B. Host-authoritative (`clkBegin/clkEnd/hostClocked`).
- Restart in a room with other humans needs everyone to agree (`startVote`, 25s timeout).
- Settings (gear): theme auto/light/dark, text size S/M/L (`--fs` scales text via calc in the stylesheet), language 繁/简/EN (simplified is a DOM text conversion, `T2S_PAIRS` + MutationObserver). Prefs in localStorage `yjl-*`.
- Hand: sort toggles 11·22·33 / 123·234; 彩組 groups+locks single 1-3 tiles of 2-3 suits; locked groups sort to the far left (sort-only, discarding unaffected); lock bar under each adjacent mixed run.
- Cheat sheet: right sidebar >=1180px, slide-in drawer with edge tab below that.
- Languages: 繁體 / 简体 / English / 日本語, all picked from the globe button menu (`openLangMenu`), not in Settings. Japanese lives in `src/ja.js` (inlined by build.js at `/*__JA__*/`): `L(zh, en)` looks the Chinese string up in `JA_EXACT`, then `JA_PATTERNS` (sentences with names/numbers), else shows the Chinese; fan names via `YAKU_JA`, seat names `SEAT_JA`, full rules text `RULES_HTML.ja` in template.html. Japanese uses Japanese mahjong terms (チー/ポン/カン/ロン/ツモ/翻/役牌/平和/一気通貫…); invented terms are 彩ポン / 彩刻子 / 彩雀頭 / 幺九龍. When adding any new `L('中文', 'English')` string, also add the Japanese to `JA_EXACT`/`JA_PATTERNS`.
- Mobile: the cheat sheet is a long button next to the wall counter (`#cheatBar`), the edge tab only shows on tablet widths.
- Feedback: in-app form (`#fbDlg`, opened from the landing footer link and Settings) posts to Web3Forms; the public access key goes in `FEEDBACK_KEY` in template.html (empty = form shows "not set up yet" and Send is disabled). Honeypot field + 30s client cooldown. New feedback strings also need Japanese entries in `src/ja.js`.
- Audio (Web Audio, synthesized, no files): `MUSIC` = fixed 30s seeded loop (9 bars, Karplus-Strong guzheng, soft bass/pad, reverb), `SFX` = wood-knock discard sound; chow/pung/kong = 2-4 knocks in a row (no voice; Wilson found speech too AI-sounding). Settings rows 音效 / 背景音樂, both default on (`PREF.sfx`, `PREF.music`, localStorage yjl-sfx/yjl-music). Guests detect discards/melds by diffing state snapshots.
- Colors: one gold per theme via `--gold` (+ `--gold-hov`, `--gold-rgb`; dark #e0b04e, light #d1952a); `--gold-t` = `--gold` everywhere (no more muted text gold). Light mode has cream hand-points pill (`--totalbg`), wall pill matches player panel (`--pillbg`), visible lock bar (`--lbar`). Favicon = gold dragon SVG data URI (`<link rel="icon">`).
- Win flow (2026-10-24): `showResult(win)` -> for another player's win a big call overlay (#winCall: 自摸！/食胡！, who, yaku) with the guzheng sting `MUSIC.sting()` at the same instant, then the score page (#result, full-screen) opens with a clip-path circle over a gold backdrop; your own win skips the call. Score page: fan list, gold `.hero` Final score panel (max 360px), settlement table, "all hands" reveal (`winGroups`/`handRow`: declared melds boxed, winner arranged in sets, winning tile marked 胡, hand points per player), 看牌桌 / 回到結算 buttons (`#viewTable`, `#resBack`). Preview without playing: `?demo=zimo|ron|mezimo|meron` (gold tap-to-start gate so audio is allowed).
