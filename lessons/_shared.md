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
Seen: 4 (round 2: BUG-2-07; triBurstLock hand-off; round 3: QA probe broke on TutorialController
  constructor change; QA screen spec still tapped the old disabled Summon button)
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
  asserts each value maps; no raw `[key]` may reach the screen. (3) QA specs and probes are consumers
  too: when you change a constructor/function signature, a control's enabled state or a screen flow,
  name the QA specs and probes (`tests/e2e/qa-*`, `tests/sim/*`) that use it under "Consumers must
  handle". QA re-runs every probe after an interface change is announced.
  Round 3: worked for logic → UI (the UI handled `hit_discarded` and the new whiff reasons in the same
  round; no raw keys). It failed for UI/logic → QA consumers, which is why part (3) was added.
Status: PROMOTED (round 2); rule widened (round 3)

### L-shared-010: Every chance or rate gets a per-decision outcome-rate check for every tier
Seen: 2 (round 3: BUG-3-01, BUG-3-02)
Severity of what it caused: MAJOR (both). BUG-3-01 escaped round-2 QA and was found by the
  balance-analyst; every round-2 balance number was wrong.
What happened: BUG-3-01 — the AI re-rolled `slip_chance` every tick, so rookie slipped 45% instead of
  10%. BUG-3-02 — after that fix, veteran/master still lost most planned Slips (master 16.5% instead
  of 55%). The BUG-3-01 test covered only the fighter tier and checked that a roll happened, not that
  a Slip happened.
Root cause: The GDD ACs described *when and how* a slip happens, never *how often per decision*. The
  programmer's tests checked the decision, not the outcome, and only for one tier. QA's bot checked
  invariants (no NaN, no softlock) but measured no rates, and the balance pass-1 tuning started
  before anyone measured the AI against its data.
Rule: For every `*_chance`, rate or probability in data:
  - game-designer: write a P-class AC "for every tier: over ≥ 2,000 seeded decisions, the measured
    outcome share is within ±2 pp of the data value", defining one decision.
  - gameplay-programmer: write that test for every tier, measuring the outcome (the Slip happened),
    not the roll.
  - qa-tester: run an independent rate script per tier every round that changes AI or rates, with a
    negative proof.
  - balance-analyst: measure the AI's rates against data before tuning anything and report them in
    the first table.
Status: PROMOTED (round 3)

### L-shared-011: Never use git commands that hide or discard other agents' work in the shared tree
Seen: 2 (round 3: balance-analyst `git stash`; WIP commits mixing agents' files)
Severity of what it caused: MINOR (work looked lost; no data lost)
What happened: Round-3 notes — the balance-analyst ran `git stash` in the shared working tree, which
  made other agents' changes look lost. WIP commits made during usage-limit pauses swept up whatever
  any agent had changed, so commits labelled "(ui-developer)" contain balance data and gameplay
  tests. The balance sim had to snapshot `src/` because of parallel edits.
Root cause: Several agents work in one working tree at the same time, with no rule about which git
  commands are safe and no isolation for long-running reads.
Rule: Never run `git stash`, `git reset`, `git checkout -- <path>`, `git restore` or `git clean` on
  files you do not own. For stable long runs (sims, e2e suites), copy what you need to the scratchpad
  and run from the copy. Report the copy's source commit. Only the Producer commits.
Status: PROMOTED (round 3)

### L-shared-012: The Producer decides routine and open questions; do not wait for the owner
Seen: 1 (round 3)
Severity of what it caused: OWNER FEEDBACK
What happened: Round 3, the owner on `/round`: "and you decide all that". This delegated the title
  choice and the designer's open questions to the Producer.
Root cause: Agents and the Producer queued decisions for the owner that the owner did not want to
  make.
Rule: Never leave a question for the owner except the CLAUDE.md §8 items (keystore, Play Console,
  paid assets/services, the pre-release playtest) or a decision the rules forbid an agent to make.
  Agents give a recommended default for every open question. The Producer decides and logs it under
  "Decisions made without the owner" in `docs/STATUS.md`.
Status: PROMOTED (round 3)

### L-shared-013: Automate the round loop, without loosening any safety rule
Seen: 1 (round 3)
Severity of what it caused: OWNER FEEDBACK
What happened: Round 3, owner: "You decide all that i want to automate this as much as possible". The
  owner wants rounds chained automatically and resumed after usage-limit resets.
Root cause: The pipeline stopped between rounds and after interruptions, waiting for a human.
Rule: When a round ends, the Producer schedules the next `/round`. After a usage-limit reset, it
  resumes from the last WIP commit and `docs/STATUS.md`. It stops only for CLAUDE.md §8 items or a
  BLOCKER the rules forbid it to decide. Automation never removes a gate: the CLAUDE.md §7 bans
  (publishing, deleting history, signing keys, spending money, force-push), the release-reviewer
  PASS gate, tests and all safety, licensing, privacy, IP and security rules still apply in full.
Status: PROMOTED (round 3)

### L-shared-014: Keep the core feel the owner approved; build on it
Seen: 1 (round 3)
Severity of what it caused: OWNER FEEDBACK
What happened: Round 3, after the owner's first phone playtest of the private web build: "Bro im
  linking it its good".
Root cause: Not a defect. This records that the round-3 build's feel is the approved baseline.
Rule: Treat the round-3 build's core feel as approved: controls and gestures, battle speed per second,
  hit feedback, battle HUD layout and tone. Any change to one of these must be named as an intended
  change in the Producer's round plan, with the reason, and listed in your report under "Feel
  changes". Balance changes keep speed per second and change length or numbers instead (as with the
  round-3 HP ×2 decision). Unplanned feel changes are bugs.
Status: PROMOTED (round 3)

### L-shared-015: Do not rewrite a GDD section while it is being built
Seen: 1 (round 3)
Severity of what it caused: MINOR (rework)
What happened: Round-3 notes — GDD §11 (summon) was rewritten while the gameplay-programmer was
  building it in parallel. The RNG, walk order, weights and result shape changed, and the Producer
  forwarded the new spec mid-task, which caused rework.
Root cause: Design and build of the same section were scheduled in parallel, and a READY section was
  edited freely instead of through rulings.
Rule: A section is built only after the game-designer has committed it as READY. After that, changes
  are numbered rulings (what changed, which ACs, which agents) that the Producer forwards. The
  programmer does not start a section the designer is editing this round.
Status: ACTIVE (Producer rule proposed for CLAUDE.md §4)
