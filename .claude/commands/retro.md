---
description: Run the end-of-round retrospective — turn this round's failures and feedback into lessons and upgrade the agents' playbooks.
---

Run the retrospective for the current round.

1. Read `docs/STATUS.md` to get the round number $ARGUMENTS (if no number was given, use
   the current round).
2. If the owner wrote feedback in this conversation or in `docs/STATUS.md` under
   "Owner feedback", copy it word for word into `docs/STATUS.md` so the coach can see it.
3. Call the `team-coach` agent. Tell it the round number and whether this round is a
   multiple of 3 (if so, it must also run the playbook upgrade, step C).
4. Read the coach's report. Check that it did not weaken any rule listed in its
   guardrails by running `git diff .claude/agents/release-reviewer.md` and reviewing all
   changes to `.claude/agents/`. Revert any change that loosens a rule.
5. Add a one-line summary of the retro to the round log in `docs/STATUS.md`.
6. Commit with message `round <N>: retro`.
