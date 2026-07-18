import { NextRequest, NextResponse } from "next/server";
import { prepareLichessPuzzle } from "@/lib/puzzle-training/engine";
import { createPuzzleSessionToken } from "@/lib/puzzle-training/sessionToken";
import { requirePuzzleStudent, selectTrainingPuzzle } from "@/lib/puzzle-training/server";
import { parsePuzzleTheme } from "@/lib/puzzle-training/types";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  try {
    const student = await requirePuzzleStudent();
    const theme = parsePuzzleTheme(request.nextUrl.searchParams.get("theme"));
    const excluded = (request.nextUrl.searchParams.get("exclude") ?? "").split(",").filter(Boolean);
    const requestedSessionId = request.nextUrl.searchParams.get("sessionId") ?? "";
    const sessionId = UUID_PATTERN.test(requestedSessionId) ? requestedSessionId : crypto.randomUUID();
    const puzzle = await selectTrainingPuzzle(student.studentId, theme, excluded);
    if (!puzzle) {
      return NextResponse.json({ error: "No imported puzzles are available for this theme yet." }, { status: 404 });
    }

    const prepared = prepareLichessPuzzle(puzzle.initial_fen, puzzle.moves);
    const token = createPuzzleSessionToken({
      version: 1,
      puzzleId: puzzle.id,
      studentId: student.studentId,
      sessionId,
      selectedTheme: theme,
      nextMoveIndex: 1,
      startedAt: new Date().toISOString(),
      incorrectMoveCount: 0,
      hintsUsed: 0
    });

    return NextResponse.json({
      puzzle: {
        id: puzzle.id,
        displayFen: prepared.displayFen,
        orientation: prepared.orientation,
        sideToMove: prepared.sideToMove,
        token
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Puzzle training is unavailable.";
    const status = /log in|required|session|profile/i.test(message) ? 401 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
