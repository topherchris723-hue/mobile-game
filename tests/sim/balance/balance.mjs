#!/usr/bin/env node
// Balance simulation runner (balance-analyst, round 3). Uses the real engine headlessly.
//
// Usage:
//   node tests/sim/balance/balance.mjs stages  [--n 2000] [--tiers rookie,fighter,veteran,master] [--patch p.json] [--json out.json]
//   node tests/sim/balance/balance.mjs mirror  [--n 1000] [--tier veteran] [--patch p.json] [--json out.json]
//   node tests/sim/balance/balance.mjs cards   [--n 2000] [--tier veteran] [--patch p.json]
//   node tests/sim/balance/balance.mjs selftest            (proves the harness detects a deliberate change)
//
// --patch: a JSON array of in-memory patches (see lib.mjs); the data files on disk are never changed.
// Seeds are fixed (stage s, tier t → seeds from a fixed base), so every run is reproducible.

import fs from 'node:fs';
import { loadData, runJobs, pct, ci95, applyPatches } from './lib.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0] || 'stages';
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const N = Number(arg('--n', '2000'));
const patches = arg('--patch') ? JSON.parse(fs.readFileSync(arg('--patch'), 'utf8')) : [];
const jsonOut = arg('--json');
const data = loadData();
const STARTERS = data.economy.starting.team;
const STAGES = data.stages.stages.map((s) => s.id);
const TIER_SEED = { rookie: 1, fighter: 2, veteran: 3, master: 4, proxy_average: 5, proxy_skilled: 6 };
const STAGE_BY_ID = Object.fromEntries(data.stages.stages.map((x) => [x.id, x]));
/** §9.3: share of wins that meet the stage's time_under_s mission (null if the stage has none). */
function timeMission(st, s, d = data) {
  const stage = (d.stages.stages.find((x) => x.id === st)) || STAGE_BY_ID[st];
  const mis = (stage.missions || []).find((x) => x.type === 'time_under_s');
  if (!mis) return null;
  return { value: mis.value, share: s.winTimers.length ? s.winTimers.filter((t) => t < mis.value).length / s.winTimers.length : 0 };
}
function balRow(st, s) {
  const tm = timeMission(st, s, applyPatchesSafe());
  return pct(s.winRate) + ' | ' + (isNaN(s.koMedianS) ? '-' : s.koMedianS.toFixed(0)) + ' | ' + pct(s.timeout / s.n) + ' | ' +
    (s.tbN ? pct(s.tbMedian) + ' (n ' + s.tbN + ')' : '-') + ' | ' + (tm ? '<' + tm.value + ': ' + pct(tm.share) : '-');
}
let patchedData = null;
function applyPatchesSafe() { if (!patchedData) patchedData = applyPatches(data, patches); return patchedData; }

async function stages() {
  const tiers = arg('--tiers', 'proxy_average,proxy_skilled').split(',');
  const jobs = [];
  for (const st of STAGES) for (const t of tiers) {
    jobs.push({ cfg: { stageId: st, team: STARTERS, playerTier: t }, seed0: 1000000 * TIER_SEED[t] + 10000 * Number(st.slice(-3)) + Number(arg('--seed-offset', '0')), count: N, patches });
  }
  const res = await runJobs(jobs);
  console.log('Starter team ' + STARTERS.join(',') + ' — ' + N + ' battles per cell');
  console.log('| Stage | Player | Win | KO-ended median s | Timeouts | Tri-Burst median (% target max HP, BAL-5.10) | time_under_s mission share of wins | Avg real s |');
  console.log('|---|---|---|---|---|---|---|---|');
  const out = [];
  let k = 0;
  for (const st of STAGES) for (const t of tiers) {
    const s = res[k++];
    out.push({ stage: st, tier: t, winRate: s.winRate, koMedianS: s.koMedianS, timeout: s.timeout / s.n, tbMedian: s.tbMedian, tbN: s.tbN, mission: timeMission(st, s, applyPatchesSafe()), realS: s.realS, stuck: s.stuck });
    console.log('| ' + st + ' | ' + t + ' | ' + balRow(st, s) + ' | ' + s.realS.toFixed(0) + ' |' + (s.stuck ? ' STUCK=' + s.stuck : ''));
  }
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(out, null, 1));
  return out;
}

