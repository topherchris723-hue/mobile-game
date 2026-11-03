# Lessons — ui-developer

Read this before every task. Maintained by team-coach. Format: see lessons/README.md.
(Round 3: this file was restored. The round-2 retro emptied it by mistake (see L-tc-002); the
hard rules for L-ui-001 and L-ui-003 were in the playbook throughout.)

### L-ui-001: Every tutorial prompt must stay possible, or end by itself
Seen: 2 (round 2: BUG-2-01, BUG-2-02)
Severity of what it caused: MAJOR
What happened: BUG-2-01 — the Riposte prompt only completed on a `riposte` event; after a Tag or KO
  closed the window, the prompt and 0.3× slow-mo stayed for the rest of the battle. BUG-2-02 — the
  `ignition_ready` trigger fired for a benched fighter, with no IGNITE button, and held 0.3×.
Root cause: Tutorial steps were written for the happy path only: no "still possible" check, no time
  cap, and triggers did not check that the event was for the player's active fighter.
Rule: Every tutorial/prompt step has (1) a per-tick "still possible" check that ends the step and
  releases any held window or slow-mo, (2) a maximum shown time from data, and (3) triggers that
  check side and slot are the player's active fighter. One test per step makes the action impossible
  and asserts the prompt and slow-mo are gone within one tick.
  Round 3: worked. AC-9.4.3–9.4.7 passed and QA Scenario C confirmed the 20 s cap.
Status: PROMOTED (round 2); merged into playbook "Standards" (round 3 step C)

### L-ui-002: Never put a destructive confirm where the opening tap landed; arm new menus
Seen: 1 (round 2)
Severity of what it caused: MAJOR
What happened: BUG-2-03 — "Yes, retreat" was drawn where "Retreat" was, and new menu buttons took
  input at once, so a double tap ended the battle as a loss without the confirm dialog.
Root cause: The confirm dialog reused the previous menu's button slots, and new menus had no input arm
  delay. No test double-tapped a menu button.
Rule: On every confirm dialog, the destructive button is never under the button that opened it (put
  Cancel there). Every newly shown menu ignores input for its arm time (≥ 250 ms). Add a double-tap e2e
  test for every button that opens a dialog.
  Round 3: followed. The summon Confirm is placed mid-screen and AC-11.12 passed.
Status: ACTIVE; merged into playbook "Standards" (round 3 step C)

### L-ui-003: Test text layout with the longest strings, the worst positions and live busy frames; register every text in the placer
Seen: 6 (round 2: BUG-2-06, BUG-2-09, BUG-2-10, BUG-2-11; round 3: BUG-3-03; round 7: reviewer R-1 —
  the enemy "COMBO xN" rest position sits under the stage_001 tutorial prompt box, up to 65% covered.
  Same class in round 7, own root causes: BUG-7b-01 → L-ui-010, BUG-7c-01 → L-ui-011)
Severity of what it caused: MINOR (2-06, 2-10, 2-11, 3-03), POLISH (2-09)
What happened: Round 2 — four overlap/clipping bugs: Story list, intro shout, floating texts, and name
  labels at melee range or at the wall. Round 3 — BUG-3-03: "RIPOSTE!" was drawn over the combo
  counter ("2 HITS"). The counter is drawn at a fixed spot and was never registered as an avoid
  rectangle in the float placer. It only showed once the BUG-3-02 fix made Ripostes frequent.
Root cause: Layouts were checked with short strings, in quiet frames, in the middle of the arena. In
  round 3 the placer was the single authority for *floating* text, but fixed-position texts that share
  the arena (combo counter) were outside it, so the placer could not avoid them.
Rule: Every layout check uses the longest strings from `data/` and `strings.json` at 360×640, in the
  worst positions (melee range, both walls, all floats at once in a busy live fight), checking
  text-vs-text and text-vs-screen-edge. Every text drawn in the arena band, floating OR fixed (combo
  counter, timer, callouts, labels), is either placed by the placer or registered as an avoid
  rectangle while visible. Keep a list of registered texts in `src/ui/float-placer.js` and check it
  when adding any text. Clamp sprites and labels to [halfWidth, W − halfWidth].
  Round 7 widening (R-1): overlays are arena elements too. Check every fixed HUD text (combo and hit
  counters, timer, labels) at its rest position against every overlay that can be visible at the same
  time (tutorial prompt box, intro banner, Climax/Tri-Burst cinematic), at 360×640 and 390×844, with a
  must-FAIL case. The rest positions move below the box while it is shown, or the box is registered.
