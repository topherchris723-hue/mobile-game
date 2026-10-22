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

### L-gd-002: Every GDD-scripted prompt, event or trigger must exist in the schema enum
Seen: 1 (round 1)
Severity of what it caused: MINOR (caught inside the round)
What happened: Round 1 notes item 2 — GDD §2 described a Perfect Slip → Riposte tutorial prompt,
  but the tutorial trigger enum had no `perfect_slip` / `riposte`, so the prompt could not be data.
Root cause: Prose and schemas were written separately and never cross-checked.
Rule: Before finishing, list every trigger/event/prompt/state named in GDD prose and confirm each
  appears in the matching schema enum (or remove it from the prose). Put the table
  "GDD mention → schema enum value" in your report.
Status: ACTIVE

### L-gd-003: Give every timer, cooldown, gauge and counter an explicit start value
Seen: 1 (round 1)
Severity of what it caused: MINOR (caught inside the round)
What happened: Round 1 notes item 3 — the tag cooldown at battle start was undefined (is Tag ready
  at tick 0?). Fixed with `tag.initial_cooldown_s` = 5 and AC-5.8.0.
Root cause: Rules described how values change, not what they are when a battle starts.
Rule: For every timer, cooldown, gauge, meter and counter in the GDD, state its value at battle
  start (tick 0) and after a reset, store it as a data field, and write an acceptance criterion
  for it.
Status: ACTIVE

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
