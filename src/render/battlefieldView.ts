import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import {
  ACTION_PANEL_HEIGHT,
  ALLY_SLOTS,
  BATTLEFIELD_SEED,
  ENEMY_SLOTS,
  FLOOR_TOP_FRACTION,
  UNIT_SCALE,
  type UnitSlot,
} from '../config/battlefield';
import { LOGICAL_WIDTH, MAX_BACKDROP_TEXTURE_SIZE } from '../config/display';
import { ALLY_LOOKS, ENEMY_LOOK } from '../config/placeholderFighters';
import { SKY, WORLD } from '../config/palette';
import { lerp } from '../core/math';
import { createRng } from '../core/rng';
import type { BattlefieldState, UnitState } from '../game/battlefield';
import { computeBackdropLayout, paintGroundLayer, paintSkyLayer } from './backdrop';
import { createEmbers } from './embers';
import { createPlaceholderFighter, type PlaceholderFighterView } from './placeholderFighter';
import { createRiftEffects } from './riftEffects';

export interface BattlefieldView {
  /** Root container in logical units; the caller scales it to the screen. */
  readonly root: Container;
  /** Repaints size-dependent layers. `pixelsPerUnit` = device pixels per logical unit. */
  resize(logicalHeight: number, pixelsPerUnit: number): void;
  /** Draws the state given at creation; the simulation mutates it in place. */
  render(timeSec: number, dtSec: number): void;
  /** Front-most unit under a point in logical units, or null. */
  unitAt(x: number, y: number): number | null;
  /** Centre of a unit's body in CSS pixels (for the debug test hook). */
  unitScreenPoint(unitId: number, cssPerUnit: number): { x: number; y: number } | null;
  dispose(): void;
}

interface UnitSlotView {
  readonly unit: UnitState;
  readonly slot: UnitSlot;
  readonly holder: Container;
  readonly ring: Graphics;
  readonly view: PlaceholderFighterView;
  readonly facing: 1 | -1;
  /** 0–1 eased selection highlight. */
  selectBlend: number;
  feetX: number;
  feetY: number;
  scale: number;
}

/** Selection highlight eases at this rate per second (snappy, never a one-frame pop). */
const SELECT_BLEND_RATE = 14;
/** Tap target around a unit, in sprite units at scale 1 (generous: CLAUDE.md §6). */
const HIT_HALF_WIDTH = 90;
const HIT_HEIGHT = 380;

