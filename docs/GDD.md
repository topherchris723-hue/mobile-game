# Game Design Document — Milestone 1 (Battle + Summon)

Owner: game-designer. Round 1, updated round 2 (QA fix loop 1: rules marked "round 2") and round 3 (rules marked "round 3"). Source of truth for rules; `docs/GAME_BRIEF.md` overrides this file.

Status legend: `DRAFT` = still being decided, do not build. `READY` = fully specified, can be built.
`BUILT` = implemented and passed QA.

All numbers marked *(data)* live in a data file (see §15). Code must read them and never hardcode them.
The numbers in this document are the default values for that data.

---

## 0. Contents

1. Working title — READY (Jade Tempest; trademark check pending)
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
16. Open questions for the owner — READY (all decided round 3; the owner delegated them to the Producer)

---

## 1. Working title — READY (round 3)

**Working title: Jade Tempest.** Chosen in round 3 by the Producer (the owner delegated the decision, see
`docs/STATUS.md` → "Decisions made without the owner"). It ties into the game's only currency (Jade) and the
storm-of-power tone. Pitch: *A storm of martial artists fights for the Jade Throne in fast, card-powered real-time duels.*

- **Trademark check: PENDING.** compliance-checker must run a proper trademark/store-name check before any release.
  Until that check passes, "Jade Tempest" is a working title only (title screen, Home, docs), not a store name.
  If it fails, the Producer picks the next option below and only the title string changes (no rule depends on it).
- The title contains no §3 banned term and no "Spark"/"Sparks" (§3 name-only rule). A round-1 web search found no
  existing game with this name; that is not a trademark check.
- No title uses franchise words or echoes (no "Dragon", "Ball", "Z", "Legends", "Saiyan", "Piece", "Treasure",
  "Dokkan", "Rising"). ("Overpeak" was dropped in round 1 because a game with that name is already in development.)

| # | Title | Status | One-line pitch |
|---|---|---|---|
| 1 | **Jade Tempest** | **chosen** (trademark check pending) | A storm of martial artists fights for the Jade Throne in fast, card-powered real-time duels. |
| 2 | Meridian Burst | not chosen (fallback 1) | Channel your fighters' inner energy lines into tag-team combos and one three-fighter finishing blast. |
| 3 | Heavenbreak | not chosen | Train three fighters, ignite their hidden forms and hit so hard the sky cracks open. |
| 4 | Thunderclap Trio | not chosen | Three fighters, one hand of cards, and attacks loud enough to shake the arena. |
| 5 | Ironroar | not chosen | A roaring tournament of fist-fighters and energy-blasters where every comeback ends in a scream. |

- AC-1.1: The title screen shows exactly "Jade Tempest" (from the strings file, not hardcoded in a scene). A grep of
  `src/` and `data/` for the 4 not-chosen titles finds 0 player-visible uses.

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
Zenkai, Dragon Ball(s), Saiyan, Super Saiyan, Ascended, Kamehameha, Spirit Bomb, Solar Flare,
Dokkan, Awaken/Awakening, Haki, Devil Fruit, Captain Ability, Limit Break, Soul Boost, Chakra, Jutsu,
Rasengan, Bankai, Legends Limited, Legendary Finish, Hollow, Quirk, Stand (as a power name). QA should grep the data for these.
"Stand" and "Hollow" are ordinary English words. They are banned only as the name of a power, form,
creature type or mechanic (e.g. "her Stand", "Hollow form"), not in sentences like "stand your ground".

**Name-only banned terms (round 2 ruling).** `Spark` and `Sparks` (whole word, any case) are banned in every
**name** field of the data: any field called `name`, `name_override` or `epithet` in any data file (fighter names,
epithets, Ignition form names, card names, stage and chapter names, banner names, currency names), plus the game
title and any mechanic, rarity, currency or mode name. Reason: "Sparking" is a Dragon Ball Legends rarity and part of
a Dragon Ball game title, so a name built on "Spark" reads as an echo. In prose (story `text`, `description`, `bio`,
`shout`, `art_brief`) the word is an ordinary English word and is allowed with no warning (e.g. "little sparks").
"Sparking" stays banned everywhere (list above). The validator enforces this as §15.3 rule 9.
Content that must be renamed (content-designer, round 2): card `card_tavi_spark_jab` name "Spark Jab", and stage
`stage_001` name "Qualifier: First Spark". IDs and asset keys are not player-visible and are not names, so
`card_tavi_spark_jab`, `ico_card_tavi_spark_jab` and `vfx_tavi_spark_jab` keep their IDs (nothing has shipped, but
renaming them would only churn tests). The stage_001 description ("what a spark can do") and the story line
"little sparks" are prose and stay.

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
- **Tick numbering (round 2):** fight tick `f = 0` is the first unfrozen tick after "FIGHT!". `f` counts unfrozen
  fight ticks only (intro, hitstop, cinematics, KO animation and pause do not count). During tick `f`,
  `elapsed_ticks = f + 1` (the current tick counts). Every "battle time" rule uses `elapsed_ticks`: the
  `battle_time_s` Ignition trigger (§5.9), the timeout (§5.14), `time_under_s` missions and the result time.
- **Inputs during freezes (round 2):** inputs made during a **hitstop** are queued and applied, in the order they
  were made, in step 1 of the first unfrozen tick after it. Each is checked against the rules at that moment, as
  if it had just been made. Inputs made during a **cinematic** (Climax, Ignition, Tri-Burst), the **KO animation**,
  the **intro** or **pause** are dropped (they do nothing, ever).
- **Same-tick order between sides:** in step 1 the player's inputs are applied before the enemy's; AI decisions
  (step 2) come after both. So when both sides act on the same tick, the player's action happens first.
- **Counting convention for per-tick values (round 3).** This is the one place the convention is defined; every AC with
  a tick count follows it and names its first and last counted tick.
  - "Value **before**" an input applied on tick T = the value at the end of tick T − 1. "Value **after**" an event on
    tick T = the value at the end of tick T (after step 7).
  - Continuous per-tick changes (Vigor regen, Ignition regen bonus) happen in step 3 of **every** unfrozen tick,
    including the tick an input was applied on. So between an input applied on tick `t0` (step 1) and an event on tick
    `th` (step 5), regen runs on ticks `t0 … th` inclusive = `th − t0 + 1` ticks. First counted tick `t0`, last `th`.
  - A **state that lasts N ticks** and is set in step 5 of tick H (Hitstun `hitstun_s`, Knockdown getup) holds on
    ticks H … H + N − 1 and ends in step 3 of tick H + N (it is checked there, before movement and hits). Example:
    a hit with `hitstun_s` 0.6 (36 ticks) on tick H → the defender is in Hitstun at step 5 of ticks H+1 … H+35 and
    `Idle` from tick H+36. A card whose first hit lands on H+35 continues the chain; one landing on H+36 does not.
  - Windows and invulnerability that state their own tick ranges (Slip §5.6, Tri-Burst rush §5.10) use those ranges.
- AC-5.0.1: A Slip input made during a hitstop is applied on the first unfrozen tick after it (the `slip` event has
  that tick). A card tap made during an Ignition cinematic plays no card, before or after the cinematic.

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

