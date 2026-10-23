// ui-developer round 3: Summon screen view-model (GDD §11.1) and every SUMMON_* enum → string (L-shared-009).
// Numbers come from data (the balance-analyst may change them): expectations are derived from banners.json /
// economy.json, never typed in.
import { describe, it, expect } from 'vitest';
import {
  createContent,
  summon,
  getBannerRates,
  SUMMON_REJECT_REASONS,
  SUMMON_OUTCOMES,
  SUMMON_GUARANTEES,
  SUMMON_EVENT_TYPES,
} from '../../src/logic/index.js';
import { summonScreenModel, rateTableModel, outcomeTag, guaranteeText, rejectText, eventText, outcomeKey, guaranteeKey, reasonKey, eventKey, formatNum } from '../../src/ui/summon-view.js';
import { BURST_VISUALS, BURST_LABEL_KEYS, burstVisual } from '../../src/ui/hud-state.js';
import { hasString } from '../../src/ui/strings.js';
import { loadBundle, readJson } from '../helpers/load-data.js';
import table from '../../src/ui/strings.json';

const bundle = loadBundle();
bundle.economy = readJson('data/economy.json');
bundle.banners = readJson('data/banners.json');
const content = createContent(bundle);
const banner = bundle.banners.banners[0];
const NOW = '2026-10-22T12:00:00.000Z';
const JADE = 'Jade';

function freshSave(jade) {
  const e = bundle.economy;
  return {
    version: 1, created_at: NOW, updated_at: NOW,
    currencies: Object.assign({}, e.starting.currencies, jade === undefined ? {} : { cur_jade: jade }),
    roster: e.starting.characters.map((id) => ({ character_id: id, resonance: 0, obtained_at: NOW })),
    team: e.starting.team.slice(), stages: {}, summon: { pity: {}, first_multi_done: {}, total_pulls: 0 },
    settings: { bgm_volume: 1, sfx_volume: 1, haptics: true }, tutorial: { completed: false },
  };
}
const noRaw = (s) => typeof s === 'string' && !/\[[a-z0-9_]+\]/.test(s) && !/\{[a-z]+\}/.test(s);

describe('L-shared-009: every SUMMON_* value exported by src/logic maps to a string', () => {
  const lists = [
    ['SUMMON_REJECT_REASONS', SUMMON_REJECT_REASONS, reasonKey],
    ['SUMMON_OUTCOMES', SUMMON_OUTCOMES, outcomeKey],
    ['SUMMON_GUARANTEES', SUMMON_GUARANTEES, guaranteeKey],
    ['SUMMON_EVENT_TYPES', SUMMON_EVENT_TYPES, eventKey],
  ];
  for (const [name, list, key] of lists) {
    it(`${name}: ${list.join(', ')}`, () => {
      expect(list.length).toBeGreaterThan(0);
      expect(list.filter((v) => !hasString(key(v)))).toEqual([]);
    });
  }
  it('the produced texts have no raw [key] or {placeholder}', () => {
    for (const r of SUMMON_REJECT_REASONS) expect(noRaw(rejectText(r)), r).toBe(true);
    for (const o of SUMMON_OUTCOMES) expect(noRaw(outcomeTag({ outcome: o, resonance_after: 2, jade_added: 0 })), o).toBe(true);
    for (const g of SUMMON_GUARANTEES) expect(noRaw(guaranteeText(g, banner.multi_count)), g).toBe(true);
    for (const e of SUMMON_EVENT_TYPES) expect(noRaw(eventText({ type: e, amount: 1, pull: 1, lost: 3 }, JADE)), e).toBe(true);
  });
  it('must-FAIL: a value with no key is reported (the check is not blind)', () => {
    const list = SUMMON_OUTCOMES.concat(['future_outcome']);
    expect(list.filter((v) => !hasString(outcomeKey(v)))).toEqual(['future_outcome']);
  });
  it('TRI-BURST: every visual state has a label key, and locked/ready/charging differ', () => {
    expect(BURST_VISUALS.filter((v) => !hasString(BURST_LABEL_KEYS[v]))).toEqual([]);
    const base = { burst: 100, burstMax: 100, burstUsed: false, burstReady: true };
    expect(burstVisual(base)).toBe('ready');
    expect(burstVisual({ ...base, burstReady: false })).toBe('locked');
    expect(burstVisual({ ...base, burst: 40, burstReady: false })).toBe('charging');
    expect(burstVisual({ ...base, burstUsed: true, burstReady: false })).toBe('used');
    expect(table.strings[BURST_LABEL_KEYS.locked]).not.toBe(table.strings[BURST_LABEL_KEYS.ready]);
  });
});

