import type { CardSpec, FighterSpec } from '../../config/fighters';
import type { Rng } from '../../core/rng';

export type Side = 'player' | 'enemy';
export type Effectiveness = 'advantage' | 'disadvantage' | 'neutral';

export interface CardInstance {
  /** Unique within a duel, so the UI can animate a specific card. */
  readonly uid: number;
  readonly spec: CardSpec;
}

export interface FighterState {
  readonly spec: FighterSpec;
  hp: number;
  hand: CardInstance[];
  drawPile: CardInstance[];
  discard: CardInstance[];
  /** Next attack deals extra damage (Technique: Focus). */
  focus: boolean;
  /** Next hit taken is reduced (Technique: Guard). */
  guard: boolean;
  /** Own-team turns left with lowered Defence (Technique: Sap). */
  sapTurns: number;
  /** Own-team turn starts before this fighter may be tagged back in. */
  switchCooldown: number;
}

export interface TeamState {
  readonly side: Side;
  readonly fighters: FighterState[];
  activeIndex: number;
  energy: number;
  switchedThisTurn: boolean;
}

export interface DuelState {
  readonly teams: Record<Side, TeamState>;
  turnSide: Side;
  turnNumber: number;
  winner: Side | null;
  readonly rng: Rng;
  nextCardUid: number;
}

export type DuelAction =
  | { readonly kind: 'play'; readonly handIndex: number }
  | { readonly kind: 'switch'; readonly fighterIndex: number }
  | { readonly kind: 'charge' };

/** Everything that happened, in order, for the presentation layer to play back. */
export type DuelEvent =
  | {
      readonly kind: 'turnStart';
      readonly side: Side;
      readonly turnNumber: number;
      readonly energy: number;
    }
  | {
      readonly kind: 'switch';
      readonly side: Side;
      readonly from: number;
      readonly to: number;
      readonly auto: boolean;
      readonly tagLink: boolean;
      readonly energy: number;
    }
  | {
      readonly kind: 'cardPlayed';
      readonly side: Side;
      readonly fighterIndex: number;
      readonly card: CardSpec;
      readonly energy: number;
    }
  | {
      readonly kind: 'damage';
      /** The side that took the damage. */
      readonly side: Side;
      readonly fighterIndex: number;
      readonly amount: number;
      readonly hp: number;
      readonly effectiveness: Effectiveness;
      readonly guarded: boolean;
    }
  | {
      readonly kind: 'heal';
      readonly side: Side;
      readonly fighterIndex: number;
      readonly amount: number;
      readonly hp: number;
    }
  | {
      readonly kind: 'status';
      readonly side: Side;
      readonly fighterIndex: number;
      readonly status: 'focus' | 'guard' | 'sap';
    }
  | { readonly kind: 'charge'; readonly side: Side; readonly energy: number }
  | { readonly kind: 'ko'; readonly side: Side; readonly fighterIndex: number }
  | { readonly kind: 'battleEnd'; readonly winner: Side };

export type ActionResult =
  | { readonly ok: true; readonly events: readonly DuelEvent[] }
  | { readonly ok: false; readonly reason: string };
