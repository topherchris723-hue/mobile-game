# Round 5 — Producer notes (input for /retro; A+B; step C is round 6)

Leftovers + placeholder art. QA loops: 1 → PASS, 0 bugs. BUG-4-01 and BUG-4-02 verified fixed.

## Findings
- Perf AC-17.7: a single-run absolute frame-time limit on a shared container can't tell a
  regression from noise (round-4 code measured 28.9–35.7 ms p95 on different days). QA did an
  alternating 14-run comparison: no regression. Producer added a regression gate (stricter,
  additive) and kept the absolute limit.
- Agents again flagged Producer-owned STATUS text as possibly stale (it was already correct).
- qa-helpers.js still hardcoded round-4 at round start (L-shared-017 hard rule applied on first run).
- One intermittent e2e failure lost its cause because the summary grep printed metrics only.
- Screenshot helpers waiting 400 ms miss short animations (420 ms orb).
- New visual layers cost Canvas frame budget; ui-developer baked bodies into textures.
- The GDD now points to ECONOMY.md for tunable numbers (stale-doc class closed by design).
- Usage limit hit 0 times this round (worker restarted once; no agent lost work).

## Agent lesson candidates
- game-designer: GDD states intent and points to the owning doc for tunable numbers.
- economy-designer: automate the Jade/min non-decreasing check (QA added tests/sim/doc-data-sync.mjs).
- ui-developer: run perf spec ≥3 times before/after drawing changes vs parent commit; positive
  controls for "within N ms" tests.
- qa-tester: alternating comparison vs parent for perf; print failing assertions; capture
  animation frames at computed times; find content-dependent seeds headlessly.

## Owner feedback
- "Is it almost at the unity stage?" — question only; Producer recommended finishing the
  milestone first. No rule requested.
