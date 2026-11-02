// Round 7: the game title is "Fyrenza" (GDD §1, AC-1.1). The product name in the generated THIRD_PARTY_LICENSES.txt is
// read from src/ui/strings.json `game_title` (via readGameTitle in scripts/third-party-licenses.mjs), so it cannot drift
// from the title screen. Class P (reads the live strings file and repo files).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readGameTitle, thirdPartyLicenses, findOldTitleHits } from '../../scripts/third-party-licenses.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const STRINGS = path.join(ROOT, 'src', 'ui', 'strings.json');

/** Run the plugin's generateBundle on an empty bundle and return the emitted notice text. */
function noticeFrom(plugin) {
  const emitted = [];
  plugin.generateBundle.call({ emitFile: (f) => emitted.push(f) }, {}, {});
  return String(emitted.find((f) => f.fileName === 'THIRD_PARTY_LICENSES.txt').source);
}

function tmpFile(name, text) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-name-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, text);
  return file;
}

describe('licence notice product name comes from strings.json game_title', () => {
  it('readGameTitle returns the strings.json game_title', () => {
    const live = JSON.parse(fs.readFileSync(STRINGS, 'utf8')).strings.game_title;
    expect(readGameTitle(STRINGS)).toBe(live);
  });

  it('must-FAIL: a strings file without a non-empty game_title throws (the build stops, no unnamed notice)', () => {
    expect(() => readGameTitle(tmpFile('s.json', JSON.stringify({ strings: {} })))).toThrow(/game_title/);
    expect(() => readGameTitle(tmpFile('s.json', JSON.stringify({ strings: { game_title: '  ' } })))).toThrow(/game_title/);
    expect(() => readGameTitle(tmpFile('s.json', JSON.stringify({ strings: { game_title: 7 } })))).toThrow(/game_title/);
  });

  it('vite.config.js passes readGameTitle(strings.json) to the plugin, not a hardcoded name', () => {
    const cfg = fs.readFileSync(path.join(ROOT, 'vite.config.js'), 'utf8');
    expect(cfg).toMatch(/thirdPartyLicenses\(\s*readGameTitle\(/);
    expect(cfg).toMatch(/src['"/, ]+ui['"/, ]+strings\.json/);
    expect(cfg).not.toMatch(/thirdPartyLicenses\(\s*['"`]/);
  });

  it('the notice header names the title it was given', () => {
    const text = noticeFrom(thirdPartyLicenses('Fyrenza'));
    expect(text.split('\n')[0]).toBe('Fyrenza includes the following third-party software.');
  });
});

describe('AC-1.1 (P): the title is "Fyrenza" and "Jade Tempest" is gone from player-visible files', () => {
  it('(a, notice part) the built notice header names Fyrenza, read from strings.json', () => {
    expect(readGameTitle(STRINGS)).toBe('Fyrenza');
    expect(noticeFrom(thirdPartyLicenses(readGameTitle(STRINGS))).split('\n')[0]).toBe('Fyrenza includes the following third-party software.');
  });

  it('(b) case-insensitive grep for "Jade Tempest" over src/, data/, index.html, capacitor.config.json, android res/values finds 0 hits', () => {
    const roots = ['src', 'data', 'index.html', 'capacitor.config.json', 'android/app/src/main/res/values'];
    const hits = findOldTitleHits(ROOT, roots);
    expect(hits.scanned).toBeGreaterThan(20); // not blind
    expect(hits.hits).toEqual([]);
  });

  it('must-FAIL (b): game_title set back to "Jade Tempest" is found (1 hit); spacing/case variants too; comments are ignored', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ac11-'));
    fs.mkdirSync(path.join(dir, 'src', 'ui'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'ui', 'strings.json'), JSON.stringify({ strings: { game_title: 'Jade Tempest' } }, null, 2));
    expect(findOldTitleHits(dir, ['src']).hits).toHaveLength(1);
    fs.writeFileSync(path.join(dir, 'src', 'ui', 'x.js'), "// old name: Jade Tempest\nconst t = 'JADE  tempest';\n");
    const h = findOldTitleHits(dir, ['src']).hits;
    expect(h).toHaveLength(2);
    expect(h.some((x) => x.file.endsWith('x.js') && x.line === 2)).toBe(true);
    fs.writeFileSync(path.join(dir, 'src', 'ui', 'strings.json'), JSON.stringify({ strings: { game_title: 'Fyrenza' } }, null, 2));
    fs.writeFileSync(path.join(dir, 'src', 'ui', 'x.js'), "// old name: Jade Tempest\n/* Jade Tempest */\nconst t = 'Fyrenza';\n");
    expect(findOldTitleHits(dir, ['src']).hits).toEqual([]);
  });
});

// ---- AC-1.1 (a), (c) and label agreement (round 7, QA loop 2: moved from QA's reports/qa/round-7b-tools/ac-1-1.mjs). ----
const TITLE = 'Fyrenza';
const STORE_TITLE = 'Fyrenza: Card Duels';

/** List every file under root/rel (file or folder), sorted; missing paths give []. */
function listFiles(root, rel) {
  const out = [];
  const walk = (p) => {
    if (!fs.existsSync(p)) return;
    if (fs.statSync(p).isDirectory()) { for (const e of fs.readdirSync(p).sort()) walk(path.join(p, e)); return; }
    out.push(p);
  };
  walk(path.join(root, rel));
  return out;
}

/** Return every line in files that matches re, as { file, line, text } (file relative to root). */
function grepLines(root, files, re) {
  const hits = [];
  for (const f of files) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((text, i) => {
      if (re.test(text)) hits.push({ file: path.relative(root, f), line: i + 1, text: text.trim() });
    });
  }
  return hits;
}

/** AC-1.1 (a): every "Fyrenza" (any case, comments included) in src/scenes/ and src/ui/ outside strings.json. */
function findTitleLiteralHits(root) {
  const files = [...listFiles(root, 'src/scenes'), ...listFiles(root, 'src/ui')].filter((f) => path.basename(f) !== 'strings.json');
  return { scanned: files.length, hits: grepLines(root, files, /fyrenza/i) };
}

/** AC-1.1 (c): the text inside the ``` block under "## App name" in store/listing.md, or null if there is none. */
function readStoreAppName(root) {
  const file = path.join(root, 'store', 'listing.md');
  if (!fs.existsSync(file)) return null;
  const m = /^## App name[^\n]*\n+```\n([^\n]*)\n```/m.exec(fs.readFileSync(file, 'utf8'));
  return m ? m[1] : null;
}

/** AC-1.1 (c): every line in any store/ file with "Jade Tempest" (any case/spacing) or "Fyrenza Arena". */
function findStoreBadTitleHits(root) {
  const files = listFiles(root, 'store');
  return { scanned: files.length, hits: grepLines(root, files, /jade\s*tempest|fyrenza\s*arena/i) };
}

/** The four app labels that must equal game_title: strings.json, Capacitor appName, Android app_name and title_activity_main. */
function readAppLabels(root) {
  const strings = JSON.parse(fs.readFileSync(path.join(root, 'src', 'ui', 'strings.json'), 'utf8')).strings;
  const cap = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
  const xml = fs.readFileSync(path.join(root, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml'), 'utf8');
  const xs = (n) => { const r = new RegExp(`<string name="${n}">([^<]*)</string>`).exec(xml); return r ? r[1] : null; };
  return { game_title: strings.game_title, capacitor_appName: cap.appName, app_name: xs('app_name'), title_activity_main: xs('title_activity_main') };
}

/** Make a temp repo with a passing AC-1.1 layout; overrides map relative path -> file text. */
function makeRepo(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ac11ac-'));
  const files = {
    'src/ui/strings.json': JSON.stringify({ strings: { game_title: TITLE } }, null, 2),
    'src/ui/HUD.js': "export const t = S('game_title');\n",
    'src/scenes/TitleScene.js': "this.add.text(0, 0, S('game_title'));\n",
    'store/listing.md': '# Listing\n\n## App name (19 / 30)\n\n```\n' + STORE_TITLE + '\n```\n\n## Short description\n\n```\nCards.\n```\n',
    'store/release-notes/r7.md': 'Fyrenza is here.\n',
    'capacitor.config.json': JSON.stringify({ appName: TITLE }),
    'android/app/src/main/res/values/strings.xml':
      '<resources>\n    <string name="app_name">Fyrenza</string>\n    <string name="title_activity_main">Fyrenza</string>\n</resources>\n',
    ...overrides,
  };
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

const labelsAgree = (l) => Object.values(l).every((v) => v === l.game_title) && l.game_title === TITLE;

describe('AC-1.1 (P) (a): the title comes from strings.json game_title, never a literal in scenes/ui', () => {
  it('(a) live: game_title === "Fyrenza" and "Fyrenza" appears 0 times in src/scenes/ + src/ui/ outside strings.json', () => {
    expect(JSON.parse(fs.readFileSync(STRINGS, 'utf8')).strings.game_title).toBe(TITLE);
    const r = findTitleLiteralHits(ROOT);
    expect(r.scanned).toBeGreaterThan(10); // not blind
    expect(r.hits).toEqual([]);
  });

  it('must-PASS (a): the temp repo with the title only in strings.json has 0 hits', () => {
    expect(findTitleLiteralHits(makeRepo()).hits).toEqual([]);
  });

  it("must-FAIL (a): a scene with the literal 'Fyrenza' is found (1 hit); a ui file and a comment are found too", () => {
    const one = makeRepo({ 'src/scenes/TitleScene.js': "this.add.text(0, 0, 'Fyrenza');\n" });
    const h1 = findTitleLiteralHits(one).hits;
    expect(h1).toHaveLength(1);
    expect(h1[0]).toMatchObject({ file: path.join('src', 'scenes', 'TitleScene.js'), line: 1 });
    const two = makeRepo({ 'src/ui/HUD.js': "// FYRENZA HUD\nexport const t = `Fyrenza`;\n" });
    expect(findTitleLiteralHits(two).hits).toHaveLength(2);
  });
});

describe('AC-1.1 (P) (c): store title is exactly "Fyrenza: Card Duels"; no old or variant title in store/', () => {
  it('(c) live: store/listing.md App name block is exactly "Fyrenza: Card Duels"', () => {
    expect(readStoreAppName(ROOT)).toBe(STORE_TITLE);
  });

  it('(c) live: no store/ file contains "Jade Tempest" (any case) or "Fyrenza Arena"', () => {
    const r = findStoreBadTitleHits(ROOT);
    expect(r.scanned).toBeGreaterThan(2); // not blind
    expect(r.hits).toEqual([]);
  });

  it('must-PASS (c): the temp repo store title passes and has 0 bad-title hits', () => {
    const dir = makeRepo();
    expect(readStoreAppName(dir)).toBe(STORE_TITLE);
    expect(findStoreBadTitleHits(dir).hits).toEqual([]);
  });

  it('must-FAIL (c): a store/listing.md title "Fyrenza Arena" fails both the exact-title check and the grep', () => {
    const md = '# Listing\n\n## App name (13 / 30)\n\n```\nFyrenza Arena\n```\n';
    const dir = makeRepo({ 'store/listing.md': md });
    expect(readStoreAppName(dir)).not.toBe(STORE_TITLE);
    expect(findStoreBadTitleHits(dir).hits).toHaveLength(1);
  });

  it('must-FAIL (c): "jade tempest" (lower case) in any store/ file is found; a missing App name block reads as null', () => {
    const dir = makeRepo({ 'store/release-notes/r7.md': 'Formerly jade tempest.\n', 'store/listing.md': '# Listing\n\nNo name.\n' });
    expect(findStoreBadTitleHits(dir).hits).toMatchObject([{ file: path.join('store', 'release-notes', 'r7.md'), line: 1 }]);
    expect(readStoreAppName(dir)).toBeNull();
  });
});

describe('AC-1.1 (P): title_activity_main == app_name == capacitor appName == game_title', () => {
  it('live: all four labels are "Fyrenza"', () => {
    const l = readAppLabels(ROOT);
    expect(l).toEqual({ game_title: TITLE, capacitor_appName: TITLE, app_name: TITLE, title_activity_main: TITLE });
  });

  it('must-PASS: the temp repo labels agree', () => {
    expect(labelsAgree(readAppLabels(makeRepo()))).toBe(true);
  });

  it('must-FAIL: changing any one label (title_activity_main, app_name, appName, game_title) breaks agreement', () => {
    const xml = (a, t) => `<resources>\n    <string name="app_name">${a}</string>\n    <string name="title_activity_main">${t}</string>\n</resources>\n`;
    const bad = [
      { 'android/app/src/main/res/values/strings.xml': xml('Fyrenza', 'MainActivity') },
      { 'android/app/src/main/res/values/strings.xml': xml('Jade Tempest', 'Fyrenza') },
      { 'android/app/src/main/res/values/strings.xml': '<resources>\n    <string name="app_name">Fyrenza</string>\n</resources>\n' },
      { 'capacitor.config.json': JSON.stringify({ appName: 'Fyrenza Arena' }) },
      { 'src/ui/strings.json': JSON.stringify({ strings: { game_title: 'Jade Tempest' } }) },
    ];
    for (const o of bad) expect(labelsAgree(readAppLabels(makeRepo(o)))).toBe(false);
  });
});
