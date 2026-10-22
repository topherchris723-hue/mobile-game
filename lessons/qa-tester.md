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
Status: ACTIVE
