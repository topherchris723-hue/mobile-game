import { describe, expect, it } from 'vitest';
import { LANE_STEP_TICKS, START_LANE } from '../../src/config/arena';
import {
  createArenaState,
  laneStepProgress,
  stepArena,
  type ArenaCommand,
  type ArenaState,
  type FighterState,
} from '../../src/game/arena';

const player = (state: ArenaState): FighterState => {
  const fighter = state.fighters.find((f) => f.id === state.controlledFighterId);
  if (!fighter) throw new Error('no player fighter');
  return fighter;
};

const tick = (state: ArenaState, commands: ArenaCommand[] = [], times = 1): void => {
  stepArena(state, commands);
  for (let i = 1; i < times; i++) stepArena(state, []);
};

describe('arena simulation', () => {
  it('starts with one fighter per side in the middle lane', () => {
    const state = createArenaState({ seed: 1, fightersPerSide: 1 });
    expect(state.fighters).toHaveLength(2);
    expect(player(state).lane).toBe(START_LANE);
    expect(player(state).wanderTicks).toBeNull();
  });

  it('creates three fighters per side in benchmark mode, one per lane', () => {
    const state = createArenaState({ seed: 1, fightersPerSide: 3 });
    expect(state.fighters).toHaveLength(6);
    for (const side of ['player', 'opponent'] as const) {
      const lanes = state.fighters.filter((f) => f.side === side).map((f) => f.lane);
      expect(lanes.sort()).toEqual([0, 1, 2]);
    }
  });

  it('steps one lane and finishes after LANE_STEP_TICKS', () => {
    const state = createArenaState({ seed: 1, fightersPerSide: 1 });
    const id = state.controlledFighterId;
    tick(state, [{ kind: 'step', fighterId: id, direction: -1 }]);
    expect(player(state).lane).toBe(0);
    expect(player(state).fromLane).toBe(1);
    tick(state, [], LANE_STEP_TICKS - 1);
    expect(player(state).stepTicksRemaining).toBe(0);
    expect(player(state).fromLane).toBe(0);
  });

  it('ignores a second step while one is in progress', () => {
    const state = createArenaState({ seed: 1, fightersPerSide: 1 });
    const id = state.controlledFighterId;
    tick(state, [{ kind: 'step', fighterId: id, direction: 1 }]);
    tick(state, [{ kind: 'step', fighterId: id, direction: 1 }]);
    expect(player(state).lane).toBe(2);
    expect(player(state).fromLane).toBe(1);
  });

  it('cannot step past the far or near edge', () => {
    const state = createArenaState({ seed: 1, fightersPerSide: 1 });
    const id = state.controlledFighterId;
    tick(state, [{ kind: 'step', fighterId: id, direction: -1 }], LANE_STEP_TICKS + 1);
    tick(state, [{ kind: 'step', fighterId: id, direction: -1 }]);
    expect(player(state).lane).toBe(0);
    expect(player(state).stepTicksRemaining).toBe(0);
  });

  it('toggles guard, and a successful step drops guard', () => {
    const state = createArenaState({ seed: 1, fightersPerSide: 1 });
    const id = state.controlledFighterId;
    tick(state, [{ kind: 'guard', fighterId: id, active: true }]);
    expect(player(state).guarding).toBe(true);
    tick(state, [{ kind: 'step', fighterId: id, direction: 1 }]);
    expect(player(state).guarding).toBe(false);
  });

  it('reports interpolated step progress', () => {
    const state = createArenaState({ seed: 1, fightersPerSide: 1 });
    const id = state.controlledFighterId;
    expect(laneStepProgress(player(state), 0.5)).toBe(1);
    tick(state, [{ kind: 'step', fighterId: id, direction: 1 }]);
    // The tick that accepts the step also advances it by one tick.
    expect(laneStepProgress(player(state), 0)).toBeCloseTo(1 / LANE_STEP_TICKS, 5);
    expect(laneStepProgress(player(state), 0.5)).toBeCloseTo(1.5 / LANE_STEP_TICKS, 5);
  });

  it('never moves the player fighter on its own, and wanderers stay in bounds', () => {
    const state = createArenaState({ seed: 3, fightersPerSide: 3 });
    tick(state, [], 3000);
    expect(player(state).lane).toBe(START_LANE);
    for (const f of state.fighters) {
      expect(f.lane).toBeGreaterThanOrEqual(0);
      expect(f.lane).toBeLessThanOrEqual(2);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = createArenaState({ seed: 11, fightersPerSide: 3 });
    const b = createArenaState({ seed: 11, fightersPerSide: 3 });
    tick(a, [], 1000);
    tick(b, [], 1000);
    expect(a.fighters.map((f) => f.lane)).toEqual(b.fighters.map((f) => f.lane));
  });

  it('ignores commands for unknown fighters', () => {
    const state = createArenaState({ seed: 1, fightersPerSide: 1 });
    expect(() => {
      tick(state, [{ kind: 'step', fighterId: 999, direction: 1 }]);
    }).not.toThrow();
  });
});