**Tri-Burst lock (round 2, BUG-2-08):** while **any** Tri-Burst rush is in progress (from the tick it starts through
the tick it resolves, §5.10), **neither side may Ignite**, and the side that is not rushing may not start a Tri-Burst.
These inputs are rejected (`input_rejected`, reason `not_now`) and cost nothing; the IGNITE / TRI-BURST button shows
greyed during the rush and a tap shakes it. This overrides the "Ignite: yes" cells in the table. Slip and Tag stay
allowed (dodging the rush is the intended counter).

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
- **Approach, exact per-tick rule (round 2):** `step = approach_speed / 60` (default 2.5 units). The approach begins
  on the tap tick but first moves on the next tick. On each later tick, in step 4: if `distance − melee_range ≤ step / 2`
  the attacker has **arrived** (no move this tick); otherwise it moves `step` toward the defender and then checks the same
  condition again. On arrival its x is snapped so `distance = melee_range` exactly (if it was farther), and the windup
  starts on that tick. For a still defender: `approach_ticks = ceil((d − melee_range − step/2) / step)`, minimum 1.
  Example: d = 40 → ceil(26.75 / 2.5) = 11 ticks. d = 13 → 1 tick (no move, snap to 12).
- Knockback pushes the defender away by the card's `knockback` units (clamped at the wall).

**Edge cases**
- Defender against a wall: knockback is clamped to 0. Nothing else changes.
- The defender moves during an approach: the approach keeps going until in range or `arena.approach_timeout_s`
  (0.6 s = 36 ticks) after the tap. After a timeout the card whiffs (Vigor lost) and enters Recovery for its `recovery_s`.
  **This is a safety net only.** With the default data it can never fire: the attacker never has to travel more than
  `100 − 12 = 88` units (both fighters stay in [0, 100]), which takes at most 35 ticks; a defender's dash back only
  shortens that because it ends at the wall; a hit during an approach interrupts the card (or, on armor, causes no
  knockback). It exists so that future data (a slower `approach_speed`, a wider arena) cannot cause an endless approach.

**Acceptance**
- AC-5.1.1: From the start positions (distance 40), one forward dash leaves distance 20.
  Two dashes leave distance 8 (clamped), not 0.
- AC-5.1.2: Playing a Fist card at distance 40 puts its first hit 11 ticks + windup ticks after the tap.
- AC-5.1.3: No fighter's x is ever outside [0, 100].
- AC-5.1.4: A Fist tapped at distance 40 (still defender) starts its windup on tap tick + 11 with distance exactly 12.
  A Fist tapped at distance 13 starts its windup on tap tick + 1 with distance exactly 12.
- AC-5.1.5 (safety net, test data): in a test copy of battle.json with `approach_timeout_s` = 0.1 (6 ticks), a Fist
  tapped at distance 40 against a still defender whiffs on tap tick + 6 (distance 25 at that moment, `whiff` reason
  `approach_timeout`), enters Recovery and its Vigor is not refunded. With the default data, 1,000 seeded headless
  battles log 0 `approach_timeout` whiffs.

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
- **Hit during Active (round 2):** if a non-armored fighter is hit while its own card is `Active`, it enters Hitstun
  and its card ends. Hits of a `melee` or `beam` card that have not landed yet are lost. A `projectile` card's hits
  were all thrown when its windup ended, so they keep flying and resolve on schedule (first-hit rule above still
  decides them). An opponent's Ignition (§5.9) or landed Tri-Burst (§5.10) cancels projectiles in flight too.
- **Armor (round 2):** a fighter is **armored** during the approach, Windup and Active phases of an `armor: true` card
  (not its Recovery) and during its own Tri-Burst rush. An armored fighter that is hit takes the damage (Burst gains,
  hitstop and the attacker's `on: "hit"` effects apply as normal) but gets **no hitstun, no knockback and no
  interrupt**; its card continues. A hit on an armored fighter does not start or extend a chain (`chain_index` 1,
  `combo_mult` 1.00, and no chain is open afterwards). Armor does **not** protect against a landed Tri-Burst or an
  Ignition push/cancel.
- **Trade:** if both fighters land hits on the same tick, both take damage and both enter hitstun.
- **Hitstop:** on each landed hit, a global freeze of `battle.hitstop_s[type]` *(data: fist 0.04,
  bolt 0.03, signature 0.06, climax 0)* happens, for game feel.
- **Climax cinematic:** if a Climax's first hit lands, a cinematic of `cinematic_s` plays (a global
  freeze). If it whiffs, there is no cinematic. **Round 2:** all of a Climax's hits are computed and applied on its
  first-hit tick (step 5, before the cinematic starts), with one crit roll for the card; the renderer then shows the
  damage numbers spread over the cinematic, `hit_interval_s` apart. The defender gets the full `knockback` and enters
  Hitstun for `hitstun_s`, which starts counting after the cinematic (freezes stop timers).

**Acceptance**
- AC-5.5.1: A 3-hit card whose first hit is dodged deals 0 damage on all 3 hits.
- AC-5.5.2: A non-armor Signature hit during its windup is cancelled and the Vigor is not refunded.
- AC-5.5.3: A Climax hit during its windup is not cancelled: the attacker takes the damage, stays in Windup (not
  Hitstun), its x does not change (no knockback) and its first hit lands on the originally scheduled tick.
- AC-5.5.4: Two attacks landing on the same tick both deal damage.
- AC-5.5.5: A multi-hit projectile Bolt whose thrower is hit after the windup ends but before the first hit lands:
  every hit still resolves on its scheduled tick. A 2-hit melee Fist whose attacker is hit (by a projectile in flight)
  after its first hit landed and before its second: only the first hit's damage is dealt.
- AC-5.5.6: When a Climax's first hit lands, the defender's HP drops by the sum of all its hits on that tick, HP does
  not change during the cinematic, and the defender stays in Hitstun for exactly 60 unfrozen ticks after the first-hit tick.

### 5.6 Slip (dodge), Perfect Slip and Riposte (counter)
**Purpose:** the skill hook. Reading a wind-up and dodging late feels great and pays off with a free counter.

**Rules** *(data `battle.slip`, `battle.riposte`)*
- **Slip:** swipe up or down. Cost 2 Vigor. The fighter is invulnerable for `iframes_s = 0.35`, then has
  `recovery_s = 0.15` of SlipRecovery (vulnerable, cannot act except Riposte).
- **Perfect Slip:** a hit that would have landed at tick `th` is dodged during a Slip that started at tick `t0`,
  and `th − t0 ≤ perfect_window_s (0.15 s = 9 ticks)`. Reward: 2 Vigor refunded, +5 Burst Gauge, the text
  "PERFECT SLIP!", and a Riposte window.
- A normal dodge (`th − t0` from 10 to 21 ticks) avoids the damage with no other reward.
- **Exact tick windows (round 2):** with `t0` = the tick the Slip input is applied, the fighter is invulnerable for
  hits with `0 ≤ th − t0 ≤ round(iframes_s × 60)` = 21 (22 ticks, `Slipping`). Perfect: `0 ≤ th − t0 ≤ 9`. It is in
  `SlipRecovery` (vulnerable) for `th − t0` from 22 to 30 (`round(recovery_s × 60)` = 9 ticks) and `Idle` from 31.
  A Slip applied on the same tick as the hit (`th − t0 = 0`) is Perfect, because inputs come before hits (§5.0).
- **Riposte window:** `window_s = 0.8` from the Perfect Slip. The next Fist, Bolt or Signature card
  tapped in the window is a **Riposte**: cost 0, approach and windup skipped (the attacker appears at
  melee range or fires from where it is), first hit after 0.1 s, damage ×1.25 *(data)*. Climax cards
  cannot be Riposte cards. **Placement (round 2):** a `melee` Riposte puts the attacker at `distance = melee_range`
  on the tap tick (if it was farther); a `projectile` or `beam` Riposte fires from where the attacker stands, and its
  first hit lands 0.1 s (6 ticks) after the tap at any distance (no travel time). The enemy whose attack was slipped is still in Recovery from that whiffed
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
- AC-5.6.1 (round 3, example corrected): Slip applied on tick `t0`, hit scheduled on `th = t0 + 6`, no other Vigor
  change, no freezes, regen 1.0/s (`battle.vigor.regen_per_s`), Vigor before = 5.0 (end of tick t0 − 1): no damage, a
  Riposte window opens on `th`, and the Slip's net Vigor effect is 0. Vigor after (end of tick `th`, §5.0 counting
  convention) = 5.0 − 2 (step 1 of t0) + 2 (Perfect refund, step 5 of th) + regen on ticks t0 … t0+6 (first counted t0,
  last counted th; 7 ticks × 1/60) = 5 + 7/60 = **5.1167** (exactly 5.11666…; test with tolerance 1e-6).
