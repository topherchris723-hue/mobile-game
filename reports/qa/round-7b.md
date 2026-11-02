# QA report: round 7b (Fyrenza rename)

**Commit tested: `f086934`** (branch `claude/new-session-uo46wt`).
- All suites ran on clean `git archive f086934` exports in the scratchpad (`…/scratchpad/r7d/tree`, `…/r7d/bld`), with `node_modules` linked from the main tree.
- When I finished, HEAD was `4b6bf55`. `git diff --stat f086934 HEAD -- src data tests index.html vite.config.js scripts android store capacitor.config.json package.json` is empty. The later commits touch only `docs/`, the round-8 art prompts and QA evidence/tools under `reports/`.
- `tests/` in the main tree is exactly as in `f086934`. A cut-off earlier run had left `tests/e2e/qa-title.spec.js` and `tests/sim/ac-1-1.mjs` in the tree. I moved them to `reports/qa/round-7b-tools/` and ran them only from scratch copies.
- Playwright used `PW_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`.
- Evidence (logs and screenshots): `reports/screenshots/round-7/qa/recheck-f086934/`.

Tester: qa-tester. Date: 2026-11-02. Baseline: last PASS `d09623e`.

**QA VERDICT: FAIL.** The full `npx playwright test` on `f086934` is red: 87/88. `qa-busy.spec.js` found a floating-text overlap (BUG-7b-01, MINOR). The playbook says "any red test = FAIL, whatever the cause" (L-shared-021). Every rename check (AC-1.1 a/b/c, licences, Android identity, bundle, sweeps, perf) passes.

## 1. Checklist

| # | Check | Result |
|---|---|---|
| 1 | `npx vitest run` (full) | **609/609**, 46 files, exit 0 (`vitest.log`) |
| 1 | Full `npx playwright test` | **FAIL: 87 passed, 1 failed, 40 skipped by design; exit 1** (`e2e-full.log`). Failed: `qa-busy.spec.js:53` "QA busy battle frames: floating texts never overlap (BUG-2-10) at 3 sizes". Message: `360x640 tick 786: "COMBO x2"(a1) × "NOONDAY HALO!"(a1) 11x1`. See BUG-7b-01 |
| — | `validate-data` | PASS, 10 files, 0 errors, 0 warnings |
| — | `node android/tools/check-identity.mjs` | `check-identity: PASS (46 checks, source only)`. Must-FAIL: `appName` = "Jade Tempest" in a copy gives `FAIL appName is "Fyrenza" (got "Jade Tempest")`, exit FAIL |
| — | `title_activity_main == appName` | `strings.xml`: `app_name` = `title_activity_main` = "Fyrenza"; `capacitor.config.json` `appName` = "Fyrenza"; `strings.json` `game_title` = "Fyrenza"; `index.html` `<title>` = "Fyrenza". All equal. Note: `check-identity` does not check `title_activity_main`. The project suite still catches a change there, through `app-name.test.js` (b), which greps `res/values` |
| 3 | Bot playthrough (`bot-playthrough.mjs --per-stage 50 --ai-per-stage 8 --seed 7000`) | **410 battles, 0 failed**, 571 rushes checked, average timer 116.7 s (`bot.log`). The bot is unchanged since its earlier fault-injection proof |
| 4 | Busy-frame scan, 3 sizes, longest names | **FAIL** in the full run: 360×640 had 1 overlap in 141 frames; 390×844 and 430×932 had 0 in 140 frames each. Re-runs: see §3 |
| 4 | Screens at 3 sizes (`qa-screens`) | layout scan **0 problems**, console **0 errors** |
| 6 | Console | 0 errors in every spec |
| 8 | Rates | Nothing changed in AI, RNG or rate data since `d09623e`. `git diff --stat d09623e f086934` touches only `strings.json` `game_title`, `index.html`, `vite.config.js`, `scripts/third-party-licenses.mjs`, Android labels, the identity check, the store, docs and tests. No rate checks were needed |
| 9 | Banned terms (fresh from GDD §3: `tests/sim/banned-grep.mjs`) | `terms=44 files=75 hard_hits=0 review_hits=0`, `name_hits=0`. Negative proof on a probe file ("Kamehameha … Super Saiyan"): `hard_hits=4`, exit 1 |
| 10 | Release bundle | Clean `npm run build`: `__TEST__`, `audioDebug`, `battleState`, `eventLog`, `inputLog`, `licensesScreen`, `settingsScreen`, `sfxLog`, `silhouetteSheet`, `summonLog`, `summonReveal`, `summonScreen`, `tutorialStep`, `activeScene`, `particlesNow`, `vfxQuality` and `summonSeed` = **0 each**. With `VITE_TEST_HOOKS=1` every one is > 0. Clean again: 0. `sceneKey` = 3 in the clean build, all inside Phaser's own plugin loader (`systemKey`/`sceneKey` config), not our hook |
| 12 | Placeholder sweep (`prototype\|placeholder\|working title\|TBD\|TODO\|lorem`) | Proof file: 2/3 lines hit. `src/ui/strings.json` 0, `data/` 0, `index.html` 0, `store/` 0. `dist/THIRD_PARTY_LICENSES.txt`, `dist/index.html` and `dist/third-party-packages.json` 0. In `dist/assets` the only hits are JS identifiers (`getPrototypeOf`, `.prototype`, `boolOrEmptySchema`, `AddToDOM`); 0 are player-facing |
| 11 | **Perf: regression gate** vs `d09623e` | Alternating 3 cycles × 2 runs = **6 runs each**, Canvas, 4× CPU, byte-identical perf/script/helper specs in both trees (`perf-ab.log`). Frame-time p95 mean **26.82 ms** vs **26.35 ms**: **Δ +0.47 ms**. Game-work p95 mean **8.62** vs **8.38 ms**: **Δ +0.24 ms**. Both are within +1.0 ms: **PASS** |
| 11 | **Perf: absolute AC-17.7** | `f086934` p95 values: 25.1, 26.1, 27.0, 27.1, 27.5, 28.1. **Median 27.05 ms ≤ 33.3: PASS.** The in-suite run gave 30.2 ms. WebGL and real-device numbers are NOT VERIFIED: this container has no GPU (software GL ~131 ms per frame) |

