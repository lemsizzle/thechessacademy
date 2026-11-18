const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict'), fs = require('node:fs');
const { Chess } = require('chess.js');
const base = process.env.ENDGAME_PREVIEW_URL || 'http://127.0.0.1:9502';
const key = 'chessquest:endgames:v1:30000000-0000-4000-8000-000000000001';
const route = '/student/training/endgames';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.routeWebSocket(/.*/, ws => ws.close());
    const page = await context.newPage(), errors = [], times = [];
    page.setDefaultTimeout(25000);
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/__qa/login'); await page.goto(base + route);
    const board = page.getByTestId('endgame-board');
    const fen = () => board.getAttribute('data-fen');
    const ready = () => page.getByRole('button', { name: 'Hint', exact: true }).waitFor({ state: 'visible' }).then(() => page.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent === 'Hint'); return b && !b.disabled; }));
    const clickSquare = async square => {
      const bounds = await board.boundingBox(); const color = await board.getAttribute('data-color');
      const f = square.charCodeAt(0) - 97, r = Number(square[1]) - 1;
      await page.mouse.click(bounds.x + ((color === 'white' ? f : 7 - f) + .5) * bounds.width / 8, bounds.y + ((color === 'white' ? 7 - r : r) + .5) * bounds.height / 8);
    };
    const move = async (from, to) => { await clickSquare(from); await clickSquare(to); };
    await page.getByRole('button', { name: /^New position:/ }).first().waitFor();
    const titles = await page.getByRole('button', { name: /^New position:/ }).evaluateAll(buttons => buttons.map(b => b.getAttribute('aria-label')));
    assert.equal(titles.length, 12);
    // All skill types use the actual generated position + live Stockfish gate.
    for (const title of titles) {
      const before = Date.now(); await page.getByRole('button', { name: title, exact: true }).click();
      await board.waitFor(); await ready();
      times.push({ title, ms: Date.now() - before, fen: await fen() });
      assert.equal(new Chess(await fen()).isGameOver(), false);
      await page.getByRole('button', { name: 'All endgames' }).click();
    }
    await page.getByRole('button', { name: 'Resume: King & queen checkmate', exact: true }).click();
    const first = await fen();
    await page.getByRole('button', { name: 'New position', exact: true }).click();
    await page.waitForFunction(old => document.querySelector('[data-testid="endgame-board"]')?.getAttribute('data-fen') !== old, first); await ready();
    const fresh = await fen(); assert.notEqual(fresh, first);
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    const hint = page.locator('[role="status"]').filter({ hasText: /^Try / }); await hint.waitFor();
    const [, from, to] = (await hint.innerText()).match(/\(([a-h][1-8]) → ([a-h][1-8])\)/);
    await ready(); await move(from, to);
    await page.waitForFunction(old => document.querySelector('[data-testid="endgame-board"]')?.getAttribute('data-fen') !== old, fresh);
    await ready();
    const afterReply = await fen(); assert.notEqual(afterReply, fresh);
    await page.reload(); await ready(); assert.equal(await fen(), afterReply);
    await page.getByRole('button', { name: 'Take back', exact: true }).click(); await ready(); assert.equal(await fen(), fresh);
    fs.mkdirSync('work/endgames', { recursive: true });
    for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 1000 }, tablet: { width: 1024, height: 768 }, portrait: { width: 768, height: 1024 }, phone: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } })) {
      await page.setViewportSize(viewport); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${name}: no horizontal overflow`);
      const bounds = await board.boundingBox(); assert.ok(Math.abs(bounds.width - bounds.height) < 2, `${name}: square board`);
      assert.ok(bounds.width >= (name === 'landscape' ? 190 : 300), `${name}: usable board`);
      assert.ok(bounds.y + bounds.height <= viewport.height, `${name}: full board visible`);
      const hintBounds = await page.getByRole('button', { name: 'Hint', exact: true }).boundingBox();
      assert.ok(hintBounds.y + hintBounds.height <= viewport.height, `${name}: hint reachable without scrolling`);
      await page.screenshot({ path: `work/endgames/${name}.png`, fullPage: false });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Finish a real generated position using hints and the actual defender.
    for (let turn = 0; turn < 60; turn++) {
      if (await page.getByRole('heading', { name: 'Win converted!', exact: true }).count()) break;
      await ready(); await page.getByRole('button', { name: 'Hint', exact: true }).click();
      await hint.waitFor(); const [, start, end] = (await hint.innerText()).match(/\(([a-h][1-8]) → ([a-h][1-8])\)/);
      await ready(); await move(start, end);
      await page.waitForFunction(() => document.querySelector('[data-testid="endgame-board"]') && ([...document.querySelectorAll('button')].some(b => b.textContent === 'Hint' && !b.disabled) || [...document.querySelectorAll('h2')].some(h => h.textContent === 'Win converted!')));
    }
    await page.getByRole('heading', { name: 'Win converted!', exact: true }).waitFor();
    await page.getByText('Practice with help · no reward for this position', { exact: true }).waitFor();
    await page.screenshot({ path: 'work/endgames/completed.png' });
    // Seed browser-only scenarios to exercise terminal rules and promotion UI.
    const seed = async initialFen => {
      await page.evaluate(({ key, initialFen }) => localStorage.setItem(key, JSON.stringify({ selected: 'queen-mate', attempts: { 'queen-mate': { fen: initialFen, moves: [], assisted: false, completed: false } } })), { key, initialFen });
      await page.reload(); await ready();
    };
    await seed('7k/8/5KQ1/8/8/8/8/8 w - - 0 1');
    await move('g6', 'f7'); await page.getByRole('heading', { name: 'Stalemate', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Take back', exact: true }).click(); await ready();
    await move('g6', 'g7'); await page.getByRole('heading', { name: 'Win converted!', exact: true }).waitFor();
    assert.ok((await board.boundingBox()).width > 300);
    await page.reload(); await page.getByRole('heading', { name: 'Win converted!', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Retry position', exact: true }).click(); await ready();
    await seed('7k/4P3/4K3/8/8/8/8/8 w - - 0 1');
    await move('e7', 'e8');
    const promotion = page.getByRole('dialog', { name: 'Choose a promotion' }); await promotion.waitFor();
    const pb = await promotion.boundingBox(), bb = await board.boundingBox(); assert.ok(pb.x >= bb.x && pb.y >= bb.y && pb.x + pb.width <= bb.x + bb.width + 1);
    await page.getByRole('button', { name: 'Cancel promotion', exact: true }).click(); await ready();
    await move('e7', 'e8'); await page.getByRole('button', { name: 'Promote to Rook', exact: true }).click(); await ready();
    assert.equal(new Chess(await fen()).get('e8')?.type, 'r');
    // Cancel an unresponsive startup, then load a real worker successfully.
    await page.getByRole('button', { name: 'All endgames' }).click();
    await page.route('**/stockfish-18-lite-single.js', route => route.fulfill({status:200,contentType:'application/javascript',body:'self.onmessage = function () {};'}));
    await page.getByRole('button', { name: titles[0], exact: true }).click();
    await page.getByText('Still preparing your computer opponent.',{exact:false}).waitFor();
    await page.getByRole('button', {name:'Cancel',exact:true}).click();
    await page.unroute('**/stockfish-18-lite-single.js');
    await page.getByRole('button', { name: titles[0], exact: true }).click(); await board.waitFor(); await ready();
    assert.deepEqual(errors, []);
    fs.writeFileSync('work/endgames/generated-positions.json', JSON.stringify(times, null, 2));
    console.log('Passed: 12 generated skills, fresh starts, defending moves, hints, takebacks, reload, responsive layouts, stalemate/checkmate, promotion, worker recovery.');
    console.log(times.map(t => `${t.title}: ${t.ms}ms`).join('\n'));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
