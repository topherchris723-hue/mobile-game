// ui-developer round 5: per-fighter placeholder silhouettes (STYLE_GUIDE §4.2, §11 items 1–3, 7).
import { describe, it, expect } from 'vitest';
import { FIGHTER_SHAPES, DEFAULT_SHAPE, HEIGHT_LIMIT, shapeFor, shapeBounds, silhouetteMask, umbralColor, SIDE_RIM } from '../../src/ui/fighter-shapes.js';
import { silhouetteExtent, placeFighters, placeNameLabels } from '../../src/ui/float-placer.js';
import { readJson } from '../helpers/load-data.js';

const chars = readJson('data/characters.json').characters.filter((c) => c.playable !== false);
const enemies = readJson('data/enemies.json').enemies;

/** Pairs of shapes whose masks differ in fewer than minCells grid cells (= not tellable apart). */
export function lookalikes(shapes, minCells) {
  const ids = Object.keys(shapes);
  const masks = ids.map((id) => silhouetteMask(shapes[id], 4));
  const out = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    let diff = 0;
    for (const c of masks[i]) if (!masks[j].has(c)) diff++;
    for (const c of masks[j]) if (!masks[i].has(c)) diff++;
    if (diff < minCells) out.push(`${ids[i]}~${ids[j]} ${diff}`);
  }
  return out;
}
export function tooTall(shapes) {
  return Object.keys(shapes).filter((id) => shapeBounds(shapes[id]).y0 < -HEIGHT_LIMIT).map((id) => id + ' ' + shapeBounds(shapes[id]).y0);
}

describe('per-fighter silhouettes', () => {
  it('every playable fighter in data has its own shape (no fallback)', () => {
    expect(chars.filter((c) => shapeFor(c.id) === DEFAULT_SHAPE).map((c) => c.id)).toEqual([]);
  });
  it('every enemy base character has a shape', () => {
    expect(enemies.filter((e) => shapeFor(e.character_id) === DEFAULT_SHAPE).map((e) => e.id)).toEqual([]);
  });
  it('no opaque part above 112 px (name row stays clear), incl. the default body', () => {
    expect(tooTall(Object.assign({ default: DEFAULT_SHAPE }, FIGHTER_SHAPES))).toEqual([]);
  });
  it('every pair of silhouettes differs in ≥ 40 cells of 4×4 px (tellable apart as black shapes)', () => {
    expect(lookalikes(FIGHTER_SHAPES, 40)).toEqual([]);
  });
  it('must-FAIL: two identical shapes and a 120 px crown are caught', () => {
    expect(lookalikes({ a: FIGHTER_SHAPES.char_tavi_001, b: FIGHTER_SHAPES.char_tavi_001 }, 40)).toHaveLength(1);
    const tall = { parts: [...DEFAULT_SHAPE.parts, { k: 'poly', pts: [[-3, -104], [3, -104], [0, -120]], fill: 0 }] };
    expect(tooTall({ tall })).toHaveLength(1);
  });
  it('torso keeps the aura colour; props have their own colours', () => {
    for (const id of Object.keys(FIGHTER_SHAPES)) {
      const parts = FIGHTER_SHAPES[id].parts;
      expect(parts.find((p) => p.role === 'torso').fill, id).toBe('aura');
      expect(parts.some((p) => p.role === 'prop' && typeof p.fill === 'number'), id + ' prop colour').toBe(true);
    }
  });
  it('Umbral colours are dark and desaturated; side rims are green (player) and red (enemy)', () => {
    const c = umbralColor(0xff6a3d);
    const r = (c >> 16) & 255;
    const b = c & 255;
    expect(r - b).toBeLessThan(0xff - 0x3d); // less saturated
    expect(SIDE_RIM.player.color).toBe(0x4be08a);
    expect(SIDE_RIM.enemy.color).toBe(0xff5d5d);
  });
  it('arena placer with the real shape bounds: widest fighters at both walls and melee stay on screen, labels apart', () => {
    const W = 360;
    const bad = [];
    for (const pid of Object.keys(FIGHTER_SHAPES)) for (const eid of ['char_dunmore_001', 'char_corvane_001', 'char_solenne_001']) {
      for (const [px, ex] of [[20, 20], [340, 340], [180, 190], [20, 30], [330, 340]]) {
        for (const rot of [0, -1.35]) {
          const pe = silhouetteExtent(rot, 1, 1, 0, false, shapeBounds(FIGHTER_SHAPES[pid]));
          const ee = silhouetteExtent(-rot, 1.12, -1, 0, false, Object.fromEntries(Object.entries(shapeBounds(FIGHTER_SHAPES[eid])).map(([k, v]) => [k, v * 1.12])));
          const f = placeFighters({ x: px, ...pe }, { x: ex, ...ee }, W, 2, 62);
          if (f.px - pe.left < 0 || f.ex + ee.right > W) bad.push(`${pid}/${eid} ${px},${ex} rot ${rot}`);
          const lab = placeNameLabels({ x: f.px, w: 9 * 7 + 6 }, { x: f.ex, w: 9 * 14 + 6 }, W, 4, 8);
          if (lab.px + (9 * 7 + 6) / 2 + 8 > lab.ex - (9 * 14 + 6) / 2 + 0.01) bad.push(`labels ${pid}/${eid} ${px},${ex}`);
        }
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});
