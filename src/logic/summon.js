// Summon (gacha) logic — GDD §11. Pure and deterministic: no DOM, no storage, no clock, no Math.random.
// Soft currency only (no real money). All rates, costs, pity and duplicate numbers come from
// data/banners.json and data/economy.json.
//
// RNG and anti-reroll (GDD §11.3): unless a test injects `options.rng`, every pull k (k = the save's
// `summon.total_pulls` before that pull, counted over all banners) uses its own generator
// `summonRngForPull(save, k)`, seeded from a hash of the save's `created_at` and k. Both values are in
// the save, and the results + new total_pulls are written BEFORE the reveal (see src/state/summon-save.js),
// so quitting and summoning again from the same save gives exactly the same fighters. No new save field
// is needed. Port note: 32-bit integer math only (C#: uint + unchecked).

import { SeededRng } from './rng.js';
import { grantCharacter, addCurrency } from '../state/save.js';

/** Why a summon was refused (nothing in the save changes). */
export const SUMMON_REJECT_REASONS = ['unknown_banner', 'invalid_count', 'banner_closed', 'empty_pool', 'insufficient_currency'];
/** What a pulled copy became (GDD §11.4): new fighter, Resonance +1, or Jade after max Resonance. */
export const SUMMON_OUTCOMES = ['new', 'resonance', 'currency'];
/** Which guarantee forced a pull (GDD §11.3 order of checks); 'none' = normal roll. */
export const SUMMON_GUARANTEES = ['none', 'hard_pity', 'first_multi', 'multi'];
/** Event types returned by summon(). */
export const SUMMON_EVENT_TYPES = ['summon_charged', 'summon_pull', 'summon_pity_reset', 'summon_currency_capped'];

/** Own-property lookup (ids like "constructor" never hit Object.prototype). */
function own(map, key) {
  if (!map || typeof map !== 'object' || typeof key !== 'string') return undefined;
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
}

/** Banner record by id, or null. content.banners = map id → banner (createContent). */
export function getBanner(content, bannerId) {
  const b = own(content && content.banners, bannerId);
  return b || null;
}

/** Rarities of a banner (numbers, ascending) from its rates_bp keys. */
function rarityList(banner) {
  const list = [];
  for (const k of Object.keys(banner.rates_bp)) list.push(Number(k));
  list.sort((a, b) => a - b);
  return list;
}

/** Highest rarity on the banner (★5). Hard pity and pity reset use it. */
function topRarity(banner) {
  const list = rarityList(banner);
  return list[list.length - 1];
}

/**
 * Fighters of one rarity with integer weights (GDD §11.2). Featured fighters weigh share_bp × n and each
 * non-featured fighter weighs (10000 − Σ featured share_bp), where n = number of non-featured fighters;
 * this is the GDD split with no fractions. Pool ids missing from the data are ignored.
 * Returns [{ characterId, weight, featured }].
 */
function fightersOfRarity(banner, content, rarity) {
  const featuredShare = {};
  for (const f of banner.featured) featuredShare[f.character_id] = f.share_bp;
  const feat = [];
  const nonFeat = [];
  let featSum = 0;
  for (const id of banner.pool) {
    const ch = own(content.characters, id);
    if (!ch || ch.playable === false || ch.rarity !== rarity) continue;
    const share = own(featuredShare, id);
    if (share !== undefined) {
      feat.push({ characterId: id, share: share });
      featSum += share;
    } else {
      nonFeat.push(id);
    }
  }
  const out = [];
  const n = nonFeat.length;
  const rest = Math.max(0, 10000 - featSum);
  for (const id of banner.pool) {
    for (const f of feat) if (f.characterId === id) out.push({ characterId: id, weight: n > 0 ? f.share * n : f.share, featured: true });
    if (nonFeat.indexOf(id) >= 0) out.push({ characterId: id, weight: rest, featured: false });
  }
  return out.filter((x) => x.weight > 0);
}

/** Rarities that can be rolled: rate > 0, at least one fighter, and ≥ minRarity. [{ rarity, bp }]. */
function rollableRarities(banner, content, minRarity) {
  const out = [];
  for (const r of rarityList(banner)) {
    const bp = banner.rates_bp[String(r)];
    if (r < minRarity || !(bp > 0)) continue;
    if (fightersOfRarity(banner, content, r).length === 0) continue;
    out.push({ rarity: r, bp: bp });
  }
  return out;
}

/** Pick an index from integer weights with rng.nextInt(total). */
function pickWeighted(weights, rng) {
  let total = 0;
  for (const w of weights) total += w;
  let roll = rng.nextInt(total);
  for (let i = 0; i < weights.length; i++) {
    if (roll < weights[i]) return i;
    roll -= weights[i];
  }
  return weights.length - 1;
}

