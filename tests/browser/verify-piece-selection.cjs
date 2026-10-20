const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SELECTION_URL || 'http://127.0.0.1:9474';

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/student/play/live/fixture?area=live`);
    await page.locator('[data-square="e2"]').waitFor();
    const board = await page.locator('[data-chess-board]').elementHandle();
    const center = async square => { const r = await page.locator(`[data-square="${square}"]`).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
    const assertOpaque = async label => {
      const faded = await page.locator('[data-square] [data-piece]').evaluateAll(pieces => pieces.filter(piece => Number(getComputedStyle(piece).opacity) < 1).map(piece => ({ id: piece.id, opacity: getComputedStyle(piece).opacity })));
      assert.deepEqual(faded, [], label);
    };
    for (const jitter of [0, 1, 3, 4, 5, 8]) {
      for (let repeat = 0; repeat < 3; repeat++) {
        await page.locator('[data-square="d4"]').click({ button: 'right' });
        await page.locator('[data-square="e2"]').click();
        const p = await center('g1');
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
        if (jitter) await page.mouse.move(p.x + jitter, p.y);
        if (jitter > 4) {
          await page.waitForTimeout(50);
          await assertOpaque(`Switching pieces with ${jitter}px incidental drag must not fade the piece`);
        }
        await page.mouse.up();
        await page.waitForTimeout(150);
        await assertOpaque(`Selection after ${jitter}px mouse movement (${repeat})`);
      }
    }
    for (let repeat = 0; repeat < 10; repeat++) {
      await page.locator('[data-square="e2"]').tap();
      await page.locator('[data-square="g1"]').tap();
      await page.waitForTimeout(100);
      await assertOpaque(`Touch selection ${repeat}`);
    }
    assert.equal(await page.evaluate(() => window.audit.moveRequests.length), 0);
    // Deliberate dragging still moves exactly once, and cancellation leaves
    // the source piece available for normal click-to-move/premoves.
    const from = await center('e2'), to = await center('e4');
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(() => window.audit.moveRequests.length === 1);
    await page.locator('[data-square="e4"] [data-piece]').waitFor();
    await assertOpaque('After a legal drag');
    const knight = await center('g1'), target = await center('f3');
    await page.mouse.move(knight.x, knight.y); await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.keyboard.press('Escape'); await page.mouse.up();
    await assertOpaque('After canceling a drag');
    assert.equal(await page.getByText('Premove: g1 → f3', { exact: true }).count(), 0);
    await page.locator('[data-square="g1"]').click(); await page.locator('[data-square="f3"]').click();
    await page.getByText('Premove: g1 → f3', { exact: true }).waitFor({ state: 'attached' });
    await page.locator('[data-square="a3"]').click({ button: 'right' });
    assert.equal(await page.getByText('Premove: g1 → f3', { exact: true }).count(), 0);
    await assertOpaque('After canceling a premove');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-square="g1"]').tap(); await page.locator('[data-square="b1"]').tap();
    await assertOpaque('Mobile selection');
    assert.equal(await page.evaluate(() => window.audit.moveRequests.length), 1);
    assert(await board.evaluate(el => el === document.querySelector('[data-chess-board]')), 'Selection must not remount the board');
    assert.deepEqual(errors, []);
    console.log('PASS: switching selected pieces with mouse/touch and small pointer movements stays opaque; legal drags, canceled drags, premoves, mobile selection and stable board mounting.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
