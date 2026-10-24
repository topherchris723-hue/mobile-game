# Economy — Jade Tempest (milestone)

Owner: economy-designer. Written in round 4 (Growth polish). Sources of truth: `data/economy.json`,
`data/banners.json`, `data/stages.json` (rewards and missions), GDD §9, §11, §12, and the round-3 balance report
(`reports/balance/round-3.md`, re-check after BUG-3-02) for win and mission rates.
If this file disagrees with the data, the data wins and this file is out of date.

**Real money: none.** The owner has not turned it on (`docs/GAME_BRIEF.md`). Jade cannot be bought, and
`economy.json` says `"real_money": false`.

---

## 1. Currencies

| Id | Name | Max | How you get it | How you spend it | Real money |
|---|---|---|---|---|---|
| `cur_jade` | Jade | 999,999 (any excess is lost; the summon results show "Jade is at the maximum") | stage first clears, repeat clears, missions, duplicate overflow, 1,000 at start | Summons | No |

There is one currency, so there are no conversions to hide costs. Every price on screen is in Jade.

## 2. Sources

### 2.1 Start
1,000 Jade and the three ★3 starters (Tavi, Lark, Dunmore), which are also the starting team.

### 2.2 Stages (only a **Win** pays; a loss, draw or retreat gives nothing and costs nothing)
| Stage | First clear (once) | Repeat clear (every later win) | Missions (50 Jade each, once each) |
|---|---|---|---|
| stage_001 | 300 | 10 | win, no_ko, perfect_slips ≥ 2 |
| stage_002 | 300 | 20 | win, max_chain ≥ 3, use_ignition |
| stage_003 | 400 | 45 | win, use_tri_burst, no_ko |
| stage_004 | 500 | 50 | win, time_under 150 s, perfect_slips ≥ 3 |
| stage_005 | 600 + ★4 Rook | 75 | win, max_chain ≥ 4, use_tri_burst |
| **Total once** | **2,100 + Rook** | — | **15 × 50 = 750** |

Rook from stage_005 follows the duplicate rules (§2.3). He does not touch pity or `total_pulls`.

### 2.3 Duplicates (`economy.duplicates`)
- First copy: NEW, R0.
- Copies 2–5: Resonance +1, up to R4. Each rank gives +5% HP/ATK/DEF, so R4 is +20%.
- Copy 6 onward: converted to Jade. ★3 → 10, ★4 → 40, ★5 → 200.

What a copy is worth (one pull costs 100 Jade):
| Rarity | Overflow Jade | As a share of one pull | Copies before overflow starts |
|---|---|---|---|
| ★3 | 10 | 10% | 5 (the starters are already owned, so 4 more each) |
| ★4 | 40 | 40% | 5 |
| ★5 | 200 | 200% (2 pulls) | 5 |

Once every fighter is at R4, the expected Jade back per pull is 0.80×10 + 0.17×40 + 0.03×200 = **20.8 Jade (20.8% of the
cost)**. Early on it is lower, because most of the ★3 copies a player gets are the 12 that raise the starters to R4.
Over the first-time milestone this adds about 180 Jade (simulated mean 178–184).

## 3. Sinks

| Sink | Cost | Notes |
|---|---|---|
| Summon ×1 | 100 Jade | |
| Summon ×10 | 1,000 Jade | Same price per pull as ×1. Pull 10 is at least ★4 (★5 on the first ×10 of the banner). |

There are no other sinks in the milestone (no upgrades, stamina or shop).

## 4. Summon rates, guarantees and pity (`banner_starter_001`)

| Rarity | Rate (bp) | Shown | Fighters (each, as shown in-game) |
|---|---|---|---|
| ★5 | 300 | 3.00% | Solenne 1.50% (featured), Corvane 1.50% (featured) |
| ★4 | 1,700 | 17.00% | Pell, Thessa, Rook 5.67% each (exact 5.666…) |
| ★3 | 8,000 | 80.00% | Tavi, Lark, Dunmore 26.67% each (exact 26.666…) |
| **Sum** | **10,000** | **100.00%** | |

- **Hard pity 40:** the 40th pull without a ★5 is a ★5. The counter is shared by ×1 and ×10, carries over between
  sessions, and resets on any ★5. The chance of reaching pity is 0.97^39 = 30.5%. With pity counted, the average is
  23.5 pulls per ★5, an effective 4.26% (before the ×10 bonus). The screen shows the base rates, and the rules text says
  that pity and the guarantees can only raise them.
