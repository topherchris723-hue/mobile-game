# Shattered Sovereigns — Game Design Document

- **Title:** **Shattered Sovereigns** (chosen 2026-10-12). A web search found no game with this name; a formal trademark search (e.g. USPTO, EUIPO) and a Play Store search are required before public release.
- **Genre:** Turn-based 1v1 card battles with teams of 3 and character collection (anime gacha RPG)
- **Platform:** Mobile web / installable PWA, Android Chrome first, **portrait, one hand** (see `../decisions/0001-mobile-web-platform.md`, `../decisions/0003-2d-rendering-pixijs.md`, `../decisions/0004-portrait-turn-based.md`, `../decisions/0005-turn-based-rift-duel.md`)
- **Status:** Approved by owner (2026-10-12). Battle system: turn-based **Rift Duel** (§4), defined by the owner: teams of 3, 1v1 on the field, free switching, auto-switch on KO, a hand of 3 attack cards.
- **Inspirations (feel only, no borrowed content):** Dokkan Battle, One Piece Treasure Cruise, Naruto Blazing, Dragon Ball Legends (team building, types, cinematic supers, collection). The battle rules — **Rift Duel** — are our own design. All characters, worlds, names, and art are original.

## 1. Pitch

Three worlds — a realm of energy-wielding martial artists, an ocean of rival adventure crews, and a land of elemental warrior clans — have shattered. Through the **Rift** between them, each world's greatest champions — its **Sovereigns** — are pulled into a shared battleground, the **Nexus**. Sovereigns who were never meant to meet must team up.

Players collect Sovereigns from all three worlds, form teams of three, and fight turn-based one-on-one duels: each turn you pick one of three attack cards, decide when to tag in a teammate, and manage a shared pool of Rift Energy to land devastating Signature moves.

## 2. Target players and sessions

- Fans of anime gacha RPGs, ages 13+ (paid summons will require age-appropriate handling).
- **Portrait, one thumb.** Playable on a bus with one hand; no reflexes required.
- A battle takes **2–4 minutes** (3 v 3). Safe to leave mid-battle: the game pauses and resumes exactly where it was. Daily session 5–15 minutes.

## 3. Core loop

```
Battles (story, bosses, events) ──► earn Coins, training items, shards, some Gems
      ▲                                            │
      │                                            ▼
 Stronger team ◄──── level up / limit break / summon new Sovereigns
```

The battle must be fun on its own. Collection and progression make it meaningful, not the other way round.

## 4. Battle system — Rift Duel (turn-based)

### 4.1 Setup

- **Teams of 3** on both sides. Each side has **one active fighter** on the field; the other two wait on the **bench**.
- **Win** by knocking out all three enemy fighters. **Lose** if all three of yours are knocked out.
- Turns **alternate**: you act, then the enemy acts. The side whose active fighter has the higher **Speed** goes first (ties go to the player).

### 4.2 Your turn

1. **Start of turn:** your team gains **+2 Rift Energy** (one shared gauge per team, 0–10; both teams start with 1). Your active fighter's hand is refilled to **3 cards**.
2. **Switch (optional, free, once per turn):** tag in a benched fighter. Their own hand of 3 replaces the current one, and you can still play a card this turn. The fighter you swapped out can't be tagged back in until after your next turn.
3. **Then exactly one of:**
   - **Play a card** you can afford (cost is paid from Rift Energy), or
   - **Charge**: skip attacking and gain **+2 extra Rift Energy**.

Playing a card or charging ends your turn.

### 4.3 Cards

Each fighter has their **own deck of 6 cards**; you always see 3 from whoever is on the field. Played cards go to a discard pile and are reshuffled into the deck when it runs out.

| Kind          | In each deck | Cost | Power | Notes                                                        |
| ------------- | ------------ | ---- | ----- | ------------------------------------------------------------ |
| **Strike**    | 2            | 1    | ×1.0  | Quick close-range hit.                                       |
| **Blast**     | 2            | 2    | ×2.2  | Ranged energy attack.                                        |
| **Technique** | 1            | 2–3  | —     | The fighter's signature utility: Focus, Guard, Heal, or Sap. |
| **Signature** | 1            | 5    | ×6.0  | Ultimate move with a cut-in. Most damage per energy.         |

Every card shows its cost, its kind (icon **and** label), and the **expected damage** against the current enemy, including type advantage — no hidden maths.

**Technique effects:**

