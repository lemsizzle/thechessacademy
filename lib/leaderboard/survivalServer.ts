import "server-only";

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { SurvivalLeaderboardScore } from "@/lib/leaderboard/survival";
import { parsePuzzleTheme } from "@/lib/puzzle-training/types";

type SurvivalScoreRow = {
  student_id: string;
  theme: string;
  week_score: number | string | null;
  month_score: number | string | null;
  all_time_score: number | string | null;
};

export async function getSurvivalLeaderboardScores(): Promise<SurvivalLeaderboardScore[]> {
  const client = getSupabaseServiceClient();
  if (!client) return [];

  const { data, error } = await client.rpc("get_survival_puzzle_leaderboard_by_theme");
  if (error) throw new Error(error.message);

  return ((data ?? []) as SurvivalScoreRow[]).map((row) => ({
    studentId: row.student_id,
    theme: parsePuzzleTheme(row.theme),
    weekScore: Math.max(0, Number(row.week_score ?? 0)),
    monthScore: Math.max(0, Number(row.month_score ?? 0)),
    allTimeScore: Math.max(0, Number(row.all_time_score ?? 0))
  }));
}
