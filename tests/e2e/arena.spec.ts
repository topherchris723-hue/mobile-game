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

async function startArena(page: Page, query = '?debug=1'): Promise<void> {
  await page.goto(`./${query}`);
  const start = page.getByRole('button', { name: 'Tap to start' });
  await expect(start).toBeEnabled({ timeout: 15_000 });
  await start.click();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'arena');
  await page.waitForFunction(() => (window.__sovereigns?.tick() ?? 0) > 30);
}

const playerLane = (page: Page) => page.evaluate(() => window.__sovereigns?.playerLane() ?? -1);

test('boots to the arena without errors', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await startArena(page);
  await expect(page.locator('.debug-fps')).toContainText('fps');
  await expect(page.locator('#rotate-prompt')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('arena.png') });
  expect(errors).toEqual([]);
});

test('renders the arena for players without debug UI', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await page.goto('./');
  const start = page.getByRole('button', { name: 'Tap to start' });
  await expect(start).toBeEnabled({ timeout: 15_000 });
  await start.click();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'arena');
  await expect(page.locator('.debug-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => window.__sovereigns)).toBeUndefined();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: testInfo.outputPath('arena-clean.png') });
  expect(errors).toEqual([]);
});

test('swipe up and down on the left half changes lane', async ({ page }) => {
  await startArena(page);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('no viewport');
  const x = viewport.width * 0.2;
  const y = viewport.height * 0.6;
  const swipe = async (dy: number) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + dy, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(250);
  };

  expect(await playerLane(page)).toBe(1);
  await swipe(-60);
  expect(await playerLane(page)).toBe(0);
  await swipe(60);
  await swipe(60);
  expect(await playerLane(page)).toBe(2);
});

test('holding on the left half guards; the right half is ignored', async ({ page }) => {
  await startArena(page);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('no viewport');
  const guarding = () => page.evaluate(() => window.__sovereigns?.playerGuarding() ?? false);

  await page.mouse.move(viewport.width * 0.2, viewport.height * 0.6);
  await page.mouse.down();
  await expect.poll(guarding).toBe(true);
  await page.mouse.up();
  await expect.poll(guarding).toBe(false);

  await page.mouse.move(viewport.width * 0.8, viewport.height * 0.6);
  await page.mouse.down();
  await page.waitForTimeout(400);
  expect(await guarding()).toBe(false);
  await page.mouse.up();
});

test('portrait shows the rotate prompt and pauses the game', async ({ page }) => {
  await startArena(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await expect(page.locator('#rotate-prompt')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-paused', 'true');
  const pausedTick = await page.evaluate(() => window.__sovereigns?.tick() ?? 0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__sovereigns?.tick() ?? 0)).toBe(pausedTick);

  await page.setViewportSize({ width: 863, height: 360 });
  await expect(page.locator('body')).toHaveAttribute('data-paused', 'false');
  await expect(page.locator('#rotate-prompt')).toBeHidden();
});

test('benchmark mode renders six fighters without errors', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await startArena(page, '?debug=1&bench=1');
  await expect(page.locator('.debug-stats')).toContainText('6 fighters');
  await page.screenshot({ path: testInfo.outputPath('benchmark.png') });
  expect(errors).toEqual([]);
});
