# Game Design Document — Milestone 1 (Battle + Summon)

Owner: game-designer. Round 1. Source of truth for rules; `docs/GAME_BRIEF.md` overrides this file.

Status legend: `DRAFT` = still being decided, do not build. `READY` = fully specified, can be built.
`BUILT` = implemented and passed QA.

All numbers marked *(data)* live in a data file (see §15). Code must read them and never hardcode them.
The numbers in this document are the default values for that data.

---

## 0. Contents

1. Working title options — DRAFT (owner picks)
2. Vision, pillars, first 30 seconds — READY
3. Glossary and banned terms — READY
4. Milestone scope and screen flow — READY
5. Battle system — READY
6. Characters (fighters) — READY
7. Cards — READY
8. Enemies — READY
9. Stages, missions, tutorial — READY
10. Story text — READY
11. Summon (gacha) — READY
12. Economy — READY
13. Progression and save data — READY
14. Mobile UX and layout — READY
15. Data files, schemas, ID conventions — READY
16. Open questions for the owner — DRAFT

---

## 1. Working title options — DRAFT

The owner picks one. No title uses franchise words or echoes (no "Dragon", "Ball", "Z", "Legends",
"Saiyan", "Piece", "Treasure", "Dokkan", "Rising"). A quick web search found no existing game with
these names, but compliance-checker must run a proper trademark check before release.
("Overpeak" was dropped because a game with that name is already in development.)

| # | Title | One-line pitch |
|---|---|---|
| 1 | **Jade Tempest** | A storm of martial artists fights for the Jade Throne in fast, card-powered real-time duels. |
| 2 | **Meridian Burst** | Channel your fighters' inner energy lines into tag-team combos and one three-fighter finishing blast. |
| 3 | **Heavenbreak** | Train three fighters, ignite their hidden forms and hit so hard the sky cracks open. |
| 4 | **Thunderclap Trio** | Three fighters, one hand of cards, and attacks loud enough to shake the arena. |
| 5 | **Ironroar** | A roaring tournament of fist-fighters and energy-blasters where every comeback ends in a scream. |

---

## 2. Vision, pillars, first 30 seconds — READY

**Pitch:** Real-time 1v1 anime martial-arts fights in portrait 2D. Bring three fighters, tap cards
to attack, swipe to dodge and move, and save up for screen-filling transformations and a team
finishing move.

**Pillars**
1. **Fast and loud.** Each hit has hitstop, numbers and a shout. A battle lasts 2 to 4 minutes.
2. **Easy to start, deep to master.** One tap attacks. Swiping up dodges. Depth comes from timing
   (Perfect Slip, Riposte), positioning (distance), Vigor budgeting and tag timing.
3. **Big moments everyone sees coming.** Ignition (transformation) and Tri-Burst (team finisher)
   have glowing buttons and are announced before they happen, so they feel earned.
4. **Fair.** The AI follows the same costs and rules as the player. Gacha rates are shown, pity
   exists, and everything uses soft currency only.

**First 30 seconds (Stage 1 tutorial, §9.4):**
- 0–5 s: "FIGHT!" Then the prompt "Tap a card to attack." The player taps and sees a hit, a number and a shout.
- 5–15 s: the enemy winds up. The game slows to 0.3× and shows "Swipe UP to Slip!". The player
  dodges, sees "PERFECT SLIP!", and the prompt "Tap a card now to Riposte!" appears.
- 15–30 s: the Vigor bar fills and the prompt "Cards cost Vigor. Watch the bar." appears. The player chains a second card and sees "COMBO x2".
The player now knows the three verbs: tap (attack), swipe up (dodge), swipe left/right (move).
Tag, Ignition and Tri-Burst get their own prompts when they first become available.

---

## 3. Glossary and banned terms — READY

| Our term | Meaning |
|---|---|
| **Fighter** | A playable character. |
| **Team** | The 3 fighters a side brings. One is **active**, two are **benched**. |
| **Vigor** | Team-shared energy (0–10) that pays for cards, Slips and Tag Escapes. |
| **Card** | One attack in the hand. Types: **Fist** (melee), **Bolt** (ranged), **Signature** (special), **Climax** (ultimate). |
| **Hand** | The 4 card slots of the active fighter. |
| **Slip** | Dodge (swipe up or down). Brief invulnerability. |
| **Perfect Slip** | A Slip timed in the last 0.15 s before a hit lands. |
| **Riposte** | Our counter. A free, boosted card played right after a Perfect Slip. |
| **Break Slip** | A Slip used while in hitstun to escape a combo. Costs more. |
| **Dash** | Move forward or back (swipe right or left). |
| **Tag** | Switch the active fighter with a benched one. |
| **Tag Escape** | Tag while in hitstun (costs Vigor). |
| **Tag Strike** | A free hit the incoming fighter makes when tagging in during the enemy's hitstun. |
| **Combo / Chain** | Cards linked while the enemy is still in hitstun. |
| **Ignition** | Per-fighter transformation, once per battle. Button text: "IGNITE!" |
| **Tri-Burst** | Team-wide finishing move, once per battle, charged by the **Burst Gauge** (0–100). |
| **Aura type** | Element: Blaze, Gale, Stone, Radiant, Void. |
| **Resonance** | Duplicate bonus rank (R0–R4). |
| **Jade** | The only currency (soft, earned in play). |

**Banned terms.** These must never appear as names of mechanics, card types, currencies or
rarities, and should not appear in card names: Arts, Strike Arts, Blast Arts, Special Arts,
Ultimate Arts, Ki, Rising Rush, Main Ability, Unique Ability, Z Ability, Vanish, Vanishing Step,
Cover Change, Z Counter, Sparking, Extreme (as a rarity), Hero (as a rarity), Chrono Crystals,
Zenkai, Dragon Ball(s), Saiyan, Super Saiyan, Ascended, Kamehameha, Dokkan, Awaken/Awakening,
Haki, Devil Fruit, Captain Ability, Limit Break, Soul Boost. QA should grep the data for these.

---

## 4. Milestone scope and screen flow — READY

**In scope:** battle, summon screen, 3–5 story stages, team select, minimal save.
**Out of scope:** leveling, items/equipment, stamina, shop, real money, PvP, online, events.

**Screen flow**
```
Title ─► Home ─┬─► Story (stage list) ─► Pre-story ─► Team Select ─► Battle ─► Result ─► Post-story ─► Story
               ├─► Summon ─► Summon results ─► Summon
               └─► Team (view roster, set team)
```
- Home has 3 buttons: Story, Summon, Team. Jade balance is always visible in the top bar.
- Every scene has a back button (≥44×44 px), except Battle, which has Pause → Retreat.
- Story scenes can be skipped (a "Skip" button, ≥44×44 px).

Acceptance:
- AC-4.1: All screens in the diagram can be reached, and the player can return to Home without an app restart.
- AC-4.2: No shop, purchase or real-money UI exists anywhere.

---

## 5. Battle system — READY

### 5.0 Simulation model (for programmers and QA)
- The logic runs at a **fixed 60 ticks per second** (1 tick = 1/60 s) in `src/logic/`, separate from
  rendering. All durations are converted with `ticks = round(seconds × 60)`.
- **Seeded RNG** (`battle_seed`, a 32-bit integer; mulberry32 or similar). Crits, AI rolls and deck shuffles all use it.
  Same seed + same input log ⇒ an identical battle (same damage, same result). The headless simulator
  must run a battle with no renderer.
