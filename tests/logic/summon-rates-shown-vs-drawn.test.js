// P-class (live data/): the rates the Rates screen shows (getBannerRates) match what drawPull really draws.
// GDD §11 (gacha must show its rates in-game, CLAUDE.md §9). For every live banner: the rarity rows sum to exactly
// 10,000 bp, and over 2,000,000 seeded normal draws each fighter's drawn share is within 5σ (+0.005 pp) of its shown
// percentage. Must-FAIL variants make the shown table disagree with the drawn one (economy-designer's round-4 check).
import { describe, it, expect } from 'vitest';
import { createContent, SeededRng, getBannerRates, drawPull } from '../../src/logic/index.js';
import { loadBundle, readJson } from '../helpers/load-data.js';

const N = 2000000;

function liveBundle() {
  const b = loadBundle();
  b.economy = readJson('data/economy.json');
  return b;
}

/** Compare the shown rates of `bannerId` (from `shown`) with N draws from `real`. Returns a list of failures. */
function shownVsDrawn(shown, real, bannerId, seed) {
  const R = getBannerRates(bannerId, shown);
  const fail = [];
  let sumBp = 0;
  for (const r of R.rarities) sumBp += Math.round(Number(r.percentText) * 100);
  if (sumBp !== 10000) fail.push('rarity rows sum to ' + sumBp + ' bp, not 10000');
  const exp = {};
  for (const f of R.fighters) exp[f.characterId] = (exp[f.characterId] || 0) + Number(f.percentText);
  const rng = new SeededRng(seed);
  const cnt = {};
  const banner = real.banners[bannerId];
  for (let i = 0; i < N; i++) {
    const p = drawPull(banner, real, rng, 0, 0);
    cnt[p.characterId] = (cnt[p.characterId] || 0) + 1;
  }
  for (const id of Object.keys(cnt)) if (!Object.prototype.hasOwnProperty.call(exp, id)) fail.push(id + ' drawn but not shown');
  for (const id of Object.keys(exp)) {
    const obs = (100 * (cnt[id] || 0)) / N;
    const p = exp[id] / 100;
    const tol = 100 * 5 * Math.sqrt((p * (1 - p)) / N) + 0.005;
    if (Math.abs(obs - exp[id]) > tol) fail.push(id + ' shown ' + exp[id].toFixed(2) + '% drawn ' + obs.toFixed(3) + '%');
  }
  return fail;
}

const LIVE_IDS = readJson('data/banners.json').banners.map((b) => b.id);

describe('Summon rates shown vs drawn (P, live data, 2,000,000 draws per banner)', () => {
  for (const id of LIVE_IDS) {
    it(id + ': shown rarity rows sum to 10,000 bp and every fighter is drawn within 5σ of its shown %', () => {
      const shown = createContent(liveBundle());
      const real = createContent(liveBundle());
      expect(shownVsDrawn(shown, real, id, 12345)).toEqual([]);
    });
  }

  const B = LIVE_IDS[0];
  it('must-FAIL (rarity): drawn rarity rates moved 100 bp away from the shown ones → fighters mismatch', () => {
    const shown = createContent(liveBundle());
    const real = createContent(liveBundle());
    const rates = real.banners[B].rates_bp;
    const keys = Object.keys(rates).filter((k) => rates[k] >= 100).sort((a, b) => rates[b] - rates[a]);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    rates[keys[0]] += 100;
    rates[keys[1]] -= 100;
    expect(shownVsDrawn(shown, real, B, 12345).length).toBeGreaterThan(0);
  });
  it('must-FAIL (share): drawn featured shares 70/30 instead of the shown split → featured fighters mismatch', () => {
    const shown = createContent(liveBundle());
    const real = createContent(liveBundle());
    const fe = real.banners[B].featured;
    expect(fe.length).toBeGreaterThanOrEqual(2);
    const total = fe[0].share_bp + fe[1].share_bp;
    fe[0].share_bp = Math.round(total * 0.7);
    fe[1].share_bp = total - fe[0].share_bp;
    expect(fe[0].share_bp).not.toBe(shown.banners[B].featured[0].share_bp);
    const fail = shownVsDrawn(shown, real, B, 12345);
    expect(fail.some((f) => f.indexOf(fe[0].character_id) === 0)).toBe(true);
  });
  it('must-FAIL (sum): the shown table has a rarity +100 bp → rows sum to 10,100 bp', () => {
    const shown = createContent(liveBundle());
    const real = createContent(liveBundle());
    const rates = shown.banners[B].rates_bp;
    const k = Object.keys(rates).sort((a, b) => rates[a] - rates[b])[0];
    rates[k] += 100;
    const fail = shownVsDrawn(shown, real, B, 12345);
    expect(fail).toContain('rarity rows sum to 10100 bp, not 10000');
  });
});
