# Shattered Sovereigns — Art Style Guide

- **Status:** Locked by owner, 2026-10-12. Changes need the owner's approval and must update this file.
- **Applies to:** every character, background, effect, UI element, and placeholder in the game. Code-drawn placeholders follow it too, so the game looks coherent from day one.

## 1. Reference and what we take from it

The owner's reference is a painterly anime key visual: a lone caped hero on a cliff edge at golden hour, looking out over several worlds merged into one view. There are volcanic peaks, a harbour town on a bright sea, a cliffside village with tiered towers, and floating islands around a crystal citadel that shoots beams of light into the sky.

**What we take:**

- Painterly anime backgrounds with huge sunlit cumulus clouds and a deep, saturated sky.
- **Golden-hour light**: warm gold and peach highlights, with **cool violet and indigo shadows** (never grey).
- **Atmospheric depth**: distant layers fade toward blue-violet and lighter values; near layers are richer and darker.
- **Dark foreground framing** (silhouetted foliage and rocks) to push depth, used in menus and story scenes.
- **Epic scale and wonder**: floating islands, light beams, a sense of many worlds sharing one sky.
- **The crystal citadel with its light beams and halo ring** becomes the visual identity of the **Nexus** and the **Rift**.

**What we do not take:**

- Any recognisable landmark or character from existing franchises. In particular the reference contains a cliff carved with giant faces, which is a direct nod to an existing anime and is **not** used in any form.
- The reference image is a mood reference only. It is not stored in the repository and is never used as a game asset.

## 2. Style pillars

1. **Worlds in one sky.** Every scene should feel like part of one shattered, sunlit multiverse, and the Rift should always be visible somewhere.
2. **Heroes read first.** Characters are always the clearest thing on screen: higher contrast, crisper lines, and more saturation than anything behind them.
3. **Warm light, violet shadow.** One consistent lighting model across characters, backgrounds, effects, and UI.

## 3. Mood

**Bright heroic adventure**: vivid, hopeful, energetic. Darkness is reserved for the **Rift**. Rift-heavy moments (boss phases, Crossover Bursts, story climaxes) shift the palette toward deep violet and near-black with bright white-violet light, so they feel dramatic precisely because the rest of the game is bright.

## 4. Lighting model

- **Key light:** warm and low, from the upper front-left at roughly 45°. On characters this produces a lit front plane and a shadowed back plane.
- **Shadows:** violet-indigo, never neutral grey or black. Characters use a single hard-edged cel shadow tone, with an optional second deeper tone only for tight occlusion (under the chin, inside folds).
- **Rim light:** a thin warm gold rim on the back edge of characters. It separates them from busy backgrounds.
- **Mirroring:** opponents are mirrored sprites, which flips their light. This is accepted, as it is standard for 2D fighters.

## 5. Characters (Sovereigns)

**Rendering: HD cel-shaded anime.** The reference shows its hero small and from behind, so this is derived from the reference's overall finish. If the owner provides a character close-up reference, this section is refined from it.

- **Proportions:** adults 7–7.5 heads tall; younger characters 6–6.5. Hands, feet, and weapons are slightly enlarged for readability at phone size.
- **Line art:** outlines in a very dark warm violet (`#1E1424`), never pure black. Battle sprites at spec size use roughly 3 px outer lines and 1.5 px inner lines. Splash art scales proportionally.
- **Shading:** base colour, one cel shadow (hue-shifted toward violet), one hard highlight on hair, metal, and eyes, and a gold rim light (see §4). No soft airbrush gradients on characters.
- **Silhouette test:** every Sovereign must be recognisable as a solid black silhouette 96 px tall. Each one needs a distinctive shape feature (cape, hair shape, weapon, coat tails).
- **Costume colour:** each Sovereign has one dominant colour from their world palette, one secondary colour, and a small accent in their **type colour** so their type is readable in battle.

## 6. Colour

Hex values marked † were sampled from the reference image; the rest are derived to fill gameplay needs.

### 6.1 Shared sky and atmosphere

