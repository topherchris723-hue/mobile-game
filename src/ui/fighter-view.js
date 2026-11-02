// Placeholder fighter: coloured silhouette in the aura colour, aura icon on the chest, name tag.
// Poses come only from the logic snapshot (state, action, ignition, invulnerable).
import { auraColor, COLORS } from './theme.js';
import { drawAuraIcon, cardColor } from './icons.js';
import { shapeFor, shapeBounds, umbralColor, UMBRAL, SIDE_RIM } from './fighter-shapes.js';

const SKIN_COLOR = 0xf1d3b8;

/**
 * Draw a fighter shape (src/ui/fighter-shapes.js) into Graphics g. o = { aura, facing, scale, umbral, side,
 * silhouette (black fill only, for the silhouette sheet) }. Torso and fists keep the aura key colour (approved type
 * read); Umbral (STYLE_GUIDE §9) darkens every colour, outlines in violet, adds cracks and glowing eyes, and draws the
 * chest aura icon in the REAL aura colour.
 */
/**
 * Draw a fighter look once into a texture (cached by key) and return { key, feetX, feetY } in texture px. The box is
 * the shape's own bounds (+ shadow, + 4 px), so the per-frame image draw covers as few pixels as the old vector body
 * (Canvas renderer fill cost, AC-17.7).
 */
export function bakeFighter(scene, shape, id, o) {
  const zoom = (scene.vp && scene.vp.zoom) || 1;
  const key = ['fv', id, o.aura, o.facing, o.scale, o.umbral ? 'u' : 'b', o.side, zoom.toFixed(2)].join('_');
  const s = o.scale || 1;
  const b = shapeBounds(shape);
  const fx = o.facing || 1;
  const x0 = Math.min(fx > 0 ? b.x0 : -b.x1, -34) * s - 4; // shadow ellipse is ±32·s
  const x1 = Math.max(fx > 0 ? b.x1 : -b.x0, 34) * s + 4;
  const y0 = b.y0 * s - 4;
  const y1 = 12;
  const meta = { key: key, feetX: -x0 * zoom, feetY: -y0 * zoom, w: Math.ceil((x1 - x0) * zoom), h: Math.ceil((y1 - y0) * zoom) };
  if (scene.textures.exists(key)) return meta;
  const g = scene.make.graphics({ add: false });
  // drawn at device resolution so the baked body stays sharp (the image is scaled by 1/zoom, the camera by zoom)
  drawFighter(g, shape, Object.assign({}, o, { zoom: zoom, offset: { x: meta.feetX, y: meta.feetY } }));
  g.generateTexture(key, meta.w, meta.h);
  g.destroy();
  return meta;
}

