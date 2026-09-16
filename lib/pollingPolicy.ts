/** Fallback polling budgets; user actions and realtime events still refresh immediately. */
export function onlinePlayPollMs(hasPendingChallenge: boolean) {
  return hasPendingChallenge ? 5_000 : 15_000;
}

export function arenaPresencePollMs(queue: {
  status: string; tournamentStatus: string; finalizing: boolean; pairingsPaused: boolean;
} | null, navigating: boolean) {
  if (queue?.tournamentStatus === "cancelled" || (queue?.tournamentStatus === "finished" && !queue.finalizing)) return Infinity;
  return navigating && queue?.status === "waiting" && queue.tournamentStatus === "active" && !queue.pairingsPaused ? 3_000 : 15_000;
}

export function liveGamePollMs(status: string | undefined, correspondence: boolean, hasBots: boolean, realtime: boolean) {
  if (status === "waiting") return 3_000;
  if (status !== "active") return null;
  if (correspondence) return 60_000;
  // Bot polls are also a recovery trigger for server-side moves.
  return hasBots ? 5_000 : realtime ? 30_000 : 3_000;
}
