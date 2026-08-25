import type { PuzzleThemeSlug } from "@/lib/puzzle-training/types";

export type LeaderboardTimeWindow = "week" | "month" | "all";

export type SurvivalLeaderboardScore = {
  studentId: string;
  theme: PuzzleThemeSlug;
  weekScore: number;
  monthScore: number;
  allTimeScore: number;
};

export function survivalLeaderboardScoreKey(studentId: string, theme: PuzzleThemeSlug) {
  return `${studentId}:${theme}`;
}

export function getSurvivalLeaderboardScore(
  score: SurvivalLeaderboardScore | undefined,
  timeWindow: LeaderboardTimeWindow
) {
  if (!score) return 0;
  if (timeWindow === "week") return score.weekScore;
  if (timeWindow === "month") return score.monthScore;
  return score.allTimeScore;
}

export function hasSurvivalLeaderboardScore(
  score: SurvivalLeaderboardScore | undefined,
  timeWindow: LeaderboardTimeWindow
) {
  return getSurvivalLeaderboardScore(score, timeWindow) > 0;
}
