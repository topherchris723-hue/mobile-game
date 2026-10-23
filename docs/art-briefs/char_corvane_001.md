# Art brief: Corvane, "The Starless King" (`char_corvane_001`)

Aura **Void** (crescent, key #9B6BFF) · Role **trickster** · Rarity **★5** · Ignition **Starless Throne**
Final boss (renders at boss scale 1.12 in code). Creator of the Umbral echoes (style guide §9 uses his crack motif).
Read first: `docs/STYLE_GUIDE.md` (§1, §4, §4.4, §4.5).

## Who
Polite, theatrical, hungry. A tyrant who steals fighters' auras and wears them as a crown of shards.
Expression default: thin polite smile, eyes half-closed. Attacks: a delighted open smile.

## Silhouette keys
1. **Robes made of drifting black ribbons** that hang from the shoulders to the floor and sway independently:
   a gaunt narrow body (34 px) inside a wide ragged hem (64 px).
2. **Crown of floating obsidian shards**: 5–7 sharp shards hovering in a ring just above the head, not touching.
3. **Cracked-glass hands** lit violet from inside; long fingers.

## Colours
| Part | Hex |
|---|---|
| Ribbons | #0E0B16, edges #9B6BFF (thin), inner shadow #05040A |
| Obsidian shards | #2B2338, facet glints #C7A6FF |
| Stolen-aura glints inside the shards | one shard each in Blaze #FF6A3D, Gale #3DDC97, Stone #C9A36B, Radiant #FFD84A (small, story: stolen auras) |
| Hands | glass #3A2F52 with crack light #C7A6FF |
| Face | pale grey-violet #B9AFC8, shadow #8C819D |
| Eyes | #9B6BFF iris, #F1E8FF highlight |
| Hair | none visible (ribbons wrap the head like a hood) |
| Rim light | Void light #C7A6FF |

## Outfit
No armour, no cape: only layered ribbons, wrapped like a hooded robe. A thin violet collar of ribbon at the throat.

## Pose sheet
| Pose | Description |
|---|---|
| idle | Upright, hands folded at chest height, fingers steepled, ribbons drifting; crown shards slowly orbit. |
| dash | Glides without stepping; ribbons stream back, shards trail. |
| windup | Extends one glass hand, palm out; the cracks blaze violet. Hold-able. |
| hit | Ribbons scatter, a shard drops then floats back. |
| KO | Shards fall and shatter; ribbons collapse like a puppet with cut strings. |
| Ignition form | **The shard crown grows into a throne-like halo**: large shards fan out behind him in a high-backed throne silhouette (back-shape, ≤ 50% alpha in the name row band); stolen-aura glints flare; cracks in the hands spread up the arms. |
| ignition_transform | He spreads his arms; shards fly out from the crown and lock into the throne shape behind him. |
| victory | A small bow, one hand on the chest: "Another trophy." |

## Rarity frame
★5: 3 px gold #FFC23D border, inner glow, four corner gems, light sweep every 2 s (style guide §6).

## Sizes and formats
Style guide §4.4. Body plus crown ≤ 112 px at scale 1 (code scales him to 1.12 as boss; the name row scales with
him). The Ignition throne may exceed this behind the label. Keys: `spr_corvane_base`, `spr_corvane_ignition`,
`por_corvane_base`, `por_corvane_ignition`, `art_corvane_summon`, `vfx_corvane_ignition`.

## Placeholder recipe (code, now)
Torso 34×50 aura key; 5 ribbons = thin tapering strips #0E0B16 with 1 px #9B6BFF edge from the shoulders to the
floor, swaying ±3 px out of phase in idle; crown = 5 small triangles #2B2338 with a #C7A6FF edge floating between
−104 and −112; fists = circles #3A2F52 with a #C7A6FF crack line. Ignition: 7 large triangles fanned behind (≤ 40%
alpha).

## What makes it original
A collector-king: his crown is literally made of other fighters' stolen auras (4 coloured glints), which links him
to the aura system and the Umbral echoes. Ribbons and glass, not armour and horns.

## Must not resemble / avoid
- No pale alien emperor with horns, a tail and a hover-pod; no purple-and-white bio-armour.
- No skeletal lich, no skull face, no single burning eye, no spiked iron crown on a helmet.
- No stone-faced cosmic tyrant with a chin of grooves; no glove with gems.
- No bat wings, no feathered raven cloak (his name is not a bird design).

## Mood references (words)
1. A night sky with no stars, only a black glass moon.
2. A grand empty ballroom, ribbons hanging from the ceiling, one candle.
3. A cracked stained-glass window lit from behind in violet.
