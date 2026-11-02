# Release Review
Commit: 48fb51906897fe0e266c945f4f94ab0ef5aa71c0
Date: 2026-10-24
Reviewer run: 1

Read first: `lessons/_shared.md`, `lessons/release-reviewer.md` (empty), `docs/GAME_BRIEF.md`, `docs/GDD.md`
(§1–4, §9, §11, §14, §17.4–17.5). I did not read `reports/qa/`, `docs/STATUS.md`, agent reports or commit messages.
Everything was run on a clean `git archive` export of the commit in a scratchpad. The shared tree was not touched,
except for writing this file and `reports/review-evidence/`.

## Results
A Stability: PASS. `npm ci` gave 0 vulnerabilities. `npm test` passed 570/570 tests in 40 files (`review-evidence/npm-test.log`).
  `npm run build` succeeded (`npm-build.log`) and `npm run validate-data` passed with 0 errors. My own bot played 1,000
  seeded battles: 200 per stage on stages 001–005, using 4 player modes (random-input fuzzer with pause and retreat, greedy
  human-like bot, AI player of a random tier, idle player), random teams and resonance R0–R4. Result: 0 crashes,
  0 NaN or negative values, 0 HP/Vigor/Burst over max, 0 stuck timers and 0 battles that never ended
  (`bot-run.json`, `scripts/reviewer-bot.mjs`). Negative controls: a 100-tick cap reports "never ended", and an
  injected `clamp() → -1` is caught as "x negative". Release-build playthrough at 360×640: Title → Story → dialogue
  → Team → stage_001 tutorial battle won → Result → reload. There were 0 console errors and 0 page errors. The only
  messages were Chromium software-GL warnings from the headless environment. Save after the win (Jade 1400,
  stage_001 cleared, missions 2/3, tutorial done) was identical after closing and reloading the page, and stage 2
  unlocked (`release-run/release-run.json`, `r08-result.png`, `r09-story-after-reload.png`).

B Mobile: FAIL. Layout passes: all 20 screens and states captured at 360×640, 390×844, 430×932 and 768×1024
  (`screens/`). I found no clipped or overlapping text or buttons. Every touch target is at least 44×44 at every size
  and none is off screen. Minimum gap between targets is 8 px (`gaps.json`). The only target overlaps are modal dialogs
  (pause, retreat, rates) over the HUD, and taps went to the modal. Safe-area insets are applied in
  `styles/*.css`. First load: canvas shown 1.16 s cold (DOMContentLoaded 377 ms). Performance fails (R-2): with 4× CPU
  throttling, p95 frame time is 36–50 ms, which breaks the project's own AC-17.7 and the 30 fps minimum.

