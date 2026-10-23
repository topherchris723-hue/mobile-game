# Battle logic API (`src/logic/`)

Pure, deterministic game logic (GDD §5). No DOM, no Phaser. The renderer reads snapshots and
events. It never changes logic state directly.

## Create a battle

```js
import { createBattle, createContent } from './src/logic/index.js';
import battle from './data/battle.json';
import characters from './data/characters.json';
import cards from './data/cards.json';
import enemies from './data/enemies.json';
import stages from './data/stages.json';
import economy from './data/economy.json';   // needed only if a fighter has resonance > 0

const content = createContent({ battle, characters, cards, enemies, stages, economy }); // build once, reuse
const b = createBattle({
  content,                                  // or: data: { battle, characters, ... }
  stageId: 'stage_001',                     // enemy team + timer come from the stage
  playerTeam: [{ characterId: 'char_tavi_001', resonance: 0 }, 'char_lark_001', 'char_dunmore_001'],
  // playerController: 'human' (default) | { aiTier: 'fighter' }   (AI plays the player side)
  // enemyController:  'ai' (default, each enemy's own ai_tier) | { aiTier: 'master' } | 'human'
  // skipIntro: false  (true skips the 2.0 s intro)
}, seed);                                    // seed: 32-bit integer. Same seed + same inputs = same battle.
```

## Run it: one `step()` per logic tick (60 per second)

```js
// Fixed 60 Hz: accumulate real time and call step() once per 1/60 s (tutorial slow-mo: call it less often).
const events = b.step([{ type: 'card', slot: 2 }]);   // player inputs for this tick (array)
// or b.step({ player: [...], enemy: [...] }) when the enemy is 'human' (tests)
const state = b.getState();                            // plain JSON snapshot (a copy; safe to keep)
```

Inputs (anything not allowed right now is ignored and gives an `input_rejected` event):

| Input | Gesture (GDD §5.2) |
|---|---|
| `{ type: 'card', slot: 0..3 }` | tap a card (also Riposte, combo, and buffered taps during Windup/Active) |
| `{ type: 'dash', dir: 'forward' \| 'back' }` | swipe right / left |
| `{ type: 'slip' }` | swipe up / down (it becomes a Break Slip automatically in Hitstun) |
| `{ type: 'tag', slot: 0..2 }` | tap a bench portrait (team slot index) |
| `{ type: 'ignite' }` | tap IGNITE |
| `{ type: 'tri_burst' }` | tap TRI-BURST |

The gesture rules themselves (tap < 12 px and < 300 ms, swipe ≥ 24 px, long-press 400 ms tooltip) are UI code.

Other calls: `b.setPaused(true|false)` (pause menu, or when the app goes to the background),
`b.retreat()` (counts as a loss), `b.getResult()` (null while running),
`b.holdRiposteWindow('player', true|false)` (tutorial §9.4: hold the window while the prompt shows).

## Snapshot (`getState()`)

```
{ tick, phase: 'intro'|'fight', introTicksLeft, paused,
  timer: { ticksLeft, secondsShown },               // show secondsShown
  freeze: null | { kind: 'hitstop'|'climax'|'ignition'|'tri_burst'|'ko', ticksLeft, side },
  distance, arenaWidth, result: null | { outcome: 'win'|'lose'|'draw', reason, ticks, timeElapsedS, stats },
  teams: { player: Team, enemy: Team } }

Team = { side, activeSlot, x, vigor, vigorShown, vigorMax, burst, burstMax, burstUsed,
         burstReady, igniteReady, tagReady, tagCooldownTicks, tagCooldownMaxTicks,
         riposteWindowTicks, chain: { cards, hits }, fighters: [Fighter x3] }

Fighter = { slot, characterId, enemyId, name, aura, boss, hp, maxHp, atk, def, state, ko, active,
            invulnerable, linkWindow,
            action: null | { kind: 'card'|'tri_burst', cardId, cardType, phase: 'approach'|'windup'|'active'|'recovery'|'rush', riposte, tagStrike },
            hand: [ null | { cardId, name, type, cost, affordable, playable, riposte } x4 ],
            handRefillTicks: [n x4], drawCount, discardCount,
            buffs: [{ type, value, ticksLeft }],
            ignition: { has, name, available, used, active, ticksLeft } }
```

