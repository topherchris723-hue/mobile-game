import { expect, test, type Page } from '@playwright/test';

/** Collects console errors and uncaught exceptions so any of them fails the test. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function start(page: Page, query: string): Promise<void> {
  await page.goto(`./${query}`);
  const button = page.getByRole('button', { name: 'Tap to start' });
  await expect(button).toBeEnabled({ timeout: 15_000 });
  await button.tap();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'battlefield');
}

async function startDebug(page: Page, query = '?debug=1'): Promise<void> {
  await start(page, query);
  await page.waitForFunction(() => (window.__sovereigns?.tick() ?? 0) > 30);
}

const selected = (page: Page) => page.evaluate(() => window.__sovereigns?.selectedUnit() ?? null);

test('boots to the battlefield in portrait without errors', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await startDebug(page);
  await expect(page.locator('.debug-fps')).toContainText('fps');
  await expect(page.locator('.debug-stats')).toContainText('7 units');
  await expect(page.locator('#rotate-prompt')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('battlefield-debug.png') });
  expect(errors).toEqual([]);
});

test('renders for players without debug UI', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await start(page, '');
  await expect(page.locator('.debug-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => window.__sovereigns)).toBeUndefined();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: testInfo.outputPath('battlefield.png') });
  expect(errors).toEqual([]);
});

test('tapping units selects them; tapping empty ground clears', async ({ page }) => {
  await startDebug(page);
  const ids = await page.evaluate(() => window.__sovereigns?.unitIds() ?? []);
  expect(ids.length).toBe(7);

  for (const id of [ids[0], ids[3], ids[5]]) {
    if (id === undefined) throw new Error('missing unit id');
    const point = await page.evaluate((unitId) => window.__sovereigns?.unitScreenPoint(unitId), id);
    if (!point) throw new Error(`no screen point for unit ${id}`);
    await page.touchscreen.tap(point.x, point.y);
    await expect.poll(() => selected(page)).toBe(id);
  }

  // Top of the sky, far from every unit.
  await page.touchscreen.tap(30, 30);
  await expect.poll(() => selected(page)).toBeNull();
});

test('landscape shows the rotate prompt and pauses the game', async ({ page }) => {
  await startDebug(page);
  await page.setViewportSize({ width: 839, height: 412 });
  await expect(page.locator('#rotate-prompt')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-paused', 'true');
  const pausedTick = await page.evaluate(() => window.__sovereigns?.tick() ?? 0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__sovereigns?.tick() ?? 0)).toBe(pausedTick);

  await page.setViewportSize({ width: 412, height: 839 });
  await expect(page.locator('body')).toHaveAttribute('data-paused', 'false');
  await expect(page.locator('#rotate-prompt')).toBeHidden();
});

test('benchmark mode renders extra enemies and motes without errors', async ({
  page,
}, testInfo) => {
  const errors = watchErrors(page);
  await startDebug(page, '?debug=1&bench=1');
  await expect(page.locator('.debug-stats')).toContainText('9 units');
  await page.screenshot({ path: testInfo.outputPath('benchmark.png') });
  expect(errors).toEqual([]);
});
