// One summon action with its single save (GDD §11.3 steps 1–5, AC-11.5, AC-11.10): the results and the new
// balance are written to storage BEFORE the UI plays any reveal frame. If the write throws, nothing changed
// (the logic never mutates the input save) and the UI shows "Summon failed — no Jade was spent."

import { summon } from '../logic/summon.js';
import { SAVE_KEY } from './save.js';

/**
 * A fresh uint32 summon seed: crypto.getRandomValues, fallback floor(Math.random() × 2^32) (GDD §11.3).
 * This is the only non-deterministic call in the summon path and it lives outside src/logic.
 */
export function randomSummonSeed() {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.getRandomValues === 'function') {
    const a = new Uint32Array(1);
    c.getRandomValues(a);
    return a[0] >>> 0;
  }
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

/**
 * Run a summon and persist it at once. storage = { getItem, setItem } (window.localStorage), nowMs = clock in ms.
 * seed = optional uint32 (tests, the ?test hook); otherwise randomSummonSeed().
 * Returns the summon() result plus `saved` (true when written). The UI must then use `saveAfter` as its save
 * and play the reveal. Rejects (including `save_failed` when setItem throws) write nothing, `saveAfter` is the
 * unchanged input save, and `results` is empty.
 */
export function summonAndSave(storage, save, bannerId, count, content, nowMs, seed) {
  const nowIso = new Date(nowMs).toISOString();
  const useSeed = typeof seed === 'number' ? seed >>> 0 : randomSummonSeed();
  const r = summon(save, bannerId, count, content, { nowIso: nowIso, seed: useSeed });
  r.saved = false;
  if (!r.ok) return r;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(r.saveAfter)); // updated_at already = nowIso
  } catch (e) {
    return {
      ok: false, reason: 'save_failed', seed: r.seed, banner_id: r.banner_id, count: r.count, cost: r.cost,
      jade_before: r.jade_before, jade_after: r.jade_before, pity_before: r.pity_before, pity_after: r.pity_before,
      results: [], saveAfter: save, events: [], saved: false,
    };
  }
  r.saved = true;
  return r;
}
