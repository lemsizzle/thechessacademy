// Creates confirmed disposable Auth fixtures; never sends verification mail or logs passwords.
require('dotenv').config({ path: '.env.local', quiet: true });
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ACADEMY_VERIFY_URL || 'http://127.0.0.1:3013';
const password = randomBytes(24).toString('base64url');
const email = `registration-${randomBytes(8).toString('hex')}@example.com`;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let browser, userId, studentId;
async function main() {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nickname: 'Registration verification' } });
  assert.ifError(created.error); userId = created.data.user.id;
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  fs.mkdirSync('work/registration', { recursive: true });
  await page.goto(base);
  await page.getByRole('link', { name: 'Log in with Academy username', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Register with email', exact: true }).click();
  await page.getByLabel('Chess nickname', { exact: false }).waitFor();
  await page.screenshot({ path: 'work/registration/register-desktop.png' });
  await page.goto(`${base}/login?method=email`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Log in with email', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Invalid email or password' }).waitFor();
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in with email', exact: true }).click();
  await page.waitForURL('**/student');
  await page.getByRole('heading', { name: 'My Academy Journey', exact: true }).waitFor();
  const session = await (await context.request.get(`${base}/api/auth/session`)).json();
  assert.equal(session.user.authProvider, 'supabase'); studentId = session.user.studentId;
  const record = await admin.from('students').select('lichess_id,lichess_username,display_name').eq('id', studentId).single();
  assert.ifError(record.error); assert.equal(record.data.lichess_id, null); assert.equal(record.data.lichess_username, null);
  assert.equal(record.data.display_name, 'Registration verification');
  const login = () => context.request.post(`${base}/api/auth/email`, { headers: { origin: base }, data: { action: 'login', email, password } });
  const repeated = await Promise.all([login(), login()]); assert(repeated.every(r => r.status() === 200));
  const mapping = await admin.from('student_registration_accounts').select('student_id').eq('auth_user_id', userId);
  assert.ifError(mapping.error); assert.equal(mapping.data.length, 1); assert.equal(mapping.data[0].student_id, studentId);
  for (const path of ['quests', 'avatar', 'play', 'studies', 'leaderboard', 'training']) {
    const response = await page.goto(`${base}/student/${path}`); assert.equal(response.status(), 200);
    await page.locator('main h1').waitFor();
  }
  await page.reload(); assert.equal((await context.request.get(`${base}/api/auth/session`)).status(), 200);
  const changed = await admin.from('students').update({ is_active: false }).eq('id', studentId); assert.ifError(changed.error);
  assert.equal((await context.request.get(`${base}/api/auth/session`)).status(), 401);
  assert.notEqual((await login()).status(), 200);
  await context.request.post(`${base}/api/auth/logout`);
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(`${base}/register`);
  await page.getByLabel('Email', { exact: true }).waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: 'work/registration/register-mobile.png' });
  console.log('PASS landing links, email login, incorrect password, private mapping, concurrent login idempotency, student pages, reload, inactive rejection, mobile registration');
}
main().catch(error => { console.error(String(error.message).replaceAll(password, '[redacted]')); process.exitCode = 1; }).finally(async () => {
  if (!studentId && userId) { const row = await admin.from('student_registration_accounts').select('student_id').eq('auth_user_id', userId).maybeSingle(); studentId = row.data?.student_id; }
  if (studentId) { const deleted = await admin.from('students').delete().eq('id', studentId); assert.ifError(deleted.error); }
  if (userId) { const deleted = await admin.auth.admin.deleteUser(userId); assert.ifError(deleted.error); console.log('PASS disposable Auth and student cleanup'); }
  await browser?.close();
});
