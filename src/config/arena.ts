export type LaneIndex = 0 | 1 | 2;

export interface LaneSpec {
  /** Feet position in logical units (see display.ts). */
  readonly floorY: number;
  /** Fighter scale in this lane; further lanes are drawn smaller to read as depth. */
  readonly scale: number;
}

/** Lanes from far (0) to near (2). */
export const LANES: readonly [LaneSpec, LaneSpec, LaneSpec] = [
  { floorY: 520, scale: 0.86 },
  { floorY: 590, scale: 0.93 },
  { floorY: 662, scale: 1 },
];

export const START_LANE: LaneIndex = 1;

/** Ticks a lane step takes (60 Hz → 150 ms). */
export const LANE_STEP_TICKS = 9;

/** Horizontal fighter positions as fractions of the visible width. */
export const PLAYER_X_FRACTION = 0.3;
export const OPPONENT_X_FRACTION = 0.7;

/** Top edge of the arena floor in logical units. */
export const FLOOR_TOP_Y = 478;

/** Test-arena opponent wanders between lanes on a seeded timer so motion can be judged on device. */
export const OPPONENT_WANDER_MIN_TICKS = 90;
export const OPPONENT_WANDER_MAX_TICKS = 210;

/** Seed used for the test arena so every run is reproducible (CLAUDE.md §8). */
export const ARENA_SEED = 0x5eed_2026;

/** Ambient Rift motes; benchmark mode raises this to stress the renderer. */
export const EMBER_COUNT = { normal: 90, benchmark: 600 } as const;