- **Focus** — your next attack deals ×1.5.
- **Guard** — the next hit you take is halved.
- **Heal** — restore 25% of max HP.
- **Sap** — the enemy's active fighter loses 30% Defence for 2 turns.

### 4.4 Knockouts and auto-switch

When a fighter's HP reaches 0 they are knocked out and **the next fighter on the bench switches in automatically** (in team order). Energy is kept. The new fighter's hand is filled immediately.

### 4.5 Types

Five original types, colour **and** label coded (never colour alone):

| Type    | Strong vs | Weak vs |
| ------- | --------- | ------- |
| Fury    | Swift     | Guile   |
| Swift   | Guile     | Fury    |
| Guile   | Fury      | Swift   |
| Radiant | Void      | Void    |
| Void    | Radiant   | Radiant |

Advantage ×1.5 damage; disadvantage ×0.75. Switching to a fighter with type advantage is the main reason to switch.

### 4.6 Rift mechanics (the multiverse twist)

- **Tag Link:** switching between fighters **from different worlds** gives **+1 Rift Energy**. Teams that mix worlds switch more freely.
- **Crossover Burst** _(M3)_: at 10 Rift Energy, if your active fighter and a living bench fighter come from different worlds, a 4th card appears — a combined ultimate whose effect depends on their type pair. Some named pairs have unique Crossovers to discover.
- **Telegraph** _(M3)_: when the enemy can afford its Signature, a "Charging" marker warns you — switch to a tougher fighter, Guard, or knock it out first.

### 4.7 Damage

`damage = ATK × power × type × focus × guard × 100 / (100 + DEF × sap)`, rounded. No random variance: the expected damage on a card is exactly what it deals. Randomness comes only from deck shuffles (seeded, reproducible).

### 4.8 Enemy behaviour

The enemy follows exactly the same rules (energy, hand of 3, one free switch, auto-switch). Its priorities, in order: take a knockout if a card can; protect itself when low (Guard/Heal); switch to type advantage; play its Signature; otherwise play its strongest affordable attack; otherwise Charge. Harder enemies later get smarter priorities, not inflated stats.

### 4.9 Screen layout (portrait)

```
┌──────────────────────────────┐
│ ENEMY  Rift Brute  FURY      │  Enemy HP, energy, bench (●●○)
│ ▮▮▮▮▮▮▮▯▯ 840/1200           │
│                  (enemy) ◄   │
│                              │  1 v 1 on the field
│    ► (you)                   │
│ ┌──────────────────────────┐ │
│ │ KAIEN · FURY  ▮▮▮▮▮▯ HP  │ │
│ │ ◆◆◆◆◇◇◇◇◇◇ Rift Energy   │ │
│ │ [card] [card] [card]     │ │  3 cards in the thumb zone
│ │ [⇄ Maris] [⇄ Torvan] [Charge] │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

### 4.10 Pace

Animations are short (≤ 1 s per action) and the enemy acts after a brief pause so every hit is readable. A battle against 3 enemies should take 2–4 minutes. A 2× speed toggle and auto-battle for cleared stages come later.

## 5. Fighters and collection

- **Rarity:** 3★, 4★, 5★. Higher rarity = higher stat ceiling and stronger kit, never a different game.
- **Each fighter has:** type, world, role (Striker / Breaker / Guardian / Support), stats (HP, ATK, DEF, SPD), a **deck of 6 cards** (§4.3) including a Technique and a Signature, a **Leader Skill** (applies when they lead the team), and a **Passive**.
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

1. **Story** — chapters of 8–10 duels, with short dialogue scenes between Sovereigns from different worlds.
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
- **Two art tiers per Sovereign:** a detailed **splash art** illustration (summons, cards, cut-ins) plus one full-body **battle illustration** animated in code.
- **Visual effects** (auras, blasts, hit sparks, Break shatter, Timeline telegraphs, Rift Links) are built in code and can reach final quality while characters are still placeholders.
- **Placeholders** are code-drawn figures that already follow the style guide, so the game looks coherent from day one. Real art replaces them by dropping in files that follow the artist specs — any artist, or the owner using a phone drawing app, can produce them.
- **UI:** light cloud-white menu panels and dark ink battle HUD, crisp chamfered panels, Saira Condensed + Noto Sans.
- **Audio:** punchy layered hit sounds, a distinct "time-slip" sound when the Timeline is bent, Crossover stingers, one battle theme per world. Separate music/SFX/haptics toggles.

## 10. Out of scope for the first playable build

Real-money purchases, accounts and servers, PvP of any kind, events, chat or guilds, voice acting.
