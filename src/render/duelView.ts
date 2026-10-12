import { Container, Graphics, Sprite, Text, Texture, type Renderer } from 'pixi.js';
import { LOGICAL_WIDTH, MAX_BACKDROP_TEXTURE_SIZE } from '../config/display';
import {
  BATTLE_SEED,
  FLOOR_TOP_FRACTION,
  PLAYER_PANEL_HEIGHT,
  STATIONS,
} from '../config/duelPresentation';
import type { CardKind, FighterSpec, TypeId } from '../config/fighters';
import { CHARACTER, SKY, TYPE_COLOR, WORLD } from '../config/palette';
import { easeOutCubic, lerp } from '../core/math';
import { createRng } from '../core/rng';
import type { Effectiveness, Side } from '../game/duel/types';
import { computeBackdropLayout, paintGroundLayer, paintSkyLayer } from './backdrop';
import { createEmbers } from './embers';
import { drawPlaceholderFighter } from './placeholderFighter';
import { createRiftEffects } from './riftEffects';
import { createTweenRunner } from './tweens';

/*
 * Pixi presentation of a duel: backdrop, the two active fighters, and effects. It never reads
 * game rules; the duel scene calls these methods as it plays back DuelEvents.
 */

export interface DuelView {
  readonly root: Container;
  /** `bottomReserved` = height of the player panel in logical units. */
  resize(logicalHeight: number, pixelsPerUnit: number, bottomReserved: number): void;
  /** Re-places the fighters when only the player panel's height changed (no repaint). */
  setBottomReserved(bottomReserved: number): void;
  /** Shows the given fighters as active, with everything else reset (start / restart). */
  reset(activePlayer: number, activeEnemy: number): void;
  render(timeSec: number, dtSec: number): void;
  attack(side: Side, kind: CardKind, type: TypeId): void;
  hit(side: Side, amount: number, effectiveness: Effectiveness, guarded: boolean): void;
  heal(side: Side, amount: number): void;
  status(side: Side, status: 'focus' | 'guard' | 'sap'): void;
  charge(side: Side): void;
  switchIn(side: Side, from: number, to: number): void;
  knockOut(side: Side): void;
  /** Partner rushes in beside the active fighter; both strike together. */
  crossover(side: Side, partnerIndex: number, leadType: TypeId, partnerType: TypeId): void;
  /** Energy motes fly from the drained side to the other. */
  drain(side: Side, amount: number): void;
  setGuardPose(side: Side, guarding: boolean): void;
  dispose(): void;
}

interface FighterSlot {
  /** The fighter's single battle illustration (art-style.md §10.2); placeholders are baked into one. */
  readonly sprite: Sprite;
  readonly holder: Container;
  /** Translucent shield shown while guarding. */
  readonly shield: Graphics;
  /** Phase offset so idle motion isn't in lockstep. */
  readonly phase: number;
  guardTarget: number;
  guardBlend: number;
}

interface Station {
  readonly side: Side;
  readonly fighters: FighterSlot[];
  active: number;
  homeX: number;
  homeY: number;
  scale: number;
  readonly facing: 1 | -1;
}

const BODY_HEIGHT = 390;
/** Placeholder illustrations are baked at this resolution for crisp edges on 2× screens. */
const BAKE_RESOLUTION = 2;
const HIT_TINT = 0xff9a9a;
const STATUS_COLOR = {
  focus: TYPE_COLOR.radiant,
  guard: TYPE_COLOR.swift,
  sap: TYPE_COLOR.void,
} as const;
const STATUS_LABEL = { focus: 'FOCUS', guard: 'GUARD', sap: 'DEF DOWN' } as const;

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

/** Draws a placeholder once and bakes it into a single texture anchored at the feet. */
function bakeIllustration(renderer: Renderer, spec: FighterSpec): Sprite {
  const drawing = drawPlaceholderFighter(spec.look);
  const bounds = drawing.getLocalBounds();
  const texture = renderer.generateTexture({
    target: drawing,
    resolution: BAKE_RESOLUTION,
    antialias: true,
  });
  drawing.destroy({ children: true });
  const sprite = new Sprite(texture);
  sprite.anchor.set(-bounds.x / bounds.width, -bounds.y / bounds.height);
  return sprite;
}

