/*
 * Battle feel tuning (CLAUDE.md §5): synthesized sound recipes, vibration patterns, and impact
 * effects. Every number that shapes how a hit feels lives here, so feel passes are data edits.
 *
 * All sounds are PLACEHOLDERS synthesized at runtime with Web Audio (no audio files; see
 * docs/assets.md). They are meant to be replaced by produced SFX in the presentation phase.
 */

/** One oscillator with a pitch sweep and a fast-attack, exponential-decay envelope. */
export interface ToneLayer {
  readonly kind: 'tone';
  readonly wave: 'sine' | 'triangle' | 'square' | 'sawtooth';
  /** Start and end frequency in Hz (exponential sweep). */
  readonly from: number;
  readonly to: number;
  readonly durationMs: number;
  /** Peak gain, 0–1, before the master bus. */
  readonly gain: number;
  readonly delayMs?: number;
}

/** Filtered white noise with a swept filter frequency, for impacts and whooshes. */
export interface NoiseLayer {
  readonly kind: 'noise';
  readonly filter: 'lowpass' | 'highpass' | 'bandpass';
  readonly from: number;
  readonly to: number;
  readonly q: number;
  readonly durationMs: number;
  readonly gain: number;
  readonly delayMs?: number;
}

export type SoundLayer = ToneLayer | NoiseLayer;

const tone = (
  wave: ToneLayer['wave'],
  from: number,
  to: number,
  durationMs: number,
  gain: number,
  delayMs = 0,
): ToneLayer => ({ kind: 'tone', wave, from, to, durationMs, gain, delayMs });

const noise = (
  filter: NoiseLayer['filter'],
  from: number,
  to: number,
  durationMs: number,
  gain: number,
  q = 1,
  delayMs = 0,
): NoiseLayer => ({ kind: 'noise', filter, from, to, q, durationMs, gain, delayMs });

/** Notes used by the jingles (C major), so they stay in tune with each other. */
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

export const SOUNDS = {
  /** Accepted tap on a card or button. */
  tap: [tone('sine', 900, 700, 60, 0.14)],
  /** Refused tap (can't afford, not your turn). Two low blips. */
  deny: [tone('square', 230, 200, 70, 0.06), tone('square', 200, 170, 80, 0.06, 90)],
  /** Your turn begins. */
  turn: [tone('triangle', E5, E5, 120, 0.1), tone('triangle', G5, G5, 160, 0.1, 70)],
  strike: [noise('bandpass', 2200, 500, 130, 0.45, 1.2), tone('triangle', 180, 70, 120, 0.25)],
  blast: [tone('sawtooth', 380, 1300, 220, 0.07), noise('highpass', 1200, 4000, 220, 0.18)],
  technique: [tone('triangle', 520, 1040, 200, 0.12), tone('sine', 780, 1560, 220, 0.08, 40)],
  /** Rising charge under a Signature or Crossover cut-in. */
  cutIn: [
    tone('sawtooth', 160, 640, 650, 0.06),
    tone('sine', 320, 1280, 650, 0.08),
    noise('highpass', 600, 5000, 650, 0.12),
  ],
  signature: [
    noise('lowpass', 4000, 300, 380, 0.5),
    tone('sawtooth', 260, 90, 360, 0.1),
    tone('sine', 120, 40, 420, 0.4),
  ],
  crossover: [
    noise('lowpass', 5000, 250, 520, 0.55),
    tone('triangle', C5, C5, 360, 0.12),
    tone('triangle', G5, G5, 360, 0.1, 60),
    tone('sine', 110, 35, 600, 0.45),
  ],
  hitDealt: [noise('lowpass', 3200, 500, 140, 0.5), tone('sine', 140, 55, 150, 0.4)],
  hitTaken: [noise('lowpass', 2400, 350, 170, 0.55), tone('sine', 110, 45, 190, 0.45)],
  hitHeavy: [noise('lowpass', 4500, 200, 300, 0.6), tone('sine', 100, 30, 340, 0.55)],
  guard: [tone('triangle', 1300, 1100, 140, 0.12), noise('bandpass', 3000, 2500, 120, 0.2, 4)],
  heal: [
    tone('sine', C5, C5, 160, 0.1),
    tone('sine', E5, E5, 160, 0.1, 80),
    tone('sine', G5, G5, 240, 0.1, 160),
  ],
  status: [tone('triangle', 660, 990, 160, 0.1)],
  charge: [tone('sine', 200, 620, 320, 0.14), noise('bandpass', 400, 1800, 300, 0.12, 2)],
  switch: [noise('bandpass', 500, 2600, 200, 0.3, 1.5)],
  drain: [tone('sine', 1000, 280, 380, 0.12), tone('sine', 1500, 420, 380, 0.06, 30)],
  ko: [tone('sine', 320, 40, 560, 0.4), noise('lowpass', 1500, 120, 500, 0.35)],
  victory: [
    tone('triangle', C5, C5, 150, 0.12),
    tone('triangle', E5, E5, 150, 0.12, 130),
    tone('triangle', G5, G5, 150, 0.12, 260),
    tone('triangle', C6, C6, 420, 0.13, 390),
  ],
  defeat: [
    tone('triangle', G5 / 2, G5 / 2, 260, 0.12),
    tone('triangle', E5 / 2, E5 / 2, 260, 0.12, 240),
    tone('triangle', C5 / 2, C5 / 2, 520, 0.12, 480),
  ],
} as const satisfies Record<string, readonly SoundLayer[]>;

