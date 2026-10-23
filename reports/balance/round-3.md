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
