// GDD §8 AC-8.2 (b) (P, live data): `variant` is display-only. For seeds 1–200 on every stage containing an Umbral
// enemy, the battle event-log hash (every event, tick included) is identical with every `variant` field removed from
// enemies.json. Positive control (must-FAIL): logic that reads `variant` changes the hash.
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { createBattle, createContent } from '../../src/logic/index.js';
import { loadBundle, readJson } from '../helpers/load-data.js';

// The Umbral enemies named in GDD §8. If the live data does not carry `variant` on them yet, it is set in memory so the
// comparison is never vacuous (the content-designer is adding it in data/enemies.json).
const UMBRAL_IDS = ['enemy_umbral_rook_001', 'enemy_umbral_pell_001', 'enemy_umbral_solenne_001'];
const TEAM = readJson('data/economy.json').starting.team;

function bundles() {
  const withV = loadBundle();
  withV.economy = readJson('data/economy.json');
  for (const e of withV.enemies.enemies) if (UMBRAL_IDS.indexOf(e.id) >= 0 && !e.variant) e.variant = 'umbral';
  const without = JSON.parse(JSON.stringify(withV));
  for (const e of without.enemies.enemies) delete e.variant;
  return { withV, without };
}

/** Stages whose enemy team has an enemy with `variant` set. */
function umbralStages(bundle) {
  const v = {};
  for (const e of bundle.enemies.enemies) if (e.variant) v[e.id] = true;
  return bundle.stages.stages.filter((s) => s.enemy_team.some((id) => v[id])).map((s) => s.id);
}

/** sha256 of the full event log of every seed 1–200 on each stage. `hook(b, content)` runs after createBattle. */
function logHash(content, stages, hook) {
  const h = crypto.createHash('sha256');
  for (const stageId of stages) {
    for (let seed = 1; seed <= 200; seed++) {
      const b = createBattle({ content, stageId, playerTeam: TEAM, playerController: { aiTier: 'fighter' }, skipIntro: true }, seed);
      if (hook) hook(b, content);
      let guard = 0;
      while (!b.getResult() && guard++ < 100000) for (const e of b.step()) h.update(JSON.stringify(e));
      h.update(JSON.stringify(b.getResult()));
    }
  }
  return h.digest('hex');
}

/** Positive control: a "logic" that reads `variant` (Umbral enemies get +1 ATK). */
function variantReader(b, content) {
  for (const f of b.teams.enemy.fighters) {
    const rec = content.enemies[f.def.enemyId];
    if (rec && rec.variant) f.def.atk += 1;
  }
}

describe('AC-8.2 (b): enemy `variant` never affects the battle (seeds 1–200, every stage with an Umbral enemy)', () => {
  const { withV, without } = bundles();
  const stages = umbralStages(withV);
  const cWith = createContent(withV);
  const cWithout = createContent(without);
  const hWith = logHash(cWith, stages);
  it('there is at least one stage with an Umbral enemy', () => {
    expect(stages.length).toBeGreaterThan(0);
  });
  it('the event-log hash is identical with every `variant` removed', () => {
    expect(logHash(cWithout, stages)).toBe(hWith);
  });
  it('positive control (must-FAIL): logic that reads `variant` changes the hash', () => {
    expect(logHash(cWith, stages, variantReader)).not.toBe(hWith);
    expect(logHash(cWithout, stages, variantReader)).toBe(hWith); // the same patch is inert without `variant`
  });
});
