import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, stop, run, assertPortFree, waitForHttp } from './lib/qa-process.mjs';

const suite = process.argv[2] ?? 'core';
if (!['core', 'extended', 'drafts'].includes(suite)) throw new Error('Expected core, extended or drafts');
const engines = (process.env.QA_ENGINES ?? 'chromium,webkit').split(',');
if (!engines.length || engines.some(engine => !['chromium', 'webkit'].includes(engine))) throw new Error('QA_ENGINES must contain chromium and/or webkit');
const output = 'work/browser-ci';
mkdirSync(output, { recursive: true });
const env = { ...process.env, QA_ENGINES: engines.join(','), GAMEPLAY_MOCK_ENGINE: '1' };
const fixtures = suite === 'drafts' ? [['study-drafts', 9422]] : [
  ['areas', 9418], ['comprehensive', 9420], ['study-drafts', 9422],
  ...(suite === 'extended' ? [['gameplay', 9417], ['online', 9421]] : [])
];
const availableChecks = suite === 'drafts' ? ['study-drafts'] : [
  'comprehensive', 'journeys', 'device-interactions', 'study-drafts',
  ...(suite === 'extended' ? ['live', 'areas', 'modes', 'online-journey'] : [])
];
const servers = [];
const results = [];
const checks = process.env.QA_CHECKS ? [...new Set(process.env.QA_CHECKS.split(','))] : availableChecks;
if (!checks.length || checks.some(check => !availableChecks.includes(check))) throw new Error(`QA_CHECKS must select from: ${availableChecks.join(',')}`);
const startedAt = new Date().toISOString();
const save = (finished = false) => writeFileSync(`${output}/results.json`, JSON.stringify({ suite, checks, startedAt, ...(finished ? { finishedAt: new Date().toISOString() } : {}), results }, null, 2));
save();
let cleaning = false;
async function cleanup() {
  if (cleaning) return;
  cleaning = true;
  for (const server of servers.reverse()) await stop(server);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void cleanup().finally(() => process.exit(130)); });
try {
  for (const [, port] of fixtures) await assertPortFree(port);
  // Sequential compilation and one browser at a time keep local resource use bounded.
  for (const [fixture, port] of fixtures) {
    const script = fixture === 'online' ? 'scripts/serve-online-play-harness.mjs' : 'scripts/serve-gameplay-harness.mjs';
    const server = launch(process.execPath, [script], { log: `${output}/${fixture}-server.log`, env: {
      ...env, PORT: String(port), GAMEPLAY_PORT: String(port), GAMEPLAY_FIXTURE: `tests/browser/${fixture}-harness.jsx`,
      GAMEPLAY_NAVIGATION: fixture === 'comprehensive' ? '1' : '0'
    } });
    servers.push(server);
    await waitForHttp(`http://127.0.0.1:${port}`, server);
  }
  for (const check of checks) {
    const started = Date.now();
    try {
      await run(process.execPath, [`tests/browser/verify-${check}.cjs`], { env, timeoutMs: 600_000, log: `${output}/${check}.log` });
      results.push({ check, engines, result: 'PASS', durationMs: Date.now() - started });
    } catch (error) {
      results.push({ check, engines, result: 'FAIL', error: error.message, durationMs: Date.now() - started });
    }
    console.log(`${results.at(-1).result}: ${check}`);
    save();
  }
  if (results.some(result => result.result !== 'PASS')) process.exitCode = 1;
} catch (error) {
  results.push({ check: 'runner', result: 'FAIL', error: error.message });
  process.exitCode = 1;
} finally {
  try { await cleanup(); } catch (error) { results.push({ check: 'cleanup', result: 'FAIL', error: error.message }); process.exitCode = 1; }
  save(true);
}
