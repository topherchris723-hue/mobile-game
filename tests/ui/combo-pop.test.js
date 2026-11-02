// ui-developer, round 7 QA loop 2 — BUG-7b-01: the combo counter pops 1.5× → 1× over 160 ms, but its reserved
// zone is its 1× size. A shout placed legally right next to the zone was covered during the pop. The fix clamps
// the pop's start (peak) scale so the counter at its peak never touches a live text (fitPopScale), and keeps the
// full approved pop when nothing is next to it.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { FloatPlacer, COMBO_POP, fitPopScale } from '../../src/ui/float-placer.js';

const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const rectAt = (a, s, pad = 0) => ({ x: a.x - a.ox * a.w * s - pad, y: a.y - a.oy * a.h * s - pad, w: a.w * s + 2 * pad, h: a.h * s + 2 * pad });

// 360×640 geometry measured in the browser (stage_003): arena.top 44, upper band 46..150, "COMBO x99" at rest
// 137×33 at (16, top + 56) origin (0, 0.5); enemy "COMBO x99" 112×27 at (W − 16, top + 56) origin (1, 0.5).
const W = 360;
const upper = { top: 46, bottom: 150 };
const player = { x: 16, y: 100, w: 137, h: 33, ox: 0, oy: 0.5 };
const enemy = { x: W - 16, y: 100, w: 112, h: 27, ox: 1, oy: 0.5 };
const zoneOf = (a) => { const r = rectAt(a, 1); return { x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }; };

function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe('BUG-7b-01: combo pop at its peak never covers a placed text', () => {
  it('the approved pop is unchanged when nothing is next to the counter', () => {
    expect(COMBO_POP).toEqual({ player: 1.5, enemy: 1.4 });
    expect(fitPopScale(player, COMBO_POP.player, [], 2)).toBe(1.5);
    expect(fitPopScale(enemy, COMBO_POP.enemy, [], 2)).toBe(1.4);
    // far-away texts do not shrink it either
    expect(fitPopScale(player, 1.5, [{ x: 250, y: 130, w: 60, h: 18 }], 2)).toBe(1.5);
  });

  it('QA scenario: a shout placed legally next to the 1× zone is not covered at the peak (and the old pop did cover it)', () => {
    const fp = new FloatPlacer();
    const zones = [zoneOf(player), zoneOf(enemy)];
    // "NOONDAY HALO!" shout (13 px italic, pop 1.1) wanted right where the counter grows
    const shout = { w: 96 * 1.1 + 2, h: 18 * 1.1 + 2 };
    const r = fp.place({ ...shout, x: 190, y: 100, bands: [upper], avoid: zones, now: 0, ttl: 1200, priority: 1, minX: 2, maxX: W - 2 });
    expect(r).not.toBeNull();
    const placed = fp.rects(0)[0];
    for (const z of zones) expect(hit(placed, z)).toBe(false); // legal placement, outside the reserved zones
    expect(hit(rectAt(player, 1.5), placed)).toBe(true); // the round-7 pop covered it (the bug)
    const peak = fitPopScale(player, COMBO_POP.player, fp.rects(0), 2);
    expect(peak).toBeGreaterThanOrEqual(1);
    expect(peak).toBeLessThan(1.5);
    expect(hit(rectAt(player, peak, 2), placed)).toBe(false);
    // it is the largest such scale (within 0.01): the pop is only cut as much as needed
    expect(hit(rectAt(player, peak + 0.01, 2), placed)).toBe(true);
  });

  it('seeded sweep: 2000 random scenes, the peak rectangle never touches an obstacle that was clear at rest', () => {
    const rnd = lcg(7701);
    let clamped = 0;
    for (let n = 0; n < 2000; n++) {
      const a = rnd() < 0.5 ? player : enemy;
      const max = a === player ? COMBO_POP.player : COMBO_POP.enemy;
      const obs = [];
      const k = 1 + Math.floor(rnd() * 5);
      for (let i = 0; i < k; i++) obs.push({ x: rnd() * W, y: 40 + rnd() * 120, w: 20 + rnd() * 120, h: 12 + rnd() * 40 });
      const peak = fitPopScale(a, max, obs, 2);
      expect(peak).toBeGreaterThanOrEqual(1);
      expect(peak).toBeLessThanOrEqual(max);
      const rest = rectAt(a, 1, 2);
      for (const o of obs) if (!hit(rest, o)) expect(hit(rectAt(a, peak, 2), o)).toBe(false);
      if (peak < max) clamped++;
    }
    expect(clamped).toBeGreaterThan(100); // the sweep really exercised the clamp
  });

  it('an obstacle already touching the counter at rest is ignored (the pop does not make it worse)', () => {
    const touching = { x: 100, y: 95, w: 20, h: 10 };
    expect(fitPopScale(player, 1.5, [touching], 2)).toBe(1.5);
    expect(fitPopScale(player, 1, [], 2)).toBe(1);
  });

  it('BattleScene pops both counters through popCombo (clamped), never with a raw start scale', () => {
    const src = fs.readFileSync('src/scenes/BattleScene.js', 'utf8');
    const body = src.slice(src.indexOf('  updateCombo(st) {'), src.indexOf('  fadeCombo(side) {'));
    expect(body).toContain('this.popCombo(this.comboText, COMBO_POP.player)');
    expect(body).toContain('this.popCombo(this.enemyCombo, COMBO_POP.enemy)');
    expect(body).not.toMatch(/setScale\(\s*1\.\d/);
    const pop = src.slice(src.indexOf('  popCombo(tx, maxPop) {'), src.indexOf('  /** Fixed texts the floating ones'));
    expect(pop).toContain('fitPopScale(');
    expect(pop).toContain('this.floats.rects(this.time.now)');
  });
});