- **Global freezes** stop everything (fighter timers, Vigor regen, battle timer, buff and Ignition
  durations): hitstop, cinematics (Climax connect, Ignition, Tri-Burst), KO animation and pause.
- **Order inside one tick:** (1) player inputs → (2) AI decisions → (3) timers advance →
  (4) movement → (5) hit resolution: every hit scheduled this tick is computed from the state at
  the start of step 5, then all are applied together → (6) KO checks → (7) win/lose checks.

**Fighter states:** `Idle`, `Dashing`, `Windup`, `Active` (hits landing), `Recovery`, `Slipping`,
`SlipRecovery`, `Hitstun`, `Knockdown`, `Cinematic`, `KO`, `Benched`.

| Action → / State ↓ | Play card | Dash | Slip | Tag | Ignite | Tri-Burst |
|---|---|---|---|---|---|---|
| Idle | yes | yes | yes | yes | yes | yes |
| Dashing | yes (cancels dash) | no | yes | yes | yes | yes |
| Windup / Active | buffer only (§5.7) | no | no | no | yes (cancels card) | no |
| Recovery (after hit = link window) | yes (combo) | no | yes | yes | yes | yes |
| Recovery (after whiff) | no | no | no | no | yes | no |
| Slipping / SlipRecovery | Riposte only (§5.6) | no | no | no | no | no |
| Hitstun | no | no | Break Slip | Tag Escape | yes | no |
| Knockdown | no | no | no | no | no | no |

Disallowed inputs are ignored. A disallowed card tap shakes the card (no Vigor spent, no card used).

### 5.1 Arena and distance
**Purpose:** distance makes moving matter. Melee is strong but you have to close in. Ranged attacks are
safe but can be seen coming.

**Rules**
- Side view. The player's active fighter is on the left facing right; the enemy is on the right facing left.
  Fighters always face each other. Fighters cannot pass through each other.
- The arena is one-dimensional: `x` goes from 0 to 100 units *(data `arena.width`)*. Start positions:
  player x=30, enemy x=70 *(data)*. `distance = |x_enemy − x_player|`.
- `melee_range` = 12, `min_distance` = 8 *(data)*. Walls at x=0 and x=100 clamp all movement and knockback.
- **Dash:** 20 units in 0.20 s *(data)*. A forward dash stops at `min_distance`.
- Melee-delivery cards **auto-approach**: if `distance > melee_range`, the attacker moves toward the
  enemy at 150 units/s *(data `arena.approach_speed`)* until `distance ≤ melee_range`, and the
  windup starts after that. Example: distance 40 → approach 28 units → 0.187 s → 11 ticks, then windup.
- Knockback pushes the defender away by the card's `knockback` units (clamped at the wall).

**Edge cases**
- Defender against a wall: knockback is clamped to 0. Nothing else changes.
- The defender moves during an approach: the approach keeps going until in range or 0.6 s
  has passed (`arena.approach_timeout_s`). After a timeout the card whiffs and enters Recovery.

**Acceptance**
- AC-5.1.1: From the start positions (distance 40), one forward dash leaves distance 20.
  Two dashes leave distance 8 (clamped), not 0.
- AC-5.1.2: Playing a Fist card at distance 40 puts its first hit 11 ticks + windup ticks after the tap.
- AC-5.1.3: No fighter's x is ever outside [0, 100].

### 5.2 Controls and gestures
**Purpose:** one thumb plays the whole game.

**Rules**
- **Tap a card** → play it. A tap is a touch that moves less than 12 px and lasts less than 300 ms.
- **Long-press a card** (≥400 ms) → shows a tooltip (name, type, cost, power, description). Releasing it
  does not play the card. The battle does not pause.
- **Swipe** is a touch that moves at least 24 px within 300 ms. The direction is the dominant axis
  (`|dy| ≥ |dx|` ⇒ vertical).
  - Swipe **right** = Dash forward. Swipe **left** = Dash back.
  - Swipe **up or down** = Slip (or Break Slip during hitstun).
- Swipes can start anywhere on screen except the pause button. A swipe that starts on a card and
  moves ≥24 px is a swipe, not a card play.
- **Tap a bench portrait** → Tag to that fighter.
- **Tap IGNITE** (when shown) → Ignition. **Tap TRI-BURST** (when full) → Tri-Burst.

**Acceptance**
- AC-5.2.1: A swipe that starts on a card and moves 30 px upward triggers a Slip and does not play the card.
- AC-5.2.2: A 450 ms press on a card shows the tooltip and spends no Vigor.
- AC-5.2.3: A diagonal swipe with dx=30, dy=30 triggers a Slip (a tie goes to vertical).

### 5.3 Vigor (energy)
**Purpose:** Vigor creates the core choice: attack now, save for a big card, or keep some for a dodge.

**Rules** *(all data, `battle.vigor`)*
- One team-shared pool. `max = 10`, `start = 5`, `regen_per_s = 1.0`. It is stored as a fractional value; the UI shows `floor`.
- Regen is continuous and pauses only during global freezes. It does not carry past max.
- Costs: cards (per card, see §7), Slip 2, Break Slip 4, Tag Escape 3. Tag and Dash are free.
- An action can be done only if `vigor ≥ cost` (comparing the fractional value). The cost is subtracted at once.
- Ignition gives +3 Vigor on activation (capped at max).

**Example:** start 5.0. Tap a Fist (cost 2) at t=0 → 3.0. At t=2.0 s, Vigor = 5.0. Tap Signature
(cost 5) → 0.0.

**Edge cases**
- Vigor 1.98 with a cost-2 card: the card is greyed and a tap shakes it. At 2.0 it lights up, on the same tick.
- Riposte cards cost 0 (§5.6).

**Acceptance**
- AC-5.3.1: With no actions and no freezes, Vigor goes from 5.0 to 10.0 in exactly 300 ticks and stays at 10.0.
- AC-5.3.2: A card or Slip costing more than the current Vigor does nothing and spends nothing.
- AC-5.3.3: Vigor does not change during a 2.0 s Climax cinematic.

### 5.4 Cards and the hand
**Purpose:** a small changing hand keeps decisions quick (4 options) and different every battle.

**Rules**
- Each fighter has a **deck** of 6–10 cards (recommended 8: 3 Fist, 2 Bolt, 2 Signature, 1 Climax).
  It may have at most 1 Climax and at most 3 copies of any card.
- Each fighter keeps **its own** hand (4 slots, `battle.hand.size`), draw pile and discard pile for
  the whole battle, including while benched.
- Battle start: each deck is shuffled with the seeded RNG, and each fighter draws 4.
- When a card is played, its slot is empty for `refill_delay_s = 1.5` *(data)*, then it is filled
  with the top card of the draw pile. Refill timers keep running while the fighter is benched.
- If the draw pile is empty when a refill happens, the discard pile is shuffled into a new draw pile.
  Cards currently in the hand are never in the discard pile.
- Cards are never discarded automatically. An unaffordable card stays until it is played.
- The card face shows the name, cost badge, type icon (a distinct shape per type, so color is not
  the only cue) and a greyed state when unaffordable.

**Edge cases**
- A deck of 6 with 4 in hand and 2 being refilled: the draw pile can be 0. A refill then reshuffles
  the discard pile. If the discard pile is also empty, the slot waits and retries every tick.
- Ignition swaps the deck (§5.9). The current hand is discarded, the Ignition deck is shuffled
  and 4 cards are drawn immediately. The reverse happens when Ignition ends.

