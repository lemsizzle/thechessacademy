import type { SurvivalLeaderboardScore } from "@/lib/leaderboard/survival";
import { puzzleThemeSlugs, type PuzzleThemeSlug } from "@/lib/puzzle-training/types";

export type PuzzleAttemptOverview = {
  attempts: number;
  solved: number;
  accuracy: number;
  elapsedSeconds: number;
};

export type DailyPuzzleOverview = {
  completed: number;
  xpEarned: number;
  coinsEarned: number;
  latestCompletedAt: string | null;
};

export type WoodpeckerCycleOverview = {
  puzzlesPerMinute: number;
  accuracy: number;
  setSize: number;
  theme: PuzzleThemeSlug;
  completedAt: string;
};

export type WoodpeckerCycleHistoryOverview = WoodpeckerCycleOverview & {
  cycleNumber: number | null;
};

export type WoodpeckerSetOverview = {
  setSize: number;
  cycleCount: number;
  theme: PuzzleThemeSlug;
  startedAt: string;
  completedAt: string;
};

export type WoodpeckerHistoryOverview = {
  completedCycles: number;
  completedSets: number;
  recentCycles: WoodpeckerCycleHistoryOverview[];
  recentSets: WoodpeckerSetOverview[];
};

export type SurvivalPersonalRecord = Pick<
  SurvivalLeaderboardScore,
  "theme" | "weekScore" | "monthScore" | "allTimeScore"
>;

export type PuzzleTrainingOverview = {
  overall: PuzzleAttemptOverview;
  daily: DailyPuzzleOverview;
  survival: Pick<SurvivalLeaderboardScore, "weekScore" | "monthScore" | "allTimeScore">;
  survivalByTheme: SurvivalPersonalRecord[];
  latestWoodpeckerCycle: WoodpeckerCycleOverview | null;
  woodpecker: WoodpeckerHistoryOverview;
};

export const emptyPuzzleTrainingOverview: PuzzleTrainingOverview = {
  overall: { attempts: 0, solved: 0, accuracy: 0, elapsedSeconds: 0 },
  daily: { completed: 0, xpEarned: 0, coinsEarned: 0, latestCompletedAt: null },
  survival: { weekScore: 0, monthScore: 0, allTimeScore: 0 },
  survivalByTheme: [],
  latestWoodpeckerCycle: null,
  woodpecker: { completedCycles: 0, completedSets: 0, recentCycles: [], recentSets: [] }
};

export function summarizePuzzleAttempts(
  attempts: ReadonlyArray<{ solved: boolean; elapsedSeconds: number }>
): PuzzleAttemptOverview {
  const solved = attempts.reduce((total, attempt) => total + (attempt.solved ? 1 : 0), 0);
  const elapsedSeconds = attempts.reduce((total, attempt) => (
    total + (Number.isFinite(attempt.elapsedSeconds) ? Math.max(0, attempt.elapsedSeconds) : 0)
  ), 0);

  return {
    attempts: attempts.length,
    solved,
    accuracy: attempts.length ? Math.round((solved / attempts.length) * 100) : 0,
    elapsedSeconds: Math.round(elapsedSeconds)
  };
}

export function getStudentSurvivalPersonalRecords(
  scores: readonly SurvivalLeaderboardScore[],
  studentId: string
): SurvivalPersonalRecord[] {
  const themeOrder = new Map(puzzleThemeSlugs.map((theme, index) => [theme, index]));

  return scores
    .filter((score) => score.studentId === studentId)
    .map(({ theme, weekScore, monthScore, allTimeScore }) => ({
      theme,
      weekScore,
      monthScore,
      allTimeScore
    }))
    .sort((left, right) => (themeOrder.get(left.theme) ?? Number.MAX_SAFE_INTEGER)
      - (themeOrder.get(right.theme) ?? Number.MAX_SAFE_INTEGER));
}
