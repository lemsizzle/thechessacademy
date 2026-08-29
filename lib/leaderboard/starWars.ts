import type { LeaderboardTimeWindow } from "@/lib/leaderboard/survival";

export type StarWarsLeaderboardScore = {
  studentId: string;
  weekScore: number;
  monthScore: number;
  allTimeScore: number;
};

export function getStarWarsLeaderboardScore(
  score: StarWarsLeaderboardScore | undefined,
  timeWindow: LeaderboardTimeWindow
) {
  if (!score) return 0;
  if (timeWindow === "week") return score.weekScore;
  if (timeWindow === "month") return score.monthScore;
  return score.allTimeScore;
}

export function hasStarWarsLeaderboardScore(
  score: StarWarsLeaderboardScore | undefined,
  timeWindow: LeaderboardTimeWindow
) {
  return getStarWarsLeaderboardScore(score, timeWindow) > 0;
}
