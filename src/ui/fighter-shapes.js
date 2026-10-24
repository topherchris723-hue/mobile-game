// Per-fighter placeholder silhouettes (docs/STYLE_GUIDE.md §4.2, §11 items 1–3, 7; "Placeholder recipe" in each
// docs/art-briefs/char_*.md). Pure data + math (no Phaser) so heights and distinctness are unit-tested.
//
// Authored facing right (+x = front, toward the opponent), feet at y = 0, y negative = up, scale 1.
// Primitive: { k: 'rect'|'circle'|'ellipse'|'poly'|'line', ..., fill (0xRRGGBB | 'aura' | 'skin'), stroke, sw,
//   alpha, role: 'torso'|'prop'|'skin'|'leg'|'fist'|'hair'|'eye' }
// Hard ceiling: no opaque part above y = −112 (name row at −122 stays clear).

export const HEIGHT_LIMIT = 112;
const SKIN = 'skin';
const AURA = 'aura';
const LEG = 0x1b1d2e;
const W = 0xffffff;

function legs(gap, w, h, color) {
  return [
    { k: 'rect', x: -gap / 2 - w, y: -h, w: w, h: h, r: 4, fill: color || LEG, role: 'leg' },
    { k: 'rect', x: gap / 2, y: -h, w: w, h: h, r: 4, fill: color || LEG, role: 'leg' },
  ];
}
const torso = (w, top, bottom, r) => ({ k: 'rect', x: -w / 2, y: top, w: w, h: bottom - top, r: r === undefined ? 10 : r, fill: AURA, stroke: W, sw: 2, role: 'torso' });
const head = (cy, r) => ({ k: 'circle', x: 0, y: cy, r: r, fill: SKIN, stroke: W, sw: 2, role: 'skin' });
const eye = (cy, r) => ({ k: 'circle', x: r * 0.45, y: cy, r: 2.5, fill: 0x14172b, role: 'eye' });
const fist = (x, y, r, fill) => ({ k: 'circle', x: x, y: y, r: r, fill: fill || AURA, stroke: W, sw: 2, role: 'fist' });

