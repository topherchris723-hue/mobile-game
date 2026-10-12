# Shattered Sovereigns — Game Design Document

- **Title:** **Shattered Sovereigns** (chosen 2026-10-12). A web search found no game with this name; a formal trademark search (e.g. USPTO, EUIPO) and a Play Store search are required before public release.
- **Genre:** Real-time 2D card-action duels with character collection (anime gacha RPG)
- **Platform:** Mobile web / installable PWA, Android Chrome first, **landscape** (see `../decisions/0001-mobile-web-platform.md`, `../decisions/0003-2d-rendering-pixijs.md`)
- **Status:** Approved by owner (2026-10-12).
- **Inspirations (feel only, no borrowed content):** Dragon Ball Legends (real-time card-driven duels, cinematic specials), One Piece Treasure Cruise / Dokkan Battle / Naruto Blazing (team building, types, collection). The battle system — **Rift Duel** — is our own design. All characters, worlds, names, and art are original.

## 1. Pitch

Three worlds — a realm of energy-wielding martial artists, an ocean of rival adventure crews, and a land of elemental warrior clans — have shattered. Through the **Rift** between them, each world's greatest champions — its **Sovereigns** — are pulled into a shared battleground, the **Nexus**. Sovereigns who were never meant to meet must team up.

Players collect Sovereigns from all three worlds, form teams of three, and fight fast real-time duels where **the whole team lives in your hand**: every card you play can pull a different fighter through the Rift to strike.

## 2. Target players and sessions

- Fans of anime action and gacha games, ages 13+ (paid summons will require age-appropriate handling).
- **Landscape, two thumbs**, played like a handheld console.
- A duel lasts **60–120 seconds**; a story stage is 1–2 duels. Daily session 5–15 minutes.

## 3. Core loop

```
Duels (story, bosses, events) ──► earn Coins, training items, shards, some Gems
      ▲                                           │
      │                                           ▼
 Stronger team ◄──── level up / limit break / summon new fighters
```

The duel must be fun on its own. Collection and progression make it meaningful, not the other way round.

## 4. Battle system — Rift Duel

