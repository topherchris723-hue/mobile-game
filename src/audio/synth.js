// Procedural Web Audio voices built from audio.json `voice` objects (schema $defs/voice). Owner: audio-designer.
//
// Voice rules (how a voice object sounds):
// - Tone waves (sine/square/sawtooth/triangle): pitch glides exponentially from freq_start_hz to freq_end_hz
//   (or stays at freq_start_hz). In a music pattern a pitched voice (no freq_start_hz) plays the note's pitch.
// - noise: white noise. freq_start_hz/freq_end_hz, when given, sweep the voice's filter cutoff (a whoosh);
//   otherwise the filter stays at filter.freq_hz.
// - Pattern percussion: a voice with wave "noise", or a tone voice with freq_start_hz set, is percussion in a
//   pattern: the note number is velocity (note / 127 × gain), not pitch.
// - Envelope: 0 → gain over attack_s, then exponential decay to silence over decay_s; the voice stops at
//   start + duration_s (a 5 ms fade avoids a click when duration cuts the decay short).

const SILENT = 0.0001;

/** One shared 1 s white-noise buffer per AudioContext. */
const noiseCache = new WeakMap();
export function noiseBuffer(ctx) {
  let b = noiseCache.get(ctx);
  if (b) return b;
  const len = Math.max(1, Math.floor(ctx.sampleRate || 44100));
  b = ctx.createBuffer(1, len, ctx.sampleRate || 44100);
  const ch = b.getChannelData(0);
  let seed = 0x9e3779b9; // deterministic noise (xorshift32)
  for (let i = 0; i < len; i++) {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed >>>= 0;
    ch[i] = (seed / 0xffffffff) * 2 - 1;
  }
  noiseCache.set(ctx, b);
  return b;
}

/** Pattern helper: true if a pattern voice treats its note as velocity (percussion). */
export function isPercussion(voice) {
  return voice.wave === 'noise' || typeof voice.freq_start_hz === 'number';
}

/**
 * Start one voice at absolute time `when` into `dest`.
 * opts: { freqHz (pitched override), gainMul (velocity), detune }
 * Returns { nodes, end, stop(t) }.
 */
export function startVoice(ctx, dest, voice, when, opts) {
  const o = opts || {};
  const t0 = when + (voice.start_s || 0);
  const dur = voice.duration_s;
  const tEnd = t0 + dur;
  const attack = Math.min(voice.attack_s === undefined ? 0.005 : voice.attack_s, dur);
  const decay = voice.decay_s === undefined ? 0.1 : voice.decay_s;
  const peak = Math.max(SILENT, (voice.gain === undefined ? 1 : voice.gain) * (o.gainMul === undefined ? 1 : o.gainMul));

  const env = ctx.createGain();
  env.gain.setValueAtTime(SILENT, t0);
  if (attack > 0) env.gain.linearRampToValueAtTime(peak, t0 + attack);
  else env.gain.setValueAtTime(peak, t0);
  const decayEnd = Math.min(t0 + attack + Math.max(0.001, decay), tEnd);
  env.gain.exponentialRampToValueAtTime(SILENT, Math.max(t0 + attack + 0.001, decayEnd));
  env.gain.setValueAtTime(SILENT, tEnd);

  let src;
  let filterSweep = null;
  if (voice.wave === 'noise') {
    src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    if (typeof voice.freq_start_hz === 'number') {
      filterSweep = { from: voice.freq_start_hz, to: typeof voice.freq_end_hz === 'number' ? voice.freq_end_hz : voice.freq_start_hz };
    }
  } else {
    src = ctx.createOscillator();
    src.type = voice.wave;
    let f0 = typeof voice.freq_start_hz === 'number' ? voice.freq_start_hz : 440;
    let f1 = typeof voice.freq_end_hz === 'number' ? voice.freq_end_hz : f0;
    if (typeof o.freqHz === 'number') {
      const ratio = o.freqHz / f0;
      f0 *= ratio;
      f1 *= ratio;
    }
    src.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) src.frequency.exponentialRampToValueAtTime(Math.max(20, f1), tEnd);
    if (o.detune && src.detune) src.detune.setValueAtTime(o.detune, t0);
  }

  const nodes = [src, env];
  let head = src;
  const fdef = voice.filter || (filterSweep ? { type: 'bandpass', freq_hz: filterSweep.from, q: 1 } : null);
  if (fdef) {
    const f = ctx.createBiquadFilter();
    f.type = fdef.type;
    const fFrom = filterSweep ? filterSweep.from : fdef.freq_hz;
    f.frequency.setValueAtTime(fFrom, t0);
    if (filterSweep && filterSweep.to !== filterSweep.from) f.frequency.exponentialRampToValueAtTime(Math.max(20, filterSweep.to), tEnd);
    if (typeof fdef.q === 'number') f.Q.setValueAtTime(fdef.q, t0);
    head.connect(f);
    head = f;
    nodes.push(f);
  }
  head.connect(env);
  env.connect(dest);
  src.start(t0);
  src.stop(tEnd + 0.01);

  let stopped = false;
  return {
    nodes,
    end: tEnd,
    stop(t) {
      if (stopped) return;
      stopped = true;
      const at = Math.max(t, t0);
      try {
        env.gain.cancelScheduledValues(at);
        env.gain.setValueAtTime(env.gain.value || SILENT, at);
        env.gain.linearRampToValueAtTime(SILENT, at + 0.005);
        src.stop(at + 0.01);
      } catch (e) {
        /* already stopped */
      }
    },
  };
}

/** Play a one-shot `synth` (layered voices). Returns { end, stop(t) }. */
export function startSynth(ctx, dest, synth, when) {
  const voices = synth.voices.map((v) => startVoice(ctx, dest, v, when));
  let end = when;
  for (const v of voices) end = Math.max(end, v.end);
  return {
    end,
    stop(t) {
      for (const v of voices) v.stop(t);
    },
  };
}
