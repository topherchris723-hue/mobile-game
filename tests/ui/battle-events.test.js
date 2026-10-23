// ui-developer round 3 (L-shared-009): every battle event type and reason list exported by src/logic is handled by
// the Battle scene, and every reason-keyed text has a string. hit_discarded must never look like a hit or a dodge.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BATTLE_EVENT_TYPES, HIT_DISCARD_REASONS, TRI_BURST_WHIFF_REASONS } from '../../src/logic/index.js';
import { HIT_DISCARD_TEXT_KEYS, TRI_BURST_WHIFF_TEXT_KEYS } from '../../src/ui/hud-state.js';
import { hasString } from '../../src/ui/strings.js';
import { ROOT } from '../helpers/load-data.js';

const scene = fs.readFileSync(path.join(ROOT, 'src/scenes/BattleScene.js'), 'utf8');
// Events the scene deliberately shows nothing for (feedback comes from the snapshot or another event).
const NO_FEEDBACK = new Set(['whiff', 'interrupt', 'card_cancelled', 'link_open', 'knockdown', 'getup', 'riposte_window_end',
  'ignition_ready', 'ignition_end', 'burst_ready', 'effect', 'buff_end', 'card_drawn',
  'windup_start', 'dash']); // windup ring, dash pose, IGNITE button, gauge and hand come from the snapshot

export function unhandled(types, src, skip) {
  const cases = new Set([...src.matchAll(/case '([a-z_]+)':/g)].map((m) => m[1]));
  return types.filter((ty) => !cases.has(ty) && !skip.has(ty));
}
export function missingReasonKeys(reasons, map) {
  return reasons.filter((r) => !map[r] || !hasString(map[r]));
}

describe('Battle events → UI (L-shared-009)', () => {
  it('every BATTLE_EVENT_TYPES value has a case in BattleScene or is on the reviewed no-feedback list', () => {
    expect(BATTLE_EVENT_TYPES).toContain('hit_discarded');
    expect(unhandled(BATTLE_EVENT_TYPES, scene, NO_FEEDBACK)).toEqual([]);
  });
  it('must-FAIL: a new event type with no case is reported', () => {
    expect(unhandled(BATTLE_EVENT_TYPES.concat(['future_event']), scene, NO_FEEDBACK)).toEqual(['future_event']);
  });
  it('HIT_DISCARD_REASONS and TRI_BURST_WHIFF_REASONS all map to strings', () => {
    expect(missingReasonKeys(HIT_DISCARD_REASONS, HIT_DISCARD_TEXT_KEYS)).toEqual([]);
    expect(missingReasonKeys(TRI_BURST_WHIFF_REASONS, TRI_BURST_WHIFF_TEXT_KEYS)).toEqual([]);
    expect(missingReasonKeys(['future_reason'], TRI_BURST_WHIFF_TEXT_KEYS)).toEqual(['future_reason']);
  });
  it('hit_discarded shows no damage number, flash, HP drop or DODGE', () => {
    const body = scene.slice(scene.indexOf('  onHitDiscarded(e) {'), scene.indexOf('\n  }\n', scene.indexOf('  onHitDiscarded(e) {')));
    expect(body.length).toBeGreaterThan(50);
    for (const bad of ['onHit(', 'hitFlash', 'onDamage', 'battle_dodge', 'e.damage', 'impact(']) expect(body, bad).not.toContain(bad);
    const c = scene.slice(scene.indexOf("case 'hit_discarded':"), scene.indexOf('break;', scene.indexOf("case 'hit_discarded':")));
    expect(c).toContain('onHitDiscarded');
    expect(c).not.toContain('onHit(');
  });
});
