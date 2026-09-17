/** Small server-local pools: deduplicate concurrent reads without caching student progress. */
export function createCandidateCache<T>(ttlMs = 60_000, maxEntries = 64) {
  const entries = new Map<string, { expires: number; value: Promise<T[]> }>();
  return (key: string, load: () => Promise<T[]>) => {
    const existing = entries.get(key);
    if (existing && existing.expires > Date.now()) return existing.value;
    entries.delete(key);
    if (entries.size >= maxEntries) entries.delete(entries.keys().next().value!);
    const entry = { expires: Date.now() + ttlMs, value: Promise.resolve().then(load) };
    entries.set(key, entry);
    entry.value = entry.value.then(rows => {
      if (!rows.length && entries.get(key) === entry) entries.delete(key);
      return rows;
    }, error => {
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    });
    return entry.value;
  };
}
