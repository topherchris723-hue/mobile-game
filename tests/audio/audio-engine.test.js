// audio-designer (round 4): headless checks of the audio engine against GDD §18 with a mock AudioContext.
// Pattern (L-shared-006): each AC is a check function that returns a list of failures. It must return [] for the
// real implementation AND a non-empty list for a deliberately broken one, so every check is proven able to fail.
import { describe, it, expect } from 'vitest';
import { readJson } from '../helpers/load-data.js';
import { AudioEngine } from '../../src/audio/engine.js';
import { sfxGain, bgmGain, VoiceLimiter, DuckState, normalizeSettings } from '../../src/audio/mix.js';
import { initAudio, disposeAudio, sfx as apiSfx, audioDebug, setMusicContext as apiSetMusic } from '../../src/audio/index.js';
import { testOpts, fakeTarget } from './mock-audio.js';

const AUDIO = readJson('data/audio.json');
const FULL = { master_volume: 1, bgm_volume: 1, sfx_volume: 1, muted: false };
const FRAME = 1 / 60;
const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-6 : eps);

function make(Engine, settings, data) {
  const o = testOpts();
  const E = Engine || AudioEngine;
  const e = new E(data || AUDIO, settings || FULL, o);
  return { e, o };
}
function unlocked(Engine, settings, data) {
  const r = make(Engine, settings, data);
  r.e.onGesture();
  r.ctx = r.o.created[0];
  return r;
}

// ------------------------------------------------------------------ AC-18.3 gain math
function checkGainLaw(impl) {
  const f = [];
  const s = (m, x, b, muted) => ({ master_volume: m, sfx_volume: x, bgm_volume: b === undefined ? 1 : b, muted: !!muted });
  if (!near(impl.sfxGain(s(0.5, 0.8), 1.0), 0.16)) f.push('(0.5, 0.8, 1.0) != 0.16');
  if (!near(impl.sfxGain(s(1, 1), 0.7), 0.7)) f.push('(1, 1, 0.7) != 0.7');
  if (!near(impl.bgmGain(s(1, 1, 1), 0.8, 0.35), 0.28)) f.push('bgm duck 0.35 × 0.8 != 0.28');
  for (const m of [0, 0.3, 1]) for (const x of [0, 0.5, 1]) for (const g of [0, 0.5, 1]) {
    if (impl.sfxGain(s(m, x, 1, true), g) !== 0) f.push('muted sfx not 0');
    if (impl.bgmGain(s(m, 1, x, true), g, 1) !== 0) f.push('muted bgm not 0');
  }
  return f;
}

describe('AC-18.3 gain law (v², muted → 0)', () => {
  it('real implementation passes', () => {
    expect(checkGainLaw({ sfxGain, bgmGain })).toEqual([]);
  });
  it('negative: a linear law (no v²) and a mute that is ignored both FAIL', () => {
    const linear = {
      sfxGain: (st, g) => (st.muted ? 0 : st.master_volume * st.sfx_volume * g),
      bgmGain: (st, g, d) => (st.muted ? 0 : st.master_volume * st.bgm_volume * g * d),
    };
    expect(checkGainLaw(linear)).toContain('(0.5, 0.8, 1.0) != 0.16');
    const noMute = { sfxGain: (st, g) => sfxGain({ ...st, muted: false }, g), bgmGain: (st, g, d) => bgmGain({ ...st, muted: false }, g, d) };
    expect(checkGainLaw(noMute)).toContain('muted sfx not 0');
  });
  it('engine buses use the same law (master 0.5, sfx 0.8 → sfx bus 0.25 × 0.64)', () => {
    const { e, ctx } = unlocked(null, { master_volume: 0.5, sfx_volume: 0.8, bgm_volume: 1, muted: false });
    expect(near(e.sfxBus.gain.valueAt(ctx.currentTime), 0.16)).toBe(true);
    expect(near(e.bgmBus.gain.valueAt(ctx.currentTime), 0.25)).toBe(true);
  });
  it('save repair: missing master_volume / muted → 1 / false (R4-1)', () => {
    expect(normalizeSettings({ bgm_volume: 0.7, sfx_volume: 1, haptics: true })).toEqual({ master_volume: 1, bgm_volume: 0.7, sfx_volume: 1, muted: false });
  });
});

