#!/usr/bin/env node
// QA AC-5.10.7 (P, live data): seeds 1–N, master vs master on stage_004 and stage_005 (+ stage_005 seeds 90, 3345).
// Every tri_burst_start on tick T → exactly one tri_burst/tri_burst_whiff on T+18 unless the battle ended in T..T+17;
// 0 safety_net whiffs; 0 KO of a fighter whose team has a rush in progress; 0 ignition cancels of a rush.
// QA_BREAK=late shifts the expected resolve to T+19 to prove the check fails.
import fs from 'node:fs';
import { createBattle, createContent } from '../../src/logic/index.js';
const read = (f) => JSON.parse(fs.readFileSync(new URL('../../data/' + f, import.meta.url)));
const D = { battle: read('battle.json'), characters: read('characters.json'), cards: read('cards.json'), enemies: read('enemies.json'), stages: read('stages.json'), economy: read('economy.json') };
const content = createContent(D);
const N = Number(process.argv[2] || 1000);
const RUSH = Math.round(D.battle.burst.rush_time_s * 60) + (process.env.QA_BREAK === 'late' ? 1 : 0);
const jobs = [];
for (const st of ['stage_004', 'stage_005']) for (let s = 1; s <= N; s++) jobs.push([st, s]);
jobs.push(['stage_005', 90], ['stage_005', 3345]);
let rushes = 0, fails = 0;
const reasons = {};
for (const [stageId, seed] of jobs) {
  const b = createBattle({ content, stageId, playerTeam: D.economy.starting.team, playerController: { aiTier: 'master' }, enemyController: { aiTier: 'master' }, skipIntro: true }, seed);
  const pend = { player: null, enemy: null };
  const bad = [];
  let guard = 0;
  while (!b.getResult() && guard++ < 200000) {
    for (const e of b.step()) {
      if (e.type === 'tri_burst_start') { if (pend[e.side] !== null) bad.push('double start'); pend[e.side] = e.tick; rushes++; }
      if (e.type === 'tri_burst' || e.type === 'tri_burst_whiff') {
        if (pend[e.side] === null) bad.push(e.type + ' without start');
        else if (e.tick - pend[e.side] !== RUSH) bad.push(e.type + ' at T+' + (e.tick - pend[e.side]));
        pend[e.side] = null;
        if (e.type === 'tri_burst_whiff' && e.reason === 'safety_net') bad.push('safety_net whiff');
      }
      if (e.type === 'ko' && pend[e.side] !== null) bad.push('KO during own rush');
      if (e.type === 'card_cancelled' && e.reason === 'ignition' && (e.cardId === 'tri_burst' || !e.cardId)) bad.push('ignition cancelled a rush');
    }
  }
  const r = b.getResult();
  if (!r) bad.push('never ended');
  else {
    reasons[r.reason] = (reasons[r.reason] || 0) + 1;
    for (const side of ['player', 'enemy']) if (pend[side] !== null && !(r.ticks - 1 <= pend[side] + 17)) bad.push(side + ' rush unresolved');
  }
  if (bad.length) { fails++; if (fails <= 5) console.log('FAIL ' + stageId + ' seed ' + seed + ': ' + bad.slice(0, 3).join('; ')); }
}
console.log((fails ? 'FAIL' : 'PASS') + ` AC-5.10.7: ${jobs.length} battles, ${rushes} rushes, ${fails} failing battles, end reasons ${JSON.stringify(reasons)}`);
process.exitCode = fails ? 1 : 0;
