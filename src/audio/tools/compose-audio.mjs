// Generates data/audio.json: every SFX and music loop is procedural Web Audio synthesis, composed by the team
// (self-made, GDD §18.1 rule 3). Run: node src/audio/tools/compose-audio.mjs   (Node only; never imported by the game)
// Owner: audio-designer. Edit the sounds/music here, regenerate, then run the tests in tests/audio/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUT = path.join(ROOT, 'data', 'audio.json');

// ------------------------------------------------------------ helpers
const r3 = (x) => Math.round(x * 1000) / 1000;
/** One voice. o: { start, attack, decay, gain, filter: [type, hz, q] } */
function v(wave, f0, f1, dur, o) {
  const x = o || {};
  const out = { wave };
  if (f0 !== null && f0 !== undefined) out.freq_start_hz = f0;
  if (f1 !== null && f1 !== undefined) out.freq_end_hz = f1;
  if (x.start) out.start_s = r3(x.start);
  out.duration_s = r3(dur);
  out.attack_s = r3(x.attack === undefined ? 0.003 : x.attack);
  out.decay_s = r3(x.decay === undefined ? dur : x.decay);
  out.gain = r3(x.gain === undefined ? 1 : x.gain);
  if (x.filter) {
    out.filter = { type: x.filter[0], freq_hz: x.filter[1] };
    if (x.filter[2] !== undefined) out.filter.q = x.filter[2];
  }
  return out;
}
const sfx = (gain, priority, voices) => ({ source: 'procedural', gain, priority, synth: { voices } });

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
/** "A4" → 69 */
function m(name) {
  const mm = /^([A-G][#b]?)(-?\d)$/.exec(name);
  return 12 * (Number(mm[2]) + 1) + NOTE[mm[1]];
}
const hz = (name) => r3(440 * Math.pow(2, (m(name) - 69) / 12));

/** Parse a step string: tokens separated by spaces; "." = rest; a note name; or a number (velocity). */
function steps(str) {
  return str.trim().split(/\s+/).map((t) => (t === '.' ? null : /^\d+$/.test(t) ? Number(t) : m(t)));
}
/** Repeat a 16-step bar pattern n times. */
const rep = (arr, n) => Array.from({ length: n }, () => arr).flat();
/** Transpose a one-bar template of semitone offsets (null = rest) onto chord roots, one root per bar. */
function onRoots(template, roots) {
  return roots.flatMap((root) => template.map((o) => (o === null ? null : m(root) + o)));
}
function track(voice, notes) {
  return { voice, notes };
}
function pattern(gain, tempo, nSteps, tracks) {
  for (const t of tracks) if (t.notes.length !== nSteps) throw new Error(`pattern: ${t.notes.length} notes != ${nSteps} steps`);
  return { source: 'procedural', gain, loop: true, priority: 0, pattern: { tempo_bpm: tempo, steps_per_beat: 4, steps: nSteps, tracks } };
}

// ------------------------------------------------------------ music instruments
const KICK = v('sine', 150, 42, 0.24, { attack: 0.001, decay: 0.22, gain: 1 });
const KICK_HARD = v('sine', 180, 38, 0.28, { attack: 0.001, decay: 0.26, gain: 1 });
const SNARE = v('noise', null, null, 0.18, { attack: 0.001, decay: 0.15, gain: 0.55, filter: ['bandpass', 1900, 0.7] });
const CLAP = v('noise', null, null, 0.14, { attack: 0.002, decay: 0.12, gain: 0.45, filter: ['bandpass', 1400, 1.2] });
const HAT = v('noise', null, null, 0.05, { attack: 0.001, decay: 0.04, gain: 0.22, filter: ['highpass', 7500] });
const SHAKER = v('noise', null, null, 0.08, { attack: 0.02, decay: 0.06, gain: 0.14, filter: ['highpass', 6000] });
const BASS = v('sawtooth', null, null, 0.2, { attack: 0.004, decay: 0.18, gain: 0.5, filter: ['lowpass', 650, 5] });
const BASS_GALLOP = v('sawtooth', null, null, 0.12, { attack: 0.003, decay: 0.11, gain: 0.5, filter: ['lowpass', 700, 6] });
const BASS_SOFT = v('triangle', null, null, 0.3, { attack: 0.01, decay: 0.28, gain: 0.6 });
const STAB = v('sawtooth', null, null, 0.16, { attack: 0.003, decay: 0.15, gain: 0.26, filter: ['lowpass', 2200, 1.5] });
const LEAD = v('square', null, null, 0.24, { attack: 0.006, decay: 0.3, gain: 0.2, filter: ['lowpass', 3200, 1] });
const LEAD_SAW = v('sawtooth', null, null, 0.24, { attack: 0.008, decay: 0.3, gain: 0.2, filter: ['lowpass', 2800, 2] });
const ARP = v('triangle', null, null, 0.12, { attack: 0.003, decay: 0.11, gain: 0.22 });
const BELL = v('sine', null, null, 0.45, { attack: 0.003, decay: 0.45, gain: 0.32 });
const PAD = v('triangle', null, null, 1.2, { attack: 0.25, decay: 1.0, gain: 0.3 });
const SPARK = v('sine', null, null, 0.2, { attack: 0.002, decay: 0.2, gain: 0.16 });

// ------------------------------------------------------------ bgm_battle_01: A minor, 150 BPM, 8 bars, driving
function battle01() {
  const roots = ['A2', 'A2', 'F2', 'G2', 'A2', 'A2', 'F2', 'E2'];
  const bass = onRoots([0, null, 0, null, 12, null, 0, null, 0, null, 0, null, 12, null, 0, 7], roots);
  const stabRoot = onRoots([12, null, null, 12, null, null, 12, null, null, null, null, null, null, null, null, null], roots);
  const stabFifth = onRoots([19, null, null, 19, null, null, 19, null, null, null, null, null, null, null, null, null], roots);
  const kickBar = steps('110 . . . 110 . . . 110 . . . 110 . . .');
  const kickFill = steps('110 . . . 110 . . . 110 . 90 . 110 . 110 .');
  const kick = [...rep(kickBar, 3), ...kickFill, ...rep(kickBar, 3), ...kickFill];
  const snBar = steps('. . . . 110 . . . . . . . 110 . . .');
  const snFill = steps('. . . . 110 . . . 90 . 100 . 110 90 100 127');
  const snare = [...rep(snBar, 7), ...snFill];
  const hat = rep(steps('60 . 110 . 60 . 110 . 60 . 110 . 60 . 110 60'), 8);
  const lead = steps(`
    E5 . . A5 . . G5 . E5 . D5 . E5 . . .
    C5 . D5 . E5 . . . A4 . C5 . D5 . . .
    F5 . . E5 . . C5 . A4 . C5 . F5 . E5 .
    D5 . . . B4 . D5 . G5 . . . F5 . D5 .
    E5 . . A5 . . B5 . C6 . . . B5 . A5 .
    G5 . E5 . . . D5 . E5 . G5 . A5 . . .
    A5 . . G5 . . F5 . E5 . F5 . A5 . C6 .
    B5 . . . G#5 . . . E5 . . . B4 . G#5 .`);
  return pattern(0.55, 150, 128, [
    track(KICK, kick), track(SNARE, snare), track(HAT, hat), track(BASS, bass),
    track(STAB, stabRoot), track(STAB, stabFifth), track(LEAD, lead),
  ]);
}

// ------------------------------------------------------------ bgm_battle_02: D minor, 160 BPM, 8 bars, gallop + arps
function battle02() {
  const roots = ['D2', 'Bb1', 'C2', 'A1', 'G1', 'Bb1', 'A1', 'A1'];
  const bass = onRoots([0, null, 0, 0, 12, null, 0, 0, 0, null, 0, 0, 12, null, 0, 0], roots);
  // arpeggio over the chord (minor or major third by bar)
  const thirds = [3, 4, 4, 4, 3, 4, 4, 4];
  const arp = roots.flatMap((root, i) => {
    const r = m(root) + 24;
    const t = thirds[i];
    return [r, r + t, r + 7, r + 12, r + 7, r + t, r + 7, r + 12, r + t + 12, r + 12, r + 7, r + t, r, r + t, r + 7, r + 12];
  });
  const kick = rep(steps('115 . . . 100 . . 90 115 . . . 100 . 90 .'), 8);
  const clap = [...rep(steps('. . . . 110 . . . . . . . 110 . . .'), 7), ...steps('. . . . 110 . . . 100 . 100 . 110 110 120 127')];
  const hat = rep(steps('90 50 70 50 90 50 70 50 90 50 70 50 90 50 70 90'), 8);
  const lead = steps(`
    . . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . . .
    . . . . . . . . . . . . . . . .
    . . . . . . . . . . . . E5 . F5 G5
    A5 . . . G5 . F5 . D5 . . . F5 . G5 .
    F5 . . . D5 . . . Bb4 . D5 . F5 . . .
    E5 . . . C#5 . E5 . A5 . . . G5 . E5 .
    C#5 . . . E5 . . . A5 . . . . . . .`);
  return pattern(0.55, 160, 128, [
    track(KICK, kick), track(CLAP, clap), track(HAT, hat), track(BASS_GALLOP, bass), track(ARP, arp), track(LEAD_SAW, lead),
  ]);
}

// ------------------------------------------------------------ bgm_boss_01: E phrygian, 172 BPM, 8 bars, heavy
function boss01() {
  const roots = ['E2', 'E2', 'F2', 'E2', 'E2', 'E2', 'D2', 'F2'];
  const bass = onRoots([0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 1, 0, 12, 0], roots);
  const p1 = onRoots([12, null, null, null, null, null, 12, null, null, null, 12, null, null, null, null, null], roots);
  const p5 = onRoots([19, null, null, null, null, null, 19, null, null, null, 19, null, null, null, null, null], roots);
  const kick = rep(steps('120 . 100 . . . 120 . 120 . 100 . . . 120 100'), 8);
  const snare = [...rep(steps('. . . . 120 . . . . . . . 120 . . .'), 3), ...steps('. . . . 120 . . . 100 100 110 110 120 120 127 127'),
    ...rep(steps('. . . . 120 . . . . . . . 120 . . .'), 3), ...steps('120 . 110 . 120 . 110 . 120 110 120 110 127 120 127 127')];
  const hat = rep(steps('100 . 70 . 100 . 70 . 100 . 70 . 100 70 100 70'), 8);
  const lead = steps(`
    E5 . . . . . F5 . . . E5 . . . . .
    B4 . . . C5 . . . B4 . . . G4 . . .
    F5 . . . . . G5 . . . F5 . . . E5 .
    D5 . . . E5 . . . . . . . . . . .
    E6 . . . D6 . C6 . B5 . . . C6 . B5 .
    G5 . . . A5 . B5 . . . . . G5 . . .
    A5 . . . G5 . F5 . D5 . . . F5 . A5 .
    C6 . . . B5 . A5 . G5 . F5 . E5 . . .`);
  return pattern(0.55, 172, 128, [
    track(KICK_HARD, kick), track(SNARE, snare), track(HAT, hat), track(BASS_GALLOP, bass),
    track(STAB, p1), track(STAB, p5), track(LEAD, lead),
  ]);
}

// ------------------------------------------------------------ bgm_menu_01: C major, 124 BPM, 4 bars, bright
function menu01() {
  const roots = ['F2', 'G2', 'E2', 'A2'];
  const bass = onRoots([0, null, null, 0, null, null, 12, null, 0, null, null, 0, null, 7, 12, null], roots);
  const chordThird = [4, 4, 3, 3];
  const arp = roots.flatMap((root, i) => {
    const r = m(root) + 24;
    const t = chordThird[i];
    return [r, r + 7, r + 12, r + t + 12, r + 7, r + 12, r + t + 12, r + 19, r + 12, r + t + 12, r + 19, r + 24, r + 19, r + t + 12, r + 12, r + 7];
  });
  const kick = rep(steps('100 . . . . . . . 100 . . 80 . . . .'), 4);
  const clap = rep(steps('. . . . 90 . . . . . . . 90 . . .'), 4);
  const hat = rep(steps('. . 70 . . . 70 . . . 70 . . . 70 .'), 4);
  const bell = steps(`
    A5 . . . C6 . . . G5 . . . . . E5 .
    D5 . . . G5 . . . B5 . . . A5 . G5 .
    G5 . . . B5 . . . E5 . . . G5 . . .
    A5 . . . . . E5 . C6 . . . B5 . . .`);
  return pattern(0.5, 124, 64, [track(KICK, kick), track(CLAP, clap), track(HAT, hat), track(BASS_SOFT, bass), track(ARP, arp), track(BELL, bell)]);
}

// ------------------------------------------------------------ bgm_summon_01: D minor, 104 BPM, 4 bars, anticipation
function summon01() {
  const roots = ['D3', 'Bb2', 'G2', 'A2'];
  const pad = onRoots([12, null, null, null, null, null, null, null, 12, null, null, null, null, null, null, null], roots);
  const padThird = roots.flatMap((root, i) => {
    const t = i === 3 ? 4 : i === 1 ? 4 : 3;
    const x = m(root) + 12 + t;
    return [x, null, null, null, null, null, null, null, x, null, null, null, null, null, null, null];
  });
  const bass = onRoots([0, null, null, null, null, null, 0, null, null, null, 0, null, null, null, null, null], roots.map((r) => r.replace(/\d/, (d) => String(Number(d) - 1))));
  const sparkle = steps(`
    D6 . A5 . F6 . A5 . D6 . A5 . E6 . A5 .
    D6 . Bb5 . F6 . Bb5 . D6 . Bb5 . F6 . Bb5 .
    D6 . Bb5 . G6 . Bb5 . D6 . Bb5 . G6 . Bb5 .
    C#6 . A5 . E6 . A5 . G6 . E6 . A6 . C#6 .`);
  const heart = rep(steps('100 . . 70 . . . . . . . . . . . .'), 4);
  const shaker = [...rep(steps('. . 40 . . . 40 . . . 40 . . . 40 .'), 3), ...steps('40 50 60 70 50 60 70 80 60 70 80 90 80 90 100 120')];
  return pattern(0.5, 104, 64, [track(KICK, heart), track(SHAKER, shaker), track(BASS_SOFT, bass), track(PAD, pad), track(PAD, padThird), track(SPARK, sparkle)]);
}

// ------------------------------------------------------------ SFX
const sounds = {};
const S = (key, def) => {
  sounds[key] = def;
};

// UI (priority 2: a tap must always answer)
S('sfx_ui_press', sfx(0.55, 2, [v('triangle', 880, 620, 0.06, { decay: 0.06 }), v('sine', 1760, 1500, 0.03, { gain: 0.3 })]));
S('sfx_ui_open', sfx(0.5, 2, [v('sine', 520, 1040, 0.12, { attack: 0.005, decay: 0.12 }), v('triangle', 1040, 1560, 0.1, { start: 0.04, gain: 0.5 })]));
S('sfx_ui_denied', sfx(0.45, 2, [v('square', 220, 190, 0.08, { gain: 0.6, filter: ['lowpass', 1200] }), v('square', 200, 170, 0.09, { start: 0.1, gain: 0.6, filter: ['lowpass', 1200] })]));
S('sfx_ui_advance', sfx(0.4, 2, [v('triangle', 1250, 1000, 0.045, { decay: 0.045 })]));
S('sfx_ui_transition', sfx(0.35, 1, [v('noise', 400, 3200, 0.28, { attack: 0.06, decay: 0.22, gain: 0.7, filter: ['bandpass', 400, 2] })]));
S('sfx_ui_toggle', sfx(0.5, 2, [v('square', 660, 660, 0.03, { gain: 0.35, filter: ['lowpass', 2500] }), v('triangle', 990, 990, 0.05, { start: 0.035 })]));
S('sfx_ui_slider', sfx(0.5, 2, [v('sine', 1000, 1000, 0.06, { decay: 0.06 })]));
S('sfx_denied', sfx(0.5, 2, [v('sawtooth', 160, 110, 0.14, { gain: 0.6, filter: ['lowpass', 900] }), v('noise', null, null, 0.05, { gain: 0.3, filter: ['lowpass', 1500] })]));
S('sfx_tutorial_prompt', sfx(0.45, 2, [v('sine', hz('E5'), null, 0.25, { decay: 0.25 }), v('sine', hz('A5'), null, 0.35, { start: 0.1, decay: 0.35 })]));

// Movement
const whoosh = (from, to, dur, g) => sfx(g, 0, [v('noise', from, to, dur, { attack: dur * 0.3, decay: dur * 0.7, gain: 0.9, filter: ['bandpass', from, 1.4] })]);
S('sfx_swipe_up', whoosh(700, 3200, 0.16, 0.45));
S('sfx_swipe_down', whoosh(3000, 600, 0.16, 0.45));
S('sfx_swipe_left', whoosh(1800, 1100, 0.12, 0.4));
S('sfx_swipe_right', whoosh(1100, 1800, 0.12, 0.4));
S('sfx_slip', sfx(0.55, 1, [v('noise', 4000, 900, 0.14, { attack: 0.01, decay: 0.13, filter: ['bandpass', 4000, 1.5] }), v('sine', 900, 500, 0.08, { gain: 0.25 })]));
S('sfx_perfect_slip', sfx(0.7, 2, [
  v('noise', 5000, 1200, 0.16, { attack: 0.005, decay: 0.15, gain: 0.7, filter: ['bandpass', 5000, 2] }),
  v('sine', hz('G6'), null, 0.4, { start: 0.03, decay: 0.4, gain: 0.5 }),
  v('sine', hz('C7'), null, 0.45, { start: 0.08, decay: 0.45, gain: 0.45 }),
  v('triangle', hz('G7'), null, 0.3, { start: 0.12, decay: 0.3, gain: 0.2 }),
]));
S('sfx_tag', sfx(0.6, 1, [v('noise', 900, 3500, 0.2, { attack: 0.05, decay: 0.15, gain: 0.7, filter: ['bandpass', 900, 1.5] }), v('square', 440, 880, 0.12, { start: 0.08, gain: 0.25, filter: ['lowpass', 2500] })]));

// Battle start
S('sfx_fight', sfx(0.85, 3, [
  v('sine', 110, 40, 0.9, { attack: 0.002, decay: 0.85 }),
  v('noise', null, null, 0.5, { attack: 0.002, decay: 0.45, gain: 0.6, filter: ['lowpass', 3500] }),
  v('sawtooth', hz('A3'), null, 0.6, { attack: 0.01, decay: 0.6, gain: 0.3, filter: ['lowpass', 1800] }),
  v('sawtooth', hz('E4'), null, 0.6, { attack: 0.01, decay: 0.6, gain: 0.25, filter: ['lowpass', 1800] }),
  v('square', hz('A4'), null, 0.5, { attack: 0.01, decay: 0.5, gain: 0.15, filter: ['lowpass', 2500] }),
]));

// Card wind-ups (played on card_played, before the hits)
S('sfx_card_fist', sfx(0.45, 1, [v('noise', 1500, 4500, 0.09, { attack: 0.02, decay: 0.07, gain: 0.8, filter: ['bandpass', 1500, 1.5] })]));
S('sfx_card_bolt', sfx(0.5, 1, [v('sine', 300, 1300, 0.16, { attack: 0.01, decay: 0.15, gain: 0.6 }), v('square', 600, 2600, 0.14, { gain: 0.15, filter: ['lowpass', 4000] })]));
S('sfx_card_signature', sfx(0.6, 2, [
  v('sawtooth', 160, 720, 0.38, { attack: 0.05, decay: 0.33, gain: 0.5, filter: ['lowpass', 2600, 3] }),
  v('noise', 600, 5000, 0.38, { attack: 0.2, decay: 0.18, gain: 0.45, filter: ['bandpass', 600, 1] }),
]));
S('sfx_card_climax', sfx(0.7, 3, [
  v('sawtooth', 90, 900, 0.6, { attack: 0.1, decay: 0.5, gain: 0.5, filter: ['lowpass', 3000, 4] }),
  v('sawtooth', 135, 1350, 0.6, { attack: 0.1, decay: 0.5, gain: 0.35, filter: ['lowpass', 3000, 4] }),
  v('noise', 400, 6000, 0.6, { attack: 0.35, decay: 0.25, gain: 0.5, filter: ['bandpass', 400, 1] }),
]));

// Hits (card sfx keys from cards.json: sfx_hit_fist/bolt/signature/climax)
S('sfx_hit_fist', sfx(0.8, 1, [
  v('sine', 170, 50, 0.13, { attack: 0.001, decay: 0.12 }),
  v('noise', null, null, 0.05, { attack: 0.001, decay: 0.045, gain: 0.7, filter: ['lowpass', 2600] }),
  v('square', 300, 120, 0.03, { attack: 0.001, gain: 0.2, filter: ['lowpass', 1500] }),
]));
S('sfx_hit_bolt', sfx(0.75, 1, [
  v('square', 1100, 180, 0.12, { attack: 0.001, decay: 0.11, gain: 0.35, filter: ['lowpass', 5000] }),
  v('noise', null, null, 0.09, { attack: 0.001, decay: 0.08, gain: 0.7, filter: ['bandpass', 3200, 1] }),
  v('sine', 140, 60, 0.1, { attack: 0.001, decay: 0.1, gain: 0.7 }),
]));
S('sfx_hit_signature', sfx(0.85, 2, [
  v('sine', 130, 38, 0.24, { attack: 0.001, decay: 0.23 }),
  v('noise', null, null, 0.14, { attack: 0.001, decay: 0.13, gain: 0.8, filter: ['lowpass', 3800] }),
  v('sawtooth', 240, 70, 0.12, { attack: 0.001, decay: 0.11, gain: 0.3, filter: ['lowpass', 1800] }),
]));
S('sfx_hit_climax', sfx(0.95, 2, [
  v('sine', 110, 30, 0.42, { attack: 0.001, decay: 0.4 }),
  v('noise', null, null, 0.3, { attack: 0.001, decay: 0.28, gain: 0.85, filter: ['lowpass', 5000] }),
  v('sawtooth', 220, 55, 0.25, { attack: 0.001, decay: 0.24, gain: 0.35, filter: ['lowpass', 2200] }),
  v('square', 70, 35, 0.3, { attack: 0.001, decay: 0.3, gain: 0.2, filter: ['lowpass', 600] }),
]));
S('sfx_hit_immune', sfx(0.5, 1, [v('triangle', 1900, 1700, 0.12, { decay: 0.12, gain: 0.6 }), v('square', 2600, 2400, 0.06, { gain: 0.15, filter: ['bandpass', 2600, 4] })]));
S('sfx_riposte', sfx(0.8, 2, [
  v('triangle', 2400, 1800, 0.18, { decay: 0.18, gain: 0.5 }),
  v('noise', 6000, 2000, 0.08, { gain: 0.6, filter: ['bandpass', 6000, 2] }),
  v('sine', 180, 50, 0.16, { start: 0.04, decay: 0.15 }),
]));
S('sfx_tag_strike', sfx(0.8, 2, [
  v('noise', 800, 4000, 0.12, { attack: 0.03, decay: 0.09, gain: 0.6, filter: ['bandpass', 800, 1.5] }),
  v('sine', 160, 45, 0.2, { start: 0.1, attack: 0.001, decay: 0.19 }),
  v('noise', null, null, 0.08, { start: 0.1, gain: 0.6, filter: ['lowpass', 3000] }),
]));
S('sfx_knockdown', sfx(0.8, 2, [
  v('sine', 90, 30, 0.45, { attack: 0.001, decay: 0.43 }),
  v('noise', null, null, 0.3, { attack: 0.002, decay: 0.28, gain: 0.6, filter: ['lowpass', 900] }),
  v('sine', 70, 35, 0.2, { start: 0.18, decay: 0.2, gain: 0.5 }),
]));
S('sfx_combo_up', sfx(0.6, 2, [
  v('square', hz('E5'), hz('E6'), 0.12, { gain: 0.25, filter: ['lowpass', 4000] }),
  v('triangle', hz('B5'), null, 0.16, { start: 0.06, gain: 0.4 }),
  v('triangle', hz('E6'), null, 0.2, { start: 0.11, gain: 0.4 }),
]));
S('sfx_ko', sfx(1.0, 3, [
  v('sine', 95, 25, 1.0, { attack: 0.002, decay: 0.95 }),
  v('noise', 5000, 200, 0.8, { attack: 0.002, decay: 0.75, gain: 0.8, filter: ['lowpass', 5000] }),
  v('sawtooth', hz('E3'), hz('E2'), 0.8, { attack: 0.005, decay: 0.8, gain: 0.3, filter: ['lowpass', 1500] }),
  v('square', hz('B2'), hz('B1'), 0.8, { attack: 0.005, decay: 0.8, gain: 0.15, filter: ['lowpass', 900] }),
]));

// Big moments (priority 3; BGM ducks under them)
S('sfx_ignition', sfx(1.0, 3, [
  // 0.9 s power-up riser, then the burst at 0.9 s; fits the 1.5 s Ignition cinematic
  v('sawtooth', 110, 880, 0.95, { attack: 0.75, decay: 0.2, gain: 0.45, filter: ['lowpass', 3500, 6] }),
  v('sawtooth', 165, 1320, 0.95, { attack: 0.75, decay: 0.2, gain: 0.3, filter: ['lowpass', 3500, 6] }),
  v('noise', 300, 8000, 0.95, { attack: 0.8, decay: 0.15, gain: 0.5, filter: ['bandpass', 300, 1] }),
  v('sine', 60, 30, 0.6, { start: 0.9, attack: 0.002, decay: 0.58 }),
  v('noise', null, null, 0.5, { start: 0.9, attack: 0.002, decay: 0.48, gain: 0.7, filter: ['lowpass', 6000] }),
  v('sine', hz('A6'), null, 0.5, { start: 0.95, decay: 0.5, gain: 0.25 }),
  v('sine', hz('E7'), null, 0.5, { start: 1.0, decay: 0.5, gain: 0.2 }),
]));
S('sfx_tri_burst_start', sfx(0.9, 3, [
  v('sawtooth', hz('A2'), hz('A4'), 1.0, { attack: 0.7, decay: 0.3, gain: 0.35, filter: ['lowpass', 3000, 5] }),
  v('sawtooth', hz('E3'), hz('E5'), 1.0, { attack: 0.7, decay: 0.3, gain: 0.25, filter: ['lowpass', 3000, 5] }),
  v('noise', 400, 7000, 1.0, { attack: 0.8, decay: 0.2, gain: 0.5, filter: ['bandpass', 400, 1] }),
  v('square', hz('A4'), null, 0.12, { start: 0.0, gain: 0.2, filter: ['lowpass', 3000] }),
  v('square', hz('C#5'), null, 0.12, { start: 0.15, gain: 0.2, filter: ['lowpass', 3000] }),
  v('square', hz('E5'), null, 0.12, { start: 0.3, gain: 0.2, filter: ['lowpass', 3000] }),
]));
S('sfx_tri_burst_impact', sfx(1.0, 3, [
  v('sine', 80, 22, 1.4, { attack: 0.001, decay: 1.35 }),
  v('noise', null, null, 1.0, { attack: 0.001, decay: 0.95, gain: 0.9, filter: ['lowpass', 7000] }),
  v('sawtooth', 200, 40, 0.8, { attack: 0.001, decay: 0.75, gain: 0.35, filter: ['lowpass', 2000] }),
  v('square', 55, 28, 1.0, { attack: 0.001, decay: 1.0, gain: 0.2, filter: ['lowpass', 500] }),
  v('sine', hz('A6'), null, 0.8, { start: 0.05, decay: 0.8, gain: 0.2 }),
]));
S('sfx_climax', sfx(0.95, 3, [
  v('sawtooth', hz('D3'), null, 0.7, { attack: 0.005, decay: 0.7, gain: 0.35, filter: ['lowpass', 2400, 2] }),
  v('sawtooth', hz('A3'), null, 0.7, { attack: 0.005, decay: 0.7, gain: 0.3, filter: ['lowpass', 2400, 2] }),
  v('square', hz('D4'), null, 0.6, { attack: 0.005, decay: 0.6, gain: 0.15, filter: ['lowpass', 3000] }),
  v('sine', 70, 30, 0.6, { attack: 0.001, decay: 0.58 }),
  v('noise', 8000, 500, 0.6, { attack: 0.002, decay: 0.58, gain: 0.5, filter: ['bandpass', 8000, 1] }),
]));

// Summon
S('sfx_summon_confirm', sfx(0.7, 2, [
  v('sine', 300, 1200, 0.5, { attack: 0.05, decay: 0.45, gain: 0.5 }),
  v('noise', 800, 6000, 0.5, { attack: 0.3, decay: 0.2, gain: 0.4, filter: ['bandpass', 800, 2] }),
  v('triangle', hz('D6'), null, 0.3, { start: 0.4, gain: 0.35 }),
]));
const orb = (notes, g, extra) => sfx(g, 2, [
  ...notes.map((n, i) => v('sine', hz(n), null, 0.5, { start: i * 0.07, decay: 0.5, gain: 0.45 })),
  ...(extra || []),
]);
S('sfx_summon_orb_3', orb(['A5', 'E6'], 0.55));
S('sfx_summon_orb_4', orb(['A5', 'C#6', 'E6'], 0.65, [v('triangle', hz('A6'), null, 0.4, { start: 0.2, gain: 0.25 })]));
S('sfx_summon_orb_5', orb(['A5', 'C#6', 'E6', 'A6'], 0.8, [
  v('sine', 70, 35, 0.6, { attack: 0.002, decay: 0.58, gain: 0.8 }),
  v('noise', 2000, 9000, 0.5, { attack: 0.05, decay: 0.45, gain: 0.3, filter: ['bandpass', 2000, 2] }),
]));
S('sfx_summon_reveal_3', sfx(0.6, 2, [
  v('triangle', hz('E5'), null, 0.3, { gain: 0.5 }),
  v('triangle', hz('A5'), null, 0.4, { start: 0.08, gain: 0.5 }),
  v('noise', null, null, 0.12, { gain: 0.3, filter: ['highpass', 5000] }),
]));
S('sfx_summon_reveal_4', sfx(0.75, 2, [
  v('square', hz('A4'), null, 0.15, { gain: 0.2, filter: ['lowpass', 3000] }),
  v('square', hz('C#5'), null, 0.15, { start: 0.08, gain: 0.2, filter: ['lowpass', 3000] }),
  v('square', hz('E5'), null, 0.15, { start: 0.16, gain: 0.2, filter: ['lowpass', 3000] }),
  v('sawtooth', hz('A5'), null, 0.6, { start: 0.24, decay: 0.6, gain: 0.3, filter: ['lowpass', 3500] }),
  v('sine', hz('E6'), null, 0.6, { start: 0.24, decay: 0.6, gain: 0.3 }),
  v('noise', null, null, 0.3, { start: 0.24, gain: 0.3, filter: ['highpass', 4000] }),
]));
S('sfx_summon_reveal_5', sfx(1.0, 3, [
  v('sine', 65, 28, 1.0, { attack: 0.001, decay: 0.95 }),
  v('noise', null, null, 0.7, { attack: 0.001, decay: 0.65, gain: 0.6, filter: ['lowpass', 7000] }),
  v('sawtooth', hz('D4'), null, 1.2, { start: 0.05, attack: 0.01, decay: 1.2, gain: 0.3, filter: ['lowpass', 3000] }),
  v('sawtooth', hz('F#4'), null, 1.2, { start: 0.05, attack: 0.01, decay: 1.2, gain: 0.25, filter: ['lowpass', 3000] }),
  v('sawtooth', hz('A4'), null, 1.2, { start: 0.05, attack: 0.01, decay: 1.2, gain: 0.25, filter: ['lowpass', 3000] }),
  v('square', hz('D5'), null, 1.0, { start: 0.05, decay: 1.0, gain: 0.15, filter: ['lowpass', 4000] }),
  v('sine', hz('A6'), null, 0.8, { start: 0.25, decay: 0.8, gain: 0.25 }),
  v('sine', hz('D7'), null, 0.8, { start: 0.35, decay: 0.8, gain: 0.2 }),
]));
S('sfx_summon_results', sfx(0.55, 2, [v('triangle', hz('D5'), null, 0.25, { gain: 0.5 }), v('triangle', hz('A5'), null, 0.35, { start: 0.1, gain: 0.5 })]));

// Result stingers (the menu track starts after these, §18.3)
S('sfx_result_win', sfx(0.85, 3, [
  v('square', hz('C5'), null, 0.14, { gain: 0.25, filter: ['lowpass', 3500] }),
  v('square', hz('E5'), null, 0.14, { start: 0.14, gain: 0.25, filter: ['lowpass', 3500] }),
  v('square', hz('G5'), null, 0.14, { start: 0.28, gain: 0.25, filter: ['lowpass', 3500] }),
  v('sawtooth', hz('C6'), null, 1.0, { start: 0.42, decay: 1.0, gain: 0.3, filter: ['lowpass', 3500] }),
  v('sawtooth', hz('G5'), null, 1.0, { start: 0.42, decay: 1.0, gain: 0.25, filter: ['lowpass', 3000] }),
  v('sine', hz('C3'), null, 1.0, { start: 0.42, decay: 1.0, gain: 0.6 }),
  v('noise', null, null, 0.4, { start: 0.42, gain: 0.3, filter: ['highpass', 4000] }),
]));
S('sfx_result_lose', sfx(0.7, 3, [
  v('sawtooth', hz('E4'), null, 0.35, { gain: 0.3, filter: ['lowpass', 1800] }),
  v('sawtooth', hz('D4'), null, 0.35, { start: 0.35, gain: 0.3, filter: ['lowpass', 1600] }),
  v('sawtooth', hz('C4'), hz('B3'), 0.8, { start: 0.7, decay: 0.8, gain: 0.3, filter: ['lowpass', 1400] }),
  v('sine', hz('A2'), null, 0.8, { start: 0.7, decay: 0.8, gain: 0.5 }),
]));
S('sfx_result_draw', sfx(0.7, 3, [
  v('triangle', hz('D5'), null, 0.3, { gain: 0.45 }),
  v('triangle', hz('A4'), null, 0.3, { start: 0.25, gain: 0.45 }),
  v('triangle', hz('D5'), null, 0.8, { start: 0.5, decay: 0.8, gain: 0.45 }),
  v('triangle', hz('G5'), null, 0.8, { start: 0.5, decay: 0.8, gain: 0.35 }),
]));

// Music tracks
S('bgm_menu_01', menu01());
S('bgm_summon_01', summon01());
S('bgm_battle_01', battle01());
S('bgm_battle_02', battle02());
S('bgm_boss_01', boss01());

// ------------------------------------------------------------ hooks (GDD §18.2: 39 round-3 + 7 round-4)
const hooks = {
  ui_press: 'sfx_ui_press', ui_open: 'sfx_ui_open', ui_denied: 'sfx_ui_denied', ui_advance: 'sfx_ui_advance',
  ui_transition: 'sfx_ui_transition', denied: 'sfx_denied',
  swipe_up: 'sfx_swipe_up', swipe_down: 'sfx_swipe_down', swipe_left: 'sfx_swipe_left', swipe_right: 'sfx_swipe_right',
  fight: 'sfx_fight',
  card_fist: 'sfx_card_fist', card_bolt: 'sfx_card_bolt', card_signature: 'sfx_card_signature', card_climax: 'sfx_card_climax',
  hit_fist: 'sfx_hit_fist', hit_bolt: 'sfx_hit_bolt', hit_signature: 'sfx_hit_signature', hit_climax: 'sfx_hit_climax',
  hit_immune: 'sfx_hit_immune', slip: 'sfx_slip', perfect_slip: 'sfx_perfect_slip', tag: 'sfx_tag', ko: 'sfx_ko',
  ignition: 'sfx_ignition', tri_burst_start: 'sfx_tri_burst_start', climax: 'sfx_climax',
  tutorial_prompt: 'sfx_tutorial_prompt', summon_confirm: 'sfx_summon_confirm',
  summon_orb_3: 'sfx_summon_orb_3', summon_orb_4: 'sfx_summon_orb_4', summon_orb_5: 'sfx_summon_orb_5',
  summon_reveal_3: 'sfx_summon_reveal_3', summon_reveal_4: 'sfx_summon_reveal_4', summon_reveal_5: 'sfx_summon_reveal_5',
  summon_results: 'sfx_summon_results', result_win: 'sfx_result_win', result_lose: 'sfx_result_lose', result_draw: 'sfx_result_draw',
  riposte: 'sfx_riposte', tag_strike: 'sfx_tag_strike', knockdown: 'sfx_knockdown', combo_up: 'sfx_combo_up',
  tri_burst_impact: 'sfx_tri_burst_impact', ui_toggle: 'sfx_ui_toggle', ui_slider: 'sfx_ui_slider',
};

const audio = {
  version: 1,
  mix: { max_voices: 12, same_sound_min_interval_ms: 40, duck_gain: 0.35, duck_attack_s: 0.08, duck_release_s: 0.3, pause_gain: 0.5, crossfade_s: 0.6, music_fade_in_s: 0.5 },
  music: { menu: 'bgm_menu_01', summon: 'bgm_summon_01', battle_default: 'bgm_battle_01' },
  sounds,
  hooks,
};

// one line per notes array keeps the file readable
const text = JSON.stringify(audio, null, 2).replace(/"notes": \[([^\]]*)\]/g, (_, body) => '"notes": [' + body.split(',').map((x) => x.trim()).join(', ') + ']');
fs.writeFileSync(OUT, text + '\n');
console.log(`wrote ${path.relative(ROOT, OUT)}: ${Object.keys(sounds).length} sounds, ${Object.keys(hooks).length} hooks, ${fs.statSync(OUT).size} bytes`);
