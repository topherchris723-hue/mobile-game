// GDD §9.4 round 3: tutorial prompt cap and 'none' step time are data (battle.json), with defaults 20 s and 3.0 s.
import { describe, it, expect } from 'vitest';
import { buildRules } from '../../src/logic/rules.js';
import { readJson } from '../helpers/load-data.js';

const battle = readJson('data/battle.json');

describe('§9.4 tutorial timing constants', () => {
  it('reads tutorial_prompt_max_s and tutorial_none_s from battle.json when present', () => {
    const b = JSON.parse(JSON.stringify(battle));
    b.tutorial_prompt_max_s = 25;
    b.tutorial_none_s = 4;
    const R = buildRules(b);
    expect(R.tutorialPromptMaxS).toBe(25);
    expect(R.tutorialNoneS).toBe(4);
  });

  it('AC-9.4.3: with tutorial_prompt_max_s removed the cap is 20 s; tutorial_none_s removed → 3.0 s', () => {
    const b = JSON.parse(JSON.stringify(battle));
    delete b.tutorial_prompt_max_s;
    delete b.tutorial_none_s;
    const R = buildRules(b);
    expect(R.tutorialPromptMaxS).toBe(20);
    expect(R.tutorialNoneS).toBe(3);
  });

  it('the live data gives a number in the schema range for both', () => {
    const R = buildRules(battle);
    expect(R.tutorialPromptMaxS).toBe(typeof battle.tutorial_prompt_max_s === 'number' ? battle.tutorial_prompt_max_s : 20);
    expect(R.tutorialNoneS).toBe(typeof battle.tutorial_none_s === 'number' ? battle.tutorial_none_s : 3);
    expect(R.tutorialSlowmo).toBe(battle.tutorial_slowmo);
  });
});
