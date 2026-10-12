import { FLOOR_TOP_Y, LANES } from '../config/arena';
import { SKY, WORLD } from '../config/palette';
import type { Rng } from '../core/rng';
import { battleBackground, mixColor, toCss } from './color';

/*
 * PLACEHOLDER arena backdrop for the Nexus, painted procedurally with Canvas 2D (docs/assets.md).
 * It follows art-style.md §7: painterly golden-hour sky, cumulus with warm tops and violet
 * undersides, atmospheric fade on distant islands, the Nexus citadel on the horizon, and a calm
 * three-lane floor. All colours pass through battleBackground() for battle readability.
 * Coordinates are logical units: the canvas context must already be scaled to logical space.
 */

export interface BackdropLayout {
  readonly citadelX: number;
  readonly citadelBaseY: number;
  readonly citadelTopY: number;
  readonly haloY: number;
  readonly haloRadiusX: number;
  readonly haloRadiusY: number;
}

export function computeBackdropLayout(width: number): BackdropLayout {
  const citadelBaseY = 300;
  return {
    citadelX: width * 0.52,
    citadelBaseY,
    citadelTopY: citadelBaseY - 210,
    haloY: citadelBaseY - 120,
    haloRadiusX: 92,
    haloRadiusY: 20,
  };
}

const bg = (color: number, alpha = 1): string => toCss(battleBackground(color), alpha);

function verticalGradient(
  ctx: CanvasRenderingContext2D,
  top: number,
  bottom: number,
  stops: readonly (readonly [number, string])[],
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, top, 0, bottom);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  return gradient;
}

