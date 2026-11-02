// Run against the isolated Puzzle Battle fixture; no production data is used.
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const { mkdir } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const base = process.env.BATTLE_PREVIEW_URL || 'http://127.0.0.1:9482';

(async () => {
  const browser = process.env.BATTLE_ENGINE === 'webkit'
    ? await webkit.launch({ headless: true })
    : await chromium.launch({ headless: true, executablePath: process.env.BATTLE_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, hasTouch: true });
  await context.routeWebSocket(/.*/, ws => ws.close());
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let battle;
  async function checkGeometry(label) {
    const geometry = await page.locator('[data-chess-board]').evaluate(board => {
      const rect = element => {
        const r = element.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
      };
      return { board: rect(board), squares: Array.from(board.querySelectorAll('[data-square]'), rect) };
    });
    const { board, squares } = geometry;
    assert.equal(squares.length, 64);
    assert.ok(Math.abs(board.width - board.height) < 1, `${label}: square board`);
    const unit = board.width / 8;
    for (const [i, square] of squares.entries()) {
      assert.ok(Math.abs(square.width - unit) < 1 && Math.abs(square.height - unit) < 1,
        `${label}: square ${i} must be ${unit}px, got ${JSON.stringify(square)}`);
      assert.ok(Math.abs(square.x - (board.x + (i % 8) * unit)) < 1, `${label}: aligned files`);
      assert.ok(Math.abs(square.y - (board.y + Math.floor(i / 8) * unit)) < 1, `${label}: no rank gaps`);
      assert.ok(square.bottom <= board.bottom + 1 && square.right <= board.right + 1, `${label}: no clipped squares`);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  }
  try {
    await mkdir('work/puzzle-battle', { recursive: true });
    await context.request.get(base + '/__qa/login');
    const created = await context.request.post(base + '/api/student/puzzle-battles', { data: { mode: 'hide-and-seek', duration: 600, botLevel: 'gentle' } });
    assert.ok(created.ok(), await created.text());
    battle = (await created.json()).battle;
    const deck = await (await context.request.get(base + '/__qa/deck?id=' + battle.id)).json();
    await page.goto(base + '/student/training/battle?id=' + battle.id);
    await page.locator('[data-chess-board] [data-square]').first().waitFor();
    for (const [name, width, height] of [
      ['desktop', 1366, 900], ['large-desktop', 1920, 1440], ['tablet-landscape', 1024, 768], ['tablet-portrait', 768, 1024], ['phone', 390, 844], ['phone-landscape', 844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: `work/puzzle-battle/hide-board-${name}.png` });
      await checkGeometry(name);
      console.log('PASS uniform 8 × 8 board:', name);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const safe = deck[0].puzzle.safeSquares;
    await page.locator(`[data-square="${safe[0]}"]`).tap();
    await checkGeometry('after selecting a star');
    assert.equal(await page.locator(`[data-square="${safe[0]}"]`).getAttribute('aria-pressed'), 'true');
    await page.screenshot({ path: 'work/puzzle-battle/hide-board-selected.png' });
    for (const square of safe.slice(1)) await page.locator(`[data-square="${square}"]`).tap();
    await page.getByRole('heading', { name: 'You won! Nicely solved!' }).waitFor();
    await checkGeometry('finished board');
    await page.reload();
    await page.getByRole('heading', { name: 'You won! Nicely solved!' }).waitFor();
    await page.locator('[data-chess-board] [data-square]').first().waitFor();
    await checkGeometry('reloaded result');
    assert.deepEqual(errors, []);
    console.log('PASS touch selection, immediate finish, saved result after reload, and no browser errors.');
  } catch (error) {
    await page.screenshot({ path: 'work/puzzle-battle/hide-board-failure.png' });
    throw error;
  } finally {
    if (battle) await context.request.post(base + '/api/student/puzzle-battles/' + battle.id, { data: { type: 'leave', actionId: randomUUID() } });
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
