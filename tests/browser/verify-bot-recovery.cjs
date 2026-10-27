const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BOT_RECOVERY_URL || 'http://127.0.0.1:9475';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  try {
    for (const failure of ['startup', 'search', 'crash']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/student/play?area=bot&engineFailure=${failure}#computer-game`);
      await page.getByRole('button', { name: '3 + 2', exact: true }).click();
      await page.getByRole('button', { name: 'Start vs Pawny', exact: true }).click();
      const move = async (from, to) => { await page.locator(`[data-square="${from}"]`).click(); await page.locator(`[data-square="${to}"]`).click(); };
      await move('e2', 'e4');
      const plies = () => window.audit.requests.filter(r => r.path.includes('computer-game-presence') && r.body.moves?.length).at(-1)?.body.moves.length ?? 0;
      await page.waitForFunction(plies => {
        const moves = window.audit.requests.filter(r => r.path.includes('computer-game-presence') && r.body.moves?.length).at(-1)?.body.moves.length ?? 0;
        return moves >= plies;
      }, 2, { timeout: 20000 });
      assert.equal(await page.getByRole('button', { name: 'Retry Computer Move', exact: true }).count(), 0);
      await move('g1', 'f3');
      await page.waitForFunction(() => (window.audit.requests.filter(r => r.path.includes('computer-game-presence') && r.body.moves?.length).at(-1)?.body.moves.length ?? 0) >= 4, null, { timeout: 20000 });
      assert.equal(await page.evaluate(plies), 4, 'The recovered game must continue with the real engine');
      assert(await page.evaluate(() => window.audit.engineBestMoves >= 1), 'The next worker must actually return a Stockfish bestmove');
      assert.deepEqual(errors, []);
      console.log(`PASS: ${failure} failure automatically recovers; next turn uses real Stockfish; no manual retry or duplicate move.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
