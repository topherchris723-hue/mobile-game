# Lessons — team-coach

Read this before every task. Maintained by team-coach. Format: see lessons/README.md.

### L-tc-001: Audit every agent's "You own" list against GDD §15 and the files it actually changed, at each retro
Seen: 2 (rounds 1, 2)
Severity of what it caused: MINOR (caught inside the round both times)
What happened: Round 1 — content-designer's playbook listed `data/skills.json` and `data/story/*.json`;
  GDD §15.1 defines `data/cards.json` and `data/story.json`. Round 2 — ui-developer wrote Vitest tests
  in `tests/ui/`, `playwright.config.js`, `tests/e2e/smoke.spec.js` and `src/main.js`; gameplay-programmer
  was assigned `package.json` (whose scripts release-engineer's playbook claims), configs, `scripts/`,
  `tests/data`, `tests/fixtures`, `tests/helpers`; none of these were in any "You own" list, and
  qa-tester's "You own" claims all of `tests/e2e/`.
Root cause: The starter playbooks were written before the GDD fixed the file layout and before any
  code existed, and nothing re-checks them against the GDD or against what agents really touch.
Rule: In every retro, compare each agent's "You own" paths, schema lists and script names
  (e.g. `npm run validate-data`) with GDD §15 AND with the files that agent changed this round
  (`git log --name-only` over the round's commits). List every mismatch or double claim in the retro
  report as an exact correction for the Producer (or fix it during a step-C upgrade and log it).
Status: PROMOTED (round 2)
