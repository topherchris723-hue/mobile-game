import { Container, Sprite, Texture } from 'pixi.js';
import { TYPE_COLOR, WORLD } from '../config/palette';
import type { Rng } from '../core/rng';

/**
 * Rising Rift motes over the arena. Stored in typed arrays and moved in place so the per-frame
 * update allocates nothing; all sprites share one texture so they batch into a single draw call.
 */
export interface Embers {
  readonly root: Container;
  setBounds(width: number, height: number): void;
  update(dtSec: number, timeSec: number): void;
  dispose(): void;
}

function createMoteTexture(): Texture {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgb(255 255 255 / 1)');
  gradient.addColorStop(0.35, 'rgb(255 255 255 / 0.55)');
  gradient.addColorStop(1, 'rgb(255 255 255 / 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

export function createEmbers(count: number, rng: Rng): Embers {
  const root = new Container();
  const texture = createMoteTexture();
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const speed = new Float32Array(count);
  const phase = new Float32Array(count);
  const sprites: Sprite[] = [];
  let width = 1;
  let height = 1;

  for (let i = 0; i < count; i++) {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.blendMode = 'add';
    sprite.tint = i % 3 === 0 ? WORLD.nexus.dominant : TYPE_COLOR.radiant;
    sprite.scale.set(rng.range(0.15, 0.4));
    speed[i] = rng.range(14, 42);
    phase[i] = rng.range(0, Math.PI * 2);
    sprites.push(sprite);
    root.addChild(sprite);
  }

  const respawn = (i: number, anywhere: boolean): void => {
    x[i] = rng.range(0, width);
    y[i] = anywhere ? rng.range(0, height) : height + rng.range(0, 40);
  };

  return {
    root,
    setBounds(newWidth, newHeight) {
      width = newWidth;
      height = newHeight;
      for (let i = 0; i < count; i++) respawn(i, true);
    },
    update(dtSec, timeSec) {
      for (let i = 0; i < count; i++) {
        const sprite = sprites[i];
        if (!sprite) continue;
        let py = (y[i] ?? 0) - (speed[i] ?? 0) * dtSec;
        if (py < -20) {
          respawn(i, false);
          py = y[i] ?? 0;
        }
        y[i] = py;
        const sway = Math.sin(timeSec * 0.9 + (phase[i] ?? 0)) * 10;
        sprite.position.set((x[i] ?? 0) + sway, py);
        // Fade in near the floor and out toward the sky.
        sprite.alpha = Math.min(1, py / (height * 0.35)) * 0.8;
      }
    },
    dispose() {
      root.destroy({ children: true });
      texture.destroy(true);
    },
  };
}