async function mirror() {
  const tier = arg('--tier', 'veteran');
  const byR = {};
  for (const c of data.characters.characters) if (c.playable) (byR[c.rarity] = byR[c.rarity] || []).push(c.id);
  const jobs = [];
  const pairs = [];
  let seedBase = 5000000 + Number(arg('--seed-offset', '0'));
  for (const r of Object.keys(byR)) {
    for (const a of byR[r]) for (const bId of byR[r]) {
      if (a === bId) continue;
      pairs.push({ r, a, b: bId });
      jobs.push({ cfg: { enemyTeam: ['simx_' + bId], timerS: 180, team: [a], playerTier: tier, enemyTier: tier }, seed0: seedBase, count: N, patches, mirrorTier: tier });
      seedBase += 100000;
    }
  }
  const res = await runJobs(jobs);
  // score per character: win = 1, draw = 0.5, from both sides of every pairing
  const score = {}; const games = {}; const pairRows = []; const len = {};
  pairs.forEach((p, i) => {
    const s = res[i];
    const aPts = s.win + 0.5 * s.draw; const bPts = s.lose + 0.5 * s.draw;
    score[p.a] = (score[p.a] || 0) + aPts; games[p.a] = (games[p.a] || 0) + s.n;
    score[p.b] = (score[p.b] || 0) + bPts; games[p.b] = (games[p.b] || 0) + s.n;
    len[p.r] = (len[p.r] || []).concat([s.timerS]);
    pairRows.push({ ...p, aWin: aPts / s.n, timerS: s.timerS, timeout: s.timeout / s.n });
  });
  console.log('1v1 equal-rarity mirror, both sides AI tier ' + tier + ', stat_mult 1.0, Ignition on, ' + N + ' battles per ordered pair (each pair played from both sides)');
  console.log('| Rarity | Character | Win rate (draw = ½) | Battles |');
  console.log('|---|---|---|---|');
  const out = { tier, chars: {}, pairs: pairRows };
  for (const r of Object.keys(byR)) for (const c of byR[r]) {
    const w = score[c] / games[c];
    out.chars[c] = w;
    const flag = w > 0.6 || w < 0.4 ? ' **OUTLIER**' : '';
    console.log('| ★' + r + ' | ' + c + ' | ' + pct(w) + ' ±' + (ci95(w, games[c]) * 100).toFixed(1) + flag + ' | ' + games[c] + ' |');
  }
  console.log('\nPairs (player side listed first):');
  for (const p of pairRows) console.log('  ★' + p.r + ' ' + p.a + ' vs ' + p.b + ': ' + pct(p.aWin) + ' (avg ' + p.timerS.toFixed(1) + ' s, timeouts ' + pct(p.timeout) + ')');
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(out, null, 1));
  return out;
}

async function cards() {
  const tier = arg('--tier', 'veteran');
  // Every playable character, 1v1 vs every other playable character at 1.0 stats: how often each card is played and its damage.
  const ids = data.characters.characters.filter((c) => c.playable).map((c) => c.id);
  const jobs = [];
  let seedBase = 9000000;
  for (const a of ids) for (const bId of ids) if (a !== bId) {
    jobs.push({ cfg: { enemyTeam: ['simx_' + bId], timerS: 180, team: [a], playerTier: tier, enemyTier: tier }, seed0: seedBase, count: N, patches, mirrorTier: tier });
    seedBase += 100000;
  }
  const res = await runJobs(jobs);
  const plays = {}; const dmg = {}; const charDmg = {}; const typeDmg = {};
  for (const s of res) {
    for (const [k, v] of Object.entries(s.m.cardPlays || {})) plays[k] = (plays[k] || 0) + v;
    for (const [k, v] of Object.entries(s.m.cardDmg || {})) dmg[k] = (dmg[k] || 0) + v;
    for (const side of ['player', 'enemy']) {
      for (const [k, v] of Object.entries(s.m.dmg?.[side] || {})) charDmg[k] = (charDmg[k] || 0) + v;
    }
  }
  console.log('Card use, all 1v1 pairings (' + N + ' each), tier ' + tier);
  console.log('| Card | Type | Cost | Plays | Dmg/play | Share of owner dmg |');
  console.log('|---|---|---|---|---|---|');
  for (const c of data.cards.cards) {
    const p = plays[c.id] || 0; const d = dmg[c.id] || 0;
    const share = charDmg[c.owner] ? d / charDmg[c.owner] : 0;
    console.log('| ' + c.id + ' | ' + c.type + ' | ' + c.cost + ' | ' + p + ' | ' + (p ? (d / p).toFixed(0) : '-') + ' | ' + pct(share) + ' |');
  }
}

