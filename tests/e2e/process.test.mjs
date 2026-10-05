import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { assertPortFree, launch, run, stop, waitForHttp } from '../../scripts/lib/qa-process.mjs';

test('deadline termination cannot be reported as a passing check', async () => {
  await assert.rejects(run(process.execPath, ['-e', "process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},100)"], { timeoutMs: 300 }), /deadline/);
});
test('a successful child exits normally', async () => {
  await run(process.execPath, ['-e', 'process.exit(0)'], { timeoutMs: 3000 });
});
test('an occupied port is rejected and its existing server stays running', async () => {
  const server = createServer((_req, response) => response.end('existing service'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await assert.rejects(assertPortFree(port), /occupied/);
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), 'existing service');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('a server which exits successfully before readiness fails promptly', async () => {
  const server = launch(process.execPath, ['-e', 'process.exit(0)']);
  try { await assert.rejects(waitForHttp('http://127.0.0.1:1', server, 3000), /exited before becoming ready/); }
  finally { await stop(server); }
});
