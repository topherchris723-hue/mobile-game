# Release Review
Commit: 50aaab2b64625c367475e7f4ac9299e208bfdac6
Date: 2026-11-03
Reviewer run: 2

Build under review: `6a4d7d0` (the build commit named by the Producer). I reviewed HEAD `50aaab2`. `git diff --stat 6a4d7d0 HEAD`
shows no change to `src/`, `data/`, `index.html`, `styles/`, `android/`, `package*.json`, `vite.config.js` or `scripts/`.
The diff only touches `reports/` (compliance and QA files), `store/privacy-policy.md` (header text) and
`docs/art-prompts/char_rook_001.md` ("street fighter" changed to "street brawler", which removes a franchise echo from an
image prompt). The release bundle built from HEAD is `index-CIYCSK_g.js`, which is the same hash that compliance recorded
for `6a4d7d0`. So this verdict covers both `6a4d7d0` and `50aaab2`.

Read first: `lessons/_shared.md`, `lessons/release-reviewer.md` (empty), `docs/GAME_BRIEF.md`, `docs/GDD.md` (§1–4, §11–14,
§17–19). I did not read `reports/qa/`, `docs/STATUS.md`, agent reports or commit message bodies. I opened
`reports/compliance/round-7b.md` only for checklist item E (which commit it names, and its FAIL count). I ran everything on a
clean `git archive HEAD` export in the scratchpad. In the shared tree I wrote nothing except this file and
`reports/review-evidence/run-2/`.

## Results
A Stability: PASS
- Clean install: `npm ci` succeeded. `npm audit --omit=dev` found 0 vulnerabilities. The 6 moderate advisories are all in
  the dev-only `@capacitor/cli` tool chain.
- `npm test`: 633 of 633 tests passed in 47 files (`run-2/npm-test.log`).
- `npm run build` succeeded. `npm run validate-data` passed (10 files, 0 errors). `npm run android:check` passed 46 checks
  (`run-2/npm-build.log`).
- Full Playwright suite: 91 of 91 passed, rc=0 (`run-2/e2e-full.log`). Local note: the lock-file Playwright 1.56.1 expects
  chromium-1194, but only 1243 is installed here, so I ran the suite with the config's own `PW_CHROMIUM` override.
- My own bot played 1,000 seeded battles (seeds 31000–31999), 200 on each of stages 001–005. It used 4 player modes:
  random fuzzer with pause and retreat, greedy, AI player at a random tier, and idle. Teams were random, at R0–R4.
  Result: 0 crashes, 0 NaN or negative values, 0 values over their maximum, 0 stuck timers and 0 battles that never ended
  (`run-2/bot-run.json`).
- Negative control for the bot: a 100-tick cap reports 20 of 20 battles as problems (`run-2/bot-negative-control.txt`).
- Release-build playthrough with no test hooks (`window.__TEST__` absent) at 360×640: Title → Home → Story → dialogue →
  Team → stage_001 won in 72 s real time → Result → page closed and reopened.
  - 0 console errors and 0 page errors. The only messages were headless software-GL warnings.
  - The save after the win (Jade 1400, stage_001 cleared, 2 missions, tutorial completed) was identical after the reload
    (`saveIntact: true`, `run-2/release-run/`).
- Screen walk at 5 sizes: 0 errors. Modal probe: while Pause or the Retreat confirm is open, taps on the cards, bench,
  IGNITE and TRI-BURST under it change nothing (`run-2/modal-probe.json`).

B Mobile: PASS
- Every screen was captured at 360×640, 360×800, 390×844, 430×932 and 768×1024. Screens: title, home, story, dialogue,
  team select, battle, pause, settings from pause, retreat confirm, result, summon, rates, confirm, reveal, results, team,
  settings, licenses. Contact sheets are in `run-2/screens/*-all-screens.jpg`, and the full-size 360×640 shots are in
  `run-2/screens/`.
