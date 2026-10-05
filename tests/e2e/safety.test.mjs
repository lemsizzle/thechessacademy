import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { isolatedEnvironment, requireLoopbackUrl, requireNoDotEnv, requireRunDirectory, requireLocalDockerEndpoint } from '../../scripts/lib/local-e2e-safety.mjs';

test('backend accepts only loopback HTTP on its fixed local API port', () => {
  for (const host of ['127.0.0.1', 'localhost', '[::1]']) assert.equal(requireLoopbackUrl(`http://${host}:55431`, 55431), `http://${host}:55431`);
  for (const url of ['https://example.supabase.co', 'http://localhost:54321', 'http://localhost:55431.evil.test', 'http://user:password@127.0.0.1:55431', 'http://127.0.0.1:55431/remote', 'http://127.0.0.1:55431?target=cloud', 'https://localhost:55431']) {
    assert.throws(() => requireLoopbackUrl(url, 55431));
  }
});
test('cleanup is restricted to a unique child of this checkout', () => {
  const root = resolve('work/safety-check');
  requireRunDirectory(root, resolve(root, 'work/local-e2e/run-123-abc'));
  for (const bad of [root, resolve(root, '..'), resolve(root, 'work/local-e2e'), resolve(root, 'work/local-e2e/project'), resolve(root, 'work/local-e2e/run-123/nested')]) assert.throws(() => requireRunDirectory(root, bad));
});
test('remote Docker contexts and UNC named pipes cannot be used', () => {
  for (const endpoint of ['unix:///var/run/docker.sock', 'npipe:////./pipe/docker_engine', 'npipe:////./pipe/dockerDesktopLinuxEngine']) assert.equal(requireLocalDockerEndpoint(endpoint), endpoint);
  for (const endpoint of ['tcp://production:2376', 'ssh://user@host', 'npipe:////remote/pipe/docker_engine', 'unix://relative', 'unix:///var/run/docker.sock?host=remote']) assert.throws(() => requireLocalDockerEndpoint(endpoint));
});
test('child environment removes app, cloud and test credential overrides', () => {
  const source = { PATH: 'keep', SystemRoot: 'keep', PLAYWRIGHT_BROWSERS_PATH: 'keep', SUPABASE_ACCESS_TOKEN: 'secret', SUPABASE_SERVICE_ROLE_KEY: 'secret', NEXT_PUBLIC_SUPABASE_URL: 'remote', ADMIN_PASSWORD: 'secret', STUDENT_SESSION_SECRET: 'secret', LICHESS_CLIENT_SECRET: 'secret', OPENAI_API_KEY: 'secret', VERCEL_TOKEN: 'secret', DATABASE_URL: 'remote', PGHOST: 'remote', E2E_PASSWORD: 'secret', NODE_OPTIONS: '--require unwanted.js', NODE_ENV: 'production', CHESSQUEST_LOCAL_E2E: '0' };
  assert.deepEqual(isolatedEnvironment(source), { PATH: 'keep', SystemRoot: 'keep', PLAYWRIGHT_BROWSERS_PATH: 'keep' });
});
test('Next environment files are refused instead of read or overwritten', () => {
  const parent = resolve(tmpdir());
  const directory = mkdtempSync(join(parent, 'chessquest-e2e-safety-'));
  assert.equal(dirname(resolve(directory)), parent);
  try {
    requireNoDotEnv(directory);
    writeFileSync(join(directory, '.env.local'), 'SENTINEL_DO_NOT_READ');
    assert.throws(() => requireNoDotEnv(directory), /clean checkout/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
