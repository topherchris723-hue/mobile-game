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
Seen: 2 (rounds 1, 2)
Severity of what it caused: MINOR (caught inside the round both times)
What happened: Round 1 — the scratch content validator crashed on a record with a missing ID; only a
  deliberately broken input revealed it. Round 2 (round-2 notes, "Other process problems") — GDD §15.3
  rule 9 (name-only "spark"/"sparks") was added, content-designer renamed the Spark names and ran
  `npm run validate-data`, which still PASSED with the old names because rule 9 was not implemented
  yet. Nobody had run the validator on data with the old name put back.
Root cause: Validators and tests were only run against good data, so a checker that crashes, is not
  implemented yet, or silently passes on bad data looked identical to a working one.
Rule: Before reporting PASS from any validator, test or grep you wrote, changed or rely on for a new
  rule, run it on at least 3 deliberately broken inputs (missing required field/ID, wrong type or bad
  cross-reference, a banned term) — and for a rename or new rule, on data with the old/forbidden value
  put back — and paste the expected FAIL output in your report. For code fixes, write the test first
  and show it FAIL on the old code. No negative run shown = report "NOT VERIFIED". Applies to
  content-designer, game-designer (name the must-FAIL input for every rule you specify),
  gameplay-programmer, ui-developer, qa-tester and anyone else who writes a check.
Status: PROMOTED (round 2)

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

### L-shared-009: Changing an interface (state field, enum value, event, reject reason) means updating and testing every consumer in the same hand-off
Seen: 2 (round 2: BUG-2-07; triBurstLock hand-off)
Severity of what it caused: MINOR
What happened: BUG-2-07 — the engine returns `reason: "double_ko"` for a Draw, but the UI built
  the string key `result_reason_<reason>` and strings.json only had ko/timeout/retreat, so the Result
  screen showed "[result_reason_double_ko]". Round-2 notes — gameplay-programmer added the state field
  `triBurstLock` and a new reject reason for BUG-2-08 without telling ui-developer; the Producer had
  to relay it by hand.
Root cause: Values cross the logic → UI (and GDD → validator/schema) boundary with no written list of
  what changed and no consumer test that enumerates every value from the source, so a new value is
  silently unhandled. Same family as L-gd-001 / L-gd-002 (producer of an interface did not check its
  consumers).
Rule: (1) Producer side: whoever adds or changes a state field, enum value, event, reject reason or
  GDD rule lists it in the report under "Consumers must handle", naming each consumer file/element and
  owning agent; logic exports every enum as a list from `src/logic`. (2) Consumer side: every lookup
  built from such a value (string keys, icons, prompts) has a test that imports the exported list and
  asserts each value maps; no raw `[key]` may reach the screen.
Status: PROMOTED (round 2)
