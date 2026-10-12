# Architecture

Current map of the game's systems. Update this whenever a system is added, removed, or changes responsibility.

## Status

Milestone **M1 — Foundation + battlefield test**, converted to **portrait** for the turn-based Rift Timeline design (`decisions/0004-portrait-turn-based.md`). The test boots to the Nexus battlefield with 4 placeholder Sovereigns and 3 placeholder enemies; tapping a unit selects it. No battle rules yet (M2).

## Runtime flow

```
index.html ─► src/main.ts
  ├─ debug/log + debug/errorCapture      installed first, so even boot errors reach the screen
  ├─ core/flags                           ?debug=1, ?bench=1
  ├─ game/battlefield                     simulation state (pure TypeScript)
  ├─ render/stage + render/battlefieldView PixiJS app and scene, built behind the boot screen
  ├─ ui/bootScreen                        "Tap to start" → fullscreen + portrait lock (best effort)
  ├─ input/tapInput                       taps → view.unitAt → buffered select commands
  ├─ core/loop                            rAF driver around a 60 Hz fixed-step clock
  │    update()  → game/battlefield stepBattlefield(state, commands)
  │    render(α) → battlefieldView.render → stage.render
  └─ ui/playability                       pauses in landscape or hidden tab; resumes without catch-up
```

## Modules

| Path                                           | Responsibility                                                                                                                                                              | Depends on                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `src/config/*`                                 | All tuning and content data: palette (mirrors art-style.md), display (720-unit-wide portrait space), simulation rate, battlefield layout, tap thresholds, placeholder looks | —                          |
| `src/core/fixedStep.ts`                        | Converts frame time into whole 60 Hz ticks + interpolation alpha; clamps stalls                                                                                             | config/sim                 |
| `src/core/loop.ts`                             | requestAnimationFrame driver; start/stop for pausing                                                                                                                        | core/fixedStep             |
| `src/core/rng.ts`                              | Seeded PRNG (mulberry32) for reproducible gameplay                                                                                                                          | —                          |
| `src/core/flags.ts`, `buildInfo.ts`, `math.ts` | URL flags, build id/time (injected by Vite), small math helpers                                                                                                             | —                          |
| `src/game/battlefield.ts`                      | Battlefield test state: units, slots, selection. **No DOM or rendering.** Replaced by the Rift Timeline simulation in M2.                                                   | config/battlefield         |
| `src/input/tapInput.ts`                        | Pointer events → taps (pure `isTap` rule, multi-touch safe)                                                                                                                 | config/input               |
| `src/render/stage.ts`                          | PixiJS application, resolution cap, logical 720-unit-wide world scaling                                                                                                     | config/display             |
| `src/render/battlefieldView.ts`                | Composes backdrop layers, Rift effects, units (depth sort, selection ring), motes; hit-testing for taps                                                                     | render/*                   |
| `src/render/backdrop.ts`                       | Canvas 2D painter for the placeholder sky and floor, repainted only on resize; clouds blurred once per layer                                                                | config/palette             |
| `src/render/placeholderFighter.ts`             | Code-drawn placeholder Sovereign with cel shading and posable limbs                                                                                                         | config/placeholderFighters |
| `src/render/riftEffects.ts`, `embers.ts`       | Animated citadel beams/halo; pooled rising motes (no per-frame allocation)                                                                                                  | config/palette             |
| `src/render/color.ts`                          | Colour maths: cel-shadow rule, battle desaturation, CSS formatting                                                                                                          | config/palette             |
| `src/ui/*`                                     | Boot screen, playability (pause) watcher, hint, `styles.css` design tokens                                                                                                  | —                          |
| `src/debug/*`                                  | Logger (ring buffer), error capture panel, `?debug=1` overlay, copyable reports                                                                                             | core/buildInfo             |

## Key decisions

- Platform: `decisions/0001-mobile-web-platform.md`. Rendering: `decisions/0003-2d-rendering-pixijs.md`. Portrait + turn-based: `decisions/0004-portrait-turn-based.md`.
- The simulation owns all game state; rendering only reads it. Input never mutates state directly — it queues commands that the next tick applies.
- Animation is driven by simulation time, so pausing freezes everything consistently.
- Pixi's own ticker is disabled; the game loop renders explicitly and stops completely when paused (battery).
- Static scenery is painted once per screen size into textures; only units, beams, and motes animate.

## Deployment

`.github/workflows/ci.yml` runs typecheck, lint, unit tests, build, size budget, and Playwright e2e on every push; green pushes are published by `scripts/deploy-pages.sh` to the `gh-pages` branch (`main` at the root, other branches under `preview/<branch>/`).
