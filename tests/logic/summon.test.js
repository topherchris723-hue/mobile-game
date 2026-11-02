// GDD §11 Summon (gacha), round-3 exact rules.
// Part 1 uses the GDD §11 "default data used in the examples" (tests/helpers/summon-fixture.js) because the ACs fix
// exact vectors. Part 2 uses the live data files and reads every number from them (balance may change them).
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
  rarityFromRoll,
  fighterFromRoll,
  fighterWeights,
  getBannerRates,
  getPityStatus,
  getOpenBanners,
  bpToPercentText,
  SUMMON_REJECT_REASONS,
  SUMMON_OUTCOMES,
  SUMMON_GUARANTEES,
  SUMMON_EVENT_TYPES,
} from '../../src/logic/index.js';
import { SAVE_KEY, createFreshSave, loadSave, grantCharacter } from '../../src/state/save.js';
import { summonAndSave, randomSummonSeed } from '../../src/state/summon-save.js';
import { readJson, loadBundle } from '../helpers/load-data.js';
import { gddSummonBundle, gddSummonContent, stubRng, GDD_BANNER_ID } from '../helpers/summon-fixture.js';

const NOW = Date.UTC(2026, 9, 22, 12, 0, 0);
const NOW_ISO = new Date(NOW).toISOString();
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(readJson('data/schemas/save.schema.json'));

function memoryStorage() {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
}

// ---------------------------------------------------------------- Part 1: GDD vectors (default example data)
const G = gddSummonContent();
const GE = G.economy;
const B = GDD_BANNER_ID;

function gSave(jade) {
  const s = createFreshSave(GE, NOW_ISO);
  if (jade !== undefined) s.currencies.cur_jade = jade;
  return s;
}
function gSummon(save, count, rng) {
  return summon(save, B, count, G, { nowIso: NOW_ISO, rng: rng });
}
function res(id, r) {
  for (const e of r.saveAfter.roster) if (e.character_id === id) return e.resonance;
  return -1;
}