export function createDuelView(
  renderer: Renderer,
  teams: Record<Side, readonly FighterSpec[]>,
  emberCount: number,
): DuelView {
  const root = new Container();
  const skyHolder = new Container();
  const rift = createRiftEffects();
  const groundHolder = new Container();
  const fighterLayer = new Container();
  const fxLayer = new Container();
  const embers = createEmbers(emberCount, createRng(BATTLE_SEED ^ 0xe3be));
  const flash = new Graphics();
  flash.alpha = 0;
  root.addChild(skyHolder, rift.root, groundHolder, fighterLayer, embers.root, fxLayer, flash);
  const tweens = createTweenRunner();
  let logicalHeight = 1;
  let panelHeight = PLAYER_PANEL_HEIGHT;

  const makeStation = (side: Side): Station => {
    const fighters = teams[side].map((spec, index) => {
      const sprite = bakeIllustration(renderer, spec);
      const shadow = new Graphics()
        .ellipse(0, 0, 70, 13)
        .fill({ color: SKY.violetShadow, alpha: 0.38 });
      // Hexagonal ward in front of the fighter (facing right; mirrored with the sprite's side).
      const shield = new Graphics()
        .poly([60, -330, 96, -300, 96, -150, 60, -120, 40, -150, 40, -300])
        .fill({ color: TYPE_COLOR.swift, alpha: 0.22 })
        .stroke({ width: 4, color: TYPE_COLOR.swift, alpha: 0.9 });
      shield.alpha = 0;
      const holder = new Container();
      holder.addChild(shadow, sprite, shield);
      fighterLayer.addChild(holder);
      return {
        sprite,
        holder,
        shield,
        phase: index * 0.9 + (side === 'enemy' ? 0.4 : 0),
        guardTarget: 0,
        guardBlend: 0,
      };
    });
    return {
      side,
      fighters,
      active: 0,
      homeX: 0,
      homeY: 0,
      scale: STATIONS[side].scale,
      facing: side === 'player' ? 1 : -1,
    };
  };
  const stations: Record<Side, Station> = {
    player: makeStation('player'),
    enemy: makeStation('enemy'),
  };

  const activeSlot = (side: Side): FighterSlot => {
    const station = stations[side];
    const slot = station.fighters[station.active];
    if (!slot) throw new Error(`No active fighter for ${side}`);
    return slot;
  };

  const placeHome = (station: Station): void => {
    station.fighters.forEach((slot, index) => {
      slot.holder.visible = index === station.active;
      slot.holder.alpha = 1;
      slot.holder.rotation = 0;
      slot.holder.position.set(station.homeX, station.homeY);
      slot.holder.scale.set(station.scale);
      slot.sprite.scale.set(station.facing, 1);
      slot.sprite.tint = 0xffffff;
      slot.shield.scale.x = station.facing;
    });
  };

  const layout = (): void => {
    const floorTop = logicalHeight * FLOOR_TOP_FRACTION;
    stations.enemy.homeX = STATIONS.enemy.x * LOGICAL_WIDTH;
    stations.enemy.homeY = floorTop + 120;
    stations.player.homeX = STATIONS.player.x * LOGICAL_WIDTH;
    stations.player.homeY = Math.max(stations.enemy.homeY + 170, logicalHeight - panelHeight - 30);
    placeHome(stations.player);
    placeHome(stations.enemy);
    flash.clear().rect(0, 0, LOGICAL_WIDTH, logicalHeight).fill({ color: SKY.cloudLight });
  };

  /** Centre of a fighter's body, for aiming projectiles and placing numbers. */
  const chest = (side: Side): { x: number; y: number } => {
    const station = stations[side];
    return { x: station.homeX, y: station.homeY - BODY_HEIGHT * station.scale * 0.55 };
  };

  const floatText = (side: Side, text: string, color: number, size: number, rise = 90): void => {
    const label = new Text({
      text,
      style: {
        fontFamily: 'Saira Condensed',
        fontWeight: '700',
        fontStyle: 'italic',
        fontSize: size,
        fill: color,
        stroke: { color: CHARACTER.outline, width: Math.round(size / 7) },
      },
    });
    label.anchor.set(0.5);
    // Numbers rise from just above the head so they never cover the face.
    const station = stations[side];
    const start = { x: station.homeX, y: station.homeY - BODY_HEIGHT * station.scale + 10 };
    const x = start.x + (side === 'enemy' ? -20 : 20);
    fxLayer.addChild(label);
    tweens.add(
      750,
      (t) => {
        label.position.set(x, start.y - 40 - easeOutCubic(t) * rise);
        label.scale.set(
          t < 0.15 ? lerp(0.6, 1.15, t / 0.15) : lerp(1.15, 1, Math.min(1, (t - 0.15) / 0.2)),
        );
        label.alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      },
      () => {
        label.destroy();
      },
    );
  };

  const ring = (side: Side, color: number, from: number, to: number, durationMs: number): void => {
    const shape = new Graphics().ellipse(0, 0, 90, 20).stroke({ width: 6, color });
    shape.blendMode = 'add';
    const station = stations[side];
    shape.position.set(station.homeX, station.homeY);
    fxLayer.addChild(shape);
    tweens.add(
      durationMs,
      (t) => {
        const s = lerp(from, to, easeOutCubic(t)) * station.scale;
        shape.scale.set(s);
        shape.alpha = 1 - t;
      },
      () => {
        shape.destroy();
      },
    );
  };

  const projectile = (from: Side, color: number, radius: number, durationMs: number): void => {
    const orb = new Container();
    const glow = new Graphics().circle(0, 0, radius * 2).fill({ color, alpha: 0.25 });
    const core = new Graphics().circle(0, 0, radius).fill({ color: SKY.cloudLight });
    glow.blendMode = 'add';
    orb.addChild(glow, core);
    fxLayer.addChild(orb);
    const a = chest(from);
    const b = chest(from === 'player' ? 'enemy' : 'player');
    tweens.add(
      durationMs,
      (t) => {
        const e = easeOutCubic(t);
        orb.position.set(lerp(a.x, b.x, e), lerp(a.y, b.y, e) - Math.sin(t * Math.PI) * 30);
      },
      () => {
        orb.destroy();
      },
    );
  };

  const lunge = (side: Side, distanceFraction: number): void => {
    const station = stations[side];
    const slot = activeSlot(side);
    const target = stations[side === 'player' ? 'enemy' : 'player'];
    const dx = (target.homeX - station.homeX) * distanceFraction;
    const dy = (target.homeY - station.homeY) * distanceFraction;
    tweens.add(360, (t) => {
      const k = t < 0.4 ? easeOutCubic(t / 0.4) : 1 - easeOutCubic((t - 0.4) / 0.6);
      slot.holder.position.set(station.homeX + dx * k, station.homeY + dy * k);
    });
  };

  return {
    root,

    resize(height, pixelsPerUnit, bottomReserved) {
      logicalHeight = height;
      panelHeight = bottomReserved > 0 ? bottomReserved : PLAYER_PANEL_HEIGHT;
      for (const holder of [skyHolder, groundHolder]) {
        for (const child of holder.removeChildren()) {
          if (child instanceof Sprite) child.texture.destroy(true);
          child.destroy();
        }
      }
      const floorTop = height * FLOOR_TOP_FRACTION;
      const rng = createRng(BATTLE_SEED);
      skyHolder.addChild(
        paintLayer(height, pixelsPerUnit, (ctx) => {
          paintSkyLayer(ctx, LOGICAL_WIDTH, height, floorTop, rng);
        }),
      );
      groundHolder.addChild(
        paintLayer(height, pixelsPerUnit, (ctx) => {
          paintGroundLayer(ctx, LOGICAL_WIDTH, height, floorTop, rng);
        }),
      );
      rift.layout(computeBackdropLayout(LOGICAL_WIDTH, floorTop));
      embers.setBounds(LOGICAL_WIDTH, height);
      layout();
    },

    setBottomReserved(bottomReserved) {
      if (bottomReserved <= 0 || Math.abs(bottomReserved - panelHeight) < 1) return;
      panelHeight = bottomReserved;
      layout();
    },

    reset(activePlayer, activeEnemy) {
      tweens.finishAll();
      stations.player.active = activePlayer;
      stations.enemy.active = activeEnemy;
      for (const station of Object.values(stations)) {
        for (const slot of station.fighters) {
          slot.guardTarget = 0;
          slot.guardBlend = 0;
        }
        placeHome(station);
      }
      flash.alpha = 0;
    },

    render(timeSec, dtSec) {
      tweens.update(dtSec * 1000);
      rift.update(timeSec);
      embers.update(dtSec, timeSec);
      const blendStep = Math.min(1, dtSec * 14);
      for (const station of Object.values(stations)) {
        for (const slot of station.fighters) {
          if (!slot.holder.visible) continue;
          slot.guardBlend += (slot.guardTarget - slot.guardBlend) * blendStep;
          // Idle motion for a single illustration: breathing squash and a slight sway from the
          // feet; guarding crouches a little behind the ward.
          const t = timeSec + slot.phase;
          const breath = Math.sin(t * 2.4);
          const crouch = 1 - slot.guardBlend * 0.04;
          slot.sprite.scale.set(
            station.facing * (1 - breath * 0.006),
            (1 + breath * 0.012) * crouch,
          );
          slot.sprite.rotation = Math.sin(t * 1.3) * 0.012 * station.facing;
          slot.shield.alpha = slot.guardBlend * (0.75 + Math.sin(t * 6) * 0.15);
        }
      }
    },

    attack(side, kind, type) {
      const color = TYPE_COLOR[type];
      if (kind === 'strike') {
        lunge(side, 0.55);
      } else if (kind === 'blast') {
        lunge(side, 0.08);
        projectile(side, color, 16, 300);
      } else if (kind === 'signature') {
        // One soft flash per Signature: well under the 3-per-second limit (CLAUDE.md §5).
        tweens.add(260, (t) => (flash.alpha = Math.sin(t * Math.PI) * 0.28));
        ring(side, WORLD.nexus.dominant, 0.6, 1.8, 420);
        lunge(side, 0.6);
        projectile(side, color, 26, 320);
      } else {
        ring(side, color, 0.5, 1.4, 420);
      }
    },

    hit(side, amount, effectiveness, guarded) {
      const slot = activeSlot(side);
      const station = stations[side];
      const push = side === 'player' ? -22 : 22;
      tweens.add(300, (t) => {
        const k = Math.sin(t * Math.PI);
        slot.holder.position.x = station.homeX + push * k;
        // Two quick hit flashes over 300 ms.
        slot.sprite.tint = t < 0.8 && Math.floor(t * 8) % 2 === 0 ? HIT_TINT : 0xffffff;
      });
      const color =
        effectiveness === 'advantage'
          ? TYPE_COLOR.radiant
          : effectiveness === 'disadvantage'
            ? SKY.high
            : SKY.cloudLight;
      floatText(side, String(amount), color, effectiveness === 'advantage' ? 76 : 62);
      if (effectiveness === 'advantage') floatText(side, 'EFFECTIVE', TYPE_COLOR.radiant, 30, 150);
      if (effectiveness === 'disadvantage') floatText(side, 'RESISTED', SKY.high, 30, 150);
      if (guarded) {
        floatText(side, 'GUARDED', TYPE_COLOR.swift, 30, 190);
        slot.guardTarget = 0;
      }
    },

    heal(side, amount) {
      ring(side, TYPE_COLOR.guile, 1.4, 0.6, 500);
      floatText(side, `+${amount}`, TYPE_COLOR.guile, 60);
    },

    status(side, status) {
      ring(side, STATUS_COLOR[status], 0.5, 1.5, 480);
      floatText(side, STATUS_LABEL[status], STATUS_COLOR[status], 36, 110);
      if (status === 'guard') activeSlot(side).guardTarget = 1;
    },

    charge(side) {
      ring(side, WORLD.nexus.dominant, 1.6, 0.5, 450);
      floatText(side, 'CHARGE', WORLD.nexus.dominant, 36, 110);
    },

    switchIn(side, from, to) {
      const station = stations[side];
      const outgoing = station.fighters[from];
      const incoming = station.fighters[to];
      if (!incoming) return;
      const offscreen = side === 'player' ? -200 : LOGICAL_WIDTH + 200;
      station.active = to;
      incoming.holder.visible = true;
      incoming.holder.alpha = 1;
      incoming.holder.rotation = 0;
      incoming.guardTarget = 0;
      if (
        outgoing &&
        outgoing !== incoming &&
        outgoing.holder.visible &&
        outgoing.holder.alpha > 0
      ) {
        tweens.add(
          220,
          (t) => {
            outgoing.holder.position.x = lerp(station.homeX, offscreen, easeOutCubic(t));
            outgoing.holder.alpha = 1 - t;
          },
          () => (outgoing.holder.visible = false),
        );
      } else if (outgoing && outgoing !== incoming) {
        outgoing.holder.visible = false;
      }
      tweens.add(320, (t) => {
        incoming.holder.position.set(
          lerp(offscreen, station.homeX, easeOutCubic(t)),
          station.homeY,
        );
      });
      ring(side, WORLD.nexus.dominant, 0.4, 1.3, 420);
    },

    knockOut(side) {
      const slot = activeSlot(side);
      const direction = side === 'player' ? -1 : 1;
      tweens.add(600, (t) => {
        slot.holder.rotation = direction * 0.5 * easeOutCubic(t);
        slot.holder.alpha = 1 - t;
      });
      floatText(side, 'K.O.', SKY.cloudLight, 70, 60);
    },

    crossover(side, partnerIndex, leadType, partnerType) {
      const station = stations[side];
      const partner = station.fighters[partnerIndex];
      if (!partner || partnerIndex === station.active) return;
      const behind = -110 * station.facing;
      const enterFrom = side === 'player' ? -220 : LOGICAL_WIDTH + 220;
      partner.holder.visible = true;
      partner.holder.alpha = 1;
      partner.holder.rotation = 0;
      partner.holder.position.set(enterFrom, station.homeY - 20);
      // Rush in beside the lead, strike together, then leave.
      tweens.add(
        1250,
        (t) => {
          const x =
            t < 0.25
              ? lerp(enterFrom, station.homeX + behind, easeOutCubic(t / 0.25))
              : t < 0.8
                ? station.homeX + behind
                : lerp(station.homeX + behind, enterFrom, easeOutCubic((t - 0.8) / 0.2));
          partner.holder.position.x = x;
          partner.holder.alpha = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;
        },
        () => {
          partner.holder.visible = false;
          partner.holder.position.set(station.homeX, station.homeY);
        },
      );
      // One soft flash per Crossover (CLAUDE.md §5).
      tweens.add(320, (t) => (flash.alpha = Math.sin(t * Math.PI) * 0.32));
      ring(side, WORLD.nexus.dominant, 0.5, 2.2, 600);
      lunge(side, 0.5);
      projectile(side, TYPE_COLOR[leadType], 34, 420);
      projectile(side, TYPE_COLOR[partnerType], 22, 520);
    },

    drain(side, amount) {
      const from = chest(side);
      const to = chest(side === 'player' ? 'enemy' : 'player');
      for (let i = 0; i < Math.max(1, amount) * 2; i++) {
        const mote = new Graphics().circle(0, 0, 7).fill({ color: WORLD.nexus.dominant });
        mote.blendMode = 'add';
        fxLayer.addChild(mote);
        const delay = i * 0.08;
        const arc = (i % 2 === 0 ? 1 : -1) * 40;
        tweens.add(
          560,
          (t) => {
            const k = easeOutCubic(Math.max(0, Math.min(1, (t - delay) / (1 - delay))));
            mote.position.set(
              lerp(from.x, to.x, k),
              lerp(from.y, to.y, k) + Math.sin(k * Math.PI) * arc,
            );
            mote.alpha = t < delay ? 0 : 1 - k * 0.6;
          },
          () => {
            mote.destroy();
          },
        );
      }
      floatText(side, `−${amount} ENERGY`, WORLD.nexus.dominant, 34, 110);
    },

    setGuardPose(side, guarding) {
      activeSlot(side).guardTarget = guarding ? 1 : 0;
    },

    dispose() {
      tweens.finishAll();
      for (const station of Object.values(stations)) {
        for (const slot of station.fighters) slot.sprite.texture.destroy(true);
      }
      embers.dispose();
      root.destroy({ children: true });
    },
  };
}
