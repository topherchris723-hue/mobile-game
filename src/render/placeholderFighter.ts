import { Container, Graphics } from 'pixi.js';
import type { FighterLook } from '../config/placeholderFighters';
import { CHARACTER } from '../config/palette';
import { lerp } from '../core/math';
import { celShadow, mixColor } from './color';

/*
 * Code-drawn PLACEHOLDER Sovereign (see docs/assets.md). Drawn facing right with the feet at
 * (0, 0) and about 360 units tall, matching the battle sprite spec in art-style.md §10.2, so
 * real sprite sheets can replace it without changing how the arena positions fighters.
 * Light comes from the upper left: cel shadows sit on the right of each part, the gold rim on the left.
 */

type Point = readonly [number, number];

const OUTLINE_WIDTH = 3;
const RIM_WIDTH = 2;
const SHADOW_FRACTION = 0.38;
const BOOT_COLOR = mixColor(CHARACTER.outline, 0x34427c, 0.45);

function flat(points: readonly Point[]): number[] {
  return points.flatMap(([x, y]) => [x, y]);
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

/** A four-cornered body part (top-left, top-right, bottom-right, bottom-left) with cel shading. */
function celQuad(g: Graphics, corners: readonly [Point, Point, Point, Point], base: number): void {
  const [tl, tr, br, bl] = corners;
  g.poly(flat(corners)).fill({ color: base });
  const shadowTop = lerpPoint(tl, tr, 1 - SHADOW_FRACTION);
  const shadowBottom = lerpPoint(bl, br, 1 - SHADOW_FRACTION);
  g.poly(flat([shadowTop, tr, br, shadowBottom])).fill({ color: celShadow(base) });
  g.moveTo(tl[0] + RIM_WIDTH, tl[1] + 2)
    .lineTo(bl[0] + RIM_WIDTH, bl[1] - 2)
    .stroke({ width: RIM_WIDTH, color: CHARACTER.rimLight, alpha: 0.85 });
  g.poly(flat(corners)).stroke({ width: OUTLINE_WIDTH, color: CHARACTER.outline, join: 'round' });
}

/** Limb segment hanging straight down from its joint at (0, 0). */
function limb(g: Graphics, length: number, topWidth: number, bottomWidth: number, color: number) {
  const t = topWidth / 2;
  const b = bottomWidth / 2;
  celQuad(
    g,
    [
      [-t, -4],
      [t, -4],
      [b, length],
      [-b, length],
    ],
    color,
  );
}

function outlinedPoly(g: Graphics, points: readonly Point[], color: number): void {
  g.poly(flat(points))
    .fill({ color })
    .stroke({ width: OUTLINE_WIDTH, color: CHARACTER.outline, join: 'round' });
}

interface Arm {
  readonly upper: Container;
  readonly fore: Container;
}

function buildArm(look: FighterLook, isFront: boolean): Arm {
  const tone = isFront ? look.outfit : celShadow(look.outfit);
  const upper = new Container();
  const upperArt = new Graphics();
  limb(upperArt, 76, 30, 23, tone);
  upper.addChild(upperArt);

  const fore = new Container();
  fore.position.set(0, 70);
  const foreArt = new Graphics();
  limb(foreArt, 62, 23, 19, isFront ? look.skin : celShadow(look.skin));
  // Hand wrap in the type colour, then the fist.
  foreArt
    .rect(-11, 48, 22, 12)
    .fill({ color: look.accent })
    .stroke({ width: 2, color: CHARACTER.outline });
  foreArt
    .circle(0, 70, 14)
    .fill({ color: isFront ? look.skin : celShadow(look.skin) })
    .stroke({ width: OUTLINE_WIDTH, color: CHARACTER.outline });
  fore.addChild(foreArt);
  upper.addChild(fore);
  return { upper, fore };
}

function buildLeg(look: FighterLook, isFront: boolean): Graphics {
  const g = new Graphics();
  const tone = isFront ? look.legs : celShadow(look.legs);
  const hipX = isFront ? 14 : -14;
  const kneeX = isFront ? 34 : -30;
  const ankleX = isFront ? 40 : -26;
  celQuad(
    g,
    [
      [hipX - 20, -196],
      [hipX + 20, -196],
      [kneeX + 14, -96],
      [kneeX - 14, -96],
    ],
    tone,
  );
  celQuad(
    g,
    [
      [kneeX - 14, -100],
      [kneeX + 14, -100],
      [ankleX + 11, -22],
      [ankleX - 11, -22],
    ],
    tone,
  );
  // Boot, pointing forward.
  celQuad(
    g,
    [
      [ankleX - 12, -30],
      [ankleX + 10, -30],
      [ankleX + 28, 0],
      [ankleX - 14, 0],
    ],
    isFront ? BOOT_COLOR : celShadow(BOOT_COLOR),
  );
  return g;
}

function buildHead(look: FighterLook): Container {
  const head = new Container();
  head.position.set(2, -312);
  const g = new Graphics();
  // Neck.
  celQuad(
    g,
    [
      [-9, -8],
      [9, -8],
      [9, 12],
      [-9, 12],
    ],
    look.skin,
  );
  // Back hair mass sits behind the face.
  if (look.hairStyle === 'ponytail') {
    outlinedPoly(
      g,
      [
        [-14, -46],
        [-40, -34],
        [-70, -6],
        [-62, 4],
        [-36, -14],
        [-18, -20],
      ],
      look.hair,
    );
  }
  // Face: shadow ellipse, then the lit face offset left leaves a crescent of shadow on the right.
  g.ellipse(4, -28, 22, 26).fill({ color: celShadow(look.skin) });
  g.ellipse(0, -30, 19, 24).fill({ color: look.skin });
  g.ellipse(4, -28, 22, 26).stroke({ width: OUTLINE_WIDTH, color: CHARACTER.outline });
  // Eye (facing right) with a small highlight.
  g.rect(12, -34, 6, 8).fill({ color: look.eye });
  g.rect(13, -33, 2, 2).fill({ color: 0xffffff });

  const hairPoints: Point[] =
    look.hairStyle === 'spikes'
      ? [
          [-20, -26],
          [-40, -42],
          [-22, -50],
          [-34, -72],
          [-10, -62],
          [-4, -86],
          [10, -62],
          [28, -74],
          [24, -50],
          [30, -40],
          [14, -44],
          [-4, -40],
        ]
      : [
          [-20, -24],
          [-24, -50],
          [-6, -60],
          [16, -58],
          [28, -44],
          [24, -38],
          [6, -46],
          [-8, -40],
        ];
  outlinedPoly(g, hairPoints, look.hair);
  head.addChild(g);
  return head;
}

function buildTorso(look: FighterLook): Graphics {
  const g = new Graphics();
  celQuad(
    g,
    [
      [-46, -304],
      [46, -304],
      [30, -200],
      [-30, -200],
    ],
    look.outfit,
  );
  // Lapel line and belt in the type colour.
  g.moveTo(-14, -300)
    .lineTo(6, -240)
    .lineTo(20, -300)
    .stroke({ width: 3, color: CHARACTER.outline });
  g.rect(-33, -210, 66, 20)
    .fill({ color: look.accent })
    .stroke({ width: OUTLINE_WIDTH, color: CHARACTER.outline });
  return g;
}

function buildBackFeature(look: FighterLook): Container {
  const feature = new Container();
  const g = new Graphics();
  const shadowTone = celShadow(look.feature === 'cape' ? look.legs : look.outfit);
  if (look.feature === 'cape') {
    feature.position.set(0, -298);
    outlinedPoly(
      g,
      [
        [-30, -4],
        [22, -4],
        [-6, 60],
        [-34, 150],
        [-60, 214],
        [-78, 196],
        [-92, 226],
        [-108, 200],
        [-118, 222],
        [-110, 120],
        [-62, 30],
      ],
      shadowTone,
    );
  } else {
    feature.position.set(0, -206);
    outlinedPoly(
      g,
      [
        [-24, 0],
        [16, 0],
        [-8, 70],
        [-40, 150],
        [-66, 140],
        [-50, 60],
      ],
      shadowTone,
    );
  }
  feature.addChild(g);
  return feature;
}

export interface PlaceholderFighterView {
  readonly root: Container;
  /** Pose for this frame. `guardBlend` 0–1, `stepPulse` 0–1 (peaks mid-step). */
  pose(timeSec: number, guardBlend: number, stepPulse: number): void;
}

const IDLE_POSE = { frontUpper: -0.55, frontFore: -1.75, backUpper: -0.15, backFore: -1.95 };
const GUARD_POSE = { frontUpper: -1.05, frontFore: -2.3, backUpper: -0.85, backFore: -2.45 };

export function createPlaceholderFighter(look: FighterLook, phase: number): PlaceholderFighterView {
  const root = new Container();
  const body = new Container();
  const backFeature = buildBackFeature(look);
  const backArm = buildArm(look, false);
  const frontArm = buildArm(look, true);
  backArm.upper.position.set(-32, -290);
  frontArm.upper.position.set(34, -290);
  const head = buildHead(look);

  body.addChild(backFeature, backArm.upper, buildTorso(look), head, frontArm.upper);
  root.addChild(buildLeg(look, false), buildLeg(look, true), body);

  return {
    root,
    pose(timeSec, guardBlend, stepPulse) {
      const t = timeSec + phase;
      const breath = Math.sin(t * 2.4);
      body.position.y = breath * 2.5 + stepPulse * 6;
      head.rotation = Math.sin(t * 1.2) * 0.03;
      backFeature.rotation = Math.sin(t * 1.7) * 0.05 - stepPulse * 0.12;

      const g = guardBlend;
      frontArm.upper.rotation =
        lerp(IDLE_POSE.frontUpper, GUARD_POSE.frontUpper, g) + breath * 0.03;
      frontArm.fore.rotation = lerp(IDLE_POSE.frontFore, GUARD_POSE.frontFore, g) - breath * 0.04;
      backArm.upper.rotation = lerp(IDLE_POSE.backUpper, GUARD_POSE.backUpper, g) - breath * 0.02;
      backArm.fore.rotation = lerp(IDLE_POSE.backFore, GUARD_POSE.backFore, g);
    },
  };
}
