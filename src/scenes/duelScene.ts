import { ENEMY_THINK_MS, EVENT_DURATION_MS } from '../config/duelPresentation';
import type { FighterSpec } from '../config/fighters';
import { TICK_MS } from '../config/sim';
import type { Logger } from '../debug/log';
import { chooseAction } from '../game/duel/ai';
import {
  activeFighter,
  applyAction,
  createDuel,
  crossoverBlockedReason,
  playBlockedReason,
  switchBlockedReason,
} from '../game/duel/rules';
import type { DuelAction, DuelEvent, DuelState, Side } from '../game/duel/types';
import type { DuelView } from '../render/duelView';
import type { DuelHud } from '../ui/duelHud';

/*
 * Runs one duel: owns the rules state, plays its events back through the view and HUD one at a
 * time, asks the AI for enemy moves, and turns the player's taps into actions. Everything advances
 * in fixed simulation ticks, so pausing the loop freezes the whole battle.
 */

export type DuelPhase = 'animating' | 'playerInput' | 'enemyThinking' | 'ended';

export interface DuelScene {
  update(): void;
  /** Player intents from the HUD; buffered and applied on the next tick (CLAUDE.md §6). */
  requestPlay(handIndex: number): void;
  requestSwitch(fighterIndex: number): void;
  requestCharge(): void;
  requestCrossover(partnerIndex: number): void;
  restart(): void;
  readonly state: DuelState;
  readonly phase: DuelPhase;
}

export interface DuelSceneOptions {
  readonly view: DuelView;
  readonly hud: DuelHud;
  readonly log: Logger;
  /** Animation speed multiplier (1 = normal). */
  readonly speed: number;
  /** Battle-ready teams (Leader Skill already applied to the player's). */
  readonly player: readonly FighterSpec[];
  readonly enemy: readonly FighterSpec[];
  readonly seed: number;
  /** Extra starting Rift Energy for the player, e.g. from a Leader Skill. */
  readonly playerBonusEnergy: number;
  /** Called once when a duel ends (again after each replay). */
  readonly onFinished: (winner: Side) => void;
}

export function createDuelScene(options: DuelSceneOptions): DuelScene {
  const { view, hud, log, speed } = options;
  let seed = options.seed;
  let state: DuelState;
  let queue: DuelEvent[] = [];
  let waitMs = 0;
  let phase: DuelPhase = 'animating';
  let intent: DuelAction | null = null;

  const begin = (): void => {
    const created = createDuel({
      player: options.player,
      enemy: options.enemy,
      seed,
      bonusEnergy: { player: options.playerBonusEnergy },
    });
    state = created.state;
    queue = [...created.events];
    waitMs = 0;
    phase = 'animating';
    intent = null;
    view.reset(state.teams.player.activeIndex, state.teams.enemy.activeIndex);
    hud.reset(state);
    hud.showControls(state, false);
    log.info(`Duel started (seed ${seed})`);
  };

  /** Shows one event and returns how long it holds the stage. */
  const present = (event: DuelEvent): number => {
    hud.applyEvent(event);
    switch (event.kind) {
      case 'turnStart':
        break;
      case 'cardPlayed': {
        const fighter = state.teams[event.side].fighters[event.fighterIndex];
        if (fighter) view.attack(event.side, event.card.kind, fighter.spec.type);
        break;
      }
      case 'damage':
        view.hit(event.side, event.amount, event.effectiveness, event.guarded);
        break;
      case 'heal':
        view.heal(event.side, event.amount);
        break;
      case 'status':
        view.status(event.side, event.status);
        break;
      case 'charge':
        view.charge(event.side);
        break;
      case 'switch':
        view.switchIn(event.side, event.from, event.to);
        if (event.tagLink)
          hud.toast(event.side === 'player' ? 'Tag Link! +1 Rift Energy' : 'Enemy Tag Link');
        break;
      case 'ko':
        view.knockOut(event.side);
        break;
      case 'crossover': {
        const team = state.teams[event.side];
        const lead = team.fighters[event.fighterIndex];
        const partner = team.fighters[event.partnerIndex];
        if (lead && partner) {
          view.crossover(event.side, event.partnerIndex, lead.spec.type, partner.spec.type);
        }
        hud.announce(event.name);
        break;
      }
      case 'drain':
        view.drain(event.side, event.amount);
        break;
      case 'energy':
        view.charge(event.side);
        break;
      case 'battleEnd':
        log.info(`Duel over: ${event.winner} wins`);
        break;
    }
    return EVENT_DURATION_MS[event.kind] / speed;
  };

  const perform = (side: Side, action: DuelAction): boolean => {
    const result = applyAction(state, side, action);
    if (!result.ok) {
      if (side === 'player') hud.toast(result.reason);
      else log.warn(`Enemy AI chose an illegal action: ${result.reason}`);
      return false;
    }
    queue.push(...result.events);
    phase = 'animating';
    hud.showControls(state, false);
    return true;
  };

  begin();

  return {
    update() {
      if (waitMs > 0) {
        waitMs -= TICK_MS;
        return;
      }
      const next = queue.shift();
      if (next) {
        waitMs = present(next);
        return;
      }
      if (state.winner) {
        if (phase !== 'ended') {
          phase = 'ended';
          hud.showResult(state.winner);
          options.onFinished(state.winner);
        }
        return;
      }
      if (state.turnSide === 'enemy') {
        if (phase !== 'enemyThinking') {
          phase = 'enemyThinking';
          waitMs = ENEMY_THINK_MS / speed;
          return;
        }
        if (!perform('enemy', chooseAction(state, 'enemy'))) perform('enemy', { kind: 'charge' });
        return;
      }
      if (phase !== 'playerInput') {
        phase = 'playerInput';
        view.setGuardPose('player', activeFighter(state.teams.player).guard);
        hud.showControls(state, true);
      }
      if (intent) {
        const action = intent;
        intent = null;
        perform('player', action);
      }
    },

    requestPlay(handIndex) {
      const reason =
        phase === 'playerInput'
          ? playBlockedReason(state, 'player', handIndex)
          : 'Wait for your turn';
      if (reason) hud.toast(reason);
      else intent = { kind: 'play', handIndex };
    },
    requestSwitch(fighterIndex) {
      const reason =
        phase === 'playerInput'
          ? switchBlockedReason(state, 'player', fighterIndex)
          : 'Wait for your turn';
      if (reason) hud.toast(reason);
      else intent = { kind: 'switch', fighterIndex };
    },
    requestCharge() {
      if (phase === 'playerInput') intent = { kind: 'charge' };
      else hud.toast('Wait for your turn');
    },
    requestCrossover(partnerIndex) {
      const reason =
        phase === 'playerInput'
          ? crossoverBlockedReason(state, 'player', partnerIndex)
          : 'Wait for your turn';
      if (reason) hud.toast(reason);
      else intent = { kind: 'crossover', partnerIndex };
    },
    restart() {
      seed++;
      begin();
    },

    get state() {
      return state;
    },
    get phase() {
      return phase;
    },
  };
}
