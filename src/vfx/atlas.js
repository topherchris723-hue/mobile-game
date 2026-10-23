// Procedural VFX atlas: every VFX shape drawn in code with Canvas 2D into ONE 512×512 texture (GDD §17.4: one atlas
// ≤ 1,024², generated shapes; no image files, nothing to license). Shapes follow docs/STYLE_GUIDE.md §7.1 and the
// art briefs' Ignition "Placeholder recipe". White shapes take a tint; back-shapes bake the brief's hex colours.
import { FRAMES } from './particles.js';

export const ATLAS_KEY = 'vfx_gen_atlas';
export const ATLAS_SIZE = 512;

/** Frame cell sizes (w, h) in px. `r` = the drawn radius for ring/disc frames (renderer scales by it). */
export const FRAME_SIZES = {
  dot: [16, 16], soft: [32, 32], ember: [16, 24], chevron: [20, 16], kite: [12, 20], hex: [16, 16], star4: [20, 20],
  star5: [20, 20], crescent: [20, 20], diamond: [14, 20], streak_small: [24, 6], ring: [64, 64], ring_seg: [64, 64],
  disc: [32, 32], streak: [64, 8], ghost: [56, 124], beam: [32, 128], back_ellipse: [96, 144], back_tavi: [72, 132],
  back_pell: [112, 112], back_rook: [112, 112], back_solenne: [124, 124], back_thessa: [112, 112],
  back_corvane: [152, 132], portrait_blaze: [48, 48], portrait_gale: [48, 48], portrait_stone: [48, 48],
  portrait_radiant: [48, 48], portrait_void: [48, 48],
};
export const RING_RADIUS = 30; // ring / ring_seg drawn radius inside the 64 px cell
export const DISC_RADIUS = 15; // disc drawn radius inside the 32 px cell

/** Shelf-pack the frames. Pure, so the layout is testable headlessly. Returns { name: { x, y, w, h } }. */
export function layoutAtlas(size) {
  const S = size || ATLAS_SIZE;
  const out = {};
  const pad = 2;
  const order = FRAMES.slice().sort((a, b) => FRAME_SIZES[b][1] - FRAME_SIZES[a][1]);
  let x = pad;
  let y = pad;
  let shelf = 0;
  for (const f of order) {
    const [w, h] = FRAME_SIZES[f];
    if (x + w + pad > S) {
      x = pad;
      y += shelf + pad;
      shelf = 0;
    }
    if (y + h + pad > S) throw new Error('vfx atlas overflow at ' + f);
    out[f] = { x: x, y: y, w: w, h: h };
    x += w + pad;
    shelf = Math.max(shelf, h);
  }
  return out;
}

const hex = (n, a) => 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + (a === undefined ? 1 : a) + ')';

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function starPts(cx, cy, n, ro, ri, rot) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro;
    const a = rot + (i * Math.PI) / n;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function teardrop(ctx, cx, cy, w, h) {
  // point up, round bottom
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.bezierCurveTo(cx + w * 0.6, cy - h * 0.05, cx + w / 2, cy + h / 2, cx, cy + h / 2);
  ctx.bezierCurveTo(cx - w / 2, cy + h / 2, cx - w * 0.6, cy - h * 0.05, cx, cy - h / 2);
  ctx.closePath();
}

function hexPts(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) pts.push([cx + Math.cos((i * Math.PI) / 3) * r, cy + Math.sin((i * Math.PI) / 3) * r]);
  return pts;
}

function crescent(ctx, cx, cy, r, fill, rim) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx + r * 0.55, cy - r * 0.25, r * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (rim) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, Math.PI * 0.35, Math.PI * 1.55);
    ctx.lineWidth = 2;
    ctx.strokeStyle = rim;
    ctx.stroke();
    ctx.restore();
  }
}

