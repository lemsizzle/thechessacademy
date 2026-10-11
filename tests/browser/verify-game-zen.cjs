// Real game components and shell, using the local network/engine fixture.
// GAMEPLAY_FIXTURE=tests/browser/game-layout-harness.jsx GAMEPLAY_NAVIGATION=1
// GAMEPLAY_MOCK_ENGINE=1 GAMEPLAY_PORT=9466 node scripts/serve-gameplay-harness.mjs
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GAME_ZEN_URL || 'http://127.0.0.1:9466';
const output = process.env.GAME_ZEN_SCREENSHOTS || 'work/game-zen';

(async () => {
  mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const page = await browser.newPage();
  const errors = [], results = [];
  let visit = 0;
  page.on('pageerror', error => errors.push(error.message));
  const entry = () => page.getByRole('button', { name: /^Zen mode\b/i });
  const exit = () => page.getByRole('button', { name: /^Exit Zen\b/i });
  const isZen = () => exit().isVisible();
  const move = async (from, to) => { await page.locator(`[data-square="${from}"]`).click(); await page.locator(`[data-square="${to}"]`).click(); };
  const pieces = () => page.locator('[data-square]').evaluateAll(squares => squares.map(square => `${square.dataset.square}:${square.querySelector('[data-piece]')?.getAttribute('data-piece') || ''}`).sort());
  const start = async (area = 'live') => {
    const path = area === 'spectator' ? '/admin/live-games/fixture' : `/student/play${area === 'bot' ? '' : '/live/fixture'}`;
    await page.goto(`${base}${path}?visit=${++visit}&area=${area}${area === 'bot' ? '#computer-game' : ''}`);
    if (area === 'bot') {
      await page.getByRole('button', { name: '3 + 2', exact: true }).click();
      await page.getByRole('button', { name: 'Start vs Pawny', exact: true }).click();
    }
    await page.locator('[data-chess-board]').waitFor();
    await page.waitForTimeout(200);
    await page.evaluate(() => scrollTo(0, 0));
  };
  async function enterZen() { await entry().click(); await exit().waitFor(); await page.waitForTimeout(200); }
  async function exitZen() { await exit().click(); await exit().waitFor({ state: 'hidden' }); await page.waitForTimeout(100); }
  async function assertSameBoard(handle, expectedPieces) {
    assert(await handle.evaluate(board => board.isConnected && board === document.querySelector('[data-chess-board]')), 'Zen must keep the same board DOM node mounted');
    if (expectedPieces) assert.deepEqual(await pieces(), expectedPieces, 'Zen changed the current position');
  }
  async function measure(name) {
    const geometry = await page.evaluate(async () => {
      const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
      const board = document.querySelector('[data-chess-board]');
      const workspace = document.querySelector('.game-workspace');
      const exitButton = workspace.querySelector('.game-zen-exit button');
      const visible = node => { const style = getComputedStyle(node), r = node.getBoundingClientRect(); return style.display !== 'none' && style.visibility !== 'hidden' && r.width > 1.5 && r.height > 1.5; };
      const clocks = [...workspace.querySelectorAll('.game-player-compact [aria-label*=" clock "]')].filter(visible);
      const panels = ['.game-opponent', '.game-player'].map(selector => workspace.querySelector(selector));
      const samples = [];
      for (let i = 0; i < 60; i++) { await new Promise(requestAnimationFrame); const r = rect(board); samples.push([r.x, r.y, r.width, r.height]); }
      const shell = [...document.querySelectorAll('header.sticky,[data-sidebar],nav[aria-label="Primary student navigation"]')].map(node => ({ visible: visible(node), inert: Boolean(node.closest('[inert]')), name: node.getAttribute('aria-label') || node.tagName }));
      const buttons = [...workspace.querySelectorAll('button')].filter(node => visible(node) && !/^[a-h][1-8],/.test(node.getAttribute('aria-label') || '')).map(node => ({ name: node.getAttribute('aria-label') || node.textContent, ...rect(node), inert: Boolean(node.closest('[inert]')) }));
      return {
        viewport: { width: innerWidth, height: innerHeight }, board: rect(board), workspace: rect(workspace), exit: rect(exitButton),
        clocks: clocks.map(node => ({ ...rect(node), label: node.getAttribute('aria-label'), overflow: node.scrollWidth - node.clientWidth })),
        panels: panels.map(rect), shell, buttons,
        controlsVisible: visible(workspace.querySelector('.game-sidebar')),
        overflow: document.documentElement.scrollWidth - innerWidth,
        spread: [0, 1, 2, 3].map(axis => Math.max(...samples.map(s => s[axis])) - Math.min(...samples.map(s => s[axis])))
      };
    });
    const overlap = (a, b) => Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
    const inside = r => r.x >= -1 && r.y >= -1 && r.right <= geometry.viewport.width + 1 && r.bottom <= geometry.viewport.height + 1;
    assert(Math.abs(geometry.board.width - geometry.board.height) < 1, `${name}: board must remain square`);
    assert(inside(geometry.board), `${name}: board clipped`);
    assert(inside(geometry.exit), `${name}: exit clipped`);
    assert(geometry.exit.width >= 40 && geometry.exit.height >= 36, `${name}: exit needs an accessible touch target`);
    assert(!overlap(geometry.exit, geometry.board), `${name}: Exit Zen covers board`);
    assert(geometry.workspace.width >= geometry.viewport.width - 2 && geometry.workspace.height >= geometry.viewport.height - 2, `${name}: Zen should use the full viewport`);
    assert.equal(geometry.clocks.length, 2, `${name}: exactly two clocks`);
    for (const clock of geometry.clocks) { assert(inside(clock), `${name}: clock clipped`); assert(!overlap(clock, geometry.board), `${name}: clock covers board`); assert(clock.overflow <= 1, `${name}: clock digits overflow`); }
    assert(!overlap(...geometry.clocks), `${name}: clocks overlap`);
    assert(!geometry.controlsVisible, `${name}: game controls should be hidden in Zen`);
    assert(geometry.buttons.every(button => /Exit Zen/i.test(button.name)), `${name}: only the Exit Zen control should remain visible: ${JSON.stringify(geometry.buttons)}`);
    for (const item of geometry.shell) assert(!item.visible || item.inert, `${name}: shell remains interactive: ${item.name}`);
    assert(geometry.overflow <= 1, `${name}: horizontal overflow`);
    assert(Math.max(...geometry.spread) < 1.1, `${name}: board is unstable`);
    const besideBoard = geometry.clocks[0].x >= geometry.board.right;
    const usable = besideBoard ? Math.min(geometry.viewport.width - 180, geometry.viewport.height - 24) : Math.min(geometry.viewport.width - 24, geometry.viewport.height - 188);
    assert(geometry.board.width >= usable - 1, `${name}: Zen wastes available board space (${geometry.board.width} < ${usable})`);
    await page.screenshot({ path: `${output}/${name}.png` });
    results.push({ name, ...geometry }); console.log(name, JSON.stringify(geometry));
  }
  try {
    const viewports = [
      ['desktop', 1920, 1080], ['laptop', 1440, 900], ['tablet-landscape', 1024, 768], ['tablet-portrait', 768, 1024],
      ['phone', 390, 844], ['small-phone', 320, 568], ['phone-landscape', 844, 390], ['small-landscape', 568, 320], ['split-screen', 960, 1080]
    ].filter(([name]) => !process.env.GAME_ZEN_VIEWPORTS || process.env.GAME_ZEN_VIEWPORTS.split(',').includes(name));
    if (!process.env.GAME_ZEN_INTERACTIONS_ONLY) for (const area of (process.env.GAME_ZEN_AREAS || 'bot,live').split(',')) {
      await page.setViewportSize({ width: 1024, height: 768 }); await start(area);
      const board = await page.locator('[data-chess-board]').elementHandle(), position = await pieces();
      await enterZen();
      for (const [name, width, height] of viewports) { await page.setViewportSize({ width, height }); await page.waitForTimeout(150); await assertSameBoard(board, position); await measure(`${area}-${name}`); }
      await exitZen(); await assertSameBoard(board, position);
      assert(await page.locator('.game-sidebar').isVisible(), 'Exit restores controls');
    }
    if (!process.env.GAME_ZEN_GEOMETRY_ONLY) {
      await page.setViewportSize({ width: 1024, height: 768 }); await start('bot');
      const botBoard = await page.locator('[data-chess-board]').elementHandle();
      await page.getByRole('button', { name: 'Board settings', exact: true }).click();
      const settings = page.getByRole('dialog', { name: 'Board settings', exact: true });
      await settings.waitFor(); await page.keyboard.press('z'); assert(!await isZen(), 'Z inside settings dialog must not enter Zen');
      const sound = settings.getByRole('button', { name: /Sounds (on|muted)/ });
      await sound.click(); const soundSetting = await sound.getAttribute('aria-pressed');
      await page.getByRole('button', { name: 'Close board settings' }).click();
      await page.getByRole('button', { name: /Flip Board/ }).click();
      await page.locator('summary').filter({ hasText: 'Board drawings' }).click();
      await page.getByRole('button', { name: 'Arrow', exact: true }).click();
      await page.locator('[data-square="d4"]').click();
      await page.keyboard.press('z'); await exit().waitFor();
      assert.equal(await page.getByRole('button', { name: 'Arrow', exact: true, includeHidden: true }).getAttribute('aria-pressed'), 'false', 'Entering Zen releases a partial arrow drawing');
      assert((await page.locator('[data-square="a1"]').boundingBox()).x > (await page.locator('[data-square="h1"]').boundingBox()).x, 'Zen preserves board orientation');
      const humanClock = page.locator('.game-player-compact [aria-label^="Puzzle Explorer clock "]');
      const beforeClock = await humanClock.getAttribute('aria-label');
      await page.waitForTimeout(1200);
      assert.notEqual(await humanClock.getAttribute('aria-label'), beforeClock, 'Timed bot clock continues in Zen');
      await move('e2', 'e4'); await page.locator('[data-square="c6"] [data-piece]').waitFor();
      await assertSameBoard(botBoard);
      await page.keyboard.press('Escape'); await exit().waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Board settings', exact: true }).click();
      assert.equal(await sound.getAttribute('aria-pressed'), soundSetting, 'Exit restores sound setting');
      await page.getByRole('button', { name: 'Close board settings' }).click();
      assert((await page.locator('[data-square="a1"]').boundingBox()).x > (await page.locator('[data-square="h1"]').boundingBox()).x, 'Exit preserves board orientation');
      await page.keyboard.press('z'); await exit().waitFor();
      await page.keyboard.press('z'); await exit().waitFor({ state: 'hidden' });
      for (const key of ['Control+z', 'Alt+z', 'Meta+z']) { await page.keyboard.press(key); assert(!await isZen(), `${key} must not toggle Zen`); }
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', repeat: true, bubbles: true })));
      assert(!await isZen(), 'Repeated Z must not toggle Zen');
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', isComposing: true, bubbles: true })));
      assert(!await isZen(), 'Composition input must not toggle Zen');
      await page.getByRole('button', { name: /Take Back/ }).click(); await page.locator('[data-square="e2"] [data-piece]').waitFor();

      await start('arena');
      const textbox = page.getByRole('textbox', { name: 'Tournament message' });
      await textbox.fill('Zen should ignore typing '); await page.keyboard.press('z');
      assert(!await isZen(), 'Typing z into tournament chat must not enter Zen');
      assert((await textbox.inputValue()).endsWith('z'));
      await page.locator('summary').filter({ hasText: 'Board drawings' }).click();
      await page.getByRole('button', { name: 'Circle', exact: true }).click();
      await page.locator('[data-square="d4"]').click();
      await page.getByRole('button', { name: /^a3, empty/ }).focus();
      await page.locator('.game-sidebar').evaluate(sidebar => { sidebar.scrollTop = sidebar.scrollHeight; });
      assert(await page.locator('.game-sidebar').evaluate(sidebar => sidebar.scrollTop > 0), 'Fixture should begin with scrolled controls');
      await page.keyboard.press('z'); await exit().waitFor();
      assert.equal(await page.getByRole('button', { name: 'Circle', exact: true, includeHidden: true }).getAttribute('aria-pressed'), 'false', 'Entering Zen releases circle drawing mode');
      const liveBoard = await page.locator('[data-chess-board]').elementHandle();
      await move('e2', 'e4'); await page.waitForFunction(() => window.audit.moveRequests.length === 1);
      await move('g1', 'f3'); assert.equal(await page.getByText('Premove: g1 → f3', { exact: true }).count(), 1);
      await page.locator('[data-square="a3"]').click({ button: 'right' });
      assert.equal(await page.getByText('Premove: g1 → f3', { exact: true }).count(), 0, 'Right click cancels premove in Zen');
      await move('g1', 'f3'); await page.evaluate(() => window.audit.opponentMove());
      await page.waitForFunction(() => window.audit.moveRequests.length === 2);
      await page.locator('[data-square="f3"] [data-piece]').waitFor(); await assertSameBoard(liveBoard);
      await page.evaluate(() => window.audit.setPosition('7k/P7/8/8/8/8/8/7K w - - 0 1'));
      await page.locator('[data-square="a7"] [data-piece]').waitFor();
      await move('a7', 'a8'); await page.getByRole('dialog', { name: 'Choose a promotion' }).waitFor();
      await page.keyboard.press('z'); assert(await isZen(), 'Z inside promotion dialog must not exit Zen');
      await page.keyboard.press('Escape'); await page.getByRole('dialog', { name: 'Choose a promotion' }).waitFor({ state: 'hidden' });
      assert(await isZen(), 'Escape dismisses promotion without leaving Zen');
      await move('a7', 'a8'); await page.getByRole('dialog', { name: 'Choose a promotion' }).waitFor();
      await page.screenshot({ path: `${output}/promotion-in-zen.png` });
      await page.getByRole('button', { name: 'Promote to Knight' }).click();
      await page.waitForFunction(() => window.audit.moveRequests.at(-1)?.promotion === 'n');
      await page.locator('[data-square="a8"] [data-piece]').waitFor(); await assertSameBoard(liveBoard);
      await page.evaluate(() => window.audit.finishGame());
      await exit().waitFor({ state: 'hidden' }); await page.locator('#game-result-title').waitFor();
      await assertSameBoard(liveBoard);
      await page.waitForFunction(() => document.querySelector('.game-sidebar').scrollTop < 1);
      assert(await page.locator('#game-result-title').evaluate(title => { const r = title.getBoundingClientRect(), sidebar = title.closest('.game-sidebar').getBoundingClientRect(); return r.y >= sidebar.y - 1 && r.bottom <= sidebar.bottom + 1; }), 'Automatic exit reveals result after restoring scrolled controls');
      assert(await page.getByRole('link', { name: 'Analyze game', exact: true }).isVisible());
      await page.screenshot({ path: `${output}/completed-restored.png` });
      const finalPosition = await pieces();
      await enterZen(); await assertSameBoard(liveBoard, finalPosition); await exitZen();

      const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
      touch.on('pageerror', error => errors.push(error.message));
      await touch.goto(`${base}/student/play/live/fixture?area=live&visit=touch`);
      await touch.getByRole('button', { name: /^Zen mode\b/i }).tap();
      await touch.getByRole('button', { name: /^Exit Zen\b/i }).waitFor();
      await touch.locator('[data-square="e2"]').tap(); await touch.locator('[data-square="e4"]').tap();
      await touch.waitForFunction(() => window.audit.moveRequests.length === 1);
      await touch.locator('[data-square="g1"]').tap(); await touch.locator('[data-square="f3"]').tap();
      assert.equal(await touch.getByText('Premove: g1 → f3', { exact: true }).count(), 1);
      await touch.locator('[data-square="a3"]').tap();
      assert.equal(await touch.getByText('Premove: g1 → f3', { exact: true }).count(), 0, 'Touch cancels premove in Zen');
      await touch.getByRole('button', { name: /^Exit Zen\b/i }).tap();
      assert(await touch.locator('[data-square="e4"] [data-piece]').isVisible());
      await touch.close();

      await start('live');
      const attentionBoard = await page.locator('[data-chess-board]').elementHandle();
      await enterZen(); await page.evaluate(() => window.audit.offerDraw());
      await exit().waitFor({ state: 'hidden' });
      await page.getByText('Your opponent offered a draw.', { exact: true }).waitFor();
      assert(await page.getByRole('button', { name: 'Accept', exact: true }).evaluate(button => { const r = button.getBoundingClientRect(), sidebar = button.closest('.game-sidebar').getBoundingClientRect(); return r.y >= sidebar.y && r.bottom <= sidebar.bottom; }), 'Draw response controls should be revealed after Zen exits');
      await assertSameBoard(attentionBoard);
      await page.getByRole('button', { name: 'Decline', exact: true }).click();
      await page.getByText('Your opponent offered a draw.', { exact: true }).waitFor({ state: 'hidden' });
      await enterZen(); await page.evaluate(() => window.audit.failNextMove());
      await move('e2', 'e4');
      await exit().waitFor({ state: 'hidden' });
      // The existing snapshot refresh clears a transient move error immediately.
      // Zen must still exit and restore the authoritative position after rejection.
      assert.equal(await page.evaluate(() => window.audit.moveRequests.length), 0);
      assert(await page.evaluate(() => window.audit.requests.some(request => request.path.endsWith('/move'))));
      await page.locator('[data-square="e2"] [data-piece]').waitFor();
      await assertSameBoard(attentionBoard);
      assert(await page.getByRole('button', { name: 'Zen mode', exact: true }).isVisible(), 'Zen can be entered again after an actionable error');
      await page.screenshot({ path: `${output}/attention-restored.png` });
    }
    assert.deepEqual(errors, []);
    writeFileSync(`${output}/geometry.json`, JSON.stringify(results, null, 2));
    console.log(`Zen verification passed (${results.length} responsive snapshots${process.env.GAME_ZEN_GEOMETRY_ONLY ? '' : ', keyboard guards, settings, moves, premoves, promotion and result exit'}).`);
  } catch (error) {
    writeFileSync(`${output}/geometry.json`, JSON.stringify(results, null, 2));
    await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
    writeFileSync(`${output}/failure.json`, JSON.stringify(await page.evaluate(() => ({ text: document.body.innerText, audit: window.audit })), null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