**Acceptance**
- AC-5.4.1: After a card is played, its slot shows the next card exactly 90 ticks later (with no freezes).
- AC-5.4.2: Over 1,000 seeded draws, no card appears in the hand more times at once than its copy count.
- AC-5.4.3: A benched fighter with 2 empty slots has a full hand when it tags in 1.5 s later.

### 5.5 Attacks, hits and hitstun
**Purpose:** readable attacks with clear wind-ups are what make dodging fair.

**Rules** (per card; values are in card data, §7)
- Sequence: [approach if melee] → `windup_s` → hits (`hits` count, `hit_interval_s` apart) → `recovery_s`.
- **Delivery**
  - `melee`: auto-approach, then the hits land at the defender's position.
  - `projectile`: the first hit lands `distance / projectile_speed` seconds after the windup ends.
    Example: distance 40, speed 160 → 0.25 s → 15 ticks.
  - `beam`: the first hit lands on the tick the windup ends (any distance).
- **The first hit decides the whole card:** if the defender is invulnerable (Slip, tag-in,
  getup) on the first hit tick, every hit of that card misses (a whiff). Otherwise all hits land.
- Each landed hit puts the defender in `Hitstun` for `hitstun_s` (it resets, it does not stack) and
  applies 1/hits of the knockback.
- **Interrupt:** if a fighter is hit during its own `Windup` or approach and the card is not
  `armor: true`, the card is cancelled and its Vigor is lost. Climax cards always have armor.
- **Trade:** if both fighters land hits on the same tick, both take damage and both enter hitstun.
- **Hitstop:** on each landed hit, a global freeze of `battle.hitstop_s[type]` *(data: fist 0.04,
  bolt 0.03, signature 0.06, climax 0)* happens, for game feel.
- **Climax cinematic:** if a Climax's first hit lands, a cinematic of `cinematic_s` plays (a global
  freeze; the hits are applied during it, with damage numbers shown). If it whiffs, there is no cinematic.

**Acceptance**
- AC-5.5.1: A 3-hit card whose first hit is dodged deals 0 damage on all 3 hits.
- AC-5.5.2: A non-armor Signature hit during its windup is cancelled and the Vigor is not refunded.
- AC-5.5.3: A Climax hit during its windup is not cancelled (the attacker takes the damage and keeps going).
- AC-5.5.4: Two attacks landing on the same tick both deal damage.

### 5.6 Slip (dodge), Perfect Slip and Riposte (counter)
**Purpose:** the skill hook. Reading a wind-up and dodging late feels great and pays off with a free counter.

**Rules** *(data `battle.slip`, `battle.riposte`)*
- **Slip:** swipe up or down. Cost 2 Vigor. The fighter is invulnerable for `iframes_s = 0.35`, then has
  `recovery_s = 0.15` of SlipRecovery (vulnerable, cannot act except Riposte).
- **Perfect Slip:** a hit that would have landed at tick `th` is dodged during a Slip that started at tick `t0`,
  and `th − t0 ≤ perfect_window_s (0.15 s = 9 ticks)`. Reward: 2 Vigor refunded, +5 Burst Gauge, the text
  "PERFECT SLIP!", and a Riposte window.
- A normal dodge (`th − t0` from 10 to 21 ticks) avoids the damage with no other reward.
- **Riposte window:** `window_s = 0.8` from the Perfect Slip. The next Fist, Bolt or Signature card
  tapped in the window is a **Riposte**: cost 0, approach and windup skipped (the attacker appears at
  melee range or fires from where it is), first hit after 0.1 s, damage ×1.25 *(data)*. Climax cards
  cannot be Riposte cards. The enemy whose attack was slipped is still in Recovery from that whiffed
  card, so a Riposte almost always lands, unless the enemy uses Ignition or is invulnerable.
- **Break Slip:** a Slip used while in `Hitstun`. Cost 4. Same i-frames. It ends hitstun at once. It never
  counts as Perfect.

**Edge cases**
- A Slip with Vigor < 2 does nothing (a "not enough Vigor" flash).
- A multi-hit projectile volley whose first hit falls inside the i-frames whiffs completely, even
  if later hits fall after them.
- A Perfect Slip against a Tri-Burst rush or a Climax still gives a Riposte window.
- Only one Riposte per window. The window closes once a card is played or after 0.8 s.

**Acceptance**
- AC-5.6.1: A Slip started 6 ticks before a hit: no damage, Vigor net 0, a Riposte window opens.
- AC-5.6.2: A Slip started 15 ticks before a hit: no damage, Vigor −2, no Riposte window.
- AC-5.6.3: A Slip started 25 ticks before a hit: the hit lands (outside the 21-tick i-frames).
- AC-5.6.4: A Riposte Fist with power 1.2 deals exactly 1.25× the damage of the same Fist without Riposte
  (same seed, no crit) and costs 0.
- AC-5.6.5: A Break Slip in hitstun with Vigor 3.9 fails. With 4.0 it succeeds and leaves 0.0.

### 5.7 Combos
**Purpose:** chaining cards rewards fast reading of the hand, and the combo counter is a hype moment.

**Rules** *(data `battle.combo`)*
- **Link window:** when a card's last hit **lands**, its `Recovery` becomes a link window. Playing a
  card then cancels the rest of the recovery and starts the new card (approach and windup apply as normal).
- **Input buffer:** a card tapped during your own Windup or Active, at most `buffer_s = 0.25` before
  the link window opens, is played automatically when it opens. If the current card whiffs, the
  buffered tap is dropped.
- A **chain** continues while every new card's first hit lands while the defender is still in Hitstun.
  `chain_index` = the card's position in the chain (1, 2, 3…). The **hit counter** shows the total landed hits.
- **Combo bonus:** `combo_mult = 1 + 0.05 × min(chain_index − 1, 4)` → 1.00, 1.05, 1.10, 1.15, 1.20.
- **Chain cap:** after the 5th card of a chain (`max_cards = 5`) finishes its hits, the defender is
  knocked into `Knockdown`: pushed 25 units, then 0.6 s of getup during which they are invulnerable and cannot act.
  The chain ends.
- A chain ends when the defender leaves Hitstun, or on Knockdown, Break Slip or Tag Escape.
- When a chain of 3 or more cards ends, the attacker's team gains +5 Burst Gauge.
- Tag Strike (§5.8) counts as one card in the chain.

**Example:** Fist (2 Vigor) → Fist (2) → Bolt (3). The third card has chain_index 3 → ×1.10. That is 7 Vigor in all.

**Acceptance**
- AC-5.7.1: A 3rd chained card deals exactly 1.10× its unchained damage (same seed, no crit).
- AC-5.7.2: After a 5th chained card, the defender is in Knockdown and a 6th card cannot hit for 36 ticks.
- AC-5.7.3: A card tapped 10 ticks before the link window opens starts on the tick it opens.

### 5.8 Team, Tag and KO
**Purpose:** three fighters give the player a second plan. Tagging escapes trouble, changes Aura
type and reshuffles your options.

**Rules** *(data `battle.tag`)*
- Each team has 3 slots. Slot 1 starts active. Tag is free with `cooldown_s = 8` shared by the team,
  starting when the tag happens. The bench portraits show a radial cooldown.
- Tag swaps instantly. The incoming fighter appears at the outgoing fighter's x, in `Idle`, with
  `invuln_s = 0.5`.
