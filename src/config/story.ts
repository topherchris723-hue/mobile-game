import { ENEMY_TEAM, type FighterSpec } from './fighters';

/** A story battle (game-design.md §7). Chapter 1 and its map arrive in M7. */
export interface StageSpec {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly enemies: readonly FighterSpec[];
  readonly seed: number;
}

export const STAGES: readonly StageSpec[] = [
  {
    id: 'prologue',
    title: 'Prologue',
    subtitle: 'The Shattering',
    description: 'Three Rift-corrupted fighters block the path to the Nexus. Break through.',
    enemies: ENEMY_TEAM,
    seed: 0x5eed_2026,
  },
];

export function getStage(id: string): StageSpec {
  const stage = STAGES.find((candidate) => candidate.id === id);
  if (!stage) throw new Error(`Unknown stage "${id}"`);
  return stage;
}
