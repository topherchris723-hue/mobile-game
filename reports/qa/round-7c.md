# QA report: round 7c (QA loop 2 re-check: BUG-7b-01 fix)

**Commit tested: `1b34594`** (`1b345948e4126ce68de86a0d399a8c31028864fa`, branch `claude/new-session-uo46wt`, HEAD at start and end; `git diff --stat 1b34594 HEAD` is empty).
- All suites ran on clean `git archive 1b34594` exports in the scratchpad (`…/scratchpad/r7e/tree` for the full suites, `r7e/tools` for QA tools, `r7e/bld` for builds and the bot), with `node_modules` linked from the main tree. Perf baseline: `git archive f086934` in `r7e/base`.
- `tests/` in the main tree is unchanged. My QA tools for this loop are in `reports/qa/round-7b-tools/zz-qa-*.spec.js` (they were run from a scratch copy only).
- Playwright used `PW_CHROMIUM=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`.
- Evidence (logs, screenshots, tool output): `reports/screenshots/round-7/qa/recheck-1b34594/`. `reports/screenshots/round-7/qa/busy-findings.txt` and the 9 `*-busy-*.png` files are fresh from qa-busy run 3 on `1b34594`.

Tester: qa-tester. Date: 2026-11-03. Since `f086934`: BUG-7b-01 fix (`src/scenes/BattleScene.js` `popCombo`, `src/ui/float-placer.js` `fitPopScale`/`COMBO_POP`), new tests `tests/ui/combo-pop.test.js`, `tests/data/app-name.test.js` (AC-1.1 a/c + label agreement), new smoke test "BUG-7b-01: …". No change in `data/`, `src/logic/`, `src/vfx/`, `src/audio/`.

**QA VERDICT: FAIL.** Both full suites are green and BUG-7b-01 is fixed (per-frame check, forced and natural, with a must-FAIL proof). The fix keeps the approved pop. But the release-bundle hook check fails: the test-only switch `disableComboZones` ships ungated in the release `dist/` (BUG-7c-02, MINOR, pre-existing since round 4). My earlier hand-written hook lists missed it. A check that ran and failed is a FAIL (L-shared-021). I also classified the known "2-line shout dropped at 360×640" issue as BUG-7c-01 (MINOR).

## 1. Checklist

