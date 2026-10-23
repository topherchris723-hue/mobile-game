# Jade Tempest: Visual Style Guide

Owner: art-director. Version: round 4 (first version). Applies to placeholder art in code now and to any
commissioned or tool-made art later. Read with GDD §2 (pillars), §5.9 (Ignition), §5.10 (Tri-Burst), §5.12 (aura
types), §6 (fighters), §11 (summon), §14 (mobile layout) and the per-fighter briefs in `docs/art-briefs/`.

**Baseline rule (L-shared-014).** The owner approved the round-3 feel after a phone playtest. This guide **keeps** the
battle HUD layout (GDD §14 table), the aura colours and shapes, the card-type colours and shapes, the hit feedback
timing and the readability of names, numbers and the windup ring. Everything below adds *on top of* that baseline.
Anything here that would move a HUD element, change a font size, or change timing is marked **FEEL CHANGE: needs a
Producer plan** and must not be done without one.

---

## 1. Mood and originality

**One-line mood:** *street-tournament martial arts at storm pitch.* Bright, saturated fighters on calm, dark
night-sky arenas. Every big moment gets louder in colour, size and motion, never in clutter.

Mood references (described, never franchise images):
1. A rooftop tournament at dusk, neon signs and paper lanterns, wind pulling every banner sideways.
2. A woodblock print of a storm wave: thick confident outlines, flat colour fields, motion lines as graphic shapes.
3. A boxing-match poster from the 1970s: huge condensed letters, two fighters facing off, one hot accent colour.

**Originality rules (all art, all agents)**
- No character, costume, hairstyle, emblem, aura shape or effect may be recognisable as one from an existing
  franchise (CLAUDE.md §9, GDD §3). Briefs never say "like <character>"; they describe shapes and colours.
- **Ignition is never "the hair turns gold and spikes up" and never a body-hugging flame outline that flickers around
  the whole figure.** Those read as a famous franchise transformation. Our Ignition changes a **signature prop or
  accessory** (braid, lanterns, mask, checker tiles, sun disc, shard crown) and adds an aura-coloured shape *behind*
  the fighter. Hair colour never changes on Ignition.
- No energy "ball held in cupped hands at the hip", no straw hats, no cracked bone-white skull masks, no forehead
  protectors with metal plates, no headbands with a symbol plate, no orange gi with a chest kanji.
- No real-world writing used as decoration (no kanji/hanzi/hangul "for flavour"). Use our own geometric glyphs
  (the 5 aura shapes, chevrons, checks) instead.
- No dragons, no wish orbs, no "seven of anything" collectible set in summon or UI art.

---

## 2. Palette

### 2.1 UI palette (from `src/ui/theme.js`, unchanged)

| Token | Hex | Use |
|---|---|---|
| bg | #0D1020 | Screen background, arena sky bottom |
| bgTop | #1A1F3D | Arena sky top, header bars |
| panel | #1C2240 | Panels, empty card slot |
| panelLight | #2A3260 | Buttons, raised panels |
| stroke | #4A5490 | Panel borders |
| text | #F4F6FF | Main text |
| textDim | #A9B0D6 | Secondary text (8:1 contrast on bg) |
| textDark | #14172B | Text on light buttons; **also the outline colour for all character art** |
| accent | #FFC23D | Primary buttons, title, highlights |
| good / hpPlayer | #4BE08A | Player HP, positive text |
| bad / hpEnemy | #FF5D5D | Enemy HP, negative text |
| hpLag | #FFE08A | HP damage trail |
| hpBack | #2B1E2E | HP bar background |
| vigor | #3DC8FF | Vigor segments |
| vigorEmpty | #22304A | Empty Vigor segments |
| burst | #FFA53D | Tri-Burst button and cinematic |
| ignite | #FF4D2E | IGNITE button |
| disabled | #3A3F5C | Disabled controls |
| overlay | #05060D | Dimming overlays |

### 2.2 Aura-type colours (kept exactly, with reasons)

Every aura has a **ramp** for art and VFX. The *Key* column is the existing `AURA_COLORS` value and stays the
gameplay colour (icons, Ignition glow, chest emblem).

