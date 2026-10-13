import { ENEMY_THINK_MS, EVENT_DURATION_MS } from '../config/duelPresentation';
import { CUT_IN_MS, type CueId } from '../config/feedback';
import type { CardKind, FighterSpec } from '../config/fighters';
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
import type { DuelView, HitImpact } from '../render/duelView';
import type { BattleReward, DuelHud } from '../ui/duelHud';
import type { Feedback } from '../ui/feedback';

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
  readonly feedback: Feedback;
  /** Current animation speed multiplier (1 = normal); read live so the 2× toggle applies at once. */
  readonly speed: () => number;
  /** Battle-ready teams (Leader Skill already applied to the player's). */
  readonly player: readonly FighterSpec[];
  readonly enemy: readonly FighterSpec[];
  readonly seed: number;
  /** Extra starting Rift Energy for the player, e.g. from a Leader Skill. */
  readonly playerBonusEnergy: number;
  /** Called once when a duel ends (again after each replay); returns what it paid out. */
  readonly onFinished: (winner: Side) => readonly BattleReward[];
}

export function createDuelScene(options: DuelSceneOptions): DuelScene {
  const { view, hud, log, feedback, speed } = options;
  let seed = options.seed;
  let state: DuelState;
  let queue: DuelEvent[] = [];
  let waitMs = 0;
  let phase: DuelPhase = 'animating';
  let intent: DuelAction | null = null;
  /** The attack whose hits are playing, so damage knows how hard it lands. */
  let lastAttack: HitImpact | null = null;
  /** The event a cut-in is currently being shown for. */
  let cutInFor: DuelEvent | null = null;

  const ATTACK_CUE: Record<CardKind, CueId> = {
    strike: 'strike',
    blast: 'blast',
    technique: 'technique',
    signature: 'signature',
  };

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
    lastAttack = null;
    cutInFor = null;
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
        lastAttack = null;
        if (event.side === 'player') feedback.cue('turn');
        break;
      case 'cardPlayed': {
        const fighter = state.teams[event.side].fighters[event.fighterIndex];
        if (fighter) {
          view.attack(event.side, event.card.kind, fighter.spec.type);
          lastAttack = { heavy: event.card.kind === 'signature', type: fighter.spec.type };
        }
        feedback.cue(ATTACK_CUE[event.card.kind]);
        break;
      }
      case 'damage': {
        const attacker = activeFighter(state.teams[event.side === 'player' ? 'enemy' : 'player']);
        const impact = lastAttack ?? { heavy: false, type: attacker.spec.type };
        view.hit(event.side, event.amount, event.effectiveness, event.guarded, impact);
        feedback.cue(
          event.guarded
            ? 'guard'
            : impact.heavy
              ? 'hitHeavy'
              : event.side === 'player'
                ? 'hitTaken'
                : 'hitDealt',
        );
        break;
      }
      case 'heal':
        view.heal(event.side, event.amount);
        feedback.cue('heal');
        break;
      case 'status':
        view.status(event.side, event.status);
        feedback.cue('status');
        break;
      case 'charge':
        view.charge(event.side);
        feedback.cue('charge');
        break;
      case 'switch':
        view.switchIn(event.side, event.from, event.to);
        feedback.cue('switch');
        if (event.tagLink)
          hud.toast(event.side === 'player' ? 'Tag Link! +1 Rift Energy' : 'Enemy Tag Link');
        break;
      case 'ko':
        view.knockOut(event.side);
        feedback.cue('ko');
        break;
      case 'crossover': {
        const team = state.teams[event.side];
        const lead = team.fighters[event.fighterIndex];
        const partner = team.fighters[event.partnerIndex];
        if (lead && partner) {
          view.crossover(event.side, event.partnerIndex, lead.spec.type, partner.spec.type);
          lastAttack = { heavy: true, type: lead.spec.type };
        }
        feedback.cue('crossover');
        break;
      }
      case 'drain':
        view.drain(event.side, event.amount);
        feedback.cue('drain');
        break;
      case 'energy':
        view.charge(event.side);
        feedback.cue('charge');
        break;
      case 'battleEnd':
        log.info(`Duel over: ${event.winner} wins`);
        feedback.cue(event.winner === 'player' ? 'victory' : 'defeat');
        break;
    }
    return EVENT_DURATION_MS[event.kind] / speed();
  };

  /** Signatures and Crossovers get a title card before they land (game-design.md §4.10). */
  const showCutIn = (event: DuelEvent): boolean => {
    if (event.kind === 'cardPlayed' && event.card.kind === 'signature') {
      const fighter = state.teams[event.side].fighters[event.fighterIndex];
      if (!fighter) return false;
      hud.cutIn({
        side: event.side,
        kicker: 'Signature',
        title: event.card.name,
        fighters: [fighter.spec],
      });
    } else if (event.kind === 'crossover') {
      const team = state.teams[event.side];
      const lead = team.fighters[event.fighterIndex];
      const partner = team.fighters[event.partnerIndex];
      if (!lead || !partner) return false;
      hud.cutIn({
        side: event.side,
        kicker: 'Crossover Burst',
        title: event.name,
        fighters: [lead.spec, partner.spec],
      });
    } else {
      return false;
    }
    feedback.cue('cutIn');
    return true;
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

  /** Buffers an accepted intent, or explains a refusal; both answer the tap at once (§5). */
  const request = (reason: string | null, action: DuelAction): void => {
    if (reason) {
      hud.toast(reason);
      feedback.cue('deny');
    } else {
      intent = action;
      feedback.cue('tap');
    }
  };

  begin();

  return {
    update() {
      if (waitMs > 0) {
        waitMs -= TICK_MS;
        return;
      }
      const next = queue[0];
      if (next) {
        if (cutInFor !== next && showCutIn(next)) {
          cutInFor = next;
          waitMs = CUT_IN_MS / speed();
          return;
        }
        if (cutInFor) {
          hud.endCutIn();
          cutInFor = null;
        }
        queue.shift();
        waitMs = present(next);
        return;
      }
      if (state.winner) {
        if (phase !== 'ended') {
          phase = 'ended';
          hud.showResult(state.winner, options.onFinished(state.winner));
        }
        return;
      }
      if (state.turnSide === 'enemy') {
        if (phase !== 'enemyThinking') {
          phase = 'enemyThinking';
          waitMs = ENEMY_THINK_MS / speed();
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
      request(
        phase === 'playerInput'
          ? playBlockedReason(state, 'player', handIndex)
          : 'Wait for your turn',
        { kind: 'play', handIndex },
      );
    },
    requestSwitch(fighterIndex) {
      request(
        phase === 'playerInput'
          ? switchBlockedReason(state, 'player', fighterIndex)
          : 'Wait for your turn',
        { kind: 'switch', fighterIndex },
      );
    },
    requestCharge() {
      request(phase === 'playerInput' ? null : 'Wait for your turn', { kind: 'charge' });
    },
    requestCrossover(partnerIndex) {
      request(
        phase === 'playerInput'
          ? crossoverBlockedReason(state, 'player', partnerIndex)
          : 'Wait for your turn',
        { kind: 'crossover', partnerIndex },
      );
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
