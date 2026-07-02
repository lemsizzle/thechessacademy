import type { StudentLichessAccount } from "@/lib/types";
import { getRetryAfterSeconds, LichessRateLimitError } from "@/lib/lichess/rateLimit";

type LichessPerf = {
  rating?: number;
  games?: number;
  prog?: number;
  rd?: number;
  prov?: boolean;
};

type LichessUserResponse = {
  id?: string;
  username?: string;
  perfs?: {
    blitz?: LichessPerf;
    rapid?: LichessPerf;
    puzzle?: LichessPerf;
  };
};

function cleanUsername(username: string) {
  return username.trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

export async function fetchUserRatings(studentId: string, username: string) {
  const safeUsername = cleanUsername(username);
  if (!safeUsername) {
    throw new Error("Missing Lichess username.");
  }

  try {
    const response = await fetch(`https://lichess.org/api/user/${encodeURIComponent(safeUsername)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    if (response.status === 429) {
      throw new LichessRateLimitError("Lichess rate limit reached for ratings. Try again after the cooldown.", getRetryAfterSeconds(response.headers));
    }

    if (!response.ok) {
      throw new Error(`Could not reach Lichess ratings for ${safeUsername}.`);
    }

    const parsed = await response.json() as LichessUserResponse;
    const blitz = parsed.perfs?.blitz ?? {};
    const rapid = parsed.perfs?.rapid ?? {};
    const puzzle = parsed.perfs?.puzzle ?? {};
    const today = new Date().toISOString().slice(0, 10);
    const lichessUsername = parsed.username ?? safeUsername;

    return {
      account: {
        id: `lichess-account-${studentId}`,
        studentId,
        lichessUserId: parsed.id ?? lichessUsername.toLowerCase(),
        lichessUsername,
        lichessProfileUrl: `https://lichess.org/@/${lichessUsername}`,
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
        puzzleGames: puzzle.games ?? 0,
        baselineBlitzRating: blitz.prov ? undefined : blitz.rating,
        baselineRapidRating: rapid.prov ? undefined : rapid.rating,
        baselinePuzzleRating: puzzle.rating,
        baselineBlitzGames: blitz.games ?? 0,
        baselineRapidGames: rapid.games ?? 0,
        baselinePuzzleGames: puzzle.games ?? 0,
        activityBaselineSetAt: today,
        linkedAt: today,
        lastRatingSyncAt: today,
        syncStatus: "connected" as const,
        createdAt: today,
        updatedAt: today
      },
      mode: "connected" as const,
      message: "Synced Blitz, Rapid, and Puzzle ratings from Lichess."
    };
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Lichess ratings could not be reached.");
  }
}
