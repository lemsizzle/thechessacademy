import { allBadges as mockBadges } from "@/data/badges";
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
