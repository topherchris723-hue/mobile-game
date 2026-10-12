# Shattered Sovereigns — Game Design Document

- **Title:** **Shattered Sovereigns** (chosen 2026-10-12). A web search found no game with this name; a formal trademark search (e.g. USPTO, EUIPO) and a Play Store search are required before public release.
- **Genre:** Turn-based team battler with character collection (anime gacha RPG)
- **Platform:** Mobile web / installable PWA, Android Chrome first, **portrait, one hand** (see `../decisions/0001-mobile-web-platform.md`, `../decisions/0003-2d-rendering-pixijs.md`, `../decisions/0004-portrait-turn-based.md`)
- **Status:** Battle system revised to **Rift Timeline** (2026-10-12) — awaiting owner approval of §4. Everything else approved.
- **Inspirations (feel only, no borrowed content):** Dokkan Battle, One Piece Treasure Cruise, Naruto Blazing, Dragon Ball Legends (team building, types, cinematic supers, collection). The battle system — **Rift Timeline** — is our own design. All characters, worlds, names, and art are original.

## 1. Pitch

Three worlds — a realm of energy-wielding martial artists, an ocean of rival adventure crews, and a land of elemental warrior clans — have shattered. Through the **Rift** between them, each world's greatest champions — its **Sovereigns** — are pulled into a shared battleground, the **Nexus**. Sovereigns who were never meant to meet must team up.

Players collect Sovereigns from all three worlds, form teams of four, and fight turn-based battles where **time itself is the battlefield**: every move changes who acts next, and the best players bend the turn order so their heroes chain together and the enemy's deadliest attacks never land.

## 2. Target players and sessions

- Fans of anime gacha RPGs, ages 13+ (paid summons will require age-appropriate handling).
- **Portrait, one thumb.** Playable on a bus with one hand; no reflexes required.
- A battle stage takes **2–4 minutes** (2–3 waves, boss on the last). Safe to leave mid-battle: the game pauses and resumes exactly where it was. Daily session 5–15 minutes.

## 3. Core loop

```
Battles (story, bosses, events) ──► earn Coins, training items, shards, some Gems
      ▲                                            │
      │                                            ▼
 Stronger team ◄──── level up / limit break / summon new Sovereigns
```

The battle must be fun on its own. Collection and progression make it meaningful, not the other way round.

## 4. Battle system — Rift Timeline

### 4.1 Setup

- **Your team:** 4 Sovereigns. The first is the **Leader**, whose Leader Skill applies to the whole team.
- **Enemies:** 1–3 per wave, 2–3 waves per stage. The last wave is usually a boss.
- **Win** by defeating every wave. **Lose** when all four Sovereigns are knocked out.

### 4.2 The Timeline

Everyone — your Sovereigns and the enemies — sits on **one shared turn-order bar** at the top of the screen, showing the next 8 actions.

- The unit at the front of the bar acts. Afterwards it goes back into the line based on the **Weight** of what it did and its **Speed**: light moves come back around quickly, heavy moves take longer.
- **Weight:** Strike 2 · Skill 3 · Super 4 (tunable).
- **Speed** is a stat; faster units get more turns over a battle.
- **Timeline preview:** while you pick a move, ghost markers show exactly where your Sovereign will land and how enemies will shift. Nothing about turn order is ever hidden or random.

### 4.3 Your turn

When one of your Sovereigns reaches the front, you choose one action:

| Action     | Weight | Effect                                                                              |
| ---------- | ------ | ----------------------------------------------------------------------------------- |
| **Strike** | 2      | Basic attack. +1 Rift Energy.                                                       |
| **Skill**  | 3      | The Sovereign's signature technique; has a cooldown (in their own turns). See §4.4. |
| **Super**  | 4      | Big attack with a short cut-in. Costs Rift Energy (4–6).                            |

Then tap an enemy to target it (the most urgent enemy is pre-selected, so a single tap on the action button is often enough).

### 4.4 Bending time — Skills

Skills are what make the Timeline a game. Each Sovereign has one, built from a small set of timeline effects:

- **Shove** — push an enemy back N places (e.g. "Quake Fist: damage + shove 2").
- **Rally** — pull an ally forward N places.
- **Haste / Slow** — change a unit's Speed for a few turns.
- **Guard** — the Sovereign's next hit taken is halved, and they counter.
- Plus ordinary effects: damage, heal, defence break.

### 4.5 Poise and Break

- Every enemy has a **Poise** bar under its HP.
- Hits drain Poise; **type-advantaged hits drain double**, and Skills drain extra.
- At 0 Poise the enemy is **Broken**: it is shoved to the back of the Timeline, takes +50% damage until it acts again, and **any telegraphed attack it was preparing is cancelled**.
- Poise refills after the enemy's next action.

### 4.6 Telegraphs — the boss puzzle

- Enemies' dangerous moves appear **on the Timeline in advance** as a marked slot ("METEOR — 3 turns").
- You have until that slot comes up to stop it: **Break** the enemy, **Shove** it back to buy time, or **Guard** the target it will hit.
- Bosses have phases (e.g. at 50% HP they telegraph twice as often). Every boss fight is a readable puzzle, not a stat check.

### 4.7 Rift Links — the multiverse mechanic

- When two of your Sovereigns **from different worlds** act **back-to-back** on the Timeline, the second one gets a **Rift Link**: +25% damage and +1 extra Rift Energy.
- Same-world back-to-back actions give no link, so team building across worlds — and ordering turns with Rally/Shove — matters.

### 4.8 Rift Energy and Crossover Burst