## 2. AC-1.1 (GDD §1, class P)

The tools are in `reports/qa/round-7b-tools/`:
- `ac-1-1.mjs`: static checks (a), (b), (c), plus (d) label agreement;
- `qa-title.spec.js`: in-browser check of the Title, Home, `document.title` and Settings → Licenses at 3 sizes.

| Part | Must PASS on `f086934` | Must-FAIL runs (scratch copies of `f086934`) |
|---|---|---|
| (a) title from `strings.json`; no literal in `src/scenes`/`src/ui` | `game_title="Fyrenza"`; 29 files scanned; `"Fyrenza"` hits **0** | `'Fyrenza'` literal added to `TitleScene.js` → `(a) literal title in src/scenes/TitleScene.js:45`, exit 1 |
| (b) no player-visible `Jade Tempest` in `src/ data/ index.html capacitor.config.json android res/values` | 86 files; raw hits **0** | `game_title` = "Jade Tempest" → `(b) old title in src/ui/strings.json:5` (1 hit), exit 1. The project test `app-name.test.js` on the same copy fails "(a, notice part)" (`Expected "Fyrenza" / Received "Jade Tempest"`) and "(b)" (2 failed / 5 passed). `title_activity_main` = "Jade Tempest" → `(b) … strings.xml:4` + `(d)`, exit 1 |
| (c) store title exactly "Fyrenza: Card Duels"; no `Jade Tempest` in `store/` | `store/listing.md` App-name block `"Fyrenza: Card Duels"`; 4 store files, 0 old-title hits, 0 other title variants | App-name block = "Fyrenza Arena" → `(c) store title is "Fyrenza Arena"`, plus `(c) title variant in store/listing.md:38`, exit 1 |
| Browser: Title / Home / `<title>` / Licenses | `qa-title.spec.js` **3/3 runs passed** (15.8 s, 14.5 s, 14.4 s). At every size: exactly one 40 px text "Fyrenza" on the Title screen, "Fyrenza" in the Home top bar, `document.title` "Fyrenza", and the Licenses first line "Fyrenza includes the following third-party software.". 0 layout problems, 0 console errors | Copy with `game_title` = "Jade Tempest" → FAIL (`Expected "Fyrenza" / Received "Jade Tempest"`). Copy whose `TitleScene` draws the literal `'Jade Tempest'` → FAIL at all 3 sizes: `Title: 0 texts equal "Fyrenza"; texts=["Jade Tempest","Fight for the Jade Throne","Tap to start"]` and `Title shows old title` |
| `dist/THIRD_PARTY_LICENSES.txt` | First line `Fyrenza includes the following third-party software.`; "jade tempest" count 0 in all of `dist/` | Covered by the `game_title` copy above (the notice title comes from `strings.json`) |

Screenshots (`reports/screenshots/round-7/qa/recheck-f086934/`):
- `360x640-title-ac11-01-title.png`: "Fyrenza" with the subtitle "Fight for the Jade Throne". Centred, no clipping.
- `-02-home.png`: top bar "Fyrenza", Jade 1000, gear.
- `-03-licenses.png`: header line names Fyrenza.

The same set exists for 390×844 and 430×932. I checked the 360×640 set by eye; it is fine.

Coverage note (not a build bug): the project suite has no automated test for AC-1.1 (a) (no literal title in scenes) or (c) (store title). Today only my tools in `reports/qa/round-7b-tools/` check them. They should move into `tests/` in the next build round.

## 3. Bugs

