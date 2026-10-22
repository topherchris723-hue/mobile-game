---
description: Run one full production round of the game pipeline as described in CLAUDE.md.
---

Run one production round now, following `CLAUDE.md` exactly.

Goal for this round (if given): $ARGUMENTS
If no goal was given, take the "Next" goal from `docs/STATUS.md`.

1. Read the source-of-truth files (CLAUDE.md section 1).
2. Increase the round number in `docs/STATUS.md` and write the round plan.
3. Run every pipeline phase that applies to the current project phase.
4. Run `/retro` for this round.
5. Update `docs/STATUS.md` with the result, verdict and next goal.
6. If running unattended, commit to a `claude/round-<N>` branch and open a pull request
   summarizing the round. Otherwise commit to the current branch.
