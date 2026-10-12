import { describe, expect, it } from 'vitest';
import { MAX_FRAME_DELTA_MS, TICK_MS } from '../../src/config/sim';
import { advanceClock, createFixedStepClock } from '../../src/core/fixedStep';

describe('advanceClock', () => {
  const run = (deltas: number[]) => {
    const clock = createFixedStepClock();
    const out = { steps: 0, alpha: 0 };
    let total = 0;
    for (const d of deltas) total += advanceClock(clock, d, out).steps;
    return { total, out, clock };
  };

  it('runs one tick per 60 Hz frame on average', () => {
    expect(run(Array.from({ length: 60 }, () => 1000 / 60)).total).toBe(60);
  });

  it('runs two ticks per frame on a 30 Hz display', () => {
    const clock = createFixedStepClock();
    const out = { steps: 0, alpha: 0 };
    expect(advanceClock(clock, TICK_MS * 2, out).steps).toBe(2);
  });

  it('carries leftover time forward as interpolation alpha', () => {
    const { out } = run([TICK_MS * 1.5]);
    expect(out.steps).toBe(1);
    expect(out.alpha).toBeCloseTo(0.5, 5);
  });

  it('clamps long stalls so the simulation never catches up for seconds', () => {
    const { total } = run([5000]);
    expect(total).toBe(Math.floor(MAX_FRAME_DELTA_MS / TICK_MS));
  });

  it('ignores negative deltas from clock skew', () => {
    const { total, clock } = run([-50]);
    expect(total).toBe(0);
    expect(clock.accumulatorMs).toBe(0);
  });
});
