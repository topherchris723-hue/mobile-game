# Lessons — compliance-checker

Read this before every task. Maintained by team-coach. Format: see lessons/README.md.

(no lessons yet)

### L-cc-001: Re-check licences whenever package.json or the build changes, and report on the exact commit
Seen: 1 (round 6)
Severity of what it caused: MAJOR (compliance FAIL; reviewer R-1 BLOCKER for the stale report)
What happened: Round 6 — the licence check covered `assets/` only, so bundled libraries had no notices
  for 5 rounds. The report on `bf48920` was then used for a review of `48fb519`, 31 files later.
Root cause: The checklist said "every file in assets/", and nothing tied a report to the commit it
  judges.
Rule: Item 2 covers the module list of the release build (e.g. Rollup `generateBundle` or
  `npm ls --omit=dev`), each licence and its shipped notice. Every report states "Build checked: <exact
  commit>". If anything changes after that, the report is stale. Say so and re-run.
Status: PROMOTED (round 6)