- **×10 guarantee:** if pulls 1–9 have no ★4 or better, pull 10 draws from ★4/★5 only (★5 15%, ★4 85%).
- **First ×10 on the banner:** if pulls 1–9 have no ★5, pull 10 is a ★5.
- Rates are checked by the AC-11.4 tests (displayed text equals `rates_bp` and the sums hold). Round 4 also ran a draw
  check with the real `drawPull` (2,000,000 draws, live data): every fighter landed within 5σ of its shown rate. Three
  mismatches planted on purpose (rarity rates, featured share, displayed sum) were all reported as FAIL. Script:
  economy-designer scratchpad `rate-check.mjs`. It is suggested as a permanent P-class test.

## 5. Pacing

### 5.1 Inputs (balance report round 3, re-check engine; skilled mission shares from pass 2)
`proxy_average` and `proxy_skilled` are AI players standing in for human skill. A real player's Perfect Slip rate is
unknown: the average proxy never slips, so its 0% slip-mission rates are a lower bound.

| Stage | Win % avg / skilled | Attempts per first clear avg / skilled | Mission shares per win, avg / skilled |
|---|---|---|---|
| 001 | 100 / 100 | 1.0 / 1.0 | no_ko 100/100, slips≥2 0/18.1 |
| 002 | 100 / 100 | 1.0 / 1.0 | chain≥3 24.2/37.0, ignition 99.7/96.5 |
| 003 | 74.2 / 95.7 | 1.3 / 1.0 | tri_burst 99.9/100, no_ko 61.5/87.4 |
| 004 | 48.8 / 88.4 | 2.0 / 1.1 | time<150 84.2/71.5, slips≥3 0.8/95.5 |
| 005 | 17.6 / 68.8 | 5.7 / 1.5 | chain≥4 3.1/4.3, tri_burst 100/99.7 |

### 5.2 Milestone budget (each stage won once, then stop) — 10,000 simulated players per row
| Player | Jade from battles (median) | Missions done (mean of 15) | Total Jade incl. start + overflow | Pulls (median) | ★5 (mean) | ★4 (mean) | ≥1 ★5 | ≥2 ★5 pulls | No ★5 beyond the guaranteed one |
|---|---|---|---|---|---|---|---|---|---|
| Average | 2,650 | 10.7 | ≈ 3,830 | 38 | 1.91 | 6.5 (+ Rook) | 100% | 60.5% | **39.5%** |
| Skilled | 2,700 | 12.1 | ≈ 3,880 | 38 | 1.94 | 6.6 (+ Rook) | 100% | 61.5% | **38.5%** |
| Ceiling (all 15 missions) | 2,850 | 15 | 3,850 + overflow | 38–39 | — | — | 100% | — | — |

The GDD §12 estimate (0.97^28 ≈ 43% with no further ★5) is a little pessimistic. The ×10 guarantees (15% ★5 on a
rescued pull 10) and the overflow Jade bring it down to about 39%. No player reaches hard pity in this budget: the
counter resets on the first ×10's ★5, and at most 37 pulls follow. The two skill levels end within 50 Jade of each
other, because a skilled player's extra missions are worth at most 4 × 50 Jade.

### 5.3 30-day F2P simulation (10,000 players per row; rerun round 5 with repeat-clear Jade 10/20/45/50/75)
Play model (assumptions):
- Each player has a fixed daily playtime, drawn uniformly from 5–30 min, and skips a day with 20% chance.
- A battle takes the balance report's median length plus 20 s of menus.
- Players fight the first uncleared stage until they clear it.
- The team stays the starters, so summoned fighters do not raise win rates. This is a conservative "wall" check.
- Players spend on ×10 whenever Jade ≥ 1,000, and spend the rest on ×1 at the end.
- Missions are rolled independently per win using §5.1. The real `summon()` and `applyBattleResult()` from `src/` are
  used.

Policies:
- **Story:** after the five clears, the player replays each stage that still has an open mission, up to 3 extra wins
  per stage, then stops.
- **Farmer:** after the clears, the player keeps playing the stage with the best expected Jade per minute.

| Policy / player | Pulls p10 / median / p90 | ★5 mean | ≥1 ★5 | ≥2 ★5 | Own both ★5 | Hit hard pity | stage_005 not cleared by day 30 |
|---|---|---|---|---|---|---|---|
| Story / average | 42 / 43 / 44 | 2.10 | 100% | 69.4% | 43.0% | 2.6% | 0% (median clear day 2) |
| Story / skilled | 41 / 42 / 43 | 2.08 | 100% | 68.5% | 42.3% | 2.1% | 0% (day 1) |
| Farmer / average | 66 / 104 / 146 | 4.91 | 100% | 100% | 87.5% | 69.7% | 0% (day 2) |
| Farmer / skilled | 78 / 126 / 179 | 5.88 | 100% | 100% | 91.9% | 78.7% | 0% (day 1) |

