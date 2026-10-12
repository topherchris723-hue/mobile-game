# Game Design Document

- **Working title:** Project Nexus (placeholder — final name to be chosen and checked for trademark conflicts)
- **Genre:** Turn-based team battler with character collection (anime gacha RPG)
- **Platform:** Mobile web / installable PWA, Android Chrome first (see `../decisions/0001-mobile-web-platform.md`)
- **Status:** Draft — awaiting owner approval
- **Inspirations (feel only, no borrowed content):** One Piece Treasure Cruise (tap-timing team turns), Dragon Ball Z Dokkan Battle (type advantage, super attacks), Naruto Ultimate Ninja Blazing (team links), Dragon Ball Legends (cinematic specials). All characters, worlds, names, and art are original.

## 1. Pitch

Three worlds — a realm of energy-wielding martial artists, an ocean of rival adventure crews, and a land of elemental warrior clans — have been torn open by the **Rift** and pulled into a shared battleground, the **Nexus**. Fighters who were never meant to meet must team up. Players collect heroes from all three worlds, build teams of six, and fight through the Nexus in fast, tactile, turn-based battles where *how well you tap* matters as much as *who you bring*.

## 2. Target players and sessions

- Fans of anime gacha games, ages 13+ (paid summons will require age-appropriate handling).
- One-handed portrait play. A battle stage takes **1–3 minutes**; safe to quit between waves.
- Daily session: 5–15 minutes; longer sessions for events and story chapters.

## 3. Core loop

```
Battle stages ──► earn Coins, training items, shards, (some) Gems
      ▲                                  │
      │                                  ▼
 Stronger team ◄── level up / limit break / summon new fighters
```

The battle must be fun on its own. Collection and progression make it *meaningful*, not the other way round.

## 4. Battle system

### 4.1 Team
- **5 fighters + 1 guest** (a support fighter borrowed from a preset/friend list).
- Your **Leader** and the guest's leader each grant a **Leader Skill** (e.g. "Fury fighters +50% attack").
- Formation shown in the lower half of the screen as six portrait tiles (thumb zone); enemies in the upper half.

### 4.2 Types
Five original types, colour **and** icon coded (never colour alone):

| Type | Strong vs | Weak vs |
| --- | --- | --- |
| Fury | Swift | Guile |
| Swift | Guile | Fury |
| Guile | Fury | Swift |
| Radiant | Void | Void |
| Void | Radiant | Radiant |

Advantage: ×2 damage dealt. Disadvantage: ×0.5. Radiant/Void are mutually strong.

### 4.3 Player turn — tap timing and chains
1. Tap a fighter tile. A **timing ring** shrinks around it; tap again when it hits the target ring.
   - *Perfect* ×1.5 (+ burst charge), *Great* ×1.2, *Good* ×1.0, *Miss* ×0.8.
2. Each consecutive Great/Perfect raises the **Chain multiplier** (×1.0 → ×1.5 → ×2.0 → ×2.5 cap). A Good or Miss resets growth.
3. **World Link:** consecutive attackers from the same world add a link bonus, so tap *order* is a real decision.
4. Players choose the order; all six act once per turn.
5. A short "auto-timing" accessibility option gives guaranteed *Great* for players who can't use timing input.

### 4.4 Burst gauge and Super Attacks
- Each fighter fills a **Burst gauge** from Perfect hits, taking damage, and certain skills.
- When full, the tile glows; **hold** the tile to unleash a **Super Attack** with a short (≤1.5 s, skippable) cut-in.
- Supers also have effects: damage, defence break, heal, type change, delay enemy turns.

### 4.5 Enemy turn
- Each enemy shows a **countdown** ("attacks in 2"). Reaching 0 = it attacks.
- Bosses have scripted patterns (e.g. "at 50% HP, shields itself for 2 turns") telegraphed in advance, so players plan supers around them.

### 4.6 Stage structure
- 2–4 waves, last is a boss. Win = all waves cleared. Lose = team defeated.
- Continue after defeat: costs Gems (offered once per stage; never pushed with countdown timers).

## 5. Fighters and collection

- **Rarity:** 3★, 4★, 5★. Higher rarity = higher stat ceiling and stronger kit, never a different game.
- **Each fighter has:** type, world, role (Striker / Guardian / Support / Disruptor), stats (HP, ATK, DEF), Leader Skill, Super Attack, one Passive.
- **Progression per fighter:**
  - *Level* — raised with Coins + training items.
  - *Limit Break* — raises level cap; uses **Shards**. Duplicate summons convert to shards, so duplicates are always useful.
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
**Recommendation: no stamina system in early versions.** It limits play without making it more fun. Revisit only if events need pacing.

## 7. Game modes (by phase)

1. **Story** — chapters of 8–10 stages each, with short dialogue scenes between fighters from different worlds.
2. **Events** (later) — limited-time stages with a featured boss and a rewards track.
3. **Challenge tower** (later) — harder, puzzle-like fights with rule modifiers.
4. PvP — not planned; it needs servers and fair matchmaking, and the core game should prove itself first.

## 8. Screens

Home · Story map · Team select · Battle · Results · Fighter list · Fighter detail · Summon · Settings · (later) Shop, Events.

## 9. Art and audio direction

- **One unified style across all three worlds:** bold 2D anime-style character art, strong outlines, cel shading. Worlds are distinguished by **palette and motifs**, not by different art styles:
  - Energy realm — warm golds and oranges, aura effects, angular shapes.
  - Ocean crews — teals and sandy tones, rope/wood/brass motifs, rounded shapes.
  - Warrior clans — deep greens and crimsons, ink-brush strokes, sharp diagonals.
- **Placeholder phase:** each fighter is a clean, consistent placeholder (type colour + world motif + initials/silhouette), all clearly marked in `../assets.md`. Real art drops in later by replacing image files — no code changes.
- **Art specs for the eventual artist** will be documented before production art begins (portrait sizes, full-body sizes, cut-in sizes, file formats).
- **UI:** dark, high-contrast battle UI; menus use a restrained palette with type colours as accents. No neon overload.
- **Audio:** punchy hit sounds layered by timing quality (Perfect sounds best), distinct super-attack stingers, one battle loop per world. Separate music/SFX/haptics toggles.

## 10. Out of scope for the first playable build

Real-money purchases, accounts and servers, events, PvP, chat or guilds, voice acting.
