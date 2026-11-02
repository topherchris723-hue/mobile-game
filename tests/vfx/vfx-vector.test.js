// Round 7 (R-2 / AC-17.7): the plain-shape frames have one geometry for the atlas and the Canvas vector draw.
import { describe, it, expect } from 'vitest';
import { VECTOR_FRAMES, shapeParts, cssOf } from '../../src/vfx/vector-shapes.js';
import { FRAME_SIZES, RING_RADIUS, DISC_RADIUS, layoutAtlas } from '../../src/vfx/atlas.js';
import { FRAMES } from '../../src/vfx/particles.js';

/** Records the points a part puts on a path (moveTo / lineTo / bezier end points / rect corners / arc extents). */
function recorder() {
  const pts = [];
  let ops = 0;
  // sample the arc span actually drawn (start → end, direction as canvas arc())
  const arcPts = (x, y, r, a0, a1, ccw) => {
    const T = Math.PI * 2;
    let span = ccw ? a0 - a1 : a1 - a0;
    if (Math.abs(a1 - a0) >= T) span = T;
    else span = ((span % T) + T) % T;
    for (let i = 0; i <= 32; i++) {
      const a = a0 + (ccw ? -1 : 1) * span * (i / 32);
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
  };
  return {
    pts, get ops() { return ops; },
    moveTo(x, y) { ops++; pts.push([x, y]); },
    lineTo(x, y) { ops++; pts.push([x, y]); },
    bezierCurveTo(a, b, c, d, x, y) { ops++; pts.push([x, y]); },
    closePath() { ops++; },
    rect(x, y, w, h) { ops++; pts.push([x, y], [x + w, y + h]); },
    roundRect(x, y, w, h) { ops++; pts.push([x, y], [x + w, y + h]); },
    arc(x, y, r, a0, a1, ccw) { ops++; arcPts(x, y, r, a0, a1, ccw); },
  };
}

describe('VFX vector shapes (Canvas renderer, round 7)', () => {
  it('every vector frame is an atlas frame and has drawable parts inside its cell', () => {
    for (const f of VECTOR_FRAMES) {
      expect(FRAMES, f).toContain(f);
      const [w, h] = FRAME_SIZES[f];
      const parts = shapeParts(f, w, h, RING_RADIUS, DISC_RADIUS);
      expect(Array.isArray(parts) && parts.length > 0, f).toBe(true);
      for (const pt of parts) {
        const r = recorder();
        pt.build(r);
        expect(r.ops, f).toBeGreaterThan(0);
        for (const [x, y] of r.pts) {
          expect(x, f + ' x').toBeGreaterThanOrEqual(-0.5);
          expect(x, f + ' x').toBeLessThanOrEqual(w + 0.5);
          expect(y, f + ' y').toBeGreaterThanOrEqual(-0.5);
          expect(y, f + ' y').toBeLessThanOrEqual(h + 0.5);
        }
        expect(['fill', 'stroke']).toContain(pt.mode);
        if (pt.mode === 'stroke') expect(pt.lineWidth).toBeGreaterThan(0);
      }
    }
  });

  it('frames without a vector version return null (they stay atlas images)', () => {
    for (const f of ['soft', 'beam', 'streak', 'streak_small', 'portrait_blaze', 'back_rook']) expect(shapeParts(f, 32, 32, RING_RADIUS, DISC_RADIUS)).toBe(null);
  });

  it('the atlas still lays out every frame (painters: vector-shapes or atlas PAINT)', () => {
    const L = layoutAtlas();
    for (const f of FRAMES) expect(L[f], f).toBeTruthy();
  });

  it('tint colours map to css, Void body darkened like rgba(70,70,70) under a tint', () => {
    expect(cssOf(0xffffff)).toBe('#ffffff');
    expect(cssOf(0x3ddc97)).toBe('#3ddc97');
    expect(cssOf(0xffffff, true)).toBe('#464646');
    expect(cssOf(0x000a0b)).toBe('#000a0b');
  });
});
