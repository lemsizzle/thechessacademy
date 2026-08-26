import type { Tournament } from "@/lib/types";

type TournamentTiming = Pick<Tournament, "durationMinutes" | "endsAt" | "startsAt" | "status">;

export function isTournamentLive(tournament: TournamentTiming, now = Date.now()) {
  if (tournament.status === "finished") return false;

  const startsAt = Date.parse(tournament.startsAt);
  const explicitEnd = tournament.endsAt ? Date.parse(tournament.endsAt) : Number.NaN;
  const calculatedEnd = Number.isFinite(startsAt) && tournament.durationMinutes
    ? startsAt + tournament.durationMinutes * 60_000
    : Number.NaN;
  const endsAt = Number.isFinite(explicitEnd) ? explicitEnd : calculatedEnd;

  if (Number.isFinite(startsAt) && now < startsAt) return false;
  if (Number.isFinite(endsAt) && now >= endsAt) return false;
  if (tournament.status === "ongoing") return true;

  return Number.isFinite(startsAt) && Number.isFinite(endsAt);
}
