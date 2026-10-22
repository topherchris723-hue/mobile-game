# Project Status

Maintained by the Producer (main Claude Code session). Newest round at the top.

## Current state
- **Phase:** 2 — Build (in progress)
- **Round:** 2
- **Core battle loop passed QA:** no
- **Last release verdict:** none
- **Unity port started:** no

## Open issues
- Owner to pick a working title (GDD §1): Jade Tempest, Meridian Burst, Heavenbreak,
  Thunderclap Trio, Ironroar. Trademark check by compliance-checker before release.
- No committed data validator yet (`npm run validate-data`, GDD §15.3) — round 2 task.
- Balance risks flagged for later (stage_005 hard for starters, Riposte/Tri-Burst numbers)
  — balance-analyst once the engine exists. See reports/round-1-notes.md.

## Owner feedback
Write anything you liked or disliked here, in your own words. Every line becomes a
lesson and a hard rule at the next `/retro`.
- none yet

## Decisions made without the owner
- Round 1: kept game-designer defaults for its open questions: stage_005 boss uses the
  hardest AI tier; timeout tie / double KO = Draw (no rewards); no left-handed mirrored
  layout in this milestone. Owner can override any of these.
- Round 1: game-designer has no shell, so the Producer validates every schema change with
  Draft 2020-12 `check_schema` and re-validates data (chosen over widening its tools).

---

## Round log

### Round 2 — Build (plan)
- **Goal:** First build. Project setup, committed data validator, battle engine core,
  portrait battle screen shell, then QA loop.
- **Agents:** gameplay-programmer → ui-developer → qa-tester (loop ≤5) → team-coach.
  Sequential, not parallel: the UI needs the project setup and the logic API first.
- **Tasks:**
  - gameplay-programmer: `package.json` (Vite, Phaser 3 pinned, Vitest, Ajv), `npm run
    validate-data` (schema + GDD §15.3 + §3 banned terms, with negative fixtures),
    `src/logic/` battle core per GDD §5.0–5.5 (seeded sim, states, arena, Vigor,
    hand/deck, hits, damage) then as far as §5.6–5.10 fits, a headless battle runner,
    Vitest tests mapped to GDD AC IDs. Assigned this round: `package.json`, configs,
    `scripts/`, `tests/`.
  - ui-developer: `index.html`, Phaser boot, portrait battle scene shell driven by the
    logic API (placeholder shapes, HUD, hand of cards, swipe/tap input) at 360×640+.
  - qa-tester: test, play headlessly, check layouts, write `reports/qa/round-2.md`.

### Round 1 — Design (result)
- **Result:** Phase 1 complete. `docs/GDD.md` (§1–§16, content sections READY) with 5 title
  options; 9 schemas in `data/schemas/` (all valid Draft 2020-12). Content: 8 original
  fighters (3 starters), 52 cards, 12 enemies, 5 stages with missions + tutorial,
  10 story scenes, battle/banner/economy data — all files pass schema + GDD §15.3
  cross-file checks with negative tests.
- One in-round fix loop: content review found 4 GDD/schema gaps (role/art_brief fields,
  perfect_slip tutorial trigger, Tag start cooldown, banned-terms list); fixed and re-validated.
- **Verdict:** none (no build yet). QA/compliance/review not applicable this round.
- **Retro:** 12 new lessons (3 shared, 5 game-designer, 2 content-designer, 1 qa, 1 coach),
  no promotions; Producer fixed stale file paths in content-designer and game-designer
  playbooks (no rule loosened).
- **Next:** Round 2 — Phase 2 (Build): gameplay-programmer sets up the project
  (package.json, Vite/Phaser, Vitest), `npm run validate-data` with negative fixtures, and
  the battle engine core in `src/logic/` per GDD §5.0–5.5 build order; ui-developer builds
  the portrait battle screen shell; then QA loop.

### Round 1 — Design (plan)
- **Goal:** Phase 1. Produce the GDD (with 5 original title options) and data schemas,
  then the first original roster and stages as JSON.
- **Agents:** game-designer → content-designer → team-coach (/retro).
- **Tasks:**
  - game-designer: `docs/GDD.md` covering battle (real-time 1v1, 3-fighter teams,
    switching, card hand + energy, swipe/dodge, combos, counters, team finisher,
    transformations), summon screen, stages; `data/schemas/*.schema.json`.
  - content-designer: 6–10 fighters, their skills/cards, 3–5 story stages + enemies,
    validated against the schemas.
- **Phases skipped:** Build, QA, Balance, Compliance, Review — no code exists yet.

### Round 0 — setup
- Starter kit installed: pipeline, 16 agent playbooks, lessons system, build workflows.
- Owner filled in the brief: Legends-style 2D real-time 1v1, martial arts, hype tone,
  milestone = battle + summon screen.
- Next: Round 1 — Phase 1 (Design). game-designer writes the GDD (including 5 title
  options for the owner) and data schemas; content-designer creates the first roster.