| # | Check | Result |
|---|---|---|
| 1 | `npx vitest run` (full) | **625/625**, 47 files, exit 0 (`vitest.log`) |
| 1 | Full `npx playwright test` | **90 passed, 0 failed, 40 skipped by design; exit 0** (22.0 min, `e2e-full.log`). The in-suite qa-busy found 0 overlaps at all 3 sizes. The in-suite perf run gave Canvas 4× p95 28.7 ms |
| — | `validate-data` | PASS, 10 files, 0 errors, 0 warnings |
| — | `node android/tools/check-identity.mjs` | `PASS (46 checks, source only)`. Must-FAIL: `appName` = "Jade Tempest" in a copy gives `FAIL appName is "Fyrenza" (got "Jade Tempest")`, exit 1 |
| — | AC-1.1 via the project test `tests/data/app-name.test.js` | 18/18 on `1b34594`. Must-FAIL on real-tree copies: (a) `'Fyrenza'` literal in `TitleScene.js:23` → 1 failed, "(a) live … appears 0 times"; (c) store App-name block "Fyrenza Arena" → 2 failed, "(c) live: … exactly "Fyrenza: Card Duels"" and "(c) live: no store/ file contains …"; `title_activity_main` = "Jade Tempest" → 2 failed, "(b) …" and "live: all four labels are "Fyrenza"". After restoring the copy: 18/18. **The coverage gap from 7b is closed** |
| 3 | Bot playthrough (`bot-playthrough.mjs --per-stage 50 --ai-per-stage 8 --seed 7000`) | **410 battles, 0 failed**, 571 rushes checked, average timer 116.7 s (`bot.log`; same tally as `f086934`, as expected with unchanged logic) |
| 4 | Busy-frame scan `qa-busy.spec.js` ×3 (`QA_SHOTS=1`) | 3/3 pass, **0 overlaps**: 360×640 154/139/138 frames, 390×844 153/134/141, 430×932 152/154/154 (`qa-busy.log`) |
| 4 | **Per-frame** busy scan (new, `zz-qa-busy-perframe.spec.js`, every `postrender`, 25 s per size, stage_005 seed 777) ×3 | **0 overlap frames** across about 1,060–1,190 scanned frames per size per run; 0 console errors (`perframe.log`). Must-FAIL `QA_BREAK=placer`: 2,141 overlap frames, exit 1. `QA_BREAK=clamp` in natural play: 0. The natural fight does not reach the BUG-7b-01 geometry in every run, so I added the forced check below |
| 4 | **Per-frame forced BUG-7b-01** (new, `zz-qa-pop-forced.spec.js`, same scenario, the bot keeps fighting) ×3 | Real `spawnFloat` shout ("NOONDAY HALO!") placed legally next to a 1× combo zone (4 spots × 2 counters), and the real `popCombo` fired either 1 frame later (the reported order) or 1–3 frames before (the race order). **Runs 1–3: 172/180/180 injections, 84/87/89 of them inside the unclamped pop's reach (precondition asserted > 10), 0 COMBO overlap frames, 0 overlaps of any kind** (`forced.log`). Must-FAIL `QA_BREAK=clamp` (`disablePopClamp`, round-7 pop): **24 COMBO × "NOONDAY HALO!" overlap frames** (8/9/7 per size), e.g. `frame 188: "COMBO x7"(s1.50) x "NOONDAY HALO!"(s1.05) 113.8x0.8`; exit 1 |
| 4 | Project test "BUG-7b-01: every animated arena text …" ×3 | 6/6 pass (2 sizes × 3). B: free pop player 1.5 / enemy 1.4. C: 3–4 placed, 3 inside the unclamped reach, 0 problems. Must-FAIL `UI_BREAK_POP_CLAMP=1`: 2 failed, 12 problems (`"COMBO x99" (scale 1.50) × "NOONDAY HALO!"`) (`smoke7b01.log`) |
| 4 | Screens at 3 sizes (`qa-screens`, in the full suite) | green; layout scan 0 problems |
| 6 | Console | 0 errors in every spec and every QA tool run |
| 8 | Rates | Nothing changed in AI, RNG or rate data: `git diff --stat f086934 1b34594 -- data src/logic src/vfx src/audio` is empty. No rate checks were needed |
| 9 | Banned terms (fresh from GDD §3: `tests/sim/banned-grep.mjs`) | `terms=44 files=75 hard_hits=0 review_hits=0`, `name_hits=0`. Negative proof on a probe file ("Kamehameha … Super Saiyan"): `hard_hits=4` |
| 10 | **Release bundle** | **FAIL (BUG-7c-02).** Hook list derived from `src/ui/test-hooks.js` names and every scene switch the e2e specs set (`grep -rhoE "\bsc\.[a-zA-Z_]+ = (true\|false\|1\|0)"`). Clean `npm run build`: `__TEST__`, `activeScene`, `audioDebug`, `battleState`, `eventLog`, `inputLog`, `licensesScreen`, `settingsScreen`, `sfxLog`, `silhouetteSheet`, `summonLog`, `summonReveal`, `summonScreen`, `tutorialStep`, `particlesNow`, `vfxQuality`, `summonSeed`, `lastFrame`, **`disablePopClamp` = 0 each**. **`disableComboZones` = 1** (`if(!this.disableComboZones)for(let t of this.comboZones…`). `VITE_TEST_HOOKS=1` build: every one > 0 (`disablePopClamp` = 1). Clean again: 0. `popPeak` = 1 in the release bundle; it is a plain state field written for every pop and read by tests, with no behaviour switch, so I did not count it as a hook |
| 12 | Placeholder sweep (`prototype\|placeholder\|working title\|TBD\|TODO\|lorem`) | Proof file: 2/3 lines hit. `src/ui/strings.json` 0, `data/` 0, `index.html` 0, `store/` 0. `dist/index.html`, `dist/THIRD_PARTY_LICENSES.txt` and `dist/third-party-packages.json` 0. In `dist/assets` the only hits are JS identifiers (`getPrototypeOf`, `.prototype`, `isPrototypeOf`, `boolOrEmptySchema`, `AddToDOM`); 0 are player-facing. The notice's first line is `Fyrenza includes the following third-party software.`; "jade tempest" in `dist/` = 0 |
| 11 | **Perf: regression gate** vs `f086934` | Method fixed in advance: 4 alternating cycles × 2 runs = **8 runs each**, Canvas, 4× CPU, byte-identical `qa-perf.spec.js`, helpers and config (`perf-ab.sh`, `perf-ab.log`). Frame-time p95 mean **30.57 ms** vs **29.66 ms**: **Δ +0.91 ms**. Game-work p95 mean **10.10** vs **9.61 ms**: **Δ +0.49 ms**. Both are within +1.0 ms: **PASS**. The margin is small; see the note below |
| 11 | **Perf: absolute AC-17.7** | `1b34594` p95 values: 26.9, 29.2, 29.6, 30.5, 31.4, 31.9, 32.4, 32.7. **Median 30.95 ms ≤ 33.3: PASS.** The in-suite run gave 28.7 ms. WebGL and real-device numbers are NOT VERIFIED: this container has no GPU |

