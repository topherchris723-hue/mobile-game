import { Container, Graphics } from 'pixi.js';
import type { FighterLook } from '../config/placeholderFighters';
import { CHARACTER } from '../config/palette';
import { celShadow, mixColor } from './color';

/*
 * Code-drawn PLACEHOLDER Sovereign (docs/assets.md), drawn once and baked into a texture by the
 * caller, then animated exactly like a real battle illustration (art-style.md §10.2,
 * decisions/0006). Facing right, feet at (0, 0), about 390 units tall (~6.5 heads).
 * Light comes from the upper left: cel shadows sit on the right of each form, a gold rim on the left.
 */

type Point = readonly [number, number];

const OUTLINE = CHARACTER.outline;
const OUTLINE_WIDTH = 3.5;
const BOOT_COLOR = mixColor(CHARACTER.outline, 0x34427c, 0.45);

/** Path command: a point, or a quadratic curve [control, end]. */
type PathStep = Point | readonly [Point, Point];

function trace(g: Graphics, steps: readonly PathStep[]): Graphics {
  const [first, ...rest] = steps;
  if (!first || !isPoint(first)) throw new Error('A path must start with a point');
  g.moveTo(first[0], first[1]);
  for (const step of rest) {
    if (isPoint(step)) g.lineTo(step[0], step[1]);
    else g.quadraticCurveTo(step[0][0], step[0][1], step[1][0], step[1][1]);
  }
  return g.closePath();
}

function isPoint(step: PathStep): step is Point {
  return typeof step[0] === 'number';
}

function fillOutlined(g: Graphics, steps: readonly PathStep[], color: number): void {
  trace(g, steps).fill({ color }).stroke({ width: OUTLINE_WIDTH, color: OUTLINE, join: 'round' });
}

function fillOnly(g: Graphics, steps: readonly PathStep[], color: number, alpha = 1): void {
  trace(g, steps).fill({ color, alpha });
}

/**
 * Rounded limb segment from `a` to `b`: outline, violet shadow body, lit core shifted toward the
 * light, and a thin gold rim on the lit edge.
 */
function capsule(g: Graphics, a: Point, b: Point, width: number, color: number): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  // Unit normal pointing toward the light (negative x).
  let nx = -dy / length;
  let ny = dx / length;
  if (nx > 0) {
    nx = -nx;
    ny = -ny;
  }
  const line = (offset: number, w: number, c: number, alpha = 1): void => {
    g.moveTo(a[0] + nx * offset, a[1] + ny * offset)
      .lineTo(b[0] + nx * offset, b[1] + ny * offset)
      .stroke({ width: w, color: c, alpha, cap: 'round' });
  };
  line(0, width + OUTLINE_WIDTH * 2, OUTLINE);
  line(0, width, celShadow(color));
  line(width * 0.16, width * 0.66, color);
  line(width * 0.4, 2, CHARACTER.rimLight, 0.8);
}

function drawCape(g: Graphics, look: FighterLook): void {
  const cape = mixColor(look.legs, OUTLINE, 0.25);
  fillOutlined(
    g,
    [
      [-30, -282],
      [
        [-72, -206],
        [-94, -84],
      ],
      [-76, -98],
      [-68, -60],
      [-52, -86],
      [-38, -48],
      [-26, -92],
      [
        [-10, -186],
        [14, -284],
      ],
    ],
    cape,
  );
  // Folds.
  g.moveTo(-40, -240)
    .quadraticCurveTo(-58, -170, -60, -96)
    .stroke({ width: 2.5, color: celShadow(cape) });
  g.moveTo(-22, -236)
    .quadraticCurveTo(-34, -160, -40, -70)
    .stroke({ width: 2.5, color: celShadow(cape) });
}

function drawCoatTails(g: Graphics, look: FighterLook): void {
  const coat = celShadow(look.outfit);
  fillOutlined(
    g,
    [
      [-26, -206],
      [
        [-48, -140],
        [-62, -66],
      ],
      [-44, -78],
      [-30, -56],
      [
        [-6, -120],
        [10, -204],
      ],
    ],
    coat,
  );
}

