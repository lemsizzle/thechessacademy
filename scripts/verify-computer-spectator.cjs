// Local browser fixture only. Launch serve-gameplay-harness with GAMEPLAY_MOCK_COMPUTER_PRESENCE=1.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.COMPUTER_PREVIEW_URL || 'http://127.0.0.1:9456';
const output = 'work/computer-live';
fs.mkdirSync(output, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const student = await context.newPage(); const teacher = await context.newPage();
  const errors = [];
  for (const page of [student, teacher]) page.on('pageerror', error => errors.push(error.message));
  const trace = async page => JSON.parse(await page.locator('#computer-presence-trace').textContent());
  const move = async (from, to) => {
    await student.locator(`[data-board-square="${from}"]`).focus(); await student.keyboard.press('Enter');
    await student.locator(`[data-board-square="${to}"]`).focus(); await student.keyboard.press('Enter');
  };
  try {
    await student.goto(`${base}/student/play/computer`);
    await student.getByRole('button', { name: '5 + 3', exact: true }).click();
    await student.getByRole('button', { name: 'Start vs Pawny', exact: true }).click();
    await student.waitForFunction(() => JSON.parse(document.querySelector('#computer-presence-trace').textContent || '{}').row?.status === 'active');
    const initial = await trace(student);
    assert.equal(initial.row.human_color, 'white'); assert.equal(initial.row.move_count, 0);
    await teacher.goto(`${base}/admin/live-games`);
    await teacher.getByRole('button', { name: 'Refresh', exact: true }).click();
    await teacher.getByRole('heading', { name: 'OpeningExplorer vs Pawny', exact: true }).waitFor();
    await teacher.screenshot({ path: `${output}/teacher-list.png`, fullPage: true });
    await teacher.getByRole('link', { name: 'Watch Game', exact: true }).click();
    await teacher.getByRole('grid', { name: 'Chessboard, white perspective' }).waitFor();
    assert.equal(await teacher.getByRole('grid').getAttribute('aria-readonly'), 'true');
    await move('e2', 'e4');
    await student.waitForFunction(() => JSON.parse(document.querySelector('#computer-presence-trace').textContent || '{}').row?.move_count === 2);
    await teacher.waitForFunction(() => document.querySelector('[data-board-square="e4"]')?.getAttribute('aria-label')?.includes('pawn'));
    await teacher.getByRole('button', { name: /1\. e4/ }).count();
    await teacher.screenshot({ path: `${output}/teacher-watch-desktop.png`, fullPage: true });
    const beforeTicks = (await trace(student)).calls.filter(call => call.path.endsWith('computer-game-presence')).length;
    await student.waitForTimeout(2500);
    const afterTicks = (await trace(student)).calls.filter(call => call.path.endsWith('computer-game-presence')).length;
    assert.equal(afterTicks, beforeTicks, 'Clock ticks must not send presence requests');
    await student.getByRole('button', { name: /Take Back/ }).click();
    await student.waitForFunction(() => JSON.parse(document.querySelector('#computer-presence-trace').textContent || '{}').row?.move_count === 0);
    await teacher.waitForFunction(() => document.querySelector('[data-board-square="e2"]')?.getAttribute('aria-label')?.includes('pawn'));
    await teacher.setViewportSize({ width: 1024, height: 768 });
    await teacher.getByRole('button', { name: /Flip Board/ }).click();
    await teacher.getByRole('grid', { name: 'Chessboard, black perspective' }).waitFor();
    await teacher.screenshot({ path: `${output}/teacher-watch-tablet.png`, fullPage: true });
    await teacher.setViewportSize({ width: 390, height: 844 });
    await teacher.screenshot({ path: `${output}/teacher-watch-mobile.png`, fullPage: true });
    assert(await teacher.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Teacher spectator must not overflow on mobile');
    await student.getByRole('button', { name: /⚑ Resign/ }).click();
    await student.getByRole('button', { name: 'Resign', exact: true }).click();
    await student.waitForFunction(() => JSON.parse(document.querySelector('#computer-presence-trace').textContent || '{}').row?.status === 'completed');
    await teacher.getByText('Pawny won by resignation.', { exact: true }).waitFor();
    await teacher.goto(`${base}/admin/live-games`); await teacher.getByRole('button', { name: 'Refresh', exact: true }).click();
    await teacher.getByRole('heading', { name: 'No games in progress', exact: true }).waitFor();
    // A new black-side game must replace the old session and publish the bot's opening move.
    await student.getByRole('button', { name: /New Game/, exact: false }).last().click();
    await student.getByRole('button', { name: 'Black', exact: true }).click();
    await student.getByRole('button', { name: 'Start vs Pawny', exact: true }).click();
    await student.waitForFunction(() => { const row = JSON.parse(document.querySelector('#computer-presence-trace').textContent || '{}').row; return row?.status === 'active' && row?.human_color === 'black' && row.move_count === 1; });
    const second = await trace(student);
    assert.notEqual(second.row.game_id, initial.row.game_id);
    await teacher.getByRole('button', { name: 'Refresh', exact: true }).click();
    await teacher.getByRole('heading', { name: 'Pawny vs OpeningExplorer', exact: true }).waitFor();
    // Full navigation closes the game with keepalive and clears the teacher list.
    await student.getByRole('link', { name: 'Teacher Live Games', exact: true }).click();
    await teacher.getByRole('button', { name: 'Refresh', exact: true }).click();
    await teacher.getByRole('heading', { name: 'No games in progress', exact: true }).waitFor();
    assert.equal((await trace(teacher)).row.status, 'closed');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: ['teacher list', 'watch read-only', 'moves', 'takebacks', 'clock without tick requests', 'flip', 'tablet/mobile layout', 'completion', 'black-side bot opening', 'navigation cleanup'], screenshots: output }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