/**
 * One pull (GDD §11.2/§11.3): roll a rarity among rarities ≥ minRarity, renormalized over their bp
 * (minRarity 0 = normal roll; e.g. 4 gives ★5 300/2000, ★4 1700/2000), then a fighter by weight.
 * If no rarity ≥ minRarity can be rolled, falls back to a normal roll. Returns { characterId, rarity }
 * or null if the banner has no rollable fighter. Uses 2 RNG draws.
 */
export function drawPull(banner, content, rng, minRarity) {
  let rars = rollableRarities(banner, content, minRarity || 0);
  if (rars.length === 0) rars = rollableRarities(banner, content, 0);
  if (rars.length === 0) return null;
  const rarity = rars[pickWeighted(rars.map((x) => x.bp), rng)].rarity;
  const fighters = fightersOfRarity(banner, content, rarity);
  const f = fighters[pickWeighted(fighters.map((x) => x.weight), rng)];
  return { characterId: f.characterId, rarity: rarity };
}

/** FNV-1a 32-bit hash of a string (port: uint, unchecked). */
function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i) & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Base summon seed of a save: hash of `created_at` (fixed for the life of the save). */
export function summonSeed(save) {
  return hashString(String(save && save.created_at));
}

/** The generator for global pull number `pullIndex` (0-based) of this save. Same save + index → same stream. */
export function summonRngForPull(save, pullIndex) {
  const mixed = (summonSeed(save) ^ Math.imul((pullIndex + 1) >>> 0, 0x9e3779b1)) >>> 0;
  const rng = new SeededRng(mixed);
  rng.next(); // discard the first output so close seeds decorrelate
  return rng;
}

/** Is the banner open at nowIso? start_at/end_at null = always open. No nowIso = not checked. */
function bannerOpen(banner, nowIso) {
  if (!nowIso) return true;
  const now = Date.parse(nowIso);
  if (banner.start_at && now < Date.parse(banner.start_at)) return false;
  if (banner.end_at && now >= Date.parse(banner.end_at)) return false;
  return true;
}

/** Valid pull counts for a banner: 1 and multi_count (10). */
function validCount(banner, count) {
  return count === 1 || count === banner.multi_count;
}

/**
 * Can the player summon? Used for button enable state and the confirm dialog (cost, balance after).
 * Returns { ok, reason (null or one of SUMMON_REJECT_REASONS), bannerId, count, currencyId, cost,
 * balance, balanceAfter }. Checks in this order: banner, count, open window, pool, currency.
 */
export function checkSummon(save, bannerId, count, content, nowIso) {
  const out = { ok: false, reason: null, bannerId: bannerId, count: count, currencyId: null, cost: 0, balance: 0, balanceAfter: 0 };
  const banner = getBanner(content, bannerId);
  if (!banner) {
    out.reason = 'unknown_banner';
    return out;
  }
  out.currencyId = banner.currency_id;
  const bal = own(save && save.currencies, banner.currency_id);
  out.balance = typeof bal === 'number' ? bal : 0;
  if (!validCount(banner, count)) {
    out.reason = 'invalid_count';
    out.balanceAfter = out.balance;
    return out;
  }
  out.cost = count === 1 ? banner.cost_single : banner.cost_multi;
  out.balanceAfter = out.balance - out.cost;
  if (!bannerOpen(banner, nowIso)) out.reason = 'banner_closed';
  else if (rollableRarities(banner, content, 0).length === 0) out.reason = 'empty_pool';
  else if (out.balance < out.cost) out.reason = 'insufficient_currency';
  if (out.reason) {
    out.balanceAfter = out.balance;
    return out;
  }
  out.ok = true;
  return out;
}

/** Pity counter of a group in the save (0 if missing or invalid). */
function pityCounter(save, group) {
  const v = own(save && save.summon && save.summon.pity, group);
  return typeof v === 'number' && v >= 0 && Math.floor(v) === v ? v : 0;
}

/** Has the player done their first ×10 on this banner? */
function firstMultiDone(save, bannerId) {
  return own(save && save.summon && save.summon.first_multi_done, bannerId) === true;
}