// ------------------------------------------------------------------ AC-18.2 first sound only after a gesture
function checkGestureUnlock(Engine) {
  const f = [];
  const { e, o } = make(Engine);
  e.setMusicContext('menu');
  const r = e.sfx('ui_press');
  if (o.created.length !== 0) f.push('AudioContext created before any gesture');
  if (r.played) f.push('sfx played before gesture');
  if (e.debug().soundsStarted !== 0) f.push('sounds started before gesture');
  if (o.created[0] && o.created[0].sourcesStarted > 0) f.push('sources started before gesture');
  // dropped, not queued: nothing plays on the gesture except the music
  e.onGesture();
  const ctx = o.created[0];
  if (!ctx) return f.concat('no context after gesture');
  if (ctx.state !== 'running') f.push('context not running after gesture');
  if (e.debug().track !== AUDIO.music.menu) f.push('menu track not playing after gesture');
  if (e.debug().soundsStarted !== 0) f.push('a pre-gesture sfx was queued and played');
  // fade-in 500 ms
  const p = e.currentPlayer();
  if (!p || !near(p.gain.gain.valueAt(ctx.currentTime + 0.5), AUDIO.sounds[AUDIO.music.menu].gain)) f.push('music not at full after 0.5 s fade-in');
  if (!p || !(p.gain.gain.valueAt(ctx.currentTime + 0.25) < AUDIO.sounds[AUDIO.music.menu].gain)) f.push('music did not fade in');
  ctx.advance(0.2);
  e.pump();
  if (e.debug().notesStarted === 0) f.push('no music notes scheduled');
  if (!e.sfx('ui_press').played) f.push('sfx does not play after gesture');
  return f;
}

/** Broken: starts audio on load (the AC-18.2 must-FAIL implementation). */
class EagerEngine extends AudioEngine {
  constructor(a, s, o) {
    super(a, s, o);
    this.onGesture();
  }
}

describe('AC-18.2 first sound only after a user gesture', () => {
  it('real engine: no context and 0 sounds before; running + menu track after one gesture', () => {
    expect(checkGestureUnlock(AudioEngine)).toEqual([]);
  });
  it('negative: an engine that starts music on load FAILS', () => {
    expect(checkGestureUnlock(EagerEngine)).toContain('AudioContext created before any gesture');
  });
  it('initAudio installs pointerup / touchend / keydown listeners; one pointerup unlocks; dispose removes them', () => {
    const win = fakeTarget();
    const doc = fakeTarget();
    const o = Object.assign(testOpts(), { listen: true, target: win, doc });
    initAudio(AUDIO, FULL, o);
    expect(['pointerup', 'touchend', 'keydown'].map((t) => win.count(t))).toEqual([1, 1, 1]);
    apiSetMusic('menu');
    expect(apiSfx('ui_press').played).toBe(false);
    expect(audioDebug().contextCreated).toBe(false);
    win.dispatch('pointerup');
    expect(audioDebug()).toMatchObject({ contextCreated: true, contextState: 'running', track: 'bgm_menu_01', soundsStarted: 0 });
    expect(apiSfx('ui_press').played).toBe(true);
    disposeAudio();
    expect(['pointerup', 'touchend', 'keydown', 'visibilitychange'].map((t) => (t === 'visibilitychange' ? doc : win).count(t))).toEqual([0, 0, 0, 0]);
  });
});

