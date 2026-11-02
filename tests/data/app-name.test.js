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
