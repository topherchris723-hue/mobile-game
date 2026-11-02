# Round 6 — Producer notes (input for /retro; STEP C round)

Launch: compliance (5 PASS / 2 FAIL / 1 N/A on bf48920), store listing, licence-notice fix,
release review on 48fb519 → VERDICT: FAIL (1 blocker, 2 major, 3 minor, 2 polish).

## Reviewer findings (all bugs QA/compliance/Producer should have caught first)
- R-1 BLOCKER (Producer process + compliance-checker): reviewer called without a compliance report
  on the exact commit with 0 FAIL; title trademark FAIL needs an owner decision (legal clearance =
  paid, §8). Producer called the reviewer too early.
- R-2 MAJOR (vfx-developer/ui-developer; QA judged "noise"): AC-17.7 perf failed 3/3 at 4× CPU
  (p95 36.5–50.1 ms vs 33.3). QA round 5 measured no *regression* but the absolute limit fails —
  QA PASSed with the check failing and marked NOT VERIFIED; reviewer treats a failing check as a
  failure. Producer accepted that.
- R-3 MAJOR (release-engineer / Producer pipeline): no capacitor.config, icon, package id, version
  code. CLAUDE.md §4 calls release-engineer only after PASS, but the review checklist needs app
  identity. Pipeline gap.
- R-4 MINOR (ui-developer): title screen still says "working title — prototype".
- R-5 MINOR (qa-tester): qa-settings-audio.spec.js expects 13 Settings buttons (now 14) — test not
  updated when ui-developer added Licenses; the full Playwright suite wasn't run before review.
- R-6 POLISH (ui-developer): summon reveal shows final Jade from pull 2 (spoils duplicates).
- R-7 MINOR (art-director): Rook's look (green body, checkered band, black hair) may echo a famous
  anime protagonist — design check.
- R-8 POLISH (ui-developer): Settings volume rows cramped.

## Other round-6 findings
- Compliance: "Jade Tempest" contains Atari's live TEMPEST mark (Class 9) and is a Monster Hunter
  weapon name; round-1 title search only checked the exact phrase.
- Compliance: code libraries shipped without licence notices for 5 rounds (CREDITS/playbooks only
  covered "assets"). Fixed: generated notices + Settings → Licenses + must-FAIL test.
- Store-writer: existing screenshots unusable (test-hook values, 430x932 breaks 2:1); no shell to
  count characters (Producer counted).
- Usage limit hit once (13:15–16:30).

## Agent lesson candidates (summary)
- compliance-checker: check bundled code-library licences whenever package.json/build changes;
  title search per distinctive word + franchise wikis; plan human clearance early.
- store-writer: never reuse QA screenshots; 9:16 at 1080×1920; needs a char-count step.
- ui-developer: prefix scene method names (Phaser `load` clash); runtime fetch must check content
  (HTML fallback 200).
- art-director: when CREDITS gains a row, verify the notice it points to exists.
- release-reviewer (process): reviewer only with exact-commit compliance at 0 FAIL and a green full
  e2e suite; release-engineer prepares identity/config before review, signs/builds after PASS.
- qa-tester: a failing absolute check is a FAIL, not "noise", unless the Producer formally changed
  the method; when a UI change adds controls, update count-based specs.

## Owner feedback this round
- none (title question pending).
