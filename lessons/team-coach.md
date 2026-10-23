# Lessons — team-coach

Read this before every task. Maintained by team-coach. Format: see lessons/README.md.

### L-tc-001: Audit every agent's "You own" list against GDD §15 and the files it actually changed, at each retro
Seen: 3 (rounds 1, 2, 3)
Severity of what it caused: MINOR (caught inside the round both times)
What happened: Round 1 — content-designer's playbook listed `data/skills.json` and `data/story/*.json`;
  GDD §15.1 defines `data/cards.json` and `data/story.json`. Round 2 — ui-developer wrote Vitest tests
  in `tests/ui/`, `playwright.config.js`, `tests/e2e/smoke.spec.js` and `src/main.js`; gameplay-programmer
  was assigned `package.json` (whose scripts release-engineer's playbook claims), configs, `scripts/`,
  `tests/data`, `tests/fixtures`, `tests/helpers`; none of these were in any "You own" list, and
  qa-tester's "You own" claims all of `tests/e2e/`. Round 3 — the balance-analyst edited
  `data/economy.json` power_formula, by a Producer decision only. GDD §15.1 does not name
  balance-analyst as a tuner of characters/cards/enemies, and WIP commits mix agents' files.
Root cause: The starter playbooks were written before the GDD fixed the file layout and before any
  code existed, and nothing re-checks them against the GDD or against what agents really touch.
Rule: In every retro, compare each agent's "You own" paths, schema lists and script names
  (e.g. `npm run validate-data`) with GDD §15 AND with the files that agent changed this round
  (`git log --name-only` over the round's commits). List every mismatch or double claim in the retro
  report as an exact correction for the Producer (or fix it during a step-C upgrade and log it).
Status: PROMOTED (round 2)

### L-tc-002: Read a file fully before writing it, and check that no lesson disappeared after every retro
Seen: 1 (round 2 retro, found in round 3)
Severity of what it caused: BLOCKER for the lessons system (5 lessons deleted, against the guardrail
  "never delete lessons")
What happened: In the round-2 retro I wrote `open(p,'w').write(open(p).read().replace(...))`. Opening
  for writing truncated each file before it was read, so `lessons/gameplay-programmer.md` (L-gp-001)
  and `lessons/ui-developer.md` (L-ui-001..004) were committed empty in `f55ecb1`. The agents' hard
  rules survived in their playbooks, but the lesson history was gone for all of round 3.
Root cause: An unsafe one-liner edit, and no check after writing. I reported "lessons added" without
  evidence (against L-shared-002).
Rule: Never open a file for writing in the same expression that reads it: read into a variable, then
  write. After every retro, run a check that every lesson ID present at the start of the retro is still
  present (`grep -ho "^### L-[a-z]*-[0-9]*" lessons/*.md` before vs after) and that no lessons file
  shrank. Paste the counts in the retro report.
Status: PROMOTED (round 3)
