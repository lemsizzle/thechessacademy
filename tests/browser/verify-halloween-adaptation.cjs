const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.HALLOWEEN_ADAPTATION_URL || 'http://127.0.0.1:9476/student/play';
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.getByRole('button', { name: /Pipkin Pumpkin/ }).click();
    await page.getByRole('button', { name: /Black/, exact: false }).click();
    await page.getByRole('button', { name: 'Start vs Pipkin Pumpkin', exact: true }).click();
    const moves = await page.evaluate(() => window.fixtureStudentMoves);
    for (const [index, [from, to]] of moves.entries()) {
      await page.waitForFunction(n => window.audit.plies >= n, index * 2 + 1);
      if (index === 10) await page.evaluate(() => window.advanceFixtureTime());
      await page.locator(`[data-square="${from}"]`).click();
      await page.locator(`[data-square="${to}"]`).click();
    }
    await page.getByText('Keep going! Pipkin Pumpkin will play at ~375 next time.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.audit.saves[0].halloweenReductions['halloween-2026-pumpkin']), 25);
    mkdirSync('work/halloween/adaptation', { recursive: true });
    await page.screenshot({ path: 'work/halloween/adaptation/result-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'New Game', exact: true }).first().click();
    assert.match(await page.getByRole('button', { name: /Pipkin Pumpkin/ }).innerText(), /~375/);
    await page.reload();
    assert.match(await page.getByRole('button', { name: /Pipkin Pumpkin/ }).innerText(), /~375/);
    await page.getByRole('button', { name: /Pipkin Pumpkin/ }).click();
    await page.getByRole('button', { name: /Black/, exact: false }).click();
    await page.getByRole('button', { name: 'Start vs Pipkin Pumpkin', exact: true }).click();
    await page.waitForFunction(() => window.audit.engineConfigs.length > 0);
    assert.equal(await page.evaluate(() => window.audit.engineConfigs[0].estimatedRating), 375);
    assert.equal(await page.evaluate(() => window.audit.engineConfigs[0].qualityDiscipline), 0.12);
    // An immediate resignation must not make the next game easier.
    await page.getByRole('button', { name: /⚑ Resign/ }).click();
    await page.getByRole('button', { name: 'Resign', exact: true }).last().click();
    await page.waitForFunction(() => window.audit.saves.length > 0);
    assert.equal(await page.evaluate(() => window.audit.saves[0].halloweenReductions['halloween-2026-pumpkin']), 25);
    await page.reload();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByText('A little help after a tough game', { exact: true }).click();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No mobile horizontal overflow');
    await page.screenshot({ path: 'work/halloween/adaptation/setup-mobile.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS: real UI checkmate → validated saved record → 25-point reduction → reload → adjusted engine config; resignation rejected; mobile fits.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
