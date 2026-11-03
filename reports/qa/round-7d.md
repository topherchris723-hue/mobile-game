# QA report: round 7d (QA loop 3 re-check: BUG-7c-01 and BUG-7c-02 fixes)

**Commit tested: `6a4d7d0`** (`6a4d7d034309320a79150c82acbc4715e1ec2f70`, branch `claude/new-session-uo46wt`).
- **Commits since then.** During the run HEAD moved to `c139e21` (`d5251b5` compliance 7b, `c139e21` QA WIP evidence). `git diff --stat 6a4d7d0 c139e21` touches only `reports/`, `docs/art-prompts/char_rook_001.md` ("street fighter" → "street brawler") and `store/privacy-policy.md` (the commit line in the header). Nothing in `src/ data/ scripts/ tests/ android/ assets/ index.html styles/ package*.json` or the configs changed. Under the round-7 exact-commit rule the build commit is still `6a4d7d0`. I re-ran the placeholder sweep and the banned-term grep on `store/` at `c139e21`: both 0.
- **Where things ran.** All suites ran on clean `git archive 6a4d7d0` exports in the scratchpad (`…/scratchpad/r7f/tree` for the full suites, `r7f/tools` for the QA tools, `r7f/bld` for builds and the bot), with `node_modules` linked from the main tree. Perf baseline: `git archive 1b34594` in `r7f/base`.
- **Playwright** used `PW_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`.
- **`tests/` in the main tree is unchanged.** This loop's QA tools are in `reports/qa/round-7d-tools/` (`hook-list.mjs`, `zz-qa-shout-live.spec.js`), plus the 7c tools in `reports/qa/round-7b-tools/`. They ran from scratch copies only.
- **Evidence:** `reports/screenshots/round-7/qa/recheck-6a4d7d0/` holds logs, JSON, tool output and `progress.md`. `reports/screenshots/round-7/qa/busy-findings.txt` and the 9 `*-busy-*.png` files are fresh from qa-busy run 3 on `6a4d7d0`.

Tester: qa-tester. Date: 2026-11-03.

**What changed since `1b34594`:**
- BUG-7c-02: every test switch is now gated with `TEST_HOOKS && this.<switch>` (`disableComboZones`, `cinFadeMs`, `disablePopClamp`, `disableShoutFit`). `tests/ui/release-bundle.test.js` derives the switch list from the specs (`sceneSwitches()`).
- BUG-7c-01: shout fallback layouts (`shoutFits(W)`, `SHOUT_MIN_SIZE` 12, `place({noEvict})`), and a new smoke test "BUG-7c-01".
- No change in `data/`, `src/logic/`, `src/vfx/`, `src/audio/`, `scripts/`, `android/`, `index.html` or `package*.json`.

**QA VERDICT: PASS.**
- Both full suites are green on `6a4d7d0`.
- BUG-7c-01 and BUG-7c-02 are fixed, and BUG-7b-01 is still fixed. Each was re-tested through the real code paths, with a must-FAIL that does fail.
- The release-bundle grep is built from source by an independent derivation and catches a planted switch.
- Perf passes both the regression gate and the absolute AC-17.7 limit.
- 2 POLISH items are filed: the speaker of a fallback shout is less clear (the known item), and the project switch derivation only looks at `sc.`. There are 0 blockers, 0 majors, 0 minors and 0 failing checks.

## 1. Checklist

