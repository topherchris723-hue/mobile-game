// AC-17.1 key coverage (pure): every VFX_EVENT_KEYS key has an `events` entry (empty list allowed), every effect id
// named in `events` exists, every `reduce_motion` replacement id exists. Returns a list of error strings.
import { VFX_EVENT_KEYS } from './events.js';

export function checkVfxCoverage(vfx, keys) {
  const errors = [];
  const K = keys || VFX_EVENT_KEYS;
  const events = (vfx && vfx.events) || {};
  const effects = (vfx && vfx.effects) || {};
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  for (const k of K) {
    if (!own(events, k)) errors.push('events["' + k + '"] missing');
    else if (!Array.isArray(events[k])) errors.push('events["' + k + '"] is not a list');
  }
  for (const k of Object.keys(events)) {
    for (const id of Array.isArray(events[k]) ? events[k] : []) {
      if (!own(effects, id)) errors.push('events["' + k + '"] names unknown effect "' + id + '"');
    }
  }
  for (const id of Object.keys(effects)) {
    const rm = effects[id] && effects[id].reduce_motion;
    if (rm && rm !== 'keep' && rm !== 'drop' && !own(effects, rm)) errors.push('effects.' + id + '.reduce_motion names unknown effect "' + rm + '"');
  }
  return errors;
}
