import { LICHESS_TOKEN_COOKIE } from "@/lib/auth/roles";
import { readStudentSession } from "@/lib/auth/session";
import { createMockLichessProfile, fetchAuthenticatedLichessAccount } from "@/lib/lichess/fetchAccount";
import { fetchStudentGamesForWindow } from "@/lib/lichess/fetchStudentGamesForWindow";
import { fetchStudentPuzzleActivityForWindow } from "@/lib/lichess/fetchStudentPuzzleActivityForWindow";
import { decryptLichessToken } from "@/lib/lichess/tokenCrypto";
import { withLichessActivityBaseline } from "@/lib/lichessXp";
import type { LichessOAuthProfile, StudentLichessAccount } from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function profileToAccount(studentId: string, profile: LichessOAuthProfile, syncStatus: StudentLichessAccount["syncStatus"]): StudentLichessAccount {
  const now = new Date().toISOString();
  return {
    id: `lichess-account-${studentId}`,
    studentId,
    lichessUserId: profile.id,
    lichessUsername: profile.username,
    lichessProfileUrl: profile.profileUrl,
    blitzRating: profile.blitzRating,
    blitzGames: profile.blitzGames,
    blitzRatingChange: profile.blitzRatingChange,
    blitzRatingDeviation: profile.blitzRatingDeviation,
    blitzProvisional: profile.blitzProvisional,
    rapidRating: profile.rapidRating,
    rapidGames: profile.rapidGames,
    rapidRatingChange: profile.rapidRatingChange,
    rapidRatingDeviation: profile.rapidRatingDeviation,
    rapidProvisional: profile.rapidProvisional,
    puzzleRating: profile.puzzleRating,
    puzzleGames: profile.puzzleGames,
    blitzWins: 0,
    rapidWins: 0,
    puzzleCorrect: 0,
    baselineBlitzRating: profile.blitzProvisional ? undefined : profile.blitzRating ?? undefined,
    baselineRapidRating: profile.rapidProvisional ? undefined : profile.rapidRating ?? undefined,
    baselinePuzzleRating: profile.puzzleRating ?? undefined,
    baselineBlitzGames: profile.blitzGames,
    baselineRapidGames: profile.rapidGames,
    baselinePuzzleGames: profile.puzzleGames ?? 0,
    baselineBlitzWins: 0,
    baselineRapidWins: 0,
    baselinePuzzleCorrect: 0,
    activityBaselineSetAt: now,
    linkedAt: now,
    lastRatingSyncAt: now,
    lastPuzzleSyncAt: now,
    syncStatus,
    createdAt: now,
    updatedAt: now
  };
}

function getBaselineDate(account: StudentLichessAccount) {
  const date = new Date(account.activityBaselineSetAt ?? account.linkedAt);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function enrichAccountActivity(account: StudentLichessAccount, token: string) {
  const start = getBaselineDate(account);
  const end = new Date();
  if (end.getTime() - start.getTime() < 30_000) {
    return {
      ...account,
      lastGameSyncAt: end.toISOString(),
      lastPuzzleSyncAt: end.toISOString(),
      updatedAt: end.toISOString()
    };
  }

  const [rapidResult, blitzResult, puzzleResult] = await Promise.allSettled([
    fetchStudentGamesForWindow(account.lichessUsername, start, end, "rapid", token),
    fetchStudentGamesForWindow(account.lichessUsername, start, end, "blitz", token),
    fetchStudentPuzzleActivityForWindow(token, start, end)
  ]);

  const rapidGames = rapidResult.status === "fulfilled"
    ? rapidResult.value.filter((game) => game.rated && game.finished)
    : [];
  const blitzGames = blitzResult.status === "fulfilled"
    ? blitzResult.value.filter((game) => game.rated && game.finished)
    : [];
  const puzzleActivity = puzzleResult.status === "fulfilled" ? puzzleResult.value : [];
  const rapidPlayed = rapidGames.length;
  const blitzPlayed = blitzGames.length;
  const rapidWins = rapidGames.filter((game) => game.won).length;
  const blitzWins = blitzGames.filter((game) => game.won).length;
  const puzzleCorrect = puzzleActivity.filter((puzzle) => puzzle.win).length;
  const baselineRapidGames = account.baselineRapidGames ?? account.rapidGames;
  const baselineBlitzGames = account.baselineBlitzGames ?? account.blitzGames;
  const baselinePuzzleGames = account.baselinePuzzleGames ?? account.puzzleGames ?? 0;

  return {
    ...account,
    rapidGames: Math.max(account.rapidGames, baselineRapidGames + rapidPlayed),
    blitzGames: Math.max(account.blitzGames, baselineBlitzGames + blitzPlayed),
    puzzleGames: Math.max(account.puzzleGames ?? 0, baselinePuzzleGames + puzzleActivity.length),
    rapidWins,
    blitzWins,
    puzzleCorrect,
    lastGameSyncAt: end.toISOString(),
    lastPuzzleSyncAt: end.toISOString(),
    updatedAt: end.toISOString()
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { previousAccount?: StudentLichessAccount };
  const cookieStore = await cookies();
  const session = readStudentSession(cookieStore);
  if (!session) return NextResponse.json({ error: "Student log in required." }, { status: 401 });

  const encryptedToken = cookieStore.get(LICHESS_TOKEN_COOKIE)?.value;
  const token = encryptedToken ? decryptLichessToken(encryptedToken) : null;
  if (!token || token.startsWith("mock-token-")) {
    const profile = createMockLichessProfile(session.lichessUsername);
    const account = withLichessActivityBaseline(profileToAccount(session.studentId, profile, "mock"), body.previousAccount);
    return NextResponse.json({
      mode: "mock",
      account,
      message: "Mock Lichess log in is active. Local Blitz, Rapid, and Puzzle ratings were refreshed."
    });
  }

  const profile = await fetchAuthenticatedLichessAccount(token);
  const account = await enrichAccountActivity(
    withLichessActivityBaseline(profileToAccount(session.studentId, profile, "connected"), body.previousAccount),
    token
  );
  return NextResponse.json({
    mode: "connected",
    account,
    message: "Synced Blitz, Rapid, Puzzle ratings, rated games, wins, and correct puzzles from Lichess."
  });
}
