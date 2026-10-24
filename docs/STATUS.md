# Project Status

Maintained by the Producer (main Claude Code session). Newest round at the top.

## Current state
- **Phase:** Growth — polish nearly done (VFX, audio, settings in). Next: round 5 leftovers + placeholder art, then Launch
- **Round:** 4
- **Core battle loop passed QA:** yes (round 2, QA loop 2: 0 blocker / 0 major)
- **Last release verdict:** none
- **Unity port started:** no

## Producer standing rules (from owner feedback, round 3 — read every round)
- Decide routine and open questions yourself; log them under "Decisions made without the
  owner". Ask the owner only about CLAUDE.md §8 items or a BLOCKER the rules forbid deciding.
- Chain rounds automatically: when a round ends, schedule the next `/round`; after a usage-limit
  stop, resume from the last WIP commit and this file. Automation never removes a gate (§7
  irreversible-action ban, release-reviewer PASS, tests, safety/licensing/privacy/IP/security).
- Build a GDD section only after the game-designer has committed it READY; never run designer
  and programmer in parallel on the same section; later changes are numbered rulings forwarded
  to every affected agent.
- Parallel agents: no `git stash`/`reset`/`checkout`/`restore`/`clean` on files they don't own;
  stage each agent's owned paths separately so commit labels match contents.
- Keep the core feel the owner approved after the round-3 playtest (controls, per-second battle
  pace, hit feedback, HUD layout); any change to it is named in the round plan with a reason.
- Release builds contain no test hooks (only with `VITE_TEST_HOOKS=1`); QA and release-reviewer
  grep `dist/` for hook names.
- Before a section is built, gameplay-programmer runs a "READY review" (works W-class ACs on
  FX-GDD, checks reachability and preconditions) and returns defects to the game-designer.
- Quote GDD values, paths and licence terms exactly in prompts; when a path differs from the GDD,
  list every script/test that reads it in the same hand-off.
- Plan each round to fit about one usage window: one feature goal plus fixes; move extras on.
  Never shorten a round by skipping a check, QA or the review gate.
- After each round, republish the private playtest build:
  https://claude.ai/artifact/Mhc2SgVEgtoxFb5nHeqjXh

## Open issues
- Owner to pick a working title (GDD §1): Jade Tempest, Meridian Burst, Heavenbreak,
  Thunderclap Trio, Ironroar. Trademark check by compliance-checker before release.
- BUG-4-01 (MINOR, ui-developer): Tri-Burst overlay visible 167 ms after freeze_end (limit 160).
- BUG-4-02 (MINOR): GDD §9.2 and docs/ECONOMY.md still show old repeat-clear Jade (data is
  10/20/45/50/75) — game-designer (prefer §9.2 referencing ECONOMY.md), economy-designer.
- GDD §17/§18 say src/ui/vfx|audio; code is src/vfx and src/audio — game-designer aligns GDD.
- Placeholder-art plan items 1–3, 7–8 (STYLE_GUIDE §11) deferred from round 4.
- Real low-end Android perf check needed (AC-17.7 margin < 1 ms at 4× throttle; WebGL unmeasured).
- Trademark check for "Jade Tempest" pending (compliance-checker, Launch).

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
- Round 3 (owner, after first phone playtest of the private web build): "Bro im linking it its
  good" — the owner likes the current build. Keep the core feel; changes should build on it.

## Decisions made without the owner
- Round 3 (delegated by owner): working title **Jade Tempest** — ties into the game's Jade
  currency and storm-of-power tone. Trademark check by compliance-checker before release.
- Round 4: keep system fonts (no font files); OFL fonts are not on the CREDITS.md allowed list
  and a font swap would change the approved feel. Revisit only with owner approval.
