// Real UI + database verification. Explicitly opt in: creates then deletes one disposable student.
require('dotenv').config({ path: '.env.local', quiet: true });
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
if (process.env.ACADEMY_VERIFY_CREATE_STUDENT !== '1') throw new Error('Set ACADEMY_VERIFY_CREATE_STUDENT=1 to authorize disposable student creation.');
const base = process.env.ACADEMY_VERIFY_URL || 'http://127.0.0.1:3013';
const username = `verify_${randomBytes(5).toString('hex')}`;
const password = randomBytes(18).toString('base64url');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const output = 'work/manual-login'; fs.mkdirSync(output, { recursive: true });
let browser, studentId;
(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  await page.goto(`${base}/login?mode=admin`);
  await page.getByLabel('Teacher password').fill(process.env.ADMIN_PASSWORD || (base.startsWith('http://127.0.0.1:') ? 'academy' : ''));
  await page.getByRole('button', { name: 'Enter Dashboard', exact: true }).click();
  await page.waitForURL('**/admin');
  await page.goto(`${base}/admin/students`);
  await page.getByLabel('Student display name', { exact: true }).fill(`Login verification ${username}`);
  await page.getByLabel('Class group', { exact: true }).fill('Verification');
  await page.getByLabel('Academy username', { exact: true }).fill(username);
  await page.getByRole('button', { name: 'Generate password', exact: true }).click();
  assert((await page.getByLabel('Temporary password', { exact: true }).inputValue()).length >= 8);
  await page.getByLabel('Temporary password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create Student', exact: true }).click();
  await page.getByText(`Academy username: ${username}`, { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Temporary password', { exact: true }).inputValue(), '');
  const credential = await supabase.from('student_login_credentials').select('student_id,username,password_hash').eq('username', username).single();
  assert.ifError(credential.error); studentId = credential.data.student_id;
  assert.match(credential.data.password_hash, /^[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{86}$/);
  assert.notEqual(credential.data.password_hash, password);
  const student = await supabase.from('students').select('id,lichess_id,lichess_username,is_active').eq('id', studentId).single();
  assert.ifError(student.error); assert.equal(student.data.lichess_id, null); assert.equal(student.data.lichess_username, null);
  await page.screenshot({ path: `${output}/created.png` });
  await context.request.post(`${base}/api/admin/logout`);
  await context.request.post(`${base}/api/auth/logout`);
  await page.goto(`${base}/login`);
  assert(new URL(page.url()).pathname === '/login');
  await page.screenshot({ path: `${output}/login-desktop.png` });
  await page.getByLabel('Academy username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('incorrect-password');
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.getByText('Invalid username or password.', { exact: true }).waitFor();
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await page.waitForURL('**/student');
  await page.getByRole('heading', { name: 'My Academy Journey', exact: true }).waitFor();
  const sessionResponse = await context.request.get(`${base}/api/auth/session`);
  const session = await sessionResponse.json();
  assert.equal(session.user.authProvider, 'academy'); assert.equal(session.user.lichessUsername, undefined);
  const cookies = await context.cookies();
  const sessionCookie = cookies.find(c => c.name === 'quest_board_student_session');
  // Verify the actual cookie name from the response rather than copying session data to disk.
  assert(cookies.some(c => c.httpOnly && c.path === '/' && (!base.startsWith('https:') || c.secure)));
  await page.screenshot({ path: `${output}/dashboard.png` });
  for (const path of ['/student/quests','/student/avatar','/student/leaderboard','/student/play','/student/studies','/student/training']) {
    const response = await page.goto(base + path); assert(response.status() < 400, path);
    await page.locator('main h1').first().waitFor();
    assert(!/Application error:|Internal Server Error/.test(await page.locator('body').innerText()), path);
    assert(new URL(page.url()).pathname.startsWith('/student'), path);
    console.log(`PASS ${path}`);
  }
  const refreshed = await context.request.post(`${base}/api/lichess/quests/evaluate/student/${studentId}`, { data: { username: '', quests: [] } });
  assert.equal(refreshed.status(), 200); console.log('PASS internal quest refresh without Lichess');
  assert.equal((await context.request.post(`${base}/api/lichess/sync/me`, { data: {} })).status(), 409);
  await supabase.from('students').update({ is_active: false }).eq('id', studentId);
  assert.equal((await context.request.get(`${base}/api/auth/session`)).status(), 401);
  assert.equal((await context.request.post(`${base}/api/auth/student/login`, { data: { username, password } })).status(), 401);
  await supabase.from('students').update({ is_active: true }).eq('id', studentId);
  await context.request.post(`${base}/api/auth/logout`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/login`);
  await page.getByLabel('Academy username', { exact: true }).waitFor();
  await page.screenshot({ path: `${output}/login-mobile.png` });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByLabel('Academy username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click(); await page.waitForURL('**/student');
  await page.getByRole('heading', { name: 'My Academy Journey', exact: true }).waitFor();
  await page.reload(); await page.getByRole('heading', { name: 'My Academy Journey', exact: true }).waitFor();
  await context.request.post(`${base}/api/auth/logout`);
  const oauth = await context.request.get(`${base}/api/auth/lichess/start`, { maxRedirects: 0 });
  assert.equal(oauth.status(), 307); const location = new URL(oauth.headers().location);
  assert.equal(location.origin, 'https://lichess.org'); assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
  console.log('PASS teacher creation, hashed DB credential, wrong password, desktop/mobile login, reload, inactive rejection, OAuth PKCE redirect');
})().catch(error => {
  let message = String(error.message).replaceAll(password, '[redacted]');
  if (process.env.ADMIN_PASSWORD) message = message.replaceAll(process.env.ADMIN_PASSWORD, '[redacted]');
  console.error(message); process.exitCode = 1;
}).finally(async () => {
  // Resolve by our unique username too, so cleanup still runs if UI verification failed after creation.
  if (!studentId) { const found = await supabase.from('student_login_credentials').select('student_id').eq('username', username).maybeSingle(); studentId = found.data?.student_id; }
  if (studentId) {
    const removed = await supabase.from('students').delete().eq('id', studentId);
    if (removed.error) { console.error('Test student cleanup failed.'); process.exitCode = 1; }
    else { const remaining = await supabase.from('student_login_credentials').select('student_id').eq('student_id', studentId).maybeSingle(); assert.ifError(remaining.error); assert.equal(remaining.data, null); console.log('PASS disposable student and credential cleaned up'); }
  }
  await browser?.close();
});