async function selftest() {
  // L-shared-006: the harness must move when the data moves. Three deliberate breaks, each must shift the metric.
  const n = 400;
  const base = { cfg: { stageId: 'stage_003', team: STARTERS, playerTier: 'proxy_average' }, seed0: 777, count: n };
  const cases = [
    ['baseline', []],
    ['enemy ATK ×3 (enemy_umbral_rook_001..thessa_001)', ['enemy_umbral_rook_001', 'enemy_umbral_pell_001', 'enemy_thessa_001'].map((id) => ({ file: 'enemies', id, path: 'stat_mult.atk', value: 2.7 }))],
    ['player Tavi HP 100', [{ file: 'characters', id: 'char_tavi_001', path: 'base_stats.hp', value: 100 }]],
    ['vigor regen 0.25/s (stage_002)', [{ file: 'battle', path: 'vigor.regen_per_s', value: 0.25 }]],
  ];
  // The regen break is measured on stage_002, whose battles are short enough not to hit the timer (stage_003 lasts
  // ~140 s since the HP x2 change, so a slower game would only be capped at 180 s).
  const short = { cfg: { stageId: 'stage_002', team: STARTERS, playerTier: 'proxy_average' }, seed0: 777, count: n };
  const res = await runJobs(cases.map(([, p], i) => ({ ...(i === 3 ? short : base), patches: p })).concat([{ ...short, patches: [] }]));
  res[3].baseTimer = res[4].timerS;
  let ok = true;
  cases.forEach(([name], i) => console.log(name.padEnd(55) + ' win ' + pct(res[i].winRate) + '  avg timer ' + res[i].timerS.toFixed(1) + ' s'));
  if (!(res[1].winRate < res[0].winRate - 0.3)) { ok = false; console.log('FAIL: enemy ATK break did not lower the win rate'); }
  if (!(res[2].winRate < res[0].winRate)) { ok = false; console.log('FAIL: Tavi HP break did not lower the win rate'); }
  console.log('stage_002 baseline avg timer ' + res[4].timerS.toFixed(1) + ' s vs regen 0.25/s ' + res[3].timerS.toFixed(1) + ' s');
  if (!(res[3].timerS > res[4].timerS * 1.3)) { ok = false; console.log('FAIL: vigor regen break did not lengthen battles'); }
  let threw = false;
  try { (await import('./lib.mjs')).applyPatches(data, [{ file: 'cards', id: 'card_does_not_exist', path: 'power', value: 1 }]); } catch (e) { threw = true; console.log('bad patch id rejected: ' + e.message); }
  if (!threw) { ok = false; console.log('FAIL: unknown patch id was accepted silently'); }
  threw = false;
  try { (await import('./lib.mjs')).applyPatches(data, [{ file: 'cards', id: 'card_tavi_spark_jab', path: 'powr', value: 1 }]); } catch (e) { threw = true; console.log('bad patch field rejected: ' + e.message); }
  if (!threw) { ok = false; console.log('FAIL: unknown patch field was accepted silently'); }
  console.log(ok ? 'SELFTEST PASS' : 'SELFTEST FAIL');
  process.exitCode = ok ? 0 : 1;
}

async function missions() {
  // §9.3: for each stage mission, share of wins (per player proxy) in which it is met.
  const tiers = arg('--tiers', 'proxy_average,proxy_skilled').split(',');
  const jobs = [];
  for (const st of STAGES) for (const t of tiers) jobs.push({ cfg: { stageId: st, team: STARTERS, playerTier: t }, seed0: 1000000 * TIER_SEED[t] + 10000 * Number(st.slice(-3)) + Number(arg('--seed-offset', '0')), count: N, patches });
  const res = await runJobs(jobs);
  console.log('| Stage | Mission | ' + tiers.map((t) => t + ' share of wins').join(' | ') + ' |');
  console.log('|---|---|' + tiers.map(() => '---|').join(''));
  const d = applyPatchesSafe();
  STAGES.forEach((st, si) => {
    for (const mi of d.stages.stages.find((x) => x.id === st).missions || []) {
      console.log('| ' + st + ' | ' + mi.id + ' ' + mi.type + (mi.value !== undefined ? ' ' + mi.value : '') + ' | ' +
        tiers.map((t, ti) => { const s = res[si * tiers.length + ti]; return pct(s.win ? (s.missionCounts[mi.id] || 0) / s.win : 0); }).join(' | ') + ' |');
    }
  });
}