- **Rift Energy** is one shared team gauge (0–10). Earned from Strikes, Rift Links, and Breaking enemies.
- Supers cost 4–6 energy.
- **Crossover Burst** (10 energy): when two Sovereigns from different worlds are **next to each other at the front of the Timeline**, they can act together in one combined ultimate with a cinematic cut-in. The effect depends on their **type pair** (e.g. Fury + Void = armour-breaking finisher, Swift + Radiant = team heal and haste). Some named pairs have **unique Crossovers** — discovering them is part of collecting.

### 4.9 Types

Five original types, colour **and** icon coded (never colour alone):

| Type    | Strong vs | Weak vs |
| ------- | --------- | ------- |
| Fury    | Swift     | Guile   |
| Swift   | Guile     | Fury    |
| Guile   | Fury      | Swift   |
| Radiant | Void      | Void    |
| Void    | Radiant   | Radiant |

Advantage ×1.5 damage and ×2 Poise damage; disadvantage ×0.75 damage.

### 4.10 Enemy behaviour

- Enemies follow the same Timeline, Weight, and Speed rules as the player — no hidden extra turns.
- Behaviour profiles: _Brute_ (heavy telegraphs), _Skirmisher_ (fast, light hits), _Warden_ (guards allies, slows you), _Riftcaller_ (manipulates the Timeline itself).
- Difficulty comes from smarter targeting and nastier telegraph patterns, not inflated stats.

### 4.11 Screen layout (portrait)

```
┌──────────────────────────────┐
│ ▶[Kai][Golem][Mira][☄][Sena] │  Timeline — next 8 actions
│                              │
│               (enemy) (boss) │  Enemies, upper right, facing left
│          (enemy)             │
│                              │
│   (ally)  (ally)             │  Your four Sovereigns, lower left,
│ (ally)  (ally)               │  facing right (side-view sprites)
│                              │
│ ┌──────────────────────────┐ │
│ │ KAI  ▮▮▮▮▮▮▯ HP  ◆◆◆◇ RE │ │  Active Sovereign + Rift Energy
│ │ [STRIKE] [SKILL] [SUPER] │ │  Action buttons in the thumb zone
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

### 4.12 Pace and convenience

- Every enemy action and animation is short (≤ 1.2 s), with a 2× speed toggle.
- **Auto-battle** for cleared stages (later milestone) — never for first clears of bosses.

## 5. Fighters and collection

- **Rarity:** 3★, 4★, 5★. Higher rarity = higher stat ceiling and stronger kit, never a different game.
- **Each fighter has:** type, world, role (Striker / Breaker / Guardian / Support), stats (HP, ATK, DEF, SPD), a **Skill** (§4.4), a **Super**, a **Leader Skill** (applies when they lead the team), and a **Passive**.
- **Progression per fighter:**
  - _Level_ — raised with Coins + training items.
  - _Limit Break_ — raises the level cap; uses **Shards**. Duplicate summons convert to shards, so duplicates are always useful.
  - _Awaken_ (later) — 4★ → 5★ path for favourite characters.
- **Launch roster target:** 15 fighters (5 per world, all five types represented), expandable through data files only.

## 6. Economy

| Currency  | How it's earned                                                                                         | What it's for                     | Feel                |
| --------- | ------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------- |
| **Coins** | Every stage, plentifully                                                                                | Levelling, limit breaks, upgrades | Common              |
| **Gems**  | First clears, chapter rewards, achievements, daily login; **purchasable with real money (later phase)** | Summons, continues                | Scarce and exciting |

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

1. **Story** — chapters of 8–10 stages, with short dialogue scenes between Sovereigns from different worlds.
2. **Boss battles** — scripted, telegraph-heavy fights at the end of chapters.
3. **Events** (later) — limited-time bosses with a rewards track.
4. **PvP** (later) — _Rift Arena_: fight other players' teams controlled by the enemy AI. Turn-based play makes this possible without real-time servers.

## 8. Screens

Home · Story map · Team select · Battle · Results · Sovereign list · Sovereign detail (with animated preview) · Summon · Settings · (later) Shop, Events, Arena.

The whole game runs in **portrait**; turning the phone sideways shows a "turn your phone upright" screen.

## 9. Art and audio direction

**The full, locked art direction is in [`art-style.md`](art-style.md)** (lighting, palettes with hex values, character rules, environments, effects, UI, artist specs). Summary:

- **Look:** HD cel-shaded anime characters over painterly golden-hour backgrounds: huge sunlit clouds, saturated skies, warm light with violet shadows, floating islands, and the Nexus crystal citadel always on the horizon.
- **Mood:** bright heroic adventure; the Rift brings deep violet drama for bosses, Crossovers, and story climaxes.
- **Worlds** are told apart by palette and motifs: Energy realm (ember orange, lava red, basalt indigo), Ocean crews (sea blue, sandstone, terracotta), Warrior clans (canopy green, pagoda crimson).
- **Two art tiers per Sovereign:** a detailed **splash art** illustration (summons, cards, cut-ins) plus animated **battle sprites** in the same style (56 frames across 11 named clips).
- **Visual effects** (auras, blasts, hit sparks, Break shatter, Timeline telegraphs, Rift Links) are built in code and can reach final quality while characters are still placeholders.
- **Placeholders** are code-drawn figures that already follow the style guide, so the game looks coherent from day one. Real art replaces them by dropping in files that follow the artist specs — any artist, or the owner using a phone drawing app, can produce them.
- **UI:** light cloud-white menu panels and dark ink battle HUD, crisp chamfered panels, Saira Condensed + Noto Sans.
- **Audio:** punchy layered hit sounds, a distinct "time-slip" sound when the Timeline is bent, Crossover stingers, one battle theme per world. Separate music/SFX/haptics toggles.

## 10. Out of scope for the first playable build

Real-money purchases, accounts and servers, PvP of any kind, events, chat or guilds, voice acting.
