import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SurvivalLeaderboardScore } from "@/lib/leaderboard/survival";
import { getSurvivalLeaderboardScores } from "@/lib/leaderboard/survivalServer";
import { DAILY_PUZZLE_COINS, DAILY_PUZZLE_XP } from "@/lib/puzzle-training/daily";
import {
  emptyPuzzleTrainingOverview,
  getStudentSurvivalPersonalRecords,
  summarizePuzzleAttempts,
  type PuzzleTrainingOverview,
  type WoodpeckerCycleHistoryOverview,
  type WoodpeckerSetOverview
} from "@/lib/puzzle-training/overview";
import { parsePuzzleTheme } from "@/lib/puzzle-training/types";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const ATTEMPT_PAGE_SIZE = 1_000;
const RECENT_WOODPECKER_CYCLE_LIMIT = 12;
const RECENT_WOODPECKER_SET_LIMIT = 6;

type PuzzleAttemptRow = {
  id: string;
  solved: boolean;
  elapsed_seconds: number | string | null;
};

type DailyPuzzleRewardRow = {
  rewarded_at: string;
};

type WoodpeckerCycleRow = {
  set_size: number | string;
  puzzles_per_minute: number | string;
  accuracy: number | string;
  selected_theme: string;
  completed_at: string;
  cycle_number: number | string | null;
};

type WoodpeckerSetRow = {
  set_size: number | string;
  cycle_count: number | string;
  selected_theme: string;
  started_at: string;
  completed_at: string;
};

function nonNegativeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function nonNegativeInteger(value: unknown) {
  return Math.round(nonNegativeNumber(value));
}

function normalizeCycleNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 3 ? parsed : null;
}

async function loadPuzzleAttemptOverview(client: SupabaseClient, studentId: string) {
  const rows: PuzzleAttemptRow[] = [];
  let cursorId: string | null = null;
  let expectedCount: number | null = null;

  for (;;) {
    let query = client
      .from("student_puzzle_attempts")
      .select("id,solved,elapsed_seconds", cursorId ? undefined : { count: "exact" })
      .eq("student_id", studentId);
    if (cursorId) query = query.gt("id", cursorId);

    const { data, count, error } = await query
      .order("id", { ascending: true })
      .limit(ATTEMPT_PAGE_SIZE);
    if (error) throw new Error(error.message);

    const page = (data ?? []) as PuzzleAttemptRow[];
    if (expectedCount === null && count !== null) expectedCount = nonNegativeInteger(count);
    if (!page.length) break;
    rows.push(...page);
    if (expectedCount !== null && rows.length >= expectedCount) break;
    cursorId = page.at(-1)?.id ?? null;
    if (!cursorId) break;
  }

  return summarizePuzzleAttempts(rows.map((row) => ({
    solved: row.solved,
    elapsedSeconds: nonNegativeNumber(row.elapsed_seconds)
  })));
}

function mapWoodpeckerCycle(row: WoodpeckerCycleRow): WoodpeckerCycleHistoryOverview {
  return {
    setSize: nonNegativeInteger(row.set_size),
    puzzlesPerMinute: nonNegativeNumber(row.puzzles_per_minute),
    accuracy: Math.min(100, nonNegativeInteger(row.accuracy)),
    theme: parsePuzzleTheme(row.selected_theme),
    completedAt: row.completed_at,
    cycleNumber: normalizeCycleNumber(row.cycle_number)
  };
}

function mapWoodpeckerSet(row: WoodpeckerSetRow): WoodpeckerSetOverview {
  return {
    setSize: nonNegativeInteger(row.set_size),
    cycleCount: nonNegativeInteger(row.cycle_count),
    theme: parsePuzzleTheme(row.selected_theme),
    startedAt: row.started_at,
    completedAt: row.completed_at
  };
}

export async function getStudentPuzzleTrainingOverview(
  studentId: string,
  preloadedSurvivalScores?: SurvivalLeaderboardScore[]
): Promise<PuzzleTrainingOverview> {
  const client = getSupabaseServiceClient();
  if (!client) return emptyPuzzleTrainingOverview;

  const [
    survivalScores,
    overall,
    dailyResult,
    woodpeckerCycleResult,
    woodpeckerSetResult
  ] = await Promise.all([
    preloadedSurvivalScores ?? getSurvivalLeaderboardScores(),
    loadPuzzleAttemptOverview(client, studentId),
    client
      .from("student_daily_puzzle_rewards")
      .select("rewarded_at", { count: "exact" })
      .eq("student_id", studentId)
      .order("rewarded_at", { ascending: false })
      .limit(1),
    client
      .from("student_woodpecker_cycle_results")
      .select("set_size,puzzles_per_minute,accuracy,selected_theme,completed_at,cycle_number", { count: "exact" })
      .eq("student_id", studentId)
      .order("completed_at", { ascending: false })
      .limit(RECENT_WOODPECKER_CYCLE_LIMIT),
    client
      .from("student_woodpecker_set_results")
      .select("set_size,cycle_count,selected_theme,started_at,completed_at", { count: "exact" })
      .eq("student_id", studentId)
      .order("completed_at", { ascending: false })
      .limit(RECENT_WOODPECKER_SET_LIMIT)
  ]);

  if (dailyResult.error) throw new Error(dailyResult.error.message);
  if (woodpeckerCycleResult.error) throw new Error(woodpeckerCycleResult.error.message);
  if (woodpeckerSetResult.error) throw new Error(woodpeckerSetResult.error.message);

  const survivalByTheme = getStudentSurvivalPersonalRecords(survivalScores, studentId);
  const mixedSurvival = survivalByTheme.find((score) => score.theme === "mixed");
  const dailyRows = (dailyResult.data ?? []) as DailyPuzzleRewardRow[];
  const completedDailyPuzzles = nonNegativeInteger(dailyResult.count ?? 0);
  const recentCycles = ((woodpeckerCycleResult.data ?? []) as WoodpeckerCycleRow[]).map(mapWoodpeckerCycle);
  const recentSets = ((woodpeckerSetResult.data ?? []) as WoodpeckerSetRow[]).map(mapWoodpeckerSet);

  return {
    overall,
    daily: {
      completed: completedDailyPuzzles,
      xpEarned: completedDailyPuzzles * DAILY_PUZZLE_XP,
      coinsEarned: completedDailyPuzzles * DAILY_PUZZLE_COINS,
      latestCompletedAt: dailyRows[0]?.rewarded_at ?? null
    },
    survival: mixedSurvival
      ? {
        weekScore: mixedSurvival.weekScore,
        monthScore: mixedSurvival.monthScore,
        allTimeScore: mixedSurvival.allTimeScore
      }
      : emptyPuzzleTrainingOverview.survival,
    survivalByTheme,
    latestWoodpeckerCycle: recentCycles[0] ?? null,
    woodpecker: {
      completedCycles: nonNegativeInteger(woodpeckerCycleResult.count ?? 0),
      completedSets: nonNegativeInteger(woodpeckerSetResult.count ?? 0),
      recentCycles,
      recentSets
    }
  };
}
