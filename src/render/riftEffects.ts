import { Container, Graphics } from 'pixi.js';
import { WORLD } from '../config/palette';
import type { BackdropLayout } from './backdrop';

/** Animated light beams and halo ring around the Nexus citadel (style guide §8: Rift effects). */
export interface RiftEffects {
  readonly root: Container;
  layout(layout: BackdropLayout): void;
  update(timeSec: number): void;
}

const MOTE_COUNT = 3;

export function createRiftEffects(): RiftEffects {
  const root = new Container();
  const beams = new Graphics();
  beams.blendMode = 'add';
  const halo = new Graphics();
  const motes: Graphics[] = [];
  for (let i = 0; i < MOTE_COUNT; i++) {
    const mote = new Graphics().circle(0, 0, 3.5).fill({ color: WORLD.nexus.accent });
    mote.blendMode = 'add';
    motes.push(mote);
  }
  root.addChild(beams, halo, ...motes);
  let current: BackdropLayout | null = null;

  return {
    root,
    layout(layout) {
      current = layout;
      const { citadelX: x, citadelTopY: top } = layout;
      beams.clear();
      for (const [offset, width] of [
        [-16, 5],
        [14, 3],
      ] as const) {
        // Layered widths approximate a soft glow without a blur filter.
        for (const [spread, alpha] of [
          [5, 0.06],
          [3, 0.1],
          [1.6, 0.16],
        ] as const) {
          beams.rect(x + offset - width * spread, 0, width * spread * 2, top + 40).fill({
            color: WORLD.nexus.dominant,
            alpha,
          });
        }
        beams.rect(x + offset - width * 0.3, 0, width * 0.6, top + 40).fill({
          color: WORLD.nexus.accent,
          alpha: 0.55,
        });
      }
      halo.clear();
      halo
        .ellipse(x, layout.haloY, layout.haloRadiusX, layout.haloRadiusY)
        .stroke({ width: 2.5, color: WORLD.nexus.dominant, alpha: 0.8 });
    },
    update(timeSec) {
      if (!current) return;
      beams.alpha = 0.75 + Math.sin(timeSec * 1.3) * 0.2;
      for (let i = 0; i < motes.length; i++) {
        const mote = motes[i];
        if (!mote) continue;
        const angle = timeSec * 0.6 + (i * Math.PI * 2) / MOTE_COUNT;
        mote.position.set(
          current.citadelX + Math.cos(angle) * current.haloRadiusX,
          current.haloY + Math.sin(angle) * current.haloRadiusY,
        );
        // Motes pass behind the spires on the far side of the ring.
        mote.alpha = Math.sin(angle) > 0 ? 1 : 0.35;
      }
    },
  };
}
