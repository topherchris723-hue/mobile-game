# Team Metrics

Updated by `team-coach` every 3 rounds. Used to decide which playbooks to upgrade and to
check whether past upgrades actually helped.

Last update: round 3 (2026-10-23), covering rounds 1–3.

## Definitions
- **Tasks** = agent calls that delivered assigned work (fix loops count as a task).
- **Bugs caused** = filed BUG IDs owned by the agent (B/M/m/p), including bugs found by
  someone other than QA.
- **Repeat bugs** = bugs in a class that already had a lesson when the bug was written.
- **First-try QA pass %** = the share of the agent's build rounds in which QA loop 1 filed 0 bugs
  against it.
- **Spec defects** (designers only) = GDD gaps or AC errors found downstream (programmer, QA,
  balance). These are not filed as BUG IDs, but they cause rework.
- **Escapes** (QA) = bugs present in a build QA passed, found later by anyone.

## Per agent (cumulative, rounds 1–3)

| Agent | Tasks | Bugs caused (B/M/m/p) | Repeat bugs | First-try QA pass % | Reviewer findings | Other |
|---|---|---|---|---|---|---|
| game-designer | 6 (R1 2, R2 1, R3 3) | 0/0/1/0 (BUG-2-08) | 5 (R3 spec defects in classes of existing lessons: L-gd-002 ×1, L-gd-006 ×1, L-gd-007 ×3) | 50% (1/2) | 0 | Spec defects: R1 4, R2 5 (+12 silent decisions), R3 7 |
| content-designer | 2 (R1 1, R2 1) | 0/0/0/0 | 0 | 100% (1/1) | 0 | — |
| gameplay-programmer | 7 (R2 2, R3 5) | 0/3/1/0 (2-04 M, 2-05 m, 3-01 M, 3-02 M) | 0 | 0% (0/2) | 0 | 1 test defect (AC-5.10.2 read live data) |
| ui-developer | 5 (R2 3, R3 2) | 0/3/5/1 (2-01 M, 2-02 M, 2-03 M, 2-06 m, 2-07 m, 2-09 p, 2-10 m, 2-11 m, 3-03 m) | 1 (BUG-3-03, class L-ui-003) | 50% (1/2) | 0 | Text-overlap class: 5 bugs in 2 rounds |
| qa-tester | 4 (R2 2, R3 2) | 0/0/0/0 | 0 | — | 0 | Escapes: 2 (BUG-2-10 in loop 1, found by the Producer; BUG-3-01 passed round 2, found by balance). 2 own test defects in R3 |
| balance-analyst | 3 (R3) | 0/0/0/0 | 0 | 100% (1/1) | 0 | Found BUG-3-01. 1 process issue (`git stash` in the shared tree) |
| team-coach | 3 (R1–R3 retros) | — | — | — | 0 | 1 self-defect: the round-2 retro emptied 2 lessons files (L-tc-002) |
| vfx / art / audio / economy / launch / unity agents | 0 | — | — | — | — | Not active yet |

B = blocker, M = major, m = minor, p = polish.

## Team (per round)

| Round | QA loops needed | Bugs found by QA | Bugs found outside QA | Bugs found by reviewer | Reviewer verdict | Owner happy? |
|---|---|---|---|---|---|---|
| 1 | 0 (design only) | 0 | 0 (4 in-round design gaps) | — | — | — (no feedback) |
| 2 | 2 | 10 (0 B / 4 M / 5 m / 1 p) | 1 (BUG-2-10, Producer) | — | none | — (no feedback) |
| 3 | 2 | 2 (0 B / 1 M / 1 m / 0 p) | 1 (BUG-3-01, balance-analyst; escaped round 2) | — | none | Yes: "its good" (phone playtest) |

**The most important number:** bugs found by the reviewer. Every bug the reviewer finds
is a bug QA missed. It should trend to zero. No review has run yet. The closest proxy until then
is **bugs found outside QA**: 1 per round in rounds 2 and 3. Target for rounds 4–6: 0.

## Watch list for the round-6 upgrade
1. ui-developer text-overlap bugs (class L-ui-003): R2 4, R3 1. Target: 0.
2. gameplay-programmer MAJOR bugs and first-try QA pass: R2 1 M, R3 2 M, 0%. Target: 0 M, ≥ 50%.
3. game-designer spec defects found downstream: R2 5, R3 7. Target: ≤ 2 per round.
4. QA escapes (bugs found outside QA): 1 per round. Target: 0.