- `x` is the team's active fighter position in arena units (0 to `arenaWidth`). The player is always on the left.
- `state` is one of: Idle, Dashing, Windup, Active, Recovery, Slipping, SlipRecovery, Hitstun, Knockdown, KO, Benched.
  Global cinematics are shown by `freeze.kind`, not by a fighter state.
- `hand[i].affordable === false` means greyed out (GDD §5.4). `playable` is the exact "would a tap play it now" answer.
- Card art and text: look the card up by `cardId` in `data/cards.json`. The Tag Strike uses `cardId: 'tag_strike'` (no card record).

## Events (returned by `step()`, each with `tick`)

| type | fields | use |
|---|---|---|
| `fight_start` | | "FIGHT!" |
| `card_played` | side, slot, cardId, cardType, riposte, cost | card leaves the hand |
| `card_buffered` | side, slot | tap stored during Windup/Active (§5.7) |
| `windup_start` | side, cardId, cardType, windupEnd | wind-up animation; tutorial `enemy_windup` |
| `hit` | side (attacker), cardId, cardType, targetSlot, damage, crit, typeMult, chainIndex, comboHits, hitIndex, hits, riposte, hpAfter | damage number, "WEAK!" (typeMult 1.3) / "RESIST" (0.8), combo counter |
| `hit_discarded` | side (attacker), cardId, cardType, targetSlot, hitIndex, reason (`rush_invulnerable`) | a hit on a fighter in its Tri-Burst rush (GDD §5.10 round 3): no damage, no hitstop, no Burst, not a dodge. Show nothing or a small "immune" spark; never a damage number or "DODGE" |
| `whiff` | side, cardId, reason (`approach_timeout`, `invulnerable`, `rush_invulnerable`) | `rush_invulnerable`: the card's first hit fell on the opponent's Tri-Burst rush; the whole card whiffs |
| `interrupt` | side, cardId | the card was cancelled by a hit |
| `card_cancelled` | side, cardId, reason | cancelled by an enemy Ignition |
| `link_open` | side | combo window; tutorial `chain_possible` |
| `chain_end` | side, cards, hits, reason | combo counter ends |
| `knockdown`, `getup` | side, slot | |
| `slip` | side, isBreak, cost | |
| `perfect_slip` | side, slot | "PERFECT SLIP!"; the Riposte window opens |
| `dodge` | side, slot | a normal dodge |
| `riposte` | side, slot, cardId | |
| `riposte_window_end` | side | |
| `tag` | side, fromSlot, toSlot, escape, cost | |
| `tag_strike` | side | |
| `ko`, `fighter_enter` | side, slot | |
| `ignition_ready` | side, slot | IGNITE button appears |
| `ignition` / `ignition_end` | side, slot, name, shout / reason | |
| `burst_ready` | side | TRI-BURST pulses |
| `tri_burst_start`, `tri_burst`, `tri_burst_hit`, `tri_burst_whiff` | side, members, damages / memberSlot, damage / burst, reason (`invulnerable`, `safety_net`) | |
| `climax_cinematic` | side, cardId | |
| `effect`, `buff_end` | side, slot, effect, value | |
| `card_drawn` | side, slot (fighter), handSlot, cardId | refill |
| `input_rejected` | side, input, reason (`vigor`, `state`, `cooldown`, `gauge`, `target`, `empty_slot`, `unavailable`, `not_now`) | shake the card or portrait, "not enough Vigor" flash |
| `freeze_end` | kind, side | |
| `battle_end` | outcome, reason | go to Result |

All event types are exported as `BATTLE_EVENT_TYPES`; `WHIFF_REASONS`, `HIT_DISCARD_REASONS` and
`TRI_BURST_WHIFF_REASONS` list the reason values (from `src/logic/index.js`).

