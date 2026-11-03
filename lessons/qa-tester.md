# Lessons — qa-tester

Read this before every task. Maintained by team-coach. Format: see lessons/README.md.

### L-qa-001: Run the GDD §3 banned-term grep on every build
Seen: 1 (round 1)
Severity of what it caused: MINOR (caught by content-designer in round 1, not yet by QA)
What happened: Round 1 notes item 4 — "Stand" (a franchise power name) appeared in two fighter
  shouts and was caught only by content-designer's own scan. GDD §3 says "QA should grep the data
  for these", but no QA check exists yet.
Root cause: The banned-term check depends on each author remembering it; there is no independent,
  repeatable check owned by QA.
Rule: Every QA round, build the term list fresh from GDD §3 and grep `data/`, `src/` and any store
  text case-insensitively. Exact franchise terms = MAJOR bug. Context-dependent words ("Stand",
  "Hollow") = review each hit by hand and file only power/form/mechanic uses. Paste the command and
  hit count in the QA report. Prove the grep works by first running it on a test string that
  contains a banned term (L-shared-006).
  Rounds 2–3: followed every round (0 hits, with a negative proof each time).
Status: ACTIVE; merged into playbook "What you test" (round 3 step C)


### L-qa-002: Scan live, busy battle frames for layout bugs, not only screens at rest
Seen: 3 (round 2; round 7: BUG-7b-01 — the ~120 ms sampled scan missed a 160 ms combo pop, so the
  `d09623e` re-check gave a false PASS (caught in 2 of 7 runs); reviewer R-1 — the scan never ran in the
  stage_001 tutorial, where the prompt box covers the enemy combo counter)
Severity of what it caused: MINOR (BUG-2-10 escaped QA loop 1; the Producer found it from one screenshot)
What happened: BUG-2-10 — floating damage texts overlapped shouts and name labels during fights.
  QA loop 1's layout scan only captured screens at rest, so it missed the bug. In loop 2 QA added
  `qa-busy.spec.js` (live frames, stage_003 long names), which caught it and the related BUG-2-11.
Root cause: The QA layout check sampled static screens with stage_001's short names, never the busy
  middle of a fight where most text appears at once.
Rule: Every QA round with battle UI, run a live-frame scan: a bot-driven fight using the longest
  fighter names in data, sampling real rendered Text bounds several times a second for ≥ 20 s per
  screen size (360×640, 390×844, 430×932), checking text-vs-text and text-vs-screen-edge. Also scan
  every screen for raw `[key]` strings. Prove the scan fails with the placer disabled (L-shared-006)
  and paste the counts in the report.
  Round 3: worked. QA found BUG-3-03 itself, and BUG-2-11 is verified fixed with the longest names.
  Round 7 widening: "several times a second" is too coarse for tweens shorter than the sample gap.
  Sample every rendered frame (hook `postrender`). Scan the overlay states too: the stage_001 tutorial
  prompts, the intro banner and the cinematics, besides the stage_005 busy fight. A pair is exempt from
  the overlap check only if a GDD rule or a Producer decision recorded in `docs/STATUS.md` names that
  pair. List every exemption in the report with that source. No exemption for a pop or tween growing
  past its reserve.
Status: ACTIVE; merged into playbook "What you test" (round 3 step C); PROMOTED (round 7)

### L-qa-003: Tests that drive one side through hooks must switch that side's AI off and assert the precondition
Seen: 1 (round 3)
Severity of what it caused: MINOR (QA's own test defect; flaky after an engine fix)
What happened: Round 3 loop 2 — `qa-tribust-lock.spec.js` started the enemy's rush with
  `applyInput('enemy', …)` while the enemy AI was still running and never checked that the rush
  started. After the BUG-3-02 fix, the AI was sometimes committed to a Slip, no rush started, and the
  test failed 2 of 3 times.
Root cause: The test assumed its setup worked instead of asserting it. Two controllers (the test and
  the AI) drove the same side, and a single green run was taken as proof.
Rule: In every test that drives a side through hooks: switch that side's AI off (or prove it cannot
  act), wait for and assert the precondition (e.g. the rush actually started) before asserting the
  behaviour, and run every timing-sensitive e2e spec 3 times before reporting PASS.
