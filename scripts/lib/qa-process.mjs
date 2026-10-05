import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

// Own only the children started by this runner. Never kill by image name/port.
export function launch(command, args, { env = process.env, log, cwd = process.cwd() } = {}) {
  const output = log ? createWriteStream(log) : null;
  const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(output ?? process.stdout, { end: false });
  child.stderr.pipe(output ?? process.stderr, { end: false });
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => {
      output?.end();
      code === 0 ? resolve() : reject(new Error(`${args[0] ?? command} exited ${code ?? signal}${log ? `; see ${log}` : ''}`));
    });
  });
  // A server can exit while another command is running; retain its rejection.
  done.catch(() => {});
  return { child, done };
}

export async function stop(process) {
  if (!process?.child.pid || process.child.exitCode !== null || process.child.signalCode) return;
  if (globalThis.process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/PID', String(process.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    await new Promise(resolve => { killer.once('close', resolve); killer.once('error', resolve); });
  } else {
    process.child.kill('SIGTERM');
  }
  await Promise.race([process.done.catch(() => {}), delay(3000)]);
  if (process.child.exitCode === null && !process.child.signalCode) process.child.kill('SIGKILL');
}

export async function run(command, args, options = {}) {
  const managed = launch(command, args, options);
  let timedOut = false;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const timeout = setTimeout(() => { timedOut = true; void stop(managed); }, timeoutMs);
  try {
    await managed.done;
    if (timedOut) throw new Error(`Command exceeded its ${timeoutMs}ms deadline`);
  } catch (error) {
    if (timedOut) throw new Error(`Command exceeded its ${timeoutMs}ms deadline`);
    throw error;
  } finally { clearTimeout(timeout); await stop(managed); }
}

export async function assertPortFree(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Local port ${port} is occupied. Stop its owner or run QA in a separate environment.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

export async function waitForHttp(url, process, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (process.child.exitCode !== null || process.child.signalCode) {
      await process.done;
      throw new Error(`Server exited before becoming ready at ${url}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* compilation/startup may still be in progress */ }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}
