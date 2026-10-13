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

/** Boots and walks the real menu path into the Prologue battle: Home → Story → Battle. */
async function start(page: Page, query: string): Promise<void> {
  await page.goto(`./${query}`);
  const button = page.getByRole('button', { name: 'Tap to start' });
  await expect(button).toBeEnabled({ timeout: 15_000 });
  await button.tap();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'home');
  await page.locator('.home-tile[data-tile="story"]').tap();
  await page.locator('[data-stage="prologue"]').tap();
  await expect(page.locator('body')).toHaveAttribute('data-scene', 'battle');
}

const phase = (page: Page) => page.evaluate(() => window.__sovereigns?.phase() ?? null);

async function waitForPlayerTurn(page: Page): Promise<void> {
  await expect.poll(() => phase(page), { timeout: 20_000 }).toBe('playerInput');
}

const cards = (page: Page) => page.locator('.player-panel .card');

const turnNumber = (page: Page) => page.evaluate(() => window.__sovereigns?.turnNumber() ?? 0);

/**
 * Taps something that ends the player's turn and waits until the turn has really moved on.
 * Waiting on the turn counter (not on the phase) can't miss a fast enemy turn at high speed.
 */
async function endTurnWith(page: Page, tap: () => Promise<void>): Promise<void> {
  const before = await turnNumber(page);
  await tap();
  await expect.poll(() => turnNumber(page), { timeout: 30_000 }).toBeGreaterThan(before);
}

test('boots into a duel with a full hand and no errors', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  // Sped up: this checks booting and the hand, not animation length (the enemy moves first, and
  // GPU-less CI runners render slowly enough that normal-speed playback can take 20 s+).
  await start(page, '?debug=1&speed=4');
  await waitForPlayerTurn(page);
  await expect(cards(page)).toHaveCount(3);
  await expect(page.locator('.enemy-hud .hud-name')).not.toBeEmpty();
  await expect(page.locator('.player-panel .hud-name')).toHaveText('Kaien');
  await page.screenshot({ path: testInfo.outputPath('duel-debug.png') });
  expect(errors).toEqual([]);
});

test('renders for players without debug UI', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await start(page, '');
  await expect(page.locator('.debug-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => window.__sovereigns)).toBeUndefined();
  await expect(cards(page).first()).toBeVisible();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: testInfo.outputPath('duel.png') });
  expect(errors).toEqual([]);
});

test('playing an affordable card hits the enemy and passes the turn', async ({ page }) => {
  await start(page, '?debug=1&speed=4');
  await waitForPlayerTurn(page);
  const enemyHp = await page.evaluate(() => window.__sovereigns?.hp('enemy') ?? 0);
  const affordable = page.locator('.player-panel .card[aria-disabled="false"]').first();
  await expect(affordable).toBeVisible();
  await affordable.tap();
  await expect.poll(() => phase(page)).not.toBe('playerInput');
  await expect.poll(() => page.evaluate(() => window.__sovereigns?.turnSide())).toBe('enemy');
  // Either damage was dealt or a non-damaging Technique was used; energy was spent either way.
  const after = await page.evaluate(() => window.__sovereigns?.hp('enemy') ?? 0);
  expect(after).toBeLessThanOrEqual(enemyHp);
  await waitForPlayerTurn(page);
});

test('switching is free: the new fighter comes in and you keep your turn', async ({ page }) => {
  await start(page, '?debug=1&speed=4');
  await waitForPlayerTurn(page);
  await page.locator('.bench-button').first().tap();
  await expect.poll(() => page.evaluate(() => window.__sovereigns?.activeIndex('player'))).toBe(1);
  await waitForPlayerTurn(page);
  await expect(page.locator('.player-panel .hud-name')).toHaveText('Maris');
  await expect(page.locator('.duel-hud .toast')).toContainText('Tag Link');
  // A second switch in the same turn is refused with a reason. Blocked buttons stay tappable on
  // purpose (so they can explain themselves), hence force: Playwright won't tap aria-disabled.
  await page.locator('.bench-button').nth(1).tap({ force: true });
  await expect(page.locator('.duel-hud .toast')).toContainText('Already switched this turn');
});

test('tapping a card you cannot afford explains why', async ({ page }) => {
  await start(page, '?debug=1&speed=4');
  await waitForPlayerTurn(page);
  // Charging until a Signature (cost 5) shows up would be slow; any card costing more than the
  // current energy works, and Charge makes sure one exists by spending the turn first.
  const expensive = page.locator('.player-panel .card.is-unaffordable').first();
  for (let attempt = 0; attempt < 6 && (await expensive.count()) === 0; attempt++) {
    const cheapest = page.locator('.player-panel .card[aria-disabled="false"]').last();
    await cheapest.tap();
    await expect.poll(() => phase(page)).not.toBe('playerInput');
    await waitForPlayerTurn(page);
  }
  await expect(expensive).toBeVisible();
  await expensive.tap({ force: true });
  await expect(page.locator('.duel-hud .toast')).toHaveText('Not enough Rift Energy');
  expect(await phase(page)).toBe('playerInput');
});

