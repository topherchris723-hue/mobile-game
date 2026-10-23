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
Seen: 3 (rounds 1, 2, 3)
Severity of what it caused: MINOR (caught inside the round each time)
What happened: Round 3 — the §6/§7/§8 band and budget tables existed only as GDD tables. The validator
  did not check them (Fist power 9.9 and ★3 ATK 2000 both PASSED) until rules 10–12 were added mid-round
  after the balance-analyst reported it. Round 1 — GDD §2 described a Perfect Slip → Riposte tutorial prompt, but the tutorial
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
Status: PROMOTED (round 2); merged into playbook "READY checklist" item 1 (round 3 step C)

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
  Round 3: worked. The §5.0 counting convention was added and no tick-count defect was found.
Status: PROMOTED (round 2); merged into playbook "READY checklist" item 2 (round 3 step C)

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
Seen: 2 (rounds 2, 3)
Severity of what it caused: MINOR
What happened: Round 3 — the rush invulnerability exception (AC-5.10.9) did not walk every branch of
  the first-hit rule it overrides. The gameplay-programmer found the uncovered branch, and a ruling
  had to be added mid-round. Round 2 — BUG-2-08 — §5.9 said Ignition cancels the enemy's "current card"; the GDD never said
  whether that includes a Tri-Burst rush. In the build, enemy Ignition cancelled the player's rush and
  the full 100 Burst gauge was lost with no refund and `burstUsed = false`. Fixed in round 2 with the
  §5.0 Tri-Burst lock and AC-5.9.7 / AC-5.10.6 / AC-5.10.7.
Root cause: A generic "cancel the current action" rule was written without walking through every
  action that can be in progress (cards, Riposte, Tag, Tri-Burst rush, cinematics) and without
  saying what happens to the resources already spent.
Rule: For every rule that cancels, interrupts, stuns, KOs or swaps a fighter, add a table: each
  action that can be in progress → interrupted or exempt → what happens to its spent resource (Vigor,
  Burst, cooldown, "used" flags). Add an AC for every exempt case and every refund case. The same
  applies to every exception to an existing rule: walk every branch of the rule being overridden.
Status: PROMOTED (round 3); in playbook "READY checklist" item 4

### L-gd-007: Work every AC with the default data before marking a section READY
Seen: 6 (round 2: AC-5.11.2, approach timeout, AC-5.8.5; round 3: BAL-5.10 population, AC-5.8.5
  precondition, battle-length target unreachable inside the bands)
Severity of what it caused: MINOR (found by gameplay-programmer while building; 12 decisions where the
  GDD was silent)
What happened: Round-2 notes — AC-5.11.2 left out one input of its formula; the approach timeout can
  never fire with the default data in `data/battle.json`; AC-5.8.5 uses `chain_index` without saying
  whether it is 0- or 1-based or when it resets (still open). Gameplay-programmer also had to make 12
  decisions where the GDD was silent (11 adopted). Round 3 — BAL-5.10 said "same-tier stage enemy"
  without defining the population, and no single value could meet it. AC-5.8.5's precondition was not
  traced through every way the state can be entered. The BAL-5.14 battle-length target (120–200 s)
  could not be reached by any values inside the §6 bands; HP ×2 needed a band change.
Root cause: ACs were written as statements, not computed. Nobody plugged the default data into each
  formula, checked that each timer can actually be reached, or defined each index before marking
  §5 READY.
Rule: Before marking any section READY, for every AC: (1) list every input value and where it comes
  from in data, (2) show the arithmetic to the expected result, (3) state whether the default data can
  reach the condition (if not, say so and give the data change that reaches it), (4) define every
  index and counter (0- or 1-based, when it resets). Put a "Worked ACs" table in your report. Answer
  every "Decisions the GDD did not cover" item from the programmer's last report in the GDD in the
  same round, marked as a ruling. Also trace every precondition through every route into the state it
  depends on, name the exact population of every balance target, and check that every target is
  reachable with values inside the GDD bands.
  Round 3: partly worked. AC arithmetic defects fell, but reachability, population and precondition
  defects repeated. This is why step C turned the rule into the playbook "READY checklist" item 3 and
  proposed a programmer spec review (see TEAM_CHANGELOG round 3).
Status: PROMOTED (round 2); merged into playbook "READY checklist" item 3 (round 3 step C)

### L-gd-008: Worked examples use the frozen FX-GDD fixture, and every AC states its class
Seen: 1 (round 3)
Severity of what it caused: MINOR (blocked tuning)
What happened: Round-3 notes — §5.9's worked example and AC-5.9.1/5.9.3/5.9.6 and AC-8.1 used Tavi's
  live Ignition values and 8,200 HP, so the balance-analyst could not tune Tavi without breaking ACs
  and tests. The ruling in GDD §15.4 added FX-GDD and the W/X/P classes.
Root cause: Worked examples were written against the live content, which is meant to be tuned.
Rule: Every AC's first line states its class (W / X / P, GDD §15.4). W examples use only FX-GDD values,
  X uses inline literals, and P computes expectations from live data. Keep the GDD reference numbers
  equal to FX-GDD. An AC with a live content number and no class is a defect.
Status: ACTIVE; in playbook "READY checklist" item 3 (round 3 step C)
