import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { purchasedChessThemes, PURCHASABLE_CHESS_THEMES } from "@/chess/appearance/themes";

/** Read-only entitlement lookup. Never grants inventory or creates a wallet. */
export async function getStudentBoardThemes(studentId: string) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Store unavailable.");
  const { data, error } = await supabase.from("student_inventory")
    .select("avatar_items!inner(slug,category)")
    .eq("student_id", studentId)
    .in("avatar_items.slug", purchasedChessThemes.map((theme) => PURCHASABLE_CHESS_THEMES[theme].slug))
    .eq("avatar_items.category", "board_theme")
    .limit(purchasedChessThemes.length);
  if (error) throw new Error("Could not check board theme ownership.");
  const ownedSlugs = new Set((data ?? []).flatMap((row) => {
    const items = Array.isArray(row.avatar_items) ? row.avatar_items : [row.avatar_items];
    return items.filter((item) => item?.category === "board_theme").map((item) => item.slug);
  }));
  const ownedThemes = purchasedChessThemes.filter((theme) => ownedSlugs.has(PURCHASABLE_CHESS_THEMES[theme].slug));
  // Older open tabs still expect this flag. All newer clients use the per-set list.
  return { studentId, ownsPaper: ownedThemes.includes("paper"), ownedThemes };
}
