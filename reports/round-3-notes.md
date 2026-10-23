# Round 3 — Producer notes (input for /retro, step C round)

Summon screen build + Growth start (balance) + round-2 leftovers. QA loops: 2. Final QA PASS
(0 B / 0 M / 1 minor: BUG-3-03 RIPOSTE! over combo counter — same class as BUG-2-10/2-11).

## Owner feedback (verbatim, all must become lessons/hard rules)
- "and you decide all that" (on /round) — Producer decides routine/open questions.
- "You decide all that i want to automate this as much as possible" — Producer decides without
  asking; chain rounds automatically; resume after usage limits; stop only for CLAUDE.md §8.
- "Bro im linking it its good" (after phone playtest of the private web build) — keep the feel.

## Bugs and findings this round
- BUG-3-01 (MAJOR, gameplay-programmer, found by balance-analyst, not QA): AI re-rolled slip every
  tick (`watched = null` on failed roll). All round-2 balance numbers were wrong. Round-2 ACs only
  checked when/how a slip happened, never how often per decision.
- BUG-3-02 (MAJOR, gameplay-programmer, found by QA loop 1): veteran/master lost planned slips by
  starting their own card. The BUG-3-01 statistical test only covered the fighter tier.
- BUG-3-03 (MINOR, ui-developer): fixed-position combo counter not registered in float placer.
- QA's own test defect: lock test drove one side via hooks without disabling its AI / asserting
  precondition → flaky after engine fix.
- QA probes went stale after an interface change (TutorialController constructor).

## GDD / design process
- Summon §11 was rewritten while gameplay-programmer built it in parallel → rework (RNG, walk
  order, weights, result shape). Producer forwarded spec mid-task.
- Worked-example ACs pinned to live data (Tavi Ignition, 8,200 HP) blocked tuning → FX-GDD
  fixture + W/X/P classes (§15.4). One X-class test still read live data (AC-5.10.2) → broke on
  power_per_member 3.3.
- Battle-length target unreachable within GDD bands → HP ×2 (band change by designer).
- Rush invulnerability exception didn't walk every branch of the first-hit rule (AC-5.10.9).
- BAL-5.10 written with undefined population ("same-tier enemy").
- AC-5.8.5 precondition not traced through how the state is entered.
- §6/§7 bands existed as GDD tables but no validator rule until rules 10–12.

## Balance
- Pass 1 tuned against the buggy AI; pass 2 after HP ×2 + AI fix; re-check after BUG-3-02 with no
  data change. Final: BAL-5.14/5.10/5.15 met, mirrors 43–59%, all missions reachable.
- balance-analyst used `git stash` in the shared tree (made changes look lost); other agents' WIP
  commits picked up its data. Sim harness needed snapshots of src/ due to parallel edits.

## Process
- Usage limit hit 3 times; scheduled safety-net check-ins were delivered hours late (queued until
  the session was active). Work preserved by WIP commits each time.
- ui-developer: release build must not contain test hooks (Vite NODE_ENV=test made DEV true).
- Producer published a private playtest web build (artifact) on owner request.
- Parallel agents: logic adds enum/event → Producer relayed to UI; L-shared-009 worked.

## Agent lesson candidates (summary)
- gameplay-programmer: per-decision rate tests for every `*_chance`, for EVERY tier, measuring the
  outcome not only the decision; clear dedupe markers only when the tracked thing ends; when a
  seed-pinned failure disappears after an unrelated change, re-scan a wider seed range; wait for
  the designer's commit when the GDD section is being edited in the same round; "on tick X" specs
  need a test where another branch also acts on tick X; judge validator fixtures on added errors.
- game-designer: worked examples on frozen fixtures from round 1; list every route into a state
  an AC depends on; state RNG call count/order for seeded rolls; apply downstream rules when
  working ACs; name exact population for balance targets; write tier ACs "for every tier";
  turn GDD band tables into validator rules the same round; walk every branch of a rule an
  exception overrides.
- ui-developer: gate dev hooks on MODE / explicit VITE flag + bundle-grep test; when a disabled
  control goes live, list QA specs that tap it; register every fixed-position text in the placer.
- balance-analyst: verify AI behaves per GDD (measured rates) before tuning; grep tests/GDD for a
  value before changing it; never git stash in shared tree; snapshot engine; re-run after the
  very last change; read target definitions fresh each pass.
- qa-tester: re-run probes after interface changes; copy exact AC boundary conditions; keep
  diagnostic scripts in tests/sim; disable AI + assert preconditions for hook-driven tests;
  run timing-sensitive e2e 3+ times.
