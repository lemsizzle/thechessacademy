import { WOODPECKER_CYCLE_COUNT } from "@/lib/puzzle-training/modes";

export const CONQUER_WOODPECKER_SET_SIZE = 20;

export type SavedWoodpeckerSetAttempt = {
  puzzle_id: string;
  session_id: string;
  solved: boolean;
  selected_theme: string;
  attempted_at: string;
  completed_at: string | null;
  woodpecker_run_id: string | null;
  woodpecker_cycle_number: number | null;
};

export type ValidatedWoodpeckerSet = {
  cycleCount: number;
  setSize: number;
  selectedTheme: string;
  puzzleIds: string[];
  startedAt: string;
  completedAt: string;
};

function sameStrings(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function validateCompletedWoodpeckerSet(
  runId: string,
  cycleSessionIds: string[],
  attempts: SavedWoodpeckerSetAttempt[]
): ValidatedWoodpeckerSet {
  if (cycleSessionIds.length !== WOODPECKER_CYCLE_COUNT || new Set(cycleSessionIds).size !== WOODPECKER_CYCLE_COUNT) {
    throw new Error(`A full Woodpecker set requires ${WOODPECKER_CYCLE_COUNT} distinct cycles.`);
  }

  let expectedPuzzleIds: string[] | null = null;
  let selectedTheme: string | null = null;
  let startedAtMs = Number.POSITIVE_INFINITY;
  let completedAtMs = Number.NEGATIVE_INFINITY;
  let priorCycleCompletedAtMs = Number.NEGATIVE_INFINITY;

  for (const [cycleIndex, sessionId] of cycleSessionIds.entries()) {
    const cycleNumber = cycleIndex + 1;
    const cycleAttempts = attempts.filter((attempt) => attempt.woodpecker_cycle_number === cycleNumber);
    const puzzleIds = cycleAttempts.map((attempt) => attempt.puzzle_id).sort();
    const themes = new Set(cycleAttempts.map((attempt) => attempt.selected_theme));

    if (cycleAttempts.length !== CONQUER_WOODPECKER_SET_SIZE
      || new Set(puzzleIds).size !== CONQUER_WOODPECKER_SET_SIZE
      || cycleAttempts.some((attempt) => !attempt.solved
        || attempt.session_id !== sessionId
        || attempt.woodpecker_run_id !== runId)) {
      throw new Error(`Each Woodpecker cycle must contain exactly ${CONQUER_WOODPECKER_SET_SIZE} solved puzzles.`);
    }
    if (themes.size !== 1) throw new Error("Every puzzle in a Woodpecker cycle must use the same theme.");
    if (expectedPuzzleIds && !sameStrings(puzzleIds, expectedPuzzleIds)) {
      throw new Error("Every Woodpecker cycle must repeat the same 20-puzzle set.");
    }

    const cycleTheme = [...themes][0];
    if (selectedTheme && cycleTheme !== selectedTheme) {
      throw new Error("Every Woodpecker cycle must use the same theme.");
    }
    selectedTheme = cycleTheme;
    expectedPuzzleIds ??= puzzleIds;

    let cycleStartedAtMs = Number.POSITIVE_INFINITY;
    let cycleCompletedAtMs = Number.NEGATIVE_INFINITY;
    for (const attempt of cycleAttempts) {
      const attemptedAtMs = Date.parse(attempt.attempted_at);
      const attemptCompletedAtMs = Date.parse(attempt.completed_at ?? "");
      if (!Number.isFinite(attemptedAtMs)
        || !Number.isFinite(attemptCompletedAtMs)
        || attemptedAtMs > attemptCompletedAtMs) {
        throw new Error("Every Woodpecker puzzle must have a valid training time.");
      }
      cycleStartedAtMs = Math.min(cycleStartedAtMs, attemptedAtMs);
      cycleCompletedAtMs = Math.max(cycleCompletedAtMs, attemptCompletedAtMs);
      startedAtMs = Math.min(startedAtMs, attemptedAtMs);
      completedAtMs = Math.max(completedAtMs, attemptCompletedAtMs);
    }
    if (cycleStartedAtMs < priorCycleCompletedAtMs) {
      throw new Error("Woodpecker cycles must be completed in order without overlapping.");
    }
    priorCycleCompletedAtMs = cycleCompletedAtMs;
  }

  if (attempts.length !== CONQUER_WOODPECKER_SET_SIZE * WOODPECKER_CYCLE_COUNT) {
    throw new Error("A full Woodpecker set must contain exactly three complete cycles.");
  }

  return {
    cycleCount: WOODPECKER_CYCLE_COUNT,
    setSize: CONQUER_WOODPECKER_SET_SIZE,
    selectedTheme: selectedTheme ?? "mixed",
    puzzleIds: expectedPuzzleIds ?? [],
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date(completedAtMs).toISOString()
  };
}
