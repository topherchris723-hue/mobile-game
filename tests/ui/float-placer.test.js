// ui-developer: floating battle texts never overlap each other or name labels (BUG-2-10).
import { describe, it, expect } from 'vitest';
import { FloatPlacer, shoutFits, SHOUT_MIN_SIZE } from '../../src/ui/float-placer.js';

const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const body = { top: 172, bottom: 282 };
const upper = { top: 46, bottom: 150 };
const name = { x: 160, y: 152, w: 40, h: 19 };

describe('FloatPlacer', () => {
  it('stacks many texts at one spot with no overlaps, inside the band, never on the name label', () => {
    const fp = new FloatPlacer();
    const placed = [];
    for (let i = 0; i < 8; i++) {
      const r = fp.place({ w: 50, h: 30, x: 180, y: 230, bands: [body], avoid: [name], now: i * 10, ttl: 1000, priority: 2, minX: 2, maxX: 358 });
      if (r) placed.push({ x: r.x - 25, y: r.y - 15, w: 50, h: 30 });
    }
    expect(placed.length).toBeGreaterThanOrEqual(6);
    for (let i = 0; i < placed.length; i++) {
      expect(hit(placed[i], name)).toBe(false);
      expect(placed[i].y).toBeGreaterThanOrEqual(body.top);
      expect(placed[i].y + placed[i].h).toBeLessThanOrEqual(body.bottom);
      for (let j = i + 1; j < placed.length; j++) expect(hit(placed[i], placed[j])).toBe(false);
    }
  });

  it('a shout and a type tag wanted at the same point end up apart', () => {
    const fp = new FloatPlacer();
    const a = fp.place({ w: 60, h: 20, x: 100, y: 130, bands: [upper], now: 0, ttl: 1000, priority: 1 });
    const b = fp.place({ w: 60, h: 20, x: 100, y: 130, bands: [upper], now: 5, ttl: 1000, priority: 2 });
    expect(hit({ x: a.x - 30, y: a.y - 10, w: 60, h: 20 }, { x: b.x - 30, y: b.y - 10, w: 60, h: 20 })).toBe(false);
  });

  it('when full, evicts older lower-priority texts instead of overlapping; refuses to cover an avoid rect', () => {
    const fp = new FloatPlacer();
    const band = { top: 0, bottom: 30 };
    let evicted = 0;
    expect(fp.place({ w: 400, h: 30, x: 180, y: 15, bands: [band], now: 0, ttl: 1000, priority: 1, onEvict: () => evicted++, xShift: false })).not.toBeNull();
    expect(fp.place({ w: 400, h: 30, x: 180, y: 15, bands: [band], now: 1, ttl: 1000, priority: 0, xShift: false })).toBeNull();
    expect(fp.place({ w: 400, h: 30, x: 180, y: 15, bands: [band], now: 2, ttl: 1000, priority: 2, xShift: false })).not.toBeNull();
    expect(evicted).toBe(1);
    expect(fp.place({ w: 40, h: 30, x: 180, y: 15, bands: [band], avoid: [{ x: 0, y: 0, w: 360, h: 30 }], now: 3, ttl: 1000, priority: 9 })).toBeNull();
    expect(fp.rects(5000)).toEqual([]);
  });
});

// BUG-7c-01: shout fallback layouts (approved first; then one line across the arena; then the 12 px floor)
describe('shoutFits / noEvict (BUG-7c-01)', () => {
  it('the approved layout (13 px italic, 150 px wrap) is tried first at every width', () => {
    for (const W of [360, 390, 430, 768]) expect(shoutFits(W)[0]).toEqual({ size: 13, wrap: 150 });
  });
  it('fallbacks: one line across the arena (W − 16), then 12 px; never below the 12 px minimum', () => {
    expect(shoutFits(360).slice(1)).toEqual([{ size: 13, wrap: 344 }, { size: 12, wrap: 344 }]);
    for (const W of [360, 390, 430]) {
      for (const f of shoutFits(W)) { expect(f.size).toBeGreaterThanOrEqual(SHOUT_MIN_SIZE); expect(f.wrap).toBeLessThanOrEqual(W - 16); }
    }
    expect(SHOUT_MIN_SIZE).toBe(12);
  });
  it('noEvict: with no free spot it returns null and evicts nothing; without it the old text is evicted', () => {
    const band = { top: 0, bottom: 20 };
    const opts = { w: 100, h: 20, x: 50, y: 10, bands: [band], minX: 0, maxX: 100, now: 0, ttl: 1000, priority: 1 };
    const p = new FloatPlacer();
    let evicted = 0;
    expect(p.place({ ...opts, onEvict: () => evicted++ })).not.toBeNull();
    expect(p.place({ ...opts, noEvict: true })).toBeNull();
    expect(evicted).toBe(0);
    expect(p.items.length).toBe(1);
    expect(p.place({ ...opts })).not.toBeNull();
    expect(evicted).toBe(1);
  });
});
