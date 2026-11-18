// Real launcher and game components, with isolated API responses and Strict Mode.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/lemue/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.TRAINING_REWARDS_URL || 'http://127.0.0.1:9515';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  fs.mkdirSync('work/puzzle-layout/quick-start', { recursive: true });
  const back = () => page.getByRole('button', { name: 'Back to Training Modes', exact: true }).click();
  const requests = () => page.evaluate(() => window.trainingQA.startRequests);
  try {
    await page.goto(base + '/?launcher');
    await page.getByRole('button', { name: 'Launch Path Finder', exact: true }).click();
    await page.getByText('Complete each puzzle to earn 2 XP + 2 coins.', { exact: true }).waitFor();
    assert.equal((await requests()).length, 1, 'one run per card click, including Strict Mode');
    let previous = null;
    for (const move of await page.evaluate(() => window.trainingQA.solution(0))) {
      if (previous !== move.from) await page.locator(`[data-square="${move.from}"]`).click();
      await page.locator(`[data-square="${move.to}"]`).click(); previous = move.to;
    }
    await page.waitForFunction(() => document.querySelector('[data-session-xp]')?.textContent === '2');
    await back();
    await page.getByRole('button', { name: 'Start Hide and Seek', exact: true }).click();
    await page.getByRole('grid', { name: 'Hide and Seek chessboard', exact: true }).waitFor();
    assert.equal((await requests()).length, 2);
    for (const square of await page.evaluate(() => window.trainingQA.safeSquares)) {
      await page.getByRole('gridcell', { name: new RegExp('^' + square + '\\b') }).click();
    }
    await page.getByRole('button', { name: 'Stop & Score', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-session-xp]')?.textContent === '12');
    await page.getByRole('button', { name: 'Back to Training', exact: true }).click();
    for (const [name, width, height] of [['desktop',1440,900],['tablet',1024,768],['phone',390,844]]) {
      await page.setViewportSize({width,height});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({path:`work/puzzle-layout/quick-start/${name}.png`,fullPage:true});
    }
    await page.setViewportSize({ width:1440,height:900 });
    await page.getByRole('button', {name:'Hide and Seek settings',exact:true}).click();
    assert.equal((await requests()).length,2,'settings do not start the clock');
    await page.getByRole('radio',{name:/Star Detective/}).check();
    await page.getByRole('button',{name:/Start Star Detective/}).click();
    await page.getByRole('grid',{name:'Hide and Seek chessboard',exact:true}).waitFor();
    assert.equal((await requests()).at(-1).mode,'hard');
    await back();
    await page.getByRole('button',{name:'Path Finder settings',exact:true}).click();
    assert.equal((await requests()).length,3);
    await page.getByRole('radio',{name:/Time Trial/}).check();
    await page.getByRole('button',{name:/Start.*Trial/}).click();
    await page.getByText('Complete each puzzle to earn 2 XP + 2 coins.',{exact:true}).waitFor();
    assert.equal((await requests()).at(-1).mode,'time_trial');
    await back();
    await page.getByRole('button',{name:'Woodpecker Method settings',exact:true}).click();
    await page.getByLabel('Theme',{exact:true}).selectOption('fork');
    await page.getByLabel('Puzzles per cycle',{exact:true}).selectOption('30');
    await page.getByRole('button',{name:'← Back to modes',exact:true}).click();
    await page.getByRole('button',{name:'View My Stats',exact:true}).click();
    await page.getByRole('heading',{name:'Puzzle Training Stats',exact:true}).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Launch Path Finder',exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('One-click Path Finder/Hide and Seek, exactly-once starts, solving/rewards, mode settings, stats, responsive launcher passed.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
