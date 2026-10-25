# Google Play store listing — Jade Tempest 0.1.0

Owner: store-writer. Round 6 (Launch). Build: first milestone (battle + summon), version 0.1.0.

## Limits (checked 2026-10-24)

Source: Google Play Console Help, "Add preview assets / store listing" (support.google.com/play/android-developer/answer/113469),
confirmed by a web search on 2026-10-24.

| Field | Limit | This listing |
|---|---|---|
| App name | 30 characters | 12 |
| Short description | 80 characters | 78 |
| Full description | 4,000 characters | about 3,150 (see "How the counts were made") |

Some secondary sites say the store name can be 50 characters. Google's own page says 30, so this listing uses 30.
Confirm with the live counter in Play Console when the owner pastes the text in.

Play metadata rules followed: no emoji, no ALL-CAPS words used for emphasis (IGNITE is quoted only as the in-game
button label), no "best", "#1", "top", "free to play" or other ranking/price claims ("free" appears once, meaning a
Riposte costs no Vigor), no calls to action like "download now", no keyword lists, no user reviews or testimonials, no
other games or franchises named.

> **Internal note (not part of the listing; do not paste into Play Console).** The title "Jade Tempest" is cleared
> for the internal-testing track. Before any public track (closed, open or production), compliance-checker must pass
> the trademark/store-name clearance (GDD §1). If clearance fails, only the App name line and the title in the first
> line of the full description change.

---

## App name (12 / 30)

```
Jade Tempest
```

## Short description (78 / 80)

```
Fast 1v1 martial-arts duels. Tap cards, dodge, tag in and transform mid-fight.
```

## Full description (about 3,150 / 4,000)

```
Fast, flashy 1v1 martial-arts battles where your fighters transform mid-fight. Tap a card to throw a punch, swipe to slip past your rival's attack, and watch for the glowing IGNITE button that turns your fighter into a new, stronger form.

Jade Tempest is a real-time card battler for one thumb, played in portrait.

How a fight works
- Bring a team of three. One fights, two wait on the bench. Tag a teammate in when their portrait is ready.
- Tap cards to attack. Fist cards hit up close, Bolt cards hit from range, Signature cards are special moves and the Climax card is the big finisher. Cards cost Vigor, a shared energy bar that refills as you fight.
- Swipe up or down to Slip an attack. Slip just before the hit lands for a Perfect Slip, then strike back with a free, boosted Riposte.
- Keep tapping cards while your rival is stunned to chain combos.
- Ignition: six of the eight fighters have a once-per-battle transformation with its own cards, its own shout and a full-screen moment.
- Tri-Burst: fill the Burst Gauge and unleash a team finishing move, once per battle.

Story: the Highcliff Open
Fight through five story stages of a mountain-top tournament, from the qualifier gate to a showdown with Corvane, the Starless King. Every stage has a short story scene (you can skip it) and three missions that pay out Jade.

Eight original fighters
- Tavi, the Ember Kid
- Lark, the Twin-Kite Courier
- Dunmore, the Walking Wall
- Pell, the Lantern Monk
- Thessa, the Quiet Eclipse
- Rook, the Thousand-Step
- Solenne, the Dawnbreaker Champion
- Corvane, the Starless King
Each fighter has one of five aura types: Blaze, Gale, Stone, Radiant or Void. You start with Tavi, Lark and Dunmore. Summon the others with Jade.

Summon with clear odds
- Jade is the only currency, and you earn it by playing: clearing stages and finishing missions. There are no in-app purchases and no way to spend real money.
- You start with 1,000 Jade, enough for one 10x summon. Your first 10x summon is guaranteed to include at least one 5-star fighter.
- The odds are shown in the game. Tap "Rates & rules" on the Summon screen to see the rate for every rarity and every fighter. Base rates: 5-star 3.00%, 4-star 17.00%, 3-star 80.00%.
- A pity counter is always on screen: a 5-star fighter is guaranteed within 40 summons. Every 10x summon includes at least one 4-star or better.
- Duplicates raise a fighter's Resonance (+5% HP, ATK and DEF per rank, up to rank 4). After that, duplicates turn into Jade.
- Your summon is saved before the reveal plays, so closing the app never loses a result.

Made for your phone
- Plays fully offline. No account, no ads, no in-app purchases.
- Portrait layout with large touch buttons.
- Original music and sound effects, synthesized by the game itself.
- Settings for music and sound volume, mute, vibration and a Reduce motion option for less screen shake and flashing.

This is the first version: one story chapter with five stages, eight fighters and one summon banner. The fighters use a simple, clean shape style in this version.
```