- **Tag Escape:** a Tag while in hitstun. Cost 3 Vigor, plus the normal cooldown. It ends the enemy's chain.
- **Tag Strike:** if the enemy is in Hitstun on the tag-in tick, the incoming fighter auto-performs a
  free melee hit: power `tag_strike_power = 0.8`, 1 hit, hitstun 0.6 s, knockback 4, no windup (first hit
  after 0.1 s). It counts as a card in the chain.
- Buffs and debuffs on the outgoing fighter stay with it, and their timers pause while it is benched.
  Ignition ends when its fighter tags out.
- **KO:** at HP 0 the fighter is KO'd. The KO animation is a global freeze of 1.5 s. Then the next living
  fighter in slot order comes in automatically with 1.5 s invulnerability, and the tag cooldown resets to 0.
  KO'd fighters cannot be tagged in (their portrait is greyed and a tap does nothing).
- An ally KO adds +15 Burst Gauge to the team that lost the fighter.

**Edge cases**
- A tag tapped during cooldown or during the active fighter's Windup/Active is ignored and the
  portrait shakes.
- Only 1 fighter alive: the bench portraits are greyed and Tag is unavailable.
- An enemy whose KO happens during its own Climax cinematic: the cinematic finishes, then the KO happens.

**Acceptance**
- AC-5.8.1: After a Tag, a second Tag is impossible for exactly 480 ticks.
- AC-5.8.2: A Tag Escape with Vigor 2.5 fails. With 3.0 it succeeds and the enemy's chain counter resets.
- AC-5.8.3: When slot 1 is KO'd while slot 2 is alive, slot 2 comes in automatically and Tag is immediately available.
- AC-5.8.4: A tag-in during the enemy's hitstun produces one Tag Strike hit.

### 5.9 Ignition (transformation) — the big moment
**Purpose:** a comeback-and-hype moment the owner explicitly asked for. It changes your look,
stats and cards for a short power spike.

**Rules** (per fighter in `characters.json` → `ignition`; fighters without an `ignition` block cannot use it)
- **Trigger:** the IGNITE button (56×56 px) appears when **any** of the fighter's triggers is met:
  - `hp_below_pct` (value 1–99): current HP ≤ value% of max.
  - `battle_time_s`: at least this many seconds of battle timer have elapsed.
  - `cards_played`: this fighter has played at least this many cards this battle.
  - `ally_ko`: at least this many teammates have been KO'd.
  Once available, it stays available until used. **Once per fighter per battle.** It can only be used
  while that fighter is active. Benched fighters' triggers are still checked.
- **Activation:** allowed in the states in the §5.0 table (including Hitstun, which makes it a combo breaker).
  1. The fighter's current card is cancelled (no refund). Its chain ends.
  2. A global freeze cinematic of `battle.ignition.cinematic_s = 1.5` plays, with the shout text and the form name.
  3. Effects: heal `heal_pct` of max HP; +3 Vigor; the enemy is pushed 20 units and its current card
     cancelled (this ignores i-frames and deals no damage); the deck is swapped to `ignition.deck`,
     the hand redrawn to 4.
  4. For `duration_s` (excluding freezes): ATK × `stat_mult.atk`, DEF × `stat_mult.def`, Vigor regen
     + `vigor_regen_bonus` per second.
- **End:** when the duration runs out, on tag-out or on KO. Stats and deck revert, and the hand is redrawn to 4 from the base deck.
- The timer bar is shown under the fighter's HP bar.

**Example:** Ignition (atk 1.30, def 1.20, regen +0.2, heal 10%, duration 25 s). A fighter with HP 3,000/10,000
ignites → HP 4,000. ATK 1,000 → 1,300. Vigor 4.0 → 7.0 and then regenerates at 1.2/s.

**Edge cases**
- Ignite and a lethal hit on the same tick: inputs come first (§5.0), so Ignition happens first and the
  enemy's card is cancelled.
- Both sides ignite on the same tick: the player's cinematic plays first, then the enemy's.
- Buff and Ignition multipliers stack multiplicatively (§5.11).

**Acceptance**
- AC-5.9.1: A fighter with trigger `hp_below_pct: 50` shows IGNITE at exactly HP ≤ 50% and not before.
- AC-5.9.2: After use, IGNITE never appears again for that fighter in that battle.
- AC-5.9.3: ATK is ×1.30 for exactly 1,500 unfrozen ticks, then reverts. The hand then contains only base-deck cards.
- AC-5.9.4: Igniting in hitstun ends hitstun and pushes the enemy 20 units.

### 5.10 Tri-Burst (team finisher)
**Purpose:** a team-wide hype finisher. The whole team appears for one huge attack. It charges
from fighting, so every battle reaches it.

**Rules** *(data `battle.burst`)*
- **Burst Gauge** 0–100 per team. Gains:
  - Dealing damage: `+40 × damage / target_max_hp`. Example: 1,000 damage on a 10,000 HP target → +4.
  - Taking damage: `+25 × damage / own_max_hp`. 1,000 damage on a 10,000 HP fighter → +2.5.
  - Perfect Slip +5. A chain of 3+ cards ends +5. Ally KO'd +15.
  - It is capped at 100. Gains stop after Tri-Burst is used.
- **Once per battle per team.** At 100 the TRI-BURST button (64×64 px) pulses.
- **Use:** allowed in Idle, Dashing or a link window. The active fighter rushes for `rush_time_s = 0.3`
  (invulnerable and armored during the rush). The rush hits the enemy at the end of the rush. If the enemy is invulnerable
  on that tick (Slip, getup, tag-in), it **whiffs**: the gauge is refunded 50% and Tri-Burst can be used again
  once it is full. If it lands: a cinematic of 4.0 s (a global freeze) with every **living** team member.
- **Damage:** one hit per living member *i*:
  `hit_i = floor( ATK_i × 3.0 × max(1.0, type_mult(aura_i, target)) × def_factor(target) )`, then the min/max caps from §5.11.
  `ATK_i` is that member's stat after Resonance, plus buffs and Ignition only if it is the active fighter. Tri-Burst cannot crit and has no combo bonus.
- **Example:** living ATK 1,000 (Blaze), 1,100 (Stone), 900 (Void). Target Gale, DEF 500
  → def_factor = 1000/1500 = 0.6667.
  Hits: 1000×3×1.3×0.6667 = **2,600**; 1100×3×1.0×0.6667 = **2,200**; 900×3×1.0×0.6667 = **1,800** → 6,600 in total.
- Damage does not carry over to the next enemy after a KO.

**Acceptance**
- AC-5.10.1: Dealing exactly 2,500 damage to a 10,000 HP enemy raises the gauge by exactly 10.
- AC-5.10.2: The example team above against that target deals exactly 6,600 (no crit possible).
- AC-5.10.3: After a landed Tri-Burst, the gauge shows USED and stays 0 for the rest of the battle.
- AC-5.10.4: A whiffed Tri-Burst leaves the gauge at 50.

### 5.11 Damage formula, crits and caps
**Purpose:** one predictable formula that the balance analyst can simulate.