export function drawFighter(g, shape, o) {
  const s = o.scale || 1;
  const fx = o.facing || 1;
  const aura = auraColor(o.aura);
  const black = !!o.silhouette;
  const col = (c) => {
    if (black) return 0x000000;
    let v = c === 'aura' ? aura : c === 'skin' ? SKIN_COLOR : c;
    if (o.umbral) v = c === 'skin' ? UMBRAL.skin : umbralColor(v);
    return v;
  };
  const strokeCol = (c) => (black ? 0x000000 : o.umbral ? UMBRAL.outline : c);
  const X = (x) => x * s * fx;
  const Y = (y) => y * s;
  g.clear();
  if (o.offset) {
    // texture bake: feet at (offset.x, offset.y) in device px, drawn at device resolution
    g.translateCanvas(o.offset.x, o.offset.y);
    if (o.zoom && o.zoom !== 1) g.scaleCanvas(o.zoom, o.zoom);
  }
  if (!black) {
    // floor shadow with a side-coloured rim (§11 item 7); Umbral: violet smoke wisps at the edge (§9)
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(0, 2, 64 * s, 12);
    const rim = SIDE_RIM[o.side] || SIDE_RIM.player;
    g.lineStyle(2, rim.color, rim.alpha);
    g.strokeEllipse(0, 2, 64 * s, 12);
    if (o.umbral) {
      g.fillStyle(UMBRAL.outline, 0.45);
      for (const dx of [-30, -18, 20, 31]) g.fillEllipse(dx * s, 1, 10 * s, 5);
    }
  }
  for (const p of shape.parts) {
    if (p.role === 'eye') {
      if (black) continue;
      g.fillStyle(o.umbral ? UMBRAL.eye : col(p.fill), 1);
      g.fillCircle(X(p.x), Y(p.y), (o.umbral ? 3 : p.r) * s);
      continue;
    }
    g.fillStyle(col(p.fill), p.alpha === undefined ? 1 : p.alpha);
    const sw = p.sw || 0;
    if (sw) g.lineStyle(sw, strokeCol(p.stroke), 0.85);
    switch (p.k) {
      case 'rect': {
        const x = fx > 0 ? p.x : -(p.x + p.w);
        if (p.r) {
          g.fillRoundedRect(x * s, Y(p.y), p.w * s, p.h * s, p.r);
          if (sw) g.strokeRoundedRect(x * s, Y(p.y), p.w * s, p.h * s, p.r);
        } else {
          g.fillRect(x * s, Y(p.y), p.w * s, p.h * s);
          if (sw) g.strokeRect(x * s, Y(p.y), p.w * s, p.h * s);
        }
        break;
      }
      case 'circle':
        g.fillCircle(X(p.x), Y(p.y), p.r * s);
        if (sw) g.strokeCircle(X(p.x), Y(p.y), p.r * s);
        break;
      case 'ellipse':
        g.fillEllipse(X(p.x), Y(p.y), p.w * s, p.h * s);
        if (sw) g.strokeEllipse(X(p.x), Y(p.y), p.w * s, p.h * s);
        break;
      case 'mask': {
        // half circle over the upper face on the facing side
        g.beginPath();
        g.moveTo(X(p.x), Y(p.y));
        g.arc(X(p.x), Y(p.y), p.r * s, fx > 0 ? -Math.PI / 2 : Math.PI, fx > 0 ? 0 : Math.PI * 1.5, false);
        g.closePath();
        g.fillPath();
        break;
      }
      case 'poly': {
        const pts = p.pts.map((q) => {
          let x = q[0];
          let y = q[1];
          if (p.rot) {
            const c = Math.cos(p.rot.a);
            const sn = Math.sin(p.rot.a);
            const dx = x - p.rot.cx;
            const dy = y - p.rot.cy;
            x = p.rot.cx + dx * c - dy * sn;
            y = p.rot.cy + dx * sn + dy * c;
          }
          return { x: X(x), y: Y(y) };
        });
        g.fillPoints(pts, true);
        if (sw) g.strokePoints(pts, true);
        break;
      }
      case 'line': {
        g.lineStyle(p.w * s, col(p.fill), 1);
        g.lineBetween(X(p.x1), Y(p.y1), X(p.x2), Y(p.y2));
        if (p.ticks && !black) {
          g.lineStyle(1.5, col(p.tickFill), 1);
          for (let i = 1; i <= p.ticks; i++) {
            const t = i / (p.ticks + 1);
            const cx = p.x1 + (p.x2 - p.x1) * t;
            const cy = p.y1 + (p.y2 - p.y1) * t;
            g.lineBetween(X(cx - 2), Y(cy - 2), X(cx + 2), Y(cy + 2));
          }
        }
        break;
      }
      default:
        break;
    }
  }
  if (black) return;
  if (o.umbral) {
    // 4 crack lines across the torso (Corvane's cracked-glass motif)
    g.lineStyle(1, UMBRAL.crack, 0.9);
    const cracks = [[-8, -70, 2, -58], [2, -58, -4, -46], [6, -76, 12, -64], [-12, -52, -4, -44]];
    for (const c of cracks) g.lineBetween(X(c[0]), Y(c[1]), X(c[2]), Y(c[3]));
  }
  drawAuraIcon(g, o.aura, 0, Y(shape.chest), 9, o.umbral ? aura : 0xffffff);
}

