#!/usr/bin/env node
// QA AC-8.2(b): for seeds 1–200 on every stage with an Umbral (variant) enemy, the battle event-log hash is identical
// with every `variant` field removed from enemies.json. QA_BREAK=reads simulates logic that reads `variant`
// (Umbral enemies get +1 DEF in the content copy that still has the field) and must FAIL.
import fs from 'node:fs';
import { createBattle, createContent } from '../../src/logic/index.js';
const read = (f) => JSON.parse(fs.readFileSync(new URL('../../data/' + f, import.meta.url)));
const D = { battle: read('battle.json'), characters: read('characters.json'), cards: read('cards.json'), enemies: read('enemies.json'), stages: read('stages.json'), economy: read('economy.json') };
const noVar = JSON.parse(JSON.stringify(D));
noVar.enemies.enemies.forEach((e) => delete e.variant);
const withVar = createContent(D);
const without = createContent(noVar);
if (process.env.QA_BREAK === 'reads') for (const e of D.enemies.enemies) if (e.variant) withVar.enemies[e.id] = { ...withVar.enemies[e.id], stat_mult: { ...withVar.enemies[e.id].stat_mult, def: withVar.enemies[e.id].stat_mult.def + 0.01 } };
const umbralIds = new Set(D.enemies.enemies.filter((e) => e.variant).map((e) => e.id));
const stages = D.stages.stages.filter((s) => s.enemy_team.some((id) => umbralIds.has(id))).map((s) => s.id);
function hash(content, stageId, seed) {
  const b = createBattle({ content, stageId, playerTeam: D.economy.starting.team, playerController: { aiTier: 'fighter' }, skipIntro: true }, seed);
  let h = 2166136261;
  let n = 0;
  while (!b.getResult() && n++ < 200000) for (const e of b.step()) { const s = JSON.stringify(e); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; }
  return h;
}
let diff = 0;
for (const st of stages) for (let seed = 1; seed <= 200; seed++) if (hash(withVar, st, seed) !== hash(without, st, seed)) { diff++; if (diff <= 3) console.log('DIFF ' + st + ' seed ' + seed); }
console.log((diff ? 'FAIL' : 'PASS') + ` AC-8.2(b): stages ${stages.join(',')} × seeds 1–200 = ${stages.length * 200} battles, ${diff} hash differences`);
process.exitCode = diff ? 1 : 0;
