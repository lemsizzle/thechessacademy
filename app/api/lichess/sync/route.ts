import { getMockLichessNdjson, parseLichessPuzzleActivityNdjson, summarizePuzzleThemes } from "@/lib/lichess";
import { LICHESS_TOKEN_COOKIE } from "@/lib/auth/roles";
import { fetchStudentGamesForWindow } from "@/lib/lichess/fetchStudentGamesForWindow";
import { fetchStudentPuzzleActivityForWindow } from "@/lib/lichess/fetchStudentPuzzleActivityForWindow";
import { decryptLichessToken } from "@/lib/lichess/tokenCrypto";
import { withLichessActivityBaseline } from "@/lib/lichessXp";
import { syncRatings } from "@/lib/lichess/syncRatings";
import type { LichessQuestPuzzleActivity, StudentLichessAccount } from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { username, studentId, includePuzzles = true, previousAccount } = await request.json().catch(() => ({ username: "" })) as {
    username?: string;
    studentId?: string;
    includePuzzles?: boolean;
    previousAccount?: StudentLichessAccount;
  };
  const safeUsername = username?.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeUsername) return NextResponse.json({ error: "Missing Lichess username" }, { status: 400 });
  const safeStudentId = studentId?.trim().replace(/[^a-zA-Z0-9_-]/g, "") || safeUsername;

  const cookieStore = await cookies();
  const encryptedToken = cookieStore.get(LICHESS_TOKEN_COOKIE)?.value ?? cookieStore.get("lichess_access_token")?.value;
  const token = encryptedToken ? decryptLichessToken(encryptedToken) ?? encryptedToken : null;
  let ndjson = "";
  let mode: "mock" | "connected" = "mock";
  let connectedPuzzleActivity: LichessQuestPuzzleActivity[] = [];
  const ratings = await syncRatings(safeStudentId, safeUsername);
  let account = withLichessActivityBaseline(ratings.account, previousAccount);
  const start = new Date(account.activityBaselineSetAt ?? account.linkedAt);
  const end = new Date();

  if (includePuzzles && token) {
    try {
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
        puzzleGames: Math.max(account.puzzleGames ?? 0, (account.baselinePuzzleGames ?? account.puzzleGames ?? 0) + puzzleActivity.length),
        puzzleCorrect: puzzleActivity.filter((activity) => activity.win).length,
        lastPuzzleSyncAt: end.toISOString(),
        updatedAt: end.toISOString()
      };
      mode = "connected";
    } catch {
      ndjson = "";
    }
  }

  if (includePuzzles && !ndjson) ndjson = getMockLichessNdjson(safeUsername);
  const activities = parseLichessPuzzleActivityNdjson(ndjson);
  const solvedActivities = connectedPuzzleActivity.length
    ? connectedPuzzleActivity.filter((activity) => activity.win).map((activity) => ({
      puzzleId: activity.puzzleId,
      date: activity.date,
      themes: activity.themes
    }))
    : activities;
  const counts = Array.from(summarizePuzzleThemes(solvedActivities).entries()).map(([tacticTheme, puzzlesSolved]) => ({ tacticTheme, puzzlesSolved }));

  try {
    const [rapidResult, blitzResult] = await Promise.allSettled([
      fetchStudentGamesForWindow(safeUsername, start, end, "rapid", token),
      fetchStudentGamesForWindow(safeUsername, start, end, "blitz", token)
    ]);
    const rapidGames = rapidResult.status === "fulfilled" ? rapidResult.value.filter((game) => game.rated && game.finished) : [];
    const blitzGames = blitzResult.status === "fulfilled" ? blitzResult.value.filter((game) => game.rated && game.finished) : [];
    account = {
      ...account,
      rapidGames: Math.max(account.rapidGames, (account.baselineRapidGames ?? account.rapidGames) + rapidGames.length),
      blitzGames: Math.max(account.blitzGames, (account.baselineBlitzGames ?? account.blitzGames) + blitzGames.length),
      rapidWins: rapidGames.filter((game) => game.won).length,
      blitzWins: blitzGames.filter((game) => game.won).length,
      lastGameSyncAt: end.toISOString(),
      updatedAt: end.toISOString()
    };
    if (rapidResult.status === "fulfilled" || blitzResult.status === "fulfilled") mode = "connected";
  } catch {
    // Ratings and puzzle data can still update if public game export is unavailable.
  }

  return NextResponse.json({
    mode: ratings.mode === "connected" || mode === "connected" ? "connected" : "mock",
    username: safeUsername,
    activityCount: activities.length,
    counts,
    ratings: account,
    message: [
      ratings.message,
      mode === "connected" ? "Synced Lichess game activity." : "",
      includePuzzles ? (mode === "connected" ? "Synced Lichess puzzle activity." : "Used mock Lichess puzzle activity fallback.") : ""
    ].filter(Boolean).join(" ")
  });
}