**Round 3 rush rule (GDD §5.10).** The rushing fighter cannot be hit at all from T through T + 18: every hit on it
(projectiles already in flight, later hits of a card whose first hit landed before T) becomes `hit_discarded`.
If a card's **first** hit falls on the rush, a `whiff` (reason `rush_invulnerable`) follows the `hit_discarded` on the same
tick and none of that card's later hits ever resolve (no events). A card whose first hit landed before T keeps landing
after T + 18.
A rush therefore always ends with `tri_burst` or `tri_burst_whiff` on T + 18, unless the battle ends first (then
there is no rush event; go to Result as usual).

**AI decision log (GDD §5.15 round 3).** `battle.controllers[side].dodgeLog` has one entry per opposing card:
`{ actionId, cardId, oppSide, windupStart, decisionTick, tick, outcome, slipRoll, perfectRoll }`, `outcome` in
`DODGE_DECISION_OUTCOMES` (`resolved`, `cannot_slip`, `no_slip`, `too_late`, `planned`). Test/sim use only.

## After the battle

`src/state/save.js` handles the save: `loadSave(storage, { validate, economy, characters, nowMs })`,
`applyBattleResult(save, stage, result, economy, charactersById, nowIso)` (rewards, missions, best time,
tutorial flag), `writeSave(storage, save, nowMs)`. `storage` is `window.localStorage` in the browser.
`validate` is an Ajv validator compiled from `data/schemas/save.schema.json`.

`loadSave` returns `{ save, damaged, backupKey, repaired, warnings }`. When `characters` is passed it
repairs the team **before** schema validation (GDD §13, BUG-2-04/05), so `save.team` is always 3 known,
playable, owned fighters of distinct families:
- team ids that are unknown in the data, not playable, not in the roster, repeated, or past slot 3 are dropped;
- empty slots are refilled from `economy.starting.team`, then from the roster in order;
- the roster is never changed (unknown roster entries stay, so a later data fix restores them);
- the repaired save is written back; `repaired: true` and `warnings` = `[{ code, characterId }]`
  (`team_unknown_id`, `team_not_playable`, `team_unowned`, `team_duplicate`, `team_extra`, `team_refilled`).
  The UI may show a notice; it is not the "damaged" notice.
- Two **different** owned fighters of one family, or a team that cannot reach 3, is still treated as damaged
  (backup + fresh save).

`repairTeam(save, charactersById, economy)` → `{ team, warnings, ok }` is the same check without side effects.

**Settings (GDD §13 ruling R4-1, round 4).** `settings` = { `master_volume`, `bgm_volume`, `sfx_volume` (0.0–1.0, 1 decimal),
`muted`, `haptics`, `reduce_motion` }. Logic is DOM-free, so the caller reads `matchMedia('(prefers-reduced-motion: reduce)')`
and passes it: `createFreshSave(economy, nowIso, { reduceMotion })` and `loadSave(storage, { ..., reduceMotion })`.
On load every bad/missing field is repaired to its default (`reduce_motion`: the value passed now), unknown keys are removed,
the save is written back and `warnings` gets `{ code: 'settings_repaired', key: <field> }` — never `damaged`.
`repairSettings(save, reduceMotionNow)`, `DEFAULT_SETTINGS`, `SETTINGS_FIELDS` are exported from `src/state/save.js`.

`isStageUnlocked(save, stageId, stagesById)` → bool (GDD §9.1): a stage with no `unlock_requires` is always
unlocked; any other unlocks when that stage's record has `cleared: true`. `stagesById` is `content.stages`
from `createContent`. Unknown stage id → `false`.

## Summon (gacha) — GDD §11 round 3 (`src/logic/summon.js`, `src/state/summon-save.js`)

Pure and deterministic. Soft currency only. Every number comes from `data/banners.json` and `data/economy.json`.
Pass the banners file to `createContent`: `createContent({ battle, characters, cards, enemies, stages, economy, banners })`
(`economy` is required for summons). `content.banners` is a map id → banner.

