import "server-only";

import type { CompletedGameMove } from "@/chess/analysis/types";
import { createChessHistorySummary } from "@/chess/history/history";
import type {
  ChessHistoryFilters,
  ChessHistoryGame,
  ChessHistoryMode,
  ChessHistoryPage,
  ChessHistoryResult
} from "@/chess/history/types";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type HistoryRow = {
  id: string;
  game_mode: "live" | "correspondence" | null;
  opponent_type: Exclude<ChessHistoryMode, "all">;
  opponent_name: string;
  player_color: "white" | "black";
  result: Exclude<ChessHistoryResult, "all">;
  result_reason: string;
  moves: CompletedGameMove[] | null;
  started_at: string;
  completed_at: string;
  time_control: ChessHistoryGame["timeControl"] | null;
};

function client() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Chess history storage is not configured.");
  return supabase;
}

function applyFilters<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  filters: Pick<ChessHistoryFilters, "mode" | "result">
) {
  let filtered = query;
  if (filters.mode !== "all") filtered = filtered.eq("opponent_type", filters.mode);
  if (filters.result !== "all") filtered = filtered.eq("result", filters.result);
  return filtered;
}

async function countGames(
  studentId: string,
  filters: Partial<Pick<ChessHistoryFilters, "mode" | "result">> = {}
) {
  let query = client()
    .from("internal_chess_games")
    .select("id", { count: "exact", head: true })
    .eq("player_id", studentId);

  if (filters.mode && filters.mode !== "all") query = query.eq("opponent_type", filters.mode);
  if (filters.result && filters.result !== "all") query = query.eq("result", filters.result);

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function mapHistoryGame(row: HistoryRow): ChessHistoryGame {
  return {
    id: row.id,
    gameMode: row.game_mode ?? "live",
    opponentType: row.opponent_type,
    opponentName: row.opponent_name,
    playerColor: row.player_color,
    result: row.result,
    resultReason: row.result_reason,
    moveCount: Math.ceil((row.moves?.length ?? 0) / 2),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    timeControl: row.time_control ?? {}
  };
}

export async function getStudentChessHistory(
  studentId: string,
  filters: ChessHistoryFilters
): Promise<ChessHistoryPage> {
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  let pageQuery = client()
    .from("internal_chess_games")
    .select(
      "id,game_mode,opponent_type,opponent_name,player_color,result,result_reason,moves,started_at,completed_at,time_control",
      { count: "exact" }
    )
    .eq("player_id", studentId);

  pageQuery = applyFilters(pageQuery, filters)
    .order("completed_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  const [pageResult, wins, draws, losses, computerGames, liveGames] = await Promise.all([
    pageQuery,
    countGames(studentId, { result: "win" }),
    countGames(studentId, { result: "draw" }),
    countGames(studentId, { result: "loss" }),
    countGames(studentId, { mode: "computer" }),
    countGames(studentId, { mode: "student" })
  ]);

  if (pageResult.error) throw new Error(pageResult.error.message);
  const total = wins + draws + losses;
  const filteredTotal = pageResult.count ?? 0;

  return {
    games: ((pageResult.data ?? []) as HistoryRow[]).map(mapHistoryGame),
    filters,
    summary: createChessHistorySummary({ total, wins, draws, losses, computerGames, liveGames }),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total: filteredTotal,
      totalPages: filteredTotal > 0 ? Math.ceil(filteredTotal / filters.pageSize) : 0
    }
  };
}