---

## How the counts were made

- App name and short description: counted character by character (spaces and punctuation included).
  Short description, running total word by word (13 words, spaces included): 5, 9, 22, 29, 33, 40, 47, 51, 54, 58,
  68, 78.
- Full description: no shell was available to this agent, so the count is an estimate (paragraph by paragraph,
  including line breaks, rounded up) of about 3,150 characters. NOT VERIFIED exactly. The margin to 4,000 is about
  850, far larger than the likely estimate error. The Play Console counter gives the exact figure on paste.

## Claim check (every claim is in the 0.1.0 build)

| Claim | Evidence |
|---|---|
| 1v1 real-time, team of 3, Tag | GDD §5.8; battle screenshots show 2 bench portraits with cooldown (`reports/screenshots/round-5/360x640-61-battle-umbral-stage_003.png`) |
| Fist / Bolt / Signature / Climax, Vigor | GDD §3, §5.3, §5.4; card faces in `reports/screenshots/round-4/360x640-55-battle-combo-zone.png` |
| Slip, Perfect Slip, Riposte, combos | GDD §5.6, §5.7; "PERFECT SLIP!" / "RIPOSTE!" / "COMBO" callouts in the round-4 combo screenshot |
| Six of eight fighters can Ignite | `data/characters.json`: Tavi, Pell, Thessa, Rook, Solenne, Corvane have `ignition`; Lark and Dunmore do not |
| Full-screen Ignition moment with shout | `reports/screenshots/round-3/qa/abuse-ignition-cinematic.png` ("Overheat Form / REDLINE! OVERHEAT FORM!") |
| Tri-Burst, once per battle | GDD §5.10; `reports/screenshots/round-3/360x640-41-burst-ready.png` |
| 5 story stages, Highcliff Open, Corvane final boss, skippable story, 3 missions each | `data/stages.json` (chapter_01 "The Highcliff Open", stage_001–005, 3 missions each); GDD §4 Skip button |
| 8 fighters, names and epithets, 5 aura types | `data/characters.json`; GDD §3. Rook's epithet is "Thousand-Step Rook"; written as "Rook, the Thousand-Step" to avoid "Rook, the Thousand-Step Rook" |
| Start with Tavi, Lark, Dunmore and 1,000 Jade | GDD §11 defaults, §12 AC-12.1 |
| Rates 3.00 / 17.00 / 80.00, per-fighter rates, "Rates & rules" button | `reports/screenshots/round-5/430x932-31-summon-rates.png`, `...-30-summon-fresh.png` |
| Pity 40, x10 4-star guarantee, first x10 5-star guarantee | GDD §11.3; the rates screenshot rules text |
| Resonance +5% per rank to R4, then Jade | GDD §11.4; rates screenshot |
| Saved before reveal | GDD §11.3 step 5, AC-11.5 |
| No purchases, Jade only | GDD §4 AC-4.2, §11, §12 |
| Offline, no ads, no account | GAME_BRIEF "Offline only"; grep of `src/` for `admob|adsense|analytics|fetch(|XMLHttpRequest|WebSocket|gtag` found 0 matches (2026-10-24). The Android build does not exist yet: release-engineer must not add an ad, analytics or network SDK, or this line must change |
| Synthesized music and SFX | `data/audio.json`: 51 of 51 `source` entries are `"procedural"` (grep, 2026-10-24); GDD §18.1 |
| Settings: volumes, mute, vibration, Reduce motion | GDD §19; `reports/screenshots/round-4/360x640-51-settings.png` |
| Simple shape-style fighters | Round-5 screenshots (code-drawn simple shape-style fighters, STYLE_GUIDE §11) |

## Banned-term check

Checked the app name, short and full description against the GDD §3 banned-term list, the §3 name-only rule and the
GDD §1 title-echo list (read 2026-10-24, round 6; re-checked 2026-10-25, round 7). Result: 0 terms used. The list is
not quoted here so that the repo banned-term grep stays at 0 hits. One note: the hyphenated genre phrase in the short and full
description (as in the GDD §2 pitch and the GAME_BRIEF genre) is an ordinary genre word, not a mechanic, card or rarity
name, so §3 allows it. A case-insensitive whole-word grep will match it there (2 lines, the listing copy only).
Superlatives and hype words were avoided on purpose.