```js
import { getOpenBanners, checkSummon, getBannerRates, getPityStatus } from './src/logic/index.js';
import { summonAndSave } from './src/state/summon-save.js';

const nowIso = new Date().toISOString();
const banners = getOpenBanners(content, nowIso);           // [] → "No summons available right now." (AC-11.13)
const chk = checkSummon(save, banners[0].id, 10, content, nowIso);
// { ok, reason, bannerId, count, currencyId, cost, balance, balanceAfter } → button enabled = chk.ok (AC-11.6);
// confirm dialog: chk.cost, chk.balanceAfter.
const r = summonAndSave(window.localStorage, save, banners[0].id, 10, content, Date.now() /*, seed for ?test */);
if (r.ok) { save = r.saveAfter; /* already written (one setItem) — now play the reveal from r.results */ }
else if (r.reason === 'save_failed') { /* "Summon failed — no Jade was spent." — keep the old save */ }
```

**`summon(save, bannerId, count, content, { nowIso, seed | rng })`** (pure; never changes `save`) returns
`{ ok, reason, seed, banner_id, count, cost, jade_before, jade_after, pity_before, pity_after, results, saveAfter, events }`.
- `results[i]` = `{ pull (1-based), character_id, rarity (3|4|5), outcome, resonance_after, jade_added, guarantee }`.
  Results grid: `new` → NEW; `resonance` → "Resonance +1" (R`resonance_after`); `jade` → "+`jade_added` Jade" (amount actually credited,
  can be 0 at the 999,999 cap).
- `count` is 1 or `multi_count` (10). Exactly 2 `next()` calls per pull (A rarity, B fighter), also on forced pulls.
- Rarity per pull (GDD §11.3): hard pity (`pity[group] ≥ hard_pity − 1` → ★5) → on pull 10 of a ×10 only, if no earlier pull of
  this ×10 reached `min = max(multi_min_rarity, first_multi_min_rarity if the first ×10 is not done)`, draw from rarities ≥ min
  (`T = Σ rates`, walk ★5 → ★4 → ★3) → normal draw (`floor(A × 10000)`, walk ★5 → ★4 → ★3).
- Fighter: integer weights (featured `share × n`, non-featured `10000 − S`, `W = 10000 × n`; n = 0 → `share`, `W = S`); candidate
  order `featured[]` then `pool[]`; `w = floor(B × W)`.
- Counters: ★5 → `pity[group] = 0`, else +1; a ×10 sets `first_multi_done[banner] = true`; `total_pulls += count`; `updated_at = nowIso`.
  No new save fields (absent → 0 / false / 0).
- On a reject: `ok` false, `results` and `events` empty, `saveAfter === save`.
- The logic never picks a random seed: pass `seed` (uint32) or `rng` (tests). Without either it throws.

**`summonAndSave(storage, save, bannerId, count, content, nowMs, seed?)`** — GDD §11.3 steps 1–5. Picks a seed with
`crypto.getRandomValues` (fallback `Math.random`) unless one is given, runs `summon`, then writes the whole save with **one**
`setItem` **before returning**, so the UI can only start the reveal after the save (anti-reroll, AC-11.5). If `setItem` throws it
returns `{ ok: false, reason: 'save_failed', results: [], saveAfter: <the unchanged input save> }` (AC-11.10). `saved` tells
whether it was written. The returned `seed` is for bug reports (not saved). The UI must still block a second summon while one is
being processed or revealed (AC-11.12).

**Display helpers.**
- `getBannerRates(bannerId, content)` → `null` or `{ bannerId, name, currencyId, costSingle, costMulti, multiCount,
  rarities: [{ rarity, bp, percentText }], fighters: [{ characterId, rarity, featured, weight, totalWeight, exactBp, bp, percentText }],
  rules: { pityGroup, hardPity, multiMinRarity, firstMultiMinRarity|null, maxResonance, overflowCurrencyId, overflowAmountByRarity } }`,
  ★5 first, fighters in candidate order. `percentText` = 2 decimals; fighter values are rounded half-up, so show the GDD note
  "Fighter rates are rounded to 2 decimals." (AC-11.4).
- `getPityStatus(save, bannerId, content)` → `null` or `{ bannerId, group, counter, hardPity, pullsUntilGuaranteed, firstMultiAvailable,
  firstMultiMinRarity|null }`. "★5 guaranteed within `pullsUntilGuaranteed` summons." (= max(1, hard_pity − counter)); show the
  first-×10 line while `firstMultiAvailable` (AC-11.11).