| # | Check | Result |
|---|---|---|
| 1 | `npx vitest run` (full) | **633/633**, 47 files, exit 0 (`vitest.log`) |
| 1 | Full `npx playwright test` | **91 passed, 0 failed, 41 skipped by design (132), exit 0**, 22.4 min (`e2e-full.log`). It includes the new "BUG-7c-01" smoke test (360×640: 184/184 shown, layouts [118, 66, 0]). In-suite qa-busy: 0 overlaps. In-suite perf: Canvas 4× p95 27.0 ms |
| — | `validate-data` | PASS, 10 files, 0 errors, 0 warnings |
| — | `node android/tools/check-identity.mjs` | `PASS (46 checks, source only)`. Must-FAIL: with `appName` "Jade Tempest" in a copy, `FAIL appName is "Fyrenza" (got "Jade Tempest")`, exit 1 |
| — | AC-1.1 (`tests/data/app-name.test.js`) | 18/18 (also in the full run). Must-FAIL on real-tree copies: a `'Fyrenza'` literal in `TitleScene.js` gives 1 failed, "(a) live: … appears 0 times"; `title_activity_main` = "Jade Tempest" gives 2 failed, "(b) …" and "live: all four labels are "Fyrenza"". Restored: 18/18 |
| 3 | Bot playthrough (`bot-playthrough.mjs --per-stage 50 --ai-per-stage 8 --seed 7000`) | **410 battles, 0 failed**, 571 rushes checked, avg timer 116.7 s (`bot.log`; same tally as before, logic unchanged) |
| 4 | `qa-busy.spec.js` ×3 (`QA_SHOTS=1`) | 3/3 pass, **0 overlaps**: 360×640 157/156/156 frames, 390×844 156/135/174, 430×932 154/154/135 (`qa-busy.log`) |
| 4 | Per-frame busy scan (`zz-qa-busy-perframe`) ×3 | **0 overlap frames**, about 1,060–1,190 frames per size per run, 0 console errors (`perframe.log`). Must-FAIL `QA_BREAK=placer`: 5,738 overlap frames, exit 1 |
| 4 | **BUG-7c-01 forced live** (new `zz-qa-shout-live`) ×3 | Busy stage_005 fight (seed 777, bot playing). Every 40 frames the real `sc.shout()` is called with the next data shout that wraps to 2 lines in the approved layout, sides alternating. Precondition asserted: ≥ 20 per size; actual 37. **Runs 1–3: 111/111 injected shown each run (37/37 per size); all shouts 206/206, 208/208, 207/207; 0 overlap frames; 0 console errors.** At 360×640 the 37 injected shouts used fallback 1 (13 px, one line) and never the 12 px one. At 390×844 and 430×932 every shout used the approved layout. **Must-FAIL `QA_BREAK=shoutfit`** (`disableShoutFit`): 360×640 **0/37 shown**, exit 1. **Pre-fix code `1b34594`**, same tool: 360×640 **0/37 shown**, exit 1 (`shout-live.log`, `shout-live-base.log`) |
| 4 | BUG-7c-01 quiet arena (`zz-qa-shout-drop`, 7c tool) | 92 distinct shouts × 2 sides: **dropped 0 at 360×640** (was 66 on `1b34594`), 0 at 390×844 and 430×932 (`shout-drop.txt`) |
| 4 | Project test "BUG-7c-01 …" ×3 | 3/3 pass: 184/184 shown per size, both sides at once 66/66, problems 0, smallest 13 px. Must-FAIL `UI_BREAK_SHOUT_FIT=1`: fails, 360×640 shown 118/184, dropped 66, both-at-once 0/66 (`smoke7c01.log`) |
| 4 | BUG-7b-01 forced (`zz-qa-pop-forced`) ×3 | **0 COMBO overlap frames**. Injections 143/144/166, inside the unclamped reach 72/73/83 (precondition > 10). Must-FAIL `QA_BREAK=clamp`: 25 overlap frames, exit 1 (`forced.log`) |
| 4 | Project test "BUG-7b-01 …" ×3 | 6/6 pass, problems 0. Must-FAIL `UI_BREAK_POP_CLAMP=1`: 2 failed, 12 problems (`"COMBO x99" (scale 1.50) × "NOONDAY HALO!"`) (`smoke7b01.log`) |
| 4 | Approved pop feel (L-shared-014) | Same as 7c. At 390×844 and 430×932 all 13 player pops are the full 1.5. At 360×640, 11 of 13 are clamped to 1.455 by a live float (lowest 1.306) (`perframe.txt`) |
| 4 | Screens at 3 sizes (`qa-screens`, in the full suite) | green; layout scan 0 problems |
| 6 | Console | 0 errors in every spec and every QA tool run |
| 8 | Rates | No AI, RNG or rate change: `git diff --stat 1b34594 6a4d7d0 -- data src/logic src/vfx src/audio scripts android index.html package*.json` is empty. No rate checks needed |
| 9 | Banned terms (`banned-grep.mjs`, list fresh from GDD §3) | `terms=44 files=75 hard_hits=0 review_hits=0`, `name_hits=0`. Negative proof on a probe file ("Kamehameha … Super Saiyan"): `hard_hits=3`. `store/` at `c139e21`: 0. Not in scope, for information: internal `docs/art-prompts/*` hit only inside AVOID lists ("no … martial-arts uniform", a recorded "rock-bodied hero" comparison). These were there before. Nothing ships from there, and the new commit removes "street fighter" |
| 10 | **Release bundle** | **PASS.** See §2 |
| 12 | Placeholder sweep (`prototype\|placeholder\|working title\|TBD\|TODO\|lorem`) | Proof file: 2/3 lines hit. `src/ui/strings.json` 0, `data/` 0, `index.html` 0, `store/` 0 (also at `c139e21`) |
| 11 | **Perf regression gate** vs `1b34594` | Method fixed in advance: 4 alternating cycles × 2 runs = **8 runs each**, Canvas, 4× CPU. `qa-perf.spec.js`, helpers and config are byte-identical (`perf-ab.sh`, `perf-ab.log`). Frame-time p95 mean **26.30 ms** vs **27.12 ms**: **Δ −0.82 ms**. Game-work p95 mean **8.49** vs **8.76 ms**: **Δ −0.27 ms**. Both are within +1.0 ms: **PASS** |
| 11 | **Perf absolute AC-17.7** | `6a4d7d0` p95: 24.4, 24.7, 24.7, 24.8, 25.9, 27.2, 27.9, 30.8. **Median 25.35 ms ≤ 33.3: PASS.** The in-suite run gave 27.0 ms. All 16 A/B runs passed the in-spec 33.3 assertion. WebGL and real-device numbers are NOT VERIFIED: this container has no GPU |

