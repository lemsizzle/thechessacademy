import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { HALLOWEEN_BOTS, HALLOWEEN_END } from "@/lib/quests/halloween";
import { HALLOWEEN_ADAPTATION_START, halloweenReductionsFromGames, type HalloweenLossRecord } from "@/chess/bots/halloweenAdaptation";

/** One bounded read on Play setup or after a Halloween loss, never during moves.
 * PGN avoids transferring the much larger per-move FEN snapshots. Earliest-first
 * ordering makes reductions stable even if a student exceeds the safety bound.
 */
export async function getStudentHalloweenReductions(studentId: string) {
  const client = getSupabaseServiceClient();
  if (!client) throw new Error("Halloween difficulty storage is unavailable.");
  const { data, error } = await client.from("internal_chess_games")
    .select("id,opponent_id,player_color,result,result_reason,initial_fen,pgn,takeback_count,hints_used,started_at,completed_at,created_at")
    .eq("player_id", studentId).eq("opponent_type", "computer")
    .eq("result", "loss").eq("result_reason", "checkmate")
    .eq("takeback_count", 0).eq("hints_used", 0)
    .not("moves->23", "is", null)
    .in("opponent_id", HALLOWEEN_BOTS.map((bot) => bot.id))
    .gte("started_at", HALLOWEEN_ADAPTATION_START).gte("created_at", HALLOWEEN_ADAPTATION_START)
    .lt("created_at", HALLOWEEN_END)
    .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(500);
  if (error) throw new Error("Halloween difficulty could not be loaded.");
  return halloweenReductionsFromGames((data ?? []) as HalloweenLossRecord[]);
}
