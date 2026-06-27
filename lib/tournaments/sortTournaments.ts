import type { Tournament, TournamentStatus } from "@/lib/types";

const statusWeight: Record<TournamentStatus, number> = {
  upcoming: 0,
  ongoing: 1,
  unknown: 2,
  finished: 3
};

export function sortTournaments(tournaments: Tournament[]) {
  return [...tournaments].sort((a, b) => (
    statusWeight[a.status] - statusWeight[b.status] ||
    (a.status === "finished" && b.status === "finished"
      ? new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
      : new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()) ||
    a.name.localeCompare(b.name)
  ));
}
