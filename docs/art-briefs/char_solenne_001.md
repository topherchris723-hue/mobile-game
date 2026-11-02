# Art brief: Solenne, "Dawnbreaker Champion" (`char_solenne_001`)

Aura **Blaze** (flame, key #FF6A3D) · Role **blaster** · Rarity **★5** · Ignition **Noon Sovereign**
Read first: `docs/STYLE_GUIDE.md` (§1, §4, §4.4, §4.5). Umbral variant: `Umbral Solenne` (style guide §9; the
story describes her as "glowing with stolen sunlight": in Umbral form only the sun disc keeps a dim Blaze glow).

## Who
Nine-time champion of the Highcliff Open. Proud, warm, impossible to impress; tests every new fighter herself.
Expression default: confident closed-mouth smile, chin up. Attacks: fierce, teeth showing.

## Silhouette keys
1. **Broad shoulders** (50 px) and a tall, athletic V-shape, 108 px.
2. **White tournament sash** diagonal from the shoulder to the hip, with **nine notches** cut into its edge.
3. **Sun-ray bracers**: forearm guards with 3 short ray points each, flaring toward the elbow.

## Colours
| Part | Hex |
|---|---|
| Hair (ash-blonde, short) | #D9CBA3, shadow #A89A74 |
| Bracers | gold #E8A21F with red inlay #C8282E, highlight #FFD27A |
| Sash | #FFFFFF, shadow #D9D6CE; notches show the top colour underneath |
| Top (sleeveless fighting top) | #C8282E, shadow #8E1A22 |
| Trousers (wide) | #F4F1EA, shadow #CFC9BC; belt #E8A21F |
| Wraps (feet) | #F4F1EA |
| Burn scar | right forearm, #C48A66 lighter patch |
| Skin | #C9895F, shadow #9E6744 |
| Rim light | Blaze light #FFB13D |

## Outfit
Sleeveless red fighting top, wide light trousers with a gold belt, foot wraps, sun-ray bracers, the nine-notch sash.
Hair: **short, swept back flat to one side** (an undercut on one side). It never points upward.

## Pose sheet
| Pose | Description |
|---|---|
| idle | Upright champion stance, one fist on the hip, the other loose and ready, sash fluttering. |
| dash | Long powerful stride, back straight; bracers trail short heat streaks. |
| windup | Crosses both bracers in front of the face; the rays light up one by one. Hold-able. |
| hit | Steps back one pace, takes it, scowls. |
| KO | Drops to one knee first ("Well fought..."), then falls sideways. |
| Ignition form | **A blazing sun disc rises behind her shoulders** (disc ~90 px diameter, core #FFF4D6, ring #FFD27A, rays in Blaze key #FF6A3D); bracer rays extend; the sash edges glow. **Hair colour and shape do not change.** No flames around the body outline. |
| ignition_transform | She raises one arm; the sun disc climbs from behind her like a sunrise. |
| victory | Offers a hand down to the (unseen) opponent: "Rise again." |

## Rarity frame
★5: 3 px gold #FFC23D border, inner glow, four corner gems, light sweep every 2 s (style guide §6).

## Sizes and formats
Style guide §4.4. Sun disc extends above the name row: behind the label, ≤ 50% alpha in the band −130…−114. Keys:
`spr_solenne_base`, `spr_solenne_ignition`, `por_solenne_base`, `por_solenne_ignition`, `art_solenne_summon`,
`vfx_solenne_ignition`.

## Placeholder recipe (code, now)
Torso 50×50 aura key; a 6 px white diagonal band (shoulder to hip) with 9 dark ticks; bracers = gold #E8A21F
rectangles on the fist with 3 small triangles; hair = flat wedge #D9CBA3 swept back. Height 108. Ignition: circle
r 45 behind the shoulders (#FFD27A at 40%) with 8 triangle rays in Blaze key.

## What makes it original
A tournament champion with a sun motif expressed through sash, bracers and a rising sun disc. Her identity is
"title holder", not "chosen warrior".

## Must not resemble / avoid
- **No spiky upright golden hair, no hair turning gold, no golden flame outline around the body.**
- No chin-length blonde bob with a striped shirt and denim (avoid the famous blonde android fighter).
- No blue-and-silver armoured knight-queen with a sword.
- No sun-god headdress or Egyptian motifs.

## Mood references (words)
1. Sunrise breaking over mountain peaks, long shadows suddenly gold.
2. A champion belt held above a crowd in a packed arena.
3. Hammered bronze trophies in a glass case.