| Role                      | Hex         |
| ------------------------- | ----------- |
| Sky deep                  | `#1C5998` † |
| Sky mid                   | `#5594BF` † |
| Sky high                  | `#A5BCE0` † |
| Cloud light               | `#FEF3DF` † |
| Cloud shadow (cool)       | `#BFCAD9` † |
| Cloud shadow (warm peach) | `#FBD8BA` † |
| Golden-hour glow          | `#FCB68D` † |
| Distant mountain indigo   | `#34427C` † |
| Violet shadow             | `#503544` † |
| Foreground ink            | `#08090F` † |

### 6.2 World palettes

| World                             | Dominant                 | Secondary                  | Accent                 | Shadow                 | Motifs                                                               |
| --------------------------------- | ------------------------ | -------------------------- | ---------------------- | ---------------------- | -------------------------------------------------------------------- |
| **Energy realm** (volcanic peaks) | Ember orange `#F87844` † | Basalt indigo `#34427C` †  | Lava red `#F34F58` †   | Ash mauve `#503544` †  | Angular rock, cracks of light, rising embers, aura flames            |
| **Ocean crews** (harbour and sea) | Sea blue `#0DA0F2` †     | Sandstone `#C1AD98` †      | Terracotta `#C78C72` † | Deep sea `#1C5998` †   | Sails, rope, brass, white stone, foam rings, rounded shapes          |
| **Warrior clans** (cliff village) | Canopy green `#3E7A2E`   | Pagoda crimson `#B33A3A`   | Sunlit leaf `#B8C424`  | Forest ink `#0F2225` † | Tiered roofs, ink-brush strokes, leaves, sharp diagonals             |
| **The Nexus / Rift**              | Rift violet `#9E8CCB` †  | Rift beam blue `#2888EB` † | Glow white `#FEF3DF` † | Void black `#08090F` † | Crystal spires, light beams, halo rings, floating islands, fractures |

### 6.3 Type colours (gameplay)

Type is always shown by **colour and icon**, never colour alone.

| Type    | Colour    | Icon          |
| ------- | --------- | ------------- |
| Fury    | `#F25C3B` | Clenched fist |
| Swift   | `#1FB6E8` | Arrow wing    |
| Guile   | `#5DBB46` | Spiral eye    |
| Radiant | `#F5C542` | Sunburst      |
| Void    | `#8B5CF6` | Crescent      |

### 6.4 Rarity frames

| Rarity | Frame                                             |
| ------ | ------------------------------------------------- |
| 3★     | Bronze `#B07A4A`                                  |
| 4★     | Sky silver `#A5BCE0`                              |
| 5★     | Gold `#F5C542` with a Rift-violet `#9E8CCB` glint |

## 7. Environments

- **Painterly anime backgrounds** in the reference's finish: soft gradient skies, sculpted clouds with warm tops and violet undersides, and texture suggested by brushwork rather than drawn in detail.
- **Battle arenas use 4 parallax layers:**
  1. Sky and clouds.
  2. Far layer: floating islands and the Nexus citadel, with its beams.
  3. Mid layer: the stage's world landmark (volcano, harbour, cliff village).
  4. Arena floor: three lane bands, low detail.
- **Battle readability rule:** battle backgrounds are about 20% less saturated with a compressed value range compared with menu and story art, and the far layers are slightly softened. The floor stays calm so lane telegraphs read instantly. Characters and effects always win the contrast.
- **Foreground framing** (dark foliage and rocks) is used in menus, the home screen, and story scenes, but **not** in battle, where it would hide action.

## 8. Effects (VFX)

- **Hit sparks:** anime starbursts, 3–5 frames, with a white core and a type-coloured edge.
- **World shape language:**
  - Energy realm: angular shards and aura flames.
  - Ocean crews: water arcs and foam rings.
  - Warrior clans: ink-brush slashes and leaves.
- **Rift effects:** violet crystal fractures, white-violet light beams, and halo rings, as on the reference citadel. They are used for Rift Step, Rift Shards, Crossover Bursts, and summons.
- **Glow is used for cores only** (blast centres, beam cores). No glow on UI, outlines, or whole characters.

## 9. UI

- **Two surfaces:**
  - **Menus:** light cloud-white panels (`#FEF3DF`) with deep-indigo text (`#1E2440`), set over painterly backgrounds.
  - **Battle HUD:** dark ink panels (`#08090F` at 85% opacity) with light text, so the HUD stays readable over any arena.
