# Team Changelog

Every change to an agent's playbook is logged here by `team-coach`, with the reason and
the metric it should improve. At the next upgrade, the coach checks whether it worked.

| Date | Round | Agent file | Change | Why | Metric to improve | Worked? |
|---|---|---|---|---|---|---|
| 2026-10-22 | 0 | all | Initial playbooks created | Project setup | — | — |
| 2026-10-22 | 2 | game-designer.md | Hard rules: L-gd-002 (enforcement-point table), L-gd-003 (start values + tick convention), L-gd-007 (worked ACs), L-shared-006 (must-FAIL input per check) | Round-2 rule 9 not enforced, AC-5.6.1/5.6.2 one tick short, AC-5.11.2 / approach timeout / AC-5.8.5 defects, 12 programmer decisions where the GDD was silent | GDD-gap bugs and "decisions the GDD did not cover" per round | check round 3 |
| 2026-10-22 | 2 | content-designer.md | Hard rule: L-shared-006 (≥3 broken-copy validator runs, incl. renamed value put back) | Validator passed old Spark names before rule 9 existed | Checks reported PASS that later turn out unenforced | check round 3 |
| 2026-10-22 | 2 | gameplay-programmer.md | Hard rules: L-gp-001 (every §13 save constraint repaired + used in a test), L-shared-006 (failing test first, validator fixtures), L-shared-009 ("Consumers must handle" list, exported enums) | BUG-2-04 (MAJOR), BUG-2-05; triBurstLock not relayed to UI | Save/load bugs; Producer relays between agents | check round 3 |
| 2026-10-22 | 2 | ui-developer.md | Hard rules: L-ui-001 (tutorial steps exit when impossible), L-ui-003 (longest strings, worst positions, live frames, single placer), L-shared-006, L-shared-009 (enum → string-key test) | BUG-2-01/02 (MAJOR), BUG-2-06/09/10/11 text overlap (4 in one round), BUG-2-07 raw key | ui-developer bugs per round (6 this round + 2-10/2-11); repeat overlap bugs | check round 3 |
| 2026-10-22 | 2 | qa-tester.md | Hard rule: L-shared-006 (injected-fault run for every check) | Codifies what QA already did well in round 2 so it stays | Bugs found after QA PASS (BUG-2-10 class) | check round 3 |
| 2026-10-22 | 2 | team-coach.md | Hard rule: L-tc-001 (ownership audit vs GDD §15 and git log every retro) | Stale/missing "You own" entries two rounds running | Ownership mismatches found per retro | check round 3 |
