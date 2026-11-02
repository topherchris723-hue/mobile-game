# Screenshot plan — Jade Tempest 0.1.0 (Google Play, phone)

Owner: store-writer. Round 6. Capture is done by ui-developer or qa-tester (Playwright); this file only says what to
capture and what each caption says.

## Requirements (checked 2026-10-24, Google Play Console Help + web search)
- Phone screenshots: 2 to 8; JPEG or 24-bit PNG, **no alpha**; each side 320 to 3,840 px; the long side may be at most
  **2x** the short side. Recommended 1080 x 1920 (9:16).
- Feature graphic: 1024 x 500, JPEG or 24-bit PNG, required for every listing.
- Games must show the real in-game experience. Captions sit in a band above the screenshot; the game image itself is
  not edited.

## Capture rules (important)
1. **Do not reuse the existing QA screenshots.** They were made with test hooks and show debug states that are not in
   normal play: HP "10000000", "COMBO x99", "999 HITS" (`round-4/*-55-battle-combo-zone.png`,
   `round-5/*-61-battle-umbral-*.png`), or pre-round-3 HP values (`round-3/*-41-burst-ready.png`, Tavi 8200 HP; live
   data is 16400). Using them would show the store something the game never shows.
2. **The 430x932 shots cannot be uploaded:** at 3x they are 1290 x 2796, ratio 2.17, over Google's 2:1 limit.
3. Capture at viewport **360 x 640, deviceScaleFactor 3 → 1080 x 1920** (ratio 1.78, inside the limit), from real
   play on a normal save with live data. A fixed seed is fine; changed HP, Vigor, timers or combo counters are not.
   Freezing a frame mid-animation is fine (it is a real frame).
4. Save as 24-bit PNG without alpha (flatten on the background colour).
5. Write the output under `store/screenshots/0.1.0/` (new folder, not an earlier round's evidence folder,
   L-shared-017). Names: `01-ignition.png` … `07-team.png`.
6. Captions: one message each, at most 30 characters, sentence case, no emoji, no superlatives, no franchise names,
   checked against GDD §3 (done below for this plan).

## Shot list (7 shots, in upload order)

| # | Screen and moment (maps to existing screen) | Reference for layout | Caption | Chars |
|---|---|---|---|---|
| 1 | **Ignition cinematic** in Stage 2 (Tavi or Pell): the full-width banner with the form name and shout over the arena, e.g. "Overheat Form / REDLINE! OVERHEAT FORM!". Most exciting moment, so it goes first. Trigger by real play (HP under 50% or after 60 s, then tap IGNITE). | `reports/screenshots/round-3/qa/abuse-ignition-cinematic.png` (layout only; recapture) | Transform mid-fight | 19 |
| 2 | **Perfect Slip + Riposte** in a real fight: "PERFECT SLIP!" and "RIPOSTE!" callouts visible, real HP numbers, combo counter at a real value (2 to 4). | `reports/screenshots/round-4/360x640-55-battle-combo-zone.png` (layout only; recapture) | Dodge, then strike back | 23 |
| 3 | **Tri-Burst ready**: the TRI-BURST button lit in orange during a 3-fighter stage (stage 3 to 5), both bench portraits visible. If the Tri-Burst cinematic frame reads well, use that frame instead. | `reports/screenshots/round-3/360x640-41-burst-ready.png` (layout only; recapture) | Unleash a team finisher | 23 |
| 4 | **Boss stage**: Stage 5 against Corvane, the Starless King (or Umbral Solenne before him), mid-fight with hit numbers on screen. | `reports/screenshots/round-5/360x640-61-battle-umbral-stage_005.png` (layout only; recapture with real HP) | Five story stages | 17 |
| 5 | **Summon reveal** of the ★5 on a fresh save's first x10 (pull 10), at the frame where the gold rarity frame/orb shows. | `reports/screenshots/round-5/360x640-63-summon-orb-5.png`, `...-34-summon-reveal-card.png` | Collect 8 original fighters | 27 |
| 6 | **Rates & rules** panel on the Summon screen: rarity rates, per-fighter rates, pity and guarantee text. | `reports/screenshots/round-5/360x640-31-summon-rates.png` (this screen has no test values; recapture only at 1080 x 1920) | Odds shown. No purchases. | 25 |
| 7 | **Team screen** with a summoned ★5 in the roster and the 3 team slots. | `reports/screenshots/round-5/360x640-37-team-after-summon.png` (recapture at 1080 x 1920) | Build your team of three | 24 |

Optional 8th (only if the Producer wants it): Settings screen, caption "Reduce motion and mute" (22). Not needed
for the message; left out by default.

Why this order: shots 1 to 4 sell the hook (fast, flashy fights with transformations), 5 and 7 sell collecting,
6 sells fairness. Every shot shows a feature that exists in 0.1.0 (see `store/listing.md` claim check).

## Feature graphic (1024 x 500)
- Content: the "Jade Tempest" logo text (the in-game title font, `src/ui/theme.js`; no new font file, STYLE_GUIDE §10)
  on the left, a real 0.1.0 Ignition frame (shot 1) cropped on the right, on the Jade green / night-blue UI palette
  (STYLE_GUIDE §2.1).
- No caption text beyond the title, no rating badges, no "new"/"free"/"#1", no price.
- Blocked by the same title condition as the listing: make it only after compliance-checker passes the "Jade Tempest"
  trademark/store-name check (GDD §1).

## Caption banned-term check (GDD §3, read 2026-10-24)
All 7 captions (and the optional 8th) checked against the GDD §3 banned-term list, the §3 name-only rule and the
GDD §1 title-echo list (read 2026-10-24, re-checked 2026-10-25): 0 matches. The list is not quoted here so the repo
banned-term grep stays at 0 hits. No superlatives.