describe('GDD §11 vectors (default example data)', () => {
  it('AC-11.2: pity 39 (first ×10 done) → ★5 in 100/100 seeds, guarantee hard_pity, pity 0 after', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const s = gSave(1000);
      s.summon.pity.standard = 39;
      s.summon.first_multi_done[B] = true;
      const r = summon(s, B, 1, G, { nowIso: NOW_ISO, seed: seed });
      expect(r.results[0].rarity).toBe(5);
      expect(r.results[0].guarantee).toBe('hard_pity');
      expect(r.saveAfter.summon.pity.standard).toBe(0);
      expect(r.pity_before).toBe(39);
      expect(r.pity_after).toBe(0);
      expect(r.seed).toBe(seed);
    }
  });

  it('AC-11.2 must-FAIL check: pity 38, stub 0.5 → ★3 and the counter becomes 39', () => {
    const s = gSave(1000);
    s.summon.pity.standard = 38;
    s.summon.first_multi_done[B] = true;
    const r = gSummon(s, 1, stubRng(0.5));
    expect(r.results[0].rarity).toBe(3);
    expect(r.results[0].guarantee).toBe('none');
    expect(r.saveAfter.summon.pity.standard).toBe(39);
  });

  it('AC-11.3: later ×10, stub 0.9999 → pulls 1–9 ★3, pull 10 ★4 (multi)', () => {
    const s = gSave(1000);
    s.summon.first_multi_done[B] = true;
    const r = gSummon(s, 10, stubRng(0.9999));
    for (let i = 0; i < 9; i++) expect(r.results[i].rarity).toBe(3);
    expect(r.results[9]).toMatchObject({ pull: 10, rarity: 4, guarantee: 'multi', character_id: 'char_rook_001' });
  });

  it('AC-11.3: stub 0.0 only on call 19 (pull 10 call A) → pull 10 ★5', () => {
    const s = gSave(1000);
    s.summon.first_multi_done[B] = true;
    const r = gSummon(s, 10, stubRng((n) => (n === 19 ? 0 : 0.9999)));
    expect(r.results[9].rarity).toBe(5);
    expect(r.results[9].guarantee).toBe('multi');
    expect(r.results[9].character_id).toBe('char_corvane_001');
  });

  it('AC-11.3 must-FAIL check: pull 5 call A = 0.1 (★4) → pull 10 is a normal ★3, guarantee none', () => {
    const s = gSave(1000);
    s.summon.first_multi_done[B] = true;
    const r = gSummon(s, 10, stubRng((n) => (n === 9 ? 0.1 : 0.9999)));
    expect(r.results[4].rarity).toBe(4);
    expect(r.results[9].rarity).toBe(3);
    expect(r.results[9].guarantee).toBe('none');
  });

  it('AC-11.3b: first ×10 on a fresh save, stub 0.9999 → Dunmore R1–R4, +10 Jade ×5, pull 10 Corvane ★5 NEW; Jade 50', () => {
    const s = gSave();
    expect(s.currencies.cur_jade).toBe(1000);
    const r = gSummon(s, 10, stubRng(0.9999));
    for (let i = 0; i < 9; i++) {
      expect(r.results[i].rarity).toBe(3);
      expect(r.results[i].character_id).toBe('char_dunmore_001');
    }
    for (let i = 0; i < 4; i++) expect(r.results[i]).toMatchObject({ outcome: 'resonance', resonance_after: i + 1, jade_added: 0 });
    for (let i = 4; i < 9; i++) expect(r.results[i]).toMatchObject({ outcome: 'jade', resonance_after: 4, jade_added: 10 });
    expect(r.results[9]).toMatchObject({ pull: 10, rarity: 5, guarantee: 'first_multi', character_id: 'char_corvane_001', outcome: 'new', resonance_after: 0 });
    const a = r.saveAfter;
    expect(a.summon.first_multi_done[B]).toBe(true);
    expect(a.summon.pity.standard).toBe(0);
    expect(a.summon.total_pulls).toBe(10);
    expect(a.currencies.cur_jade).toBe(50);
    expect(r.jade_before).toBe(1000);
    expect(r.jade_after).toBe(50);
    expect(res('char_dunmore_001', r)).toBe(4);
    // a second ×10 with the same stub gives ★4 on pull 10, not ★5
    a.currencies.cur_jade = 1000;
    const r2 = gSummon(a, 10, stubRng(0.9999));
    expect(r2.results[9].rarity).toBe(4);
    expect(r2.results[9].guarantee).toBe('multi');
  });

  it('AC-11.3c: pity 35 inside a ×10, stub 0.9999 → pull 5 ★5 by hard_pity, pull 10 normal ★3, pity 5 after', () => {
    const s = gSave(1000);
    s.summon.pity.standard = 35;
    s.summon.first_multi_done[B] = true;
    const r = gSummon(s, 10, stubRng(0.9999));
    expect(r.results.map((x) => x.rarity)).toEqual([3, 3, 3, 3, 5, 3, 3, 3, 3, 3]);
    expect(r.results[4].guarantee).toBe('hard_pity');
    expect(r.results[9].guarantee).toBe('none');
    expect(r.saveAfter.summon.pity.standard).toBe(5);
  });

  it('AC-11.4: rate table 3.00/17.00/80.00; Solenne/Corvane 1.50, Pell/Thessa/Rook 5.67, Tavi/Lark/Dunmore 26.67; Σ weights = W', () => {
    const t = getBannerRates(B, G);
    expect(t.rarities.map((r) => [r.rarity, r.percentText])).toEqual([[5, '3.00'], [4, '17.00'], [3, '80.00']]);
    const pct = {};
    for (const f of t.fighters) pct[f.characterId] = f.percentText;
    expect(pct).toEqual({
      char_solenne_001: '1.50', char_corvane_001: '1.50',
      char_pell_001: '5.67', char_thessa_001: '5.67', char_rook_001: '5.67',
      char_tavi_001: '26.67', char_lark_001: '26.67', char_dunmore_001: '26.67',
    });
    expect(t.fighters.map((f) => f.characterId)).toEqual([
      'char_solenne_001', 'char_corvane_001', 'char_pell_001', 'char_thessa_001', 'char_rook_001',
      'char_tavi_001', 'char_lark_001', 'char_dunmore_001',
    ]);
    const W = { 5: 10000, 4: 30000, 3: 30000 };
    for (const k of [3, 4, 5]) {
      const fw = fighterWeights(G.banners[B], G, k);
      expect(fw.total).toBe(W[k]);
      expect(fw.list.reduce((a, f) => a + f.weight, 0)).toBe(W[k]);
      const rows = t.fighters.filter((f) => f.rarity === k);
      expect(Math.abs(rows.reduce((a, f) => a + f.exactBp, 0) - t.rarities.find((r) => r.rarity === k).bp)).toBeLessThan(1e-9);
    }
  });

  it('AC-11.6: affordability — 999: ×10 no, ×1 yes; 1000: ×10 yes; 99: both no; 100: ×1 yes', () => {
    const ok = (jade, n) => checkSummon(gSave(jade), B, n, G, NOW_ISO).ok;
    expect(ok(999, 10)).toBe(false);
    expect(ok(999, 1)).toBe(true);
    expect(ok(1000, 10)).toBe(true);
    expect(ok(99, 1)).toBe(false);
    expect(ok(99, 10)).toBe(false);
    expect(ok(100, 1)).toBe(true);
    expect(checkSummon(gSave(999), B, 10, G, NOW_ISO).reason).toBe('insufficient_currency');
    expect(checkSummon(gSave(1000), B, 10, G, NOW_ISO)).toMatchObject({ cost: 1000, balance: 1000, balanceAfter: 0 });
  });

  it('AC-11.7: fighter draw vectors and 300,000 ★3 draws at 1/3 ± 0.005 each', () => {
    const b = G.banners[B];
    expect(fighterFromRoll(b, G, 5, 0.4999)).toBe('char_solenne_001');
    expect(fighterFromRoll(b, G, 5, 0.5)).toBe('char_corvane_001');
    expect(fighterFromRoll(b, G, 3, 0.3333)).toBe('char_tavi_001');
    expect(fighterFromRoll(b, G, 3, 0.33334)).toBe('char_lark_001');
    const rng = new SeededRng(4242);
    const n = {};
    const N = 300000;
    for (let i = 0; i < N; i++) {
      const id = fighterFromRoll(b, G, 3, rng.next());
      n[id] = (n[id] || 0) + 1;
    }
    for (const id of ['char_tavi_001', 'char_lark_001', 'char_dunmore_001']) expect(Math.abs(n[id] / N - 1 / 3)).toBeLessThan(0.005);
  });

  it('§11.3 rarity walk: r 0–299 ★5, 300–1999 ★4, 2000–9999 ★3; forced ≥4 uses T = 2000', () => {
    const b = G.banners[B];
    expect(rarityFromRoll(b, 299 / 10000, 0)).toBe(5);
    expect(rarityFromRoll(b, 300 / 10000, 0)).toBe(4);
    expect(rarityFromRoll(b, 1999 / 10000, 0)).toBe(4);
    expect(rarityFromRoll(b, 2000 / 10000, 0)).toBe(3);
    expect(rarityFromRoll(b, 0.9999, 0)).toBe(3);
    expect(rarityFromRoll(b, 0.1495, 4)).toBe(5); // r = 299
    expect(rarityFromRoll(b, 0.15, 4)).toBe(4); // r = 300
    expect(rarityFromRoll(b, 0.9999, 4)).toBe(4);
    expect(rarityFromRoll(b, 0.9999, 5)).toBe(5);
  });

  it('AC-11.8: duplicates — Tavi R1; Tavi at R4 → +10 Jade still R4; ★5 at R4 → +200; NEW on pull 3 then Resonance on pull 7', () => {
    // Tavi: call A 0.9999 → ★3, call B 0.0 → first ★3 candidate = Tavi
    const tavi = (n) => (n % 2 === 1 ? 0.9999 : 0);
    let s = gSave(1000);
    s.summon.first_multi_done[B] = true;
    let r = gSummon(s, 1, stubRng(tavi));
    expect(r.results[0]).toMatchObject({ character_id: 'char_tavi_001', outcome: 'resonance', resonance_after: 1, jade_added: 0 });
    s = gSave(1000);
    s.roster.find((e) => e.character_id === 'char_tavi_001').resonance = 4;
    r = gSummon(s, 1, stubRng(tavi));
    expect(r.results[0]).toMatchObject({ outcome: 'jade', resonance_after: 4, jade_added: 10 });
    expect(r.saveAfter.currencies.cur_jade).toBe(1000 - 100 + 10);
    // ★5 Solenne at R4: A 0.0 → ★5, B 0.0 → Solenne
    s = gSave(1000);
    s.roster.push({ character_id: 'char_solenne_001', resonance: 4, obtained_at: NOW_ISO });
    r = gSummon(s, 1, stubRng(0));
    expect(r.results[0]).toMatchObject({ character_id: 'char_solenne_001', outcome: 'jade', jade_added: 200, resonance_after: 4 });
    // NEW on pull 3 and again on pull 7 (Pell: A 0.1 → ★4, B 0.0 → Pell); the other pulls are Tavi
    s = gSave(1000);
    s.summon.first_multi_done[B] = true;
    const seq = (n) => {
      const pull = Math.ceil(n / 2);
      if (pull === 3 || pull === 7) return n % 2 === 1 ? 0.1 : 0;
      return tavi(n);
    };
    r = gSummon(s, 10, stubRng(seq));
    expect(r.results[2]).toMatchObject({ character_id: 'char_pell_001', outcome: 'new', resonance_after: 0 });
    expect(r.results[6]).toMatchObject({ character_id: 'char_pell_001', outcome: 'resonance', resonance_after: 1 });
  });

  it('AC-11.8 cap: at Jade 999,950 a ★5 overflow credits 49 (Jade 999,999); in a summon jade_added is the credited amount', () => {
    // The duplicate rule itself (also used by stage rewards): balance 999,950 at the moment of the credit.
    const s = gSave(999950);
    s.roster.push({ character_id: 'char_solenne_001', resonance: 4, obtained_at: NOW_ISO });
    const g = grantCharacter(s, GE, G.characters.char_solenne_001, NOW_ISO);
    expect(g).toMatchObject({ kind: 'currency', amount: 200, credited: 49 });
    expect(s.currencies.cur_jade).toBe(999999);
    // In a summon the cost is paid first (step 2): 999,999 − 100 = 999,899, + 200 → cap, credited 100, lost 100.
    const s2 = gSave(999999);
    s2.roster.push({ character_id: 'char_solenne_001', resonance: 4, obtained_at: NOW_ISO });
    const r = gSummon(s2, 1, stubRng(0));
    expect(r.results[0]).toMatchObject({ outcome: 'jade', jade_added: 100 });
    expect(r.saveAfter.currencies.cur_jade).toBe(999999);
    expect(r.events.find((e) => e.type === 'summon_currency_capped')).toMatchObject({ currencyId: 'cur_jade', lost: 100 });
    // and in a ×10 the 10th pull can hit the cap after earlier credits: credited amounts are summed exactly
    const s3 = gSave(999999);
    s3.summon.first_multi_done[B] = true;
    s3.roster.push({ character_id: 'char_solenne_001', resonance: 4, obtained_at: NOW_ISO });
    const r3 = gSummon(s3, 10, stubRng(0));
    expect(r3.results.reduce((a, x) => a + x.jade_added, 0)).toBe(999999 - (999999 - 1000));
    expect(r3.saveAfter.currencies.cur_jade).toBe(999999);
  });

  it('AC-11.9: same seed + same save → identical results; exactly 2 next() calls per pull (20 per ×10), also on forced pulls', () => {
    const a = summon(gSave(1000), B, 10, G, { nowIso: NOW_ISO, seed: 777 });
    const b = summon(gSave(1000), B, 10, G, { nowIso: NOW_ISO, seed: 777 });
    expect(a.results).toEqual(b.results);
    expect(a.saveAfter).toEqual(b.saveAfter);
    const st = stubRng(0.9999);
    gSummon(gSave(1000), 10, st); // pull 10 forced (first_multi)
    expect(st.calls).toBe(20);
    const s = gSave(1000);
    s.summon.pity.standard = 39;
    const st1 = stubRng(0.9999);
    gSummon(s, 1, st1); // forced by hard pity
    expect(st1.calls).toBe(2);
    const s3 = gSave(1000);
    s3.summon.pity.standard = 35;
    const st3 = stubRng(0.9999);
    gSummon(s3, 10, st3);
    expect(st3.calls).toBe(20);
  });

  it('AC-11.11: pity display — fresh 40 + first-×10 line; 3 ×1 without ★5 → 37; after a ×10 the line is gone; after a ★5 → 40', () => {
    let s = gSave(5000);
    let p = getPityStatus(s, B, G);
    expect(p.pullsUntilGuaranteed).toBe(40);
    expect(p.firstMultiAvailable).toBe(true);
    expect(p.firstMultiMinRarity).toBe(5);
    for (let i = 0; i < 3; i++) s = gSummon(s, 1, stubRng(0.9999)).saveAfter;
    expect(getPityStatus(s, B, G).pullsUntilGuaranteed).toBe(37);
    expect(getPityStatus(s, B, G).firstMultiAvailable).toBe(true); // ×1 pulls are not a ×10
    s = gSummon(s, 10, stubRng(0.9999)).saveAfter; // pull 10 is ★5 (first ×10)
    p = getPityStatus(s, B, G);
    expect(p.firstMultiAvailable).toBe(false);
    expect(p.pullsUntilGuaranteed).toBe(40);
    s.summon.pity.standard = 99;
    expect(getPityStatus(s, B, G).pullsUntilGuaranteed).toBe(1);
  });

  it('AC-11.13: a banner with end_at in the past is not open; no open banner → empty list; summon rejected banner_closed', () => {
    const bundle = gddSummonBundle();
    bundle.banners.banners[0].end_at = '2026-01-01T00:00:00Z';
    const c = createContent(bundle);
    expect(getOpenBanners(c, NOW_ISO)).toEqual([]);
    expect(getOpenBanners(G, NOW_ISO).map((b) => b.id)).toEqual([B]);
    expect(summon(gSave(1000), B, 1, c, { nowIso: NOW_ISO, seed: 1 }).reason).toBe('banner_closed');
    bundle.banners.banners[0].end_at = null;
    bundle.banners.banners[0].start_at = '2027-01-01T00:00:00Z';
    expect(getOpenBanners(createContent(bundle), NOW_ISO)).toEqual([]);
    bundle.banners.banners[0].start_at = NOW_ISO; // now ≥ start → open
    expect(getOpenBanners(createContent(bundle), NOW_ISO).length).toBe(1);
  });

  it('§11.2 n > 0 with featured fighters: featured = share × n, rest = 10000 − S, order featured[] then pool[]', () => {
    const bundle = gddSummonBundle();
    const b = bundle.banners.banners[0];
    b.featured = [{ character_id: 'char_solenne_001', share_bp: 5000 }];
    let t = getBannerRates(B, createContent(bundle));
    expect(t.fighters.filter((f) => f.rarity === 5).map((f) => [f.characterId, f.weight, f.percentText])).toEqual([
      ['char_solenne_001', 5000, '1.50'], ['char_corvane_001', 5000, '1.50'],
    ]);
    // ★4 with Thessa featured (share 5000) and 2 non-featured: n = 2 → Thessa 10000, others 5000 each, W 20000
    b.featured.push({ character_id: 'char_thessa_001', share_bp: 5000 });
    const c = createContent(bundle);
    t = getBannerRates(B, c);
    expect(t.fighters.filter((f) => f.rarity === 4).map((f) => [f.characterId, f.weight, f.totalWeight, f.percentText])).toEqual([
      ['char_thessa_001', 10000, 20000, '8.50'], ['char_pell_001', 5000, 20000, '4.25'], ['char_rook_001', 5000, 20000, '4.25'],
    ]);
    expect(fighterFromRoll(c.banners[B], c, 4, 0.4999)).toBe('char_thessa_001');
    expect(fighterFromRoll(c.banners[B], c, 4, 0.5)).toBe('char_pell_001');
  });
});

