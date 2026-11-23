const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.BRILLIANT_URL || 'http://127.0.0.1:9606');
    await page.getByRole('button', { name: 'Find my key moments', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel analysis', exact: true }).click();
    await page.getByRole('button', { name: 'Find my key moments', exact: true }).waitFor();
    assert.equal(await page.getByText(/brilliant move found!/).count(), 0);
    await page.getByRole('button', { name: 'Find my key moments', exact: true }).click();
    await page.getByText('!! 1 brilliant move found!', { exact: true }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: '1. Qg8+ !!', exact: true }).click();
    await page.getByText('!! Brilliant — Qg8+', { exact: true }).waitFor();
    assert.match(await page.locator('body').innerText(), /offers the queen on g8/);
    assert(await page.locator('[data-square="g8"] [data-piece="wQ"]').count());
    await page.getByRole('button', { name: 'Next move', exact: true }).click();
    assert.equal(await page.getByText('!! Brilliant — Qg8+', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Previous move', exact: true }).click();
    await page.getByText('!! Brilliant — Qg8+', { exact: true }).waitFor();
    fs.mkdirSync('work/brilliant', { recursive: true });
    for (const [name, width, height] of [['desktop',1440,1000],['tablet',820,1180],['phone',390,844]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(150);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const board = await page.locator('[data-square="g8"]').first().boundingBox();
      const notice = await page.getByText('!! Brilliant — Qg8+', { exact: true }).boundingBox();
      assert(board && notice);
      assert(notice.x >= board.x + board.width || notice.y >= board.y + board.height || notice.x + notice.width <= board.x);
      await page.screenshot({ path: `work/brilliant/${name}.png`, fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log('Brilliant review passed: real engine, cancel/retry, sacrifice notification, correct board navigation, desktop/tablet/phone fit.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
