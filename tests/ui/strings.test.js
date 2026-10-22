// ui-developer: every enum the logic or data can emit that the UI turns into a string key has that key
// (BUG-2-07: "[result_reason_double_ko]" was shown on the Result screen).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson } from '../helpers/load-data.js';
import table from '../../src/ui/strings.json';

const keys = new Set(Object.keys(table.strings));
const battleSrc = fs.readFileSync(path.join(ROOT, 'src/logic/battle.js'), 'utf8');

/** Every finish('<outcome>', '<reason>') call in the battle engine. */
export function resultEnums(src) {
  const out = { outcomes: new Set(), reasons: new Set() };
  for (const m of src.matchAll(/\bfinish\(\s*(?:'([a-z_]+)'|(?:[^()']|\([^()]*\))+?)\s*,\s*'([a-z_]+)'\s*\)/g)) {
    if (m[1]) out.outcomes.add(m[1]);
    out.reasons.add(m[2]);
  }
  return out;
}

export function missingKeys(enums, keySet) {
  const miss = [];
  for (const r of enums.reasons) if (!keySet.has('result_reason_' + r)) miss.push('result_reason_' + r);
  for (const o of enums.outcomes) if (!keySet.has('result_' + o)) miss.push('result_' + o);
  return miss;
}

describe('UI string keys for logic/data enums', () => {
  it('finds the result reasons in the engine (the scanner is not blind)', () => {
    const e = resultEnums(battleSrc);
    for (const r of ['ko', 'timeout', 'retreat', 'double_ko']) expect(e.reasons.has(r)).toBe(true);
    expect(e.outcomes.has('draw')).toBe(true);
  });

  it('every result reason and outcome has a string (result_reason_<r>, result_<o>)', () => {
    const e = resultEnums(battleSrc);
    for (const o of ['win', 'lose', 'draw']) e.outcomes.add(o); // timeout outcome comes from a helper
    expect(missingKeys(e, keys)).toEqual([]);
  });

  it('the check fails on a reason with no key', () => {
    const fake = resultEnums("this.finish('draw', 'double_ko'); this.finish('lose', 'surrender_new');");
    expect(missingKeys(fake, keys)).toEqual(['result_reason_surrender_new']);
  });

  it('every card type and aura in the schemas has a string (card_type_<t>, aura_<a>)', () => {
    const cards = readJson('data/schemas/cards.schema.json');
    const chars = readJson('data/schemas/characters.schema.json');
    const types = JSON.stringify(cards).match(/"enum":\["fist"[^\]]*\]/)[0].match(/"([a-z_]+)"/g).slice(1).map((s) => s.slice(1, -1));
    const auras = JSON.stringify(chars).match(/"aura":\{"enum":\[[^\]]*\]/)[0].match(/"([a-z_]+)"/g).slice(2).map((s) => s.slice(1, -1));
    expect(types.length).toBeGreaterThan(2);
    expect(auras.length).toBe(5);
    const miss = [...types.map((x) => 'card_type_' + x), ...auras.map((x) => 'aura_' + x)].filter((k) => !keys.has(k));
    expect(miss).toEqual([]);
  });
});
