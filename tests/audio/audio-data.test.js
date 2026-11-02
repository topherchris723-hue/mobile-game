// audio-designer (round 4): live data/audio.json checks — GDD §18.2 hook coverage (AC-18.1), §15.3 rule 13
// licensing + pattern + reference checks (AC-18.6), stage/card key coverage (rule 15), and the "audio never touches
// logic" import rule (§18.1 rule 1). Every check is also run on a broken input and must FAIL (L-shared-006).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { ROOT, readJson } from '../helpers/load-data.js';
import { checkAudioData, parseCreditsRows } from '../../src/audio/validate.js';

const audio = () => readJson('data/audio.json');
const credits = () => fs.readFileSync(path.join(ROOT, 'assets/CREDITS.md'), 'utf8');
const fileExists = (p) => fs.existsSync(path.join(ROOT, p));

/** The hook list read fresh from GDD §18.2 (single source until the UI exports SFX_HOOKS). */
export function gddHooks() {
  const gdd = fs.readFileSync(path.join(ROOT, 'docs/GDD.md'), 'utf8');
  const a = gdd.indexOf('Hooks emitted today');
  const b = gdd.indexOf('- **Per-card override', a);
  if (a < 0 || b < 0) throw new Error('GDD §18.2 hook list not found');
  const names = [...gdd.slice(a, b).matchAll(/`([^`]+)`/g)].map((x) => x[1]).filter((s) => /^[a-z][a-z0-9_]*$/.test(s));
  return [...new Set(names)];
}

const NEW_R4_HOOKS = ['riposte', 'tag_strike', 'knockdown', 'combo_up', 'tri_burst_impact', 'ui_toggle', 'ui_slider'];

describe('GDD §18.2 hook list parse', () => {
  it('finds the 39 round-3 hooks + 7 round-4 hooks', () => {
    const h = gddHooks();
    expect(h.length).toBe(46);
    for (const n of NEW_R4_HOOKS) expect(h).toContain(n);
  });
});

describe('AC-18.1 every hook is mapped and every mapped key exists', () => {
  it('live audio.json maps all 46 GDD hooks; no errors', () => {
    const r = checkAudioData(audio(), { credits: credits(), fileExists, hooks: gddHooks() });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
  it('must-FAIL: hooks.ko removed', () => {
    const a = audio();
    delete a.hooks.ko;
    const r = checkAudioData(a, { credits: credits(), fileExists, hooks: gddHooks() });
    expect(r.errors).toEqual(['AC-18.1: hook "ko" has no entry in audio.json hooks']);
  });
  it('must-FAIL: a hook value that is not in sounds', () => {
    const a = audio();
    a.hooks.ko = 'sfx_missing_boom';
    const r = checkAudioData(a, { credits: credits(), fileExists, hooks: gddHooks() });
    expect(r.errors).toEqual(['rule 13: hooks.ko: "sfx_missing_boom" not in sounds']);
  });
  it('null = silent on purpose is allowed; an unknown hook key is a warning (rule 15)', () => {
    const a = audio();
    a.hooks.ui_advance = null;
    a.hooks.old_hook = 'sfx_ui_press';
    const r = checkAudioData(a, { credits: credits(), fileExists, hooks: gddHooks() });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(['rule 15: hooks.old_hook is not an exported SFX hook']);
  });
  it('SFX_HOOKS exported by src/ui/feedback.js (when present) are all mapped', async () => {
    let exported = null;
    try {
      exported = (await import('../../src/ui/feedback.js')).SFX_HOOKS;
    } catch (e) {
      exported = null;
    }
    if (!Array.isArray(exported)) {
      // ui-developer exports SFX_HOOKS in wave 2; until then the GDD list above is the contract.
      expect(exported === undefined || exported === null).toBe(true);
      return;
    }
    const r = checkAudioData(audio(), { credits: credits(), fileExists, hooks: exported });
    expect(r.errors).toEqual([]);
  });
});

describe('schema', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(readJson('data/schemas/audio.schema.json'));
  it('live audio.json passes audio.schema.json', () => {
    expect(validate(audio()) ? [] : validate.errors).toEqual([]);
  });
  it('must-FAIL: missing mix.max_voices, a CC-BY file sound, a procedural sound without synth', () => {
    const a = audio();
    delete a.mix.max_voices;
    expect(validate(a)).toBe(false);
    const b = audio();
    b.sounds.sfx_x = { source: 'file', gain: 1, path: 'assets/audio/x.ogg', license: 'CC-BY', credit: 'x' };
    expect(validate(b)).toBe(false);
    const c = audio();
    c.sounds.sfx_y = { source: 'procedural', gain: 1 };
    expect(validate(c)).toBe(false);
  });
});

describe('AC-18.6 §15.3 rule 13 (audio): licensing, pattern length, references', () => {
  const ctx = (extra) => Object.assign({ credits: credits(), fileExists }, extra || {});
  it('default audio.json + CREDITS.md PASS; CREDITS has the data/audio.json self-made row', () => {
    expect(checkAudioData(audio(), ctx()).errors).toEqual([]);
    expect(parseCreditsRows(credits())).toContainEqual({ file: 'data/audio.json', license: 'self-made' });
  });
  it('the live set is all-procedural (no audio files shipped)', () => {
    for (const [k, s] of Object.entries(audio().sounds)) expect([k, s.source]).toEqual([k, 'procedural']);
  });
  it('must-FAIL: a file sound with license CC-BY', () => {
    const a = audio();
    a.sounds.sfx_file = { source: 'file', gain: 1, path: 'assets/audio/hit.ogg', license: 'CC-BY', credit: 'x' };
    const md = credits().replace('| data/audio.json |', '| assets/audio/hit.ogg | Audio | x | CC-BY | Yes | 4 |\n| data/audio.json |');
    const e = checkAudioData(a, ctx({ credits: md, fileExists: () => true })).errors;
    expect(e).toEqual(['rule 13: sounds.sfx_file: license "CC-BY" not allowed (CC0 or self-made only)']);
  });
  it('must-FAIL: a file sound whose path has no CREDITS.md row', () => {
    const a = audio();
    a.sounds.sfx_file = { source: 'file', gain: 1, path: 'assets/audio/hit.ogg', license: 'CC0', credit: 'x' };
    const e = checkAudioData(a, ctx({ fileExists: () => true })).errors;
    expect(e).toEqual(['rule 13: sounds.sfx_file: no CREDITS.md row for "assets/audio/hit.ogg"']);
  });
  it('must-FAIL: a file sound whose file is missing on disk', () => {
    const a = audio();
    a.sounds.sfx_file = { source: 'file', gain: 1, path: 'assets/audio/nope.ogg', license: 'CC0', credit: 'x' };
    const md = credits().replace('| data/audio.json |', '| assets/audio/nope.ogg | Audio | x | CC0 | Yes | 4 |\n| data/audio.json |');
    expect(checkAudioData(a, ctx({ credits: md })).errors).toEqual(['rule 13: sounds.sfx_file: file "assets/audio/nope.ogg" does not exist']);
  });
  it('must-FAIL: procedural sounds with no data/audio.json row in CREDITS.md', () => {
    const md = credits().split('\n').filter((l) => !l.startsWith('| data/audio.json')).join('\n');
    expect(checkAudioData(audio(), ctx({ credits: md })).errors).toEqual([
      'rule 13: procedural sounds but no CREDITS.md row with File "data/audio.json" and License "self-made"',
    ]);
  });
  it('must-FAIL: the data/audio.json row with license "team-made" instead of "self-made"', () => {
    const md = credits().replace(/(\| data\/audio\.json \|[^\n]*\| )self-made( \|)/, '$1team-made$2');
    expect(md).not.toBe(credits());
    expect(checkAudioData(audio(), ctx({ credits: md })).errors.length).toBe(1);
  });
  it('must-FAIL: a pattern with steps 16 and 15 notes', () => {
    const a = audio();
    a.sounds.bgm_test = { source: 'procedural', gain: 0.5, loop: true, pattern: { tempo_bpm: 120, steps_per_beat: 4, steps: 16, tracks: [{ voice: { wave: 'sine', duration_s: 0.1 }, notes: Array(15).fill(60) }] } };
    expect(checkAudioData(a, ctx()).errors).toEqual(['rule 13: sounds.bgm_test.pattern.tracks[0]: 15 notes, steps is 16']);
  });
  it('must-FAIL: a music context naming a key not in sounds', () => {
    const a = audio();
    a.music.summon = 'bgm_nope';
    expect(checkAudioData(a, ctx()).errors).toEqual(['rule 13: music.summon: "bgm_nope" not in sounds']);
  });
});

describe('rule 15 key coverage: stage bgm and card sfx keys exist', () => {
  const extra = { stages: readJson('data/stages.json'), cards: readJson('data/cards.json'), story: readJson('data/story.json') };
  it('live data: no fallback warnings (bgm_battle_01/02, bgm_boss_01, sfx_hit_*)', () => {
    const r = checkAudioData(audio(), Object.assign({ credits: credits(), fileExists }, extra));
    expect(r.warnings).toEqual([]);
    const s = audio().sounds;
    for (const k of ['bgm_battle_01', 'bgm_battle_02', 'bgm_boss_01', 'bgm_menu_01', 'bgm_summon_01']) expect(s[k] && !!s[k].pattern).toBe(true);
  });
  it('must-WARN: bgm_boss_01 removed', () => {
    const a = audio();
    delete a.sounds.bgm_boss_01;
    const r = checkAudioData(a, Object.assign({ credits: credits(), fileExists }, extra));
    expect(r.warnings.length).toBe(1);
    expect(r.warnings[0]).toMatch(/bgm "bgm_boss_01" not in sounds/);
  });
});

describe('music loops and sound budgets', () => {
  it('every pattern track has notes.length === steps, notes 0..127, loops at ≥ 6 s', () => {
    for (const [k, s] of Object.entries(audio().sounds)) {
      if (!s.pattern) continue;
      expect(s.loop).toBe(true);
      const loopS = (s.pattern.steps * 60) / (s.pattern.tempo_bpm * s.pattern.steps_per_beat);
      expect(loopS, k).toBeGreaterThanOrEqual(6);
      for (const t of s.pattern.tracks) {
        expect(t.notes.length, k).toBe(s.pattern.steps);
        for (const n of t.notes) if (n !== null) expect(n >= 0 && n <= 127 && Number.isInteger(n), k).toBe(true);
      }
    }
  });
  it('battle tracks are fast (≥ 140 BPM), the boss track is the fastest', () => {
    const s = audio().sounds;
    expect(s.bgm_battle_01.pattern.tempo_bpm).toBeGreaterThanOrEqual(140);
    expect(s.bgm_battle_02.pattern.tempo_bpm).toBeGreaterThanOrEqual(140);
    expect(s.bgm_boss_01.pattern.tempo_bpm).toBeGreaterThan(Math.max(s.bgm_battle_01.pattern.tempo_bpm, s.bgm_battle_02.pattern.tempo_bpm));
  });
  it('every one-shot sound is ≤ 1.5 s (the Ignition cinematic); big moments have priority 3', () => {
    const a = audio();
    for (const [k, s] of Object.entries(a.sounds)) {
      if (!s.synth) continue;
      const len = Math.max(...s.synth.voices.map((v) => (v.start_s || 0) + v.duration_s));
      expect(len, k).toBeLessThanOrEqual(1.5);
    }
    for (const h of ['ignition', 'tri_burst_impact', 'climax', 'ko', 'fight', 'summon_reveal_5']) expect(a.sounds[a.hooks[h]].priority, h).toBe(3);
  });
});

describe('§18.1 rule 1: audio never changes logic', () => {
  it('src/audio imports nothing outside src/audio (no logic, no UI)', () => {
    const dir = path.join(ROOT, 'src/audio');
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.js')) continue;
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const mm of src.matchAll(/from\s+'([^']+)'/g)) expect([f, mm[1]]).toEqual([f, expect.stringMatching(/^\.\/[a-z-]+\.js$/)]);
    }
  });
});
