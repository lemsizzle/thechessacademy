export type LeaderboardTimeWindow = "week" | "month" | "all";

export type SurvivalLeaderboardScore = {
  studentId: string;
  weekScore: number;
  monthScore: number;
  allTimeScore: number;
};

export function getSurvivalLeaderboardScore(
  score: SurvivalLeaderboardScore | undefined,
  timeWindow: LeaderboardTimeWindow
) {
  if (!score) return 0;
  if (timeWindow === "week") return score.weekScore;
  if (timeWindow === "month") return score.monthScore;
  return score.allTimeScore;
}