/** Fighter recipes keyed by character id (exact lookup; unknown ids get DEFAULT). chest = aura icon centre y. */
export const FIGHTER_SHAPES = {
  // Tavi: small, wiry, braid trailing behind, red jacket flare, taped fists. Height 96.
  char_tavi_001: {
    height: 96, chest: -56,
    parts: [
      { k: 'poly', pts: [[-20, -34], [20, -34], [27, -16], [-27, -16]], fill: 0xc8282e, role: 'prop' }, // jacket flare
      ...legs(8, 11, 32),
      { k: 'line', x1: -9, y1: -88, x2: -18, y2: -46, w: 6, fill: 0xc7662b, role: 'hair' }, // braid
      torso(40, -76, -30),
      head(-84, 12), eye(-84, 12),
      { k: 'rect', x: -12, y: -96, w: 24, h: 6, r: 2, fill: AURA, role: 'prop' }, // headband
      fist(30, -56, 8), { k: 'rect', x: 24, y: -53, w: 12, h: 3, r: 1, fill: 0xe9dcc3, role: 'prop' },
    ],
  },
  // Lark: slim, kite-fin diamonds above the shoulders, teal cap, diagonal strap. Height 100.
  char_lark_001: {
    height: 100, chest: -58,
    parts: [
      { k: 'poly', pts: [[-22, -100], [-13, -84], [-22, -66], [-31, -84]], rot: { cx: -22, cy: -83, a: -0.35 }, fill: 0xf7fbff, stroke: 0x1fa39a, sw: 2, role: 'prop' },
      { k: 'poly', pts: [[22, -100], [31, -84], [22, -66], [13, -84]], rot: { cx: 22, cy: -83, a: 0.35 }, fill: 0xf7fbff, stroke: 0x1fa39a, sw: 2, role: 'prop' },
      ...legs(6, 10, 34),
      torso(36, -82, -34),
      { k: 'line', x1: -15, y1: -78, x2: 15, y2: -40, w: 4, fill: 0x2b3a67, role: 'prop' }, // strap
      head(-88, 12), eye(-88, 12),
      { k: 'poly', pts: [[-12, -88], [-11, -94], [-6, -99], [0, -100], [6, -99], [11, -94], [12, -88]], fill: 0x1fa39a, role: 'hair' }, // cap
      fist(27, -58, 7),
    ],
  },
  // Pell: robe trapezoid to the floor (legs hidden), staff + lantern in front, ponytail. Height 102, staff 112.
  char_pell_001: {
    height: 112, chest: -58,
    parts: [
      { k: 'line', x1: -7, y1: -94, x2: -16, y2: -70, w: 6, fill: 0xd8dce6, role: 'hair' }, // ponytail
      { k: 'poly', pts: [[-20, -34], [20, -34], [28, 0], [-28, 0]], fill: 0xfaf7ee, stroke: 0xe2b341, sw: 2, role: 'prop' }, // robe
      torso(40, -78, -32),
      head(-90, 12), eye(-90, 12),
      { k: 'line', x1: 30, y1: 0, x2: 30, y2: -110, w: 4, fill: 0x8a6a3a, role: 'prop' }, // staff
      { k: 'rect', x: 24, y: -108, w: 12, h: 16, r: 4, fill: 0xffe7a3, role: 'prop' }, // lantern
      { k: 'ellipse', x: -27, y: -54, w: 16, h: 22, fill: AURA, stroke: W, sw: 2, role: 'fist' }, // bell sleeve (back)
      fist(24, -56, 7),
    ],
  },
  // Rook: lanky, long legs, checker chest band, hood bump behind, raised back hand, forward-swept hair. Height 108.
  char_rook_001: {
    height: 108, chest: -84,
    parts: [
      { k: 'circle', x: -13, y: -88, r: 10, fill: 0x1a1a1a, role: 'prop' }, // hood bump
      { k: 'circle', x: -27, y: -82, r: 6, fill: AURA, stroke: W, sw: 2, role: 'fist' }, // raised back hand
      { k: 'rect', x: -31, y: -96, w: 2, h: 8, fill: AURA, role: 'fist' },
      { k: 'rect', x: -25, y: -96, w: 2, h: 8, fill: AURA, role: 'fist' },
      ...legs(6, 10, 40),
      torso(36, -92, -40),
      { k: 'checker', x: -16, y: -70, cols: 4, rows: 2, size: 8, fill: 0x1a1a1a, fill2: 0xf2f2f2, role: 'prop' },
      head(-96, 11), eye(-96, 11),
      { k: 'poly', pts: [[-11, -98], [-6, -106], [16, -108], [9, -100], [11, -96]], fill: 0x1f2330, role: 'hair' },
      fist(28, -62, 8),
    ],
  },
  // Solenne: broad shoulders, white sash diagonal with ticks, gold bracer, swept-back hair. Height 108.
  char_solenne_001: {
    height: 108, chest: -60,
    parts: [
      ...legs(10, 13, 36),
      torso(50, -86, -36),
      { k: 'line', x1: 20, y1: -84, x2: -20, y2: -40, w: 6, fill: 0xffffff, ticks: 9, tickFill: 0x14172b, role: 'prop' }, // sash
      head(-95, 13), eye(-95, 13),
      { k: 'poly', pts: [[-13, -100], [2, -108], [12, -103], [-4, -99], [-26, -92]], fill: 0xd9cba3, role: 'hair' },
      fist(36, -60, 9),
      { k: 'rect', x: 29, y: -55, w: 14, h: 6, r: 1, fill: 0xe8a21f, role: 'prop' }, // bracer
      { k: 'poly', pts: [[30, -49], [33, -45], [36, -49], [39, -45], [42, -49]], fill: 0xe8a21f, role: 'prop' },
    ],
  },
  // Thessa: tall triangle — long dark coat behind, half mask on the facing side, ink teardrops. Height 110.
  char_thessa_001: {
    height: 110, chest: -64,
    parts: [
      { k: 'poly', pts: [[-22, -90], [22, -90], [30, -10], [-30, -10]], fill: 0x15121f, stroke: 0x5b3a9e, sw: 2, role: 'prop' }, // coat
      ...legs(8, 10, 40),
      torso(44, -90, -40),
      head(-98, 12), eye(-98, 12),
      { k: 'mask', x: 0, y: -98, r: 12, fill: 0xedebe2, role: 'prop' }, // half mask, facing side, upper face
      fist(30, -62, 8),
      { k: 'circle', x: 26, y: -48, r: 2, fill: 0x2a1747, role: 'prop' },
      { k: 'circle', x: 31, y: -44, r: 2, fill: 0x2a1747, role: 'prop' },
      { k: 'circle', x: 35, y: -49, r: 2, fill: 0x2a1747, role: 'prop' },
    ],
  },
  // Dunmore: wide square block, short wide legs, beard, spectacles, triple-stone fists. Height 112.
  char_dunmore_001: {
    height: 112, chest: -58,
    parts: [
      ...legs(12, 16, 28),
      torso(64, -84, -28, 6),
      head(-99, 12), eye(-99, 12),
      { k: 'poly', pts: [[-9, -92], [9, -92], [14, -62], [-14, -62]], fill: 0x6b4a2e, role: 'hair' }, // beard
      { k: 'circle', x: 3, y: -101, r: 3, fill: 0xffffff, stroke: 0x14172b, sw: 1, role: 'prop' },
      { k: 'circle', x: 10, y: -101, r: 3, fill: 0xffffff, stroke: 0x14172b, sw: 1, role: 'prop' },
      { k: 'circle', x: -38, y: -52, r: 7, fill: 0x6e6c68, role: 'fist' },
      { k: 'circle', x: -42, y: -60, r: 7, fill: 0x8c8a85, role: 'fist' },
      { k: 'circle', x: -34, y: -60, r: 7, fill: 0xa9a49a, role: 'fist' },
      { k: 'circle', x: 38, y: -52, r: 7, fill: 0x6e6c68, role: 'fist' },
      { k: 'circle', x: 42, y: -60, r: 7, fill: 0x8c8a85, role: 'fist' },
      { k: 'circle', x: 34, y: -60, r: 7, fill: 0xa9a49a, role: 'fist' },
    ],
  },
  // Corvane: gaunt, five ribbons to the floor, floating shard crown, cracked dark fists. Height 112.
  char_corvane_001: {
    height: 112, chest: -70,
    parts: [
      ...[-24, -12, 0, 12, 24].map((hx, i) => ({ k: 'poly', pts: [[-12 + i * 6, -92], [-9 + i * 6, -92], [hx + 3, 0], [hx - 3, 0]], fill: 0x0e0b16, stroke: 0x9b6bff, sw: 1, role: 'prop' })),
      ...legs(4, 8, 44),
      torso(34, -94, -44),
      head(-97, 10), eye(-97, 10),
      ...[-12, -6, 0, 6, 12].map((cx) => ({ k: 'poly', pts: [[cx - 3, -104], [cx + 3, -104], [cx, -111]], fill: 0x2b2338, stroke: 0xc7a6ff, sw: 1, role: 'prop' })),
      { k: 'circle', x: 25, y: -64, r: 7, fill: 0x3a2f52, stroke: 0xc7a6ff, sw: 1, role: 'fist' },
      { k: 'line', x1: 21, y1: -67, x2: 28, y2: -61, w: 1, fill: 0xc7a6ff, role: 'prop' },
    ],
  },
};

