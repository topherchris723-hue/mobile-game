# QA report: round 5, loop 1

Tester: qa-tester. Date: 2026-10-24. Build: `83996ae` (working tree; only my test files changed).

**Read first:**
- Playbook with its new hard rule L-shared-017.
- `lessons/_shared.md` (L-shared-016…018) and `lessons/qa-tester.md`.
- GDD §8 (`variant`, AC-8.2), §9.2 (round-5 ruling), §17.
- `docs/ECONOMY.md` §2.2 and `reports/qa/round-4.md`.

**Round-5 setup (L-shared-017):** `tests/e2e/qa-helpers.js` now takes `ROUND`/`SHOTS` from the one shared source in `tests/e2e/helpers.js` (env `ROUND`, else `**Round:** N` in docs/STATUS.md, which says 5). QA shots go to `reports/screenshots/round-5/qa/`.
Negative proofs:
- `ROUND=4` → `Error: ROUND=4 but docs/STATUS.md says round 5`;
- `shotsDir(4, ['round-4','round-5'])` → `refusing to write screenshots for round 4: round-5 already exists`.

`git status reports/screenshots/` shows changes only under `round-5/`.

## 1. Re-tests

| Bug | Status | Evidence |
|---|---|---|
| BUG-4-01 Tri-Burst overlay drawn > 160 ms after `freeze_end` | **VERIFIED FIXED** | `qa-vfx-audio.spec.js` "positive control", 11 runs. Tri-Burst overlay last drawn 101–118 ms and hidden by 119–135 ms after `freeze_end` (round 4: 167–168 / 184). Climax 51–68 / 74–91 ms; Ignition 101–119 / 119–135 ms. All ≤ 160. 10 of 11 runs passed. One run failed after the AC-17.8 line printed and did not reproduce in 7 more runs; its message was not captured. The ducking edges (84 ms vs 97; 301–304 ms vs 317) are the closest-to-limit assertions, so they are the likely cause. Listed under §5 as NOT REPRODUCED |
| BUG-4-02 repeat-clear Jade docs ≠ data | **VERIFIED FIXED** | New `node tests/sim/doc-data-sync.mjs`: data first/repeat/missions = ECONOMY.md §2.2 for all 5 stages (300/10, 300/20, 400/45, 500/50, 600/75; 3 missions × 50), and GDD §9.2 has no Jade amount → `PASS`. **Negative proofs:** ECONOMY.md copy with stage_003 repeat 40 → `FAIL stage_003: repeat clear doc 40 vs data 45`; round-4 GDD (`git show f027887:docs/GDD.md`) → `FAIL GDD §9.2 quotes Jade amounts` |

Re-tested fixes: **2/2.**

## 2. AC-8.2 (Umbral variant)

| Part | Result |
|---|---|
| (a) schema | Copy with `variant: "shadow"` → `ERROR [schema] enemies.json /enemies/3/variant: must be equal to one of the allowed values ["umbral"]`, FAIL. Copy with every `variant` removed → PASS. Live data (`umbral` on 3 enemies) → PASS |
| (b) headless | New `node tests/sim/ac-8-2b.mjs`: stages with an Umbral enemy (stage_003, stage_005) × seeds 1–200 = 400 battles. Event-log hash with vs without `variant`: **0 differences**. **Negative proof** `QA_BREAK=reads` (Umbral enemies get +0.01 DEF in the copy that has the field = logic reading `variant`) → 399 differences, FAIL |
| (c) Playwright | New `qa-visuals.spec.js`. Shipped data: `enemy_umbral_rook_001`, `enemy_umbral_pell_001`, `enemy_umbral_solenne_001` render Umbral (`…|umbral|` texture key). Thessa ×2 and Corvane render normally. With every `variant` deleted from the in-memory data (same `enemy_umbral_*` ids): all render normally. **Negative proof** `QA_BREAK=id` (renderer decides from the id) → `Expected false, Received true`, FAIL. Checked by eye: `r5-stage_003-enemy-1-enemy_umbral_rook_001.png` (dim purple-outlined Umbral Rook) vs `r5-novariant-enemy-1-enemy_umbral_rook_001.png` (normal green Rook, same name) |

## 3. Checklist

| Check | Result |
|---|---|
| `npm test` | **565/565** (40 files) |
| `npm run validate-data` | PASS, 10 files, 0 errors, 0 warnings |
| Bot playthrough (`--per-stage 50 --ai-per-stage 8 --seed 6000`) | **410 battles, 0 failed**, 571 rushes checked, average timer 116.4 s |
| Rates (item 8) | No AI, RNG or rate data change this round (round-5 changes are rendering, docs and the display-only `variant`); round-4 measurements stand. AC-8.2(b) proves `variant` does not reach the logic |
| Banned-term grep (fresh §3) | 44 terms, 69 files (incl. `fighter-shapes.js`, `rarity-frame.js`), 0 hard, 0 review, 0 name-only |
| Release bundle (13 names incl. `silhouetteSheet`) | clean build: **0 each**; `VITE_TEST_HOOKS=1`: all > 0 (`silhouetteSheet`=1, `__TEST__`=3 …); clean again: 0 |
| Busy-frame scan, 3 sizes, longest names | 154 / 142 / 151 frames, **0 overlaps / 0 off-screen** (the round-5 silhouettes, Umbral bodies, prop colours and floor rims are in these frames) |
| Screens at 3 sizes (`qa-screens`) | layout scan **0 problems** |
| E2E full suite (`QA_SHOTS=1`, once) | **82 passed, 1 failed** (AC-17.7 canvas ×4, see §4), 39 skipped by design |
| Console | **0 errors**, 0 pageerror |

