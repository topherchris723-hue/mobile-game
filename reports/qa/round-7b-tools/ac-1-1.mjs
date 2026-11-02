// QA round 7 (qa-tester): independent static check of GDD AC-1.1 (a)(b)(c) plus the Android label consistency
// (app_name == title_activity_main == capacitor appName == strings.json game_title).
// Usage: node tests/sim/ac-1-1.mjs [repoRoot]   (default: cwd). Exit 1 on any failure.
// Must-FAIL proofs: run it on a scratch copy with (1) game_title = "Jade Tempest", (2) a scene containing 'Fyrenza',
// (3) the store/listing.md app-name block set to "Fyrenza Arena", (4) title_activity_main changed.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || process.cwd());
const EXPECT_TITLE = 'Fyrenza';
const EXPECT_STORE = 'Fyrenza: Card Duels';
const fails = [];
const rel = (p) => path.relative(ROOT, p);

function walk(p, out = []) {
  if (!fs.existsSync(p)) return out;
  if (fs.statSync(p).isDirectory()) for (const e of fs.readdirSync(p).sort()) walk(path.join(p, e), out);
  else out.push(p);
  return out;
}
function grep(files, re) {
  const hits = [];
  for (const f of files) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => { if (re.test(line)) hits.push({ file: rel(f), line: i + 1, text: line.trim().slice(0, 160) }); });
  }
  return hits;
}
const isComment = (t) => /^\s*(\/\/|\/\*|\*|<!--)/.test(t);

// (a) title from strings.json; no literal title in scenes/ui code
const strings = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/ui/strings.json'), 'utf8')).strings;
if (strings.game_title !== EXPECT_TITLE) fails.push(`(a) strings.json game_title is "${strings.game_title}", expected "${EXPECT_TITLE}"`);
const aFiles = [...walk(path.join(ROOT, 'src/scenes')), ...walk(path.join(ROOT, 'src/ui'))].filter((f) => path.basename(f) !== 'strings.json');
const aHits = grep(aFiles, /fyrenza/i);
console.log(`(a) game_title="${strings.game_title}"; scanned ${aFiles.length} files in src/scenes + src/ui (excl. strings.json); "Fyrenza" hits: ${aHits.length}`);
for (const h of aHits) { console.log('    ', h.file + ':' + h.line, h.text); fails.push(`(a) literal title in ${h.file}:${h.line}`); }
if (aFiles.length < 10) fails.push(`(a) blind: only ${aFiles.length} files scanned`);

// (b) old title in player-visible files
const bRoots = ['src', 'data', 'index.html', 'capacitor.config.json', 'android/app/src/main/res/values'];
const bFiles = bRoots.flatMap((r) => walk(path.join(ROOT, r)));
const bAll = grep(bFiles, /jade\s*tempest/i);
const bVisible = bAll.filter((h) => !isComment(h.text));
console.log(`(b) scanned ${bFiles.length} files; "Jade Tempest" raw hits: ${bAll.length}; non-comment (player-visible) hits: ${bVisible.length}`);
for (const h of bAll) console.log('    ', isComment(h.text) ? '[comment]' : '[VISIBLE]', h.file + ':' + h.line, h.text);
for (const h of bVisible) fails.push(`(b) old title in ${h.file}:${h.line}`);
if (bFiles.length < 20) fails.push(`(b) blind: only ${bFiles.length} files scanned`);

// (c) store title exact + no old title in store/
const listing = fs.readFileSync(path.join(ROOT, 'store/listing.md'), 'utf8');
const m = /^## App name[^\n]*\n+```\n([^\n]*)\n```/m.exec(listing);
const storeTitle = m ? m[1] : null;
console.log(`(c) store/listing.md "App name" block: ${JSON.stringify(storeTitle)}`);
if (storeTitle !== EXPECT_STORE) fails.push(`(c) store title is ${JSON.stringify(storeTitle)}, expected "${EXPECT_STORE}"`);
const storeFiles = walk(path.join(ROOT, 'store'));
const cOld = grep(storeFiles, /jade\s*tempest/i);
console.log(`(c) scanned ${storeFiles.length} store files; "Jade Tempest" hits: ${cOld.length}`);
for (const h of cOld) { console.log('    ', h.file + ':' + h.line, h.text); fails.push(`(c) old title in ${h.file}:${h.line}`); }
// any "Fyrenza: <x>" or "Fyrenza <Capitalised>" store-title variant other than the exact store title
const variants = grep(storeFiles, /Fyrenza(:\s*|\s+)(?!Card Duels\b)[A-Z][a-z]+/).filter((h) => !/Fyrenza (is|does|made|includes)\b/.test(h.text));
console.log(`(c) other "Fyrenza <Title>" variants in store/: ${variants.length}`);
for (const h of variants) { console.log('    ', h.file + ':' + h.line, h.text); fails.push(`(c) title variant in ${h.file}:${h.line}`); }

// (d) Android labels and Capacitor appName agree with game_title
const cap = JSON.parse(fs.readFileSync(path.join(ROOT, 'capacitor.config.json'), 'utf8'));
const xml = fs.readFileSync(path.join(ROOT, 'android/app/src/main/res/values/strings.xml'), 'utf8');
const xs = (n) => { const r = new RegExp(`<string name="${n}">([^<]*)</string>`).exec(xml); return r ? r[1] : null; };
const labels = { 'strings.json game_title': strings.game_title, 'capacitor appName': cap.appName, app_name: xs('app_name'), title_activity_main: xs('title_activity_main') };
console.log('(d) labels:', JSON.stringify(labels));
for (const [k, v] of Object.entries(labels)) if (v !== EXPECT_TITLE) fails.push(`(d) ${k} is ${JSON.stringify(v)}, expected "${EXPECT_TITLE}"`);
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ht = (/<title>([^<]*)<\/title>/.exec(html) || [])[1];
console.log(`(d) index.html <title>: ${JSON.stringify(ht)}`);
if (ht !== EXPECT_TITLE) fails.push(`(d) index.html <title> is ${JSON.stringify(ht)}`);

if (fails.length) { console.log('AC-1.1 FAIL (' + fails.length + '):'); for (const f of fails) console.log('  - ' + f); process.exit(1); }
console.log('AC-1.1 PASS');
