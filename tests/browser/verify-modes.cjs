// Run with the local fixture servers described in gameplay-harness.md.
require('fs').mkdirSync('work/gameplay-audit', { recursive: true });
const assert = require('node:assert/strict');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
    for (const engine of ['chromium', 'webkit']) {
        const browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true, ...(engine === 'chromium' && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
        for (const width of [390, 820, 1440]) {
            const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: true });
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            const tap = async (s) => page.locator(`[data-square="${s}"]`).tap();
            await page.goto('http://127.0.0.1:9418/?area=promotion');
            await tap('a7');
            await tap('a8');
            await page.waitForFunction(() => document.activeElement.getAttribute('aria-label') === 'Promote to Queen');
            await page.keyboard.press('Shift+Tab');
            assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Cancel');
            await page.keyboard.press('Tab');
            assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Promote to Queen');
            await page.keyboard.press('Escape');
            assert.equal(await page.getByRole('dialog').count(), 0);
            assert.equal(await page.locator('[data-square="a7"] [data-piece]').count(), 1);
            await tap('a7');
            await tap('a8');
            await page.getByRole('button', { name: 'Promote to Knight', exact: true }).click();
            await page.waitForFunction(() => Object.values(window.audit.tree.nodes).some(n => n.uci === 'a7a8n'));
            await page.goto('http://127.0.0.1:9417/?live&correspondence');
            await tap('e2');
            await tap('e4');
            await page.getByRole('button', { name: 'Confirm pending move', exact: true }).click();
            await tap('g1');
            await tap('f3');
            assert.equal(await page.evaluate(() => window.liveTest.requests.length), 1);
            await page.getByRole('button', { name: 'Opponent e5', exact: true }).click();
            await page.waitForFunction(() => document.querySelector('[data-square="e5"] [data-piece]'));
            await tap('g1');
            await tap('f3');
            await page.waitForFunction(() => window.liveTest.requests.length === 2);
            await page.getByRole('button', { name: 'Confirm pending move', exact: true }).click();
            assert.equal(await page.getByText(/You can queue a premove/).count(), 0);
            const resign = page.getByRole('button', { name: /Resign/ });
            await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('⚑ Resign'))?.disabled === false);
await resign.focus();
            await page.keyboard.press("Enter");
            await page.waitForFunction(() => document.activeElement.textContent === 'Keep Playing');
            await page.keyboard.press('Shift+Tab');
            assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Resign');
            await page.keyboard.press('Escape');
            assert.equal(await page.getByRole('dialog').count(), 0);
            assert.equal(await page.evaluate(() => document.activeElement.textContent), '⚑ Resign');
            for (const [choice, start, mode] of [[/^↻/, 'Start Woodpecker', 'woodpecker'], [/^☀/, 'Play Daily Puzzle', 'daily']]) {
                await page.goto('http://127.0.0.1:9418/?area=puzzle');
                await page.getByRole('button', { name: choice }).click();
                await page.getByRole('button', { name: start, exact: true }).click();
                await tap('e2');
                await tap('e4');
                await page.waitForFunction(() => window.audit.requests.some(r => r.path.endsWith('/move')));
                assert(await page.evaluate(mode => window.audit.requests.some(r => r.path.includes('mode=' + mode)), mode));
            }
            assert.deepEqual(errors, []);
            console.log(`${engine} ${width}: promotion keyboard/cancel/underpromotion, correspondence turns, resignation cancellation, Woodpecker and daily puzzle passed`);
            await page.close();
        }
        const page = await browser.newPage();
        await page.goto('http://127.0.0.1:9418/?area=analysis');
        const result = await page.evaluate(() => window.audit.engineMove());
        assert(result.legal);
        console.log(engine + ' actual Stockfish worker: ' + result.move + ' legal');
        await browser.close();
    }
})().catch(e => { console.error(e); process.exit(1); });
