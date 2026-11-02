# Round 2 — Producer notes (input for /retro)

Phase 2 (Build) + Phase 3 (QA). QA loops: 2. Final: QA PASS (0 B / 0 M / 1 minor).

## QA results
- Loop 1: FAIL — 4 major, 4 minor, 1 polish (BUG-2-01..2-09), see reports/qa/round-2.md.
- Producer found BUG-2-10 (MINOR, ui-developer) by looking at one screenshot: floating texts
  overlapped shouts and name labels. **QA loop 1 missed it** (it scanned screens at rest only).
- Loop 2: all 10 verified fixed; new BUG-2-11 (MINOR, ui-developer, name labels collide at
  melee range / clipped at right wall) — same class as BUG-2-10. Open, carried to round 3.

## Bug owners / root causes (from agent reports)
- BUG-2-01/02 (ui-developer, MAJOR): tutorial steps had no exit when the required action became
  impossible; event triggers didn't check the event was for the active fighter.
- BUG-2-03 (ui-developer, MAJOR): destructive confirm button drawn where the opening button was;
  no input arm delay on new menus.
- BUG-2-04 (gameplay-programmer, MAJOR): GDD §13 "ignore unknown IDs" implemented as skip-in-
  validation only; loader returned an unusable team. Also UI had no guard.
- BUG-2-05 (gameplay-programmer, MINOR): ownership not checked on load.
- BUG-2-06/09/10/11 (ui-developer): text overlap; tests used short names / quiet frames.
- BUG-2-07 (ui-developer, MINOR): UI built string keys from a logic enum without a test.
- BUG-2-08 (game-designer, GDD gap): generic "Ignition cancels current action" didn't exempt the
  Tri-Burst rush.

## Other process problems
- GDD rule added ("validator enforces §15.3 rule 9") but not implemented — content-designer found
  the validator passed the old names; gameplay-programmer implemented it in parallel. Rule added
  in GDD without matching negative fixture in the same change.
- GDD AC defects: AC-5.11.2 missing input; approach timeout unreachable with default data;
  AC-5.6.1/5.6.2 example numbers one tick short; AC-5.8.5 chain_index ambiguous (still open).
- Gameplay-programmer had to make 12 decisions where the GDD was silent (11 adopted).
- Logic added a new state field (triBurstLock) and reject reason without the UI being told in the
  same change; Producer relayed it.
- ui-developer put Vitest UI tests in tests/ui/ (outside listed ownership); Producer accepts it:
  tests/ui/ is owned by ui-developer from now on.
- Usage limit hit mid-round; two agents resumed. Work was preserved by WIP commits.
- Producer prompts named data/story/*.json in round 1 (fixed); this round paths were correct.

## Agent lesson candidates (summary)
- gameplay-programmer: define tick convention, test N-1 and N; loaders must hand back repaired
  usable objects and tests must use them (build a battle); repair before schema validation;
  own-property lookups for IDs from saves; AI must re-predict timed actions every tick; write the
  failing test first and run on old code.
- ui-developer: e2e configs rebuild (reuseExistingServer false); camera.getWorldPoint for zoomed
  input; time gestures with event.timeStamp; Canvas renderer for timing tests + WebGL smoke;
  kill by PID; every tutorial step has a "still possible" check and a cap in shown time;
  armMs on menu buttons + block underlying input after close; FloatPlacer as single layout
  authority, labels not in rotating containers; string key test pulling enums from source;
  layout tests use longest names and worst positions.
- qa-tester: sample live battle frames (busy fight, several fps, ≥20 s per size, longest
  names), prove it fails with placer disabled; layout scan needs modal filter and raw-[key]
  check; internal-hook tests need precondition waits; fault-injection hooks gated by env flag.
- game-designer: every AC with a formula lists all inputs; state whether default data can reach
  each timer; define tick numbering once; every "cancel current action" rule lists exemptions;
  read the validator's §3 parser before changing §3 wording; tick-count examples say which
  ticks are counted.
- content-designer: after a naming ruling, run the validator on data with the old name put back.
- shared: new §15.3/validator rule needs its negative fixture in the same round; logic state/enum
  additions name the affected UI element in the same hand-off.

## Owner feedback
- none (owner asked how many rounds remain and about Unity/cost).
