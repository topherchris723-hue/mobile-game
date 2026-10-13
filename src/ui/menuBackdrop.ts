import { LOGICAL_WIDTH, MAX_BACKDROP_TEXTURE_SIZE } from '../config/display';
import { BATTLE_SEED, FLOOR_TOP_FRACTION } from '../config/duelPresentation';
import { createRng } from '../core/rng';
import { paintGroundLayer, paintSkyLayer } from '../render/backdrop';

/**
 * Static painted Nexus scene behind the menus: the same painter as the battle arena, drawn once
 * into a plain canvas (no game loop, no GPU work while menus are open).
 */
export interface MenuBackdrop {
  repaint(): void;
  dispose(): void;
}

export function createMenuBackdrop(host: HTMLElement): MenuBackdrop {
  const canvas = document.createElement('canvas');
  canvas.className = 'menu-backdrop';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);

  const repaint = (): void => {
    const cssWidth = Math.max(1, window.innerWidth);
    const cssHeight = Math.max(1, window.innerHeight);
    const cssPerUnit = cssWidth / LOGICAL_WIDTH;
    const logicalHeight = cssHeight / cssPerUnit;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(
      cssPerUnit * pixelRatio,
      MAX_BACKDROP_TEXTURE_SIZE / Math.max(LOGICAL_WIDTH, logicalHeight),
    );
    canvas.width = Math.ceil(LOGICAL_WIDTH * scale);
    canvas.height = Math.ceil(logicalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const floorTop = logicalHeight * FLOOR_TOP_FRACTION;
    const rng = createRng(BATTLE_SEED);
    paintSkyLayer(ctx, LOGICAL_WIDTH, logicalHeight, floorTop, rng);
    paintGroundLayer(ctx, LOGICAL_WIDTH, logicalHeight, floorTop, rng);
  };
  repaint();

  return {
    repaint,
    dispose() {
      canvas.width = 0;
      canvas.remove();
    },
  };
}
