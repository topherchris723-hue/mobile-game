# QA report: round 7, loop 1

**Commit tested: `9082d67`** (the build commit).
- Every suite ran on an exact export of that commit (`git archive 9082d67`) in the scratchpad: `…/scratchpad/r7/tree-9082d67`, with `node_modules` linked from the main tree.
- The only files that differ from `9082d67` are my own QA specs:
  - `qa-settings-audio.spec.js`: R-5 fix, WIP-committed by the Producer as `370bfd1`;
  - `qa-summon.spec.js`: new R-6 test.
- HEAD `57d9a52` differs from `9082d67` only in `docs/STATUS.md`.

Tester: qa-tester. Date: 2026-10-25.

**Read first:** the round-6 step-C playbook (full suites on the exact commit, both perf checks, placeholder sweep, "a check that ran and failed is a FAIL") and the hard rules L-shared-021 and L-qa-005; `lessons/*`; `reports/qa/round-5.md`; STATUS reviewer items R-2…R-8.

## 1. Checklist (all on the exact `9082d67` tree)

| # | Check | Result |
|---|---|---|
| 1 | `npx vitest run` (full) | **FAIL: 601/602.** `tests/data/third-party-native.test.js` › "the reviewed list covers every runtime dependency declared in the Gradle files" → `ENOENT … android/capacitor-cordova-android-plugins/build.gradle` → **BUG-7-01** |
| 1 | Full `npx playwright test` | **87/87 passed**, 39 skipped by design (the QA specs run once, in the 360 project). Log: `reports/screenshots/round-7/qa/e2e-full.log`. Plus `qa-summon.spec.js` with the new R-6 test: 7/7 |
| — | `validate-data` | PASS, 10 files, 0 errors, 0 warnings |
| — | `npm run android:check` | `check-identity: PASS (46 checks, source only)` |
| 3 | Bot playthrough (`--per-stage 50 --ai-per-stage 8 --seed 7000`) | **410 battles, 0 failed**, 571 rushes checked, average timer 116.7 s |
| 4 | Busy-frame scan, 3 sizes, longest names | 139 / 135 / 139 frames, **0 overlaps / 0 off-screen** |
| 4 | Screens at 3 sizes | layout scan **0 problems**; console **0 errors** |
| 8 | Rates | No AI, RNG or rate-data change this round (audio, VFX, renderer, licenses, Android, text, art) |
| 9 | Banned terms (fresh §3) | 44 terms, 75 files: 48 "hard" + 2 review hits, **all reviewed by hand, 0 real uses.** They are the internal checklist in `store/listing.md` §"Banned-term check" that quotes the §3 list, `store/screenshot-plan.md` quoting "awaken" as avoided, and "martial-arts" as the genre word in the store copy (§3 bans "Arts" only as a mechanic, card, rarity or currency name). Name-only Spark: 0 |
| 10 | Release bundle | Clean build: `__TEST__`, `summonSeed`, `summonLog`, `tutorialStep`, `audioDebug`, `vfxQuality`, `settingsScreen`, `particlesNow`, `silhouetteSheet`, `sfxLog`, `inputLog`, `eventLog`, `battleState` = **0 each**. `VITE_TEST_HOOKS=1` → all > 0. Clean again → 0. Hook list re-read from `src/main.js` (no new hook names) |
| 11 | **Perf: regression gate** vs round-5 commit `17f5582` | Interleaved 3 cycles × 3 runs = **9 runs each**, Canvas, 4× CPU, same test files in both trees. Frame-time p95 mean **26.9 ms** (HEAD) vs **35.6 ms** (round 5): **Δ −8.7 ms**. Game-work p95 mean **8.1** vs **8.9 ms**: **Δ −0.8 ms** → **PASS** (limit +1.0 ms). Log: `reports/screenshots/round-7/qa/perf-ab.log` |
| 11 | **Perf: absolute AC-17.7** | Median of the 9 HEAD p95 values (24.4, 24.7, 26.0, 26.8, **27.2**, 27.3, 27.5, 28.9, 28.9) = **27.2 ms ≤ 33.3** → **PASS**. (The ui-developer measured 27.6 ms.) The full-suite run also gave 28.0 ms. The WebGL/real-device number cannot be produced in this container (software GL, ~128 ms per frame): NOT VERIFIED for that path only |
| 12 | **Placeholder sweep** (`prototype\|placeholder\|working title\|TBD\|TODO\|lorem`) | Proof on a test file: 2/3 lines hit. **strings.json: 0. index.html: 0. dist/: 0 player-facing** (150 hits are all JS identifiers such as `getPrototypeOf` and `boolOrEmptySchema`; checked in context). **data/: 1, store/: 2, none of them a logged Producer decision → BUG-7-02** |
| 6 | Console | 0 errors in every spec |
| — | AC-18 audio after the pre-render change | Before the gesture: `contextCreated false`, `buffers 0`, `renderQueue 0`, 0 sounds. After one tap: `running`, `bgm_menu_01`, **46 buffers / 39 note buffers / 5.87 MB, renderQueue 0**. AC-18.4 duck 85 ms / back 301 ms; AC-18.7 suspend/resume; AC-19.4 mute 0.81 → 0 → 0.81. All green |

## 2. Release-review items