function drawHairBack(g: Graphics, look: FighterLook): void {
  const hair = celShadow(look.hair);
  if (look.hairStyle === 'ponytail') {
    fillOutlined(
      g,
      [
        [-18, -352],
        [
          [-62, -352],
          [-74, -302],
        ],
        [
          [-72, -270],
          [-84, -238],
        ],
        [
          [-56, -262],
          [-50, -300],
        ],
        [
          [-40, -330],
          [-14, -336],
        ],
      ],
      hair,
    );
  } else {
    fillOutlined(
      g,
      [
        [-18, -352],
        [-54, -336],
        [-40, -318],
        [-58, -298],
        [-30, -302],
        [-20, -292],
      ],
      hair,
    );
  }
}

function drawFace(g: Graphics, look: FighterLook): void {
  const skinShadow = celShadow(look.skin);
  // Neck.
  capsule(g, [2, -302], [3, -282], 16, look.skin);
  // Face: rounded skull, pointed anime chin toward the front.
  fillOutlined(
    g,
    [
      [-18, -344],
      [
        [6, -360],
        [28, -340],
      ],
      [
        [34, -318],
        [28, -302],
      ],
      [
        [22, -290],
        [10, -288],
      ],
      [
        [-8, -292],
        [-18, -306],
      ],
      [
        [-26, -326],
        [-18, -344],
      ],
    ],
    look.skin,
  );
  // Jaw shadow (away from the light) and hair shadow across the forehead.
  fillOnly(
    g,
    [
      [22, -336],
      [
        [33, -318],
        [27, -302],
      ],
      [
        [22, -292],
        [12, -289],
      ],
      [
        [25, -302],
        [22, -336],
      ],
    ],
    skinShadow,
  );
  fillOnly(
    g,
    [
      [-14, -342],
      [28, -342],
      [28, -333],
      [-12, -331],
    ],
    skinShadow,
    0.8,
  );
  // Ear.
  g.ellipse(-8, -316, 5, 7).fill({ color: look.skin }).stroke({ width: 2.5, color: OUTLINE });

  // Large anime eye: white, iris, pupil, highlight, heavy upper lash, determined brow.
  const iris = look.eye === OUTLINE ? mixColor(look.accent, OUTLINE, 0.35) : look.eye;
  g.ellipse(15, -320, 6.5, 8).fill({ color: 0xffffff });
  g.ellipse(17, -319, 4.6, 6.6).fill({ color: iris });
  g.ellipse(17.6, -318, 2.1, 3.2).fill({ color: OUTLINE });
  g.circle(15.4, -322.5, 1.8).fill({ color: 0xffffff });
  g.moveTo(7.5, -326.5)
    .quadraticCurveTo(15, -332, 23.5, -326)
    .stroke({ width: 3.4, color: OUTLINE, cap: 'round' });
  g.moveTo(8, -335)
    .lineTo(24, -331)
    .stroke({ width: 3, color: mixColor(look.hair, OUTLINE, 0.6), cap: 'round' });
  // Nose and mouth.
  g.moveTo(27, -313).lineTo(29, -308).stroke({ width: 1.6, color: skinShadow });
  g.moveTo(17, -298).lineTo(23, -299).stroke({ width: 2, color: OUTLINE, cap: 'round' });
}

function drawHairFront(g: Graphics, look: FighterLook): void {
  if (look.hairStyle === 'ponytail') {
    fillOutlined(
      g,
      [
        [-26, -322],
        [
          [-34, -352],
          [-10, -364],
        ],
        [
          [16, -370],
          [32, -350],
        ],
        [34, -330],
        [26, -338],
        [20, -326],
        [12, -338],
        [4, -326],
        [-4, -340],
        [-14, -328],
      ],
      look.hair,
    );
  } else {
    fillOutlined(
      g,
      [
        [-28, -326],
        [-46, -344],
        [-26, -350],
        [-40, -378],
        [-12, -366],
        [-6, -394],
        [10, -368],
        [30, -386],
        [28, -360],
        [46, -358],
        [30, -344],
        [34, -326],
        [24, -334],
        [18, -322],
        [10, -336],
        [2, -324],
        [-6, -338],
        [-14, -326],
        [-20, -336],
      ],
      look.hair,
    );
  }
  // Glossy highlight streak on the lit side.
  g.moveTo(-14, -356)
    .quadraticCurveTo(-2, -364, 12, -358)
    .stroke({ width: 3, color: mixColor(look.hair, 0xffffff, 0.45), alpha: 0.7, cap: 'round' });
}