// ------------------------------------------------------------------ AC-18.4 ducking
function checkDuck(Engine) {
  const f = [];
  const { e, ctx } = unlocked(Engine);
  e.setMusicContext('battle', 'bgm_battle_01');
  ctx.advance(1);
  e.pump();
  const base = e.debug().bgmGain;
  const sfx0 = e.sfxBus.gain.valueAt(ctx.currentTime);
  const t0 = ctx.currentTime;
  e.onBattleEvent({ type: 'ignition', side: 'player' });
  const d = (t) => e.duckNode.gain.valueAt(t);
  if (!(d(t0 + 0.04) > 0.35 + 1e-6 && d(t0 + 0.04) < 1)) f.push('duck does not ramp');
  if (!near(d(t0 + 0.08 + FRAME), 0.35, 1e-6) && !(d(t0 + 0.08 + FRAME) <= 0.35 + 1e-6)) f.push('duck not at 0.35 within 0.08 s');
  ctx.advance(0.1);
  if (!near(e.debug().bgmGain, 0.35 * base, 1e-6)) f.push('bgm gain != 0.35 × base');
  for (const dt of [0, 0.04, 0.08, 0.1]) if (!near(e.sfxBus.gain.valueAt(t0 + dt), sfx0)) f.push('SFX gain changed by the duck');
  // overlapping cinematic: tri_burst starts while ignition is up; the ignition freeze_end must not release
  e.onBattleEvent({ type: 'tri_burst', side: 'enemy' });
  ctx.advance(1.4);
  e.onBattleEvent({ type: 'freeze_end', kind: 'hitstop' });
  e.onBattleEvent({ type: 'freeze_end', kind: 'ko' });
  e.onBattleEvent({ type: 'freeze_end', kind: 'ignition', side: 'player' });
  if (!near(d(ctx.currentTime + 0.5), 0.35)) f.push('overlap: duck released before the last cinematic ended');
  ctx.advance(2);
  const t1 = ctx.currentTime;
  e.onBattleEvent({ type: 'freeze_end', kind: 'tri_burst', side: 'enemy' });
  if (!(d(t1 + 0.15) < 1 - 1e-6)) f.push('release is instant (no 0.30 s ramp)');
  if (!near(d(t1 + 0.3 + FRAME), 1)) f.push('duck not back to 1.0 within 0.30 s of freeze_end');
  if (!near(e.sfxBus.gain.valueAt(t1 + 1), sfx0)) f.push('SFX gain changed by the duck');
  // Climax cinematic ducks too
  ctx.advance(1);
  e.onBattleEvent({ type: 'climax_cinematic', side: 'player', cardId: 'x' });
  if (!near(d(ctx.currentTime + 0.1), 0.35)) f.push('climax_cinematic does not duck');
  e.onBattleEvent({ type: 'freeze_end', kind: 'climax' });
  ctx.advance(1);
  // Pause menu → 0.5; paused during a cinematic → the lower 0.35
  e.setPaused(true);
  if (!near(d(ctx.currentTime + 0.1), 0.5)) f.push('pause duck != 0.5');
  e.onBattleEvent({ type: 'ignition' });
  if (!near(d(ctx.currentTime + 0.1), 0.35)) f.push('pause + cinematic != 0.35');
  e.onBattleEvent({ type: 'freeze_end', kind: 'ignition' });
  ctx.advance(1);
  e.setPaused(false);
  if (!near(d(ctx.currentTime + 0.31), 1)) f.push('unpause does not restore 1.0');
  return f;
}

/** Broken: one boolean duck — any freeze_end releases (overlaps not counted). */
class BoolDuck extends DuckState {
  end(kind, t) {
    this.counts = { ignition: 0, climax: 0, tri_burst: 0, manual: 0 };
    return this.retarget(t);
  }
}
class BoolDuckEngine extends AudioEngine {
  constructor(a, s, o) {
    super(a, s, o);
    this.duck = new BoolDuck(this.mix);
  }
}
/** Broken: ducks SFX too (multiplies the sfx bus). */
class DuckSfxEngine extends AudioEngine {
  applyDuck(r) {
    super.applyDuck(r);
    if (r && this.ctx) {
      this.sfxBus.gain.cancelScheduledValues(r.t0);
      this.sfxBus.gain.setValueAtTime(r.from, r.t0);
      this.sfxBus.gain.linearRampToValueAtTime(r.to, r.t1);
    }
  }
}