/** Draw the aura shape (flame, swirl, hexagon, star, crescent — the same shapes as src/ui/icons.js). */
function auraShape(ctx, aura, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (aura === 'blaze') {
    teardrop(ctx, cx, cy, r * 1.2, r * 2);
    ctx.fill();
  } else if (aura === 'gale') {
    ctx.lineWidth = r * 0.32;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 3.2;
      const rr = (i / 40) * r;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (aura === 'stone') {
    poly(ctx, hexPts(cx, cy, r));
    ctx.fill();
  } else if (aura === 'radiant') {
    poly(ctx, starPts(cx, cy, 5, r, r * 0.45, -Math.PI / 2));
    ctx.fill();
  } else {
    crescent(ctx, cx, cy, r, color, null);
  }
}

const AURA_KEYS = { blaze: 0xff6a3d, gale: 0x3ddc97, stone: 0xc9a36b, radiant: 0xffd84a, void: 0x9b6bff };

/** Frame painters: (ctx, w, h). Coordinates are local to the cell. */
const PAINT = {
  dot(c, w, h) { c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2); c.fill(); },
  soft(c, w, h) {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  },
  ember(c, w, h) { c.fillStyle = '#fff'; teardrop(c, w / 2, h / 2, w - 4, h - 2); c.fill(); },
  chevron(c, w, h) { c.fillStyle = '#fff'; poly(c, [[2, 2], [w - 2, h / 2], [2, h - 2], [7, h / 2]]); c.fill(); },
  kite(c, w, h) { c.fillStyle = '#fff'; poly(c, [[w / 2, 1], [w - 1, h * 0.4], [w / 2, h - 1], [1, h * 0.4]]); c.fill(); },
  hex(c, w, h) { c.fillStyle = '#fff'; poly(c, hexPts(w / 2, h / 2, w / 2 - 1)); c.fill(); },
  star4(c, w, h) { c.fillStyle = '#fff'; poly(c, starPts(w / 2, h / 2, 4, w / 2 - 1, w * 0.14, -Math.PI / 2)); c.fill(); },
  star5(c, w, h) { c.fillStyle = '#fff'; poly(c, starPts(w / 2, h / 2, 5, w / 2 - 1, w * 0.22, -Math.PI / 2)); c.fill(); },
  // Void: dark fill + bright rim (tinted #C7A6FF-ish by the key colour; fill stays dark, §7.1)
  crescent(c, w, h) { crescent(c, w / 2, h / 2, w / 2 - 1, 'rgba(70,70,70,1)', 'rgba(255,255,255,1)'); },
  diamond(c, w, h) { c.fillStyle = '#fff'; poly(c, [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]); c.fill(); },
  streak_small(c, w, h) {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g; c.fillRect(0, 1, w, h - 2);
  },
  ring(c, w, h) { c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(w / 2, h / 2, RING_RADIUS, 0, Math.PI * 2); c.stroke(); },
  // segmented ring: shape-distinct from the solid card-colour windup ring (style guide §2.3)
  ring_seg(c, w, h) {
    c.strokeStyle = '#fff'; c.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      c.beginPath();
      c.arc(w / 2, h / 2, RING_RADIUS, (i * Math.PI) / 4 + 0.08, ((i + 1) * Math.PI) / 4 - 0.18);
      c.stroke();
    }
  },
  disc(c, w, h) { c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, h / 2, DISC_RADIUS, 0, Math.PI * 2); c.fill(); },
  streak(c, w, h) {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  },
  // afterimage silhouette (placeholder body: legs, torso, head), facing right
  ghost(c, w, h) {
    c.fillStyle = '#fff';
    c.fillRect(w / 2 - 16, h - 34, 12, 34); c.fillRect(w / 2 + 4, h - 34, 12, 34);
    c.beginPath(); c.roundRect ? c.roundRect(w / 2 - 22, h - 80, 44, 50, 10) : c.rect(w / 2 - 22, h - 80, 44, 50); c.fill();
    c.beginPath(); c.arc(w / 2, h - 94, 13, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(w / 2 + 28, h - 58, 8, 0, Math.PI * 2); c.fill();
  },
  beam(c, w, h) {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.35, 'rgba(255,255,255,0.8)'); g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  },
  back_ellipse(c, w, h) {
    const g = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.7, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.save(); c.scale(1, h / w); c.fillStyle = g; c.beginPath(); c.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); c.fill(); c.restore();
  },
  // Tavi: braid becomes 3 stacked Blaze teardrops in the ramp; tall heat-shimmer teardrop behind (brief)
  back_tavi(c, w, h) {
    c.fillStyle = hex(0xff6a3d, 0.4); teardrop(c, w / 2, h / 2, w - 6, h - 4); c.fill();
    const ramp = [0xc8282e, 0xff6a3d, 0xffb13d];
    for (let i = 0; i < 3; i++) { c.fillStyle = hex(ramp[i], 0.95); teardrop(c, w * 0.72, h * 0.72 - i * 24, 18 - i * 3, 30 - i * 4); c.fill(); }
    c.fillStyle = hex(0xfff4d6, 1); teardrop(c, w * 0.72, h * 0.72 - 64, 8, 14); c.fill();
  },
  // Pell: 7 lanterns r5 #FFE7A3 orbiting at radius 40 + soft radiant ring (brief)
  back_pell(c, w, h) {
    c.strokeStyle = hex(0xfff0a8, 0.5); c.lineWidth = 6; c.beginPath(); c.arc(w / 2, h / 2, 40, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const x = w / 2 + Math.cos(a) * 40;
      const y = h / 2 + Math.sin(a) * 40;
      c.fillStyle = hex(0xffe7a3, 1); c.fillRect(x - 5, y - 6, 10, 12);
      c.fillStyle = hex(0xffffff, 0.9); c.fillRect(x - 2, y - 3, 4, 6);
    }
  },
  // Rook: 8 checker tiles orbiting at radius 44 in a Gale spiral (brief)
  back_rook(c, w, h) {
    c.strokeStyle = hex(0x3ddc97, 0.45); c.lineWidth = 3; c.beginPath();
    for (let i = 0; i <= 50; i++) {
      const a = (i / 50) * Math.PI * 3;
      const r = 8 + (i / 50) * 42;
      const x = w / 2 + Math.cos(a) * r;
      const y = h / 2 + Math.sin(a) * r;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = w / 2 + Math.cos(a) * 44;
      const y = h / 2 + Math.sin(a) * 44;
      c.fillStyle = i % 2 ? '#f2f2f2' : '#1a1a1a'; c.fillRect(x - 6, y - 6, 12, 12);
      c.strokeStyle = '#3ddc97'; c.lineWidth = 1.5; c.strokeRect(x - 6, y - 6, 12, 12);
    }
  },
  // Solenne: sun disc r45 #FFD27A at 40% + 8 triangle rays in Blaze key, core #FFF4D6 (brief)
  back_solenne(c, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      c.fillStyle = hex(0xff6a3d, 0.85);
      poly(c, [[cx + Math.cos(a - 0.12) * 44, cy + Math.sin(a - 0.12) * 44], [cx + Math.cos(a) * 60, cy + Math.sin(a) * 60], [cx + Math.cos(a + 0.12) * 44, cy + Math.sin(a + 0.12) * 44]]);
      c.fill();
    }
    c.fillStyle = hex(0xffd27a, 0.4); c.beginPath(); c.arc(cx, cy, 45, 0, Math.PI * 2); c.fill();
    c.fillStyle = hex(0xfff4d6, 0.5); c.beginPath(); c.arc(cx, cy, 24, 0, Math.PI * 2); c.fill();
  },
  // Thessa: dark crescent eclipse disc with a #C7A6FF rim (brief back-shape)
  back_thessa(c, w, h) {
    c.fillStyle = hex(0x15121f, 0.9); c.beginPath(); c.arc(w / 2, h / 2, 46, 0, Math.PI * 2); c.fill();
    c.strokeStyle = hex(0xc7a6ff, 1); c.lineWidth = 3; c.beginPath(); c.arc(w / 2, h / 2, 46, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = hex(0xc7a6ff, 0.8); c.lineWidth = 6; c.beginPath(); c.arc(w / 2, h / 2, 50, Math.PI * 0.6, Math.PI * 1.4); c.stroke();
  },
  // Corvane: 7 large triangles fanned behind like a throne (≤ 40% alpha), #C7A6FF edges (brief)
  back_corvane(c, w, h) {
    const cx = w / 2;
    const by = h - 6;
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.32;
      const len = i === 3 ? 120 : 100 - Math.abs(i - 3) * 8;
      const tip = [cx + Math.cos(a) * len, by + Math.sin(a) * len];
      const l = [cx + Math.cos(a - 0.12) * 24, by + Math.sin(a - 0.12) * 24];
      const r = [cx + Math.cos(a + 0.12) * 24, by + Math.sin(a + 0.12) * 24];
      c.fillStyle = hex(0x2b2338, 0.4); poly(c, [l, tip, r]); c.fill();
      c.strokeStyle = hex(0xc7a6ff, 0.4); c.lineWidth = 1.5; c.stroke();
    }
  },
};
for (const a of Object.keys(AURA_KEYS)) {
  PAINT['portrait_' + a] = (c, w, h) => {
    c.fillStyle = hex(AURA_KEYS[a], 1); c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.stroke();
    auraShape(c, a, w / 2, h / 2, w * 0.26, '#ffffff');
  };
}

/** Create (once per game) the atlas texture with one named frame per FRAMES entry. Returns the texture key. */
export function ensureAtlas(scene) {
  const tm = scene.textures;
  if (tm.exists(ATLAS_KEY)) return ATLAS_KEY;
  const layout = layoutAtlas(ATLAS_SIZE);
  const tex = tm.createCanvas(ATLAS_KEY, ATLAS_SIZE, ATLAS_SIZE);
  const ctx = tex.getContext();
  for (const f of FRAMES) {
    const r = layout[f];
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.beginPath();
    ctx.rect(0, 0, r.w, r.h);
    ctx.clip();
    try {
      PAINT[f](ctx, r.w, r.h);
    } catch (e) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(r.w / 4, r.h / 4, r.w / 2, r.h / 2); // missing painter: a generated square (§17.1 rule 3)
    }
    ctx.restore();
    tex.add(f, 0, r.x, r.y, r.w, r.h);
  }
  tex.refresh();
  return ATLAS_KEY;
}
