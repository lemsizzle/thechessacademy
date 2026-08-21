import { NextRequest, NextResponse } from "next/server";
import { validatePuzzleMove } from "@/lib/puzzle-training/engine";
import { preparePublicTrainingPuzzle } from "@/lib/puzzle-training/publicPuzzle";
import { assertPuzzleTokenStudent, createPuzzleSessionToken, readPuzzleSessionToken } from "@/lib/puzzle-training/sessionToken";
import { awardDailyTrainingPuzzle, getTrainingPuzzle, requirePuzzleStudent, saveTrainingAttempt, selectTrainingPuzzle } from "@/lib/puzzle-training/server";
import { parsePuzzleLevel, type PuzzleMoveInput } from "@/lib/puzzle-training/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      token?: string;
      move?: PuzzleMoveInput;
      requestNextPuzzle?: boolean;
      nextLevel?: string;
      excludePuzzleIds?: string[];
    };
    if (!body.token || !body.move?.from || !body.move?.to) return NextResponse.json({ error: "Puzzle token and move are required." }, { status: 400 });
    const payload = readPuzzleSessionToken(body.token);
    const [student, puzzle] = await Promise.all([
      requirePuzzleStudent(),
      getTrainingPuzzle(payload.puzzleId)
    ]);
    assertPuzzleTokenStudent(payload, student.studentId);
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
      const savePromise = saveTrainingAttempt({
        studentId: student.studentId,
        puzzleId: puzzle.id,
        sessionId: payload.sessionId,
        selectedTheme: payload.selectedTheme,
        solved: true,
        incorrectMoveCount: payload.incorrectMoveCount,
        hintsUsed: payload.hintsUsed,
        startedAt: payload.startedAt
      });
      const dailyRewardPromise = payload.dailyDate
        ? awardDailyTrainingPuzzle(student.studentId, puzzle.id, payload.dailyDate)
        : Promise.resolve(undefined);
      const nextPuzzlePromise = body.requestNextPuzzle && !payload.dailyDate
        ? selectTrainingPuzzle(
          student.studentId,
          payload.selectedTheme,
          parsePuzzleLevel(body.nextLevel ?? null),
          Array.isArray(body.excludePuzzleIds) ? body.excludePuzzleIds : []
        )
        : null;
      const [saved, dailyReward, nextPuzzleRow] = await Promise.all([
        savePromise,
        dailyRewardPromise,
        nextPuzzlePromise
      ]);
      const nextPuzzle = nextPuzzleRow ? preparePublicTrainingPuzzle({
        puzzle: nextPuzzleRow,
        studentId: student.studentId,
        sessionId: payload.sessionId,
        selectedTheme: payload.selectedTheme
      }) : undefined;
      return NextResponse.json({
        accepted: true,
        completed: true,
        token,
        studentFen: validation.studentFen,
        positionFen: validation.positionFen,
        message: dailyReward?.awarded ? "Puzzle solved! You earned 10 XP and 10 Academy Coins." : "Puzzle solved!",
        completion: {
          themes: puzzle.themes,
          rating: puzzle.rating,
          gameUrl: puzzle.game_url,
          mistakes: payload.incorrectMoveCount,
          hintsUsed: payload.hintsUsed,
          elapsedSeconds: saved.elapsedSeconds,
          dailyReward
        },
        nextPuzzle
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