**Effective stats**
```
stat_base   = floor(char.base_stats.X × (1 + 0.05 × resonance))        # player fighters
stat_base   = floor(char.base_stats.X × enemy.stat_mult.X)              # enemies (resonance 0)
buff_factor = clamp(1 + Σup − Σdown, 0.5, 1.5)                          # §5.13
ATK_eff     = stat_base_atk × ignition_atk_mult × buff_factor_atk       # ignition mult = 1.0 if not ignited
DEF_eff     = stat_base_def × ignition_def_mult × buff_factor_def
```
**Per-hit damage**
```
def_factor = 1000 / (1000 + DEF_eff)
hit = floor( ATK_eff × (card.power / card.hits) × type_mult × crit_mult × combo_mult × riposte_mult × def_factor )
hit = clamp(hit, 1, 99999)
```
- `crit_mult` = 1.5 if crit, else 1.0. Crit is rolled **once per card** on its first landed hit;
  chance = `crit_rate` (character data, default 0.05), capped at 0.50. A Riposte rolls crit as normal.
- `riposte_mult` = 1.25 for a Riposte card, else 1.0.
- `type_mult` from §5.12.
- HP never goes below 0 or above max. Heals use `floor(max_hp × pct)`.

**Example:** ATK 1,000; a 2-hit Fist with power 1.2 → 0.6 per hit; Blaze attacker vs Gale defender
(×1.3); chain_index 2 (×1.05); no crit; DEF 500 (0.6667).
`1000 × 0.6 × 1.3 × 1.05 × 0.6667 = 546.0` → **546 per hit, 1,092 total**.

**Acceptance**
- AC-5.11.1: The example above gives exactly 546 per hit (a unit test with fixed inputs).
- AC-5.11.2: Power 0.01 against DEF 3,000 deals 1 (the minimum), never 0.
- AC-5.11.3: Over 100,000 seeded card uses at crit_rate 0.05, the crit frequency is within 0.05 ± 0.003.
- AC-5.11.4: The buff factor never goes outside [0.5, 1.5], even with 4 stacked buffs.

### 5.12 Aura types (elements) — READY
**Purpose:** team building and tag choices matter. It is simple enough to learn from icons.

| Attacker → Defender | Effect |
|---|---|
| Blaze → Gale, Gale → Stone, Stone → Blaze | advantage ×1.3 |
| Gale → Blaze, Stone → Gale, Blaze → Stone | disadvantage ×0.8 |
| Radiant ↔ Void (either direction) | advantage ×1.3 (high risk, high reward) |
| everything else (incl. the same type) | ×1.0 |

The full matrix is stored in `battle.json` → `type_chart` (25 entries). Each type has a unique icon
shape: Blaze = flame, Gale = swirl, Stone = hexagon, Radiant = star, Void = crescent.
Damage numbers show "WEAK!" on ×1.3 hits and "RESIST" on ×0.8 hits.

- AC-5.12.1: All 25 attacker/defender pairs return the values in the table.

### 5.13 Card effects (buffs, debuffs, utility)
**Rules** — effect types (applied `on: "hit"` = on the first landed hit, or `on: "use"` = when the card starts):
`atk_up`, `def_up`, `atk_down`, `def_down` (value is a fraction, e.g. 0.2; `duration_s` 3–20),
`heal_pct` (a fraction of max HP, instant), `vigor_gain` (instant, capped), `burst_gain` (instant, capped).
- The same type on the same target **does not stack**: keep the higher value; the duration is set to the new one.
  Different types sum into `buff_factor` (e.g. atk_up 0.2 and atk_down 0.3 → 0.9).
- `on: "hit"` effects do nothing if the card whiffs.
- Buffs belong to the fighter (they pause while it is benched and are removed on KO).
- AC-5.13.1: atk_up 0.2 applied twice gives 1.2, not 1.4. The second application refreshes the duration.