/**
 * Summon `count` (1 or banner.multi_count) on a banner. Pure: `save` is not changed.
 * options = { nowIso (ISO string: obtained_at, updated_at, banner window), rng? (tests only; one
 * generator for all pulls — otherwise the save-derived per-pull generator is used) }.
 * Per pull, in GDD §11.3 order: hard pity (counter ≥ hard_pity − 1 → ★5), first-×10 guarantee (last pull
 * of the first ×10 on this banner, if pulls 1–9 had nothing ≥ first_multi_min_rarity), ×10 guarantee
 * (last pull, nothing ≥ multi_min_rarity so far), else a normal roll. ★5 resets the group's counter,
 * anything else adds 1. Each copy goes through the duplicate rules (§11.4).
 * Returns { ok, reason, results: [{ characterId, rarity, isNew, outcome, resonanceAfter, jadeRefund,
 * guarantee }], saveAfter, events, cost, currencyId, balanceAfter }.
 * On a reject: ok false, results [], events [], saveAfter === save (unchanged).
 * The caller MUST persist saveAfter before showing the reveal (src/state/summon-save.js does it).
 */
export function summon(save, bannerId, count, content, options) {
  const opts = options || {};
  const nowIso = opts.nowIso || (save && save.updated_at) || null;
  const chk = checkSummon(save, bannerId, count, content, opts.nowIso || null);
  if (!chk.ok) {
    return { ok: false, reason: chk.reason, results: [], saveAfter: save, events: [], cost: chk.cost, currencyId: chk.currencyId, balanceAfter: chk.balance };
  }
  const banner = getBanner(content, bannerId);
  const economy = content.economy;
  const s = JSON.parse(JSON.stringify(save));
  if (!s.summon || typeof s.summon !== 'object') s.summon = { pity: {}, first_multi_done: {}, total_pulls: 0 };
  if (!s.summon.pity || typeof s.summon.pity !== 'object') s.summon.pity = {};
  if (!s.summon.first_multi_done || typeof s.summon.first_multi_done !== 'object') s.summon.first_multi_done = {};
  if (typeof s.summon.total_pulls !== 'number' || s.summon.total_pulls < 0) s.summon.total_pulls = 0;

  const events = [];
  const results = [];
  const cur = banner.currency_id;
  s.currencies[cur] = chk.balance - chk.cost;
  events.push({ type: 'summon_charged', bannerId: bannerId, currencyId: cur, amount: chk.cost, balanceAfter: s.currencies[cur] });

  const top = topRarity(banner);
  const group = banner.pity.group;
  const hard = banner.pity.hard_pity;
  let counter = pityCounter(s, group);
  const isMulti = count > 1 && count === banner.multi_count;
  const firstMin = typeof banner.first_multi_min_rarity === 'number' ? banner.first_multi_min_rarity : 0;
  const useFirstMulti = isMulti && firstMin > 0 && !firstMultiDone(s, bannerId);
  const multiMin = typeof banner.multi_min_rarity === 'number' ? banner.multi_min_rarity : 0;
  let best = 0;
  let lostToCap = 0;

  for (let i = 0; i < count; i++) {
    const rng = opts.rng || summonRngForPull(s, s.summon.total_pulls);
    const last = i === count - 1;
    let guarantee = 'none';
    let minRarity = 0;
    if (counter >= hard - 1) {
      guarantee = 'hard_pity';
      minRarity = top;
    } else if (last && useFirstMulti && best < firstMin) {
      guarantee = 'first_multi';
      minRarity = firstMin;
    } else if (last && isMulti && multiMin > 0 && best < multiMin) {
      guarantee = 'multi';
      minRarity = multiMin;
    }
    const pull = drawPull(banner, content, rng, minRarity);
    if (pull.rarity > best) best = pull.rarity;
    if (pull.rarity >= top) {
      counter = 0;
      events.push({ type: 'summon_pity_reset', group: group, index: i });
    } else {
      counter += 1;
    }
    s.summon.total_pulls += 1;

    const ch = own(content.characters, pull.characterId);
    const before = typeof own(s.currencies, economy.duplicates.overflow_currency_id) === 'number' ? s.currencies[economy.duplicates.overflow_currency_id] : 0;
    const g = grantCharacter(s, economy, ch, nowIso);
    let resonanceAfter = 0;
    for (const e of s.roster) if (e.character_id === pull.characterId) { resonanceAfter = e.resonance; break; }
    let refund = 0;
    if (g.kind === 'currency') {
      refund = g.amount;
      const added = s.currencies[economy.duplicates.overflow_currency_id] - before;
      lostToCap += refund - added;
    }
    const result = {
      characterId: pull.characterId,
      rarity: pull.rarity,
      isNew: g.kind === 'new',
      outcome: g.kind,
      resonanceAfter: resonanceAfter,
      jadeRefund: refund,
      guarantee: guarantee,
    };
    results.push(result);
    events.push({ type: 'summon_pull', index: i, result: result });
  }
  if (lostToCap > 0) events.push({ type: 'summon_currency_capped', currencyId: economy.duplicates.overflow_currency_id, lost: lostToCap });
  s.summon.pity[group] = counter;
  if (isMulti) s.summon.first_multi_done[bannerId] = true;
  if (nowIso) s.updated_at = nowIso;
  return { ok: true, reason: null, results: results, saveAfter: s, events: events, cost: chk.cost, currencyId: cur, balanceAfter: s.currencies[cur] };
}

