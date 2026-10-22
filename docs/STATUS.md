# Project Status

Maintained by the Producer (main Claude Code session). Newest round at the top.

## Current state
- **Phase:** 2/Growth — summon screen build + balance (in progress)
- **Round:** 3
- **Core battle loop passed QA:** yes (round 2, QA loop 2: 0 blocker / 0 major)
- **Last release verdict:** none
- **Unity port started:** no

## Open issues
- Owner to pick a working title (GDD §1): Jade Tempest, Meridian Burst, Heavenbreak,
  Thunderclap Trio, Ironroar. Trademark check by compliance-checker before release.
- BUG-2-11 (MINOR, ui-developer): name labels collide at melee range / clipped at right wall.
- AC-5.8.5 chain_index ambiguity and AC-5.6.1/5.6.2 example off-by-one (game-designer).
- Tutorial 20 s prompt cap was chosen by ui-developer; GDD §9.4 must rule on it.
- TRI-BURST locked vs ready look too similar (ui-developer / art-director).
- smoke.spec.js overwrites committed screenshots on every run (ui-developer: gate behind env flag).
- Security before Launch: `window.__TEST__` hook (src/main.js, `?test`) must be stripped from
  release builds (release-engineer; release-reviewer to check).
- Balance risks flagged for later (stage_005 hard for starters, Riposte/Tri-Burst numbers)
  — balance-analyst. Sim: battles ~56 s vs GDD 120–200 s; starters win stage_004 ~3%,
  stage_005 0%.

## Owner feedback
Write anything you liked or disliked here, in your own words. Every line becomes a
lesson and a hard rule at the next `/retro`.
- Round 3 (owner, on `/round`): "and you decide all that" — the owner delegates the open
  decisions (title choice and the designer's open questions) to the Producer.
- Round 3 (owner): "You decide all that i want to automate this as much as possible" — the
  Producer makes every routine decision without asking, and chains rounds automatically
  (schedules the next `/round` when a round ends; resumes after usage-limit resets). Stop and
  ask the owner only for the things in CLAUDE.md §8 (keystore, Play Console, paid assets,
  playtest) or a blocker the rules forbid deciding.

## Decisions made without the owner
- Round 3 (delegated by owner): working title **Jade Tempest** — ties into the game's Jade
  currency and storm-of-power tone. Trademark check by compliance-checker before release.
- Round 3 (delegated by owner): kept the round-1 defaults — stage_005 boss at the hardest AI
  tier (balance-analyst tunes stats so starters can win with skill); a timeout tie / double KO
  stays a Draw; no left-handed layout in this milestone.
- Round 1: kept game-designer defaults for its open questions: stage_005 boss uses the
  hardest AI tier; timeout tie / double KO = Draw (no rewards); no left-handed mirrored
  layout in this milestone. Owner can override any of these.
- Round 1: game-designer has no shell, so the Producer validates every schema change with
  Draft 2020-12 `check_schema` and re-validates data (chosen over widening its tools).
- Round 2: Phaser pinned to 3.90.0 (latest 3.x) per CLAUDE.md, although Phaser 4 exists.
- Round 2: accepted `tests/ui/` as ui-developer's; applied team-coach ownership corrections to 8
  playbooks (gameplay-programmer owns package.json/scripts/validator; release-engineer only its
  cap:*/android:* scripts; economy-designer/balance-analyst own their data files from Growth).

---

## Round log

### Round 3 — Summon screen + balance (plan)
- **Goal:** complete the milestone's features (summon screen) and start Growth (balance),
  clear round-2 leftovers, then QA. Retro includes the playbook upgrade (round 3 = step C).
- **Agents and order:**
  1. In parallel: game-designer (title in GDD §1, AC-5.8.5 ruling, AC-5.6.1/5.6.2 example
     fix, tutorial prompt cap §9.4); gameplay-programmer (GDD §11 summon logic + save);
     balance-analyst (sims, propose and apply stat-only data changes for battle length and
     stage difficulty).
  2. ui-developer: summon screen with rates and pity shown, BUG-2-11, screenshot env flag,
     Tri-Burst locked look, title string.
  3. qa-tester loop (≤5). 4. team-coach retro with step C.

### Round 2 — Build (result)
- **Result:** first playable build. npm project (Phaser 3.90, Vite, Vitest, Ajv, Playwright);
  `npm run validate-data` (schema + §15.3 rules 1–9 + §3 banned terms, 38 negative fixtures);
  deterministic battle engine for all of GDD §5 incl. AI tiers; save/missions with repair on
  load; headless sim; portrait Phaser UI Title → Home → Story → Team → Battle (+ stage_001
  tutorial) → Result. Summon screen not built yet (disabled button). 215 unit tests, 30 e2e.
- **QA:** 2 loops. Loop 1 FAIL (4 major, 4 minor, 1 polish; Producer found 1 more). Loop 2 PASS:
  10/10 verified fixed, 560 bot battles 0 failures, 1 new minor (BUG-2-11).
- **GDD:** game-designer ruled BUG-2-08 (Tri-Burst can't be cancelled), adopted 11/12 programmer
  decisions, banned "Spark" in names (renamed to Cinder Jab, Qualifier: Gatecrasher).
- **Verdict:** none (milestone not feature-complete; no release review yet).
- **Interruptions:** usage limit hit once; two agents resumed after reset.
- **Retro:** 8 new lessons, 4 repeats; 13 hard rules promoted across 6 agents (nothing loosened —
  only "none yet" placeholders removed). Ownership lists corrected.
- **Next:** Round 3 — (a) summon screen: gameplay-programmer builds GDD §11 rolls/pity/duplicates
  in logic, ui-developer builds the summon screen with rates shown; (b) ui-developer fixes
  BUG-2-11, screenshot env flag, Tri-Burst locked look; game-designer rules on AC-5.8.5 and the
  tutorial cap; (c) Growth starts: balance-analyst simulates and proposes stat changes for
  battle length and stage_004/005 difficulty; then QA loop. Round 3 retro includes the playbook
  upgrade (step C).

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
