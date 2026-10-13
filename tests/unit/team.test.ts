import { describe, expect, it } from 'vitest';
import { assignToSlot, type Team } from '../../src/game/team';

describe('assignToSlot', () => {
  const team: Team = ['kaien', 'maris', 'torvan'];

  it('places a new Sovereign into a slot', () => {
    expect(assignToSlot(team, 1, 'goro')).toEqual(['kaien', 'goro', 'torvan']);
  });

  it('swaps when the Sovereign is already in the team', () => {
    expect(assignToSlot(team, 0, 'torvan')).toEqual(['torvan', 'maris', 'kaien']);
  });

  it('returns the same team when nothing changes', () => {
    expect(assignToSlot(team, 2, 'torvan')).toBe(team);
  });

  it('never produces duplicates', () => {
    for (const slot of [0, 1, 2] as const) {
      for (const id of ['kaien', 'maris', 'torvan', 'goro']) {
        expect(new Set(assignToSlot(team, slot, id)).size).toBe(3);
      }
    }
  });
});
