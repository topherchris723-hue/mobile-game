# Shared lessons — every agent follows these

Starting rules (from project setup). The team-coach adds more as the project runs.

### L-shared-001: Read before you write
Seen: 0
Severity of what it caused: —
Rule: Before any task, read this file, your own lessons file, the relevant GDD section
  and `docs/GAME_BRIEF.md`. Mention in your report that you did.
Status: ACTIVE

### L-shared-002: Prove it, don't claim it
Seen: 0
Severity of what it caused: —
Rule: Never write "works" or "fixed" without evidence: a test name, a command output, or
  a screenshot path. If you could not verify something, say "NOT VERIFIED" and why.
Status: ACTIVE

### L-shared-003: Stay in your lane
Seen: 0
Severity of what it caused: —
Rule: Only change files you own. If something outside your files is wrong, describe it in
  your report for the Producer instead of editing it.
Status: ACTIVE

### L-shared-004: Original and licensed only
Seen: 0
Severity of what it caused: —
Rule: Nothing from existing franchises. Every asset has a license logged in
  `assets/CREDITS.md`. No secrets in the repo.
Status: ACTIVE

### L-shared-005: Always end with lesson candidates
Seen: 0
Severity of what it caused: —
Rule: Every report ends with "Lesson candidates": what went wrong or nearly went wrong,
  and what instruction would have prevented it. "none" is allowed only if true.
Status: ACTIVE

### L-shared-006: Prove your checker can fail before trusting its PASS
Seen: 1 (round 1)
Severity of what it caused: MINOR (caught inside the round)
What happened: Round 1 notes, item "content-designer lesson candidates" — the scratch content
  validator crashed on a record with a missing ID. Only a deliberately broken input revealed it;
  the happy-path run had already reported PASS.
Root cause: Validators and tests were only run against good data, so a checker that crashes or
  silently passes on bad data looked identical to a working one.
Rule: Before reporting PASS from any validator, test or grep you wrote or changed, run it on at
  least 3 deliberately broken inputs (missing required field/ID, wrong type or bad cross-reference,
  a banned term) and paste the expected FAIL output in your report. No negative run shown = report
  "NOT VERIFIED". Applies to content-designer, game-designer (schemas), gameplay-programmer
  (`npm run validate-data`), qa-tester and anyone else who writes a check.
Status: ACTIVE

### L-shared-007: GDD §15 is the source of truth for data file paths
Seen: 1 (round 1)
Severity of what it caused: MINOR (caught inside the round)
What happened: Round 1 notes item 6 — the content-designer playbook ("You own") and the Producer's
  task prompt named `data/skills.json` and `data/story/*.json`; GDD §15.1 defines `data/cards.json`
  and `data/story.json`. Content-designer noticed and followed the GDD.
Root cause: File names were written into playbooks and prompts before the GDD fixed them, and
  nobody re-checked those copies against GDD §15 when it changed.
Rule: Before creating or editing a data file, look up its path in GDD §15.1. If your task prompt or
  playbook names a different path, use the GDD §15.1 path and list the mismatch under
  "Notes for the Producer" in your report. Never create a file at a path GDD §15.1 does not list
  without saying so in the report.
Status: ACTIVE

### L-shared-008: Check names and text against the banned-term list read fresh from GDD §3
Seen: 1 (round 1)
Severity of what it caused: MINOR (caught inside the round; IP risk)
What happened: Round 1 notes items 4 and 7 — GDD §3 lacked Spirit Bomb, Solar Flare, Chakra, Jutsu,
  Rasengan, Bankai, Hollow, Quirk, Stand; content-designer's own scan caught "Stand" in two shouts;
  game-designer nearly proposed "Overpeak" (title in use), "Ascension" and "Spark" (franchise echoes).
Root cause: Banned terms were recalled from memory instead of read from one maintained list, and
  new names were not checked against that list or the web before being written down.
Rule: Every round, copy the banned-term list from the current GDD §3 (do not rely on memory) and
  check every new name, shout, card name, title and store text against it. Treat "Stand" and
  "Hollow" per GDD §3 (banned only as a power/form/mechanic name). If you find a franchise term
  that is not on the list, do not use it and report it so game-designer adds it to §3.
Status: ACTIVE
