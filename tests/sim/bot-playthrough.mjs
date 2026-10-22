#!/usr/bin/env node
// QA bot playthrough (round 2). Plays every stage headlessly with random valid-looking inputs
// (seeded, reproducible) and checks invariants every tick.
// Usage: node tests/sim/bot-playthrough.mjs [--per-stage 50] [--seed 1000] [--ai-per-stage 10] [--selftest]
// Exit code 1 if any battle fails an invariant. Prints one FAIL line per failure (with the seed).
//
// Invariants (GDD §5): no exception; HP finite integer in [0,max]; KO iff hp==0 for the active fighter;
// Vigor finite in [0,10]; Burst in [0,100]; x in [0,100]; distance ≥ min_distance; timer never increases;
// exactly one active fighter per team, the others Benched or KO; fighter states from the GDD set;
// hand never holds more copies of a card than the deck has (AC-5.4.2); the battle ends by the timer
// (unfrozen ticks ≤ timer_s×60) and within a real-tick cap; the result matches the HP state;
// pause freezes everything; same seed + same input log = same digest (§5.0); the enemy AI never
// gets an action rejected for Vigor (AC-5.15.2); applyBattleResult keeps the save schema-valid.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createBattle, createContent } from '../../src/logic/index.js';
import { createFreshSave, applyBattleResult } from '../../src/state/save.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };

const data = {
  battle: read('data/battle.json'), characters: read('data/characters.json'), cards: read('data/cards.json'),
  enemies: read('data/enemies.json'), stages: read('data/stages.json'), economy: read('data/economy.json'),
};
const content = createContent(data);
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSave = ajv.compile(read('data/schemas/save.schema.json'));
const charsById = {};
for (const c of data.characters.characters) charsById[c.id] = c;

const STATES = new Set(['Idle', 'Dashing', 'Windup', 'Active', 'Recovery', 'Slipping', 'SlipRecovery', 'Hitstun', 'Knockdown', 'Cinematic', 'KO', 'Benched']);
const MIN_DIST = data.battle.arena.min_distance;
const W = data.battle.arena.width;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomTeam(r) {
  const playable = data.characters.characters.filter((c) => c.playable);
  const team = [];
  const fam = new Set();
  let guard = 0;
  while (team.length < 3 && guard++ < 1000) {
    const c = playable[Math.floor(r() * playable.length)];
    if (fam.has(c.family)) continue;
    fam.add(c.family);
    team.push({ characterId: c.id, resonance: Math.floor(r() * 5) });
  }
  return team;
}

function deckCopies(state, side, slot) {
  // copies allowed per card id = max over base deck and ignition deck of that fighter
  const f = state.teams[side].fighters[slot];
  let def;
  if (side === 'player') def = charsById[f.characterId];
  else {
    const en = data.enemies.enemies.find((e) => e.id === f.enemyId);
    def = charsById[en.character_id];
  }
  const m = {};
  const add = (deck) => { for (const e of deck || []) m[e.card_id] = Math.max(m[e.card_id] || 0, e.count); };
  add(def.deck);
  if (def.ignition) add(def.ignition.deck);
  return m;
}

function randomInputs(r, prob) {
  const out = [];
  if (r() >= prob) return out;
  const n = r() < 0.15 ? 2 : 1; // sometimes a double tap in the same tick
  for (let k = 0; k < n; k++) {
    const x = r();
    let inp;
    if (x < 0.45) inp = { type: 'card', slot: Math.floor(r() * 4) };
    else if (x < 0.6) inp = { type: 'dash', dir: r() < 0.6 ? 'forward' : 'back' };
    else if (x < 0.75) inp = { type: 'slip' };
    else if (x < 0.85) inp = { type: 'tag', slot: Math.floor(r() * 3) };
    else if (x < 0.93) inp = { type: 'ignite' };
    else inp = { type: 'tri_burst' };
    out.push(inp);
    if (n === 2 && r() < 0.5) { out.push({ ...inp }); break; } // literal double tap
  }
  return out;
}

