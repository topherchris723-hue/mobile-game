# Lessons — content-designer

Read this before every task. Maintained by team-coach. Format: see lessons/README.md.

### L-cd-001: Use unique, descriptive names in generator scripts and run them end to end
Seen: 1 (round 1)
Severity of what it caused: MINOR (crash in a scratch script, caught inside the round)
What happened: Round 1 notes, content-designer lesson candidates — a data generator reused a short
  constant name, which overwrote a value and crashed the script.
Root cause: Short, generic names (e.g. `C`, `D`, `T`) were reused for different things in one
  scratch script.
Rule: In any script that generates or checks data, give every constant a descriptive, unique name
  (e.g. `CARD_ID_PREFIX`, not `C`), never reassign a constant, and run the script from a clean
  start before using its output. Report the command you ran.
Status: ACTIVE

### L-cd-002: Re-check data against the GDD every round, not against your playbook's memory
Seen: 1 (round 1)
Severity of what it caused: MINOR (caught inside the round)
What happened: Round 1 notes items 4 and 6 — the "You own" list in the content-designer playbook
  was stale (skills.json, story/*.json), and the banned-term scan had to be built by hand.
Root cause: Paths and banned terms were taken from the playbook/task text instead of the GDD.
Rule: At the start of every task, (1) take file paths from GDD §15.1 (L-shared-007), (2) take the
  banned-term list from GDD §3 (L-shared-008), (3) run your validator on good AND broken data
  (L-shared-006). Report all three in "Schema validation".
Status: ACTIVE
