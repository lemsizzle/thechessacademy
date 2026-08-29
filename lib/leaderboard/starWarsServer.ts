import "server-only";

import type { StarWarsLeaderboardScore } from "@/lib/leaderboard/starWars";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type StarWarsScoreRow = {
  student_id: string;
  week_score: number | string | null;
  month_score: number | string | null;
  all_time_score: number | string | null;
};

function boundedScore(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(500, Math.max(0, Math.round(parsed))) : 0;
}

export async function getStarWarsLeaderboardScores(): Promise<StarWarsLeaderboardScore[]> {
  const client = getSupabaseServiceClient();
  if (!client) return [];

  const { data, error } = await client.rpc("get_star_wars_leaderboard");
  if (error) throw new Error(error.message);

  return ((data ?? []) as StarWarsScoreRow[]).map((row) => ({
    studentId: row.student_id,
    weekScore: boundedScore(row.week_score),
    monthScore: boundedScore(row.month_score),
    allTimeScore: boundedScore(row.all_time_score)
  }));
}
