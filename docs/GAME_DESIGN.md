# Tidebound — Game Design & Technical Plan

_Working title. An original sea-adventure action RPG in the island-hopping grind genre._

## 1. Concept

Players are castaways-turned-adventurers in the **Shattered Tides**, an archipelago of drifting
islands. They fight their way up from the docks of Saltmarsh Harbor, train their body and blade,
hunt down **Relics** (rare, ancient powers bound to the sea), and sail to harder islands.

Everything here is our own: names, world, power system. We take the genre's proven loop and none of
any existing game's or anime's IP.

## 2. Core loop

```
 Take on enemies / quests ──► earn XP and drops ──► level up ──► spend attribute points
        ▲                                                              │
        └──────── unlock a harder island or boss ◄──── become stronger ┘
```

Moment-to-moment: readable melee combos against telegraphed enemy attacks. Skill shows in spacing
(stepping out of wind-ups) and in timing (staggering light enemies to cancel their attacks).

## 3. Target players and platforms

- Ages 10+, fans of anime action and grind RPGs.
- **All platforms**: phone, tablet, PC and console are first-class targets.
  - Touch: on-screen attack button beside the jump button, hold-to-combo.
  - PC: hold left mouse to attack, `C` for attributes.
  - Gamepad: R2 / X to attack, Y for attributes, full UI selection support.
  - The UI scales to the viewport and respects safe areas (notches, Roblox top bar).

## 4. Art and UI direction

"Weathered nautical": deep sea-navy panels, parchment text and brass accents, with thin strokes
and small corner radii. There are no gradients, glows or bubbly buttons. The tokens live in
`src/client/UI/Theme.luau`, and every UI must use them.

## 5. Progression

| System | Milestone | Notes |
|---|---|---|
| Levels 1–100, XP curve `50 · L^1.5` | **M1 ✅** | 3 attribute points per level |
| Attributes: Strength, Vitality | **M1 ✅** | Blade and Relic attributes arrive with their systems |
| Quests (NPC-given kill/collect) | M2 | Main XP source; teaches the island |
| Currency (Doubloons) and shop | M3 | Has a sink before it ships |
| Blades (weapon type #2) | M3 | Scales with Blade |
| Relics (rare powers, 2–3 skills each) | M4 | Scales with Relic; drop or reroll |
| Bosses with loot tables | M4 | Spawn timers, damage-share loot |
| Second island and sailing | M5 | Level-gated |
| Attribute reset (paid with currency) | M3 | Encourages experimenting with builds |

Reward rule: anyone who deals at least 10% of an enemy's health gets the **full** reward. Grouping
up is never punished, and leeching takes real effort.

## 6. Architecture

```
ReplicatedStorage/Shared        (both sides — no secrets, no authority)
  Config/                       tuning tables (progression, combat, enemies)
  Net.luau                      every remote, created by the server
  Progression.luau              pure formulas (XP curve, derived stats)
  Tags.luau                     CollectionService tags + attribute names

ServerScriptService/Server      (authoritative)
  Main.server.luau              boot order
  Data/PlayerDataSchema.luau    shape, defaults, migrations, sanitisation
  Services/DataService          session-locked DataStore persistence
  Services/ProgressionService   XP, levels, attribute spending
  Services/EnemyService         spawning, AI, rewards
  Services/CombatService        server-side combos, hitboxes, damage
  Util/RateLimiter              per-player token buckets for remotes

StarterPlayerScripts/Client     (presentation + input only)
  Main.client.luau
  InputMode.luau                keyboard / gamepad / touch detection
  UI/Theme, UI/Components       design system
  Controllers/                  HUD, attributes panel, combat input/FX, enemy bars
```

Principles:
- **The server decides everything that matters.** The client sends intent ("I swung", "spend 1
  point on Strength"). The server validates it, rate-limits it and computes the result.
- **Progression replicates through Player attributes.** The client can only read them, so no sync
  remotes are needed.
- **One AI heartbeat for all enemies**, throttled to 10 Hz, with no per-enemy loops or threads.
- **StreamingEnabled-safe.** Enemy models stream atomically. Client visuals attach and detach
  through CollectionService.

### Remotes

| Remote | Direction | Payload | Guarding |
|---|---|---|---|
| `RequestAttack` | C→S | none | rate limit, alive check, server combo timing |
| `RequestAllocateStat` | C→S | `statId, amount` | rate limit, type/NaN/int checks, point and cap checks |
| `HitConfirmed` (unreliable) | S→C | `{ Model, Damage, Finisher, Killed }[]` | cosmetic only |
| `RewardGranted` | S→C | `{ XP, LevelsGained, NewLevel }` | cosmetic only |

### Data safety

- `UpdateAsync` with a session lock. A server never writes a record whose lock it doesn't hold.
- An abandoned lock (from a crashed server) expires after 5 minutes. Joins retry for 30 seconds
  before kicking with a friendly message.
- Corrupt data or data from a newer schema is **never** overwritten. The player is kicked instead.
- Autosave runs every 60 s (staggered). Profiles also save on leave and in `BindToClose` (25 s budget).
- Saves carry a schema version, and migrations live in `PlayerDataSchema.MIGRATIONS`.
- The player's `UserId` is attached to every write, for GDPR erasure requests.

Known limits: up to 60 s of progress can be lost if a server crashes hard. If another server holds a
stale lock, a rejoin can take up to 5 minutes.

## 7. Roadmap

Each milestone ends in a playable, testable state.

1. **M1 — Core loop prototype ✅** Melee combo, two enemy types with telegraphed attacks,
   XP and levels, attributes, saving, the HUD on all platforms.
2. **M2 — Saltmarsh Harbor.** Island blockout, quest NPCs with dialogue, a quest tracker HUD
   and the first boss.
3. **M3 — Economy and Blades.** Doubloons, a shop, weapon equipping and the Blade attribute,
   plus attribute reset.
4. **M4 — Relics.** Rare power drops, skill bar (keys / gamepad / touch), cooldown UI and VFX.
5. **M5 — Second island and sailing.** Level-gated travel, new enemies and a new boss.
6. **QA and optimisation pass.** Device testing, MicroProfiler, network budget, exploit review.
7. **Launch prep.** Onboarding flow, settings menu, analytics events, monetisation (cosmetic and
   convenience only, never pay-to-win stats).
