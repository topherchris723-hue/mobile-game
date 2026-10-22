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
Status: ACTIVE
