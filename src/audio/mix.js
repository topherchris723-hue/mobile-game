// Pure audio rules (GDD §18.2–§18.5). No Web Audio here, so every rule is unit-testable headlessly.
// Owner: audio-designer.

/** Mix defaults (GDD §18). audio.json `mix` overrides them; these only fill gaps. */
export const MIX_DEFAULTS = Object.freeze({
  max_voices: 12,
  same_sound_min_interval_ms: 40,
  duck_gain: 0.35,
  duck_attack_s: 0.08,
  duck_release_s: 0.3,
  pause_gain: 0.5,
  crossfade_s: 0.6,
  music_fade_in_s: 0.5,
});

/** Music contexts the UI may pass to setMusicContext (GDD §18.3). */
export const MUSIC_CONTEXTS = Object.freeze(['menu', 'summon', 'battle', 'story']);

/** Logic event types that start a BGM duck, and the freeze kind that ends each one (GDD §18.4). */
export const DUCK_START_EVENTS = Object.freeze({ ignition: 'ignition', climax_cinematic: 'climax', tri_burst: 'tri_burst' });
export const DUCK_FREEZE_KINDS = Object.freeze(['ignition', 'climax', 'tri_burst']);

function vol(v, dflt) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : dflt;
}

/** Settings as stored in the save (§13, ruling R4-1), repaired: missing master → 1, missing muted → false. */
export function normalizeSettings(s) {
  const o = s || {};
  return {
    master_volume: vol(o.master_volume, 1),
    bgm_volume: vol(o.bgm_volume, 1),
    sfx_volume: vol(o.sfx_volume, 1),
    muted: o.muted === true,
  };
}

/** Bus gains before per-sound gain: perceptual v² law (GDD §18.4). */
export function sfxBusGain(settings) {
  const s = normalizeSettings(settings);
  return s.muted ? 0 : s.master_volume * s.master_volume * s.sfx_volume * s.sfx_volume;
}
export function bgmBusGain(settings) {
  const s = normalizeSettings(settings);
  return s.muted ? 0 : s.master_volume * s.master_volume * s.bgm_volume * s.bgm_volume;
}

/** sfx_gain = muted ? 0 : master² × sfx² × sound.gain */
export function sfxGain(settings, soundGain) {
  return sfxBusGain(settings) * vol(soundGain, 1);
}

/** bgm_gain = muted ? 0 : master² × bgm² × track.gain × duck */
export function bgmGain(settings, trackGain, duck) {
  return bgmBusGain(settings) * vol(trackGain, 1) * vol(duck, 1);
}

/** Merge audio.json mix over the defaults. */
export function mixOf(audioData) {
  return Object.assign({}, MIX_DEFAULTS, (audioData && audioData.mix) || {});
}

/**
 * Voice limiter (GDD §18.2). Times in ms. A voice lives from its start until start + durationMs.
 * request() returns { play, reason, id, stopId }: stopId = a voice the caller must stop (stolen).
 */
export class VoiceLimiter {
  constructor(maxVoices, minIntervalMs) {
    this.max = maxVoices;
    this.minInterval = minIntervalMs;
    this.voices = []; // { id, key, priority, start, end }
    this.lastStart = new Map();
    this.nextId = 1;
  }

  prune(now) {
    this.voices = this.voices.filter((v) => v.end > now);
  }

  active(now) {
    this.prune(now);
    return this.voices.length;
  }

  request(key, priority, now, durationMs) {
    const p = priority || 0;
    this.prune(now);
    const last = this.lastStart.get(key);
    if (last !== undefined && now - last < this.minInterval) return { play: false, reason: 'same_key', id: null, stopId: null };
    let stopId = null;
    if (this.voices.length >= this.max) {
      let lowest = Infinity;
      for (const v of this.voices) lowest = Math.min(lowest, v.priority);
      if (p <= lowest) return { play: false, reason: 'voice_limit', id: null, stopId: null };
      // the oldest voice of the lowest priority stops
      let victim = null;
      for (const v of this.voices) if (v.priority === lowest && (!victim || v.start < victim.start)) victim = v;
      this.voices = this.voices.filter((v) => v !== victim);
      stopId = victim.id;
    }
    const id = this.nextId++;
    this.voices.push({ id, key, priority: p, start: now, end: now + Math.max(1, durationMs) });
    this.lastStart.set(key, now);
    return { play: true, reason: null, id, stopId };
  }

