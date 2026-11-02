// Shape icons so colour is never the only cue (GDD §5.12, §5.4, §14).
// Aura: Blaze = flame, Gale = swirl, Stone = hexagon, Radiant = star, Void = crescent.
// Card type: Fist = square fist block, Bolt = arrow, Signature = diamond, Climax = 8-point burst.
import { auraColor, CARD_COLORS } from './theme.js';

function starPoints(cx, cy, points, outer, inner, rot) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (Math.PI * i) / points;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

/** Draw an aura icon centred at cx,cy with radius r into Graphics g. */
export function drawAuraIcon(g, aura, cx, cy, r, colorOverride) {
  const c = colorOverride !== undefined ? colorOverride : auraColor(aura);
  g.fillStyle(c, 1);
  g.lineStyle(Math.max(1, r * 0.18), 0x000000, 0.6);
  switch (aura) {
    case 'blaze': {
      // flame: teardrop
      g.beginPath();
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r * 0.75, cy + r * 0.25);
      g.arc(cx, cy + r * 0.25, r * 0.75, 0, Math.PI, false);
      g.lineTo(cx, cy - r);
      g.closePath();
      g.fillPath();
      g.strokePath();
      break;
    }
    case 'gale': {
      g.fillCircle(cx, cy, r);
      g.strokeCircle(cx, cy, r);
      g.lineStyle(Math.max(1.5, r * 0.25), 0x0d1020, 0.9);
      g.beginPath();
      g.arc(cx, cy, r * 0.55, Math.PI * 0.1, Math.PI * 1.6, false);
      g.strokePath();
      g.beginPath();
      g.arc(cx + r * 0.1, cy, r * 0.2, Math.PI, Math.PI * 2.5, false);
      g.strokePath();
      break;
    }
    case 'stone': {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (Math.PI * i) / 3;
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
      break;
    }
    case 'radiant': {
      const pts = starPoints(cx, cy, 5, r, r * 0.45, -Math.PI / 2);
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
      break;
    }
    case 'void': {
      g.fillCircle(cx, cy, r);
      g.strokeCircle(cx, cy, r);
      g.fillStyle(0x0d1020, 1);
      g.fillCircle(cx + r * 0.4, cy - r * 0.2, r * 0.8);
      break;
    }
    default:
      g.fillCircle(cx, cy, r);
  }
}

/** Draw a card-type icon centred at cx,cy (size s = half width). */
export function drawCardTypeIcon(g, type, cx, cy, s, color) {
  const c = color !== undefined ? color : 0xffffff;
  g.fillStyle(c, 1);
  switch (type) {
    case 'fist':
      g.fillRoundedRect(cx - s, cy - s * 0.8, s * 2, s * 1.6, s * 0.4);
      g.fillStyle(0x000000, 0.35);
      g.fillRect(cx - s * 0.5, cy - s * 0.8, s * 0.12, s * 0.9);
      g.fillRect(cx, cy - s * 0.8, s * 0.12, s * 0.9);
      g.fillRect(cx + s * 0.5, cy - s * 0.8, s * 0.12, s * 0.9);
      break;
    case 'bolt':
      g.fillPoints(
        [
          { x: cx - s, y: cy - s * 0.35 },
          { x: cx + s * 0.1, y: cy - s * 0.35 },
          { x: cx + s * 0.1, y: cy - s },
          { x: cx + s, y: cy },
          { x: cx + s * 0.1, y: cy + s },
          { x: cx + s * 0.1, y: cy + s * 0.35 },
          { x: cx - s, y: cy + s * 0.35 },
        ],
        true
      );
      break;
    case 'signature':
      g.fillPoints(
        [
          { x: cx, y: cy - s },
          { x: cx + s, y: cy },
          { x: cx, y: cy + s },
          { x: cx - s, y: cy },
        ],
        true
      );
      break;
    case 'climax':
      g.fillPoints(starPoints(cx, cy, 8, s, s * 0.5, 0), true);
      break;
    default:
      g.fillCircle(cx, cy, s);
  }
}

export function cardColor(type) {
  return CARD_COLORS[type] !== undefined ? CARD_COLORS[type] : 0x666666;
}
