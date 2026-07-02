import type { LichessOAuthProfile } from "@/lib/types";
import { getRetryAfterSeconds, LichessRateLimitError } from "@/lib/lichess/rateLimit";

type LichessPerf = {
  rating?: number;
  games?: number;
  prog?: number;
  rd?: number;
  prov?: boolean;
};

type LichessAccountResponse = {
  id?: string;
  username?: string;
  perfs?: {
    blitz?: LichessPerf;
    rapid?: LichessPerf;
    puzzle?: LichessPerf;
  };
};

function profileFromResponse(data: LichessAccountResponse): LichessOAuthProfile {
  const username = data.username ?? data.id ?? "lichess-student";
  const blitz = data.perfs?.blitz ?? {};
  const rapid = data.perfs?.rapid ?? {};
  const puzzle = data.perfs?.puzzle ?? {};

  return {
    id: data.id ?? username.toLowerCase(),
    username,
    profileUrl: `https://lichess.org/@/${username}`,
    blitzRating: blitz.rating ?? null,
    blitzGames: blitz.games ?? 0,
    blitzRatingChange: blitz.prog ?? null,
    blitzRatingDeviation: blitz.rd ?? null,
    blitzProvisional: blitz.prov ?? false,
    rapidRating: rapid.rating ?? null,
    rapidGames: rapid.games ?? 0,
    rapidRatingChange: rapid.prog ?? null,
    rapidRatingDeviation: rapid.rd ?? null,
    rapidProvisional: rapid.prov ?? false,
    puzzleRating: puzzle.rating ?? null,
    puzzleGames: puzzle.games ?? 0
  };
}

export async function fetchAuthenticatedLichessAccount(accessToken: string) {
  const response = await fetch("https://lichess.org/api/account", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store"
  });

  if (response.status === 429) {
    throw new LichessRateLimitError("Lichess rate limit reached for profile stats. Try again after the cooldown.", getRetryAfterSeconds(response.headers));
  }
  if (!response.ok) throw new Error("Could not fetch Lichess account.");
  return profileFromResponse(await response.json() as LichessAccountResponse);
}
