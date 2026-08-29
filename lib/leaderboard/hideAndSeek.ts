import type { LeaderboardTimeWindow } from "@/lib/leaderboard/survival";

export type HideAndSeekLeaderboardScore = {
  studentId: string;
  weekScore: number;
  monthScore: number;
  allTimeScore: number;
  weekAttempts: number;
  monthAttempts: number;
  allTimeAttempts: number;
};

export function getHideAndSeekLeaderboardScore(
  score: HideAndSeekLeaderboardScore | undefined,
  timeWindow: LeaderboardTimeWindow
) {
  if (!score) return 0;
  if (timeWindow === "week") return score.weekScore;
  if (timeWindow === "month") return score.monthScore;
  return score.allTimeScore;
}

export function hasHideAndSeekLeaderboardScore(
  score: HideAndSeekLeaderboardScore | undefined,
  timeWindow: LeaderboardTimeWindow
) {
  if (!score) return false;
  if (timeWindow === "week") return score.weekAttempts > 0;
  if (timeWindow === "month") return score.monthAttempts > 0;
  return score.allTimeAttempts > 0;
}
