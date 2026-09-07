import "server-only";
import { getStudentDashboardData } from "@/lib/student/dashboard";
import { getSupabaseServerReadClient } from "@/lib/supabase/server";

export async function getPublicStudentDashboard(slug: string) {
  const supabase = getSupabaseServerReadClient();
  if (!supabase) throw new Error("Student profiles are temporarily unavailable.");
  const { data, error } = await supabase.from("students").select("id")
    .eq("public_slug", slug).eq("is_active", true).maybeSingle();
  if (error) throw new Error("Student profiles are temporarily unavailable.");
  if (!data) return null;
  const dashboard = await getStudentDashboardData(data.id, { readOnly: true });
  // Free-form teacher adjustment notes belong to the student's own dashboard.
  return {
    ...dashboard,
    activity: dashboard.activity.map((item) => item.kind === "xp" || item.kind === "coin"
      ? { ...item, detail: `${(item.amount ?? 0) >= 0 ? "+" : ""}${item.amount ?? 0} ${item.kind === "xp" ? "XP" : "Academy Coins"}.` }
      : item)
  };
}
