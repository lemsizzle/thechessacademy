import type { Tournament } from "@/lib/types";

export const FINISHED_TOURNAMENT_LIMIT = 6;

export function limitFinishedTournaments(tournaments: Tournament[], limit = FINISHED_TOURNAMENT_LIMIT) {
  const active = tournaments.filter((tournament) => tournament.status !== "finished");
  const recentFinished = tournaments
    .filter((tournament) => tournament.status === "finished")
    .sort((a, b) => (
      new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime() ||
      a.name.localeCompare(b.name)
    ))
    .slice(0, limit);

  return [...active, ...recentFinished];
}
