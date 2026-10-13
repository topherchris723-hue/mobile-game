import { expect, test, type Page } from '@playwright/test';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function bootToHome(page: Page, query = '?debug=1'): Promise<void> {
  await page.goto(`./${query}`);
  const button = page.getByRole('button', { name: 'Tap to start' });
  await expect(button).toBeEnabled({ timeout: 15_000 });
  await button.tap();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'home');
}

const tile = (page: Page, id: string) => page.locator(`.home-tile[data-tile="${id}"]`);

test('boots to the home menu with the team and four tiles', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await bootToHome(page, '');
  await expect(page.locator('.home-title')).toHaveText('Shattered Sovereigns');
  for (const id of ['story', 'sovereigns', 'summon', 'guilds'])
    await expect(tile(page, id)).toBeVisible();
  await expect(page.locator('.team-portrait figcaption')).toHaveText(['Kaien', 'Maris', 'Torvan']);
  await expect(page.locator('.team-card-skill')).toContainText('Energy realm allies +15% ATK');
  // Portraits are rendered from the battle art.
  await expect(page.locator('.team-portrait img').first()).toHaveAttribute(
    'src',
    /^data:image\/png/,
  );
  await page.waitForTimeout(500);
  await page.screenshot({ path: testInfo.outputPath('home.png') });
  expect(errors).toEqual([]);
});

test('the locked Guilds tile explains why and does not navigate', async ({ page }) => {
  await bootToHome(page);
  // Locked tiles are aria-disabled but stay tappable so they can explain themselves; Playwright
  // won't tap aria-disabled elements without force.
  await expect(tile(page, 'summon')).toHaveAttribute('aria-disabled', 'false');
  await tile(page, 'guilds').tap({ force: true });
  await expect(page.locator('.menu-toast')).toContainText('online');
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'home');
});

test('the collection shows all 15 Sovereigns, 6 recruited', async ({ page }, testInfo) => {
  await bootToHome(page);
  await tile(page, 'sovereigns').tap();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'sovereigns');
  await expect(page.locator('.sovereign-card')).toHaveCount(15);
  await expect(page.locator('.sovereign-card:not(.is-locked)')).toHaveCount(6);
  await expect(page.locator('.screen-title')).toHaveText('Sovereigns · 6/15');
  await page.locator('.sovereign-card.is-locked').first().tap();
  await expect(page.locator('.menu-toast')).toContainText('Summon menu');
  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath('sovereigns.png'), fullPage: true });
});

test('team changes are saved and survive a reload', async ({ page }) => {
  await bootToHome(page);
  await tile(page, 'sovereigns').tap();
  await page.locator('.team-slot[data-slot="0"]').tap();
  await expect(page.locator('.team-hint')).toHaveText('Choose a Sovereign for Leader');
  await page.locator('.sovereign-card[data-sovereign="goro"]').tap();
  await expect(page.locator('.menu-toast')).toContainText('Goro now leads the team');
  await expect(page.locator('.team-slot-name')).toHaveText(['Goro', 'Maris', 'Torvan']);

  await page.reload();
  await bootToHome(page);
  await expect(page.locator('.team-portrait figcaption')).toHaveText(['Goro', 'Maris', 'Torvan']);
});

test('the detail sheet shows stats, leader skill, and the full deck', async ({
  page,
}, testInfo) => {
  await bootToHome(page);
  await tile(page, 'sovereigns').tap();
  await page.locator('.sovereign-card[data-sovereign="torvan"]').tap();
  const sheet = page.locator('.detail-panel');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('h2')).toHaveText('Torvan');
  await expect(sheet.locator('.stat-row')).toHaveCount(4);
  await expect(sheet.locator('.detail-deck li')).toHaveCount(6);
  await expect(sheet.locator('.detail-leader').first()).toContainText(
    'Warrior clan allies +20% DEF',
  );
  await expect(sheet.locator('.detail-passive')).toContainText('Deep Roots');
  await page.screenshot({ path: testInfo.outputPath('detail.png') });
  await sheet.getByRole('button', { name: 'Make Leader' }).tap();
  await expect(sheet).toBeHidden();
  await expect(page.locator('.team-slot-name').first()).toHaveText('Torvan');
});

