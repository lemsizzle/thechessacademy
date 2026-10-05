import { existsSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';

export function requireLoopbackUrl(value, port) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.port !== String(port) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error(`E2E requires an HTTP loopback URL on port ${port}`);
  }
  return url.origin;
}

export function requireRunDirectory(root, directory) {
  const parent = resolve(root, 'work/local-e2e');
  const path = relative(parent, resolve(directory));
  if (!/^run-[a-z0-9-]+$/.test(path) || isAbsolute(path)) throw new Error('Refusing a directory outside this disposable E2E run');
}

export function requireLocalDockerEndpoint(endpoint) {
  if (!/^unix:\/\/\/[^\r\n?#]+$/.test(endpoint) && !/^npipe:\/\/\/{0,2}\.\/pipe\/[a-z0-9_.-]+$/i.test(endpoint)) {
    throw new Error('Only a local Unix socket or local Windows named pipe is allowed for E2E Docker');
  }
  return endpoint;
}

export function requireNoDotEnv(root) {
  for (const name of ['.env', '.env.local', '.env.production', '.env.production.local', '.env.development', '.env.development.local']) {
    if (existsSync(resolve(root, name))) throw new Error(`Refusing to run with ${name}; use a clean checkout without production environment files`);
  }
}

export function isolatedEnvironment(source) {
  // Retain OS, npm/cache and browser paths; remove all app/cloud credentials.
  return Object.fromEntries(Object.entries(source).filter(([name]) => !/^(NEXT_PUBLIC_|SUPABASE_|ADMIN_|STUDENT_|LICHESS_|OPENAI_|VERCEL_|DATABASE_|PG|E2E_|CHESSQUEST_|CRON_|OUTSCHOOL_|PUZZLE_SESSION_|NODE_OPTIONS|NODE_ENV$|EDITOR$|VISUAL$|GIT_EDITOR$)/i.test(name)));
}
