# Architecture

Current map of the game's systems. Update this whenever a system is added, removed, or changes responsibility.

## Status

Milestone **M1 — Foundation + arena test**. The arena test boots to a three-lane Nexus arena with two placeholder Sovereigns; the player's fighter steps lanes (swipe) and guards (hold). No duel rules yet.

## Runtime flow

```
index.html ─► src/main.ts
  ├─ debug/log + debug/errorCapture      installed first, so even boot errors reach the screen
  ├─ core/flags                           ?debug=1, ?bench=1
  ├─ game/arena  createArenaState         simulation state (pure TypeScript, seeded)
  ├─ render/stage + render/arenaView      PixiJS app and scene, built behind the boot screen
  ├─ ui/bootScreen                        "Tap to start" → fullscreen + landscape lock (best effort)
  ├─ input/movementInput                  left-half swipes/holds → buffered ArenaCommands
  ├─ core/loop                            rAF driver around a 60 Hz fixed-step clock
  │    update()  → game/arena stepArena(state, commands)
  │    render(α) → arenaView.render (interpolated) → stage.render
  └─ ui/playability                       pauses on portrait or hidden tab; resumes without catch-up
```

## Modules

| Path                                           | Responsibility                                                                                                            | Depends on                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `src/config/*`                                 | All tuning and content data: palette (mirrors art-style.md), display, simulation rate, lanes, gestures, placeholder looks | —                                |
| `src/core/fixedStep.ts`                        | Converts frame time into whole 60 Hz ticks + interpolation alpha; clamps stalls                                           | config/sim                       |
| `src/core/loop.ts`                             | requestAnimationFrame driver; start/stop for pausing                                                                      | core/fixedStep                   |
| `src/core/rng.ts`                              | Seeded PRNG (mulberry32) for reproducible gameplay                                                                        | —                                |
| `src/core/flags.ts`, `buildInfo.ts`, `math.ts` | URL flags, build id/time (injected by Vite), small math helpers                                                           | —                                |
| `src/game/arena.ts`                            | Arena simulation: fighters, lanes, lane steps, guard, test-arena wandering. **No DOM or rendering.**                      | config/arena, core/rng           |
| `src/input/gestures.ts`                        | Pure swipe/hold recogniser; one gesture per touch                                                                         | config/input                     |
| `src/input/movementInput.ts`                   | Binds pointer events (left half of the screen) to the recogniser; buffers commands for the next tick                      | input/gestures, game/arena types |
| `src/render/stage.ts`                          | PixiJS application, resolution cap, logical 720-unit-tall world scaling                                                   | config/display                   |
| `src/render/arenaView.ts`                      | Composes backdrop layers, Rift effects, fighters (lane depth, interpolation, guard blend), embers                         | render/*                         |
| `src/render/backdrop.ts`                       | Canvas 2D painter for the placeholder sky and floor, repainted only on resize                                             | config/palette                   |
| `src/render/placeholderFighter.ts`             | Code-drawn placeholder Sovereign with cel shading and posable limbs                                                       | config/placeholderFighters       |
| `src/render/riftEffects.ts`, `embers.ts`       | Animated citadel beams/halo; pooled rising motes (no per-frame allocation)                                                | config/palette                   |
| `src/render/color.ts`                          | Colour maths: cel-shadow rule, battle desaturation, CSS formatting                                                        | config/palette                   |
| `src/ui/*`                                     | Boot screen, playability (pause) watcher, arena hint, `styles.css` design tokens                                          | —                                |
| `src/debug/*`                                  | Logger (ring buffer), error capture panel, `?debug=1` overlay, copyable reports                                           | core/buildInfo                   |

## Key decisions

- Platform: `decisions/0001-mobile-web-platform.md`. Rendering: `decisions/0003-2d-rendering-pixijs.md`.
- The simulation owns all game state; rendering only reads it. Input never mutates state directly — it queues commands that the next tick applies.
- Animation is driven by simulation time, so pausing freezes everything consistently.
- Pixi's own ticker is disabled; the game loop renders explicitly and stops completely when paused (battery).
- Static scenery is painted once per screen size into textures; only fighters, beams, and motes animate.

## Deployment

`.github/workflows/ci.yml` runs typecheck, lint, unit tests, build, size budget, and Playwright e2e on every push; green pushes are published by `scripts/deploy-pages.sh` to the `gh-pages` branch (`main` at the root, other branches under `preview/<branch>/`).
