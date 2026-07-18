import { NextRequest, NextResponse } from "next/server";
import { parseUciMove } from "@/lib/puzzle-training/engine";
import { assertPuzzleTokenStudent, createPuzzleSessionToken, readPuzzleSessionToken } from "@/lib/puzzle-training/sessionToken";
import { getTrainingPuzzle, requirePuzzleStudent } from "@/lib/puzzle-training/server";

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
    const expected = parseUciMove(puzzle.moves[payload.nextMoveIndex]);
    const nextHintCount = Math.min(2, payload.hintsUsed + 1);
    const token = createPuzzleSessionToken({ ...payload, hintsUsed: nextHintCount });
    return NextResponse.json({
      token,
      hint: nextHintCount === 1 ? { source: expected.from } : { source: expected.from, destination: expected.to },
      hintsUsed: nextHintCount
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hint is unavailable.";
    return NextResponse.json({ error: message }, { status: /log in|session|token/i.test(message) ? 401 : 500 });
  }
}