export class FighterView {
  /** opts.variantOf(fighterSnapshot) → 'umbral' | null (from enemies.json `variant`; never from ids or names). */
  constructor(scene, facing, opts) {
    this.scene = scene;
    this.variantOf = opts && opts.variantOf ? opts.variantOf : null;
    this.facing = facing; // +1 faces right (player), -1 faces left (enemy)
    this.root = scene.add.container(0, 0);
    this.glow = scene.add.graphics();
    // The body is baked once per look into a texture and shown as an Image: a Graphics with ~30 primitives would be
    // replayed every frame by the Canvas renderer (AC-17.7 frame budget).
    this.body = scene.add.image(0, 0, '__DEFAULT').setVisible(false);
    this.windupRing = scene.add.graphics();
    // The name label lives outside the rotating body so it stays on one fixed row above the head
    // (it never swings into the damage-number area on Knockdown/KO; floating texts avoid this row).
    this.nameTag = scene.text(0, 0, '', 13, COLORS.text, { fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(1);
    this.nameOffset = -122;
    this.floorY = 0;
    this.root.add([this.glow, this.windupRing, this.body]);
    this.key = null;
    this.flash = 0;
    this.x = null;
  }

  setFighter(f) {
    const variant = this.variantOf ? this.variantOf(f) : null;
    const umbral = variant === 'umbral';
    const key = f.characterId + '|' + (umbral ? 'umbral' : 'base') + '|' + (f.boss ? 'boss' : '');
    if (key === this.key) return;
    this.key = key;
    const s = f.boss ? 1.12 : 1;
    const shape = shapeFor(f.characterId);
    const b = shapeBounds(shape);
    this.bounds = { x0: b.x0 * s, x1: b.x1 * s, y0: b.y0 * s, y1: b.y1 * s };
    this.umbral = umbral;
    const baked = bakeFighter(this.scene, shape, f.characterId, { aura: f.aura, facing: this.facing, scale: s, umbral: umbral, side: this.facing > 0 ? 'player' : 'enemy' });
    const z = (this.scene.vp && this.scene.vp.zoom) || 1;
    this.body.setTexture(baked.key);
    this.body.setOrigin(baked.feetX / baked.w, baked.feetY / baked.h).setScale(1 / z).setVisible(true);
    this.nameTag.setText(f.name);
    this.nameOffset = -122 * s;
    this.scale = s;
    this.aura = f.aura;
  }

  /** Pose offsets for this frame from the logic state only. Computed once per frame (Hitstun shake is random). */
  pose(f, t, frozen) {
    let ox = 0;
    let oy = 0;
    let rot = 0;
    let alpha = 1;
    const st = f.state;
    const freezeMul = frozen ? 0 : 1;
    switch (st) {
      case 'Idle':
        oy = Math.sin(t / 220) * 2 * freezeMul;
        break;
      case 'Dashing':
        rot = 0.12 * this.facing;
        break;
      case 'Windup':
        ox = -6 * this.facing;
        break;
      case 'Active':
        ox = 10 * this.facing;
        rot = 0.08 * this.facing;
        break;
      case 'Slipping':
        oy = -16;
        alpha = 0.45;
        break;
      case 'SlipRecovery':
        alpha = 0.8;
        break;
      case 'Hitstun':
        ox = (Math.random() - 0.5) * 6 * freezeMul - 4 * this.facing;
        rot = -0.1 * this.facing;
        break;
      case 'Knockdown':
        rot = -1.35 * this.facing;
        oy = 4;
        break;
      case 'KO':
        rot = -1.5 * this.facing;
        oy = 6;
        alpha = 0.45;
        break;
      default:
        break;
    }
    return { ox, oy, rot, alpha, glow: !!(f.ignition && f.ignition.active) };
  }

  /**
   * f = Fighter snapshot, sx/floorY = screen position (from placeFighters), t = ms clock, pose = this.pose(),
   * range = { min, max } allowed anchor x for this pose (keeps every pixel on screen while easing).
   */
  update(f, sx, floorY, t, frozen, pose, range) {
    this.setFighter(f);
    const P = pose || this.pose(f, t, frozen);
    if (this.x === null) this.x = sx;
    // ease toward the placed position (smooths 60 Hz steps on high-refresh screens), never off screen
    this.x += (sx - this.x) * 0.5;
    if (range) this.x = Math.max(range.min, Math.min(range.max, this.x));
    const { ox, oy, rot } = P;
    let alpha = P.alpha;
    const st = f.state;
    if (f.invulnerable && st !== 'Slipping' && Math.floor(t / 70) % 2 === 0) alpha *= 0.55;
    this.root.setPosition(this.x + ox, floorY + oy);
    this.root.setRotation(rot);
    this.body.setAlpha(alpha);
    this.floorY = floorY;
    this.nameTag.setPosition(this.x + ox, floorY + this.nameOffset); // x is final after placeNameLabels (BattleScene)
    this.nameTag.setAlpha(st === 'KO' ? 0.6 : 1);

    // Round 4: the Ignition aura and the hit flash are drawn by the VFX layer (src/vfx, GDD §17.2 ignition_active /
    // hit halo), so nothing here plays twice. Only the R3 debug flash path below remains, unused by BattleScene.
    this.glow.clear();
    if (this.flash > 0) {
      this.glow.fillStyle(0xffffff, this.flash);
      this.glow.fillEllipse(0, -60, 70, 120);
      this.flash = Math.max(0, this.flash - 0.08);
    }
    // Wind-up ring in the card colour (tells you a hit is coming: time to Slip)
    this.windupRing.clear();
    if (f.action && (f.action.phase === 'windup' || f.action.phase === 'approach')) {
      const r = 34 + Math.sin(t / 50) * 4;
      this.windupRing.lineStyle(4, cardColor(f.action.cardType), 0.9);
      this.windupRing.strokeCircle(0, -58, r);
    }
  }

  hitFlash() {
    this.flash = 0.8;
  }

  headPos() {
    return { x: this.root.x, y: this.root.y - 120 };
  }

  /** Bounds of the name label in logical px (its row is fixed; only x follows the fighter). */
  nameRect() {
    const b = this.nameTag.getBounds();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }

  /** Top of the name row (y) — the same for every pose. */
  nameTop() {
    return this.floorY + this.nameOffset - this.nameTag.height / 2;
  }

  nameBottom() {
    return this.floorY + this.nameOffset + this.nameTag.height / 2;
  }
}