### 5.14 Win, lose, timer
**Rules**
- Battle intro: 2.0 s of names and shouts, then "FIGHT!" (not counted on the timer).
- The timer is `stage.timer_s` (default 180). It counts down in unfrozen ticks and is shown as `ceil(seconds)`.
- **Win:** all enemy fighters KO'd. **Lose:** all player fighters KO'd.
- **Timeout:** compare `team_hp_ratio = Σ current HP / Σ max HP` over all 3 fighters (KO'd = 0). Higher
  wins. An exact tie = **Draw**.
- Both teams wiped on the same tick = **Draw**.
- A Draw counts as not cleared (no rewards, no missions). The result screen offers Retry.
- **Pause:** the pause button (top-right, 44×44) freezes everything. The menu has Resume and Retreat
  (Retreat = loss, confirmed with a dialog). The app going to the background pauses the battle automatically.
- Expected length: Stage 3+ battles 120–200 s of timer plus about 20–40 s of cinematics, which is 2.5–4 min.

**Acceptance**
- AC-5.14.1: With a 180 s timer and no freezes, timeout happens after exactly 10,800 ticks.
- AC-5.14.2: At timeout, player 0.40 vs enemy 0.35 → Win. 0.35 vs 0.35 → Draw.
- AC-5.14.3: Backgrounding the app during a battle pauses it, and the timer does not move.

### 5.15 AI opponent
**Purpose:** stage difficulty that feels like a person who gets better, not one who cheats.

**Fairness rules (all tiers):** the AI pays the same Vigor costs, has the same hand, deck, cooldown and
Burst rules, and reads only public state plus its own hand. It reacts to the player's windups only
after `reaction_s`. It never reads the player's hand or inputs before they happen.

**Decision loop**
- Every `think_interval_s` (±20% seeded jitter), when able to act, it goes down this list and does the first that applies:
  1. In Hitstun: if `vigor ≥ slip.break_cost` (4) and roll < `break_slip_chance` → Break Slip.
  2. IGNITE available for at least `ignite_delay_s` → Ignite.
  3. Burst full, `uses_burst`, and its state allows it → Tri-Burst.
  4. HP ratio < `tag_hp_pct`, tag ready, a living bench fighter exists → Tag to the bench fighter with the highest HP.
  5. Climax affordable and roll < `climax_chance` → play Climax.
  6. Pick an affordable card with `vigor − cost ≥ vigor_reserve`: if distance ≤ 30, prefer Fist > Signature > Bolt;
     else prefer Bolt > Signature > Fist. Roll < `aggression` → play it.
  7. Move: if distance > `preferred_distance` + 5, Dash forward. If distance < `preferred_distance` − 15 and
     roll > `aggression`, Dash back. Otherwise idle.
- **Reactive dodge:** when the player's card windup starts, the AI waits `reaction_s`. If its first hit has not landed by then,
  it rolls `slip_chance` (needs Vigor ≥ 2). On success it rolls `perfect_slip_chance`: success → it starts the Slip
  6 ticks before the hit; else → 15 ticks before. If that tick is already past, it slips now.
- **Combo:** when its card lands and the link window opens, roll `combo_continue` → play the next affordable card.
- **Riposte:** after its own Perfect Slip, roll `riposte_chance` → play a Riposte.

**Tiers** *(data `battle.ai_tiers`)*

| Param | rookie | fighter | veteran | master |
|---|---|---|---|---|
| think_interval_s | 1.4 | 1.0 | 0.75 | 0.55 |
| reaction_s | 0.45 | 0.35 | 0.27 | 0.20 |
| slip_chance | 0.10 | 0.25 | 0.40 | 0.55 |
| perfect_slip_chance | 0.00 | 0.15 | 0.30 | 0.50 |
| riposte_chance | 0.00 | 0.50 | 0.80 | 1.00 |
| combo_continue | 0.25 | 0.45 | 0.65 | 0.80 |
| break_slip_chance | 0.00 | 0.15 | 0.30 | 0.45 |
| tag_hp_pct | 0.00 (never) | 0.25 | 0.35 | 0.40 |
| climax_chance | 0.50 | 0.70 | 0.90 | 1.00 |
| ignite_delay_s | 4.0 | 2.0 | 1.0 | 0.5 |
| uses_burst | false | true | true | true |
| vigor_reserve | 0 | 0 | 2 | 2 |
| aggression | 0.40 | 0.55 | 0.65 | 0.75 |
| preferred_distance | 30 | 25 | 20 | 15 |

**Acceptance**
- AC-5.15.1: 1,000 seeded headless battles with the same scripted player vs each tier: the win rate for the scripted
  player is strictly decreasing from rookie → master (the balance-analyst sets the exact targets).
- AC-5.15.2: The AI never takes an action it could not afford (log assertion over 1,000 battles).
- AC-5.15.3: A rookie never Perfect Slips. A rookie never uses Tri-Burst.
- AC-5.15.4: The AI never starts a Slip earlier than `reaction_s` after the windup start of the attack it dodges (check in the log).

---

## 6. Characters (fighters) — READY

A fighter is defined entirely in `data/characters.json` (schema `characters.schema.json`).

**Fields:** `id`, `family` (the same person across variants; a team cannot hold 2 of the same family),
`name` (≤16 chars), `epithet` (≤32), `rarity` (3/4/5 stars), `aura` (type), `playable` (false =
enemy-only, never in banners), `base_stats` {hp, atk, def, crit_rate}, `deck`, optional `ignition`,
`art` keys, `shouts`, `bio` (≤200 chars).

**Stat bands by rarity** (content-designer stays inside these; the balance-analyst may move them later)

| Rarity | HP | ATK | DEF | crit_rate |
|---|---|---|---|---|
| ★3 | 8,000–9,000 | 850–950 | 400–480 | 0.05 |
| ★4 | 9,000–10,000 | 950–1,050 | 450–530 | 0.05–0.08 |
| ★5 | 10,000–11,000 | 1,050–1,150 | 500–580 | 0.05–0.10 |

**Roster guidance for the milestone (6–10 fighters, recommended 8):** 3 ★3 (the free starters, one each
of Blaze/Gale/Stone), 3 ★4, 2 ★5. At least one Radiant and one Void. ★4 and ★5 fighters must have an
Ignition. ★3 may have one (recommended: at least 1 of the 3, so the tutorial can show it).
Every fighter is original (§3 banned terms, CLAUDE.md §9). Over-the-top shouts are encouraged.

**Ignition guidance:** stat_mult atk 1.20–1.40, def 1.10–1.30, duration 20–30 s, heal 0.05–0.15,
vigor_regen_bonus 0–0.3. Triggers: usually `hp_below_pct` 40–60 plus `battle_time_s` 60–100,
so every fighter can reach it.

- AC-6.1: Adding a new fighter (character entry + its cards) and adding it to a banner pool makes it
  summonable and playable with no code change.
- AC-6.2: The team select screen refuses 2 fighters of the same `family`.

---

## 7. Cards — READY

Defined in `data/cards.json` (schema `cards.schema.json`). "Skills" in older docs = cards.

**Fields:** `id`, `name` (≤18 chars), `type`, `owner` (a character id or `"common"`), `cost`, `power`,
`hits`, `delivery`, `windup_s`, `hit_interval_s`, `recovery_s`, `hitstun_s`, `knockback`,
`projectile_speed` (projectile only), `armor`, `cinematic_s` (Climax only), `effects[]`,
`description` (≤80 chars), `shout` (≤30), `art` {icon, vfx}, `sfx`.

**Type rules (enforced by the schema)**
- `fist` → delivery `melee`. `bolt` → `projectile` or `beam`. `climax` → `armor: true`, `cinematic_s` ≥ 1.0.
- `projectile` delivery → requires `projectile_speed`.

**Budgets** (power is the total over all hits)

| Type | Cost | Power | Hits | windup_s | recovery_s | hitstun_s | knockback |
|---|---|---|---|---|---|---|---|
| Fist | 2 | 1.0–1.3 | 1–3 | 0.10–0.20 | 0.25–0.35 | 0.55–0.70 | 2–6 |
| Bolt | 3 | 1.4–1.7 | 1–5 | 0.20–0.35 (beam 0.35–0.50) | 0.30–0.40 | 0.50–0.70 | 6–12 |
| Signature | 4–6 | cost × 0.55–0.65 | 1–6 | 0.25–0.50 | 0.35–0.50 | 0.70–0.90 | 6–15 |
| Climax | 7–8 | 5.0–6.0 (Ignition Climax 6.5–7.5) | 3–10 | 0.60–0.80 | 0.50–0.70 | 1.00 | 20–30 |

- Each effect on a card lowers its power budget by 0.3 (e.g. a cost-5 Signature with atk_up → 2.45–2.95).
- `hit_interval_s` 0.05–0.25. `projectile_speed` 120–200 units/s. `cinematic_s` 1.5–3.0.
- The hitstun of a Fist (0.55+) is longer than the windup+approach of a follow-up Fist at melee range
  (0.10–0.20), so Fist → Fist chains are possible. A Bolt's knockback (6–12) can push past melee range, so a Fist after it
  approaches. That is intended: the approach time is the skill window for the defender.

- AC-7.1: A card file entry violating a type rule (e.g. fist + beam) fails schema validation.

---

## 8. Enemies — READY

`data/enemies.json` (schema `enemies.schema.json`). An enemy reuses a character's kit and art and adds
difficulty settings.

**Fields:** `id`, `character_id`, optional `name_override`, `ai_tier`, `stat_mult` {hp, atk, def}
(0.3–5.0), `ignition_enabled` (if false, the character's Ignition is ignored), `boss` (true = big HP bar
and a name banner; no other rule changes).

- Enemy stats: `floor(base × stat_mult)`. Enemies have no Resonance.
- An enemy may use a `playable: false` character (an enemy-only boss).
- AC-8.1: An enemy with stat_mult.hp 1.2 on a 10,000 HP character has exactly 12,000 HP.

---

## 9. Stages, missions, tutorial — READY

`data/stages.json` (schema `stages.schema.json`).

### 9.1 What a stage defines
`id`, `chapter_id`, `order`, `name`, `description` (≤120), `enemy_team` (1–3 enemy ids; they enter in order),
`timer_s` (60–300), `recommended_power`, `unlock_requires` (a stage id or null), `background`, `bgm`,
`story` {pre, post} (scene ids or null), `rewards` {first_clear[], repeat_clear[]}, `missions[]` (0–3),
`tutorial_steps[]` (optional).

**Reward entry:** `{ "type": "currency", "currency_id": "cur_jade", "amount": 300 }` or
`{ "type": "character", "character_id": "char_xxx_001" }` (a character reward gives a copy, with the same duplicate
rules as summons, §11.4).

**Rules**
- Stage 1 is always unlocked. The others unlock when `unlock_requires` is cleared.
- First-clear rewards are given once ever. Repeat-clear rewards are given on every later win.
- Only a **Win** gives rewards or completes missions. Lose, Draw and Retreat give nothing and cost nothing.
- Recommended power is advisory only (shown in green if team power ≥ recommended, else red).

**Team power** (shown on Team Select and the stage list):
`fighter_power = floor((HP × 0.1 + ATK × 1.0 + DEF × 0.5))` using the stats after Resonance;
`team_power = Σ` over 3. Example: HP 8,500, ATK 900, DEF 440 → 850 + 900 + 220 = **1,970**.
The coefficients are in `economy.json` → `power_formula`.

### 9.2 Milestone stage plan (content-designer fills names, enemies and story)

| Stage | Enemies | AI tiers | stat_mult (hp/atk/def) | timer_s | First clear | Repeat |
|---|---|---|---|---|---|---|
| stage_001 (tutorial) | 1 | rookie | 0.7/0.7/0.7 | 120 | 300 Jade | 30 |
| stage_002 | 2 | rookie | 0.8/0.8/0.8 | 150 | 300 Jade | 30 |
| stage_003 | 3 | fighter | 0.9/0.9/0.9 | 180 | 400 Jade | 40 |
| stage_004 | 3 | fighter, fighter, veteran | 1.0/1.0/1.0 | 180 | 500 Jade | 50 |
| stage_005 (boss) | 3 | veteran, veteran, master (boss) | 1.05; boss 1.2/1.1/1.1 | 180 | 600 Jade + 1 ★4 fighter | 60 |

### 9.3 Missions
Up to 3 per stage. Each gives its reward once, on the first win in which it is met (they may be met in different clears).
Types (`type` + `value`): `win` (value ignored), `no_ko` (no player KO), `time_under_s` (timer elapsed < value),
`use_tri_burst`, `use_ignition`, `perfect_slips_at_least` (value = count), `max_chain_at_least` (value = chain cards).
Recommended: 50 Jade each.
- AC-9.3.1: Winning stage_001 with 0 KOs and 2 Perfect Slips completes `no_ko` and `perfect_slips_at_least: 2` together.

### 9.4 Tutorial steps (data-driven)
`tutorial_steps[]`: `{ trigger, text (≤90), required_action }`.
- Triggers: `battle_start`, `enemy_windup`, `card_playable`, `vigor_full`, `chain_possible`, `tag_ready`,
  `ignition_ready`, `burst_ready`.
- Required actions: `play_card`, `slip`, `dash_forward`, `dash_back`, `tag`, `ignite`, `tri_burst`, `none`.
- When a step triggers, the game runs at 0.3× speed (logic ticks scaled) with the prompt and a pointing hand
  until the required action is done (or for 3 s if `none`). Each step fires once per battle. The steps run only
  on the first clear attempt until `tutorial.completed` is set in the save (set on the first win of stage_001).
- AC-9.4.1: On a fresh save, Stage 1 shows the "Swipe UP to Slip" step at the first enemy windup and resumes
  normal speed right after a Slip.

---

## 10. Story text — READY

`data/story.json` (schema `story.schema.json`). Short scenes before and after stages.

- Scene: `id`, `background`, `lines[]`. Line: `speaker` (a character id, or `"narrator"`, or `"npc"` with
  `name`), `side` (left/right/center), `expression` (an asset suffix, e.g. `angry`), `text` (≤140 chars, one phone
  screen).
- Tap advances a line; "Skip" ends the scene. Scenes are 3–10 lines (about 20–40 s of reading).
- AC-10.1: Every `story.pre/post` scene id in stages exists in story.json (cross-file check, §15.3).

---

## 11. Summon (gacha) — READY

`data/banners.json` (schema `banners.schema.json`). Soft currency (Jade) only. **No real money.**

### 11.1 Screen
- Banner art, name, featured fighters (portrait + rarity + aura).
- Jade balance. Buttons: **Summon ×1 (100 Jade)**, **Summon ×10 (1,000 Jade)**. A button is disabled when the player
  cannot afford it, with the text "Not enough Jade — clear stages to earn more."
- **Rates** button → a full rate table (per rarity and per fighter, 2 decimals) and the rules text (pity, 10× guarantee,
  duplicates). **Pity counter** always visible: "★5 guaranteed within N summons."
- A confirm dialog shows the cost and the balance after.
- Reveal animation (skippable with a tap), then a results grid that tags each fighter NEW, "Resonance +1"
  or "+N Jade".

### 11.2 Rates (integers in basis points; 10,000 bp = 100%)
- Default rates: ★5 300 bp (3.00%), ★4 1,700 bp (17.00%), ★3 8,000 bp (80.00%). They must sum to exactly 10,000.
- **Per-fighter rate inside a rarity:** featured fighters get `share_bp` of that rarity's rate. The remainder
  (`10000 − Σ featured share_bp`) is split equally across the non-featured pool fighters of that rarity.
  Example: ★5 = 300 bp, featured A share 5,000 → A = 1.50%. Non-featured ★5 B (the only other one) = 1.50%.
- The pool is explicit (`pool[]`). Only `playable: true` characters may appear in it.

### 11.3 Guarantees and pity (order of checks per pull)
1. **Hard pity:** `pity_counter` counts pulls since the last ★5 (per `pity_group`). If the counter is
   `hard_pity − 1` before the pull (default `hard_pity = 40`), this pull is ★5.
2. **First 10× guarantee** (if `first_multi_min_rarity` is set; default 5 on the starter banner): the
   player's first ever ×10 on that banner contains at least one ★5. If pulls 1–9 have none, pull 10 is ★5.
3. **10× guarantee:** if pulls 1–9 of a ×10 have no ★4 or better, pull 10 is drawn from ★4+ only,
   renormalized (★5 = 300/2000 = 15%, ★4 = 85%).
4. Otherwise a normal roll.
- Any ★5 resets `pity_counter` to 0. Otherwise it goes up by 1 per pull.
- **Anti-reroll:** the results and the new balance are saved **before** the reveal animation plays. Quitting does not change
  results.
- The RNG is injectable (seeded in tests).

### 11.4 Duplicates
- First copy: added to the roster (Resonance 0).
- Each duplicate: Resonance +1, up to 4 (`economy.duplicates.max_resonance`). Each rank gives +5% HP/ATK/DEF.
- Beyond R4: converted to Jade: ★3 → 10, ★4 → 40, ★5 → 200 *(data)*.

**Acceptance**
- AC-11.1: 1,000,000 seeded single pulls with pity disabled in the test: each rarity's frequency is within ±0.1
  percentage points of its rate.
- AC-11.2: With the pity counter at 39, the next pull is ★5 (100 of 100 seeded trials).
- AC-11.3: In a ×10 where a seeded RNG gives 9 ★3, pull 10 is ★4 or ★5.
- AC-11.4: The in-game rate table equals the data (rarity bp / 100 shown as a percent with 2 decimals) and the per-fighter rates
  in a rarity sum to that rarity's rate.
- AC-11.5: Killing the app during the reveal and reopening shows the same fighters owned and the Jade deducted once.
- AC-11.6: A ×10 with 999 Jade is impossible (the button is disabled).

---

## 12. Economy — READY

`data/economy.json` (schema `economy.schema.json`).

- Currencies: one, `cur_jade` "Jade", max 999,999 (excess is lost; the UI warns at the cap).
- Start: 1,000 Jade, the 3 ★3 starter fighters, team = those 3.
- Summon costs (in banner data): 100 single, 1,000 ×10.
- Milestone Jade budget (first-time): start 1,000 + stage first clears 2,100 + missions 15 × 50 = 750 →
  **3,850 Jade ≈ 38 pulls**, with a guaranteed ★5 on the first ×10. P(no further ★5 in the remaining 28 single-rate
  pulls) = 0.97^28 ≈ 43%. That is fine because the guarantee already gives one, and repeat clears (30–60) give more.
- Duplicate conversion and the power formula live here (§11.4, §9.1).
- AC-12.1: A fresh save has exactly 1,000 Jade and the 3 starters defined in economy.json.

---

## 13. Progression and save data — READY

Schema `save.schema.json` (runtime save, not shipped content). Stored as JSON in local storage under the key
`game_save`. It is written after: a battle result, a summon (before the reveal), a team change, a settings change.

**Contents:** `version`, `created_at`, `updated_at`, `currencies` {cur_jade}, `roster[]`
{character_id, resonance, obtained_at}, `team` (3 character ids, distinct families, all owned),
`stages` {stage_id: {cleared, clears, best_time_s, missions_completed[]}}, `summon` {pity {group: counter},
first_multi_done {banner_id: bool}, total_pulls}, `settings` {bgm_volume, sfx_volume, haptics},
`tutorial` {completed}.

**Rules**
- On load: parse and validate against the schema. If that fails, copy the raw text to `game_save_corrupt_<unix_ms>`,
  start a fresh save and show "Save data was damaged and has been reset." on Home.
- `version` mismatch: run migration functions in order (v1 → v2 → …). An unknown future version means it is treated as corrupt.
- IDs in the save that no longer exist in the data are ignored on load (they are not deleted, so a later data fix restores them).
- AC-13.1: Win stage_001, close the app, reopen: stage_001 shows cleared and Jade includes the reward.
- AC-13.2: Writing garbage to `game_save` leads to a fresh save plus a backup key, with no crash.

---

## 14. Mobile UX and layout — READY

- **Portrait only.** Logical resolution 360×640 (the minimum). Phaser scale mode FIT. On taller screens the extra
  height goes to the arena. Respect the safe-area insets.
- **Touch targets ≥44×44 px** (logical), with at least 8 px between targets.
- **One-handed:** every frequent control is in the lower 60% of the screen. Only Pause (rare) is at the top.
- Min text size 12 px; numbers on cards 16 px. Never use color alone (types and card types have shapes).
- 60 fps target, 30 fps minimum on mid-range Android. The logic is fixed at 60 Hz whatever the fps.
- Haptics (setting, default on): 20 ms on taking a hit, 40 ms on Perfect Slip, 80 ms on Ignition/Tri-Burst.

**Battle layout (360×640 logical, y from the top)**

| y | Zone | Contents |
|---|---|---|
| 0–44 | Top bar | Enemy HP bar + name + aura icon, enemy bench pips, enemy Burst pips, timer (center), Pause 44×44 (right) |
| 44–330 | Arena | Fighters, effects, damage numbers, combo counter, callouts. Swipes accepted |
| 330–392 | Status | Player HP bar + Ignition timer; 2 bench portraits 52×52 (left, radial cooldown); IGNITE 56×56; TRI-BURST 64×64 (right) |
| 392–412 | Vigor bar | 10 segments + number |
| 412–532 | Hand | 4 cards, 80×112 each, 8 px gaps, 8 px side margins (4×80 + 3×8 + 2×8 = 360) |
| 532–640 | Swipe pad | Empty zone with faint arrow hints, where the thumb rests; swipes accepted |

**Other screens:** primary buttons are full width minus 32 px, height 56, in the lower half.

- AC-14.1: At 360×640 nothing is clipped. Every interactive element measures ≥44×44 (Playwright bounding-box check).
- AC-14.2: At 360×800, the layout fills the screen with no stretched sprites (the arena gets taller).

---

## 15. Data files, schemas, ID conventions — READY

### 15.1 Files
Every data file is a JSON object with an integer `version` (≥1) at the top level, plus one or more collections.

| Data file | Schema | Top-level collections | Owner of content |
|---|---|---|---|
| `data/characters.json` | `data/schemas/characters.schema.json` | `characters[]` | content-designer |
| `data/cards.json` | `data/schemas/cards.schema.json` | `cards[]` | content-designer |
| `data/enemies.json` | `data/schemas/enemies.schema.json` | `enemies[]` | content-designer |
| `data/stages.json` | `data/schemas/stages.schema.json` | `chapters[]`, `stages[]` | content-designer |
| `data/story.json` | `data/schemas/story.schema.json` | `scenes[]` | content-designer |
| `data/banners.json` | `data/schemas/banners.schema.json` | `banners[]` | content-designer (economy-designer tunes later) |
| `data/economy.json` | `data/schemas/economy.schema.json` | `currencies[]`, `starting`, `duplicates`, `power_formula` | content-designer (economy-designer tunes later) |
| `data/battle.json` | `data/schemas/battle.schema.json` | rule constants, `type_chart`, `ai_tiers` | content-designer copies the defaults from §5 (balance-analyst tunes later) |
| (runtime) local storage `game_save` | `data/schemas/save.schema.json` | — | gameplay code |

There is no `items` file in this milestone (no items in scope). It will be added when items are designed.

### 15.2 ID conventions (stable strings, never array positions; lowercase ASCII)

| Thing | Pattern | Example |
|---|---|---|
| Character | `char_<name>_<nnn>` | `char_kai_001` (variant: `char_kai_002`) |
| Card | `card_<owner>_<slug>` (owner = character short name or `common`) | `card_kai_ember_palm`, `card_common_jab` |
| Enemy | `enemy_<slug>_<nnn>` | `enemy_kai_rival_001` |
| Chapter | `chapter_<nn>` | `chapter_01` |
| Stage | `stage_<nnn>` | `stage_001` |
| Mission | `mission_<stage nnn>_<letter>` | `mission_001_a` |
| Story scene | `scene_<slug>` | `scene_001_pre` |
| Banner | `banner_<slug>_<nnn>` | `banner_starter_001` |
| Currency | `cur_<slug>` | `cur_jade` |
| Asset key | `<prefix>_<slug>`, prefix ∈ `por` portrait, `spr` sprite, `bg`, `bgm`, `sfx`, `vfx`, `ico` icon, `art` | `spr_kai_base` |

Once shipped, an ID is never renamed or reused. Asset keys may point to missing files in the prototype. The
renderer shows a labeled placeholder, never a crash.

### 15.3 Cross-file validation (JSON Schema cannot express these; gameplay-programmer writes `npm run validate-data`, QA runs it)
1. All IDs are unique within their collection.
2. Every referenced ID exists: deck/ignition deck card ids, enemy `character_id`, stage `enemy_team`, `unlock_requires`,
   `chapter_id`, story scene ids, banner `pool`/`featured`, economy `starting.characters`, reward `character_id`/`currency_id`,
   story `speaker` character ids.
3. Deck rules: total count 6–10, at most 1 Climax card in total, at most 3 per card. A card's `owner` is the deck's owner
   or `common`.
4. Banner: `rates_bp` sums to 10,000. For each rarity, Σ featured share_bp ≤ 10,000; if no non-featured pool
   fighters exist for a rarity with a rate > 0, featured shares for it sum to exactly 10,000. Each rarity with a rate > 0
   has ≥1 pool fighter of that rarity. Pool and featured characters are `playable: true`. Featured ⊆ pool.
5. `type_chart` has all 25 pairs.
6. Starting team: 3 distinct families, all in `starting.characters`.
7. Text contains none of the banned terms (§3), case-insensitive whole words.

---

## 16. Open questions for the owner — DRAFT

1. **Title:** pick one of the 5 options in §1 (or ask for more).
2. **Difficulty feel:** is the stage_005 boss (master AI) the right peak for the milestone, or should the milestone be easier
   for a first playtest?
3. **Draw rule:** a timeout tie or a double KO is a Draw (no rewards). Is that okay, or should the player win ties?
4. **Left-handed mode** (mirror bench and Burst buttons): wanted for the milestone or later?
