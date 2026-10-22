// Summon (gacha) logic — GDD §11 (round 3 exact rules). Pure and deterministic: no DOM, no storage,
// no clock, no Math.random. Soft currency only (no real money). All rates, costs, pity and duplicate
// numbers come from data/banners.json and data/economy.json.
//
// RNG (GDD §11.3): one summon action uses one generator with `next()` in [0, 1). Every pull makes
// exactly 2 next() calls: (A) rarity, (B) fighter — call A also on forced pulls (its value is ignored).
// The caller passes the seed (or a generator in tests); the seed is returned for bug reports and is not
// saved. Choosing a random seed (crypto) is done outside the logic, in src/state/summon-save.js.
// Anti-reroll comes from saving the result before the reveal (src/state/summon-save.js).
// Port note: integer weights and floor() only; C# can mirror this line by line.

import { SeededRng } from './rng.js';
import { grantCharacter } from '../state/save.js';

/** Why a summon was refused (nothing changes). `save_failed` comes from summonAndSave (write threw). */
export const SUMMON_REJECT_REASONS = ['unknown_banner', 'invalid_count', 'banner_closed', 'empty_pool', 'insufficient_currency', 'save_failed'];
/** What a pulled copy became (GDD §11.3/§11.4): new fighter, Resonance +1, or Jade after max Resonance. */
export const SUMMON_OUTCOMES = ['new', 'resonance', 'jade'];
/** Which rule decided the rarity (GDD §11.3); 'none' = normal draw. */
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

/** Rate of a rarity in bp (missing → 0). */
function rateBp(banner, rarity) {
  const v = own(banner.rates_bp, String(rarity));
  return typeof v === 'number' ? v : 0;
}

/** Rarities of a banner, highest first (the GDD walk order ★5 → ★4 → ★3). */
function raritiesDesc(banner) {
  const list = [];
  for (const k of Object.keys(banner.rates_bp)) list.push(Number(k));
  list.sort((a, b) => b - a);
  return list;
}

/** Highest rarity (★5): hard pity target and pity reset. */
function topRarity(banner) {
  return raritiesDesc(banner)[0];
}

/** Is this pool id a known, playable fighter of `rarity`? */
function fighterOf(content, id, rarity) {
  const ch = own(content.characters, id);
  return !!(ch && ch.playable !== false && ch.rarity === rarity);
}

/**
 * Candidate list L_k with integer weights (GDD §11.2 round 3): featured fighters of rarity k in
 * `featured[]` order, then the non-featured pool fighters of rarity k in `pool[]` order.
 * n = non-featured count, S = Σ featured share_bp. n > 0: featured = share × n, non-featured = 10000 − S,
 * W = 10000 × n. n = 0: featured = share, W = S. Returns { list: [{ characterId, weight, featured }], total }.
 */
export function fighterWeights(banner, content, rarity) {
  const feat = [];
  const featIds = {};
  let S = 0;
  for (const f of banner.featured) {
    if (banner.pool.indexOf(f.character_id) < 0 || !fighterOf(content, f.character_id, rarity)) continue;
    feat.push(f);
    featIds[f.character_id] = true;
    S += f.share_bp;
  }
  const nonFeat = [];
  for (const id of banner.pool) {
    if (own(featIds, id) || !fighterOf(content, id, rarity)) continue;
    nonFeat.push(id);
  }
  const n = nonFeat.length;
  const list = [];
  for (const f of feat) list.push({ characterId: f.character_id, weight: n > 0 ? f.share_bp * n : f.share_bp, featured: true });
  const rest = Math.max(0, 10000 - S);
  for (const id of nonFeat) list.push({ characterId: id, weight: rest, featured: false });
  return { list: list, total: n > 0 ? 10000 * n : S };
}

/**
 * Rarity from call A (GDD §11.3 rules 2/3). minRarity 0 = normal draw over 10000; otherwise only rarities
 * ≥ minRarity, T = Σ their rates, r = floor(A × T), T = 0 → top rarity. Walk ★5 → ★4 → ★3.
 */
