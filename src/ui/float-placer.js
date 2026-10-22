// Places short-lived battle texts (damage numbers, WEAK!/RESIST/CRIT, shouts, callouts) so they never
// overlap each other or the fighters' name labels (BUG-2-10). Pure: no Phaser, so it is unit-tested.
//
// Each text reserves the whole rectangle it will cover during its life (pop scale and rise included).
// place() searches the allowed bands for a free spot near the wanted point; if there is none, it evicts
// older texts of the same or lower priority that are in the way (the caller fades those out at once).

function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export class FloatPlacer {
  constructor() {
    this.items = []; // { rect, until, priority, onEvict }
  }

  prune(now) {
    this.items = this.items.filter((it) => it.until > now);
  }

  /** Live reserved rectangles (for tests and debugging). */
  rects(now) {
    this.prune(now);
    return this.items.map((it) => it.rect);
  }

  /**
   * opts: { w, h, x, y (wanted centre), bands: [{ top, bottom }], minX, maxX, avoid: [rect], now, ttl,
   *         priority (higher wins), onEvict, step (px, default 4), xShift (default true) }
   * Returns { x, y } (the centre to draw at) or null if it cannot be shown without covering an `avoid`
   * rect or a higher-priority text.
   */
  place(opts) {
    const now = opts.now;
    this.prune(now);
    const w = opts.w;
    const h = opts.h;
    const step = opts.step || 4;
    const minX = opts.minX !== undefined ? opts.minX : -Infinity;
    const maxX = opts.maxX !== undefined ? opts.maxX : Infinity;
    const avoid = opts.avoid || [];
    const clampX = (x) => Math.max(minX + w / 2, Math.min(maxX - w / 2, x));
    const xs = [clampX(opts.x)];
    if (opts.xShift !== false) {
      for (const k of [0.75, -0.75, 1.5, -1.5]) {
        const x = clampX(opts.x + k * w);
        if (xs.every((v) => Math.abs(v - x) > 1)) xs.push(x);
      }
    }
    const rectAt = (x, y) => ({ x: x - w / 2, y: y - h / 2, w, h });
    const free = (r) => !avoid.some((a) => hit(r, a)) && !this.items.some((it) => hit(r, it.rect));
    const usable = (band) => band.bottom - band.top >= h;
    for (const band of opts.bands) {
      if (!usable(band)) continue;
      const lo = band.top + h / 2;
      const hi = band.bottom - h / 2;
      const y0 = Math.max(lo, Math.min(hi, opts.y));
      // nearest first: y0, y0-step, y0+step, ... (up first: texts read better above)
      const ys = [y0];
      for (let d = step; y0 - d >= lo || y0 + d <= hi; d += step) {
        if (y0 - d >= lo) ys.push(y0 - d);
        if (y0 + d <= hi) ys.push(y0 + d);
      }
      for (const y of ys) {
        for (const x of xs) {
          const r = rectAt(x, y);
          if (free(r)) return this.reserve(r, opts);
        }
      }
    }
    // No free spot: take the wanted spot in the first usable band and evict what is in the way.
    const band = opts.bands.find(usable);
    if (!band) return null;
    const y = Math.max(band.top + h / 2, Math.min(band.bottom - h / 2, opts.y));
    const r = rectAt(xs[0], y);
    if (avoid.some((a) => hit(r, a))) return null;
    const blockers = this.items.filter((it) => hit(r, it.rect));
    const pri = opts.priority || 0;
    if (blockers.some((it) => (it.priority || 0) > pri)) return null;
    for (const it of blockers) {
      if (it.onEvict) it.onEvict();
    }
    this.items = this.items.filter((it) => blockers.indexOf(it) < 0);
    return this.reserve(r, opts);
  }

  reserve(r, opts) {
    this.items.push({ rect: r, until: opts.now + (opts.ttl || 1000), priority: opts.priority || 0, onEvict: opts.onEvict });
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  /** Forget a text early (it was destroyed). */
  release(onEvict) {
    this.items = this.items.filter((it) => it.onEvict !== onEvict);
  }

  clear() {
    this.items = [];
  }
}
