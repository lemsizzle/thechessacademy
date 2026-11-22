// Uses real game screens with local, isolated game records.
const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GAME_END_URL || 'http://127.0.0.1:9583';
const output = 'work/game-ending';
(async () => {
  mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const errors = [];
  async function open(viewport, area = 'live', reducedMotion = 'no-preference') {
    const context = await browser.newContext({ viewport, reducedMotion });
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/student/play/live/fixture?area=${area}`);
    if (area === 'bot') await page.getByRole('button', { name: 'Start vs Pawny', exact: true }).click();
    await page.locator('[data-chess-board]').waitFor();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    return { context, page };
  }
  async function finish(page, result) {
    await page.evaluate(result => {
      Object.assign(window.audit.game, { status: 'completed', winnerColor: result === 'draw' ? null : result === 'win' ? 'white' : 'black', resultReason: result === 'draw' ? 'stalemate' : 'checkmate', completedAt: new Date().toISOString(), version: 2 });
      window.dispatchEvent(new Event('focus'));
    }, result);
    await page.locator('[data-game-end-animation]').waitFor();
    await page.waitForTimeout(450);
  }
  try {
    for (const [device, width, height] of [['desktop',1440,900],['tablet',820,1180],['tablet-landscape',1180,820],['phone',390,844],['small-phone',320,568],['phone-landscape',844,390],['small-phone-landscape',568,320]].filter(([name]) => !process.env.QA_DEVICE || process.env.QA_DEVICE.split(',').includes(name))) {
      for (const result of ['win','loss','draw']) {
        const { context, page } = await open({ width, height });
        const before = await page.locator('[data-chess-board]').boundingBox();
        await finish(page, result);
        const card = page.locator('[data-game-end-animation]');
        assert.equal(await card.getAttribute('data-game-end-animation'), result);
        const board = await page.locator('[data-chess-board]').boundingBox();
        const popup = await card.boundingBox();
        assert.equal(board.width, before.width, 'Result must not shrink board');
        assert.equal(board.height, before.height);
        const overlap = Math.min(board.x + board.width, popup.x + popup.width) - Math.max(board.x, popup.x) > 1 && Math.min(board.y + board.height, popup.y + popup.height) - Math.max(board.y, popup.y) > 1;
        assert(!overlap, 'Animation must not cover final board');
        const bottom = await page.evaluate(() => {
          const nav = document.querySelector('nav[aria-label="Primary student navigation"]')?.getBoundingClientRect();
          return nav?.height ? Math.min(innerHeight, nav.top) : innerHeight;
        });
        assert(popup.y >= 65 && popup.y + popup.height <= bottom + 2, 'Ending visible above mobile navigation');
        await page.screenshot({ path: `${output}/${device}-${result}.png` });
        await card.getByRole('heading').click();
        assert.equal(await card.count(), 1, 'Clicking inside does not dismiss');
        if (result === 'win') await page.getByRole('button', { name: 'Dismiss game ending animation' }).click();
        else if (result === 'loss') await page.locator('[data-chess-board]').click({ position: { x: 20, y: board.height - 20 } });
        else await page.keyboard.press('Escape');
        assert.equal(await card.count(), 0);
        assert.equal(await page.locator('#game-result-title').count(), 1, 'Result and review controls remain');
        await context.close();
        console.log(`${device} ${result}: visible, non-overlapping, dismissible, unchanged board passed`);
      }
    }
    const { context, page } = await open({ width: 1440, height: 900 }, 'bot');
    await page.getByRole('button', { name: /Resign/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Resign', exact: true }).click();
    await page.locator('[data-game-end-animation="loss"]').waitFor();
    await page.waitForTimeout(8500);
    assert.equal(await page.locator('[data-game-end-animation]').count(), 1, 'Animation remains beyond eight seconds');
    await page.locator('[data-game-end-animation]').waitFor({ state: 'detached', timeout: 2500 });
    assert.equal(await page.locator('#game-result-title').count(), 1);
    await page.getByRole('button', { name: 'Review Board', exact: true }).click();
    assert.equal(await page.locator('#game-result-title').count(), 0);
    await context.close();
    for (const area of ['arena','correspondence']) {
      const { context, page } = await open({ width: 1440, height: 900 }, area, 'reduce');
      await finish(page, 'win');
      assert.equal(await page.locator('[data-game-end-animation]').evaluate(node => getComputedStyle(node).animationName), 'none');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-game-end-animation]').count(), 0);
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('Bot result, ten-second lifetime, persistent review controls, arena/correspondence and reduced motion passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