describe('Results tags (§11.1/§11.4)', () => {
  it('NEW, "Resonance +1 (Rn)" with the new rank, "+N Jade" with the credited amount (0 allowed)', () => {
    expect(outcomeTag({ outcome: 'new', resonance_after: 0, jade_added: 0 })).toBe(table.strings.summon_outcome_new);
    expect(outcomeTag({ outcome: 'resonance', resonance_after: 3, jade_added: 0 })).toBe('Resonance +1 (R3)');
    expect(outcomeTag({ outcome: 'jade', resonance_after: 4, jade_added: 0 })).toBe('+0 Jade');
    expect(outcomeTag({ outcome: 'jade', resonance_after: 4, jade_added: 1200 })).toBe('+1,200 Jade');
  });
  it('a real ×10 on a fresh save: every result gets a non-empty tag', () => {
    const r = summon(freshSave(banner.cost_multi), banner.id, banner.multi_count, content, { nowIso: NOW, seed: 7 });
    expect(r.ok).toBe(true);
    expect(r.results.map(outcomeTag).filter((s) => !s)).toEqual([]);
  });
});

describe('AC-11.6 affordability (costs from data)', () => {
  const m = (jade) => summonScreenModel(freshSave(jade), content, NOW, JADE).buttons.map((b) => b.ok);
  it('cost_multi − 1 → ×10 off, ×1 on; cost_multi → ×10 on; cost_single − 1 → both off; cost_single → ×1 on', () => {
    expect(m(banner.cost_multi - 1)).toEqual([true, false]);
    expect(m(banner.cost_multi)).toEqual([true, true]);
    expect(m(banner.cost_single - 1)).toEqual([false, false]);
    expect(m(banner.cost_single)[0]).toBe(true);
  });
  it('labels show count and cost; a disabled button says how to earn more', () => {
    const b = summonScreenModel(freshSave(banner.cost_single - 1), content, NOW, JADE).buttons;
    expect(b[0].label).toBe(`Summon ×1 (${formatNum(banner.cost_single)} Jade)`);
    expect(b[1].label).toBe(`Summon ×${banner.multi_count} (${formatNum(banner.cost_multi)} Jade)`);
    expect(b[0].sublabel).toBe('Not enough Jade — clear stages to earn more.');
    const ok = summonScreenModel(freshSave(banner.cost_multi), content, NOW, JADE).buttons[1];
    expect(ok.confirmText).toBe(`Summon ×${banner.multi_count} for ${formatNum(banner.cost_multi)} Jade?\nJade after: 0`);
  });
});

describe('AC-11.11 pity and first-×10 lines', () => {
  const hard = banner.pity.hard_pity;
  it('fresh save: N = hard_pity and the first-×10 line', () => {
    const m = summonScreenModel(freshSave(), content, NOW, JADE);
    expect(m.pityText).toBe(`★5 guaranteed within ${hard} summons.`);
    expect(m.firstMultiText).toBe(`First ×${banner.multi_count}: at least one ★${banner.first_multi_min_rarity} guaranteed!`);
  });
  it('after 3 non-★5 pulls N = hard − 3; after a ×10 the first-×10 line is gone; counter ≥ hard − 1 → N = 1', () => {
    const s = freshSave();
    s.summon.pity[banner.pity.group] = 3;
    expect(summonScreenModel(s, content, NOW, JADE).pityText).toBe(`★5 guaranteed within ${hard - 3} summons.`);
    s.summon.first_multi_done[banner.id] = true;
    expect(summonScreenModel(s, content, NOW, JADE).firstMultiText).toBeNull();
    s.summon.pity[banner.pity.group] = hard + 5;
    expect(summonScreenModel(s, content, NOW, JADE).pityText).toBe('★5 guaranteed within 1 summons.');
  });
});

describe('AC-11.13 availability (test data)', () => {
  it('a banner whose end_at is past → no banner, the "No summons" text', () => {
    const closed = JSON.parse(JSON.stringify(bundle.banners));
    closed.banners.forEach((b) => (b.end_at = '2020-01-01T00:00:00.000Z'));
    const c2 = createContent(Object.assign({}, bundle, { banners: closed }));
    const m = summonScreenModel(freshSave(), c2, NOW, JADE);
    expect(m.banner).toBeNull();
    expect(m.noneText).toBe('No summons available right now.');
    expect(m.buttons).toBeUndefined();
  });
});

describe('AC-11.4 rate table', () => {
  it('per rarity and per fighter, from getBannerRates, plus the rounding note and the rules', () => {
    const rates = getBannerRates(banner.id, content);
    const R = rateTableModel(rates, content.characters, bundle.economy);
    const rar = R.rows.filter((r) => r.kind === 'rarity');
    expect(rar.map((r) => r.rarity)).toEqual(rates.rarities.map((r) => r.rarity));
    for (const r of rates.rarities) expect(rar.find((x) => x.rarity === r.rarity).percent).toBe(r.percentText + '%');
    const fighters = R.rows.filter((r) => r.kind === 'fighter');
    expect(fighters.length).toBe(banner.pool.length);
    for (const f of rates.fighters) expect(fighters.find((x) => x.characterId === f.characterId).percent).toBe(f.percentText + '%');
    expect(R.rules[0]).toBe('Fighter rates are rounded to 2 decimals.');
    expect(R.rules.every(noRaw)).toBe(true);
    expect(R.rules.join(' ')).toContain(String(banner.pity.hard_pity));
  });
});