/** The R3 body for unknown ids (never crash on new data). */
export const DEFAULT_SHAPE = {
  height: 107, chest: -56,
  parts: [
    ...legs(8, 12, 34),
    torso(44, -80, -30),
    head(-94, 13), eye(-94, 13),
    { k: 'rect', x: -13, y: -104, w: 26, h: 6, r: 2, fill: AURA, role: 'prop' },
    fist(28, -58, 8),
  ],
};

export function shapeFor(characterId) {
  return Object.prototype.hasOwnProperty.call(FIGHTER_SHAPES, characterId) ? FIGHTER_SHAPES[characterId] : DEFAULT_SHAPE;
}

// ------------------------------------------------------------------ Umbral (STYLE_GUIDE §9)
export const UMBRAL = { outline: 0x9b6bff, crack: 0xc7a6ff, eye: 0xc7a6ff, skin: 0x6b6278, base: 0x2a2238 };

/** Desaturate to 25% and shift toward #2A2238 (luminance roughly kept). */
export function umbralColor(c) {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  const ds = (v) => l + (v - l) * 0.25;
  const mix = (v, t) => Math.round(v * 0.6 + t * 0.4);
  const R = mix(ds(r), (UMBRAL.base >> 16) & 255);
  const G = mix(ds(g), (UMBRAL.base >> 8) & 255);
  const B = mix(ds(b), UMBRAL.base & 255);
  return (Math.max(0, Math.min(255, R)) << 16) | (Math.max(0, Math.min(255, G)) << 8) | Math.max(0, Math.min(255, B));
}