### 3.1 By-eye review (`reports/screenshots/round-5/qa/`)
- `r5-silhouettes-black.png`: the 8 fighters are distinct as black fills (Tavi skirt/headband, Lark winged arms, Pell robe and staff, Rook spiky hair and pieces, Solenne crest and fist prop, Thessa cape, Dunmore broad block, Corvane crown and long coat).
- `r5-silhouettes-color.png`: aura colours and props as in STYLE_GUIDE; floor rims under every fighter.
- `r5-silhouettes-umbral.png`: the Umbral variants of all 8.
- **Summon ★3 / ★4 / ★5** with ×1 seeds 1 / 8 / 7 (found headlessly). The ★4 orb is now captured:
  - `r5-summon-orb-4star.png`: purple orb with a ringed frame and diamond sparks.
  - `r5-summon-reveal-4star.png`: purple double frame with corner gems.
  - `r5-summon-reveal-5star.png`: gold frame, gold rays, light sweep, "Pity reset".
  - `r5-summon-orb-3star.png`, `r5-summon-results-*star.png`.

  Each results grid shows the right rarity row.

## 4. AC-17.7 performance: regression check (ui-developer reported 31.7–34.3 ms)

**Method.** I exported `f027887` (round 4) and `83996ae` (HEAD) with `git archive` into the scratchpad. Both trees got identical current test files, and both were built and served by their own Playwright run. I interleaved the builds (A, B, A, B) to spread machine drift, at Canvas, CPU ×4, scripted stage_005 battle. I also recorded the game's own work per frame (time from Phaser's `prestep` to `postrender`) next to the rAF-interval p95 the AC uses. That metric is reported only; the assertion is unchanged.

| Build | Runs | rAF p95 range | rAF p95 mean | Work p95 range | Work p95 mean |
|---|---|---|---|---|---|
| f027887 (round 4) | 14 | 31.7–39.9 ms | 35.7 ms | 8.0–9.6 ms (6 runs) | 8.9 ms |
| 83996ae (HEAD) | 14 | 29.3–41.2 ms | 35.6 ms | 7.6–10.2 ms (6 runs) | 8.7 ms |

The HEAD-full-suite run gave 34.8 ms (work 9.1 ms). Unthrottled: median 16.7 ms, p95 17.6 ms (work 0.9 / 1.6 ms).

**Decision: measurement noise, not a round-5 regression.**
- The HEAD − parent difference in mean p95 is −0.1 ms, against a run-to-run spread of about ±5 ms within one session.
- The game's own frame work is unchanged (8.7 vs 8.9 ms p95) and is a quarter of the frame interval. The 20–40 ms rAF intervals under 4× throttling are dominated by browser and host scheduling in this shared container.
- The same round-4 code measured 28.9–32.8 ms on 2026-10-23 and 31.7–39.9 ms on 2026-10-24.

No bug is filed. The limit and the check are unchanged; the spec still asserts p95 ≤ 33.3 ms and so FAILs in this environment. **AC-17.7 is NOT VERIFIED** on this container.

**Method proposal for the Producer** (the limit is not loosened):
1. **Regression gate (per round):** interleaved A/B against the previous round's commit, ≥ 6 runs each. FAIL if HEAD mean p95 > parent mean p95 + 1.0 ms, or HEAD mean work p95 > parent + 1.0 ms. This is robust to machine speed; today it would give PASS (−0.1 / −0.2 ms).
2. **Absolute AC-17.7** (p95 ≤ 33.3 ms at 4×): run as the median of ≥ 5 runs on a quiet, dedicated CI runner, plus one real low-end Android phone before release (the WebGL path cannot be measured here at all: software GL is 112–125 ms per frame).
3. **Report work p95 next to the rAF p95** in every perf result. It separates game cost from host noise. The ui-developer's round-5 changes (cached silhouette textures) did not raise it.

## 5. Not reproduced / not verified
- **Intermittent failure in `qa-vfx-audio` "positive control"** (1 of 11 runs). The failing assertion was not captured; it came after the AC-17.8 output. The ducking assertions run within about 1 frame of their limits (84 ms vs 97 ms; 301–304 ms vs 317 ms). If it recurs, its message goes into the next report. No bug filed without evidence.
- **AC-17.7:** NOT VERIFIED (see §4).

## 6. Counts

| Severity | Count | Bugs |
|---|---|---|
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 0 | — |
| POLISH | 0 | — |

Re-tested fixes: 2/2 VERIFIED FIXED (BUG-4-01, BUG-4-02).

QA RESULT: PASS
