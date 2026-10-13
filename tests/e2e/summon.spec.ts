import { expect, test, type Page } from '@playwright/test';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function bootToSummon(page: Page, query = ''): Promise<void> {
  await page.goto(`./${query}`);
  const button = page.getByRole('button', { name: 'Tap to start' });
  await expect(button).toBeEnabled({ timeout: 15_000 });
  await button.tap();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'home');
  await expect(page.locator('.home-gems')).toHaveText('500');
  await page.locator('.home-tile[data-tile="summon"]').tap();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'summon');
}

test('the banner shows Gems, pity, and the published rates', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await bootToSummon(page);
  await expect(page.locator('.summon-screen .gem-balance')).toHaveText('500');
  await expect(page.locator('.pity-text')).toContainText('within 80 summons');
  await expect(page.locator('.debug-gems')).toHaveCount(0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath('summon.png') });
  await page.getByRole('button', { name: 'Rates & rules' }).tap();
  const rates = page.locator('.rates-head b');
  await expect(rates).toHaveText(['4%', '21%', '75%']);
  await expect(page.locator('.rates-names li')).toHaveCount(15);
  // Per-Sovereign rates are exact: 4% / 3 five-stars, 21% / 6, 75% / 6.
  await expect(page.locator('.rates-names li').first()).toContainText('1.33%');
  await expect(page.locator('.rates-names li').last()).toContainText('12.5%');
  await expect(page.locator('.rates-rules')).toContainText('guaranteed 5★');
  await page.screenshot({ path: testInfo.outputPath('rates.png') });
  await page.getByRole('button', { name: 'Close' }).tap();
  expect(errors).toEqual([]);
});

test('a multi summon spends Gems, reveals 11 Sovereigns, and is saved', async ({
  page,
}, testInfo) => {
  const errors = watchErrors(page);
  await bootToSummon(page);
  await page.locator('.summon-button[data-kind="multi"]').tap();
  await expect(page.locator('.summon-confirm')).toContainText('You have 500');
  await page.locator('.summon-confirm-go').tap();

  // Crystal → (any 5★ spotlights) → results grid.
  await expect(page.locator('.summon-crystal')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('crystal.png') });
  await page.locator('.summon-crystal').tap();
  const grid = page.locator('.summon-grid');
  const spotlight = page.locator('.summon-spotlight');
  for (let i = 0; i < 11 && !(await grid.isVisible()); i++) {
    await expect(spotlight.or(grid)).toBeVisible();
    if (await spotlight.isVisible()) {
      await page.screenshot({ path: testInfo.outputPath(`spotlight-${i}.png`) });
      await spotlight.tap();
    }
  }
  await expect(page.locator('.summon-card')).toHaveCount(11);
  // The multi guarantee: at least one 4★ or 5★.
  await expect(
    page.locator('.summon-card[data-rarity="4"], .summon-card[data-rarity="5"]').first(),
  ).toBeVisible();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: testInfo.outputPath('results.png') });
  const recruited = await page.locator('.summon-card .summon-new').count();
  await page.getByRole('button', { name: 'Done' }).tap();
  await expect(page.locator('.summon-reveal')).toHaveCount(0);
  await expect(page.locator('.summon-screen .gem-balance')).toHaveText('0');
  await expect(page.locator('.pity-text')).not.toContainText('within 80 ');

  // Out of Gems: the buttons explain instead of opening the confirm sheet.
  await page.locator('.summon-button[data-kind="single"]').tap({ force: true });
  await expect(page.locator('.menu-toast')).toContainText('Not enough Gems');
  await expect(page.locator('.summon-confirm')).toBeHidden();

  // Saved: survives a reload.
  await page.reload();
  await page.getByRole('button', { name: 'Tap to start' }).tap();
  await expect(page.locator('.home-gems')).toHaveText('0');
  await page.locator('.home-tile[data-tile="sovereigns"]').tap();
  await expect(page.locator('.sovereign-card:not(.is-locked)')).toHaveCount(6 + recruited);
  expect(errors).toEqual([]);
});

test('Skip jumps straight to the results', async ({ page }) => {
  await bootToSummon(page, '?debug=1');
  await page.locator('.debug-gems').tap();
  await expect(page.locator('.summon-screen .gem-balance')).toHaveText('1,500');
  await page.locator('.summon-button[data-kind="single"]').tap();
  await page.locator('.summon-confirm-go').tap();
  await page.getByRole('button', { name: 'Skip' }).tap();
  await expect(page.locator('.summon-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Done' }).tap();
  await expect(page.locator('.summon-screen .gem-balance')).toHaveText('1,450');
  await expect(page.locator('.pity-text')).toContainText(/within 7[89]|within 80/);
});