test('story leads into a battle, and the result screen returns home', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await bootToHome(page, '?debug=1&speed=20');
  await tile(page, 'story').tap();
  await expect(page.locator('.stage-card')).toHaveCount(2);
  await expect(page.locator('.stage-card.is-locked')).toContainText('Chapter 1');
  await page.locator('[data-stage="prologue"]').tap();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'battle');

  const turnNumber = () => page.evaluate(() => window.__sovereigns?.turnNumber() ?? 0);
  const phase = () => page.evaluate(() => window.__sovereigns?.phase() ?? null);
  for (let turn = 0; turn < 80; turn++) {
    await expect.poll(phase, { timeout: 30_000 }).toMatch(/^(playerInput|ended)$/);
    if ((await phase()) === 'ended') break;
    const before = await turnNumber();
    const affordable = page.locator('.player-panel .card[aria-disabled="false"]');
    if ((await affordable.count()) > 0) await affordable.last().tap();
    else await page.locator('.charge-button').tap();
    await expect.poll(turnNumber, { timeout: 30_000 }).toBeGreaterThan(before);
  }
  await expect(page.locator('.result')).toBeVisible();
  const won = (await page.locator('.result h2').textContent()) === 'Victory';
  if (won) {
    await expect(page.locator('.result-reward[data-currency="coins"]')).toContainText(
      '+500 Coins · Victory',
    );
    await expect(page.locator('.result-reward[data-currency="gems"]')).toContainText(
      '+100 Gems · First clear',
    );
  }
  await page.getByRole('button', { name: 'Home' }).tap();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'home');
  if (won) {
    await expect(tile(page, 'story')).toContainText('Prologue cleared');
    // First-clear reward: 500 welcome Gems + 100; Coins: 2,000 welcome + 500 per win.
    await expect(page.locator('.home-gems')).toHaveText('600');
    await expect(page.locator('.home-coins')).toHaveText('2,500');
  }
  expect(errors).toEqual([]);
});

test('settings open from Home, apply, and are remembered', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await bootToHome(page, '');
  await page.getByRole('button', { name: 'Settings' }).tap();
  const motion = page.locator('[data-setting="reduceMotion"]');
  await expect(motion).toHaveAttribute('aria-checked', 'false');
  await motion.tap();
  await expect(motion).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('body')).toHaveAttribute('data-reduce-motion', 'true');
  await page.locator('[data-setting="sound"]').tap();
  await expect(page.locator('[data-setting="sound"]')).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('.settings-build')).toContainText('Build');
  await page.screenshot({ path: testInfo.outputPath('settings.png') });
  await page.getByRole('button', { name: 'Done' }).tap();
  await expect(page.locator('.settings-sheet')).toHaveCount(0);

  await bootToHome(page, '');
  await expect(page.locator('body')).toHaveAttribute('data-reduce-motion', 'true');
  await page.getByRole('button', { name: 'Settings' }).tap();
  await expect(page.locator('[data-setting="sound"]')).toHaveAttribute('aria-checked', 'false');
  expect(errors).toEqual([]);
});

test('levelling spends Coins, raises stats, and is saved', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await bootToHome(page);
  await expect(page.locator('.home-coins')).toHaveText('2,000');
  await tile(page, 'sovereigns').tap();
  await page.locator('.sovereign-card[data-sovereign="kaien"]').tap();
  const sheet = page.locator('.detail-panel');
  await expect(sheet.locator('.level-value')).toHaveText('Lv 1');
  const hpBefore = Number(await sheet.locator('.stat-row b').first().textContent());
  await sheet.locator('.level-button').first().tap();
  await expect(sheet.locator('.level-value')).toHaveText('Lv 2');
  await expect(page.locator('.menu-toast')).toContainText('Kaien reached Lv 2');
  await sheet.locator('.level-button').nth(1).tap();
  await expect(sheet.locator('.level-value')).toHaveText('Lv 12');
  expect(Number(await sheet.locator('.stat-row b').first().textContent())).toBeGreaterThan(
    hpBefore,
  );
  await page.screenshot({ path: testInfo.outputPath('levelled.png') });
  // Lv 1→2 costs 20; Lv 2→12 costs 30 + 40 + … + 120 = 750; 2,000 − 770 = 1,230.
  await expect(sheet.locator('.level-wallet')).toContainText('1,230');

  await page.reload();
  await bootToHome(page);
  await expect(page.locator('.home-coins')).toHaveText('1,230');
  await tile(page, 'sovereigns').tap();
  await expect(page.locator('.team-slot[data-slot="0"] .level-tag')).toHaveText('Lv 12');
  expect(errors).toEqual([]);
});

test('at the level cap, Limit Break asks for shards', async ({ page }) => {
  await bootToHome(page, '?debug=1');
  await tile(page, 'sovereigns').tap();
  await page.locator('.debug-gems').tap();
  await page.locator('.sovereign-card[data-sovereign="goro"]').tap();
  const sheet = page.locator('.detail-panel');
  // Goro is 3★: cap 30, reached with three +10 purchases (1 → 11 → 21 → 30).
  for (let i = 0; i < 3; i++) await sheet.locator('.level-button').nth(1).tap();
  await expect(sheet.locator('.level-value')).toHaveText('Lv 30');
  const limitBreak = sheet.locator('.level-button');
  await expect(limitBreak).toHaveCount(1);
  await expect(limitBreak).toContainText('Limit Break');
  await limitBreak.tap({ force: true });
  await expect(page.locator('.menu-toast')).toContainText('Not enough shards');
});
