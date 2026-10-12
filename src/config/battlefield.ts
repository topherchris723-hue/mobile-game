/**
 * Battlefield layout for portrait screens (game-design.md §4.11). Positions are fractions so the
 * layout adapts to tall and short phones; logical width is always LOGICAL_WIDTH (display.ts).
 */

/** Space kept clear at the top for the Timeline bar, in logical units. */
export const TIMELINE_AREA_HEIGHT = 170;

/** Space kept clear at the bottom for the action panel, in logical units. */
export const ACTION_PANEL_HEIGHT = 420;

/** The ground starts this far down the screen (fraction of total height). */
export const FLOOR_TOP_FRACTION = 0.4;

export interface UnitSlot {
  /** Fraction of the logical width. */
  readonly x: number;
  /** 0 = far edge of the unit band, 1 = near edge. Also drives depth scale and draw order. */
  readonly depth: number;
}

/** Your four Sovereigns, lower left, facing right. Index 0 is the Leader. */
export const ALLY_SLOTS: readonly UnitSlot[] = [
  { x: 0.36, depth: 0.5 },
  { x: 0.14, depth: 0.62 },
  { x: 0.42, depth: 0.86 },
  { x: 0.18, depth: 1 },
];

/** Enemies, upper right, facing left. The last two are only used by the stress benchmark. */
export const ENEMY_SLOTS: readonly UnitSlot[] = [
  { x: 0.66, depth: 0.08 },
  { x: 0.86, depth: 0.22 },
  { x: 0.7, depth: 0.36 },
  { x: 0.9, depth: 0.0 },
  { x: 0.52, depth: 0.2 },
];

export const NORMAL_ENEMY_COUNT = 3;
export const BENCHMARK_ENEMY_COUNT = 5;

/** Unit scale at the far and near edge of the band (sprites are ~360 units tall at scale 1). */
export const UNIT_SCALE = { far: 0.5, near: 0.62 } as const;

/** Seed used for the battlefield test so every run is reproducible (CLAUDE.md §8). */
export const BATTLEFIELD_SEED = 0x5eed_2026;

/** Ambient Rift motes; benchmark mode raises this to stress the renderer. */
export const EMBER_COUNT = { normal: 90, benchmark: 600 } as const;
