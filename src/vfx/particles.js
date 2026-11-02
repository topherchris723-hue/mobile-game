// Particle store + emitter table with the §17.4 budget. Pure (no Phaser): the renderer only reads the arrays.
// Fixed-size typed arrays: spawning reuses slots, nothing is allocated per frame.
import { AURA_MOTION, AURA_RAMPS } from './aura-style.js';

/** Atlas frame names generated in code (src/vfx/atlas.js). Texture keys in vfx.json are 'vfx_gen_' + name. */
export const FRAMES = [
  'dot', 'soft', 'ember', 'chevron', 'kite', 'hex', 'star4', 'star5', 'crescent', 'diamond', 'streak_small',
  'ring', 'ring_seg', 'disc', 'streak', 'ghost', 'beam',
  'back_ellipse', 'back_tavi', 'back_pell', 'back_rook', 'back_solenne', 'back_thessa', 'back_corvane',
  'portrait_blaze', 'portrait_gale', 'portrait_stone', 'portrait_radiant', 'portrait_void',
];

/** Every generated texture key (no files: GDD §17.4 "generated shapes"; nothing to license, §15.3 rule 13). */
export const GENERATED_TEXTURES = [
  'vfx_gen_dot', 'vfx_gen_soft', 'vfx_gen_ember', 'vfx_gen_chevron', 'vfx_gen_kite', 'vfx_gen_hex', 'vfx_gen_star4',
  'vfx_gen_star5', 'vfx_gen_crescent', 'vfx_gen_diamond', 'vfx_gen_streak_small', 'vfx_gen_ring', 'vfx_gen_ring_seg',
  'vfx_gen_disc', 'vfx_gen_streak', 'vfx_gen_ghost', 'vfx_gen_beam', 'vfx_gen_back_ellipse', 'vfx_gen_back_tavi',
  'vfx_gen_back_pell', 'vfx_gen_back_rook', 'vfx_gen_back_solenne', 'vfx_gen_back_thessa', 'vfx_gen_back_corvane',
  'vfx_gen_portrait_blaze', 'vfx_gen_portrait_gale', 'vfx_gen_portrait_stone', 'vfx_gen_portrait_radiant',
  'vfx_gen_portrait_void', 'vfx_gen_radial', 'vfx_gen_tri_stripes',
];

export const FRAME_INDEX = {};
FRAMES.forEach((f, i) => { FRAME_INDEX[f] = i; });

/** 'vfx_gen_star4' → 'star4'; unknown or file textures → null (caller falls back to generated shapes, §17.1 rule 3). */
export function frameOf(texture) {
  if (typeof texture !== 'string' || texture.indexOf('vfx_gen_') !== 0) return null;
  const f = texture.slice(8);
  return FRAME_INDEX[f] !== undefined ? f : null;
}

/** Small seeded PRNG (mulberry32). VFX randomness never touches the logic RNG. */
export function makeRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function rnd() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEG = Math.PI / 180;

export class ParticleStore {
  /** capacity = limits.max_particles_high; cap (live limit) is set by quality (high / low). */
  constructor(capacity, maxEmitters, rng) {
    const n = Math.max(1, capacity);
    this.capacity = n;
    this.cap = n;
    this.rng = rng || makeRng(1);
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.ay = new Float32Array(n);
    this.drag = new Float32Array(n);
    this.age = new Float32Array(n);
    this.life = new Float32Array(n);
    this.size = new Float32Array(n);
    this.rot = new Float32Array(n);
    this.vrot = new Float32Array(n);
    this.alpha0 = new Float32Array(n);
    this.color = new Uint32Array(n);
    this.frame = new Uint8Array(n);
    this.prio = new Int8Array(n);
    this.emitter = new Int16Array(n);
    this.inst = new Int32Array(n);
    this.seq = new Float64Array(n);
    this.pull = new Float32Array(n);
    this.align = new Uint8Array(n);
    this.alive = new Uint8Array(n);
    this.liveCount = 0;
    this.maxSeen = 0;
    this.nextSeq = 1;
    this.cursor = 0;
    this.bounds = { minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity };
    // emitters (§17.4: active emitters ≤ max_emitters)
    const m = Math.max(1, maxEmitters || 8);
    this.maxEmitters = m;
    this.eActive = new Uint8Array(m);
    this.ePrio = new Int8Array(m);
    this.eSeq = new Float64Array(m);
    this.eAlive = new Int32Array(m);
    this.eEmitting = new Uint8Array(m);
    this.eInst = new Int32Array(m);
    this.emitterCount = 0;
    this.maxEmittersSeen = 0;
    this.skipped = 0; // requests (or parts) dropped by the budget
  }

  setCap(cap) {
    this.cap = Math.max(0, Math.min(this.capacity, cap));
    // over the new cap (quality just dropped): remove oldest, lowest priority first
    while (this.liveCount > this.cap) {
      const i = this.oldest(-1);
      if (i < 0) break;
      this.kill(i);
    }
  }