| Aura | Shape (unchanged) | Core (hottest) | Light | **Key (theme.js)** | Deep (shadow) | Motion language |
|---|---|---|---|---|---|---|
| Blaze | flame / teardrop | #FFF4D6 | #FFB13D | **#FF6A3D** | #C8282E | rises, flickers, licks upward |
| Gale | swirl | #F2FFF8 | #8FF0C4 | **#3DDC97** | #137A5A | spirals, horizontal swooshes, chevrons |
| Stone | hexagon | #FFF1D6 | #E3C48F | **#C9A36B** | #6E5638 | falls, cracks, dust puffs, heavy |
| Radiant | 5-point star | #FFFFFF | #FFF0A8 | **#FFD84A** | #C99A1E | expanding rings, straight rays |
| Void | crescent | #F1E8FF | #C7A6FF | **#9B6BFF** | #2A1747 | implodes then bursts, ink blots |

**Decision: keep all five key colours.** Reasons, checked against the round-3 screenshots and computed relative
luminance:
- Luminance order is Void 0.25 < Blaze 0.32 < Stone 0.40 < Gale 0.54 < Radiant 0.71, so even in greyscale the
  five keys separate into distinct steps except **Blaze vs Stone** (0.32 vs 0.40). Under red-green colour blindness
  those two both read as brownish-orange. This is already covered by the **shapes** (teardrop vs hexagon), which are
  drawn on every aura use (chest, bench, team cards, title). So no colour change is needed; the rule is **never show
  an aura colour without its shape** (§8).
- Gale #3DDC97 is close to player HP green #4BE08A, and Blaze #FF6A3D is close to enemy HP red #FF5D5D. These never
  touch each other on screen (HP bars are flat bars in fixed rows; auras live on fighters and icons), and the owner
  approved this look. Keep. Do not use the aura keys for new bar-shaped UI.
- Radiant #FFD84A is close to accent #FFC23D and ★5 gold #FFC23D. The star shape separates Radiant; the ★5 frame
  uses ornaments (§6). Keep.

### 2.3 Card-type colours (unchanged)
Fist #D9483B (square fist block), Bolt #3A7FD9 (arrow), Signature #9A52D9 (diamond), Climax #E8A21F (8-point burst).
The windup ring uses these colours; it is gameplay-critical (time to Slip). **No VFX may draw over the windup ring
or use a ring of the same colour around a fighter.**

### 2.4 Rarity colours (from `src/ui/summon-view.js`, unchanged)
★3 #5AA9FF (blue), ★4 #B06BFF (violet), ★5 #FFC23D (gold). Note: ★3 blue and ★4 violet are close for protan and
deutan players, and ★4 violet is close to Void. Rarity is therefore always shown by **star count + frame shape**
(§6), never by colour alone.