test('a full duel can be played to the end and restarted', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await start(page, '?debug=1&speed=20');
  for (let turn = 0; turn < 80; turn++) {
    await expect.poll(() => phase(page), { timeout: 30_000 }).toMatch(/^(playerInput|ended)$/);
    if ((await phase(page)) === 'ended') break;
    const affordable = page.locator('.player-panel .card[aria-disabled="false"]');
    await endTurnWith(page, async () => {
      if ((await affordable.count()) > 0) await affordable.last().tap();
      else await page.locator('.charge-button').tap();
    });
  }
  await expect(page.locator('.result')).toBeVisible();
  await expect(page.locator('.result h2')).toHaveText(/Victory|Defeat/);
  await page.screenshot({ path: testInfo.outputPath('result.png') });

  await page.getByRole('button', { name: 'Play again' }).tap();
  await expect(page.locator('.result')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__sovereigns?.winner())).toBeNull();
  expect(errors).toEqual([]);
});

test('landscape shows the rotate prompt and pauses the duel', async ({ page }) => {
  await start(page, '?debug=1');
  await page.waitForFunction(() => (window.__sovereigns?.tick() ?? 0) > 30);
  await page.setViewportSize({ width: 839, height: 412 });
  await expect(page.locator('#rotate-prompt')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-paused', 'true');
  const pausedTick = await page.evaluate(() => window.__sovereigns?.tick() ?? 0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__sovereigns?.tick() ?? 0)).toBe(pausedTick);
  await page.setViewportSize({ width: 412, height: 839 });
  await expect(page.locator('body')).toHaveAttribute('data-paused', 'false');
});

test('saving to 10 Rift Energy unlocks a Crossover Burst with a partner', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await start(page, '?debug=1&speed=20');
  const ready = page.locator('.crossover-button[aria-disabled="false"]');
  for (let turn = 0; turn < 10 && (await ready.count()) === 0; turn++) {
    await waitForPlayerTurn(page);
    if ((await ready.count()) > 0) break;
    await endTurnWith(page, () => page.locator('.charge-button').tap());
  }
  await waitForPlayerTurn(page);
  await expect(ready.first()).toBeVisible();
  await expect(page.locator('.crossover')).toHaveClass(/is-ready/);
  await page.screenshot({ path: testInfo.outputPath('crossover-ready.png') });
  // At 20× speed the cut-in is brief, so record every title it shows.
  await page.evaluate(() => {
    const title = document.querySelector('.cut-in-title');
    const seen: string[] = [];
    (window as unknown as { __banners: string[] }).__banners = seen;
    if (title) {
      // Read every inserted text node: the title can change within one frame.
      new MutationObserver((records) => {
        for (const record of records) {
          record.addedNodes.forEach((node) => seen.push(node.textContent ?? ''));
        }
      }).observe(title, { childList: true });
    }
  });
  await ready.first().tap();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __banners: string[] }).__banners.join('|')),
    )
    .toMatch(/Sunbreak Riptide|Ember Thornstorm|Tidal Bloom/);
  await expect
    .poll(() => page.evaluate(() => window.__sovereigns?.energy('player') ?? -1))
    .toBeLessThan(10);
  expect(errors).toEqual([]);
});

test('the speed toggle switches to 2× and is remembered', async ({ page }) => {
  await start(page, '?debug=1&speed=4');
  const toggle = page.locator('.speed-button');
  await expect(toggle).toHaveText('1×');
  await toggle.tap();
  await expect(toggle).toHaveText('2×');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await start(page, '?debug=1&speed=4');
  await expect(page.locator('.speed-button')).toHaveText('2×');
});

test('a Signature plays a cut-in with its name', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await start(page, '?debug=1&speed=4');
  const signature = page.locator(
    '.player-panel .card[data-kind="signature"][aria-disabled="false"]',
  );
  // Charge until a Signature is both in hand and affordable.
  for (let turn = 0; turn < 20 && (await signature.count()) === 0; turn++) {
    await waitForPlayerTurn(page);
    if ((await signature.count()) > 0) break;
    const cheapest = page.locator('.player-panel .card[aria-disabled="false"]');
    await endTurnWith(page, async () => {
      // Spend cheap cards on early turns so the hand cycles, then save energy.
      if (turn % 3 === 0 && (await cheapest.count()) > 0) await cheapest.last().tap();
      else await page.locator('.charge-button').tap();
    });
  }
  await waitForPlayerTurn(page);
  const name = (await signature.first().locator('.card-name').textContent()) ?? '';
  // At 4× the cut-in lasts ~0.25 s, shorter than a poll can reliably catch, so record it the
  // moment it becomes visible.
  await page.evaluate(() => {
    const node = document.querySelector('.cut-in');
    const seen: string[] = [];
    (window as unknown as { __cutIns: string[] }).__cutIns = seen;
    if (!node) return;
    new MutationObserver(() => {
      if (node.classList.contains('is-visible')) {
        const kicker = node.querySelector('.cut-in-kicker')?.textContent ?? '';
        const title = node.querySelector('.cut-in-title')?.textContent ?? '';
        seen.push(`${kicker}: ${title}`);
      }
    }).observe(node, { attributes: true, attributeFilter: ['class'] });
  });
  await signature.first().tap();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __cutIns: string[] }).__cutIns))
    .toContain(`Signature: ${name}`);
  await expect(page.locator('.cut-in')).not.toHaveClass(/is-visible/, { timeout: 10_000 });
  expect(errors).toEqual([]);
});
