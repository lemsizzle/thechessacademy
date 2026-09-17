// Uses the isolated areas fixture: exercise real input handling under slow replies.
const assert = require('node:assert/strict');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true, ...(engine === chromium && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 900 }, hasTouch: true });
      for (const [choice, start] of [[/^♥/, 'Start Survival'], [/^☀/, 'Play Daily Puzzle'], [/^↻/, 'Start Woodpecker']]) {
        await page.goto('http://127.0.0.1:9418/?area=puzzle');
        await page.getByRole('button', { name: choice }).click();
        await page.getByRole('button', { name: start, exact: true }).click();
        await page.waitForSelector('[data-square="e2"]');
        await page.evaluate(() => {
          const original = window.fetch;
          window.latency = { requests: [] };
          window.fetch = async (url, options) => {
            if (!String(url).endsWith('/move')) return original(url, options);
            window.latency.requests.push(JSON.parse(options.body));
            if (window.latency.requests.length > 1) {
              window.latency.nextAt = performance.now();
              return new Promise(() => {});
            }
            await new Promise(resolve => { window.latency.release = resolve; });
            window.latency.replyAt = performance.now();
            return new Response(JSON.stringify({ accepted: true, completed: false, token: 'reply', studentFen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', positionFen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', opponentMove: 'e7e5', message: 'Keep going' }));
          };
        });
        const tap = s => page.locator(`[data-square="${s}"]`).tap();
        await tap('e2'); await tap('e4');
        // The player's piece must move while the server response is still held.
        await page.waitForSelector('[data-square="e4"] [data-piece]');
        await tap('g1'); await tap('f3');
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => window.latency.requests.length), 1);
        await page.evaluate(() => window.latency.release());
        await page.waitForFunction(() => window.latency.requests.length === 2);
        const result = await page.evaluate(() => ({ delay: window.latency.nextAt - window.latency.replyAt, move: window.latency.requests[1] }));
        assert.equal(result.move.move.from, 'g1');
        assert.equal(result.move.move.to, 'f3');
        assert(result.delay < 350, `Reply handoff took ${result.delay}ms`);
        console.log(`${engine.name()} ${start}: optimistic input and queued move passed; reply handoff ${Math.round(result.delay)}ms`);
      }
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exit(1); });
