import "server-only";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { readDisplayedBadges } from "./displayedBadgeRead";

function client() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Badge display storage is unavailable.");
  return supabase;
}

export async function getOwnDisplayedBadge(studentId: string) {
  return (await readDisplayedBadges(client(), [studentId])).get(studentId) ?? null;
}

export async function setDisplayedBadge(studentId: string, badgeId: string | null) {
  const { error } = await client().rpc("set_student_displayed_badge", { p_student_id: studentId, p_badge_id: badgeId });
  if (error) {
    if (error.message.includes("not earned")) throw new BadgeNotEarnedError("You can only display a badge you have earned.");
    throw new Error(error.message);
  }
  return getOwnDisplayedBadge(studentId);
}

export class BadgeNotEarnedError extends Error {}
