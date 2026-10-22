// Summon + immediate save (GDD §11.3 anti-reroll, AC-11.5): the results and the new balance are written to
// storage BEFORE the UI plays the reveal, so killing the app cannot change or repeat a summon.

import { summon } from '../logic/summon.js';
import { writeSave } from './save.js';

/**
 * Run a summon and persist it at once. storage = { getItem, setItem } (window.localStorage),
 * nowMs = clock in ms (sets obtained_at / updated_at). Returns the summon() result plus `saved`
 * (true when written). On a reject nothing is written and `saveAfter` is the unchanged input save.
 * The UI must use `saveAfter` as its current save from now on, then play the reveal.
 */
export function summonAndSave(storage, save, bannerId, count, content, nowMs) {
  const nowIso = new Date(nowMs).toISOString();
  const r = summon(save, bannerId, count, content, { nowIso: nowIso });
  if (!r.ok) {
    r.saved = false;
    return r;
  }
  writeSave(storage, r.saveAfter, nowMs);
  r.saved = true;
  return r;
}
