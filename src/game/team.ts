/**
 * Team editing rules: a team is always three different Sovereigns; slot 0 leads.
 * Placing a Sovereign who is already in the team swaps the two slots, so the team stays valid.
 */
export type Team = readonly [string, string, string];

export function assignToSlot(team: Team, slot: 0 | 1 | 2, sovereignId: string): Team {
  const next: [string, string, string] = [team[0], team[1], team[2]];
  const existing = next.indexOf(sovereignId);
  if (existing === slot) return team;
  if (existing !== -1) next[existing] = next[slot];
  next[slot] = sovereignId;
  return next;
}
