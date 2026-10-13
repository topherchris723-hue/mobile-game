import type { FighterSpec, TypeId, WorldId } from '../config/fighters';
import type { LeaderSkill, SovereignSpec } from '../config/sovereigns';

const WORLD_LABEL: Readonly<Record<WorldId, string>> = {
  energy: 'Energy realm',
  ocean: 'Ocean crew',
  clans: 'Warrior clan',
  rift: 'Rift',
};

const TYPE_LABEL: Readonly<Record<TypeId, string>> = {
  fury: 'Fury',
  swift: 'Swift',
  guile: 'Guile',
  radiant: 'Radiant',
  void: 'Void',
};

/** Plain-English Leader Skill text for the UI, e.g. "Energy realm allies +15% ATK". */
export function describeLeaderSkill(skill: LeaderSkill): string {
  if (skill.kind === 'startingEnergy') {
    return `Start each battle with +${skill.amount} Rift Energy`;
  }
  const who =
    skill.filter.kind === 'all'
      ? 'All allies'
      : skill.filter.kind === 'world'
        ? `${WORLD_LABEL[skill.filter.world]} allies`
        : `${TYPE_LABEL[skill.filter.type]} allies`;
  return `${who} +${Math.round(skill.amount * 100)}% ${skill.stat.toUpperCase()}`;
}

function benefits(skill: LeaderSkill, member: FighterSpec): boolean {
  if (skill.kind !== 'stat') return false;
  switch (skill.filter.kind) {
    case 'all':
      return true;
    case 'world':
      return member.world === skill.filter.world;
    case 'type':
      return member.type === skill.filter.type;
  }
}

export interface LedTeam {
  /** Battle-ready specs with the leader's bonus applied (the roster data is never mutated). */
  readonly fighters: readonly FighterSpec[];
  readonly bonusEnergy: number;
}

/** Applies slot 1's Leader Skill to the whole team (game-design.md §5). */
export function applyLeaderSkill(team: readonly SovereignSpec[]): LedTeam {
  const leader = team[0];
  if (!leader) return { fighters: team, bonusEnergy: 0 };
  const skill = leader.leaderSkill;
  if (skill.kind === 'startingEnergy') return { fighters: team, bonusEnergy: skill.amount };
  const fighters = team.map((member) =>
    benefits(skill, member)
      ? { ...member, [skill.stat]: Math.round(member[skill.stat] * (1 + skill.amount)) }
      : member,
  );
  return { fighters, bonusEnergy: 0 };
}