C Scope: PASS. The brief and GDD §4 milestone are present and working. Real-time 1v1 against AI. Teams of 3 with Tag.
  Cards with Vigor cost that refill. Swipe to Dash and Slip. Combos, Perfect Slip and Riposte counter. Ignition
  transformation. Tri-Burst team finisher. 8 original fighters (brief: 6–10). 5 story stages (brief: 3–5) with
  unlocks, dialogue and Skip. Summon screen with rates, pity and reveal. Team screen, Settings, Result. In simulations
  all 52 cards were played and every one landed hits. Ignition, Tri-Burst, Riposte, Tag Strike and Climax all fired
  thousands of times (`cards.json`). The stage_001 tutorial prompts ("Tap a card to attack!", "He's stunned! Tap
  another card to COMBO!") teach the controls in the first battle. There is no shop and no real money.

D Fairness & content: PASS, with a minor IP note (R-7).
  - Displayed rates are ★5 3.00% (1.50% per featured fighter), ★4 17.00% (5.67% each) and ★3 80.00% (26.67% each).
    Measured over 200,000 base pulls through the shipped `summon()`: 2.97 / 17.00 / 80.03%, and every fighter is
    within 4σ of its displayed rate (`gacha.json`).
  - Pity: the longest run without a ★5 in 100,000 chained pulls was 40, which matches "guaranteed within 40".
  - Multi-pulls: in 5,000 runs, every first ×10 had a ★5 and every later ×10 had a ★4 or better.
  - Not enough Jade: the summon is rejected and no Jade is taken.
  - Balance: the greedy bot won 250/250 across all stages, the AI player won 241/250, and an idle player loses on
    the timer. No stage is unwinnable and no character is broken.
  - IP and licences: the banned-term scan of data and strings is clean (only hits are inside the store-listing
    banned-term checklist itself). `assets/CREDITS.md` covers the procedural audio and the 6 bundled npm packages.
    The repo ships no image, audio or font files.

E Release readiness: FAIL.
  - No compliance report exists for this commit. The only report (`reports/compliance/round-6.md`) is for
    `bf48920` and lists 2 FAIL items (R-1).
  - No app icon and no Android app identity. There is no `capacitor.config.*` and no Capacitor dependency (R-3).
  - The title screen shows "working title — prototype" (R-4).
  - Version 0.1.0 is set. The release bundle contains no `__TEST__` hooks and I saw no debug or cheat UI.
  - No secrets in the repo or the bundle. The only "password" strings in the bundle are Phaser and Ajv library
    code, and the workflows use `secrets.*`.

## Findings
### R-1: No compliance report for the reviewed commit, and the latest report has 2 FAIL items
Severity: BLOCKER
Evidence: `reports/compliance/` contains only `round-6.md`, which says "Build checked: commit `bf48920`". Its summary
table lists "1 IP — FAIL: title 'Jade Tempest' not cleared" and "2 Licenses — FAIL: bundled code libraries ship with
no licence notice". `git diff --stat bf48920 48fb519` shows 31 changed files after that check, including
`src/main.js`, `src/scenes/LicensesScene.js`, `vite.config.js` and `package.json`. Nobody has re-checked compliance
on this commit, and the title FAIL still needs a registry-level trademark check or a title change.
Suggested owner: compliance-checker (re-run on this exact commit); Producer (title decision per GDD §1)

### R-2: Frame time over budget under CPU throttling (AC-17.7 fails, below 30 fps)
Severity: MAJOR
Evidence: The repo's own `tests/e2e/qa-perf.spec.js` "renderer=canvas cpu×4" failed in 3 of 3 runs on this commit,
with p95 of 49.3, 39.6 and 36.5 ms against a limit of 33.3 ms (`review-evidence/qa-perf-run.log`, `e2e-full.log`).
My own probe on the release build, stage_001 with card taps at 4× throttle, measured median 33.3 ms, p95 50.1 ms and
max 133 ms (`perf.json`). Unthrottled Canvas holds 60 fps (median 16.7 ms). Real-device performance is NOT VERIFIED
because this container has no GPU and its WebGL numbers are software-rendered and not representative. On the
low-end proxy the GDD defines, the game drops below 30 fps.
Suggested owner: vfx-developer / ui-developer

### R-3: No app icon or Android app configuration
Severity: MAJOR
Evidence: `git ls-tree -r HEAD` has no icon, adaptive-icon or manifest asset and no `capacitor.config.*`.
`package.json` has no `@capacitor/*` dependency. `.github/workflows/build-android.yml` runs `npx cap add android`,
which needs a Capacitor config with an appId and app name. As committed, the app has no icon, no package id and no
Android versionCode.
Suggested owner: release-engineer

### R-4: Placeholder subtitle on the title screen
Severity: MINOR
Evidence: `review-evidence/screens/360x640-01-title.png` shows "working title — prototype" under the game name
(`strings.json` `game_subtitle`). It must be removed or replaced before a store build. This is linked to the title
decision in R-1.
Suggested owner: ui-developer (after the Producer's title decision)

### R-5: Committed e2e test is out of date (AC-19.1 expects 13 Settings targets, the screen has 14)
Severity: MINOR
Evidence: `npx playwright test` finished with 83 passed and 2 failed (`e2e-full.log`). One failure is R-2. The other is
`qa-settings-audio.spec.js:104`, which expects 13 targets but gets 14 because a Licenses button was added and the
spec was not updated. It fails the same way on rerun. The game screen is correct; the release test suite is red.
Suggested owner: qa-tester

### R-6: Summon reveal shows the final Jade balance before the results are revealed
Severity: POLISH
Evidence: `screens/360x640-16-summon-reveal.png` shows "2 / 10" with Jade 20 already displayed. That Jade came from
duplicates that are only revealed later, so the counter gives away the results.
Suggested owner: ui-developer

### R-7: Rook's look may read as an echo of a famous anime design
Severity: MINOR
Evidence: `screens/sheet-color.png` shows Rook with a green body, a black-and-white checkered band and spiky black
hair. Green-and-black checks are the signature pattern of a well-known anime protagonist. On its own this is
probably transformed enough, but art-director should confirm or change the pattern before store screenshots are
made.
Suggested owner: art-director

### R-8: Settings volume rows are cramped
Severity: POLISH
Evidence: `screens/360x640-19-settings.png`. The "Music" and "Sound effects" labels sit right under the previous
row's −/+ buttons. The 8 px target gap is met, but the rows look crowded.
Suggested owner: ui-developer

## Lesson candidates
- Compliance was not re-run on the commit sent to review. Its last report already had 2 FAIL items, and 31 files
  changed after it. Proposed rule for the Producer: do not call release-reviewer unless
  `reports/compliance/*.md` names the exact HEAD commit and has 0 FAIL items.
- The full Playwright suite was red at review time: a perf AC failed and one spec was stale. Proposed rule: the
  Producer runs `npx playwright test` and `npm test` on the exact commit and attaches green results before calling
  the reviewer. Every UI change that adds a target updates the specs that count targets (L-shared-009 part 3).
- Checklist E needs an app icon and app identity, but CLAUDE.md §4 only calls release-engineer after a PASS. Proposed
  rule: release-engineer prepares Capacitor config, icon and versionCode in the Launch phase, before release review.
  Only signing and building stay after the PASS.

VERDICT: FAIL