- AC-5.6.2 (round 3, example corrected): same setup with `th = t0 + 15`: no damage, no Riposte window, and Vigor after
  (end of tick th) = 5.0 − 2 + regen on ticks t0 … t0+15 (first counted t0, last counted th; 16 ticks × 1/60)
  = 3 + 16/60 = **3.2667** (exactly 3.26666…; tolerance 1e-6).
- AC-5.6.3: A Slip started 25 ticks before a hit: the hit lands (outside the 21-tick i-frames).
- AC-5.6.4: A Riposte Fist with power 1.2 deals exactly 1.25× the damage of the same Fist without Riposte
  (same seed, no crit) and costs 0.
- AC-5.6.5: A Break Slip in hitstun with Vigor 3.9 fails. With 4.0 it succeeds and leaves 0.0.
- AC-5.6.6: Boundaries, with `th − t0` = 0 → Perfect; 9 → Perfect; 10 → normal dodge; 21 → normal dodge; 22 → the hit lands.
- AC-5.6.7: A melee Riposte tapped at distance 30 puts the attacker at distance 12 on the tap tick and its first hit
  lands on tap tick + 6. A projectile Bolt Riposte tapped at distance 30 leaves the distance at 30 and its first hit
  also lands on tap tick + 6.

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
- **`chain_index`, exact (round 3 ruling).** A chain belongs to the attacking **team** (not the fighter), so it carries
  across a Tag. Each team has `chain_open` (bool, false at battle start) and `chain_cards` (int, 0 at battle start).
  `chain_index` is **1-based** and is decided once per card (or Tag Strike), on the tick its first hit lands, from the
  state at the start of step 5:
  - if `chain_open` and the defender is in `Hitstun` and the defender is not armored → `chain_index = chain_cards + 1`;
  - otherwise → `chain_index = 1` (a new chain opens; on an armored defender no chain opens, §5.5).
  - Then `chain_cards = chain_index` and `chain_open = true` (except on an armored defender).
  - **Reset** (`chain_open = false`, `chain_cards = 0`) when: the defender is not in Hitstun at step 3 of a tick (left
    hitstun), Knockdown (incl. the chain cap), the defender's Break Slip or Tag Escape, the defender's KO, the
    **attacker's own Ignition** (step 1 of §5.9; the defender may stay in Hitstun), the defender's Ignition from Hitstun,
    or a landed Tri-Burst (both sides). A whiffed card does not reset an open chain by itself (the chain usually ends
    because hitstun runs out).
  - Because the enemy can only be in Hitstun after a landed player hit, a **Tag Strike normally has `chain_index` ≥ 2**.
    It has `chain_index` 1 only when the enemy is still in Hitstun but the player's chain was already reset — in practice
    when the player's outgoing fighter Ignited while the enemy was in Hitstun (the Ignition resets the chain, the
    cinematic freeze keeps the enemy's hitstun) and then tagged out.
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
- **Initial cooldown:** when "FIGHT!" appears, each team's Tag cooldown starts at `initial_cooldown_s = 5`
  *(data `battle.tag.initial_cooldown_s`; optional field, default 5 if absent)*. This stops an instant swap
  before the player has seen slot 1 fight, and it means the tutorial `tag_ready` trigger fires 5 s into the fight.
  The intro does not count toward this time. `tag_ready` means: the cooldown is 0, the active fighter is in a state
  that allows Tag, and at least one living bench fighter exists.
- Tag swaps instantly. The incoming fighter appears at the outgoing fighter's x, in `Idle`, with
  `invuln_s = 0.5`.
- **Tag Escape:** a Tag while in hitstun. Cost 3 Vigor, plus the normal cooldown. It ends the enemy's chain.
- **Tag Strike:** if the enemy is in Hitstun on the tag-in tick, the incoming fighter auto-performs a
  free melee hit: power `tag_strike_power = 0.8`, 1 hit, hitstun 0.6 s, knockback 4, no windup (first hit
  after 0.1 s). It counts as a card in the chain. **Round 2:** on the tag-in tick the incoming fighter is placed at
  `distance = melee_range` (if farther). The Tag Strike cannot crit and has **0 recovery**: the fighter is `Idle` on
  the tick after its hit resolves (landed or whiffed) and can play a card at once; that card continues the chain if
  its first hit lands while the enemy is still in Hitstun.
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
- AC-5.8.0: With the default data, Tag is impossible for exactly the first 300 unfrozen ticks after "FIGHT!"
  and possible on fight tick f = 300 (§5.0 numbering). With `initial_cooldown_s` removed from battle.json, the result is the same (default 5).
- AC-5.8.1: After a Tag, a second Tag is impossible for exactly 480 ticks.
- AC-5.8.2: A Tag Escape with Vigor 2.5 fails. With 3.0 it succeeds and the enemy's chain counter resets.
- AC-5.8.3: When slot 1 is KO'd while slot 2 is alive, slot 2 comes in automatically and Tag is immediately available.
- AC-5.8.4: A tag-in during the enemy's hitstun produces one Tag Strike hit.
- AC-5.8.5 (round 3 rewrite; §5.7 `chain_index` ruling, §5.0 counting convention). Default data; test AI idle; the
  player's Tag cooldown is 0 and Vigor ≥ 2; no wall within 4 units behind the enemy; the enemy's remaining hitstun at
  the tag tick is ≥ 7 ticks (so it is still in Hitstun at the Tag Strike's hit).
  - **(a) Normal case — Tag Strike continues the chain.** A player card C1 has landed (`chain_index` 1; chain open,
    `chain_cards` 1) and the enemy is in Hitstun. On tag tick T the player taps a bench portrait at distance 30. Then:
    the incoming fighter is at distance 12 on T; the Tag Strike hit lands on T + 6 with `chain_index` **2**
    (`combo_mult` 1.05) and leaves the distance at 16 (knockback 4); the enemy is in Hitstun on T+6 … T+41 (36 ticks)
    and `Idle` from T+42. A Fist tapped on T + 7 is accepted (fighter `Idle`, Vigor ≥ 2); it approaches 2 ticks
    (`ceil((16 − 12 − 1.25) / 2.5)` = 2), so its windup starts on T + 9 and its first hit lands on T + 9 +
    `round(windup_s × 60)` — for every default Fist (windup 0.10–0.20 s = 6–12 ticks) that is T + 15 … T + 21,
    inside T+6 … T+41 — with `chain_index` **3** (`combo_mult` 1.10).
  - **(b) Tag Strike opens the chain.** Same as (a), but on the tick after C1's last hit the player taps IGNITE (allowed
    in the link window), so the player's chain resets (`chain_cards` 0) while the enemy stays in Hitstun through the
    90-tick cinematic freeze (the Ignition push moves the enemy 20 units; the tag snap still puts the incoming fighter at
    distance 12). With the Ignite applied on unfrozen tick I, the first unfrozen tick after the cinematic is I + 1; the
    player tags on T = I + 1: the Tag Strike lands on T + 6 with `chain_index` **1** (`combo_mult` 1.00), the Ignition
    ends (tag-out), and the Fist tapped on T + 7 lands on T + 15 … T + 21 with `chain_index` **2** (`combo_mult` 1.05).
    Reachable with default data: needs a player fighter with Ignition available (e.g. `char_tavi_001` from fight tick
    3,599) and C1's hitstun to still hold on T + 6 = I + 7: with C1's (last) hit on tick H and N hitstun ticks,
    H + N − 1 ≥ I + 7. Igniting on I = H + 1 needs N ≥ 9; every default Fist has N ≥ 33. The "no wall" precondition
    here means the enemy's x before the Ignition push is ≤ 76 (76 + 20 + 4 = 100), so the distance after the strike is 16.
  - Must-FAIL inputs for a test: in (a), an implementation that gives the Fist `chain_index` 2 (Tag Strike not counted)
    fails; in (b), one that gives the Tag Strike `chain_index` 2 (chain not reset by Ignition) fails.

