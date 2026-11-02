// GDD §17 against live battles (P-class, headless): AC-17.2 (VFX never changes the battle), AC-17.8 (cinematic
// effects end at freeze_end, frozen ticks unchanged), AC-17.6 headless budget, AC-17.5 reduce-motion counts.
import { describe, it, expect } from 'vitest';
import { readJson } from '../helpers/load-data.js';
import { loadVfx, liveContent, liveLookup, makeCore, runHashed } from './vfx-helpers.js';

const vfx = loadVfx();
const content = liveContent();
const lookup = liveLookup(content);
const TEAM = readJson('data/economy.json').starting.team;
const STAGES = ['stage_001', 'stage_002', 'stage_003', 'stage_004', 'stage_005'];
const SEEDS = Number(process.env.VFX_SEEDS || 200);

describe('AC-17.2 battle event hash is identical with VFX attached vs detached, reduce motion on vs off', () => {
  for (const stage of STAGES) {
    it(stage + ': seeds 1–' + SEEDS, () => {
      const seen = new Set();
      for (let seed = 1; seed <= SEEDS; seed++) {
        const off = runHashed(content, TEAM, stage, seed, []);
        const on = runHashed(content, TEAM, stage, seed, [makeCore(vfx, { lookup }).core]);
        const rm = runHashed(content, TEAM, stage, seed, [makeCore(vfx, { lookup, reduceMotion: true }).core]);
        expect(on.hash, 'seed ' + seed).toBe(off.hash);
        expect(rm.hash, 'seed ' + seed).toBe(off.hash);
        expect(on.ticks).toBe(off.ticks);
        for (const t of on.types) seen.add(t);
      }
      // the run exercised the hit and KO paths of the VFX layer
      expect(seen.has('hit')).toBe(true);
      expect(seen.has('ko')).toBe(true);
    });
  }
  it('cinematics occur across the seeded runs (ignition, tri_burst, climax_cinematic are covered)', () => {
    const seen = new Set();
    for (const stage of STAGES) for (let seed = 1; seed <= 20; seed++) for (const t of runHashed(content, TEAM, stage, seed, [makeCore(vfx, { lookup }).core]).types) seen.add(t);
    for (const t of ['ignition', 'tri_burst', 'climax_cinematic', 'freeze_end']) expect(seen.has(t), t).toBe(true);
  });
  it('must-FAIL: a VFX hook that calls step() once more changes the hash', () => {
    const off = runHashed(content, TEAM, 'stage_003', 5, []);
    let once = false;
    const bad = runHashed(content, TEAM, 'stage_003', 5, [makeCore(vfx, { lookup }).core], (b) => {
      if (!once) {
        once = true;
        b.step();
      }
    });
    expect(bad.hash).not.toBe(off.hash);
  });
});

