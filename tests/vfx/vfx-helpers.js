// Helpers for the headless VFX tests (no Phaser): live data, a recording renderer, a hashed battle runner.
import fs from 'node:fs';
import path from 'node:path';
import { createBattle, createContent } from '../../src/logic/index.js';
import { VfxCore } from '../../src/vfx/core.js';
import { ROOT, readJson } from '../helpers/load-data.js';

/** data/vfx.json, or the file named by VFX_JSON (used to prove the tests fail on broken data). */
export function loadVfx() {
  const p = process.env.VFX_JSON ? path.resolve(process.env.VFX_JSON) : path.join(ROOT, 'data', 'vfx.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function liveContent() {
  return createContent({
    battle: readJson('data/battle.json'), characters: readJson('data/characters.json'), cards: readJson('data/cards.json'),
    enemies: readJson('data/enemies.json'), stages: readJson('data/stages.json'), economy: readJson('data/economy.json'),
    banners: readJson('data/banners.json'),
  });
}

export function liveLookup(content) {
  return { character: (id) => content.characters[id] || null, card: (id) => content.cards[id] || null };
}

/** Records what the core asks the renderer to do; fixed arena anchors (player x 110, enemy x 250, feet y 284). */
export function recordingRenderer() {
  const rec = { shakes: [], flashes: [], visuals: [], stopShakes: 0, ended: [] };
  return {
    rec,
    anchor(name, ctx) {
      const x = (s) => (s === 'enemy' ? 250 : 110);
      if (name === 'screen') return { x: 180, y: 160 };
      if (name === 'attacker') return { x: x(ctx.side), y: 224 };
      if (name === 'feet') return { x: x(ctx.side), y: 284 };
      if (name === 'between') return { x: 180, y: 224 };
      return { x: x(ctx.target), y: 224 };
    },
    shake(ms, intensity) { rec.shakes.push({ ms, intensity }); },
    stopShake() { rec.stopShakes += 1; },
    screenFlash(color, alpha, ms) { rec.flashes.push({ color, alpha, ms }); },
    visual(spec) {
      const v = { spec, endedAt: null, fade: null };
      rec.visuals.push(v);
      return { end: (ms) => { v.fade = ms; rec.ended.push(spec.effectId); } };
    },
  };
}

export function makeCore(vfx, opts) {
  const o = opts || {};
  const renderer = o.renderer || recordingRenderer();
  const core = new VfxCore(vfx, { reduceMotion: !!o.reduceMotion, quality: o.quality, lookup: o.lookup, renderer, seed: o.seed || 7 });
  return { core, rec: renderer.rec };
}

/** FNV-1a over a string, continued from h. */
export function fnv(str, h) {
  let x = h === undefined ? 0x811c9dc5 : h;
  for (let i = 0; i < str.length; i++) {
    x ^= str.charCodeAt(i);
    x = Math.imul(x, 0x01000193) >>> 0;
  }
  return x;
}

const TICK_MS = 1000 / 60;

/**
 * Run one AI-vs-AI stage battle. cores: VFX cores to attach (may be []). Each step's events go to every core
 * (with the state snapshot) and are hashed AFTER the cores saw them (so a core that mutates an event changes the
 * hash). onStep(b, events) is an optional extra hook (the must-FAIL proof uses it to call step()).
 * Returns { hash, ticks, types: Set, maxParticles }.
 */
export function runHashed(content, team, stageId, seed, cores, onStep) {
  const b = createBattle({ content, stageId, playerTeam: team, playerController: { aiTier: 'fighter' }, skipIntro: true }, seed);
  let h = 0x811c9dc5;
  let tick = 0;
  const types = new Set();
  let maxParticles = 0;
  while (!b.getResult() && tick < 60 * 60 * 6) {
    const events = b.step();
    tick += 1;
    const now = tick * TICK_MS;
    if (cores.length && events.length) {
      const st = b.getState();
      for (const c of cores) c.onBattleEvents(events, st, now);
    }
    for (const c of cores) {
      c.update(now, TICK_MS);
      if (c.store.liveCount > maxParticles) maxParticles = c.store.liveCount;
    }
    if (onStep) onStep(b, events);
    for (const e of events) types.add(e.type);
    if (events.length) h = fnv(tick + ':' + JSON.stringify(events), h); // tick included: timing is part of the hash
  }
  h = fnv(JSON.stringify(b.getState()) + JSON.stringify(b.getResult()), h);
  return { hash: h, ticks: tick, types, maxParticles };
}
