# Balance report — round 3 (balance-analyst)

Read first: playbook + hard rules (none), lessons/_shared.md, lessons/balance-analyst.md (empty), GAME_BRIEF, GDD §5 (incl. §5.14, §5.15), §6, §7, §8, §9.2, §12, round-1/2 notes (no balance notes in them; the known issues come from STATUS.md), src/logic/README.md.

## Method
- Harness: `tests/sim/balance/` (lib.mjs, worker.mjs, balance.mjs, bands.mjs). It runs the real engine headlessly and patches data in memory to test changes. Seeds are fixed, and runs are parallel.
  `node tests/sim/balance/balance.mjs stages|mirror|cards|sweep|stagesweep|selftest`.
  `BALANCE_LOGIC=<index.js>` selects which copy of the engine to run (used to pin a snapshot while src/ was being edited in parallel).
- Harness proof (L-shared-006): `selftest` passes. On stage_003 at fighter tier the baseline is 78.0% win, 69.7 s. Enemy ATK ×3 drops it to 0.5%, Tavi HP 100 to 1.5%, and Vigor regen 0.25/s lengthens battles to 160.2 s. Unknown patch ids and fields throw. Results are identical to `scripts/sim.js` on 200 seeds (0 mismatches).
- `bands.mjs` checks GDD §6 bands, §6 Ignition guidance, §7 budgets and §8 stat_mult. It passes on old and new data. It FAILs on 4 broken inputs: Fist power 9.9, ★3 ATK 2000, Ignition heal 0.2, stat_mult.hp 0.2.
- "Good play" = a **veteran**-tier AI playing the player side. "Average play" = fighter tier. The mirror test is 1v1 with equal rarity, stat_mult 1.0, Ignition on, both sides at the same tier, every pair played from both sides.

## Engine finding that changes balance (MAJOR, gameplay-programmer)
`src/logic/ai.js` `reactiveDodge()`: when the slip roll fails, it sets `this.watched = null`. On the next tick the same windup is picked up again with `reactAt` already in the past, so the AI rolls again every tick until the hit. GDD §5.15 says one roll. Measured share of Climax windups slipped: rookie 45% (slip_chance 0.10), fighter 69% (0.25), veteran 81% (0.40), master 84% (0.55). With a one-roll fix (scratch copy only): 6/15/32/37%. Effect today: 87% of Climaxes whiff, which also applies to a human player's Climaxes. Characters with fast Fists are favoured and characters with slow beams are punished.
The fix is to drop `this.watched = null` in the three "no slip" branches (keep the windup marked as decided). The tuning below targets the GDD-correct AI. The current AI is also shown.

## Stage curve (starter team, 2,500 battles per cell)
| Stage | Before, current AI (fighter / veteran) | After, fixed AI (fighter / veteran / master) | After, current AI (fighter / veteran) |
|---|---|---|---|
| stage_001 | 100 / 100 | 100 / 100 / 100 | 100 / 100 |
| stage_002 | 100 / 100 | 100 / 100 / 100 (rookie 99.6) | 100 / 100 |
| stage_003 | 80.6 / 96.8 | 83.9 / 80.8 / 84.4 | 78.2 / 95.7 |
| stage_004 | 5.4 / 37.6 | 49.3 / 50.3 / 56.2 | 27.9 / 69.4 |
| stage_005 | 0.0 / 0.4 | 24.2 / 26.0 / 35.2 | 3.8 / 33.6 |
Each stage is harder than the last: win rate goes down at every tier, and for stages 1→2 player HP left drops from 89.6% to 72.3%.

## Mirror win rate (2,000 per ordered pair, same fresh seeds before/after)
| | Tavi | Lark | Dunmore | Pell | Thessa | Rook | Solenne | Corvane |
|---|---|---|---|---|---|---|---|---|
| Before, fixed AI, fighter | **74.0** | 48.1 | **28.0** | **66.3** | 45.2 | **38.6** | **38.0** | **62.0** |
| Before, fixed AI, veteran | **76.4** | 45.0 | **28.6** | **61.5** | **39.3** | 49.2 | 41.1 | 58.9 |
| After, fixed AI, fighter | 57.3 | 45.2 | 47.5 | 58.2 | 47.8 | 44.0 | 41.8 | 58.2 |
| After, fixed AI, veteran | **62.7** | 42.1 | 45.2 | 51.4 | 42.2 | 56.3 | 44.1 | 55.9 |
| After, current AI, veteran | **~61.8** | ~49 | **~38.9** | 46.4 | **34.6** | **69.0** | 42.1 | 57.9 |
(The current-AI row was measured before the Lark change and moves by about 1 point.) Remaining outlier: Tavi 62.7% at veteran. Without his Ignition all three ★3 sit at 47–53%. The rest needs Ignition fields that the GDD §5.9 examples and tests pin (see Needs designer).

