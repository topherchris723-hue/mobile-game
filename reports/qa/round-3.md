# QA report: round 3, loop 1

Tester: qa-tester. Date: 2026-10-23. Build: clean working tree at `6b514d0` (plus my test files only).

**Read first (L-shared-001):**
- `.claude/agents/qa-tester.md`, including the new Hard rule (L-shared-006: every new or changed check is run against an injected fault and the FAIL is pasted here).
- `lessons/qa-tester.md` (L-qa-001, L-qa-002 live busy frames) and `lessons/_shared.md` (through L-shared-009).
- `docs/GAME_BRIEF.md` and `reports/balance/round-3.md` (both passes).
- GDD sections changed this round:
  - §1 (Jade Tempest, AC-1.1) and §3.
  - §5.0 counting convention and §5.7/§5.8.5 `chain_index`.
  - §5.10 (rush invulnerability, `hit_discarded`, AC-5.10.7–5.10.9, BAL-5.10) and §5.14/BAL-5.14 (HP ×2).
  - §5.15 (one decision per card on tick D, AC-5.15.5/5.15.7/5.15.8).
  - §9.4 (exits, cap, AC-9.4.3–9.4.7).
  - §11 (rewritten, AC-11.1–11.14).
  - §15.3 rules 4 and 10–12, and §15.4 (FX-GDD, W/X/P classes).

## 1. Commands and results

| Check | Command | Result |
|---|---|---|
| Unit tests | `npm test` | **375/375 passed** (26 files) |
| Data validator | `npm run validate-data` | PASS: 8 files, 0 errors, 0 warnings. The validator's must-FAIL fixtures for rules 4 and 10–12 run inside `npm test` (validator suite). The balance-analyst's report also shows rules 10–12 failing all 4 retired `bands.mjs` inputs |
| Build | `npm run build` | OK |
| **Release bundle** | clean `npm run build`, then grep `dist/assets/*.js` | `__TEST__` 0, `sfxLog` 0, `inputLog` 0, `eventLog` 0, `battleState` 0, `tutorialStep` 0, `test-hooks` 0, `?test` 0. The only `URLSearchParams` left is the renderer switch. `testSeedParam` is compile-time null, so `?summonSeed=` / `?seed=` do nothing in release (no seeded re-roll). **Negative proof:** `VITE_TEST_HOOKS=1 npm run build` gives `__TEST__` ×3. A clean build afterwards gives 0 again |
| Banned-term grep (L-qa-001, fresh from §3) | `node tests/sim/banned-grep.mjs` | 44 terms, 48 files (data/, src/ incl. the new summon strings, index.html), **0 hard, 0 review**. Name-only Spark/Sparks: 0 hits. Re-proved on the test file: `Spark Kick` (name) and `SPARKS ARENA` (game_title) give 2 NAME-HITs; `Legends Limited` gives a HIT; "little sparks" in prose gives no hit. No store text exists yet |
| AC-1.1 title | grep + screenshot | `strings.json` `game_title` = "Jade Tempest", used via `t('game_title')` in TitleScene/HomeScene (not hardcoded). `index.html` `<title>Jade Tempest`. The 4 not-chosen titles and "Card Fighters": 0 hits in src/, data/, index.html. Title screen checked by eye: `reports/screenshots/round-3/qa/360x640-01-title.png` |
| Logic purity | same grep as round 2 | 0 lines in src/logic. `Math.random` exists only in `src/state/summon-save.js` as the documented crypto fallback (GDD §11.3), outside src/logic |
| Bot playthrough | `node tests/sim/bot-playthrough.mjs --per-stage 50 --ai-per-stage 8 --seed 3000` (410) + `--per-stage 30 --seed 77001` (150) | **560 battles, 0 failed. 780 Tri-Burst rushes checked.** 0 crashes, 0 never-ending battles, 0 NaN/negative HP, 0 softlocks, 0 non-determinism |
| AC-5.10.7 (P) | `node tests/sim/ac-5-10-7.mjs 1000` (new) | **PASS: 2,002 battles** (master vs master, stage_004 + stage_005 seeds 1–1,000, plus stage_005 seeds 90 and 3,345), **4,291 rushes**. Every rush resolves at T+18 or the battle ended in T…T+17. 0 safety_net whiffs, 0 KO of a rushing team, 0 Ignition cancels. **Negative proof:** `QA_BREAK=late` (expects T+19) gives `FAIL … 42 failing battles` |
| AI one roll per card (BUG-3-01) | `node tests/sim/ai-slip-rate.mjs 4000` (new) | 0 cards with more than 1 roll in any tier. Rookie and fighter are within ±2 pp. **Veteran and master FAIL** → BUG-3-02 |
| Engine probes | `node tests/sim/edge-cases.mjs` | 8 PASS, 0 FAIL |
| Tutorial probes | `node tests/sim/tutorial-stuck.mjs` (updated to the new `TutorialController(steps, battle, rules)` signature) | Scenarios A/B2 still fixed. New **Scenario C (AC-9.4.3 cap): PASS**: the tag prompt shows for 20.02 s (cap 20 s), does not re-fire, and speed returns to 1.0. **Negative proof:** `QA_BREAK=nocap` gives `FAIL … shown 420.57 s` |
| E2E | `npx playwright test` (hooks build, shots off) | **45/45 executed passed** (19 skipped by design: QA specs run once, in the 360 project). Includes my new `qa-summon.spec.js` (6) and the updated `qa-screens`, `qa-busy`, `qa-abuse` and `qa-tribust-lock` specs |
| Console errors | every e2e spec | **0** (`pageerror` / `console:` count 0). The deliberate `setItem` throw in AC-11.10 is filtered by message |
| Screenshot gating | `git status` after a run without `QA_SHOTS` | Only my test files changed. No screenshots rewritten. QA shots now go only to `reports/screenshots/round-3/qa/`, written only with `QA_SHOTS=1` (or `UI_SHOTS=1`) |

