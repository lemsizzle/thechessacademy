import { firstStudentMoveIndex, prepareTrainingPuzzle } from "@/lib/puzzle-training/engine";
import { DAILY_PUZZLE_COINS, DAILY_PUZZLE_XP } from "@/lib/puzzle-training/daily";
import { createPuzzleSessionToken } from "@/lib/puzzle-training/sessionToken";
import type { ChessPuzzleRow, PublicTrainingPuzzle, PuzzleThemeSlug, PuzzleTrainingMode } from "@/lib/puzzle-training/types";

type DailyPuzzleDetails = {
  puzzleDate: string;
  rewardClaimed: boolean;
};

export function preparePublicTrainingPuzzle(input: {
  puzzle: ChessPuzzleRow;
  studentId: string;
  sessionId: string;
  selectedTheme: PuzzleThemeSlug;
  trainingMode: PuzzleTrainingMode;
  daily?: DailyPuzzleDetails | null;
  authorizationExpiresAt?: string;
}): PublicTrainingPuzzle {
  const prepared = prepareTrainingPuzzle(input.puzzle);
  const startedAt = new Date();
  const token = createPuzzleSessionToken({
    version: 2,
    puzzleId: input.puzzle.id,
    studentId: input.studentId,
    sessionId: input.sessionId,
    selectedTheme: input.selectedTheme,
    trainingMode: input.trainingMode,
    dailyDate: input.daily?.puzzleDate,
    nextMoveIndex: firstStudentMoveIndex(input.puzzle),
    startedAt: startedAt.toISOString(),
    expiresAt: input.authorizationExpiresAt ?? new Date(startedAt.getTime() + (2 * 60 * 60 * 1000)).toISOString(),
    incorrectMoveCount: 0,
    hintsUsed: 0,
    puzzle: {
      id: input.puzzle.id,
      initial_fen: input.puzzle.initial_fen,
      moves: input.puzzle.moves,
      start_mode: input.puzzle.start_mode,
      accepted_moves: input.puzzle.accepted_moves,
      themes: input.puzzle.themes,
      rating: input.puzzle.rating,
      game_url: input.puzzle.game_url
    }
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