/** Floor-shadow rim colour per side (STYLE_GUIDE §11 item 7: player #4BE08A, enemy #FF5D5D, 40%). */
export const SIDE_RIM = { player: { color: 0x4be08a, alpha: 0.4 }, enemy: { color: 0xff5d5d, alpha: 0.4 } };

// ------------------------------------------------------------------ geometry (tests, extents)
function rotPt(p, rot) {
  if (!rot) return p;
  const c = Math.cos(rot.a);
  const s = Math.sin(rot.a);
  const dx = p[0] - rot.cx;
  const dy = p[1] - rot.cy;
  return [rot.cx + dx * c - dy * s, rot.cy + dx * s + dy * c];
}

/** Axis-aligned bounds of a primitive (authored coordinates). */
export function partBounds(p) {
  const sw = (p.sw || 0) / 2;
  switch (p.k) {
    case 'rect':
      return { x0: p.x - sw, y0: p.y - sw, x1: p.x + p.w + sw, y1: p.y + p.h + sw };
    case 'checker':
      return { x0: p.x, y0: p.y, x1: p.x + p.cols * p.size, y1: p.y + p.rows * p.size };
    case 'circle':
    case 'mask':
      return { x0: p.x - p.r - sw, y0: p.y - p.r - sw, x1: p.x + p.r + sw, y1: p.y + p.r + sw };
    case 'ellipse':
      return { x0: p.x - p.w / 2 - sw, y0: p.y - p.h / 2 - sw, x1: p.x + p.w / 2 + sw, y1: p.y + p.h / 2 + sw };
    case 'poly': {
      const pts = p.pts.map((q) => rotPt(q, p.rot));
      const xs = pts.map((q) => q[0]);
      const ys = pts.map((q) => q[1]);
      return { x0: Math.min(...xs) - sw, y0: Math.min(...ys) - sw, x1: Math.max(...xs) + sw, y1: Math.max(...ys) + sw };
    }
    case 'line':
      return { x0: Math.min(p.x1, p.x2) - p.w / 2, y0: Math.min(p.y1, p.y2) - p.w / 2, x1: Math.max(p.x1, p.x2) + p.w / 2, y1: Math.max(p.y1, p.y2) + p.w / 2 };
    default:
      return { x0: 0, y0: 0, x1: 0, y1: 0 };
  }
}

/** Bounds of the whole silhouette (opaque parts). */
export function shapeBounds(shape) {
  let b = { x0: 0, y0: 0, x1: 0, y1: 0 };
  for (const p of shape.parts) {
    if (p.alpha !== undefined && p.alpha < 1) continue;
    const q = partBounds(p);
    b = { x0: Math.min(b.x0, q.x0), y0: Math.min(b.y0, q.y0), x1: Math.max(b.x1, q.x1), y1: Math.max(b.y1, q.y1) };
  }
  return b;
}

/** Is authored point (x, y) inside primitive p? (rounded corners ignored; for tests and the silhouette sheet.) */
export function partContains(p, x, y) {
  switch (p.k) {
    case 'rect':
      return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
    case 'checker':
      return x >= p.x && x <= p.x + p.cols * p.size && y >= p.y && y <= p.y + p.rows * p.size;
    case 'circle':
      return (x - p.x) ** 2 + (y - p.y) ** 2 <= p.r * p.r;
    case 'mask':
      return x >= p.x && y <= p.y && (x - p.x) ** 2 + (y - p.y) ** 2 <= p.r * p.r;
    case 'ellipse':
      return ((x - p.x) / (p.w / 2)) ** 2 + ((y - p.y) / (p.h / 2)) ** 2 <= 1;
    case 'poly': {
      const pts = p.pts.map((q) => rotPt(q, p.rot));
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }
    case 'line': {
      const dx = p.x2 - p.x1;
      const dy = p.y2 - p.y1;
      const L2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - p.x1) * dx + (y - p.y1) * dy) / L2));
      return (x - (p.x1 + t * dx)) ** 2 + (y - (p.y1 + t * dy)) ** 2 <= (p.w / 2) ** 2;
    }
    default:
      return false;
  }
}

/** Occupancy mask on a grid (cell px) over x −64..64, y −120..8: Set of "cx,cy" filled cells. */
export function silhouetteMask(shape, cell) {
  const c = cell || 4;
  const out = new Set();
  for (let y = -120; y <= 8; y += c) {
    for (let x = -64; x <= 64; x += c) {
      if (shape.parts.some((p) => partContains(p, x + c / 2, y + c / 2))) out.add(x + ',' + y);
    }
  }
  return out;
}
