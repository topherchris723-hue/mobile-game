import fs from 'node:fs';
import { createBattle, createContent } from './src/logic/index.js';
const read = (f) => JSON.parse(fs.readFileSync('data/' + f, 'utf8'));
const data = { battle: read('battle.json'), characters: read('characters.json'), cards: read('cards.json'), enemies: read('enemies.json'), stages: read('stages.json'), economy: read('economy.json') };
const content = createContent(data);
const chars = data.characters.characters.filter((c) => c.playable).map((c) => c.id);
const st = {}; const ev = {};
const allCards = (data.cards.cards || data.cards).map((c) => c.id);
let seed = 1;
for (let rep = 0; rep < 40; rep++) for (let a = 0; a < chars.length; a++) {
  const team = [chars[a], chars[(a + 1 + rep % 3) % 8], chars[(a + 5) % 8]];
  if (new Set(team).size < 3) continue;
  for (const stage of data.stages.stages.map((s) => s.id)) {
    const b = createBattle({ content, stageId: stage, playerTeam: team, playerController: { aiTier: 'master' }, skipIntro: true }, seed++);
    let n = 0; const playing = {};
    while (!b.getResult() && n++ < 40000) for (const e of b.step()) {
      ev[e.type] = (ev[e.type] || 0) + 1;
      if (e.type === 'card_played') { const s = (st[e.cardId] ||= { played: 0, dmg: 0, hits: 0, effects: 0 }); s.played++; }
      if (e.type === 'hit' && e.cardId) { const s = (st[e.cardId] ||= { played: 0, dmg: 0, hits: 0, effects: 0 }); s.hits++; s.dmg += e.damage; }
      if (e.type === 'effect' && e.cardId) { const s = (st[e.cardId] ||= { played: 0, dmg: 0, hits: 0, effects: 0 }); s.effects++; }
    }
  }
}
const never = allCards.filter((c) => !st[c] || st[c].played === 0);
const noOutcome = Object.entries(st).filter(([k, v]) => v.played > 0 && v.hits === 0 && v.effects === 0).map(([k]) => k);
console.log(JSON.stringify({ cards: allCards.length, neverPlayed: never, playedButNoHitOrEffect: noOutcome, events: Object.fromEntries(['ignition', 'tri_burst', 'tri_burst_hit', 'perfect_slip', 'riposte', 'tag', 'tag_strike', 'climax_cinematic', 'effect', 'ko'].map((k) => [k, ev[k] || 0])) }, null, 1));
