export const ONE_MINUTE_WARNING_MS = 60_000;

export function crossedOneMinuteWarning(previousMs: number | null, currentMs: number | null) {
  return previousMs !== null
    && currentMs !== null
    && previousMs > ONE_MINUTE_WARNING_MS
    && currentMs > 0
    && currentMs <= ONE_MINUTE_WARNING_MS;
}