Perf note: the container was slower this session than in 7b. The same `f086934` code measured a 26.35 ms mean in 7b and 29.66 ms now, and one `f086934` run (33.8 ms) failed the in-spec 33.3 assertion. The A/B alternates, so drift hits both sides. The fix adds work only on a pop (one obstacle list plus a 24-step bisection), never per frame. I did not re-run to improve the number. The verdict comes from the method fixed in advance.

## 2. BUG-7b-01 re-test: FIXED

- **Per-frame, QA scenario.** See the checklist: the natural fight ×3 at 3 sizes and the forced fight ×3 at 3 sizes, about 87 real near-reach cases per run, gave 0 COMBO overlap frames. The same checks fail with the clamp disabled: 24 overlap frames in the forced check; 12 problems in the project test.
- **The race order is covered too.** In order B the shout is placed 1–3 frames into a running pop. `floatAvoid()` uses the counter's live, scaled bounds, so the shout is placed clear of it, and the counter only shrinks after its first frame (Back.Out).
- **Approved feel (L-shared-014): kept.** The tween is unchanged: 160 ms, Back.Out, start scale ≤ `COMBO_POP` {player 1.5, enemy 1.4}.
  - With nothing next to the counter the pop is exactly 1.5 / 1.4 (project test B).
  - Natural play (`perframe.log`, `pop-forced.txt` phase 0): at 390×844 and 430×932 every player pop was the full 1.5 (11–13 pops per run). At 360×640, 10 of 11, 10 of 11 and 11 of 13 pops were clamped by a live float, to 1.455 (−3 %); the lowest was 1.307 (run 3).
  - The clamp drops to 1.0 (no pop) only in the forced adversarial placement, where a text sits right against the zone.
  - Peak-frame screenshots, frozen at the tween's first frame (t = 0 of 160 ms): `recheck-1b34594/360x640-pop-peak-1.png`, `-2.png`, `430x932-pop-peak-1.png`, `-2.png`. They show "COMBO x2" at 1.5×, big and readable, the same look as before.
  - "COMBO x2" at its peak still touches "3 HITS" under it. That is the deliberate, pre-existing COMBO-vs-HITS exception, which is exempt in `qa-busy` and in my scans, and the fix leaves it unchanged.

