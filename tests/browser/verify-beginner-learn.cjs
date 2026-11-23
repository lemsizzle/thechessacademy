const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { Chess } = require('chess.js');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const puzzles = require('../../lib/learn/puzzles.json');
const base = process.env.LEARN_URL || 'http://127.0.0.1:9586';
const names = ['Mate in 1','Hanging piece','Defensive move','Forks','Pins','Skewers'];
const topics = ['mate-in-one','hanging-piece','defensive-move','forks','pins','skewers'];
const output = 'work/beginner-learn';
(async () => {
  mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const errors = [];
  async function open(viewport, init) {
    const context = await browser.newContext({ viewport });
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    if (init) await context.addInitScript(init);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/student/training/learn');
    await page.getByRole('heading', { name: 'Learn', exact: true }).waitFor();
    return { context, page };
  }
  async function move(page, uci) {
    await page.locator(`[data-square="${uci.slice(0,2)}"]`).click();
    await page.locator(`[data-square="${uci.slice(2,4)}"]`).click();
  }
  try {
    const { context, page } = await open({ width: 1440, height: 900 });
    await page.screenshot({ path: `${output}/desktop-sets.png` });
    for (let t = 0; t < topics.length; t++) {
      await page.getByRole('button', { name: `${names[t]}, 0 of 30 solved`, exact: true }).click();
      const set = puzzles.filter(p => p.topic === topics[t]);
      const wrong = new Chess(set[0].fen).moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || '')).find(m => !set[0].solutions.includes(m));
      await move(page, wrong);
      await page.getByText(/That move is legal|That is check/).waitFor();
      assert.equal(await page.locator('[data-learn-board]').getAttribute('data-fen'), set[0].fen, 'Wrong move returns to original position');
      await page.getByRole('button', { name: 'Hint', exact: true }).click();
      await page.getByRole('button', { name: 'Show hint arrow', exact: true }).click();
      await page.getByRole('button', { name: 'Show me', exact: true }).click();
      await page.getByText('Watch, then try it yourself', { exact: true }).waitFor();
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('academy.learn.v1:learn-fixture')));
      assert(!saved.solved.includes(set[0].id), 'Demonstration must not mark solved');
      await page.getByRole('button', { name: 'Try it yourself', exact: true }).click();
      for (let i = 0; i < set.length; i++) {
        const puzzle = set[i];
        await page.locator(`[data-puzzle-id="${puzzle.id}"]`).waitFor();
        // Alternate accepted moves must behave just like the first answer.
        await move(page, puzzle.solutions.at(-1));
        await page.getByText('You found it!', { exact: true }).waitFor();
        if (i === 0) {
          await page.screenshot({ path: `${output}/${topics[t]}-solved.png` });
          if (topics[t] === 'forks' || topics[t] === 'skewers') {
            await page.getByRole('button', { name: 'Show follow-up', exact: true }).click();
            await page.getByRole('button', { name: 'Back to your move', exact: true }).waitFor();
            await page.getByRole('button', { name: 'Back to your move', exact: true }).click();
          }
        }
        if (i === 29) await page.getByRole('button', { name: 'Finish set', exact: true }).click();
        else await page.getByRole('button', { name: 'Next puzzle →', exact: true }).click();
      }
      await page.getByRole('button', { name: `${names[t]}, 30 of 30 solved`, exact: true }).waitFor();
      console.log(`${names[t]}: all 30 solutions, wrong answer, hints, demo and follow-up passed`);
    }
    await page.reload();
    await page.getByText(/180 \/ 180 solved/).waitFor();
    await page.getByRole('button', { name: 'Forks, 30 of 30 solved', exact: true }).click();
    await page.getByLabel('Choose a puzzle', { exact: true }).selectOption('12');
    await page.reload();
    await page.locator('[data-puzzle-id="forks-13"]').waitFor();
    await page.goto(base + '/student/training/learn?student=another-student');
    await page.getByText(/0 \/ 180 solved/).waitFor();
    await context.close();
    for (const [name, width, height] of [['tablet',820,1180],['tablet-landscape',1180,820],['phone',390,844],['small-phone',320,568],['phone-landscape',844,390]]) {
      const { context, page } = await open({ width, height });
      await page.getByRole('button', { name: 'Forks, 0 of 30 solved', exact: true }).click();
      await page.locator('[data-chess-board]').waitFor();
      await page.waitForTimeout(250);
      const rect = await page.locator('[data-chess-board]').boundingBox();
      assert(Math.abs(rect.width-rect.height)<1, 'Square board');
      assert(rect.x >= 0 && rect.x+rect.width <= width+1, 'Board fits width');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
      await page.screenshot({ path: `${output}/${name}.png` });
      await page.getByRole('button', { name: 'Hint', exact: true }).click();
      await move(page, puzzles.find(p => p.id === 'forks-01').solutions[0]);
      await page.getByText('You found it!', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Next puzzle →', exact: true }).click();
      await page.locator('[data-puzzle-id="forks-02"]').waitFor();
      await context.close();
      console.log(`${name}: board, controls and next puzzle passed`);
    }
    const restricted = await open({ width: 390, height: 844 }, () => { Storage.prototype.getItem = () => { throw new Error('Blocked'); }; Storage.prototype.setItem = () => { throw new Error('Blocked'); }; });
    await restricted.page.getByRole('button', { name: 'Mate in 1, 0 of 30 solved', exact: true }).click();
    await move(restricted.page, puzzles[0].solutions[0]);
    await restricted.page.getByText('You found it!', { exact: true }).waitFor();
    await restricted.context.close();
    assert.deepEqual(errors, []);
    console.log('All 180 solved, progress reload, resume, account isolation and unavailable storage passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
