import { SKY, WORLD } from '../config/palette';
import type { Rng } from '../core/rng';
import { battleBackground, mixColor, toCss } from './color';

/*
 * PLACEHOLDER arena backdrop for the Nexus, painted procedurally with Canvas 2D (docs/assets.md).
 * It follows art-style.md §7: painterly golden-hour sky, cumulus with warm tops and violet
 * undersides, atmospheric fade on distant islands, the Nexus citadel on the horizon, and a calm
 * battlefield floor. All colours pass through battleBackground() for battle readability.
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

/** Places the Nexus citadel above the horizon cloud bank, centred, for a portrait screen. */
export function computeBackdropLayout(width: number, floorTopY: number): BackdropLayout {
  const citadelBaseY = floorTopY - 200;
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
 * Cumulus with a flat base, lit as one mass rather than as separate balls: the whole silhouette is
 * painted in violet-grey shadow, then warm light is painted only onto the cloud (source-atop),
 * offset toward the sun, so each cloud reads as a single sculpted form (style guide §6.1).
 * Must be drawn on its own soft layer (see paintSoftLayer).
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
  const count = Math.max(10, Math.round(width / 12));
  for (let i = 0; i < count; i++) {
    const rel = rng.range(-1, 1);
    const crown = 1 - Math.pow(Math.abs(rel), 1.5);
    const r = height * rng.range(0.14, 0.3) * (0.7 + crown * 0.6);
    puffs.push({
      x: centerX + rel * width * 0.5,
      y: baseY - r * 0.5 - crown * height * rng.range(0.3, 0.8),
      r,
    });
  }

  const silhouette = (dx: number, dy: number, scale: number): void => {
    ctx.beginPath();
    for (const p of puffs) {
      ctx.moveTo(p.x + dx * p.r + p.r * scale, p.y + dy * p.r);
      ctx.arc(p.x + dx * p.r, p.y + dy * p.r, p.r * scale, 0, Math.PI * 2);
    }
    ctx.fill();
  };

  ctx.save();
  ctx.beginPath();
  ctx.rect(centerX - width, 0, width * 2, baseY);
  ctx.clip();
  // Shadowed body.
  ctx.fillStyle = bg(mixColor(SKY.cloudShadowCool, SKY.violetShadow, 0.25));
  silhouette(0, 0, 1);
  // Light only lands on the cloud itself.
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = bg(SKY.cloudShadowWarm);
  silhouette(-0.18, -0.28, 0.92);
  ctx.fillStyle = bg(SKY.cloudLight);
  silhouette(-0.3, -0.45, 0.72);
  // Thin golden rim where the low sun grazes the tops.
  ctx.fillStyle = bg(SKY.goldenGlow, 0.55);
  silhouette(-0.42, -0.62, 0.5);
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

/** Energy realm on the far left: volcanic peaks with glowing lava seams, hazed by distance. */
function paintVolcanoes(
  ctx: CanvasRenderingContext2D,
  width: number,
  horizonY: number,
  rng: Rng,
): void {
  const haze = (color: number, amount = 0.42): string => bg(mixColor(color, SKY.high, amount));
  const peaks: readonly (readonly [number, number])[] = [
    [-0.05, 0],
    [0.05, 120],
    [0.13, 70],
    [0.2, 170],
    [0.3, 95],
    [0.38, 130],
    [0.48, 20],
  ];
  ctx.beginPath();
  ctx.moveTo(0, horizonY + 20);
  for (const [fx, h] of peaks) ctx.lineTo(fx * width, horizonY - h);
  ctx.lineTo(width * 0.5, horizonY + 20);
  ctx.closePath();
  ctx.fillStyle = verticalGradient(ctx, horizonY - 170, horizonY + 20, [
    [0, haze(SKY.mountainIndigo, 0.35)],
    [1, haze(SKY.violetShadow, 0.45)],
  ]);
  ctx.fill();
  // Sunlit left faces of each peak.
  ctx.fillStyle = haze(SKY.goldenGlow, 0.55);
  for (let i = 1; i < peaks.length - 1; i++) {
    const peak = peaks[i];
    const prev = peaks[i - 1];
    if (!peak || !prev) continue;
    ctx.beginPath();
    ctx.moveTo(peak[0] * width, horizonY - peak[1]);
    ctx.lineTo(((peak[0] + prev[0]) / 2) * width, horizonY - (peak[1] + prev[1]) / 2);
    ctx.lineTo(peak[0] * width - 6, horizonY - peak[1] * 0.4);
    ctx.closePath();
    ctx.globalAlpha = 0.45;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Lava seams running down from the tallest crater, with a soft glow.
  const craterX = 0.2 * width;
  const craterY = horizonY - 170;
  const glow = ctx.createRadialGradient(craterX, craterY, 2, craterX, craterY, 60);
  glow.addColorStop(0, bg(WORLD.energy.accent, 0.55));
  glow.addColorStop(1, bg(WORLD.energy.accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(craterX - 60, craterY - 60, 120, 120);
  ctx.strokeStyle = bg(WORLD.energy.dominant, 0.9);
  ctx.lineWidth = 2;
  for (let seam = 0; seam < 3; seam++) {
    let x = craterX + rng.range(-6, 6);
    let y = craterY + 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let step = 0; step < 6; step++) {
      x += rng.range(-9, 9);
      y += rng.range(12, 22);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/** Ocean crews on the far right: a sunlit sea band and a distant clan pagoda on a sea stack. */
function paintSeaAndPagoda(
  ctx: CanvasRenderingContext2D,
  width: number,
  horizonY: number,
  rng: Rng,
): void {
  const haze = (color: number, amount = 0.4): string => bg(mixColor(color, SKY.high, amount));
  const seaTop = horizonY - 34;
  ctx.fillStyle = verticalGradient(ctx, seaTop, horizonY + 20, [
    [0, haze(WORLD.ocean.dominant, 0.55)],
    [1, haze(WORLD.ocean.shadow, 0.35)],
  ]);
  ctx.fillRect(width * 0.5, seaTop, width * 0.5, horizonY + 20 - seaTop);
  // Glints where the low sun hits the water.
  ctx.fillStyle = bg(SKY.cloudLight, 0.7);
  for (let i = 0; i < 26; i++) {
    const x = rng.range(width * 0.52, width);
    const y = rng.range(seaTop + 4, horizonY + 14);
    ctx.fillRect(x, y, rng.range(6, 18), 1.5);
  }
  // Sea stack and three-tiered pagoda.
  const px = width * 0.86;
  const stackTop = horizonY - 60;
  ctx.fillStyle = haze(SKY.mountainIndigo, 0.45);
  ctx.beginPath();
  ctx.moveTo(px - 34, horizonY + 10);
  ctx.lineTo(px - 26, stackTop);
  ctx.lineTo(px + 28, stackTop + 4);
  ctx.lineTo(px + 38, horizonY + 10);
  ctx.closePath();
  ctx.fill();
  const roof = haze(WORLD.clans.secondary, 0.4);
  const wall = haze(SKY.cloudShadowWarm, 0.3);
  for (let tier = 0; tier < 3; tier++) {
    const y = stackTop - 16 - tier * 20;
    const half = 30 - tier * 7;
    ctx.fillStyle = wall;
    ctx.fillRect(px - half * 0.55, y, half * 1.1, 14);
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(px - half, y + 2);
    ctx.lineTo(px - half * 0.5, y - 8);
    ctx.lineTo(px + half * 0.5, y - 8);
    ctx.lineTo(px + half, y + 2);
    ctx.closePath();
    ctx.fill();
  }
}

/** Faint light shafts fanning from the low sun. */
function paintSunRays(
  ctx: CanvasRenderingContext2D,
  sunX: number,
  sunY: number,
  height: number,
  rng: Rng,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const angle = -Math.PI / 2 + rng.range(-1.1, 1.1);
    const spread = rng.range(0.03, 0.07);
    const length = height;
    ctx.fillStyle = bg(SKY.cloudLight, 0.035);
    ctx.beginPath();
    ctx.moveTo(sunX, sunY);
    ctx.lineTo(sunX + Math.cos(angle - spread) * length, sunY + Math.sin(angle - spread) * length);
    ctx.lineTo(sunX + Math.cos(angle + spread) * length, sunY + Math.sin(angle + spread) * length);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** The Nexus citadel: a cluster of crystal spires, lit from the left (style guide §1, §6.2). */
function paintCitadel(ctx: CanvasRenderingContext2D, layout: BackdropLayout, rng: Rng): void {
  const { citadelX: cx, citadelBaseY: baseY } = layout;
  // Rift glow behind the spires.
  const aura = ctx.createRadialGradient(cx, baseY - 110, 10, cx, baseY - 110, 190);
  aura.addColorStop(0, bg(WORLD.nexus.dominant, 0.45));
  aura.addColorStop(1, bg(WORLD.nexus.dominant, 0));
  ctx.fillStyle = aura;
  ctx.fillRect(cx - 190, baseY - 300, 380, 380);
  paintFloatingIsland(ctx, cx, baseY, 230, 0.3, rng);
  // Waterfall spilling off the island's edge.
  ctx.fillStyle = verticalGradient(ctx, baseY, baseY + 170, [
    [0, bg(SKY.cloudLight, 0.7)],
    [1, bg(SKY.cloudLight, 0)],
  ]);
  ctx.beginPath();
  ctx.moveTo(cx + 54, baseY + 4);
  ctx.lineTo(cx + 59, baseY + 4);
  ctx.lineTo(cx + 64, baseY + 170);
  ctx.lineTo(cx + 50, baseY + 170);
  ctx.closePath();
  ctx.fill();
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
  floorTopY: number,
  rng: Rng,
): void {
  const layout = computeBackdropLayout(width, floorTopY);

  // The sky's light falls off toward the horizon at the floor edge.
  ctx.fillStyle = verticalGradient(ctx, 0, floorTopY + 40, [
    [0, bg(SKY.deep)],
    [0.45, bg(SKY.mid)],
    [0.7, bg(SKY.high)],
    [0.86, bg(SKY.cloudShadowWarm)],
    [1, bg(SKY.goldenGlow)],
  ]);
  ctx.fillRect(0, 0, width, height);

  // Low golden-hour sun behind the citadel, slightly right as in the reference.
  const sunX = layout.citadelX + 70;
  const sunY = floorTopY - 70;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 360);
  glow.addColorStop(0, bg(SKY.cloudLight, 0.95));
  glow.addColorStop(0.18, bg(SKY.goldenGlow, 0.7));
  glow.addColorStop(1, bg(SKY.goldenGlow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  paintSunRays(ctx, sunX, sunY, height, rng);

  // High stratus wisps.
  paintSoftLayer(ctx, 6, (layer) => {
    for (let i = 0; i < 6; i++) {
      paintWisp(
        layer,
        rng.range(0, width),
        rng.range(height * 0.05, floorTopY * 0.45),
        rng.range(160, 360),
      );
    }
  });

  // Distant floating islands, kept clear of the citadel.
  for (let i = 0; i < 7; i++) {
    const x = rng.range(30, width - 30);
    const y = rng.range(floorTopY * 0.18, floorTopY * 0.62);
    // Keep the citadel's silhouette clear.
    const nearCitadel = Math.abs(x - layout.citadelX) < 150 && y > layout.citadelTopY - 60;
    if (nearCitadel) continue;
    paintFloatingIsland(ctx, x, y, rng.range(24, 56), rng.range(0.45, 0.7), rng);
  }

  // The three worlds on the horizon: Energy realm volcanoes (left), Ocean crews' sea and a
  // Warrior clans pagoda (right), the Nexus in the middle.
  paintVolcanoes(ctx, width, floorTopY, rng);
  paintSeaAndPagoda(ctx, width, floorTopY, rng);

  paintCitadel(ctx, layout, rng);

  // Horizon cloud bank: tall at the edges to frame the scene, lower in the middle.
  const bankBase = floorTopY + 20;
  paintSoftLayer(ctx, 2.5, (layer) => {
    paintCumulus(layer, width * 0.08, bankBase, width * 0.42, 220, rng);
    paintCumulus(layer, width * 1.02, bankBase, width * 0.3, 150, rng);
    paintCumulus(layer, width * 0.5, bankBase, width * 0.7, 120, rng);
  });
}

/** Static arena floor: transparent above the platform edge. */
export function paintGroundLayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  floorTopY: number,
  rng: Rng,
): void {
  const stone = WORLD.ocean.secondary;
  const edge: number[] = [];
  const segments = Math.ceil(width / 40);
  for (let i = 0; i <= segments; i++) edge.push(floorTopY + rng.range(-5, 5));

  const tracePlatform = (): void => {
    ctx.beginPath();
    ctx.moveTo(0, edge[0] ?? floorTopY);
    edge.forEach((y, i) => {
      ctx.lineTo((i / segments) * width, y);
    });
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
  };

  tracePlatform();
  ctx.fillStyle = verticalGradient(ctx, floorTopY, height, [
    [0, bg(mixColor(stone, SKY.goldenGlow, 0.35))],
    [0.35, bg(stone)],
    [1, bg(mixColor(stone, SKY.violetShadow, 0.6))],
  ]);
  ctx.fill();

  const floorHeight = height - floorTopY;
  const ringY = floorTopY + floorHeight * 0.42;

  // Pool of warm light where the two fighters meet.
  const pool = ctx.createRadialGradient(width * 0.5, ringY, 10, width * 0.5, ringY, width * 0.8);
  pool.addColorStop(0, bg(SKY.goldenGlow, 0.28));
  pool.addColorStop(1, bg(SKY.goldenGlow, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(0, floorTopY, width, floorHeight);

  // Ancient duelling ring of paler stone, seen in perspective.
  const ringRx = width * 0.62;
  const ringRy = floorHeight * 0.3;
  ctx.fillStyle = bg(mixColor(stone, SKY.cloudLight, 0.35), 0.45);
  ctx.beginPath();
  ctx.ellipse(width * 0.5, ringY, ringRx, ringRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = bg(SKY.violetShadow, 0.28);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = bg(SKY.cloudLight, 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(width * 0.5, ringY - 3, ringRx * 0.96, ringRy * 0.94, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  // Paving seams radiating from the centre.
  ctx.strokeStyle = bg(SKY.violetShadow, 0.16);
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(
      width * 0.5 + Math.cos(angle) * ringRx * 0.25,
      ringY + Math.sin(angle) * ringRy * 0.25,
    );
    ctx.lineTo(width * 0.5 + Math.cos(angle) * ringRx, ringY + Math.sin(angle) * ringRy);
    ctx.stroke();
  }

  // Grass tufts clustered at the edges of the plateau: irregular blades, never flat discs.
  for (let i = 0; i < 10; i++) {
    const left = i % 2 === 0;
    const cx = left ? rng.range(-10, width * 0.2) : rng.range(width * 0.8, width + 10);
    const cy = rng.range(floorTopY + 30, height - 40);
    const blades = rng.int(14, 26);
    for (let b = 0; b < blades; b++) {
      const x = cx + rng.range(-34, 34);
      const y = cy + rng.range(-8, 8);
      const h = rng.range(7, 16);
      ctx.fillStyle = bg(
        mixColor(WORLD.clans.dominant, WORLD.clans.accent, rng.range(0.1, 0.6)),
        rng.range(0.55, 0.9),
      );
      ctx.beginPath();
      ctx.moveTo(x - 2.5, y);
      ctx.lineTo(x + rng.range(-4, 4), y - h);
      ctx.lineTo(x + 2.5, y);
      ctx.fill();
    }
  }

  // A few boulders, lit from the upper left with violet shadows.
  for (let i = 0; i < 4; i++) {
    const left = i % 2 === 0;
    const x = left ? rng.range(10, width * 0.16) : rng.range(width * 0.84, width - 10);
    const y = rng.range(floorTopY + 40, height - 60);
    const r = rng.range(16, 34);
    ctx.fillStyle = bg(mixColor(stone, SKY.violetShadow, 0.45));
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bg(mixColor(stone, SKY.cloudLight, 0.25));
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.8, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Worn stone cracks.
  ctx.strokeStyle = bg(SKY.violetShadow, 0.18);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 34; i++) {
    let x = rng.range(0, width);
    let y = rng.range(floorTopY + 20, height);
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
    const y = edge[segment] ?? floorTopY;
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