describe('AC-17.8 cinematic effects end within 160 ms of freeze_end; frozen ticks unchanged', () => {
  const ST = {
    teams: {
      player: { activeSlot: 0, fighters: [{ slot: 0, aura: 'blaze', characterId: 'char_tavi_001' }, { slot: 1, aura: 'gale', characterId: 'char_lark_001' }, { slot: 2, aura: 'stone', characterId: 'char_dunmore_001' }] },
      enemy: { activeSlot: 0, fighters: [{ slot: 0, aura: 'void', characterId: 'char_thessa_001' }] },
    },
  };
  const cases = [
    ['ignition', { type: 'ignition', side: 'player', slot: 0, name: 'Overheat Form' }, 'ignition'],
    ['tri_burst', { type: 'tri_burst', side: 'player', members: [0, 1, 2], damages: [1, 1, 1] }, 'tri_burst'],
    ['climax', { type: 'climax_cinematic', side: 'player', cardId: 'card_tavi_wildfire_crash' }, 'climax'],
  ];
  for (const [name, ev, kind] of cases) {
    it(name + ': an early freeze_end (at 700 ms) cuts every layer; nothing of it is live 160 ms later', () => {
      const { core, rec } = makeCore(vfx, { lookup });
      core.onBattleEvents([ev], ST, 0);
      for (let t = 16; t <= 700; t += 16) core.update(t, 16);
      core.onBattleEvents([{ type: 'freeze_end', kind, side: 'player' }], ST, 700);
      for (let t = 716; t <= 860; t += 16) core.update(t, 16);
      core.update(861, 1);
      const cineIds = new Set(rec.visuals.filter((v) => v.spec.t0 <= 700 && !v.spec.loop).map((v) => v.spec.inst));
      for (const c of core.instances) if (!c.loop && c.t0 === 0) cineIds.add(c.id);
      // every visual handed to the renderer for this cinematic was told to end with a fade ≤ 160 ms
      for (const v of rec.visuals) {
        if (v.spec.effectId.indexOf('ignition_active') >= 0 || !cineIds.has(v.spec.inst)) continue;
        expect(v.fade, v.spec.effectId + ' ' + v.spec.kind).not.toBe(null);
        expect(v.fade).toBeLessThanOrEqual(160);
      }
      // no particle of the cinematic is alive, no pending layer starts later
      const S = core.store;
      for (let i = 0; i < S.capacity; i++) if (S.alive[i]) expect(cineIds.has(S.inst[i])).toBe(false);
      const before = rec.visuals.length;
      for (let t = 876; t <= 5000; t += 16) core.update(t, 16);
      const later = rec.visuals.slice(before).filter((v) => v.spec.effectId.indexOf('ignition_active') < 0);
      expect(later).toEqual([]);
      expect(rec.flashes.length).toBe(1); // the 2,400 ms Tri-Burst flash never fires after the cut
    });
  }
  it('ignition: after freeze_end the aura loop runs until ignition_end, ≤ 12 alive (≤ 6 on low)', () => {
    for (const q of ['high', 'low']) {
      const { core } = makeCore(vfx, { lookup, quality: q });
      core.onBattleEvents([{ type: 'ignition', side: 'player', slot: 0 }], ST, 0);
      for (let t = 16; t < 1500; t += 16) core.update(t, 16);
      core.onBattleEvents([{ type: 'freeze_end', kind: 'ignition', side: 'player' }], ST, 1500);
      let maxLoop = 0;
      for (let t = 1516; t < 8000; t += 16) {
        core.update(t, 16);
        if (t > 2000) maxLoop = Math.max(maxLoop, core.store.liveCount);
      }
      expect(maxLoop).toBeGreaterThan(0);
      expect(maxLoop).toBeLessThanOrEqual(q === 'high' ? 12 : 6);
      expect(core.loops.player.insts[0].effectId).toBe('vfx_tavi_ignition_active'); // per-character back-shape
      core.onBattleEvents([{ type: 'ignition_end', side: 'player', slot: 0, reason: 'duration' }], ST, 8000);
      for (let t = 8016; t < 9500; t += 16) core.update(t, 16);
      expect(core.store.liveCount).toBe(0);
      expect(core.loops.player).toBe(null);
    }
  });
  it('frozen ticks per cinematic are the same with VFX on and off (live battles)', () => {
    const frozen = (cores) => {
      let n = 0;
      runHashed(content, TEAM, 'stage_005', 11, cores, (b) => { if (b.getState().freeze) n += 1; });
      return n;
    };
    expect(frozen([makeCore(vfx, { lookup }).core])).toBe(frozen([]));
  });
});

describe('AC-17.6 (headless) and AC-17.5 reduce-motion counts over whole live battles', () => {
  it('live particles never exceed 150 (high) / 60 (forced low); emitters ≤ 8', () => {
    for (const q of ['high', 'low']) {
      let max = 0;
      for (const stage of ['stage_003', 'stage_005']) {
        for (let seed = 1; seed <= 15; seed++) {
          const c = makeCore(vfx, { lookup, quality: q }).core;
          max = Math.max(max, runHashed(content, TEAM, stage, seed, [c]).maxParticles);
          expect(c.stats.emittersMax).toBeLessThanOrEqual(8);
        }
      }
      expect(max).toBeLessThanOrEqual(q === 'high' ? 150 : 60);
      expect(max).toBeGreaterThan(10);
    }
  });
  it('reduce motion: 0 screen flashes and 0 shakes for the whole battle; ≤ 3 flashes per 1 s window otherwise', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const rm = makeCore(vfx, { lookup, reduceMotion: true });
      runHashed(content, TEAM, 'stage_005', seed, [rm.core]);
      expect(rm.rec.flashes.length).toBe(0);
      expect(rm.rec.shakes.length).toBe(0);
      const on = makeCore(vfx, { lookup });
      runHashed(content, TEAM, 'stage_005', seed, [on.core]);
      const f = on.core.stats.flashes;
      for (let i = 0; i < f.length; i++) {
        const inWin = f.filter((t) => t > f[i] - 1000 && t <= f[i]).length;
        expect(inWin).toBeLessThanOrEqual(3);
      }
    }
  });
});
