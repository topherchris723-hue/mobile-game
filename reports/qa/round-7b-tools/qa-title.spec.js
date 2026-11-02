// QA round 7 (qa-tester): AC-1.1 in the browser. The title screen, Home top bar, document title and Settings → Licenses
// show the game title read from src/ui/strings.json `game_title` (expected "Fyrenza", GDD §1); no rendered text shows the
// old title. Runs once (360 project) and opens its own context per size; screenshots only with QA_SHOTS=1.
// Negative proof: run on a scratch copy with game_title = "Jade Tempest" → every size FAILs (see reports/qa/round-7b.md).
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { SIZES, boot, newPhone, waitScene, tap, shot, scanTexts, layoutProblems, targets, watchErrors } from './qa-helpers.js';

const STRINGS = JSON.parse(fs.readFileSync('src/ui/strings.json', 'utf8')).strings;
const GDD_TITLE = 'Fyrenza'; // GDD §1: in-game title exactly "Fyrenza"
const OLD = /jade\s*tempest/i;

test('AC-1.1 title on screen: Title, Home, <title>, Licenses name the strings.json game_title ("Fyrenza")', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-360x640', 'opens its own contexts for every size');
  test.setTimeout(300000);
  expect(STRINGS.game_title, 'strings.json game_title vs GDD §1').toBe(GDD_TITLE);
  const problems = [];
  for (const size of SIZES) {
    const { ctx, page } = await newPhone(browser, size);
    const errors = watchErrors(page);
    await boot(page, null);
    await page.waitForTimeout(600); // title scale tween is 420 ms (TitleScene); bounds are read after it ends
    const docTitle = await page.title();
    if (docTitle !== STRINGS.game_title) problems.push(`${size.name} document.title=${JSON.stringify(docTitle)}`);
    let scan = await scanTexts(page);
    const titleTexts = scan.texts.filter((x) => x.text === STRINGS.game_title);
    if (titleTexts.length !== 1) problems.push(`${size.name} Title: ${titleTexts.length} texts equal "${STRINGS.game_title}"; texts=${JSON.stringify(scan.texts.map((x) => x.text))}`);
    else if (titleTexts[0].size !== 40) problems.push(`${size.name} Title text font ${titleTexts[0].size}, expected the 40 px title`);
    for (const x of scan.texts) if (OLD.test(x.text)) problems.push(`${size.name} Title shows old title: "${x.text}"`);
    for (const p of layoutProblems(scan, await targets(page))) problems.push(`${size.name} Title layout: ${p}`);
    await shot(page, `${size.name}-title-ac11-01-title`);

    await tap(page, 'start');
    await waitScene(page, 'Home');
    scan = await scanTexts(page);
    if (!scan.texts.some((x) => x.text === STRINGS.game_title)) problems.push(`${size.name} Home: no text equals "${STRINGS.game_title}"; texts=${JSON.stringify(scan.texts.map((x) => x.text))}`);
    for (const x of scan.texts) if (OLD.test(x.text)) problems.push(`${size.name} Home shows old title: "${x.text}"`);
    await shot(page, `${size.name}-title-ac11-02-home`);

    await tap(page, 'home_settings');
    await waitScene(page, 'Settings');
    await tap(page, 'settings_licenses');
    await waitScene(page, 'Licenses');
    await page.waitForFunction(() => window.__TEST__.licensesScreen().loaded || window.__TEST__.licensesScreen().error, null, { timeout: 10000 });
    const lic = await page.evaluate(() => window.__TEST__.licensesScreen());
    const first = (lic.text || '').split('\n')[0];
    const want = `${STRINGS.game_title} includes the following third-party software.`;
    if (first !== want) problems.push(`${size.name} Licenses first line ${JSON.stringify(first)}, expected ${JSON.stringify(want)}`);
    if (OLD.test(lic.text || '')) problems.push(`${size.name} Licenses text contains the old title`);
    scan = await scanTexts(page);
    if (!scan.texts.some((x) => x.text.startsWith(STRINGS.game_title + ' includes'))) problems.push(`${size.name} Licenses: header line not rendered; texts=${JSON.stringify(scan.texts.map((x) => x.text).slice(0, 6))}`);
    await shot(page, `${size.name}-title-ac11-03-licenses`);
    for (const e of errors) problems.push(`${size.name} ${e}`);
    await ctx.close();
  }
  if (problems.length) console.log('AC-1.1 browser problems:\n  ' + problems.join('\n  '));
  expect(problems, problems.join('\n')).toEqual([]);
});
