// Run against game-layout-harness.jsx. Uses local mock game records only.
const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MATCH_INTRO_URL || 'http://127.0.0.1:9580';
const output = 'work/match-intro';

(async () => {
  mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const errors = [];
  const start = async (page, area) => {
    await page.goto(`${base}/student/play/live/fixture?area=${area}`);
    if (area === 'bot') await page.getByRole('button', { name: 'Start vs Pawny', exact: true }).click();
    await page.locator('[data-match-intro]').waitFor();
  };
  try {
    for (const [device, width, height] of [['desktop',1440,900], ['tablet',820,1180], ['tablet-landscape',1180,820], ['phone',390,844]]) {
      for (const area of ['bot','live']) {
        const context = await browser.newContext({ viewport: { width, height }, hasTouch: device !== 'desktop' });
        const page = await context.newPage();
        page.on('pageerror', e => errors.push(e.message));
        await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
        await start(page, area);
        assert.match(await page.locator('[data-match-intro]').getAttribute('aria-label'), /Puzzle Explorer versus/);
        await page.waitForTimeout(450);
        const before = await page.locator('[data-chess-board]').boundingBox();
        const intro = await page.locator('[data-match-intro]').boundingBox();
        assert(intro.x >= before.x - 2 && intro.x + intro.width <= before.x + before.width + 2, 'Intro stays inside board');
        assert(intro.width <= width, 'Intro fits viewport');
        await page.screenshot({ path: `${output}/${device}-${area}.png` });
        await page.locator('[data-match-intro]').waitFor({ state: 'detached', timeout: 3000 });
        assert.deepEqual(await page.locator('[data-chess-board]').boundingBox(), before, 'No board layout shift');
        if (area === 'live') {
          await page.reload();
          await page.locator('[data-chess-board]').waitFor();
          await page.waitForTimeout(250);
          assert.equal(await page.locator('[data-match-intro]').count(), 0, 'Reload does not replay introduction');
        }
        await page.locator('[data-square="e2"]').click();
        await page.locator('[data-square="e4"]').click();
        if (area === 'live') await page.waitForFunction(() => window.audit.moveRequests.length === 1);
        else {
          await page.waitForFunction(() => document.querySelector('[data-square="e4"] [data-piece]'));
          if (device === 'desktop') {
            await page.getByRole('button', { name: /Take Back/ }).click();
            assert.equal(await page.locator('[data-match-intro]').count(), 0, 'Takeback must not replay intro');
            await page.getByRole('button', { name: /New Game/ }).click();
            await page.getByRole('button', { name: 'Start New Game', exact: true }).click();
            await page.getByRole('button', { name: 'Start vs Pawny', exact: true }).click();
            await page.locator('[data-match-intro]').waitFor();
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('[data-match-intro]').count(), 0, 'New game gets its own dismissible intro');
          }
        }
        await context.close();
        console.log(`${device} ${area}: avatars, fit, automatic dismissal, unchanged board and moves passed`);
      }
    }
    for (const area of ['arena', 'correspondence']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await start(page, area);
      // First board tap dismisses and selects the piece; no extra click required.
      await page.locator('[data-square="e2"]').click();
      assert.equal(await page.locator('[data-match-intro]').count(), 0);
      await page.locator('[data-square="e4"]').click();
      await page.waitForFunction(() => window.audit.moveRequests.length === 1);
      await context.close();
      console.log(`${area}: tap through to board passed`);
    }
    for (const state of ['in-progress', 'completed', 'waiting']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`${base}/student/play/live/fixture?area=live&introState=${state}`);
      await page.locator('[data-chess-board]').waitFor();
      await page.waitForTimeout(300);
      assert.equal(await page.locator('[data-match-intro]').count(), 0, `${state} games must not show intro`);
      await context.close();
    }
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error('Storage blocked'); }; Storage.prototype.setItem = () => { throw new Error('Storage blocked'); }; });
    await start(page, 'live');
    assert.equal(await page.locator('[data-match-intro]').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-match-intro]').count(), 0);
    await context.close();
    assert.deepEqual(errors, []);
    console.log('Reduced motion, unavailable storage, and keyboard dismissal passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
