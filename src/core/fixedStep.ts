import { MAX_FRAME_DELTA_MS, TICK_MS } from '../config/sim';

export interface FixedStepClock {
  accumulatorMs: number;
}

export interface FixedStepResult {
  /** Whole simulation ticks to run this frame. */
  steps: number;
  /** 0–1 progress toward the next tick, used to interpolate rendering. */
  alpha: number;
}

export function createFixedStepClock(): FixedStepClock {
  return { accumulatorMs: 0 };
}

/**
 * Converts a variable frame delta into a whole number of fixed ticks.
 * Writes into `out` instead of allocating, because this runs every frame.
 */
export function advanceClock(
  clock: FixedStepClock,
  frameDeltaMs: number,
  out: FixedStepResult,
): FixedStepResult {
  const delta = Math.min(Math.max(frameDeltaMs, 0), MAX_FRAME_DELTA_MS);
  clock.accumulatorMs += delta;
  const steps = Math.floor(clock.accumulatorMs / TICK_MS);
  clock.accumulatorMs -= steps * TICK_MS;
  out.steps = steps;
  out.alpha = clock.accumulatorMs / TICK_MS;
  return out;
}
