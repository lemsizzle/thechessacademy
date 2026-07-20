import { parseLichessPuzzleActivityNdjson, summarizePuzzleThemes } from "@/lib/lichess";
import { ADMIN_SESSION_COOKIE, isValidAdminActionToken, isValidAdminSession } from "@/lib/auth/adminSession";
import { LICHESS_TOKEN_COOKIE } from "@/lib/auth/roles";
import { fetchStudentPuzzleActivityForWindow } from "@/lib/lichess/fetchStudentPuzzleActivityForWindow";
import { formatCooldown, isLichessRateLimitError } from "@/lib/lichess/rateLimit";
import { getStoredLichessAccount, saveStoredLichessAccount } from "@/lib/lichess/supabaseAccounts";
import { getCooldownSeconds, getLichessSyncState, recordLichessSyncAttempt, recordLichessSyncRateLimit, recordLichessSyncSuccess } from "@/lib/lichess/syncState";
import { decryptLichessToken } from "@/lib/lichess/tokenCrypto";
import { withLichessActivityBaseline } from "@/lib/lichessXp";
import { syncRatings } from "@/lib/lichess/syncRatings";
import type { LichessQuestPuzzleActivity, StudentLichessAccount } from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const authorized = await isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)
    || await isValidAdminActionToken(request.headers.get("x-admin-action-token"));
  if (!authorized) return NextResponse.json({ error: "Teacher log in required." }, { status: 401 });
  const { username, studentId, includePuzzles = true, previousAccount } = await request.json().catch(() => ({ username: "" })) as {
    username?: string;
    studentId?: string;
    includePuzzles?: boolean;
    previousAccount?: StudentLichessAccount;
  };
  const safeUsername = username?.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeUsername) return NextResponse.json({ error: "Missing Lichess username" }, { status: 400 });
  const safeStudentId = studentId?.trim().replace(/[^a-zA-Z0-9_-]/g, "") || safeUsername;
  const state = await getLichessSyncState(safeStudentId);
  const cooldownSeconds = getCooldownSeconds(state);
  if (cooldownSeconds > 0) {
    return NextResponse.json({
      error: `Lichess rate limit reached. Try again in ${formatCooldown(cooldownSeconds)}.`,
      cooldownSeconds,
      syncState: state
    }, { status: 429 });
  }

  const encryptedToken = cookieStore.get(LICHESS_TOKEN_COOKIE)?.value ?? cookieStore.get("lichess_access_token")?.value;
  const token = encryptedToken ? decryptLichessToken(encryptedToken) ?? encryptedToken : null;
  let ndjson = "";
  let mode: "connected" | "error" = "error";
  let connectedPuzzleActivity: LichessQuestPuzzleActivity[] = [];
  let ratings: Awaited<ReturnType<typeof syncRatings>>;
  let requestCount = 0;
  try {
    await recordLichessSyncAttempt(safeStudentId, safeUsername);
    requestCount += 1;
    ratings = await syncRatings(safeStudentId, safeUsername);
  } catch (error) {
    if (isLichessRateLimitError(error)) {
      await recordLichessSyncRateLimit(safeStudentId, safeUsername, error.message, error.retryAfterSeconds);
      return NextResponse.json({
        error: `Lichess rate limit reached. Try again in ${formatCooldown(error.retryAfterSeconds)}.`,
        cooldownSeconds: error.retryAfterSeconds,
        requestCount
      }, { status: 429 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not sync Lichess ratings." }, { status: 502 });
  }
  const storedAccount = await getStoredLichessAccount(safeStudentId);
  let account = withLichessActivityBaseline(ratings.account, storedAccount ?? previousAccount);
  const start = new Date(account.activityBaselineSetAt ?? account.linkedAt);
  const end = new Date();

  if (includePuzzles && token) {
    try {
      requestCount += 1;
      const puzzleActivity = await fetchStudentPuzzleActivityForWindow(token, start, end);
      connectedPuzzleActivity = puzzleActivity;
      ndjson = puzzleActivity
        .map((activity) => JSON.stringify({
          date: activity.date,
          puzzle: { id: activity.puzzleId, themes: activity.themes },
          win: activity.win
        }))
        .join("\n");
      account = {
        ...account,
        baselinePuzzleGames: Math.max(0, (account.puzzleGames ?? 0) - puzzleActivity.length),
        baselinePuzzleCorrect: 0,
        puzzleGames: account.puzzleGames ?? 0,
        puzzleCorrect: puzzleActivity.filter((activity) => activity.win).length,
        lastPuzzleSyncAt: end.toISOString(),
        updatedAt: end.toISOString()
      };
      mode = "connected";
    } catch (error) {
      if (isLichessRateLimitError(error)) {
        await recordLichessSyncRateLimit(safeStudentId, safeUsername, error.message, error.retryAfterSeconds);
        return NextResponse.json({
          error: `Lichess rate limit reached. Try again in ${formatCooldown(error.retryAfterSeconds)}.`,
          cooldownSeconds: error.retryAfterSeconds,
          requestCount
        }, { status: 429 });
      }
      ndjson = "";
    }
  }

  const activities = parseLichessPuzzleActivityNdjson(ndjson);
  const solvedActivities = connectedPuzzleActivity.length
    ? connectedPuzzleActivity.filter((activity) => activity.win).map((activity) => ({
      puzzleId: activity.puzzleId,
      date: activity.date,
      themes: activity.themes
    }))
    : activities;
  const counts = Array.from(summarizePuzzleThemes(solvedActivities).entries()).map(([tacticTheme, puzzlesSolved]) => ({ tacticTheme, puzzlesSolved }));

  await recordLichessSyncSuccess(safeStudentId, safeUsername, requestCount);
  account = await saveStoredLichessAccount(account);
  return NextResponse.json({
    mode: ratings.mode === "connected" || mode === "connected" ? "connected" : "error",
    username: safeUsername,
    activityCount: activities.length,
    counts,
    ratings: account,
    requestCount,
    message: [
      ratings.message,
      includePuzzles && mode === "connected" ? "Synced Lichess puzzle activity." : ""
    ].filter(Boolean).join(" ")
  });
}
