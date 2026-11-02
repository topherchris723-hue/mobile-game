#!/usr/bin/env node
// QA BUG-3-01 re-test (GDD §5.15, AC-5.15.7 statistical part): share of player Climax windups the AI slips
// must be within ±2 pp of the tier's slip_chance (one roll per card). Player: human, plays one Climax
// (beam, so no approach) at melee range with the AI Idle and Vigor 10. Usage: node tests/sim/ai-slip-rate.mjs [n]
// QA_BREAK=reroll re-rolls the AI every tick (the old bug) to prove the check fails.
import fs from 'node:fs';
import { createBattle, createContent } from '../../src/logic/index.js';
const read = (f) => JSON.parse(fs.readFileSync(new URL('../../data/' + f, import.meta.url)));
const D = { battle: read('battle.json'), characters: read('characters.json'), cards: read('cards.json'), enemies: read('enemies.json'), stages: read('stages.json'), economy: read('economy.json') };
const content = createContent(D);
const N = Number(process.argv[2] || 2000);
const tiers = { rookie: 'enemy_rook_001', fighter: 'enemy_rook_003', veteran: 'enemy_thessa_002', master: 'enemy_corvane_001' };
let bad = 0;
for (const [tier, enemy] of Object.entries(tiers)) {
  let slipped = 0;
  let n = 0;
  let skipped = 0;
  let multi = 0;
  const S0 = Number(process.env.SEED0 || 1);
  for (let seed = S0; seed < S0 + N; seed++) {
    const b = createBattle({ content, enemyTeam: [enemy], playerTeam: ['char_pell_001', 'char_lark_001', 'char_dunmore_001'], skipIntro: true }, seed);
    b.teams.player.x = 44; b.teams.enemy.x = 56;
    const f = b.activeFighter('player');
    f.deck.hand[0] = 'card_pell_thousand_dawns'; f.deck.refillAt[0] = -1;
    b.teams.player.vigor = 6000 * 10; b.teams.enemy.vigor = 6000 * 10;
    if (b.activeFighter('enemy').state !== 'Idle') continue;
    if (process.env.QA_BREAK === 'nocommit') b.controllers.enemy.slipCommitted = () => false; // BUG-3-02 fix switched off
    if (process.env.QA_BREAK === 'reroll') { const ai = b.controllers.enemy; const orig = ai.decide.bind(ai); ai.decide = () => { if ('watched' in ai) ai.watched = null; return orig(); }; }
    const evs = b.step([{ type: 'card', slot: 0 }]);
    if (!evs.some((e) => e.type === 'card_played' && e.side === 'player')) continue;
    n++;
    let s = false;
    for (let i = 0; i < 90 && !b.getResult(); i++) {
      const ev = b.step([]);
      if (ev.some((e) => e.type === 'slip' && e.side === 'enemy')) s = true;
      if (ev.some((e) => (e.type === 'hit' || e.type === 'whiff') && e.side === 'player')) break;
    }
    // AC-5.15.7 condition: AI Idle with Vigor >= 2 on its decision tick D (i.e. it was able to roll).
    const log = b.controllers.enemy.dodgeLog.filter((r) => r.oppSide === 'player');
    const rolls = log.filter((r) => r.slipRoll !== null).length;
    if (process.env.QA_BREAK !== 'reroll' && (log.length === 0 || log[0].slipRoll === null)) { n--; skipped++; continue; }
    if (rolls > 1) multi++;
    if (s) slipped++;
  }
  const want = D.battle.ai_tiers[tier].slip_chance;
  const got = slipped / n;
  const ok = Math.abs(got - want) <= 0.02 + 1.96 * Math.sqrt(want * (1 - want) / n) - 0.0; // ±2 pp (plus sampling CI at small n)
  if (!ok) bad++;
  console.log((ok ? 'PASS ' : 'FAIL ') + tier.padEnd(8) + ' slipped ' + (100 * got).toFixed(1) + '% of ' + n + ' eligible Climax windups (skipped ' + skipped + ' not Idle/Vigor on D), slip_chance ' + (100 * want).toFixed(0) + '%, cards with >1 roll: ' + multi);
}
process.exitCode = bad ? 1 : 0;
