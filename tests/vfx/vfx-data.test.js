// GDD §17 data checks on the live data/vfx.json: AC-17.1 key coverage, R3 baseline values, §15.3 rule 14 (AC-17.9),
// per-card / per-character keys, generated textures. P-class: reads live data.
import { describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import { VFX_EVENT_KEYS } from '../../src/vfx/events.js';
import { checkVfxCoverage } from '../../src/vfx/coverage.js';
import { FRAMES, GENERATED_TEXTURES, frameOf } from '../../src/vfx/particles.js';
import { layoutAtlas, ATLAS_SIZE } from '../../src/vfx/atlas.js';
import { parseBannedTerms, validateDataset } from '../../scripts/lib/data-validator.js';
import { loadAllData, loadAllSchemas, loadGdd, readJson } from '../helpers/load-data.js';
import { loadVfx } from './vfx-helpers.js';

const vfx = loadVfx();
const clone = (o) => JSON.parse(JSON.stringify(o));

describe('AC-17.1 key coverage (live data)', () => {
  it('every VFX_EVENT_KEYS key has an events entry and every named effect exists', () => {
    expect(checkVfxCoverage(vfx)).toEqual([]);
  });
  it('must-FAIL: deleting events["ignition"] is reported', () => {
    const bad = clone(vfx);
    delete bad.events.ignition;
    expect(checkVfxCoverage(bad)).toContain('events["ignition"] missing');
  });
  it('must-FAIL: an events entry naming an unknown effect, and a bad reduce_motion id, are reported', () => {
    const bad = clone(vfx);
    bad.events['hit.fist'] = ['no_such_effect'];
    bad.effects.r3_summon_flash_5.reduce_motion = 'missing_rm';
    const errs = checkVfxCoverage(bad);
    expect(errs.some((e) => e.indexOf('no_such_effect') >= 0)).toBe(true);
    expect(errs.some((e) => e.indexOf('missing_rm') >= 0)).toBe(true);
  });
  it('VFX_EVENT_KEYS has no duplicates and every events key is a known key', () => {
    expect(new Set(VFX_EVENT_KEYS).size).toBe(VFX_EVENT_KEYS.length);
    for (const k of Object.keys(vfx.events)) expect(VFX_EVENT_KEYS).toContain(k);
  });
});

describe('schema (data/schemas/vfx.schema.json)', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(readJson('data/schemas/vfx.schema.json'));
  it('live vfx.json passes', () => {
    expect(validate(vfx), JSON.stringify(validate.errors)).toBe(true);
  });
  it('must-FAIL: missing limits, shake 0.02, flash alpha 0.95, 4 flashes/s limit, bad layer kind', () => {
    const cases = [
      (d) => delete d.limits,
      (d) => { d.effects.r3_shake_ko.layers[0].intensity = 0.02; },
      (d) => { d.effects.r3_cinematic_flash.layers[0].alpha = 0.95; },
      (d) => { d.limits.max_screen_flashes_per_s = 4; },
      (d) => { d.effects.r3_hit_flash.layers[0].kind = 'strobe'; },
    ];
    for (const mut of cases) {
      const d = clone(vfx);
      mut(d);
      expect(validate(d)).toBe(false);
    }
  });
});

describe('§17.2 defaults: limits, colours and the R3 baseline values are exact', () => {
  it('limits and colours', () => {
    expect(vfx.limits).toEqual({
      max_screen_flashes_per_s: 3, max_flash_alpha: 0.9, sprite_flash_min_interval_ms: 334, max_shake_intensity: 0.012,
      max_shake_ms: 300, max_particles_high: 150, max_particles_low: 60, max_emitters: 8, low_quality_frame_ms: 22.2,
      low_quality_window_frames: 120,
    });
    expect(vfx.colors.aura).toEqual({ blaze: '#ff6a3d', gale: '#3ddc97', stone: '#c9a36b', radiant: '#ffd84a', void: '#9b6bff' });
    expect(vfx.colors.card_type).toEqual({ fist: '#d9483b', bolt: '#3a7fd9', signature: '#9a52d9', climax: '#e8a21f' });
    expect(vfx.colors.rarity).toEqual({ 3: '#5aa9ff', 4: '#b06bff', 5: '#ffc23d' });
    expect(vfx.summon_timing).toEqual({ charge_ms: { 3: 260, 4: 420, 5: 700 }, hold_ms: { 3: 850, 4: 1150, 5: 1900 } });
  });
  it('R3 shakes, flashes, hit flash and impact ring', () => {
    const L = (id, i) => vfx.effects[id].layers[i || 0];
    expect(L('r3_shake_hit')).toMatchObject({ kind: 'shake', duration_ms: 120, intensity: 0.006 });
    expect(L('r3_shake_ko')).toMatchObject({ kind: 'shake', duration_ms: 250, intensity: 0.01 });
    expect(L('r3_cinematic_flash')).toMatchObject({ kind: 'screen_flash', start_ms: 0, duration_ms: 120, color: 'white' });
    expect(L('r3_summon_flash_3')).toMatchObject({ kind: 'screen_flash', duration_ms: 220, alpha: 0.45, color: 'rarity' });
    expect(L('r3_summon_flash_4')).toMatchObject({ kind: 'screen_flash', duration_ms: 220, alpha: 0.45, color: 'rarity' });
    expect(L('r3_summon_flash_5')).toMatchObject({ kind: 'screen_flash', duration_ms: 420, alpha: 0.9, color: 'white' });
    expect(L('r3_summon_shake_5')).toMatchObject({ kind: 'shake', duration_ms: 260, intensity: 0.012 });
    expect(L('r3_hit_flash')).toMatchObject({ kind: 'sprite_flash', duration_ms: 167, alpha: 0.8 });
    expect(L('r3_impact_ring', 0)).toMatchObject({ kind: 'ring', duration_ms: 220, color: 'card_type', size_px: 14, scale_from: 1, scale_to: 2.2 });
    expect(L('r3_impact_ring', 1)).toMatchObject({ kind: 'ring', duration_ms: 220, color: 'white', size_px: 18, scale_from: 1, scale_to: 2.2 });
    for (const k of ['hit.fist', 'hit.bolt', 'hit.signature', 'hit.climax']) expect(vfx.events[k].slice(0, 2)).toEqual(['r3_hit_flash', 'r3_impact_ring']);
    expect(vfx.events['hit.climax']).toContain('r3_shake_hit');
    expect(vfx.events['hit.crit']).toContain('r3_shake_hit');
    expect(vfx.events.ko).toContain('r3_shake_ko');
    for (const k of ['ignition', 'tri_burst', 'climax_cinematic']) expect(vfx.events[k][0]).toBe('r3_cinematic_flash');
  });
  it('§17.2 new particle counts: sparks 6/8/12/20, knockdown 24+10, ignition 40, Tri-Burst 40, ★5 orb 20, ★5 reveal 40', () => {
    const count = (id) => vfx.effects[id].layers.filter((l) => l.kind === 'particles').reduce((s, l) => s + l.count, 0);
    expect([count('sparks_fist_default'), count('sparks_bolt_default'), count('sparks_signature_default'), count('sparks_climax_default')]).toEqual([6, 8, 12, 20]);
    expect(count('knockdown_burst')).toBe(34);
    expect(count('ignition_default')).toBe(40);
    expect(count('tri_burst_default')).toBe(40);
    expect(count('summon_orb_storm_5')).toBe(20);
    expect(count('summon_reveal_burst_5')).toBe(40);
  });
});

