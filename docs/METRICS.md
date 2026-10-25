# Team Metrics

Updated by `team-coach` every 3 rounds. Used to decide which playbooks to upgrade and to
check whether past upgrades actually helped.

Last update: round 6 (2026-10-24), covering rounds 1–6. Previous update: round 3.

## Definitions
- **Tasks** = agent calls that delivered assigned work (fix loops count as a task).
- **Bugs caused** = filed BUG IDs and reviewer findings (R-n) owned by the agent (B/M/m/p),
  whoever found them. Shared findings are listed under each owner and marked "shared".
- **Repeat bugs** = bugs in a class that already had a lesson when the bug was written.
- **First-try QA pass %** = the share of the agent's build rounds in which QA loop 1 filed 0 bugs
  against it.
- **Reviewer findings** = R-n findings from `reports/release-review.md` (the most important
  number).
- **Spec defects** (designers only) = GDD gaps or AC errors found downstream.
- **Escapes** (QA) = bugs present in a build QA passed, found later by anyone.

## Per agent (cumulative, rounds 1–6)

| Agent | Tasks | Bugs caused (B/M/m/p) | Repeat bugs | First-try QA pass % | Reviewer findings | Other |
|---|---|---|---|---|---|---|
| game-designer | 8 (R1 2, R2 1, R3 3, R4 1, R5 1) | 0/1/2/0 (BUG-2-08 m, BUG-4-02 m shared, title FAIL M) | 6 (R3 5; R6 title = L-gd-004 class) | 50% (2/4 rounds with QA: R3, R5) | 0 direct (title FAIL feeds R-1) | Spec defects: R1 4, R2 5, R3 7, R4 1, R5 0, R6 0 |
| content-designer | 2 (R1 1, R2 1) | 0/0/0/0 | 0 | 100% (1/1) | 0 | Idle since R2 |
| gameplay-programmer | 9 (R2 2, R3 5, R4 2) | 0/3/1/0 | 0 | 33% (1/3) | 0 | 0 MAJOR since round-3 upgrade |
| ui-developer | 8 (R2 3, R3 2, R4 1, R5 1, R6 1) | 0/4/7/3 (R2 3M/4m/1p, R3 1m, R4 1m, R6 R-2 M shared, R-4 m, R-6 p, R-8 p) | 1 (BUG-3-03) | 40% (2/5: R3, R5) | 4 (R-2 shared, R-4, R-6, R-8) | 0 overlap bugs since round-3 upgrade |
| vfx-developer | 1 (R4) | 0/1/0/0 (R-2 shared) | 0 | 100% (1/1 QA) | 1 (R-2 shared) | Budget measured unthrottled only |
| qa-tester | 6 (R2 2, R3 2, R4 1, R5 1) | 0/0/1/0 (R-5 stale own spec) | 0 | — | 2 attributable (R-2 passed with a failing check; R-5) | Escapes: R2 2 (BUG-2-10, BUG-3-01), R3 0, R4 0, R5 2 (R-2, R-5) |
| balance-analyst | 3 (R3) | 0/0/0/0 | 0 | 100% (1/1) | 0 | Found BUG-3-01 |
| art-director | 3 (R4, R5 via briefs, R6) | 0/0/1/0 (R-7) | 0 | 100% | 1 (R-7) | CREDITS was assets-only until R6 (shared with compliance) |
| audio-designer | 1 (R4) | 0/0/0/0 | 0 | 100% | 0 | Flagged the Producer's "team-made" wording |
| economy-designer | 2 (R4, R5) | 0/0/1/0 (BUG-4-02 shared) | 0 | 100% | 0 | — |
| compliance-checker | 1 (R6) | — | — | — | contributes to R-1 (report not on exact commit) | Found 2 FAILs (title, code licences) |
| store-writer | 1 (R6) | 0/0/0/0 | 0 | — | 0 | No shell for counts |
| release-engineer | 0 | — | — | — | R-3 (pipeline gap: never called before review) | — |
| release-reviewer | 1 (R6) | — | — | — | — | First verdict: FAIL |
| team-coach | 6 retros | — | — | — | contributed to R-2 (L-qa-005 wording) | R2 retro deleted 5 lessons (restored R3) |
| Producer (no agent file) | — | R-1 B (reviewer called early), R-3 M (pipeline) | — | — | 2 | Path drift and licence wording in R4 prompts |

B = blocker, M = major, m = minor, p = polish.

## Team (per round)

| Round | QA loops needed | Bugs found by QA | Bugs found outside QA | Bugs found by reviewer | Reviewer verdict | Owner happy? |
|---|---|---|---|---|---|---|
| 1 | 0 (design only) | 0 | 0 (4 in-round design gaps) | — | — | — (no feedback) |
| 2 | 2 | 10 (0/4/5/1) | 1 (BUG-2-10, Producer) | — | none | — |
| 3 | 2 | 2 (0/1/1/0) | 1 (BUG-3-01, balance; escaped R2) | — | none | Yes: "its good" |
| 4 | 1 | 2 (0/0/2/0) | 0 | — | none | Concern: round length |
| 5 | 1 | 0 | 0 | — | none | Question: Unity timing |
| 6 | 0 (no QA run on the reviewed commit) | — | 2 compliance FAILs | **8 (1 B / 2 M / 3 m / 2 p)** | **FAIL** | — (title pending) |

**The most important number:** bugs found by the reviewer. Every bug the reviewer finds
is a bug QA missed. First review: 8. Of these, 4 are gate or process misses (R-1, R-2 judged as
"noise", R-3, R-5), 1 is IP design (R-7) and 3 are UI polish (R-4, R-6, R-8). Target for the next
review: 0 B/M and ≤ 2 total.

## Round-3 upgrade check (did it work?)
- ui-developer layout self-check: overlap bugs R2 4 → R3 1 → R4–R6 0. **Yes.**
- gameplay-programmer AI section: MAJOR bugs R3 2 → R4–R6 0. **Yes.**
- game-designer READY checklist: spec defects R3 7 → R4 1, R5 0, R6 0. **Yes.** The one old
  IP item (title search) surfaced in R6 and is now covered.
- qa-tester rate checks: 0 rate escapes since. **Yes.** But release-readiness escapes appeared
  (R-2, R-5). **No for the release gate** → round-6 upgrade.

## Watch list for the round-9 upgrade
1. Reviewer findings per review (8 → target ≤ 2, 0 B/M).
2. Failing checks reported as PASS or "noise" (R6: 1 → target 0).
3. Perf AC-17.7 absolute median p95 at 4× CPU (R6: 36.5–50.1 ms → ≤ 33.3).
4. IP/licence FAILs at compliance (R6: 2 → target 0 on the next run).
