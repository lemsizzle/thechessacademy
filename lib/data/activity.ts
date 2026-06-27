import { activity as mockActivity } from "@/data/activity";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { ActivityEvent } from "@/lib/types";
import { mockResult, shouldUseMock, supabaseResult, type DataResult } from "./shared";

type ActivityRow = {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  created_at: string;
};

function mapActivity(row: ActivityRow): ActivityEvent {
  return {
    id: row.id,
    title: row.title || row.event_type,
    detail: row.description ?? row.event_type,
    createdAt: row.created_at
  };
}

export async function getActivityEventsResult(): Promise<DataResult<ActivityEvent[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return mockResult(mockActivity, "Supabase is not configured.");

  const { data, error } = await supabase
    .from("activity_events")
    .select("id,event_type,title,description,created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (shouldUseMock(data, error)) return mockResult(mockActivity, error);
  return supabaseResult((data as ActivityRow[]).map(mapActivity));
}

export async function getActivityEvents() {
  return (await getActivityEventsResult()).data;
}