### 1.1 Bot playthrough detail (HP ×2 data)

Seed 3000: 50 random-input battles per stage plus 8 per AI tier on the player side.

| Stage | Wins | Losses | KO-ended | Timeout | Max real ticks |
|---|---|---|---|---|---|
| s1 | 82 | 0 | 82 | 0 | 6,952 |
| s2 | 82 | 0 | 80 | 2 | 10,568 |
| s3 | 62 | 20 | 53 | 29 | 13,310 |
| s4 | 52 | 30 | 55 | 27 | 13,080 |
| s5 | 53 | 29 | 39 | 43 | 13,008 |

- No timeout explosion and no softlock.
- The longest battle is 13,310 real ticks: 180 s timer + about 42 s of freezes.
- Average timer is 116.8 s (seed 3000) and 133.9 s (seed 77001), up from 56 s in round 2.
- Timeouts here come from *random tapping* bots, not the balance proxies. The balance-analyst's `proxy_skilled` shows at most 16.8%. Not a bug; see §4.
- **New invariants this round:**
  - AC-5.10.7 end condition (a rush may stay unresolved only if the battle ended in T…T+17).
  - 0 `safety_net` whiffs.
  - 0 KO during a team's own rush.
- **Checker fixes:** my round-2 rush-end check was stricter than the GDD and flagged stage_005 seed 3004, where the rush started on tick 10,789 and the battle timed out on 10,799. I aligned it with AC-5.10.7.
- **Negative proofs, all FAIL as expected:**
  - `QA_INJECT=rushhang` → `player rush from tick 7484 never resolved; battle ended tick 10799`.
  - `nan` → `hp NaN/21160`.
  - `negvigor` → `vigor -833.3`.
  - `neverend` → `timer increased`.
  - `throw` → `EXCEPTION … advanceTimers`.
  - `dup` → `hand has 4x … (copies 2)`.

