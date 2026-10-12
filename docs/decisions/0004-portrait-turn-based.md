# 0004 — Portrait, turn-based battles (Rift Timeline)

- **Status:** Accepted
- **Date:** 2026-10-12
- **Replaces:** the real-time, landscape **Rift Duel** design (game-design.md history) and the landscape parts of `CLAUDE.md` §6.

## Context

After playing the M1 arena test, the owner decided the game should be **turn-based** and should **not** be played sideways. They chose **Rift Timeline** from three original turn-based systems (Rift Weave, Rift Timeline, Momentum Clash).

## Decision

- **Battle system:** Rift Timeline (`../design/game-design.md` §4) — a shared turn-order bar, Weight/Speed-based turn order, Shove/Rally timeline manipulation, Poise Break, telegraphed boss moves, Rift Links between worlds, and Crossover Bursts.
- **Orientation:** portrait only, played with one thumb. Landscape shows a "turn your phone upright" screen and pauses.
- **Team size:** 4 Sovereigns vs. 1–3 enemies per wave.

## Consequences

- **Kept from M1:** build/deploy pipeline, debug overlay, error capture, fixed-step loop (used for animation timing and effects), art style, painted Nexus backdrop, placeholder Sovereigns, PixiJS rendering.
- **Removed:** real-time lanes, swipe/hold gestures, lane-step simulation. Their code and tests are deleted rather than left unused.
- **Simpler input:** taps only; no reflex timing. This also makes Rift Arena (AI-controlled PvP) feasible without real-time servers.
- **Smaller sprite spec:** 56 frames across 11 clips (art-style.md §10.2) instead of 74.
- The battle simulation will be event-driven per turn (pure TypeScript, seeded, deterministic), with the 60 Hz loop driving presentation and animation.