Status: PROMOTED (round 2); merged into playbook "Layout self-check" (round 3 step C); re-promoted with
  the overlay widening (round 7)

### L-ui-004: Run e2e tests against a fresh build of the code you just changed
Seen: 1 (round 2)
Severity of what it caused: MINOR (near miss)
What happened: Round-2 notes — e2e runs could reuse an already running server, so tests could pass
  against an old build.
Root cause: The Playwright config allowed reusing whatever server was already on the port.
Rule: Keep `reuseExistingServer: false`, start servers you can stop by PID, and report the commit
  hash or `git diff --stat` the e2e run used.
Status: ACTIVE

### L-ui-005: Release builds contain no test hooks
Seen: 3 (rounds 3, 4: the round-3 gate still enabled hooks in development mode; caught by re-reading
  the upgraded playbook; round 7: BUG-7c-02 — the negative-proof switch `disableComboZones`, added in
  round 4 before the stricter gate, shipped ungated in the release bundle for 3 rounds)
Severity of what it caused: MINOR (caught by ui-developer; security-relevant)
What happened: Round-3 notes — gating `window.__TEST__` on Vite's DEV flag was not enough: under
  Vitest/NODE_ENV=test DEV was true, and the round-2 hook was enabled by a `?test` URL parameter in
  every build. Fixed in round 3 with an explicit `VITE_TEST_HOOKS` flag and
  `tests/ui/release-bundle.test.js`.
Root cause: Hook gating relied on an environment default whose value differs between tools, and
  nothing checked the built bundle.
Rule: Test hooks are compiled in only when `VITE_TEST_HOOKS=1` is set explicitly (never on DEV, MODE
  or a URL parameter). After every change to hooks or build config, run a clean `npm run build` and
  grep `dist/` for every hook name (expect 0), then do the same with the flag on (expect > 0). Never
  delete or weaken `tests/ui/release-bundle.test.js`.
  Round 4: also pin the exact gate expression in a unit test, so any loosening fails.
  Round 7 widening (BUG-7c-02): the hook gate covered `window.__TEST__`, but scene switches that specs
  set directly (`sc.disableComboZones = true`) were outside it, and `release-bundle.test.js` used a
  hand-written name list. Every test-only or negative-proof switch is written as
  `TEST_HOOKS && this.<switch>`. The release-bundle test derives the switch list from source: every
  `<obj>.<prop> =` assignment in `tests/` that `src/` never writes, whatever the handle name (BUG-7d-02:
  the first fix only matched `sc.`). Prove it with a planted ungated switch set through a new handle name.
Status: PROMOTED (round 4); also in playbook main text; re-promoted with the derived-list widening
  (round 7)

### L-ui-006: Start "within N ms" transitions in the frame the event is handled, with one frame of margin
Seen: 1 (round 4: BUG-4-01)
Severity of what it caused: MINOR
What happened: BUG-4-01 — the Tri-Burst overlay was still visible 167 ms after `freeze_end` (AC-17.8
  limit 160 ms) because the fade started one frame late.
Root cause: The fade was scheduled for the next frame and its length used the whole limit, with no
  frame of margin.
Rule: For every AC with a time limit, start the transition in the same frame the event is handled,
  and make it at least one frame (17 ms) shorter than the limit. The test measures from the event
  timestamp.
Status: ACTIVE

### L-ui-007: Every drawing change stays inside the absolute frame budget, not only "no regression"
Seen: 2 (round 5: new layers raised Canvas cost; round 6: reviewer R-2 — AC-17.7 failed 3/3 at 4× CPU)
Severity of what it caused: MINOR (near miss; new visual layers cost Canvas frame budget)
What happened: Round-5 notes — the new placeholder-art layers raised Canvas frame cost. The
  ui-developer baked fighter bodies into textures to recover it.
Root cause: Drawing changes were added without a frame-cost comparison.
Rule: For every change that adds or changes drawing, run the perf spec ≥ 3 times, alternating with
  the parent commit, and report the frame-time and game-work p95 change (L-qa-005 method). Round 6:
  also run the absolute AC-17.7 check (median p95 of ≥ 5 runs at 4× CPU, Canvas ≤ 33.3 ms). A change
  that pushes it over the limit is not finished (L-shared-021).
