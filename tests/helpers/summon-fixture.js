// GDD §11 "Default data used in the examples" pinned as test data, so the AC vectors (which fix exact
// numbers) stay valid while the balance/economy agents change the live data/*.json.
// Built from the live data files, with only the §11 example fields overwritten.
import { createContent } from '../../src/logic/index.js';
import { loadBundle, readJson } from './load-data.js';

export const GDD_BANNER_ID = 'banner_starter_001';

/** Rarities of the example fighters (GDD §11 default data). */
export const GDD_RARITY = {
  char_tavi_001: 3, char_lark_001: 3, char_dunmore_001: 3,
  char_pell_001: 4, char_thessa_001: 4, char_rook_001: 4,
  char_solenne_001: 5, char_corvane_001: 5,
};

/** The data bundle with GDD §11 default banner, economy and rarities. */
export function gddSummonBundle() {
  const bundle = loadBundle();
  const economy = readJson('data/economy.json');
  const banners = readJson('data/banners.json');
  let banner = banners.banners.find((b) => b.id === GDD_BANNER_ID);
  if (!banner) {
    banner = JSON.parse(JSON.stringify(banners.banners[0]));
    banner.id = GDD_BANNER_ID;
    banners.banners.unshift(banner);
  }
  banner.currency_id = 'cur_jade';
  banner.cost_single = 100;
  banner.cost_multi = 1000;
  banner.multi_count = 10;
  banner.rates_bp = { 3: 8000, 4: 1700, 5: 300 };
  banner.pool = Object.keys(GDD_RARITY);
  banner.featured = [{ character_id: 'char_solenne_001', share_bp: 5000 }, { character_id: 'char_corvane_001', share_bp: 5000 }];
  banner.pity = { group: 'standard', hard_pity: 40 };
  banner.multi_min_rarity = 4;
  banner.first_multi_min_rarity = 5;
  banner.start_at = null;
  banner.end_at = null;
  banners.banners = [banner];
  for (const ch of bundle.characters.characters) {
    if (Object.prototype.hasOwnProperty.call(GDD_RARITY, ch.id)) {
      ch.rarity = GDD_RARITY[ch.id];
      ch.playable = true;
    }
  }
  economy.starting.currencies = { cur_jade: 1000 };
  economy.starting.characters = ['char_tavi_001', 'char_lark_001', 'char_dunmore_001'];
  economy.starting.team = ['char_tavi_001', 'char_lark_001', 'char_dunmore_001'];
  economy.duplicates.max_resonance = 4;
  economy.duplicates.overflow_currency_id = 'cur_jade';
  economy.duplicates.overflow_amount_by_rarity = { 3: 10, 4: 40, 5: 200 };
  for (const c of economy.currencies) if (c.id === 'cur_jade') c.max = 999999;
  return { ...bundle, economy: economy, banners: banners };
}

/** createContent of gddSummonBundle(). */
export function gddSummonContent() {
  return createContent(gddSummonBundle());
}

/** Stub RNG: next() returns fn(callNumber) with callNumber 1-based; records the number of calls. */
export function stubRng(fn) {
  const r = { calls: 0, next: null };
  r.next = () => {
    r.calls += 1;
    return typeof fn === 'function' ? fn(r.calls) : fn;
  };
  return r;
}
