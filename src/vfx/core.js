// VFX core (GDD §17): turns logic events into effect instances, applies every safety and performance limit, and
// simulates particles. Pure and time-injected: no Phaser, no logic calls. The Phaser renderer (phaser-renderer.js)
// draws what this decides; tests drive it headlessly with a recording renderer.
//
// Hard rule (§17.1): this module only READS events and state snapshots. It never calls step(), never sends inputs,
// never mutates an event or the state, and nothing in the logic waits for it.
import { keysForEvent, CINEMATIC_KEYS, DEFAULT_SUFFIX } from './events.js';
import { FlashLimiter, SpriteFlashGate, ShakeGate, QualityMonitor } from './limiters.js';
import { ParticleStore, frameOf, makeRng } from './particles.js';

const AURA_TOKENS = { aura: 'aura', target_aura: 'targetAura', member_aura: 'memberAura' };
const SIDES = ['player', 'enemy'];
const CINEMATIC_FADE_MS = 160; // §17.1: a cinematic effect ends at freeze_end, fade-out ≤ 160 ms
const SPRITE_FLASH_HOLD_MS = 100; // a refresh keeps the tint at full this long (multi-hit cards hit every 60–150 ms)
const STAT_CAP = 400;

export function hexToInt(h) {
  return typeof h === 'string' && /^#[0-9a-fA-F]{6}$/.test(h) ? parseInt(h.slice(1), 16) : null;
}

/** §15.3 rule 14 saturated red (r ≥ 200, g ≤ 80, b ≤ 80) — refused at runtime too, whatever the data says. */
export function isSaturatedRedInt(c) {
  return ((c >> 16) & 255) >= 200 && ((c >> 8) & 255) <= 80 && (c & 255) <= 80;
}

/** Resolve a colorRef token for a context to an int colour (white when the token cannot be resolved). */
export function resolveColor(ref, ctx, colors) {
  const C = colors || {};
  const white = hexToInt(C.white) !== null ? hexToInt(C.white) : 0xffffff;
  if (typeof ref !== 'string') return white;
  if (ref.charAt(0) === '#') return hexToInt(ref) !== null ? hexToInt(ref) : white;
  if (ref === 'white') return white;
  if (AURA_TOKENS[ref]) {
    const a = ctx && ctx[AURA_TOKENS[ref]];
    return C.aura && hexToInt(C.aura[a]) !== null ? hexToInt(C.aura[a]) : white;
  }
  if (ref === 'card_type') return C.card_type && hexToInt(C.card_type[ctx && ctx.cardType]) !== null ? hexToInt(C.card_type[ctx.cardType]) : white;
  if (ref === 'rarity') return C.rarity && hexToInt(C.rarity[String(ctx && ctx.rarity)]) !== null ? hexToInt(C.rarity[String(ctx.rarity)]) : white;
  return white;
}

/** §17.3 reduce motion / low quality: halve, rounded down, min 1. */
export function halve(n) {
  return Math.max(1, Math.floor(n / 2));
}

function activeFighter(state, side) {
  const t = state && state.teams && state.teams[side];
  if (!t || !t.fighters) return null;
  return t.fighters[t.activeSlot] || null;
}

function fighterAt(state, side, slot) {
  const t = state && state.teams && state.teams[side];
  return t && t.fighters ? t.fighters[slot] || null : null;
}