**Walls:** none. The hardest step is stage_005 for an average player: about 5.7 attempts of about 2.7 min each, all
free. Every simulated player cleared it, with a median on day 2.

### 5.4 Repeat-clear efficiency (Jade per minute of play, including the 20 s of menus)
Formula: repeat-clear Jade × win rate ÷ ((median battle s + 20 s) / 60). Missions excluded (they pay once).
Data: `stages.json` repeat-clear Jade 10/20/45/50/75 (round 4). Win rates and lengths: §5.1.

| Stage | Repeat Jade | Average | Skilled |
|---|---|---|---|
| stage_001 | 10 | 12.5 | 12.2 |
| stage_002 | 20 | **14.5** | 14.5 |
| stage_003 | 45 | 12.4 | 16.3 |
| stage_004 | 50 | 9.3 | 16.6 |
| stage_005 | 75 | 4.9 | **17.5** |

Requirement: the Skilled column must be non-decreasing from stage_001 to stage_005 (harder stages pay at least as
much per minute). Status: **PASS** (12.2 ≤ 14.5 ≤ 16.3 ≤ 16.6 ≤ 17.5). Re-check this table whenever `repeat_clear`,
win rates or battle lengths change.
The average column is not monotonic: an average player's best farm is stage_002 (14.5), and stage_005 pays 4.9
because they win only 17.6% of the time. That is acceptable (no stage is a trap; all are free to retry), and it
improves as the team levels, which the conservative sim ignores.
Effect (round-4 change vs the old 30/30/40/50/60): the tutorial is no longer the best farm (was 37.5 Jade/min, 2–10×
the others). Farmer median pulls in 30 days fell from 212/217 to 104/126 (average/skilled), and skilled farmers now
earn more than average ones. Milestone budget (§5.2) and Story rows are unchanged within noise, because they depend
on first clears and missions, not repeat clears.

## 6. Fairness checklist (round 4)
| Check | Result |
|---|---|
| Rates shown in-game, per rarity and per fighter, summing to 100% | PASS (AC-11.4, plus the round-4 draw check) |
| Pity stated and visible ("★5 guaranteed within N summons.") | PASS (hard pity 40) |
| No real money | PASS (`real_money: false`, no store or IAP code paths) |
| No fake urgency | PASS (the banner has no `start_at`/`end_at`, so it shows no countdown) |
| No hidden odds | PASS |
| No confusing currency conversions | PASS (one currency) |
| No pressure or loss-chasing messages | PASS (see §7) |
| Anti-reroll and no double spend | PASS (GDD §11.3 atomic save, AC-11.5/11.10/11.12) |
| Losses cost nothing | PASS |
| Duplicates never wasted | PASS (Resonance, then Jade; only the Jade above the 999,999 cap is lost, and the player is told) |
| No "complete gacha" (a prize for collecting a set) | PASS (none exists) |

## 7. Summon screen text review (`src/ui/strings.json`, owned by ui-developer)
I read every `summon_*` and `result_*` string. None is misleading: the pity, ×10, first-×10 and duplicate rules
match GDD §11.3–11.4 and the code.
Minor notes (no change needed):
- `summon_not_enough` says "clear stages to earn more". This stays true after the first clears, because repeat clears
  pay Jade.
- `banners.json` `description` uses "First x10 guarantees a 5-star." (an ASCII x and "5-star"), while the UI uses ×10 and
  ★5. The description is not shown anywhere in-game today. If a later screen shows it, align the notation then.

## 8. Store and region rules (checked 2026-10-23, web search)
- **Google Play** (Monetization policy, since 2019): apps offering randomized virtual items bought with real money must
  disclose the odds before purchase. We already show them, even though nothing can be bought.
- **South Korea** (Game Industry Promotion Act, mandatory since March 2024; stronger remedies from 2025): paid
  probability items must disclose their odds, and misstated odds are treated as a deceptive "dark pattern". Our
  displayed rates are tested against the real draw.
- **Japan** (from general knowledge, NOT VERIFIED by this search): "complete gacha" is banned. We have none.
- If the owner ever enables real money, re-check all of the above, and also Belgium and the Netherlands (loot box
  restrictions) and age ratings.
