import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import {
  ARENA_SEED,
  LANES,
  OPPONENT_X_FRACTION,
  PLAYER_X_FRACTION,
  type LaneIndex,
} from '../config/arena';
import { LOGICAL_HEIGHT, MAX_BACKDROP_TEXTURE_WIDTH } from '../config/display';
import { PLACEHOLDER_LOOKS } from '../config/placeholderFighters';
import { SKY } from '../config/palette';
import { easeOutCubic, lerp } from '../core/math';
import { createRng } from '../core/rng';
import { laneStepProgress, type ArenaState, type FighterState } from '../game/arena';
import { computeBackdropLayout, paintGroundLayer, paintSkyLayer } from './backdrop';
import { createEmbers } from './embers';
import { createPlaceholderFighter, type PlaceholderFighterView } from './placeholderFighter';
import { createRiftEffects } from './riftEffects';

export interface ArenaView {
  /** Root container in logical units; the caller scales it to the screen. */
  readonly root: Container;
  /** Repaints size-dependent layers. `pixelsPerUnit` = device pixels per logical unit. */
  resize(logicalWidth: number, pixelsPerUnit: number): void;
  /** Draws every fighter of the state given at creation; the simulation mutates it in place. */
  render(alpha: number, timeSec: number, dtSec: number): void;
  dispose(): void;
}

interface FighterSlot {
  readonly state: FighterState;
  readonly holder: Container;
  readonly shadow: Graphics;
  readonly view: PlaceholderFighterView;
  readonly facing: 1 | -1;
  guardBlend: number;
}

/** Guard pose eases in/out at this rate per second (snappy, but never a one-frame pop). */
const GUARD_BLEND_RATE = 16;

function laneValue(from: LaneIndex, to: LaneIndex, t: number, key: 'floorY' | 'scale'): number {
  return lerp(LANES[from][key], LANES[to][key], t);
}

/** Paints one static layer into a canvas sized for the screen and wraps it as a sprite. */
function paintLayer(
  logicalWidth: number,
  pixelsPerUnit: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): Sprite {
  const scale = Math.min(pixelsPerUnit, MAX_BACKDROP_TEXTURE_WIDTH / logicalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(logicalWidth * scale);
  canvas.height = Math.ceil(LOGICAL_HEIGHT * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  paint(ctx);
  const sprite = new Sprite(Texture.from(canvas));
  sprite.scale.set(1 / scale);
  return sprite;
}

export function createArenaView(state: ArenaState, emberCount: number): ArenaView {
  const root = new Container();
  const skyHolder = new Container();
  const rift = createRiftEffects();
  const groundHolder = new Container();
  const fighterLayer = new Container();
  fighterLayer.sortableChildren = true;
  const embers = createEmbers(emberCount, createRng(ARENA_SEED ^ 0xe3be));
  root.addChild(skyHolder, rift.root, groundHolder, fighterLayer, embers.root);

  let logicalWidth = 1;
  const slots: FighterSlot[] = state.fighters.map((fighter, index) => {
    const look = fighter.side === 'player' ? PLACEHOLDER_LOOKS[0] : PLACEHOLDER_LOOKS[1];
    const view = createPlaceholderFighter(look, index * 0.7);
    const shadow = new Graphics()
      .ellipse(0, 0, 62, 11)
      .fill({ color: SKY.violetShadow, alpha: 0.35 });
    const holder = new Container();
    holder.addChild(shadow, view.root);
    fighterLayer.addChild(holder);
    return {
      state: fighter,
      holder,
      shadow,
      view,
      facing: fighter.side === 'player' ? 1 : -1,
      guardBlend: 0,
    };
  });

  const destroyLayer = (holder: Container): void => {
    for (const child of holder.removeChildren()) {
      if (child instanceof Sprite) child.texture.destroy(true);
      child.destroy();
    }
  };

  return {
    root,

    resize(width, pixelsPerUnit) {
      logicalWidth = width;
      destroyLayer(skyHolder);
      destroyLayer(groundHolder);
      // Same seed every time, so resizing never reshuffles the scenery.
      const rng = createRng(ARENA_SEED);
      skyHolder.addChild(
        paintLayer(width, pixelsPerUnit, (ctx) => {
          paintSkyLayer(ctx, width, LOGICAL_HEIGHT, rng);
        }),
      );
      groundHolder.addChild(
        paintLayer(width, pixelsPerUnit, (ctx) => {
          paintGroundLayer(ctx, width, LOGICAL_HEIGHT, rng);
        }),
      );
      rift.layout(computeBackdropLayout(width));
      embers.setBounds(width, LOGICAL_HEIGHT);
    },

    render(alpha, timeSec, dtSec) {
      rift.update(timeSec);
      embers.update(dtSec, timeSec);
      const blendStep = Math.min(1, dtSec * GUARD_BLEND_RATE);

      for (const slot of slots) {
        const fighter = slot.state;
        const progress = laneStepProgress(fighter, alpha);
        const eased = easeOutCubic(progress);
        const floorY = laneValue(fighter.fromLane, fighter.lane, eased, 'floorY');
        const scale = laneValue(fighter.fromLane, fighter.lane, eased, 'scale');
        const stepPulse = fighter.stepTicksRemaining > 0 ? Math.sin(progress * Math.PI) : 0;
        slot.guardBlend += ((fighter.guarding ? 1 : 0) - slot.guardBlend) * blendStep;

        const xFraction = fighter.side === 'player' ? PLAYER_X_FRACTION : OPPONENT_X_FRACTION;
        slot.holder.position.set(logicalWidth * xFraction, floorY);
        slot.holder.scale.set(scale);
        slot.holder.zIndex = floorY;
        slot.view.root.scale.set(slot.facing * (1 + stepPulse * 0.03), 1 - stepPulse * 0.05);
        slot.shadow.scale.set(1 - stepPulse * 0.15);
        slot.view.pose(timeSec, slot.guardBlend, stepPulse);
      }
    },

    dispose() {
      destroyLayer(skyHolder);
      destroyLayer(groundHolder);
      embers.dispose();
      root.destroy({ children: true });
    },
  };
}
