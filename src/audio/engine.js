// Audio engine (GDD §18): SFX by hook, procedural music loops, gain law, ducking, voice limit, gesture unlock,
// background suspend. All sounds are data (audio.json); nothing here names a file. Owner: audio-designer.
//
// Graph:  sound gain (sound.gain) ─► sfxBus (master² × sfx²) ─┐
//         track gain (track.gain × fade) ─► duck ─► bgmBus (master² × bgm²) ─┴► limiter ─► destination
import {
  mixOf, normalizeSettings, sfxBusGain, bgmBusGain, VoiceLimiter, DuckState, resolveTrack, rampValue,
  midiToHz, stepSeconds, synthLength,
} from './mix.js';
import { startSynth, startVoice, isPercussion } from './synth.js';

const LOOKAHEAD_S = 0.15; // schedule music this far ahead
const PUMP_MS = 25;
const VOLUME_RAMP_S = 0.01; // "within one frame" (§18.5)
const MENU_AFTER_END_FALLBACK_S = 1.5; // menu starts this long after the battle fade if no result stinger played

function defaultCreateContext() {
  const C = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  return C ? new C({ latencyHint: 'interactive' }) : null;
}

function setParam(param, from, to, t0, dur) {
  try {
    param.cancelScheduledValues(t0);
    param.setValueAtTime(from, t0);
    if (dur > 0) param.linearRampToValueAtTime(to, t0 + dur);
    else param.setValueAtTime(to, t0);
  } catch (e) {
    /* closed context */
  }
}

export class AudioEngine {
  /**
   * @param {object} audioData parsed data/audio.json
   * @param {object} settings save.settings (master_volume, bgm_volume, sfx_volume, muted)
   * @param {object} [opts] { createContext, setInterval, clearInterval, warn } — injectable for tests
   */
  constructor(audioData, settings, opts) {
    const o = opts || {};
    this.data = audioData;
    this.sounds = audioData.sounds || {};
    this.hooks = audioData.hooks || {};
    this.mix = mixOf(audioData);
    this.settings = normalizeSettings(settings);
    this.createContext = o.createContext || defaultCreateContext;
    this.setIntervalFn = o.setInterval || ((fn, ms) => setInterval(fn, ms));
    this.clearIntervalFn = o.clearInterval || ((id) => clearInterval(id));
    this.warnFn = o.warn || ((m) => console.warn(m));
    this.warned = new Set();

    this.ctx = null;
    this.unlocked = false;
    this.hidden = false;
    this.timer = null;
    this.limiter = new VoiceLimiter(this.mix.max_voices, this.mix.same_sound_min_interval_ms);
    this.duck = new DuckState(this.mix);
    this.handles = new Map(); // limiter voice id → playing synth handle
    this.desiredTrack = null;
    this.players = []; // music TrackPlayers (the last one is current; older ones are fading out)
    this.pendingMenuAt = null;
    this.stats = { soundsStarted: 0, soundsDropped: 0, soundsSkipped: 0, lastSkip: null, notesStarted: 0, contextsCreated: 0 };
  }

