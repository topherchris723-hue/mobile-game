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
Seen: 5 (round 2: BUG-2-06, BUG-2-09, BUG-2-10, BUG-2-11; round 3: BUG-3-03)
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
Status: PROMOTED (round 2); merged into playbook "Layout self-check" (round 3 step C)

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
Seen: 1 (round 3)
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
Status: ACTIVE; in playbook main text as a security rule (round 3 step C)