## 3. Bugs

### BUG-7c-02: A test-only switch (`disableComboZones`) ships in the release bundle, not gated by TEST_HOOKS
Severity: MINOR. It cannot be reached in a release build: there is no `window.__TEST__` and no scene handle. It still breaks the release-bundle rule ("release builds contain no test hooks"; standing rule, playbook check 10). It has been there since round 4 (`0be2578`).
Owner: ui-developer (`src/scenes/BattleScene.js:746`, `floatAvoid()`)
Steps:
1. `git archive 1b34594` → `npm run build` (no `VITE_TEST_HOOKS`).
2. `grep -rhow disableComboZones dist/assets | wc -l` → `1`.
3. `grep -rhoE ".{60}disableComboZones.{40}" dist/assets` → `.player.nameRect(),this.fighters.enemy.nameRect()];if(!this.disableComboZones)for(let t of this.comboZones||[])e.push`.
Expected: every test hook / negative-proof switch compiles out of release builds (0 hits), like its sibling `disablePopClamp`: `TEST_HOOKS && this.disablePopClamp` gives 0 in the release build and 1 in the hook build.
Actual: 1 hit. The only user of the switch is `tests/e2e/smoke.spec.js:1191` (`sc.disableComboZones = true; // negative proof`).
Evidence: `recheck-1b34594/build-clean.log`, `build-hooks.log`, `build-clean2.log`; the command output is in §1, row 10.
Root-cause guess: added in round 4 for the BUG-3-03 negative proof before the round-4 "stricter hook gate". Fix direction: `if (!(TEST_HOOKS && this.disableComboZones))`.

### BUG-7c-01: At 360×640, every shout that wraps to 2 lines is silently dropped (never shown)
Severity: MINOR. The game works, but content is missing at the minimum supported size. It goes against GDD §2 pillar 1 ("Each hit has hitstop, numbers and a shout"). Pre-existing: the 150 px shout wrap has been in place since round 2 (`e01f893`). ui-developer reported it as a known issue in this loop.
Owner: ui-developer (`BattleScene.shout()` / upper float band at 360×640, `src/scenes/BattleScene.js:855-874`, `floatBands()`). content-designer could shorten lines instead, but that is the owner's choice and does not fix the layout limit.
Steps:
1. Copy of `1b34594`: `npx playwright test reports/qa/round-7b-tools/zz-qa-shout-drop.spec.js` (copy it into `tests/e2e/` of a scratch tree first).
2. Quiet arena (stage_005, seed 777, no floats, counters hidden). For every distinct shout in `data/cards.json` and `data/characters.json`, call `sc.shout(side, s)` on both sides at 360×640, 390×844 and 430×932.
Expected: every shout the game emits can be shown at 360×640 (the minimum size), even if placed or wrapped differently.
Actual:
- At 360×640, 33 of 92 distinct shout strings wrap to 2 lines (13 px italic, wrap 150 px). All 33 are dropped on both sides: 66/66 attempts, with `upper` band 46..150. 1-line shouts: 0 dropped.
- At 390×844 and 430×932: 0 dropped (band 46..289/290).
- Seen at runtime, only card shouts and `tag_in` reach `shout()`:
  - **10 of 52 card shouts**, all of them Climax, e.g. "MELTDOWN... METEOOOR!", "THE SUN BOWS TO NO ONE!". Their text still shows as the sub-line of the Climax cinematic, so the player loses only the floating copy.
  - **3 of 8 `tag_in` shouts** never show at 360×640: Tavi "My turn! Heat coming through!", Rook "Your move. Wrong move.", Corvane "Step aside. The king arrives.".
  - The 2-line `intro`/`tri_burst`/`victory`/`ko` strings use other paths (the intro banner, the cinematic) or are not shouted in battle.
