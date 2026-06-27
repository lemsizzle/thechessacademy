import { LICHESS_TOKEN_COOKIE } from "@/lib/auth/roles";
import { readStudentSession } from "@/lib/auth/session";
import { createMockLichessProfile, fetchAuthenticatedLichessAccount } from "@/lib/lichess/fetchAccount";
import { decryptLichessToken } from "@/lib/lichess/tokenCrypto";
import type { LichessOAuthProfile, StudentLichessAccount } from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function profileToAccount(studentId: string, profile: LichessOAuthProfile, syncStatus: StudentLichessAccount["syncStatus"]): StudentLichessAccount {
  const today = new Date().toISOString().slice(0, 10);
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
    baselineBlitzGames: profile.blitzGames,
    baselineRapidGames: profile.rapidGames,
    baselinePuzzleGames: profile.puzzleGames ?? 0,
    activityBaselineSetAt: today,
    linkedAt: today,
    lastRatingSyncAt: today,
    lastPuzzleSyncAt: today,
    syncStatus,
    createdAt: today,
    updatedAt: today
  };
}

export async function POST() {
  const cookieStore = await cookies();
  const session = readStudentSession(cookieStore);
  if (!session) return NextResponse.json({ error: "Student log in required." }, { status: 401 });

  const encryptedToken = cookieStore.get(LICHESS_TOKEN_COOKIE)?.value;
  const token = encryptedToken ? decryptLichessToken(encryptedToken) : null;
  if (!token || token.startsWith("mock-token-")) {
    const profile = createMockLichessProfile(session.lichessUsername);
    return NextResponse.json({
      mode: "mock",
      account: profileToAccount(session.studentId, profile, "mock"),
      message: "Mock Lichess log in is active. Local Blitz, Rapid, and Puzzle ratings were refreshed."
    });
  }

  const profile = await fetchAuthenticatedLichessAccount(token);
  return NextResponse.json({
    mode: "connected",
    account: profileToAccount(session.studentId, profile, "connected"),
    message: "Synced Blitz, Rapid, and Puzzle ratings from Lichess."
  });
}
