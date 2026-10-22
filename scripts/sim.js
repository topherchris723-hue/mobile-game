#!/usr/bin/env node
// Headless AI-vs-AI battle runner (GDD §5.0). No renderer.
// Usage: node scripts/sim.js [--stage stage_001] [--seed 1] [--count 1] [--player-tier fighter]
//        [--team char_a,char_b,char_c] [--json]
// Prints one line per battle and a summary. Running the same seed twice gives identical output.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBattle, createContent } from '../src/logic/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8'));

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

/** Run one battle to completion. Returns { result, realTicks, digest }. */
export function runBattle(content, opts, seed) {
  const battle = createBattle({
    content: content,
    stageId: opts.stageId,
    playerTeam: opts.team,
    playerController: { aiTier: opts.playerTier },
    skipIntro: true,
  }, seed);
  let realTicks = 0;
  let hash = 2166136261;
  const maxTicks = 60 * 60 * 30; // safety stop (30 min of real ticks)
  while (!battle.getResult() && realTicks < maxTicks) {
    const evs = battle.step();
    realTicks += 1;
    for (const e of evs) {
      const s = e.type + (e.damage || 0) + e.tick;
      for (let i = 0; i < s.length; i++) hash = Math.imul(hash ^ s.charCodeAt(i), 16777619) >>> 0;
    }
  }
  return { result: battle.getResult(), realTicks: realTicks, digest: hash.toString(16) };
}

function main() {
  const content = createContent({
    battle: read('battle.json'), characters: read('characters.json'), cards: read('cards.json'),
    enemies: read('enemies.json'), stages: read('stages.json'), economy: read('economy.json'),
  });
  const economy = read('economy.json');
  const opts = {
    stageId: arg('--stage', 'stage_001'),
    team: arg('--team', economy.starting.team.join(',')).split(','),
    playerTier: arg('--player-tier', 'fighter'),
  };
  const seed = Number(arg('--seed', '1'));
  const count = Number(arg('--count', '1'));
  const asJson = process.argv.indexOf('--json') >= 0;
  const tally = { win: 0, lose: 0, draw: 0 };
  let totalS = 0;
  const rows = [];
  for (let i = 0; i < count; i++) {
    const r = runBattle(content, opts, seed + i);
    tally[r.result.outcome] += 1;
    totalS += r.result.timeElapsedS;
    const row = {
      seed: seed + i, outcome: r.result.outcome, reason: r.result.reason,
      timerS: r.result.timeElapsedS, realS: Math.round((r.realTicks / 60) * 10) / 10,
      playerHp: Math.round(r.result.playerHpRatio * 1000) / 1000, enemyHp: Math.round(r.result.enemyHpRatio * 1000) / 1000,
      digest: r.digest,
    };
    rows.push(row);
    if (!asJson && count <= 20) {
      console.log('seed=' + row.seed + ' ' + row.outcome + ' (' + row.reason + ') timer=' + row.timerS.toFixed(2) + 's real=' + row.realS +
        's playerHp=' + row.playerHp + ' enemyHp=' + row.enemyHp + ' digest=' + row.digest);
    }
  }
  const summary = { stage: opts.stageId, playerTier: opts.playerTier, team: opts.team, battles: count, ...tally,
    winRate: tally.win / count, avgTimerS: Math.round((totalS / count) * 10) / 10 };
  if (asJson) console.log(JSON.stringify({ summary: summary, battles: rows }, null, 2));
  else console.log('SUMMARY ' + JSON.stringify(summary));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
