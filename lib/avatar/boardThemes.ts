import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { PAPER_CHESS_SET_SLUG } from "@/chess/appearance/themes";

/** Read-only entitlement lookup. Never grants inventory or creates a wallet. */
export async function getStudentBoardThemes(studentId: string) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Store unavailable.");
  const { data, error } = await supabase.from("student_inventory")
    .select("avatar_items!inner(slug,category)")
    .eq("student_id", studentId)
    .eq("avatar_items.slug", PAPER_CHESS_SET_SLUG)
    .eq("avatar_items.category", "board_theme")
    .limit(1);
  if (error) throw new Error("Could not check board theme ownership.");
  return { studentId, ownsPaper: Boolean(data?.length) };
}
