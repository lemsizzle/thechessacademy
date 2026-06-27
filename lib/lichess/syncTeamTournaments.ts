import { mockTournaments } from "@/data/tournaments";
import { fetchTeamArenaTournaments } from "@/lib/lichess/fetchTeamArenaTournaments";
import { normalizeArenaTournament } from "@/lib/tournaments/normalizeArenaTournament";
import { sortTournaments } from "@/lib/tournaments/sortTournaments";
import type { Tournament } from "@/lib/types";

type TournamentCache = {
  tournaments: Tournament[];
  teamId: string;
  syncedAt: string;
  mode: "connected" | "mock";
  warning?: string;
};

let cache: TournamentCache | undefined;

function getTeamId() {
  return process.env.LICHESS_TEAM_ID || "outschool-battleground";
}

function getSyncIntervalMs() {
  const minutes = Number(process.env.LICHESS_TOURNAMENT_SYNC_INTERVAL_MINUTES ?? 10);
  return Math.max(1, Number.isFinite(minutes) ? minutes : 10) * 60_000;
}

function mockCache(teamId: string, warning: string): TournamentCache {
  return {
    tournaments: sortTournaments(mockTournaments.map((tournament) => ({ ...tournament, teamId }))),
    teamId,
    syncedAt: new Date().toISOString(),
    mode: "mock",
    warning
  };
}

export function getCachedTeamTournaments() {
  if (cache && Date.now() - new Date(cache.syncedAt).getTime() < getSyncIntervalMs()) return cache;
  return undefined;
}

export async function syncTeamTournaments({ force = false } = {}) {
  const teamId = getTeamId();
  if (!teamId) {
    cache = mockCache("missing-team", "Missing LICHESS_TEAM_ID. Showing mock tournaments.");
    return cache;
  }

  if (!force) {
    const cached = getCachedTeamTournaments();
    if (cached) return cached;
  }

  try {
    const arena = await fetchTeamArenaTournaments(teamId);
    const tournaments = sortTournaments(arena.map((raw) => normalizeArenaTournament(raw, { teamId, source: "team_sync", isPublic: true })));

    cache = {
      tournaments,
      teamId,
      syncedAt: new Date().toISOString(),
      mode: "connected",
      warning: tournaments.length === 0 ? "Lichess returned no Arena tournaments for this team. Check that the team ID is correct and that the team has Arena events." : undefined
    };
    return cache;
  } catch (error) {
    cache = mockCache(teamId, error instanceof Error ? error.message : "Could not sync Lichess tournaments. Showing mock fallback.");
    return cache;
  }
}
