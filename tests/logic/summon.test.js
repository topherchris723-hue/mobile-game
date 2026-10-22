// GDD §11 Summon (gacha) logic: rates, guarantees, pity, duplicates, cost, anti-reroll, determinism.
// Every number comes from data/banners.json and data/economy.json (balance-analyst may change them),
// so nothing here hardcodes a current data value.
import { describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  createContent,
  createBattle,
  SeededRng,
  summon,
  checkSummon,
  drawPull,
  getBannerRates,
  getPityStatus,
  summonRngForPull,
  bpToPercentText,
  SUMMON_REJECT_REASONS,
  SUMMON_OUTCOMES,
  SUMMON_GUARANTEES,
  SUMMON_EVENT_TYPES,
} from '../../src/logic/index.js';
import { SAVE_KEY, createFreshSave, loadSave } from '../../src/state/save.js';
import { summonAndSave } from '../../src/state/summon-save.js';
import { readJson, loadBundle } from '../helpers/load-data.js';

const economy = readJson('data/economy.json');
const bannersData = readJson('data/banners.json');
const content = createContent({ ...loadBundle(), economy, banners: bannersData });
const BANNER = bannersData.banners[0];
const BID = BANNER.id;
const CUR = BANNER.currency_id;
const MULTI = BANNER.multi_count;
const HARD = BANNER.pity.hard_pity;
const GROUP = BANNER.pity.group;
const TOP = Math.max(...Object.keys(BANNER.rates_bp).map(Number));
const DUP = economy.duplicates;
const CUR_MAX = economy.currencies.find((c) => c.id === CUR).max;
const NOW = Date.UTC(2026, 9, 22, 12, 0, 0);
const NOW_ISO = new Date(NOW).toISOString();

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(readJson('data/schemas/save.schema.json'));

/** Stub RNG that always returns the same float (0 = lowest rarity and first fighter). */
function constRng(v) {
  return { next: () => v, nextInt: (n) => Math.floor(v * n) };
}

function richSave(jade) {
  const s = createFreshSave(economy, NOW_ISO);
  s.currencies[CUR] = jade === undefined ? CUR_MAX : jade;
  return s;
}

function memoryStorage() {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, keys: () => Object.keys(m) };
}

function rarityOf(id) {
  return content.characters[id].rarity;
}

/** Pool fighters by rarity, from data. */
function poolByRarity() {
  const out = {};
  for (const id of BANNER.pool) {
    const r = rarityOf(id);
    (out[r] = out[r] || []).push(id);
  }
  return out;
}

/** Exact per-fighter rate in bp from GDD §11.2 (featured share; remainder split equally). */
function expectedFighterBp(id) {
  const r = rarityOf(id);
  const rateBp = BANNER.rates_bp[String(r)];
  const inRarity = poolByRarity()[r];
  const feat = BANNER.featured.filter((f) => rarityOf(f.character_id) === r);
  const featSum = feat.reduce((a, f) => a + f.share_bp, 0);
  const nonFeat = inRarity.filter((x) => !feat.some((f) => f.character_id === x));
  const mine = feat.find((f) => f.character_id === id);
  if (mine) return nonFeat.length > 0 ? (rateBp * mine.share_bp) / 10000 : (rateBp * mine.share_bp) / featSum;
  return (rateBp * (10000 - featSum)) / 10000 / nonFeat.length;
}

