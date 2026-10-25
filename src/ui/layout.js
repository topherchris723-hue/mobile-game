// Screen geometry (GDD §14). Everything is laid out in logical units: width is always 360.
// The logical height grows with the screen aspect (640 minimum); the extra height goes to the arena.
// The canvas is rendered at device resolution (zoom = device px per logical unit) so text stays sharp.

export const LOGICAL_W = 360;
export const MIN_H = 640;
export const MAX_H = 820;
export const MIN_TOUCH = 44;

/**
 * Max device px per logical unit on the Canvas 2D renderer (reviewer R-2, AC-17.7): Canvas rasterises every pixel
 * on the CPU each frame, so its backing store is capped at 1.25× (450 × 800 for 360 × 640); WebGL keeps up to 2×.
 * Round 7: 1.25 gave median p95 26.3 ms vs 31.1 ms for 1.5 (5 alternating runs each, 4× CPU).
 */
export const CANVAS_MAX_ZOOM = 1.25;

/** cssW/cssH = the safe-area box in CSS px; maxZoom caps the render resolution (Canvas renderer). */
export function computeViewport(cssW, cssH, dpr, maxZoom) {
  const w = Math.max(1, cssW);
  const h = Math.max(1, cssH);
  const H = Math.min(MAX_H, Math.max(MIN_H, Math.round((LOGICAL_W * h) / w)));
  const cssScale = Math.min(w / LOGICAL_W, h / H);
  // Render at most 2 device px per CSS px: sharp on phones, and cheap enough for mid-range GPUs (GDD §14: 30 fps min).
  const cap = typeof maxZoom === 'number' && maxZoom > 0 ? maxZoom : 4;
  const zoom = Math.max(1, Math.min(4, cap, cssScale * Math.min(Math.max(dpr || 1, 1), 2)));
  return {
    W: LOGICAL_W,
    H: H,
    zoom: zoom,
    cssScale: cssScale,
    canvasW: Math.round(LOGICAL_W * zoom),
    canvasH: Math.round(H * zoom),
  };
}

/**
 * Battle layout for logical height H (GDD §14 table, 360×640 base).
 * extra = H − 640 is added to the arena; everything below the arena moves down by `extra`.
 */
export function battleLayout(H) {
  const extra = Math.max(0, H - MIN_H);
  const arenaTop = 44;
  const arenaBottom = 330 + extra;
  const statusTop = arenaBottom; // 330..394
  const hand = { top: 412 + extra, cardW: 80, cardH: 112, gap: 8, margin: 8 };
  return {
    W: LOGICAL_W,
    H: H,
    extra: extra,
    topBar: { y: 0, h: 44 },
    pause: { x: LOGICAL_W - 48, y: 0, w: 44, h: 44 },
    arena: { top: arenaTop, bottom: arenaBottom, floorY: arenaBottom - 46, left: 20, right: LOGICAL_W - 20 },
    playerHp: { x: 8, y: arenaBottom - 22, w: 344, h: 12, nameY: arenaBottom - 40 },
    bench: [
      { x: 8, y: statusTop + 6, w: 52, h: 52 },
      { x: 68, y: statusTop + 6, w: 52, h: 52 },
    ],
    riposteInfo: { x: 128, y: statusTop + 6, w: 88, h: 52 },
    ignite: { x: 224, y: statusTop + 4, w: 56, h: 56 },
    burst: { x: 288, y: statusTop, w: 64, h: 64 },
    vigor: { x: 8, y: 396 + extra, w: 312, h: 14, numX: 330 },
    hand: hand,
    cardRect(i) {
      return { x: hand.margin + i * (hand.cardW + hand.gap), y: hand.top + 4, w: hand.cardW, h: hand.cardH };
    },
    swipePad: { top: 532 + extra, bottom: H },
  };
}

/** Arena x (0..arenaWidth) → screen x. */
export function arenaToScreen(x, arenaWidth, L) {
  const a = L.arena;
  return a.left + (x / arenaWidth) * (a.right - a.left);
}

export function contains(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