## 2. BUG-7c-02 re-test (release bundle): FIXED

**Hook list, derived from source on every run.** I used my own derivation, `reports/qa/round-7d-tools/hook-list.mjs`, independent of the project's `sceneSwitches()`. It collects:
- every key on the hook object in `src/`: `T.<key>`, keys of `__TEST__ = {…}` and of `T.<k> = {…}` literals, and every `testSeedParam('<name>')`;
- every property that ANY spec or helper under `tests/e2e` assigns on ANY object (`<x>.<prop> = …`, not only `sc.`), where `src/` never writes it and never defines it as a method or field;
- every `TEST_HOOKS && this.<x>` read in `src/`.

That gives 32 hook keys and the switches `cinFadeMs`, `disableComboZones`, `disablePopClamp`, `disableShoutFit` (plus the save/data fields `cur_jade`, `variant`, `vibrate` that specs write on save objects).

**Builds and counts:**
- Clean `npm run build` (no `VITE_TEST_HOOKS`): **0 each** for `__TEST__`, `activeScene`, `audioDebug`, `battleState`, `eventLog`, `inputLog`, `lastFrame`, `licensesScreen`, `settingsScreen`, `sfxLog`, `silhouetteSheet`, `summonLog`, `summonReveal`, `summonScreen`, `summonSeed`, `tutorialStep`, `vfxQuality`, `particlesNow`, `emittersNow`, **`disableComboZones`, `cinFadeMs`, `disablePopClamp`, `disableShoutFit`**.
- `VITE_TEST_HOOKS=1` build: every one of these is > 0 (each switch = 1).
- Clean again: 0. See `hooks-clean.json`, `hooks-hooks.json`, `hooks-clean2.json` and the build logs.

**Generic names checked by hand.** Some hook keys are common words: `data`, `game`, `save`, `errors`, `targets`, `vfx`, `viewport`, `seed`, `stats`, `quality`, `reduceMotion`, `sceneKey`, `particleCap`. In the release build they appear only as game or Phaser code, never as hook code:
- `sceneKey` (3): Phaser's file loader config;
- `particleCap` (1): the vfx core method `particleCap(){return this.store.cap}`;
- each of these counts is the same or one lower than in the hook build.

`popPeak` and the new `shoutFit` are 1 each in release. They are plain state fields written on every pop or shout and read only by tests; they switch no behaviour. I classified them the same way as in 7c: not hooks.

**Planted must-FAIL**, on a full-tree copy:
- I added `if (this.qaPlantA) …` and `if (this.qaPlantB) …` ungated to `floatAvoid()`, plus spec lines `sc.qaPlantA = true;` and `scene.qaPlantB = true;`.
- **My derivation:** `specSwitches` includes `qaPlantA` and `qaPlantB`; the clean build counts are `qaPlantA 1`, `qaPlantB 1`. **FAIL, as expected.**
- **Project test** `tests/ui/release-bundle.test.js`: 2 failed, `["src/scenes/BattleScene.js: if (this.qaPlantA"]` and `expected [ 'qaPlantA' ] to deeply equal []`. It does **not** flag `qaPlantB`, which is set through a `scene.` handle (see BUG-7d-02).
- On the unchanged `6a4d7d0` the project test is green as part of 633/633 (`neg-build.log`).