### 5.9 Ignition (transformation) — the big moment
**Purpose:** a comeback-and-hype moment the owner explicitly asked for. It changes your look,
stats and cards for a short power spike.

**Rules** (per fighter in `characters.json` → `ignition`; fighters without an `ignition` block cannot use it)
- **Trigger:** the IGNITE button (56×56 px) appears when **any** of the fighter's triggers is met:
  - `hp_below_pct` (value 1–99): current HP ≤ value% of max.
  - `battle_time_s`: at least this many seconds of battle timer have elapsed, i.e. `elapsed_ticks ≥ round(value × 60)`
    (§5.0), checked in step 3. For value 60 it is met on fight tick f = 3,599, and IGNITE input is accepted from f = 3,600.
  - `cards_played`: this fighter has played at least this many cards this battle.
  - `ally_ko`: at least this many teammates have been KO'd.
  Once available, it stays available until used. **Once per fighter per battle.** It can only be used
  while that fighter is active. Benched fighters' triggers are still checked.
- **Activation:** allowed in the states in the §5.0 table (including Hitstun, which makes it a combo breaker).
  1. The fighter's current card is cancelled (no refund). Its chain ends.
  2. A global freeze cinematic of `battle.ignition.cinematic_s = 1.5` plays, with the shout text and the form name.
  3. Effects: heal `heal_pct` of max HP; +3 Vigor; the enemy is pushed 20 units and its current card
     cancelled, along with its projectiles in flight (this ignores i-frames and armor and deals no damage); the deck
     is swapped to `ignition.deck`, the hand redrawn to 4.
  - **Not allowed while any Tri-Burst rush is in progress** (either side's), see the Tri-Burst lock in §5.0.
  4. For `duration_s` (excluding freezes): ATK × `stat_mult.atk`, DEF × `stat_mult.def`, Vigor regen
     + `vigor_regen_bonus` per second.
- **End:** when the duration runs out, on tag-out or on KO. Stats and deck revert, and the hand is redrawn to 4 from the base deck.
- **Deck reset, exact (round 2):** at Ignition start and at Ignition end (not on KO), the fighter's hand, draw pile,
  discard pile and pending refill timers are all cleared; the **full** new deck (Ignition deck at start, base deck at
  end) is shuffled with the seeded RNG and 4 cards are drawn. The base deck's draw/discard state from before Ignition
  is not remembered.
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
- AC-5.9.5: When `char_tavi_001`'s Ignition ends by duration, its hand holds 4 base-deck cards, its discard pile is
  empty and its draw pile holds 4 cards (base deck 8 − 4), whatever its piles held before Ignition.
- AC-5.9.6: `char_tavi_001` (trigger `battle_time_s: 60`) taking no damage and playing fewer cards than any card
  trigger: `ignition_ready` fires on fight tick 3,599 and not earlier; an IGNITE input on f = 3,600 is accepted.
- AC-5.9.7 (BUG-2-08): An enemy with IGNITE available taps IGNITE on every tick of the player's Tri-Burst rush
  (rush start tick T through T + 18): every one is rejected with reason `not_now`, the rush resolves on T + 18, and the
  enemy's Ignition is still unused and available afterwards (usable again once its state allows, e.g. after getup).

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
- **The rush cannot be cancelled (round 2, BUG-2-08).** The gauge is set to 0 when the rush starts. The rush
  starts on tick T and resolves in step 5 of tick T + `round(rush_time_s × 60)` (default T + 18). Nothing can cancel it:
  neither side may Ignite during it, and the opponent may not start its own Tri-Burst during it (§5.0 Tri-Burst lock).
  If both teams tap TRI-BURST on the same tick, the player's starts (§5.0 order) and the enemy's is rejected with its
  gauge unchanged. Safety net: if a rush ever ends without landing or whiffing, it counts as a whiff (gauge refunded
  `whiff_refund_pct`, not marked used).
- **After a whiff (round 2):** the attacker is `Idle` on the resolve tick at the x it had when the rush started.
- **After a landing (round 2):** the attacker is placed at `distance = melee_range` (if farther) and is `Idle` after
  the cinematic. The target's current card (armored or not, Vigor not refunded) and its projectiles in flight are
  cancelled, any chain on either side ends, and unless the hits KO it the target is knocked into `Knockdown`
  (pushed `combo.knockdown_distance` = 25 units, clamped at the wall, then `combo.getup_s` = 0.6 s of getup,
  invulnerable). Armor never prevents this: the Tri-Burst is the one attack that always connects in full.
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
- AC-5.10.4: A whiffed Tri-Burst leaves the gauge at 50, the attacker `Idle` on the resolve tick at its rush-start x.
- AC-5.10.5: A Tri-Burst that lands on a target in the Windup of an armored Climax: the Climax is cancelled (no Vigor
  refund, no Climax hit ever lands), and after the 4.0 s cinematic the target is in Knockdown, 25 units farther away
  (or at the wall), and cannot be hit for 36 unfrozen ticks.
- AC-5.10.6: Both teams at 100 Burst tap TRI-BURST on the same tick: only the player's rush starts; the enemy's input is
  rejected (`not_now`) and its gauge stays 100.
- AC-5.10.7 (BUG-2-08): In 1,000 seeded headless battles with master-tier AI on both sides, every `tri_burst_start`
  is followed by exactly one `tri_burst` or `tri_burst_whiff` 18 unfrozen ticks later, and 0 `card_cancelled` events
  with reason `ignition` target a Tri-Burst.

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
- AC-5.11.2: Fixed inputs ATK_eff 300, power 0.01, hits 1, type_mult 1.0, crit_mult 1.0, combo_mult 1.0,
  riposte_mult 1.0, DEF_eff 3,000 (def_factor 0.25): raw = 300 × 0.01 × 0.25 = 0.75 → floor 0 → clamped to **1**, never 0.
  (At ATK 1,000 the same inputs give 2.5 → 2, which does not test the minimum.)
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
- The timer is `stage.timer_s` (default 180). It counts down in unfrozen ticks and is shown as `ceil(seconds)`,
  where `seconds = (timer_s × 60 − elapsed_ticks) / 60` (§5.0). Timeout is checked in step 7 of the tick where
  `elapsed_ticks = timer_s × 60`, i.e. fight tick f = 10,799 for 180 s (after exactly 10,800 unfrozen ticks).
- **Win:** all enemy fighters KO'd. **Lose:** all player fighters KO'd.
- **Timeout:** compare `team_hp_ratio = Σ current HP / Σ max HP` over all 3 fighters (KO'd = 0). Higher
  wins. An exact tie = **Draw**.
- Both teams wiped on the same tick = **Draw**.
- A Draw counts as not cleared (no rewards, no missions). The result screen offers Retry.
- **Pause:** the pause button (top-right, 44×44) freezes everything. The menu has Resume and Retreat
  (Retreat = loss, confirmed with a dialog). The app going to the background pauses the battle automatically.
- Expected length: Stage 3+ battles 120–200 s of timer plus about 20–40 s of cinematics, which is 2.5–4 min.
- **Battle length target, measurable (round 3).** BAL-5.14: in the balance-analyst's seeded headless sims of
  stage_003–stage_005 (its reference player bot vs the stage AI), the **median `elapsed_ticks / 60` of battles that end
  by KO** is 120–200 s, and ≤ 25% of battles end by timeout. This is a **balance target**, not a QA blocker: the
  balance-analyst owns and reports it. Round-2 sims measured a mean of about 56 s, so the target is not met yet.
  Design note for the balance-analyst (no formula changed): with the §5.3/§5.11 formulas, sustained damage from Vigor
  alone is about `regen_per_s × ATK × (power / cost) × def_factor` per second (default Fist: 1.0 × 900 × 0.575 × 0.69 ≈
  360/s), so a ★3 HP of 8,500 falls in about 24 s before Ripostes, Climaxes and Tri-Burst. The intended levers are data:
  HP bands (§6, the balance-analyst may move them), enemy `stat_mult`, and `battle.vigor.regen_per_s`. If the target can
  only be met by changing a formula, report it to the game-designer instead of changing code.

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
- The first think is on fight tick f = 0. After each think, the next one is `max(1, round(think_interval_s × 60 ×
  (1 + think_jitter × (2r − 1))))` ticks later, `r` a seeded roll in [0, 1).
- Every `think_interval_s` (±20% seeded jitter), when able to act, it goes down this list and does the first that applies.
  A rule whose roll fails does not end the think: the AI goes on to the next rule (e.g. a failed `aggression` roll in
  rule 6 falls through to rule 7, Move). Rule 2 and 3 are skipped while the Tri-Burst lock (§5.0) applies.
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
  **Round 2, exact:** the offsets come from the slip data: perfect offset `floor(perfect_ticks × 2 / 3)` = floor(9 × 2/3)
  = 6; normal offset `floor((perfect_ticks + iframe_ticks) / 2)` = floor((9 + 21) / 2) = 15, where
  `perfect_ticks = round(perfect_window_s × 60)` and `iframe_ticks = round(iframes_s × 60)`. If the roll was **not**
  perfect and the earliest possible Slip tick (now, or the planned tick if later) would be ≤ `perfect_ticks` before the
  hit, the AI does **not** slip (a failed perfect roll must never produce a Perfect Slip).
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
- AC-5.15.5: In the AI slip log over 1,000 seeded battles, every planned perfect-roll Slip starts 6 ticks before the hit
  (or at its decision tick, if that is later), every normal-roll Slip starts 15 ticks before (or later, but never
  ≤ 9 ticks before), and no normal-roll Slip produces a `perfect_slip` event.
- AC-5.15.6: The AI's first think happens on fight tick f = 0 (an AI-controlled side with an affordable card and
  `aggression` 1.0 and `vigor_reserve` 0 in test data, Vigor 5 and a cost-2 Fist in hand, emits `card_played` on f = 0).

---

## 6. Characters (fighters) — READY

A fighter is defined entirely in `data/characters.json` (schema `characters.schema.json`).

**Fields:** `id`, `family` (the same person across variants; a team cannot hold 2 of the same family),
`name` (≤16 chars), `epithet` (≤32), `rarity` (3/4/5 stars), `aura` (type), optional `role`, optional
`art_brief` (≤300 chars), `playable` (false = enemy-only, never in banners), `base_stats` {hp, atk, def,
crit_rate}, `deck`, optional `ignition`, `art` keys, `shouts`, `bio` (≤200 chars).

**Roles** (optional `role`; a label shown on the fighter card and in Team Select; **no rule effect** in this
milestone). Each role sets what the fighter's deck should emphasise:

| role | Deck emphasis |
|---|---|
| `striker` | Fist-heavy, fast windups, chain starters |
| `blaster` | Bolt/beam-heavy, good from long range |
| `guardian` | def_up/heal effects, higher DEF within the band |
| `trickster` | debuffs, vigor_gain, multi-hit cards that are strong for Riposte |

**Art brief** (optional `art_brief`): a plain-language visual description for the art-director (silhouette, palette,
outfit, Ignition look). It must be original and name no franchise or existing character. It is not shown in-game.

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
- Triggers: `battle_start`, `enemy_windup`, `perfect_slip` (the player just made a Perfect Slip, so a Riposte
  window is open), `card_playable`, `vigor_full`, `chain_possible`, `tag_ready` (§5.8), `ignition_ready`, `burst_ready`.
- Required actions: `play_card`, `slip`, `riposte` (play a card as a Riposte), `dash_forward`, `dash_back`, `tag`,
  `ignite`, `tri_burst`, `none`.
- A `perfect_slip` step pauses the Riposte window timer for as long as the prompt is shown, so the player cannot
  miss the window while reading. The step completes when a Riposte is played. If the player makes no Perfect Slip,
  the step never fires and does not block the tutorial.
- When a step triggers, the game runs at 0.3× speed (logic ticks scaled) with the prompt and a pointing hand
  until the required action is done (or for 3 s if `none`). Each step fires once per battle. The steps run only
  on the first clear attempt until `tutorial.completed` is set in the save (set on the first win of stage_001).

**Round 3 ruling — prompt exits and triggers (adopts the ui-developer's round-2 fix for BUG-2-01/02, now data-driven).**
- **Shown time.** Prompt durations are measured in **shown time**: real (wall-clock) time while the prompt is on screen
  and the battle is **not paused** (pause menu open or app in the background do not count). Cinematics and hitstop during
  a prompt do count. One rendered frame adds at most 100 ms of shown time (a long frame or a resumed tab cannot skip a
  prompt). Shown time starts at 0 when the step fires.
- **Exits.** An active step ends at the first of:
  1. its `required_action` is done by the player (§9.4 action list; `riposte` = a card played as a Riposte);
  2. `required_action` is `none` and shown time ≥ `battle.tutorial_none_s` (*data*, default 3.0);
  3. its `required_action` has become **impossible** (table below), checked every rendered frame;
  4. shown time ≥ `battle.tutorial_prompt_max_s` (*data*, default **20**) — the **cap**, a last-resort exit;
  5. the battle ends (Win/Lose/Draw/Retreat).
  On every exit the speed returns to 1.0× on the next logic tick, the prompt and hand disappear, and a held Riposte
  window (from a `perfect_slip` step) is released and resumes counting down from where it was held. An ended step never
  fires again in that battle, whatever the exit.

| required_action | Becomes impossible when (player side) |
|---|---|
| `riposte` | the Riposte window is closed, or the player tags, or the player's active fighter is KO'd |
| `ignite` | the player's active fighter has no Ignition that is available and unused (tagged out, KO'd, used, or none) |
| `tri_burst` | the player's Tri-Burst is used, or the gauge is < 100 |
| `tag` | the player has no living benched fighter |
| `play_card`, `slip`, `dash_forward`, `dash_back` | never (only the cap or battle end can end them early) |
| `none` | not applicable (ends by time, exit 2) |

- **Triggers fire only for the player's active fighter.** Event triggers: `perfect_slip` and `chain_possible` fire only for
  a player-side event whose fighter slot is the player's active slot at that moment; `enemy_windup` fires only for the
  enemy's active fighter's windup; `battle_start` fires on "FIGHT!". State triggers are evaluated for the player's active
  fighter / team: `ignition_ready` = the player's active fighter's IGNITE can be tapped now (a benched fighter's unlocked
  Ignition does not fire it; it fires once that fighter is active); `burst_ready` = TRI-BURST can be tapped now (gauge 100,
  not used, no Tri-Burst lock); `tag_ready` per §5.8; `card_playable`, `vigor_full` for the player's active hand / team Vigor.
- **One prompt at a time.** While a step is active no other step fires. An event trigger that happens while a step is
  active is not queued (the step can still fire on a later matching event). State triggers are checked every rendered
  frame while no step is active and the battle is in the fight phase and not frozen. If several steps could fire on the
  same frame, the one with the lowest index in `tutorial_steps[]` fires.
- Worked numbers (default data): the cap is 20 s of shown time; at 0.3× slow-mo that is 20 × 60 × 0.3 = **360 logic
  ticks**. A `none` step lasts 3 s shown = 54 logic ticks at 0.3×.
- AC-9.4.1: On a fresh save, Stage 1 shows the "Swipe UP to Slip" step at the first enemy windup and resumes
  normal speed right after a Slip.
- AC-9.4.2: After a Perfect Slip in Stage 1 on a fresh save, the `perfect_slip` prompt appears, the Riposte window
  is still open after 2 s of prompt, and tapping a card plays a 0-cost Riposte and closes the prompt.
- AC-9.4.3 (cap): Stage 1, fresh save. When the `tag_ready` step fires (fight tick 300 at the earliest, AC-5.8.0) and the
  player never tags, the prompt closes after 20.0 s of shown time (± one frame, ≤ 100 ms), the speed returns to 1.0×
  and the step never fires again in that battle. With a 10 s pause in the middle, it closes after 30 s of wall-clock time
  (20 s shown). With `tutorial_prompt_max_s` removed from battle.json the result is the same (default 20). Must-FAIL: an
  implementation with no cap still shows the prompt at 21 s.
- AC-9.4.4 (impossible action): during the `perfect_slip` (Riposte) prompt, the player waits until its fighter is `Idle`
  and taps a bench portrait (Tag ready): the Tag happens, the prompt closes on that tick, the Riposte-window hold is
  released, and the speed is 1.0× on the next logic tick. Same for the player's active fighter being KO'd during that
  prompt. Must-FAIL: a prompt still shown 1 s after the Tag.
- AC-9.4.5 (active fighter only): Stage 1, fresh save, with `char_tavi_001` (Ignition trigger `battle_time_s: 60`) tagged
  out before fight tick 3,599: no `ignition_ready` prompt appears while it is benched (its Ignition unlocks on f = 3,599).
  When it is tagged back in, the prompt appears on the first frame where it is active and not frozen. Reachable with
  default data (Tag cooldown 8 s).
- AC-9.4.6 (event side, unit test on the tutorial controller): with `chain_possible` and `perfect_slip` steps unfired, the
  events `{type: link_open, side: enemy}` and `{type: perfect_slip, side: enemy}` fire **no** step (must-FAIL inputs);
  `{type: link_open, side: player, slot: <active slot>}` fires `chain_possible` (must-PASS); the same event with a benched
  slot fires nothing.
- AC-9.4.7 (`none` step): the `vigor_full` step ("Cards cost Vigor…", `none`) closes after 3.0 s of shown time (± one frame).

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

**Purpose:** collecting fighters is the long-term goal. Rolls must feel exciting, be honest (rates shown, pity
visible) and be impossible to exploit by quitting. Round 3: this section was re-read as the builders will read it and
completed with exact rules (marked "round 3"). Logic lives in `src/logic/` (pure, no rendering); the screen in
`src/scenes/` + `src/ui/`.

**Default data used in the examples** (`data/banners.json`, `data/economy.json`, rarities from `data/characters.json`):
banner `banner_starter_001`, cost 100 / 1,000, `multi_count` 10, `rates_bp` {5: 300, 4: 1,700, 3: 8,000}, pity group
`standard`, `hard_pity` 40, `multi_min_rarity` 4, `first_multi_min_rarity` 5. Pool by rarity (in `pool[]` order):
★3 `char_tavi_001`, `char_lark_001`, `char_dunmore_001` (the 3 starters, owned on a fresh save); ★4 `char_pell_001`,
`char_thessa_001`, `char_rook_001`; ★5 `char_solenne_001`, `char_corvane_001` (both featured, `share_bp` 5,000 each).
Economy: start 1,000 Jade, `max_resonance` 4, overflow Jade ★3 10 / ★4 40 / ★5 200, Jade max 999,999.

### 11.1 Screen
- Banner art, name, featured fighters (portrait + rarity + aura).
- Jade balance. Buttons: **Summon ×1 (100 Jade)**, **Summon ×10 (1,000 Jade)** (amounts from `cost_single` / `cost_multi`).
  A button is disabled when `jade < cost`, with the text "Not enough Jade — clear stages to earn more."
- **Rates** button → a full rate table (per rarity and per fighter, 2 decimals, §11.2) and the rules text (pity, ×10
  guarantee, first ×10 guarantee, duplicates). **Pity counter** always visible: "★5 guaranteed within N summons."
  with `N = max(1, hard_pity − counter)` (§11.3). Fresh save: N = 40.
- **First ×10 line (round 3):** while `save.summon.first_multi_done[banner_id]` is not `true` and the banner has
  `first_multi_min_rarity`, the screen also shows "First ×10: at least one ★{first_multi_min_rarity} guaranteed!"
  (default "★5"). It is hidden once the first ×10 on that banner is done.
- **Confirm dialog** shows the cost and the balance after (e.g. "Summon ×10 for 1,000 Jade? Jade after: 0"), with Cancel
  and Confirm (≥44×44). **Round 3:** the Confirm button must not cover the screen position of the Summon button that
  opened the dialog, and the dialog ignores input for its first 250 ms (BUG-2-03 lesson), so a double tap can never
  confirm. While a summon is being processed or revealed, both Summon buttons are disabled (no second summon can start).
- Reveal animation (skippable: one tap skips to the results), shown in pull order (pull 1 first), then a results grid in
  pull order that tags each result **NEW**, **"Resonance +1"** (with the new rank, e.g. "R1") or **"+N Jade"**
  (N = the Jade actually credited, §11.4). An OK button returns to the Summon screen with the updated balance and pity.
- **Banner availability (round 3):** a banner is shown when (`start_at` is null or now ≥ `start_at`) and (`end_at` is null
  or now < `end_at`), using the device clock. If no banner is shown, the screen shows "No summons available right now."
  and no Summon buttons. The default banner has both null (always open).

### 11.2 Rates (integers in basis points; 10,000 bp = 100%)
- Default rates: ★5 300 bp (3.00%), ★4 1,700 bp (17.00%), ★3 8,000 bp (80.00%). They must sum to exactly 10,000.
- **Per-fighter rate inside a rarity:** featured fighters get `share_bp` of that rarity's rate. The remainder
  (`10000 − Σ featured share_bp`) is split equally across the non-featured pool fighters of that rarity.
  Example: ★5 = 300 bp, featured A share 5,000 → A = 1.50%. Non-featured ★5 B (the only other one) = 1.50%.
- The pool is explicit (`pool[]`). Only `playable: true` characters may appear in it.
- **Integer weights (round 3, exact; used both for rolling and for the rate table).** For rarity k: let `F_k` = the
  featured fighters of rarity k (in `featured[]` order), `P_k` = the non-featured pool fighters of rarity k (in `pool[]`
  order), `n = |P_k|`, `S = Σ share_bp over F_k`.
  - If `n > 0`: weight of a featured fighter = `share_bp × n`; weight of each non-featured fighter = `10000 − S`;
    total `W_k = 10000 × n`.
  - If `n = 0`: weight of a featured fighter = `share_bp`; total `W_k = S` (= 10,000 by §15.3 rule 4).
  - The candidate list `L_k` = `F_k` then `P_k` (that order). Fighters with weight 0 are never drawn and show 0.00%.
- **Displayed rates (round 3).** Rarity: `rates_bp[k] / 100` with exactly 2 decimals (300 → "3.00%"). Fighter j of
  rarity k: exact percent = `rates_bp[k] × weight_j / W_k / 100`, displayed rounded half-up to 2 decimals. The rate
  screen shows the note "Fighter rates are rounded to 2 decimals." because rounded fighter rates may not add up exactly to
  the rarity rate. Default table: Solenne 1.50%, Corvane 1.50% (★5 3.00%); Pell, Thessa, Rook 5.67% each (exact
  5.6666…; ★4 17.00%); Tavi, Lark, Dunmore 26.67% each (exact 26.6666…; ★3 80.00%).
- Rates shown are the base rates. The rules text says that pity and the guarantees can only raise the chance of ★4/★5.

### 11.3 Rolling, guarantees and pity
**RNG (round 3).** One summon action (×1 or ×10) uses one `SeededRng` (mulberry32, `src/logic/rng.js`; `next()` returns a
float in [0, 1)). The seed is injectable (tests, the `?test` hook); otherwise it is one uint32 from
`crypto.getRandomValues` (fallback `floor(Math.random() × 2^32)`). The seed is returned in the result object for bug
reports and is not saved. **Every pull makes exactly 2 `next()` calls, in this order: (A) the rarity draw, (B) the
fighter draw.** Call A is made even when the rarity is forced (its value is then ignored), so the call sequence never
depends on the outcome. A ×10 makes exactly 20 calls. Pulls inside an action are numbered **1-based** (pull 1 … 10).

**Rarity of pull i (order of checks, round 3 exact):**
1. **Hard pity:** `counter` = `save.summon.pity[pity.group]` (missing → 0) **before** this pull. If
   `counter ≥ hard_pity − 1` → ★5 (reason `hard_pity`). Default: counter 39 → ★5. (`≥` so a lowered `hard_pity` in
   data still guarantees the next pull.)
2. **×10 guarantees (pull 10 of a ×10 only):** `min = multi_min_rarity`; if `first_multi_done[banner_id]` is not `true`
   and `first_multi_min_rarity` is set, `min = max(min, first_multi_min_rarity)`. If none of pulls 1–9 of this ×10 has
   rarity ≥ `min`, draw from rarities ≥ `min` only: `T = Σ rates_bp[k] for k ≥ min`; if `T = 0` → ★5; else
   `r = floor(A × T)`, walking ★5 then ★4 then ★3 (★5 if `r < rates_bp[5]`, else ★4 if `r < rates_bp[5] + rates_bp[4]`,
   else ★3). Reason `first_multi` if the first-×10 rule raised `min`, else `multi`. Defaults: first ×10 → `min` 5,
   pull 10 is ★5; later ×10 → `min` 4, `T = 2,000`, ★5 if `r < 300` (15%), else ★4 (85%). With `multi_min_rarity` 3
   this rule never changes anything.
3. **Normal draw:** `r = floor(A × 10000)`; ★5 if `r < rates_bp[5]`, else ★4 if `r < rates_bp[5] + rates_bp[4]`, else
   ★3. Defaults: r 0–299 → ★5, 300–1,999 → ★4, 2,000–9,999 → ★3.

**Fighter of pull i:** `w = floor(B × W_k)`; walk `L_k` adding weights; the first fighter whose cumulative weight
exceeds `w` is drawn. Defaults: ★5 `W` = 10,000: w 0–4,999 → Solenne, 5,000–9,999 → Corvane. ★4 `W` = 30,000:
0–9,999 Pell, 10,000–19,999 Thessa, 20,000–29,999 Rook. ★3 `W` = 30,000: 0–9,999 Tavi, 10,000–19,999 Lark,
20,000–29,999 Dunmore.

**Counters (persisted in the save, §13):**
- `pity[group]`: after each pull, a ★5 (from any cause) sets it to 0; any other rarity adds 1. It is shared by all
  banners with the same `pity.group`, carries over between ×1 and ×10 and between sessions, and is never reset otherwise.
  Fresh save: absent = 0. Max reachable value with valid data: `hard_pity − 1` (39).
- `first_multi_done[banner_id]`: set to `true` when a ×10 on that banner completes (whether or not the guarantee was
  needed). ×1 pulls never set it; ten ×1 pulls are not a ×10. Fresh save: absent = false.
- `total_pulls`: + 1 per pull (+ 10 per ×10). Fresh save: 0.

**One summon action, in order (round 3, atomic):**
1. The banner is open (§11.1) and `jade ≥ cost` (`cost_single` or `cost_multi`), else nothing happens.
2. On Confirm: `jade −= cost`.
3. For pull 1 … count: rarity (above), fighter (above), update `pity[group]`, then apply the duplicate rule (§11.4) to the
   in-memory roster/Jade. Pulls are applied one by one, so a fighter that is NEW on pull 3 is a duplicate on pull 7.
4. If count is 10: `first_multi_done[banner_id] = true`. `total_pulls += count`. `updated_at = now`.
5. **Save once** (one `localStorage.setItem` of the whole save, §13), **before** any reveal frame is drawn. If the write
   throws, the in-memory save is restored to its state before step 2, no reveal plays, and the screen shows
   "Summon failed — no Jade was spent." (anti-reroll and no double spend).
6. Reveal, then results grid. Quitting at any point after step 5 changes nothing; on reopen the reveal is not shown
   again and the fighters are in the roster.

**Result object (logic → UI interface, round 3).** `summon(save, banner, data, count, rng)` returns
`{ seed, banner_id, count, cost, jade_before, jade_after, pity_before, pity_after, results[] }` and the new save; each
result is `{ pull (1-based), character_id, rarity (3|4|5), outcome, resonance_after, jade_added, guarantee }` with
`outcome` ∈ {`new`, `resonance`, `jade`} and `guarantee` ∈ {`none`, `hard_pity`, `first_multi`, `multi`}. Logic exports
both lists from `src/logic`; the UI maps every value (L-shared-009). `jade_added` is 0 unless `outcome` is `jade`.

### 11.4 Duplicates
- First copy: added to the roster (Resonance 0, `obtained_at` = now). Not added to the team automatically.
- Each duplicate: Resonance +1, up to 4 (`economy.duplicates.max_resonance`). Each rank gives +5% HP/ATK/DEF.
- Beyond R4: converted to Jade: ★3 → 10, ★4 → 40, ★5 → 200 *(data)*.
- **Exact (round 3):** for a drawn fighter with save resonance `r` (if owned): not owned → `new`, R0. Owned and
  `r < max_resonance` → `resonance`, `r + 1`. Owned and `r ≥ max_resonance` → `jade`: credit
  `overflow_amount_by_rarity[rarity]` of `overflow_currency_id`, capped at the currency `max` (999,999; the excess is lost);
  `jade_added` = the amount actually credited (can be 0 at the cap); resonance unchanged. The rarity used is the
  character's `rarity` in characters.json.
- Stage rewards of type `character` (§9.1) use the same rule, without touching pity or `total_pulls`.

**Acceptance (round 3: rewritten and extended; every AC uses the default data above unless it says "test data")**
- AC-11.1: 1,000,000 normal rarity draws (rule 3 alone, seeded) give ★5 / ★4 / ★3 counts within ±1,000 of
  30,000 / 170,000 / 800,000 (±0.1 percentage points).
- AC-11.2 (hard pity): save `pity.standard` = 39, `first_multi_done.banner_starter_001` = true; a ×1 is ★5 in 100 of 100
  seeds, `guarantee` `hard_pity`, and `pity.standard` is 0 afterwards. Must-FAIL check: with `pity.standard` = 38 and a
  stubbed `next()` that always returns 0.5 (r = 5,000), the pull is ★3 and the counter becomes 39. Not reachable in the
  default milestone by play alone (budget ≈ 38 pulls, and the first ×10 already gives a ★5); tests set the save.
- AC-11.3 (×10 guarantee): `first_multi_done.banner_starter_001` = true, `pity.standard` = 0, stubbed `next()` always
  0.9999 (A: r = 9,999 → ★3 on pulls 1–9): pull 10 uses `T = 2,000`, r = floor(0.9999 × 2,000) = 1,999 → **★4**,
  `guarantee` `multi`. With the stub returning 0.0 only for pull 10's call A (call 19): r = 0 → **★5**. Must-FAIL check:
  if pull 5's call A returns 0.1 (r = 1,000 → ★4), pull 10 is a normal draw: r = 9,999 → **★3**, `guarantee` `none`.
- AC-11.3b (first ×10): fresh save (Jade 1,000), stub always 0.9999: pulls 1–9 are ★3 and all `char_dunmore_001`
  (w = floor(0.9999 × 30,000) = 29,997): pulls 1–4 `resonance` R1 … R4, pulls 5–9 `jade` +10 each. Pull 10 is **★5**
  (`first_multi`), w = floor(0.9999 × 10,000) = 9,999 → `char_corvane_001`, `new`. Afterwards
  `first_multi_done.banner_starter_001` = true, `pity.standard` = 0, `total_pulls` = 10, Jade = 1,000 − 1,000 + 50 = **50**,
  Dunmore R4. A second ×10 with the same stub (needs 1,000 Jade, test sets it) gives ★4 on pull 10 (AC-11.3), not ★5.
- AC-11.3c (pity inside a ×10): `pity.standard` = 35, first ×10 done, stub always 0.9999: pulls 1–4 ★3 (counter 36, 37,
  38, 39), pull 5 ★5 by `hard_pity` (counter 0), pulls 6–9 ★3, pull 10 a normal draw (pull 5 was ★5 ≥ min 4) → ★3;
  `pity.standard` after = 5.
- AC-11.4 (rate table): the Rates screen shows ★5 3.00%, ★4 17.00%, ★3 80.00%; Solenne 1.50%, Corvane 1.50%, Pell /
  Thessa / Rook 5.67%, Tavi / Lark / Dunmore 26.67%, and the rounding note. Unit test: for each rarity, Σ exact fighter
  weights = `W_k` and Σ exact fighter percents = rarity percent (150 + 150 = 300 bp; 3 × 1,700 / 3 = 1,700 bp;
  3 × 8,000 / 3 = 8,000 bp).
- AC-11.5 (anti-reroll): kill the app during the reveal of a ×10 and reopen: the same fighters are in the roster with the
  same Resonance, Jade is deducted once, `pity` and `first_multi_done` are as after the summon, and no reveal replays.
- AC-11.6 (affordability): Jade 999 → ×10 disabled, ×1 enabled. Jade 1,000 → ×10 enabled. Jade 99 → both disabled.
  Jade 100 → ×1 enabled.
- AC-11.7 (fighter draw): stubbed call B = 0.4999 on a ★5 → w 4,999 → Solenne; 0.5 → Corvane. On a ★3: 0.3333 →
  w 9,999 → Tavi; 0.33334 → w 10,000 → Lark. Over 300,000 seeded ★3 fighter draws each fighter is within 1/3 ± 0.005.
- AC-11.8 (duplicates): a ★3 Tavi pull on a fresh save → `resonance`, R1 ("Resonance +1", R1). Tavi at R4 → `jade`,
  +10 Jade, still R4. A ★5 at R4 → +200. A fighter NEW on pull 3 and drawn again on pull 7 of the same ×10 → `new` then
  `resonance` (R1). At Jade 999,950 a ★5 overflow credits 49 (`jade_added` 49, Jade 999,999).
- AC-11.9 (determinism): the same seed and the same save give identical `results[]`; an instrumented RNG records exactly
  2 `next()` calls per pull (20 for a ×10), also on forced pulls.
- AC-11.10 (save order and failure): the save write happens before the first reveal frame (spy on `setItem` vs the
  reveal start). With `setItem` stubbed to throw, the Jade, roster, pity, `first_multi_done` and `total_pulls` are
  unchanged and "Summon failed — no Jade was spent." is shown.
- AC-11.11 (pity and first-×10 display): fresh save shows "★5 guaranteed within 40 summons." and the first-×10 line;
  after 3 ×1 pulls with no ★5 it shows 37; after any ×10 the first-×10 line is gone; after a ★5 it shows 40 again.
- AC-11.12 (no double summon): two taps on Confirm 100 ms apart, or a tap on Summon during a reveal, perform at most one
  summon (Jade deducted once, `total_pulls` + count once).
- AC-11.13 (availability, test data): a banner with `end_at` in the past is not shown; with no banner shown the screen
  shows "No summons available right now." and no Summon button.
- AC-11.14 (validator, §15.3 rule 4): a banner whose pool has no ★5 fighter FAILS validation even if `rates_bp["5"]` is 0;
  the default banner PASSES.

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

**Fresh-save defaults (round 2):** `settings` = { `bgm_volume`: 1.0, `sfx_volume`: 1.0, `haptics`: true };
`tutorial.completed` = false; `summon.pity` = {}, `first_multi_done` = {}, `total_pulls` = 0; `stages` = {};
currencies, roster and team from `economy.json` → `starting` (§12).

**Rules**
- On load: parse and validate against the schema. If that fails, copy the raw text to `game_save_corrupt_<unix_ms>`,
  start a fresh save and show "Save data was damaged and has been reset." on Home.
- `version` mismatch: run migration functions in order (v1 → v2 → …). An unknown future version means it is treated as corrupt.
- IDs in the save that no longer exist in the data are ignored on load (they are not deleted, so a later data fix restores them).
- AC-13.1: Win stage_001, close the app, reopen: stage_001 shows cleared and Jade includes the reward.
- AC-13.2: Writing garbage to `game_save` leads to a fresh save plus a backup key, with no crash.
- AC-13.3: A fresh save has `settings` exactly { bgm_volume 1.0, sfx_volume 1.0, haptics true } and `tutorial.completed` false.

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
   **Round 3:** ★5 always counts as "a rarity with a rate > 0" for these checks, because hard pity (§11.3) can force a ★5
   even when `rates_bp["5"]` is 0: every banner needs ≥1 ★5 pool fighter, and if it has no non-featured ★5, its featured
   ★5 shares sum to exactly 10,000. Negative fixture: a banner with `rates_bp` {3: 9,000, 4: 1,000, 5: 0} and no ★5 in
   `pool` must FAIL; the default `banner_starter_001` must PASS.
5. `type_chart` has all 25 pairs.
6. Starting team: 3 distinct families, all in `starting.characters`.
7. Text contains none of the banned terms (§3), case-insensitive whole words. Exception: "stand" and "hollow"
   are reported as **warnings** for a human to review, not errors, because they are ordinary English words.
8. `art_brief` and `bio` follow rule 7 as well.
9. **Name-only terms (§3):** the whole words `spark` and `sparks` (case-insensitive) in any field named `name`,
   `name_override` or `epithet`, at any depth in any data file, are **errors**. Other fields are not checked for them.
   Negative fixture: a card with name "Spark Kick" must FAIL; a story line "little sparks" must PASS.

---

## 16. Open questions for the owner — READY (round 3: all decided)

Round 3: the owner wrote "and you decide all that", delegating these to the Producer. Decisions (owner may override):
1. **Title:** Jade Tempest (§1), trademark check pending (compliance-checker).
2. **Difficulty feel:** stage_005 boss stays at the master AI tier; the balance-analyst tunes stats (data only) so the
   starter team can win it with skill.
3. **Draw rule:** a timeout tie or a double KO stays a Draw (no rewards) (§5.14).
4. **Left-handed mode:** not in this milestone.

No open questions remain.
