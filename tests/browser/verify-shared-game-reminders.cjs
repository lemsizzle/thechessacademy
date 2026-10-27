const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:9470';

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
    const game = { id: 'saved-game', status: 'active', gameMode: 'live', viewerColor: 'white', opponent: { id: 'other', name: 'Blair' }, activeColor: 'white', arenaTournamentId: 'arena' };
    let phase = 'active', online = 0, history = 0;
    let holdNext = null;
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/student/online-play', async route => {
      online++;
      const status = phase === 'offline' ? 503 : phase === 'unauthorized' ? 401 : 200;
      const json = status !== 200 ? { error: 'Unavailable' } : { state: {
        students: [], incoming: [], outgoing: [], busy: phase !== 'empty',
        ...(phase === 'legacy' ? {} : { activeGames: phase === 'empty' ? [] : [game] })
      } };
      if (holdNext) { const held = holdNext; holdNext = null; held.started(); await held.gate; }
      await route.fulfill({ status, json });
    });
    await page.route('**/api/student/live-games', route => { history++; return route.fulfill({ json: { games: [game] } }); });
    await page.clock.install();
    await page.goto(base);
    const reminder = page.getByRole('link', { name: 'Return to game', exact: true });
    await reminder.waitFor();
    assert.equal(online, 1); assert.equal(history, 0);
    // Advance each scheduled poll separately, letting the HTTP response settle.
    for (let index = 0; index < 4; index++) {
      const response = page.waitForResponse(r => r.url().endsWith('/api/student/online-play'));
      await page.clock.fastForward(15000); await response;
      await page.evaluate(() => new Promise(resolve => queueMicrotask(resolve)));
    }
    assert.equal(online, 5, 'Same initial + four 15-second online refreshes');
    assert.equal(history, 0, 'No initial or 30-second game-history requests');

    await page.evaluate(() => window.fixtureNavigate('/student/play/live/saved-game'));
    await reminder.waitFor({ state: 'hidden' });
    await page.evaluate(() => window.fixtureNavigate('/student/training'));
    await reminder.waitFor();
    async function reconnect(next) {
      phase = next;
      const response = page.waitForResponse(r => r.url().endsWith('/api/student/online-play') && r.request().method() === 'GET');
      // Advance far enough for any previous response to complete before the event.
      await page.waitForTimeout(20);
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await response;
    }
    await reconnect('offline');
    await page.getByText('Unavailable', { exact: true }).first().waitFor();
    assert(await reminder.isVisible(), 'Temporary outage retains the saved-game link');
    await reconnect('unauthorized'); await reminder.waitFor({ state: 'hidden' });
    await reconnect('active'); await reminder.waitFor();
    let release, started;
    const gate = new Promise(resolve => { release = resolve; });
    const pending = new Promise(resolve => { started = resolve; });
    holdNext = { gate, started };
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await pending;
    phase = 'empty';
    await page.evaluate(() => window.fixtureNavigate('/student/play/history'));
    release();
    await reminder.waitFor({ state: 'hidden' });
    assert.equal(history, 0, 'Navigation during a poll queues fresh shared state, not a separate history fetch');
    await reconnect('active'); await reminder.waitFor();
    await reconnect('empty'); await reminder.waitFor({ state: 'hidden' });
    await reconnect('legacy'); await reminder.waitFor();
    assert.equal(history, 1, 'Older servers retain the legacy reminder fallback');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: 'work/cpu-optimization/shared-game-reminder.png' });
    console.log('PASS: one minute uses 5 background status requests instead of 8; reminders survive navigation, outages and legacy responses, clear on completion/401, and refresh on reconnect.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
