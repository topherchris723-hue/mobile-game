// ui-developer round 5: summon rarity frames read by SHAPE as well as colour (STYLE_GUIDE §6, §11 item 8).
import { describe, it, expect } from 'vitest';
import { drawRarityFrame } from '../../src/ui/rarity-frame.js';

function recorder() {
  const calls = [];
  const g = new Proxy({}, { get: (_, k) => (...a) => { calls.push([k, a]); return g; } });
  return { g, calls };
}
export function frameSignature(rarity) {
  const { g, calls } = recorder();
  drawRarityFrame(g, 0, 0, 200, 50, 10, rarity);
  const count = (k) => calls.filter((c) => c[0] === k).length;
  const widths = calls.filter((c) => c[0] === 'lineStyle').map((c) => c[1][0]);
  return { rects: count('strokeRoundedRect'), notches: count('fillTriangle'), gems: count('fillPoints'), maxWidth: Math.max(...widths) };
}

describe('rarity frames', () => {
  it('★3 single 2 px border, plain corners, no gems', () => {
    expect(frameSignature(3)).toEqual({ rects: 1, notches: 0, gems: 0, maxWidth: 2 });
  });
  it('★4 double border (2 px + 1 px inset) with 4 notched corners', () => {
    expect(frameSignature(4)).toEqual({ rects: 2, notches: 4, gems: 0, maxWidth: 2 });
  });
  it('★5 3 px border + inner glow + 4 corner gems', () => {
    const s = frameSignature(5);
    expect(s.gems).toBe(4);
    expect(s.maxWidth).toBe(3);
    expect(s.rects).toBeGreaterThanOrEqual(2); // glow rings + border
  });
  it('the three shapes differ (colour-blind safe), must-FAIL if two tiers draw the same frame', () => {
    const sig = [3, 4, 5].map((r) => JSON.stringify(frameSignature(r)));
    expect(new Set(sig).size).toBe(3);
    expect(new Set([JSON.stringify(frameSignature(3)), JSON.stringify(frameSignature(3))]).size).toBe(1);
  });
});