Status: ACTIVE; in playbook main text (round 3 step C)

### L-qa-004: Measure the rates the GDD promises; invariants alone do not catch wrong behaviour
Seen: 1 (round 3, BUG-3-01 escaped round-2 QA)
Severity of what it caused: MAJOR (escape; found by the balance-analyst)
What happened: Round 2 QA ran 560 bot battles that checked invariants (HP, Vigor, timers, determinism)
  and passed. The AI re-rolled its slip every tick the whole time (BUG-3-01). The balance-analyst
  found it in round 3 by measuring slip shares.
Root cause: The bot playthrough checks that nothing breaks, not that behaviour matches the data. No QA
  check compared a measured rate with a `*_chance` value.
Rule: See L-shared-010 (qa part). Every round that changes AI, RNG or rate data, run
  `tests/sim/ai-slip-rate.mjs`-style rate checks per tier for every `*_chance` in `data/battle.json`
  and `data/banners.json` (summon rates too), with a negative proof. List any rate in data with no rate
  check as "NOT VERIFIED".
Status: PROMOTED (round 3, as part of L-shared-010); in playbook "What you test" item 8

### L-qa-005: Judge performance by an alternating comparison with the parent commit AND the absolute limit
Seen: 2 (rounds 5, 6: reviewer R-2 — the absolute check failed while QA reported "no regression")
Severity of what it caused: MINOR (AC-17.7 could not be judged; adopted as a Producer decision)
What happened: Round 5 — on the shared container, the round-4 code measured 28.9–35.7 ms frame-time p95
  on different days, so one run against the 33.3 ms limit could not tell a regression from noise. QA
  ran an alternating 14-run comparison with the parent commit: no regression. The Producer adopted
  the method as a regression gate (docs/STATUS.md, round-5 decision) and kept the absolute limit.
Root cause: An absolute single-run threshold on noisy shared hardware is not a reliable check.
Rule: Every round, run the perf spec alternating ≥ 6 runs each of this build and the previous round's
  commit. FAIL if mean frame-time p95 or game-work p95 rises by more than 1.0 ms. Report game-work p95
  next to frame-time p95. Keep the absolute 33.3 ms p95 check, reported as NOT VERIFIED on the shared
  container until it runs on a real low-end Android phone or a quiet runner (median of ≥ 5).
  Round 6 correction (stricter; the round-5 wording let a failing check pass — see L-shared-021, L-tc-003):
  the regression gate is an extra check and never replaces the absolute limit. Run the absolute check
  every round with the method fixed in advance (≥ 5 runs at 4× CPU, median p95). If it is over 33.3 ms,
  file a bug and QA is FAIL. NOT VERIFIED is allowed only for real-device/WebGL numbers this container
  cannot produce.
Status: PROMOTED (round 5); rule tightened (round 6)

### L-qa-006: Keep the evidence that explains a failure
Seen: 2 (round 5: intermittent e2e failure lost its cause; 400 ms screenshot wait missed a 420 ms animation)
Severity of what it caused: MINOR (lost diagnosis; missed evidence)
What happened: Round-5 notes — the summary grep printed metrics only, so the cause of one
  intermittent e2e failure was lost. Screenshot helpers waited a fixed 400 ms and missed short
  animations (the 420 ms orb).
Root cause: Output and capture timing were set for the passing case, not for diagnosing a failure.
Rule: Always print the failing assertion and its values (not only the metrics). Capture animation
  frames at times computed from the effect's data (start + duration fractions), never a fixed wait.
Status: PROMOTED (round 5)

### L-qa-007: Before a QA PASS, run the full suite on the exact commit; derive expected counts from source
Seen: 1 (round 6: reviewer R-5)
Severity of what it caused: MINOR (reviewer finding)
What happened: R-5 — `qa-settings-audio.spec.js` hardcoded 13 Settings targets. The Licenses button made
  it 14, the spec failed, and the full Playwright suite had not been run on the reviewed commit.