  /** Oldest live particle with priority ≤ maxPrio (−1 = any priority, lowest priority first). */
  oldest(maxPrio) {
    let best = -1;
    let bestP = 99;
    let bestS = Infinity;
    for (let i = 0; i < this.capacity; i++) {
      if (!this.alive[i]) continue;
      const p = this.prio[i];
      if (maxPrio >= 0 && p > maxPrio) continue;
      if (p < bestP || (p === bestP && this.seq[i] < bestS)) {
        best = i;
        bestP = p;
        bestS = this.seq[i];
      }
    }
    return best;
  }

  kill(i) {
    if (!this.alive[i]) return;
    this.alive[i] = 0;
    this.liveCount -= 1;
    const e = this.emitter[i];
    if (e >= 0 && this.eActive[e]) this.eAlive[e] -= 1;
  }

  // ------------------------------------------------------------------ emitters
  /** Acquire an emitter slot for priority `prio`; −1 when full (priority ≤ 1). Priority ≥ 2 evicts the oldest P0. */
  acquireEmitter(prio, inst) {
    let slot = -1;
    for (let e = 0; e < this.maxEmitters; e++) if (!this.eActive[e]) { slot = e; break; }
    if (slot < 0 && prio >= 2) {
      let bestS = Infinity;
      for (let e = 0; e < this.maxEmitters; e++) {
        if (this.ePrio[e] === 0 && this.eSeq[e] < bestS) { bestS = this.eSeq[e]; slot = e; }
      }
      if (slot >= 0) this.releaseEmitter(slot, true);
    }
    if (slot < 0) {
      this.skipped += 1;
      return -1;
    }
    this.eActive[slot] = 1;
    this.ePrio[slot] = prio;
    this.eSeq[slot] = this.nextSeq++;
    this.eAlive[slot] = 0;
    this.eEmitting[slot] = 1;
    this.eInst[slot] = inst || 0;
    this.emitterCount += 1;
    if (this.emitterCount > this.maxEmittersSeen) this.maxEmittersSeen = this.emitterCount;
    return slot;
  }

  /** Stop emitting; the slot frees itself when its last particle dies. killParticles = remove them now. */
  releaseEmitter(e, killParticles) {
    if (e < 0 || !this.eActive[e]) return;
    if (killParticles) {
      for (let i = 0; i < this.capacity; i++) if (this.alive[i] && this.emitter[i] === e) this.kill(i);
    }
    this.eEmitting[e] = 0;
    if (this.eAlive[e] <= 0) this.freeEmitter(e);
  }

  freeEmitter(e) {
    if (!this.eActive[e]) return;
    this.eActive[e] = 0;
    this.eAlive[e] = 0;
    this.emitterCount -= 1;
    for (let i = 0; i < this.capacity; i++) if (this.alive[i] && this.emitter[i] === e) this.emitter[i] = -1;
  }

