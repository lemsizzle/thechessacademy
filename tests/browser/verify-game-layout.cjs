// GAMEPLAY_FIXTURE=tests/browser/game-layout-harness.jsx GAMEPLAY_NAVIGATION=1
// GAMEPLAY_MOCK_ENGINE=1 GAMEPLAY_PORT=9461 node scripts/serve-gameplay-harness.mjs
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GAME_LAYOUT_URL || 'http://127.0.0.1:9461';
const output = process.env.GAME_LAYOUT_SCREENSHOTS || 'work/game-layout';

(async () => {
  mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const page = await browser.newPage();
  const errors = [], results = [];
  let visit = 0;
  page.on('pageerror', error => errors.push(error.message));
  const path = area => `${area === 'spectator' ? '/admin/live-games/fixture' : `/student/play${area === 'bot' ? '' : '/live/fixture'}`}?area=${area}${area === 'bot' ? '#computer-game' : ''}`;
  const start = async (area = 'bot') => {
    // A changed query forces a new fixture even when the same anchor is open.
    await page.goto(base + path(area).replace('?', `?visit=${++visit}&`));
    if (area === 'bot') {
      await page.getByRole('button', { name: 'Start vs Pawny', exact: true }).scrollIntoViewIfNeeded();
      await page.getByRole('button', { name: 'Start vs Pawny', exact: true }).click();
    }
    await page.waitForSelector('[data-chess-board]');
    await page.waitForTimeout(150);
    if (area === 'bot') {
      const top = await page.locator('[data-chess-board]').evaluate(node => node.getBoundingClientRect().top);
      const header = await page.locator('header.sticky').evaluate(node => node.getBoundingClientRect().bottom);
      assert(top >= header, `Starting bot should reveal board below header: ${top} < ${header}`);
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(350);
  };
  const move = async (from, to, target = page) => { await target.locator(`[data-square="${from}"]`).click(); await target.locator(`[data-square="${to}"]`).click(); };
  async function measure(name) {
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(350);
    const geometry = await page.evaluate(async () => {
      const board = document.querySelector('[data-chess-board]');
      const rect = board.getBoundingClientRect();
      const nav = document.querySelector('nav[aria-label="Primary student navigation"]');
      const navRect = nav?.getBoundingClientRect();
      const bottom = navRect && navRect.height && navRect.top < innerHeight ? navRect.top : innerHeight;
      const samples = [];
      for (let i = 0; i < 90; i++) {
        await new Promise(requestAnimationFrame);
        const sample = board.getBoundingClientRect();
        samples.push([sample.width, sample.height, sample.x, sample.y]);
      }
      const side = document.querySelector('.game-sidebar, .game-layout-controls, .bot-game-controls, .student-play-area aside')?.getBoundingClientRect();
      const buttons = [...document.querySelectorAll('button')].filter(node => /Flip Board|Take Back|Resign/.test(node.textContent) && node.getBoundingClientRect().width).map(node => { const r = node.getBoundingClientRect(); return { name: node.textContent, x: r.x, y: r.y, width: r.width, height: r.height }; });
      const clocks = [...document.querySelectorAll('.game-player-compact [aria-label*=" clock "]')].map(node => { const r = node.getBoundingClientRect(); return { label: node.getAttribute('aria-label'), top: r.top, bottom: r.bottom, right: r.right, overflow: node.scrollWidth - node.clientWidth }; });
      const connectionPills = [...document.querySelectorAll('.game-sidebar span')].filter(node => /^(connecting|polling|live|synced)$/i.test(node.textContent)).map(node => ({ text: node.textContent, whiteSpace: getComputedStyle(node).whiteSpace, overflow: node.scrollWidth - node.clientWidth }));
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom,
        controls: side ? { x: side.x, y: side.y, width: side.width, right: side.right, bottom: side.bottom } : null, buttons, clocks, connectionPills,
        viewport: { width: innerWidth, height: innerHeight, availableBottom: bottom }, overflow: document.documentElement.scrollWidth - innerWidth,
        spread: [0, 1, 2, 3].map(axis => Math.max(...samples.map(s => s[axis])) - Math.min(...samples.map(s => s[axis]))) };
    });
    assert(Math.abs(geometry.width - geometry.height) < 1, `${name}: board lost square ratio`);
    assert(geometry.overflow <= 1, `${name}: page overflowed ${geometry.overflow}px`);
    assert(geometry.x >= -1 && geometry.right <= geometry.viewport.width + 1, `${name}: board clipped horizontally`);
    assert(geometry.y >= 0 && geometry.bottom <= geometry.viewport.availableBottom + 1, `${name}: board clipped vertically: ${JSON.stringify(geometry)}`);
    assert(Math.max(...geometry.spread) < 1.1, `${name}: board resizes/buzzes while idle: ${geometry.spread}`);
    if (geometry.controls) assert(geometry.controls.x >= geometry.right - 1 || geometry.controls.y >= geometry.bottom - 1, `${name}: controls overlap board`);
    if (geometry.viewport.width < 768 && geometry.viewport.height > geometry.viewport.width) assert(geometry.width >= geometry.viewport.width - 56, `${name}: portrait phone board too small`);
    for (const clock of geometry.clocks) {
      assert(clock.overflow <= 1, `${name}: clock text clipped`);
      assert(clock.top >= 0 && clock.bottom <= geometry.viewport.availableBottom + 1, `${name}: player clock hidden below navigation: ${JSON.stringify(clock)}`);
    }
    for (const pill of geometry.connectionPills) assert(pill.whiteSpace === 'nowrap' && pill.overflow <= 1, `${name}: connection pill wraps or clips: ${JSON.stringify(pill)}`);
    for (const button of geometry.buttons) assert(button.width >= 40 && button.height >= 36, `${name}: game control touch target too small: ${button.name}`);
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: false });
    results.push({ name, ...geometry });
    console.log(name, JSON.stringify(geometry));
  }
  try {
    const viewports = (process.env.GAME_LAYOUT_INTERACTIONS_ONLY ? [] : [
      ['desktop', 1920, 1080], ['laptop', 1440, 900], ['short-laptop', 1280, 720],
      ['tablet-landscape', 1024, 768], ['tablet-portrait', 768, 1024],
      ['phone', 390, 844], ['small-phone', 320, 568], ['phone-landscape', 844, 390],
      ['small-phone-landscape', 667, 375], ['split-screen', 960, 1080]
    ]).filter(([name]) => !process.env.GAME_LAYOUT_VIEWPORTS || process.env.GAME_LAYOUT_VIEWPORTS.split(',').includes(name));
    for (const area of (process.env.GAME_LAYOUT_AREAS || 'bot,live').split(',')) {
      for (const [name, width, height] of viewports) {
        await page.setViewportSize({ width, height }); await start(area); await measure(`${area}-${name}`);
      }
      if (viewports.length && !process.env.GAME_LAYOUT_SKIP_ROTATION) for (const [name, width, height] of [['rotate-landscape', 1024, 768], ['rotate-portrait', 768, 1024], ['rotate-back', 1024, 768]]) {
        await page.setViewportSize({ width, height }); await measure(`${area}-${name}`);
      }
    }
    if (!process.env.GAME_LAYOUT_GEOMETRY_ONLY) {
      await page.setViewportSize({ width: 1024, height: 768 }); await start('bot');
      assert.equal(await page.locator('[data-route-launcher="student-play-launcher"]').isVisible(), false);
      assert.equal(await page.locator('#computer-game-title').isVisible(), false);
      await page.locator('[data-sidebar="student"]').getByRole('link', { name: /Play/ }).first().click();
      await page.getByRole('dialog', { name: 'Choose an opponent' }).waitFor();
      await page.getByRole('button', { name: /Computer Choose a bot/ }).click();
      await page.evaluate(() => scrollTo(0, 0));
      await page.getByRole('button', { name: 'Board settings', exact: true }).filter({ visible: true }).first().click();
      assert(await page.getByRole('dialog', { name: 'Board settings' }).isVisible());
      await page.getByRole('button', { name: 'Close board settings' }).click();
      await page.locator('summary').filter({ hasText: 'Board drawings' }).click();
      await page.getByRole('button', { name: 'Circle', exact: true }).click();
      await page.locator('[data-square="d4"]').click();
      assert(await page.locator('[data-square="d4"]').evaluate(node => [...node.querySelectorAll('*')].some(child => getComputedStyle(child).backgroundImage.includes('radial-gradient'))));
      await page.getByRole('button', { name: 'Clear', exact: true }).click();
      // Closing the drawing tools must restore normal piece movement.
      await page.locator('summary').filter({ hasText: 'Board drawings' }).click();
      await move('e2', 'e4');
      await page.waitForSelector('[data-square="c6"] [data-piece]');
      await page.getByRole('button', { name: /Take Back/ }).click();
      await page.waitForSelector('[data-square="e2"] [data-piece]');
      await page.getByRole('button', { name: /Flip Board/ }).click();
      assert((await page.locator('[data-square="a1"]').boundingBox()).x > (await page.locator('[data-square="h1"]').boundingBox()).x);
      await page.getByRole('button', { name: /Flip Board/ }).click();
      await page.getByRole('button', { name: /Resign/ }).click();
      await page.getByRole('dialog', { name: 'Resign this game?' }).waitFor();
      await page.getByRole('button', { name: 'Keep Playing', exact: true }).click();
      await move('d2', 'd4');
      await page.waitForSelector('[data-square="c6"] [data-piece]');
      await page.getByRole('button', { name: /Resign/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Resign', exact: true }).click();
      await page.getByRole('link', { name: 'Analyze game', exact: true }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Analyze game', exact: true }).getAttribute('href'), '/student/play/game/fixture/analysis');
      assert.equal(await page.evaluate(() => window.audit.savedGames[0].takebackCount), 1);
      await page.getByRole('button', { name: 'Review Board', exact: true }).click();
      assert(await page.getByRole('link', { name: 'Analyze game', exact: true }).isVisible());

      await start('live'); await move('e2', 'e4');
      await page.waitForFunction(() => window.audit.moveRequests.length === 1);
      await move('g1', 'f3'); await page.getByText('Premove: g1 → f3', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(await page.getByText('Premove: g1 → f3', { exact: true }).count(), 0);
      await move('g1', 'f3');
      await page.locator('[data-square="a3"]').click({ button: 'right' });
      assert.equal(await page.getByText('Premove: g1 → f3', { exact: true }).count(), 0);
      await move('g1', 'f3'); await page.evaluate(() => window.audit.opponentMove());
      await page.waitForFunction(() => window.audit.moveRequests.length === 2);
      await page.waitForSelector('[data-square="f3"] [data-piece]');
      const beforeClock = await page.locator('[data-chess-board]').boundingBox();
      await page.evaluate(() => window.audit.setClock(9900));
      await page.waitForTimeout(1200);
      const afterClock = await page.locator('[data-chess-board]').boundingBox();
      assert.deepEqual(afterClock, beforeClock, 'Tenths-of-a-second clock should not resize board');
      const clocksFit = await page.locator('.game-player-compact [aria-label*=" clock "]').evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth));
      assert(clocksFit, 'Short clock digits should fit compact player panels');
      await page.getByRole('button', { name: /Resign/ }).click();
      await page.getByRole('dialog', { name: 'Resign this live game?' }).waitFor();
      await page.getByRole('button', { name: 'Keep Playing', exact: true }).click();
      await page.getByRole('button', { name: /Resign/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Resign', exact: true }).click();
      await page.getByRole('link', { name: 'Analyze game', exact: true }).waitFor();
      await measure('live-completed');

      for (const [name, width, height] of [['tablet', 1024, 768], ['phone', 390, 844]]) {
        await page.setViewportSize({ width, height }); await start('arena');
        const chat = page.getByRole('region', { name: 'Tournament chat' });
        await chat.getByRole('textbox', { name: 'Tournament message' }).fill('Good luck!');
        await chat.getByRole('button', { name: 'Send', exact: true }).click();
        await chat.getByRole('log').getByText('Good luck!', { exact: true }).waitFor();
        await measure(`arena-${name}`);
      }
      const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
      touch.on('pageerror', error => errors.push(error.message));
      await touch.goto(base + path('live'));
      await touch.locator('[data-square="e2"]').tap(); await touch.locator('[data-square="e4"]').tap();
      await touch.waitForFunction(() => window.audit.moveRequests.length === 1);
      await touch.locator('[data-square="g1"]').tap(); await touch.locator('[data-square="f3"]').tap();
      await touch.getByRole('button', { name: 'Cancel', exact: true }).tap();
      assert.equal(await touch.getByText('Premove: g1 → f3', { exact: true }).count(), 0);
      await touch.close();
    }
    assert.deepEqual(errors, []);
    writeFileSync(`${output}/geometry.json`, JSON.stringify(results, null, 2));
    console.log(process.env.GAME_LAYOUT_GEOMETRY_ONLY
      ? `${results.length} game layout checks passed.`
      : 'Game layouts, rotation, settings, moves, takeback, flip, premoves/cancel, resignation, analysis and tournament chat passed.');
  } catch (error) {
    await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
    writeFileSync(`${output}/failure.json`, JSON.stringify(await page.evaluate(() => ({ text: document.body.innerText, audit: window.audit })), null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
