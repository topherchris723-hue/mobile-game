// Summon screen view-model (GDD §11). Pure: no Phaser, so it is unit-tested. Every rule and number comes
// from src/logic (getOpenBanners, checkSummon, getBannerRates, getPityStatus) and data; this file only turns
// them into display strings. Every SUMMON_* enum value maps to a strings.json key (L-shared-009).
import { getOpenBanners, checkSummon, getBannerRates, getPityStatus } from '../logic/index.js';
import { t, hasString } from './strings.js';

/** 1000 → "1,000" (fixed en grouping until localisation). */
export function formatNum(n) {
  const s = String(Math.trunc(Math.abs(n)));
  const g = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-' : '') + g;
}

/** Rarity accent colours for the placeholder reveal (★3 blue, ★4 violet, ★5 gold). Shape cues come with it. */
export const RARITY_COLORS = { 3: 0x5aa9ff, 4: 0xb06bff, 5: 0xffc23d };
export function rarityColor(r) {
  return RARITY_COLORS[r] !== undefined ? RARITY_COLORS[r] : 0x8a90b0;
}

export function stars(r) {
  return '★'.repeat(Math.max(0, r | 0));
}

/** Key lookups for logic enums. Missing key → throws in tests via the enumerating test; never shows [key]. */
export const outcomeKey = (o) => 'summon_outcome_' + o;
export const guaranteeKey = (g) => 'summon_guarantee_' + g;
export const reasonKey = (r) => 'summon_reason_' + r;
export const eventKey = (e) => 'summon_event_' + e;

/** Results-grid tag for one pull: NEW / Resonance +1 (Rn) / +N Jade (jade_added, can be 0). */
export function outcomeTag(result) {
  const key = outcomeKey(result.outcome);
  if (!hasString(key)) return '';
  return t(key, { rank: result.resonance_after, amount: formatNum(result.jade_added || 0) });
}

/** Optional reveal callout ("" for a normal draw). */
export function guaranteeText(g, count) {
  const key = guaranteeKey(g);
  return hasString(key) ? t(key, { count: count }) : '';
}

/** Player-facing text for a refused summon (incl. save_failed). */
export function rejectText(reason) {
  const key = reasonKey(reason);
  return hasString(key) ? t(key) : t('summon_reason_save_failed');
}

/** Text for a summon event (reveal sequence / Jade-cap warning). */
export function eventText(ev, currencyName) {
  const key = eventKey(ev.type);
  if (!hasString(key)) return '';
  return t(key, {
    amount: formatNum(ev.amount || 0),
    currency: currencyName || '',
    pull: ev.pull !== undefined ? ev.pull : '',
    lost: formatNum(ev.lost || 0),
  });
}

/** Highest rarity of a banner (the pity target, "★5"). */
function topRarity(rates) {
  return rates.rarities.reduce((m, r) => Math.max(m, r.rarity), 0);
}

/**
 * Everything the Summon screen shows, from logic. Returns { banner: null } when no banner is open
 * ("No summons available right now.", no Summon buttons).
 */
export function summonScreenModel(save, content, nowIso, currencyName) {
  const open = getOpenBanners(content, nowIso);
  if (!open.length) return { banner: null, noneText: t('summon_none_open') };
  const banner = open[0];
  const rates = getBannerRates(banner.id, content);
  const pity = getPityStatus(save, banner.id, content);
  const top = topRarity(rates);
  const cur = currencyName || '';
  const button = (count) => {
    const chk = checkSummon(save, banner.id, count, content, nowIso);
    return {
      id: count === 1 ? 'summon_x1' : 'summon_x' + count,
      count: count,
      cost: chk.cost,
      ok: chk.ok,
      reason: chk.reason,
      balance: chk.balance,
      balanceAfter: chk.balanceAfter,
      label: t('summon_button', { count: count, cost: formatNum(chk.cost), currency: cur }),
      sublabel: chk.ok ? '' : rejectText(chk.reason),
      confirmText: t('summon_confirm_text', { count: count, cost: formatNum(chk.cost), currency: cur, after: formatNum(chk.balanceAfter) }),
    };
  };
  return {
    banner: banner,
    rates: rates,
    pity: pity,
    pityText: t('summon_pity', { rarity: top, n: pity.pullsUntilGuaranteed }),
    firstMultiText: pity.firstMultiAvailable ? t('summon_first_multi', { count: rates.multiCount, rarity: pity.firstMultiMinRarity }) : null,
    buttons: [button(1), button(rates.multiCount)],
  };
}

/** Rate table lines (AC-11.4): per rarity, then its fighters, then the rounding note and the rules text. */
export function rateTableModel(rates, characters, economy) {
  const rows = [];
  for (const r of rates.rarities) {
    rows.push({ kind: 'rarity', rarity: r.rarity, label: t('summon_rates_rarity', { rarity: r.rarity, percent: r.percentText }), percent: t('summon_rates_percent', { percent: r.percentText }) });
    for (const f of rates.fighters) {
      if (f.rarity !== r.rarity) continue;
      const ch = characters[f.characterId];
      rows.push({
        kind: 'fighter',
        rarity: f.rarity,
        characterId: f.characterId,
        label: t('summon_rates_fighter', { name: ch ? ch.name : f.characterId, featured: f.featured ? t('summon_rates_featured_mark') : '' }),
        percent: t('summon_rates_percent', { percent: f.percentText }),
      });
    }
  }
  const R = rates.rules;
  const top = topRarity(rates);
  const ov = R.overflowAmountByRarity || {};
  const bonus = economy && economy.duplicates ? Math.round(economy.duplicates.stat_bonus_per_rank * 100) : 0;
  const rules = [t('summon_rates_note'), t('summon_rules_base'), t('summon_rules_pity', { rarity: top, hard: R.hardPity, count: rates.multiCount })];
  rules.push(t('summon_rules_multi', { count: rates.multiCount, rarity: R.multiMinRarity }));
  if (R.firstMultiMinRarity) rules.push(t('summon_rules_first', { count: rates.multiCount, rarity: R.firstMultiMinRarity }));
  rules.push(t('summon_rules_dupes', { max: R.maxResonance, bonus: bonus, j3: formatNum(ov[3] || ov['3'] || 0), j4: formatNum(ov[4] || ov['4'] || 0), j5: formatNum(ov[5] || ov['5'] || 0) }));
  return { rows, rules };
}
