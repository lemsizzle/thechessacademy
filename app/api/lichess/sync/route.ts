import { getMockLichessNdjson, parseLichessPuzzleActivityNdjson, summarizePuzzleThemes } from "@/lib/lichess";
import { LICHESS_TOKEN_COOKIE } from "@/lib/auth/roles";
import { decryptLichessToken } from "@/lib/lichess/tokenCrypto";
import { syncRatings } from "@/lib/lichess/syncRatings";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { username, studentId, includePuzzles = true } = await request.json().catch(() => ({ username: "" })) as {
    username?: string;
    studentId?: string;
    includePuzzles?: boolean;
  };
  const safeUsername = username?.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeUsername) return NextResponse.json({ error: "Missing Lichess username" }, { status: 400 });
  const safeStudentId = studentId?.trim().replace(/[^a-zA-Z0-9_-]/g, "") || safeUsername;

  const cookieStore = await cookies();
  const encryptedToken = cookieStore.get(LICHESS_TOKEN_COOKIE)?.value ?? cookieStore.get("lichess_access_token")?.value;
  const token = encryptedToken ? decryptLichessToken(encryptedToken) ?? encryptedToken : null;
  let ndjson = "";
  let mode: "mock" | "connected" = "mock";

  if (includePuzzles && token) {
    try {
      const response = await fetch(`https://lichess.org/api/puzzle/activity?max=100`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/x-ndjson" },
        cache: "no-store"
      });
      if (response.status === 429) {
        ndjson = "";
        mode = "mock";
      }
      if (response.ok) {
        ndjson = await response.text();
        mode = "connected";
      }
    } catch {
      ndjson = "";
    }
  }

  if (includePuzzles && !ndjson) ndjson = getMockLichessNdjson(safeUsername);
  const activities = parseLichessPuzzleActivityNdjson(ndjson);
  const counts = Array.from(summarizePuzzleThemes(activities).entries()).map(([tacticTheme, puzzlesSolved]) => ({ tacticTheme, puzzlesSolved }));
  const ratings = await syncRatings(safeStudentId, safeUsername);

  return NextResponse.json({
    mode: ratings.mode === "connected" || mode === "connected" ? "connected" : "mock",
    username: safeUsername,
    activityCount: activities.length,
    counts,
    ratings: ratings.account,
    message: [
      ratings.message,
      includePuzzles ? (mode === "connected" ? "Synced Lichess puzzle activity." : "Used mock Lichess puzzle activity fallback.") : ""
    ].filter(Boolean).join(" ")
  });
}
