import type { SupabaseClient } from "@supabase/supabase-js";
import { DISPLAY_BADGE_COLUMNS, toDisplayedBadge, type DisplayBadgeRow } from "./displayedBadge";
import type { DisplayedBadge } from "@/lib/types";

export async function readDisplayedBadges(client: SupabaseClient, studentIds: string[]) {
  const ids = [...new Set(studentIds.filter(Boolean))];
  const badges = new Map<string, DisplayedBadge>();
  if (!ids.length) return badges;
  const { data, error } = await client.from("student_badges")
    .select(`student_id,badges!inner(${DISPLAY_BADGE_COLUMNS})`).eq("is_displayed", true).in("student_id", ids);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as unknown as Array<{ student_id: string; badges: DisplayBadgeRow }>) {
    if (row.badges) badges.set(row.student_id, toDisplayedBadge(row.badges));
  }
  return badges;
}
