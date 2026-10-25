// Vector versions of the plain-shape atlas frames (round 7, reviewer R-2 / AC-17.7).
//
// Why: in Chrome's Canvas 2D renderer every textured drawImage() is rasterized with bilinear sampling and costs far
// more than a solid path fill of the same shape (measured at 4× CPU, 360×640 @2×: 150 small particle images +3.3 ms
// raster per frame vs 150 vector dots +0.4 ms; 8 ring images +3.3 ms vs 8 stroked rings +1.5 ms). So on the Canvas
// renderer the pooled VFX images of these frames draw their shape as a cached Path2D fill/stroke instead of sampling
// the atlas. The geometry below is the single source for both the atlas painters (src/vfx/atlas.js) and the vector
// draw, so the two cannot drift. The WebGL renderer keeps drawing the atlas images (batched, unchanged).
//
// Coordinates are local to the frame cell (0..w, 0..h), exactly as in the atlas painters. Every part is drawn in
// the image's tint colour ('tint'), or a darkened tint ('dark', the Void crescent body), like the WebGL tint of the
// white atlas shape. Path2D is browser-only: buildShape() is called lazily from the renderer / atlas only.

/** Frames that have a vector version (everything else, e.g. gradients, portraits, baked back-shapes, stays an image). */
export const VECTOR_FRAMES = ['dot', 'ember', 'chevron', 'kite', 'hex', 'star4', 'star5', 'crescent', 'diamond', 'ring', 'ring_seg', 'disc', 'ghost'];

const TAU = Math.PI * 2;

export function starPts(cx, cy, n, ro, ri, rot) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro;
    const a = rot + (i * Math.PI) / n;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

export function hexPts(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) pts.push([cx + Math.cos((i * Math.PI) / 3) * r, cy + Math.sin((i * Math.PI) / 3) * r]);
  return pts;
}

/** Append a closed polygon to a path-like target (CanvasRenderingContext2D or Path2D). */
export function polyTo(p, pts) {
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
}

/** Teardrop (point up, round bottom) on a path-like target. */
export function teardropTo(p, cx, cy, w, h) {
  p.moveTo(cx, cy - h / 2);
  p.bezierCurveTo(cx + w * 0.6, cy - h * 0.05, cx + w / 2, cy + h / 2, cx, cy + h / 2);
  p.bezierCurveTo(cx - w / 2, cy + h / 2, cx - w * 0.6, cy - h * 0.05, cx, cy - h / 2);
  p.closePath();
}

/**
 * Crescent = disc (cx, cy, r) minus the disc (cx + 0.55 r, cy − 0.25 r, 0.85 r) — the same shape the atlas used to
 * cut with 'destination-out', as one closed outline (outer arc the long way round, inner arc back).
 */
export function crescentTo(p, cx, cy, r) {
  const bx = cx + r * 0.55;
  const by = cy - r * 0.25;
  const rb = r * 0.85;
  const dx = bx - cx;
  const dy = by - cy;
  const d = Math.sqrt(dx * dx + dy * dy);
  const a = (r * r - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r * r - a * a));
  const ux = dx / d;
  const uy = dy / d;
  const p1x = cx + a * ux - h * uy;
  const p1y = cy + a * uy + h * ux;
  const p2x = cx + a * ux + h * uy;
  const p2y = cy + a * uy - h * ux;
  p.moveTo(p1x, p1y);
  p.arc(cx, cy, r, Math.atan2(p1y - cy, p1x - cx), Math.atan2(p2y - cy, p2x - cx), false); // away from the cut
  p.arc(bx, by, rb, Math.atan2(p2y - by, p2x - bx), Math.atan2(p1y - by, p1x - bx), true); // back along the cut
  p.closePath();
}

/**
 * Shape parts of a frame in cell coordinates: [{ build(path), mode: 'fill'|'stroke', lineWidth, color: 'tint'|'dark' }].
 * `ringR` / `discR` = the atlas ring / disc radii (RING_RADIUS, DISC_RADIUS).
 */
