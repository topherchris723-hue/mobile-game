# Architecture

Current map of the game's systems. Update this whenever a system is added, removed, or changes responsibility.

## Status

Milestones **M4 — Battle feel** and **M5 — Home menu, Sovereigns, and saving** are built on top of the complete M2–M3 Rift Duel. The game boots to a home menu (Story, Sovereigns, locked Summon/Guilds tiles, and a Settings sheet), has a 15-Sovereign roster with Leader Skills, a collection and team editor, a Prologue story battle, and a versioned save (schema v2, with settings). Battles have Signature/Crossover cut-ins, hit-stop, spark bursts, screen shake, synthesized sound effects, vibration, and a remembered 1×/2× speed toggle. Art and audio are still code-made placeholders; the visual GUI pass is scheduled after the gameplay milestones (owner's call).

## Runtime flow

```
index.html ─► src/main.ts
  ├─ debug/log + debug/errorCapture      installed first, so even boot errors reach the screen
  ├─ core/flags                           ?debug=1, ?bench=1, ?speed=N
  ├─ save/saveStore                       load + validate + migrate the save (localStorage)
  ├─ render/stage                         one PixiJS app for the whole session
  ├─ audio/sfx + ui/feedback (in app)      synthesized SFX and vibration, gated by Settings
  ├─ ui/bootScreen                        "Tap to start" → fullscreen + portrait lock (best effort)
  └─ scenes/app                           screen router; exactly one screen alive at a time
       ├─ ui/screens/homeScreen           Story · Sovereigns · Summon (locked) · Guilds (locked)
       ├─ ui/screens/settingsSheet        sound, vibration, reduce motion, battle speed, build id
       ├─ ui/screens/storyScreen          Prologue (+ locked Chapter 1)
       ├─ ui/screens/sovereignsScreen     collection grid, detail sheet, team editor (saves)
       └─ scenes/battleSession            one battle: duel view + HUD + duel scene + game loop
            ├─ game/leader                applies slot 1's Leader Skill to the team
            ├─ scenes/duelScene           owns the duel; plays events back; runs the enemy AI
            │     game/duel/rules         pure rules → DuelEvent[]
            │     game/duel/ai            enemy decisions by profile
            ├─ render/duelView            Pixi battlefield and effects
            └─ ui/duelHud                 HTML battle HUD
  ui/playability → app.setPlayable         pauses the battle loop and suspends audio in landscape or a hidden tab
```

Menus are HTML over a static painted backdrop (`ui/menuBackdrop`, no game loop). The Pixi canvas is hidden outside battles, and the game loop only exists inside a battle session.

### How a turn flows

1. The HUD reports a tap (card, bench, Charge, Crossover). The scene checks it is legal; if not, the HUD shows the reason in a toast.
2. A legal tap becomes a buffered intent, applied on the next tick via `applyAction`, which mutates the duel state and returns events.
3. The scene plays events back one at a time (`EVENT_DURATION_MS`): the view animates, the HUD updates its _displayed_ HP/energy so numbers change in sync with hits, and `feedback.cue()` plays the matching sound/vibration. A Signature or Crossover first holds the stage for a cut-in (`CUT_IN_MS`), ended by the scene in game time. Hits carry a `HitImpact` (heavy for Signatures/Crossovers → longer hit-stop, bigger spark burst, shake). All durations divide by the live speed (`?speed=` × the 1×/2× setting).
4. When the queue is empty: enemy turn → short think pause → `chooseAction` → back to step 3; player turn → controls enabled.

## Modules

| Path                                                                                                      | Responsibility                                                                                                                                  | Depends on                             |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `src/config/sovereigns.ts`                                                                                | The 15 launch Sovereigns: stats, decks, rarity, role, Leader Skills, placeholder looks; starters and default team                               | config/fighters, battle, palette       |
| `src/config/story.ts`                                                                                     | Story stages (Prologue)                                                                                                                         | config/fighters                        |
| `src/config/fighters.ts`                                                                                  | Fighter/card types, card helpers, the Rift enemy team                                                                                           | config/battle, placeholderFighters     |
| `src/config/battle.ts`                                                                                    | Duel rules: energy, Tag Link, switch cooldown, type and technique multipliers, combo, Crossover and partner effects, Drain, AI profiles         | —                                      |
| `src/config/crossovers.ts`                                                                                | Named Crossover Bursts for specific pairs                                                                                                       | —                                      |
| `src/config/duelPresentation.ts`, `palette.ts`, `display.ts`, `sim.ts`, `placeholderFighters.ts`          | Battle layout and timings, colours (mirror art-style.md), logical space, tick rate, enemy looks                                                 | —                                      |
| `src/core/*`                                                                                              | Fixed-step clock and loop, seeded RNG, flags, build info, math                                                                                  | config                                 |
| `src/game/duel/*`                                                                                         | Pure, deterministic duel rules, damage, AI, types                                                                                               | config                                 |
| `src/game/leader.ts`                                                                                      | Leader Skill application and descriptions                                                                                                       | config/sovereigns                      |
| `src/game/team.ts`                                                                                        | Team editing rule (always three different Sovereigns; placing an existing member swaps)                                                         | —                                      |
| `src/save/saveData.ts`                                                                                    | Save schema v2 (v1 + settings), defaults, parse/migrate/validate/repair (pure)                                                                  | config/sovereigns                      |
| `src/config/feedback.ts`                                                                                  | Sound recipes, vibration patterns, cue table, impact tuning (hit-stop, shake, sparks), cut-in length                                            | —                                      |
| `src/audio/sfx.ts`                                                                                        | Web Audio synth for the recipes; unlocks on a tap, suspends while paused, caps overlapping voices                                               | config/feedback                        |
| `src/ui/feedback.ts`                                                                                      | `cue(id)`: plays a moment's sound and vibration, reading Settings at the moment it fires                                                        | audio/sfx, config/feedback             |
| `src/save/saveStore.ts`                                                                                   | localStorage I/O: immediate writes, never overwrites a newer-version save, works in memory if storage is blocked                                | save/saveData                          |
| `src/scenes/app.ts`                                                                                       | Screen router; records story clears; owns the menu toast and backdrop                                                                           | ui/screens, scenes/battleSession       |
| `src/scenes/battleSession.ts`                                                                             | One battle's lifecycle: view, HUD, scene, loop; disposes everything on exit                                                                     | render, ui, game                       |
| `src/scenes/duelScene.ts`                                                                                 | Event playback, AI turns, buffered player intents, replay                                                                                       | game/duel, render/duelView, ui/duelHud |
| `src/render/stage.ts`                                                                                     | PixiJS application, resolution cap, logical scaling                                                                                             | config/display                         |
| `src/render/duelView.ts`                                                                                  | Backdrop layers, the two active fighters (each one baked illustration animated in code), projectiles, Crossover/Drain effects, floating numbers | render/*                               |
| `src/render/portraits.ts`                                                                                 | Renders each Sovereign's battle art once into an image for the menus                                                                            | render/placeholderFighter              |
| `src/render/backdrop.ts`, `placeholderFighter.ts`, `riftEffects.ts`, `embers.ts`, `tweens.ts`, `color.ts` | Code-painted placeholder art, effects, tweening, colour rules                                                                                   | config/palette                         |
| `src/ui/screens/*`                                                                                        | Home, Story, and Sovereigns screens (HTML)                                                                                                      | save, config, game/leader, game/team   |
| `src/ui/duelHud.ts`, `cardText.ts`, `dom.ts`, `menuBackdrop.ts`                                           | Battle HUD; shared card text/icons and DOM helpers; static menu backdrop                                                                        | game/duel (read-only helpers)          |
| `src/ui/bootScreen.ts`, `playability.ts`, `styles.css`                                                    | Start screen, pause on rotation/hide, design tokens and all styles                                                                              | —                                      |
| `src/debug/*`                                                                                             | Logger, error capture, `?debug=1` overlay, copyable reports                                                                                     | core/buildInfo                         |

## Key decisions

- Platform: `decisions/0001-mobile-web-platform.md`. Rendering: `decisions/0003-2d-rendering-pixijs.md`. Portrait + turn-based: `decisions/0004-portrait-turn-based.md`. Battle rules: `decisions/0005-turn-based-rift-duel.md`.
- The simulation owns all game state; rendering only reads it. Input never mutates state directly — it queues commands that the next tick applies.
- Animation is driven by simulation time, so pausing freezes everything consistently.
- Pixi's own ticker is disabled; the game loop renders explicitly and stops completely when paused (battery).
- Static scenery is painted once per screen size into textures; only fighters, effects, beams, and motes animate.
- Text-heavy battle UI is HTML/CSS (crisp text, accessible buttons); the battlefield is PixiJS.
- Rules never wait on animation: the state is final immediately; presentation catches up event by event.
- The save is written immediately on every change (mobile browsers can kill a tab without warning); its rules are pure and unit-tested.

## Deployment

`.github/workflows/ci.yml` runs typecheck, lint, unit tests, build, size budget, and Playwright e2e on every push; green pushes are published by `scripts/deploy-pages.sh` to the `gh-pages` branch (`main` at the root, other branches under `preview/<branch>/`).