describe('AC-18.4 BGM ducking (0.35 cinematics, 0.5 pause, SFX untouched)', () => {
  it('real engine passes', () => {
    expect(checkDuck(AudioEngine)).toEqual([]);
  });
  it('negative: a boolean duck (overlap not counted) FAILS', () => {
    expect(checkDuck(BoolDuckEngine)).toContain('overlap: duck released before the last cinematic ended');
  });
  it('negative: ducking the SFX bus FAILS', () => {
    expect(checkDuck(DuckSfxEngine)).toContain('SFX gain changed by the duck');
  });
  it('resetDuck on leaving a battle mid-cinematic restores 1.0', () => {
    const { e, ctx } = unlocked();
    e.onBattleEvent({ type: 'ignition' });
    ctx.advance(0.5);
    e.resetDuck();
    expect(near(e.duckNode.gain.valueAt(ctx.currentTime + 0.31), 1)).toBe(true);
  });
});

// ------------------------------------------------------------------ AC-18.5 voice limiter
function checkLimiter(make12) {
  const f = [];
  let L = make12();
  let played = 0;
  for (let i = 0; i < 13; i++) if (L.request('k' + i, 0, 0, 500).play) played++;
  if (played !== 12) f.push('13 at once → ' + played + ' played');
  L = make12();
  const a = L.request('same', 0, 0, 100).play;
  const b = L.request('same', 0, 30, 100).play;
  if (!(a && !b)) f.push('same key 30 ms apart not skipped');
  L = make12();
  const c = L.request('same', 0, 0, 100).play;
  const d = L.request('same', 0, 50, 100).play;
  if (!(c && d)) f.push('same key 50 ms apart not both played');
  // 10-hit Climax at 50 ms intervals plays every hit
  L = make12();
  let hits = 0;
  for (let i = 0; i < 10; i++) if (L.request('sfx_hit_climax', 2, i * 50, 420).play) hits++;
  if (hits !== 10) f.push('10-hit climax at 50 ms → ' + hits);
  // a higher priority steals the oldest lowest-priority voice; an equal one is skipped
  L = make12();
  for (let i = 0; i < 12; i++) L.request('p' + i, i === 0 ? 1 : 0, i, 1000);
  const eq = L.request('eq', 0, 20, 1000);
  if (eq.play) f.push('13th of equal priority played');
  const hi = L.request('hi', 3, 21, 1000);
  if (!hi.play || hi.stopId !== 2) f.push('higher priority did not stop the oldest lowest-priority voice (id 2), got ' + hi.stopId);
  // ended voices free their slot
  L = make12();
  for (let i = 0; i < 12; i++) L.request('q' + i, 0, 0, 100);
  if (!L.request('late', 0, 150, 100).play) f.push('ended voices still counted');
  return f;
}

class OffByOneLimiter extends VoiceLimiter {
  request(key, p, now, dur) {
    this.prune(now);
    const id = this.nextId++;
    if (this.voices.length > this.max) return { play: false, reason: 'voice_limit', id: null, stopId: null };
    this.voices.push({ id, key, priority: p || 0, start: now, end: now + dur });
    return { play: true, reason: null, id, stopId: null };
  }
}

