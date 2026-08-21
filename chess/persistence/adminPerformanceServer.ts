import "server-only";

import { buildAdminChessPerformance } from "@/chess/performance/aggregate";
import type { PerformanceGameInput, PerformanceStudentInput } from "@/chess/performance/types";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1_000;

type StudentRow = {
  id: string;
  display_name: string;
  public_slug: string;
  class_group: string | null;
};

type GameRow = {
  id: string;
  player_id: string;
  opponent_type: "computer" | "student";
  result: "win" | "draw" | "loss";
  completed_at: string;
  source_live_game_id: string | null;
};

function client() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Chess performance storage is not configured.");
  return supabase;
}

async function listGameRows() {
  const rows: GameRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client()
      .from("internal_chess_games")
      .select("id,player_id,opponent_type,result,completed_at,source_live_game_id")
      .order("completed_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as GameRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function getAdminChessPerformance(requestedClass = "all") {
  const [studentResult, gameRows] = await Promise.all([
    client()
      .from("students")
      .select("id,display_name,public_slug,class_group")
      .eq("is_active", true)
      .order("display_name", { ascending: true }),
    listGameRows()
  ]);
  if (studentResult.error) throw new Error(studentResult.error.message);

  const students = ((studentResult.data ?? []) as StudentRow[]).map((row): PerformanceStudentInput => ({
    id: row.id,
    name: row.display_name,
    slug: row.public_slug,
    classGroup: row.class_group?.trim() || "Unassigned"
  }));
  const games = gameRows.map((row): PerformanceGameInput => ({
    id: row.id,
    playerId: row.player_id,
    opponentType: row.opponent_type,
    result: row.result,
    completedAt: row.completed_at,
    sourceLiveGameId: row.source_live_game_id
  }));

  return buildAdminChessPerformance(students, games, requestedClass);
}
