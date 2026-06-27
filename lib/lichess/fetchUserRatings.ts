import type { LichessSyncStatus, StudentLichessAccount } from "@/lib/types";

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

function mockPerf(seed: number) {
  return {
    rating: 900 + seed * 17,
    games: 25 + seed * 3,
    ratingChange: seed % 2 === 0 ? 8 : -5,
    ratingDeviation: 70 + (seed % 8),
    provisional: false
  };
}

export function createMockLichessAccount(studentId: string, username: string, status: LichessSyncStatus = "mock"): StudentLichessAccount {
  const safeUsername = cleanUsername(username) || "student";
  const seed = safeUsername.length;
  const today = new Date().toISOString().slice(0, 10);
  const blitz = mockPerf(seed);
  const rapid = mockPerf(seed + 5);
  const puzzle = mockPerf(seed + 11);

  return {
    id: `lichess-account-${studentId}`,
    studentId,
    lichessUserId: safeUsername.toLowerCase(),
    lichessUsername: safeUsername,
    lichessProfileUrl: `https://lichess.org/@/${safeUsername}`,
    blitzRating: blitz.rating,
    blitzGames: blitz.games,
    blitzRatingChange: blitz.ratingChange,
    blitzRatingDeviation: blitz.ratingDeviation,
    blitzProvisional: blitz.provisional,
    rapidRating: rapid.rating,
    rapidGames: rapid.games,
    rapidRatingChange: rapid.ratingChange,
    rapidRatingDeviation: rapid.ratingDeviation,
    rapidProvisional: rapid.provisional,
    puzzleRating: puzzle.rating,
    puzzleGames: puzzle.games,
    baselineBlitzRating: blitz.rating,
    baselineRapidRating: rapid.rating,
    baselinePuzzleRating: puzzle.rating,
    baselineBlitzGames: blitz.games,
    baselineRapidGames: rapid.games,
    baselinePuzzleGames: puzzle.games,
    activityBaselineSetAt: today,
    linkedAt: today,
    lastRatingSyncAt: today,
    syncStatus: status,
    createdAt: today,
    updatedAt: today
  };
}

export async function fetchUserRatings(studentId: string, username: string) {
  const safeUsername = cleanUsername(username);
  if (!safeUsername) {
    return { account: createMockLichessAccount(studentId, "student", "error"), mode: "mock" as const, message: "Missing Lichess username." };
  }

  try {
    const response = await fetch(`https://lichess.org/api/user/${encodeURIComponent(safeUsername)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      return {
        account: createMockLichessAccount(studentId, safeUsername, "rate-limited"),
        mode: "mock" as const,
        message: `Lichess rate limit reached. Try again${retryAfter ? ` after ${retryAfter} seconds` : " later"}.`
      };
    }

    if (!response.ok) {
      return { account: createMockLichessAccount(studentId, safeUsername, "mock"), mode: "mock" as const, message: "Could not reach Lichess ratings, so mock ratings were used." };
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
  } catch {
    return { account: createMockLichessAccount(studentId, safeUsername, "mock"), mode: "mock" as const, message: "Lichess ratings could not be reached, so mock ratings were used." };
  }
}
