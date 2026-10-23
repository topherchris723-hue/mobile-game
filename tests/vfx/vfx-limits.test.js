// GDD §17.3 / §17.4 limiters, headless (X-class timelines + core behaviour on live vfx.json).
import { describe, it, expect } from 'vitest';
import { FlashLimiter, SpriteFlashGate, ShakeGate, QualityMonitor } from '../../src/vfx/limiters.js';
import { ParticleStore, makeRng } from '../../src/vfx/particles.js';
import { halve } from '../../src/vfx/core.js';
import { loadVfx, makeCore } from './vfx-helpers.js';

const vfx = loadVfx();
const ST = {
  teams: {
    player: { activeSlot: 0, fighters: [{ slot: 0, aura: 'blaze', characterId: 'char_tavi_001', name: 'Tavi' }, { slot: 1, aura: 'gale', characterId: 'char_lark_001' }, { slot: 2, aura: 'stone', characterId: 'char_dunmore_001' }] },
    enemy: { activeSlot: 0, fighters: [{ slot: 0, aura: 'void', characterId: 'char_thessa_001', name: 'Thessa' }] },
  },
};
const hit = (o) => Object.assign({ type: 'hit', side: 'player', cardType: 'fist', cardId: 'card_tavi_spark_jab', hitIndex: 0, crit: false, chainIndex: 1 }, o);

describe('AC-17.3 screen-flash limiter (rolling 1,000 ms, max 3, drop not delay)', () => {
  it('requests at 0, 100, 200, 300, 1050 → shows 0, 100, 200, drops 300, shows 1050', () => {
    const f = new FlashLimiter(3, 1000);
    const shown = [0, 100, 200, 300, 1050].filter((t) => f.request(t));
    expect(shown).toEqual([0, 100, 200, 1050]);
  });
  it('a dropped request does not count; window edge: a start exactly 1,000 ms ago is outside', () => {
    const f = new FlashLimiter(3, 1000);
    expect([0, 10, 20, 30, 999, 1000].map((t) => f.request(t))).toEqual([true, true, true, false, false, true]);
  });
  it('the limit can never be raised above 3 (WCAG 2.3.1)', () => {
    const f = new FlashLimiter(10, 1000);
    expect([0, 1, 2, 3, 4].filter((t) => f.request(t)).length).toBe(3);
  });
  it('core: 4 cinematic flashes inside 1 s → 3 shown, 1 dropped', () => {
    const { core, rec } = makeCore(vfx);
    for (const t of [0, 100, 200, 300]) core.onBattleEvents([{ type: 'climax_cinematic', side: 'player', cardId: 'card_tavi_wildfire_crash' }], ST, t);
    expect(rec.flashes.length).toBe(3);
    expect(core.stats.flashesDropped).toBe(1);
    for (const fl of rec.flashes) expect(fl.alpha).toBeLessThanOrEqual(0.9);
  });
});

describe('AC-17.4 sprite flash (≥ 334 ms between onsets, refresh keeps the tint lit)', () => {
  it('10 hits at 0, 50 … 450 ms → onsets at 0 and 350 only; tint lit from 0 until the fade after the last hit', () => {
    const g = new SpriteFlashGate(334);
    const onsets = [];
    for (let t = 0; t <= 450; t += 50) if (g.hit(t, 0.8, 167, 100) === 'onset') onsets.push(t);
    expect(onsets).toEqual([0, 350]);
    for (let t = 0; t <= 450 + 100; t += 5) expect(g.level(t), 't=' + t).toBeGreaterThan(0);
    // the tint is held at full between hits (no flicker) and fades out after the last hit
    for (let t = 50; t <= 550; t += 5) expect(g.level(t)).toBeCloseTo(0.8, 5);
    expect(g.level(g.litUntil() + 1)).toBe(0);
  });
  it('an isolated hit is the R3 look: 0.8 fading linearly to 0 over 167 ms', () => {
    const g = new SpriteFlashGate(334);
    g.hit(1000, 0.8, 167, 100);
    expect(g.level(1000)).toBeCloseTo(0.8);
    expect(g.level(1000 + 83.5)).toBeCloseTo(0.4, 2);
    expect(g.level(1168)).toBe(0);
  });
  it('a hit after the tint went dark but inside 334 ms is dropped (no new flash)', () => {
    const g = new SpriteFlashGate(334);
    expect(g.hit(0, 0.8, 167, 100)).toBe('onset');
    expect(g.hit(250, 0.8, 167, 100)).toBe('dropped');
    expect(g.hit(340, 0.8, 167, 100)).toBe('onset');
  });
  it('core: a 10-hit Climax (hits every 50 ms) gives 2 onsets on the target', () => {
    const { core } = makeCore(vfx);
    for (let i = 0; i < 10; i++) core.onBattleEvents([hit({ cardType: 'climax', hitIndex: i })], ST, i * 50);
    expect(core.stats.spriteOnsets.enemy).toBe(2);
  });
});