- Target audit (`targets-report.json`): 0 targets under 44 px and 0 targets off screen. The only overlaps reported are the
  modal panels sitting over the battle HUD and the summon buttons. The probe shows those modals block input underneath.
- Safe areas: the top bar and bottom buttons are inset at every size.
- Performance on the release build, Canvas renderer, stage_001 with card spam, 3 runs (`run-2/perf.txt`):
  - unthrottled: median 16.7 ms, p95 16.7–16.8 ms;
  - 4× CPU throttle: median 16.7 ms, p95 33.3 ms (the limit is ≤ 33.3 ms), about 55 fps on average.
  - The suite's heavy-effects run (stage_005 with Climax, Ignition and Tri-Burst) at 4× CPU: p95 27.8 ms.
- First load: 891 ms cold from a local server (DOMContentLoaded 305 ms). Bundle size is 461 kB gzip.
- NOT VERIFIED (cannot run here): WebGL frame time on a real phone. This headless container has only software GL, which
  gives about 117 ms per frame in any build, so it does not show how a phone would run. The owner's pre-release playtest
  on a real device covers this.
- One minor layout issue was found (R-1).

C Scope: PASS
- Brief milestone "Battle + summon screen", 6–10 fighters, 3–5 stages:
  - 8 original fighters, all playable, with 52 cards. 5 story stages.
  - Real-time 1v1 battles with teams of 3 and tagging.
  - A card hand that costs Vigor, swipe to dash and Slip, combos, Perfect Slip / Riposte counters.
  - Ignition transformations for 6 of 8 fighters (GDD §6 allows ★3 fighters without one) and the Tri-Burst team finisher.
  - A summon screen with rates, pity, confirm, reveal and results. Plus team select, settings, licenses and a save.
- GDD §4 flow: every screen can be reached, and every screen leads back to Home.
- No shop and no real-money UI.
- Every card is played in my AI-vs-AI runs, and every card produces a hit or an effect: 0 cards never played, 0 played with
  no outcome. Counts: 3,704 Ignitions, 2,181 Tri-Bursts, 4,322 Perfect Slips, 4,260 Ripostes (`run-2/cards.json`).
- First battle: the stage_001 tutorial prompts in turn for tap card, combo, Slip (with slow-mo), Vigor and Tag. A new player
  is taught the controls inside the first battle.

D Fairness & content: PASS
- Displayed rates match the real rates (`run-2/gacha.json`). 200,000 seeded single pulls through the shipped `summon()`:
  - ★5 2.97% / ★4 17.00% / ★3 80.03%, against 3.00 / 17.00 / 80.00 shown;
  - each fighter is within 4σ of the rate shown (Solenne / Corvane 1.50%, ★4 5.67% each, ★3 26.67% each);
  - 0 deviations.
- Pity: 100,000 chained pulls; the longest gap between ★5s is exactly 40, and 30% of ★5s arrive on pull 40.
- 5,000 fresh saves: every first ×10 gives at least one ★5, and every later ×10 gives at least one ★4.
- Cost is consistent in 5,000 of 5,000 runs. An unaffordable summon is rejected with no charge.
- Every stage can be won. A greedy bot wins stages 1–5 in 250 of 250 battles, and the AI-master player wins 48 of 50 on
  stage 5. The idle player loses every time.
- Content is original:
  - Names checked by the validator against the GDD §3 banned list.
  - No franchise names in `data/`, `src/` or `store/`.
  - The Rook prompt no longer says "street fighter".
- Assets: only the self-made icons and procedural audio, plus system fonts. Each one has a row in `assets/CREDITS.md`, and
  the licence notices are shipped and shown in Settings → Licenses.

E Release readiness: PASS
- Compliance: `reports/compliance/round-7b.md` names build commit `6a4d7d0` with 8 PASS and 0 FAIL. Since then nothing that
  ships has changed (same bundle hash).
