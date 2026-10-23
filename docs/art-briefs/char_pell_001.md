# Art brief: Pell, "Lantern Monk" (`char_pell_001`)

Aura **Radiant** (star, key #FFD84A) · Role **guardian** · Rarity **★4** · Ignition **Thousand Lantern Form**
Read first: `docs/STYLE_GUIDE.md` (§1, §4, §4.4, §4.5). Umbral variant: `Umbral Pell` (style guide §9).

## Who
Serene outside, wildly competitive inside. Heals anyone, then bets he wins the rematch.
Expression default: calm half-smile, eyes half-closed. Attacks: eyes snap open, a smug grin.

## Silhouette keys
1. **Paper-lantern staff** taller than he is (staff top at 112 px), a round lantern hanging from a crook at the top.
2. **Layered robe to the ankles** with wide **bell sleeves** (small bells on the cuffs): a bell-shaped body.
3. **Long silver hair in a low ponytail** that falls behind the back (he is not bald).

## Colours
| Part | Hex |
|---|---|
| Outer robe | #FAF7EE, shadow #D9D3C2 |
| Inner robe and trims | #E2B341, shadow #B08623 |
| Bells | #F2C94C, highlight #FFF0A8 |
| Hair (silver) | #D8DCE6, shadow #A9AEC0 |
| Staff | #8A6A3A, shadow #5E4626 |
| Lantern paper | #FFE7A3, light #FFF6D6, ribs #C99A1E |
| Sandals | #8A6A3A |
| Skin | #EBC2A0, shadow #C79B78 |
| Rim light | Radiant light #FFF0A8 |

## Outfit
Layered white-and-gold robes with a wide sash, bell-trimmed sleeves, simple sandals, paper-lantern staff. No
prayer beads, no forehead marks, no tattoos.

## Pose sheet
| Pose | Description |
|---|---|
| idle | Staff planted, one hand behind the back, lantern swaying gently, bells tinkling. |
| dash | Glides with the robe hem fluttering; staff held level. |
| windup | Swings the lantern back like a censer; light gathers inside it. Hold-able. |
| hit | Bells jangle, lantern swings wildly, half-smile breaks. |
| KO | Kneels, then sits back, lantern lands upright beside him, flame dimming. |
| Ignition form | **A halo of 7 small floating paper lanterns** circling behind his shoulders; robes glow gold (outer robe shifts to #FFF0A8 with #FFD84A trims); staff lantern turns pure #FFFFFF. Back-shape: soft radiant ring. |
| ignition_transform | He lifts the staff; the lantern splits into many small lanterns that rise into a ring. |
| victory | Holds up one finger ("one more round?"), grins. |

## Rarity frame
★4: double border violet #B06BFF (2 px + 1 px inset), notched corners (style guide §6).

## Sizes and formats
Style guide §4.4. The staff may reach 112 px but no higher; the lantern halo in Ignition sits behind the name row at
≤ 50% alpha there. Keys: `spr_pell_base`, `spr_pell_ignition`, `por_pell_base`, `por_pell_ignition`,
`art_pell_summon`, `vfx_pell_ignition`.

## Placeholder recipe (code, now)
Torso 40×46 aura key; robe = trapezoid 40→56 from waist to floor (#FAF7EE, gold #E2B341 hem line), legs hidden;
staff = 4 px vertical line #8A6A3A from floor to −112 in front of the body; lantern = rounded rect 12×16 #FFE7A3 at
−100; ponytail = 6 px strip #D8DCE6 behind the head. Ignition: 7 circles r 5 #FFE7A3 orbiting at radius 40 behind.

## What makes it original
A light-themed healer whose tool is a paper lantern: festival light, not holy light. His humour (betting on
rematches) undercuts the serene monk cliché.

## Must not resemble / avoid
- No bald head with dots on the forehead; no orange-and-yellow monk robe with a glider staff and arrow tattoos.
- No monkey-king staff (red-gold extending pole), no cloud riding.
- No halo ring over the head (angel look); lanterns orbit behind the shoulders instead.

## Mood references (words)
1. A river lantern festival: hundreds of paper lights drifting on dark water.
2. A quiet mountain temple courtyard at dusk, wind chimes.
3. A street-corner card shark who always smiles before he wins.
