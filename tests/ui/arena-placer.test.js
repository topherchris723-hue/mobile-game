// ui-developer round 3, BUG-2-11 / hard rule L-ui-003: fighters and name labels at the worst positions with the
// longest names in data. Pure placer functions (src/ui/float-placer.js), no Phaser.
import { describe, it, expect } from 'vitest';
import { silhouetteExtent, placeFighters, placeNameLabels } from '../../src/ui/float-placer.js';
import { battleLayout, arenaToScreen } from '../../src/ui/layout.js';
import { readJson } from '../helpers/load-data.js';

const characters = readJson('data/characters.json').characters;
const enemies = readJson('data/enemies.json').enemies;
const battle = readJson('data/battle.json');
const L = battleLayout(640);
const W = L.W;
const AW = battle.arena.width;
const MELEE = battle.arena.melee_range !== undefined ? battle.arena.melee_range : 12;

// Upper bound for a 13 px bold label with a 3 px stroke (real Canvas widths are ~7–8 px per char).
const labelW = (name) => name.length * 9 + 6;
const playerNames = characters.filter((c) => c.playable !== false).map((c) => c.name);
const enemyNames = enemies.map((e) => e.name_override || characters.find((c) => c.id === e.character_id).name);
const longest = (list) => list.slice().sort((a, b) => b.length - a.length)[0];

// Poses as FighterView.pose() sets them (rot, ox) — includes Knockdown/KO lying toward the wall.
const POSES = {
  Idle: [0, 0], Windup: [0, -6], Active: [0.08, 10], Hitstun: [-0.1, -7], Knockdown: [-1.35, 0], KO: [-1.5, 0], Dashing: [0.12, 0],
};

function scene(pxArena, exArena, pPose, ePose, pName, eName, boss) {
  const pe = silhouetteExtent(POSES[pPose][0] * 1, 1, 1, POSES[pPose][1], pPose === 'Active');
  const ee = silhouetteExtent(POSES[ePose][0] * -1, boss ? 1.12 : 1, -1, POSES[ePose][1] * -1, ePose === 'Active');
  const f = placeFighters({ x: arenaToScreen(pxArena, AW, L), ...pe }, { x: arenaToScreen(exArena, AW, L), ...ee }, W, 2, 62);
  const pw = labelW(pName);
  const ew = labelW(eName);
  const lab = placeNameLabels({ x: f.px, w: pw }, { x: f.ex, w: ew }, W, 4, 8);
  return {
    pBody: [f.px - pe.left, f.px + pe.right],
    eBody: [f.ex - ee.left, f.ex + ee.right],
    pLab: [lab.px - pw / 2, lab.px + pw / 2],
    eLab: [lab.ex - ew / 2, lab.ex + ew / 2],
  };
}

/** Problems: anything off screen, labels touching. */
export function problems(s) {
  const out = [];
  for (const k of ['pBody', 'eBody', 'pLab', 'eLab']) if (s[k][0] < 0 || s[k][1] > W) out.push(k + ' off screen ' + s[k].map((v) => v.toFixed(1)).join('..'));
  if (s.pLab[1] > s.eLab[0]) out.push('labels overlap ' + (s.pLab[1] - s.eLab[0]).toFixed(1) + ' px');
  return out;
}

const POSITIONS = [];
for (let x = 0; x <= AW; x += AW / 20) {
  POSITIONS.push([x, Math.min(AW, x + MELEE)], [Math.max(0, x - MELEE), x], [x, x]); // melee / stacked
}
POSITIONS.push([0, MELEE], [AW - MELEE, AW], [AW, AW], [0, 0], [0, AW]); // both walls, extremes

describe('BUG-2-11: arena placer, longest names, worst positions and poses', () => {
  it('the data has the long names this test is about (not blind)', () => {
    expect(longest(enemyNames).length).toBeGreaterThanOrEqual('Umbral Rook'.length);
    expect(enemyNames).toContain('Umbral Rook');
  });

  it('no silhouette or label off screen, labels never overlap — every pose pair × position × longest names', () => {
    const bad = [];
    const pN = longest(playerNames);
    for (const eN of [longest(enemyNames), 'Umbral Rook', ...enemyNames]) {
      for (const [px, ex] of POSITIONS) {
        for (const pp of Object.keys(POSES)) {
          for (const ep of Object.keys(POSES)) {
            for (const boss of [false, true]) {
              const pr = problems(scene(px, ex, pp, ep, pN, eN, boss));
              if (pr.length) bad.push(`${pN}/${eN} at ${px},${ex} ${pp}/${ep}${boss ? ' boss' : ''}: ${pr.join('; ')}`);
            }
          }
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('the fighters keep the minimum gap when there is room', () => {
    const s = placeFighters({ x: 180, left: 40, right: 40 }, { x: 181, left: 40, right: 40 }, W, 2, 62);
    expect(s.ex - s.px).toBeCloseTo(62);
    const wall = placeFighters({ x: 340, left: 40, right: 40 }, { x: 340, left: 40, right: 110 }, W, 2, 62);
    expect(wall.ex + 110).toBeLessThanOrEqual(W - 2);
    expect(wall.ex - wall.px).toBeGreaterThanOrEqual(62);
  });

  it('must-FAIL: the old placement (62 px centre gap, no clamp, labels at the sprite x) is caught', () => {
    const pN = longest(playerNames);
    const eN = 'Umbral Rook';
    const old = (pxA, exA) => {
      let px = arenaToScreen(pxA, AW, L);
      let ex = arenaToScreen(exA, AW, L);
      if (ex - px < 62) {
        const mid = Math.max(L.arena.left + 31, Math.min(L.arena.right - 31, (px + ex) / 2));
        px = mid - 31;
        ex = mid + 31;
      }
      const pe = silhouetteExtent(0, 1, 1, 0, false);
      const ee = silhouetteExtent(0, 1, -1, 0, false);
      return { pBody: [px - pe.left, px + pe.right], eBody: [ex - ee.left, ex + ee.right], pLab: [px - labelW(pN) / 2, px + labelW(pN) / 2], eLab: [ex - labelW(eN) / 2, ex + labelW(eN) / 2] };
    };
    expect(problems(old(AW / 2, AW / 2 + MELEE)).some((p) => /labels overlap/.test(p))).toBe(true);
    expect(problems(old(AW - MELEE, AW)).some((p) => /eBody off screen|eLab off screen/.test(p))).toBe(true);
  });
});