describe('§17.3 shake: caps, one at a time, replace only when stronger', () => {
  it('clamps to 0.012 / 300 ms and replaces only a weaker shake', () => {
    const s = new ShakeGate(0.012, 300);
    expect(s.request(0, 500, 0.05)).toEqual({ ms: 300, intensity: 0.012 });
    expect(s.request(100, 120, 0.006)).toBe(null); // weaker while running
    const s2 = new ShakeGate(0.012, 300);
    expect(s2.request(0, 120, 0.006)).not.toBe(null);
    expect(s2.request(50, 120, 0.006)).toBe(null); // equal: not replaced (R3 behaviour)
    expect(s2.request(60, 250, 0.01)).toEqual({ ms: 250, intensity: 0.01 }); // KO over a crit shake
    expect(s2.request(400, 120, 0.006)).not.toBe(null); // after it ended
  });
});

describe('§17.3 reduce motion', () => {
  it('drops every shake and screen flash; ★5 reveal flash becomes the 120 px gold ring; particles halved', () => {
    const { core, rec } = makeCore(vfx, { reduceMotion: true });
    core.onSummon('reveal', 5, 0);
    core.onBattleEvents([{ type: 'ignition', side: 'player', slot: 0 }], ST, 2000);
    core.onBattleEvents([{ type: 'ko', side: 'enemy', slot: 0 }], ST, 5000);
    for (let t = 0; t < 7000; t += 16) core.update(t, 16);
    expect(rec.shakes).toEqual([]);
    expect(rec.flashes).toEqual([]);
    const rings = rec.visuals.filter((v) => v.spec.effectId === 'summon_ring_5_rm');
    expect(rings.length).toBe(1);
    expect(rings[0].spec.sizePx).toBe(120);
    // the sprite swap and the 96 px ring still play (Ignition stays a big moment)
    expect(rec.visuals.some((v) => v.spec.kind === 'sprite_swap')).toBe(true);
    expect(rec.visuals.some((v) => v.spec.kind === 'ring' && v.spec.sizePx === 96)).toBe(true);
  });
  it('halve(): rounded down, min 1', () => {
    expect([1, 2, 3, 6, 8, 40].map(halve)).toEqual([1, 1, 1, 3, 4, 20]);
  });
  it('reduce motion halves a burst (8 bolt sparks → 4) and afterimages', () => {
    const on = makeCore(vfx, { reduceMotion: true });
    const off = makeCore(vfx);
    for (const c of [on, off]) c.core.onBattleEvents([hit({ cardType: 'bolt', cardId: 'card_tavi_flare_toss' }), { type: 'perfect_slip', side: 'player', slot: 0 }], ST, 0);
    expect(off.core.store.liveCount).toBe(8);
    expect(on.core.store.liveCount).toBe(4);
    const ai = (c) => c.rec.visuals.find((v) => v.spec.kind === 'afterimage').spec.count;
    expect(ai(off)).toBe(2);
    expect(ai(on)).toBe(1);
  });
});

