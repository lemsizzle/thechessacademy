import { LICHESS_TOKEN_COOKIE } from "@/lib/auth/roles";
import { readStudentSession } from "@/lib/auth/session";
import { fetchAuthenticatedLichessAccount } from "@/lib/lichess/fetchAccount";
import { fetchStudentGamesForWindow } from "@/lib/lichess/fetchStudentGamesForWindow";
import { fetchStudentPuzzleActivityForWindow } from "@/lib/lichess/fetchStudentPuzzleActivityForWindow";
import { formatCooldown, isLichessRateLimitError } from "@/lib/lichess/rateLimit";
import { getStoredLichessAccount, saveStoredLichessAccount } from "@/lib/lichess/supabaseAccounts";
import { getCooldownSeconds, getLichessSyncState, recordLichessSyncAttempt, recordLichessSyncRateLimit, recordLichessSyncSuccess } from "@/lib/lichess/syncState";
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

function baselineFromFetchedActivity(currentTotal: number | undefined | null, fetchedSinceBaseline: number) {
  return Math.max(0, (currentTotal ?? 0) - fetchedSinceBaseline);
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

  let hitGameRateLimit = false;
  let rapidGames: Awaited<ReturnType<typeof fetchStudentGamesForWindow>> = [];
  let blitzGames: Awaited<ReturnType<typeof fetchStudentGamesForWindow>> = [];
  let puzzleActivity: Awaited<ReturnType<typeof fetchStudentPuzzleActivityForWindow>> = [];

  try {
    rapidGames = await fetchStudentGamesForWindow(account.lichessUsername, start, end, "rapid", token);
  } catch (error) {
    hitGameRateLimit = error instanceof Error && error.message.toLowerCase().includes("rate-limiting");
  }
  if (!hitGameRateLimit) {
    try {
      blitzGames = await fetchStudentGamesForWindow(account.lichessUsername, start, end, "blitz", token);
    } catch {
      // Lichess game activity can be rate-limited while ratings and puzzles still update.
    }
  }
  try {
    puzzleActivity = await fetchStudentPuzzleActivityForWindow(token, start, end);
  } catch {
    // Puzzle activity can be unavailable while ratings still update.
  }

  rapidGames = rapidGames.filter((game) => game.rated && game.finished);
  blitzGames = blitzGames.filter((game) => game.rated && game.finished);
  const rapidPlayed = rapidGames.length;
  const blitzPlayed = blitzGames.length;
  const rapidWins = rapidGames.filter((game) => game.won).length;
  const blitzWins = blitzGames.filter((game) => game.won).length;
  const puzzleCorrect = puzzleActivity.filter((puzzle) => puzzle.win).length;
  const baselineRapidGames = baselineFromFetchedActivity(account.rapidGames, rapidPlayed);
  const baselineBlitzGames = baselineFromFetchedActivity(account.blitzGames, blitzPlayed);
  const baselinePuzzleGames = baselineFromFetchedActivity(account.puzzleGames, puzzleActivity.length);

  return {
    ...account,
    baselineRapidGames,
    baselineBlitzGames,
    baselinePuzzleGames,
    baselineRapidWins: 0,
    baselineBlitzWins: 0,
    baselinePuzzleCorrect: 0,
    rapidGames: account.rapidGames,
    blitzGames: account.blitzGames,
    puzzleGames: account.puzzleGames ?? 0,
    rapidWins,
    blitzWins,
    puzzleCorrect,
    lastGameSyncAt: end.toISOString(),
    lastPuzzleSyncAt: end.toISOString(),
    updatedAt: end.toISOString()
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { previousAccount?: StudentLichessAccount; includeActivity?: boolean };
  const cookieStore = await cookies();
  const session = readStudentSession(cookieStore);
  if (!session) return NextResponse.json({ error: "Student log in required." }, { status: 401 });

  const encryptedToken = cookieStore.get(LICHESS_TOKEN_COOKIE)?.value;
  const token = encryptedToken ? decryptLichessToken(encryptedToken) : null;
  if (!token) {
    return NextResponse.json({ error: "A real Lichess login is required before syncing live stats." }, { status: 401 });
  }

  const existingState = await getLichessSyncState(session.studentId);
  const cooldownSeconds = getCooldownSeconds(existingState);
  if (cooldownSeconds > 0) {
    return NextResponse.json({
      error: `Lichess rate limit reached. Try again in ${formatCooldown(cooldownSeconds)}.`,
      cooldownSeconds,
      syncState: existingState
    }, { status: 429 });
  }

  let requestCount = 0;
  try {
    await recordLichessSyncAttempt(session.studentId, session.lichessUsername);
    requestCount += 1;
    const profile = await fetchAuthenticatedLichessAccount(token);
    const storedAccount = await getStoredLichessAccount(session.studentId);
    const accountWithBaseline = withLichessActivityBaseline(
      profileToAccount(session.studentId, profile, "connected"),
      storedAccount ?? body.previousAccount
    );
    const trustedBaseline = existingState?.createdAt ?? accountWithBaseline.activityBaselineSetAt ?? accountWithBaseline.linkedAt;
    const baseAccount = {
      ...accountWithBaseline,
      activityBaselineSetAt: trustedBaseline,
      linkedAt: trustedBaseline
    };
    const account = body.includeActivity === true ? await enrichAccountActivity(baseAccount, token) : baseAccount;
    const savedAccount = await saveStoredLichessAccount(account);
    await recordLichessSyncSuccess(session.studentId, profile.username, requestCount);
    return NextResponse.json({
      mode: "connected",
      account: savedAccount,
      requestCount,
      message: body.includeActivity === true
        ? "Synced Lichess profile, ratings, games, and puzzles."
        : "Synced Lichess profile and ratings. Quest activity sync runs separately."
    });
  } catch (error) {
    if (isLichessRateLimitError(error)) {
      const retryAfterSeconds = "retryAfterSeconds" in error ? error.retryAfterSeconds : 60;
      await recordLichessSyncRateLimit(session.studentId, session.lichessUsername, error.message, retryAfterSeconds);
      return NextResponse.json({
        error: `Lichess rate limit reached. Try again in ${formatCooldown(retryAfterSeconds)}.`,
        cooldownSeconds: retryAfterSeconds,
        requestCount
      }, { status: 429 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not sync Lichess profile." }, { status: 502 });
  }
}