- App identity:
  - Capacitor `appName` and Android `app_name` are "Fyrenza"; `appId` is `com.animecardbattler.game`.
  - `versionName` 0.1.0, `versionCode` 1, `targetSdk` 36, `minSdk` 24.
  - Portrait lock is set. Adaptive and round icons are present.
  - `INTERNET` permission is removed; `VIBRATE` is the only permission.
- No debug UI in the release bundle:
  - 0 occurrences of `__TEST__`, `?test`, `VITE_`, `localhost` or "Jade Tempest".
  - "debug" and "prototype" hits are Phaser and ajv internals only.
  - `?renderer=canvas` is an intended fallback.
- Secrets: none found in the tree or the bundle, and no keystore or `.env` file. The signing gate in
  `.github/workflows/build-android.yml` requires `VERDICT: PASS`.
- Owner-only fields remain in `store/privacy-policy.md` (`[DEVELOPER NAME]`, `[CONTACT EMAIL]`, date). Filling them is a
  CLAUDE.md §8 owner task and does not affect the build.

## Findings
### R-1: Enemy "COMBO xN" counter is partly hidden behind the tutorial prompt box in the first battle
Severity: MINOR
Evidence:
- `run-2/combo/390x844-cover-0.png` and `360x640-cover-0.png`, plus the numbers in `run-2/combo/combo-cover-by-name.json`.
- What happens: during the stage_001 tutorial, the enemy combo counter (`BattleScene.enemyCombo` at `arena.top + 56`, depth
  51) is drawn under the prompt box (`tutLayer`, depth 70, y = `arena.top + 12`, height ≥ 48). Up to 65% of the text height
  is covered.
- How often: 32 of 581 samples at 360×640 and about 12% of samples at 390×844. The player's "N HITS" line touches the box
  edge by about 2 px.
- Impact: it happens only while a tutorial prompt is shown, the prompt stays fully readable, and the player's own COMBO
  counter was never covered in my runs.
- Likely fix: move the combo rests below `tutRect` while the tutorial is active, or reserve the box in the rest-position
  layout. The BUG-7b-01 pop clamp only limits scale, not the rest position.
Suggested owner: ui-developer

### R-2: "Not enough Vigor" message runs into the bench portrait and the "QUEUED" tag sits on the Vigor bar
Severity: POLISH
Evidence: `run-2/combo/360x640-cover-0.png`, lower left. "Not enough Vigor" starts right at the Dunmore portrait's edge
("DunmoreNot enough Vigor"). The "QUEUED" label overlaps the first Vigor segments. Both are readable.
Suggested owner: ui-developer

### R-3: Licenses text keeps the original hard line breaks
Severity: POLISH
Evidence: `run-2/screens/360x640-20-licenses.png`. The MIT text is wrapped to the screen and also broken at its original
line ends, which gives ragged lines ("…to any / person obtaining a copy / of this software…"). The text is complete and
scrollable.
Suggested owner: ui-developer

### R-4: Lock-file Playwright needs a browser build that this machine does not have
Severity: POLISH (tooling, not shipped)
Evidence: after a clean `npm ci`, `npx playwright test` fails at launch, because `@playwright/test` 1.56.1 expects
chromium_headless_shell-1194 and only 1243 is installed. It works with `PW_CHROMIUM=<1243 headless shell>`. CI should pin
the browser or run `npx playwright install` so a clean checkout is green without local knowledge.
Suggested owner: release-engineer

## Lesson candidates
- R-1: the float-placer and pop-clamp checks protect shouts and callouts from the combo counters, but nothing checks the
  combo counters' rest positions against the tutorial box. Candidate rule for ui-developer and qa-tester: every fixed HUD
  text in the arena gets a no-overlap check against every overlay that can be visible at the same time (tutorial box,
  intro, cinematic), at 360×640 and 390×844, with a must-FAIL case.
- R-4: "full Playwright green" depended on a local browser override. Logs attached to the Phase 6 entry condition
  (L-shared-020) should come from a clean `npm ci` checkout using only documented commands.

VERDICT: PASS