Status: PROMOTED (round 6)

### L-ui-008: Reveals never show values ahead of what has been revealed
Seen: 1 (round 6: reviewer R-6 POLISH)
Severity of what it caused: POLISH
What happened: R-6 — the summon reveal showed the final Jade balance at pull 2, giving away duplicates
  revealed later.
Root cause: The HUD read the final save state instead of a state that advances with the reveal.
Rule: During any reveal or animation sequence, every counter shown advances step by step with the
  reveal. Add one test that checks the counter at step 1 of N.
Status: ACTIVE

### L-ui-009: Rows keep the style-guide spacing, not only the 8 px minimum
Seen: 1 (round 6: reviewer R-8 POLISH)
Severity of what it caused: POLISH
What happened: R-8 — the Settings volume rows met the 8 px target gap but looked cramped: each label sat
  right under the previous row's −/+ buttons.
Root cause: Layout was checked only against the hard minimum, not against the style guide's row rhythm.
Rule: Every list/settings row uses the `docs/STYLE_GUIDE.md` row spacing. Look at the 360×640
  screenshot of every changed screen and note "spacing per style guide: yes/no".
Status: ACTIVE

### L-ui-010: Size every reserved zone for the peak frame of every tween on its text
Seen: 1 (round 7: BUG-7b-01)
Severity of what it caused: MINOR (pre-existing since the pop was added; escaped QA once, L-qa-002)
What happened: BUG-7b-01 — `measureComboZones()` measured "COMBO x99" at scale 1, but `popCombo` tweens
  the counter from 1.5× to 1× over 160 ms. During the pop the counter grew past its reserve and covered a
  shout placed legally next to the zone ("COMBO x2" × "NOONDAY HALO!").
Root cause: The avoid rectangle was measured at rest, and every layout test sampled frames after the
  tween had settled. No test froze the tween's first frame.
Rule: Any arena text that tweens scale or position reserves (or clamps to) its bounds at the tween's
  peak, not at rest. Each such text has a peak-frame test: freeze the tween at t = 0 and assert no
  overlap, with a must-FAIL run that disables the clamp or reserve.
Status: PROMOTED (round 7, inside the re-promoted L-ui-003 class rule: 7th overlap-class bug)

### L-ui-011: The placer must never drop a player-facing text silently
Seen: 1 (round 7: BUG-7c-01)
Severity of what it caused: MINOR (pre-existing since round 2/3)
What happened: BUG-7c-01 — at 360×640 every shout that wraps to 2 lines (33 of 92) was dropped: the
  104 px upper band next to the combo zones has no free row tall enough. 10 Climax card shouts and 3
  tag-in shouts never showed. While fixing BUG-7b-01, ui-developer noted that reserving a bigger zone
  would have dropped even more.
Root cause: The placer skips a priority-1 text that does not fit, with no fallback and no log. Overlap
  tests look only at texts that are shown, so a dropped text looks like a pass. Zone sizes were changed
  without measuring the space they leave for other texts.
Rule: Every text the placer can skip has a fallback (one-line form, smaller size or ellipsis) and a
  requested-vs-shown test. Over every distinct string in `data/` and `strings.json` at 360×640, both
  sides, it asserts shown = requested, with a must-FAIL run. Before enlarging any reserved zone, measure
  the free band height left for the longest text it shares the band with, and put both numbers in the
  report.
Status: PROMOTED (round 7, inside the re-promoted L-ui-003 class rule)

### L-ui-012: Check that every test your playbook requires exists, by searching for it
Seen: 1 (round 7, ui-developer self-report)
Severity of what it caused: MINOR (near miss, reported by ui-developer)
What happened: Round 7 — in its lesson candidates, ui-developer reported that it had to search to find
  whether tests its playbook requires really exist, which earlier self-checks had not done.
Root cause: Self-checks were answered from memory of what "should" exist, not by locating the test.
Rule: In the report's self-check, list each test the playbook requires with its file and test name,
  found by `grep -rn "<name>" tests/`. A required test that is not found is written as "MISSING" and is
  added in the same task.
Status: ACTIVE
