import { AUDIO_MIX, SOUNDS, type SoundId, type SoundLayer } from '../config/feedback';
import { createRng } from '../core/rng';
import type { Logger } from '../debug/log';

/*
 * Sound effects synthesized with Web Audio from the recipes in config/feedback.ts (placeholders
 * until produced SFX exist). Browsers only start audio after a user gesture, so the context is
 * (re)started from tap handlers; until then play() is silently skipped.
 */

export interface Sfx {
  play(id: SoundId): void;
  /** Stops the audio clock while the game is hidden or rotated (saves battery). */
  setSuspended(suspended: boolean): void;
  dispose(): void;
}

/** Envelope floor: exponential ramps can't reach 0. */
const SILENT = 0.0001;
const ATTACK_S = 0.005;

export function createSfx(log: Logger): Sfx {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let suspended = false;
  let voices = 0;

  const ensureContext = (): void => {
    if (context || typeof AudioContext === 'undefined') return;
    try {
      context = new AudioContext({ latencyHint: 'interactive' });
    } catch (error) {
      log.warn(`Audio unavailable: ${String(error)}`);
      return;
    }
    // A compressor on the master bus keeps stacked hits from clipping.
    const compressor = context.createDynamicsCompressor();
    master = context.createGain();
    master.gain.value = AUDIO_MIX.masterGain;
    master.connect(compressor).connect(context.destination);
    // One second of white noise, reused by every noise layer.
    noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    const rng = createRng(0xa0d10);
    for (let i = 0; i < samples.length; i++) samples[i] = rng.next() * 2 - 1;
    log.info(`Audio ready (${context.sampleRate} Hz)`);
  };

  /** Called from gesture handlers: creating or resuming a context only works inside one. */
  const unlock = (): void => {
    if (suspended) return;
    ensureContext();
    if (context && context.state !== 'running') {
      context.resume().catch((error: unknown) => {
        log.debug(`Audio resume refused: ${String(error)}`);
      });
    }
  };
  // pointerup/keydown are user-activation events in Chrome (pointerdown on touch is not).
  const gestureEvents = ['pointerup', 'keydown'] as const;
  for (const name of gestureEvents) document.addEventListener(name, unlock, { capture: true });

  const playLayer = (ctx: AudioContext, out: AudioNode, layer: SoundLayer): void => {
    const start = ctx.currentTime + (layer.delayMs ?? 0) / 1000;
    const end = start + layer.durationMs / 1000;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(SILENT, start);
    envelope.gain.exponentialRampToValueAtTime(layer.gain, start + ATTACK_S);
    envelope.gain.exponentialRampToValueAtTime(SILENT, end);
    envelope.connect(out);

    let source: AudioScheduledSourceNode;
    if (layer.kind === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = layer.wave;
      osc.frequency.setValueAtTime(layer.from, start);
      osc.frequency.exponentialRampToValueAtTime(layer.to, end);
      osc.connect(envelope);
      source = osc;
    } else {
      if (!noiseBuffer) return;
      const buffer = ctx.createBufferSource();
      buffer.buffer = noiseBuffer;
      buffer.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = layer.filter;
      filter.Q.value = layer.q;
      filter.frequency.setValueAtTime(layer.from, start);
      filter.frequency.exponentialRampToValueAtTime(layer.to, end);
      buffer.connect(filter).connect(envelope);
      source = buffer;
    }
    voices++;
    source.onended = () => {
      voices--;
      source.disconnect();
      envelope.disconnect();
    };
    source.start(start);
    source.stop(end + 0.02);
  };

  return {
    play(id) {
      if (!context || !master || context.state !== 'running') return;
      const layers = SOUNDS[id];
      // Under heavy overlap, drop new sounds rather than stack an unbounded number of nodes.
      if (voices + layers.length > AUDIO_MIX.maxVoices) return;
      for (const layer of layers) playLayer(context, master, layer);
    },

    setSuspended(next) {
      suspended = next;
      if (!context) return;
      const change = next ? context.suspend() : context.resume();
      change.catch((error: unknown) => {
        log.debug(`Audio ${next ? 'suspend' : 'resume'} failed: ${String(error)}`);
      });
    },

    dispose() {
      for (const name of gestureEvents) {
        document.removeEventListener(name, unlock, { capture: true });
      }
      void context?.close();
      context = null;
      master = null;
    },
  };
}
