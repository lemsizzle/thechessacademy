import type { Tournament, TournamentStatus } from "@/lib/types";

export type TournamentFilter = "all" | TournamentStatus | "created-by";

export function filterTournaments(tournaments: Tournament[], filter: TournamentFilter, createdBy?: string, includeFinished = false) {
  return tournaments.filter((tournament) => {
    if (!includeFinished && tournament.status === "finished") return false;
    if (tournament.isActive === false) return false;
    if (filter === "all") return true;
    if (filter === "created-by") return createdBy ? tournament.createdBy?.toLowerCase() === createdBy.toLowerCase() : true;
    return tournament.status === filter;
  });
}