/** Integer basis points → percent text with 2 decimals (300 → "3.00"). Integer math, no float rounding. */
export function bpToPercentText(bp) {
  const whole = Math.floor(bp / 100);
  const frac = bp % 100;
  return whole + '.' + (frac < 10 ? '0' : '') + frac;
}

/**
 * Display rates for the Rates screen (GDD §11.1, AC-11.4). Returns null for an unknown banner, else
 * { bannerId, name, currencyId, costSingle, costMulti, multiCount,
 *   rarities: [{ rarity, bp, percentText }] (descending rarity),
 *   fighters: [{ characterId, rarity, featured, exactBp, bp, percentText }] (descending rarity, pool order),
 *   rules: { pityGroup, hardPity, multiMinRarity, firstMultiMinRarity|null, maxResonance,
 *            overflowCurrencyId, overflowAmountByRarity } }.
 * Per-fighter `bp` is exactBp rounded to whole bp (0.01%) with the largest-remainder method, so the shown
 * per-fighter values in a rarity add up exactly to the rarity's rate. `exactBp` is the unrounded rate.
 */
export function getBannerRates(bannerId, content) {
  const banner = getBanner(content, bannerId);
  if (!banner) return null;
  const rars = rarityList(banner).slice().reverse();
  const rarities = [];
  const fighters = [];
  for (const r of rars) {
    const bp = banner.rates_bp[String(r)];
    rarities.push({ rarity: r, bp: bp, percentText: bpToPercentText(bp) });
    const list = fightersOfRarity(banner, content, r);
    let total = 0;
    for (const f of list) total += f.weight;
    const rows = [];
    let floorSum = 0;
    for (const f of list) {
      const exact = total > 0 ? (bp * f.weight) / total : 0;
      const fl = total > 0 ? Math.floor((bp * f.weight) / total) : 0;
      const rem = total > 0 ? (bp * f.weight) % total : 0; // integer remainder: exact ordering
      floorSum += fl;
      rows.push({ characterId: f.characterId, rarity: r, featured: f.featured, exactBp: exact, bp: fl, rem: rem });
    }
    let left = list.length > 0 ? bp - floorSum : 0;
    const order = rows.map((x, i) => i).sort((a, b) => rows[b].rem - rows[a].rem || a - b);
    for (let k = 0; k < order.length && left > 0; k++, left--) rows[order[k]].bp += 1;
    for (const row of rows) {
      fighters.push({ characterId: row.characterId, rarity: row.rarity, featured: row.featured, exactBp: row.exactBp, bp: row.bp, percentText: bpToPercentText(row.bp) });
    }
  }
  const dup = content.economy ? content.economy.duplicates : null;
  return {
    bannerId: banner.id,
    name: banner.name,
    currencyId: banner.currency_id,
    costSingle: banner.cost_single,
    costMulti: banner.cost_multi,
    multiCount: banner.multi_count,
    rarities: rarities,
    fighters: fighters,
    rules: {
      pityGroup: banner.pity.group,
      hardPity: banner.pity.hard_pity,
      multiMinRarity: banner.multi_min_rarity,
      firstMultiMinRarity: typeof banner.first_multi_min_rarity === 'number' ? banner.first_multi_min_rarity : null,
      maxResonance: dup ? dup.max_resonance : null,
      overflowCurrencyId: dup ? dup.overflow_currency_id : null,
      overflowAmountByRarity: dup ? dup.overflow_amount_by_rarity : null,
    },
  };
}

/**
 * Pity status for the always-visible line "★5 guaranteed within N summons" (GDD §11.1).
 * Returns null for an unknown banner, else { bannerId, group, counter, hardPity, pullsUntilGuaranteed
 * (= hard_pity − counter, at least 1), firstMultiAvailable, firstMultiMinRarity|null }.
 */
export function getPityStatus(save, bannerId, content) {
  const banner = getBanner(content, bannerId);
  if (!banner) return null;
  const counter = pityCounter(save, banner.pity.group);
  const firstMin = typeof banner.first_multi_min_rarity === 'number' ? banner.first_multi_min_rarity : null;
  return {
    bannerId: banner.id,
    group: banner.pity.group,
    counter: counter,
    hardPity: banner.pity.hard_pity,
    pullsUntilGuaranteed: Math.max(1, banner.pity.hard_pity - counter),
    firstMultiAvailable: firstMin !== null && !firstMultiDone(save, banner.id),
    firstMultiMinRarity: firstMin,
  };
}
