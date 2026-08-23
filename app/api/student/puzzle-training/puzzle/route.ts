import { NextRequest, NextResponse } from "next/server";
import { preparePublicTrainingPuzzle } from "@/lib/puzzle-training/publicPuzzle";
import { getDailyTrainingPuzzle, getTrainingPuzzle, requirePuzzleStudent, selectTrainingPuzzle } from "@/lib/puzzle-training/server";
import { parsePuzzleLevel, parsePuzzleTheme, parsePuzzleTrainingMode } from "@/lib/puzzle-training/types";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const student = await requirePuzzleStudent();
    const theme = parsePuzzleTheme(request.nextUrl.searchParams.get("theme"));
    const level = parsePuzzleLevel(request.nextUrl.searchParams.get("level"));
    const excluded = (request.nextUrl.searchParams.get("exclude") ?? "").split(",").filter(Boolean);
    const requestedSessionId = request.nextUrl.searchParams.get("sessionId") ?? "";
    const sessionId = UUID_PATTERN.test(requestedSessionId) ? requestedSessionId : crypto.randomUUID();
    const isDaily = request.nextUrl.searchParams.get("daily") === "1";
    const trainingMode = isDaily ? "daily" : parsePuzzleTrainingMode(request.nextUrl.searchParams.get("mode"));
    const requestedPuzzleId = request.nextUrl.searchParams.get("puzzleId");
    const daily = isDaily ? await getDailyTrainingPuzzle(student.studentId) : null;
    const puzzle = isDaily
      ? daily?.puzzle
      : requestedPuzzleId
        ? await getTrainingPuzzle(requestedPuzzleId)
        : await selectTrainingPuzzle(student.studentId, theme, level, excluded);
    if (!puzzle) {
      return NextResponse.json({ error: "No imported puzzles match this level and tactic yet." }, { status: 404 });
    }

    return NextResponse.json({
      puzzle: preparePublicTrainingPuzzle({
        puzzle,
        studentId: student.studentId,
        sessionId,
        selectedTheme: theme,
        trainingMode,
        daily
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Puzzle training is unavailable.";
    const status = /log in|required|session|profile/i.test(message) ? 401 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