export class VfxCore {
  /**
   * vfxData = parsed data/vfx.json. opts: { reduceMotion, quality: 'auto'|'high'|'low', lookup: { character(id),
   * card(id) }, renderer, seed }.
   */
  constructor(vfxData, opts) {
    const o = opts || {};
    this.data = vfxData || { limits: {}, colors: {}, effects: {}, events: {} };
    const L = this.data.limits || {};
    this.limits = {
      flashes: L.max_screen_flashes_per_s === undefined ? 3 : L.max_screen_flashes_per_s,
      flashAlpha: Math.min(0.9, L.max_flash_alpha === undefined ? 0.9 : L.max_flash_alpha),
      spriteInterval: L.sprite_flash_min_interval_ms || 334,
      shakeIntensity: L.max_shake_intensity === undefined ? 0.012 : L.max_shake_intensity,
      shakeMs: L.max_shake_ms === undefined ? 300 : L.max_shake_ms,
      high: L.max_particles_high === undefined ? 150 : L.max_particles_high,
      low: L.max_particles_low === undefined ? 60 : L.max_particles_low,
      emitters: L.max_emitters || 8,
      lowFrameMs: L.low_quality_frame_ms || 22.2,
      lowWindow: L.low_quality_window_frames || 120,
    };
    this.renderer = o.renderer || null;
    this.lookup = o.lookup || {};
    this.reduceMotion = !!o.reduceMotion;
    this.flash = new FlashLimiter(this.limits.flashes, 1000);
    this.shakeGate = new ShakeGate(this.limits.shakeIntensity, this.limits.shakeMs);
    this.spriteGates = { player: new SpriteFlashGate(this.limits.spriteInterval), enemy: new SpriteFlashGate(this.limits.spriteInterval) };
    this.monitor = new QualityMonitor(this.limits.lowWindow, this.limits.lowFrameMs, 10);
    this.store = new ParticleStore(this.limits.high, this.limits.emitters, makeRng(o.seed || 1));
    this.qualityMode = 'auto';
    this.quality = 'high';
    this.instances = [];
    this.nextInst = 1;
    this.loops = { player: null, enemy: null };
    this.ignitionSlot = { player: -1, enemy: -1 };
    this.lastState = null;
    this.shakeOwner = 0;
    this.destroyed = false;
    this.stats = {
      flashes: [], flashesDropped: 0, shakes: [], shakesRefused: 0, spriteOnsets: { player: 0, enemy: 0 },
      spriteDropped: 0, particlesMax: 0, emittersMax: 0, played: 0, skippedBudget: 0, quality: 'high', unknown: [],
    };
    if (o.quality === 'high' || o.quality === 'low') this.setQuality(o.quality);
  }

  // ------------------------------------------------------------------ settings
  setReduceMotion(b) {
    this.reduceMotion = !!b;
    if (this.reduceMotion && this.shakeGate.running(this.now || 0)) {
      this.shakeGate.stop();
      if (this.renderer && this.renderer.stopShake) this.renderer.stopShake();
    }
  }

  /** 'auto' (default: high until the frame-time monitor says low), or force 'high' / 'low' (tests, AC-17.6). */
  setQuality(q) {
    this.qualityMode = q === 'high' || q === 'low' ? q : 'auto';
    this.applyQuality(this.qualityMode === 'auto' ? this.monitor.quality : q);
  }

  applyQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    this.stats.quality = q;
    this.store.setCap(q === 'low' ? this.limits.low : this.limits.high);
    if (this.renderer && this.renderer.onQuality) this.renderer.onQuality(q);
  }

  particleCap() {
    return this.store.cap;
  }

  // ------------------------------------------------------------------ inputs
  /** Logic events of one step (or one frame) + the state snapshot after them. Reads only. */
  onBattleEvents(events, state, now) {
    if (this.destroyed || !events || !events.length) return;
    const t = now === undefined ? Date.now() : now;
    this.now = t;
    if (state) this.lastState = state;
    const st = state || this.lastState;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (!e) continue;
      if (e.type === 'freeze_end') {
        this.endCinematic(e.kind, e.side, t);
        if (e.kind === 'ignition') this.startIgnitionLoop(e.side, st, t);
        continue;
      }
      if (e.type === 'ignition_end') {
        this.stopLoop(e.side, e.slot, t);
        continue;
      }
      if (e.type === 'battle_end') {
        this.stopLoop('player', -1, t);
        this.stopLoop('enemy', -1, t);
        continue;
      }
      if (e.type === 'ignition') this.ignitionSlot[e.side] = e.slot;
      const keys = keysForEvent(e);
      for (let k = 0; k < keys.length; k++) this.playKey(keys[k].key, this.context(e, keys[k], st), t);
    }
  }

  /** Summon reveal hooks: stage 'orb' (charge starts) or 'reveal' (flash moment); rarity 3–5. */
  onSummon(stage, rarity, now) {
    if (this.destroyed) return;
    const t = now === undefined ? Date.now() : now;
    this.now = t;
    const key = (stage === 'reveal' ? 'summon_reveal.' : 'summon_orb.') + rarity;
    this.playKey(key, { rarity: rarity, side: null, target: null, raw: null }, t);
  }

  /** Build the colour/anchor context for one key of one event (reads the snapshot, never writes it). */
  context(e, k, st) {
    const actorF = e.type === 'ignition' ? fighterAt(st, k.actor, e.slot) || activeFighter(st, k.actor) : activeFighter(st, k.actor);
    let targetF = activeFighter(st, k.target);
    if (e.type === 'ko' || e.type === 'knockdown') targetF = fighterAt(st, e.side, e.slot) || targetF;
    const ctx = {
      side: k.actor, target: k.target, raw: e,
      aura: actorF ? actorF.aura : null, targetAura: targetF ? targetF.aura : null,
      characterId: actorF ? actorF.characterId : null, slot: actorF ? actorF.slot : -1,
      cardType: e.cardType || null, cardId: e.cardId || null, rarity: null, memberAura: null, members: null,
      cinematic: CINEMATIC_KEYS[k.key] || null, cineSide: e.side,
    };
    if (e.type === 'tri_burst' && Array.isArray(e.members)) {
      ctx.members = e.members.map((slot) => {
        const f = fighterAt(st, e.side, slot);
        return { slot: slot, aura: f ? f.aura : null, characterId: f ? f.characterId : null, name: f ? f.name : '' };
      });
    }
    if (e.type === 'tri_burst_hit') {
      const f = fighterAt(st, e.side, e.memberSlot);
      ctx.memberAura = f ? f.aura : ctx.aura;
    }
    return ctx;
  }

  /** Effect ids for a key, with the per-card / per-character override of the `*_default` effect (§17.2). */
  effectIds(key, ctx) {
    const ev = this.data.events || {};
    const list = Array.isArray(ev[key]) ? ev[key] : null;
    if (!list) return [];
    let override = null;
    const L = this.lookup;
    if (key === 'ignition' || key === 'ignition_active') {
      const ch = ctx.characterId && L.character ? L.character(ctx.characterId) : null;
      const v = ch && ch.ignition && ch.ignition.art ? ch.ignition.art.vfx : null;
      if (v) override = key === 'ignition' ? v : v + '_active';
    } else if (key === 'climax_cinematic' || key === 'hit.fist' || key === 'hit.bolt' || key === 'hit.signature') {
      // A Climax card's art.vfx is its cinematic effect; for hit.climax the per-hit sparks stay the default.
      const card = ctx.cardId && L.card ? L.card(ctx.cardId) : null;
      override = card && card.art ? card.art.vfx || null : null;
    }
    if (!override || !this.data.effects || !this.data.effects[override]) return list;
    return list.map((id) => (id.slice(-DEFAULT_SUFFIX.length) === DEFAULT_SUFFIX ? override : id));
  }

  playKey(key, ctx, now) {
    const ids = this.effectIds(key, ctx);
    const out = [];
    for (let i = 0; i < ids.length; i++) {
      const inst = this.play(ids[i], ctx, now);
      if (inst) out.push(inst);
    }
    return out;
  }

  /** Start one effect. Returns the instance or null (unknown id → nothing, §17.1 rule 3; dropped by reduce motion). */
  play(effectId, ctx, now, loop) {
    const effects = this.data.effects || {};
    let id = effectId;
    let ef = effects[id];
    if (!ef) {
      if (this.stats.unknown.length < 50 && this.stats.unknown.indexOf(id) < 0) this.stats.unknown.push(id);
      return null;
    }
    if (this.reduceMotion) {
      const rm = ef.reduce_motion || 'keep';
      if (rm === 'drop') return null;
      if (rm !== 'keep') {
        if (!effects[rm]) return null;
        id = rm;
        ef = effects[rm];
      }
    }
    const inst = {
      id: this.nextInst++, effectId: id, effect: ef, ctx: ctx, t0: now, loop: !!(loop || ef.loop),
      prio: ef.priority | 0, layers: [], ended: false,
      cinematic: ctx.cinematic, cineSide: ctx.cineSide,
    };
    for (const ly of ef.layers || []) this.expandLayer(inst, ly);
    this.instances.push(inst);
    this.stats.played += 1;
    this.tickInstance(inst, now);
    return inst;
  }

  /** member_aura layers repeat once per living Tri-Burst member (stagger = emit_interval_ms), except overlays. */
  expandLayer(inst, ly) {
    const ctx = inst.ctx;
    if (ly.color === 'member_aura' && ctx.members && ctx.members.length && ly.kind !== 'overlay') {
      const step = ly.kind === 'portrait_slide' || ly.kind === 'beam' ? ly.emit_interval_ms || 0 : 0;
      ctx.members.forEach((m, i) => {
        inst.layers.push(this.layerState(ly, ly.start_ms + i * step, { memberAura: m.aura, memberIndex: i, memberCount: ctx.members.length, member: m }));
      });
      return;
    }
    inst.layers.push(this.layerState(ly, ly.start_ms, null));
  }

  layerState(ly, startMs, member) {
    return { ly: ly, start: startMs, started: false, done: false, handle: null, emitter: -1, emitterSeq: 0, emitted: 0, nextEmit: 0, member: member };
  }

  // ------------------------------------------------------------------ per frame
  /** Call once per rendered frame: real time `now` (ms) and the frame time `dtMs`. */
  update(now, dtMs) {
    if (this.destroyed) return;
    this.now = now;
    const dt = dtMs > 0 ? dtMs : 0;
    for (let i = 0; i < this.instances.length; i++) this.tickInstance(this.instances[i], now);
    // drop finished instances (in place, no new array)
    let w = 0;
    for (let i = 0; i < this.instances.length; i++) {
      const inst = this.instances[i];
      if (!inst.ended) this.instances[w++] = inst;
    }
    this.instances.length = w;
    this.store.update(dt);
    if (this.store.maxSeen > this.stats.particlesMax) this.stats.particlesMax = this.store.maxSeen;
    if (this.store.maxEmittersSeen > this.stats.emittersMax) this.stats.emittersMax = this.store.maxEmittersSeen;
    this.stats.skippedBudget = this.store.skipped;
    if (this.qualityMode === 'auto' && dt > 0) {
      const q = this.monitor.frame(dt);
      if (q !== this.quality) this.applyQuality(q);
    }
  }

  tickInstance(inst, now) {
    if (inst.ended) return;
    const el = now - inst.t0;
    const ef = inst.effect;
    let allDone = true;
    for (let i = 0; i < inst.layers.length; i++) {
      const L = inst.layers[i];
      if (!L.started && el >= L.start) this.startLayer(inst, L, now);
      if (L.started && !L.done) this.runLayer(inst, L, now);
      if (!L.done) allDone = false;
    }
    // Cinematic effects stay owned until their freeze_end (so the cut reaches every visual); a safety net ends them
    // if no freeze_end ever arrives (e.g. the scene stopped stepping).
    if (inst.loop) return;
    if (inst.cinematic) {
      if (el >= ef.duration_ms + 3000) this.finishInstance(inst, now, CINEMATIC_FADE_MS);
    } else if (allDone || el >= ef.duration_ms + 50) {
      this.finishInstance(inst, now, false);
    }
  }

  /** Effective particle count (§17.3 reduce motion halves; low quality halves). */
  scaledCount(n) {
    let c = n | 0;
    if (this.reduceMotion) c = halve(c);
    if (this.quality === 'low') c = halve(c);
    return c;
  }

  startLayer(inst, L, now) {
    L.started = true;
    const ly = L.ly;
    const ctx = L.member ? Object.assign({}, inst.ctx, L.member) : inst.ctx;
    L.ctx = ctx;
    const R = this.renderer;
    switch (ly.kind) {
      case 'shake': {
        L.done = true;
        if (this.reduceMotion) return; // §17.3: every shake layer is dropped
        const s = this.shakeGate.request(now, ly.duration_ms, ly.intensity);
        if (!s) {
          this.stats.shakesRefused += 1;
          return;
        }
        this.shakeOwner = inst.id;
        this.pushStat(this.stats.shakes, { t: now, ms: s.ms, intensity: s.intensity, effect: inst.effectId });
        if (R && R.shake) R.shake(s.ms, s.intensity);
        return;
      }
      case 'screen_flash': {
        L.done = true;
        if (this.reduceMotion) return; // §17.3: every screen_flash layer is dropped
        const color = resolveColor(ly.color, ctx, this.data.colors);
        if (isSaturatedRedInt(color)) return; // no saturated red full-screen flash, ever
        if (!this.flash.request(now)) {
          this.stats.flashesDropped += 1;
          return;
        }
        const alpha = Math.min(this.limits.flashAlpha, ly.alpha === undefined ? this.limits.flashAlpha : ly.alpha);
        this.pushStat(this.stats.flashes, now);
        if (R && R.screenFlash) R.screenFlash(color, alpha, ly.duration_ms);
        return;
      }
      case 'sprite_flash': {
        L.done = true;
        const side = ly.anchor === 'attacker' ? ctx.side : ctx.target;
        const g = this.spriteGates[side];
        if (!g) return;
        const r = g.hit(now, ly.alpha === undefined ? 0.8 : ly.alpha, ly.duration_ms, SPRITE_FLASH_HOLD_MS);
        if (r === 'onset') this.stats.spriteOnsets[side] += 1;
        else if (r === 'dropped') this.stats.spriteDropped += 1;
        return;
      }
      case 'particles':
        this.startParticles(inst, L, now);
        return;
      default: {
        const spec = this.visualSpec(inst, L, ctx, now);
        if (R && R.visual) L.handle = R.visual(spec) || null;
        if (!inst.loop) L.done = true; // the renderer animates and retires the visual on its own clock
        return;
      }
    }
  }

  visualSpec(inst, L, ctx, now) {
    const ly = L.ly;
    let count = ly.count || 1;
    if (ly.kind === 'afterimage' && this.reduceMotion) count = halve(count); // §17.3 afterimages halved
    let colors = null;
    if (ly.kind === 'overlay' && ly.color === 'member_aura' && ctx.members) {
      colors = ctx.members.map((m) => resolveColor('aura', { aura: m.aura }, this.data.colors));
    }
    let spriteKey = ly.sprite_key || null;
    if (spriteKey === 'ignition') {
      const ch = ctx.characterId && this.lookup.character ? this.lookup.character(ctx.characterId) : null;
      spriteKey = ch && ch.ignition && ch.ignition.art ? ch.ignition.art.sprite || null : null;
    }
    return {
      kind: ly.kind, inst: inst.id, effectId: inst.effectId, t0: now, durationMs: ly.duration_ms, loop: inst.loop,
      loopMs: inst.effect.duration_ms, anchor: ly.anchor || 'target', side: ctx.side, target: ctx.target,
      color: resolveColor(ly.color, ctx, this.data.colors), colors: colors, alpha: ly.alpha === undefined ? 1 : ly.alpha,
      sizePx: ly.size_px || 0, scaleFrom: ly.scale_from === undefined ? null : ly.scale_from,
      scaleTo: ly.scale_to === undefined ? null : ly.scale_to, count: count, frame: frameOf(ly.texture),
      texture: ly.texture || null, spin: ly.speed || 0, direction: ly.direction || null, spriteKey: spriteKey,
      members: ctx.members, member: L.member, memberIndex: L.member ? L.member.memberIndex : 0,
      memberCount: L.member ? L.member.memberCount : ctx.members ? ctx.members.length : 1,
      aura: ctx.aura, targetAura: ctx.targetAura, memberAura: ctx.memberAura, rarity: ctx.rarity,
      reduceMotion: this.reduceMotion, quality: this.quality, raw: ctx.raw,
    };
  }

  startParticles(inst, L, now) {
    const ly = L.ly;
    const prio = inst.prio;
    const timed = (ly.emit_interval_ms || 0) > 0 && (inst.loop || ly.duration_ms > 0);
    const e = this.store.acquireEmitter(prio, inst.id);
    if (e < 0) {
      if (!inst.loop) L.done = true; // budget full: priority ≤ 1 request skipped (§17.4); loops retry
      L.nextEmit = now + (ly.emit_interval_ms || 100);
      return;
    }
    L.emitter = e;
    L.emitterSeq = this.store.eSeq[e];
    L.spec = this.particleSpec(inst, L);
    L.total = this.scaledCount(ly.count || 1);
    if (!timed) {
      this.store.spawn(L.total, e, L.spec);
      this.store.releaseEmitter(e, false);
      L.done = true;
      return;
    }
    L.nextEmit = now;
    this.runLayer(inst, L, now);
  }

  /** Timed / looping particle emission (one batch per emit_interval_ms). */
  runLayer(inst, L, now) {
    const ly = L.ly;
    if (ly.kind !== 'particles' || L.done) return;
    const S = this.store;
    const owned = L.emitter >= 0 && S.eActive[L.emitter] && S.eSeq[L.emitter] === L.emitterSeq;
    if (!owned) {
      if (!inst.loop) {
        L.done = true; // evicted by a higher-priority request
        return;
      }
      if (now < L.nextEmit) return;
      const e = S.acquireEmitter(inst.prio, inst.id);
      L.nextEmit = now + (ly.emit_interval_ms || 100);
      if (e < 0) return;
      L.emitter = e;
      L.emitterSeq = S.eSeq[e];
      if (!L.spec) L.spec = this.particleSpec(inst, L);
      if (!L.total) L.total = this.scaledCount(ly.count || 1);
    }
    const iv = ly.emit_interval_ms || 100;
    const spec = L.spec;
    if (inst.loop) {
      let maxAlive = ly.max_alive || 12;
      if (this.quality === 'low') maxAlive = halve(maxAlive); // ignition_active ≤ 6 on low (§17.2)
      if (this.reduceMotion) maxAlive = halve(maxAlive);
      while (now >= L.nextEmit) {
        L.nextEmit += iv;
        if (now - L.nextEmit > iv * 4) L.nextEmit = now + iv; // after a stall do not burst-catch-up
        this.refreshAnchor(spec, inst, L);
        const room = maxAlive - S.aliveOf(L.emitter);
        if (room > 0) S.spawn(Math.min(L.total, room), L.emitter, spec);
      }
      return;
    }
    const el = now - inst.t0 - L.start;
    const batches = Math.max(1, Math.floor(ly.duration_ms / iv));
    while (L.emitted < L.total && now >= L.nextEmit) {
      const k = Math.min(batches, Math.floor(el / iv) + 1);
      const want = Math.min(L.total, Math.ceil((L.total * k) / batches)) - L.emitted;
      this.refreshAnchor(spec, inst, L);
      if (want > 0) S.spawn(want, L.emitter, spec);
      L.emitted += Math.max(0, want);
      L.nextEmit += iv;
    }
    if (L.emitted >= L.total || el >= ly.duration_ms) {
      S.releaseEmitter(L.emitter, false);
      L.done = true;
    }
  }

  particleSpec(inst, L) {
    const ly = L.ly;
    const ctx = L.ctx || inst.ctx;
    const tokenKey = AURA_TOKENS[ly.color];
    const frame = frameOf(ly.texture);
    const aura = tokenKey && !frame ? ctx[tokenKey] || null : null;
    const dir = ly.direction || 'out';
    let base = 0;
    let spread = ly.spread_deg === undefined ? (dir === 'up' ? 40 : dir === 'attack' ? 60 : 360) : ly.spread_deg;
    if (dir === 'up') base = -90;
    else if (dir === 'attack') base = ctx.side === 'enemy' ? 180 : 0;
    else if (spread < 360) base = -90;
    const spec = {
      x: 0, y: 0, prio: inst.prio, inst: inst.id, frame: frame, colors: [resolveColor(ly.color, ctx, this.data.colors)],
      sizeMin: ly.size_px || 3, sizeMax: ly.size_max_px || ly.size_px || 6, life: ly.life_ms || 400, speed: ly.speed || 100,
      spreadDeg: spread, baseDeg: base, direction: dir, aura: aura, alpha: ly.alpha === undefined ? 1 : ly.alpha,
    };
    this.refreshAnchor(spec, inst, L);
    return spec;
  }

  refreshAnchor(spec, inst, L) {
    const R = this.renderer;
    const ctx = L.ctx || inst.ctx;
    const p = R && R.anchor ? R.anchor(L.ly.anchor || 'target', ctx) : null;
    spec.x = p ? p.x : 0;
    spec.y = p ? p.y : 0;
  }

  // ------------------------------------------------------------------ endings
  finishInstance(inst, now, fadeMs) {
    if (inst.ended) return;
    inst.ended = true;
    for (const L of inst.layers) {
      if (L.emitter >= 0 && this.store.eActive[L.emitter] && this.store.eSeq[L.emitter] === L.emitterSeq) this.store.releaseEmitter(L.emitter, false);
      if (fadeMs !== false && L.handle && L.handle.end) L.handle.end(fadeMs);
      L.done = true;
    }
    if (fadeMs !== false) this.store.fadeInstance(inst.id, fadeMs);
  }

  /** freeze_end of a cinematic: its effects end now (≤ 160 ms fade), whatever is still playing (§17.1 rule 1). */
  endCinematic(kind, side, now) {
    for (const inst of this.instances) {
      if (inst.ended || inst.cinematic !== kind || inst.cineSide !== side) continue;
      if (this.shakeOwner === inst.id && this.shakeGate.running(now)) {
        this.shakeGate.stop();
        if (this.renderer && this.renderer.stopShake) this.renderer.stopShake();
      }
      this.finishInstance(inst, now, CINEMATIC_FADE_MS);
    }
  }

  startIgnitionLoop(side, st, now) {
    const slot = this.ignitionSlot[side];
    const f = slot >= 0 ? fighterAt(st, side, slot) : activeFighter(st, side);
    this.stopLoop(side, -1, now);
    const ctx = {
      side: side, target: side === 'player' ? 'enemy' : 'player', raw: null, aura: f ? f.aura : null, targetAura: null,
      characterId: f ? f.characterId : null, slot: f ? f.slot : slot, cardType: null, cardId: null, rarity: null,
      memberAura: null, members: null, cinematic: null, cineSide: side,
    };
    const insts = this.playKey('ignition_active', ctx, now);
    for (const inst of insts) inst.loop = true;
    this.loops[side] = { slot: ctx.slot, insts: insts };
  }

  stopLoop(side, slot, now) {
    const lp = this.loops[side];
    if (!lp) return;
    if (slot >= 0 && lp.slot >= 0 && slot !== lp.slot) return;
    for (const inst of lp.insts) this.finishInstance(inst, now, CINEMATIC_FADE_MS);
    this.loops[side] = null;
  }

  /** Skip / scene change: end everything now with a short fade (e.g. summon tap-to-skip: "no further effects"). */
  clear(now, fadeMs) {
    const t = now === undefined ? this.now || 0 : now;
    const f = fadeMs === undefined ? 0 : fadeMs;
    for (const inst of this.instances) this.finishInstance(inst, t, f);
    this.instances.length = 0;
    this.loops.player = null;
    this.loops.enemy = null;
    if (f === 0) this.store.clear();
    this.shakeGate.stop();
    if (this.renderer && this.renderer.stopShake) this.renderer.stopShake();
    if (this.renderer && this.renderer.clearVisuals) this.renderer.clearVisuals(f);
    for (const s of SIDES) this.spriteGates[s].reset();
  }

  spriteFlashLevel(side, now) {
    const g = this.spriteGates[side];
    return g ? g.level(now === undefined ? this.now || 0 : now) : 0;
  }

  /** True while any effect (not loops) is still scheduled or animating. */
  busy() {
    for (const inst of this.instances) if (!inst.ended && !inst.loop) return true;
    return this.store.liveCount > 0;
  }

  pushStat(arr, v) {
    if (arr.length >= STAT_CAP) arr.splice(0, arr.length - STAT_CAP + 1);
    arr.push(v);
  }

  destroy() {
    this.clear(this.now || 0, 0);
    this.destroyed = true;
  }
}