## Changes (all inside GDD §6/§7/§8)
| File | ID.field | Old → New | Why |
|---|---|---|---|
| characters | char_tavi_001.base_stats.atk | 950 → 850 | Tavi ★3 outlier (Ignition) |
| cards | card_tavi_overheat_barrage.power | 3.2 → 2.75 | same (Ignition deck) |
| cards | card_tavi_meltdown_meteor.power | 7.2 → 6.5 | same (Ignition Climax) |
| characters | char_dunmore_001.base_stats.atk | 850 → 950 | Dunmore 28% |
| cards | card_dunmore_riverstone_jab.power | 1.2 → 1.3 | same |
| cards | card_dunmore_bulwark_palm.power | 0.9 → 1.0 | same |
| cards | card_dunmore_skipping_stone.power | 1.5 → 1.7 | same (lowest damage per play of all Bolts) |
| cards | card_dunmore_quarry_quake.power | 2.7 → 2.95 | same |
| cards | card_dunmore_mountain_drop.power | 5.8 → 6.0 | same |
| characters | char_lark_001.base_stats.atk | 900 → 950 | Lark 39.8% after the above |
| characters | char_pell_001.ignition.heal_pct | 0.15 → 0.05 | Pell 66% |
| characters | char_rook_001.base_stats.hp | 9000 → 9500 | Rook 38.6% (fighter) |
| characters | char_thessa_001.base_stats.hp | 9300 → 9700 | Thessa 39.3% (veteran) |
| characters | char_corvane_001.ignition.stat_mult.atk | 1.4 → 1.3 | Corvane 62% |
| enemies | enemy_rook_003 / enemy_pell_002 / enemy_solenne_001 .stat_mult | 1.0 → 0.88 (all three stats) | stage_004 5% → ~50% |
| enemies | enemy_thessa_002 / enemy_umbral_solenne_001 .stat_mult | 1.05 → 0.75 | stage_005 0% → ~26% veteran |
| enemies | enemy_corvane_001.stat_mult | 1.2/1.1/1.1 → 1.0/0.7/0.8 | same; boss keeps the highest HP (11,000) |
Flagged risks checked: Aura Thief's 0.4 swing barely matters (halving its self-buff moved Corvane less than 1 point). Tailwind Kick and Gambit Cyclone are not outliers (Lark and Rook are within 40–60%).

## Needs designer
1. **Battle length (formula/band change):** stages 3–5 last 64–74 s of timer against the 120–200 s target, and nothing inside the bands can double it. Proposal: **double every HP** (GDD §6 HP bands ×2: ★3 16,000–18,000, ★4 18,000–20,000, ★5 20,000–22,000; `base_stats.hp` ×2; `power_formula` HP coefficient 0.1 → 0.05 so team power stays the same). Sim with fixed AI, fighter / veteran: s3 141 / 152 s, s4 139 / 147 s, s5 144 / 153 s; win rates 89/75, 47/42, 21/20 (stage_005 then needs a small retune). Alternatives measured: HP ×2.5 gives about 175 s but s5 drops to 13% veteran; Vigor regen 0.5/s gives 104–117 s, which is too short and slower to play. Tests pinning 8,200 HP (AC-5.9.1) and AC-8.1 would need updating.
2. **Tavi Ignition is pinned by GDD examples:** §5.9's example and AC-5.9.1/5.9.3/5.9.6 use Tavi's live values (hp_below 50, ATK ×1.3, 25 s, heal 10%, +0.2 regen), and so do tests/logic/battle-ignition-burst-end.test.js and tests/ui/tutorial-acs.test.js. If those ACs move to a test fixture, setting Tavi's Ignition to heal 0.05, ATK ×1.2, 20 s, regen 0 and hp_below 40 brings him to 59% (measured).
3. **§9.2 stat_mult table** needs updating to the values above. Stage_005 regulars (0.75) now sit below stage_003 (0.9), because stages 4–5 are ★4/★5 with Ignition and higher AI tiers against ★3 starters. `stages.json` recommended_power was not changed (advisory).
4. **AI tiers do not model player skill:** as the player side, master ≈ veteran ≈ fighter on stage_003 (84 / 81 / 84). No tier can ever slip a Fist (windup 6–12 ticks is shorter than every reaction_s). The "good play" proxy is weak.
5. **Tri-Burst rush when the rusher is KO'd (GDD gap and engine, MINOR):** a rusher KO'd mid-rush by a projectile already in flight ends the rush through the safety net 9–10 ticks in. With the new data, AC-5.10.7 (tests/logic/battle-round2.test.js, stage_005 master vs master, seed 90) now fails 1 of 315 tests; seed 3345 also hits it. The old data never reached it on seeds 1–6000.
6. **Validator gap:** `npm run validate-data` does not check §6 bands or §7 budgets (Fist power 9.9 and ★3 ATK 2000 both PASS). `tests/sim/balance/bands.mjs` covers this now; consider adding it to the validator.

