import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { SEASONAL_BOT_HUNTS, seasonalQuestState } from "@/lib/quests/seasonalBotHunts";
import { seasonalReductionsFromGames, type HalloweenLossRecord } from "@/chess/bots/halloweenAdaptation";

// One bounded compact read per current hunt, only on setup/after a loss. Retired
// holidays add no ongoing queries as the seasonal catalog grows.
export async function getStudentSeasonalReductions(studentId: string) {
  const client = getSupabaseServiceClient();
  if (!client) throw new Error("Seasonal difficulty storage is unavailable.");
  const active = SEASONAL_BOT_HUNTS.filter((hunt) => seasonalQuestState(hunt, false) === "active");
  const records = await Promise.all(active.map(async (hunt) => {
    const { data, error } = await client.from("internal_chess_games")
      .select("id,opponent_id,player_color,result,result_reason,initial_fen,pgn,takeback_count,hints_used,started_at,completed_at,created_at")
      .eq("player_id", studentId).eq("opponent_type", "computer").eq("result", "loss").eq("result_reason", "checkmate")
      .eq("takeback_count", 0).eq("hints_used", 0).not("moves->23", "is", null)
      .in("opponent_id", hunt.bots.map((bot) => bot.id))
      .gte("started_at", hunt.adaptationStartsAt).gte("created_at", hunt.adaptationStartsAt).lt("created_at", hunt.endsAt)
      .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(500);
    if (error) throw new Error("Seasonal difficulty could not be loaded.");
    return (data ?? []) as HalloweenLossRecord[];
  }));
  return seasonalReductionsFromGames(records.flat());
}