// ---------------------------------------------------------------- Part 2: live data (numbers read from data)
const economy = readJson('data/economy.json');
const bannersData = readJson('data/banners.json');
const content = createContent({ ...loadBundle(), economy, banners: bannersData });
const BANNER = bannersData.banners[0];
const BID = BANNER.id;
const CUR = BANNER.currency_id;
const MULTI = BANNER.multi_count;
const HARD = BANNER.pity.hard_pity;
const GROUP = BANNER.pity.group;
const CUR_MAX = economy.currencies.find((c) => c.id === CUR).max;

function richSave(jade) {
  const s = createFreshSave(economy, NOW_ISO);
  s.currencies[CUR] = jade === undefined ? CUR_MAX : jade;
  return s;
}

describe('§11 with the live data files', () => {
  it('AC-11.1: 1,000,000 seeded normal rarity draws are within ±0.1 pp of rates_bp', () => {
    const rng = new SeededRng(20261022);
    const banner = content.banners[BID];
    const n = {};
    const N = 1000000;
    for (let i = 0; i < N; i++) {
      const r = rarityFromRoll(banner, rng.next(), 0);
      n[r] = (n[r] || 0) + 1;
    }
    for (const k of Object.keys(BANNER.rates_bp)) {
      expect(Math.abs(((n[Number(k)] || 0) / N) * 100 - BANNER.rates_bp[k] / 100)).toBeLessThan(0.1);
    }
  });

  it('300,000 full normal pulls: each fighter within ±0.15 pp of its exact table rate', () => {
    const rng = new SeededRng(99);
    const banner = content.banners[BID];
    const t = getBannerRates(BID, content);
    const n = {};
    const N = 300000;
    for (let i = 0; i < N; i++) {
      const p = drawPull(banner, content, rng, 0, 0);
      n[p.characterId] = (n[p.characterId] || 0) + 1;
    }
    for (const f of t.fighters) expect(Math.abs(((n[f.characterId] || 0) / N) * 100 - f.exactBp / 100)).toBeLessThan(0.15);
  });

  it('AC-11.4 (live data): rarity rows equal rates_bp / 100 with 2 decimals; Σ exact fighter rates = rarity rate; Σ weights = W', () => {
    const t = getBannerRates(BID, content);
    for (const row of t.rarities) {
      expect(row.bp).toBe(BANNER.rates_bp[String(row.rarity)]);
      expect(row.percentText).toBe((row.bp / 100).toFixed(2));
      const fs = t.fighters.filter((f) => f.rarity === row.rarity);
      if (fs.length === 0) continue;
      expect(Math.abs(fs.reduce((a, f) => a + f.exactBp, 0) - row.bp)).toBeLessThan(1e-9);
      expect(fs.reduce((a, f) => a + f.weight, 0)).toBe(fs[0].totalWeight);
      for (const f of fs) expect(f.percentText).toBe(bpToPercentText(Math.floor((2 * row.bp * f.weight + f.totalWeight) / (2 * f.totalWeight))));
    }
    for (const id of BANNER.pool) expect(t.fighters.some((f) => f.characterId === id)).toBe(true);
    expect(t.rules).toMatchObject({ hardPity: HARD, pityGroup: GROUP, multiMinRarity: BANNER.multi_min_rarity, maxResonance: economy.duplicates.max_resonance });
  });

  it('bpToPercentText', () => {
    expect([300, 1700, 8000, 150, 7, 10000, 567, 2667].map(bpToPercentText)).toEqual(['3.00', '17.00', '80.00', '1.50', '0.07', '100.00', '5.67', '26.67']);
  });

  it('simulation: 2,000 ×10 never exceed hard_pity pulls without ★5, every ×10 meets multi_min_rarity, first ×10 meets first_multi_min_rarity', () => {
    let s = richSave();
    let since = 0;
    let maxGap = 0;
    for (let i = 0; i < 2000; i++) {
      s.currencies[CUR] = CUR_MAX;
      const r = summon(s, BID, MULTI, content, { nowIso: NOW_ISO, seed: 1000 + i });
      expect(r.ok).toBe(true);
      expect(r.results.some((x) => x.rarity >= BANNER.multi_min_rarity)).toBe(true);
      if (i === 0 && BANNER.first_multi_min_rarity) expect(r.results.some((x) => x.rarity >= BANNER.first_multi_min_rarity)).toBe(true);
      for (const x of r.results) {
        since++;
        if (x.rarity === 5) {
          maxGap = Math.max(maxGap, since);
          since = 0;
        }
      }
      s = r.saveAfter;
    }
    expect(maxGap).toBeLessThanOrEqual(HARD);
    expect(s.summon.total_pulls).toBe(2000 * MULTI);
    expect(validate(s)).toBe(true);
  });

  it('rejects: insufficient currency (also no currency entry), invalid count, unknown banner — nothing changes', () => {
    const s = richSave(BANNER.cost_multi - 1);
    const before = JSON.stringify(s);
    const r = summon(s, BID, MULTI, content, { nowIso: NOW_ISO, seed: 1 });
    expect(r).toMatchObject({ ok: false, reason: 'insufficient_currency', results: [], events: [] });
    expect(r.saveAfter).toBe(s);
    for (const n of [0, 2, 5, 11, -1, 1.5, '1', null]) expect(summon(s, BID, n, content, { nowIso: NOW_ISO, seed: 1 }).reason).toBe('invalid_count');
    for (const id of ['banner_nope_001', 'constructor', '__proto__', null]) expect(summon(s, id, 1, content, { nowIso: NOW_ISO, seed: 1 }).reason).toBe('unknown_banner');
    expect(JSON.stringify(s)).toBe(before);
    const none = richSave();
    delete none.currencies[CUR];
    expect(summon(none, BID, 1, content, { nowIso: NOW_ISO, seed: 1 }).reason).toBe('insufficient_currency');
    expect(getBannerRates('constructor', content)).toBeNull();
    expect(getPityStatus(none, '__proto__', content)).toBeNull();
  });

  it('empty_pool: a banner whose ★5 has no usable fighter is rejected instead of crashing (hard pity could force ★5)', () => {
    const custom = JSON.parse(JSON.stringify(bannersData));
    custom.banners[0].pool = custom.banners[0].pool.filter((id) => content.characters[id].rarity !== 5);
    custom.banners[0].featured = [];
    const c = createContent({ ...loadBundle(), economy, banners: custom });
    expect(checkSummon(richSave(), BID, 1, c, NOW_ISO).reason).toBe('empty_pool');
  });

  it('the input save is never mutated; saveAfter is schema-valid and stamped with nowIso; counters advance', () => {
    const s = richSave();
    const before = JSON.stringify(s);
    const r = summon(s, BID, MULTI, content, { nowIso: NOW_ISO, seed: 5 });
    expect(JSON.stringify(s)).toBe(before);
    expect(validate(r.saveAfter)).toBe(true);
    expect(r.saveAfter.updated_at).toBe(NOW_ISO);
    expect(r.saveAfter.summon.total_pulls).toBe(MULTI);
    expect(r.saveAfter.currencies[CUR]).toBe(Math.min(CUR_MAX, CUR_MAX - BANNER.cost_multi + r.results.reduce((a, x) => a + x.jade_added, 0)));
    for (const x of r.results) {
      if (x.outcome === 'new') expect(r.saveAfter.roster.find((e) => e.character_id === x.character_id).obtained_at).toBe(NOW_ISO);
    }
  });

  it('a summon without seed or rng is a programming error (the logic never picks a random seed)', () => {
    expect(() => summon(richSave(), BID, 1, content, { nowIso: NOW_ISO })).toThrow();
  });

  it('enum lists are exported and every produced value is in them', () => {
    expect(SUMMON_REJECT_REASONS).toEqual(['unknown_banner', 'invalid_count', 'banner_closed', 'empty_pool', 'insufficient_currency', 'save_failed']);
    expect(SUMMON_OUTCOMES).toEqual(['new', 'resonance', 'jade']);
    expect(SUMMON_GUARANTEES).toEqual(['none', 'hard_pity', 'first_multi', 'multi']);
    expect(SUMMON_EVENT_TYPES).toEqual(['summon_charged', 'summon_pull', 'summon_pity_reset', 'summon_currency_capped']);
    let s = richSave();
    const seen = {};
    for (let i = 0; i < 50; i++) {
      const r = summon(s, BID, MULTI, content, { nowIso: NOW_ISO, seed: i });
      for (const e of r.events) expect(SUMMON_EVENT_TYPES).toContain(e.type);
      for (const x of r.results) {
        expect(SUMMON_OUTCOMES).toContain(x.outcome);
        expect(SUMMON_GUARANTEES).toContain(x.guarantee);
        seen[x.outcome] = true;
      }
      s = r.saveAfter;
      s.currencies[CUR] = CUR_MAX - BANNER.cost_multi * 2;
    }
    expect(Object.keys(seen).sort()).toEqual(SUMMON_OUTCOMES.slice().sort());
  });

  it('summoned fighters can be fielded in a battle with their Resonance', () => {
    let s = richSave();
    for (let i = 0; i < 5; i++) {
      s.currencies[CUR] = CUR_MAX;
      s = summon(s, BID, MULTI, content, { nowIso: NOW_ISO, seed: 31 + i }).saveAfter;
    }
    const fams = {};
    const team = [];
    for (const e of s.roster) {
      const ch = content.characters[e.character_id];
      if (!fams[ch.family] && team.length < 3 && e.resonance > 0) {
        fams[ch.family] = true;
        team.push({ characterId: e.character_id, resonance: e.resonance });
      }
    }
    expect(team.length).toBe(3);
    const b = createBattle({ content, stageId: 'stage_001', playerTeam: team, skipIntro: true }, 1);
    expect(b.getState().teams.player.fighters.length).toBe(3);
  });
});