describe('AC-18.5 voice limiter (12 voices, 40 ms same-key skip)', () => {
  it('real limiter passes', () => {
    expect(checkLimiter(() => new VoiceLimiter(12, 40))).toEqual([]);
  });
  it('negative: an off-by-one limiter without the same-key rule FAILS', () => {
    const f = checkLimiter(() => new OffByOneLimiter(12, 40));
    expect(f).toContain('13 at once → 13 played');
    expect(f).toContain('same key 30 ms apart not skipped');
  });
  it('engine: 13 priority-0 sounds at the same time → 12 play; the same key 30 ms / 50 ms apart → 1 / 2', () => {
    const data = JSON.parse(JSON.stringify(AUDIO));
    data.sounds = {};
    data.hooks = {};
    for (let i = 0; i < 13; i++) {
      data.sounds['sfx_t' + i] = { source: 'procedural', gain: 1, priority: 0, synth: { voices: [{ wave: 'sine', duration_s: 0.5 }] } };
      data.hooks['t' + i] = 'sfx_t' + i;
    }
    data.sounds.bgm_menu_01 = AUDIO.sounds.bgm_menu_01;
    data.music = { menu: 'bgm_menu_01', summon: 'bgm_menu_01', battle_default: 'bgm_menu_01' };
    const { e, ctx } = unlocked(null, FULL, data);
    const res = [];
    for (let i = 0; i < 13; i++) res.push(e.sfx('t' + i));
    expect(res.filter((r) => r.played).length).toBe(12);
    expect(res[12].reason).toBe('voice_limit');
    ctx.advance(1);
    const a = e.sfx('t0');
    ctx.advance(0.03);
    const b = e.sfx('t0');
    ctx.advance(0.02); // 50 ms after the first
    const c = e.sfx('t0');
    expect([a.played, b.played, b.reason, c.played]).toEqual([true, false, 'same_key', true]);
  });
});

// ------------------------------------------------------------------ AC-18.7 background suspend
function checkBackground(Engine) {
  const f = [];
  const { e, ctx } = unlocked(Engine);
  e.setMusicContext('battle', 'bgm_battle_02');
  e.setHidden(true);
  if (ctx.state !== 'suspended') f.push('hidden: context not suspended');
  if (e.sfx('hit_fist').played) f.push('hidden: sfx still played');
  e.onGesture(); // a stray event while hidden must not resume
  if (ctx.state !== 'suspended') f.push('hidden: resumed by an event while hidden');
  e.setHidden(false);
  if (ctx.state !== 'running') f.push('visible: context not resumed');
  if (e.debug().track !== 'bgm_battle_02') f.push('visible: track changed');
  return f;
}
class NoSuspendEngine extends AudioEngine {
  setHidden() {}
}

describe('AC-18.7 background suspends the AudioContext, visible resumes it', () => {
  it('real engine passes', () => {
    expect(checkBackground(AudioEngine)).toEqual([]);
  });
  it('negative: an engine that ignores visibility FAILS', () => {
    expect(checkBackground(NoSuspendEngine)).toContain('hidden: context not suspended');
  });
  it('visibilitychange on the document drives it (initAudio listener)', () => {
    const win = fakeTarget();
    const doc = fakeTarget();
    initAudio(AUDIO, FULL, Object.assign(testOpts(), { listen: true, target: win, doc }));
    win.dispatch('pointerup');
    doc.hidden = true;
    doc.dispatch('visibilitychange');
    expect(audioDebug().contextState).toBe('suspended');
    doc.hidden = false;
    doc.dispatch('visibilitychange');
    expect(audioDebug().contextState).toBe('running');
    disposeAudio();
  });
  it('hidden before the first gesture: a gesture does not create the context until visible', () => {
    const { e, o } = make();
    e.setHidden(true);
    e.onGesture();
    expect(o.created.length).toBe(0);
    e.setHidden(false);
    e.onGesture();
    expect(o.created.length).toBe(1);
  });
});

