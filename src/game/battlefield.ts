import {
  ALLY_SLOTS,
  BENCHMARK_ENEMY_COUNT,
  ENEMY_SLOTS,
  NORMAL_ENEMY_COUNT,
} from '../config/battlefield';

export type Side = 'ally' | 'enemy';

export interface UnitState {
  readonly id: number;
  readonly side: Side;
  /** Index into ALLY_SLOTS or ENEMY_SLOTS. */
  readonly slot: number;
}

/**
 * M1 battlefield test state: who stands where, and which unit the player has selected.
 * Turn order, HP, and actions arrive with the Rift Timeline simulation in M2.
 */
export interface BattlefieldState {
  tick: number;
  readonly units: readonly UnitState[];
  selectedUnitId: number | null;
}

export type BattlefieldCommand = { readonly kind: 'select'; readonly unitId: number | null };

export interface BattlefieldSetup {
  readonly benchmark: boolean;
}

export function createBattlefieldState(setup: BattlefieldSetup): BattlefieldState {
  const units: UnitState[] = [];
  let nextId = 1;
  for (let slot = 0; slot < ALLY_SLOTS.length; slot++) {
    units.push({ id: nextId++, side: 'ally', slot });
  }
  const enemyCount = setup.benchmark ? BENCHMARK_ENEMY_COUNT : NORMAL_ENEMY_COUNT;
  for (let slot = 0; slot < Math.min(enemyCount, ENEMY_SLOTS.length); slot++) {
    units.push({ id: nextId++, side: 'enemy', slot });
  }
  return { tick: 0, units, selectedUnitId: null };
}

/** Advances one fixed tick, applying commands in order. Selecting an unknown id clears selection. */
export function stepBattlefield(
  state: BattlefieldState,
  commands: readonly BattlefieldCommand[],
): void {
  for (const command of commands) {
    const exists = state.units.some((unit) => unit.id === command.unitId);
    state.selectedUnitId = exists ? command.unitId : null;
  }
  state.tick++;
}