| Item | Result | Evidence |
|---|---|---|
| R-2 (absolute AC-17.7 + regression gate) | **PASS** | §1 row 11: median p95 27.2 ms; Δ −8.7 / −0.8 ms vs round 5 |
| R-4 title text | **PASS** | `reports/screenshots/round-7/qa/360x640-01-title.png`: "Jade Tempest" / "Fight for the Jade Throne" (no "working title — prototype") |
| R-5 stale QA spec (13 → 14 Settings targets) | **FIXED** (my spec) | `qa-settings-audio.spec.js` now derives the expected ids from source: literal `this.button({ id: '…',` ids in `SettingsScene.js`, 3 per `VOLUME_KEYS` entry (− / slider / +) and one per `toggleRow('<key>')`. The result is 14 ids including `settings_licenses`, and the test passes. **Negative proof** `QA_BREAK=count` (one id dropped) → `Expected - 0 / Received + 1 "back"`, FAIL |
| R-6 reveal shows final Jade early | **PASS** | New test `qa-summon.spec.js` › "R-6 reveal shows Jade per pull": all 8 fighters at R4, ×10 (seed 21). The shown balance is `0:0, 0:10, 1:20 … 9:160` and the final 160 appears only at pull index 9. **Negative proof** `QA_BREAK=spoil` (scene shows the final balance at once) → `Expected > 3, Received 2` distinct values, FAIL |
| R-7 looks match the new briefs; no check pattern | **PASS** (by eye + grep) | `r5-silhouettes-color.png` / `-umbral.png` (round-7 folder): Rook has a long sleeveless vest with a battlement hem and the counter prop, matching `docs/art-briefs/char_rook_001.md` ("never in a check pattern"). Tavi and Pell are redrawn. No checkerboard on any fighter in colour or Umbral. `grep -ciE 'checker\|chess' src/ui/fighter-shapes.js` = 0 |
| R-8 Settings spacing | **PASS** | `360x640-02b-settings.png`: even rows, Licenses button at the bottom; layout scan 0 problems (target ≥ 44, gaps ≥ 8) |

## 3. Bugs

### BUG-7-01: `npm test` is red on a clean checkout. The native-licence test reads a git-ignored file that only `npx cap sync` creates, and CI runs `npm test` before `cap sync`
Severity: MAJOR (the full unit suite fails on the build commit and in the release workflow's test step; release gate R-5 / playbook item 1)
Owner: gameplay-programmer (`scripts/third-party-licenses.mjs`, `tests/data/third-party-native.test.js`); release-engineer for the workflow order

Steps:
1. `git archive 9082d67 | tar -x -C <empty dir>`, link `node_modules`, `cd` there.
2. `npx vitest run tests/data/third-party-native.test.js`.

Expected: the full unit suite passes on the commit as stored in git (playbook item 1; `.github/workflows/build-android.yml` runs `npm test` at line 60).
Actual:
- `FAIL … the reviewed list covers every runtime dependency declared in the Gradle files, at the declared version`
- `Error: ENOENT: no such file or directory, open '…/android/capacitor-cordova-android-plugins/build.gradle'`
- At `declaredGradleDeps scripts/third-party-licenses.mjs:144`. Unit suite 601/602.

The file is excluded by `android/.gitignore:93` (`capacitor-cordova-android-plugins`) and is generated by `npx cap sync android`, which the workflow runs only at line 107, after `npm test` (line 60). So the release workflow fails at its test step. In the main working tree the test passes (13/13) only because a locally generated copy of the file exists.

Evidence: the command output above; `git check-ignore -v android/capacitor-cordova-android-plugins/build.gradle` → `android/.gitignore:93`; `grep -n "run:" .github/workflows/build-android.yml` (test at 60, `cap sync` at 107).

Root-cause guess: `declaredGradleDeps()` lists a generated file. Options: skip missing generated files (and test that the committed Gradle files are covered), or have the test run `cap sync` first. Either way, add a clean-checkout run (`git archive` into a temp dir) to the test plan.

### BUG-7-02: Placeholder sweep: 3 unlogged hits in shipped data and store text
Severity: MINOR (none are player-visible in the app; two are in store documents)
Owner: game-designer (`data/schemas/banners.schema.json`); store-writer (`store/listing.md`). Or the Producer logs them as decisions (playbook item 12, L-shared-023). STATUS.md line 39 says "the placeholder-text sweep is clean".

Steps: `grep -rniE 'prototype|placeholder|working title|\bTBD\b|\bTODO\b|lorem' src/ui/strings.json data/ index.html store/`

Expected: 0 hits, or each hit logged as a Producer decision.
Actual:
- `data/schemas/banners.schema.json:33`: "Real money is not allowed in the **prototype**." (developer-facing schema description)
- `store/listing.md:24`: "Title blocker …: GDD §1 says "Jade Tempest" is a **working title** until compliance-checker passes…" (internal note inside the store-text file)
- `store/listing.md:120`: "Round-5 screenshots (code-drawn **placeholder** fighters, STYLE_GUIDE §11)"

Evidence: the command above (run on the `9082d67` export), and the proof run on a test file (2 of 3 lines hit).

## 4. Counts

| Severity | Count | Bugs |
|---|---|---|
| BLOCKER | 0 | — |
| MAJOR | 1 | BUG-7-01 |
| MINOR | 1 | BUG-7-02 |
| POLISH | 0 | — |

**Failing checks:** unit suite (601/602, BUG-7-01) and placeholder sweep (3 unlogged hits, BUG-7-02).

QA RESULT: FAIL
