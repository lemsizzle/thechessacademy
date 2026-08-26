import type { InternalArenaStanding, InternalArenaStatus } from "@/chess/arena/types";

export function arenaPoints(result: "win" | "draw" | "loss") {
  if (result === "win") return 2;
  if (result === "draw") return 1;
  return 0;
}

export function currentArenaStatus(status: InternalArenaStatus, startsAt: string, endsAt: string, nowMs = Date.now()): InternalArenaStatus {
  if (status === "cancelled" || status === "finished") return status;
  if (nowMs >= new Date(endsAt).getTime()) return "finished";
  if (nowMs >= new Date(startsAt).getTime()) return "active";
  return "scheduled";
}

export function rankArenaStandings(standings: Omit<InternalArenaStanding, "rank">[]): InternalArenaStanding[] {
  return [...standings]
    .filter((entry) => entry.status !== "withdrawn")
    .sort((left, right) => (
      right.score - left.score
      || right.wins - left.wins
      || left.gamesPlayed - right.gamesPlayed
      || left.name.localeCompare(right.name)
    ))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
