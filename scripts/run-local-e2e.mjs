import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, scrypt as scryptCallback, createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { launch, stop, run, assertPortFree, waitForHttp } from './lib/qa-process.mjs';
import { isolatedEnvironment, requireLoopbackUrl, requireNoDotEnv, requireRunDirectory, requireLocalDockerEndpoint } from './lib/local-e2e-safety.mjs';

const capture = promisify(execFile), scrypt = promisify(scryptCallback);
const require = createRequire(import.meta.url);
const cli = require.resolve('supabase/dist/supabase.js');
const root = process.cwd();
const prepareOnly = process.argv.length === 3 && process.argv[2] === '--prepare-only';
if (process.argv.length > 2 && !prepareOnly) throw new Error('Only --prepare-only is supported. Remote projects/URLs are never accepted.');
requireNoDotEnv(root);
const runId = `run-${Date.now()}-${randomBytes(4).toString('hex')}`;
const projectId = `cq-e2e-${randomBytes(6).toString('hex')}`;
const directory = resolve(root, 'work/local-e2e', runId);
requireRunDirectory(root, directory);
const env = { ...isolatedEnvironment(process.env), NEXT_TELEMETRY_DISABLED: '1', SUPABASE_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1' };
const cliArgs = args => [cli, ...args, '--workdir', directory];
async function localCli(args, timeout = 120_000) {
  try {
    const execution = capture(process.execPath, cliArgs(args), { env, cwd: root, windowsHide: true, timeout, maxBuffer: 8 * 1024 * 1024 });
    // migration new accepts SQL on stdin. Close the empty pipe or the CLI will
    // wait indefinitely for input even after creating the migration file.
    execution.child.stdin?.end();
    return await execution;
  } catch (error) {
    // CLI start/status output can include local service credentials. Keep it out
    // of artifacts and exception messages. No debug ticket or cloud login.
    throw new Error(`Local Supabase ${args[0]} failed (${error.code ?? 'timeout'}). Inspect this run's local containers; no CLI credentials were logged.`);
  }
}

let server, stackAttempted = false, cleaned = false;
async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  await stop(server);
  if (stackAttempted) {
    requireRunDirectory(root, directory);
    if (!readFileSync(resolve(directory, 'supabase/config.toml'), 'utf8').includes(`project_id = "${projectId}"`)) throw new Error('Local project identity changed; cleanup refused');
    // Unique project per invocation: never --all, never a linked/cloud project.
    await localCli(['stop', '--project-id', projectId, '--no-backup'], 60_000);
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void cleanup().finally(() => process.exit(130)); });

