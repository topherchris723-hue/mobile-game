import { describe, expect, it } from 'vitest';
import { TAP } from '../../src/config/input';
import { isTap } from '../../src/input/tapInput';

describe('isTap', () => {
  const down = { x: 100, y: 200, time: 1000 };

  it('accepts a quick, still touch', () => {
    expect(isTap(down, { x: 103, y: 198, time: 1120 })).toBe(true);
  });

  it('accepts movement exactly at the limit', () => {
    expect(isTap(down, { x: 100 + TAP.maxMovementPx, y: 200, time: 1100 })).toBe(true);
  });

  it('rejects a drag', () => {
    expect(isTap(down, { x: 100, y: 200 + TAP.maxMovementPx + 1, time: 1100 })).toBe(false);
  });

  it('rejects a long press', () => {
    expect(isTap(down, { x: 100, y: 200, time: 1000 + TAP.maxDurationMs + 1 })).toBe(false);
  });
});