### BUG-7b-01: During a combo pop, "COMBO xN" briefly covers a fighter shout placed next to its reserved zone
Severity: MINOR (transient overlap of two arena texts, about 160 ms; BUG-2-10 / BUG-3-03 class). Because the test is red, this alone makes the QA verdict FAIL.
Owner: ui-developer (`src/scenes/BattleScene.js` combo counter and `measureComboZones`, `src/ui/float-placer.js`)
Steps:
1. On a `git archive f086934` export: `QA_SHOTS=1 npx playwright test tests/e2e/qa-busy.spec.js --project phone-360x640`. Setup: save `clearedSave(4)` + Solenne/Corvane; team Solenne/Corvane/Dunmore; stage_005; `&renderer=canvas&seed=777`; in-page bot; enemy slot 1 KO'd.
2. The scan samples every ~120 ms. It catches the overlap in some runs only.

Expected: no two arena texts overlap in a live frame (BUG-2-10, BUG-3-03: "callouts never cover the combo / hit counter"; L-qa-002 scan).
Actual: `360x640 tick 786: "COMBO x2"(a1) × "NOONDAY HALO!"(a1) 11x1`. The overlap is 11×1 px after the 2 px padding on each side, and the battle state is the same in every run.
- Seen in **2 of 7 runs**: the full suite on `f086934` (1 of 4 `f086934` runs) and run 1 of 3 on `d09623e`.
- The other 5 runs had 0 overlaps.
- So the bug was **already in the last PASS build `d09623e`**. It is not caused by the rename; the d09623e re-check simply did not sample that frame.

Evidence:
- `reports/screenshots/round-7/qa/recheck-f086934/e2e-full.log` (lines 21–26 and the failure block);
- `busy-repeat.log` (3× `f086934` vs 3× `d09623e`);
- `360x640-busy-overlap-1-d09623e.png`: the frame right after detection. The pop has already settled, so the text at rest shows "COMBO x2" just below "NOONDAY HALO!".

Root-cause guess: `BattleScene.js:493-494` pops `comboText` from `setScale(1.5)` to 1 over 160 ms (origin 0, 0.5). The reserved zone from `measureComboZones()` (`BattleScene.js:693-706`) is measured at scale 1 ("COMBO x99"). During the pop the counter grows past its reserve, so a shout placed legally just outside the zone is covered.

Fix direction (owner's choice): reserve the zone at the pop's peak scale, or anchor the pop so it stays inside the zone. The qa-busy exemption covers only COMBO vs HITS.

## 4. Re-tests

There are no open bugs from the last report: BUG-7-01 and BUG-7-02 were verified fixed on `d09623e`. They still hold on `f086934`:
- `third-party-native.test.js` is in the green 609/609;
- the placeholder sweep finds 0 hits.

## 5. Counts

| Severity | Count |
|---|---|
| BLOCKER | 0 |
| MAJOR | 0 |
| MINOR | 1 (BUG-7b-01) |
| POLISH | 0 |

Failing checks: full `npx playwright test` (87/88) and the busy-frame scan (`qa-busy.spec.js`), both from BUG-7b-01.

```
DONE: QA round 7b
Commit tested: f086934
Unit tests: 609/609 (full suite)
E2E tests: 87/88 (full suite; 40 skipped by design) — RED
Bot battles: 410 run, 0 failed
Rate checks: no AI/rate change this round
Perf: regression Δ frame p95 +0.47 ms / Δ game-work p95 +0.24 ms (6 vs 6, alternating, vs d09623e) → PASS; absolute AC-17.7 median p95 27.05 ms → PASS (WebGL/device NOT VERIFIED: no GPU)
Failing checks: full e2e suite (qa-busy.spec.js busy-frame overlap, BUG-7b-01)
Bugs: 0 blocker, 0 major, 1 minor, 0 polish
Re-tested fixes: 2/2 still fixed (BUG-7-01, BUG-7-02)
Repeat bugs (same bug class as a past lesson): BUG-7b-01 (BUG-2-10 / BUG-3-03 floating-text overlap; L-qa-002)
QA VERDICT: FAIL
```

## 6. Lesson candidates

1. **A sampled live scan that catches a transient bug about 1 run in 4 can give a false PASS.** The `d09623e` re-check passed with this bug present.
   - Proposed rule: sample the busy scan every rendered frame (hook `postrender`) instead of every 120 ms.
   - Or, better, add a deterministic geometric check: every animated fixed text, at its peak tween scale, must stay inside its reserved or avoid rectangle.
2. **Tween exemptions in layout specs hide real overlaps.** The "COMBO vs HITS pop-scale" exemption suggested that the pop leaving its reserve was expected. Proposed rule: reserved zones are sized for the peak of every tween on that text, and no spec exempts a pop.
3. **AC must-FAIL cases need a home in the project suite.** AC-1.1 (a) and (c) are only checked by QA tools outside `tests/` this round, because adding tests would change the build commit. Proposed rule: the build agent's AC test covers every must-FAIL case named in the AC, and QA checks that it does.
