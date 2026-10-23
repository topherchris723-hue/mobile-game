# Art brief: Tavi, "The Ember Kid" (`char_tavi_001`)

Aura **Blaze** (flame, key #FF6A3D) · Role **striker** · Rarity **★3** · Ignition **Overheat Form**
Read first: `docs/STYLE_GUIDE.md` (outline, proportions §4, sizes §4.4, frame counts §4.5, originality §1).

## Who
Loud, fearless, always grinning teen mechanic from a mountain town. Fixes engines by day, starts fights by night.
Expression default: wide grin, one brow up. Attacks: mouth open, yelling.

## Silhouette keys (must read as a black shape)
1. **One long copper braid** from the back of the head to the waist, always trailing *behind* the motion.
2. **Jacket tied at the waist**: the sleeves knot in front and the body of the jacket flares behind the hips like a
   short cape. Gives a wide-hip triangle under a narrow torso.
3. Small and wiry: 96 px tall, 40 px shoulders, the shortest fighter. Big taped fists.

## Colours
| Part | Hex |
|---|---|
| Work jacket (crimson) | #C8282E, shadow #8E1A22 |
| Braid (copper) | #C7662B, shadow #8A4419 |
| Tank top | #F4F1EA |
| Knuckle tape | #E9DCC3 |
| Trousers (dark work canvas) | #2E2A3A |
| High-tops, mismatched | left #E0A030 (ochre), right #C8282E (crimson), soles #F4F1EA |
| Skin | #E8B48F, shadow #C48A66 |
| Rim light | Blaze light #FFB13D |

## Outfit
White tank top, crimson oversized work jacket tied at the waist, dark canvas work trousers rolled once at the
ankle, mismatched high-tops, knuckle tape on both hands, small scar on the **chin** (not near the eyes). A wrench
clipped to the belt loop (small, no brand marks).

## Pose sheet
| Pose | Description |
|---|---|
| idle | Bouncing on the balls of the feet, fists up at chin, braid swinging. |
| dash | Low forward lean, braid straight out behind, jacket flaring. |
| windup | Right fist pulled back past the hip, body coiled, sparks (small embers) on the knuckles. Hold-able. |
| hit | Head snaps back, braid whips forward, eyes squeezed shut. |
| KO | Falls backward, arms spread, braid fanned on the floor. |
| Ignition form | Braid **becomes a flame trail** (copper fading to Blaze core #FFF4D6 at the tip); jacket edges glow white-hot #FFF4D6; small heat-shimmer back-shape (a tall teardrop, Blaze key at 40%). Hair colour at the roots unchanged. |
| ignition_transform | Grabs the braid, it catches fire from tip to root, jacket edges flare. |
| victory | Spins the wrench, points at the camera, grin. |

Frame counts: style guide §4.5 (base + Ignition).

## Rarity frame
★3: single 2 px blue #5AA9FF border, plain corners (style guide §6).

## Sizes and formats
Style guide §4.4: sprite frames 576×858 @3x, portraits 512 master, summon art 1080×1920, Ignition cut-in
1080×840, layered source. Keys: `spr_tavi_base`, `spr_tavi_ignition`, `por_tavi_base`, `por_tavi_ignition`,
`art_tavi_summon`, `vfx_tavi_ignition`.

## Placeholder recipe (code, now)
Torso 40×46 aura key with white stroke; braid = tapered 6 px strip from the back of the head to the waist on the
side away from the opponent (#C7662B); jacket flare = trapezoid 40→54 px wide at the hips behind the legs
(#C8282E); fists white-taped (small #E9DCC3 band). Height 96. Ignition: braid strip turns into 3 stacked Blaze
teardrops in the ramp.

## What makes it original
A mechanic kid whose power is tied to engine heat: braid as a fuse, a wrench, mismatched shoes, a tied work
jacket. The look is "workshop" not "pirate" and not "ninja".

## Must not resemble / avoid
- No straw or wide-brim hat; no open red vest over a bare chest; no scar under the eye.
- No spiky pink/red hair, no white scale-pattern scarf; no flame-haired boy with a dragon motif.
- No orange/blue martial-arts gi, no wristbands with symbols.
- Fire never wraps the whole body as an outline; it lives in the braid, jacket edges and hit VFX.

## Mood references (words)
1. A garage at night, a single hot work lamp, sparks from a grinder.
2. A firecracker fuse burning down, crackle and light.
3. A street kid's boxing gym, taped hands and chalk dust.