try {
  if (!prepareOnly) {
    let endpoint;
    try {
      const contextArgs = ['context', 'inspect', ...(env.DOCKER_CONTEXT ? [env.DOCKER_CONTEXT] : []), '--format', '{{.Endpoints.docker.Host}}'];
      // Docker gives an explicit context priority over DOCKER_HOST. Resolve it
      // once, reject remote endpoints, then give every child the same socket.
      endpoint = !env.DOCKER_CONTEXT && env.DOCKER_HOST ? env.DOCKER_HOST : (await capture('docker', contextArgs, { env, windowsHide: true, timeout: 10_000 })).stdout.trim();
      requireLocalDockerEndpoint(endpoint);
      env.DOCKER_HOST = endpoint;
      delete env.DOCKER_CONTEXT;
      const info = await capture('docker', ['info', '--format', '{{.OSType}}'], { env, windowsHide: true, timeout: 15_000 });
      if (info.stdout.trim() !== 'linux') throw new Error('Linux containers required');
    } catch {
      throw new Error('A running LOCAL Docker-compatible Linux container engine is required. No runtime was installed, no project was linked, and no database was changed. Use npm run test:e2e:prepare to validate configuration without Docker.');
    }
    for (const port of [9470, 55430, 55431, 55432]) await assertPortFree(port);
  }
  mkdirSync(resolve(root, 'work/local-e2e'), { recursive: true });
  mkdirSync(directory, { recursive: false });
  await localCli(['init']);
  writeFileSync(resolve(directory, 'supabase/config.toml'), readFileSync('tests/e2e/supabase.toml', 'utf8').replace('__PROJECT_ID__', projectId));
  await localCli(['migration', 'new', 'synthetic_auth_studies_baseline']);
  const migrationDirectory = resolve(directory, 'supabase/migrations');
  const generated = readdirSync(migrationDirectory).filter(name => name.endsWith('_synthetic_auth_studies_baseline.sql'));
  if (generated.length !== 1 || existsSync(resolve(directory, 'supabase/.temp/project-ref'))) throw new Error('Expected one CLI-generated migration in a fresh unlinked directory');
  const manifest = JSON.parse(readFileSync('tests/e2e/schema-manifest.json', 'utf8'));
  const sources = manifest.map(path => ({ path, sql: readFileSync(resolve(root, path), 'utf8') }));
  writeFileSync(resolve(migrationDirectory, generated[0]), sources.map(({ path, sql }) => `-- Source: ${path}\n${sql}`).join('\n\n'));
  writeFileSync(resolve(directory, 'schema-provenance.json'), JSON.stringify(sources.map(({ path, sql }) => ({ path, sha256: createHash('sha256').update(sql).digest('hex') })), null, 2));
  console.log(`Prepared synthetic auth/Study schema: ${directory}`);
  if (prepareOnly) {
    console.log('PREPARED only: no database, migration execution, browser or cloud connection was started.');
  } else {
    stackAttempted = true;
    await localCli(['start'], 600_000);
    const status = JSON.parse((await localCli(['status', '--output', 'json'])).stdout);
    const api = requireLoopbackUrl(status.API_URL, 55431);
    if (typeof status.SERVICE_ROLE_KEY !== 'string' || typeof status.ANON_KEY !== 'string') throw new Error('Local CLI did not supply the required legacy API keys');
    const password = randomBytes(24).toString('base64url');
    const adminPassword = randomBytes(24).toString('base64url');
    const fixtures = [
      { id: '11111111-1111-4111-8111-111111111111', display_name: 'QA Alice', public_slug: 'qa-alice', username: 'qa_alice' },
      { id: '22222222-2222-4222-8222-222222222222', display_name: 'QA Bob', public_slug: 'qa-bob', username: 'qa_bob' }
    ];
    async function insert(table, rows) {
      const response = await fetch(`${api}/rest/v1/${table}`, { method: 'POST', signal: AbortSignal.timeout(15_000), headers: { apikey: status.SERVICE_ROLE_KEY, Authorization: `Bearer ${status.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
      if (!response.ok) throw new Error(`Synthetic ${table} seed failed (HTTP ${response.status})`);
    }
    await insert('students', fixtures.map(({ username, ...student }) => ({ ...student, is_active: true })));
    const credentials = [];
    for (const student of fixtures) {
      const salt = randomBytes(16), hash = await scrypt(password, salt, 64);
      credentials.push({ student_id: student.id, username: student.username, password_hash: `${salt.toString('base64url')}:${hash.toString('base64url')}`, must_change_password: false });
    }
    await insert('student_login_credentials', credentials);
    const appEnv = { ...env, CHESSQUEST_LOCAL_E2E: '1', NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:9470', NEXT_PUBLIC_SUPABASE_URL: api, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY, ADMIN_PASSWORD: adminPassword, ADMIN_SESSION_SECRET: randomBytes(32).toString('hex'), STUDENT_SESSION_SECRET: randomBytes(32).toString('hex') };
    const next = require.resolve('next/dist/bin/next');
    // A real Next development server keeps HTTP-only Academy cookies usable
    // over local HTTP. The separate CI checks job verifies production builds.
    server = launch(process.execPath, [next, 'dev', '--hostname', '127.0.0.1', '--port', '9470'], { env: appEnv, log: resolve(directory, 'app.log') });
    await waitForHttp('http://127.0.0.1:9470', server, 90_000);
    await run(process.execPath, ['tests/e2e/verify-auth-studies.cjs'], { env: { ...appEnv, E2E_OUTPUT: directory, E2E_PASSWORD: password }, log: resolve(directory, 'browser.log'), timeoutMs: 300_000 });
    console.log('PASS: real local Next.js/Supabase auth and Study integration');
  }
} catch (error) {
  if (existsSync(directory)) {
    const resultsPath = resolve(directory, 'results.json');
    const previous = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : {};
    writeFileSync(resultsPath, JSON.stringify({ ...previous, result: 'FAIL', runnerError: error.message }, null, 2));
  }
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try { await cleanup(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