## 3. BUG-7c-01 re-test (shouts dropped at 360×640): FIXED

- **Every shout is shown.**
  - Quiet arena: every one of the 92 data shouts on both sides at all 3 sizes (0 dropped; on `1b34594` 66 were dropped at 360×640).
  - Busy live fight: all 111 forced 2-line shouts per run, 3 runs.
  - Must-FAIL: the tool fails on the old behaviour (`disableShoutFit`) and on the real pre-fix commit `1b34594`: 0/37 at 360×640.
- **Approved feel kept.** At 390×844 and 430×932, 100 % of shouts used the approved 13 px / 150 px layout (quiet: 184/184; live: 68–71 per run). At 360×640 every 1-line shout still uses it (118/118 quiet; 31–32 per live run). Only the 33 strings that wrap to 2 lines use the fallback: 13 px on one line, never the 12 px floor in any run. 0 overlap frames per frame, including the wide fallback shouts.
- **Natural-play note (tool limit, not counted as a check).** The unforced fight in this scenario only emits 1-line shouts: 96/96 per run, all in the approved layout. Its `QA_BREAK=shoutfit` run also showed 0 drops. So the natural scan cannot fail for this bug (L-shared-006), and I added the forced injection above (`shout-live-natural.*`). One tool run first failed on my own syntax error (`shout-live-syntaxerr.log`). I fixed it and re-ran all 4 runs plus the base run; there is no product impact.

## 4. Bugs

### BUG-7d-01: At 360×640 a one-line fallback shout often sits over the other fighter, so it is less clear who is speaking
Severity: POLISH.
- All text is shown in full, readable at 13 px, with no overlap.
- Before the fix, these shouts were not shown at all at 360×640.
- The approved layout already does this at times when the fighters stand close.
- Speaker identity is not needed to play.
- The approved look (13 px italic white) is unchanged, and the layout change was named as the BUG-7c-01 fix, so L-shared-014 does not make it MINOR.

Owner: ui-developer (`BattleScene.shout()` / `FloatPlacer` x choice for fallback `shoutFits(W)[1]`).
Steps:
1. Copy of `6a4d7d0`. Put `reports/qa/round-7d-tools/zz-qa-shout-live.spec.js` in `tests/e2e/`. Run `npx playwright test tests/e2e/zz-qa-shout-live.spec.js --project phone-360x640`. Scenario: stage_005, seed 777; 2-line data shouts injected every 40 frames, sides alternating.
2. Read the `nearer-other` lines in the output: a shout whose centre x is nearer the other fighter's head than the speaker's.

Expected: GDD §2 pillar 1 says "each hit has … a shout". A player should be able to tell which fighter shouts it.
Actual:
- At 360×640, **15, 15 and 16 of 37** one-line fallback shouts per run (about 41 %) are centred nearer the other fighter. Example: enemy `"My turn! Heat coming through!" cx=251 me=308 other=253 x=146..357`.
- The approved layout does this too, less often: 360×640 fit0 1–2 of 31–32; 390×844 3–10 of 69–71; 430×932 3–7 of 68–69; on `1b34594` at 390×844, 24 of 69.
- Visible in ui-developer's screenshot `reports/screenshots/round-7/360x640-57-battle-shout-2line.png`: Tavi's (player) "My turn! Heat coming through!" is right-aligned above Thessa (enemy).

Evidence: `recheck-6a4d7d0/shout-live.log` and `shout-live.txt` (runs 1–3), `shout-live-base-1b34594.txt`.
Root-cause guess: the one-line text is about 180–210 px wide in a 360 px arena. The placer shifts it in x to the first free row and clamps it at the right edge (x end 357), so for the enemy it extends over the player. Possible directions: anchor the fallback's near edge to the speaker's side (left-aligned for the player, right-aligned for the enemy) when that is free, or add a speaker tint or name prefix. This is the owner-feel area, so it is the Producer's call.

### BUG-7d-02: The project test's switch derivation only sees `sc.<name> = …`; a switch set through another handle escapes it
Severity: POLISH. This is test coverage only; no current escape. My broader derivation finds the same 4 switches in today's specs, and all 4 are gated.
Owner: ui-developer (`tests/ui/release-bundle.test.js`, `sceneSwitches()`).
Steps:
1. Copy of `6a4d7d0`. Add `if (this.qaPlantB) out.length = 0;` to `floatAvoid()`, and a spec line `const scene = sc; scene.qaPlantB = true;`.
2. Run `npx vitest run tests/ui/release-bundle.test.js`.

