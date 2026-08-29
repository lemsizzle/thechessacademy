import "server-only";

import type { HideAndSeekLeaderboardScore } from "@/lib/leaderboard/hideAndSeek";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type HideAndSeekScoreRow = {
  student_id: string;
  week_score: number | string | null;
  month_score: number | string | null;
  all_time_score: number | string | null;
  week_attempts: number | string | null;
  month_attempts: number | string | null;
  all_time_attempts: number | string | null;
};

function boundedScore(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(1_000, Math.max(0, Math.round(parsed))) : 0;
}

function attemptCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

export async function getHideAndSeekLeaderboardScores(): Promise<HideAndSeekLeaderboardScore[]> {
  const client = getSupabaseServiceClient();
  if (!client) return [];

  const { data, error } = await client.rpc("get_hide_and_seek_leaderboard");
  if (error) throw new Error(error.message);

  return ((data ?? []) as HideAndSeekScoreRow[]).map((row) => ({
    studentId: row.student_id,
    weekScore: boundedScore(row.week_score),
    monthScore: boundedScore(row.month_score),
    allTimeScore: boundedScore(row.all_time_score),
    weekAttempts: attemptCount(row.week_attempts),
    monthAttempts: attemptCount(row.month_attempts),
    allTimeAttempts: attemptCount(row.all_time_attempts)
  }));
}
