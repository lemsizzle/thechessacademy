// Real Next handlers + local Postgres/PostgREST. No auth or Study API mocks.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const { requireLoopbackUrl, requireRunDirectory } = await import('../../scripts/lib/local-e2e-safety.mjs');
  const base = requireLoopbackUrl(process.env.NEXT_PUBLIC_APP_URL, 9470);
  const database = requireLoopbackUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, 55431);
  const output = process.env.E2E_OUTPUT;
  requireRunDirectory(process.cwd(), output);
  assert(process.env.E2E_PASSWORD && process.env.ADMIN_PASSWORD, 'Runner-generated passwords required');
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const contexts = [];
  const results = [];
  async function check(name, task) {
    try { await task(); results.push({ name, result: 'PASS' }); }
    catch (error) { results.push({ name, result: 'FAIL', error: error.message }); throw error; }
    finally { fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ transport: 'real local Next.js + Supabase', results }, null, 2)); }
  }
  async function context() {
    const ctx = await browser.newContext({ baseURL: base, viewport: { width: 390, height: 844 }, hasTouch: true });
    contexts.push(ctx);
    await ctx.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    return ctx;
  }
  const alice = await context(), bob = await context(), teacher = await context(), anonymous = await context();
  let studyId, chapterId;
  const detail = async () => {
    const response = await teacher.request.get(`/api/chess/studies/${studyId}`);
    assert.equal(response.status(), 200, 'Teacher Study read failed');
    return response.json();
  };
  try {
    await check('Real Academy/teacher login and unauthenticated denial', async () => {
      assert.equal((await anonymous.request.get('/api/chess/studies')).status(), 401);
      for (const [ctx, username] of [[alice, 'qa_alice'], [bob, 'qa_bob']]) {
        const response = await ctx.request.post('/api/auth/student/login', { data: { username, password: process.env.E2E_PASSWORD }, headers: { origin: base } });
        assert.equal(response.status(), 200, 'Synthetic Academy login failed');
        assert((await ctx.cookies()).some(cookie => cookie.name === 'quest_board_student_session' && cookie.httpOnly), 'Student session must be HTTP-only');
      }
      assert.equal((await teacher.request.post('/api/admin/login', { data: { password: process.env.ADMIN_PASSWORD } })).status(), 200);
      const created = await alice.request.post('/api/chess/studies', { data: { title: 'Synthetic integration study' } });
      assert.equal(created.status(), 201);
      ({ studyId, chapterId } = await created.json());
    });
    await check('Private Study isolation and direct database access denied', async () => {
      const a = await alice.request.get(`/api/chess/studies/${studyId}?draftOwnerKey=student:other`);
      assert.equal((await a.json()).draftOwnerKey, 'student:11111111-1111-4111-8111-111111111111');
      assert.equal(a.headers()['cache-control'], 'private, no-store');
      assert.equal((await bob.request.get(`/api/chess/studies/${studyId}`)).status(), 403);
      assert.equal((await bob.request.patch(`/api/chess/studies/${studyId}/chapters/${chapterId}`, { data: { title: 'Unauthorized' } })).status(), 403);
      assert.equal((await detail()).draftOwnerKey, 'admin');
      for (const table of ['chess_studies', 'chess_study_chapters', 'student_login_credentials']) {
        const response = await fetch(`${database}/rest/v1/${table}?select=*`, { signal: AbortSignal.timeout(10_000), headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` } });
        assert([401, 403].includes(response.status), `${table} unexpectedly available to the public database role`);
      }
    });
    await check('Concurrent real saves return one success and one version conflict', async () => {
      const chapter = (await detail()).chapters[0];
      const requests = ['First writer', 'Second writer'].map(comment => {
        const tree = structuredClone(chapter.tree); tree.nodes[tree.rootId].comment = comment;
        return alice.request.patch(`/api/chess/studies/${studyId}/chapters/${chapterId}`, { data: { tree, version: chapter.version } });
      });
      const responses = await Promise.all(requests);
      assert.deepEqual(responses.map(response => response.status()).sort(), [200, 409]);
      assert.equal((await detail()).chapters[0].version, chapter.version + 1);
    });
    await check('Teacher grants viewer access; writes and revoked access are rejected', async () => {
      const studentId = '22222222-2222-4222-8222-222222222222';
      assert.equal((await teacher.request.post(`/api/chess/studies/${studyId}/members`, { data: { studentId, role: 'viewer' } })).status(), 200);
      const response = await bob.request.get(`/api/chess/studies/${studyId}`);
      assert.equal(response.status(), 200);
      assert.equal((await response.json()).study.accessRole, 'viewer');
      assert.equal((await bob.request.patch(`/api/chess/studies/${studyId}/chapters/${chapterId}`, { data: { title: 'Still unauthorized' } })).status(), 403);
      assert.equal((await teacher.request.delete(`/api/chess/studies/${studyId}/members/${studentId}`)).status(), 200);
      assert.equal((await bob.request.get(`/api/chess/studies/${studyId}`)).status(), 403);
    });
    await check('Repeated concurrent recovery copies create exactly one real chapter', async () => {
      const recoveryId = '33333333-3333-4333-8333-333333333333';
      const tree = (await detail()).chapters[0].tree;
      const request = () => teacher.request.post(`/api/chess/studies/${studyId}/chapters`, { data: { title: 'Recovered integration copy', analysisTree: tree, recoveryId } });
      const responses = await Promise.all([request(), request()]);
      assert.deepEqual(responses.map(response => response.status()), [201, 201]);
      assert.equal((await detail()).chapters.filter(chapter => chapter.id === recoveryId).length, 1);
      assert.equal((await request()).status(), 201);
      assert.equal((await detail()).chapters.length, 2);
    });
    await check('Actual Study page saves board moves and recovers an interrupted save', async () => {
      const page = await teacher.newPage(); page.setDefaultTimeout(30_000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`/admin/studies/${studyId}`);
      await page.locator('[data-square="e2"]').tap(); await page.locator('[data-square="e4"]').tap();
      await page.getByText('All changes saved', { exact: true }).waitFor();
      assert(Object.values((await detail()).chapters[0].tree.nodes).some(node => node.uci === 'e2e4'));
      await page.reload(); await page.locator('[data-square="e2"]').waitFor();
      await page.getByRole('button', { name: 'Next move', exact: true }).click();
      await page.locator('[data-square="e4"] [data-piece]').waitFor();
      const savePath = `**/api/chess/studies/${studyId}/chapters/${chapterId}`;
      await page.route(savePath, route => route.request().method() === 'PATCH' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic interruption' }) }) : route.continue());
      await page.locator('[data-square="e7"]').tap(); await page.locator('[data-square="e5"]').tap();
      await page.getByRole('button', { name: 'Retry saving', exact: true }).waitFor();
      await page.getByRole('link', { name: 'Library', exact: true }).click();
      await page.waitForURL('**/admin/studies');
      await page.unroute(savePath); await page.goBack();
      await page.getByRole('region', { name: 'Study recovery' }).waitFor();
      await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
      await page.getByText('All changes saved', { exact: true }).waitFor();
      assert(Object.values((await detail()).chapters[0].tree.nodes).some(node => node.uci === 'e7e5'));
      await page.reload(); await page.locator('[data-square="e2"]').waitFor();
      assert.equal(await page.getByRole('region', { name: 'Study recovery' }).count(), 0);
      await page.screenshot({ path: path.join(output, 'real-study-phone.png'), fullPage: true });
      assert.deepEqual(errors, [], 'Uncaught browser errors');
    });
    await check('Logout removes the authenticated session', async () => {
      assert.equal((await alice.request.post('/api/auth/logout')).status(), 200);
      assert.equal((await alice.request.get('/api/chess/studies')).status(), 401);
    });
    console.log(`PASS ${results.length} real local auth/Study checks`);
  } finally {
    for (const ctx of contexts) await ctx.close();
    await browser.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
