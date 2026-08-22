import type { PuzzleLevelSlug } from "@/lib/puzzle-training/types";

export const SURVIVAL_PUZZLE_LIMIT = 50;
export const WOODPECKER_SET_SIZE = 20;
export const WOODPECKER_SET_SIZE_OPTIONS = [20, 30, 40, 50] as const;
export const WOODPECKER_MAX_SET_SIZE = WOODPECKER_SET_SIZE_OPTIONS[WOODPECKER_SET_SIZE_OPTIONS.length - 1];
export const WOODPECKER_ROUND_COUNT = 3;

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
  round: number;
  puzzleIndex: number;
  finished: boolean;
};

export function nextWoodpeckerStep(round: number, puzzleIndex: number, setSize: number): WoodpeckerStep {
  if (setSize < 1) {
    return { round: 1, puzzleIndex: 0, finished: true };
  }

  if (puzzleIndex + 1 < setSize) {
    return { round, puzzleIndex: puzzleIndex + 1, finished: false };
  }

  if (round < WOODPECKER_ROUND_COUNT) {
    return { round: round + 1, puzzleIndex: 0, finished: false };
  }

  return { round, puzzleIndex, finished: true };
}
