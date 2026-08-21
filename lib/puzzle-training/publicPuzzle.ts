import { firstStudentMoveIndex, prepareTrainingPuzzle } from "@/lib/puzzle-training/engine";
import { DAILY_PUZZLE_COINS, DAILY_PUZZLE_XP } from "@/lib/puzzle-training/daily";
import { createPuzzleSessionToken } from "@/lib/puzzle-training/sessionToken";
import type { ChessPuzzleRow, PublicTrainingPuzzle, PuzzleThemeSlug } from "@/lib/puzzle-training/types";

type DailyPuzzleDetails = {
  puzzleDate: string;
  rewardClaimed: boolean;
};

export function preparePublicTrainingPuzzle(input: {
  puzzle: ChessPuzzleRow;
  studentId: string;
  sessionId: string;
  selectedTheme: PuzzleThemeSlug;
  daily?: DailyPuzzleDetails | null;
}): PublicTrainingPuzzle {
  const prepared = prepareTrainingPuzzle(input.puzzle);
  const token = createPuzzleSessionToken({
    version: 1,
    puzzleId: input.puzzle.id,
    studentId: input.studentId,
    sessionId: input.sessionId,
    selectedTheme: input.selectedTheme,
    dailyDate: input.daily?.puzzleDate,
    nextMoveIndex: firstStudentMoveIndex(input.puzzle),
    startedAt: new Date().toISOString(),
    incorrectMoveCount: 0,
    hintsUsed: 0
  });

  return {
    id: input.puzzle.id,
    displayFen: prepared.displayFen,
    orientation: prepared.orientation,
    sideToMove: prepared.sideToMove,
    prompt: input.puzzle.teacher_prompt,
    sourceKind: input.puzzle.source_kind,
    token,
    daily: input.daily ? {
      date: input.daily.puzzleDate,
      rewardClaimed: input.daily.rewardClaimed,
      xp: DAILY_PUZZLE_XP,
      coins: DAILY_PUZZLE_COINS
    } : null
  };
}