---

# Pass 2 (round 3, after HP ×2, AI fix BUG-3-01, rush invulnerability, AC-5.10.9, AC-5.15.8)

Engine: the committed HEAD 3b2d663 (logic identical to 602ae23), snapshotted in the scratchpad so parallel edits could not affect the runs.
- Harness additions: `proxy_average` and `proxy_skilled` (GDD §5.15), added to `ai_tiers` **in memory only**. `proxy_skilled` spacing is `installSpacing()` in lib.mjs: one roll per enemy Fist approach that starts beyond distance 20, using its own seeded RNG and public state only. The dash is used only on a tick where the AI chose no input. On stage_004 over 200 battles: 4,173 approaches, 1,318 rolls, 549 dashes.
- New metrics: KO-ended median timer and timeout share (BAL-5.14); full-team Tri-Burst damage / target max HP (BAL-5.10); mission share of wins via the engine's `missionMet` (§9.3).
- Selftest PASS. Its Vigor-regen break moved to stage_002, because stage_003 now lasts about 140 s and the break was capped by the 180 s timer.
- `bands.mjs` is retired. `npm run validate-data` rules 10–12 plus the schema FAIL all four of its must-FAIL inputs (Fist power 9.9 → rule 12; ★3 ATK 2000 → rule 10; Ignition heal 0.2 → rule 11; stat_mult.hp 0.2 → schema).
- AC-9.1.1: all 8 fighter powers are unchanged after HP ×2 with coefficient 0.05 (1870 / 2005 / 2090 / 2180 / 2205 / 2225 / 2440 / 2490). Must-FAIL: coefficient left at 0.1 raises each power by 0.1 × old HP (Tavi 1870 → 2690).
- Tavi's proposed Ignition nerf is **not applied**: after HP ×2 Tavi measures 52.2% (average) / 57.1% (skilled).

## Before (pass-1 data) → after (pass-2 data), same engine, 2,500 battles per cell
| Stage | Proxy | Win | KO-ended median s | Timeouts | Tri-Burst % max HP | time_under_s share |
|---|---|---|---|---|---|---|
| stage_001 | average | 100 → 100 | 13 → 28 | 0 → 0 | – | – |
| stage_001 | skilled | 100 → 100 | 14 → 29 | 0 → 0 | – | – |
| stage_002 | average | 100 → 100 | 32 → 63 | 0 → 0 | 78.5 → 44.0 | – |
| stage_002 | skilled | 100 → 100 | 33 → 63 | 0 → 0 | 75.1 → **48.1** | – |
| stage_003 | average | 85.6 → 76.0 | 64 → 140 | 0 → 0.1 | 66.4 → 36.7 | – |
| stage_003 | skilled | 96.2 → 94.4 | 62 → 141 | 0 → 3.8 | 66.5 → 36.0 | – |
| stage_004 | average | 53.5 → 50.1 | 64 → 137 | 0 → 0 | 66.4 → 37.6 | 100 → 85.6 (<150) |
| stage_004 | skilled | 81.7 → 85.1 | 65 → 141 | 0 → 2.1 | 66.8 → 35.2 | 100 → 71.5 |
| stage_005 | average | 26.4 → 20.8 | 69 → 143 | 0 → 2.6 | 70.7 → 25.7 | – |
| stage_005 | skilled | 58.3 → 66.5 | 75 → 157 | 0 → 16.8 | 70.7 → 27.3 | – |

Target check:
- BAL-5.14 met: stages 3–5 medians are 137–157 s and timeouts at most 16.8%; stages 1–2 have 0% timeouts; stage_001 median is 28 s.
- BAL-5.15 met for both proxies, and win rate falls stage by stage. Stage_002's "decrease" shows as 100% at both stages, so hardness is shown by player HP left instead (89% → 72%).
- BAL-5.10 met on stages 3–5 (25.7–37.6%). Stage_002 for `proxy_skilled` is 48.1% (over 45%); see Needs designer.