async function sweep() {
  // --sweep file.json: { "<name>": [patches...], ... }. Mirror win rate per character for each named patch set
  // (added on top of --patch), at each tier in --tiers. --rarity limits the characters (e.g. 3).
  const sets = JSON.parse(fs.readFileSync(arg('--sweep'), 'utf8'));
  const tiers = arg('--tiers', 'fighter,veteran').split(',');
  const rarity = arg('--rarity');
  const byR = {};
  for (const c of data.characters.characters) if (c.playable && (!rarity || String(c.rarity) === rarity)) (byR[c.rarity] = byR[c.rarity] || []).push(c.id);
  const jobs = []; const meta = [];
  for (const [name, extra] of Object.entries(sets)) for (const tier of tiers) {
    let seedBase = 5000000 + Number(arg('--seed-offset', '0'));
    for (const r of Object.keys(byR)) for (const a of byR[r]) for (const bId of byR[r]) {
      if (a === bId) continue;
      meta.push({ name, tier, a, b: bId });
      jobs.push({ cfg: { enemyTeam: ['simx_' + bId], timerS: 180, team: [a], playerTier: tier, enemyTier: tier }, seed0: seedBase, count: N, patches: patches.concat(extra), mirrorTier: tier });
      seedBase += 100000;
    }
  }
  const res = await runJobs(jobs);
  const agg = {};
  meta.forEach((mt, i) => {
    const s = res[i]; const k = mt.name + '|' + mt.tier;
    agg[k] = agg[k] || { score: {}, games: {}, len: 0, n: 0 };
    const g = agg[k];
    g.score[mt.a] = (g.score[mt.a] || 0) + s.win + 0.5 * s.draw; g.games[mt.a] = (g.games[mt.a] || 0) + s.n;
    g.score[mt.b] = (g.score[mt.b] || 0) + s.lose + 0.5 * s.draw; g.games[mt.b] = (g.games[mt.b] || 0) + s.n;
    g.len += s.timerS; g.n += 1;
  });
  const chars = Object.values(byR).flat();
  console.log('| Set | Tier | ' + chars.map((c) => c.replace('char_', '').replace('_001', '')).join(' | ') + ' | avg s |');
  console.log('|---|---|' + chars.map(() => '---|').join('') + '---|');
  for (const k of Object.keys(agg)) {
    const g = agg[k]; const [name, tier] = k.split('|');
    console.log('| ' + name + ' | ' + tier + ' | ' + chars.map((c) => { const w = g.score[c] / g.games[c]; return (w > 0.6 || w < 0.4 ? '**' : '') + pct(w) + (w > 0.6 || w < 0.4 ? '**' : ''); }).join(' | ') + ' | ' + (g.len / g.n).toFixed(1) + ' |');
  }
}

async function stagesweep() {
  // --sweep file.json { name: [patches] } on top of --patch; --stages a,b; --tiers t1,t2. Starter team.
  const sets = JSON.parse(fs.readFileSync(arg('--sweep'), 'utf8'));
  const tiers = arg('--tiers', 'proxy_average,proxy_skilled').split(',');
  const sts = arg('--stages', STAGES.join(',')).split(',');
  const jobs = []; const meta = [];
  for (const [name, extra] of Object.entries(sets)) for (const st of sts) for (const t of tiers) {
    meta.push({ name, st, t, extra });
    jobs.push({ cfg: { stageId: st, team: STARTERS, playerTier: t }, seed0: 1000000 * TIER_SEED[t] + 10000 * Number(st.slice(-3)) + Number(arg('--seed-offset', '0')), count: N, patches: patches.concat(extra) });
  }
  const res = await runJobs(jobs);
  console.log('| Set | Stage | Player | Win | KO median s | Timeouts | Tri-Burst median | time mission |');
  console.log('|---|---|---|---|---|---|---|---|');
  meta.forEach((mt, i) => {
    const s = res[i];
    const tm = timeMission(mt.st, s, applyPatches(data, patches.concat(mt.extra)));
    console.log('| ' + mt.name + ' | ' + mt.st + ' | ' + mt.t + ' | ' + pct(s.winRate) + ' | ' + (isNaN(s.koMedianS) ? '-' : s.koMedianS.toFixed(0)) + ' | ' + pct(s.timeout / s.n) + ' | ' + (s.tbN ? pct(s.tbMedian) : '-') + ' | ' + (tm ? '<' + tm.value + ': ' + pct(tm.share) : '-') + ' |');
  });
}
function meanHp(s) { return s.playerHpSum / s.n; }

const t0 = Date.now();
await ({ stages, mirror, cards, selftest, sweep, stagesweep, missions }[cmd] || (() => { console.log('unknown command ' + cmd); }))();
console.error('(' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
