import { NextRequest, NextResponse } from "next/server";
import { validatePuzzleMove } from "@/lib/puzzle-training/engine";
import { assertPuzzleTokenStudent, createPuzzleSessionToken, readPuzzleSessionToken } from "@/lib/puzzle-training/sessionToken";
import { getTrainingPuzzle, requirePuzzleStudent, saveTrainingAttempt } from "@/lib/puzzle-training/server";
import type { PuzzleMoveInput } from "@/lib/puzzle-training/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const student = await requirePuzzleStudent();
    const body = await request.json() as { token?: string; move?: PuzzleMoveInput };
    if (!body.token || !body.move?.from || !body.move?.to) return NextResponse.json({ error: "Puzzle token and move are required." }, { status: 400 });
    const payload = readPuzzleSessionToken(body.token);
    assertPuzzleTokenStudent(payload, student.studentId);
    const puzzle = await getTrainingPuzzle(payload.puzzleId);
    if (!puzzle) return NextResponse.json({ error: "Puzzle is no longer available." }, { status: 404 });

    const validation = validatePuzzleMove(puzzle, payload.nextMoveIndex, body.move);
    const nextPayload = {
      ...payload,
      nextMoveIndex: validation.nextMoveIndex,
      incorrectMoveCount: payload.incorrectMoveCount + (validation.accepted ? 0 : 1)
    };
    const token = createPuzzleSessionToken(nextPayload);

    if (!validation.accepted) {
      return NextResponse.json({
        accepted: false,
        completed: false,
        token,
        positionFen: validation.positionFen,
        message: "That move is not the solution. Try again."
      });
    }

    if (validation.completed) {
      const saved = await saveTrainingAttempt({
        studentId: student.studentId,
        puzzleId: puzzle.id,
        sessionId: payload.sessionId,
        selectedTheme: payload.selectedTheme,
        solved: true,
        incorrectMoveCount: payload.incorrectMoveCount,
        hintsUsed: payload.hintsUsed,
        startedAt: payload.startedAt
      });
      return NextResponse.json({
        accepted: true,
        completed: true,
        token,
        studentFen: validation.studentFen,
        positionFen: validation.positionFen,
        message: "Puzzle solved!",
        completion: {
          themes: puzzle.themes,
          rating: puzzle.rating,
          gameUrl: puzzle.game_url,
          mistakes: payload.incorrectMoveCount,
          hintsUsed: payload.hintsUsed,
          elapsedSeconds: saved.elapsedSeconds
        }
      });
    }

    return NextResponse.json({
      accepted: true,
      completed: false,
      token,
      studentFen: validation.studentFen,
      positionFen: validation.positionFen,
      opponentMove: validation.opponentMove,
      message: "Correct. Watch the reply, then keep going."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Move validation failed.";
    const status = /log in|session|token|profile/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