export function rarityFromRoll(banner, a, minRarity) {
  const rars = raritiesDesc(banner);
  let T = 0;
  for (const k of rars) if (k >= minRarity) T += rateBp(banner, k);
  if (minRarity <= 0) T = 10000;
  if (T <= 0) return rars[0];
  const r = Math.floor(a * T);
  let cum = 0;
  let last = rars[0];
  for (const k of rars) {
    if (k < minRarity) continue;
    cum += rateBp(banner, k);
    last = k;
    if (r < cum) return k;
  }
  return last;
}

/** Fighter from call B: w = floor(B × W_k); first candidate whose cumulative weight exceeds w. Null if none. */
export function fighterFromRoll(banner, content, rarity, b) {
  const fw = fighterWeights(banner, content, rarity);
  if (fw.total <= 0 || fw.list.length === 0) return null;
  const w = Math.floor(b * fw.total);
  let cum = 0;
  for (const f of fw.list) {
    cum += f.weight;
    if (w < cum) return f.characterId;
  }
  // only reachable if weights do not add up to W (invalid data): take the last fighter with weight > 0
  for (let i = fw.list.length - 1; i >= 0; i--) if (fw.list[i].weight > 0) return fw.list[i].characterId;
  return null;
}

/**
 * One pull with exactly 2 rng.next() calls: A (rarity), B (fighter). forcedRarity (e.g. 5 for hard pity)
 * ignores A; otherwise minRarity applies (0 = normal draw). Returns { characterId, rarity }.
 */
export function drawPull(banner, content, rng, minRarity, forcedRarity) {
  const a = rng.next();
  const b = rng.next();
  const rarity = forcedRarity ? forcedRarity : rarityFromRoll(banner, a, minRarity || 0);
  return { characterId: fighterFromRoll(banner, content, rarity, b), rarity: rarity };
}

/** Banner open at nowIso (GDD §11.1): (start_at null or now ≥ start) and (end_at null or now < end). No nowIso = open. */
export function isBannerOpen(banner, nowIso) {
  if (!nowIso) return true;
  const now = Date.parse(nowIso);
  if (banner.start_at && now < Date.parse(banner.start_at)) return false;
  if (banner.end_at && now >= Date.parse(banner.end_at)) return false;
  return true;
}

/** Banners to show at nowIso, in data order (GDD §11.1, AC-11.13). Empty → "No summons available right now." */
export function getOpenBanners(content, nowIso) {
  const out = [];
  for (const id of Object.keys(content.banners || {})) {
    const b = content.banners[id];
    if (isBannerOpen(b, nowIso)) out.push(b);
  }
  return out;
}

/** Every rarity that can be drawn (rate > 0, plus ★5 for hard pity) has at least one fighter. */
function poolUsable(banner, content) {
  const top = topRarity(banner);
  for (const k of raritiesDesc(banner)) {
    if (rateBp(banner, k) <= 0 && k !== top) continue;
    if (fighterWeights(banner, content, k).total <= 0) return false;
  }
  return true;
}

/**
 * Can the player summon? Button state and confirm dialog (cost, balance after).
 * Returns { ok, reason (null or a SUMMON_REJECT_REASONS value), bannerId, count, currencyId, cost, balance,
 * balanceAfter }. Order: banner, count, open, pool, currency. Pass nowIso to check the banner window.
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
  out.balanceAfter = out.balance;
  if (count !== 1 && count !== banner.multi_count) {
    out.reason = 'invalid_count';
    return out;
  }
  out.cost = count === 1 ? banner.cost_single : banner.cost_multi;
  if (!isBannerOpen(banner, nowIso)) out.reason = 'banner_closed';
  else if (!poolUsable(banner, content)) out.reason = 'empty_pool';
  else if (out.balance < out.cost) out.reason = 'insufficient_currency';
  if (out.reason) return out;
  out.ok = true;
  out.balanceAfter = out.balance - out.cost;
  return out;
}

/** Pity counter of a group (missing or invalid → 0). */
function pityCounter(save, group) {
  const v = own(save && save.summon && save.summon.pity, group);
  return typeof v === 'number' && v >= 0 && Math.floor(v) === v ? v : 0;
}

