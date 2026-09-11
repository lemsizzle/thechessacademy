// Run with the local fixture servers described in gameplay-harness.md.
require('fs').mkdirSync('work/gameplay-audit', { recursive: true });
const assert = require('node:assert/strict');
const fs = require('fs');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
    let count = 0;
    for (const engine of ['chromium', 'webkit']) {
        const browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true, ...(engine === 'chromium' && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
        for (const width of [390, 820, 1440]) {
            const page = await browser.newPage({ viewport: { width, height: 1100 }, hasTouch: true });
            page.setDefaultTimeout(8000);
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            let area;
            try {
                for (area of (process.env.GAMEPLAY_AREAS?.split(',') || ['analysis', 'promotion', 'review', 'star', 'hide', 'puzzle', 'adventure', 'boss', 'bot', 'spectator', 'arena'])) {
                    await page.goto('http://127.0.0.1:9418/?area=' + area);
                    const tap = async (s) => page.locator(`[data-square="${s}"]`).tap();
                    if (area === 'puzzle') {
                        await page.getByRole('button', { name: /^♥/ }).click();
                        await page.getByRole('button', { name: 'Start Survival', exact: true }).click();
                    }
                    if (area === 'star')
                        await page.getByRole('button', { name: 'Start Classic Run' }).click();
                    if (area === 'hide')
                        await page.getByRole('button', { name: 'Start Classic Search' }).click();
                    if (area === 'bot')
                        await page.getByRole('button', { name: 'Start vs Pawny' }).click();
                    await page.waitForSelector(area === 'hide' ? '[role="grid"] button' : '[data-square]');
                    const shapes = await page.locator('[id$="-board"]').evaluateAll(bs => bs.filter(b => b.querySelector(':scope > svg')).map(b => { const r = b.getBoundingClientRect(), a = b.querySelector(':scope > svg').getBoundingClientRect(); return { w: r.width, h: r.height, aw: a.width, ah: a.height }; }));
                    for (const s of shapes) {
                        assert(Math.abs(s.w - s.h) < 1, `${area}: board stretched ${JSON.stringify(s)}`);
                        assert(Math.abs(s.w - s.aw) < 1 && Math.abs(s.h - s.ah) < 1, `${area}: overlay mismatch`);
                    }
                    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), area + ': horizontal overflow');
                    if (area === 'analysis') {
                        await tap('e2');
                        await tap('e4');
                        await tap('e7');
                        await tap('e5');
                        await page.waitForFunction(() => Object.values(window.audit.tree.nodes).some(n => n.uci === 'e7e5'));
                        await page.getByRole('button', { name: 'First position', exact: true }).click();
                        await page.waitForFunction(() => document.querySelector('[data-square="e2"] [data-piece]'));
                    }
                    if (area === 'promotion') {
                        await tap('a7');
                        await tap('a8');
                        await page.getByRole('button', { name: 'Promote to Knight', exact: true }).click();
                        await page.waitForFunction(() => Object.values(window.audit.tree.nodes).some(n => n.uci === 'a7a8n'));
                    }
                    if (area === 'review') {
                        await tap('e2');
                        await tap('e4');
                        await page.getByText('You found it!', { exact: true }).waitFor();
                        assert.equal(await page.evaluate(() => window.audit.requests.filter(r => r.method === 'POST').length), 1);
                    }
                    if (area === 'puzzle') {
                        await tap('e2');
                        await tap('e5');
                        assert.equal(await page.evaluate(() => window.audit.requests.filter(r => r.path.endsWith('/move')).length), 0);
                        await tap('e2');
                        await tap('e4');
                        await page.waitForFunction(() => window.audit.requests.some(r => r.path.endsWith('/move')));
                        assert.equal(await page.evaluate(() => window.audit.requests.filter(r => r.path.endsWith('/move')).length), 1);
                    }
                    if (area === 'star') {
                        const moves = await page.evaluate(() => window.audit.starSolution());
                        let previous = null;
                        for (const m of moves) {
                            if (m.from !== previous)
                                await tap(m.from);
                            await tap(m.to);
                            previous = m.to;
                        }
                        await page.waitForFunction(() => window.audit.requests.some(r => r.path.includes('/star-wars/progress')));
                    }
                    if (area === 'hide') {
                        const square = await page.evaluate(() => window.audit.safeSquares[0]);
                        const cell = page.getByRole('gridcell', { name: new RegExp('^' + square + ':') });
                        await cell.tap();
                        assert.equal(await cell.getAttribute('aria-selected'), 'true');
                        await page.getByRole('gridcell', {name: /^a1:/}).tap();
await page.getByRole('button', { name: 'Stop & Score', exact: true }).click();
                        await page.waitForFunction(() => window.audit.requests.some(r => r.path.includes('/hide-and-seek/finish')));
await page.waitForSelector('[role="grid"] > svg > line', {state: 'attached'});
const geometry = await page.locator('[role="grid"]').evaluate(b => {
 const r=b.getBoundingClientRect(), a=b.querySelector(':scope > svg').getBoundingClientRect();
 const cells=[...b.querySelectorAll('[role="gridcell"]')].map(c=>c.getBoundingClientRect());
 return {w:r.width,h:r.height,aw:a.width,ah:a.height,count:cells.length,error:Math.max(...cells.map(c=>Math.max(Math.abs(c.width-r.width/8),Math.abs(c.height-r.height/8))))};
});
assert.equal(geometry.count,64);assert(Math.abs(geometry.w-geometry.h)<1 && Math.abs(geometry.aw-geometry.w)<1 && Math.abs(geometry.ah-geometry.h)<1 && geometry.error<1);
                    }
                    if (area === 'adventure') {
                        await tap('a5');
                        await tap('a6');
                        await page.waitForFunction(() => document.querySelector('[data-square="a6"] [data-piece]'));
                        await page.getByRole('button', { name: 'Hint', exact: true }).click();
                    }
                    if (area === 'boss' || area === 'bot') {
                        await tap('e2');
                        await tap('e4');
                        await page.waitForFunction(() => !document.querySelector('[data-square="b8"] [data-piece]'), {}, { timeout: 8000 });
                        if (area === 'bot') {
                            await page.getByRole('button', { name: /Take Back/ }).click();
                            await page.waitForFunction(() => document.querySelector('[data-square="e2"] [data-piece]'));
                            await page.getByRole('button', { name: 'Arrow', exact: true }).click();
                            await tap('e2');
                            await tap('e4');
                            await page.waitForFunction(() => document.querySelector('[id$="-board"] > svg > path'));
                            await page.getByRole('button', { name: 'Clear', exact: true }).click();
                        }
                    }
                    if (area === 'spectator' || area === 'arena') {
                        await tap('e2');
                        await tap('e4');
                        assert.equal(await page.locator('[data-square="e2"] [data-piece]').count(), 1);
                        await page.getByRole('button', { name: /Flip Board/ }).click();
                        await page.waitForFunction(() => document.querySelector('[data-square]')?.dataset.square === 'h1');
                        assert.equal(await page.evaluate(() => window.audit.requests.filter(r => r.method === 'POST' && r.path.endsWith('/move')).length), 0);
                    }
                    await page.screenshot({ path: `work/gameplay-audit/${engine}-${area}-${width}.png`, fullPage: true });
                    assert.deepEqual(errors, []);
                    count++;
                    console.log(`${engine} ${width} ${area}: PASS`);
                }
            }
            catch (e) {
                await page.screenshot({ path: `work/gameplay-audit/FAILED-${engine}-${area}-${width}.png`, fullPage: true });
                fs.writeFileSync('work/gameplay-audit/failure.txt', await page.locator('body').innerText());
                throw e;
            }
            await page.close();
        }
        await browser.close();
    }
    console.log(`${count} area/device checks passed`);
})().catch(e => { console.error(e); process.exit(1); });
