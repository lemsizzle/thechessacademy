import { NextRequest, NextResponse } from "next/server";
import { firstStudentMoveIndex, prepareTrainingPuzzle } from "@/lib/puzzle-training/engine";
import { createPuzzleSessionToken } from "@/lib/puzzle-training/sessionToken";
import { getDailyTrainingPuzzle, requirePuzzleStudent, selectTrainingPuzzle } from "@/lib/puzzle-training/server";
import { DAILY_PUZZLE_COINS, DAILY_PUZZLE_XP } from "@/lib/puzzle-training/daily";
import { parsePuzzleLevel, parsePuzzleTheme } from "@/lib/puzzle-training/types";

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
    const daily = isDaily ? await getDailyTrainingPuzzle(student.studentId) : null;
    const puzzle = isDaily ? daily?.puzzle : await selectTrainingPuzzle(student.studentId, theme, level, excluded);
    if (!puzzle) {
      return NextResponse.json({ error: "No imported puzzles match this level and tactic yet." }, { status: 404 });
    }

    const prepared = prepareTrainingPuzzle(puzzle);
    const token = createPuzzleSessionToken({
      version: 1,
      puzzleId: puzzle.id,
      studentId: student.studentId,
      sessionId,
      selectedTheme: theme,
      dailyDate: daily?.puzzleDate,
      nextMoveIndex: firstStudentMoveIndex(puzzle),
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
        prompt: puzzle.teacher_prompt,
        sourceKind: puzzle.source_kind,
        token,
        daily: daily ? {
          date: daily.puzzleDate,
          rewardClaimed: daily.rewardClaimed,
          xp: DAILY_PUZZLE_XP,
          coins: DAILY_PUZZLE_COINS
        } : null
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Puzzle training is unavailable.";
    const status = /log in|required|session|profile/i.test(message) ? 401 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
