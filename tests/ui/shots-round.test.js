// ui-developer round 5 (L-shared-017): screenshot folder from one round source; never an earlier round's folder.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../helpers/load-data.js';

// helpers.js imports @playwright/test (fine in node) and reads docs/STATUS.md relative to cwd = ROOT under vitest
const { currentRound, shotsDir, SHOTS } = await import('../e2e/helpers.js');

describe('screenshot round constant', () => {
  const status = fs.readFileSync(path.join(ROOT, 'docs/STATUS.md'), 'utf8');
  it('SHOTS is the current round from docs/STATUS.md', () => {
    expect(SHOTS).toBe('reports/screenshots/round-' + currentRound({}, status));
  });
  it('must-FAIL: an env ROUND that disagrees with STATUS.md throws', () => {
    expect(() => currentRound({ ROUND: '3' }, '**Round:** 5')).toThrow(/ROUND=3/);
  });
  it('must-FAIL: writing into an earlier round folder is refused', () => {
    expect(() => shotsDir(4, ['round-3', 'round-4', 'round-5'])).toThrow(/round-5 already exists/);
    expect(shotsDir(5, ['round-4', 'round-5'])).toBe('reports/screenshots/round-5');
  });
});