describe('per-card and per-character keys (GDD §17.2 override, §15.3 rule 15)', () => {
  const cards = readJson('data/cards.json').cards;
  const chars = readJson('data/characters.json').characters;
  const battle = readJson('data/battle.json');
  it('every card art.vfx and character ignition.art.vfx has an effect; Climax ones fit the card cinematic', () => {
    for (const c of cards) {
      const ef = vfx.effects[c.art.vfx];
      expect(ef, c.id).toBeTruthy();
      if (c.type === 'climax') expect(ef.duration_ms, c.id).toBeLessThanOrEqual(Math.round(c.cinematic_s * 1000));
    }
    for (const ch of chars) {
      if (!ch.ignition || !ch.ignition.art) continue;
      expect(vfx.effects[ch.ignition.art.vfx], ch.id).toBeTruthy();
      expect(vfx.effects[ch.ignition.art.vfx].duration_ms).toBeLessThanOrEqual(battle.ignition.cinematic_s * 1000);
      expect(vfx.effects[ch.ignition.art.vfx + '_active'], ch.id + ' loop').toBeTruthy();
    }
  });
});

describe('AC-17.9 §15.3 rule 14 through the project validator', () => {
  const schemas = loadAllSchemas();
  const banned = parseBannedTerms(loadGdd());
  const run = (mut) => {
    const data = loadAllData();
    data['vfx.json'] = clone(vfx);
    if (mut) mut(data);
    return validateDataset(data, schemas, banned, [], { balance: false }).errors.filter((e) => e.rule === '14-flash-safety');
  };
  it('default vfx.json PASSES rule 14', () => {
    expect(run()).toEqual([]);
  });
  it('the GDD negative fixtures FAIL', () => {
    expect(run((d) => { d['vfx.json'].effects.r3_cinematic_flash.layers[0].color = '#ff2020'; }).length).toBeGreaterThan(0);
    expect(run((d) => { d['vfx.json'].effects.r3_shake_ko.layers[0].intensity = 0.02; }).length).toBeGreaterThan(0);
    expect(run((d) => {
      d['vfx.json'].effects.r3_cinematic_flash.layers = [0, 200, 400, 600].map((t) => ({ kind: 'screen_flash', start_ms: t, duration_ms: 100, color: 'white', alpha: 0.5 }));
    }).length).toBeGreaterThan(0);
    expect(run((d) => { d['vfx.json'].effects.ignition_default.duration_ms = 1600; }).length).toBeGreaterThan(0);
  });
});

describe('generated textures (§17.4: one atlas ≤ 1,024², no files)', () => {
  it('every texture key used in vfx.json is generated', () => {
    for (const [id, ef] of Object.entries(vfx.effects)) {
      for (const ly of ef.layers) {
        if (!ly.texture) continue;
        expect(GENERATED_TEXTURES, id).toContain(ly.texture);
        if (ly.texture !== 'vfx_gen_radial' && ly.texture !== 'vfx_gen_tri_stripes') expect(frameOf(ly.texture), id).not.toBe(null);
      }
    }
  });
  it('all frames pack into one 512 × 512 atlas without overlap', () => {
    expect(ATLAS_SIZE).toBeLessThanOrEqual(1024);
    const L = layoutAtlas(ATLAS_SIZE);
    const rects = FRAMES.map((f) => L[f]);
    for (const r of rects) {
      expect(r.x + r.w).toBeLessThanOrEqual(ATLAS_SIZE);
      expect(r.y + r.h).toBeLessThanOrEqual(ATLAS_SIZE);
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, FRAMES[i] + ' vs ' + FRAMES[j]).toBe(false);
      }
    }
  });
});
