# Lessons — gameplay-programmer

Read this before every task. Maintained by team-coach. Format: see lessons/README.md.
(Round 3: this file was restored. The round-2 retro emptied it by mistake (see L-tc-002); L-gp-001
was written in round 2 and its hard rule was in the playbook throughout.)

### L-gp-001: A save loader must enforce every GDD §13 rule and hand back a save the game can use as-is
Seen: 2 (round 2: BUG-2-04, BUG-2-05)
Severity of what it caused: MAJOR
What happened: BUG-2-04 — a save whose team held a character ID no longer in the data loaded "fine"
  (the unknown ID was only skipped during validation), but the returned team was unusable and
  HomeScene crashed: black screen. BUG-2-05 — a save whose team held an unowned fighter loaded
  unchanged, although GDD §13 says "all owned".
Root cause: The GDD §13 save constraints were not turned one by one into load-time checks, and tests
  only checked that `loadSave` returned without error; no test used the loaded object.
Rule: For every constraint in GDD §13 and `save.schema.json` (including "checked in code" notes),
  write one load-time check that repairs (or resets with a backup) and one test that loads a save
  breaking only that constraint, then builds the Home team and starts a battle from the result. Repair
  before schema validation. Look up IDs that come from a save with own-property checks
  (`Object.hasOwn`). List the constraint → check → test table in your report.
  Round 3: worked. The summon save repair (AC-11.5, AC-11.10) had no load bugs.
Status: PROMOTED (round 2); merged into playbook "Save data" (round 3 step C)

### L-gp-002: Worked-example (W) and inline (X) tests never read live data
Seen: 2 (round 3: AC-5.9.x / AC-8.1 tests; AC-5.10.2 test)
Severity of what it caused: MINOR (blocked tuning; 1 failing test after a legal data change)
What happened: Round-3 notes and balance report — the tests for AC-5.9.1/5.9.3/5.9.6 and AC-8.1 used
  Tavi's live Ignition values and live 8,200 HP, so the balance-analyst could not tune them. After
  GDD §15.4 introduced FX-GDD and W/X/P classes, the X-class test for AC-5.10.2 still passed the live
  `R.burst.powerPerMember` and broke when the balance-analyst set it to 3.3.
Root cause: Tests took "the GDD example numbers" from whatever data was loaded, so a test that should
  pin a frozen example silently depended on tunable live values.
Rule: Before finishing, grep every test you added or changed for live-data loaders. W tests load
  only `tests/fixtures/gdd/` (FX-GDD), X tests use inline literals copied from the GDD, and only P tests
  read `data/`. Put the AC → class → data source table in your report.
Status: PROMOTED (round 3)

### L-gp-003: A decision, once made, is only undone when the thing it tracks ends
Seen: 2 (round 3: BUG-3-01, BUG-3-02)
Severity of what it caused: MAJOR (both)
What happened: BUG-3-01 — on a failed slip roll, `reactiveDodge()` set `watched = null`, so the same
  windup was picked up and re-rolled every tick (rookie slipped 45% instead of 10%). All round-2 balance
  numbers were wrong. BUG-3-02 — veteran/master rolled a planned Slip correctly, but the decision loop
  then started their own card before the planned tick, so 272 of 388 master Slips were lost.
Root cause: Another code path (the dedupe reset, the card-play branch) could cancel a decision that
  was already made. Tests checked that a decision was made, not that its outcome happened, and only
  for one tier.
Rule: (1) Clear a dedupe or "already decided" marker only when the thing it tracks ends (windup
  resolved or cancelled), never on a failed roll. (2) Every "on tick X do Y" or planned action has a
  test in which another branch also wants to act on tick X, for every tier's think_interval.
  (3) Outcome-rate tests per L-shared-010.
Status: PROMOTED (round 3)
