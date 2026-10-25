// QA BUG-3-02 breakdown: per tier, AI slip-roll outcomes and the AI state on the planned Slip tick when the Slip is lost.
import fs from 'node:fs';
import { createBattle, createContent } from '../../src/logic/index.js';
const read = (f) => JSON.parse(fs.readFileSync(new URL('../../data/' + f, import.meta.url)));
const D = { battle: read('battle.json'), characters: read('characters.json'), cards: read('cards.json'), enemies: read('enemies.json'), stages: read('stages.json'), economy: read('economy.json') };
const content = createContent(D);
for (const enemy of ['enemy_rook_001', 'enemy_rook_003', 'enemy_thessa_002', 'enemy_corvane_001']) {
  const out = {}; let planned = 0, slipped = 0; const lostState = {};
  for (let seed = 1; seed <= 2000; seed++) {
    const b = createBattle({ content, enemyTeam: [enemy], playerTeam: ['char_pell_001', 'char_lark_001', 'char_dunmore_001'], skipIntro: true }, seed);
    b.teams.player.x = 44; b.teams.enemy.x = 56;
    const f = b.activeFighter('player'); f.deck.hand[0] = 'card_pell_thousand_dawns'; f.deck.refillAt[0] = -1;
    b.teams.player.vigor = 60000; b.teams.enemy.vigor = 60000;
    if (b.activeFighter('enemy').state !== 'Idle') continue;
    b.step([{ type: 'card', slot: 0 }]);
    const ai = b.controllers.enemy; let slip = false; let planAt = -1; let stAtPlan = null;
    for (let i = 0; i < 90; i++) {
      if (ai.plannedSlipAt >= 0) planAt = ai.plannedSlipAt;
      if (planAt >= 0 && b.tick === planAt) stAtPlan = b.activeFighter('enemy').state;
      const ev = b.step([]);
      if (ev.some((e) => e.type === 'slip' && e.side === 'enemy')) slip = true;
      if (ev.some((e) => (e.type === 'hit' || e.type === 'whiff') && e.side === 'player')) break;
    }
    const r = ai.dodgeLog.find((x) => x.oppSide === 'player');
    if (!r || r.slipRoll === null) continue;
    out[r.outcome] = (out[r.outcome] || 0) + 1;
    if (r.outcome === 'planned') { planned++; if (slip) slipped++; else lostState[stAtPlan] = (lostState[stAtPlan] || 0) + 1; }
  }
  console.log(enemy, JSON.stringify(out), 'planned', planned, 'slipped', slipped, 'lost (AI state on planned tick):', JSON.stringify(lostState));
}