  // ------------------------------------------------------------------ spawning
  /**
   * Spawn up to `n` particles for emitter `e`. spec: { x, y, prio, inst, frame (index) | null, colors [int],
   * sizeMin, sizeMax, life, speed, spreadDeg, baseDeg, direction, aura (motion preset or null), alpha }.
   * Budget (§17.4): never above cap; priority ≤ 1 gets what fits; priority ≥ 2 first removes oldest priority-0
   * particles. Returns the number spawned.
   */
  spawn(n, e, spec) {
    if (n <= 0) return 0;
    const prio = spec.prio | 0;
    if (this.liveCount + n > this.cap && prio >= 2) {
      while (this.liveCount + n > this.cap) {
        const i = this.oldest(0);
        if (i < 0) break;
        this.kill(i);
      }
    }
    const room = this.cap - this.liveCount;
    if (n > room) {
      this.skipped += 1;
      n = Math.max(0, room);
    }
    const R = this.rng;
    const motion = spec.aura ? AURA_MOTION[spec.aura] : null;
    const ramp = spec.aura ? AURA_RAMPS[spec.aura] : null;
    let made = 0;
    for (let k = 0; k < n; k++) {
      const i = this.freeSlot();
      if (i < 0) break;
      const life = spec.life * (0.625 + 0.375 * R()); // life_ms range [0.625×, 1×] (e.g. 250–400 ms for 400)
      const size = spec.sizeMin + (spec.sizeMax - spec.sizeMin) * R();
      let speed = spec.speed * (0.6 + 0.4 * R());
      let base = spec.baseDeg;
      let spread = spec.spreadDeg;
      let ay = 0;
      let drag = 0.5;
      let vrot = 0;
      let align = 0;
      let pull = 0;
      let frame = spec.frame;
      let color = spec.colors[(R() * spec.colors.length) | 0];
      if (motion && spec.direction === 'out') {
        // §7.1 language: shape, colour ramp step and motion follow the aura
        base = motion.base === -90 ? -90 : base;
        spread = Math.min(spread, motion.spread);
        ay = motion.ay;
        drag = motion.drag;
        vrot = (motion.spin || 0) * DEG * (R() < 0.5 ? -1 : 1);
        align = motion.align ? 1 : 0;
        pull = motion.pull || 0;
      }
      if (motion && frame === null) frame = motion.frames[(R() * motion.frames.length) | 0];
      if (motion && ramp) {
        const step = motion.ramp[(R() * motion.ramp.length) | 0];
        color = step === 'key' ? spec.colors[0] : ramp[step];
      }
      if (frame === null || frame === undefined) frame = 'dot';
      let ang = (base + (R() - 0.5) * spread) * DEG;
      let x = spec.x;
      let y = spec.y;
      let vx = Math.cos(ang) * speed;
      let vy = Math.sin(ang) * speed;
      if (motion && motion.flat) vy *= motion.flat;
      if (spec.direction === 'in') {
        // spawn on a circle and travel to the centre with a swirl (summon storm)
        const r = (spec.speed * spec.life) / 1000;
        ang = R() * Math.PI * 2;
        x = spec.x + Math.cos(ang) * r;
        y = spec.y + Math.sin(ang) * r;
        const v = (r / life) * 1000;
        vx = -Math.cos(ang) * v - Math.sin(ang) * v * 0.45;
        vy = -Math.sin(ang) * v + Math.cos(ang) * v * 0.45;
        drag = 0;
        align = 1;
      } else if (spec.direction === 'up') {
        x += (R() - 0.5) * 30;
        ay = -40;
        drag = 0.2;
      }
      if (pull > 0) {
        // Void: start on a small ring moving inward, then burst outward (flip at `pull` ms)
        x += Math.cos(ang) * 18;
        y += Math.sin(ang) * 18;
        vx = -vx * 0.6;
        vy = -vy * 0.6;
      }
      this.x[i] = x;
      this.y[i] = y;
      this.vx[i] = vx;
      this.vy[i] = vy;
      this.ay[i] = ay;
      this.drag[i] = drag;
      this.age[i] = 0;
      this.life[i] = life;
      this.size[i] = size;
      this.rot[i] = R() * Math.PI * 2;
      this.vrot[i] = vrot;
      this.alpha0[i] = spec.alpha === undefined ? 1 : spec.alpha;
      this.color[i] = color >>> 0;
      this.frame[i] = FRAME_INDEX[frame] !== undefined ? FRAME_INDEX[frame] : 0;
      this.prio[i] = prio;
      this.emitter[i] = e;
      this.inst[i] = spec.inst | 0;
      this.seq[i] = this.nextSeq++;
      this.pull[i] = pull;
      this.align[i] = align;
      this.alive[i] = 1;
      this.liveCount += 1;
      if (e >= 0 && this.eActive[e]) this.eAlive[e] += 1;
      made += 1;
    }
    if (this.liveCount > this.maxSeen) this.maxSeen = this.liveCount;
    return made;
  }

  freeSlot() {
    if (this.liveCount >= this.capacity) return -1;
    for (let k = 0; k < this.capacity; k++) {
      const i = (this.cursor + k) % this.capacity;
      if (!this.alive[i]) {
        this.cursor = (i + 1) % this.capacity;
        return i;
      }
    }
    return -1;
  }

  /** Live particles of emitter e. */
  aliveOf(e) {
    return e >= 0 && this.eActive[e] ? this.eAlive[e] : 0;
  }

  /** Shorten every live particle of instance `inst` to at most `ms` more life (cinematic end fade, ≤ 160 ms). */
  fadeInstance(inst, ms) {
    for (let i = 0; i < this.capacity; i++) {
      if (!this.alive[i] || this.inst[i] !== inst) continue;
      const left = this.life[i] - this.age[i];
      if (left > ms) this.life[i] = this.age[i] + ms;
    }
  }

  // ------------------------------------------------------------------ simulation
  update(dtMs) {
    const dt = Math.min(dtMs, 100) / 1000;
    const b = this.bounds;
    for (let i = 0; i < this.capacity; i++) {
      if (!this.alive[i]) continue;
      const before = this.age[i];
      this.age[i] += dtMs;
      if (this.age[i] >= this.life[i]) {
        this.kill(i);
        continue;
      }
      if (this.pull[i] > 0 && before < this.pull[i] && this.age[i] >= this.pull[i]) {
        this.vx[i] = -this.vx[i] * 2.5;
        this.vy[i] = -this.vy[i] * 2.5;
      }
      const k = this.drag[i] > 0 ? Math.max(0, 1 - this.drag[i] * dt) : 1;
      this.vx[i] *= k;
      this.vy[i] = this.vy[i] * k + this.ay[i] * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.rot[i] += this.vrot[i] * dt;
      const x = this.x[i];
      const y = this.y[i];
      if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) this.kill(i);
    }
    for (let e = 0; e < this.maxEmitters; e++) {
      if (this.eActive[e] && !this.eEmitting[e] && this.eAlive[e] <= 0) this.freeEmitter(e);
    }
  }

  clear() {
    for (let i = 0; i < this.capacity; i++) this.alive[i] = 0;
    this.liveCount = 0;
    for (let e = 0; e < this.maxEmitters; e++) this.eActive[e] = 0;
    this.emitterCount = 0;
  }
}
