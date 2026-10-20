const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ANNOTATIONS_URL || 'http://127.0.0.1:9474';
const output = 'work/live-annotation-clear';

(async () => {
  mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const square = name => page.locator(`[data-square="${name}"]`);
    const arrows = () => page.locator('[data-chess-board] path[marker-end]').count();
    const circle = () => square('d4').evaluate(el => [el, ...el.querySelectorAll('[style]')].some(node => node.style.backgroundImage.includes('197, 94') || node.style.backgroundImage.includes('#22c55e')));
    async function draw() {
      const a = await square('a3').boundingBox(), b = await square('a6').boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down({ button: 'right' });
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
      await page.mouse.up({ button: 'right' });
    }
    async function annotate() {
      await draw(); await square('d4').click({ button: 'right' });
      assert.equal(await arrows(), 1, 'Right drag creates one arrow without duplicate layers');
      assert(await circle(), 'Right click creates a circle');
    }
    async function cleared(label) {
      await page.waitForTimeout(100);
      assert.equal(await arrows(), 0, `${label}: arrows cleared`);
      assert.equal(await circle(), false, `${label}: circles cleared`);
    }
    for (const [width, height, zen] of [[1440, 900, false], [1440, 900, true], [390, 844, false], [390, 844, true]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`${base}/student/play/live/fixture?area=live`);
      await square('e2').waitFor();
      if (zen) await page.getByRole('button', { name: /^Zen mode\b/ }).click();
      const board = await page.locator('[data-chess-board]').elementHandle();
      await annotate(); await square('h4').click(); await cleared('Empty square click');
      await annotate(); await square('h4').tap(); await cleared('Empty square tap');
      await annotate(); await square('e2').click(); await cleared('Piece selection');
      await square('e4').click();
      await page.waitForFunction(() => window.audit.moveRequests.length === 1);
      await annotate(); await square('h4').click(); await cleared('Opponent turn');
      await square('g1').click(); await square('f3').click();
      await page.getByText('Premove: g1 → f3', { exact: true }).waitFor({ state: 'attached' });
      // Right click cancels a premove; the next gesture draws normally.
      await square('d4').click({ button: 'right' });
      assert.equal(await page.getByText('Premove: g1 → f3', { exact: true }).count(), 0);
      await annotate(); await square('h4').tap(); await cleared('Tap after premove cancellation');
      await draw(); await draw(); await cleared('Repeat arrow');
      await square('d4').click({ button: 'right' }); await square('d4').click({ button: 'right' }); await cleared('Repeat circle');
      assert.equal(await page.evaluate(() => window.audit.moveRequests.length), 1, 'Drawing and clearing do not submit moves');
      assert(await board.evaluate(el => el === document.querySelector('[data-chess-board]')), 'Clearing must not remount the board');
      await page.screenshot({ path: `${output}/${width}-${zen ? 'zen' : 'normal'}.png` });
    }
    await page.goto(`${base}/student/play/live/fixture?area=live`);
    await square('e2').waitFor();
    await page.locator('summary').filter({ hasText: 'Board drawings' }).click();
    await page.getByRole('button', { name: 'Arrow', exact: true }).tap();
    await square('a3').tap(); await square('a6').tap();
    await square('b3').tap(); await square('b6').tap();
    assert.equal(await arrows(), 2, 'Explicit drawing mode keeps earlier arrows');
    await page.getByRole('button', { name: 'Move', exact: true }).tap();
    await square('h4').tap(); await cleared('Return from drawing mode');
    assert.deepEqual(errors, []);
    console.log('PASS: live and Zen annotation clearing by click/tap, piece selection, opponent turn, repeated shapes, premove cancellation; no extra moves or board remounts.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