- `getOpenBanners(content, nowIso)`, `isBannerOpen(banner, nowIso)`, `bpToPercentText(bp)`.
- Lower level (tests, sims): `rarityFromRoll`, `fighterFromRoll`, `fighterWeights`, `drawPull`.

**Events** (`SUMMON_EVENT_TYPES`): `summon_charged` { bannerId, currencyId, amount, balanceAfter }, `summon_pull` { pull, result },
`summon_pity_reset` { group, pull }, `summon_currency_capped` { currencyId, lost }.

**Save repair on load (L-gp-001).** `loadSave` always runs `repairSummon(save)` (pure → `{ summon, warnings }`) before schema
validation, so a damaged or old `summon` section is repaired instead of resetting the whole save. Warnings are
`{ code, characterId: null, key }`. Well-formed entries for unknown pity groups / banners are kept. A counter above `hard_pity`
is left as is and means "next pull is ★5". `grantCharacter` now also returns `credited` for the overflow case.

**Tutorial timing (GDD §9.4 round 3).** `buildRules(battle).tutorialPromptMaxS` (data `tutorial_prompt_max_s`, default 20) and
`tutorialNoneS` (`tutorial_none_s`, default 3) — the UI's tutorial controller should read these instead of its own constants.

### Consumers must handle (L-shared-009)

| New value | Exported list | Consumer (owner) |
|---|---|---|
| Reject reasons `unknown_banner`, `invalid_count`, `banner_closed`, `empty_pool`, `insufficient_currency`, `save_failed` | `SUMMON_REJECT_REASONS` | Summon screen buttons / confirm / error text + strings.json (ui-developer) |
| Outcomes `new`, `resonance`, `jade` | `SUMMON_OUTCOMES` | Results grid tags (ui-developer) |
| Guarantees `none`, `hard_pity`, `first_multi`, `multi` | `SUMMON_GUARANTEES` | Optional reveal callout (ui-developer, vfx-developer) |
| Events `summon_charged`, `summon_pull`, `summon_pity_reset`, `summon_currency_capped` | `SUMMON_EVENT_TYPES` | Reveal sequence; Jade-cap warning (ui-developer, vfx-developer, audio-designer) |
| Load warnings `summon_reset`, `summon_pity_reset`, `summon_pity_entry_dropped`, `summon_first_multi_reset`, `summon_first_multi_entry_dropped`, `summon_total_pulls_reset`, `summon_extra_field` (+ the 7 team codes) | `SAVE_REPAIR_WARNING_CODES` | Home notice after load, if shown by code (ui-developer) |
| `content.banners` (pass `banners` to `createContent`) | — | `src/ui/game-data.js` (ui-developer) |
| `rules.tutorialPromptMaxS`, `rules.tutorialNoneS` | — | `src/ui/tutorial.js` (ui-developer) |
| Result fields are snake_case (`character_id`, `resonance_after`, `jade_added`) per GDD §11.3 | — | ui-developer, qa-tester |
| Round 3: battle event `hit_discarded` (reason `rush_invulnerable`) | `BATTLE_EVENT_TYPES`, `HIT_DISCARD_REASONS` | Battle scene event switch / hit FX / damage numbers / SFX (ui-developer, vfx-developer, audio-designer): must not show a damage number, "DODGE" or play a hit sound for it |
| Round 3: `whiff.reason` `rush_invulnerable` (new; same tick as a `hit_discarded`) | `WHIFF_REASONS` | Whiff text / "MISS" FX keyed by reason, strings.json (ui-developer, vfx-developer) |
| Round 3: `tri_burst_whiff.reason` list | `TRI_BURST_WHIFF_REASONS` | Any whiff text keyed by reason (ui-developer); `safety_net` should never happen now |
| Round 3: AI `dodgeLog` entries, `outcome` list | `DODGE_DECISION_OUTCOMES` | Balance harness / QA sims only (balance-analyst, qa-tester); not for the UI |

## Headless runs

`npm run sim -- --stage stage_003 --seed 1 --count 100 --player-tier fighter [--json]` runs AI vs AI with no renderer.
