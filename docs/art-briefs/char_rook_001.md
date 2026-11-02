# Art brief: Rook, "Thousand-Step Rook" (`char_rook_001`)

Aura **Gale** (swirl, key #3DDC97) · Role **striker** · Rarity **★4** · Ignition **Checkmate Gale**
Read first: `docs/STYLE_GUIDE.md` (§1, §4, §4.4, §4.5). Umbral variant: `Umbral Rook` (style guide §9).
He is the most frequent enemy (stages 1–3) and appears in mirror matches: his silhouette must read clearly from
both sides.

**Round 7 redesign (release-review R-7, hard rule L-ad-001).** The round-4 look (green body + black-and-white
checkered hoodie/band + dark spiky hair) put two signature elements of one famous anime protagonist together
(green with a black check pattern, dark hair). Removed: **every check/chequer pattern, the hoodie, the dark hair**.
Kept: Gale aura colour and swirl shape, striker role, lanky silhouette, the counting hand, spring-steel soles, the
chess-hustler personality. His chess theme now lives in a **castle-tower (battlement) hem**, a **brass tally
counter** and his gestures, never in a check pattern.

## Who
Cocky street champion who counts every hit out loud and calls fights like chess games.
Expression default: smug half-lidded grin. Attacks: counting, mouth open ("one! two!").

## Silhouette keys
1. **Lanky**: 108 px tall, only 36 px shoulders, long legs (legs are 45% of height).
2. **One hand always raised** beside the head with fingers up, counting, a brass tally counter on that wrist (the
   other hand in the vest pocket in idle).
3. **Long sleeveless vest with a battlement hem**: the hem below the hips is cut into 3 square tower notches
   (like a castle wall top), flaring slightly. **High stand-up collar.**
4. **Hair: one swept-back crest** (short sides, the top combed straight back by the wind, pointing *backward*,
   never up and never forward).

## Colours
| Part | Hex |
|---|---|
| Long vest | slate #3C4A63, shadow #2A3447; battlement hem trim #F2EEE4 (2 px) |
| Collar lining | #F2EEE4 |
| Undershirt (short-sleeved, plain) | #F2EEE4, shadow #CFC9BC |
| Hair (dyed mulberry) | #5E2A48, shadow #3F1B31, shine #8A4A6E |
| Tally counter (wrist) | brass #C9A23F, shadow #8E7128 |
| Trousers (slim, plain) | #2A3447 |
| Spring-steel sneakers | upper #F2EEE4, soles #9AA3AD with a visible coil #6E7680 |
| Skin | #D7A47E, shadow #B0805C |
| Rim light | Gale light #8FF0C4 |

No pattern anywhere on the costume: flat colour fields only.

## Outfit
Plain off-white short-sleeved undershirt, slate long sleeveless vest to mid-thigh with a stand-up collar and a
battlement-cut hem, slim slate trousers, spring-steel sneakers, a brass tally counter strapped to the counting
wrist (he clicks it on every hit).

## Pose sheet
| Pose | Description |
|---|---|
| idle | Hips cocked, one hand in the vest pocket, the other raised counting on fingers (1-2-3 cycles over the loop, the counter clicks), heels bouncing on the springs. |
| dash | Springs compress, he skims low, vest hem and hair crest streaming back. |
| windup | Steps back with one leg raised for a kick, fingers showing the count. Hold-able. |
| hit | Springs buckle, he flails, fingers splay, the counter flies up on its strap. |
| KO | Spins and drops flat on his back, one finger still raised. |
| Ignition form | **The battlement notches break off the vest hem and orbit him as 8 floating tower blocks** (off-white #F2EEE4 with a Gale-key #3DDC97 edge) inside a Gale spiral; the vest turns Gale light #8FF0C4 with slate trims; spring soles glow Gale key; the tally counter digits glow. Back-shape: a rotating ring of tower blocks + swirl at ≤ 40% alpha. Hair colour unchanged. |
| ignition_transform | He clicks the counter one last time; the hem notches snap off one by one and spin up. |
| victory | Taps his temple, then shows the counter to the camera: "Checkmate." |

## Rarity frame
★4: double border violet #B06BFF, notched corners (style guide §6).

## Sizes and formats
Style guide §4.4. Keys: `spr_rook_base`, `spr_rook_ignition`, `por_rook_base`, `por_rook_ignition`,
`art_rook_summon`, `vfx_rook_ignition`.

## Placeholder recipe (code, now) — exact shapes for the ui-developer
Origin = feet centre, y up is negative, `f` = facing (+1 right, −1 left), all sizes × scale `s`. Draw in this order:
1. Legs: two rounded rects 10×40, radius 4, fill #2A3447, at x −13 and +3, y −40.
2. Torso: rounded rect 36×52 at (−18, −84), radius 10, fill **Gale key #3DDC97**, stroke 2 px #FFFFFF 85%
   (unchanged accessibility read: aura colour on the body).
3. Vest panels: two rects 10 px wide, fill #3C4A63, on the left and right edges of the torso from y −84 to −28
   (they leave a 16 px green centre strip, so the aura colour stays dominant from the front).
4. Battlement hem: a band from y −32 to −28, x −22 to +22, fill #3C4A63; below it **4 teeth**, each 8 px wide and
   5 px tall (y −28 to −23), fill #3C4A63, at x −22, −10, +2, +14 (so 3 gaps of 4 px between them). Draw a 1 px
   #F2EEE4 line along the top edge of the band (y −32).
5. Collar: rect 20×6 at (−10, −88), fill #3C4A63, inner 1 px line #F2EEE4.
6. Head: circle r 13 at (0, −94), fill #F1D3B8 (current placeholder skin), stroke 2 px #FFFFFF 85%.
7. Hair: a cap = filled polygon #5E2A48 with points (8 f, −104), (8 f, −108), (−12 f, −108), (−12 f, −104), then
   a crest = filled triangle #5E2A48 with points (4 f, −108), (−12 f, −104), (−24 f, −106), so the crest points
   **backward** (away from the opponent). Nothing above y −108 (the 112 px ceiling stays clear).
8. Eye: circle r 2.5 #14172B at (6 f, −94).
9. Front fist: circle r 8 at (28 f, −60), Gale key fill, white stroke (as now).
10. Raised back hand: circle r 6 at (−24 f, −92) fill #F1D3B8; two finger bars 2×8 #F1D3B8 above it; tally
    counter: 6×6 square #C9A23F with 1 px #8E7128 stroke at (−24 f, −84).
11. Chest aura icon (swirl), name row and floor shadow: unchanged.
Ignition: 8 squares 8×8 #F2EEE4 with a 1 px #3DDC97 stroke orbiting at radius 44 (period 1.2 s), behind the body;
vest panels and hem recolour to #8FF0C4.
Delete from the round-4 recipe: the checker band and the hood bump.

## What makes it original
A chess-hustler street brawler whose chess theme is shown through a castle-tower hem, a brass tally counter and
the counting gesture. Flat colours, no pattern, mulberry hair: no known protagonist uses this combination.

## Must not resemble / avoid
- **No check or chequer pattern of any colour anywhere** (costume, Ignition, VFX, portraits), and no green-and-black
  pairing on the costume.
- **No dark/black spiky or forward-swept hair, no forehead scar, no hanafuda-style or dangling earrings.**
- No haori or kimono jacket; no sword or scabbard.
- No white spiky-haired kid with a skateboard and claw hands; no assassin-family look.
- No over-arched "dramatic menacing pose" with sound-effect letters; no chess piece worn on the head.
- No blue gi, no ninja headband, no long scarf. No 3 parallel sports stripes (brand mark).

## Look-echo check (L-ad-001)
Signature combination: Gale-green body read (aura) + slate vest with battlement hem + mulberry swept-back crest +
brass wrist counter + spring soles. Nearest known designs: a famous green-and-black-check swordsman (now 0 shared
elements besides the aura green: pattern and dark hair removed); a white-haired assassin kid (0); a slicked-hair
delinquent spirit detective (0: different colour and direction, no uniform). Result: **OK**.

## Mood references (words)
1. Park-bench speed chess with a clock being slapped.
2. Street basketball at night under a single floodlight.
3. The top of an old stone castle wall in a strong wind, flags snapping.