describe('§11.2 rates', () => {
  it('AC-11.1: 1,000,000 seeded single pulls (no pity): each rarity within ±0.1 pp of its rate; each fighter within ±0.15 pp', () => {
    const rng = new SeededRng(20261022);
    const banner = content.banners[BID];
    const byRarity = {};
    const byFighter = {};
    const N = 1000000;
    for (let i = 0; i < N; i++) {
      const p = drawPull(banner, content, rng, 0);
      byRarity[p.rarity] = (byRarity[p.rarity] || 0) + 1;
      byFighter[p.characterId] = (byFighter[p.characterId] || 0) + 1;
    }
    for (const key of Object.keys(BANNER.rates_bp)) {
      const observedPct = ((byRarity[Number(key)] || 0) / N) * 100;
      expect(Math.abs(observedPct - BANNER.rates_bp[key] / 100)).toBeLessThan(0.1);
    }
    for (const id of BANNER.pool) {
      const observedPct = ((byFighter[id] || 0) / N) * 100;
      expect(Math.abs(observedPct - expectedFighterBp(id) / 100)).toBeLessThan(0.15);
    }
  });

  it('the save-derived per-pull RNG streams also give the data rates (200,000 pull indexes, no pity)', () => {
    const banner = content.banners[BID];
    const s = richSave();
    const byRarity = {};
    const N = 200000;
    for (let i = 0; i < N; i++) {
      const p = drawPull(banner, content, summonRngForPull(s, i), 0);
      byRarity[p.rarity] = (byRarity[p.rarity] || 0) + 1;
    }
    for (const key of Object.keys(BANNER.rates_bp)) {
      const observedPct = ((byRarity[Number(key)] || 0) / N) * 100;
      expect(Math.abs(observedPct - BANNER.rates_bp[key] / 100)).toBeLessThan(0.3);
    }
  });

  it('AC-11.4: the rate table equals the data (bp/100, 2 decimals) and per-fighter rates sum to the rarity rate', () => {
    const t = getBannerRates(BID, content);
    expect(t.bannerId).toBe(BID);
    expect(t.rarities.map((r) => r.rarity).sort()).toEqual(Object.keys(BANNER.rates_bp).map(Number).sort());
    for (const row of t.rarities) {
      const bp = BANNER.rates_bp[String(row.rarity)];
      expect(row.bp).toBe(bp);
      expect(row.percentText).toBe((bp / 100).toFixed(2));
      const fighters = t.fighters.filter((f) => f.rarity === row.rarity);
      // displayed (rounded to 1 bp = 0.01%) per-fighter values sum exactly to the rarity rate
      expect(fighters.reduce((a, f) => a + f.bp, 0)).toBe(bp);
      // exact values sum too
      expect(Math.abs(fighters.reduce((a, f) => a + f.exactBp, 0) - bp)).toBeLessThan(1e-9);
    }
    for (const id of BANNER.pool) {
      const f = t.fighters.find((x) => x.characterId === id);
      expect(f).toBeDefined();
      expect(Math.abs(f.exactBp - expectedFighterBp(id))).toBeLessThan(1e-9);
      expect(Math.abs(f.bp - expectedFighterBp(id))).toBeLessThanOrEqual(1);
      expect(f.percentText).toBe(bpToPercentText(f.bp));
      expect(f.featured).toBe(BANNER.featured.some((x) => x.character_id === id));
    }
    expect(t.rules.hardPity).toBe(HARD);
    expect(t.rules.multiMinRarity).toBe(BANNER.multi_min_rarity);
    expect(t.rules.firstMultiMinRarity).toBe(BANNER.first_multi_min_rarity === undefined ? null : BANNER.first_multi_min_rarity);
    expect(t.rules.maxResonance).toBe(DUP.max_resonance);
    expect(t.costSingle).toBe(BANNER.cost_single);
    expect(t.costMulti).toBe(BANNER.cost_multi);
  });

  it('GDD §11.2 example: ★5 300 bp, featured A share 5000 → A 1.50%, the only other ★5 B 1.50%', () => {
    const custom = JSON.parse(JSON.stringify(bannersData));
    const b = custom.banners[0];
    const fives = b.pool.filter((id) => rarityOf(id) === 5);
    expect(fives.length).toBeGreaterThanOrEqual(2);
    b.pool = b.pool.filter((id) => rarityOf(id) !== 5 || id === fives[0] || id === fives[1]);
    b.rates_bp = { 3: 8000, 4: 1700, 5: 300 };
    b.featured = [{ character_id: fives[0], share_bp: 5000 }];
    const c = createContent({ ...loadBundle(), economy, banners: custom });
    const t = getBannerRates(b.id, c);
    expect(t.fighters.find((f) => f.characterId === fives[0]).percentText).toBe('1.50');
    expect(t.fighters.find((f) => f.characterId === fives[1]).percentText).toBe('1.50');
    expect(t.rarities.find((r) => r.rarity === 5).percentText).toBe('3.00');
  });

  it('featured share with 2+ non-featured fighters: featured = rate × share; the rest split equally (draws match)', () => {
    const custom = JSON.parse(JSON.stringify(bannersData));
    const b = custom.banners[0];
    const groups = poolByRarity();
    const r = Number(Object.keys(groups).find((k) => groups[k].length >= 3));
    expect(r).toBeGreaterThan(0);
    const ids = groups[r];
    b.featured = b.featured.filter((f) => rarityOf(f.character_id) !== r).concat([{ character_id: ids[0], share_bp: 5000 }]);
    const c = createContent({ ...loadBundle(), economy, banners: custom });
    const rateBp = b.rates_bp[String(r)];
    const t = getBannerRates(b.id, c);
    expect(t.fighters.find((f) => f.characterId === ids[0]).exactBp).toBeCloseTo(rateBp / 2, 9);
    for (const id of ids.slice(1)) expect(t.fighters.find((f) => f.characterId === id).exactBp).toBeCloseTo(rateBp / 2 / (ids.length - 1), 9);
    // draws inside that rarity follow the same split
    const rng = new SeededRng(11);
    let featuredHits = 0;
    const N = 100000;
    for (let i = 0; i < N; i++) {
      const p = drawPull(c.banners[b.id], c, rng, r);
      if (p.rarity === r && p.characterId === ids[0]) featuredHits++;
    }
    let sumUp = 0;
    for (const k of Object.keys(b.rates_bp)) if (Number(k) >= r) sumUp += b.rates_bp[k];
    expect(Math.abs(featuredHits / N - rateBp / 2 / sumUp)).toBeLessThan(0.01);
  });

  it('bpToPercentText formats integer bp as a percent with 2 decimals', () => {
    expect(bpToPercentText(300)).toBe('3.00');
    expect(bpToPercentText(1700)).toBe('17.00');
    expect(bpToPercentText(8000)).toBe('80.00');
    expect(bpToPercentText(150)).toBe('1.50');
    expect(bpToPercentText(7)).toBe('0.07');
    expect(bpToPercentText(10000)).toBe('100.00');
  });

  it('unknown banner ids (including Object.prototype names) give null, not a crash', () => {
    expect(getBannerRates('banner_nope_001', content)).toBeNull();
    expect(getBannerRates('constructor', content)).toBeNull();
    expect(getPityStatus(richSave(), '__proto__', content)).toBeNull();
  });
});

