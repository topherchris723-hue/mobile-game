import type { CardSpec, FighterSpec } from '../../config/fighters';
import type { PassiveId } from '../../config/passives';
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
  // Passive bookkeeping (config/passives.ts).
  /** Own-team turn starts since this fighter last entered the field (Rising Ember). */
  fieldTurns: number;
  /** Next attack pierces Guard (Gale Step); set on entering. */
  galeReady: boolean;
  /** Next hit taken is reduced (Ink Veil); set on entering. */
  veilReady: boolean;
  /** Arc Core already gave its energy this battle. */
  arcUsed: boolean;
  /** Captain's Will already saved this fighter this battle. */
  endureUsed: boolean;
  /** Strikes landed this battle (Sticky Fingers). */
  strikesLanded: number;
}

export interface TeamState {
  readonly side: Side;
  readonly fighters: FighterState[];
  activeIndex: number;
  energy: number;
  switchedThisTurn: boolean;
  /** Tier of the team's last attack in the current combo chain (0 = no chain). */
  comboTier: number;
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
  | { readonly kind: 'charge' }
  | { readonly kind: 'crossover'; readonly partnerIndex: number };

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
      /** True when this attack continued a combo chain and got the combo bonus. */
      readonly combo: boolean;
    }
  | {
      readonly kind: 'crossover';
      readonly side: Side;
      readonly fighterIndex: number;
      readonly partnerIndex: number;
      readonly name: string;
      readonly energy: number;
    }
  | {
      readonly kind: 'drain';
      /** The side that lost energy. */
      readonly side: Side;
      readonly amount: number;
      readonly energy: number;
      /** The draining side's energy afterwards. */
      readonly gainerEnergy: number;
    }
  | { readonly kind: 'energy'; readonly side: Side; readonly energy: number }
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
  | {
      /** A Passive visibly triggered (its own effect, if any, is a separate event). */
      readonly kind: 'passive';
      readonly side: Side;
      readonly fighterIndex: number;
      readonly passive: PassiveId;
    }
  | { readonly kind: 'battleEnd'; readonly winner: Side };

export type ActionResult =
  | { readonly ok: true; readonly events: readonly DuelEvent[] }
  | { readonly ok: false; readonly reason: string };
