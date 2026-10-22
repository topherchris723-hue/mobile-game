// Balance simulation library (balance-analyst, round 3).
// Runs headless battles with the real engine (src/logic) and collects balance metrics.
// Data is read from data/*.json and can be patched IN MEMORY (never on disk), so a proposed
// change can be measured before it is written, and the harness can be proven sensitive (L-shared-006).
//
// Patch format: { file: 'cards'|'characters'|'enemies'|'stages'|'battle'|'economy', id?: '<record id>',
//                 path: 'a.b.c', value: <new value> }   (id omitted for battle/economy: path from the root)

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';

// The engine is src/logic by default. BALANCE_LOGIC=<path to a logic index.js> runs the same sims against
// another copy of the engine (e.g. a snapshot of the committed code while src/ is being edited in parallel).
const LOGIC_URL = process.env.BALANCE_LOGIC ? pathToFileURL(path.resolve(process.env.BALANCE_LOGIC)).href
  : new URL('../../../src/logic/index.js', import.meta.url).href;
const { createBattle, createContent } = await import(LOGIC_URL);

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FILES = ['battle', 'characters', 'cards', 'enemies', 'stages', 'economy'];
const LIST_KEY = { characters: 'characters', cards: 'cards', enemies: 'enemies', stages: 'stages' };

export function loadData() {
  const d = {};
  for (const f of FILES) d[f] = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f + '.json'), 'utf8'));
  return d;
}

