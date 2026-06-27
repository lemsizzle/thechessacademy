import { allBadges as mockBadges } from "@/data/badges";
import { students as mockStudents } from "@/data/students";
import { badgeSelect, mapSupabaseBadge, type SupabaseBadgeRow } from "@/lib/badges/supabaseBadges";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Badge } from "@/lib/types";
import { mockResult, shouldUseMock, supabaseResult, type DataResult } from "./shared";

export async function getBadgesResult(): Promise<DataResult<Badge[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return mockResult(mockBadges, "Supabase is not configured.");

  const { data, error } = await supabase
    .from("badges")
    .select(badgeSelect)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (shouldUseMock(data, error)) return mockResult(mockBadges, error);
  return supabaseResult((data as SupabaseBadgeRow[]).map(mapSupabaseBadge));
}

export async function getBadges() {
  return (await getBadgesResult()).data;
}

export async function getStudentBadges(studentId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const student = mockStudents.find((item) => item.id === studentId);
    return mockBadges.filter((badge) => student?.badgeIds.includes(badge.id));
  }

  const { data, error } = await supabase
    .from("student_badges")
    .select(`badges(${badgeSelect})`)
    .eq("student_id", studentId);

  if (error || !data) return [];

  return data
    .map((row) => row.badges)
    .filter(Boolean)
    .map((row) => mapSupabaseBadge(row as unknown as SupabaseBadgeRow));
}
