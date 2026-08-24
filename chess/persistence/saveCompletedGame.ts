import "server-only";

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { validateCompletedGame } from "@/chess/persistence/completedGame";

export async function saveCompletedGame(studentId: string, payload: unknown) {
  const game = validateCompletedGame(payload);
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Completed game storage is not configured.");

  const { data, error } = await supabase
    .from("internal_chess_games")
    .insert({
      player_id: studentId,
      opponent_type: game.opponentType,
      opponent_id: game.opponentId,
      opponent_name: game.opponentName,
      player_color: game.playerColor,
      result: game.result,
      result_reason: game.resultReason,
      winner_color: game.winnerColor,
      time_control: game.timeControl,
      initial_fen: game.initialFen,
      final_fen: game.finalFen,
      pgn: game.pgn,
      moves: game.moves,
      takeback_count: game.takebackCount,
      started_at: game.startedAt,
      completed_at: game.completedAt
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { id: (data as { id: string }).id };
}
