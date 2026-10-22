# Lessons — game-designer

Read this before every task. Maintained by team-coach. Format: see lessons/README.md.

### L-gd-001: Ask what descriptive fields consumers need before closing a schema
Seen: 1 (round 1)
Severity of what it caused: MINOR (caught inside the round)
What happened: Round 1 notes item 1 — characters.schema.json had `additionalProperties: false`
  but no `role` or `art_brief`, so content-designer could not store fields its own playbook requires.
  Game-designer fixed it in a follow-up.
Root cause: The schema was written from the battle rules only; the playbooks of the agents that
  fill and read the data (content-designer, art-director, ui-developer) were not checked.
Rule: Before setting `additionalProperties: false` on any schema, read the "How you work" section
  of every agent that writes or reads that file and confirm each field they must store exists.
  List the fields checked, per consumer, in your report.
Status: ACTIVE

### L-gd-002: Every rule, term, trigger or event named in GDD prose must have a named enforcement point
Seen: 2 (rounds 1, 2)
Severity of what it caused: MINOR (caught inside the round both times)
What happened: Round 1 — GDD §2 described a Perfect Slip → Riposte tutorial prompt, but the tutorial
  trigger enum had no `perfect_slip` / `riposte`. Round 2 — GDD §15.3 rule 9 ("validator enforces the
  name-only Spark terms") was written into the GDD, but the validator did not enforce it yet, so
  content-designer's validation run passed the old names; the round-2 notes also flag that §3 wording
  is parsed by the validator and was changed without reading that parser.
Root cause: Prose was written separately from the machine-readable thing that enforces it (schema
  enum, validator rule, parser) and the two were never cross-checked in the same change.
Rule: Before finishing, list every trigger/event/prompt/state/term/validation rule you added or
  changed in GDD prose, and for each name its enforcement point (schema enum value, §15.3 validator
  rule, §3 list format the validator parses, or AC), one input that must FAIL and one that must PASS,
  and the agent who must update it this round. Put the table "GDD mention → enforcement point →
  must-FAIL / must-PASS → agent" in your report. Before changing §3 wording, read how
  `scripts/validate-data.js` parses §3 (ask the Producer if you cannot) and keep that format.
Status: PROMOTED (round 2)

### L-gd-003: Give every timer, cooldown, gauge, window and counter an explicit start value and tick convention
Seen: 2 (rounds 1, 2)
Severity of what it caused: MINOR (caught inside the round both times)
What happened: Round 1 — the tag cooldown at battle start was undefined (is Tag ready at tick 0?).
  Fixed with `tag.initial_cooldown_s` = 5 and AC-5.8.0. Round 2 — the example numbers in AC-5.6.1 and
  AC-5.6.2 were one tick short, because the GDD never said whether the tick on which a window opens
  counts as its first tick; gameplay-programmer had to define the convention itself.
Root cause: Rules described how values change, not where counting starts (tick 0 vs tick 1, inclusive
  vs exclusive end), so start values and window lengths were ambiguous.
Rule: For every timer, cooldown, gauge, window, meter and counter in the GDD, state its value at
  battle start (tick 0) and after a reset, store it as a data field, and write an AC for it. Define
  the tick convention once in §5.0 (on which tick an event happens, whether that tick counts, which is
  the last active tick) and make every AC example with a tick count name the first and last counted
  tick (e.g. "window opens on tick T, last active tick T+47, closed on T+48").
Status: PROMOTED (round 2)

### L-gd-004: Keep the GDD §3 banned-term list complete and clear every new name
Seen: 1 (round 1)
Severity of what it caused: MINOR (caught inside the round; IP risk)
What happened: Round 1 notes items 4 and 7 — §3 missed nine well-known franchise terms
  (Spirit Bomb … Stand); the title "Overpeak" was already in use; "Ascension" and "Spark" echoed
  franchise terms. All were caught before commit.
Root cause: The list was written from memory instead of franchise by franchise, and proposed
  names were not web-searched before being written.
Rule: When writing or updating §3, go through each franchise named in the brief and CLAUDE.md §9
  (and the top anime battle franchises) and list their mechanic, power and currency names. Before
  writing any proposed title or term, web-search it with "game" and "anime" and check it against
  §3; record the result in your report. Mark common English words as context-dependent (warn,
  not error). See also L-shared-008.
Status: ACTIVE

### L-gd-005: State schema validation as NOT VERIFIED and hand over the exact command
Seen: 1 (round 1)
Severity of what it caused: MINOR (no defect; process gap)
What happened: Round 1 notes item 5 — game-designer has no shell, so it could not validate its 9
  schemas; the Producer ran `jsonschema.Draft202012Validator.check_schema` (all valid).
Root cause: The playbook asks for schemas but the agent has no tool to check them, and the report
  format has no place to request validation.
Rule: Whenever you add or change a schema, write "Schemas: NOT VERIFIED (no shell)" in your report
  and give the Producer the exact command to run (Draft 2020-12 `check_schema` on each changed
  file, plus validating the current data file against it). Never write "valid" for a schema you
  could not run.
Status: ACTIVE

### L-gd-006: Every interrupting rule lists what it can interrupt, the exemptions, and what happens to spent resources
Seen: 1 (round 2)
Severity of what it caused: MINOR
What happened: BUG-2-08 — §5.9 said Ignition cancels the enemy's "current card"; the GDD never said
  whether that includes a Tri-Burst rush. In the build, enemy Ignition cancelled the player's rush and
  the full 100 Burst gauge was lost with no refund and `burstUsed = false`. Fixed in round 2 with the
  §5.0 Tri-Burst lock and AC-5.9.7 / AC-5.10.6 / AC-5.10.7.
Root cause: A generic "cancel the current action" rule was written without walking through every
  action that can be in progress (cards, Riposte, Tag, Tri-Burst rush, cinematics) and without
  saying what happens to the resources already spent.
Rule: For every rule that cancels, interrupts, stuns, KOs or swaps a fighter, add a table: each
  action that can be in progress → interrupted or exempt → what happens to its spent resource (Vigor,
  Burst, cooldown, "used" flags). Add an AC for every exempt case and every refund case.
Status: ACTIVE

### L-gd-007: Work every AC with the default data before marking a section READY
Seen: 3 (round 2: AC-5.11.2, approach timeout, AC-5.8.5)
Severity of what it caused: MINOR (found by gameplay-programmer while building; 12 decisions where the
  GDD was silent)
What happened: Round-2 notes — AC-5.11.2 left out one input of its formula; the approach timeout can
  never fire with the default data in `data/battle.json`; AC-5.8.5 uses `chain_index` without saying
  whether it is 0- or 1-based or when it resets (still open). Gameplay-programmer also had to make 12
  decisions where the GDD was silent (11 adopted).
Root cause: ACs were written as statements, not computed. Nobody plugged the default data into each
  formula, checked that each timer can actually be reached, or defined each index before marking
  §5 READY.
Rule: Before marking any section READY, for every AC: (1) list every input value and where it comes
  from in data, (2) show the arithmetic to the expected result, (3) state whether the default data can
  reach the condition (if not, say so and give the data change that reaches it), (4) define every
  index and counter (0- or 1-based, when it resets). Put a "Worked ACs" table in your report. Answer
  every "Decisions the GDD did not cover" item from the programmer's last report in the GDD in the
  same round, marked as a ruling.
Status: PROMOTED (round 2)