describe('AC-17.6 particle budget (headless unit) and §17.4 emitters / priorities', () => {
  const spec = (prio) => ({ x: 0, y: 0, prio, inst: 1, frame: 'dot', colors: [0xffffff], sizeMin: 3, sizeMax: 6, life: 400, speed: 100, spreadDeg: 360, baseDeg: 0, direction: 'out', aura: null });
  it('never exceeds the cap; priority ≤ 1 is truncated/skipped, priority ≥ 2 removes oldest P0 first', () => {
    const s = new ParticleStore(150, 8, makeRng(3));
    for (let i = 0; i < 7; i++) s.spawn(20, s.acquireEmitter(0, 1), spec(0));
    expect(s.liveCount).toBe(140);
    const e1 = s.acquireEmitter(1, 2);
    expect(s.spawn(30, e1, spec(1))).toBe(10); // only what fits
    expect(s.liveCount).toBe(150);
    expect(s.acquireEmitter(1, 3)).toBe(-1); // 8 emitters busy: priority 1 skipped
    const e3 = s.acquireEmitter(3, 4); // priority 3 evicts the oldest P0 emitter
    expect(e3).toBeGreaterThanOrEqual(0);
    expect(s.spawn(40, e3, spec(3))).toBe(40);
    expect(s.liveCount).toBeLessThanOrEqual(150);
    expect(s.maxSeen).toBeLessThanOrEqual(150);
    let p0 = 0;
    for (let i = 0; i < s.capacity; i++) if (s.alive[i] && s.prio[i] === 0) p0 += 1;
    expect(p0).toBeLessThan(140);
    expect(s.emitterCount).toBeLessThanOrEqual(8);
  });
  it('core: 30 Climax hits in 300 ms never exceed 150 live particles nor 8 emitters; forced low → ≤ 60', () => {
    for (const q of ['high', 'low']) {
      const { core } = makeCore(vfx, { quality: q });
      let max = 0;
      for (let i = 0; i < 30; i++) {
        core.onBattleEvents([hit({ cardType: 'climax', hitIndex: i, cardId: 'card_tavi_wildfire_crash' })], ST, i * 10);
        core.update(i * 10, 10);
        max = Math.max(max, core.store.liveCount);
        expect(core.store.emitterCount).toBeLessThanOrEqual(8);
      }
      expect(max).toBeLessThanOrEqual(q === 'high' ? 150 : 60);
      expect(max).toBeGreaterThan(q === 'high' ? 60 : 20); // the budget was actually reached/used
    }
  });
});

describe('§17.4 auto quality', () => {
  it('switches to low once the median of the last 120 frames exceeds 22.2 ms, and never back', () => {
    const m = new QualityMonitor(120, 22.2, 10);
    for (let i = 0; i < 300; i++) m.frame(i % 3 === 0 ? 40 : 16.7); // a few spikes: median stays 16.7
    expect(m.quality).toBe('high');
    for (let i = 0; i < 120; i++) m.frame(25);
    expect(m.quality).toBe('low');
    for (let i = 0; i < 500; i++) m.frame(10);
    expect(m.quality).toBe('low');
  });
  it('core: slow frames lower the live cap from 150 to 60', () => {
    const { core } = makeCore(vfx);
    expect(core.particleCap()).toBe(150);
    for (let i = 0; i < 130; i++) core.update(i * 30, 30);
    expect(core.quality).toBe('low');
    expect(core.particleCap()).toBe(60);
  });
});

describe('§17.1 rule 3 fallbacks', () => {
  it('an unknown event key, an unknown effect id and a missing card art.vfx effect do not throw', () => {
    const d = JSON.parse(JSON.stringify(vfx));
    d.events['hit.fist'] = ['r3_hit_flash', 'gone_effect'];
    delete d.events.knockdown;
    const { core } = makeCore(d, { lookup: { card: () => ({ art: { vfx: 'vfx_none' } }), character: () => null } });
    expect(() => core.onBattleEvents([hit(), { type: 'knockdown', side: 'enemy', slot: 0 }, { type: 'climax_cinematic', side: 'player', cardId: 'x' }, { type: 'nonsense' }], ST, 0)).not.toThrow();
    expect(core.stats.unknown).toContain('gone_effect');
  });
});
