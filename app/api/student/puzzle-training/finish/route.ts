import { NextRequest, NextResponse } from "next/server";
import { assertPuzzleTokenStudent, readPuzzleSessionToken } from "@/lib/puzzle-training/sessionToken";
import { getTrainingPuzzle, requirePuzzleStudent, saveTrainingAttempt } from "@/lib/puzzle-training/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const student = await requirePuzzleStudent();
    const body = await request.json() as { token?: string };
    if (!body.token) return NextResponse.json({ error: "Puzzle token is required." }, { status: 400 });
    const payload = readPuzzleSessionToken(body.token);
    assertPuzzleTokenStudent(payload, student.studentId);
    const puzzle = await getTrainingPuzzle(payload.puzzleId);
    if (!puzzle) return NextResponse.json({ error: "Puzzle is no longer available." }, { status: 404 });
    await saveTrainingAttempt({
      studentId: student.studentId,
      puzzleId: puzzle.id,
      sessionId: payload.sessionId,
      selectedTheme: payload.selectedTheme,
      solved: false,
      incorrectMoveCount: payload.incorrectMoveCount,
      hintsUsed: payload.hintsUsed,
      startedAt: payload.startedAt
    });
    return NextResponse.json({ saved: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Attempt could not be saved.";
    return NextResponse.json({ error: message }, { status: /log in|session|token/i.test(message) ? 401 : 500 });
  }
}