function drawTorso(g: Graphics, look: FighterLook): void {
  fillOutlined(
    g,
    [
      [-30, -284],
      [
        [4, -298],
        [38, -282],
      ],
      [
        [38, -236],
        [26, -204],
      ],
      [-24, -204],
      [
        [-36, -244],
        [-30, -284],
      ],
    ],
    look.outfit,
  );
  fillOnly(
    g,
    [
      [16, -292],
      [38, -282],
      [
        [38, -236],
        [26, -204],
      ],
      [10, -204],
      [
        [22, -246],
        [16, -292],
      ],
    ],
    celShadow(look.outfit),
  );
  // Inner shirt / lapels.
  fillOutlined(
    g,
    [
      [-6, -290],
      [10, -248],
      [24, -290],
    ],
    look.legs,
  );
  // Rim light down the lit side of the torso.
  g.moveTo(-27, -278)
    .quadraticCurveTo(-33, -244, -22, -210)
    .stroke({ width: 2, color: CHARACTER.rimLight, alpha: 0.85 });
  // Sash in the type colour, knotted, with tails flowing back.
  fillOutlined(
    g,
    [
      [-12, -200],
      [-42, -170],
      [-48, -146],
      [-30, -158],
      [-16, -188],
    ],
    celShadow(look.accent),
  );
  g.rect(-27, -214, 56, 18)
    .fill({ color: look.accent })
    .stroke({ width: OUTLINE_WIDTH, color: OUTLINE });
  g.circle(-6, -205, 7)
    .fill({ color: celShadow(look.accent) })
    .stroke({ width: 2.5, color: OUTLINE });
}

function drawBoot(g: Graphics, ankle: Point, color: number): void {
  const [x, y] = ankle;
  fillOutlined(
    g,
    [
      [x - 14, y - 12],
      [x + 12, y - 12],
      [
        [x + 18, y + 18],
        [x + 30, y + 26],
      ],
      [x + 30, y + 30],
      [x - 16, y + 30],
      [x - 16, y + 14],
    ],
    color,
  );
}

/** Builds the full figure as one Container, ready to be baked into a texture. */
export function drawPlaceholderFighter(look: FighterLook): Container {
  const root = new Container();
  const g = new Graphics();
  root.addChild(g);

  if (look.feature === 'cape') drawCape(g, look);
  else drawCoatTails(g, look);
  drawHairBack(g, look);

  // Back limbs are a shade darker: they sit further from the light.
  const backSleeve = celShadow(look.outfit);
  const backSkin = celShadow(look.skin);
  capsule(g, [-20, -270], [-6, -222], 24, backSleeve);
  capsule(g, [-6, -222], [20, -246], 20, backSkin);
  g.circle(24, -248, 13).fill({ color: backSkin }).stroke({ width: OUTLINE_WIDTH, color: OUTLINE });

  const backLegs = celShadow(look.legs);
  capsule(g, [-6, -196], [-20, -112], 30, backLegs);
  capsule(g, [-20, -112], [-16, -34], 26, backLegs);
  drawBoot(g, [-16, -30], celShadow(BOOT_COLOR));
  capsule(g, [14, -196], [30, -114], 32, look.legs);
  capsule(g, [30, -114], [38, -34], 27, look.legs);
  drawBoot(g, [40, -30], BOOT_COLOR);

  drawTorso(g, look);
  drawFace(g, look);
  drawHairFront(g, look);

  // Front arm raised in a ready stance, wrist wrapped in the type colour.
  capsule(g, [28, -272], [50, -236], 26, look.outfit);
  capsule(g, [50, -236], [66, -262], 21, look.skin);
  capsule(g, [58, -250], [64, -260], 23, look.accent);
  g.circle(70, -268, 14)
    .fill({ color: look.skin })
    .stroke({ width: OUTLINE_WIDTH, color: OUTLINE });
  g.moveTo(64, -274)
    .quadraticCurveTo(70, -280, 76, -274)
    .stroke({ width: 2, color: celShadow(look.skin) });

  return root;
}