/** Run one battle. mode: 'random' (human player with random inputs) or an AI tier for the player. */
function runOne(stageId, seed, mode, opts = {}) {
  const r = mulberry32(seed ^ 0x9e3779b9);
  const team = randomTeam(r);
  const stage = data.stages.stages.find((s) => s.id === stageId);
  const cfg = { content, stageId, playerTeam: team, skipIntro: false };
  if (mode !== 'random') cfg.playerController = { aiTier: mode };
  const b = createBattle(cfg, seed);
  const inputLog = [];
  const fails = [];
  const fail = (m) => { if (fails.length < 5) fails.push(m); };
  const copies = { player: [0, 1, 2].map(() => null), enemy: [0, 1, 2].map(() => null) };
  let prevTimer = Infinity;
  let realTicks = 0;
  const cap = (stage.timer_s * 60) + 60 * 60 * 5; // timer + 5 min of freezes
  let hash = 2166136261;
  let enemyVigorRejects = 0;
  const prob = opts.inputProb ?? 0.06;
  let pausedTicks = 0;
  try {
    while (!b.getResult() && realTicks < cap) {
      // random pause for a few ticks (backgrounding) — state must not move
      if (mode === 'random' && r() < 0.0015) {
        const before = JSON.stringify(b.getState());
        b.setPaused(true);
        for (let i = 0; i < 30; i++) { const ev = b.step(randomInputs(r, 0.5)); if (ev.length) fail('events while paused at tick ' + realTicks); }
        const after = JSON.stringify(b.getState()).replace('"paused":true', '"paused":false');
        if (before !== after) fail('state changed while paused at tick ' + realTicks);
        b.setPaused(false);
        pausedTicks += 30;
      }
      // QA self-test hook (L-shared-006): deliberately corrupt the battle to prove the checks fail.
      const inj = process.env.QA_INJECT;
      if (inj && realTicks === 200) {
        if (inj === 'nan') b.teams.player.fighters[0].hp = NaN;
        if (inj === 'negvigor') b.teams.player.vigor = -5 * 1e6;
        if (inj === 'neverend') { b.timerTicks = 1e12; for (const t of ['player', 'enemy']) for (const f of b.teams[t].fighters) f.def.maxHp = f.hp = 1e9; }
        if (inj === 'throw') b.teams.enemy.fighters[0].deck = null;
        if (inj === 'dup') b.teams.player.fighters[0].deck.hand = Array(4).fill(b.teams.player.fighters[0].deck.hand[0]);
      }
      const inp = mode === 'random' ? randomInputs(r, prob) : [];
      inputLog.push(inp);
      const evs = b.step(inp);
      realTicks += 1;
      for (const e of evs) {
        const s = e.type + (e.damage || 0) + e.tick + (e.side || '');
        for (let i = 0; i < s.length; i++) hash = Math.imul(hash ^ s.charCodeAt(i), 16777619) >>> 0;
        if (e.type === 'input_rejected' && e.side === 'enemy' && e.reason === 'vigor') enemyVigorRejects++;
      }
      const st = b.getState();
      if (st.timer.ticksLeft > prevTimer) fail('timer increased at real tick ' + realTicks);
      prevTimer = st.timer.ticksLeft;
      const d = st.distance;
      if (!Number.isFinite(d) || d < MIN_DIST - 1e-9) fail('distance ' + d + ' < min at tick ' + st.tick);
      for (const side of ['player', 'enemy']) {
        const t = st.teams[side];
        if (!Number.isFinite(t.vigor) || t.vigor < 0 || t.vigor > t.vigorMax + 1e-9) fail(side + ' vigor ' + t.vigor + ' at tick ' + st.tick);
        if (!Number.isFinite(t.burst) || t.burst < 0 || t.burst > 100) fail(side + ' burst ' + t.burst + ' at tick ' + st.tick);
        if (!Number.isFinite(t.x) || t.x < 0 || t.x > W) fail(side + ' x ' + t.x + ' at tick ' + st.tick);
        let actives = 0;
        t.fighters.forEach((f, i) => {
          if (!Number.isInteger(f.hp) || f.hp < 0 || f.hp > f.maxHp) fail(side + '[' + i + '] hp ' + f.hp + '/' + f.maxHp + ' at tick ' + st.tick);
          if (!STATES.has(f.state)) fail(side + '[' + i + '] bad state ' + f.state);
          if (f.active) actives++;
          if (f.active && !st.result && st.freeze?.kind !== 'ko' && f.hp === 0 && !f.ko) fail(side + '[' + i + '] hp 0 but not KO at tick ' + st.tick);
          if (f.ko && f.hp !== 0) fail(side + '[' + i + '] KO with hp ' + f.hp);
          if (!f.active && !f.ko && f.state !== 'Benched') fail(side + '[' + i + '] inactive but state ' + f.state + ' at tick ' + st.tick);
          if (f.active && !f.ko && f.state === 'Benched') fail(side + '[' + i + '] active but Benched at tick ' + st.tick);
          if (!copies[side][i]) copies[side][i] = deckCopies(st, side, i);
          const cnt = {};
          for (const c of f.hand) if (c) cnt[c.cardId] = (cnt[c.cardId] || 0) + 1;
          for (const id of Object.keys(cnt)) if (cnt[id] > (copies[side][i][id] || 0)) fail(side + '[' + i + '] hand has ' + cnt[id] + 'x ' + id + ' (copies ' + (copies[side][i][id] || 0) + ')');
          if (!Number.isFinite(f.atk) || !Number.isFinite(f.def) || f.atk <= 0) fail(side + '[' + i + '] atk/def ' + f.atk + '/' + f.def);
        });
        if (actives !== 1) fail(side + ' has ' + actives + ' active fighters at tick ' + st.tick);
      }
      if (st.tick > stage.timer_s * 60) fail('unfrozen tick ' + st.tick + ' beyond timer');
    }
  } catch (e) {
    fail('EXCEPTION ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
  }
  const res = b.getResult();
  if (!res) fail('battle never ended within ' + realTicks + ' real ticks');
  else {
    const st = b.getState();
    const pw = st.teams.player.fighters.every((f) => f.ko);
    const ew = st.teams.enemy.fighters.every((f) => f.ko);
    if (res.outcome === 'win' && res.reason === 'ko' && !ew) fail('win by ko but enemy alive');
    if (res.outcome === 'lose' && res.reason === 'ko' && !pw) fail('lose by ko but player alive');
    if (res.reason === 'timeout') {
      if (res.outcome === 'win' && !(res.playerHpRatio > res.enemyHpRatio)) fail('timeout win but ratio ' + res.playerHpRatio + ' <= ' + res.enemyHpRatio);
      if (res.outcome === 'lose' && !(res.playerHpRatio < res.enemyHpRatio)) fail('timeout lose but ratio ' + res.playerHpRatio + ' >= ' + res.enemyHpRatio);
    }
    if (!Number.isFinite(res.timeElapsedS) || res.timeElapsedS < 0 || res.timeElapsedS > stage.timer_s) fail('timeElapsedS ' + res.timeElapsedS);
    // save application stays schema-valid
    const save = createFreshSave(data.economy, '2026-10-22T00:00:00.000Z');
    applyBattleResult(save, stage, res, data.economy, charsById, '2026-10-22T00:00:00.000Z');
    applyBattleResult(save, stage, res, data.economy, charsById, '2026-10-22T00:00:00.000Z');
    if (!validateSave(save)) fail('save invalid after result: ' + JSON.stringify(validateSave.errors).slice(0, 200));
    if (save.currencies.cur_jade < 0 || !Number.isFinite(save.currencies.cur_jade)) fail('jade ' + save.currencies.cur_jade);
  }
  if (enemyVigorRejects > 0) fail('enemy AI had ' + enemyVigorRejects + ' Vigor-rejected actions (AC-5.15.2)');
  return { team, res, realTicks, digest: hash.toString(16), fails, inputLog, pausedTicks };
}

function replayDigest(stageId, seed, mode, team, inputLog) {
  const cfg = { content, stageId, playerTeam: team, skipIntro: false };
  if (mode !== 'random') cfg.playerController = { aiTier: mode };
  const b = createBattle(cfg, seed);
  let hash = 2166136261;
  for (const inp of inputLog) {
    const evs = b.step(inp);
    for (const e of evs) {
      const s = e.type + (e.damage || 0) + e.tick + (e.side || '');
      for (let i = 0; i < s.length; i++) hash = Math.imul(hash ^ s.charCodeAt(i), 16777619) >>> 0;
    }
  }
  return hash.toString(16);
}

function main() {
  const perStage = Number(arg('--per-stage', '50'));
  const aiPerStage = Number(arg('--ai-per-stage', '8'));
  const seed0 = Number(arg('--seed', '1000'));
  const stages = data.stages.stages.map((s) => s.id);
  let run = 0;
  let failed = 0;
  const tally = {};
  const lengths = [];
  const t0 = Date.now();
  for (const stageId of stages) {
    tally[stageId] = { win: 0, lose: 0, draw: 0, maxReal: 0 };
    const jobs = [];
    for (let i = 0; i < perStage; i++) jobs.push(['random', seed0 + i]);
    for (const tier of ['rookie', 'fighter', 'veteran', 'master']) for (let i = 0; i < aiPerStage; i++) jobs.push([tier, seed0 + 500 + i]);
    jobs.forEach(([mode, seed], idx) => {
      const r = runOne(stageId, seed, mode, { inputProb: idx % 3 === 0 ? 0.25 : 0.06 });
      run++;
      if (r.res) { tally[stageId][r.res.outcome]++; lengths.push(r.res.timeElapsedS); }
      tally[stageId].maxReal = Math.max(tally[stageId].maxReal, r.realTicks);
      if (idx % 5 === 0 && r.pausedTicks === 0) {
        const again = replayDigest(stageId, seed, mode, r.team, r.inputLog);
        if (again !== r.digest) r.fails.push('NON-DETERMINISTIC replay digest ' + again + ' != ' + r.digest);
      }
      if (r.fails.length) {
        failed++;
        console.log('FAIL stage=' + stageId + ' mode=' + mode + ' seed=' + seed + ' prob=' + (idx % 3 === 0 ? 0.25 : 0.06) + ' team=' + r.team.map((t) => t.characterId + ':R' + t.resonance).join(',') + '\n   - ' + r.fails.join('\n   - '));
      }
    });
  }
  console.log('TALLY ' + JSON.stringify(tally));
  console.log('battles run=' + run + ' failed=' + failed + ' avgTimerS=' + (lengths.reduce((a, b) => a + b, 0) / lengths.length).toFixed(1) + ' wallS=' + ((Date.now() - t0) / 1000).toFixed(1));
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