export type SoundId = keyof typeof SOUNDS;

/** Master volume and the cap on overlapping layers (protects low-end phones and ears). */
export const AUDIO_MIX = { masterGain: 0.7, maxVoices: 16 } as const;

/** Vibration patterns in ms (on, off, on, …), deliberately short (CLAUDE.md §5). */
export const HAPTICS = {
  tap: [8],
  deny: [10, 50, 10],
  hitDealt: [10],
  hitTaken: [24],
  hitHeavy: [40],
  signature: [14, 40, 22],
  ko: [60],
  victory: [30, 70, 30, 70, 90],
  defeat: [120],
} as const satisfies Record<string, readonly number[]>;

export type HapticId = keyof typeof HAPTICS;

/** A named moment in battle: the sound and (optional) vibration it triggers. */
export const CUES = {
  tap: { sound: 'tap', haptic: 'tap' },
  deny: { sound: 'deny', haptic: 'deny' },
  turn: { sound: 'turn', haptic: null },
  strike: { sound: 'strike', haptic: null },
  blast: { sound: 'blast', haptic: null },
  technique: { sound: 'technique', haptic: null },
  cutIn: { sound: 'cutIn', haptic: 'signature' },
  signature: { sound: 'signature', haptic: null },
  crossover: { sound: 'crossover', haptic: null },
  hitDealt: { sound: 'hitDealt', haptic: 'hitDealt' },
  hitTaken: { sound: 'hitTaken', haptic: 'hitTaken' },
  hitHeavy: { sound: 'hitHeavy', haptic: 'hitHeavy' },
  guard: { sound: 'guard', haptic: null },
  heal: { sound: 'heal', haptic: null },
  status: { sound: 'status', haptic: null },
  charge: { sound: 'charge', haptic: null },
  switch: { sound: 'switch', haptic: null },
  drain: { sound: 'drain', haptic: null },
  ko: { sound: 'ko', haptic: 'ko' },
  victory: { sound: 'victory', haptic: 'victory' },
  defeat: { sound: 'defeat', haptic: 'defeat' },
} as const satisfies Record<string, { sound: SoundId | null; haptic: HapticId | null }>;

export type CueId = keyof typeof CUES;

/**
 * Impact effects. Hit-stop freezes battle animation briefly on contact; shake is skipped entirely
 * with Reduce motion. Amplitudes are in logical units (720 = screen width).
 */
export const IMPACT = {
  hitStopMs: { normal: 45, heavy: 110, ko: 140 },
  shake: {
    heavy: { amplitude: 9, durationMs: 260 },
    ko: { amplitude: 12, durationMs: 320 },
  },
  sparks: { normal: 8, heavy: 18, poolSize: 48, lifeMs: 360, speed: 900, drag: 5 },
} as const;

/** How long a Signature / Crossover cut-in holds the stage before the attack plays (1× speed). */
export const CUT_IN_MS = 950;
