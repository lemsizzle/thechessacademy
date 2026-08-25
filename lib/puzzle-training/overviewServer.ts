import "server-only";

import { getSurvivalLeaderboardScores } from "@/lib/leaderboard/survivalServer";
import { emptyPuzzleTrainingOverview, type PuzzleTrainingOverview, type WoodpeckerCycleOverview } from "@/lib/puzzle-training/overview";
import { parsePuzzleTheme } from "@/lib/puzzle-training/types";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type WoodpeckerCycleRow = {
  set_size: number | string;
  puzzles_per_minute: number | string;
  accuracy: number | string;
  selected_theme: string;
  completed_at: string;
};

export async function getStudentPuzzleTrainingOverview(studentId: string): Promise<PuzzleTrainingOverview> {
  const client = getSupabaseServiceClient();
  if (!client) return emptyPuzzleTrainingOverview;

  const [survivalScores, woodpeckerResult] = await Promise.all([
    getSurvivalLeaderboardScores(),
    client
      .from("student_woodpecker_cycle_results")
      .select("set_size,puzzles_per_minute,accuracy,selected_theme,completed_at")
      .eq("student_id", studentId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);
  if (woodpeckerResult.error) throw new Error(woodpeckerResult.error.message);

  const survival = survivalScores.find((score) => score.studentId === studentId && score.theme === "mixed");
  const woodpecker = woodpeckerResult.data as WoodpeckerCycleRow | null;
  const latestWoodpeckerCycle: WoodpeckerCycleOverview | null = woodpecker
    ? {
      setSize: Math.max(0, Number(woodpecker.set_size)),
      puzzlesPerMinute: Math.max(0, Number(woodpecker.puzzles_per_minute)),
      accuracy: Math.min(100, Math.max(0, Number(woodpecker.accuracy))),
      theme: parsePuzzleTheme(woodpecker.selected_theme),
      completedAt: woodpecker.completed_at
    }
    : null;

  return {
    survival: survival
      ? { weekScore: survival.weekScore, monthScore: survival.monthScore, allTimeScore: survival.allTimeScore }
      : emptyPuzzleTrainingOverview.survival,
    latestWoodpeckerCycle
  };
}
