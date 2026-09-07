/** Per-process CPU bound; database leases additionally deduplicate across server instances. */
export function createArenaBotWorkQueue(concurrency = 2) {
  const jobs = new Map<string, Promise<void>>();
  const waiting: Array<() => void> = [];
  let active = 0;
  return function enqueue(id: string, work: () => Promise<void>): Promise<void> {
    const existing = jobs.get(id);
    if (existing) return existing;
    const task = (async () => {
      if (active >= concurrency) await new Promise<void>((resolve) => waiting.push(resolve));
      else active += 1;
      // Defer invocation until the job is registered, including synchronous failures.
      try { await Promise.resolve().then(work); }
      finally {
        jobs.delete(id);
        const next = waiting.shift();
        if (next) next(); else active -= 1;
      }
    })();
    jobs.set(id, task);
    return task;
  };
}