  /** A voice that ended early (stopped by the engine). */
  release(id) {
    this.voices = this.voices.filter((v) => v.id !== id);
  }

  clear() {
    this.voices = [];
    this.lastStart.clear();
  }
}

/** Linear ramp value at time t (seconds). */
export function rampValue(r, t) {
  if (t <= r.t0 || r.t1 <= r.t0) return t >= r.t1 ? r.to : r.from;
  if (t >= r.t1) return r.to;
  return r.from + (r.to - r.from) * ((t - r.t0) / (r.t1 - r.t0));
}

/**
 * BGM duck state (GDD §18.4). Cinematics are counted per kind, so overlapping cinematics keep the duck until the
 * last one ends. Pause applies pause_gain. Both at once → the lower one. Times in seconds (AudioContext time).
 */
export class DuckState {
  constructor(mix) {
    this.mix = Object.assign({}, MIX_DEFAULTS, mix || {});
    this.counts = { ignition: 0, climax: 0, tri_burst: 0, manual: 0 };
    this.paused = false;
    this.ramp = { from: 1, to: 1, t0: 0, t1: 0 };
  }

  cinematicActive() {
    return this.counts.ignition + this.counts.climax + this.counts.tri_burst + this.counts.manual > 0;
  }

  target() {
    let g = 1;
    if (this.cinematicActive()) g = Math.min(g, this.mix.duck_gain);
    if (this.paused) g = Math.min(g, this.mix.pause_gain);
    return g;
  }

  value(t) {
    return rampValue(this.ramp, t);
  }

  /** Recompute the ramp after a state change. Returns the new ramp, or null if the target did not change. */
  retarget(t) {
    const to = this.target();
    if (to === this.ramp.to) return null;
    const from = this.value(t);
    const dur = to < from ? this.mix.duck_attack_s : this.mix.duck_release_s;
    this.ramp = { from, to, t0: t, t1: t + dur };
    return this.ramp;
  }

  start(kind, t) {
    const k = kind in this.counts ? kind : 'manual';
    this.counts[k] += 1;
    return this.retarget(t);
  }

  end(kind, t) {
    const k = kind in this.counts ? kind : 'manual';
    if (this.counts[k] > 0) this.counts[k] -= 1;
    return this.retarget(t);
  }

  /** A logic battle event (any type). Returns the new ramp or null. */
  onEvent(e, t) {
    if (!e) return null;
    if (DUCK_START_EVENTS[e.type]) return this.start(DUCK_START_EVENTS[e.type], t);
    if (e.type === 'freeze_end' && DUCK_FREEZE_KINDS.includes(e.kind)) return this.end(e.kind, t);
    return null;
  }

  setPaused(on, t) {
    this.paused = !!on;
    return this.retarget(t);
  }

  /** Leaving a battle: drop every cinematic count (a battle can end mid-cinematic). */
  reset(t) {
    this.counts = { ignition: 0, climax: 0, tri_burst: 0, manual: 0 };
    this.paused = false;
    return this.retarget(t);
  }
}

/**
 * Which track key a context plays (GDD §18.3). Battle and story use their own `bgm` key when `sounds` has it;
 * battle falls back to music.battle_default, story (and anything unknown) to music.menu.
 */
export function resolveTrack(audioData, context, bgmKey) {
  const sounds = (audioData && audioData.sounds) || {};
  const music = (audioData && audioData.music) || {};
  if ((context === 'battle' || context === 'story') && bgmKey && sounds[bgmKey]) return bgmKey;
  if (context === 'battle') return music.battle_default || null;
  if (context === 'summon') return music.summon || null;
  return music.menu || null;
}

/** MIDI note → Hz (A4 = 69 = 440 Hz). */
export function midiToHz(n) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

/** Seconds per pattern step. */
export function stepSeconds(pattern) {
  return 60 / (pattern.tempo_bpm * pattern.steps_per_beat);
}

/** Total length of a one-shot synth in seconds (the voice lifetime used by the limiter). */
export function synthLength(synth) {
  let len = 0;
  for (const v of (synth && synth.voices) || []) len = Math.max(len, (v.start_s || 0) + v.duration_s);
  return len;
}
