/**
 * Colour tokens from docs/design/art-style.md §6. Keep this file and the style guide in sync.
 * Values are 0xRRGGBB numbers so they can be used directly by PixiJS.
 */
export const SKY = {
  deep: 0x1c5998,
  mid: 0x5594bf,
  high: 0xa5bce0,
  cloudLight: 0xfef3df,
  cloudShadowCool: 0xbfcad9,
  cloudShadowWarm: 0xfbd8ba,
  goldenGlow: 0xfcb68d,
  mountainIndigo: 0x34427c,
  violetShadow: 0x503544,
  foregroundInk: 0x08090f,
} as const;

export const WORLD = {
  energy: { dominant: 0xf87844, secondary: 0x34427c, accent: 0xf34f58, shadow: 0x503544 },
  ocean: { dominant: 0x0da0f2, secondary: 0xc1ad98, accent: 0xc78c72, shadow: 0x1c5998 },
  clans: { dominant: 0x3e7a2e, secondary: 0xb33a3a, accent: 0xb8c424, shadow: 0x0f2225 },
  nexus: { dominant: 0x9e8ccb, secondary: 0x2888eb, accent: 0xfef3df, shadow: 0x08090f },
} as const;

export const TYPE_COLOR = {
  fury: 0xf25c3b,
  swift: 0x1fb6e8,
  guile: 0x5dbb46,
  radiant: 0xf5c542,
  void: 0x8b5cf6,
} as const;

/** Character rendering constants (style guide §4–§5). */
export const CHARACTER = {
  outline: 0x1e1424,
  rimLight: 0xf5c542,
  /** Every cel shadow is the base colour pulled toward this violet. */
  celShadowTarget: 0x503544,
  celShadowStrength: 0.45,
  skin: 0xf2c6a0,
} as const;

/** Battle backgrounds are desaturated by this fraction for readability (style guide §7). */
export const BATTLE_BACKGROUND_DESATURATION = 0.2;
