// Aura particle language and Ignition back-shapes (docs/STYLE_GUIDE.md §2.2, §7.1; art briefs "Placeholder recipe").
// Key colours come from data/vfx.json → colors.aura; the ramps (core/light/deep) are the style guide's.

export const AURA_RAMPS = {
  blaze: { core: 0xfff4d6, light: 0xffb13d, deep: 0xc8282e },
  gale: { core: 0xf2fff8, light: 0x8ff0c4, deep: 0x137a5a },
  stone: { core: 0xfff1d6, light: 0xe3c48f, deep: 0x6e5638 },
  radiant: { core: 0xffffff, light: 0xfff0a8, deep: 0xc99a1e },
  void: { core: 0xf1e8ff, light: 0xc7a6ff, deep: 0x2a1747 },
};

/**
 * Motion language per aura (§7.1). frames = atlas frame names, picked per particle; ramp = which ramp steps colour
 * the particles ('key' = the data key colour). base/spread in degrees (0 = right, −90 = up); ay in px/s²;
 * pull = Void's "specks pulled in, then a crescent burst" (ms of inward motion before the burst).
 */
export const AURA_MOTION = {
  blaze: { frames: ['ember'], ramp: ['core', 'light', 'key', 'key', 'deep'], base: -90, spread: 140, ay: -260, drag: 0.4, align: true },
  gale: { frames: ['chevron', 'chevron', 'kite'], ramp: ['core', 'light', 'key'], base: 0, spread: 360, ay: 0, drag: 0.8, align: true, flat: 0.45 },
  stone: { frames: ['hex'], ramp: ['light', 'key', 'deep'], base: -90, spread: 150, ay: 760, drag: 0.1, spin: 540 },
  radiant: { frames: ['star4', 'star5'], ramp: ['core', 'light', 'key'], base: 0, spread: 360, ay: 0, drag: 1.2, spin: 180 },
  void: { frames: ['crescent'], ramp: ['light', 'key', 'core'], base: 0, spread: 360, ay: 0, drag: 0.6, pull: 40, spin: 360 },
};

/** Atlas frame for generic particles by `texture` key (vfx_gen_<frame>). */
export const GENERIC_FRAME = 'dot';

/**
 * Ignition back-shapes (style guide §11 item 4, per art brief). Drawn behind the body, alpha ≤ 0.5 (name row rule).
 * spin = deg/s rotation (orbits), pulse = alpha pulse depth, dy = centre offset above the feet (logical px),
 * tint = true when the frame is white and takes the aura key; false when its colours are baked (brief hex values).
 */
export const BACK_SHAPES = {
  back_ellipse: { spin: 0, pulse: 0.35, dy: -60, tint: true },
  back_tavi: { spin: 0, pulse: 0.3, dy: -66, tint: false },
  back_pell: { spin: 40, pulse: 0.15, dy: -86, tint: false },
  back_rook: { spin: -55, pulse: 0.15, dy: -62, tint: false },
  back_solenne: { spin: 10, pulse: 0.2, dy: -82, tint: false },
  back_thessa: { spin: 0, pulse: 0.2, dy: -70, tint: false },
  back_corvane: { spin: 0, pulse: 0.2, dy: -64, tint: false },
};

export const AURAS = ['blaze', 'gale', 'stone', 'radiant', 'void'];