  warnOnce(key, msg) {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.warnFn('[audio] ' + msg);
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ------------------------------------------------------------ unlock, background
  /** Call on the first pointerup / touchend / keydown (and on later ones: resumes a suspended context). */
  onGesture() {
    if (this.hidden) return;
    if (!this.ctx) {
      const ctx = this.createContext();
      if (!ctx) return;
      this.stats.contextsCreated += 1;
      this.ctx = ctx;
      this.buildGraph();
      this.unlocked = true;
      this.resume();
      if (this.desiredTrack) this.startTrack(this.desiredTrack, this.mix.music_fade_in_s);
      this.timer = this.setIntervalFn(() => this.pump(), PUMP_MS);
      this.pump();
      return;
    }
    if (this.ctx.state === 'suspended') this.resume();
  }

  resume() {
    try {
      const p = this.ctx.resume();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {
      /* ignore */
    }
  }

  /** Page visibility (GDD §18.1 rule 4): hidden suspends the context, visible resumes it (after the first gesture). */
  setHidden(hidden) {
    this.hidden = !!hidden;
    if (!this.ctx) return;
    try {
      if (this.hidden) {
        const p = this.ctx.suspend();
        if (p && p.catch) p.catch(() => {});
      } else if (this.unlocked) this.resume();
    } catch (e) {
      /* ignore */
    }
  }

  buildGraph() {
    const ctx = this.ctx;
    let out = ctx.destination;
    if (ctx.createDynamicsCompressor) {
      // Safety limiter: 12 stacked hits must not clip. It only acts near full scale.
      const c = ctx.createDynamicsCompressor();
      c.threshold.value = -6;
      c.knee.value = 6;
      c.ratio.value = 8;
      c.attack.value = 0.003;
      c.release.value = 0.2;
      c.connect(ctx.destination);
      out = c;
      this.limiterNode = c;
    }
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = sfxBusGain(this.settings);
    this.sfxBus.connect(out);
    this.bgmBus = ctx.createGain();
    this.bgmBus.gain.value = bgmBusGain(this.settings);
    this.bgmBus.connect(out);
    this.duckNode = ctx.createGain();
    this.duckNode.gain.value = this.duck.target();
    this.duck.ramp = { from: this.duck.target(), to: this.duck.target(), t0: 0, t1: 0 };
    this.duckNode.connect(this.bgmBus);
  }

  // ------------------------------------------------------------ settings
  /** Apply save.settings at once (GDD §18.5). Muting keeps the slider values. */
  setVolumes(settings) {
    const prevSfx = sfxBusGain(this.settings);
    const prevBgm = bgmBusGain(this.settings);
    this.settings = normalizeSettings(settings);
    if (!this.ctx) return;
    const t = this.now();
    setParam(this.sfxBus.gain, prevSfx, sfxBusGain(this.settings), t, VOLUME_RAMP_S);
    setParam(this.bgmBus.gain, prevBgm, bgmBusGain(this.settings), t, VOLUME_RAMP_S);
  }

  // ------------------------------------------------------------ SFX
  /**
   * Play the sound mapped to `hook` (GDD §18.2). opts.soundKey: per-card override (card.sfx); used if `sounds`
   * has it, else the hook's sound plays and a warning is logged once.
   * Returns { played, key, reason } (reason: not_unlocked | hidden | unknown_hook | silent | muted | same_key |
   * voice_limit | no_sound).
   */
  sfx(hook, opts) {
    let key;
    const override = opts && opts.soundKey;
    if (override && this.sounds[override]) key = override;
    else {
      if (override) this.warnOnce('card:' + override, 'card sfx "' + override + '" not in audio.json sounds; using hook "' + hook + '"');
      if (!(hook in this.hooks)) {
        this.warnOnce('hook:' + hook, 'hook "' + hook + '" not in audio.json hooks');
        return this.drop(null, 'unknown_hook', false);
      }
      key = this.hooks[hook];
      if (key === null) return { played: false, key: null, reason: 'silent' };
    }
    const r = this.playSound(key);
    if (r.played && typeof hook === 'string' && hook.indexOf('result_') === 0 && this.pendingMenuAt !== null) {
      // GDD §18.3: the menu track starts after the result stinger.
      this.pendingMenuAt = r.end;
    }
    return r;
  }

  drop(key, reason, counted) {
    if (counted) this.stats.soundsDropped += 1;
    else this.stats.soundsSkipped += 1;
    this.stats.lastSkip = reason;
    return { played: false, key, reason };
  }

  /** Play a sound key directly (one-shot). */
  playSound(key) {
    // GDD §18.1 rule 2: before the first gesture sfx are dropped, not queued.
    if (!this.unlocked || !this.ctx) return this.drop(key, 'not_unlocked', true);
    if (this.hidden || this.ctx.state === 'suspended') return this.drop(key, 'hidden', true);
    const def = this.sounds[key];
    if (!def || !def.synth) {
      this.warnOnce('sound:' + key, 'sound "' + key + '" missing or has no synth');
      return this.drop(key, 'no_sound', false);
    }
    if (sfxBusGain(this.settings) === 0) return this.drop(key, 'muted', false);
    const t = this.now();
    const len = synthLength(def.synth);
    const req = this.limiter.request(key, def.priority || 0, t * 1000, len * 1000);
    if (!req.play) return this.drop(key, req.reason, false);
    if (req.stopId !== null) {
      const victim = this.handles.get(req.stopId);
      if (victim) victim.stop(t);
      this.handles.delete(req.stopId);
    }
    const g = this.ctx.createGain();
    g.gain.value = def.gain;
    g.connect(this.sfxBus);
    const h = startSynth(this.ctx, g, def.synth, t);
    this.handles.set(req.id, h);
    this.stats.soundsStarted += 1;
    return { played: true, key, reason: null, end: h.end, id: req.id };
  }

  // ------------------------------------------------------------ music
  /** GDD §18.3. context: 'menu' | 'summon' | 'battle' | 'story'; bgmKey: stage.bgm / story scene bgm (optional). */
  setMusicContext(context, bgmKey) {
    const key = resolveTrack(this.data, context, bgmKey);
    if (context === 'battle' && bgmKey && !this.sounds[bgmKey]) this.warnOnce('bgm:' + bgmKey, 'bgm "' + bgmKey + '" not in sounds; using battle_default');
    this.pendingMenuAt = null;
    if (key === this.desiredTrack) return key; // same track keeps playing (no restart)
    this.desiredTrack = key;
    if (this.unlocked) this.startTrack(key, this.mix.crossfade_s);
    return key;
  }

  /** Battle end (GDD §18.3): fade the battle track out over 0.5 s; the menu track starts after the result stinger. */
  endBattleMusic() {
    this.resetDuck();
    const fade = this.mix.music_fade_in_s;
    this.desiredTrack = null;
    if (!this.unlocked) {
      this.desiredTrack = this.data.music.menu;
      return;
    }
    this.fadeOutAll(fade);
    this.pendingMenuAt = this.now() + fade + MENU_AFTER_END_FALLBACK_S;
  }

  currentPlayer() {
    const p = this.players[this.players.length - 1];
    return p && p.stopAt === null ? p : null;
  }

  fadeOutAll(fade) {
    const t = this.now();
    for (const p of this.players) {
      if (p.stopAt !== null) continue;
      const from = rampValue(p.fade, t);
      p.fade = { from, to: 0, t0: t, t1: t + fade };
      setParam(p.gain.gain, from * p.def.gain, 0, t, fade);
      p.stopAt = t + fade;
    }
  }

  startTrack(key, fade) {
    this.fadeOutAll(fade);
    if (!key) return;
    const def = this.sounds[key];
    if (!def || !def.pattern) {
      this.warnOnce('track:' + key, 'track "' + key + '" missing or has no pattern');
      return;
    }
    const t = this.now();
    const gain = this.ctx.createGain();
    gain.connect(this.duckNode);
    setParam(gain.gain, 0, def.gain, t, fade);
    this.players.push({ key, def, gain, fade: { from: 0, to: 1, t0: t, t1: t + fade }, step: 0, nextTime: t + 0.05, stopAt: null });
  }

  /** Scheduler tick (setInterval 25 ms in the browser; tests call it directly). */
  pump() {
    if (!this.ctx) return;
    const t = this.now();
    if (this.pendingMenuAt !== null && t >= this.pendingMenuAt) {
      this.pendingMenuAt = null;
      this.desiredTrack = this.data.music.menu;
      this.startTrack(this.desiredTrack, this.mix.music_fade_in_s);
    }
    const silent = bgmBusGain(this.settings) === 0;
    for (const p of this.players) {
      const pat = p.def.pattern;
      const dt = stepSeconds(pat);
      const horizon = t + LOOKAHEAD_S;
      if (p.nextTime < t - 1) p.nextTime = t; // context was suspended: do not burst-schedule missed steps
      while (p.nextTime < horizon && (p.stopAt === null || p.nextTime < p.stopAt)) {
        if (!silent) this.scheduleStep(p, p.step, p.nextTime);
        p.step = (p.step + 1) % pat.steps; // loop: true → seamless pattern loop
        p.nextTime += dt;
      }
    }
    // drop players that finished fading out
    this.players = this.players.filter((p) => {
      if (p.stopAt !== null && t > p.stopAt + 0.3) {
        try { p.gain.disconnect(); } catch (e) { /* ignore */ }
        return false;
      }
      return true;
    });
  }

  scheduleStep(p, step, when) {
    for (const tr of p.def.pattern.tracks) {
      const n = tr.notes[step];
      if (n === null || n === undefined) continue;
      const perc = isPercussion(tr.voice);
      startVoice(this.ctx, p.gain, tr.voice, when, perc ? { gainMul: n / 127 } : { freqHz: midiToHz(n) });
      this.stats.notesStarted += 1;
    }
  }

  // ------------------------------------------------------------ ducking
  applyDuck(ramp) {
    if (!ramp || !this.ctx) return;
    setParam(this.duckNode.gain, ramp.from, ramp.to, ramp.t0, ramp.t1 - ramp.t0);
  }

  /** Feed every logic battle event; ducks on ignition / climax_cinematic / tri_burst until their freeze_end. */
  onBattleEvent(e) {
    this.applyDuck(this.duck.onEvent(e, this.now()));
  }

  /** Manual duck (e.g. a summon ★5 reveal). duck(true) / duck(false) pairs; counted like cinematics. */
  setDuck(on, kind) {
    const k = kind || 'manual';
    this.applyDuck(on ? this.duck.start(k, this.now()) : this.duck.end(k, this.now()));
  }

  /** Pause menu open/closed (GDD §18.4: duck = pause_gain while paused). */
  setPaused(on) {
    this.applyDuck(this.duck.setPaused(on, this.now()));
  }

  /** Leaving a battle: clear cinematic ducks and pause. */
  resetDuck() {
    this.applyDuck(this.duck.reset(this.now()));
  }

  // ------------------------------------------------------------ debug / test hooks
  /** Effective gains right now, from the gain law (what AC-18.3/18.4 measure). */
  debug() {
    const t = this.now();
    const p = this.currentPlayer();
    const duck = this.duck.value(t);
    return {
      contextCreated: !!this.ctx,
      contextState: this.ctx ? this.ctx.state : 'none',
      unlocked: this.unlocked,
      soundsStarted: this.stats.soundsStarted,
      soundsDropped: this.stats.soundsDropped,
      soundsSkipped: this.stats.soundsSkipped,
      lastSkip: this.stats.lastSkip,
      notesStarted: this.stats.notesStarted,
      track: p ? p.key : null,
      desiredTrack: this.desiredTrack,
      duck,
      sfxBusGain: sfxBusGain(this.settings),
      bgmBusGain: bgmBusGain(this.settings),
      bgmGain: p ? bgmBusGain(this.settings) * p.def.gain * rampValue(p.fade, t) * duck : 0,
      activeVoices: this.limiter.active(t * 1000),
    };
  }

  dispose() {
    if (this.timer !== null) this.clearIntervalFn(this.timer);
    this.timer = null;
    if (this.ctx && this.ctx.close) {
      try {
        const p = this.ctx.close();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {
        /* ignore */
      }
    }
    this.ctx = null;
    this.unlocked = false;
    this.players = [];
  }
}
