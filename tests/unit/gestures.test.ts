import { describe, expect, it } from 'vitest';
import { GESTURE } from '../../src/config/input';
import { createGestureRecognizer, type GestureEvent } from '../../src/input/gestures';

describe('gesture recognizer', () => {
  it('emits swipe up as soon as the vertical threshold is crossed', () => {
    const r = createGestureRecognizer();
    const out: GestureEvent[] = [];
    r.down(1, 100, 200, 0);
    r.move(1, 100, 200 - GESTURE.swipeMinDistancePx + 1, out);
    expect(out).toEqual([]);
    r.move(1, 102, 200 - GESTURE.swipeMinDistancePx, out);
    expect(out).toEqual([{ kind: 'swipe', direction: -1 }]);
  });

  it('emits swipe down', () => {
    const r = createGestureRecognizer();
    const out: GestureEvent[] = [];
    r.down(1, 100, 200, 0);
    r.move(1, 100, 260, out);
    expect(out).toEqual([{ kind: 'swipe', direction: 1 }]);
  });

  it('gives one swipe per touch, however far it travels', () => {
    const r = createGestureRecognizer();
    const out: GestureEvent[] = [];
    r.down(1, 100, 200, 0);
    r.move(1, 100, 150, out);
    r.move(1, 100, 80, out);
    r.move(1, 100, 300, out);
    expect(out).toHaveLength(1);
  });

  it('ignores mostly horizontal drags', () => {
    const r = createGestureRecognizer();
    const out: GestureEvent[] = [];
    r.down(1, 100, 200, 0);
    r.move(1, 180, 230, out);
    expect(out).toEqual([]);
  });

  it('turns a still touch into a hold, and releases it on lift', () => {
    const r = createGestureRecognizer();
    const out: GestureEvent[] = [];
    r.down(1, 100, 200, 1000);
    r.update(1000 + GESTURE.holdMinDurationMs - 1, out);
    expect(out).toEqual([]);
    r.update(1000 + GESTURE.holdMinDurationMs, out);
    expect(out).toEqual([{ kind: 'holdStart' }]);
    r.up(1, out);
    expect(out).toEqual([{ kind: 'holdStart' }, { kind: 'holdEnd' }]);
    expect(r.activeCount).toBe(0);
  });

  it('never lets a hold become a swipe', () => {
    const r = createGestureRecognizer();
    const out: GestureEvent[] = [];
    r.down(1, 100, 200, 0);
    r.update(GESTURE.holdMinDurationMs, out);
    r.move(1, 100, 100, out);
    expect(out).toEqual([{ kind: 'holdStart' }]);
  });

  it('never lets a swipe become a hold', () => {
    const r = createGestureRecognizer();
    const out: GestureEvent[] = [];
    r.down(1, 100, 200, 0);
    r.move(1, 100, 140, out);
    r.update(5000, out);
    r.up(1, out);
    expect(out).toEqual([{ kind: 'swipe', direction: -1 }]);
  });

  it('does not hold after drifting beyond the hold tolerance', () => {
    const r = createGestureRecognizer();
    const out: GestureEvent[] = [];
    r.down(1, 100, 200, 0);
    r.move(1, 100 + GESTURE.holdMaxMovementPx + 2, 200, out);
    r.update(GESTURE.holdMinDurationMs * 3, out);
    expect(out).toEqual([]);
  });

  it('tracks two thumbs independently', () => {
    const r = createGestureRecognizer();
    const out: GestureEvent[] = [];
    r.down(1, 100, 200, 0);
    r.down(2, 140, 200, 0);
    r.update(GESTURE.holdMinDurationMs, out);
    expect(out).toEqual([{ kind: 'holdStart' }, { kind: 'holdStart' }]);
    r.up(2, out);
    expect(r.activeCount).toBe(1);
  });

  it('keeps hold tolerance below the swipe distance so the two cannot overlap', () => {
    expect(GESTURE.holdMaxMovementPx).toBeLessThan(GESTURE.swipeMinDistancePx);
  });
});
