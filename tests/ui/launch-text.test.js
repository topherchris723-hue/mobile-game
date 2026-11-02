// ui-developer round 7 (reviewer R-4, L-shared-023): no placeholder words in any player-facing string.
import { describe, it, expect } from 'vitest';
import table from '../../src/ui/strings.json';

export const BANNED = /\b(prototype|placeholder|working title|TBD|lorem|test value)\b/i;
export function launchTextProblems(strings) {
  return Object.entries(strings).filter(([, v]) => BANNED.test(String(v))).map(([k, v]) => k + ': ' + v);
}

describe('launch text', () => {
  it('strings.json has no prototype / placeholder / working title / TBD', () => {
    expect(launchTextProblems(table.strings)).toEqual([]);
  });
  it('must-FAIL: the round-6 subtitle is caught', () => {
    expect(launchTextProblems({ game_subtitle: 'working title — prototype' })).toHaveLength(1);
  });
});
