#!/usr/bin/env node
// GDD §6 stat bands, §6 Ignition guidance, §7 card power budgets and §8 stat_mult range check (balance-analyst).
// npm run validate-data does not check these (round 3 finding), so every balance change is checked here.
// Usage: node tests/sim/balance/bands.mjs [--patch p.json]   Exit 1 on any violation.
import fs from 'node:fs';
import { loadData, applyPatches } from './lib.mjs';

const i = process.argv.indexOf('--patch');
const d = applyPatches(loadData(), i >= 0 ? JSON.parse(fs.readFileSync(process.argv[i + 1], 'utf8')) : []);
const errs = [];
const inR = (v, lo, hi, what) => { if (!(v >= lo - 1e-9 && v <= hi + 1e-9)) errs.push(what + ' = ' + v + ' outside [' + lo + ', ' + hi + ']'); };

const BANDS = { // §6
  3: { hp: [8000, 9000], atk: [850, 950], def: [400, 480], crit_rate: [0.05, 0.05] },
  4: { hp: [9000, 10000], atk: [950, 1050], def: [450, 530], crit_rate: [0.05, 0.08] },
  5: { hp: [10000, 11000], atk: [1050, 1150], def: [500, 580], crit_rate: [0.05, 0.10] },
};
const ignitionCards = new Set();
const baseCards = new Set();
for (const c of d.characters.characters) {
  for (const e of c.deck) baseCards.add(e.card_id);
  if (c.ignition) for (const e of c.ignition.deck) ignitionCards.add(e.card_id);
  if (!c.playable) continue;
  const b = BANDS[c.rarity];
  for (const k of Object.keys(b)) inR(c.base_stats[k] ?? 0.05, b[k][0], b[k][1], c.id + '.base_stats.' + k);
  const g = c.ignition;
  if (g) {
    inR(g.stat_mult.atk, 1.2, 1.4, c.id + '.ignition.stat_mult.atk');
    inR(g.stat_mult.def, 1.1, 1.3, c.id + '.ignition.stat_mult.def');
    inR(g.duration_s, 20, 30, c.id + '.ignition.duration_s');
    inR(g.heal_pct, 0.05, 0.15, c.id + '.ignition.heal_pct');
    inR(g.vigor_regen_bonus, 0, 0.3, c.id + '.ignition.vigor_regen_bonus');
    for (const t of g.triggers) {
      if (t.type === 'hp_below_pct') inR(t.value, 40, 60, c.id + '.ignition.trigger.hp_below_pct');
      if (t.type === 'battle_time_s') inR(t.value, 60, 100, c.id + '.ignition.trigger.battle_time_s');
    }
  }
}
for (const c of d.cards.cards) { // §7
  const fx = (c.effects || []).length * 0.3;
  const id = c.id + '.power';
  if (c.type === 'fist') { inR(c.cost, 2, 2, c.id + '.cost'); inR(c.power, 1.0 - fx, 1.3 - fx, id); }
  if (c.type === 'bolt') { inR(c.cost, 3, 3, c.id + '.cost'); inR(c.power, 1.4 - fx, 1.7 - fx, id); }
  if (c.type === 'signature') { inR(c.cost, 4, 6, c.id + '.cost'); inR(c.power, c.cost * 0.55 - fx, c.cost * 0.65 - fx, id); }
  if (c.type === 'climax') {
    inR(c.cost, 7, 8, c.id + '.cost');
    const ign = ignitionCards.has(c.id) && !baseCards.has(c.id);
    inR(c.power, (ign ? 6.5 : 5.0) - fx, (ign ? 7.5 : 6.0) - fx, id);
  }
}
for (const e of d.enemies.enemies) for (const k of ['hp', 'atk', 'def']) inR(e.stat_mult[k], 0.3, 5.0, e.id + '.stat_mult.' + k); // §8
if (errs.length) { for (const e of errs) console.log('BAND FAIL ' + e); console.log('bands: FAIL (' + errs.length + ')'); process.exitCode = 1; }
else console.log('bands: PASS — ' + d.characters.characters.length + ' characters, ' + d.cards.cards.length + ' cards, ' + d.enemies.enemies.length + ' enemies inside GDD §6/§7/§8');
