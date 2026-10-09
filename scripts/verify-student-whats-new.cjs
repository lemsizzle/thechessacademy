// Uses the isolated production app from tests/browser/displayed-badge-server.cjs.
// Synthetic student/catalog data only; all external browser requests are blocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BADGE_PREVIEW_URL || 'http://127.0.0.1:3109';
const output = 'work/whats-new';
fs.mkdirSync(output, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const trigger = () => page.getByRole('button', { name: "What's new", exact: true });
  const popup = () => page.getByRole('dialog', { name: "What's new", exact: true });
  const close = () => page.getByRole('button', { name: "Close what's new", exact: true });
  try {
    await page.goto(`${base}/__qa/login`);
    await trigger().waitFor();
    assert.equal(await trigger().count(), 1);
    for (const [name, width, height] of [['desktop',1440,1000], ['tablet-portrait',820,1180], ['tablet-landscape',1180,820], ['phone',390,844], ['small-phone',320,640]]) {
      await page.setViewportSize({ width, height });
      await trigger().click(); await popup().waitFor();
      const entries = await popup().locator('[data-update-date]').evaluateAll(nodes => nodes.map(node => node.dataset.updateDate));
      assert(entries.length > 40);
      assert.deepEqual(entries, [...entries].sort().reverse());
      assert.equal(entries[0], '2026-10-09');
      assert.equal(await popup().locator('img,svg,video,canvas').count(), 0);
      const box = await popup().boundingBox();
      assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height);
      assert(await popup().evaluate(node => node.scrollWidth <= node.clientWidth));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `${output}/${name}.png` });
      await popup().evaluate(node => { node.scrollTop = node.scrollHeight; });
      assert(await close().isVisible());
      await close().click();
      assert.equal(await popup().count(), 0);
      assert(await trigger().evaluate(node => node === document.activeElement));
      assert.notEqual(await page.evaluate(() => document.body.style.overflow), 'hidden');
    }
    await trigger().click(); await popup().waitFor();
    await page.keyboard.press('Tab');
    assert(await close().evaluate(node => node === document.activeElement), 'Native modal must retain keyboard focus');
    await page.keyboard.press('Escape');
    assert.equal(await popup().count(), 0);
    assert(await trigger().evaluate(node => node === document.activeElement));
    await trigger().click(); await popup().waitFor();
    await page.mouse.click(3,3);
    assert.equal(await popup().count(), 0);
    await page.getByRole('button', { name: /Open account menu/ }).click();
    await trigger().click(); await popup().waitFor();
    assert.equal(await page.locator('#student-account-menu').count(), 0);
    await close().click();
    await page.setViewportSize({ width:1180, height:820 });
    await page.goto(`${base}/student/play`);
    await page.getByRole('button', { name: 'Computer Choose a bot and play right away.', exact: true }).click();
    await page.getByRole('button', { name: /^Start vs / }).click();
    const board = page.locator('[data-chess-board]').first();
    await board.waitFor();
    const settleBoard = () => board.evaluate(async node => {
      // Initial game setup collapses the tablet sidebar and fits the board.
      // Compare settled geometry, rather than a frame during that transition.
      let previous = 0, stable = 0;
      for (let frame = 0; frame < 60; frame++) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const width = node.getBoundingClientRect().width;
        stable = Math.abs(width - previous) < 0.5 ? stable + 1 : 0;
        previous = width;
        if (stable >= 5) return;
      }
      throw new Error('Board did not settle');
    });
    await settleBoard();
    const before = await board.boundingBox();
    const gameUrl = page.url();
    await trigger().click(); await popup().waitFor();
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('Escape');
    assert.equal(await popup().count(), 0);
    assert.equal(page.url(), gameUrl);
    await settleBoard();
    const after = await board.boundingBox();
    assert.equal(Math.round(after.width), Math.round(before.width));
    assert.equal(Math.round(after.height), Math.round(before.height));
    await page.screenshot({ path:`${output}/gameplay.png` });
    await page.goto(`${base}/student#trophy-case`);
    await trigger().click(); await popup().waitFor();
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ verified:['text-only newest-first release notes', 'desktop/tablet/phone fit and scrolling', 'Close/Escape/backdrop dismissal', 'focus trap and restoration', 'account menu closes before popup', 'available during gameplay without resetting/resizing the board'], screenshots:output }, null, 2));
  } catch(error) {
    await page.screenshot({ path:`${output}/failure.png`, fullPage:true });
    console.error('Failed at',page.url()); throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