Root cause: Count literals in specs, and QA PASS based on targeted specs, not the whole suite on HEAD.
Rule: Every QA PASS names the commit and includes a green `npm test` and full `npx playwright test` on
  it. Count-based assertions derive the expected count from the source list (strings/targets), not a
  literal.
Status: ACTIVE

### L-qa-008: Build the release-bundle hook list from source on every run, never by hand
Seen: 2 (round 7: BUG-7c-02 escape — `disableComboZones` shipped ungated since round 4 while QA's
  hand-written list passed in rounds 4–7b; QA 7d BUG-7d-02 — the project test's derivation only matched
  `sc.<name> =`)
Severity of what it caused: MINOR (security-relevant rule broken for 3 rounds)
What happened: QA's check 10 grepped `dist/` for a list of hook names typed into the spec. A scene switch
  that specs set directly was never on the list. QA found it in 7c only after deriving the list from the
  specs. In 7d, the new project test still depended on the `sc.` handle name.
Root cause: A check whose list is written by hand only finds what its author remembered. A
  "derivation" that matches one naming habit is still a hand list.
Rule: Every run, build the hook/switch list from source: every key exposed in `src/ui/test-hooks.js`
  plus every `<obj>.<prop> =` assignment in `tests/` whose property `src/` never assigns, whatever the
  handle name. Expect 0 hits in a clean `npm run build` and > 0 with `VITE_TEST_HOOKS=1`. Prove the
  derivation by planting an ungated switch in a scratch copy, set through a handle name no current spec
  uses; the check must FAIL on it. Paste the list size and the plant's FAIL output.
Status: PROMOTED (round 7)

### L-qa-009: A layout fix is proven only by forcing its geometry; a natural scan is extra coverage
Seen: 2 (round 7: QA 7c — the per-frame natural scan with the clamp disabled found 0 overlaps; QA 7d —
  the natural fight never emitted a 2-line shout, so the BUG-7c-01 live scan's must-FAIL passed)
Severity of what it caused: MINOR (near miss: two re-tests would have "passed" with no proof)
What happened: In both loops QA noticed that its natural-play scan could not reach the bug's
  conditions, so a passing scan said nothing about the fix. Only forced injections through the real
  code paths (`spawnFloat` next to the zone, then `popCombo`; direct `shout()` of every string) failed
  on the old code.
Root cause: A re-test was judged by whether the scan passed, not by whether the bug's preconditions
  occurred during it.
Rule: Every layout or timing re-test (1) forces the bug's geometry or order through the real code path,
  (2) prints the precondition count (e.g. "texts inside the unclamped reach: 87"; "2-line shouts
  requested: 66") and asserts it is above a minimum fixed in advance, and (3) runs the must-FAIL with the
  fix disabled, which must FAIL. If the must-FAIL passes, the re-test is not evidence and the bug stays
  open. Natural scans run as well, as extra coverage.
Status: PROMOTED (round 7)

### L-qa-010: Count texts requested vs shown, and check each text sits by its owner
Seen: 2 (round 7: BUG-7c-01 — 2-line shouts silently dropped at 360×640 since round 2/3, invisible to
  every overlap scan; BUG-7d-01 — the one-line fallback shout often sits over the other fighter)
Severity of what it caused: MINOR (content missing at the minimum supported size for ~5 rounds)
What happened: Overlap scans look only at texts on screen, so a text the placer never shows passes
  every scan. Once drops were fixed, the next gap was attribution: a shout drawn nearer the other
  fighter.
Root cause: QA checked how shown texts were placed, never whether the requested texts were shown, or
  shown next to the right speaker.
Rule: For every player-facing text the placer can skip (shouts, callouts, damage numbers), count
  requested vs shown per size over every distinct string in `data/` and `strings.json` at 360×640,
  390×844 and 430×932. A text that can never be shown at a supported size is a bug. For fighter-owned
  text, also record the share drawn nearer its owner than the other fighter, next to the same share in
  the approved round-3 layout.
Status: PROMOTED (round 7)
