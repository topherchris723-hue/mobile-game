// Placeholder fighter: coloured silhouette in the aura colour, aura icon on the chest, name tag.
// Poses come only from the logic snapshot (state, action, ignition, invulnerable).
import { auraColor, COLORS } from './theme.js';
import { drawAuraIcon, cardColor } from './icons.js';

export class FighterView {
  constructor(scene, facing) {
    this.scene = scene;
    this.facing = facing; // +1 faces right (player), -1 faces left (enemy)
    this.root = scene.add.container(0, 0);
    this.glow = scene.add.graphics();
    this.body = scene.add.graphics();
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
    const key = f.characterId + '|' + (f.ignition && f.ignition.active ? 'ign' : 'base');
    if (key === this.key) return;
    this.key = key;
    const g = this.body;
    const col = auraColor(f.aura);
    const s = f.boss ? 1.12 : 1;
    g.clear();
    // shadow
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(0, 2, 64 * s, 12);
    // legs
    g.fillStyle(0x1b1d2e, 1);
    g.fillRoundedRect(-16 * s, -34 * s, 12 * s, 34 * s, 4);
    g.fillRoundedRect(4 * s, -34 * s, 12 * s, 34 * s, 4);
    // torso
    g.fillStyle(col, 1);
    g.lineStyle(2, 0xffffff, 0.85);
    g.fillRoundedRect(-22 * s, -80 * s, 44 * s, 50 * s, 10);
    g.strokeRoundedRect(-22 * s, -80 * s, 44 * s, 50 * s, 10);
    // head
    g.fillStyle(0xf1d3b8, 1);
    g.fillCircle(0, -94 * s, 13 * s);
    g.lineStyle(2, 0xffffff, 0.85);
    g.strokeCircle(0, -94 * s, 13 * s);
    // hair band in aura colour + eye on the facing side
    g.fillStyle(col, 1);
    g.fillRect(-13 * s, -104 * s, 26 * s, 6 * s);
    g.fillStyle(0x14172b, 1);
    g.fillCircle(6 * s * this.facing, -94 * s, 2.5 * s);
    // fist on the facing side
    g.fillStyle(col, 1);
    g.fillCircle(28 * s * this.facing, -58 * s, 8 * s);
    g.lineStyle(2, 0xffffff, 0.85);
    g.strokeCircle(28 * s * this.facing, -58 * s, 8 * s);
    drawAuraIcon(g, f.aura, 0, -56 * s, 9, 0xffffff);
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

    // Ignition aura glow / hit flash
    this.glow.clear();
    if (f.ignition && f.ignition.active) {
      const pulse = 0.35 + 0.2 * Math.sin(t / 90);
      this.glow.fillStyle(auraColor(f.aura), pulse);
      this.glow.fillEllipse(0, -60, 90, 140);
    }
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
