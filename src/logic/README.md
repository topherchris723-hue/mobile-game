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
| `whiff` | side, cardId, reason | |
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
| `tri_burst_start`, `tri_burst`, `tri_burst_hit`, `tri_burst_whiff` | side, members, damages / memberSlot, damage / burst | |
| `climax_cinematic` | side, cardId | |
| `effect`, `buff_end` | side, slot, effect, value | |
| `card_drawn` | side, slot (fighter), handSlot, cardId | refill |
| `input_rejected` | side, input, reason (`vigor`, `state`, `cooldown`, `gauge`, `target`, `empty_slot`, `unavailable`, `not_now`) | shake the card or portrait, "not enough Vigor" flash |
| `freeze_end` | kind, side | |
| `battle_end` | outcome, reason | go to Result |

## After the battle

`src/state/save.js` handles the save: `loadSave(storage, { validate, economy, characters, nowMs })`,
`applyBattleResult(save, stage, result, economy, charactersById, nowIso)` (rewards, missions, best time,
tutorial flag), `writeSave(storage, save, nowMs)`. `storage` is `window.localStorage` in the browser.
`validate` is an Ajv validator compiled from `data/schemas/save.schema.json`.

## Headless runs

`npm run sim -- --stage stage_003 --seed 1 --count 100 --player-tier fighter [--json]` runs AI vs AI with no renderer.
