import type { SurvivalLeaderboardScore } from "@/lib/leaderboard/survival";
import type { AvatarItem, Student, StudentAvatarConfig } from "@/lib/types";

export type PuzzleLeaderboardData = {
  students: Student[];
  avatarItems: AvatarItem[];
  studentAvatars: Record<string, StudentAvatarConfig>;
  survivalScores: SurvivalLeaderboardScore[];
};