export function shapeParts(frame, w, h, ringR, discR) {
  const F = (build, color) => ({ build: build, mode: 'fill', lineWidth: 0, color: color || 'tint' });
  const S = (build, lw) => ({ build: build, mode: 'stroke', lineWidth: lw, color: 'tint' });
  switch (frame) {
    case 'dot': return [F((p) => p.arc(w / 2, h / 2, w / 2 - 1, 0, TAU))];
    case 'ember': return [F((p) => teardropTo(p, w / 2, h / 2, w - 4, h - 2))];
    case 'chevron': return [F((p) => polyTo(p, [[2, 2], [w - 2, h / 2], [2, h - 2], [7, h / 2]]))];
    case 'kite': return [F((p) => polyTo(p, [[w / 2, 1], [w - 1, h * 0.4], [w / 2, h - 1], [1, h * 0.4]]))];
    case 'hex': return [F((p) => polyTo(p, hexPts(w / 2, h / 2, w / 2 - 1)))];
    case 'star4': return [F((p) => polyTo(p, starPts(w / 2, h / 2, 4, w / 2 - 1, w * 0.14, -Math.PI / 2)))];
    case 'star5': return [F((p) => polyTo(p, starPts(w / 2, h / 2, 5, w / 2 - 1, w * 0.22, -Math.PI / 2)))];
    case 'diamond': return [F((p) => polyTo(p, [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]))];
    // Void: dark body + bright rim (§7.1)
    case 'crescent': {
      const r = w / 2 - 1;
      return [
        F((p) => crescentTo(p, w / 2, h / 2, r), 'dark'),
        S((p) => p.arc(w / 2, h / 2, r - 1, Math.PI * 0.35, Math.PI * 1.55), 2),
      ];
    }
    case 'ring': return [S((p) => p.arc(w / 2, h / 2, ringR, 0, TAU), 3)];
    // segmented ring: shape-distinct from the solid card-colour windup ring (style guide §2.3)
    case 'ring_seg': return [S((p) => {
      for (let i = 0; i < 8; i++) {
        const a0 = (i * Math.PI) / 4 + 0.08;
        p.moveTo(w / 2 + Math.cos(a0) * ringR, h / 2 + Math.sin(a0) * ringR);
        p.arc(w / 2, h / 2, ringR, a0, ((i + 1) * Math.PI) / 4 - 0.18);
      }
    }, 4)];
    case 'disc': return [F((p) => p.arc(w / 2, h / 2, discR, 0, TAU))];
    // afterimage silhouette (placeholder body: legs, torso, head), facing right
    case 'ghost': return [F((p) => {
      p.rect(w / 2 - 16, h - 34, 12, 34);
      p.rect(w / 2 + 4, h - 34, 12, 34);
      if (p.roundRect) p.roundRect(w / 2 - 22, h - 80, 44, 50, 10);
      else p.rect(w / 2 - 22, h - 80, 44, 50);
      p.moveTo(w / 2 + 13, h - 94);
      p.arc(w / 2, h - 94, 13, 0, TAU);
      // fist: the circle (w/2 + 28, r 8) sits on the cell's right edge; the atlas cell clip always cut it to its
      // left half, so the shape IS that half (vector draw = atlas pixels)
      p.moveTo(w / 2 + 28, h - 50);
      p.arc(w / 2 + 28, h - 58, 8, Math.PI / 2, Math.PI * 1.5);
      p.closePath();
    })];
    default: return null;
  }
}

/** Paint a frame's parts in one colour onto a 2D context (the atlas uses this with '#fff'). Returns false if none. */
export function paintShape(ctx, frame, w, h, ringR, discR, color, darkColor) {
  const parts = shapeParts(frame, w, h, ringR, discR);
  if (!parts) return false;
  for (const pt of parts) {
    ctx.beginPath();
    pt.build(ctx);
    if (pt.mode === 'fill') {
      ctx.fillStyle = pt.color === 'dark' ? darkColor || color : color;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = pt.lineWidth;
      ctx.stroke();
    }
  }
  return true;
}

const hex2 = (v) => (v < 16 ? '0' : '') + v.toString(16);

/** '#rrggbb' for an int colour, and the Void-body darkening (× 70/255, as the atlas' rgba(70,70,70) under a tint). */
export function cssOf(c, dark) {
  let r = (c >> 16) & 255;
  let g = (c >> 8) & 255;
  let b = c & 255;
  if (dark) {
    r = Math.round((r * 70) / 255);
    g = Math.round((g * 70) / 255);
    b = Math.round((b * 70) / 255);
  }
  return '#' + hex2(r) + hex2(g) + hex2(b);
}
