const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:9472/admin/live-games';
const output = 'work/teacher-multiboard';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.locator('[data-live-preview]').nth(2).waitFor();
    assert.equal(await page.locator('[data-live-preview]').count(), 3);
    assert.equal(await page.getByRole('link', { name: 'Watch Game', exact: true }).count(), 5);
    const order = () => page.locator('[data-live-preview]').evaluateAll(cards => cards.map(card => card.dataset.livePreview));
    const initial = await order();
    const id = n => `${n === 2 ? 'computer-' : ''}00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const choose = async (slot, game) => {
      await page.getByRole('combobox', { name: `Choose game for board ${slot}`, exact: true }).selectOption(id(game));
      await page.locator(`[data-live-preview="${id(game)}"] [data-chess-board]`).waitFor();
    };
    assert.equal(await page.getByRole('combobox').count(), 3);
    await choose(1, 4);
    await choose(3, 5);
    assert.deepEqual(await order(), [id(4), id(2), id(5)]);
    await choose(1, 2);
    assert.deepEqual(await order(), [id(2), id(4), id(5)], 'Choosing an already watched game swaps its board');
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('button', { name: 'Refresh', exact: true }).waitFor();
    assert.deepEqual(await order(), [id(2), id(4), id(5)], 'Refresh preserves manual choices');
    // Change selection twice during a pending response. The old response must
    // not restore its original selection; the queued request loads the latest.
    await page.evaluate(() => window.__multiBoardQA.hold());
    await page.getByRole('combobox', { name: 'Choose game for board 1', exact: true }).selectOption(id(1));
    await page.getByRole('combobox', { name: 'Choose game for board 1', exact: true }).selectOption(id(3));
    await page.evaluate(() => window.__multiBoardQA.release());
    await page.locator(`[data-live-preview="${id(3)}"] [data-chess-board]`).waitFor();
    assert.deepEqual(await order(), [id(3), id(4), id(5)], 'Latest selection wins during an in-flight refresh');
    await choose(1, 1);
    await choose(2, 2);
    await choose(3, 3);
    await page.getByRole('button', { name: 'Refresh', exact: true }).waitFor();
    const clock = page.getByLabel(/^Alex clock /);
    const firstClock = await clock.textContent();
    await page.waitForTimeout(1100);
    assert.notEqual(await clock.textContent(), firstClock, 'Active clocks count down locally');
    const count = () => page.evaluate(() => window.__multiBoardQA.calls.filter(call => call.url === '/api/admin/live-games').length);
    await page.waitForTimeout(400);
    const initialCalls = await count();
    await page.evaluate(() => { window.__multiBoardQA.move(1, 'e4'); window.__multiBoardQA.broadcast(); window.__multiBoardQA.broadcast(); });
    await page.waitForFunction(() => document.querySelector('[data-live-preview] [data-board-square="e4"]').getAttribute('aria-label').includes('white pawn'));
    assert.equal(await count(), initialCalls + 1, 'Burst notifications share one list request');
    assert.deepEqual(await order(), initial);
    await page.evaluate(() => window.__multiBoardQA.move(2, 'e5'));
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-live-preview]')[1].querySelector('[data-board-square="e5"]').getAttribute('aria-label').includes('black pawn'));
    assert.deepEqual(await order(), initial, 'Computer moves must not reorder the watched boards');

    // A move arriving while a snapshot is in flight must get one follow-up.
    await page.evaluate(() => { window.__multiBoardQA.hold(); window.__multiBoardQA.broadcast(); });
    await page.waitForTimeout(250);
    const during = await count();
    await page.evaluate(() => { window.__multiBoardQA.move(1, 'e5'); window.__multiBoardQA.broadcast(); });
    await page.waitForTimeout(250);
    assert.equal(await count(), during);
    await page.evaluate(() => window.__multiBoardQA.release());
    await page.waitForFunction(() => document.querySelector('[data-live-preview] [data-board-square="e5"]').getAttribute('aria-label').includes('black pawn'));
    assert.equal(await count(), during + 1);
    await page.evaluate(() => window.__multiBoardQA.finish(1));
    await page.waitForFunction(() => document.querySelector('[data-live-preview]').dataset.livePreview.endsWith('000000000004'));
    assert.deepEqual((await order()).slice(1), initial.slice(1), 'Completed board replaced in its slot');

    for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet-landscape', 1180, 820], ['tablet-portrait', 820, 1180], ['phone', 390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(250);
      const boxes = await page.locator('[data-live-preview] [data-chess-board]').evaluateAll(boards => boards.map(board => { const r = board.getBoundingClientRect(); return { width: r.width, height: r.height, left: r.left, right: r.right }; }));
      assert.equal(boxes.length, 3);
      for (const box of boxes) { assert(Math.abs(box.width - box.height) < 2); assert(box.width >= 215); assert(box.left >= 0 && box.right <= width); }
      assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `${name} must not overflow`);
      await choose(1, 5);
      await choose(1, 4);
      await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
    }
    const beforeHidden = await count();
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); window.__multiBoardQA.broadcast(); });
    await page.waitForTimeout(5200);
    assert.equal(await count(), beforeHidden, 'Hidden tab stops polling and broadcast requests');
    await page.evaluate(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(before => window.__multiBoardQA.calls.filter(call => call.url === '/api/admin/live-games').length > before, beforeHidden);
    await page.evaluate(() => window.__multiBoardQA.fail(true));
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Connection interrupted' }).waitFor();
    assert.equal(await page.locator('[data-live-preview] [data-chess-board]').count(), 3, 'Temporary failures retain visible positions');
    await page.evaluate(() => { window.__multiBoardQA.fail(false); window.__multiBoardQA.empty(); });
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByText('No games in progress', { exact: true }).waitFor();
    assert.equal(await page.locator('[data-live-preview]').count(), 0);
    assert.deepEqual(errors, []);
    // AppShell also runs the existing class-settings backup; scope this check
    // to game traffic so that unrelated shell maintenance is not misclassified.
    assert(await page.evaluate(() => window.__multiBoardQA.calls.filter(call => /live-games|computer-game|chess-games/.test(call.url)).every(call => call.method === 'GET')), 'Watching never sends moves or game writes');
    assert(await page.evaluate(() => window.__multiBoardQA.calls.every(call => !call.url.startsWith('/api/admin/live-games/'))), 'No per-board spectator fetches');
    console.log('PASS: game pickers on desktop/tablet/phone; swaps; latest selection during pending requests; three responsive boards; live/computer moves; stable slots; completion replacement; local clocks; one shared request; queued broadcast; hidden-tab pause; error recovery; empty state; read-only links.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
