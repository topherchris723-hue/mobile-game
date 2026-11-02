// Reviewer gacha check: displayed rates vs real rates, pity, multi guarantees. Uses the shipped summon() logic.
import fs from 'node:fs';
import { createContent, summon, getBannerRates } from './src/logic/index.js';
import { createFreshSave } from './src/state/save.js';

const read = (f) => JSON.parse(fs.readFileSync('data/' + f, 'utf8'));
const economy = read('economy.json');
const content = createContent({ battle: read('battle.json'), characters: read('characters.json'), cards: read('cards.json'),
  enemies: read('enemies.json'), stages: read('stages.json'), economy, banners: read('banners.json') });
const BID = 'banner_starter_001';
const NOW = '2026-10-24T00:00:00.000Z';
const shown = getBannerRates(BID, content);
const out = { shown: { rarities: shown.rarities, fighters: shown.fighters.map((f) => ({ id: f.characterId, percentText: f.percentText })) } };

function fresh() { const s = createFreshSave(economy, NOW); return s; }
function setJade(s, n) { s.currencies.cur_jade = n; return s; }

// 1) base rates: 200k singles, pity reset to 0 before every pull
const N = 200000;
const rc = { 3: 0, 4: 0, 5: 0 }; const fc = {};
let s = setJade(fresh(), 500000);
for (let i = 0; i < N; i++) {
  s.summon = s.summon || {}; s.summon.pity = { standard: 0 };
  setJade(s, 500000);
  const r = summon(s, BID, 1, content, { nowIso: NOW, seed: (i * 2654435761) >>> 0 });
  if (!r.ok) throw new Error('reject ' + r.reason);
  const p = r.results[0]; rc[p.rarity]++; fc[p.character_id] = (fc[p.character_id] || 0) + 1;
  s = r.saveAfter;
}
out.base = { N, rarityPct: Object.fromEntries(Object.entries(rc).map(([k, v]) => [k, +(100 * v / N).toFixed(3)])),
  fighterPct: Object.fromEntries(Object.entries(fc).map(([k, v]) => [k, +(100 * v / N).toFixed(3)])) };
// 3-sigma check
out.base.fails = [];
for (const r of shown.rarities) { const p = r.bp / 10000; const sd = Math.sqrt(p * (1 - p) / N) * 100; const m = 100 * rc[r.rarity] / N; if (Math.abs(m - p * 100) > 4 * sd) out.base.fails.push({ rarity: r.rarity, shown: p * 100, measured: m }); }
for (const f of shown.fighters) { const p = f.exactBp / 10000; const sd = Math.sqrt(p * (1 - p) / N) * 100; const m = 100 * (fc[f.characterId] || 0) / N; if (Math.abs(m - p * 100) > 4 * sd) out.base.fails.push({ id: f.characterId, shown: p * 100, measured: m }); }

// 2) pity: 100k chained singles, no resets
s = setJade(fresh(), 500000); let gap = 0, maxGap = 0, five = 0; const gaps = {};
for (let i = 0; i < 100000; i++) {
  setJade(s, 500000);
  const r = summon(s, BID, 1, content, { nowIso: NOW, seed: (i * 40503 + 7) >>> 0 });
  gap++; if (r.results[0].rarity === 5) { five++; gaps[gap] = (gaps[gap] || 0) + 1; maxGap = Math.max(maxGap, gap); gap = 0; }
  s = r.saveAfter;
}
out.pity = { maxGapBetween5: maxGap, count5: five, pctAt40: +(100 * (gaps[40] || 0) / five).toFixed(2), effective5Pct: +(100 * five / 100000).toFixed(3) };

// 3) multis: 5k fresh saves, first x10 must contain a 5; later x10 must contain >=4
let firstFail = 0, multiFail = 0, firstNoFive = 0, jadeOk = 0;
for (let i = 0; i < 5000; i++) {
  let sv = setJade(fresh(), 1000);
  const r1 = summon(sv, BID, 10, content, { nowIso: NOW, seed: (i * 911 + 3) >>> 0 });
  if (!r1.ok) { firstFail++; continue; }
  if (r1.jade_before - r1.jade_after + r1.results.reduce((a, x) => a + x.jade_added, 0) === 1000) jadeOk++;
  if (!r1.results.some((x) => x.rarity === 5)) firstNoFive++;
  sv = setJade(r1.saveAfter, 1000);
  const r2 = summon(sv, BID, 10, content, { nowIso: NOW, seed: (i * 977 + 5) >>> 0 });
  if (!r2.results.some((x) => x.rarity >= 4)) multiFail++;
}
out.multi = { runs: 5000, rejected: firstFail, firstX10Without5: firstNoFive, laterX10Without4: multiFail, costConsistent: jadeOk };
// 4) insufficient jade rejected and does not charge
const poor = setJade(fresh(), 50);
const rp = summon(poor, BID, 1, content, { nowIso: NOW, seed: 1 });
out.poor = { ok: rp.ok, reason: rp.reason, jadeAfter: rp.saveAfter.currencies.cur_jade };
console.log(JSON.stringify(out, null, 1));