describe('§11.3 steps 5–6: save once before the reveal (summonAndSave)', () => {
  it('AC-11.5: results and Jade are in storage when summonAndSave returns; reopening shows them once', () => {
    const st = memoryStorage();
    const loaded = loadSave(st, { validate, economy, characters: content.characters, nowMs: NOW });
    loaded.save.currencies[CUR] = Math.max(loaded.save.currencies[CUR], BANNER.cost_multi);
    const start = loaded.save.currencies[CUR];
    const r = summonAndSave(st, loaded.save, BID, MULTI, content, NOW + 1000, 1234);
    expect(r.ok).toBe(true);
    expect(r.saved).toBe(true);
    expect(r.seed).toBe(1234);
    const reopened = loadSave(st, { validate, economy, characters: content.characters, nowMs: NOW + 5000 });
    expect(reopened.damaged).toBe(false);
    expect(reopened.save).toEqual(r.saveAfter);
    expect(reopened.save.currencies[CUR]).toBe(start - BANNER.cost_multi + r.results.reduce((a, x) => a + x.jade_added, 0));
    for (const x of r.results) expect(reopened.save.roster.some((y) => y.character_id === x.character_id)).toBe(true);
    expect(reopened.save.summon.total_pulls).toBe(MULTI);
    expect(reopened.save.summon.first_multi_done[BID]).toBe(true);
    const third = loadSave(st, { validate, economy, characters: content.characters, nowMs: NOW + 9000 });
    expect(third.save.currencies[CUR]).toBe(reopened.save.currencies[CUR]);
  });

  it('AC-11.5: exactly one setItem per summon, of the whole save', () => {
    const st = memoryStorage();
    const writes = [];
    const spy = { getItem: st.getItem, setItem: (k, v) => { writes.push(k); st.setItem(k, v); } };
    const r = summonAndSave(spy, richSave(), BID, MULTI, content, NOW, 9);
    expect(r.ok).toBe(true);
    expect(writes).toEqual([SAVE_KEY]);
    expect(JSON.parse(st.getItem(SAVE_KEY))).toEqual(r.saveAfter);
  });

  it('AC-11.10: setItem throws → save_failed, nothing changed (Jade, roster, pity, first_multi_done, total_pulls), no results', () => {
    const s = richSave();
    s.summon.pity[GROUP] = 3;
    const before = JSON.stringify(s);
    const broken = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    const r = summonAndSave(broken, s, BID, MULTI, content, NOW, 9);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('save_failed');
    expect(r.saved).toBe(false);
    expect(r.results).toEqual([]);
    expect(r.saveAfter).toBe(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(SUMMON_REJECT_REASONS).toContain(r.reason);
  });

  it('a reject writes nothing', () => {
    const st = memoryStorage();
    const s = richSave(0);
    st.setItem(SAVE_KEY, JSON.stringify(s));
    const r = summonAndSave(st, s, BID, 1, content, NOW);
    expect(r.ok).toBe(false);
    expect(r.saved).toBe(false);
    expect(st.getItem(SAVE_KEY)).toBe(JSON.stringify(s));
  });

  it('without a seed, summonAndSave picks a uint32 seed (crypto) and returns it; the seed reproduces the summon', () => {
    const r = summonAndSave(memoryStorage(), richSave(), BID, 1, content, NOW);
    expect(r.ok).toBe(true);
    expect(Number.isInteger(r.seed)).toBe(true);
    expect(r.seed).toBeGreaterThanOrEqual(0);
    expect(r.seed).toBeLessThan(4294967296);
    const again = summon(richSave(), BID, 1, content, { nowIso: NOW_ISO, seed: r.seed });
    expect(again.results).toEqual(r.results);
    const seeds = new Set();
    for (let i = 0; i < 20; i++) seeds.add(randomSummonSeed());
    expect(seeds.size).toBeGreaterThan(1);
  });
});
