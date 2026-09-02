export function monotonicEpochNow() {
  return performance.timeOrigin + performance.now();
}

/**
 * Estimates when a server-scheduled start occurs on the browser's monotonic
 * clock. The NTP-style offset removes device clock skew and server work time.
 */
export function synchronizedStartOffset(input: {
  startedAt: string;
  serverReceivedAt: string;
  serverSentAt: string;
  requestStartedAt: number;
  responseReceivedAt: number;
}) {
  const startedAt = Date.parse(input.startedAt);
  const serverReceivedAt = Date.parse(input.serverReceivedAt);
  const serverSentAt = Date.parse(input.serverSentAt);
  if (!Number.isFinite(startedAt)
    || !Number.isFinite(serverReceivedAt)
    || !Number.isFinite(serverSentAt)
    || !Number.isFinite(input.requestStartedAt)
    || !Number.isFinite(input.responseReceivedAt)
    || serverSentAt < serverReceivedAt
    || input.responseReceivedAt < input.requestStartedAt) return null;

  const clockOffset = (
    (serverReceivedAt - input.requestStartedAt)
    + (serverSentAt - input.responseReceivedAt)
  ) / 2;
  return startedAt - (input.responseReceivedAt + clockOffset);
}
