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
Seen: 1 (round 2)
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
Status: ACTIVE; merged into playbook "What you test" (round 3 step C)

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

### L-qa-005: Judge performance by an alternating comparison with the parent commit, not one absolute run
Seen: 1 (round 5)
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
Status: PROMOTED (round 5, adopted by the Producer)

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