// ------------------------------------------------------------------ §18.3 music contexts, crossfade, battle end
describe('§18.3 music', () => {
  it('context → track: stage bgm first, then battle_default; story without bgm → menu', () => {
    const { e, o } = unlocked();
    expect(e.setMusicContext('battle', 'bgm_boss_01')).toBe('bgm_boss_01');
    expect(e.setMusicContext('battle', 'bgm_not_there')).toBe(AUDIO.music.battle_default);
    expect(o.warnings.some((w) => w.includes('bgm_not_there'))).toBe(true);
    expect(e.setMusicContext('story')).toBe(AUDIO.music.menu);
    expect(e.setMusicContext('summon')).toBe(AUDIO.music.summon);
    expect(e.setMusicContext('menu')).toBe(AUDIO.music.menu);
  });
  it('changing context crossfades over 0.6 s; the same track across scenes keeps playing', () => {
    const { e, ctx } = unlocked();
    e.setMusicContext('menu');
    ctx.advance(1);
    const menu = e.currentPlayer();
    e.setMusicContext('menu'); // Home → Team: same track
    expect(e.currentPlayer()).toBe(menu);
    const t = ctx.currentTime;
    e.setMusicContext('summon');
    const summon = e.currentPlayer();
    expect(summon.key).toBe('bgm_summon_01');
    expect(near(menu.gain.gain.valueAt(t + 0.3), AUDIO.sounds.bgm_menu_01.gain / 2, 1e-6)).toBe(true);
    expect(near(menu.gain.gain.valueAt(t + 0.6), 0)).toBe(true);
    expect(near(summon.gain.gain.valueAt(t + 0.6), AUDIO.sounds.bgm_summon_01.gain)).toBe(true);
    ctx.advance(1);
    e.pump();
    expect(e.players.map((p) => p.key)).toEqual(['bgm_summon_01']); // faded player removed
  });
  it('battle end: battle track fades out over 0.5 s, the result stinger plays, then the menu track starts', () => {
    const { e, ctx } = unlocked();
    e.setMusicContext('battle', 'bgm_battle_01');
    ctx.advance(2);
    e.pump();
    const battle = e.currentPlayer();
    const t = ctx.currentTime;
    e.endBattleMusic();
    expect(near(battle.gain.gain.valueAt(t + 0.5), 0)).toBe(true);
    expect(e.debug().track).toBe(null);
    const st = e.sfx('result_win');
    expect(st.played).toBe(true);
    ctx.advance(st.end - ctx.currentTime - 0.05);
    e.pump();
    expect(e.debug().track).toBe(null); // not before the stinger ends
    ctx.advance(0.1);
    e.pump();
    expect(e.debug().track).toBe(AUDIO.music.menu);
  });
  it('seamless loop: step times stay on the grid across the loop boundary', () => {
    const { e, ctx } = unlocked();
    e.setMusicContext('battle', 'bgm_battle_01');
    const times = [];
    const orig = e.scheduleStep.bind(e);
    e.scheduleStep = (p, step, when) => {
      if (p.key === 'bgm_battle_01') times.push([step, when]);
      orig(p, step, when);
    };
    for (let i = 0; i < 600; i++) {
      ctx.advance(0.025);
      e.pump();
    }
    const pat = AUDIO.sounds.bgm_battle_01.pattern;
    const dt = 60 / (pat.tempo_bpm * pat.steps_per_beat);
    const wrapIdx = times.findIndex(([s], i) => i > 0 && s === 0);
    expect(wrapIdx).toBe(pat.steps);
    for (let i = 1; i < times.length; i++) expect(near(times[i][1] - times[i - 1][1], dt, 1e-9)).toBe(true);
  });
  it('muted music: steps advance without creating nodes (no CPU cost), unmute continues in time', () => {
    const { e, ctx } = unlocked(null, { ...FULL, muted: true });
    e.setMusicContext('menu');
    ctx.advance(1);
    e.pump();
    expect(e.debug().notesStarted).toBe(0);
    e.setVolumes(FULL);
    ctx.advance(0.5);
    e.pump();
    expect(e.debug().notesStarted).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------ §18.2 per-card override
describe('§18.2 per-card sfx override', () => {
  it('a card sfx key in sounds replaces hit_<type>; a missing key falls back to the hook with one warning', () => {
    const { e, o, ctx } = unlocked();
    expect(e.sfx('hit_fist', { soundKey: 'sfx_hit_climax' }).key).toBe('sfx_hit_climax');
    ctx.advance(0.1);
    expect(e.sfx('hit_fist', { soundKey: 'sfx_card_nope' }).key).toBe('sfx_hit_fist');
    ctx.advance(0.1);
    e.sfx('hit_fist', { soundKey: 'sfx_card_nope' });
    expect(o.warnings.filter((w) => w.includes('sfx_card_nope')).length).toBe(1);
  });
  it('an unknown hook is silent with one warning; a null hook is silent on purpose', () => {
    const data = JSON.parse(JSON.stringify(AUDIO));
    data.hooks.ui_advance = null;
    const { e, o } = unlocked(null, FULL, data);
    expect(e.sfx('no_such_hook').reason).toBe('unknown_hook');
    expect(e.sfx('ui_advance').reason).toBe('silent');
    expect(o.warnings.length).toBe(1);
  });
  it('every live hook plays through the engine without errors', () => {
    const { e, ctx } = unlocked();
    for (const h of Object.keys(AUDIO.hooks)) {
      ctx.advance(2); // let voices end
      const r = e.sfx(h);
      expect([h, r.played]).toEqual([h, true]);
    }
  });
});

// ------------------------------------------------------------------ §18.5 / AC-19.4 settings
function checkSettings(Engine) {
  const f = [];
  const s0 = { master_volume: 0.8, bgm_volume: 0.7, sfx_volume: 0.6, muted: false };
  const { e, ctx } = unlocked(Engine, s0);
  const sfxBefore = e.sfxBus.gain.valueAt(ctx.currentTime);
  const bgmBefore = e.bgmBus.gain.valueAt(ctx.currentTime);
  ctx.advance(1);
  e.setVolumes({ ...s0, muted: true });
  const t = ctx.currentTime;
  if (!near(e.sfxBus.gain.valueAt(t + FRAME), 0) || !near(e.bgmBus.gain.valueAt(t + FRAME), 0)) f.push('mute not applied within one frame');
  if (e.sfx('hit_fist').played) f.push('muted: sfx started');
  const st = e.settings;
  if (st.master_volume !== 0.8 || st.bgm_volume !== 0.7 || st.sfx_volume !== 0.6) f.push('mute changed the slider values');
  ctx.advance(1);
  e.setVolumes({ ...s0, muted: false });
  const t2 = ctx.currentTime;
  if (!near(e.sfxBus.gain.valueAt(t2 + FRAME), sfxBefore) || !near(e.bgmBus.gain.valueAt(t2 + FRAME), bgmBefore)) f.push('unmute did not restore the previous gains');
  ctx.advance(1);
  e.setVolumes({ ...s0, bgm_volume: 0.3 });
  if (!near(e.bgmBus.gain.valueAt(ctx.currentTime + FRAME), 0.64 * 0.09)) f.push('bgm slider not applied within one frame');
  return f;
}
/** Broken: mute implemented by zeroing the stored slider values (loses them). */
class ZeroingMuteEngine extends AudioEngine {
  setVolumes(s) {
    super.setVolumes(s.muted ? { master_volume: 0, bgm_volume: 0, sfx_volume: 0, muted: false } : s);
  }
}

describe('§18.5 settings / AC-19.4 mute keeps the sliders', () => {
  it('real engine passes', () => {
    expect(checkSettings(AudioEngine)).toEqual([]);
  });
  it('negative: a mute that zeroes the sliders FAILS', () => {
    expect(checkSettings(ZeroingMuteEngine)).toContain('mute changed the slider values');
  });
});