/** Paints one static layer into a canvas sized for the screen and wraps it as a sprite. */
function paintLayer(
  logicalHeight: number,
  pixelsPerUnit: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): Sprite {
  const longest = Math.max(LOGICAL_WIDTH, logicalHeight);
  const scale = Math.min(pixelsPerUnit, MAX_BACKDROP_TEXTURE_SIZE / longest);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(LOGICAL_WIDTH * scale);
  canvas.height = Math.ceil(logicalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  paint(ctx);
  const sprite = new Sprite(Texture.from(canvas));
  sprite.scale.set(1 / scale);
  return sprite;
}

export function createBattlefieldView(
  state: BattlefieldState,
  emberCount: number,
): BattlefieldView {
  const root = new Container();
  const skyHolder = new Container();
  const rift = createRiftEffects();
  const groundHolder = new Container();
  const unitLayer = new Container();
  unitLayer.sortableChildren = true;
  const embers = createEmbers(emberCount, createRng(BATTLEFIELD_SEED ^ 0xe3be));
  root.addChild(skyHolder, rift.root, groundHolder, unitLayer, embers.root);

  const views: UnitSlotView[] = state.units.map((unit, index) => {
    const isAlly = unit.side === 'ally';
    const look = isAlly ? (ALLY_LOOKS[unit.slot] ?? ENEMY_LOOK) : ENEMY_LOOK;
    const slot = (isAlly ? ALLY_SLOTS : ENEMY_SLOTS)[unit.slot];
    if (!slot) throw new Error(`No ${unit.side} slot ${unit.slot}`);
    const view = createPlaceholderFighter(look, index * 0.7);
    const shadow = new Graphics()
      .ellipse(0, 0, 66, 12)
      .fill({ color: SKY.violetShadow, alpha: 0.35 });
    const ring = new Graphics()
      .ellipse(0, 0, 84, 18)
      .stroke({ width: 5, color: WORLD.nexus.dominant, alpha: 0.95 });
    ring.alpha = 0;
    const holder = new Container();
    holder.addChild(shadow, ring, view.root);
    unitLayer.addChild(holder);
    return {
      unit,
      slot,
      holder,
      ring,
      view,
      facing: isAlly ? 1 : -1,
      selectBlend: 0,
      feetX: 0,
      feetY: 0,
      scale: 1,
    };
  });

  /** Feet positions sit in the band between the floor edge and the action panel. */
  const layoutUnits = (logicalHeight: number): void => {
    const bandTop = logicalHeight * FLOOR_TOP_FRACTION + 70;
    const bandBottom = logicalHeight - ACTION_PANEL_HEIGHT + 40;
    for (const v of views) {
      v.feetX = v.slot.x * LOGICAL_WIDTH;
      v.feetY = lerp(bandTop, bandBottom, v.slot.depth);
      v.scale = lerp(UNIT_SCALE.far, UNIT_SCALE.near, v.slot.depth);
      v.holder.position.set(v.feetX, v.feetY);
      v.holder.zIndex = v.feetY;
    }
  };

  const destroyLayer = (holder: Container): void => {
    for (const child of holder.removeChildren()) {
      if (child instanceof Sprite) child.texture.destroy(true);
      child.destroy();
    }
  };

  return {
    root,

    resize(logicalHeight, pixelsPerUnit) {
      destroyLayer(skyHolder);
      destroyLayer(groundHolder);
      const floorTopY = logicalHeight * FLOOR_TOP_FRACTION;
      // Same seed every time, so resizing never reshuffles the scenery.
      const rng = createRng(BATTLEFIELD_SEED);
      skyHolder.addChild(
        paintLayer(logicalHeight, pixelsPerUnit, (ctx) => {
          paintSkyLayer(ctx, LOGICAL_WIDTH, logicalHeight, floorTopY, rng);
        }),
      );
      groundHolder.addChild(
        paintLayer(logicalHeight, pixelsPerUnit, (ctx) => {
          paintGroundLayer(ctx, LOGICAL_WIDTH, logicalHeight, floorTopY, rng);
        }),
      );
      rift.layout(computeBackdropLayout(LOGICAL_WIDTH, floorTopY));
      embers.setBounds(LOGICAL_WIDTH, logicalHeight);
      layoutUnits(logicalHeight);
    },

    render(timeSec, dtSec) {
      rift.update(timeSec);
      embers.update(dtSec, timeSec);
      const blendStep = Math.min(1, dtSec * SELECT_BLEND_RATE);
      const pulse = 0.5 + Math.sin(timeSec * 5) * 0.5;

      for (const v of views) {
        const target = state.selectedUnitId === v.unit.id ? 1 : 0;
        v.selectBlend += (target - v.selectBlend) * blendStep;
        const lift = 1 + v.selectBlend * 0.05;
        v.holder.scale.set(v.scale * lift);
        v.view.root.scale.set(v.facing, 1);
        v.ring.alpha = v.selectBlend * (0.65 + pulse * 0.35);
        v.view.pose(timeSec, 0, 0);
      }
    },

    unitAt(x, y) {
      let best: UnitSlotView | null = null;
      for (const v of views) {
        const halfWidth = HIT_HALF_WIDTH * v.scale;
        const inside =
          Math.abs(x - v.feetX) <= halfWidth &&
          y <= v.feetY + 20 &&
          y >= v.feetY - HIT_HEIGHT * v.scale;
        // Nearer units (lower on screen) are drawn on top, so they win overlapping taps.
        if (inside && (!best || v.feetY > best.feetY)) best = v;
      }
      return best ? best.unit.id : null;
    },

    unitScreenPoint(unitId, cssPerUnit) {
      const v = views.find((candidate) => candidate.unit.id === unitId);
      if (!v) return null;
      return { x: v.feetX * cssPerUnit, y: (v.feetY - 180 * v.scale) * cssPerUnit };
    },

    dispose() {
      destroyLayer(skyHolder);
      destroyLayer(groundHolder);
      embers.dispose();
      root.destroy({ children: true });
    },
  };
}
