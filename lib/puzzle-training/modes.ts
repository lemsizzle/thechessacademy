import type { PuzzleLevelSlug } from "@/lib/puzzle-training/types";

export const SURVIVAL_PUZZLE_LIMIT = 50;
export const WOODPECKER_SET_SIZE = 20;
export const WOODPECKER_SET_SIZE_OPTIONS = [20, 30, 40, 50] as const;
export const WOODPECKER_MAX_SET_SIZE = WOODPECKER_SET_SIZE_OPTIONS[WOODPECKER_SET_SIZE_OPTIONS.length - 1];
export const WOODPECKER_CYCLE_COUNT = 3;

export function formatSurvivalLives(lives: number, total = 3) {
  const safeTotal = Math.max(0, Math.floor(total));
  const remaining = Math.min(safeTotal, Math.max(0, Math.floor(lives)));
  return `${"❤️".repeat(remaining)}${"🖤".repeat(safeTotal - remaining)}`;
}

export const PUZZLE_DIFFICULTY_OPTIONS: ReadonlyArray<{ id: PuzzleLevelSlug; name: string; rating: string }> = [
  { id: "all", name: "Any difficulty", rating: "600–2200" },
  { id: "beginner", name: "Very easy", rating: "600–999" },
  { id: "improver", name: "Easy", rating: "1000–1399" },
  { id: "intermediate", name: "Medium", rating: "1400–1799" },
  { id: "advanced", name: "Hard", rating: "1800–1999" },
  { id: "expert", name: "Expert", rating: "2000–2200" }
];

export const SURVIVAL_DIFFICULTY_STAGES: ReadonlyArray<{
  start: number;
  end: number;
  level: Exclude<PuzzleLevelSlug, "all">;
  name: string;
}> = [
  { start: 1, end: 10, level: "beginner", name: "Very easy" },
  { start: 11, end: 20, level: "improver", name: "Easy" },
  { start: 21, end: 30, level: "intermediate", name: "Medium" },
  { start: 31, end: 40, level: "advanced", name: "Hard" },
  { start: 41, end: 50, level: "expert", name: "Expert" }
];

export function survivalDifficultyForPuzzle(puzzleNumber: number) {
  const normalizedPuzzleNumber = Math.min(SURVIVAL_PUZZLE_LIMIT, Math.max(1, Math.floor(puzzleNumber)));
  return SURVIVAL_DIFFICULTY_STAGES.find((stage) => normalizedPuzzleNumber <= stage.end) ?? SURVIVAL_DIFFICULTY_STAGES[0];
}

export type WoodpeckerStep = {
  cycle: number;
  puzzleIndex: number;
  finished: boolean;
};

export type WoodpeckerCycleResult = {
  cycle: number;
  puzzlesSolved: number;
  incorrectMoves: number;
  elapsedSeconds: number;
  puzzlesPerMinute: number;
  accuracy: number;
  mistakePuzzleIds: string[];
  reviewed: boolean;
};

export function calculatePuzzleAccuracy(correctAttempts: number, incorrectAttempts: number) {
  const attempts = correctAttempts + incorrectAttempts;
  return attempts ? Math.round((correctAttempts / attempts) * 100) : 100;
}

export function calculateWoodpeckerCycleStats(puzzlesSolved: number, incorrectMoves: number, elapsedSeconds: number) {
  return {
    puzzlesPerMinute: Math.round((puzzlesSolved * 60 / Math.max(1, elapsedSeconds)) * 10) / 10,
    accuracy: calculatePuzzleAccuracy(puzzlesSolved, incorrectMoves)
  };
}

export function nextWoodpeckerStep(cycle: number, puzzleIndex: number, setSize: number): WoodpeckerStep {
  if (setSize < 1) {
    return { cycle: 1, puzzleIndex: 0, finished: true };
  }

  if (puzzleIndex + 1 < setSize) {
    return { cycle, puzzleIndex: puzzleIndex + 1, finished: false };
  }

  if (cycle < WOODPECKER_CYCLE_COUNT) {
    return { cycle: cycle + 1, puzzleIndex: 0, finished: false };
  }

  return { cycle, puzzleIndex, finished: true };
}
