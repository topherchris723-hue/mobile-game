// Phaser renderer for the VFX core. Draws only what VfxCore decided; all limits live in the core.
// Every display object is created once (pools) and reused: nothing is allocated per frame.
// Depths (GDD §17.1 rule 2, BattleScene): arena −5, back-shapes −2, hit halo −1 (behind the body, as the R3 glow),
// fighters 0, VFX world layer 54 (below float texts 60 and callouts), decor inside the cinematic container (80) when
// the scene adopts it, else 59.
import { ensureAtlas, ATLAS_KEY, FRAME_SIZES, RING_RADIUS, DISC_RADIUS } from './atlas.js';
import { FRAMES } from './particles.js';
import { BACK_SHAPES } from './aura-style.js';

const VISUAL_POOL = 64;
const HALF_PI = Math.PI / 2;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export class PhaserVfxRenderer {
  /**
   * opts: { mode: 'battle'|'summon', depth, backDepth, haloDepth, decorDepth, fighters: { player, enemy } (views with
   * .root), arena: { top, floorY, bottom }, center: { x, y } (summon), anchor(name, ctx) override, flashDepth (number →
   * draw screen flashes as a rect at that depth instead of the camera flash), hooks: { onSpriteSwap(side, key, spec),
   * onTextPop(side, spec), onTint(side, color, alpha, ms) } }
   */
  constructor(scene, core, opts) {
    const o = opts || {};
    this.scene = scene;
    this.core = core;
    this.opts = o;
    this.hooks = o.hooks || {};
    this.mode = o.mode || (scene.fighters ? 'battle' : 'summon');
    const cam = scene.cameras && scene.cameras.main;
    this.W = (scene.L && scene.L.W) || scene.W || (cam ? cam.width : 360);
    this.H = (scene.L && scene.L.H) || scene.H || (cam ? cam.height : 640);
    const A = o.arena || (scene.L && scene.L.arena) || { top: 44, floorY: 284, bottom: 330 };
    this.arena = { top: A.top, floorY: A.floorY, bottom: A.bottom };
    this.center = o.center || { x: this.W / 2, y: this.H * 0.42 };
    this.fighters = o.fighters || scene.fighters || null;
    this.depth = o.depth === undefined ? 54 : o.depth;
    ensureAtlas(scene);
    this.frameNames = FRAMES;

    // particle images
    const S = core.store;
    this.pImgs = new Array(S.capacity);
    this.pSeq = new Float64Array(S.capacity);
    for (let i = 0; i < S.capacity; i++) {
      const img = scene.add.image(-100, -100, ATLAS_KEY, 'dot').setDepth(this.depth).setVisible(false);
      this.pImgs[i] = img;
    }
    if (this.mode === 'battle') {
      S.bounds.minX = -12;
      S.bounds.maxX = this.W + 12;
      S.bounds.minY = this.arena.top;
      S.bounds.maxY = this.arena.floorY + 4; // never into the HP-name row / HUD (y ≥ 330)
    }
    // visual pool
    this.vis = [];
    for (let i = 0; i < VISUAL_POOL; i++) {
      const img = scene.add.image(-100, -100, ATLAS_KEY, 'ring').setDepth(this.depth).setVisible(false);
      this.vis.push({ active: false, img: img, spec: null, t0: 0, dur: 0, kind: '', i: 0, fadeAt: 0, fadeMs: 0, x: 0, y: 0, seed: 0, placed: false, inDecor: false });
    }
    // hit halos (R3 hit-flash look: white ellipse 70×120 behind the body, centre 60 px above the feet)
    this.halo = {};
    for (const side of ['player', 'enemy']) {
      this.halo[side] = scene.add.image(-100, -100, ATLAS_KEY, 'disc').setDepth(o.haloDepth === undefined ? -1 : o.haloDepth).setVisible(false);
    }
    this.backDepth = o.backDepth === undefined ? -2 : o.backDepth;
    // cinematic decor (radial lines, Tri-Burst stripes + icons, portraits). The scene may adopt it into its cinematic
    // container (index 1: above the band fill, below the title text) so it fades with the overlay.
    this.decor = scene.add.container(0, 0).setDepth(o.decorDepth === undefined ? 59 : o.decorDepth);
    this.radialG = scene.add.graphics();
    this.stripesG = scene.add.graphics();
    this.decor.add([this.radialG, this.stripesG]);
    this.decorRecs = { radial: null, stripes: null };
    this.icons = [];
    for (let i = 0; i < 3; i++) {
      const ic = scene.add.image(0, 0, ATLAS_KEY, 'portrait_blaze').setVisible(false);
      this.icons.push(ic);
      this.decor.add(ic);
    }
    this.flashRect = null;
    if (typeof o.flashDepth === 'number') {
      this.flashRect = scene.add.rectangle(0, 0, this.W, this.H, 0xffffff, 1).setOrigin(0).setDepth(o.flashDepth).setVisible(false);
      this.flashT0 = 0;
      this.flashMs = 0;
      this.flashA = 0;
    }
    this.lastNow = 0;
  }

  bandY() {
    const a = this.arena;
    return a.top + (a.floorY - a.top) * 0.45; // BattleScene.showCinematic band centre
  }

  // ------------------------------------------------------------------ anchors
  sidePos(side) {
    const f = this.fighters && this.fighters[side];
    if (f && f.root) return { x: f.root.x, y: f.root.y, rot: f.root.rotation || 0 };
    const x = side === 'enemy' ? this.W * 0.7 : this.W * 0.3;
    return { x: x, y: this.arena.floorY, rot: 0 };
  }

  anchor(name, ctx) {
    if (this.opts.anchor) {
      const p = this.opts.anchor(name, ctx);
      if (p) return p;
    }
    if (this.mode !== 'battle' || name === 'screen') {
      if (this.mode !== 'battle') return { x: this.center.x, y: this.center.y };
      return { x: this.W / 2, y: (this.arena.top + this.arena.floorY) / 2 };
    }
    const actor = this.sidePos(ctx.side || 'player');
    const target = this.sidePos(ctx.target || 'enemy');
    switch (name) {
      case 'attacker':
        return { x: actor.x, y: actor.y - 60 };
      case 'feet':
        return { x: (name === 'feet' && ctx.raw && (ctx.raw.type === 'knockdown' || ctx.raw.type === 'hit')) ? target.x : actor.x, y: (ctx.raw && (ctx.raw.type === 'knockdown')) ? target.y : actor.y };
      case 'between':
        return { x: (actor.x + target.x) / 2, y: (actor.y + target.y) / 2 - 60 };
      default:
        return { x: target.x, y: target.y - 60 };
    }
  }

  // ------------------------------------------------------------------ core callbacks
  shake(ms, intensity) {
    const cam = this.scene.cameras && this.scene.cameras.main;
    if (cam) cam.shake(ms, intensity, true);
  }

  stopShake() {
    const cam = this.scene.cameras && this.scene.cameras.main;
    if (cam && cam.shakeEffect) cam.shakeEffect.reset();
  }

  screenFlash(color, alpha, ms) {
    if (this.flashRect) {
      this.flashRect.setFillStyle(color, 1).setAlpha(alpha).setVisible(true);
      this.flashT0 = this.lastNow || performance.now();
      this.flashMs = ms;
      this.flashA = alpha;
      return;
    }
    const cam = this.scene.cameras && this.scene.cameras.main;
    if (!cam) return;
    // Same as the round-3 camera flash (linear fade over `ms`), with the start alpha capped (≤ 0.9, §17.3).
    cam.flashEffect.alpha = alpha;
    cam.flash(ms, (color >> 16) & 255, (color >> 8) & 255, color & 255, true);
  }

  onQuality() {}

  takeRec() {
    let oldest = null;
    for (let i = 0; i < this.vis.length; i++) {
      const r = this.vis[i];
      if (!r.active) return r;
      if (!oldest || r.t0 < oldest.t0) oldest = r;
    }
    this.retire(oldest); // pool full: reuse the oldest visual (cosmetic only)
    return oldest;
  }

  retire(r) {
    if (!r) return;
    r.active = false;
    r.img.setVisible(false);
    r.spec = null;
  }

  /** Start a visual layer. Returns a handle { end(fadeMs) } (the core calls it at a cinematic's freeze_end). */
  visual(spec) {
    const now = spec.t0;
    const recs = [];
    const add = (i, frame, delay) => {
      const r = this.takeRec();
      r.active = true;
      r.spec = spec;
      r.kind = spec.kind;
      r.i = i;
      r.t0 = now + (delay || 0);
      r.dur = spec.durationMs;
      r.fadeAt = 0;
      r.fadeMs = 0;
      r.placed = false;
      r.seed = Math.random();
      r.img.setTexture(ATLAS_KEY, frame).setVisible(false).setAlpha(0).setRotation(0).setScale(1).setOrigin(0.5, 0.5).setFlipX(false);
      r.img.setTint(spec.color);
      r.img.setDepth(this.depth);
      r.img.setBlendMode(0);
      recs.push(r);
      return r;
    };
    const k = spec.kind;
    if (k === 'ring') {
      const frame = spec.frame === 'disc' || spec.frame === 'ring' ? spec.frame : 'ring_seg';
      for (let i = 0; i < Math.max(1, spec.count); i++) add(i, frame, 0);
    } else if (k === 'beam') {
      add(0, 'beam', 0).img.setBlendMode(1);
    } else if (k === 'streak') {
      if (spec.anchor === 'screen') for (let i = 0; i < Math.max(1, spec.count); i++) add(i, 'streak', i * 25);
      else add(0, 'streak', 0).img.setOrigin(0, 0.5);
    } else if (k === 'afterimage') {
      const n = Math.max(1, spec.count);
      for (let i = 0; i < n; i++) add(i, 'ghost', (i * spec.durationMs) / (n + 1)).img.setOrigin(0.5, 1);
    } else if (k === 'portrait_slide') {
      const a = spec.memberAura || spec.aura || 'blaze';
      const r = add(0, 'portrait_' + a, 0);
      r.img.setTint(0xffffff);
      this.decor.add(r.img);
      r.inDecor = true;
    } else if (k === 'tint') {
      if (spec.frame && BACK_SHAPES[spec.frame]) {
        const r = add(0, spec.frame, 0);
        r.img.setDepth(this.backDepth);
        if (!BACK_SHAPES[spec.frame].tint) r.img.setTint(0xffffff);
      } else if (this.hooks.onTint) {
        this.hooks.onTint(spec.side === spec.target ? spec.side : spec.anchor === 'attacker' ? spec.side : spec.target, spec.color, spec.alpha, spec.durationMs);
      }
    } else if (k === 'overlay') {
      this.startOverlay(spec, now);
      return { end: (ms) => this.endOverlay(spec, ms) };
    } else if (k === 'text_pop') {
      if (this.hooks.onTextPop) this.hooks.onTextPop(spec.side, spec);
    } else if (k === 'sprite_swap') {
      if (this.hooks.onSpriteSwap) this.hooks.onSpriteSwap(spec.side, spec.spriteKey, spec);
    }
    if (!recs.length) return null;
    return {
      end: (ms) => {
        const t = this.lastNow || performance.now();
        for (const r of recs) {
          if (!r.active || r.spec !== spec) continue;
          if (!ms) this.retireRec(r);
          else if (!r.fadeAt) {
            r.fadeAt = t;
            r.fadeMs = ms;
          }
        }
      },
    };
  }

  retireRec(r) {
    if (r.inDecor) {
      this.decor.remove(r.img);
      r.inDecor = false;
    }
    this.retire(r);
  }

  // ------------------------------------------------------------------ cinematic decor (inside the band)
  startOverlay(spec, now) {
    const cy = this.bandY();
    const W = this.W;
    if (spec.texture === 'vfx_gen_tri_stripes') {
      // L5: three diagonal stripes in the living members' aura keys, with their aura shapes (style guide §7.2)
      const g = this.stripesG;
      g.clear();
      const cols = spec.colors && spec.colors.length ? spec.colors : [spec.color];
      const n = cols.length;
      for (let i = 0; i < n; i++) {
        const x = W * ((i + 1) / (n + 1));
        g.fillStyle(cols[i], spec.alpha);
        g.fillPoints([{ x: x - 4, y: cy - 46 }, { x: x + 22, y: cy - 46 }, { x: x + 4, y: cy + 46 }, { x: x - 22, y: cy + 46 }], true);
        const ic = this.icons[i];
        if (ic) {
          const m = spec.members && spec.members[i];
          ic.setFrame('portrait_' + ((m && m.aura) || 'blaze')).setPosition(x + 9, cy - 34).setScale(0.42).setVisible(true).setAlpha(1);
        }
      }
      g.setAlpha(1);
      this.decorRecs.stripes = { t0: now, dur: spec.durationMs, fadeAt: 0, fadeMs: 0, n: n };
    } else {
      // L4: radial lines in the aura ramp from the band centre (style guide §7.2)
      const g = this.radialG;
      g.clear();
      g.setPosition(W / 2, cy);
      g.lineStyle(3, spec.color, 1);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        g.lineBetween(Math.cos(a) * 70, Math.sin(a) * 50, Math.cos(a) * 260, Math.sin(a) * 200);
      }
      g.setAlpha(0);
      this.decorRecs.radial = { t0: now, dur: spec.durationMs, fadeAt: 0, fadeMs: 0, a: spec.alpha };
    }
  }

  endOverlay(spec, ms) {
    const key = spec.texture === 'vfx_gen_tri_stripes' ? 'stripes' : 'radial';
    const d = this.decorRecs[key];
    if (!d) return;
    if (!ms) this.clearDecor(key);
    else if (!d.fadeAt) {
      d.fadeAt = this.lastNow || performance.now();
      d.fadeMs = ms;
    }
  }

  clearDecor(key) {
    if (key === 'stripes') {
      this.stripesG.clear();
      for (const ic of this.icons) ic.setVisible(false);
    } else {
      this.radialG.clear();
    }
    this.decorRecs[key] = null;
  }

  updateDecor(now) {
    for (const key of ['radial', 'stripes']) {
      const d = this.decorRecs[key];
      if (!d) continue;
      const t = now - d.t0;
      let a = clamp01(t / 120) * clamp01((d.dur - t) / 160);
      if (d.fadeAt) a *= clamp01(1 - (now - d.fadeAt) / d.fadeMs);
      if (t >= d.dur || (d.fadeAt && now - d.fadeAt >= d.fadeMs)) {
        this.clearDecor(key);
        continue;
      }
      if (key === 'radial') {
        this.radialG.setAlpha(a * d.a);
        this.radialG.rotation = t * 0.00025;
      } else {
        this.stripesG.setAlpha(a);
        for (let i = 0; i < d.n && i < this.icons.length; i++) this.icons[i].setAlpha(a);
      }
    }
  }

  // ------------------------------------------------------------------ per frame
  frame(now, dt) {
    this.lastNow = now;
    this.syncParticles();
    this.syncHalos(now);
    for (let i = 0; i < this.vis.length; i++) {
      const r = this.vis[i];
      if (r.active) this.updateRec(r, now, dt);
    }
    this.updateDecor(now);
    if (this.flashRect && this.flashRect.visible) {
      const p = (now - this.flashT0) / this.flashMs;
      if (p >= 1) this.flashRect.setVisible(false);
      else this.flashRect.setAlpha(this.flashA * (1 - p));
    }
  }

  syncParticles() {
    const S = this.core.store;
    const names = this.frameNames;
    for (let i = 0; i < S.capacity; i++) {
      const img = this.pImgs[i];
      if (!S.alive[i]) {
        if (img.visible) img.setVisible(false);
        continue;
      }
      if (this.pSeq[i] !== S.seq[i]) {
        this.pSeq[i] = S.seq[i];
        const f = names[S.frame[i]];
        img.setFrame(f);
        img.setTint(S.color[i]);
        img.__fs = FRAME_SIZES[f] ? FRAME_SIZES[f][0] : 16;
      }
      const p = S.age[i] / S.life[i];
      const sc = (S.size[i] / img.__fs) * (1 - 0.45 * p);
      img.x = S.x[i];
      img.y = S.y[i];
      img.rotation = S.align[i] ? Math.atan2(S.vy[i], S.vx[i]) : S.rot[i];
      img.setScale(sc);
      img.setAlpha(S.alpha0[i] * (1 - p));
      if (!img.visible) img.setVisible(true);
    }
  }

  syncHalos(now) {
    for (const side of ['player', 'enemy']) {
      const h = this.halo[side];
      const lv = this.core.spriteFlashLevel(side, now);
      if (lv <= 0) {
        if (h.visible) h.setVisible(false);
        continue;
      }
      const p = this.sidePos(side);
      h.x = p.x + 60 * Math.sin(p.rot);
      h.y = p.y - 60 * Math.cos(p.rot);
      h.rotation = p.rot;
      h.setScale(70 / (DISC_RADIUS * 2), 120 / (DISC_RADIUS * 2));
      h.setAlpha(lv);
      if (!h.visible) h.setVisible(true);
    }
  }

  updateRec(r, now, dt) {
    const s = r.spec;
    const t = now - r.t0;
    const img = r.img;
    if (t < 0) return; // staggered start
    if (!s.loop && t >= r.dur) {
      this.retireRec(r);
      return;
    }
    let fade = 1;
    if (r.fadeAt) {
      fade = 1 - (now - r.fadeAt) / r.fadeMs;
      if (fade <= 0) {
        this.retireRec(r);
        return;
      }
    }
    const p = r.dur > 0 ? clamp01(t / r.dur) : 1;
    const env = clamp01(p / 0.15) * clamp01((1 - p) / 0.3);
    switch (r.kind) {
      case 'ring': {
        const sf = s.scaleFrom === null ? 0.3 : s.scaleFrom;
        const st = s.scaleTo === null ? 1 : s.scaleTo;
        const base = s.frame === 'disc' ? DISC_RADIUS : RING_RADIUS;
        const radius = s.sizePx * (sf + (st - sf) * p) * (1 - 0.18 * r.i);
        if (!r.placed) {
          const a = this.anchor(s.anchor, s);
          r.x = a.x;
          r.y = a.y;
          r.placed = true;
        }
        img.setPosition(r.x, r.y).setScale(radius / base);
        if (s.spin) img.rotation += ((r.i % 2 ? -1 : 1) * s.spin * Math.PI * dt) / 180000;
        img.setAlpha(s.alpha * (1 - p) * fade);
        break;
      }
      case 'beam': {
        const mi = s.memberIndex || 0;
        const mc = s.memberCount || 1;
        if (s.direction === 'up') {
          const a = this.sidePos(s.side);
          const len = Math.max(8, a.y - this.arena.top);
          img.setPosition(a.x, (a.y + this.arena.top) / 2).setRotation(0).setScale((s.sizePx * (0.85 + 0.15 * Math.sin(t / 40))) / 32, len / 128);
        } else {
          const a = this.sidePos(s.side);
          const b = this.sidePos(s.target);
          const len = Math.max(8, Math.abs(b.x - a.x));
          const y = (a.y + b.y) / 2 - 60 + (mi - (mc - 1) / 2) * 12;
          img.setPosition((a.x + b.x) / 2, y).setRotation(HALF_PI).setScale(s.sizePx / 32, len / 128);
        }
        img.setAlpha(s.alpha * env * fade);
        break;
      }
      case 'streak': {
        if (s.anchor === 'screen') {
          // L2 speed lines at the arena edges (arena only)
          const top = this.arena.top + 16;
          const span = Math.max(20, this.arena.floorY - 40 - top);
          const left = r.i % 2 === 0;
          const y = top + span * r.seed;
          const x = left ? 4 + 120 * p : this.W - 4 - 120 * p;
          img.setPosition(x, y).setRotation(0).setScale(60 / 64, Math.max(1, s.sizePx) / 8);
          img.setAlpha(s.alpha * (1 - p) * fade);
        } else {
          const a = this.sidePos(s.side);
          const b = this.sidePos(s.target);
          const len = Math.abs(b.x - a.x) * clamp01(p / 0.4);
          img.setPosition(a.x, a.y - 60).setRotation(b.x >= a.x ? 0 : Math.PI).setScale(Math.max(1, len) / 64, s.sizePx / 8);
          img.setAlpha(s.alpha * clamp01((1 - p) / 0.5) * fade);
        }
        break;
      }
      case 'afterimage': {
        if (!r.placed) {
          const a = this.sidePos(s.side);
          r.x = a.x;
          r.y = a.y;
          r.placed = true;
          img.setFlipX(s.side === 'enemy');
        }
        const n = Math.max(1, s.count);
        const life = r.dur - (r.i * r.dur) / (n + 1);
        const q = clamp01(t / Math.max(16, life));
        if (q >= 1) {
          this.retireRec(r);
          return;
        }
        img.setPosition(r.x, r.y).setScale(1);
        img.setAlpha(s.alpha * (1 - q) * fade);
        break;
      }
      case 'portrait_slide': {
        const mc = s.memberCount || 1;
        const tx = this.W * (((s.memberIndex || 0) + 1) / (mc + 1));
        const ty = this.arena.top + 30;
        const k = 1 - Math.pow(1 - clamp01(t / 250), 3);
        img.setPosition(-30 + (tx + 30) * k, ty).setScale(1);
        img.setAlpha(clamp01((r.dur - t) / 200) * fade);
        break;
      }
      case 'tint': {
        const B = BACK_SHAPES[s.frame] || BACK_SHAPES.back_ellipse;
        const a = this.sidePos(s.side);
        const sf = s.scaleFrom === null ? 1 : s.scaleFrom;
        const st = s.scaleTo === null ? 1 : s.scaleTo;
        const grow = sf + (st - sf) * (1 - Math.pow(1 - clamp01(t / 300), 3));
        const period = Math.max(200, s.loopMs || 1000);
        const pulse = 1 - B.pulse * 0.5 * (1 + Math.sin((t / period) * Math.PI * 2));
        img.setPosition(a.x, a.y + B.dy).setScale(grow);
        if (B.spin) img.rotation += (B.spin * Math.PI * dt) / 180000;
        const fadeIn = clamp01(t / 160);
        img.setAlpha(Math.min(0.5, s.alpha * pulse) * fadeIn * fade); // ≤ 50 % in the name-row band (style guide)
        break;
      }
      default:
        break;
    }
    if (!img.visible) img.setVisible(true);
  }

  clearVisuals(fadeMs) {
    for (const r of this.vis) {
      if (!r.active) continue;
      if (!fadeMs) this.retireRec(r);
      else if (!r.fadeAt) {
        r.fadeAt = this.lastNow || performance.now();
        r.fadeMs = fadeMs;
      }
    }
    this.clearDecor('radial');
    this.clearDecor('stripes');
    if (this.flashRect) this.flashRect.setVisible(false);
  }

  destroy() {
    for (const img of this.pImgs) img.destroy();
    for (const r of this.vis) r.img.destroy();
    this.halo.player.destroy();
    this.halo.enemy.destroy();
    this.decor.destroy(true);
    if (this.flashRect) this.flashRect.destroy();
  }
}
