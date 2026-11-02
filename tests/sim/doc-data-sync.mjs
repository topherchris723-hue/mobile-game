#!/usr/bin/env node
// QA BUG-4-02 / L-shared-016: stage reward amounts in docs match data/stages.json.
// - docs/ECONOMY.md §2.2 table: first clear, repeat clear and the mission count (50 Jade each) per stage = data.
// - docs/GDD.md §9.2 contains no Jade amount (round-5 ruling: amounts live in data + ECONOMY.md only).
// Usage: node tests/sim/doc-data-sync.mjs [--economy <path>] [--gdd <path>]   (paths swapped for negative proofs)
import fs from 'node:fs';
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const root = new URL('../../', import.meta.url).pathname;
const stages = JSON.parse(fs.readFileSync(root + 'data/stages.json', 'utf8')).stages;
const eco = fs.readFileSync(arg('--economy', root + 'docs/ECONOMY.md'), 'utf8');
const gdd = fs.readFileSync(arg('--gdd', root + 'docs/GDD.md'), 'utf8');
let bad = 0;
const fail = (m) => { bad++; console.log('FAIL ' + m); };
const sec = eco.split('### 2.2')[1].split('###')[0];
for (const st of stages) {
  const row = sec.split('\n').find((l) => l.startsWith('| ' + st.id + ' '));
  if (!row) { fail(st.id + ': no row in ECONOMY.md §2.2'); continue; }
  const cells = row.split('|').map((c) => c.trim());
  const firstDoc = Number((cells[2].match(/\d[\d,]*/) || ['NaN'])[0].replace(/,/g, ''));
  const repeatDoc = Number((cells[3].match(/\d[\d,]*/) || ['NaN'])[0].replace(/,/g, ''));
  const jade = (list) => list.filter((r) => r.type === 'currency').reduce((a, r) => a + r.amount, 0);
  const first = jade(st.rewards.first_clear);
  const repeat = jade(st.rewards.repeat_clear);
  const missionsDoc = cells[4].split(',').length;
  const missionJade = (st.missions || []).map((m) => m.reward.amount);
  if (firstDoc !== first) fail(`${st.id}: first clear doc ${firstDoc} vs data ${first}`);
  if (repeatDoc !== repeat) fail(`${st.id}: repeat clear doc ${repeatDoc} vs data ${repeat}`);
  if (missionsDoc !== (st.missions || []).length) fail(`${st.id}: missions doc ${missionsDoc} vs data ${(st.missions || []).length}`);
  if (missionJade.some((a) => a !== 50)) fail(`${st.id}: mission reward not 50 Jade: ${missionJade}`);
  console.log(`${st.id}: data first ${first} repeat ${repeat} missions ${missionJade.length}×${missionJade[0]} | doc first ${firstDoc} repeat ${repeatDoc} missions ${missionsDoc}`);
}
const g92 = gdd.split('### 9.2')[1].split('### 9.3')[0];
const amounts = g92.split('\n').filter((l) => /\b\d[\d,]*\s*Jade\b/i.test(l) || /^\|.*\|\s*\d+\s*\|\s*$/.test(l));
if (amounts.length) fail('GDD §9.2 quotes Jade amounts: ' + amounts.map((l) => l.trim().slice(0, 80)).join(' || '));
console.log((bad ? 'FAIL' : 'PASS') + ` doc-data sync: ${stages.length} stages, ${bad} problems`);
process.exitCode = bad ? 1 : 0;
