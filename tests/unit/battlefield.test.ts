import { describe, expect, it } from 'vitest';
import {
  ALLY_SLOTS,
  BENCHMARK_ENEMY_COUNT,
  ENEMY_SLOTS,
  NORMAL_ENEMY_COUNT,
} from '../../src/config/battlefield';
import { createBattlefieldState, stepBattlefield } from '../../src/game/battlefield';

describe('battlefield state', () => {
  it('fields four Sovereigns and three enemies', () => {
    const state = createBattlefieldState({ benchmark: false });
    expect(state.units.filter((u) => u.side === 'ally')).toHaveLength(ALLY_SLOTS.length);
    expect(state.units.filter((u) => u.side === 'enemy')).toHaveLength(NORMAL_ENEMY_COUNT);
    expect(ALLY_SLOTS).toHaveLength(4);
  });

  it('fields extra enemies in benchmark mode, within the available slots', () => {
    const state = createBattlefieldState({ benchmark: true });
    expect(state.units.filter((u) => u.side === 'enemy')).toHaveLength(BENCHMARK_ENEMY_COUNT);
    expect(BENCHMARK_ENEMY_COUNT).toBeLessThanOrEqual(ENEMY_SLOTS.length);
  });

  it('gives every unit a unique id', () => {
    const ids = createBattlefieldState({ benchmark: true }).units.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('selects on command, applied on the next tick', () => {
    const state = createBattlefieldState({ benchmark: false });
    const target = state.units[2];
    if (!target) throw new Error('missing unit');
    expect(state.selectedUnitId).toBeNull();
    stepBattlefield(state, [{ kind: 'select', unitId: target.id }]);
    expect(state.selectedUnitId).toBe(target.id);
    expect(state.tick).toBe(1);
  });

  it('clears selection for empty taps and unknown ids', () => {
    const state = createBattlefieldState({ benchmark: false });
    stepBattlefield(state, [{ kind: 'select', unitId: 1 }]);
    stepBattlefield(state, [{ kind: 'select', unitId: null }]);
    expect(state.selectedUnitId).toBeNull();
    stepBattlefield(state, [{ kind: 'select', unitId: 1 }]);
    stepBattlefield(state, [{ kind: 'select', unitId: 999 }]);
    expect(state.selectedUnitId).toBeNull();
  });

  it('applies commands in order, last one wins', () => {
    const state = createBattlefieldState({ benchmark: false });
    stepBattlefield(state, [
      { kind: 'select', unitId: 1 },
      { kind: 'select', unitId: 3 },
    ]);
    expect(state.selectedUnitId).toBe(3);
  });

  it('keeps every slot on screen', () => {
    for (const slot of [...ALLY_SLOTS, ...ENEMY_SLOTS]) {
      expect(slot.x).toBeGreaterThan(0);
      expect(slot.x).toBeLessThan(1);
      expect(slot.depth).toBeGreaterThanOrEqual(0);
      expect(slot.depth).toBeLessThanOrEqual(1);
    }
  });
});
