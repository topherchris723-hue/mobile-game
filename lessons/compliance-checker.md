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

### L-cc-002: Keep the secret pattern in a versioned file, with one planted secret per syntax
Seen: 2 (round 7: the round-6 pattern missed Gradle `storePassword "…"`; round 7b: it still missed JSON
  `"apiKey"` and YAML `token:`, 2 of 5 plants)
Severity of what it caused: MINOR (near miss on a security check; no real secret found)
What happened: The secret regex lived in the session and was widened by hand each time a planted secret
  in a new syntax got through. Only the planted negative controls showed the gaps.
Root cause: The pattern was rebuilt each round from memory and tested with one or two plant syntaxes,
  not with every syntax the repo uses.
Rule: Keep the secret pattern case-insensitive in a versioned repo file (path proposed to the Producer,
  e.g. next to the release-bundle checks), with a fixture of one planted secret per syntax the repo uses
  (properties, JSON, YAML, Gradle/Groovy, JS/TS, XML). Run it over the tree and the full history. Item 7
  can only PASS when every plant is caught (e.g. 6 of 6), with the output pasted. A missed plant means the
  scanner is broken and item 7 is FAIL until it is fixed.
Status: PROMOTED (round 7)
