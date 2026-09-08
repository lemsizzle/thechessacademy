import type { ArenaQueueState, InternalArenaLobby } from "./types";

export function arenaQueueLabel(queue: ArenaQueueState) {
  if (queue.status === "matched") return "Paired — opening your board";
  if (queue.tournamentStatus === "cancelled") return "Tournament cancelled";
  if (queue.tournamentStatus === "finished") return queue.finalizing ? "Waiting for final results" : "Final results ready — return to the lobby";
  if (!queue.queueEnabled) return "Taking a break";
  if (queue.tournamentStatus === "scheduled") return "Registered — you're on the list";
  if (queue.pairingsPaused) return "Pairings paused by your teacher";
  return "Finding an opponent";
}

export function arenaFinalLabel(lobby: InternalArenaLobby) {
  if (lobby.arena.status === "cancelled") return "Cancelled";
  if (lobby.arena.status !== "finished") return null;
  if (lobby.pairings.some(p => p.status === "active")) return "Final games in progress";
  return lobby.arena.experienceVersion === 1 && !lobby.arena.finalResults ? "Confirming final results" : "Final results";
}

export function arenaClock(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
