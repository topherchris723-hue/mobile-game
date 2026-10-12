import {
  LANE_STEP_TICKS,
  OPPONENT_WANDER_MAX_TICKS,
  OPPONENT_WANDER_MIN_TICKS,
  START_LANE,
  type LaneIndex,
} from '../config/arena';
import { createRng, type Rng } from '../core/rng';

export type Side = 'player' | 'opponent';

export interface FighterState {
  readonly id: number;
  readonly side: Side;
  /** Lane the fighter is in, or moving into. */
  lane: LaneIndex;
  /** Lane the current step started from (equals `lane` when not stepping). */
  fromLane: LaneIndex;
  /** Ticks left in the current lane step; 0 when standing still. */
  stepTicksRemaining: number;
  guarding: boolean;
  /** AI-controlled fighters in the test arena drift between lanes; null for the player's fighter. */
  wanderTicks: number | null;
}

export interface ArenaState {
  tick: number;
  readonly fighters: FighterState[];
  readonly controlledFighterId: number;
  readonly rng: Rng;
}

/** `direction` −1 moves toward the far lane (swipe up), +1 toward the near lane (swipe down). */
export type ArenaCommand =
  | { readonly kind: 'step'; readonly fighterId: number; readonly direction: -1 | 1 }
  | { readonly kind: 'guard'; readonly fighterId: number; readonly active: boolean };

export interface ArenaSetup {
  readonly seed: number;
  /** Fighters per side: 1 for a normal duel view, 3 to stress the renderer. */
  readonly fightersPerSide: 1 | 3;
}

export function createArenaState(setup: ArenaSetup): ArenaState {
  const rng = createRng(setup.seed);
  const fighters: FighterState[] = [];
  let nextId = 1;
  const lanesFor = (count: number): LaneIndex[] => (count === 1 ? [START_LANE] : [0, 1, 2]);

  for (const side of ['player', 'opponent'] as const) {
    for (const lane of lanesFor(setup.fightersPerSide)) {
      const isControlled = side === 'player' && lane === START_LANE;
      fighters.push({
        id: nextId++,
        side,
        lane,
        fromLane: lane,
        stepTicksRemaining: 0,
        guarding: false,
        wanderTicks: isControlled ? null : rollWanderDelay(rng),
      });
    }
  }

  const controlled = fighters.find((f) => f.wanderTicks === null);
  if (!controlled) throw new Error('Arena setup produced no player-controlled fighter');
  return { tick: 0, fighters, controlledFighterId: controlled.id, rng };
}

/** Advances the arena by one fixed tick. Commands are applied first, in order. */
export function stepArena(state: ArenaState, commands: readonly ArenaCommand[]): void {
  for (const command of commands) applyCommand(state, command);

  for (const fighter of state.fighters) {
    if (fighter.stepTicksRemaining > 0) {
      fighter.stepTicksRemaining--;
      if (fighter.stepTicksRemaining === 0) fighter.fromLane = fighter.lane;
    }
    if (fighter.wanderTicks !== null) {
      fighter.wanderTicks--;
      if (fighter.wanderTicks <= 0) {
        const direction = chooseWanderDirection(fighter.lane, state.rng);
        tryStep(fighter, direction);
        fighter.wanderTicks = rollWanderDelay(state.rng);
      }
    }
  }
  state.tick++;
}

/** 0–1 progress through the current lane step at a sub-tick `alpha`; 1 when standing still. */
export function laneStepProgress(fighter: FighterState, alpha: number): number {
  if (fighter.stepTicksRemaining === 0) return 1;
  const elapsed = LANE_STEP_TICKS - fighter.stepTicksRemaining + alpha;
  return Math.min(elapsed / LANE_STEP_TICKS, 1);
}

function applyCommand(state: ArenaState, command: ArenaCommand): void {
  const fighter = state.fighters.find((f) => f.id === command.fighterId);
  if (!fighter) return;
  if (command.kind === 'step') {
    if (tryStep(fighter, command.direction)) fighter.guarding = false;
  } else {
    fighter.guarding = command.active;
  }
}

/** Starts a lane step if the fighter is standing still and the target lane exists. */
function tryStep(fighter: FighterState, direction: -1 | 1): boolean {
  if (fighter.stepTicksRemaining > 0) return false;
  const target = fighter.lane + direction;
  if (target < 0 || target > 2) return false;
  fighter.fromLane = fighter.lane;
  fighter.lane = target as LaneIndex;
  fighter.stepTicksRemaining = LANE_STEP_TICKS;
  return true;
}

function chooseWanderDirection(lane: LaneIndex, rng: Rng): -1 | 1 {
  if (lane === 0) return 1;
  if (lane === 2) return -1;
  return rng.next() < 0.5 ? -1 : 1;
}

function rollWanderDelay(rng: Rng): number {
  return rng.int(OPPONENT_WANDER_MIN_TICKS, OPPONENT_WANDER_MAX_TICKS);
}
