// ui-developer round 4: audio/VFX wiring (GDD §17, §18), settings helpers (§19), save-repair notice. Data-number-free.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson } from '../helpers/load-data.js';
import { SFX_HOOKS } from '../../src/ui/feedback.js';
import { snapVolume, stepVolume, percent, previewsOnChange, VOLUME_KEYS } from '../../src/ui/settings-view.js';
import { repairNoticeFor } from '../../src/ui/game-data.js';
import { SAVE_REPAIR_WARNING_CODES } from '../../src/logic/index.js';
import { hasString } from '../../src/ui/strings.js';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const uiSources = () => {
  const out = [];
  for (const dir of ['src/scenes', 'src/ui']) for (const f of fs.readdirSync(path.join(ROOT, dir))) if (f.endsWith('.js')) out.push([dir + '/' + f, read(dir + '/' + f)]);
  return out;
};

// Dynamic hooks: prefix → the values the suffix can take (from data / logic, never typed numbers)
const cardSchema = JSON.stringify(readJson('data/schemas/cards.schema.json'));
const CARD_TYPES = cardSchema.match(/"enum":\["fist"[^\]]*\]/)[0].match(/"([a-z_]+)"/g).slice(1).map((s) => s.slice(1, -1));
const RARITIES = [...new Set(readJson('data/characters.json').characters.map((c) => c.rarity))];
const DYNAMIC = {
  card_: CARD_TYPES, hit_: CARD_TYPES, swipe_: ['up', 'down', 'left', 'right'],
  summon_orb_: RARITIES.filter((r) => r >= 3), summon_reveal_: RARITIES.filter((r) => r >= 3), result_: ['win', 'lose', 'draw'],
};