### 1.2 Live busy frames (L-qa-002)
`QA_SHOTS=1 npx playwright test tests/e2e/qa-busy.spec.js` runs stage_005 with the **longest names in data** (player team Solenne / Corvane / Dunmore, 7 chars; enemy "Umbral Solenne", 14 chars, forced active). An in-page bot taps cards and swipes continuously. It scans real Text bounds about every 120 ms for 25 s per size and checks:
- text against text;
- text against the screen edge;
- each fighter silhouette fully on screen (new this round, for BUG-2-11).

| Size | Frames scanned | Max arena texts | Problems |
|---|---|---|---|
| 360×640 | 155 | 9 | 0 |
| 390×844 | 130 | 9 | 0 |
| 430×932 | 150 | 11 | 0 |

**Negative proofs:**
- `QA_BREAK_PLACER=placer` (float placer returns the wanted spot unchecked): **195 / 170 / 193** overlaps.
- `QA_BREAK_PLACER=labels` (after every render, enemy label put on the player's label and enemy silhouette pushed off-screen): **18 / 18** problems per size.

Checked by eye:
- `reports/screenshots/round-3/qa/360x640-busy-frame-clean-2.png`: "Solenne" and "Umbral Solenne" apart, shout above them.
- `430x932-busy-end.png`: both fighters at the right wall, labels apart and fully on screen; TRI-BURST in its locked "WAIT" look.

### 1.3 Screens at 3 sizes
`qa-screens.spec.js` covers 31 screens × 3 sizes plus 360×800. It is updated for round 3: the old "disabled Summon toast" step is replaced by Summon, Rates, Confirm, Reveal, Results and back.
- Layout scan: **0 problems** (target sizes and 8 px gaps, text clipped, font < 12, text overlap, raw `[key]`, shop/purchase words).
- **Checked by eye:**
  - `360x640-03a-summon.png`: banner, featured fighters, pity line, first-×10 line, buttons.
  - `360x640-03b-summon-rates.png`: full table and rules.
  - `430x932-03c-summon-confirm.png`: "Summon ×10 for 1,000 Jade? Jade after: 0". Confirm is mid-screen, well away from the ×10 button.
  - `390x844-03d-summon-reveal.png`: 1/10, NEW, Skip.
  - `360x640-03e-summon-results.png`: 10 rows in pull order, NEW / Resonance +1 (R1→R3), pull 10 ★5 Solenne.
  - `360x640-01-title.png`.

## 2. Re-tests

| Bug | Status | Evidence |
|---|---|---|
| BUG-2-11 name labels collide; enemy clipped at the wall | **VERIFIED FIXED** | `qa-busy.spec.js`: 0 label overlaps and 0 off-screen silhouettes in 435 busy frames at 3 sizes with the longest names. It fails when broken (`labels` break above). `430x932-busy-end.png` checked by eye |
| BUG-3-01 AI re-rolled its slip every tick (balance-analyst) | **VERIFIED FIXED** (the re-roll itself) | `node tests/sim/ai-slip-rate.mjs 4000`: "cards with >1 roll: 0" in all 4 tiers. Rookie 9.4% (slip_chance 10%) and fighter 23.9% (25%) are inside ±2 pp. **Negative proof:** `QA_BREAK=reroll` (clears `watched` every tick, the old bug) gives 603–1,076 cards with more than 1 roll per tier and rookie 33.4% / fighter 43.9%. **A separate defect remains for veteran/master: BUG-3-02** |

Re-tested fixes: **2/2 confirmed fixed.**

## 3. Summon (§11): browser abuse and P-class ACs (`tests/e2e/qa-summon.spec.js`, 6/6 pass)

| AC / case | Result |
|---|---|
| AC-11.6 Jade 0 / 99 / 100 / 999 / 1,000 | Buttons ok = `[F,F] [F,F] [T,F] [T,F] [T,T]` (×1, ×10), and the targets' enabled flags match. Disabled buttons show "Not enough Jade — clear stages to earn more."; a double tap on a disabled button opens no dialog; Jade is unchanged |
| AC-11.12 double taps | Double tap on ×10 → one dialog, no summon. Confirm never overlaps ×10. Double tap on Confirm 100 ms apart, then 6 taps during the reveal where the ×10 button was → `total_pulls 10`, one `summon_returned`. **Negative proof** `QA_BREAK=double` (guard removed) → `total_pulls 20`, two `summon_returned` → FAIL |
| AC-11.5 reload mid-reveal | The save after reload equals the save written before the reveal: roster, Resonance, Jade once, pity, `first_multi_done`. No reveal replays, the first-×10 line is gone, and there is no refund |
| Kill the page right after Confirm (0 / 15 / 40 / 80 / 150 / 400 ms) | Always `all` (Jade 0, 10 pulls, roster 5–7). Never half. **Negative proof** `QA_BREAK=half` (setItem writes only the Jade change) → `HALF(jade 0, pulls 0, roster 3)` ×6 → FAIL |
| AC-11.10 `setItem` throws | Shows "Summon failed — no Jade was spent.", stays on Summon, in-memory save identical, ×1 still usable afterwards |
| AC-11.4 rate table | ★5 3.00%, ★4 17.00%, ★3 80.00%; Solenne/Corvane 1.50% ("(featured)"); Pell/Thessa/Rook 5.67%; Tavi/Lark/Dunmore 26.67%; rounding note present |
| AC-11.11 pity / first-×10 lines | Fresh save "★5 guaranteed within 40 summons." plus the first-×10 line. After each of 3 ×1 pulls the line equals `40 − pity.standard`, and the first-×10 line stays (×1s are not a ×10). After a ×10 it is gone (AC-11.5 test) |
| Rotate during the reveal | Goes to results (`phase: results`), `total_pulls` unchanged (no re-summon), results grid has 0 layout problems |
| Jade 999,999 | The top bar fits (0 layout problems). After a ×10, Jade is 998,999 and never exceeds the cap |

## 4. Bugs

### BUG-3-02: Veteran and master AI drop most of their planned Slips by starting their own card first; slipped share is far below `slip_chance`
Severity: MAJOR
Owner: gameplay-programmer (`src/logic/ai.js`). The game-designer should confirm the intended rule. The balance-analyst must re-run stage_004/005 after the fix.

Steps:
1. `node tests/sim/ai-slip-rate.mjs 4000`. Per seed, a fresh battle: the player plays one Climax beam (`card_pell_thousand_dawns`, 45-tick windup) at melee range. Both sides have Vigor 10. The AI is Idle when the card starts. Only windups where the AI was Idle with Vigor ≥ 2 on its decision tick D are counted (the AC-5.15.7 condition, read from `dodgeLog`).
2. For the breakdown, run `node tests/sim/ai-slip-breakdown.mjs` (2,000 seeds per tier).

Expected (GDD §5.15, AC-5.15.7 statistical check): the slipped share of player Climax windups (AI Vigor ≥ 2 and Idle on D) is within ±2 pp of the tier's `slip_chance`. Reactive dodge: "On success it rolls perfect_slip_chance … it starts the Slip 6 ticks before the hit; else 15 ticks before."

Actual:

| Tier | Slipped | Eligible windups | slip_chance | Result |
|---|---|---|---|---|
| rookie | 9.4% | 2,690 | 10% | PASS |
| fighter | 23.9% | 1,956 | 25% | PASS |
| veteran | **27.2%** | 1,828 | 40% | FAIL |
| master | **16.5%** | 1,487 | 55% | FAIL |

The roll itself is correct: veteran rolled "planned" on 341 of 904 (37.7%), master on 388 of 740 (52.4%). But between D and the planned Slip tick, the AI's own decision loop starts a card, so on the Slip tick the AI is in Windup/Active and `plannedSlip()` returns null:
- veteran loses 103 of 341 planned Slips (Windup 78, Active 25);
- master loses **272 of 388** (Windup 202, Active 67, Recovery 3).

Fighter loses 0 of 226, because its slower `think_interval` rarely fires inside the window.

Impact:
- The stage_005 boss (master) dodges about 3× less than designed.
- The higher tiers are less defensive than the lower ones relative to their parameters.
- BAL-5.15 / BAL-5.10 were tuned on this behaviour, so the balance numbers move once it is fixed.

Evidence:
- `tests/sim/ai-slip-rate.mjs` output: `FAIL veteran slipped 27.2% … FAIL master slipped 16.5% …`.
- The breakdown line `enemy_corvane_001 {"planned":388,"no_slip":352} planned 388 slipped 116 lost (AI state on planned tick): {"Windup":202,"Active":67,"Recovery":3}`.
- Negative proof of the checker: `QA_BREAK=reroll` FAILs all tiers with 603–1,076 multi-roll cards.

Root-cause guess: `AiController.decide()` runs decision-loop items 5–7 (play a card or move) while `plannedSlipAt >= 0`. When a Slip is planned, the AI should not start a new card or dash before the planned tick (or should treat the plan as a commitment), so that `plannedSlip()` finds it in an allowed state. The unit tests check one roll per card but not that a planned Slip happens.

## 5. Observations (not bugs)
- **Random-tap timeouts.** Random-tap bots hit timeouts often on stages 3–5 (up to 52% on s5 with seed 3000, 80% with seed 77001). The balance-analyst's proxies give at most 16.8% (BAL-5.14). This is for the balance-analyst to watch only.
- **Master-vs-master length.** In my AC-5.10.7 run, 603 of 2,002 master-vs-master battles ended by timeout (30%). This is not covered by any target.
- **Results grid.** It does not mark which pull was guaranteed (e.g. pull 10 "first ×10"). The GDD §11.1 grid only requires NEW / Resonance / +N Jade, so this is not a defect. A design option is to show the `guarantee` value, which the logic already returns.
- **Interface change (L-shared-009).** `TutorialController`'s constructor changed to `(steps, battle, rules)` and broke my round-2 probe. I fixed the probe, which is my file. Nothing in the game was affected.

## 6. Counts

| Severity | Count | Bugs |
|---|---|---|
| BLOCKER | 0 | — |
| MAJOR | 1 | BUG-3-02 |
| MINOR | 0 | — |
| POLISH | 0 | — |

Re-tested fixes: 2/2 VERIFIED FIXED (BUG-2-11, BUG-3-01).

QA RESULT: FAIL

---

# Loop 2 (round 3, QA loop 2)

Build: `cbe5ae2`. That is BUG-3-02 fixed in `cc3e627` (`AiController.slipCommitted()`) plus the balance-analyst's re-check (no data change). Regression scope is proportional to an AI-only logic change: the full headless set plus the full e2e suite.

## L2.1 Re-test

| Bug | Status | Evidence |
|---|---|---|
| BUG-3-02 planned AI Slips lost to own card | **VERIFIED FIXED (every tier)** | `node tests/sim/ai-slip-rate.mjs 4000`: rookie 9.4% (10%), fighter 23.9% (25%), **veteran 38.1% (40%)**, **master 53.4% (55%)**. All PASS within ±2 pp; 0 cards with more than 1 roll. `node tests/sim/ai-slip-breakdown.mjs` (now includes rookie): planned → slipped rookie 121/121, fighter 226/226, veteran 341/341, master 388/388, **0 lost**. **Negative proofs:** new `QA_BREAK=nocommit` (`slipCommitted` forced false = the fix switched off) brings back the loop-1 numbers (veteran 26.3%, master 15.7%) → FAIL. `QA_BREAK=reroll` (the BUG-3-01 bug) → 3 of 4 tiers FAIL at n=500 |

## L2.2 Regression pass

| Check | Result |
|---|---|
| `npm test` | **381/381 passed** (26 files; +6 per-tier outcome tests) |
| `npm run validate-data` | PASS, 0 errors, 0 warnings |
| Bot playthrough (`--per-stage 50 --ai-per-stage 8 --seed 4000`) | **410 battles, 0 failed**, 560 rushes checked. Average timer 120.2 s, max 13,212 real ticks. Timeouts by stage: s1 0, s2 3, s3 40, s4 27, s5 49 of 82 (random-tap bots, as in loop 1). The injection self-tests are unchanged from loop 1 (bot script not modified this loop) |
| AC-5.10.7 (`node tests/sim/ac-5-10-7.mjs 1000`) | **PASS: 2,002 battles, 4,275 rushes, 0 failing.** The checker is unchanged; its loop-1 negative proof (`QA_BREAK=late`) still applies |
| Engine / tutorial probes | edge-cases 8 PASS; tutorial Scenario C (AC-9.4.3 cap) PASS 20.02 s |
| Banned-term grep | 44 terms, 48 files, 0 hard, 0 review, 0 name-only hits |
| Release bundle | clean build: `__TEST__` / `sfxLog` / `inputLog` / `eventLog` / `battleState` / `test-hooks` all **0**. `VITE_TEST_HOOKS=1` build → `__TEST__` 3 (the check can fail). Clean again → 0 |
| E2E `npx playwright test` | First run: 43/45 passed, 2 failed. After fixing my own test defect (below): `qa-tribust-lock` 2/2 passes, the ENEMY-rush test **4/4 repeated runs**. The remaining failure is `qa-busy` → **BUG-3-03**. So the e2e result is **44/45**, with the 1 failure being a filed bug |
| Console errors | **0** across the suite |

**Test defect fixed (mine, not a game bug): `qa-tribust-lock.spec.js` › "…during the ENEMY's rush…"**
- What happened: it started the enemy's rush with `applyInput('enemy', …)` without checking that the rush started. With the fixed AI, the enemy is sometimes committed to a Slip or spends its own full gauge first, so no rush started and `burstReady` stayed true. The failing runs (2 of 3) are the evidence that the assertion fails when no rush is running.
- Fix: the enemy AI is switched off for that test (`controllers.enemy = null`). The test waits for `triBurstMode('enemy').ok` and asserts that the rush started.

## L2.3 New bugs

### BUG-3-03: The "RIPOSTE!" callout is drawn over the combo hit counter ("N HITS")
Severity: MINOR
Owner: ui-developer (`src/scenes/BattleScene.js` / `src/ui/float-placer.js`)

Steps:
1. Run `QA_SHOTS=1 npx playwright test tests/e2e/qa-busy.spec.js` (stage_005, longest names, bot-driven fight).
2. Wait until the player has a chain running (combo counter visible top-left) and a Perfect Slip leads to a Riposte.

Expected (GDD §14; BUG-2-10 intent; L-qa-002): battle texts never overlap.
Actual: "RIPOSTE!" (30 px callout at about W × 0.34 in the upper band) covers "2 HITS". The combo counter (`comboText` / `comboHits`) is drawn at a fixed spot and is not registered as an `avoid` rectangle in the float placer, so callouts are placed on top of it.
- Seen at 360×640 (2 frames, overlap 12×17 px) in the second run, and at 390×844 (3 frames) in the full-suite run.
- It was latent before. It shows now because the BUG-3-02 fix makes the AI Slip at its designed rate, so Perfect Slips and Ripostes happen more often while a chain is shown.

Evidence:
- `tests/e2e/qa-busy.spec.js` (fails): `360x640 tick 474: "2 HITS"(a1) × "RIPOSTE!"(a1) 12x17`.
- Screenshot `reports/screenshots/round-3/qa/360x640-busy-overlap-1.png`, checked by eye: it reads "2 HIT" with the rest hidden under "RIPOSTE!".
- `reports/screenshots/round-3/qa/busy-findings.txt`.

Root-cause guess: add the combo counter's current bounds (while visible) to `floatAvoid()`, or move the counter into a band the placer reserves.

## L2.4 Counts (loop 2, open bugs)

| Severity | Count | Bugs |
|---|---|---|
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 1 | BUG-3-03 |
| POLISH | 0 | — |

Re-tested fixes: 1/1 VERIFIED FIXED (BUG-3-02).

QA RESULT: PASS
