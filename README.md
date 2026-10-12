# Tidebound

An original island-hopping action RPG for Roblox (phone, tablet, PC and console).
See [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) for the design, architecture and roadmap.

**Current state: Milestone 1, the core loop prototype.** You can fight two enemy types with a
4-hit melee combo, earn XP, level up, spend attribute points and keep your progress between sessions.

## Setup

The project is managed with [Rojo](https://rojo.space) 7.4.

```bash
rokit install                       # installs the pinned Rojo version (see rokit.toml)
rojo build -o Tidebound.rbxlx       # one-off: build a place file and open it in Studio
# or, for live sync while editing:
rojo serve                          # then press Connect in the Rojo Studio plugin
```

Recommended Studio settings:
- **Game Settings → Security → Enable Studio Access to API Services**. Without it, saving uses a
  temporary in-memory store and the output window warns you about it.
- Publish the place before testing DataStores.

## Where things live in Studio

| Path in Studio | Source |
|---|---|
| `ReplicatedStorage.Shared` | `src/shared` |
| `ServerScriptService.Server` | `src/server` |
| `StarterPlayer.StarterPlayerScripts.Client` | `src/client` |
| `Workspace.Baseplate`, `SpawnLocation`, `EnemySpawns` | `default.project.json` |

Created at runtime: `ReplicatedStorage.Remotes`, `Workspace.Enemies`, `ServerStorage.EnemyTemplates`.

### Adding enemies to a map

Place an anchored, invisible, non-collidable Part where the enemy should stand. Give it the tag
`EnemySpawn` and a string attribute `EnemyType` set to a key from
`src/shared/Config/EnemyConfig.luau` (`DockThug`, `HarborBrute`).

## Required assets (placeholders in use)

| What | Where to set it | Current placeholder |
|---|---|---|
| 4 punch combo animations (R15) | `CombatConfig.ComboAnimationIds` | a pale slash effect, visible only to the attacker |
| Swing and hit sounds | `CombatConfig.SwingSoundId`, `HitSoundId` | silent |
| Enemy models | a Model named after the type id in `ServerStorage.EnemyTemplates` (needs a Humanoid and HumanoidRootPart) | tinted default R15 rigs |
| Island map | Workspace | flat grass baseplate |

Animations must be uploaded by the same account or group that owns the experience, or they
won't play.

## Testing

Automated checks for the pure logic (XP curve, level-ups, data sanitisation):

```bash
python3 tests/run_tests.py path/to/luau   # standalone Luau CLI from github.com/luau-lang/luau
```

Manual test pass in Studio:

1. **Play solo.** The HUD fades in after data loads, showing level 1 and 100/100 HP.
2. Walk toward +X. Dock Thugs aggro at about 35 studs. Hold left mouse (or press the touch button
   in the device emulator). Damage numbers appear, and every 4th hit is a gold finisher with
   knockback and a slight FOV kick.
3. Watch for the red outline on an enemy: it is winding up. Step back to dodge, or hit a Thug to
   interrupt it. Harbor Brutes (far +X) **cannot** be interrupted.
4. Kill 3 Thugs. You should see "+20 XP" toasts and a LEVEL 2 banner, and the Stats button shows a
   badge with 3.
5. Press `C` (or `Y`, or the Stats button) and spend points. Vitality raises max HP immediately.
6. Run more than 70 studs from a Thug's spawn. It walks home and fully heals.
7. Die to a Brute, respawn, and confirm max HP still reflects Vitality.
8. With API access enabled: stop, play again, and confirm level and attributes persisted.
9. **Test → Clients and Servers → 2 players.** Both damage one enemy and both receive XP. Each
   sees only their own damage numbers.
10. Use the device emulator (phone landscape, tablet) to check that the HUD doesn't collide with
    the thumbstick, the jump button or the attack button.

## Code standards

- `--!strict` everywhere. The code type-checks with `luau-lsp analyze` against Roblox definitions.
- The server is authoritative. Clients send intent only, and every remote is validated and
  rate-limited.
- UI uses `UI/Theme` tokens only, with no ad-hoc colours or fonts.
