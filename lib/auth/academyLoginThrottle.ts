// Bounded per-process protection. Hosting-level limits should cover distributed attacks.
const attempts = new Map<string, { count: number; expires: number }>();
export function allowAcademyLoginAttempt(key: string, now = Date.now()) {
  for (const [id, entry] of attempts) if (entry.expires <= now) attempts.delete(id);
  const entry = attempts.get(key);
  if (entry) return ++entry.count <= 15;
  if (attempts.size >= 5000) return false;
  attempts.set(key, { count: 1, expires: now + 15 * 60_000 });
  return true;
}