interface Puff {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/**
 * Paints `draw` into an offscreen layer and composites it with one blur pass. Soft edges make
 * clouds read as painted rather than geometric (style guide §7); blurring the finished layer once
 * is far cheaper than blurring every individual shape.
 */
function paintSoftLayer(
  ctx: CanvasRenderingContext2D,
  blurUnits: number,
  draw: (layer: CanvasRenderingContext2D) => void,
): void {
  const layerCanvas = document.createElement('canvas');
  layerCanvas.width = ctx.canvas.width;
  layerCanvas.height = ctx.canvas.height;
  const layer = layerCanvas.getContext('2d');
  if (!layer) throw new Error('Canvas 2D is unavailable');
  const transform = ctx.getTransform();
  layer.setTransform(transform);
  draw(layer);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = `blur(${(blurUnits * transform.a).toFixed(2)}px)`;
  ctx.drawImage(layerCanvas, 0, 0);
  ctx.restore();
  layerCanvas.width = 0; // release the pixel buffer promptly on low-memory phones
}

/**
 * Cumulus with a flat base: a violet-grey body first, then many overlapping warm-lit puffs
 * offset upward so the shadowed underside shows (style guide §6.1).
 */
function paintCumulus(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  baseY: number,
  width: number,
  height: number,
  rng: Rng,
): void {
  const puffs: Puff[] = [];
  const count = Math.max(8, Math.round(width / 14));
  for (let i = 0; i < count; i++) {
    const rel = rng.range(-1, 1);
    const crown = 1 - Math.pow(Math.abs(rel), 1.4);
    const r = height * rng.range(0.16, 0.26) * (0.75 + crown * 0.5);
    puffs.push({
      x: centerX + rel * width * 0.5,
      y: baseY - r * 0.6 - crown * height * rng.range(0.35, 0.75),
      r,
    });
  }
  puffs.sort((a, b) => b.y - a.y);

  ctx.save();
  ctx.beginPath();
  ctx.rect(centerX - width, 0, width * 2, baseY);
  ctx.clip();
  ctx.fillStyle = bg(mixColor(SKY.cloudShadowCool, SKY.violetShadow, 0.22));
  for (const p of puffs) {
    ctx.beginPath();
    ctx.arc(p.x, p.y + p.r * 0.35, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of puffs) {
    const light = ctx.createRadialGradient(
      p.x - p.r * 0.35,
      p.y - p.r * 0.5,
      p.r * 0.05,
      p.x,
      p.y,
      p.r * 1.05,
    );
    light.addColorStop(0, bg(SKY.cloudLight));
    light.addColorStop(0.55, bg(SKY.cloudShadowWarm));
    light.addColorStop(1, bg(SKY.cloudShadowCool, 0));
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(p.x, p.y - p.r * 0.12, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Thin, high stratus streak lit from below by the low sun. */
function paintWisp(ctx: CanvasRenderingContext2D, x: number, y: number, length: number): void {
  ctx.save();
  ctx.fillStyle = bg(SKY.cloudShadowWarm, 0.45);
  ctx.beginPath();
  ctx.ellipse(x, y, length / 2, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bg(SKY.cloudLight, 0.35);
  ctx.beginPath();
  ctx.ellipse(x + length * 0.1, y + 2, length * 0.3, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Small floating island, faded toward the sky by `atmosphere` (0 near … 1 lost in haze). */
function paintFloatingIsland(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  atmosphere: number,
  rng: Rng,
): void {
  const haze = (color: number): string => bg(mixColor(color, SKY.high, atmosphere));
  const half = size / 2;
  ctx.beginPath();
  ctx.moveTo(x - half, y);
  const jag = 5;
  for (let i = 1; i < jag; i++) {
    const t = i / jag;
    ctx.lineTo(x - half + t * half * 0.9 + rng.range(-4, 4), y + t * size * 0.9 + rng.range(-3, 3));
  }
  ctx.lineTo(x + rng.range(-6, 6), y + size * 1.05);
  for (let i = jag - 1; i > 0; i--) {
    const t = i / jag;
    ctx.lineTo(x + half - t * half * 0.9 + rng.range(-4, 4), y + t * size * 0.9 + rng.range(-3, 3));
  }
  ctx.lineTo(x + half, y);
  ctx.closePath();
  ctx.fillStyle = verticalGradient(ctx, y, y + size, [
    [0, haze(WORLD.ocean.secondary)],
    [1, haze(SKY.mountainIndigo)],
  ]);
  ctx.fill();
  ctx.fillStyle = haze(WORLD.clans.dominant);
  ctx.beginPath();
  ctx.ellipse(x, y, half * 1.02, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = haze(WORLD.clans.accent);
  ctx.beginPath();
  ctx.ellipse(x - half * 0.25, y - size * 0.03, half * 0.6, size * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** The Nexus citadel: a cluster of crystal spires, lit from the left (style guide §1, §6.2). */
function paintCitadel(ctx: CanvasRenderingContext2D, layout: BackdropLayout, rng: Rng): void {
  const { citadelX: cx, citadelBaseY: baseY } = layout;
  paintFloatingIsland(ctx, cx, baseY, 230, 0.3, rng);
  const spires: readonly (readonly [number, number, number])[] = [
    [-78, 70, 22],
    [62, 84, 24],
    [-48, 118, 26],
    [36, 132, 28],
    [-20, 168, 30],
    [16, 184, 30],
    [0, 210, 40],
  ];
  const atmosphere = 0.32;
  const lit = bg(mixColor(SKY.cloudLight, WORLD.nexus.dominant, 0.35 + atmosphere * 0.2));
  const shade = bg(mixColor(WORLD.nexus.dominant, SKY.mountainIndigo, 0.35));
  for (const [dx, height, width] of spires) {
    const x = cx + dx;
    const top = baseY - height;
    ctx.fillStyle = lit;
    ctx.beginPath();
    ctx.moveTo(x - width / 2, baseY + 4);
    ctx.lineTo(x, top);
    ctx.lineTo(x, baseY + 4);
    ctx.fill();
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + width / 2, baseY + 4);
    ctx.lineTo(x, baseY + 4);
    ctx.fill();
  }
}

/** Static sky layer: everything behind the animated Rift beams. */
export function paintSkyLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rng: Rng,
): void {
  const layout = computeBackdropLayout(width);

  ctx.fillStyle = verticalGradient(ctx, 0, height, [
    [0, bg(SKY.deep)],
    [0.42, bg(SKY.mid)],
    [0.62, bg(SKY.high)],
    [0.74, bg(SKY.cloudShadowWarm)],
    [0.82, bg(SKY.goldenGlow)],
  ]);
  ctx.fillRect(0, 0, width, height);

  // Low golden-hour sun behind the citadel, slightly right as in the reference.
  const sunX = layout.citadelX + 70;
  const sunY = 420;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 360);
  glow.addColorStop(0, bg(SKY.cloudLight, 0.95));
  glow.addColorStop(0.18, bg(SKY.goldenGlow, 0.7));
  glow.addColorStop(1, bg(SKY.goldenGlow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // High stratus wisps.
  paintSoftLayer(ctx, 6, (layer) => {
    for (let i = 0; i < 6; i++) {
      paintWisp(layer, rng.range(0, width), rng.range(60, 200), rng.range(180, 420));
    }
  });

  // Distant floating islands, kept clear of the citadel.
  for (let i = 0; i < 7; i++) {
    let x = rng.range(40, width - 40);
    if (Math.abs(x - layout.citadelX) < 170) x += x < layout.citadelX ? -170 : 170;
    paintFloatingIsland(ctx, x, rng.range(150, 330), rng.range(26, 62), rng.range(0.45, 0.7), rng);
  }

  paintCitadel(ctx, layout, rng);

  // Horizon cloud bank: tall at the edges to frame the scene, lower in the middle.
  const bankBase = FLOOR_TOP_Y + 20;
  paintSoftLayer(ctx, 2.5, (layer) => {
    paintCumulus(layer, width * 0.08, bankBase, width * 0.42, 220, rng);
    paintCumulus(layer, width * 0.94, bankBase, width * 0.4, 240, rng);
    paintCumulus(layer, width * 0.5, bankBase, width * 0.7, 120, rng);
  });
}

/** Static arena floor: transparent above the platform edge. */
export function paintGroundLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rng: Rng,
): void {
  const stone = WORLD.ocean.secondary;
  const edge: number[] = [];
  const segments = Math.ceil(width / 40);
  for (let i = 0; i <= segments; i++) edge.push(FLOOR_TOP_Y + rng.range(-5, 5));

  const tracePlatform = (): void => {
    ctx.beginPath();
    ctx.moveTo(0, edge[0] ?? FLOOR_TOP_Y);
    edge.forEach((y, i) => {
      ctx.lineTo((i / segments) * width, y);
    });
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
  };

  tracePlatform();
  ctx.fillStyle = verticalGradient(ctx, FLOOR_TOP_Y, height, [
    [0, bg(mixColor(stone, SKY.goldenGlow, 0.35))],
    [0.35, bg(stone)],
    [1, bg(mixColor(stone, SKY.violetShadow, 0.6))],
  ]);
  ctx.fill();

  // Lane dividers and a faint lit band per lane: readable but calm (style guide §7).
  for (let i = 0; i < LANES.length; i++) {
    const lane = LANES[i];
    if (!lane) continue;
    const prev = LANES[i - 1];
    const top = prev ? (prev.floorY + lane.floorY) / 2 : FLOOR_TOP_Y + 8;
    const next = LANES[i + 1];
    const bottom = next ? (lane.floorY + next.floorY) / 2 : height;
    ctx.fillStyle = bg(SKY.cloudLight, i % 2 === 0 ? 0.07 : 0.03);
    ctx.fillRect(0, top, width, bottom - top);
    if (next) {
      ctx.strokeStyle = bg(SKY.violetShadow, 0.22);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, bottom);
      ctx.lineTo(width, bottom);
      ctx.stroke();
    }
  }

  // Worn stone cracks.
  ctx.strokeStyle = bg(SKY.violetShadow, 0.18);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 26; i++) {
    let x = rng.range(0, width);
    let y = rng.range(FLOOR_TOP_Y + 20, height);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 3; s++) {
      x += rng.range(-22, 22);
      y += rng.range(-6, 6);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Short, irregular grass blades along the edge, mostly sunlit (no tree-like rows).
  const bladeCount = Math.round(width / 6);
  for (let i = 0; i < bladeCount; i++) {
    const x = rng.range(0, width);
    const segment = Math.min(segments, Math.max(0, Math.round((x / width) * segments)));
    const y = edge[segment] ?? FLOOR_TOP_Y;
    const h = rng.range(2, 7);
    const lean = rng.range(-3, 3);
    ctx.fillStyle = bg(
      mixColor(WORLD.clans.dominant, WORLD.clans.accent, rng.range(0.2, 0.7)),
      rng.range(0.6, 0.95),
    );
    ctx.beginPath();
    ctx.moveTo(x - 2, y + 3);
    ctx.lineTo(x + lean, y - h);
    ctx.lineTo(x + 2, y + 3);
    ctx.fill();
  }
  ctx.strokeStyle = bg(SKY.goldenGlow, 0.75);
  ctx.lineWidth = 2;
  ctx.beginPath();
  edge.forEach((y, i) => {
    const x = (i / segments) * width;
    if (i === 0) ctx.moveTo(x, y + 2);
    else ctx.lineTo(x, y + 2);
  });
  ctx.stroke();
}
