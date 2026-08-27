import { NextRequest, NextResponse } from "next/server";
import { validatePuzzleMove } from "@/lib/puzzle-training/engine";
import { preparePublicTrainingPuzzle } from "@/lib/puzzle-training/publicPuzzle";
import { assertPuzzleTokenStudent, createPuzzleSessionToken, readPuzzleSessionToken } from "@/lib/puzzle-training/sessionToken";
import {
  awardDailyTrainingPuzzle,
  getTrainingPuzzle,
  requirePuzzleSessionStudent,
  requirePuzzleStudent,
  saveTrainingAttempt,
  selectTrainingPuzzle
} from "@/lib/puzzle-training/server";
import { parsePuzzleLevel, type PuzzleMoveInput } from "@/lib/puzzle-training/types";

export const dynamic = "force-dynamic";

const NEXT_PUZZLE_BUDGET_MS = 500;
const MINIMUM_CHAINED_AUTHORIZATION_MS = 5 * 60 * 1000;

type SettledWithin<T> =
  | { status: "fulfilled"; value: T }
  | { status: "rejected"; error: unknown }
  | { status: "timeout" };

async function settleWithin<T>(promise: Promise<T>, milliseconds: number): Promise<SettledWithin<T>> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const result = await Promise.race<SettledWithin<T>>([
    promise.then(
      (value) => ({ status: "fulfilled", value }),
      (error) => ({ status: "rejected", error })
    ),
    new Promise<SettledWithin<T>>((resolve) => {
      timeout = setTimeout(() => resolve({ status: "timeout" }), milliseconds);
    })
  ]);
  if (timeout) clearTimeout(timeout);
  return result;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const requestStartedAt = performance.now();
  try {
    const body = await request.json() as {
      token?: string;
      move?: PuzzleMoveInput;
      requestNextPuzzle?: boolean;
      nextPuzzleId?: string;
      nextLevel?: string;
      excludePuzzleIds?: string[];
    };
    if (!body.token || !body.move?.from || !body.move?.to) return NextResponse.json({ error: "Puzzle token and move are required." }, { status: 400 });

    const payload = readPuzzleSessionToken(body.token);
    const [student, legacyPuzzle] = await Promise.all([
      payload.version === 2 ? requirePuzzleSessionStudent() : requirePuzzleStudent(),
      payload.version === 2 ? Promise.resolve(null) : getTrainingPuzzle(payload.puzzleId)
    ]);
    assertPuzzleTokenStudent(payload, student.studentId);
    const puzzle = payload.version === 2 ? payload.puzzle : legacyPuzzle;
    if (!puzzle) return NextResponse.json({ error: "Puzzle is no longer available." }, { status: 404 });

    const validation = validatePuzzleMove(puzzle, payload.nextMoveIndex, body.move);
    const nextPayload = {
      ...payload,
      nextMoveIndex: validation.nextMoveIndex,
      incorrectMoveCount: payload.incorrectMoveCount + (validation.accepted ? 0 : 1)
    };
    const token = createPuzzleSessionToken(nextPayload);

    if (!validation.accepted) {
      const response = NextResponse.json({
        accepted: false,
        completed: false,
        token,
        positionFen: validation.positionFen,
        message: "That move is not the solution. Try again."
      });
      response.headers.set("Server-Timing", `total;dur=${(performance.now() - requestStartedAt).toFixed(1)}`);
      return response;
    }

    if (validation.completed) {
      const attemptInput = {
        studentId: student.studentId,
        puzzleId: puzzle.id,
        sessionId: payload.sessionId,
        selectedTheme: payload.selectedTheme,
        trainingMode: payload.trainingMode,
        solved: true,
        incorrectMoveCount: payload.incorrectMoveCount,
        hintsUsed: payload.hintsUsed,
        startedAt: payload.startedAt
      };
      const savePromise = saveTrainingAttempt(attemptInput);
      const canChainAuthorization = payload.version === 1
        || Date.parse(payload.expiresAt) - Date.now() > MINIMUM_CHAINED_AUTHORIZATION_MS;
      const nextPuzzlePromise = body.requestNextPuzzle && !payload.dailyDate && canChainAuthorization
        ? (body.nextPuzzleId
          ? getTrainingPuzzle(body.nextPuzzleId)
          : selectTrainingPuzzle(
            student.studentId,
            payload.selectedTheme,
            parsePuzzleLevel(body.nextLevel ?? null),
            Array.isArray(body.excludePuzzleIds) ? body.excludePuzzleIds : []
          ))
        : null;

      if (payload.dailyDate) {
        const [saved, dailyReward, nextPuzzleRow] = await Promise.all([
          savePromise,
          awardDailyTrainingPuzzle(student.studentId, puzzle.id, payload.dailyDate),
          nextPuzzlePromise
        ]);
        const nextPuzzle = nextPuzzleRow ? preparePublicTrainingPuzzle({
          puzzle: nextPuzzleRow,
          studentId: student.studentId,
          sessionId: payload.sessionId,
          selectedTheme: payload.selectedTheme,
          trainingMode: payload.trainingMode
        }) : undefined;
        const response = NextResponse.json({
          accepted: true,
          completed: true,
          token,
          studentFen: validation.studentFen,
          positionFen: validation.positionFen,
          message: dailyReward.awarded ? "Puzzle solved! You earned 10 XP and 10 Academy Coins." : "Puzzle solved!",
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
        response.headers.set("Server-Timing", `total;dur=${(performance.now() - requestStartedAt).toFixed(1)}`);
        return response;
      }

      const [saved, nextPuzzleResult] = await Promise.all([
        savePromise,
        nextPuzzlePromise ? settleWithin(nextPuzzlePromise, NEXT_PUZZLE_BUDGET_MS) : Promise.resolve(null)
      ]);

      const nextPuzzleRow = nextPuzzleResult?.status === "fulfilled" ? nextPuzzleResult.value : null;
      const nextPuzzle = nextPuzzleRow ? preparePublicTrainingPuzzle({
        puzzle: nextPuzzleRow,
        studentId: student.studentId,
        sessionId: payload.sessionId,
        selectedTheme: payload.selectedTheme,
        trainingMode: payload.trainingMode,
        authorizationExpiresAt: payload.version === 2 ? payload.expiresAt : undefined
      }) : undefined;
      const response = NextResponse.json({
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
        },
        nextPuzzle
      });
      const totalMs = performance.now() - requestStartedAt;
      response.headers.set("Server-Timing", `total;dur=${totalMs.toFixed(1)}`);
      if (totalMs >= 250 || (nextPuzzleResult && nextPuzzleResult.status !== "fulfilled")) {
        console.info(JSON.stringify({
          event: "puzzle_move_timing",
          requestId,
          trainingMode: payload.trainingMode,
          completed: true,
          totalMs: Math.round(totalMs),
          saveStatus: "fulfilled",
          prefetchStatus: nextPuzzleResult?.status ?? "not-requested",
          prefetchError: nextPuzzleResult?.status === "rejected" ? errorMessage(nextPuzzleResult.error) : undefined
        }));
      }
      return response;
    }

    const response = NextResponse.json({
      accepted: true,
      completed: false,
      token,
      studentFen: validation.studentFen,
      positionFen: validation.positionFen,
      opponentMove: validation.opponentMove,
      message: "Correct. Watch the reply, then keep going."
    });
    const totalMs = performance.now() - requestStartedAt;
    response.headers.set("Server-Timing", `total;dur=${totalMs.toFixed(1)}`);
    if (totalMs >= 250) {
      console.info(JSON.stringify({
        event: "puzzle_move_timing",
        requestId,
        trainingMode: payload.trainingMode,
        completed: false,
        tokenVersion: payload.version,
        totalMs: Math.round(totalMs)
      }));
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Move validation failed.";
    const status = /log in|session|token|profile/i.test(message) ? 401 : 500;
    console.error(JSON.stringify({
      event: "puzzle_move_failed",
      requestId,
      totalMs: Math.round(performance.now() - requestStartedAt),
      error: message
    }));
    return NextResponse.json({ error: message }, { status });
  }
}
