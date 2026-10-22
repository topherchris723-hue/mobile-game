#!/usr/bin/env node
// QA L-qa-001: build the banned-term list fresh from GDD §3 and grep files case-insensitively (whole words).
// Usage: node tests/sim/banned-grep.mjs [paths...]   (default: data src index.html docs/store if present)
// Exit 1 if any hard term hits. "stand"/"hollow" are printed as REVIEW hits for a human.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const gdd = fs.readFileSync(path.join(root, 'docs/GDD.md'), 'utf8');
const sec = gdd.split('**Banned terms.**')[1].split('QA should grep')[0];
const listText = sec.split(':').slice(1).join(':');
const terms = new Set();
for (let raw of listText.split(',')) {
  raw = raw.replace(/\s+/g, ' ').replace(/\(.*?\)/g, '').trim().replace(/\.$/, '');
  if (!raw) continue;
  // "Dragon Ball(s)" -> dragon ball / dragon balls ; "Awaken/Awakening" -> both
  for (const part of raw.split('/')) {
    const t = part.trim().toLowerCase();
    if (t) terms.add(t);
  }
}
if (terms.has('dragon ball')) terms.add('dragon balls');
const REVIEW = new Set(['stand', 'hollow']);
const args = process.argv.slice(2);
const targets = args.length ? args : ['data', 'src', 'index.html', 'docs/store', 'store'].filter((p) => fs.existsSync(path.join(root, p)));

function walk(p, out) {
  const abs = path.isAbsolute(p) ? p : path.join(root, p);
  if (!fs.existsSync(abs)) return;
  const st = fs.statSync(abs);
  if (st.isDirectory()) { for (const f of fs.readdirSync(abs)) { if (f === 'schemas') continue; walk(path.join(abs, f), out); } }
  else if (/\.(json|js|mjs|html|md|txt|css)$/.test(abs)) out.push(abs);
}
const files = [];
for (const t of targets) walk(t, files);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
let hard = 0, review = 0;
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const t of terms) {
      const re = new RegExp('(?<![A-Za-z])' + esc(t) + '(?![A-Za-z])', 'i');
      if (re.test(line)) {
        const kind = REVIEW.has(t) ? 'REVIEW' : 'HIT';
        if (kind === 'HIT') hard++; else review++;
        console.log(kind + ' [' + t + '] ' + path.relative(root, f) + ':' + (i + 1) + ': ' + line.trim().slice(0, 160));
      }
    }
  });
}
console.log('terms=' + terms.size + ' files=' + files.length + ' hard_hits=' + hard + ' review_hits=' + review);
process.exitCode = hard > 0 ? 1 : 0;
