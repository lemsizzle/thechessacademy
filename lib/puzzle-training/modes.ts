export const SURVIVAL_PUZZLE_LIMIT = 50;
export const WOODPECKER_SET_SIZE = 20;
export const WOODPECKER_SET_SIZE_OPTIONS = [20, 30, 40, 50] as const;
export const WOODPECKER_MAX_SET_SIZE = WOODPECKER_SET_SIZE_OPTIONS[WOODPECKER_SET_SIZE_OPTIONS.length - 1];
export const WOODPECKER_ROUND_COUNT = 3;

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