/** Hooks used in source: literal sfx('x') and dynamic sfx('prefix_' + …). Returns { missing, unknownPrefixes }. */
export function hookProblems(sources, hooks) {
  const set = new Set(hooks);
  const missing = [];
  const unknownPrefixes = [];
  for (const [file, src] of sources) {
    for (const m of src.matchAll(/\bsfx\(\s*'([a-z0-9_]+)'\s*([,)])/g)) if (!set.has(m[1])) missing.push(file + ': ' + m[1]);
    for (const m of src.matchAll(/\bsfx\(\s*'([a-z0-9_]+)'\s*\+/g)) {
      const vals = DYNAMIC[m[1]];
      if (!vals) unknownPrefixes.push(file + ': ' + m[1]);
      else for (const v of vals) if (!set.has(m[1] + v)) missing.push(file + ': ' + m[1] + v);
    }
  }
  return { missing, unknownPrefixes };
}

describe('SFX_HOOKS (GDD §18.2, AC-18.1)', () => {
  it('is the literal list of 46 hooks and matches audio.json → hooks exactly', () => {
    expect(SFX_HOOKS.length).toBe(46);
    expect(new Set(SFX_HOOKS).size).toBe(46);
    expect([...SFX_HOOKS].sort()).toEqual(Object.keys(readJson('data/audio.json').hooks).sort());
  });
  it('every sfx() hook the UI emits (literal or prefix + enum) is in SFX_HOOKS', () => {
    const r = hookProblems(uiSources(), SFX_HOOKS);
    expect(r).toEqual({ missing: [], unknownPrefixes: [] });
  });
  it('the 7 round-4 hooks are really emitted somewhere in src/scenes or src/ui', () => {
    const all = uiSources().map((x) => x[1]).join('\n');
    for (const h of ['riposte', 'tag_strike', 'knockdown', 'combo_up', 'tri_burst_impact', 'ui_toggle', 'ui_slider']) expect(all, h).toContain(`sfx('${h}'`);
  });
  it('must-FAIL: an unlisted hook and an unknown prefix are reported', () => {
    const r = hookProblems([['fake.js', "sfx('new_hook'); sfx('boom_' + x); sfx('hit_' + t);"]], SFX_HOOKS);
    expect(r.missing).toEqual(['fake.js: new_hook']);
    expect(r.unknownPrefixes).toEqual(['fake.js: boom_']);
  });
  it('hit sounds pass the card sfx override (GDD §18.2)', () => {
    expect(read('src/scenes/BattleScene.js')).toMatch(/sfx\('hit_' \+ e\.cardType, \{ soundKey: card && card\.sfx/);
  });
});

/** R3 direct effects the VFX layer now owns (task: nothing plays twice). */
export function doubleEffects(files) {
  const bad = [];
  const rules = [
    ['src/scenes/BattleScene.js', /cameras\.main\.(shake|flash)\(/],
    ['src/scenes/BattleScene.js', /\.hitFlash\(\)/],
    ['src/scenes/BattleScene.js', /this\.impact\(/],
    ['src/scenes/SummonRevealScene.js', /cameras\.main\.(shake|flash)\(/],
    ['src/scenes/SummonRevealScene.js', /fillRect\(0, 0, W, H\)/],
    ['src/ui/fighter-view.js', /fillEllipse\(0, -60, 90, 140\)/],
  ];
  for (const [f, re] of rules) if (re.test(files[f])) bad.push(f + ' ' + re);
  return bad;
}

describe('VFX / audio wiring (GDD §17.1, §18.3)', () => {
  const files = {};
  for (const f of ['src/scenes/BattleScene.js', 'src/scenes/SummonRevealScene.js', 'src/ui/fighter-view.js', 'src/scenes/ResultScene.js']) files[f] = read(f);
  it('no R3 direct shake/flash/impact/glow left where the VFX layer draws them', () => {
    expect(doubleEffects(files)).toEqual([]);
  });
  it('must-FAIL: putting back a camera shake is caught', () => {
    const broken = Object.assign({}, files, { 'src/scenes/BattleScene.js': files['src/scenes/BattleScene.js'] + '\nthis.cameras.main.shake(250, 0.01);' });
    expect(doubleEffects(broken)).toHaveLength(1);
  });
  it('BattleScene feeds every step to the VFX layer and audio, and adopts the cinematic decor', () => {
    const s = files['src/scenes/BattleScene.js'];
    expect(s).toContain('this.vfx.onBattleEvents(events, this.battle.getState())');
    expect(s).toContain('onBattleEvent(e)');
    expect(s).toContain('this.cinematic.addAt(this.vfx.cinematicDecor, 1)');
    expect(s).toContain('endBattleMusic()');
    expect(s).toContain('resetDuck()');
    expect(s).toMatch(/setMusicContext\('battle', this\.stage\.bgm\)/);
  });
  it('ResultScene never sets the menu music (the result stinger starts it)', () => {
    expect(files['src/scenes/ResultScene.js']).not.toMatch(/setMusicContext\(/);
    expect(files['src/scenes/ResultScene.js']).toMatch(/musicContext\(\) \{\s*return null;/);
  });
});

describe('Settings helpers (GDD §19)', () => {
  it('steps of 0.1, clamped and stored with 1 decimal; Music − ×3 from 100% → 70%', () => {
    let v = 1;
    for (let i = 0; i < 3; i++) v = stepVolume(v, -1);
    expect(v).toBe(0.7);
    expect(percent(v)).toBe(70);
    expect(stepVolume(0, -1)).toBe(0);
    expect(stepVolume(1, +1)).toBe(1);
    expect(snapVolume(0.45)).toBe(0.5);
    expect(snapVolume(2)).toBe(1);
    expect(snapVolume(0.30000000000000004)).toBe(0.3);
  });
  it('previews: Master and Sound effects only', () => {
    expect(VOLUME_KEYS.filter(previewsOnChange)).toEqual(['master_volume', 'sfx_volume']);
  });
  it('every settings_* label key exists', () => {
    for (const k of [...VOLUME_KEYS, 'muted', 'reduce_motion', 'haptics']) expect(hasString('settings_' + k), k).toBe(true);
  });
});

describe('Save-repair notice on Home (task 5)', () => {
  it('every exported repair code except settings_repaired shows the notice', () => {
    expect(SAVE_REPAIR_WARNING_CODES).toContain('settings_repaired');
    expect(SAVE_REPAIR_WARNING_CODES.filter((c) => !repairNoticeFor(c))).toEqual(['settings_repaired']);
  });
});