Expected: the derived list contains `qaPlantB`, and the gate and bundle tests fail. The test says it derives "every property a spec under tests/e2e sets on a scene handle".
Actual: `qaPlantB` is not derived (the regex is `\bsc\.(…)\s*=`); only `qaPlantA` (set via `sc.`) fails the test. In the clean build `qaPlantB` = 1, and only the QA derivation catches it.
Evidence: §2, `recheck-6a4d7d0/neg-build.log`, and the vitest output quoted in §2.
Root-cause guess: the handle name is hard-coded. Fix direction: match `<any identifier>.<prop> =` in specs, keeping the "src never writes it / not a method" filter, as `reports/qa/round-7d-tools/hook-list.mjs` does.

## 5. Re-tests

| Bug | Result on `6a4d7d0` |
|---|---|
| BUG-7c-02 (test switch in release bundle) | **Fixed.** All 4 switches and every hook key: 0 in the clean build, > 0 in the hook build. Independent derivation with a planted must-FAIL (§2) |
| BUG-7c-01 (2-line shouts dropped at 360×640) | **Fixed.** 0 dropped in the quiet and forced live checks at 3 sizes. Must-FAILs on `disableShoutFit` and on `1b34594` fail (§3) |
| BUG-7b-01 (combo pop covers a shout) | **Still fixed.** Forced ×3: 0 COMBO overlap frames (must-FAIL: 25). Project test ×3 green (must-FAIL: 12 problems) |
| BUG-7-01, BUG-7-02 | Still fixed: `third-party-native.test.js` is in the green 633/633, and the placeholder sweep finds 0 hits |

## 6. Counts

| Severity | Count |
|---|---|
| BLOCKER | 0 |
| MAJOR | 0 |
| MINOR | 0 |
| POLISH | 2 (BUG-7d-01, BUG-7d-02) |

Failing checks: none.

```
DONE: QA round 7d
Commit tested: 6a4d7d0 (HEAD c139e21 differs only in reports/, docs/art-prompts, store/privacy-policy.md header; store re-swept at HEAD)
Unit tests: 633/633 (full suite)
E2E tests: 91/91 run passed (full suite; 41 skipped by design, 132 total), exit 0
Bot battles: 410 run, 0 failed
Rate checks: no AI/rate change this round
Perf: regression Δ frame p95 −0.82 ms / Δ game-work p95 −0.27 ms (8 vs 8, alternating, vs 1b34594) → PASS; absolute AC-17.7 median p95 25.35 ms → PASS (WebGL/device NOT VERIFIED: no GPU)
Failing checks: none
Bugs: 0 blocker, 0 major, 0 minor, 2 polish
Re-tested fixes: 2/2 confirmed fixed (BUG-7c-01, BUG-7c-02); BUG-7b-01, BUG-7-01, BUG-7-02 still fixed
Repeat bugs (same bug class as a past lesson): BUG-7d-02 (hand-limited hook-list derivation, same class as BUG-7c-02 / QA 7c lesson 1)
QA VERDICT: PASS
```

## 7. Lesson candidates

1. **"Derived from source" must not hard-code the handle name.** The BUG-7c-02 test derives switches only from `sc.<x> =`. A derivation that depends on a naming habit is still a hand-written list. Proposed rule: hook or switch derivations match any `<obj>.<prop> =` in specs, filtered by "src never writes it". The planted must-FAIL must use a different handle name than the existing specs.
2. **A natural scan that cannot reach the bug's geometry is not a re-test, even with a must-FAIL run.** This is a repeat of 7c lesson 2, in a new form: the natural fight in my BUG-7c-01 live scan never emitted a 2-line shout, and its must-FAIL passed. Proposed rule: before a live layout scan counts as evidence, print the precondition count (here, "2-line shouts requested") and require that the must-FAIL run fails. If it does not, force the case through the real code path.
3. **Requested = shown is not enough; check who the text belongs to.** Once nothing is dropped, the next layout risk is attribution: a speaker's line drawn over the other fighter. Proposed rule: arena-text scans for fighter-owned text (shouts, damage numbers) also record whether the text is nearer its owner than the other fighter. Report the share per layout, compared with the approved layout's own share.
