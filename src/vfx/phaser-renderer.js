// Phaser renderer for the VFX core. Draws only what VfxCore decided; all limits live in the core.
// Every display object is created once (pools) and reused: nothing is allocated per frame.
// Depths (GDD §17.1 rule 2, BattleScene): arena −5, back-shapes −2, hit halo −1 (behind the body, as the R3 glow),
// fighters 0, VFX world layer 54 (below float texts 60 and callouts), decor inside the cinematic container (80) when
// the scene adopts it, else 59.
import { ensureAtlas, ATLAS_KEY, FRAME_SIZES, RING_RADIUS, DISC_RADIUS } from './atlas.js';
import { FRAMES } from './particles.js';
import { BACK_SHAPES } from './aura-style.js';
import { VECTOR_FRAMES, shapeParts, cssOf } from './vector-shapes.js';

const VISUAL_POOL = 64;
const CANVAS_RENDERER = 1; // Phaser.CANVAS

// ---------------------------------------------------------------- Canvas vector draw (round 7, R-2 / AC-17.7)
// On the Canvas renderer a textured drawImage() is the costly part of a VFX frame (see vector-shapes.js). Pooled VFX
// images whose frame is a plain shape draw that shape as cached Path2D parts instead, with the same transform, origin,
// alpha and blend mode as Phaser's own batchSprite, in the image's tint colour (WebGL look). Other frames (gradients,
// portraits, baked back-shapes) fall through to Phaser's normal image draw.
const VEC_PATHS = {};
const CSS = new Map();
let vecM = null;
let vecSpr = null;

function vecShape(frame) {
  if (VEC_PATHS[frame] !== undefined) return VEC_PATHS[frame];
  let out = null;
  if (VECTOR_FRAMES.indexOf(frame) >= 0 && FRAME_SIZES[frame]) {
    const [w, h] = FRAME_SIZES[frame];
    const parts = shapeParts(frame, w, h, RING_RADIUS, DISC_RADIUS);
    out = parts.map((pt) => {
      const path = new Path2D();
      pt.build(path);
      return { path: path, stroke: pt.mode === 'stroke', lineWidth: pt.lineWidth, dark: pt.color === 'dark' };
    });
  }
  VEC_PATHS[frame] = out;
  return out;
}

function cssCached(c, dark) {
  const k = dark ? -1 - c : c;
  let v = CSS.get(k);
  if (v === undefined) {
    v = cssOf(c, dark);
    CSS.set(k, v);
  }
  return v;
}

