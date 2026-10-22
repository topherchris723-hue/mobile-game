# Lessons — team-coach

Read this before every task. Maintained by team-coach. Format: see lessons/README.md.

### L-tc-001: Audit every agent's "You own" list against GDD §15 at each retro
Seen: 1 (round 1)
Severity of what it caused: MINOR (caught inside the round)
What happened: Round 1 notes item 6 — content-designer's playbook listed `data/skills.json` and
  `data/story/*.json`; GDD §15.1 defines `data/cards.json` and `data/story.json` and assigns
  banners/economy/battle to content-designer. The Producer's prompt copied the stale paths.
Root cause: The starter playbooks were written before the GDD fixed the file layout, and nothing
  re-checks them when the GDD changes.
Rule: In every retro, compare each agent's "You own" paths, schema lists and script names
  (e.g. `npm run validate-data`) with GDD §15. List every mismatch in the retro report as an
  exact correction for the Producer (or fix it during a step-C upgrade and log it).
Status: ACTIVE