- **Shape language:** crisp panels with a small 4 px radius and **one 45° chamfered corner**, echoing Rift crystal shards. No pill buttons and no oversized rounded rectangles.
- **Accents:** Rift violet for primary actions, gold for rewards and rarity. At most one accent colour per panel.
- **Typography:** all fonts are open-licensed (OFL) and self-hosted.
  - **Saira Condensed** (Bold or ExtraBold) for titles, numbers, and buttons.
  - **Noto Sans** for body text, chosen for its future localisation coverage.
  - Damage numbers use Saira Condensed ExtraBold Italic with a dark outline.
- **Scales:**
  - Spacing: 4 · 8 · 12 · 16 · 24 · 32 px.
  - Type: 14 · 16 · 20 · 24 · 32 · 48 px. Nothing below 14 px.
- **Icons:** a single consistent set: solid shapes, 2 px detail lines, and the same line colour as character art.

## 10. Asset specifications (for artists)

### 10.1 Splash art (one per Sovereign)

- **Master:** 2048 × 2048 px PNG with a **transparent background**. A layered PSD export (supported by phone apps such as Ibis Paint) is preferred, so effects and the character can be separated.
- **Composition:** full or three-quarter body in a dynamic pose, lit per §4.
- **Crop safe zones**, so one image serves every use:
  - **Card / fighter detail:** a 3:4 portrait crop centred on the character.
  - **Super and Crossover cut-in:** a 21:9 horizontal band through the eyes and upper body. Keep the face fully inside it.
  - **Summon reveal:** uses the full image.
- **Background:** none. The game composites the character over world-themed backgrounds.

### 10.2 Battle sprites

- **Frame canvas:** 512 × 512 px, transparent background.
- **Character height:** about 360 px standing.
- **Anchor:** feet centre at (256, 480).
- **Facing:** right.
- **Timing:** drawn for 12 fps; holds are done by repeating frames in the timing data, not by duplicating drawings.
- **Frames are trimmed and packed** into atlases by our pipeline, so artists deliver plain frames named `<clip>_<nn>.png`.

| Clip             | Frames | Loops      |
| ---------------- | ------ | ---------- |
| `idle`           | 6      | yes        |
| `step`           | 3      | no         |
| `guard`          | 2      | holds last |
| `guard_break`    | 4      | no         |
| `hit_light`      | 3      | no         |
| `hit_heavy`      | 4      | no         |
| `knockdown`      | 5      | no         |
| `getup`          | 4      | no         |
| `strike_1`       | 4      | no         |
| `strike_2`       | 4      | no         |
| `strike_3`       | 5      | no         |
| `blast`          | 6      | no         |
| `signature`      | 10     | no         |
| `crossover_pose` | 3      | holds last |
| `ko`             | 5      | holds last |
| `victory`        | 6      | yes        |
| **Total**        | **74** |            |

**Memory note:** 74 trimmed frames need about two 2048² atlas pages per Sovereign. Uncompressed, six Sovereigns in a duel would exceed the 128 MB texture budget, so battle atlases ship as **GPU-compressed textures (KTX2/Basis)**, which cut texture memory by about 4×. M1 verifies this on the owner's phone before any art is commissioned.

## 11. Placeholders

Until real art exists, Sovereigns are code-drawn layered figures that already follow this guide:

- Correct proportions and silhouette feature.
- Outline colour `#1E1424`.
- World dominant colour, plus a type-colour accent.
- Violet cel shadow and gold rim.
- The same clip names and anchor as §10.2.

Placeholder backgrounds use the §6.1 sky palette with simple layered shapes in the §7 parallax structure. Every placeholder is logged in `../assets.md`.

## 12. Do and don't

| Do                                           | Don't                                                        |
| -------------------------------------------- | ------------------------------------------------------------ |
| Warm highlights, violet shadows              | Grey or pure-black shading                                   |
| Keep characters the highest-contrast element | Let backgrounds compete with fighters                        |
| Keep the Rift violet special and dramatic    | Use violet casually everywhere                               |
| Use chamfered, crisp UI panels               | Use pill buttons, random gradients, or glow on UI            |
| Read type by colour **and** icon             | Rely on colour alone                                         |
| Use original landmarks and designs           | Echo recognisable places or characters from other franchises |