/** renderCanvas override for a pooled VFX Image (installed per instance on the Canvas renderer only). */
function vectorRenderCanvas(renderer, src, camera, parentMatrix) {
  const parts = src.frame ? vecShape(src.frame.name) : null;
  if (!parts) {
    Object.getPrototypeOf(src).renderCanvas.call(src, renderer, src, camera, parentMatrix);
    return;
  }
  const alpha = camera.alpha * src.alpha;
  if (alpha <= 0) return;
  camera.addToRenderList(src);
  const ctx = renderer.currentContext;
  if (!vecM) {
    vecM = new camera.matrix.constructor();
    vecSpr = new camera.matrix.constructor();
  }
  // same maths as Phaser's GetCalcMatrix / batchSprite (flip = negative scale about the origin)
  vecSpr.applyITRS(src.x, src.y, src.rotation, src.scaleX * (src.flipX ? -1 : 1), src.scaleY * (src.flipY ? -1 : 1));
  vecM.copyFrom(camera.matrix);
  if (parentMatrix) {
    vecM.multiplyWithOffset(parentMatrix, -camera.scrollX * src.scrollFactorX, -camera.scrollY * src.scrollFactorY);
    vecSpr.e = src.x;
    vecSpr.f = src.y;
  } else {
    vecSpr.e -= camera.scrollX * src.scrollFactorX;
    vecSpr.f -= camera.scrollY * src.scrollFactorY;
  }
  vecM.multiply(vecSpr);
  ctx.save();
  vecM.setToContext(ctx);
  ctx.translate(-src.displayOriginX, -src.displayOriginY);
  ctx.globalCompositeOperation = renderer.blendModes[src.blendMode];
  ctx.globalAlpha = alpha;
  const tint = src.tintTopLeft === undefined ? 0xffffff : src.tintTopLeft;
  for (let i = 0; i < parts.length; i++) {
    const pt = parts[i];
    if (pt.stroke) {
      ctx.strokeStyle = cssCached(tint, false);
      ctx.lineWidth = pt.lineWidth;
      ctx.stroke(pt.path);
    } else {
      ctx.fillStyle = cssCached(tint, pt.dark);
      ctx.fill(pt.path);
    }
  }
  ctx.restore();
}
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
    const rnd = (scene.sys && scene.sys.renderer) || scene.renderer || null;
    // Canvas renderer only: plain-shape frames draw as vectors (o.vector === false keeps the atlas images, for A/B)
    this.vector = o.vector !== false && !!rnd && rnd.type === CANVAS_RENDERER && typeof Path2D !== 'undefined';
    // scratch points (no per-frame allocation)
    this._pa = { x: 0, y: 0, rot: 0 };
    this._pb = { x: 0, y: 0, rot: 0 };
    this._anc = { x: 0, y: 0 };

    // particle images
    const S = core.store;
    this.pImgs = new Array(S.capacity);
    this.pSeq = new Float64Array(S.capacity);
    for (let i = 0; i < S.capacity; i++) {
      const img = scene.add.image(-100, -100, ATLAS_KEY, 'dot').setDepth(this.depth).setVisible(false);
      if (this.vector) img.renderCanvas = vectorRenderCanvas;
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
      if (this.vector) img.renderCanvas = vectorRenderCanvas;
      this.vis.push({ active: false, img: img, spec: null, t0: 0, dur: 0, kind: '', i: 0, fadeAt: 0, fadeMs: 0, x: 0, y: 0, seed: 0, placed: false, inDecor: false });
    }
    // hit halos (R3 hit-flash look: white ellipse 70×120 behind the body, centre 60 px above the feet)
    this.halo = {};
    for (const side of ['player', 'enemy']) {
      this.halo[side] = scene.add.image(-100, -100, ATLAS_KEY, 'disc').setDepth(o.haloDepth === undefined ? -1 : o.haloDepth).setVisible(false);
      if (this.vector) this.halo[side].renderCanvas = vectorRenderCanvas;
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
  /** Fighter feet position. `out` = a scratch object to fill (default a reused one: copy the values, do not keep it). */
  sidePos(side, out) {
    const o = out || this._pa;
    const f = this.fighters && this.fighters[side];
    if (f && f.root) {
      o.x = f.root.x;
      o.y = f.root.y;
      o.rot = f.root.rotation || 0;
      return o;
    }
    o.x = side === 'enemy' ? this.W * 0.7 : this.W * 0.3;
    o.y = this.arena.floorY;
    o.rot = 0;
    return o;
  }

  pt(x, y) {
    const a = this._anc;
    a.x = x;
    a.y = y;
    return a;
  }

  anchor(name, ctx) {
    if (this.opts.anchor) {
      const p = this.opts.anchor(name, ctx);
      if (p) return p;
    }
    // Returns a reused point: callers copy x / y at once (core.refreshAnchor, updateRec), nothing keeps it.
    if (this.mode !== 'battle' || name === 'screen') {
      if (this.mode !== 'battle') return this.pt(this.center.x, this.center.y);
      return this.pt(this.W / 2, (this.arena.top + this.arena.floorY) / 2);
    }
    const actor = this.sidePos(ctx.side || 'player', this._pa);
    const target = this.sidePos(ctx.target || 'enemy', this._pb);
    switch (name) {
      case 'attacker':
        return this.pt(actor.x, actor.y - 60);
      case 'feet': {
        // knockdown dust rises at the feet of the fighter knocked down; everything else at the actor's feet
        const p = ctx.raw && ctx.raw.type === 'knockdown' ? target : actor;
        return this.pt(p.x, p.y);
      }
      case 'between':
        return this.pt((actor.x + target.x) / 2, (actor.y + target.y) / 2 - 60);
      default:
        return this.pt(target.x, target.y - 60);
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
      if (r.img.depth !== this.depth) r.img.setDepth(this.depth); // setDepth always queues a display-list re-sort
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
      // one path, one stroke (16 separate lineBetween strokes cost 16 raster ops on Canvas; same pixels: the lines
      // never overlap)
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        g.moveTo(Math.cos(a) * 70, Math.sin(a) * 50);
        g.lineTo(Math.cos(a) * 260, Math.sin(a) * 200);
      }
      g.strokePath();
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
          const a = this.sidePos(s.side, this._pa);
          const len = Math.max(8, a.y - this.arena.top);
          img.setPosition(a.x, (a.y + this.arena.top) / 2).setRotation(0).setScale((s.sizePx * (0.85 + 0.15 * Math.sin(t / 40))) / 32, len / 128);
        } else {
          const a = this.sidePos(s.side, this._pa);
          const b = this.sidePos(s.target, this._pb);
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
          const a = this.sidePos(s.side, this._pa);
          const b = this.sidePos(s.target, this._pb);
          const len = Math.abs(b.x - a.x) * clamp01(p / 0.4);
          img.setPosition(a.x, a.y - 60).setRotation(b.x >= a.x ? 0 : Math.PI).setScale(Math.max(1, len) / 64, s.sizePx / 8);
          img.setAlpha(s.alpha * clamp01((1 - p) / 0.5) * fade);
        }
        break;
      }
      case 'afterimage': {
        if (!r.placed) {
          const a = this.sidePos(s.side, this._pa);
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
        const a = this.sidePos(s.side, this._pa);
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
