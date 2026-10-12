/**
 * Named Crossover Bursts for specific pairs (game-design.md §4.6). Discovering these is part of
 * collecting; any other cross-world pair uses the generic name. Keys are the two fighter ids in
 * alphabetical order joined by "+".
 */
export const NAMED_CROSSOVERS: Readonly<Record<string, string>> = {
  'kaien+maris': 'Sunbreak Riptide',
  'kaien+torvan': 'Ember Thornstorm',
  'maris+torvan': 'Tidal Bloom',
};

export function crossoverName(
  a: { id: string; name: string },
  b: { id: string; name: string },
): string {
  const key = [a.id, b.id].sort().join('+');
  return NAMED_CROSSOVERS[key] ?? `${a.name} × ${b.name}`;
}