Evidence: `recheck-1b34594/shout-drop.txt` and `shout-drop.log`. The project test also logs it: `BUG-7b-01 A shout (pop 1.1) longest: dropped by the placer (no free row; known issue)`; `shouts that wrap to 2 lines: 33/92`.
Root-cause guess: at 360×640 the upper band is 104 px. Next to the 1× combo zones (left and right) no free row is tall enough for a 2-line shout at its 1.1 pop plus padding. The shout has priority 1, so the placer skips it with no fallback (no wider wrap, smaller size or 1-line ellipsis).

## 4. Re-tests

| Bug | Result on `1b34594` |
|---|---|
| BUG-7b-01 (combo pop covers a shout) | **Fixed.** Per-frame natural ×3 and forced ×3 at 3 sizes: 0 overlap frames. Must-FAIL proofs fail as expected (§1, §2) |
| BUG-7-01, BUG-7-02 (fixed on `d09623e`) | Still fixed: `third-party-native.test.js` is in the green 625/625, and the placeholder sweep finds 0 hits |
| 7b coverage note (AC-1.1 a/c not in `tests/`) | Closed: `tests/data/app-name.test.js` covers (a), (c) and label agreement, and fails on real-tree must-FAIL copies (§1) |

## 5. Counts

| Severity | Count |
|---|---|
| BLOCKER | 0 |
| MAJOR | 0 |
| MINOR | 2 (BUG-7c-01, BUG-7c-02) |
| POLISH | 0 |

Failing checks: the release-bundle hook grep (`disableComboZones` = 1 in a clean build), from BUG-7c-02.

```
DONE: QA round 7c
Commit tested: 1b34594
Unit tests: 625/625 (full suite)
E2E tests: 90/90 run passed (full suite; 40 skipped by design), exit 0
Bot battles: 410 run, 0 failed
Rate checks: no AI/rate change this round
Perf: regression Δ frame p95 +0.91 ms / Δ game-work p95 +0.49 ms (8 vs 8, alternating, vs f086934) → PASS; absolute AC-17.7 median p95 30.95 ms → PASS (WebGL/device NOT VERIFIED: no GPU)
Failing checks: release-bundle test-hook grep (disableComboZones in clean dist, BUG-7c-02)
Bugs: 0 blocker, 0 major, 2 minor, 0 polish
Re-tested fixes: 1/1 confirmed fixed (BUG-7b-01); BUG-7-01/7-02 still fixed
Repeat bugs (same bug class as a past lesson): BUG-7c-02 (test hook in release bundle; round-4 "stricter hook gate" class); BUG-7c-01 (BUG-2-10/2-11 arena-text layout class, L-qa-002)
QA VERDICT: FAIL
```

## 6. Lesson candidates

1. **QA's dist hook list was hand-written and missed a switch for 3 rounds.** Proposed rule: build the release-bundle grep list from source on every run: every `testHooks()` key in `src/ui/test-hooks.js`, plus every scene/object property that a spec under `tests/` sets (`sc.<name> = …`). Prove it by planting an ungated switch in a copy. Proposed rule for build agents: every negative-proof switch is written as `TEST_HOOKS && this.<switch>`.
2. **A natural busy scan cannot prove a geometry fix, even per frame.** The per-frame natural scan with the clamp disabled found 0 overlaps, because the fight did not reach the geometry. Only the forced injection (precondition asserted: > 10 texts inside the unclamped reach) failed. Proposed rule: a layout-bug re-test forces the bug's geometry through the real code paths, asserts the precondition and runs the must-FAIL. A natural scan is extra coverage, not proof.
3. **The placer drops low-priority texts silently, so no layout scan sees missing content.** Overlap scans only look at texts that are shown. Proposed rule: QA counts texts requested vs shown per size (as `zz-qa-shout-drop.spec.js` does). Any player-facing text that can never be shown at a supported size is a bug.