/** Has the first ×10 on this banner been done? (missing → false) */
function firstMultiDone(save, bannerId) {
  return own(save && save.summon && save.summon.first_multi_done, bannerId) === true;
}

/**
 * One summon action (GDD §11.3 steps 1–4). Pure: `save` is not changed.
 * options = { nowIso (obtained_at, updated_at, banner window), seed (uint32) or rng ({ next() }, tests) }.
 * One of seed/rng is required (the logic never picks a random seed itself).
 * Returns { ok, reason, seed, banner_id, count, cost, jade_before, jade_after, pity_before, pity_after,
 *   results: [{ pull (1-based), character_id, rarity, outcome, resonance_after, jade_added, guarantee }],
 *   saveAfter, events }.
 * On a reject: ok false, results [], events [], saveAfter === save (unchanged).
 * The caller must persist saveAfter before the reveal (use summonAndSave in src/state/summon-save.js).
 */
export function summon(save, bannerId, count, content, options) {
  const opts = options || {};
  const nowIso = opts.nowIso || null;
  const banner = getBanner(content, bannerId);
  const chk = checkSummon(save, bannerId, count, content, nowIso);
  const group = banner ? banner.pity.group : null;
  const pityBefore = banner ? pityCounter(save, group) : 0;
  let seed = typeof opts.seed === 'number' ? opts.seed >>> 0 : null;
  const out = {
    ok: false, reason: chk.reason, seed: seed, banner_id: bannerId, count: count, cost: chk.cost,
    jade_before: chk.balance, jade_after: chk.balance, pity_before: pityBefore, pity_after: pityBefore,
    results: [], saveAfter: save, events: [],
  };
  if (!chk.ok) return out;
  let rng = opts.rng || null;
  if (!rng) {
    if (seed === null) throw new Error('summon needs options.seed or options.rng');
    rng = new SeededRng(seed);
  } else if (seed === null && typeof rng.seed === 'number') {
    out.seed = rng.seed;
  }

  const economy = content.economy;
  const s = JSON.parse(JSON.stringify(save));
  if (!s.summon || typeof s.summon !== 'object') s.summon = { pity: {}, first_multi_done: {}, total_pulls: 0 };
  if (!s.summon.pity || typeof s.summon.pity !== 'object') s.summon.pity = {};
  if (!s.summon.first_multi_done || typeof s.summon.first_multi_done !== 'object') s.summon.first_multi_done = {};
  if (typeof s.summon.total_pulls !== 'number' || s.summon.total_pulls < 0) s.summon.total_pulls = 0;

  // step 2: pay
  const cur = banner.currency_id;
  s.currencies[cur] = chk.balance - chk.cost;
  out.events.push({ type: 'summon_charged', bannerId: bannerId, currencyId: cur, amount: chk.cost, balanceAfter: s.currencies[cur] });

  // step 3: pulls
  const top = topRarity(banner);
  const hard = banner.pity.hard_pity;
  let counter = pityBefore;
  const isMulti = count === banner.multi_count && count > 1;
  let min = typeof banner.multi_min_rarity === 'number' ? banner.multi_min_rarity : 0;
  let firstRaised = false;
  if (typeof banner.first_multi_min_rarity === 'number' && !firstMultiDone(s, bannerId) && banner.first_multi_min_rarity > min) {
    min = banner.first_multi_min_rarity;
    firstRaised = true;
  }
  let metMin = false;
  let lostToCap = 0;
  const dupCur = economy.duplicates.overflow_currency_id;
  for (let i = 1; i <= count; i++) {
    let guarantee = 'none';
    let forced = 0;
    let minRarity = 0;
    if (counter >= hard - 1) {
      guarantee = 'hard_pity';
      forced = top;
    } else if (isMulti && i === count && !metMin) {
      guarantee = firstRaised ? 'first_multi' : 'multi';
      minRarity = min;
    }
    const pull = drawPull(banner, content, rng, minRarity, forced);
    if (pull.rarity >= min) metMin = true;
    if (pull.rarity >= top) {
      counter = 0;
      out.events.push({ type: 'summon_pity_reset', group: group, pull: i });
    } else {
      counter += 1;
    }
    const ch = own(content.characters, pull.characterId);
    const g = grantCharacter(s, economy, ch, nowIso);
    let resonanceAfter = 0;
    for (const e of s.roster) {
      if (e.character_id === pull.characterId) {
        resonanceAfter = e.resonance;
        break;
      }
    }
    let added = 0;
    let outcome = g.kind;
    if (g.kind === 'currency') {
      outcome = 'jade';
      added = g.credited;
      lostToCap += g.amount - added;
    }
    const result = {
      pull: i,
      character_id: pull.characterId,
      rarity: pull.rarity,
      outcome: outcome,
      resonance_after: resonanceAfter,
      jade_added: added,
      guarantee: guarantee,
    };
    out.results.push(result);
    out.events.push({ type: 'summon_pull', pull: i, result: result });
  }
  if (lostToCap > 0) out.events.push({ type: 'summon_currency_capped', currencyId: dupCur, lost: lostToCap });

  // step 4: counters
  s.summon.pity[group] = counter;
  if (isMulti) s.summon.first_multi_done[bannerId] = true;
  s.summon.total_pulls += count;
  if (nowIso) s.updated_at = nowIso;

  out.ok = true;
  out.reason = null;
  out.jade_after = s.currencies[cur];
  out.pity_after = counter;
  out.saveAfter = s;
  return out;
}

