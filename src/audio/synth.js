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

/** One shared 1 s white-noise buffer per AudioContext. The samples are generated once per sample rate and copied
 *  into each context's buffer (pre-rendering creates many OfflineAudioContexts; perf R-2). */
const noiseCache = new WeakMap();
const noiseSamples = new Map();
export function noiseData(sampleRate) {
  const sr = sampleRate || 44100;
  let d = noiseSamples.get(sr);
  if (d) return d;
  const len = Math.max(1, Math.floor(sr));
  d = new Float32Array(len);
  let seed = 0x9e3779b9; // deterministic noise (xorshift32)
  for (let i = 0; i < len; i++) {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed >>>= 0;
    d[i] = (seed / 0xffffffff) * 2 - 1;
  }
  noiseSamples.set(sr, d);
  return d;
}
export function noiseBuffer(ctx) {
  let b = noiseCache.get(ctx);
  if (b) return b;
  const sr = ctx.sampleRate || 44100;
  const d = noiseData(sr);
  b = ctx.createBuffer(1, d.length, sr);
  if (b.copyToChannel) b.copyToChannel(d, 0);
  else b.getChannelData(0).set(d);
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

// ------------------------------------------------------------ pre-rendering (round 7, perf R-2)
// The live graphs above cost 6–10 node creations + automation per sound on the main thread. Rendering the very same
// graph once into an AudioBuffer (OfflineAudioContext, rendered off the main thread) makes every later play one
// AudioBufferSourceNode. Same graph, same sample rate, same deterministic noise → the same samples.

/** Length in seconds of a single voice (start offset included). */
export function voiceLength(voice) {
  return (voice.start_s || 0) + voice.duration_s;
}

/**
 * Render `build(ctx, dest)` (which starts its voices at time 0) into a mono AudioBuffer of `lengthS` seconds.
 * createOffline(channels, frames, sampleRate) → OfflineAudioContext. Resolves to the AudioBuffer.
 */
export function renderOffline(createOffline, sampleRate, lengthS, build) {
  const frames = Math.max(1, Math.ceil((lengthS + 0.02) * sampleRate));
  const off = createOffline(1, frames, sampleRate);
  build(off, off.destination);
  return off.startRendering();
}

/** Pre-render a one-shot synth (without sound.gain, which stays a live GainNode). */
export function renderSynth(createOffline, sampleRate, synth) {
  let len = 0;
  for (const v of synth.voices) len = Math.max(len, voiceLength(v));
  return renderOffline(createOffline, sampleRate, len, (ctx, dest) => startSynth(ctx, dest, synth, 0));
}

/** Pre-render one pattern note (opts as for startVoice: freqHz or gainMul). */
export function renderVoice(createOffline, sampleRate, voice, opts) {
  return renderOffline(createOffline, sampleRate, voiceLength(voice), (ctx, dest) => startVoice(ctx, dest, voice, 0, opts));
}

/**
 * Render several one-shots in ONE OfflineAudioContext (each startRendering() costs ~4 ms of main thread at 4× CPU,
 * so batching amortises it). items: [{ length (s), build(ctx, dest, when) }]. Each item starts on a whole frame,
 * ≥ 50 ms after the previous one ends, on a 128-frame boundary, so its samples equal a solo render. Resolves to one Float32Array per item.
 */
const RENDER_QUANTUM = 128;

export function renderBatch(createOffline, sampleRate, items) {
  const sr = sampleRate;
  const gap = Math.ceil(0.05 * sr);
  const spans = [];
  let frame = 0;
  for (const it of items) {
    const frames = Math.max(1, Math.ceil((it.length + 0.02) * sr));
    spans.push({ start: frame, frames });
    // Each item starts on a 128-frame render quantum, like a live sound started at ctx.currentTime. Chrome renders
    // automated voices that start mid-quantum differently (measured round 7), so alignment keeps the samples equal.
    frame = Math.ceil((frame + frames + gap) / RENDER_QUANTUM) * RENDER_QUANTUM;
  }
  const off = createOffline(1, Math.max(1, frame), sr);
  items.forEach((it, i) => it.build(off, off.destination, spans[i].start / sr));
  return off.startRendering().then((buf) => {
    const all = buf.getChannelData(0);
    return spans.map((sp) => all.slice(sp.start, sp.start + sp.frames));
  });
}

/** Play a pre-rendered buffer at `when` into `dest`. Returns { end, stop(t) } like startSynth. */
export function startBuffer(ctx, dest, buffer, when, fadeGain) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(dest);
  src.start(when);
  const end = when + buffer.duration;
  let stopped = false;
  return {
    end,
    stop(t) {
      if (stopped) return;
      stopped = true;
      const at = Math.max(t, when);
      try {
        // voice stealing: a 5 ms fade on the sound's own gain node (as the live voices do), then stop
        if (fadeGain) {
          fadeGain.gain.cancelScheduledValues(at);
          fadeGain.gain.setValueAtTime(fadeGain.gain.value, at);
          fadeGain.gain.linearRampToValueAtTime(0.0001, at + 0.005);
        }
        src.stop(at + 0.01);
      } catch (e) {
        /* already stopped */
      }
    },
  };
}