### 4.1 Setup
- **3 fighters per side.** One is **active** on the field; the other two wait on the **bench**, ready to be pulled in.
- **2D side-view arena**: your fighter on the left facing right, the opponent on the right, with a parallax background per world.
- The arena floor has **three lanes** at different depths — **near, middle, far** (like a classic beat-'em-up). Fighters further back are drawn slightly smaller and higher up the screen.
- Win by KO'ing all three enemy fighters, or by having more total remaining HP % when the **120 s** timer ends.

### 4.2 Screen layout (landscape)

```
┌──────────────────────────────────────────────────────────────┐
│ [Your HP ▮▮▮▮▮▯] [bench][bench]  ⏱ 87  [bench][bench] [Enemy HP] │
│                                                              │
│   far lane    ─────────────────────────────────────────────  │
│   mid lane    (you) ►                  ◄ (enemy)             │
│   near lane   ──────────── lane telegraphs glow here ──────  │
│  ◇◇◇ Rift Shards        Energy ▮▮▮▮▮▮▯▯▯▯     [CROSSOVER]     │
│  LEFT THUMB: swipe ↑ ↓ to change lane, hold to guard         │
│                      [card][card][card][card]  RIGHT THUMB   │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 Energy
- **Rift Energy** bar from 0 to 10, regenerating continuously (≈1 per second, tunable).
- Every card costs energy (1–4). Guarding drains energy.
- Energy management is the core tension: spend now for pressure, or save for a big chain or for defence.

### 4.4 Cards — "the whole team is in your hand"
- Each fighter brings **5 technique cards**: 2 **Strike** (melee), 2 **Blast** (ranged), 1 **Signature** (unique move).
- All three fighters' cards form one **15-card team deck**. You hold **4 cards**; each played card is replaced from the deck.
- Every card shows its owner's portrait and world frame.
- **Playing the active fighter's card** → they perform it immediately.
- **Playing a benched fighter's card** → a **Tag Strike**: that fighter rifts in, performs the move, and returns to the bench. **Hold** the card instead to make them the new active fighter (swap). Swaps have a short cooldown.
- Strikes dash into close range; Blasts fire down your current lane.

### 4.5 Combo grammar
- Up to 3 Strikes in a row form a chain; ending it with a Blast or Signature **launches** the opponent (bonus damage, brief recovery for them).
- **Tag Chain:** cards from **different fighters** played back-to-back within a short window (≈1.5 s) earn **Rift Shards**. Cards from fighters of **different worlds** earn more.
- So every hand poses a decision: a fast same-fighter combo for damage now, or a cross-team chain to build toward a Crossover Burst.

### 4.6 Defence — lanes, guard, and the Rift Step
- **Swipe up/down** (left side of the screen) to shift between far, middle, and near lanes. Lane shifts use **3 step charges** that refill over time, so dodging can't be spammed.
- Incoming Blasts and heavy attacks **telegraph their lane on the arena floor** before landing. Readable at a glance, fair on a small screen.
- **Rift Step:** shifting lanes in the last moment before a hit lands is a perfect dodge — time slows briefly, your next card costs less, and the first hit of your counter deals bonus damage.
- **Hold** the left side of the screen to **guard**: reduces damage, drains energy. Guarding a Strike chain at the right moment staggers the attacker.
- Some heavy attacks **track across lanes** — these must be guarded or Rift Stepped, not out-walked.

### 4.7 Crossover Burst (ultimate)
- At **3 Rift Shards**, the Crossover button lights up.
- Your active fighter and a benched fighter **from a different world** unleash a combined ultimate with a 2–3 s cinematic (skippable after first viewing).
- The effect depends on the **pair of types** involved (e.g. Fury + Void = armour-breaking finisher, Swift + Radiant = heal and haste). Certain named pairs have **unique Crossovers** — discovering them is part of collecting.

### 4.8 Types
Five original types, colour **and** icon coded (never colour alone):

| Type | Strong vs | Weak vs |
| --- | --- | --- |
| Fury | Swift | Guile |
| Swift | Guile | Fury |
| Guile | Fury | Swift |
| Radiant | Void | Void |
| Void | Radiant | Radiant |

Real-time balance: advantage ×1.5 damage dealt, disadvantage ×0.75.

### 4.9 KO and switching
- When the active fighter is KO'd, the player picks the next fighter (2 s window, then auto-pick). Their cards leave the deck.
- A KO'd fighter's cards in hand are discarded and redrawn.

### 4.10 Opponent AI
- The AI plays by **exactly the same rules and inputs** as the player (energy, hand, step charges) — no hidden advantages, and it makes AI-vs-team PvP possible later.
- Behaviour profiles: *Aggressor*, *Zoner* (Blast-heavy), *Counter-puncher*, *Tactician* (builds Crossovers).
- Difficulty is tuned through reaction time, mistake rate, and how well it manages energy, not by stat cheating.
- Bosses add scripted phases with clear telegraphs (e.g. at 50% HP, a lane-sweeping attack every 15 s).

## 5. Fighters and collection

- **Rarity:** 3★, 4★, 5★. Higher rarity = higher stat ceiling and stronger kit, never a different game.
- **Each fighter has:** type, world, role (Striker / Zoner / Guardian / Support), stats (HP, ATK, DEF), 5 technique cards, a **Leader Skill** (applies when they lead the team), and a **Passive**.
- **Progression per fighter:**
  - *Level* — raised with Coins + training items.
  - *Limit Break* — raises the level cap; uses **Shards**. Duplicate summons convert to shards, so duplicates are always useful.
  - *Awaken* (later) — 4★ → 5★ path for favourite characters.
- **Launch roster target:** 15 fighters (5 per world, all five types represented), expandable through data files only.

## 6. Economy

| Currency | How it's earned | What it's for | Feel |
| --- | --- | --- | --- |
| **Coins** | Every stage, plentifully | Levelling, limit breaks, upgrades | Common |
| **Gems** | First clears, chapter rewards, achievements, daily login; **purchasable with real money (later phase)** | Summons, continues | Scarce and exciting |

### Summons
- Single summon: 50 Gems. Multi (10 + 1 bonus): 500 Gems, guarantees at least one 4★.
- Base rates (tunable): 5★ 4% · 4★ 21% · 3★ 75%. **Rates shown in-game on every banner.**
- **Pity:** a visible counter guarantees a 5★ within 80 summons on a banner.
- Banner types: Standard (always available) and Featured (rate-up for specific fighters, limited time).
- Free-player pace target: roughly one multi-summon per week of regular play (tuned with data later).

### Real-money purchases (later phase — not in the first playable build)
Requirements before any money is involved:
1. **Server-authoritative economy:** accounts, server-held gem balances, and server-side summon rolls. The client only displays results.
2. **Payment channel:** Google Play Billing if shipped through the Play Store; a web payment provider otherwise. Receipts validated on the server.
3. **Compliance:** published drop rates, regional loot-box rules (e.g. Belgium bans paid loot boxes), privacy policy, refund handling, spending safeguards for minors.

Until then, all Gems are earned in-game and the economy runs locally; its rules live in a pure module (`src/game/economy/`) so they can move to the server unchanged.

### Stamina
**Decision: no stamina system in early versions.** It limits play without making it more fun. Revisit only if events need pacing.

## 7. Game modes (by phase)

1. **Story** — chapters of 8–10 stages, each one or two duels, with short dialogue scenes between fighters from different worlds.
2. **Boss battles** — tougher scripted opponents at the end of chapters.
3. **Events** (later) — limited-time bosses with a rewards track.
4. **PvP** (later, in stages):
   1. *Rift Arena* — fight other players' teams controlled by the same AI as story opponents. No real-time server needed.
   2. *Live PvP* — real-time matches, only if the game grows; requires a game server, matchmaking, and anti-cheat. The simulation is designed as fixed-step and deterministic from day one to keep this possible.

## 8. Screens

Home · Story map · Team select · Duel · Results · Fighter list · Fighter detail (with animated fighter preview) · Summon · Settings · (later) Shop, Events, Arena.

The whole game runs in landscape; holding the phone upright shows a "rotate your phone" screen.

## 9. Art and audio direction

**The full, locked art direction is in [`art-style.md`](art-style.md)** (lighting, palettes with hex values, character rules, environments, effects, UI, artist specs). Summary:

- **Look:** HD cel-shaded anime characters over painterly golden-hour backgrounds: huge sunlit clouds, saturated skies, warm light with violet shadows, floating islands, and the Nexus crystal citadel always on the horizon.
- **Mood:** bright heroic adventure; the Rift brings deep violet drama for bosses, Crossovers, and story climaxes.
- **Worlds** are told apart by palette and motifs: Energy realm (ember orange, lava red, basalt indigo), Ocean crews (sea blue, sandstone, terracotta), Warrior clans (canopy green, pagoda crimson).
- **Two art tiers per Sovereign:** a detailed **splash art** illustration (summons, cards, cut-ins) plus animated **battle sprites** in the same style (74 frames across 16 named clips).
- **Visual effects** (auras, blasts, hit sparks, Rift Step slow-mo, lane telegraphs) are built in code and can reach final quality while characters are still placeholders.
- **Placeholders** are code-drawn figures that already follow the style guide, so the game looks coherent from day one. Real art replaces them by dropping in files that follow the artist specs — any artist, or the owner using a phone drawing app, can produce them.
- **UI:** light cloud-white menu panels and dark ink battle HUD, crisp chamfered panels, Saira Condensed + Noto Sans.
- **Audio:** punchy layered hit sounds, a distinct Rift Step "time-slip" sound, Crossover stingers, one battle theme per world. Separate music/SFX/haptics toggles.

## 10. Out of scope for the first playable build

Real-money purchases, accounts and servers, PvP of any kind, events, chat or guilds, voice acting.
