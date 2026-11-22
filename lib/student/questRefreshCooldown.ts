const lastRefresh = new Map<string, number>();
const cooldownMs = 10 * 60 * 1000;
const keyFor = (studentId: string) => `quest-board-auto-quest-refresh:${studentId}`;

function remember(studentId: string, timestamp: number) {
  lastRefresh.set(studentId, timestamp);
  try { window.sessionStorage.setItem(keyFor(studentId), String(timestamp)); } catch { /* Memory covers restricted storage. */ }
}

/** Reserve before starting the request so focus and visibility events share one refresh. */
export function reserveQuestRefresh(studentId: string, now = Date.now()) {
  let previous = lastRefresh.get(studentId) ?? 0;
  try {
    const stored = Number(window.sessionStorage.getItem(keyFor(studentId)) ?? 0);
    if (Number.isFinite(stored)) previous = Math.max(previous, stored);
  } catch { /* Use the in-memory cooldown when storage is unavailable. */ }
  if (previous > 0 && now - previous < cooldownMs) return false;
  remember(studentId, now);
  return true;
}

export function retryQuestRefreshLater(studentId: string, now = Date.now()) {
  remember(studentId, now - cooldownMs + 30_000);
}

export function clearQuestRefreshCooldown(studentId: string) {
  lastRefresh.delete(studentId);
  try { window.sessionStorage.removeItem(keyFor(studentId)); } catch { /* Logout still works without storage. */ }
}
