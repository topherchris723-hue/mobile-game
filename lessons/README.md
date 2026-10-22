# Lessons

This folder is the team's memory. Agents forget everything between sessions; these files
are how they stop repeating mistakes.

- `_shared.md` — rules for every agent
- `<agent-name>.md` — rules for one agent (same name as its file in `.claude/agents/`)

Every agent reads `_shared.md` and its own file **before** starting any task.
Only `team-coach` writes here (agents suggest lessons via "Lesson candidates" in reports).

## Lesson format

```
### L-<agent-short>-<number>: <rule, written as an instruction>
Seen: <count> (rounds <list>)
Severity of what it caused: BLOCKER | MAJOR | MINOR | POLISH | OWNER FEEDBACK
What happened: <one or two sentences, with bug ID>
Root cause: <why it happened — the thing the agent could have done differently>
Rule: <exact thing to do from now on, checkable>
Status: ACTIVE | PROMOTED (round <N>)
```

### Example
```
### L-gp-001: Clamp every multiplier chain to the GDD maximum
Seen: 2 (rounds 3, 5)
Severity of what it caused: BLOCKER
What happened: BUG-3-04 — stacking three ATK buffs gave Infinity damage and froze battle.
Root cause: Multipliers were applied without a cap, and no test used stacked buffs.
Rule: After any multiplier is applied, clamp to the GDD max. Add a unit test that stacks
  every buff in data at once.
Status: PROMOTED (round 5)
```

## Rules for lessons
- Write rules as instructions someone can check ("Run X", "Never Y"), not feelings
  ("be more careful").
- One lesson per root cause. Same cause again → increase `Seen`, don't duplicate.
- Never delete; merge duplicates and keep the history.
- `Seen ≥ 2`, BLOCKER, reviewer FAIL, or owner feedback → promote to the agent's
  `## Hard rules`.
