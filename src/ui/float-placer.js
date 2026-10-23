// Places short-lived battle texts (damage numbers, WEAK!/RESIST/CRIT, shouts, callouts) so they never
// overlap each other or the fighters' name labels (BUG-2-10). Pure: no Phaser, so it is unit-tested.
//
// Each text reserves the whole rectangle it will cover during its life (pop scale and rise included).
// place() searches the allowed bands for a free spot near the wanted point; if there is none, it evicts
// older texts of the same or lower priority that are in the way (the caller fades those out at once).

/**
 * Registry of every text drawn in the battle arena band (hard rule L-ui-003 / playbook "Layout self-check").
 * placed  = positioned by FloatPlacer.place() (BattleScene.spawnFloat);
 * avoid   = fixed text registered as an avoid rectangle while visible (BattleScene.floatAvoid);
 * reserve = fixed area reserved for the whole battle (sized for its longest string);
 * placer2 = positioned by placeNameLabels / placeFighters below.
 * Add every new arena text here and to the scan in tests/e2e (qa-busy / smoke "busy" tests).
 */
export const ARENA_TEXT_REGISTRY = [
  { text: 'damage numbers (hit, tri_burst_hit)', how: 'placed' },
  { text: 'CRIT! / WEAK! / RESIST', how: 'placed' },
  { text: 'DODGE / TAG! / TAG STRIKE!', how: 'placed' },
  { text: 'IMMUNE (hit_discarded, whiff.rush_invulnerable)', how: 'placed' },
  { text: 'callouts: FIGHT!, PERFECT SLIP!, RIPOSTE!, K.O.!, TRI-BURST blocked/missed, Time up', how: 'placed' },
  { text: 'fighter shouts (card, tag-in, intro shout lines)', how: 'placed' },
  { text: 'fighter name labels (both sides)', how: 'placer2 + avoid' },
  { text: 'combo counter COMBO xN (player)', how: 'reserve' },
  { text: 'hit counter N HITS (player)', how: 'reserve' },
  { text: 'enemy combo counter COMBO xN', how: 'reserve' },
  { text: 'tutorial prompt box', how: 'avoid' },
  { text: 'intro banner (names, VS, intro shout)', how: 'avoid' },
  { text: 'cinematic overlay title/sub (Ignition, Climax, Tri-Burst)', how: 'overlay (depth 80, covers the arena on purpose)' },
];

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

// ---------------------------------------------------------------------------------------------------------
// Fighters and their name labels (BUG-2-11, hard rule L-ui-003). The single placer for every arena text and
// sprite position: BattleScene.render asks these functions where to draw, nothing else positions them.

/**
 * Horizontal reach of the placeholder fighter silhouette from its anchor (feet centre), for a pose.
 * rot = body rotation (rad, Phaser: clockwise positive), s = scale (boss 1.12), facing = +1 right / −1 left,
 * ox = pose x offset, glow = Ignition glow drawn. Returns { left, right } (both ≥ 0, logical px).
 */
export function silhouetteExtent(rot, s, facing, ox, glow) {
  const pts = [
    [0, -107 * s], [-13 * s, -94 * s], [13 * s, -94 * s], // head
    [-22 * s, -80 * s], [22 * s, -80 * s], [-22 * s, -30 * s], [22 * s, -30 * s], // torso
    [facing * 36 * s, -58 * s], [facing * 36 * s, -66 * s], // fist
    [-32 * s, 0], [32 * s, 0], [-32 * s, 8], [32 * s, 8], // shadow / feet
    [-42, -58 * s], [42, -58 * s], // wind-up ring (r ≤ 38 + 4 px line)
  ];
  if (glow) pts.push([-45, -60], [45, -60], [0, -130], [0, 10]);
  const c = Math.cos(rot || 0);
  const sn = Math.sin(rot || 0);
  let lo = 0;
  let hi = 0;
  for (const [x, y] of pts) {
    const xr = x * c - y * sn + (ox || 0);
    lo = Math.min(lo, xr);
    hi = Math.max(hi, xr);
  }
  return { left: -lo + 2, right: hi + 2 }; // +2 for the 2 px outline
}

/**
 * Screen x of the two fighters. The player is always left of the enemy. Keeps at least minGap between the
 * anchors (presentation only; logic distance is unchanged) and every pixel of both silhouettes inside
 * [margin, W − margin] (AC-14.1). p/e = { x (wanted), left, right } (extents from silhouetteExtent).
 * Returns { px, ex }.
 */
export function placeFighters(p, e, W, margin, minGap) {
  let px = p.x;
  let ex = e.x;
  if (ex - px < minGap) {
    const mid = (px + ex) / 2;
    px = mid - minGap / 2;
    ex = mid + minGap / 2;
  }
  const pMin = margin + p.left;
  const eMax = W - margin - e.right;
  if (px < pMin) {
    px = pMin;
    ex = Math.max(ex, px + minGap);
  }
  if (ex > eMax) {
    ex = eMax;
    px = Math.min(px, ex - minGap);
  }
  // both walls at once (cannot happen at 360 wide with default art; edges win over the gap)
  px = Math.max(pMin, Math.min(px, W - margin - p.right));
  ex = Math.min(eMax, Math.max(ex, margin + e.left));
  return { px, ex };
}

/**
 * Centres of the two name labels (one fixed row). Each label is clamped to [margin + w/2, W − margin − w/2];
 * if they would touch (closer than gap), both are pushed apart around their midpoint and clamped again, so
 * long names ("Umbral Solenne") never overlap at melee range or at a wall. p/e = { x (wanted), w }.
 * Returns { px, ex }. Labels only overlap if w_p + w_e + gap > W − 2·margin (impossible for ≤ 20-char names).
 */
export function placeNameLabels(p, e, W, margin, gap) {
  const clampL = (x, w) => Math.max(margin + w / 2, Math.min(W - margin - w / 2, x));
  let px = clampL(p.x, p.w);
  let ex = clampL(e.x, e.w);
  const need = p.w / 2 + e.w / 2 + gap;
  if (ex - px < need) {
    const mid = (px + ex) / 2;
    px = clampL(mid - need / 2, p.w);
    ex = clampL(px + need, e.w);
    px = clampL(ex - need, p.w); // pushed back from the right wall
  }
  return { px, ex };
}
