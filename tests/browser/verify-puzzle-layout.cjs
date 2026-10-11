// Run with GAMEPLAY_FIXTURE=tests/browser/puzzle-layout-harness.jsx,
// GAMEPLAY_NAVIGATION=1 through scripts/serve-gameplay-harness.mjs.
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PUZZLE_LAYOUT_URL || 'http://127.0.0.1:9460';
const output = process.env.PUZZLE_LAYOUT_SCREENSHOTS || 'work/puzzle-layout';

(async () => {
  mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const start = async (mode = 'survival') => {
    await page.goto(base + '/student/training');
    await page.evaluate(() => localStorage.setItem('academy-puzzles-auto-advance', 'false'));
    await page.reload();
    await page.getByRole('button', { name: mode === 'survival' ? /^♥/ : mode === 'woodpecker' ? /^↻/ : /^☀/ }).click();
    await page.getByRole('button', { name: mode === 'survival' ? 'Start Survival' : mode === 'woodpecker' ? 'Start Woodpecker' : 'Play Daily Puzzle', exact: true }).click();
    await page.waitForSelector('[data-chess-board]');
    await page.waitForTimeout(200);
  };
  async function measure(name) {
    await page.evaluate(() => scrollTo(0, 0));
    // The shared sidebar has an intentional 200ms width transition on rotation.
    await page.waitForTimeout(300);
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
      const sidebar = document.querySelector('.puzzle-sidebar').getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom,
        controls: { x: sidebar.x, y: sidebar.y, width: sidebar.width },
        viewport: { width: innerWidth, height: innerHeight, availableBottom: bottom }, overflow: document.documentElement.scrollWidth - innerWidth,
        spread: [0, 1, 2, 3].map(axis => Math.max(...samples.map(s => s[axis])) - Math.min(...samples.map(s => s[axis]))) };
    });
    assert(Math.abs(geometry.width - geometry.height) < 1, `${name}: board lost square ratio`);
    assert(geometry.overflow <= 1, `${name}: page overflowed ${geometry.overflow}px`);
    assert(geometry.x >= -1 && geometry.right <= geometry.viewport.width + 1, `${name}: board clipped horizontally`);
    assert(geometry.y >= 0 && geometry.bottom <= geometry.viewport.availableBottom + 1, `${name}: board clipped vertically: ${JSON.stringify(geometry)}`);
    assert(Math.max(...geometry.spread) < 1.1, `${name}: board resizes/buzzes while idle: ${geometry.spread}`);
    assert(geometry.controls.x >= geometry.right || geometry.controls.y >= geometry.bottom, `${name}: controls overlap board`);
    if (geometry.viewport.width < 768 && geometry.viewport.height > geometry.viewport.width) assert(geometry.width >= geometry.viewport.width - 48, `${name}: portrait phone board too small`);
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: false });
    console.log(name, JSON.stringify(geometry));
  }
  try {
    for (const [name, width, height] of (process.env.PUZZLE_LAYOUT_INTERACTIONS_ONLY ? [] : [
      ['desktop', 1920, 1080], ['laptop', 1440, 900], ['short-laptop', 1280, 720],
      ['tablet-landscape', 1024, 768], ['tablet-portrait', 768, 1024],
      ['phone', 390, 844], ['small-phone', 320, 568], ['phone-landscape', 844, 390],
      ['small-phone-landscape', 667, 375], ['split-screen', 960, 1080]
    ])) {
      await page.setViewportSize({ width, height }); await start(); await measure(name);
    }
    // Rotate the same active session; do not start a new board between sizes.
    for (const [name, width, height] of (process.env.PUZZLE_LAYOUT_INTERACTIONS_ONLY ? [] : [['rotate-landscape', 1024, 768], ['rotate-portrait', 768, 1024], ['rotate-back', 1024, 768]])) {
      await page.setViewportSize({ width, height }); await measure(name);
    }
    if (process.env.PUZZLE_LAYOUT_INTERACTIONS_ONLY) { await page.setViewportSize({ width: 1024, height: 768 }); await start(); }
    await page.getByRole('button', { name: 'Board settings', exact: true }).click();
    assert(await page.getByRole('dialog', { name: 'Board settings' }).isVisible());
    await page.getByRole('button', { name: 'Close board settings' }).click();
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    await page.waitForFunction(() => window.audit.hints === 1);
    await page.getByText('Hint: this is the piece to move.', { exact: true }).waitFor();
    const move = async (from, to) => { await page.locator(`[data-square="${from}"]`).click(); await page.locator(`[data-square="${to}"]`).click(); };
    await move('e5', 'g4');
    await page.waitForFunction(() => window.audit.incorrectMoves === 1);
    await page.getByText(/^Incorrect destination\./).waitFor();
    await move('e5', 'c6');
    await page.getByRole('button', { name: 'Next Puzzle', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Next Puzzle', exact: true }).click();
    await page.waitForSelector('[data-square="g2"] [data-piece]');
    await page.getByRole('switch', { name: 'Automatically move to the next puzzle' }).click();
    await move('g2', 'c6');
    await page.waitForSelector('[data-square="a4"] [data-piece]');
    await page.getByRole('button', { name: 'Exit Training', exact: true }).click();
    await page.getByText('Academy Training Report', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Back to Puzzles', exact: true }).click();
    assert.equal(await page.locator('[data-chess-board]').count(), 0);
    for (const mode of ['woodpecker', 'daily']) {
      await page.setViewportSize({ width: 1024, height: 768 }); await start(mode); await measure(mode);
    }
    const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    touch.on('pageerror', error => errors.push(error.message));
    await touch.goto(base + '/student/training');
    await touch.getByRole('button', { name: /^♥/ }).tap();
    await touch.getByRole('button', { name: 'Start Survival', exact: true }).tap();
    await touch.waitForSelector('[data-chess-board]');
    await touch.locator('[data-square="e5"]').tap();
    await touch.locator('[data-square="c6"]').tap();
    await touch.getByRole('button', { name: 'Next Puzzle', exact: true }).waitFor();
    assert.equal(await touch.evaluate(() => window.audit.correctMoves), 1);
    await touch.getByRole('button', { name: 'Next Puzzle', exact: true }).tap();
    await touch.waitForSelector('[data-square="g2"] [data-piece]');
    await touch.close();
    assert.deepEqual(errors, []);
    console.log('Puzzle layout, rotation, settings, hints, incorrect moves, retries, next puzzle, auto-advance and exit passed.');
  } catch (error) {
    await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
    writeFileSync(`${output}/failure.json`, JSON.stringify(await page.evaluate(() => ({ text: document.body.innerText, audit: window.audit })), null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