## Mirror win rate (1v1 equal rarity, 2,000 per ordered pair)
| | Tavi | Lark | Dunmore | Pell | Thessa | Rook | Solenne | Corvane |
|---|---|---|---|---|---|---|---|---|
| Pass-1 data, average | 57.3 | 45.1 | 47.6 | 58.2 | 47.9 | 44.0 | 42.0 | 58.0 |
| Pass-1 data, skilled | **62.8** | 42.1 | 45.1 | 50.6 | 42.3 | 57.1 | 41.4 | 58.6 |
| HP ×2 only, average | 52.1 | 47.5 | 50.4 | **70.8** | **33.1** | 46.1 | 40.0 | 60.0 |
| HP ×2 only, skilled | 57.1 | 45.4 | 47.5 | 59.9 | **34.0** | 56.1 | 40.6 | 59.4 |
| **Final, average** | 52.2 | 47.5 | 50.4 | 51.0 | 49.7 | 49.3 | 46.4 | 53.6 |
| **Final, skilled** | 57.1 | 45.4 | 47.5 | 48.6 | 44.2 | 57.3 | 42.9 | 57.1 |

## Missions (share of wins in which the mission is met; average / skilled)
- stage_001: no_ko 100 / 100; perfect_slips ≥ 2: 0 / 18.1.
- stage_002: max_chain ≥ 3: 24.2 / 37.0; use_ignition 99.7 / 96.5.
- stage_003: use_tri_burst 99.9 / 100; no_ko 61.5 / 87.4.
- stage_004: time_under_s 150: 85.6 / 71.5 (≥ 25% rule met, value unchanged); perfect_slips ≥ 3: 0.8 / 95.5.
- stage_005: max_chain ≥ 4: 3.1 / 4.3; use_tri_burst 100 / 99.7.
All missions are reachable.

## Pass-2 number changes
| File | ID.field | Old → New | Why |
|---|---|---|---|
| characters | all 8 base_stats.hp | ×2: 8200→16400, 8400→16800, 9000→18000, 9800→19600, 9700→19400, 9500→19000, 10500→21000, 11000→22000 | §5.14 decision |
| economy | power_formula.hp | 0.1 → 0.05 | AC-9.1.1 |
| characters | char_pell_001.base_stats.hp | 19600 → 18400 | Pell 70.8% after HP ×2 |
| characters | char_pell_001.ignition.stat_mult.def | 1.3 → 1.1 | same |
| characters | char_thessa_001.base_stats.atk | 1000 → 1050 | Thessa 33% |
| characters | char_thessa_001.base_stats.def | 470 → 530 | same |
| characters | char_solenne_001.base_stats.hp | 21000 → 22000 | Solenne 38.8% / Corvane 61.2% (★5 pair) |
| enemies | enemy_umbral_rook_001 / enemy_umbral_pell_001 / enemy_thessa_001 .stat_mult | 0.9 → 0.92 | stage_003 average 86.4% (band 60–85) |
| enemies | enemy_thessa_002 / enemy_umbral_solenne_001 .stat_mult | 0.75 → 0.72 | stage_005 average 14.4% (band 15–40) |
| battle | burst.power_per_member | 3.0 → 3.3 | BAL-5.10: stage_005 Tri-Burst 23–25% (band 25–45) |
No timer_s changed: stage_005 at 210 s cut skilled timeouts from 19.6% to 1%, but 180 s already meets the ≤ 25% target.

## Needs designer / owners (pass 2)
1. **Test defect, gameplay-programmer:** `tests/logic/formulas.test.js` AC-5.10.2 is class X (inline inputs) but passes the live `R.burst.powerPerMember` and expects 2,600/2,200/1,800. With the BAL-5.10 lever at 3.3 it fails (1 of 375 tests). Fix: pass the GDD value `3.0` inline (or use FX-GDD rules). This is the only failing test.
2. **BAL-5.10 wording, game-designer:** "same-tier stage enemy" is undefined. Measured on every stage's enemies, no single `power_per_member` value meets 25–45% on stages 2–5 for both proxies with any margin (it would need 3.21–3.23). With 3.3, stages 3–5 are in band and stage_002 (0.8× rookie enemies) is 44–48%. Suggest defining it as stages 3–5.
3. §9.2 table refresh: stage_003 0.92, stage_005 regulars 0.72.