function setPath(obj, p, value) {
  const parts = p.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (o[parts[i]] === undefined) throw new Error('patch path not found: ' + p);
    o = o[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (!(last in o)) throw new Error('patch field not found: ' + p);
  o[last] = value;
}

/** Apply patches to a deep copy of the data. Unknown ids/fields throw (a typo must not silently do nothing). */
export function applyPatches(data, patches) {
  const d = JSON.parse(JSON.stringify(data));
  for (const pt of patches || []) {
    let target;
    if (LIST_KEY[pt.file]) {
      target = d[pt.file][LIST_KEY[pt.file]].find((r) => r.id === pt.id);
      if (!target) throw new Error('patch id not found: ' + pt.file + '/' + pt.id);
    } else {
      target = d[pt.file];
    }
    setPath(target, pt.path, pt.value);
  }
  return d;
}

/** Synthetic 1.0× enemies for mirror matches (in memory only). id = 'simx_<character id>'. */
export function addMirrorEnemies(d, tier) {
  for (const c of d.characters.characters) {
    d.enemies.enemies.push({
      id: 'simx_' + c.id, character_id: c.id, ai_tier: tier,
      stat_mult: { hp: 1, atk: 1, def: 1 }, ignition_enabled: true, boss: false,
    });
  }
  return d;
}

/**
 * Run one battle. cfg: { stageId? , enemyTeam?, timerS?, team, playerTier, enemyTier? }
 * Returns metrics for that battle.
 */
export function runOne(content, cfg, seed) {
  const b = createBattle({
    content, stageId: cfg.stageId, enemyTeam: cfg.enemyTeam, timerS: cfg.timerS,
    playerTeam: cfg.team, playerController: { aiTier: cfg.playerTier },
    enemyController: cfg.enemyTier ? { aiTier: cfg.enemyTier } : 'ai', skipIntro: true,
  }, seed);
  const m = {
    dmg: { player: {}, enemy: {} },          // by character id
    dmgType: { player: {}, enemy: {} },      // by card type (+ tri_burst, tag_strike)
    cardPlays: {}, cardDmg: {},              // player + enemy, by card id
    triBurst: { player: 0, enemy: 0 }, ignitions: { player: 0, enemy: 0 },
    perfectSlips: { player: 0, enemy: 0 }, kos: { player: 0, enemy: 0 },
  };
  let realTicks = 0;
  const maxTicks = 60 * 60 * 30;
  while (!b.getResult() && realTicks < maxTicks) {
    const evs = b.step();
    realTicks += 1;
    for (const e of evs) {
      if (e.type === 'hit' || e.type === 'tri_burst_hit') {
        const side = e.side;
        const f = e.type === 'tri_burst_hit' ? b.teams[side].fighters[e.memberSlot] : b.activeFighter(side);
        const cid = f.def.characterId;
        const kind = e.type === 'tri_burst_hit' ? 'tri_burst' : (e.cardId === 'tag_strike' ? 'tag_strike' : e.cardType);
        m.dmg[side][cid] = (m.dmg[side][cid] || 0) + e.damage;
        m.dmgType[side][kind] = (m.dmgType[side][kind] || 0) + e.damage;
        if (e.type === 'hit') m.cardDmg[e.cardId] = (m.cardDmg[e.cardId] || 0) + e.damage;
      } else if (e.type === 'card_played') {
        m.cardPlays[e.cardId] = (m.cardPlays[e.cardId] || 0) + 1;
      } else if (e.type === 'tri_burst') {
        m.triBurst[e.side] += 1;
      } else if (e.type === 'ignition') {
        m.ignitions[e.side] += 1;
      } else if (e.type === 'perfect_slip') {
        m.perfectSlips[e.side] += 1;
      } else if (e.type === 'ko') {
        m.kos[e.side] += 1;
      }
    }
  }
  const r = b.getResult();
  return {
    outcome: r ? r.outcome : 'stuck', reason: r ? r.reason : 'stuck',
    timerS: r ? r.timeElapsedS : NaN, realS: realTicks / 60,
    playerHp: r ? r.playerHpRatio : NaN, enemyHp: r ? r.enemyHpRatio : NaN, m,
  };
}

function addInto(dst, src) {
  for (const k of Object.keys(src)) {
    if (typeof src[k] === 'number') dst[k] = (dst[k] || 0) + src[k];
    else { dst[k] = dst[k] || {}; addInto(dst[k], src[k]); }
  }
}

/** Aggregate a list of battle results into a summary. */
export function summarize(rows) {
  const s = { n: rows.length, win: 0, lose: 0, draw: 0, stuck: 0, timeout: 0, timerS: 0, realS: 0, m: {} };
  const timers = [];
  for (const r of rows) {
    s[r.outcome] += 1;
    if (r.reason === 'timeout') s.timeout += 1;
    s.timerS += r.timerS; s.realS += r.realS; timers.push(r.timerS);
    addInto(s.m, r.m);
  }
  timers.sort((a, b) => a - b);
  s.timerS /= rows.length; s.realS /= rows.length;
  s.winRate = s.win / rows.length;
  s.p10 = timers[Math.floor(timers.length * 0.1)]; s.p50 = timers[Math.floor(timers.length * 0.5)];
  s.p90 = timers[Math.floor(timers.length * 0.9)];
  return s;
}

/** Wilson-free simple 95% CI half-width for a proportion. */
export function ci95(p, n) { return 1.96 * Math.sqrt((p * (1 - p)) / n); }

/**
 * Run jobs in parallel worker threads. job = { cfg, seed0, count, patches, mirrorTier? }.
 * Returns an array of per-job summaries (same order). Results are deterministic (seeded per battle).
 */
export async function runJobs(jobs, threads = Math.max(1, os.cpus().length)) {
  const chunks = [];
  jobs.forEach((job, ji) => {
    const per = Math.ceil(job.count / threads);
    for (let s = 0; s < job.count; s += per) chunks.push({ ji, job: { ...job, seed0: job.seed0 + s, count: Math.min(per, job.count - s) } });
  });
  const results = jobs.map(() => []);
  let next = 0;
  await new Promise((resolve, reject) => {
    let active = 0;
    const startOne = () => {
      if (next >= chunks.length) { if (active === 0) resolve(); return; }
      const c = chunks[next++];
      active += 1;
      const w = new Worker(fileURLToPath(new URL('./worker.mjs', import.meta.url)), { workerData: c.job });
      w.on('message', (rows) => { results[c.ji].push(...rows); });
      w.on('error', reject);
      w.on('exit', () => { active -= 1; startOne(); });
    };
    for (let i = 0; i < threads; i++) startOne();
  });
  return results.map(summarize);
}

/** Build content for a job (patches + optional mirror enemies). */
export function buildContent(job) {
  let d = applyPatches(loadData(), job.patches);
  if (job.mirrorTier) d = addMirrorEnemies(d, job.mirrorTier);
  return createContent(d);
}

export const pct = (x) => (x * 100).toFixed(1) + '%';