/** Integer basis points → percent text with 2 decimals (300 → "3.00"). */
export function bpToPercentText(bp) {
  const whole = Math.floor(bp / 100);
  const frac = bp % 100;
  return whole + '.' + (frac < 10 ? '0' : '') + frac;
}

/**
 * Display rates for the Rates screen (GDD §11.2 round 3, AC-11.4). Null for an unknown banner, else
 * { bannerId, name, currencyId, costSingle, costMulti, multiCount,
 *   rarities: [{ rarity, bp, percentText }] (★5 first),
 *   fighters: [{ characterId, rarity, featured, weight, totalWeight, exactBp, bp, percentText }] (★5 first, L_k order),
 *   rules: { pityGroup, hardPity, multiMinRarity, firstMultiMinRarity|null, maxResonance, overflowCurrencyId,
 *            overflowAmountByRarity } }.
 * Fighter exact rate = rates_bp[k] × weight / W_k (in bp); `bp` = that rounded half-up to a whole bp (= 0.01%),
 * so `percentText` is the GDD's "rounded half-up to 2 decimals". Rounded values may not add up to the rarity
 * rate; the screen shows the GDD rounding note.
 */
export function getBannerRates(bannerId, content) {
  const banner = getBanner(content, bannerId);
  if (!banner) return null;
  const rarities = [];
  const fighters = [];
  for (const k of raritiesDesc(banner)) {
    const bp = rateBp(banner, k);
    rarities.push({ rarity: k, bp: bp, percentText: bpToPercentText(bp) });
    const fw = fighterWeights(banner, content, k);
    for (const f of fw.list) {
      const num = bp * f.weight;
      const rounded = fw.total > 0 ? Math.floor((2 * num + fw.total) / (2 * fw.total)) : 0; // half-up, integers only
      fighters.push({
        characterId: f.characterId,
        rarity: k,
        featured: f.featured,
        weight: f.weight,
        totalWeight: fw.total,
        exactBp: fw.total > 0 ? num / fw.total : 0,
        bp: rounded,
        percentText: bpToPercentText(rounded),
      });
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
 * Pity status (GDD §11.1, AC-11.11): "★5 guaranteed within N summons." with N = max(1, hard_pity − counter),
 * and the first-×10 line while firstMultiAvailable. Null for an unknown banner, else { bannerId, group, counter,
 * hardPity, pullsUntilGuaranteed, firstMultiAvailable, firstMultiMinRarity|null }.
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
