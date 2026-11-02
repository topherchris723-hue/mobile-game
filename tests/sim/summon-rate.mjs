#!/usr/bin/env node
// QA item 8 / L-qa-004: summon draw rates match data. N seeded ×1 summons through the public summon() on a save with
// pity 0 and the first ×10 done (so every pull is a normal draw, GDD §11.3 rule 3). Expected shares are computed
// independently from data/banners.json + characters.json with the GDD §11.2 weight formula (not from the logic code).
// Pass: each rarity and each fighter within ±0.5 pp of its exact rate (N = 100,000 → SE ≤ 0.13 pp).
// QA_BREAK=skew raises ★5 to 600 bp in the logic's copy only, to prove the check fails.
import fs from 'node:fs';
import { createContent } from '../../src/logic/index.js';
import { summon } from '../../src/logic/summon.js';
const read = (f) => JSON.parse(fs.readFileSync(new URL('../../data/' + f, import.meta.url)));
const D = { battle: read('battle.json'), characters: read('characters.json'), cards: read('cards.json'), enemies: read('enemies.json'), stages: read('stages.json'), economy: read('economy.json'), banners: read('banners.json') };
const banner = JSON.parse(JSON.stringify(D.banners.banners[0]));
const logicData = JSON.parse(JSON.stringify(D));
if (process.env.QA_BREAK === 'skew') { const r = logicData.banners.banners[0].rates_bp; r['5'] = 600; r['3'] -= 300; }
const content = createContent(logicData);
const N = Number(process.argv[2] || 100000);
const chars = Object.fromEntries(D.characters.characters.map((c) => [c.id, c]));
// independent expectation (GDD §11.2)
const expect = {};
for (const k of ['3', '4', '5']) {
  const bp = banner.rates_bp[k] || 0;
  expect['★' + k] = bp / 100;
  const F = banner.featured.filter((f) => chars[f.character_id].rarity === Number(k));
  const P = banner.pool.filter((id) => chars[id].rarity === Number(k) && !F.some((f) => f.character_id === id));
  const S = F.reduce((a, f) => a + f.share_bp, 0);
  const n = P.length;
  const W = n > 0 ? 10000 * n : S;
  for (const f of F) expect[f.character_id] = (bp * (n > 0 ? f.share_bp * n : f.share_bp)) / W / 100;
  for (const id of P) expect[id] = (bp * (10000 - S)) / W / 100;
}
const base = { version: 1, created_at: '2026-10-23T00:00:00.000Z', updated_at: '2026-10-23T00:00:00.000Z', currencies: { cur_jade: 999999 },
  roster: D.economy.starting.characters.map((id) => ({ character_id: id, resonance: 0, obtained_at: '2026-10-23T00:00:00.000Z' })), team: D.economy.starting.team.slice(), stages: {},
  summon: { pity: {}, first_multi_done: { [banner.id]: true }, total_pulls: 0 }, settings: { master_volume: 1, bgm_volume: 1, sfx_volume: 1, muted: false, haptics: true, reduce_motion: false }, tutorial: { completed: true } };
const got = {};
for (let s = 1; s <= N; s++) {
  const r = summon(base, banner.id, 1, content, { nowIso: '2026-10-23T00:00:00.000Z', seed: s });
  if (!r.ok) throw new Error('summon rejected: ' + r.reason);
  const p = r.results[0];
  if (p.guarantee !== 'none') throw new Error('not a normal draw: ' + p.guarantee);
  got['★' + p.rarity] = (got['★' + p.rarity] || 0) + 1;
  got[p.character_id] = (got[p.character_id] || 0) + 1;
}
let bad = 0;
for (const k of Object.keys(expect)) {
  const m = (100 * (got[k] || 0)) / N;
  const ok = Math.abs(m - expect[k]) <= 0.5;
  if (!ok) bad++;
  console.log((ok ? 'PASS ' : 'FAIL ') + (chars[k] ? chars[k].name : k).padEnd(10) + ' measured ' + m.toFixed(2) + '%  data ' + expect[k].toFixed(2) + '%');
}
console.log((bad ? 'FAIL' : 'PASS') + ` summon rates: ${N} normal ×1 draws, ${bad} out of ±0.5 pp`);
process.exitCode = bad ? 1 : 0;