- Round 4: VFX code lives in `src/vfx/` and audio in `src/audio/` (agents' playbook lanes), not
  `src/ui/vfx|audio` as GDD §17/§18 consumer notes say; ui-developer wires them in. GDD to align.
- Round 4: economy review passed fairness with no data change. Adopted its proposal to make
  stage_001 a worse Jade farm than later stages (repeat-clear Jade stage_001 30 → 10, stage_002
  30 → 20; first-time budget unchanged) — content-designer, wave 2. Then, so skilled Jade/min
  rises every stage, stage_003 40 → 45 and stage_005 60 → 75 (final: 10/20/45/50/75). Its displayed-vs-real rate
  check becomes a permanent test (gameplay-programmer); tests that hardcode live economy numbers
  get fixed (gameplay-programmer, qa-tester).
- Round 3: game-designer doubled all HP (battle target 120–200 s kept; "fast" = feel per
  second, not short fights). balance-analyst may edit `data/economy.json` power_formula this
  round (economy-designer not active yet).
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

### Round 4 — Growth polish (result)
- **Result:** style guide + 8 art briefs; economy review (fair, no data change) and repeat-clear
  Jade 10/20/45/50/75 so harder stages pay more per minute; GDD §17 VFX, §18 Audio, §19 Settings;
  procedural audio (46 SFX hooks, 5 original music loops, ducking, gesture unlock); VFX layer
  (101 effects, flash/shake limiters, particle budget, reduce motion); Settings screen; settings
  save repair; validator rules 13–15; BUG-3-03 fixed; release builds hook-free (stricter gate).
- **QA:** 1 loop, PASS (0/0/2 minor). 542 unit tests, 73 e2e.
- **Owner:** asked about speed ("4 resets") and the Unity stage; Producer trimmed placeholder art
  to round 5 and republished the playtest before QA.
- **Interruptions:** usage limit hit twice (vfx-developer, retro).
- **Retro:** 4 new lessons, 5 repeats, promotions to ui-developer, qa-tester, audio-designer,
  vfx-developer and Producer rules (above). Ownership lists corrected. No rule loosened.
- **Next:** Round 5 — leftovers (BUG-4-01, BUG-4-02, GDD path alignment), placeholder-art items
  (distinct fighter silhouettes, prop colours, Umbral rendering, mirror-match shadow, rarity
  frames), QA, retro (step C at round 6). Then Launch: compliance-checker, release-reviewer,
  release-engineer (APK/AAB), owner playtest.

### Round 4 — Growth polish (plan)
- **Goal:** make it look, sound and feel like the brief ("fast, flashy, powerful", big
  transformation moments) without changing the approved feel (controls, per-second pace, HUD
  layout); review economy fairness; fix BUG-3-03; then QA.
- **Wave 0 (parallel):** game-designer — GDD sections + schemas for VFX (data/vfx.json) and audio
  (data/audio.json), settings (volume/mute), §15.1 owner note; art-director — docs/STYLE_GUIDE.md
  + placeholder-art briefs for 8 fighters; economy-designer — docs/ECONOMY.md fairness review of
  Jade sources/sinks, summon pacing (data changes only if needed).
- **Wave 1 (parallel, after READY):** vfx-developer (src/vfx, data/vfx.json), audio-designer
  (src/audio, data/audio.json, only CC0/self-made sounds — procedural Web Audio preferred).
- **Wave 2:** ui-developer integrates VFX/audio hooks + settings screen, BUG-3-03, save-repair
  notice. Then qa-tester loop, retro.

### Round 3 — Summon screen + balance (result)
- **Result:** milestone features complete. Summon screen (rates, pity, first-×10 guarantee,
  atomic save before reveal, reveal + results), title Jade Tempest, BUG-2-11 fixed, TRI-BURST
  states, test hooks gated out of release builds. GDD: §11 fully specified, FX-GDD fixture + AC
  classes, rush invulnerability, AI one-decision rule, validator rules 10–12. Balance (Growth
  start): HP ×2, retune — battles 2.3–2.6 min on stages 3–5, stage_005 average/skilled proxies
  18%/69%, mirrors 43–59%, Tri-Burst 26–37% of enemy HP, all missions reachable.
- **Bugs:** BUG-3-01 (AI re-rolled slip every tick; found by balance-analyst) and BUG-3-02 (planned
  slips lost; found by QA) fixed; 381 unit tests, 45 e2e.
- **QA:** 2 loops. Loop 1 FAIL (1 major), loop 2 PASS (0/0/1 minor BUG-3-03).
- **Verdict:** none yet (Launch phase not started).
- **Owner:** delegated decisions, asked for maximum automation, playtested on phone: "its good".
- **Interruptions:** usage limit hit 3 times; resumed each time from WIP commits.
- **Retro (step C):** 16 new lessons + 5 restored (round-2 retro had truncated two lesson files);
  promotions across 9 agents; playbook rewrites for ui-developer, gameplay-programmer/qa-tester,
  game-designer; METRICS filled for rounds 1–3. No rule loosened (diff checked). Coach's CLAUDE.md
  proposals recorded as "Producer standing rules" above.
- **Next:** Round 4 — Growth polish: art-director (style guide + placeholder-art briefs),
  vfx-developer (super attacks, hit sparks, summon reveal), audio-designer (licensed SFX/music,
  volume/mute), economy-designer (review Jade economy, fairness), ui-developer BUG-3-03 + save
  warning notice, game-designer §15.1 owner note; QA loop; retro. Then Launch rounds:
  compliance-checker, release-reviewer, release-engineer (APK/AAB).

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