### 2.5 Arena backgrounds
- Value range: background art stays at **≤ 35% brightness and ≤ 40% saturation** so fighters (bright, outlined)
  pop. The current navy sky + mountain silhouettes (#1A1F3D → #0D1020) is the reference value.
- A background may carry one hue tint per stage (e.g. dusk violet, dawn teal), but no pure aura key colours in large
  areas, so aura VFX stay readable.
- No detail in the band y 44–90 (enemy name/floats) or directly behind the name row (§4.3).

---

## 3. Line style and rendering

- **Cel-shaded, flat colour.** Base colour + one shadow tone (the Deep ramp colour or base darkened ~25%) + at most
  one highlight. No gradients on bodies; gradients are allowed in VFX and backgrounds only.
- **Outline:** a closed outer outline in #14172B, **2 px at 1× logical** (6 px at the @3x delivery size). Inner
  detail lines 1 px (3 px @3x), same colour, may taper. Placeholder art currently uses a white 2 px stroke on torso
  and head; that stays for placeholders (it reads well on the dark arena).
- **Rim light:** a 1 px (logical) rim in the fighter's aura **Light** colour on the side facing the opponent. This
  ties the fighter to its type without painting the whole costume in the aura colour.
- **Shapes first.** Big simple shapes, readable at 100 px tall. Signature props are oversized (braid, kite fins,
  stone gauntlets, lantern staff, coat, hood, sash, ribbons).
- **Faces:** big eyes, one clear brow shape, readable expression at 20 px head width. Mouth open in every attack
  frame (it is a shouting game).
- Light comes from the upper front; cast shadow is the existing floor ellipse (code-drawn).

---

## 4. Proportions and sizes (portrait 360×640)

### 4.1 Where fighters live
The arena is y 44–330 (286 logical px tall, GDD §14). Fighters stand on the floor line; the name label row sits at
`floorY − 122 × scale` (`src/ui/fighter-view.js`); bosses render at scale 1.12.

### 4.2 Height and width per fighter (logical px at scale 1, feet to top of hair)

| Fighter | Height | Body width (shoulders) | Read |
|---|---|---|---|
| Tavi | 96 | 40 | small, wiry, braid trailing |
| Lark | 100 | 36 | slim, kite fins above shoulders |
| Pell | 102 (staff to 112) | 40, robe hem 56 | vertical staff + bell sleeves |
| Rook | 108 | 36 | lanky, long legs, raised hand |
| Solenne | 108 | 50 | broad shoulders, sash diagonal |
| Thessa | 110 | 44, coat hem 60 | tall triangle (long coat) |
| Dunmore | 112 | 70 | wide square block, huge fists |
| Corvane | 112 (crown to 112) | 34, ribbon hem 64 | gaunt, ribbons to floor, floating crown |

**Hard ceiling: no opaque body part above 112 px** at scale 1, so the name row (centre −122) is never covered
(owner-approved readability). Ignition shapes behind the fighter (sun disc, lantern halo, shard throne) may rise
higher, but must be drawn **behind** the name label and at ≤ 50% alpha inside the name row band (−130 … −114).

### 4.3 Proportions
- Head : body about **1 : 5** (slightly stylised so faces read at mobile size). Corvane and Thessa 1 : 6 (elegant,
  tall), Tavi 1 : 4.5 (young).
- Hands and fists **1.2×** realistic size; feet 1.1×. Fists are the main read in a fighting game.
- Stance is wide (feet at least shoulder width) in idle and windup; nobody stands straight.
- Every fighter faces right as authored (player side). The enemy side is a horizontal mirror in code. Therefore:
  **no asymmetric text, no one-sided emblem that would read wrong mirrored** (Thessa's mask is on her *left* eye
  as authored; mirrored it moves, which is fine because no rule depends on it).

### 4.4 Delivery sizes and formats (all final art)

| Asset | Logical size | Deliver at @3x | Format |
|---|---|---|---|
| Battle sprite frame | 192 × 286, feet anchor at (96, 270) | 576 × 858, anchor (288, 810) | PNG-32 sRGB, transparent, packed into a Phaser atlas (JSON hash, max 2048 × 2048 per page) |
| Bench / team portrait | 52 × 52 (bench), 96 × 96 (team cards) | master 512 × 512; export 156 and 288 | PNG-32, transparent, head and shoulders, facing right |
| Summon reveal art | 360 × 640 full screen | 1080 × 1920 | PNG-24 (no alpha needed); fighter inside centre safe area 900 × 1400; no text baked in |
| Ignition cut-in bust | 360 × 280 (behind the 92 px cinematic band) | 1080 × 840 | PNG-32, transparent |
| Source files | | | Layered .kra / .psd / .svg, one layer per body part, delivered with the PNGs |

File names follow the art keys in `data/characters.json`: `spr_<family>_<base|ignition>_<anim>_<nn>.png`,
`por_<family>_<base|ignition>.png`, `art_<family>_summon.png`. Umbral variants get **no separate art** in the
milestone (§9).

### 4.5 Animation frame counts (12 fps art rate; logic stays 60 Hz and drives state)

Required per fighter and per form (base and Ignition):

| Anim | Frames | Loop / hold | Notes |
|---|---|---|---|
| idle | 6 | loop | breathing bob ≤ 2 px (matches current placeholder) |
| dash_fwd / dash_back | 4 / 4 | hold last while Dashing | lean 7° into the move |
| windup | 4 | **hold the last frame** until Active | windup length differs per card, so the held pose must read as "about to hit" for any duration |
| strike (fist / bolt / signature / climax) | 3 / 3 / 4 / 6 | play once | contact frame = frame 2 (fist/bolt), 3 (signature), 4 (climax) |
| slip | 3 | play once | upward hop, fighter rendered at 45% alpha by code |
| hit | 3 | play once, then hold frame 3 during hitstun | head snaps back, eyes shut |
| knockdown / getup | 4 / 4 | play once | getup is invulnerable; blink handled by code |
| KO | 6 | hold last | falls backward away from the opponent |
| tag_in / victory | 4 / 8 | once / loop last 4 | victory shows the personality (see briefs) |
| ignition_transform | 12 | play once during the 1.5 s freeze, hold last | prop transformation (see each brief) |

Total per form ≈ 75 frames. Fighters without Ignition (Lark, Dunmore) need the base form only.

---

## 5. UI style (keep the current HUD layout)

- **Layout: unchanged.** GDD §14 battle table and all screen layouts in `reports/screenshots/round-3/` are the
  reference. No element moves, grows or shrinks without a Producer plan.
- **Shapes:** rounded rectangles, radius 10–12 px for buttons and cards, 8 px for chips. Panels #1C2240 with a
  2 px #4A5490 border. Primary buttons accent #FFC23D, text #14172B, white 2 px border.
- **Cards:** card-type colour fill, white type icon top-right, cost in a dark circle top-left, name centred, type
  label bottom. Unaffordable cards greyed (#3A3F5C) with name and icon still visible. This is the approved look.
- **Icons:** always flat, single colour, #000 60% outline (as `src/ui/icons.js`). New icons must be geometric and
  must not be one of the 5 aura shapes or 4 card-type shapes, so those stay unique.
- **Callouts** ("FIGHT!", "PERFECT SLIP!", "COMBO x3", "WEAK!"): heavy weight, gold #FFC23D or white fill, 4 px
  #000 stroke, pop-in scale 1.8 → 1 with a Back.Out ease (as the current cinematic title). Keep sizes as they are.
- Depth order in the arena (back to front): background → Ignition back-shapes → fighters → hit VFX → windup ring →
  damage numbers and callouts → name labels. VFX never covers numbers, names or the windup ring.

---

## 6. Summon rarity language

Rarity must be readable at a glance by **three cues at once: colour, star count and frame shape**.

| Rarity | Orb (reveal) | Frame (results row, team card, roster) | Motion |
|---|---|---|---|
| ★3 | Blue #5AA9FF orb, 1 ring | Single 2 px border, plain corners | Orb pops, no extra |
| ★4 | Violet #B06BFF orb, 2 counter-rotating rings, 4 small diamond glints | **Double** border (2 px + 1 px inset), small notched corners | Rings spin 0.6 s, short violet burst |
| ★5 | Gold #FFC23D orb inside a **jade-green storm** (swirling #3DDC97 → #FFC23D streaks; ties to the title "Jade Tempest"), 3 rings | **3 px gold border + inner glow + four corner gems** (small gold diamonds) + a light sweep across the frame every 2 s | Screen shake 4 px, rays fill the background, 1 white flash (120 ms) |

- Rarity is never "rainbow". No dragon, crossing beams, or wish-orb motifs.
- The reveal may **tease** upward (a blue orb flickers violet then gold) only if the final rarity is the higher one;
  never fake a higher rarity and then downgrade (fairness pillar, GDD §2).
- "NEW" badge: gold chip, dark text (as now). Resonance chip: violet chip (as now).

---

## 7. VFX mood guide (for the vfx-developer)

### 7.1 Per-aura particle language
| Aura | Particle shape | Colours (ramp §2.2) | Hit impact | Projectile trail |
|---|---|---|---|---|
| Blaze | teardrop embers, flame tongues | core → light → key → deep | 6–8 embers spraying up and back | flickering ribbon, embers falling off |
| Gale | chevrons, thin arcs, kite-diamond flecks | core/light/key | 2 crossing white-teal arcs | speed lines + spiral |
| Stone | hex chips, dust puff, crack decal on floor | light/key/deep | 4 chips fall with gravity + dust | tumbling chunk with dust tail |
| Radiant | 4- and 5-point star glints, thin rays, rings | white/light/key | expanding ring + 4 rays | clean straight beam with star glints |
| Void | crescents, ink blots, inward-pulled specks | core/light/key/deep (dark fill + bright rim) | specks pulled in for 2 frames, then a crescent burst | wavering dark ribbon with violet rim |

Void uses dark fills: always give them a #C7A6FF rim so they read on the dark arena.

### 7.2 Escalation ladder (each step clearly bigger than the one below)
| Level | Moment | Size | Shake | Flash | Duration |
|---|---|---|---|---|---|
| L0 | normal hit | ≤ 8 particles, within 40 px of contact | 0–2 px | none | ≤ 150 ms |
| L1 | crit, WEAK!, Riposte, Perfect Slip | + one ring in aura key, 60 px | 2–3 px | none | ≤ 250 ms |
| L2 | combo x3+ end, Tag Strike | + screen-edge speed lines (arena only) | 3–4 px | none | ≤ 300 ms |
| L3 | Climax | existing cinematic band in Climax gold #E8A21F + aura particles behind fighter | 4–6 px | 1 white flash ≤ 120 ms (exists) | as now |
| L4 | **Ignition** | band in the fighter's aura key (exists) + the fighter's **prop transformation** (brief) + radial lines in the aura ramp + aura back-shape that stays for the whole Ignition | 6 px | 1 white flash ≤ 120 ms (exists) | 1.5 s freeze (exists) |
| L5 | **Tri-Burst** | band in burst #FFA53D split by **three diagonal stripes in the three living members' aura keys** (with their shapes as icons), whole arena | 8 px | 1 white flash ≤ 120 ms | 4.0 s freeze (exists) |

- Timings (hitstop, freezes, cinematic lengths) are **owner-approved feel; do not change them** (L-shared-014).
- VFX stay inside the arena (y 44–330). They never cover the top bar, status row, Vigor bar, hand or swipe pad.
- During an Ignition (the whole duration), the fighter keeps a pulsing aura back-shape (the current ellipse glow is
  the placeholder). Final art replaces the ellipse with the brief's back-shape, not a body outline flame.

### 7.3 Photosensitivity and comfort
- At most **3 flashes per second**, full-screen white flash only at L3–L5, ≤ 120 ms, ≤ 0.8 alpha.
- No red/white strobing. No flashing patterns larger than a quarter of the screen faster than 3 Hz.
- Recommended for a later round: a "Reduce flashes and shake" setting (halves shake, removes white flashes).
  This is a settings addition, not a HUD change.

---

## 8. Accessibility (keep shapes + colour)

- **Aura = colour + shape, always together:** Blaze flame, Gale swirl, Stone hexagon, Radiant star, Void crescent.
  Final character art keeps the code-drawn aura icon on the fighter (chest position now). Whether it moves to the
  floor shadow when final sprites arrive is a later, planned decision.
- **Card type = colour + icon** (fist block, arrow, diamond, 8-point burst). Unchanged.
- **Rarity = colour + stars + frame shape** (§6).
- **Side = position + facing + HP bar colour.** For mirror matches (Rook vs enemy Rook), see placeholder plan item 7.
- Text minimum 12 px, card numbers 16 px (GDD §14); text contrast ≥ 4.5 : 1 (current text and textDim pass on bg).
- Silhouette test: every fighter must be recognisable as a solid black shape at 100 px height (each brief lists its
  silhouette keys). Two fighters of the same aura must differ in silhouette, not just in colour.

---

## 9. Umbral variants (rule for all "Umbral <name>" enemies)

Umbral echoes are copies Corvane made from stolen auras (story: "They fight like your friends, but they feel
nothing"). The player must recognise *who* it is copying and *that* it is an echo.

- **Same silhouette** as the base fighter (same pose sheet, same props). Never a new design.
- **Body colours:** every costume, hair and skin colour is desaturated to 25% saturation and shifted toward
  #2A2238 (keep luminance roughly as the original so details survive). Skin becomes #6B6278.
- **Outline:** violet #9B6BFF, 2 px, instead of #14172B. **Crack lines:** 3–5 thin #C7A6FF lines across the body,
  like cracked glass (Corvane's motif).
- **Eyes:** solid #C7A6FF glow, no pupils, no mouth movement (no expression; they are empty copies).
- **Aura stays the base fighter's aura** (Umbral Rook is Gale, Umbral Solenne is Blaze). The chest aura icon, aura
  hit VFX and Ignition glow keep the **real aura key colour** so type matchups stay readable. Only the body goes dark.
- Feet: a thin violet smoke wisp replaces the plain floor shadow edge.
- Milestone: done entirely in code (tint + stroke + crack overlay), no separate art. A final-art pipeline may
  produce `spr_<family>_umbral_*` by applying this rule to the base frames.

---

## 10. Typography

**Current (keep as the default):** system stack `"Trebuchet MS", "Segoe UI", Roboto, Arial, sans-serif`
(`src/ui/theme.js`). No font file is shipped, so no licence entry is needed. It is approved feel.

**Recommendation for a later, planned polish round** (both free, from the Google Fonts repository, licence files
checked on 2026-10-23):

| Role | Font | Licence | Copyright line | File |
|---|---|---|---|---|
| Display: title, callouts, cinematic titles | **Lilita One** Regular | SIL Open Font License 1.1, **Reserved Font Name "Lilita"** | Copyright (c) 2011 Juan Montoreano | `ofl/lilitaone/LilitaOne-Regular.ttf` |
| Body: UI text, card names, numbers | **Nunito** (variable, weights 700–900) | SIL Open Font License 1.1 | Copyright 2014 The Nunito Project Authors | `ofl/nunito/Nunito[wght].ttf` |

Conditions if adopted:
1. **Licence gate:** `assets/CREDITS.md` currently allows only CC0, CC-BY, team-made and owner-bought assets
   without owner approval. **OFL 1.1 is not on that list**, so these fonts must not be bundled until the owner's
   approval is logged in `docs/STATUS.md` (or the Producer obtains it). Until then, keep the system stack.
2. Ship the **unmodified** TTF files with their `OFL.txt` next to them (e.g. `assets/fonts/OFL-LilitaOne.txt`).
   Do not subset or rename Lilita One (subsetting makes a Modified Version, which may not use the reserved name
   "Lilita").
3. **FEEL CHANGE: needs a Producer plan.** A font swap changes text widths. QA must re-run the name-overlap and
   no-clipping checks (e.g. `tests/e2e/qa-busy.spec.js`, "Umbral Solenne" at both walls) at 360×640 and 430×932.
4. Sizes stay as now (min 12 px, card numbers 16 px). Callouts keep the 4 px black stroke.

---

## 11. Placeholder-art plan (now, no external assets)

All items are code-drawn vector/procedural shapes, need no licence entry, and **do not move any HUD element**.
Priority order; owner agent in brackets. Each item ends with how to prove it.

1. **Per-fighter silhouettes in `FighterView`** [ui-developer]. Replace the one shared body with a per-family shape
   table using the "Placeholder recipe" in each brief (`docs/art-briefs/char_*.md`). Keep: torso fill in the aura
   key colour + white 2 px stroke, chest aura icon, floor shadow, name row offset, heights ≤ 112 (§4.2). Proof: a
   Playwright screenshot of all 8 fighters in idle as black fills side by side
   (`reports/screenshots/round-4/silhouettes-360x640.png`) where every pair is tellable apart, plus the existing
   name-overlap specs still passing.
2. **Signature prop colours** [ui-developer]. Draw each fighter's props (braid, fins, gauntlets, staff, coat, hood,
   sash, ribbons) in the hex colours from its brief; the torso stays aura-coloured so the approved type read stays.
3. **Umbral rendering rule** [ui-developer]. For Umbral enemies apply §9 in code: dark tint, violet outline, crack
   lines, glowing eyes, real aura icon. Today the only marker is the id (`enemy_umbral_*`) and the `name_override`
   text; a data flag such as `variant: "umbral"` in `enemies.json` (game-designer/content-designer decision) is the
   clean trigger, because code must not depend on display text. Proof: stage_003 and stage_005 screenshots.
4. **Ignition prop transformations** [vfx-developer]. Replace the pulsing ellipse with each brief's Ignition
   back-shape and prop change (braid flame, lantern halo, mask drop, checker tiles, sun disc, shard throne), drawn
   behind the body, alpha ≤ 50% in the name row band. Timing unchanged.
5. **Aura hit particles and trails** [vfx-developer]. §7.1 shapes and colours per aura; respect the L0–L2 budgets.
6. **Tri-Burst three-stripe band** [vfx-developer]. §7.2 L5: three diagonal aura-key stripes with aura icons inside
   the existing burst band. Same 4.0 s, same text.
7. **Mirror-match side cue** [ui-developer]. Tint the floor shadow ellipse rim: player side #4BE08A at 40%, enemy side
   #FF5D5D at 40% (side is already shown by position and HP bar; this adds a cue at the feet). No layout change.
8. **Summon rarity tiers** [ui-developer]. §6 orb rings and frame shapes (double border for ★4, gold border + corner
   gems + light sweep for ★5, jade storm behind the ★5 orb). Row heights and positions unchanged.
9. **Do not change now:** bench portraits (52×52 aura icon + name + cooldown), card layout, HUD bars, font. They are
   approved and readable; replace only with final art under a Producer plan.
