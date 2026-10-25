# QA report: round 4, loop 1

Tester: qa-tester. Date: 2026-10-24. Build: working tree at `0be2578` (no other agent's uncommitted changes; only my test files changed).

**Read first:**
- `.claude/agents/qa-tester.md` (upgraded: item 8 "Rates match data", item 10 release bundle, "Standards for your own checks", hard rules L-shared-010/011).
- `lessons/qa-tester.md` (L-qa-001…004) and `lessons/_shared.md` (through L-shared-015).
- GDD §17 VFX, §18 Audio, §19 Settings, rulings R4-1…R4-6, §15.3 rules 13–15.
- `docs/STYLE_GUIDE.md`, `docs/ECONOMY.md`, `docs/STATUS.md` decisions.
- Previous report `reports/qa/round-3.md` (BUG-3-03).

## 1. Checklist results

| # | Check | Result |
|---|---|---|
| 1 | `npm test` | **542/542 passed** (35 files) |
| — | `npm run validate-data` | PASS: 10 files, 0 errors, 0 warnings |
| — | **Rules 13–15 negatives** (broken copies, `--data-dir` / `--credits`) | **Rule 13:**<br>• file sound `license: "CC-BY"` → `ERROR [13-licensing] … license "CC-BY" not allowed` (+ missing path, + no CREDITS row);<br>• pattern 63 notes vs steps 64 → `ERROR [13-licensing] … notes has 63 entries, steps is 64`;<br>• CREDITS.md without the `data/audio.json` row → `ERROR [13-licensing] … procedural sounds need an assets/CREDITS.md row`.<br>**Rule 14:**<br>• flash `#ff2020` → `screen_flash color is saturated red`;<br>• shake 0.02 → `shake intensity 0.02 > max_shake_intensity 0.012`;<br>• 4 flashes at 0/200/400/600 → `4 screen_flash layers start within 1000 ms`;<br>• `ignition_default` 1,600 ms → `duration_ms 1600 > 1500 (ignition cinematic)`.<br>All exit 1.<br>**Rule 15:** card `sfx: "sfx_qa_missing"` → `PASS … 1 warning(s)`, exit 0 (warning, as specified).<br>Live data passes all three |
| 8 | **Rates match data** (no AI change this round → sanity run) | `node tests/sim/ai-slip-rate.mjs`, see §1.1. **New: `node tests/sim/summon-rate.mjs 100000`**, see §1.2 |
| 3 | Bot playthrough `--per-stage 50 --ai-per-stage 8 --seed 5000` | **410 battles, 0 failed, 557 rushes checked.** Average timer 118.3 s; max 13,244 real ticks. The fault-injection self-tests are unchanged (bot script not modified) |
| — | AC-5.10.7 sim (`ac-5-10-7.mjs 300`) | PASS: 602 battles, 1,286 rushes, 0 failing |
| — | Engine / tutorial probes | edge-cases 8 PASS; tutorial cap (AC-9.4.3) PASS 20.02 s |
| 9 | Banned-term grep (fresh from §3, incl. new strings in src/audio, src/vfx, Settings) | 44 terms, **67 files**, 0 hard, 0 review, 0 name-only hits |
| 10 | **Release bundle** (all 8 hook names + my 4 older ones) | Clean `npm run build`: `__TEST__`, `summonSeed`, `summonLog`, `tutorialStep`, `audioDebug`, `vfxQuality`, `settingsScreen`, `particlesNow`, `sfxLog`, `inputLog`, `eventLog`, `battleState` = **0 each**. `VITE_TEST_HOOKS=1` → 3/1/4/1/1/6/1/2/2/2/2/1 (all > 0). Clean again → 0. `?vfxQuality=` / `?seed=` are dead in release |
| 4 | Busy-frame scan (L-qa-002), longest names, 3 sizes, **3 runs** | 0 overlaps / 0 off-screen in every run (157/140/140, 158/158/157, 157/158/140 frames; max 9–11 arena texts) |
| 4 | Screens at 3 sizes (`qa-screens`, now with Settings and the 3-button pause menu) | Layout scan **0 problems**. Checked by eye: `reports/screenshots/round-4/qa/360x640-02-home.png` (gear 44×44 top right), `430x932-02b-settings.png`, `r4-settings-360.png`, `r4-pause-menu.png` (Resume / Settings / Retreat, none over Pause) |
| 5 | Abuse (`qa-abuse`, `qa-summon` regression) | all pass (see e2e) |
| 6 | Console | **0 errors** in every spec |
| — | E2E (full suite, `QA_SHOTS=1`) | **71 passed, 2 failed**, 35 skipped by design.<br>• Failure 1: AC-17.8 → **BUG-4-01**.<br>• Failure 2: my perf spec's default-renderer ×4 run, which cannot finish on software WebGL; it was a test-environment issue and is now informational (×1 only), see §2.3.<br>After that fix the perf spec is 3/3 green, so the suite is **72/73 with 1 failure = BUG-4-01** |

### 1.1 AI rate sanity (item 8; no AI change this round)
`node tests/sim/ai-slip-rate.mjs 2500` passes all 4 tiers. Veteran and master were 3.0 / 3.4 pp low on seeds 1–2,500 and passed only through the small-n tolerance, so I re-ran on fresh seeds: `SEED0=100000 node tests/sim/ai-slip-rate.mjs 20000`.

| Tier | Slipped | Eligible windups | slip_chance | Cards with >1 roll |
|---|---|---|---|---|
| rookie | 9.8% | 13,359 | 10% | 0 |
| fighter | 24.9% | 9,512 | 25% | 0 |
| veteran | 39.9% | 9,153 | 40% | 0 |
| master | 55.0% | 7,210 | 55% | 0 |

Earlier lost-outcome breakdown: 0 lost (round-3 loop 2). Negative proofs (`QA_BREAK=nocommit`, `reroll`) are unchanged since round 3 loop 2.

**Not measured this round:** `perfect_slip_chance`, `riposte_chance`, `combo_continue`, `break_slip_chance`, `climax_chance`, `aggression`. These are **NOT VERIFIED** (no per-tier outcome script exists yet). No AI code or AI data changed this round.

### 1.2 Summon draw rates (new script, item 8 / L-qa-004)
`tests/sim/summon-rate.mjs` runs N seeded ×1 summons through the public `summon()` on a save with pity 0 and the first ×10 done, so every pull is a normal draw. The expected shares are computed independently from banners.json/characters.json with the §11.2 formula.

| Group | Measured (N = 100,000) | Data |
|---|---|---|
| ★3 | 79.94% | 80.00% |
| Tavi / Lark / Dunmore | 26.86 / 26.60 / 26.47% | 26.67% each |
| ★4 | 17.14% | 17.00% |
| Pell / Thessa / Rook | 5.59 / 5.86 / 5.68% | 5.67% each |
| ★5 | 2.92% | 3.00% |
| Solenne / Corvane | 1.45 / 1.47% | 1.50% each |

All within ±0.5 pp (SE ≤ 0.13 pp): **PASS**. Negative proof: `QA_BREAK=skew` (★5 600 bp in the logic's copy only) → `FAIL ★3 measured 76.97% data 80.00%` …

## 2. Round-4 ACs played in the browser

### 2.1 VFX and audio (`tests/e2e/qa-vfx-audio.spec.js`, shared `qa-battle-script.js`)
Scripted stage_005 battle: Climax → Ignition → Tri-Burst → 25 card taps. The **enemy AI is switched off** (L-qa-003) and each step's precondition is asserted. Every real camera flash and shake is counted independently by wrapping `Phaser Camera.prototype.flash/shake`.

| AC | Result |
|---|---|
| AC-17.5 (positive control first) | Reduce motion OFF: 4 camera flashes (= 4 VFX-limited flashes, 0 bypass), **max 1 in any rolling 1 s**; 5 shakes, max intensity 0.012, max 300 ms. Reduce motion ON: **0 flashes, 0 shakes**; the Ignition still shows the overlay, the form name "Overheat Form" and the sprite swap `spr_tavi_ignition`. **Negative proof** `QA_BREAK=flash` (4 camera flashes in 300 ms outside the limiter) → `max in 1 s=4` FAIL and the bypass check FAILs (8 camera vs 4 VFX) |
| AC-17.6 | Scripted battle: max **126** live particles (high). Forced low: max **60** (cap 60). **Stress** (synthetic climax hits into the VFX layer only, 4 s): high max **150**, low max **60**, about 2,100 requests skipped by the budget. **Negative proof:** the engine has two independent limits (pool capacity 150 and the live cap), so no single in-page break can exceed 150. `QA_BREAK=particles` asserts a stricter 100 / 40 and FAILs with 150 / 60, which proves the measurement is live |
| AC-17.7 (Canvas renderer, 5 runs) | Unthrottled median **16.7 ms** (p95 17.3–17.6). 4× CPU throttle p95 **28.9–32.8 ms** (≤ 33.3): **PASS, but with less than 1 ms margin in 3 of 5 runs.** **Negative proof** `QA_BREAK=stress` (400 extra climax hits per frame) → p95 76.2 ms FAIL. **Default renderer (WebGL): NOT VERIFIED.** The container has no GPU (software GL: median 112–117 ms even unthrottled, as documented since round 2), which says nothing about a phone |
| AC-17.8 | Climax overlay hidden 51–75 ms after its `freeze_end`; Ignition about 0 ms; **Tri-Burst still drawn 167–168 ms after `freeze_end` in 6 of 6 runs → BUG-4-01** |
| AC-18.2 | Before any input: `contextCreated false`, state `none`, 0 sounds, no track. After one tap on an empty Title spot: `running`, track `bgm_menu_01`, 16 notes started. **Negative proof** `QA_BREAK=gesture` (tap before the check) → FAIL |
| AC-18.4 | On `ignition`: duck reached 0.35 after **84 ms** (80 ms + 1 frame); back to 1.0 **301 ms** after `freeze_end` (300 ms + 1 frame); SFX bus unchanged. Context `running`. **Negative proof** `QA_BREAK=duck` (measure from `tri_burst_start`, where there is no duck) → 385 ms FAIL |
| AC-18.7 | Background in battle: context `running → suspended → running`; battle paused before and after returning; timer 8,999 → 8,999 → 8,999. The precondition (running before) is the positive control |

### 2.2 Settings (`tests/e2e/qa-settings-audio.spec.js`)
| AC | Result |
|---|---|
| AC-19.1 | Home gear → Settings (`from: Home`) → double tap Back → only Home active. Pause → Settings (`from: Battle`): timer unchanged (8,998 → 8,998 → 8,998), paused throughout. Double tap Back → only Battle active with the Pause menu (`menu_resume`, `menu_settings`, `menu_retreat`). Order Resume < Settings < Retreat; none covers Pause (R4-4) |
| AC-19.2 | 13 targets, all ≥ 44×44, gaps ≥ 8, 0 layout problems. **Negative proof** `QA_BREAK=small` (Music − as 40 px) → FAIL |
| AC-19.3 | Music − ×3 → 70% with a save write after each tap (0.9, 0.8, 0.7), `writes` 3. Reload → 70%. Drag 70% → 20% with 10 real touch moves → 20%, **1 write**. Double tap − → two steps, shown value = saved value |
| AC-19.4 | Master 90%: sfx/bgm bus 0.81 (AC-18.3 math 0.9² × 1²) → Mute → **0 / 0**, sliders unchanged → Un-mute → 0.81 / 0.81. Double tap on the toggle: shown = saved, 2 writes |
| AC-19.5 | Toggle in Settings → saved `reduce_motion: true` → survives reload → next stage_005 battle with a forced Ignition: **0 camera flashes, 0 shakes.** **Negative proof** `QA_BREAK=motion` (reduce motion switched off in the live layer) → 1 flash, 1 shake → FAIL |
| AC-19.6 (3 runs) | `navigator.vibrate` spy. Vibration off: `[]` during a battle with a hit taken and an Ignition. Toggle on: preview `[20]`. On: `[20, 80]`. The 40 ms Perfect-Slip vibration is **not exercised** (NOT VERIFIED). The off run is the negative case of the on run (same script, calls appear) |

### 2.3 My own test defects found and fixed this round (not game bugs)
- **Vibrate spy.** It was read-only, and Phaser assigns `navigator.vibrate` at boot, so the page failed to start. The spy now has a getter plus a no-op setter.
- **`__TEST__.eventLog` survives across battles.** A "player was hit" wait matched a hit from the previous battle. The log is now cleared at battle start.
- **Overlay latency.** It is now reported as both bounds: the last frame still drawn (hard lower bound) and the first frame hidden.
- **Perf on the default renderer.** Software WebGL cannot finish the script at ×4 throttle, so that run is now informational at ×1 only.
- **Screenshot folder.** My helper still pointed at `round-3/qa` and one run overwrote and partly deleted my round-3 evidence. I restored it from HEAD (my own files only, `git checkout HEAD -- reports/screenshots/round-3/qa/`) and moved round-4 shots to `reports/screenshots/round-4/qa/`. `QA_SHOTS` now points at round-4.

## 3. Re-tests
| Bug | Status | Evidence |
|---|---|---|
| BUG-3-03 "RIPOSTE!" over the hit counter | **VERIFIED FIXED** | `qa-busy.spec.js` 3 runs × 3 sizes: 0 overlaps in 1,365 busy frames (stage_005, longest names). The negative proofs from round 3 (`QA_BREAK_PLACER=placer` / `labels`) apply unchanged to the same scan |

Re-tested fixes: **1/1.**

## 4. Bugs

### BUG-4-01: The Tri-Burst cinematic overlay is still drawn ~167 ms after its `freeze_end` (AC-17.8 limit 160 ms)
Severity: MINOR (an AC fails by one frame; not visible to a player)
Owner: ui-developer (`src/scenes/BattleScene.js` `hideCinematic()`)

Steps:
1. `npx playwright test tests/e2e/qa-vfx-audio.spec.js --project=phone-360x640 -g "positive control"`. This is a scripted stage_005 battle with the enemy AI off: Climax, Ignition, then a landed Tri-Burst.
2. Read the `AC-17.8 overlay hide latency` line.

Expected (GDD §17.1 rule 1, AC-17.8): each cinematic overlay is hidden within 160 ms after its `freeze_end`.
Actual:
- `{"kind":"tri_burst","ms":184,"stillVisibleAtMs":167}` (6/6 runs: 167–168 ms still drawn, 184–185 ms first hidden frame).
- Climax (51 ms) and Ignition (~0 ms) are inside the limit, because their overlays were already fading before `freeze_end`.

`hideCinematic()` starts a 160 ms alpha tween on the frame after the `freeze_end` event is handled, so the fade ends one frame past 160 ms. Tri-Burst is the only cinematic whose VFX lasts all the way to `freeze_end`, so it shows the full fade.

Evidence: `tests/e2e/qa-vfx-audio.spec.js` › "AC-17.5/17.6/17.8/18.4 positive control" (fails on this assertion only), screenshot `reports/screenshots/round-4/qa/r4-battle-after-big-moments.png`.

Root-cause guess: shorten the fade to ≤ 140 ms (one frame of margin), or start it in the same frame the event is handled (e.g. set alpha directly from the event time).

### BUG-4-02: The repeat-clear Jade in the design docs does not match the shipped data
Severity: MINOR (documentation; no player impact)
Owner: game-designer (GDD §9.2 table) and economy-designer (`docs/ECONOMY.md` §2.2). The Producer should log the stage_003/005 change in `docs/STATUS.md`.

Steps:
1. `node -e 'const s=require("./data/stages.json").stages;console.log(s.map(x=>x.id+":"+x.rewards.repeat_clear.map(r=>r.amount)).join(" "))'`
2. Compare with GDD §9.2 ("Repeat" column) and ECONOMY.md §2.2.

Expected: one source of truth. The round plan says repeat-clear Jade is 10/20/45/50/75.
Actual:

| Source | Repeat-clear Jade (s1–s5) |
|---|---|
| data | 10 / 20 / 45 / 50 / 75 |
| GDD §9.2 and ECONOMY.md §2.2 | 30 / 30 / 40 / 50 / 60 |

The STATUS.md "Decisions" entry mentions only stage_001 30 → 10 and stage_002 30 → 20, not stage_003 → 45 or stage_005 → 75.

Evidence: the command output above; GDD lines `| stage_003 | … | 400 Jade | 40 |`, `| stage_005 (boss) | … | 60 |`; ECONOMY.md §2.2 table.

## 5. Feel changes (L-shared-014)
- **The new VFX and audio layers.** The round plan names these, and the R3 baseline values (shake 120 ms × 0.006, KO shake 250 ms × 0.01, 120 ms cinematic flash) are measured unchanged (max intensity 0.012 only from the new Tri-Burst impact, which §17.2 allows).
- **Unplanned changes:** none observed. Battle speed per second is unchanged (bot average timer 118 s, same as round 3's 116–120 s).

## 6. Observations (not bugs)
- **AC-17.7 margin.** Canvas at 4× throttle is p95 28.9–32.8 ms against a 33.3 ms limit. A small VFX addition could tip it over. Auto quality switched to low in some runs and not in others.
- **Real-device check.** WebGL performance needs a real device check (NOT VERIFIED here). This fits the owner's pre-release playtest (CLAUDE.md §8).
- **Random-tap timeouts.** As in round 3: s3 28, s4 23, s5 38 of 82. Balance proxies are what count.

## 7. Counts

| Severity | Count | Bugs |
|---|---|---|
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 2 | BUG-4-01, BUG-4-02 |
| POLISH | 0 | — |

Re-tested fixes: 1/1 VERIFIED FIXED (BUG-3-03).

QA RESULT: PASS
