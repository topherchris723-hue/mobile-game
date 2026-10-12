# Architecture

Current map of the game's systems. Update this whenever a system is added, removed, or changes responsibility.

## Status

Milestone **M3 — Duel depth** on top of the M2 Rift Duel core (`decisions/0005-turn-based-rift-duel.md`): a complete 3 v 3 turn-based duel against the AI in portrait, with cards, energy, free switching, auto-switch on KO, types, Tag Link, combos, Crossover Bursts, Signature telegraphs, Drain, AI behaviour profiles, victory/defeat, and replay. Fighters and backgrounds are still code-drawn placeholders.

## Runtime flow

```
index.html ─► src/main.ts
  ├─ debug/log + debug/errorCapture      installed first, so even boot errors reach the screen
  ├─ core/flags                           ?debug=1, ?bench=1, ?speed=N
  ├─ render/stage + render/duelView       PixiJS app, backdrop, fighters, effects (built behind the boot screen)
  ├─ ui/bootScreen                        "Tap to start" → fullscreen + portrait lock (best effort)
  ├─ ui/duelHud                           HTML HUD: enemy panel, cards, energy, bench, Charge, result
  ├─ scenes/duelScene                     owns the duel; plays events back; runs the enemy AI
  │     game/duel/rules  applyAction()   pure rules → DuelEvent[]
  │     game/duel/ai     chooseAction()  enemy decisions, same rules as the player
  ├─ core/loop                            rAF driver around a 60 Hz fixed-step clock
  │    update()  → duelScene.update (event playback timing, buffered player intents, AI turns)
  │    render(α) → duelView.render → stage.render
  └─ ui/playability                       pauses in landscape or hidden tab; resumes without catch-up
```

### How a turn flows

1. The HUD reports a tap (card, bench, Charge). The scene checks it is legal; if not, the HUD shows the reason in a toast.
2. A legal tap becomes a buffered intent, applied on the next tick via `applyAction`, which mutates the duel state and returns events.
3. The scene plays events back one at a time (`EVENT_DURATION_MS`): the view animates, the HUD updates its _displayed_ HP/energy so numbers change in sync with hits.
4. When the queue is empty: enemy turn → short think pause → `chooseAction` → back to step 3; player turn → controls enabled.

## Modules

| Path                                                                                         | Responsibility                                                                                                                                                              | Depends on                             |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `src/config/battle.ts`                                                                       | Duel rules: team/hand size, energy, Tag Link, switch cooldown, type and technique multipliers, combo, Crossover and partner effects, Drain, AI profiles                     | —                                      |
| `src/config/fighters.ts`                                                                     | Placeholder roster: 3 Sovereigns and 3 Rift enemies with stats and 6-card decks                                                                                             | config/placeholderFighters             |
| `src/config/crossovers.ts`                                                                   | Named Crossover Bursts for specific pairs                                                                                                                                   | —                                      |
| `src/config/duelPresentation.ts`                                                             | Portrait layout, event timings, enemy think time, seed                                                                                                                      | —                                      |
| `src/config/palette.ts`, `display.ts`, `sim.ts`, `placeholderFighters.ts`                    | Colours (mirrors art-style.md), 720-unit-wide space, tick rate, placeholder looks                                                                                           | —                                      |
| `src/core/*`                                                                                 | Fixed-step clock and loop, seeded RNG, flags, build info, math                                                                                                              | config                                 |
| `src/game/duel/types.ts`                                                                     | Duel state, actions, events                                                                                                                                                 | —                                      |
| `src/game/duel/rules.ts`                                                                     | Pure, deterministic rules: setup, turns, cards, combos, switching, Crossover, Drain, KO/auto-switch, win; HUD helpers (Crossover preview, Signature telegraph, combo check) | config/battle                          |
| `src/game/duel/damage.ts`                                                                    | Type wheel and the exact damage formula (also used for on-card previews)                                                                                                    | config/battle                          |
| `src/game/duel/ai.ts`                                                                        | Enemy decision-making by priority, shaped by each fighter's profile (KO → protect → switch → Crossover/Signature → Drain → save → Focus/Sap → best attack → Charge)         | game/duel/rules                        |
| `src/scenes/duelScene.ts`                                                                    | Runs a duel: event playback, AI turns, buffered player intents, restart                                                                                                     | game/duel, render/duelView, ui/duelHud |
| `src/render/stage.ts`                                                                        | PixiJS application, resolution cap, logical scaling                                                                                                                         | config/display                         |
| `src/render/duelView.ts`                                                                     | Backdrop layers, the two active fighters (each one baked illustration animated in code: breathing, lunge, hit flash, guard ward, KO), projectiles, floating numbers         | render/*                               |
| `src/render/tweens.ts`                                                                       | Small game-time tween runner                                                                                                                                                | core/math                              |
| `src/render/backdrop.ts`, `placeholderFighter.ts`, `riftEffects.ts`, `embers.ts`, `color.ts` | Code-painted placeholder art and effects                                                                                                                                    | config/palette                         |
| `src/ui/duelHud.ts`                                                                          | HTML battle HUD with displayed HP/energy, cards with exact damage previews, bench, toasts, result                                                                           | game/duel (read-only helpers)          |
| `src/ui/bootScreen.ts`, `playability.ts`, `styles.css`                                       | Start screen, pause on rotation/hide, design tokens and HUD styles                                                                                                          | —                                      |
| `src/debug/*`                                                                                | Logger, error capture, `?debug=1` overlay, copyable reports                                                                                                                 | core/buildInfo                         |

## Key decisions

- Platform: `decisions/0001-mobile-web-platform.md`. Rendering: `decisions/0003-2d-rendering-pixijs.md`. Portrait + turn-based: `decisions/0004-portrait-turn-based.md`. Battle rules: `decisions/0005-turn-based-rift-duel.md`.
- The simulation owns all game state; rendering only reads it. Input never mutates state directly — it queues commands that the next tick applies.
- Animation is driven by simulation time, so pausing freezes everything consistently.
- Pixi's own ticker is disabled; the game loop renders explicitly and stops completely when paused (battery).
- Static scenery is painted once per screen size into textures; only fighters, effects, beams, and motes animate.
- Text-heavy battle UI is HTML/CSS (crisp text, accessible buttons); the battlefield is PixiJS.
- Rules never wait on animation: the state is final immediately; presentation catches up event by event.

## Deployment

`.github/workflows/ci.yml` runs typecheck, lint, unit tests, build, size budget, and Playwright e2e on every push; green pushes are published by `scripts/deploy-pages.sh` to the `gh-pages` branch (`main` at the root, other branches under `preview/<branch>/`).