describe('§11.3 guarantees and pity', () => {
  it('AC-11.2: with the pity counter at hard_pity − 1, the next pull is top rarity (100 of 100 seeded trials) and pity resets', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const s = richSave();
      s.summon.pity[GROUP] = HARD - 1;
      const r = summon(s, BID, 1, content, { nowIso: NOW_ISO, rng: new SeededRng(seed) });
      expect(r.ok).toBe(true);
      expect(r.results[0].rarity).toBe(TOP);
      expect(r.results[0].guarantee).toBe('hard_pity');
      expect(r.saveAfter.summon.pity[GROUP]).toBe(0);
    }
  });

  it('pity boundary N − 2: no forced ★5 (a low roll stays low) and the counter becomes N − 1', () => {
    const s = richSave();
    s.summon.pity[GROUP] = HARD - 2;
    const r = summon(s, BID, 1, content, { nowIso: NOW_ISO, rng: constRng(0) });
    expect(r.results[0].rarity).toBeLessThan(TOP);
    expect(r.results[0].guarantee).toBe('none');
    expect(r.saveAfter.summon.pity[GROUP]).toBe(HARD - 1);
    // ... and the very next pull (counter N − 1) is forced
    const r2 = summon(r.saveAfter, BID, 1, content, { nowIso: NOW_ISO, rng: constRng(0) });
    expect(r2.results[0].rarity).toBe(TOP);
    expect(r2.results[0].guarantee).toBe('hard_pity');
    expect(r2.saveAfter.summon.pity[GROUP]).toBe(0);
  });

  it('pity counter: +1 per non-★5 pull, reset to 0 by a natural ★5', () => {
    const s = richSave();
    const r = summon(s, BID, 1, content, { nowIso: NOW_ISO, rng: constRng(0) });
    expect(r.saveAfter.summon.pity[GROUP]).toBe(1);
    const r2 = summon(r.saveAfter, BID, 1, content, { nowIso: NOW_ISO, rng: constRng(0.999999) }); // top of the roll = ★5
    expect(r2.results[0].rarity).toBe(TOP);
    expect(r2.results[0].guarantee).toBe('none');
    expect(r2.saveAfter.summon.pity[GROUP]).toBe(0);
    expect(r2.events.some((e) => e.type === 'summon_pity_reset')).toBe(true);
  });

  it('a counter above hard_pity (data lowered hard_pity) still forces ★5 instead of breaking', () => {
    const s = richSave();
    s.summon.pity[GROUP] = HARD + 25;
    const r = summon(s, BID, 1, content, { nowIso: NOW_ISO, rng: constRng(0) });
    expect(r.results[0].rarity).toBe(TOP);
    expect(r.saveAfter.summon.pity[GROUP]).toBe(0);
  });

  it('AC-11.3 / first ×10: an RNG giving 9 ★3 makes pull 10 the first-multi rarity on the first ×10', () => {
    const s = richSave();
    const r = summon(s, BID, MULTI, content, { nowIso: NOW_ISO, rng: constRng(0) });
    expect(r.ok).toBe(true);
    expect(r.results.length).toBe(MULTI);
    for (let i = 0; i < MULTI - 1; i++) expect(r.results[i].rarity).toBe(3);
    const minFirst = BANNER.first_multi_min_rarity || BANNER.multi_min_rarity;
    expect(r.results[MULTI - 1].rarity).toBeGreaterThanOrEqual(minFirst);
    expect(r.results[MULTI - 1].guarantee).toBe(BANNER.first_multi_min_rarity ? 'first_multi' : 'multi');
    expect(r.saveAfter.summon.first_multi_done[BID]).toBe(true);
  });

  it('AC-11.3: on a later ×10, 9 ★3 make pull 10 ★4 or better (multi guarantee)', () => {
    const s = richSave();
    s.summon.first_multi_done[BID] = true;
    const r = summon(s, BID, MULTI, content, { nowIso: NOW_ISO, rng: constRng(0) });
    for (let i = 0; i < MULTI - 1; i++) expect(r.results[i].rarity).toBe(3);
    expect(r.results[MULTI - 1].rarity).toBeGreaterThanOrEqual(BANNER.multi_min_rarity);
    expect(r.results[MULTI - 1].guarantee).toBe('multi');
  });

  it('AC-11.3 with real seeds: every seed whose first 9 pulls are all ★3 still gets ★4+ on pull 10', () => {
    let found = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      const s = richSave();
      s.summon.first_multi_done[BID] = true;
      const r = summon(s, BID, MULTI, content, { nowIso: NOW_ISO, rng: new SeededRng(seed) });
      const first9 = r.results.slice(0, MULTI - 1);
      expect(r.results.some((x) => x.rarity >= BANNER.multi_min_rarity)).toBe(true);
      if (first9.every((x) => x.rarity === 3)) {
        found++;
        expect(r.results[MULTI - 1].rarity).toBeGreaterThanOrEqual(BANNER.multi_min_rarity);
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it('the multi guarantee renormalizes over ★4+ rates (pull 10 ★5 share ≈ rate5 / (rate4 + rate5))', () => {
    const banner = content.banners[BID];
    const rng = new SeededRng(7);
    let top = 0;
    const N = 200000;
    for (let i = 0; i < N; i++) if (drawPull(banner, content, rng, BANNER.multi_min_rarity).rarity === TOP) top++;
    let sum = 0;
    for (const k of Object.keys(BANNER.rates_bp)) if (Number(k) >= BANNER.multi_min_rarity) sum += BANNER.rates_bp[k];
    const expected = (BANNER.rates_bp[String(TOP)] / sum) * 100;
    expect(Math.abs((top / N) * 100 - expected)).toBeLessThan(0.5);
  });

  it('the first-×10 guarantee is used once per banner; a ×1 does not use it', () => {
    let s = richSave();
    const single = summon(s, BID, 1, content, { nowIso: NOW_ISO, rng: constRng(0) });
    expect(Object.prototype.hasOwnProperty.call(single.saveAfter.summon.first_multi_done, BID)).toBe(false);
    s = single.saveAfter;
    const first = summon(s, BID, MULTI, content, { nowIso: NOW_ISO, rng: constRng(0) });
    expect(first.results[MULTI - 1].guarantee).toBe(BANNER.first_multi_min_rarity ? 'first_multi' : 'multi');
    const second = summon(first.saveAfter, BID, MULTI, content, { nowIso: NOW_ISO, rng: constRng(0) });
    expect(second.results[MULTI - 1].guarantee).toBe('multi');
  });

  it('a natural ★4 in pulls 1–9 means no multi guarantee on pull 10', () => {
    const s = richSave();
    s.summon.first_multi_done[BID] = true;
    // first pull rolls high-but-not-top (★4), the rest roll 0 (★3)
    const r4 = BANNER.rates_bp['3'] / 10000 + 0.0001;
    let n = 0;
    const rng = { next: () => (n++ < 1 ? r4 : 0), nextInt(k) { return Math.floor(this.next() * k); } };
    const r = summon(s, BID, MULTI, content, { nowIso: NOW_ISO, rng });
    expect(r.results[0].rarity).toBe(4);
    expect(r.results[MULTI - 1].rarity).toBe(3);
    expect(r.results[MULTI - 1].guarantee).toBe('none');
  });

  it('simulation: 2,000 ×10 from one save never goes more than hard_pity pulls without ★5 and every ×10 has ★4+', () => {
    let s = richSave();
    let since = 0;
    let maxGap = 0;
    for (let i = 0; i < 2000; i++) {
      s.currencies[CUR] = CUR_MAX;
      const r = summon(s, BID, MULTI, content, { nowIso: NOW_ISO });
      expect(r.ok).toBe(true);
      expect(r.results.some((x) => x.rarity >= BANNER.multi_min_rarity)).toBe(true);
      for (const x of r.results) {
        since++;
        if (x.rarity === TOP) {
          maxGap = Math.max(maxGap, since);
          since = 0;
        }
      }
      if (i === 0 && BANNER.first_multi_min_rarity) expect(r.results.some((x) => x.rarity >= BANNER.first_multi_min_rarity)).toBe(true);
      s = r.saveAfter;
    }
    expect(maxGap).toBeLessThanOrEqual(HARD);
    expect(s.summon.total_pulls).toBe(2000 * MULTI);
    expect(validate(s)).toBe(true);
  });

  it('getPityStatus: "guaranteed within N" = hard_pity − counter; first-×10 flag', () => {
    const s = richSave();
    let p = getPityStatus(s, BID, content);
    expect(p).toEqual({
      bannerId: BID,
      group: GROUP,
      counter: 0,
      hardPity: HARD,
      pullsUntilGuaranteed: HARD,
      firstMultiAvailable: !!BANNER.first_multi_min_rarity,
      firstMultiMinRarity: BANNER.first_multi_min_rarity || null,
    });
    s.summon.pity[GROUP] = HARD - 1;
    s.summon.first_multi_done[BID] = true;
    p = getPityStatus(s, BID, content);
    expect(p.pullsUntilGuaranteed).toBe(1);
    expect(p.firstMultiAvailable).toBe(false);
    s.summon.pity[GROUP] = HARD + 10;
    expect(getPityStatus(s, BID, content).pullsUntilGuaranteed).toBe(1);
  });
});

describe('§11.4 duplicates', () => {
  it('first copy NEW at R0; each duplicate Resonance +1 up to max; beyond max → overflow Jade by rarity', () => {
    let s = richSave(0);
    s.currencies[CUR] = BANNER.cost_single * (DUP.max_resonance + 3);
    // constRng(0) always gives the first ★3 fighter in the pool (not owned unless a starter)
    const firstThree = BANNER.pool.find((id) => rarityOf(id) === 3);
    s.roster = s.roster.filter((r) => r.character_id !== firstThree);
    const seen = [];
    for (let i = 0; i < DUP.max_resonance + 3; i++) {
      const before = s.currencies[CUR];
      const r = summon(s, BID, 1, content, { nowIso: NOW_ISO, rng: constRng(0) });
      expect(r.ok).toBe(true);
      const x = r.results[0];
      expect(x.characterId).toBe(firstThree);
      seen.push(x);
      if (i === 0) {
        expect(x.isNew).toBe(true);
        expect(x.outcome).toBe('new');
        expect(x.resonanceAfter).toBe(0);
        expect(x.jadeRefund).toBe(0);
      } else if (i <= DUP.max_resonance) {
        expect(x.isNew).toBe(false);
        expect(x.outcome).toBe('resonance');
        expect(x.resonanceAfter).toBe(i);
        expect(x.jadeRefund).toBe(0);
      } else {
        expect(x.outcome).toBe('currency');
        expect(x.resonanceAfter).toBe(DUP.max_resonance);
        const refund = DUP.overflow_amount_by_rarity['3'];
        expect(x.jadeRefund).toBe(refund);
        expect(r.saveAfter.currencies[CUR]).toBe(before - BANNER.cost_single + refund);
      }
      s = r.saveAfter;
    }
    const entries = s.roster.filter((r) => r.character_id === firstThree);
    expect(entries.length).toBe(1);
    expect(entries[0].resonance).toBe(DUP.max_resonance);
  });

  it('a duplicate inside the same ×10 is NEW once, then Resonance', () => {
    const s = richSave();
    s.summon.first_multi_done[BID] = true;
    const firstThree = BANNER.pool.find((id) => rarityOf(id) === 3);
    s.roster = s.roster.filter((r) => r.character_id !== firstThree);
    const r = summon(s, BID, MULTI, content, { nowIso: NOW_ISO, rng: constRng(0) });
    expect(r.results[0].isNew).toBe(true);
    expect(r.results[1].isNew).toBe(false);
    expect(r.results[1].resonanceAfter).toBe(1);
  });

  it('overflow Jade is capped at the currency max (excess lost) and a summon_currency_capped event is sent', () => {
    // hard pity + constRng(0) → the first top-rarity fighter in pool order, already at max Resonance
    const topId = BANNER.pool.find((id) => rarityOf(id) === TOP);
    const s = richSave(CUR_MAX);
    s.roster.push({ character_id: topId, resonance: DUP.max_resonance, obtained_at: NOW_ISO });
    s.summon.pity[GROUP] = HARD - 1;
    const r = summon(s, BID, 1, content, { nowIso: NOW_ISO, rng: constRng(0) });
    expect(r.results[0].characterId).toBe(topId);
    expect(r.results[0].outcome).toBe('currency');
    const refund = DUP.overflow_amount_by_rarity[String(TOP)];
    expect(r.results[0].jadeRefund).toBe(refund);
    const uncapped = CUR_MAX - BANNER.cost_single + refund;
    expect(r.saveAfter.currencies[CUR]).toBe(Math.min(CUR_MAX, uncapped));
    const capped = r.events.filter((e) => e.type === 'summon_currency_capped');
    if (uncapped > CUR_MAX) expect(capped).toEqual([{ type: 'summon_currency_capped', currencyId: CUR, lost: uncapped - CUR_MAX }]);
    else expect(capped).toEqual([]);
  });
});

describe('§11.1 / §12 cost and rejects', () => {
  it('AC-11.6: ×10 with cost_multi − 1 Jade is rejected and nothing changes; exact cost is accepted', () => {
    const s = richSave(BANNER.cost_multi - 1);
    const before = JSON.stringify(s);
    const chk = checkSummon(s, BID, MULTI, content);
    expect(chk.ok).toBe(false);
    expect(chk.reason).toBe('insufficient_currency');
    expect(chk.cost).toBe(BANNER.cost_multi);
    expect(chk.balance).toBe(BANNER.cost_multi - 1);
    const r = summon(s, BID, MULTI, content, { nowIso: NOW_ISO, rng: new SeededRng(1) });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('insufficient_currency');
    expect(r.results).toEqual([]);
    expect(r.events).toEqual([]);
    expect(r.saveAfter).toBe(s);
    expect(JSON.stringify(s)).toBe(before);
    const ok = richSave(BANNER.cost_multi);
    const chk2 = checkSummon(ok, BID, MULTI, content);
    expect(chk2).toMatchObject({ ok: true, reason: null, cost: BANNER.cost_multi, balanceAfter: 0 });
    const r2 = summon(ok, BID, MULTI, content, { nowIso: NOW_ISO, rng: new SeededRng(1) });
    expect(r2.ok).toBe(true);
    const refunds = r2.results.reduce((a, x) => a + x.jadeRefund, 0);
    expect(r2.saveAfter.currencies[CUR]).toBe(refunds);
  });

  it('×1 with cost_single − 1 Jade is rejected; a save with no currency entry counts as 0', () => {
    expect(checkSummon(richSave(BANNER.cost_single - 1), BID, 1, content).reason).toBe('insufficient_currency');
    const s = richSave();
    delete s.currencies[CUR];
    const r = summon(s, BID, 1, content, { nowIso: NOW_ISO });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('insufficient_currency');
  });

  it('×1 costs cost_single, ×10 costs cost_multi; total_pulls counts pulls', () => {
    const s = richSave(BANNER.cost_single + BANNER.cost_multi);
    const r1 = summon(s, BID, 1, content, { nowIso: NOW_ISO, rng: new SeededRng(3) });
    const refund1 = r1.results.reduce((a, x) => a + x.jadeRefund, 0);
    expect(r1.saveAfter.currencies[CUR]).toBe(BANNER.cost_multi + refund1);
    expect(r1.saveAfter.summon.total_pulls).toBe(1);
    expect(r1.events[0]).toMatchObject({ type: 'summon_charged', currencyId: CUR, amount: BANNER.cost_single });
    const r2 = summon(r1.saveAfter, BID, MULTI, content, { nowIso: NOW_ISO, rng: new SeededRng(3) });
    expect(r2.ok).toBe(true);
    expect(r2.saveAfter.summon.total_pulls).toBe(1 + MULTI);
  });

  it('invalid count and unknown banner are rejected with their reasons, nothing changes', () => {
    const s = richSave();
    const before = JSON.stringify(s);
    for (const n of [0, 2, 5, 11, -1, 1.5, '1', null]) {
      const r = summon(s, BID, n, content, { nowIso: NOW_ISO });
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('invalid_count');
    }
    for (const id of ['banner_nope_001', 'constructor', '__proto__', null]) {
      expect(summon(s, id, 1, content, { nowIso: NOW_ISO }).reason).toBe('unknown_banner');
    }
    expect(JSON.stringify(s)).toBe(before);
  });

  it('a banner outside its start_at/end_at window is rejected as banner_closed', () => {
    const custom = JSON.parse(JSON.stringify(bannersData));
    custom.banners[0].end_at = '2026-01-01T00:00:00.000Z';
    const c = createContent({ ...loadBundle(), economy, banners: custom });
    const s = richSave();
    expect(checkSummon(s, BID, 1, c, NOW_ISO).reason).toBe('banner_closed');
    expect(summon(s, BID, 1, c, { nowIso: NOW_ISO }).reason).toBe('banner_closed');
    custom.banners[0].end_at = null;
    custom.banners[0].start_at = '2027-01-01T00:00:00.000Z';
    const c2 = createContent({ ...loadBundle(), economy, banners: custom });
    expect(checkSummon(s, BID, 1, c2, NOW_ISO).reason).toBe('banner_closed');
  });

  it('every reject reason produced is in the exported SUMMON_REJECT_REASONS list; enums are exported', () => {
    expect(SUMMON_REJECT_REASONS).toEqual(['unknown_banner', 'invalid_count', 'banner_closed', 'empty_pool', 'insufficient_currency']);
    expect(SUMMON_OUTCOMES).toEqual(['new', 'resonance', 'currency']);
    expect(SUMMON_GUARANTEES).toEqual(['none', 'hard_pity', 'first_multi', 'multi']);
    expect(SUMMON_EVENT_TYPES).toEqual(['summon_charged', 'summon_pull', 'summon_pity_reset', 'summon_currency_capped']);
  });
});

describe('§11.3 anti-reroll, determinism, save-before-reveal', () => {
  it('the input save is never mutated; saveAfter is schema-valid', () => {
    const s = richSave();
    const before = JSON.stringify(s);
    const r = summon(s, BID, MULTI, content, { nowIso: NOW_ISO });
    expect(JSON.stringify(s)).toBe(before);
    expect(r.saveAfter).not.toBe(s);
    expect(validate(r.saveAfter)).toBe(true);
    expect(r.saveAfter.updated_at).toBe(NOW_ISO);
  });

  it('determinism: same save + same banner + same count → identical results and saves (no injected rng)', () => {
    const a = summon(richSave(), BID, MULTI, content, { nowIso: NOW_ISO });
    const b = summon(richSave(), BID, MULTI, content, { nowIso: NOW_ISO });
    expect(a.results).toEqual(b.results);
    expect(a.saveAfter).toEqual(b.saveAfter);
    const c = summon(richSave(), BID, MULTI, content, { nowIso: NOW_ISO, rng: new SeededRng(99) });
    const d = summon(richSave(), BID, MULTI, content, { nowIso: NOW_ISO, rng: new SeededRng(99) });
    expect(c.results).toEqual(d.results);
  });

  it('anti-reroll: quitting before the save is written and summoning again from the old save gives the same results', () => {
    const s = richSave();
    const first = summon(s, BID, 1, content, { nowIso: NOW_ISO });
    // the player quits; the old save (from storage) is used again later
    const again = summon(JSON.parse(JSON.stringify(s)), BID, 1, content, { nowIso: new Date(NOW + 60000).toISOString() });
    expect(again.results).toEqual(first.results);
  });

  it('the summon RNG advances with total_pulls (different pulls get different streams) and depends on the save, not the clock', () => {
    const s = richSave();
    const a = summonRngForPull(s, 0).next();
    const b = summonRngForPull(s, 1).next();
    expect(a).not.toBe(b);
    const s2 = JSON.parse(JSON.stringify(s));
    s2.updated_at = new Date(NOW + 999999).toISOString();
    s2.currencies[CUR] = 5;
    expect(summonRngForPull(s2, 0).next()).toBe(a);
  });

  it('global pull k (= total_pulls before it) uses summonRngForPull(save, k): ×1 results match direct draws', () => {
    let s = richSave();
    const banner = content.banners[BID];
    const seen = {};
    for (let k = 0; k < Math.min(30, HARD - 1); k++) {
      const r = summon(s, BID, 1, content, { nowIso: NOW_ISO });
      expect(r.results[0].guarantee).toBe('none'); // fewer than hard_pity − 1 pulls: never forced
      const direct = drawPull(banner, content, summonRngForPull(s, k), 0);
      expect(r.results[0].characterId).toBe(direct.characterId);
      seen[direct.characterId] = true;
      s = r.saveAfter;
    }
    expect(Object.keys(seen).length).toBeGreaterThan(1);
  });

  it('AC-11.5: summonAndSave writes results and the new balance before returning; reloading shows them once', () => {
    const st = memoryStorage();
    const loaded = loadSave(st, { validate, economy, characters: content.characters, nowMs: NOW });
    // top up only if a future economy starts below one ×10 (data may change)
    loaded.save.currencies[CUR] = Math.max(loaded.save.currencies[CUR], BANNER.cost_multi);
    const start = loaded.save.currencies[CUR];
    const r = summonAndSave(st, loaded.save, BID, MULTI, content, NOW + 1000);
    expect(r.ok).toBe(true);
    expect(r.saved).toBe(true);
    // app killed during the reveal: reopen
    const reopened = loadSave(st, { validate, economy, characters: content.characters, nowMs: NOW + 5000 });
    expect(reopened.damaged).toBe(false);
    const refunds = r.results.reduce((a, x) => a + x.jadeRefund, 0);
    expect(reopened.save.currencies[CUR]).toBe(start - BANNER.cost_multi + refunds);
    for (const x of r.results) expect(reopened.save.roster.some((e) => e.character_id === x.characterId)).toBe(true);
    expect(reopened.save.summon.total_pulls).toBe(MULTI);
    expect(reopened.save).toEqual(JSON.parse(st.getItem(SAVE_KEY)));
    // reopening again does not charge again
    const third = loadSave(st, { validate, economy, characters: content.characters, nowMs: NOW + 9000 });
    expect(third.save.currencies[CUR]).toBe(reopened.save.currencies[CUR]);
  });

  it('summonAndSave writes nothing on a reject', () => {
    const st = memoryStorage();
    const s = richSave(0);
    st.setItem(SAVE_KEY, JSON.stringify(s));
    const r = summonAndSave(st, s, BID, 1, content, NOW);
    expect(r.ok).toBe(false);
    expect(r.saved).toBe(false);
    expect(st.getItem(SAVE_KEY)).toBe(JSON.stringify(s));
  });

  it('events: summon_charged first, then one summon_pull per result with the same fields', () => {
    const r = summon(richSave(), BID, MULTI, content, { nowIso: NOW_ISO });
    expect(r.events[0].type).toBe('summon_charged');
    const pulls = r.events.filter((e) => e.type === 'summon_pull');
    expect(pulls.length).toBe(MULTI);
    pulls.forEach((e, i) => expect(e.result).toEqual(r.results[i]));
    for (const e of r.events) expect(SUMMON_EVENT_TYPES).toContain(e.type);
    for (const x of r.results) {
      expect(SUMMON_OUTCOMES).toContain(x.outcome);
      expect(SUMMON_GUARANTEES).toContain(x.guarantee);
      expect(BANNER.pool).toContain(x.characterId);
    }
  });

  it('summoned fighters can be put in a team and fielded in a battle (with their Resonance)', () => {
    let s = richSave();
    for (let i = 0; i < 5; i++) {
      s.currencies[CUR] = CUR_MAX;
      s = summon(s, BID, MULTI, content, { nowIso: NOW_ISO }).saveAfter;
    }
    const fams = {};
    const team = [];
    for (const e of s.roster) {
      const ch = content.characters[e.character_id];
      if (!fams[ch.family] && team.length < 3 && ch.rarity > 3) {
        fams[ch.family] = true;
        team.push({ characterId: e.character_id, resonance: e.resonance });
      }
    }
    expect(team.length).toBe(3);
    const b = createBattle({ content, stageId: 'stage_001', playerTeam: team, skipIntro: true }, 1);
    expect(b.getState().teams.player.fighters.length).toBe(3);
  });
});
