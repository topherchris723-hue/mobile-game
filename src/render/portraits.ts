import type { Renderer } from 'pixi.js';
import type { FighterSpec } from '../config/fighters';
import { drawPlaceholderFighter } from './placeholderFighter';

/**
 * Full-body Sovereign images for the HTML menus, rendered once from the same placeholder drawing
 * used in battle and cached as data URLs. When real illustrations arrive (art-style.md §10.2),
 * this returns their file URLs instead.
 */
export interface PortraitCache {
  get(spec: FighterSpec): Promise<string>;
}

export function createPortraitCache(renderer: Renderer): PortraitCache {
  const cache = new Map<string, Promise<string>>();
  return {
    get(spec) {
      const cached = cache.get(spec.id);
      if (cached) return cached;
      const drawing = drawPlaceholderFighter(spec.look);
      const url = renderer.extract
        .base64({ target: drawing, resolution: 1, antialias: true, format: 'png' })
        .finally(() => {
          drawing.destroy({ children: true });
        });
      cache.set(spec.id, url);
      return url;
    },
  };
}
